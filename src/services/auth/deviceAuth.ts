import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL } from '@/constants/env';

/**
 * Mobile-only authentication for the standalone APK.
 *
 * A standalone APK cannot hold an Emergent session_id, so the app mints its own
 * per-install identity: a random device_id plus a high-entropy device_secret.
 * The secret is stored ONLY in the device keystore (expo-secure-store) and the
 * server keeps only its SHA-256 hash. The server issues a real session_token
 * (the same bearer model the web flow uses) which the app attaches to every
 * API request and refreshes transparently when it expires (401).
 *
 * No server-side credential ever leaves the backend, and no deduplicated
 * credential is embedded in the APK.
 */

export class MobileAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MobileAuthError';
  }
}

const KEY_DEVICE_ID = 'recordioai.device.id';
const KEY_DEVICE_SECRET = 'recordioai.device.secret';
const KEY_SESSION_TOKEN = 'recordioai.session.token';

const DEVICE_NAME = 'Android';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

let inFlight: Promise<string> | null = null;

async function generateDeviceSecret(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(24);
  return bytesToHex(bytes);
}

function generateDeviceId(): string {
  return `dev_${Crypto.randomUUID().replace(/-/g, '')}`;
}

async function clearCachedCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_SESSION_TOKEN);
  await SecureStore.deleteItemAsync(KEY_DEVICE_ID);
  await SecureStore.deleteItemAsync(KEY_DEVICE_SECRET);
}

async function cacheCredentials(
  deviceId: string,
  deviceSecret: string,
  sessionToken: string
): Promise<void> {
  await SecureStore.setItemAsync(KEY_DEVICE_ID, deviceId);
  await SecureStore.setItemAsync(KEY_DEVICE_SECRET, deviceSecret);
  await SecureStore.setItemAsync(KEY_SESSION_TOKEN, sessionToken);
}

async function registerDeviceAndReturnToken(): Promise<string> {
  const deviceId = generateDeviceId();
  const deviceSecret = await generateDeviceSecret();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, device_name: DEVICE_NAME }),
    });
  } catch {
    throw new MobileAuthError(
      'Could not reach the RecordioAI service to register this device. Check your connection and try again.'
    );
  }

  if (!response.ok) {
    throw new MobileAuthError(
      `RecordioAI device registration failed (error ${response.status}). Please try again.`
    );
  }

  let data: { session_token?: string } = {};
  try {
    data = await response.json();
  } catch {
    throw new MobileAuthError(
      'RecordioAI returned an unreadable registration response. Please try again.'
    );
  }

  if (!data.session_token) {
    throw new MobileAuthError(
      'RecordioAI did not issue a session after registering this device. Please try again.'
    );
  }

  await cacheCredentials(deviceId, deviceSecret, data.session_token);
  return data.session_token;
}

async function refreshTokenWithDevice(
  deviceId: string,
  deviceSecret: string
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, device_secret: deviceSecret }),
    });
  } catch {
    throw new MobileAuthError(
      'Could not reach the RecordioAI service to refresh the session. Check your connection and try again.'
    );
  }

  if (!response.ok) {
    // The stored device credential is no longer accepted (e.g. the server
    // database was reset). Clear it and re-register a fresh identity.
    await clearCachedCredentials();
    return registerDeviceAndReturnToken();
  }

  let data: { session_token?: string } = {};
  try {
    data = await response.json();
  } catch {
    throw new MobileAuthError(
      'RecordioAI returned an unreadable session response. Please try again.'
    );
  }

  if (!data.session_token) {
    throw new MobileAuthError(
      'RecordioAI did not issue a fresh session. Please try again.'
    );
  }

  await SecureStore.setItemAsync(KEY_SESSION_TOKEN, data.session_token);
  return data.session_token;
}

/**
 * Returns a valid bearer token, registering the device or refreshing the cached
 * session as needed. Serialises concurrent callers so the registration flow runs
 * exactly once.
 */
export async function ensureSessionToken(forceRefresh = false): Promise<string> {
  if (forceRefresh || !inFlight) {
    inFlight = (async () => {
      if (!forceRefresh) {
        const cached = await SecureStore.getItemAsync(KEY_SESSION_TOKEN);
        if (cached) {
          return cached;
        }
      }

      const deviceId = await SecureStore.getItemAsync(KEY_DEVICE_ID);
      const deviceSecret = await SecureStore.getItemAsync(KEY_DEVICE_SECRET);

      if (!deviceId || !deviceSecret) {
        return registerDeviceAndReturnToken();
      }
      return refreshTokenWithDevice(deviceId, deviceSecret);
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Drops the cached session so the next call mints a fresh token. */
export async function invalidateSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_SESSION_TOKEN);
}

/**
 * fetch wrapper that attaches the bearer token and transparently refreshes once
 * when the session has expired (401).
 */
export async function authedFetch(
  input: string,
  init: RequestInit = {},
  options: { retryUnauthorized?: boolean } = {}
): Promise<Response> {
  const { retryUnauthorized = true } = options;

  let token = await ensureSessionToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && retryUnauthorized) {
    await invalidateSessionToken();
    token = await ensureSessionToken(true);
    headers.set('Authorization', `Bearer ${token}`);
    response = await fetch(input, { ...init, headers });
  }

  return response;
}
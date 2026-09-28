import * as SecureStore from 'expo-secure-store';
import {
  authedFetch,
  ensureSessionToken,
  MobileAuthError,
} from './deviceAuth';

/**
 * In-memory stand-in for the native SecureStore keystore. The credential keys
 * live only in this map for the duration of a test.
 */
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
  __reset: () => mockStore.clear(),
}));

jest.mock('expo-crypto', () => {
  let counter = 0;
  const pseudoRandom = () => {
    counter = (counter * 1103515245 + 12345) % 2147483648;
    return counter;
  };
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
        const r = pseudoRandom() % 16;
        const v = ch === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }),
    getRandomBytesAsync: async (byteCount: number) =>
      Uint8Array.from({ length: byteCount }, () => pseudoRandom() % 256),
  };
});

interface RecordedRequest {
  input: string;
  // Cloned at call time so later header mutations (401 retry) cannot retroactively
  // change what a recorded request "sent".
  headers: Headers;
}

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let fetchCalls: RecordedRequest[] = [];
let registerResponses: ReturnType<typeof jsonResponse>[];
let tokenResponses: ReturnType<typeof jsonResponse>[];

const recordCall = (input: RequestInfo | URL, init?: RequestInit): void => {
  fetchCalls.push({
    input: String(input),
    headers: new Headers(init?.headers),
  });
};

const defaultRegister = () =>
  jsonResponse(201, {
    session_token: 'tok-reg',
    device_id: 'reg-id',
    device_secret: 'reg-secret',
    user: {},
  });
const defaultToken = () => jsonResponse(200, { session_token: 'tok-refresh' });
const defaultAuthed = () => jsonResponse(200, { ok: true });

beforeEach(() => {
  (SecureStore as unknown as { __reset: () => void }).__reset();
  fetchCalls = [];
  registerResponses = [];
  tokenResponses = [];

  global.fetch = jest.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      recordCall(input, init);
      const url = String(input);
      if (url.endsWith('/api/auth/device/register')) {
        return Promise.resolve(
          registerResponses.shift() ?? defaultRegister()
        ) as Promise<Response>;
      }
      if (url.endsWith('/api/auth/device/token')) {
        return Promise.resolve(
          tokenResponses.shift() ?? defaultToken()
        ) as Promise<Response>;
      }
      return Promise.resolve(defaultAuthed()) as Promise<Response>;
    }
  );
});

function registerCalls(ending: string): RecordedRequest[] {
  return fetchCalls.filter((c) => c.input.endsWith(ending));
}

describe('ensureSessionToken', () => {
  it('registers the device once and caches the session on first use', async () => {
    const first = await ensureSessionToken();
    const second = await ensureSessionToken();

    expect(first).toBe('tok-reg');
    expect(second).toBe('tok-reg');
    expect(registerCalls('/api/auth/device/register')).toHaveLength(1);
    expect(registerCalls('/api/auth/device/token')).toHaveLength(0);

    // The device identity and its secret are persisted in the keystore so the
    // session can be refreshed on the next launch.
    expect(mockStore.has('recordioai.device.id')).toBe(true);
    expect(mockStore.has('recordioai.device.secret')).toBe(true);
    expect(mockStore.get('recordioai.session.token')).toBe('tok-reg');
  });

  it('serves the cached session without any network call', async () => {
    mockStore.set('recordioai.session.token', 'tok-cached');
    mockStore.set('recordioai.device.id', 'dev-1');
    mockStore.set('recordioai.device.secret', 'secret-1');

    await expect(ensureSessionToken()).resolves.toBe('tok-cached');
    expect(fetchCalls).toHaveLength(0);
  });

  it('serialises concurrent callers into a single registration', async () => {
    const [a, b, c] = await Promise.all([
      ensureSessionToken(),
      ensureSessionToken(),
      ensureSessionToken(),
    ]);

    expect(a).toBe('tok-reg');
    expect(b).toBe('tok-reg');
    expect(c).toBe('tok-reg');
    expect(registerCalls('/api/auth/device/register')).toHaveLength(1);
  });

  it('refreshes with the stored device credential when no session is cached', async () => {
    mockStore.set('recordioai.device.id', 'dev-1');
    mockStore.set('recordioai.device.secret', 'secret-1');

    await expect(ensureSessionToken()).resolves.toBe('tok-refresh');
    expect(registerCalls('/api/auth/device/register')).toHaveLength(0);
    expect(registerCalls('/api/auth/device/token')).toHaveLength(1);
    expect(mockStore.get('recordioai.session.token')).toBe('tok-refresh');
  });

  it('re-registers a fresh identity when the stored credential is rejected', async () => {
    mockStore.set('recordioai.session.token', 'tok-stale');
    mockStore.set('recordioai.device.id', 'dev-old');
    mockStore.set('recordioai.device.secret', 'secret-old');

    tokenResponses.push(jsonResponse(401, { detail: 'Invalid device credential' }));
    registerResponses.push(defaultRegister());

    await expect(ensureSessionToken(true)).resolves.toBe('tok-reg');
    expect(registerCalls('/api/auth/device/token')).toHaveLength(1);
    expect(registerCalls('/api/auth/device/register')).toHaveLength(1);

    // The old identity was wiped and replaced with the newly minted one.
    expect(mockStore.get('recordioai.device.id')).not.toBe('dev-old');
    expect(mockStore.get('recordioai.device.secret')).not.toBe('secret-old');
    expect(mockStore.get('recordioai.session.token')).toBe('tok-reg');
  });

  it('surfaces a clear MobileAuthError when the service is unreachable', async () => {
    global.fetch = jest.fn(
      () => Promise.reject(new TypeError('Network request failed')) as Promise<Response>
    );

    await expect(ensureSessionToken()).rejects.toBeInstanceOf(MobileAuthError);
  });
});

describe('authedFetch', () => {
  it('attaches the bearer token from the cached session', async () => {
    mockStore.set('recordioai.session.token', 'tok-cached');
    mockStore.set('recordioai.device.id', 'dev-1');
    mockStore.set('recordioai.device.secret', 'secret-1');

    const response = await authedFetch('https://host/api/analyze', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(registerCalls('/api/analyze')).toHaveLength(1);
    const auth = registerCalls('/api/analyze')[0].headers;
    expect(auth.get('Authorization')).toBe('Bearer tok-cached');
  });

  it('refreshes once on 401 and retries with the fresh token', async () => {
    mockStore.set('recordioai.session.token', 'tok-expired');
    mockStore.set('recordioai.device.id', 'dev-1');
    mockStore.set('recordioai.device.secret', 'secret-1');

    tokenResponses.push(jsonResponse(200, { session_token: 'tok-fresh' }));

    const analyzeCalls = () => registerCalls('/api/analyze');
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        recordCall(input, init);
        const url = String(input);
        if (url.endsWith('/api/auth/device/token')) {
          return Promise.resolve(tokenResponses.shift() ?? defaultToken());
        }
        if (url.endsWith('/api/analyze') && analyzeCalls().length === 1) {
          // First attempt sees the expired token.
          return Promise.resolve(jsonResponse(401, { detail: 'Expired' }));
        }
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
    );

    const response = await authedFetch('https://host/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(analyzeCalls()).toHaveLength(2);
    expect(registerCalls('/api/auth/device/token')).toHaveLength(1);

    const firstHeaders = analyzeCalls()[0].headers;
    const retriedHeaders = analyzeCalls()[1].headers;
    expect(firstHeaders.get('Authorization')).toBe('Bearer tok-expired');
    expect(retriedHeaders.get('Authorization')).toBe('Bearer tok-fresh');
    expect(mockStore.get('recordioai.session.token')).toBe('tok-fresh');
  });

  it('returns the 401 when the refreshed session is also rejected', async () => {
    mockStore.set('recordioai.session.token', 'tok-expired');
    mockStore.set('recordioai.device.id', 'dev-1');
    mockStore.set('recordioai.device.secret', 'secret-1');

    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        recordCall(input, init);
        const url = String(input);
        if (url.endsWith('/api/auth/device/token')) {
          return Promise.resolve(jsonResponse(200, { session_token: 'tok-fresh' }));
        }
        return Promise.resolve(jsonResponse(401, { detail: 'Expired' }));
      }
    );

    const response = await authedFetch('https://host/api/analyze', {
      method: 'POST',
    });

    expect(response.status).toBe(401);
    expect(registerCalls('/api/analyze')).toHaveLength(2);
    expect(registerCalls('/api/auth/device/token')).toHaveLength(1);
  });
});
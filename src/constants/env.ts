import Constants from 'expo-constants';

/**
 * Backend API root.
 *
 * The FastAPI service mounts its router at `/api` (see `backend/server.py`,
 * `APIRouter(prefix="/api")`), so requests are issued as `<root>/api/transcribe`
 * and `<root>/api/analyze`. The previous `/v1` default never matched the
 * backend contract. Override the host (for example while a deployment is being
 * provisioned) with EXPO_PUBLIC_API_BASE_URL; a trailing slash is tolerated and
 * normalised away so callers can safely append `/transcribe`.
 */
const rawApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.recordioai.com';

export const API_BASE_URL = `${rawApiBaseUrl.replace(/\/+$/, '')}/api`;

// Public RevenueCat Test Store SDK key for the RecordioAIApp project. Configured
// via EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY where available, falling back to the
// Test Store key when no environment file is present (e.g. bare gradle builds).
export const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ||
  'test_IyTfDNFLsfmyGoszQxhqoIliFsV';

export const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

export const IS_DEV = ENVIRONMENT === 'development';

export const APP_CONFIG = {
  name: 'RecordioAI',
  // Read from app.json so the About screen can never drift from the shipped
  // build. Falls back to the last known release if the manifest is unavailable.
  version: (Constants.expoConfig?.version as string | undefined) ?? '1.1.2',
  bundleId: 'com.recordioai.app',
  supportEmail: 'support@recordioai.com',
  privacyUrl: 'https://recordioai.com/privacy',
  termsUrl: 'https://recordioai.com/terms',
} as const;
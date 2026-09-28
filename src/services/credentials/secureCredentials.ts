import * as SecureStore from 'expo-secure-store';

/**
 * Agent configuration can contain third-party credentials (provider API keys and
 * webhook signing secrets).
 *
 * The zustand store persists agents to AsyncStorage, which on Android is a plain
 * file in the app sandbox - readable by anything with device or adb access. So
 * sensitive values are split out of the persisted configuration and written to
 * the platform keystore (Android Keystore / iOS Keychain) via expo-secure-store
 * instead. Only non-sensitive metadata is ever written to AsyncStorage.
 */

const SENSITIVE_KEY_PATTERN =
  /(api[-_]?key|secret|token|password|passphrase|credential|private[-_]?key|signing)/i;

/** True when a configuration key holds a credential that must not be persisted in the clear. */
export function isSensitiveConfigKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export interface ConfigSplit<T> {
  /** Safe to persist to AsyncStorage and safe to show in the UI. */
  publicConfig: T;
  /** Credential values routed to the platform keystore. */
  secrets: Record<string, string>;
}

/** Splits a configuration object into persistable metadata and keystore-bound secrets. */
export function splitConfig<T extends Record<string, unknown>>(
  config: T
): ConfigSplit<Record<string, unknown>> {
  const publicConfig: Record<string, unknown> = {};
  const secrets: Record<string, string> = {};

  for (const [key, value] of Object.entries(config)) {
    if (isSensitiveConfigKey(key)) {
      if (typeof value === 'string' && value.trim() !== '') {
        secrets[key] = value;
      }
      // Record that a credential is set without storing it in the clear.
      publicConfig[key] = value ? '********' : '';
    } else {
      publicConfig[key] = value;
    }
  }

  return { publicConfig, secrets };
}

function storageKey(agentId: string): string {
  return `recordioai.agent.${agentId}.credentials`;
}

/** Persists an agent's credentials to the platform keystore. */
export async function saveAgentSecrets(
  agentId: string,
  secrets: Record<string, string>
): Promise<void> {
  const entries = Object.entries(secrets).filter(([, value]) => value && value.trim() !== '');
  if (entries.length === 0) {
    return;
  }
  await SecureStore.setItemAsync(
    storageKey(agentId),
    JSON.stringify(Object.fromEntries(entries)),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED }
  );
}

/** Reads an agent's credentials back out of the platform keystore. */
export async function loadAgentSecrets(
  agentId: string
): Promise<Record<string, string>> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(agentId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return {};
  }
}

/** Removes an agent's credentials from the platform keystore. */
export async function deleteAgentSecrets(agentId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storageKey(agentId));
  } catch {
    // Nothing stored for this agent.
  }
}

/**
 * Masks a credential for display: only the last four characters are shown, and
 * short values are hidden entirely.
 */
export function maskSecret(value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    return 'Not set';
  }
  if (value === '********') {
    return 'Set (secured)';
  }
  if (value.length <= 4) {
    return 'Set (secured)';
  }
  return `••••••••${value.slice(-4)}`;
}

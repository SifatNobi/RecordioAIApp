import { Alert, Linking } from 'react-native';

/**
 * Opens an external URL, surfacing a real failure to the user instead of
 * swallowing it. Several links in the app (privacy policy, terms, support email,
 * WhatsApp follow-ups) silently did nothing when the address was unreachable,
 * which made dead buttons look like working ones.
 *
 * Returns `true` when the URL was handed off to the OS.
 */
export async function openExternalUrl(url: string, label: string): Promise<boolean> {
  const trimmed = url.trim();

  if (!trimmed) {
    Alert.alert('Nothing to open', `${label} is not configured in this build yet.`);
    return false;
  }

  try {
    const supported = await Linking.canOpenURL(trimmed);
    if (!supported) {
      throw new Error('unsupported url');
    }
    await Linking.openURL(trimmed);
    return true;
  } catch {
    Alert.alert(
      `Could not open ${label}`,
      `The address could not be opened. It may not be reachable at the moment.\n\n${trimmed}`
    );
    return false;
  }
}

/** `mailto:` variant that always reports failure. */
export async function openEmail(
  address: string,
  subject?: string
): Promise<boolean> {
  const trimmed = address.trim();
  if (!trimmed) {
    Alert.alert('Nothing to open', 'No support address is configured in this build yet.');
    return false;
  }

  const url = subject
    ? `mailto:${trimmed}?subject=${encodeURIComponent(subject)}`
    : `mailto:${trimmed}`;

  return openExternalUrl(url, 'email');
}

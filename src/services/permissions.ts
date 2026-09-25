import { PermissionsAndroid, Platform } from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'never_ask_again';

export interface MicPermissionState {
  microphone: PermissionStatus;
  notifications: PermissionStatus;
  microphoneGranted: boolean;
  canAskAgain: boolean;
}

const isAndroid = Platform.OS === 'android';

const NOTIFICATIONS_PERMISSION =
  isAndroid && Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    : null;

const MIC_RATIONALE = {
  title: 'Microphone access required',
  message:
    'RecordioAI uses the device microphone to record conversations you start from this screen.',
  buttonPositive: 'Allow',
  buttonNegative: 'Not now',
};

const NOTIFICATION_RATIONALE = {
  title: 'Recording notifications',
  message:
    'Allow notifications so you can see and control the recording while it is in progress.',
  buttonPositive: 'Allow',
  buttonNegative: 'Not now',
};

const MIC_PERMISSION = isAndroid ? PermissionsAndroid.PERMISSIONS.RECORD_AUDIO : null;

export async function getMicStatus(): Promise<MicPermissionState> {
  if (!isAndroid || !MIC_PERMISSION) {
    return { microphone: 'granted', notifications: 'granted', microphoneGranted: true, canAskAgain: true };
  }

  const micGranted = await PermissionsAndroid.check(MIC_PERMISSION);

  let notifications: PermissionStatus = 'granted';
  if (NOTIFICATIONS_PERMISSION) {
    notifications = (await PermissionsAndroid.check(NOTIFICATIONS_PERMISSION))
      ? 'granted'
      : 'denied';
  }

  return {
    microphone: micGranted ? 'granted' : 'denied',
    notifications,
    microphoneGranted: micGranted,
    canAskAgain: true,
  };
}

export async function requestRecordingPermissions(): Promise<MicPermissionState> {
  if (!isAndroid || !MIC_PERMISSION) {
    return { microphone: 'granted', notifications: 'granted', microphoneGranted: true, canAskAgain: true };
  }

  let microphone: PermissionStatus = 'denied';
  try {
    microphone = (await PermissionsAndroid.request(MIC_PERMISSION, MIC_RATIONALE)) as PermissionStatus;
  } catch {
    microphone = 'denied';
  }

  let notifications: PermissionStatus = 'granted';
  if (NOTIFICATIONS_PERMISSION) {
    try {
      notifications = (await PermissionsAndroid.request(
        NOTIFICATIONS_PERMISSION,
        NOTIFICATION_RATIONALE
      )) as PermissionStatus;
    } catch {
      notifications = 'denied';
    }
  }

  return {
    microphone,
    notifications,
    microphoneGranted: microphone === 'granted',
    canAskAgain: microphone === 'granted' || microphone === 'denied',
  };
}
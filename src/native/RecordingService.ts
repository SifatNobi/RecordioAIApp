import { NativeModules, DeviceEventEmitter, Platform, EmitterSubscription } from 'react-native';
import { useEffect, useRef, useState, useCallback } from 'react';
import { requestRecordingPermissions } from '@/services/permissions';

const { RecordingServiceModule } = NativeModules;

interface RecordingState {
  state: 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'stopped' | 'error';
  duration: number;
  isPaused: boolean;
  recordingType: string;
  filePath?: string;
  error?: string;
}

interface RecordingServiceInterface {
  startRecording(outputPath?: string, recordingType?: string): Promise<{ success: boolean; filePath?: string; error?: string }>;
  stopRecording(): Promise<{ success: boolean; filePath?: string; duration?: number; error?: string }>;
  pauseRecording(): Promise<{ success: boolean; error?: string }>;
  resumeRecording(): Promise<{ success: boolean; error?: string }>;
  getRecordingState(): Promise<RecordingState>;
  requestPermissions(): Promise<{ granted: boolean; error?: string }>;
}

const isAndroid = Platform.OS === 'android';

export const RecordingService: RecordingServiceInterface = {
  async startRecording(outputPath?: string, recordingType = 'conversation') {
    if (!isAndroid || !RecordingServiceModule) {
      return { success: false, error: 'Recording service not available on this platform' };
    }
    try {
      const result = await RecordingServiceModule.startRecording(outputPath, recordingType);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async stopRecording() {
    if (!isAndroid || !RecordingServiceModule) {
      return { success: false, error: 'Recording service not available on this platform' };
    }
    try {
      const result = await RecordingServiceModule.stopRecording();
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async pauseRecording() {
    if (!isAndroid || !RecordingServiceModule) {
      return { success: false, error: 'Recording service not available on this platform' };
    }
    try {
      const result = await RecordingServiceModule.pauseRecording();
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async resumeRecording() {
    if (!isAndroid || !RecordingServiceModule) {
      return { success: false, error: 'Recording service not available on this platform' };
    }
    try {
      const result = await RecordingServiceModule.resumeRecording();
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getRecordingState() {
    if (!isAndroid || !RecordingServiceModule) {
      return { state: 'idle', duration: 0, isPaused: false, recordingType: 'conversation' };
    }
    try {
      return await RecordingServiceModule.getRecordingState();
    } catch (error) {
      return { state: 'error', duration: 0, isPaused: false, recordingType: 'conversation', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async requestPermissions() {
    if (!isAndroid) {
      return { granted: true };
    }
    try {
      const state = await requestRecordingPermissions();
      return {
        granted: state.microphoneGranted,
        error: state.microphoneGranted
          ? undefined
          : state.microphone === 'never_ask_again'
            ? 'Microphone permission is permanently blocked'
            : 'Microphone permission is required to record conversations',
      };
    } catch (error) {
      return { granted: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

const eventEmitter = isAndroid && RecordingServiceModule ? DeviceEventEmitter : null;

export function useRecordingService() {
  const [state, setState] = useState<RecordingState>({
    state: 'idle',
    duration: 0,
    isPaused: false,
    recordingType: 'conversation',
  });
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const listenersRef = useRef<EmitterSubscription[]>([]);

  const updateState = useCallback((newState: Partial<RecordingState>) => {
    setState(prev => ({ ...prev, ...newState }));
  }, []);

  useEffect(() => {
    if (!isAndroid || !eventEmitter) return;

    const stateListener = eventEmitter.addListener('RecordingState', (data: any) => {
      updateState({ state: data.state, recordingType: data.recordingType });
    });
    const progressListener = eventEmitter.addListener('RecordingProgress', (data: any) => {
      updateState({ duration: data.duration, isPaused: data.isPaused, recordingType: data.recordingType });
    });
    const completeListener = eventEmitter.addListener('RecordingComplete', (data: any) => {
      updateState({ state: 'stopped', filePath: data.filePath, duration: data.duration, recordingType: data.recordingType });
    });
    const errorListener = eventEmitter.addListener('RecordingError', (data: any) => {
      updateState({ state: 'error', error: data.error, recordingType: data.recordingType });
    });

    listenersRef.current = [
      stateListener,
      progressListener,
      completeListener,
      errorListener,
    ];

    RecordingService.getRecordingState().then(initialState => {
      updateState(initialState);
    });

    return () => {
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = [];
    };
  }, [updateState]);

  const checkPermissions = useCallback(async () => {
    const result = await RecordingService.requestPermissions();
    setPermissionGranted(result.granted);
    return result;
  }, []);

  const startRecording = useCallback(async (outputPath?: string, recordingType = 'conversation') => {
    if (permissionGranted === null) {
      const permResult = await checkPermissions();
      if (!permResult.granted) {
        return { success: false, error: permResult.error || 'Permission denied' };
      }
    }
    updateState({ state: 'starting', recordingType });
    return await RecordingService.startRecording(outputPath, recordingType);
  }, [permissionGranted, checkPermissions, updateState]);

  const stopRecording = useCallback(async () => {
    updateState({ state: 'stopping' });
    return await RecordingService.stopRecording();
  }, [updateState]);

  const pauseRecording = useCallback(async () => {
    updateState({ state: 'paused' });
    return await RecordingService.pauseRecording();
  }, [updateState]);

  const resumeRecording = useCallback(async () => {
    updateState({ state: 'recording' });
    return await RecordingService.resumeRecording();
  }, [updateState]);

  const reset = useCallback(() => {
    setState({
      state: 'idle',
      duration: 0,
      isPaused: false,
      recordingType: 'conversation',
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isAndroid || !RecordingServiceModule) return;
    try {
      const nativeState = await RecordingService.getRecordingState();
      if (nativeState && nativeState.state) {
        updateState(nativeState);
      }
    } catch {
      // Ignore transient refresh failures; events keep state fresh.
    }
  }, [updateState]);

  return {
    state,
    permissionGranted,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    checkPermissions,
    reset,
    refresh,
  };
}

export type { RecordingState };
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Transcript } from '@/types';

export interface SavedRecording {
  id: string;
  filePath: string;
  fileName: string;
  duration: number;
  recordingType: 'conversation' | 'phone_call';
  createdAt: string;
  status: 'recorded' | 'transcribing' | 'transcription_failed' | 'transcribed' | 'analyzing' | 'analysis_failed' | 'completed';
  transcript?: string;
  transcriptId?: string;
  analysisId?: string;
  error?: string;
  retryCount: number;
  _transcript?: Transcript;
}

interface RecordingStoreState {
  recordings: SavedRecording[];
  currentRecordingId: string | null;
  isProcessing: boolean;
  error: string | null;
}

interface RecordingStoreActions {
  addRecording: (recording: Omit<SavedRecording, 'id' | 'createdAt' | 'retryCount'>) => string;
  updateRecording: (id: string, updates: Partial<SavedRecording>) => void;
  removeRecording: (id: string) => void;
  getRecording: (id: string) => SavedRecording | undefined;
  getPendingRecordings: () => SavedRecording[];
  setCurrentRecording: (id: string | null) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  incrementRetryCount: (id: string) => void;
  clearCompletedRecordings: () => void;
}

const defaultState: RecordingStoreState = {
  recordings: [],
  currentRecordingId: null,
  isProcessing: false,
  error: null,
};

export const useRecordingStore = create<RecordingStoreState & RecordingStoreActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      addRecording: (recording) => {
        const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newRecording: SavedRecording = {
          ...recording,
          id,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };
        set((state) => ({
          recordings: [newRecording, ...state.recordings],
          currentRecordingId: id,
        }));
        return id;
      },

      updateRecording: (id, updates) =>
        set((state) => ({
          recordings: state.recordings.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      removeRecording: (id) =>
        set((state) => ({
          recordings: state.recordings.filter((r) => r.id !== id),
          currentRecordingId: state.currentRecordingId === id ? null : state.currentRecordingId,
        })),

      getRecording: (id) => get().recordings.find((r) => r.id === id),

      getPendingRecordings: () =>
        get().recordings.filter(
          (r) =>
            r.status === 'transcription_failed' ||
            r.status === 'analysis_failed' ||
            r.status === 'recorded'
        ),

      setCurrentRecording: (id) => set({ currentRecordingId: id }),

      setProcessing: (processing) => set({ isProcessing: processing }),

      setError: (error) => set({ error }),

      incrementRetryCount: (id) =>
        set((state) => ({
          recordings: state.recordings.map((r) =>
            r.id === id ? { ...r, retryCount: r.retryCount + 1 } : r
          ),
        })),

      clearCompletedRecordings: () =>
        set((state) => ({
          recordings: state.recordings.filter(
            (r) => r.status !== 'completed'
          ),
        })),
    }),
    {
      name: 'recordioai-recordings-storage',
      storage: createJSONStorage(() =>
        Platform.OS === 'web' ? localStorage : AsyncStorage
      ),
      partialize: (state) => ({
        recordings: state.recordings.map(({ _transcript, ...recording }) => recording),
      }),
    }
  )
);
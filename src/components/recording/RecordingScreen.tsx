import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { H1, H3, Body, Caption, Overline } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingState } from '@/components/LoadingState';
import { useRecordingService } from '@/native/RecordingService';
import { useRecordingStore } from '@/store/recordingStore';
import { runRecordPipeline, retryRecordPipeline, userMessageForError } from '@/services/recording/pipeline';
import { getMicStatus } from '@/services/permissions';

interface RecordingScreenProps {
  title: string;
  tagline: string;
  recordingType: 'conversation' | 'phone_call';
  banner?: React.ReactNode;
}

type ScreenPhase = 'idle' | 'recording' | 'processing' | 'error';

interface PermissionIssue {
  message: string;
  canAskAgain: boolean;
}

export function RecordingScreen({
  title,
  tagline,
  recordingType,
  banner,
}: RecordingScreenProps) {
  const router = useRouter();
  const {
    state,
    permissionGranted,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    checkPermissions,
    reset,
  } = useRecordingService();

  const [phase, setPhase] = useState<ScreenPhase>('idle');
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionIssue, setPermissionIssue] = useState<PermissionIssue | null>(null);
  const processingRef = useRef(false);

  const activeRecording = useRecordingStore((s) =>
    s.recordings.find((r) => r.id === activeRecordingId)
  );

  const processStep =
    activeRecording?.status === 'analyzing' || activeRecording?.status === 'analysis_failed'
      ? 'Analyzing transcript...'
      : 'Transcribing audio...';

  const stopPipelineRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (processingRef.current) return;
    if (state.state !== 'stopped' || !state.filePath) return;

    processingRef.current = true;

    let cancelled = false;
    stopPipelineRef.current = () => {
      cancelled = true;
    };

    const recordingId = useRecordingStore
      .getState()
      .addRecording({
        filePath: state.filePath,
        fileName: state.filePath.split('/').pop() || `recording_${Date.now()}.m4a`,
        duration: state.duration,
        recordingType,
        status: 'recorded',
      });

    (async () => {
      if (cancelled) return;
      setActiveRecordingId(recordingId);
      setPhase('processing');
      setErrorMessage(null);

      try {
        const conversationId = await runRecordPipeline(recordingId);
        if (cancelled) return;
        setPhase('idle');
        processingRef.current = false;
        reset();
        router.replace(`/conversations/${conversationId}`);
      } catch (error) {
        if (cancelled) return;
        setPhase('error');
        setErrorMessage(userMessageForError(error));
        processingRef.current = false;
      }
    })();
  }, [state, recordingType, router, reset]);

  useEffect(() => () => {
    processingRef.current = false;
    stopPipelineRef.current?.();
  }, []);

  const handleStart = useCallback(async () => {
    setErrorMessage(null);
    setPermissionIssue(null);
    if (permissionGranted === null || !permissionGranted) {
      const perm = await checkPermissions();
      if (!perm.granted) {
        const status = await getMicStatus();
        setPermissionIssue({
          message:
            status.microphone === 'never_ask_again'
              ? 'Microphone access is blocked for RecordioAI. Enable it in system Settings to record conversations.'
              : 'Microphone permission is required to record. Allow access when prompted.',
          canAskAgain: status.canAskAgain,
        });
        return;
      }
    }
    const result = await startRecording(undefined, recordingType);
    if (!result.success) {
      setPhase('error');
      setErrorMessage(
        result.error || 'Unable to start recording. Please try again.'
      );
      return;
    }
    setPhase('recording');
  }, [permissionGranted, checkPermissions, startRecording, recordingType]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const handleTryAgainPermission = useCallback(() => {
    setPermissionIssue(null);
    setPhase('idle');
  }, []);

  const handleStop = useCallback(async () => {
    stopPipelineRef.current?.();
    await stopRecording();
  }, [stopRecording]);

  const handleRetry = useCallback(async () => {
    if (!activeRecordingId) return;
    setPhase('processing');
    setErrorMessage(null);
    processingRef.current = true;
    try {
      const conversationId = await retryRecordPipeline(activeRecordingId);
      setPhase('idle');
      processingRef.current = false;
      reset();
      router.replace(`/conversations/${conversationId}`);
    } catch (error) {
      setPhase('error');
      setErrorMessage(userMessageForError(error));
      processingRef.current = false;
    }
  }, [activeRecordingId, reset, router]);

  const handleStartOver = useCallback(() => {
    processingRef.current = false;
    stopPipelineRef.current?.();
    setPhase('idle');
    setErrorMessage(null);
    setPermissionIssue(null);
    setActiveRecordingId(null);
    reset();
  }, [reset]);

  const isRecording = phase === 'recording' || state.state === 'recording' || state.state === 'paused';
  const isPaused = state.state === 'paused';
  const showControl = phase === 'idle' || phase === 'recording';

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">{title}</H1>
        <Body color="textSecondary" style={styles.tagline}>{tagline}</Body>
      </View>

      {banner}

      {phase === 'processing' ? (
        <Card variant="outlined" padding="lg" style={styles.processingCard}>
          <LoadingState size="md" label={processStep} />
          <Body color="textSecondary" style={styles.processingNote}>
            Keep the app open while your recording is processed.
          </Body>
        </Card>
      ) : phase === 'error' ? (
        <Card variant="outlined" padding="lg" style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={28} color={Theme.colors.error} />
          </View>
          <H3 weight="semiBold" color="textPrimary" style={styles.errorTitle}>
            Processing Failed
          </H3>
          <Body color="textSecondary" style={styles.errorMessage}>
            {errorMessage}
          </Body>
          {activeRecordingId && (
            <Button variant="primary" fullWidth onPress={handleRetry}>
              <Ionicons name="refresh" size={18} style={{ marginRight: 8 }} />
              Retry
            </Button>
          )}
          <Button variant="ghost" fullWidth onPress={handleStartOver} style={styles.startOverButton}>
            Start Over
          </Button>
        </Card>
      ) : permissionIssue ? (
        <Card variant="outlined" padding="lg" style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="mic-off" size={28} color={Theme.colors.warning} />
          </View>
          <H3 weight="semiBold" color="textPrimary" style={styles.permissionTitle}>
            Microphone permission required
          </H3>
          <Body color="textSecondary" style={styles.permissionMessage}>
            {permissionIssue.message}
          </Body>
          <Button
            variant="primary"
            fullWidth
            onPress={handleOpenSettings}
            leftIcon={
              <Ionicons name="settings" size={18} color={Theme.colors.textOnPrimary} />
            }
          >
            Open System Settings
          </Button>
          {permissionIssue.canAskAgain && (
            <Button
              variant="ghost"
              fullWidth
              onPress={handleTryAgainPermission}
              style={styles.startOverButton}
            >
              Try Again
            </Button>
          )}
          <Caption color="textMuted" style={styles.permissionNote}>
            Recording captures only what this device&apos;s microphone hears. Make
            sure everyone consenting is aware the conversation is being recorded.
          </Caption>
        </Card>
      ) : showControl ? (
        <Card variant="outlined" padding="lg" style={styles.controlCard}>
          <View style={styles.timerRow}>
            <Overline color={isRecording ? 'primaryBlue' : 'textMuted'}>
              {isRecording ? 'RECORDING' : 'READY'}
            </Overline>
            <H1 weight="bold" color="textPrimary" style={styles.timer}>
              {formatDuration(state.duration)}
            </H1>
            {isPaused && (
              <Badge variant="warning">Paused</Badge>
            )}
          </View>

          <View style={styles.controls}>
            {!isRecording ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleStart}
                leftIcon={<Ionicons name="mic" size={20} color={Theme.colors.textOnPrimary} />}
              >
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  fullWidth
                  onPress={isPaused ? resumeRecording : pauseRecording}
                  leftIcon={
                    <Ionicons
                      name={isPaused ? 'play' : 'pause'}
                      size={18}
                      color={Theme.colors.primaryBlue}
                    />
                  }
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  onPress={handleStop}
                  style={styles.stopButton}
                  leftIcon={
                    <Ionicons name="stop" size={18} color={Theme.colors.textOnPrimary} />
                  }
                >
                  Stop & Process
                </Button>
              </>
            )}
          </View>

          {state.state === 'error' && (
            <Caption color="error" style={styles.inlineError}>
              {state.error}
            </Caption>
          )}
        </Card>
      ) : null}

      <View style={styles.footnoteCard}>
        <Body color="textMuted" style={styles.footnote}>
          Recording continues in the background with a notification while this screen is not visible.
        </Body>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function Badge({ variant, children }: { variant: 'warning'; children: React.ReactNode }) {
  return (
    <View style={[styles.badge, { backgroundColor: Theme.colors.warning }]}>
      <Caption color="textOnPrimary" weight="semiBold">{children}</Caption>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing[5],
    paddingTop: Theme.spacing[4],
    paddingBottom: Theme.spacing[10],
  },
  header: {
    marginBottom: Theme.spacing[6],
  },
  tagline: {
    marginTop: Theme.spacing[1],
  },
  controlCard: {
    alignItems: 'center',
    gap: Theme.spacing[5],
    marginBottom: Theme.spacing[4],
  },
  timerRow: {
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  timer: {
    fontSize: 56,
    lineHeight: 64,
  },
  controls: {
    width: '100%',
    gap: Theme.spacing[3],
  },
  stopButton: {},
  inlineError: {
    textAlign: 'center',
  },
  processingCard: {
    alignItems: 'center',
    gap: Theme.spacing[4],
    marginBottom: Theme.spacing[4],
  },
  processingNote: {
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[4],
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 77, 90, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {},
  errorMessage: {
    textAlign: 'center',
  },
  startOverButton: {
    marginTop: Theme.spacing[1],
  },
  permissionCard: {
    alignItems: 'center',
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[4],
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 190, 92, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionTitle: {},
  permissionMessage: {
    textAlign: 'center',
  },
  permissionNote: {
    textAlign: 'center',
    marginTop: Theme.spacing[1],
  },
  footnoteCard: {
    marginTop: Theme.spacing[2],
  },
  footnote: {
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: Theme.spacing[2],
    paddingVertical: Theme.spacing[0.5],
    borderRadius: Theme.borderRadius.full,
  },
  bottomSpacer: {
    height: 40,
  },
});
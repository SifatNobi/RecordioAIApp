import React, { useCallback, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { H1, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingState } from '@/components/LoadingState';
import { useRecordingStore } from '@/store/recordingStore';
import {
  createPastedTranscriptRecord,
  retryRecordPipeline,
  userMessageForError,
} from '@/services/recording/pipeline';

const MAX_TRANSCRIPT_CHARS = 500000;

export default function PasteTranscriptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'error'>('idle');
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processingRef = useRef(false);

  const activeRecording = useRecordingStore((s) =>
    s.recordings.find((r) => r.id === activeRecordingId)
  );

  const processStep =
    activeRecording?.status === 'analyzing' || activeRecording?.status === 'analysis_failed'
      ? 'Analyzing transcript...'
      : 'Starting analysis...';

  const handleAnalyze = useCallback(async () => {
    if (processingRef.current) return;
    if (!text.trim()) {
      setPhase('error');
      setErrorMessage('Transcript is empty. Paste the conversation text to analyze it.');
      return;
    }

    processingRef.current = true;
    setPhase('processing');
    setErrorMessage(null);

    const { recordingId, conversationId, error } = await createPastedTranscriptRecord({
      transcript: text,
    });

    setActiveRecordingId(recordingId);

    if (error) {
      setPhase('error');
      setErrorMessage(error);
      processingRef.current = false;
      return;
    }

    processingRef.current = false;
    router.replace(`/conversations/${conversationId}`);
  }, [text, router]);

  const handleRetry = useCallback(async () => {
    if (!activeRecordingId || processingRef.current) return;
    processingRef.current = true;
    setPhase('processing');
    setErrorMessage(null);
    try {
      const conversationId = await retryRecordPipeline(activeRecordingId);
      processingRef.current = false;
      router.replace(`/conversations/${conversationId}`);
    } catch (error) {
      setPhase('error');
      setErrorMessage(userMessageForError(error));
      processingRef.current = false;
    }
  }, [activeRecordingId, router]);

  const remaining = Math.max(0, MAX_TRANSCRIPT_CHARS - text.length);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">Paste Transcript</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Paste an existing conversation transcript to analyze it with AI. Your pasted text is kept if analysis fails.
        </Body>
      </View>

      <Card variant="outlined" padding="md" style={styles.inputCard}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste the conversation transcript here..."
          placeholderTextColor={Theme.colors.textMuted}
          multiline
          editable={phase !== 'processing'}
          style={styles.textArea}
          textAlignVertical="top"
        />
        <View style={styles.inputFooter}>
          <Caption color={remaining < 1000 ? 'warning' : 'textMuted'}>
            {remaining.toLocaleString()} characters remaining
          </Caption>
        </View>
      </Card>

      {phase === 'processing' ? (
        <Card variant="outlined" padding="lg" style={styles.processingCard}>
          <LoadingState size="md" label={processStep} />
        </Card>
      ) : phase === 'error' ? (
        <Card variant="outlined" padding="lg" style={styles.errorCard}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={28} color={Theme.colors.error} />
          </View>
          <H3 weight="semiBold" color="textPrimary">
            Analysis Failed
          </H3>
          <Body color="textSecondary" style={styles.errorMessage}>
            {errorMessage}
          </Body>
          {activeRecordingId && (
            <Button variant="primary" fullWidth onPress={handleRetry}>
              <Ionicons name="refresh" size={18} style={{ marginRight: 8 }} />
              Retry Analysis
            </Button>
          )}
        </Card>
      ) : (
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onPress={handleAnalyze}
          disabled={!text.trim()}
          leftIcon={<Ionicons name="sparkles" size={20} color={Theme.colors.textOnPrimary} />}
        >
          Analyze Transcript
        </Button>
      )}

      <View style={[styles.bottomSpacer, { height: 40 + insets.bottom }]} />
    </ScrollView>
  );
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
    marginBottom: Theme.spacing[5],
  },
  tagline: {
    marginTop: Theme.spacing[1],
    lineHeight: 22,
  },
  inputCard: {
    marginBottom: Theme.spacing[4],
  },
  textArea: {
    minHeight: 220,
    color: Theme.colors.textPrimary,
    fontSize: Theme.typography.fontSize.base,
    lineHeight: Theme.typography.fontSize.base * Theme.typography.lineHeight.normal,
    fontFamily: Theme.typography.fontFamily.regular,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Theme.spacing[2],
  },
  processingCard: {
    alignItems: 'center',
  },
  errorCard: {
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 77, 90, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: Theme.spacing[1],
  },
  bottomSpacer: {
    height: 40,
  },
});
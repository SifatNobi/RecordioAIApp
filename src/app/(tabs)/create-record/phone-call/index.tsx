import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Directory, Paths } from 'expo-file-system';
import { Theme } from '@/constants/theme';
import { H1, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { RecordingScreen } from '@/components/recording/RecordingScreen';
import { useRecordingStore } from '@/store/recordingStore';
import { runRecordPipeline } from '@/services/recording/pipeline';

type CallMode = 'dial' | 'record_only' | null;

export default function PhoneCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [numberInput, setNumberInput] = useState('');
  const [mode, setMode] = useState<CallMode>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleStartCallAndRecord = () => setMode('dial');
  const handleRecordOnly = () => setMode('record_only');
  const handleBack = () => {
    setMode(null);
    setImportError(null);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['audio/*'] });
      if (!picked) {
        setImporting(false);
        return;
      }
      const source = picked instanceof Array ? picked[0] : picked;
      const fileName = source.name || `import_${Date.now()}.m4a`;

      const dir = new Directory(Paths.document, 'recordings');
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }
      const target = new File(dir, fileName);
      if (target.exists) {
        target.delete();
      }
      const copied = await source.copy(target);

      const recordingId = useRecordingStore
        .getState()
        .addRecording({
          filePath: copied.uri,
          fileName,
          duration: 0,
          recordingType: 'phone_call',
          status: 'recorded',
        });

      const conversationId = await runRecordPipeline(recordingId);
      setImporting(false);
      router.replace(`/conversations/${conversationId}`);
    } catch (error) {
      setImporting(false);
      const message = error instanceof Error ? error.message : '';
      if (/cancel/i.test(message)) {
        return;
      }
      setImportError(
        error instanceof Error ? error.message : 'Unable to import the audio file.'
      );
    }
  };

  if (mode) {
    return (
      <RecordingScreen
        title="Phone Call"
        tagline="Capture a call through the device microphone. Conversations are transcribed and analyzed by AI."
        recordingType="phone_call"
        autoStart
        autoDialOnStart={mode === 'dial'}
        dialNumber={mode === 'dial' ? numberInput : undefined}
        banner={
          <View style={styles.bannerGroup}>
            {mode === 'dial' && numberInput.trim() ? (
              <View style={styles.callPlacedCard}>
                <View style={styles.capabilityRow}>
                  <Ionicons name="call" size={20} color={Theme.colors.textOnPrimary} />
                  <Body color="textOnPrimary" style={styles.capabilityText}>
                    Calling {numberInput.trim()} — recording starts automatically and continues
                    in the background while the dialer is open.
                  </Body>
                </View>
              </View>
            ) : null}
            <Card variant="outlined" padding="md" style={styles.capabilityCard}>
              <View style={styles.capabilityRow}>
                <Ionicons name="warning" size={20} color={Theme.colors.warning} />
                <Body color="textSecondary" style={styles.capabilityText}>
                  Android apps cannot capture both sides of a call directly. RecordioAI
                  records through the device microphone, so the other party&apos;s audio may
                  be quiet depending on speaker mode.
                </Body>
              </View>
            </Card>
            <Card variant="outlined" padding="md" style={styles.capabilityCard}>
              <View style={styles.capabilityRow}>
                <Ionicons name="shield-checkmark" size={20} color={Theme.colors.cyanAccent} />
                <Caption color="textMuted" style={styles.capabilityText}>
                  Make sure all parties consent to being recorded before you start. Check
                  your local laws about call recording consent.
                </Caption>
              </View>
            </Card>
          </View>
        }
      />
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">Phone Call</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Place a call and capture it, or import an existing call recording. The audio is
          transcribed and analyzed automatically.
        </Body>
      </View>

      <Card variant="outlined" padding="lg" style={styles.inputCard}>
        <Caption color="textMuted" weight="semiBold" style={styles.inputLabel}>
          PHONE NUMBER (OPTIONAL)
        </Caption>
        <View style={styles.inputRow}>
          <Ionicons name="call-outline" size={22} color={Theme.colors.textMuted} />
          <TextInput
            value={numberInput}
            onChangeText={setNumberInput}
            placeholder="e.g. +1 555 123 4567"
            placeholderTextColor={Theme.colors.textMuted}
            style={styles.input}
            keyboardType="phone-pad"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <Caption color="textMuted" style={styles.inputHint}>
          Optional. When provided, the call is placed through the Android dialer and
          RecordingioAI starts capturing via the microphone at the same time.
        </Caption>
      </Card>

      <View style={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleStartCallAndRecord}
          leftIcon={
            <Ionicons name="call" size={20} color={Theme.colors.textOnPrimary} />
          }
          style={styles.actionButton}
        >
          Place Call & Record
        </Button>

        <Button
          variant="outline"
          size="lg"
          fullWidth
          onPress={handleRecordOnly}
          leftIcon={
            <Ionicons name="mic-outline" size={20} color={Theme.colors.primaryBlue} />
          }
          style={styles.actionButton}
        >
          Record Only (No Dial)
        </Button>

        <Button
          variant="ghost"
          size="lg"
          fullWidth
          onPress={handleImport}
          disabled={importing}
          leftIcon={
            importing ? (
              <ActivityIndicator size="small" color={Theme.colors.primaryBlue} />
            ) : (
              <Ionicons name="folder-open-outline" size={20} color={Theme.colors.primaryBlue} />
            )
          }
          style={styles.actionButton}
        >
          {importing ? 'Importing…' : 'Import Call Recording'}
        </Button>
      </View>

      {importError ? (
        <Card variant="outlined" padding="md" style={styles.errorCard}>
          <View style={styles.capabilityRow}>
            <Ionicons name="alert-circle" size={20} color={Theme.colors.error} />
            <Body color="textSecondary" style={styles.capabilityText}>{importError}</Body>
          </View>
        </Card>
      ) : null}

      <View style={styles.disclosureGroup}>
        <Card variant="outlined" padding="md" style={styles.capabilityCard}>
          <View style={styles.capabilityRow}>
            <Ionicons name="information-circle-outline" size={20} color={Theme.colors.primaryBlue} />
            <Body color="textSecondary" style={styles.capabilityText}>
              Android does not let regular apps record the in-call audio of both parties.
              Importing a recording, or recording the microphone while a call is on
              speaker, are the supported ways to capture a call with RecordioAI.
            </Body>
          </View>
        </Card>
        <Card variant="outlined" padding="md" style={styles.capabilityCard}>
          <View style={styles.capabilityRow}>
            <Ionicons name="shield-checkmark" size={20} color={Theme.colors.success} />
            <Caption color="textMuted" style={styles.capabilityText}>
              Only record calls you have permission to record. Notify all participants
              that the conversation is being captured.
            </Caption>
          </View>
        </Card>
      </View>

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
  },
  inputCard: {
    marginBottom: Theme.spacing[4],
    gap: Theme.spacing[2],
  },
  inputLabel: {
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing[3],
    height: 52,
    backgroundColor: Theme.colors.backgroundSecondary,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: Theme.colors.textPrimary,
    paddingVertical: 0,
  },
  inputHint: {
    lineHeight: 18,
  },
  actions: {
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[4],
  },
  actionButton: {},
  errorCard: {
    marginBottom: Theme.spacing[4],
  },
  disclosureGroup: {
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[4],
  },
  bannerGroup: {
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[4],
  },
  callPlacedCard: {
    backgroundColor: Theme.colors.primaryBlue,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing[4],
  },
  capabilityCard: {},
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing[2],
  },
  capabilityText: {
    flex: 1,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
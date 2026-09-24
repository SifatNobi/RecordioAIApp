import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Microphone, Pause, Play, Stop, Trash, ArrowRight, Gear, WarningCircle, ArrowsClockwise } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Button, Card } from "@/src/components/ui";
import { useDraft } from "@/src/draft";
import { useToast } from "@/src/toast";
import { api } from "@/src/api";
import { CAPTURE_METHODS } from "@/src/constants";

type Phase = "idle" | "recording" | "paused" | "stopped" | "transcribing";
type PermState = "unknown" | "granted" | "denied" | "blocked";

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RecordScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { setDraft } = useDraft();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [phase, setPhase] = useState<Phase>("idle");
  const [perm, setPerm] = useState<PermState>("unknown");
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await AudioModule.getRecordingPermissionsAsync();
      setPerm(p.granted ? "granted" : p.canAskAgain ? "unknown" : "blocked");
    })();
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) {
      setPerm("granted");
      return true;
    }
    if (!current.canAskAgain) {
      setPerm("blocked");
      return false;
    }
    const req = await AudioModule.requestRecordingPermissionsAsync();
    if (req.granted) {
      setPerm("granted");
      return true;
    }
    setPerm(req.canAskAgain ? "denied" : "blocked");
    return false;
  }, []);

  const start = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPhase("recording");
    } catch {
      toast.show("Could not start recording on this device.", "error");
    }
  };

  const pause = () => {
    recorder.pause();
    setPhase("paused");
  };
  const resume = () => {
    recorder.record();
    setPhase("recording");
  };
  const stop = async () => {
    try {
      await recorder.stop();
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPhase("stopped");
    } catch {
      toast.show("Failed to stop recording.", "error");
    }
  };
  const reset = () => {
    setTranscribeError(null);
    setPhase("idle");
  };

  const useRecording = async () => {
    const uri = recorder.uri;
    if (!uri) {
      toast.show("No recording found. Please record again.", "error");
      return;
    }
    setTranscribeError(null);
    setPhase("transcribing");
    try {
      const name = Platform.OS === "web" ? "recording.webm" : "recording.m4a";
      const type = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
      const res = await api.transcribe(uri, name, type);
      setDraft({
        transcript: res.transcript,
        capture_method: CAPTURE_METHODS.voice,
        audio_sha256: res.audio_sha256,
      });
      router.push("/create/finalize");
    } catch (e: any) {
      setPhase("stopped");
      setTranscribeError(e?.message || "Transcription failed. Your recording was kept — tap retry.");
    }
  };

  const blocked = perm === "blocked";

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader title="Record Conversation" subtitle="Microphone capture" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.recCard}>
          <View style={[styles.pulse, (phase === "recording") && styles.pulseActive]}>
            <Microphone
              color={phase === "recording" ? colors.onBrandPrimary : colors.brand}
              size={40}
              weight="fill"
            />
          </View>
          <Text testID="record-timer" style={styles.timer}>
            {fmt(state.durationMillis || 0)}
          </Text>
          <Text style={styles.phaseText}>
            {phase === "recording"
              ? "Recording…"
              : phase === "paused"
                ? "Paused"
                : phase === "stopped"
                  ? "Recording ready"
                  : phase === "transcribing"
                    ? "Transcribing…"
                    : "Ready to record"}
          </Text>
        </Card>

        {blocked && (
          <Card style={styles.warn} testID="record-permission-blocked">
            <Text style={styles.warnText}>
              Microphone access is turned off. Enable it in Settings to record, or paste a transcript instead.
            </Text>
            <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
              <Gear color={colors.brand} size={16} weight="bold" />
              <Text style={styles.settingsText}>Open Settings</Text>
            </Pressable>
          </Card>
        )}
        {perm === "denied" && !blocked && (
          <Text style={styles.deniedNote}>
            Microphone permission is needed to record. Tap Start Recording to allow it.
          </Text>
        )}

        {/* Controls */}
        {phase === "idle" && (
          <Button
            label="Start Recording"
            testID="record-start"
            icon={<Microphone color={colors.onBrandPrimary} size={20} weight="fill" />}
            onPress={start}
          />
        )}

        {(phase === "recording" || phase === "paused") && (
          <View style={{ gap: spacing.md }}>
            <View style={styles.controlRow}>
              {phase === "recording" ? (
                <Pressable testID="record-pause" style={styles.ctrl} onPress={pause}>
                  <Pause color={colors.onSurface} size={22} weight="fill" />
                  <Text style={styles.ctrlText}>Pause</Text>
                </Pressable>
              ) : (
                <Pressable testID="record-resume" style={styles.ctrl} onPress={resume}>
                  <Play color={colors.onSurface} size={22} weight="fill" />
                  <Text style={styles.ctrlText}>Resume</Text>
                </Pressable>
              )}
              <Pressable testID="record-stop" style={[styles.ctrl, styles.ctrlStop]} onPress={stop}>
                <Stop color={colors.onError} size={22} weight="fill" />
                <Text style={[styles.ctrlText, { color: colors.onError }]}>Stop</Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase === "stopped" && (
          <View style={{ gap: spacing.md }}>
            {transcribeError && (
              <Card style={styles.errCard} testID="record-transcribe-error">
                <View style={styles.errHead}>
                  <WarningCircle color={colors.error} size={18} weight="fill" />
                  <Text style={styles.errTitle}>Transcription failed</Text>
                </View>
                <Text style={styles.errText}>{transcribeError}</Text>
                <Text style={styles.errNote}>Your recording was kept. You can retry without recording again.</Text>
              </Card>
            )}
            <Button
              label={transcribeError ? "Retry Transcription" : "Use Recording"}
              testID="record-use"
              icon={
                transcribeError ? (
                  <ArrowsClockwise color={colors.onBrandPrimary} size={18} weight="bold" />
                ) : (
                  <ArrowRight color={colors.onBrandPrimary} size={18} weight="bold" />
                )
              }
              onPress={useRecording}
            />
            <Button
              label="Delete & Re-record"
              variant="danger"
              testID="record-rerecord"
              icon={<Trash color={colors.error} size={18} weight="bold" />}
              onPress={reset}
            />
          </View>
        )}

        {phase === "transcribing" && (
          <View style={styles.transcribing}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.transcribingText}>Converting audio to text…</Text>
          </View>
        )}

        <Text style={styles.note}>
          Audio is sent securely for transcription and is not stored on our servers. A SHA-256 fingerprint of
          the audio is recorded with your evidence.
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  recCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  pulse: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseActive: { backgroundColor: colors.brandPrimary },
  timer: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: 40, marginTop: spacing.sm },
  phaseText: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  controlRow: { flexDirection: "row", gap: spacing.md },
  ctrl: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 56,
  },
  ctrlStop: { backgroundColor: colors.error, borderColor: colors.error },
  ctrlText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  warn: { gap: spacing.sm, borderColor: colors.warning },
  warnText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  settingsBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" },
  settingsText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: fontSize.base },
  deniedNote: { color: colors.warning, fontFamily: fonts.regular, fontSize: fontSize.base, textAlign: "center" },
  errCard: { gap: spacing.xs, borderColor: colors.error },
  errHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  errTitle: { color: colors.error, fontFamily: fonts.semibold, fontSize: fontSize.base },
  errText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  errNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  transcribing: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  transcribingText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: fontSize.base },
  note: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 18 },
}));

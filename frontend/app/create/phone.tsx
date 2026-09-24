import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from "expo-audio";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Phone,
  PhoneCall,
  Microphone,
  Stop,
  ArrowRight,
  Warning,
  ClipboardText,
  CheckSquare,
  Square,
  Gear,
} from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Button, Card } from "@/src/components/ui";
import { useDraft } from "@/src/draft";
import { useToast } from "@/src/toast";
import { api } from "@/src/api";
import { CAPTURE_METHODS } from "@/src/constants";

type Step = "setup" | "capability" | "recording" | "stopped" | "transcribing";

function fmt(ms: number): string {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
}

export default function PhoneScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { setDraft } = useDraft();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [step, setStep] = useState<Step>("setup");
  const [number, setNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Honest runtime capability: two-sided cellular audio is not available to
  // third-party Expo apps. Web has no telephony at all.
  const capability = Platform.OS === "web" ? "unavailable" : "mic_only";

  useEffect(() => {
    (async () => {
      const p = await AudioModule.getRecordingPermissionsAsync();
      if (!p.granted && !p.canAskAgain) setBlocked(true);
    })();
  }, []);

  const proceedToCapability = () => {
    if (number.trim().length < 3) {
      toast.show("Enter a valid phone number.", "error");
      return;
    }
    if (!consent) {
      toast.show("Please confirm recording consent to continue.", "error");
      return;
    }
    setStep("capability");
  };

  const ensurePerm = useCallback(async () => {
    const cur = await AudioModule.getRecordingPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) {
      setBlocked(true);
      return false;
    }
    const req = await AudioModule.requestRecordingPermissionsAsync();
    if (!req.granted && !req.canAskAgain) setBlocked(true);
    return req.granted;
  }, []);

  const startSpeakerphone = async () => {
    const ok = await ensurePerm();
    if (!ok) return;
    // Open the dialer so the user can place the call on speakerphone.
    Linking.openURL(`tel:${number.trim()}`).catch(() => {});
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStep("recording");
    } catch {
      toast.show("Could not start microphone recording.", "error");
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      setStep("stopped");
    } catch {
      toast.show("Failed to stop recording.", "error");
    }
  };

  const useRecording = async () => {
    const uri = recorder.uri;
    if (!uri) {
      toast.show("No recording found. Please record again.", "error");
      return;
    }
    setStep("transcribing");
    try {
      const name = Platform.OS === "web" ? "call.webm" : "call.m4a";
      const type = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
      const res = await api.transcribe(uri, name, type);
      setDraft({ transcript: res.transcript, capture_method: CAPTURE_METHODS.phone, audio_sha256: res.audio_sha256 });
      router.push("/create/finalize");
    } catch (e: any) {
      setStep("stopped");
      toast.show(e?.message || "Transcription failed.", "error");
    }
  };

  const gotoTranscript = () => {
    setDraft({ transcript: "", capture_method: CAPTURE_METHODS.phone, audio_sha256: "" });
    router.push("/create/transcript");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader title="Phone Call" subtitle="Capture available call audio" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {step === "setup" && (
          <>
            <View>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.inputRow}>
                <Phone color={colors.muted} size={18} weight="bold" />
                <TextInput
                  testID="phone-number-input"
                  value={number}
                  onChangeText={setNumber}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
            </View>

            <Pressable testID="phone-consent" style={styles.consentRow} onPress={() => setConsent((c) => !c)}>
              {consent ? (
                <CheckSquare color={colors.brand} size={24} weight="fill" />
              ) : (
                <Square color={colors.muted} size={24} weight="regular" />
              )}
              <Text style={styles.consentText}>
                I confirm that I have the appropriate permission to record and process this conversation.
              </Text>
            </Pressable>

            <Button
              label="Continue"
              testID="phone-continue"
              onPress={proceedToCapability}
              icon={<ArrowRight color={colors.onBrandPrimary} size={18} weight="bold" />}
            />
          </>
        )}

        {step !== "setup" && (
          <Card style={styles.capCard} testID="phone-capability">
            <View style={styles.capHead}>
              <Warning color={colors.warning} size={20} weight="fill" />
              <Text style={styles.capTitle}>
                {capability === "unavailable" ? "Call recording unavailable here" : "Microphone audio only"}
              </Text>
            </View>
            <Text style={styles.capBody}>
              {capability === "unavailable"
                ? "Phone calls can't be placed or recorded in a web preview. On a device, RecordioAI captures microphone (speakerphone) audio. For now, paste the transcript instead."
                : "This device is providing microphone audio only. The other participant may not be captured. Place the call on speakerphone so both voices reach the microphone, or paste the transcript."}
            </Text>
          </Card>
        )}

        {blocked && step !== "setup" && (
          <Card style={styles.warnCard}>
            <Text style={styles.capBody}>Microphone access is off. Enable it in Settings or paste a transcript.</Text>
            <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
              <Gear color={colors.brand} size={16} weight="bold" />
              <Text style={styles.settingsText}>Open Settings</Text>
            </Pressable>
          </Card>
        )}

        {step === "capability" && (
          <View style={{ gap: spacing.md }}>
            {capability === "mic_only" && !blocked && (
              <Button
                label="Use Speakerphone Recording"
                testID="phone-speakerphone"
                icon={<PhoneCall color={colors.onBrandPrimary} size={18} weight="fill" />}
                onPress={startSpeakerphone}
              />
            )}
            <Button
              label="Enter Transcript Manually"
              variant="secondary"
              testID="phone-paste"
              icon={<ClipboardText color={colors.onSurface} size={18} weight="bold" />}
              onPress={gotoTranscript}
            />
          </View>
        )}

        {step === "recording" && (
          <Card style={styles.recCard}>
            <View style={styles.pulseActive}>
              <Microphone color={colors.onBrandPrimary} size={36} weight="fill" />
            </View>
            <Text style={styles.timer}>{fmt(state.durationMillis || 0)}</Text>
            <Text style={styles.phaseText}>Recording microphone (speakerphone)…</Text>
            <Pressable testID="phone-stop" style={[styles.ctrl, styles.ctrlStop]} onPress={stop}>
              <Stop color={colors.onError} size={20} weight="fill" />
              <Text style={[styles.ctrlText, { color: colors.onError }]}>Stop</Text>
            </Pressable>
          </Card>
        )}

        {step === "stopped" && (
          <View style={{ gap: spacing.md }}>
            <Button
              label="Use Recording"
              testID="phone-use"
              icon={<ArrowRight color={colors.onBrandPrimary} size={18} weight="bold" />}
              onPress={useRecording}
            />
            <Button label="Discard" variant="secondary" testID="phone-discard" onPress={() => setStep("capability")} />
          </View>
        )}

        {step === "transcribing" && (
          <View style={styles.transcribing}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.transcribingText}>Converting call audio to text…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  label: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.base, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: fontSize.lg, height: "100%" },
  consentRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  consentText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  capCard: { gap: spacing.sm, borderColor: colors.warning },
  warnCard: { gap: spacing.sm, borderColor: colors.warning },
  capHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  capTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  capBody: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  settingsBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" },
  settingsText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: fontSize.base },
  recCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  pulseActive: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: 36 },
  phaseText: { color: colors.muted, fontFamily: fonts.medium, fontSize: fontSize.base },
  ctrl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },
  ctrlStop: { backgroundColor: colors.error, marginTop: spacing.sm, alignSelf: "stretch" },
  ctrlText: { fontFamily: fonts.semibold, fontSize: fontSize.lg },
  transcribing: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  transcribingText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: fontSize.base },
}));

import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckSquare, Square, ShieldCheck, Plus, X } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Button, SectionLabel, Badge } from "@/src/components/ui";
import { useDraft } from "@/src/draft";
import { useToast } from "@/src/toast";
import { api } from "@/src/api";
import { CONVERSATION_TYPES, ConversationType } from "@/src/constants";

export default function Finalize() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { draft, reset } = useDraft();

  const [transcript, setTranscript] = useState(draft.transcript);
  const [agentName, setAgentName] = useState("");
  const [agentVersion, setAgentVersion] = useState("");
  const [policyVersion, setPolicyVersion] = useState("");
  const [convType, setConvType] = useState<ConversationType>("Support");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [processing, setProcessing] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    setTags((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t]));
    setTagInput("");
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const canProcess = transcript.trim().length >= 10 && agentName.trim().length > 0 && consent && !processing;

  const process = async () => {
    if (!canProcess) {
      if (!agentName.trim()) toast.show("Agent / representative name is required.", "error");
      else if (transcript.trim().length < 10) toast.show("Transcript is too short.", "error");
      else if (!consent) toast.show("Please confirm recording consent to continue.", "error");
      return;
    }
    setProcessing(true);
    try {
      const res = await api.createRecord({
        transcript: transcript.trim(),
        capture_method: draft.capture_method || "Transcript",
        agent_name: agentName.trim(),
        agent_version: agentVersion.trim(),
        policy_version: policyVersion.trim(),
        conversation_type: convType,
        audio_sha256: draft.audio_sha256,
        tags,
        notes: notes.trim(),
      });
      await qc.invalidateQueries({ queryKey: ["records"] });
      await qc.invalidateQueries({ queryKey: ["trial"] });
      reset();
      router.replace(`/receipt/${res.record.record_id}`);
    } catch (e: any) {
      setProcessing(false);
      if (e?.status === 402) {
        toast.show("Trial limit reached. Upgrade to continue.", "error");
        router.replace("/pricing");
        return;
      }
      toast.show(e?.message || "Processing failed. Please try again.", "error");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader title="Review & Process" subtitle="Confirm the transcript and add details" />

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.xl }}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        {/* Transcript */}
        <View>
          <View style={styles.rowBetween}>
            <SectionLabel>Conversation Transcript</SectionLabel>
            <Badge label={draft.capture_method || "Transcript"} tone="brand" />
          </View>
          <Text style={styles.hint}>
            Fix any obvious transcription mistakes. This exact text becomes the canonical record and its
            SHA-256 fingerprint.
          </Text>
          <TextInput
            testID="finalize-transcript"
            value={transcript}
            onChangeText={setTranscript}
            multiline
            textAlignVertical="top"
            placeholder="Paste or edit the conversation transcript…"
            placeholderTextColor={colors.muted}
            style={styles.transcriptInput}
          />
        </View>

        {/* Metadata */}
        <View style={{ gap: spacing.lg }}>
          <SectionLabel>Record Details</SectionLabel>

          <Field label="Agent / Representative Name" required>
            <TextInput
              testID="finalize-agent-name"
              value={agentName}
              onChangeText={setAgentName}
              placeholder="Support Agent 01"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </Field>

          <View style={styles.twoCol}>
            <Field label="Agent Version" style={{ flex: 1 }}>
              <TextInput
                testID="finalize-agent-version"
                value={agentVersion}
                onChangeText={setAgentVersion}
                placeholder="v2.4"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
            <Field label="Policy Version" style={{ flex: 1 }}>
              <TextInput
                testID="finalize-policy-version"
                value={policyVersion}
                onChangeText={setPolicyVersion}
                placeholder="Optional"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </Field>
          </View>

          <Field label="Conversation Type">
            <View style={styles.segment}>
              {CONVERSATION_TYPES.map((t) => {
                const active = convType === t;
                return (
                  <Pressable
                    key={t}
                    testID={`conv-type-${t}`}
                    onPress={() => setConvType(t)}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Tags (optional)">
            <View style={styles.tagInputRow}>
              <TextInput
                testID="finalize-tag-input"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                placeholder="Add a tag, e.g. vip"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                returnKeyType="done"
                style={styles.tagInput}
              />
              <Pressable testID="finalize-add-tag" onPress={addTag} style={styles.tagAddBtn}>
                <Plus color={colors.onBrandPrimary} size={18} weight="bold" />
              </Pressable>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagWrap}>
                {tags.map((t) => (
                  <Pressable key={t} testID={`finalize-tag-${t}`} onPress={() => removeTag(t)} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{t}</Text>
                    <X color={colors.onBrandTertiary} size={12} weight="bold" />
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          <Field label="Notes (optional)">
            <TextInput
              testID="finalize-notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholder="Internal notes for this record…"
              placeholderTextColor={colors.muted}
              style={styles.notesInput}
            />
          </Field>
        </View>

        {/* Consent */}
        <Pressable testID="finalize-consent" style={styles.consentCard} onPress={() => setConsent((c) => !c)}>
          {consent ? (
            <CheckSquare color={colors.brand} size={24} weight="fill" />
          ) : (
            <Square color={colors.muted} size={24} weight="regular" />
          )}
          <Text style={styles.consentText}>
            I confirm that I have the appropriate permission to record and process this conversation.
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            label="Process Conversation"
            testID="finalize-process"
            onPress={process}
            disabled={!canProcess}
            loading={processing}
            icon={<ShieldCheck color={colors.onBrandPrimary} size={18} weight="fill" />}
          />
        </View>
      </KeyboardStickyView>

      {processing && (
        <View style={styles.overlay} testID="finalize-processing">
          <ActivityIndicator color={colors.brandPrimary} size="large" />
          <Text style={styles.overlayTitle}>Extracting commitments…</Text>
          <Text style={styles.overlaySub}>Analysing the conversation and generating your receipt.</Text>
        </View>
      )}
    </View>
  );
}

function Field({
  label,
  required,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  style?: any;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 18, marginBottom: spacing.sm },
  transcriptInput: {
    minHeight: 180,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  fieldLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: fontSize.base, marginBottom: spacing.sm },
  req: { color: colors.error },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
  },
  twoCol: { flexDirection: "row", gap: spacing.md },
  segment: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  segmentItem: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: fontSize.sm },
  segmentTextActive: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
  tagInputRow: { flexDirection: "row", gap: spacing.sm },
  tagInput: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
  },
  tagAddBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  tagChipText: { color: colors.onBrandTertiary, fontFamily: fonts.medium, fontSize: fontSize.sm },
  notesInput: {
    minHeight: 90,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
  },
  consentCard: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  consentText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  overlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  overlayTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.xl },
  overlaySub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, textAlign: "center" },
}));

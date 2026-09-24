import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import {
  ShieldCheck,
  ShieldWarning,
  Trash,
  Copy,
  SealCheck,
  Export,
  Quotes,
} from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Button, Card, SectionLabel, MonoBlock, Divider, Badge } from "@/src/components/ui";
import { useToast } from "@/src/toast";
import { api, Commitment, Record } from "@/src/api";
import { formatDateTime, conversationTone } from "@/src/format";
import { buildEvidenceHtml } from "@/src/evidence";

const SECTIONS: { key: keyof Record; label: string }[] = [
  { key: "promises", label: "Promises" },
  { key: "prices_or_fees", label: "Prices & Fees" },
  { key: "dates_or_deadlines", label: "Dates & Deadlines" },
  { key: "warranties_or_disclosures", label: "Warranties & Disclosures" },
  { key: "cancellations_or_changes", label: "Cancellations & Changes" },
];

export default function Receipt() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const recordQ = useQuery({ queryKey: ["record", id], queryFn: () => api.getRecord(id!) , enabled: !!id });
  const record = recordQ.data;

  const verifyMut = useMutation({
    mutationFn: () => api.verifyRecord(id!),
    onSuccess: (res) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          res.match ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
        );
      }
      qc.invalidateQueries({ queryKey: ["record", id] });
      qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e: any) => toast.show(e?.message || "Verification failed.", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteRecord(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["trial"] });
      toast.show("Record deleted.", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e?.message || "Delete failed.", "error"),
  });

  const verified = (verifyMut.data?.verification_status || record?.verification_status) === "verified";
  const verifiedThisSession = !!verifyMut.data;

  const totalCommitments = useMemo(() => {
    if (!record) return 0;
    return SECTIONS.reduce((n, s) => n + ((record[s.key] as Commitment[])?.length || 0), 0);
  }, [record]);

  const copyHash = async (value: string) => {
    await Clipboard.setStringAsync(value);
    toast.show("Hash copied to clipboard.", "success");
  };

  const exportEvidence = async () => {
    if (!record) return;
    setExporting(true);
    try {
      const html = buildEvidenceHtml(record, verifyMut.data?.match ?? verified);
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
        else toast.show("Evidence PDF generated.", "success");
      }
    } catch {
      toast.show("Could not generate the evidence package.", "error");
    } finally {
      setExporting(false);
    }
  };

  if (recordQ.isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
        <AppHeader title="Conversation Receipt" />
        <View style={styles.center}>
          <Text style={styles.notFound}>This record could not be found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader
        title="Conversation Receipt"
        right={
          <Pressable testID="receipt-delete" hitSlop={10} onPress={() => setConfirmDelete(true)}>
            <Trash color={colors.error} size={20} weight="bold" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 96, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={[styles.banner, verified ? styles.bannerOk : styles.bannerBad]} testID="receipt-status-banner">
          {verified ? (
            <ShieldCheck color={colors.success} size={26} weight="fill" />
          ) : (
            <ShieldWarning color={colors.error} size={26} weight="fill" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: verified ? colors.success : colors.error }]}>
              {verified ? "Record integrity verified" : "Record integrity mismatch"}
            </Text>
            <Text style={styles.bannerSub}>
              {verified
                ? "The transcript matches the original recorded hash."
                : "The transcript no longer matches the original recorded hash."}
            </Text>
          </View>
        </View>

        {/* Meta block */}
        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={styles.recordId} testID="receipt-record-id">{record.record_id}</Text>
            <Badge label={record.conversation_type} tone={conversationTone(record.conversation_type)} />
          </View>
          <Divider />
          <MetaRow label="Created" value={formatDateTime(record.created_at)} />
          <MetaRow label="Capture Method" value={record.capture_method} />
          <MetaRow label="Agent" value={record.agent_name} />
          {!!record.agent_version && <MetaRow label="Agent Version" value={record.agent_version} />}
          {!!record.policy_version && <MetaRow label="Policy Version" value={record.policy_version} />}
        </Card>

        {/* Executive summary */}
        <View>
          <SectionLabel>Executive Summary</SectionLabel>
          <Card>
            <Text style={styles.summary} testID="receipt-summary">
              {record.summary || "No summary available."}
            </Text>
          </Card>
        </View>

        {/* Commitments */}
        <View>
          <View style={styles.rowBetween}>
            <SectionLabel>Commitments</SectionLabel>
            <Text style={styles.countPill}>{totalCommitments}</Text>
          </View>
          {totalCommitments === 0 ? (
            <Card>
              <Text style={styles.emptyCommit}>
                No explicit commitments were detected in this conversation. RecordioAI never invents promises.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {SECTIONS.map((s) => {
                const items = (record[s.key] as Commitment[]) || [];
                if (items.length === 0) return null;
                return items.map((c, i) => (
                  <CommitmentCard key={`${s.key}-${i}`} item={c} fallback={s.label} />
                ));
              })}
            </View>
          )}
        </View>

        {/* Original transcript */}
        <View>
          <SectionLabel>Original Conversation</SectionLabel>
          <MonoBlock value={record.transcript} textStyle={{ fontSize: 12.5 }} />
        </View>

        {/* Integrity */}
        <View>
          <SectionLabel>Integrity</SectionLabel>
          <View style={{ gap: spacing.md }}>
            <HashRow label="Transcript Hash · SHA-256" value={record.transcript_sha256} onCopy={copyHash} />
            {!!record.audio_sha256 && (
              <HashRow label="Audio Hash · SHA-256" value={record.audio_sha256} onCopy={copyHash} />
            )}
          </View>
        </View>

        {/* Verify */}
        <Button
          label={verifyMut.isPending ? "Verifying…" : "Verify Integrity"}
          variant="secondary"
          testID="receipt-verify"
          loading={verifyMut.isPending}
          icon={<SealCheck color={colors.onSurface} size={18} weight="fill" />}
          onPress={() => verifyMut.mutate()}
        />

        {verifiedThisSession && (
          <Card style={styles.whyCard} testID="receipt-why">
            <Text style={styles.whyText}>
              RecordioAI creates a cryptographic fingerprint of the conversation so you can later check whether
              the stored record has changed. It proves the stored content matches its hash — not that the
              conversation itself was truthful.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Sticky export */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label="Export Evidence"
          testID="receipt-export"
          loading={exporting}
          icon={<Export color={colors.onBrandPrimary} size={18} weight="bold" />}
          onPress={exportEvidence}
        />
      </View>

      {/* Delete confirm */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete this record?</Text>
            <Text style={styles.modalSub}>
              This removes the record from your workspace. This cannot be undone from the app.
            </Text>
            <View style={styles.modalBtns}>
              <Button label="Cancel" variant="secondary" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
              <Button
                label="Delete"
                variant="danger"
                testID="confirm-delete"
                loading={deleteMut.isPending}
                onPress={() => deleteMut.mutate()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function HashRow({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.hashHead}>
        <Text style={styles.hashLabel}>{label}</Text>
        <Pressable hitSlop={8} onPress={() => onCopy(value)} style={styles.copyBtn} testID="copy-hash">
          <Copy color={colors.brand} size={15} weight="bold" />
          <Text style={styles.copyText}>Copy</Text>
        </Pressable>
      </View>
      <MonoBlock value={value} />
    </View>
  );
}

function CommitmentCard({ item, fallback }: { item: Commitment; fallback: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.commitTop}>
        <Badge label={item.category || fallback} tone="brand" />
        {!!item.speaker && <Text style={styles.speaker}>{item.speaker}</Text>}
      </View>
      <Text style={styles.commitText}>{item.commitment}</Text>
      {!!item.quote && (
        <View style={styles.quoteBlock}>
          <Quotes color={colors.muted} size={14} weight="fill" />
          <Text style={styles.quoteText}>{item.quote}</Text>
        </View>
      )}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.lg },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  bannerOk: { backgroundColor: colors.brandTertiary, borderColor: colors.success },
  bannerBad: { backgroundColor: colors.surfaceSecondary, borderColor: colors.error },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg },
  bannerSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recordId: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: fontSize.lg },
  metaRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg },
  metaLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  metaValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: fontSize.base, flex: 1, textAlign: "right" },
  summary: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: fontSize.lg, lineHeight: 24 },
  countPill: { color: colors.brand, fontFamily: fonts.monoMedium, fontSize: fontSize.base },
  emptyCommit: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  commitTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  speaker: { color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.sm },
  commitText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: fontSize.lg, lineHeight: 23 },
  quoteBlock: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  quoteText: { flex: 1, color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, fontStyle: "italic", lineHeight: 20 },
  hashHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  hashLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.monoMedium, fontSize: fontSize.sm },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  whyCard: { backgroundColor: colors.surfaceSecondary },
  whyText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 21 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.xl },
  modalSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
}));

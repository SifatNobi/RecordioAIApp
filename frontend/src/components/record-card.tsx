import { Text, View } from "react-native";
import { CaretRight, ShieldCheck, WarningCircle } from "phosphor-react-native";

import { Card, Badge } from "@/src/components/ui";
import { makeStyles, useTheme, fonts, spacing, fontSize } from "@/src/theme";
import { Record } from "@/src/api";
import { formatDate, conversationTone } from "@/src/format";

export function RecordCard({ record, onPress }: { record: Record; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const verified = record.verification_status === "verified";
  return (
    <Card testID={`record-card-${record.record_id}`} onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.recordId}>{record.record_id}</Text>
        <View style={styles.statusRow}>
          {verified ? (
            <ShieldCheck color={colors.success} size={16} weight="fill" />
          ) : (
            <WarningCircle color={colors.error} size={16} weight="fill" />
          )}
          <Text style={[styles.statusText, { color: verified ? colors.success : colors.error }]}>
            {verified ? "Verified" : "Mismatch"}
          </Text>
        </View>
      </View>

      <Text style={styles.summary} numberOfLines={2}>
        {record.summary || "No summary available."}
      </Text>

      <View style={styles.metaRow}>
        <Badge label={record.conversation_type} tone={conversationTone(record.conversation_type)} />
        <Text style={styles.meta}>{record.agent_name}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{formatDate(record.created_at)}</Text>
        <View style={{ flex: 1 }} />
        <CaretRight color={colors.muted} size={16} weight="bold" />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { gap: spacing.md },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recordId: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: fontSize.base },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { fontFamily: fonts.medium, fontSize: fontSize.sm },
  summary: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm },
  dot: { color: colors.muted, fontSize: fontSize.sm },
}));

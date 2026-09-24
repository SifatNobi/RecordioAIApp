import { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, FileText, ShieldCheck, Vault, ArrowRight } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { Logo } from "@/src/components/logo";
import { Button, Card } from "@/src/components/ui";
import { RecordCard } from "@/src/components/record-card";
import { api } from "@/src/api";
import { TAGLINE } from "@/src/constants";

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const trialQ = useQuery({ queryKey: ["trial"], queryFn: api.trial });
  const recordsQ = useQuery({ queryKey: ["records"], queryFn: () => api.listRecords() });

  useFocusEffect(
    useCallback(() => {
      trialQ.refetch();
      recordsQ.refetch();
    }, []),
  );

  const records = recordsQ.data?.records ?? [];
  const recent = records.slice(0, 3);
  const trial = trialQ.data;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Logo />
        {trial && (
          <View style={styles.trialPill} testID="trial-pill">
            <Text style={styles.trialPillText}>
              {trial.remaining} / {trial.limit} left
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing["2xl"], gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tagline}>{TAGLINE}</Text>
        <Text style={styles.intro}>
          Capture a conversation, extract what was promised, and create a verifiable record.
        </Text>

        <View style={{ gap: spacing.md }}>
          <Button
            label="Create Record"
            testID="home-create-record"
            icon={<Plus color={colors.onBrandPrimary} size={20} weight="bold" />}
            onPress={() => router.push("/create")}
          />
          <Button
            label="View Records"
            variant="secondary"
            testID="home-view-records"
            icon={<FileText color={colors.onSurface} size={20} weight="bold" />}
            onPress={() => router.push("/(tabs)/records")}
          />
        </View>

        {trial && trial.remaining <= 3 && (
          <Card style={styles.limitCard} testID="home-limit-card">
            <Text style={styles.limitText}>
              {trial.remaining === 0
                ? "You've used all 10 trial records."
                : `${trial.remaining} of ${trial.limit} trial records remaining.`}
            </Text>
            <Text style={styles.limitLink} onPress={() => router.push("/pricing")}>
              View plans →
            </Text>
          </Card>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent Records</Text>
          {records.length > 3 && (
            <Text style={styles.viewAll} onPress={() => router.push("/(tabs)/records")}>
              View all
            </Text>
          )}
        </View>

        {recent.length === 0 ? (
          <Card style={styles.empty} testID="home-empty-state">
            <View style={styles.emptyIcon}>
              <Vault color={colors.brand} size={30} weight="duotone" />
            </View>
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.emptySub}>Your verified conversation records will appear here.</Text>
            <Button
              label="Create your first record"
              testID="empty-create-first"
              onPress={() => router.push("/create")}
              icon={<ArrowRight color={colors.onBrandPrimary} size={18} weight="bold" />}
              style={{ marginTop: spacing.md, alignSelf: "stretch" }}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {recent.map((r) => (
              <RecordCard key={r.record_id} record={r} onPress={() => router.push(`/receipt/${r.record_id}`)} />
            ))}
          </View>
        )}

        <Card style={styles.whyCard}>
          <ShieldCheck color={colors.brand} size={22} weight="fill" />
          <Text style={styles.whyText}>
            RecordioAI creates a cryptographic fingerprint of each conversation so you can later check
            whether the stored record has changed.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  trialPill: {
    backgroundColor: colors.brandTertiary,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  trialPillText: { color: colors.onBrandTertiary, fontFamily: fonts.monoMedium, fontSize: fontSize.sm },
  tagline: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 26 },
  intro: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.lg, lineHeight: 24, marginTop: -spacing.sm },
  limitCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderColor: colors.brand,
  },
  limitText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: fontSize.base, flex: 1 },
  limitLink: { color: colors.brand, fontFamily: fonts.semibold, fontSize: fontSize.base },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.xl },
  viewAll: { color: colors.brand, fontFamily: fonts.medium, fontSize: fontSize.base },
  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  emptySub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, textAlign: "center" },
  whyCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", backgroundColor: colors.surfaceSecondary },
  whyText: { flex: 1, color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 21 },
}));

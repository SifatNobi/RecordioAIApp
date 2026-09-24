import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MagnifyingGlass, FileMagnifyingGlass } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { RecordCard } from "@/src/components/record-card";
import { Card } from "@/src/components/ui";
import { api } from "@/src/api";

export default function Records() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const recordsQ = useQuery({
    queryKey: ["records", q, tag],
    queryFn: () => api.listRecords(q.trim() || undefined, tag || undefined),
  });
  const tagsQ = useQuery({ queryKey: ["tags"], queryFn: api.listTags });

  useFocusEffect(
    useCallback(() => {
      recordsQ.refetch();
      tagsQ.refetch();
    }, []),
  );

  const records = recordsQ.data?.records ?? [];
  const tags = tagsQ.data?.tags ?? [];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Records</Text>
        <View style={styles.searchBox}>
          <MagnifyingGlass color={colors.muted} size={18} weight="bold" />
          <TextInput
            testID="records-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search agent, ID, tag or summary"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        {tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRowContent}
            style={styles.chipRow}
          >
            <Pressable
              testID="tag-chip-all"
              onPress={() => setTag(null)}
              style={[styles.chip, !tag && styles.chipActive]}
            >
              <Text style={[styles.chipText, !tag && styles.chipTextActive]}>All</Text>
            </Pressable>
            {tags.map((t) => {
              const active = tag === t;
              return (
                <Pressable
                  key={t}
                  testID={`tag-chip-${t}`}
                  onPress={() => setTag(active ? null : t)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {recordsQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(r) => r.record_id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: bottomChrome + spacing["2xl"],
            gap: spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RecordCard record={item} onPress={() => router.push(`/receipt/${item.record_id}`)} />
          )}
          ListEmptyComponent={
            <Card style={styles.empty} testID="records-empty">
              <View style={styles.emptyIcon}>
                <FileMagnifyingGlass color={colors.brand} size={28} weight="duotone" />
              </View>
              <Text style={styles.emptyTitle}>
                {q ? "No records match your search" : "No records yet"}
              </Text>
              <Text style={styles.emptySub}>
                {q
                  ? "Try a different agent name, record ID or keyword."
                  : "Your verified conversation records will appear here."}
              </Text>
            </Card>
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 28 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: fontSize.base, height: "100%" },
  chipRow: { marginHorizontal: -spacing.lg },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextActive: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xl, marginTop: spacing.xl },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg, textAlign: "center" },
  emptySub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, textAlign: "center" },
}));

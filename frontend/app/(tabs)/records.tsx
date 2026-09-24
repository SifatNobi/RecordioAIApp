import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
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
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const recordsQ = useQuery({
    queryKey: ["records", q],
    queryFn: () => api.listRecords(q.trim() || undefined),
  });

  useFocusEffect(
    useCallback(() => {
      recordsQ.refetch();
    }, []),
  );

  const records = recordsQ.data?.records ?? [];

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
            placeholder="Search agent, ID or summary"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
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

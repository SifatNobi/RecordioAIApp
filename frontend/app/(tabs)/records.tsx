import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { MagnifyingGlass, FileMagnifyingGlass, Checks, Export, X } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { RecordCard } from "@/src/components/record-card";
import { Card, Button } from "@/src/components/ui";
import { useToast } from "@/src/toast";
import { api } from "@/src/api";
import { DATE_FILTERS, tagColorHex } from "@/src/constants";
import { buildBulkEvidenceHtml } from "@/src/evidence";

export default function Records() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const start = useMemo(() => {
    const f = DATE_FILTERS.find((d) => d.key === dateKey);
    if (!f || !f.days) return undefined;
    return new Date(Date.now() - f.days * 86400000).toISOString().slice(0, 10);
  }, [dateKey]);

  const recordsQ = useQuery({
    queryKey: ["records", q, tag, start],
    queryFn: () => api.listRecords(q.trim() || undefined, tag || undefined, start),
  });
  const tagsQ = useQuery({ queryKey: ["tags"], queryFn: api.listTags });
  const tagColorsQ = useQuery({ queryKey: ["tag-colors"], queryFn: api.getTagColors });

  useFocusEffect(
    useCallback(() => {
      recordsQ.refetch();
      tagsQ.refetch();
      tagColorsQ.refetch();
    }, []),
  );

  const records = recordsQ.data?.records ?? [];
  const tags = tagsQ.data?.tags ?? [];
  const tagColors = tagColorsQ.data?.colors ?? {};

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const exportSelected = async () => {
    const chosen = records.filter((r) => selected.has(r.record_id));
    if (chosen.length === 0) {
      toast.show("Select at least one record.", "error");
      return;
    }
    setExporting(true);
    try {
      const html = buildBulkEvidenceHtml(chosen);
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        const ok = await Sharing.isAvailableAsync();
        if (ok) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
        else toast.show("Combined PDF generated.", "success");
      }
      cancelSelect();
    } catch {
      toast.show("Could not generate the combined PDF.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Records</Text>
          {records.length > 0 &&
            (selectMode ? (
              <Pressable testID="records-select-cancel" onPress={cancelSelect} hitSlop={8} style={styles.selBtn}>
                <X color={colors.onSurface} size={16} weight="bold" />
                <Text style={styles.selBtnText}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable testID="records-select" onPress={() => setSelectMode(true)} hitSlop={8} style={styles.selBtn}>
                <Checks color={colors.brand} size={16} weight="bold" />
                <Text style={[styles.selBtnText, { color: colors.brand }]}>Select</Text>
              </Pressable>
            ))}
        </View>

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow}>
          {DATE_FILTERS.map((d) => {
            const active = dateKey === d.key;
            return (
              <Pressable key={d.key} testID={`date-chip-${d.key}`} onPress={() => setDateKey(d.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow}>
            <Pressable testID="tag-chip-all" onPress={() => setTag(null)} style={[styles.chip, !tag && styles.chipActive]}>
              <Text style={[styles.chipText, !tag && styles.chipTextActive]}>All tags</Text>
            </Pressable>
            {tags.map((t) => {
              const active = tag === t;
              const hex = tagColorHex(tagColors[t]);
              return (
                <Pressable
                  key={t}
                  testID={`tag-chip-${t}`}
                  onPress={() => setTag(active ? null : t)}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                    hex && !active ? { borderColor: hex } : null,
                  ]}
                >
                  {hex && <View style={[styles.dot, { backgroundColor: hex }]} />}
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
            <RecordCard
              record={item}
              selectable={selectMode}
              selected={selected.has(item.record_id)}
              tagColors={tagColors}
              onPress={() => (selectMode ? toggle(item.record_id) : router.push(`/receipt/${item.record_id}`))}
            />
          )}
          ListEmptyComponent={
            <Card style={styles.empty} testID="records-empty">
              <View style={styles.emptyIcon}>
                <FileMagnifyingGlass color={colors.brand} size={28} weight="duotone" />
              </View>
              <Text style={styles.emptyTitle}>{q || tag || start ? "No records match your filters" : "No records yet"}</Text>
              <Text style={styles.emptySub}>
                {q || tag || start
                  ? "Try a different search, tag or date range."
                  : "Your verified conversation records will appear here."}
              </Text>
            </Card>
          }
        />
      )}

      {selectMode && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            label={`Export Evidence (${selected.size})`}
            testID="records-bulk-export"
            loading={exporting}
            disabled={selected.size === 0}
            icon={<Export color={colors.onBrandPrimary} size={18} weight="bold" />}
            onPress={exportSelected}
          />
        </View>
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 28 },
  selBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  selBtnText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.base },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextActive: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
  dot: { width: 8, height: 8, borderRadius: 4 },
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
}));

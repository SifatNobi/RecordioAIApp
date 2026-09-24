import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Card } from "@/src/components/ui";
import { PLANS } from "@/src/constants";

export default function Pricing() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader title="Plans & Pricing" right={<X color={colors.onSurface} size={20} weight="bold" />} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Your free trial includes 10 verified records. Choose a plan to keep proving what your AI promised.
        </Text>

        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            testID={`plan-${plan.id}`}
            style={[styles.plan, plan.highlight && styles.planHighlight]}
          >
            {plan.highlight && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>MOST POPULAR</Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{plan.price}</Text>
              {!!plan.cadence && <Text style={styles.cadence}>{plan.cadence}</Text>}
            </View>
            <View style={styles.features}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Check color={colors.brand} size={16} weight="bold" />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))}

        <Card style={styles.note}>
          <Text style={styles.noteText}>
            Payments are not yet enabled in this preview. No subscription is active and no charges are made.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  intro: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.lg, lineHeight: 24 },
  plan: { gap: spacing.sm },
  planHighlight: { borderColor: colors.brand, borderWidth: 2 },
  badge: { alignSelf: "flex-start", backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: spacing.sm },
  badgeText: { color: colors.onBrandTertiary, fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1 },
  planName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.xl },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  price: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 30 },
  cadence: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, marginBottom: 6 },
  features: { gap: spacing.sm, marginTop: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featureText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: fontSize.base },
  note: { backgroundColor: colors.surfaceTertiary },
  noteText: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 18 },
}));

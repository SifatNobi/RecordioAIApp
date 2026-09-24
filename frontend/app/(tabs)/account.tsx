import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SignOut, Sparkle, ShieldCheck, CaretRight } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { Button, Card } from "@/src/components/ui";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

export default function Account() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const trialQ = useQuery({ queryKey: ["trial"], queryFn: api.trial });
  const trial = trialQ.data;
  const pct = trial ? Math.min(1, trial.used / trial.limit) : 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Account</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing["2xl"], gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.profile}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{(user?.name || user?.email || "?").charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name || "RecordioAI user"}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Trial usage</Text>
            {trial && (
              <Text style={styles.trialCount}>
                {trial.used} / {trial.limit}
              </Text>
            )}
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={styles.trialSub}>
            {trial ? `${trial.remaining} of ${trial.limit} records remaining` : "Loading…"}
          </Text>
        </Card>

        <Card onPress={() => router.push("/pricing")} testID="account-pricing" style={styles.linkRow}>
          <View style={styles.linkIcon}>
            <Sparkle color={colors.brand} size={20} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Plans & pricing</Text>
            <Text style={styles.linkSub}>Grey Parrot, Myna & Enterprise</Text>
          </View>
          <CaretRight color={colors.muted} size={18} weight="bold" />
        </Card>

        <Card style={styles.whyCard}>
          <ShieldCheck color={colors.brand} size={20} weight="fill" />
          <Text style={styles.whyText}>
            Records are private to your workspace. Verification only proves the stored transcript matches
            its original SHA-256 fingerprint — it does not adjudicate the conversation.
          </Text>
        </Card>

        <Button
          label="Sign out"
          variant="danger"
          testID="account-signout"
          icon={<SignOut color={colors.error} size={18} weight="bold" />}
          onPress={signOut}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 28 },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: radius.pill },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.onBrandTertiary, fontFamily: fonts.bold, fontSize: fontSize.xl },
  name: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  email: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  trialCount: { color: colors.brand, fontFamily: fonts.monoMedium, fontSize: fontSize.lg },
  track: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  trialSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  linkSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2 },
  whyCard: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  whyText: { flex: 1, color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 21 },
}));

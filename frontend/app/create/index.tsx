import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Microphone, Phone, ClipboardText, CaretRight } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Card } from "@/src/components/ui";
import { api } from "@/src/api";

const METHODS = [
  {
    key: "record",
    route: "/create/record",
    title: "Record Conversation",
    desc: "Use the device microphone to capture a live conversation.",
    Icon: Microphone,
  },
  {
    key: "phone",
    route: "/create/phone",
    title: "Phone Call",
    desc: "Dial a number and record available call audio with capability detection.",
    Icon: Phone,
  },
  {
    key: "transcript",
    route: "/create/transcript",
    title: "Paste Transcript",
    desc: "Paste an existing conversation. The most reliable option.",
    Icon: ClipboardText,
  },
] as const;

export default function CreateIndex() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const trialQ = useQuery({ queryKey: ["trial"], queryFn: api.trial });
  const remaining = trialQ.data?.remaining ?? null;
  const limitReached = remaining !== null && remaining <= 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader title="Create Record" subtitle="Choose how to capture the conversation" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {limitReached && (
          <Card style={styles.limit} testID="create-limit">
            <Text style={styles.limitTitle}>Trial limit reached</Text>
            <Text style={styles.limitSub}>
              You&apos;ve created all 10 trial records. Upgrade to continue creating verified records.
            </Text>
            <Text style={styles.limitLink} onPress={() => router.push("/pricing")}>
              View plans →
            </Text>
          </Card>
        )}

        {METHODS.map(({ key, route, title, desc, Icon }) => (
          <Card
            key={key}
            testID={`method-${key}`}
            onPress={() => (limitReached ? router.push("/pricing") : router.push(route as any))}
            style={[styles.method, limitReached && { opacity: 0.5 }]}
          >
            <View style={styles.methodIcon}>
              <Icon color={colors.brand} size={24} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>{title}</Text>
              <Text style={styles.methodDesc}>{desc}</Text>
            </View>
            <CaretRight color={colors.muted} size={18} weight="bold" />
          </Card>
        ))}

        {remaining !== null && !limitReached && (
          <Text style={styles.remaining} testID="create-remaining">
            {remaining} of {trialQ.data?.limit} trial records remaining
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  method: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  methodTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  methodDesc: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, marginTop: 3, lineHeight: 19 },
  limit: { gap: spacing.xs, borderColor: colors.brand },
  limitTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  limitSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20 },
  limitLink: { color: colors.brand, fontFamily: fonts.semibold, fontSize: fontSize.base, marginTop: spacing.xs },
  remaining: { color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.sm },
}));

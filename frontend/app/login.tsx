import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { GoogleLogo, ShieldCheck } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { TAGLINE, SUBTAGLINE } from "@/src/constants";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signingIn, authError } = useAuth();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing["3xl"], paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandBlock}>
        <Image source={require("../assets/images/icon.png")} style={styles.logo} contentFit="contain" />
        <Text style={styles.wordmark}>RecordioAI</Text>
        <Text style={styles.tagline}>{TAGLINE}</Text>
        <Text style={styles.sub}>{SUBTAGLINE}</Text>
      </View>

      <View style={styles.pillars}>
        {[
          "Capture the conversation",
          "Extract what was promised",
          "Verify the record with SHA-256",
        ].map((t) => (
          <View key={t} style={styles.pillar}>
            <ShieldCheck color={colors.brand} size={18} weight="fill" />
            <Text style={styles.pillarText}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottom}>
        {!!authError && (
          <Text testID="login-error" style={styles.error}>
            {authError}
          </Text>
        )}
        <Pressable
          testID="google-signin-button"
          onPress={signIn}
          disabled={signingIn}
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }, signingIn && { opacity: 0.6 }]}
        >
          {signingIn ? (
            <ActivityIndicator color={colors.onSurfaceInverse} />
          ) : (
            <>
              <GoogleLogo color={colors.onSurfaceInverse} size={20} weight="bold" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.legal}>
          Single-user business workspace. Your records stay private to your account.
        </Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  brandBlock: { alignItems: "center", gap: spacing.sm },
  logo: { width: 96, height: 96, borderRadius: radius.lg },
  wordmark: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: 30, marginTop: spacing.md },
  tagline: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg, textAlign: "center" },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, textAlign: "center" },
  pillars: { gap: spacing.md, marginVertical: spacing.xl },
  pillar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pillarText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: fontSize.base },
  bottom: { gap: spacing.md },
  error: { color: colors.error, fontFamily: fonts.medium, fontSize: fontSize.base, textAlign: "center" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    minHeight: 54,
  },
  googleText: { color: colors.onSurfaceInverse, fontFamily: fonts.semibold, fontSize: fontSize.lg },
  legal: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, textAlign: "center" },
}));

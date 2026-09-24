import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { CaretLeft } from "phosphor-react-native";
import { useRouter } from "expo-router";

import { makeStyles, useTheme, fonts, spacing, radius, fontSize } from "@/src/theme";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg: Record<BtnVariant, ViewStyle> = {
    primary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
    secondary: { backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
    ghost: { backgroundColor: "transparent", borderColor: "transparent" },
    danger: { backgroundColor: "transparent", borderColor: colors.error },
  };
  const fg: Record<BtnVariant, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onSurface,
    ghost: colors.brand,
    danger: colors.error,
  };

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (isDisabled) return;
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        bg[variant],
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <Text style={[styles.btnText, { color: fg[variant] }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
type BadgeTone = "neutral" | "success" | "error" | "brand" | "warning";
export function Badge({ label, tone = "neutral", testID }: { label: string; tone?: BadgeTone; testID?: string }) {
  const { colors } = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    success: { bg: colors.brandTertiary, fg: colors.success },
    error: { bg: colors.surfaceTertiary, fg: colors.error },
    warning: { bg: colors.surfaceTertiary, fg: colors.warning },
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
  };
  const c = map[tone];
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: c.bg,
        paddingVertical: 4,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.sm,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: c.fg, fontSize: fontSize.sm, fontFamily: fonts.medium }}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AppHeader (stack screens)
// ---------------------------------------------------------------------------
export function AppHeader({
  title,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        testID="header-back"
        onPress={() => (onBack ? onBack() : router.back())}
        hitSlop={12}
        style={styles.headerBack}
      >
        <CaretLeft color={colors.onSurface} size={22} weight="bold" />
      </Pressable>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel
// ---------------------------------------------------------------------------
export function SectionLabel({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// MonoBlock — for hashes and IDs
// ---------------------------------------------------------------------------
export function MonoBlock({ value, style, textStyle }: { value: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.monoBlock, style]}>
      <Text selectable style={[styles.monoText, textStyle]}>
        {value}
      </Text>
    </View>
  );
}

export function Divider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

const useStyles = makeStyles((colors) => ({
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontFamily: fonts.semibold, fontSize: fontSize.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.xl },
  headerSubtitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.sm, marginTop: 2 },
  headerRight: { minWidth: 38, alignItems: "flex-end" },
  sectionLabel: {
    color: colors.muted,
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  monoBlock: {
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  monoText: { color: colors.onSurfaceTertiary, fontFamily: fonts.mono, fontSize: 13, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
}));

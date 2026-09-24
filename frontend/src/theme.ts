// Design tokens for RecordioAI. Security / developer-infrastructure aesthetic.
// The app forces dark mode as its primary identity (neon logo on obsidian),
// but both palettes are filled so a future toggle needs no other change.
//
// Colors come from /app/design_guidelines.json. Use makeStyles() for styles and
// useTheme().colors for color props. Never write color literals in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#111827",
  surfaceSecondary: "#F9FAFB",
  onSurfaceSecondary: "#1F2937",
  surfaceTertiary: "#F3F4F6",
  onSurfaceTertiary: "#374151",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#F8FAFC",
  brand: "#4338CA",
  onBrand: "#FFFFFF",
  brandPrimary: "#4F46E5",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E0E7FF",
  onBrandSecondary: "#3730A3",
  brandTertiary: "#EEF2FF",
  onBrandTertiary: "#4338CA",
  success: "#059669",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#9CA3AF",
  divider: "#F3F4F6",
  muted: "#6B7280",
};

const dark: typeof light = {
  surface: "#0B0F19",
  onSurface: "#F9FAFB",
  surfaceSecondary: "#111827",
  onSurfaceSecondary: "#F3F4F6",
  surfaceTertiary: "#1F2937",
  onSurfaceTertiary: "#D1D5DB",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0F172A",
  brand: "#6366F1",
  onBrand: "#FFFFFF",
  brandPrimary: "#6366F1",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3730A3",
  onBrandSecondary: "#E0E7FF",
  brandTertiary: "#1E1B4B",
  onBrandTertiary: "#818CF8",
  success: "#10B981",
  onSuccess: "#052E23",
  warning: "#F59E0B",
  onWarning: "#3B2705",
  error: "#EF4444",
  onError: "#3B0A0A",
  info: "#60A5FA",
  onInfo: "#0B1E3B",
  border: "#1F2937",
  borderStrong: "#4B5563",
  divider: "#111827",
  muted: "#9CA3AF",
};

export type ThemeColors = typeof light;

// Primary identity is dark. Force it app-wide for a consistent security feel.
export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Force dark globally (native chrome + JS).
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  // Read the system value so the hook subscribes to changes, but always resolve
  // to dark — RecordioAI ships a single, deliberate dark identity.
  useColorScheme();
  return { scheme: "dark", colors: dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// ---------------------------------------------------------------------------
// Non-color tokens
// ---------------------------------------------------------------------------
export const fonts = {
  regular: "Geist",
  medium: "GeistMedium",
  semibold: "GeistSemiBold",
  bold: "GeistBold",
  mono: "GeistMono",
  monoMedium: "GeistMonoMedium",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  pill: 999,
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

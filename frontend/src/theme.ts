// Design tokens for Uzlife. Dark "Glass / Luxe" theme (see /app/design_guidelines.json).
// Components import `useTheme()` / `makeStyles` from here. Never create another colors file.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#090C10",
  onSurface: "#F8F9FA",
  surfaceSecondary: "#151922",
  onSurfaceSecondary: "#E1E4E8",
  surfaceTertiary: "#212631",
  onSurfaceTertiary: "#D1D5DB",
  surfaceInverse: "#F3F4F6",
  onSurfaceInverse: "#090C10",
  muted: "#8B95A5",

  brand: "#D4AF37",
  onBrand: "#000000",
  brandPrimary: "#E6B553",
  onBrandPrimary: "#000000",
  brandSecondary: "#B88E3E",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "rgba(230, 181, 83, 0.15)",
  onBrandTertiary: "#E6B553",

  success: "#2E7D32",
  onSuccess: "#FFFFFF",
  warning: "#F57F17",
  onWarning: "#000000",
  error: "#D32F2F",
  onError: "#FFFFFF",
  info: "#1976D2",
  onInfo: "#FFFFFF",

  border: "#2A303C",
  borderStrong: "#3A4354",
  divider: "#1F2532",

  // extras
  glass: "rgba(9, 12, 16, 0.78)",
  glassCard: "rgba(21, 25, 34, 0.80)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  scrimEnd: "rgba(9, 12, 16, 0.92)",
  scrimMid: "rgba(9, 12, 16, 0.45)",
  transparent: "rgba(9, 12, 16, 0)",
  successSoft: "rgba(46, 125, 50, 0.18)",
  errorSoft: "rgba(211, 47, 47, 0.16)",
  liveRed: "#FF5A52",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

// Dark only: both schemes resolve to the same palette.
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" || system === "dark" ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const fonts = {
  display: "Playfair-SemiBold",
  displayBold: "Playfair-Bold",
  displayItalic: "Playfair-Italic",
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

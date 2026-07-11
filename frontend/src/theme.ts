import { Platform, TextStyle } from "react-native";

// =========================================================================
// LUMI DESIGN SYSTEM — Apple Health x Headspace x Finch x Notion Calendar
// =========================================================================

export const colors = {
  bg: "#F9FAF9",          // primary background — near-white with a green whisper
  bgAlt: "#F3F5F3",        // secondary
  card: "#FFFFFF",         // card surfaces
  glass: "rgba(249, 250, 249, 0.75)",

  ink: "#1A1A1A",          // primary text
  inkMuted: "#737373",     // secondary text
  inkFaint: "#A3A3A3",     // tertiary text

  // Brand — Lumi's sage green
  lumi: "#8BA888",
  lumiSoft: "#E2EBE2",
  lumiInk: "#1F2A1F",

  // Mood pastels (glanceable, editorial)
  moodJoy: "#FDF2D5",
  moodCalm: "#E0EFE5",
  moodNeutral: "#EFEFEB",
  moodSad: "#D3CBE7",
  moodAnxious: "#F5C3B8",
  moodBlue: "#C1DCE8",
  moodRose: "#F0C9C9",

  // Category accents (Health-style dot colors)
  catConnection: "#F0B4B4",
  catReflection: "#D3CBE7",
  catMovement: "#B8D9C1",
  catCare: "#F5C3B8",
  catCalm: "#C1DCE8",
  catReset: "#EAE5D9",
  catGrowth: "#D8CFA5",

  // Utility
  border: "#EAEAE7",
  borderStrong: "#D6D6D2",
  success: "#82A97F",
  successInk: "#1F301E",
  error: "#C7807F",
  errorInk: "#5A1A1A",
  warning: "#D9A67A",

  // Streak
  flame: "#E9A54A",
  flameSoft: "#FDF2D5",
};

// Backwards-compat aliases for legacy imports of `theme.colors.*`
const legacyColorAliases = {
  surface: colors.bg,
  onSurface: colors.ink,
  surfaceSecondary: colors.bgAlt,
  onSurfaceSecondary: colors.ink,
  surfaceTertiary: colors.moodNeutral,
  onSurfaceTertiary: colors.inkMuted,
  surfaceInverse: colors.ink,
  onSurfaceInverse: colors.bg,
  brand: colors.lumi,
  brandPrimary: colors.lumi,
  onBrandPrimary: "#FFFFFF",
  brandSecondary: colors.moodAnxious,
  onBrandSecondary: "#3D2418",
  brandTertiary: colors.lumiSoft,
  onBrandTertiary: colors.lumiInk,
  border: colors.border,
  borderStrong: colors.borderStrong,
  divider: colors.border,
  muted: colors.inkFaint,
  info: colors.moodBlue,
  onInfo: "#17232E",
  onError: colors.errorInk,
  onSuccess: colors.successInk,
  onWarning: "#3D2910",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, xxxxl: 64 } as const;

export const radius = { sm: 8, md: 16, lg: 24, xl: 32, pill: 9999 } as const;

const displayFontFamily = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
}) as string;
const bodyFontFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
}) as string;

export const type: Record<
  "display" | "h1" | "h2" | "h3" | "bodyLarge" | "body" | "caption" | "overline" | "number",
  TextStyle
> = {
  display: { fontFamily: displayFontFamily, fontSize: 40, lineHeight: 48, letterSpacing: -0.6, color: colors.ink, fontWeight: "500" },
  h1: { fontFamily: displayFontFamily, fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: colors.ink, fontWeight: "500" },
  h2: { fontFamily: displayFontFamily, fontSize: 24, lineHeight: 32, letterSpacing: -0.3, color: colors.ink, fontWeight: "500" },
  h3: { fontFamily: displayFontFamily, fontSize: 20, lineHeight: 26, color: colors.ink, fontWeight: "500" },
  bodyLarge: { fontFamily: bodyFontFamily, fontSize: 17, lineHeight: 26, color: colors.ink },
  body: { fontFamily: bodyFontFamily, fontSize: 15, lineHeight: 22, color: colors.ink },
  caption: { fontFamily: bodyFontFamily, fontSize: 13, lineHeight: 18, color: colors.inkMuted, letterSpacing: 0.2 },
  overline: { fontFamily: bodyFontFamily, fontSize: 11, lineHeight: 14, color: colors.inkMuted, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" },
  number: { fontFamily: displayFontFamily, fontSize: 34, lineHeight: 40, color: colors.ink, fontWeight: "500", letterSpacing: -0.5 },
};

export const elevation = {
  none: {},
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;

export const motion = { fast: 150, base: 250, slow: 400 };

// Full theme object with legacy aliases for older screens that still reference
// theme.colors.brandPrimary, theme.spacing.xxl, etc.
export const theme = {
  colors: { ...colors, ...legacyColorAliases },
  spacing,
  radius,
  type,
  elevation,
  motion,
  font: { display: displayFontFamily, body: bodyFontFamily },
  // legacy alias
  scale: { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

// =========================================================================
// MOODS — the 7 emotional states, matched to design system pastels
// =========================================================================

export type MoodKey =
  | "great" | "good" | "okay" | "low" | "stuck" | "anxious" | "lonely";

export const MOODS: {
  key: MoodKey;
  label: string;
  emoji: string;
  color: string;
  onColor: string;
}[] = [
  { key: "great",   label: "Great",   emoji: "🌞", color: colors.moodJoy,     onColor: "#4A3812" },
  { key: "good",    label: "Good",    emoji: "🌿", color: colors.moodCalm,    onColor: "#1F3327" },
  { key: "okay",    label: "Okay",    emoji: "🍵", color: colors.moodNeutral, onColor: "#3A3A38" },
  { key: "low",     label: "Low",     emoji: "🌧️", color: colors.moodBlue,    onColor: "#17232E" },
  { key: "stuck",   label: "Stuck",   emoji: "🌀", color: colors.moodSad,     onColor: "#2C2143" },
  { key: "anxious", label: "Anxious", emoji: "🌊", color: colors.moodAnxious, onColor: "#3D2418" },
  { key: "lonely",  label: "Lonely",  emoji: "🌙", color: colors.moodRose,    onColor: "#4A1F1F" },
];

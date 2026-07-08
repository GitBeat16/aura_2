import { Platform } from "react-native";

export const theme = {
  colors: {
    surface: "#FDFBF7",
    onSurface: "#2A2A28",
    surfaceSecondary: "#F5F2EA",
    onSurfaceSecondary: "#3D3D3A",
    surfaceTertiary: "#EAE5D9",
    onSurfaceTertiary: "#5C5C58",
    surfaceInverse: "#2A2A28",
    onSurfaceInverse: "#FDFBF7",
    brand: "#9EADA0",
    brandPrimary: "#9EADA0",
    onBrandPrimary: "#1D261F",
    brandSecondary: "#D8AE99",
    onBrandSecondary: "#302018",
    brandTertiary: "#D9DCE0",
    onBrandTertiary: "#26282B",
    success: "#A7C4A5",
    onSuccess: "#1F301E",
    warning: "#E0C09A",
    onWarning: "#3D2910",
    error: "#D69595",
    onError: "#381414",
    info: "#A6BACC",
    onInfo: "#17232E",
    border: "#EAE5D9",
    borderStrong: "#D1CCC0",
    divider: "#EAE5D9",
    muted: "#8A8A85",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }) as string,
    body: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
  },
  scale: { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
};

export const MOODS: {
  key: "great" | "good" | "okay" | "low" | "stuck" | "anxious" | "lonely";
  label: string;
  emoji: string;
  color: string;
  onColor: string;
}[] = [
  { key: "great", label: "Great", emoji: "🌞", color: "#E0C09A", onColor: "#3D2910" },
  { key: "good", label: "Good", emoji: "🌿", color: "#A7C4A5", onColor: "#1F301E" },
  { key: "okay", label: "Okay", emoji: "🍵", color: "#EAE5D9", onColor: "#5C5C58" },
  { key: "low", label: "Low", emoji: "🌧️", color: "#A6BACC", onColor: "#17232E" },
  { key: "stuck", label: "Stuck", emoji: "🌀", color: "#D9DCE0", onColor: "#26282B" },
  { key: "anxious", label: "Anxious", emoji: "🌊", color: "#D8AE99", onColor: "#302018" },
  { key: "lonely", label: "Lonely", emoji: "🌙", color: "#9EADA0", onColor: "#1D261F" },
];

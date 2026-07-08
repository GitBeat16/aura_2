import { View, Text, StyleSheet, Pressable, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/src/theme";

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.container} testID="onboarding-screen">
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1474540412665-1cdae210ae6b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbWluaW1hbGlzdCUyMHNreSUyMHBhc3RlbHxlbnwwfHx8fDE3ODI4NTA4NTh8MA&ixlib=rb-4.1.0&q=85" }}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(42,42,40,0)", "rgba(42,42,40,0.35)", "rgba(42,42,40,0.85)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.topBadge}>
            <Text style={styles.badgeText}>Aura</Text>
          </View>
          <View style={styles.bottom}>
            <Text style={styles.title}>A quiet place{"\n"}to feel heard.</Text>
            <Text style={styles.subtitle}>
              When you feel lonely, stuck, or heavy — Aura listens and gently guides you toward one small step.
            </Text>
            <Pressable
              testID="onboarding-get-started-button"
              onPress={() => router.push("/(auth)/signup")}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </Pressable>
            <Pressable
              testID="onboarding-signin-link"
              onPress={() => router.push("/(auth)/login")}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>I already have an account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceInverse },
  bg: { flex: 1 },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: theme.spacing.xl },
  topBadge: { marginTop: theme.spacing.md, alignSelf: "flex-start" },
  badgeText: {
    fontFamily: theme.font.display, fontSize: 22, color: theme.colors.onSurfaceInverse,
    letterSpacing: 1,
  },
  bottom: { paddingBottom: theme.spacing.md, gap: theme.spacing.lg },
  title: {
    fontFamily: theme.font.display, fontSize: 38, lineHeight: 44,
    color: theme.colors.onSurfaceInverse, fontWeight: "500",
  },
  subtitle: {
    fontFamily: theme.font.body, fontSize: 16, lineHeight: 24,
    color: "#EDE7DA", opacity: 0.9,
  },
  cta: {
    backgroundColor: theme.colors.brandPrimary, paddingVertical: 18,
    borderRadius: theme.radius.pill, alignItems: "center", marginTop: theme.spacing.sm,
  },
  ctaText: {
    fontFamily: theme.font.body, fontSize: 16, fontWeight: "600",
    color: theme.colors.onBrandPrimary,
  },
  secondary: { alignItems: "center", paddingVertical: theme.spacing.sm },
  secondaryText: {
    fontFamily: theme.font.body, color: theme.colors.onSurfaceInverse,
    opacity: 0.85, fontSize: 14,
  },
});

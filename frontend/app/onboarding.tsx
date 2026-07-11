import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, type } from "@/src/theme";
import { PrimaryButton, TextButton, PillTag } from "@/src/ui";

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="onboarding-screen">
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1627037558426-c2d07beda3af?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxjYWxtaW5nJTIwbWluaW1hbCUyMHBhc3RlbHxlbnwwfHx8fDE3ODM3NDc3NDN8MA&ixlib=rb-4.1.0&q=85" }}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(249,250,249,0.0)", "rgba(249,250,249,0.75)", colors.bg]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <View style={styles.top}>
            <PillTag label="Lumi · your companion" tint={colors.lumiSoft} textColor={colors.lumiInk} />
          </View>

          <View style={styles.bottom}>
            <Text style={styles.title}>A quiet place{"\n"}to feel heard.</Text>
            <Text style={styles.subtitle}>
              When today feels heavy, Lumi listens — and gently guides you toward one small step.
            </Text>

            <View style={styles.ctaCol}>
              <PrimaryButton
                testID="onboarding-get-started-button"
                label="Get Started"
                onPress={() => router.push("/(auth)/signup")}
                iconRight="arrow-right"
              />
              <TextButton
                testID="onboarding-signin-link"
                label="I already have an account"
                onPress={() => router.push("/(auth)/login")}
                tint={colors.inkMuted}
              />
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bg: { flex: 1 },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  top: { marginTop: spacing.md },
  bottom: { paddingBottom: spacing.lg, gap: spacing.lg },
  title: { ...type.display, letterSpacing: -0.8 },
  subtitle: { ...type.bodyLarge, color: colors.inkMuted },
  ctaCol: { gap: spacing.sm, marginTop: spacing.md },
});

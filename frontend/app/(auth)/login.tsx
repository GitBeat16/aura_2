import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            testID="login-back-button"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.onSurface} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome{"\n"}back.</Text>
            <Text style={styles.subtitle}>It's good to see you again.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="you@calm.co"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={theme.colors.muted}
                secureTextEntry
                style={styles.input}
              />
            </View>
            {error && <Text testID="login-error" style={styles.error}>{error}</Text>}

            <Pressable
              testID="login-submit-button"
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
            >
              {loading
                ? <ActivityIndicator color={theme.colors.onBrandPrimary} />
                : <Text style={styles.ctaText}>Sign In</Text>}
            </Pressable>

            <Pressable
              testID="login-goto-signup"
              onPress={() => router.replace("/(auth)/signup")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>New here? <Text style={styles.linkAccent}>Create an account</Text></Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  header: { marginTop: theme.spacing.md, marginBottom: theme.spacing.xl },
  title: { fontFamily: theme.font.display, fontSize: 34, lineHeight: 40, color: theme.colors.onSurface, fontWeight: "500" },
  subtitle: { marginTop: theme.spacing.sm, fontSize: 15, color: theme.colors.onSurfaceTertiary, fontFamily: theme.font.body },
  form: { gap: theme.spacing.lg },
  fieldWrap: { gap: theme.spacing.sm },
  label: { fontSize: 13, color: theme.colors.onSurfaceTertiary, fontFamily: theme.font.body, marginLeft: 4 },
  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16, paddingHorizontal: 18,
    fontSize: 16, color: theme.colors.onSurface, fontFamily: theme.font.body,
  },
  cta: {
    marginTop: theme.spacing.md, backgroundColor: theme.colors.brandPrimary,
    paddingVertical: 18, borderRadius: theme.radius.pill, alignItems: "center",
  },
  ctaText: { fontFamily: theme.font.body, fontSize: 16, fontWeight: "600", color: theme.colors.onBrandPrimary },
  error: { color: theme.colors.error, fontSize: 14, fontFamily: theme.font.body, marginLeft: 4 },
  linkRow: { alignItems: "center", paddingVertical: theme.spacing.sm },
  linkText: { color: theme.colors.onSurfaceTertiary, fontFamily: theme.font.body, fontSize: 14 },
  linkAccent: { color: theme.colors.onSurface, fontWeight: "600" },
});

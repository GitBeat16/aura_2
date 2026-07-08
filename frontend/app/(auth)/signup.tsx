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

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Please fill all fields (password ≥ 6 characters).");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace("/mood-checkin");
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
            testID="signup-back-button"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.onSurface} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Create your{"\n"}safe space.</Text>
            <Text style={styles.subtitle}>A gentle place, just for you.</Text>
          </View>

          <View style={styles.form}>
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Alex" testID="signup-name-input" autoCapitalize="words" />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@calm.co" testID="signup-email-input" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••" testID="signup-password-input" secureTextEntry />
            {error && <Text testID="signup-error" style={styles.error}>{error}</Text>}

            <Pressable
              testID="signup-submit-button"
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85 }]}
            >
              {loading
                ? <ActivityIndicator color={theme.colors.onBrandPrimary} />
                : <Text style={styles.ctaText}>Create Account</Text>}
            </Pressable>

            <Pressable
              testID="signup-goto-login"
              onPress={() => router.replace("/(auth)/login")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign in</Text></Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={theme.colors.muted}
        style={styles.input}
      />
    </View>
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

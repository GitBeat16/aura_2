import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, type, radius } from "@/src/theme";
import { PrimaryButton, TextButton } from "@/src/ui";
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable testID="login-back-button" onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.ink} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.title}>Good to see{"\n"}you again.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
                value={email} onChangeText={setEmail}
                placeholder="you@calm.co"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none" keyboardType="email-address"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="login-password-input"
                value={password} onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry
                style={styles.input}
              />
            </View>
            {error && <Text testID="login-error" style={styles.error}>{error}</Text>}

            <PrimaryButton
              testID="login-submit-button"
              label="Sign In"
              onPress={submit}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />

            <TextButton
              testID="login-goto-signup"
              label="New here? Create an account"
              onPress={() => router.replace("/(auth)/signup")}
              tint={colors.inkMuted}
              style={{ alignSelf: "center", marginTop: spacing.sm }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  header: { marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.sm },
  eyebrow: { ...type.overline },
  title: { ...type.h1, marginTop: 4 },
  form: { gap: spacing.lg },
  fieldWrap: { gap: spacing.sm },
  label: { ...type.caption, marginLeft: 4 },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, paddingHorizontal: 16,
    ...type.body, fontSize: 16, color: colors.ink,
  },
  error: { color: colors.error, ...type.body, marginLeft: 4 },
});

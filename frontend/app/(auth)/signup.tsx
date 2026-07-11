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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable testID="signup-back-button" onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.ink} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.eyebrow}>Create account</Text>
            <Text style={styles.title}>Your safe{"\n"}space starts here.</Text>
            <Text style={styles.subtitle}>A gentle place, just for you.</Text>
          </View>

          <View style={styles.form}>
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Alex" testID="signup-name-input" autoCapitalize="words" />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@calm.co" testID="signup-email-input" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••" testID="signup-password-input" secureTextEntry />
            {error && <Text testID="signup-error" style={styles.error}>{error}</Text>}

            <PrimaryButton
              testID="signup-submit-button"
              label="Create Account"
              onPress={submit}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />

            <TextButton
              testID="signup-goto-login"
              label="Already have an account? Sign in"
              onPress={() => router.replace("/(auth)/login")}
              tint={colors.inkMuted}
              style={{ alignSelf: "center", marginTop: spacing.sm }}
            />
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
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  header: { marginTop: spacing.md, marginBottom: spacing.xl, gap: spacing.sm },
  eyebrow: { ...type.overline },
  title: { ...type.h1, marginTop: 4 },
  subtitle: { ...type.body, color: colors.inkMuted },
  form: { gap: spacing.lg },
  fieldWrap: { gap: spacing.sm },
  label: { ...type.caption, marginLeft: 4 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, paddingHorizontal: 16,
    ...type.body, fontSize: 16, color: colors.ink,
  },
  error: { color: colors.error, ...type.body, marginLeft: 4 },
});

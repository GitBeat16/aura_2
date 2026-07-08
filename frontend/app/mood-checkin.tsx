import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { theme, MOODS } from "@/src/theme";
import { api } from "@/src/api";

export default function MoodCheckin() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      await api.createMood(selected, note.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || "Could not save mood");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.hello}>Take a breath.</Text>
            <Text style={styles.title}>How are you{"\n"}feeling right now?</Text>
            <Text style={styles.subtitle}>There's no wrong answer.</Text>
          </View>

          <View style={styles.grid} testID="mood-grid">
            {MOODS.map((m) => {
              const active = selected === m.key;
              return (
                <Pressable
                  key={m.key}
                  testID={`mood-chip-${m.key}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelected(m.key);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? m.color : theme.colors.surfaceSecondary,
                      borderColor: active ? m.onColor : "transparent" },
                  ]}
                >
                  <Text style={styles.chipEmoji}>{m.emoji}</Text>
                  <Text style={[styles.chipLabel, { color: active ? m.onColor : theme.colors.onSurfaceSecondary }]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.noteWrap}>
            <Text style={styles.noteLabel}>Anything you want to add? (optional)</Text>
            <TextInput
              testID="mood-note-input"
              value={note}
              onChangeText={setNote}
              placeholder="A word or a sentence…"
              placeholderTextColor={theme.colors.muted}
              multiline
              style={styles.note}
            />
          </View>

          {error && <Text testID="mood-error" style={styles.error}>{error}</Text>}

          <Pressable
            testID="mood-submit-button"
            onPress={submit}
            disabled={!selected || loading}
            style={({ pressed }) => [
              styles.cta,
              (!selected || loading) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {loading ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Continue</Text>}
          </Pressable>

          <Pressable
            testID="mood-skip-button"
            onPress={() => router.replace("/(tabs)/home")}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  scroll: { flexGrow: 1, paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  header: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl },
  hello: { fontFamily: theme.font.body, color: theme.colors.onSurfaceTertiary, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: theme.spacing.sm },
  title: { fontFamily: theme.font.display, fontSize: 32, lineHeight: 38, color: theme.colors.onSurface, fontWeight: "500" },
  subtitle: { marginTop: theme.spacing.sm, fontSize: 15, color: theme.colors.onSurfaceTertiary, fontFamily: theme.font.body },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  chip: {
    width: "47%",
    paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg, borderWidth: 1.5,
    flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
  },
  chipEmoji: { fontSize: 22 },
  chipLabel: { fontFamily: theme.font.body, fontSize: 16, fontWeight: "600" },
  noteWrap: { marginTop: theme.spacing.xl, gap: theme.spacing.sm },
  noteLabel: { color: theme.colors.onSurfaceTertiary, fontFamily: theme.font.body, fontSize: 13, marginLeft: 4 },
  note: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg,
    padding: 16, minHeight: 96, color: theme.colors.onSurface, fontFamily: theme.font.body, fontSize: 15, textAlignVertical: "top",
  },
  error: { color: theme.colors.error, fontFamily: theme.font.body, marginTop: theme.spacing.md, textAlign: "center" },
  cta: {
    marginTop: theme.spacing.xl, backgroundColor: theme.colors.brandPrimary,
    paddingVertical: 18, borderRadius: theme.radius.pill, alignItems: "center",
  },
  ctaText: { fontFamily: theme.font.body, fontSize: 16, fontWeight: "600", color: theme.colors.onBrandPrimary },
  skip: { alignItems: "center", paddingVertical: theme.spacing.md, marginTop: theme.spacing.sm },
  skipText: { color: theme.colors.onSurfaceTertiary, fontFamily: theme.font.body, fontSize: 14 },
});

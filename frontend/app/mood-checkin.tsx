import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, type, radius, MOODS } from "@/src/theme";
import { PrimaryButton, TextButton } from "@/src/ui";
import { api } from "@/src/api";
import { playSfx } from "@/src/utils/sounds";

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
      api.regenerateActions().catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSfx("chime", 0.6);
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
            <Text style={styles.eyebrow}>Take a breath</Text>
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    playSfx("tap", 0.5);
                    setSelected(m.key);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? m.color : colors.card,
                      borderColor: active ? m.onColor : colors.border },
                  ]}
                >
                  <Text style={styles.chipEmoji}>{m.emoji}</Text>
                  <Text style={[styles.chipLabel, { color: active ? m.onColor : colors.ink }]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.noteWrap}>
            <Text style={styles.noteLabel}>Anything you'd like to add? (optional)</Text>
            <TextInput
              testID="mood-note-input"
              value={note}
              onChangeText={setNote}
              placeholder="A word or a sentence…"
              placeholderTextColor={colors.inkFaint}
              multiline
              style={styles.note}
            />
          </View>

          {error && <Text testID="mood-error" style={styles.error}>{error}</Text>}

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton
              testID="mood-submit-button"
              label="Continue"
              onPress={submit}
              loading={loading}
              disabled={!selected}
              iconRight="arrow-right"
            />
            <TextButton
              testID="mood-skip-button"
              label="Skip for now"
              onPress={() => router.replace("/(tabs)/home")}
              tint={colors.inkMuted}
              style={{ alignSelf: "center" }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.xl },
  eyebrow: { ...type.overline },
  title: { ...type.h1, marginTop: 4 },
  subtitle: { ...type.body, color: colors.inkMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  chip: {
    width: "47%",
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  chipEmoji: { fontSize: 22 },
  chipLabel: { ...type.body, fontSize: 16, fontWeight: "600" },
  noteWrap: { marginTop: spacing.xl, gap: spacing.sm },
  noteLabel: { ...type.caption, marginLeft: 4 },
  note: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, minHeight: 96,
    ...type.body, color: colors.ink, textAlignVertical: "top",
  },
  error: { color: colors.error, ...type.body, marginTop: spacing.md, textAlign: "center" },
});

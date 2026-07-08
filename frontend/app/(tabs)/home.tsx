import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { theme, MOODS } from "@/src/theme";
import { api, DailyAction, Mood, SocialSuggestion } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [mood, setMood] = useState<Mood | null>(null);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [social, setSocial] = useState<SocialSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, a, s] = await Promise.all([
        api.latestMood().catch(() => null),
        api.dailyActions(),
        api.socialSuggestions(),
      ]);
      setMood(m);
      setActions(a);
      setSocial(s);
    } catch (e) {
      // fail silent
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleAction = async (a: DailyAction) => {
    if (a.completed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActions((prev) => prev.map((x) => x.title === a.title ? { ...x, completed: true } : x));
    try { await api.completeAction(a.title); } catch {}
  };

  const moodMeta = MOODS.find((m) => m.key === mood?.mood);
  const greeting = getGreeting();
  const firstName = (user?.name || "friend").split(" ")[0];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{greeting}</Text>
            <Text style={styles.name}>{firstName}.</Text>
          </View>
          <Pressable
            testID="home-checkin-button"
            onPress={() => router.push("/mood-checkin")}
            style={styles.checkinBtn}
          >
            <Feather name="edit-2" size={14} color={theme.colors.onSurface} />
            <Text style={styles.checkinText}>Check-in</Text>
          </Pressable>
        </View>

        {/* Mood recap */}
        {mood && moodMeta ? (
          <View testID="home-mood-recap" style={[styles.moodRecap, { backgroundColor: moodMeta.color }]}>
            <Text style={styles.moodEmoji}>{moodMeta.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.moodLabel, { color: moodMeta.onColor }]}>You're feeling {moodMeta.label.toLowerCase()}</Text>
              <Text style={[styles.moodHint, { color: moodMeta.onColor, opacity: 0.75 }]}>
                Here's a gentle path for right now.
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            testID="home-no-mood-cta"
            onPress={() => router.push("/mood-checkin")}
            style={styles.noMoodCard}
          >
            <Text style={styles.noMoodTitle}>How are you today?</Text>
            <Text style={styles.noMoodSub}>Tap to check-in — takes 15 seconds.</Text>
          </Pressable>
        )}

        {/* Chat CTA */}
        <Pressable
          testID="home-chat-cta"
          onPress={() => router.push("/(tabs)/chat")}
          style={styles.chatCta}
        >
          <LinearGradient
            colors={[theme.colors.surface, theme.colors.brandTertiary + "40"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.chatCtaInner}>
            <View style={styles.chatIcon}>
              <Feather name="message-circle" size={20} color={theme.colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatTitle}>Talk to Lumi</Text>
              <Text style={styles.chatSub}>I'm here to listen, whenever you need me.</Text>
            </View>
            <Feather name="arrow-right" size={20} color={theme.colors.onSurfaceTertiary} />
          </View>
        </Pressable>

        {/* Daily actions */}
        <Section title="Small steps for today" subtitle="One at a time. No pressure." />
        <View style={styles.actionsList}>
          {actions.map((a) => (
            <Pressable
              key={a.id}
              testID={`action-card-${a.id}`}
              onPress={() => toggleAction(a)}
              style={[styles.actionCard, a.completed && styles.actionCardDone]}
            >
              <View style={[styles.actionIcon, a.completed && { backgroundColor: theme.colors.success }]}>
                <Feather name={a.completed ? "check" : (a.icon as any)} size={16} color={a.completed ? theme.colors.onSuccess : theme.colors.onSurface} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, a.completed && styles.actionTitleDone]}>{a.title}</Text>
                <Text style={styles.actionDesc}>{a.description}</Text>
              </View>
              <View style={styles.durationPill}>
                <Text style={styles.durationText}>{a.duration_minutes}m</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Social suggestions */}
        <Section title="A little reach-out" subtitle="Connection is a small thing that helps." />
        <View style={styles.socialList}>
          {social.map((s) => (
            <View key={s.id} testID={`social-card-${s.id}`} style={styles.socialCard}>
              <View style={styles.socialIcon}>
                <Feather name={s.icon as any} size={16} color={theme.colors.onSurface} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.socialTitle}>{s.title}</Text>
                <Text style={styles.socialDesc}>{s.description}</Text>
                <View style={styles.promptBubble}>
                  <Text style={styles.promptText}>"{s.prompt}"</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: theme.spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night,";
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  if (h < 21) return "Good evening,";
  return "Rest easy,";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: theme.spacing.xl },
  hello: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.onSurfaceTertiary },
  name: { fontFamily: theme.font.display, fontSize: 30, color: theme.colors.onSurface, fontWeight: "500", marginTop: 2 },
  checkinBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.surfaceSecondary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.pill,
  },
  checkinText: { fontFamily: theme.font.body, fontSize: 13, fontWeight: "600", color: theme.colors.onSurface },
  moodRecap: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
    padding: theme.spacing.lg, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg,
  },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontFamily: theme.font.display, fontSize: 18, fontWeight: "500" },
  moodHint: { fontFamily: theme.font.body, fontSize: 13, marginTop: 2 },
  noMoodCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.lg, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg,
  },
  noMoodTitle: { fontFamily: theme.font.display, fontSize: 18, color: theme.colors.onSurface, fontWeight: "500" },
  noMoodSub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 4 },
  chatCta: {
    borderRadius: theme.radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  chatCtaInner: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  chatIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  chatTitle: { fontFamily: theme.font.display, fontSize: 18, color: theme.colors.onSurface, fontWeight: "500" },
  chatSub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  section: { marginBottom: theme.spacing.md, marginTop: theme.spacing.sm },
  sectionTitle: { fontFamily: theme.font.display, fontSize: 20, color: theme.colors.onSurface, fontWeight: "500" },
  sectionSubtitle: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  actionsList: { gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg,
  },
  actionCardDone: { opacity: 0.65 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  actionTitle: { fontFamily: theme.font.body, fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  actionTitleDone: { textDecorationLine: "line-through" },
  actionDesc: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  durationPill: {
    backgroundColor: theme.colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill,
  },
  durationText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onSurfaceTertiary, fontWeight: "600" },
  socialList: { gap: theme.spacing.md },
  socialCard: {
    flexDirection: "row", gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg,
  },
  socialIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  socialTitle: { fontFamily: theme.font.body, fontSize: 15, fontWeight: "700", color: theme.colors.onSurface },
  socialDesc: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  promptBubble: {
    marginTop: theme.spacing.md, backgroundColor: theme.colors.surface,
    padding: theme.spacing.md, borderRadius: theme.radius.md,
  },
  promptText: { fontFamily: theme.font.body, fontSize: 13, fontStyle: "italic", color: theme.colors.onSurface, lineHeight: 20 },
});

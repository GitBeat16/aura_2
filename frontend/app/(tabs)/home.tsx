import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, type, radius, MOODS } from "@/src/theme";
import { api, DailyAction, Mood, SocialSuggestion } from "@/src/api";
import { useAuth } from "@/src/auth";
import { playSfx } from "@/src/utils/sounds";
import {
  Card, SectionHeader, IconButton, PillTag, EmptyState,
} from "@/src/ui";

const CATEGORY_ACCENT: Record<string, string> = {
  connection: colors.catConnection,
  reflection: colors.catReflection,
  movement: colors.catMovement,
  care: colors.catCare,
  calm: colors.catCalm,
  reset: colors.catReset,
  growth: colors.catGrowth,
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [mood, setMood] = useState<Mood | null>(null);
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [social, setSocial] = useState<SocialSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingTasks, setRefreshingTasks] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, a, s] = await Promise.all([
        api.latestMood().catch(() => null),
        api.dailyActions(),
        api.socialSuggestions(),
      ]);
      setMood(m); setActions(a); setSocial(s);
    } catch { /* silent */ }
  }, []);

  const regenerateTasks = useCallback(async () => {
    setRefreshingTasks(true);
    playSfx("tap", 0.5);
    try {
      const fresh = await api.regenerateActions();
      setActions(fresh);
      playSfx("chime", 0.5);
    } catch {} finally { setRefreshingTasks(false); }
  }, []);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggleAction = async (a: DailyAction) => {
    if (a.completed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSfx("pop", 0.6);
    setActions((prev) => prev.map((x) => x.title === a.title ? { ...x, completed: true } : x));
    try { await api.completeAction(a.title); } catch {}
  };

  const moodMeta = MOODS.find((m) => m.key === mood?.mood);
  const greeting = getGreeting();
  const firstName = (user?.name || "friend").split(" ")[0];
  const doneCount = actions.filter((a) => a.completed).length;

  if (loading) {
    return (
      <View style={styles.centerAll}>
        <ActivityIndicator color={colors.lumi} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lumi} />}
      >
        {/* Greeting */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{greeting}</Text>
            <Text style={styles.name}>{firstName}.</Text>
          </View>
          <IconButton
            testID="home-checkin-button"
            icon="edit-2"
            onPress={() => router.push("/mood-checkin")}
            size={44}
            tint={colors.card}
          />
        </View>

        {/* Mood recap or invite */}
        {mood && moodMeta ? (
          <Card
            testID="home-mood-recap"
            tone="default"
            style={[styles.moodCard, { backgroundColor: moodMeta.color, ...noShadow }]}
            padding={spacing.xl}
          >
            <View style={styles.moodTop}>
              <PillTag label="Today's check-in" tint="rgba(255,255,255,0.5)" textColor={moodMeta.onColor} />
              <Text style={[styles.moodEmoji]}>{moodMeta.emoji}</Text>
            </View>
            <Text style={[styles.moodTitle, { color: moodMeta.onColor }]}>You're feeling {moodMeta.label.toLowerCase()}.</Text>
            <Text style={[styles.moodHint, { color: moodMeta.onColor, opacity: 0.75 }]}>
              Here's a gentle path shaped for right now.
            </Text>
          </Card>
        ) : (
          <Pressable
            testID="home-no-mood-cta"
            onPress={() => router.push("/mood-checkin")}
          >
            <Card style={styles.noMoodCard} tone="tinted">
              <View style={styles.noMoodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noMoodTitle}>How are you today?</Text>
                  <Text style={styles.noMoodSub}>Tap to check-in — takes 15 seconds.</Text>
                </View>
                <Feather name="arrow-right" size={20} color={colors.lumiInk} />
              </View>
            </Card>
          </Pressable>
        )}

        {/* Talk to Lumi CTA */}
        <Pressable testID="home-chat-cta" onPress={() => router.push("/(tabs)/chat")} style={styles.lumiCtaWrap}>
          <Card style={styles.lumiCta} tone="tinted">
            <View style={styles.lumiCtaRow}>
              <View style={styles.lumiCircle}>
                <View style={styles.lumiCircleInner} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lumiCtaTitle}>Talk to Lumi</Text>
                <Text style={styles.lumiCtaSub}>I'm here to listen, whenever you need me.</Text>
              </View>
              <Feather name="arrow-up-right" size={20} color={colors.lumiInk} />
            </View>
          </Card>
        </Pressable>

        {/* Music CTA */}
        <Pressable testID="home-music-cta" onPress={() => router.push("/(tabs)/music")} style={styles.lumiCtaWrap}>
          <Card style={styles.lumiCta}>
            <View style={styles.lumiCtaRow}>
              <View style={[styles.lumiCircle, { backgroundColor: "#1DB954" }]}>
                <Feather name="music" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lumiCtaTitle}>Music for how you feel</Text>
                <Text style={styles.lumiCtaSub}>Shaped by mood, weather, and time of day.</Text>
              </View>
              <Feather name="arrow-up-right" size={20} color={colors.ink} />
            </View>
          </Card>
        </Pressable>

        {/* Daily actions */}
        <SectionHeader
          title="Small steps"
          caption={
            actions.length > 0
              ? `${doneCount}/${actions.length} completed${mood ? ` · shaped by your ${moodMeta?.label.toLowerCase()} check-in` : ""}`
              : "One at a time. No pressure."
          }
          right={
            <IconButton
              testID="home-regen-tasks-button"
              icon={refreshingTasks ? "loader" : "refresh-cw"}
              size={38}
              tint={colors.bgAlt}
              onPress={regenerateTasks}
              disabled={refreshingTasks}
            />
          }
        />
        <View style={styles.actionsList}>
          {actions.map((a) => {
            const accent = CATEGORY_ACCENT[a.category] || colors.lumiSoft;
            return (
              <Pressable
                key={a.id}
                testID={`action-card-${a.id}`}
                onPress={() => toggleAction(a)}
              >
                <Card style={styles.actionCard} padding={spacing.lg}>
                  <View style={styles.actionInner}>
                    <View style={[styles.actionIcon, { backgroundColor: a.completed ? colors.success : accent }]}>
                      <Feather
                        name={a.completed ? "check" : (a.icon as any)}
                        size={16}
                        color={a.completed ? "#FFFFFF" : colors.ink}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionTitle, a.completed && styles.actionTitleDone]}>{a.title}</Text>
                      <Text style={styles.actionDesc}>{a.description}</Text>
                    </View>
                    <View style={styles.durationPill}>
                      <Text style={styles.durationText}>{a.duration_minutes}m</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {actions.length === 0 && <EmptyState title="No tasks yet" subtitle="Check in with a mood to get personalized steps." icon="feather" />}
        </View>

        {/* Social suggestions */}
        <SectionHeader title="A little reach-out" caption="Connection is a small thing that helps." />
        <View style={styles.socialList}>
          {social.map((s) => (
            <Card key={s.id} testID={`social-card-${s.id}`} style={styles.socialCard}>
              <View style={styles.socialTop}>
                <View style={styles.socialIcon}>
                  <Feather name={s.icon as any} size={16} color={colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.socialTitle}>{s.title}</Text>
                  <Text style={styles.socialDesc}>{s.description}</Text>
                </View>
              </View>
              <View style={styles.promptBubble}>
                <Text style={styles.promptText}>"{s.prompt}"</Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Rest easy";
}

const noShadow = { shadowOpacity: 0, elevation: 0 };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerAll: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 0, paddingTop: spacing.md, paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, marginBottom: spacing.xl,
  },
  eyebrow: { ...type.overline },
  name: { ...type.h1, marginTop: 4 },
  moodCard: {
    marginHorizontal: spacing.xl,
    gap: spacing.md,
  },
  moodTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moodEmoji: { fontSize: 28 },
  moodTitle: { ...type.h2, fontSize: 22, lineHeight: 28 },
  moodHint: { ...type.body },
  noMoodCard: { marginHorizontal: spacing.xl },
  noMoodRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  noMoodTitle: { ...type.h3 },
  noMoodSub: { ...type.caption, marginTop: 2 },
  lumiCtaWrap: { paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm },
  lumiCta: {},
  lumiCtaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lumiCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lumi,
    alignItems: "center", justifyContent: "center",
  },
  lumiCircleInner: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lumiSoft,
  },
  lumiCtaTitle: { ...type.h3, fontSize: 18 },
  lumiCtaSub: { ...type.caption, marginTop: 2 },
  actionsList: { paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.md },
  actionCard: { backgroundColor: colors.card },
  actionInner: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  actionTitle: { ...type.body, fontSize: 15, fontWeight: "600" },
  actionTitleDone: { textDecorationLine: "line-through", color: colors.inkMuted },
  actionDesc: { ...type.caption, marginTop: 2 },
  durationPill: {
    backgroundColor: colors.bgAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  durationText: { ...type.caption, color: colors.ink, fontWeight: "700" },
  socialList: { paddingHorizontal: spacing.xl, gap: spacing.md },
  socialCard: { gap: spacing.md },
  socialTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  socialIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgAlt,
    alignItems: "center", justifyContent: "center",
  },
  socialTitle: { ...type.body, fontSize: 15, fontWeight: "700" },
  socialDesc: { ...type.caption, marginTop: 2 },
  promptBubble: {
    backgroundColor: colors.bgAlt, padding: spacing.md, borderRadius: radius.md,
  },
  promptText: { ...type.body, fontSize: 13, fontStyle: "italic", color: colors.ink, lineHeight: 20 },
});

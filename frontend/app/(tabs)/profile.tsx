import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Share, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, spacing, type, radius, MOODS } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { api, Mood, TaskStreak, WeeklyRecap } from "@/src/api";
import {
  Card, SectionHeader, MetricCard, StreakBadge, PrimaryButton, SecondaryButton, EmptyState, IconButton,
} from "@/src/ui";

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [streaks, setStreaks] = useState<TaskStreak[]>([]);
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, st, rc] = await Promise.all([
        api.listMoods().catch(() => []),
        api.taskStreaks().catch(() => []),
        api.weeklyRecap().catch(() => null),
      ]);
      setMoods(m); setStreaks(st); setRecap(rc);
    } catch {}
    setLoadingRecap(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const initials = (user?.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const daysStreak = calcStreak(moods);

  const handleShareRecap = async () => {
    if (!recap) return;
    try {
      await Share.share({ message: recap.share_text });
    } catch {}
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lumi} />}
      >
        {/* User header */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>
          <IconButton
            testID="profile-signout-button"
            icon="log-out"
            onPress={handleSignOut}
            size={40}
            tint={colors.bgAlt}
          />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <MetricCard
            testID="profile-metric-checkins"
            value={String(moods.length)}
            label="Check-ins"
            icon="edit-2"
            tint={colors.moodCalm}
          />
          <MetricCard
            testID="profile-metric-streak"
            value={String(daysStreak)}
            label="Day streak"
            icon="zap"
            tint={colors.flameSoft}
          />
        </View>

        {/* Weekly Recap */}
        <SectionHeader
          title="This week"
          caption={recap ? `${recap.week_start} → ${recap.week_end}` : "A little reflection from Lumi"}
        />
        <View style={styles.padH}>
          {loadingRecap ? (
            <Card><ActivityIndicator color={colors.lumi} /></Card>
          ) : recap ? (
            <Card testID="profile-weekly-recap" style={styles.recapCard}>
              <View style={styles.recapNumbers}>
                <RecapStat value={recap.tasks_completed} label="Steps" />
                <View style={styles.recapDivider} />
                <RecapStat value={`${recap.days_active}/7`} label="Days" />
                <View style={styles.recapDivider} />
                <RecapStat value={recap.longest_daily_streak} label="Streak" />
              </View>

              <View style={styles.reflectionBlock}>
                <Feather name="message-circle" size={14} color={colors.lumiInk} />
                <Text style={styles.reflectionText}>{recap.reflection}</Text>
              </View>

              <View style={styles.recapButtons}>
                <SecondaryButton
                  testID="profile-share-recap"
                  label="Share this reflection"
                  icon="share-2"
                  onPress={handleShareRecap}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <EmptyState title="Your recap will bloom here." subtitle="Check in and finish a step to start your week." icon="feather" />
            </Card>
          )}
        </View>

        {/* Task Streaks */}
        <SectionHeader
          title="Habit streaks"
          caption={streaks.length ? "Small things, quietly repeated." : undefined}
        />
        <View style={styles.padH}>
          {streaks.length === 0 ? (
            <Card>
              <EmptyState
                title="No streaks yet"
                subtitle="Complete the same small step across two days to start a streak."
                icon="zap"
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {streaks.slice(0, 8).map((s) => (
                <Card key={s.title} testID={`streak-${s.title}`} padding={spacing.md}>
                  <View style={styles.streakRow}>
                    <View style={[styles.streakIcon, { opacity: s.is_active ? 1 : 0.55 }]}>
                      <Feather name={s.icon as any} size={16} color={colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.streakTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={styles.streakSub}>
                        {s.total_completions}× completed
                        {s.is_active ? "" : " · streak paused"}
                      </Text>
                    </View>
                    <StreakBadge count={s.current_streak} active={s.is_active} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Recent moods */}
        <SectionHeader title="Recent moods" />
        <View style={styles.padH}>
          {moods.length === 0 ? (
            <Card>
              <EmptyState title="Your check-ins will appear here." icon="sun" />
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {moods.slice(0, 8).map((m) => {
                const meta = MOODS.find((x) => x.key === m.mood);
                return (
                  <Card key={m.id} testID={`profile-mood-${m.id}`} padding={spacing.md}>
                    <View style={styles.moodRow}>
                      <View style={[styles.moodDot, { backgroundColor: meta?.color || colors.bgAlt }]}>
                        <Text style={styles.moodEmoji}>{meta?.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.moodLabel}>{meta?.label || m.mood}</Text>
                        <Text style={styles.moodDate}>{formatDate(m.created_at)}</Text>
                      </View>
                      {m.note ? <Text style={styles.moodNote} numberOfLines={1}>{m.note}</Text> : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={[styles.padH, { marginTop: spacing.xl, gap: spacing.sm }]}>
          <PrimaryButton
            testID="profile-link-checkin"
            label="New check-in"
            icon="edit-2"
            onPress={() => router.push("/mood-checkin")}
          />
        </View>

        <Text style={styles.footer}>Lumi is a gentle companion — not a substitute for professional care.</Text>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function RecapStat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.recapStatBox}>
      <Text style={styles.recapValue}>{value}</Text>
      <Text style={styles.recapLabel}>{label}</Text>
    </View>
  );
}

function calcStreak(moods: Mood[]): number {
  if (!moods.length) return 0;
  const days = new Set(moods.map((m) => new Date(m.created_at).toISOString().slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  padH: { paddingHorizontal: spacing.xl },
  headerRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.xl, marginBottom: spacing.xl,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lumi,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "600", fontFamily: type.h3.fontFamily },
  name: { ...type.h3 },
  emailText: { ...type.caption, marginTop: 2 },
  statsRow: {
    flexDirection: "row", gap: spacing.md,
    paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  recapCard: { gap: spacing.lg },
  recapNumbers: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  recapStatBox: { flex: 1, alignItems: "center", gap: 4 },
  recapValue: { ...type.number, fontSize: 28, lineHeight: 32 },
  recapLabel: { ...type.overline, fontSize: 10 },
  recapDivider: { width: 1, height: 36, backgroundColor: colors.border, marginHorizontal: 4 },
  reflectionBlock: {
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    backgroundColor: colors.lumiSoft, padding: spacing.md, borderRadius: radius.md,
  },
  reflectionText: { flex: 1, ...type.body, color: colors.lumiInk, fontStyle: "italic", lineHeight: 22 },
  recapButtons: { gap: spacing.sm },

  streakRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  streakIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgAlt,
    alignItems: "center", justifyContent: "center",
  },
  streakTitle: { ...type.body, fontSize: 14, fontWeight: "600" },
  streakSub: { ...type.caption, marginTop: 2, fontSize: 12 },

  moodRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  moodDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  moodEmoji: { fontSize: 16 },
  moodLabel: { ...type.body, fontSize: 14, fontWeight: "600" },
  moodDate: { ...type.caption, marginTop: 2 },
  moodNote: { ...type.caption, fontStyle: "italic", maxWidth: 120, textAlign: "right" },

  footer: { ...type.caption, textAlign: "center", marginTop: spacing.xl, paddingHorizontal: spacing.xl },
});

import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme, MOODS } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { api, Mood } from "@/src/api";

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [moods, setMoods] = useState<Mood[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await api.listMoods();
      setMoods(list);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const initials = (user?.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const streak = calcStreak(moods);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Check-ins" value={String(moods.length)} />
          <Stat label="Day streak" value={String(streak)} />
          <Stat label="Since" value={joinedMonth(user?.created_at)} />
        </View>

        <Section title="Recent moods" />
        {moods.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Your check-ins will appear here.</Text>
          </View>
        ) : (
          <View style={styles.moodList}>
            {moods.slice(0, 10).map((m) => {
              const meta = MOODS.find((x) => x.key === m.mood);
              return (
                <View key={m.id} testID={`profile-mood-${m.id}`} style={styles.moodRow}>
                  <View style={[styles.moodDot, { backgroundColor: meta?.color || theme.colors.surfaceTertiary }]}>
                    <Text style={styles.moodDotEmoji}>{meta?.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moodRowLabel}>{meta?.label || m.mood}</Text>
                    <Text style={styles.moodRowDate}>{formatDate(m.created_at)}</Text>
                  </View>
                  {m.note ? <Text style={styles.moodNote} numberOfLines={1}>{m.note}</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        <Section title="Aura" />
        <View style={styles.linkList}>
          <LinkRow icon="edit-2" label="New check-in" onPress={() => router.push("/mood-checkin")} testID="profile-link-checkin" />
          <LinkRow icon="log-out" label="Sign out" onPress={handleSignOut} testID="profile-signout-button" destructive />
        </View>

        <Text style={styles.footer}>Aura is a gentle companion — not a substitute for professional care.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function LinkRow({ icon, label, onPress, testID, destructive }: { icon: any; label: string; onPress: () => void; testID: string; destructive?: boolean }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.linkRow}>
      <Feather name={icon} size={18} color={destructive ? theme.colors.error : theme.colors.onSurface} />
      <Text style={[styles.linkText, destructive && { color: theme.colors.error }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={theme.colors.onSurfaceTertiary} />
    </Pressable>
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
function joinedMonth(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  scroll: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontFamily: theme.font.display, fontSize: 22, color: theme.colors.onBrandPrimary, fontWeight: "600" },
  name: { fontFamily: theme.font.display, fontSize: 22, color: theme.colors.onSurface, fontWeight: "500" },
  email: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  statBox: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg, alignItems: "center" },
  statValue: { fontFamily: theme.font.display, fontSize: 24, color: theme.colors.onSurface, fontWeight: "500" },
  statLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.onSurfaceTertiary, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },
  section: { fontFamily: theme.font.display, fontSize: 18, color: theme.colors.onSurface, fontWeight: "500", marginBottom: theme.spacing.md, marginTop: theme.spacing.sm },
  emptyBox: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, alignItems: "center" },
  emptyText: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary },
  moodList: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  moodRow: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.lg,
  },
  moodDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  moodDotEmoji: { fontSize: 18 },
  moodRowLabel: { fontFamily: theme.font.body, fontSize: 14, fontWeight: "700", color: theme.colors.onSurface },
  moodRowDate: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onSurfaceTertiary },
  moodNote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onSurfaceTertiary, maxWidth: 120, fontStyle: "italic" },
  linkList: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  linkRow: {
    flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg,
  },
  linkText: { flex: 1, fontFamily: theme.font.body, fontSize: 15, color: theme.colors.onSurface, fontWeight: "600" },
  footer: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onSurfaceTertiary, textAlign: "center", marginTop: theme.spacing.lg, lineHeight: 18 },
});

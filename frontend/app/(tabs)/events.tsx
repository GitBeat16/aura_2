import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, type, radius } from "@/src/theme";
import { api, EventItem } from "@/src/api";
import { GlassBar, ChipRow, Card, EmptyState, PillTag } from "@/src/ui";

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [selected, setSelected] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (cat: string) => {
    try {
      const [ev, cats] = await Promise.all([api.events(cat), api.eventCategories()]);
      setEvents(ev); setCategories(cats.categories);
    } catch {}
  }, []);

  useEffect(() => { (async () => { setLoading(true); await load(selected); setLoading(false); })(); }, [selected, load]);

  const onRefresh = async () => { setRefreshing(true); await load(selected); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <GlassBar
        subtitle="Discover"
        title="A place to show up."
      >
        <ChipRow items={categories} selected={selected} onSelect={setSelected} testIDPrefix="events-chip" />
      </GlassBar>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lumi} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.lumi} />
          </View>
        ) : events.length === 0 ? (
          <EmptyState title="No events here yet" subtitle="Try another category." icon="calendar" />
        ) : (
          events.map((e) => <EventCard key={e.id} event={e} />)
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({ event }: { event: EventItem }) {
  return (
    <Card testID={`event-card-${event.id}`} padding={0} style={{ overflow: "hidden" }}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: event.image_url }} style={styles.image} contentFit="cover" />
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{event.date.split(",")[0]}</Text>
          <Text style={styles.dateBadgeSub}>{event.date.split(",")[1]?.trim() || event.time}</Text>
        </View>
        {event.is_virtual && (
          <View style={styles.virtualBadge}>
            <Feather name="video" size={12} color="#FFFFFF" />
            <Text style={styles.virtualText}>Virtual</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <PillTag label={event.category} tint={colors.bgAlt} />
        <Text style={styles.cardTitle}>{event.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{event.description}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color={colors.inkMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={colors.inkMuted} />
            <Text style={styles.metaText}>{event.time}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.attendees}>{event.attendees} going</Text>
          <Pressable testID={`event-join-${event.id}`} style={styles.joinBtn}>
            <Text style={styles.joinText}>Join</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  center: { paddingVertical: 60, alignItems: "center" },
  imageWrap: { height: 180, position: "relative" },
  image: { width: "100%", height: "100%" },
  dateBadge: {
    position: "absolute", top: spacing.md, left: spacing.md,
    backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.sm, alignItems: "center",
  },
  dateBadgeText: { ...type.overline, color: colors.ink, fontWeight: "700" },
  dateBadgeSub: { ...type.caption, color: colors.inkMuted, fontSize: 11 },
  virtualBadge: {
    position: "absolute", top: spacing.md, right: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(26,26,26,0.85)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  virtualText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  body: { padding: spacing.lg, gap: spacing.xs },
  cardTitle: { ...type.h3, fontSize: 18, marginTop: spacing.sm },
  cardDesc: { ...type.caption, color: colors.inkMuted, lineHeight: 20, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...type.caption, maxWidth: 140 },
  cardFooter: {
    marginTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  attendees: { ...type.caption },
  joinBtn: {
    backgroundColor: colors.ink, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
  },
  joinText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});

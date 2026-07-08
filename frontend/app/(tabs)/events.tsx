import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { api, EventItem } from "@/src/api";

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [selected, setSelected] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (cat: string) => {
    try {
      const [ev, cats] = await Promise.all([api.events(cat), api.eventCategories()]);
      setEvents(ev);
      setCategories(cats.categories);
    } catch {}
  }, []);

  useEffect(() => { (async () => { setLoading(true); await load(selected); setLoading(false); })(); }, [selected, load]);

  const onRefresh = async () => { setRefreshing(true); await load(selected); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Discover</Text>
            <Text style={styles.title}>A place to show up.</Text>
          </View>
        </View>

        {/* Chip row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {categories.map((c) => {
            const active = selected === c;
            return (
              <Pressable
                key={c}
                testID={`events-chip-${c.toLowerCase()}`}
                onPress={() => setSelected(c)}
                style={[
                  styles.chip,
                  active ? { backgroundColor: theme.colors.surfaceInverse, borderColor: theme.colors.surfaceInverse }
                         : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? theme.colors.onSurfaceInverse : theme.colors.onSurface }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.brandPrimary} />
          </View>
        ) : events.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No events here yet.</Text>
            <Text style={styles.emptySub}>Try another category.</Text>
          </View>
        ) : (
          events.map((e) => <EventCard key={e.id} event={e} />)
        )}
        <View style={{ height: theme.spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({ event }: { event: EventItem }) {
  return (
    <View testID={`event-card-${event.id}`} style={styles.card}>
      <View style={styles.cardImageWrap}>
        <Image source={{ uri: event.image_url }} style={styles.cardImage} contentFit="cover" />
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
            <Feather name="video" size={12} color={theme.colors.onSurfaceInverse} />
            <Text style={styles.virtualText}>Virtual</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{event.category}</Text>
        <Text style={styles.cardTitle}>{event.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{event.description}</Text>
        <View style={styles.cardMetaRow}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color={theme.colors.onSurfaceTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={theme.colors.onSurfaceTertiary} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  stickyHeader: { backgroundColor: theme.colors.surface, paddingTop: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerRow: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.md },
  hello: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontFamily: theme.font.display, fontSize: 26, color: theme.colors.onSurface, fontWeight: "500", marginTop: 2 },
  chipScroll: { height: 56 },
  chipRow: { paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm, alignItems: "center", height: 56 },
  chip: {
    height: 36, paddingHorizontal: 16, borderRadius: theme.radius.pill,
    alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0,
  },
  chipText: { fontFamily: theme.font.body, fontSize: 13, fontWeight: "600" },
  scroll: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, gap: theme.spacing.lg },
  center: { paddingVertical: 60, alignItems: "center" },
  empty: { paddingVertical: 60, alignItems: "center", gap: theme.spacing.sm },
  emptyTitle: { fontFamily: theme.font.display, fontSize: 20, color: theme.colors.onSurface },
  emptySub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary },
  card: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, overflow: "hidden",
    marginBottom: theme.spacing.md,
  },
  cardImageWrap: { height: 180, position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  dateBadge: {
    position: "absolute", top: theme.spacing.md, left: theme.spacing.md,
    backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.radius.md, alignItems: "center",
  },
  dateBadgeText: { fontFamily: theme.font.body, fontSize: 11, fontWeight: "700", color: theme.colors.onSurface, textTransform: "uppercase" },
  dateBadgeSub: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.onSurfaceTertiary },
  virtualBadge: {
    position: "absolute", top: theme.spacing.md, right: theme.spacing.md,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(42,42,40,0.8)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill,
  },
  virtualText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.onSurfaceInverse, fontWeight: "600" },
  cardBody: { padding: theme.spacing.lg, gap: theme.spacing.xs },
  cardCategory: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.onSurfaceTertiary, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" },
  cardTitle: { fontFamily: theme.font.display, fontSize: 18, color: theme.colors.onSurface, fontWeight: "500", marginTop: 2 },
  cardDesc: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary, lineHeight: 20, marginTop: 4 },
  cardMetaRow: { flexDirection: "row", gap: theme.spacing.lg, marginTop: theme.spacing.sm, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onSurfaceTertiary, maxWidth: 140 },
  cardFooter: {
    marginTop: theme.spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  attendees: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary },
  joinBtn: { backgroundColor: theme.colors.surfaceInverse, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.pill },
  joinText: { fontFamily: theme.font.body, fontSize: 13, fontWeight: "700", color: theme.colors.onSurfaceInverse },
});

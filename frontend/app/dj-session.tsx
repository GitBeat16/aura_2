import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Platform, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing, cancelAnimation, withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, type, radius, MOODS } from "@/src/theme";
import { api, MusicReco, SpotifyTrack } from "@/src/api";
import { getUserLocation } from "@/src/utils/location";
import { PrimaryButton, SecondaryButton, IconButton } from "@/src/ui";
import { playSfx } from "@/src/utils/sounds";
import { LumiCharacter } from "@/src/components/LumiCharacter";

type Stage = "mood" | "journal" | "weather" | "time" | "energy" | "cooking" | "reveal" | "error";

const STAGE_LINES: Record<Exclude<Stage, "reveal" | "error">, { title: string; sub: string; icon: any }> = {
  mood:    { title: "Reading your mood…",       sub: "How is your heart today?",              icon: "heart" },
  journal: { title: "Listening to your words…", sub: "The things you've been carrying.",      icon: "book-open" },
  weather: { title: "Checking the sky…",        sub: "The light around you matters.",         icon: "cloud" },
  time:    { title: "Feeling the hour…",        sub: "Morning-light or evening-hush.",        icon: "clock" },
  energy:  { title: "Sensing your energy…",     sub: "Fast or slow, gentle or steady.",       icon: "activity" },
  cooking: { title: "Making today's soundtrack…", sub: "Blending it all for you.",            icon: "music" },
};

const ORDER: Exclude<Stage, "reveal" | "error">[] = ["mood", "journal", "weather", "time", "energy", "cooking"];

export default function DJSession() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("mood");
  const [reco, setReco] = useState<MusicReco | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const stageIndex = useRef(0);

  // Kick off request + drive stage animation
  const start = useCallback(async () => {
    setError(null); setReco(null); setSaved(false);
    stageIndex.current = 0;
    setStage(ORDER[0]);

    // Kick off request in parallel with stage cinematic
    const loc = await getUserLocation().catch(() => null);
    const recoPromise = api.musicRecommendations(loc?.lat, loc?.lon).catch((e: any) => {
      setError(e?.message || "Lumi couldn't reach Spotify.");
      return null;
    });

    // Step the stages every ~900ms
    for (let i = 0; i < ORDER.length; i++) {
      setStage(ORDER[i]);
      Haptics.selectionAsync().catch(() => {});
      playSfx("tap", 0.35);
      // eslint-disable-next-line no-await-in-loop
      await sleep(i === ORDER.length - 1 ? 1100 : 850);
    }

    const r = await recoPromise;
    if (r) {
      setReco(r);
      setStage("reveal");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playSfx("chime", 0.55);
    } else {
      setStage("error");
    }
  }, []);

  useEffect(() => { start(); }, [start]);

  const savePlaylist = async () => {
    if (!reco) return;
    setSaving(true);
    try {
      await api.spotifyCreatePlaylist(
        `Lumi · ${reco.playlist_title}`,
        reco.reasoning,
        reco.tracks.map((t) => t.uri),
      );
      setSaved(true);
      playSfx("chime", 0.5);
    } catch {} finally { setSaving(false); }
  };

  const openTrack = (t: SpotifyTrack) => {
    if (t.uri && Platform.OS !== "web") {
      Linking.canOpenURL(t.uri).then((ok) => Linking.openURL(ok ? t.uri : (t.external_url || t.uri))).catch(() => {});
    } else if (t.external_url) {
      Linking.openURL(t.external_url);
    }
  };

  const moodMeta = MOODS.find((m) => m.key === (reco?.context?.mood as any));
  const bgTop = moodMeta?.color || colors.lumiSoft;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[bgTop, colors.bg]} locations={[0, 0.7]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Close */}
        <View style={styles.topBar}>
          <IconButton icon="x" size={40} tint="rgba(255,255,255,0.6)" onPress={() => router.back()} testID="dj-close-button" />
        </View>

        {stage !== "reveal" && stage !== "error" ? (
          <StageView stage={stage as Exclude<Stage, "reveal" | "error">} />
        ) : stage === "error" ? (
          <ErrorView message={error || "Lumi couldn't finish this set."} onRetry={start} />
        ) : reco ? (
          <RevealView
            reco={reco}
            saving={saving}
            saved={saved}
            onSave={savePlaylist}
            onOpen={openTrack}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function StageView({ stage }: { stage: Exclude<Stage, "reveal" | "error"> }) {
  const info = STAGE_LINES[stage];
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  useEffect(() => {
    opacity.value = 0; translateY.value = 12;
    opacity.value = withTiming(1, { duration: 350 });
    translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [stage, opacity, translateY]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <View style={styles.centerStage}>
      <PulsingHalo />
      <View pointerEvents="none" style={{ position: "absolute", top: "18%" }}>
        <LumiCharacter state="thinking" emotion="thoughtful" size={200} />
      </View>
      <Animated.View style={[styles.stageText, style]}>
        <View style={styles.stageIconWrap}>
          <Feather name={info.icon} size={16} color={colors.ink} />
        </View>
        <Text style={styles.stageTitle}>{info.title}</Text>
        <Text style={styles.stageSub}>{info.sub}</Text>
      </Animated.View>
      <ProgressDots stage={stage} />
    </View>
  );
}

function ProgressDots({ stage }: { stage: Exclude<Stage, "reveal" | "error"> }) {
  const idx = ORDER.indexOf(stage);
  return (
    <View style={styles.progressRow}>
      {ORDER.map((s, i) => (
        <View key={s} style={[styles.dot, i <= idx ? styles.dotActive : null]} />
      ))}
    </View>
  );
}

function PulsingHalo() {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ), -1, false);
    return () => cancelAnimation(s);
  }, [s]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + s.value * 0.3,
    transform: [{ scale: 1 + s.value * 0.15 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.halo, style]} />;
}

function RevealView({ reco, saving, saved, onSave, onOpen }: {
  reco: MusicReco; saving: boolean; saved: boolean;
  onSave: () => void; onOpen: (t: SpotifyTrack) => void;
}) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(80, withTiming(1, { duration: 500 }));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <ScrollView contentContainerStyle={styles.revealScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Lumi made you</Text>
        <Text style={styles.revealTitle}>{reco.playlist_title}</Text>
        <Text style={styles.revealReason}>{reco.reasoning}</Text>

        <View style={styles.ctxRow}>
          <ChipItem icon="cloud" label={reco.context.weather.condition} />
          <ChipItem icon="clock" label={reco.context.time_of_day} />
          <ChipItem icon="heart" label={reco.context.mood} />
          <ChipItem icon="activity" label={reco.context.activity} />
        </View>

        <View style={styles.saveRow}>
          <PrimaryButton
            testID="dj-save-playlist"
            label={saved ? "Saved to Spotify" : `Save · ${reco.tracks.length} tracks`}
            icon={saved ? "check" : "plus"}
            loading={saving}
            disabled={saved}
            onPress={onSave}
          />
        </View>

        {reco.tracks.slice(0, 8).map((t) => (
          <Pressable key={t.id} testID={`dj-track-${t.id}`} onPress={() => onOpen(t)} style={styles.trackRow}>
            {t.album.image ? (
              <Image source={{ uri: t.album.image }} style={styles.trackImg} contentFit="cover" />
            ) : (
              <View style={[styles.trackImg, { backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" }]}>
                <Feather name="music" size={16} color={colors.inkFaint} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.trackName} numberOfLines={1}>{t.name}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>{t.artists.map((a) => a.name).join(", ")}</Text>
            </View>
            <Feather name="external-link" size={16} color={colors.inkFaint} />
          </Pressable>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
    </Animated.View>
  );
}

function ChipItem({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.chipItem}>
      <Feather name={icon} size={11} color={colors.ink} />
      <Text style={styles.chipItemText}>{label}</Text>
    </View>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centerStage}>
      <Feather name="cloud-off" size={40} color={colors.inkMuted} />
      <Text style={[styles.stageTitle, { marginTop: spacing.md }]}>Hmm.</Text>
      <Text style={[styles.stageSub, { marginBottom: spacing.lg }]}>{message}</Text>
      <SecondaryButton label="Try again" icon="refresh-cw" onPress={onRetry} style={{ maxWidth: 220 }} />
    </View>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: "flex-end" },
  centerStage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  halo: {
    position: "absolute", top: "22%",
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  stageText: { alignItems: "center", gap: spacing.sm, marginTop: 240 },
  stageIconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  stageTitle: { ...type.h2, fontSize: 22, textAlign: "center" },
  stageSub: { ...type.body, color: colors.inkMuted, textAlign: "center", maxWidth: 280 },
  progressRow: { flexDirection: "row", gap: 6, marginTop: spacing.xl, position: "absolute", bottom: 60 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.ink },

  revealScroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  eyebrow: { ...type.overline },
  revealTitle: { ...type.display, fontSize: 34, marginTop: 4, marginBottom: spacing.sm },
  revealReason: { ...type.body, color: colors.ink, fontStyle: "italic", lineHeight: 22, marginBottom: spacing.lg },
  ctxRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  chipItem: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  chipItemText: { ...type.overline, fontSize: 10, color: colors.ink },
  saveRow: { marginBottom: spacing.xl },
  trackRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  trackImg: { width: 44, height: 44, borderRadius: 8 },
  trackName: { ...type.body, fontSize: 14, fontWeight: "600" },
  trackArtist: { ...type.caption, marginTop: 2 },
});

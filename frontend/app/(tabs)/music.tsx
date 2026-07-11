import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
  Linking, TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { colors, spacing, type, radius } from "@/src/theme";
import { api, MusicReco, SpotifyPlaylist, SpotifyStatus, SpotifyTrack } from "@/src/api";
import {
  GlassBar, Card, SectionHeader, EmptyState, PrimaryButton, SecondaryButton, IconButton, PillTag,
} from "@/src/ui";

type Tab = "for-you" | "library" | "top";

export default function MusicScreen() {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [reco, setReco] = useState<MusicReco | null>(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [recent, setRecent] = useState<SpotifyTrack[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("for-you");
  const [manualToken, setManualToken] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  const refresh = useCallback(async () => {
    const s = await api.spotifyStatus().catch(() => null);
    setStatus(s);
    if (s?.connected) {
      const [r, p, tt, rp] = await Promise.all([
        api.musicRecommendations().catch(() => null),
        api.spotifyPlaylists().catch(() => ({ items: [] as SpotifyPlaylist[] })),
        api.spotifyTopTracks().catch(() => ({ items: [] as SpotifyTrack[] })),
        api.spotifyRecentlyPlayed().catch(() => ({ items: [] as SpotifyTrack[] })),
      ]);
      setReco(r);
      setPlaylists(p.items);
      setTopTracks(tt.items);
      setRecent(rp.items);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  const regenerateReco = async () => {
    setRecoLoading(true);
    try { setReco(await api.musicRecommendations()); } catch {} finally { setRecoLoading(false); }
  };

  const openInSpotify = async (uri: string, externalUrl?: string | null) => {
    if (uri && Platform.OS !== "web") {
      const ok = await Linking.canOpenURL(uri).catch(() => false);
      if (ok) { Linking.openURL(uri); return; }
    }
    if (externalUrl) Linking.openURL(externalUrl);
  };

  const savePlaylist = async () => {
    if (!reco) return;
    setSavingPlaylist(true);
    try {
      const pl = await api.spotifyCreatePlaylist(
        `Lumi · ${reco.playlist_title}`,
        reco.reasoning,
        reco.tracks.map((t) => t.uri),
      );
      // Optimistically refresh playlist list
      setPlaylists((prev) => [pl, ...prev.filter((x) => x.id !== pl.id)]);
    } catch {} finally { setSavingPlaylist(false); }
  };

  const connectManual = async () => {
    setManualError(null);
    if (!manualToken.trim()) return;
    setManualBusy(true);
    try {
      const s = await api.spotifyConnectToken(manualToken.trim());
      setStatus(s);
      setManualToken("");
      await refresh();
    } catch (e: any) {
      setManualError(e.message || "Could not connect");
    } finally {
      setManualBusy(false);
    }
  };

  const startOAuth = async () => {
    try {
      const { authorize_url } = await api.spotifyLoginUrl();
      await WebBrowser.openAuthSessionAsync(authorize_url, "frontend://spotify-connected");
      await refresh();
    } catch (e: any) {
      setManualError(e.message || "Spotify OAuth not configured yet — paste an access token below to connect for now.");
    }
  };

  const disconnect = async () => {
    await api.spotifyDisconnect().catch(() => {});
    setStatus({ connected: false, provider_configured: !!status?.provider_configured });
    setReco(null); setPlaylists([]); setTopTracks([]); setRecent([]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <GlassBar
        subtitle="Music"
        title="For how you feel."
        right={
          status?.connected ? (
            <IconButton icon="log-out" size={36} tint={colors.bgAlt} onPress={disconnect} testID="music-disconnect" />
          ) : undefined
        }
      >
        {status?.connected && (
          <View style={styles.subTabs}>
            <SubTab active={tab === "for-you"} onPress={() => setTab("for-you")} label="For you" testID="music-tab-for-you" />
            <SubTab active={tab === "library"} onPress={() => setTab("library")} label="Playlists" testID="music-tab-library" />
            <SubTab active={tab === "top"} onPress={() => setTab("top")} label="Top & Recent" testID="music-tab-top" />
          </View>
        )}
      </GlassBar>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lumi} />}
      >
        {!status?.connected ? (
          <ConnectPanel
            configured={!!status?.provider_configured}
            onOAuth={startOAuth}
            manualToken={manualToken}
            setManualToken={setManualToken}
            manualBusy={manualBusy}
            onManual={connectManual}
            manualError={manualError}
          />
        ) : tab === "for-you" ? (
          <ForYouTab
            reco={reco} loading={recoLoading}
            onRegenerate={regenerateReco}
            onSave={savePlaylist} saving={savingPlaylist}
            onOpenTrack={openInSpotify}
          />
        ) : tab === "library" ? (
          <LibraryTab playlists={playlists} onOpen={openInSpotify} />
        ) : (
          <TopRecentTab top={topTracks} recent={recent} onOpen={openInSpotify} />
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SubTab({ active, onPress, label, testID }: { active: boolean; onPress: () => void; label: string; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.subTab, active && styles.subTabActive]}>
      <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ---- Connect panel (OAuth + manual token) ---- */
function ConnectPanel({
  configured, onOAuth, manualToken, setManualToken, manualBusy, onManual, manualError,
}: any) {
  return (
    <View style={styles.padH}>
      <Card style={styles.connectHero} padding={spacing.xl}>
        <View style={styles.spotifyBadge}>
          <Feather name="music" size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.connectTitle}>Bring your music into Lumi.</Text>
        <Text style={styles.connectSub}>
          Connect Spotify so Lumi can shape sounds around your mood, weather, and the shape of your day.
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {configured ? (
            <PrimaryButton
              testID="music-oauth-button"
              label="Connect with Spotify"
              icon="link"
              onPress={onOAuth}
            />
          ) : (
            <View style={styles.warnPill}>
              <Feather name="info" size={12} color={colors.warning} />
              <Text style={styles.warnText}>Spotify OAuth not configured yet. Paste an access token below to try it now.</Text>
            </View>
          )}
        </View>
      </Card>

      <SectionHeader title="Have a token?" caption="Paste a Spotify user access token (dev mode)." style={{ paddingHorizontal: 0 }} />
      <Card padding={spacing.lg}>
        <TextInput
          testID="music-manual-token-input"
          value={manualToken}
          onChangeText={setManualToken}
          placeholder="BQC..."
          placeholderTextColor={colors.inkFaint}
          style={styles.tokenInput}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
        />
        {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}
        <View style={{ marginTop: spacing.md }}>
          <SecondaryButton
            testID="music-manual-connect-button"
            label="Connect with token"
            icon="key"
            loading={manualBusy}
            disabled={!manualToken.trim() || manualBusy}
            onPress={onManual}
          />
        </View>
      </Card>
    </View>
  );
}

/* ---- For You tab ---- */
function ForYouTab({ reco, loading, onRegenerate, onSave, saving, onOpenTrack }: any) {
  if (!reco) return <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator color={colors.lumi} /></View>;
  const ctx = reco.context;
  return (
    <View style={styles.padH}>
      {/* Hero recommendation card */}
      <Card style={styles.recoHero} tone="tinted">
        <View style={styles.recoHeader}>
          <PillTag label={`${ctx.time_of_day} · ${ctx.mood}`} tint="rgba(255,255,255,0.6)" />
          <IconButton icon={loading ? "loader" : "refresh-cw"} size={36} tint={colors.card} onPress={onRegenerate} disabled={loading} testID="music-regen-reco" />
        </View>
        <Text style={styles.recoTitle}>{reco.playlist_title}</Text>
        <Text style={styles.recoReason}>{reco.reasoning}</Text>

        <View style={styles.contextRow}>
          <ContextChip icon="cloud" label={ctx.weather?.condition || "clear"} />
          <ContextChip icon="clock" label={ctx.time_of_day} />
          <ContextChip icon="activity" label={ctx.activity} />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton
            testID="music-save-playlist"
            label={`Save as playlist · ${reco.tracks.length} tracks`}
            icon="plus"
            loading={saving}
            onPress={onSave}
          />
        </View>
      </Card>

      {/* Track list */}
      <SectionHeader title="Tracks for you" caption="Tap to open in Spotify." style={{ paddingHorizontal: 0 }} />
      <View style={{ gap: spacing.sm }}>
        {reco.tracks.map((t: SpotifyTrack, i: number) => (
          <TrackRow key={t.id} track={t} index={i + 1} onPress={() => onOpenTrack(t.uri, t.external_url)} />
        ))}
      </View>
    </View>
  );
}

function ContextChip({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.ctxChip}>
      <Feather name={icon} size={11} color={colors.lumiInk} />
      <Text style={styles.ctxChipText}>{label}</Text>
    </View>
  );
}

function TrackRow({ track, index, onPress }: { track: SpotifyTrack; index: number; onPress: () => void }) {
  return (
    <Pressable testID={`track-${track.id}`} onPress={onPress}>
      <Card style={styles.trackRow} padding={spacing.sm}>
        {track.album.image ? (
          <Image source={{ uri: track.album.image }} style={styles.trackImg} contentFit="cover" />
        ) : (
          <View style={[styles.trackImg, { backgroundColor: colors.bgAlt, alignItems: "center", justifyContent: "center" }]}>
            <Feather name="music" size={16} color={colors.inkFaint} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.trackTitle} numberOfLines={1}>{track.name}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{track.artists.map((a) => a.name).join(", ")}</Text>
        </View>
        <Feather name="external-link" size={16} color={colors.inkFaint} />
      </Card>
    </Pressable>
  );
}

function LibraryTab({ playlists, onOpen }: { playlists: SpotifyPlaylist[]; onOpen: (uri: string, url?: string | null) => void }) {
  if (!playlists.length) return <View style={styles.padH}><Card><EmptyState title="No playlists yet" subtitle="Create one from the For-you tab, or save some in Spotify first." icon="list" /></Card></View>;
  return (
    <View style={[styles.padH, { gap: spacing.sm }]}>
      {playlists.map((p) => (
        <Pressable key={p.id} testID={`playlist-${p.id}`} onPress={() => onOpen(p.uri, p.external_url)}>
          <Card padding={spacing.md}>
            <View style={styles.trackRow}>
              {p.image ? (
                <Image source={{ uri: p.image }} style={styles.trackImg} contentFit="cover" />
              ) : (
                <View style={[styles.trackImg, { backgroundColor: colors.lumiSoft, alignItems: "center", justifyContent: "center" }]}>
                  <Feather name="list" size={16} color={colors.lumiInk} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {p.track_count} tracks{p.owner ? ` · ${p.owner}` : ""}
                </Text>
              </View>
              <Feather name="external-link" size={16} color={colors.inkFaint} />
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function TopRecentTab({ top, recent, onOpen }: { top: SpotifyTrack[]; recent: SpotifyTrack[]; onOpen: (uri: string, url?: string | null) => void }) {
  return (
    <View>
      <SectionHeader title="Your top tracks" caption="From your listening in the last few months." />
      <View style={[styles.padH, { gap: spacing.sm }]}>
        {top.length === 0 ? <Card><EmptyState title="No top tracks yet" subtitle="Play a few songs in Spotify to see them here." icon="trending-up" /></Card> :
          top.map((t, i) => <TrackRow key={t.id} track={t} index={i + 1} onPress={() => onOpen(t.uri, t.external_url)} />)
        }
      </View>
      <SectionHeader title="Recently played" />
      <View style={[styles.padH, { gap: spacing.sm }]}>
        {recent.length === 0 ? <Card><EmptyState title="Nothing recent" subtitle="Your recent Spotify plays will land here." icon="rotate-ccw" /></Card> :
          recent.slice(0, 15).map((t) => <TrackRow key={`${t.id}-${t.played_at}`} track={t} index={0} onPress={() => onOpen(t.uri, t.external_url)} />)
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  padH: { paddingHorizontal: spacing.xl },

  subTabs: {
    flexDirection: "row", gap: spacing.sm, marginTop: spacing.md,
  },
  subTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  subTabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  subTabText: { ...type.caption, color: colors.ink, fontWeight: "600" },
  subTabTextActive: { color: "#FFFFFF" },

  connectHero: { gap: spacing.md, marginBottom: spacing.xl },
  spotifyBadge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#1DB954",
    alignItems: "center", justifyContent: "center",
  },
  connectTitle: { ...type.h2, marginTop: spacing.md },
  connectSub: { ...type.body, color: colors.inkMuted },
  warnPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF6E5", padding: spacing.sm, borderRadius: radius.sm,
  },
  warnText: { ...type.caption, color: "#7A4E14", flex: 1 },

  tokenInput: {
    backgroundColor: colors.bgAlt, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    ...type.body, color: colors.ink, minHeight: 80, textAlignVertical: "top",
    fontSize: 12, // long tokens
  },
  errorText: { ...type.caption, color: colors.error, marginTop: spacing.sm },

  recoHero: { gap: spacing.md, marginBottom: spacing.xl },
  recoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recoTitle: { ...type.h1, fontSize: 26, lineHeight: 32 },
  recoReason: { ...type.body, color: colors.lumiInk, fontStyle: "italic", lineHeight: 22 },
  contextRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm },
  ctxChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.6)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  ctxChipText: { ...type.overline, color: colors.lumiInk, fontSize: 10 },

  trackRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  trackImg: { width: 44, height: 44, borderRadius: 8 },
  trackTitle: { ...type.body, fontSize: 14, fontWeight: "600" },
  trackArtist: { ...type.caption, marginTop: 2 },
});

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "aura_token";

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function clearToken() {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.detail || msg;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

// ==== Types ====
export type User = { id: string; email: string; name: string; created_at: string };
export type AuthResp = { token: string; user: User };
export type Mood = { id: string; user_id: string; mood: string; note?: string | null; created_at: string };
export type ChatMsg = { id: string; session_id: string; role: "user" | "assistant"; content: string; created_at: string; emotion?: string | null };
export type DailyAction = { id: string; title: string; description: string; category: string; duration_minutes: number; icon: string; completed: boolean };
export type SocialSuggestion = { id: string; title: string; description: string; prompt: string; icon: string };
export type EventItem = { id: string; title: string; description: string; category: string; date: string; time: string; location: string; image_url: string; attendees: number; is_virtual: boolean };
export type TaskStreak = { title: string; icon: string; current_streak: number; total_completions: number; last_completed: string | null; is_active: boolean };
export type WeeklyRecap = { week_start: string; week_end: string; tasks_completed: number; days_active: number; moods_logged: number; top_mood: string | null; longest_daily_streak: number; reflection: string; share_text: string };

export type SpotifyStatus = { connected: boolean; display_name?: string | null; product?: string | null; image?: string | null; provider_configured: boolean };
export type SpotifyTrack = {
  id: string; uri: string; name: string;
  artists: { id: string; name: string }[];
  album: { name: string; image: string | null };
  duration_ms: number; preview_url: string | null; external_url: string | null;
  played_at?: string;
};
export type SpotifyPlaylist = {
  id: string; uri: string; name: string; description: string | null;
  image: string | null; track_count: number; owner: string | null; external_url: string | null;
};
export type MusicReco = {
  context: { mood: string; activity: string; time_of_day: string; weather: { condition: string; is_day: boolean; temperature_c: number | null }; hour: number };
  playlist_title: string;
  reasoning: string;
  queries: string[];
  tracks: SpotifyTrack[];
};

// ==== API ====
export const api = {
  register: async (email: string, password: string, name: string) => {
    const r = await request<AuthResp>("/auth/register", {
      method: "POST", body: { email, password, name }, auth: false,
    });
    await saveToken(r.token);
    return r;
  },
  login: async (email: string, password: string) => {
    const r = await request<AuthResp>("/auth/login", {
      method: "POST", body: { email, password }, auth: false,
    });
    await saveToken(r.token);
    return r;
  },
  me: () => request<User>("/auth/me"),
  logout: async () => { await clearToken(); },

  createMood: (mood: string, note?: string) =>
    request<Mood>("/moods", { method: "POST", body: { mood, note } }),
  latestMood: () => request<Mood | null>("/moods/latest"),
  listMoods: () => request<Mood[]>("/moods"),

  sendChat: (message: string, session_id?: string, voice: boolean = false) =>
    request<{ session_id: string; user_message: ChatMsg; assistant_message: ChatMsg; audio_base64?: string | null }>(
      "/chat/message",
      { method: "POST", body: { message, session_id, voice } }
    ),
  chatHistory: (session_id?: string) => {
    const q = session_id ? `?session_id=${encodeURIComponent(session_id)}` : "";
    return request<ChatMsg[]>(`/chat/history${q}`);
  },
  currentSession: () => request<{ session_id: string | null }>("/chat/current_session"),

  dailyActions: () => request<DailyAction[]>("/actions/daily"),
  regenerateActions: () => request<DailyAction[]>("/actions/regenerate", { method: "POST" }),
  completeAction: (title: string) =>
    request<{ action_id: string; completed: boolean; completed_at: string }>(
      "/actions/complete", { method: "POST", body: { title } }
    ),

  socialSuggestions: () => request<SocialSuggestion[]>("/social/suggestions"),

  events: (category?: string) => {
    const q = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
    return request<EventItem[]>(`/events${q}`);
  },
  eventCategories: () => request<{ categories: string[] }>("/events/categories"),

  taskStreaks: () => request<TaskStreak[]>("/stats/task-streaks"),
  weeklyRecap: () => request<WeeklyRecap>("/stats/weekly-recap"),

  // Spotify
  spotifyStatus: () => request<SpotifyStatus>("/spotify/status"),
  spotifyLoginUrl: () => request<{ authorize_url: string }>("/spotify/login"),
  spotifyConnectToken: (access_token: string, expires_in?: number, refresh_token?: string) =>
    request<SpotifyStatus>("/spotify/connect-token", {
      method: "POST", body: { access_token, expires_in, refresh_token },
    }),
  spotifyDisconnect: () => request<{ ok: boolean }>("/spotify/disconnect", { method: "POST" }),
  spotifyPlaylists: () => request<{ items: SpotifyPlaylist[] }>("/spotify/playlists"),
  spotifyTopTracks: (time_range: string = "medium_term") =>
    request<{ items: SpotifyTrack[] }>(`/spotify/top-tracks?time_range=${time_range}`),
  spotifyTopArtists: (time_range: string = "medium_term") =>
    request<{ items: any[] }>(`/spotify/top-artists?time_range=${time_range}`),
  spotifyRecentlyPlayed: () => request<{ items: SpotifyTrack[] }>("/spotify/recently-played"),
  musicRecommendations: (lat?: number, lon?: number) =>
    request<MusicReco>("/music/recommendations", { method: "POST", body: { lat, lon } }),
  lumiDailyTake: (lat?: number, lon?: number) =>
    request<{ headline: string; suggestion: string; icon: string; weather: { condition: string; is_day: boolean; temperature_c: number | null }; time_of_day: string; mood: string }>(
      "/lumi/daily-take", { method: "POST", body: { lat, lon } }
    ),
  spotifyCreatePlaylist: (name: string, description: string, track_uris: string[]) =>
    request<SpotifyPlaylist>("/spotify/playlists", {
      method: "POST", body: { name, description, track_uris },
    }),

  transcribeAudio: async (uri: string, mime: string = "audio/m4a", filename: string = "audio.m4a") => {
    const token = await getToken();
    const form = new FormData();
    // React Native FormData file entry
    // @ts-ignore
    form.append("file", { uri, name: filename, type: mime });
    const res = await fetch(`${BASE_URL}/api/voice/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form as any,
    });
    if (!res.ok) {
      let msg = `Transcribe failed (${res.status})`;
      try { const err = await res.json(); msg = err.detail || msg; } catch {}
      throw new Error(msg);
    }
    return res.json() as Promise<{ text: string }>;
  },
};

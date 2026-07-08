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

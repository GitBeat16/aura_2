import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Platform } from "react-native";

/**
 * Small helper for tiny UI SFX + a looping ambient bed. All sounds live in
 * /app/frontend/assets/sounds/ and are procedurally generated CC0 tones.
 */

let initialized = false;
async function ensureMode() {
  if (initialized) return;
  initialized = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  } catch {}
}

// ---- One-shot SFX ----
type SfxKey = "tap" | "chime" | "send" | "pop";

const sfxSources: Record<SfxKey, any> = {
  tap: require("../../assets/sounds/tap.wav"),
  chime: require("../../assets/sounds/chime.wav"),
  send: require("../../assets/sounds/send.wav"),
  pop: require("../../assets/sounds/pop.wav"),
};

// Cache players so we don't re-create them every tap
const cache: Partial<Record<SfxKey, AudioPlayer>> = {};
let sfxMuted = false;

export function setSfxMuted(muted: boolean) {
  sfxMuted = muted;
}
export function isSfxMuted() {
  return sfxMuted;
}

export async function playSfx(key: SfxKey, volume: number = 0.7) {
  if (sfxMuted) return;
  try {
    await ensureMode();
    let p = cache[key];
    if (!p) {
      p = createAudioPlayer(sfxSources[key]);
      cache[key] = p;
    }
    p.volume = volume;
    // Rewind and play
    p.seekTo(0);
    p.play();
  } catch {
    // Sounds are non-critical; swallow errors silently on unsupported platforms
  }
}

// ---- Looping ambient bed ----
let ambient: AudioPlayer | null = null;
let ambientOn = false;

export function isAmbientOn() {
  return ambientOn;
}

export async function startAmbient(volume: number = 0.35) {
  try {
    await ensureMode();
    if (!ambient) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ambient = createAudioPlayer(require("../../assets/sounds/ambient.wav"));
      ambient.loop = true;
    }
    ambient.volume = volume;
    ambient.play();
    ambientOn = true;
  } catch {
    ambientOn = false;
  }
}

export async function stopAmbient() {
  try {
    ambient?.pause();
  } catch {}
  ambientOn = false;
}

export async function toggleAmbient() {
  if (ambientOn) await stopAmbient();
  else await startAmbient();
  return ambientOn;
}

// Web fallback: expo-audio on web relies on WebAudio; if it throws we no-op
if (Platform.OS === "web") {
  // no special handling needed today
}

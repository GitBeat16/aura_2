import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation, withSpring,
} from "react-native-reanimated";
import {
  useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule, setAudioModeAsync,
} from "expo-audio";
import { theme } from "@/src/theme";
import { api, ChatMsg } from "@/src/api";
import { LumiCharacter, LumiEmotion, LumiState } from "@/src/components/LumiCharacter";

type Mode = "voice" | "text";

export default function LumiScreen() {
  const [state, setState] = useState<LumiState>("idle");
  const [emotion, setEmotion] = useState<LumiEmotion>("calm");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");   // latest user turn (spoken)
  const [reply, setReply] = useState<string>("");             // latest Lumi reply (shown as bubble)
  const [mode, setMode] = useState<Mode>("voice");
  const [textInput, setTextInput] = useState("");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  // ---- Permissions ----
  useEffect(() => {
    (async () => {
      try {
        const p = await AudioModule.requestRecordingPermissionsAsync();
        setPermission(p.granted);
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch {
        setPermission(false);
      }
    })();
  }, []);

  // ---- Load recent history so context feels continuous ----
  useEffect(() => {
    (async () => {
      try {
        const cur = await api.currentSession();
        if (cur.session_id) {
          setSessionId(cur.session_id);
          const hist = await api.chatHistory(cur.session_id);
          setMessages(hist);
          const lastAI = [...hist].reverse().find((m) => m.role === "assistant");
          if (lastAI) {
            setReply(lastAI.content);
            setEmotion((lastAI.emotion as LumiEmotion) || "calm");
          }
        }
      } catch {}
    })();
  }, []);

  // ---- Playback: when audio arrives, play + set speaking state ----
  const playBase64 = useCallback(async (b64: string) => {
    try {
      const uri = `data:audio/mpeg;base64,${b64}`;
      playerRef.current.replace({ uri });
      setState("speaking");
      playerRef.current.play();
    } catch (e) {
      setState("idle");
    }
  }, []);

  // Detect end of playback to return to idle
  useEffect(() => {
    const int = setInterval(() => {
      const p = playerRef.current;
      if (state === "speaking" && p && !p.playing && p.currentTime > 0) {
        setState("idle");
      }
    }, 400);
    return () => clearInterval(int);
  }, [state]);

  // ---- Core send flow ----
  const sendMessage = useCallback(async (text: string, wantVoice: boolean) => {
    if (!text.trim()) return;
    setErrorText(null);
    setTranscript(text);
    setReply("");
    setState("thinking");
    setEmotion("thoughtful");

    // Optimistic user bubble
    const tempUser: ChatMsg = {
      id: `tmp-${Date.now()}`, session_id: sessionId || "pending",
      role: "user", content: text, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const res = await api.sendChat(text, sessionId || undefined, wantVoice);
      setSessionId(res.session_id);
      setReply(res.assistant_message.content);
      const em = (res.assistant_message.emotion as LumiEmotion) || "calm";
      setEmotion(em);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUser.id);
        return [...filtered, res.user_message, res.assistant_message];
      });
      if (wantVoice && res.audio_base64) {
        await playBase64(res.audio_base64);
      } else {
        setState("idle");
      }
    } catch (e: any) {
      setErrorText(e.message || "Lumi couldn't reach you right now.");
      setState("idle");
      setEmotion("gentle");
    }
  }, [sessionId, playBase64]);

  // ---- Voice: tap to toggle ----
  const startListening = useCallback(async () => {
    if (!permission) {
      const p = await AudioModule.requestRecordingPermissionsAsync();
      setPermission(p.granted);
      if (!p.granted) {
        setErrorText("Please allow microphone access in Settings to talk with Lumi.");
        return;
      }
    }
    setErrorText(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Stop any current playback so Lumi listens fully
      try { playerRef.current.pause(); } catch {}
      setState("listening");
      setEmotion("listening");
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: any) {
      setErrorText(`Couldn't start recording: ${e?.message || e}`);
      setState("idle");
    }
  }, [permission, recorder]);

  const stopListeningAndSend = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setState("idle");
        return;
      }
      setState("thinking");
      setEmotion("thoughtful");
      const { text } = await api.transcribeAudio(uri, "audio/m4a", "voice.m4a");
      if (!text || text.length < 2) {
        setErrorText("I didn't quite catch that. Try again?");
        setState("idle");
        setEmotion("gentle");
        return;
      }
      await sendMessage(text, true);
    } catch (e: any) {
      setErrorText(e?.message || "Voice failed. Try again.");
      setState("idle");
    }
  }, [recorder, sendMessage]);

  const toggleVoice = () => {
    if (state === "listening") stopListeningAndSend();
    else if (state === "idle") startListening();
  };

  // ---- Text send fallback ----
  const submitText = async () => {
    const t = textInput.trim();
    if (!t) return;
    setTextInput("");
    await sendMessage(t, false);
  };

  const canTapMic = state === "idle" || state === "listening";
  const micLabel =
    state === "listening" ? "Listening… tap to send" :
    state === "thinking" ? "Lumi is thinking…" :
    state === "speaking" ? "Lumi is speaking" :
    "Tap to talk with Lumi";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        {/* Ambient gradient background */}
        <LinearGradient
          colors={["#FDFBF7", "#F0EEE4", "#EAE5D9"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Lumi</Text>
            <Text style={styles.headerSub}>
              {state === "listening" ? "Listening" :
                state === "thinking" ? "Thinking" :
                state === "speaking" ? "Speaking" : "Here with you"}
            </Text>
          </View>
          <Pressable
            testID="lumi-mode-toggle"
            onPress={() => setMode(mode === "voice" ? "text" : "voice")}
            style={styles.modeBtn}
          >
            <Feather name={mode === "voice" ? "type" : "mic"} size={16} color={theme.colors.onSurface} />
            <Text style={styles.modeText}>{mode === "voice" ? "Type" : "Voice"}</Text>
          </Pressable>
        </View>

        {/* Character */}
        <View style={styles.characterArea} testID="lumi-character-stage">
          <SoftHalo state={state} />
          <LumiCharacter state={state} emotion={emotion} size={240} />
        </View>

        {/* Latest conversation snippet */}
        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptWrap}
          showsVerticalScrollIndicator={false}
        >
          {errorText ? (
            <View testID="lumi-error" style={styles.errorBubble}>
              <Feather name="alert-circle" size={14} color={theme.colors.error} />
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}

          {transcript ? (
            <View style={styles.userBubbleWrap} testID="lumi-user-bubble">
              <Text style={styles.userBubbleText}>{transcript}</Text>
            </View>
          ) : null}

          {reply ? (
            <View style={styles.lumiBubbleWrap} testID="lumi-reply-bubble">
              <Text style={styles.lumiBubbleText}>{reply}</Text>
            </View>
          ) : (
            !transcript && (
              <View style={styles.lumiBubbleWrap}>
                <Text style={styles.lumiBubbleText}>
                  Hi, I'm Lumi. I'm here with you. Tap the button to talk, or type — whichever feels easier.
                </Text>
              </View>
            )
          )}
        </ScrollView>

        {/* Bottom controls */}
        {mode === "voice" ? (
          <View style={styles.voiceControls}>
            <Text style={styles.micHint}>{micLabel}</Text>
            <Pressable
              testID="lumi-mic-button"
              onPress={toggleVoice}
              disabled={!canTapMic}
              style={({ pressed }) => [
                styles.micButton,
                state === "listening" && styles.micButtonListening,
                !canTapMic && { opacity: 0.55 },
                pressed && { opacity: 0.9 },
              ]}
            >
              {state === "thinking" ? (
                <ActivityIndicator color={theme.colors.onBrandPrimary} />
              ) : (
                <Feather
                  name={state === "listening" ? "square" : "mic"}
                  size={26}
                  color={theme.colors.onBrandPrimary}
                />
              )}
              {state === "listening" && <PulseRing />}
            </Pressable>
          </View>
        ) : (
          <View style={styles.textBar}>
            <TextInput
              testID="lumi-text-input"
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type what's on your mind…"
              placeholderTextColor={theme.colors.muted}
              style={styles.textInput}
              multiline
              maxLength={2000}
            />
            <Pressable
              testID="lumi-send-text-button"
              onPress={submitText}
              disabled={!textInput.trim() || state === "thinking"}
              style={[styles.sendBtn, (!textInput.trim() || state === "thinking") && { opacity: 0.4 }]}
            >
              <Feather name="arrow-up" size={20} color={theme.colors.onBrandPrimary} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---- Soft breathing halo behind the character ---- */
function SoftHalo({ state }: { state: LumiState }) {
  const s = useSharedValue(0);
  useEffect(() => {
    const dur = state === "speaking" ? 500 : state === "listening" ? 900 : 2400;
    s.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    return () => cancelAnimation(s);
  }, [state, s]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + s.value * 0.25,
    transform: [{ scale: 1 + s.value * 0.08 }],
  }));
  const color =
    state === "listening" ? "#D9E1D0" :
    state === "speaking" ? "#E7DACC" :
    state === "thinking" ? "#DEDDE8" :
    "#EAE5D9";
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        style,
        { backgroundColor: color, shadowColor: color },
      ]}
    />
  );
}

/* ---- Pulsing ring around the mic when listening ---- */
function PulseRing() {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1, false,
    );
    return () => cancelAnimation(s);
  }, [s]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 - s.value * 0.6,
    transform: [{ scale: 1 + s.value * 0.6 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.pulseRing, style]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md,
  },
  headerTitle: { fontFamily: theme.font.display, fontSize: 26, color: theme.colors.onSurface, fontWeight: "500" },
  headerSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 2, letterSpacing: 1, textTransform: "uppercase" },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.surfaceSecondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
  },
  modeText: { fontFamily: theme.font.body, fontSize: 12, fontWeight: "600", color: theme.colors.onSurface },
  characterArea: {
    alignItems: "center", justifyContent: "center", height: 300, marginBottom: theme.spacing.md,
  },
  halo: {
    position: "absolute",
    width: 280, height: 280, borderRadius: 140,
    shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  transcriptScroll: { flex: 1 },
  transcriptWrap: { paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  userBubbleWrap: {
    alignSelf: "flex-end", maxWidth: "80%",
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg, borderBottomRightRadius: 6,
  },
  userBubbleText: { fontFamily: theme.font.body, fontSize: 15, color: theme.colors.onBrandTertiary, lineHeight: 22 },
  lumiBubbleWrap: {
    alignSelf: "flex-start", maxWidth: "88%",
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg, borderBottomLeftRadius: 6,
  },
  lumiBubbleText: { fontFamily: theme.font.body, fontSize: 15, color: theme.colors.onSurface, lineHeight: 22 },
  errorBubble: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FBEAEA", paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill,
  },
  errorText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.onError },
  voiceControls: {
    alignItems: "center", paddingBottom: theme.spacing.lg, paddingTop: theme.spacing.md, gap: theme.spacing.md,
  },
  micHint: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.onSurfaceTertiary },
  micButton: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
    shadowColor: theme.colors.brandPrimary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  micButtonListening: { backgroundColor: theme.colors.brandSecondary },
  pulseRing: {
    position: "absolute", width: 78, height: 78, borderRadius: 39,
    borderWidth: 3, borderColor: theme.colors.brandPrimary,
  },
  textBar: {
    flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  textInput: {
    flex: 1, backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: 12,
    fontFamily: theme.font.body, fontSize: 15, color: theme.colors.onSurface, maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
});

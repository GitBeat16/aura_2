import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
  Easing, cancelAnimation,
} from "react-native-reanimated";
import {
  useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule, setAudioModeAsync,
} from "expo-audio";
import { colors, spacing, type, radius } from "@/src/theme";
import { api, ChatMsg } from "@/src/api";
import { LumiCharacter, LumiEmotion, LumiState } from "@/src/components/LumiCharacter";
import { playSfx, isAmbientOn, toggleAmbient } from "@/src/utils/sounds";
import { GlassBar, IconButton } from "@/src/ui";

type Mode = "voice" | "text";

export default function LumiScreen() {
  const [state, setState] = useState<LumiState>("idle");
  const [emotion, setEmotion] = useState<LumiEmotion>("calm");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [reply, setReply] = useState<string>("");
  const [mode, setMode] = useState<Mode>("voice");
  const [textInput, setTextInput] = useState("");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [ambient, setAmbient] = useState<boolean>(isAmbientOn());

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    (async () => {
      try {
        const p = await AudioModule.requestRecordingPermissionsAsync();
        setPermission(p.granted);
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch { setPermission(false); }
    })();
  }, []);

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

  const playBase64 = useCallback(async (b64: string) => {
    try {
      const uri = `data:audio/mpeg;base64,${b64}`;
      playerRef.current.replace({ uri });
      setState("speaking");
      playerRef.current.play();
    } catch { setState("idle"); }
  }, []);

  useEffect(() => {
    const int = setInterval(() => {
      const p = playerRef.current;
      if (state === "speaking" && p && !p.playing && p.currentTime > 0) setState("idle");
    }, 400);
    return () => clearInterval(int);
  }, [state]);

  const sendMessage = useCallback(async (text: string, wantVoice: boolean) => {
    if (!text.trim()) return;
    setErrorText(null);
    setTranscript(text);
    setReply("");
    setState("thinking");
    setEmotion("thoughtful");
    playSfx("send", 0.4);

    const tempUser: ChatMsg = {
      id: `tmp-${Date.now()}`, session_id: sessionId || "pending",
      role: "user", content: text, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    try {
      const res = await api.sendChat(text, sessionId || undefined, wantVoice);
      setSessionId(res.session_id);
      setReply(res.assistant_message.content);
      setEmotion((res.assistant_message.emotion as LumiEmotion) || "calm");
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUser.id);
        const next = [...filtered, res.user_message, res.assistant_message];
        const userTurns = next.filter((m) => m.role === "user").length;
        if (userTurns > 0 && userTurns % 5 === 0) api.regenerateActions().catch(() => {});
        return next;
      });
      if (wantVoice && res.audio_base64) await playBase64(res.audio_base64);
      else { playSfx("chime", 0.35); setState("idle"); }
    } catch (e: any) {
      setErrorText(e.message || "Lumi couldn't reach you right now.");
      setState("idle");
      setEmotion("gentle");
    }
  }, [sessionId, playBase64]);

  const startListening = useCallback(async () => {
    if (!permission) {
      const p = await AudioModule.requestRecordingPermissionsAsync();
      setPermission(p.granted);
      if (!p.granted) { setErrorText("Please allow microphone access to talk with Lumi."); return; }
    }
    setErrorText(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      if (!uri) { setState("idle"); return; }
      setState("thinking");
      setEmotion("thoughtful");
      const { text } = await api.transcribeAudio(uri, "audio/m4a", "voice.m4a");
      if (!text || text.length < 2) {
        setErrorText("I didn't quite catch that. Try again?");
        setState("idle"); setEmotion("gentle"); return;
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

  const stateSubtitle =
    state === "listening" ? "Listening" :
    state === "thinking" ? "Thinking" :
    state === "speaking" ? "Speaking" :
    "Here with you";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        {/* Ambient gradient background */}
        <LinearGradient
          colors={[colors.bg, "#F1EFE7", colors.bgAlt]}
          style={StyleSheet.absoluteFill}
        />

        {/* Glass header */}
        <GlassBar
          subtitle={stateSubtitle}
          title="Lumi"
          right={
            <>
              <IconButton
                testID="lumi-ambient-toggle"
                icon={ambient ? "volume-2" : "volume-x"}
                size={36}
                tint={colors.bgAlt}
                onPress={async () => { const on = await toggleAmbient(); setAmbient(on); }}
              />
              <IconButton
                testID="lumi-mode-toggle"
                icon={mode === "voice" ? "type" : "mic"}
                size={36}
                tint={colors.bgAlt}
                onPress={() => setMode(mode === "voice" ? "text" : "voice")}
              />
            </>
          }
        />

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
              <Feather name="alert-circle" size={14} color={colors.error} />
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Feather
                  name={state === "listening" ? "square" : "mic"}
                  size={26}
                  color="#FFFFFF"
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
              placeholderTextColor={colors.inkFaint}
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
              <Feather name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        <View style={{ height: Platform.OS === "ios" ? 84 : 68 }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---- Soft halo ---- */
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
    opacity: 0.28 + s.value * 0.22,
    transform: [{ scale: 1 + s.value * 0.08 }],
  }));
  const color =
    state === "listening" ? "#D9E1D0" :
    state === "speaking" ? "#E7DACC" :
    state === "thinking" ? "#DEDDE8" : "#EAE5D9";
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

/* ---- Pulse ring ---- */
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
  safe: { flex: 1, backgroundColor: colors.bg },
  characterArea: { alignItems: "center", justifyContent: "center", height: 300, marginBottom: spacing.md },
  halo: {
    position: "absolute",
    width: 280, height: 280, borderRadius: 140,
    shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  transcriptScroll: { flex: 1 },
  transcriptWrap: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  userBubbleWrap: {
    alignSelf: "flex-end", maxWidth: "80%",
    backgroundColor: colors.lumiSoft,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderBottomRightRadius: 6,
  },
  userBubbleText: { ...type.body, color: colors.lumiInk, lineHeight: 22 },
  lumiBubbleWrap: {
    alignSelf: "flex-start", maxWidth: "88%",
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderBottomLeftRadius: 6,
  },
  lumiBubbleText: { ...type.body, color: colors.ink, lineHeight: 22 },
  errorBubble: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FBEAEA", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  errorText: { ...type.caption, color: colors.errorInk },
  voiceControls: {
    alignItems: "center", paddingBottom: spacing.md, paddingTop: spacing.md, gap: spacing.md,
  },
  micHint: { ...type.caption },
  micButton: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: colors.ink,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  micButtonListening: { backgroundColor: colors.error },
  pulseRing: {
    position: "absolute", width: 78, height: 78, borderRadius: 39,
    borderWidth: 3, borderColor: colors.ink,
  },
  textBar: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  textInput: {
    flex: 1, backgroundColor: colors.bgAlt, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    ...type.body, color: colors.ink, maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink,
    alignItems: "center", justifyContent: "center",
  },
});

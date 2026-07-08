import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Ellipse, Path, G, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  useDerivedValue,
  cancelAnimation,
} from "react-native-reanimated";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export type LumiState = "idle" | "listening" | "thinking" | "speaking";
export type LumiEmotion =
  | "calm" | "happy" | "gentle" | "thoughtful"
  | "encouraging" | "proud" | "listening";

type Props = {
  state: LumiState;
  emotion?: LumiEmotion;
  size?: number;
  bodyColor?: string;
};

/**
 * Lumi: a cute, animated pastel sprout companion.
 * - Idle: gentle breathing + slow blink
 * - Listening: taller ears (leaves perked), attentive eyes
 * - Thinking: slight head tilt + occasional look-up
 * - Speaking: rhythmic mouth open/close + subtle bounce
 */
export function LumiCharacter({
  state,
  emotion = "calm",
  size = 220,
  bodyColor = "#B7C9A8",
}: Props) {
  // Breathing / bounce
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, {
        duration: state === "speaking" ? 380 : state === "listening" ? 1400 : 2600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [state, breathe]);

  // Blink
  const blink = useSharedValue(1);
  useEffect(() => {
    const loop = () => {
      blink.value = withSequence(
        withDelay(2200 + Math.random() * 1800, withTiming(0.05, { duration: 90 })),
        withTiming(1, { duration: 120 }),
      );
    };
    const id = setInterval(loop, 3200);
    loop();
    return () => clearInterval(id);
  }, [blink]);

  // Mouth open (for speaking)
  const mouth = useSharedValue(0);
  useEffect(() => {
    if (state === "speaking") {
      mouth.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 180 + Math.random() * 80, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.2, { duration: 160 + Math.random() * 80, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      mouth.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(mouth);
  }, [state, mouth]);

  // Head tilt (thinking / listening)
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (state === "thinking") {
      tilt.value = withRepeat(
        withSequence(
          withTiming(6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(-2, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else if (state === "listening") {
      tilt.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 700 }),
          withTiming(-3, { duration: 700 }),
        ),
        -1,
        true,
      );
    } else {
      tilt.value = withTiming(0, { duration: 400 });
    }
    return () => cancelAnimation(tilt);
  }, [state, tilt]);

  // Overall body wrapper animation (bounce/breathing)
  const containerStyle = useAnimatedStyle(() => {
    const scale =
      state === "speaking"
        ? 1 + breathe.value * 0.025
        : state === "listening"
          ? 1 + breathe.value * 0.015
          : 1 + breathe.value * 0.035;
    const translateY =
      state === "idle"
        ? interpolate(breathe.value, [0, 1], [0, -4])
        : state === "speaking"
          ? interpolate(breathe.value, [0, 1], [0, -6])
          : 0;
    return {
      transform: [
        { translateY },
        { rotate: `${tilt.value}deg` },
        { scale },
      ],
    };
  });

  // Eye blink (scale eyes vertically)
  const eyeScaleY = useDerivedValue(() => blink.value);

  // Emotion-based color tint on cheeks
  const cheekColor =
    emotion === "happy" || emotion === "proud" || emotion === "encouraging"
      ? "#F0B29A"
      : emotion === "thoughtful"
        ? "#D8C4A3"
        : "#EAB79E";

  // Eye shape based on emotion
  const isHappyEye = emotion === "happy" || emotion === "proud" || emotion === "encouraging";
  // Mouth width for emotion
  const smileFactor =
    emotion === "happy" ? 1.4 :
    emotion === "encouraging" ? 1.2 :
    emotion === "proud" ? 1.1 :
    emotion === "thoughtful" ? 0.8 :
    1.0;

  const leftEyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeScaleY.value }],
  }));
  const rightEyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeScaleY.value }],
  }));

  // Mouth path — closed smile vs open O
  const mouthStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.4 + mouth.value * 1.2 }],
  }));

  // Leaf sway (listening = perked)
  const leafSwayLeft = useSharedValue(0);
  const leafSwayRight = useSharedValue(0);
  useEffect(() => {
    const dur = state === "listening" ? 500 : 1600;
    leafSwayLeft.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
    leafSwayRight.value = withRepeat(
      withSequence(
        withTiming(4, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
    return () => {
      cancelAnimation(leafSwayLeft);
      cancelAnimation(leafSwayRight);
    };
  }, [state, leafSwayLeft, leafSwayRight]);

  const leafLeftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leafSwayLeft.value}deg` }],
  }));
  const leafRightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leafSwayRight.value}deg` }],
  }));

  // Body color slight shift with emotion
  const bodyFill = emotion === "happy" ? "#B9CCA5" : emotion === "proud" ? "#BFD1A8" : bodyColor;

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <Animated.View style={[styles.absCenter, containerStyle]}>
        <Svg width={size} height={size} viewBox="0 0 220 220">
          {/* Soft aura behind body */}
          <Defs>
            <RadialGradient id="aura" cx="50%" cy="55%" r="55%">
              <Stop offset="0%" stopColor="#EAE5D9" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#FDFBF7" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="110" cy="120" r="100" fill="url(#aura)" />

          {/* Leaves (sprout on top) */}
          <G>
            <Animated.View />
          </G>
          <G origin="110, 40">
            <Animated.View style={{ position: "absolute" }} />
          </G>
        </Svg>

        {/* Leaves as animated overlays for tilting */}
        <View style={[styles.leafWrap, { width: size, height: size }]} pointerEvents="none">
          <Animated.View style={[styles.leafLeft, leafLeftStyle, { left: size * 0.42, top: size * 0.04 }]}>
            <Svg width={size * 0.14} height={size * 0.14} viewBox="0 0 40 40">
              <Path d="M20 38 C 5 30, 5 12, 20 4 C 22 14, 22 28, 20 38 Z" fill="#8FA97C" />
              <Path d="M20 36 L20 8" stroke="#6E8A5B" strokeWidth="1.4" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.leafRight, leafRightStyle, { left: size * 0.5, top: size * 0.06 }]}>
            <Svg width={size * 0.14} height={size * 0.14} viewBox="0 0 40 40">
              <Path d="M20 38 C 35 30, 35 12, 20 4 C 18 14, 18 28, 20 38 Z" fill="#98B084" />
              <Path d="M20 36 L20 8" stroke="#6E8A5B" strokeWidth="1.4" />
            </Svg>
          </Animated.View>
        </View>

        {/* Body */}
        <Svg width={size} height={size} viewBox="0 0 220 220" style={StyleSheet.absoluteFill}>
          {/* body */}
          <Path
            d="M110 40
               C 60 40, 40 90, 46 130
               C 50 170, 80 195, 110 195
               C 140 195, 170 170, 174 130
               C 180 90, 160 40, 110 40 Z"
            fill={bodyFill}
          />
          {/* hood shadow */}
          <Path
            d="M110 40
               C 60 40, 40 90, 46 130
               C 50 132, 60 100, 110 100
               C 160 100, 170 132, 174 130
               C 180 90, 160 40, 110 40 Z"
            fill="#A5B995"
            opacity="0.55"
          />
          {/* face mask (lighter oval) */}
          <Ellipse cx="110" cy="128" rx="52" ry="46" fill="#F2F0D9" opacity="0.55" />

          {/* cheeks */}
          <Circle cx="82" cy="140" r="8" fill={cheekColor} opacity="0.7" />
          <Circle cx="138" cy="140" r="8" fill={cheekColor} opacity="0.7" />

          {/* nose hint */}
          <Circle cx="110" cy="130" r="1.5" fill="#5C5C58" opacity="0.35" />
        </Svg>

        {/* Eyes with blink */}
        <View pointerEvents="none" style={[styles.face, { width: size, height: size }]}>
          <Animated.View style={[styles.eye, leftEyeStyle, { left: size * 0.415, top: size * 0.55 }]}>
            {isHappyEye ? (
              <Svg width={20} height={12} viewBox="0 0 20 12">
                <Path d="M2 10 Q10 -2 18 10" stroke="#2A2A28" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </Svg>
            ) : (
              <Svg width={16} height={16} viewBox="0 0 16 16">
                <Ellipse cx="8" cy="8" rx="4.5" ry="6" fill="#2A2A28" />
                <Circle cx="10" cy="6" r="1.6" fill="#FDFBF7" />
              </Svg>
            )}
          </Animated.View>
          <Animated.View style={[styles.eye, rightEyeStyle, { left: size * 0.535, top: size * 0.55 }]}>
            {isHappyEye ? (
              <Svg width={20} height={12} viewBox="0 0 20 12">
                <Path d="M2 10 Q10 -2 18 10" stroke="#2A2A28" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </Svg>
            ) : (
              <Svg width={16} height={16} viewBox="0 0 16 16">
                <Ellipse cx="8" cy="8" rx="4.5" ry="6" fill="#2A2A28" />
                <Circle cx="10" cy="6" r="1.6" fill="#FDFBF7" />
              </Svg>
            )}
          </Animated.View>

          {/* Mouth */}
          <Animated.View style={[styles.mouth, mouthStyle, { left: size * 0.5 - 8, top: size * 0.68 }]}>
            <Svg width={16 * smileFactor} height={12} viewBox="0 0 16 12">
              {state === "speaking" ? (
                <Ellipse cx={8 * smileFactor} cy="6" rx={4 * smileFactor} ry="5" fill="#5C3A3A" />
              ) : (
                <Path
                  d={`M2 3 Q ${8 * smileFactor} ${8 * smileFactor + 2} ${14 * smileFactor} 3`}
                  stroke="#4A2E2E" strokeWidth="2.4" fill="none" strokeLinecap="round"
                />
              )}
            </Svg>
          </Animated.View>
        </View>

        {/* Small paws / hands hint */}
        <Svg width={size} height={size} viewBox="0 0 220 220" style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ellipse cx="70" cy="175" rx="14" ry="12" fill="#A5B995" />
          <Ellipse cx="150" cy="175" rx="14" ry="12" fill="#A5B995" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  absCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  leafWrap: { position: "absolute" },
  leafLeft: { position: "absolute", transformOrigin: "bottom" as any },
  leafRight: { position: "absolute", transformOrigin: "bottom" as any },
  face: { position: "absolute" },
  eye: { position: "absolute", alignItems: "center", justifyContent: "center" },
  mouth: { position: "absolute", alignItems: "center", justifyContent: "center" },
});

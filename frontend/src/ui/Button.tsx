import React from "react";
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle, StyleProp, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, type, radius } from "@/src/theme";

type IconName = keyof typeof Feather.glyphMap;

type Common = {
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/* ---- PrimaryButton — big pill CTA (Headspace vibe) ---- */
export function PrimaryButton({
  label, onPress, disabled, loading, icon, iconRight, fullWidth = true, testID, style,
}: Common) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        fullWidth && { alignSelf: "stretch" },
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={18} color="#FFFFFF" /> : null}
          {label ? <Text style={styles.primaryText}>{label}</Text> : null}
          {iconRight ? <Feather name={iconRight} size={18} color="#FFFFFF" /> : null}
        </View>
      )}
    </Pressable>
  );
}

/* ---- SecondaryButton — bordered, monochrome ---- */
export function SecondaryButton({
  label, onPress, disabled, loading, icon, iconRight, fullWidth = true, testID, style,
}: Common) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.secondary,
        fullWidth && { alignSelf: "stretch" },
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={18} color={colors.ink} /> : null}
          {label ? <Text style={styles.secondaryText}>{label}</Text> : null}
          {iconRight ? <Feather name={iconRight} size={18} color={colors.ink} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/* ---- IconButton — circular action (mic, refresh, etc.) ---- */
export function IconButton({
  icon, onPress, disabled, size = 44, tint = colors.bgAlt, iconColor = colors.ink, testID, style,
}: {
  icon: IconName;
  onPress?: () => void;
  disabled?: boolean;
  size?: number;
  tint?: string;
  iconColor?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: tint,
          alignItems: "center", justifyContent: "center",
        },
        disabled && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
        style,
      ]}
    >
      <Feather name={icon} size={size >= 56 ? 22 : 18} color={iconColor} />
    </Pressable>
  );
}

/* ---- TextButton — subtle link-like button ---- */
export function TextButton({
  label, onPress, tint = colors.ink, testID, style,
}: {
  label: string;
  onPress?: () => void;
  tint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [{ paddingVertical: 8 }, pressed && { opacity: 0.6 }, style]}
    >
      <Text style={{ ...type.body, color: tint, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primary: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    alignItems: "center", justifyContent: "center",
    minHeight: 52,
  },
  primaryText: {
    ...type.bodyLarge, color: "#FFFFFF", fontWeight: "600",
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    alignItems: "center", justifyContent: "center",
    minHeight: 52,
  },
  secondaryText: { ...type.bodyLarge, color: colors.ink, fontWeight: "600" },
});

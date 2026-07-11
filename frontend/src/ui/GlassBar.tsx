import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { colors, spacing, type } from "@/src/theme";

/**
 * GlassBar — blurred sticky top bar used across screens.
 * Only used on top bars & tab bar per design system rules.
 */
export function GlassBar({
  title,
  subtitle,
  left,
  right,
  children,
  compact = false,
  style,
  testID,
}: {
  title?: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.wrap, style]}>
      <BlurView
        intensity={Platform.OS === "web" ? 60 : 40}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.overlay, compact && styles.overlayCompact]}>
        {(title || subtitle || left || right) && (
          <View style={styles.row}>
            {left ? <View style={styles.left}>{left}</View> : null}
            <View style={{ flex: 1 }}>
              {subtitle ? <Text style={styles.eyebrow}>{subtitle}</Text> : null}
              {title ? <Text style={styles.title}>{title}</Text> : null}
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
          </View>
        )}
        {children}
      </View>
      <View style={styles.hairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.glass,
    overflow: "hidden",
  },
  overlay: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  overlayCompact: { paddingVertical: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  left: {},
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  eyebrow: { ...type.overline },
  title: { ...type.h2, marginTop: 2 },
  hairline: { height: 1, backgroundColor: colors.border, opacity: 0.6 },
});

import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
import { colors, spacing, type, radius, elevation } from "@/src/theme";
import { Feather } from "@expo/vector-icons";

/* =========================================================================
 * Card — standard content surface (Apple Health-style rounded card)
 * ======================================================================= */
export function Card({
  children,
  style,
  padding = spacing.xl,
  tone = "default",
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  tone?: "default" | "flat" | "tinted" | "outlined";
  testID?: string;
}) {
  const toneStyle: ViewStyle =
    tone === "flat"
      ? { backgroundColor: colors.bgAlt }
      : tone === "tinted"
        ? { backgroundColor: colors.lumiSoft }
        : tone === "outlined"
          ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }
          : { backgroundColor: colors.card, ...elevation.sm };
  return (
    <View testID={testID} style={[{ borderRadius: radius.lg, padding }, toneStyle, style]}>
      {children}
    </View>
  );
}

/* =========================================================================
 * MetricCard — Apple Health-style single-metric card
 * ======================================================================= */
export function MetricCard({
  value, label, hint, tint = colors.lumiSoft, icon,
  style, testID,
}: {
  value: string | number;
  label: string;
  hint?: string;
  tint?: string;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.metric, style]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricDot, { backgroundColor: tint }]}>
          {icon && <Feather name={icon} size={12} color={colors.ink} />}
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

/* =========================================================================
 * SectionHeader — title + optional caption + optional right slot
 * ======================================================================= */
export function SectionHeader({
  title, caption, right, style, testID,
}: {
  title: string;
  caption?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.sectionRow, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/* =========================================================================
 * PillTag — small labeled pill
 * ======================================================================= */
export function PillTag({
  label, tint = colors.bgAlt, textColor = colors.ink, style, testID,
}: {
  label: string;
  tint?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.pillTag, { backgroundColor: tint }, style]}>
      <Text style={[styles.pillTagText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

/* =========================================================================
 * StreakBadge — flame + count
 * ======================================================================= */
export function StreakBadge({ count, active = true, style }: { count: number; active?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        styles.streakBadge,
        { backgroundColor: active ? colors.flameSoft : colors.bgAlt, opacity: active ? 1 : 0.7 },
        style,
      ]}
    >
      <Feather name="zap" size={12} color={active ? colors.flame : colors.inkFaint} />
      <Text style={[styles.streakText, { color: active ? "#7A4E14" : colors.inkFaint }]}>
        {count}
      </Text>
    </View>
  );
}

/* =========================================================================
 * EmptyState — friendly zero-state
 * ======================================================================= */
export function EmptyState({
  title, subtitle, icon = "inbox", testID,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={22} color={colors.inkMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...elevation.sm,
    gap: spacing.md,
    flex: 1,
  },
  metricHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metricDot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  metricLabel: { ...type.overline },
  metricValue: { ...type.number, fontSize: 30, lineHeight: 34 },
  metricHint: { ...type.caption },

  sectionRow: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.lg,
  },
  sectionTitle: { ...type.h3 },
  sectionCaption: { ...type.caption, marginTop: 2 },

  pillTag: {
    paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  pillTagText: { ...type.overline, color: colors.ink },

  streakBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  streakText: { fontSize: 12, fontWeight: "700" },

  empty: {
    alignItems: "center", justifyContent: "center", padding: spacing.xxxl, gap: spacing.md,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bgAlt,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { ...type.h3, textAlign: "center" },
  emptySub: { ...type.body, color: colors.inkMuted, textAlign: "center", maxWidth: 280 },
});

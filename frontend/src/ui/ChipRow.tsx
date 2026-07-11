import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { colors, spacing, type, radius } from "@/src/theme";

/**
 * A horizontal scroller of pill filter chips (Notion Calendar-inspired).
 * Chips never wrap — extra chips scroll off the right edge.
 */
export function ChipRow<T extends string>({
  items,
  selected,
  onSelect,
  testIDPrefix = "chip",
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {items.map((it) => {
        const active = selected === it;
        return (
          <Pressable
            key={it}
            testID={`${testIDPrefix}-${it.toLowerCase()}`}
            onPress={() => onSelect(it)}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : styles.chipIdle,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{it}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { height: 56 },
  row: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
    height: 56,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  chipIdle: { backgroundColor: colors.card, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { ...type.body, fontSize: 13, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: "#FFFFFF" },
});

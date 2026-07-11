import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, View, StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import { colors, spacing, type } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarShowLabel: true,
        tabBarLabelStyle: { ...type.overline, fontSize: 10, letterSpacing: 0.6, marginBottom: 4 },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              intensity={Platform.OS === "web" ? 60 : 45}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
            <View style={styles.hairline} />
          </View>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 10,
          elevation: 0,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => <TabIcon name="sun" color={color} focused={focused} />,
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Lumi",
          tabBarIcon: ({ color, focused }) => <TabIcon name="message-circle" color={color} focused={focused} />,
          tabBarButtonTestID: "tab-chat",
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={color} focused={focused} />,
          tabBarButtonTestID: "tab-events",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => <TabIcon name="user" color={color} focused={focused} />,
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather name={name} size={19} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  iconWrapActive: { backgroundColor: colors.lumiSoft },
  hairline: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.6 },
});

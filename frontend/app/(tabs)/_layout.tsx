import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";
import { Platform, View, StyleSheet } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.onSurface,
        tabBarInactiveTintColor: theme.colors.onSurfaceTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontFamily: theme.font.body, fontSize: 11, fontWeight: "600", marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 8,
        },
        sceneStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
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
      <Feather name={name} size={20} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.pill,
  },
  iconWrapActive: { backgroundColor: theme.colors.surfaceSecondary },
});

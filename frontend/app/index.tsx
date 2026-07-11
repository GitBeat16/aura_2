import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View testID="root-loading" style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.lumi} />
      </View>
    );
  }
  if (!user) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}

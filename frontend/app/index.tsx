import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useApp } from "@/src/app-context";
import { useTheme } from "@/src/theme";

export default function Gate() {
  const { ready, signedIn, guest } = useApp();
  const { colors } = useTheme();
  if (!ready)
    return (
      <View testID="app-loading" style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  return <Redirect href={signedIn || guest ? "/home" : "/auth"} />;
}

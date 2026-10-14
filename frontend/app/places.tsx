import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlacesList } from "@/src/components/places-list";
import { StackHeader } from "@/src/components/ui";
import { spacing, useTheme } from "@/src/theme";

export default function PlacesScreen() {
  const { q, title } = useLocalSearchParams<{ q: string; title?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={title ?? q} />
      <PlacesList query={q ?? ""} bottomPad={insets.bottom} header={<View style={{ height: spacing.lg }} />} />
    </View>
  );
}

import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { CompassIcon, HeartIcon, HouseIcon, NewspaperIcon } from "phosphor-react-native";
import { Platform } from "react-native";

import { useApp } from "@/src/app-context";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { t } = useApp();
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>{t("tabHome")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore">
          <NativeTabs.Trigger.Icon sf="safari.fill" />
          <NativeTabs.Trigger.Label>{t("tabExplore")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="news">
          <NativeTabs.Trigger.Icon sf="newspaper.fill" />
          <NativeTabs.Trigger.Label>{t("tabNews")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="life">
          <NativeTabs.Trigger.Icon sf="heart.fill" />
          <NativeTabs.Trigger.Label>{t("tabLife")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const icon = (Icon: typeof HouseIcon) =>
    function TabIcon({ focused, color }: { focused: boolean; color: import("react-native").ColorValue }) {
      return <Icon size={24} color={color as string} weight={focused ? "fill" : "regular"} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t("tabHome"), tabBarIcon: icon(HouseIcon), tabBarButtonTestID: "tab-home" }} />
      <Tabs.Screen name="explore" options={{ title: t("tabExplore"), tabBarIcon: icon(CompassIcon), tabBarButtonTestID: "tab-explore" }} />
      <Tabs.Screen name="news" options={{ title: t("tabNews"), tabBarIcon: icon(NewspaperIcon), tabBarButtonTestID: "tab-news" }} />
      <Tabs.Screen name="life" options={{ title: t("tabLife"), tabBarIcon: icon(HeartIcon), tabBarButtonTestID: "tab-life" }} />
    </Tabs>
  );
}

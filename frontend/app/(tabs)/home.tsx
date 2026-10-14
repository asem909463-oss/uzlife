import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowSquareOutIcon,
  BellIcon,
  CalendarBlankIcon,
  CompassIcon,
  LightningIcon,
  MegaphoneIcon,
  NewspaperIcon,
  SparkleIcon,
  StorefrontIcon,
  UserCircleIcon,
  WrenchIcon,
} from "phosphor-react-native";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { type Article, NewsRow } from "@/src/components/news-card";
import { type Place, PlaceMini } from "@/src/components/place-card";
import { HERO_IMG, Pressy, SectionTitle, Txt } from "@/src/components/ui";
import { CITY_NAMES, type TKey } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { radius, spacing, useTheme } from "@/src/theme";

function greetingKey(): TKey {
  const h = new Date().getHours();
  return h < 5 ? "greetNight" : h < 12 ? "greetMorning" : h < 18 ? "greetDay" : h < 23 ? "greetEvening" : "greetNight";
}

export default function Home() {
  const { t, profile, signedIn, city, lang, config } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const f = config?.features;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const recs = useQuery<{ items: Place[] }>({ queryKey: ["recs", city, lang], queryFn: () => api(`/life/recommendations?city=${city}&lang=${lang}`), enabled: f?.explore !== false });
  const news = useQuery<{ items: Article[] }>({ queryKey: ["news-home"], queryFn: () => api("/news?category=all&limit=4"), enabled: f?.news !== false });
  const reminders = useQuery<any[]>({ queryKey: ["reminders"], queryFn: () => api("/life/reminders"), enabled: signedIn });
  const upcoming = (reminders.data ?? []).filter((r) => !r.done).slice(0, 3);

  const shortcuts = [
    { key: "explore", label: t("tabExplore"), Icon: CompassIcon, go: () => router.push("/explore"), on: f?.explore !== false },
    { key: "news", label: t("tabNews"), Icon: NewspaperIcon, go: () => router.push("/news"), on: f?.news !== false },
    { key: "services", label: t("servicesTitle"), Icon: WrenchIcon, go: () => router.push("/services"), on: f?.services !== false },
    { key: "market", label: t("marketTitle"), Icon: StorefrontIcon, go: () => router.push("/market"), on: f?.marketplace !== false },
    { key: "reminders", label: t("reminders"), Icon: BellIcon, go: () => router.push("/life"), on: true },
    { key: "plans", label: t("plans"), Icon: CalendarBlankIcon, go: () => router.push({ pathname: "/life", params: { tab: "plans" } }), on: true },
  ].filter((s) => s.on);

  const askFlash = (q?: string) => router.push(q ? { pathname: "/flash", params: { q } } : "/flash");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        testID="home-screen"
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={<RefreshControl refreshing={recs.isRefetching} onRefresh={() => { recs.refetch(); news.refetch(); reminders.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" color={colors.muted}>{dayjs().format("dddd, D MMMM")} · {CITY_NAMES[city]?.[lang]}</Txt>
            <Txt variant="title" testID="home-greeting" numberOfLines={1}>
              {t(greetingKey())}{profile?.name ? `, ${profile.name}` : ""}
            </Txt>
          </View>
          <Pressy testID="home-profile-button" onPress={() => router.push("/profile")} style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
            {profile?.avatar_url ? <Image source={profile.avatar_url} style={{ width: 48, height: 48 }} /> : <UserCircleIcon size={28} color={colors.brandPrimary} />}
          </Pressy>
        </View>

        {!!config?.announcement && (
          <View testID="home-announcement" style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandTertiary, flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <MegaphoneIcon size={20} color={colors.brandPrimary} />
            <Txt variant="label" color={colors.onSurface} style={{ flex: 1 }}>{config.announcement}</Txt>
          </View>
        )}

        {f?.flash_ai !== false && (
          <Animated.View entering={FadeInDown.duration(500)}>
            <Pressy testID="home-flash-hero" onPress={() => askFlash()} style={{ marginHorizontal: spacing.lg, height: 280, borderRadius: 28, overflow: "hidden", backgroundColor: colors.surfaceSecondary }}>
              <Image source={HERO_IMG} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
              <LinearGradient colors={[colors.transparent, colors.scrimMid, colors.scrimEnd]} locations={[0, 0.45, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ flex: 1, justifyContent: "flex-end", padding: spacing.xl, gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                    <LightningIcon size={16} color={colors.onBrandPrimary} weight="fill" />
                  </View>
                  <Txt variant="eyebrow" color={colors.brandPrimary}>{t("heroEyebrow")}</Txt>
                </View>
                <Txt variant="display">Flash AI</Txt>
                <View style={{ height: 48, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                  <SparkleIcon size={18} color={colors.brandPrimary} />
                  <Txt color={colors.onSurfaceTertiary}>{t("heroPlaceholder")}</Txt>
                </View>
              </View>
            </Pressy>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              {(["promptPlaces", "promptPlan", "promptNews"] as TKey[]).map((k, i) => (
                <Pressy key={k} testID={`home-prompt-${i}`} onPress={() => askFlash(t(k))} style={{ maxWidth: 240, flexShrink: 0, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                  <Txt variant="label" color={colors.onSurfaceSecondary} numberOfLines={2}>{t(k)}</Txt>
                </Pressy>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title={t("shortcuts")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
            {shortcuts.map(({ key, label, Icon, go }) => (
              <Pressy key={key} testID={`home-shortcut-${key}`} onPress={go} style={{ width: 96, height: 96, borderRadius: radius.lg, padding: spacing.md, justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
                  <Icon size={20} color={colors.brandPrimary} />
                </View>
                <Txt variant="label" numberOfLines={1}>{label}</Txt>
              </Pressy>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionTitle title={t("yourDay")} action={t("seeAll")} onAction={() => router.push("/life")} testID="home-day-see-all" />
          <View testID="home-day-card" style={{ marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: spacing.md }}>
            {!signedIn ? (
              <Pressy testID="home-signin-cta" onPress={() => router.push("/profile")}>
                <Txt color={colors.onSurfaceSecondary}>{t("signInToUse")}</Txt>
                <Txt variant="label" color={colors.brandPrimary} style={{ marginTop: spacing.sm }}>{t("signIn")} →</Txt>
              </Pressy>
            ) : upcoming.length === 0 ? (
              <Txt color={colors.onSurfaceSecondary}>{t("noUpcoming")}</Txt>
            ) : (
              upcoming.map((r) => (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
                    <BellIcon size={18} color={colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong" numberOfLines={1}>{r.title}</Txt>
                    {r.due_at && <Txt variant="caption" color={colors.muted}>{dayjs(r.due_at).format("D MMM, HH:mm")}</Txt>}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {f?.explore !== false && (recs.data?.items?.length ?? 0) > 0 && (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionTitle title={t("forYouNow")} action={t("seeAll")} onAction={() => router.push("/explore")} testID="home-recs-see-all" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
              {recs.data!.items.map((p, i) => <PlaceMini key={p.id} place={p} testID={`home-rec-${i}`} />)}
            </ScrollView>
          </View>
        )}

        {f?.news !== false && (news.data?.items?.length ?? 0) > 0 && (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionTitle title={t("topNews")} action={t("seeAll")} onAction={() => router.push("/news")} testID="home-news-see-all" />
            {news.data!.items.map((a, i) => <NewsRow key={a.id} a={a} testID={`home-news-${i}`} />)}
          </View>
        )}

        {!!config?.website_url && (
          <Pressy testID="home-website-link" onPress={() => WebBrowser.openBrowserAsync(config.website_url)} style={{ marginHorizontal: spacing.lg, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{t("ourWebsite")}</Txt>
              <Txt variant="caption" color={colors.muted}>{t("ourWebsiteSub")}</Txt>
            </View>
            <ArrowSquareOutIcon size={22} color={colors.brandPrimary} />
          </Pressy>
        )}
      </ScrollView>
    </View>
  );
}

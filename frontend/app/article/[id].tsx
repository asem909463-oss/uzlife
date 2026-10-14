import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowSquareOutIcon, BookmarkSimpleIcon, CaretLeftIcon, ShareNetworkIcon, SparkleIcon, TranslateIcon } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Share, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { type Article } from "@/src/components/news-card";
import { Button, ErrorState, Glass, Loader, NEWS_PLACEHOLDER, Pressy, Txt, useToast } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, signedIn } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<"summary" | "translate" | null>(null);

  const q = useQuery<Article>({ queryKey: ["article", id], queryFn: () => api(`/news/article/${id}`) });
  const bm = useQuery<any[]>({ queryKey: ["bookmarks"], queryFn: () => api("/news/bookmarks"), enabled: signedIn });
  const isSaved = !!bm.data?.some((b) => b.article_id === id);
  const ai = useQuery<any>({
    queryKey: ["news-ai", id, lang, mode],
    queryFn: () => api("/news/ai", { method: "POST", body: { article_id: id, lang, mode } }),
    enabled: !!mode && !!q.data,
    staleTime: Infinity,
    retry: 1,
  });

  const toggleBm = useMutation({
    mutationFn: () => {
      const a = q.data!;
      return isSaved
        ? api(`/news/bookmarks/${id}`, { method: "DELETE" })
        : api("/news/bookmarks", { method: "POST", body: { article_id: a.id, title: a.title, url: a.url, source: a.source, image: a.image, category: a.category, published_at: a.published_at } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      toast(isSaved ? t("deleted") : t("bookmarked"));
    },
  });

  const back = (
    <Pressy testID="article-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/news"))} style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass }}>
      <CaretLeftIcon size={20} color={colors.onSurface} weight="bold" />
    </Pressy>
  );

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 80 }}><Loader />{back}</View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 80 }}><ErrorState onRetry={q.refetch} />{back}</View>;
  const a = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView testID="article-screen" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ height: 320 }}>
          <Image source={a.image || NEWS_PLACEHOLDER} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
          <LinearGradient colors={[colors.scrimMid, colors.transparent, colors.surface]} locations={[0, 0.4, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -spacing.xl }}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <Txt variant="label" color={colors.brandPrimary}>{a.source}</Txt>
            <Txt variant="caption" color={colors.muted}>· {dayjs(a.published_at).format("D MMMM, HH:mm")}</Txt>
          </View>
          <Txt variant="title" testID="article-title">{a.title}</Txt>
          {!!a.summary && <Txt color={colors.onSurfaceSecondary} style={{ fontSize: 16, lineHeight: 25 }}>{a.summary}</Txt>}

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="article-ai-summary-button" kind={mode === "summary" ? "primary" : "secondary"} label={t("aiSummary")} icon={<SparkleIcon size={18} color={mode === "summary" ? colors.onBrandPrimary : colors.brandPrimary} weight="fill" />} onPress={() => setMode("summary")} style={{ flex: 1, paddingHorizontal: spacing.md }} />
            <Button testID="article-translate-button" kind={mode === "translate" ? "primary" : "secondary"} label={t("translate")} icon={<TranslateIcon size={18} color={mode === "translate" ? colors.onBrandPrimary : colors.brandPrimary} />} onPress={() => setMode("translate")} style={{ flex: 1, paddingHorizontal: spacing.md }} />
          </View>

          {mode && (
            <Animated.View entering={FadeInDown}>
              <Glass style={{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
                {ai.isLoading ? (
                  <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                    <ActivityIndicator color={colors.brandPrimary} />
                    <Txt color={colors.muted}>{t("aiWorking")}</Txt>
                  </View>
                ) : ai.isError ? (
                  <Txt color={colors.error}>{t("aiError")}</Txt>
                ) : ai.data ? (
                  <View testID="article-ai-result" style={{ gap: spacing.md }}>
                    <Txt variant="h3">{ai.data.title}</Txt>
                    {mode === "summary" &&
                      (ai.data.bullets ?? []).map((b: string, i: number) => (
                        <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                          <Txt color={colors.brandPrimary}>•</Txt>
                          <Txt style={{ flex: 1 }} color={colors.onSurfaceSecondary}>{b}</Txt>
                        </View>
                      ))}
                    {mode === "summary" && ai.data.why_it_matters && (
                      <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, gap: 4 }}>
                        <Txt variant="eyebrow" color={colors.brandPrimary}>{t("whyMatters")}</Txt>
                        <Txt color={colors.onSurface}>{ai.data.why_it_matters}</Txt>
                      </View>
                    )}
                    {mode === "translate" && <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 24 }}>{ai.data.text}</Txt>}
                  </View>
                ) : null}
              </Glass>
            </Animated.View>
          )}

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressy testID="article-bookmark-button" onPress={() => (signedIn ? toggleBm.mutate() : router.push("/profile"))} style={{ flex: 1, height: 52, borderRadius: radius.pill, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: isSaved ? colors.brandTertiary : colors.surfaceSecondary, borderWidth: 1, borderColor: isSaved ? colors.brandPrimary : colors.border }}>
              <BookmarkSimpleIcon size={18} color={colors.brandPrimary} weight={isSaved ? "fill" : "regular"} />
              <Txt variant="label">{isSaved ? t("bookmarked") : t("bookmark")}</Txt>
            </Pressy>
            <Pressy testID="article-share-button" onPress={() => Share.share({ message: `${a.title}\n${a.url}` })} style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
              <ShareNetworkIcon size={20} color={colors.onSurface} />
            </Pressy>
          </View>
          <Button testID="article-open-original-button" label={t("openOriginal")} icon={<ArrowSquareOutIcon size={18} color={colors.onBrandPrimary} />} onPress={() => WebBrowser.openBrowserAsync(a.url)} />
        </View>
      </ScrollView>
      {back}
    </View>
  );
}

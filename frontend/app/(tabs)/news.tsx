import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { MagnifyingGlassIcon, XIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { type Article, NewsHero, NewsRow } from "@/src/components/news-card";
import { Chip, ChipRow, EmptyState, ErrorState, FeatureOff, Loader, Pressy, Txt } from "@/src/components/ui";
import { type TKey } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

const CATS: { id: string; key: TKey }[] = [
  { id: "all", key: "nAll" },
  { id: "breaking", key: "nBreaking" },
  { id: "uzbekistan", key: "nUz" },
  { id: "world", key: "nWorld" },
  { id: "business", key: "nBusiness" },
  { id: "tech", key: "nTech" },
  { id: "sports", key: "nSports" },
  { id: "saved", key: "nSaved" },
];

export default function News() {
  const { t, config, signedIn } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const feed = useQuery<{ items: Article[]; updated_at: string }>({
    queryKey: ["news", cat, q],
    queryFn: () => api(`/news?category=${cat}&q=${encodeURIComponent(q)}&limit=50`),
    enabled: cat !== "saved",
    refetchInterval: 5 * 60_000,
  });
  const saved = useQuery<any[]>({ queryKey: ["bookmarks"], queryFn: () => api("/news/bookmarks"), enabled: cat === "saved" && signedIn });

  if (config?.features.news === false) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}><FeatureOff /></View>;

  const items: Article[] =
    cat === "saved"
      ? (saved.data ?? []).map((b) => ({ id: b.article_id, title: b.title, url: b.url, image: b.image, source: b.source, category: b.category, published_at: b.published_at || b.created_at, summary: "", region: "", lang: "" }))
      : feed.data?.items ?? [];
  const active = cat === "saved" ? saved : feed;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Txt variant="title">{t("newsTitle")}</Txt>
            {feed.data?.updated_at && <Txt variant="caption" color={colors.muted} testID="news-updated-at">{t("updatedAt")} {dayjs(feed.data.updated_at).fromNow()}</Txt>}
          </View>
          <Pressy testID="news-search-toggle" onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) { setText(""); setQ(""); } }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}>
            {searchOpen ? <XIcon size={20} color={colors.onSurface} /> : <MagnifyingGlassIcon size={20} color={colors.onSurface} />}
          </Pressy>
        </View>
        {searchOpen && (
          <View style={{ marginHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.lg, justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
            <TextInput
              testID="news-search-input"
              autoFocus
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => { setQ(text.trim()); if (cat === "saved") setCat("all"); }}
              returnKeyType="search"
              placeholder={t("searchNews")}
              placeholderTextColor={colors.muted}
              selectionColor={colors.brandPrimary}
              style={{ color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15, height: 48 }}
            />
          </View>
        )}
        <ChipRow testID="news-category-chips">
          {CATS.map((c) => <Chip key={c.id} testID={`news-cat-${c.id}`} label={t(c.key)} active={cat === c.id} onPress={() => setCat(c.id)} />)}
        </ChipRow>
      </View>
      <FlatList
        testID="news-list"
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}
        renderItem={({ item, index }) => (index === 0 && cat !== "saved" ? <View style={{ marginBottom: spacing.md }}><NewsHero a={item} testID="news-hero" /></View> : <NewsRow a={item} testID={`news-row-${index}`} />)}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.lg }} />}
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={active.refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={
          cat === "saved" && !signedIn ? (
            <EmptyState title={t("noBookmarks")} subtitle={t("signInToUse")} />
          ) : active.isLoading ? (
            <Loader />
          ) : active.isError ? (
            <ErrorState onRetry={active.refetch} />
          ) : (
            <EmptyState title={cat === "saved" ? t("noBookmarks") : t("noNews")} />
          )
        }
      />
    </View>
  );
}

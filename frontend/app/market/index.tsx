import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ImageSquareIcon, MagnifyingGlassIcon, PlusIcon } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Chip, ChipRow, EmptyState, ErrorState, FeatureOff, Loader, Pressy, StackHeader, Txt } from "@/src/components/ui";
import { formatPrice, MARKET_CATS } from "@/src/market";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

export default function Market() {
  const { t, signedIn, config } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cat, setCat] = useState("all");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  const list = useQuery<any[]>({
    queryKey: ["listings", cat, q],
    queryFn: () => (cat === "mine" ? api("/market/mine") : api(`/market/listings?category=${cat}&q=${encodeURIComponent(q)}`)),
  });

  if (config?.features.marketplace === false)
    return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title={t("marketTitle")} /><FeatureOff /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={t("marketTitle")} />
      <View style={{ paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <View style={{ marginHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
          <MagnifyingGlassIcon size={18} color={colors.muted} />
          <TextInput testID="market-search-input" value={text} onChangeText={(v) => { setText(v); if (!v) setQ(""); }} onSubmitEditing={() => setQ(text.trim())} returnKeyType="search" placeholder={t("search")} placeholderTextColor={colors.muted} selectionColor={colors.brandPrimary} style={{ flex: 1, height: 48, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 }} />
        </View>
        <ChipRow testID="market-category-chips">
          <Chip testID="market-cat-all" label={t("all")} active={cat === "all"} onPress={() => setCat("all")} />
          {signedIn && <Chip testID="market-cat-mine" label={t("myListings")} active={cat === "mine"} onPress={() => setCat("mine")} />}
          {MARKET_CATS.map((c) => <Chip key={c.id} testID={`market-cat-${c.id}`} label={t(c.key)} active={cat === c.id} onPress={() => setCat(c.id)} />)}
        </ChipRow>
      </View>
      <FlatList
        testID="market-list"
        data={list.data ?? []}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={list.refetch} tintColor={colors.brandPrimary} />}
        renderItem={({ item, index }) => (
          <Pressy testID={`market-item-${index}`} onPress={() => router.push(`/market/${item.id}`)} style={{ flex: 1, maxWidth: "100%", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
            {item.image_url ? (
              <Image source={item.image_url} style={{ height: 140 }} contentFit="cover" transition={200} />
            ) : (
              <View style={{ height: 140, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary }}>
                <ImageSquareIcon size={32} color={colors.muted} />
              </View>
            )}
            <View style={{ padding: spacing.md, gap: 4 }}>
              <Txt variant="bodyStrong" color={colors.brandPrimary} numberOfLines={1}>{formatPrice(item.price, t("priceOnRequest"))}</Txt>
              <Txt variant="label" numberOfLines={2}>{item.title}</Txt>
              <Txt variant="caption" color={colors.muted}>{dayjs(item.created_at).fromNow()}</Txt>
            </View>
          </Pressy>
        )}
        ListEmptyComponent={list.isLoading ? <Loader /> : list.isError ? <ErrorState onRetry={list.refetch} /> : <EmptyState title={t("noListings")} subtitle={t("noListingsSub")} />}
      />
      <Pressy
        testID="market-new-button"
        onPress={() => router.push(signedIn ? "/market/new" : "/profile")}
        style={{ position: "absolute", right: spacing.lg, bottom: insets.bottom + 16, height: 56, paddingHorizontal: spacing.xl, borderRadius: 28, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <PlusIcon size={18} color={colors.onBrandPrimary} weight="bold" />
        <Txt variant="bodyStrong" color={colors.onBrandPrimary}>{t("newListing")}</Txt>
      </Pressy>
    </View>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { CaretLeftIcon, ClockIcon, GlobeIcon, HeartIcon, LightningIcon, MapPinIcon, NavigationArrowIcon, PhoneIcon } from "phosphor-react-native";
import { useState } from "react";
import { Linking, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, photoUrl } from "@/src/api";
import { useApp } from "@/src/app-context";
import { OpenBadge, Rating } from "@/src/components/place-card";
import { Button, EMPTY_IMG, ErrorState, Loader, Pressy, Txt, useToast } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, signedIn } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);

  const q = useQuery<any>({ queryKey: ["place", id, lang], queryFn: () => api(`/places/${id}?lang=${lang}`) });
  const saved = useQuery<any[]>({ queryKey: ["saved-places"], queryFn: () => api("/life/saved-places"), enabled: signedIn });
  const isSaved = !!saved.data?.some((s) => s.place_id === id);

  const toggleSave = useMutation({
    mutationFn: async () => {
      const p = q.data;
      if (isSaved) return api(`/life/saved-places/${id}`, { method: "DELETE" });
      return api("/life/saved-places", { method: "POST", body: { place_id: p.id, name: p.name, address: p.address, rating: p.rating, photo: p.photo, lat: p.lat, lng: p.lng, category: p.type, maps_uri: p.maps_uri } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-places"] });
      toast(isSaved ? t("deleted") : t("saved"));
    },
  });

  const back = (
    <Pressy testID="place-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))} style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.glass }}>
      <CaretLeftIcon size={20} color={colors.onSurface} weight="bold" />
    </Pressy>
  );

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 80 }}><Loader />{back}</View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 80 }}><ErrorState onRetry={q.refetch} />{back}</View>;
  const p = q.data;
  const photos: string[] = p.photos?.length ? p.photos : [];

  const actions = [
    p.maps_uri && { key: "route", label: t("route"), Icon: NavigationArrowIcon, go: () => Linking.openURL(p.maps_uri) },
    p.phone && { key: "call", label: t("call"), Icon: PhoneIcon, go: () => Linking.openURL(`tel:${p.phone.replace(/\s/g, "")}`) },
    p.website && { key: "website", label: t("website"), Icon: GlobeIcon, go: () => WebBrowser.openBrowserAsync(p.website) },
  ].filter(Boolean) as { key: string; label: string; Icon: any; go: () => void }[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView testID="place-detail-screen" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ height: 360 }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {(photos.length ? photos : [null]).map((ph, i) => (
              <Image key={i} source={photoUrl(ph, 1200) ?? EMPTY_IMG} style={{ width, height: 360 }} contentFit="cover" transition={250} />
            ))}
          </ScrollView>
          <LinearGradient pointerEvents="none" colors={[colors.scrimMid, colors.transparent, colors.surface]} locations={[0, 0.4, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          {photos.length > 1 && (
            <View style={{ position: "absolute", bottom: spacing.lg, alignSelf: "center", flexDirection: "row", gap: 6 }}>
              {photos.map((_, i) => <View key={i} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? colors.brandPrimary : colors.borderStrong }} />)}
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: -spacing.sm }}>
          {p.type && <Txt variant="eyebrow" color={colors.brandPrimary}>{p.type}</Txt>}
          <Txt variant="title" testID="place-name">{p.name}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            <Rating value={p.rating} count={p.reviews_count} />
            <OpenBadge open={p.open_now} />
          </View>
          {p.address && (
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
              <MapPinIcon size={18} color={colors.muted} />
              <Txt color={colors.onSurfaceSecondary} style={{ flex: 1 }}>{p.address}</Txt>
            </View>
          )}
          {p.summary && <Txt color={colors.onSurfaceTertiary}>{p.summary}</Txt>}

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            {actions.map(({ key, label, Icon, go }) => (
              <Pressy key={key} testID={`place-action-${key}`} onPress={go} style={{ flex: 1, height: 72, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                <Icon size={22} color={colors.brandPrimary} />
                <Txt variant="caption">{label}</Txt>
              </Pressy>
            ))}
            <Pressy
              testID="place-save-button"
              onPress={() => (signedIn ? toggleSave.mutate() : router.push("/profile"))}
              style={{ flex: 1, height: 72, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: isSaved ? colors.brandTertiary : colors.surfaceSecondary, borderWidth: 1, borderColor: isSaved ? colors.brandPrimary : colors.border }}
            >
              <HeartIcon size={22} color={colors.brandPrimary} weight={isSaved ? "fill" : "regular"} />
              <Txt variant="caption">{isSaved ? t("saved") : t("savePlace")}</Txt>
            </Pressy>
          </View>

          <Button testID="place-ask-flash-button" kind="secondary" label={t("askFlashAbout")} icon={<LightningIcon size={18} color={colors.brandPrimary} weight="fill" />} onPress={() => router.push({ pathname: "/flash", params: { q: `${p.name} (${p.address ?? ""}): ${lang === "en" ? "what should I know, what to order, best time to visit?" : lang === "uz" ? "nimani bilishim kerak, nima buyurtma qilish, qachon borish yaxshi?" : "что стоит знать, что заказать и когда лучше прийти?"}` } })} style={{ marginTop: spacing.sm }} />

          {p.hours?.length > 0 && (
            <View style={{ marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
                <ClockIcon size={18} color={colors.brandPrimary} />
                <Txt variant="h3">{t("hours")}</Txt>
              </View>
              {p.hours.map((h: string, i: number) => <Txt key={i} variant="label" color={colors.onSurfaceSecondary}>{h}</Txt>)}
            </View>
          )}

          {p.reviews?.length > 0 && (
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <Txt variant="h2">{t("reviewsTitle")}</Txt>
              {p.reviews.map((r: any, i: number) => (
                <View key={i} style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt variant="bodyStrong">{r.author}</Txt>
                    <Rating value={r.rating} />
                  </View>
                  {r.when && <Txt variant="caption" color={colors.muted}>{r.when}</Txt>}
                  <Txt color={colors.onSurfaceSecondary} numberOfLines={6}>{r.text}</Txt>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      {back}
    </View>
  );
}

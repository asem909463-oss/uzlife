import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatCircleIcon, ImageSquareIcon } from "phosphor-react-native";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Button, ErrorState, Loader, StackHeader, Txt, useToast } from "@/src/components/ui";
import { CITY_NAMES } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";
import { formatPrice } from "@/src/market";

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, profile, lang } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery<any>({ queryKey: ["listing", id], queryFn: () => api(`/market/listings/${id}`) });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader /><Loader /></View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader /><ErrorState onRetry={q.refetch} /></View>;
  const l = q.data;
  const mine = profile?.id === l.user_id;
  const contact = String(l.contact ?? "");
  const openContact = () => {
    if (contact.startsWith("@")) Linking.openURL(`https://t.me/${contact.slice(1)}`);
    else Linking.openURL(`tel:${contact.replace(/[^\d+]/g, "")}`);
  };
  const remove = async () => {
    await api(`/market/listings/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["listings"] });
    toast(t("deleted"));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={l.title} />
      <ScrollView testID="listing-detail-screen" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {l.image_url ? (
          <Image source={l.image_url} style={{ height: 280, borderRadius: radius.lg }} contentFit="cover" />
        ) : (
          <View style={{ height: 200, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}>
            <ImageSquareIcon size={40} color={colors.muted} />
          </View>
        )}
        <Txt variant="title" color={colors.brandPrimary} testID="listing-price">{formatPrice(l.price, t("priceOnRequest"))}</Txt>
        <Txt variant="h2">{l.title}</Txt>
        <Txt variant="caption" color={colors.muted}>{CITY_NAMES[l.city]?.[lang] ?? l.city} · {dayjs(l.created_at).format("D MMMM YYYY")}</Txt>
        {l.description && <Txt color={colors.onSurfaceSecondary} style={{ lineHeight: 24 }}>{l.description}</Txt>}
        <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: 4 }}>
          <Txt variant="label" color={colors.muted}>{t("contact")}</Txt>
          <Txt variant="bodyStrong" testID="listing-contact">{contact}</Txt>
        </View>
        <Button testID="listing-contact-button" label={t("contactSeller")} icon={<ChatCircleIcon size={18} color={colors.onBrandPrimary} />} onPress={openContact} />
        {mine && <Button testID="listing-delete-button" kind="danger" label={t("delete")} onPress={remove} />}
      </ScrollView>
    </View>
  );
}

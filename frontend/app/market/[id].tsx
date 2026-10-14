import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatCircleIcon, FlagIcon, ImageSquareIcon, ProhibitIcon } from "phosphor-react-native";
import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Button, Chip, ErrorState, Loader, Sheet, StackHeader, Txt, useToast } from "@/src/components/ui";
import { CITY_NAMES, type TKey } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";
import { blockUser, formatPrice } from "@/src/market";

const REASONS: TKey[] = ["rSpam", "rOffensive", "rProhibited", "rOther"];

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, profile, lang } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery<any>({ queryKey: ["listing", id], queryFn: () => api(`/market/listings/${id}`) });
  const { signedIn } = useApp();
  const [sheet, setSheet] = useState<null | "report" | "block">(null);
  const [reason, setReason] = useState<TKey>("rSpam");
  const [sending, setSending] = useState(false);

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
  const sendReport = async () => {
    setSending(true);
    try {
      await api(`/market/listings/${id}/report`, { method: "POST", body: { reason: t(reason) } });
      setSheet(null);
      toast(t("reportSent"));
    } catch {
      toast(t("errorGeneric"), "error");
    } finally {
      setSending(false);
    }
  };
  const confirmBlock = async () => {
    await blockUser(l.user_id);
    setSheet(null);
    qc.invalidateQueries({ queryKey: ["blocked"] });
    toast(t("userBlocked"));
    router.back();
  };
  const needAuth = (next: "report" | "block") => (signedIn ? setSheet(next) : router.push("/profile"));

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
        {!mine && (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="listing-report-button" kind="secondary" label={t("report")} icon={<FlagIcon size={18} color={colors.onSurface} />} onPress={() => needAuth("report")} style={{ flex: 1, paddingHorizontal: spacing.md }} />
            <Button testID="listing-block-button" kind="secondary" label={t("blockUser")} icon={<ProhibitIcon size={18} color={colors.onSurface} />} onPress={() => needAuth("block")} style={{ flex: 1, paddingHorizontal: spacing.md }} />
          </View>
        )}
      </ScrollView>

      <Sheet visible={sheet === "report"} onClose={() => setSheet(null)} testID="report-sheet">
        <Txt variant="h2">{t("reportTitle")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {REASONS.map((r) => <Chip key={r} testID={`report-reason-${r}`} label={t(r)} active={reason === r} onPress={() => setReason(r)} />)}
        </View>
        <Button testID="report-submit-button" label={t("report")} onPress={sendReport} loading={sending} />
        <Button testID="report-cancel-button" kind="ghost" label={t("cancel")} onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === "block"} onClose={() => setSheet(null)} testID="block-sheet">
        <Txt variant="h2">{t("blockUser")}</Txt>
        <Txt color={colors.onSurfaceSecondary}>{t("blockConfirm")}</Txt>
        <Button testID="block-confirm-button" kind="danger" label={t("blockUser")} onPress={confirmBlock} />
        <Button testID="block-cancel-button" kind="ghost" label={t("cancel")} onPress={() => setSheet(null)} />
      </Sheet>
    </View>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowSquareOutIcon,
  BankIcon,
  CarIcon,
  FirstAidKitIcon,
  HairDryerIcon,
  PhoneIcon,
  PillIcon,
  SealIcon,
  SirenIcon,
  StorefrontIcon,
  TShirtIcon,
  WrenchIcon,
} from "phosphor-react-native";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { ErrorState, FeatureOff, Loader, Pressy, StackHeader, Txt } from "@/src/components/ui";
import { type TKey } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

const NEARBY: { key: TKey; q: string; Icon: any }[] = [
  { key: "sAuto", q: "car service auto repair", Icon: CarIcon },
  { key: "sPharmacy", q: "pharmacy", Icon: PillIcon },
  { key: "sClinic", q: "medical clinic", Icon: FirstAidKitIcon },
  { key: "sBank", q: "bank", Icon: BankIcon },
  { key: "sBeauty", q: "beauty salon", Icon: HairDryerIcon },
  { key: "sRepair", q: "phone and electronics repair", Icon: WrenchIcon },
  { key: "sLaundry", q: "dry cleaning laundry", Icon: TShirtIcon },
  { key: "sNotary", q: "notary", Icon: SealIcon },
];

export default function Services() {
  const { t, config } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const q = useQuery<any[]>({ queryKey: ["services"], queryFn: () => api("/services") });

  if (config?.features.services === false)
    return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title={t("servicesTitle")} /><FeatureOff /></View>;

  const emergency = (q.data ?? []).filter((s) => s.category === "emergency");
  const curated = (q.data ?? []).filter((s) => s.category !== "emergency");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={t("servicesTitle")} />
      <ScrollView testID="services-screen" contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <Txt color={colors.muted}>{t("servicesSub")}</Txt>

        <View style={{ gap: spacing.md }}>
          <Txt variant="h2">{t("emergency")}</Txt>
          {q.isLoading ? <Loader /> : q.isError ? <ErrorState onRetry={q.refetch} /> : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {emergency.map((s, i) => (
                <Pressy key={s.id} testID={`service-emergency-${i}`} onPress={() => Linking.openURL(`tel:${s.phone}`)} style={{ width: "48.5%", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.errorSoft, gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <SirenIcon size={22} color={colors.liveRed} weight="fill" />
                    <Txt variant="h2" color={colors.liveRed}>{s.phone}</Txt>
                  </View>
                  <Txt variant="label" numberOfLines={2}>{s.name}</Txt>
                </Pressy>
              ))}
            </View>
          )}
        </View>

        <View style={{ gap: spacing.md }}>
          <Txt variant="h2">{t("nearby")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {NEARBY.map(({ key, q: query, Icon }, i) => (
              <Pressy key={key} testID={`service-nearby-${i}`} onPress={() => router.push({ pathname: "/places", params: { q: query, title: t(key) } })} style={{ width: "23.5%", aspectRatio: 0.9, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: spacing.xs }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} color={colors.brandPrimary} />
                </View>
                <Txt variant="caption" numberOfLines={2} style={{ textAlign: "center" }}>{t(key)}</Txt>
              </Pressy>
            ))}
          </View>
        </View>

        {config?.features.marketplace !== false && (
          <Pressy testID="services-market-card" onPress={() => router.push("/market")} style={{ padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, flexDirection: "row", alignItems: "center", gap: spacing.lg, borderWidth: 1, borderColor: colors.brandSecondary }}>
            <StorefrontIcon size={32} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Txt variant="h2">{t("marketTitle")}</Txt>
              <Txt variant="caption" color={colors.onSurfaceSecondary}>{t("marketSub")}</Txt>
            </View>
          </Pressy>
        )}

        {curated.length > 0 && (
          <View style={{ gap: spacing.md }}>
            <Txt variant="h2">{t("curated")}</Txt>
            {curated.map((s, i) => (
              <Pressy key={s.id} testID={`service-curated-${i}`} onPress={() => (s.website ? WebBrowser.openBrowserAsync(s.website) : s.phone && Linking.openURL(`tel:${s.phone}`))} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="h3">{s.name}</Txt>
                  {s.description && <Txt variant="caption" color={colors.muted}>{s.description}</Txt>}
                </View>
                {s.website ? <ArrowSquareOutIcon size={20} color={colors.brandPrimary} /> : <PhoneIcon size={20} color={colors.brandPrimary} />}
              </Pressy>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

import dayjs from "dayjs";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { useApp } from "@/src/app-context";
import { NEWS_PLACEHOLDER, Pressy, Txt } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";

export type Article = {
  id: string;
  title: string;
  summary: string;
  url: string;
  image?: string | null;
  source: string;
  category: string;
  region: string;
  lang: string;
  published_at: string;
  breaking?: boolean;
};

function Meta({ a }: { a: Article }) {
  const { colors } = useTheme();
  const { t } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
      {a.breaking && (
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.liveRed }}>
          <Txt variant="eyebrow" color={colors.onError}>{t("breaking")}</Txt>
        </View>
      )}
      <Txt variant="caption" color={colors.brandPrimary}>{a.source}</Txt>
      <Txt variant="caption" color={colors.muted}>· {dayjs(a.published_at).fromNow()}</Txt>
    </View>
  );
}

export function NewsHero({ a, testID }: { a: Article; testID?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressy testID={testID} onPress={() => router.push(`/article/${a.id}`)} style={{ height: 300, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary }}>
      <Image source={a.image || NEWS_PLACEHOLDER} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={250} />
      <LinearGradient colors={[colors.transparent, colors.scrimMid, colors.scrimEnd]} locations={[0.2, 0.55, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: spacing.sm }}>
        <Meta a={a} />
        <Txt variant="h2" numberOfLines={3}>{a.title}</Txt>
      </View>
    </Pressy>
  );
}

export function NewsRow({ a, testID }: { a: Article; testID?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressy testID={testID} onPress={() => router.push(`/article/${a.id}`)} style={{ flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center" }}>
      <View style={{ flex: 1, gap: 6 }}>
        <Meta a={a} />
        <Txt variant="bodyStrong" numberOfLines={3}>{a.title}</Txt>
      </View>
      <Image source={a.image || NEWS_PLACEHOLDER} style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }} contentFit="cover" transition={200} />
    </Pressy>
  );
}

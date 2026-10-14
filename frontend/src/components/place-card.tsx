import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StarIcon } from "phosphor-react-native";
import { View } from "react-native";

import { photoUrl } from "@/src/api";
import { useApp } from "@/src/app-context";
import { EMPTY_IMG, Pressy, Txt } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";

export type Place = {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  reviews_count?: number;
  type?: string;
  open_now?: boolean | null;
  photo?: string | null;
  lat?: number;
  lng?: number;
  maps_uri?: string;
};

export function OpenBadge({ open }: { open?: boolean | null }) {
  const { colors } = useTheme();
  const { t } = useApp();
  if (open === undefined || open === null) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: open ? colors.success : colors.error }} />
      <Txt variant="caption" color={colors.onSurfaceSecondary}>{open ? t("openLabel") : t("closedLabel")}</Txt>
    </View>
  );
}

export function Rating({ value, count }: { value?: number; count?: number }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <StarIcon size={14} color={colors.brandPrimary} weight="fill" />
      <Txt variant="label" color={colors.onSurface}>{value.toFixed(1)}</Txt>
      {count ? <Txt variant="caption" color={colors.muted}>({count})</Txt> : null}
    </View>
  );
}

/** Large edge-to-edge image card with scrim (Explore). */
export function PlaceCard({ place, testID }: { place: Place; testID?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressy testID={testID} onPress={() => router.push(`/place/${place.id}`)} style={{ height: 240, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary }}>
      <Image source={photoUrl(place.photo, 900) ?? EMPTY_IMG} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={250} />
      <LinearGradient colors={[colors.transparent, colors.scrimMid, colors.scrimEnd]} locations={[0.3, 0.6, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 6 }}>
        {place.type && <Txt variant="eyebrow" color={colors.brandPrimary}>{place.type}</Txt>}
        <Txt variant="h2" numberOfLines={1}>{place.name}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Rating value={place.rating} count={place.reviews_count} />
          <OpenBadge open={place.open_now} />
        </View>
        {place.address && <Txt variant="caption" color={colors.onSurfaceTertiary} numberOfLines={1}>{place.address}</Txt>}
      </View>
    </Pressy>
  );
}

/** Compact horizontal card (Home / Flash results). */
export function PlaceMini({ place, testID, width = 220 }: { place: Place; testID?: string; width?: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressy testID={testID} onPress={() => router.push(`/place/${place.id}`)} style={{ width, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
      <Image source={photoUrl(place.photo, 500) ?? EMPTY_IMG} style={{ height: 120 }} contentFit="cover" transition={200} />
      <View style={{ padding: spacing.md, gap: 4 }}>
        <Txt variant="h3" numberOfLines={1}>{place.name}</Txt>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <Rating value={place.rating} />
          <OpenBadge open={place.open_now} />
        </View>
        {place.type && <Txt variant="caption" color={colors.muted} numberOfLines={1}>{place.type}</Txt>}
      </View>
    </Pressy>
  );
}

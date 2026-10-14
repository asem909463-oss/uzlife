import { useState } from "react";
import { TextInput, View } from "react-native";
import { MagnifyingGlassIcon, MapPinIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/app-context";
import { PlacesList } from "@/src/components/places-list";
import { Chip, ChipRow, FeatureOff, Pressy, Sheet, Txt } from "@/src/components/ui";
import { CITY_NAMES, type TKey } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

const CATS: { key: TKey; q: string }[] = [
  { key: "catRestaurants", q: "best restaurants" },
  { key: "catCafes", q: "cafe coffee" },
  { key: "catPlov", q: "plov center" },
  { key: "catParks", q: "parks" },
  { key: "catMuseums", q: "museums and sights" },
  { key: "catShopping", q: "shopping mall" },
  { key: "catHotels", q: "hotels" },
  { key: "catFitness", q: "gym fitness" },
  { key: "catFun", q: "entertainment" },
];

export default function Explore() {
  const { t, city, lang, setCity, config } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState(0);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  if (config?.features.explore === false) return <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}><FeatureOff /></View>;

  const query = submitted || CATS[cat].q;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Txt variant="title">{t("exploreTitle")}</Txt>
            <Txt variant="caption" color={colors.muted}>{t("exploreSub")}</Txt>
          </View>
          <Pressy testID="explore-city-button" onPress={() => setCityOpen(true)} style={{ height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary }}>
            <MapPinIcon size={16} color={colors.brandPrimary} weight="fill" />
            <Txt variant="label" color={colors.brandPrimary}>{CITY_NAMES[city]?.[lang]}</Txt>
          </Pressy>
        </View>
        <View style={{ marginHorizontal: spacing.lg, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
          <MagnifyingGlassIcon size={18} color={colors.muted} />
          <TextInput
            testID="explore-search-input"
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (!v) setSubmitted("");
            }}
            onSubmitEditing={() => setSubmitted(text.trim())}
            returnKeyType="search"
            placeholder={t("searchPlaces")}
            placeholderTextColor={colors.muted}
            selectionColor={colors.brandPrimary}
            style={{ flex: 1, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15, height: 48 }}
          />
        </View>
        <ChipRow testID="explore-category-chips">
          <Chip testID="explore-open-now-chip" label={t("openNow")} active={openNow} onPress={() => setOpenNow(!openNow)} />
          {CATS.map((c, i) => (
            <Chip key={c.key} testID={`explore-cat-${i}`} label={t(c.key)} active={!submitted && cat === i} onPress={() => { setCat(i); setSubmitted(""); setText(""); }} />
          ))}
        </ChipRow>
      </View>
      <PlacesList query={query} openNow={openNow} bottomPad={bottomChrome} header={<View style={{ height: spacing.lg }} />} />

      <Sheet visible={cityOpen} onClose={() => setCityOpen(false)} testID="city-sheet">
        <Txt variant="h2">{t("city")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {Object.keys(CITY_NAMES).map((c) => (
            <Chip key={c} testID={`city-option-${c}`} label={CITY_NAMES[c][lang]} active={city === c} onPress={() => { setCity(c); setCityOpen(false); }} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

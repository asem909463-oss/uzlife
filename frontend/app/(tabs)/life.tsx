import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BellIcon, CalendarBlankIcon, CaretRightIcon, CheckCircleIcon, CircleIcon, PlusIcon, TrashIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, photoUrl } from "@/src/api";
import { useApp } from "@/src/app-context";
import { EMPTY_IMG, EmptyState, ErrorState, Loader, Pressy, Txt, useToast } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { radius, spacing, useTheme } from "@/src/theme";

type Seg = "reminders" | "plans" | "places";

export default function Life() {
  const { t, signedIn } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: Seg }>();
  const [seg, setSeg] = useState<Seg>("reminders");
  const qc = useQueryClient();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useEffect(() => {
    if (params.tab) setSeg(params.tab);
  }, [params.tab]);

  const path = { reminders: "/life/reminders", plans: "/life/plans", places: "/life/saved-places" }[seg];
  const q = useQuery<any[]>({ queryKey: [seg === "places" ? "saved-places" : seg], queryFn: () => api(path), enabled: signedIn });

  const toggle = useMutation({
    mutationFn: (r: any) => api(`/life/reminders/${r.id}`, { method: "PATCH", body: { done: !r.done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(seg === "reminders" ? `/life/reminders/${id}` : seg === "plans" ? `/life/plans/${id}` : `/life/saved-places/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [seg === "places" ? "saved-places" : seg] });
      toast(t("deleted"));
    },
  });

  const segs: { id: Seg; label: string }[] = [
    { id: "reminders", label: t("reminders") },
    { id: "plans", label: t("plans") },
    { id: "places", label: t("places") },
  ];

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (seg === "reminders")
      return (
        <Animated.View entering={FadeInDown.delay(index * 40)} layout={LinearTransition} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          <Pressable testID={`reminder-toggle-${index}`} onPress={() => toggle.mutate(item)} hitSlop={10}>
            {item.done ? <CheckCircleIcon size={28} color={colors.brandPrimary} weight="fill" /> : <CircleIcon size={28} color={colors.muted} />}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" style={item.done ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined} testID={`reminder-title-${index}`}>{item.title}</Txt>
            {item.due_at && <Txt variant="caption" color={colors.muted}>{dayjs(item.due_at).format("D MMM YYYY, HH:mm")}</Txt>}
            {item.notes ? <Txt variant="caption" color={colors.onSurfaceTertiary} numberOfLines={2}>{item.notes}</Txt> : null}
          </View>
          <Pressable testID={`reminder-delete-${index}`} onPress={() => remove.mutate(item.id)} hitSlop={10}>
            <TrashIcon size={20} color={colors.muted} />
          </Pressable>
        </Animated.View>
      );
    if (seg === "plans")
      return (
        <Animated.View entering={FadeInDown.delay(index * 40)} style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
              <CalendarBlankIcon size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="h3" testID={`plan-title-${index}`}>{item.title}</Txt>
              {item.date && <Txt variant="caption" color={colors.muted}>{dayjs(item.date).format("dddd, D MMMM")}</Txt>}
            </View>
            <Pressable testID={`plan-delete-${index}`} onPress={() => remove.mutate(item.id)} hitSlop={10}>
              <TrashIcon size={20} color={colors.muted} />
            </Pressable>
          </View>
          {(item.items ?? []).map((it: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.md, paddingLeft: spacing.xs }}>
              <Txt variant="label" color={colors.brandPrimary} style={{ width: 48 }}>{it.time || "•"}</Txt>
              <Txt style={{ flex: 1 }} color={colors.onSurfaceSecondary}>{it.text}</Txt>
            </View>
          ))}
        </Animated.View>
      );
    return (
      <Pressy testID={`saved-place-${index}`} onPress={() => router.push(`/place/${item.place_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
        <Image source={photoUrl(item.photo, 200) ?? EMPTY_IMG} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Txt variant="h3" numberOfLines={1}>{item.name}</Txt>
          <Txt variant="caption" color={colors.muted} numberOfLines={1}>{item.address}</Txt>
        </View>
        <CaretRightIcon size={18} color={colors.muted} />
      </Pressy>
    );
  };

  const emptyKey = seg === "reminders" ? "noRemindersYet" : seg === "plans" ? "noPlansYet" : "noPlacesYet";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.md }}>
        <View>
          <Txt variant="title">{t("lifeTitle")}</Txt>
          <Txt variant="caption" color={colors.muted}>{t("lifeSub")}</Txt>
        </View>
        <View testID="life-segmented" style={{ flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          {segs.map((s) => (
            <Pressy key={s.id} testID={`life-seg-${s.id}`} onPress={() => setSeg(s.id)} style={{ flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: seg === s.id ? colors.brandPrimary : "transparent" }}>
              <Txt variant="label" color={seg === s.id ? colors.onBrandPrimary : colors.onSurfaceSecondary}>{s.label}</Txt>
            </Pressy>
          ))}
        </View>
      </View>

      {!signedIn ? (
        <EmptyState testID="life-signin" title={t("lifeTitle")} subtitle={t("signInToUse")} action={t("signIn")} onAction={() => router.push("/profile")} />
      ) : (
        <FlatList
          testID="life-list"
          data={q.data ?? []}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + 96 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={q.isLoading ? <Loader /> : q.isError ? <ErrorState onRetry={q.refetch} /> : <EmptyState title={t(emptyKey)} />}
        />
      )}

      {signedIn && seg !== "places" && (
        <Pressy
          testID="life-add-button"
          onPress={() => router.push({ pathname: "/life-new", params: { type: seg === "plans" ? "plan" : "reminder" } })}
          style={{ position: "absolute", right: spacing.lg, bottom: bottomChrome + 16, height: 56, paddingHorizontal: spacing.xl, borderRadius: 28, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
        >
          {seg === "plans" ? <CalendarBlankIcon size={20} color={colors.onBrandPrimary} /> : <BellIcon size={20} color={colors.onBrandPrimary} />}
          <Txt variant="bodyStrong" color={colors.onBrandPrimary}>{seg === "plans" ? t("newPlan") : t("newReminder")}</Txt>
          <PlusIcon size={16} color={colors.onBrandPrimary} weight="bold" />
        </Pressy>
      )}
    </View>
  );
}

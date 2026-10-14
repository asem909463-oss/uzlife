import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, View } from "react-native";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { type Place, PlaceCard } from "@/src/components/place-card";
import { EmptyState, ErrorState, Loader } from "@/src/components/ui";
import { spacing, useTheme } from "@/src/theme";

/** Google Places results list, reused by Explore and Services "nearby". */
export function PlacesList({ query, openNow = false, header, bottomPad = 0 }: { query: string; openNow?: boolean; header?: React.ReactElement; bottomPad?: number }) {
  const { city, lang, t } = useApp();
  const { colors } = useTheme();
  const q = useQuery<{ items: Place[] }>({
    queryKey: ["places", query, city, lang, openNow],
    queryFn: () => api(`/places/search?q=${encodeURIComponent(query)}&city=${city}&lang=${lang}&open_now=${openNow}`),
    enabled: !!query,
  });
  return (
    <FlatList
      testID="places-list"
      data={q.data?.items ?? []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: bottomPad + spacing.xl }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
      renderItem={({ item, index }) => (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <PlaceCard place={item} testID={`place-card-${index}`} />
        </View>
      )}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
      ListEmptyComponent={
        q.isLoading ? <Loader /> : q.isError ? <ErrorState onRetry={q.refetch} /> : <EmptyState title={t("noPlaces")} subtitle={t("noPlacesSub")} />
      }
    />
  );
}

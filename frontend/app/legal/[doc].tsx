import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { ErrorState, Loader, StackHeader, Txt } from "@/src/components/ui";
import { fonts, spacing, useTheme } from "@/src/theme";

function Inline({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={{ color, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 }}>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <Text key={i} style={{ fontFamily: fonts.bold }}>{p.slice(2, -2)}</Text> : p))}
    </Text>
  );
}

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t, lang } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery<{ markdown: string }>({ queryKey: ["legal", doc, lang], queryFn: () => api(`/legal/${doc}?lang=${lang}`) });
  const title = doc === "terms" ? t("termsOfService") : t("privacyPolicy");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={title} />
      {q.isLoading ? (
        <Loader />
      ) : q.isError || !q.data ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <ScrollView testID={`legal-${doc}-screen`} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}>
          {q.data.markdown.split("\n").map((line, i) => {
            if (!line.trim()) return null;
            if (line.startsWith("# ")) return <Txt key={i} variant="title" style={{ marginBottom: spacing.sm }}>{line.slice(2)}</Txt>;
            if (line.startsWith("## ")) return <Txt key={i} variant="h2" style={{ marginTop: spacing.lg }}>{line.slice(3)}</Txt>;
            if (line.startsWith("- "))
              return (
                <View key={i} style={{ flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.xs }}>
                  <Txt color={colors.brandPrimary}>•</Txt>
                  <View style={{ flex: 1 }}><Inline text={line.slice(2)} color={colors.onSurfaceSecondary} /></View>
                </View>
              );
            return <Inline key={i} text={line} color={colors.onSurfaceSecondary} />;
          })}
        </ScrollView>
      )}
    </View>
  );
}

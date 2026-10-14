import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowUpIcon,
  BellIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  LightningIcon,
  MapPinIcon,
  NewspaperIcon,
  SealCheckIcon,
  TrashIcon,
  WrenchIcon,
} from "phosphor-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, streamChat, type StreamEvent } from "@/src/api";
import { useApp } from "@/src/app-context";
import { type Article, NewsRow } from "@/src/components/news-card";
import { type Place, PlaceMini } from "@/src/components/place-card";
import { Button, Chip, ChipRow, FeatureOff, Glass, Pressy, StackHeader, Txt } from "@/src/components/ui";
import { type TKey } from "@/src/i18n";
import { fonts, radius, spacing, useTheme } from "@/src/theme";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  error?: boolean;
  action?: any;
  result?: any;
  status?: "pending" | "busy" | "done" | "cancelled";
};

const TOOLS: { key: TKey; prompt: TKey; Icon: any }[] = [
  { key: "toolPlaces", prompt: "promptPlaces", Icon: MapPinIcon },
  { key: "toolPlan", prompt: "promptPlan", Icon: CalendarBlankIcon },
  { key: "toolReminder", prompt: "promptReminder", Icon: BellIcon },
  { key: "toolMyReminders", prompt: "promptMyReminders", Icon: CheckCircleIcon },
  { key: "toolNews", prompt: "promptNews", Icon: NewspaperIcon },
  { key: "toolServices", prompt: "promptServices", Icon: WrenchIcon },
];

/** Minimal markdown: "- " bullets and **bold**. */
function RichText({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      {text.split("\n").filter((l, i, arr) => l.trim() || (i > 0 && arr[i - 1].trim())).map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const clean = line.replace(/^\s*[-*•]\s+/, "").replace(/^#+\s*/, "");
        const parts = clean.split(/(\*\*[^*]+\*\*)/g);
        return (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            {bullet && <Txt color={color}>•</Txt>}
            <Text style={{ flex: 1, color, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 }}>
              {parts.map((p, j) => (p.startsWith("**") && p.endsWith("**") ? <Text key={j} style={{ fontFamily: fonts.bold }}>{p.slice(2, -2)}</Text> : p))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Pulse() {
  const { colors } = useTheme();
  const { t } = useApp();
  const o = useSharedValue(0.4);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View testID="flash-thinking" style={[{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, backgroundColor: colors.brandTertiary }, s]}>
      <LightningIcon size={14} color={colors.brandPrimary} weight="fill" />
      <Txt variant="label" color={colors.brandPrimary}>{t("thinking")}</Txt>
    </Animated.View>
  );
}

export default function Flash() {
  const { t, lang, city, signedIn, config } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const sentInitial = useRef(false);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;

  const patch = (id: string, p: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
    setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...(typeof p === "function" ? p(m) : p) } : m)));

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const history = msgsRef.current.filter((m) => m.text && !m.error).map((m) => ({ role: m.role, content: m.text }));
      const uid = `u${Date.now()}`;
      const aid = `a${Date.now()}`;
      setMsgs((prev) => [...prev, { id: uid, role: "user", text: message }, { id: aid, role: "assistant", text: "", streaming: true }]);
      setInput("");
      setBusy(true);
      streamChat({ message, history, lang, city }, (e: StreamEvent) => {
        if (e.type === "delta") patch(aid, (m) => ({ text: m.text + e.text }));
        else if (e.type === "action") patch(aid, { action: e.action, result: e.result, status: e.result?.kind === "confirm" ? "pending" : undefined });
        else if (e.type === "done") {
          patch(aid, { streaming: false });
          setBusy(false);
        } else if (e.type === "error") {
          patch(aid, { streaming: false, error: true, text: t("aiError") });
          setBusy(false);
        }
      });
    },
    [busy, lang, city, t],
  );

  useEffect(() => {
    if (q && !sentInitial.current) {
      sentInitial.current = true;
      send(q);
    }
  }, [q, send]);

  useEffect(() => {
    if (!signedIn) return;
    api<any[]>("/ai/history")
      .then((rows) => {
        if (!sentInitial.current && rows.length && msgsRef.current.length === 0)
          setMsgs(rows.slice(-20).map((r, i) => ({ id: `h${i}`, role: r.role, text: r.content })));
      })
      .catch(() => {});
  }, [signedIn]);

  const clear = async () => {
    setMsgs([]);
    if (signedIn) api("/ai/history", { method: "DELETE" }).catch(() => {});
  };

  const confirmAction = async (m: Msg) => {
    patch(m.id, { status: "busy" });
    try {
      const a = m.action;
      if (a.type === "create_reminder") {
        await api("/life/reminders", { method: "POST", body: { title: a.title, notes: a.notes || null, due_at: a.due_at || null } });
        qc.invalidateQueries({ queryKey: ["reminders"] });
      } else {
        await api("/life/plans", { method: "POST", body: { title: a.title, date: a.date || null, items: a.items || [] } });
        qc.invalidateQueries({ queryKey: ["plans"] });
      }
      patch(m.id, { status: "done" });
    } catch {
      patch(m.id, { status: "pending" });
    }
  };

  if (config?.features.flash_ai === false)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <StackHeader title={t("flashTitle")} />
        <FeatureOff />
      </View>
    );

  const renderResult = (m: Msg) => {
    const r = m.result;
    const a = m.action;
    if (!r) return null;
    if (r.kind === "places")
      return r.items.length ? (
        <View style={{ gap: spacing.sm }}>
          <Badge label={t("verified")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {r.items.map((p: Place, i: number) => <PlaceMini key={p.id} place={p} width={200} testID={`flash-place-${i}`} />)}
          </ScrollView>
        </View>
      ) : <Txt color={colors.muted}>{t("nothingFound")}</Txt>;
    if (r.kind === "news")
      return r.items.length ? (
        <View style={{ gap: spacing.sm, marginHorizontal: -spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.lg }}><Badge label={t("verifiedNews")} /></View>
          {r.items.map((n: Article, i: number) => <NewsRow key={n.id} a={n} testID={`flash-news-${i}`} />)}
        </View>
      ) : <Txt color={colors.muted}>{t("nothingFound")}</Txt>;
    if (r.kind === "reminders")
      return (
        <Glass style={{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          {r.items.length === 0 && <Txt color={colors.muted}>{t("noRemindersYet")}</Txt>}
          {r.items.map((it: any) => (
            <View key={it.id} style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <BellIcon size={18} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{it.title}</Txt>
                {it.due_at && <Txt variant="caption" color={colors.muted}>{dayjs(it.due_at).format("D MMM, HH:mm")}</Txt>}
              </View>
            </View>
          ))}
        </Glass>
      );
    if (r.kind === "auth_required")
      return <Button label={t("signIn")} onPress={() => router.push("/profile")} kind="secondary" testID="flash-signin-button" />;
    if (r.kind === "navigate") {
      const target = { explore: "/explore", news: "/news", life: "/life", services: "/services", market: "/market" }[a.screen as string] ?? "/home";
      return <Button label={t("goTo")} onPress={() => router.push(target as any)} kind="secondary" testID="flash-navigate-button" style={{ alignSelf: "flex-start" }} />;
    }
    if (r.kind === "confirm") {
      const isPlan = a.type === "create_plan";
      return (
        <Animated.View entering={FadeInDown}>
          <Glass style={{ borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderColor: colors.brandSecondary }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              {isPlan ? <CalendarBlankIcon size={18} color={colors.brandPrimary} /> : <BellIcon size={18} color={colors.brandPrimary} />}
              <Txt variant="eyebrow" color={colors.brandPrimary}>{isPlan ? t("confirmPlan") : t("confirmReminder")}</Txt>
            </View>
            <Txt variant="h3" testID="flash-confirm-title">{a.title}</Txt>
            {!isPlan && a.due_at && <Txt color={colors.onSurfaceSecondary}>{dayjs(a.due_at).format("dddd, D MMMM · HH:mm")}</Txt>}
            {!isPlan && a.notes ? <Txt variant="caption" color={colors.muted}>{a.notes}</Txt> : null}
            {isPlan && a.date && <Txt color={colors.onSurfaceSecondary}>{dayjs(a.date).format("dddd, D MMMM")}</Txt>}
            {isPlan && (a.items ?? []).map((it: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", gap: spacing.md }}>
                <Txt variant="label" color={colors.brandPrimary} style={{ width: 44 }}>{it.time || "•"}</Txt>
                <Txt style={{ flex: 1 }} color={colors.onSurfaceSecondary}>{it.text}</Txt>
              </View>
            ))}
            {m.status === "done" ? (
              <View style={{ gap: spacing.sm }}>
                <View testID="flash-action-done" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <CheckCircleIcon size={20} color={colors.success} weight="fill" />
                  <Txt variant="bodyStrong">{t("actionDone")}</Txt>
                </View>
                <Button label={t("openLife")} kind="secondary" onPress={() => router.push({ pathname: "/life", params: { tab: isPlan ? "plans" : "reminders" } })} testID="flash-open-life-button" />
              </View>
            ) : m.status === "cancelled" ? (
              <Txt variant="label" color={colors.muted} testID="flash-action-cancelled">{t("actionCancelled")}</Txt>
            ) : r.requires_auth || !signedIn ? (
              <View style={{ gap: spacing.sm }}>
                <Txt variant="caption" color={colors.muted}>{t("signInToUse")}</Txt>
                <Button label={t("signIn")} onPress={() => router.push("/profile")} testID="flash-confirm-signin-button" />
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button label={t("cancel")} kind="secondary" onPress={() => patch(m.id, { status: "cancelled" })} style={{ flex: 1 }} testID="flash-cancel-action-button" />
                <Button label={t("confirm")} onPress={() => confirmAction(m)} loading={m.status === "busy"} style={{ flex: 1 }} testID="flash-confirm-action-button" />
              </View>
            )}
          </Glass>
        </Animated.View>
      );
    }
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader
        title={t("flashTitle")}
        right={
          msgs.length > 0 ? (
            <Pressy testID="flash-clear-button" onPress={clear} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}>
              <TrashIcon size={18} color={colors.onSurface} />
            </Pressy>
          ) : undefined
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scroll} testID="flash-messages" style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
          {msgs.length === 0 && (
            <Animated.View entering={FadeIn.duration(600)} style={{ flex: 1, justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                <LightningIcon size={28} color={colors.onBrandPrimary} weight="fill" />
              </View>
              <Txt variant="display" testID="flash-greeting">{t("flashGreeting")}</Txt>
              <Txt color={colors.muted}>{t("flashSub")}</Txt>
            </Animated.View>
          )}
          {msgs.map((m) =>
            m.role === "user" ? (
              <Animated.View key={m.id} entering={FadeInDown.duration(250)} style={{ alignSelf: "flex-end", maxWidth: "85%", padding: spacing.md, paddingHorizontal: spacing.lg, borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: colors.surfaceTertiary }}>
                <Txt testID="flash-user-message">{m.text}</Txt>
              </Animated.View>
            ) : (
              <Animated.View key={m.id} entering={FadeIn.duration(250)} style={{ gap: spacing.md }} testID="flash-assistant-message">
                {m.streaming && !m.text ? <Pulse /> : <RichText text={m.text} color={m.error ? colors.error : colors.onSurface} />}
                {m.streaming && !!m.text && !m.action && <ActivityIndicator color={colors.brandPrimary} style={{ alignSelf: "flex-start" }} />}
                {renderResult(m)}
              </Animated.View>
            ),
          )}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.sm }}>
          <ChipRow testID="flash-control-panel">
            {TOOLS.map(({ key, prompt, Icon }) => (
              <Chip key={key} testID={`flash-tool-${key}`} label={t(key)} icon={<Icon size={16} color={colors.brandPrimary} />} onPress={() => send(t(prompt))} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            <TextInput
              testID="flash-input"
              value={input}
              onChangeText={setInput}
              placeholder={t("askAnything")}
              placeholderTextColor={colors.muted}
              selectionColor={colors.brandPrimary}
              multiline
              style={{ flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, paddingHorizontal: spacing.lg, paddingTop: 13, paddingBottom: 13, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15 }}
            />
            <Pressy testID="flash-send-button" onPress={() => send(input)} disabled={busy || !input.trim()} style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: input.trim() && !busy ? colors.brandPrimary : colors.surfaceTertiary }}>
              {busy ? <ActivityIndicator color={colors.brandPrimary} /> : <ArrowUpIcon size={22} color={input.trim() ? colors.onBrandPrimary : colors.muted} weight="bold" />}
            </Pressy>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Badge({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <SealCheckIcon size={14} color={colors.success} weight="fill" />
      <Txt variant="caption" color={colors.onSurfaceTertiary}>{label}</Txt>
    </View>
  );
}

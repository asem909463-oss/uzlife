import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Button, Chip, Field, StackHeader, Txt, useToast } from "@/src/components/ui";
import { spacing, useTheme } from "@/src/theme";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export default function LifeNew() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isPlan = type === "plan";
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [day, setDay] = useState<number | null>(isPlan ? 1 : 0);
  const [time, setTime] = useState("09:00");
  const [items, setItems] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setErr("");
    if (!title.trim()) return setErr(t("titleRequired"));
    if (!isPlan && day !== null && !TIME_RE.test(time.trim())) return setErr(t("invalidTime"));
    setBusy(true);
    try {
      const date = day === null ? null : dayjs().add(day, "day");
      if (isPlan) {
        const parsed = items
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const m = l.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
            return m ? { time: m[1], text: m[2] } : { time: null, text: l };
          });
        await api("/life/plans", { method: "POST", body: { title: title.trim(), date: date?.format("YYYY-MM-DD") ?? null, items: parsed, notes: notes || null } });
        qc.invalidateQueries({ queryKey: ["plans"] });
        toast(t("planCreated"));
      } else {
        let due: string | null = null;
        if (date) {
          const [h, m] = time.trim().split(":").map(Number);
          due = date.hour(h).minute(m).second(0).toISOString();
        }
        await api("/life/reminders", { method: "POST", body: { title: title.trim(), notes: notes || null, due_at: due } });
        qc.invalidateQueries({ queryKey: ["reminders"] });
        toast(t("reminderCreated"));
      }
      router.back();
    } catch {
      setErr(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={isPlan ? t("newPlan") : t("newReminder")} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Field testID="life-new-title-input" label={t("title")} value={title} onChangeText={setTitle} />
        <View style={{ gap: spacing.sm }}>
          <Txt variant="label" color={colors.muted}>{t("date")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Chip testID="life-new-day-0" label={t("today")} active={day === 0} onPress={() => setDay(0)} />
            <Chip testID="life-new-day-1" label={t("tomorrow")} active={day === 1} onPress={() => setDay(1)} />
            <Chip testID="life-new-day-2" label={t("dayAfter")} active={day === 2} onPress={() => setDay(2)} />
            <Chip testID="life-new-day-none" label={t("noDate")} active={day === null} onPress={() => setDay(null)} />
          </View>
        </View>
        {!isPlan && day !== null && <Field testID="life-new-time-input" label={t("time")} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} />}
        {isPlan && <Field testID="life-new-items-input" label={t("planItems")} placeholder={t("planItemsHint")} value={items} onChangeText={setItems} multiline style={{ minHeight: 140, textAlignVertical: "top" }} />}
        <Field testID="life-new-notes-input" label={t("notes")} value={notes} onChangeText={setNotes} multiline style={{ minHeight: 88, textAlignVertical: "top" }} />
        {!!err && <Txt testID="life-new-error" variant="label" color={colors.error}>{err}</Txt>}
        <Button testID="life-new-save-button" label={t("save")} onPress={save} loading={busy} />
      </KeyboardAwareScrollView>
    </View>
  );
}

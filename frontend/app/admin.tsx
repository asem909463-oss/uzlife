import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowsClockwiseIcon, LockIcon, TrashIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Button, Chip, ChipRow, Field, Loader, StackHeader, Txt, useToast } from "@/src/components/ui";
import { type TKey } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

// Admin session lives in memory only (cleared when the app restarts).
let adminToken: string | null = null;

type Tab = "overview" | "sources" | "features" | "moderation";
const FEATURE_LABELS: Record<string, TKey> = { flash_ai: "fFlash", explore: "fExplore", news: "fNews", services: "fServices", marketplace: "fMarket" };

export default function Admin() {
  const { t } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(adminToken);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  const login = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/admin/login", { method: "POST", body: { password: pw } });
      adminToken = r.token;
      setToken(r.token);
      setPw("");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setErr(code === "too_many_attempts" || code === "invalid_password" ? t(code) : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    adminToken = null;
    setToken(null);
  };

  if (!token)
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <StackHeader title={t("adminTitle")} />
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingTop: spacing.xxxl }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <LockIcon size={28} color={colors.brandPrimary} />
          </View>
          <Txt variant="title">{t("adminTitle")}</Txt>
          <Field testID="admin-password-input" label={t("adminPassword")} value={pw} onChangeText={setPw} secureTextEntry keyboardType="number-pad" onSubmitEditing={login} />
          {!!err && <Txt testID="admin-login-error" variant="label" color={colors.error}>{err}</Txt>}
          <Button testID="admin-login-button" label={t("enter")} onPress={login} loading={busy} disabled={!pw} />
        </KeyboardAwareScrollView>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={t("adminTitle")} right={<Pressable testID="admin-logout-button" onPress={logout} hitSlop={10}><Txt variant="label" color={colors.brandPrimary}>{t("adminLogout")}</Txt></Pressable>} />
      <ChipRow testID="admin-tabs">
        {(["overview", "sources", "features", "moderation"] as Tab[]).map((k) => <Chip key={k} testID={`admin-tab-${k}`} label={t(k)} active={tab === k} onPress={() => setTab(k)} />)}
      </ChipRow>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {tab === "overview" && <Overview token={token} onExpired={logout} />}
        {tab === "sources" && <Sources token={token} />}
        {tab === "features" && <Features token={token} />}
        {tab === "moderation" && <Moderation token={token} />}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Stat({ label, value, testID }: { label: string; value: string | number; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ width: "48.5%", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
      <Txt variant="title" color={colors.brandPrimary}>{value}</Txt>
      <Txt variant="caption" color={colors.muted}>{label}</Txt>
    </View>
  );
}

function Overview({ token, onExpired }: { token: string; onExpired: () => void }) {
  const { t } = useApp();
  const { colors } = useTheme();
  const toast = useToast();
  const q = useQuery<any>({ queryKey: ["admin-stats"], queryFn: () => api("/admin/stats", { admin: token }), retry: false });
  useEffect(() => {
    if (q.error instanceof ApiError && q.error.status === 401) onExpired();
  }, [q.error, onExpired]);
  const refresh = useMutation({
    mutationFn: () => api("/admin/news/refresh", { method: "POST", admin: token }),
    onSuccess: (r: any) => { toast(`${t("newsItems")}: ${r.items}`); q.refetch(); },
  });
  if (q.isLoading) return <Loader />;
  if (!q.data) return null;
  const s = q.data;
  const maxDay = Math.max(1, ...Object.values<number>(s.by_day));
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Stat testID="admin-stat-users" label={t("users")} value={s.users} />
        <Stat testID="admin-stat-events" label={t("events7d")} value={s.events_7d} />
        <Stat label={t("reminders")} value={s.reminders} />
        <Stat label={t("plans")} value={s.plans} />
        <Stat label={t("marketTitle")} value={s.listings} />
        <Stat testID="admin-stat-news" label={t("newsItems")} value={s.news_items} />
      </View>
      <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.md }}>
        <Txt variant="h3">{t("events7d")}</Txt>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 100 }}>
          {Object.entries<number>(s.by_day).map(([d, v]) => (
            <View key={d} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View style={{ width: "100%", height: Math.max(4, (v / maxDay) * 80), borderRadius: 4, backgroundColor: colors.brandPrimary }} />
              <Txt variant="caption" color={colors.muted}>{dayjs(d).format("DD")}</Txt>
            </View>
          ))}
        </View>
        {Object.entries<number>(s.by_event).map(([e, v]) => (
          <View key={e} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt variant="label" color={colors.onSurfaceSecondary}>{e}</Txt>
            <Txt variant="label">{v}</Txt>
          </View>
        ))}
      </View>
      {s.news_updated_at && <Txt variant="caption" color={colors.muted}>{t("updatedAt")}: {dayjs(s.news_updated_at).format("D MMM HH:mm")}</Txt>}
      <Button testID="admin-refresh-news-button" kind="secondary" label={t("refreshNews")} icon={<ArrowsClockwiseIcon size={18} color={colors.onSurface} />} onPress={() => refresh.mutate()} loading={refresh.isPending} />
    </View>
  );
}

function Sources({ token }: { token: string }) {
  const { t } = useApp();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery<any[]>({ queryKey: ["admin-sources"], queryFn: () => api("/admin/sources", { admin: token }) });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState("world");
  const [region, setRegion] = useState("world");
  const inval = () => qc.invalidateQueries({ queryKey: ["admin-sources"] });
  const toggle = useMutation({ mutationFn: (s: any) => api(`/admin/sources/${s.id}`, { method: "PATCH", admin: token, body: { enabled: !s.enabled } }), onSuccess: inval });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/sources/${id}`, { method: "DELETE", admin: token }), onSuccess: () => { inval(); toast(t("deleted")); } });
  const add = useMutation({
    mutationFn: () => api("/admin/sources", { method: "POST", admin: token, body: { name: name.trim(), url: url.trim(), category: cat, region, lang: "ru" } }),
    onSuccess: () => { inval(); setName(""); setUrl(""); toast(t("settingsSaved")); },
    onError: () => toast(t("errorGeneric"), "error"),
  });
  if (q.isLoading) return <Loader />;
  return (
    <View style={{ gap: spacing.md }}>
      {(q.data ?? []).map((s, i) => (
        <View key={s.id} testID={`admin-source-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{s.name}</Txt>
            <Txt variant="caption" color={colors.muted} numberOfLines={1}>{s.category} · {s.region} · {s.url}</Txt>
          </View>
          <Switch testID={`admin-source-toggle-${i}`} value={s.enabled} onValueChange={() => toggle.mutate(s)} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
          <Pressable testID={`admin-source-delete-${i}`} onPress={() => del.mutate(s.id)} hitSlop={10}>
            <TrashIcon size={20} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.md }}>
        <Txt variant="h3">{t("addSource")}</Txt>
        <Field testID="admin-source-name-input" label={t("sourceName")} value={name} onChangeText={setName} />
        <Field testID="admin-source-url-input" label={t("sourceUrl")} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {["uzbekistan", "world", "business", "tech", "sports"].map((c) => <Chip key={c} testID={`admin-source-cat-${c}`} label={c} active={cat === c} onPress={() => { setCat(c); if (c === "uzbekistan") setRegion("uz"); }} />)}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Txt variant="label" color={colors.muted} style={{ alignSelf: "center" }}>{t("region")}:</Txt>
          {["uz", "world"].map((r) => <Chip key={r} testID={`admin-source-region-${r}`} label={r} active={region === r} onPress={() => setRegion(r)} />)}
        </View>
        <Button testID="admin-source-add-button" label={t("addSource")} onPress={() => add.mutate()} loading={add.isPending} disabled={name.trim().length < 2 || !url.startsWith("http")} />
      </View>
    </View>
  );
}

function Features({ token }: { token: string }) {
  const { t } = useApp();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery<any>({ queryKey: ["admin-config"], queryFn: () => api("/admin/config", { admin: token }) });
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [website, setWebsite] = useState("");
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (q.data) {
      setFeatures(q.data.features);
      setWebsite(q.data.website_url ?? "");
      setAnnouncement(q.data.announcement ?? "");
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api("/admin/config", { method: "PUT", admin: token, body: { features, website_url: website.trim(), announcement: announcement.trim() } }),
    onSuccess: () => { toast(t("settingsSaved")); qc.invalidateQueries({ queryKey: ["config"] }); qc.invalidateQueries({ queryKey: ["admin-config"] }); },
    onError: (e) => toast(e instanceof ApiError && e.code === "invalid_url" ? t("invalid_url") : t("errorGeneric"), "error"),
  });
  if (q.isLoading) return <Loader />;
  return (
    <View style={{ gap: spacing.md }}>
      {Object.keys(FEATURE_LABELS).map((k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          <Txt variant="bodyStrong" style={{ flex: 1 }}>{t(FEATURE_LABELS[k])}</Txt>
          <Switch testID={`admin-feature-${k}`} value={features[k] !== false} onValueChange={(v) => setFeatures({ ...features, [k]: v })} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} />
        </View>
      ))}
      <Field testID="admin-website-input" label={t("websiteUrl")} value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
      <Field testID="admin-announcement-input" label={t("announcement")} value={announcement} onChangeText={setAnnouncement} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
      <Button testID="admin-save-config-button" label={t("saveSettings")} onPress={() => save.mutate()} loading={save.isPending} />
    </View>
  );
}

function Moderation({ token }: { token: string }) {
  const { t } = useApp();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const q = useQuery<any[]>({ queryKey: ["admin-listings"], queryFn: () => api("/admin/listings", { admin: token }) });
  const del = useMutation({ mutationFn: (id: string) => api(`/admin/listings/${id}`, { method: "DELETE", admin: token }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-listings"] }) });
  if (q.isLoading) return <Loader />;
  if (!q.data?.length) return <Txt color={colors.muted}>{t("noListings")}</Txt>;
  return (
    <View style={{ gap: spacing.md }}>
      {q.data.map((l, i) => (
        <View key={l.id} testID={`admin-listing-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" numberOfLines={1}>{l.title}</Txt>
            <Txt variant="caption" color={colors.muted}>{l.contact} · {dayjs(l.created_at).format("D MMM")}</Txt>
          </View>
          <Pressable testID={`admin-listing-delete-${i}`} onPress={() => del.mutate(l.id)} hitSlop={10}>
            <TrashIcon size={20} color={colors.error} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

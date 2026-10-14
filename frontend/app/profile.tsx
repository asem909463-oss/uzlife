import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { ArrowSquareOutIcon, SignOutIcon, TrashIcon, UserCircleIcon } from "phosphor-react-native";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/app-context";
import { Button, Chip, Field, Pressy, Sheet, StackHeader, Txt, useToast } from "@/src/components/ui";
import { CITY_NAMES, LANG_LABELS, type Lang } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

export default function Profile() {
  const { t, signedIn, guest, profile, lang, setLang, city, setCity, logout, updateProfile, deleteAccount, config } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taps = useRef<number[]>([]);

  const onVersionTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((x) => now - x < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      router.push("/admin");
    }
  };

  const saveName = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      toast(t("profileSaved"));
    } catch {
      toast(t("errorGeneric"), "error");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={t("profileTitle")} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <UserCircleIcon size={44} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h2" testID="profile-name">{signedIn ? profile?.name || profile?.email : t("guest")}</Txt>
            {signedIn && <Txt variant="caption" color={colors.muted} testID="profile-email">{profile?.email}</Txt>}
          </View>
        </View>

        {!signedIn && (
          <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, gap: spacing.md }}>
            <Txt color={colors.onSurface}>{t("signInToUse")}</Txt>
            <Button testID="profile-signin-button" label={t("signIn")} onPress={async () => { await logout(); router.replace("/auth"); }} />
          </View>
        )}

        {signedIn && (
          <View style={{ gap: spacing.md }}>
            <Field testID="profile-name-input" label={t("name")} value={name} onChangeText={setName} />
            <Button testID="profile-save-button" kind="secondary" label={t("save")} onPress={saveName} loading={saving} />
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Txt variant="label" color={colors.muted}>{t("language")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <Chip key={l} testID={`profile-lang-${l}`} label={LANG_LABELS[l]} active={lang === l} onPress={() => setLang(l)} />)}
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt variant="label" color={colors.muted}>{t("city")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {Object.keys(CITY_NAMES).map((c) => <Chip key={c} testID={`profile-city-${c}`} label={CITY_NAMES[c][lang]} active={city === c} onPress={() => setCity(c)} />)}
          </View>
        </View>

        {!!config?.website_url && (
          <Pressy testID="profile-website-link" onPress={() => WebBrowser.openBrowserAsync(config.website_url)} style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{t("ourWebsite")}</Txt>
              <Txt variant="caption" color={colors.muted} numberOfLines={1}>{config.website_url}</Txt>
            </View>
            <ArrowSquareOutIcon size={20} color={colors.brandPrimary} />
          </Pressy>
        )}

        {(signedIn || guest) && (
          <Button testID="profile-signout-button" kind="secondary" label={t("signOut")} icon={<SignOutIcon size={18} color={colors.onSurface} />} onPress={signOut} />
        )}
        {signedIn && (
          <Button testID="profile-delete-account-button" kind="danger" label={t("deleteAccount")} icon={<TrashIcon size={18} color={colors.error} />} onPress={() => setConfirmDelete(true)} />
        )}

        <Pressable testID="profile-version" onPress={onVersionTap} style={{ alignItems: "center", paddingVertical: spacing.md }}>
          <Txt variant="caption" color={colors.muted}>Uzlife · {t("version")} {Constants.expoConfig?.version ?? "1.0.0"}</Txt>
        </Pressable>
      </KeyboardAwareScrollView>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} testID="delete-account-sheet">
        <Txt variant="h2">{t("deleteAccount")}</Txt>
        <Txt color={colors.onSurfaceSecondary}>{t("deleteConfirm")}</Txt>
        <Button testID="delete-account-confirm" kind="danger" label={t("delete")} onPress={async () => { setConfirmDelete(false); await deleteAccount(); router.replace("/auth"); }} />
        <Button testID="delete-account-cancel" kind="ghost" label={t("cancel")} onPress={() => setConfirmDelete(false)} />
      </Sheet>
    </View>
  );
}

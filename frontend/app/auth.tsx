import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect } from "expo-router";

import { ApiError } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Button, Field, Glass, HERO_IMG, Pressy, Txt } from "@/src/components/ui";
import { LANG_LABELS, type Lang } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

export default function AuthScreen() {
  const { t, login, signup, continueAsGuest, lang, setLang, signedIn, guest } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (signedIn || guest) return <Redirect href="/home" />;

  const submit = async () => {
    setErr("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t("invalid_email"));
    if (password.length < 6) return setErr(t("passwordShort"));
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await signup(email.trim(), password, name.trim());
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setErr(code === "invalid_credentials" || code === "email_exists" || code === "invalid_email" ? t(code) : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Image source={HERO_IMG} style={{ position: "absolute", top: 0, left: 0, right: 0, height: "70%" }} contentFit="cover" />
      <LinearGradient colors={[colors.scrimMid, colors.scrimEnd, colors.surface]} locations={[0, 0.5, 0.75]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }} style={{ flexGrow: 0 }}>
          {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
            <Pressy key={l} testID={`auth-lang-${l}`} onPress={() => setLang(l)} style={{ height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, justifyContent: "center", backgroundColor: lang === l ? colors.brandPrimary : colors.glass, borderWidth: 1, borderColor: lang === l ? colors.brandPrimary : colors.glassBorder }}>
              <Txt variant="label" color={lang === l ? colors.onBrandPrimary : colors.onSurface}>{LANG_LABELS[l]}</Txt>
            </Pressy>
          ))}
        </ScrollView>
        <View style={{ flex: 1, minHeight: 160 }} />
        <Animated.View entering={FadeInDown.duration(600)} style={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.xl }}>
          <Txt variant="eyebrow" color={colors.brandPrimary}>Uzlife</Txt>
          <Txt variant="display" testID="auth-title">{t("authTitle")}</Txt>
          <Txt color={colors.onSurfaceTertiary}>{t("authSubtitle")}</Txt>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={{ marginHorizontal: spacing.lg }}>
          <Glass style={{ borderRadius: 28, padding: spacing.xl, gap: spacing.lg }}>
            {mode === "signup" && <Field testID="auth-name-input" label={t("name")} value={name} onChangeText={setName} autoComplete="name" />}
            <Field testID="auth-email-input" label={t("email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field testID="auth-password-input" label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
            {!!err && <Txt testID="auth-error" variant="label" color={colors.error}>{err}</Txt>}
            <Button testID="auth-submit-button" label={mode === "login" ? t("signIn") : t("signUp")} onPress={submit} loading={busy} />
            <Pressy testID="auth-toggle-mode" onPress={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }} haptic={false} style={{ alignItems: "center", paddingVertical: spacing.xs }}>
              <Txt variant="label" color={colors.onSurfaceSecondary}>{mode === "login" ? t("noAccount") : t("haveAccount")}</Txt>
            </Pressy>
          </Glass>
        </Animated.View>
        <Pressy testID="auth-guest-button" onPress={continueAsGuest} style={{ alignItems: "center", paddingVertical: spacing.lg, gap: 4 }}>
          <Txt variant="bodyStrong" color={colors.brandPrimary}>{t("continueGuest")}</Txt>
          <Txt variant="caption" color={colors.muted}>{t("guestNote")}</Txt>
        </Pressy>
      </KeyboardAwareScrollView>
    </View>
  );
}

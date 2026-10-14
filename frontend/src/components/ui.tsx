import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CaretLeftIcon, WarningCircleIcon } from "phosphor-react-native";
import { createContext, type PropsWithChildren, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/app-context";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export const EMPTY_IMG =
  "https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&q=70&w=900";
export const HERO_IMG =
  "https://images.unsplash.com/photo-1712176287466-d21e9f2cc991?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200";
export const NEWS_PLACEHOLDER =
  "https://images.unsplash.com/photo-1556139930-c23fa4a4f934?crop=entropy&cs=srgb&fm=jpg&q=60&w=600";

// ---------- Text ----------
type Variant = "display" | "title" | "h2" | "h3" | "body" | "bodyStrong" | "caption" | "label" | "eyebrow";
const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, textTransform: "uppercase" },
};

export function Txt({ variant = "body", color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[VARIANTS[variant], { color: color ?? colors.onSurface }, style]} />;
}

// ---------- Pressable with spring scale ----------
export function Pressy({ style, onPressIn, onPressOut, onPress, haptic = true, children, ...rest }: PressableProps & { haptic?: boolean; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 18, stiffness: 300 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
    >
      <Animated.View style={[a, style]}>{children as ReactNode}</Animated.View>
    </Pressable>
  );
}

// ---------- Button ----------
export function Button({
  label,
  onPress,
  kind = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, secondary: colors.surfaceTertiary, ghost: "transparent", danger: colors.errorSoft }[kind];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onSurface, ghost: colors.brandPrimary, danger: colors.error }[kind];
  return (
    <Pressy
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        { height: 52, borderRadius: radius.pill, backgroundColor: bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, opacity: disabled ? 0.5 : 1 },
        kind === "secondary" && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      {!loading && <Txt variant="bodyStrong" color={fg}>{label}</Txt>}
    </Pressy>
  );
}

// ---------- Chips ----------
export function Chip({ label, active, onPress, icon, testID }: { label: string; active?: boolean; onPress: () => void; icon?: ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressy
      testID={testID}
      onPress={onPress}
      style={{
        height: 36,
        flexShrink: 0,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary,
        borderColor: active ? colors.brandPrimary : colors.border,
      }}
    >
      {icon}
      <Txt variant="label" color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}>{label}</Txt>
    </Pressy>
  );
}

export function ChipRow({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: 56, flexGrow: 0 }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}
    >
      {children}
    </ScrollView>
  );
}

// ---------- Glass ----------
export function Glass({ children, style, intensity = 40 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; intensity?: number }>) {
  const { colors } = useTheme();
  return (
    <View style={[{ overflow: "hidden", borderColor: colors.glassBorder, borderWidth: 1 }, style]}>
      <BlurView intensity={intensity} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.glassCard }} />
      {children}
    </View>
  );
}

// ---------- Headers ----------
export function StackHeader({ title, right, testID }: { title?: string; right?: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <Pressy testID={testID ?? "header-back-button"} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}>
        <CaretLeftIcon size={20} color={colors.onSurface} weight="bold" />
      </Pressy>
      <Txt variant="h3" style={{ flex: 1 }} numberOfLines={1}>{title}</Txt>
      {right}
    </View>
  );
}

export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Txt variant="h2">{title}</Txt>
      {action && (
        <Pressable testID={testID} onPress={onAction} hitSlop={12}>
          <Txt variant="label" color={colors.brandPrimary}>{action}</Txt>
        </Pressable>
      )}
    </View>
  );
}

// ---------- States ----------
export function Loader({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID ?? "loader"} style={{ padding: spacing.xxxl, alignItems: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

export function EmptyState({ title, subtitle, action, onAction, testID }: { title: string; subtitle?: string; action?: string; onAction?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID ?? "empty-state"} style={{ margin: spacing.lg, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary }}>
      <Image source={EMPTY_IMG} style={{ height: 140, opacity: 0.55 }} contentFit="cover" />
      <View style={{ padding: spacing.xl, gap: spacing.sm }}>
        <Txt variant="h2">{title}</Txt>
        {subtitle && <Txt color={colors.muted}>{subtitle}</Txt>}
        {action && onAction && <Button label={action} onPress={onAction} style={{ marginTop: spacing.md, alignSelf: "flex-start" }} testID={`${testID ?? "empty-state"}-action`} />}
      </View>
    </View>
  );
}

export function ErrorState({ onRetry, testID }: { onRetry: () => void; testID?: string }) {
  const { t } = useApp();
  const { colors } = useTheme();
  return (
    <View testID={testID ?? "error-state"} style={{ margin: spacing.lg, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, gap: spacing.md, alignItems: "flex-start" }}>
      <WarningCircleIcon size={28} color={colors.brandPrimary} />
      <Txt>{t("errorGeneric")}</Txt>
      <Button label={t("retry")} onPress={onRetry} testID="error-retry-button" />
    </View>
  );
}

export function FeatureOff() {
  const { t } = useApp();
  return <EmptyState testID="feature-off" title={t("featureOff")} subtitle={t("featureOffSub")} />;
}

// ---------- Inputs ----------
export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && <Txt variant="label" color={colors.muted}>{label}</Txt>}
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.brandPrimary}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[
          { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, fontFamily: fonts.medium, fontSize: 15, borderWidth: 1, borderColor: focus ? colors.brandPrimary : colors.border },
          style,
        ]}
      />
    </View>
  );
}

// ---------- Bottom sheet (modal) ----------
export function Sheet({ visible, onClose, children, testID }: PropsWithChildren<{ visible: boolean; onClose: () => void; testID?: string }>) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onClose} testID={`${testID ?? "sheet"}-backdrop`} />
      <View testID={testID ?? "sheet"} style={{ backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg, borderTopWidth: 1, borderColor: colors.glassBorder }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
        {children}
      </View>
    </Modal>
  );
}

// ---------- Toast ----------
type ToastT = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastT | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, kind });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View key={toast.id} entering={FadeInUp} exiting={FadeOutUp} pointerEvents="none" style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg }}>
          <View testID="toast" style={{ padding: spacing.lg, borderRadius: radius.md, backgroundColor: toast.kind === "ok" ? colors.surfaceInverse : colors.error }}>
            <Txt variant="bodyStrong" color={toast.kind === "ok" ? colors.onSurfaceInverse : colors.onError}>{toast.text}</Txt>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export const useStylesCard = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border },
}));

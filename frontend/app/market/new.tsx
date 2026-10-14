import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ImageSquareIcon } from "phosphor-react-native";
import { useState } from "react";
import { Linking, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/app-context";
import { Button, Chip, Field, Pressy, Sheet, StackHeader, Txt, useToast } from "@/src/components/ui";
import { radius, spacing, useTheme } from "@/src/theme";
import { MARKET_CATS } from "@/src/market";

async function uploadToCloudinary(dataUri: string): Promise<string> {
  const s = await api<{ cloud_name: string; api_key: string; timestamp: number; folder: string; signature: string }>("/media/sign", { method: "POST" });
  const form = new FormData();
  form.append("file", dataUri);
  form.append("api_key", s.api_key);
  form.append("timestamp", String(s.timestamp));
  form.append("folder", s.folder);
  form.append("signature", s.signature);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${s.cloud_name}/image/upload`, { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok || !j.secure_url) throw new Error(j?.error?.message ?? "upload failed");
  return j.secure_url;
}

export default function NewListing() {
  const { t, city } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [contact, setContact] = useState("");
  const [cat, setCat] = useState("other");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [perm, setPerm] = useState<null | "ask" | "blocked">(null);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true, allowsEditing: true, aspect: [4, 3] });
    if (!res.canceled && res.assets[0]?.base64) setImage(`data:${res.assets[0].mimeType ?? "image/jpeg"};base64,${res.assets[0].base64}`);
  };

  const onAddPhoto = async () => {
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (p.granted) return pick();
    setPerm(p.canAskAgain ? "ask" : "blocked");
  };

  const requestPerm = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (p.granted) {
      setPerm(null);
      pick();
    } else setPerm(p.canAskAgain ? null : "blocked");
  };

  const publish = async () => {
    setErr("");
    if (title.trim().length < 2) return setErr(t("titleRequired"));
    if (contact.trim().length < 3) return setErr(t("contact"));
    setBusy(true);
    try {
      let image_url: string | null = null;
      if (image) {
        try {
          image_url = await uploadToCloudinary(image);
        } catch {
          toast(t("uploadFailed"), "error");
          setBusy(false);
          return;
        }
      }
      await api("/market/listings", { method: "POST", body: { title: title.trim(), description: desc.trim() || null, price: price ? Number(price.replace(/\D/g, "")) : null, category: cat, city, contact: contact.trim(), image_url } });
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast(t("listingCreated"));
      router.back();
    } catch {
      setErr(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={t("newListing")} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Pressy testID="listing-add-photo-button" onPress={onAddPhoto} style={{ height: 180, borderRadius: radius.lg, overflow: "hidden", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong }}>
          {image ? <Image source={image} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : (
            <>
              <ImageSquareIcon size={32} color={colors.brandPrimary} />
              <Txt variant="label" color={colors.onSurfaceSecondary}>{t("addPhoto")}</Txt>
            </>
          )}
        </Pressy>
        <Field testID="listing-title-input" label={t("title")} value={title} onChangeText={setTitle} maxLength={120} />
        <Field testID="listing-price-input" label={t("price")} value={price} onChangeText={setPrice} keyboardType="number-pad" />
        <View style={{ gap: spacing.sm }}>
          <Txt variant="label" color={colors.muted}>{t("category")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {MARKET_CATS.map((c) => <Chip key={c.id} testID={`listing-cat-${c.id}`} label={t(c.key)} active={cat === c.id} onPress={() => setCat(c.id)} />)}
          </View>
        </View>
        <Field testID="listing-description-input" label={t("description")} value={desc} onChangeText={setDesc} multiline style={{ minHeight: 110, textAlignVertical: "top" }} />
        <Field testID="listing-contact-input" label={t("contact")} value={contact} onChangeText={setContact} />
        {!!err && <Txt testID="listing-error" variant="label" color={colors.error}>{err}</Txt>}
        <Button testID="listing-publish-button" label={t("publish")} onPress={publish} loading={busy} />
      </KeyboardAwareScrollView>

      <Sheet visible={!!perm} onClose={() => setPerm(null)} testID="photo-permission-sheet">
        <Txt variant="h2">{t("photoPermTitle")}</Txt>
        <Txt color={colors.onSurfaceSecondary}>{t("photoPermBody")}</Txt>
        {perm === "ask" ? (
          <Button testID="photo-permission-allow" label={t("allow")} onPress={requestPerm} />
        ) : (
          <Button testID="photo-permission-settings" label={t("openSettings")} onPress={() => { setPerm(null); Linking.openSettings(); }} />
        )}
        <Button testID="photo-permission-cancel" kind="ghost" label={t("cancel")} onPress={() => setPerm(null)} />
      </Sheet>
    </View>
  );
}

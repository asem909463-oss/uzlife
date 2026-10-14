import dayjs from "dayjs";
import "dayjs/locale/ru";
import "dayjs/locale/uz-latn";
import relativeTime from "dayjs/plugin/relativeTime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, onTokensChanged, setTokens, type Tokens } from "@/src/api";
import { dictionaries, type Lang, type TKey } from "@/src/i18n";
import { storage } from "@/src/utils/storage";

dayjs.extend(relativeTime);

const K = { access: "uz.access", refresh: "uz.refresh", guest: "uz.guest", lang: "uz.lang", city: "uz.city" };

export type Profile = { id: string; name?: string; email?: string; language?: Lang; city?: string; avatar_url?: string };
export type AppConfig = {
  features: { flash_ai: boolean; explore: boolean; news: boolean; services: boolean; marketplace: boolean };
  website_url: string;
  announcement: string;
};

type Ctx = {
  ready: boolean;
  signedIn: boolean;
  guest: boolean;
  profile: Profile | null;
  lang: Lang;
  city: string;
  config: AppConfig | undefined;
  t: (k: TKey) => string;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  setLang: (l: Lang) => Promise<void>;
  setCity: (c: string) => Promise<void>;
  updateProfile: (p: Partial<Profile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

const DAYJS_LOCALE: Record<Lang, string> = { ru: "ru", uz: "uz-latn", en: "en" };

async function persistTokens(t: Tokens | null) {
  if (t) {
    await storage.secureSet(K.access, t.access_token);
    await storage.secureSet(K.refresh, t.refresh_token);
  } else {
    await storage.secureRemove(K.access);
    await storage.secureRemove(K.refresh);
  }
}

export function AppProvider({ children }: PropsWithChildren) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lang, setLangState] = useState<Lang>("ru");
  const [city, setCityState] = useState("tashkent");

  const config = useQuery<AppConfig>({ queryKey: ["config"], queryFn: () => api("/config"), refetchInterval: 60_000 });

  const loadProfile = useCallback(async () => {
    const p = await api<Profile>("/profile");
    setProfile(p);
    if (p.language) setLangState(p.language);
    if (p.city) setCityState(p.city);
  }, []);

  useEffect(() => {
    onTokensChanged((t) => {
      persistTokens(t);
      if (!t) {
        setSignedIn(false);
        setProfile(null);
      }
    });
    (async () => {
      const [access, refresh, g, l, c] = await Promise.all([
        storage.secureGet(K.access, ""),
        storage.secureGet(K.refresh, ""),
        storage.getItem(K.guest, false),
        storage.getItem(K.lang, "ru"),
        storage.getItem(K.city, "tashkent"),
      ]);
      setLangState((l as Lang) || "ru");
      setCityState((c as string) || "tashkent");
      if (access && refresh) {
        setTokens({ access_token: access as string, refresh_token: refresh as string });
        try {
          await loadProfile();
          setSignedIn(true);
        } catch {
          setTokens(null);
          await persistTokens(null);
        }
      } else if (g) setGuest(true);
      setReady(true);
    })();
  }, [loadProfile]);

  useEffect(() => {
    dayjs.locale(DAYJS_LOCALE[lang]);
  }, [lang]);

  const startSession = useCallback(
    async (s: Tokens) => {
      setTokens(s);
      await persistTokens(s);
      await storage.setItem(K.guest, false);
      setGuest(false);
      await loadProfile();
      setSignedIn(true);
      qc.invalidateQueries();
    },
    [loadProfile, qc],
  );

  const value = useMemo<Ctx>(() => {
    const dict = dictionaries[lang];
    return {
      ready,
      signedIn,
      guest,
      profile,
      lang,
      city,
      config: config.data,
      t: (k) => dict[k] ?? dictionaries.ru[k] ?? k,
      login: async (email, password) => startSession(await api("/auth/login", { method: "POST", body: { email, password } })),
      signup: async (email, password, name) =>
        startSession(await api("/auth/signup", { method: "POST", body: { email, password, name, language: lang } })),
      continueAsGuest: async () => {
        await storage.setItem(K.guest, true);
        setGuest(true);
      },
      logout: async () => {
        setTokens(null);
        await persistTokens(null);
        await storage.setItem(K.guest, false);
        setSignedIn(false);
        setGuest(false);
        setProfile(null);
        qc.clear();
      },
      setLang: async (l) => {
        setLangState(l);
        await storage.setItem(K.lang, l);
        if (signedIn) api("/profile", { method: "PATCH", body: { language: l } }).catch(() => {});
      },
      setCity: async (c) => {
        setCityState(c);
        await storage.setItem(K.city, c);
        if (signedIn) api("/profile", { method: "PATCH", body: { city: c } }).catch(() => {});
      },
      updateProfile: async (p) => {
        const next = await api<Profile>("/profile", { method: "PATCH", body: p });
        setProfile(next);
      },
      deleteAccount: async () => {
        await api("/account", { method: "DELETE" });
        setTokens(null);
        await persistTokens(null);
        setSignedIn(false);
        setProfile(null);
        qc.clear();
      },
    };
  }, [ready, signedIn, guest, profile, lang, city, config.data, startSession, qc]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

import { useQuery } from "@tanstack/react-query";

import { type TKey } from "@/src/i18n";
import { storage } from "@/src/utils/storage";

export const MARKET_CATS: { id: string; key: TKey }[] = [
  { id: "electronics", key: "mElectronics" },
  { id: "home", key: "mHome" },
  { id: "auto", key: "mAuto" },
  { id: "fashion", key: "mFashion" },
  { id: "services", key: "mServices" },
  { id: "other", key: "mOther" },
];

export const formatPrice = (p: number | null | undefined, fallback: string) =>
  p ? `${Math.round(p).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} UZS` : fallback;

// Users blocked by this device's user (guideline 1.2). Stored locally.
const BLOCKED_KEY = "uz.blocked";

export async function getBlocked(): Promise<string[]> {
  const v = await storage.getItem(BLOCKED_KEY, "");
  return v ? String(v).split(",").filter(Boolean) : [];
}

export async function blockUser(id: string) {
  const list = await getBlocked();
  if (!list.includes(id)) await storage.setItem(BLOCKED_KEY, [...list, id].join(","));
}

export const useBlocked = () => useQuery({ queryKey: ["blocked"], queryFn: getBlocked });

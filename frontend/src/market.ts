import { type TKey } from "@/src/i18n";

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

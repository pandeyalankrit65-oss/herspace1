import { Gavel, HandHeart, HeartPulse, MessageCircleHeart, Shield } from "lucide-react";
import type { MessageKey } from "@/i18n/en";

export const PARTNER_KINDS = ["counsellor", "lawyer", "ngo", "self_defence", "doctor"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];
export const PARTNER_LANGUAGES = ["en", "hi", "ta", "bn", "mr", "other"] as const;
export type PartnerLanguage = (typeof PARTNER_LANGUAGES)[number];
export const FEES = ["free", "paid", "sliding"] as const;
export type Fees = (typeof FEES)[number];

export type Partner = {
  id: number;
  name: string;
  kind: PartnerKind;
  city: string;
  languages: PartnerLanguage[];
  description: string;
  fees: Fees;
  feeNote: string | null;
  online: boolean;
  inPerson: boolean;
  website: string | null;
  verifiedAt: string | null;
};
export type PartnerFull = Partner & {
  credentials: string;
  email: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected" | "hidden";
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  requests?: number;
  accountEmail?: string;
};

export const KIND_ICON: Record<PartnerKind, typeof Shield> = {
  counsellor: MessageCircleHeart,
  lawyer: Gavel,
  ngo: HandHeart,
  self_defence: Shield,
  doctor: HeartPulse,
};

export const kindKey = (k: string) => `partners.kind.${k}` as MessageKey;
export const feesKey = (f: string) => `partners.fees.${f}` as MessageKey;
export const statusKey = (s: string) => `partners.status.${s}` as MessageKey;
// Language names are written in their own script, so they read the same in every language.
export const LANGUAGE_NAMES: Record<PartnerLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  ta: "தமிழ்",
  bn: "বাংলা",
  mr: "मराठी",
  other: "…",
};

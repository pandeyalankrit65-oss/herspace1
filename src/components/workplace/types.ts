import type { MessageKey } from "@/i18n/en";

export type Org = {
  id: number;
  name: string;
  emailDomain: string | null;
  role: "member" | "hr";
  verified: boolean;
};
export type Message = { fromHr: boolean; body: string; at: string };
export type WorkplaceReport = {
  id: number;
  category: Category;
  description: string;
  date: string | null;
  location: string | null;
  shareIdentity: boolean;
  status: Status;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  reporter?: { name: string; email: string } | null;
  // Handled by the Internal Committee as a formal POSH complaint.
  formal?: { receivedOn: string; inquiryBy: string; conciliation: boolean; closed: boolean } | null;
};
export type Insights = {
  total: number;
  open: number;
  byStatus: Record<Status, number>;
  byCategory: Record<string, number> | null;
  medianResponseHours: number | null;
  months: Array<{ month: string; count: number }>;
  members: number;
  verifiedMembers: number;
};
export type Settings = {
  name: string;
  emailDomain: string | null;
  slackWebhook: string | null;
  teamsWebhook: string | null;
  notifyEmail: string | null;
  hrTeam: Array<{ name: string; email: string }>;
};

export const CATEGORIES = ["harassment", "discrimination", "bullying", "unsafe_conditions", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const STATUSES = ["new", "reviewing", "resolved", "closed"] as const;
export type Status = (typeof STATUSES)[number];

export const categoryKey = (c: string) => `work.cat.${c}` as MessageKey;
export const statusKey = (s: string) => `work.status.${s}` as MessageKey;

export const STATUS_STYLE: Record<Status, string> = {
  new: "bg-brand/15 text-foreground ring-brand/30",
  reviewing: "bg-primary/15 text-foreground ring-primary/30",
  resolved: "bg-success/15 text-foreground ring-success/30",
  closed: "bg-muted text-muted-foreground ring-border",
};

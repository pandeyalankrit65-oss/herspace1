import { AlertTriangle, CalendarDays, HeartHandshake, HelpCircle } from "lucide-react";
import type { MessageKey } from "@/i18n/en";

export const CIRCLE_KINDS = ["college", "workplace", "neighbourhood", "other"] as const;
export type CircleKind = (typeof CIRCLE_KINDS)[number];
export const POST_KINDS = ["alert", "question", "support", "event"] as const;
export type PostKind = (typeof POST_KINDS)[number];
export const FLAG_REASONS = ["harassment", "false", "personal_info", "spam", "other"] as const;
export type Role = "owner" | "moderator" | "member";

export type MyCircle = {
  id: number;
  name: string;
  description: string;
  kind: CircleKind;
  emailDomain: string | null;
  role: Role;
  status: "active" | "pending";
  verified: boolean;
  members: number;
  newPosts: number;
  toReview: number;
};
export type ListedCircle = {
  id: number;
  name: string;
  description: string;
  kind: CircleKind;
  emailDomain: string | null;
  requireDomain: boolean;
  members: number;
  requested: boolean;
};
export type Item = { id: number; body: string; author: string | null; mine: boolean; hidden: boolean; flagged: boolean; at: string };
export type Post = Item & { kind: PostKind; comments: Item[] };
export type CircleView = {
  circle: {
    id: number;
    name: string;
    description: string;
    kind: CircleKind;
    emailDomain: string | null;
    requireDomain: boolean;
    listed: boolean;
    members: number;
    role: Role;
  };
  posts: Post[];
  more: boolean;
};
export type Moderation = {
  requests: Array<{ id: number; name: string; verified: boolean; at: string }>;
  flagged: Array<{
    target: "post" | "comment";
    id: number;
    body: string;
    author: string | null;
    hidden: boolean;
    flags: number;
    reasons: string[];
    at: string;
    kind?: PostKind;
  }>;
  members: Array<{ id: number; name: string; role: Role; verified: boolean; joinedAt: string }>;
};

export const kindKey = (k: string) => `circles.kind.${k}` as MessageKey;
export const postKindKey = (k: string) => `circles.post.${k}` as MessageKey;
export const reasonKey = (r: string) => `circles.reason.${r}` as MessageKey;
export const roleKey = (r: string) => `circles.role.${r}` as MessageKey;

export const POST_STYLE: Record<PostKind, { icon: typeof AlertTriangle; className: string }> = {
  alert: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive ring-destructive/25" },
  question: { icon: HelpCircle, className: "bg-primary/10 text-primary ring-primary/25" },
  support: { icon: HeartHandshake, className: "bg-brand/10 text-foreground ring-brand/25" },
  event: { icon: CalendarDays, className: "bg-success/15 text-foreground ring-success/30" },
};

export const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

import type { MessageKey } from "@/i18n/en";

// Pages linked from the top navigation (and the bottom bar's "More" sheet on phones).
export const PRIMARY_LINKS: Array<{ path: string; label: MessageKey }> = [
  { path: "/timer", label: "nav.timer" },
  { path: "/report", label: "nav.report" },
  { path: "/map", label: "nav.map" },
  { path: "/support", label: "nav.support" },
];

export const MORE_LINKS: Array<{ path: string; label: MessageKey }> = [
  { path: "/walk", label: "nav.walk" },
  { path: "/help", label: "nav.help" },
  { path: "/about", label: "nav.about" },
  { path: "/circles", label: "nav.circles" },
  { path: "/corporate", label: "nav.corporate" },
];

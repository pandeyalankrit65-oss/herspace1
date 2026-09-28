import { useId } from "react";
import { cn } from "@/lib/utils";

// The HerSpace mark: a shield holding a heart, on the violet-to-rose brand gradient.
// public/icon.svg and the app icons are drawn from the same shapes.
export const SHIELD_PATH = "M24 8.5c4.2 3 8.3 4.6 12.5 4.9v9.8c0 8.2-5.4 13.9-12.5 16.8-7.1-2.9-12.5-8.6-12.5-16.8v-9.8c4.2-.3 8.3-1.9 12.5-4.9z";
export const HEART_PATH = "M24 30.5c-4.9-3.3-7.2-6-7.2-9 0-2.3 1.7-4 3.9-4 1.4 0 2.6.7 3.3 1.9.7-1.2 1.9-1.9 3.3-1.9 2.2 0 3.9 1.7 3.9 4 0 3-2.3 5.7-7.2 9z";

const Logo = ({ className }: { className?: string }) => {
  const id = `logo-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" />
          <stop offset="1" stopColor="hsl(var(--brand))" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id})`} />
      <path d={SHIELD_PATH} fill="#fff" />
      <path d={HEART_PATH} fill={`url(#${id})`} />
    </svg>
  );
};

export default Logo;

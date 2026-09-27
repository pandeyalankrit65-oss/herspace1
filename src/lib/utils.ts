import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Only allow redirects to in-app paths, so ?next= can't send users to another site.
// Browsers treat "\" like "/", so "/\evil.com" is as dangerous as "//evil.com"; control
// characters are rejected too because browsers strip them before parsing.
const UNSAFE_PATH = /[\\\u0000-\u001f]/; // eslint-disable-line no-control-regex

export function safeNext(next: string | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || UNSAFE_PATH.test(next)) return fallback;
  return next;
}

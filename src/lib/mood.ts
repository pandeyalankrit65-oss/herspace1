// The mood journal on the well-being page. Kept only on this device, never sent anywhere, and
// removed on logout like the other things HerSpace keeps on the phone.
export const MOOD_KEY = "herspace_mood_journal";

export type Mood = 1 | 2 | 3 | 4 | 5;
// `date` is the local calendar day (YYYY-MM-DD): one entry per day, the latest replacing it.
export type MoodEntry = { date: string; mood: Mood; note?: string; at: string };

const KEEP = 60;

export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function readJournal(): MoodEntry[] {
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    const entries = raw ? (JSON.parse(raw) as MoodEntry[]) : [];
    return Array.isArray(entries) ? entries.filter((e) => e && typeof e.date === "string" && e.mood >= 1 && e.mood <= 5) : [];
  } catch {
    return [];
  }
}

// Saves today's check-in (replacing an earlier one from today); newest first, last 60 days.
export function saveMood(mood: Mood, note = "", now = new Date()): MoodEntry[] {
  const entry: MoodEntry = { date: localDay(now), mood, at: now.toISOString(), ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}) };
  const entries = [entry, ...readJournal().filter((e) => e.date !== entry.date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP);
  try {
    localStorage.setItem(MOOD_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: the check-in just isn't kept.
  }
  return entries;
}

export function deleteJournal() {
  try {
    localStorage.removeItem(MOOD_KEY);
  } catch {
    // ignore
  }
}

// Offer support when today is the lowest mood, or the last three check-ins in a week were low.
// A gentle prompt, not a diagnosis.
export function needsSupport(entries: MoodEntry[], now = new Date()): boolean {
  if (entries.length === 0) return false;
  const [latest] = entries;
  if (latest.date === localDay(now) && latest.mood === 1) return true;
  const weekAgo = localDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const recent = entries.filter((e) => e.date > weekAgo).slice(0, 3);
  return recent.length === 3 && recent.every((e) => e.mood <= 2);
}

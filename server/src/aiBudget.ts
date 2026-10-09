// A ceiling on AI calls per day, across everyone. The chat, the fake caller and report drafts
// work without an account (someone in trouble shouldn't have to sign up first), so per-address
// limits alone can't stop someone with many addresses running up the bill. Past the ceiling,
// each feature quietly uses its scripted fallback until the next day (UTC).
let day = '';
let used = 0;
let warned = false;

export function takeAiBudget(): boolean {
  const limit = Number(process.env.AI_DAILY_LIMIT || 2000);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
    warned = false;
  }
  if (used >= limit) {
    if (!warned) console.warn(`[ai] Daily limit of ${limit} AI calls reached; using fallbacks until tomorrow (AI_DAILY_LIMIT).`);
    warned = true;
    return false;
  }
  used++;
  return true;
}

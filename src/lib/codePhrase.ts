// Hearing the code phrase ("did you buy the red umbrella?") said aloud. Recognizers drop or
// change the odd word, so a phrase of 4 or more words may miss one; the rest must come in order.

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

export function heardCodePhrase(candidates: string[], phrase: string | null | undefined): boolean {
  const want = phrase ? words(phrase) : [];
  // Two words or fewer would come up in ordinary talk.
  if (want.length < 3) return false;
  const allowedMisses = want.length >= 4 ? 1 : 0;
  return candidates.some((candidate) => {
    const heard = words(candidate);
    let i = 0;
    let found = 0;
    for (const w of want) {
      const at = heard.indexOf(w, i);
      if (at === -1) continue;
      found += 1;
      i = at + 1;
    }
    return found >= want.length - allowedMisses;
  });
}

import { describe, expect, it } from "vitest";
import { HELP_SECTIONS, HELPLINES, REVIEWED } from "./help";

const LANGS = Object.keys(HELP_SECTIONS) as Array<keyof typeof HELP_SECTIONS>;

describe("Help & your rights in every language", () => {
  it("has the same sections, in the same order, with the same number of points and links as English", () => {
    const shape = (lang: (typeof LANGS)[number]) =>
      HELP_SECTIONS[lang].map((s) => ({ id: s.id, intro: Boolean(s.intro), points: s.points.length, links: s.links?.map((l) => l.href) ?? [] }));
    for (const lang of LANGS) expect(shape(lang), lang).toEqual(shape("en"));
  });

  it("labels every helpline and has a review date in every language", () => {
    for (const lang of LANGS) {
      expect(REVIEWED[lang], lang).toBeTruthy();
      for (const h of HELPLINES) expect(h.label[lang], `${h.number} ${lang}`).toBeTruthy();
    }
  });

  it("keeps the numbers the same in every translation", () => {
    // Helpline numbers and deadlines must not drift between languages.
    const numbers = (lang: (typeof LANGS)[number]) => HELP_SECTIONS[lang].flatMap((s) => s.points.join(" ").match(/\d+/g) ?? []).sort();
    for (const lang of LANGS) expect(numbers(lang), lang).toEqual(numbers("en"));
  });
});

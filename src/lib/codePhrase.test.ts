import { expect, test } from "vitest";
import { heardCodePhrase } from "./codePhrase";

const PHRASE = "Did you buy the red umbrella?";

test("the phrase said in a sentence counts", () => {
  expect(heardCodePhrase(["hey did you buy the red umbrella for me"], PHRASE)).toBe(true);
});

test("one word missed or misheard still counts", () => {
  expect(heardCodePhrase(["did you buy that red umbrella"], PHRASE)).toBe(true);
  expect(heardCodePhrase(["did you by the red umbrella"], PHRASE)).toBe(true);
});

test("two words missing, or the words out of order, don't", () => {
  expect(heardCodePhrase(["did you buy an umbrella"], PHRASE)).toBe(false);
  expect(heardCodePhrase(["the red umbrella did you buy"], PHRASE)).toBe(false);
  expect(heardCodePhrase(["it might rain today"], PHRASE)).toBe(false);
});

test("any of the recognizer's guesses can match", () => {
  expect(heardCodePhrase(["did you bye the bread umbrella", "did you buy the red umbrella"], PHRASE)).toBe(true);
});

test("other languages and scripts", () => {
  expect(heardCodePhrase(["क्या तुमने लाल छाता खरीदा"], "क्या तुमने लाल छाता खरीदा?")).toBe(true);
  expect(heardCodePhrase(["তুমি কি লাল ছাতা কিনেছ"], "তুমি কি লাল ছাতা কিনেছ?")).toBe(true);
});

test("very short phrases never count, and no phrase means nothing to hear", () => {
  expect(heardCodePhrase(["red umbrella"], "red umbrella")).toBe(false);
  expect(heardCodePhrase(["anything"], null)).toBe(false);
});

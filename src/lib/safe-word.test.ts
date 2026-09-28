import { describe, expect, it } from "vitest";
import { countWord, SafeWordCounter } from "./safe-word";

describe("countWord", () => {
  it("counts whole words, ignoring case and punctuation", () => {
    expect(countWord("Pineapple, pineapple! PINEAPPLE.", "pineapple")).toBe(3);
    expect(countWord("pineapples and a pineapple", "pineapple")).toBe(1);
    expect(countWord("blue moon blue moon", "Blue Moon")).toBe(2);
  });

  it("counts words in Indian scripts even when joined to the next word", () => {
    expect(countWord("अनानास अनानास। अनानासका", "अनानास")).toBe(3);
    expect(countWord("அன்னாசி அன்னாசி", "அன்னாசி")).toBe(2);
  });

  it("finds nothing in empty input", () => {
    expect(countWord("", "mango")).toBe(0);
    expect(countWord("mango", "   ")).toBe(0);
  });
});

describe("SafeWordCounter", () => {
  it("triggers on the third time, not before", () => {
    const c = new SafeWordCounter("mango");
    expect(c.update(1, ["mango"], 0)).toBe(false);
    expect(c.update(2, ["mango"], 1000)).toBe(false);
    expect(c.update(3, ["mango"], 2000)).toBe(true);
  });

  it("doesn't count the same word twice as a session's transcript grows", () => {
    const c = new SafeWordCounter("mango");
    expect(c.update(1, ["mango"], 0)).toBe(false);
    expect(c.update(1, ["mango is"], 100)).toBe(false);
    expect(c.update(1, ["mango is sweet"], 200)).toBe(false);
    expect(c.update(1, ["mango is sweet mango"], 300)).toBe(false);
    expect(c.update(1, ["mango is sweet mango mango"], 400)).toBe(true);
  });

  it("counts three in one phrase", () => {
    expect(new SafeWordCounter("mango").update(1, ["mango mango mango"], 0)).toBe(true);
  });

  it("forgets occurrences older than the window", () => {
    const c = new SafeWordCounter("mango", 3, 10_000);
    c.update(1, ["mango"], 0);
    c.update(2, ["mango"], 5_000);
    expect(c.update(3, ["mango"], 12_000)).toBe(false); // the first one (at 0 s) has expired
    expect(c.update(4, ["mango"], 13_000)).toBe(true); // 5 s, 12 s and 13 s are all within 10 s
  });

  it("uses the recognizer guess with the most occurrences", () => {
    expect(new SafeWordCounter("mango").update(1, ["man go man go", "mango mango mango"], 0)).toBe(true);
  });

  it("starts counting again after it triggers", () => {
    const c = new SafeWordCounter("mango");
    expect(c.update(1, ["mango mango mango"], 0)).toBe(true);
    expect(c.update(2, ["mango"], 100)).toBe(false);
  });
});

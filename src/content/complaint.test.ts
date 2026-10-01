import { describe, expect, it } from "vitest";
import { buildComplaint, LETTER_LANGS, letterSubject, type ComplaintFields } from "./complaint";

const base: ComplaintFields = {
  kind: "police",
  to: "Sector 20 Police Station",
  name: "Kavita",
  phone: "+919876543210",
  address: "12 MG Road",
  date: "2026-09-01",
  place: "Sector 18 bus stop",
  description: "A man grabbed my arm.",
  accused: "",
  witnesses: "",
  attachments: 0,
};

describe("complaint letters", () => {
  it("writes a police complaint asking for an FIR, or a Zero FIR", () => {
    const letter = buildComplaint(base, "en");
    expect(letter).toContain("The Station House Officer,\nSector 20 Police Station");
    expect(letter).toContain("I, Kavita, residing at 12 MG Road");
    expect(letter).toContain("Place: Sector 18 bus stop");
    expect(letter).toContain("A man grabbed my arm.");
    expect(letter).toContain("Zero FIR");
    expect(letter).toContain("Phone: +919876543210");
    expect(letter).not.toContain("Witnesses");
  });

  it("writes a POSH complaint to the Internal Committee", () => {
    const letter = buildComplaint({ ...base, kind: "workplace", to: "Acme Ltd" }, "en");
    expect(letter).toContain("Internal Committee (POSH),\nAcme Ltd");
    expect(letter).toContain("POSH Act, 2013");
    expect(letter).not.toContain("FIR");
  });

  it("includes optional details only when given", () => {
    const letter = buildComplaint({ ...base, accused: "Tall man, red shirt", witnesses: "Shop owner", attachments: 2 }, "en");
    expect(letter).toContain("Details of the accused: Tall man, red shirt");
    expect(letter).toContain("Witnesses: Shop owner");
    expect(letter).toContain("Attached: 2 photos");
    expect(buildComplaint({ ...base, attachments: 1 }, "en")).toContain("Attached: 1 photo\n");
  });

  it("leaves clear placeholders for anything missing", () => {
    const letter = buildComplaint({ ...base, to: "", name: "", address: "", place: "", description: "", date: "" }, "en");
    expect(letter).toContain("[Police station name]");
    expect(letter).toContain("[your name]");
    expect(letter).toContain("[what happened, in your own words]");
  });

  it("writes the letter in Hindi", () => {
    const letter = buildComplaint(base, "hi");
    expect(letter).toContain("थाना प्रभारी");
    expect(letter).toContain("ज़ीरो FIR");
    expect(letter).toContain("मैं, Kavita,");
  });

  it.each([
    ["ta", "ஜீரோ FIR", "பொருள்:", "இப்படிக்கு,", "[உங்கள் முகவரி]"],
    ["bn", "জিরো FIR", "বিষয়:", "বিনীত,", "[আপনার ঠিকানা]"],
    ["mr", "झिरो FIR", "विषय:", "आपली विश्वासू,", "[तुमचा पत्ता]"],
  ] as const)("writes the letter in %s, with every detail and no English left over", (lang, zeroFir, subject, closing, addressBlank) => {
    const letter = buildComplaint({ ...base, address: "", accused: "Tall man", witnesses: "Shop owner", attachments: 2 }, lang);
    expect(letter).toContain(zeroFir);
    expect(letter).toContain(subject);
    expect(letter).toContain(closing);
    expect(letter).toContain(addressBlank);
    for (const given of ["Kavita", "Sector 20 Police Station", "Sector 18 bus stop", "A man grabbed my arm.", "Tall man", "Shop owner", "+919876543210", ": 2"]) {
      expect(letter).toContain(given);
    }
    // Only names, abbreviations and what she typed may be in Latin script.
    const latin = letter
      .replace(/Kavita|Sector 20 Police Station|Sector 18 bus stop|A man grabbed my arm\.|Tall man|Shop owner|FIR|SHO|OC|POSH/g, "")
      .match(/[A-Za-z]{2,}/g);
    expect(latin).toBeNull();
  });
});

describe("letterSubject", () => {
  it("finds the subject line in every language, for the email subject", () => {
    for (const lang of LETTER_LANGS) {
      const subject = letterSubject(buildComplaint({ ...base, kind: "workplace" }, lang));
      expect(subject, lang).toBeTruthy();
      expect(subject, lang).toContain("POSH");
    }
    expect(letterSubject("no subject here")).toBeNull();
  });
});

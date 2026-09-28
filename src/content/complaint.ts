// Turns what the user filled in into a formal complaint letter, in English or Hindi. The
// user can edit the result before copying, printing or emailing it.

export type ComplaintKind = "police" | "workplace";
export type ComplaintFields = {
  kind: ComplaintKind;
  to: string; // police station, or organisation name
  name: string;
  phone: string;
  address: string;
  date: string; // yyyy-mm-dd
  place: string;
  description: string;
  accused: string;
  witnesses: string;
  attachments: number;
};

const today = (lang: "en" | "hi") =>
  new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });

const fmt = (iso: string, lang: "en" | "hi") =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

const blank = (v: string, placeholder: string) => v.trim() || placeholder;

export function buildComplaint(f: ComplaintFields, lang: "en" | "hi"): string {
  const when = fmt(f.date, lang);
  if (lang === "hi") {
    const to =
      f.kind === "police"
        ? `सेवा में,\nथाना प्रभारी (SHO),\n${blank(f.to, "[पुलिस स्टेशन का नाम]")}`
        : `सेवा में,\nअध्यक्ष, आंतरिक समिति (POSH),\n${blank(f.to, "[संस्था का नाम]")}`;
    const subject =
      f.kind === "police"
        ? `विषय: ${when ? `${when} को ` : ""}${blank(f.place, "[स्थान]")} पर हुई घटना के संबंध में FIR दर्ज करने हेतु शिकायत`
        : "विषय: कार्यस्थल पर यौन उत्पीड़न की शिकायत (POSH अधिनियम, 2013 के तहत)";
    const ask =
      f.kind === "police"
        ? "मेरा अनुरोध है कि इस शिकायत के आधार पर FIR दर्ज की जाए और आवश्यक कार्रवाई की जाए। यदि घटना किसी अन्य थाना क्षेत्र की है, तो कृपया ज़ीरो FIR दर्ज करके इसे संबंधित थाने को भेजें। कृपया मुझे FIR की एक प्रति दें।"
        : "मेरा अनुरोध है कि समिति इस शिकायत की जांच करे और आवश्यक कार्रवाई करे। जांच के दौरान मेरी पहचान गोपनीय रखी जाए और मेरे साथ कोई प्रतिशोधात्मक व्यवहार न हो।";
    return [
      to,
      "",
      `दिनांक: ${today("hi")}`,
      "",
      subject,
      "",
      "महोदय/महोदया,",
      "",
      `मैं, ${blank(f.name, "[आपका नाम]")}, निवासी ${blank(f.address, "[आपका पता]")}, निम्नलिखित घटना की सूचना देना चाहती हूं:`,
      "",
      `दिनांक: ${when || "[तारीख]"}`,
      `स्थान: ${blank(f.place, "[स्थान]")}`,
      "",
      blank(f.description, "[क्या हुआ, अपने शब्दों में]"),
      "",
      ...(f.accused.trim() ? [`आरोपी के बारे में जानकारी: ${f.accused.trim()}`, ""] : []),
      ...(f.witnesses.trim() ? [`गवाह: ${f.witnesses.trim()}`, ""] : []),
      ...(f.attachments ? [`संलग्न: ${f.attachments} फ़ोटो`, ""] : []),
      ask,
      "",
      "भवदीया,",
      blank(f.name, "[आपका नाम]"),
      `फ़ोन: ${blank(f.phone, "[आपका फ़ोन नंबर]")}`,
    ].join("\n");
  }

  const to =
    f.kind === "police"
      ? `To,\nThe Station House Officer,\n${blank(f.to, "[Police station name]")}`
      : `To,\nThe Presiding Officer,\nInternal Committee (POSH),\n${blank(f.to, "[Organisation name]")}`;
  const subject =
    f.kind === "police"
      ? `Subject: Complaint for registration of an FIR regarding an incident${when ? ` on ${when}` : ""} at ${blank(f.place, "[place]")}`
      : "Subject: Complaint of sexual harassment at the workplace under the POSH Act, 2013";
  const ask =
    f.kind === "police"
      ? "I request you to register an FIR on the basis of this complaint and take the necessary action. If the incident falls outside this police station's jurisdiction, please register a Zero FIR and transfer it to the appropriate police station. Kindly provide me with a copy of the FIR."
      : "I request the Committee to inquire into this complaint and take appropriate action. Please keep my identity confidential during the inquiry and ensure that I face no retaliation.";
  return [
    to,
    "",
    `Date: ${today("en")}`,
    "",
    subject,
    "",
    "Sir/Madam,",
    "",
    `I, ${blank(f.name, "[your name]")}, residing at ${blank(f.address, "[your address]")}, wish to report the following incident:`,
    "",
    `Date: ${when || "[date]"}`,
    `Place: ${blank(f.place, "[place]")}`,
    "",
    blank(f.description, "[what happened, in your own words]"),
    "",
    ...(f.accused.trim() ? [`Details of the accused: ${f.accused.trim()}`, ""] : []),
    ...(f.witnesses.trim() ? [`Witnesses: ${f.witnesses.trim()}`, ""] : []),
    ...(f.attachments ? [`Attached: ${f.attachments} photo${f.attachments === 1 ? "" : "s"}`, ""] : []),
    ask,
    "",
    "Yours faithfully,",
    blank(f.name, "[your name]"),
    `Phone: ${blank(f.phone, "[your phone number]")}`,
  ].join("\n");
}

import { describe, expect, it } from "vitest";
import { parseCommand } from "./voice-commands";

const contacts = [
  { name: "Mom", phone: "+911111111111", status: "confirmed" },
  { name: "Priya Sharma", phone: "+912222222222", status: "confirmed", relation: "Sister" },
  { name: "Raju", phone: "+913333333333", status: "declined", relation: "Brother" },
];
const parse = (...said: string[]) => parseCommand(said, contacts, "112");

describe("voice commands", () => {
  it.each([
    "help me",
    "please HELP",
    "sos",
    "बचाओ",
    "मदद करो",
    "உதவி",
    "காப்பாத்துங்க",
    "বাঁচাও",
    "वाचवा",
  ])("%s starts SOS", (phrase) => {
    expect(parse(phrase)).toEqual({ type: "sos" });
  });

  it("doesn't treat helplines or rights questions as a call for help", () => {
    expect(parse("show me the helpline numbers").type).toBe("rights");
    expect(parse("what are my rights").type).toBe("rights");
  });

  it("calls a contact by full name, first name, or a family word", () => {
    expect(parse("call Mom")).toMatchObject({ type: "call", phone: "+911111111111" });
    expect(parse("please phone priya")).toMatchObject({ type: "call", name: "Priya Sharma" });
    expect(parse("मम्मी को कॉल करो")).toMatchObject({ type: "call", name: "Mom" });
    expect(parse("அம்மாவை கால் பண்ணு")).toMatchObject({ type: "call", name: "Mom" });
    // Relation field: "Sister" matches दीदी.
    expect(parse("दीदी को फोन करो")).toMatchObject({ type: "call", name: "Priya Sharma" });
  });

  it("never calls a contact who declined", () => {
    expect(parse("call Raju").type).not.toBe("call");
    expect(parse("call my brother").type).not.toBe("call");
  });

  it("calls the emergency number for police or ambulance", () => {
    expect(parse("call the police")).toMatchObject({ type: "call", phone: "112" });
    expect(parse("पुलिस को कॉल करो")).toMatchObject({ type: "call", phone: "112" });
  });

  it("\"fake call\" isn't mistaken for calling someone", () => {
    expect(parse("give me a fake call from Mom")).toEqual({ type: "fakeCall" });
    expect(parse("नकली कॉल")).toEqual({ type: "fakeCall" });
  });

  it("reads timer durations in minutes and hours", () => {
    expect(parse("start a 45 minute timer")).toEqual({ type: "timer", minutes: 45 });
    expect(parse("timer for 2 hours")).toEqual({ type: "timer", minutes: 120 });
    expect(parse("one hour timer")).toEqual({ type: "timer", minutes: 60 });
    expect(parse("30 मिनट का टाइमर")).toEqual({ type: "timer", minutes: 30 });
    expect(parse("start a timer")).toEqual({ type: "timer", minutes: undefined });
  });

  it("recognises the other commands", () => {
    expect(parse("sound the alarm").type).toBe("alarm");
    expect(parse("I'm taking an auto home").type).toBe("ride");
    expect(parse("share my location").type).toBe("walk");
    expect(parse("where is the nearest hospital").type).toBe("map");
    expect(parse("I want to file a report").type).toBe("report");
    expect(parse("open my contacts").type).toBe("contacts");
    expect(parse("I want to talk").type).toBe("chat");
  });

  it("tries the recognizer's other guesses", () => {
    expect(parse("hell pee", "help me")).toEqual({ type: "sos" });
  });

  it("says when it doesn't understand", () => {
    expect(parse("what's the weather like")).toEqual({ type: "unknown" });
    expect(parse("")).toEqual({ type: "unknown" });
  });
});

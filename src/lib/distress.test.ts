import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { detectDistress } from "./distress";

describe("distress in the support chat", () => {
  test("danger, in all five languages and romanised Hindi", () => {
    for (const text of [
      "A man has been following me since the station",
      "someone is outside my door",
      "Please help",
      "HELP!",
      "he won't let me leave the room",
      "बचाओ कोई पीछा कर रहा है",
      "koi mera peecha kar raha hai",
      "bachao",
      "யாரோ என்னைப் பின்தொடர்கிறான்",
      "কেউ আমার পিছু নিচ্ছে",
      "कोणीतरी माझा पाठलाग करत आहे",
    ]) {
      expect(detectDistress(text), text).toBe("danger");
    }
  });

  test("self-harm comes first, even with danger words", () => {
    for (const text of [
      "I want to die",
      "I don't want to live anymore, please help",
      "मैं आत्महत्या के बारे में सोच रही हूं",
      "marna chahti hoon",
      "எனக்கு சாக வேண்டும் போல இருக்கு",
      "আমি মরে যেতে চাই",
      "मला जगायचं नाही",
    ]) {
      expect(detectDistress(text), text).toBe("self_harm");
    }
  });

  test("ordinary questions are not flagged", () => {
    for (const text of [
      "Can you help me write a complaint to HR?",
      "How do I file an FIR?",
      "I feel a bit anxious about work",
      "Is the metro safe at night?",
      "",
    ]) {
      expect(detectDistress(text), text).toBeNull();
    }
  });

  test("the server's fallback replies use the same lists", () => {
    const lists = (file: string) => {
      const src = fs.readFileSync(path.resolve(__dirname, file), "utf8").replace(/\r\n/g, "\n");
      return ["SELF_HARM", "DANGER"].map((name) => src.slice(src.indexOf(`const ${name} = [`), src.indexOf("];", src.indexOf(`const ${name} = [`))));
    };
    expect(lists("../../server/src/distress.ts")).toEqual(lists("./distress.ts"));
  });
});

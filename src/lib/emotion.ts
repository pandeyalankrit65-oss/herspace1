// How someone seems in the support chat, as the server reports it (from the AI, or from word
// lists when the AI isn't available). See server/src/emotion.ts.
export type ChatEmotion = {
  label: "fear" | "panic" | "sadness" | "anger" | "calm" | "other";
  intensity: "low" | "medium" | "high";
  urgency: "none" | "support" | "danger" | "self_harm";
  source: "ai" | "words";
};

// Feelings the chat has something to offer for.
export const ACTIONABLE = ["fear", "panic", "sadness", "anger"] as const;
export type ActionableEmotion = ChatEmotion & { label: (typeof ACTIONABLE)[number] };

// Whether a reading is worth showing: a clear feeling, not a calm or neutral message.
export const worthShowing = (e: ChatEmotion | null | undefined): e is ActionableEmotion =>
  Boolean(e && (ACTIONABLE as readonly string[]).includes(e.label) && (e.intensity !== "low" || e.urgency !== "none"));

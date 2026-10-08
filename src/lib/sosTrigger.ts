// What started an SOS. Sent with the alert so contacts know how it began (see server/src/routes/sos.ts).
export type SosTrigger = "button" | "hold" | "voice" | "safe_word" | "shake" | "scream" | "no_answer" | "code_phrase" | "stress" | "stopped_answering";

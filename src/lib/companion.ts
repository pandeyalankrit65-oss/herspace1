// "Stay with me": a voice that checks on her every few minutes during a journey. No answer: it
// asks once more; still nothing: a silent SOS. Answering is a tap, or saying anything.

export const CHECK_EVERY_MS = 3 * 60_000;
export const ANSWER_MS = 30_000;

export type CompanionEvent = "ask" | "askAgain" | "alert";

export class Companion {
  private stage: 0 | 1 | 2 | 3 = 0;
  private since: number;

  constructor(
    start = Date.now(),
    private readonly everyMs = CHECK_EVERY_MS,
    private readonly answerMs = ANSWER_MS,
  ) {
    this.since = start;
  }

  // What to do now, if anything. Call it often (every second, and on each position).
  tick(now = Date.now()): CompanionEvent | null {
    if (this.stage === 0 && now - this.since >= this.everyMs) return this.move(1, now, "ask");
    if (this.stage === 1 && now - this.since >= this.answerMs) return this.move(2, now, "askAgain");
    if (this.stage === 2 && now - this.since >= this.answerMs) return this.move(3, now, "alert");
    return null;
  }

  answered(now = Date.now()) {
    if (this.stage === 3) return;
    this.stage = 0;
    this.since = now;
  }

  get waiting() {
    return this.stage === 1 || this.stage === 2;
  }

  // Seconds until the next step while waiting for an answer.
  secondsLeft(now = Date.now()) {
    return this.waiting ? Math.max(0, Math.ceil((this.since + this.answerMs - now) / 1000)) : 0;
  }

  private move(stage: 1 | 2 | 3, now: number, event: CompanionEvent) {
    this.stage = stage;
    this.since = now;
    return event;
  }
}

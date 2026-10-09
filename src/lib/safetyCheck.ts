// "Are you okay?" from several clues together. One clue alone is often wrong (people run for buses,
// sound tense on the phone, walk through busy areas), so a check is asked only when clues add up.
// No answer within ANSWER_MS sends a silent SOS: that handles freezing and "am I overreacting?",
// but it never alerts anyone on a guess alone, only on her silence after being asked.

export type Clue = "scream" | "stress" | "running" | "risky_area" | "risky_area_dark" | "long_stop" | "off_route";

const WEIGHT: Record<Clue, number> = {
  scream: 3,
  // A ride clearly heading away from where she's going: enough to ask by itself.
  off_route: 3,
  stress: 2,
  running: 2,
  risky_area_dark: 2,
  risky_area: 1,
  long_stop: 1,
};
export const ASK_AT = 3;
// Clues older than this no longer count together.
const WINDOW_MS = 3 * 60_000;
export const ANSWER_MS = 30_000;
// After "I'm okay", don't ask again for a while, and start counting afresh.
const QUIET_AFTER_OK_MS = 10 * 60_000;

export class SafetyCheck {
  private clues = new Map<Clue, number>();
  private quietUntil = 0;

  // Notes a clue; true when the clues now add up and she should be asked.
  add(clue: Clue, at = Date.now()): boolean {
    if (at < this.quietUntil) return false;
    this.clues.set(clue, at);
    return this.score(at) >= ASK_AT;
  }

  // Each kind of clue counts once, while it's recent.
  score(at = Date.now()) {
    let total = 0;
    for (const [clue, seen] of this.clues) if (at - seen <= WINDOW_MS) total += WEIGHT[clue];
    return total;
  }

  reasons(at = Date.now()): Clue[] {
    return [...this.clues].filter(([, seen]) => at - seen <= WINDOW_MS).map(([clue]) => clue);
  }

  okay(at = Date.now()) {
    this.clues.clear();
    this.quietUntil = at + QUIET_AFTER_OK_MS;
  }
}

// After dark, as reports' times count it (see timeOfDay in risk.ts).
export const isDark = (now = new Date()) => now.getHours() >= 18 || now.getHours() < 6;

// Running all of a sudden: two running-pace readings in a row after walking or standing. A vehicle
// in between (a bus, an auto) starts again, since running for a bus then riding it isn't a sign.
export class SuddenRun {
  private calmAt: number | null = null;
  private running = 0;

  push(pace: "still" | "walking" | "running" | "vehicle", at = Date.now()): boolean {
    if (pace === "still" || pace === "walking") {
      this.calmAt = at;
      this.running = 0;
      return false;
    }
    if (pace === "vehicle") {
      this.calmAt = null;
      this.running = 0;
      return false;
    }
    this.running += 1;
    return this.running === 2 && this.calmAt !== null && at - this.calmAt <= 2 * 60_000;
  }
}

// Standing still for a long time on the way somewhere: alone it means nothing (waiting for a bus),
// but it adds to other clues.
export const LONG_STOP_MS = 10 * 60_000;

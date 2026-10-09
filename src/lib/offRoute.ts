// A ride heading the wrong way: the distance to her destination keeps growing past the closest
// it has been. Roads wind and drivers take detours, so it needs a clear, lasting change: more than
// MIN_AWAY_M (or a fifth of the way) further than the closest point, over several positions and
// at least WAIT_MS. One GPS jump doesn't count.

const MIN_AWAY_M = 400;
const SHARE_OF_TRIP = 0.2;
const FIXES = 3;
const WAIT_MS = 90_000;

export class OffRoute {
  private closest = Infinity;
  private awaySince: number | null = null;
  private awayFixes = 0;
  private told = false;

  // The distance to the destination now; true once when the ride has clearly turned away.
  push(metres: number, at = Date.now()): boolean {
    if (metres < this.closest) this.closest = metres;
    const away = metres - this.closest > Math.max(MIN_AWAY_M, this.closest * SHARE_OF_TRIP);
    if (!away) {
      this.awaySince = null;
      this.awayFixes = 0;
      return false;
    }
    this.awaySince ??= at;
    this.awayFixes += 1;
    if (this.told || this.awayFixes < FIXES || at - this.awaySince < WAIT_MS) return false;
    this.told = true;
    return true;
  }

  // "It's a detour": start again from here, and say so again only if it turns away again.
  detour() {
    this.closest = Infinity;
    this.awaySince = null;
    this.awayFixes = 0;
    this.told = false;
  }
}

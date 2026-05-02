/**
 * progression.ts — zero-server local progression. Persists best combo, total
 * taps, first-session timestamp, cumulative play time and unlock flags.
 *
 * Per PRD §13.3 (day-30 deep-trip unlock) we lean on localStorage with a
 * versioned namespace so future migrations can detect old shapes. Failure to
 * read/write storage (Safari private mode, quota) is non-fatal — every
 * accessor catches and falls back to defaults.
 */

const KEY = {
  bestCombo: 'cosmosBestCombo',
  firstSession: 'cosmosFirstSession',
  dayUnlocks: 'cosmosDayUnlocks',
  tapsTotal: 'cosmosTapsTotal',
  cumulativePlayMs: 'cosmosCumulativePlayMs',
} as const;

/** Cumulative play-time threshold for Deep-Trip mode. PRD §3 — 30 min. */
export const DEEP_TRIP_UNLOCK_MS = 30 * 60 * 1000;

interface DayUnlocks {
  /** Long-hold-3s deep-trip mode is enabled. */
  deepTrip: boolean;
}

const DEFAULT_UNLOCKS: DayUnlocks = { deepTrip: false };

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private-mode — silently ignore */
  }
}

export class Progression {
  private bestCombo = 0;
  private tapsTotal = 0;
  private cumulativePlayMs = 0;
  private firstSessionTs: number | null = null;
  private unlocks: DayUnlocks = { ...DEFAULT_UNLOCKS };
  /** Performance.now() of the last tick we recorded. */
  private lastTickMs = performance.now();

  load(): void {
    this.bestCombo = Number(safeGet(KEY.bestCombo)) || 0;
    this.tapsTotal = Number(safeGet(KEY.tapsTotal)) || 0;
    this.cumulativePlayMs = Number(safeGet(KEY.cumulativePlayMs)) || 0;
    const firstRaw = safeGet(KEY.firstSession);
    this.firstSessionTs = firstRaw ? Number(firstRaw) : null;
    if (this.firstSessionTs === null) {
      this.firstSessionTs = Date.now();
      safeSet(KEY.firstSession, String(this.firstSessionTs));
    }
    const unlockRaw = safeGet(KEY.dayUnlocks);
    if (unlockRaw) {
      try {
        const parsed = JSON.parse(unlockRaw) as Partial<DayUnlocks>;
        this.unlocks = { ...DEFAULT_UNLOCKS, ...parsed };
      } catch {
        this.unlocks = { ...DEFAULT_UNLOCKS };
      }
    }
    this.evaluateUnlocks();
    this.lastTickMs = performance.now();
  }

  /** Call once per frame. Adds wall-time delta to cumulativePlayMs and
   *  reevaluates unlocks (cheap — just numeric compares). */
  tick(): void {
    const now = performance.now();
    const dt = Math.max(0, now - this.lastTickMs);
    this.lastTickMs = now;
    // Cap per-frame addition to 100ms so a backgrounded tab doesn't fast-forward.
    this.cumulativePlayMs += Math.min(dt, 100);
    safeSet(KEY.cumulativePlayMs, String(Math.floor(this.cumulativePlayMs)));
    this.evaluateUnlocks();
  }

  recordTap(): void {
    this.tapsTotal += 1;
    safeSet(KEY.tapsTotal, String(this.tapsTotal));
  }

  recordCombo(combo: number): void {
    if (combo > this.bestCombo) {
      this.bestCombo = combo;
      safeSet(KEY.bestCombo, String(this.bestCombo));
    }
  }

  getBestCombo(): number {
    return this.bestCombo;
  }

  getTapsTotal(): number {
    return this.tapsTotal;
  }

  getCumulativePlayMs(): number {
    return this.cumulativePlayMs;
  }

  isDeepTripUnlocked(): boolean {
    return this.unlocks.deepTrip;
  }

  /** Re-derive day-X unlocks from current play-time. Idempotent. */
  private evaluateUnlocks(): void {
    let changed = false;
    if (!this.unlocks.deepTrip && this.cumulativePlayMs >= DEEP_TRIP_UNLOCK_MS) {
      this.unlocks.deepTrip = true;
      changed = true;
    }
    if (changed) {
      safeSet(KEY.dayUnlocks, JSON.stringify(this.unlocks));
    }
  }
}

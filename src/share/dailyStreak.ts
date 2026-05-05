/**
 * dailyStreak.ts — Sprint 13C
 *
 * Tracks consecutive-day visits in localStorage, shows a small "Dag X in de
 * trip" pill on session-start, and signals milestone days (7 / 30) so the
 * caller can trigger a bigger share-card prompt.
 *
 * Storage shape (intentionally minimal to stay <50 KB):
 *   cosmosLastVisit  : "YYYYMMDD"   (string)
 *   cosmosStreak     : "N"          (number as string)
 *   cosmosLongest    : "N"          (number as string)
 *
 * Edge-cases handled:
 *   • First-ever visit                → streak 1, no pill the first second
 *   • Same-day re-open                → no increment, pill still shows
 *   • Gap of exactly 1 day            → increment streak
 *   • Gap of >1 day                   → reset to 1 (new streak)
 *   • Clock skew (timezone change)    → we use *local* date, accept the rare
 *                                       miscount over a flight
 *   • localStorage unavailable        → all reads return 0, no pill
 */

import { showStreakPill } from './shareCardOverlay';

const KEY = {
  lastVisit: 'cosmosLastVisit',
  streak: 'cosmosStreak',
  longest: 'cosmosLongest',
} as const;

export interface StreakState {
  /** Current consecutive-day streak (0 if storage unavailable). */
  streak: number;
  /** All-time longest streak. */
  longest: number;
  /** True if today's visit incremented the streak. */
  isNewDay: boolean;
  /** True if streak hit a 7 or 30 milestone with this session-start. */
  milestone: 'day-7' | 'day-30' | null;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, val: string): void {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* private mode / quota — silently ignore */
  }
}

/** Local-date YYYYMMDD. Local on purpose — calendar-day "feel" beats UTC. */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Returns the day-difference between two YYYYMMDD strings (signed; positive
 * means `b` is later). Falls back to 9999 on parse error so the streak resets
 * defensively.
 */
function dayDiff(a: string, b: string): number {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  if (!pa || !pb) return 9999;
  const ms = pb.getTime() - pa.getTime();
  return Math.round(ms / (24 * 3600 * 1000));
}

function parseYmd(s: string): Date | null {
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Reconcile last-visit storage with today and return the new state. Idempotent
 * on repeated calls within the same session — once we've registered today,
 * subsequent calls return the same `isNewDay = false` state.
 */
export function recordVisit(now: Date = new Date()): StreakState {
  const today = todayKey(now);
  const last = safeGet(KEY.lastVisit);
  let streak = Number(safeGet(KEY.streak)) || 0;
  let longest = Number(safeGet(KEY.longest)) || 0;
  let isNewDay = false;

  if (!last) {
    streak = 1;
    isNewDay = true;
  } else if (last === today) {
    // Same day — no increment.
    if (streak < 1) streak = 1;
  } else {
    const diff = dayDiff(last, today);
    if (diff === 1) {
      streak += 1;
      isNewDay = true;
    } else if (diff > 1) {
      streak = 1;
      isNewDay = true;
    } else {
      // Negative diff = clock back-shift. Keep streak, mark not-new.
      isNewDay = false;
    }
  }

  if (streak > longest) longest = streak;
  safeSet(KEY.lastVisit, today);
  safeSet(KEY.streak, String(streak));
  safeSet(KEY.longest, String(longest));

  let milestone: StreakState['milestone'] = null;
  if (isNewDay && streak === 7) milestone = 'day-7';
  else if (isNewDay && streak === 30) milestone = 'day-30';

  return { streak, longest, isNewDay, milestone };
}

/**
 * One-shot session-start side effect: register today's visit and pop the
 * "Dag X in de trip" pill (4 s). Returns the resulting state so the caller
 * can act on milestones (e.g. trigger a bigger share-card).
 */
export function announceVisit(): StreakState {
  const state = recordVisit();
  if (state.streak >= 1) {
    showStreakPill(`Day ${state.streak} in the trip`, 4000);
  }
  return state;
}

/** Read-only snapshot of the streak state without mutating storage. */
export function readState(): Pick<StreakState, 'streak' | 'longest'> {
  return {
    streak: Number(safeGet(KEY.streak)) || 0,
    longest: Number(safeGet(KEY.longest)) || 0,
  };
}

/**
 * Cross-room/area/universe state persistence per architect §2.3.
 * Lives in `localStorage["cosmos.state.v1"]`. Schema-version mismatch =
 * silent reset, never a boot-blocking crash.
 */

const KEY = 'cosmos.state.v1';

export interface CosmosPersistedState {
  version: 1;
  /** Lightweight mood vector — substrate writes after each room exit. */
  mood: { energy: number; curiosity: number };
  /** Visit counters used by AI heuristics. */
  energy: number;
  /** Free-form memory blob — companion-AI may stash data here. */
  memory: Record<string, unknown>;
  /** Append-only log of `<universe>:<area>:<room>` triples. */
  traversalHistory: string[];
  inventory: string[];
  lastUniverse: string | null;
  lastArea: string | null;
  lastRoom: string | null;
}

export function defaultState(): CosmosPersistedState {
  return {
    version: 1,
    mood: { energy: 0.6, curiosity: 0.5 },
    energy: 1,
    memory: {},
    traversalHistory: [],
    inventory: [],
    lastUniverse: null,
    lastArea: null,
    lastRoom: null,
  };
}

export function loadState(): CosmosPersistedState {
  if (typeof window === 'undefined' || !window.localStorage) return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<CosmosPersistedState>;
    if (parsed.version !== 1) {
      // eslint-disable-next-line no-console
      console.warn(`[substrate/state] schema version ${String(parsed.version)} unsupported — resetting`);
      return defaultState();
    }
    // Spread on top of defaults so missing fields backfill cleanly.
    return { ...defaultState(), ...parsed, version: 1 };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[substrate/state] localStorage read failed — using defaults', err);
    return defaultState();
  }
}

export function saveState(state: CosmosPersistedState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    // Quota exceeded on iOS Safari is the usual cause; never block on it.
    // eslint-disable-next-line no-console
    console.warn('[substrate/state] localStorage write failed', err);
  }
}

export function appendTraversal(state: CosmosPersistedState, universe: string, area: string, room: string): void {
  const triple = `${universe}:${area}:${room}`;
  // Skip duplicate-of-last to keep the log readable; full history was always
  // intent. Cap at 200 entries to bound storage.
  const last = state.traversalHistory[state.traversalHistory.length - 1];
  if (last !== triple) {
    state.traversalHistory.push(triple);
    if (state.traversalHistory.length > 200) {
      state.traversalHistory = state.traversalHistory.slice(-200);
    }
  }
  state.lastUniverse = universe;
  state.lastArea = area;
  state.lastRoom = room;
}

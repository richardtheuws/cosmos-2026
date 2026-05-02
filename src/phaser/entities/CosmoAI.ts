/**
 * CosmoAI — Sprint 17E
 *
 * Companion-mode passive vibe + idle-roam AI for the 3D Cosmo. Wakes up after
 * 8 seconds without user-input, drives Cosmo through a 6-state idle behaviour
 * loop (idle / roam / curious / sit / look-around / sniff / sleep), and falls
 * back to plain idle the moment a user-gesture or motion-input arrives.
 *
 * Sprint 17E is purely additive. It does NOT touch:
 *   - the Cosmo rig (Sprint 17A — bones + 4 clips: idle/wave/stretch/sit)
 *   - the MotionController watchdog (Sprint 17B — supplies isCompanionActive +
 *     notifyInput)
 *   - the biome layer composition (Sprint 17F)
 *   - the trampoline-spot spawning (Sprint 17D — parallel)
 *
 * What it consumes
 * ────────────────
 *   - MotionController.isCompanionActive() to gate the no-input state-machine.
 *   - notifyInput() so we can also detect "user came back" to bridge out.
 *   - Optional `interactionSpots()` provider — Sprint 17D's TrampolineSpot list.
 *     Falls back gracefully to procedural waypoints from the composition-spec
 *     biome bounds when no spots are available.
 *   - Optional `compositionLayers()` provider — Sprint 17F's layer specs. Used
 *     so the 'sniff' state can pick a mid-cluster mushroom X/Y from layers
 *     3 + 4 (PRD: "mid-cluster-a / mid-cluster-b") instead of a hard-coded value.
 *
 * What it emits
 * ─────────────
 *   - per-frame an `AIDirective` consumed by CosmoAgent.applyAI(): target X/Z,
 *     facing-hint, body-rotation hint, and the clip-name to crossfade to. The
 *     CosmoAgent does the actual pose interpolation; AI only picks the goal.
 *   - random sprinkles via the same `onRandomEvent` style callbacks the
 *     CosmoAgent already exposes (yawn / petal-spew / chuckle-coo / wave-uncanny
 *     / disc-bobble) — re-using the existing event-bus avoids a second one.
 *   - hallucination-particles (sleep state only) — a small canvas-drawn dot
 *     cloud rendered as a Three.js Points object attached to the parentGroup,
 *     drifting in pop-magenta + saffron around Cosmo's head.
 *
 * State machine (transitions are random within a state, weighted by where we
 * just were so we don't ping-pong between two states):
 *
 *      ┌─ idle ◀──────────────── (any state, on user-input bridge)
 *      │
 *      ▼ (after 8s no-input)
 *   ┌─ idle ──┐
 *   │  ▲      ▼
 *   │  │   roam ── 35%
 *   │  │   curious ── 18%
 *   │  │   sit ── 17%
 *   │  │   look-around ── 18%
 *   │  │   sniff ── 12%
 *   │  └─────┘
 *   │
 *   ▼ (after 90s no-input)
 *   sleep (terminal until input)
 *
 * Each non-sleep state has a duration + auto-transitions back to 'idle' when
 * its timer expires — the dispatcher then picks the next state weighted-random
 * with the transition table above.
 */
import * as THREE from 'three';
import type { MotionController } from '../../core/motionController';
import type { TrippyEventDirector } from '../../three/postFX/trippyEventDirector';
import type { GlobalUniforms } from '../../core/globalUniforms';

// ─── Public types ────────────────────────────────────────────────────────────

export type CosmoAIState =
  | 'idle'
  | 'roam'
  | 'curious'
  | 'sit'
  | 'look-around'
  | 'sniff'
  | 'sleep';

/** What CosmoAI hands to CosmoAgent.applyAI() each frame. */
export interface AIDirective {
  /** Whether AI is currently driving (companion-mode active). When false the
   *  agent should ignore the rest of the directive and behave as before. */
  active: boolean;
  /** Target world X for the body (clamped to biome bounds). */
  targetX: number;
  /** Target world Z. Roam/sniff push Cosmo back into the scene (-2..-4). */
  targetZ: number;
  /** Target world Y — usually 0 (ground). Sit lowers ground line by ~0.05. */
  targetY: number;
  /** Animation-clip name CosmoAgent should cross-fade to. */
  clip: 'idle' | 'wave' | 'stretch' | 'sit';
  /** When true, the agent should slow its mixer.timeScale to ~0.4 (sleep). */
  slowBreath: boolean;
  /** Yaw rotation hint (rad) for the head-bone — relative to rest. AI uses
   *  this for 'look-around' to scan POIs even when motion-input is silent. */
  headYawHint: number;
  /** Spine-bone forward bend hint (rad). Used by 'sniff' to push the head
   *  toward the ground. CosmoAgent applies it on the spine bone if found. */
  spineBendHint: number;
  /** Current AI state for diagnostics / per-state asset hooks. */
  state: CosmoAIState;
  /** Optional sub-phase string (curious / sniff). For diagnostics + tests. */
  subPhase?: string;
}

/** Optional providers wiring AI to Sprint 17D + 17F state. Both are read-only
 *  and called per-state-entry, not per-frame, so a host can supply lazy lookups. */
export interface CosmoAIProviders {
  /** Sprint 17D — list of {x, z} anchors for trampoline / interactable-spots
   *  inside the current biome. CosmoAI uses them as 'curious' targets. */
  interactionSpots?: () => Array<{ x: number; z: number }>;
  /** Sprint 17F — layers of the current biome's composition-spec. CosmoAI uses
   *  layer 3 + 4 (mid-cluster-a / mid-cluster-b) X/Y to pick 'sniff' goals. */
  compositionLayers?: () => Array<{ idx: number; x_offset?: number; y_offset?: number }>;
  /** Optional reference to MotionController so AI can observe companion-mode. */
  motion: MotionController;
  /** Optional event-director — companion-mode entry schedules a subtle bloom
   *  pulse via fire(). Falls back gracefully if not provided. */
  eventDirector?: TrippyEventDirector;
  /** Optional uniforms — used to softly nudge kaleidoTrigger on wake-events. */
  uniforms?: GlobalUniforms;
}

export interface CosmoAIEvents {
  /** Mirrors CosmoAgent.onRandomEvent so the same particle/audio hooks fire. */
  onRandomEvent?: (
    kind: 'yawn' | 'petal-spew' | 'chuckle-coo' | 'wave-uncanny' | 'disc-bobble',
  ) => void;
  /** Fired exactly once whenever AI flips to/from companion-mode. */
  onCompanionModeChange?: (active: boolean) => void;
  /** Fired on entering 'sleep' for a one-shot DeepTripMode celebration. Hosts
   *  may auto-trigger DeepTripMode here, throttled per their own timer. */
  onSleepEnter?: () => void;
}

// ─── Tunables ────────────────────────────────────────────────────────────────

const COMPANION_THRESHOLD_S = 8;
const SLEEP_THRESHOLD_S = 90;
const RANDOM_EVENT_CHANCE_PER_FRAME = 0.003; // ≈ 5.5s avg @ 60fps
/** Cool-down after a random event so they don't burst. */
const RANDOM_EVENT_COOLDOWN_S = 5;
/** DeepTripMode celebration auto-trigger interval (5 min). */
const DEEP_TRIP_AUTO_INTERVAL_S = 5 * 60;

/** Weighted state-pick table for the dispatcher (probabilities sum ≈ 1). */
const TRANSITION_WEIGHTS: Record<Exclude<CosmoAIState, 'idle' | 'sleep'>, number> = {
  roam: 0.35,
  curious: 0.18,
  sit: 0.17,
  'look-around': 0.18,
  sniff: 0.12,
};

/** Per-state durations (seconds — picked uniformly from [min, max]). */
const STATE_DURATIONS: Record<CosmoAIState, [number, number]> = {
  idle: [1.0, 3.0],
  roam: [2.0, 4.0],
  curious: [2.5, 3.5], // walk-to + look + wave + walk-away
  sit: [4.0, 12.0],
  'look-around': [3.0, 5.0],
  sniff: [3.0, 4.5],
  sleep: [Infinity, Infinity],
};

/** Biome-bound clamp half-extents (matches CosmoStage default panRange). */
const ROAM_X_HALF = 1.6;
const ROAM_Z_MIN = -4;
const ROAM_Z_MAX = 0;

/** Random-event weighted distribution per state. Sums per row are normalised
 *  at pick-time. Sleep mostly disables — only yawn-style cues. */
type EventKind = 'yawn' | 'petal-spew' | 'chuckle-coo' | 'wave-uncanny' | 'disc-bobble';
const EVENT_WEIGHTS: Record<CosmoAIState, Record<EventKind, number>> = {
  idle: { yawn: 1, 'petal-spew': 1.2, 'chuckle-coo': 1, 'wave-uncanny': 1.5, 'disc-bobble': 1 },
  roam: { yawn: 0.5, 'petal-spew': 1, 'chuckle-coo': 1, 'wave-uncanny': 2.5, 'disc-bobble': 1 },
  curious: { yawn: 0.2, 'petal-spew': 1, 'chuckle-coo': 1.4, 'wave-uncanny': 2, 'disc-bobble': 1 },
  sit: { yawn: 1.5, 'petal-spew': 1.2, 'chuckle-coo': 1.2, 'wave-uncanny': 0.6, 'disc-bobble': 0.6 },
  'look-around': { yawn: 0.6, 'petal-spew': 0.7, 'chuckle-coo': 1.5, 'wave-uncanny': 1.6, 'disc-bobble': 1 },
  sniff: { yawn: 0.3, 'petal-spew': 1.3, 'chuckle-coo': 1, 'wave-uncanny': 0.6, 'disc-bobble': 1.4 },
  sleep: { yawn: 4, 'petal-spew': 0.4, 'chuckle-coo': 0.4, 'wave-uncanny': 0, 'disc-bobble': 0 },
};

// ─── Implementation ──────────────────────────────────────────────────────────

export class CosmoAI {
  state: CosmoAIState = 'idle';
  /** Time since the last user-input (sec), independently tracked from MotionController. */
  noInputT = 0;
  /** True when AI is currently authoritative (≥ COMPANION_THRESHOLD_S). */
  active = false;
  /** Sprint 17G — host-driven gate. While true the AI freezes its state-machine
   *  and resets the no-input timer so onboarding (PORTAL_OPENING / BONDING) does
   *  NOT count as "user is idle". CosmoScene flips this in its onboarding hooks
   *  in lockstep with `cosmoAgent.paused` so AI + agent transitions stay aligned. */
  paused = false;

  private providers: CosmoAIProviders;
  private events: CosmoAIEvents;
  private parentGroup: THREE.Group;

  // Per-state machinery.
  private stateUntil = 0;
  private t = 0;
  private targetX = 0;
  private targetZ = 0;
  private targetY = 0;
  private clip: 'idle' | 'wave' | 'stretch' | 'sit' = 'idle';
  private slowBreath = false;
  private headYawHint = 0;
  private spineBendHint = 0;

  /** look-around scan POI list (3 random points) + dwell-progress. */
  private scanPOIs: number[] = [];
  /** sniff sub-phases — approach / dip / leave. */
  private sniffPhase: 'approach' | 'dip' | 'leave' = 'approach';
  /** curious sub-phases — approach / inspect / wave / leave. */
  private curiousPhase: 'approach' | 'inspect' | 'wave' | 'leave' = 'approach';
  /** Saved destination for multi-phase states. */
  private subTarget: { x: number; z: number } = { x: 0, z: 0 };

  // Random-event tracker.
  private lastEventT = -Infinity;

  // DeepTripMode auto-celebration.
  private lastDeepTripT = -Infinity;

  // Sleep hallucination — Three.js Points cloud, lazy-built.
  private hallucinationCloud: THREE.Points | null = null;
  private hallucinationAlpha = 0;
  private hallucinationVel: Float32Array | null = null;

  constructor(parentGroup: THREE.Group, providers: CosmoAIProviders, events: CosmoAIEvents = {}) {
    this.parentGroup = parentGroup;
    this.providers = providers;
    this.events = events;
  }

  /** Reset companion-mode immediately on user-input. Mirrors what
   *  MotionController.notifyInput does, but for the AI state-machine. The
   *  watchdog also auto-detects motion via providers.motion, so this is
   *  optional — call from gesture handlers if you want a hard reset. */
  notifyInput(): void {
    this.noInputT = 0;
    if (this.active) {
      this.active = false;
      this.events.onCompanionModeChange?.(false);
    }
    if (this.state !== 'idle') {
      this.enterIdleBridge();
    }
  }

  /** Per-frame tick. Call from main loop. */
  tick(dt: number): void {
    this.t += dt;

    // ── Sprint 17G — onboarding gate ──
    // While the host says we're paused (e.g. OnboardingDirector running its
    // 3-second magic-moment), keep the AI in a known-clean state: timers
    // frozen, no random events, no sleep-progression. The moment paused
    // flips back to false the AI starts from a fresh idle so the first
    // post-onboarding state pick is clean.
    if (this.paused) {
      this.noInputT = 0;
      if (this.active) {
        this.active = false;
        this.events.onCompanionModeChange?.(false);
      }
      this.clip = 'idle';
      this.slowBreath = false;
      this.headYawHint = 0;
      this.spineBendHint = 0;
      return;
    }

    // ── Watchdog ──
    const motion = this.providers.motion;
    if (motion.isCompanionActive()) {
      this.noInputT += dt;
    } else {
      // Motion controller says the user is currently active → reset.
      if (this.noInputT > 0.5 && this.active) {
        // Bridge out cleanly.
        this.notifyInput();
      } else {
        this.noInputT = 0;
      }
    }

    // ── Companion-mode entry ──
    const shouldBeActive = this.noInputT >= COMPANION_THRESHOLD_S;
    if (shouldBeActive && !this.active) {
      this.active = true;
      this.events.onCompanionModeChange?.(true);
      // Subtle bloom-pulse celebration on entering companion-mode.
      const u = this.providers.uniforms;
      if (u) {
        u.kaleidoTrigger = Math.max(u.kaleidoTrigger, 0.18);
      }
      // Bridge into a fresh idle so the dispatcher picks a real state next.
      this.enterIdleBridge();
    }

    if (!this.active) {
      // Even outside companion-mode, keep ourselves clamped to a neutral idle
      // directive so applyAI() is safe to read.
      this.clip = 'idle';
      this.slowBreath = false;
      this.headYawHint = 0;
      this.spineBendHint = 0;
      return;
    }

    // ── Sleep latch ──
    if (this.noInputT >= SLEEP_THRESHOLD_S && this.state !== 'sleep') {
      this.enterState('sleep');
    }

    // ── Per-state advance ──
    this.advanceState(dt);

    // ── Random events ──
    this.tickRandomAgency();

    // ── DeepTripMode auto-celebration (1×/5min) ──
    if (this.t - this.lastDeepTripT > DEEP_TRIP_AUTO_INTERVAL_S) {
      this.lastDeepTripT = this.t;
      this.events.onSleepEnter?.(); // re-used hook — host throttles
    }

    // ── Hallucination cloud only animates in sleep ──
    this.tickHallucinationCloud(dt);
  }

  /** Public read for CosmoAgent.applyAI(). */
  getDirective(): AIDirective {
    let subPhase: string | undefined;
    if (this.state === 'curious') subPhase = this.curiousPhase;
    else if (this.state === 'sniff') subPhase = this.sniffPhase;
    return {
      active: this.active,
      targetX: this.targetX,
      targetZ: this.targetZ,
      targetY: this.targetY,
      clip: this.clip,
      slowBreath: this.slowBreath,
      headYawHint: this.headYawHint,
      spineBendHint: this.spineBendHint,
      state: this.state,
      subPhase,
    };
  }

  /** Dispose three.js resources. */
  destroy(): void {
    if (this.hallucinationCloud) {
      if (this.hallucinationCloud.parent) {
        this.hallucinationCloud.parent.remove(this.hallucinationCloud);
      }
      const geo = this.hallucinationCloud.geometry;
      const mat = this.hallucinationCloud.material as THREE.Material;
      geo.dispose();
      mat.dispose();
      this.hallucinationCloud = null;
    }
  }

  // ── State machinery ──────────────────────────────────────────────────────

  private enterIdleBridge(): void {
    this.enterState('idle');
  }

  private enterState(s: CosmoAIState): void {
    this.state = s;
    const [lo, hi] = STATE_DURATIONS[s];
    this.stateUntil = this.t + lo + Math.random() * (hi - lo);
    this.clip = 'idle';
    this.slowBreath = false;
    this.headYawHint = 0;
    this.spineBendHint = 0;

    switch (s) {
      case 'idle':
        // Hold position; Cosmo just stops.
        this.targetX = clamp(this.targetX, -ROAM_X_HALF, ROAM_X_HALF);
        this.targetY = 0;
        this.targetZ = clamp(this.targetZ, ROAM_Z_MIN, ROAM_Z_MAX);
        break;
      case 'roam': {
        // Pick a waypoint somewhere else within bounds.
        this.targetX = (Math.random() * 2 - 1) * ROAM_X_HALF * 0.75;
        this.targetZ = ROAM_Z_MIN + Math.random() * (ROAM_Z_MAX - ROAM_Z_MIN);
        this.targetY = 0;
        this.clip = 'idle'; // walk-cycle is procedural body-bob in agent
        break;
      }
      case 'curious': {
        const spot = this.pickInteractionSpot();
        this.subTarget = spot ?? this.randomWaypoint();
        this.curiousPhase = 'approach';
        this.targetX = this.subTarget.x;
        this.targetZ = this.subTarget.z;
        this.targetY = 0;
        break;
      }
      case 'sit':
        // Plonk down where we are.
        this.targetY = 0;
        this.clip = 'sit';
        this.slowBreath = false;
        break;
      case 'look-around':
        this.scanPOIs = [
          (Math.random() * 2 - 1) * 0.8,
          (Math.random() * 2 - 1) * 0.8,
          (Math.random() * 2 - 1) * 0.8,
        ];
        // Stay put — only head moves.
        break;
      case 'sniff': {
        const mid = this.pickMidClusterTarget();
        this.subTarget = mid;
        this.sniffPhase = 'approach';
        this.targetX = mid.x;
        this.targetZ = mid.z;
        this.targetY = 0;
        break;
      }
      case 'sleep':
        this.clip = 'sit';
        this.slowBreath = true;
        this.targetY = 0;
        // Spawn the hallucination cloud lazily.
        this.ensureHallucinationCloud();
        this.events.onSleepEnter?.();
        break;
    }
  }

  /** Tick the active state — drives sub-phases + auto-transition. */
  private advanceState(dt: number): void {
    void dt;
    switch (this.state) {
      case 'idle':
        if (this.t >= this.stateUntil) this.dispatchNextState();
        break;
      case 'roam':
        if (this.t >= this.stateUntil) this.dispatchNextState();
        break;
      case 'curious':
        this.advanceCurious();
        break;
      case 'sit':
        // Half-closed eyes via spineBendHint=0 (no extra effect; CosmoAgent
        // can read clip='sit' to know we're seated).
        if (this.t >= this.stateUntil) this.dispatchNextState();
        break;
      case 'look-around': {
        // Slow yaw cycle through 3 POIs over the state's duration.
        const tot = this.stateUntil - (this.t - 0); // remaining
        const phase = 1 - tot / (STATE_DURATIONS['look-around'][1]);
        const idx = Math.min(this.scanPOIs.length - 1, Math.floor(phase * this.scanPOIs.length));
        const target = this.scanPOIs[idx] ?? 0;
        // Smoothly approach the target yaw.
        this.headYawHint += (target - this.headYawHint) * 0.04;
        if (this.t >= this.stateUntil) this.dispatchNextState();
        break;
      }
      case 'sniff':
        this.advanceSniff();
        break;
      case 'sleep': {
        // Stay seated, slow breath, spine bent slightly forward.
        this.spineBendHint = -0.18;
        // Antenne flop — implemented as a static negative pitch hint on the
        // headYawHint axis. CosmoAgent rests it on the bone_antenne, falling
        // back gracefully if absent.
        this.headYawHint = 0;
        // No transitions out of sleep — only notifyInput() can break it.
        break;
      }
    }
  }

  /** Curious: walk → inspect (look-at) → wave → walk-away. */
  private advanceCurious(): void {
    const remaining = this.stateUntil - this.t;
    const total = STATE_DURATIONS.curious[1];
    const phase = 1 - remaining / total;
    if (phase < 0.4) {
      this.curiousPhase = 'approach';
      this.clip = 'idle';
      this.targetX = this.subTarget.x;
      this.targetZ = this.subTarget.z;
    } else if (phase < 0.55) {
      this.curiousPhase = 'inspect';
      this.headYawHint = 0.25; // mild head tilt toward the spot
    } else if (phase < 0.75) {
      this.curiousPhase = 'wave';
      this.clip = 'wave';
    } else {
      this.curiousPhase = 'leave';
      this.clip = 'idle';
      this.targetX = clamp(this.subTarget.x + (Math.random() < 0.5 ? -0.8 : 0.8), -ROAM_X_HALF, ROAM_X_HALF);
      this.targetZ = clamp(this.subTarget.z + 0.5, ROAM_Z_MIN, ROAM_Z_MAX);
      this.headYawHint = 0;
    }
    if (this.t >= this.stateUntil) this.dispatchNextState();
  }

  /** Sniff: approach mid-cluster → bend forward + nose-twitch → walk-away. */
  private advanceSniff(): void {
    const remaining = this.stateUntil - this.t;
    const total = STATE_DURATIONS.sniff[1];
    const phase = 1 - remaining / total;
    if (phase < 0.45) {
      this.sniffPhase = 'approach';
      this.clip = 'idle';
      this.spineBendHint = 0;
      this.targetX = this.subTarget.x;
      this.targetZ = this.subTarget.z;
    } else if (phase < 0.75) {
      this.sniffPhase = 'dip';
      this.clip = 'stretch'; // bend-forward shape
      // Subtle antenne wiggle = small modulating yaw on head.
      this.headYawHint = Math.sin(this.t * 7) * 0.05;
      this.spineBendHint = -0.32;
    } else {
      this.sniffPhase = 'leave';
      this.clip = 'idle';
      this.spineBendHint = 0;
      this.headYawHint = 0;
      this.targetX = clamp(this.subTarget.x + (Math.random() < 0.5 ? -1.0 : 1.0), -ROAM_X_HALF, ROAM_X_HALF);
      this.targetZ = clamp(this.subTarget.z + 0.6, ROAM_Z_MIN, ROAM_Z_MAX);
    }
    if (this.t >= this.stateUntil) this.dispatchNextState();
  }

  /** Pick the next state from the weighted transition table. */
  private dispatchNextState(): void {
    if (this.noInputT >= SLEEP_THRESHOLD_S) {
      this.enterState('sleep');
      return;
    }
    const total = Object.values(TRANSITION_WEIGHTS).reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (const [key, w] of Object.entries(TRANSITION_WEIGHTS) as Array<
      [Exclude<CosmoAIState, 'idle' | 'sleep'>, number]
    >) {
      r -= w;
      if (r <= 0) {
        this.enterState(key);
        return;
      }
    }
    this.enterState('idle');
  }

  /** Pick a random TrampolineSpot from Sprint 17D providers. */
  private pickInteractionSpot(): { x: number; z: number } | null {
    const spots = this.providers.interactionSpots?.() ?? [];
    if (spots.length === 0) return null;
    const s = spots[Math.floor(Math.random() * spots.length)];
    return { x: clamp(s.x, -ROAM_X_HALF, ROAM_X_HALF), z: clamp(s.z, ROAM_Z_MIN, ROAM_Z_MAX) };
  }

  /** Pick a mid-cluster mushroom location from layer-3 / layer-4 of the
   *  composition spec. Falls back to a random waypoint if not available. */
  private pickMidClusterTarget(): { x: number; z: number } {
    const layers = this.providers.compositionLayers?.() ?? [];
    const candidates = layers.filter((l) => l.idx === 3 || l.idx === 4);
    if (candidates.length === 0) return this.randomWaypoint();
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    // Composition x_offset is unit-normalized [-1..1] across the frame width;
    // map into our roam half-extent. y_offset is similarly normalised but we
    // only roam in X/Z — mid-clusters live at z≈-2..-3.
    const x = clamp((pick.x_offset ?? 0) * ROAM_X_HALF * 1.4, -ROAM_X_HALF, ROAM_X_HALF);
    const z = -2.5;
    return { x, z };
  }

  private randomWaypoint(): { x: number; z: number } {
    return {
      x: (Math.random() * 2 - 1) * ROAM_X_HALF * 0.75,
      z: ROAM_Z_MIN + Math.random() * (ROAM_Z_MAX - ROAM_Z_MIN),
    };
  }

  // ── Random events ────────────────────────────────────────────────────────

  private tickRandomAgency(): void {
    if (!this.events.onRandomEvent) return;
    if (this.t - this.lastEventT < RANDOM_EVENT_COOLDOWN_S) return;
    if (Math.random() > RANDOM_EVENT_CHANCE_PER_FRAME) return;
    const w = EVENT_WEIGHTS[this.state];
    const total = Object.values(w).reduce((s, x) => s + x, 0);
    if (total <= 0) return;
    let r = Math.random() * total;
    for (const [key, weight] of Object.entries(w) as Array<[EventKind, number]>) {
      r -= weight;
      if (r <= 0) {
        this.lastEventT = this.t;
        this.events.onRandomEvent(key);
        return;
      }
    }
  }

  // ── Sleep hallucination cloud ────────────────────────────────────────────

  private ensureHallucinationCloud(): void {
    if (this.hallucinationCloud) return;
    const COUNT = 24;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.4;
      positions[i * 3 + 0] = Math.cos(a) * r;
      positions[i * 3 + 1] = 1.2 + (Math.random() * 0.6 - 0.3);
      positions[i * 3 + 2] = Math.sin(a) * r;
      // Pop-magenta + saffron mix.
      const isMagenta = Math.random() < 0.55;
      if (isMagenta) {
        colors[i * 3 + 0] = 0.93;
        colors[i * 3 + 1] = 0.16;
        colors[i * 3 + 2] = 0.55;
      } else {
        colors[i * 3 + 0] = 0.99;
        colors[i * 3 + 1] = 0.78;
        colors[i * 3 + 2] = 0.32;
      }
      velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.06;
      velocities[i * 3 + 1] = 0.04 + Math.random() * 0.05;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Build a small canvas-drawn dot texture (no external file).
    const tex = makeDotTexture();
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: tex,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.renderOrder = 5;
    this.hallucinationCloud = points;
    this.parentGroup.add(points);
    this.hallucinationVel = velocities;
  }

  private tickHallucinationCloud(dt: number): void {
    if (!this.hallucinationCloud) return;
    const targetAlpha = this.state === 'sleep' ? 0.85 : 0;
    this.hallucinationAlpha += (targetAlpha - this.hallucinationAlpha) * 0.04;
    const mat = this.hallucinationCloud.material as THREE.PointsMaterial;
    mat.opacity = this.hallucinationAlpha;
    if (this.hallucinationAlpha < 0.01) return;

    const geo = this.hallucinationCloud.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const vel = this.hallucinationVel;
    if (!vel) return;

    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 0] += vel[i * 3 + 0] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      // Recycle once past 0.6 above start-Y.
      if (positions[i * 3 + 1] > 1.95) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.3 + Math.random() * 0.4;
        positions[i * 3 + 0] = Math.cos(a) * r;
        positions[i * 3 + 1] = 0.9;
        positions[i * 3 + 2] = Math.sin(a) * r;
      }
    }
    posAttr.needsUpdate = true;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Build a soft circular alpha-falloff dot, drawn on a 64×64 canvas. */
function makeDotTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

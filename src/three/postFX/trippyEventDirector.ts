/**
 * TrippyEventDirector — schedules diegetic surprise FX on a slow timer so the
 * world feels alive even when nothing is happening in gameplay. Picks one event
 * every 8-15s, weighted-random, fires it via globalUniforms (kaleidoTrigger,
 * damagePulse, hueShift — exposed as needed).
 *
 * Anti-pattern guard: never fire two events within 4s of each other (cooldown).
 * Silence is part of the rhythm.
 */
import type { GlobalUniforms } from '../../core/globalUniforms';

type EventName =
  | 'cosmic-eclipse'
  | 'spore-cloud'
  | 'synesthesia-flash'
  | 'reality-tear'
  | 'gravity-wobble'
  | 'star-rain'
  | 'mushroom-pulse';

interface EventDef {
  name: EventName;
  weight: number;
  durationS: number;
  apply(u: GlobalUniforms, progress: number): void;
}

/* progress is 0..1 over the event's duration. */
const EVENTS: EventDef[] = [
  {
    name: 'cosmic-eclipse',
    weight: 1.5,
    durationS: 1.8,
    apply(u, p) {
      // Strong kaleido + gentle damp at peak.
      const env = Math.sin(p * Math.PI);
      u.kaleidoTrigger = Math.max(u.kaleidoTrigger, env * 0.65);
    },
  },
  {
    name: 'spore-cloud',
    weight: 2.0,
    durationS: 3.5,
    apply(u, p) {
      // Sustained mid kaleido.
      const env = Math.sin(p * Math.PI);
      u.kaleidoTrigger = Math.max(u.kaleidoTrigger, env * 0.4);
    },
  },
  {
    name: 'synesthesia-flash',
    weight: 1.2,
    durationS: 0.22,
    apply(u, p) {
      // Quick spike of damagePulse-like channel-split (no actual damage).
      const env = Math.sin(p * Math.PI);
      u.damagePulse = Math.max(u.damagePulse, env * 0.6);
    },
  },
  {
    name: 'reality-tear',
    weight: 0.8,
    durationS: 0.16,
    apply(u, p) {
      const env = Math.sin(p * Math.PI);
      u.damagePulse = Math.max(u.damagePulse, env);
    },
  },
  {
    name: 'gravity-wobble',
    weight: 1.0,
    durationS: 2.4,
    apply(u, p) {
      // Slow mid kaleido baseline lift.
      const env = Math.sin(p * Math.PI);
      u.kaleidoTrigger = Math.max(u.kaleidoTrigger, env * 0.3);
    },
  },
  {
    name: 'star-rain',
    weight: 1.4,
    durationS: 4.0,
    apply(u, p) {
      const env = Math.sin(p * Math.PI);
      u.kaleidoTrigger = Math.max(u.kaleidoTrigger, env * 0.18);
    },
  },
  {
    name: 'mushroom-pulse',
    weight: 1.6,
    durationS: 1.2,
    apply(u, p) {
      const env = Math.sin(p * Math.PI);
      u.kaleidoTrigger = Math.max(u.kaleidoTrigger, env * 0.22);
    },
  },
];

export class TrippyEventDirector {
  private nextFireT = 6;
  private currentEvent: EventDef | null = null;
  private currentStartT = 0;
  private cooldownUntilT = 0;
  /** Most recent fired event — exposed so a UI/debug can read it. */
  lastEvent: EventName | null = null;

  update(u: GlobalUniforms): void {
    const t = u.time;

    if (this.currentEvent) {
      const elapsed = t - this.currentStartT;
      const progress = elapsed / this.currentEvent.durationS;
      if (progress >= 1) {
        this.currentEvent = null;
        this.cooldownUntilT = t + 4;
      } else {
        this.currentEvent.apply(u, progress);
      }
      return;
    }

    if (t >= this.nextFireT && t >= this.cooldownUntilT) {
      this.fire(t);
      this.nextFireT = t + 8 + Math.random() * 7; // 8-15s
    }
  }

  private fire(t: number): void {
    const totalWeight = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalWeight;
    for (const ev of EVENTS) {
      r -= ev.weight;
      if (r <= 0) {
        this.currentEvent = ev;
        this.currentStartT = t;
        this.lastEvent = ev.name;
        return;
      }
    }
  }
}

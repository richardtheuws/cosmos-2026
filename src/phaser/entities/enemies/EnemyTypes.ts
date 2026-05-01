/**
 * Enemy data — 12 classes per PRD §4.3. Pure config, no Phaser deps so the file
 * is import-cheap. Behavior knobs are unioned into a single EnemyBehavior type;
 * `Enemy.ts` switches on `behavior.kind`.
 *
 * Sprite-mapping note: only 3 enemy sprites exist today (Brumberry, Hopper-
 * Cabbage, Eye-Plant — all `sprites/v2/`). Until Sprint 6E generates the
 * remaining 9, classes without a unique asset reuse a thematically-closest
 * sibling. `spriteTodo: true` flags them for future regeneration.
 *
 * Sprint 6C bomb-contract: enemies that participate in bomb damage must expose
 * a runtime `BombTarget` shape (see below). The Bomb explosion radius-checks
 * a list of BombTargets; it does NOT introspect EnemyDef. Sprint 6B's enemy
 * class is expected to implement `BombTarget` and register itself with the
 * scene's bomb-target list. `EyePlant` MUST also set `vulnerableToStomp:false`
 * at the runtime level so stomp damage falls through to taking damage from
 * Cosmo (bomb-only kill enforced).
 */
import type Phaser from 'phaser';

/** Runtime contract used by Bomb.explode() — Sprint 6B implements this on
 *  each enemy instance. Independent from EnemyDef so we don't have to import
 *  Phaser into the config table. */
export interface BombTarget {
  /** Visible/physical body. Used for bomb-radius distance check. */
  sprite: Phaser.Physics.Arcade.Sprite;
  /** Bomb-explode kills this entity. Mirror of EnemyDef.vulnerableToBomb. */
  vulnerableToBomb: boolean;
  /** Set false on EyePlant + SpittingWall to enforce bomb-only kill. */
  vulnerableToStomp: boolean;
  /** True after kill; Bomb skips dead enemies. */
  dead: boolean;
  /** Called by Bomb.explode() on hit. Returns true if killed. */
  onBombHit(): boolean;
}

export type EnemyKind =
  | 'brumberry'
  | 'hopper'
  | 'parachute'
  | 'eyePlant'
  | 'pinkWorm'
  | 'ghost'
  | 'spittingWall'
  | 'dragonfly'
  | 'flyingWisp'
  | 'suctionCrawler'
  | 'tulipLauncher'
  | 'sparkHazard';

export type EnemyBehavior =
  | { kind: 'patrol'; speed: number; flipOnEdge: boolean }
  | { kind: 'hop'; intervalMs: number; jumpVelocity: number; horizontalDrift: number }
  | { kind: 'drifter'; floatSpeed: number; postStompFallMul: number }
  | { kind: 'static' }
  | { kind: 'wallTurret'; fireIntervalMs: number; projectileSpeed: number; projectileLifeS: number; aimAtCosmo: boolean }
  | { kind: 'burrow'; surfaceRadiusPx: number; surfaceTimeS: number; burrowTimeS: number }
  | { kind: 'proximityGhost'; activateRadiusPx: number; chaseSpeed: number }
  | { kind: 'homing'; lerp: number; maxSpeed: number; activateRadiusPx: number }
  | { kind: 'sinusoid'; amplitudePx: number; frequencyHz: number; horizontalSpeed: number; diveOnAlignedRadiusPx: number }
  | { kind: 'wallCrawler'; speed: number }
  | { kind: 'tulipLauncher'; launchVelocity: number; cooldownS: number; hostileOnTouch: boolean }
  | { kind: 'rail'; speed: number; railLengthPx: number };

export interface EnemyDef {
  kind: EnemyKind;
  /** stomp-count to kill. `'invincible'` = ghost; `'bombOnly'` = Eye Plant / Spitting Wall. */
  stompsToKill: number | 'invincible' | 'bombOnly';
  /** Side/bottom touch deals damage. False for Tulip Launcher in friendly mode + most stompable enemies (they always damage on side-touch by default — we keep this as `true` for all damaging enemies). */
  damageOnTouch: boolean;
  /** Bombs kill this enemy. Always true for `bombOnly` flag enemies. */
  vulnerableToBomb: boolean;
  /** Sprite atlas key. May be reused across multiple kinds — see file header. */
  spriteKey: string;
  /** Display size (square). */
  displaySize: number;
  /** Hitbox size (square, centred). */
  bodySize: { w: number; h: number };
  /** TODO: dedicated sprite not yet generated. Reused from `spriteKey`. */
  spriteTodo: boolean;
  /** Tint applied to the reused sprite to differentiate visually until a real sprite ships. 0 = no tint. */
  tint: number;
  /** Behavior-knob config. */
  behavior: EnemyBehavior;
  /** Score on stomp. Hidden 50K bonuses are wired separately. */
  scoreOnKill: number;
}

const SPRITE_BRUM = 'enemy-brumberry';
const SPRITE_HOPPER = 'enemy-hopper';
const SPRITE_EYE = 'enemy-eye-plant';

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  brumberry: {
    kind: 'brumberry',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_BRUM,
    displaySize: 44,
    bodySize: { w: 32, h: 32 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'patrol', speed: 60, flipOnEdge: true },
    scoreOnKill: 200,
  },
  hopper: {
    kind: 'hopper',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_HOPPER,
    displaySize: 48,
    bodySize: { w: 36, h: 36 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'hop', intervalMs: 1400, jumpVelocity: -380, horizontalDrift: 35 },
    scoreOnKill: 250,
  },
  parachute: {
    kind: 'parachute',
    stompsToKill: 2,
    damageOnTouch: true,
    vulnerableToBomb: true,
    // TODO(sprint-6E): generate enemy-parachute-drifter sprite — reusing brumberry tinted mushroom-cream as placeholder.
    spriteKey: SPRITE_BRUM,
    displaySize: 48,
    bodySize: { w: 38, h: 36 },
    spriteTodo: true,
    tint: 0xE8D5B7,
    behavior: { kind: 'drifter', floatSpeed: 32, postStompFallMul: 4.5 },
    scoreOnKill: 400,
  },
  eyePlant: {
    kind: 'eyePlant',
    stompsToKill: 'bombOnly',
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_EYE,
    displaySize: 48,
    bodySize: { w: 36, h: 40 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'wallTurret', fireIntervalMs: 2200, projectileSpeed: 160, projectileLifeS: 3.5, aimAtCosmo: true },
    scoreOnKill: 500,
  },
  pinkWorm: {
    kind: 'pinkWorm',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    // TODO(sprint-6E): generate enemy-pink-worm sprite — reusing brumberry tinted faded-rose.
    spriteKey: SPRITE_BRUM,
    displaySize: 40,
    bodySize: { w: 32, h: 28 },
    spriteTodo: true,
    tint: 0xB85C7E,
    behavior: { kind: 'burrow', surfaceRadiusPx: 120, surfaceTimeS: 1.6, burrowTimeS: 2.4 },
    scoreOnKill: 350,
  },
  ghost: {
    kind: 'ghost',
    stompsToKill: 'invincible',
    damageOnTouch: true,
    vulnerableToBomb: false,
    // TODO(sprint-6E): generate translucent ghost sprite — reusing eye-plant tinted ink-aubergine + alpha as placeholder.
    spriteKey: SPRITE_EYE,
    displaySize: 56,
    bodySize: { w: 38, h: 44 },
    spriteTodo: true,
    tint: 0x3D2E4A,
    behavior: { kind: 'proximityGhost', activateRadiusPx: 180, chaseSpeed: 90 },
    scoreOnKill: 0,
  },
  spittingWall: {
    kind: 'spittingWall',
    stompsToKill: 'bombOnly',
    damageOnTouch: true,
    vulnerableToBomb: true,
    // Reuses eye-plant — same morphology family.
    spriteKey: SPRITE_EYE,
    displaySize: 48,
    bodySize: { w: 36, h: 40 },
    spriteTodo: true,
    tint: 0x2D4A3E,
    behavior: { kind: 'wallTurret', fireIntervalMs: 1600, projectileSpeed: 200, projectileLifeS: 2.8, aimAtCosmo: false },
    scoreOnKill: 500,
  },
  dragonfly: {
    kind: 'dragonfly',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    // TODO(sprint-6E): generate dragonfly sprite — reusing brumberry tinted sky-wash.
    spriteKey: SPRITE_BRUM,
    displaySize: 44,
    bodySize: { w: 36, h: 24 },
    spriteTodo: true,
    tint: 0x4A6FA5,
    behavior: { kind: 'sinusoid', amplitudePx: 36, frequencyHz: 0.9, horizontalSpeed: 90, diveOnAlignedRadiusPx: 96 },
    scoreOnKill: 400,
  },
  flyingWisp: {
    kind: 'flyingWisp',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    // TODO(sprint-6E): generate translucent wisp — reusing eye-plant tinted faded-rose.
    spriteKey: SPRITE_EYE,
    displaySize: 38,
    bodySize: { w: 28, h: 28 },
    spriteTodo: true,
    tint: 0xB85C7E,
    behavior: { kind: 'homing', lerp: 0.045, maxSpeed: 70, activateRadiusPx: 240 },
    scoreOnKill: 300,
  },
  suctionCrawler: {
    kind: 'suctionCrawler',
    stompsToKill: 2,
    damageOnTouch: true,
    vulnerableToBomb: true,
    // TODO(sprint-6E): generate insectoid crawler — reusing brumberry tinted forest-deep.
    spriteKey: SPRITE_BRUM,
    displaySize: 48,
    bodySize: { w: 36, h: 30 },
    spriteTodo: true,
    tint: 0x2D4A3E,
    behavior: { kind: 'wallCrawler', speed: 55 },
    scoreOnKill: 500,
  },
  tulipLauncher: {
    kind: 'tulipLauncher',
    stompsToKill: 1,
    damageOnTouch: false,
    vulnerableToBomb: true,
    // TODO(sprint-6E): generate tulip-launcher — reusing eye-plant tinted saffron.
    spriteKey: SPRITE_EYE,
    displaySize: 48,
    bodySize: { w: 36, h: 36 },
    spriteTodo: true,
    tint: 0xF4A261,
    behavior: { kind: 'tulipLauncher', launchVelocity: -720, cooldownS: 0.6, hostileOnTouch: false },
    scoreOnKill: 250,
  },
  sparkHazard: {
    kind: 'sparkHazard',
    stompsToKill: 'invincible',
    damageOnTouch: true,
    vulnerableToBomb: false,
    // TODO(sprint-6E): generate phosphorescent arc-jolt — reusing eye-plant tinted saffron.
    spriteKey: SPRITE_EYE,
    displaySize: 36,
    bodySize: { w: 28, h: 28 },
    spriteTodo: true,
    tint: 0xF4A261,
    behavior: { kind: 'rail', speed: 90, railLengthPx: 192 },
    scoreOnKill: 0,
  },
};

/** Legend-character → EnemyKind mapping for level grids. Keep single-char to
 *  match the existing decode loop in `levelL1.ts`. Documented in
 *  `enemies_systeem.md`. */
export const ENEMY_LEGEND: Record<string, EnemyKind> = {
  b: 'brumberry',
  h: 'hopper',
  p: 'parachute',
  e: 'eyePlant',
  w: 'pinkWorm',
  g: 'ghost',
  s: 'spittingWall',
  d: 'dragonfly',
  f: 'flyingWisp',
  c: 'suctionCrawler',
  t: 'tulipLauncher',
  z: 'sparkHazard',
};

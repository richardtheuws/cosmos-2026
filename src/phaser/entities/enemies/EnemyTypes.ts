/**
 * Enemy data — 12 classes per PRD §4.3. Pure config, no Phaser deps so the file
 * is import-cheap. Behavior knobs are unioned into a single EnemyBehavior type;
 * `Enemy.ts` switches on `behavior.kind`.
 *
 * Sprite-mapping (Sprint 7D — 2026-05-01): all 12 classes have dedicated
 * sprites. Brumberry / Hopper / Eye-Plant remain on `sprites/v2/`; the other
 * 9 ship from `sprites/v4/` (Sprint 7D Asset Generator pass — Flux Dev +
 * BiRefNet, locked palette, Hayao×Moebius style coherent with Cosmo
 * canonical). `spriteTodo` is now false on all classes; `tint` is 0 because
 * each sprite is colored at generation time, no runtime recoloring needed.
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
// Sprint 7D — dedicated sprites for the remaining 9 enemy classes.
const SPRITE_PARACHUTE = 'enemy-parachute';
const SPRITE_PINKWORM = 'enemy-pinkworm';
const SPRITE_GHOST = 'enemy-ghost';
const SPRITE_SPITTINGWALL = 'enemy-spittingwall';
const SPRITE_DRAGONFLY = 'enemy-dragonfly';
const SPRITE_FLYINGWISP = 'enemy-flyingwisp';
const SPRITE_SUCTIONCRAWLER = 'enemy-suctioncrawler';
const SPRITE_TULIPLAUNCHER = 'enemy-tuliplauncher';
const SPRITE_SPARK = 'enemy-spark';

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
    spriteKey: SPRITE_PARACHUTE,
    displaySize: 56,
    bodySize: { w: 38, h: 44 },
    spriteTodo: false,
    tint: 0,
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
    spriteKey: SPRITE_PINKWORM,
    displaySize: 44,
    bodySize: { w: 32, h: 28 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'burrow', surfaceRadiusPx: 120, surfaceTimeS: 1.6, burrowTimeS: 2.4 },
    scoreOnKill: 350,
  },
  ghost: {
    kind: 'ghost',
    stompsToKill: 'invincible',
    damageOnTouch: true,
    vulnerableToBomb: false,
    spriteKey: SPRITE_GHOST,
    displaySize: 60,
    bodySize: { w: 38, h: 44 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'proximityGhost', activateRadiusPx: 180, chaseSpeed: 90 },
    scoreOnKill: 0,
  },
  spittingWall: {
    kind: 'spittingWall',
    stompsToKill: 'bombOnly',
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_SPITTINGWALL,
    displaySize: 56,
    bodySize: { w: 40, h: 44 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'wallTurret', fireIntervalMs: 1600, projectileSpeed: 200, projectileLifeS: 2.8, aimAtCosmo: false },
    scoreOnKill: 500,
  },
  dragonfly: {
    kind: 'dragonfly',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_DRAGONFLY,
    displaySize: 52,
    bodySize: { w: 40, h: 24 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'sinusoid', amplitudePx: 36, frequencyHz: 0.9, horizontalSpeed: 90, diveOnAlignedRadiusPx: 96 },
    scoreOnKill: 400,
  },
  flyingWisp: {
    kind: 'flyingWisp',
    stompsToKill: 1,
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_FLYINGWISP,
    displaySize: 42,
    bodySize: { w: 28, h: 28 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'homing', lerp: 0.045, maxSpeed: 70, activateRadiusPx: 240 },
    scoreOnKill: 300,
  },
  suctionCrawler: {
    kind: 'suctionCrawler',
    stompsToKill: 2,
    damageOnTouch: true,
    vulnerableToBomb: true,
    spriteKey: SPRITE_SUCTIONCRAWLER,
    displaySize: 56,
    bodySize: { w: 40, h: 30 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'wallCrawler', speed: 55 },
    scoreOnKill: 500,
  },
  tulipLauncher: {
    kind: 'tulipLauncher',
    stompsToKill: 1,
    damageOnTouch: false,
    vulnerableToBomb: true,
    spriteKey: SPRITE_TULIPLAUNCHER,
    displaySize: 56,
    bodySize: { w: 36, h: 36 },
    spriteTodo: false,
    tint: 0,
    behavior: { kind: 'tulipLauncher', launchVelocity: -720, cooldownS: 0.6, hostileOnTouch: false },
    scoreOnKill: 250,
  },
  sparkHazard: {
    kind: 'sparkHazard',
    stompsToKill: 'invincible',
    damageOnTouch: true,
    vulnerableToBomb: false,
    spriteKey: SPRITE_SPARK,
    displaySize: 40,
    bodySize: { w: 28, h: 28 },
    spriteTodo: false,
    tint: 0,
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

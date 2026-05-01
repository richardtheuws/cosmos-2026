/**
 * Level 1 — "First Steps" — Bloomroot Veld (Slow Bloom biome).
 *
 * Hand-authored level layout in a compact tile-grid string. Each char encodes a
 * tile or entity. Loaded by L1Scene at boot. Supports Phaser TileSprite static
 * bodies (reliable physics) plus per-entity spawn entries.
 *
 * Legend:
 *   .   empty
 *   G   ground (moss)
 *   D   dirt block
 *   P   platform (forest-deep wood)
 *   M   mushroom platform (mushroom-cream)
 *   T   trampoline (beat-jump spring) — personal psychedelic-trip-anchor
 *   #   wall (ink-aubergine pillar)
 *   B   breakable wall — bomb-only path-opener (Sprint 6C)
 *   Q   bomb pickup — Cosmo.bombs += 1 (Sprint 6C)
 *   ^   spike hazard
 *   *   star pickup
 *   o   power-up (mushroom)
 *   H   hint globe
 *   E   spawn point Cosmo
 *   X   level exit
 *
 * Enemy legend (Sprint 6B — see `EnemyTypes.ts` ENEMY_LEGEND):
 *   b   Brumberry           — patrol L↔R, edge-flip, 1 stomp
 *   h   Hopper Cabbage      — timed hop, 1 stomp
 *   p   Parachute Drifter   — slow float, 2 stomps
 *   e   Eye Plant           — bombs only, projectile aimed at Cosmo
 *   w   Pink Worm           — burrow, surfaces near Cosmo
 *   g   Ghost               — invincible; chases ONLY when Cosmo facing-away
 *   s   Spitting Wall Plant — bombs only, fixed-direction projectile
 *   d   Dragonfly           — sinusoidal flight + dive on alignment
 *   f   Flying Wisp         — slow homing within radius
 *   c   Suction Crawler     — 2 stomps, ground-crawler
 *   t   Tulip Launcher      — friendly bounce (boosts Cosmo upward)
 *   z   Spark Hazard        — rail-bound, invincible
 *
 * Grid is rendered via TileSprite quads at TILE_SIZE = 32. World w = cols * 32.
 */

import { ENEMY_LEGEND, type EnemyKind } from '../phaser/entities/enemies/EnemyTypes';

export const TILE_SIZE = 32;

/** 60 cols × 22 rows. World = 1920 px wide, 704 px tall.
 *  Sprint 6B enemies placed for didactic walk-through:
 *    col  6  Brumberry on ground   — first patrol enemy
 *    col 13 Hopper on top of MMM   — timed-hop demo
 *    col 27 Eye Plant on ground    — bombs-only demo (player must skip)
 *    col 35 Worm spawn             — burrow demo
 *    col 42 Dragonfly mid-air      — sinusoid flier
 *    col 47 Spitting Wall on plat. — bombs-only static turret
 *    col 51 Tulip Launcher friendly bounce
 *    col 55 Ghost                  — facing-away chase demo
 *    col 14 Flying Wisp mid-air    — homing demo
 *    col  9 Spark Hazard rail      — invincible rail
 *    col 33 Suction Crawler ground — 2-stomp tank
 *    col 39 Parachute Drifter mid-air — drifting jellyfish */
export const L1_GRID = [
  '............................................................', // 0
  '............................................................',
  '..H.........................................................',
  '............................................................',
  '............................................................',
  '..............................**............................', // 5
  '............*..............MMMMMMMMM........................',
  '...........MMM..............h.........................d.....',
  '..............f...............................**............',
  '....................**.......................MMMM..........',
  '...................MMMM..........................H..........', // 10
  '...........#..............**.................MMMM...........',
  '...........#..............MMMM........*.........#...........',
  '...........#......*..............MMMMMMMMM......#...........',
  '....*......#......^^^......*..........#.........#......p....',
  '...MMM.....#.....DDDDDD..MMMMMM........#.....*.MMMMM........', // 15
  '...........#.................**........#....MMM.............',
  '...........#......*..TT.................#......TT...........',
  'E.Q..*b.o..#z....MMMc.......w.H..Q......#e.....s..tBB.**g....', // 18
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG^^GGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // 19
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 20
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 21
];

export const HINT_LINES = [
  /** Index = order of trigger. Filename matches in /public/assets/audio/voices/. */
  { id: 'globe-l1-1', text: 'Gebruik je handen — ze plakken aan muren.' },
  { id: 'globe-l1-2', text: 'Sterren liggen niet altijd op de grond. Kijk omhoog.' },
  { id: 'globe-l1-3', text: 'Drie hartjes — paddenstoelen verhogen je max.' },
];

export interface L1Spawn {
  type: 'cosmo' | 'star' | 'powerup' | 'hint' | 'exit' | 'spike' | 'wall' | 'platform' | 'mushroom' | 'ground' | 'dirt' | 'trampoline' | 'breakableWall' | 'bombPickup' | 'enemy';
  x: number;
  y: number;
  hintIdx?: number;
  enemyKind?: EnemyKind;
}

/** Decode the grid into spawn objects + tile positions. Called once at scene-create. */
export function decodeLevel(grid: string[]): L1Spawn[] {
  const out: L1Spawn[] = [];
  let hintCounter = 0;
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r];
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;
      switch (ch) {
        case 'E': out.push({ type: 'cosmo', x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2 }); break;
        case '*': out.push({ type: 'star', x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2 }); break;
        case 'o': out.push({ type: 'powerup', x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2 }); break;
        case 'H': out.push({ type: 'hint', x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2, hintIdx: hintCounter++ % HINT_LINES.length }); break;
        case 'X': out.push({ type: 'exit', x, y }); break;
        case '^': out.push({ type: 'spike', x, y }); break;
        case '#': out.push({ type: 'wall', x, y }); break;
        case 'P': out.push({ type: 'platform', x, y }); break;
        case 'M': out.push({ type: 'mushroom', x, y }); break;
        case 'G': out.push({ type: 'ground', x, y }); break;
        case 'D': out.push({ type: 'dirt', x, y }); break;
        case 'T': out.push({ type: 'trampoline', x, y }); break;
        case 'B': out.push({ type: 'breakableWall', x, y }); break;
        case 'Q': out.push({ type: 'bombPickup', x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2 }); break;
        default: {
          const kind = ENEMY_LEGEND[ch];
          if (kind) {
            out.push({ type: 'enemy', x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2, enemyKind: kind });
          }
          break;
        }
      }
    }
  }
  return out;
}

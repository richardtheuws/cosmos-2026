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
 *   #   wall (ink-aubergine pillar)
 *   ^   spike hazard
 *   *   star pickup
 *   o   power-up (mushroom)
 *   H   hint globe
 *   E   spawn point Cosmo
 *   X   level exit
 *
 * Grid is rendered via TileSprite quads at TILE_SIZE = 32. World w = cols * 32.
 */

export const TILE_SIZE = 32;

/** 60 cols × 22 rows. World = 1920 px wide, 704 px tall. */
export const L1_GRID = [
  '............................................................', // 0
  '............................................................',
  '..H.........................................................',
  '............................................................',
  '............................................................',
  '..............................**............................', // 5
  '............*..............MMMMMMMMM........................',
  '...........MMM........................**....................',
  '..............................................**............',
  '....................**.......................MMMM..........',
  '...................MMMM..........................H..........', // 10
  '...........#..............**.................MMMM...........',
  '...........#..............MMMM........*.........#...........',
  '...........#......*..............MMMMMMMMM......#...........',
  '....*......#......^^^......*..........#.........#...........',
  '...MMM.....#.....DDDDDD..MMMMMM........#.....*.MMMMM........', // 15
  '...........#.................**........#....MMM.............',
  '...........#......*.....................#...................',
  'E....*..o..#.....MMM..........H.........#......*............',
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
  type: 'cosmo' | 'star' | 'powerup' | 'hint' | 'exit' | 'spike' | 'wall' | 'platform' | 'mushroom' | 'ground' | 'dirt';
  x: number;
  y: number;
  hintIdx?: number;
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
        default: break;
      }
    }
  }
  return out;
}

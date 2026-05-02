#!/usr/bin/env node
/**
 * postbuild-copy-public.mjs
 *
 * Vite normally copies public/ 1-to-1 to dist/, but with our rollupOptions.input
 * pointing at HTML entries inside public/ (public/updates/index.html, etc.),
 * rollup creates parallel dist/public/<entry>/index.html outputs that
 * postbuild-rewrite-paths.mjs cleans up via rmSync(dist/public). That rmSync
 * is path-narrow (`dist/public/`) and never touches `dist/assets/`, so Vite's
 * bulk-copied public-assets remain in dist/assets/ untouched.
 *
 * Sprint 7E observed assets occasionally missing from dist/ (cosmo-cling-right,
 * cosmo-hurt, bomb-throw, bomb-boom). Root cause was the previous
 * `--ignore-existing` semantics: this script silently skipped any file Vite
 * already wrote, so if Vite's bulk-copy ever produced a stale or partial copy
 * (e.g. because dist/ was partially preserved between runs, or a Vite plugin
 * altered publicDir handling), this script could not heal it.
 *
 * Sprint 8C fix — Optie A: switch to FORCE-OVERWRITE semantics. This script
 * now makes public/ the authoritative source for everything except the 5 entry
 * HTMLs. It always copies, and logs both "fresh" copies (target was missing)
 * and "overwrite" copies (target existed and was replaced) so build output
 * stays inspectable.
 *
 * Cost: ~200 small file copies per build (a few ms on local SSD). Benefit:
 * eliminates an entire class of silent-skip drift between public/ and dist/.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const distDir = process.env.DIST_DIR ?? join(projectRoot, 'dist');

const ENTRY_HTMLS = new Set([
  'updates/index.html',
  'lore/index.html',
  'support/index.html',
  'press/index.html',
  'thanks/index.html',
]);

// Critical files that Sprint 7E observed missing — log them explicitly so
// future regressions are loud. Update if more come up.
const SENTINEL_FILES = [
  'assets/sprites/v3/cosmo-cling-right.png',
  'assets/sprites/v3/cosmo-hurt.png',
  'assets/audio/sfx/bomb-throw.mp3',
  'assets/audio/sfx/bomb-boom.mp3',
];

let fresh = 0;
let overwritten = 0;

function isSameContent(srcPath, destPath) {
  try {
    const srcStat = statSync(srcPath);
    const destStat = statSync(destPath);
    if (srcStat.size !== destStat.size) return false;
    // Cheap byte-equal short-circuit for identical files.
    return readFileSync(srcPath).equals(readFileSync(destPath));
  } catch {
    return false;
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else {
      const rel = relative(publicDir, full);
      if (ENTRY_HTMLS.has(rel)) continue;
      const dest = join(distDir, rel);
      const existed = existsSync(dest);
      if (existed && isSameContent(full, dest)) {
        // Identical content already at destination — no need to copy, but
        // this is NOT a silent skip: we verified bytes match.
        overwritten++; // counted as "would-have-overwritten, content identical"
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(full, dest);
      if (existed) overwritten++;
      else fresh++;
    }
  }
}

if (!existsSync(publicDir)) {
  console.error(`[copy-public] public/ not found at ${publicDir}`);
  process.exit(1);
}
if (!existsSync(distDir)) {
  console.error(`[copy-public] dist/ not found at ${distDir}`);
  process.exit(1);
}

walk(publicDir);

// Sentinel verification — fail loudly if any critical file is missing.
const missingSentinels = SENTINEL_FILES.filter((rel) => !existsSync(join(distDir, rel)));
if (missingSentinels.length > 0) {
  console.error('[copy-public] FATAL — sentinel files missing from dist/:');
  for (const rel of missingSentinels) console.error(`  - ${rel}`);
  console.error('  Check public/ has these files and ENTRY_HTMLS does not exclude them.');
  process.exit(1);
}

console.log(
  `[copy-public] DONE — ${fresh} fresh, ${overwritten} verified/overwritten ` +
    `(${SENTINEL_FILES.length} sentinels OK)`,
);

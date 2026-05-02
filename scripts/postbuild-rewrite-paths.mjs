#!/usr/bin/env node
/**
 * postbuild-rewrite-paths.mjs
 *
 * Fixes anchor hrefs and remaining absolute asset paths in dist/*.html
 * that Vite leaves alone (it only rewrites <link>/<img>/<script>/url()).
 *
 * Without this, /play/, /lore/, /support/, etc., link to https://theuws.com/play/
 * instead of https://theuws.com/games/cosmos-2026/play/.
 *
 * Strategy: replace `="/X/"` with `="<base>X/"` for known site routes,
 * and `="/showcase-assets/...` / `="/assets/...` with the prefixed variant.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = process.env.DIST_DIR ?? resolve(__dirname, '..', 'dist');
const BASE = process.env.VITE_BASE ?? '/games/cosmos-2026/';

if (!existsSync(distDir)) {
  console.error(`[postbuild] dist/ not found at ${distDir}`);
  process.exit(1);
}

// Routes that need rewriting in <a href="/X/">
const ROUTES = ['play', 'lore', 'prd', 'support', 'press', 'updates', 'thanks'];
// Asset prefixes that need rewriting if not yet prefixed
const ASSET_PREFIXES = ['/showcase-assets/', '/assets/'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

function rewrite(html) {
  let out = html;
  let count = 0;

  // 1. Anchor hrefs to known routes:  href="/play/"  ->  href="<BASE>play/"
  for (const route of ROUTES) {
    // Match both bare /route/ and /route/#anchor or /route/sub
    const re = new RegExp(`(href|src)="\\/${route}(\\/[^"]*)?"`, 'g');
    out = out.replace(re, (_m, attr, tail = '') => {
      count++;
      return `${attr}="${BASE}${route}${tail || '/'}"`;
    });
  }

  // 2. Bare home link  href="/"  ->  href="<BASE>"
  out = out.replace(/(href|src)="\/"/g, (_m, attr) => {
    count++;
    return `${attr}="${BASE}"`;
  });

  // 3. Asset paths Vite missed
  for (const prefix of ASSET_PREFIXES) {
    const re = new RegExp(`(href|src)="${prefix.replace(/\//g, '\\/')}([^"]*)"`, 'g');
    out = out.replace(re, (_m, attr, tail) => {
      // Skip if already pointing at our base
      if (BASE.endsWith(prefix)) return _m;
      count++;
      return `${attr}="${BASE.replace(/\/$/, '')}${prefix}${tail}"`;
    });
  }

  return { html: out, count };
}

const files = walk(distDir);
let totalFiles = 0;
let totalEdits = 0;
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const { html: rewritten, count } = rewrite(html);
  if (count > 0) {
    writeFileSync(file, rewritten);
    totalFiles++;
    totalEdits += count;
    console.log(`[postbuild] rewrote ${count} paths in ${file.replace(distDir, 'dist')}`);
  }
}

// Remove duplicate dist/public/ tree (Vite's rollupOptions.input quirk creates both
// dist/lore/ and dist/public/lore/ — we only want the root copies).
const dupTree = join(distDir, 'public');
if (existsSync(dupTree)) {
  rmSync(dupTree, { recursive: true, force: true });
  console.log('[postbuild] removed duplicate dist/public/ tree');
}

console.log(`[postbuild] DONE — ${totalEdits} edits across ${totalFiles} files (BASE=${BASE})`);

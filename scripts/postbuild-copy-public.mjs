#!/usr/bin/env node
/**
 * postbuild-copy-public.mjs
 *
 * Vite normally copies public/ 1-to-1 to dist/, but with our rollupOptions.input
 * pointing at HTML entries inside public/ (public/updates/index.html, etc.),
 * Vite treats those entries as source files and skips bulk-copying public/.
 *
 * This script runs AFTER vite build + postbuild-rewrite-paths and copies any
 * public/ files that are not entry HTMLs into dist/, preserving directory layout.
 *
 * It uses --ignore-existing semantics: never overwrite a file Vite already wrote.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const distDir = join(projectRoot, 'dist');

const ENTRY_HTMLS = new Set([
  'updates/index.html',
  'lore/index.html',
  'support/index.html',
  'press/index.html',
  'thanks/index.html',
]);

let copied = 0;
let skipped = 0;

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
      if (existsSync(dest)) {
        skipped++;
        continue;
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(full, dest);
      copied++;
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
console.log(`[copy-public] DONE — copied ${copied} files, skipped ${skipped} existing`);

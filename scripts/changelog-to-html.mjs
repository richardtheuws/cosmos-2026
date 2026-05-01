#!/usr/bin/env node
/**
 * changelog-to-html.mjs
 *
 * Parses CHANGELOG.md (Keep-a-Changelog format) and emits the timeline portion
 * of public/updates/index.html. The page itself contains a placeholder marker
 * — <!-- TIMELINE:START --> ... <!-- TIMELINE:END --> — that gets replaced.
 *
 * Run via `npm run updates:build` (also chained inside `npm run build`).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHANGELOG_PATH = resolve(ROOT, 'CHANGELOG.md');
const UPDATES_PATH = resolve(ROOT, 'public/updates/index.html');

const TAG_VOCAB = {
  added: 'feat',
  changed: 'change',
  deprecated: 'deprecated',
  removed: 'fix',
  fixed: 'fix',
  security: 'security',
  decisions: 'gameplay',
  'decisions locked': 'gameplay',
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Parse a Keep-a-Changelog markdown into structured entries.
 * Returns: [{ version, date, sections: [{ title, items: [string] }] }, ...]
 */
function parseChangelog(md) {
  const lines = md.split('\n');
  const entries = [];
  let current = null;
  let sectionTitle = null;
  let sectionItems = null;

  const flushSection = () => {
    if (current && sectionTitle && sectionItems && sectionItems.length) {
      current.sections.push({ title: sectionTitle, items: sectionItems });
    }
    sectionTitle = null;
    sectionItems = null;
  };

  const flushEntry = () => {
    flushSection();
    if (current) entries.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    const versionMatch = line.match(/^##\s+\[([^\]]+)\]\s*[—\-]?\s*(.*)$/);
    if (versionMatch) {
      flushEntry();
      current = {
        version: versionMatch[1].trim(),
        date: versionMatch[2].trim(),
        sections: [],
      };
      continue;
    }
    if (!current) continue;

    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      flushSection();
      sectionTitle = sectionMatch[1].trim();
      sectionItems = [];
      continue;
    }

    if (!sectionItems) continue;
    const itemMatch = line.match(/^[\-\*]\s+(.+)$/);
    if (itemMatch) {
      sectionItems.push(itemMatch[1].trim());
    } else if (line.startsWith('  ') && sectionItems.length) {
      sectionItems[sectionItems.length - 1] += ' ' + line.trim();
    }
  }
  flushEntry();
  return entries;
}

function tagFor(sectionTitle) {
  const key = sectionTitle.toLowerCase().trim();
  return TAG_VOCAB[key] || 'change';
}

function tagLabel(tag) {
  const labels = {
    feat: 'Feature',
    change: 'Wijziging',
    fix: 'Fix',
    deprecated: 'Deprecated',
    security: 'Security',
    gameplay: 'Gameplay',
    ui: 'UI',
    visual: 'Visual',
    audio: 'Audio',
  };
  return labels[tag] || tag;
}

function renderEntry(entry) {
  const tags = new Set();
  entry.sections.forEach((s) => tags.add(tagFor(s.title)));
  const tagPills = Array.from(tags)
    .map((t) => `<span class="tag tag--${t}">${tagLabel(t)}</span>`)
    .join('\n          ');

  const sectionsHtml = entry.sections
    .map(
      (s) => `
        <h3>${escapeHtml(s.title.toUpperCase())}</h3>
        <ul class="update__highlights">
          ${s.items.map((it) => `<li>${escapeHtml(it)}</li>`).join('\n          ')}
        </ul>`,
    )
    .join('');

  // Try to extract a title from the date string if author put one inline; fall back to version.
  const titleMatch = entry.date.match(/[—\-]\s*(.+)$/);
  const dateClean = entry.date.replace(/^[—\-]?\s*/, '').split(/\s*[—\-]\s+/)[0];
  const title = titleMatch ? titleMatch[1] : `Sprint ${entry.version}`;

  return `
    <article class="update" data-reveal>
      <div class="update__card">
        <div class="update__header">
          <span class="update__version">v${escapeHtml(entry.version)}</span>
          <span class="update__date">${escapeHtml(dateClean)}</span>
          <h2 class="update__title">${escapeHtml(title)}</h2>
        </div>
        <div class="update__body">
          <div class="update__tags">
          ${tagPills}
          </div>${sectionsHtml}
        </div>
      </div>
    </article>`;
}

async function main() {
  const md = await readFile(CHANGELOG_PATH, 'utf8');
  const html = await readFile(UPDATES_PATH, 'utf8');

  const entries = parseChangelog(md);
  if (!entries.length) {
    console.error('[changelog-to-html] No entries found in CHANGELOG.md');
    process.exit(1);
  }

  const timeline = entries.map(renderEntry).join('\n');
  const next = html.replace(
    /<!--\s*TIMELINE:START\s*-->[\s\S]*?<!--\s*TIMELINE:END\s*-->/,
    `<!-- TIMELINE:START -->\n${timeline}\n      <!-- TIMELINE:END -->`,
  );

  if (next === html) {
    console.warn('[changelog-to-html] Timeline markers not found — nothing replaced.');
    return;
  }

  await writeFile(UPDATES_PATH, next, 'utf8');
  console.log(`[changelog-to-html] Rendered ${entries.length} entries → ${UPDATES_PATH}`);
}

main().catch((e) => {
  console.error('[changelog-to-html] Failed:', e);
  process.exit(1);
});

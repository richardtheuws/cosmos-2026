#!/usr/bin/env python3
"""
Wave 24 — interactive curation contact sheet.

Scans .wave24-candidates/ and emits a self-contained index.html where you CLICK
the best candidate per asset (one pick each; agent-recommended pre-selected so
you only override disagreements), then "Download picks.json" → ~/Downloads.
Claude reads that file and promotes the picks.

Usage:  python3 scripts/wave24/contact_sheet.py
Output: .wave24-candidates/index.html
"""
from __future__ import annotations
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CAND = ROOT / '.wave24-candidates'
EXTS = {'.png', '.jpeg', '.jpg', '.webp'}

# Agent-recommended pick per asset dir (from run-2 curation notes). Pre-selected;
# override by clicking another candidate. Unknown dirs start unselected.
RECOMMENDED = {
    'sunbeam-patch': 'best-c3.png',
    'glow-cap-cluster': 'best-c2.png',
    'ink-water-surface-4k': 'best-c2.png',
    'kelp-organ': 'best-c1.png',
    'updraft-current': 'best-c1.png',
    'jellyfish-cyan': 'best-c1.png',
    'deep-glow-lure': 'best-c1.png',
    'light-shaft': 'best-c1.png',
    'water-motes': 'best-c2.png',
    'spore-chart-void-4k': 'wash-c1.png',
    'spore-bloom-core': 'best-c3.png',
    'spore-bloom-becoming': 'best-c1.png',
    'biome-dusk-dune-4k': 'best-c3.png',
    'glass-bead-bloom': 'best-c2.png',
    'wind-bowl': 'best-c1.png',
}


def target_for(dirname: str) -> str:
    """Derive the final asset path from the candidate dir name."""
    if '__' in dirname:  # parallax layer: biome-dusk-dune__layer-1_x -> .../biome-dusk-dune/layer-1_x.png
        base, layer = dirname.split('__', 1)
        return f'public/assets/backgrounds/{base}/{layer}.png'
    backgrounds = {
        'ink-water-surface-4k', 'ink-water-abyss-4k', 'spore-chart-void-4k',
        'spore-chart-nebula-wash', 'biome-dusk-dune-4k', 'biome-dusk-hollow-4k',
    }
    sub = 'backgrounds' if dirname in backgrounds else 'objects'
    return f'public/assets/{sub}/{dirname}.png'


def engine_of(name: str) -> str:
    if name.startswith('best-'):
        return 'best (Ultra/Recraft+matte)'
    if name.startswith('wash-'):
        return 'best (abstract-wash regen)'
    if name.startswith('regen-'):
        return 'best (regen)'
    if name.startswith('fal-'):
        return 'fal Flux Pro v1.1'
    if name.startswith('nb-'):
        return 'nano-banana Flash'
    return 'other'


def order_key(p: Path) -> tuple:
    pref = {'b': 0, 'w': 1, 'r': 2, 'f': 3, 'n': 4}.get(p.name[0], 5)
    return (pref, p.name)


def main() -> int:
    if not CAND.is_dir():
        print('no .wave24-candidates/ dir'); return 1

    dirs = sorted(d for d in CAND.iterdir()
                  if d.is_dir() and not d.name.startswith('_'))

    sections = []
    targets = {}
    total_imgs = 0
    n_assets = 0
    for d in dirs:
        imgs = sorted((p for p in d.iterdir()
                       if p.suffix.lower() in EXTS and not p.name.endswith('.raw.png')),
                      key=order_key)
        if not imgs:
            continue
        n_assets += 1
        total_imgs += len(imgs)
        targets[d.name] = target_for(d.name)
        rec = RECOMMENDED.get(d.name)

        spec = ''
        spec_f = d / 'SPEC.md'
        if spec_f.exists():
            spec = html.escape(spec_f.read_text()[:1600])

        cards = []
        for p in imgs:
            rel = f'{d.name}/{p.name}'
            is_rec = (p.name == rec)
            badge = '<span class="rec">★ agent pick</span>' if is_rec else ''
            cards.append(
                f'<figure class="cand{" sel" if is_rec else ""}" '
                f'data-asset="{html.escape(d.name)}" data-file="{html.escape(p.name)}" '
                f'tabindex="0" role="button" aria-pressed="{"true" if is_rec else "false"}">'
                f'<div class="imgwrap"><img loading="lazy" src="{html.escape(rel)}"><span class="check">✓</span></div>'
                f'<figcaption><b>{html.escape(p.name)}</b>{badge}<br>'
                f'<span class="eng">{html.escape(engine_of(p.name))}</span></figcaption></figure>'
            )
        sections.append(
            f'<section class="asset" id="asset-{html.escape(d.name)}" data-asset="{html.escape(d.name)}">'
            f'<h2><span class="dot" aria-hidden="true"></span>{html.escape(d.name)} '
            f'<span class="count">({len(imgs)})</span> '
            f'<span class="chosen" data-for="{html.escape(d.name)}"></span></h2>'
            f'<div class="row">{"".join(cards)}</div>'
            + (f'<details><summary>SPEC / agent reasoning</summary><pre>{spec}</pre></details>' if spec else '')
            + '</section>'
        )

    targets_json = json.dumps(targets)
    asset_list = json.dumps(sorted(targets.keys()))

    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wave 24 — pick assets</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; padding:0 1.5rem 4rem; background:#1A1226; color:#F5EDD8;
         font-family:'Inter',system-ui,sans-serif; }}
  .bar {{ position:sticky; top:0; z-index:50; background:rgba(26,18,38,.96);
          backdrop-filter:blur(6px); padding:1rem 0 .8rem; margin:0 -1.5rem 1rem;
          padding-left:1.5rem; padding-right:1.5rem; border-bottom:1px solid rgba(232,196,184,.2);
          display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }}
  .bar h1 {{ font-family:'Cormorant',Georgia,serif; font-style:italic; font-weight:600;
             color:#E8C4B8; margin:0; font-size:1.4rem; }}
  .progress {{ color:rgba(245,237,216,.8); font-size:.95rem; }}
  .progress b {{ color:#F2B134; }}
  button {{ font-family:'Inter',system-ui,sans-serif; font-size:.9rem; padding:.5rem 1rem;
            border-radius:999px; border:1px solid rgba(242,177,52,.55);
            background:rgba(242,177,52,.16); color:#F5EDD8; cursor:pointer; }}
  button.ghost {{ border-color:rgba(184,205,214,.4); background:transparent; color:#B8CDD6; }}
  button:hover {{ filter:brightness(1.15); }}
  .hint {{ flex-basis:100%; color:rgba(245,237,216,.6); font-size:.82rem; margin-top:.1rem; }}
  .asset {{ border-top:1px solid rgba(232,196,184,.18); padding:1rem 0; }}
  h2 {{ font-size:1.05rem; margin:.2rem 0 .7rem; display:flex; align-items:center; gap:.5rem; }}
  .dot {{ width:9px; height:9px; border-radius:50%; background:#5a4a6e; flex:0 0 auto; }}
  .asset.done .dot {{ background:#7BC47F; }}
  .count {{ color:rgba(245,237,216,.45); font-weight:400; font-size:.82rem; }}
  .chosen {{ color:#F2B134; font-size:.85rem; font-weight:500; }}
  .row {{ display:flex; flex-wrap:wrap; gap:1rem; }}
  .cand {{ margin:0; width:228px; border-radius:10px; padding:5px; cursor:pointer;
           border:2px solid transparent; transition:border-color .15s, background .15s; }}
  .cand:hover {{ background:rgba(245,237,216,.05); }}
  .cand:focus-visible {{ outline:2px solid #B8CDD6; }}
  .cand.sel {{ border-color:#F2B134; background:rgba(242,177,52,.1); }}
  .imgwrap {{ position:relative;
    background-image:
      linear-gradient(45deg,#3a2d52 25%,transparent 25%),
      linear-gradient(-45deg,#3a2d52 25%,transparent 25%),
      linear-gradient(45deg,transparent 75%,#3a2d52 75%),
      linear-gradient(-45deg,transparent 75%,#3a2d52 75%);
    background-size:20px 20px; background-position:0 0,0 10px,10px -10px,-10px 0;
    background-color:#241a36; border-radius:7px; overflow:hidden;
    display:flex; align-items:center; justify-content:center; min-height:150px; }}
  .cand img {{ max-width:100%; max-height:300px; display:block; }}
  .check {{ position:absolute; top:6px; right:6px; width:26px; height:26px; border-radius:50%;
            background:#F2B134; color:#1A1226; font-weight:700; display:none;
            align-items:center; justify-content:center; font-size:1rem; }}
  .cand.sel .check {{ display:flex; }}
  figcaption {{ font-size:.78rem; padding:.4rem .2rem; line-height:1.4; }}
  .eng {{ color:#B8CDD6; }}
  .rec {{ color:#F2B134; margin-left:.4rem; font-size:.72rem; }}
  details {{ margin-top:.6rem; }}
  summary {{ cursor:pointer; color:rgba(245,237,216,.55); font-size:.82rem; }}
  pre {{ white-space:pre-wrap; background:#241a36; padding:.8rem; border-radius:6px;
         font-size:.74rem; color:rgba(245,237,216,.8); overflow-x:auto; }}
  .toast {{ position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%);
            background:#3A2D52; color:#F5EDD8; padding:.7rem 1.3rem; border-radius:999px;
            border:1px solid rgba(242,177,52,.5); opacity:0; transition:opacity .3s; z-index:60; }}
</style></head><body>
<div class="bar">
  <h1>Wave 24 — pick the best per asset</h1>
  <span class="progress"><b id="pcount">0</b> / <span id="ptotal">0</span> chosen</span>
  <button id="dl">⬇ Download picks.json</button>
  <button class="ghost" id="copy">Copy JSON</button>
  <button class="ghost" id="resetRec">Reset to agent picks</button>
  <button class="ghost" id="clear">Clear all</button>
  <span class="hint">Click a candidate to choose it for that asset (★ = agent's pick, pre-selected). Then Download picks.json → it lands in ~/Downloads and I read it.</span>
</div>
{''.join(sections)}
<div class="toast" id="toast"></div>
<script>
const TARGETS = {targets_json};
const ASSETS = {asset_list};
const LS = 'wave24-picks-v1';
let picks = {{}};

function loadInitial() {{
  const saved = localStorage.getItem(LS);
  if (saved) {{ try {{ picks = JSON.parse(saved); return; }} catch(e){{}} }}
  // default to the pre-selected (.sel) recommendations
  document.querySelectorAll('.cand.sel').forEach(c => {{
    picks[c.dataset.asset] = c.dataset.file;
  }});
}}
function persist() {{ localStorage.setItem(LS, JSON.stringify(picks)); }}

function render() {{
  document.querySelectorAll('.cand').forEach(c => {{
    const on = picks[c.dataset.asset] === c.dataset.file;
    c.classList.toggle('sel', on);
    c.setAttribute('aria-pressed', on ? 'true':'false');
  }});
  document.querySelectorAll('.asset').forEach(s => {{
    const a = s.dataset.asset, f = picks[a];
    s.classList.toggle('done', !!f);
    const tag = s.querySelector('.chosen');
    if (tag) tag.textContent = f ? '✓ ' + f : '';
  }});
  document.getElementById('pcount').textContent = Object.keys(picks).filter(k=>picks[k]).length;
  document.getElementById('ptotal').textContent = ASSETS.length;
}}

function choose(asset, file) {{ picks[asset] = file; persist(); render(); }}

document.querySelectorAll('.cand').forEach(c => {{
  const fire = () => choose(c.dataset.asset, c.dataset.file);
  c.addEventListener('click', fire);
  c.addEventListener('keydown', e => {{ if (e.key==='Enter'||e.key===' ') {{ e.preventDefault(); fire(); }} }});
}});

function buildJSON() {{
  const out = {{}};
  for (const a of ASSETS) if (picks[a]) out[a] = {{ file: picks[a], target: TARGETS[a] }};
  return JSON.stringify(out, null, 2);
}}
function toast(msg) {{ const t=document.getElementById('toast'); t.textContent=msg; t.style.opacity='1';
  setTimeout(()=>t.style.opacity='0', 2200); }}

document.getElementById('dl').addEventListener('click', () => {{
  const blob = new Blob([buildJSON()], {{type:'application/json'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'wave24-picks.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Saved wave24-picks.json to your Downloads');
}});
document.getElementById('copy').addEventListener('click', async () => {{
  try {{ await navigator.clipboard.writeText(buildJSON()); toast('Picks JSON copied'); }}
  catch(e) {{ toast('Copy failed — use Download'); }}
}});
document.getElementById('resetRec').addEventListener('click', () => {{
  picks = {{}}; document.querySelectorAll('.cand').forEach(c => {{
    if (c.querySelector('.rec')) picks[c.dataset.asset] = c.dataset.file;
  }}); persist(); render(); toast('Reset to agent picks');
}});
document.getElementById('clear').addEventListener('click', () => {{
  picks = {{}}; persist(); render(); toast('Cleared all');
}});

loadInitial(); render();
</script>
</body></html>"""

    out = CAND / 'index.html'
    out.write_text(doc)
    rec_n = sum(1 for d in targets if d in RECOMMENDED)
    print(f'[contact-sheet] {n_assets} assets, {total_imgs} candidates, '
          f'{rec_n} pre-selected -> {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Wave 24 — curation contact sheet.

Scans .wave24-candidates/ and emits a single self-contained index.html that
shows every candidate per asset side-by-side (run-2 best-method first, then the
run-1 fal/nano baseline), on a checkered backdrop so transparency reads true.
Open it in a browser to curate: pick the strongest candidate per asset.

Usage:  python3 scripts/wave24/contact_sheet.py
Output: .wave24-candidates/index.html
"""
from __future__ import annotations
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
CAND = ROOT / '.wave24-candidates'

EXTS = {'.png', '.jpeg', '.jpg', '.webp'}


def engine_of(name: str) -> str:
    if name.startswith('best-'):
        return 'BEST (Ultra/Recraft + matte)'
    if name.startswith('fal-'):
        return 'fal Flux Pro v1.1'
    if name.startswith('nb-'):
        return 'nano-banana Flash'
    return 'other'


def order_key(p: Path) -> tuple:
    # best- first, then fal-, then nb-, then alpha within
    pref = {'b': 0, 'f': 1, 'n': 2}.get(p.name[0], 3)
    return (pref, p.name)


def main() -> int:
    if not CAND.is_dir():
        print('no .wave24-candidates/ dir'); return 1

    dirs = sorted(d for d in CAND.iterdir()
                  if d.is_dir() and not d.name.startswith('_'))

    parts: list[str] = []
    total_imgs = 0
    for d in dirs:
        imgs = sorted((p for p in d.iterdir()
                       if p.suffix.lower() in EXTS and not p.name.endswith('.raw.png')),
                      key=order_key)
        if not imgs:
            continue
        total_imgs += len(imgs)

        spec = ''
        spec_f = d / 'SPEC.md'
        if spec_f.exists():
            spec = html.escape(spec_f.read_text()[:1400])

        cards = []
        for p in imgs:
            rel = f'{d.name}/{p.name}'
            cards.append(
                f'<figure class="cand"><div class="imgwrap"><img loading="lazy" src="{html.escape(rel)}"></div>'
                f'<figcaption><b>{html.escape(p.name)}</b><br><span class="eng">{html.escape(engine_of(p.name))}</span></figcaption></figure>'
            )
        parts.append(
            f'<section class="asset"><h2>{html.escape(d.name)} '
            f'<span class="count">({len(imgs)} candidates)</span></h2>'
            f'<div class="row">{"".join(cards)}</div>'
            + (f'<details><summary>SPEC</summary><pre>{spec}</pre></details>' if spec else '')
            + '</section>'
        )

    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wave 24 — asset curation ({len(dirs)} assets, {total_imgs} candidates)</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; padding:1.5rem; background:#1A1226; color:#F5EDD8;
         font-family:'Inter',system-ui,sans-serif; }}
  h1 {{ font-family:'Cormorant',Georgia,serif; font-style:italic; font-weight:600;
        color:#E8C4B8; margin:0 0 .3rem; }}
  .sub {{ color:rgba(245,237,216,.65); margin:0 0 1.6rem; font-size:.9rem; }}
  .asset {{ border-top:1px solid rgba(232,196,184,.18); padding:1.1rem 0; }}
  h2 {{ font-size:1.1rem; margin:.2rem 0 .8rem; }}
  .count {{ color:rgba(245,237,216,.5); font-weight:400; font-size:.85rem; }}
  .row {{ display:flex; flex-wrap:wrap; gap:1rem; }}
  .cand {{ margin:0; width:230px; }}
  .imgwrap {{
    /* checker so transparency reads true */
    background-image:
      linear-gradient(45deg,#3a2d52 25%,transparent 25%),
      linear-gradient(-45deg,#3a2d52 25%,transparent 25%),
      linear-gradient(45deg,transparent 75%,#3a2d52 75%),
      linear-gradient(-45deg,transparent 75%,#3a2d52 75%);
    background-size:20px 20px; background-position:0 0,0 10px,10px -10px,-10px 0;
    background-color:#241a36; border-radius:8px; overflow:hidden;
    display:flex; align-items:center; justify-content:center; min-height:160px;
  }}
  .cand img {{ max-width:100%; max-height:300px; display:block; }}
  figcaption {{ font-size:.78rem; padding:.4rem .2rem; line-height:1.35; }}
  .eng {{ color:#B8CDD6; }}
  details {{ margin-top:.6rem; }}
  summary {{ cursor:pointer; color:rgba(245,237,216,.6); font-size:.82rem; }}
  pre {{ white-space:pre-wrap; background:#241a36; padding:.8rem; border-radius:6px;
         font-size:.74rem; color:rgba(245,237,216,.8); overflow-x:auto; }}
</style></head><body>
<h1>Wave 24 — asset curation</h1>
<p class="sub">{len(dirs)} assets · {total_imgs} candidates · checker backdrop = transparency. <b>best-*</b> = best-method (Flux Pro Ultra / Recraft V3 + BiRefNet), <b>fal-*</b> = run-1 Flux Pro v1.1, <b>nb-*</b> = run-1 nano-banana.</p>
{''.join(parts)}
</body></html>"""

    out = CAND / 'index.html'
    out.write_text(doc)
    print(f'[contact-sheet] {len(dirs)} assets, {total_imgs} candidates -> {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

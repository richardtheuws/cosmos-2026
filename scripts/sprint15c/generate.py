"""
Sprint 15C — Weird object-vocabulary (8 objects).

Goal: WEIRDO-energy. Oneirisch, ongemakkelijk-fascinerend. Niet generic
platformer-objects. Mensen moeten denken "wtf zag ik net".

Pipeline:
  - Flux Pro Ultra primary voor 7 BiRefNet'd objects (organic-flesh-trampoline,
    eyeball-sentry, melting-clock-bubble, secret-crystal, floating-star,
    upside-down-tree, breathing-portal)
  - Flux Pro v1.1 (NOT Ultra; we need explicit 1024x512) voor mouth-pillar
    sprite-sheet (4 frames horizontal grid)
  - BiRefNet on all subjects after generation (NOT on the sprite-sheet —
    sheet stays on black BG, Phaser sprite-sheet ignores BG anyway)
  - 1024x1024 generation; downscale to target sizes after BiRefNet:
      organic-flesh-trampoline -> 512×512
      eyeball-sentry            -> 256×256
      melting-clock-bubble      -> 384×384
      secret-crystal            -> 256×256
      floating-star             -> 128×128
      upside-down-tree          -> 512×768  (portrait — generated 2:3)
      breathing-portal          -> 384×384
      mouth-pillar              -> 1024×512 sprite-sheet (4 frames @ 256x512)

Anti-pattern stack from memory (asset_learnings.md):
  - 'NOT kawaii NOT chibi NOT pixar NOT cute' upfront
  - 'NOT photoreal NOT 3D NOT digital' to lock illustration aesthetic
  - 'NO characters NO figures NO silhouettes NO travelers' (lone-wanderer bias)
  - 'luminous bright pastel NOT dark NOT black NOT night' (palette-collapse fix)
  - For Ultra explicit: avoid Ultra for fixed pixel sizes (Ultra ignores
    image_size; honors aspect_ratio only). For mouth-pillar use Flux Pro v1.1
    (NOT Ultra) with explicit image_size.

Output:
  public/assets/objects/<name>.png
  public/assets/case-study/objects-v15c/<name>-{raw,birefnet,final}.png
"""
from __future__ import annotations
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from _lib import (
    ROOT, submit, poll_until_done, extract_image_url, http_download,
    log_attempt, upload_local_image,
)

OUT_DIR = ROOT / 'public/assets/objects'
RAW_DIR = ROOT / 'scripts/sprint15c/raw'
CASE_DIR = ROOT / 'public/assets/case-study/objects-v15c'
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)
CASE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------- shared style stem (proven from Sprint 13D + 11C) -----------

ANTI_KAWAII = (
    'NOT kawaii NOT chibi NOT cute-mascot NOT pixar NOT disney NOT smiling '
    'NOT friendly-cartoon NOT children-book-cute NOT toy-aesthetic'
)
ANTI_PHOTOREAL = (
    'NOT photograph NOT photoreal NOT realistic NOT 3D NOT cgi NOT render '
    'NOT digital-art NOT vector NOT pixel-art'
)
ANTI_DARK = 'luminous bright pastel paper-grain NOT dark NOT black NOT night NOT muddy'
ANTI_CHARACTERS = (
    'NO characters NO figures NO silhouettes NO travelers NO wanderers '
    'NO people NO faces-of-humans NO animals'
)

# Single style-stem prefix for all 8 objects — coherence-lock from
# visual_coherence.md. Hayao×Moebius watercolor + ink + paper-grain.
STYLE_STEM = (
    'Cosmic Adventure 2026 hand-painted watercolor with ink underdrawing, '
    'paper-grain texture, faded-rose mineral wash plus saffron-glow underlight '
    'plus ink-aubergine ragged outline, Studio Ghibli x Moebius x Tenniel '
    'illustration style, oneiric dreamlike unsettling-fascinating mood'
)
PALETTE = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, pop-magenta and pop-cyan accents maximum 5 percent'
)

# Subject-isolation rider (generic, used for square objects on neutral card BG)
ISOLATION_RIDER = (
    'macro close-up isolated single object centered in frame, plain neutral '
    'grey paper card background, NO scene NO landscape NO horizon NO ground '
    'NO other objects, just ONE thing filling 70 percent of square frame, '
    'sharp focus crisp ink rim outlines'
)


# ---------------- per-object briefs (WEIRDO-DNA per object) ------------------

OBJECTS = [
    {
        'key': 'organic-flesh-trampoline',
        'altitude': 0,
        'aspect': 'square',
        'target_size': (512, 512),
        'subject': (
            'a single TOP-DOWN view of a giant breathing mushroom-cap trampoline '
            'with a SICKLY translucent membrane stretched across its surface, '
            'visible faded-rose blood-veins pulsing beneath the skin like a thin '
            'fleshy drumhead, the membrane is taut but slightly distended, '
            'wet-looking with pearlescent saffron-glow sweat, ink-aubergine '
            'gill-pleats radiate outward from a small puckered central hole that '
            'looks alive, the whole thing is uncomfortably ORGANIC and barely '
            'recognizable as a mushroom — disturbingly biological, somewhere '
            'between fungus and lung, faintly throbbing, 70 percent of square '
            'frame top-down birds-eye view, NOT cute mushroom NOT cartoon '
            'mushroom, oneiric body-horror but painterly soft watercolor'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'breathing membrane + visible veins + puckered hole — body-horror '
            'fungus, not mushroom-icon'
        ),
        'behaviour': 'trampoline-bounce',
        'audio_cue': 'wet-thump pulse',
    },
    {
        'key': 'eyeball-sentry',
        'altitude': 100,
        'aspect': 'square',
        'target_size': (256, 256),
        'subject': (
            'a single floating cosmic disembodied eyeball watching the viewer, '
            'spherical wet wet wet eyeball with VIVID chameleon-iris in '
            'concentric rings of saffron-glow + faded-rose + ink-aubergine + '
            'pop-cyan, the pupil is a vertical ink-aubergine slit like a goat '
            'or octopus, the white-of-the-eye is faintly pearlescent mushroom-'
            'cream with tiny faded-rose blood vessels visible, no eyelid no '
            'face no head — just a wet floating sphere in mid-air with a '
            'dangling optic-nerve trailing wisps of saffron mist below, '
            'unsettling sentient, the sphere fills 60 percent of square frame, '
            'float-pose hovering, NOT cute eye NOT emoji-eye, NOT a face just '
            'a free-floating organ that watches'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'disembodied + dangling optic-nerve + vertical slit pupil — '
            'sentient organ with no body'
        ),
        'behaviour': 'follow-cosmo-blink',
        'audio_cue': 'wet-blink + low whisper',
    },
    {
        'key': 'melting-clock-bubble',
        'altitude': 500,
        'aspect': 'square',
        'target_size': (384, 384),
        'subject': (
            'a single Salvador Dali style melting pocket-watch trapped inside a '
            'translucent floating soap-bubble sphere, the watch face is wax-soft '
            'and DRIPPING downward inside the bubble like hot taffy, Roman '
            'numerals warping and sliding off the rim, the hour-hand has '
            'liquefied into a thin saffron-glow rivulet that pools at the bottom '
            'of the bubble interior, the bubble itself shimmers with faded-rose '
            'and pop-cyan iridescence, faint cosmic spark dots float around it, '
            'NO clock-tower NO scene just ONE melting clock inside ONE bubble '
            'centered in 70 percent of square frame, NOT cartoon melting NOT '
            'emoji-clock, time-distortion dreamlike disturbing-beautiful'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'Dali-clock dripping inside iridescent bubble — temporal anomaly '
            'object, time-50%-slow on touch'
        ),
        'behaviour': 'time-slow-on-touch',
        'audio_cue': 'reverse-tick-warble',
    },
    {
        'key': 'secret-crystal',
        'altitude': 1000,
        'aspect': 'square',
        'target_size': (256, 256),
        'subject': (
            'a single floating geometric crystal cluster glowing from within '
            'with HALLUCINATORY pop-magenta and saffron-glow internal radiance, '
            'angular faceted prism-spires jutting outward at impossible non-'
            'euclidean angles, the surface refracts light into faint kaleidoscope '
            'rainbow-fringes around the edges, faded-rose mineral wash wraps '
            'the base, ink-aubergine ragged outline at silhouette, faintly '
            'translucent so we see through to other facets behind, only '
            'visible-when-tripping vibe — feels like it might not exist, '
            'fills 65 percent of square frame, NO ground NO base NO platform '
            'just ONE floating crystal, hyper-saturated only-during-trip-state'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'non-euclidean facets + only-visible-when-trip — reality-glitch '
            'collectible'
        ),
        'behaviour': 'visible-only-when-kaleido-gt-0.8',
        'audio_cue': 'glass-shimmer-chord',
    },
    {
        'key': 'floating-star',
        'altitude': 0,
        'aspect': 'square',
        'target_size': (128, 128),
        'subject': (
            'a single hand-painted cosmic five-pointed star, soft watercolor '
            'fill in pop-cyan aqua-blue with saffron-glow inner-burst at the '
            'core, ink-aubergine ragged outline, soft halo of saffron-glow '
            'sparks around the perimeter, paper-grain texture visible across '
            'the star body, faint internal swirl of mushroom-cream and faded-'
            'rose layers, the star fills 60 percent of square frame floating '
            'centered, NOT a cartoon star NOT an emoji NOT a vector, painterly '
            'translucent illustration star with watercolor bleeds'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'cosmic painterly star with saffron+cyan watercolor — collectible '
            '+5 vibe'
        ),
        'behaviour': 'collect-on-touch',
        'audio_cue': 'chime-up',
    },
    {
        'key': 'upside-down-tree',
        'altitude': 300,
        'aspect': 'portrait',  # 1024×1536 generation, 512×768 final
        'target_size': (512, 768),
        'subject': (
            'a single UPSIDE-DOWN cosmic tree hanging root-up from the top of '
            'the frame, exposed gnarled root-system at the TOP fanning outward '
            'like a wild crown of tendrils with saffron-glow tips, the trunk '
            'descends downward into a bushy crown of moss-sage leaves at the '
            'BOTTOM that hangs like a chandelier, the whole tree is floating '
            'levitating in mid-air with no ground beneath it, faint cosmic '
            'spark dots drift around the roots, faded-rose mineral wash on '
            'the bark, ink-aubergine ragged outline, paper-grain visible, '
            'fills 75 percent of vertical frame, NO ground NO sky NO horizon '
            'just ONE inverted tree on neutral card background, dreamlike '
            'oneiric Lewis-Carroll-meets-Moebius weirdness'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'root-up inverted tree levitating — gravity-defying decorative '
            'obstacle'
        ),
        'behaviour': 'static-obstacle-jump-under-or-around',
        'audio_cue': 'wind-chime-low-creak',
    },
    {
        'key': 'breathing-portal',
        'altitude': 800,
        'aspect': 'square',
        'target_size': (384, 384),
        'subject': (
            'a single circular cosmic portal hovering in mid-air, a perfect ring '
            'with concentric pulsing aura-bands cycling through saffron-glow + '
            'pop-magenta + pop-cyan in radiating layers, the inner disc shows a '
            'glimpse of another biome — faintly visible mushroom-spires + '
            'star-rain inside the portal-mouth like a window into another '
            'world, the rim is woven from ink-aubergine ragged ink-lines and '
            'faded-rose mineral wash, paper-grain texture across the aura, '
            'soft halo bloom expanding outward, fills 70 percent of square '
            'frame centered, NOT a stargate NOT a sci-fi portal NOT a CGI ring, '
            'painterly watercolor portal that breathes like a living lung-mouth'
        ),
        'birefnet': True,
        'weirdo_dna': (
            'breathing aura cycle + window-to-other-biome — biome-switch '
            'mid-run object'
        ),
        'behaviour': 'enter-on-touch-biome-switch',
        'audio_cue': 'breathing-drone + chord-shift',
    },
    # ---------- mouth-pillar sprite-sheet (special) ----------------------------
    {
        'key': 'mouth-pillar',
        'altitude': 200,
        'aspect': 'sheet',  # 1024×512 4-frame horizontal grid
        'target_size': (1024, 512),  # final delivered as-is (sprite-sheet)
        'subject': (
            'a 4-frame horizontal sprite-sheet on a single 2:1 image, the '
            'image is divided into FOUR equal vertical panels arranged side by '
            'side in a 4-cell horizontal grid, each panel shows the SAME '
            'vertical stone pillar with a fleshy lip-and-teeth MOUTH carved '
            'into its center but with the mouth in a different opening state '
            'per panel: '
            'PANEL 1 (leftmost): mouth fully CLOSED with faded-rose lips '
            'pressed tightly together no teeth visible; '
            'PANEL 2 (second from left): mouth QUARTER OPEN with a thin gap '
            'showing top row of jagged ink-aubergine teeth; '
            'PANEL 3 (third): mouth HALF OPEN showing both top and bottom '
            'rows of full ink-aubergine fangs and dim throat; '
            'PANEL 4 (rightmost): mouth WIDE OPEN gaping with a deep '
            'dark-aubergine throat-tunnel visible inside, drool of saffron-'
            'glow saliva strings between top and bottom teeth. '
            'Each pillar is identical in shape and position — only the mouth '
            'state changes. Pillar is vertical-rectangular stone-flesh hybrid, '
            'faded-rose lip-tissue around the mouth, ink-aubergine teeth, the '
            'rest of the pillar is mushroom-cream stone with paper-grain. '
            'Dark neutral charcoal background behind each panel. NO scene, '
            'NO ground, NO landscape — just 4 isolated pillar-portraits in '
            'a row showing a 4-step mouth-opening animation cycle'
        ),
        'birefnet': False,  # sprite-sheet stays on charcoal BG
        'weirdo_dna': (
            'tooth-mouth carved into pillar that opens on-beat — body-horror '
            'rhythm-obstacle'
        ),
        'behaviour': 'open-on-beat-damage-when-open',
        'audio_cue': 'wet-jaw-creak + breath',
    },
]


# ---------------- prompt builder + submit ----------------------------------


def make_prompt(obj: dict) -> str:
    if obj['key'] == 'mouth-pillar':
        # Sprite-sheet: skip ISOLATION_RIDER (we want 4-cell grid, not single object)
        sheet_rider = (
            'a 4-frame horizontal sprite-sheet image with FOUR equally-sized '
            'vertical panels in a row, sharp focus crisp ink linework, NOT '
            'blurry, NO scene NO landscape NO horizon, just the 4-cell '
            'animation sheet'
        )
        return (
            f'{ANTI_DARK}. {ANTI_KAWAII}. {ANTI_PHOTOREAL}. {ANTI_CHARACTERS}. '
            f'{sheet_rider}. {obj["subject"]}. {STYLE_STEM}. {PALETTE}'
        )
    return (
        f'{ANTI_DARK}. {ANTI_KAWAII}. {ANTI_PHOTOREAL}. {ANTI_CHARACTERS}. '
        f'{ISOLATION_RIDER}. {obj["subject"]}. {STYLE_STEM}. {PALETTE}'
    )


def submit_object(obj: dict) -> dict:
    prompt = make_prompt(obj)
    # Choice of model + size:
    if obj['key'] == 'mouth-pillar':
        # Need explicit 1024x512. Ultra ignores image_size — use Flux Pro v1.1.
        body = {
            'prompt': prompt,
            'image_size': {'width': 1024, 'height': 512},
            'num_images': 1,
        }
        endpoint = 'fal-ai/flux-pro/v1.1'
    elif obj['aspect'] == 'portrait':
        # Portrait — Ultra honors aspect_ratio. Use 2:3 then resize down.
        body = {
            'prompt': prompt,
            'aspect_ratio': '2:3',
            'num_images': 1,
        }
        endpoint = 'fal-ai/flux-pro/v1.1-ultra'
    else:
        # Square — Flux Pro Ultra (1:1) — most premium quality.
        body = {
            'prompt': prompt,
            'aspect_ratio': '1:1',
            'num_images': 1,
        }
        endpoint = 'fal-ai/flux-pro/v1.1-ultra'

    try:
        req_id, resp_url = submit(endpoint, body)
        model = endpoint
    except Exception as e:
        # Fallback: Flux Pro v1.1 (non-ultra) for square; Flux Dev for sheet
        print(f'[INFO] {obj["key"]} primary endpoint failed: {e}')
        if obj['key'] == 'mouth-pillar':
            req_id, resp_url = submit('fal-ai/flux/dev', body)
            model = 'fal-ai/flux/dev'
        else:
            fallback_body = {
                'prompt': prompt,
                'image_size': 'square_hd' if obj['aspect'] != 'portrait' else 'portrait_4_3',
                'num_images': 1,
            }
            req_id, resp_url = submit('fal-ai/flux-pro/v1.1', fallback_body)
            model = 'fal-ai/flux-pro/v1.1'

    print(f'[SUBMIT] {obj["key"]} -> {req_id[:12]} ({model})')
    return {
        'object': obj,
        'request_id': req_id,
        'response_url': resp_url,
        'prompt': prompt,
        'model': model,
    }


# ---------------- BiRefNet helper -----------------------------------------


def remove_bg(src: Path, label: str) -> Path | None:
    try:
        image_url = upload_local_image(src)
        req_id, resp_url = submit('fal-ai/birefnet', {'image_url': image_url})
    except Exception as e:
        print(f'[birefnet fail] {label}: {e}')
        return None
    payload = poll_until_done(resp_url, f'birefnet-{label}', max_polls=120)
    if not payload:
        return None
    out_url = None
    if 'image' in payload:
        img = payload['image']
        out_url = img.get('url') if isinstance(img, dict) else img
    elif 'images' in payload and payload['images']:
        first = payload['images'][0]
        out_url = first.get('url') if isinstance(first, dict) else first
    if not out_url:
        return None
    target = RAW_DIR / f'{label}-birefnet.png'
    http_download(out_url, target)
    return target


# ---------------- collect + post-process -----------------------------------


def collect_object(state: dict) -> Path | None:
    obj = state['object']
    key = obj['key']
    payload = poll_until_done(state['response_url'], key, max_polls=240)
    url = extract_image_url(payload)
    if not url:
        log_attempt('generate.jsonl', {**{k: v for k, v in state.items() if k != 'object'},
                                       'key': key, 'failed': True})
        print(f'[FAIL] {key} no url')
        return None

    raw_target = RAW_DIR / f'{key}-raw.png'
    n = http_download(url, raw_target)
    case_raw = CASE_DIR / f'{key}-raw.png'
    case_raw.write_bytes(raw_target.read_bytes())
    print(f'[DOWNLOAD] {key}: {n} bytes -> {raw_target.name}')

    # BiRefNet (skip for sprite-sheet)
    cleaned = None
    if obj['birefnet']:
        cleaned = remove_bg(raw_target, key)
        if cleaned and cleaned.stat().st_size > 30_000:
            case_clean = CASE_DIR / f'{key}-birefnet.png'
            case_clean.write_bytes(cleaned.read_bytes())

    # Decide source for resize
    src_path = cleaned if (cleaned and cleaned.stat().st_size > 30_000) else raw_target
    used_src = 'birefnet' if (cleaned and cleaned.stat().st_size > 30_000) else 'raw'

    # Special filename for mouth-pillar sprite-sheet
    if key == 'mouth-pillar':
        final_name = 'mouth-pillar-sheet.png'
    else:
        final_name = f'{key}.png'
    final_path = OUT_DIR / final_name

    # Resize to target
    img = Image.open(src_path)
    target_w, target_h = obj['target_size']
    if img.size != (target_w, target_h):
        # Use LANCZOS for high-quality downscale
        img_resized = img.resize((target_w, target_h), Image.LANCZOS)
    else:
        img_resized = img

    # Preserve mode (RGBA after birefnet, RGB for sheet)
    img_resized.save(final_path, 'PNG', optimize=True)
    case_final = CASE_DIR / f'{key}-final.png'
    case_final.write_bytes(final_path.read_bytes())

    log_attempt('generate.jsonl', {
        'key': key,
        'request_id': state['request_id'],
        'url': url,
        'raw_bytes': n,
        'model': state['model'],
        'birefnet_used': used_src == 'birefnet',
        'final': str(final_path),
        'final_bytes': final_path.stat().st_size,
        'final_size': list(img_resized.size),
    })
    print(f'[FINAL] {key} ({used_src}): {final_path.stat().st_size} bytes @ {img_resized.size}')
    return final_path


# ---------------- main -----------------------------------------------------


def main():
    print(f'[SPRINT 15C] Submitting {len(OBJECTS)} weirdo objects...')
    submitted = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for state in ex.map(submit_object, OBJECTS):
            submitted.append(state)

    print(f'[SPRINT 15C] Collecting...')
    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for path in ex.map(collect_object, submitted):
            results.append(path)

    success = sum(1 for r in results if r is not None)
    print(f'[SPRINT 15C DONE] {success}/{len(OBJECTS)} objects generated')

    # Save brief summary for memory writeback
    summary = {
        'sprint': '15C',
        'total': len(OBJECTS),
        'success': success,
        'objects': [
            {
                'key': o['key'],
                'altitude': o['altitude'],
                'target_size': o['target_size'],
                'birefnet': o['birefnet'],
                'weirdo_dna': o['weirdo_dna'],
                'behaviour': o['behaviour'],
                'audio_cue': o['audio_cue'],
            }
            for o in OBJECTS
        ],
    }
    (RAW_DIR.parent / '_summary.json').write_text(json.dumps(summary, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

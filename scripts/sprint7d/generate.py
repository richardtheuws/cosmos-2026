"""
Sprint 7D — Enemy + bomb sprite generation pass.

Generates:
  - 9 enemy sprites (Flux Dev + BiRefNet)
  - 2 bomb assets (Flux Dev + BiRefNet)
  - 1 cracked-wall tile (Flux Dev, NO BiRefNet — it's a tile)
  - 2 bomb SFX (ElevenLabs sound-gen)

Pipeline pattern (proven in Sprint 4.5 Fase B/C, Sprint 6A):
  1. Submit all Flux Dev jobs in parallel → collect (label, response_url)
  2. Poll each until COMPLETED → download raw to public/assets/sprites/v4/
  3. For character assets: submit BiRefNet → poll → download cleaned
  4. SFX: ElevenLabs sound-generation API → save mp3
  5. Write manifest entries for assets-generated.json
"""
from __future__ import annotations
import os, sys, time, json, base64, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026')
SPRITES_DIR = ROOT / 'public/assets/sprites/v4'
BOMBS_DIR = ROOT / 'public/assets/bombs'
TILES_DIR = ROOT / 'public/assets/tiles'
SFX_DIR = ROOT / 'public/assets/audio/sfx'
SPRITES_DIR.mkdir(parents=True, exist_ok=True)
BOMBS_DIR.mkdir(parents=True, exist_ok=True)


def load_env() -> dict:
    env = {}
    with open(Path.home() / 'Documents/games/.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip("'").strip('"')
    return env


ENV = load_env()
FAL_KEY = ENV.get('FAL_AI_KEY')
EL_KEY = ENV.get('ELEVENLABS_API_KEY')
assert FAL_KEY, 'FAL_AI_KEY missing'
assert EL_KEY, 'ELEVENLABS_API_KEY missing'


# ============================================================================
# fal.ai helpers
# ============================================================================
def http_post_json(url: str, headers: dict, body: dict, timeout: int = 60) -> dict:
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def http_get_json(url: str, headers: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, headers=headers, method='GET')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def http_download(url: str, target: Path, timeout: int = 120) -> int:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    target.write_bytes(data)
    return len(data)


def submit_flux_dev(prompt: str, size: dict) -> tuple[str, str]:
    """Returns (request_id, response_url)."""
    res = http_post_json(
        'https://queue.fal.run/fal-ai/flux/dev',
        {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'},
        {'prompt': prompt, 'image_size': size, 'num_images': 1},
    )
    return res['request_id'], res['response_url']


def submit_birefnet(image_url: str) -> tuple[str, str]:
    res = http_post_json(
        'https://queue.fal.run/fal-ai/birefnet',
        {'Authorization': f'Key {FAL_KEY}', 'Content-Type': 'application/json'},
        {'image_url': image_url},
    )
    return res['request_id'], res['response_url']


def poll_until_done(response_url: str, label: str, max_polls: int = 90) -> dict | None:
    headers = {'Authorization': f'Key {FAL_KEY}'}
    # Use status_url for polling (works for all queue endpoints), response_url for fetch.
    status_url = response_url + '/status' if not response_url.endswith('/status') else response_url
    for i in range(max_polls):
        try:
            status_res = http_get_json(status_url, headers)
            status = status_res.get('status', '')
            if status == 'COMPLETED':
                # Fetch full result from response_url
                try:
                    return http_get_json(response_url, headers)
                except urllib.error.HTTPError as e:
                    print(f'[FAIL] {label} response fetch: {e.code}')
                    return None
            if status in ('FAILED', 'ERROR'):
                print(f'[FAIL] {label}: {status_res}')
                return None
        except urllib.error.HTTPError as e:
            if e.code in (404, 425, 400):  # still queued / not ready
                time.sleep(2)
                continue
            raise
        time.sleep(2)
    print(f'[TIMEOUT] {label}')
    return None


def extract_image_url(payload: dict) -> str | None:
    if not payload:
        return None
    if 'images' in payload and payload['images']:
        first = payload['images'][0]
        if isinstance(first, dict):
            return first.get('url')
        return first
    if 'image' in payload:
        img = payload['image']
        if isinstance(img, dict):
            return img.get('url')
        return img
    return None


# ============================================================================
# Style stem — locked from Sprint 4.5 Fase B (canonical)
# ============================================================================
STEM = (
    'Moebius Arzach woodcut illustration crossed with Tenniel Alice in Wonderland '
    'and Hayao Miyazaki, HEAVY INK LINEWORK with visible ink-aubergine '
    'underdrawing and ragged outlines, BUT filled with SATURATED LUSH WATERCOLOR '
    '— cosmic dreamy luminous palette with glowing magenta-pink fluo-lime '
    'electric sky-wash and saffron-glow accents, paper-grain texture, slightly '
    'uncanny psychedelic illustration, cosmic-adventure mood, NOT dusk NOT dark '
    'NOT moody, full daylight luminous, NOT kawaii NOT chibi NOT pixar NOT cute '
    'NOT children-book NOT roblox NOT digital NOT 3D NOT photoreal, INK LINEWORK '
    'COMPULSORY'
)

SPRITE_RIDER = (
    'side-view facing right on neutral grey paper card background, character '
    'fills 70% of frame, full ink-line woodcut definition, wet-edge watercolor '
    'bleeds inside silhouette, NOT centered overlay, NOT blurry NOT soft focus, '
    'sharp focus high detail crisp ink lines, isolated single creature only, '
    'NO scenery NO landscape NO sky NO horizon NO ground'
)

PALETTE_TAIL = (
    'palette mushroom-cream moss-sage sky-wash-blue faded-rose ink-aubergine '
    'saffron-glow forest-deep, pop-magenta and pop-lime and pop-cyan accents '
    'maximum 5 percent of frame'
)

PICKUP_RIDER = (
    'close-up centered view of ONE single floating game-pickup object only, '
    'NO landscape NO scenery NO background scene, isolated object on flat '
    'neutral grey card background, faint micro-halo, fluo-pop magenta and lime '
    'ring around object only (max 5 percent of pixels), painted illustration '
    'not icon, sharp focus crisp ink lines NOT blurry'
)

TILE_RIDER = (
    'close-up macro view of ONE 2D platformer game wall tile, square seamless '
    'block filling entire frame edge to edge, NO landscape NO scenery NO sky '
    'NO mountains NO horizon, NOT a painting NOT a scene, just a single '
    'wall-block texture asset for sidescroller game, organic painted edges, '
    'sharp focus crisp ink lines NOT blurry, isolated game asset on flat '
    'neutral grey card background'
)


def sprite_prompt(subject: str) -> str:
    return f'{STEM}. {SPRITE_RIDER}. {subject}. {PALETTE_TAIL}'


def pickup_prompt(subject: str) -> str:
    return f'{STEM}. {PICKUP_RIDER}. {subject}. {PALETTE_TAIL}'


def tile_prompt(subject: str) -> str:
    return f'{STEM}. {TILE_RIDER}. {subject}. {PALETTE_TAIL}'


# ============================================================================
# Asset definitions
# ============================================================================
ENEMY_SUBJECTS = {
    'enemy-parachute': (
        'a small floating parachute-jelly creature, sky-wash-blue translucent '
        'parachute cap on top, body is a small mushroom-cream blob hanging '
        'underneath connected by faded-rose thin string-tendrils, single big '
        'narrow ink-line eye on body, NOT human NOT child, hovering posture, '
        'whimsical Ghibli alien-spore'
    ),
    'enemy-pinkworm': (
        'a segmented pink burrowing worm-creature emerging from soil, faded-rose '
        'and ink-aubergine ringed segments, three or four chubby segments visible '
        'curving up, small narrow ink-line eyes on front segment, ragged ink '
        'underline, NO legs, organic worm-anatomy, dirt-mound base'
    ),
    'enemy-ghost': (
        'a translucent ethereal cosmic-spirit ghost, sky-wash-blue translucent '
        'wispy body with fading lower edge dissolving into mist, big chameleon '
        'lizard eye in center of body matching reference Cosmo style, '
        'ink-aubergine ragged outline, faint saffron-glow inner halo, '
        'NOT cute NOT cartoon ghost NOT sheet, watercolor bleed at body edges'
    ),
    'enemy-spittingwall': (
        'a wall-mounted face-creature monster carved into stone, ink-aubergine '
        'craggy wall texture forming a snarling face, single large saffron-glow '
        'orange eye in center glowing, mouth open hostile, organic petrified '
        'anatomy, woodcut linework, NO body just face protrusion from wall'
    ),
    'enemy-dragonfly': (
        'a cosmic dragonfly insect-creature flying, mushroom-cream segmented '
        'body, two pairs of translucent pop-cyan iridescent wings spread wide, '
        'long thin tail-abdomen trailing behind, narrow ink-line compound eyes, '
        'organic insect anatomy, in mid-flight pose'
    ),
    'enemy-flyingwisp': (
        'a small floating wisp creature, moss-sage green orb-core body with '
        'saffron-glow halo around it, faint sky-wash translucent edge fade, '
        'single narrow ink-line eye, NOT human NOT child, ethereal floating '
        'posture, NO arms NO legs, just a floating glowing orb-spirit'
    ),
    'enemy-suctioncrawler': (
        'a small wall-crawling creature with FOUR LONG limbs ending in FLAT '
        'BLACK CIRCULAR DISC SUCTION-CUP PADS like toilet plunger tips matching '
        'reference Cosmo hand-style, body is moss-sage green elongated, narrow '
        'ink-line eyes, ink-aubergine ragged outline, BIG ROUND DISC pads NOT '
        'fingers NOT claws, organic alien anatomy, side-profile crawling pose'
    ),
    'enemy-tuliplauncher': (
        'a friendly tulip-cup launcher plant-creature, faded-rose pink petals '
        'curling outward forming a cup at top, mushroom-cream interior of cup '
        'visible, saffron-glow center bulb radiating warm light, green stem '
        'base, organic ink-linework petals, NOT hostile-looking, NOT human NOT '
        'face, just a glowing flower-cup plant'
    ),
    'enemy-spark': (
        'a small electrical spark-ball creature, pop-magenta hot core, '
        'pop-lime electric outer halo crackling around it, ink-aubergine arc '
        'lines radiating, vibrating energy ball, NOT a character NOT eyes, '
        'just a phosphorescent jolt-ball with crackling lightning aura, '
        'small floating hazard'
    ),
}

BOMB_SUBJECTS = {
    'bomb': (
        'a round cartoon bomb-ball, ink-aubergine dark purple sphere body with '
        'subtle faded-rose underglow tint, short fuse-string on top with a tiny '
        'saffron-glow orange spark at the tip, woodcut ink linework, NOT '
        'realistic NOT military, classic round game-bomb shape, isolated single '
        'object'
    ),
    'bomb-pickup': (
        'a collectible round cartoon bomb-ball game pickup, ink-aubergine sphere '
        'body, brighter saffron-glow halo aura around the whole bomb, '
        'pop-magenta spark dots radiating outward, fuse on top with bright spark, '
        'floating pickup item, slightly more glow than the regular bomb to '
        'signal pickup-ness'
    ),
}

TILE_SUBJECTS = {
    'tile-wall-cracked-painted': (
        'a square breakable stone wall block with THREE LARGE BRANCHING CRACKS '
        'splitting through it, ink-aubergine deep dark crack lines forking '
        'across the surface, mushroom-cream and faded-rose painted stone-tile '
        'base matching reference tile-wall-painted style, saffron-glow tip-spark '
        'at one crack-end where bomb impacted, ragged ink-line crack edges, '
        'damaged wall block, NOT scenery just a single texture tile'
    ),
}

# ============================================================================
# Pipeline runner
# ============================================================================
def submit_all() -> list[dict]:
    """Submit all generation jobs in parallel. Returns list of job dicts."""
    jobs = []

    def submit_job(label: str, prompt_str: str, size: dict, kind: str, target: Path) -> dict:
        try:
            req_id, resp_url = submit_flux_dev(prompt_str, size)
            return {
                'label': label,
                'kind': kind,
                'prompt': prompt_str,
                'size': size,
                'request_id': req_id,
                'response_url': resp_url,
                'target': str(target),
                'status': 'submitted',
            }
        except Exception as e:
            return {'label': label, 'kind': kind, 'status': 'submit-failed', 'error': str(e), 'target': str(target)}

    # 9 enemies — square_hd (1024x1024)
    for name, subject in ENEMY_SUBJECTS.items():
        target = SPRITES_DIR / f'{name}.png'
        jobs.append(submit_job(name, sprite_prompt(subject), {'width': 1024, 'height': 1024}, 'sprite', target))

    # 2 bombs — square_hd (will be downscaled in engine via setDisplaySize)
    for name, subject in BOMB_SUBJECTS.items():
        target = BOMBS_DIR / f'{name}.png'
        jobs.append(submit_job(name, pickup_prompt(subject), {'width': 1024, 'height': 1024}, 'pickup', target))

    # 1 tile — square_hd, will NOT go through BiRefNet
    for name, subject in TILE_SUBJECTS.items():
        target = TILES_DIR / f'{name}.png'
        jobs.append(submit_job(name, tile_prompt(subject), {'width': 1024, 'height': 1024}, 'tile', target))

    return jobs


def collect_raw(jobs: list[dict]) -> list[dict]:
    """Poll all jobs in parallel, download raw images."""
    def collect_one(job: dict) -> dict:
        if job.get('status') != 'submitted':
            return job
        label = job['label']
        print(f'[POLL] {label}...')
        result = poll_until_done(job['response_url'], label)
        if not result:
            job['status'] = 'poll-failed'
            return job
        url = extract_image_url(result)
        if not url:
            job['status'] = 'no-image-url'
            job['poll_result'] = result
            return job
        try:
            target = Path(job['target'])
            size = http_download(url, target)
            job['raw_url'] = url
            job['raw_path'] = str(target)
            job['raw_size'] = size
            job['status'] = 'raw-downloaded'
            print(f'[OK] {label} raw {size//1024}KB → {target.name}')
        except Exception as e:
            job['status'] = 'download-failed'
            job['error'] = str(e)
        return job

    out = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = [ex.submit(collect_one, j) for j in jobs]
        for f in as_completed(futures):
            out.append(f.result())
    return out


def cleanup_pass(jobs: list[dict]) -> list[dict]:
    """For sprite + pickup kinds, run BiRefNet to remove background."""
    def cleanup_one(job: dict) -> dict:
        if job.get('status') != 'raw-downloaded':
            return job
        if job['kind'] == 'tile':
            # Tiles must NOT go through BiRefNet (would strip the texture)
            job['cleaned_path'] = job['raw_path']
            job['status'] = 'cleaned'
            return job
        label = job['label']
        try:
            req_id, resp_url = submit_birefnet(job['raw_url'])
            print(f'[BIREF-POLL] {label}...')
            res = poll_until_done(resp_url, f'{label}-birefnet')
            if not res:
                job['status'] = 'birefnet-poll-failed'
                return job
            cleaned_url = extract_image_url(res)
            if not cleaned_url:
                job['status'] = 'birefnet-no-url'
                return job
            cleaned_target = Path(job['target']).with_name(Path(job['target']).stem + '-cleaned.png')
            size = http_download(cleaned_url, cleaned_target)
            if size < 5000:
                # BiRefNet stripped too aggressively — fall back to raw
                print(f'[WARN] {label} BiRefNet output {size}B too small, falling back to raw')
                cleaned_target.unlink(missing_ok=True)
                job['cleaned_path'] = job['raw_path']
                job['status'] = 'cleaned-fallback-raw'
            else:
                job['cleaned_url'] = cleaned_url
                job['cleaned_path'] = str(cleaned_target)
                job['cleaned_size'] = size
                job['status'] = 'cleaned'
                print(f'[OK] {label} cleaned {size//1024}KB')
        except Exception as e:
            job['status'] = 'birefnet-failed'
            job['error'] = str(e)
        return job

    out = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(cleanup_one, j) for j in jobs]
        for f in as_completed(futures):
            out.append(f.result())
    return out


# ============================================================================
# ElevenLabs SFX
# ============================================================================
def el_sound(prompt: str, duration_s: float, target: Path) -> dict:
    body = json.dumps({
        'text': prompt,
        'duration_seconds': duration_s,
        'prompt_influence': 0.6,
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://api.elevenlabs.io/v1/sound-generation',
        data=body,
        headers={
            'xi-api-key': EL_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        target.write_bytes(data)
        return {'status': 'ok', 'size': len(data), 'path': str(target)}
    except urllib.error.HTTPError as e:
        return {'status': 'failed', 'http': e.code, 'body': e.read().decode('utf-8', 'ignore')[:300]}
    except Exception as e:
        return {'status': 'failed', 'error': str(e)}


def generate_sfx() -> list[dict]:
    out = []
    out.append({
        'label': 'bomb-throw',
        'prompt': 'short whoosh sound followed by a soft plastic thud, 0.4 seconds, '
                  'cartoon game sound effect, dry no music',
        'duration': 0.5,
        **el_sound(
            'short whoosh sound followed by a soft plastic thud, 0.4 seconds, '
            'cartoon game sound effect, dry no music',
            0.5,
            SFX_DIR / 'bomb-throw.mp3',
        ),
    })
    out.append({
        'label': 'bomb-boom',
        'prompt': 'cartoon bomb explosion with deep sub-bass impact and glass-shatter '
                  'tail with reverse reverb tail, 0.8 seconds, game sound effect',
        'duration': 0.9,
        **el_sound(
            'cartoon bomb explosion with deep sub-bass impact and glass-shatter '
            'tail with reverse reverb tail, 0.8 seconds, game sound effect',
            0.9,
            SFX_DIR / 'bomb-boom.mp3',
        ),
    })
    return out


# ============================================================================
# Main
# ============================================================================
def main():
    print('=== Sprint 7D — generation pipeline ===')

    # Phase 1: submit all Flux Dev
    print('\n[1/4] Submitting Flux Dev jobs...')
    jobs = submit_all()
    submitted = sum(1 for j in jobs if j.get('status') == 'submitted')
    print(f'Submitted {submitted}/{len(jobs)} jobs')

    # Phase 2: poll + download raws
    print('\n[2/4] Polling Flux Dev jobs...')
    jobs = collect_raw(jobs)
    raw_ok = sum(1 for j in jobs if j.get('status') == 'raw-downloaded')
    print(f'Raw downloaded {raw_ok}/{len(jobs)}')

    # Phase 3: BiRefNet pass
    print('\n[3/4] BiRefNet cleanup...')
    jobs = cleanup_pass(jobs)
    cleaned_ok = sum(1 for j in jobs if j.get('status') in ('cleaned', 'cleaned-fallback-raw'))
    print(f'Cleaned {cleaned_ok}/{len(jobs)}')

    # Phase 4: SFX
    print('\n[4/4] ElevenLabs SFX...')
    sfx_results = generate_sfx()
    for r in sfx_results:
        print(f"[SFX] {r['label']}: {r.get('status')} {r.get('size','')}B")

    # Save manifest
    manifest = {
        'sprint': 'Sprint 7D — Enemy + bomb sprites',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'flux_jobs': jobs,
        'sfx': sfx_results,
    }
    out_path = ROOT / 'scripts/sprint7d/_manifest.json'
    out_path.write_text(json.dumps(manifest, indent=2))
    print(f'\nManifest written: {out_path}')


if __name__ == '__main__':
    main()

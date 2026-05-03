# Universe Authoring

Read [`NORTH-STAR.md`](./NORTH-STAR.md) first. This document is the technical contract; NORTH-STAR is the *why*.

A **Universe** is a self-contained module that Cosmo can travel into. It lives at `universes/<your-name>/` in this monorepo and satisfies the four-part contract below. If your module satisfies the contract, the substrate will load it, render it, walk Cosmo into it, and let him carry his state back out.

## The four required artifacts

Every Universe MUST provide these four. They are loaded by the substrate at `?universe=<your-name>` URL, in order, on entry.

### 1 · Background renderer

**File**: `universes/<name>/background.ts` exporting a default function.

```ts
import * as THREE from 'three';

export interface BackgroundCtx {
  scene: THREE.Scene;            // the substrate's shared Three.js scene
  camera: THREE.PerspectiveCamera;
  globalUniforms: GlobalUniforms; // shared time + audioFFT + post-FX uniforms
  assetPath: (rel: string) => string; // resolves URLs relative to your universe folder
}

export interface BackgroundHandle {
  update(dt: number): void;       // called every frame after the substrate's tick
  dispose(): void;                // release all THREE objects the universe owns
}

export default function buildBackground(ctx: BackgroundCtx): BackgroundHandle {
  // ... build PlaneGeometry parallax layers, particle systems, lights, etc.
  // Return an update + dispose pair the substrate can drive.
}
```

You can ship a Three.js scene module (full programmatic control) **or** a static `composition-spec.json` if your Universe is a layered parallax rendering. The substrate will detect which form you've shipped.

### 2 · Room-list + traversal graph

**File**: `universes/<name>/rooms.json` — a static manifest the substrate reads at load.

```json
{
  "version": "1.0",
  "entryRoom": "clearing",
  "rooms": [
    {
      "id": "clearing",
      "displayName": "The Clearing",
      "anchor": { "x": 0, "y": 0, "z": 0 },
      "exits": [
        { "to": "deep-grove", "via": "left-path", "distance": 12 },
        { "to": "the-hollow", "via": "down-burrow", "distance": 8 }
      ]
    },
    {
      "id": "deep-grove",
      "displayName": "Deep Grove",
      "anchor": { "x": -12, "y": 0, "z": 0 },
      "exits": [
        { "to": "clearing", "via": "right-path", "distance": 12 }
      ]
    }
  ]
}
```

Rooms are nodes; exits are edges. The substrate handles transitions; your Universe just declares the graph.

### 3 · Asset manifest

**File**: `universes/<name>/manifest.json`.

```json
{
  "version": "1.0",
  "name": "your-universe-name",
  "displayName": "Your Universe (in any language)",
  "displayNameEn": "Your Universe (English summary, ~100 chars)",
  "author": "Your Name",
  "license": "MIT",
  "summaryEn": "A two-sentence English summary so other contributors can find their bearings.",
  "assets": [
    { "type": "image",  "path": "assets/sky.png",         "preload": true },
    { "type": "image",  "path": "assets/mushroom-near.png", "preload": true },
    { "type": "audio",  "path": "assets/ambient.mp3",     "preload": false },
    { "type": "shader", "path": "shaders/fluid.frag",     "preload": true }
  ],
  "brandDeviation": null
}
```

`preload: true` means the substrate fetches it before Cosmo arrives. `preload: false` is lazy-loaded on first use.

`brandDeviation` is `null` for Universes that follow the brand contract; otherwise it's a short string explaining the intentional deviation (reviewers will engage with the argument).

### 4 · Cosmo-arrival hook

**File**: `universes/<name>/arrival.ts` exporting a default function.

```ts
export interface ArrivalCtx {
  cosmo: CosmoV2Rig;              // the rig the substrate hands you, fully owned
  state: CosmoState;               // mood, memory, traversal-history (serializable)
  scene: THREE.Scene;
  globalUniforms: GlobalUniforms;
}

export type ArrivalAnimation =
  | { kind: 'portal',  duration: number, hue?: number }
  | { kind: 'fade',    duration: number, color?: string }
  | { kind: 'drift',   from: { x: number; z: number }, duration: number }
  | { kind: 'custom',  run: (dt: number) => boolean }; // returns true when complete

export default function onCosmoArrival(ctx: ArrivalCtx): ArrivalAnimation {
  // Compose how Cosmo enters your Universe. The substrate plays it,
  // then hands control to the companion-AI.
  return { kind: 'portal', duration: 1.4, hue: 0.62 };
}
```

The substrate gives you full access to the rig during arrival so you can do anything from "fade-in" to "Cosmo falls through a hole and lands on a flower". After your animation completes, the substrate resumes the standard companion-AI / motion / life-system loop.

## Optional artifacts

These are not required, but the substrate will use them if present.

| File | Effect |
|---|---|
| `inhabitants.ts` | Small lives that share Cosmo's space. Same shape as `weirdoObstacleFactory.ts` in the runtime. |
| `interactables.ts` | Things Cosmo can walk to + use. Trampolines, fruits, doors. |
| `audio.ts` | Music bed + SFX overrides for this Universe. |
| `transitions.ts` | Custom Room-to-Room path animations (the "psychedelic path" between Rooms in your Area). |
| `README.md` | Author's notes. Multilingual welcome. |

## Cosmo's portable state

Cosmo carries this with him into your Universe (read-only or mutate-then-return):

```ts
export interface CosmoState {
  mood: 'calm' | 'curious' | 'spiked' | 'glitch' | 'cosmic';
  energy: number;             // 0..1, decays with time, refills on rest
  memory: string[];           // append-only log of "things that mattered" — your universe may add to this
  traversalHistory: string[]; // ordered list of universe-ids he's visited this session
  inventory: InventoryItem[]; // optional Universe-specific items he can carry between worlds
}
```

The substrate persists this in `localStorage` between sessions (and in a future revision: a portable signed token, so Cosmo's state can move between domains).

## How the substrate loads your Universe

```
GET /play/?universe=<your-name>
  → substrate fetches /universes/<your-name>/manifest.json
  → substrate preloads all assets where preload: true
  → substrate loads /universes/<your-name>/background.ts → calls buildBackground(ctx)
  → substrate loads /universes/<your-name>/rooms.json → registers traversal graph
  → substrate loads /universes/<your-name>/arrival.ts → calls onCosmoArrival(ctx)
  → substrate plays the arrival animation, then hands control to companion-AI
```

If any required artifact is missing or invalid, the substrate logs a clear error and falls back to the entry Universe (`forest`).

## Reference Universe

[`universes/forest/`](./universes/forest/) is the canonical reference implementation. Read its four files to see the contract in practice. Your Universe doesn't have to look anything like the forest — it just has to satisfy the same four contracts.

## Brand fit

Universes are expected to fit the brand contract (Hayao×Moebius watercolor, the locked palette, no emojis, no placeholders) by default. If you intentionally deviate, set `manifest.json::brandDeviation` to a short rationale and document it in your Universe README. Reviewers will read it carefully.

The substrate will not block your PR for brand deviation. Reviewers will engage with the argument and either land it, request a softening, or invite you to fork the substrate entirely if your vision is far enough that it deserves its own anchor.

## How to test your Universe locally

```bash
cd cosmos-cosmic-adventure-2026
npm install
npm run dev
# Open http://localhost:5174/play/?universe=<your-name>
```

The substrate live-reloads `universes/<your-name>/` on file change.

## How to submit

1. Branch off `main`, build under `universes/<your-name>/`.
2. Run `bash scripts/sync-check.sh` and `npm run build` clean.
3. Open a PR titled `universe: <your-name>`.
4. The PR description should answer: what is your Universe, why does it want to exist, what experience does Cosmo have inside it.
5. Reviewers engage on the four-part contract, brand-fit, and posture.

Welcome.

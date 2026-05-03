# The Mushroom Forest — Cosmo's entry Universe

> *The first place Cosmo learned to wander.*

This is the canonical reference Universe for the Cosmo's-Universe substrate. It satisfies the four-part [`UNIVERSE-AUTHORING.md`](../../UNIVERSE-AUTHORING.md) contract minimally and clearly, so external authors can read it side-by-side with their own work.

## Status

**Wave 20a (current)**: skeleton. The four required artifacts exist (`manifest.json`, `rooms.json`, `background.ts` and `arrival.ts` *coming in 20b*). The substrate currently runs an inline `ParallaxScene` for the forest; Wave 20b extracts that into `background.ts` so the forest becomes pluggable — and so other Universes have a runnable example to fork.

**Wave 20b (next)**: full extraction. After 20b lands, `background.ts` and `arrival.ts` here are the working reference. Today, treat this directory as the authoring contract sketch.

## Files

| File | Required? | What it does |
|---|---|---|
| `manifest.json` | yes | Universe metadata + asset list (preload + lazy) |
| `rooms.json` | yes | Three Rooms — The Clearing, Deep Grove, The Hollow — with exits |
| `background.ts` | yes (Wave 20b) | Three.js scene builder for the forest's parallax + post-FX |
| `arrival.ts` | yes (Wave 20b) | How Cosmo enters the forest (portal, fade, drift) |
| `inhabitants.ts` | optional | Eyeball-sentries, mouth-pillars, breathing-portals, floating-stars |
| `interactables.ts` | optional | The trampoline (Wave 20b primary delight loop) |
| `audio.ts` | optional | Slow-bloom-loop ambient bed |
| `transitions.ts` | optional | Custom Room→Room paths (mushroom-path, burrow-down) |

## Why this Universe is what it is

- Soft pastel cosmic horizon, **mushroom-cream** sky, **moss-sage** ground. The locked palette plays well in-Room.
- **Slow-bloom mushrooms** are the signature feature: tall, dripping nectar from the canopy, creating natural vertical interest and shade-pockets.
- **One trampoline** — the primary delight-loop. Cosmo walks to it and loves it.
- **Three Rooms** because that's the smallest graph that demonstrates Room-traversal without being trivial. The Clearing is the entry; Deep Grove is the slow wander; The Hollow is the small surprise.

## How to copy this for your own Universe

```bash
cp -r universes/forest universes/your-name
# edit manifest.json: set name, displayName, author, summaryEn
# edit rooms.json: design your spatial graph
# write your own background.ts and arrival.ts
```

Open a PR titled `universe: your-name`. Reviewers engage on contract-correctness, brand-fit, and posture-alignment per [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

# Cosmo Life System — Wave 19 design

Cosmo is **alive on his own**. The screen breathes whether the user touches it or not. Every interaction is a *conversation* with a creature that has its own agenda — never a button-press.

---

## A. Autonomous Activities

Activities loop continuously, picked by the Activity Director (section C). Weights reference CosmoAI's 6 states — `idle / roam / curious / sit / look-around / sniff / sleep`.

### Calm Cluster (0–30s idle, weight in `idle / sit / sleep`)

| # | Name | Duration | Visual | Audio | Mood | Weights | Asset needs |
|---|---|---|---|---|---|---|---|
| 1 | **moss-petting** | 5–8s | Cosmo crouches, paw-strokes the ground; ground-tile briefly tints jade and ripples outward (existing watercolor wobble) | `coo-soft` (existing pool) | calm | idle:3 sit:3 roam:0 | reuse |
| 2 | **antenna-tasting** | 4–6s | head-tilt up, antenna flicks at air; one watercolor petal spawns above and dissolves | `petal-dust` | calm | look-around:3 idle:2 | reuse petal particle |
| 3 | **cosmic-yawn-bloom** | 3–5s | existing yawn; a slow violet bloom expands and fades (TrippyEventDirector kaleido at 25% intensity) | existing yawn SFX | calm | sleep:3 sit:2 | reuse |
| 4 | **belly-breathing** | 6–9s | torso scale-pulse 1.00↔1.04 sync with low sub-bass hum; vignette breathes with him | low drone (new tag `breath-drone`) | calm | idle:3 sit:2 sleep:3 | new SFX only |
| 5 | **gravity-doze** | 7–10s | Cosmo lifts 6px off ground, drifts in a slow figure-8, eyes half-lidded | wind-hush | calm | sleep:3 idle:1 | reuse |

### Curious Cluster (30–90s idle, mixes in)

| # | Name | Duration | Visual | Audio | Mood | Weights | Asset needs |
|---|---|---|---|---|---|---|---|
| 6 | **third-eye-blink** | 2–3s | a third eye opens between brows, scans left-right, vanishes | `pop-blip` | curious | curious:3 look-around:3 | **new sprite**: `cosmo-third-eye.png` 64×64 transparent |
| 7 | **weirdo-whisper** | 5–8s | Cosmo walks to nearest weirdoObstacle, leans in, whispers; that object reacts (eyeball-sentry blinks, mouth-pillar smiles) | murmur | curious | curious:3 roam:2 | reuse weirdo reactions, **new SFX** `whisper-loop` |
| 8 | **petal-juggle** | 4–7s | spawns 3 petals via existing CosmoAgent petal-spew, juggles them in arc | `chuckle-coo` | silly | curious:2 sit:2 | reuse |
| 9 | **shadow-puppet** | 5–8s | his own shadow detaches, mimics him 1s late, then snaps back | none (silence sells it) | curious | curious:3 look-around:2 | **new shader**: shadow-decoupling (1 uniform offset) |
| 10 | **hum-sync** | 6–10s | Cosmo hums a 3-note motif; one weirdo-object pulses in time | `cosmo-hum-3note` | calm/curious | curious:2 idle:2 | **new SFX** + reuse pulse |

### Glitch / Cosmic Cluster (90s+ idle, takes over)

| # | Name | Duration | Visual | Audio | Mood | Weights | Asset needs |
|---|---|---|---|---|---|---|---|
| 11 | **fractal-multiply** | 4–6s | 3 transparent Cosmo-ghosts fan out, each does a different idle pose, snap back | `kaleido-shimmer` | cosmic | sleep:3 curious:2 | reuse sprite + alpha |
| 12 | **inside-out** | 3–5s | sprite UV-inverts (TrippyEventDirector gravity-wobble + hue-rotate 180°) for 2s, returns | `glitch-sigh` | glitch | sleep:3 | reuse FX, **new SFX** |
| 13 | **sky-licking** | 5–8s | tongue extends impossibly long, taps a star/planet in BG; that BG-element pulses + drops one petal | `lick-tap` | silly/cosmic | sleep:2 curious:2 | **new sprite** `cosmo-tongue-strip.png` (5 frames) |
| 14 | **disc-portal** | 4–6s | his disc-bobble opens like an iris, brief portal-glimpse (different watercolor sky), closes | `portal-shimmer` | cosmic | sleep:3 | **new BG asset** `portal-glimpse-skies/` 4 variants 512×512 |
| 15 | **deep-trip** *(rare, ≥3min idle, fires once per session)* | 14–20s | Cosmo dissolves into watercolor smear; whole world re-paints in a single foreign palette (e.g. citrus-on-black); slowly resolves | full ambient bed `deep-trip-bed` | cosmic | only after 180s idle, weight 1, anti-repeat session-lock | **new BG palette swap** (1 LUT texture) + **new SFX bed** |

---

## B. Interaction Map

| Input | Reaction |
|---|---|
| **single tap on Cosmo** | He turns to camera, blinks twice, gives a tiny chest-puff bow. 30% chance: petal-spew. |
| **single tap on background** | A watercolor ripple at tap-point; nearest weirdo-object glances toward it. |
| **single tap on weirdo-object** | That object plays its bespoke reaction (eyeball winks, mouth-pillar blows a kiss). Cosmo sees it and laughs (`chuckle-coo`). |
| **swipe up** | Cosmo hops, antenna-trail leaves a watercolor arc; gravity briefly inverts for 1.2s. |
| **swipe down** | Cosmo melts 40% into ground for 2s, pops back with a `pop-blip`. |
| **swipe left/right** | Camera pans; Cosmo dashes in that direction and skids, leaving petal-streak. |
| **shake** | World shudders, Cosmo's eyes spiral, 4 petals burst out. After shake stops → `silence-after-noise` queues (see below). |
| **long-press (>800ms)** | Cosmo sits, looks at finger, slowly smiles. Pressure builds: a hum-drone rises. Release → soft bloom + petal-puff. |
| **two-finger pinch** | Cosmo compresses like an accordion, squeak SFX; on release → fractal-multiply triggers immediately. |
| **two-finger spread** | Cosmo stretches tall, eyes widen; sky brightens 10%. |
| **two-finger twist** | Cosmo spins on-axis, hue-rotates with rotation angle (1:1 mapped). |
| **tilt (gyro absolute)** | Existing motionController pan; *added*: at >25° tilt Cosmo leans the same way and his disc tips. |
| **blow into mic** | Petals scatter from Cosmo's face, antenna bends like grass. Open question → see D. |
| **silence-after-noise** | If user just shook/blew/rapid-tapped and stopped: Cosmo freezes 1.5s, listens, then sighs (`coo-soft`) — punctuates the silence. |
| **5 rapid taps (<2s)** | Cosmo gets dizzy: third-eye-blink + inside-out chained. Anti-spam: lockout 6s. |
| **encircling swipe** | Cosmo gets hypnotized: eyes follow finger, after full circle he plays disc-portal. |

---

## C. Activity Director — pseudocode

```
state = { lastActivities:[], moodCluster:'calm', idleSec:0, sessionDeepTripFired:false }

every frame:
  idleSec += dt; if userInputThisFrame: idleSec = 0; queueInteractionResponse()

pickNextActivity(currentAIState):
  cluster = decideCluster(idleSec, moodCluster)         // calm <30, +curious 30-90, +glitch 90+
  pool = activities.filter(a => a.cluster in cluster)
                   .filter(a => !lastActivities.slice(-3).includes(a.id))   // anti-repeat
  weighted = pool.map(a => a.weights[currentAIState] ?? 0)
  if idleSec >= 180 && !sessionDeepTripFired: inject deep-trip with weight 1
  next = weightedRandom(pool, weighted)
  lastActivities.push(next.id); play(next)
  if next.mood == 'glitch' || 'cosmic': moodCluster='spiked'   // bumps cluster up

onInteraction(input):
  cancelCurrentActivity()
  play(interactionMap[input])
  queue followUpActivity from same mood-bucket as input        // continuity
  if input is 'shake' | 'rapid-taps' | 'blow': moodCluster='spiked'

decay (every 5s):
  if moodCluster=='spiked' && idleSec > 20: moodCluster='curious'
  if moodCluster=='curious' && idleSec > 45: moodCluster='calm'
```

Anti-repeat = last 3. Mood-spike decays back to calm in ~65s of no input. Deep-trip is session-locked once-per-load.

---

## D. Open questions

1. **Mic input** — `getUserMedia({audio})` requires permission prompt and HTTPS. Worth the friction for 1 input? Suggest: ship without mic in 19a, add behind a settings toggle in 19b.
2. **Sleep state** — keep CosmoAI's `sleep` or repurpose as the gate for the glitch-cluster? Recommend: keep sleep but make it the *gateway* to deep-trip rather than a terminal idle.
3. **Shake on desktop** — DeviceMotionEvent is mobile-only. Desktop fallback: detect rapid-mouse-shake (>5 dir-changes in 0.5s) and route to same handler.
4. **Activity interrupt grace** — when interaction fires mid-activity, do we *snap-cut* or cross-fade (200ms)? Recommend cross-fade except for `shake`/`rapid-taps` which feel better as snap.
5. **Weirdo-whisper coupling** — needs each weirdo to expose a `.react(intensity)` method. Confirm we extend `weirdoObstacleFactory` rather than wrap.
6. **Deep-trip palette swap** — single LUT or 3 rotating? Single is cheaper, 3 makes replays feel different. Recommend 3.

---

## E. Recommended phasing

**Wave 19a (this sprint) — ships:**
- Activities: #1 moss-petting, #2 antenna-tasting, #4 belly-breathing, #6 third-eye-blink, #11 fractal-multiply
- Inputs: single-tap-on-Cosmo, swipe-up, long-press, shake (+ desktop fallback)
- Activity Director (full state-machine), anti-repeat, mood-cluster decay
- Asset gen: `cosmo-third-eye.png`, `breath-drone` SFX, `whisper-loop` SFX

**Wave 19b (next sprint) — ships:**
- Remaining 10 activities including deep-trip
- All other inputs (twist, pinch, encircling, mic behind toggle, silence-after-noise, rapid-taps, weirdo-tap)
- Asset gen: tongue-strip (5fr), portal-glimpse-skies (4×512), shadow-decoupling shader, deep-trip LUT (×3), `cosmo-hum-3note`, `glitch-sigh`, `lick-tap`, `portal-shimmer`, `kaleido-shimmer`, `pop-blip` (verify exists)
- Weirdo `.react(intensity)` extension

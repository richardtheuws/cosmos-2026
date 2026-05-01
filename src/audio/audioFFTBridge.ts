/**
 * AudioFFTBridge — Sprint 6D
 *
 * Web Audio AnalyserNode sitting on a dedicated music sub-bus, aggregating its
 * 128-bin frequency response into 8 logarithmic bands and writing them per
 * frame into `globalUniforms.audioFFT`. Three.js post-FX shaders read those 8
 * floats to drive bloom (lows), kaleidoscope (mids) and fluid wobble (highs) —
 * the world breathes with the music without us hand-animating uniforms.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Architecture
 * ───────────────────────────────────────────────────────────────────────────
 *
 *   musicSource ──► musicGain ──► analyser ──► Howler.masterGain ──► destination
 *                                     │
 *                                     └─► getByteFrequencyData() per frame
 *                                         → 8 logarithmic band aggregation
 *                                         → smoothed write into globalUniforms.audioFFT
 *
 * AudioContext sharing — we piggy-back on Howler's own AudioContext via
 * `Howler.ctx`. That keeps SFX + music + analyser on a single context (browser
 * limit is ~6 contexts; one is plenty). `Howler.masterGain` is used as the
 * output node so the existing `sfxBus.setMuted()` master volume still dictates
 * the final mix.
 *
 * Autoplay policy — Chromium/Safari refuse to start an AudioContext until a
 * user-gesture happens. `ensureRunning()` is wired to the first click/keydown
 * (handled in `main.ts`); calling it before the gesture is a no-op.
 *
 * Three Pass Rule — this bridge does NOT add any post-FX pass. It only writes
 * to a Float32Array. Shader passes are unchanged; convolution count is unchanged.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Band aggregation (fftSize = 256 → frequencyBinCount = 128 bins)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * At 48 kHz sample-rate, each bin spans ~187 Hz (24000 / 128). We split the
 * 128 bins into 8 logarithmic bands so low-frequency resolution is denser —
 * matches human hearing + matches our music palette (kick / bass / koto pluck
 * sit in lows, wooden-flute body in mids, tape-hiss + air in highs).
 *
 *   Band 0 :  bins  0..1     (~0–375 Hz)    sub / kick
 *   Band 1 :  bins  2..3     (~375–750 Hz)  bass / low body
 *   Band 2 :  bins  4..7     (~750–1.5 kHz) low-mid / koto pluck
 *   Band 3 :  bins  8..15    (~1.5–3 kHz)   mid / flute body
 *   Band 4 :  bins  16..31   (~3–6 kHz)     high-mid / pluck transients
 *   Band 5 :  bins  32..63   (~6–12 kHz)    air / shimmer
 *   Band 6 :  bins  64..95   (~12–18 kHz)   tape-hiss top
 *   Band 7 :  bins  96..127  (~18–24 kHz)   sparkle / cymbal sheen
 *
 * Edges hard-coded (see BAND_EDGES); each value in audioFFT is the band's
 * average normalised to 0..1 (byte data 0..255 → /255), then lerped against
 * the previous frame at α=0.4 to dampen flicker.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Music source — placeholder vs Suno
 * ───────────────────────────────────────────────────────────────────────────
 *
 * `MUSIC_TRACK = ''` → the bridge spins up `createPlaceholderSynth()` (oscillator
 * + LFO + slow filter sweep) so the FFT has *something* to chew on while Suno
 * tracks are still being commissioned.
 *
 * Once Suno tracks land in `public/assets/audio/music/`, set
 *   MUSIC_TRACK = '/assets/audio/music/title-theme.mp3'
 * and the bridge will swap to a streamed AudioBufferSourceNode automatically —
 * one-line change, no other call-sites updated.
 */

import type { GlobalUniforms } from '../core/globalUniforms';

// Howler exposes its AudioContext + master gain on the global Howler object
// (typed in @types/howler). Howler creates the context lazily on first Howl
// construction or first `volume()`/`mute()` call.
import { Howler } from 'howler';

/**
 * Swap to a real Suno track filename when ready (Sprint 7).
 * Empty string → placeholder synth-loop. Typed `string` (not literal) so TS
 * keeps both branches of the source factory live.
 */
const MUSIC_TRACK: string = '';

/** Smoothing factor for the per-band lerp. Higher = snappier, lower = sleepier. */
const BAND_LERP_ALPHA = 0.4;

/** Bin index *exclusive* upper-bound for each of the 8 logarithmic bands. */
const BAND_EDGES: readonly number[] = [2, 4, 8, 16, 32, 64, 96, 128];

interface MusicSource {
  /** Output node that should be wired into the analyser. */
  output: AudioNode;
  /** Stop and free the source. */
  dispose(): void;
}

export class AudioFFTBridge {
  private readonly uniforms: GlobalUniforms;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private musicGain: GainNode | null = null;
  private source: MusicSource | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private muted = false;
  private initialised = false;
  private musicVolume = 0.55;

  constructor(uniforms: GlobalUniforms) {
    this.uniforms = uniforms;
  }

  /**
   * Boot the analyser graph. Safe to call before user-gesture — it just
   * creates the nodes; the AudioContext only needs to be in `running` state
   * before `update()` produces non-zero output, which `ensureRunning()`
   * handles.
   */
  init(): void {
    if (this.initialised) return;
    // Force Howler to lazily create its AudioContext + masterGain. Calling
    // .volume() with the current value is a side-effect-free way to trigger
    // setupAudioContext() without altering global state.
    Howler.volume(Howler.volume());
    if (!Howler.ctx || !Howler.masterGain || !Howler.usingWebAudio) {
      // eslint-disable-next-line no-console
      console.warn('[audioFFTBridge] Web Audio unavailable; FFT disabled.');
      return;
    }
    this.ctx = Howler.ctx;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;

    // music → musicGain → analyser → Howler.masterGain → destination
    this.musicGain.connect(this.analyser);
    this.analyser.connect(Howler.masterGain);

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.source = MUSIC_TRACK
      ? createStreamedTrack(this.ctx, MUSIC_TRACK)
      : createPlaceholderSynth(this.ctx);
    this.source.output.connect(this.musicGain);

    this.initialised = true;
  }

  /**
   * Resume the AudioContext on user-gesture. Browsers block autoplay until
   * the page receives a real input event.
   */
  ensureRunning(): void {
    if (!this.initialised) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /** Per-frame: pull byte FFT, aggregate to 8 bands, lerp into uniforms. */
  update(): void {
    if (!this.analyser || !this.freqData) return;
    if (this.ctx?.state !== 'running') return; // pre-gesture: bands stay 0

    this.analyser.getByteFrequencyData(this.freqData);

    const out = this.uniforms.audioFFT;
    let lo = 0;
    for (let band = 0; band < 8; band++) {
      const hi = BAND_EDGES[band];
      let sum = 0;
      for (let i = lo; i < hi; i++) sum += this.freqData[i];
      const avg = sum / (hi - lo) / 255;
      // Decay/lerp damping — mix(prev, new, α) — keeps flicker out of bloom.
      out[band] = out[band] * (1 - BAND_LERP_ALPHA) + avg * BAND_LERP_ALPHA;
      lo = hi;
    }
  }

  /** Toggle the music sub-bus mute. SFX bus is unaffected. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.musicGain) {
      this.musicGain.gain.value = muted ? 0 : this.musicVolume;
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Read-only debug snapshot of the current 8-band FFT. */
  snapshot(): readonly number[] {
    return Array.from(this.uniforms.audioFFT);
  }

  /** Tear down. Call on hot-reload / scene swap. */
  dispose(): void {
    this.source?.dispose();
    this.source = null;
    this.musicGain?.disconnect();
    this.analyser?.disconnect();
    this.musicGain = null;
    this.analyser = null;
    this.initialised = false;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Music sources                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * TODO(sprint-7): Replace the placeholder with the rendered Suno track.
 * This synth-loop exists ONLY so the FFT bridge has signal during dev.
 *
 * Build: triangle osc @ 110 Hz (root D-ish) + saw sub @ 55 Hz, both routed
 * through a slowly sweeping low-pass filter, modulated by an LFO that pulses
 * the gain at ~1 Hz. Result: organic-ish low-mid breathing that exercises all
 * 8 FFT bands without sounding like a 1-kHz test sine.
 */
function createPlaceholderSynth(ctx: AudioContext): MusicSource {
  const out = ctx.createGain();
  out.gain.value = 0.18;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 4;
  filter.frequency.value = 800;

  // Sweep filter cutoff slowly so high bands periodically light up.
  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.value = 0.07;
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 1400;
  filterLfo.connect(filterLfoGain).connect(filter.frequency);
  filterLfo.start();

  // Two oscillators — root + sub-octave saw for lows.
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = 110;
  const o2 = ctx.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = 55;

  // Slow tremolo on the gain so band-0/1 pulse like a kick.
  const tremolo = ctx.createOscillator();
  tremolo.type = 'sine';
  tremolo.frequency.value = 1.1;
  const tremGain = ctx.createGain();
  tremGain.gain.value = 0.12;
  tremolo.connect(tremGain).connect(out.gain);
  tremolo.start();

  o1.connect(filter);
  o2.connect(filter);
  filter.connect(out);
  o1.start();
  o2.start();

  return {
    output: out,
    dispose(): void {
      o1.stop();
      o2.stop();
      tremolo.stop();
      filterLfo.stop();
      out.disconnect();
    },
  };
}

/**
 * Streamed Suno-track source. Used when `MUSIC_TRACK` is set.
 * Keeps the bridge agnostic of file format — browser-native audio decoding
 * via `<audio>` element + MediaElementSource (works for mp3/ogg/wav, supports
 * looping via the audio element).
 */
function createStreamedTrack(ctx: AudioContext, src: string): MusicSource {
  const audioEl = document.createElement('audio');
  audioEl.src = src;
  audioEl.loop = true;
  audioEl.crossOrigin = 'anonymous';
  audioEl.preload = 'auto';
  // Best-effort autoplay — will succeed once ctx.resume() runs from user-gesture.
  void audioEl.play().catch(() => {
    /* gesture pending; will retry naturally on next ensureRunning()  */
  });

  const node = ctx.createMediaElementSource(audioEl);
  return {
    output: node,
    dispose(): void {
      audioEl.pause();
      audioEl.src = '';
      node.disconnect();
    },
  };
}

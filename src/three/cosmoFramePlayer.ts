/**
 * cosmoFramePlayer.ts — Wave 23 (2026-05-31) — painted-frames Cosmo.
 *
 * Plays per-state frame-atlas clips on the billboard plane's material. Replaces
 * the dead AnimationMixer: CosmoAgent.playClip(name, loop) now drives THIS.
 *
 * Each clip is one RGBA atlas PNG (a grid of alpha-cut watercolor frames, from
 * the LoRA hero via fal i2v → BiRefNet → ffmpeg tile; see scripts/wave23). The
 * player swaps the material's `map` to the clip's atlas and animates the
 * texture offset/repeat to step through cells.
 *
 *  - loop clips PING-PONG (the i2v clips aren't designed seamless loops, so
 *    bouncing forward↔back avoids a hard pop at the wrap).
 *  - one-shot clips clamp at the last frame, then auto-return to `idle`.
 *
 * Manifest shape (public/assets/cosmo-frames/manifest.json):
 *   { clips: { idle: {file, cols, rows, count, cell, fps, loop}, ... } }
 */
import * as THREE from 'three';
import { assetPath } from '../core/assetPath';

interface ManifestClip {
  file: string; cols: number; rows: number; count: number;
  cell: number; fps: number; loop: boolean;
}
interface Clip extends ManifestClip { tex: THREE.Texture }

const BASE = 'assets/cosmo-frames';

export class CosmoFramePlayer {
  private clips = new Map<string, Clip>();
  private current: Clip | null = null;
  private currentName = '';
  private idx = 0;
  private dir = 1;
  private acc = 0;
  private ready = false;

  /** @param material the billboard plane's material whose `map` we drive. */
  constructor(private readonly material: THREE.MeshBasicMaterial) {}

  get isReady(): boolean { return this.ready; }
  has(name: string): boolean { return this.clips.has(name); }

  /** Load the manifest + all atlas textures. Safe to call once; resolves when
   *  every clip texture is ready. On failure the player stays not-ready and
   *  CosmoAgent gracefully keeps the static hero. */
  async load(): Promise<boolean> {
    let manifest: { clips: Record<string, ManifestClip> };
    try {
      const res = await fetch(assetPath(`${BASE}/manifest.json`));
      if (!res.ok) return false;
      manifest = await res.json();
    } catch {
      return false;
    }
    const loader = new THREE.TextureLoader();
    const entries = Object.entries(manifest.clips ?? {});
    await Promise.all(entries.map(async ([name, m]) => {
      const tex = await loader.loadAsync(assetPath(`${BASE}/${m.file}`));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false; // sub-cell sampling + mipmaps = cross-cell bleed
      tex.repeat.set(1 / m.cols, 1 / m.rows);
      this.clips.set(name, { ...m, tex });
    }));
    this.ready = this.clips.size > 0;
    return this.ready;
  }

  /** Select a clip. `loopOverride` forces loop/one-shot regardless of manifest. */
  play(name: string, loopOverride?: boolean): boolean {
    const clip = this.clips.get(name);
    if (!clip) return false;
    if (loopOverride !== undefined) clip.loop = loopOverride;
    if (name === this.currentName) return true; // already on this clip
    this.current = clip;
    this.currentName = name;
    this.idx = 0;
    this.dir = 1;
    this.acc = 0;
    this.material.map = clip.tex;
    this.material.needsUpdate = true;
    this.applyUV();
    return true;
  }

  /** Advance the current clip. Call once per frame. */
  tick(dt: number): void {
    if (!this.current || dt <= 0) return;
    const frameDur = 1 / this.current.fps;
    this.acc += dt;
    let changed = false;
    while (this.acc >= frameDur) {
      this.acc -= frameDur;
      if (this.current.loop) {
        this.idx += this.dir;
        if (this.idx >= this.current.count - 1) { this.idx = this.current.count - 1; this.dir = -1; }
        else if (this.idx <= 0) { this.idx = 0; this.dir = 1; }
      } else if (this.idx < this.current.count - 1) {
        this.idx++;
      } else {
        // one-shot finished → settle back into idle (if available)
        if (this.currentName !== 'idle' && this.has('idle')) this.play('idle', true);
        return;
      }
      changed = true;
    }
    if (changed) this.applyUV();
  }

  private applyUV(): void {
    const c = this.current;
    if (!c) return;
    const col = this.idx % c.cols;
    const row = Math.floor(this.idx / c.cols);
    // Texture flipY (default) → row 0 sits at the top (v near 1).
    c.tex.offset.set(col / c.cols, 1 - (row + 1) / c.rows);
  }
}

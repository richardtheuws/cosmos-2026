/**
 * captureClip.ts — Sprint 13C
 *
 * 60-second screen+audio recorder using the MediaRecorder API. Targeted at
 * TikTok/Instagram Reels with vertical export. The record path is:
 *
 *   #scene-canvas (Three) ─┐
 *                          ├─► OffscreenCanvas (1080×1920) ──► captureStream ─┐
 *   #game-canvas  (Phaser) ─┘    repaint @ 60fps via rAF inside this file     │
 *                                                                              ├─► MediaRecorder ──► Blob (.webm or .mp4)
 *   AudioFFTBridge analyser ──► tap-destination MediaStreamAudioDestination ──┘
 *
 * Browser compatibility:
 *   • Chrome/Firefox/Edge desktop: video/webm;codecs=vp9,opus  → works fine.
 *   • iPhone Safari (16+):         video/mp4;codecs=avc1,mp4a  → works (iOS 14.3+).
 *   • Older Safari (<16):          MediaRecorder undefined.    → return error.
 *
 * Sprint 13C agreed not-a-blocker: webm-only on Android Chrome is fine.
 *
 * Caller integration:
 *   const stream = audioBridge.captureStream();    // see audioFFTBridge#exportStream below
 *   const clip = new ClipRecorder({ audioStream: stream, durationS: 60 });
 *   clip.start();
 *   clip.onComplete = ({ url, blob, mime }) => triggerDownload(url, `cosmos-${Date.now()}.webm`);
 *
 * Note: clip-recorder owns its own rAF; it does NOT touch the live game-loop.
 */

const EXPORT_W = 1080;
const EXPORT_H = 1920;
const FRAMERATE = 30; // 30fps clip = ~5MB for 60s on vp9; halves CPU vs 60.

export interface ClipRecorderOptions {
  /** Audio stream produced by the AudioFFTBridge (analyser tap). */
  audioStream?: MediaStream | null;
  /** Recording length in seconds. Default 60 (PRD §7.1). */
  durationS?: number;
  /** Mime override; auto-pick if undefined. */
  mimeType?: string;
}

export interface ClipResult {
  blob: Blob;
  url: string;
  mime: string;
  durationMs: number;
}

const PREFERRED_MIMES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/mp4;codecs=avc1,mp4a',
  'video/webm',
  'video/mp4',
];

export class ClipRecorder {
  private opts: Required<Omit<ClipRecorderOptions, 'audioStream' | 'mimeType'>> & {
    audioStream: MediaStream | null;
    mimeType: string | null;
  };
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rafId = 0;
  private startedAt = 0;
  private timeoutId = 0;
  private running = false;

  /** Fires once with the finished blob. Set by caller. */
  onComplete: ((result: ClipResult) => void) | null = null;
  /** Optional progress hook 0..1. */
  onProgress: ((p: number) => void) | null = null;
  /** Fires on hard error (e.g. unsupported browser). */
  onError: ((err: Error) => void) | null = null;

  constructor(opts: ClipRecorderOptions = {}) {
    this.opts = {
      audioStream: opts.audioStream ?? null,
      durationS: opts.durationS ?? 60,
      mimeType: opts.mimeType ?? null,
    };
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = EXPORT_W;
    this.offscreen.height = EXPORT_H;
    const ctx = this.offscreen.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('captureClip: 2D context unavailable');
    this.offCtx = ctx;
    this.offCtx.imageSmoothingEnabled = true;
    this.offCtx.imageSmoothingQuality = 'high';
  }

  start(): void {
    if (this.running) return;
    if (typeof MediaRecorder === 'undefined') {
      this.onError?.(new Error('MediaRecorder unavailable in this browser'));
      return;
    }

    const mime = this.opts.mimeType ?? pickSupportedMime();
    if (!mime) {
      this.onError?.(new Error('No supported MediaRecorder mime'));
      return;
    }

    // Build the combined stream: video from offscreen canvas + audio tap.
    const videoStream = this.offscreen.captureStream(FRAMERATE);
    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
    if (this.opts.audioStream) {
      for (const t of this.opts.audioStream.getAudioTracks()) tracks.push(t);
    }
    const combined = new MediaStream(tracks);

    try {
      this.recorder = new MediaRecorder(combined, { mimeType: mime });
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    this.recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
    };
    this.recorder.onerror = (ev) => {
      const err = (ev as unknown as { error?: Error }).error ?? new Error('MediaRecorder error');
      this.onError?.(err);
      this.stop();
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      this.onComplete?.({
        blob,
        url,
        mime,
        durationMs: performance.now() - this.startedAt,
      });
    };

    this.startedAt = performance.now();
    this.running = true;
    this.chunks = [];
    this.recorder.start(1000); // emit chunks every 1s for memory pressure relief
    this.tickRender();
    this.timeoutId = window.setTimeout(() => this.stop(), this.opts.durationS * 1000);
  }

  /** Manual early-stop. The blob is finalised via onComplete. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.timeoutId);
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        /* race with auto-stop */
      }
    }
  }

  /** True if currently recording. */
  isRunning(): boolean {
    return this.running;
  }

  /* ── private: per-frame copy live canvases into offscreen ──────────────── */

  private tickRender = (): void => {
    if (!this.running) return;
    const elapsed = performance.now() - this.startedAt;
    this.onProgress?.(Math.min(1, elapsed / (this.opts.durationS * 1000)));

    const sceneCanvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
    const gameMount = document.getElementById('game-canvas') as HTMLDivElement | null;
    const phaserCanvas = gameMount?.querySelector('canvas') as HTMLCanvasElement | null;
    const ctx = this.offCtx;
    ctx.fillStyle = '#1a1330';
    ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    if (sceneCanvas && sceneCanvas.width > 0) {
      drawCover(ctx, sceneCanvas, 0, 0, EXPORT_W, EXPORT_H);
    }
    if (phaserCanvas && phaserCanvas.width > 0) {
      drawCover(ctx, phaserCanvas, 0, 0, EXPORT_W, EXPORT_H);
    }
    this.rafId = requestAnimationFrame(this.tickRender);
  };
}

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of PREFERRED_MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* some browsers throw on bad mime, try next */
    }
  }
  return null;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const sw = src.width;
  const sh = src.height;
  if (sw === 0 || sh === 0) return;
  const dstAspect = dw / dh;
  const srcAspect = sw / sh;
  let cropW = sw;
  let cropH = sh;
  let cropX = 0;
  let cropY = 0;
  if (srcAspect > dstAspect) {
    cropW = sh * dstAspect;
    cropX = (sw - cropW) / 2;
  } else {
    cropH = sw / dstAspect;
    cropY = (sh - cropH) / 2;
  }
  ctx.drawImage(src, cropX, cropY, cropW, cropH, dx, dy, dw, dh);
}

/**
 * Convenience helper — kicks off a download of a Blob/URL via a temporary
 * `<a download>`. Works on Safari iOS 14.3+; older Safari opens the blob in a
 * new tab (still saveable from the share-sheet).
 */
export function triggerDownload(blobUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 1000);
}

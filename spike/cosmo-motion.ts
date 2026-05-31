/**
 * Cosmo motion spike (2026-05-31) — side-by-side comparison of two candidate
 * locomotion representations, judged on feel. SCRATCH — not wired into the game.
 * See NORTH-STAR §6 (2026-05-31 entry).
 *
 *  Panel A — painted frames: plays a frame atlas extracted from a fal.ai
 *            image-to-video clip of the LoRA hero (loaded from frames.json).
 *  Panel B — 2.5D cut-out puppet: the single hero PNG sliced into UV-cropped
 *            parts (upper body + 2 legs), animated with procedural joints.
 */
import * as THREE from 'three';

const HERO_URL = '/assets/sprites/cosmo-hero-lora.png';
const FRAMES_MANIFEST = './assets/frames/frames.json';

// ── shared walk state ──────────────────────────────────────────────────────
const state = { walking: true, speed: 7, phase: 0 };
(document.getElementById('toggle') as HTMLButtonElement).onclick = () => {
  state.walking = !state.walking;
};
(document.getElementById('speed') as HTMLInputElement).oninput = (e) => {
  state.speed = parseFloat((e.target as HTMLInputElement).value);
};

const clock = new THREE.Clock();
const loader = new THREE.TextureLoader();

// ════════════════════════════════════════════════════════════════════════════
// Panel B — 2.5D cut-out puppet
// ════════════════════════════════════════════════════════════════════════════

/** Crop rects in IMAGE space (origin top-left, normalized 0..1). Slightly
 *  overlapping so the seams between parts don't show a transparent gap. */
const CROPS = {
  upper: { x0: 0.27, y0: 0.05, x1: 0.69, y1: 0.74 }, // head + antenna + torso + arms
  legL: { x0: 0.36, y0: 0.66, x1: 0.505, y1: 0.97 },
  legR: { x0: 0.495, y0: 0.66, x1: 0.64, y1: 0.97 },
};
const PUPPET_SCALE = 3.6; // image-space → world units (Cosmo ~3 units tall)

function makePart(
  tex: THREE.Texture,
  crop: { x0: number; y0: number; x1: number; y1: number },
): { mesh: THREE.Mesh; w: number; h: number } {
  const w = (crop.x1 - crop.x0) * PUPPET_SCALE;
  const h = (crop.y1 - crop.y0) * PUPPET_SCALE;
  const geo = new THREE.PlaneGeometry(w, h);
  // Texture flipY (default) → image-top maps to v=1, so convert y→v as 1−y.
  const u0 = crop.x0, u1 = crop.x1;
  const v0 = 1 - crop.y1, v1 = 1 - crop.y0;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  uv.setXY(0, u0, v1); // top-left
  uv.setXY(1, u1, v1); // top-right
  uv.setXY(2, u0, v0); // bottom-left
  uv.setXY(3, u1, v0); // bottom-right
  uv.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: 0.05, depthWrite: false,
    side: THREE.DoubleSide,
  });
  return { mesh: new THREE.Mesh(geo, mat), w, h };
}

/** World position of a crop's center (image-space center → world). */
function cropCenterWorld(crop: { x0: number; y0: number; x1: number; y1: number }) {
  const cx = (crop.x0 + crop.x1) / 2;
  const cy = (crop.y0 + crop.y1) / 2;
  return { x: (cx - 0.5) * PUPPET_SCALE, y: (0.5 - cy) * PUPPET_SCALE };
}

function buildPuppet(canvas: HTMLCanvasElement, tex: THREE.Texture) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const frustum = 4.2;
  const cam = new THREE.OrthographicCamera(
    -frustum * aspect / 2, frustum * aspect / 2, frustum / 2, -frustum / 2, 0.1, 100,
  );
  cam.position.z = 10;

  // Whole-body group (lets us bob/rock the entire puppet).
  const body = new THREE.Group();
  scene.add(body);

  const upper = makePart(tex, CROPS.upper);
  const upperC = cropCenterWorld(CROPS.upper);
  upper.mesh.position.set(upperC.x, upperC.y, 0.01);
  body.add(upper.mesh);

  // Legs pivot at their TOP edge (the hip). Wrap each in a group positioned at
  // the hip; hang the mesh below the pivot so rotation swings the foot.
  function makeLeg(crop: typeof CROPS.legL) {
    const part = makePart(tex, crop);
    const c = cropCenterWorld(crop);
    const hipY = (0.5 - crop.y0) * PUPPET_SCALE;
    const hip = new THREE.Group();
    hip.position.set(c.x, hipY, 0); // legs slightly behind upper
    part.mesh.position.set(0, -part.h / 2, 0);
    hip.add(part.mesh);
    body.add(hip);
    return hip;
  }
  const hipL = makeLeg(CROPS.legL);
  const hipR = makeLeg(CROPS.legR);

  const bodyRestY = 0;
  function tick() {
    if (state.walking) {
      const swing = Math.sin(state.phase) * 0.42;          // leg swing (rad)
      hipL.rotation.z = swing;
      hipR.rotation.z = -swing;
      body.position.y = bodyRestY + Math.abs(Math.sin(state.phase)) * 0.12; // step-bob
      body.rotation.z = Math.sin(state.phase) * 0.035;      // gentle rock
    } else {
      // ease back to rest
      hipL.rotation.z *= 0.85; hipR.rotation.z *= 0.85;
      body.position.y *= 0.85; body.rotation.z *= 0.85;
    }
    renderer.render(scene, cam);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    cam.left = -frustum * a / 2; cam.right = frustum * a / 2;
    cam.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);
  return tick;
}

// ════════════════════════════════════════════════════════════════════════════
// Panel A — painted frames (atlas from image-to-video)
// ════════════════════════════════════════════════════════════════════════════

async function buildFrames(canvas: HTMLCanvasElement): Promise<((dt: number) => void) | null> {
  let manifest: { frames: string[]; fps: number };
  try {
    const res = await fetch(FRAMES_MANIFEST);
    if (!res.ok) return null;
    manifest = await res.json();
  } catch {
    return null;
  }
  if (!manifest.frames?.length) return null;

  const textures = await Promise.all(
    manifest.frames.map((f) => loader.loadAsync(`./assets/frames/${f}`)),
  );
  (document.getElementById('frames-pending') as HTMLElement).style.display = 'none';

  // Frames carry a solid-black background (the i2v model flattened the hero's
  // alpha). For the spike we render on an opaque near-black stage so the frame
  // bg is seamless. Production would alpha-cut each frame (BiRefNet per frame).
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const frustum = 4.2;
  const cam = new THREE.OrthographicCamera(
    -frustum * aspect / 2, frustum * aspect / 2, frustum / 2, -frustum / 2, 0.1, 100,
  );
  cam.position.z = 10;

  const mat = new THREE.MeshBasicMaterial({ map: textures[0], side: THREE.DoubleSide });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), mat);
  scene.add(quad);

  // Ping-pong playback — the clip is generated motion, not a designed seamless
  // loop, so bouncing forward↔back avoids a hard pop at the wrap.
  const frameDur = 1 / (manifest.fps || 12);
  let acc = 0, idx = 0, dir = 1;
  function tick(dt: number) {
    if (state.walking) {
      acc += dt;
      while (acc >= frameDur) {
        acc -= frameDur;
        idx += dir;
        if (idx >= textures.length - 1) { idx = textures.length - 1; dir = -1; }
        else if (idx <= 0) { idx = 0; dir = 1; }
        mat.map = textures[idx];
      }
    }
    renderer.render(scene, cam);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const a = w / h;
    cam.left = -frustum * a / 2; cam.right = frustum * a / 2;
    cam.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);
  return tick;
}

// ════════════════════════════════════════════════════════════════════════════
// boot
// ════════════════════════════════════════════════════════════════════════════

(async function main() {
  const hero = await loader.loadAsync(HERO_URL);
  hero.colorSpace = THREE.SRGBColorSpace;
  hero.minFilter = THREE.LinearFilter;
  hero.magFilter = THREE.LinearFilter;
  hero.generateMipmaps = false;

  const tickPuppet = buildPuppet(document.getElementById('puppet-canvas') as HTMLCanvasElement, hero);
  const tickFrames = await buildFrames(document.getElementById('frames-canvas') as HTMLCanvasElement);

  function loop() {
    const dt = clock.getDelta();
    if (state.walking) state.phase += state.speed * dt;
    tickPuppet();
    if (tickFrames) tickFrames(dt);
    requestAnimationFrame(loop);
  }
  loop();
})();

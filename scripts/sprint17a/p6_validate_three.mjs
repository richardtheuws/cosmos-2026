// Sprint 17A p6 — validate rigged GLB via headless GLTFLoader (Three.js).
// Mirrors CosmoAgent.ts loader-config (no DRACOLoader). Verifies:
//  - mesh loads
//  - skeleton has 9+ named bones with bone_ prefix
//  - 4 animation clips: idle, wave, stretch, sit
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

globalThis.self = globalThis.self ?? globalThis;
globalThis.window = globalThis.window ?? globalThis;
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.lengthComputable = init.lengthComputable || false;
      this.loaded = init.loaded || 0;
      this.total = init.total || 0;
    }
  };
}

const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');
const RIGGED = resolve(ROOT, 'public/assets/case-study/cosmo-rig-v17a/glb/cosmo_rigged.glb');

if (!existsSync(RIGGED)) {
  console.error(`[FAIL] missing ${RIGGED} — run p4_run_blender.sh first`);
  process.exit(1);
}

const data = readFileSync(RIGGED);
const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loader = new GLTFLoader();
loader.parse(ab, '', (gltf) => {
  const scene = gltf.scene;
  const animations = gltf.animations;
  const bones = [];
  scene.traverse((o) => {
    if (o.isBone) bones.push(o.name);
  });
  const bonePrefixed = bones.filter((b) => b.startsWith('bone_'));
  const animNames = animations.map((a) => a.name);
  const expectedAnims = ['idle', 'wave', 'stretch', 'sit'];
  const missingAnims = expectedAnims.filter((n) => !animNames.includes(n));

  // Compute bbox + height
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);

  const result = {
    file: RIGGED,
    sceneObjects: scene.children.length,
    boneCount: bones.length,
    bonePrefixed,
    animations: animNames,
    animationCount: animations.length,
    height: Number(size.y.toFixed(3)),
    width:  Number(size.x.toFixed(3)),
    depth:  Number(size.z.toFixed(3)),
  };

  let ok = true;
  const fails = [];
  if (bonePrefixed.length < 9) {
    ok = false; fails.push(`bone_-prefixed count ${bonePrefixed.length}/9`);
  }
  if (missingAnims.length > 0) {
    ok = false; fails.push(`missing animations: ${missingAnims.join(', ')}`);
  }
  if (size.y < 0.5 || size.y > 5) {
    ok = false; fails.push(`scene height ${size.y.toFixed(3)} out of [0.5, 5.0]`);
  }

  result.ok = ok;
  result.failures = fails;
  console.log(JSON.stringify(result, null, 2));
  process.exit(ok ? 0 : 1);
}, (err) => {
  console.error('[FAIL] GLTFLoader error:', err);
  process.exit(2);
});

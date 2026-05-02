// Sprint 16B p5 — headless GLTFLoader validation.
// Verifies both GLBs (raw + draco) load cleanly in three.js with same loader the engine uses.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Browser-global polyfills for headless three.js (GLTFLoader needs self/ProgressEvent/atob).
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
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class { parseFromString() { return {}; } };
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const ROOT = '/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026';
const ATTEMPTS = `${ROOT}/public/assets/case-study/cosmo-3d-v16b/attempts`;

const targets = [
  'cosmo-A_realistic.glb',
  'cosmo-A_realistic-draco.glb',
  'cosmo-B_sculpture.glb',
  'cosmo-B_sculpture-draco.glb',
];

const draco = new DRACOLoader();
// Use bundled three draco decoder via local path (or jsdelivr fallback)
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
draco.preload();

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

function summarizeMeshes(gltf) {
  let verts = 0;
  let tris = 0;
  let meshes = 0;
  let bbox = new THREE.Box3();
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      meshes += 1;
      const geom = o.geometry;
      if (geom.attributes.position) verts += geom.attributes.position.count;
      if (geom.index) tris += geom.index.count / 3;
      else if (geom.attributes.position) tris += geom.attributes.position.count / 3;
      geom.computeBoundingBox();
      if (geom.boundingBox) bbox.union(geom.boundingBox.clone().applyMatrix4(o.matrixWorld));
    }
  });
  return {
    meshes,
    verts,
    tris: Math.round(tris),
    bboxMin: bbox.min.toArray().map((v) => +v.toFixed(3)),
    bboxMax: bbox.max.toArray().map((v) => +v.toFixed(3)),
    height: +(bbox.max.y - bbox.min.y).toFixed(3),
    width: +(bbox.max.x - bbox.min.x).toFixed(3),
  };
}

const results = [];
for (const file of targets) {
  const path = resolve(ATTEMPTS, file);
  const buf = readFileSync(path);
  // GLTFLoader.parse needs ArrayBuffer
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  await new Promise((res) => {
    loader.parse(
      ab,
      '',
      (gltf) => {
        const summary = summarizeMeshes(gltf);
        const entry = { file, status: 'OK', sizeMB: +(buf.byteLength / 1e6).toFixed(2), ...summary };
        results.push(entry);
        console.log(`[OK] ${file}: meshes=${summary.meshes} verts=${summary.verts} tris=${summary.tris} h=${summary.height} w=${summary.width} size=${entry.sizeMB}MB`);
        res();
      },
      (err) => {
        results.push({ file, status: 'ERROR', error: String(err) });
        console.error(`[ERR] ${file}: ${err}`);
        res();
      },
    );
  });
}

const out = `${ROOT}/scripts/sprint16b/_logs/p5_three_validation.json`;
const fs = await import('node:fs');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`[p5] saved -> ${out}`);

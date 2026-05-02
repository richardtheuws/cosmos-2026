// Sprint 16B p8 — pre-deploy live test.
// Verifies the SHIPPED cosmo.glb loads cleanly with the same GLTFLoader the engine uses
// (no DRACOLoader needed since we ship raw). Mimics CosmoAgent.ts loader path.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ROOT = '/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026';
const GLB = `${ROOT}/public/assets/3d/cosmo.glb`;

const buf = readFileSync(GLB);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
let verdict = 'FAIL';
let stats = null;

await new Promise((res) => {
  loader.parse(
    ab,
    '',
    (gltf) => {
      let verts = 0;
      let tris = 0;
      let meshes = 0;
      let materials = 0;
      const matSet = new Set();
      const bbox = new THREE.Box3();
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          meshes += 1;
          const geom = o.geometry;
          if (geom.attributes.position) verts += geom.attributes.position.count;
          if (geom.index) tris += geom.index.count / 3;
          else if (geom.attributes.position) tris += geom.attributes.position.count / 3;
          if (o.material) matSet.add(o.material.uuid);
          geom.computeBoundingBox();
          if (geom.boundingBox) bbox.union(geom.boundingBox.clone().applyMatrix4(o.matrixWorld));
        }
      });
      materials = matSet.size;
      stats = {
        meshes,
        verts,
        tris: Math.round(tris),
        materials,
        height: +(bbox.max.y - bbox.min.y).toFixed(3),
        width: +(bbox.max.x - bbox.min.x).toFixed(3),
        sizeMB: +(buf.byteLength / 1e6).toFixed(2),
      };

      // PASS criteria:
      const tooBig = stats.tris > 50000;
      const tooSmall = stats.tris < 5000;
      const wrongScale = stats.height < 0.5 || stats.height > 5.0;
      const noMesh = meshes === 0;

      if (noMesh) verdict = 'FAIL: no mesh';
      else if (tooBig) verdict = `FAIL: poly-count ${stats.tris} > 50000`;
      else if (tooSmall) verdict = `FAIL: poly-count ${stats.tris} too low`;
      else if (wrongScale) verdict = `FAIL: scale h=${stats.height} not in [0.5, 5.0]`;
      else verdict = 'PASS';

      res();
    },
    (err) => {
      verdict = `FAIL: load error ${err}`;
      res();
    },
  );
});

console.log(`[live-test] cosmo.glb verdict: ${verdict}`);
console.log(`[live-test] stats:`, JSON.stringify(stats, null, 2));

const out = `${ROOT}/scripts/sprint16b/_logs/p8_live_test.json`;
const fs = await import('node:fs');
fs.writeFileSync(out, JSON.stringify({ verdict, stats }, null, 2));

if (!verdict.startsWith('PASS')) process.exit(1);

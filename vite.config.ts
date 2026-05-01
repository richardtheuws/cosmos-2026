import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  // Production builds deploy under theuws.com/games/cosmos-2026/, so all /-prefixed
  // asset references must be rewritten to that base. Dev server stays at root so
  // localhost:5173/play/ keeps working. Override per-build via `VITE_BASE=/ ...`.
  base: command === 'build' ? (process.env.VITE_BASE ?? '/games/cosmos-2026/') : '/',

  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@three': resolve(__dirname, 'src/three'),
      '@phaser': resolve(__dirname, 'src/phaser'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@data': resolve(__dirname, 'src/data'),
    },
  },

  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play/index.html'),
        prd: resolve(__dirname, 'prd/index.html'),
        updates: resolve(__dirname, 'public/updates/index.html'),
        lore: resolve(__dirname, 'public/lore/index.html'),
        support: resolve(__dirname, 'public/support/index.html'),
        press: resolve(__dirname, 'public/press/index.html'),
        thanks: resolve(__dirname, 'public/thanks/index.html'),
      },
    },
  },

  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.mp3', '**/*.wasm'],

  server: {
    host: true,
    allowedHosts: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}));

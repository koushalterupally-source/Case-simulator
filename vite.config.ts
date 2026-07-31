import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs/promises';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

/**
 * Injects the hashed build assets into public/sw.js so the service worker can
 * precache them during install. On a first visit the browser requests the JS and
 * CSS before the worker has activated, so relying on the fetch handler alone
 * leaves them uncached and the app fails to start offline.
 */
function swPrecache(): Plugin {
  return {
    name: 'sw-precache',
    apply: 'build',
    async writeBundle(options, bundle) {
      const outDir = options.dir;
      if (!outDir) return;
      const base = process.env.VITE_BASE_PATH || '/';
      const assets = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => JSON.stringify(base + f))
        .join(', ');

      const swPath = path.join(outDir, 'sw.js');
      try {
        const sw = await fs.readFile(swPath, 'utf8');
        await fs.writeFile(swPath, sw.replace('/*__PRECACHE_ASSETS__*/', assets));
      } catch {
        // No service worker in this build; nothing to inject.
      }
    },
  };
}

export default defineConfig(() => {
  return {
    // GitHub Pages serves a project site from /<repo>/, not the domain root.
    // The deploy workflow sets this from the real repo name; local dev stays '/'.
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), swPrecache()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

/**
 * copy-server-deps.js
 * Copies external server dependencies to dist-server-bundle/node_modules/
 * so the server child process (ELECTRON_RUN_AS_NODE=1) can find them at runtime.
 *
 * The Vite server build externalizes certain packages (see vite.config.server.js
 * rollupOptions.external). These must be available at runtime for the server to start.
 *
 * Strategy: copy ALL production dependencies (from package.json "dependencies")
 * to dist-server-bundle/node_modules/. The server bundle is in the same directory,
 * so Node's module resolution will find these deps.
 *
 * Note: Some packages (React, TipTap, etc.) are only needed by the renderer and
 * are already bundled by Vite's desktop build. Including them here adds ~50-100MB
 * but guarantees runtime correctness.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const target = resolve(root, 'dist-server-bundle', 'node_modules');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const allDeps = Object.keys(pkg.dependencies || {});

// These are renderer-only packages already bundled by Vite desktop build.
// Skipping them saves significant space (~100MB) in the installer.
const rendererOnly = new Set([
  'react', 'react-dom', 'motion',
  'react-markdown', 'remark-gfm',
  '@tiptap/core', '@tiptap/extension-bold', '@tiptap/extension-placeholder',
  '@tiptap/pm', '@tiptap/react', '@tiptap/starter-kit',
  '@codemirror/lang-markdown', '@codemirror/language-data', '@codemirror/view',
  'codemirror',
  'katex', '@traptitech/markdown-it-katex',
  'mermaid',
  'zustand',
  'electron-updater',
  'pdf-parse', 'unpdf',
]);

mkdirSync(target, { recursive: true });

let copied = 0;
let skipped = 0;

for (const dep of allDeps) {
  if (rendererOnly.has(dep)) {
    skipped++;
    continue;
  }

  const src = resolve(root, 'node_modules', dep);
  if (!existsSync(src)) {
    console.warn(`[copy-server-deps] Skipping ${dep}: not found at ${src}`);
    continue;
  }

  const dest = resolve(target, dep);
  try {
    cpSync(src, dest, { recursive: true });
    copied++;
  } catch (err) {
    console.error(`[copy-server-deps] Failed to copy ${dep}: ${err.message}`);
  }
}

console.log(`[copy-server-deps] Done: ${copied} packages copied, ${skipped} renderer-only skipped`);


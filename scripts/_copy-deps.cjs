const { cpSync, existsSync, mkdirSync, readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const target = resolve(root, 'dist-server-bundle', 'node_modules');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const allDeps = Object.keys(pkg.dependencies || {});

const skip = ['react','react-dom','motion','react-markdown','remark-gfm',
  '@tiptap/core','@tiptap/extension-bold','@tiptap/extension-placeholder',
  '@tiptap/pm','@tiptap/react','@tiptap/starter-kit',
  '@codemirror/lang-markdown','@codemirror/language-data','@codemirror/view',
  'codemirror','katex','@traptitech/markdown-it-katex','mermaid',
  'zustand','electron-updater','pdf-parse','unpdf'];
const skipSet = new Set(skip);

mkdirSync(target, { recursive: true });
let copied = 0;

for (const dep of allDeps) {
  if (skipSet.has(dep)) continue;
  const src = resolve(root, 'node_modules', dep);
  if (!existsSync(src)) { console.warn('SKIP ' + dep); continue; }
  cpSync(src, resolve(target, dep), { recursive: true });
  copied++;
  console.log('  ' + dep);
}
console.log('Copied ' + copied + ' packages');

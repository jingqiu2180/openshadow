/**
 * Copy desktop assets (HTML + wizard + images) to dist folder.
 * Run as part of the build process (tsc + this).
 *
 * Stage 1b: also copies desktop/wizard/ (7-step first-launch wizard)
 * because tsc only processes .ts files in desktop/src/, not plain .html/.css/.js.
 *
 * Stage 1j: also copies desktop/src/assets/ (PNG icons, etc.) so the
 * Electron app icon path resolves at runtime.
 */
import { cpSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const destDir = resolve(root, 'dist', 'desktop')

mkdirSync(destDir, { recursive: true })

// Main desktop entry
const srcMain = resolve(root, 'desktop', 'index.html')
const destMain = resolve(destDir, 'index.html')
cpSync(srcMain, destMain)
console.log('Copied desktop/index.html -> dist/desktop/index.html')

// Wizard assets (Stage 1b) — copy entire directory
const srcWizard = resolve(root, 'desktop', 'wizard')
const destWizard = resolve(destDir, 'wizard')
cpSync(srcWizard, destWizard, { recursive: true })
console.log('Copied desktop/wizard/ -> dist/desktop/wizard/')

// Theme CSS files (desktop/src/themes/) + lib/theme.js — required for theme switcher.
// index.html references `<link id="themeSheet" href="themes/<name>.css">` and `<script src="lib/theme.js">`.
const srcThemes = resolve(root, 'desktop', 'src', 'themes')
const destThemes = resolve(destDir, 'themes')
if (existsSync(srcThemes)) {
  cpSync(srcThemes, destThemes, { recursive: true })
  console.log('Copied desktop/src/themes/ -> dist/desktop/themes/')
}
const srcLib = resolve(root, 'desktop', 'src', 'lib')
const destLib = resolve(destDir, 'lib')
if (existsSync(srcLib)) {
  cpSync(srcLib, destLib, { recursive: true })
  console.log('Copied desktop/src/lib/ -> dist/desktop/lib/')
}
const srcModules = resolve(root, 'desktop', 'src', 'modules')
const destModules = resolve(destDir, 'modules')
if (existsSync(srcModules)) {
  cpSync(srcModules, destModules, { recursive: true })
  console.log('Copied desktop/src/modules/ -> dist/desktop/modules/')
}

// App assets (Stage 1j) — PNG icons used by Electron BrowserWindow.icon
// and referenced by React components via Vite import
const srcAssets = resolve(root, 'desktop', 'src', 'assets')
const destAssets = resolve(destDir, 'assets')
cpSync(srcAssets, destAssets, { recursive: true })
console.log('Copied desktop/src/assets/ -> dist/desktop/assets/')

// Electron main + preload: handled by `npm run electron` (which calls tsc -p desktop/tsconfig.json
// then renames .js → .cjs). This script intentionally does NOT copy them — `npm run build` is
// for the server bundle, not the Electron shell.

// Copy .cjs and .json resource files from all source dirs to dist/
// (tsc only processes .ts files, these are required at runtime)
import { existsSync, readdirSync } from 'fs'
const resourceSourceDirs = [
  { src: resolve(root, 'shared'), dest: resolve(root, 'dist', 'shared') },
  { src: resolve(root, 'lib'), dest: resolve(root, 'dist', 'lib') },
  { src: resolve(root, 'desktop', 'src', 'shared'), dest: resolve(root, 'dist', 'desktop', 'src', 'shared') },
  { src: resolve(root, 'desktop', 'src', 'locales'), dest: resolve(root, 'dist', 'desktop', 'src', 'locales') },
]
for (const { src, dest } of resourceSourceDirs) {
  if (!existsSync(src)) continue
  mkdirSync(dest, { recursive: true })
  try {
    let count = 0
    for (const f of readdirSync(src)) {
      if (f.endsWith('.cjs') || f.endsWith('.json')) {
        cpSync(resolve(src, f), resolve(dest, f))
        count++
      }
    }
    if (count > 0) console.log('Copied ' + count + ' resource file(s): ' + src + ' -> ' + dest)
  } catch (e) {
    console.warn('[copy-assets] Failed: ' + src + ' — ' + e.message)
  }
}

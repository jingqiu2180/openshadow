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
import { cpSync, mkdirSync, existsSync } from 'fs'
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

// App assets (Stage 1j) — PNG icons used by Electron BrowserWindow.icon
// and referenced by React components via Vite import
const srcAssets = resolve(root, 'desktop', 'src', 'assets')
const destAssets = resolve(destDir, 'assets')
cpSync(srcAssets, destAssets, { recursive: true })
console.log('Copied desktop/src/assets/ -> dist/desktop/assets/')

// Electron main + preload: tsc outputs to dist/desktop/src/ but electron expects dist/desktop/
// Also rename .js → .cjs (required by electron-builder extraMetadata.main)
const srcElectronMain = resolve(root, 'dist', 'desktop', 'src', 'electron-main.js')
const destElectronMain = resolve(destDir, 'electron-main.cjs')
const srcPreload = resolve(root, 'dist', 'desktop', 'src', 'preload.js')
const destPreload = resolve(destDir, 'preload.cjs')
if (existsSync(srcElectronMain)) {
  cpSync(srcElectronMain, destElectronMain)
  console.log('Copied dist/desktop/src/electron-main.js -> dist/desktop/electron-main.cjs')
} else {
  console.warn('[copy-desktop-assets] WARNING: electron-main.js not found at', srcElectronMain)
}
if (existsSync(srcPreload)) {
  cpSync(srcPreload, destPreload)
  console.log('Copied dist/desktop/src/preload.js -> dist/desktop/preload.cjs')
} else {
  console.warn('[copy-desktop-assets] WARNING: preload.js not found at', srcPreload)
}

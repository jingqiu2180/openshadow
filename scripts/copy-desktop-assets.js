/**
 * Copy desktop assets (HTML + wizard) to dist folder.
 * Run as part of the build process (tsc + this).
 *
 * Stage 1b: also copies desktop/wizard/ (7-step first-launch wizard)
 * because tsc only processes .ts files in desktop/src/, not plain .html/.css/.js.
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

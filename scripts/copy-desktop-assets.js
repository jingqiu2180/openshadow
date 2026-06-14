/**
 * Copy desktop assets (index.html) to dist folder.
 * Run as part of the build process.
 */
import { cpSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'desktop', 'index.html')
const destDir = resolve(root, 'dist', 'desktop')
const dest = resolve(destDir, 'index.html')

mkdirSync(destDir, { recursive: true })
cpSync(src, dest)

console.log('✅ Copied desktop/index.html → dist/desktop/index.html')
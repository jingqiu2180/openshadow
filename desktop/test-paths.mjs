import { fileURLToPath } from 'node:url'
import { dirname, resolve, sep } from 'node:path'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
console.log('__filename:', __filename)
console.log('__dirname:', __dirname)

const SHARED_DIRS = [
  resolve(__dirname, 'src/react/components/shared'),
  resolve(__dirname, 'src/shared'),
  resolve(__dirname, '../../shared'),
]

console.log('SHARED_DIRS:')
SHARED_DIRS.forEach(d => console.log('  ', d, existsSync(d) ? 'EXISTS' : 'NOT FOUND'))

// Test tryResolve for workspace-history
const subpath = 'workspace-history'
for (const dir of SHARED_DIRS) {
  const base = resolve(dir, subpath)
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
    const f = base + ext
    if (existsSync(f)) { console.log('FOUND:', f); break }
  }
}

// Also test what Vite's alias function receives
console.log('\nAlias test: @shared/workspace-history')
const id = '@shared/workspace-history'
if (id.startsWith('@shared/')) {
  const sub = id.slice('@shared/'.length)
  for (const dir of SHARED_DIRS) {
    const base = resolve(dir, sub)
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
      const f = base + ext
      if (existsSync(f)) { console.log('  Resolves to:', f); break }
    }
  }
}

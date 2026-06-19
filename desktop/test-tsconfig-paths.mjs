import { createMatchPath, loadConfig } from 'tsconfig-paths'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load tsconfig.json
const result = loadConfig(__dirname)
console.log('loadConfig result:', result.resultType)
if (result.resultType === 'success') {
  console.log('tsconfig path:', result.configFileAbsolutePath)
  console.log('paths:', JSON.stringify(result.paths, null, 2))
  
  const matchPath = createMatchPath(__dirname, result.paths)
  
  const tests = [
    '@shared/workspace-history',
    '@shared/studio-access-contract',
    '@/ui',
    '@/ui/index.tsx',
  ]
  
  for (const id of tests) {
    const resolved = matchPath(id)
    console.log(id, '->', resolved || 'NOT FOUND')
  }
} else {
  console.log('FAILED to load tsconfig:', result)
}

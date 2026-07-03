import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PersonalityTemplate } from './template.js'
import { validateTemplate } from './template.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function loadPersonality(path?: string): PersonalityTemplate {
  const filePath = path ?? join(__dirname, 'default.json')
  if (!existsSync(filePath)) {
    throw new Error(`Personality template not found: ${filePath}`)
  }
  const content = readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(content)

  if (!validateTemplate(parsed)) {
    throw new Error(`Invalid personality template at ${filePath}`)
  }

  return parsed
}

export function loadPersonalityOrDefault(path?: string): PersonalityTemplate {
  try {
    return loadPersonality(path)
  } catch {
    // Fallback to embedded default
    const defaultContent = JSON.parse(readFileSync(join(__dirname, 'default.json'), 'utf-8'))
    return defaultContent
  }
}

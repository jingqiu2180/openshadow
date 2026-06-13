import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { PathGuard } from './tools/path-guard.js'

export interface Skill {
  name: string
  description: string
  handler: (args: Record<string, unknown>) => Promise<any>
}

export interface SkillManifest {
  name: string
  description: string
  version: string
  tools?: string[]
}

export class Skills {
  private _skills: Map<string, Skill> = new Map()
  private guard: PathGuard

  constructor(rootPath: string, allowedPaths?: string[]) {
    this.guard = new PathGuard(allowedPaths ?? [rootPath])
  }

  async loadFrom(dir: string): Promise<void> {
    this.guard.assertAllowed(dir)

    const entries = await readdir(dir)
    for (const entry of entries) {
      const skillDir = join(dir, entry)
      const info = await stat(skillDir)
      if (!info.isDirectory()) continue

      const manifestPath = join(skillDir, 'SKILL.md')
      try {
        const content = await readFile(manifestPath, 'utf-8')
        const manifest = this.parseManifest(content, entry)
        this._skills.set(manifest.name, {
          name: manifest.name,
          description: manifest.description,
          handler: async () => ({ result: `Skill ${manifest.name} executed` }),
        })
        console.log(`[skills] Loaded: ${manifest.name}`)
      } catch {
        // Skip if no SKILL.md
      }
    }
  }

  private parseManifest(content: string, name: string): SkillManifest {
    const lines = content.split('\n')
    let description = name

    for (const line of lines) {
      if (line.startsWith('description:')) {
        description = line.replace('description:', '').trim()
      }
    }

    return { name, description, version: '1.0.0' }
  }

  get(name: string): Skill | undefined {
    return this._skills.get(name)
  }

  list(): Skill[] {
    return [...this._skills.values()]
  }

  async execute(name: string, args: Record<string, unknown> = {}): Promise<any> {
    const skill = this._skills.get(name)
    if (!skill) {
      throw new Error(`Skill not found: ${name}`)
    }
    return skill.handler(args)
  }

  register(skill: Skill): void {
    this._skills.set(skill.name, skill)
  }
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    name: 'memory-management',
    description: 'Read/write memories and summarize',
    handler: async ({ action }: any) => {
      if (action === 'read') return { memories: [] }
      if (action === 'write') return { success: true }
      return { error: 'Unknown action' }
    },
  },
  {
    name: 'personality-editor',
    description: 'Edit personality template',
    handler: async ({ key, value }: any) => {
      return { success: true, key, value }
    },
  },
  {
    name: 'schedule-manager',
    description: 'Manage scheduled tasks',
    handler: async ({ action }: any) => {
      return { success: true, action }
    },
  },
]

export function createSkills(rootPath: string, allowedPaths?: string[]): Skills {
  const skills = new Skills(rootPath, allowedPaths)

  for (const skill of BUILTIN_SKILLS) {
    skills.register(skill)
  }

  return skills
}
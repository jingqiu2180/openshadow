// @ts-nocheck
import { readdir, stat, readFile, writeFile, mkdir, rm } from 'fs/promises'
import { join, extname, basename } from 'path'
import { PathGuard } from './tools/path-guard'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string
}

export interface DeskOptions {
  rootPath: string
  allowedPaths?: string[]
}

export class Desk {
  private readonly guard: PathGuard
  private readonly rootPath: string

  constructor(options: DeskOptions) {
    this.rootPath = options.rootPath
    this.guard = new PathGuard(options.allowedPaths ?? [options.rootPath])
  }

  async list(path: string = ''): Promise<FileEntry[]> {
    const fullPath = join(this.rootPath, path)
    this.guard.assertAllowed(fullPath, 'read')

    const entries = await readdir(fullPath)
    const files: FileEntry[] = []

    for (const name of entries) {
      try {
        const entryPath = join(fullPath, name)
        const info = await stat(entryPath)
        files.push({
          name,
          path: join(path, name),
          isDirectory: info.isDirectory(),
          size: info.size,
          modified: info.mtime.toISOString(),
        })
      } catch {
        // Skip inaccessible files
      }
    }

    return files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  async read(path: string): Promise<string> {
    const fullPath = join(this.rootPath, path)
    this.guard.assertAllowed(fullPath, 'read')
    return readFile(fullPath, 'utf-8')
  }

  async write(path: string, content: string): Promise<void> {
    const fullPath = join(this.rootPath, path)
    this.guard.assertAllowed(fullPath, 'write')
    await writeFile(fullPath, content, 'utf-8')
  }

  async mkdir(path: string): Promise<void> {
    const fullPath = join(this.rootPath, path)
    this.guard.assertAllowed(fullPath, 'write')
    await mkdir(fullPath, { recursive: true })
  }

  async delete(path: string): Promise<void> {
    const fullPath = join(this.rootPath, path)
    this.guard.assertAllowed(fullPath, 'delete')
    await rm(fullPath, { recursive: true })
  }

  getInfo(path: string = '') {
    const ext = extname(path)
    const name = basename(path)
    return {
      name,
      ext,
      isCode: ['.js', '.js', '.json', '.md'].includes(ext),
      isImage: ['.png', '.jpg', '.gif', '.webp'].includes(ext),
    }
  }
}

export function createDesk(options: DeskOptions): Desk {
  return new Desk(options)
}

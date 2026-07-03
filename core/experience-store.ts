/**
 * experience-store.ts — 经验库存储层
 * 移植自 openhanako/lib/tools/experience.ts
 * 经验库采用渐进式披露：
 *   experience.md   — 索引（分类 + description + 路径），recall 无参时返回
 *   experience/*.md  — 分类文件（数字列表），recall 有参时返回
 */
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const TITLE_META_RE = /^<!--\s*experience-title:\s*([A-Za-z0-9_-]+)\s*-->$/

export interface ExperienceDoc {
  file: string
  filePath: string
  title: string
  body: string
}

/** 归一化分类名（防止路径遍历） */
export function normalizeExperienceCategory(category: string): string {
  const title = String(category ?? '').trim()
  if (!title) throw new Error('invalid experience category')
  if (/[\0\r\n]/.test(title)) throw new Error('invalid experience category')
  if (title === '.' || title === '..') throw new Error('invalid experience category')
  if (title.includes('/') || title.includes('\\') || title.includes('..')) {
    throw new Error('invalid experience category')
  }
  if (/^[A-Za-z]:/.test(title)) throw new Error('invalid experience category')
  return title
}

function encodeExperienceTitle(title: string): string {
  return Buffer.from(title, 'utf-8').toString('base64url')
}

function decodeExperienceTitle(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf-8')
}

function buildExperienceStorageFileName(category: string): string {
  const title = normalizeExperienceCategory(category)
  const stem = title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const hash = crypto.createHash('sha256').update(title).digest('hex').slice(0, 10)
  return `${stem || 'experience'}-${hash}.md`
}

function serializeExperienceDocument(title: string, body: string): string {
  return `<!-- experience-title: ${encodeExperienceTitle(title)} -->\n${body.trimEnd()}\n`
}

function parseExperienceDocument(content: string, fallbackTitle: string): { title: string; body: string } {
  const lines = content.split('\n')
  const metaMatch = lines[0]?.match(TITLE_META_RE)
  if (!metaMatch) {
    return { title: fallbackTitle, body: content.trimEnd() }
  }
  try {
    const title = normalizeExperienceCategory(decodeExperienceTitle(metaMatch[1]))
    return {
      title,
      body: lines.slice(1).join('\n').replace(/^\n+/, '').trimEnd(),
    }
  } catch {
    return { title: fallbackTitle, body: content.trimEnd() }
  }
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export function listExperienceDocuments(experienceDir: string): ExperienceDoc[] {
  if (!fs.existsSync(experienceDir)) return []
  let files: string[]
  try {
    files = fs.readdirSync(experienceDir).filter(f => f.endsWith('.md')).sort()
  } catch {
    return []
  }
  return files.map(file => {
    const filePath = path.join(experienceDir, file)
    const fallbackTitle = file.replace(/\.md$/, '')
    const { title, body } = parseExperienceDocument(readFile(filePath), fallbackTitle)
    return { file, filePath, title, body }
  })
}

export function findExperienceDocument(experienceDir: string, category: string): ExperienceDoc | null {
  const title = normalizeExperienceCategory(category)
  return listExperienceDocuments(experienceDir).find(doc => doc.title === title) || null
}

/** 重建索引文件 experience.md */
export function rebuildIndex(experienceDir: string, indexPath: string): void {
  const docs = listExperienceDocuments(experienceDir)
  if (docs.length === 0) {
    try { fs.writeFileSync(indexPath, '', 'utf-8') } catch {}
    return
  }

  const blocks: string[] = []
  for (const doc of docs) {
    const entries = doc.body
      .split('\n')
      .filter(l => /^\d+\.\s/.test(l.trim()))
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
    if (entries.length === 0) continue
    const snippets = entries.map(e => e.length > 20 ? e.slice(0, 20) + '…' : e)
    let desc = snippets.join('; ')
    if (desc.length > 120) desc = desc.slice(0, 117) + '…'
    blocks.push(`# ${doc.title}（${entries.length} 条）\n${desc}\n→ experience/${doc.file}`)
  }

  const indexContent = blocks.join('\n\n') + '\n'
  fs.writeFileSync(indexPath, indexContent, 'utf-8')
}

/** 记录一条经验到分类文件，并重建索引 */
export function recordEntry(experienceDir: string, indexPath: string, category: string, content: string): { added: boolean; reason?: string } {
  const safeCategory = normalizeExperienceCategory(category)
  if (!fs.existsSync(experienceDir)) {
    fs.mkdirSync(experienceDir, { recursive: true })
  }

  const existingDoc = findExperienceDocument(experienceDir, safeCategory)
  const filePath = existingDoc?.filePath || path.join(experienceDir, buildExperienceStorageFileName(safeCategory))
  const existing = existingDoc?.body || readFile(filePath)

  // 去重
  if (existing.includes(content)) {
    return { added: false, reason: 'duplicate' }
  }

  const lines = existing.split('\n').filter(l => /^\d+\.\s/.test(l.trim()))
  const nextNum = lines.length + 1
  const newLine = `${nextNum}. ${content}`

  const updated = existing.trimEnd()
    ? existing.trimEnd() + '\n' + newLine + '\n'
    : newLine + '\n'

  fs.writeFileSync(filePath, serializeExperienceDocument(safeCategory, updated), 'utf-8')
  rebuildIndex(experienceDir, indexPath)

  return { added: true }
}

// @ts-nocheck
/**
 * Terminal Session Manager（对齐 openhanako）
 * 管理持久化终端会话，支持创建、读写、关闭
 * 依赖 node-pty
 */

import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import pty from 'node-pty'

const TERMINAL_ROOT = '.ephemeral/terminal-sessions'

function terminalId() {
  return `term_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

function asNonEmptyString(value: any, name: string): string {
  const text = typeof value === 'string' ? value : ''
  if (!text.trim()) throw new Error(`${name} is required`)
  return text
}

function publicEntry(entry: any) {
  return {
    terminalId: entry.terminalId,
    sessionPath: entry.sessionPath,
    agentId: entry.agentId,
    cwd: entry.cwd,
    command: entry.command,
    label: entry.label,
    status: entry.status,
    seq: entry.seq,
    createdAt: entry.createdAt,
    lastActivityAt: entry.lastActivityAt,
    exitedAt: entry.exitedAt ?? null,
    exitCode: entry.exitCode ?? null,
    signal: entry.signal ?? null,
    transcriptPath: entry.transcriptPath,
  }
}

export class TerminalSessionManager {
  private root: string
  private terminals: Map<string, any> = new Map()
  private bySession: Map<string, Set<string>> = new Map()

  constructor(hanakoHome: string) {
    this.root = path.join(hanakoHome, TERMINAL_ROOT)
    fs.mkdirSync(this.root, { recursive: true })
    this.loadPersistedTerminals()
  }

  async start(opts: {
    sessionPath: string
    agentId?: string
    cwd: string
    command?: string
    label?: string
    cols?: number
    rows?: number
    env?: Record<string, string>
  }): Promise<any> {
    const normalizedSessionPath = asNonEmptyString(opts.sessionPath, 'sessionPath')
    const normalizedCwd = path.resolve(asNonEmptyString(opts.cwd, 'cwd'))
    
    if (!fs.existsSync(normalizedCwd)) {
      throw new Error(`cwd does not exist: ${normalizedCwd}`)
    }

    const id = terminalId()
    const now = Date.now()
    const entry: any = {
      terminalId: id,
      sessionPath: normalizedSessionPath,
      agentId: opts.agentId || '',
      cwd: normalizedCwd,
      command: opts.command || '',
      label: opts.label || '',
      status: 'running',
      seq: 0,
      createdAt: now,
      lastActivityAt: now,
      exitedAt: null,
      exitCode: null,
      signal: null,
      transcriptPath: this.transcriptPath(id),
      handle: null,
    }

    this.terminals.set(id, entry)
    this.index(entry)

    try {
      const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
      entry.handle = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: opts.cols || 80,
        rows: opts.rows || 24,
        cwd: normalizedCwd,
        env: opts.env || process.env,
      })

      entry.handle.onData((data: string) => this.recordData(id, data))
      entry.handle.onExit((result: any) => {
        this.markExited(id, result)
      })

      this.persist(entry)
      return { ...publicEntry(entry), output: '' }
    } catch (err) {
      this.terminals.delete(id)
      this.bySession.get(normalizedSessionPath)?.delete(id)
      throw err
    }
  }

  write(opts: { sessionPath: string; terminalId: string; chars: string }): any {
    const entry = this.requireOwned(opts)
    if (entry.status !== 'running') {
      throw new Error(`terminal ${entry.terminalId} is not running`)
    }
    const sinceSeq = entry.seq
    entry.handle?.write(opts.chars)
    return this.read({ sessionPath: entry.sessionPath, terminalId: entry.terminalId, sinceSeq })
  }

  read(opts: { sessionPath: string; terminalId: string; sinceSeq?: number }): any {
    const entry = this.requireOwned(opts)
    const chunks = this.readTranscript(entry.transcriptPath, opts.sinceSeq || 0)
    return {
      ...publicEntry(entry),
      output: chunks.map((chunk: any) => chunk.data).join(''),
      chunks,
    }
  }

  close(opts: { sessionPath: string; terminalId: string }): any {
    const entry = this.requireOwned(opts)
    if (entry.status === 'running') {
      entry.status = 'killed'
      entry.exitedAt = Date.now()
      entry.lastActivityAt = entry.exitedAt
      try {
        entry.handle?.kill()
      } finally {
        this.persist(entry)
      }
    }
    return { ...publicEntry(entry), output: '' }
  }

  closeForSession(sessionPath: string): any[] {
    const normalizedSessionPath = asNonEmptyString(sessionPath, 'sessionPath')
    const ids = [...(this.bySession.get(normalizedSessionPath) || [])]
    return ids.map((id) => this.close({ sessionPath: normalizedSessionPath, terminalId: id }))
  }

  closeAll(): any[] {
    const ids = [...this.terminals.keys()]
    return ids
      .map((id) => this.terminals.get(id))
      .filter(Boolean)
      .map((entry) => this.close({ sessionPath: entry.sessionPath, terminalId: entry.terminalId }))
  }

  list(sessionPath: string): any {
    const normalizedSessionPath = asNonEmptyString(sessionPath, 'sessionPath')
    const ids = this.bySession.get(normalizedSessionPath) || new Set()
    const terminals = [...ids]
      .map((id) => this.terminals.get(id))
      .filter(Boolean)
      .map(publicEntry)
      .sort((a: any, b: any) => a.createdAt - b.createdAt)
    return { sessionPath: normalizedSessionPath, terminals }
  }

  private requireOwned(opts: { sessionPath: string; terminalId: string }): any {
    const id = asNonEmptyString(opts.terminalId, 'terminalId')
    const normalizedSessionPath = asNonEmptyString(opts.sessionPath, 'sessionPath')
    const entry = this.terminals.get(id)
    if (!entry) throw new Error(`terminal ${id} not found`)
    if (entry.sessionPath !== normalizedSessionPath) {
      throw new Error(`terminal ${id} belongs to another session`)
    }
    return entry
  }

  private index(entry: any): void {
    if (!this.bySession.has(entry.sessionPath)) {
      this.bySession.set(entry.sessionPath, new Set())
    }
    this.bySession.get(entry.sessionPath)!.add(entry.terminalId)
  }

  private metadataPath(id: string): string {
    return path.join(this.root, `${id}.json`)
  }

  private transcriptPath(id: string): string {
    return path.join(this.root, `${id}.jsonl`)
  }

  private persist(entry: any): void {
    fs.mkdirSync(this.root, { recursive: true })
    fs.writeFileSync(this.metadataPath(entry.terminalId), JSON.stringify(publicEntry(entry), null, 2))
  }

  private appendTranscript(entry: any, data: string): void {
    fs.mkdirSync(path.dirname(entry.transcriptPath), { recursive: true })
    fs.appendFileSync(
      entry.transcriptPath,
      JSON.stringify({ seq: entry.seq, ts: entry.lastActivityAt, data }) + '\n'
    )
  }

  private recordData(id: string, data: string): void {
    const entry = this.terminals.get(id)
    if (!entry) return
    if (!data) return
    entry.seq += 1
    entry.lastActivityAt = Date.now()
    this.appendTranscript(entry, data)
    this.persist(entry)
  }

  private markExited(id: string, result: any = {}): void {
    const entry = this.terminals.get(id)
    if (!entry) return
    if (entry.status === 'running') {
      entry.status = 'exited'
    }
    entry.exitCode = Number.isFinite(result.exitCode) ? result.exitCode : null
    entry.signal = typeof result.signal === 'string' ? result.signal : null
    entry.exitedAt = Date.now()
    entry.lastActivityAt = entry.exitedAt
    entry.handle = null
    this.persist(entry)
  }

  private readTranscript(transcriptPath: string, sinceSeq: number = 0): any[] {
    if (!fs.existsSync(transcriptPath)) return []
    const minSeq = Number.isFinite(Number(sinceSeq)) ? Number(sinceSeq) : 0
    const raw = fs.readFileSync(transcriptPath, 'utf8')
    const chunks: any[] = []
    for (const line of raw.split(/\n/)) {
      if (!line.trim()) continue
      try {
        const item = JSON.parse(line)
        if (Number(item.seq) > minSeq) chunks.push(item)
      } catch {}
    }
    return chunks
  }

  private loadPersistedTerminals(): void {
    if (!fs.existsSync(this.root)) return
    for (const file of fs.readdirSync(this.root)) {
      if (!file.endsWith('.json')) continue
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(this.root, file), 'utf8'))
        if (!entry?.terminalId || !entry?.sessionPath) continue
        const restored = {
          ...entry,
          status: entry.status === 'running' ? 'stale' : entry.status,
          handle: null,
          transcriptPath: entry.transcriptPath || this.transcriptPath(entry.terminalId),
        }
        this.terminals.set(restored.terminalId, restored)
        this.index(restored)
        if (restored.status !== entry.status) this.persist(restored)
      } catch {}
    }
  }
}

// 单例（延迟初始化）
let _instance: TerminalSessionManager | null = null
export function getTerminalSessionManager(hanakoHome?: string): TerminalSessionManager {
  if (!_instance) {
    const home = hanakoHome || path.resolve(process.cwd(), 'data')
    _instance = new TerminalSessionManager(home)
  }
  return _instance
}

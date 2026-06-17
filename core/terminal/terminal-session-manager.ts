/**
 * 简化版终端会话管理器
 * 参考 openhanako/lib/terminal/terminal-session-manager.ts
 * 使用 spawn 而非 PTY，适合 Windows 环境
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

const TERMINAL_ROOT = '.remu/terminal-sessions'

function terminalId(): string {
  return `term_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

interface TerminalEntry {
  terminalId: string
  cwd: string
  command: string
  label: string
  status: 'running' | 'exited'
  seq: number
  createdAt: number
  lastActivityAt: number
  exitedAt: number | null
  exitCode: number | null
  outputBuffer: string // 输出缓存（最多保留 50KB）
  process: ChildProcess | null
}

export class TerminalSessionManager {
  private terminals: Map<string, TerminalEntry> = new Map()
  private root: string

  constructor(workspaceDir: string) {
    this.root = path.join(workspaceDir, TERMINAL_ROOT)
    fs.mkdirSync(this.root, { recursive: true })
  }

  list(): any[] {
    return Array.from(this.terminals.values())
      .filter(t => t.status === 'running')
      .map(t => ({
        terminalId: t.terminalId,
        cwd: t.cwd,
        command: t.command,
        label: t.label,
        status: t.status,
        seq: t.seq,
        createdAt: t.createdAt,
        lastActivityAt: t.lastActivityAt,
      }))
  }

  async start(opts: {
    cwd: string
    command: string
    label?: string
    cols?: number
    rows?: number
  }): Promise<any> {
    const id = terminalId()
    const now = Date.now()

    const entry: TerminalEntry = {
      terminalId: id,
      cwd: opts.cwd,
      command: opts.command,
      label: opts.label || opts.command,
      status: 'running',
      seq: 0,
      createdAt: now,
      lastActivityAt: now,
      exitedAt: null,
      exitCode: null,
      outputBuffer: '',
      process: null,
    }

    // 解析 command
    const isShell = !opts.command || opts.command.trim() === ''
    let child: ChildProcess

    if (isShell) {
      // 启动交互式 shell
      const shell = process.platform === 'win32' ? 'cmd.exe' : '$SHELL'
      child = spawn(shell, [], {
        cwd: opts.cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color' },
      })
    } else {
      child = spawn('sh', ['-c', opts.command], {
        cwd: opts.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      })
    }

    entry.process = child

    // 收集输出
    const maxBuffer = 50 * 1024 // 50KB
    const appendOutput = (data: Buffer) => {
      const text = data.toString('utf8')
      entry.outputBuffer += text
      // 截断到最大长度
      if (entry.outputBuffer.length > maxBuffer) {
        entry.outputBuffer = entry.outputBuffer.slice(-maxBuffer)
      }
      entry.seq++
      entry.lastActivityAt = Date.now()
    }

    child.stdout?.on('data', appendOutput)
    child.stderr?.on('data', appendOutput)

    child.on('exit', (code) => {
      entry.status = 'exited'
      entry.exitedAt = Date.now()
      entry.exitCode = code
      entry.process = null
    })

    this.terminals.set(id, entry)

    // 等待一小段时间收集初始输出
    await new Promise(resolve => setTimeout(resolve, 500))

    return {
      terminalId: id,
      cwd: entry.cwd,
      command: entry.command,
      label: entry.label,
      status: entry.status,
      seq: entry.seq,
      createdAt: entry.createdAt,
      output: entry.outputBuffer.slice(-2000), // 返回最后 2KB
    }
  }

  read(opts: { terminalId: string; sinceSeq?: number }): any {
    const entry = this.terminals.get(opts.terminalId)
    if (!entry) {
      return { error: `Terminal ${opts.terminalId} not found` }
    }
    if (entry.status === 'exited') {
      return {
        terminalId: entry.terminalId,
        status: 'exited',
        exitCode: entry.exitCode,
        output: entry.outputBuffer.slice(-5000),
        seq: entry.seq,
      }
    }
    return {
      terminalId: entry.terminalId,
      status: entry.status,
      output: entry.outputBuffer.slice(-5000),
      seq: entry.seq,
    }
  }

  write(opts: { terminalId: string; chars: string }): any {
    const entry = this.terminals.get(opts.terminalId)
    if (!entry) {
      return { error: `Terminal ${opts.terminalId} not found` }
    }
    if (!entry.process) {
      return { error: `Terminal ${opts.terminalId} has no live process` }
    }
    entry.process.stdin?.write(opts.chars)
    entry.lastActivityAt = Date.now()
    return { ok: true }
  }

  close(opts: { terminalId: string }): any {
    const entry = this.terminals.get(opts.terminalId)
    if (!entry) {
      return { error: `Terminal ${opts.terminalId} not found` }
    }
    if (entry.process) {
      entry.process.kill('SIGTERM')
      // 强制终止（2秒后）
      setTimeout(() => {
        if (entry.process) {
          entry.process.kill('SIGKILL')
        }
      }, 2000)
    }
    return { ok: true, terminalId: opts.terminalId }
  }

  closeAll(): void {
    for (const [, entry] of this.terminals) {
      if (entry.process) {
        entry.process.kill('SIGTERM')
      }
    }
    this.terminals.clear()
  }
}

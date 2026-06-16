/**
 * MCP client — connects to MCP servers via stdio or SSE transport.
 *
 * Implements the JSON-RPC 2.0 based MCP protocol:
 * 1. Initialize handshake (capabilities exchange)
 * 2. Discover tools / resources / prompts
 * 3. Call tools, read resources, get prompts
 *
 * @see https://spec.modelcontextprotocol.io/specification/basic/
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  McpServerConfig,
  McpServerInfo,
  McpCapabilities,
  McpTool,
  McpResource,
  McpPrompt,
  McpToolCallResult,
  McpResourceReadResult,
  McpPromptResult,
  McpConnection,
} from './types.js'

// ─── Transport Layer ────────────────────────────────────────────────────

interface Transport extends EventEmitter {
  start(): Promise<void>
  send(request: JsonRpcRequest | JsonRpcNotification): void
  close(): void
}

/**
 * Stdio transport — spawns a child process and communicates via stdin/stdout.
 */
class StdioTransport extends EventEmitter implements Transport {
  private process: ChildProcess | null = null
  private buffer = ''

  constructor(private config: McpServerConfig) {
    super()
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = this.config.command!
      const args = this.config.args ?? []
      const env = { ...process.env, ...this.config.env }

      this.process = spawn(cmd, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })

      this.process.on('error', (err) => {
        this.emit('error', err)
        reject(err)
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString('utf-8')
        this.parseBuffer()
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        // Log stderr but don't treat as protocol data
        console.warn(`[mcp:stdio:${this.config.id}:stderr]`, data.toString('utf-8').trim())
      })

      this.process.on('close', (code) => {
        this.emit('close', code)
      })

      // Wait briefly for process to start
      setTimeout(resolve, 100)
    })
  }

  send(request: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.process?.stdin) {
      throw new Error(`MCP stdio transport not started for ${this.config.id}`)
    }
    const msg = JSON.stringify(request) + '\n'
    this.process.stdin.write(msg)
  }

  close(): void {
    this.process?.kill('SIGTERM')
    this.process = null
  }

  private parseBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop()! // keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const response = JSON.parse(trimmed) as JsonRpcResponse
        this.emit('message', response)
      } catch {
        // Skip non-JSON lines (server stdout noise)
      }
    }
  }
}

/**
 * SSE transport — connects to an HTTP server using Server-Sent Events + POST.
 */
class SseTransport extends EventEmitter implements Transport {
  private eventSource: any = null
  private endpoint = ''

  constructor(private config: McpServerConfig) {
    super()
  }

  async start(): Promise<void> {
    // Dynamically import EventSource (may not be available in Node < 22)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let EventSource: any
    try {
      const mod: any = await import('eventsource')
      EventSource = mod.EventSource ?? mod.default
    } catch {
      // Fallback: try global EventSource (available in browser/modern Node)
      EventSource = (globalThis as any).EventSource
    }
    if (!EventSource) {
      throw new Error('EventSource not available. Install "eventsource" package or use Node 22+.')
    }

    const url = this.config.url!
    const headers = this.config.headers ?? {}

    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(url, { headers })

      this.eventSource.onopen = () => {
        resolve()
      }

      this.eventSource.addEventListener('endpoint', (e: any) => {
        // Server tells us where to POST requests
        this.endpoint = e.data
      })

      this.eventSource.onmessage = (e: any) => {
        try {
          const response = JSON.parse(e.data) as JsonRpcResponse
          this.emit('message', response)
        } catch {
          // Skip malformed messages
        }
      }

      this.eventSource.onerror = (err: any) => {
        this.emit('error', err)
        reject(err)
      }
    })
  }

  send(request: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.endpoint) {
      throw new Error(`SSE endpoint not received from server ${this.config.id}`)
    }
    // POST the request to the server's message endpoint
    fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.config.headers ?? {}) },
      body: JSON.stringify(request),
    }).catch((err) => {
      this.emit('error', err)
    })
  }

  close(): void {
    this.eventSource?.close()
    this.eventSource = null
  }
}

// ─── MCP Client ─────────────────────────────────────────────────────────

let globalMsgId = 0

export class McpClient extends EventEmitter {
  private transport: Transport | null = null
  private pendingRequests = new Map<number | string, {
    resolve: (result: any) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()
  private connection: McpConnection

  constructor(config: McpServerConfig) {
    super()
    this.connection = {
      id: config.id,
      config,
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
    }
  }

  get id(): string { return this.connection.id }
  get status(): McpConnection['status'] { return this.connection.status }
  get tools(): McpTool[] { return this.connection.tools }
  get resources(): McpResource[] { return this.connection.resources }
  get prompts(): McpPrompt[] { return this.connection.prompts }
  get serverInfo(): McpServerInfo | undefined { return this.connection.serverInfo }
  get capabilities(): McpCapabilities | undefined { return this.connection.capabilities }
  get error(): string | undefined { return this.connection.error }
  getConnection(): McpConnection { return this.connection }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.connection.status = 'connecting'
    this.connection.error = undefined

    try {
      // Create transport
      if (this.connection.config.transport === 'stdio') {
        this.transport = new StdioTransport(this.connection.config)
      } else if (this.connection.config.transport === 'sse') {
        this.transport = new SseTransport(this.connection.config)
      } else {
        throw new Error(`Unknown transport: ${this.connection.config.transport}`)
      }

      // Listen for messages
      this.transport.on('message', (response: JsonRpcResponse) => {
        this.handleResponse(response)
      })

      this.transport.on('error', (err: Error) => {
        this.connection.status = 'error'
        this.connection.error = err.message
        this.emit('error', err)
      })

      this.transport.on('close', (code: number | null) => {
        this.connection.status = 'disconnected'
        this.emit('disconnected', code)
      })

      // Start transport
      await this.transport.start()

      // ─── MCP Initialize handshake ────────────────────────────────
      const initResult = await this.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: 'remu-agent',
          version: '0.1.0',
        },
      })

      this.connection.serverInfo = initResult?.serverInfo
      this.connection.capabilities = initResult?.capabilities

      // Send initialized notification
      this.notify('notifications/initialized', {})

      // ─── Discover capabilities ───────────────────────────────────
      const discoveryPromises: Promise<any>[] = []

      if (initResult?.capabilities?.tools) {
        discoveryPromises.push(
          this.listTools().then((tools) => { this.connection.tools = tools })
            .catch((e) => console.warn(`[mcp:${this.id}] listTools failed:`, e.message))
        )
      }

      if (initResult?.capabilities?.resources) {
        discoveryPromises.push(
          this.listResources().then((resources) => { this.connection.resources = resources })
            .catch((e) => console.warn(`[mcp:${this.id}] listResources failed:`, e.message))
        )
      }

      if (initResult?.capabilities?.prompts) {
        discoveryPromises.push(
          this.listPrompts().then((prompts) => { this.connection.prompts = prompts })
            .catch((e) => console.warn(`[mcp:${this.id}] listPrompts failed:`, e.message))
        )
      }

      await Promise.all(discoveryPromises)

      this.connection.status = 'connected'
      this.emit('connected', this.connection)
    } catch (e: any) {
      this.connection.status = 'error'
      this.connection.error = e.message
      this.emit('error', e)
      throw e
    }
  }

  async disconnect(): Promise<void> {
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    this.transport?.close()
    this.transport = null
    this.connection.status = 'disconnected'
  }

  // ─── Tool operations ──────────────────────────────────────────────

  async listTools(): Promise<McpTool[]> {
    const result = await this.request('tools/list', {})
    return result?.tools ?? []
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<McpToolCallResult> {
    return this.request('tools/call', { name, arguments: args })
  }

  // ─── Resource operations ──────────────────────────────────────────

  async listResources(): Promise<McpResource[]> {
    const result = await this.request('resources/list', {})
    return result?.resources ?? []
  }

  async readResource(uri: string): Promise<McpResourceReadResult> {
    return this.request('resources/read', { uri })
  }

  // ─── Prompt operations ────────────────────────────────────────────

  async listPrompts(): Promise<McpPrompt[]> {
    const result = await this.request('prompts/list', {})
    return result?.prompts ?? []
  }

  async getPrompt(name: string, args: Record<string, string> = {}): Promise<McpPromptResult> {
    return this.request('prompts/get', { name, arguments: args })
  }

  // ─── JSON-RPC transport ───────────────────────────────────────────

  private request(method: string, params: Record<string, any>, timeoutMs = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++globalMsgId
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`MCP request timed out: ${method} (id=${id})`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timer })
      this.transport?.send(request)
    })
  }

  private notify(method: string, params: Record<string, any>): void {
    const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params }
    this.transport?.send(notification)
  }

  private handleResponse(response: JsonRpcResponse): void {
    if (response.id != null) {
      const pending = this.pendingRequests.get(response.id)
      if (!pending) return

      clearTimeout(pending.timer)
      this.pendingRequests.delete(response.id)

      if (response.error) {
        pending.reject(new Error(`MCP error [${response.error.code}]: ${response.error.message}`))
      } else {
        pending.resolve(response.result)
      }
    }
  }
}

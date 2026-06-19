// @ts-nocheck
/**
 * MCP Registry — manages MCP server connections.
 *
 * Reads server configs from config.json (mcpServers key) and provides:
 * - Auto-start on Agent init
 * - Tool discovery across all connected servers
 * - Tool invocation by server-prefixed name (e.g., "fs.readFile")
 * - Lifecycle management (connect/disconnect/reconnect)
 */

import type { McpServerConfig, McpConnection, McpTool } from './types'
import { McpClient } from './client'
import { config } from '../config'

// ─── Registry ───────────────────────────────────────────────────────────

class McpRegistry {
  private clients = new Map<string, McpClient>()

  /** Load server configs from config.json and optionally auto-start them */
  async initialize(): Promise<void> {
    const servers = this.loadConfigs()
    console.log(`[mcp] Found ${servers.length} server config(s)`)

    for (const serverConfig of servers) {
      if (serverConfig.autoStart !== false) {
        try {
          await this.connect(serverConfig)
          console.log(`[mcp] Connected to ${serverConfig.id} (${serverConfig.name})`)
        } catch (e: any) {
          console.warn(`[mcp] Failed to connect to ${serverConfig.id}:`, e.message)
        }
      }
    }
  }

  /** Load MCP server configs from config.json */
  private loadConfigs(): McpServerConfig[] {
    try {
      const mcpConfig = (config as any).config?.mcpServers
      if (!mcpConfig || typeof mcpConfig !== 'object') return []
      return Object.entries(mcpConfig).map(([id, cfg]: [string, any]) => ({
        id,
        name: cfg.name ?? id,
        transport: cfg.transport ?? 'stdio',
        command: cfg.command,
        args: cfg.args,
        env: cfg.env,
        url: cfg.url,
        headers: cfg.headers,
        autoStart: cfg.autoStart ?? true,
      }))
    } catch {
      return []
    }
  }

  /** Connect to a specific MCP server */
  async connect(serverConfig: McpServerConfig): Promise<McpClient> {
    // Disconnect existing client for this id
    await this.disconnect(serverConfig.id)

    const client = new McpClient(serverConfig)
    this.clients.set(serverConfig.id, client)
    await client.connect()
    return client
  }

  /** Disconnect a specific server */
  async disconnect(id: string): Promise<void> {
    const client = this.clients.get(id)
    if (client) {
      await client.disconnect()
      this.clients.delete(id)
    }
  }

  /** Disconnect all servers */
  async disconnectAll(): Promise<void> {
    for (const [id] of this.clients) {
      await this.disconnect(id)
    }
  }

  /** Get all connections (for status display) */
  getConnections(): McpConnection[] {
    return [...this.clients.values()].map(c => c.getConnection())
  }

  /** Get a specific client by server id */
  getClient(id: string): McpClient | undefined {
    return this.clients.get(id)
  }

  // ─── Tool Discovery ───────────────────────────────────────────────

  /** Get all tools from all connected servers, prefixed with server id */
  getAllTools(): Array<McpTool & { serverId: string }> {
    const allTools: Array<McpTool & { serverId: string }> = []
    for (const [serverId, client] of this.clients) {
      if (client.status !== 'connected') continue
      for (const tool of client.tools) {
        allTools.push({ ...tool, serverId })
      }
    }
    return allTools
  }

  /** Call a tool by its prefixed name (e.g., "fs.readFile") */
  async callTool(prefixedName: string, args: Record<string, any> = {}): Promise<any> {
    // Parse server-prefixed tool name: "serverId.toolName"
    const dotIndex = prefixedName.indexOf('.')
    let serverId: string
    let toolName: string

    if (dotIndex > 0) {
      serverId = prefixedName.slice(0, dotIndex)
      toolName = prefixedName.slice(dotIndex + 1)
    } else {
      // Try to find the tool across all servers
      for (const [sid, client] of this.clients) {
        if (client.status !== 'connected') continue
        if (client.tools.some(t => t.name === prefixedName)) {
          serverId = sid
          toolName = prefixedName
          break
        }
      }
      if (!serverId!) {
        throw new Error(`MCP tool not found: ${prefixedName}`)
      }
    }

    const client = this.clients.get(serverId!)
    if (!client || client.status !== 'connected') {
      throw new Error(`MCP server not connected: ${serverId}`)
    }

    return client.callTool(toolName!, args)
  }

  // ─── Resource Discovery ───────────────────────────────────────────

  /** Get all resources from all connected servers */
  getAllResources() {
    const all: Array<{ uri: string; name: string; description?: string; mimeType?: string; serverId: string }> = []
    for (const [serverId, client] of this.clients) {
      if (client.status !== 'connected') continue
      for (const res of client.resources) {
        all.push({ ...res, serverId })
      }
    }
    return all
  }

  /** Read a resource by URI */
  async readResource(uri: string, serverId?: string): Promise<any> {
    if (serverId) {
      const client = this.clients.get(serverId)
      if (!client || client.status !== 'connected') {
        throw new Error(`MCP server not connected: ${serverId}`)
      }
      return client.readResource(uri)
    }
    // Try all servers
    for (const [, client] of this.clients) {
      if (client.status !== 'connected') continue
      try {
        return await client.readResource(uri)
      } catch {
        // Not found on this server, try next
      }
    }
    throw new Error(`Resource not found: ${uri}`)
  }
}

// Singleton instance
export const mcpRegistry = new McpRegistry()

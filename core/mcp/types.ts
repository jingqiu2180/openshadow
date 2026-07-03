/**
 * MCP (Model Context Protocol) type definitions.
 * Based on the JSON-RPC 2.0 protocol used by MCP servers.
 *
 * @see https://spec.modelcontextprotocol.io/specification/basic/
 */

// ─── JSON-RPC 2.0 ──────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, any>
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, any>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

// ─── MCP Protocol Types ────────────────────────────────────────────────

export interface McpServerInfo {
  name: string
  version: string
}

export interface McpCapabilities {
  tools?: { listChanged?: boolean }
  resources?: { subscribe?: boolean; listChanged?: boolean }
  prompts?: { listChanged?: boolean }
  logging?: {}
}

export interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface McpResourceTemplate {
  uriTemplate: string
  name: string
  description?: string
  mimeType?: string
}

export interface McpPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
    resource?: { uri: string; mimeType?: string; text?: string }
  }>
  isError?: boolean
}

export interface McpResourceReadResult {
  contents: Array<{
    uri: string
    mimeType?: string
    text?: string
    blob?: string
  }>
}

export interface McpPromptResult {
  description?: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: {
      type: 'text' | 'image' | 'resource'
      text?: string
      data?: string
      mimeType?: string
    }
  }>
}

// ─── MCP Server Configuration ──────────────────────────────────────────

export type McpTransportType = 'stdio' | 'sse'

export interface McpServerConfig {
  /** Unique identifier for this MCP server */
  id: string
  /** Display name */
  name: string
  /** Transport type */
  transport: McpTransportType
  /** Command to start the server (stdio transport) */
  command?: string
  /** Arguments for the command (stdio transport) */
  args?: string[]
  /** Environment variables (stdio transport) */
  env?: Record<string, string>
  /** URL for SSE transport */
  url?: string
  /** Headers for SSE transport */
  headers?: Record<string, string>
  /** Whether to auto-start this server on Agent init */
  autoStart?: boolean
}

// ─── MCP Client State ──────────────────────────────────────────────────

export interface McpConnection {
  id: string
  config: McpServerConfig
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  serverInfo?: McpServerInfo
  capabilities?: McpCapabilities
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  error?: string
}

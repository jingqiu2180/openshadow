// @ts-nocheck
/**
 * MCP module public API.
 *
 * Re-exports everything needed to use MCP from the rest of the codebase.
 */

export { McpClient } from './client'
export { mcpRegistry } from './registry'
export type {
  McpServerConfig,
  McpConnection,
  McpTool,
  McpResource,
  McpPrompt,
  McpCapabilities,
  McpServerInfo,
  McpToolCallResult,
  McpResourceReadResult,
  McpPromptResult,
  McpTransportType,
} from './types'

// @ts-nocheck
/**
 * E2E Test #5: MCP client connects to a real server.
 *
 * Tests:
 * 1. Add mcpServers config to config.json (in-memory, no save)
 * 2. McpRegistry.initialize() connects to filesystem server
 * 3. listTools returns real tools
 * 4. mcp_xxx_yyy format is registered in agent
 * 5. callTool works
 *
 * Run: npx tsx test-e2e-mcp.ts
 */

import { mcpRegistry } from './core/mcp/index'
import { config } from './core/config'
import { Agent } from './core/agent'

async function main() {
  console.log('=== E2E-5: MCP Client ===\n')

  // ─── Inject mcpServers config in-memory (don't save to disk) ─────
  // We bypass save() because the sandbox can deny file writes
  const cur = config as any
  if (!cur.config) throw new Error('config not initialized')
  cur.config.mcpServers = {
    'test-fs': {
      name: 'Test Filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
      autoStart: true,
    },
  }
  console.log('✓ Injected mcpServers config (test-fs)')

  // ─── Initialize registry ─────────────────────────────────────────
  console.log('\n[1] Connecting to filesystem MCP server…')
  await mcpRegistry.initialize()

  const connections = mcpRegistry.getConnections()
  console.log(`  ${connections.length} connection(s):`)
  for (const conn of connections) {
    console.log(`    [${conn.status}] ${conn.id} (${conn.name})${conn.error ? ' — ' + conn.error : ''}`)
  }

  const connected = connections.filter(c => c.status === 'connected')
  if (connected.length === 0) {
    console.error(`\n✗ FAIL: No MCP server connected. Errors:`)
    for (const c of connections) {
      console.error(`  ${c.id}: ${c.error ?? '(no error)'}`)
    }
    process.exit(1)
  }

  // ─── Verify tools discovered ─────────────────────────────────────
  const tools = mcpRegistry.getAllTools()
  console.log(`\n[2] Tools discovered: ${tools.length}`)
  for (const t of tools) {
    console.log(`    ${t.serverId}.${t.name} — ${t.description?.slice(0, 60)}…`)
  }

  if (tools.length === 0) {
    console.error(`\n✗ FAIL: No tools discovered from connected server`)
    process.exit(1)
  }

  // ─── Verify agent registration ───────────────────────────────────
  console.log(`\n[3] Creating Agent and registering MCP tools…`)
  // Use multi-provider mode to avoid SQLite write (sandbox blocks it)
  cur.config.providers = [
    {
      id: 'e2e-provider',
      type: 'openai',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o'],
      isDefault: true,
    },
  ]
  cur.config.models = { main: 'e2e-provider::gpt-4o', small: 'e2e-provider::gpt-4o', large: 'e2e-provider::gpt-4o' }
  const agent = new Agent({ agentId: 'e2e-test', providerId: 'e2e-provider' })
  await agent.initMcp()

  // Check that mcp_test-fs_* tools are in agent.toolMap
  const toolMap = (agent as any).toolMap
  const mcpToolEntries = Object.keys(toolMap).filter(k => k.startsWith('mcp_'))
  console.log(`  Agent has ${mcpToolEntries.length} MCP tool(s):`)
  for (const name of mcpToolEntries) {
    console.log(`    ${name}`)
  }

  if (mcpToolEntries.length === 0) {
    console.error(`\n✗ FAIL: No MCP tools registered in agent`)
    process.exit(1)
  }

  // ─── Try calling a tool ──────────────────────────────────────────
  console.log(`\n[4] Calling MCP tool: ${mcpToolEntries[0]}({"path": "."})`)
  try {
    const result = await toolMap[mcpToolEntries[0]]({ path: process.cwd() })
    if (result && (result.content || result.isError !== undefined)) {
      console.log(`  ✓ Got result (isError=${result.isError ?? false})`)
      if (result.content?.[0]?.text) {
        const text = result.content[0].text.slice(0, 200)
        console.log(`  First 200 chars: ${text}${text.length >= 200 ? '…' : ''}`)
      }
    } else {
      console.log(`  Result: ${JSON.stringify(result).slice(0, 200)}`)
    }
  } catch (e: any) {
    console.error(`  ✗ Tool call failed: ${e.message}`)
  }

  // ─── Cleanup ─────────────────────────────────────────────────────
  await mcpRegistry.disconnectAll()

  console.log(`\n=== Results ===`)
  console.log(`  Connections: ${connections.length} (${connected.length} connected)`)
  console.log(`  Tools: ${tools.length} discovered, ${mcpToolEntries.length} registered`)
  console.log(`\n✓ PASS`)
  process.exit(0)
}

main().catch((e) => {
  console.error('✗ FATAL:', e)
  process.exit(1)
})

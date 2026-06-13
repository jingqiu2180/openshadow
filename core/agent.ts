import OpenAI from 'openai'
import { loadPersonality } from './personality/loader.js'
import { buildSystemPrompt } from './personality/template.js'
import { getContextMemories, addMemory, getAgentConfig } from './memory/store.js'
import { PathGuard, createFileTools, createBashTools } from './tools/index.js'

export interface AgentOptions {
  agentId: string
  allowedPaths?: string[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  content: string
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
  }>
}

/**
 * Agent: core class that ties together memory, personality, and tools.
 * Uses OpenAI's function calling for tool execution.
 */
export class Agent {
  private readonly client: OpenAI
  private readonly systemPrompt: string
  private readonly tools: any[]
  private readonly toolMap: Record<string, any>
  private readonly guard: PathGuard

  constructor(options: AgentOptions) {
    const config = getAgentConfig(options.agentId)
    if (!config) {
      throw new Error(`Agent config not found: ${options.agentId}`)
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })

    const personality = loadPersonality()
    this.systemPrompt = buildSystemPrompt(personality)

    this.guard = new PathGuard(config.allowedPaths)
    const fileTools = createFileTools(this.guard)
    const bashTools = createBashTools(this.guard)

    // Convert tools to OpenAI function format
    this.tools = [
      this.createFunctionSpec('file_read', fileTools.file_read, {
        path: { type: 'string', description: 'Full path to the file' },
      }),
      this.createFunctionSpec('file_write', fileTools.file_write, {
        path: { type: 'string', description: 'Full path to the file' },
        content: { type: 'string', description: 'Content to write' },
      }),
      this.createFunctionSpec('file_list', fileTools.file_list, {
        path: { type: 'string', description: 'Directory path' },
      }),
      this.createFunctionSpec('bash', bashTools.bash, {
        command: { type: 'string', description: 'Bash command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)', optional: true },
      }),
    ]

    this.toolMap = {
      file_read: fileTools.file_read,
      file_write: fileTools.file_write,
      file_list: fileTools.file_list,
      bash: bashTools.bash,
    }
  }

  private createFunctionSpec(name: string, handler: any, params: any) {
    return {
      type: 'function' as const,
      function: {
        name,
        description: `Execute ${name} tool`,
        parameters: {
          type: 'object',
          properties: params,
          required: Object.keys(params).filter(k => !params[k]?.optional),
        },
      },
      handler,
    }
  }

  /**
   * Chat with the agent.
   * 1. Load context memories
   * 2. Build messages with system prompt
   * 3. Call OpenAI with tools
   * 4. Execute tools if needed
   * 5. Return final response
   */
  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    // Load relevant memories
    const memories = getContextMemories(20)
    const memoryContent = memories
      .map(m => `[${m.memory_type}] ${m.content}`)
      .join('\n')

    // Build messages
    const systemMsg: ChatMessage = {
      role: 'system',
      content: this.systemPrompt + '\n\n## 记忆\n' + memoryContent,
    }

    // Call model
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMsg, ...messages],
      tools: this.tools as any,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) {
      return { content: 'No response from model' }
    }

    // Handle tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolResults = await Promise.all(
        choice.message.tool_calls.map(async (tc: any) => {
          const handler = this.toolMap[tc.function.name]
          const args = JSON.parse(tc.function.arguments)
          const result = await handler(args)
          return { toolCallId: tc.id, name: tc.function.name, result }
        })
      )

      // Add tool results to messages and continue
      const toolMessages: ChatMessage[] = [
        choice.message as any,
        ...toolResults.map(tr => ({
          role: 'tool' as const,
          content: JSON.stringify(tr.result),
          tool_call_id: tr.toolCallId,
        })),
      ]

      // Second call to get final response
      const final = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [systemMsg, ...messages, ...toolMessages],
      })

      const finalContent = final.choices[0]?.message.content ?? 'No response'
      return { content: finalContent }
    }

    return { content: choice.message.content ?? 'No response' }
  }

  /**
   * Remember something from this conversation.
   */
  remember(content: string, importance: number = 1): void {
    addMemory(content, importance, 'conversation')
  }
}
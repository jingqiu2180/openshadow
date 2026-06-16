import OpenAI from 'openai'
import { config } from './config.js'
import { createClient as createProviderClient, pickModel } from './providers/index.js'
import type { Session } from './session-store.js'

const COMPACT_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary.

Use this EXACT format:

## Goal
[What is the user trying to accomplish?]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]

Keep each section concise. Preserve exact file paths, function names, and error messages.`

const UPDATE_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Output the updated summary in the same structured format.`

export class SessionCompactor {
  private readonly client: OpenAI
  private readonly model: string

  constructor() {
    const provider = config.getActiveProvider('small')
    if (provider) {
      this.client = createProviderClient(provider)
      this.model = pickModel(provider)
    } else {
      const agent = config.getAgent()
      this.client = new OpenAI({ apiKey: agent.apiKey, baseURL: agent.baseUrl })
      this.model = agent.model
    }
  }

  async compact(session: Session): Promise<string> {
    const messages = session.messages
    if (messages.length < 10) {
      return messages.map(m => m.content).join('\n')
    }

    const halfPoint = Math.floor(messages.length * 0.6)
    const olderMessages = messages.slice(0, halfPoint)

    const olderText = olderMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')

    let prompt: string
    if (session.summary) {
      prompt = `<previous-summary>\n${session.summary}\n</previous-summary>\n\n${olderText}\n\n${UPDATE_PROMPT}`
    } else {
      prompt = `${olderText}\n\n${COMPACT_PROMPT}`
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      })

      return response.choices[0]?.message?.content ?? session.summary ?? ''
    } catch (e: any) {
      console.warn('[compactor] LLM summarization failed, using simple truncation:', e.message)
      return olderMessages
        .slice(-5)
        .map(m => m.content)
        .join('\n')
    }
  }
}

export function createSessionCompactor(): SessionCompactor {
  return new SessionCompactor()
}

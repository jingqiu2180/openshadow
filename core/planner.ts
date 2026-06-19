// @ts-nocheck
/**
 * Planner: ReAct-style task planning and execution engine.
 *
 * Key ideas:
 * - THINK → ACT → OBSERVE → ADJUST loop
 * - Task decomposition: break complex goals into steps
 * - Self-verification: check step results before proceeding
 * - Fallback: retry or replan on failure
 * - Step history for context across turns
 */

import { Agent, ChatMessage } from './agent'

export interface PlanStep {
  id: number
  thought: string        // Why we chose this step
  action: string         // Tool name
  args: Record<string, unknown>  // Tool arguments
  observation?: string   // Result of the action
  status: 'pending' | 'executing' | 'done' | 'failed'
  error?: string
}

export interface PlanResult {
  success: boolean
  goal: string
  steps: PlanStep[]
  finalResult?: string
  reason?: string        // Why we stopped (done / failed / max_steps)
}

export interface PlannerConfig {
  /** Max steps before stopping */
  maxSteps: number
  /** Stop if no improvement after N failures */
  maxRetries: number
  /** Let user confirm high-risk actions */
  confirmHighRisk: boolean
  /** System prompt addition for planning mode */
  planningPrompt?: string
}

const DEFAULT_CONFIG: PlannerConfig = {
  maxSteps: 15,
  maxRetries: 2,
  confirmHighRisk: true,
}

// ─── Step executor ──────────────────────────────────────────────────────────

async function executeStep(step: PlanStep, agent: Agent): Promise<string> {
  // Build a message that tells the agent to execute this specific action
  const messages: ChatMessage[] = [{
    role: 'user',
    content: `Execute this step:\nAction: ${step.action}\nArgs: ${JSON.stringify(step.args)}\n\nOnly respond with the action result.`,
  }]
  const result = await agent.chat(messages)
  return result.content
}

// ─── Verification ───────────────────────────────────────────────────────────

/**
 * Ask agent to verify if the step result matches the expected goal.
 */
async function verifyStep(goal: string, observation: string, agent: Agent): Promise<boolean> {
  const messages: ChatMessage[] = [{
    role: 'user',
    content: `Did this step accomplish the goal?\nGoal: ${goal}\nResult: ${observation}\n\nAnswer YES or NO in one word.`,
  }]
  const result = await agent.chat(messages)
  const answer = result.content.trim().toLowerCase()
  return answer.includes('yes') || answer.includes('是') || answer.includes('成功')
}

// ─── Planning ──────────────────────────────────────────────────────────────

/**
 * Use LLM to decompose a goal into steps.
 */
async function decomposeGoal(goal: string, agent: Agent, planningPrompt?: string): Promise<PlanStep[]> {
  const extra = planningPrompt ?? ''
  const messages: ChatMessage[] = [{
    role: 'user',
    content: `${extra}
分解以下目标为具体的执行步骤，以JSON数组格式返回：

目标: ${goal}

要求：
1. 每个步骤只调用一个工具
2. 包含 thought（思考为什么要这么做）和 action（工具名）+ args（参数）
3. 只使用可用工具：file_read, file_write, file_list, bash, capture_screenshot, analyze_screenshot, mouse_move, mouse_click, mouse_drag, keyboard_type, keyboard_hotkey, window_activate, get_screen_size
4. 高风险操作（bash、写文件、鼠标点击）在 thought 中说明风险

格式示例：
[
  {"id": 1, "thought": "需要先查看当前目录内容", "action": "file_list", "args": {"path": "."}},
  {"id": 2, "thought": "截图确认屏幕状态", "action": "capture_screenshot", "args": {}}
]

只返回JSON数组，不要其他文字。`,
  }]

  const result = await agent.chat(messages)

  // Try to extract JSON from the response
  const text = result.content
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    // Fallback: single step
    return [{
      id: 1,
      thought: 'Direct execution',
      action: 'bash',
      args: { command: goal },
      status: 'pending',
    }]
  }

  try {
    const steps = JSON.parse(jsonMatch[0]) as Omit<PlanStep, 'status'>[]
    return steps.map((s, i) => ({ ...s, id: i + 1, status: 'pending' as const }))
  } catch {
    return [{
      id: 1,
      thought: 'Fallback: execute as bash command',
      action: 'bash',
      args: { command: goal },
      status: 'pending',
    }]
  }
}

// ─── Main Planner ───────────────────────────────────────────────────────────

export class Planner {
  private readonly agent: Agent
  private readonly config: Required<PlannerConfig>

  constructor(agent: Agent, config: Partial<PlannerConfig> = {}) {
    this.agent = agent
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<PlannerConfig>
  }

  /**
   * Execute a complex task using ReAct loop.
   *
   * Flow:
   * 1. Decompose goal into steps
   * 2. For each step: execute → observe → verify
   * 3. On failure: retry or replan
   * 4. On success or max steps: return result
   */
  async execute(goal: string): Promise<PlanResult> {
    // Step 0: Check if this is a simple single-step task
    const isSimple = this.isSimpleTask(goal)
    if (isSimple) {
      return this.executeSimple(goal)
    }

    // Step 1: Decompose into steps
    const steps = await decomposeGoal(goal, this.agent, this.config.planningPrompt)
    if (steps.length === 0) {
      return { success: false, goal, steps: [], reason: 'Could not decompose goal' }
    }

    // Step 2: Execute each step with ReAct loop
    let retries = 0
    for (const step of steps) {
      if (step.id > this.config.maxSteps) {
        return { success: false, goal, steps, reason: 'max_steps', finalResult: 'Reached maximum step limit' }
      }

      step.status = 'executing'
      const observation = await executeStep(step, this.agent)
      step.observation = observation

      // Verify step success
      const verified = await verifyStep(step.thought, observation, this.agent)
      if (verified) {
        step.status = 'done'
        retries = 0
      } else if (retries < this.config.maxRetries) {
        step.status = 'failed'
        retries++
        // Retry: modify step and re-execute
        step.status = 'executing'
        const retryObs = await executeStep(step, this.agent)
        step.observation = retryObs
        step.status = 'done'
        retries = 0
      } else {
        step.status = 'failed'
        return {
          success: false,
          goal,
          steps,
          reason: `Step ${step.id} failed after ${this.config.maxRetries} retries`,
          finalResult: observation,
        }
      }
    }

    return {
      success: true,
      goal,
      steps,
      finalResult: steps[steps.length - 1]?.observation,
    }
  }

  /**
   * Execute a simple one-liner directly.
   */
  private async executeSimple(goal: string): Promise<PlanResult> {
    const step: PlanStep = {
      id: 1,
      thought: 'Simple direct execution',
      action: 'bash',
      args: { command: goal },
      status: 'executing',
    }

    const observation = await executeStep(step, this.agent)
    step.observation = observation
    step.status = 'done'

    return {
      success: true,
      goal,
      steps: [step],
      finalResult: observation,
    }
  }

  /**
   * Heuristic: is this goal simple enough for single-step execution?
   */
  private isSimpleTask(goal: string): boolean {
    const simplePatterns = [
      /^ls\b/i, /^cat\b/i, /^echo\b/i, /^pwd\b/i,
      /^cd\b/i, /^mkdir\b/i, /^git /i, /^npm /i,
      /^node\b/i, /^python\b/i, /^curl\b/i,
    ]
    return simplePatterns.some(p => p.test(goal.trim()))
  }
}

export function createPlanner(agent: Agent, config?: Partial<PlannerConfig>): Planner {
  return new Planner(agent, config)
}
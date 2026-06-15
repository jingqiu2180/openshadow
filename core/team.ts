/**
 * Multi-Agent Team: orchestrate multiple agents working together.
 *
 * Architecture:
 * - TeamLeader: assigns tasks to agents
 * - WorkerAgent: handles specific domain tasks
 * - SharedMemory: agents share context
 * - MessageBus: agents communicate via messages
 */

import { Agent, ChatMessage } from './agent.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkerConfig {
  name: string
  domain: string          // e.g. 'coding', 'writing', 'research'
  personality?: string    // personality template name
  tools?: string[]         // allowed tool names (empty = all)
  instruction?: string     // additional system instruction
}

export interface Task {
  id: string
  description: string
  assignedTo?: string
  status: 'pending' | 'assigned' | 'in_progress' | 'done' | 'failed'
  result?: unknown
  error?: string
  priority: 0 | 1 | 2     // 0=low, 1=normal, 2=high
  createdAt: number
  completedAt?: number
}

export interface TeamMessage {
  from: string
  to: string | 'broadcast'
  content: string
  taskId?: string
  timestamp: number
}

export interface WorkerState {
  name: string
  domain: string
  status: 'idle' | 'busy' | 'offline'
  currentTask?: string
  tasksCompleted: number
  lastActive: number
}

// ─── Shared Memory ──────────────────────────────────────────────────────────

export class SharedMemory {
  private data = new Map<string, unknown>()

  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined
  }

  has(key: string): boolean {
    return this.data.has(key)
  }

  delete(key: string): void {
    this.data.delete(key)
  }

  keys(): string[] {
    return [...this.data.keys()]
  }

  clear(): void {
    this.data.clear()
  }

  /** Export snapshot for agent context */
  snapshot(): string {
    const entries = [...this.data.entries()].map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v).slice(0, 200)
      return `[${k}]: ${val}`
    })
    return entries.length > 0 ? entries.join('\n') : '(no shared memory)'
  }
}

// ─── Message Bus ────────────────────────────────────────────────────────────

export class MessageBus {
  private messages: TeamMessage[] = []
  private readonly maxHistory = 100

  send(msg: Omit<TeamMessage, 'timestamp'>): void {
    this.messages.push({
      ...msg,
      timestamp: Date.now(),
    })
    if (this.messages.length > this.maxHistory) {
      this.messages = this.messages.slice(-this.maxHistory)
    }
  }

  receive(to: string): TeamMessage[] {
    return this.messages
      .filter(m => m.to === to || m.to === 'broadcast')
      .slice(-20)
  }

  getHistory(): TeamMessage[] {
    return [...this.messages]
  }
}

// ─── Worker Agent ───────────────────────────────────────────────────────────

export class WorkerAgent {
  readonly name: string
  readonly domain: string
  private agent: Agent
  private instruction: string
  private state: WorkerState

  constructor(agent: Agent, config: WorkerConfig) {
    this.agent = agent
    this.name = config.name
    this.domain = config.domain
    this.instruction = config.instruction ?? `You are ${config.name}, a ${config.domain} specialist.`
    this.state = {
      name: config.name,
      domain: config.domain,
      status: 'idle',
      tasksCompleted: 0,
      lastActive: Date.now(),
    }
  }

  async chat(message: string, context?: { sharedMemory?: SharedMemory; task?: Task }): Promise<string> {
    this.state.status = 'busy'
    this.state.lastActive = Date.now()

    let systemAddition = `\n\n[Role] ${this.instruction}\n`
    if (context?.sharedMemory) {
      systemAddition += `\n[Shared Memory]\n${context.sharedMemory.snapshot()}\n`
    }
    if (context?.task) {
      systemAddition += `\n[Current Task] ${context.task.description}\n`
    }

    const msgs: ChatMessage[] = [
      { role: 'system', content: systemAddition },
      { role: 'user', content: message },
    ]

    const result = await this.agent.chat(msgs)
    this.state.status = 'idle'
    return result.content
  }

  getState(): WorkerState {
    return { ...this.state }
  }

  setBusy(taskId: string): void {
    this.state.status = 'busy'
    this.state.currentTask = taskId
  }

  setIdle(): void {
    this.state.status = 'idle'
    this.state.currentTask = undefined
    this.state.tasksCompleted++
  }
}

// ─── Team Leader ────────────────────────────────────────────────────────────

export class TeamLeader {
  readonly name: string
  private workers = new Map<string, WorkerAgent>()
  private tasks = new Map<string, Task>()
  private sharedMemory: SharedMemory
  private messageBus: MessageBus
  private leaderAgent: Agent
  private taskCounter = 0

  constructor(leaderAgent: Agent, name = 'TeamLeader') {
    this.name = name
    this.leaderAgent = leaderAgent
    this.sharedMemory = new SharedMemory()
    this.messageBus = new MessageBus()
  }

  /**
   * Register a worker agent with the team.
   */
  registerWorker(agent: Agent, config: WorkerConfig): void {
    const worker = new WorkerAgent(agent, config)
    this.workers.set(config.name, worker)
  }

  /**
   * Create a new task.
   */
  createTask(description: string, priority: 0 | 1 | 2 = 1): Task {
    const id = `task-${++this.taskCounter}-${Date.now().toString(36)}`
    const task: Task = {
      id,
      description,
      status: 'pending',
      priority,
      createdAt: Date.now(),
    }
    this.tasks.set(id, task)
    return task
  }

  /**
   * Assign a task to a specific worker.
   */
  assignTask(taskId: string, workerName: string): boolean {
    const task = this.tasks.get(taskId)
    const worker = this.workers.get(workerName)
    if (!task || !worker) return false

    task.assignedTo = workerName
    task.status = 'assigned'
    worker.setBusy(taskId)

    this.messageBus.send({
      from: this.name,
      to: workerName,
      content: `New task: ${task.description}`,
      taskId,
    })

    return true
  }

  /**
   * Assign task to the best-fit worker based on domain.
   */
  autoAssign(taskId: string): string | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    // Simple domain matching: find worker with matching domain keyword
    const keywords = task.description.toLowerCase().split(/\s+/)
    let bestWorker: string | null = null
    let bestScore = 0

    for (const [name, worker] of this.workers) {
      if (worker.getState().status === 'busy') continue
      const score = keywords.filter(k =>
        worker.domain.toLowerCase().includes(k) ||
        k.includes(worker.domain.toLowerCase())
      ).length
      if (score > bestScore) {
        bestScore = score
        bestWorker = name
      }
    }

    if (bestWorker) {
      this.assignTask(taskId, bestWorker)
    }
    return bestWorker
  }

  /**
   * Execute a task with a worker and return result.
   */
  async executeTask(taskId: string): Promise<Task> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const workerName = task.assignedTo ?? this.autoAssign(taskId)
    if (!workerName) {
      task.status = 'failed'
      task.error = 'No available worker'
      return task
    }

    const worker = this.workers.get(workerName)!
    task.status = 'in_progress'

    try {
      const result = await worker.chat(task.description, {
        sharedMemory: this.sharedMemory,
        task,
      })

      task.result = result
      task.status = 'done'
      task.completedAt = Date.now()
      worker.setIdle()

      // Share result with team
      this.sharedMemory.set(`task:${taskId}`, result)
      this.messageBus.send({
        from: workerName,
        to: 'broadcast',
        content: `Task complete: ${task.description}\nResult: ${result}`,
        taskId,
      })
    } catch (e: any) {
      task.status = 'failed'
      task.error = e.message
      worker.setIdle()
    }

    return task
  }

  /**
   * Execute multiple tasks in parallel.
   */
  async executeTasks(taskIds: string[]): Promise<Task[]> {
    return Promise.all(taskIds.map(id => this.executeTask(id)))
  }

  /**
   * Have the leader agent think about task distribution.
   */
  async planTasks(userGoal: string): Promise<Task[]> {
    const taskDescriptions = await this.leaderAgent.chat([{
      role: 'user',
      content: `分析以下目标，将其分解成可并行的子任务，每个任务分配给最适合的 Worker。

Workers available: ${[...this.workers.entries()].map(([n, w]) => `${n} (${w.domain})`).join(', ')}

Goal: ${userGoal}

Output format (JSON array):
[
  { "description": "task description", "worker": "worker-name", "priority": 1 }
]

只返回JSON数组，不要其他文字。`,
    }])

    // Parse JSON tasks
    const jsonMatch = taskDescriptions.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ description: string; worker: string; priority?: number }>
      const created: Task[] = []

      for (const item of parsed) {
        const task = this.createTask(item.description, (item.priority ?? 1) as 0 | 1 | 2)
        if (item.worker) this.assignTask(task.id, item.worker)
        created.push(task)
      }

      return created
    } catch {
      return []
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────

  getWorkerStates(): Record<string, WorkerState> {
    return Object.fromEntries([...this.workers.entries()].map(([n, w]) => [n, w.getState()]))
  }

  getPendingTasks(): Task[] {
    return [...this.tasks.values()].filter(t => t.status === 'pending' || t.status === 'assigned')
  }

  getCompletedTasks(): Task[] {
    return [...this.tasks.values()].filter(t => t.status === 'done' || t.status === 'failed')
  }

  getSharedMemory(): SharedMemory {
    return this.sharedMemory
  }

  getMessageBus(): MessageBus {
    return this.messageBus
  }
}

export function createTeam(leaderAgent: Agent): TeamLeader {
  return new TeamLeader(leaderAgent)
}
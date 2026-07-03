/**
 * CoderAgent: autonomous coding agent.
 *
 * Capabilities:
 * - Read requirements (from file or natural language)
 * - Write code files based on specs
 * - Run tests and analyze results
 * - Self-fix bugs based on error output
 * - Git commit & push workflow
 *
 * Architecture:
 * CoderAgent uses a ReAct loop internally:
 * READ spec → WRITE code → TEST → FIX (if broken) → repeat
 */

import { Agent } from './agent.js'
import { createPlanner } from './planner.js'
import { existsSync } from 'fs'
import { join } from 'path'

export interface CoderOptions {
  /** Workspace root directory for code operations */
  workspaceRoot: string
  /** Project language/framework hint */
  language?: 'typescript' | 'python' | 'go' | 'rust'
  agent: Agent
}

export interface CoderResult {
  success: boolean
  filesCreated: string[]
  filesModified: string[]
  testResults?: { name: string; passed: boolean; output: string }[]
  commitHash?: string
  error?: string
}

/**
 * The CoderAgent can autonomously:
 * 1. Understand a requirement
 * 2. Create/modify files
 * 3. Run tests
 * 4. Fix issues found
 * 5. Commit the changes
 */
export class CoderAgent {
  private readonly agent: Agent
  private readonly planner: ReturnType<typeof createPlanner>
  private readonly workspaceRoot: string
  private readonly language: string

  constructor(options: CoderOptions) {
    this.agent = options.agent
    this.planner = createPlanner(options.agent, { maxSteps: 20, maxRetries: 3 })
    this.workspaceRoot = options.workspaceRoot
    this.language = options.language ?? 'typescript'
  }

  /**
   * Implement a feature from a natural language description.
   * Uses plan_execute for step-by-step implementation.
   */
  async implement(spec: string): Promise<CoderResult> {
    const filesCreated: string[] = []
    const filesModified: string[] = []

    // Step 1: Understand the requirement
    // Step 2: Create implementation plan and execute
    const planResult = await this.planner.execute(
      `实现功能：${spec}\n\n工作目录：${this.workspaceRoot}\n编程语言：${this.language}\n\n要求：\n1. 创建所有必要的代码文件\n2. 编写测试用例\n3. 确保代码可编译/可运行\n4. 每次创建文件后说明进度`
    )

    // Collect results
    for (const step of planResult.steps) {
      if (step.action === 'file_write' && step.args?.path) {
        const path = step.args.path as string
        if (existsSync(path)) {
          if (!filesCreated.includes(path)) filesModified.push(path)
        } else {
          filesCreated.push(path)
        }
      }
    }

    return {
      success: planResult.success,
      filesCreated,
      filesModified,
      error: planResult.reason && !planResult.success ? planResult.reason : undefined,
    }
  }

  /**
   * Run tests in the workspace and analyze results.
   */
  async runTests(pattern?: string): Promise<{ name: string; passed: boolean; output: string }[]> {
    const testCmd = this.language === 'typescript'
      ? `cd ${this.workspaceRoot} && npm test${pattern ? ` -- --grep "${pattern}"` : ''}`
      : `cd ${this.workspaceRoot} && python -m pytest${pattern ? ` -k "${pattern}"` : ''}`

    const result = await this.agent.chat([{
      role: 'user',
      content: `在目录 ${this.workspaceRoot} 中运行测试。\n\n命令：${testCmd}\n\n执行测试并报告结果。`,
    }])

    // Parse test results from output (simplified)
    const passed = result.content.includes('✓') || result.content.includes('passed') || result.content.includes('PASS')
    const failed = result.content.includes('✗') || result.content.includes('failed') || result.content.includes('FAIL')

    return [{
      name: pattern ?? 'all tests',
      passed: passed && !failed,
      output: result.content.slice(0, 2000),
    }]
  }

  /**
   * Check if code compiles without errors.
   */
  async checkCompile(): Promise<{ success: boolean; errors: string[] }> {
    const buildCmd = this.language === 'typescript'
      ? `cd ${this.workspaceRoot} && npm run build 2>&1`
      : `cd ${this.workspaceRoot} && go build ./... 2>&1`

    const result = await this.agent.chat([{
      role: 'user',
      content: `检查代码是否可以编译。\n\n命令：${buildCmd}\n\n只返回编译是否成功，以及具体的错误信息（如果有）。`,
    }])

    const hasErrors = result.content.includes('error TS') || result.content.includes('error:')
    const errorLines = result.content
      .split('\n')
      .filter(l => l.includes('error TS') || l.includes('Error:') || l.includes('error:'))
      .slice(0, 10)

    return { success: !hasErrors, errors: errorLines }
  }

  /**
   * Fix compilation errors or test failures.
   * Takes the error output and applies fixes.
   */
  async fixIssues(errorOutput: string): Promise<{ success: boolean; fixed: string[]; remaining: string[] }> {
    const fixPrompt = `分析以下错误信息，在 ${this.workspaceRoot} 中修复它们。\n\n错误：\n${errorOutput}\n\n请：\n1. 分析每个错误的根本原因\n2. 修改相关文件修复错误\n3. 列出你修改了哪些文件\n\n只返回修复的文件列表和简要说明。`

    const result = await this.agent.chat([{ role: 'user', content: fixPrompt }])
    const fixedFiles: string[] = []
    const remaining: string[] = []

    // Extract file paths from response (simple heuristic)
    const filePathPattern = /[\w\-\./]+\.(ts|js|py|go|rs|tsx|jsx)/g
    let match
    while ((match = filePathPattern.exec(result.content)) !== null) {
      const path = join(this.workspaceRoot, match[0])
      if (existsSync(path) && !fixedFiles.includes(match[0])) {
        fixedFiles.push(match[0])
      }
    }

    // Re-check compile
    const recheck = await this.checkCompile()
    if (!recheck.success) {
      remaining.push(...recheck.errors)
    }

    return { success: recheck.success, fixed: fixedFiles, remaining }
  }

  /**
   * Git commit and push changes.
   */
  async gitCommit(message: string): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    const steps = [
      { action: 'bash', args: { command: `cd ${this.workspaceRoot} && git add -A`, cwd: this.workspaceRoot } },
      { action: 'bash', args: { command: `cd ${this.workspaceRoot} && git commit -m "${message.replace(/"/g, '\\"')}"`, cwd: this.workspaceRoot } },
      { action: 'bash', args: { command: `cd ${this.workspaceRoot} && git push 2>&1`, cwd: this.workspaceRoot } },
    ]

    const results: string[] = []
    for (const step of steps) {
      const r = await this.agent.chat([{
        role: 'user',
        content: `执行命令：${step.args.command}\n\n只返回命令输出，不要其他文字。`,
      }])
      results.push(r.content)
      if (r.content.includes('error') || r.content.includes('fatal')) {
        return { success: false, error: r.content.slice(0, 500) }
      }
    }

    // Extract commit hash
    const hashMatch = results[1]?.match(/[[0-9a-f]{7,}]/)
    return { success: true, commitHash: hashMatch ? hashMatch[0] : undefined }
  }

  /**
   * Full workflow: implement → test → fix → commit.
   * This is the main end-to-end flow.
   */
  async fullWorkflow(spec: string, commitMessage: string): Promise<CoderResult> {
    // 1. Implement
    const impl = await this.implement(spec)
    if (!impl.success) {
      return { ...impl, success: false }
    }

    // 2. Check compilation
    const compile = await this.checkCompile()
    if (!compile.success) {
      // 3. Fix issues
      const fix = await this.fixIssues(compile.errors.join('\n'))
      if (!fix.success) {
        return { ...impl, ...fix, success: false }
      }
    }

    // 4. Run tests
    const testResults = await this.runTests()

    // 5. Commit
    const git = await this.gitCommit(commitMessage)

    return {
      ...impl,
      testResults,
      commitHash: git.commitHash,
      error: git.error,
    }
  }
}

export function createCoderAgent(options: CoderOptions): CoderAgent {
  return new CoderAgent(options)
}
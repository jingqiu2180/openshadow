/**
 * Subagent 工具（对齐 openhanako）
 * 支持 agent/access/model 参数，集成 SubagentThreadStore/SubagentRunStore
 */
import { SubagentThreadStore } from './subagent-thread-store.js'
import { SubagentRunStore } from './subagent-run-store.js'

export function createSubagentTool(deps) {
  const threadStore = new SubagentThreadStore()
  const runStore = new SubagentRunStore()
  const activeBySession = new Map()
  const MAX_PER_SESSION = deps.maxPerSession || 10
  const MAX_GLOBAL = deps.maxGlobal || 20

  function getActive(sp) { return activeBySession.get(sp) || 0 }
  function incActive(sp) {
    activeBySession.set(sp, getActive(sp) + 1)
  }
  function decActive(sp) {
    const n = getActive(sp) - 1
    if (n <= 0) activeBySession.delete(sp)
    else activeBySession.set(sp, n)
  }

  return {
    subagent: {
      description:
        'Create a continuable subagent instance for a delegated task. Returns immediately with threadId. ' +
        'Use agent parameter to target a specific agent, or agent="?" to list agents. ' +
        'Use access="read" for research/review tasks (read-only); access="write" for execution/edits.',
      parameters: {
        task: { type: 'string', description: 'Complete instructions for the subagent. Include all needed context.' },
        agent: { type: 'string', description: 'Target agent id. Omit for current agent; pass "?" to list agents.', optional: true },
        access: { type: 'string', description: 'Permission tier: "read" (read-only) or "write" (can edit). Omit to inherit.', optional: true },
        model: { type: 'string', description: 'Optional model override (provider/id).', optional: true },
        label: { type: 'string', description: 'Optional display label.', optional: true },
      },
      execute: async function(args) {
        // discovery 模式
        if (args.agent === '?' || args.agent === 'list') {
          const mgr = deps.getAgentManager ? deps.getAgentManager() : null
          if (!mgr) return { content: [{ type: 'text', text: 'No agent manager available.' }] }
          const agents = mgr.listAgents()
          if (!agents.length) return { content: [{ type: 'text', text: 'No agents available.' }] }
          const lines = agents.map(function(a) { return '- ' + a.agentId + (a.agentId === mgr.getActiveAgentId() ? ' [active]' : '') })
          return { content: [{ type: 'text', text: lines.join('\n') }] }
        }

        const sessionPath = 'default'
        if (getActive(sessionPath) >= MAX_PER_SESSION) {
          return { content: [{ type: 'text', text: 'Too many active subagents for this session.' }] }
        }
        if (getActive('__global__') >= MAX_GLOBAL) {
          return { content: [{ type: 'text', text: 'Global subagent limit reached.' }] }
        }

        // access 权限检查
        if (args.access === 'write') {
          const perm = deps.getSessionPermission ? deps.getSessionPermission() : null
          if (perm === 'read_only') {
            return { content: [{ type: 'text', text: 'access="write" requires operate mode. Current session is read-only.' }] }
          }
        }

        // 解析 target agent
        let targetAgentId = null
        if (args.agent) {
          const mgr = deps.getAgentManager ? deps.getAgentManager() : null
          if (mgr) {
            const meta = mgr.getAgentMeta(args.agent)
            if (meta) {
              targetAgentId = meta.agentId
            } else {
              return { content: [{ type: 'text', text: 'Agent "' + args.agent + '" not found. Use agent="?" to list agents.' }] }
            }
          }
        }

        // 创建 thread
        const threadId = 'thread-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        threadStore.upsert(threadId, {
          kind: 'direct',
          status: 'open',
          parentSessionPath: sessionPath,
          agentId: targetAgentId,
          access: (args.access === 'read' || args.access === 'write') ? args.access : null,
          label: args.label || null,
        })

        incActive(sessionPath)
        incActive('__global__')

        // 后台执行
        const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
        runStore.register(runId, {
          threadId: threadId,
          threadKind: 'direct',
          parentSessionPath: sessionPath,
          label: args.label || null,
          access: (args.access === 'read' || args.access === 'write') ? args.access : null,
          agentId: targetAgentId,
        })

        // 根据 access 选择 chat 函数
        const chatFn = (args.access === 'read' && deps.createReadOnlyChat)
          ? deps.createReadOnlyChat()
          : deps.chat

        chatFn([{ role: 'user', content: args.task }])
          .then(function(result) {
            runStore.resolve(runId, { summary: result.content.slice(0, 500) })
            decActive(sessionPath)
            decActive('__global__')
          })
          .catch(function(err) {
            runStore.fail(runId, { error: err.message })
            decActive(sessionPath)
            decActive('__global__')
          })

        return {
          content: [{ type: 'text', text: 'Subagent started: threadId=' + threadId + (targetAgentId ? ', agent=' + targetAgentId : '') + (args.access ? ', access=' + args.access : '') }],
          details: { threadId: threadId, runId: runId },
        }
      },
    },

    subagent_reply: {
      description: 'Send a follow-up message to an existing subagent thread.',
      parameters: {
        threadId: { type: 'string', description: 'Thread ID returned by subagent.' },
        task: { type: 'string', description: 'Follow-up instructions.' },
      },
      execute: async function(args) {
        const thread = threadStore.get(args.threadId)
        if (!thread) {
          return { content: [{ type: 'text', text: 'Thread ' + args.threadId + ' not found.' }] }
        }

        const chatFn = (thread.access === 'read' && deps.createReadOnlyChat)
          ? deps.createReadOnlyChat()
          : deps.chat
        const result = await chatFn([{ role: 'user', content: args.task }])
        threadStore.upsert(args.threadId, { lastRunAt: new Date().toISOString() })
        return { content: [{ type: 'text', text: result.content }] }
      },
    },

    subagent_close: {
      description: 'Close a subagent thread.',
      parameters: {
        threadId: { type: 'string', description: 'Thread ID to close.' },
      },
      execute: async function(args) {
        const ok = threadStore.close(args.threadId)
        return {
          content: [{ type: 'text', text: ok ? 'Thread ' + args.threadId + ' closed.' : 'Thread ' + args.threadId + ' not found.' }],
        }
      },
    },

    subagent_status: {
      description: 'Check subagent thread status.',
      parameters: {
        threadId: { type: 'string', description: 'Thread ID to check.', optional: true },
      },
      execute: async function(args) {
        if (args.threadId) {
          const thread = threadStore.get(args.threadId)
          if (!thread) return { content: [{ type: 'text', text: 'Thread ' + args.threadId + ' not found.' }] }
          return {
            content: [{ type: 'text', text: 'Thread ' + args.threadId + ':\n' + JSON.stringify(thread, null, 2) }],
          }
        }
        const all = threadStore.listAll()
        return { content: [{ type: 'text', text: 'Active threads (' + all.length + '):\n' + all.map(function(t) { return '- ' + t.threadId + ': ' + (t.label || t.agentId || 'default') }).join('\n') }] }
      },
    },
  }
}

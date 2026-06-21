// @ts-nocheck
/**
 * current-status-tool.ts — 查询当前运行环境状态
 *
 * 对标 openhanako 的 current_status 工具（STANDARD 分类）。
 * 渐进式状态查询：先用 action=list 发现可用 key，再用 action=get 获取指定状态。
 * 当前实现：time、agent、model、session_folders 四个 provider。
 * 后续补全：appearance、ui_context、session_files、bridge_context、subagents。
 */

import { Type, StringEnum } from '../../lib/pi-sdk/index.js'

const DAY_BOUNDARY_HOUR = 4

function resolveTimezone(raw: string | null | undefined): string {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const candidate = typeof raw === 'string' && raw.trim() ? raw.trim() : fallback
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return fallback
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(
    parts
      .filter((part: any) => part.type !== 'literal')
      .map((part: any) => [part.type, part.value])
  )
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalDateTime(parts: Record<string, string>): string {
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

function getUtcOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const value = parts.find((part: any) => part.type === 'timeZoneName')?.value || 'GMT'
  if (value === 'GMT') return '+00:00'
  return value.replace(/^GMT/, '')
}

function getLogicalDate(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone)
  let year = Number(parts.year)
  let month = Number(parts.month)
  let day = Number(parts.day)

  if (Number(parts.hour) < DAY_BOUNDARY_HOUR) {
    const previous = new Date(Date.UTC(year, month - 1, day))
    previous.setUTCDate(previous.getUTCDate() - 1)
    year = previous.getUTCFullYear()
    month = previous.getUTCMonth() + 1
    day = previous.getUTCDate()
  }

  return `${year}-${pad2(month)}-${pad2(day)}`
}

interface Provider {
  key: string
  description: string
  get: (opts: { sessionPath: string | null; ctx: any; signal: any }) => Promise<any>
}

function provider(key: string, description: string, get: Provider['get']): Provider {
  return { key, description, get }
}

export function createCurrentStatusTool(deps: Record<string, any> = {}) {
  const getNow = () => {
    const value = deps.now?.()
    return value instanceof Date ? value : new Date()
  }

  const getTimezone = () => resolveTimezone(deps.getTimezone?.())

  const getStatusModel = (sessionPath: string | null, ctx: any) => (
    ctx?.model
    || (sessionPath ? deps.getSessionModel?.(sessionPath) : null)
    || deps.getCurrentModel?.()
    || null
  )

  const providers: Provider[] = [
    provider(
      'time',
      'Current real time, configured timezone, local datetime, and UTC offset.',
      async () => {
        const now = getNow()
        const timeZone = getTimezone()
        return {
          time: {
            iso: now.toISOString(),
            timezone: timeZone,
            localDateTime: formatLocalDateTime(zonedParts(now, timeZone)),
            utcOffset: getUtcOffset(now, timeZone),
          },
        }
      }
    ),
    provider(
      'logical_date',
      'Logical date. The day starts at 04:00 in the configured timezone.',
      async () => {
        const now = getNow()
        const timeZone = getTimezone()
        return {
          logical_date: {
            date: getLogicalDate(now, timeZone),
            timezone: timeZone,
            dayBoundaryHour: DAY_BOUNDARY_HOUR,
          },
        }
      }
    ),
    provider(
      'agent',
      'Current agent identity: stable id and display name.',
      async (_opts) => {
        const agent = deps.getAgent?.()
        return {
          agent: agent
            ? {
                id: agent.id || null,
                name: agent.agentName || agent.config?.agent?.name || agent.id || null,
              }
            : { id: null, name: null }
        }
      }
    ),
    provider(
      'model',
      'Current session model when available; otherwise the current selected chat model.',
      async ({ sessionPath, ctx }) => ({
        model: (() => {
          const m = getStatusModel(sessionPath, ctx)
          if (!m) return { id: null, provider: null, name: null }
          return {
            id: m.id || null,
            provider: m.provider || null,
            name: m.name || m.id || null,
          }
        })(),
      })
    ),
    provider(
      'session_folders',
      'Current session folder scope: cwd, workspace folders, authorized folders, and sandbox folders.',
      async ({ sessionPath }) => {
        const scope = typeof deps.getSessionFolderScope === 'function'
          ? deps.getSessionFolderScope(sessionPath)
          : null
        const s = scope && typeof scope === 'object' ? scope : {}
        return {
          session_folders: {
            sessionPath: s.sessionPath || sessionPath || null,
            cwd: s.cwd || null,
            workspaceFolders: Array.isArray(s.workspaceFolders) ? s.workspaceFolders : [],
            authorizedFolders: Array.isArray(s.authorizedFolders) ? s.authorizedFolders : [],
            sandboxFolders: Array.isArray(s.sandboxFolders) ? s.sandboxFolders : [],
          },
        }
      }
    ),
  ]

  const registry = new Map(providers.map((p) => [p.key, p]))

  return {
    name: 'current_status',
    description: 'Lightweight current-environment status (time, agent, model, session_folders, etc.). Use action=list to discover available keys, then action=get with a specific key.',
    parameters: Type.Object({
      action: StringEnum(['list', 'get'], {
        description: 'list returns available status keys; get returns one status key value.',
      }),
      key: Type.Optional(Type.String({
        description: 'Status key to fetch when action=get. Common keys: time, logical_date, agent, model, session_folders.',
      })),
    }),
    execute: async (_toolCallId: any, params: Record<string, any> = {}, _signal: any, _onUpdate: any, ctx: any) => {
      const action = params.action || 'list'
      if (action === 'list') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              available: [...registry.values()].map((p) => ({
                key: p.key,
                description: p.description,
              })),
              usage: 'Call action=list to discover keys, then action=get with key=<key_name>.',
            }, null, 2)
          }],
        }
      }

      const key = typeof params.key === 'string' ? params.key.trim() : ''
      if (!key) {
        return {
          content: [{ type: 'text' as const, text: 'current_status get requires a key. Call action=list to see available keys.' }],
        }
      }

      const item = registry.get(key)
      if (!item) {
        return {
          content: [{
            type: 'text' as const,
            text: `Unknown status key: ${key}. Call action=list to see available keys.`
          }],
        }
      }

      const sessionPath = ctx?.sessionPath || deps.getSessionPath?.() || null
      const payload = await item.get({ sessionPath, ctx, signal: _signal })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
      }
    },
  }
}

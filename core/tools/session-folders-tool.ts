/**
 * session-folders-tool.ts — 管理当前会话的授权文件夹范围
 *
 * 对标 openhanako 的 session_folders 工具（STANDARD 分类）。
 * 支持 action=list（列出当前文件夹范围）。
 * add/remove 需要动态修改 PathGuard，当前暂不支持。
 */

import { Type, StringEnum } from '../../lib/pi-sdk/index.js'

export function createSessionFoldersTool(deps: Record<string, any> = {}) {
  return {
    name: 'session_folders',
    description: 'List the current session\'s authorized sandbox folders (cwd, workspace folders, authorized folders, sandbox roots). add/remove are not yet supported.',
    parameters: Type.Object({
      action: StringEnum(['list', 'add', 'remove'], {
        description: 'list returns the current folder scope. add/remove are not yet supported.',
      }),
      folder: Type.Optional(Type.String({
        description: 'Absolute or resolvable folder path for add/remove (not yet supported).',
      })),
    }),
    execute: async (_toolCallId: any, params: Record<string, any> = {}, _signal: any, _onUpdate: any, ctx: any) => {
      const sessionPath = ctx?.sessionPath || deps.getSessionPath?.() || null

      const action = params.action || 'list'
      if (action === 'list') {
        const scope = typeof deps.getSessionFolderScope === 'function'
          ? deps.getSessionFolderScope(sessionPath)
          : null
        const s = scope && typeof scope === 'object' ? scope : {}
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              session_folders: {
                sessionPath: s.sessionPath || sessionPath || null,
                cwd: s.cwd || null,
                workspaceFolders: Array.isArray(s.workspaceFolders) ? s.workspaceFolders : [],
                authorizedFolders: Array.isArray(s.authorizedFolders) ? s.authorizedFolders : [],
                sandboxFolders: Array.isArray(s.sandboxFolders) ? s.sandboxFolders : [],
              },
            }, null, 2)
          }],
        }
      }

      // add/remove not yet supported
      return {
        content: [{
          type: 'text' as const,
          text: `session_folders ${action} is not yet supported. Only action=list is currently available.`
        }],
      }
    },
  }
}

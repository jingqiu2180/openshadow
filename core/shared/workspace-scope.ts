import path from 'path'

function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return path.resolve(trimmed)
}

export function normalizeWorkspaceScope(
  { primaryCwd, workspaceFolders }: { primaryCwd?: string; workspaceFolders?: string[] } = {}
): { primaryCwd: string | null; workspaceFolders: string[] } {
  const primary = cleanPath(primaryCwd)
  const seen = new Set(primary ? [primary] : [])
  const folders: string[] = []

  for (const raw of Array.isArray(workspaceFolders) ? workspaceFolders : []) {
    const folder = cleanPath(raw)
    if (!folder || seen.has(folder)) continue
    seen.add(folder)
    folders.push(folder)
  }

  return { primaryCwd: primary, workspaceFolders: folders }
}

export function workspaceRootsForSandbox(
  primaryCwd: string | null | undefined,
  workspaceFolders: string[] = [],
  authorizedFolders: string[] = []
): string[] {
  const scope = normalizeSessionFolderScope({ primaryCwd: primaryCwd ?? undefined, workspaceFolders, authorizedFolders })
  return scope.sandboxFolders
}

export function normalizeSessionFolderScope(
  { primaryCwd, workspaceFolders, authorizedFolders }:
  { primaryCwd?: string; workspaceFolders?: string[]; authorizedFolders?: string[] } = {}
): { primaryCwd: string | null; workspaceFolders: string[]; authorizedFolders: string[]; sandboxFolders: string[] } {
  const workspaceScope = normalizeWorkspaceScope({ primaryCwd, workspaceFolders })
  const seen = new Set([workspaceScope.primaryCwd, ...workspaceScope.workspaceFolders].filter(Boolean))
  const authorized: string[] = []

  for (const raw of Array.isArray(authorizedFolders) ? authorizedFolders : []) {
    const folder = cleanPath(raw)
    if (!folder || seen.has(folder)) continue
    seen.add(folder)
    authorized.push(folder)
  }

  return {
    ...workspaceScope,
    authorizedFolders: authorized,
    sandboxFolders: [workspaceScope.primaryCwd, ...workspaceScope.workspaceFolders, ...authorized].filter(Boolean) as string[],
  }
}

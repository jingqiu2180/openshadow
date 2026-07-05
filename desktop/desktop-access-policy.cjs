// Desktop Access Policy — path sandbox for openshadow
// Controls which file paths renderer processes are allowed to access.
// Adapted from Lynn's desktop-access-policy.cjs

const path = require('path')
const fs = require('fs')

const CONFIG_PATH = process.env.OPENSHADOW_HOME
  ? path.join(process.env.OPENSHADOW_HOME, 'config.json')
  : path.join(process.env.APPDATA || process.env.HOME || '', '.openshadow', 'config.json')

function resolveCanonicalPath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) return null
  try {
    return path.resolve(rawPath.trim().replace(/^~(?=$|[\\/])/, require('os').homedir()))
  } catch {
    return null
  }
}

function isPathInsideRoot(canonicalPath, root) {
  if (!canonicalPath || !root) return false
  const normPath = canonicalPath.endsWith(path.sep) ? canonicalPath : canonicalPath + path.sep
  const normRoot = root.endsWith(path.sep) ? root : root + path.sep
  return normPath.startsWith(normRoot) || canonicalPath === root
}

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch {}
  return {}
}

function getWorkspaceRoots() {
  const cfg = readConfig()
  const roots = (cfg.security && cfg.security.workspaceRoots) || []
  const normalized = []
  const seen = new Set()
  for (const r of roots) {
    const canon = resolveCanonicalPath(r)
    if (canon && !seen.has(canon)) {
      seen.add(canon)
      normalized.push(canon)
    }
  }
  return normalized
}

// Per-WebContents file access grants (like Lynn's grantWebContentsAccess)
const fileAccessGrants = new Map()

function grantWebContentsAccess(target, rawPath, level = 'read') {
  const canonical = resolveCanonicalPath(rawPath)
  if (!canonical) return null

  // target can be webContents or BrowserWindow
  const webContents = target && target.send ? target.webContents || target : null
  if (!webContents || !webContents.id) return null

  let bucket = fileAccessGrants.get(webContents.id)
  if (!bucket) {
    bucket = { read: new Set(), write: new Set() }
    fileAccessGrants.set(webContents.id, bucket)
    webContents.once('destroyed', () => {
      fileAccessGrants.delete(webContents.id)
    })
  }

  bucket.read.add(canonical)
  if (level === 'write' || level === 'readwrite') bucket.write.add(canonical)
  return canonical
}

function canAccessPath(target, rawPath, mode = 'read') {
  const canonical = resolveCanonicalPath(rawPath)
  if (!canonical) return { allowed: false, canonical: null }

  // Check trusted workspace roots
  const roots = getWorkspaceRoots()
  const hasTrusted = roots.some(root => isPathInsideRoot(canonical, root))
  if (hasTrusted) return { allowed: true, canonical }

  // Check per-WebContents grants
  const webContents = target && target.send ? target.webContents || target : null
  if (webContents && webContents.id) {
    const bucket = fileAccessGrants.get(webContents.id)
    if (bucket) {
      const candidates = mode === 'write' ? [...bucket.write] : [...bucket.read, ...bucket.write]
      const hasGrant = candidates.some(root => isPathInsideRoot(canonical, root))
      if (hasGrant) return { allowed: true, canonical }
    }
  }

  return { allowed: false, canonical }
}

function canReadPath(target, rawPath) {
  return canAccessPath(target, rawPath, 'read').allowed
}

function canWritePath(target, rawPath) {
  return canAccessPath(target, rawPath, 'write').allowed
}

function isSetupComplete() {
  const cfg = readConfig()
  return !!(cfg.wizard && cfg.wizard.completed === true)
}

module.exports = {
  resolveCanonicalPath,
  isPathInsideRoot,
  readConfig,
  getWorkspaceRoots,
  grantWebContentsAccess,
  canReadPath,
  canWritePath,
  canAccessPath,
  isSetupComplete,
}

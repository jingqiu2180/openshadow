// desktop/bootstrap.cjs
// OpenShadow Desktop — Electron 启动入口
// 任务：
// 1. 捕获并记录启动错误（写到 tmpdir 诊断文件）
// 2. require 真正的 main 逻辑

const fs = require('fs')
const os = require('os')
const path = require('path')

let diagnosticsDir = path.join(os.tmpdir(), 'openshadow-desktop-launch')
let launchIntegrity = null

function serializeError(err) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
    }
  }
  return { message: String(err) }
}

function fallbackWriteDiagnostic(fileName, event, payload) {
  try {
    fs.mkdirSync(diagnosticsDir, { recursive: true })
    const filePath = path.join(diagnosticsDir, fileName)
    fs.writeFileSync(filePath, JSON.stringify({
      event: event,
      time: new Date().toISOString(),
      payload: payload,
    }, null, 2) + '\n', 'utf-8')
    return filePath
  } catch {
    return null
  }
}

function recordDiagnostic(event, payload) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return fallbackWriteDiagnostic('launch-' + stamp + '.json', event, payload)
}

// Try to load main
try {
  require('./main.bundle.cjs')
  launchIntegrity = { status: 'ok', loaded: 'main.bundle.cjs' }
} catch (err) {
  // Try the source CJS as fallback (e.g., in dev mode where vite hasn't built yet)
  try {
    require('./main.cjs')
    launchIntegrity = { status: 'ok', loaded: 'main.cjs' }
  } catch (innerErr) {
    const errSerialized = serializeError(err)
    const innerSerialized = serializeError(innerErr)
    recordDiagnostic('launch-failed', { primary: errSerialized, fallback: innerSerialized })
    console.error('[openshadow-bootstrap] Failed to load main:', err)
    console.error('[openshadow-bootstrap] Fallback to main.cjs also failed:', innerErr)
    process.exit(1)
  }
}

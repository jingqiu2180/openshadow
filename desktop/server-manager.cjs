// desktop/server-manager.cjs
// OpenShadow Server Process Manager
// 负责 spawn server 进程、监控心跳、崩溃重启、优雅关闭
// 参考 Lynn desktop/server-process.cjs

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const SERVER_HEARTBEAT_INTERVAL_MS = 10_000
const SERVER_HEARTBEAT_TIMEOUT_MS = 5000
const SERVER_HEARTBEAT_MAX_FAILURES = 3
const SERVER_STARTUP_TIMEOUT_MS = 90_000  // 对齐 server-readiness.cjs，Windows cold start 常超 60s

// 检查 PID 是否存活（不发送信号）
function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// 轮询 server-info.json 等待 server 就绪
function pollServerInfo(infoPath, { timeout = SERVER_STARTUP_TIMEOUT_MS, interval = 200, proc, logs } = {}) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    let exited = false

    function tailLogs(n) {
      if (!logs || logs.length === 0) return ''
      const tail = logs.slice(-n)
      return '\n[server stderr] ' + tail.join('').replace(/\n/g, '\n[server stderr] ')
    }

    if (proc) {
      proc.on('exit', (code, signal) => {
        exited = true
        const tail = tailLogs(20)
        reject(new Error(
          (signal ? `Server killed by signal ${signal}` : `Server exited with code ${code}`) + tail
        ))
      })
    }

    const check = () => {
      if (exited) return
      if (Date.now() > deadline) {
        const tail = tailLogs(20)
        reject(new Error('Server start timed out after ' + (timeout / 1000) + 's' + tail))
        return
      }
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
        if (info.pid && isPidAlive(info.pid)) {
          resolve(info)
        } else {
          setTimeout(check, interval)
        }
      } catch {
        setTimeout(check, interval)
      }
    }
    check()
  })
}

// 创建 Server Process Controller
function createServerManager(deps) {
  const {
    app,
    lynnHome,
    dirname,
    execPath,
    platform,
    env,
    resourcesPath,
    fetch,
    onServerReady = () => {},
    onServerCrashed = () => {},
    onServerRestarted = () => {},
    writeCrashLog = () => {},
  } = deps

  const state = {
    process: null,
    port: null,
    token: null,
    reusedPid: null,
    logs: [],
    startedAt: 0,
    restartAttempts: 0,
    heartbeatTimer: null,
    heartbeatFailures: 0,
    heartbeatChecking: false,
    heartbeatRestarting: false,
    isQuitting: false,
  }

  // 选择 server 启动方式
  function resolveServerLaunch() {
    const bundledServerDir = path.join(resourcesPath || '', 'server')
    const bundledExe = path.join(bundledServerDir, 'openshadow-server.exe')
    // extraResources: { from: "dist-server-bundle", to: "server-bundle" }
    const bundledEntry = path.join(resourcesPath || '', 'server-bundle', 'index.js')

    // Windows: 优先使用打包好的 EXE
    if (platform === 'win32' && fs.existsSync(bundledExe)) {
      return { mode: 'bundled', serverBin: bundledExe, serverArgs: [], env: {} }
    }

    // 有打包的 JS bundle：用 Electron 的 Node.js 运行（ELECTRON_RUN_AS_NODE=1）
    if (fs.existsSync(bundledEntry)) {
      return {
        mode: 'bundled',
        serverBin: execPath,
        serverArgs: [bundledEntry],
        env: { ELECTRON_RUN_AS_NODE: '1' },
      }
    }

    // 开发模式：用 Electron 的 Node
    const appRoot = path.join(dirname, '..')
    const bundledDevEntry = path.join(appRoot, 'dist-server-bundle', 'index.js')
    if (fs.existsSync(bundledDevEntry)) {
      return {
        mode: 'dev',
        serverBin: execPath,
        serverArgs: [bundledDevEntry],
        env: { ELECTRON_RUN_AS_NODE: '1' },
      }
    }

    //  fallback: 直接跑 server/index.js
    return {
      mode: 'dev',
      serverBin: execPath,
      serverArgs: [path.join(appRoot, 'server', 'index.js')],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    }
  }

  // 启动 server
  async function start() {
    const serverInfoPath = path.join(lynnHome || path.join(require('os').homedir(), '.openshadow'), 'server-info.json')

    // 1. 检查是否有已运行的 server
    let existingInfo = null
    try {
      existingInfo = JSON.parse(fs.readFileSync(serverInfoPath, 'utf-8'))
    } catch {}

    if (existingInfo && existingInfo.pid && isPidAlive(existingInfo.pid)) {
      // PID 存活，尝试 health check
      try {
        const res = await fetch(`http://127.0.0.1:${existingInfo.port}/api/health`, {
          headers: { Authorization: `Bearer ${existingInfo.token}` },
          signal: AbortSignal.timeout(2000),
        })
        if (res.ok) {
          console.log(`[server] Reusing existing server on port ${existingInfo.port}`)
          state.port = existingInfo.port
          state.token = existingInfo.token
          state.reusedPid = existingInfo.pid
          onServerReady({ port: state.port, token: state.token, reused: true })
          return
        }
      } catch {
        // health check failed, kill old server
        console.log(`[server] Old server (PID ${existingInfo.pid}) not responding, killing...`)
        try { process.kill(existingInfo.pid, 0) } catch {}
        try { fs.unlinkSync(serverInfoPath) } catch {}
      }
    }

    // 2. 启动新 server
    state.reusedPid = null
    state.logs.length = 0

    const shadowHome = lynnHome || path.join(require('os').homedir(), '.openshadow')
    const serverEnv = {
      ...env,
      OPENSHADOW_HOME: shadowHome,
      SHADOW_HOME: shadowHome,         // P0: server 端读的是 SHADOW_HOME，必须同步设置
    }

    const launch = resolveServerLaunch()
    const serverBin = launch.serverBin
    const serverArgs = launch.serverArgs
    Object.assign(serverEnv, launch.env)

    // 删除旧 server-info.json
    try { fs.unlinkSync(serverInfoPath) } catch {}

    console.log(`[server] Starting server: ${serverBin} ${serverArgs.join(' ')}`)
    console.log(`[server] SHADOW_HOME=${shadowHome}`)

    const proc = spawn(serverBin, serverArgs, {
      detached: true,
      windowsHide: true,
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    state.process = proc

    // 监听 spawn 本身失败（如 ENOENT）
    proc.on('error', (err) => {
      console.error(`[server] spawn error: ${err.message}`)
      state.logs.push('[stderr] spawn error: ' + err.message)
    })

    // 捕获 stdout/stderr
    proc.stdout?.on('data', (chunk) => {
      const text = chunk.toString()
      console.log(`[server] ${text.trim()}`)
      state.logs.push(text)
      if (state.logs.length > 500) state.logs.splice(0, state.logs.length - 500)
    })
    proc.stderr?.on('data', (chunk) => {
      const text = chunk.toString()
      console.error(`[server] ${text.trim()}`)
      state.logs.push('[stderr] ' + text)
      if (state.logs.length > 500) state.logs.splice(0, state.logs.length - 500)
    })

    // 等待 server ready（传入 logs 以便报错时附带诊断信息）
    const info = await pollServerInfo(serverInfoPath, {
      timeout: SERVER_STARTUP_TIMEOUT_MS,
      proc,
      logs: state.logs,
    })
    state.port = info.port
    state.token = info.token
    state.startedAt = Date.now()
    proc.unref()

    console.log(`[server] Server ready on port ${state.port}`)
    onServerReady({ port: state.port, token: state.token, reused: false })
  }

  // 监控 server 进程
  function monitor() {
    if (!state.process) return
    state.process.on('exit', async (code, signal) => {
      if (state.isQuitting) return
      if (state.heartbeatRestarting) return
      const reason = signal ? `signal ${signal}` : `code ${code}`
      console.error(`[server] Server exited unexpectedly (${reason})`)

      if (state.restartAttempts < 1) {
        state.restartAttempts++
        console.log('[server] Attempting auto-restart...')
        try {
          await start()
          console.log('[server] Server restarted successfully')
          monitor()
          onServerRestarted({ port: state.port, token: state.token })
        } catch (err) {
          console.error('[server] Server restart failed:', err.message)
          writeCrashLog(`Server restart failed: ${err.message}`)
          onServerCrashed(err)
        }
      } else {
        writeCrashLog(`Server crashed multiple times (${reason}), giving up`)
        onServerCrashed(new Error(`Server crashed: ${reason}`))
      }
    })
  }

  // 心跳检测
  async function checkHeartbeat() {
    if (state.isQuitting || state.heartbeatRestarting || state.heartbeatChecking) return
    if (!state.port || !state.token) return
    if (state.startedAt && Date.now() - state.startedAt < 4 * 60 * 1000) return

    state.heartbeatChecking = true
    try {
      const res = await fetch(`http://127.0.0.1:${state.port}/api/health`, {
        headers: { Authorization: `Bearer ${state.token}` },
        signal: AbortSignal.timeout(SERVER_HEARTBEAT_TIMEOUT_MS),
      })
      if (res.ok) {
        state.heartbeatFailures = 0
        return
      }
      state.heartbeatFailures++
    } catch {
      state.heartbeatFailures++
    } finally {
      state.heartbeatChecking = false
    }

    if (state.heartbeatFailures < SERVER_HEARTBEAT_MAX_FAILURES || state.heartbeatRestarting || state.isQuitting) return

    // 心跳失败多次，重启 server
    state.heartbeatRestarting = true
    console.warn('[server] Heartbeat failed multiple times, restarting...')
    try {
      state.heartbeatFailures = 0
      await start()
      monitor()
      onServerRestarted({ port: state.port, token: state.token })
      console.log('[server] Server heartbeat restart succeeded')
    } catch (err) {
      console.error('[server] Server heartbeat restart failed:', err?.message || err)
      writeCrashLog(`Server heartbeat restart failed: ${err?.message || err}`)
    } finally {
      state.heartbeatRestarting = false
    }
  }

  function startHeartbeat() {
    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = setInterval(() => {
      void checkHeartbeat()
    }, SERVER_HEARTBEAT_INTERVAL_MS)
    if (typeof state.heartbeatTimer.unref === 'function') {
      state.heartbeatTimer.unref()
    }
  }

  function stopHeartbeat() {
    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = null
    state.heartbeatFailures = 0
    state.heartbeatChecking = false
    state.heartbeatRestarting = false
  }

  // 优雅关闭 server
  async function shutdown() {
    stopHeartbeat()
    state.isQuitting = true

    if (state.process && !state.process.killed) {
      const proc = state.process
      console.log('[server] Shutting down server...')

      // 尝试 POST /api/shutdown
      if (state.port && state.token) {
        try {
          await fetch(`http://127.0.0.1:${state.port}/api/shutdown`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${state.token}` },
            signal: AbortSignal.timeout(5000),
          })
        } catch {}
      }

      // 等待进程退出
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try { if (!proc.killed) proc.kill() } catch {}
          resolve()
        }, 5000)
        proc.on('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      if (state.process === proc) state.process = null
      return true
    }

    if (state.reusedPid) {
      const pid = state.reusedPid
      console.log(`[server] Shutting down reused server (PID ${pid})...`)
      try {
        if (state.port && state.token) {
          await fetch(`http://127.0.0.1:${state.port}/api/shutdown`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${state.token}` },
            signal: AbortSignal.timeout(2000),
          })
        }
      } catch {
        try { process.kill(pid, 0) } catch {}
      }
      state.reusedPid = null
      return true
    }

    return false
  }

  return {
    start,
    monitor,
    startHeartbeat,
    stopHeartbeat,
    shutdown,
    getPort: () => state.port,
    getToken: () => state.token,
    getLogs: () => state.logs,
    hasServer: () => !!(state.process && !state.process.killed) || !!state.reusedPid,
    setIsQuitting: (v) => { state.isQuitting = v },
  }
}

module.exports = {
  createServerManager,
  isPidAlive,
  pollServerInfo,
}

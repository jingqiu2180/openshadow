// desktop/ipc-wrapper.cjs
// IPC 安全包装 —— 验证调用来源 + 结构化错误日志
// 用法：
//   const { setIpcSenderValidator, wrapIpcHandler, wrapIpcOn } = require('./ipc-wrapper.cjs')
//   setIpcSenderValidator((channel, event) => isTrustedAppWebContents(event?.sender, channel))
//   wrapIpcHandler('some-channel', (event, ...args) => { ... })

const { ipcMain } = require('electron')

let senderValidator = null

/**
 * 设置 IPC 发送者验证器。
 * 验证器应返回 true（允许）/ false（拒绝），抛出异常时视为拒绝。
 * @param {function(string, Electron.IpcMainInvokeEvent): boolean} validator
 */
function setIpcSenderValidator(validator) {
  senderValidator = typeof validator === 'function' ? validator : null
}

/**
 * 检查 IPC 发送者是否允许调用该 channel。
 * 如果没有设置验证器，默认允许所有调用。
 * @param {string} channel
 * @param {Electron.IpcMainInvokeEvent} event
 * @returns {boolean}
 */
function isSenderAllowed(channel, event) {
  if (!senderValidator) return true
  try {
    return senderValidator(channel, event) !== false
  } catch (err) {
    console.error(`[IPC][${channel}] sender validator failed: ${err?.message || err}`)
    return false
  }
}

/**
 * 包装 ipcMain.handle，添加：
 * 1. 发送者来源验证（拒绝不可信 WebContents 的调用）
 * 2. 结构化错误日志（traceId + channel 标识）
 * 3. 错误时返回 undefined（不抛出未捕获异常）
 *
 * 注意：此包装器 intentionally 返回 undefined 而非抛出错误，
 * 因为 renderer 侧通常没有错误处理来处理 rejected IPC promise。
 */
function wrapIpcHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isSenderAllowed(channel, event)) {
      console.warn(`[IPC][${channel}] rejected untrusted sender`)
      return undefined
    }
    try {
      return await handler(event, ...args)
    } catch (err) {
      const traceId = Math.random().toString(16).slice(2, 10)
      console.error(`[IPC][${channel}][${traceId}] ${err?.message || err}`)
      console.error(`[IPC][${traceId}] ${err?.stack || ''}`)
      return undefined
    }
  })
}

/**
 * 包装 ipcMain.on（fire-and-forget 类型 IPC），添加来源验证和错误日志。
 */
function wrapIpcOn(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isSenderAllowed(channel, event)) {
      console.warn(`[IPC][${channel}] rejected untrusted sender`)
      return
    }
    try {
      const result = handler(event, ...args)
      // 如果 handler 返回 promise，捕获异步错误
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          console.error(`[IPC][${channel}] async: ${err?.message || err}`)
        })
      }
    } catch (err) {
      console.error(`[IPC][${channel}] ${err?.message || err}`)
    }
  })
}

module.exports = { setIpcSenderValidator, wrapIpcHandler, wrapIpcOn }

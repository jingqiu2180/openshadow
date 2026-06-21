// @ts-nocheck
export { PathGuard } from './path-guard.js'
export { createFileTools } from './file.js'
export { createBashTools } from './bash.js'
export { captureScreenshot } from './screenshot.js'
export { isElectronScreenshotAvailable, captureScreenshotElectron } from './screenshot-electron.js'
export { analyzeScreenshot } from './vision.js'
export { mouseMove, mouseClick, mouseDrag, keyboardType, keyboardHotkey, windowActivate, getScreenSize } from './control.js'
export { browserNew, browserClose, browserNavigate, browserScreenshot, browserClick, browserType, browserPressKey, browserGetText, browserGetHtml, browserWaitForSelector } from './browser.js'
export { registerWebSearchTool } from './web-search.js'
export { registerWebFetchTool } from './web-fetch.js'
export { registerTodoTool } from './todo.js'
export { registerAutomationTool } from './automation.js'
export { execute as editTool } from './edit-tool.js'
export { grepTool } from './grep-tool.js'
export { findTool } from './find-tool.js'
export { lsTool } from './ls-tool.js'
export { execute as fileTool } from './file-tool.js'
export { execute as stageFilesTool } from './stage-files-tool.js'
export { execute as checkPendingTasksTool } from './check-pending-tasks-tool.js'

export function adaptPiTool(
  toolDef: { name: string; description: string; parameters: any; execute: Function },
  ctxBuilder?: (args: any) => any,
): (args: any) => Promise<any> {
  return async (args: any) => {
    const ctx = ctxBuilder ? ctxBuilder(args) : {}
    const result = await toolDef.execute(null, args, null, null, ctx)
    return result
  }
}


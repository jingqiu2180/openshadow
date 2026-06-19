// @ts-nocheck
export { PathGuard } from './path-guard'
export { createFileTools } from './file'
export { createBashTools } from './bash'
export { captureScreenshot } from './screenshot'
export { isElectronScreenshotAvailable, captureScreenshotElectron } from './screenshot-electron'
export { analyzeScreenshot } from './vision'
export { mouseMove, mouseClick, mouseDrag, keyboardType, keyboardHotkey, windowActivate, getScreenSize } from './control'
export { browserNew, browserClose, browserNavigate, browserScreenshot, browserClick, browserType, browserPressKey, browserGetText, browserGetHtml, browserWaitForSelector } from './browser'
export { registerWebSearchTool } from './web-search'
export { registerWebFetchTool } from './web-fetch'
export { registerTodoTool } from './todo'
export { registerAutomationTool } from './automation'
export { execute as editTool } from './edit-tool'
export { grepTool } from './grep-tool'
export { findTool } from './find-tool'
export { lsTool } from './ls-tool'
export { execute as fileTool } from './file-tool'
export { execute as stageFilesTool } from './stage-files-tool'
export { execute as checkPendingTasksTool } from './check-pending-tasks-tool'

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


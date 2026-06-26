// @ts-nocheck
/**
 * computer-use-tool.ts — 浏览器自动化工具
 * 移植自 openhanako/lib/tools/computer-use-tool.ts
 * 复用 openshadow 已有的 browser 工具实现真实功能
 */
import type { ToolRegistry } from '../tool-registry.js'
import { createToolSpec } from '../tool-registry.js'
import {
  browserNew,
  browserNavigate,
  browserScreenshot,
  browserClick,
  browserType,
  browserGetText,
} from './index.js'

let _currentBrowserId: string = 'default'

function getBrowserId(): string {
  if (_currentBrowserId === 'default') {
    const result: any = browserNew({ url: 'about:blank' })
    if (result.success) _currentBrowserId = result.id || 'default'
  }
  return _currentBrowserId
}

export function registerComputerUseTool(registry: ToolRegistry): void {
  // ─── computer_navigate ───
  registry.register(
    'computer_navigate',
    createToolSpec('computer_navigate', {
      description: 'Navigate the browser to a URL.',
      params: {
        url: { type: 'string', description: 'Target URL' },
      },
    }),
    async (args: any) => {
      const result = browserNavigate(getBrowserId(), args.url)
      return {
        content: [{ type: 'text', text: `Navigated to ${args.url}: ${result}` }],
      }
    }
  )

  // ─── computer_click ───
  registry.register(
    'computer_click',
    createToolSpec('computer_click', {
      description: 'Click an element on the page.',
      params: {
        selector: { type: 'string', description: 'CSS selector or text' },
      },
    }),
    async (args: any) => {
      const result = browserClick(getBrowserId(), args.selector)
      return {
        content: [{ type: 'text', text: `Clicked ${args.selector}: ${result}` }],
      }
    }
  )

  // ─── computer_type ───
  registry.register(
    'computer_type',
    createToolSpec('computer_type', {
      description: 'Type text into an input field.',
      params: {
        selector: { type: 'string', description: 'Input CSS selector' },
        text: { type: 'string', description: 'Text to type' },
      },
    }),
    async (args: any) => {
      const result = browserType(getBrowserId(), args.selector, args.text)
      return {
        content: [{ type: 'text', text: `Typed into ${args.selector}: ${result}` }],
      }
    }
  )

  // ─── computer_screenshot ───
  registry.register(
    'computer_screenshot',
    createToolSpec('computer_screenshot', {
      description: 'Take a screenshot of the current page.',
      params: {},
    }),
    async () => {
      const result: any = await browserScreenshot()
      return {
        content: [{ type: 'text', text: `Screenshot taken: ${result.base64 ? 'OK' : 'failed'}` }],
      }
    }
  )

  // ─── computer_extract ───
  registry.register(
    'computer_extract',
    createToolSpec('computer_extract', {
      description: 'Extract text content from the page.',
      params: {
        selector: { type: 'string', description: 'CSS selector (optional, omit for full page)' },
      },
    }),
    async (args: any) => {
      const result = browserGetText(getBrowserId(), args.selector || '')
      return {
        content: [{ type: 'text', text: result }],
      }
    }
  )
}

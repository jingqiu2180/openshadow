// @ts-nocheck
// computer-use-tools.ts — Computer Use 工具注册
// 为 Agent 注册 computer_take_snapshot、computer_execute_action 等工具
// 参考 openhanako 的工具注册模式

import { ToolRegistry, createToolSpec } from '../tool-registry';
import { Agent } from '../agent';

export function registerComputerUseTools(registry: ToolRegistry, agent: Agent): void {
  // 工具1：computer_take_snapshot — 获取屏幕快照（可交互元素列表）
  registry.register('computer_take_snapshot', createToolSpec(
    'computer_take_snapshot',
    {
      description: 'Take a snapshot of the current screen. Returns a list of interactive elements (buttons, text fields, etc.) with their bounds and text. Use this before performing actions on screen elements.',
      params: {},
    },
  ), async (_args: Record<string, unknown>) => {
    return await agent.computerTakeSnapshot();
  });

  // 工具2：computer_execute_action — 执行计算机动作
  registry.register('computer_execute_action', createToolSpec(
    'computer_execute_action',
    {
      description: 'Execute a computer action (click, type, press key, scroll, drag, launch app, etc.). You must call computer_take_snapshot first to get the elementId of the target element.',
      params: {
        action: {
          type: 'object',
          description: 'The action to execute. Supported types: click_element, double_click, click_point, type_text, press_key, scroll, drag, launch_app, take_snapshot, take_screenshot',
          properties: {
            type: { type: 'string', description: 'Action type' },
            elementId: { type: 'string', description: 'Element ID (for click_element, double_click, type_text)' },
            x: { type: 'number', description: 'X coordinate (for click_point)' },
            y: { type: 'number', description: 'Y coordinate (for click_point)' },
            text: { type: 'string', description: 'Text to type (for type_text)' },
            key: { type: 'string', description: 'Key to press (for press_key)' },
            direction: { type: 'string', description: 'Scroll direction: up, down, left, right (for scroll)' },
            amount: { type: 'number', description: 'Scroll amount (for scroll)' },
            path: { type: 'array', description: 'Drag path: array of {x, y} (for drag)' },
            appId: { type: 'string', description: 'App ID to launch (for launch_app)' },
          },
          required: ['type'],
        },
      },
    },
  ), async (args: Record<string, unknown>) => {
    return await agent.computerExecuteAction(args.action as any);
  });

  // 工具3：computer_screenshot — 截图（返回 base64 PNG）
  registry.register('computer_screenshot', createToolSpec(
    'computer_screenshot',
    {
      description: 'Take a screenshot of the current screen and return it as a base64-encoded PNG image. Use this to see what is currently on screen.',
      params: {},
    },
  ), async (_args: Record<string, unknown>) => {
    return await agent.computerScreenshot();
  });

  // 工具4：computer_release_lease — 释放计算机控制租约
  registry.register('computer_release_lease', createToolSpec(
    'computer_release_lease',
    {
      description: 'Release the computer control lease. Call this when you are done controlling the computer to allow other agents/sessions to take control.',
      params: {},
    },
  ), async (_args: Record<string, unknown>) => {
    return { released: agent.computerReleaseLease() };
  });
}

// mock-provider.ts — Mock Computer Use Provider（用于测试和开发）
// 参考 openhanako 的 core/computer-use/providers/mock-provider.ts
// 简化版，模拟基本动作

import {
  ComputerUseProvider,
  ComputerUseCapabilities,
  ComputerSnapshot,
  ComputerElement,
  ComputerAction,
  ComputerActionResult,
} from '../provider-contract.js';

export class MockComputerUseProvider implements ComputerUseProvider {
  readonly providerId = 'mock';

  private lastSnapshotId = 0;
  private elements: ComputerElement[] = [
    { elementId: 'btn-1', type: 'button', text: 'OK', bounds: { x: 100, y: 200, width: 80, height: 32 }, interactive: true },
    { elementId: 'tf-1', type: 'textfield', text: 'Username', bounds: { x: 100, y: 100, width: 200, height: 28 }, interactive: true },
    { elementId: 'tf-2', type: 'textfield', text: 'Password', bounds: { x: 100, y: 140, width: 200, height: 28 }, interactive: true },
  ];

  getCapabilities(): ComputerUseCapabilities {
    return {
      backgroundControl: true,
      elementActions: 'allowed',
      pointClick: true,
      textInput: true,
      keyboardInput: true,
      drag: true,
      screenshot: true,
      listWindows: true,
      launchApp: true,
    };
  }

  async takeScreenshot(): Promise<{ data: string; mime: string }> {
    // 返回一个 1x1 像素的透明 PNG（base64）
    const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADU1EQVR4nGNAAvsPAAAAAElFTkSuQmCC';
    return { data: transparentPng, mime: 'image/png' };
  }

  async takeSnapshot(): Promise<ComputerSnapshot> {
    this.lastSnapshotId++;
    return {
      snapshotId: `mock-snapshot-${this.lastSnapshotId}`,
      timestamp: Date.now(),
      width: 1920,
      height: 1080,
      elements: this.elements,
      screenshot: await this.takeScreenshot().then(r => r.data),
    };
  }

  async executeAction(action: ComputerAction): Promise<ComputerActionResult> {
    console.log(`[MockProvider] executeAction: ${JSON.stringify(action)}`);

    switch (action.type) {
      case 'click_element':
        return this._mockClickElement(action.elementId);
      case 'click_point':
        return this._mockClickPoint(action.x, action.y);
      case 'type_text':
        return this._mockTypeText(action.text, action.elementId);
      case 'press_key':
        return this._mockPressKey(action.key);
      case 'scroll':
        return this._mockScroll(action.direction, action.amount);
      case 'drag':
        return this._mockDrag(action.path);
      case 'take_snapshot':
        return { success: true, newSnapshot: await this.takeSnapshot() };
      case 'take_screenshot':
        return { success: true, data: await this.takeScreenshot() };
      default:
        return { success: false, error: `Unknown action: ${(action as any).type}` };
    }
  }

  async launchApp(appId: string, options?: { args?: string[] }): Promise<{ success: boolean; pid?: number }> {
    console.log(`[MockProvider] launchApp: ${appId} ${(options?.args || []).join(' ')}`);
    return { success: true, pid: Math.floor(Math.random() * 10000) };
  }

  async listWindows(): Promise<{ windowId: string; appId: string; title: string; bounds: { x: number; y: number; width: number; height: number }; isForeground: boolean }[]> {
    return [
      { windowId: 'win-1', appId: 'VSCODE', title: 'Visual Studio Code', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isForeground: true },
      { windowId: 'win-2', appId: 'TERMINAL', title: 'Terminal', bounds: { x: 100, y: 100, width: 800, height: 600 }, isForeground: false },
    ];
  }

  // --- Mock 动作实现 ---

  private _mockClickElement(elementId: string): ComputerActionResult {
    const element = this.elements.find(e => e.elementId === elementId);
    if (!element) {
      return { success: false, error: `Element not found: ${elementId}` };
    }
    console.log(`[MockProvider] Clicked element: ${element.text || elementId}`);
    return { success: true };
  }

  private _mockClickPoint(x: number, y: number): ComputerActionResult {
    console.log(`[MockProvider] Clicked at (${x}, ${y})`);
    return { success: true };
  }

  private _mockTypeText(text: string, elementId?: string): ComputerActionResult {
    const target = elementId ? `element ${elementId}` : 'focused element';
    console.log(`[MockProvider] Typed "${text}" into ${target}`);
    return { success: true };
  }

  private _mockPressKey(key: string): ComputerActionResult {
    console.log(`[MockProvider] Pressed key: ${key}`);
    return { success: true };
  }

  private _mockScroll(direction: string, amount?: number): ComputerActionResult {
    console.log(`[MockProvider] Scrolled ${direction} by ${amount || 1}`);
    return { success: true };
  }

  private _mockDrag(path: { x: number; y: number }[]): ComputerActionResult {
    console.log(`[MockProvider] Dragged along ${path.length} points`);
    return { success: true };
  }
}

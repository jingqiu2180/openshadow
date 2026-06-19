// @ts-nocheck
// computer-host.ts — Computer Use 主机（管理控制会话和租约）
// 参考 openhanako 的 core/computer-use/computer-host.ts
// 简化版，聚焦核心功能

import { ComputerUseProvider, ComputerSnapshot, ComputerAction, ComputerActionResult } from './provider-contract';
import { ComputerUseProviderRegistry } from './provider-registry';

// 租约（谁当前可以控制计算机）
export interface ComputerLease {
  // 会话路径（如 "agent/main"）
  sessionPath: string;
  // Agent ID
  agentId: string;
  // 允许的动作（从 Provider 能力映射）
  allowedActions: string[];
  // Provider 状态（持久化，用于跨轮对话）
  providerState: Record<string, unknown>;
  // 最后一次快照
  lastSnapshot?: ComputerSnapshot;
  // 租约创建时间
  createdAt: number;
}

// Computer Use 错误
export class ComputerUseError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ComputerUseError';
  }
}

export class ComputerHost {
  private registry: ComputerUseProviderRegistry;
  private currentLease: ComputerLease | null = null;
  private defaultProviderId: string | null = null;

  constructor(registry: ComputerUseProviderRegistry) {
    this.registry = registry;
  }

  // 设置默认 Provider
  setDefaultProvider(providerId: string): void {
    if (!this.registry.get(providerId)) {
      throw new ComputerUseError('PROVIDER_NOT_FOUND', `Provider not found: ${providerId}`);
    }
    this.defaultProviderId = providerId;
  }

  // 获取当前租约
  getCurrentLease(): ComputerLease | null {
    return this.currentLease;
  }

  // 获取指定 Provider
  private _getProvider(providerId?: string): ComputerUseProvider {
    const pid = providerId || this.defaultProviderId;
    if (!pid) {
      throw new ComputerUseError('NO_PROVIDER', 'No provider configured');
    }
    const provider = this.registry.get(pid);
    if (!provider) {
      throw new ComputerUseError('PROVIDER_NOT_FOUND', `Provider not found: ${pid}`);
    }
    return provider;
  }

  // 获取快照（核心方法）
  async takeSnapshot(options?: {
    providerId?: string;
    region?: { x: number; y: number; width: number; height: number };
  }): Promise<ComputerSnapshot> {
    const provider = this._getProvider(options?.providerId);

    // 检查租约（如果已设置，必须匹配）
    if (this.currentLease) {
      // 允许匿名快照（用于预览），但执行动作需要租约
    }

    const snapshot = await provider.takeSnapshot({ region: options?.region });
    return snapshot;
  }

  // 截图（返回 base64 PNG）
  async takeScreenshot(options?: {
    providerId?: string;
    windowId?: string;
  }): Promise<{ data: string; mime: string }> {
    const provider = this._getProvider(options?.providerId);
    return await provider.takeScreenshot({ windowId: options?.windowId });
  }

  // 执行动作（核心方法，需要租约）
  async executeAction(action: ComputerAction, ctx: {
    sessionPath: string;
    agentId: string;
  }): Promise<ComputerActionResult> {
    // 验证租约
    if (!this.currentLease) {
      throw new ComputerUseError('NO_LEASE', 'No active lease. Call acquireLease() first.');
    }

    if (this.currentLease.sessionPath !== ctx.sessionPath ||
        this.currentLease.agentId !== ctx.agentId) {
      throw new ComputerUseError('LEASE_MISMATCH', 'Current lease owned by different session/agent');
    }

    // 验证动作是否被允许
    const provider = this._getProvider();
    const capabilities = provider.getCapabilities();
    this._validateAction(action, capabilities);

    // 执行动作
    const result = await provider.executeAction(action);

    // 更新租约状态
    if (result.newSnapshot) {
      this.currentLease.lastSnapshot = result.newSnapshot;
    }

    return result;
  }

  // 启动应用
  async launchApp(appId: string, options?: { args?: string[]; providerId?: string }): Promise<{ success: boolean; pid?: number }> {
    const provider = this._getProvider(options?.providerId);
    if (!provider.launchApp) {
      throw new ComputerUseError('UNSUPPORTED', 'Provider does not support launchApp');
    }
    return await provider.launchApp(appId, { args: options?.args });
  }

  // 获取窗口列表
  async listWindows(providerId?: string): Promise<{ windowId: string; appId: string; title: string }[]> {
    const provider = this._getProvider(providerId);
    if (!provider.listWindows) {
      throw new ComputerUseError('UNSUPPORTED', 'Provider does not support listWindows');
    }
    const windows = await provider.listWindows();
    return windows.map(w => ({
      windowId: w.windowId,
      appId: w.appId,
      title: w.title,
    }));
  }

  // --- 租约管理 ---

  // 获取租约（如果当前没有租约，或者调用者匹配当前租约）
  acquireLease(ctx: { sessionPath: string; agentId: string }): ComputerLease {
    if (this.currentLease) {
      if (this.currentLease.sessionPath === ctx.sessionPath &&
          this.currentLease.agentId === ctx.agentId) {
        // 同一会话续租
        return this.currentLease;
      }
      throw new ComputerUseError('LEASE_HELD', 'Another session/agent holds the lease');
    }

    const provider = this._getProvider();
    const capabilities = provider.getCapabilities();

    this.currentLease = {
      sessionPath: ctx.sessionPath,
      agentId: ctx.agentId,
      allowedActions: this._computeAllowedActions(capabilities),
      providerState: {},
      createdAt: Date.now(),
    };

    return this.currentLease;
  }

  // 释放租约
  releaseLease(ctx: { sessionPath: string; agentId: string }): boolean {
    if (!this.currentLease) return false;

    if (this.currentLease.sessionPath !== ctx.sessionPath ||
        this.currentLease.agentId !== ctx.agentId) {
      return false; // 不是你的租约，不能释放
    }

    this.currentLease = null;
    return true;
  }

  // 验证动作是否被允许
  private _validateAction(action: ComputerAction, capabilities: import('./provider-contract.js').ComputerUseCapabilities): void {
    const actionType = action.type;
    const capabilityMap: Record<string, string> = {
      'click_element': 'elementActions',
      'double_click': 'elementDoubleClick',
      'click_point': 'pointClick',
      'type_text': 'textInput',
      'press_key': 'keyboardInput',
      'scroll': 'elementActions',
      'drag': 'drag',
      'launch_app': 'launchApp',
      'take_snapshot': 'screenshot',
      'take_screenshot': 'screenshot',
    };

    const requiredCapability = capabilityMap[actionType];
    if (requiredCapability && !(capabilities as Record<string, unknown>)[requiredCapability]) {
      throw new ComputerUseError('ACTION_NOT_ALLOWED', `Action ${actionType} requires capability ${requiredCapability}, which is not supported by current provider`);
    }
  }

  // 计算允许的动作列表
  private _computeAllowedActions(capabilities: import('./provider-contract.js').ComputerUseCapabilities): string[] {
    const actions: string[] = [];
    if ((capabilities as Record<string, unknown>)['elementActions']) actions.push('click_element', 'scroll');
    if ((capabilities as Record<string, unknown>)['elementDoubleClick']) actions.push('double_click');
    if ((capabilities as Record<string, unknown>)['pointClick']) actions.push('click_point');
    if ((capabilities as Record<string, unknown>)['textInput']) actions.push('type_text');
    if ((capabilities as Record<string, unknown>)['keyboardInput']) actions.push('press_key');
    if ((capabilities as Record<string, unknown>)['drag']) actions.push('drag');
    if ((capabilities as Record<string, unknown>)['launchApp']) actions.push('launch_app');
    if ((capabilities as Record<string, unknown>)['screenshot']) actions.push('take_snapshot', 'take_screenshot');
    return actions;
  }
}

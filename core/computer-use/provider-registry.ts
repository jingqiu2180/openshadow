// @ts-nocheck
// provider-registry.ts — Computer Use Provider 注册表
// 参考 openhanako 的 core/computer-use/provider-registry.ts
// 简化版

import { ComputerUseProvider } from './provider-contract.js';

export class ComputerUseProviderRegistry {
  private providers: Map<string, ComputerUseProvider> = new Map();

  // 注册 Provider
  register(provider: ComputerUseProvider): void {
    if (this.providers.has(provider.providerId)) {
      console.warn(`[ComputerUse] Provider ${provider.providerId} already registered, overwriting`);
    }
    this.providers.set(provider.providerId, provider);
  }

  // 获取 Provider
  get(providerId: string): ComputerUseProvider | undefined {
    return this.providers.get(providerId);
  }

  // 获取所有已注册的 Provider
  list(): ComputerUseProvider[] {
    return Array.from(this.providers.values());
  }

  // 获取默认 Provider（第一个注册的，或者显式设置的）
  getDefault(): ComputerUseProvider | undefined {
    // 优先返回 macOS CUA，其次 Windows UIA，其次第一个
    const priority = ['macos-cua', 'windows-uia', 'mock'];
    for (const id of priority) {
      const p = this.providers.get(id);
      if (p) return p;
    }
    //  fallback：第一个
    const first = this.providers.values().next();
    return first.done ? undefined : first.value;
  }

  // 注销 Provider
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }
}

// 别名导出（兼容旧 API 命名）
export { ComputerUseProviderRegistry as ComputerProviderRegistry };

import { ChatEngine, type ChatMessage, type ChatResult } from './chat-engine.js'
import { addMemory } from './memory/store.js'
import { ComputerHost } from './computer-use/computer-host.js'
import { registerComputerUseTools } from './tools/computer-use-tools.js'

export type { ChatMessage, ChatResult } from './chat-engine.js'

export interface AgentOptions {
  agentId: string
  allowedPaths?: string[]
  providerRole?: 'main' | 'small' | 'large'
  providerId?: string
  computerHost?: ComputerHost // 可选：注入 ComputerHost
}

export class Agent {
  readonly agentId: string
  readonly engine: ChatEngine
  readonly computerHost?: ComputerHost // 可选：Computer Use 支持

  constructor(options: AgentOptions) {
    this.agentId = options.agentId
    this.engine = ChatEngine.createFromConfig(
      options.agentId,
      options.providerRole,
      options.providerId,
    )
    this.engine.registerLazyTools(this)

    // 注入 ComputerHost（如果提供）
    if (options.computerHost) {
      this.computerHost = options.computerHost;
      // 自动注册 Computer Use 工具
      registerComputerUseTools(this.engine.getToolRegistry(), this);
    }
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const result = await this.engine.chat(messages)
    this.remember(messages, result.content)
    return result
  }

  async chatStream(
    messages: ChatMessage[],
    onDelta: (chunk: string) => void,
  ): Promise<ChatResult> {
    const result = await this.engine.chatStream(messages, onDelta)
    this.remember(messages, result.content)
    return result
  }

  addPendingImage(base64: string): void {
    this.engine.addPendingImage(base64)
  }

  // ============ Computer Use 方法（如果注入了 computerHost） ============

  /**
   * 获取计算机快照（屏幕可交互元素列表）
   * 工具名：computer_take_snapshot
   */
  async computerTakeSnapshot(): Promise<{
    snapshotId: string;
    width: number;
    height: number;
    elements: { elementId: string; type: string; text?: string; bounds: { x: number; y: number; width: number; height: number } }[];
  }> {
    if (!this.computerHost) {
      throw new Error('Computer Use not enabled for this agent');
    }
    const snapshot = await this.computerHost.takeSnapshot();
    return {
      snapshotId: snapshot.snapshotId,
      width: snapshot.width,
      height: snapshot.height,
      elements: snapshot.elements.map(e => ({
        elementId: e.elementId,
        type: e.type,
        text: e.text,
        bounds: e.bounds,
      })),
    };
  }

  /**
   * 执行计算机动作（点击、输入、按键等）
   * 工具名：computer_execute_action
   */
  async computerExecuteAction(action: {
    type: string;
    elementId?: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    direction?: string;
    amount?: number;
    path?: { x: number; y: number }[];
    appId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.computerHost) {
      throw new Error('Computer Use not enabled for this agent');
    }

    // 确保有租约
    this.computerHost.acquireLease({
      sessionPath: `agent/${this.agentId}`,
      agentId: this.agentId,
    });

    const result = await this.computerHost.executeAction(
      action as any,
      { sessionPath: `agent/${this.agentId}`, agentId: this.agentId },
    );

    return { success: result.success, error: result.error };
  }

  /**
   * 截图（返回 base64 PNG）
   * 工具名：computer_screenshot
   */
  async computerScreenshot(): Promise<{ data: string; mime: string }> {
    if (!this.computerHost) {
      throw new Error('Computer Use not enabled for this agent');
    }
    return await this.computerHost.takeScreenshot();
  }

  /**
   * 释放计算机控制租约
   * 工具名：computer_release_lease
   */
  computerReleaseLease(): boolean {
    if (!this.computerHost) return false;
    return this.computerHost.releaseLease({
      sessionPath: `agent/${this.agentId}`,
      agentId: this.agentId,
    });
  }

  // ==========================================================================

  private remember(messages: ChatMessage[], response: string): void {
    const userMsg = messages[messages.length - 1]?.content
    if (userMsg) {
      addMemory(`User: ${userMsg} | Rem: ${response}`, 2, 'conversation')
    }
  }
}

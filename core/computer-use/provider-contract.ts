// provider-contract.ts — Computer Use Provider 接口契约
// 参考 openhanako 的 core/computer-use/provider-contract.ts
// 简化版，聚焦核心功能

export interface ComputerUseCapabilities {
  // 是否支持后台控制（不要求窗口在前台）
  backgroundControl?: boolean;
  // 是否支持元素操作（通过 elementId 点击、输入等）
  elementActions?: boolean | string; // true | "allowed" | "semantic" | "focused" | "pidScoped"
  // 是否支持双击元素
  elementDoubleClick?: boolean;
  // 是否支持按坐标点击
  pointClick?: boolean | string; // true | "foreground"
  // 是否支持拖拽
  drag?: boolean;
  // 是否支持文本输入
  textInput?: boolean;
  // 是否支持键盘输入
  keyboardInput?: boolean;
  // 输入是否要求窗口在前台
  requiresForegroundForInput?: boolean;
  // 是否支持截图
  screenshot?: boolean;
  // 是否支持获取窗口列表
  listWindows?: boolean;
  // 是否支持启动应用
  launchApp?: boolean;
}

export interface ComputerUseProvider {
  // Provider 唯一 ID（如 "macos-cua"、"windows-uia"）
  readonly providerId: string;

  // 返回该 Provider 支持的能力
  getCapabilities(): ComputerUseCapabilities;

  // 初始化（可选，某些 Provider 需要预加载）
  init?(): Promise<void>;

  // 截图（返回 base64 编码的 PNG）
  takeScreenshot(options?: { windowId?: string }): Promise<{ data: string; mime: string }>;

  // 获取当前屏幕快照（结构化，包含可交互元素）
  takeSnapshot(options?: { region?: { x: number; y: number; width: number; height: number } }): Promise<ComputerSnapshot>;

  // 执行动作
  executeAction(action: ComputerAction): Promise<ComputerActionResult>;

  // 启动应用（可选）
  launchApp?(appId: string, options?: { args?: string[] }): Promise<{ success: boolean; pid?: number }>;

  // 获取窗口列表（可选）
  listWindows?(): Promise<ComputerWindow[]>;
}

// 屏幕快照（结构化）
export interface ComputerSnapshot {
  // 快照 ID（用于后续动作引用）
  snapshotId: string;
  // 时间戳
  timestamp: number;
  // 屏幕宽度
  width: number;
  // 屏幕高度
  height: number;
  // 可交互元素列表
  elements: ComputerElement[];
  // 截图（base64 PNG，可选）
  screenshot?: string;
}

// 可交互元素
export interface ComputerElement {
  // 元素唯一 ID（在当前快照中唯一）
  elementId: string;
  // 元素类型
  type: "button" | "textfield" | "checkbox" | "radio" | "dropdown" | "link" | "image" | "other";
  // 元素文本（可见文本，可选）
  text?: string;
  // 元素描述（可选）
  description?: string;
  // 边界框（相对于屏幕）
  bounds: { x: number; y: number; width: number; height: number };
  // 是否可交互
  interactive: boolean;
  // 应用 PID（可选）
  pid?: number;
}

// 计算机动作
export type ComputerAction =
  | { type: "click_element"; elementId: string; modifiers?: string[] }
  | { type: "double_click"; elementId: string }
  | { type: "click_point"; x: number; y: number }
  | { type: "type_text"; text: string; elementId?: string }
  | { type: "press_key"; key: string; modifiers?: string[] }
  | { type: "scroll"; direction: "up" | "down" | "left" | "right"; amount?: number }
  | { type: "drag"; path: { x: number; y: number }[] }
  | { type: "launch_app"; appId: string; args?: string[] }
  | { type: "take_snapshot" }
  | { type: "take_screenshot" };

// 动作执行结果
export interface ComputerActionResult {
  success: boolean;
  // 新的快照（如果动作改变了屏幕状态）
  newSnapshot?: ComputerSnapshot;
  // 错误信息
  error?: string;
  // 附加数据
  data?: unknown;
}

// 窗口信息
export interface ComputerWindow {
  windowId: string;
  appId: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  isForeground: boolean;
}

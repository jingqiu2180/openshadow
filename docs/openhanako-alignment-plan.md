# openhanako 功能对齐计划

**目标**：将 openhanako 的所有核心功能对齐到 openshadow 项目
**参考项目**：D:\src\aicoding\openhanako
**目标项目**：D:\src\aicoding\openshadow
**创建时间**：2026-06-17
**预计工期**：4-6 周

---

## 一、整体策略

### 1.1 对齐原则

1. **保留 openshadow 优势**：MCP 支持、Team 系统、Planner、Coder 等 openshadow 独有功能全部保留并增强
2. **模块化迁移**：按功能模块逐个对齐，不一次性大改
3. **兼容性优先**：新功能不影响现有功能
4. **测试驱动**：每个阶段完成后进行集成测试

### 1.2 功能模块分类

| 优先级 | 模块 | 工作量 | 依赖 |
|--------|------|--------|------|
| P0 | 核心 Agent 增强 | 3-5天 | 无 |
| P0 | Plugin 系统 | 5-7天 | 核心 Agent |
| P1 | Memory 系统增强 | 4-6天 | 核心 Agent |
| P1 | Tool 系统扩展 | 3-5天 | Plugin 系统 |
| P2 | Computer Use | 7-10天 | 无 |
| P2 | Sandbox 增强 | 3-5天 | 无 |
| P3 | Bridge 系统 | 5-7天 | Channel 系统 |
| P3 | Channel 系统 | 4-6天 | 核心 Agent |
| P3 | Desk 自动化 | 5-7天 | Channel 系统 |
| P4 | Workflow 系统 | 4-6天 | 无 |
| P4 | UI 增强 | 7-10天 | 无 |

---

## 二、阶段详解

### 阶段 1：核心 Agent 功能增强（P0）

**目标**：让 openshadow 的 Agent 达到 openhanako 的完整度

**现状对比**：
- openhanako `agent.ts`：1000+ 行，完整身份/人格/记忆/工具
- openshadow `agent.ts`：52 行，仅包装 ChatEngine

**任务清单**：

#### 1.1 增强 `core/agent.ts`

- [ ] 实现完整的人格系统
  - 参考：`openhanako/core/agent.ts` 中的 `AgentAppearanceEngine`
  - 文件：`core/personality/` 已存在，需要增强
  
- [ ] 集成记忆系统
  - 参考：`openhanako/lib/memory/fact-store.ts`
  - 集成：`core/memory/store.ts`（已存在，需增强）
  
- [ ] 实现工具注册和发现
  - 参考：`openhanako/core/agent.ts` 中的 `createXxxTool()` 调用
  - 当前：`core/tool-registry.ts` 已存在基础版本
  
- [ ] 实现系统 prompt 拼装逻辑
  - 参考：`openhanako/core/agent.ts` 中的 `buildSystemPrompt()`
  - 当前：`core/personality/template.ts` 已存在基础版本

**文件变更**：
- `core/agent.ts`：重写，参考 openhanako 实现
- `core/chat-engine.ts`：增强，支持更多工具
- `core/tool-registry.ts`：增强，支持动态工具注册

#### 1.2 扩展 Tool 系统

**新增工具**（参考 openhanako `lib/tools/`）：

- [ ] `web-search-tool`：Web 搜索工具
- [ ] `web-fetch-tool`：Web 抓取工具
- [ ] `automation-tool`：自动化工具
- [ ] `subagent-tool`：子 Agent 工具
- [ ] `todo-tool`：Todo 管理工具
- [ ] `terminal-tool`：终端工具
- [ ] `workflow-tool`：工作流工具
- [ ] `computer-use-tool`：计算机使用工具（阶段 4 实现）

**文件结构**：
```
core/tools/
├── index.ts              # 导出所有工具
├── bash.ts               # 已存在
├── file.ts               # 已存在
├── browser.ts            # 已存在
├── vision.ts             # 已存在
├── web.ts               # 已存在
├── screenshot.ts         # 已存在
├── path-guard.ts        # 已存在
├── web-search.ts        # 新增
├── web-fetch.ts         # 新增
├── automation.ts        # 新增
├── subagent.ts          # 新增
├── todo.ts              # 新增
├── terminal.ts           # 新增
└── workflow.ts          # 新增
```

#### 1.3 增强 ChatEngine

**改进点**：

- [ ] 支持 streaming 完整实现
  - 当前：`chatStream()` 方法已存在但简化
  - 参考：`openhanako/core/engine.ts` 中的流式处理
  
- [ ] 工具调用错误处理
  - 实现工具调用失败重试
  - 实现工具调用超时处理
  
- [ ] 支持多种消息类型
  - 当前：只支持 `role` + `content`
  - 目标：支持 images、tool_calls、tool_results

**文件变更**：
- `core/chat-engine.ts`：增强
- `core/tool-registry.ts`：增强

---

### 阶段 2：Plugin 系统（P0）

**目标**：实现完整的插件架构

**参考文件**：
- `openhanako/core/plugin-manager.ts`
- `openhanako/core/plugin-context.ts`
- `openhanako/core/plugin-config.ts`

**任务清单**：

#### 2.1 实现 PluginManager

**核心功能**：

- [ ] 插件发现和组织
  - 扫描 `plugins/` 目录
  - 支持 `.ts` 和 `.js` 插件源文件
  - 插件优先级：dev > community > builtin
  
- [ ] 插件加载和初始化
  - 使用 `freshImport()` 动态加载
  - 调用插件的 `activate()` 方法
  - 处理插件的 `deactivate()` 方法
  
- [ ] 插件贡献点注册
  - `tools`：注册工具
  - `routes`：注册路由
  - `skills`：注册技能
  - `agents`：注册 Agent
  - `commands`：注册命令
  - `providers`：注册提供商

**文件结构**：
```
core/
├── plugin-manager.ts      # 插件管理器（新增）
├── plugin-context.ts     # 插件上下文（新增）
├── plugin-config.ts      # 插件配置（新增）
└── plugin-registry.ts   # 插件注册表（新增）
```

#### 2.2 实现插件配置系统

- [ ] 插件元数据结构
  ```typescript
  interface PluginMeta {
    id: string
    name: string
    version: string
    description: string
    author: string
    contributions: {
      tools?: ToolSpec[]
      routes?: RouteSpec[]
      skills?: SkillSpec[]
      agents?: AgentSpec[]
      commands?: CommandSpec[]
      providers?: ProviderSpec[]
    }
  }
  ```
  
- [ ] 插件配置 Schema 验证
  - 参考：`openhanako/core/plugin-config.ts`
  
- [ ] 插件安装和卸载
  - 支持从 npm 安装
  - 支持从本地文件安装
  - 支持从 URL 安装

#### 2.3 实现插件 API

**插件开发者 API**：

```typescript
export interface PluginContext {
  // 注册工具
  registerTool(name: string, spec: ToolSpec, handler: ToolHandler): void
  
  // 注册路由
  registerRoute(path: string, handler: RouteHandler): void
  
  // 注册技能
  registerSkill(name: string, skill: Skill): void
  
  // 注册 Agent
  registerAgent(config: AgentConfig): void
  
  // 获取配置
  getConfig(): PluginConfig
  
  // 日志记录
  log(message: string): void
}
```

**文件变更**：
- 新增：`core/plugin-manager.ts`
- 新增：`core/plugin-context.ts`
- 新增：`core/plugin-config.ts`
- 新增：`core/plugin-registry.ts`
- 修改：`core/agent-manager.ts`（集成插件系统）
- 修改：`core/chat-engine.ts`（支持插件工具）

---

### 阶段 3：Memory 系统增强（P1）

**目标**：实现深度记忆系统

**参考文件**：
- `openhanako/lib/memory/fact-store.ts`
- `openhanako/lib/memory/compiled-memory-snapshot.ts`
- `openhanako/lib/memory/memory-ticker.ts`
- `openhanako/lib/memory/memory-search.ts`

**任务清单**：

#### 3.1 实现 FactStore

**功能**：

- [ ] 事实存储和检索
  - 存储：`{ fact: string, timestamp: number, confidence: number }`
  - 检索：按关键词、时间范围、置信度
  
- [ ] 事实提取
  - 从对话中提取事实
  - 使用 LLM 进行事实抽取
  
- [ ] 事实更新和删除
  - 更新：合并相似事实
  - 删除：移除过时事实

**文件结构**：
```
core/memory/
├── store.ts                    # 已存在，需增强
├── deep-memory.ts              # 已存在，需增强
├── summarizer.ts              # 已存在，需增强
├── fact-store.ts              # 新增，参考 openhanako
├── compiled-memory-snapshot.ts # 新增，参考 openhanako
├── memory-ticker.ts           # 新增，参考 openhanako
└── memory-search.ts           # 新增，参考 openhanako
```

#### 3.2 实现编译记忆快照

**功能**：

- [ ] 记忆编译
  - 将分散的记忆编译成结构化快照
  - 使用 LLM 进行记忆总结和压缩
  
- [ ] 快照存储
  - 存储为 JSON 文件
  - 支持版本控制
  
- [ ] 快照加载和应用
  - 加载快照到 Agent 上下文
  - 动态更新快照

#### 3.3 实现记忆 Ticker

**功能**：

- [ ] 自动记忆
  - 定期从对话中提取记忆
  - 使用后台任务进行记忆处理
  
- [ ] 记忆优先级
  - 高优先级：用户明确要求的记忆
  - 中优先级：重要事实
  - 低优先级：一般信息

#### 3.4 实现记忆搜索工具

**功能**：

- [ ] 工具：`memory_search`
  - 参数：`query`（搜索关键词）
  - 返回：相关记忆列表
  
- [ ] 工具：`memory_add`
  - 参数：`fact`（事实内容）
  - 功能：手动添加记忆
  
- [ ] 工具：`memory_delete`
  - 参数：`factId`（事实 ID）
  - 功能：删除记忆

**文件变更**：
- 新增：`core/memory/fact-store.ts`
- 新增：`core/memory/compiled-memory-snapshot.ts`
- 新增：`core/memory/memory-ticker.ts`
- 新增：`core/memory/memory-search.ts`
- 修改：`core/memory/store.ts`（集成新功能）
- 修改：`core/agent.ts`（集成记忆系统）

---

### 阶段 4：Computer Use（P2）

**目标**：支持计算机使用

**参考文件**：
- `openhanako/core/computer-use/computer-host.ts`
- `openhanako/core/computer-use/providers/windows-uia-provider.ts`
- `openhanako/core/computer-use/providers/command-runner.ts`

**任务清单**：

#### 4.1 实现 Computer Host

**功能**：

- [ ] 屏幕捕获
  - 使用 `screenshot.ts`（已存在）
  - 增强：支持多显示器
  
- [ ] 鼠标控制
  - 移动、点击、拖拽
  - 参考：`openhanako/core/tools/browser-tool.ts`
  
- [ ] 键盘控制
  - 输入文本
  - 快捷键
  
- [ ] 窗口管理
  - 激活窗口
  - 获取窗口信息

#### 4.2 实现 Windows UIA Provider

**功能**：

- [ ] UI Automation 支持
  - 元素定位
  - 元素操作（点击、输入、选择）
  
- [ ] 脚本生成
  - 参考：`openhanako/core/computer-use/providers/windows-uia-script.ts`
  
- [ ] 执行引擎
  - 执行 UIA 脚本
  - 错误处理

#### 4.3 实现工具：`computer_use`

**工具规格**：

```typescript
{
  name: 'computer_use',
  description: 'Control the computer using mouse, keyboard, and screen capture',
  parameters: {
    action: {
      type: 'string',
      enum: ['screenshot', 'mouse_move', 'mouse_click', 'mouse_drag', 'keyboard_type', 'keyboard_hotkey', 'window_activate']
    },
    // 各 action 的特定参数
  }
}
```

**文件结构**：
```
core/computer-use/
├── computer-host.ts         # 新增
├── errors.ts               # 新增
├── lease-registry.ts       # 新增
├── model-policy.ts         # 新增
├── platform-support.ts     # 新增
├── provider-contract.ts    # 新增
├── provider-registry.ts    # 新增
└── providers/
    ├── command-runner.ts  # 新增
    ├── mock-provider.ts   # 新增
    └── windows-uia-provider.ts # 新增
```

**文件变更**：
- 新增：`core/computer-use/` 整个目录
- 修改：`core/tools/index.ts`（导出 `computer_use` 工具）
- 修改：`core/chat-engine.ts`（注册 `computer_use` 工具）

---

### 阶段 5：Sandbox 增强（P2）

**目标**：增强现有沙箱系统

**参考文件**：
- `openhanako/lib/sandbox/index.ts`
- `openhanako/lib/sandbox/bwrap.ts`（Linux）
- `openhanako/lib/sandbox/win32-policy.ts`（Windows）

**任务清单**：

#### 5.1 增强路径守卫

- [ ] 参考：`openhanako/lib/sandbox/path-guard.ts`
- [ ] 实现更严格的路径验证
- [ ] 支持路径白名单和黑名单

#### 5.2 实现工具包装器

- [ ] 参考：`openhanako/lib/sandbox/tool-wrapper.ts`
- [ ] 在工具执行前进行沙箱检查
- [ ] 记录所有工具调用

#### 5.3 实现 Windows 沙箱

- [ ] 参考：`openhanako/lib/sandbox/win32-sandbox-helper.ts`
- [ ] 使用 Windows Sandbox API
- [ ] 实现沙箱隔离

**文件变更**：
- 修改：`core/sandbox/sandbox.ts`（增强）
- 修改：`core/tools/path-guard.ts`（增强）
- 新增：`core/sandbox/tool-wrapper.ts`
- 新增：`core/sandbox/win32-sandbox.ts`

---

### 阶段 6：Bridge 和 Channel 系统（P3）

**目标**：支持多平台接入和多 Agent 协作

**参考文件**：
- `openhanako/core/bridge-session-manager.ts`
- `openhanako/core/channel-manager.ts`
- `openhanako/lib/bridge/`

**任务清单**：

#### 6.1 实现 Bridge 系统

**支持的平台**：

- [ ] Feishu（飞书）
  - 参考：`openhanako/lib/bridge/feishu-adapter.ts`
  - 已实现：`channels/feishu.ts`（需增强）
  
- [ ] WeChat（微信）
  - 参考：`openhanako/lib/bridge/wechat-adapter.ts`
  - 已实现：`channels/wechat.ts`（需增强）
  
- [ ] QQ
  - 参考：`openhanako/lib/bridge/qq-adapter.ts`
  - 已实现：`channels/qq.ts`（需增强）

**核心功能**：

- [ ] 消息适配
  - 平台消息 → 内部消息格式
  - 内部消息 → 平台消息格式
  
- [ ] 媒体处理
  - 图片、语音、文件的上传和下载
  - 参考：`openhanako/lib/bridge/media-capabilities.ts`
  
- [ ] 流式响应
  - 支持流式消息发送
  - 参考：`openhanako/lib/bridge/streaming-capabilities.ts`

#### 6.2 实现 Channel 系统

**功能**：

- [ ] 频道 CRUD
  - 创建、读取、更新、删除频道
  - 参考：`openhanako/core/channel-manager.ts`
  
- [ ] 成员管理
  - 添加、移除成员
  - 成员权限管理
  
- [ ] 频道初始化
  - 新 Agent 自动创建频道
  - 频道配置管理

**文件结构**：
```
core/
├── bridge-session-manager.ts    # 新增
├── channel-manager.ts           # 新增
└── bridge/
    ├── bridge-context.ts       # 新增
    ├── bridge-manager.ts       # 新增
    ├── feishu-adapter.ts      # 新增（增强 channels/feishu.ts）
    ├── wechat-adapter.ts      # 新增（增强 channels/wechat.ts）
    ├── qq-adapter.ts          # 新增（增强 channels/qq.ts）
    └── media-capabilities.ts  # 新增
```

**文件变更**：
- 新增：`core/bridge-session-manager.ts`
- 新增：`core/channel-manager.ts`
- 新增：`core/bridge/` 整个目录
- 修改：`channels/feishu.ts`（增强）
- 修改：`channels/wechat.ts`（增强）
- 修改：`channels/qq.ts`（增强）

---

### 阶段 7：Desk 自动化（P3）

**目标**：实现自动化调度和执行

**参考文件**：
- `openhanako/lib/desk/desk-manager.ts`
- `openhanako/lib/desk/cron-scheduler.ts`
- `openhanako/lib/desk/automation-executors.ts`

**任务清单**：

#### 7.1 实现 Cron 调度器

**功能**：

- [ ] 定时任务调度
  - 支持 cron 表达式
  - 支持一次性任务
  
- [ ] 任务存储
  - 参考：`openhanako/lib/desk/cron-store.ts`
  - 使用 SQLite 存储任务
  
- [ ] 任务执行
  - 定时触发任务
  - 错误处理和重试

#### 7.2 实现自动化执行器

**功能**：

- [ ] 自动化脚本执行
  - 执行 Shell 脚本
  - 执行 Python 脚本
  
- [ ] 自动化工作流
  - 执行多步骤工作流
  - 条件分支和循环
  
- [ ] 执行结果通知
  - 发送通知到桌面
  - 发送通知到移动端

#### 7.3 实现 Desk Manager

**功能**：

- [ ] 自动化管理
  - 创建、更新、删除自动化
  
- [ ] 活动存储
  - 参考：`openhanako/lib/desk/activity-store.ts`
  - 记录所有自动化活动
  
- [ ] 权限管理
  - 参考：`openhanako/lib/desk/permissions.ts`
  - 控制自动化的执行权限

**文件结构**：
```
core/desk/
├── desk-manager.ts           # 新增
├── cron-scheduler.ts        # 新增
├── cron-store.ts            # 新增
├── automation-executors.ts  # 新增
├── automation-normalizer.ts # 新增
├── activity-store.ts        # 新增
├── permissions.ts           # 新增
└── agent-run-automation.ts # 新增
```

**文件变更**：
- 新增：`core/desk/` 整个目录
- 修改：`core/agent-manager.ts`（集成 Desk 系统）
- 修改：`package.json`（添加 `node-cron` 依赖，已存在）

---

### 阶段 8：Workflow 系统（P4）

**目标**：实现工作流编排

**参考文件**：
- `openhanako/lib/workflow/host-api.ts`
- `openhanako/lib/workflow/sandbox.ts`
- `openhanako/lib/workflow/structured-output.ts`

**任务清单**：

#### 8.1 实现 Workflow 定义

**功能**：

- [ ] 工作流 DSL
  - 定义工作流步骤
  - 支持顺序、并行、条件分支
  
- [ ] 工作流解析
  - 解析工作流定义
  - 生成执行计划

#### 8.2 实现 Workflow 执行器

**功能**：

- [ ] 步骤执行
  - 执行单个步骤
  - 传递步骤间数据
  
- [ ] 错误处理
  - 步骤失败处理
  - 重试和回滚
  
- [ ] 并发控制
  - 参考：`openhanako/lib/workflow/concurrency.ts`
  - 控制并行步骤数量

#### 8.3 实现 Workflow 沙箱

**功能**：

- [ ] 隔离执行
  - 每个工作流在独立沙箱中执行
  - 参考：`openhanako/lib/workflow/sandbox.ts`
  
- [ ] 资源限制
  - CPU、内存、时间限制
  
- [ ] 结构化输出
  - 参考：`openhanako/lib/workflow/structured-output.ts`
  - 规范化工作流输出

**文件结构**：
```
core/workflow/
├── host-api.ts              # 新增
├── sandbox.ts               # 新增
├── structured-output.ts    # 新增
├── concurrency.ts           # 新增
├── journal.ts              # 新增
└── meta.ts                 # 新增
```

**文件变更**：
- 新增：`core/workflow/` 整个目录
- 修改：`core/tools/workflow-tool.ts`（增强）

---

### 阶段 9：UI 增强（P4）

**目标**：增强桌面 UI

**参考文件**：
- `openhanako/desktop/src/` 所有组件

**任务清单**：

#### 9.1 增强现有组件

- [ ] `Sidebar.tsx`
  - 添加插件管理界面
  - 添加自动化管理界面
  
- [ ] `SettingsModal.tsx`
  - 添加插件配置
  - 添加自动化配置
  - 添加记忆管理

#### 9.2 新增组件

- [ ] `PluginManager.tsx`
  - 插件列表
  - 插件安装/卸载
  - 插件配置
  
- [ ] `AutomationEditor.tsx`
  - 自动化编辑器
  - Cron 表达式配置
  
- [ ] `MemoryViewer.tsx`
  - 记忆查看器
  - 记忆搜索
  - 记忆编辑

#### 9.3 增强样式

- [ ] 使用 `tailwindcss`（如果尚未使用）
- [ ] 实现深色模式
- [ ] 实现响应式布局

**文件变更**：
- 修改：`desktop/src/components/` 所有组件
- 新增：`desktop/src/components/PluginManager.tsx`
- 新增：`desktop/src/components/AutomationEditor.tsx`
- 新增：`desktop/src/components/MemoryViewer.tsx`

---

## 三、实施顺序

### 3.1 推荐顺序

1. **阶段 1**：核心 Agent 增强（必须首先完成）
2. **阶段 2**：Plugin 系统（为后续功能提供扩展机制）
3. **阶段 3**：Memory 系统增强（提升 Agent 智能）
4. **阶段 5**：Sandbox 增强（提升安全性，可并行）
5. **阶段 4**：Computer Use（独立模块，可并行）
6. **阶段 6**：Bridge 和 Channel 系统（依赖阶段 1）
7. **阶段 7**：Desk 自动化（依赖阶段 6）
8. **阶段 8**：Workflow 系统（独立模块）
9. **阶段 9**：UI 增强（最后完成）

### 3.2 关键路径

```
阶段1 (核心Agent) → 阶段2 (Plugin) → 阶段6 (Bridge/Channel) → 阶段7 (Desk)
       ↓                ↓                ↓                     ↓
       → 阶段3 (Memory)  → 阶段4 (ComputerUse)     阶段8 (Workflow)
       ↓                ↓                ↓                     ↓
       → 阶段5 (Sandbox) → 阶段9 (UI增强)
```

---

## 四、测试策略

### 4.1 单元测试

- 每个新增模块都要有对应的 `.test.ts` 文件
- 参考：`openhanako` 的测试文件（如果有）

### 4.2 集成测试

- 测试模块间的集成
- 参考：`openshadow/tests/` 现有测试

### 4.3 E2E 测试

- 测试完整工作流程
- 参考：`openshadow/test-e2e-*.ts` 现有测试

---

## 五、风险评估

### 5.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| openhanako 代码过于复杂 | 高 | 逐步迁移，不一次性大改 |
| 依赖冲突 | 中 | 使用 `npm ls` 检查依赖树 |
| 性能下降 | 中 | 使用 `vitest --profile` 进行性能测试 |
| 兼容性问题 | 高 | 在每个阶段完成后进行完整测试 |

### 5.2 时间风险

- **预计工期**：4-6 周
- **缓冲时间**：2 周
- **关键路径**：阶段 1 → 2 → 6 → 7

---

## 六、交付物

### 6.1 每个阶段的交付物

1. **源代码**：所有新增和修改的文件
2. **测试**：单元测试、集成测试、E2E 测试
3. **文档**：API 文档、用户手册、开发指南
4. **示例**：示例代码、配置文件示例

### 6.2 最终交付物

1. **完整功能的 openshadow 项目**
2. **完整的测试套件**
3. **完整的文档**
4. **部署脚本**

---

## 七、附录

### 7.1 参考文件清单

**openhanako 核心文件**：

- `core/agent.ts`：Agent 实现
- `core/agent-manager.ts`：Agent 管理
- `core/engine.ts`：核心引擎
- `core/plugin-manager.ts`：插件管理
- `core/channel-manager.ts`：频道管理
- `core/bridge-session-manager.ts`：Bridge 管理
- `lib/memory/`：记忆系统
- `lib/tools/`：工具实现
- `lib/desk/`：自动化系统
- `lib/workflow/`：工作流系统
- `lib/sandbox/`：沙箱系统
- `core/computer-use/`：Computer Use

**openshadow 现有文件**：

- `core/agent.ts`：需重写
- `core/agent-manager.ts`：需增强
- `core/chat-engine.ts`：需增强
- `core/tool-registry.ts`：需增强
- `core/memory/store.ts`：需增强
- `core/sandbox/sandbox.ts`：需增强
- `core/tools/`：需扩展
- `channels/`：需增强

### 7.2 依赖清单

**新增依赖**（参考 openhanako `package.json`）：

```json
{
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.59.0",
    "better-sqlite3": "^12.6.2",
    "chokidar": "^5.0.0",
    "extract-zip": "^2.0.1",
    "js-yaml": "^4.1.0",
    "node-pty": "1.1.0",
    "ws": "^8.18.0"
  }
}
```

**已有依赖**（openshadow 已安装）：

- `@hono/node-server`：✓ 已安装
- `better-sqlite3`：✓ 已安装
- `openai`：✓ 已安装
- `ws`：✓ 已安装
- `zustand`：✓ 已安装

### 7.3 工具清单

**openhanako 支持的工具**（30+）：

1. `web_search` - Web 搜索
2. `web_fetch` - Web 抓取
3. `todo` - Todo 管理
4. `automation` - 自动化
5. `subagent` - 子 Agent
6. `computer_use` - 计算机使用
7. `pinned_memory` - 固定记忆
8. `experience` - 经验管理
9. `install_skill` - 安装技能
10. `notify` - 通知
11. `update_settings` - 更新设置
12. `session_folders` - 会话文件夹
13. `terminal` - 终端
14. `workflow` - 工作流
15. `check_deferred` - 检查延迟结果
16. `stop_task` - 停止任务
17. `current_status` - 当前状态
18. `channel` - 频道管理
19. `dm` - 私信
20. `browser` - 浏览器控制
21. `file` - 文件操作
22. `bash` - Bash 命令
23. `screenshot` - 截图
24. `vision` - 视觉分析
25. `stt` - 语音转文本
26. `tts` - 文本转语音
27. `planner` - 规划器
28. `coder` - 代码生成
29. `skill` - 技能管理
30. `team` - 团队协作

**openshadow 当前支持的工具**（8）：

1. `capture_screenshot` ✓
2. `analyze_screenshot` ✓
3. `file_read` ✓
4. `file_write` ✓
5. `file_list` ✓
6. `bash` ✓
7. `mouse_move` ✓
8. `mouse_click` ✓

**需要新增的工具**（22）：

- [ ] `web_search`
- [ ] `web_fetch`
- [ ] `todo`
- [ ] `automation`
- [ ] `subagent`
- [ ] `computer_use`
- [ ] `pinned_memory`
- [ ] `experience`
- [ ] `install_skill`
- [ ] `notify`
- [ ] `update_settings`
- [ ] `session_folders`
- [ ] `terminal`
- [ ] `workflow`
- [ ] `check_deferred`
- [ ] `stop_task`
- [ ] `current_status`
- [ ] `channel`
- [ ] `dm`
- [ ] `browser`（增强）
- [ ] `vision`（增强）

---

## 八、总结

本计划将 openhanako 的所有核心功能对齐到 openshadow 项目，分为 9 个阶段，预计工期 4-6 周。

**关键成功因素**：

1. 严格按照阶段顺序实施
2. 每个阶段完成后进行完整测试
3. 保留 openshadow 的独有功能（MCP、Team、Planner、Coder）
4. 持续集成和部署

**下一步**：

1. 确认计划
2. 开始阶段 1 实施
3. 每周回顾进度

---

**文档版本**：v1.0
**最后更新**：2026-06-17
**作者**：WorkBuddy AI

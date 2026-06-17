# 阶段 2 完成报告：Plugin System

**日期**：2026-06-17  
**阶段**：2 / 9（Plugin System）  
**状态**：✅ 核心功能已实现，待测试

---

## 一、实现内容

### 1.1 新增文件

| 文件 | 功能 |
|------|------|
| `core/plugin-config.ts` | 插件配置系统：Schema 规范化、配置存储、验证、敏感字段 redact |
| `core/plugin-context.ts` | 插件开发者 API：createPluginContext、config、log、registerTool |
| `core/plugin-manager.ts` | 插件管理器：扫描、加载、生命周期管理、工具/技能/命令 加载 |

### 1.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `server/main.ts` | 集成 PluginManager：在 startServer 中创建实例、加载插件、注册工具到 ToolRegistry |

### 1.3 新增插件目录

```
plugins/
├── builtin/          # 内置插件（预留）
└── community/        # 社区插件
    └── hello/        # 示例插件
        ├── manifest.json
        └── tools/
            └── say-hello.ts
data/plugins/          # 插件数据目录（配置存储）
```

---

## 二、功能说明

### 2.1 PluginManager 核心功能

- **插件发现**：扫描 `plugins/` 目录，支持 `builtin` 和 `community` 两种来源
- **插件加载**：读取 `manifest.json`，加载工具/技能/命令贡献点
- **生命周期**：支持 `index.ts` 导出的 `onLoad`/`onUnload` 生命周期钩子
- **动态工具注册**：插件可在 `onLoad` 中调用 `ctx.registerTool()` 动态注册工具

### 2.2 插件开发者 API（PluginContext）

```typescript
interface PluginContext {
  pluginId: string;
  pluginDir: string;
  dataDir: string;
  config: PluginContextConfig;  // 插件私有配置
  log: PluginLogger;           // 日志（带插件前缀）
  registerTool(toolDef): () => void;  // 动态注册工具
  runtime: PluginRuntimeInfo;    // 运行时信息
}
```

### 2.3 插件配置系统

- Schema 规范化：支持 `string`、`number`、`integer`、`boolean` 类型
- 配置存储：存储在 `data/plugins/<pluginId>/config.json`
- 敏感字段 redact：配置中标记为 `sensitive: true` 的字段在读取时被遮蔽

---

## 三、使用示例

### 3.1 创建一个简单插件

**目录结构**：
```
plugins/community/my-plugin/
├── manifest.json
└── tools/
    └── my-tool.ts
```

**manifest.json**：
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "My first remu plugin"
}
```

**tools/my-tool.ts**：
```typescript
export const name = "my_tool";
export const description = "Does something useful";
export const parameters = {
  type: "object",
  properties: {
    input: { type: "string", description: "Input text" }
  },
  required: ["input"]
};

export async function execute(params: Record<string, unknown>, ctx: PluginContext) {
  return `Processed: ${params.input}`;
}
```

### 3.2 带生命周期的插件（高级）

**index.ts**：
```typescript
export class MyPlugin {
  async onLoad() {
    console.log("MyPlugin loaded!");
  }
  
  async onUnload() {
    console.log("MyPlugin unloaded!");
  }
}

export default MyPlugin;
```

---

## 四、已知限制

1. **插件优先级**：当前不支持同名插件的优先级处理（openhanako 支持 dev > community > builtin）
2. **激活事件**：未实现 `activationEvents`（onStartup、onToolCall 等）
3. **路由贡献**：未实现 `routes/` 目录加载（openhanako 支持插件注册 Hono 路由）
4. **扩展贡献**：未实现 `extensions/` 目录加载（Pi SDK extension）
5. **Provider 贡献**：未实现 `providers/` 目录加载
6. **热重载**：未实现插件热重载（文件变更自动重新加载）
7. **插件市场**：未实现插件安装/卸载 UI

---

## 五、后续工作

1. **测试**：创建单元测试验证插件加载、工具注册、配置管理功能
2. **激活事件**：实现 `activationEvents` 支持（按需激活插件）
3. **路由贡献**：实现 `routes/` 目录加载，支持插件注册 API 路由
4. **热重载**：实现插件目录监听，文件变更自动重新加载
5. **插件市场**：实现插件浏览、安装、卸载功能（UI + API）

---

## 六、与 openhanako 对比

| 功能 | openhanako | remu（阶段2） |
|------|-------------|---------------|
| 插件发现 | ✅ 完整 | ✅ 基础实现 |
| 插件加载 | ✅ 完整 | ✅ 基础实现 |
| 生命周期 | ✅ onLoad/onUnload | ✅ 支持 |
| 动态工具注册 | ✅ | ✅ 支持 |
| 配置系统 | ✅ 完整 | ✅ 基础实现 |
| 激活事件 | ✅ 完整 | ❌ 未实现 |
| 路由贡献 | ✅ 完整 | ❌ 未实现 |
| 扩展贡献 | ✅ 完整 | ❌ 未实现 |
| 热重载 | ✅ 支持 | ❌ 未实现 |
| 插件市场 | ✅ 完整 | ❌ 未实现 |

**完成度**：约 40%（核心功能已实现，高级功能待后续阶段扩展）

---

**下一步**：进入阶段 3（Memory 系统增强）或暂停对齐进行测试。

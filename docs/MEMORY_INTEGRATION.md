# Memory 系统集成指南

## 概述

openshadow 的 Memory 系统已实现核心功能，参考了 openhanako 的核心函数，但架构有自己的特色。

## 已实现的功能

### 1. Session 摘要管理（`session-summary.ts`）

- 生成 session 摘要（调用 LLM）
- 读取/保存摘要到 `memory/summaries/` 目录
- 追踪脏 session（供深度记忆处理）
- 格式：facts + timeline 两节

### 2. 记忆编译（`compile.ts`）

三层编译架构：

- **Daily**：每天编译当天的 session 摘要 → `memory/daily/YYYY-MM-DD.md`
- **Weekly**：每周编译本周的 daily 记忆 → `memory/weekly/YYYY-MM-DD.md`
- **Longterm**：从 daily + weekly 汇总 → `memory/longterm/latest.md`

### 3. 深度记忆（`deep-memory.ts`）

- 从 session 摘要中提取元事实（MetaFact）
- 保存到 `memory/facts/` 目录
- 支持关键词搜索（未来可接入向量搜索）

## 架构特点（与 openhanako 的区别）

1. **使用 Markdown 格式** - 易于人类阅读和编辑
2. **简化缓存机制** - 按需加载，不强制全量缓存
3. **灵活 LLM 调用** - 接受 `client` + `model` 参数，支持多 provider
4. **独立设计** - 不依赖 openshadow 的 session 管理，可独立使用

## 如何集成到 openshadow

### 选项 A：Hook 到 SessionManager（推荐）

在 `session-manager.ts` 的 `compact()` 后，保存摘要到 Memory 系统：

```typescript
// session-manager.ts
import { SessionSummaryManager } from './memory/session-summary.js';
import { MemoryCompiler } from './memory/compile.js';
import { DeepMemoryManager } from './memory/deep-memory.js';

export class SessionManager {
  private readonly summaryManager: SessionSummaryManager;
  private readonly compiler: MemoryCompiler;
  private readonly deepMemory: DeepMemoryManager;

  constructor() {
    // ... 已有代码 ...
    const memoryDir = path.join(process.cwd(), 'data', 'memory');
    this.summaryManager = new SessionSummaryManager(path.join(memoryDir, 'summaries'));
    this.compiler = new MemoryCompiler(memoryDir, this.summaryManager);
    this.deepMemory = new DeepMemoryManager(memoryDir, this.summaryManager);
  }

  async compact(sessionId: string) {
    // ... 已有 compact 逻辑 ...
    const summary = await this.compactor.compact(session);

    // 保存到 Memory 系统
    await this.summaryManager.saveSummary(sessionId, {
      sessionId,
      summary,
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // ... 其他逻辑 ...
  }
}
```

### 选项 B：独立运行（定时任务）

创建定时任务，定期编译记忆：

```typescript
// memory-scheduler.ts
import { SessionSummaryManager } from './memory/session-summary.js';
import { MemoryCompiler } from './memory/compile.js';
import { createProviderClient, pickModel } from './providers/index.js';

export class MemoryScheduler {
  private readonly summaryManager: SessionSummaryManager;
  private readonly compiler: MemoryCompiler;
  private readonly client: any;
  private readonly model: string;

  constructor() {
    const provider = config.getActiveProvider('small');
    this.client = createProviderClient(provider);
    this.model = pickModel(provider);

    const memoryDir = path.join(process.cwd(), 'data', 'memory');
    this.summaryManager = new SessionSummaryManager(path.join(memoryDir, 'summaries'));
    this.compiler = new MemoryCompiler(memoryDir, this.summaryManager);
  }

  async runDaily() {
    const today = new Date().toISOString().split('T')[0];
    await this.compiler.compileDaily(today, this.client, this.model);
  }

  async runWeekly() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // 本周一
    await this.compiler.compileWeekly(weekStart.toISOString().split('T')[0], this.client, this.model);
  }

  async runLongterm() {
    await this.compiler.compileLongterm(this.client, 'gpt-4o');
  }

  async processDeepMemory() {
    await this.deepMemory.processDirtySessions(this.client, this.model);
  }
}
```

### 选项 C：手动触发（API 端点）

在 `server/main.ts` 中添加 HTTP 端点：

```typescript
// server/main.ts
app.post('/api/memory/compile', async (c) => {
  const { type } = c.req.json();
  const memoryDir = path.join(process.cwd(), 'data', 'memory');
  const summaryManager = new SessionSummaryManager(path.join(memoryDir, 'summaries'));
  const compiler = new MemoryCompiler(memoryDir, summaryManager);

  const provider = config.getActiveProvider('small');
  const client = createProviderClient(provider);
  const model = pickModel(provider);

  if (type === 'daily') {
    const today = new Date().toISOString().split('T')[0];
    await compiler.compileDaily(today, client, model);
  } else if (type === 'weekly') {
    // ...
  }

  return c.json({ success: true });
});
```

## 如何测试

### 1. 单元测试

```bash
# 需要设置环境变量
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1" # 可选

# 运行测试脚本（需要手动创建）
tsx core/memory/test-memory-system.ts
```

### 2. 集成测试

1. 启动 openshadow 服务器
2. 进行几次对话（触发 session 摘要生成）
3. 检查 `data/memory/summaries/` 目录是否有摘要文件
4. 手动触发编译：`curl -X POST <a href="http://localhost:3000/api/memory/compile">http://localhost:3000/api/memory/compile</a> -d '{"type":"daily"}'`
5. 检查 `data/memory/daily/` 目录是否有编译后的记忆

### 3. 验证深度记忆

1. 确保 `data/memory/summaries/` 中有摘要文件
2. 手动调用 `deepMemory.processDirtySessions(client, model)`
3. 检查 `data/memory/facts/` 目录是否有元事实文件
4. 测试搜索：`deepMemory.searchFacts("关键词")`

## 文件结构

```
data/memory/
├── summaries/           # Session 摘要（JSON）
│   ├── session-001.json
│   └── session-002.json
├── daily/              # 每日记忆（Markdown）
│   ├── 2026-06-17.md
│   └── 2026-06-18.md
├── weekly/             # 每周记忆（Markdown）
│   └── 2026-06-17.md  # 本周一日期
├── longterm/           # 长期记忆（Markdown）
│   └── latest.md
└── facts/              # 元事实（JSON）
    ├── session-001-0.json
    └── session-001-1.json
```

## 下一步优化建议

1. **向量搜索** - 当前是关键词匹配，可接入向量数据库（如 Pinecone、Weaviate）
2. **记忆注入** - 在 chat-engine 中检索相关记忆并注入 prompt
3. **自动清理** - 定期清理旧记忆（保留最近 N 天）
4. **多用户支持** - 当前是单用户，可扩展为多用户（按 userId 分目录）

## 与 openhanako 的对比

| 功能 | openhanako | openshadow（当前实现） |
|------|-------------|-----------------|
| Session 摘要 | ✅ 复杂（多格式支持） | ✅ 简化（facts + timeline） |
| 记忆编译 | ✅ 三层（daily/weekly/longterm） | ✅ 三层（相同） |
| 深度记忆 | ✅ 元事实提取 | ✅ 元事实提取 |
| 存储格式 | JSON | Markdown（易于阅读） |
| LLM 调用 | 自建 `callText()` | 接受外部 client（灵活） |
| 缓存机制 | 全量缓存 | 按需加载 |
| 搜索 | 关键词 + 向量 | 关键词（未来可扩展向量） |

## 总结

Memory 系统核心功能已实现，TypeScript 编译通过。

**建议下一步：**
1. 选择集成方式（推荐选项 A - Hook 到 SessionManager）
2. 进行集成测试
3. 根据实际使用反馈优化

**核心理念：**
- ✅ 核心函数参考 openhanako（LLM 调用、文件操作等）
- ✅ 架构有自己的特色（简化、灵活、易于维护）
- ✅ 不追求 100% 对齐，聚焦核心功能

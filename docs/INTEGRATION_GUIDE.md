# Memory 系统集成指南（参考 openhanako）

## 概述

已创建 `core/memory/memory-manager.ts`，参考 openhanako 的 `MemoryTicker` 设计，但简化实现。

## 集成步骤

### 步骤 1：修改 `core/session-manager.ts`

**1.1 添加导入**

在文件顶部添加：

```typescript
import { MemoryManager } from './memory/memory-manager.js'
import { createProviderClient, pickModel } from './providers/index.js'
import { config } from './config.js'
```

**1.2 在 `SessionManager` 类中添加属性**

```typescript
export class SessionManager {
  private readonly store: SessionStore
  private readonly compactor: SessionCompactor
  private readonly engine: ChatEngine
  private activeSessionId: string | null = null
  private readonly memoryManager: MemoryManager  // 新增

  constructor(engine: ChatEngine, store?: SessionStore) {
    // ... 已有代码 ...
    this.compactor = new SessionCompactor()
    this.memoryManager = new MemoryManager()  // 新增
  }
```

**1.3 修改 `runCompaction()` 方法**

在 `this.store.save(trimmedSession)` 之后添加：

```typescript
  async runCompaction(sessionId: string): Promise<void> {
    const session = this.store.load(sessionId)
    if (!session || session.messages.length < 10) return

    const summary = await this.compactor.compact(session)
    this.store.updateSummary(sessionId, summary)

    const keepCount = Math.floor(session.messages.length * 0.4)
    const trimmedSession: Session = {
      ...session,
      messages: session.messages.slice(-keepCount),
      summary,
    }
    this.store.save(trimmedSession)

    // 新增：通知 MemoryManager
    const provider = config.getActiveProvider('small')
    if (provider) {
      const client = createProviderClient(provider)
      await this.memoryManager.onSessionCompact(sessionId, summary, client)
    }
  }
```

**1.4 修改 `buildMessages()` 方法**

在 `messages` 数组中添加编译后的记忆：

```typescript
  private buildMessages(session: Session): ChatMessage[] {
    const messages: ChatMessage[] = []

    // 新增：注入编译后的长期记忆
    const longtermMemory = this.memoryManager.getCompiledMemory('longterm')
    if (longtermMemory) {
      messages.push({
        role: 'system',
        content: `[Long-term Memory]\n${longtermMemory}`,
      })
    }

    // 已有代码：注入 session 摘要
    if (session.summary) {
      messages.push({
        role: 'system',
        content: `[Previous conversation summary]\n${session.summary}`,
      })
    }

    const recentMessages = session.messages.slice(-50)
    messages.push(...sessionToChatMessages(recentMessages))

    return messages
  }
```

**1.5 添加 `onSessionEnd()` 调用**

在 `chat()` 方法的最后（或 session 结束时）添加：

```typescript
  async chat(content: string, onDelta?: (chunk: string) => void): Promise<ChatResult> {
    // ... 已有代码 ...

    // 新增：如果 session 即将结束（例如用户手动结束），通知 MemoryManager
    // 这里可以根据你的业务逻辑决定何时调用 onSessionEnd()
    // 例如：如果用户长时间未活动，或手动关闭 session

    return result
  }
```

### 步骤 2：在 session 结束时调用 `onSessionEnd()`

**选项 A：在 `deleteSession()` 时调用**

```typescript
  deleteSession(sessionId: string): boolean {
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null
    }

    // 新增：通知 MemoryManager
    const provider = config.getActiveProvider('small')
    if (provider) {
      const client = createProviderClient(provider)
      await this.memoryManager.onSessionEnd(sessionId, client)
    }

    return this.store.delete(sessionId)
  }
```

**选项 B：在定时任务中调用**

创建 `core/memory-scheduler.ts`：

```typescript
// core/memory-scheduler.ts
import { MemoryManager } from './memory/memory-manager.js'
import { createProviderClient } from './providers/index.js'
import { config } from './config.js'

export class MemoryScheduler {
  private readonly memoryManager: MemoryManager
  private intervalId: NodeJS.Timeout | null = null

  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager
  }

  start() {
    // 每小时检查一次
    this.intervalId = setInterval(async () => {
      const provider = config.getActiveProvider('small')
      if (!provider) return

      const client = createProviderClient(provider)
      // 这里需要知道哪些 session 结束了，可以从 store 读取
      // 或者简单地每天编译一次
      const today = new Date().toISOString().split('T')[0]
      // ... 调用 memoryManager 的方法 ...
    }, 3600000) // 1 hour
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
```

然后在 `SessionManager` 中启动 scheduler：

```typescript
constructor(engine: ChatEngine, store?: SessionStore) {
  // ...
  this.memoryManager = new MemoryManager()
  this.memoryScheduler = new MemoryScheduler(this.memoryManager)
  this.memoryScheduler.start()
}
```

### 步骤 3：测试

**3.1 启动 openshadow**

```bash
cd D:/src/aicoding/openshadow
npm run dev
```

**3.2 进行对话**

- 发送至少 10 条消息（触发 `runCompaction()`）
- 检查 `data/memory/summaries/` 目录是否有摘要文件
- 检查 `data/memory/daily/` 目录是否有编译后的记忆

**3.3 手动触发编译**

在浏览器中打开开发者工具，执行：

```javascript
// 假设你能访问到 sessionManager 实例
const provider = config.getActiveProvider('small')
const client = createProviderClient(provider)
await sessionManager.memoryManager.onSessionEnd('session-id', client)
```

或者，创建 HTTP 端点（见步骤 4）。

### 步骤 4：（可选）添加 HTTP 端点

在 `server/main.ts` 中添加：

```typescript
import { MemoryManager } from '../core/memory/memory-manager.js'

// 假设你能访问到 memoryManager 实例
// 可能需要将 memoryManager 设为全局变量，或通过 app.locals 传递

app.post('/api/memory/compile', async (c) => {
  const { type } = c.req.json()
  const provider = config.getActiveProvider('small')
  if (!provider) {
    return c.json({ error: 'No provider configured' }, 400)
  }

  const client = createProviderClient(provider)
  if (type === 'daily') {
    await memoryManager.onSessionCompact('manual', '', client)
  } else if (type === 'weekly') {
    await memoryManager.onSessionEnd('manual', client)
  }

  return c.json({ success: true })
})
```

## 文件结构

```
core/
├── memory/
│   ├── memory-manager.ts     # 新增：Memory 管理器
│   ├── session-summary.ts
│   ├── compile.ts
│   ├── deep-memory.ts
│   └── ...
├── session-manager.ts        # 需要修改
└── ...
```

## 与 openhanako 的对比

| 步骤 | openhanako | openshadow（本实现） |
|------|-------------|-----------------|
| 初始化 | 在 `Agent` 类中创建 `MemoryTicker` | 在 `SessionManager` 中创建 `MemoryManager` |
| 触发时机 | 每 10 轮 / session 结束 / 每天一次 | session 压缩后 / session 结束（可配置） |
| 记忆注入 | 通过 `onCompiled` 回调刷新 system prompt | 在 `buildMessages()` 中注入编译后的记忆 |
| 定时任务 | `MemoryTicker` 内部维护定时器 | 可选：创建 `MemoryScheduler` |

## 下一步优化

1. **向量搜索** - 当前 `searchMemory()` 是关键词匹配，可接入向量数据库
2. **自动清理** - 定期清理旧记忆（保留最近 N 天）
3. **多用户支持** - 当前是单用户，可扩展为多用户（按 userId 分目录）
4. **记忆注入优化** - 根据当前对话主题，检索相关记忆并注入

## 总结

参考 openhanako 的设计，但做了简化：
- ✅ 核心函数对齐（session 摘要、记忆编译、深度记忆）
- ✅ 架构简化（`MemoryManager` 替代 `MemoryTicker`）
- ✅ 灵活集成（可选择 hook 到 `SessionManager` 或独立运行）

**建议下一步：按上述步骤修改 `session-manager.ts`，然后进行集成测试。**

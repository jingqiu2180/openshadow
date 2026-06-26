# 端到端测试 Memory 系统 — 手动验证指南

## 前提条件
1. MiniMax API 额度已恢复（晚上 8 点后）
2. `.env` 文件已配置 `AGENT_MODEL`、`AGENT_BASE_URL`、`AGENT_API_KEY`

## 测试步骤

### 1. 启动 openshadow（开发模式）
```bash
cd D:/src/aicoding/openshadow
npm run dev
```

### 2. 验证 Memory 系统集成
- ✅ 启动时应该看到：
  ```
  [memory-ticker] Starting Memory Ticker (interval: 86400000ms)
  [memory-ticker] Memory Ticker started
  2026-06-17T... INFO [deep-memory] Found 0 dirty sessions
  [memory-ticker] Memory Ticker completed: processed 0 sessions
  ```

### 3. 测试摘要生成
用 curl 或浏览器访问 openshadow 的 API，发送 10+ 条消息，触发 `runCompaction()`。

或者用以下脚本（需要手动创建 session）：
```bash
cd D:/src/aicoding/openshadow
npx tsx e2e-test-memory.ts
```

### 4. 验证文件写入
检查以下目录是否有新文件生成：
```bash
# 摘要文件
ls -la data/memory/summaries/

# 每日记忆
ls -la data/memory/daily/

# 元事实
ls -la data/memory/facts/

# 长期记忆（触发 session 删除后）
ls -la data/memory/longterm/
```

### 5. 验证记忆注入
开始新 session，发送消息：
```
根据之前的对话，我之前问了什么？
```
如果记忆系统工作正常，LLM 应该能引用之前的对话内容。

---

## 预期结果

| 测试项 | 预期结果 |
|--------|------------|
| 启动 openshadow | 无 SQLite 错误，Memory Ticker 启动成功 |
| 发送 10+ 条消息 | `data/memory/summaries/` 下生成摘要文件 |
| 删除 session | `data/memory/longterm/` 下生成 `latest.md` |
| 新 session 引用旧内容 | LLM 能引用之前的对话 |

---

## 如果测试失败

### 问题 1：摘要未生成
- 检查 `SessionManager.runCompaction()` 是否被调用
- 检查 `MemoryManager.onSessionCompact()` 是否被正确触发
- 查看控制台错误日志

### 问题 2：元事实未提取
- 检查 `DeepMemoryManager.processDirtySessions()` 是否被调用
- 检查 LLM API 调用是否成功（查看网络请求）
- 查看 `data/memory/facts/` 目录

### 问题 3：记忆未注入
- 检查 `SessionManager.buildMessages()` 是否读取了 `longterm.md`
- 检查 `longterm.md` 是否存在且非空
- 查看发送给 LLM 的 messages 数组是否包含 `[Long-term Memory]` 部分

---

## 下一步（测试通过后）

1. **优化记忆注入** — 根据当前对话主题，检索相关记忆片段（RAG）
2. **添加向量搜索** — 接入向量数据库（如 Pinecone、Weaviate）
3. **自动清理旧记忆** — 定期清理 30 天前的 daily 记忆
4. **多用户支持** — 按 `userId` 分目录存储

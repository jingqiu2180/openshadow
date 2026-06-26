# 阶段2扩展：Plugin Routes 加载 — 完成报告

**日期**：2026-06-17  
**阶段**：阶段2扩展（Plugin System — Routes 加载）  
**状态**：✅ 完成

---

## 实现内容

### 1. 核心文件修改

#### `core/plugin-context.ts`
- ✅ 添加 `PluginRouteDef` 接口（定义插件路由）
- ✅ 在 `PluginContext` 接口中添加 `registerRoute()` 方法
- ✅ 在 `CreatePluginContextOpts` 中添加 `onRegisterRoute` 回调
- ✅ 实现 `registerRoute()` 方法（供插件 `onLoad` 中调用）

#### `core/plugin-manager.ts`
- ✅ 添加 `LoadedPluginRoute` 接口
- ✅ 在 `KNOWN_CONTRIBUTION_DIRS` 中添加 `"routes"`
- ✅ 在 `PluginManager` 类中添加 `loadedRoutes` 数组
- ✅ 添加 `getLoadedRoutes()` 方法
- ✅ 在 `_loadPlugin()` 中处理 `routes` 贡献点
- ✅ 实现 `_loadRoutes()` 方法（从 `routes/` 目录加载路由）
- ✅ 实现 `_handleDynamicRoute()` 方法（处理动态注册的路由）
- ✅ 在 `unloadPlugin()` 中清理路由

#### `server/main.ts`
- ✅ 在 `startServer` 中加载插件后，将插件路由挂载到 Hono 应用
- ✅ 支持 GET/POST/PUT/DELETE/PATCH 方法
- ✅ 路由挂载路径：`/plugins/<pluginId>/<routePath>`

### 2. 示例插件

创建了 `plugins/community/hello/routes/status.ts`：
- **路径**：`GET /plugins/hello/status`
- **功能**：返回插件状态（插件名、状态、时间戳、查询参数）
- **manifest.json**：已更新，声明 `routes` 贡献点

---

## 当前能力

### ✅ 已实现
1. **插件路由发现** — 自动扫描 `plugins/<id>/routes/` 目录
2. **路由加载** — 从 `routes/` 目录加载 `.ts/.js` 文件
3. **动态路由注册** — 插件在 `onLoad` 中调用 `ctx.registerRoute()`
4. **HTTP 方法支持** — GET/POST/PUT/DELETE/PATCH
5. **路由挂载** — 自动挂载到 `/plugins/<pluginId>/<path>`
6. **参数传递** — 自动解析 `body`、`query`、`headers` 并传递给路由处理器

### ❌ 已知限制（后续扩展）
1. **未实现路由参数** — 不支持 `/plugins/<id>/users/:id` 这样的路径参数
2. **未实现中间件** — 插件路由无法添加自定义中间件（如认证、日志）
3. **未实现路由文档** — 没有自动生成 OpenAPI 文档
4. **未实现路由热重载** — 修改路由文件后需要重启服务器

---

## 测试方法

### 1. 启动服务器
```bash
cd D:/src/aicoding/openshadow
npm run dev
```

### 2. 测试路由
```bash
# 测试 hello 插件的 status 路由
curl http://localhost:3000/plugins/hello/status

# 带查询参数
curl "http://localhost:3000/plugins/hello/status?foo=bar"
```

### 3. 预期响应
```json
{
  "plugin": "hello",
  "status": "ok",
  "timestamp": "2026-06-17T17:xx:xx.xxxZ",
  "query": {
    "foo": "bar"
  }
}
```

---

## 下一步选项

1. **实现路由参数** — 支持 `/plugins/<id>/users/:id` 这样的路径参数
2. **实现插件中间件** — 允许插件添加认证、日志等中间件
3. **进入阶段3** — Memory 系统增强（FactStore、编译记忆快照、记忆 Ticker）
4. **测试当前版本** — 编译后启动服务器，验证插件系统 + 路由功能

---

**报告人**：小科  
**日期**：2026-06-17

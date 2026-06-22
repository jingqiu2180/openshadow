# UI 精细化对齐计划

## 问题诊断

### CSS 架构差异（关键！）
| 项目 | styles.css | 主题 CSS | 设计系统 |
|------|------------|----------|----------|
| openhanako | 4024 行（完整设计系统） | themes/warm-paper.css（颜色覆盖） | ✅ 完整 |
| remu | 488 行（仅变量定义） | styles/themes/*.css（少量变量） | ❌ 缺失 3500+ 行 |

### 缺失的核心样式（openhanako 有，remu 无）
1. **设计系统结构 Token**（间距、圆角、动效、字体）
2. **纸质纹理系统**（`.paper-texture` 相关样式）
3. **基础重置**（box-sizing、scrollbar、body 样式、user-select）
4. **标题栏拖拽区样式**（`.title-bar`）
5. **浮出侧边栏样式**（`.float-sidebar`）
6. **Windows/Linux 窗口控制按钮样式**（`.window-controls`、`.wc-btn`）
7. **动画关键帧**（`@keyframes float-sidebar-in-left` 等）
8. **组件样式**（可能分散在各个 `.module.css` 中）

---

## 对齐方案

### 方案 A：合并 openhanako 的 styles.css 到 remu（推荐）
**优点**：
- 一次性补全所有缺失样式
- 与 openhanako 完全对齐
- 未来合并 openhanako 更新更容易

**步骤**：
1. 备份 remu 现有 `styles.css`
2. 复制 openhanako `styles.css` 到 remu
3. 保留 remu 的变量定义（第 13-50 行）
4. 合并 remu 特有的样式（如果有）
5. 测试所有功能，修复样式冲突

### 方案 B：逐个组件对比对齐（耗时）
**优点**：
- 更精细的控制
- 可以跳过 remu 不需要的样式

**缺点**：
- 非常耗时
- 容易遗漏

---

## 执行计划（方案 A）

### 第 1 步：备份 remu 的 styles.css
```bash
cp D:/src/aicoding/remu/desktop/src/styles.css D:/src/aicoding/remu/desktop/src/styles.css.remu-backup
```

### 第 2 步：复制 openhanako 的 styles.css 到 remu
```bash
cp D:/src/aicoding/openhanako/desktop/src/styles.css D:/src/aicoding/remu/desktop/src/styles.css.openhanako
```

### 第 3 步：合并变量定义
- 保留 remu 的 `:root` 和 `[data-theme="warm-paper"]` 变量定义
- 添加 openhanako 的设计系统 Token（如果 remu 没有）

### 第 4 步：测试
运行之前创建的深度测试脚本，确保样式对齐后功能正常：
```bash
node test-phase1.mjs
node test-phase2.mjs
node test-phase3.mjs
node test-phase4.mjs
```

### 第 5 步：视觉对比
截图对比 remu 和 openhanako 的 UI，确保视觉一致。

---

## 其他需要对比的组件

### 已确认无差异（直接复制自 openhanako）
- ✅ ChatArea.tsx
- ✅ ChatSidebar.tsx
- ✅ SendButton.tsx（remu 修复了 Bug）
- ✅ InputArea.tsx（remu 增加了防御性编程）

### 需要对比的组件
- ⚠️ settings/ 目录（有多个文件差异）
- ⚠️ styles/themes/ 目录（remu 有 cool-night.css，openhanako 没有）
- ⚠️ 动画 CSS（openhanako 有 `animations.css`）
- ⚠️ 组件 `.module.css` 文件

---

## 立即执行

先执行方案 A 的第 1-3 步，然后测试。

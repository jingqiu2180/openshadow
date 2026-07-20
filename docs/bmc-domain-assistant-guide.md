# OpenShadow · BMC 机型适配领域助手 接入指南（模式 A：交互式助手）

本指南说明如何把 OpenShadow 变成「懂 BMC、自动吃进 adapter2 自身规则、带领域知识」的**交互式编码助手**，服务于领导下半年的重点 **① AI 辅助机型兼容落地 + 内部效率提升**。

模式 A 是**零架构改动**的并存方案：OpenShadow 当你的交互式 BMC 助手，adapter2 的 `run-agent.py` 照常跑它的批量闭环，两者共享同一份领域知识、互不干扰。

---

## 已交付的能力包（本仓库 `adapter` 分支内）
| 文件 | 作用 |
|---|---|
| `lib/yuan/bmc-adapter.md` + `yuan/bmc-adapter.md` | 领域 yuan 类型：人设 + Redfish/BMC 知识 + 真实架构认知 + 行为准则（注入 system prompt） |
| `lib/identity-templates/bmc-adapter.md` | 该类型的身份定义 |
| `lib/ishiki-templates/bmc-adapter.md` | 该类型的行为/人格定义 |
| `skills/bmc-adapter/SKILL.md` | 互补型实战手册：adapter2 **真实**代码架构地图 + 人机协同用法 + 跨厂商 Redfish 方法论（**不重复** adapter2 自身规则） |

> 注：`yuan/` 与 `lib/yuan/` 是构建同步的镜像副本，两处均已建。

---

## 第一步：模型（先用外网，内网友好待接）
用户 2026-07-20 决定：**先用外网模型开发**，内网端点暂不接。
- OpenShadow 已配的外网 provider（OpenAI / DeepSeek / Qwen 等）直接可用。
- 将来接内网：在 `provider-catalog.json` 加一个 `type: custom` 条目（`base_url` + `api_key` + `api: openai-completions`），对话模型设为 `"<providerId>::<modelName>"` 即可，无需改代码。

## 第二步（最关键）：把工作区指向 adapter2 + 打开 CLAUDE.md 注入
1. 在 OpenShadow 里把当前会话/agent 的工作目录设为 **`D:\src\adapter2`**（或你同步到最新的 adapter2 副本）。
2. 在 agent 配置里开启 workspace 指令注入：
   ```yaml
   # agents/<id>/config.yaml（或对应 GUI 设置项）
   workspace_context:
     inject_claude_md: true     # 自动把 adapter2 根目录的 CLAUDE.md 注入 system prompt
     inject_agents_md: false
   ```
   - 代码路径：`core/agent.ts:1452` 读 `this._config.workspace_context`，经 `core/workspace-instruction-files.ts` 从 git 根到 cwd 沿途扫描 `CLAUDE.md` 并注入。
   - **这一步是「领域原生」真正生效的关键**：adapter2 的红线（禁改测试/基类、`@Disabled`、吞异常）、双模式、结构速查会自动成为助手的约束。
3. 顺带：OpenShadow 会自动识别 workspace 里的 `.claude/skills` 目录（`core/engine.ts:47`），因此 adapter2 自带的 **`server-creator`** 与 **`adapter2-test-assertions`** 两个 skill 也会被加载——新机型适配的完整 SOP 直接可用，**无需我们复制**。

## 第三步：选用 bmc-adapter 类型
- **方式 A（配置）**：编辑该 agent 的 `agents/<id>/config.yaml`，设 `agent.yuan: bmc-adapter`，重启 agent。
- **方式 B（向导）**：若 yuan 下拉由 `listYuanKeys()` 填充，则 `bmc-adapter` 会自动出现可选。

## 第四步（推荐）：启用 bmc-adapter 深度 skill
- 把 `skills/bmc-adapter/` 复制到用户技能目录（如 `~/.openshadow/skills/bmc-adapter/`），或在应用内安装；
- 也可放到 adapter2 仓库的 `.agents/skills/bmc-adapter/`（OpenShadow 按 workspace 技能路径自动识别）。
- 启用后助手会补上「真实架构认知地图 + 人机协同用法 + 跨厂商 Redfish 方法论」这三层 openshadow 独有增量。`server-creator` 已覆盖的 inspur 内 SOP 它**不重复**。

---

## 第五步：实测验证（需你开 GUI，我在旁辅助）
1. 打开 OpenShadow，workspace 指向 `D:\src\adapter2`（建议先 `git pull` 同步到与 WSL 真副本一致，避免看到旧代码），开 `inject_claude_md`，选 `bmc-adapter` 类型，加载 skill。
2. 跑 1 个真实小任务，例如：
   - 「讲讲 `CommonM7OpenBmcServer` 里 `getPowerState` 怎么实现的、M8 相对它改了哪些方法」
   - 或「照 `AivresNE3260M7AmiServer` 的结构，给一个新机型写 `getEquipmentDescriptors()` 的 override 骨架」
3. **验收标准**（符合即模式 A 成功）：
   - [ ] assistant 守住了 `CLAUDE.md` 红线：没建议改 `Common*Server` 基类、没建议 `@Disabled`、没建议吞异常；
   - [ ] 产出的类结构正确：叶子类 `extends <Common>*Server`、带 `@Extension`+`@AdapterClass`、只 override 机型特有方法；
   - [ ] 提到了 `Response2AdapterConvert` 的 `ObjectUtil.defaultIfNull` null 兜底，而非自造一套转换；
   - [ ] 不确定字段时主动说「需真机探测 / 查 Redfish 文档」，没编造。

---

## 关于 adapter2 的「两个副本」
- `D:\src\adapter2`（Windows）与 `//wsl$/Ubuntu2204/home/fronted/adapter2`（WSL）是两份。**Java 源码结构一致**，但 WSL 真副本已把 `run-agent.py` 的引擎从 `claude` 换成 `codebuddy`，Windows 副本还停留在旧 `claude`。
- OpenShadow 实际指向的是 `D:\src\adapter2`；**验证前先 sync 到 WSL 一致**，否则助手可能看到滞后代码。

## 与点②（AI 运维新形态）的关系
模式 A 落地后，同一套「领域原生 + 常驻自主」机制可延伸到点②：把 `bmc-adapter` 知识做成「BMC 资产健康自主巡检 / CI 失败自主归因提 PR」等自主场景。那是下一步，本指南只覆盖点①的模式 A。

## 与 run-agent.py 的分工（并存互补）
| 维度 | OpenShadow 助手模式（本指南） | adapter2 run-agent.py 闭环 |
|---|---|---|
| 循环归谁 | 人（你在环，一轮轮 prompt） | 脚本（无人在环，跑 mvn→分类→修→重试→报告） |
| 引擎 | 任意模型（外网 now / 内网 later） | commodity CLI（WSL 真副本已用 codebuddy） |
| 擅长 | 探索/讲解/小步改动/诊断建议 | 批量修测试/新机型流水线/夜跑/CI |
| 知识层 | 共用 adapter2 的 CLAUDE.md + .claude/skills | 共用同一份 |

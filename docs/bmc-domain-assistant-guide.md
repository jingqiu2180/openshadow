# OpenShadow · BMC 机型适配领域助手 接入指南

本指南说明如何把 OpenShadow 变成「领域原生的 BMC / Redfish 机型适配编码助手」，服务于领导下半年的重点 **① AI 辅助机型兼容落地 + 内部效率提升**（adapter2 系 BMC 适配、GitDaily 效率）。

## 已交付的能力包（本仓库内）
| 文件 | 作用 |
|---|---|
| `lib/yuan/bmc-adapter.md` + `yuan/bmc-adapter.md` | 领域 yuan 类型：人设 + Redfish/BMC 知识 + 行为准则（注入 system prompt） |
| `lib/identity-templates/bmc-adapter.md` | 该类型的身份定义 |
| `lib/ishiki-templates/bmc-adapter.md` | 该类型的行为/人格定义 |
| `skills/bmc-adapter/SKILL.md` | 深度实战手册（新增机型适配 SOP + Java/Spring Boot 代码骨架 + 陷阱清单），可开关 |

> 注：`yuan/` 与 `lib/yuan/` 是构建同步的镜像副本，两处均已建，保证无论在 dev 还是打包态都能被 `listYuanKeys()` 发现。

## 第一步：让助手接入内部模型（最关键）
OpenShadow 不能直连公网 OpenAI，必须指向你们**内网的 OpenAI 兼容端点**（vLLM / OneAPI / 网关等）。

在 `provider-catalog.json`（运行态，位于 `~/.openshadow/provider-catalog.json` 或仓库根的 `added-models.yaml`）加入一个 `type: custom` 的条目：

```json
{
  "providers": {
    "bmc-internal": {
      "api_key": "sk-你的内网密钥",
      "base_url": "http://10.x.x.x:8000/v1",
      "api": "openai-completions",
      "models": ["your-bmc-coder", "qwen2.5-72b"]
    }
  }
}
```
并把对话模型设为 `"bmc-internal::your-bmc-coder"`（格式 `${providerId}::${modelName}`）。
也可在应用内「设置 → 模型」直接填 base_url + key（provider 类型选 openai / custom）。

## 第二步：选用 bmc-adapter 类型
- **方式 A（配置）**：编辑该 agent 的 `agents/<id>/config.yaml`，设 `agent.yuan: bmc-adapter`，重启 agent。
- **方式 B（向导）**：若设置 UI 的 yuan 下拉由 `listYuanKeys()` 填充，则 `bmc-adapter` 会自动出现可选。

## 第三步（可选）：启用深度实战 skill
- 把 `skills/bmc-adapter/` 整个目录复制进用户技能目录（如 `~/.hanako/skills/bmc-adapter/`），或在应用内用 `install_skill` 安装；
- 也可放到 adapter2 仓库的 `.agents/skills/bmc-adapter/`，OpenShadow 会按 workspace 技能路径自动识别。
- 启用后，助手在机型适配任务中会主动套用 SOP 与代码骨架。

## 第四步：以 adapter2 仓库为工作区
把 OpenShadow 的工作区指向 adapter2 源码目录，助手即可直接读已有同类机型 adapter 作模板、改代码、跑测试——这是「领域原生」真正生效的关键（知识 + 真实代码上下文）。

## 要真正「实用而非演示」，还差这三项输入
1. **内部模型端点**（URL + key，OpenAI 兼容）——第一步已支持，给我即可接线。
2. **adapter2 仓库访问**——把 OpenShadow 工作区指向它，助手才能读真实代码、照既有约定写。
3. **内部 Redfish 规范 / 厂商字段表**（若有）——可放进 skill 或 `pinned.md`，让助手对齐你们私有的字段命名，而不是只靠通用 Redfish 知识。

> 这三项齐了，OpenShadow 就是一台「懂 BMC、懂你们 adapter2 代码、跑在内网模型上」的机型适配编码助手，直接服务点①的机型兼容落地与效率提升。

## 与点②（AI 运维新形态）的关系
点①（编码助手）落地后，同一套「领域原生 + 常驻自主」机制可延伸到点②：把 `bmc-adapter` 知识的推送模式做成「BMC 资产健康自主巡检 / CI 失败自主归因提 PR」等自主场景。那是下一步，本指南只覆盖点①。

---
name: bmc-adapter
default-enabled: false
---

# BMC 机型适配助手（adapter2 工程）

本 skill 让 openshadow 成为 **adapter2（浪潮 / 多厂商 BMC 适配工程）的交互式助手**。它只负责补 openshadow 在 adapter2 上干活时需要的「工程结构认知 + 人机协同用法」，**所有硬性规则与流程以 adapter2 仓库自身的资料为准**——那些资料会被 openshadow 自动加载，优先级高于本 skill。

## 0. 权威资料（openshadow 自动加载，必须遵守）
把 openshadow 的 workspace 指向 adapter2 根目录、并打开 `inject_claude_md` 后，以下内容会自动注入，优先级高于本 skill：
- `CLAUDE.md` —— 红线（禁改测试 / 基类、`@Disabled`、吞异常、最小修改、修后写 `pattern-usage-log.md`）、双模式（fix / Test-Fix）、项目结构速查、QR9296 笔记。
- `.claude/skills/server-creator` —— 新机型适配完整 SOP（继承链决策表、四层诊断法、BMC 限制关键词、bug pattern、diff 自查、推理报告、经验回流）。openshadow 会自动识别 `.claude/skills` 目录并加载。
- `.claude/skills/adapter2-test-assertions` —— 测试断言规范。

> 本 skill **不重复**上述内容。干活前先读 `CLAUDE.md` 与 `server-creator`；有冲突以它们为准。

## 1. 真实代码架构（认知地图，决定「改哪里、别碰哪」）
- **总体**：Maven 多模块 + **pf4j 插件架构**（由 `com.anarchy.adapter2.boot` 框架驱动，标注 `@AdapterClass` / `@Support`；叶子类用 `org.pf4j.Extension`）。**不是 Spring Boot 直接驱动**。技术栈 JDK 17 / Maven 3+ / JUnit 5 / 4 空格缩进。
- **按厂商分模块**：`adapter2-plugins/adapter2-plugin-server-<vendor>`（现已有 `inspur`，以及 `generic` 内含 dell / hpe / greatwall / nettrix / sugon / suma / sun）。新厂商照此加模块。
- **主包**：`com.anarchy.adapter2`。
- **适配类分层**（以 inspur 为例）：
  - 基类 `CommonM7OpenBmcServer`（package `...inspur.m7.openbmc`）extends `InspurAbstractServer` —— **🔴 禁止修改**（它是共性实现，改了影响所有机型）。
  - 中间 `Common*Server` 层（`CommonM7Server` / `InspurCommonM8Server` / 各代际 `Common*Server`）按机型代际 / 协议栈（OpenBMC vs AMI）切分，逐层累积共性。
  - **叶子机型类**：如 `AivresNE3260M7AmiServer extends NE3260M7AmiServer`，用 `@org.pf4j.Extension` + `@AdapterClass` 标注，**只 `@Override` 该机型特有的方法**（`getEquipmentDescriptors()`、`getBiosPn()` 等），其余继承链复用。
- **转换层**：`...inspur.utils.Response2AdapterConvert`（约 1.1 万行，全静态 `convert2Xxx(DTO)` 方法）——把协议 DTO 映射成统一业务模型。**加字段映射用 `ObjectUtil.defaultIfNull(...)` 做 null 兜底**（修复 NPE / 空字段的常规手法）；🔴 禁止整行删除已有字段映射（功能退化）。
- **协议 / 客户端层**：`com.anarchy.adapter2.protocol.redfish.Redfish`、各代际 `restful.mN.M*Client`（`M7RedfishClient` / `M7BiosService` / `M7PSUClient` / `M7PowerServiceClient`），DTO 在 `restful.mN.dto.*` 与 `protocol.redfish.dto.*`。
- **真实继承链示例**（取自 `server-creator`）：
  - M7 OpenBMC：`CommonM7OpenBmcServer` → `InspurAbstractServer`
  - M8 AMI：`InspurCommonM8Server` → `CommonM7OpenBmcServer`
  - A8 NF3290A8 OpenBMC：`NF3290A8OpenBmcServer` → `InspurAmiOpenBmcA8Server` → `InspurCommonM8Server` → `CommonM7OpenBmcServer`
  - A8 NF5280A8 AMI：`InspurA8Server` → `InspurA7Server` → `CommonM7Server`

## 2. openshadow 在 adapter2 上的正确用法（人机协同）
openshadow 在此工程的定位是 **run-agent.py 的交互式补充**：脚本掌握循环、人在环。适合做的事：
- **读码 / 讲解**：「`CommonM7OpenBmcServer` 里 `getPowerState` 怎么实现的？」「解释 M8 相对 M7 改了哪些方法」。
- **探索性改动**：小步 `@Override` 一个机型特有方法、补一个 Converter null 兜底、对照真机 Redfish 响应修正 `@JsonProperty`。
- **提问 / 诊断**：把 `server-creator` 的四层诊断法用到单个失败上，给出可读的修复建议（不直接批量改）。
- **新厂商脚手架**：照 `adapter2-plugin-server-<vendor>` 结构起模块骨架（`server-creator` 的 SOP 同样适用）。
🔴 不该做的：替 run-agent 跑批量测试闭环；绕过 `CLAUDE.md` 红线（如 `@Disabled`、改基类、吞异常）。

## 3. 跨厂商 Redfish 方法论（openshadow 独有增量）
adapter2 的 `server-creator` 聚焦「inspur 内单机型」，以下是通用跨厂商规律（适配 **新 vendor** 时参考）：
- **先探测后写**：`curl -k -s -u user:pass https://<IP>/redfish/v1/...` 拿真机 JSON，再决定字段映射；绝不凭字段名猜。
- **Oem 是厂商私有区的常态**：温度 / 阈值常被塞进 `Oem`，标准 `Thermal` / `Thresholds` 可能缺失或字段名不同。
- **类型漂移**：真机常把数字写成字符串、`Members` 缺 `@odata.nextLink` 分页；Converter 里统一做 `ObjectUtil.defaultIfNull` / 类型归一。
- **会话自恢复**：`POST /redfish/v1/SessionService/Sessions` 取 `X-Auth-Token`；401 自动重登；调用可重试幂等。🔴 凭证走配置 / 密钥，不落代码日志。
- **向后兼容**：新厂商 / 新机型不得破坏既有机型；新增字段 null 容错。

## 4. 红线（与 CLAUDE.md 一致，重申）
- 不修改 `Common*Server` 基类与既有测试类（`GetMethodsTest` 等）。
- 不 `@Disabled`、不删测试、不吞异常、不做超出当前任务的修改。
- 不整行删 Converter 字段映射；不编造 Redfish 字段；不落明文凭证。
- 改完按 `server-creator` 的 diff 自查 + 最小回归（`mvn -Dtest=<TestClass>#<method> test`），不默认全仓 build。

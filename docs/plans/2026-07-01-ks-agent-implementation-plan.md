# KS Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 KS Agent MVP — 自然语言生成 Kickstart 文件，并通过 API 上传至浪潮 OS 部署产品。

**Architecture:** 
- 作为 OpenShadow Plugin 实现，遵循现有插件结构（manifest.json + index.ts + tools/）
- KS 生成核心依赖 LLM 调用（pi-sdk），Prompt Engineering 是关键
- 上传能力通过 REST API 对接浪潮 OS 部署产品（接口待获取）
- 第一阶段先实现纯前端预览（复制/下载 KS），API 上传作为可插拔模块

**Tech Stack:** 
- OpenShadow Plugin System (TypeScript)
- pi-sdk (LLM 调用)
- axios (HTTP 请求)
- OpenShadow Chat UI (KS 预览展示)

---

## 阶段一：插件脚手架

### Task 1: 创建 KS Agent 插件目录结构

**Files:**
- Create: `plugins/builtin/ks-agent/manifest.json`
- Create: `plugins/builtin/ks-agent/index.ts`
- Create: `plugins/builtin/ks-agent/tools/generate-ks.ts`
- Create: `plugins/builtin/ks-agent/prompts/ks-system-prompt.ts`
- Create: `plugins/builtin/ks-agent/lib/ks-parser.ts`

**Step 1: 创建目录**

```bash
mkdir -p plugins/builtin/ks-agent/tools
mkdir -p plugins/builtin/ks-agent/prompts
mkdir -p plugins/builtin/ks-agent/lib
```

**Step 2: 创建 manifest.json**

```json
{
  "id": "ks-agent",
  "name": "KS Agent",
  "version": "0.1.0",
  "description": "AI 驱动的 Kickstart 文件生成器 — 用自然语言描述需求，自动生成可部署的 KS 文件",
  "trust": "full-access",
  "hidden": false,
  "activationEvents": ["onStartup"],
  "contributes": {
    "commands": [
      {
        "id": "ks-agent.generate",
        "title": "生成 KS 文件"
      }
    ]
  }
}
```

**Step 3: 创建 index.ts**

```typescript
// @ts-nocheck
export default class KsAgentPlugin {
  declare ctx: any;
  async onload() {
    this.ctx.log.info("ks-agent plugin loaded");
  }
}
```

**Step 4: Commit**

```bash
git add plugins/builtin/ks-agent/
git commit -m "feat(ks-agent): scaffold plugin structure"
```

---

### Task 2: 构建 KS System Prompt

**Files:**
- Modify: `plugins/builtin/ks-agent/prompts/ks-system-prompt.ts`

**Step 1: 创建 KS System Prompt**

KS 文件生成的 Prompt 是整个功能的核心质量来源，需要精心设计 few-shot examples。

```typescript
// @ts-nocheck

export const KS_SYSTEM_PROMPT = `You are a Linux Kickstart (KS) file expert. Generate precise, production-ready Kickstart files based on user requirements.

## Output Format
Always output a valid CentOS/RHEL 7/8/9 Kickstart file. No explanations, only the raw KS content.

## Key Sections to Cover
1. **lang, keyboard, timezone** - Localization
2. **network** - Network configuration (hostname, IP, gateway, DNS)
3. **partitions** - Disk partitioning (use 'part' for LVM or 'clearpart' + 'autopart')
4. **bootloader** - Boot loader location and args
5. **repo** - Package repository
6. **%packages** - Package group and individual packages
7. **%pre / %post** - Pre/post install scripts
8. **rootpw** - Root password (hash format or --plaintext)
9. **services** - Enable/disable services
10. **firewall** - Firewall rules
11. **selinux** - SELinux mode

## Common Patterns

### Partitioning Examples
\`\`\`
# LVM partitioning with /boot, / (root), and swap
part /boot --fstype=xfs --size=1024
part pv.01 --grow --fstype=xfs
volgroup vg_root pv.01
logvol / --fstype=xfs --size=51200 --name=lv_root --vgname=vg_root
logvol swap --fstype=swap --size=16384 --name=lv_swap --vgname=vg_root
logvol /home --fstype=xfs --size=102400 --name=lv_home --vgname=vg_root --grow
\`\`\`

### Network Examples
\`\`\`
# Static IP
network --bootproto=static --ip=192.168.1.100 --netmask=255.255.255.0 --gateway=192.168.1.1 --nameserver=8.8.8.8 --hostname=web-server-01 --activate

# DHCP
network --bootproto=dhcp --hostname=web-server-01 --activate
\`\`\`

### Package Examples
\`\`\`
%packages
@^minimal
@standard
httpd
nginx
python3
net-tools
%end
\`\`\`

## Validation Rules
- No duplicate partition declarations
- Logical volume names unique within volume group
- Network device names valid
- IP address format valid (IPv4)
- Packages exist in repo

## Your Task
User will describe their requirements in natural language. Generate ONLY the KS file content, nothing else.
`;

export function buildKsPrompt(userRequest: string): string {
  return \`\${KS_SYSTEM_PROMPT}\n\n## User Requirement\n\${userRequest}\n\n## Generate KS File\n\`;
}
```

**Step 2: Commit**

```bash
git add plugins/builtin/ks-agent/prompts/ks-system-prompt.ts
git commit -m "feat(ks-agent): add KS system prompt with examples"
```

---

### Task 3: 实现 KS 生成 Tool

**Files:**
- Modify: `plugins/builtin/ks-agent/tools/generate-ks.ts`

**Step 1: 实现 generate-ks.ts**

这个 tool 接收自然语言输入，调用 pi-sdk 的 LLM 生成 KS 内容。

```typescript
// @ts-nocheck
import { buildKsPrompt } from '../prompts/ks-system-prompt.js';
import { t } from '../../../../lib/i18n.js';

export const name = "generate-ks";
export const description = "根据自然语言需求生成 CentOS/RHEL Kickstart (KS) 自动化装机文件";

export const parameters = {
  type: "object",
  properties: {
    requirement: {
      type: "string",
      description: "用户对要安装的服务器的描述，例如：'4核16G Web服务器，IP 192.168.1.100，系统盘200G，数据盘500G'",
    },
    osVersion: {
      type: "string",
      description: "操作系统版本，例如：'CentOS 7.9', 'RHEL 8.8', 'CentOS 9'",
      default: "CentOS 7.9",
    },
  },
  required: ["requirement"],
};

export async function execute(input, ctx) {
  const { requirement, osVersion = "CentOS 7.9" } = input;
  
  if (!requirement || requirement.trim().length < 5) {
    return {
      content: [{
        type: "text",
        text: "需求描述太简短，无法生成 KS 文件。请提供更详细的信息，例如：服务器配置、IP、网络要求等。"
      }]
    };
  }

  try {
    // 调用 pi-sdk 的 LLM 接口
    const prompt = buildKsPrompt(\`\${requirement} (OS: \${osVersion})\`);
    
    const response = await ctx.callTool("pi-chat-complete", {
      messages: [{ role: "user", content: prompt }],
      model: ctx.state.model || "minimax::MiniMax-M3",
      temperature: 0.3, // 低 temperature 保证生成稳定性
    });

    // 解析 LLM 返回的 KS 内容
    const ksContent = extractKsContent(response);
    
    return {
      content: [{
        type: "text",
        text: \`✅ KS 文件已生成 (OS: \${osVersion})\n\n\\\`\\\`\\\`kickstart\n\${ksContent}\\\`\\\`\\\`
\`      }],
      ksContent: ksContent, // 供后续下载/上传使用
      metadata: {
        osVersion,
        requirement,
        generatedAt: new Date().toISOString(),
      }
    };
  } catch (err) {
    ctx.log.error("ks-agent: generate failed", err);
    return {
      content: [{
        type: "text",
        text: \`KS 生成失败: \${err?.message || err}\n请稍后重试或调整需求描述。\`
      }]
    };
  }
}

/**
 * 从 LLM 回复中提取 KS 文件内容
 * 处理可能的 markdown 代码块包裹
 */
function extractKsContent(response) {
  let text = "";
  
  if (typeof response === "string") {
    text = response;
  } else if (response?.content?.[0]?.text) {
    text = response.content[0].text;
  } else if (response?.text) {
    text = response.text;
  } else {
    text = JSON.stringify(response);
  }

  // 去掉 markdown 代码块包裹
  const ksMatch = text.match(/```(?:kickstart|anaconda)?\n?([\s\S]*?)```/);
  if (ksMatch) {
    return ksMatch[1].trim();
  }
  
  return text.trim();
}
```

**Step 2: 注册 tool**

需要在插件 index.ts 中注册此 tool（或通过现有 tool 注册机制）。待确认 OpenShadow 插件 tools 注册方式后补全。

**Step 3: Commit**

```bash
git add plugins/builtin/ks-agent/tools/generate-ks.ts
git commit -m "feat(ks-agent): implement generate-ks tool"
```

---

### Task 4: 实现 KS 下载 Tool

**Files:**
- Create: `plugins/builtin/ks-agent/tools/download-ks.ts`

**Step 1: 实现 download-ks.ts**

提供将生成的 KS 内容下载为 .ks 文件的能力。

```typescript
// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { t } from '../../../../lib/i18n.js';

export const name = "download-ks";
export const description = "将 KS 文件内容保存为本地 .ks 文件并返回下载路径";

export const parameters = {
  type: "object",
  properties: {
    ksContent: {
      type: "string",
      description: "KS 文件的完整内容",
    },
    fileName: {
      type: "string",
      description: "保存的文件名（不含扩展名），例如：web-server-01",
      default: "generated-ks",
    },
  },
  required: ["ksContent"],
};

export async function execute(input, ctx) {
  const { ksContent, fileName = "generated-ks" } = input;
  
  // 清理文件名
  const safeName = fileName.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filePath = \`/tmp/\${safeName}.ks\`;
  
  try {
    fs.writeFileSync(filePath, ksContent, "utf-8");
    
    return {
      content: [{
        type: "text",
        text: \`📄 KS 文件已保存: \${filePath}\n可直接复制到 PXE 服务器使用，或通过下方链接下载。\`
      }],
      filePath,
      downloadUrl: \`file://\${filePath}\`,
    };
  } catch (err) {
    return {
      content: [{
        type: "text",
        text: \`保存 KS 文件失败: \${err?.message || err}\`
      }]
    };
  }
}
```

**Step 2: Commit**

```bash
git add plugins/builtin/ks-agent/tools/download-ks.ts
git commit -m "feat(ks-agent): add download-ks tool"
```

---

### Task 5: 实现浪潮 OS 部署产品 API 上传 Tool

**Files:**
- Create: `plugins/builtin/ks-agent/tools/upload-ks-to-inspur.ts`
- Create: `plugins/builtin/ks-agent/lib/inspur-api-client.ts`

> ⚠️ **前提**: 需要浪潮 OS 部署产品的 API 文档（上传接口路径、认证方式）。以下为占位实现，待获取 API 后修正。

**Step 1: 创建 API Client 占位**

```typescript
// @ts-nocheck

/**
 * 浪潮 OS 部署产品 API Client
 * 
 * TODO: 获取 API 文档后补充以下信息：
 * - baseUrl: OS 部署产品的 API 地址
 * - auth: 认证方式（Bearer Token / Basic Auth / API Key）
 * - upload endpoint: KS 文件上传接口路径和格式
 */

export interface InspurApiConfig {
  baseUrl: string;       // 例如: "http://inspur-os-deploy.internal/api"
  apiKey?: string;        // API Key 或 Token
  username?: string;
  password?: string;
}

export const DEFAULT_CONFIG: InspurApiConfig = {
  baseUrl: "",           // TODO: 待配置
};

export async function uploadKsFile(
  ksContent: string,
  fileName: string,
  config: InspurApiConfig = DEFAULT_CONFIG
): Promise<{ success: boolean; message: string; taskId?: string }> {
  if (!config.baseUrl) {
    return {
      success: false,
      message: "浪潮 OS 部署产品 API 地址未配置，请在设置中配置 baseUrl"
    };
  }

  try {
    const formData = new FormData();
    formData.append("file", new Blob([ksContent]), \`\${fileName}.ks\`);
    formData.append("name", fileName);
    
    const headers = {};
    if (config.apiKey) {
      headers["Authorization"] = \`Bearer \${config.apiKey}\`;
    }

    const response = await fetch(\`\${config.baseUrl}/ks/upload\`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        message: \`上传失败: HTTP \${response.status} \${response.statusText}\`
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: "KS 文件上传成功",
      taskId: result.taskId || result.id,
    };
  } catch (err) {
    return {
      success: false,
      message: \`上传异常: \${err?.message || err}\`
    };
  }
}
```

**Step 2: 创建 upload-ks Tool**

```typescript
// @ts-nocheck
import { uploadKsFile, DEFAULT_CONFIG } from '../lib/inspur-api-client.js';
import { t } from '../../../../lib/i18n.js';

export const name = "upload-ks-to-inspur";
export const description = "将 KS 文件上传至浪潮 OS 部署产品（需先配置 API 地址）";

export const parameters = {
  type: "object",
  properties: {
    ksContent: {
      type: "string",
      description: "KS 文件内容",
    },
    fileName: {
      type: "string",
      description: "文件名（不含 .ks 后缀），例如：web-server-01",
    },
    apiBaseUrl: {
      type: "string",
      description: "浪潮 OS 部署产品 API 地址（首次使用需配置）",
    },
    apiKey: {
      type: "string",
      description: "API Key（首次使用需配置）",
    },
  },
  required: ["ksContent", "fileName"],
};

export async function execute(input, ctx) {
  const { ksContent, fileName, apiBaseUrl, apiKey } = input;
  
  const config = {
    baseUrl: apiBaseUrl || ctx.state.inspurOsApiBaseUrl || DEFAULT_CONFIG.baseUrl,
    apiKey: apiKey || ctx.state.inspurOsApiKey,
  };

  if (!config.baseUrl) {
    return {
      content: [{
        type: "text",
        text: "浪潮 OS 部署产品 API 地址未配置。请提供 apiBaseUrl 参数，或在插件设置中配置。"
      }]
    };
  }

  const result = await uploadKsFile(ksContent, fileName, config);
  
  return {
    content: [{
      type: "text",
      text: result.success 
        ? \`✅ \${result.message}\n任务 ID: \${result.taskId || 'N/A'}\`
        : \`❌ \${result.message}\`
    }]
  };
}
```

**Step 3: Commit**

```bash
git add plugins/builtin/ks-agent/tools/upload-ks-to-inspur.ts
git add plugins/builtin/ks-agent/lib/inspur-api-client.ts
git commit -m "feat(ks-agent): add Inspur OS API upload tool (stub)"
```

---

## 阶段二：Prompt 调优与测试

### Task 6: 构建 Prompt Few-Shot Examples

**Files:**
- Modify: `plugins/builtin/ks-agent/prompts/ks-system-prompt.ts`

**Step 1: 添加真实场景 Examples**

完善 KS_SYSTEM_PROMPT，增加 3-5 个真实场景的 few-shot examples，覆盖：
- Web 服务器（固定 IP + httpd）
- 数据库服务器（双磁盘分区）
- 最小化安装
- 带数据盘的存储服务器

Examples 质量直接影响生成效果，这一步至关重要。

---

### Task 7: E2E 测试

**Files:**
- Create: `tests/e2e/ks-agent.spec.ts`

**Step 1: 编写 Playwright E2E 测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('KS Agent', () => {
  test('generate KS from natural language', async ({ page }) => {
    await page.goto('/');
    
    // 选择 workspace
    await page.click('[data-testid="workspace-select"]');
    await page.fill('[data-testid="workspace-input"]', '/tmp/test-workspace');
    await page.click('[data-testid="workspace-confirm"]');
    
    // 创建 Agent
    await page.click('[data-testid="new-agent"]');
    await page.fill('[data-testid="agent-name"]', 'KS Test Agent');
    await page.click('[data-testid="agent-save"]');
    
    // 发送 KS 生成请求
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('帮我生成一个 4 核 16G 的 Web 服务器 KS 文件，IP 是 192.168.1.100');
    await chatInput.press('Enter');
    
    // 等待回复
    await page.waitForSelector('[data-testid="chat-response"]', { timeout: 30000 });
    
    // 验证回复包含 KS 内容
    const response = await page.locator('[data-testid="chat-response"]').textContent();
    expect(response).toContain('network');
    expect(response).toContain('192.168.1.100');
    expect(response).toContain('part');
  });
});
```

**Step 2: 运行测试验证**

```bash
cd /root/.openclaw/workspace/openshadow
npm run test:e2e -- --grep "KS Agent"
```

---

## 阶段三：API 对接与集成

### Task 8: 获取浪潮 OS 部署产品 API 文档

> 这是关键路径任务，阻塞后续集成。

**Action**: 协调浪潮 OS 部署产品团队，获取：
1. KS 文件上传 API 接口文档
2. 认证方式（Token/API Key）
3. Base URL 配置

### Task 9: 完成 API Client 实现

**Files:**
- Modify: `plugins/builtin/ks-agent/lib/inspur-api-client.ts`

根据 Task 8 获取的 API 文档，修正 `uploadKsFile` 实现。

### Task 10: 插件配置 UI

**Files:**
- Create: `plugins/builtin/ks-agent/settings.ts`

在 OpenShadow 设置界面中添加 KS Agent 配置项：
- 浪潮 OS 部署产品 API Base URL
- API Key

---

## 执行选项

**Plan complete and saved to `docs/plans/2026-07-01-ks-agent-implementation-plan.md`**

两个执行选项：

**1. Subagent-Driven (当前 session)** — 我作为主控，逐个派发子代理执行每个 Task，任务间 review，速度快

**2. Parallel Session (新 session)** — 在新 session 中使用 executing-plans，批次执行带检查点

选哪个？`

export interface PersonalityTemplate {
  name: string
  greeting: string
  tone: string
  traits: string[]
  response_style: {
    use_emoji: boolean
    max_length: number
    language: string
    creativity?: number // 0-1, how creative/risky the responses are
  }
}

/**
 * Build a system prompt from a personality template.
 * This is injected as the system message for every chat.
 *
 * @param template  the personality (from default.json or custom)
 * @param userName  how to address the user (from config.user.name, Stage 1a)
 */
export function buildSystemPrompt(template: PersonalityTemplate, userName?: string): string {
  const traits = template.traits.join('、')
  const emojiNote = template.response_style.use_emoji ? '适当使用 emoji 让对话更生动' : '尽量少用或不用 emoji'
  const userBlock = userName
    ? `\n## 用户\n- 用户的名字是 **${userName}**,在对话中用这个名字称呼他/她（除非他/她让你换个叫法）。`
    : ''

  return `你是 ${template.name}。
${userBlock}
## 基本设定
- 名字：${template.name}
- 性格：${template.tone}
- 特征：${traits}

## 回复要求
- 语言：${template.response_style.language === 'zh' ? '主要使用中文' : `使用 ${template.response_style.language}`}
- 长度：不超过 ${template.response_style.max_length} 字
- emoji：${emojiNote}
${template.response_style.creativity !== undefined ? `- 创造力：${Math.round(template.response_style.creativity * 100)}%` : ''}

## 行为准则
- 善良、有耐心、善于倾听
- 主动帮助用户解决问题
- 如果不确定某事，诚实告知
- 不要编造事实或给出不确定的建议
- 记住重要的上下文信息

记住：你是一个有灵魂的 AI 助手，不是冰冷的工具。

## 能力指南
遇到复杂任务时，使用 plan_execute 工具来分解任务并逐步执行。

可用工具：
- file_read / file_write / file_list — 文件操作
- bash — 执行命令行
- capture_screenshot / analyze_screenshot — 屏幕截图和视觉分析
- mouse_move / mouse_click / mouse_drag — 鼠标控制
- keyboard_type / keyboard_hotkey — 键盘控制
- window_activate / get_screen_size — 窗口和屏幕管理
- browser_new / browser_navigate / browser_screenshot / browser_click / browser_type / browser_press_key / browser_get_text / browser_close — 浏览器自动化
- plan_execute — 复杂任务规划执行（自动拆解步骤+验证）

硬性原则（必须遵守，违反会出错）：
- **当用户说"创建/写/建/打开/截图/执行/搜索/看/列出/运行/删除/移动"等动作指令时，必须先调用对应工具执行，不要解释、不要客套、不要让用户手动做**。
- **绝对不要**用"我这里出了点小问题"、"无法直接帮你"、"你可以手动..."这类话术回复——所有用户能说的话我都有工具能做。
- 工具调用失败时，**把工具返回的 error 字段原文告诉用户**，不要软化、不要掩饰、不要自己改成"小问题"。
- 鼠标/浏览器操作前，先 capture_screenshot 看当前状态再决定。
- 不确定用哪个工具时，默认先用 plan_execute 规划。
- 高风险操作（删除、格式化、覆盖）必须先用 capture_screenshot 确认目标。

示例（必须照做）：
- "建一个文件夹" → 直接调 bash 工具（command="mkdir -p <path>"），不要说"我无法创建"或"你可以手动"
- "截图" → 直接调 capture_screenshot 工具
- "打开百度" → 先调 browser_new 工具打开浏览器，再调 browser_navigate 工具（url="https://www.baidu.com"）
- 工具真的报错了，再把错误告诉用户

善用你的能力，能动手就别动口。`
}

export function validateTemplate(template: unknown): template is PersonalityTemplate {
  if (!template || typeof template !== 'object') return false
  const t = template as Record<string, unknown>
  return (
    typeof t.name === 'string' &&
    typeof t.greeting === 'string' &&
    typeof t.tone === 'string' &&
    Array.isArray(t.traits) &&
    t.traits.every((tr: unknown) => typeof tr === 'string') &&
    typeof t.response_style === 'object' &&
    t.response_style !== null &&
    typeof (t.response_style as Record<string, unknown>).use_emoji === 'boolean' &&
    typeof (t.response_style as Record<string, unknown>).max_length === 'number' &&
    typeof (t.response_style as Record<string, unknown>).language === 'string'
  )
}

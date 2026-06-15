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
 */
export function buildSystemPrompt(template: PersonalityTemplate): string {
  const traits = template.traits.join('、')
  const emojiNote = template.response_style.use_emoji ? '适当使用 emoji 让对话更生动' : '尽量少用或不用 emoji'

  return `你是 ${template.name}。

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
- plan_execute — 复杂任务规划执行（自动拆解步骤+验证）

重要原则：
- 不确定时，优先截图看看当前屏幕状态
- 复杂任务用 plan_execute，自动分解步骤并验证结果
- 鼠标操作前先截图确认目标位置
- 高风险操作谨慎执行

善用你的能力。`
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

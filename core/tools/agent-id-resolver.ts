/**
 * agent-id-resolver.ts
 * 简单的 agent ID 解析器（参考 openhanako）
 */

/**
 * 解析 agent 参数，返回 agent ID
 * @param param - 可以是 agent ID 字符串，或者包含 agentId 的对象
 * @param listAgents - 获取 agent 列表的函数
 * @returns 解析后的 agent ID，如果找不到返回 undefined
 */
export function resolveAgentParam(
  param: any,
  listAgents?: () => Array<{ id: string; name: string }>
): string | undefined {
  if (!param) return undefined

  // 如果 param 是字符串，直接返回
  if (typeof param === 'string') {
    // 去除可能的 @ 前缀
    const id = param.replace(/^@/, '').trim()
    if (!id) return undefined

    // 如果有 listAgents，验证 ID 是否存在
    if (listAgents) {
      const agents = listAgents()
      const found = agents.find(a => a.id === id || a.name === id)
      return found ? found.id : id // 找不到也返回原 ID，让调用方处理错误
    }
    return id
  }

  // 如果 param 是对象，尝试提取 agentId
  if (typeof param === 'object' && param !== null) {
    return param.agentId || param.id || undefined
  }

  return undefined
}

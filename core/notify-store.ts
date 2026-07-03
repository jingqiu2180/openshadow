/**
 * Notification Store（简化版）
 * 存储通知记录，支持查询
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd(), 'data')
const NOTIFY_PATH = path.join(ROOT, 'notifications.jsonl')

interface Notification {
  id: string
  title: string
  body: string
  audience: string
  channels: string[]
  bridgePlatforms: string[]
  contextPolicy: string
  sent: boolean
  error?: string
  createdAt: string
}

export function notify(opts: {
  title: string
  body: string
  audience?: string
  channels?: string[]
  bridgePlatforms?: string[]
  contextPolicy?: string
}): { sent: boolean; error?: string } {
  const notification: Notification = {
    id: `notify_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: opts.title,
    body: opts.body,
    audience: opts.audience || 'owner',
    channels: opts.channels || ['auto'],
    bridgePlatforms: opts.bridgePlatforms || [],
    contextPolicy: opts.contextPolicy || 'none',
    sent: false,
    createdAt: new Date().toISOString(),
  }

  try {
    // 打印到控制台（简化版投递）
    console.log(`\n🔔 通知：${opts.title}`)
    console.log(`   内容：${opts.body}`)
    if (opts.channels) console.log(`   渠道：${opts.channels.join(', ')}`)
    console.log()

    // 写文件记录
    fs.mkdirSync(ROOT, { recursive: true })
    fs.appendFileSync(NOTIFY_PATH, JSON.stringify(notification) + '\n')

    notification.sent = true
    return { sent: true }
  } catch (err: any) {
    notification.error = err.message
    return { sent: false, error: err.message }
  }
}

export function getNotifications(limit: number = 20): Notification[] {
  if (!fs.existsSync(NOTIFY_PATH)) return []
  const raw = fs.readFileSync(NOTIFY_PATH, 'utf8')
  const lines = raw.split('\n').filter(l => l.trim())
  const all = lines.map(l => JSON.parse(l)) as Notification[]
  return all.slice(-limit).reverse()
}

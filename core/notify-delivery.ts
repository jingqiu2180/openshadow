// @ts-nocheck
/**
 * notify-delivery.ts — 通知投递层
 * 移植自 openhanako 的 onNotify 回调实现
 */
import notifier from 'node-notifier'
import path from 'path'

export interface NotifyPayload {
  title: string
  body: string
  audience?: string[]
  channels?: string[]
  bridgePlatforms?: string[]
  contextPolicy?: 'none' | 'record_when_delivered'
}

export interface NotifyResult {
  ok: boolean
  deliveries?: Array<{ channel: string; status: string; error?: string }>
}

/**
 * 发送桌面通知（主要投递方式）
 */
function deliverDesktop(payload: NotifyPayload): Promise<{ status: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      notifier.notify(
        {
          title: payload.title,
          message: payload.body,
          icon: path.join(process.cwd(), 'assets', 'icon.png'), // 可选图标
          sound: true,
          wait: true,
        },
        (err: any, _response: any, _metadata: any) => {
          if (err) {
            resolve({ status: 'failed', error: err.message })
          } else {
            resolve({ status: 'delivered' })
          }
        }
      )
    } catch (err: any) {
      resolve({ status: 'failed', error: err.message })
    }
  })
}

/**
 * onNotify 投递函数（供 notify-tool 调用）
 */
export async function onNotify(payload: NotifyPayload): Promise<NotifyResult> {
  const deliveries: Array<{ channel: string; status: string; error?: string }> = []

  // 默认使用 desktop 通道
  const channels = payload.channels || ['desktop']

  for (const channel of channels) {
    if (channel === 'desktop' || channel === 'auto') {
      const result = await deliverDesktop(payload)
      deliveries.push({ channel: 'desktop', ...result })
    }
    // bridge_owner 通道暂未实现（需要 Bridge 系统）
    // wechat/feishu/telegram/qq 通道暂未实现
  }

  const ok = deliveries.some(d => d.status === 'delivered')
  return { ok, deliveries }
}

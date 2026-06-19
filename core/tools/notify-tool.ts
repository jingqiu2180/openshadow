// @ts-nocheck
/**
 * notify-tool.ts — 用户通知工具
 * 移植自 openhanako/lib/tools/notify-tool.ts
 * 让 agent 能主动向用户发送提醒
 */
import type { ToolRegistry } from '../tool-registry'
import { createToolSpec } from '../tool-registry'
import { onNotify } from '../notify-delivery'
import { t } from '../i18n'

export function registerNotifyTool(registry: ToolRegistry): void {
  registry.register(
    'notify',
    createToolSpec('notify', {
      description: 'Send a notification to the user. Choose desktop popup, Bridge owner chat, or the default channel according to the task; pass bridgePlatforms when delivery must go to one or more explicit Bridge platforms such as WeChat, Feishu, Telegram, or QQ.\nUse cases:\n- The user says "remind me about xxx", "notify me when...", "don\'t let me forget xxx"\n- A scheduled task prompt explicitly includes notification intent or asks to send it through Bridge/WeChat\n- A monitoring/scheduled task discovers something requiring user attention\nIf everything is normal with no issues, do not call this tool. Successful Bridge notifications can be appended to that conversation context according to contextPolicy.',
      params: {
        title: { type: 'string', description: 'Notification title (brief)' },
        body: { type: 'string', description: 'Notification content' },
        audience: {
          type: 'array',
          items: { type: 'string', enum: ['owner'] },
          description: 'Notification audience. Use owner for the human user.',
        },
        channels: {
          type: 'array',
          items: { type: 'string', enum: ['auto', 'desktop', 'bridge_owner'] },
          description: 'Delivery channels. Use desktop for local popup, bridge_owner for the owner\'s Bridge chat, or auto for default routing. Do not include a channel unless the user asked for it or the task prompt implies it.',
        },
        bridgePlatforms: {
          type: 'array',
          items: { type: 'string', enum: ['wechat', 'feishu', 'telegram', 'qq'] },
          description: 'Explicit Bridge platform fan-out targets when channels includes bridge_owner. Provide multiple values to send the same notification to multiple platforms.',
        },
        contextPolicy: {
          type: 'string',
          enum: ['none', 'record_when_delivered'],
          description: 'Whether a successfully delivered Bridge notification should be appended to the Bridge conversation context.',
        },
      },
    }),
    async (args: any) => {
      const { title, body } = args
      try {
        const result: any = await onNotify({
          title,
          body,
          audience: args.audience,
          channels: args.channels,
          bridgePlatforms: args.bridgePlatforms,
          contextPolicy: args.contextPolicy,
        })
        const sent = result?.ok !== false
        const failure = Array.isArray(result?.deliveries)
          ? result.deliveries.find((d: any) => d?.status === 'failed')?.error
          : null
        return {
          content: [
            {
              type: 'text',
              text: sent
                ? t('error.notifySent', { title })
                : t('error.notifyFailed', { msg: failure || 'delivery failed' }),
            },
          ],
          details: { title, body, sent, result },
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: t('error.notifyFailed', { msg: err.message }) }],
          details: { title, body, sent: false, error: err.message },
        }
      }
    }
  )
}

// @ts-nocheck
export function emitAppEvent(engine: any, eventName: string, payload: any) {
  // stub — 桌面端事件通知
}

export function toAppEventWsMessage(event: any): any {
  // stub — 将 AppEvent 转换为 WebSocket 消息
  return { type: 'app_event', event };
}

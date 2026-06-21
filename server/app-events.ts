// @ts-nocheck
/**
 * App 级事件（agent 切换、locale 变更等）的发射 + WS 序列化。
 *
 * 设计（与 openhanako 对齐）：
 *   - emitAppEvent(engine, type, payload)  把 App 事件注入引擎 hub
 *   - toAppEventWsMessage(event)      WS 协议层；只处理已经是 app_event 的
 *                               事件，其余返回 null 让调用方走普通流式路径。
 */

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizePayload(payload, context) {
  if (payload === undefined) return {};
  if (isPlainObject(payload)) return payload;
  console.warn(`[app-events] invalid payload for ${context}; expected plain object`);
  return null;
}

function normalizeSource(source) {
  if (source === undefined) return "server";
  if (typeof source === "string" && source) return source;
  console.warn("[app-events] invalid source for app_event; expected non-empty string");
  return null;
}

/**
 * 从引擎侧发射一个 App 级事件（agent-switched、locale-changed 等）。
 * 事件会被 hub 广播，再由 toAppEventWsMessage 序列化为 WS 消息。
 */
export function emitAppEvent(engine, type, payload = undefined) {
  if (typeof type !== "string" || !type) return;
  const normalizedPayload = normalizePayload(payload, type);
  if (!normalizedPayload) return;

  engine.emitEvent?.({
    type: "app_event",
    event: {
      type,
      payload: normalizedPayload,
      source: "server",
    },
  }, null);
}

/**
 * WS 协议层：把 hub 事件转换成 WS 出站消息。
 *
 * 只处理已经是 { type: "app_event", event: { type, payload, source } } 格式的
 * 事件（即由 emitAppEvent 注入的事件）。其余 session 级事件返回 null，
 * 让调用方（hub.subscribe 回调）继续走 emitStreamEvent 路径。
 */
export function toAppEventWsMessage(event) {
  if (event?.type !== "app_event") return null;
  if (typeof event.event?.type !== "string" || !event.event.type) return null;
  const payload = normalizePayload(event.event.payload, event.event.type);
  if (!payload) return null;
  const source = normalizeSource(event.event.source);
  if (!source) return null;

  return {
    type: "app_event",
    event: {
      type: event.event.type,
      payload,
      source,
    },
  };
}

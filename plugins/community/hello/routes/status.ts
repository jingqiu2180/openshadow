// @ts-nocheck
/**
 * 示例路由：获取插件状态
 * 挂载路径：GET /plugins/hello/status
 */
export const method = "get";
export const path = "/status";
export const description = "获取 hello 插件状态";

export async function handler(params: { body: unknown; query: Record<string, string>; headers: Record<string, string> }) {
  return {
    plugin: "hello",
    status: "ok",
    timestamp: new Date().toISOString(),
    query: params.query,
  };
}

/**
 * 示例路由：获取用户详情（带路径参数）
 * 挂载路径：GET /plugins/hello/users/:id
 */
export const method = "get";
export const path = "/users/:id";
export const description = "获取用户详情（带路径参数示例）";

export async function handler(params: { body: unknown; query: Record<string, string>; headers: Record<string, string>; params: Record<string, string> }) {
  return {
    plugin: "hello",
    user: {
      id: params.params.id,
      name: `User ${params.params.id}`,
      email: `user${params.params.id}@example.com`,
    },
    timestamp: new Date().toISOString(),
    query: params.query,
  };
}

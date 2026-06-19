// @ts-nocheck
export const name = "say_hello";
export const description = "Say hello to someone";
export const parameters = {
  type: "object",
  properties: {
    name: { type: "string", description: "Name to greet" }
  },
  required: ["name"]
};

export async function execute(params: Record<string, unknown>, _ctx: unknown): Promise<string> {
  const name = (params.name as string) ?? "World";
  return `Hello, ${name}! (from hello plugin)`;
}

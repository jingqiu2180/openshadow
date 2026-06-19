// @ts-nocheck
// core/tools/tool-result.ts
// Standardized tool result constructors (from openhanako lib/tools/tool-result.ts)

export function toolOk(text: string, details: Record<string, any> = {}) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function toolError(text: string, details: Record<string, any> = {}) {
  return {
    content: [{ type: "text" as const, text }],
    details: { ...details, error: text },
  };
}

// core/tools/tool-session.ts
// Simplified tool session helpers (from openhanako lib/tools/tool-session.ts)

/**
 * Get the current tool session path.
 * In remu, we use cwd as session path (simplified).
 */
export function getToolSessionPath(ctx: any): string {
  if (ctx?.sessionPath) return ctx.sessionPath;
  return process.cwd();
}

/**
 * Get the current tool session cwd.
 * In remu, we use cwd as session cwd (simplified).
 */
export function getToolSessionCwd(ctx: any): string {
  if (ctx?.cwd) return ctx.cwd;
  return process.cwd();
}

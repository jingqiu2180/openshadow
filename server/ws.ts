import type { Context } from 'hono'

// Placeholder — full implementation in Task 7
export async function wsHandler(c: Context) {
  return c.json({ message: 'WebSocket endpoint — implementation in Task 7' })
}

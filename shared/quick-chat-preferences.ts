/**
 * quick-chat-preferences.ts — 快速聊天入口偏好（inline definition）
 */

export interface QuickChatPreferences {
  shortcut: string;
  reuseTimeoutMinutes: number;
  windowSize?: { width: number; height: number };
}

export const DEFAULT_QUICK_CHAT_SHORTCUT = 'Alt+Space';
export const DEFAULT_QUICK_CHAT_REUSE_TIMEOUT_MINUTES = 5;

export function normalizeQuickChatPreferences(raw: any): QuickChatPreferences {
  return {
    shortcut: typeof raw?.shortcut === 'string' ? raw.shortcut : DEFAULT_QUICK_CHAT_SHORTCUT,
    reuseTimeoutMinutes: typeof raw?.reuseTimeoutMinutes === 'number'
      ? Math.max(1, Math.min(60, raw.reuseTimeoutMinutes))
      : DEFAULT_QUICK_CHAT_REUSE_TIMEOUT_MINUTES,
    windowSize: raw?.windowSize || undefined,
  };
}

export function mergeQuickChatPreferences(
  current: QuickChatPreferences,
  partial: Partial<QuickChatPreferences>,
): QuickChatPreferences {
  return {
    shortcut: partial.shortcut ?? current.shortcut ?? DEFAULT_QUICK_CHAT_SHORTCUT,
    reuseTimeoutMinutes: partial.reuseTimeoutMinutes ?? current.reuseTimeoutMinutes ?? DEFAULT_QUICK_CHAT_REUSE_TIMEOUT_MINUTES,
    windowSize: partial.windowSize || current.windowSize,
  };
}

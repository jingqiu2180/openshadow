// @ts-nocheck
export interface PIIRule {
  pattern: RegExp
  label: string
  replacement: (match: string) => string
}

export interface PIIDetection {
  label: string
  original: string
  redacted: string
  position: { start: number; end: number }
}

const DEFAULT_RULES: PIIRule[] = [
  {
    pattern: /\b\d{6,19}\b/g,
    label: 'bank_card',
    replacement: (m) => m.slice(0, 4) + '****' + m.slice(-4),
  },
  {
    pattern: /\b1[3-9]\d{9}\b/g,
    label: 'phone_cn',
    replacement: (m) => m.slice(0, 3) + '****' + m.slice(-4),
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: 'email',
    replacement: (m) => {
      const [local, domain] = m.split('@')
      return local.slice(0, 2) + '***@' + domain
    },
  },
  {
    pattern: /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    label: 'id_card_cn',
    replacement: (m) => m.slice(0, 6) + '********' + m.slice(-4),
  },
  {
    pattern: /(?:sk|pk|api[_-]?key|token|secret|password|bearer)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{8,})['"]?/gi,
    label: 'api_key',
    replacement: (m) => m.replace(/[A-Za-z0-9_\-]{8,}/g, '***REDACTED***'),
  },
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    label: 'ip_address',
    replacement: () => 'x.x.x.x',
  },
]

export class PIIProtector {
  private readonly rules: PIIRule[]
  private readonly enabledLabels: Set<string>

  constructor(options?: { rules?: PIIRule[]; enableOnly?: string[] }) {
    this.rules = options?.rules ?? DEFAULT_RULES
    this.enabledLabels = options?.enableOnly
      ? new Set(options.enableOnly)
      : new Set(this.rules.map(r => r.label))
  }

  redact(text: string): string {
    let result = text
    for (const rule of this.rules) {
      if (!this.enabledLabels.has(rule.label)) continue
      result = result.replace(rule.pattern, (match) => rule.replacement(match))
    }
    return result
  }

  detect(text: string): PIIDetection[] {
    const detections: PIIDetection[] = []
    for (const rule of this.rules) {
      if (!this.enabledLabels.has(rule.label)) continue
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        detections.push({
          label: rule.label,
          original: match[0],
          redacted: rule.replacement(match[0]),
          position: { start: match.index, end: match.index + match[0].length },
        })
      }
    }
    return detections
  }

  hasPII(text: string): boolean {
    return this.detect(text).length > 0
  }

  redactMessages(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
    return messages.map(msg => ({
      role: msg.role,
      content: this.redact(msg.content),
    }))
  }
}

export const piiProtector = new PIIProtector()

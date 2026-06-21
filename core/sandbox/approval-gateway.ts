// @ts-nocheck
import { eventBus } from '../event-bus.js'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ApprovalRequest {
  id: string
  agentId: string
  sessionId: string
  operation: string
  target: string
  riskLevel: RiskLevel
  details: string
  timestamp: number
  autoApproved: boolean
}

export interface ApprovalDecision {
  requestId: string
  approved: boolean
  reason?: string
  approver?: string
  timestamp: number
}

interface ApprovalRule {
  operation: string
  targetPattern?: RegExp
  riskLevel: RiskLevel
  autoApprove: boolean
  requireReason: boolean
}

const DEFAULT_RULES: ApprovalRule[] = [
  { operation: 'file:read', riskLevel: 'low', autoApprove: true, requireReason: false },
  { operation: 'file:write', targetPattern: /\.tmp$|\.log$/, riskLevel: 'low', autoApprove: true, requireReason: false },
  { operation: 'file:write', riskLevel: 'medium', autoApprove: false, requireReason: true },
  { operation: 'file:delete', riskLevel: 'high', autoApprove: false, requireReason: true },
  { operation: 'command:execute', targetPattern: /^(ls|cat|echo|pwd|which|git status|git log|git diff)/, riskLevel: 'low', autoApprove: true, requireReason: false },
  { operation: 'command:execute', riskLevel: 'medium', autoApprove: false, requireReason: true },
  { operation: 'command:execute', targetPattern: /rm |mkfs|dd |format/, riskLevel: 'critical', autoApprove: false, requireReason: true },
  { operation: 'network:request', riskLevel: 'low', autoApprove: true, requireReason: false },
  { operation: 'network:request', targetPattern: /localhost|127\.0\.0\.1/, riskLevel: 'low', autoApprove: true, requireReason: false },
  { operation: 'memory:write', riskLevel: 'low', autoApprove: true, requireReason: false },
  { operation: 'memory:delete', riskLevel: 'medium', autoApprove: false, requireReason: true },
  { operation: 'system:config', riskLevel: 'high', autoApprove: false, requireReason: true },
]

export class ApprovalGateway {
  private readonly rules: ApprovalRule[]
  private readonly pendingRequests = new Map<string, {
    request: ApprovalRequest
    resolve: (decision: ApprovalDecision) => void
  }>()
  private readonly autoApproveLow: boolean
  private idCounter = 0

  constructor(options?: { rules?: ApprovalRule[]; autoApproveLow?: boolean }) {
    this.rules = options?.rules ?? DEFAULT_RULES
    this.autoApproveLow = options?.autoApproveLow ?? true
  }

  async requestApproval(params: {
    agentId: string
    sessionId: string
    operation: string
    target: string
    details?: string
  }): Promise<ApprovalDecision> {
    const riskLevel = this.assessRisk(params.operation, params.target)
    const autoApproved = this.shouldAutoApprove(params.operation, params.target, riskLevel)

    const request: ApprovalRequest = {
      id: `approval_${++this.idCounter}_${Date.now()}`,
      agentId: params.agentId,
      sessionId: params.sessionId,
      operation: params.operation,
      target: params.target,
      riskLevel,
      details: params.details ?? '',
      timestamp: Date.now(),
      autoApproved,
    }

    if (autoApproved) {
      return {
        requestId: request.id,
        approved: true,
        reason: 'Auto-approved: low risk operation',
        timestamp: Date.now(),
      }
    }

    return new Promise((resolve) => {
      this.pendingRequests.set(request.id, { request, resolve })
      eventBus.emit('system:error', {
        error: new Error(`Approval required: ${params.operation} on ${params.target} (risk: ${riskLevel})`),
        context: `requestId=${request.id}`,
      })
    })
  }

  resolve(requestId: string, approved: boolean, reason?: string, approver?: string): boolean {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return false

    pending.resolve({
      requestId,
      approved,
      reason,
      approver,
      timestamp: Date.now(),
    })
    this.pendingRequests.delete(requestId)
    return true
  }

  getPendingRequests(): ApprovalRequest[] {
    return [...this.pendingRequests.values()].map(p => p.request)
  }

  assessRisk(operation: string, target: string): RiskLevel {
    for (const rule of this.rules) {
      if (!operation.startsWith(rule.operation.split(':')[0])) continue
      if (rule.targetPattern && !rule.targetPattern.test(target)) continue
      return rule.riskLevel
    }
    return 'medium'
  }

  private shouldAutoApprove(operation: string, target: string, riskLevel: RiskLevel): boolean {
    if (riskLevel === 'critical') return false
    if (riskLevel === 'high') return false

    for (const rule of this.rules) {
      if (operation !== rule.operation) continue
      if (rule.targetPattern && !rule.targetPattern.test(target)) continue
      if (rule.autoApprove) return true
    }

    if (this.autoApproveLow && riskLevel === 'low') return true
    return false
  }

  addRule(rule: ApprovalRule): void {
    this.rules.push(rule)
  }

  removeRule(operation: string, targetPattern?: string): void {
    const idx = this.rules.findIndex(r => {
      if (r.operation !== operation) return false
      if (targetPattern && r.targetPattern?.source !== targetPattern) return false
      return true
    })
    if (idx >= 0) this.rules.splice(idx, 1)
  }
}

export const approvalGateway = new ApprovalGateway()

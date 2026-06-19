// @ts-nocheck
import { appendSecurityAuditEvent } from '../../core/security-audit-log';
import { readAuthPrincipal } from './capability-guard';

export function recordSecurityAuditEvent(c, engine, {
  action,
  target = null,
  result = "success",
  secretFields = [],
  metadata = {},
  decision = null,
  leaseId = null,
  errorCode = null,
}: {
  action?: any;
  target?: any;
  result?: string;
  secretFields?: any[];
  metadata?: Record<string, any>;
  decision?: any;
  leaseId?: any;
  errorCode?: any;
} = {}) {
  return appendSecurityAuditEvent(engine?.hanakoHome, {
    action,
    target,
    result,
    actor: readAuthPrincipal(c),
    decision,
    leaseId,
    errorCode,
    secretFields,
    metadata,
  });
}

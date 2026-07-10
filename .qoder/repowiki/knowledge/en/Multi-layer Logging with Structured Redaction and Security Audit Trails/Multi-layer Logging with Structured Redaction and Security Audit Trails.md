---
kind: logging_system
name: Multi-layer Logging with Structured Redaction and Security Audit Trails
category: logging_system
scope:
    - '**'
source_files:
    - core/logger.ts
    - core/debug-log.ts
    - lib/debug-log.ts
    - core/log-redactor.ts
    - shared/log-redactor.ts
    - core/security-audit-log.ts
    - server/http/security-audit.ts
    - core/sandbox/audit-logger.ts
---

OpenShadow implements a layered logging system combining three distinct subsystems: a lightweight file logger, a per-session debug log writer, and a security audit trail. All layers share a common redaction pipeline to prevent secrets from leaking into logs.

## Core Logger (core/logger.ts)
A minimal Logger class providing level-filtered (debug|info|warn|error) JSON-lines output to an optional file path, plus console mirroring. Each entry carries timestamp, level, message, and optional context. A module-level singleton logger = createLogger({ level: 'info' }) is exported for direct use. Level filtering is numeric (debug=0 < info=1 < warn=2 < error=3). The default context is empty; callers can set it via setContext().

## Debug Log Writer (core/debug-log.ts & lib/debug-log.ts)
Two near-identical implementations — one in core/ (ESM) and one in lib/ (CommonJS) — provide per-process timestamped .log files under the configured log directory. Key features:
- One file per process start, named YYYY-MM-DD_HH-MM-SS.log.
- Line format: [HH:MM:SS.mmm] [LEVEL] [MODULE] message.
- Built-in deduplication of identical consecutive lines (writes a summary line instead).
- Per-file size cap at 5 MB; beyond that, further writes are silently dropped after a single notice line.
- Automatic cleanup of log files older than 7 days.
- createModuleLogger(module) helper returns { log/info/warn/error } that writes both to console.* and the persistent file.
- Uses redactLogText / redactLogLabel to scrub sensitive data before writing.

## Redaction Pipeline (core/log-redactor.ts & shared/log-redactor.ts)
Shared across all logging layers. Provides:
- redactLogText(value, options) — regex-based scrubbing of API keys, bearer tokens, cookies, email addresses, credit cards, Chinese ID numbers, SSNs, long random tokens, base64 data URIs, and user home paths.
- redactLogValue(obj, options) — deep object traversal that masks known secret-like keys (api_key, secret, token, password, authorization, etc.) and replaces values with [redacted].
- redactLogLabel(value) — sanitizes module/context labels to safe ASCII identifiers.
- formatLogArgs(args, options) — formats arbitrary call arguments through the same redaction pipeline.

## Security Audit Trail (core/security-audit-log.ts + server/http/security-audit.ts)
A separate structured JSONL audit log (security-audit.jsonl) under <hanakoHome>/logs/. Every HTTP route calls recordSecurityAuditEvent() which normalizes events into a fixed schema with fields: schemaVersion, eventId, timestamp, action, target, result, actor, decision, leaseId, errorCode, secretFields, metadata. Secret fields are masked using MASKED_SECRET; strings are truncated to 500 chars and newlines stripped.

## Sandbox Operation Audit (core/sandbox/audit-logger.ts)
In-memory AuditLogger per sandbox session records every operation (bash|file_read|file_write|file_delete|network|tool_use) with result, risk level, duration, and metadata. Exposed via export() and getSummary() for reporting.

## Conventions
- Prefer createModuleLogger('module-name') from core/debug-log.ts for new modules needing persistent logs.
- Use the shared logger singleton from core/logger.ts only when a simple level-filtered file+console sink is sufficient.
- Always pass structured objects through redactLogValue or let DebugLog handle it automatically.
- For any action crossing a security boundary (auth, capability decision, lease grant/deny), emit a security audit event via recordSecurityAuditEvent.
- Do not rely on third-party logging frameworks; the codebase intentionally avoids pino/winston/bunyan to keep dependencies minimal.
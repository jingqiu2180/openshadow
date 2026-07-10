---
kind: error_handling
name: Structured AppError + ErrorBus with HTTP Route Errors
category: error_handling
scope:
    - '**'
source_files:
    - shared/errors.ts
    - shared/error-bus.ts
    - server/http/route-errors.ts
    - core/computer-use/errors.ts
    - desktop/src/react/errors/error-bus-bridge.ts
---

The OpenShadow monorepo uses a layered, code-driven error handling system centered on three pillars: a shared AppError type with typed error codes, a process-wide ErrorBus for logging and UI routing, and an HTTP-specific HttpRouteError for the Hono server.

Core types and registry:
- shared/errors.ts defines the canonical error model: ERROR_DEFS is a frozen map of string codes (e.g. LLM_TIMEOUT, FS_PERMISSION, WS_DISCONNECTED) to metadata including severity (critical | degraded | cosmetic), category (network | llm | filesystem | ipc | render | bridge | config | auth | unknown), i18n key, retryability flag, and default HTTP status. AppError extends Error and carries code, severity, category, retryable, userMessageKey, httpStatus, context, traceId; it provides wrap(unknown) to coerce any thrown value into an AppError, and fromJSON/toJSON for cross-process serialization.
- core/computer-use/errors.ts is a domain-specific extension for the computer-use subsystem, exporting a parallel ComputerUseError plus a COMPUTER_USE_ERRORS constant set and a serializeComputerUseError helper used when crossing the provider boundary.

Propagation and presentation pipeline:
- shared/error-bus.ts exposes a singleton errorBus that every layer calls via errorBus.report(errOrUnknown, { context?, dedupeKey?, route? }). It wraps raw errors through AppError.wrap, deduplicates by fingerprint within a sliding window, attaches a bounded breadcrumb buffer, auto-routes to toast | statusbar | boundary based on severity/code, and logs redacted messages via console.error.
- Desktop renderer wires the bus into the UI through desktop/src/react/errors/error-bus-bridge.ts, which subscribes to bus entries and dispatches them to a Zustand toast store (with severity mapped to warning/error and persistence rules). Global unhandled promise rejections and React errors are also funneled through errorBus.report(AppError.wrap(...)) in app-init.ts.

Server-side HTTP errors:
- server/http/route-errors.ts defines HttpRouteError and jsonRouteError(c, input), a Hono-friendly error class carrying code, status, and optional traceId, plus a response formatter that returns { error: { code, message, traceId } } at the declared status. Routes throw HttpRouteError or pass plain options objects; boundary.ts re-exports these helpers as the public surface.

Conventions developers should follow:
1. Prefer AppError with a registered code from ERROR_DEFS rather than throwing bare new Error(...). The code drives severity, category, i18n, retryability, and HTTP status.
2. Wrap upstream failures with AppError.wrap(err, fallbackCode) so unexpected exceptions still produce structured telemetry instead of crashing the bus.
3. Attach context (serializable key/value pairs) and rely on traceId for correlation across Electron main / renderer / server boundaries.
4. Report through errorBus.report() instead of calling UI directly; let the bus auto-route by severity/code and keep rendering layers decoupled.
5. In Hono routes, throw HttpRouteError (or call jsonRouteError) with an explicit 4xx/5xx status; do not return raw Error objects from handlers.
6. Domain-specific layers (e.g. computer-use) may define their own error classes (ComputerUseError) but must serialize to a stable shape before crossing process boundaries.
7. Avoid throw new Error(...) in hot paths — it bypasses deduplication, breadcrumbs, and i18n, making incidents harder to triage.
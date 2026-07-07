import { Hono } from "hono";
import { createServerRuntimeContext, toServerIdentityResponse } from '../../core/server-runtime-context.js';
import { ensureLocalIdentityRegistries } from '../../core/server-identity.js';
import { readAuthPrincipal } from '../http/capability-guard.js';

export function createServerIdentityRoute({ hanakoHome, appVersion = "?", getRuntimeContext }: { hanakoHome?: string; appVersion?: string; getRuntimeContext?: () => any } = {}) {
  const route = new Hono();

  route.get("/server/identity", (c) => {
    try {
      let runtimeContext: any = null;
      if (typeof getRuntimeContext === "function") {
        try { runtimeContext = getRuntimeContext(); } catch { runtimeContext = null; }
      }
      if (!runtimeContext) {
        // Self-heal: engine.init() may have failed (or has not yet populated
        // _runtimeContext), leaving the server running but without a runtime
        // context. Ensure the identity registries exist, then build a fresh
        // context so this endpoint returns a valid identity instead of 500.
        try { ensureLocalIdentityRegistries(hanakoHome); } catch { /* best effort */ }
        runtimeContext = createServerRuntimeContext({ hanakoHome, appVersion });
      }
      return c.json(toServerIdentityResponse(
        contextForPrincipal(runtimeContext, readAuthPrincipal(c)),
        { appVersion },
      ));
    } catch (err: any) {
      return c.json({
        error: "invalid server identity registry",
        detail: err.message,
      }, 500);
    }
  });

  return route;
}

function contextForPrincipal(runtimeContext, principal) {
  if (!principal || principal.kind === "local_user") return runtimeContext;
  return {
    ...runtimeContext,
    connectionKind: principal.connectionKind || runtimeContext.connectionKind,
    trustState: principal.trustState || runtimeContext.trustState,
    authState: principal.kind === "device" ? "paired" : "user",
    credentialKind: principal.credentialKind || runtimeContext.credentialKind,
    platformAccountId: principal.platformAccountId ?? null,
    officialServiceKind: principal.officialServiceKind ?? null,
    userId: principal.userId || runtimeContext.userId,
    studioId: principal.studioId || runtimeContext.studioId,
    capabilities: capabilitiesForPrincipal(principal, runtimeContext.capabilities),
  };
}

function capabilitiesForPrincipal(principal, fallback = []) {
  const scopes = Array.isArray(principal?.scopes) ? principal.scopes : [];
  if (scopes.length === 0) return Array.isArray(fallback) ? [...fallback] : [];
  const out = new Set();
  for (const scope of scopes) {
    out.add(scope);
    if (scope === "chat") out.add("chat");
    else if (scope === "resources" || scope.startsWith("resources.")) out.add("resources");
    else if (scope === "files" || scope.startsWith("files.")) out.add("files");
    else if (scope === "tools" || scope.startsWith("tools.")) out.add("tools");
    else if (scope === "settings" || scope.startsWith("settings.")) out.add("settings");
  }
  return [...out];
}

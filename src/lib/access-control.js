export function hasGlobalClientAccess(perfilPublicacao) {
  return perfilPublicacao === 'SUPER_ADMIN' || perfilPublicacao === 'ADMIN';
}

export function resolveClientSelection(input) {
  const requestedClientId = String(input.requestedClientId || '').trim();
  if (requestedClientId) {
    if (!input.canAccessAllClients && !input.accessibleClientIds.includes(requestedClientId)) {
      return { ok: false, status: 403, error: 'FORBIDDEN_CLIENT' };
    }
    return { ok: true, clientId: requestedClientId };
  }

  if (!input.canAccessAllClients) {
    if (input.accessibleClientIds.length === 0) {
      return { ok: false, status: 403, error: 'NO_CLIENT_ACCESS' };
    }
    if (input.accessibleClientIds.length === 1) {
      return { ok: true, clientId: input.accessibleClientIds[0] };
    }
    return { ok: false, status: 400, error: 'CLIENT_REQUIRED' };
  }

  if (input.fallbackClientId) {
    return { ok: true, clientId: input.fallbackClientId };
  }

  return { ok: false, status: 403, error: 'NO_CLIENT_ACCESS' };
}

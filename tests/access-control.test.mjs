import assert from 'node:assert/strict';
import { hasGlobalClientAccess, resolveClientSelection } from '../src/lib/access-control.js';

assert.equal(hasGlobalClientAccess('SUPER_ADMIN'), true);
assert.equal(hasGlobalClientAccess('ADMIN'), true);
assert.equal(hasGlobalClientAccess('ADMIN_CLIENTE'), false);
assert.equal(hasGlobalClientAccess('CRIADOR'), false);

assert.deepEqual(
  resolveClientSelection({
    requestedClientId: 'cliente-b',
    accessibleClientIds: ['cliente-a'],
    canAccessAllClients: false,
  }),
  {
    ok: false,
    status: 403,
    error: 'FORBIDDEN_CLIENT',
  },
);

assert.deepEqual(
  resolveClientSelection({
    accessibleClientIds: ['cliente-a', 'cliente-b'],
    canAccessAllClients: false,
  }),
  {
    ok: false,
    status: 400,
    error: 'CLIENT_REQUIRED',
  },
);

assert.deepEqual(
  resolveClientSelection({
    accessibleClientIds: ['cliente-a'],
    canAccessAllClients: false,
  }),
  {
    ok: true,
    clientId: 'cliente-a',
  },
);

assert.deepEqual(
  resolveClientSelection({
    accessibleClientIds: [],
    canAccessAllClients: true,
    fallbackClientId: 'cliente-default',
  }),
  {
    ok: true,
    clientId: 'cliente-default',
  },
);

console.log('access-control tests passed');

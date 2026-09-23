import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as management from '../src/ticketManagement.ts';
const compiled = ts.transpileModule(readFileSync(new URL('../src/sharepoint.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function service({ conflict = false, concurrent = false, missingDate = false, historyFailure = false } = {}) {
  const requests = [];
  class Msal { async initialize() {} getActiveAccount() { return {}; } setActiveAccount() {} async acquireTokenSilent() { return { accessToken: 'test-token' }; } }
  const fetch = async (url, init) => {
    requests.push({ url, init });
    const path = new URL(url).pathname;
    let body;
    if (path.includes(':/sites/reportingdn')) body = { id: 'site' };
    else if (path.endsWith('/lists')) body = { value: [{ id: 'list', displayName: 'Comercial planeacion' }] };
    else if (path.endsWith('/drives')) body = { value: [{ id: 'drive', name: 'Comercial planeacion proyecto' }] };
    else if (path.endsWith('/columns')) body = { value: [['Title', 'Título'], ['estado', 'Estado'], ['responsable', 'Responsable'], ['tipo', 'Tipo'], ...(!missingDate ? [['FechaCompromiso', 'Fecha compromiso']] : [])].map(([name, displayName]) => ({ name, displayName })) };
    else if (path.endsWith('/items/1')) body = { eTag: '"v2"', fields: { estado: 'Pendiente', FechaCompromiso: concurrent ? '2026-09-24T12:00:00Z' : '' } };
    else if (path.endsWith('/fields')) {
      if (conflict) return new Response('{}', { status: 412 });
      body = JSON.parse(init.body);
    } else if (path.endsWith('/versions')) body = { value: [{ id: '2.0' }, { id: '1.0' }] };
    else if (path.endsWith('/$batch')) body = { responses: JSON.parse(init.body).requests.map((request) => ({ id: request.id, status: historyFailure ? 403 : 200, body: { id: request.id === '0' ? '2.0' : '1.0', lastModifiedDateTime: '2026-09-23T00:00:00Z', lastModifiedBy: { user: { displayName: 'Diego' } }, fields: { tipo: 'Muestra', estado: request.id === '0' ? 'En proceso' : 'Pendiente' } } })) };
    else throw new Error(`Unexpected request ${url}`);
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const exports = {};
  new Function('require', 'exports', 'window', 'fetch', compiled)((name) => name === './ticketManagement' ? management : { PublicClientApplication: Msal }, exports, { location: { hostname: 'localhost', origin: 'http://localhost' } }, fetch);
  return { api: exports, requests };
}
const ticket = { spId: '1', status: 'Pendiente', due_date: '', assignee: '' };
test('saving a date patches only that field with concurrency protection', async () => {
  const { api, requests } = service();
  const result = await api.updateTicket(ticket, { due_date: '2026-09-25' });
  const patch = requests.find((r) => r.init.method === 'PATCH');
  assert.deepEqual(JSON.parse(patch.init.body), { FechaCompromiso: '2026-09-25T12:00:00Z' });
  assert.equal(patch.init.headers.get('If-Match'), '"v2"');
  assert.equal(result.due_date, '2026-09-25');
});
test('clearing the commitment stores null, not an invalid date', async () => {
  const { api, requests } = service(); await api.updateTicket(ticket, { due_date: '' });
  assert.deepEqual(JSON.parse(requests.find((r) => r.init.method === 'PATCH').init.body), { FechaCompromiso: null });
});
test('does not silently overwrite another person or ignore a missing column', async () => {
  for (const options of [{ concurrent: true }, { conflict: true }, { missingDate: true }]) {
    const { api } = service(options); await assert.rejects(api.updateTicket(ticket, { due_date: '2026-09-25' }));
  }
});
test('manual priority edits are rejected', async () => {
  const { api, requests } = service(); await assert.rejects(api.updateTicket(ticket, { priority: 'Baja' }), /automática/);
  assert.equal(requests.some((r) => r.init.method === 'PATCH'), false);
});
test('history loads field snapshots, actors and priority derived from type', async () => {
  const { api } = service(); const events = await api.loadTicketHistory(ticket);
  assert.equal(events.length, 2); assert.equal(events[0].actor, 'Diego');
  assert.equal(events[1].fields.priority, 'Alta');
  assert.deepEqual(events[0].changes, [{ label: 'Estado', before: 'Pendiente', after: 'En proceso' }]);
});
test('history failure is not disguised as an empty history', async () => {
  const { api } = service({ historyFailure: true }); await assert.rejects(api.loadTicketHistory(ticket), /historial completo/);
});

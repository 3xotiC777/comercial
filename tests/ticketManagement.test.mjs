import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityFor, deadlineState, dayInBogota, validDay, filterTickets, emptyFilters, historyEvents } from '../src/ticketManagement.ts';
const ticket = { id: 'DN-1', requester_name: 'María Peña', requester_email: 'maria@example.com', assignee: 'Diego Montoya', business: 'Trade', country: 'COLOMBIA', study: 'Nestlé', request_type: 'Muestra', detail: '<p>Universo mensual</p>', created_at: '2026-09-23T02:00:00Z', due_date: '2026-09-25', status: 'Pendiente' };
test('priority is determined only by type, including accents and legacy singular', () => {
  for (const type of ['Muestra', ' muestra ']) assert.equal(priorityFor(type), 'Alta');
  for (const type of ['Cotizaciones', 'cotización', 'Analisis', 'Análisis']) assert.equal(priorityFor(type), 'Media');
  assert.equal(priorityFor('Otros'), 'Baja'); assert.equal(priorityFor('desconocido'), '');
});
test('dates use Bogotá and reject invalid calendar days', () => {
  assert.equal(dayInBogota(ticket.created_at), '2026-09-22');
  assert.equal(validDay('2026-02-30'), false); assert.equal(validDay('2024-02-29'), true);
});
test('deadline boundary is end of day, upcoming means next 3 calendar days', () => {
  assert.equal(deadlineState(ticket, '2026-09-21'), 'En plazo');
  assert.equal(deadlineState(ticket, '2026-09-22'), 'Próximo a vencer');
  assert.equal(deadlineState(ticket, '2026-09-25'), 'Vence hoy');
  assert.equal(deadlineState(ticket, '2026-09-26'), 'Vencido');
  assert.equal(deadlineState({ ...ticket, due_date: '' }), 'Sin fecha');
  assert.equal(deadlineState({ ...ticket, status: 'Finalizado', completed_at: '2026-09-26T03:00:00Z' }), 'Finalizado a tiempo');
  assert.equal(deadlineState({ ...ticket, status: 'Finalizado', completed_at: '2026-09-26T06:00:00Z' }), 'Finalizado fuera de plazo');
  assert.equal(deadlineState({ ...ticket, status: 'Finalizado' }), 'Cierre sin fecha');
});
test('filters combine and ignore accents; dates inclusive; input immutable', () => {
  const filters = { ...emptyFilters, search: 'maria universo', business: 'Trade', priority: 'Alta', from: '2026-09-22', to: '2026-09-22' };
  assert.equal(filterTickets([ticket], filters).length, 1);
  assert.equal(filterTickets([ticket], { ...filters, priority: 'Baja' }).length, 0);
  assert.equal(filterTickets([ticket], { ...filters, assignee: 'unassigned' }).length, 0);
  assert.equal(filterTickets([ticket], { ...filters, from: '2026-09-23' }).length, 0);
});
test('history sorts version numerically and records old/new values and initial snapshot', () => {
  const versions = [
    { id: '10.0', actor: 'Ana', at: '', fields: { status: 'Finalizado', assignee: 'Diego' } },
    { id: '1.0', actor: 'Luis', at: '', fields: { status: 'Pendiente' } },
    { id: '2.0', actor: 'Ana', at: '', fields: { status: 'En proceso', assignee: 'Diego' } },
  ];
  const result = historyEvents(versions);
  assert.deepEqual(result.map((e) => e.id), ['10.0', '2.0', '1.0']);
  assert.equal(result[2].initial, true);
  assert.deepEqual(result[0].changes, [{ label: 'Estado', before: 'En proceso', after: 'Finalizado' }]);
  assert.equal(versions[0].id, '10.0');
});

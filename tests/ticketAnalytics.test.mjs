import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTicketAnalytics, validClosure, monthBounds } from '../src/ticketAnalytics.ts';

const now = new Date('2026-10-13T02:00:00Z'); // October 12 in Bogotá.
const ticket = { id: 'DN-1', spId: '1', requester_name: 'Ana', requester_email: 'ana@example.com', assignee: 'Diego Montoya', business: 'Trade', country: 'COLOMBIA', study: 'Estudio', request_type: 'Muestra', detail: '', created_at: '2026-09-30T18:00:00Z', status: 'Pendiente' };

test('creation cohort and closure events use their own Bogotá calendar month', () => {
  const tickets = [
    { ...ticket, status: 'Finalizado', completed_at: '2026-10-01T04:00:00Z' }, // September in Bogotá.
    { ...ticket, id: 'DN-2', status: 'Finalizado', completed_at: '2026-10-02T15:00:00Z' },
    { ...ticket, id: 'DN-3', created_at: '2026-10-01T03:00:00Z' }, // Also September.
    { ...ticket, id: 'DN-4', created_at: '2026-10-01T06:00:00Z' },
  ];
  const result = buildTicketAnalytics(tickets, '2026-10', now);
  assert.equal(result.total, 1);
  assert.equal(result.finalized, 0);
  assert.equal(result.trend.at(-1).key, '2026-10');
  assert.equal(result.trend.at(-1).created, 1);
  assert.equal(result.trend.at(-1).completed, 1);
  assert.equal(result.trend.at(-2).created, 3);
  assert.equal(result.trend.at(-2).completed, 1);
  assert.equal(result.trend.length, 6);
});

test('real closure averages exclude reopened, absent, reverse, invalid, and future timestamps', () => {
  const closed = { ...ticket, status: 'Finalizado', completed_at: '2026-10-02T18:00:00Z' };
  for (const item of [
    { ...closed, status: 'En proceso' }, { ...closed, completed_at: undefined },
    { ...closed, completed_at: '2026-09-29T00:00:00Z' },
    { ...closed, created_at: 'not a date' }, { ...closed, completed_at: '2026-10-15T00:00:00Z' },
    { ...closed, created_at: '2026-02-30T00:00:00Z' },
  ]) assert.equal(validClosure(item, now), null);
  const result = buildTicketAnalytics([closed, { ...closed, completed_at: undefined }, { ...closed, status: 'En proceso' }], '', now);
  assert.equal(result.averageClosureDays, 2);
  assert.equal(result.validClosures, 1);
  assert.equal(result.excludedClosures, 1);
  assert.equal(result.finalized, 2);
  assert.equal(result.completionRate, 2 / 3 * 100);
  assert.equal(result.analysts[0].completionRate, 2 / 3 * 100);
  assert.equal(result.analysts[0].averageClosureDays, 2);
  assert.equal(result.analysts[0].validClosures, 1);
});

test('commitment compliance uses eligible closures only and compares Bogotá end-of-day', () => {
  const closed = { ...ticket, status: 'Finalizado', due_date: '2026-10-01' };
  const result = buildTicketAnalytics([
    { ...closed, completed_at: '2026-10-02T04:59:59Z' },
    { ...closed, completed_at: '2026-10-02T05:00:00Z' },
    { ...closed, completed_at: '' },
    { ...closed, completed_at: '2026-10-02T04:59:59Z', due_date: '' },
  ], '', now);
  assert.equal(result.commitmentRate, 50);
  assert.equal(result.eligibleCommitments, 2);
  assert.equal(result.excludedCommitments, 2);
  assert.equal(result.onTime, 1);
  assert.equal(result.lateClosures, 1);
});

test('active aging, alerts and analyst load exclude completed tickets and preserve inputs', () => {
  const tickets = [
    { ...ticket, created_at: '2026-10-12T05:00:00Z', due_date: '2026-10-12', assignee: '' },
    { ...ticket, created_at: '2026-10-09T05:00:00Z', due_date: '2026-10-11', status: 'En proceso' },
    { ...ticket, created_at: '2026-09-01T05:00:00Z', status: 'Finalizado' },
    { ...ticket, created_at: 'invalid' },
  ];
  const original = JSON.stringify(tickets);
  const result = buildTicketAnalytics(tickets, '', now);
  assert.equal(result.active, 3);
  assert.deepEqual(result.aging.map((row) => row.count), [1, 1, 0, 0]);
  assert.equal(result.unknownAge, 1);
  assert.equal(result.late, 1);
  assert.equal(result.dueToday, 1);
  assert.equal(result.unassigned, 1);
  assert.equal(result.analysts[0].active, 2);
  assert.equal(result.analysts[0].completed, 1);
  assert.equal(result.analysts[1].key, 'unassigned');
  assert.equal(JSON.stringify(tickets), original);
});

test('empty cohorts distinguish unavailable ratios from zero and month bounds handle leap years', () => {
  const result = buildTicketAnalytics([], '', now);
  assert.equal(result.completionRate, null);
  assert.equal(result.commitmentRate, null);
  assert.equal(result.averageClosureDays, null);
  assert.equal(result.total, 0);
  assert.equal(result.trend.every((row) => row.created === 0 && row.completed === 0), true);
  assert.deepEqual(monthBounds('2024-02'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(monthBounds('2026-13'), { from: '', to: '' });
});

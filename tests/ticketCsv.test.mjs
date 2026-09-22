import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, csvDate, closureHours, buildTicketsCsv, csvHeaders } from '../src/ticketCsv.ts';

const ticket = {
  id: 'DN-123', spId: '42', created_at: '2026-09-22T14:00:00Z', completed_at: '2026-09-22T15:30:00Z',
  status: 'Finalizado', assignee: 'Diego Montoya', requester_name: 'María', requester_email: 'test@example.com',
  cc_emails: 'cc@example.com', country: 'COLOMBIA', business: 'Trade', study: 'Nestlé', request_type: 'Muestra',
  detail: 'Línea 1; "ejemplo"\nLínea 2', resolution: 'Solución',
  request_files: ['uno.xlsx', 'dos.html'], solution_files: ['final.xlsx'], request_images: [], solution_images: ['imagen.png'],
};

test('quotes all cells, preserving accents, delimiters and multiline text', () => {
  assert.equal(csvCell('María; "hola"\nDetalle'), '"María; ""hola""\nDetalle"');
  assert.equal(csvCell(undefined), '""');
});
test('protects spreadsheet formulas including leading whitespace', () => {
  for (const text of ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', '  =1', '\tfoo', '\n=1', '\uFEFF=1']) {
    assert.ok(csvCell(text).startsWith('"\''));
  }
  assert.equal(csvCell('DN-123'), '"DN-123"');
});
test('uses Bogotá time, preserves date-only values and leaves missing dates blank', () => {
  assert.equal(csvDate('2026-09-22T02:00:00Z'), '2026-09-21 21:00:00');
  assert.equal(csvDate('2026-09-22'), '2026-09-22');
  assert.equal(csvDate('bad'), '');
  assert.equal(csvDate(), '');
});
test('closure hours use actual timestamps, not modified dates or estimates', () => {
  assert.equal(closureHours(ticket), '1,50');
  assert.equal(closureHours({ ...ticket, completed_at: ticket.created_at }), '0,00');
  for (const patch of [{ completed_at: undefined }, { completed_at: 'bad' }, { status: 'Pendiente' }, { completed_at: '2020-01-01' }]) {
    assert.equal(closureHours({ ...ticket, ...patch }), '');
  }
});
test('complete CSV has BOM, Excel separator, complete records, safe links and no mutation', () => {
  const before = structuredClone(ticket);
  const csv = buildTicketsCsv([ticket], (text) => text);
  assert.ok(csv.startsWith('\uFEFFsep=;\r\n'));
  assert.ok(csv.includes('"María"'));
  assert.ok(csv.includes('"uno.xlsx; dos.html"'));
  assert.ok(csv.includes('"Solución"'));
  assert.ok(csv.includes('DispForm.aspx?ID=42'));
  assert.equal(csvHeaders.length, 24);
  assert.deepEqual(ticket, before);
  assert.equal(buildTicketsCsv([], (text) => text).split('\r\n').length, 3);
});

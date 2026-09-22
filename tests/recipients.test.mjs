import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCc } from '../src/recipients.ts';

test('empty CC remains optional', () => {
  assert.equal(normalizeCc(' ; , \n'), '');
});
test('normalizes separators, whitespace and case without duplicates', () => {
  assert.equal(normalizeCc(' Ana@example.com, Beto@example.com;ANA@example.com\ncami@example.com\r\n'),
    'ana@example.com; beto@example.com; cami@example.com');
});
test('does not copy requester twice', () => {
  assert.equal(normalizeCc('ANA@example.com; otro@example.com', 'ana@example.com'), 'otro@example.com');
});
test('allows plus addresses and subdomains', () => {
  assert.equal(normalizeCc('ana+ventas@equipo.example.com'), 'ana+ventas@equipo.example.com');
});
test('rejects malformed addresses instead of silently dropping them', () => {
  for (const address of ['sin-correo', 'ana@example.comotro@example.com', 'Ana <ana@example.com>', 'ana@example.com otra@example.com', 'ana@-example.com'])
    assert.throws(() => normalizeCc(address), /Revisa el correo/);
});
test('caps unique CC recipients at 50', () => {
  assert.throws(() => normalizeCc(Array.from({length: 51}, (_, i) => `persona${i}@example.com`).join(';')), /50/);
  assert.equal(normalizeCc(Array(51).fill('ana@example.com').join(';')), 'ana@example.com');
});

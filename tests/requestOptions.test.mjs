import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, customerStudies, requestTypesFor, studiesFor, validateRoutingRequest } from '../src/requestOptions.ts';

test('Ruteador is available exclusively for Trade', () => {
  assert.ok(requestTypesFor('Trade').includes('Ruteador'));
  for (const business of ['Customer', '', 'otro'])
    assert.ok(!requestTypesFor(business).includes('Ruteador'));
  assert.deepEqual(requestTypesFor('Customer'), ['Muestra', 'Cotizaciones', 'Analisis', 'Otros']);
});

test('routing offers the complete Trade study catalog in every country without duplicates', () => {
  const expected = new Set(Object.values(catalog).flat());
  for (const country of Object.keys(catalog)) {
    const studies = studiesFor('Trade', country, 'Ruteador');
    assert.deepEqual(new Set(studies), expected);
    assert.equal(studies.length, expected.size);
  }
  assert.ok(studiesFor('Trade', 'BOLIVIA', 'Ruteador').includes('ABI'));
  assert.deepEqual(studiesFor('Trade', 'BOLIVIA', 'Muestra'), ['P&G']);
  assert.deepEqual(studiesFor('Customer', 'PERU', 'Analisis'), customerStudies);
  assert.deepEqual(studiesFor('Customer', 'PERU', 'Ruteador'), []);
});

test('routing validation rejects missing or invalid context while allowing a study from another country', () => {
  const ticket = { business: 'Trade', request_type: 'Ruteador', country: 'BOLIVIA', study: 'ABI' };
  assert.doesNotThrow(() => validateRoutingRequest(ticket));
  assert.throws(() => validateRoutingRequest({ ...ticket, business: 'Customer' }), /solo.*Trade/);
  assert.throws(() => validateRoutingRequest({ ...ticket, country: '' }), /país válido/);
  assert.throws(() => validateRoutingRequest({ ...ticket, country: 'inventado' }), /país válido/);
  assert.throws(() => validateRoutingRequest({ ...ticket, study: '' }), /catálogo de Trade/);
  assert.throws(() => validateRoutingRequest({ ...ticket, study: 'Walmart' }), /catálogo de Trade/);
});

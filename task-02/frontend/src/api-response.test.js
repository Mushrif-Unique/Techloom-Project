import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrapResponse, isCatalog } from './api-response.js';

test('rejects HTML fallback, empty responses, missing data and unsuccessful envelopes', () => {
  for (const payload of [
    '<!doctype html><html></html>',
    undefined,
    null,
    {},
    { success: true },
    { success: true, data: null },
    { success: false, data: {} },
  ]) {
    assert.throws(() => unwrapResponse(payload), /unexpected response/);
  }
});

test('preserves successful API payloads including empty order lists', () => {
  for (const data of [[], { items: [], total: 0, page: 1, pages: 0 }, { token: 'test' }]) {
    assert.equal(unwrapResponse({ success: true, data }), data);
  }
});

test('catalog accepts an empty result and rejects incompatible product responses', () => {
  const valid = { items: [], total: 0, page: 1, pages: 0 };
  assert.equal(isCatalog(valid), true);
  assert.equal(
    isCatalog({ ...valid, total: 1, pages: 1, items: [{ id: 'p', name: 'Lamp' }] }),
    true,
  );
  for (const data of [
    undefined,
    null,
    {},
    [],
    { ...valid, total: '0' },
    { ...valid, page: 0 },
    { ...valid, items: [null] },
    { ...valid, items: [{}] },
  ]) {
    assert.equal(isCatalog(data), false);
  }
});

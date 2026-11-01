const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_COLLECTIONS, validateDbPayload, validateReceiptHistory } = require('../validation');
function original() {
  return {
    id: 'original', rec: 'R-00001-1111111111111111', subsId: 's1',
    issuedAt: '2026-10-25T10:00:00Z', type: 'payment', currency: 'درهم',
    base: 500, discount: 100, due: 400, paid: 150, rest: 250,
    s: { id: 's1', player: 'p1', rec: 'R-00001-1111111111111111', date: '2026-10-25', method: 'نقداً', paid: 150 },
    p: { name: 'اسم تجريبي' }, payment: { id: 'event1', amount: 50 },
  };
}
function corrected(source = original(), id = 'corrected', suffix = '2222222222222222') {
  const result = structuredClone(source);
  result.id = id; result.rec = 'R-00002-' + suffix; result.s.rec = result.rec;
  result.p.name = 'اسم مصحح';
  result.correction = {
    sourceId: source.id, sourceRec: source.rec, rootId: source.correction?.rootId || source.id,
    preparedAt: '2026-10-28T12:00:00Z', reason: 'تصحيح اسم تجريبي',
  };
  return result;
}
function database(...receipts) {
  const db = { settings: {}, receipts };
  REQUIRED_COLLECTIONS.forEach(key => { db[key] = []; });
  return db;
}
test('single and linear corrections preserve financial and issue-date snapshots', () => {
  const a = original(), b = corrected(a), c = corrected(b, 'next', '3333333333333333');
  assert.equal(validateDbPayload(database(a, b)).ok, true);
  assert.equal(validateDbPayload(database(a, b, c)).ok, true);
  assert.equal(validateReceiptHistory(database(a, b, c), database(a, b)).ok, true);
});
test('two corrections of the same source are rejected, independently of their numbers', () => {
  const a = original(), b = corrected(a), c = corrected(a, 'other', '3333333333333333');
  assert.equal(validateDbPayload(database(a, b, c)).code, 'receipt_correction_conflict');
});
test('missing source, wrong root, duplicate IDs and cyclic references are rejected', () => {
  const a = original(), b = corrected(a);
  assert.equal(validateDbPayload(database(b)).ok, false);
  const wrongRoot = structuredClone(b); wrongRoot.correction.rootId = 'missing';
  assert.equal(validateDbPayload(database(a, wrongRoot)).ok, false);
  assert.equal(validateDbPayload(database(a, structuredClone(a))).ok, false);
  const cycleA = corrected(b, 'original', '4444444444444444');
  assert.equal(validateDbPayload(database(cycleA, b)).ok, false);
});
test('invalid correction metadata and mismatched source numbers are rejected', () => {
  for (const patch of [
    { reason: '' }, { reason: 'x'.repeat(501) }, { preparedAt: 'not-a-date' },
    { sourceRec: 'wrong-number' }, { sourceId: 'corrected' },
  ]) {
    const a = original(), b = corrected(a);
    Object.assign(b.correction, patch);
    assert.equal(validateDbPayload(database(a, b)).ok, false);
  }
});
test('correction cannot change monetary values, payment events, fee facts or original issue date', () => {
  const mutations = [
    receipt => { receipt.paid++; },
    receipt => { receipt.issuedAt = '2026-10-28T12:00:00Z'; },
    receipt => { receipt.payment.amount++; },
    receipt => { receipt.s.paid++; },
    receipt => { receipt.s.rec = 'unrelated'; },
    receipt => { receipt.currency = 'EUR'; },
  ];
  for (const mutate of mutations) {
    const a = original(), b = corrected(a); mutate(b);
    assert.equal(validateDbPayload(database(a, b)).ok, false);
  }
});
test('accepted corrections cannot be replaced, removed, or rewritten by full/force upload', () => {
  const a = original(), b = corrected(a), previous = database(a, b);
  const alternate = corrected(a, 'other', '3333333333333333');
  assert.equal(validateReceiptHistory(database(a, alternate), previous).code, 'receipt_correction_conflict');
  assert.equal(validateReceiptHistory(database(a), previous).ok, false);
  const changed = structuredClone(b); changed.p.name = 'rewritten';
  assert.equal(validateReceiptHistory(database(a, changed), previous).ok, false);
});
test('the original snapshot already on the server cannot be rewritten with its first correction', () => {
  const a = original(), altered = structuredClone(a); altered.p.name = 'rewritten original';
  const next = database(altered, corrected(altered));
  assert.equal(validateDbPayload(next).ok, true);
  assert.equal(validateReceiptHistory(next, database(a)).ok, false);
});
test('key-order differences do not break immutable history and unrelated legacy archives still sync', () => {
  const a = original(), b = corrected(a), previous = database(a, b);
  const reordered = Object.fromEntries(Object.entries(b).reverse());
  assert.equal(validateReceiptHistory(database(a, reordered), previous).ok, true);
  assert.equal(validateReceiptHistory(database(), database({ id: 'legacy', rec: 'R-1' })).ok, true);
});
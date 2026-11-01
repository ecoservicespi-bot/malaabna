const test = require('node:test');
const assert = require('node:assert/strict');
const { REQUIRED_COLLECTIONS, validateDbPayload, sanitizeFilesPayload } = require('../validation');

function validDb() {
  const db = { settings: {} };
  REQUIRED_COLLECTIONS.forEach((name) => { db[name] = []; });
  db.players = [{ id: 'p1', name: 'لاعب' }];
  return db;
}

test('database validation accepts the current application shape', () => {
  assert.deepEqual(validateDbPayload(validDb()), { ok: true });
});

test('database validation rejects missing collections and oversized records', () => {
  const db = validDb();
  delete db.players;
  assert.equal(validateDbPayload(db).ok, false);

  const db2 = validDb();
  db2.players = [{ id: 'x'.repeat(161) }];
  assert.equal(validateDbPayload(db2).ok, false);
});

test('database validation rejects unsafe keys and excessive nesting', () => {
  const unsafe = validDb();
  unsafe.settings = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.equal(validateDbPayload(unsafe).ok, false);
  assert.equal({}.polluted, undefined);

  const deeplyNested = validDb();
  let cursor = deeplyNested.settings;
  for (let i = 0; i < 70; i += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.equal(validateDbPayload(deeplyNested).ok, false);
});

test('file validation accepts images and PDFs but rejects unsafe data URLs', () => {
  const good = {
    image: 'data:image/png;base64,AAAA',
    pdf: 'data:application/pdf;base64,JVBERi0x',
  };
  assert.equal(Object.keys(sanitizeFilesPayload(good)).length, 2);
  assert.equal(sanitizeFilesPayload({ bad: 'data:text/html;base64,PGh0bWw+' }), undefined);
  assert.equal(sanitizeFilesPayload({ bad: 'javascript:alert(1)' }), undefined);
});

test('file validation enforces identifier, per-file, file-count, and aggregate-size limits', () => {
  assert.equal(sanitizeFilesPayload({ 'bad id': 'data:image/png;base64,AAAA' }), undefined);

  const individuallyTooLarge = {
    file: 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024),
  };
  assert.equal(sanitizeFilesPayload(individuallyTooLarge), undefined);

  const tooMany = {};
  for (let i = 0; i < 5001; i += 1) tooMany['f' + i] = 'data:image/png;base64,AAAA';
  assert.equal(sanitizeFilesPayload(tooMany), undefined);

  const chunk = 'data:image/png;base64,' + 'A'.repeat(5 * 1024 * 1024);
  assert.equal(sanitizeFilesPayload({ first: chunk, second: chunk }), undefined);
});

test('injury records are validated but the collection remains optional for older clients', () => {
  const db = validDb();
  assert.equal(validateDbPayload(db).ok, true);
  db.injuries = [{ id: 'i1', player: 'p1', date: '2026-10-10', notes: 'follow-up' }];
  assert.equal(validateDbPayload(db).ok, true);
  db.injuries = 'invalid';
  assert.equal(validateDbPayload(db).ok, false);
});

test('receipt snapshots are accepted while remaining optional for older clients', () => {
  const db = validDb();
  assert.equal(validateDbPayload(db).ok, true);
  db.receipts = [{ id: 'r1', rec: 'R-00001' }];
  assert.equal(validateDbPayload(db).ok, true);
  db.receipts = 'invalid';
  assert.equal(validateDbPayload(db).ok, false);
});

test('salary advance plans are validated while remaining optional for older clients', () => {
  const db = validDb();
  assert.equal(validateDbPayload(db).ok, true);
  db.salaryAdvances = [{ id: 'a1', coachId: 'c1', total: 1200 }];
  assert.equal(validateDbPayload(db).ok, true);
  db.salaryAdvances = 'invalid';
  assert.equal(validateDbPayload(db).ok, false);
});

test('duplicate new-format receipt numbers are rejected without blocking legacy archives', () => {
  const db = validDb();
  db.receipts = [
    { id: 'r1', rec: 'R-00012-0123456789ABCDEF' },
    { id: 'r2', rec: 'R-00012-0123456789ABCDEF' },
  ];
  assert.equal(validateDbPayload(db).ok, false);

  db.receipts = [
    { id: 'old-1', rec: 'R-00012' },
    { id: 'old-2', rec: 'R-00012' },
  ];
  assert.equal(validateDbPayload(db).ok, true);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFee,
  ensureReceiptSnapshot,
  hasFinancialChanges,
  migrateReceiptSnapshots,
  nextReceiptNumber,
  prepareReceiptCorrection,
  snapshotDocument,
  splitRegistrationFee,
} = require('../../malaabna-app/finance');

function fee(overrides = {}) {
  return {
    baseDue: 150,
    discountType: 'بدون',
    discountValue: 0,
    discountReason: '',
    exempt: 'لا',
    exemptReason: '',
    paid: 0,
    ...overrides,
  };
}

test('fixed and percentage discounts calculate the net amount', () => {
  assert.deepEqual(calculateFee(fee({
    discountType: 'مبلغ ثابت', discountValue: 25, discountReason: 'منحة',
  })), {
    ok: true, base: 150, value: 25, discount: 25, afterDiscount: 125,
    due: 125, paid: 0, exemptionAmount: 0, exempt: false,
  });
  assert.equal(calculateFee(fee({
    discountType: 'نسبة مئوية', discountValue: 12.5, discountReason: 'منحة',
  })).due, 131.25);
});

test('registration fees split into 2 or 3 individually trackable installments', () => {
  let id = 0;
  const result = splitRegistrationFee(fee({
    baseDue: 100, discountType: 'مبلغ ثابت', discountValue: 10,
    discountReason: 'منحة تسجيل', kind: 'رسوم التسجيل',
  }), 3, () => `generated-${++id}`);

  assert.equal(result.ok, true);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map((item) => item.registrationInstallment), [1, 2, 3]);
  assert.ok(result.records.every((item) => item.registrationInstallmentCount === 3));
  assert.equal(result.records.reduce((sum, item) => sum + item.baseDue, 0), 100);
  assert.equal(result.records.reduce((sum, item) => sum + item.discountAmount, 0), 10);
  assert.equal(result.records.reduce((sum, item) => sum + item.due, 0), 90);
  assert.deepEqual(result.records.map((item) => item.due), [30, 30, 30]);
  assert.equal(new Set(result.records.map((item) => item.id)).size, 3);
  assert.ok(result.records.every((item) => item.paid === 0 && item.registrationPlanId === result.planId));
});

test('registration installment split rejects exempt, paid, and too-small amounts', () => {
  const createId = (() => { let id = 0; return () => `id-${++id}`; })();
  assert.equal(splitRegistrationFee(fee({ exempt: 'نعم', exemptReason: 'سبب' }), 2, createId).error, 'installments_unavailable');
  assert.equal(splitRegistrationFee(fee({ paid: 1 }), 2, createId).error, 'installments_unavailable');
  assert.equal(splitRegistrationFee(fee({ baseDue: 0.01 }), 2, createId).error, 'installment_amount_too_small');
  assert.equal(splitRegistrationFee(fee(), 4, createId).error, 'invalid_installment_count');
});

test('percentage discounts over 100 and undocumented discounts are rejected', () => {
  assert.equal(calculateFee(fee({
    discountType: 'نسبة مئوية', discountValue: 101, discountReason: 'سبب',
  })).error, 'percent_over_100');
  assert.equal(calculateFee(fee({
    discountType: 'مبلغ ثابت', discountValue: 10,
  })).error, 'discount_reason_required');
});

test('full discount requires a documented exemption', () => {
  assert.equal(calculateFee(fee({
    discountType: 'مبلغ ثابت', discountValue: 150, discountReason: 'إعفاء',
  })).error, 'full_discount_requires_exemption');
  const result = calculateFee(fee({
    discountType: 'مبلغ ثابت', discountValue: 50, discountReason: 'منحة',
    exempt: 'نعم', exemptReason: 'حالة اجتماعية',
  }));
  assert.equal(result.ok, true);
  assert.equal(result.due, 0);
  assert.equal(result.exemptionAmount, 100);
});

test('waiver and overpayment constraints are enforced', () => {
  assert.equal(calculateFee(fee({
    exempt: 'نعم', exemptReason: 'حالة اجتماعية', paid: 1,
  })).error, 'exempt_and_paid');
  assert.equal(calculateFee(fee({ paid: 151 })).error, 'paid_over_due');
  assert.equal(calculateFee(fee({ baseDue: 0 })).error, 'base_required');
});

test('financial edits are distinguished from non-financial edits', () => {
  const original = fee({ paid: 50, date: '2026-10-10' });
  assert.equal(hasFinancialChanges(original, { ...original, notes: 'تحديث ملاحظة' }), false);
  assert.equal(hasFinancialChanges(original, { ...original, paid: 75 }), true);
});

test('issued receipt snapshots stay unchanged after transaction edits', () => {
  const source = { rec: 'R-00001', paid: 50, playerName: 'لاعب', currency: 'درهم' };
  const issued = snapshotDocument(source);
  source.paid = 75;
  source.playerName = 'اسم معدّل';
  assert.equal(issued.paid, 50);
  assert.equal(issued.playerName, 'لاعب');
  assert.equal(issued.currency, 'درهم');
});

test('offline devices with the same sequence issue distinct receipt numbers', () => {
  const deviceA = { receiptSeq: 4 };
  const deviceB = { receiptSeq: 4 };
  const receiptA = nextReceiptNumber(deviceA, [], [], '1111111111111111');
  const receiptB = nextReceiptNumber(deviceB, [], [], '2222222222222222');

  assert.equal(receiptA, 'R-00005-1111111111111111');
  assert.equal(receiptB, 'R-00005-2222222222222222');
  assert.notEqual(receiptA, receiptB);

  // After merging both documents, the next local sequence advances beyond both.
  assert.equal(
    nextReceiptNumber({ receiptSeq: 5 }, [], [{ rec: receiptA }, { rec: receiptB }], '3333333333333333'),
    'R-00006-3333333333333333',
  );
});

test('receipt numbering advances from legacy sequential numbers', () => {
  assert.equal(
    nextReceiptNumber({}, [{ rec: 'R-00009' }], [], 'ABCDEF0123456789'),
    'R-00010-ABCDEF0123456789',
  );
});

test('receipt numbers generate a secure-format suffix by default', () => {
  const first = nextReceiptNumber({}, [], []);
  const second = nextReceiptNumber({}, [], []);
  assert.match(first, /^R-00001-[A-F0-9]{16}$/);
  assert.match(second, /^R-00001-[A-F0-9]{16}$/);
  assert.notEqual(first, second);
});

test('receipt archive remains immutable and financial corrections get a new number', () => {
  const archive = [];
  const original = {
    id: 'sub-1', rec: 'R-00001-1111111111111111', paid: 50, due: 100,
    receiptIssuedAt: '2026-10-10T12:00:00.000Z',
  };
  const issued = ensureReceiptSnapshot(archive, original, (record, issuedAt) => ({
    id: 'doc-1', subsId: record.id, rec: record.rec, issuedAt,
    snapshot: snapshotDocument({ paid: record.paid, due: record.due }),
  }));

  const updated = { ...original, paid: 75 };
  const assigned = prepareReceiptCorrection(original, updated, () => 'R-00002-2222222222222222');
  assert.equal(assigned, true);
  assert.equal(updated.receiptCorrectionOf, original.rec);
  assert.equal(updated.rec, 'R-00002-2222222222222222');
  assert.equal(updated.receiptDocId, '');
  assert.equal(issued.snapshot.paid, 50);
  assert.equal(archive.length, 1);
});

test('receipt snapshot lookup reuses an existing issued document', () => {
  const issued = { id: 'doc-1', subsId: 'sub-1', rec: 'R-00001', issuedAt: '2026-10-10' };
  const archive = [issued];
  const record = { id: 'sub-1', rec: 'R-00001', receiptDocId: '', receiptIssuedAt: '' };
  let createCount = 0;
  const result = ensureReceiptSnapshot(archive, record, () => {
    createCount += 1;
    return { id: 'unexpected' };
  });
  assert.equal(result, issued);
  assert.equal(createCount, 0);
  assert.equal(record.receiptDocId, issued.id);
});

test('legacy issued transactions are migrated into immutable receipt snapshots', () => {
  const archive = [];
  const legacy = {
    id: 'sub-legacy', rec: 'R-00003', paid: 25, due: 100,
    receiptIssuedAt: '2026-10-09T10:00:00.000Z',
  };
  const changed = migrateReceiptSnapshots(archive, [legacy], (record, issuedAt) => ({
    id: 'doc-legacy', subsId: record.id, rec: record.rec, issuedAt,
    snapshot: snapshotDocument({ paid: record.paid, due: record.due }),
  }));
  assert.equal(changed, true);
  assert.equal(archive.length, 1);
  assert.equal(archive[0].issuedAt, legacy.receiptIssuedAt);
  assert.equal(legacy.receiptDocId, 'doc-legacy');
  assert.equal(migrateReceiptSnapshots(archive, [legacy], () => {
    throw new Error('already migrated');
  }), false);
});
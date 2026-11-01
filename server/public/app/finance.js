/* Pure financial validation shared by the browser app and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MalaabnaFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FINANCIAL_FIELDS = [
    'player', 'kind', 'month', 'year', 'baseDue', 'discountType',
    'discountValue', 'discountAmount', 'discountReason', 'exempt',
    'exemptReason', 'exemptionAmount', 'due', 'paid', 'date', 'method',
  ];

  function roundCurrency(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function calculateFee(record) {
    const exempt = record.exempt === 'نعم';
    const base = Math.max(0, Number(record.baseDue != null ? record.baseDue : record.due) || 0);
    const value = Math.max(0, Number(record.discountValue) || 0);

    if (base <= 0 && !exempt) return { ok: false, error: 'base_required' };
    if (record.discountType === 'نسبة مئوية' && value > 100) {
      return { ok: false, error: 'percent_over_100' };
    }

    let discount = record.discountType === 'مبلغ ثابت'
      ? Math.min(base, value)
      : (record.discountType === 'نسبة مئوية' ? base * value / 100 : 0);
    discount = roundCurrency(discount);

    if (discount > 0 && !String(record.discountReason || '').trim()) {
      return { ok: false, error: 'discount_reason_required' };
    }
    if (exempt && !String(record.exemptReason || '').trim()) {
      return { ok: false, error: 'exemption_reason_required' };
    }
    if (!exempt && base > 0 && discount >= base) {
      return { ok: false, error: 'full_discount_requires_exemption' };
    }

    const afterDiscount = Math.max(0, roundCurrency(base - discount));
    const due = exempt ? 0 : afterDiscount;
    const paid = Math.max(0, Number(record.paid) || 0);
    if (exempt && paid > 0) return { ok: false, error: 'exempt_and_paid' };
    if (paid > due) return { ok: false, error: 'paid_over_due' };

    return {
      ok: true,
      base,
      value,
      discount,
      afterDiscount,
      due,
      paid,
      exemptionAmount: exempt ? afterDiscount : 0,
      exempt,
    };
  }

  function splitRegistrationFee(record, installmentCount, createId) {
    const count = Number(installmentCount);
    if (![2, 3].includes(count)) return { ok: false, error: 'invalid_installment_count' };
    if (typeof createId !== 'function') return { ok: false, error: 'missing_id_factory' };

    const calculation = calculateFee(record || {});
    if (!calculation.ok) return calculation;
    if (calculation.exempt || calculation.paid > 0 || calculation.due <= 0) {
      return { ok: false, error: 'installments_unavailable' };
    }

    const baseCents = Math.round(calculation.base * 100);
    const dueCents = Math.round(calculation.due * 100);
    if (baseCents < count || dueCents < count) {
      return { ok: false, error: 'installment_amount_too_small' };
    }
    const distribute = (cents) => {
      const each = Math.floor(cents / count);
      const remainder = cents % count;
      return Array.from({ length: count }, (_, index) => each + (index >= count - remainder ? 1 : 0));
    };
    const baseParts = distribute(baseCents);
    const dueParts = distribute(dueCents);
    const planId = createId();
    const records = baseParts.map((base, index) => {
      const discount = base - dueParts[index];
      if (discount < 0) return null;
      const discountAmount = discount / 100;
      return {
        ...snapshotDocument(record),
        id: createId(),
        registrationPlanId: planId,
        registrationInstallment: index + 1,
        registrationInstallmentCount: count,
        baseDue: base / 100,
        discountType: discount > 0 ? 'مبلغ ثابت' : 'بدون',
        discountValue: discountAmount,
        discountAmount,
        due: dueParts[index] / 100,
        paid: 0,
        exemptionAmount: 0,
        exempt: 'لا',
        state: '🔴 غير مؤدى',
        rec: '',
        receiptDocId: '',
        receiptIssuedAt: '',
      };
    });
    if (records.some((item) => item === null)) return { ok: false, error: 'invalid_installment_split' };
    return { ok: true, planId, records, base: calculation.base, discount: calculation.discount, due: calculation.due };
  }

  function splitAdvanceAmount(amount, installmentCount) {
    const count = Number(installmentCount);
    const total = Number(amount);
    if (!Number.isInteger(count) || count < 2 || count > 24) {
      return { ok: false, error: 'invalid_installment_count' };
    }
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, error: 'invalid_amount' };
    }

    const cents = Math.round(total * 100);
    if (cents < count) return { ok: false, error: 'installment_amount_too_small' };
    const each = Math.floor(cents / count);
    const remainder = cents % count;
    const amounts = Array.from(
      { length: count },
      (_, index) => (each + (index >= count - remainder ? 1 : 0)) / 100,
    );
    return { ok: true, total: cents / 100, amounts };
  }

  function monthlyInstallmentDates(startDate, installmentCount) {
    const count = Number(installmentCount);
    const match = String(startDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!Number.isInteger(count) || count < 2 || count > 24) {
      return { ok: false, error: 'invalid_installment_count' };
    }
    if (!match) return { ok: false, error: 'invalid_start_date' };

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const initial = new Date(Date.UTC(year, month, day));
    if (
      initial.getUTCFullYear() !== year
      || initial.getUTCMonth() !== month
      || initial.getUTCDate() !== day
    ) {
      return { ok: false, error: 'invalid_start_date' };
    }

    const dates = Array.from({ length: count }, (_, index) => {
      const targetMonth = month + index;
      const targetYear = year + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
      const date = new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)));
      return date.toISOString().slice(0, 10);
    });
    return { ok: true, dates };
  }

  function hasFinancialChanges(before, after) {
    return FINANCIAL_FIELDS.some((field) => {
      const a = before && before[field];
      const b = after && after[field];
      if (typeof a === 'number' || typeof b === 'number') {
        return Number(a || 0) !== Number(b || 0);
      }
      return String(a == null ? '' : a) !== String(b == null ? '' : b);
    });
  }

  function snapshotDocument(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Exact-plan summary captured once at receipt issuance; never backfilled into old receipts.
  function registrationPlanSnapshot(record, subscriptions, capturedAt) {
    if (!record || record.kind !== 'رسوم التسجيل' || Number(record.registrationInstallmentCount) <= 1) return null;
    const count = Number(record.registrationInstallmentCount);
    const summary = { version: 1, planId: record.registrationPlanId || '', count, capturedAt: capturedAt || '', complete: false };
    if (!record.registrationPlanId || !record.player || !Number.isInteger(count) || count > 60) return summary;
    const rows = (Array.isArray(subscriptions) ? subscriptions : []).filter(x => x && x.kind === 'رسوم التسجيل' && x.player === record.player && x.registrationPlanId === record.registrationPlanId).map(x => x.id === record.id ? record : x);
    if (rows.length !== count || !rows.some(x => x.id === record.id)) return summary;
    const ids = new Set(), indexes = new Set(), installments = [];
    let dueCents = 0, paidCents = 0;
    for (const row of rows) {
      const index = Number(row.registrationInstallment);
      if (!row.id || ids.has(row.id) || indexes.has(index) || !Number.isInteger(index) || index < 1 || index > count || Number(row.registrationInstallmentCount) !== count) return summary;
      ids.add(row.id); indexes.add(index);
      if (!Number.isFinite(Number(row.paid == null ? 0 : row.paid)) || Number(row.paid || 0) < 0) return summary;
      const c = calculateFee(row);
      if (!c.ok || !Number.isFinite(c.due) || !Number.isFinite(c.paid) || c.due < 0 || c.paid < 0 || Math.abs(c.paid * 100 - Math.round(c.paid * 100)) > 0.000001) return summary;
      const due = Math.round(c.due * 100), paid = Math.round(c.paid * 100);
      if (!Number.isSafeInteger(due) || !Number.isSafeInteger(paid) || paid > due || (row.due != null && Math.round(Number(row.due) * 100) !== due)) return summary;
      dueCents += due; paidCents += paid;
      installments.push({ number: index, due: due / 100, paid: paid / 100, rest: (due - paid) / 100 });
    }
    if (!Number.isSafeInteger(dueCents) || !Number.isSafeInteger(paidCents)) return summary;
    return { ...summary, complete: true, totalDue: dueCents / 100, totalPaid: paidCents / 100, totalRest: (dueCents - paidCents) / 100, installments: installments.sort((a, b) => a.number - b.number) };
  }

  // All money in this workflow is validated in integer cents, not silently clamped.
  function moneyCents(value) {
    const n = Number(value);
    if (value === '' || value == null || !Number.isFinite(n) || n < 0 || Math.abs(n * 100 - Math.round(n * 100)) > 0.000001 || !Number.isSafeInteger(Math.round(n * 100))) return null;
    return Math.round(n * 100);
  }

  function paymentLedger(record) {
    const paid = moneyCents(record.paid == null ? 0 : record.paid);
    if (paid == null) return { ok: false, error: 'invalid_ledger' };
    if (!Array.isArray(record.paymentHistory) || !record.paymentHistory.length) {
      return { ok: true, entries: paid ? [{ amount: paid / 100, date: record.date || '', method: record.method || '', rec: record.rec || '', receiptId: record.receiptDocId || '', opening: true }] : [] };
    }
    const opening = record.paymentOpening;
    if (!opening || moneyCents(opening.amount) == null) return { ok: false, error: 'invalid_ledger' };
    const entries = moneyCents(opening.amount) ? [{ ...snapshotDocument(opening), opening: true }] : [];
    let sum = moneyCents(opening.amount);
    const ids = new Set();
    for (const event of record.paymentHistory) {
      const cents = moneyCents(event.amount);
      if (!event.id || ids.has(event.id) || cents == null || cents <= 0 || !event.rec || !event.receiptId) return { ok: false, error: 'invalid_ledger' };
      ids.add(event.id); sum += cents;
      entries.push({ ...snapshotDocument(event), opening: false });
    }
    return Number.isSafeInteger(sum) && sum === paid ? { ok: true, entries } : { ok: false, error: 'invalid_ledger' };
  }

  function addInstallmentPayment(record, input, expectedPaid) {
    if (!record || record.kind !== 'رسوم التسجيل' || !record.registrationPlanId || Number(record.registrationInstallmentCount) <= 1) return { ok: false, error: 'not_installment' };
    const c = calculateFee(record), current = moneyCents(record.paid == null ? 0 : record.paid), amount = moneyCents(input.amount);
    if (!c.ok || c.exempt || current == null || moneyCents(record.due) !== moneyCents(c.due)) return { ok: false, error: 'invalid_fee' };
    if (moneyCents(expectedPaid) !== current) return { ok: false, error: 'stale_payment' };
    if (amount == null || amount <= 0) return { ok: false, error: 'invalid_payment' };
    if (current + amount > moneyCents(c.due)) return { ok: false, error: 'paid_over_due' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10) !== input.date) return { ok: false, error: 'invalid_date' };
    if (!['نقداً','تحويل بنكي','شيك','تحويل إلكتروني'].includes(input.method)) return { ok: false, error: 'invalid_method' };
    const ledger = paymentLedger(record);
    if (!ledger.ok) return ledger;
    if (!input.id || !input.rec || !input.receiptId || !input.issuedAt) return { ok: false, error: 'missing_payment_identity' };
    if ((record.paymentHistory || []).some(e => e.id === input.id)) return { ok: false, error: 'duplicate_payment' };
    const updated = snapshotDocument(record);
    if (!updated.paymentHistory || !updated.paymentHistory.length) {
      updated.paymentOpening = { amount: current / 100, date: record.date || '', method: record.method || '', rec: record.rec || '', receiptId: record.receiptDocId || '' };
      updated.paymentHistory = [];
    }
    const event = { id: input.id, amount: amount / 100, date: input.date, method: input.method, rec: input.rec, receiptId: input.receiptId, issuedAt: input.issuedAt };
    updated.paymentHistory.push(event);
    updated.paid = (current + amount) / 100; updated.date = input.date; updated.method = input.method;
    updated.rec = input.rec; updated.receiptDocId = input.receiptId; updated.receiptIssuedAt = input.issuedAt;
    delete updated.receiptCorrectionOf;
    return { ok: true, record: updated, event, previousPaid: current / 100 };
  }

  // Current records are the source of balances; archived/corrected receipts are not re-summed.
  function playerAccountSnapshot(playerId, subscriptions) {
    const groups = ['رسوم التسجيل','الاشتراكات الشهرية','رسوم أخرى'].map(title => ({ title, rows: [], due: 0, paid: 0, rest: 0 }));
    const payments = [], warnings = [];
    for (const s of (subscriptions || []).filter(s => s && s.player === playerId)) {
      const due = moneyCents(s.exempt === 'نعم' || /معفى/.test(s.state || '') ? 0 : s.due), paid = moneyCents(s.paid == null ? 0 : s.paid);
      if (due == null || paid == null || paid > due) { warnings.push('سجل بمبالغ غير صالحة: ' + s.id); continue; }
      const index = s.kind === 'رسوم التسجيل' ? 0 : (!s.kind || s.kind === 'اشتراك شهري') ? 1 : 2;
      const label = index === 0 ? 'رسوم التسجيل' + (Number(s.registrationInstallmentCount) > 1 ? ' — الدفعة ' + s.registrationInstallment + ' من ' + s.registrationInstallmentCount : '') : index === 1 ? 'اشتراك ' + [s.month,s.year].filter(Boolean).join(' ') : s.kind;
      const row = { id: s.id, label, due: due/100, paid: paid/100, rest: (due-paid)/100, exempt: s.exempt === 'نعم' || /معفى/.test(s.state || ''), rec: s.rec || '', receiptId: s.receiptDocId || '' };
      const g = groups[index]; g.rows.push(row); g.due += due; g.paid += paid; g.rest += due-paid;
      const ledger = paymentLedger(s);
      if (!ledger.ok) { warnings.push('تفصيل الأداء غير متطابق: ' + label); continue; }
      ledger.entries.forEach(e => payments.push({ ...e, subsId: s.id, label, category: g.title }));
    }
    const totals = { due: 0, paid: 0, rest: 0 };
    groups.forEach(g => { for (const k of ['due','paid','rest']) { totals[k] += g[k]; g[k] /= 100; } });
    for (const k of ['due','paid','rest']) totals[k] /= 100;
    payments.sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.rec || '').localeCompare(String(b.rec || '')));
    return { groups, totals, payments, warnings, complete: !warnings.length };
  }

  function secureReceiptSuffix() {
    let cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if ((!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') && typeof require === 'function') {
      try { cryptoApi = require('node:crypto').webcrypto; } catch (_error) {}
    }
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error('secure_random_unavailable');
    }
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  // Keep the human-readable sequence, but add a cryptographically random,
  // per-document suffix so two offline devices cannot issue the same number.
  function nextReceiptNumber(settings, subscriptions, receipts, suffix) {
    const cfg = settings && typeof settings === 'object' ? settings : {};
    const known = (Array.isArray(subscriptions) ? subscriptions : [])
      .concat(Array.isArray(receipts) ? receipts : []);
    const highest = known.reduce((max, record) => {
      const match = String(record && record.rec || '').match(/^R-(\d+)(?:-|$)/i);
      return match ? Math.max(max, Number(match[1]) || 0) : max;
    }, Math.max(0, Number(cfg.receiptSeq) || 0));
    const next = highest + 1;
    cfg.receiptSeq = next;
    const token = suffix == null ? secureReceiptSuffix() : String(suffix).toUpperCase();
    if (!/^[A-F0-9]{16}$/.test(token)) throw new Error('invalid_receipt_suffix');
    return `R-${String(next).padStart(5, '0')}-${token}`;
  }

  function ensureReceiptSnapshot(receipts, record, createDocument) {
    const archive = Array.isArray(receipts) ? receipts : [];
    const existing = (record.receiptDocId && archive.find((item) => item.id === record.receiptDocId))
      || archive.find((item) => item.subsId === record.id && item.rec === record.rec);
    if (existing) {
      record.receiptDocId = existing.id;
      record.receiptIssuedAt = existing.issuedAt;
      return existing;
    }
    const issuedAt = record.receiptIssuedAt || new Date().toISOString();
    const document = createDocument(record, issuedAt);
    archive.push(document);
    record.receiptDocId = document.id;
    record.receiptIssuedAt = issuedAt;
    return document;
  }

  function migrateReceiptSnapshots(receipts, subscriptions, createDocument) {
    const archive = Array.isArray(receipts) ? receipts : [];
    let changed = false;
    (Array.isArray(subscriptions) ? subscriptions : []).forEach((record) => {
      if (record && record.receiptIssuedAt && !record.receiptDocId) {
        ensureReceiptSnapshot(archive, record, createDocument);
        changed = true;
      }
    });
    return changed;
  }

  function prepareReceiptCorrection(existing, updated, nextNumber) {
    if (!existing || !existing.receiptIssuedAt || !hasFinancialChanges(existing, updated)) return false;
    const priorReceipt = existing.rec || '';
    updated.receiptDocId = '';
    updated.receiptIssuedAt = '';
    updated.rec = '';
    if (Number(updated.paid) > 0 || updated.exempt === 'نعم') updated.rec = nextNumber();
    updated.receiptCorrectionOf = priorReceipt;
    return true;
  }

  // A source document may have one direct successor, never two competing branches.
  // This is also used before applying a three-way synchronization merge.
  function receiptCorrectionConflicts(receipts) {
    const successors = new Map();
    for (const receipt of Array.isArray(receipts) ? receipts : []) {
      const sourceId = receipt && receipt.correction && receipt.correction.sourceId;
      if (!sourceId) continue;
      if (!successors.has(sourceId)) successors.set(sourceId, []);
      successors.get(sourceId).push(receipt);
    }
    const conflicts = [];
    for (const [sourceId, documents] of successors) {
      if (documents.length > 1) conflicts.push({
        sourceId,
        sourceRec: documents[0].correction.sourceRec || '',
        receiptIds: documents.map(document => document.id),
        numbers: documents.map(document => document.rec),
      });
    }
    return conflicts;
  }

  return {
    calculateFee,
    moneyCents,
    paymentLedger,
    addInstallmentPayment,
    playerAccountSnapshot,
    registrationPlanSnapshot,
    splitRegistrationFee,
    splitAdvanceAmount,
    monthlyInstallmentDates,
    ensureReceiptSnapshot,
    hasFinancialChanges,
    migrateReceiptSnapshots,
    nextReceiptNumber,
    prepareReceiptCorrection,
    roundCurrency,
    snapshotDocument,
    receiptCorrectionConflicts,
  };
});
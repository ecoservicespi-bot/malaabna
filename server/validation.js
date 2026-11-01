const REQUIRED_COLLECTIONS = [
  'teams', 'parents', 'coaches', 'players', 'trainings', 'attendance',
  'matches', 'evals', 'subs', 'expenses', 'equip', 'docs', 'loans',
  'announcements', 'cashClosings', 'syncLog', 'audit',
];

const FILE_DATA_RE = /^data:(?:image\/(?:png|jpe?g|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/\s=]+$/i;
const MAX_DB_NESTING_DEPTH = 64;
const { receiptCorrectionConflicts } = require('./public/app/finance');

function stableJson(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
}

function correctionError(message, code = 'invalid_receipt_correction') {
  return { ok: false, code, message };
}

function validateReceiptCorrections(receipts) {
  const archive = Array.isArray(receipts) ? receipts : [];
  const byId = new Map();
  for (const receipt of archive) {
    if (!receipt.id) continue; // Preserve compatibility with legacy unlinked archives.
    if (byId.has(receipt.id)) return correctionError('معرّف وثيقة مكرر في أرشيف الوصولات.');
    byId.set(receipt.id, receipt);
  }
  const conflicts = receiptCorrectionConflicts(archive);
  if (conflicts.length) return correctionError(
    'توجد نسختان مصححتان للوثيقة نفسها: ' + (conflicts[0].sourceRec || conflicts[0].sourceId) + '. اجلب النسخة المعتمدة قبل المتابعة.',
    'receipt_correction_conflict',
  );
  const rootCache = new Map();
  for (const receipt of archive) {
    if (receipt.correction === undefined) continue;
    const correction = receipt.correction;
    if (!correction || typeof correction !== 'object' || Array.isArray(correction)
      || typeof receipt.id !== 'string' || !receipt.id
      || typeof correction.sourceId !== 'string' || !correction.sourceId
      || typeof correction.sourceRec !== 'string' || !correction.sourceRec
      || typeof correction.rootId !== 'string' || !correction.rootId
      || typeof correction.reason !== 'string' || !correction.reason.trim() || correction.reason.length > 500
      || typeof correction.preparedAt !== 'string' || !Number.isFinite(Date.parse(correction.preparedAt))) {
      return correctionError('بيانات تصحيح الوصل ناقصة أو غير صالحة.');
    }
    const source = byId.get(correction.sourceId);
    if (!source || source.id === receipt.id || correction.sourceRec !== source.rec) {
      return correctionError('النسخة المصححة لا تشير إلى وثيقة أصلية صالحة داخل الأرشيف.');
    }
    const seen = new Set([receipt.id]), traversed = [];
    let root = source, rootId;
    while (true) {
      if (seen.has(root.id)) return correctionError('توجد حلقة غير صالحة في سلسلة تصحيحات الوصل.');
      if (rootCache.has(root.id)) { rootId = rootCache.get(root.id); break; }
      seen.add(root.id); traversed.push(root.id);
      if (!root.correction) { rootId = root.id; break; }
      root = byId.get(root.correction.sourceId);
      if (!root) return correctionError('سلسلة تصحيحات الوصل غير مكتملة.');
    }
    if (correction.rootId !== rootId) {
      return correctionError('مرجع أصل سلسلة تصحيحات الوصل غير صحيح.');
    }
    for (const id of traversed.concat(receipt.id)) rootCache.set(id, rootId);
    // Identity correction may not change monetary or historical payment facts.
    const immutable = ['subsId', 'issuedAt', 'type', 'base', 'discount', 'due', 'paid', 'rest',
      'payment', 'registrationPlan', 'currency', 'logo', 'stamp'];
    if (immutable.some(key => stableJson(receipt[key]) !== stableJson(source[key]))) {
      return correctionError('لا يمكن تغيير المبالغ أو تاريخ الإصدار أو تفاصيل الأداء عند تصحيح بيانات الوصل.');
    }
    const sourceFee = { ...(source.s || {}) }, correctedFee = { ...(receipt.s || {}) };
    delete sourceFee.rec; delete correctedFee.rec;
    if (stableJson(sourceFee) !== stableJson(correctedFee)
      || (receipt.s && receipt.s.rec !== receipt.rec)) {
      return correctionError('لا يمكن تغيير بيانات الرسم المالية في نسخة تصحيح تعريفية.');
    }
  }
  return { ok: true };
}

// An accepted correction and its predecessors cannot be replaced or removed by
// a later full-database upload, including force uploads and legacy clients.
// An explicit server backup restore remains a separate administrative operation.
function validateReceiptHistory(db, previousDb) {
  const previous = Array.isArray(previousDb && previousDb.receipts) ? previousDb.receipts : [];
  const incoming = new Map((Array.isArray(db.receipts) ? db.receipts : []).map(receipt => [receipt.id, receipt]));
  const incomingBySource = new Map([...incoming.values()]
    .filter(receipt => receipt.correction)
    .map(receipt => [receipt.correction.sourceId, receipt]));
  const previousById = new Map(previous.map(receipt => [receipt.id, receipt]));
  const protectedIds = new Set();
  for (const receipt of incoming.values()) {
    if (!receipt.correction) continue;
    if (previousById.has(receipt.correction.sourceId)) protectedIds.add(receipt.correction.sourceId);
    if (previousById.has(receipt.id)) protectedIds.add(receipt.id);
  }
  for (const receipt of previous) {
    if (!receipt.correction) continue;
    const successor = incomingBySource.get(receipt.correction.sourceId);
    if (successor && successor.id !== receipt.id) return correctionError(
      'سبق اعتماد تصحيح لهذه الوثيقة. النسخة المعتمدة: ' + receipt.rec + '. صدّر نسخة احتياطية محلية ثم اجلب آخر نسخة لإكمال التصحيح.',
      'receipt_correction_conflict',
    );
    protectedIds.add(receipt.id);
    protectedIds.add(receipt.correction.sourceId);
  }
  for (const id of protectedIds) {
    if (!incoming.has(id) || stableJson(incoming.get(id)) !== stableJson(previousById.get(id))) {
      return correctionError(
        'لا يمكن حذف أو تعديل وثيقة ضمن سلسلة تصحيحات معتمدة. احتفظ بالأرشيف واجلب آخر نسخة من الخادم.',
        'receipt_correction_conflict',
      );
    }
  }
  return { ok: true };
}

function hasSafeJsonShape(root) {
  const seen = new WeakSet();
  const pending = [{ value: root, depth: 0 }];
  while (pending.length) {
    const { value, depth } = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (depth > MAX_DB_NESTING_DEPTH || seen.has(value)) return false;
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
      pending.push({ value: value[key], depth: depth + 1 });
    }
  }
  return true;
}

function validateDbPayload(db) {
  if (!db || typeof db !== 'object' || Array.isArray(db)) {
    return { ok: false, message: 'بيانات قاعدة غير صالحة.' };
  }
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) {
    return { ok: false, message: 'إعدادات قاعدة البيانات غير صالحة.' };
  }
  if (!hasSafeJsonShape(db)) {
    return { ok: false, message: 'بيانات قاعدة غير آمنة أو متداخلة بعمق غير مسموح.' };
  }
  let jsonSize;
  try {
    jsonSize = Buffer.byteLength(JSON.stringify(db), 'utf8');
  } catch (_error) {
    return { ok: false, message: 'تعذر قراءة بنية قاعدة البيانات.' };
  }
  if (jsonSize > 12 * 1024 * 1024) return { ok: false, message: 'حجم قاعدة البيانات أكبر من الحد المسموح.' };

  for (const collection of REQUIRED_COLLECTIONS.concat(['injuries', 'receipts', 'salaryAdvances'])) {
    // Backward compatibility: older clients may omit newer optional collections.
    if ((collection === 'injuries' || collection === 'receipts' || collection === 'salaryAdvances') && db[collection] === undefined) continue;
    if (!Array.isArray(db[collection])) {
      return { ok: false, message: `المجموعة غير صالحة: ${collection}.` };
    }
    if (db[collection].length > 100000) {
      return { ok: false, message: `عدد السجلات أكبر من الحد المسموح: ${collection}.` };
    }
    for (const record of db[collection]) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return { ok: false, message: `يوجد سجل غير صالح في: ${collection}.` };
      }
      if (record.id !== undefined && (typeof record.id !== 'string' || record.id.length > 160)) {
        return { ok: false, message: `معرّف سجل غير صالح في: ${collection}.` };
      }
    }
  }

  // New-format receipt numbers contain a random per-document suffix. Reject
  // an actual collision at the sync boundary, while leaving legacy sequential
  // archives readable and synchronizable.
  const currentReceiptNumbers = new Set();
  for (const receipt of Array.isArray(db.receipts) ? db.receipts : []) {
    const number = typeof receipt.rec === 'string' ? receipt.rec : '';
    if (!/^R-\d{5}-[A-F0-9]{16}$/i.test(number)) continue;
    if (currentReceiptNumbers.has(number)) {
      return { ok: false, message: `رقم وصل مكرر: ${number}.` };
    }
    currentReceiptNumbers.add(number);
  }
  return validateReceiptCorrections(db.receipts);
}

function sanitizeFilesPayload(files) {
  if (files === undefined || files === null) return null;
  if (typeof files !== 'object' || Array.isArray(files)) return undefined;
  const result = {};
  let total = 0;
  const entries = Object.entries(files);
  if (entries.length > 5000) return undefined;
  for (const [id, value] of entries) {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || typeof value !== 'string') return undefined;
    if (!FILE_DATA_RE.test(value)) return undefined;
    if (value.length > 8 * 1024 * 1024) return undefined;
    total += value.length;
    if (total > 10 * 1024 * 1024) return undefined;
    result[id] = value;
  }
  return result;
}

module.exports = { REQUIRED_COLLECTIONS, validateDbPayload, sanitizeFilesPayload, validateReceiptHistory };
'use strict';
const crypto = require('node:crypto');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function digest(receipt) { return crypto.createHash('sha256').update(canonical(receipt)).digest('hex'); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function publicOrigin(env) {
  let url; try { url = new URL(String(env.PUBLIC_URL || '')); } catch (_) { return ''; }
  if (url.origin.length > 120 || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return '';
  const local = env.ALLOW_LOCAL_RECEIPT_VERIFICATION === 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return url.protocol === 'https:' || (url.protocol === 'http:' && local) ? url.origin : '';
}
function publish(ws, receipt, now = new Date().toISOString()) {
  const previous = ws.receiptVerification || { key: crypto.randomBytes(32).toString('hex'), entries: {} };
  const registry = structuredClone(previous);
  const fingerprint = digest(receipt);
  const token = crypto.createHmac('sha256', registry.key).update(receipt.id + ':' + fingerprint).digest('base64url');
  const key = tokenHash(token);
  let entry = registry.entries[key];
  if (entry && entry.supersededAt) { const e = new Error('توجد نسخة مصححة لهذا الوصل؛ لا يمكن إعادة اعتماد النسخة السابقة.'); e.status = 409; throw e; }
  if (entry && entry.revokedAt) { const e = new Error('أُلغي رابط التحقق لهذا الوصل. لا يمكن إعادة تفعيله؛ أصدر نسخة مصححة عند الحاجة.'); e.status = 409; throw e; }
  if (!entry) {
    entry = { receiptId: receipt.id, fingerprint, publishedAt: now,
      summary: { school: String(receipt.school || ws.schoolName || ''), number: String(receipt.rec || ''),
        issuedDate: String(receipt.issuedAt || '').slice(0, 10), type: receipt.type === 'exemption' ? 'exemption' : 'payment',
        amount: Number(receipt.type === 'exemption' ? (receipt.s?.exemptionAmount ?? Math.max(0, Number(receipt.base || 0) - Number(receipt.discount || 0))) : (receipt.payment?.amount ?? receipt.paid)),
        currency: String(receipt.currency || 'درهم') } };
    registry.entries[key] = entry;
  }
  return { registry, entry, token };
}
function lookup(store, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) return null;
  const key = tokenHash(token);
  for (const ws of Object.values(store)) {
    const entry = ws.receiptVerification?.entries?.[key];
    if (!entry) continue;
    const receipt = ws.db?.receipts?.find(doc => doc.id === entry.receiptId);
    let status = 'valid';
    if (entry.revokedAt) status = 'revoked';
    else if (!receipt || digest(receipt) !== entry.fingerprint) status = 'unavailable';
    else if (entry.supersededAt || ws.db.receipts.some(doc => doc.correction?.sourceId === receipt.id)) status = 'corrected';
    return { status, ...entry.summary, fingerprint: entry.fingerprint, publishedAt: entry.publishedAt };
  }
  return null;
}
function rememberCorrections(ws, receipts) {
  const entries = ws.receiptVerification?.entries;
  if (!entries) return;
  const corrections = new Map((receipts || []).filter(receipt => receipt.correction?.sourceId).map(receipt => [receipt.correction.sourceId, receipt.correction.preparedAt]));
  for (const entry of Object.values(entries)) if (!entry.supersededAt && corrections.has(entry.receiptId)) {
    entry.supersededAt = corrections.get(entry.receiptId) || new Date().toISOString();
  }
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(result, checkedAt) {
  const states = { valid: ['وصل مسجّل وصالح', 'تطابق هذه النسخة السجل المنشور على خادم المدرسة. قارن رقم الوصل والمبلغ والتاريخ بالمستند الذي لديك.'],
    corrected: ['توجد نسخة مصحّحة', 'هذه نسخة سابقة. اطلب النسخة المصححة من إدارة المدرسة؛ لا تعتمدها بوصفها النسخة الأحدث.'],
    revoked: ['رابط التحقق ملغى', 'ألغت إدارة المدرسة اعتماد هذا الرابط. الإلغاء لا يحذف عملية الأداء ولا يثبت استرجاع المبلغ.'],
    unavailable: ['تعذّر تأكيد الوصل', 'السجل غير متاح أو لا يطابق النسخة المنشورة. تواصل مع إدارة المدرسة قبل الاعتماد عليه.'],
    missing: ['رابط غير صالح أو غير معروف', 'لم يُعثر على سجل تحقق لهذا الرابط. تأكد من الرابط وتواصل مع المدرسة.'] };
  const status = result?.status || 'missing', [title, note] = states[status];
  const rows = result ? [['المدرسة', result.school], ['رقم الوصل', result.number], ['تاريخ الإصدار', result.issuedDate],
    [result.type === 'exemption' ? 'المبلغ المعفى' : 'المبلغ المؤدى بهذا الوصل', Number(result.amount).toLocaleString('ar-MA', { maximumFractionDigits: 2 }) + ' ' + result.currency]] : [];
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>التحقق من الوصل — ملعبنا</title><link rel="stylesheet" href="/verify.css"></head><body><main><header><span>ملعبنا · التحقق من الوصولات</span><h1>تحقّق من الوصل</h1><p>المرجع هو السجل الحالي على خادم المدرسة، وليس النص الموجود داخل رمز QR.</p></header><section class="state ' + status + '" role="status"><strong>' + title + '</strong><p>' + note + '</p></section>' +
    (rows.length ? '<dl>' + rows.map(([key, value]) => '<div><dt>' + escape(key) + '</dt><dd dir="auto">' + escape(value) + '</dd></div>').join('') + '</dl>' : '') +
    '<p class="checked">وقت الفحص: <bdi>' + escape(checkedAt) + '</bdi></p><aside>حماية الخصوصية: لا يعرض هذا الرابط اسم اللاعب أو ولي الأمر أو الهاتف. يمكن لمن يملك الرابط الاطلاع على الملخص أعلاه.</aside><footer>هذا تحقق من سجل المدرسة، وليس توقيعاً إلكترونياً معتمداً أو إثباتاً لهوية حامل المستند. يجب أن يكون عنوان الموقع هو عنوان المدرسة الموثوق.</footer></main></body></html>';
}
module.exports = { canonical, digest, tokenHash, publicOrigin, publish, lookup, rememberCorrections, page };

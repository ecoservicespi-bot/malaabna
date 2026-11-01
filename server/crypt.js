/* تشفير البيانات على القرص (AES-256-GCM). المفاتيح الجديدة تكون 32 بايت عشوائية بصيغة 64 خانة hex. */
const crypto = require('crypto');
function keyFrom(secret) {
  if (!secret) return null;
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, 'hex');
  if (process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY === 'true') {
    return crypto.scryptSync(String(secret), 'malaabna-data-v1', 32);
  }
  throw new Error('DATA_KEY يجب أن يكون 64 خانة hex تمثل 32 بايت عشوائية.');
}
function encrypt(text, secret) {
  const key = keyFrom(secret);
  if (!key) return text;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return JSON.stringify({ __enc: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: enc.toString('base64') });
}
function decrypt(raw, secret) {
  let obj = null;
  try { obj = JSON.parse(raw); } catch (e) { return raw; }
  if (!obj || obj.__enc !== 1) return raw; // ملف قديم غير مشفّر
  const key = keyFrom(secret);
  if (!key) throw new Error('الملف مشفّر لكن DATA_KEY غير موجود في .env');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(obj.iv, 'base64'));
  d.setAuthTag(Buffer.from(obj.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(obj.data, 'base64')), d.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };

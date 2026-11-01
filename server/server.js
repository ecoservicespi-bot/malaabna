/**
 * خادم مزامنة "ملعبنا" — نسخة التشغيل المحلي (Local Server + Cloudflare Tunnel)
 * -----------------------------------------------------------------------------
 * يعمل هذا الخادم على جهازك الخاص (حاسوب يبقى مفتوحاً)، ويُربط بالإنترنت عبر
 * Cloudflare Tunnel (بدون فتح أي منفذ في الراوتر). البيانات تُخزَّن محلياً في
 * ملف JSON داخل مجلد data/ بجانب هذا الملف، مع نسخ احتياطية دورية تلقائية.
 *
 * كل مدرسة = "مساحة عمل" (workspace) واحدة، معرَّفة بـ:
 *   - code   : رمز عام قصير (8 خانات)
 *   - secret : كلمة سر سرية طويلة (تُولَّد عشوائياً مرة واحدة عند الإنشاء)
 * كلمة السر لا تُخزَّن أبداً كنص صريح، فقط bcrypt hash لها.
 */
require('dotenv').config();
const AttendanceSync=require('./attendance-sync');
const MemberCardDesign=require('./member-card-design');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const { encrypt, decrypt } = require('./crypt');
const { readStore, guardedWrite } = require('./durable-store');
const { validateDbPayload, sanitizeFilesPayload, validateReceiptHistory } = require('./validation');
const DATA_KEY = process.env.DATA_KEY || '';
const ALLOW_PLAINTEXT_DATA = process.env.ALLOW_PLAINTEXT_DATA === 'true';
const ALLOW_LEGACY_PASSPHRASE_DATA_KEY = process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY === 'true';

if (DATA_KEY && !/^[0-9a-fA-F]{64}$/.test(DATA_KEY) && !ALLOW_LEGACY_PASSPHRASE_DATA_KEY) {
  console.error('⛔ DATA_KEY غير صالح. استخدم مفتاحاً عشوائياً من 32 بايت (64 خانة hex).');
  console.error('   للتوافق المؤقت مع بيانات مشفّرة بمفتاح عبارة قديم: اضبط ALLOW_LEGACY_PASSPHRASE_DATA_KEY=true.');
  process.exit(1);
}
if (DATA_KEY && !/^[0-9a-fA-F]{64}$/.test(DATA_KEY)) {
  console.warn('⚠️ وضع DATA_KEY القديم مفعّل. استخدمه مؤقتاً فقط لفتح بيانات قديمة، ولا تنشئ به إعداداً جديداً.');
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'workspaces.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const EXTERNAL_BACKUP_DIR = String(process.env.BACKUP_EXTERNAL_DIR || '').trim();
const configuredMaxBackups = Number(process.env.MAX_BACKUPS || 20);
const MAX_BACKUPS = Number.isFinite(configuredMaxBackups) ? Math.max(3, Math.min(100, configuredMaxBackups)) : 20;

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

if (!DATA_KEY && !ALLOW_PLAINTEXT_DATA) {
  console.error('⛔ DATA_KEY غير مضبوط. لن يبدأ الخادم حتى يتم تفعيل تشفير البيانات.');
  console.error('   للتجربة المحلية فقط: أضف ALLOW_PLAINTEXT_DATA=true إلى .env.');
  process.exit(1);
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

/* ---------- تخزين محلي بسيط (ملف JSON واحد لكل مساحات العمل) ---------- */
function loadStore() {
  try {
    const storeData = readStore(DB_FILE, DATA_KEY, decrypt);
    if (!fs.existsSync(DB_FILE)) return storeData;
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const envelope = JSON.parse(raw);
    const isEncrypted = !!envelope && envelope.__enc === 1;

    // Older releases wrote workspaces.json as plain JSON. When encryption is
    // configured, replace that file atomically before serving any requests.
    if (!isEncrypted && DATA_KEY) {
      const tmp = DB_FILE + '.migration.tmp';
      try {
        fs.writeFileSync(tmp, encrypt(raw, DATA_KEY), { encoding: 'utf8', mode: 0o600 });
        try { fs.chmodSync(tmp, 0o600); } catch (_e) {}
        fs.renameSync(tmp, DB_FILE);
        try { fs.chmodSync(DB_FILE, 0o600); } catch (_e) {}
        console.log('🔐 رُقّي ملف البيانات القديم إلى تخزين مشفّر.');
      } catch (migrationError) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_e) {}
        migrationError.code = 'DATA_MIGRATION_FAILED';
        throw migrationError;
      }
    }
    return storeData;
  } catch (e) {
    console.error('⚠️ تعذرت قراءة ملف البيانات:', e.message);
    if (e && e.code === 'DATA_MIGRATION_FAILED') {
      console.error('⛔ أوقفنا التشغيل لأن ترقية ملف البيانات إلى التشفير تعذرت.');
      process.exit(1);
      return {};
    }
    try { fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now()); } catch (e2) {}
    console.error('⛔ أُوقف الخادم لحماية البيانات. أصلح القراءة أو استرجع نسخة سليمة مع مفتاح DATA_KEY؛ لا تحذف الملف لتشغيل مخزن فارغ.');
    process.exit(1);
    return {};
  }
}

// طابور كتابة بسيط لمنع تلف الملف عند طلبات متزامنة
let writeQueue = Promise.resolve();
function saveStore(store) {
  if (typeof syncSessionsToStore === 'function') syncSessionsToStore(store); // لقطة الجلسات تُكتب مع كل حفظ
  writeQueue = writeQueue.catch((err) => {
    console.error('⚠️ تعافت طابور الكتابة بعد خطأ سابق:', err && err.message ? err.message : err);
  }).then(
    () =>
      new Promise((resolve, reject) => {
        const tmp = DB_FILE + '.tmp';
        fs.writeFile(tmp, encrypt(JSON.stringify(store, null, 2), DATA_KEY), 'utf8', (err) => {
          if (err) return reject(err);
          fs.rename(tmp, DB_FILE, (err2) => {
            if (err2) return reject(err2);
            try { fs.chmodSync(DB_FILE, 0o600); } catch (_e) {}
            resolve();
          });
        });
      })
  );
  return writeQueue;
}

// Back up only bytes already committed on disk. Status is persisted across restarts.
const {createManager}=require('./backup-manager');
const backups=createManager({dataFile:DB_FILE,backupDir:BACKUP_DIR,stateFile:path.join(DATA_DIR,'backup-state.json'),externalDir:EXTERNAL_BACKUP_DIR,key:DATA_KEY,max:MAX_BACKUPS});
function maybeBackup(){try{backups.maybeCreate();}catch(_){console.warn('⚠️ backup_failed: راجع حالة النظام.');}}
let backupMaintenanceBusy=false,lastDrillAttempt=0;
async function backupMaintenance(){
 if(backupMaintenanceBusy||manualDrillBusy||!fs.existsSync(DB_FILE))return;
 backupMaintenanceBusy=true;
 try{maybeBackup();if(backups.status().drillDue&&backups.latest()&&Date.now()-lastDrillAttempt>86400000){lastDrillAttempt=Date.now();await backups.drill(backups.latest());}}catch(_){console.warn('⚠️ backup_maintenance_failed: راجع حالة النظام.');}finally{backupMaintenanceBusy=false;}
}
setInterval(backupMaintenance,3600000).unref();
setTimeout(backupMaintenance,30000).unref();

let store = loadStore();
if (!DATA_KEY) console.warn('⚠️ DATA_KEY غير مضبوط في .env — البيانات (بما فيها صور الوثائق) تُحفظ بدون تشفير على القرص.');

/* ---------- أدوات ---------- */
const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8); // بدون أحرف/أرقام ملتبسة (0/O ،1/I)
function genSecret() {
  return crypto.randomBytes(24).toString('hex'); // 48 خانة
}

/* ---------- الخادم ---------- */
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false); // لا تثق بـ X-Forwarded-For إلا خلف proxy موثوق
app.disable('x-powered-by');
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.set('X-Request-ID', requestId);
  next();
});
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; script-src-elem 'self' 'wasm-unsafe-eval'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:* blob: data:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  if (req.headers['x-forwarded-proto'] === 'https') res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
});
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const allowedCorsOrigins = new Set(
  String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
);
// Electron file:// renderers have Origin: null. Keep this opt-in because it
// also trusts other opaque origins; prefer an explicit origin where possible.
const allowNullCorsOrigin = process.env.ALLOW_NULL_ORIGIN === 'true';
app.use(cors({
  // The hosted web app is same-origin. Electron's file:// renderer can use
  // Origin: null, but that broad exception must be explicitly enabled.
  origin(origin, callback) {
    if (origin === 'null' && allowNullCorsOrigin) {
      return callback(null, true);
    }
    if (origin && allowedCorsOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
})); 
// Apply the coarse IP limit before parsing request bodies to reduce the cost
// of repeated large unauthenticated JSON requests. Health checks are limited too.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: '15mb' })); // لاستيعاب بيانات المدرسة + مرفقات صغيرة

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'malaabna-sync-server',
    encryptedStorage: !!DATA_KEY,
    uptimeSeconds: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
});

// حماية أشد لإنشاء مساحات عمل جديدة
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'محاولات كثيرة لإنشاء مساحة عمل. حاول لاحقاً.' },
});

// حماية أشد لمحاولات الدخول (push/pull) لمنع تخمين كلمة السر
const authAttempts = new Map(); // code -> { count, lockedUntil }
function checkAuthLock(code) {
  const st = authAttempts.get(code) || { count: 0, lockedUntil: 0 };
  if (st.lockedUntil > Date.now()) return Math.ceil((st.lockedUntil - Date.now()) / 1000);
  return 0;
}
function registerAuthFail(code) {
  const st = authAttempts.get(code) || { count: 0, lockedUntil: 0 };
  st.count += 1;
  st.lastFailureAt = Date.now();
  if (st.count >= 8) {
    st.lockedUntil = Date.now() + 5 * 60 * 1000; // قفل 5 دقائق بعد 8 محاولات فاشلة
    st.count = 0;
  }
  authAttempts.set(code, st);
}
function registerAuthOk(code) {
  authAttempts.delete(code);
}

/* ---------- توزيع التطبيق: نسخة الويب (للهاتف) + مثبّت ويندوز + صفحة الروابط ---------- */
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------- مانيفست PWA وهوية المدرسة ديناميكيًا لكل مساحة عمل ---------- */
function workspaceForCode(raw) {
  const code = String(raw || '').trim().toUpperCase().slice(0, 16);
  return code && store[code] ? { code, ws: store[code] } : null;
}
function logoBufferFromDataUrl(value) {
  const m = String(value || '').match(/^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+\/\s=]+)$/i);
  if (!m) return null;
  try { return { type: 'image/' + m[1].toLowerCase().replace('jpg', 'jpeg'), buf: Buffer.from(m[2].replace(/\s+/g, ''), 'base64') }; } catch (e) { return null; }
}
app.get(['/manifest.webmanifest', '/app/manifest.webmanifest'], (req, res) => {
  const found = workspaceForCode(req.query.c);
  const ws = found && found.ws;
  const db = ws && ws.db;
  const school = String((db && db.settings && db.settings.school) || (ws && ws.schoolName) || 'ملعبنا').slice(0, 120);
  const iconPath = found ? '/school-assets/' + encodeURIComponent(found.code) + '/logo' : '/app/icon-192.png';
  const v = encodeURIComponent(String((ws && ws.updatedAt) || '1'));
  const manifest = {
    name: school + ' — ملعبنا', short_name: school.slice(0, 32), id: found ? '/app/?c=' + encodeURIComponent(found.code) : '/app/', description: 'نظام تسيير مدرسة كرة القدم', display_override: ['standalone', 'minimal-ui'], orientation: 'portrait-primary', categories: ['education', 'sports', 'productivity'], prefer_related_applications: false, lang: 'ar', dir: 'rtl', start_url: found ? '/app/?c=' + encodeURIComponent(found.code) : '/app/', scope: '/app/', display: 'standalone', background_color: '#0a0a0c', theme_color: '#0a0a0c',
    icons: found
      ? [
        { src: iconPath + '?v=' + v, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: iconPath + '?v=' + v, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]
      : [
        { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
  };
  res.set({'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-store'}).json(manifest);
});
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const packageName = String(process.env.ANDROID_TWA_PACKAGE_NAME || '').trim();
  const fingerprints = String(process.env.ANDROID_TWA_SHA256_CERT_FINGERPRINTS || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const validPackageName = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName);
  const validFingerprints = fingerprints.length > 0 &&
    fingerprints.every((value) => /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value));
  if (!validPackageName || !validFingerprints) return res.status(404).end();
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300, must-revalidate',
  }).json([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints,
    },
  }]);
});
app.get('/school-assets/:code/logo', (req, res) => {
  const found = workspaceForCode(req.params.code);
  const logo = found && found.ws && found.ws.db && found.ws.db.settings && logoBufferFromDataUrl(found.ws.db.settings.logo);
  if (!logo) return res.status(404).end();
  res.set({'Content-Type':logo.type,'Cache-Control':'public, max-age=300, must-revalidate','X-Content-Type-Options':'nosniff'}).send(logo.buf);
});
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
app.use('/app', express.static(path.join(PUBLIC_DIR, 'app'), { index: 'app.html', maxAge: 0 })); // تطبيق الويب (PWA)
app.use('/downloads', express.static(DOWNLOADS_DIR, { index: false, dotfiles: 'deny' })); // ضع Malaabna-Setup.exe هنا
app.get('/install', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'install.html')));

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'malaabna-sync-server (local)', time: new Date().toISOString() });
});

/* إنشاء مساحة عمل جديدة (مرة واحدة لكل مدرسة، من أول جهاز) */
app.post('/api/workspace/create', createLimiter, async (req, res) => {
  try {
    const schoolName = String((req.body && req.body.schoolName) || '').slice(0, 120);
    let code;
    for (let i = 0; i < 5; i++) {
      code = genCode();
      if (!store[code]) break;
      code = null;
    }
    if (!code) return res.status(500).json({ ok: false, message: 'تعذر توليد رمز فريد، حاول مجدداً.' });

    const secret = genSecret();
    const secretHash = await bcrypt.hash(secret, 10);

    store[code] = {
      secretHash,
      schoolName,
      db: null,
      files: null,
      device: '',
      users: [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await saveStore(store);
    maybeBackup(store);

    return res.json({ ok: true, code, secret });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
  }
});

/* التحقق من صلاحية رمز + كلمة سر */
async function authenticate(code, secret, ip) {
  const lockKey = String(code) + '|' + String(ip || '');
  if (!code || !secret) return { ok: false, message: 'الرمز أو كلمة السر ناقصة.' };
  const locked = checkAuthLock(lockKey);
  if (locked > 0) return { ok: false, message: `محاولات كثيرة فاشلة. انتظر ${locked} ثانية.` };

  const ws = store[code];
  if (!ws) {
    registerAuthFail(lockKey);
    return { ok: false, message: 'الرمز أو كلمة السر غير صحيحة.' };
  }
  const match = await bcrypt.compare(secret, ws.secretHash);
  if (!match) {
    registerAuthFail(lockKey);
    return { ok: false, message: 'الرمز أو كلمة السر غير صحيحة.' };
  }
  registerAuthOk(lockKey);
  return { ok: true, code };
}

/* ---------- حسابات مستخدمي الهاتف ---------- */
const MOBILE_ROLES = ['admin', 'member', 'coach', 'accountant', 'reception', 'registrar', 'viewer'];
const mobileSessions = new Map(); // المفتاح: hash الرمز (لا يُخزَّن الرمز نفسه أبداً، لا في الذاكرة ولا على القرص)
(function loadSessions() {
  const now = Date.now(); let n = 0;
  Object.keys(store).forEach((code) => {
    const saved = store[code] && store[code].sessions;
    if (saved && typeof saved === 'object') Object.keys(saved).forEach((h) => {
      const v = saved[h];
      if (v && v.userId && v.expiresAt > now) { mobileSessions.set(h, { code, userId: v.userId, expiresAt: v.expiresAt }); n += 1; }
    });
  });
  if (n) console.log(`🔑 استُرجعت ${n} جلسة هاتف من القرص.`);
})();
// تنظيف أسرار المزامنة التي رفعتها نسخ التطبيق القديمة داخل بيانات المدرسة
(function scrubOldSecrets() {
  let changed = false;
  Object.keys(store).forEach((c) => {
    const st = store[c] && store[c].db && store[c].db.settings;
    if (st) ['syncSecret', 'syncCode', 'serverUrl'].forEach((k) => { if (k in st) { delete st[k]; changed = true; } });
  });
  if (changed) { saveStore(store).then(() => console.log('🧹 حُذفت أسرار مزامنة قديمة من البيانات المخزنة. جدّد كلمة السر (rotate) لإبطال القديمة في النسخ الاحتياطية.')); }
})();


function syncSessionsToStore(st) {
  const now = Date.now(), byCode = {};
  mobileSessions.forEach((v, h) => { if (v.expiresAt > now && st[v.code]) (byCode[v.code] = byCode[v.code] || {})[h] = { userId: v.userId, expiresAt: v.expiresAt }; });
  Object.keys(st).forEach((c) => { if (st[c]) { if (byCode[c]) st[c].sessions = byCode[c]; else delete st[c].sessions; } });
}
function persistSessions() { saveStore(store).catch((e) => console.error('⚠️ تعذر حفظ الجلسات:', e.message)); }
// قفل محاولات الدخول: مرشّح لكل (مدرسة+مستخدم+IP) وآخر أوسع لكل حساب ضد التخمين الموزّع
function makeLock(max, lockMs) {
  const m = new Map();
  return {
    left(k) { const s = m.get(k); return s && s.lockedUntil > Date.now() ? Math.ceil((s.lockedUntil - Date.now()) / 1000) : 0; },
    fail(k) {
      const s = m.get(k) || { count: 0, lockedUntil: 0, last: 0 };
      s.count += 1; s.last = Date.now();
      if (s.count >= max) { s.lockedUntil = Date.now() + lockMs; s.count = 0; }
      m.set(k, s);
    },
    ok(k) { m.delete(k); },
    sweep() { const n = Date.now(); m.forEach((v, k) => { if (v.lockedUntil < n && n - v.last > 60 * 60 * 1000) m.delete(k); }); },
  };
}
const loginLockIp = makeLock(8, 5 * 60 * 1000);
const loginLockAcct = makeLock(25, 15 * 60 * 1000);
// hash وهمي لمقارنة bcrypt حتى عند غياب الحساب، فلا يُكشف وجود اسم المستخدم من زمن الاستجابة
const DUMMY_HASH = bcrypt.hashSync('malaabna-dummy-password', 12);
function revokeUserSessions(code, userId, exceptToken) {
  const keep = exceptToken ? hashToken(exceptToken) : null; let changed = false;
  mobileSessions.forEach((v, k) => { if (v.code === code && v.userId === userId && k !== keep) { mobileSessions.delete(k); changed = true; } });
  if (changed) persistSessions();
}
function revokeWorkspaceSessions(code, exceptToken, persist = true) {
  const keep = exceptToken ? hashToken(exceptToken) : null; let changed = false;
  mobileSessions.forEach((v, k) => {
    if (v.code === code && k !== keep) { mobileSessions.delete(k); changed = true; }
  });
  if (changed && persist) persistSessions();
  return changed;
}
setInterval(() => {
  const now = Date.now();
  mobileSessions.forEach((v, k) => { if (v.expiresAt < now) mobileSessions.delete(k); });
  loginLockIp.sweep(); loginLockAcct.sweep();
  authAttempts.forEach((v, k) => {
    const lastFailureAt = Number(v.lastFailureAt) || 0;
    if (v.lockedUntil < now && (!lastFailureAt || now - lastFailureAt > 60 * 60 * 1000)) authAttempts.delete(k);
  });
}, 10 * 60 * 1000).unref();
const mobileLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { ok: false, message: 'محاولات دخول كثيرة. حاول لاحقاً.' } });
function wsUsers(ws) { if (!Array.isArray(ws.users)) ws.users = []; return ws.users; }
function wsAudit(ws, action, actor, meta) {
  if (!ws.db || typeof ws.db !== 'object') ws.db = {};
  if (!Array.isArray(ws.db.audit)) ws.db.audit = [];
  ws.db.audit.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action: String(action || '').slice(0, 120),
    actor: String(actor || 'system').slice(0, 120),
    meta: meta && typeof meta === 'object' ? JSON.parse(JSON.stringify(meta)) : String(meta || '').slice(0, 500),
  });
  ws.db.audit = ws.db.audit.slice(0, 500);
}
function actorName(auth) { return auth && auth.mobile && auth.user ? (auth.user.name || auth.user.username || auth.user.id) : 'المدير الرئيسي'; }
const USER_STATUSES = ['active', 'pending', 'disabled'];
function userStatus(u) { return USER_STATUSES.includes(u && u.status) ? u.status : 'active'; } // الحسابات القديمة بلا حقل status تُعدّ مفعّلة
function publicMobileUser(u) { return { id: u.id, username: u.username, name: u.name, role: u.role, status: userStatus(u), permissions: Array.isArray(u.permissions) ? u.permissions : [] }; }
function cleanMobileDb(source, user) {
  const db = JSON.parse(JSON.stringify(source || {}));
  db.settings = Object.assign({}, db.settings || {});
  ['syncSecret', 'syncCode', 'serverUrl', 'pinAdmin', 'pinCoach'].forEach((k) => delete db.settings[k]);
  const admin = user && user.role === 'admin';
  const perms = new Set(['dash'].concat((user && user.permissions) || []));
  if (!admin) {
    const pageForCollection = { teams: 'teams', parents: 'parents', coaches: 'coaches', players: 'players', trainings: 'trainings', attendance: 'att', matches: 'matches', evals: 'evals', subs: 'subs', receipts: 'receipts', expenses: 'expenses', salaryAdvances: 'expenses', equip: 'equip', loans: 'loans', injuries: 'injuries', docs: 'docs', cashClosings: 'cashbox' };
    Object.keys(pageForCollection).forEach((c) => { if (!perms.has(pageForCollection[c]) && !perms.has('reports')) db[c] = []; });
    if (!perms.has('sensitive')) {
      (db.parents || []).forEach((x) => ['phone', 'phone2', 'email', 'cin', 'address', 'job', 'att', 'portalCode'].forEach((k) => delete x[k]));
      (db.coaches || []).forEach((x) => ['phone', 'email', 'diploma', 'pin', 'cin', 'address', 'att', 'salary'].forEach((k) => delete x[k]));
      (db.players || []).forEach((x) => ['pphone', 'phone', 'address', 'health', 'att', 'consentSignature'].forEach((k) => delete x[k]));
      (db.receipts || []).forEach((x) => { delete x.phone; });
      (db.expenses || []).forEach((x) => { delete x.att; });
    }
    if (!perms.has('injuries') || !perms.has('sensitive')) db.injuries = [];
    if (!perms.has('reports')) { db.audit = []; db.syncLog = []; }
    db.cashClosings = [];
  }
  return db;
}

// لا نرسل مرفقات الوثائق إلى حساب هاتف إلا إذا كان يملك صلاحية البيانات
// الحساسة والصلاحية الخاصة بالسجل الذي يحتوي على المرفق.
function authorizedFiles(ws, user) {
  const source = ws && ws.db && typeof ws.db === 'object' ? ws.db : {};
  const files = ws && ws.files && typeof ws.files === 'object' && !Array.isArray(ws.files) ? ws.files : {};
  if (!user || user.role === 'admin') return files;

  const permissions = new Set(Array.isArray(user.permissions) ? user.permissions : []);
  if (!permissions.has('sensitive')) return {};
  const allReports = permissions.has('reports');
  const ids = new Set();
  const collect = (collection, permission) => {
    if (!allReports && !permissions.has(permission)) return;
    (Array.isArray(source[collection]) ? source[collection] : []).forEach((record) => {
      (Array.isArray(record && record.att) ? record.att : []).forEach((attachment) => {
        if (attachment && attachment.id) ids.add(String(attachment.id));
      });
    });
  };
  collect('players', 'players');
  collect('parents', 'parents');
  collect('coaches', 'coaches');
  collect('expenses', 'expenses');

  const result = {};
  Object.keys(files).forEach((id) => {
    if (ids.has(id)) result[id] = files[id];
  });
  return result;
}
function sessionFromRequest(req) {
  const raw = String(req.headers.authorization || '');
  const token = raw.replace(/^Bearer\s+/i, '').trim() || String((req.body && req.body.token) || '').trim();
  if (!token) return null;
  const th = hashToken(token);
  const sess = mobileSessions.get(th);
  if (!sess || sess.expiresAt < Date.now()) { if (sess) mobileSessions.delete(th); return null; }
  const ws = store[sess.code];
  const user = ws && ws.users && ws.users.find((x) => x.id === sess.userId);
  if (!user || userStatus(user) !== 'active') { mobileSessions.delete(th); persistSessions(); return null; }
  return { ok: true, code: sess.code, mobile: true, user, token };
}
async function authenticateRequest(req, body) {
  const sess = sessionFromRequest(req);
  if (sess) return sess;
  return authenticate(body && body.code, body && body.secret, req.ip);
}
function authData(ws, auth) {
  const user = auth.mobile ? auth.user : { role: 'admin' };
  return {
    ok: true,
    db: cleanMobileDb(ws.db, user),
    files: authorizedFiles(ws, user),
    updatedAt: ws.updatedAt,
    device: ws.device,
  };
}

app.post('/api/auth/login', mobileLoginLimiter, async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || '').trim().toUpperCase().slice(0, 16);
    const username = String((req.body && req.body.username) || '').trim().toLowerCase().slice(0, 60);
    const password = String((req.body && req.body.password) || '').slice(0, 200);
    const BAD = { ok: false, message: 'رمز المدرسة أو اسم المستخدم أو كلمة السر غير صحيحة.' };
    if (!code || !username || !password) return res.status(401).json(BAD);
    const ipKey = code + '|' + username + '|' + req.ip, acctKey = code + '|' + username;
    const wait = Math.max(loginLockIp.left(ipKey), loginLockAcct.left(acctKey));
    if (wait > 0) return res.status(429).json({ ok: false, message: `محاولات كثيرة فاشلة. انتظر ${wait} ثانية.` });
    const ws = store[code];
    const user = ws ? wsUsers(ws).find((x) => String(x.username || '').toLowerCase() === username) : null;
    const match = await bcrypt.compare(password, (user && user.passwordHash) || DUMMY_HASH);
    if (!user || !user.passwordHash || !match) { loginLockIp.fail(ipKey); loginLockAcct.fail(acctKey); return res.status(401).json(BAD); }
    loginLockIp.ok(ipKey); loginLockAcct.ok(acctKey);
    const st = userStatus(user);
    if (st === 'disabled') return res.status(403).json({ ok: false, message: 'هذا الحساب معطّل. تواصل مع مدير المدرسة.' });
    if (st === 'pending') return res.status(403).json({ ok: false, message: 'حسابك بانتظار موافقة المدير.' });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
    mobileSessions.set(hashToken(token), { code, userId: user.id, expiresAt });
    wsAudit(ws, 'تسجيل دخول', user.name || user.username, { username: user.username, ip: req.ip });
    await saveStore(store);
    return res.json(Object.assign({ token, expiresAt, user: publicMobileUser(user) }, authData(ws, { mobile: true, user })));
  } catch (e) { console.error(e); return res.status(500).json({ ok: false, message: 'خطأ في خادم تسجيل الدخول.' }); }
});
app.post('/api/auth/data', async (req, res) => { const auth = sessionFromRequest(req); if (!auth) return res.status(401).json({ ok: false, message: 'انتهت جلسة الهاتف. سجّل الدخول من جديد.' }); return res.json(authData(store[auth.code], auth)); });
app.post('/api/auth/logout', (req, res) => { const auth = sessionFromRequest(req); if (auth) { mobileSessions.delete(hashToken(auth.token)); persistSessions(); } return res.json({ ok: true }); });
// Only this endpoint stages attendance before disk confirmation. Other routes
// retain their previous behavior; this is not global transactional middleware.
function commitAttendanceRequest(req){
 writeQueue=writeQueue.catch(()=>{}).then(async()=>{
  const auth=sessionFromRequest(req);
  if(!auth){const e=new Error('انتهت جلسة الهاتف. سجّل الدخول من جديد.');e.status=401;e.code='attendance_session_expired';throw e;}
  if(auth.user.role!=='admin'&&!(Array.isArray(auth.user.permissions)&&auth.user.permissions.includes('att'))){const e=new Error('لا تملك صلاحية مزامنة الحضور.');e.status=403;e.code='attendance_forbidden';throw e;}
  const sourceStore=store,current=store[auth.code];
  if(!current.db){const e=new Error('لا توجد قاعدة بيانات بعد.');e.status=400;e.code='attendance_database_missing';throw e;}
  const plan=AttendanceSync.planAttendance(current.db,req.body&&req.body.updates);
  const base=req.body&&req.body.baseUpdatedAt;
  if(typeof base!=='string'||!base){const e=new Error('حدّث التطبيق وسجّل الدخول لجلب مرجع النسخة قبل مزامنة الحضور. احتفظ بتعديلاتك المحلية أولاً.');e.status=428;e.code='attendance_base_required';throw e;}
  const digest=crypto.createHash('sha256').update(JSON.stringify(req.body.updates)).digest('hex');
  const ack=current.attendanceSyncAck;
  const exactRetry=!plan.changed&&ack&&ack.digest===digest&&ack.baseUpdatedAt===base&&ack.updatedAt===current.updatedAt;
  // Only the exact last committed batch may recover its lost response. A stale
  // no-op must not silently advance a device past another device's changes.
  if(base!==current.updatedAt&&!exactRetry){const e=new Error('تغيّرت نسخة الخادم. لم نعتمد حضورك ولم نمسح تعديلاتك المحلية. صدّر نسخة الحضور للمراجعة وراجع النسخة الأحدث مع المدير قبل إعادة الإرسال.');e.status=409;e.code='attendance_version_conflict';throw e;}
  if(!plan.changed)return {updatedAt:current.updatedAt,inserted:0,updated:0,unchanged:plan.unchanged,replayed:!!exactRetry};
  const sourceText=JSON.stringify(sourceStore),draft=JSON.parse(sourceText),ws=draft[auth.code];
  ws.db.attendance=plan.records;
  ws.updatedAt=new Date(Math.max(Date.now(),(Date.parse(current.updatedAt)||0)+1)).toISOString();
  ws.attendanceSyncAck={digest,baseUpdatedAt:base,updatedAt:ws.updatedAt};
  wsAudit(ws,'مزامنة الحضور',actorName(auth),{inserted:plan.inserted,updated:plan.updated});
  await guardedWrite(DB_FILE,encrypt(JSON.stringify(draft,null,2),DATA_KEY),()=>store===sourceStore&&store[auth.code]===current&&JSON.stringify(store)===sourceText,()=>{current.db=ws.db;current.updatedAt=ws.updatedAt;current.attendanceSyncAck=ws.attendanceSyncAck;});
  return {updatedAt:ws.updatedAt,inserted:plan.inserted,updated:plan.updated,unchanged:plan.unchanged};
 });
 return writeQueue;
}
function commitMemberCardDesign(req){
 writeQueue=writeQueue.catch(()=>{}).then(async()=>{
  const auth=sessionFromRequest(req),body=req.body||{};
  if(!auth){const e=new Error('انتهت جلسة الهاتف. سجّل الدخول من جديد.');e.status=401;e.code='card_design_session_expired';throw e;}
  if(!MemberCardDesign.canEdit(auth.user)){const e=new Error('تعديل القالب المشترك للمدير فقط.');e.status=403;e.code='card_design_forbidden';throw e;}
  const sourceStore=store,current=store[auth.code];
  if(!current||!current.db){const e=new Error('لا توجد قاعدة بيانات لهذه المدرسة.');e.status=404;e.code='card_design_database_missing';throw e;}
  const design=MemberCardDesign.normalizeDesign(body.design,current.db.settings&&current.db.settings.memberCardDesign);
  if(!design){const e=new Error('بيانات تصميم البطاقة غير صالحة.');e.status=400;e.code='card_design_invalid';throw e;}
  const base=String(body.baseUpdatedAt||'');
  if(!base){const e=new Error('حدّث التطبيق وسجّل الدخول قبل حفظ القالب.');e.status=428;e.code='card_design_base_required';throw e;}
  if(base!==String(current.updatedAt||'')){const e=new Error('تغيّرت بيانات المدرسة منذ تسجيل دخولك. سجّل الخروج ثم الدخول لجلب النسخة الأحدث قبل حفظ القالب.');e.status=409;e.code='card_design_conflict';throw e;}
  const sourceText=JSON.stringify(sourceStore),draft=JSON.parse(sourceText),ws=draft[auth.code];
  if(!ws.db.settings||typeof ws.db.settings!=='object')ws.db.settings={};
  ws.db.settings.memberCardDesign=design;
  ws.updatedAt=new Date(Math.max(Date.now(),(Date.parse(current.updatedAt)||0)+1)).toISOString();
  wsAudit(ws,'تعديل قالب بطاقة العضوية',actorName(auth),{palette:design.palette});
  await guardedWrite(DB_FILE,encrypt(JSON.stringify(draft,null,2),DATA_KEY),()=>store===sourceStore&&store[auth.code]===current&&JSON.stringify(store)===sourceText,()=>{store=draft;});
  return {updatedAt:ws.updatedAt,design};
 });
 return writeQueue;
}
app.post('/api/auth/card-design',async(req,res)=>{
 try{const result=await commitMemberCardDesign(req);maybeBackup(store);return res.json({ok:true,...result});}
 catch(error){
  console.error('card design:',req.requestId,error.code||error.message);
  const changed=error.code==='STORE_CHANGED';
  return res.status(changed?409:(error.status||500)).json({ok:false,code:changed?'card_design_conflict':(error.code||'card_design_error'),requestId:req.requestId,message:changed?'تغيرت بيانات الخادم أثناء الحفظ. سجّل الخروج ثم الدخول لجلب النسخة الأحدث.':(error.status?error.message:'تعذر حفظ قالب البطاقة على الخادم.')});
 }
});

app.post('/api/auth/attendance',async(req,res)=>{
 try{const result=await commitAttendanceRequest(req);if(result.inserted||result.updated)maybeBackup(store);return res.json({ok:true,...result});}
 catch(error){
  console.error('attendance sync:',req.requestId,error.code||error.message);
  if(error.code==='STORE_CHANGED')return res.status(409).json({ok:false,code:'attendance_version_conflict',requestId:req.requestId,message:'تغيرت بيانات الخادم أثناء الحفظ. لم نعتمد الطلب. احتفظ بتعديلاتك وراجع النسخة الأحدث.'});
  if(['EISDIR','ENOSPC','EACCES','EPERM','EROFS','EIO'].includes(error.code))return res.status(503).json({ok:false,code:'attendance_storage_failed',requestId:req.requestId,message:'تعذر حفظ الحضور على قرص الخادم. بقي السجل السابق معتمداً. عالج مساحة القرص أو الصلاحيات ثم أعد المحاولة.'});
  return res.status(error.status||500).json({ok:false,code:error.status?error.code:'attendance_server_error',requestId:req.requestId,message:error.status?error.message:'تعذر تأكيد حفظ الحضور. احتفظ بالتعديلات المحلية وأعد المحاولة لاحقاً.'});
 }
});

app.post('/api/auth/users/upsert', async (req, res) => {
  try {
    const body = req.body || {}, auth = await authenticateRequest(req, body);
    if (!auth.ok) return res.status(401).json(auth);
    if (auth.mobile && auth.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'هذه العملية متاحة للمدير فقط.' });
    const ws = store[auth.code], username = String(body.username || '').trim().toLowerCase(), name = String(body.name || '').trim().slice(0, 120), password = String(body.password || '');
    const role = MOBILE_ROLES.includes(body.role) ? body.role : 'member';
    const permissions = Array.isArray(body.permissions) ? Array.from(new Set(body.permissions.map((x) => String(x).trim().slice(0, 40)).filter(Boolean))).slice(0, 60) : [];
    if (!/^[a-zA-Z0-9_.\-\u0600-\u06FF]{3,30}$/.test(username) || !name) return res.status(400).json({ ok: false, message: 'بيانات الحساب غير صالحة.' });
    if (password && password.length < 8) return res.status(400).json({ ok: false, message: 'كلمة السر يجب أن تكون 8 أحرف على الأقل.' });
    const users = wsUsers(ws); let user = users.find((x) => String(x.username || '').toLowerCase() === username);
    const isNew = !user;
    if (!user) { if (!password) return res.status(400).json({ ok: false, message: 'أدخل كلمة سر الحساب.' }); user = { id: crypto.randomUUID(), username, createdAt: new Date().toISOString() }; users.push(user); }
    const credsChanged = !isNew && (!!password || user.role !== role);
    user.name = name; user.role = role; user.permissions = role === 'admin' ? [] : permissions;
    let statusChanged = false;
    if (body.status !== undefined) {
      if (!USER_STATUSES.includes(body.status)) return res.status(400).json({ ok: false, message: 'حالة الحساب غير صالحة.' });
      if (auth.mobile && auth.user.id === user.id && body.status !== 'active') return res.status(400).json({ ok: false, message: 'لا يمكنك تعطيل حسابك بنفسك.' });
      statusChanged = userStatus(user) !== body.status; user.status = body.status;
    } else if (isNew) user.status = 'active';
    if (password) user.passwordHash = await bcrypt.hash(password, 12);
    await saveStore(store);
    // تغيير كلمة السر أو الدور يُبطل جلسات هذا الحساب الأخرى (مع إبقاء جلسة من أجرى التعديل)
    if (credsChanged) revokeUserSessions(auth.code, user.id, auth.mobile ? auth.token : undefined);
    if (statusChanged && user.status !== 'active') revokeUserSessions(auth.code, user.id);
    return res.json({ ok: true, user: publicMobileUser(user) });
  } catch (e) { console.error(e); return res.status(500).json({ ok: false, message: 'تعذر حفظ حساب الهاتف.' }); }
});
app.post('/api/auth/users/delete', async (req, res) => {
  const body = req.body || {}, auth = await authenticateRequest(req, body); if (!auth.ok) return res.status(401).json(auth);
  if (auth.mobile && auth.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'هذه العملية متاحة للمدير فقط.' });
  const ws = store[auth.code], id = String(body.id || ''), username = String(body.username || '').trim().toLowerCase(), users = wsUsers(ws), target = users.find((x) => x.id === id || (username && String(x.username || '').toLowerCase() === username));
  if (!target) return res.status(404).json({ ok: false, message: 'الحساب غير موجود.' });
  if (auth.mobile && auth.user.id === target.id) return res.status(400).json({ ok: false, message: 'لا يمكنك حذف الحساب المستخدم حالياً.' });
  const adminCount = users.filter((x) => x.role === 'admin').length;
  if (target.role === 'admin' && adminCount <= 1) return res.status(400).json({ ok: false, message: 'لا يمكن حذف آخر حساب مدير في المدرسة.' });
  users.splice(users.indexOf(target), 1); wsAudit(store[auth.code], 'حذف حساب', actorName(auth), { username: target.username, userId: target.id }); await saveStore(store); revokeUserSessions(auth.code, target.id); return res.json({ ok: true });
});

/* رفع (حفظ) آخر نسخة من بيانات المدرسة */
/* ---------- قائمة حسابات الهاتف + الدعوات بالرابط (للمدير فقط) ---------- */
const INVITE_DEFAULT_HOURS = 48, INVITE_MAX_HOURS = 24 * 7;
const USERNAME_RE = /^[a-zA-Z0-9_.\-\u0600-\u06FF]{3,30}$/;
const inviteLock = makeLock(10, 15 * 60 * 1000); // مفتاحه IP: يكبح تخمين رموز الدعوات
const inviteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { ok: false, message: 'محاولات كثيرة. حاول لاحقاً.' } });
setInterval(() => inviteLock.sweep(), 10 * 60 * 1000).unref();
function wsInvites(ws) { if (!Array.isArray(ws.invites)) ws.invites = []; return ws.invites; }
function inviteState(iv) { return iv.usedAt ? 'used' : iv.revokedAt ? 'revoked' : Date.parse(iv.expiresAt) < Date.now() ? 'expired' : 'pending'; }
function publicInvite(iv, ws) {
  const u = iv.userId ? wsUsers(ws).find((x) => x.id === iv.userId) : null;
  return { id: iv.id, kind: iv.kind, name: iv.name || (u && u.name) || '', username: u ? u.username : '', role: iv.role, permissions: iv.permissions || [], createdAt: iv.createdAt, expiresAt: iv.expiresAt, state: inviteState(iv) };
}
function pruneInvites(ws) { const cut = Date.now() - 7 * 24 * 3600 * 1000; ws.invites = wsInvites(ws).filter((iv) => Date.parse(iv.expiresAt) > cut && (!iv.usedAt || Date.parse(iv.usedAt) > cut)); }
function baseUrl(req) { return (process.env.PUBLIC_URL || (req.protocol + '://' + req.get('host'))).replace(/\/+$/, ''); }
async function adminOnly(req, res) {
  const body = req.body || {}, auth = await authenticateRequest(req, body);
  if (!auth.ok) { res.status(401).json(auth); return null; }
  if (auth.mobile && auth.user.role !== 'admin') { res.status(403).json({ ok: false, message: 'هذه العملية متاحة للمدير فقط.' }); return null; }
  return auth;
}
function findInvite(code, token) {
  const ws = store[String(code || '').trim().toUpperCase().slice(0, 16)];
  if (!ws || !token) return { ws: null, iv: null };
  const h = hashToken(String(token).slice(0, 200));
  const iv = wsInvites(ws).find((x) => x.tokenHash === h);
  return { ws, iv: iv && inviteState(iv) === 'pending' ? iv : null };
}

app.post('/api/auth/users/list', async (req, res) => {
  const auth = await adminOnly(req, res); if (!auth) return;
  return res.json({ ok: true, users: wsUsers(store[auth.code]).map(publicMobileUser) });
});

app.post('/api/auth/invites/create', async (req, res) => {
  try {
    const auth = await adminOnly(req, res); if (!auth) return;
    const body = req.body || {}, ws = store[auth.code];
    const kind = body.kind === 'reset' ? 'reset' : 'join';
    const hours = Math.min(INVITE_MAX_HOURS, Math.max(1, Number(body.hours) || INVITE_DEFAULT_HOURS));
    const iv = { id: crypto.randomUUID(), kind, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString(), createdBy: auth.mobile ? auth.user.id : 'desktop' };
    if (kind === 'reset') {
      const target = wsUsers(ws).find((x) => x.id === String(body.userId || ''));
      if (!target) return res.status(404).json({ ok: false, message: 'الحساب غير موجود.' });
      iv.userId = target.id; iv.name = target.name; iv.role = target.role;
    } else {
      const name = String(body.name || '').trim().slice(0, 120);
      if (!name) return res.status(400).json({ ok: false, message: 'أدخل اسم المدعو.' });
      iv.name = name; iv.role = MOBILE_ROLES.includes(body.role) ? body.role : 'member';
      iv.permissions = iv.role === 'admin' ? [] : (Array.isArray(body.permissions) ? Array.from(new Set(body.permissions.map((x) => String(x).trim().slice(0, 40)).filter(Boolean))).slice(0, 60) : []);
    }
    const token = crypto.randomBytes(32).toString('base64url');
    iv.tokenHash = hashToken(token);
    pruneInvites(ws); wsInvites(ws).push(iv);
    wsAudit(ws, kind === 'reset' ? 'إنشاء رابط إعادة تعيين' : 'إنشاء دعوة مستخدم', actorName(auth), { kind, name: iv.name, role: iv.role, expiresAt: iv.expiresAt });
    await saveStore(store);
    // الرمز في الجزء بعد # فلا يصل إلى سجلات الخادم ولا إلى Cloudflare
    const url = baseUrl(req) + '/join#c=' + encodeURIComponent(auth.code) + '&t=' + token;
    return res.json({ ok: true, url, invite: publicInvite(iv, ws) });
  } catch (e) { console.error(e); return res.status(500).json({ ok: false, message: 'تعذر إنشاء الدعوة.' }); }
});

app.post('/api/auth/invites/list', async (req, res) => {
  const auth = await adminOnly(req, res); if (!auth) return;
  const ws = store[auth.code];
  return res.json({ ok: true, invites: wsInvites(ws).filter((iv) => inviteState(iv) === 'pending').map((iv) => publicInvite(iv, ws)) });
});

app.post('/api/auth/invites/revoke', async (req, res) => {
  const auth = await adminOnly(req, res); if (!auth) return;
  const iv = wsInvites(store[auth.code]).find((x) => x.id === String((req.body || {}).id || ''));
  if (!iv) return res.status(404).json({ ok: false, message: 'الدعوة غير موجودة.' });
  if (!iv.usedAt && !iv.revokedAt) iv.revokedAt = new Date().toISOString();
  wsAudit(store[auth.code], 'إلغاء دعوة', actorName(auth), { inviteId: iv.id });
  await saveStore(store); return res.json({ ok: true });
});

const INVITE_BAD = { ok: false, message: 'رابط الدعوة غير صالح أو منتهي أو مستعمل. اطلب رابطاً جديداً من المدير.' };
app.post('/api/auth/invites/info', inviteLimiter, (req, res) => {
  const b = req.body || {}, wait = inviteLock.left(req.ip);
  if (wait > 0) return res.status(429).json({ ok: false, message: `محاولات كثيرة. انتظر ${wait} ثانية.` });
  const { ws, iv } = findInvite(b.code, b.token);
  if (!iv) { inviteLock.fail(req.ip); return res.status(404).json(INVITE_BAD); }
  const pi = publicInvite(iv, ws);
  return res.json({ ok: true, kind: pi.kind, name: pi.name, username: pi.username, schoolName: ws.schoolName || '', expiresAt: pi.expiresAt });
});

app.post('/api/auth/invites/redeem', inviteLimiter, async (req, res) => {
  try {
    const b = req.body || {}, wait = inviteLock.left(req.ip);
    if (wait > 0) return res.status(429).json({ ok: false, message: `محاولات كثيرة. انتظر ${wait} ثانية.` });
    let f = findInvite(b.code, b.token);
    if (!f.iv) { inviteLock.fail(req.ip); return res.status(404).json(INVITE_BAD); }
    const password = String(b.password || '').slice(0, 200);
    if (password.length < 8) return res.status(400).json({ ok: false, message: 'كلمة السر يجب أن تكون 8 أحرف على الأقل.' });
    const code = String(b.code).trim().toUpperCase().slice(0, 16);
    let username = '';
    if (f.iv.kind === 'join') {
      username = String(b.username || '').trim().toLowerCase();
      if (!USERNAME_RE.test(username)) return res.status(400).json({ ok: false, message: 'اسم المستخدم: 3 إلى 30 خانة (أحرف أو أرقام أو . _ -).' });
      if (wsUsers(f.ws).some((x) => String(x.username || '').toLowerCase() === username)) return res.status(409).json({ ok: false, message: 'اسم المستخدم مستعمل. اختر اسماً آخر.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // بعد الانتظار نعيد التحقق ثم نستهلك الدعوة في كتلة متزامنة واحدة، فلا تُستعمل مرتين
    f = findInvite(b.code, b.token);
    if (!f.iv) return res.status(404).json(INVITE_BAD);
    const { ws, iv } = f; let user;
    if (iv.kind === 'reset') {
      user = wsUsers(ws).find((x) => x.id === iv.userId);
      if (!user) return res.status(404).json(INVITE_BAD);
      username = user.username; user.passwordHash = passwordHash;
    } else {
      if (wsUsers(ws).some((x) => String(x.username || '').toLowerCase() === username)) return res.status(409).json({ ok: false, message: 'اسم المستخدم مستعمل. اختر اسماً آخر.' });
      user = { id: crypto.randomUUID(), username, name: iv.name, role: iv.role, permissions: iv.permissions || [], status: 'active', passwordHash, createdAt: new Date().toISOString(), invitedVia: iv.id };
      wsUsers(ws).push(user);
    }
    iv.usedAt = new Date().toISOString();
    wsAudit(ws, iv.kind === 'reset' ? 'إعادة تعيين كلمة السر' : 'تفعيل حساب من دعوة', username, { userId: user.id, kind: iv.kind });
    if (iv.kind === 'reset') revokeUserSessions(code, user.id);
    await saveStore(store);
    return res.json({ ok: true, kind: iv.kind, username, code, schoolName: ws.schoolName || '' });
  } catch (e) { console.error(e); return res.status(500).json({ ok: false, message: 'تعذر إتمام الدعوة.' }); }
});

app.get('/join', (_req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(PUBLIC_DIR, 'join.html')); });
app.get('/join.js', (_req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(PUBLIC_DIR, 'join.js')); });

// Only workspace uploads use this staged commit. Existing account/invite routes
// retain their APIs; no global route wrapper or response interception is used.
function commitWorkspaceUpload(auth,{db,files,cleanFiles,device,baseUpdatedAt,force}){
 writeQueue=writeQueue.catch(()=>{}).then(async()=>{
  const sourceStore=store,sourceText=JSON.stringify(sourceStore),current=sourceStore[auth.code];
  if(!force&&current.db&&current.updatedAt!==baseUpdatedAt){const error=new Error('نسخة أحدث على الخادم. اجلب آخر نسخة أولاً.');error.status=409;error.code='workspace_version_conflict';throw error;}
  const history=validateReceiptHistory(db,current.db);
  if(!history.ok){const error=new Error(history.message);error.status=409;error.code=history.code;throw error;}
  const draft=JSON.parse(sourceText),ws=draft[auth.code];
  ws.db=db;ws.files=files===undefined||files===null?(current.files||null):cleanFiles;
  ws.device=String(device||'').slice(0,80);
  ws.updatedAt=new Date(Math.max(Date.now(),(Date.parse(current.updatedAt)||0)+1)).toISOString();
  ReceiptVerification.rememberCorrections(ws,db.receipts);
  wsAudit(ws,'رفع نسخة بيانات',actorName(auth),{device:ws.device});
  await guardedWrite(DB_FILE,encrypt(JSON.stringify(draft,null,2),DATA_KEY),()=>store===sourceStore&&store[auth.code]===current&&JSON.stringify(store)===sourceText,()=>{
   // Keep unrelated account/session object references intact.
   for(const key of ['db','files','device','updatedAt','receiptVerification'])if(key in ws)current[key]=ws[key];
  });
  return {updatedAt:ws.updatedAt};
 });
 return writeQueue;
}

app.put('/api/workspace/push', async (req, res) => {
  let auth;
  try {
    const { code, secret, db, files, device, baseUpdatedAt, force } = req.body || {};
    auth = await authenticateRequest(req, req.body || {});
    if (!auth.ok) return res.status(401).json(auth);
    if (auth.mobile && auth.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'حساب الهاتف للقراءة فقط. يملك المدير وحده صلاحية رفع نسخة البيانات.' });

    // منع مسح نسخة السحابة ببيانات فارغة أو غير صالحة
    const dbCheck = validateDbPayload(db);
    if (!dbCheck.ok) return res.status(dbCheck.code === 'receipt_correction_conflict' ? 409 : 400).json(dbCheck);
    const cleanFiles = sanitizeFilesPayload(files);
    if (files !== undefined && files !== null && cleanFiles === undefined) {
      return res.status(400).json({ ok: false, message: 'مرفقات غير صالحة أو أكبر من الحد المسموح.' });
    }
    // كشف التعارض: إن كانت نسخة الخادم أحدث مما بنى عليه هذا الجهاز، نرفض بدل الكتابة فوقها
    const current = store[auth.code];
    if (!force && current.db && current.updatedAt !== baseUpdatedAt) {
      return res.status(409).json({
        ok: false,
        conflict: true,
        message: 'نسخة أحدث على الخادم. اجلب آخر نسخة أولاً.',
        updatedAt: current.updatedAt,
        device: current.device,
      });
    }

    const receiptHistoryCheck = validateReceiptHistory(db, current.db);
    if (!receiptHistoryCheck.ok) return res.status(409).json(receiptHistoryCheck);

    if (db.settings && typeof db.settings === 'object') { ['syncSecret', 'syncCode', 'serverUrl', '_localSyncAck', '_receiptVerifications'].forEach((k) => delete db.settings[k]); }
    const committed=await commitWorkspaceUpload(auth,{db,files,cleanFiles,device,baseUpdatedAt,force});
    maybeBackup(store);
    return res.json({ok:true,updatedAt:committed.updatedAt});
  } catch (e) {
    console.error(e);
    if(e.status===409||e.code==='STORE_CHANGED')return res.status(409).json({ok:false,code:e.code,conflict:true,message:e.message,updatedAt:auth&&store[auth.code]&&store[auth.code].updatedAt});
    if(['EISDIR','ENOSPC','EACCES','EPERM','EROFS','EIO'].includes(e.code))return res.status(503).json({ok:false,code:'storage_commit_failed',requestId:req.requestId,message:'لم يُؤكد حفظ الرفع؛ بقيت نسخة الخادم السابقة معتمدة. تحقق من مساحة القرص وصلاحيات مجلد البيانات ثم أعد المحاولة.'});
    if (e && e.type === 'entity.too.large') {
      return res.status(413).json({ ok: false, message: 'حجم البيانات كبير جداً.' });
    }
    return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
  }
});

/* جلب آخر نسخة محفوظة */
app.post('/api/workspace/pull', async (req, res) => {
  try {
    const { code, secret } = req.body || {};
    const auth = await authenticateRequest(req, req.body || {});
    if (!auth.ok) return res.status(401).json(auth);

    const ws = store[auth.code];
    return res.json(authData(ws, auth));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
  }
});

/* تغيير الكلمة السرية (يتطلب معرفة الكلمة القديمة) — مفيد إن تسرّبت */
app.post('/api/workspace/rotate-secret', async (req, res) => {
  try {
    const { code, secret } = req.body || {};
    const auth = await authenticateRequest(req, req.body || {});
    if (!auth.ok) return res.status(401).json(auth);
    if (auth.mobile && auth.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'هذه العملية متاحة للمدير فقط.' });

    const newSecret = genSecret();
    store[auth.code].secretHash = await bcrypt.hash(newSecret, 10);
    // تدوير سر المساحة يجب أن يبطل جلسات الهاتف القديمة أيضاً.
    // إن كان الطلب من مدير هاتف، نُبقي جلسته الحالية حتى يستطيع متابعة العمل.
    revokeWorkspaceSessions(auth.code, auth.mobile ? auth.token : undefined, false);
    await saveStore(store);

    return res.json({ ok: true, secret: newSecret });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
  }
});


/* ---------- واتساب تلقائي عبر WhatsApp Cloud API (اختياري) ---------- */
const WA_TOKEN = process.env.WA_TOKEN || '';
const WA_PHONE_ID = process.env.WA_PHONE_ID || '';
/* ---------- النسخ الاحتياطي والاسترجاع على الخادم ---------- */
function backupFiles(){return backups.files();}
function backupNow(){return backups.create().file;}
async function adminBackupAuth(req,res){
 const auth=await authenticateRequest(req,req.body||{});
 if(!auth.ok){res.status(401).json(auth);return null;}
 if(auth.mobile&&auth.user.role!=='admin'){res.status(403).json({ok:false,message:'هذه العملية متاحة للمدير فقط.'});return null;}
 return auth;
}
function backupFailure(req,res,e){
 const code=/^(backup_|restore_)/.test(e&&e.code||'')?e.code:'backup_operation_failed';
 return res.status(e&&e.code==='STORE_CHANGED'?409:503).json({ok:false,code,requestId:req.requestId,message:'لم تكتمل العملية. لم يُعتمد الاسترجاع؛ راجع حالة النظام ومرجع الطلب.'});
}
app.post('/api/admin/system/status',async(req,res)=>{
 try{const auth=await adminBackupAuth(req,res);if(!auth)return;res.set('Cache-Control','no-store');
  const state=backups.status();let availableBytes=null;try{const st=fs.statfsSync(DATA_DIR);availableBytes=Number(st.bavail)*Number(st.bsize);}catch(_){}
  res.json({ok:true,version:require('./package.json').version,checkedAt:new Date().toISOString(),...state,storage:{...state.storage,availableBytes},writeGuarantee:'staged-push-attendance-restore-only'});
 }catch(e){backupFailure(req,res,e);}
});
app.post('/api/admin/backups',async(req,res)=>{
 try{const auth=await adminBackupAuth(req,res);if(!auth)return;await writeQueue.catch(()=>{});
  if(!await adminBackupAuth(req,res))return;
  const created=backups.create();res.json({ok:true,...created,backups:backupFiles().slice(0,MAX_BACKUPS)});
 }catch(e){backupFailure(req,res,e);}
});
app.post('/api/admin/backups/list',async(req,res)=>{
 try{const auth=await adminBackupAuth(req,res);if(!auth)return;res.set('Cache-Control','no-store');res.json({ok:true,backups:backupFiles().slice(0,MAX_BACKUPS)});}catch(e){backupFailure(req,res,e);}
});
app.post('/api/admin/backups/verify',async(req,res)=>{
 try{const auth=await adminBackupAuth(req,res);if(!auth)return;const verified=backups.read(String(req.body.file||''),auth.code);
  res.set('Cache-Control','no-store');res.json({ok:true,file:verified.file,sha256:verified.sha256,tracked:verified.tracked,updatedAt:store[auth.code].updatedAt||'',checks:['checksum-if-tracked','decrypt','schema','workspace']});
 }catch(e){backupFailure(req,res,e);}
});
let manualDrillBusy=false;
app.post('/api/admin/backups/drill',async(req,res)=>{
 try{const auth=await adminBackupAuth(req,res);if(!auth)return;
  if(manualDrillBusy||backupMaintenanceBusy)return res.status(429).json({ok:false,code:'restore_drill_busy',message:'اختبار الاستعادة قيد التشغيل؛ انتظر نتيجته.'});
  manualDrillBusy=true;try{const result=await backups.drill(String(req.body.file||''),auth.code);res.json({ok:true,...result});}finally{manualDrillBusy=false;}
 }catch(e){backupFailure(req,res,e);}
});
app.post('/api/admin/backups/restore',async(req,res)=>{
 try{
  const auth=await adminBackupAuth(req,res);if(!auth)return;
  const {file,sha256,baseUpdatedAt,confirmation}=req.body||{};
  if(confirmation!=='RESTORE'||typeof sha256!=='string'||typeof baseUpdatedAt!=='string')return res.status(428).json({ok:false,code:'restore_confirmation_required',message:'افحص النسخة ثم أكد الاسترجاع مع بصمتها وإصدار الخادم الحالي.'});
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{
   // This endpoint, like push/attendance, stages disk changes before publication.
   const again=await authenticateRequest(req,req.body||{});
   if(!again.ok||(again.mobile&&again.user.role!=='admin')){const e=new Error();e.code='restore_permission_changed';throw e;}
   const sourceStore=store,current=store[auth.code],sourceText=JSON.stringify(store);
   if((current.updatedAt||'')!==baseUpdatedAt){const e=new Error();e.code='STORE_CHANGED';throw e;}
   const checked=backups.read(String(file||''),auth.code);
   if(checked.sha256!==sha256){const e=new Error();e.code='backup_checksum_failed';throw e;}
   const safetyFile=backupNow(),draft=JSON.parse(sourceText),ws=draft[auth.code],target=checked.data[auth.code];
   // Restore school data/files, NOT old credentials, users, sessions or QR revocations.
   ws.db=target.db;ws.files=target.files||null;delete ws.attendanceSyncAck;
   if(ws.db.settings)for(const k of ['syncSecret','syncCode','serverUrl','_localSyncAck','_receiptVerifications'])delete ws.db.settings[k];
   ws.updatedAt=new Date(Math.max(Date.now(),(Date.parse(current.updatedAt)||0)+1)).toISOString();
   const keep=auth.mobile?hashToken(auth.token):null;
   ws.sessions=Object.fromEntries(Object.entries(current.sessions||{}).filter(([h])=>h===keep));
   wsAudit(ws,'استرجاع بيانات من نسخة مفحوصة',actorName(auth),{file,safetyFile});
   await guardedWrite(DB_FILE,encrypt(JSON.stringify(draft,null,2),DATA_KEY),()=>store===sourceStore&&store[auth.code]===current&&JSON.stringify(store)===sourceText,()=>{
    for(const k of ['db','files','updatedAt','sessions'])current[k]=ws[k];delete current.attendanceSyncAck;
    mobileSessions.forEach((v,h)=>{if(v.code===auth.code&&h!==keep)mobileSessions.delete(h);});
   });
   return {ok:true,updatedAt:ws.updatedAt,safetyFile,scope:'school-data-and-files'};
  });
  res.json(await writeQueue);
 }catch(e){backupFailure(req,res,e);}
});

const WA_API_VERSION = process.env.WA_API_VERSION || 'v21.0';
const WA_TPL_LANG = process.env.WA_TPL_LANG || 'ar';
const WA_DAILY_CAP = Number(process.env.WA_DAILY_CAP || 300); // سقف رسائل يومي لكل مساحة عمل (حماية من التكلفة/الإساءة)
// قوالب معتمدة من Meta لكل نوع رسالة، بالصيغة: اسم_القالب:عدد_المتغيرات  مثال: malaabna_arrival:5
function parseTpl(v) {
  if (!v) return null;
  const [name, n] = String(v).split(':');
  return name ? { name: name.trim(), count: Math.max(0, parseInt(n, 10) || 0) } : null;
}
const WA_TEMPLATES = {
  arrival: parseTpl(process.env.WA_TPL_ARRIVAL),
  absence: parseTpl(process.env.WA_TPL_ABSENCE),
  thanks: parseTpl(process.env.WA_TPL_THANKS),
};
const waCounters = new Map(); // code -> { day, n }
function waCap(code) {
  const day = new Date().toISOString().slice(0, 10);
  const c = waCounters.get(code);
  if (!c || c.day !== day) { waCounters.set(code, { day, n: 0 }); return 0; }
  return c.n;
}
const waLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'عدد كبير من طلبات الإرسال. حاول لاحقاً.' },
});

/* Receipt verification is server-owned, never accepted from a workspace upload. */
const ReceiptVerification = require('./receipt-verification');
const MemberVerification = require('./member-verification');
const receiptVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
let receiptVerificationWrites = Promise.resolve();
function receiptVerificationWrite(task) {
  const result = receiptVerificationWrites.catch(() => {}).then(task);
  receiptVerificationWrites = result; return result;
}
app.get('/verify.css', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'verify.css')));
app.get('/verify/r/:token', receiptVerifyLimiter, async (req, res) => {
  await receiptVerificationWrites.catch(() => {});
  const result = ReceiptVerification.lookup(store, req.params.token);
  res.set({ 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
  return res.status(result ? 200 : 404).type('html').send(ReceiptVerification.page(result, new Date().toISOString()));
});
/* Member-card verification: public lookup by membership number + player id only,
   minimum display fields, rate-limited like receipt verification. No insurance data. */
const memberVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
app.get('/api/members/verify', memberVerifyLimiter, (req, res) => {
  res.set({ 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
  const result = MemberVerification.lookup(store, req.query.memberId, req.query.playerId);
  if (!result) return res.status(404).json({ ok: false, message: 'لا يوجد لاعب مطابق لهذه البطاقة على الخادم.' });
  return res.json({ ok: true, ...result });
});
app.post('/api/receipts/verification', receiptVerifyLimiter, async (req, res) => {
  try {
    const auth = await authenticateRequest(req, req.body || {});
    if (!auth.ok) return res.status(401).json(auth);
    if (auth.mobile && auth.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'اعتماد الوصولات وإلغاء التحقق متاحان للمدير فقط.' });
    const { receiptId, fingerprint, action } = req.body || {};
    if (typeof receiptId !== 'string' || !receiptId || receiptId.length > 160 || !['publish', 'revoke'].includes(action)) return res.status(400).json({ ok: false, message: 'طلب تحقق غير صالح.' });
    const response = await receiptVerificationWrite(async () => {
      const ws = store[auth.code];
      if (action === 'revoke') {
        const previous = ws.receiptVerification, registry = previous && structuredClone(previous);
        const matches = registry && Object.values(registry.entries).filter(entry => entry.receiptId === receiptId);
        if (!matches?.length) return { status: 404, body: { ok: false, message: 'لا يوجد رابط تحقق منشور لهذا الوصل.' } };
        for (const entry of matches) if (!entry.revokedAt) entry.revokedAt = new Date().toISOString();
        registry.audit = [{ action: 'revoke', receiptId, at: new Date().toISOString(), actor: actorName(auth) }, ...(registry.audit || [])].slice(0, 500);
        ws.receiptVerification = registry;
        try { await saveStore(store); } catch (error) { ws.receiptVerification = previous; throw error; }
        return { status: 200, body: { ok: true, revoked: true } };
      }
      const origin = ReceiptVerification.publicOrigin(process.env);
      if (!origin) return { status: 503, body: { ok: false, message: 'اضبط PUBLIC_URL بعنوان HTTPS العام الصحيح قبل نشر تحقق الوصولات.' } };
      const receipt = ws.db?.receipts?.find(doc => doc.id === receiptId);
      if (!receipt || !receipt.rec || !receipt.issuedAt || !Number.isFinite(Number(receipt.paid))) return { status: 409, body: { ok: false, message: 'الوصل غير متاح على الخادم. زامن البيانات أولاً ثم أعد المحاولة.' } };
      if (!/^[a-f0-9]{64}$/.test(String(fingerprint || '')) || ReceiptVerification.digest(receipt) !== fingerprint) return { status: 409, body: { ok: false, message: 'نسخة الخادم لا تطابق هذا الوصل. زامن البيانات وراجع التعارضات أولاً.' } };
      if (ws.db.receipts.some(doc => doc.correction?.sourceId === receiptId)) return { status: 409, body: { ok: false, message: 'توجد نسخة مصححة؛ انشر التحقق للنسخة الأحدث بدلاً من الأصل.' } };
      const previous = ws.receiptVerification, published = ReceiptVerification.publish(ws, receipt);
      published.registry.audit = [{ action: 'publish', receiptId, at: new Date().toISOString(), actor: actorName(auth) }, ...(published.registry.audit || [])].slice(0, 500);
      ws.receiptVerification = published.registry;
      try { await saveStore(store); } catch (error) { ws.receiptVerification = previous; throw error; }
      return { status: 200, body: { ok: true, url: origin + '/verify/r/' + published.token, fingerprint: published.entry.fingerprint, publishedAt: published.entry.publishedAt } };
    });
    return res.status(response.status).json(response.body);
  } catch (error) {
    console.error('Receipt verification:', error.message);
    return res.status(error.status || 500).json({ ok: false, message: error.status ? error.message : 'تعذر حفظ حالة التحقق على الخادم؛ أعد المحاولة.' });
  }
});

app.post('/api/whatsapp/status', async (req, res) => {
  try {
    const { code, secret } = req.body || {};
    const auth = await authenticateRequest(req, req.body || {});
    if (!auth.ok) return res.status(401).json(auth);
    if (auth.mobile && auth.user.role !== 'admin' && !(Array.isArray(auth.user.permissions) && auth.user.permissions.includes('wa'))) return res.status(403).json({ ok: false, message: 'لا تملك صلاحية واتساب.' });
    return res.json({
      ok: true,
      configured: !!(WA_TOKEN && WA_PHONE_ID),
      templates: Object.keys(WA_TEMPLATES).filter((k) => WA_TEMPLATES[k]),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
  }
});

app.post('/api/whatsapp/send', waLimiter, async (req, res) => {
  try {
    const { code, secret, to, kind, text, params } = req.body || {};
    const auth = await authenticateRequest(req, req.body || {});
    if (!auth.ok) return res.status(401).json(auth);
    if (auth.mobile && auth.user.role !== 'admin' && !(Array.isArray(auth.user.permissions) && auth.user.permissions.includes('wa'))) return res.status(403).json({ ok: false, message: 'لا تملك صلاحية واتساب.' });
    if (!WA_TOKEN || !WA_PHONE_ID) {
      return res.status(503).json({ ok: false, message: 'واتساب غير مهيّأ على الخادم (WA_TOKEN / WA_PHONE_ID).' });
    }
    const phone = String(to || '').replace(/\D/g, '');
    if (phone.length < 8 || phone.length > 15) return res.status(400).json({ ok: false, message: 'رقم الهاتف غير صالح.' });
    if (waCap(auth.code) >= WA_DAILY_CAP) return res.status(429).json({ ok: false, message: 'بلغتم السقف اليومي للرسائل.' });

    const tpl = WA_TEMPLATES[String(kind)] || null;
    let payload;
    if (tpl) {
      const vals = (Array.isArray(params) ? params : []).slice(0, tpl.count);
      while (vals.length < tpl.count) vals.push('-');
      const clean = (v) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/ {5,}/g, '    ').slice(0, 200) || '-';
      payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: tpl.name,
          language: { code: WA_TPL_LANG },
          components: tpl.count ? [{ type: 'body', parameters: vals.map((v) => ({ type: 'text', text: clean(v) })) }] : [],
        },
      };
    } else {
      const body = String(text || '').slice(0, 4000);
      if (!body) return res.status(400).json({ ok: false, message: 'نص الرسالة فارغ.' });
      // ملاحظة: النص الحر لا يُقبل من Meta إلا خلال 24 ساعة من آخر رد لولي الأمر؛ للإشعارات الابتدائية استعمل القوالب.
      payload = { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body, preview_url: false } };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let r, j;
    try {
      r = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${encodeURIComponent(WA_PHONE_ID)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      j = await r.json().catch(() => null);
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || `HTTP ${r.status}`;
      console.error('WhatsApp API error:', r.status, msg);
      return res.status(502).json({ ok: false, message: 'رفضت Meta الرسالة: ' + msg });
    }
    const st = waCounters.get(auth.code) || { day: new Date().toISOString().slice(0, 10), n: 0 };
    st.n += 1;
    waCounters.set(auth.code, st);
    return res.json({ ok: true, id: j && j.messages && j.messages[0] && j.messages[0].id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: e.name === 'AbortError' ? 'انتهت مهلة الاتصال بـ Meta.' : 'خطأ في الخادم.' });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, message: 'غير موجود.' }));

// معالج أخطاء عام (يلتقط أخطاء تحليل الطلب، مثل تجاوز الحجم المسموح، قبل وصولها للمسارات)
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, message: 'حجم البيانات كبير جداً.' });
  }
  console.error(err);
  return res.status(500).json({ ok: false, message: 'خطأ في الخادم.' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 خادم المزامنة المحلي يعمل على المنفذ ${PORT}`);
  console.log(`   افتح http://localhost:${PORT} للتأكد من عمله.`);
  console.log(`   البيانات محفوظة في: ${DB_FILE}`);
});

function shutdown(signal) {
  console.log(`🛑 إيقاف الخادم (${signal})…`);
  server.close(() => {
    writeQueue.then(() => process.exit(0)).catch(() => process.exit(1));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

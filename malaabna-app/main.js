const { app, BrowserWindow, ipcMain, Menu, safeStorage, shell, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const crypto = require('crypto');

const USERS_FILE = () => path.join(app.getPath('userData'), 'users.json');
const SESSION_FILE = () => path.join(app.getPath('userData'), 'session.json');
const ATTEMPTS_FILE = () => path.join(app.getPath('userData'), 'attempts.json');
const GEMINI_FILE = () => path.join(app.getPath('userData'), 'gemini-secret.json');
const REMEMBER_MS = 1000 * 60 * 60 * 24 * 30; // 30 يوماً
const MIN_PASSWORD_LEN = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 60 * 1000; // دقيقة واحدة بعد تجاوز عدد المحاولات

let win = null;
let currentUser = null;
const ROLES = ['admin', 'member', 'coach', 'accountant', 'reception', 'registrar', 'viewer'];
const MAX_PERMISSIONS = 60;

function sanitizePermissions(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  list.forEach((p) => {
    const s = String(p || '').trim().slice(0, 40);
    if (s) seen.add(s);
  });
  return Array.from(seen).slice(0, MAX_PERMISSIONS);
}

// عدّاد محاولات الدخول الفاشلة في الذاكرة فقط (يُصفَّر عند إعادة تشغيل التطبيق)
const loginAttempts = new Map(); // username(lowercase) -> { count, lockedUntil } — تُحفظ على القرص فلا تُصفَّر بإعادة التشغيل
function loadAttempts() {
  const raw = readJSON(ATTEMPTS_FILE(), {});
  Object.keys(raw || {}).forEach((k) => {
    const v = raw[k];
    if (v && (v.lockedUntil > Date.now() || v.count > 0)) loginAttempts.set(k, v);
  });
}
function persistAttempts() {
  const obj = {};
  loginAttempts.forEach((v, k) => {
    if (v.lockedUntil > Date.now() || v.count > 0) obj[k] = v;
  });
  try { writeJSON(ATTEMPTS_FILE(), obj); } catch (e) {}
}

/* ---------- تخزين بسيط بملفات JSON محلية ---------- */
function canEncrypt() {
  try { return safeStorage.isEncryptionAvailable(); } catch (e) { return false; }
}
function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw) return fallback;
    let parsed = JSON.parse(raw);
    // ملف مشفّر بمفتاح نظام التشغيل (DPAPI على ويندوز) — لا يُفك إلا لنفس مستخدم ويندوز على نفس الجهاز
    if (parsed && parsed.__enc === 1 && typeof parsed.data === 'string') {
      parsed = JSON.parse(safeStorage.decryptString(Buffer.from(parsed.data, 'base64')));
    }
    return parsed;
  } catch (e) {
    console.error('تعذرت قراءة الملف', file, e);
    // نحتفظ بنسخة من الملف التالف بدل أن يُكتب فوقه بقاعدة فارغة
    try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()); } catch (e2) {}
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // كتابة ذرّية: ملف مؤقت ثم إعادة تسمية، فلا يتلف الملف إن انقطع التيار أثناء الحفظ
  const tmp = file + '.tmp';
  if (!canEncrypt()) throw new Error('التخزين الآمن لنظام التشغيل غير متاح؛ لن تُحفظ بيانات الحسابات دون تشفير.');
  const enc = safeStorage.encryptString(JSON.stringify(data)).toString('base64');
  const out = JSON.stringify({ __enc: 1, data: enc });
  fs.writeFileSync(tmp, out, 'utf8');
  fs.renameSync(tmp, file);
}

function loadUsersDB() {
  const db = readJSON(USERS_FILE(), { users: [] });
  // توافق مع نسخة قديمة كانت تخزّن رمز "تذكرني" كنص صريح: نحوّله إلى hash تلقائياً
  let migrated = false;
  (db.users || []).forEach((u) => {
    if (u.rememberToken !== undefined) {
      u.rememberTokenHash = u.rememberToken ? hashToken(u.rememberToken) : null;
      delete u.rememberToken;
      migrated = true;
    }
    // توافق مع حسابات أُنشئت قبل نظام الأدوار الثلاثية (مدير/عضو/مدرب) والصلاحيات الدقيقة
    if (!ROLES.includes(u.role)) {
      u.role = u.role === 'admin' ? 'admin' : 'member';
      migrated = true;
    }
    if (!Array.isArray(u.permissions)) {
      u.permissions = [];
      migrated = true;
    }
  });
  if (migrated) saveUsersDB(db);
  return db;
}
function saveUsersDB(db) {
  writeJSON(USERS_FILE(), db);
}
function loadSession() {
  return readJSON(SESSION_FILE(), null);
}
function encryptExistingFiles() {
  if (!canEncrypt()) return;
  [USERS_FILE(), SESSION_FILE(), ATTEMPTS_FILE()].forEach((f) => {
    try {
      if (!fs.existsSync(f)) return;
      const parsed = JSON.parse(fs.readFileSync(f, 'utf8') || 'null');
      if (parsed && parsed.__enc !== 1) writeJSON(f, parsed); // ترقية الملفات القديمة النصية إلى مشفّرة
    } catch (e) {}
  });
}
function saveSession(session) {
  writeJSON(SESSION_FILE(), session);
}
function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE())) fs.unlinkSync(SESSION_FILE());
  } catch (e) {}
}

/* ---------- كلمات السر ---------- */
function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function verifyPassword(password, salt, expectedHash) {
  const hash = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------- رمز "تذكرني" — يُخزَّن كـ hash فقط، أبداً كنص صريح ---------- */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
function verifyToken(token, expectedHash) {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(String(expectedHash), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------- الحماية من محاولات الدخول المتكررة ---------- */
function getAttemptState(usernameKey) {
  return loginAttempts.get(usernameKey) || { count: 0, lockedUntil: 0 };
}
function registerFailedAttempt(usernameKey) {
  const st = getAttemptState(usernameKey);
  st.count += 1;
  if (st.count >= MAX_LOGIN_ATTEMPTS) {
    st.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    st.count = 0;
  }
  loginAttempts.set(usernameKey, st);
  persistAttempts();
}
function clearAttempts(usernameKey) {
  if (loginAttempts.delete(usernameKey)) persistAttempts();
}
function remainingLockSeconds(usernameKey) {
  const st = getAttemptState(usernameKey);
  const ms = st.lockedUntil - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/* ---------- النوافذ ---------- */
function pageFile(name) {
  return path.join(__dirname, name);
}

// Only the main frame of the packaged login/app pages may call privileged IPC.
const trustedRendererUrls = new Set(
  ['login.html', 'app.html'].map((name) => pathToFileURL(pageFile(name)).href)
);
const rawIpcHandle = ipcMain.handle.bind(ipcMain);
function registerIpc(channel, handler) {
  rawIpcHandle(channel, (event, ...args) => {
    const frame = event.senderFrame;
    if (!win || event.sender !== win.webContents || !frame || frame !== event.sender.mainFrame || !trustedRendererUrls.has(frame.url)) {
      return { ok: false, message: 'مصدر الطلب غير موثوق.' };
    }
    return handler(event, ...args);
  });
}

function goToApp() {
  if (win) win.loadFile(pageFile('app.html'));
}
function goToLogin() {
  if (win) win.loadFile(pageFile('login.html'));
}

function tryAutoLogin() {
  const session = loadSession();
  if (!session || !session.username || !session.token) return false;
  if (!session.expires || session.expires < Date.now()) {
    clearSession();
    return false;
  }
  const db = loadUsersDB();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === String(session.username).toLowerCase()
  );
  if (!user || !user.rememberTokenHash) return false;
  // Limited desktop roles are UI filters, not a data-security boundary.
  // Require those users to use the server-filtered mobile sign-in instead.
  if (user.role !== 'admin') {
    user.rememberTokenHash = null;
    saveUsersDB(db);
    clearSession();
    return false;
  }
  if (!verifyToken(session.token, user.rememberTokenHash)) return false;
  currentUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
  return true;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged, // في النسخة المثبّتة لا يمكن فتح أدوات المطوّر لتعديل البيانات أو تجاوز الصلاحيات
    },
  });
  Menu.setApplicationMenu(null);

  // منع الانتقال لأي صفحة خارجية داخل نافذة التطبيق
  win.webContents.on('will-navigate', (e, url) => {
    if (!trustedRendererUrls.has(url)) e.preventDefault();
  });
  // ملفات المرفقات تُفتح كـ blob؛ الروابط الخارجية تُفتح في المتصفح، وغير ذلك يُمنع
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:')) return { action: 'allow' };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (app.isPackaged) {
    win.webContents.on('before-input-event', (e, input) => {
      const k = String(input.key || '').toLowerCase();
      if (k === 'f12' || (input.control && input.shift && (k === 'i' || k === 'j' || k === 'c'))) e.preventDefault();
    });
  }

  const autoIn = tryAutoLogin();
  win.loadFile(pageFile(autoIn ? 'app.html' : 'login.html'));

  win.on('closed', () => {
    win = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!canEncrypt()) {
    dialog.showErrorBox('تعذر تشغيل ملعبنا', 'التخزين الآمن لنظام التشغيل غير متاح. أعد تشغيل Windows أو فعّل مخزن مفاتيح النظام قبل استخدام التطبيق.');
    app.quit();
    return;
  }
  encryptExistingFiles();
  loadAttempts();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- تصدير PDF من نافذة التطبيق ---------- */
registerIpc('export:pdf', async (_evt, payload) => {
  if (!win) return { ok: false, message: 'نافذة التطبيق غير متاحة.' };
  const requested = String((payload && payload.filename) || 'malaabna.pdf').replace(/[^a-zA-Z0-9_.-؀-ۿ ]/g, '_');
  const filename = requested.toLowerCase().endsWith('.pdf') ? requested : requested + '.pdf';
  const result = await dialog.showSaveDialog(win, { title: 'حفظ التقرير PDF', defaultPath: filename, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    const pdf = await win.webContents.printToPDF({ printBackground: true, landscape: !!(payload && payload.landscape), pageSize: 'A4' });
    fs.writeFileSync(result.filePath, pdf);
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, message: e.message || 'تعذر إنشاء ملف PDF.' };
  }
});

/* ---------- منطق مشترك لإنشاء حساب (يُستعمل من شاشة التسجيل العامة ومن داخل التطبيق) ---------- */
function createAccountInternal({ name, username, password, forcedRole, permissions }) {
  name = String(name || '').trim();
  username = String(username || '').trim();
  password = String(password || '');

  if (!name || !username || password.length < MIN_PASSWORD_LEN) {
    return {
      ok: false,
      message: `يرجى ملء جميع الحقول بشكل صحيح (كلمة السر ${MIN_PASSWORD_LEN} أحرف على الأقل).`,
    };
  }
  if (!/^[a-zA-Z0-9_.\-\u0600-\u06FF]{3,30}$/.test(username)) {
    return { ok: false, message: 'اسم المستخدم غير صالح.' };
  }

  const db = loadUsersDB();
  const exists = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return { ok: false, message: 'اسم المستخدم مستعمل من قبل، اختر اسماً آخر.' };

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  // أول حساب يُنشأ في التطبيق يصبح مديراً تلقائياً دائماً؛ بعد ذلك يُستعمل الدور المطلوب إن وُجد
  const role = db.users.length === 0 ? 'admin' : ROLES.includes(forcedRole) ? forcedRole : 'member';

  const user = {
    id: crypto.randomUUID(),
    username,
    name,
    role,
    // صلاحيات الوصول للأقسام: فارغة (بدون تقييد إضافي) للمدير دائماً، ويحدّدها المدير لباقي الحسابات
    permissions: role === 'admin' ? [] : sanitizePermissions(permissions),
    salt,
    hash,
    rememberTokenHash: null,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveUsersDB(db);

  return { ok: true, user };
}

/* ---------- واجهة التوثيق (IPC) ---------- */
registerIpc('auth:hasUsers', () => {
  const db = loadUsersDB();
  return db.users.length > 0;
});

registerIpc('auth:register', async (_evt, payload) => {
  // التسجيل العام مسموح فقط لإنشاء أول حساب (المدير). بعده يُنشئ المدير الحسابات من داخل التطبيق.
  if (loadUsersDB().users.length > 0) {
    return { ok: false, message: 'التسجيل مغلق. اطلب من المدير إنشاء حساب لك.' };
  }
  const result = createAccountInternal({
    name: payload && payload.name,
    username: payload && payload.username,
    password: payload && payload.password,
  });
  if (!result.ok) return result;

  const user = result.user;
  currentUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
  goToApp();
  return { ok: true };
});

// إنشاء حساب جديد من داخل التطبيق دون تسجيل خروج — للمدير فقط
registerIpc('auth:adminCreateAccount', async (_evt, payload) => {
  if (!currentUser || currentUser.role !== 'admin') {
    return { ok: false, message: 'هذه العملية متاحة للمدير فقط.' };
  }
  const requestedRole = ROLES.includes(payload && payload.role) ? payload.role : 'member';
  const result = createAccountInternal({
    name: payload && payload.name,
    username: payload && payload.username,
    password: payload && payload.password,
    forcedRole: requestedRole,
    permissions: payload && payload.permissions,
  });
  if (!result.ok) return result;

  // لا نغيّر الجلسة الحالية ولا ننتقل لأي صفحة؛ المدير يبقى في مكانه داخل التطبيق
  return {
    ok: true,
    user: {
      username: result.user.username,
      name: result.user.name,
      role: result.user.role,
      permissions: result.user.permissions,
    },
  };
});

// قائمة كل الحسابات — للمدير فقط (بدون كلمات السر أو أي بيانات حساسة)
registerIpc('auth:listUsers', () => {
  if (!currentUser || currentUser.role !== 'admin') {
    return { ok: false, message: 'هذه العملية متاحة للمدير فقط.' };
  }
  const db = loadUsersDB();
  const users = db.users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: ROLES.includes(u.role) ? u.role : 'member',
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  }));
  return { ok: true, users };
});

// تعديل دور وصلاحيات حساب موجود — للمدير فقط
registerIpc('auth:updatePermissions', async (_evt, payload) => {
  if (!currentUser || currentUser.role !== 'admin') {
    return { ok: false, message: 'هذه العملية متاحة للمدير فقط.' };
  }
  const targetId = payload && payload.id;
  const requestedRole = ROLES.includes(payload && payload.role) ? payload.role : 'member';
  const db = loadUsersDB();
  const target = db.users.find((u) => u.id === targetId);
  if (!target) return { ok: false, message: 'الحساب غير موجود.' };

  const adminCount = db.users.filter((u) => u.role === 'admin').length;
  if (target.role === 'admin' && requestedRole !== 'admin' && adminCount <= 1) {
    return { ok: false, message: 'لا يمكن إزالة صلاحية المدير عن آخر حساب مدير في النظام.' };
  }

  if (currentUser.id === target.id && requestedRole !== 'admin') {
    return { ok: false, message: 'لا يمكن تخفيض صلاحية حساب المدير أثناء استخدامه. استخدم حساب مدير آخر.' };
  }
  target.role = requestedRole;
  target.permissions = requestedRole === 'admin' ? [] : sanitizePermissions(payload && payload.permissions);
  saveUsersDB(db);

  // إن كان الحساب المُعدَّل هو نفس الحساب الحالي المتصل، حدّث الجلسة الجارية فوراً
  if (currentUser.id === target.id) {
    currentUser.role = target.role;
    currentUser.permissions = target.permissions;
  }
  return { ok: true };
});

// حذف حساب — للمدير فقط، مع منع حذف الحساب الحالي أو آخر حساب مدير
registerIpc('auth:deleteUser', async (_evt, payload) => {
  if (!currentUser || currentUser.role !== 'admin') {
    return { ok: false, message: 'هذه العملية متاحة للمدير فقط.' };
  }
  const targetId = payload && payload.id;
  if (targetId === currentUser.id) {
    return { ok: false, message: 'لا يمكنك حذف حسابك الحالي.' };
  }
  const db = loadUsersDB();
  const target = db.users.find((u) => u.id === targetId);
  if (!target) return { ok: false, message: 'الحساب غير موجود.' };
  const adminCount = db.users.filter((u) => u.role === 'admin').length;
  if (target.role === 'admin' && adminCount <= 1) {
    return { ok: false, message: 'لا يمكن حذف آخر حساب مدير في النظام.' };
  }
  db.users = db.users.filter((u) => u.id !== targetId);
  saveUsersDB(db);
  return { ok: true };
});

registerIpc('auth:login', async (_evt, payload) => {
  const username = String((payload && payload.username) || '').trim();
  const password = String((payload && payload.password) || '');
  const remember = !!(payload && payload.remember);
  const usernameKey = username.toLowerCase();

  const lockedFor = remainingLockSeconds(usernameKey);
  if (lockedFor > 0) {
    return {
      ok: false,
      message: `محاولات كثيرة فاشلة. يرجى الانتظار ${lockedFor} ثانية قبل إعادة المحاولة.`,
    };
  }

  const db = loadUsersDB();
  const user = db.users.find((u) => u.username.toLowerCase() === usernameKey);
  if (!user) hashPassword(password, 'x'.repeat(32)); // نفس زمن الحساب الموجود لمنع كشف أسماء المستخدمين
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    registerFailedAttempt(usernameKey);
    return { ok: false, message: 'اسم المستخدم أو كلمة السر غير صحيحة.' };
  }

  clearAttempts(usernameKey);
  if (user.role !== 'admin') {
    user.rememberTokenHash = null;
    saveUsersDB(db);
    clearSession();
    return { ok: false, message: 'لأسباب أمنية، لا يسمح بدخول الحسابات محدودة الصلاحية من نسخة سطح المكتب. فعّل دخول الهاتف من حساب المدير.' };
  }
  currentUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };

  if (remember) {
    const token = crypto.randomBytes(24).toString('hex');
    user.rememberTokenHash = hashToken(token);
    saveUsersDB(db);
    saveSession({ username: user.username, token, expires: Date.now() + REMEMBER_MS });
  } else {
    user.rememberTokenHash = null;
    saveUsersDB(db);
    clearSession();
  }

  goToApp();
  return { ok: true };
});

registerIpc('auth:logout', async () => {
  if (currentUser) {
    const db = loadUsersDB();
    const user = db.users.find((u) => u.id === currentUser.id);
    if (user) {
      user.rememberTokenHash = null;
      saveUsersDB(db);
    }
  }
  currentUser = null;
  clearSession();
  goToLogin();
  return { ok: true };
});

registerIpc('auth:me', () => currentUser);

// مفتاح Gemini لا يُحفظ في localStorage داخل تطبيق سطح المكتب؛
// safeStorage يستخدم حماية نظام التشغيل (DPAPI على Windows).
registerIpc('secret:getGeminiKey', () => {
  if (!currentUser || currentUser.role !== 'admin') return '';
  const data = readJSON(GEMINI_FILE(), {});
  return typeof data.key === 'string' ? data.key : '';
});
registerIpc('secret:setGeminiKey', (_evt, value) => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false };
  const key = String(value || '').trim().slice(0, 512);
  if (!key) return { ok: false };
  writeJSON(GEMINI_FILE(), { key, updatedAt: new Date().toISOString() });
  return { ok: true };
});
registerIpc('secret:clearGeminiKey', () => {
  if (!currentUser || currentUser.role !== 'admin') return { ok: false };
  try { if (fs.existsSync(GEMINI_FILE())) fs.unlinkSync(GEMINI_FILE()); } catch (_e) {}
  return { ok: true };
});

// Local school data is encrypted with the operating-system account key.
// These IPC methods are only available to an authenticated local user.
registerIpc('vault:encrypt', (_evt, value) => {
  if (!currentUser || currentUser.role !== 'admin' || !safeStorage.isEncryptionAvailable()) return { ok: false };
  try {
    return { ok: true, value: safeStorage.encryptString(String(value)).toString('base64') };
  } catch (_e) {
    return { ok: false };
  }
});
registerIpc('vault:decrypt', (_evt, value) => {
  if (!currentUser || currentUser.role !== 'admin' || !safeStorage.isEncryptionAvailable()) return { ok: false };
  try {
    return { ok: true, value: safeStorage.decryptString(Buffer.from(String(value), 'base64')) };
  } catch (_e) {
    return { ok: false };
  }
});

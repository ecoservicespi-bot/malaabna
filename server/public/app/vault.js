/* Local-data vault. Web/PWA uses a user-held passphrase (PBKDF2 + AES-GCM);
   Electron uses OS-protected safeStorage through the narrow preload bridge. */
(function () {
  'use strict';
  const DB_KEY = 'fsm_v1';
  const FILE_DB = 'fsm_files';
  const FILE_STORE = 'files';
  const ITERATIONS = 600000;
  const MAX_SUPPORTED_ITERATIONS = 1200000;
  let cryptoKey = null;
  let osMode = false;
  let writeQueue = Promise.resolve();

  const b64 = (bytes) => { const u = new Uint8Array(bytes); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const un64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function derive(passphrase, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iterations || ITERATIONS, hash: 'SHA-256' }, material,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptText(text) {
    if (osMode) {
      const result = await window.electronAPI.vaultEncrypt(text);
      if (!result || !result.ok) throw new Error('تعذر تشفير البيانات بمفتاح نظام التشغيل.');
      return { __vaultFile: 1, mode: 'os', payload: result.value };
    }
    const iv = random(12);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(text));
    return { __vaultFile: 1, mode: 'web', iv: b64(iv), ciphertext: b64(ciphertext) };
  }
  async function decryptText(value) {
    if (!value || value.__vaultFile !== 1) return value;
    if (value.mode === 'os') {
      const result = await window.electronAPI.vaultDecrypt(value.payload);
      if (!result || !result.ok) throw new Error('تعذر فك تشفير مرفق سطح المكتب.');
      return result.value;
    }
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un64(value.iv) }, cryptoKey, un64(value.ciphertext));
    return dec.decode(plain);
  }
  async function sealDb(text) {
    if (osMode) {
      const result = await window.electronAPI.vaultEncrypt(text);
      if (!result || !result.ok) throw new Error('تعذر تشفير قاعدة البيانات بمفتاح نظام التشغيل.');
      return JSON.stringify({ __vault: 1, mode: 'os', payload: result.value });
    }
    const salt = window.__malaabnaVaultSalt;
    const iv = random(12);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(text));
    return JSON.stringify({ __vault: 1, mode: 'web', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) });
  }
  async function openDb(raw, passphrase) {
    const box = JSON.parse(raw);
    if (box.mode === 'os') {
      const result = await window.electronAPI.vaultDecrypt(box.payload);
      if (!result || !result.ok) throw new Error('تعذر فك تشفير البيانات بهذا الحساب في نظام التشغيل.');
      osMode = true;
      return result.value;
    }
    const salt = un64(box.salt);
    const iterations = box.iterations || ITERATIONS;
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > MAX_SUPPORTED_ITERATIONS) throw new Error('معاملات اشتقاق المفتاح غير صالحة.');
    cryptoKey = await derive(passphrase, salt, iterations);
    window.__malaabnaVaultSalt = salt;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un64(box.iv) }, cryptoKey, un64(box.ciphertext));
    return dec.decode(plain);
  }
  async function encryptPortableBackup(text, passphrase) {
    const salt = random(16), iv = random(12), key = await derive(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
    return { __malaabnaBackup: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) };
  }
  async function decryptPortableBackup(box, passphrase) {
    if (!box || box.__malaabnaBackup !== 1 || box.kdf !== 'PBKDF2-SHA256' || !Number.isInteger(box.iterations) || box.iterations < 100000 || box.iterations > MAX_SUPPORTED_ITERATIONS) {
      throw new Error('صيغة النسخة الاحتياطية المشفّرة غير مدعومة.');
    }
    const key = await derive(passphrase, un64(box.salt), box.iterations);
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un64(box.iv) }, key, un64(box.ciphertext)));
  }
  function readAllFiles() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FILE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE);
      request.onerror = () => reject(request.error || new Error('تعذر فتح مخزن المرفقات.'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(FILE_STORE, 'readonly');
        const store = tx.objectStore(FILE_STORE);
        const keys = store.getAllKeys(), values = store.getAll();
        tx.oncomplete = () => { db.close(); resolve(keys.result.map((key, i) => [key, values.result[i]])); };
        tx.onerror = () => { db.close(); reject(tx.error || new Error('تعذر قراءة المرفقات.')); };
      };
    });
  }
  async function migrateFiles() {
    if (!('indexedDB' in window)) return;
    const rows = await readAllFiles();
    const encrypted = [];
    for (const [key, value] of rows) encrypted.push([key, value && value.__vaultFile === 1 ? value : await encryptText(String(value || ''))]);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(FILE_DB, 1);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(FILE_STORE, 'readwrite'), store = tx.objectStore(FILE_STORE);
        encrypted.forEach(([key, value]) => store.put(value, key));
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('فشل ترحيل المرفقات المشفّرة.')); };
      };
      request.onerror = () => reject(request.error || new Error('تعذر فتح مخزن المرفقات.'));
    });
  }
  function screen(existing, hasLegacy, errorMessage) {
    return new Promise((resolve) => {
      const root = document.createElement('div');
      root.id = 'vaultScreen';
      root.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f4f7fb;display:grid;place-items:center;padding:20px;font-family:system-ui,sans-serif;direction:rtl';
      root.innerHTML = '<form style="background:#fff;max-width:440px;width:100%;padding:26px;border-radius:14px;box-shadow:0 10px 35px #1232"><h2 style="margin-top:0">🔐 حماية بيانات ملعبنا</h2><p id="vaultHint"></p><div id="vaultPassWrap"><label for="vaultPass">عبارة الحماية (12 حرفاً على الأقل)</label><input id="vaultPass" type="password" autocomplete="current-password" required minlength="12" style="display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:12px"></div><div id="vaultConfirmWrap"><label for="vaultConfirm">تأكيد العبارة</label><input id="vaultConfirm" type="password" autocomplete="new-password" minlength="12" style="display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:12px"></div><p id="vaultError" role="alert" style="color:#b42318"></p><button id="vaultSubmit" type="submit" style="padding:11px 18px">متابعة</button></form>';
      document.body.appendChild(root);
      const form = root.querySelector('form'), pass = root.querySelector('#vaultPass'), confirm = root.querySelector('#vaultConfirm');
      const hint = root.querySelector('#vaultHint'), err = root.querySelector('#vaultError'), button = root.querySelector('#vaultSubmit');
      err.textContent = errorMessage || '';
      const electron = !!window.electronAPI;
      hint.textContent = electron
        ? (hasLegacy ? 'ستُشفّر بياناتك القديمة بمفتاح حساب نظام التشغيل. احتفظ بنسخة احتياطية.' : 'ستُحمى قاعدة البيانات والمرفقات بمفتاح حساب نظام التشغيل.')
        : existing ? 'أدخل عبارة الحماية لفك قفل البيانات على هذا الجهاز.' : 'أنشئ عبارة حماية للبيانات على هذا الجهاز. نسيانها يعني تعذّر استعادة البيانات المحلية.';
      if (electron) {
        pass.disabled = true;
        root.querySelector('#vaultPassWrap').style.display = 'none';
        root.querySelector('#vaultConfirmWrap').style.display = 'none';
      }
      else if (existing) root.querySelector('#vaultConfirmWrap').style.display = 'none';
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); err.textContent = '';
        const phrase = pass.value;
        if (!electron && phrase.length < 12) { err.textContent = 'استخدم 12 حرفاً على الأقل.'; return; }
        if (!electron && !existing && phrase !== confirm.value) { err.textContent = 'العبارتان غير متطابقتين.'; return; }
        button.disabled = true; button.textContent = 'جارٍ فك القفل…';
        try { pass.value = ''; confirm.value = ''; resolve({ phrase, close: () => root.remove() }); }
        catch (e) { err.textContent = e.message; button.disabled = false; }
      });
      if (electron) button.focus(); else pass.focus();
    });
  }
  async function bootstrap() {
    if (!window.crypto || !crypto.subtle || !window.indexedDB) throw new Error('هذا المتصفح لا يدعم تشفير التخزين المطلوب.');
    osMode = !!window.electronAPI;
    const raw = localStorage.getItem(DB_KEY);
    let plain = null, passphrase = '', encrypted = false;
    if (raw) { try { encrypted = JSON.parse(raw).__vault === 1; } catch (_e) {} }
    let lastError = '';
    for (;;) {
      const { phrase, close } = await screen(encrypted, !!raw && !encrypted, lastError);
      lastError = '';
      passphrase = phrase;
      try {
        if (encrypted) plain = await openDb(raw, passphrase);
        else if (raw) {
          const legacy = JSON.parse(raw);
          if (legacy !== null && (!legacy || typeof legacy !== 'object' || !legacy.settings || !Array.isArray(legacy.players))) {
            throw new Error('البيانات القديمة لا تبدو قاعدة ملعبنا؛ لم نعدّلها.');
          }
          plain = raw;
        }
        if (!osMode && !encrypted) {
          const salt = random(16); window.__malaabnaVaultSalt = salt; cryptoKey = await derive(passphrase, salt);
        }
        await migrateFiles();
        if (!encrypted && raw) localStorage.setItem(DB_KEY, await sealDb(plain));
        else if (!encrypted && !raw) localStorage.setItem(DB_KEY, await sealDb('null'));
        window.__malaabnaInitialDb = plain ? JSON.parse(plain) : null;
        const storedSession = sessionStorage.getItem('fsm_mobile_session');
        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            if (parsed && parsed.__vaultFile === 1) {
              window.__malaabnaMobileSession = JSON.parse(await decryptText(parsed));
            } else if (parsed && parsed.token) {
              window.__malaabnaMobileSession = parsed;
              sessionStorage.setItem('fsm_mobile_session', JSON.stringify(await encryptText(JSON.stringify(parsed))));
            }
          } catch (_e) {
            sessionStorage.removeItem('fsm_mobile_session');
          }
        }
        const storedGemini = sessionStorage.getItem('fsm_gemini_session');
        if (storedGemini) {
          try {
            const parsed = JSON.parse(storedGemini);
            if (parsed && parsed.__vaultFile === 1) window.__malaabnaGeminiKey = await decryptText(parsed);
            else {
              window.__malaabnaGeminiKey = storedGemini;
              sessionStorage.setItem('fsm_gemini_session', JSON.stringify(await encryptText(storedGemini)));
            }
          } catch (_e) {
            sessionStorage.removeItem('fsm_gemini_session');
          }
        }
        window.persistMalaabnaDb = (text) => {
          writeQueue = writeQueue.catch(() => {}).then(async () => localStorage.setItem(DB_KEY, await sealDb(text)));
          return writeQueue;
        };
        window.encryptMalaabnaFile = encryptText;
        window.decryptMalaabnaFile = decryptText;
        window.encryptPortableBackup = encryptPortableBackup;
        window.decryptPortableBackup = decryptPortableBackup;
        window.lockMalaabnaVault = () => {
          cryptoKey = null;
          window.__malaabnaInitialDb = null;
          window.__malaabnaMobileSession = null;
          window.__malaabnaGeminiKey = '';
          location.reload();
        };
        close(); return;
      } catch (error) {
        close();
        if (!encrypted || osMode) throw error;
        lastError = 'عبارة غير صحيحة أو بيانات تالفة؛ لم نغيّر الملف.';
      }
    }
  }
  window.malaabnaVaultReady = bootstrap();
})();

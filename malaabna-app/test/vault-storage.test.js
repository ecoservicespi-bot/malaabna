const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const vault = fs.readFileSync(path.join(root, 'vault.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const server = fs.readFileSync(path.join(root, '..', 'server', 'server.js'), 'utf8');

test('database persistence and file attachments go through the vault', () => {
  assert.doesNotMatch(app, /localStorage\.(?:getItem|setItem)\(KEY/);
  assert.match(app, /window\.__malaabnaInitialDb/);
  assert.match(app, /window\.persistMalaabnaDb\(text\)/);
  assert.match(app, /window\.encryptMalaabnaFile\(String\(data\|\|'\'\)\)/);
  assert.match(app, /window\.decryptMalaabnaFile\(value\)/);
});

test('vault uses authenticated encryption and a high-iteration password KDF', () => {
  assert.match(vault, /AES-GCM/);
  assert.match(vault, /PBKDF2/);
  assert.match(vault, /const ITERATIONS = 600000/);
  assert.match(vault, /const MAX_SUPPORTED_ITERATIONS = 1200000/);
  assert.doesNotMatch(vault, /iterations > 5000000/);
  assert.match(vault, /safeStorage/);
  assert.match(main, /safeStorage\.encryptString/);
  assert.match(main, /safeStorage\.decryptString/);
});

test('Electron IPC is restricted to trusted main-frame pages', () => {
  assert.match(main, /trustedRendererUrls/);
  assert.match(main, /frame !== event\.sender\.mainFrame/);
  assert.match(main, /event\.sender !== win\.webContents/);
  assert.match(main, /registerIpc\('vault:decrypt'/);
});

test('desktop vault access and login are restricted to administrators', () => {
  const autoLogin = main.slice(main.indexOf('function tryAutoLogin()'), main.indexOf('function createWindow()'));
  const login = main.slice(main.indexOf("registerIpc('auth:login'"), main.indexOf("registerIpc('auth:logout'"));
  const encrypt = main.slice(main.indexOf("registerIpc('vault:encrypt'"), main.indexOf("registerIpc('vault:decrypt'"));
  const decrypt = main.slice(main.indexOf("registerIpc('vault:decrypt'"));
  assert.match(autoLogin, /user\.role !== 'admin'/);
  assert.match(login, /user\.role !== 'admin'/);
  assert.match(encrypt, /currentUser\.role !== 'admin'/);
  assert.match(decrypt, /currentUser\.role !== 'admin'/);
});

test('inline script blocks are externalized and blocked by CSP', () => {
  const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
  const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
  assert.match(login, /script-src 'self'/);
  assert.match(login, /script-src-attr 'none'/);
  assert.doesNotMatch(login, /script-src 'self'[^;]*'unsafe-inline'/);
  assert.match(login, /<script src="login\.js" defer><\/script>/);
  assert.doesNotMatch(login, /on(?:click|submit)=/i);
  assert.match(appHtml, /<script src="bootstrap\.js" defer><\/script>/);
  assert.match(appHtml, /script-src-elem 'self'/);
  assert.match(appHtml, /script-src-attr 'none'/);
  assert.doesNotMatch(appHtml, /\bon[a-z]+\s*=\s*['"]/i);
  assert.doesNotMatch(app, /\bon[a-z]+\s*=\s*['"]/i);
  assert.match(app, /function bindShellActions\(\)/);
  assert.doesNotMatch(appHtml, /<script>\s*window\.malaabnaVaultReady/);
});

test('Electron vault prompt keeps its continue form visible', () => {
  assert.match(vault, /id="vaultPassWrap"/);
  assert.match(vault, /pass\.disabled = true/);
  assert.match(vault, /root\.querySelector\('#vaultPassWrap'\)\.style\.display = 'none'/);
  assert.doesNotMatch(vault, /pass\.parentElement\.style\.display = 'none'/);
});

test('portable backups are separately encrypted and legacy JSON import warns', () => {
  assert.match(app, /window\.encryptPortableBackup\(clear,phrase\)/);
  assert.match(app, /window\.decryptPortableBackup\(envelope,phrase\)/);
  assert.equal((app.match(/function importJSON\(el\)/g) || []).length, 1, 'there must be no legacy plaintext import override');
  assert.match(app, /نسخة JSON قديمة غير مشفّرة/);
});

test('PWA CSP prevents framing and preserves the vault bootstrap', () => {
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /script-src-attr 'none'/);
  assert.match(html, /vault\.js/);
  assert.match(html, /src="bootstrap\.js"/);
  const bootstrap = fs.readFileSync(path.join(root, 'bootstrap.js'), 'utf8');
  assert.match(bootstrap, /malaabnaVaultReady/);
  assert.match(html, /script-src-elem 'self'/);
});

test('migrated dynamic UI actions use delegated listeners, not inline handlers', () => {
  assert.match(app, /function actionAttr\(type,handler\)/);
  assert.match(app, /addEventListener\(type,dispatchAppAction\)/);
  assert.match(app, /entry\.handler\(event,target\)/);
  assert.doesNotMatch(app, /eval\s*\(|new Function\s*\(/);
  const regions = [
    ['function mobileLoginHTML()', 'async function mobileLogin()'],
    ['function loginHTML()', 'function doLogin('],
    ['function listPage(coll)', 'function printHead()'],
    ['function cardsPage()', 'function head('],
    ['function attPage()', 'function mark('],
    ['function subsTable(list)', 'function genMonth(']
  ];
  for (const [start, end] of regions) {
    const from = app.indexOf(start);
    const to = app.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `source region exists: ${start}`);
    assert.doesNotMatch(app.slice(from, to), /\bon(?:click|change|input|keydown|submit)=/i, `${start} has no inline event attribute`);
  }
});

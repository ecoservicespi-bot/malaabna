const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));

test('all manifest icons are included in the PWA shell cache', () => {
  const files = serviceWorker.match(/const FILES = \[([\s\S]*?)\];/);
  assert.ok(files, 'PWA shell file list exists');
  for (const icon of manifest.icons) {
    assert.match(files[1], new RegExp(icon.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(fs.existsSync(path.join(root, icon.src)), `missing manifest icon ${icon.src}`);
  }
  assert.match(files[1], /apple-touch-icon\.png/);
});

test('the worker bounds network waits and serves cached navigation as fallback', () => {
  assert.match(serviceWorker, /const NETWORK_TIMEOUT_MS = 3500/);
  assert.match(serviceWorker, /controller\.abort\(\)/);
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
  assert.match(serviceWorker, /handleNavigation\(event, request\)/);
  assert.match(serviceWorker, /cache\.match\(absoluteUrl\('app\.html'\), \{ ignoreVary: true \}\)/);
});

test('static resources use cache-first while user-specific and API requests bypass cache', () => {
  assert.match(serviceWorker, /const cached = await cache\.match\(request, \{ ignoreVary: true \}\)/);
  assert.match(serviceWorker, /!url\.search/);
  assert.match(serviceWorker, /api\|downloads/);
  assert.match(serviceWorker, /cacheControl/);
  assert.match(serviceWorker, /private\|no-store/);
});

test('activation removes only older Malaabna caches', () => {
  assert.match(serviceWorker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE/);
});

test('OCR models stay in a stable runtime cache across shell updates', () => {
  assert.match(serviceWorker, /const OCR_CACHE = 'malaabna-ocr-runtime-v1'/);
  assert.match(serviceWorker, /for \(const file of OCR_FILES\)/);
  assert.match(serviceWorker, /ocrCache\.put\(url, oldResponse\.clone\(\)\)/);
  assert.match(serviceWorker, /caches\.open\(isOcrAsset \? OCR_CACHE : CACHE\)/);
});

test('the shell cache name changes with the bundled first-month registration fee update', () => {
  assert.match(serviceWorker, /const CACHE = 'malaabna-v3\.8\.61-registration-fee-monthly-start'/);
});
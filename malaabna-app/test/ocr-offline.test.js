const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'bootstrap.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const runtimeFiles = [
  'ocr/tesseract.min.js',
  'ocr/worker.min.js',
  'ocr/core/tesseract-core-lstm.wasm.js',
  'ocr/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/lang/ara.traineddata',
  'ocr/lang/fra.traineddata',
  'ocr/lang/eng.traineddata',
];

test('OCR engine and language models are bundled locally', () => {
  assert.doesNotMatch(app, /cdn\.jsdelivr\.net|tessdata\.projectnaptha\.com/);
  assert.match(app, /new URL\('ocr\/tesseract\.min\.js'/);
  assert.match(app, /workerPath:new URL\('worker\.min\.js',ocrBase\)/);
  assert.match(app, /corePath:new URL\('core\/',ocrBase\)/);
  assert.match(app, /langPath:new URL\('lang',ocrBase\)/);
  assert.match(app, /gzip:false/);
  for (const file of runtimeFiles) assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
});

test('CSP and desktop packaging allow only the local OCR assets', () => {
  assert.doesNotMatch(html, /https:\/\/cdn\.jsdelivr\.net/);
  assert.ok(pkg.build.files.includes('ocr/**'));
});

test('the OCR engine is loaded only when local OCR is explicitly started', () => {
  assert.match(app, /function loadTesseract\(\)/);
  assert.match(app, /async function docRunOCR\(\)\{[^]*?await loadTesseract\(\)/);
  assert.doesNotMatch(html, /<script[^>]+(?:ocr\/|tesseract)/i);
  assert.doesNotMatch(bootstrap, /ocr\/|tesseract/i);
});

test('PWA install precaches the app shell, not multi-megabyte OCR assets', () => {
  const filesList = serviceWorker.match(/const FILES = \[([\s\S]*?)\];/);
  assert.ok(filesList, 'service worker app-shell file list exists');
  assert.doesNotMatch(filesList[1], /ocr\/|traineddata|wasm/i);
  assert.match(serviceWorker, /malaabna-v3\.8\.61-registration-fee-monthly-start/);
  assert.match(serviceWorker, /handleAsset\(request\)/);
});


test('document workflow includes local PDF, OCR correction, and opt-in retention', () => {
  assert.match(app, /createPdfFromJpegs/);
  assert.match(app, /function docApplyOCRFile/);
  assert.match(app, /id=\"oKeepDocs\" type=\"checkbox\"/);
  assert.match(app, /if\(keepScans\)\{for\(const f of docScanFiles\)/);
  assert.match(app, /function docExportPdf\(\)/);
});

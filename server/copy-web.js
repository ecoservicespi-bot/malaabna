// ينسخ ملفات واجهة التطبيق من ../malaabna-app إلى public/app لتُقدَّم كتطبيق ويب للهاتف.
// يعمل تلقائياً قبل npm start. إن لم يوجد المجلد المصدر يُبقي النسخة الموجودة كما هي.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'malaabna-app');
const DST = path.join(__dirname, 'public', 'app');
const FILES = ['vendor/UNICODE-PATCH.md', 'vendor/SHA256SUMS.txt', 'receipt-tools.js', 'vendor/jspdf.umd.min.js', 'vendor/receipt-fonts.js', 'vendor/JSPDF-LICENSE.txt', 'vendor/AMIRI-OFL.txt', 'vendor/README.md', 'app.html', 'bootstrap.js', 'app.css', 'vault.js', 'app.js', 'finance.js', 'scanner.js', 'pwa.js', 'sw.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'assets/alwiam-logo.jpg',
  'ocr/tesseract.min.js', 'ocr/worker.min.js', 'ocr/TESSERACT-LICENSE.txt', 'ocr/TESSERACT-BUNDLE-LICENSE.txt', 'ocr/VERSION.txt', 'ocr/SHA256SUMS.txt',
  'ocr/core/tesseract-core-lstm.wasm.js', 'ocr/core/tesseract-core-simd-lstm.wasm.js', 'ocr/core/TESSERACT-CORE-LICENSE.txt',
  'ocr/lang/ara.traineddata', 'ocr/lang/fra.traineddata', 'ocr/lang/eng.traineddata', 'ocr/lang/TESSDATA-LICENSE.txt'];
if (!fs.existsSync(SRC)) {
  console.log('ℹ️ مجلد malaabna-app غير موجود بجانب server — تم الإبقاء على نسخة الويب الحالية.');
  process.exit(0);
}
fs.mkdirSync(DST, { recursive: true });
FILES.forEach((f) => {
  const from = path.join(SRC, f);
  if (fs.existsSync(from)) {
    const to = path.join(DST, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
});
console.log('✅ تم تحديث نسخة الويب في public/app');

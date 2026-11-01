const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pairs = [
  ['app.js', path.join(__dirname, '..', 'malaabna-app', 'app.js'), path.join(__dirname, 'public', 'app', 'app.js')],
  ['finance.js', path.join(__dirname, '..', 'malaabna-app', 'finance.js'), path.join(__dirname, 'public', 'app', 'finance.js')],
  ['app.html', path.join(__dirname, '..', 'malaabna-app', 'app.html'), path.join(__dirname, 'public', 'app', 'app.html')],
  ['bootstrap.js', path.join(__dirname, '..', 'malaabna-app', 'bootstrap.js'), path.join(__dirname, 'public', 'app', 'bootstrap.js')],
  ['vault.js', path.join(__dirname, '..', 'malaabna-app', 'vault.js'), path.join(__dirname, 'public', 'app', 'vault.js')],
  ['pwa.js', path.join(__dirname, '..', 'malaabna-app', 'pwa.js'), path.join(__dirname, 'public', 'app', 'pwa.js')],
  ['sw.js', path.join(__dirname, '..', 'malaabna-app', 'sw.js'), path.join(__dirname, 'public', 'app', 'sw.js')],
  ['app.css', path.join(__dirname, '..', 'malaabna-app', 'app.css'), path.join(__dirname, 'public', 'app', 'app.css')],
  ['scanner.js', path.join(__dirname, '..', 'malaabna-app', 'scanner.js'), path.join(__dirname, 'public', 'app', 'scanner.js')],
  ...[
    'vendor/UNICODE-PATCH.md',
    'vendor/SHA256SUMS.txt',
    'receipt-tools.js',
    'vendor/jspdf.umd.min.js',
    'vendor/receipt-fonts.js',
    'vendor/JSPDF-LICENSE.txt',
    'vendor/AMIRI-OFL.txt',
    'vendor/README.md',

    'ocr/tesseract.min.js', 'ocr/worker.min.js', 'ocr/TESSERACT-LICENSE.txt', 'ocr/TESSERACT-BUNDLE-LICENSE.txt', 'ocr/VERSION.txt', 'ocr/SHA256SUMS.txt',
    'ocr/core/tesseract-core-lstm.wasm.js', 'ocr/core/tesseract-core-simd-lstm.wasm.js', 'ocr/core/TESSERACT-CORE-LICENSE.txt',
    'ocr/lang/ara.traineddata', 'ocr/lang/fra.traineddata', 'ocr/lang/eng.traineddata', 'ocr/lang/TESSDATA-LICENSE.txt',
  ].map((name) => [name, path.join(__dirname, '..', 'malaabna-app', name), path.join(__dirname, 'public', 'app', name)]),
];

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

for (const [name, source, published] of pairs) {
  if (!fs.existsSync(source) || !fs.existsSync(published)) {
    console.error(`نسخة المصدر أو النسخة المنشورة من ${name} غير موجودة.`);
    process.exit(1);
  }
  if (digest(source) !== digest(published)) {
    console.error(`نسخة الويب المنشورة من ${name} لا تطابق نسخة المصدر. شغّل: npm run copy-web`);
    process.exit(1);
  }
}

console.log('نسخة الويب مطابقة للمصدر.');
// تخزين PWA: shell سريع من الذاكرة المؤقتة، وتنقل شبكي بمهلة وبديل offline.
// لا تُخزَّن طلبات API أو التنزيلات أو الروابط ذات query (قد تحتوي رموزاً).
const CACHE_PREFIX = 'malaabna-v';
const CACHE = 'malaabna-v3.8.61-registration-fee-monthly-start';
const OCR_CACHE = 'malaabna-ocr-runtime-v1';
const NETWORK_TIMEOUT_MS = 3500;
const OCR_FILES = [
  'ocr/tesseract.min.js', 'ocr/worker.min.js',
  'ocr/core/tesseract-core-lstm.wasm.js',
  'ocr/core/tesseract-core-simd-lstm.wasm.js',
  'ocr/lang/ara.traineddata', 'ocr/lang/fra.traineddata',
  'ocr/lang/eng.traineddata',
];
const FILES = [
  'receipt-tools.js',
  'vendor/jspdf.umd.min.js',
  'vendor/receipt-fonts.js',
  'vendor/jsqr.js',

  './', 'app.html', 'bootstrap.js', 'app.css', 'vault.js', 'finance.js',
  'scanner.js', 'pwa.js', 'app.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'apple-touch-icon.png', 'assets/alwiam-logo.jpg',
  // ملفات OCR الكبيرة تُخزَّن فقط بعد أن يطلب المستخدم القراءة المحلية.
];
const REQUIRED_FILES = [
  'app.html', 'bootstrap.js', 'app.css', 'vault.js', 'finance.js',
  'scanner.js', 'pwa.js', 'app.js', 'manifest.webmanifest',
];

function absoluteUrl(file) {
  return new URL(file, self.registration.scope).href;
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { cache: 'no-cache', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function canCache(request, response) {
  const url = new URL(request.url);
  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase();
  return request.method === 'GET' &&
    url.origin === location.origin &&
    !url.search &&
    !/(^|\/)(api|downloads)(\/|$)/.test(url.pathname) &&
    response.ok &&
    response.type !== 'opaque' &&
    !/\b(private|no-store)\b/.test(cacheControl);
}

async function saveResponse(cache, request, response) {
  if (!canCache(request, response)) return;
  try {
    await cache.put(request, response.clone());
  } catch (_) {
    // تعذّر التخزين (مثلاً امتلاء مساحة الجهاز) لا يمنع عرض الاستجابة الحالية.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // حمّل كل ملف بمهلة محددة؛ الأيقونات تحسين اختياري وليست شرطاً للتثبيت.
    await Promise.allSettled(FILES.map(async (file) => {
      const request = new Request(absoluteUrl(file), { cache: 'reload' });
      const response = await fetchWithTimeout(request);
      if (!canCache(request, response)) throw new Error('تعذر تخزين ملف PWA: ' + file);
      await cache.put(request, response);
    }));

    // لا يستبدل الإصدار العامل إلا إذا اكتملت ملفات التطبيق الأساسية.
    const missing = [];
    for (const file of REQUIRED_FILES) {
      if (!await cache.match(absoluteUrl(file))) missing.push(file);
    }
    if (missing.length) {
      await caches.delete(CACHE);
      throw new Error('ملفات PWA الأساسية غير متاحة: ' + missing.join(', '));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = (await caches.keys())
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
    const ocrCache = await caches.open(OCR_CACHE);
    for (const key of keys) {
      const oldCache = await caches.open(key);
      let safeToDelete = true;
      // نقل نماذج OCR المحمّلة سابقاً إلى cache ثابت حتى لا تُنزّل مجدداً بعد التحديث.
      for (const file of OCR_FILES) {
        const url = absoluteUrl(file);
        const oldResponse = await oldCache.match(url, { ignoreVary: true });
        if (!oldResponse || await ocrCache.match(url, { ignoreVary: true })) continue;
        try {
          await ocrCache.put(url, oldResponse.clone());
        } catch (_) {
          safeToDelete = false;
        }
      }
      if (safeToDelete) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function handleNavigation(event, request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchWithTimeout(request);
    await saveResponse(cache, request, response);
    return response;
  } catch (_) {
    const cached = await cache.match(request, { ignoreVary: true }) ||
      await cache.match(absoluteUrl('app.html'), { ignoreVary: true }) ||
      await cache.match(absoluteUrl('./'), { ignoreVary: true });
    return cached || new Response(
      'تعذر الاتصال. افتح ملعبنا بعد استعادة الاتصال لتنزيل ملفات التطبيق.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
}

async function handleAsset(request) {
  const isOcrAsset = new URL(request.url).pathname.includes('/ocr/');
  const cache = await caches.open(isOcrAsset ? OCR_CACHE : CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  if (isOcrAsset) {
    // توافق مع cache قديم تعذّر ترحيله بسبب مساحة تخزين غير كافية.
    const legacy = await caches.match(request, { ignoreVary: true });
    if (legacy) {
      await saveResponse(cache, request, legacy);
      return legacy;
    }
  }

  try {
    const response = await fetchWithTimeout(request);
    await saveResponse(cache, request, response);
    return response;
  } catch (_) {
    return new Response(
      'هذا الملف غير متاح دون اتصال. أعد المحاولة عند تحسن الشبكة.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scopePath = new URL(self.registration.scope).pathname;
  if (
    request.method !== 'GET' ||
    url.origin !== location.origin ||
    !url.pathname.startsWith(scopePath) ||
    url.search ||
    request.headers.has('range') ||
    /(^|\/)(api|downloads)(\/|$)/.test(url.pathname)
  ) return;

  // التنقل: الشبكة أولاً بمهلة قصيرة ثم نسخة الصفحة المخزّنة.
  // الملفات الثابتة وملفات OCR: الذاكرة أولاً، ثم تنزيل محدود المهلة عند أول استخدام.
  event.respondWith(request.mode === 'navigate'
    ? handleNavigation(event, request)
    : handleAsset(request));
});
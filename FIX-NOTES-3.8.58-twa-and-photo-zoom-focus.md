# إصلاحات 3.8.58 — نسخة TWA وتركيز تكبير الصورة

الإصدار يبقى **3.8.58**؛ هذه إصلاحات داخل الإصدار نفسه، وليست إصدارًا جديدًا.

## 1. تناقض نسخة TWA في أندرويد

- `android/twa-manifest.json`: `appVersionCode` من `30854` إلى `30858`، و`appVersion` من `3.8.48` إلى `3.8.58`، لتطابق `appVersionName` و`android/app/build.gradle` (`versionCode 30858` / `versionName "3.8.58"`).
- `malaabna-app/test/ocr-review-status.test.js`: حدّث التأكيد المثبّت من `30854` إلى `30858`، وإلا كان الإصلاح وحده سيكسر مجموعة الاختبارات.
- المرجع: `docs/ANDROID-APK.md` — عند إصدار APK جديد، حدّث `appVersion` و`appVersionCode` ثم شغّل `bubblewrap update` و`bubblewrap build` بالمفتاح نفسه.

## 2. تركيز التكبير على موضع الصورة المختار

- `malaabna-app/app.css` و`server/public/app/app.css` (يجب أن يبقيا متطابقين): أضيف `transform-origin:var(--member-photo-position-x,50%) var(--member-photo-position-y,50%)` إلى قاعدة `.member-photo:not(.member-photo-empty)`، بجانب `transform:scale(var(--member-photo-zoom,1))`.
- السبب: كان أصل التحويل في المنتصف افتراضيًا، فعند التكبير إلى 200% مع موضع 0% أو 100% قد لا تبقى نقطة التركيز المختارة في مكانها. الآن يكبّر التحويل حول نقطة الموضع نفسها المستخدمة في `object-position`.
- عند 100% لا يتغير شيء، لأن `scale(1)` لا يتأثر بالأصل.
- `malaabna-app/test/card-studio.test.js`: أضيف تأكيد على قاعدة `transform-origin` في CSS.

## التحقق بعد الإصلاح

- اختبارات التطبيق الكاملة `npm test`: 209 ناجحة، 0 فاشلة.
- اختبارات تصميم البطاقة في الخادم: 6 ناجحة، 0 فاشلة.
- فحص مطابقة نسخة الويب `node check-web-sync.js`: مطابقة.
- لم يُبنَ ملف EXE أو APK، ولم يُنشر التحديث؛ يبقى الاختبار البصري بصورة حقيقية وتشغيل مجموعة اختبارات الخادم الكاملة مطلوبين قبل النشر الحي.

## 3. إضافة لاحقة: تأكيد `appVersion` وقائمة فحص النشر

- `malaabna-app/test/ocr-review-status.test.js`: أضيف `assert.equal(require('../../android/twa-manifest.json').appVersion, version)` بجانب تأكيدي `appVersionName` و`appVersionCode`، حتى لا يعود حقل `appVersion` قديمًا دون أن تفشل الاختبارات. لم يتغير أي سلوك أو قيمة إصدار.
- أضيف `DEPLOY-CHECKLIST-3.8.58.md` في جذر الحزمة: قائمة فحص نشر تجمع إعداد تحقق الوصولات (من 3.8.51، وموجود في هذه النسخة) والاختبار البصري للبطاقة وبناء EXE/APK وبصمات TWA.
- التحقق بعد الإضافة: اختبارات التطبيق 214 ناجحة، 0 فاشلة؛ `npm run check` للخادم ناجح ونسخة الويب مطابقة. بصمات TWA ما تزال فارغة، ومجموعة اختبارات الخادم الكاملة ما تزال للمرحلة 6.

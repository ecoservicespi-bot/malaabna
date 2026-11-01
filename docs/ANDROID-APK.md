# بناء تطبيق ملعبنا لأندرويد (APK)

مجلد `android/` يحتوي مشروع Android من نوع **Trusted Web Activity (TWA)**. يظهر ملعبنا كتطبيق Android مستقل، ويعرض نسخة الويب الرسمية على `https://sync.clubagaplus.ma/app/`. لا يحتاج هذا المسار إلى إعادة كتابة التطبيق، وتصل تحديثات الواجهة من الموقع بعد نشرها.

> يتطلب الاتصال بالإنترنت عند أول تشغيل. بعد فتح التطبيق وتحميل ملفات PWA، يعمل ما تسمح به ذاكرة التطبيق المؤقتة دون اتصال. إذا تعذّر التحقق من رابط Android بالموقع، قد يعرض Chrome شريطه أعلى التطبيق إلى أن يُضبط Digital Asset Links.

## المتطلبات

- Node.js 22 أو أحدث.
- JDK 17.
- Android SDK وأدوات البناء؛ يستطيع Bubblewrap تثبيتها عند إعداد البيئة.
- نطاق HTTPS الثابت الحالي: `sync.clubagaplus.ma`.

## تجهيز مفتاح التوقيع

من مجلد `android/` أنشئ مفتاحًا خاصًا بك. اختر كلمة مرور قوية واحفظ نسخة احتياطية آمنة من ملف المفتاح وكلمة مروره؛ لا يمكن نشر تحديث للتطبيق بالهوية نفسها من دون المفتاح الأصلي.

```bash
keytool -genkeypair -v \
  -keystore malaabna-release.jks \
  -alias malaabna \
  -keyalg RSA -keysize 2048 -validity 10000
```

لا ترفع ملف `.jks` أو كلمات المرور إلى مستودع عام أو ترسلها في المحادثات. إعدادات المشروع تستثني ملفات المفاتيح من Git.

## بناء APK

```bash
npm install -g @bubblewrap/cli
cd android
bubblewrap build
```

أدخل كلمة مرور ملف المفتاح والمفتاح عند الطلب. ينتج Bubblewrap:

- `app-release-signed.apk` للتثبيت المباشر والاختبار.
- `app-release-bundle.aab` للنشر الاختياري على Google Play.

اسم الحزمة ثابت في `android/twa-manifest.json` (`com.malaabna.app`). لا تغيّره بعد توزيع التطبيق.

## تفعيل ملء الشاشة

يجب ربط توقيع APK بالنطاق. استخرج بصمة SHA-256 لشهادة المفتاح:

```bash
keytool -list -v -keystore malaabna-release.jks -alias malaabna
```

في ملف `server/.env` على خادم الموقع، اضبط:

```dotenv
ANDROID_TWA_PACKAGE_NAME=com.malaabna.app
ANDROID_TWA_SHA256_CERT_FINGERPRINTS=AA:BB:...:FF
```

استبدل القيمة الثانية بالبصمة الكاملة ذات 32 زوجًا سداسيًا. إذا نشر التطبيق عبر Google Play مع Play App Signing، أضف بصمة شهادة توقيع Play أيضًا، مفصولة بفاصلة. أعد تشغيل الخادم، ثم تحقق من:

```text
https://sync.clubagaplus.ma/.well-known/assetlinks.json
```

بعدها أعد تثبيت APK وجرّب فتحه. لا تضع بصمة تقديرية أو بصمة مفتاح مختلف عن المفتاح المستخدم لتوقيع APK.

## تحديث التطبيق

بعد تحديث نسخة الويب، انشر ملفات التطبيق بالطريقة المعتادة (`server/npm run copy-web` ثم أعد تشغيل الخادم). عند إصدار APK جديد، حدّث `appVersion` و`appVersionCode` في `android/twa-manifest.json`، ثم شغّل `bubblewrap update` و`bubblewrap build` مع **ملف المفتاح نفسه**.
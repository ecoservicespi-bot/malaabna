/* ملعبنا — طبقة التطبيق على الهاتف (PWA)
   - شريط «ثبّت التطبيق» (أندرويد/Chrome) وتعليمات الإضافة للشاشة الرئيسية (آيفون/Safari)
   - تنبيه «تحديث جديد» عند تفعيل نسخة جديدة من الخدمة
   - مؤشر انقطاع الاتصال
   لا يستخدم معالجات أحداث مضمّنة (متوافق مع CSP)، ولا يعمل داخل Electron. */
(function () {
  'use strict';
  if (window.electronAPI || window.__malaabnaPwa) return;
  var DISMISS_KEY = 'fsm_pwa_install_dismissed';
  var DISMISS_MS = 7 * 24 * 3600 * 1000;
  var deferred = null;

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function recentlyDismissed() {
    var t = Number(safeGet(DISMISS_KEY) || 0);
    return t && Date.now() - t < DISMISS_MS;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(label, cls, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- شريط عام أسفل الشاشة (فوق الشريط السفلي) ---------- */
  var bar = null;
  function closeBar() { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); bar = null; }
  function showBar(opts) {
    closeBar();
    bar = el('div', 'pwa-bar');
    bar.setAttribute('role', 'status');
    if (opts.icon) bar.appendChild(el('div', 'pwa-ic', opts.icon));
    var txt = el('div', 'pwa-tx');
    txt.appendChild(el('b', '', opts.title));
    if (opts.sub) txt.appendChild(el('span', '', opts.sub));
    bar.appendChild(txt);
    var acts = el('div', 'pwa-ac');
    (opts.actions || []).forEach(function (a) { acts.appendChild(btn(a.label, a.cls, a.onClick)); });
    bar.appendChild(acts);
    document.body.appendChild(bar);
  }

  /* ---------- أندرويد / Chrome / Edge ---------- */
  function offerInstall() {
    if (isStandalone() || recentlyDismissed() || !deferred) return;
    showBar({
      icon: '⚽', title: 'ثبّت ملعبنا على هاتفك', sub: 'يفتح بملء الشاشة ويعمل بدون إنترنت',
      actions: [
        { label: 'تثبيت', cls: 'pwa-go', onClick: function () { promptInstall(); } },
        { label: 'لاحقاً', cls: 'pwa-x', onClick: function () { safeSet(DISMISS_KEY, String(Date.now())); closeBar(); } }
      ]
    });
  }
  function promptInstall() {
    if (!deferred) return Promise.resolve(false);
    var ev = deferred; deferred = null; closeBar();
    ev.prompt();
    return ev.userChoice.then(function (r) {
      if (r && r.outcome !== 'accepted') safeSet(DISMISS_KEY, String(Date.now()));
      return !!(r && r.outcome === 'accepted');
    }).catch(function () { return false; });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    setTimeout(offerInstall, 2500);
  });
  window.addEventListener('appinstalled', function () {
    deferred = null; closeBar();
    showBar({ icon: '✅', title: 'تم تثبيت ملعبنا', sub: 'ستجده في الشاشة الرئيسية', actions: [{ label: 'حسناً', cls: 'pwa-x', onClick: closeBar }] });
    setTimeout(closeBar, 4000);
  });

  /* ---------- آيفون / Safari (لا يوجد beforeinstallprompt) ---------- */
  function iosGuide() {
    var ov = el('div', 'pwa-sheet-ov');
    var sh = el('div', 'pwa-sheet');
    sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.appendChild(el('h3', '', 'تثبيت ملعبنا على آيفون'));
    var ol = el('ol');
    ['اضغط زر المشاركة ⬆︎ أسفل شاشة Safari.',
      'مرّر للأسفل واختر «إضافة إلى الشاشة الرئيسية».',
      'اضغط «إضافة» — ستظهر أيقونة ملعبنا بين تطبيقاتك.'].forEach(function (t) { ol.appendChild(el('li', '', t)); });
    sh.appendChild(ol);
    sh.appendChild(btn('فهمت', 'pwa-go', function () { document.body.removeChild(ov); }));
    ov.appendChild(sh);
    ov.addEventListener('click', function (e) { if (e.target === ov) document.body.removeChild(ov); });
    document.body.appendChild(ov);
  }
  function offerIOS() {
    if (!isIOS || isStandalone() || recentlyDismissed()) return;
    if (!isSafari) {
      showBar({ icon: '🧭', title: 'لتثبيت التطبيق افتح الرابط في Safari', sub: 'آيفون يسمح بالتثبيت من Safari فقط',
        actions: [{ label: 'إغلاق', cls: 'pwa-x', onClick: function () { safeSet(DISMISS_KEY, String(Date.now())); closeBar(); } }] });
      return;
    }
    showBar({ icon: '⚽', title: 'ثبّت ملعبنا على آيفون', sub: 'أضفه إلى الشاشة الرئيسية ليعمل كتطبيق',
      actions: [
        { label: 'كيف؟', cls: 'pwa-go', onClick: function () { closeBar(); iosGuide(); } },
        { label: 'لاحقاً', cls: 'pwa-x', onClick: function () { safeSet(DISMISS_KEY, String(Date.now())); closeBar(); } }
      ] });
  }
  if (isIOS) setTimeout(offerIOS, 3000);

  /* ---------- تحديث الخدمة ---------- */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) { hadController = true; return; }
      showBar({ icon: '🔄', title: 'تم تحديث ملعبنا', sub: 'أعد التحميل للحصول على آخر نسخة',
        actions: [
          { label: 'إعادة التحميل', cls: 'pwa-go', onClick: function () { reloading = true; location.reload(); } },
          { label: 'لاحقاً', cls: 'pwa-x', onClick: closeBar }
        ] });
    });
    // فحص دوري عن تحديث عند عودة المستخدم للتطبيق
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().catch(function () {}); }).catch(function () {});
    });
  }

  /* ---------- مؤشر الاتصال ---------- */
  var offlineEl = null;
  function setOnline(ok) {
    document.documentElement.classList.toggle('is-offline', !ok);
    if (!ok && !offlineEl) {
      offlineEl = el('div', 'pwa-offline', 'لا يوجد اتصال — يعمل التطبيق على نسخة الجهاز، وتُزامَن التعديلات عند عودة الإنترنت');
      offlineEl.setAttribute('role', 'status');
      document.body.appendChild(offlineEl);
    } else if (ok && offlineEl) {
      if (offlineEl.parentNode) offlineEl.parentNode.removeChild(offlineEl);
      offlineEl = null;
    }
  }
  window.addEventListener('online', function () { setOnline(true); });
  window.addEventListener('offline', function () { setOnline(false); });
  if (navigator.onLine === false) setOnline(false);

  window.__malaabnaPwa = {
    canInstall: function () { return !!deferred && !isStandalone(); },
    install: promptInstall,
    isIOS: isIOS,
    isStandalone: isStandalone,
    showIOSGuide: iosGuide
  };
})();

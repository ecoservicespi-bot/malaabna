const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'bootstrap.js'), 'utf8');
const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'app.css'), 'utf8');
const appScript = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('application entry loads the UI only after the encrypted vault is ready', () => {
  assert.match(html, /<meta name="viewport"/i);
  assert.match(html, /<script src="vault\.js"><\/script>/);
  assert.match(html, /<script src="bootstrap\.js" defer><\/script>/);
  assert.match(bootstrap, /window\.malaabnaVaultReady\.then/);
  assert.match(bootstrap, /loadScript\('app\.js'/);
});

test('settings hide sync and operations log panels without removing existing logging functions', () => {
  const settingsPage = appScript.match(/^function settingsPage\(\)\{[\s\S]*?^\}/m);
  assert.ok(settingsPage, 'settings page exists');
  assert.doesNotMatch(settingsPage[0], /سجل المزامنة|سجل العمليات|syncLogHTML\(\)|auditLogHTML\(\)/);
  assert.match(appScript, /function auditAdd\(/);
  assert.match(appScript, /function syncLogAdd\(/);
});

test('web startup has a visible loading state and reports missing scripts', () => {
  assert.match(html, /id="webBootStatus"/);
  assert.match(html, /id="acctBar"[^>]+display:none/);
  assert.match(appScript, /if\(window\.electronAPI\)\{const accountBar/);
  assert.match(bootstrap, /script\.onerror/);
  assert.match(bootstrap, /تعذّر تشغيل واجهة الويب/);
  assert.match(bootstrap, /updateViaCache:'none'/);
  assert.match(appScript, /updateViaCache:'none'/);
});

test('document registration supports edge correction, multilingual OCR, and copying text', () => {
  assert.match(appScript, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(appScript, /MalaabnaScanner\.detectDocumentQuad/);
  assert.match(appScript, /MalaabnaScanner\.rectifyRgba/);
  assert.match(appScript, /createWorker\('ara\+fra\+eng'/);
  assert.match(appScript, /function copyDocOCRText\(\)/);
  assert.match(appScript, /📋 نسخ النص/);
});

test('web UI polish stays responsive and respects reduced-motion preferences', () => {
  assert.match(appCss, /v3\.8\.29 — تحسين تجربة الويب/);
  assert.match(appCss, /html\.web #view\{width:100%;max-width:1500px;margin-inline:auto\}/);
  assert.match(appCss, /@media screen and \(max-width:520px\)/);
  assert.match(appCss, /prefers-reduced-motion:reduce/);
});

test('mobile header brand remains readable on the dark navigation surface', () => {
  assert.match(appCss, /\.mobtop \.mobhead-brand b\{color:#f8f5ed\}/);
  assert.match(appCss, /\.mobtop \.mobhead-brand span\{color:#d8bd58\}/);
});

test('Arabic club dashboard is built from existing football-school records', () => {
  assert.match(html, /lang="ar" dir="rtl"/);
  assert.match(html, /ملعبنا — نظام إدارة النادي ومدرسة كرة القدم/);
  assert.match(appScript, /إدارة النادي والمدرسة/);
  assert.match(appScript, /برمجة تدريب/);
  assert.match(appScript, /إضافة مباراة/);
  assert.match(appScript, /function dashboardTrainingTableHTML\(rows\)/);
  assert.match(appScript, /function dashboardMatchTableHTML\(rows\)/);
  assert.match(appScript, /dashboardRecentPlayersHTML\(\)/);
  assert.match(appScript, /function validDbShape\(x\).*'teams','parents','coaches','players','trainings','attendance','matches','subs','evals','expenses','equip','docs','loans'/);
  assert.match(appCss, /\.dash-quick-actions\{display:grid/);
  assert.match(appCss, /@media screen and \(max-width:520px\)/);
});

test('form dialogs contain keyboard focus and close on Escape', () => {
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="mTitle"/);
  assert.match(appScript, /if\(e\.key==='Escape'\)\{closeModal\(\);return;\}/);
  assert.match(appScript, /if\(e\.shiftKey&&active===first\)\{e\.preventDefault\(\);last\.focus\(\);\}/);
  assert.match(appScript, /else if\(!e\.shiftKey&&active===last\)\{e\.preventDefault\(\);first\.focus\(\);\}/);
});

test('form dialogs warn before discarding edits but skip the prompt after saving', () => {
  assert.match(appScript, /function closeModal\(force\)\{if\(installmentPaymentBusy\|\|\(modalSaveBusy&&force!==true\)\)return;if\(mFormDirty&&force!==true&&!confirm\(/);
  assert.match(appScript, /bind\('mBody','input',markModalDirty\)/);
  assert.match(appScript, /if\(await save\(\)\)\{closeModal\(true\);render\(\);/);
  assert.match(appScript, /لديك تغييرات غير محفوظة/);
});

test('required-field validation is announced inline and marks the invalid control', () => {
  assert.match(html, /id="mError" class="modal-error" role="alert" aria-live="assertive" hidden/);
  assert.match(appScript, /function showModalError\(message,el\)/);
  assert.match(appScript, /showModalError\('يرجى إدخال الحقل المطلوب: '\+f\.l,el\)/);
  assert.match(appScript, /el\.setAttribute\('aria-invalid','true'\)/);
  assert.match(appScript, /bind\('mBody','input',clearModalFieldError\)/);
  const saveBlock = appScript.match(/^async function saveModal\(\)\{[\s\S]*?^\}/m);
  assert.ok(saveBlock);
  assert.doesNotMatch(saveBlock[0], /alert\(/, 'save validation errors remain inside the dialog');
  assert.match(saveBlock[0], /showModalError\(feeErrors\[calculation\.error\]/);
});

test('required player documents are selectable and trigger missing-document alerts', () => {
  for (const label of ['الموافقة المكتوبة', 'وثيقة J6', 'استمارة التسجيل']) {
    assert.match(appScript, new RegExp(label));
  }
  assert.match(appScript, /const REQDOCS=\['شهادة طبية','عقد التسجيل','الموافقة المكتوبة','وثيقة J6','استمارة التسجيل'\]/);
  assert.match(appScript, /const DOCC=\[[^\]]*'الموافقة المكتوبة'[^\]]*'وثيقة J6'[^\]]*'استمارة التسجيل'/);
  assert.match(appScript, /const FILECATS=\[[^\]]*'الموافقة المكتوبة'[^\]]*'وثيقة J6'[^\]]*'استمارة التسجيل'/);
});

test('missing document alerts let administrators open the player attachment form', () => {
  assert.match(appScript, /playerId:p\.id,st:'مفقودة'/);
  assert.match(appScript, /function docAlertActionHTML\(row\)/);
  assert.match(appScript, /openForm\('players',row\.playerId\)/);
  assert.doesNotMatch(appScript, /class="tag "'\+x\.cls/, 'alert tag class remains well-formed');
  assert.match(appScript, /إبلاغ المدير/);
});

test('modal controls stack above the mobile navigation and toast', () => {
  assert.match(appCss, /\.ov\{z-index:120\}/);
  assert.match(appCss, /#syncToast\{[^}]*z-index:99/);
  assert.match(appCss, /\.mobile-bottom-nav\{[^}]*z-index:70/);
});

test('the modal save button has only one active handler', () => {
  assert.match(appScript, /function setModalSaveAction\(action,label\)\{[\s\S]*?b\.onclick=async function\(\)/);
  assert.doesNotMatch(appScript, /bind\('modalSaveBtn','click',saveModal\)/);
});

test('registration fees are bundled and monthly dues start the next month', () => {
  assert.match(appScript, /registrationFeeBundleNotice/);
  assert.match(appScript, /const refreshKind=function\(\)/);
  assert.match(appScript, /registrationBase\+\(alreadyMonthly\?0:monthly\)/);
  assert.match(appScript, /subscriptionStartsOn=subscriptionStartForMonth/);
  assert.match(appScript, /تبدأ الاستحقاقات الشهرية الدورية من بداية الشهر التالي/);
  assert.doesNotMatch(appScript, /اشتراك الشهر الأول|الشهر الأول|f_includeFirstMonth/);
  const saveBlock=appScript.match(/^async function saveModal\(\)\{[\s\S]*?^\}/m);
  assert.ok(saveBlock);
  assert.match(saveBlock[0], /isMonthlyPeriodBeforeStart/);
  assert.doesNotMatch(saveBlock[0], /firstMonthSubscription/);
  const helper = appScript.match(/^function monthlyFeeForPlayer\(player\)\{[^\n]*\}/m);
  assert.ok(helper, 'monthly fee uses the same fee fallback as monthly generation');
  const context = vm.createContext({db:{teams:[{id:'team-1',fee:120}],settings:{fee:80}}});
  vm.runInContext(helper[0]+'\nglobalThis.feeForPlayer=monthlyFeeForPlayer;',context);
  assert.equal(context.feeForPlayer({id:'p1',team:'team-1',fee:90}),90);
  assert.equal(context.feeForPlayer({id:'p2',team:'team-1',fee:0}),120);
  assert.equal(context.feeForPlayer({id:'p3',team:'missing',fee:0}),80);
});

test('receipt WhatsApp action shares a PDF file and provides a download fallback', () => {
  assert.match(appScript, /async function receiptPDFBlob\(documentSnapshot\)/);
  assert.match(appScript, /MalaabnaReceipts\.createPDF/);
  assert.match(appScript, /new File\(\[pdf\],filename,\{type:'application\/pdf'\}\)/);
  assert.match(appScript, /navigator\.share\(\{title:receiptLabel\(x\.s\),text:text,files:\[file\]\}\)/);
  assert.match(appScript, /downloadReceiptPdf\(pdf,filename\)/);
  assert.match(appScript, /إرسال PDF عبر واتساب/);
});

test('initial page does not eagerly load the OCR engine or large model assets', () => {
  assert.doesNotMatch(html, /<script[^>]+(?:ocr\/|tesseract)/i);
  assert.doesNotMatch(bootstrap, /ocr\/|tesseract/i);
});

test('login UI scripts are external and remain compatible with strict CSP', () => {
  assert.match(login, /script-src 'self'/);
  assert.match(login, /<script src="login\.js" defer><\/script>/);
  assert.doesNotMatch(login, /\bon(?:click|submit|change|input)=/i);
  assert.match(login, /id="formLogin"/);
  assert.match(login, /id="lu"/);
  assert.match(login, /id="lp"/);
  assert.match(login, /id="formReg"/);
  assert.doesNotMatch(login, /method=["']GET["']/i);
});

test('dark green dashboard styling preserves the existing dynamic application shell', () => {
  assert.match(appCss, /--text:#f8fafc/);
  assert.match(appCss, /--blue:#10b981/);
  assert.match(appCss, /:root\[data-theme="light"\]/);
  assert.match(appCss, /\.nav button\.on/);
  assert.match(appCss, /#vaultScreen form/);
  assert.match(html, /id="nav"/);
  assert.match(html, /id="mainContent"/);
  assert.match(html, /id="view"/);
});

test('theme toggle uses delegated actions and persists only a display preference', () => {
  assert.match(html, /data-theme="dark"/);
  assert.match(bootstrap, /localStorage\.getItem\('fsm_ui_theme'\)/);
  assert.match(appScript, /function toggleAppTheme\(\)/);
  assert.match(appScript, /actionAttr\('click',toggleAppTheme\)/);
  assert.match(appScript, /localStorage\.setItem\('fsm_ui_theme',next\)/);
});

test('theme toggle switches color mode and updates its accessible control state', () => {
  const getTheme = appScript.match(/^function appTheme\(\)\{.*$/m);
  const toggleTheme = appScript.match(/^function toggleAppTheme\(\)\{[\s\S]*?^\}/m);
  assert.ok(getTheme && toggleTheme, 'theme functions exist');
  let theme = 'dark';
  let stored = null;
  const icon = { textContent: '' };
  const button = {
    attrs: {},
    title: '',
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelector() { return icon; },
  };
  const context = vm.createContext({
    document: {
      documentElement: {
        getAttribute() { return theme; },
        setAttribute(name, value) { if (name === 'data-theme') theme = value; },
      },
      querySelector() { return button; },
    },
    localStorage: { setItem(key, value) { stored = [key, value]; } },
  });
  vm.runInContext(getTheme[0] + '\n' + toggleTheme[0] + '\nglobalThis.toggleTheme = toggleAppTheme;', context);
  context.toggleTheme();
  assert.equal(theme, 'light');
  assert.deepEqual(stored, ['fsm_ui_theme', 'light']);
  assert.equal(button.attrs['aria-pressed'], 'true');
  assert.equal(button.title, 'التبديل إلى الوضع الداكن');
  assert.equal(icon.textContent, '🌙');
});

test('appearance presets are available only through the explicit member permission', () => {
  assert.match(appScript, /const PERM_APPEARANCE=\{id:'appearance'/);
  assert.match(appScript, /concat\(\[PERM_SENSITIVE,PERM_APPEARANCE\]\)/);
  assert.match(appScript, /function canChooseAppStyle\(\)\{return !!\(acctInfo&&acctInfo\.role==='admin'\)\|\|isAdmin\(\)\|\|acctPerms\(\)\.indexOf\(PERM_APPEARANCE\.id\)>=0;\}/);
  assert.match(appScript, /id:'alwiam',label:'الوئام الأخضر'/);
  assert.match(appScript, /id:'sport-blue',label:'أزرق رياضي'/);
  assert.match(appScript, /id:'violet',label:'بنفسجي'/);
  assert.match(appScript, /function appStylePickerHTML\(\)\{[\s\S]*?if\(!canChooseAppStyle\(\)\)return ''/);
  assert.match(bootstrap, /mobileUser\.permissions\.indexOf\('appearance'\)>=0/);
});

test('appearance choice is stored per account and cannot be changed without permission', () => {
  const keyFn = appScript.match(/^function appStyleStorageKey\(\)\{[\s\S]*?^\}/m);
  const setFn = appScript.match(/^function setAppStyle\(style\)\{[\s\S]*?^\}/m);
  assert.ok(keyFn && setFn, 'style storage and setter exist');
  let style = 'ams';
  const stored = [];
  const context = vm.createContext({
    acctInfo: { id: 'member-1' },
    mobileInfo: null,
    APP_STYLE_OPTIONS: [{ id: 'ams' }, { id: 'sport-blue' }],
    permission: false,
    document: {
      documentElement: {
        setAttribute(name, value) { if (name === 'data-style') style = value; },
      },
    },
    localStorage: { setItem(key, value) { stored.push([key, value]); } },
  });
  vm.runInContext('function canChooseAppStyle(){return permission;}\n' + keyFn[0] + '\n' + setFn[0] + '\nglobalThis.chooseStyle = setAppStyle;', context);
  assert.equal(context.chooseStyle('sport-blue'), false);
  assert.equal(style, 'ams');
  assert.deepEqual(stored, []);
  context.permission = true;
  assert.equal(context.chooseStyle('sport-blue'), true);
  assert.equal(style, 'sport-blue');
  assert.deepEqual(stored, [['fsm_ui_style_user_member-1', 'sport-blue']]);
});
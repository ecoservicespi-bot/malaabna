'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || __dirname;
const finance = require(path.join(root, 'malaabna-app/finance.js'));
const appSource = fs.readFileSync(path.join(root, 'malaabna-app/app.js'), 'utf8');

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = appSource.indexOf('\n}', start);
  assert.ok(end >= 0, `unterminated ${name}`);
  return appSource.slice(start, end + 2);
}
const MONTHS = ['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر'];
const PAY = ['🟢 مؤدى','🟠 أداء جزئي','🔴 غير مؤدى','⚪ معفى'];
function ctx(reg = 150, fee = 100) {
  let id = 0;
  const c = vm.createContext({
    db: { settings: { registrationFee: reg, fee }, teams: [], players: [], subs: [], audit: [] },
    MalaabnaFinance: finance, roundCurrency: finance.roundCurrency,
    money: (v) => `${v} درهم`, uid: () => `generated-${++id}`,
    nextReceiptNumber: () => 'R-2026-001', todayISO: () => '2026-10-31', MONTHS, PAY,
  });
  vm.runInContext(`${functionSource('monthlyFeeForPlayer')}\n${functionSource('subscriptionStartForMonth')}\n${functionSource('subscriptionStartForRecord')}\n${functionSource('monthPeriodStart')}\n${functionSource('isMonthlyPeriodBeforeStart')}\n${functionSource('playerRegistrationFeeCalculation')}\n${functionSource('createPlayerRegistrationFee')}`, c);
  return c;
}
function run(c, expr, value) { c.input = value; return JSON.parse(JSON.stringify(vm.runInContext(expr, c))); }
let n = 0; const ok = (label, fn) => { n++; fn(); console.log(`PASS ${n}. ${label}`); };
const baseVals = { discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'لا', exemptReason: '' };

// 3.8.61 bundled record, October registration
ok('3.8.61 bundled record: 150 + 100 = 250, start 2026-11-01, no includedFirstMonth', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p1", input, new Date("2026-10-31T12:00:00Z"))', baseVals);
  assert.equal(r.ok, true); assert.equal(r.record.baseDue, 250); assert.equal(r.record.registrationFeeBase, 150);
  assert.equal(r.record.due, 250); assert.equal(r.record.month, 'أكتوبر'); assert.equal(r.record.year, 2026);
  assert.equal(r.record.subscriptionStartsOn, '2026-11-01'); assert.equal('includedFirstMonth' in r.record, false);
  assert.equal(r.record.kind, 'رسوم التسجيل');
});
// Year boundary
ok('December registration starts 2027-01-01', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p1", input, new Date("2026-12-15T12:00:00Z"))', baseVals);
  assert.equal(r.record.subscriptionStartsOn, '2027-01-01');
});
// Backdated registration
ok('Backdated registration 2026-08-15: month August, start 2026-09-01', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p1", input, new Date("2026-10-31T12:00:00Z"))', { ...baseVals, registrationDate: '2026-08-15' });
  assert.equal(r.record.month, 'غشت'); assert.equal(r.record.subscriptionStartsOn, '2026-09-01');
});
// 3.8.59 discount / exemption rules
ok('3.8.59 fixed discount 25 with reason: due 225', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p2", input, new Date("2026-10-31T12:00:00Z"))', { discountType: 'مبلغ ثابت', discountValue: '25', discountReason: 'منحة اجتماعية', exempt: 'لا', exemptReason: '' });
  assert.equal(r.record.discountAmount, 25); assert.equal(r.record.due, 225);
});
ok('Discount without reason is rejected', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p2", input, new Date("2026-10-31T12:00:00Z"))', { discountType: 'مبلغ ثابت', discountValue: '10', discountReason: '', exempt: 'لا', exemptReason: '' });
  assert.equal(r.ok, false); assert.equal(r.error, 'discount_reason_required');
});
ok('Full discount without exemption is rejected', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p2", input, new Date("2026-10-31T12:00:00Z"))', { discountType: 'مبلغ ثابت', discountValue: '250', discountReason: 'كامل', exempt: 'لا', exemptReason: '' });
  assert.equal(r.ok, false); assert.equal(r.error, 'full_discount_requires_exemption');
});
ok('Exemption with discount 20: due 0, exemption 230, exempt state, receipt reference', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p3", input, new Date("2026-10-31T12:00:00Z"))', { discountType: 'مبلغ ثابت', discountValue: '20', discountReason: 'موافقة الإدارة', exempt: 'نعم', exemptReason: 'حالة اجتماعية' });
  assert.equal(r.record.due, 0); assert.equal(r.record.discountAmount, 20); assert.equal(r.record.exemptionAmount, 230);
  assert.equal(r.record.state, PAY[3]); assert.equal(r.record.rec, 'R-2026-001');
});
ok('Exemption without reason is rejected', () => {
  const c = ctx(); const r = run(c, 'createPlayerRegistrationFee("p3", input, new Date("2026-10-31T12:00:00Z"))', { discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'نعم', exemptReason: '' });
  assert.equal(r.ok, false); assert.equal(r.error, 'exemption_reason_required');
});
ok('Zero configured fees: no invented charge; exemption still documented', () => {
  const c = ctx(0, 0);
  assert.equal(run(c, 'createPlayerRegistrationFee("p5", input, new Date("2026-10-31T12:00:00Z"))', baseVals).skipped, true);
  const e = run(c, 'createPlayerRegistrationFee("p5", input, new Date("2026-10-31T12:00:00Z"))', { ...baseVals, exempt: 'نعم', exemptReason: 'قرار إداري' });
  assert.equal(e.record.baseDue, 0); assert.equal(e.record.state, PAY[3]);
});
// Monthly-start blocking
ok('Monthly periods before start are blocked; start month itself is not', () => {
  const c = ctx();
  assert.equal(run(c, `isMonthlyPeriodBeforeStart('أكتوبر', 2026, {subscriptionStartsOn:'2026-11-01'})`), true);
  assert.equal(run(c, `isMonthlyPeriodBeforeStart('نونبر', 2026, {subscriptionStartsOn:'2026-11-01'})`), false);
  assert.equal(run(c, `isMonthlyPeriodBeforeStart('شتنبر', 2026, {subscriptionStartsOn:'2026-11-01'})`), true);
});
ok('Legacy includedFirstMonth records remain readable and give the same start', () => {
  const c = ctx();
  assert.equal(run(c, `subscriptionStartForRecord({includedFirstMonth:true,includedFirstMonthMonth:'أكتوبر',includedFirstMonthYear:2026})`), '2026-11-01');
  assert.equal(run(c, `isMonthlyPeriodBeforeStart('أكتوبر', 2026, {includedFirstMonth:true,includedFirstMonthMonth:'أكتوبر',includedFirstMonthYear:2026})`), true);
});
ok('genMonth and saveModal both enforce the monthly-start block (code presence)', () => {
  const gen = appSource.match(/^async function genMonth\(\)\{[\s\S]*?^\}/m); assert.ok(gen && /isMonthlyPeriodBeforeStart/.test(gen[0]));
  const save = appSource.match(/^async function saveModal\(\)\{[\s\S]*?^\}/m); assert.ok(save && /isMonthlyPeriodBeforeStart/.test(save[0]));
});
ok('Manual registration-fee form avoids double-counting an existing monthly record (code presence)', () => {
  assert.match(appSource, /alreadyMonthly/);
  assert.match(appSource, /يوجد سجل شهري لهذا اللاعب في الفترة المحددة؛ سيُحتسب رسم التسجيل فقط/);
});
// Receipt labels
ok('Registration receipt label carries no first-month reference', () => {
  const feeLabelLine = appSource.match(/^function feeLabel\(s\)\{.*$/m)[0];
  assert.ok(feeLabelLine.includes("'رسوم التسجيل'"));
  assert.ok(!/الشهر الأول/.test(appSource));
});
// Installment split of the bundled record
ok('Bundled 250 / discount 25 splits into 3 instalments summing to 250 / 225 / 25', () => {
  const split = finance.splitRegistrationFee({ kind: 'رسوم التسجيل', baseDue: 250, discountType: 'مبلغ ثابت', discountValue: 25, discountReason: 'منحة', exempt: 'لا', paid: 0 }, 3, (() => { let i = 0; return () => `id-${++i}`; })());
  assert.equal(split.ok, true); assert.equal(split.records.length, 3);
  assert.equal(split.records.reduce((s, r) => s + r.baseDue, 0), 250);
  assert.equal(split.records.reduce((s, r) => s + r.due, 0), 225);
  assert.equal(split.records.reduce((s, r) => s + r.discountAmount, 0), 25);
  assert.ok(split.records.every((r, i) => r.registrationInstallment === i + 1 && r.registrationPlanId === split.planId));
});
ok('Instalment split rejects exempt records and counts other than 2 or 3', () => {
  assert.equal(finance.splitRegistrationFee({ kind: 'رسوم التسجيل', baseDue: 250, exempt: 'نعم', exemptReason: 'x', paid: 0 }, 2, () => 'x').error, 'installments_unavailable');
  assert.equal(finance.splitRegistrationFee({ kind: 'رسوم التسجيل', baseDue: 250, exempt: 'لا', paid: 0 }, 4, () => 'x').error, 'invalid_installment_count');
});
// Version and web-sync consistency
ok('Version is consistent: app, server and TWA are 3.8.61 / 30861', () => {
  assert.equal(require(path.join(root, 'malaabna-app/package.json')).version, '3.8.61');
  assert.equal(require(path.join(root, 'server/package.json')).version, '3.8.61');
  const twa = require(path.join(root, 'android/twa-manifest.json'));
  assert.equal(twa.appVersion, '3.8.61'); assert.equal(twa.appVersionCode, 30861);
});
ok('Web copy matches source: app.js and app.css are identical', () => {
  assert.equal(fs.readFileSync(path.join(root, 'malaabna-app/app.js'), 'utf8'), fs.readFileSync(path.join(root, 'server/public/app/app.js'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, 'malaabna-app/app.css'), 'utf8'), fs.readFileSync(path.join(root, 'server/public/app/app.css'), 'utf8'));
});
console.log(`\nQA scenarios: ${n} passed, 0 failed`);

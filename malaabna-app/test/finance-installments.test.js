const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const finance = require('../finance.js');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('salary advance splits exactly to cents and keeps the final remainder', () => {
  const result = finance.splitAdvanceAmount(100.01, 3);
  assert.deepEqual(result, {
    ok: true,
    total: 100.01,
    amounts: [33.33, 33.34, 33.34],
  });
  assert.equal(Math.round(result.amounts.reduce((sum, value) => sum + value, 0) * 100) / 100, result.total);
});

test('salary advance splitting rejects invalid counts and amounts', () => {
  assert.equal(finance.splitAdvanceAmount(50, 1).error, 'invalid_installment_count');
  assert.equal(finance.splitAdvanceAmount(0.01, 2).error, 'installment_amount_too_small');
  assert.equal(finance.splitAdvanceAmount(-10, 3).error, 'invalid_amount');
});

test('monthly advance dates preserve the day and cap at month end', () => {
  assert.deepEqual(
    finance.monthlyInstallmentDates('2026-01-31', 3),
    { ok: true, dates: ['2026-01-31', '2026-02-28', '2026-03-31'] },
  );
  assert.deepEqual(
    finance.monthlyInstallmentDates('2024-01-31', 3),
    { ok: true, dates: ['2024-01-31', '2024-02-29', '2024-03-31'] },
  );
});

test('monthly advance dates reject impossible calendar dates', () => {
  assert.equal(finance.monthlyInstallmentDates('2026-02-30', 2).error, 'invalid_start_date');
});

test('the app exposes local document framing and salary advance plan actions', () => {
  assert.match(app, /function docCropOpen\(index\)/);
  assert.match(app, /actionAttr\('click',\(\)=>docCropOpen\(i\)\)/);
  assert.match(app, /function docCameraOpen\(\)/);
  assert.match(app, /function docCameraDetect\(/);
  assert.match(app, /function docCameraCapture\(/);
  assert.match(app, /التقاط تلقائي عند الثبات/);
  assert.match(app, /function docScanEditorOpen\(index\)/);
  assert.match(app, /MalaabnaScanner\.rectifyRgba/);
  assert.match(app, /capture\.takePhoto\(\)/);
  assert.match(app, /function openSalaryAdvancePlan\(\)/);
  assert.match(app, /غير محدد — جدولة مرنة/);
  assert.match(app, /function openAdvanceReschedule\(planId\)/);
  assert.match(app, /salaryAdvancePlanId:plan\.id/);
  assert.match(app, /salaryAdvances/);
  assert.match(app, /x\.status!=='في انتظار الأداء'/);
});
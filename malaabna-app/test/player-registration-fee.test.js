const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const finance = require('../finance.js');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = appSource.indexOf('\n}', start);
  assert.ok(end >= 0, `unterminated ${name}`);
  return appSource.slice(start, end + 2);
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const PAY = ['🟢 مؤدى', '🟠 أداء جزئي', '🔴 غير مؤدى', '⚪ معفى'];

function feeContext(registrationFee = 150, monthlyFee = 100) {
  let id = 0;
  const context = vm.createContext({
    db: { settings: { registrationFee, fee: monthlyFee }, teams: [], players: [], subs: [], audit: [] },
    MalaabnaFinance: finance,
    roundCurrency: finance.roundCurrency,
    money: (value) => `${value} درهم`,
    uid: () => `generated-${++id}`,
    nextReceiptNumber: () => 'R-2026-001',
    todayISO: () => '2026-10-31',
    MONTHS,
    PAY,
  });
  vm.runInContext(`${functionSource('monthlyFeeForPlayer')}\n${functionSource('subscriptionStartForMonth')}\n${functionSource('playerRegistrationFeeCalculation')}\n${functionSource('createPlayerRegistrationFee')}`, context);
  return context;
}

function jsonInContext(context, expression, value) {
  context.input = value;
  return JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
}

test('new player registration creates a separate full-price registration fee record', () => {
  const context = feeContext();
  const result = jsonInContext(context, 'createPlayerRegistrationFee("player-1", input, new Date("2026-10-31T12:00:00Z"))', {
    discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'لا', exemptReason: '',
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.player, 'player-1');
  assert.equal(result.record.kind, 'رسوم التسجيل');
  assert.equal(result.record.baseDue, 250);
  assert.equal(result.record.registrationFeeBase, 150);
  assert.equal(result.record.registrationFeeBase, 150);
  assert.equal(result.record.subscriptionStartsOn, '2026-11-01');
  assert.equal('includedFirstMonth' in result.record, false);
  assert.equal(result.record.discountAmount, 0);
  assert.equal(result.record.due, 250);
  assert.equal(result.record.paid, 0);
  assert.equal(result.record.state, PAY[2]);
  assert.equal(result.record.month, 'أكتوبر');
  assert.equal(result.record.year, 2026);
});

test('new-player form exposes discount, exemption and a live fee estimate', () => {
  assert.match(appSource, /function playerRegistrationFeeFieldsHTML\(\)/);
  assert.match(appSource, /إعفاء من رسوم التسجيل/);
  assert.match(appSource, /إجمالي رسوم التسجيل/);
  assert.match(appSource, /تبدأ الاستحقاقات الشهرية الدورية من بداية الشهر التالي/);
  assert.doesNotMatch(appSource, /اشتراك الشهر الأول|الشهر الأول/);
  assert.match(appSource, /سبب الخصم/);
  assert.match(appSource, /سبب الإعفاء/);
  assert.match(appSource, /playerRegistrationFeeEstimate/);
  assert.match(appSource, /if\(coll==='players'&&!id\)[\s\S]*playerRegistrationFeeFieldsHTML\(\)/);
});

test('fixed discount is recorded with its reason and lowers the amount due', () => {
  const context = feeContext();
  const result = jsonInContext(context, 'createPlayerRegistrationFee("player-2", input, new Date("2026-10-31T12:00:00Z"))', {
    discountType: 'مبلغ ثابت', discountValue: '25', discountReason: 'منحة اجتماعية', exempt: 'لا', exemptReason: '',
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.discountValue, 25);
  assert.equal(result.record.discountAmount, 25);
  assert.equal(result.record.discountReason, 'منحة اجتماعية');
  assert.equal(result.record.baseDue, 250);
  assert.equal(result.record.due, 225);
  assert.equal(result.record.state, PAY[2]);
});

test('included first-month period follows the player registration date', () => {
  const context = feeContext();
  const result = jsonInContext(context, 'createPlayerRegistrationFee("player-2", input, new Date("2026-10-31T12:00:00Z"))', {
    discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'لا', exemptReason: '', registrationDate: '2026-08-15',
  });
  assert.equal(result.record.month, 'غشت');
  assert.equal(result.record.subscriptionStartsOn, '2026-09-01');
});

test('exemption creates a zero-due financial record and a receipt reference', () => {
  const context = feeContext();
  const result = jsonInContext(context, 'createPlayerRegistrationFee("player-3", input, new Date("2026-10-31T12:00:00Z"))', {
    discountType: 'مبلغ ثابت', discountValue: '20', discountReason: 'موافقة الإدارة', exempt: 'نعم', exemptReason: 'حالة اجتماعية',
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.due, 0);
  assert.equal(result.record.discountAmount, 20);
  assert.equal(result.record.exemptionAmount, 230);
  assert.equal(result.record.state, PAY[3]);
  assert.equal(result.record.date, '2026-10-31');
  assert.equal(result.record.rec, 'R-2026-001');
});

test('discount and exemption reasons plus full-discount rule are validated', () => {
  const context = feeContext();
  const cases = [
    [{ discountType: 'مبلغ ثابت', discountValue: '10', discountReason: '', exempt: 'لا', exemptReason: '' }, 'discount_reason_required'],
    [{ discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'نعم', exemptReason: '' }, 'exemption_reason_required'],
    [{ discountType: 'مبلغ ثابت', discountValue: '250', discountReason: 'كامل', exempt: 'لا', exemptReason: '' }, 'full_discount_requires_exemption'],
  ];
  for (const [values, expectedError] of cases) {
    const result = jsonInContext(context, 'createPlayerRegistrationFee("player-4", input, new Date("2026-10-31T12:00:00Z"))', values);
    assert.equal(result.ok, false);
    assert.equal(result.error, expectedError);
  }
});

test('no configured fee does not invent a charge; exemption can still be documented', () => {
  const context = feeContext(0, 0);
  const skipped = jsonInContext(context, 'createPlayerRegistrationFee("player-5", input, new Date("2026-10-31T12:00:00Z"))', {
    discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'لا', exemptReason: '',
  });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.skipped, true);
  const exempt = jsonInContext(context, 'createPlayerRegistrationFee("player-5", input, new Date("2026-10-31T12:00:00Z"))', {
    discountType: 'بدون', discountValue: '0', discountReason: '', exempt: 'نعم', exemptReason: 'قرار إداري',
  });
  assert.equal(exempt.ok, true);
  assert.equal(exempt.record.baseDue, 0);
  assert.equal(exempt.record.state, PAY[3]);
});

test('recurring billing begins at the next month boundary and legacy records remain compatible', () => {
  const monthGenerator = appSource.match(/^async function genMonth\(\)\{[\s\S]*?^\}/m);
  assert.ok(monthGenerator);
  assert.match(monthGenerator[0], /isMonthlyPeriodBeforeStart/);
  const saveBlock = appSource.match(/^async function saveModal\(\)\{[\s\S]*?^\}/m);
  assert.ok(saveBlock);
  assert.match(saveBlock[0], /isMonthlyPeriodBeforeStart/);
  const context = feeContext();
  vm.runInContext(`${functionSource('subscriptionStartForRecord')}\n${functionSource('monthPeriodStart')}\n${functionSource('isMonthlyPeriodBeforeStart')}`, context);
  assert.equal(jsonInContext(context, `isMonthlyPeriodBeforeStart('أكتوبر', 2026, {subscriptionStartsOn:'2026-11-01'})`), true);
  assert.equal(jsonInContext(context, `isMonthlyPeriodBeforeStart('نونبر', 2026, {subscriptionStartsOn:'2026-11-01'})`), false);
  assert.equal(jsonInContext(context, `isMonthlyPeriodBeforeStart('أكتوبر', 2026, {includedFirstMonth:true,includedFirstMonthMonth:'أكتوبر',includedFirstMonthYear:2026})`), true);
});

test('saving a new player stores the player and fee together; failed save rolls both back', async () => {
  const saveBlock = appSource.match(/^async function saveModal\(\)\{[\s\S]*?^\}/m);
  assert.ok(saveBlock, 'saveModal exists');

  async function runSave(shouldSave, useExemption = false) {
    let ids = 0;
    const fields = {
      f_name: { value: 'لاعب جديد' },
      // Explicit registration date: saveModal's fee creation falls back to the
      // real calendar date without it, so the expected 2026-11-01 start only
      // held when the test ran in October.
      f_reg: { value: '2026-10-31' },
      f_registrationDiscountType: { value: 'مبلغ ثابت' },
      f_registrationDiscountValue: { value: '15' },
      f_registrationDiscountReason: { value: 'خصم عائلي' },
      f_registrationExempt: { value: useExemption ? 'نعم' : 'لا' },
      f_registrationExemptReason: { value: useExemption ? 'موافقة الإدارة' : '' },
    };
    const effects = { saves: 0, errors: [], closes: 0 };
    const context = vm.createContext({
      SCHEMA: { players: { label: 'اللاعبون', title: 'name', fields: [{ k: 'name', l: 'الاسم الكامل', t: 'text', req: 1 }] } },
      db: { settings: { registrationFee: 150, fee: 100, receiptSeq: 4 }, teams: [], players: [], subs: [], audit: [] },
      mColl: 'players', mId: null, mFiles: [],
      document: { getElementById: (id) => fields[id] || null },
      MalaabnaFinance: finance,
      isAdmin: () => true,
      clearModalError: () => {},
      showModalError: (message) => effects.errors.push(message),
      dailyDuplicateCheck: () => true,
      uid: () => `id-${++ids}`,
      nextReceiptNumber: () => { context.db.settings.receiptSeq++; return 'R-' + context.db.settings.receiptSeq; },
      todayISO: () => '2026-10-31',
      MONTHS, PAY,
      roundCurrency: finance.roundCurrency,
      money: (value) => `${value} درهم`,
      auditAdd: (action, details) => context.db.audit.unshift({ id: `audit-${ids}`, action, details }),
      save: async () => { effects.saves++; return shouldSave; },
      closeModal: () => { effects.closes++; },
      render: () => {},
      idbGC: () => {},
      waAutoThxAfterSave: () => {},
      effects,
    });
    vm.runInContext(`${functionSource('monthlyFeeForPlayer')}\n${functionSource('playerRegistrationFeeValues')}\n${functionSource('playerRegistrationFeeCalculation')}\n${functionSource('createPlayerRegistrationFee')}\n${saveBlock[0]}`, context);
    await vm.runInContext('saveModal()', context);
    return { context, effects };
  }

  const success = await runSave(true);
  assert.equal(success.context.db.players.length, 1);
  assert.equal(success.context.db.subs.length, 1);
  assert.equal(success.context.db.subs[0].player, success.context.db.players[0].id);
  assert.equal(success.context.db.subs[0].due, 235);
  assert.equal(success.context.db.subs[0].subscriptionStartsOn, '2026-11-01');
  assert.equal('includedFirstMonth' in success.context.db.subs[0], false);
  assert.equal(success.context.db.subs[0].kind, 'رسوم التسجيل');
  assert.equal(success.effects.saves, 1);
  assert.equal(success.effects.closes, 1);

  const failure = await runSave(false, true);
  assert.equal(failure.context.db.players.length, 0);
  assert.equal(failure.context.db.subs.length, 0);
  assert.equal(failure.context.db.settings.receiptSeq, 4);
  assert.equal(failure.effects.saves, 1);
  assert.equal(failure.effects.closes, 0);
});
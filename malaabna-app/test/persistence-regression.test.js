const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const finance = require('../finance');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, name);
  const first = source.slice(start).split('\n')[0];
  return first.endsWith('}') && (first.match(/{/g) || []).length === (first.match(/}/g) || []).length
    ? first : source.slice(start, source.indexOf('\n}', start) + 2);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(persist) {
  const effects = { schedules: 0, closed: 0, renders: 0, errors: [], writes: [], fetches: 0 };
  const field = { value: 'لاعب تجريبي', disabled: false };
  const button = { disabled: false };
  const context = vm.createContext({
    fixture: { settings: { registrationFee: 0 }, players: [], subs: [], receipts: [], audit: [], expenses: [], salaryAdvances: [] },
    MalaabnaFinance: finance,
    roundCurrency: finance.roundCurrency,
    effects, field, button, Promise,
    console: { error() {}, warn() {} },
    window: { persistMalaabnaDb: text => { effects.writes.push(text); return persist(text); } },
    document: {
      getElementById: id => id === 'ov' ? { classList: { contains: () => true } } : (String(id).startsWith('f_registration') ? null : field),
      querySelector: () => button, querySelectorAll: () => [field],
    },
    syncSchedule: () => effects.schedules++,
    showModalError: message => effects.errors.push(message),
    syncToast: message => effects.errors.push(message),
    closeModal: () => effects.closed++, render: () => effects.renders++,
    idbGC() {}, isAdmin: () => true,
    syncReady: () => true, setSyncMsg: message => effects.errors.push(message),
    setCloudStatus() {}, setCloudFailure() {},
    fetch: () => { effects.fetches++; throw new Error('Unexpected network request'); },
  });
  vm.runInContext(`
    let db=fixture,durableDbSnapshot=JSON.stringify(db),dbWriteQueue=Promise.resolve(),pendingDbWrites=0,dbWriteFailed=false;
    let mColl='players',mId=null,modalSaveBusy=false,serial=0,syncBusy=false;
    const SCHEMA={players:{title:'name',label:'لاعب',fields:[{k:'name',l:'الاسم',t:'text',req:true}]}};
    const uid=()=>String(++serial);
    const auditAdd=(action,details)=>db.audit.unshift({id:'audit-'+serial,action,details});
    const advancePayments=plan=>db.expenses.filter(row=>row.salaryAdvancePlanId===plan.id);
    ${['persistDbSnapshot', 'reportPersistenceError', 'waitForLocalPersistence', 'save',
      'dailyNormalize', 'dailyPhone', 'dailyDuplicates', 'dailyDuplicateCheck', 'playerRegistrationFeeValues',
      'monthlyFeeForPlayer', 'playerRegistrationFeeCalculation', 'createPlayerRegistrationFee', 'saveModal',
      'setModalSaveAction', 'saveAdvanceReschedule', 'cloudPush'].map(fn).join('\n')}
  `, context);
  return { effects, field, button, run: code => vm.runInContext(code, context) };
}

test('save resolves success and schedules synchronization only after disk confirmation', async () => {
  const disk = deferred(), f = fixture(() => disk.promise);
  const result = f.run('db.players.push({id:"p1"});save()');
  await Promise.resolve();
  assert.equal(f.effects.schedules, 0);
  assert.equal(f.run('pendingDbWrites'), 1);
  disk.resolve();
  assert.equal(await result, true);
  assert.equal(f.effects.schedules, 1);
  assert.equal(f.run('pendingDbWrites'), 0);
});
for (const synchronous of [false, true]) {
  test('failed storage rolls back and never schedules upload, synchronous=' + synchronous, async () => {
    const f = fixture(() => {
      if (synchronous) throw new Error('disk full');
      return Promise.reject(new Error('disk full'));
    });
    assert.equal(await f.run('db.players.push({id:"p1"});save()'), false);
    assert.equal(f.run('db.players.length'), 0);
    assert.equal(f.effects.schedules, 0);
    assert.equal(f.effects.errors.length, 1);
    assert.equal(f.run('pendingDbWrites'), 0);
    await assert.rejects(f.run('waitForLocalPersistence()'), /الحفظ المحلي/);
    await f.run('cloudPush(false)');
    assert.equal(f.effects.fetches, 0);
  });
}
test('form failure retains input and open modal; retry creates one record and one audit entry', async () => {
  let fail = true;
  const f = fixture(() => fail ? Promise.reject(new Error('disk full')) : Promise.resolve());
  await f.run('saveModal()');
  assert.equal(f.effects.closed, 0);
  assert.equal(f.effects.renders, 0);
  assert.equal(f.field.value, 'لاعب تجريبي');
  assert.equal(f.run('db.players.length'), 0);
  assert.equal(f.run('db.audit.length'), 0);
  fail = false;
  await f.run('saveModal()');
  assert.equal(f.run('db.players.length'), 1);
  assert.equal(f.run('db.audit.length'), 1);
  assert.equal(f.effects.closed, 1);
  assert.equal(f.effects.schedules, 1);
});
test('modal handler disables controls and blocks repeat clicks until storage completes', async () => {
  const disk = deferred(), f = fixture(() => disk.promise);
  f.run('setModalSaveAction(saveModal,"حفظ")');
  const saving = f.button.onclick();
  await f.button.onclick();
  assert.equal(f.field.disabled, true);
  assert.equal(f.effects.closed, 0);
  disk.resolve();
  await saving;
  assert.equal(f.run('db.players.length'), 1);
  assert.equal(f.effects.writes.length, 1);
  assert.equal(f.field.disabled, false);
  assert.equal(f.button.disabled, false);
});
test('persistence queue serializes writes and recovers after a failed write', async () => {
  const first = deferred();
  let calls = 0;
  const f = fixture(() => ++calls === 1 ? first.promise : Promise.resolve());
  const a = f.run('db.settings.test="first";persistDbSnapshot()');
  const b = f.run('db.settings.test="second";persistDbSnapshot()');
  // Attach the rejection handler before releasing the intentionally failed write.
  const rejected = assert.rejects(a, /disk full/);
  first.reject(new Error('disk full'));
  await rejected;
  await b;
  assert.equal(f.effects.writes.length, 2);
  assert.equal(f.run('JSON.parse(durableDbSnapshot).settings.test'), 'second');
  assert.equal(f.run('dbWriteFailed'), false);
  await f.run('waitForLocalPersistence()');
});
test('reschedule retry resolves current database records after rollback, not detached row objects', async () => {
  let fail = true;
  const f = fixture(() => fail ? Promise.reject(new Error('disk full')) : Promise.resolve());
  f.field.value = '2026-11-01';
  f.run(`
    db.salaryAdvances=[{id:'plan1',coachName:'اختبار',startDate:'2026-10-28'}];
    db.expenses=[{id:'e1',salaryAdvancePlanId:'plan1',date:'2026-10-28',status:'في انتظار الأداء'}];
    durableDbSnapshot=JSON.stringify(db);
    const originalRows=db.expenses.slice();
  `);
  await f.run('saveAdvanceReschedule("plan1",originalRows)');
  assert.equal(f.run('db.expenses[0].date'), '2026-10-28');
  assert.equal(f.effects.closed, 0);
  fail = false;
  await f.run('saveAdvanceReschedule("plan1",originalRows)');
  assert.equal(f.run('db.expenses[0].date'), '2026-11-01');
  assert.equal(f.run('db.audit.length'), 1);
  assert.equal(f.effects.closed, 1);
});
test('two-device correction merge is blocked before database or attachments are changed', async () => {
  const original = { id: 'original', rec: 'R-00001-1111111111111111' };
  const make = (id, rec) => ({ id, rec, correction: { sourceId: 'original', sourceRec: original.rec } });
  const left = { settings: {}, receipts: [original, make('left', 'R-00002-2222222222222222')] };
  const remote = { settings: {}, receipts: [original, make('remote', 'R-00002-3333333333333333')] };
  const context = vm.createContext({
    MalaabnaFinance: finance, left, remote,
    waitForLocalPersistence: async () => {}, syncSnapshotLoad: () => null,
    idbGet: () => { throw new Error('Attachments must not be touched on conflict'); },
  });
  vm.runInContext(`let db=left;${source.match(/^const SYNC_COLLS=.*$/m)[0]}
    ${['stableStr', 'recHash', 'mergeDb', 'syncMerge'].map(fn).join('\n')}`, context);
  const before = vm.runInContext('JSON.stringify(db)', context);
  const merge = vm.runInContext('mergeDb(left,remote,null)', context);
  assert.equal(merge.receiptConflicts.length, 1);
  await assert.rejects(vm.runInContext('syncMerge({db:remote,files:{test:"data"}})', context),
    error => error.code === 'receipt_correction_conflict' && error.message.includes('R-00002-3333333333333333'));
  assert.equal(vm.runInContext('JSON.stringify(db)', context), before);
});
test('linear correction histories merge without being mistaken for competing branches', () => {
  assert.equal(finance.receiptCorrectionConflicts([
    { id: 'original' },
    { id: 'one', correction: { sourceId: 'original' } },
    { id: 'two', correction: { sourceId: 'one' } },
  ]).length, 0);
});
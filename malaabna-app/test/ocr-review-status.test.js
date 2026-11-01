const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { TextEncoder } = require('node:util');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^(?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, name);
  const first = source.slice(start).split('\n')[0];
  return first.endsWith('}') && (first.match(/{/g) || []).length === (first.match(/}/g) || []).length
    ? first : source.slice(start, source.indexOf('\n}', start) + 2);
}
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function baseDb() {
  return { settings: { school: 'اختبار', syncCode: 'QATEST01', syncSecret: 'synthetic-only',
    serverUrl: 'http://127.0.0.1', syncBase: '2026-10-28T10:00:00Z' },
  players: [{ id: 'p1', name: 'اسم قديم' }], attendance: [], receipts: [], audit: [], syncLog: [] };
}
function syncFixture() {
  const requested = deferred(), response = deferred();
  const effects = { writes: [], uploads: [], phases: [], schedules: 0, bases: [], messages: [] };
  const context = vm.createContext({
    fixture: baseDb(), effects, crypto: webcrypto, TextEncoder,
    console: { error() {}, warn() {} },
    window: { persistMalaabnaDb: async text => effects.writes.push(text) },
    document: { getElementById: () => null },
    fetch: async (_url, request) => {
      effects.uploads.push(JSON.parse(request.body)); requested.resolve();
      return response.promise;
    },
    idbAll: async () => ({}), deviceName: () => 'QA-device',
    syncApiUrl: p => 'http://127.0.0.1' + p, syncAuthBody: extra => extra,
    syncReady: () => true, syncOn: () => true,
    syncToast: text => effects.messages.push(text), setSyncMsg: text => effects.messages.push(text),
    syncSnapshotSave: snapshot => effects.bases.push(snapshot),
    syncLogAdd() {},
  });
  vm.runInContext(`
    let db=fixture,durableDbSnapshot=JSON.stringify(db),dbWriteQueue=Promise.resolve(),pendingDbWrites=0,dbWriteFailed=false;
    let cloudStatusPhase='idle',cloudStatusNote='',syncBusy=false,mobileInfo=null,mobileAttendanceBusy=false;
    function refreshAppStatus(){effects.phases.push(cloudStatusPhase);}
    function syncSchedule(){if(!syncBusy)effects.schedules++;}
    ${['stableStr','syncComparable','syncDigest','syncConnectionKey','storageStatusModel','setCloudStatus','setCloudFailure','resetPartialSyncStatus',
      'markSyncAcknowledged','persistDbSnapshot','reportPersistenceError','waitForLocalPersistence',
      'save','dbForUpload','cloudPush','refreshAttendanceSyncPanel','mobileAttendancePush'].map(fn).join('\n')}
  `, context);
  return {
    effects, run: code => vm.runInContext(code, context), requested: requested.promise,
    respond: (status = 200, body = { ok: true, updatedAt: '2026-10-28T11:00:00Z' }) =>
      response.resolve({ ok: status >= 200 && status < 300, status, json: async () => body }),
  };
}
test('status model distinguishes locked, saving, failed, local, syncing, conflict and acknowledged states', () => {
  const f = syncFixture();
  const model = state => f.run(`storageStatusModel(${JSON.stringify({ authenticated: true, ...state })})`);
  assert.equal(model({ authenticated: false, failed: true }).state, 'locked');
  assert.equal(model({ pending: 1 }).state, 'saving');
  assert.equal(model({ failed: true, pending: 1, synced: true }).state, 'error');
  assert.equal(model({}).state, 'local');
  assert.equal(model({ phase: 'syncing' }).state, 'syncing');
  assert.equal(model({ phase: 'error' }).state, 'warning');
  assert.equal(model({ phase: 'conflict' }).state, 'conflict');
  assert.equal(model({ synced: true, at: 'test time' }).state, 'synced');
  assert.match(model({ phase: 'attendance', synced: true }).label, /الحضور فقط/);
  assert.match(model({ online: false }).detail, /لا يوجد اتصال/);
});
test('SHA-256 comparison ignores local connection and acknowledgement metadata, not business changes', async () => {
  const f = syncFixture();
  const before = await f.run('syncDigest(db)');
  assert.match(before, /^[a-f0-9]{64}$/);
  f.run('db.settings.syncLast="later";db.settings.syncSecret="changed";db.settings._localSyncAck={digest:"test",at:"test"};db.syncLog.push({action:"test"});');
  assert.equal(await f.run('syncDigest(db)'), before);
  f.run('db.players[0].name="اسم أحدث"');
  assert.notEqual(await f.run('syncDigest(db)'), before);
});
test('full upload acknowledges exactly its sent snapshot and strips device-local status', async () => {
  const f = syncFixture();
  f.run('db.settings._localSyncAck={digest:"old",at:"old"};');
  const sending = f.run('cloudPush(true)');
  await f.requested;
  assert.equal(f.effects.uploads[0].db.settings._localSyncAck, undefined);
  assert.equal(f.effects.uploads[0].db.settings.syncSecret, undefined);
  f.respond();
  await sending;
  assert.equal(await f.run('syncDigest(db)'), f.run('db.settings._localSyncAck.digest'));
  assert.equal(f.run('cloudStatusPhase'), 'idle');
  const stored = JSON.parse(f.effects.writes.at(-1));
  assert.equal(stored.settings._localSyncAck.digest, f.run('db.settings._localSyncAck.digest'));
  assert.equal(f.effects.bases[0].players[0].name, 'اسم قديم');
});
test('edits saved while an upload is in flight remain pending, preserve the correct merge base and get scheduled again', async () => {
  const f = syncFixture();
  const sending = f.run('cloudPush(true)');
  await f.requested;
  f.run('db.players[0].name="اسم أحدث أثناء الرفع";');
  await f.run('save()');
  f.respond();
  await sending;
  assert.equal(f.run('db.players[0].name'), 'اسم أحدث أثناء الرفع');
  assert.equal(f.effects.uploads[0].db.players[0].name, 'اسم قديم');
  assert.equal(f.effects.bases[0].players[0].name, 'اسم قديم');
  assert.notEqual(await f.run('syncDigest(db)'), f.run('db.settings._localSyncAck.digest'));
  assert.ok(f.effects.schedules > 0);
  assert.ok(f.effects.messages.some(message => message.includes('تعديلات أحدث')));
});
test('server failure or receipt conflict never creates a successful synchronization acknowledgement', async () => {
  for (const conflict of [false, true]) {
    const f = syncFixture();
    const sending = f.run('cloudPush(true)');
    await f.requested;
    f.respond(conflict ? 409 : 500, { ok: false, code: conflict ? 'receipt_correction_conflict' : 'server_error', message: 'اختبار فشل' });
    await sending;
    assert.equal(f.run('db.settings._localSyncAck'), undefined);
    assert.equal(f.run('cloudStatusPhase'), conflict ? 'conflict' : 'error');
    assert.equal(f.effects.uploads.length, 1);
  }
});
test('changing destination during an upload cannot acknowledge the new workspace or overwrite its merge version', async () => {
  const f = syncFixture();
  const sending = f.run('cloudPush(true)');
  await f.requested;
  f.run('db.settings.serverUrl="https://different.example";db.settings.syncCode="OTHER001";');
  await f.run('save()');
  f.respond();
  await sending;
  assert.equal(f.run('db.settings._localSyncAck'), undefined);
  assert.equal(f.run('db.settings.syncBase'), '2026-10-28T10:00:00Z');
  assert.ok(f.effects.messages.some(message => message.includes('لم يُسجل تأكيد')));
});
test('a stored acknowledgement is bound to its destination and account scope', async () => {
  const f = syncFixture();
  await f.run('markSyncAcknowledged(db,"2026-10-28T11:00:00Z")');
  assert.equal(f.run('db.settings._localSyncAck.connection===syncConnectionKey()'), true);
  f.run('db.settings.syncCode="OTHER001"');
  assert.equal(f.run('db.settings._localSyncAck.connection===syncConnectionKey()'), false);
});
test('canonical comparison is stable across object-key order and a remote acknowledgement cannot cover newer local data', async () => {
  const f = syncFixture();
  f.run('const remote=JSON.parse(JSON.stringify(db));db.players[0].name="محلي فقط";');
  await f.run('markSyncAcknowledged(remote,"2026-10-28T11:00:00Z")');
  assert.notEqual(await f.run('syncDigest(db)'), f.run('db.settings._localSyncAck.digest'));
  assert.equal(await f.run('syncDigest({settings:{b:2,a:1},players:[]})'),
    await f.run('syncDigest({players:[],settings:{a:1,b:2}})'));
});
test('restricted attendance confirmation never claims full database synchronization and clears on the next save', async () => {
  const f = syncFixture();
  f.run('mobileInfo={user:{role:"member",permissions:["att"]}};db.attendance=[{id:"a1",state:"حاضر"}];');
  const sending = f.run('mobileAttendancePush()');
  await f.requested;
  f.respond();
  await sending;
  assert.equal(f.run('cloudStatusPhase'), 'attendance');
  assert.equal(f.run('db.settings._localSyncAck'), undefined);
  f.run('db.attendance[0].state="غائب"');
  await f.run('save()');
  assert.equal(f.run('cloudStatusPhase'), 'idle');
});
test('attendance changed during its request stays pending instead of receiving a stale confirmation', async () => {
  const f = syncFixture();
  f.run('mobileInfo={user:{role:"member",permissions:["att"]}};db.attendance=[{id:"a1",state:"حاضر"}];');
  const sending = f.run('mobileAttendancePush()');
  await f.requested;
  f.run('db.attendance[0].state="غائب"');
  await f.run('save()');
  f.respond();
  await sending;
  assert.equal(f.run('cloudStatusPhase'), 'idle');
  assert.equal(f.run('db.settings._localSyncAck'), undefined);
});

test('attendance sends the accepted base, persists the new base, and ignores repeat clicks in flight',async()=>{
 const f=syncFixture();f.run('mobileInfo={user:{role:"member",permissions:["att"]}};db.attendance=[{id:"a1",state:"حاضر"}];');
 const sending=f.run('mobileAttendancePush()');await f.requested;
 await f.run('mobileAttendancePush()');assert.equal(f.effects.uploads.length,1);
 assert.equal(f.effects.uploads[0].baseUpdatedAt,'2026-10-28T10:00:00Z');
 f.respond();await sending;assert.equal(f.run('mobileAttendanceBusy'),false);
 assert.equal(f.run('db.settings.syncBase'),'2026-10-28T11:00:00Z');
 assert.equal(JSON.parse(f.effects.writes.at(-1)).settings.syncBase,'2026-10-28T11:00:00Z');
});
test('attendance 503 preserves local edits and base, includes request reference and never confirms success',async()=>{
 const f=syncFixture();f.run('mobileInfo={user:{role:"member",permissions:["att"]}};db.attendance=[{id:"a1",state:"حاضر"}];');
 const sending=f.run('mobileAttendancePush()');await f.requested;f.respond(503,{ok:false,code:'attendance_storage_failed',message:'فشل القرص',requestId:'qa-request-id'});await sending;
 assert.equal(f.run('cloudStatusPhase'),'error');assert.equal(f.run('db.attendance[0].state'),'حاضر');assert.equal(f.run('db.settings.syncBase'),'2026-10-28T10:00:00Z');assert.match(f.effects.messages.at(-1),/qa-request-id/);
});
test('attendance conflict does not fetch over local pending records or schedule a force retry',async()=>{
 const f=syncFixture();f.run('mobileInfo={user:{role:"member",permissions:["att"]}};db.attendance=[{id:"a1",state:"غائب"}];');
 const sending=f.run('mobileAttendancePush()');await f.requested;f.respond(409,{ok:false,code:'attendance_version_conflict',message:'تعارض'});await sending;
 assert.equal(f.run('cloudStatusPhase'),'conflict');assert.equal(f.effects.uploads.length,1);assert.equal(f.effects.schedules,0);assert.equal(f.run('db.attendance[0].state'),'غائب');
});
test('attendance rejects malformed success response and unlocks the send action',async()=>{
 const f=syncFixture();f.run('mobileInfo={user:{role:"member",permissions:["att"]}};');const sending=f.run('mobileAttendancePush()');await f.requested;f.respond(200,{ok:true});await sending;
 assert.equal(f.run('cloudStatusPhase'),'error');assert.equal(f.run('mobileAttendanceBusy'),false);assert.equal(f.run('db.settings.syncBase'),'2026-10-28T10:00:00Z');
});
test('attendance disk confirmation followed by failed local base persistence is not shown as synced',async()=>{
 const f=syncFixture();f.run('mobileInfo={user:{role:"member",permissions:["att"]}};window.persistMalaabnaDb=async()=>{throw new Error("local disk");};');const sending=f.run('mobileAttendancePush()');await f.requested;f.respond();await sending;
 assert.equal(f.run('cloudStatusPhase'),'error');assert.equal(f.run('mobileAttendanceBusy'),false);assert.equal(f.run('dbWriteFailed'),true);assert.equal(f.run('db.settings._localSyncAck'),undefined);
});

function ocrFixture() {
  const fields = {
    o_playerName: { value: 'اسم سابق', type: 'text' },
    o_birth: { value: '', type: 'date' },
    o_birthPlace: { value: '', type: 'text' },
    o_parentName: { value: 'ولي أمر سابق', type: 'text' },
    o_parentCin: { value: '', type: 'text' },
    o_address: { value: '', type: 'text' },
    o_medExp: { value: '', type: 'date' },
    docOcrText0: { value: 'الاسم الكامل: اسم مقترح\n2014-05-16\nمكان الولادة: الرباط' },
    mTitle: {}, mBody: {}, ov: { classList: { add() {} }, setAttribute() {} },
  };
  const effects = { errors: [], closed: 0, status: '', action: null };
  const file = { type: 'birth', text: 'النص القديم' };
  const context = vm.createContext({
    fields, file, effects,
    document: { getElementById: id => fields[id], activeElement: null },
    window: {}, setTimeout() {}, canPage: () => true, denied: () => assert.fail('Unexpected denial'),
    clearModalError() {}, showModalError: message => effects.errors.push(message),
    setModalSaveAction: action => { effects.action = action; },
    closeModal: () => effects.closed++, setOcrStatus: message => { effects.status = message; },
  });
  vm.runInContext(`
    let docScanFiles=[file],mColl=null,mId=null,mFormDirty=false;
    ${source.match(/^const esc=.*$/m)[0]}
    ${['normDigits','isoDate','datesIn','mrzDate','parseMRZ','afterLabel','setVal','docOCRProposals',
      'docParseOne','docOCRChanges','docApplyOCRFile','applyOCRReview'].map(fn).join('\n')}
  `, context);
  return { fields, effects, file, run: code => vm.runInContext(code, context) };
}
test('manual OCR application opens an escaped before/after preview without changing fields or source text', () => {
  const f = ocrFixture();
  f.fields.docOcrText0.value = 'الاسم الكامل: <img src=x onerror=alert(1)>\n2014-05-16';
  f.run('docApplyOCRFile(0)');
  assert.equal(f.fields.o_playerName.value, 'اسم سابق');
  assert.equal(f.file.text, 'النص القديم');
  assert.match(f.fields.mBody.innerHTML, /القيمة الحالية/);
  assert.match(f.fields.mBody.innerHTML, /القيمة المقترحة/);
  assert.match(f.fields.mBody.innerHTML, /&lt;img/);
  assert.doesNotMatch(f.fields.mBody.innerHTML, /<img src=x/);
  assert.match(f.fields.mBody.innerHTML, /id="ocrReviewPick0" type="checkbox" >/);
});
test('initial automatic OCR filling stays conservative and does not overwrite a filled field', () => {
  const f = ocrFixture();
  f.run('docParseOne({type:"birth",text:"الاسم الكامل: اسم مقترح\\n2014-05-16"})');
  assert.equal(f.fields.o_playerName.value, 'اسم سابق');
  assert.equal(f.fields.o_birth.value, '2014-05-16');
});
test('comparison ignores blank, identical and unknown proposals instead of clearing or changing fields', () => {
  const f = ocrFixture();
  assert.equal(f.run('docOCRChanges({o_playerName:"اسم سابق",o_parentName:"",unknown:"value"}).length'), 0);
});
test('OCR dates support ISO, day-first and Arabic digits without accepting impossible calendar dates', () => {
  const f = ocrFixture();
  assert.equal(f.run('datesIn("2014-05-16")[0]'), '2014-05-16');
  assert.equal(f.run('datesIn("16/05/2014")[0]'), '2014-05-16');
  assert.equal(f.run('datesIn("١٦/٠٥/٢٠١٤")[0]'), '2014-05-16');
  assert.equal(f.run('datesIn("2026-02-30 31/04/2026").length'), 0);
  assert.equal(f.run('datesIn("29/02/2024")[0]'), '2024-02-29');
});
test('only explicitly selected OCR changes replace values; unselected existing values survive', () => {
  const f = ocrFixture();
  f.run('docApplyOCRFile(0)');
  f.fields.ocrReviewPick0 = { checked: true };
  f.fields.ocrReviewPick1 = { checked: false };
  f.fields.ocrReviewPick2 = { checked: false };
  f.effects.action();
  assert.equal(f.fields.o_playerName.value, 'اسم مقترح');
  assert.equal(f.fields.o_birth.value, '');
  assert.equal(f.fields.o_parentName.value, 'ولي أمر سابق');
  assert.equal(f.effects.closed, 1);
  assert.match(f.effects.status, /نموذج التسجيل فقط/);
});
test('zero selections and removed documents are rejected without changing any field', () => {
  const f = ocrFixture();
  f.run('docApplyOCRFile(0)');
  f.effects.action();
  assert.equal(f.effects.closed, 0);
  assert.equal(f.fields.o_playerName.value, 'اسم سابق');
  f.run('docScanFiles=[]');
  f.effects.action();
  assert.equal(f.effects.errors.length, 2);
});
test('stale fields or invalid dates reject the whole selection, not just one part', () => {
  for (const invalid of [false, true]) {
    const f = ocrFixture();
    f.fields.ocrReviewPick0 = { checked: true };
    f.fields.ocrReviewPick1 = { checked: true };
    f.run(`const review={file,text:"جديد",changes:[
      {id:"o_playerName",before:"اسم سابق",after:"اسم جديد"},
      {id:"o_birth",before:${JSON.stringify(invalid ? '' : 'قيمة قديمة')},after:${JSON.stringify(invalid ? '2026-02-30' : '2014-05-16')}}
    ]};applyOCRReview(review);`);
    assert.equal(f.fields.o_playerName.value, 'اسم سابق');
    assert.equal(f.fields.o_birth.value, '');
    assert.equal(f.effects.closed, 0);
    assert.equal(f.effects.errors.length, 1);
  }
});
test('visible application version, package versions, Android and PWA cache are consistent', () => {
  const appRoot = path.join(__dirname, '..');
  const version = require('../package.json').version;
  assert.equal(version, '3.8.61');
  assert.match(source, new RegExp("const APP_VERSION='" + version.replaceAll('.', '\\.') + "'"));
  assert.match(fs.readFileSync(path.join(appRoot, 'app.html'), 'utf8'), /data-app-version/);
  assert.match(fs.readFileSync(path.join(appRoot, 'sw.js'), 'utf8'), /malaabna-v3\.8\.61-registration-fee-monthly-start/);
  assert.equal(require('../../server/package.json').version, version);
  assert.equal(require('../../android/twa-manifest.json').appVersionName, version);
  assert.equal(require('../../android/twa-manifest.json').appVersionCode, 30861);
  assert.equal(require('../../android/twa-manifest.json').appVersion, version);
});
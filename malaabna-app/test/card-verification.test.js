const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

function declaration(name,nextName){
 let start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'function '+name+' exists');
 if(source.slice(start-6,start)==='async ')start-=6;
 let end=-1;
 if(nextName){
  const plain=source.indexOf('\nfunction '+nextName+'(',start);
  const asyncFn=source.indexOf('\nasync function '+nextName+'(',start);
  end=[plain,asyncFn].filter(i=>i>=0).sort((a,b)=>a-b)[0];
  if(end===undefined)end=-1;
 }
 return source.slice(start,end<0?source.length:end).trim();
}
function constant(name){
 const start=source.indexOf('const '+name+'=');
 assert.ok(start>=0,'constant '+name+' exists');
 const end=source.indexOf(';',start);
 assert.ok(end>=0,'constant '+name+' ends');
 return source.slice(start,end+1);
}

// The verified subscription is for the current month, not a fixed October
// fixture: verifyMemberPayload() looks up MONTHS[new Date().getMonth()],
// so a fixed October record only read as "paid" when the test ran in October.
const TEST_MONTHS=['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر'];
const TEST_NOW=new Date();
const TEST_CURRENT_MONTH=TEST_MONTHS[TEST_NOW.getMonth()];
const TEST_CURRENT_YEAR=TEST_NOW.getFullYear();
const fetchCalls=[];
const context=vm.createContext({
 MONTHS:TEST_MONTHS,
 DEFAULT_SERVER:'https://sync.clubagaplus.ma',
 mobileInfo:null,
 db:{settings:{school:'مدرسة الاختبار',serverUrl:''},players:[{id:'11111111-2222-3333-4444-555555ABCDEF',name:'لاعب <تجريبي>',status:'نشط',cat:'U13',phone:'0600000000',address:'عنوان سري',birth:'2014-01-02',med:true,ins:true}],subs:[{player:'11111111-2222-3333-4444-555555ABCDEF',kind:'اشتراك شهري',month:TEST_CURRENT_MONTH,year:TEST_CURRENT_YEAR,due:150,paid:150}]},
 esc:value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 setTimeout,clearTimeout,AbortController,
 fetch:async url=>{fetchCalls.push(String(url));return {ok:true,json:async()=>({ok:true,memberId:'ABCDEF',name:'لاعب <تجريبي>',status:'نشط',category:'U13',subscription:'مسدد',school:'مدرسة الاختبار'})};},
});
const fpcStart=source.indexOf('function findPlayerByCode(');
const fpcEnd=source.indexOf('\nasync function scanRecord(',fpcStart);
assert.ok(fpcStart>=0&&fpcEnd>fpcStart,'findPlayerByCode slice found');
const helpers=[
 constant('MONTHS'),
 declaration('parseMemberQR','subscriptionStateForPlayer'),
 declaration('subscriptionStateForPlayer','verifyServerOrigin'),
 declaration('verifyServerOrigin','verifyMemberPayload'),
 declaration('verifyMemberPayload','verifyResultHTML'),
 declaration('verifyResultHTML','setScanMode'),
 source.slice(fpcStart,fpcEnd).trim(),
].join('\n');
vm.runInContext(helpers,context);

const QR='MALAABNA-MEMBER|ABCDEF|11111111-2222-3333-4444-555555ABCDEF|لاعب تجريبي|مدرسة الاختبار';

test('parses the current card format strictly and rejects lookalikes',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(`parseMemberQR('${QR}')`,context))),{memberId:'ABCDEF',playerId:'11111111-2222-3333-4444-555555ABCDEF',name:'لاعب تجريبي',school:'مدرسة الاختبار'});
 assert.equal(vm.runInContext(`parseMemberQR('  ${QR}  ')`,context).memberId,'ABCDEF');
 assert.equal(vm.runInContext(`parseMemberQR('malaabna-member|abcdef|11111111-2222-3333-4444-555555abcdef|لاعب|مدرسة')`,context),null);
 assert.equal(vm.runInContext(`parseMemberQR('MALAABNA-MEMBER|ABCDEF|11111111-2222-3333-4444-555555ABCDEF|لاعب')`,context),null);
 assert.equal(vm.runInContext(`parseMemberQR('MALAABNA-MEMBER|XYZ123|11111111-2222-3333-4444-555555ABCDEF|لاعب|مدرسة')`,context),null);
 assert.equal(vm.runInContext(`parseMemberQR('{"schema":"malaabna-card-v1"}')`,context),null);
 assert.equal(vm.runInContext(`parseMemberQR('ID: ABCDEF')`,context),null);
 assert.equal(vm.runInContext(`parseMemberQR('')`,context),null);
});
test('findPlayerByCode resolves real card payloads and keeps legacy formats',()=>{
 const found=vm.runInContext(`findPlayerByCode('${QR}')`,context);
 assert.equal(found&&found.id,'11111111-2222-3333-4444-555555ABCDEF');
 assert.equal(vm.runInContext(`findPlayerByCode('ABCDEF')`,context).id,'11111111-2222-3333-4444-555555ABCDEF');
 assert.equal(vm.runInContext(`findPlayerByCode('MALAABNA-MEMBER|ZZZZZZ|11111111-2222-3333-4444-555555ABCDEF|لاعب|مدرسة')`,context),null);
});
test('subscription state uses the current monthly record only, without amounts',()=>{
 const subs=JSON.stringify([
  {player:'p1',kind:'اشتراك شهري',month:'أكتوبر',year:2026,due:150,paid:150},
  {player:'p1',kind:'اشتراك شهري',month:'شتنبر',year:2026,due:150,paid:0},
  {player:'p1',kind:'رسوم التسجيل',month:'أكتوبر',year:2026,due:500,paid:0},
 ]);
 assert.equal(vm.runInContext(`subscriptionStateForPlayer(${subs},'p1','أكتوبر',2026)`,context),'مسدد');
 assert.equal(vm.runInContext(`subscriptionStateForPlayer(${subs},'p1','شتنبر',2026)`,context),'متبقٍ');
 assert.equal(vm.runInContext(`subscriptionStateForPlayer(${JSON.stringify([{player:'p1',kind:'اشتراك شهري',month:'أكتوبر',year:2026,due:150,paid:0,exempt:'نعم'}])},'p1','أكتوبر',2026)`,context),'معفى');
 assert.equal(vm.runInContext(`subscriptionStateForPlayer(${subs},'p2','أكتوبر',2026)`,context),'لا يوجد سجل');
});
test('server confirmation, not-found, and offline paths are distinct',async ()=>{
 fetchCalls.length=0;
 const confirmed=JSON.parse(JSON.stringify(await vm.runInContext(`verifyMemberPayload('${QR}')`,context)));
 assert.equal(confirmed.formatOk,true);
 assert.equal(confirmed.serverState,'confirmed');
 assert.equal(confirmed.server.name,'لاعب <تجريبي>');
 assert.equal(confirmed.local.subscription,'مسدد');
 assert.ok(fetchCalls[0].includes('/api/members/verify?memberId=ABCDEF&playerId=11111111-2222-3333-4444-555555ABCDEF'));
 const bad=await vm.runInContext(`verifyMemberPayload('not a card')`,context);
 assert.equal(bad.formatOk,false);
 assert.equal(bad.server,null);
});
test('verification display shows minimum fields only, escaped, with the right banner',()=>{
 const html=vm.runInContext(`verifyResultHTML({formatOk:true,parsed:{memberId:'ABCDEF'},local:{name:'لاعب <b>',memberId:'ABCDEF',status:'نشط',category:'U13',subscription:'مسدد',school:'مدرسة',phone:'0600000000',address:'عنوان',birth:'2014-01-02'},server:null,serverState:'unconfirmed',warnings:[]})`,context);
 assert.match(html,/قراءة محلية غير مؤكدة/);
 assert.match(html,/لاعب &lt;b&gt;/);
 assert.match(html,/مسدد/);
 assert.doesNotMatch(html,/0600000000|عنوان|2014-01-02|تأمين|طوارئ|فصيلة/);
 const confirmed=vm.runInContext(`verifyResultHTML({formatOk:true,parsed:{},local:null,server:{name:'لاعب',memberId:'ABCDEF',status:'نشط',category:'U13',subscription:'مسدد',school:'مدرسة'},serverState:'confirmed',warnings:[]})`,context);
 assert.match(confirmed,/مؤكد من الخادم/);
 const missing=vm.runInContext(`verifyResultHTML({formatOk:true,parsed:{},local:null,server:null,serverState:'not-found',warnings:[]})`,context);
 assert.match(missing,/غير موجود على الخادم/);
 const badFormat=vm.runInContext(`verifyResultHTML({formatOk:false})`,context);
 assert.match(badFormat,/ليست بطاقة عضوية/);
});
test('scan page wires verify mode, NFC gating, and the jsQR fallback',()=>{
 assert.match(source,/function setScanMode\(mode\)[\s\S]*?scanMode=mode==='verify'\?'verify':'attendance'/);
 assert.match(source,/function nfcSupported\(\)\{return typeof window!=='undefined'&&'NDEFReader' in window&&!!window\.isSecureContext;\}/);
 assert.match(source,/new window\.NDEFReader\(\)/);
 assert.match(source,/nfcAbort=new AbortController\(\)/);
 assert.match(source,/function stopNfcScan\(\)/);
 assert.match(source,/function stopScan\(\)\{[\s\S]*?stopNfcScan\(\)/);
 assert.match(source,/window\.jsQR\(image\.data,image\.width,image\.height/);
 assert.match(source,/function handleScannedValue\(val\)[\s\S]*?scanMode==='verify'[\s\S]*?verifyScanned\(val\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.html'),'utf8'),/<script src="vendor\/jsqr\.js" defer><\/script>/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),/'vendor\/jsqr\.js'/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/\.verify-banner\{/);
});

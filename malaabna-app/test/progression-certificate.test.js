const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

function declaration(name,nextName){
 const start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'function '+name+' exists');
 const end=nextName?source.indexOf('\nfunction '+nextName+'(',start):-1;
 return source.slice(start,end<0?source.length:end).trim();
}
function constant(name){
 const start=source.indexOf('const '+name+'=');
 assert.ok(start>=0,'constant '+name+' exists');
 const end=source.indexOf(';',start);
 assert.ok(end>=0,'constant '+name+' ends');
 return source.slice(start,end+1);
}

const context=vm.createContext({
 ATT:['🟢 حاضر','🔴 غائب','🟠 غياب مبرر','🔵 متأخر'],
 esc:value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 safeImg:value=>/^data:image\/[a-z]+;base64,/i.test(String(value||''))?value:'',
});
const helpers=[
 constant('PROGRESSION_EVAL_KEYS'),
 constant('PROGRESSION_MIN_ATTENDANCE'),
 constant('PROGRESSION_ATTENDANCE_THRESHOLD'),
 constant('PROGRESSION_EVAL_THRESHOLD'),
 constant('PROGRESSION_DISCIPLINE_THRESHOLD'),
 constant('ATT'),
 declaration('progressionStats','progressionTier'),
 declaration('progressionTier','progressionBadges'),
 declaration('progressionBadges','certificateSigners'),
 declaration('certificateSigners','certificateReadiness'),
 declaration('certificateReadiness','certificateHTML'),
 declaration('certificateHTML','progressionSection'),
].join('\n');
const fixtures=[
 "function evalAll(value,date){return {player:'p1',date:date||'2026-10-01',period:'شهري',speed:value,drib:value,pass:value,shoot:value,ctrl:value,fit:value,disc:value,tw:value};}",
 "function attRows(present,late,absent,excused){const rows=[];for(let i=0;i<present;i++)rows.push({player:'p1',state:'🟢 حاضر'});for(let i=0;i<late;i++)rows.push({player:'p1',state:'🔵 متأخر'});for(let i=0;i<absent;i++)rows.push({player:'p1',state:'🔴 غائب'});for(let i=0;i<excused;i++)rows.push({player:'p1',state:'🟠 غياب مبرر'});return rows;}",
].join('\n');
vm.runInContext(helpers+'\n'+fixtures,context);
const signers={school:'مدرسة الوئام لكرة القدم',presidentName:'الرئيس التجريبي',coachName:'المدرب التجريبي'};

test('attendance rate counts present and late, excludes excused absence, and never divides by zero',()=>{
 const stats=vm.runInContext(`progressionStats([evalAll(8)],attRows(4,1,0,5),'p1')`,context);
 assert.equal(stats.attendanceCount,10);
 assert.equal(stats.attendanceRate,50);
 const empty=vm.runInContext(`progressionStats([],[],'p1')`,context);
 assert.equal(empty.attendanceRate,null);
 assert.equal(empty.evalAvg,null);
 assert.equal(empty.sufficient,false);
 assert.ok(empty.insufficientReasons.some(r=>/لا يوجد أي تقييم/.test(r)));
});
test('insufficient-data gate needs five attendance records and one evaluation',()=>{
 const few=vm.runInContext(`progressionStats([evalAll(9)],attRows(4,0,0,0),'p1')`,context);
 assert.equal(few.sufficient,false);
 const enough=vm.runInContext(`progressionStats([evalAll(9)],attRows(5,0,0,0),'p1')`,context);
 assert.equal(enough.sufficient,true);
 assert.equal(enough.attendanceRate,100);
});
test('evaluation average uses the latest evaluation and clamps all eight rates to 0-10',()=>{
 const stats=vm.runInContext(`progressionStats([evalAll(10,'2026-01-01'),{player:'p1',date:'2026-09-01',speed:15,drib:-2,pass:8,shoot:8,ctrl:8,fit:8,disc:8,tw:8}],attRows(5,0,0,0),'p1')`,context);
 assert.equal(stats.evalAvg,7.3);
 assert.equal(stats.rates.speed,10);
 assert.equal(stats.rates.drib,0);
});
test('badges follow the approved thresholds and never appear on insufficient data',()=>{
 const stats=vm.runInContext(`progressionStats([evalAll(8)],attRows(9,0,1,0),'p1')`,context);
 assert.deepEqual([...vm.runInContext('progressionBadges('+JSON.stringify(stats)+')',context).map(b=>b.id)],['attendance','eval','discipline']);
 const below=vm.runInContext(`progressionStats([evalAll(7)],attRows(8,0,1,0),'p1')`,context);
 assert.equal(below.attendanceRate,89);
 assert.equal(vm.runInContext('progressionBadges('+JSON.stringify(below)+')',context).length,0);
 const thin=vm.runInContext(`progressionStats([evalAll(10)],attRows(4,0,0,0),'p1')`,context);
 assert.equal(vm.runInContext('progressionBadges('+JSON.stringify(thin)+')',context).length,0);
});
test('tier is a single consistent string derived from the evaluation average',()=>{
 assert.equal(vm.runInContext('progressionTier(8)',context),'ممتاز');
 assert.equal(vm.runInContext('progressionTier(7)',context),'جيد جدًا');
 assert.equal(vm.runInContext('progressionTier(6)',context),'جيد');
 assert.equal(vm.runInContext('progressionTier(5)',context),'مقبول');
 assert.equal(vm.runInContext('progressionTier(4.9)',context),'قيد التطور');
 assert.equal(vm.runInContext('progressionTier(null)',context),null);
});
test('certificate issuance is refused until data and both signatory names exist',()=>{
 const ready=vm.runInContext(`certificateReadiness({id:'p1',name:'لاعب'},progressionStats([evalAll(8)],attRows(5,0,0,0),'p1'),${JSON.stringify(signers)})`,context);
 assert.equal(ready.ready,true);
 const noNames=vm.runInContext(`certificateReadiness({id:'p1',name:'لاعب'},progressionStats([evalAll(8)],attRows(5,0,0,0),'p1'),{school:'مدرسة'})`,context);
 assert.equal(noNames.ready,false);
 assert.ok(noNames.reasons.some(r=>/اسم الرئيس/.test(r)));
 assert.ok(noNames.reasons.some(r=>/اسم المدرب/.test(r)));
 const noSchool=vm.runInContext(`certificateReadiness({id:'p1',name:'لاعب'},progressionStats([evalAll(8)],attRows(5,0,0,0),'p1'),{presidentName:'أ',coachName:'ب'})`,context);
 assert.equal(noSchool.ready,false);
 const thin=vm.runInContext(`certificateReadiness({id:'p1',name:'لاعب'},progressionStats([],attRows(5,0,0,0),'p1'),${JSON.stringify(signers)})`,context);
 assert.equal(thin.ready,false);
 const defaults=JSON.parse(JSON.stringify(vm.runInContext(`certificateSigners({presidentName:' أ ',coachName:' ب '})`,context)));
 assert.deepEqual(defaults,{presidentName:'أ',presidentRole:'رئيس النادي',coachName:'ب',coachRole:'مدرب'});
});
test('certificate shows only real numbers, escapes names, and carries no sensitive data',()=>{
 const stats=vm.runInContext(`progressionStats([evalAll(8)],attRows(9,0,1,0),'p1')`,context);
 const html=vm.runInContext(`certificateHTML({id:'p1',name:'لاعب <تجريبي>',cat:'U13'},${JSON.stringify(stats)},${JSON.stringify(signers)},'2026-10-30')`,context);
 assert.match(html,/شهادة تطور رياضي/);
 assert.match(html,/لاعب &lt;تجريبي&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/90%/);
 assert.match(html,/8 \/ 10/);
 assert.match(html,/الرئيس التجريبي/);
 assert.match(html,/المدرب التجريبي/);
 assert.match(html,/ممتاز/);
 assert.doesNotMatch(html,/فصيلة|طوارئ|تأمين/);
 assert.doesNotMatch(html,/MALAABNA-MEMBER/);
});
test('progression section, certificate view, and signatory settings are wired into the app',()=>{
 assert.match(source,/function cardsPage\(\)[\s\S]*?if\(certificatePrintId\)[\s\S]*?certificateHTML\(player,stats,db\.settings,todayISO\(\)\)/);
 assert.match(source,/showcaseCardSection\(\)\+progressionSection\(\)/);
 assert.match(source,/function issueCertificate\(playerId\)[\s\S]*?if\(!isAdmin\(\)\)\{denied\(\);return;\}[\s\S]*?auditAdd\('إصدار شهادة تطور رياضي'/);
 assert.match(source,/function saveCertificateSigners\(\)[\s\S]*?presidentName[\s\S]*?coachName[\s\S]*?auditAdd\('تحديث موقّعي الشهادات'/);
 assert.match(source,/موقّعو الشهادات الرسمية/);
 assert.match(source,/f\('presidentName','اسم الرئيس'\)/);
 assert.match(source,/f\('coachName','اسم المدرب'\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/\.certificate-sheet\{/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/@media print\{[\s\S]*?\.certificate-sheet\{/);
});

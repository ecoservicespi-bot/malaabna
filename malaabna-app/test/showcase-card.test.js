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
function multiConstant(name){
 const start=source.indexOf('const '+name+'=');
 assert.ok(start>=0,'constant '+name+' exists');
 const end=source.indexOf('\n];',start);
 assert.ok(end>=0,'constant '+name+' ends');
 return source.slice(start,end+2);
}

const qrTexts=[];
const context=vm.createContext({
 db:{settings:{school:'مدرسة الاختبار',schoolFr:'Test School',logo:''},teams:[{id:'t1',name:'فريق أ',cat:'U13'}],evals:[],attendance:[]},
 esc:value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 safeImg:value=>/^data:image\/[a-z]+;base64,/i.test(String(value||''))?value:'',
 qrBox:text=>{qrTexts.push(String(text));return '<span class="qr-data">QR</span>';},
});
const helpers=[
 constant('MEMBER_CARD_FIELDS'),
 constant('MEMBER_CARD_PALETTES'),
 constant('MEMBER_CARD_DEFAULT'),
 constant('ATT'),
 multiConstant('SHOWCASE_MATERIALS'),
 constant('SHOWCASE_RADAR_KEYS'),
 declaration('normalizeMemberCardDesign','memberCardDate'),
 declaration('memberCardDate','memberCardHTML'),
 declaration('showcaseLatestEval','showcaseEvalValues'),
 declaration('showcaseEvalValues','showcaseAttendanceRate'),
 declaration('showcaseAttendanceRate','showcaseTraits'),
 declaration('showcaseTraits','showcaseRadarSVG'),
 declaration('showcaseRadarSVG','showcaseCardHTML'),
 declaration('showcaseCardHTML','showcaseCardSection'),
].join('\n');
vm.runInContext(helpers,context);

const EVALS=[
 {player:'player-ABC123',date:'2025-01-01',speed:4,drib:5,pass:6,shoot:5,ctrl:5,fit:6,disc:5,tw:5},
 {player:'player-ABC123',date:'2025-06-01',speed:12,drib:8,pass:9,shoot:7,ctrl:8,fit:9,disc:9,tw:8},
 {player:'p2',date:'2025-06-01',speed:6,drib:6,pass:6,shoot:6,ctrl:6,fit:6,disc:6,tw:6},
];
const ATTENDANCE=[
 {player:'player-ABC123',state:'🟢 حاضر'},{player:'player-ABC123',state:'🟢 حاضر'},{player:'player-ABC123',state:'🔵 متأخر'},{player:'player-ABC123',state:'🔴 غائب'},
];

test('showcase radar uses only the latest real eval, clamped to 0-10, and nothing when there is no eval',()=>{
 const latest=vm.runInContext('showcaseLatestEval('+JSON.stringify(EVALS)+',"player-ABC123")',context);
 assert.equal(latest.date,'2025-06-01');
 const values=vm.runInContext('showcaseEvalValues(showcaseLatestEval('+JSON.stringify(EVALS)+',"player-ABC123"))',context);
 assert.deepEqual(JSON.parse(JSON.stringify(values.values)),[10,8,9,7,8,9]);
 assert.equal(values.avg,8.5);
 assert.equal(vm.runInContext('showcaseLatestEval('+JSON.stringify(EVALS)+',"p9")',context),null);
 assert.equal(vm.runInContext('showcaseEvalValues(null)',context),null);
});

test('showcase attendance rate counts present and late, and returns null without records',()=>{
 assert.equal(vm.runInContext('showcaseAttendanceRate('+JSON.stringify(ATTENDANCE)+',"player-ABC123")',context),75);
 assert.equal(vm.runInContext('showcaseAttendanceRate('+JSON.stringify(ATTENDANCE)+',"p9")',context),null);
});

test('showcase traits are computed labels only, with no invented numbers',()=>{
 const traits=vm.runInContext('showcaseTraits({med:true,ins:true},'+JSON.stringify(EVALS[1])+',95)',context);
 assert.deepEqual(JSON.parse(JSON.stringify(traits)),['تقييم ممتاز','انضباط عالٍ','حضور منتظم','الشهادة الطبية والتأمين مسجلان']);
 const empty=vm.runInContext('showcaseTraits({med:false,ins:false},null,null)',context);
 assert.deepEqual(JSON.parse(JSON.stringify(empty)),[]);
});

test('showcase card is separate from the official card and shows real data or an explicit no-data note',()=>{
 context.player={id:'player-ABC123',name:'لاعب <تجريبي>',birth:'2014-01-02',birthplace:'الرباط',cat:'U13',address:'',reg:'2025-09-01',status:'نشط',pos:'وسط',shirt:10,team:'t1',photo:''};
 const html=vm.runInContext('showcaseCardHTML(player,{material:"unknown",flipped:true,showRadar:true,evals:'+JSON.stringify(EVALS)+',attendance:'+JSON.stringify(ATTENDANCE)+'})',context);
 assert.match(html,/class="showcase-scene"/);
 assert.match(html,/showcase-flipper is-flipped/);
 assert.match(html,/showcase-mat-toty/);
 assert.doesNotMatch(html,/member-card/);
 assert.doesNotMatch(html,/mcard/);
 assert.match(html,/&lt;تجريبي&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/showcase-radar/);
 assert.match(html,/8\.5\/10/);
 assert.match(html,/بطاقة عرض فقط/);
 assert.match(html,/لا يوجد توقيع محفوظ في هذه الجلسة/);
 assert.match(html,/نسبة الحضور 75%/);
 assert.ok(qrTexts.some(t=>t.startsWith('MALAABNA-MEMBER|ABC123|player-ABC123')));
 const noEval=vm.runInContext('showcaseCardHTML(player,{material:"gold",evals:[],attendance:[]})',context);
 assert.match(noEval,/showcase-mat-gold/);
 assert.doesNotMatch(noEval,/showcase-radar/);
 assert.match(noEval,/لا توجد تقييمات بعد — لن تُعرض أرقام وهمية/);
 const sig='data:image/png;base64,iVBORw0KGgo=';
 const withSig=vm.runInContext('showcaseCardHTML(player,{signature:"'+sig+'",evals:[],attendance:[]})',context);
 assert.match(withSig,/showcase-signature/);
 const badSig=vm.runInContext('showcaseCardHTML(player,{signature:"javascript:alert(1)",evals:[],attendance:[]})',context);
 assert.doesNotMatch(badSig,/javascript:/);
});

test('showcase styles, controls, and session-only signature are present and hidden from print',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8');
 assert.match(css,/\.showcase-scene\{[^}]*perspective:1200px/);
 assert.match(css,/\.showcase-flipper\.is-flipped\{[^}]*rotateY\(180deg\)/);
 assert.match(css,/\.showcase-mat-gold\{/);
 assert.match(css,/\.showcase-mat-carbon\{/);
 assert.match(css,/\.showcase-mat-diamond\{/);
 assert.match(css,/\.showcase-mat-championship\{/);
 assert.match(css,/\.showcase-photo:not\(\.showcase-photo-empty\)\{[^}]*rotate\(var\(--member-photo-rotate,0deg\)\)[^}]*scaleX\(var\(--member-photo-flip,1\)\)/);
 assert.match(css,/\.showcase-photo:not\(\.showcase-photo-empty\)\{[^}]*filter:brightness\(var\(--member-photo-brightness,1\)\) contrast\(var\(--member-photo-contrast,1\)\)/);
 assert.match(css,/\.showcase-section\{display:none!important\}/);
 assert.match(source,/showcaseCardSection\(\)/);
 assert.match(source,/خامة البطاقة/);
 assert.match(source,/قلب البطاقة/);
 assert.match(source,/إظهار مخطط التقييم/);
 assert.match(source,/function showcaseSignOpen\(\)/);
 assert.match(source,/showcaseSignature=canvas\.toDataURL\('image\/png'\)/);
 assert.match(source,/لا يُحفظ في قاعدة البيانات ولا يظهر على البطاقة الرسمية/);
 const signFn=declaration('showcaseSignOpen','appTheme');
 assert.doesNotMatch(signFn,/saveMemberCardDesign|db\./);
 const cardFn=declaration('showcaseCardHTML','showcaseCardSection');
 assert.doesNotMatch(cardFn,/save\(\)|saveMemberCardDesign/);
});

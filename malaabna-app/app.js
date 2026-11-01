/* ==== QR code generator (byte mode, EC=M) ==== */
/* Minimal QR generator: byte mode, EC level M, versions 1..10 */
var QRGEN=(function(){
var EXP=[],LOG=[];(function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}EXP[255]=1;})();
function mul(a,b){if(!a||!b)return 0;return EXP[(LOG[a]+LOG[b])%255];}
function genPoly(n){var g=[1];for(var i=0;i<n;i++){var ng=new Array(g.length+1);for(var k=0;k<ng.length;k++)ng[k]=0;for(var j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=mul(g[j],EXP[i]);}g=ng;}return g;}
function rs(data,ec){var g=genPoly(ec),res=data.slice();for(var k=0;k<ec;k++)res.push(0);
 for(var i=0;i<data.length;i++){var c=res[i];if(!c)continue;for(var j=0;j<g.length;j++)res[i+j]^=mul(g[j],c);}
 return res.slice(data.length);}
var TB={1:[10,1,16,0,0],2:[16,1,28,0,0],3:[26,1,44,0,0],4:[18,2,32,0,0],5:[24,2,43,0,0],6:[16,4,27,0,0],7:[18,4,31,0,0],8:[22,2,38,2,39],9:[22,3,36,2,37],10:[26,4,43,1,44]};
var ALIGN={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
function utf8(s){var out=[];for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);
 if(c<0x80)out.push(c);
 else if(c<0x800){out.push(0xc0|(c>>6),0x80|(c&63));}
 else if(c>=0xd800&&c<0xdc00&&i+1<s.length){var c2=s.charCodeAt(++i);var cp=0x10000+((c-0xd800)<<10)+(c2-0xdc00);out.push(0xf0|(cp>>18),0x80|((cp>>12)&63),0x80|((cp>>6)&63),0x80|(cp&63));}
 else {out.push(0xe0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));}}
 return out;}
function bitLen(x){var n=0;while(x){n++;x>>>=1;}return n;}
function fmtBits(mask){var data=(0<<3)|mask;
 var rem=data<<10;while(bitLen(rem)-1>=10)rem^=0x537<<(bitLen(rem)-1-10);
 return ((data<<10)|rem)^0x5412;}
function verBits(v){var rem=v<<12;while(bitLen(rem)-1>=12)rem^=0x1f25<<(bitLen(rem)-1-12);return (v<<12)|rem;}
function build(text){
 var bytes=utf8(text),v=0;
 for(var t=1;t<=10;t++){var tb0=TB[t];var dcw=tb0[1]*tb0[2]+tb0[3]*tb0[4];var cb0=(t<10)?8:16;
  if(4+cb0+8*bytes.length<=dcw*8){v=t;break;}}
 if(!v){v=10;var maxb=Math.floor(((TB[10][1]*TB[10][2]+TB[10][3]*TB[10][4])*8-20)/8);bytes=bytes.slice(0,maxb);}
 var tb=TB[v],cb=(v<10)?8:16,dcwTotal=tb[1]*tb[2]+tb[3]*tb[4];
 var bits=[];function push(val,n){for(var i=n-1;i>=0;i--)bits.push((val>>i)&1);}
 push(4,4);push(bytes.length,cb);for(var i=0;i<bytes.length;i++)push(bytes[i],8);
 var cap=dcwTotal*8;var term=Math.min(4,cap-bits.length);push(0,term);
 while(bits.length%8)bits.push(0);
 var dat=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[i+j];dat.push(b);}
 var pads=[0xEC,0x11],pi=0;while(dat.length<dcwTotal)dat.push(pads[pi++%2]);
 var blocks=[],ecs=[],pos=0;
 function addBlocks(cnt,len){for(var i=0;i<cnt;i++){var d=dat.slice(pos,pos+len);pos+=len;blocks.push(d);ecs.push(rs(d,tb[0]));}}
 addBlocks(tb[1],tb[2]);if(tb[3])addBlocks(tb[3],tb[4]);
 var final=[],maxLen=Math.max(tb[2],tb[4]||0);
 for(var i=0;i<maxLen;i++)for(var b=0;b<blocks.length;b++)if(i<blocks[b].length)final.push(blocks[b][i]);
 for(var i=0;i<tb[0];i++)for(var b=0;b<ecs.length;b++)final.push(ecs[b][i]);
 return {v:v,cw:final};
}
function matrix(text){
 var r=build(text),v=r.v,cw=r.cw,n=17+4*v;
 var m=[],res=[];for(var i=0;i<n;i++){var a1=[],a2=[];for(var j=0;j<n;j++){a1.push(false);a2.push(false);}m.push(a1);res.push(a2);}
 function finder(row,col){for(var y=-1;y<=7;y++)for(var x=-1;x<=7;x++){var rr=row+y,cc=col+x;if(rr<0||cc<0||rr>=n||cc>=n)continue;
  var dark=(y>=0&&y<=6&&(x===0||x===6))||(x>=0&&x<=6&&(y===0||y===6))||(x>=2&&x<=4&&y>=2&&y<=4);
  m[rr][cc]=dark;res[rr][cc]=true;}}
 finder(0,0);finder(0,n-7);finder(n-7,0);
 for(var i=8;i<n-8;i++){var d=(i%2===0);m[6][i]=d;res[6][i]=true;m[i][6]=d;res[i][6]=true;}
 var al=ALIGN[v];
 for(var a=0;a<al.length;a++)for(var b=0;b<al.length;b++){var cy=al[a],cx=al[b];
  if((cy<=8&&cx<=8)||(cy<=8&&cx>=n-9)||(cy>=n-9&&cx<=8))continue;
  for(var y=-2;y<=2;y++)for(var x=-2;x<=2;x++){m[cy+y][cx+x]=(Math.max(Math.abs(x),Math.abs(y))!==1);res[cy+y][cx+x]=true;}}
 m[n-8][8]=true;res[n-8][8]=true;
 for(var i=0;i<9;i++){if(!res[8][i]){res[8][i]=true;m[8][i]=false;}if(!res[i][8]){res[i][8]=true;m[i][8]=false;}}
 for(var i=0;i<8;i++){if(!res[8][n-1-i]){res[8][n-1-i]=true;m[8][n-1-i]=false;}if(!res[n-1-i][8]){res[n-1-i][8]=true;m[n-1-i][8]=false;}}
 if(v>=7){var vb=verBits(v);
  for(var i=0;i<18;i++){var bit=((vb>>i)&1)===1;var aa=Math.floor(i/3),bb=i%3;
   m[aa][n-11+bb]=bit;res[aa][n-11+bb]=true;m[n-11+bb][aa]=bit;res[n-11+bb][aa]=true;}}
 var bitsArr=[];for(var i=0;i<cw.length;i++)for(var j=7;j>=0;j--)bitsArr.push((cw[i]>>j)&1);
 var idx=0,up=true;
 for(var col=n-1;col>0;col-=2){ if(col===6)col--;
  for(var k=0;k<n;k++){var row=up?(n-1-k):k;
   for(var c=0;c<2;c++){var cc=col-c;
    if(res[row][cc])continue;
    m[row][cc]=idx<bitsArr.length?bitsArr[idx++]===1:false;}}
  up=!up;}
 function maskFn(mk,row,col){switch(mk){
  case 0:return (row+col)%2===0;case 1:return row%2===0;case 2:return col%3===0;
  case 3:return (row+col)%3===0;case 4:return (Math.floor(row/2)+Math.floor(col/3))%2===0;
  case 5:return ((row*col)%2)+((row*col)%3)===0;case 6:return (((row*col)%2)+((row*col)%3))%2===0;
  default:return (((row+col)%2)+((row*col)%3))%2===0;}}
 function apply(mk){var out=[];for(var y=0;y<n;y++){var rowArr=[];for(var x=0;x<n;x++){var val=m[y][x];
   if(!res[y][x]&&maskFn(mk,y,x))val=!val;rowArr.push(val);}out.push(rowArr);}
  var fb=fmtBits(mk);
  for(var i=0;i<15;i++){var bit=((fb>>i)&1)===1;
   if(i<6)out[i][8]=bit;else if(i<8)out[i+1][8]=bit;else if(i===8)out[8][7]=bit;else out[8][14-i]=bit;
   if(i<8)out[8][n-1-i]=bit;else out[n-15+i][8]=bit;}
  out[n-8][8]=true;
  return out;}
 function penalty(g){var p=0,i,j,k;
  for(i=0;i<n;i++){var runC=1,runR=1;
   for(j=1;j<n;j++){ if(g[i][j]===g[i][j-1])runC++;else{if(runC>=5)p+=3+(runC-5);runC=1;}
    if(g[j][i]===g[j-1][i])runR++;else{if(runR>=5)p+=3+(runR-5);runR=1;} }
   if(runC>=5)p+=3+(runC-5); if(runR>=5)p+=3+(runR-5);}
  for(i=0;i<n-1;i++)for(j=0;j<n-1;j++){var a=g[i][j];if(a===g[i][j+1]&&a===g[i+1][j]&&a===g[i+1][j+1])p+=3;}
  var pat=[true,false,true,true,true,false,true,false,false,false,false];
  var pat2=[false,false,false,false,true,false,true,true,true,false,true];
  for(i=0;i<n;i++)for(j=0;j<=n-11;j++){var ok1=true,ok2=true,ok3=true,ok4=true;
   for(k=0;k<11;k++){ if(g[i][j+k]!==pat[k])ok1=false; if(g[i][j+k]!==pat2[k])ok2=false;
    if(g[j+k][i]!==pat[k])ok3=false; if(g[j+k][i]!==pat2[k])ok4=false;}
   if(ok1)p+=40; if(ok2)p+=40; if(ok3)p+=40; if(ok4)p+=40;}
  var dark=0;for(i=0;i<n;i++)for(j=0;j<n;j++)if(g[i][j])dark++;
  p+=Math.floor(Math.abs(dark*100/(n*n)-50)/5)*10;
  return p;}
 var best=null,bestP=Infinity;
 for(var mk=0;mk<8;mk++){var g=apply(mk),pp=penalty(g);if(pp<bestP){bestP=pp;best=g;}}
 return best;
}
function svg(text,px,margin){var g=matrix(text),n=g.length,q=(margin===undefined?2:margin),tot=n+2*q,d='';
 for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(g[y][x])d+='M'+(x+q)+' '+(y+q)+'h1v1h-1z';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+px+'" height="'+px+'" viewBox="0 0 '+tot+' '+tot+'" shape-rendering="crispEdges"><rect width="'+tot+'" height="'+tot+'" fill="#fff"/><path d="'+d+'" fill="#000"/></svg>';}
return {matrix:matrix,svg:svg};
})();
function qrBox(text,px,cap){try{return '<div class="qrb">'+QRGEN.svg(String(text||''),px)+(cap?'<span>'+esc(cap)+'</span>':'')+'</div>';}catch(e){return '';}}
/* ================= التخزين ================= */
const KEY='fsm_v1';
const MONTHS=['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر'];
const DEFAULT_WA='السلام عليكم {ولي_الأمر}،\nتحية طيبة من {المدرسة} ⚽\nنذكركم بأداء الواجب الشهري للاعب {اللاعب} ({الفئة}) عن شهر {الشهر} {السنة}.\nالمبلغ المطلوب: {المطلوب}\nالمبلغ المدفوع: {المدفوع}\nالمتبقي: {المتبقي}\nشكراً لتعاونكم، وإذا تم الأداء فالمرجو تجاهل الرسالة.\n{الهاتف}';
const DEFAULT_ABS='السلام عليكم {ولي_الأمر}،\n{المدرسة} ⚽\nنعلمكم أن ابنكم {اللاعب} ({الفئة}) كان {الحالة} في حصة يوم {التاريخ}.\nالمرجو إخبارنا بالسبب لمتابعة التزام اللاعب بالتداريب.\nنسبة حضوره الحالية: {نسبة_الحضور}\nشكراً لتعاونكم.\n{الهاتف}';
const DEFAULT_THX='السلام عليكم {ولي_الأمر}،\nتوصلنا بمبلغ {المدفوع} عن اشتراك اللاعب {اللاعب} ({الفئة}) لشهر {الشهر} {السنة}. ✅\nرقم الوصل: {رقم_الوصل}\nتاريخ الأداء: {تاريخ_الأداء}\nالمتبقي: {المتبقي}\nشكراً لثقتكم ولدعمكم لـ{المدرسة} 🙏⚽\n{الهاتف}';
const DEFAULT_ARR='السلام عليكم {ولي_الأمر}،\n{المدرسة} ⚽\nنعلمكم أن ابنكم {اللاعب} ({الفئة}) وصل إلى التدريب وسُجّل حضوره يوم {التاريخ} على الساعة {الساعة}. ✅\nنسبة حضوره الحالية: {نسبة_الحضور}\n{الهاتف}';
const blank={settings:{school:'مدرسة كرة القدم',address:'',phone:'',fee:150,registrationFee:0,currency:'درهم',cc:'212',wa:DEFAULT_WA,waAbs:DEFAULT_ABS,waThx:DEFAULT_THX,waArr:DEFAULT_ARR,scanAuto:false,waCloud:false,waAutoThx:false,consentText:'أصرّح بصفتي ولي الأمر بالموافقة على تسجيل ابني/ابنتي في المدرسة الرياضية، واستعمال بياناته وصوره في إطار الأنشطة الرياضية والإدارية، وألتزم باحترام النظام الداخلي وأداء المستحقات.',serverUrl:'',syncCode:'',syncSecret:'',syncLast:'',syncBase:'',syncAuto:false,syncOpen:false,syncConflicts:null,changed:'',device:'',lock:false,pinAdmin:'',pinCoach:''},
 teams:[],parents:[],coaches:[],players:[],trainings:[],attendance:[],matches:[],evals:[],subs:[],receipts:[],expenses:[],salaryAdvances:[],equip:[],docs:[],loans:[],injuries:[],announcements:[],cashClosings:[],syncLog:[],audit:[]};
const DEFAULT_SERVER='https://sync.clubagaplus.ma';
let db=load();
if(!db.settings.serverUrl){db.settings.serverUrl=DEFAULT_SERVER;}
if(!Array.isArray(db.cashClosings))db.cashClosings=[];
if(!Array.isArray(db.receipts))db.receipts=[];
if(!Array.isArray(db.announcements))db.announcements=[];
if(!Array.isArray(db.injuries))db.injuries=[];
if(!Array.isArray(db.salaryAdvances))db.salaryAdvances=[];
if(!db.settings.consentText)db.settings.consentText=blank.settings.consentText;
function validDbShape(x){return !!(x&&typeof x==='object'&&x.settings&&typeof x.settings==='object'&&['teams','parents','coaches','players','trainings','attendance','matches','subs','evals','expenses','equip','docs','loans'].every(k=>Array.isArray(x[k])));}
function load(){try{const parsed=window.__malaabnaInitialDb;if(validDbShape(parsed))return Object.assign(JSON.parse(JSON.stringify(blank)),parsed);}catch(e){console.warn('تعذر تحميل البيانات المحلية',e);}return seed();}
const APP_VERSION='3.8.61';
let cloudStatusPhase='idle',cloudStatusNote='',statusRenderSerial=0,statusDigestText='',statusDigestTask=null;
function syncComparable(snapshot){
 const clean={...snapshot,settings:{...(snapshot.settings||{})}};delete clean.syncLog;
 for(const key of ['syncSecret','syncCode','serverUrl','changed','syncBase','syncLast','syncConflicts','syncAuto','syncOpen','device','bkLast','_localSyncAck','_receiptVerifications'])delete clean.settings[key];
 return clean;
}
async function syncDigest(snapshot){
 const bytes=new TextEncoder().encode(stableStr(syncComparable(snapshot)));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function syncConnectionKey(){
 const connection=mobileInfo||{serverUrl:db.settings.serverUrl,code:db.settings.syncCode};
 return stableStr({server:String(connection.serverUrl||'').trim().replace(/\/+$/,''),code:String(connection.code||'').trim().toUpperCase(),scope:mobileInfo&&mobileInfo.user?String(mobileInfo.user.role)+':'+String(mobileInfo.user.id||'unknown'):'workspace-admin'});
}
function storageStatusModel(state){
 if(!state.authenticated)return {state:'locked',label:'حالة البيانات بعد تسجيل الدخول',detail:'الإصدار ظاهر؛ لا تُعرض حالة قاعدة البيانات قبل فتح الحساب.'};
 if(state.failed)return {state:'error',label:'فشل الحفظ المحلي',detail:'لم يُؤكد حفظ آخر تعديل. أعد المحاولة؛ المزامنة متوقفة حتى نجاح الحفظ.'};
 if(state.pending)return {state:'saving',label:'جارٍ الحفظ على الجهاز…',detail:'انتظر تأكيد التخزين قبل إغلاق التطبيق.'};
 if(state.phase==='conflict')return {state:'conflict',label:'يوجد تعارض في المزامنة',detail:state.note||'احتفظ بنسخة احتياطية وراجع النسخة المعتمدة قبل المتابعة.'};
 if(state.phase==='error')return {state:'warning',label:'محفوظ على الجهاز · تعذرت المزامنة',detail:state.note||'لم يُؤكد رفع هذه النسخة. تحقق من الاتصال وأعد المحاولة.'};
 if(state.phase==='syncing')return {state:'syncing',label:'جارٍ مزامنة البيانات…',detail:'لم يُؤكد الخادم اكتمال العملية بعد.'};
 if(state.phase==='attendance')return {state:'local',label:'تم رفع الحضور فقط',detail:'أكد الخادم السجلات المرسلة فقط. لا يعني ذلك مزامنة حذف سجلات أو قاعدة البيانات كاملة.'};
 if(state.synced)return {state:'synced',label:'تمت مزامنة هذه النسخة'+(state.online===false?' · غير متصل الآن':''),detail:'آخر تأكيد: '+state.at+'. يخص المؤشر قاعدة البيانات، لا جميع المرفقات أو نماذج لم تُحفظ أو تعديلات أجهزة أخرى.'};
 return {state:'local',label:'محفوظ على الجهاز · لم يُؤكد رفعه',detail:state.online===false?'لا يوجد اتصال بالشبكة. تبقى النسخة المحلية محفوظة.':state.configured?'لا توجد مطابقة مؤكدة لهذه النسخة مع آخر رفع أو جلب. المؤشر يخص قاعدة البيانات، لا النماذج غير المحفوظة.':'المزامنة غير معدّة لهذا الجهاز. المؤشر يخص قاعدة البيانات فقط، لا النماذج غير المحفوظة.'};
}
function refreshAppStatus(){
 const serial=++statusRenderSerial,box=document.getElementById('dataStatus');
 document.querySelectorAll('[data-app-version]').forEach(el=>{el.textContent='الإصدار '+APP_VERSION;});
 if(!box)return;
 const header=document.querySelector('.mobtop'),account=document.getElementById('acctBar');
 const accountHeight=account?account.getBoundingClientRect().height:0,headerHeight=header?header.getBoundingClientRect().height:0;
 if(headerHeight)header.style.top=accountHeight+'px';
 box.closest('.app-health').style.top=(accountHeight+headerHeight)+'px';
 const authenticated=!(isMobileWeb()&&!mobileInfo)&&!(lockOn()&&!role&&!mobileInfo)&&!(window.electronAPI&&!acctReady);
 const state={authenticated,pending:pendingDbWrites,failed:dbWriteFailed,phase:cloudStatusPhase,note:cloudStatusNote,online:navigator.onLine,configured:syncReady(),synced:false};
 const apply=model=>{
  if(serial!==statusRenderSerial)return;
  box.dataset.state=model.state;
  document.getElementById('dataStatusLabel').textContent=model.label;
  document.getElementById('dataStatusDetail').textContent=model.detail;
 };
 if(!authenticated||state.pending||state.failed||cloudStatusPhase!=='idle'){apply(storageStatusModel(state));return;}
 const stored=JSON.parse(durableDbSnapshot),ack=stored.settings&&stored.settings._localSyncAck;
 if(!ack||!ack.digest||!ack.at||ack.connection!==syncConnectionKey()){apply(storageStatusModel(state));return;}
 if(statusDigestText!==durableDbSnapshot||!statusDigestTask){
  statusDigestText=durableDbSnapshot;statusDigestTask=syncDigest(stored);
 }
 statusDigestTask.then(digest=>apply(storageStatusModel({...state,synced:digest===ack.digest,at:ack.at}))).catch(()=>apply(storageStatusModel(state)));
}
function setCloudStatus(phase,note){cloudStatusPhase=phase;cloudStatusNote=String(note||'');refreshAppStatus();if(typeof refreshAttendanceSyncPanel==='function')refreshAttendanceSyncPanel();}
function setCloudFailure(error){setCloudStatus(error&&['receipt_correction_conflict','sync_conflict','attendance_version_conflict','attendance_history_conflict','attendance_identity_conflict'].includes(error.code)?'conflict':'error',error&&error.message||'تعذر تأكيد المزامنة.');}
function resetPartialSyncStatus(){if(cloudStatusPhase==='attendance'){cloudStatusPhase='idle';cloudStatusNote='';}}
async function markSyncAcknowledged(snapshot,at,connection=syncConnectionKey()){const digest=await syncDigest(snapshot);if(connection!==syncConnectionKey())throw new Error('تغيرت إعدادات المزامنة أثناء العملية. أعد المحاولة.');db.settings._localSyncAck={digest,at:at||new Date().toISOString(),connection};}
// Serialize writes and retain the last confirmed snapshot for a safe retry.
let durableDbSnapshot=JSON.stringify(db),dbWriteQueue=Promise.resolve(),pendingDbWrites=0,dbWriteFailed=false;
function persistDbSnapshot(){
 if(typeof resetPartialSyncStatus==='function')resetPartialSyncStatus();
 const text=JSON.stringify(db);pendingDbWrites++;if(typeof refreshAppStatus==='function')refreshAppStatus();
 const task=dbWriteQueue.catch(()=>{}).then(()=>window.persistMalaabnaDb(text)).then(function(){
  durableDbSnapshot=text;dbWriteFailed=false;
 },function(error){
  dbWriteFailed=true;
  // Do not overwrite edits that arrived from a separate asynchronous operation.
  if(JSON.stringify(db)===text)db=JSON.parse(durableDbSnapshot);
  throw error;
 });
 dbWriteQueue=task;
 return task.finally(()=>{pendingDbWrites--;if(typeof refreshAppStatus==='function')refreshAppStatus();});
}
function reportPersistenceError(error){
 console.error('تعذر حفظ قاعدة البيانات المشفّرة',error);
 const message='لم يُحفظ التعديل محلياً ولم تُجدول مزامنته. أعد المحاولة؛ لا تغلق التطبيق قبل نجاح الحفظ.';
 const modal=document.getElementById('ov');
 if(modal&&modal.classList.contains('on'))showModalError(message);
 else syncToast('⚠️ '+message);
}
async function waitForLocalPersistence(){
 try{await dbWriteQueue;}catch(error){throw new Error('لم ينجح الحفظ المحلي. أعد حفظ التعديل قبل المزامنة.');}
 if(dbWriteFailed)throw new Error('لم ينجح الحفظ المحلي. أعد حفظ التعديل قبل المزامنة.');
}
async function save(){
 try{
  db.settings.changed=new Date().toISOString();
  await persistDbSnapshot();
 }catch(error){reportPersistenceError(error);return false;}
 // A scheduler failure must not turn a successful disk write into a failed save.
 try{if(typeof syncSchedule==='function')syncSchedule();}catch(error){console.warn('تعذر جدولة المزامنة',error);}
 return true;
}
function uid(){try{const a=new Uint32Array(2);crypto.getRandomValues(a);return a[0].toString(36)+a[1].toString(36);}catch(e){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}}
function auditAdd(action,details){if(!Array.isArray(db.audit))db.audit=[];db.audit.unshift({id:uid(),at:new Date().toISOString(),action:String(action||''),details:String(details||''),actor:(lockOn()&&role)?roleLabel():'مدير'});db.audit=db.audit.slice(0,500);}
function migrateSalaryAdvancePlans(){
 const known=new Set((db.salaryAdvances||[]).map(p=>p&&p.id));
 const groups=new Map();
 (db.expenses||[]).forEach(function(x){if(x&&x.salaryAdvancePlanId&&!known.has(x.salaryAdvancePlanId)){if(!groups.has(x.salaryAdvancePlanId))groups.set(x.salaryAdvancePlanId,[]);groups.get(x.salaryAdvancePlanId).push(x);}});
 let changed=false;
 groups.forEach(function(rows,id){
  rows.sort(function(a,b){return Number(a.salaryAdvanceInstallment||0)-Number(b.salaryAdvanceInstallment||0);});
  const first=rows[0],coachId=first.salaryAdvanceCoachId||'',coach=(db.coaches||[]).find(function(c){return c.id===coachId;});
  db.salaryAdvances.push({id:id,coachId:coachId,coachName:(coach&&coach.name)||first.benef||'',total:Number(first.salaryAdvanceTotal)||rows.reduce(function(sum,x){return sum+(Number(x.amount)||0);},0),startDate:first.date||todayISO(),method:first.method||'نقداً',createdAt:first.date||todayISO(),plannedInstallmentCount:Number(first.salaryAdvanceInstallmentCount)||rows.length,migratedFromV3813:true});
  changed=true;
 });
 return changed;
}
let salaryAdvancePlansNeedMigration=migrateSalaryAdvancePlans();
function auditLogHTML(){const L=Array.isArray(db.audit)?db.audit:[];if(!L.length)return '<div class="empty">لا توجد عمليات مسجلة بعد.</div>';return '<div class="tw"><table><thead><tr><th>التاريخ</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>'+L.slice(0,80).map(x=>'<tr><td>'+esc(String(x.at||'').slice(0,16).replace('T',' '))+'</td><td>'+esc(x.actor||'')+'</td><td>'+esc(x.action||'')+'</td><td>'+esc(x.details||'')+'</td></tr>').join('')+'</tbody></table></div>';}
async function clearAudit(){if(confirm('هل تريد مسح سجل العمليات؟')){db.audit=[];if(!await save())return;render();}}
function seed(){
 const d=JSON.parse(JSON.stringify(blank));
 ['U7','U9','U11','U13','U15','U17'].forEach((c,i)=>d.teams.push({id:uid(),name:'فريق '+c,cat:c,fee:120+i*20,field:'الملعب البلدي',status:'نشط',days:'الثلاثاء، الخميس، السبت'}));
 return d;
}
const money=n=>(Number(n)||0).toLocaleString('fr-MA')+' '+db.settings.currency;
const todayISO=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* يسمح فقط بصور data:image (png/jpeg/gif/webp) — يمنع حقن HTML/JS عبر حقول الصور المزامنة أو المستوردة */
const safeImg=v=>{v=String(v==null?'':v);return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+\/=\s]+$/i.test(v)?v:'';};
// Dynamic UI actions are registered as closures and delegated through addEventListener;
// no handler source is evaluated and per-load random IDs prevent forged action attributes.
const appActionHandlers=new Map();
const appActionPrefix=typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
let appActionCounter=0;
function actionAttr(type,handler){const id=appActionPrefix+'-'+(++appActionCounter);appActionHandlers.set(id,{type:type,handler:handler});return 'data-app-action="'+id+'"';}
function dispatchAppAction(event){const target=event.target&&event.target.closest?event.target.closest('[data-app-action]'):null;if(!target)return;const id=target.getAttribute('data-app-action'),entry=appActionHandlers.get(id);if(!entry||entry.type!==event.type)return;const result=entry.handler(event,target);if(result===false)event.preventDefault();}
['click','change','input','keydown'].forEach(type=>document.addEventListener(type,dispatchAppAction));
function pruneAppActionHandlers(){if(appActionHandlers.size<512)return;const live=new Set(Array.from(document.querySelectorAll('[data-app-action]'),el=>el.getAttribute('data-app-action')));for(const id of appActionHandlers.keys())if(!live.has(id))appActionHandlers.delete(id);}

/* ================= المخططات ================= */
const POS=['حارس مرمى','دفاع','وسط','مهاجم'];
const CATS=['U7','U9','U11','U13','U15','U17','U19','الأكابر'];
const ATT=['🟢 حاضر','🔴 غائب','🟠 غياب مبرر','🔵 متأخر'];
const PAY=['🟢 مؤدى','🟠 أداء جزئي','🔴 غير مؤدى','⚪ معفى'];
const EXPC=['أجور المدربين','تسبيقات الأجور','كراء الملعب','المعدات','الكرات','الأقمصة','النقل','التحكيم','المشاركة في البطولات','التأمين','مصاريف أخرى'];
const EQC=['الكرات','القمصان','السراويل','السترات','القفازات','الأقماع','الصدريات','معدات تدريب','أخرى'];
const DOCC=['صورة اللاعب','شهادة طبية','عقد التسجيل','الموافقة المكتوبة','وثيقة J6','استمارة التسجيل','شهادة الازدياد','نسخة البطاقة الوطنية','وصل الأداء','وثائق ولي الأمر','التأمين','أخرى'];

const SCHEMA={
 teams:{label:'الفئات والفرق',icon:'🏟️',title:'name',fields:[
  {k:'name',l:'اسم الفريق',t:'text',req:1,col:1},{k:'cat',l:'الفئة العمرية',t:'select',o:CATS,col:1},
  {k:'years',l:'سنوات الازدياد',t:'text'},{k:'fee',l:'الاشتراك الشهري',t:'number',col:1,fmt:'money'},
  {k:'days',l:'أيام التدريب',t:'text',col:1},{k:'field',l:'الملعب',t:'text',col:1},
  {k:'status',l:'الحالة',t:'select',o:['نشط','متوقف'],col:1,tag:1},{k:'notes',l:'ملاحظات',t:'area',full:1}]},
 parents:{label:'أولياء الأمور',icon:'👨‍👩‍👦',title:'name',fields:[
  {k:'name',l:'اسم ولي الأمر',t:'text',req:1,col:1},{k:'rel',l:'الصفة',t:'select',o:['الأب','الأم','وصي'],col:1},
  {k:'phone',l:'الهاتف',t:'tel',col:1},{k:'phone2',l:'هاتف احتياطي',t:'tel'},{k:'email',l:'البريد',t:'text'},
  {k:'cin',l:'رقم البطاقة الوطنية',t:'text'},{k:'address',l:'العنوان',t:'text',col:1},{k:'job',l:'المهنة',t:'text'},{k:'att',l:'📎 وثائق ولي الأمر (البطاقة الوطنية…)',t:'files',full:1},
  {k:'portalCode',l:'رمز بوابة ولي الأمر (يُولّد تلقائياً)',t:'text'},
  {k:'notes',l:'ملاحظات',t:'area',full:1}]},
 coaches:{label:'المدربون',icon:'🧑‍🏫',title:'name',fields:[
  {k:'name',l:'اسم المدرب',t:'text',req:1,col:1},{k:'spec',l:'التخصص',t:'select',o:['مدرب رئيسي','مدرب مساعد','مدرب حراس','محضر بدني','معالج رياضي'],col:1},
  {k:'phone',l:'الهاتف',t:'tel',col:1},{k:'email',l:'البريد',t:'text'},{k:'diploma',l:'الديبلوم / الرخصة',t:'text'},
  {k:'teams',l:'الفئات المشرف عليها (مثال: U11، U13)',t:'text',col:1},{k:'pin',l:'رمز الدخول الخاص (حضور فئاته فقط)',t:'text',col:1},{k:'att',l:'📎 وثائق المدرب (البطاقة الوطنية، الشهادات، البطاقة المهنية)',t:'files',full:1},{k:'salary',l:'التعويض الشهري',t:'number',col:1,fmt:'money'},
  {k:'start',l:'تاريخ الالتحاق',t:'date'},{k:'status',l:'الحالة',t:'select',o:['نشط','متوقف','مغادر'],col:1,tag:1},
  {k:'cin',l:'رقم البطاقة الوطنية',t:'text'},{k:'address',l:'العنوان',t:'text'},{k:'notes',l:'ملاحظات',t:'area',full:1}]},
 players:{label:'اللاعبون',icon:'👕',title:'name',fields:[
  {k:'photo',l:'الصورة',t:'photo',col:1},{k:'name',l:'الاسم الكامل',t:'text',req:1,col:1},
  {k:'birth',l:'تاريخ الازدياد',t:'date',col:1},{k:'birthplace',l:'مكان الازدياد',t:'text'},
  {k:'cat',l:'الفئة العمرية',t:'select',o:CATS,col:1},{k:'team',l:'الفريق',t:'ref',ref:'teams',col:1},
  {k:'pos',l:'المركز',t:'select',o:POS,col:1},{k:'shirt',l:'رقم القميص',t:'number',col:1},
  {k:'parent',l:'ولي الأمر',t:'ref',ref:'parents',col:1},{k:'pphone',l:'هاتف ولي الأمر',t:'tel',col:1},
  {k:'phone',l:'هاتف اللاعب',t:'tel'},{k:'address',l:'العنوان',t:'text'},
  {k:'fee',l:'الاشتراك الشهري',t:'number',fmt:'money'},{k:'reg',l:'تاريخ التسجيل',t:'date'},
  {k:'status',l:'الحالة',t:'select',o:['نشط','متوقف','منسحب'],col:1,tag:1},
  {k:'med',l:'الشهادة الطبية',t:'check'},{k:'ins',l:'التأمين',t:'check'},
  {k:'att',l:'📎 وثائق اللاعب (شهادة طبية، عقد الازدياد، البطاقة الوطنية…)',t:'files',full:1,col:1},
  {k:'health',l:'ملاحظات صحية',t:'area',full:1},{k:'consentStatus',l:'موافقة ولي الأمر',t:'select',o:['غير مطلوبة','في انتظار الموافقة','موافق عليها','مرفوضة'],col:1,tag:1},{k:'consentName',l:'اسم الموقّع',t:'text'},{k:'consentAt',l:'تاريخ التوقيع',t:'date'},{k:'notes',l:'ملاحظات المدرب',t:'area',full:1}]},
 trainings:{label:'التداريب',icon:'🗓️',title:'name',fields:[
  {k:'name',l:'الحصة',t:'text',req:1,col:1},{k:'date',l:'التاريخ',t:'date',col:1},{k:'time',l:'الساعة',t:'time',col:1},
  {k:'team',l:'الفئة / الفريق',t:'ref',ref:'teams',col:1},{k:'coach',l:'المدرب',t:'ref',ref:'coaches',col:1},
  {k:'field',l:'الملعب',t:'text',col:1},{k:'type',l:'نوع التدريب',t:'select',o:['تقني','بدني','تكتيكي','مباراة تطبيقية','حراس المرمى','استشفاء']},
  {k:'dur',l:'المدة (دقيقة)',t:'number'},{k:'repeat',l:'التكرار',t:'select',o:['لا تكرار','أسبوعياً','كل أسبوعين']},{k:'repeatUntil',l:'تكرار حتى تاريخ',t:'date'},{k:'remindBefore',l:'تذكير داخل التطبيق',t:'select',o:['بدون تذكير','قبل 24 ساعة','قبل ساعتين']},{k:'status',l:'الحالة',t:'select',o:['مبرمجة','أُنجزت','ملغاة'],tag:1},
  {k:'notes',l:'الملاحظات',t:'area',full:1}]},
 injuries:{label:'الإصابات والمتابعة',icon:'🩹',title:'player',fields:[
  {k:'player',l:'اللاعب',t:'ref',ref:'players',req:1,col:1},{k:'date',l:'تاريخ الإصابة',t:'date',req:1,col:1},
  {k:'area',l:'موضع الإصابة',t:'text',col:1},{k:'severity',l:'الدرجة',t:'select',o:['خفيفة','متوسطة','تحتاج تقييماً طبياً'],col:1,tag:1},
  {k:'followupDate',l:'موعد المتابعة',t:'date',col:1},{k:'status',l:'حالة المتابعة',t:'select',o:['تحت المتابعة','توقف احترازي','تم توثيق تصريح طبي بالعودة','مغلقة'],col:1,tag:1},
  {k:'clearanceDate',l:'تاريخ التصريح الطبي (عند العودة)',t:'date',col:1},{k:'clearanceBy',l:'جهة / مرجع التصريح الطبي',t:'text',col:1},
  {k:'guardianNotified',l:'تم إشعار ولي الأمر',t:'select',o:['لا','نعم'],col:1},{k:'notes',l:'ملاحظات إدارية للمتابعة',t:'area',full:1}]},
 matches:{label:'المباريات',icon:'🏆',title:'opp',fields:[
  {k:'opp',l:'الخصم',t:'text',req:1,col:1},{k:'date',l:'التاريخ',t:'date',col:1},{k:'time',l:'الساعة',t:'time'},
  {k:'team',l:'الفريق / الفئة',t:'ref',ref:'teams',col:1},{k:'coach',l:'المدرب',t:'ref',ref:'coaches'},
  {k:'ha',l:'داخل/خارج الميدان',t:'select',o:['داخل الميدان','خارج الميدان','أرض محايدة'],col:1},
  {k:'field',l:'الملعب',t:'text'},{k:'type',l:'نوع المباراة',t:'select',o:['ودية','بطولة','كأس','دوري محلي']},
  {k:'gf',l:'أهدافنا',t:'number',col:1},{k:'ga',l:'أهداف الخصم',t:'number',col:1},
  {k:'res',l:'النتيجة',t:'select',o:['فوز','تعادل','هزيمة'],col:1,tag:1},
  {k:'scorers',l:'المسجلون',t:'text'},{k:'yc',l:'بطاقات صفراء',t:'number'},{k:'rc',l:'بطاقات حمراء',t:'number'},
  {k:'players',l:'اللاعبون المشاركون',t:'area',full:1},{k:'notes',l:'ملاحظات المدرب',t:'area',full:1}]},
 subs:{label:'الاشتراكات والرسوم',icon:'💰',title:'player',fields:[
  {k:'player',l:'اللاعب',t:'ref',ref:'players',req:1,col:1},{k:'kind',l:'نوع الرسم',t:'select',o:['اشتراك شهري','رسوم التسجيل'],col:1},
  {k:'month',l:'الشهر (للاشتراك الشهري)',t:'select',o:MONTHS,col:1},{k:'year',l:'السنة',t:'number',col:1},
  {k:'baseDue',l:'المبلغ الأصلي',t:'number',req:1,col:1,fmt:'money'},
  {k:'discountType',l:'نوع الخصم',t:'select',o:['بدون','مبلغ ثابت'],col:1},
  {k:'discountValue',l:'قيمة الخصم الثابت',t:'number',col:1},{k:'discountReason',l:'سبب الخصم (مطلوب عند تطبيقه)',t:'text',col:1},
  {k:'exempt',l:'إعفاء من الرسم',t:'select',o:['لا','نعم'],col:1},{k:'exemptReason',l:'سبب الإعفاء (مطلوب عند الإعفاء)',t:'text',col:1},
  {k:'paid',l:'المبلغ المؤدى',t:'number',col:1,fmt:'money'},
  {k:'date',l:'تاريخ الأداء',t:'date',col:1},{k:'method',l:'طريقة الأداء',t:'select',o:['نقداً','تحويل بنكي','شيك','تحويل إلكتروني']},
  {k:'notes',l:'ملاحظات',t:'area',full:1}]},
 evals:{label:'التقييم الرياضي',icon:'⭐',title:'player',fields:[
  {k:'player',l:'اللاعب',t:'ref',ref:'players',req:1,col:1},{k:'coach',l:'المدرب المقيّم',t:'ref',ref:'coaches',col:1},
  {k:'date',l:'تاريخ التقييم',t:'date',col:1},{k:'period',l:'الفترة',t:'select',o:['شهري','فصلي','نهاية الموسم']},
  {k:'speed',l:'السرعة',t:'rate',col:1},{k:'drib',l:'المراوغة',t:'rate',col:1},{k:'pass',l:'التمرير',t:'rate',col:1},
  {k:'shoot',l:'التسديد',t:'rate',col:1},{k:'ctrl',l:'التحكم بالكرة',t:'rate',col:1},{k:'fit',l:'اللياقة',t:'rate',col:1},
  {k:'disc',l:'الانضباط',t:'rate',col:1},{k:'tw',l:'اللعب الجماعي',t:'rate',col:1},
  {k:'strong',l:'نقاط القوة',t:'area',full:1},{k:'weak',l:'نقاط التحسين',t:'area',full:1}]},
 expenses:{label:'المصاريف',icon:'🧾',title:'title',fields:[
  {k:'title',l:'المصروف',t:'text',req:1,col:1},{k:'cat',l:'النوع',t:'select',o:EXPC,col:1},
  {k:'amount',l:'المبلغ',t:'number',col:1,fmt:'money'},{k:'date',l:'التاريخ',t:'date',col:1},
  {k:'benef',l:'المستفيد / المورد',t:'text',col:1},{k:'method',l:'طريقة الأداء',t:'select',o:['نقداً','تحويل بنكي','شيك']},
  {k:'status',l:'الحالة',t:'select',o:['مؤدى','في انتظار الأداء'],col:1,tag:1},{k:'inv',l:'رقم الفاتورة',t:'text'},
  {k:'att',l:'إرفاق الفاتورة (صورة أو PDF)',t:'files',full:1},{k:'notes',l:'ملاحظات',t:'area',full:1}]},
 equip:{label:'المعدات',icon:'⚽',title:'name',fields:[
  {k:'name',l:'المعدة',t:'text',req:1,col:1},{k:'cat',l:'النوع',t:'select',o:EQC,col:1},
  {k:'total',l:'الكمية الإجمالية',t:'number',col:1},{k:'used',l:'الكمية المستعملة',t:'number',col:1},
  {k:'state',l:'الحالة',t:'select',o:['جديدة','جيدة','متوسطة','تحتاج تعويض'],col:1,tag:1},
  {k:'price',l:'ثمن الاقتناء',t:'number',fmt:'money'},{k:'date',l:'تاريخ الاقتناء',t:'date'},
  {k:'place',l:'مكان التخزين',t:'text'},{k:'notes',l:'ملاحظات',t:'area',full:1}]},
 loans:{label:'إعارة المعدات',icon:'🔁',title:'title',fields:[
  {k:'title',l:'العملية',t:'text',req:1,col:1},{k:'equip',l:'المعدة',t:'ref',ref:'equip',col:1},
  {k:'qty',l:'الكمية',t:'number',col:1},{k:'toType',l:'الجهة',t:'select',o:['لاعب','مدرب','فريق','أخرى'],col:1},
  {k:'player',l:'اللاعب',t:'ref',ref:'players',col:1},{k:'coach',l:'المدرب',t:'ref',ref:'coaches',col:1},
  {k:'out',l:'تاريخ التسليم',t:'date',col:1},{k:'back',l:'تاريخ الإرجاع',t:'date',col:1},
  {k:'state',l:'الحالة',t:'select',o:['مُعارة','مُرجعة','تالفة','ضائعة'],col:1,tag:1},
  {k:'notes',l:'ملاحظات',t:'area',full:1}]},
 announcements:{label:'الإعلانات',icon:'📢',title:'title',fields:[
  {k:'title',l:'عنوان الإعلان',t:'text',req:1,col:1},{k:'date',l:'تاريخ النشر',t:'date',col:1},{k:'until',l:'ينتهي في',t:'date',col:1},
  {k:'audience',l:'الجمهور',t:'select',o:['الجميع','المدربون','أولياء الأمور','اللاعبون','فئة محددة'],col:1},
  {k:'cat',l:'الفئة المستهدفة (اختياري)',t:'select',o:[''].concat(CATS),col:1},
  {k:'priority',l:'الأهمية',t:'select',o:['عادي','مهم','عاجل'],col:1,tag:1},{k:'body',l:'نص الإعلان',t:'area',full:1},
  {k:'status',l:'الحالة',t:'select',o:['منشور','مسودة','منتهي'],col:1,tag:1}]},
 docs:{label:'الوثائق',icon:'📁',title:'title',fields:[
  {k:'title',l:'الوثيقة',t:'text',req:1,col:1},{k:'cat',l:'نوع الوثيقة',t:'select',o:DOCC,col:1},
  {k:'player',l:'اللاعب',t:'ref',ref:'players',col:1},{k:'date',l:'تاريخ الإيداع',t:'date',col:1},
  {k:'exp',l:'انتهاء الصلاحية',t:'date'},{k:'state',l:'الحالة',t:'select',o:['مكتملة','ناقصة','منتهية الصلاحية'],col:1,tag:1},
  {k:'notes',l:'ملاحظات',t:'area',full:1}]}
};
const NAV=[
 {id:'dash',l:'لوحة القيادة',i:'📊'},{id:'admin',l:'إدارة النادي',i:'👔'},
 {sep:'الإدارة الرياضية'},
 {id:'players',l:'اللاعبون',i:'👕'},{id:'docscan',l:'تسجيل بالوثائق',i:'📄'},{id:'cards',l:'بطاقات العضوية',i:'🪪'},{id:'teams',l:'الفئات والفرق',i:'🏟️'},{id:'coaches',l:'المدربون',i:'🧑‍🏫'},{id:'parents',l:'أولياء الأمور',i:'👨‍👩‍👦'},{id:'family',l:'ملفات العائلات',i:'👪'},{id:'portal',l:'بوابة ولي الأمر',i:'👨‍👩‍👧‍👦'},
 {sep:'النشاط الرياضي'},
 {id:'trainings',l:'التداريب',i:'🗓️'},{id:'injuries',l:'الإصابات والمتابعة',i:'🩹'},{id:'announcements',l:'الإعلانات',i:'📢'},{id:'att',l:'الحضور',i:'✅'},{id:'scan',l:'مسح QR للحضور',i:'📷'},{id:'matches',l:'المباريات',i:'🏆'},{id:'evals',l:'التقييم الرياضي',i:'⭐'},
 {sep:'الاشتراكات والمالية'},
 {id:'subs',l:'الاشتراكات',i:'💰'},{id:'wa',l:'تذكير واتساب',i:'💬'},{id:'receipts',l:'الوصولات',i:'🧾'},{id:'expenses',l:'المصاريف',i:'💸'},
 {sep:'الخدمات والمعدات'},
 {id:'equip',l:'المعدات',i:'⚽'},{id:'loans',l:'إعارة المعدات',i:'🔁'},{id:'docs',l:'الوثائق',i:'📁'},{id:'alerts',l:'التنبيهات',i:'🚨'},{id:'cashbox',l:'الصندوق اليومي',i:'💳'},{id:'reports',l:'التقارير',i:'📈'},{id:'invites',l:'دعوات الهاتف',i:'🔗'},{id:'system',l:'حالة النظام',i:'🛡️'},{id:'settings',l:'الإعدادات',i:'⚙️'}
];

/* ================= أدوات ================= */
function refName(coll,id){const r=(db[coll]||[]).find(x=>x.id===id);if(!r)return '—';const t=SCHEMA[coll].title;return r[t]||r.name||'—';}
function tagClass(v){v=String(v||'');
 if(/نشط|مؤدى|حاضر|فوز|مكتملة|أُنجزت|جديدة|جيدة/.test(v))return 't-g';
 if(/غائب|منسحب|غير مؤدى|هزيمة|ملغاة|منتهية|تحتاج/.test(v))return 't-r';
 if(/متوقف|جزئي|مبرر|تعادل|ناقصة|انتظار|متوسطة|مغادر/.test(v))return 't-o';
 if(/متأخر|مبرمجة/.test(v))return 't-b';return 't-n';}
function cell(f,r){
 const v=r[f.k];
 if(f.t==='files')return attListHTML(r);
 if(f.t==='photo')return v?'<img class="avatar" src="'+safeImg(v)+'">':'<span class="avatar"></span>';
 if(f.t==='check')return v?'✔️':'—';
 if(f.t==='ref')return esc(refName(f.ref,v));
 if(f.fmt==='money')return v?esc(money(v)):'—';
 if(f.tag)return v?'<span class="tag '+tagClass(v)+'">'+esc(v)+'</span>':'—';
 return v||v===0?esc(v):'—';
}
let page='dash';
/* ============ الصلاحيات ============ */
const COACH_PAGES=['att','scan','players','trainings'];
// أدوار جاهزة إضافية: يختار المدير الدور ثم يحدد الأقسام والصلاحيات بدقة.
const ROLE_LABELS={admin:'مدير',member:'عضو',coach:'مدرب',accountant:'محاسب',reception:'استقبال',registrar:'مسؤول التسجيل',viewer:'قارئ فقط'};
const ROLE_OPTIONS=[['member','عضو'],['coach','مدرب'],['accountant','محاسب'],['reception','استقبال'],['registrar','مسؤول التسجيل'],['viewer','قارئ فقط'],['admin','مدير']];
const PERM_APPEARANCE={id:'appearance',i:'🎨',l:'اختيار نمط مظهر التطبيق'};
const APP_STYLE_OPTIONS=[
 {id:'ams',label:'أسود وذهبي',icon:'🟡'},
 {id:'alwiam',label:'الوئام الأخضر',icon:'🟢'},
 {id:'sport-blue',label:'أزرق رياضي',icon:'🔵'},
 {id:'violet',label:'بنفسجي',icon:'🟣'}
];
function roleText(r){return ROLE_LABELS[r]||'دور مخصص';}
function roleOptionsHTML(selected){return ROLE_OPTIONS.map(function(x){return '<option value="'+x[0]+'" '+(x[0]===selected?'selected':'')+'>'+x[1]+'</option>';}).join('');}
let role=sessionStorage.getItem('fsm_role')||'';
let coachId=sessionStorage.getItem('fsm_coach')||'';
function myCoach(){return coachId?((db.coaches||[]).find(c=>c.id===coachId)||null):null;}
function parseCats(s){return String(s||'').split(/[^A-Za-z0-9\u0621-\u064a]+/).map(x=>x.trim()).filter(Boolean);}
function myCats(){const c=myCoach();if(!c)return [];return parseCats(c.teams).filter(x=>CATS.indexOf(x)>=0);}
function catAllowed(cat){if(isAdmin())return true;const cs=myCats();if(!cs.length)return true;return cs.indexOf(String(cat||''))>=0;}
function playerAllowed(p){return isAdmin()||catAllowed(p&&p.cat);}
function trainAllowed(t){if(isAdmin())return true;const tm=(db.teams||[]).find(x=>x.id===(t&&t.team));return catAllowed(tm?tm.cat:'');}
function lockOn(){return !!db.settings.lock;}
/* ==== حساب تطبيق سطح المكتب (Electron): مدير/عضو/مدرب مع صلاحيات دقيقة يحدّدها المدير ==== */
let acctInfo=null;
let acctReady=!window.electronAPI;
let mobileInfo=null;
try{mobileInfo=window.__malaabnaMobileSession||null;if(mobileInfo&&mobileInfo.expiresAt&&mobileInfo.expiresAt<Date.now()){sessionStorage.removeItem('fsm_mobile_session');mobileInfo=null;}if(mobileInfo&&mobileInfo.user)acctInfo=mobileInfo.user;}catch(e){mobileInfo=null;}
function isMobileWeb(){return !window.electronAPI&&/^https?:$/.test(location.protocol);}
function syncServerUrlAllowed(value){
 try{
  const u=new URL(String(value||'').trim());
  if(u.username||u.password)return false;
  return u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname.toLowerCase()));
 }catch(e){return false;}
}
function updateSchoolManifest(){
 try{
  const code=String((mobileInfo&&mobileInfo.code)||new URLSearchParams(location.search).get('c')||db.settings.syncCode||'').trim().toUpperCase();
  const link=document.querySelector('link[rel="manifest"]');
  if(link&&code){
   const base=link.getAttribute('data-base')||link.getAttribute('href')||'manifest.webmanifest';
   link.setAttribute('data-base',base.split('?')[0]);
   link.setAttribute('href',base.split('?')[0]+'?c='+encodeURIComponent(code)+'&v=1');
  }
 }catch(e){}
}
function mobileLoginHTML(){
 const qp=new URLSearchParams(location.search),qCode=(qp.get('c')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16),qUser=(qp.get('u')||'').slice(0,60);
 const server=(qCode&&isMobileWeb()?location.origin:(db.settings.serverUrl||DEFAULT_SERVER)).replace(/\/+$/,'');
 return '<div style="max-width:460px;margin:7vh auto"><div class="card" style="text-align:center"><div style="font-size:46px">⚽</div><h2 style="margin:6px 0">دخول المستخدم من الهاتف</h2><div class="sub">أدخل بيانات الحساب التي أنشأها المدير، ثم ستظهر لك الأقسام المسموحة فقط.</div><div class="mf" style="text-align:start"><label>رابط الخادم</label><input id="mobServer" value="'+esc(server)+'" placeholder="https://example.com"></div><div class="mf" style="text-align:start;margin-top:10px"><label>رمز المدرسة</label><input id="mobCode" value="'+esc(qCode||db.settings.syncCode||'')+'" style="text-transform:uppercase" placeholder="A1B2C3D4"></div><div class="mf" style="text-align:start;margin-top:10px"><label>اسم المستخدم</label><input id="mobUser" autocomplete="username" value="'+esc(qUser)+'"></div><div class="mf" style="text-align:start;margin-top:10px"><label>كلمة السر</label><input id="mobPass" type="password" autocomplete="current-password" '+actionAttr('keydown',e=>{if(e.key==='Enter')mobileLogin();})+'></div><button id="mobLoginBtn" class="btn primary" style="margin-top:14px;width:100%" '+actionAttr('click',()=>mobileLogin())+'>دخول</button><div id="mobLoginMsg" class="sub" style="margin-top:12px;color:var(--red)"></div><div class="sub" style="margin-top:14px">إذا لم يكن لديك حساب، اطلب من المدير رابط دعوة. ونسيت كلمة السر؟ اطلب منه رابط إعادة تعيين.</div></div></div>';
}
async function mobileLogin(){
 const btn=document.getElementById('mobLoginBtn'),msg=document.getElementById('mobLoginMsg');const url=String((document.getElementById('mobServer')||{}).value||'').trim().replace(/\/+$/,'');const code=String((document.getElementById('mobCode')||{}).value||'').trim().toUpperCase();const username=String((document.getElementById('mobUser')||{}).value||'').trim();const password=String((document.getElementById('mobPass')||{}).value||'');
 if(!url||!code||!username||!password){if(msg)msg.textContent='أكمل رابط الخادم ورمز المدرسة وبيانات الحساب.';return;}
 if(!syncServerUrlAllowed(url)){if(msg)msg.textContent='استخدم رابط HTTPS للخادم، أو HTTP على هذا الجهاز فقط (localhost).';return;}
 if(btn){btn.disabled=true;btn.textContent='جارٍ تحميل البيانات…';}if(msg)msg.textContent='';
 try{const r=await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,username,password})});const j=await r.json().catch(()=>null);if(!r.ok||!j||!j.ok)throw new Error((j&&j.message)||('HTTP '+r.status));mobileInfo={token:j.token,expiresAt:j.expiresAt,serverUrl:url,code:code,user:j.user};sessionStorage.setItem('fsm_mobile_session',JSON.stringify(await window.encryptMalaabnaFile(JSON.stringify(mobileInfo))));window.__malaabnaMobileSession=mobileInfo;acctInfo=j.user;applySavedAppStyle();db=Object.assign(JSON.parse(JSON.stringify(blank)),j.db||seed());db.settings.serverUrl=url;db.settings.syncCode=code;db.settings.syncSecret='';db.settings.syncAuto=j.user.role==='admin';db.settings.syncOpen=false;db.settings.syncBase=j.updatedAt||'';if(j.files){for(const k in j.files){try{await idbPut(k,j.files[k]);}catch(e){}}}const migrated=migrateSalaryAdvancePlans();if(j.db)await markSyncAcknowledged(j.db,j.updatedAt);await persistDbSnapshot();setCloudStatus('idle');syncSnapshotSave(j.db||db);page='dash';render();if(migrated&&syncOn())setTimeout(()=>cloudPush(true),500);syncToast('✅ تم تسجيل الدخول من الهاتف');}
 catch(e){if(msg)msg.textContent='❌ '+e.message;}
 finally{if(btn){btn.disabled=false;btn.textContent='دخول';}}
}
async function mobileLogout(){try{if(mobileInfo)await fetch((mobileInfo.serverUrl||'').replace(/\/+$/,'')+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+mobileInfo.token}});}catch(e){}sessionStorage.removeItem('fsm_mobile_session');mobileInfo=null;acctInfo=null;role='';localStorage.removeItem('fsm_sync_base');window.lockMalaabnaVault();}
async function mobileValidateSession(){if(!isMobileWeb()||!mobileInfo)return;if(!syncServerUrlAllowed(mobileInfo.serverUrl)){sessionStorage.removeItem('fsm_mobile_session');mobileInfo=null;acctInfo=null;window.lockMalaabnaVault();return;}try{const r=await fetch((mobileInfo.serverUrl||'').replace(/\/+$/,'')+'/api/auth/data',{method:'POST',headers:{Authorization:'Bearer '+mobileInfo.token}});if(!r.ok){sessionStorage.removeItem('fsm_mobile_session');mobileInfo=null;acctInfo=null;window.lockMalaabnaVault();}}catch(e){}}
function acctPerms(){return (acctInfo&&Array.isArray(acctInfo.permissions))?acctInfo.permissions:[];}
function isAdmin(){
 if(window.electronAPI&&!acctReady)return false;
 if(acctInfo&&acctInfo.role!=='admin')return false; // حساب عضو/مدرب على مستوى التطبيق: مقيّد دائماً مهما كان الرمز الداخلي
 return !lockOn()||role==='admin';
}
function isCoach(){return lockOn()&&((acctInfo&&acctInfo.role==='coach')||role==='coach');}
/* صلاحية «عرض البيانات الحساسة» يمنحها المدير لكل حساب. بدونها تُحجب الحقول الحساسة عن غير المدير. */
const SENS_FIELDS={
 parents:['phone','phone2','email','cin','address','job','att','portalCode'],
 coaches:['phone','email','diploma','pin','cin','address','att','salary'],
 players:['pphone','phone','address','health','att','consentSignature'],
 injuries:['area','severity','followupDate','status','clearanceDate','clearanceBy','guardianNotified','notes']
};
const SENS_PAGES=['wa','family','portal','docs','docscan','injuries']; // أقسام تعرض بيانات حساسة بطبيعتها: تحتاج صلاحية القسم + صلاحية البيانات الحساسة
const ADMIN_ONLY_PAGES=['settings','system']; // فيها أسرار (المزامنة، Gemini، الرموز): للمدير فقط دائماً
const PERM_SENSITIVE={id:'sensitive',i:'🔒',l:'عرض البيانات الحساسة (هاتف، بطاقة وطنية، عنوان، مرفقات، ملاحظات صحية)'};
function permItems(){return NAV.filter(n=>!n.sep&&ADMIN_ONLY_PAGES.indexOf(n.id)<0).concat([PERM_SENSITIVE,PERM_APPEARANCE]);}
function canSeeSensitive(){
 if(isAdmin())return true;
 if(acctInfo&&acctInfo.role!=='admin')return acctPerms().indexOf('sensitive')>=0;
 return false; // مدرب برمز داخلي (نسخة الويب): لا يرى الحقول الحساسة
}
function canPage(id){
 if(isAdmin())return true;
 if(ADMIN_ONLY_PAGES.indexOf(id)>=0)return false;
 if(SENS_PAGES.indexOf(id)>=0&&!canSeeSensitive())return false;
 if(acctInfo&&acctInfo.role!=='admin'){return id==='dash'||acctPerms().indexOf(id)>=0;}
 return COACH_PAGES.indexOf(id)>=0;
}
function canChooseAppStyle(){return !!(acctInfo&&acctInfo.role==='admin')||isAdmin()||acctPerms().indexOf(PERM_APPEARANCE.id)>=0;}
function appStyleStorageKey(){
 const user=(acctInfo&&acctInfo.id)?acctInfo:(mobileInfo&&mobileInfo.user&&mobileInfo.user.id?mobileInfo.user:null);
 const id=user&&user.id?String(user.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,80):'';
 return 'fsm_ui_style_'+(id?'user_'+id:'device');
}
function appStyle(){
 const current=document.documentElement.getAttribute('data-style');
 return APP_STYLE_OPTIONS.some(x=>x.id===current)?current:'ams';
}
function applySavedAppStyle(){
 let style='ams';
 if(canChooseAppStyle()){
  try{const saved=localStorage.getItem(appStyleStorageKey());if(APP_STYLE_OPTIONS.some(x=>x.id===saved))style=saved;}catch(e){}
 }
 document.documentElement.setAttribute('data-style',style);
 return style;
}
function setAppStyle(style){
 if(!canChooseAppStyle()){document.documentElement.setAttribute('data-style','ams');return false;}
 if(!APP_STYLE_OPTIONS.some(x=>x.id===style))return false;
 document.documentElement.setAttribute('data-style',style);
 try{localStorage.setItem(appStyleStorageKey(),style);}catch(e){}
 return true;
}
function appStylePickerHTML(){
 if(!canChooseAppStyle())return '';
 const style=appStyle();
 return '<label class="style-picker"><span class="sr-only">نمط التطبيق</span><select class="style-select" aria-label="اختيار نمط مظهر التطبيق" title="اختيار نمط مظهر التطبيق" '+actionAttr('change',(_,el)=>setAppStyle(el.value))+'>'+
  APP_STYLE_OPTIONS.map(x=>'<option value="'+x.id+'" '+(x.id===style?'selected':'')+'>'+x.icon+' '+esc(x.label)+'</option>').join('')+
  '</select></label>';
}
function roleLabel(){
 if(acctInfo&&acctInfo.role){
  const base=roleText(acctInfo.role);
  return acctInfo.role==='coach'&&myCoach()?base+': '+myCoach().name:base;
 }
 if(role==='coach'){const c=myCoach();const cs=myCats();return 'مدرب'+(c?': '+c.name:'')+(cs.length?' ('+cs.join('، ')+')':'');}
 return 'مدير';
}
function denied(){alert('هذا القسم غير متاح لحسابك. تواصل مع مدير النظام لمنحك الصلاحية المناسبة.');}
function loginHTML(){
 return '<div style="max-width:420px;margin:6vh auto">'+
  '<div class="card" style="text-align:center">'+
  (db.settings.logo?'<img src="'+safeImg(db.settings.logo)+'" style="width:74px;height:74px;object-fit:cover;border-radius:14px;margin-bottom:10px">':'<div style="font-size:44px">⚽</div>')+
  '<h2 style="margin:6px 0">'+esc(db.settings.school||'')+'</h2>'+
  '<div class="sub" style="margin-bottom:16px">اختر نوع الحساب ثم أدخل الرمز السري</div>'+
  '<div class="mf full"><label>الرمز السري</label><input id="pinIn" type="password" inputmode="numeric" placeholder="••••" '+actionAttr('keydown',e=>{if(e.key==='Enter')doLogin('admin');})+'></div>'+
  '<div style="display:flex;gap:8px;margin-top:14px">'+
  '<button class="btn primary" style="flex:1" '+actionAttr('click',()=>doLogin('admin'))+'>👔 دخول كمدير</button>'+
  '<button class="btn" style="flex:1" '+actionAttr('click',()=>doLogin('coach'))+'>🧑‍🏫 دخول كمدرب</button></div>'+
  '<div id="loginMsg" class="sub" style="margin-top:12px;color:var(--red)"></div>'+
  '<div class="sub" style="margin-top:14px">كل مدرب يدخل برمزه الخاص ويرى حضور فئاته فقط.</div>'+
  '</div></div>';
}
function doLogin(r){
 const v=(document.getElementById('pinIn')||{}).value||'';
 const fail=function(){const m=document.getElementById('loginMsg');if(m)m.textContent='❌ الرمز السري غير صحيح';};
 const val=String(v).trim();
 if(r==='coach'){
  const c=(db.coaches||[]).find(x=>String(x.pin||'').trim()&&String(x.pin).trim()===val&&x.status!=='مغادر');
  const gen=String(db.settings.pinCoach||'').trim();
  if(c){coachId=c.id;sessionStorage.setItem('fsm_coach',c.id);}
  else if(val===gen&&gen){coachId='';sessionStorage.removeItem('fsm_coach');}
  else if(!gen&&!(db.coaches||[]).some(x=>String(x.pin||'').trim())){coachId='';sessionStorage.removeItem('fsm_coach');}
  else {fail();return;}
 }else{
  const want=String(db.settings.pinAdmin||'').trim();
  if(want&&val!==want){fail();return;}
  coachId='';sessionStorage.removeItem('fsm_coach');
 }
 role=r;sessionStorage.setItem('fsm_role',r);
 page=isAdmin()?'dash':'att';
 render();
}
function logout(){role='';coachId='';sessionStorage.removeItem('fsm_role');sessionStorage.removeItem('fsm_coach');page='dash';if(typeof stopScan==='function')stopScan();render();}
function toggleMenu(btn){const side=document.getElementById('side');const scrim=document.getElementById('mobileScrim');if(!side)return;const open=side.classList.toggle('open');if(scrim)scrim.classList.toggle('on',open);if(btn)btn.setAttribute('aria-expanded',open?'true':'false');}
function closeMobileMenu(){const side=document.getElementById('side');const scrim=document.getElementById('mobileScrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('on');}
function go(p){if(!canPage(p)){denied();return;}if(page==='scan'&&p!=='scan')stopScan();page=p;closeMobileMenu();render();if(p==='system')loadSystemStatus();}
function mobileNavHTML(){
 const quick=[['dash','📊','الرئيسية'],['players','👕','اللاعبون'],['trainings','🗓️','التداريب'],['att','✅','الحضور']].filter(x=>canPage(x[0]));
 const items=quick.slice(0,4).map(x=>'<button class="'+(page===x[0]?'on':'')+'" '+actionAttr('click',()=>go(x[0]))+'><span class="bi">'+x[1]+'</span><span>'+x[2]+'</span></button>').join('');
 return items+'<button class="more" '+actionAttr('click',(event,el)=>toggleMenu(el))+'><span class="bi">☰</span><span>المزيد</span></button>';
}
function navHTML(){
 let items=NAV;
 if(!isAdmin()){items=NAV.filter(n=>!n.sep&&canPage(n.id));}
 let out=items.map(n=>n.sep?'<div class="sep">'+n.sep+'</div>':
  '<button class="'+(page===n.id?'on':'')+'" '+actionAttr('click',()=>go(n.id))+'><span class="ico">'+n.i+'</span>'+n.l+'</button>').join('');
 if(lockOn()&&role)out+='<div class="sep">'+esc(roleLabel())+'</div><button '+actionAttr('click',logout)+'><span class="ico">🔓</span>تسجيل الخروج</button>';
 if(mobileInfo)out+='<div class="sep">'+esc(roleLabel())+'</div><button '+actionAttr('click',mobileLogout)+'><span class="ico">🔓</span>تسجيل الخروج من الهاتف</button>';
 return out;}

/* ================= المودال ================= */
let mColl=null,mId=null,mFormDirty=false;
const IDB_NAME='fsm_files',IDB_STORE='files';
let _idb=null;
function idbOpen(){return new Promise(function(res,rej){
 if(_idb)return res(_idb);
 try{const rq=indexedDB.open(IDB_NAME,1);
  rq.onupgradeneeded=function(){const d=rq.result;if(!d.objectStoreNames.contains(IDB_STORE))d.createObjectStore(IDB_STORE);};
  rq.onsuccess=function(){_idb=rq.result;res(_idb);};
  rq.onerror=function(){rej(rq.error||new Error('idb'));};
 }catch(e){rej(e);}
});}
function idbStore(mode){return idbOpen().then(function(d){return d.transaction(IDB_STORE,mode).objectStore(IDB_STORE);});}
async function idbPut(id,data){const sealed=await window.encryptMalaabnaFile(String(data||''));return idbStore('readwrite').then(function(s){return new Promise(function(res,rej){const r=s.put(sealed,id);r.onsuccess=function(){res(true);};r.onerror=function(){rej(r.error||new Error('put'));};});});}
async function idbGet(id){const value=await idbStore('readonly').then(function(s){return new Promise(function(res){const r=s.get(id);r.onsuccess=function(){res(r.result||'');};r.onerror=function(){res('');};});});return value&&value.__vaultFile===1?window.decryptMalaabnaFile(value):value;}
function idbDel(id){return idbStore('readwrite').then(function(s){return new Promise(function(res){const r=s.delete(id);r.onsuccess=function(){res(true);};r.onerror=function(){res(false);};});}).catch(function(){return false;});}
async function idbAll(){const raw=await idbStore('readonly').then(function(s){return new Promise(function(res){const out={};const r=s.openCursor();r.onsuccess=function(){const c=r.result;if(!c){res(out);return;}out[c.key]=c.value;c.continue();};r.onerror=function(){res(out);};});}).catch(function(){return {};});const out={};for(const k in raw)out[k]=raw[k]&&raw[k].__vaultFile===1?await window.decryptMalaabnaFile(raw[k]):raw[k];return out;}
function idbUsage(){return idbAll().then(function(o){let n=0;for(const k in o)n+=String(o[k]).length*0.75;return n;});}
function attIds(){const out=[];['players','parents','coaches','expenses'].forEach(function(c){(db[c]||[]).forEach(function(r){(r.att||[]).forEach(function(f){if(f&&f.id)out.push(f.id);});});});return out;}
async function idbGC(){try{const keep=attIds();const all=await idbAll();for(const k in all){if(keep.indexOf(k)<0)await idbDel(k);}}catch(e){}}
async function attData(f){if(!f)return '';if(f.idb){try{return await idbGet(f.id);}catch(e){return '';}}return f.data||'';}
async function migrateFiles(){
 try{let ch=false;
  const cs=['players','parents','coaches','expenses'];
  for(const c of cs){for(const r of (db[c]||[])){for(const f of (r.att||[])){
   if(f.data&&!f.idb){try{await idbPut(f.id,f.data);f.idb=1;f.data='';ch=true;}catch(e){}}
  }}}
  if(ch)await persistDbSnapshot();
  idbGC();
 }catch(e){}
}
function idbUsageShow(){const e=document.getElementById('idbUse');if(!e)return;idbUsage().then(function(n){e.textContent='📦 حجم الوثائق المخزّنة: '+fsize(n)+' (السعة مئات الميغابايت)';}).catch(function(){});}
const FILECATS=['شهادة طبية','عقد الازدياد','البطاقة الوطنية','عقد التسجيل','الموافقة المكتوبة','وثيقة J6','استمارة التسجيل','التأمين','صورة شمسية','شهادة مدرب','البطاقة المهنية','وصل الأداء','فاتورة المورد','أخرى'];
let mFiles=[];
function fsize(n){n=Number(n)||0;return n>1048576?(n/1048576).toFixed(1)+' م.ب':Math.max(1,Math.round(n/1024))+' ك.ب';}
function fileIcon(t){return String(t||'').indexOf('pdf')>=0?'📄':'🖼️';}
function dataURLtoBlob(d){
 try{const p=String(d).split(',');const mime=(p[0].match(/:(.*?);/)||[])[1]||'application/octet-stream';const bin=atob(p[1]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime});}catch(e){return null;}
}
async function showBlob(f){const d=await attData(f);const bl=dataURLtoBlob(d);if(!bl){alert('تعذر فتح الملف.');return;}const u=URL.createObjectURL(bl);window.open(u,'_blank');setTimeout(function(){URL.revokeObjectURL(u);},60000);}
function attFind(id){const c=['players','parents','coaches','expenses'];for(let i=0;i<c.length;i++){const r=(db[c[i]]||[]).find(x=>x.id===id);if(r)return r;}return null;}
function openAtt(id,i){const r=attFind(id);if(!r)return;showBlob((r.att||[])[i]);}
function attachmentDownloadName(f,blob,i){
 const raw=String(f&&f.name||f&&f.cat||'فاتورة-'+(Number(i)+1)).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim();
 const base=raw.replace(/\.[^.]*$/,'')||'فاتورة-'+(Number(i)+1);
 const type=String(blob&&blob.type||f&&f.type||'').toLowerCase();
 if(type==='application/pdf'||type.indexOf('pdf')>=0)return /\.pdf$/i.test(raw)?raw:base+'.pdf';
 if(type.indexOf('image/')===0)return base+'.jpg';
 return raw||base;
}
async function downloadAtt(id,i){
 const r=attFind(id),f=r&&(r.att||[])[i];if(!f)return;
 const data=await attData(f),blob=dataURLtoBlob(data);if(!blob){alert('تعذر تنزيل الملف.');return;}
 downloadReceiptPdf(blob,attachmentDownloadName(f,blob,i));
}
function openTmpFile(i){showBlob(mFiles[i]);}
function rmTmpFile(i){if(!confirm('حذف هذه الوثيقة؟'))return;mFiles.splice(i,1);filesRefresh();}
function setTmpExp(i,v){if(mFiles[i])mFiles[i].exp=v;}
function setTmpCat(i,v){if(mFiles[i])mFiles[i].cat=v;}
function filesBoxHTML(){
 if(!mFiles.length)return '<div class="sub">لم تُرفق أي وثيقة بعد.</div>';
 const isExpense=mColl==='expenses';
 const header=isExpense?'<tr><th>المرفق</th><th>النوع</th><th>الحجم</th><th>إجراء</th></tr>':'<tr><th>الوثيقة</th><th>النوع</th><th>انتهاء الصلاحية</th><th>الحجم</th><th>إجراء</th></tr>';
 return '<div class="tw"><table><thead>'+header+'</thead><tbody>'+
  mFiles.map(function(f,i){const fileCell='<td>'+fileIcon(f.type)+' '+esc(f.name||'')+'<div class="sub">'+esc(f.date||'')+'</div></td>';
   const categoryCell='<td><select '+actionAttr('change',(event,el)=>setTmpCat(i,el.value))+'>'+FILECATS.map(c=>'<option '+(f.cat===c?'selected':'')+'>'+c+'</option>').join('')+'</select></td>';
   const actions='<td><button type="button" class="btn" '+actionAttr('click',()=>openTmpFile(i))+'>👁️ عرض</button> <button type="button" class="btn" '+actionAttr('click',()=>rmTmpFile(i))+'>🗑️</button></td>';
   return '<tr>'+fileCell+categoryCell+(isExpense?'':'<td><input type="date" value="'+esc(f.exp||'')+'" '+actionAttr('change',(event,el)=>setTmpExp(i,el.value))+'></td>')+'<td>'+fsize(f.size)+'</td>'+actions+'</tr>';}).join('')+
  '</tbody></table></div>';
}
function filesRefresh(){const e=document.getElementById('filesBox');if(e)e.innerHTML=filesBoxHTML();try{idbUsageShow();}catch(x){}}
function addFiles(el){
 const cat=(document.getElementById('fileCat')||{}).value||'أخرى';
 const list=Array.prototype.slice.call(el.files||[]);
 if(!list.length)return;
 let left=list.length;
 list.forEach(function(f){
  if(f.size>6*1048576){alert('الملف "'+f.name+'" كبير جداً (أكثر من 6 م.ب). صوّره بجودة أقل أو اضغط الـ PDF.');left--;return;}
  const rd=new FileReader();
  rd.onload=function(e){
   const done=function(data){
    const fid=uid();const meta={id:fid,name:f.name,type:f.type||'',cat:cat,date:todayISO(),exp:'',size:Math.round(String(data).length*0.75),idb:1,data:''};
    const fin=function(){left--;filesRefresh();if(left<=0)el.value='';};
    idbPut(fid,data).then(function(){mFiles.push(meta);fin();}).catch(function(){meta.idb=0;meta.data=data;mFiles.push(meta);fin();});
   };
   if(String(f.type||'').indexOf('image')===0){
    const img=new Image();
    img.onload=function(){const m=1400;let w=img.width,hh=img.height;if(w>m||hh>m){const k=Math.min(m/w,m/hh);w=Math.round(w*k);hh=Math.round(hh*k);}
     const c=document.createElement('canvas');c.width=w;c.height=hh;c.getContext('2d').drawImage(img,0,0,w,hh);done(c.toDataURL('image/jpeg',0.75));};
    img.onerror=function(){done(e.target.result);};img.src=e.target.result;
   } else done(e.target.result);
  };
  rd.readAsDataURL(f);
 });
}
function attListHTML(r){
 const list=r.att||[];
 if(!list.length)return '<span class="sub">—</span>';
 return list.map(function(f,i){
  const n=f.exp?daysTo(f.exp):null;
  const cls=n===null?'t-n':(n<0?'t-r':(n<=30?'t-o':'t-g'));
  return '<button type="button" class="btn" aria-label="عرض '+esc(f.name||f.cat||'المرفق')+'" '+actionAttr('click',()=>openAtt(r.id,i))+'>'+fileIcon(f.type)+' '+esc(f.cat||f.name||'')+'</button> <button type="button" class="btn" aria-label="تنزيل '+esc(f.name||f.cat||'المرفق')+'" '+actionAttr('click',()=>downloadAtt(r.id,i))+'>📥 تنزيل</button>'+(f.exp?' <span class="tag '+cls+'">'+esc(f.exp)+'</span>':'');
 }).join(' ');
}
function playerRegistrationFeeFieldsHTML(){
 return '<div class="mf full notice"><b>رسوم التسجيل</b><div class="sub">يُحفظ إجمالي الرسوم في سجل مالي واحد، ويُطبّق الخصم أو الإعفاء على الإجمالي. تبدأ الاستحقاقات الشهرية الدورية من بداية الشهر التالي.</div></div>'+
  '<div class="mf"><label for="f_registrationDiscountType">نوع الخصم</label><select id="f_registrationDiscountType"><option value="بدون">بدون خصم</option><option value="مبلغ ثابت">مبلغ ثابت</option></select></div>'+
  '<div class="mf"><label for="f_registrationDiscountValue">قيمة الخصم</label><input id="f_registrationDiscountValue" type="number" min="0" step="0.01" value="0"></div>'+
  '<div class="mf"><label for="f_registrationDiscountReason">سبب الخصم</label><input id="f_registrationDiscountReason" type="text"></div>'+
  '<div class="mf"><label for="f_registrationExempt">إعفاء من رسوم التسجيل</label><select id="f_registrationExempt"><option value="لا">لا</option><option value="نعم">نعم</option></select></div>'+
  '<div class="mf"><label for="f_registrationExemptReason">سبب الإعفاء</label><input id="f_registrationExemptReason" type="text"></div>'+
  '<div class="mf full notice" id="playerRegistrationFeeEstimate" role="status" aria-live="polite"></div>';
}
function playerRegistrationFeeValues(){
 const get=function(id){const el=document.getElementById(id);return el?el.value:'';};
 return {discountType:get('f_registrationDiscountType')||'بدون',discountValue:get('f_registrationDiscountValue'),discountReason:get('f_registrationDiscountReason'),exempt:get('f_registrationExempt')||'لا',exemptReason:get('f_registrationExemptReason'),team:get('f_team'),fee:get('f_fee'),registrationDate:get('f_reg')};
}
function playerRegistrationFeeCalculation(values){
 const v=values||{},registrationFeeBase=Math.max(0,roundCurrency(Number(db.settings&&db.settings.registrationFee)||0)),monthlyFeeAmount=Math.max(0,roundCurrency(monthlyFeeForPlayer({team:v.team||'',fee:Number(v.fee)||0}))),base=Math.max(0,roundCurrency(registrationFeeBase+monthlyFeeAmount));
 const discountType=v.discountType==='مبلغ ثابت'?'مبلغ ثابت':'بدون';
 const discountValue=discountType==='مبلغ ثابت'?Math.max(0,Number(v.discountValue)||0):0;
 const exempt=v.exempt==='نعم'?'نعم':'لا';
 if(base<=0&&exempt!=='نعم'&&discountValue<=0)return {ok:true,skipped:true,base:0,registrationFeeBase:registrationFeeBase,monthlyFeeAmount:monthlyFeeAmount,discount:0,due:0};
 const record={kind:'رسوم التسجيل',baseDue:base,discountType:discountType,discountValue:discountValue,discountReason:String(v.discountReason||'').trim(),exempt:exempt,exemptReason:String(v.exemptReason||'').trim(),paid:0};
 const calculation=MalaabnaFinance.calculateFee(record);
 if(!calculation.ok){
  const errors={base_required:'لم تُحدد الرسوم في إعدادات المدرسة. حدّد مبلغاً قبل تطبيق الخصم.',discount_reason_required:'اكتب سبب الخصم لتوثيقه.',exemption_reason_required:'اكتب سبب الإعفاء لتوثيقه.',full_discount_requires_exemption:'الخصم يساوي كامل الرسم؛ اختر الإعفاء ووثّق سببه بدلاً من الخصم الكامل.'};
  const fields={base_required:'f_registrationDiscountValue',discount_reason_required:'f_registrationDiscountReason',exemption_reason_required:'f_registrationExemptReason',full_discount_requires_exemption:'f_registrationExempt'};
  return {ok:false,error:calculation.error,message:errors[calculation.error]||'تعذّر التحقق من رسوم التسجيل.',fieldId:fields[calculation.error]||''};
 }
 return {ok:true,skipped:false,base:calculation.base,registrationFeeBase:registrationFeeBase,monthlyFeeAmount:monthlyFeeAmount,discount:calculation.discount,due:calculation.due,exemptionAmount:calculation.exemptionAmount,exempt:calculation.exempt};
}
function updatePlayerRegistrationFeeEstimate(){
 const box=document.getElementById('playerRegistrationFeeEstimate');if(!box)return;
 const calculation=playerRegistrationFeeCalculation(playerRegistrationFeeValues());
 if(!calculation.ok){box.textContent=calculation.message;return;}
 if(calculation.skipped){box.textContent='لم تُحدد رسوم تسجيل أو اشتراك شهري؛ سيُحفظ اللاعب دون سجل رسوم. يمكنك ضبط المبالغ من إعدادات المدرسة.';return;}
 box.textContent='إجمالي رسوم التسجيل: '+money(calculation.base)+' • الخصم: '+money(calculation.discount)+' • الإعفاء: '+money(calculation.exemptionAmount||0)+' • المستحق: '+money(calculation.due)+(calculation.exempt?' — معفى بالكامل':'')+' • سجل مالي واحد.';
}
function createPlayerRegistrationFee(playerId,values,now){
 const calculation=playerRegistrationFeeCalculation(values);
 if(!calculation.ok||calculation.skipped)return calculation;
 const source=values||{};let date=now||new Date();const match=String(source.registrationDate||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(match){const candidate=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));if(candidate.getFullYear()===Number(match[1])&&candidate.getMonth()===Number(match[2])-1&&candidate.getDate()===Number(match[3]))date=candidate;}const exempt=calculation.exempt?'نعم':'لا';
 const record={id:uid(),player:playerId,kind:'رسوم التسجيل',month:MONTHS[date.getMonth()],year:date.getFullYear(),subscriptionStartsOn:subscriptionStartForMonth(MONTHS[date.getMonth()],date.getFullYear()),baseDue:calculation.base,registrationFeeBase:calculation.registrationFeeBase,discountType:source.discountType==='مبلغ ثابت'?'مبلغ ثابت':'بدون',discountValue:source.discountType==='مبلغ ثابت'?Math.max(0,Number(source.discountValue)||0):0,discountAmount:calculation.discount,discountReason:String(source.discountReason||'').trim(),exempt:exempt,exemptReason:String(source.exemptReason||'').trim(),exemptionAmount:calculation.exemptionAmount||0,due:calculation.due,paid:0,state:exempt==='نعم'?PAY[3]:PAY[2],date:exempt==='نعم'?todayISO():'',method:'',rec:exempt==='نعم'?nextReceiptNumber():'',receiptDocId:''};
 return {ok:true,record:record};
}
function openForm(coll,id){
 mFormDirty=false;clearModalError();
 if(!isAdmin()){denied();return;}
 setModalSaveAction(saveModal,'حفظ');
 mColl=coll;mId=id||null;const S=SCHEMA[coll];const r=id?db[coll].find(x=>x.id===id):{};
 mFiles=S.fields.some(f=>f.t==='files')?JSON.parse(JSON.stringify(r.att||[])):[];
 document.getElementById('mTitle').textContent=(id?'تعديل — ':'إضافة — ')+S.label;
 document.getElementById('mBody').innerHTML=S.fields.map(f=>{
  let v=r[f.k]==null?'':r[f.k];if(coll==='subs'&&f.k==='baseDue'&&r.baseDue==null)v=r.due==null?'':r.due;if(coll==='subs'&&f.k==='kind'&&!r.kind)v='اشتراك شهري';if(coll==='subs'&&!id&&f.k==='baseDue')v=Number(db.settings.fee)||0;if(coll==='subs'&&!id&&f.k==='month')v=MONTHS[new Date().getMonth()];if(coll==='subs'&&!id&&f.k==='year')v=new Date().getFullYear();if(coll==='subs'&&f.k==='discountType'&&!r.discountType)v='بدون';if(coll==='subs'&&id&&f.k==='discountType'&&r.discountType==='نسبة مئوية')v='مبلغ ثابت';if(coll==='subs'&&id&&f.k==='discountValue'&&r.discountType==='نسبة مئوية')v=discountAmount(r);if(coll==='subs'&&f.k==='discountValue'&&r.discountValue==null)v=0;if(coll==='subs'&&f.k==='exempt'&&!r.exempt)v=r.state===PAY[3]?'نعم':'لا';if(coll==='subs'&&f.k==='paid'&&r.paid==null)v=0;let inp='';
  if(f.t==='select')inp='<select id="f_'+f.k+'" '+(f.req?'required aria-required="true"':'')+'><option value=""></option>'+f.o.map(o=>'<option '+(v===o?'selected':'')+'>'+o+'</option>').join('')+'</select>';
  else if(f.t==='ref')inp='<select id="f_'+f.k+'" '+(f.req?'required aria-required="true"':'')+'><option value=""></option>'+(db[f.ref]||[]).map(x=>'<option value="'+esc(x.id)+'" '+(v===x.id?'selected':'')+'>'+esc(x[SCHEMA[f.ref].title]||x.name)+'</option>').join('')+'</select>';
  else if(f.t==='area')inp='<textarea id="f_'+f.k+'" '+(f.req?'required aria-required="true"':'')+'>'+esc(v)+'</textarea>';
  else if(f.t==='check')inp='<select id="f_'+f.k+'"><option value="" '+(!v?'selected':'')+'>لا</option><option value="1" '+(v?'selected':'')+'>نعم</option></select>';
  else if(f.t==='rate')inp='<input id="f_'+f.k+'" type="number" min="0" max="10" step="1" value="'+esc(v)+'">';
  else if(f.t==='photo')inp='<input id="f_'+f.k+'" type="file" accept="image/*" '+actionAttr('change',(event,el)=>readPhoto(el))+'><input type="hidden" id="fv_'+f.k+'" value="'+esc(v)+'">';
  else if(f.t==='files')inp='<div style="border:1px solid var(--bd);border-radius:10px;padding:12px">'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
   '<select id="fileCat" style="max-width:220px">'+FILECATS.map(c=>'<option '+(coll==='expenses'&&c==='فاتورة المورد'?'selected':'')+'>'+c+'</option>').join('')+'</select>'+
   '<input type="file" multiple accept="image/*,application/pdf" '+actionAttr('change',(event,el)=>addFiles(el))+'>'+
   '</div><div class="sub" style="margin:8px 0">'+(coll==='expenses'?'يمكن إرفاق أكثر من فاتورة بصيغة صورة أو PDF؛ الحد 6 م.ب لكل ملف. تُضغط الصور تلقائياً.':'اختر نوع الوثيقة ثم الملف (صورة أو PDF). تُضغط الصور تلقائياً.')+'</div>'+
   '<div class="sub" id="idbUse"></div><div id="filesBox">'+filesBoxHTML()+'</div></div>';
  else inp='<input id="f_'+f.k+'" type="'+({text:'text',number:'number',date:'date',time:'time',tel:'tel'}[f.t]||'text')+'" value="'+esc(v)+'" '+(f.req?'required aria-required="true"':'')+(f.t==='number'?' min="0" step="0.01"':'')+'>';
  return '<div class="mf '+(f.full?'full':'')+'"><label for="f_'+f.k+'">'+f.l+(f.req?' <span class="req" aria-hidden="true">*</span>':'')+'</label>'+inp+'</div>';
 }).join('');
 if(coll==='players'&&!id){
  const body=document.getElementById('mBody');body.insertAdjacentHTML('beforeend',playerRegistrationFeeFieldsHTML());
  ['f_registrationDiscountType','f_registrationDiscountValue','f_registrationDiscountReason','f_registrationExempt','f_registrationExemptReason','f_team','f_fee','f_reg'].forEach(function(id){const el=document.getElementById(id);if(el){el.addEventListener('input',updatePlayerRegistrationFeeEstimate);el.addEventListener('change',updatePlayerRegistrationFeeEstimate);}});
  updatePlayerRegistrationFeeEstimate();
 }
 if(coll==='subs'){const box=document.createElement('div');box.className='mf full notice';box.id='subFeeEstimate';document.getElementById('mBody').appendChild(box);['f_baseDue','f_discountType','f_discountValue','f_exempt','f_registrationInstallmentCount'].forEach(function(id){const e=document.getElementById(id);if(e){e.addEventListener('input',updateSubEstimate);e.addEventListener('change',updateSubEstimate);}});if(!id){const kind=document.getElementById('f_kind'),base=document.getElementById('f_baseDue'),body=document.getElementById('mBody');const refreshKind=function(){const isRegistration=kind&&kind.value==='رسوم التسجيل';let notice=document.getElementById('registrationFeeBundleNotice');if(isRegistration){if(!notice){body.insertAdjacentHTML('afterbegin','<div class="mf full notice" id="registrationFeeBundleNotice">يُسجّل إجمالي رسوم التسجيل والمبلغ المستحق لهذه الفترة في سجل مالي واحد. تبدأ الاستحقاقات الشهرية الدورية من بداية الشهر التالي.</div>');notice=document.getElementById('registrationFeeBundleNotice');}if(base)base.readOnly=true;updateRegistrationFeeEntryEstimate();}else{if(notice)notice.remove();if(base){base.readOnly=false;base.value=Number(db.settings.fee)||0;}updateSubEstimate();}};if(kind)kind.addEventListener('change',refreshKind);['f_player','f_month','f_year'].forEach(function(key){const e=document.getElementById(key);if(e)e.addEventListener('change',function(){if(kind&&kind.value==='رسوم التسجيل')updateRegistrationFeeEntryEstimate();});});}updateSubEstimate();}
 const ov=document.getElementById('ov');ov.classList.add('on');ov.setAttribute('aria-hidden','false');window._modalOpener=document.activeElement;setTimeout(()=>{const x=document.querySelector('#mBody input:not([type=hidden]),#mBody select,#mBody textarea');if(x)x.focus();},0);
 try{idbUsageShow();}catch(e){}
}
function readPhoto(el){const f=el.files[0];if(!f)return;const rd=new FileReader();rd.onload=e=>{const img=new Image();img.onload=()=>{const m=420;let w=img.width,h=img.height;if(w>m||h>m){const k=Math.min(m/w,m/h);w=Math.round(w*k);h=Math.round(h*k);}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);const el2=document.getElementById('fv_photo');if(el2)el2.value=c.toDataURL('image/jpeg',0.82);};img.onerror=()=>{const el2=document.getElementById('fv_photo');if(el2)el2.value=e.target.result;};img.src=e.target.result;};rd.readAsDataURL(f);}
let modalSaveBusy=false;
function setModalSaveAction(action,label){
 const b=document.querySelector('#ov .mfoot .btn.primary');if(!b)return;
 b.textContent=label||'حفظ';
 b.onclick=async function(){
  if(modalSaveBusy)return;modalSaveBusy=true;
  const controls=Array.from(document.querySelectorAll('#ov input:not(:disabled),#ov select:not(:disabled),#ov textarea:not(:disabled)'));
  controls.forEach(el=>{el.disabled=true;});b.disabled=true;
  try{await (action||saveModal)();}
  catch(error){console.error(error);showModalError('تعذر إتمام الحفظ. '+(error&&error.message||'أعد المحاولة.'));}
  finally{modalSaveBusy=false;controls.forEach(el=>{el.disabled=false;});b.disabled=false;const invalid=document.querySelector('#mBody [aria-invalid="true"]');if(invalid&&typeof invalid.focus==='function')invalid.focus({preventScroll:true});}
 };
}
function closeModal(force){if(installmentPaymentBusy||(modalSaveBusy&&force!==true))return;if(mFormDirty&&force!==true&&!confirm('لديك تغييرات غير محفوظة. هل تريد إغلاق النموذج وفقدانها؟'))return;const ov=document.getElementById('ov');if(ov.getAttribute('data-dialog-kind')==='attendance-review')attendanceReviewDocument=null;ov.classList.remove('on');ov.setAttribute('aria-hidden','true');ov.removeAttribute('data-dialog-kind');mColl=null;mId=null;mFormDirty=false;clearModalError();setModalSaveAction(saveModal,'حفظ');if(window._modalOpener&&window._modalOpener.focus)window._modalOpener.focus();}
function markModalDirty(){mFormDirty=true;}
function clearModalError(){const box=document.getElementById('mError');if(box){box.textContent='';box.hidden=true;}const body=document.getElementById('mBody');if(body)body.querySelectorAll('[aria-invalid="true"]').forEach(function(el){el.removeAttribute('aria-invalid');if(el.getAttribute('aria-describedby')==='mError')el.removeAttribute('aria-describedby');});}
function showModalError(message,el){const box=document.getElementById('mError');if(box){box.textContent=message;box.hidden=false;}if(el){el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','mError');if(!el.disabled)el.focus({preventScroll:true});}const ov=document.getElementById('ov');if(ov)ov.scrollTop=0;const body=document.getElementById('mBody');if(body)body.scrollTop=0;}
function clearModalFieldError(event){const el=event&&event.target;if(!el||!el.matches)return;if(el.matches('[aria-invalid="true"]')){el.removeAttribute('aria-invalid');if(el.getAttribute('aria-describedby')==='mError')el.removeAttribute('aria-describedby');}const box=document.getElementById('mError');if(box&&!box.hidden){box.textContent='';box.hidden=true;}}
async function saveModal(){
 if(!isAdmin()){denied();return;}
 const S=SCHEMA[mColl];const existing=mId?db[mColl].find(x=>x.id===mId):null;const rec=existing?JSON.parse(JSON.stringify(existing)):{id:uid()};
 for(const f of S.fields){const el=document.getElementById((f.t==='photo'?'fv_':'f_')+f.k);if(f.req&&(!el||!String(el.value||'').trim())){showModalError('يرجى إدخال الحقل المطلوب: '+f.l,el);return;}if((f.t==='number'||f.t==='rate')&&el&&el.value!==''&&!Number.isFinite(Number(el.value))){showModalError('قيمة غير صحيحة في: '+f.l,el);return;}}
 const wasEdit=!!mId;let registrationInstallmentRows=null,registrationInstallmentCount=1,playerRegistrationFee=null,playerRegistrationFeeSkipped=false,playerRegistrationReceiptSeqBefore,playerRegistrationReceiptSeqHadValue=false;
 for(const f of S.fields){
  let v;
  if(f.t==='files'){rec[f.k]=mFiles.slice();continue;}
  if(f.t==='photo')v=document.getElementById('fv_'+f.k).value;
  else v=document.getElementById('f_'+f.k).value;
  if(f.t==='number'||f.t==='rate')v=v===''?'':Number(v);
  if(f.t==='check')v=!!v;
  rec[f.k]=v;
 }
 if((mColl==='players'||mColl==='parents')&&!dailyDuplicateCheck(mColl,rec,mId))return;
 if(mColl==='players'&&!wasEdit){
  playerRegistrationReceiptSeqHadValue=Object.prototype.hasOwnProperty.call(db.settings,'receiptSeq');playerRegistrationReceiptSeqBefore=db.settings.receiptSeq;
  const feeResult=createPlayerRegistrationFee(rec.id,playerRegistrationFeeValues());
  if(!feeResult.ok){showModalError(feeResult.message,feeResult.fieldId?document.getElementById(feeResult.fieldId):null);return;}
  playerRegistrationFee=feeResult.record||null;playerRegistrationFeeSkipped=feeResult.skipped===true;
 }
 if(mColl==='injuries'&&!rec.status)rec.status='تحت المتابعة';
 if(mColl==='injuries'&&!rec.guardianNotified)rec.guardianNotified='لا';
 if(mColl==='injuries'&&rec.status==='تم توثيق تصريح طبي بالعودة'&&(!rec.clearanceDate||!String(rec.clearanceBy||'').trim())){showModalError('وثّق تاريخ التصريح الطبي والجهة أو المرجع قبل تسجيل العودة.');return;}
 if(mColl==='expenses'&&existing&&existing.salaryAdvancePlanId){
  const plan=(db.salaryAdvances||[]).find(function(p){return p.id===existing.salaryAdvancePlanId;});
  if(!plan){showModalError('تعذر العثور على خطة التسبيق المرتبطة بهذه الدفعة.');return;}
  if(rec.cat!=='تسبيقات الأجور'){showModalError('لا يمكن تغيير نوع دفعة مرتبطة بخطة تسبيق.');return;}
  const otherCents=advancePayments(plan).filter(function(x){return x.id!==existing.id;}).reduce(function(sum,x){return sum+Math.round((Number(x.amount)||0)*100);},0);
  if(Math.round((Number(rec.amount)||0)*100)+otherCents>Math.round(Number(plan.total)*100)){showModalError('مجموع الدفعات سيتجاوز إجمالي الخطة. خفّض المبلغ أو أعد جدولة الخطة.');return;}
 }
 if(mColl==='subs'){
  if(existing&&Array.isArray(existing.paymentHistory)&&existing.paymentHistory.length&&MalaabnaFinance.hasFinancialChanges(existing,rec)){showModalError('هذا السجل مرتبط بأداءات موثقة. استخدم «تسجيل أداء» لإضافة مبلغ، ولا تعدّل بياناته المالية مباشرة.');return;}
  rec.kind=rec.kind||'اشتراك شهري';rec.discountType=rec.discountType||'بدون';rec.exempt=rec.exempt||'لا';
  if(rec.kind==='اشتراك شهري'&&db.subs.some(x=>x.id!==rec.id&&x.player===rec.player&&(x.kind||'اشتراك شهري')==='اشتراك شهري'&&x.month===rec.month&&Number(x.year)===Number(rec.year))){showModalError('يوجد اشتراك شهري لهذا اللاعب في الشهر والسنة نفسيهما. راجع السجل الموجود بدلاً من تكراره.');return;}
  if(rec.kind==='اشتراك شهري'&&(!rec.month||!Number(rec.year))){showModalError('حدّد الشهر والسنة للاشتراك الشهري.');return;}
  if(rec.kind==='اشتراك شهري'&&db.subs.some(function(x){return x.player===rec.player&&x.kind==='رسوم التسجيل'&&isMonthlyPeriodBeforeStart(rec.month,rec.year,x);})){showModalError('لا يمكن تسجيل اشتراك شهري لفترة تسبق تاريخ بدء الاشتراكات الدورية المسجل للاعب.');return;}
  if(rec.kind==='رسوم التسجيل'){const d=new Date();rec.month=rec.month||MONTHS[d.getMonth()];rec.year=Number(rec.year)||d.getFullYear();if(!wasEdit)rec.subscriptionStartsOn=subscriptionStartForMonth(rec.month,rec.year);}
  const calculation=MalaabnaFinance.calculateFee(rec);
  const feeErrors={base_required:'أدخل المبلغ الأصلي، أو سجّل إعفاءً مع توضيح سببه.',percent_over_100:'لا يمكن أن تتجاوز نسبة الخصم 100٪.',discount_reason_required:'اكتب سبب الخصم لتوثيق القرار.',exemption_reason_required:'اكتب سبب الإعفاء لتوثيقه.',full_discount_requires_exemption:'الخصم الكامل يساوي الإعفاء؛ اختر «نعم» في حقل الإعفاء ووثّق السبب.',exempt_and_paid:'لا يمكن الجمع بين الإعفاء ومبلغ مؤدى. صحّح المبلغ أو أزل الإعفاء.',paid_over_due:'المبلغ المؤدى أكبر من المستحق بعد الخصم. راجع المبلغ أو الخصم.'};
  if(!calculation.ok){showModalError(feeErrors[calculation.error]||'تعذّر التحقق من المبالغ.');return;}
  const base=calculation.base,value=calculation.value,discount=calculation.discount,afterDiscount=calculation.afterDiscount,due=calculation.due,paid=calculation.paid;
  rec.baseDue=base;rec.discountValue=value;rec.discountAmount=discount;rec.exemptionAmount=calculation.exemptionAmount;rec.due=due;rec.paid=paid;
  const installmentField=document.getElementById('f_registrationInstallmentCount');if(!wasEdit&&rec.kind==='رسوم التسجيل'&&installmentField)registrationInstallmentCount=Number(installmentField.value)||1;if(registrationInstallmentCount>1&&paid>0){showModalError('أنشئ خطة التقسيط أولاً، ثم سجّل كل دفعة في سجلها المستقل.');return;}
  if(paid>0&&!rec.date)rec.date=todayISO();if(rec.exempt==='نعم'&&!rec.date)rec.date=todayISO();
  rec.state=rec.exempt==='نعم'?PAY[3]:(paid>=due&&due>0?PAY[0]:(paid>0?PAY[1]:PAY[2]));
  if((paid>0||rec.exempt==='نعم')&&!rec.rec)rec.rec=nextReceiptNumber();
  if(!wasEdit&&rec.kind==='رسوم التسجيل'&&registrationInstallmentCount>1){const split=MalaabnaFinance.splitRegistrationFee(rec,registrationInstallmentCount,uid);const splitErrors={installments_unavailable:'لا يمكن تقسيط رسم معفى أو سبق تسجيل دفعة عليه. أنشئ الخطة أولاً ثم سجّل كل دفعة على حدة.',installment_amount_too_small:'المبلغ المستحق صغير جداً لتقسيمه إلى دفعات موجبة بهذا العدد.',invalid_installment_split:'تعذر توزيع المبلغ؛ راجع قيمة الرسم والخصم.'};if(!split.ok){showModalError(splitErrors[split.error]||'تعذر إنشاء خطة التقسيط.');return;}registrationInstallmentRows=split.records;registrationInstallmentRows.forEach(function(row){row.state=PAY[2];});}
  if(existing&&existing.registrationPlanId&&(rec.player!==existing.player||rec.kind!==existing.kind)){showModalError('لا يمكن تغيير اللاعب أو نوع الرسم لدفعة ضمن خطة تقسيط.');return;}
  if(rec.kind==='رسوم التسجيل'&&db.subs.some(function(x){return x.id!==rec.id&&x.player===rec.player&&x.kind==='رسوم التسجيل'&&(!rec.registrationPlanId||x.registrationPlanId!==rec.registrationPlanId);})){showModalError('توجد رسوم تسجيل أخرى لهذا اللاعب بالفعل. عدّل السجل الموجود بدلاً من إنشاء خطة جديدة.');return;}
  if(existing&&existing.receiptIssuedAt&&MalaabnaFinance.hasFinancialChanges(existing,rec)){
   ensureReceiptSnapshot(existing);
   MalaabnaFinance.prepareReceiptCorrection(existing,rec,nextReceiptNumber);
  }
 }
 let trainingRecords=null;
 if(mColl==='trainings'){
  trainingRecords=expandTrainingSeries(rec,wasEdit);
  if(!trainingRecords)return;
  const conflicts=trainingConflicts(trainingRecords,mId);
  if(conflicts.length&&!confirm('يوجد تعارض محتمل في '+conflicts.length+' حصة:\n'+conflicts.slice(0,6).join('\n')+(conflicts.length>6?'\n…':'')+'\n\nهل تريد الحفظ رغم ذلك؟'))return;
 }
 const playerRegistrationRollback=mColl==='players'&&!wasEdit?{playerId:rec.id,feeId:playerRegistrationFee&&playerRegistrationFee.id,auditId:'',receiptSeqBefore:playerRegistrationReceiptSeqBefore,receiptSeqHadValue:playerRegistrationReceiptSeqHadValue}:null;
 if(mId){const at=db[mColl].findIndex(x=>x.id===rec.id);if(at>=0)db[mColl][at]=rec;}
 else{if(mColl==='trainings')db.trainings.push.apply(db.trainings,trainingRecords);else if(mColl==='subs'){if(registrationInstallmentRows)db.subs.push.apply(db.subs,registrationInstallmentRows);else db.subs.push(rec);}else{db[mColl].push(rec);if(mColl==='players'&&playerRegistrationFee)db.subs.push(playerRegistrationFee);}}
 let auditDetail=S.label+' — '+String(rec[S.title]||rec.name||rec.id)+(trainingRecords&&trainingRecords.length>1?' — '+trainingRecords.length+' حصص متكررة':'')+(mColl==='subs'?' — '+(rec.kind||'اشتراك شهري')+' — مستحق '+money(rec.due)+' — خصم '+money(rec.discountAmount||0)+(registrationInstallmentRows?' — خطة من '+registrationInstallmentRows.length+' دفعات':(rec.registrationInstallmentCount>1?' — الدفعة '+rec.registrationInstallment+' من '+rec.registrationInstallmentCount:''))+(rec.exempt==='نعم'?' — إعفاء: '+(rec.exemptReason||''):'')+(rec.receiptCorrectionOf?' — تصحيح للوثيقة '+rec.receiptCorrectionOf:''):'');
 if(mColl==='players'&&!wasEdit) auditDetail+=playerRegistrationFee?' — رسوم التسجيل: إجمالي '+money(playerRegistrationFee.baseDue)+'، الخصم '+money(playerRegistrationFee.discountAmount)+'، المستحق '+money(playerRegistrationFee.due)+(playerRegistrationFee.exempt==='نعم'?'، معفى: '+(playerRegistrationFee.exemptReason||''):''):playerRegistrationFeeSkipped?' — لم يُنشأ سجل رسوم التسجيل لأن المبلغ الإجمالي المحدد صفر':'';
 auditAdd(wasEdit?'تعديل سجل':'إضافة سجل',auditDetail);
 if(playerRegistrationRollback)playerRegistrationRollback.auditId=(db.audit||[])[0]&&db.audit[0].id||'';
 const savedCollection=mColl;
 if(await save()){closeModal(true);render();try{idbGC();}catch(e){}if(savedCollection==='subs')waAutoThxAfterSave(rec);}
 else if(playerRegistrationRollback){db.players=db.players.filter(function(x){return x.id!==playerRegistrationRollback.playerId;});if(playerRegistrationRollback.feeId)db.subs=db.subs.filter(function(x){return x.id!==playerRegistrationRollback.feeId;});if(playerRegistrationRollback.auditId&&Array.isArray(db.audit))db.audit=db.audit.filter(function(x){return x.id!==playerRegistrationRollback.auditId;});if(playerRegistrationRollback.receiptSeqHadValue)db.settings.receiptSeq=playerRegistrationRollback.receiptSeqBefore;else delete db.settings.receiptSeq;}
}
async function del(coll,id){if(!isAdmin()){denied();return;}const rec=db[coll].find(x=>x.id===id)||{};if(coll==='subs'&&Array.isArray(rec.paymentHistory)&&rec.paymentHistory.length){alert('لا يمكن حذف سجل مرتبط بأداءات موثقة. احتفظ به للحفاظ على كشف الحساب والوصولات.');return;}const label=(SCHEMA[coll]&&SCHEMA[coll].label)||coll;const name=rec[(SCHEMA[coll]&&SCHEMA[coll].title)||'name']||rec.name||id;if(!confirm('سيتم حذف «'+name+'» نهائياً. هل تريد المتابعة؟'))return;db[coll]=db[coll].filter(x=>x.id!==id);auditAdd('حذف سجل',label+' — '+name);if(!await save())return;render();try{idbGC();}catch(e){}}

/* ================= الصفحات ================= */
let q='';
let expenseFilters={from:'',to:'',supplier:'',category:'',status:''};
function expenseFilterRows(rows,search){
 const f=expenseFilters||{},query=String(search||'').trim().toLowerCase(),supplier=String(f.supplier||'').trim().toLowerCase();
 return (rows||[]).filter(function(x){
  const date=String(x.date||'');
  if(f.from&&(!date||date<f.from))return false;
  if(f.to&&(!date||date>f.to))return false;
  if(supplier&&String(x.benef||'').toLowerCase().indexOf(supplier)<0)return false;
  if(f.category&&x.cat!==f.category)return false;
  if(f.status&&x.status!==f.status)return false;
  if(query){
   const searchable=[x.title,x.benef,x.inv,x.cat,x.status,x.method,x.notes,x.date,x.amount].join(' ').toLowerCase();
   if(searchable.indexOf(query)<0)return false;
  }
  return true;
 });
}
function summarizeExpenseRows(rows){
 const result={count:(rows||[]).length,total:0,paid:0,pending:0,byCategory:Object.create(null),bySupplier:Object.create(null)};
 (rows||[]).forEach(function(x){
  const amount=Math.round((Number(x.amount)||0)*100)/100,status=String(x.status||'');
  result.total+=amount;
  if(status==='مؤدى')result.paid+=amount;
  else if(status==='في انتظار الأداء')result.pending+=amount;
  const category=String(x.cat||'غير محدد'),supplier=String(x.benef||'غير محدد');
  if(!result.byCategory[category])result.byCategory[category]={count:0,total:0,paid:0,pending:0};
  if(!result.bySupplier[supplier])result.bySupplier[supplier]={count:0,total:0,paid:0,pending:0};
  [result.byCategory[category],result.bySupplier[supplier]].forEach(function(group){
   group.count++;group.total+=amount;if(status==='مؤدى')group.paid+=amount;else if(status==='في انتظار الأداء')group.pending+=amount;
  });
 });
 ['total','paid','pending'].forEach(function(k){result[k]=Math.round(result[k]*100)/100;});
 [result.byCategory,result.bySupplier].forEach(function(groups){Object.keys(groups).forEach(function(k){['total','paid','pending'].forEach(function(v){groups[k][v]=Math.round(groups[k][v]*100)/100;});});});
 return result;
}
function setExpenseFilter(key,event,el){
 expenseFilters[key]=el.value;
 const text=key==='supplier',pos=text?el.selectionStart:null;
 render();
 if(text){const next=document.getElementById('expenseFilter_'+key);if(next){next.focus({preventScroll:true});try{next.setSelectionRange(pos,pos);}catch(e){}}}
}
function setExpenseCurrentMonth(){
 const now=new Date(),year=now.getFullYear(),month=now.getMonth()+1,monthText=String(month).padStart(2,'0'),last=new Date(year,month,0).getDate();
 expenseFilters.from=year+'-'+monthText+'-01';expenseFilters.to=year+'-'+monthText+'-'+String(last).padStart(2,'0');render();
}
function clearExpenseFilters(){expenseFilters={from:'',to:'',supplier:'',category:'',status:''};q='';render();}
function expenseFiltersHTML(){
 const f=expenseFilters||{};
 return '<section class="card no-print expense-filter-card"><div class="expense-filter-head"><div><h3>🔎 بحث وتصفية المصاريف</h3><p class="sub">تُطبّق الفلاتر على السجلات والإجماليات والتصدير.</p></div><div><button type="button" class="btn" '+actionAttr('click',()=>setExpenseCurrentMonth())+'>هذا الشهر</button> <button type="button" class="btn" '+actionAttr('click',()=>clearExpenseFilters())+'>مسح الفلاتر</button></div></div>'+
  '<div class="expense-filter-grid">'+
  '<label>من تاريخ<input id="expenseFilter_from" type="date" value="'+esc(f.from||'')+'" '+actionAttr('change',(event,el)=>setExpenseFilter('from',event,el))+'></label>'+
  '<label>إلى تاريخ<input id="expenseFilter_to" type="date" value="'+esc(f.to||'')+'" '+actionAttr('change',(event,el)=>setExpenseFilter('to',event,el))+'></label>'+
  '<label>المورد / المستفيد<input id="expenseFilter_supplier" type="search" placeholder="اسم المورد…" value="'+esc(f.supplier||'')+'" '+actionAttr('input',(event,el)=>setExpenseFilter('supplier',event,el))+'></label>'+
  '<label>نوع المصروف<select id="expenseFilter_category" '+actionAttr('change',(event,el)=>setExpenseFilter('category',event,el))+'><option value="">كل الأنواع</option>'+EXPC.map(function(c){return '<option value="'+esc(c)+'" '+(f.category===c?'selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></label>'+
  '<label>حالة الأداء<select id="expenseFilter_status" '+actionAttr('change',(event,el)=>setExpenseFilter('status',event,el))+'><option value="">كل الحالات</option><option '+(f.status==='مؤدى'?'selected':'')+'>مؤدى</option><option '+(f.status==='في انتظار الأداء'?'selected':'')+'>في انتظار الأداء</option></select></label>'+
  '</div></section>';
}
function expenseBreakdownHTML(groups,kind){
 const names=Object.keys(groups||{}).sort(function(a,b){return groups[b].total-groups[a].total;});
 if(!names.length)return '<p class="sub">لا توجد بيانات ضمن الفلاتر الحالية.</p>';
 return '<div class="tw"><table><thead><tr><th>'+kind+'</th><th>عدد السجلات</th><th>الإجمالي</th><th>مؤدى</th><th>معلّق</th></tr></thead><tbody>'+names.map(function(name){const x=groups[name];return '<tr><td>'+esc(name)+'</td><td>'+x.count+'</td><td>'+money(x.total)+'</td><td>'+money(x.paid)+'</td><td>'+money(x.pending)+'</td></tr>';}).join('')+'</tbody></table></div>';
}
function expenseReportHTML(rows){
 const s=summarizeExpenseRows(rows),range=(expenseFilters.from||expenseFilters.to)?'الفترة: '+(expenseFilters.from||'البداية')+' — '+(expenseFilters.to||'حتى اليوم'):'كل الفترات';
 return '<section class="expense-report"><div class="expense-report-head"><div><h2>📊 تقرير المصاريف</h2><p class="sub">'+esc(range)+' · '+s.count+' سجل</p></div><div class="no-print"><button class="btn" '+actionAttr('click',()=>exportExpenseReport(rows))+' title="تصدير Excel">📊 Excel</button> <button class="btn" '+actionAttr('click',()=>exportPDF('expense-report-'+todayISO()+'.pdf',true))+' title="طباعة أو حفظ PDF">🖨️ طباعة / PDF</button></div></div>'+
  '<div class="grid kpis">'+kpi('إجمالي المصاريف',money(s.total),'r','جميع السجلات المطابقة')+kpi('المؤدى',money(s.paid),'g','حسب حالة الأداء')+kpi('في انتظار الأداء',money(s.pending),'o','حسب حالة الأداء')+kpi('عدد السجلات',String(s.count),'b','')+'</div>'+
  '<div class="expense-breakdowns"><section><h3>حسب نوع المصروف</h3>'+expenseBreakdownHTML(s.byCategory,'النوع')+'</section><section><h3>حسب المورد / المستفيد</h3>'+expenseBreakdownHTML(s.bySupplier,'المورد / المستفيد')+'</section></div></section>';
}
function exportExpenseReport(rows){
 const s=summarizeExpenseRows(rows),range=(expenseFilters.from||expenseFilters.to)?(expenseFilters.from||'')+' — '+(expenseFilters.to||''):'كل الفترات';
 const grouped=function(groups){return Object.keys(groups).sort(function(a,b){return groups[b].total-groups[a].total;}).map(function(name){const x=groups[name];return [name,x.count,x.total,x.paid,x.pending];});};
 const details=(rows||[]).map(function(x){return [x.date||'',x.inv||'',x.title||'',x.cat||'',x.benef||'',Number(x.amount)||0,x.method||'',x.status||''];});
 exportExcel('expense-report-'+todayISO(),[
  {title:'ملخص المصاريف — '+range,headers:['المؤشر','القيمة'],rows:[['عدد السجلات',s.count],['إجمالي المصاريف',s.total],['المؤدى',s.paid],['في انتظار الأداء',s.pending]]},
  {title:'المصاريف حسب النوع',headers:['النوع','عدد السجلات','الإجمالي','المؤدى','المعلّق'],rows:grouped(s.byCategory)},
  {title:'المصاريف حسب المورد',headers:['المورد / المستفيد','عدد السجلات','الإجمالي','المؤدى','المعلّق'],rows:grouped(s.bySupplier)},
  {title:'تفاصيل المصاريف',headers:['التاريخ','رقم الفاتورة','المصروف','النوع','المورد / المستفيد','المبلغ','طريقة الأداء','الحالة'],rows:details}
 ]);
}
function advancePayments(plan){return (db.expenses||[]).filter(x=>x&&x.salaryAdvancePlanId===plan.id);}
function advancePlanTotals(plan){
 const payments=advancePayments(plan),scheduled=payments.reduce((a,x)=>a+(Number(x.amount)||0),0),paid=payments.filter(x=>x.status==='مؤدى').reduce((a,x)=>a+(Number(x.amount)||0),0);
 return {payments:payments,scheduled:Math.round(scheduled*100)/100,paid:Math.round(paid*100)/100,remaining:Math.max(0,Math.round((Number(plan.total)-paid)*100)/100),unscheduled:Math.max(0,Math.round((Number(plan.total)-scheduled)*100)/100)};
}
function salaryAdvanceExpense(plan,amount,date,method,status,index){
 const coach=(db.coaches||[]).find(c=>c.id===plan.coachId),name=(coach&&coach.name)||plan.coachName||'المدرب',n=Number(index)||1,count=Number(plan.plannedInstallmentCount)||0;
 return {id:uid(),title:'تسبيق أجر — '+name+' — الدفعة '+n+(count?'/'+count:''),cat:'تسبيقات الأجور',amount:amount,date:date,benef:name,method:method||plan.method||'نقداً',status:status||'في انتظار الأداء',notes:'دفعة '+n+(count?' من '+count:'')+' من تسبيق أجر بإجمالي '+money(plan.total),salaryAdvancePlanId:plan.id,salaryAdvanceCoachId:plan.coachId,salaryAdvanceTotal:Number(plan.total),salaryAdvanceInstallment:n,salaryAdvanceInstallmentCount:count||null};
}
function openSalaryAdvancePlan(){
 if(!isAdmin()){denied();return;}
 const coaches=(db.coaches||[]).filter(c=>c.status!=='مغادر');
 if(!coaches.length){alert('أضف ملف المدرب أولاً قبل تسجيل تسبيق الأجر.');return;}
 mColl=null;mId=null;
 document.getElementById('mTitle').textContent='💸 تقسيط تسبيق أجر لمدرب';
 const countOptions='<option value="" selected>غير محدد — جدولة مرنة</option>'+Array.from({length:23},(_,i)=>'<option value="'+(i+2)+'">'+(i+2)+' دفعات شهرية</option>').join('');
 document.getElementById('mBody').innerHTML=
  '<div class="notice" style="margin-bottom:14px">تحديد عدد الدفعات اختياري. اتركه «غير محدد» لإنشاء خطة مرنة، ثم أضف كل دفعة بمبلغها وتاريخها عند الحاجة. أو اختر عدداً لإنشاء جدول شهري متساوٍ قابل لإعادة الجدولة.</div>'+
  '<div class="ocr-fields">'+
   '<div class="mf"><label for="advanceCoach">المدرب</label><select id="advanceCoach"><option value="">— اختر المدرب —</option>'+coaches.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name||'مدرب')+'</option>').join('')+'</select></div>'+
   '<div class="mf"><label for="advanceTotal">إجمالي مبلغ التسبيق ('+esc(db.settings.currency||'درهم')+')</label><input id="advanceTotal" type="number" min="0.01" step="0.01" placeholder="مثال: 1500"></div>'+
   '<div class="mf"><label for="advanceCount">عدد الدفعات (اختياري)</label><select id="advanceCount">'+countOptions+'</select></div>'+
   '<div class="mf"><label for="advanceStartDate">تاريخ أول دفعة / بداية الخطة</label><input id="advanceStartDate" type="date" value="'+todayISO()+'"></div>'+
   '<div class="mf"><label for="advanceMethod">طريقة الصرف</label><select id="advanceMethod"><option>نقداً</option><option>تحويل بنكي</option><option>شيك</option></select></div>'+
   '<div class="mf full notice" id="advancePlanPreview" role="status" aria-live="polite"></div>'+
  '</div>';
 setModalSaveAction(saveSalaryAdvancePlan,'إنشاء الخطة');
 const ov=document.getElementById('ov');ov.classList.add('on');ov.setAttribute('aria-hidden','false');window._modalOpener=document.activeElement;
 ['advanceTotal','advanceCount','advanceStartDate'].forEach(function(id){const e=document.getElementById(id);if(e){e.addEventListener('input',updateSalaryAdvanceEstimate);e.addEventListener('change',updateSalaryAdvanceEstimate);}});
 updateSalaryAdvanceEstimate();
 setTimeout(()=>{const e=document.getElementById('advanceCoach');if(e)e.focus();},0);
}
function updateSalaryAdvanceEstimate(){
 const amount=Number((document.getElementById('advanceTotal')||{}).value),countRaw=String((document.getElementById('advanceCount')||{}).value||''),count=Number(countRaw),start=(document.getElementById('advanceStartDate')||{}).value;
 const box=document.getElementById('advancePlanPreview');if(!box)return;
 if(!countRaw){box.textContent=Number.isFinite(amount)&&amount>0?'خطة مرنة بإجمالي '+money(amount)+'. لن يُفرض عدد مسبق؛ أضف الدفعات لاحقاً بمبالغ وتواريخ مستقلة.':'اكتب إجمالي مبلغ التسبيق. عدد الدفعات اختياري، ويمكن تحديده لاحقاً.';return;}
 const split=MalaabnaFinance.splitAdvanceAmount(amount,count),schedule=MalaabnaFinance.monthlyInstallmentDates(start,count);
 if(!split.ok){box.textContent=split.error==='installment_amount_too_small'?'المبلغ صغير جداً لتوزيعه على دفعات موجبة.':'أدخل إجمالي المبلغ لعرض توزيع الدفعات.';return;}
 if(!schedule.ok){box.textContent='أدخل تاريخاً صحيحاً لبدء صرف الدفعات.';return;}
 box.textContent='مجموع التسبيق: '+money(split.total)+' — '+split.amounts.map((v,i)=>'الدفعة '+(i+1)+': '+money(v)+' بتاريخ '+schedule.dates[i]).join(' • ');
}
async function saveSalaryAdvancePlan(){
 if(!isAdmin()){denied();return;}
 const coachId=String((document.getElementById('advanceCoach')||{}).value||''),coach=(db.coaches||[]).find(c=>c.id===coachId);
 const total=Number((document.getElementById('advanceTotal')||{}).value),countRaw=String((document.getElementById('advanceCount')||{}).value||''),count=countRaw?Number(countRaw):0,start=String((document.getElementById('advanceStartDate')||{}).value||''),method=String((document.getElementById('advanceMethod')||{}).value||'نقداً');
 if(!coach){alert('اختر المدرب المستفيد.');return;}
 if(!Number.isFinite(total)||total<=0){alert('أدخل مبلغاً صحيحاً للتسبيق.');return;}
 const totalRounded=Math.round(total*100)/100;
 if(totalRounded<0.01){alert('يجب أن يكون مبلغ التسبيق موجباً.');return;}
 const startCheck=MalaabnaFinance.monthlyInstallmentDates(start,2);
 if(!startCheck.ok){alert('أدخل تاريخاً صحيحاً لبداية الخطة.');return;}
 let split=null,schedule=null;
 if(count){split=MalaabnaFinance.splitAdvanceAmount(totalRounded,count);schedule=MalaabnaFinance.monthlyInstallmentDates(start,count);if(!split.ok){alert(split.error==='installment_amount_too_small'?'المبلغ صغير جداً لتوزيعه على دفعات موجبة.':'عدد الدفعات يجب أن يكون بين 2 و24.');return;}if(!schedule.ok){alert('أدخل تاريخاً صحيحاً لبدء صرف الدفعات.');return;}}
 const plan={id:uid(),coachId:coach.id,coachName:coach.name||'',total:totalRounded,startDate:start,method:method,createdAt:new Date().toISOString(),plannedInstallmentCount:count||null};
 const rows=count?split.amounts.map(function(value,index){return salaryAdvanceExpense(plan,value,schedule.dates[index],method,'في انتظار الأداء',index+1);}):[];
 if(!confirm('إنشاء خطة تسبيق بإجمالي '+money(totalRounded)+' للمدرب '+(coach.name||'')+(count?' مع '+count+' دفعات شهرية مجدولة.':' دون عدد دفعات محدد؛ ستُضاف الدفعات لاحقاً.')+'؟'))return;
 if(!Array.isArray(db.salaryAdvances))db.salaryAdvances=[];
 db.salaryAdvances.push(plan);db.expenses.push.apply(db.expenses,rows);
 auditAdd('إنشاء خطة تسبيق أجر','المدرب: '+(coach.name||'')+' — الإجمالي: '+money(totalRounded)+(count?' — '+count+' دفعات مجدولة':' — خطة مرنة بلا عدد محدد'));
 if(await save()){closeModal(true);render();}
}
async function saveAdvancePayment(planId){
 if(!isAdmin()){denied();return;}
 const plan=(db.salaryAdvances||[]).find(p=>p.id===planId);if(!plan)return;
 const amount=Number((document.getElementById('advancePaymentAmount')||{}).value),date=String((document.getElementById('advancePaymentDate')||{}).value||''),method=String((document.getElementById('advancePaymentMethod')||{}).value||plan.method||'نقداً'),status=String((document.getElementById('advancePaymentStatus')||{}).value||'في انتظار الأداء');
 const totals=advancePlanTotals(plan),cents=Math.round(amount*100),available=Math.round(totals.unscheduled*100);
 if(!Number.isFinite(amount)||cents<1){alert('أدخل مبلغاً موجباً للدفعة.');return;}
 if(cents>available){alert('المبلغ يتجاوز الجزء غير المجدول من التسبيق ('+money(totals.unscheduled)+').');return;}
 if(!MalaabnaFinance.monthlyInstallmentDates(date,2).ok){alert('أدخل تاريخاً صحيحاً لصرف الدفعة.');return;}
 const index=totals.payments.length+1,row=salaryAdvanceExpense(plan,cents/100,date,method,status,index);
 db.expenses.push(row);auditAdd('إضافة دفعة تسبيق أجر','المدرب: '+(plan.coachName||'')+' — الدفعة '+index+' — '+money(cents/100));
 if(await save()){closeModal(true);render();}
}
function openAdvancePayment(planId){
 mFormDirty=false;clearModalError();
 if(!isAdmin()){denied();return;}
 const plan=(db.salaryAdvances||[]).find(p=>p.id===planId);if(!plan)return;
 const totals=advancePlanTotals(plan);if(totals.unscheduled<=0){alert('كل المبلغ المتبقي مجدول بالفعل. أعد جدولة الدفعات الموجودة إذا لزم.');return;}
 mColl=null;mId=null;document.getElementById('mTitle').textContent='＋ إضافة دفعة تسبيق';
 document.getElementById('mBody').innerHTML='<div class="notice" style="margin-bottom:14px">المتبقي من التسبيق: <b>'+money(totals.remaining)+'</b> — غير المجدول: <b>'+money(totals.unscheduled)+'</b>. يمكنك تسجيل دفعة بمبلغ مستقل دون تحديد عدد الأقساط مسبقاً.</div>'+
  '<div class="ocr-fields"><div class="mf"><label for="advancePaymentAmount">مبلغ الدفعة ('+esc(db.settings.currency||'درهم')+')</label><input id="advancePaymentAmount" type="number" min="0.01" max="'+totals.unscheduled+'" step="0.01" placeholder="حتى '+esc(totals.unscheduled)+'"></div>'+
  '<div class="mf"><label for="advancePaymentDate">تاريخ الصرف أو الاستحقاق</label><input id="advancePaymentDate" type="date" value="'+todayISO()+'"></div>'+
  '<div class="mf"><label for="advancePaymentMethod">طريقة الصرف</label><select id="advancePaymentMethod"><option '+(plan.method==='نقداً'?'selected':'')+'>نقداً</option><option '+(plan.method==='تحويل بنكي'?'selected':'')+'>تحويل بنكي</option><option '+(plan.method==='شيك'?'selected':'')+'>شيك</option></select></div>'+
  '<div class="mf"><label for="advancePaymentStatus">الحالة</label><select id="advancePaymentStatus"><option>في انتظار الأداء</option><option>مؤدى</option></select></div></div>';
 setModalSaveAction(function(){return saveAdvancePayment(planId);},'حفظ الدفعة');const ov=document.getElementById('ov');ov.classList.add('on');ov.setAttribute('aria-hidden','false');window._modalOpener=document.activeElement;
}
function openAdvanceReschedule(planId){
 mFormDirty=false;clearModalError();
 if(!isAdmin()){denied();return;}
 const plan=(db.salaryAdvances||[]).find(p=>p.id===planId);if(!plan)return;
 const pending=advancePayments(plan).filter(x=>x.status==='في انتظار الأداء').sort((a,b)=>Number(a.salaryAdvanceInstallment||0)-Number(b.salaryAdvanceInstallment||0));
 if(!pending.length){alert('لا توجد دفعات معلّقة لإعادة جدولتها.');return;}
 mColl=null;mId=null;document.getElementById('mTitle').textContent='🗓️ إعادة جدولة الدفعات — '+(plan.coachName||'المدرب');
 document.getElementById('mBody').innerHTML='<div class="notice" style="margin-bottom:14px">عدّل تاريخ الدفعات المعلّقة فقط. الدفعات التي تم صرفها تبقى محفوظة كما هي.</div>'+
  '<div class="tw"><table><thead><tr><th>الدفعة</th><th>المبلغ</th><th>التاريخ الجديد</th></tr></thead><tbody>'+pending.map(function(x,i){return '<tr><td>'+esc('الدفعة '+(x.salaryAdvanceInstallment||i+1)+(plan.plannedInstallmentCount?'/'+plan.plannedInstallmentCount:''))+'</td><td>'+money(x.amount)+'</td><td><input id="rescheduleDate'+i+'" type="date" value="'+esc(x.date||'')+'"></td></tr>';}).join('')+'</tbody></table></div>';
 setModalSaveAction(function(){return saveAdvanceReschedule(planId,pending);},'حفظ الجدولة');const ov=document.getElementById('ov');ov.classList.add('on');ov.setAttribute('aria-hidden','false');window._modalOpener=document.activeElement;
}
async function saveAdvanceReschedule(planId,rows){
 if(!isAdmin()){denied();return;}
 const plan=(db.salaryAdvances||[]).find(p=>p.id===planId);if(!plan)return;
 const updates=rows.map(function(row,index){const date=String((document.getElementById('rescheduleDate'+index)||{}).value||'');return {row:db.expenses.find(current=>current.id===row.id&&current.salaryAdvancePlanId===planId&&current.status==='في انتظار الأداء'),date:date};});
 if(updates.some(update=>!update.row)){showModalError('تغيرت الدفعات منذ فتح النموذج. أغلقه وأعد فتحه قبل الحفظ.');return;}
 if(updates.some(function(x){return !MalaabnaFinance.monthlyInstallmentDates(x.date,2).ok;})){alert('تحقق من صحة جميع التواريخ.');return;}
 updates.forEach(function(x){x.row.date=x.date;});
 const first=advancePayments(plan).slice().sort(function(a,b){return String(a.date||'').localeCompare(String(b.date||''));})[0];if(first)plan.startDate=first.date;
 auditAdd('إعادة جدولة تسبيق أجر','المدرب: '+(plan.coachName||'')+' — '+updates.length+' دفعات');
 if(await save()){closeModal(true);render();}
}
function salaryAdvancePlansHTML(){
 const plans=(db.salaryAdvances||[]).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 if(!plans.length)return '<h2 class="sec">💸 خطط تسبيق الأجور</h2><div class="card"><div class="empty">لا توجد خطط تسبيق مسجلة بعد.</div></div>';
 return '<h2 class="sec">💸 خطط تسبيق الأجور</h2><div class="salary-advance-plans">'+plans.map(function(plan){
  const t=advancePlanTotals(plan),rows=t.payments.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))),actions=isAdmin()?'<button class="btn sm primary" '+actionAttr('click',()=>openAdvancePayment(plan.id))+'>＋ إضافة دفعة</button> <button class="btn sm" '+actionAttr('click',()=>openAdvanceReschedule(plan.id))+'>🗓️ إعادة جدولة</button>':'';
  return '<section class="card salary-advance-plan"><div class="salary-advance-head"><div><b>'+esc(plan.coachName||'المدرب')+'</b><div class="sub">بداية الخطة: '+esc(plan.startDate||'—')+' • '+(plan.plannedInstallmentCount?esc(plan.plannedInstallmentCount+' دفعات مخططة'):'عدد الدفعات مرن')+'</div></div><div class="salary-advance-actions">'+actions+'</div></div>'+
   '<div class="salary-advance-stats"><span>الإجمالي <b>'+money(plan.total)+'</b></span><span>المصروف <b>'+money(t.paid)+'</b></span><span>المتبقي للصرف <b>'+money(t.remaining)+'</b></span><span>غير المجدول <b>'+money(t.unscheduled)+'</b></span></div>'+
   (rows.length?'<div class="tw"><table><thead><tr><th>الدفعة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>'+rows.map(function(x,i){return '<tr><td>'+esc('دفعة '+(x.salaryAdvanceInstallment||i+1)+(plan.plannedInstallmentCount?'/'+plan.plannedInstallmentCount:''))+'</td><td>'+esc(x.date||'—')+'</td><td>'+money(x.amount)+'</td><td><span class="tag '+(x.status==='مؤدى'?'t-g':'t-o')+'">'+esc(x.status||'في انتظار الأداء')+'</span></td></tr>';}).join('')+'</tbody></table></div>':'<div class="empty" style="padding:12px 0">لم تُسجّل دفعات بعد؛ أضفها عند صرفها، من دون تحديد العدد مسبقاً.</div>')+'</section>';
 }).join('')+'</div>';
}
/* مركز العمل اليومي: قراءة فقط، مع احترام الصلاحيات الحالية. */
let dailyQuery='';
function dailyNormalize(value){return String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).toLowerCase().replace(/\s+/g,' ').trim();}
function dailyPhone(value){return dailyNormalize(value).replace(/[^0-9]/g,'').replace(/^00212/,'0').replace(/^212(?=\d{9}$)/,'0');}
function dailyPlayerMatches(p,query){
 const term=dailyNormalize(query);if(!term)return true;
 const par=(db.parents||[]).find(x=>x.id===p.parent)||{},team=(db.teams||[]).find(x=>x.id===p.team)||{};
 const fields=[p.name,p.id,String(p.id||'').slice(-6),p.cat,team.name];
 if(canSeeSensitive())fields.push(par.name,p.phone,p.pphone,par.phone,par.phone2);
 const text=dailyNormalize(fields.join(' '));
 return term.split(' ').every(word=>text.includes(word))||(canSeeSensitive()&&dailyPhone(term).length>=4&&[p.phone,p.pphone,par.phone,par.phone2].some(phone=>dailyPhone(phone).includes(dailyPhone(term))));
}
function dailyDuplicates(coll,rec,excludeId){
 const name=dailyNormalize(rec.name);if(!name)return [];
 return (db[coll]||[]).filter(x=>x.id!==excludeId).filter(x=>{
  if(coll==='players')return dailyNormalize(x.name)===name;
  if(coll==='parents')return (rec.cin&&dailyNormalize(x.cin).replace(/\s/g,'')===dailyNormalize(rec.cin).replace(/\s/g,''))||(dailyNormalize(x.name)===name&&dailyPhone(rec.phone)&&dailyPhone(x.phone)===dailyPhone(rec.phone));
  return false;
 });
}
function dailyDuplicateCheck(coll,rec,excludeId){
 const matches=dailyDuplicates(coll,rec,excludeId);if(!matches.length)return true;
 const strong=coll==='parents'?matches.some(x=>rec.cin&&dailyNormalize(x.cin).replace(/\s/g,'')===dailyNormalize(rec.cin).replace(/\s/g,'')):matches.some(x=>rec.birth&&x.birth===rec.birth);
 const message=strong?'يوجد سجل مطابق بالفعل (الاسم وتاريخ الازدياد، أو رقم الهوية). راجع السجل الموجود قبل الإضافة.':'يوجد سجل محتمل بالاسم نفسه. قد يكون شخصاً آخر؛ هل راجعت السجلات وتريد المتابعة دون دمجها؟';
 if(strong){showModalError(message,document.getElementById('f_name'));return false;}
 return confirm(message);
}
function dailyWorkData(){
 const allowed=canPage('players')||canPage('subs');
 const players=allowed?(db.players||[]).filter(playerAllowed):[];
 const active=players.filter(p=>p.status!=='منسحب'&&p.status!=='متوقف'),ids=new Set(active.map(p=>p.id));
 const finance=canPage('subs')?(db.subs||[]).filter(s=>ids.has(s.player)).map(s=>({s,remaining:Math.max(0,actualDue(s)-(Number(s.paid)||0))})).filter(x=>x.remaining>0):[];
 const docs=canPage('docs')&&canSeeSensitive()?(db.docs||[]).filter(d=>ids.has(d.player)&&(d.state==='ناقصة'||d.state==='منتهية الصلاحية'||(d.exp&&daysTo(d.exp)!==null&&daysTo(d.exp)<=30))):[];
 return {players,finance,docs};
}
function dailySearchInput(event,el){
 dailyQuery=el.value;const panel=document.getElementById('dailyResults');if(panel){panel.innerHTML=dailyResultsHTML(dailyWorkData());pruneAppActionHandlers();}
}
function dailyResultsHTML(data){
 if(!dailyQuery.trim())return '<p class="sub">ابحث بالاسم أو رقم العضوية'+(canSeeSensitive()?' أو اسم ولي الأمر أو الهاتف':'')+'. لا يغيّر البحث أي سجل.</p>';
 const rows=data.players.filter(p=>dailyPlayerMatches(p,dailyQuery));
 return '<p role="status">'+rows.length+' نتيجة'+(rows.length>20?' — تُعرض أول 20؛ ضيّق البحث':'')+'</p>'+(rows.length?'<ul class="daily-results">'+rows.slice(0,20).map(p=>'<li><div><b>'+esc(p.name)+'</b><div class="sub">رقم العضوية: <bdi>'+esc(String(p.id||'').slice(-6).toUpperCase())+'</bdi> · '+esc(p.cat||'بدون فئة')+'</div></div><div class="daily-actions">'+(isAdmin()?'<button class="btn" '+actionAttr('click',()=>openForm('players',p.id))+'>الملف</button>':'')+(canPlayerAccount(p.id)?'<button class="btn" '+actionAttr('click',()=>openPlayerAccount(p.id))+'>كشف الحساب</button>':'')+'</div></li>').join('')+'</ul>':'<p class="notice">لا توجد نتائج مطابقة ضمن السجلات المسموحة لك. جرّب الاسم أو رقم العضوية.</p>');
}
function dailyWorkHTML(){
 const data=dailyWorkData();if(!data.players.length&&!isAdmin())return '';
 return '<section class="card daily-work no-print" aria-labelledby="dailyTitle"><h2 id="dailyTitle">مركز العمل اليومي</h2><label for="dailySearch">البحث عن لاعب</label><input id="dailySearch" type="search" autocomplete="off" placeholder="الاسم أو رقم العضوية…" value="'+esc(dailyQuery)+'" '+actionAttr('input',dailySearchInput)+'><div id="dailyResults">'+dailyResultsHTML(data)+'</div><div class="daily-alerts">'+
 (canPage('subs')?'<details><summary>المتبقي المسجل · '+data.finance.length+' سجل</summary><p class="sub">يشمل المبالغ المتبقية في السجلات القائمة فقط، وليس حكماً بأن موعدها فات. لا تُنشأ رسوم جديدة.</p>'+(data.finance.length?'<ul>'+data.finance.slice(0,20).map(x=>'<li>'+esc(refName('players',x.s.player))+' — '+money(x.remaining)+' <button class="btn" '+actionAttr('click',()=>openPlayerAccount(x.s.player))+'>متابعة الحساب</button></li>').join('')+'</ul>':'<p>لا توجد مبالغ متبقية مسجلة للاعبين النشيطين المسموحين.</p>')+(data.finance.length>20?'<p>تُعرض أول 20 نتيجة. افتح الاشتراكات لباقي السجلات.</p>':'')+'</details>':'')+
 (canPage('docs')&&canSeeSensitive()?'<details><summary>وثائق تحتاج متابعة · '+data.docs.length+'</summary><p class="sub">وثائق مسجلة ناقصة، منتهية أو تنتهي خلال 30 يوماً. لا نفترض غياب وثيقة لم تُسجّل.</p>'+(data.docs.length?'<ul>'+data.docs.slice(0,20).map(d=>'<li>'+esc(refName('players',d.player))+' — '+esc(d.title||d.cat||'وثيقة')+' <button class="btn" '+actionAttr('click',()=>{q=d.title||d.cat||'';go('docs');})+'>مراجعة الوثائق</button></li>').join('')+'</ul>':'<p>لا توجد وثائق مسجلة تحتاج متابعة.</p>')+(data.docs.length>20?'<p>تُعرض أول 20 نتيجة؛ راجع صفحة الوثائق للبقية.</p>':'')+'</details>':'')+'</div>'+dailySetupHTML()+'</section>';
}
function dailySetupHTML(){
 if(!isAdmin())return '';
 const s=db.settings||{},school=!!String(s.school||'').trim()&&s.school!=='مدرسة كرة القدم';
 return '<details class="daily-setup"><summary>دليل إعداد المدرسة</summary><ol><li>هوية المدرسة والشعار — '+(school&&s.logo?'مهيأة':'تحتاج مراجعة')+' <button class="btn" '+actionAttr('click',()=>go('settings'))+'>الإعدادات</button></li><li>الفرق والفئات — '+((db.teams||[]).length?'توجد فرق مسجلة':'لم تُسجّل فرق بعد')+' <button class="btn" '+actionAttr('click',()=>go('teams'))+'>الفرق</button></li><li>الحسابات والصلاحيات — راجعها مع كل موظف؛ وجود حساب لا يثبت صحة الصلاحيات. <button class="btn" '+actionAttr('click',()=>openManageAccountsModal())+'>إدارة الحسابات</button></li><li>الخادم والنسخ الاحتياطي — اختبر رفع نسخة واستعادتها في بيئة منفصلة. إعداد الرابط وحده لا يعني تأكيد المزامنة. <button class="btn" '+actionAttr('click',()=>go('settings'))+'>مراجعة الإعدادات</button></li></ol><p class="sub">هذا الدليل لا يعدّل البيانات ولا يعلن اكتمال النسخ الاحتياطي تلقائياً.</p></details>';
}

function listPage(coll){
 const S=SCHEMA[coll];const cols=S.fields.filter(f=>f.col||f.req);
 let rows=db[coll].slice();
 if(!isAdmin()){if(coll==='players')rows=rows.filter(playerAllowed);if(coll==='trainings')rows=rows.filter(trainAllowed);}
 const hide=canSeeSensitive()?[]:(SENS_FIELDS[coll]||[]);
 if(coll==='expenses')rows=expenseFilterRows(rows,q);
 else if(coll==='players'&&q){rows=rows.filter(p=>dailyPlayerMatches(p,q));}
 else if(q){const s=q.trim();rows=rows.filter(r=>{const o=Object.assign({},r);hide.forEach(k=>{delete o[k];});return JSON.stringify(o).toLowerCase().includes(s.toLowerCase());});}
 const body=rows.length?rows.map(r=>'<tr>'+cols.map(f=>'<td>'+(hide.indexOf(f.k)>=0?'<span class="sub" title="يتطلب صلاحية عرض البيانات الحساسة">🔒</span>':cell(f,r))+'</td>').join('')+
  (isAdmin()?'<td class="no-print">'+(coll==='players'&&canPlayerAccount(r.id)?'<button class="btn sm" '+actionAttr('click',()=>openPlayerAccount(r.id))+'>كشف الحساب</button> ':'')+'<button class="btn sm" '+actionAttr('click',()=>openForm(coll,r.id))+'>تعديل</button> '+
  '<button class="btn sm danger" '+actionAttr('click',()=>del(coll,r.id))+'>حذف</button></td>':'<td class="no-print sub">'+(coll==='players'&&canPlayerAccount(r.id)?'<button class="btn sm" '+actionAttr('click',()=>openPlayerAccount(r.id))+'>كشف الحساب</button>':'للاطلاع فقط')+'</td>')+'</tr>').join(''):
  '<tr><td colspan="'+(cols.length+1)+'"><div class="empty">'+(q.trim()?'لا توجد نتائج مطابقة. جرّب بحثاً آخر.':'لا توجد بيانات بعد.')+'</div></td></tr>';
 const actions=isAdmin()?'<button class="btn primary" '+actionAttr('click',()=>openForm(coll))+'>＋ إضافة</button>'+(coll==='expenses'?' <button class="btn" '+actionAttr('click',()=>openSalaryAdvancePlan())+'>💸 تقسيط تسبيق أجر</button>':''):'';
 return head(S.icon+' '+S.label,rows.length+' سجل'+(coll==='expenses'?' من '+(db[coll]||[]).length:''),
  actions)+
  '<div class="tools"><input id="listSearch" aria-label="بحث السجلات" type="search" placeholder="بحث…" value="'+esc(q)+'" '+actionAttr('input',(_,el)=>{q=el.value;const pos=el.selectionStart;render();const input=document.getElementById('listSearch');if(input){input.focus({preventScroll:true});try{input.setSelectionRange(pos,pos);}catch(e){}}})+'></div>'+
  (coll==='expenses'?expenseFiltersHTML():'')+
  (coll==='expenses'?'<div class="notice" style="margin-bottom:12px">تُسجّل دفعات التسبيق كلٌّ على حدة؛ غيّر حالة كل دفعة إلى «مؤدى» بعد صرفها للمدرب.</div>':'')+
  (coll==='expenses'?salaryAdvancePlansHTML():'')+
  (coll==='expenses'?expenseReportHTML(rows):'')+
  '<div class="tw"><table><thead><tr>'+cols.map(f=>'<th>'+f.l+'</th>').join('')+'<th class="no-print">إجراءات</th></tr></thead><tbody>'+body+'</tbody></table></div>';
}
function printHead(){
 const s=db.settings;
 return '<div class="printhead">'+(s.logo?'<img src="'+safeImg(s.logo)+'">':'')+
  '<div class="pt"><h3>'+esc(s.school||'')+'</h3><div class="sub">'+esc(s.address||'')+(s.phone?' • '+esc(s.phone):'')+'</div></div>'+
  '<div class="sub" style="text-align:left">'+(s.dirName?esc(s.dirName)+'<br>'+esc(s.dirRole||'مدير المدرسة')+'<br>':'')+todayISO()+'</div></div>';
}
/* بطاقات العضوية */
let cardTeam='',cardCat='',cardPlayer='',cardStudioOpen=false,cardStudioDraft=null,cardStudioPlayerId='';
let showcasePlayerId='',showcaseMaterial='toty',showcaseFlipped=false,showcaseShowRadar=true,showcaseSignature='';
const MEMBER_CARD_FIELDS=[
 {id:'birth',label:'تاريخ الازدياد'},
 {id:'birthplace',label:'مكان الازدياد'},
 {id:'category',label:'الفئة'},
 {id:'address',label:'العنوان'},
 {id:'validity',label:'مدة الصلاحية'},
 {id:'reg',label:'تاريخ الانخراط'}
];
const MEMBER_CARD_PALETTES=[
 {id:'blue',label:'أزرق رياضي'},
 {id:'green',label:'أخضر وذهبي'},
 {id:'gold',label:'أسود وذهبي'},
 {id:'violet',label:'بنفسجي'}
];
const MEMBER_CARD_DEFAULT={title:'بطاقة اللاعب',palette:'blue',showPhoto:true,showSchoolFr:true,photoWidthMm:19,photoHeightMm:25,photoFit:'cover',photoZoomPercent:100,photoPositionX:50,photoPositionY:50,photoRotateDeg:0,photoBrightnessPercent:100,photoContrastPercent:100,photoFlipH:false,fields:{birth:true,birthplace:true,category:true,address:true,validity:true,reg:true}};
function normalizeMemberCardDesign(value){
 const source=value&&typeof value==='object'?value:{},fields=source.fields&&typeof source.fields==='object'?source.fields:{};
 const palette=MEMBER_CARD_PALETTES.some(x=>x.id===source.palette)?source.palette:MEMBER_CARD_DEFAULT.palette;
 const title=String(source.title||MEMBER_CARD_DEFAULT.title).replace(/\s+/g,' ').trim().slice(0,48)||MEMBER_CARD_DEFAULT.title;
 const dimension=(value,fallback,min,max)=>value!==null&&value!==''&&Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
 const photoFit=source.photoFit==='contain'?'contain':'cover';
 const normalizedFields={};
 MEMBER_CARD_FIELDS.forEach(x=>{normalizedFields[x.id]=typeof fields[x.id]==='boolean'?fields[x.id]:true;});
 return {title,palette,showPhoto:source.showPhoto!==false,showSchoolFr:source.showSchoolFr!==false,photoWidthMm:dimension(source.photoWidthMm,MEMBER_CARD_DEFAULT.photoWidthMm,14,23),photoHeightMm:dimension(source.photoHeightMm,MEMBER_CARD_DEFAULT.photoHeightMm,17,28),photoFit,photoZoomPercent:dimension(source.photoZoomPercent,MEMBER_CARD_DEFAULT.photoZoomPercent,100,200),photoPositionX:dimension(source.photoPositionX,MEMBER_CARD_DEFAULT.photoPositionX,0,100),photoPositionY:dimension(source.photoPositionY,MEMBER_CARD_DEFAULT.photoPositionY,0,100),photoRotateDeg:dimension(source.photoRotateDeg,MEMBER_CARD_DEFAULT.photoRotateDeg,-180,180),photoBrightnessPercent:dimension(source.photoBrightnessPercent,MEMBER_CARD_DEFAULT.photoBrightnessPercent,50,150),photoContrastPercent:dimension(source.photoContrastPercent,MEMBER_CARD_DEFAULT.photoContrastPercent,50,150),photoFlipH:source.photoFlipH===true,fields:normalizedFields};
}
function memberCardDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:(value||'—');}
function memberCardValidity(player){
 const m=String(player.reg||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),now=new Date(),year=m?+m[1]:now.getFullYear(),month=m?+m[2]:now.getMonth()+1,start=month>=9?year:year-1;
 return 'شتنبر '+start+' — يونيو '+(start+1);
}
function memberCardHTML(player,design){
 const s=db.settings,d=normalizeMemberCardDesign(design||memberCardDesign()),memberId=String(player.id||'').slice(-6).toUpperCase()||'—';
 const team=db.teams.find(t=>t.id===player.team),schoolName=!s.school||s.school==='مدرسة كرة القدم'?'مدرسة الوئام لكرة القدم':s.school;
 const category=player.cat||(team&&team.cat)||'—',qrText='MALAABNA-MEMBER|'+memberId+'|'+String(player.id||'')+'|'+String(player.name||'')+'|'+String(schoolName||'');
 const logo=s.logo?'<img src="'+safeImg(s.logo)+'" alt="شعار '+esc(s.school||'النادي')+'">':'<img src="assets/alwiam-logo.jpg" alt="شعار مدرسة الوئام">';
 const photo=player.photo?'<img class="member-photo" src="'+safeImg(player.photo)+'" alt="صورة '+esc(player.name||'اللاعب')+'">':'<div class="member-photo member-photo-empty" aria-label="لا توجد صورة"><span>👤</span></div>';
 const photoStyle=' style="--member-photo-width:'+Math.round(82*d.photoWidthMm/19)+'px;--member-photo-height:'+Math.round(112*d.photoHeightMm/25)+'px;--member-photo-mobile-width:'+Math.round(68*d.photoWidthMm/19)+'px;--member-photo-mobile-height:'+Math.round(94*d.photoHeightMm/25)+'px;--member-photo-print-width:'+d.photoWidthMm+'mm;--member-photo-print-height:'+d.photoHeightMm+'mm;--member-photo-fit:'+d.photoFit+';--member-photo-zoom:'+d.photoZoomPercent/100+';--member-photo-position-x:'+d.photoPositionX+'%;--member-photo-position-y:'+d.photoPositionY+'%;--member-photo-rotate:'+d.photoRotateDeg+'deg;--member-photo-brightness:'+d.photoBrightnessPercent/100+';--member-photo-contrast:'+d.photoContrastPercent/100+';--member-photo-flip:'+(d.photoFlipH?-1:1)+'"';
 const values={birth:memberCardDate(player.birth),birthplace:player.birthplace||'—',category:category,address:player.address||'—',validity:memberCardValidity(player)};
 const fields=MEMBER_CARD_FIELDS.filter(x=>x.id!=='reg'&&d.fields[x.id]).map(x=>'<div class="member-field"><span>'+esc(x.label)+'</span><b>'+esc(values[x.id])+'</b></div>').join('');
 const schoolFr=d.showSchoolFr?'<span class="member-school-fr">'+esc(s.schoolFr||'ECOLE ALWIAM DE FOOTBALL')+'</span>':'';
 const photoClass=d.showPhoto?'':' is-no-photo';
 const photoHTML=d.showPhoto?'<div class="member-photo-wrap">'+photo+'</div>':'';
 const regHTML=d.fields.reg?'<div class="member-foot-left"><span>تاريخ الانخراط</span><b>'+esc(memberCardDate(player.reg))+'</b></div>':'<div class="member-foot-left" aria-hidden="true"></div>';
 return '<article class="mcard member-card palette-'+d.palette+'"'+photoStyle+' aria-label="بطاقة اللاعب '+esc(player.name||'')+'">'+
  '<div class="member-head"><div class="member-logo">'+logo+'</div>'+
  '<div class="member-heading"><strong>'+esc(schoolName)+'</strong>'+schoolFr+
  '<b class="member-card-title">'+esc(d.title)+'</b></div></div>'+
  '<div class="member-body'+photoClass+'"><div class="member-qr">'+qrBox(qrText,78,'رمز التحقق')+'</div>'+
  '<div class="member-details">'+
  '<div class="member-name-field"><span>الاسم الكامل</span><b class="member-name">'+esc(player.name||'—')+'</b></div>'+
  '<div class="member-fields">'+fields+'</div><div class="member-id-line"><span>رقم المنخرط</span><b>'+esc(memberId)+'</b></div></div>'+
  photoHTML+'</div>'+
  '<div class="member-footer">'+regHTML+'<div class="member-sign">'+esc(player.status||'نشط')+'</div></div></article>';
}
function memberCardDesign(){return normalizeMemberCardDesign(db.settings.memberCardDesign);}
function canEditMemberCardDesign(){return isAdmin()||!!(acctInfo&&acctInfo.role==='admin');}
function editMemberCardDesign(){
 if(!canEditMemberCardDesign())return;
 cardStudioDraft=memberCardDesign();cardStudioOpen=true;
 const active=db.players.filter(p=>p.status!=='منسحب');
 if(!active.some(p=>p.id===cardStudioPlayerId))cardStudioPlayerId=(active[0]&&active[0].id)||'';
 render();
}
function closeMemberCardDesign(){cardStudioDraft=null;cardStudioOpen=false;render();}
function resetMemberCardDesign(){cardStudioDraft=normalizeMemberCardDesign(MEMBER_CARD_DEFAULT);render();}
function updateMemberCardDesign(key,value){
 if(!cardStudioDraft)return;
 if(key.indexOf('fields.')===0){const field=key.slice(7);if(MEMBER_CARD_FIELDS.some(x=>x.id===field))cardStudioDraft.fields[field]=!!value;}
 else if(key==='title')cardStudioDraft.title=String(value||'').slice(0,48);
 else if(key==='palette'&&MEMBER_CARD_PALETTES.some(x=>x.id===value))cardStudioDraft.palette=value;
 else if(key==='showPhoto'||key==='showSchoolFr')cardStudioDraft[key]=!!value;
 else if(key==='photoWidthMm')cardStudioDraft.photoWidthMm=Math.max(14,Math.min(23,Number(value)||MEMBER_CARD_DEFAULT.photoWidthMm));
 else if(key==='photoHeightMm')cardStudioDraft.photoHeightMm=Math.max(17,Math.min(28,Number(value)||MEMBER_CARD_DEFAULT.photoHeightMm));
 else if(key==='photoFit'&&(value==='cover'||value==='contain'))cardStudioDraft.photoFit=value;
 else if(key==='photoZoomPercent')cardStudioDraft.photoZoomPercent=Math.max(100,Math.min(200,Number.isFinite(Number(value))?Math.round(Number(value)):MEMBER_CARD_DEFAULT.photoZoomPercent));
 else if(key==='photoPositionX')cardStudioDraft.photoPositionX=Math.max(0,Math.min(100,Number.isFinite(Number(value))?Math.round(Number(value)):MEMBER_CARD_DEFAULT.photoPositionX));
 else if(key==='photoPositionY')cardStudioDraft.photoPositionY=Math.max(0,Math.min(100,Number.isFinite(Number(value))?Math.round(Number(value)):MEMBER_CARD_DEFAULT.photoPositionY));
 else if(key==='photoRotateDeg')cardStudioDraft.photoRotateDeg=Math.max(-180,Math.min(180,Number.isFinite(Number(value))?Math.round(Number(value)):MEMBER_CARD_DEFAULT.photoRotateDeg));
 else if(key==='photoBrightnessPercent')cardStudioDraft.photoBrightnessPercent=Math.max(50,Math.min(150,Number.isFinite(Number(value))?Math.round(Number(value)):MEMBER_CARD_DEFAULT.photoBrightnessPercent));
 else if(key==='photoContrastPercent')cardStudioDraft.photoContrastPercent=Math.max(50,Math.min(150,Number.isFinite(Number(value))?Math.round(Number(value)):MEMBER_CARD_DEFAULT.photoContrastPercent));
 else if(key==='photoFlipH')cardStudioDraft.photoFlipH=!!value;
 const dimensionId={photoWidthMm:'cardPhotoWidthValue',photoHeightMm:'cardPhotoHeightValue',photoZoomPercent:'cardPhotoZoomValue',photoPositionX:'cardPhotoPositionXValue',photoPositionY:'cardPhotoPositionYValue',photoRotateDeg:'cardPhotoRotateValue',photoBrightnessPercent:'cardPhotoBrightnessValue',photoContrastPercent:'cardPhotoContrastValue'}[key];
 const dimensionValue=dimensionId?document.getElementById(dimensionId):null;
 if(dimensionValue)dimensionValue.textContent=String(cardStudioDraft[key])+((key==='photoPositionX'||key==='photoPositionY'||key==='photoZoomPercent'||key==='photoBrightnessPercent'||key==='photoContrastPercent')?'%':key==='photoRotateDeg'?'°':' مم');
 const preview=document.getElementById('cardStudioPreview');
 if(preview)preview.innerHTML=memberCardStudioPreview();
}
function memberCardStudioPreview(){
 const active=db.players.filter(p=>p.status!=='منسحب'),player=active.find(p=>p.id===cardStudioPlayerId)||active[0];
 if(!player)return '<div class="empty">أضف لاعبًا أولاً لعرض المعاينة.</div>';
 return memberCardHTML(player,cardStudioDraft||memberCardDesign());
}
function memberCardStudioHTML(){
 if(!cardStudioOpen||!canEditMemberCardDesign())return '';
 const d=normalizeMemberCardDesign(cardStudioDraft||memberCardDesign()),active=db.players.filter(p=>p.status!=='منسحب');
 const paletteOptions=MEMBER_CARD_PALETTES.map(x=>'<option value="'+x.id+'" '+(x.id===d.palette?'selected':'')+'>'+esc(x.label)+'</option>').join('');
 const playerOptions=active.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===cardStudioPlayerId?'selected':'')+'>'+esc(p.name||'لاعب')+'</option>').join('');
 const fieldOptions=MEMBER_CARD_FIELDS.map(x=>'<label class="card-studio-check"><input type="checkbox" '+(d.fields[x.id]?'checked':'')+' '+actionAttr('change',(_,el)=>updateMemberCardDesign('fields.'+x.id,el.checked))+'> '+esc(x.label)+'</label>').join('');
 return '<section class="card card-studio no-print" aria-labelledby="cardStudioTitle">'+
  '<div class="card-studio-controls"><div><h2 id="cardStudioTitle">🎨 استوديو بطاقة العضوية</h2><p class="sub">عدّل القالب وشاهد معاينة مباشرة. التصميم المحفوظ يُستخدم لكل البطاقات.</p></div>'+
  '<label class="card-studio-label">عنوان البطاقة<input id="cardStudioTitleInput" maxlength="48" value="'+esc(d.title)+'" '+actionAttr('input',(_,el)=>updateMemberCardDesign('title',el.value))+'></label>'+
  '<label class="card-studio-label">ألوان القالب<select '+actionAttr('change',(_,el)=>updateMemberCardDesign('palette',el.value))+'>'+paletteOptions+'</select></label>'+
  '<label class="card-studio-label">اللاعب في المعاينة<select '+actionAttr('change',(_,el)=>{cardStudioPlayerId=el.value;const preview=document.getElementById("cardStudioPreview");if(preview)preview.innerHTML=memberCardStudioPreview();})+'>'+playerOptions+'</select></label>'+
  '<label class="card-studio-label">عرض إطار الصورة <span><output id="cardPhotoWidthValue">'+d.photoWidthMm+' مم</output></span><input type="range" min="14" max="23" step="1" value="'+d.photoWidthMm+'" aria-label="عرض إطار الصورة بالملليمتر" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoWidthMm',el.value))+'></label>'+
  '<label class="card-studio-label">ارتفاع إطار الصورة <span><output id="cardPhotoHeightValue">'+d.photoHeightMm+' مم</output></span><input type="range" min="17" max="28" step="1" value="'+d.photoHeightMm+'" aria-label="ارتفاع إطار الصورة بالملليمتر" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoHeightMm',el.value))+'></label>'+
  '<label class="card-studio-label">ملاءمة الصورة<select '+actionAttr('change',(_,el)=>updateMemberCardDesign('photoFit',el.value))+'><option value="cover" '+(d.photoFit==='cover'?'selected':'')+'>قصّ لملء الإطار</option><option value="contain" '+(d.photoFit==='contain'?'selected':'')+'>إظهار الصورة كاملة</option></select></label>'+
  '<label class="card-studio-label">تكبير الصورة <span><output id="cardPhotoZoomValue">'+d.photoZoomPercent+'%</output></span><input type="range" min="100" max="200" step="1" value="'+d.photoZoomPercent+'" aria-label="تكبير الصورة" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoZoomPercent',el.value))+'></label>'+
  '<label class="card-studio-label">موضع الصورة أفقيًا <span><output id="cardPhotoPositionXValue">'+d.photoPositionX+'%</output></span><input type="range" min="0" max="100" step="1" value="'+d.photoPositionX+'" aria-label="موضع الصورة أفقيًا" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoPositionX',el.value))+'></label>'+
  '<label class="card-studio-label">موضع الصورة عموديًا <span><output id="cardPhotoPositionYValue">'+d.photoPositionY+'%</output></span><input type="range" min="0" max="100" step="1" value="'+d.photoPositionY+'" aria-label="موضع الصورة عموديًا" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoPositionY',el.value))+'></label>'+
  '<label class="card-studio-label">تدوير الصورة <span><output id="cardPhotoRotateValue">'+d.photoRotateDeg+'°</output></span><input type="range" min="-180" max="180" step="1" value="'+d.photoRotateDeg+'" aria-label="تدوير الصورة بالدرجات" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoRotateDeg',el.value))+'></label>'+
  '<label class="card-studio-label">سطوع الصورة <span><output id="cardPhotoBrightnessValue">'+d.photoBrightnessPercent+'%</output></span><input type="range" min="50" max="150" step="1" value="'+d.photoBrightnessPercent+'" aria-label="سطوع الصورة" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoBrightnessPercent',el.value))+'></label>'+
  '<label class="card-studio-label">تباين الصورة <span><output id="cardPhotoContrastValue">'+d.photoContrastPercent+'%</output></span><input type="range" min="50" max="150" step="1" value="'+d.photoContrastPercent+'" aria-label="تباين الصورة" '+actionAttr('input',(_,el)=>updateMemberCardDesign('photoContrastPercent',el.value))+'></label>'+
  '<label class="card-studio-check"><input type="checkbox" '+(d.photoFlipH?'checked':'')+' '+actionAttr('change',(_,el)=>updateMemberCardDesign('photoFlipH',el.checked))+'> قلب الصورة أفقيًا</label>'+
  '<fieldset class="card-studio-fields"><legend>البيانات الظاهرة على البطاقة</legend>'+fieldOptions+
   '<label class="card-studio-check"><input type="checkbox" '+(d.showPhoto?'checked':'')+' '+actionAttr('change',(_,el)=>updateMemberCardDesign('showPhoto',el.checked))+'> صورة اللاعب</label>'+
   '<label class="card-studio-check"><input type="checkbox" '+(d.showSchoolFr?'checked':'')+' '+actionAttr('change',(_,el)=>updateMemberCardDesign('showSchoolFr',el.checked))+'> اسم المدرسة بالفرنسية</label>'+
   '<div class="sub card-studio-note">رمز QR ورقم المنخرط يبقيان ظاهرين للتعرّف على البطاقة. تعديل صور اللاعبين يبقى للمدير من ملفاتهم.</div></fieldset>'+
  '<div class="card-studio-actions"><button class="btn primary" '+actionAttr('click',()=>saveMemberCardDesign())+'>💾 حفظ القالب</button><button class="btn" '+actionAttr('click',()=>resetMemberCardDesign())+'>إعادة الضبط</button><button class="btn" '+actionAttr('click',()=>closeMemberCardDesign())+'>إلغاء</button></div></div>'+
  '<div class="card-studio-canvas"><b>معاينة البطاقة</b><div id="cardStudioPreview" class="card-studio-preview">'+memberCardStudioPreview()+'</div></div></section>';
}
async function saveMemberCardDesign(){
 if(!canEditMemberCardDesign()){denied();return;}
 const previous=db.settings.memberCardDesign,design=normalizeMemberCardDesign(cardStudioDraft||memberCardDesign());
 if(mobileInfo){
  const baseUpdatedAt=String(db.settings.syncBase||'');
  if(!baseUpdatedAt){syncToast('⚠️ حدّث الجلسة من حساب المدرسة قبل حفظ القالب.');return;}
  let response,result;
  try{
   response=await fetch(syncApiUrl('/api/auth/card-design'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody({design,baseUpdatedAt}))});
   result=await response.json().catch(()=>null);
  }catch(error){syncToast('⚠️ تعذر الاتصال بخادم المدرسة. لم يُحفظ القالب.');return;}
  if(!response.ok||!result||!result.ok){
   const message=response.status===404?'حدّث خادم المدرسة إلى الإصدار 3.8.52 لدعم صلاحية الاستوديو.':(result&&result.message||'تعذر حفظ القالب المشترك.');
   syncToast('⚠️ '+message);return;
  }
  db.settings.memberCardDesign=normalizeMemberCardDesign(result.design||design);
  db.settings.syncBase=String(result.updatedAt||baseUpdatedAt);
  try{await persistDbSnapshot();}catch(error){syncToast('⚠️ تم حفظ القالب على الخادم؛ أعد تسجيل الدخول لتحديث هذا الجهاز.');return;}
  cardStudioDraft=null;cardStudioOpen=false;render();syncToast('✅ حُفظ القالب المشترك. سجّل الأعضاء الخروج ثم الدخول لعرضه.');return;
 }
 if(!(isAdmin()||!!(acctInfo&&acctInfo.role==='admin'))){denied();return;}
 db.settings.memberCardDesign=design;
 if(!await save()){
  if(previous===undefined)delete db.settings.memberCardDesign;else db.settings.memberCardDesign=previous;
  return;
 }
 cardStudioDraft=null;cardStudioOpen=false;render();syncToast('✅ تم حفظ تصميم بطاقة العضوية');
}
function cardsPage(){
 if(certificatePrintId){
  const player=(db.players||[]).find(p=>p.id===certificatePrintId);
  const stats=player?progressionStats(db.evals,db.attendance,player.id):null;
  const readiness=player?certificateReadiness(player,stats,db.settings):{ready:false,reasons:['لم يُختر لاعب']};
  if(!player||!readiness.ready)return '<div class="no-print" style="display:flex;gap:8px;margin-bottom:12px"><button class="btn" '+actionAttr('click',()=>closeCertificate())+'>← عودة إلى البطاقات</button></div><div class="card"><div class="notice">تعذّر عرض الشهادة: '+readiness.reasons.map(r=>esc(r)).join('؛ ')+'.</div></div>';
  return '<div class="no-print" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button class="btn" '+actionAttr('click',()=>closeCertificate())+'>← عودة إلى البطاقات</button><button class="btn primary" '+actionAttr('click',()=>printCertificate())+'>🖨️ طباعة / PDF</button></div>'+certificateHTML(player,stats,db.settings,todayISO());
 }
 const s=db.settings,d=memberCardDesign();
 const list=db.players.filter(p=>p.status!=='منسحب'&&(!cardTeam||p.team===cardTeam)&&(!cardCat||p.cat===cardCat)&&(!cardPlayer||p.id===cardPlayer));
 const cards=list.map(p=>memberCardHTML(p,d)).join('');
 const actions=(canEditMemberCardDesign()?'<button class="btn" '+actionAttr('click',()=>editMemberCardDesign())+'>🎨 استوديو التصميم</button> ':'')+
  '<button class="btn primary" '+actionAttr('click',()=>window.print())+'>'+(cardPlayer?'🖨️ طباعة بطاقة اللاعب':'🖨️ طباعة البطاقات')+'</button>';
 return head('🪪 بطاقة العضوية',list.length+' بطاقة • اختر لاعبًا لطباعة بطاقة منفردة أو اطبع القائمة',''+actions)+
  '<div class="tools">'+
   '<select aria-label="تصفية حسب الفريق" '+actionAttr('change',(_,el)=>{cardTeam=el.value;render();})+'><option value="">كل الفرق</option>'+db.teams.map(t=>'<option value="'+esc(t.id)+'" '+(cardTeam===t.id?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select>'+
   '<select aria-label="تصفية حسب الفئة" '+actionAttr('change',(_,el)=>{cardCat=el.value;render();})+'><option value="">كل الفئات</option>'+CATS.map(c=>'<option value="'+esc(c)+'" '+(cardCat===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
   '<select aria-label="اختيار لاعب لبطاقة منفردة" '+actionAttr('change',(_,el)=>{cardPlayer=el.value;render();})+'><option value="">كل اللاعبين</option>'+db.players.filter(p=>p.status!=='منسحب').map(p=>'<option value="'+esc(p.id)+'" '+(cardPlayer===p.id?'selected':'')+'>'+esc(p.name||'لاعب')+'</option>').join('')+'</select>'+
  '</div>'+memberCardStudioHTML()+showcaseCardSection()+progressionSection()+
  (list.length?'<div class="mcards">'+cards+'</div>':'<div class="card"><div class="empty">لا يوجد لاعبون لإصدار بطاقات.</div></div>');
}
/* بطاقة العرض المنفصلة — المرحلة 2: عرض فقط، لا تغيّر البطاقة الرسمية ولا تُحفظ.
   الرادار من أحدث تقييم حقيقي فقط، والسمات محسوبة من بيانات حقيقية، والتوقيع في الذاكرة فقط. */
const SHOWCASE_MATERIALS=[
 {id:'toty',label:'أزرق نيون'},
 {id:'gold',label:'ذهبي'},
 {id:'carbon',label:'كربون'},
 {id:'diamond',label:'ماسي'},
 {id:'championship',label:'بطولة'}
];
const SHOWCASE_RADAR_KEYS=[['speed','السرعة'],['drib','المراوغة'],['pass','التمرير'],['shoot','التسديد'],['ctrl','التحكم'],['fit','اللياقة']];
function showcaseLatestEval(evals,playerId){
 const list=(evals||[]).filter(e=>e&&e.player===playerId);
 if(!list.length)return null;
 return list.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
}
function showcaseEvalValues(latestEval){
 if(!latestEval)return null;
 const values=SHOWCASE_RADAR_KEYS.map(k=>Math.max(0,Math.min(10,Number(latestEval[k[0]])||0)));
 const avg=Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10;
 return {values:values,avg:avg};
}
function showcaseAttendanceRate(attendance,playerId){
 const rows=(attendance||[]).filter(a=>a&&a.player===playerId);
 if(!rows.length)return null;
 const present=rows.filter(a=>a.state===ATT[0]||a.state===ATT[3]).length;
 return Math.round(present/rows.length*100);
}
function showcaseTraits(player,latestEval,attendanceRate){
 const traits=[];
 const evalValues=showcaseEvalValues(latestEval);
 if(evalValues&&evalValues.avg>=8)traits.push('تقييم ممتاز');
 else if(evalValues&&evalValues.avg>=7)traits.push('تقييم جيد');
 if(evalValues&&Number(latestEval.disc)>=8)traits.push('انضباط عالٍ');
 if(attendanceRate!==null&&attendanceRate!==undefined&&attendanceRate>=90)traits.push('حضور منتظم');
 if(player&&player.med&&player.ins)traits.push('الشهادة الطبية والتأمين مسجلان');
 return traits.slice(0,4);
}
function showcaseRadarSVG(values){
 const cx=60,cy=60,r=42,labels=SHOWCASE_RADAR_KEYS.map(k=>k[1]);
 const point=(i,level)=>{const angle=i*(Math.PI*2/6)-Math.PI/2;return (cx+Math.cos(angle)*r*level).toFixed(1)+','+(cy+Math.sin(angle)*r*level).toFixed(1);};
 const rings=[1,0.66,0.33].map(level=>'<polygon points="'+[0,1,2,3,4,5].map(i=>point(i,level)).join(' ')+'" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1"/>').join('');
 const polygon='<polygon points="'+values.map((v,i)=>point(i,Math.max(0,Math.min(10,v))/10)).join(' ')+'" fill="rgba(16,185,129,.35)" stroke="#10b981" stroke-width="2"/>';
 const dots=values.map((v,i)=>{const p=point(i,Math.max(0,Math.min(10,v))/10).split(',');return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3" fill="#10b981"/>';}).join('');
 const axes=labels.map((label,i)=>{const p=point(i,1.22).split(',');return '<text x="'+p[0]+'" y="'+p[1]+'" text-anchor="middle" font-size="8" fill="#e2e8f0">'+esc(label)+'</text>';}).join('');
 return '<svg class="showcase-radar" viewBox="0 0 120 120" role="img" aria-label="مخطط تقييم اللاعب">'+rings+polygon+dots+axes+'</svg>';
}
function showcaseCardHTML(player,options){
 const opts=options||{};
 const s=db.settings,d=normalizeMemberCardDesign(opts.design||{});
 const evals=opts.evals||(db&&db.evals)||[],attendance=opts.attendance||(db&&db.attendance)||[];
 const latestEval=showcaseLatestEval(evals,player.id),evalValues=showcaseEvalValues(latestEval);
 const attendanceRate=showcaseAttendanceRate(attendance,player.id);
 const traits=showcaseTraits(player,latestEval,attendanceRate);
 const material=SHOWCASE_MATERIALS.some(m=>m.id===opts.material)?opts.material:'toty';
 const memberId=String(player.id||'').slice(-6).toUpperCase()||'—';
 const team=db.teams.find(t=>t.id===player.team);
 const schoolName=!s.school||s.school==='مدرسة كرة القدم'?'مدرسة الوئام لكرة القدم':s.school;
 const qrText='MALAABNA-MEMBER|'+memberId+'|'+String(player.id||'')+'|'+String(player.name||'')+'|'+String(schoolName||'');
 const photoStyle='--member-photo-fit:'+d.photoFit+';--member-photo-zoom:'+d.photoZoomPercent/100+';--member-photo-position-x:'+d.photoPositionX+'%;--member-photo-position-y:'+d.photoPositionY+'%;--member-photo-rotate:'+d.photoRotateDeg+'deg;--member-photo-brightness:'+d.photoBrightnessPercent/100+';--member-photo-contrast:'+d.photoContrastPercent/100+';--member-photo-flip:'+(d.photoFlipH?-1:1);
 const photo=player.photo?'<img class="showcase-photo" src="'+safeImg(player.photo)+'" alt="صورة '+esc(player.name||'اللاعب')+'">':'<div class="showcase-photo showcase-photo-empty" aria-label="لا توجد صورة"><span>👤</span></div>';
 const stats=SHOWCASE_RADAR_KEYS.map((k,i)=>'<div class="showcase-stat"><span>'+esc(k[1])+'</span><b>'+(evalValues?String(evalValues.values[i]):'—')+'</b></div>').join('');
 const radar=opts.showRadar===false?'':(evalValues?showcaseRadarSVG(evalValues.values):'<div class="showcase-note">لا توجد تقييمات بعد — لن تُعرض أرقام وهمية.</div>');
 const traitsHTML=traits.length?'<div class="showcase-traits">'+traits.map(t=>'<span class="showcase-trait">'+esc(t)+'</span>').join('')+'</div>':'';
 const signature=safeImg(opts.signature||'');
 const signatureHTML=signature?'<img class="showcase-signature" src="'+signature+'" alt="توقيع اللاعب">':'<div class="showcase-note">لا يوجد توقيع محفوظ في هذه الجلسة.</div>';
 return '<div class="showcase-scene"><div class="showcase-flipper'+(opts.flipped?' is-flipped':'')+'">'+
  '<div class="showcase-face showcase-front showcase-mat-'+material+'">'+
  '<div class="showcase-head"><span>'+esc(schoolName)+'</span><span class="showcase-rating">'+(evalValues?esc(String(evalValues.avg))+'/10':'—')+'</span></div>'+
  '<div class="showcase-photo-wrap" style="'+photoStyle+'">'+photo+'</div>'+
  '<div class="showcase-name">'+esc(player.name||'—')+'</div>'+
  '<div class="showcase-meta">'+esc(player.cat||(team&&team.cat)||'—')+' • '+(player.pos?esc(player.pos)+' • ':'')+'رقم '+(player.shirt||'—')+'</div>'+
  traitsHTML+radar+'<div class="showcase-stats">'+stats+'</div></div>'+
  '<div class="showcase-face showcase-back showcase-mat-'+material+'">'+
  '<div class="showcase-head"><span>'+esc(schoolName)+'</span><span>بطاقة عرض</span></div>'+
  '<div class="showcase-back-body"><div><b>'+esc(player.name||'—')+'</b><div class="showcase-meta">رقم المنخرط '+esc(memberId)+'</div><div class="showcase-meta">الفئة '+esc(player.cat||'—')+' • الفريق '+esc((team&&team.name)||'—')+'</div><div class="showcase-meta">تاريخ التسجيل '+esc(memberCardDate(player.reg))+'</div><div class="showcase-meta">نسبة الحضور '+(attendanceRate===null?'—':attendanceRate+'%')+'</div></div>'+
  '<div class="showcase-qr">'+qrBox(qrText,72,'رمز التحقق')+'</div></div>'+
  '<div class="showcase-signature-wrap">'+signatureHTML+'</div>'+
  '<div class="showcase-note">بطاقة عرض فقط — ليست البطاقة الرسمية للطباعة.</div></div>'+
  '</div></div>';
}
function showcaseCardSection(){
 const active=db.players.filter(p=>p.status!=='منسحب');
 if(!active.length)return '';
 if(!active.some(p=>p.id===showcasePlayerId))showcasePlayerId=active[0].id;
 const player=active.find(p=>p.id===showcasePlayerId)||active[0];
 const materialOptions=SHOWCASE_MATERIALS.map(m=>'<option value="'+m.id+'" '+(m.id===showcaseMaterial?'selected':'')+'>'+esc(m.label)+'</option>').join('');
 const playerOptions=active.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===showcasePlayerId?'selected':'')+'>'+esc(p.name||'لاعب')+'</option>').join('');
 return '<section class="card showcase-section no-print" aria-labelledby="showcaseTitle">'+
  '<div class="showcase-controls"><div><h2 id="showcaseTitle">✨ بطاقة العرض</h2><p class="sub">عرض تقديمي منفصل ببيانات حقيقية فقط. لا يغيّر البطاقة الرسمية ولا يُحفظ، والتوقيع يبقى في هذه الجلسة فقط.</p></div>'+
  '<label class="card-studio-label">اللاعب في العرض<select '+actionAttr('change',(_,el)=>{showcasePlayerId=el.value;render();})+'>'+playerOptions+'</select></label>'+
  '<label class="card-studio-label">خامة البطاقة<select aria-label="خامة بطاقة العرض" '+actionAttr('change',(_,el)=>{showcaseMaterial=el.value;render();})+'>'+materialOptions+'</select></label>'+
  '<label class="card-studio-check"><input type="checkbox" '+(showcaseShowRadar?'checked':'')+' '+actionAttr('change',(_,el)=>{showcaseShowRadar=el.checked;render();})+'> إظهار مخطط التقييم</label>'+
  '<div class="showcase-actions"><button class="btn" '+actionAttr('click',()=>{showcaseFlipped=!showcaseFlipped;render();})+'>🔄 قلب البطاقة</button>'+
  '<button class="btn" '+actionAttr('click',()=>showcaseSignOpen())+'>✍️ توقيع</button>'+
  (showcaseSignature?'<button class="btn" '+actionAttr('click',()=>{showcaseSignature='';render();})+'>حذف التوقيع</button>':'')+'</div></div>'+
  '<div class="showcase-preview">'+showcaseCardHTML(player,{material:showcaseMaterial,flipped:showcaseFlipped,showRadar:showcaseShowRadar,signature:showcaseSignature,design:memberCardDesign()})+'</div></section>';
}
/* ==== التطور والشهادات (المرحلة 3): حساب من بيانات حقيقية فقط ==== */
const PROGRESSION_EVAL_KEYS=[['speed','السرعة'],['drib','المراوغة'],['pass','التمرير'],['shoot','التسديد'],['ctrl','التحكم بالكرة'],['fit','اللياقة'],['disc','الانضباط'],['tw','اللعب الجماعي']];
const PROGRESSION_MIN_ATTENDANCE=5;
const PROGRESSION_ATTENDANCE_THRESHOLD=90;
const PROGRESSION_EVAL_THRESHOLD=8;
const PROGRESSION_DISCIPLINE_THRESHOLD=8;
let progressionPlayerId='',certificatePrintId='';
function progressionStats(evals,attendance,playerId){
 const rows=(attendance||[]).filter(a=>a&&a.player===playerId);
 const present=rows.filter(a=>a.state===ATT[0]||a.state===ATT[3]).length;
 const attendanceRate=rows.length?Math.round(present/rows.length*100):null;
 const playerEvals=(evals||[]).filter(e=>e&&e.player===playerId);
 const latestEval=playerEvals.length?playerEvals.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0]:null;
 let rates=null,evalAvg=null;
 if(latestEval){
  rates={};
  PROGRESSION_EVAL_KEYS.forEach(k=>{rates[k[0]]=Math.max(0,Math.min(10,Number(latestEval[k[0]])||0));});
  evalAvg=Math.round(PROGRESSION_EVAL_KEYS.reduce((sum,k)=>sum+rates[k[0]],0)/PROGRESSION_EVAL_KEYS.length*10)/10;
 }
 const reasons=[];
 if(!playerEvals.length)reasons.push('لا يوجد أي تقييم مسجل للاعب');
 if(rows.length<PROGRESSION_MIN_ATTENDANCE)reasons.push('سجلات الحضور أقل من '+PROGRESSION_MIN_ATTENDANCE+' (المسجل: '+rows.length+')');
 return {attendanceCount:rows.length,attendancePresent:present,attendanceRate:attendanceRate,evalCount:playerEvals.length,latestEval:latestEval,rates:rates,evalAvg:evalAvg,sufficient:!reasons.length,insufficientReasons:reasons};
}
function progressionTier(evalAvg){
 if(evalAvg===null||evalAvg===undefined)return null;
 if(evalAvg>=8)return 'ممتاز';
 if(evalAvg>=7)return 'جيد جدًا';
 if(evalAvg>=6)return 'جيد';
 if(evalAvg>=5)return 'مقبول';
 return 'قيد التطور';
}
function progressionBadges(stats){
 if(!stats||!stats.sufficient)return [];
 const badges=[];
 if(stats.attendanceRate!==null&&stats.attendanceRate>=PROGRESSION_ATTENDANCE_THRESHOLD)badges.push({id:'attendance',label:'حضور منتظم'});
 if(stats.evalAvg!==null&&stats.evalAvg>=PROGRESSION_EVAL_THRESHOLD)badges.push({id:'eval',label:'تقييم ممتاز'});
 if(stats.rates&&stats.rates.disc>=PROGRESSION_DISCIPLINE_THRESHOLD)badges.push({id:'discipline',label:'انضباط عالٍ'});
 return badges;
}
function certificateSigners(settings){
 const s=settings||{};
 return {presidentName:String(s.presidentName||'').trim(),presidentRole:String(s.presidentRole||'').trim()||'رئيس النادي',coachName:String(s.coachName||'').trim(),coachRole:String(s.coachRole||'').trim()||'مدرب'};
}
function certificateReadiness(player,stats,settings){
 const reasons=[];
 if(!player)reasons.push('لم يُختر لاعب');
 if(stats&&!stats.sufficient)reasons.push.apply(reasons,stats.insufficientReasons);
 const school=String((settings&&settings.school)||'').trim();
 if(!school)reasons.push('اسم المدرسة غير مدخل في الإعدادات');
 const signers=certificateSigners(settings);
 if(!signers.presidentName)reasons.push('اسم الرئيس غير مدخل في إعدادات موقّعي الشهادات');
 if(!signers.coachName)reasons.push('اسم المدرب غير مدخل في إعدادات موقّعي الشهادات');
 return {ready:!reasons.length,reasons:reasons,signers:signers};
}
function certificateHTML(player,stats,settings,issuedDate){
 const s=settings||{},signers=certificateSigners(s);
 const school=String(s.school||'').trim();
 const memberId=String(player.id||'').slice(-6).toUpperCase()||'—';
 const tier=progressionTier(stats.evalAvg);
 const rateRows=PROGRESSION_EVAL_KEYS.map(k=>'<tr><td>'+esc(k[1])+'</td><td><b>'+esc(String(stats.rates?stats.rates[k[0]]:''))+'</b> / 10</td></tr>').join('');
 const evalMeta=stats.latestEval?('بتاريخ '+esc(stats.latestEval.date||'—')+(stats.latestEval.period?' ('+esc(stats.latestEval.period)+')':'')):'';
 const logo=s.logo?'<img src="'+safeImg(s.logo)+'" alt="شعار المدرسة">':'<span>⚽</span>';
 const stamp=s.stamp?'<img class="certificate-stamp" src="'+safeImg(s.stamp)+'" alt="ختم المدرسة">':'';
 return '<article class="certificate-sheet" dir="rtl" aria-label="الشهادة الرسمية">'+
  '<div class="certificate-head"><div class="certificate-logo">'+logo+'</div><div class="certificate-school"><b>'+esc(school)+'</b><span>شهادة رسمية</span></div></div>'+
  '<h2 class="certificate-title">شهادة تطور رياضي</h2>'+
  '<p class="certificate-body">تشهد إدارة '+esc(school)+' بأن اللاعب <b>'+esc(player.name||'—')+'</b>، المنخرط رقم <bdi>'+esc(memberId)+'</bdi>، فئة <b>'+esc(player.cat||'—')+'</b>، قد سجّل خلال الفترة الموثقة في سجلات المدرسة: نسبة حضور <b>'+esc(String(stats.attendanceRate))+'%</b> من أصل '+esc(String(stats.attendanceCount))+' حصة مسجلة، ومتوسط تقييم <b>'+esc(String(stats.evalAvg))+' / 10</b> وفق أحدث تقييم '+evalMeta+'.</p>'+
  '<table class="certificate-stats"><thead><tr><th>البند</th><th>القيمة</th></tr></thead><tbody>'+rateRows+
  '<tr><td>نسبة الحضور</td><td><b>'+esc(String(stats.attendanceRate))+'%</b> ('+esc(String(stats.attendancePresent))+' من '+esc(String(stats.attendanceCount))+')</td></tr>'+
  '<tr><td>عدد التقييمات</td><td><b>'+esc(String(stats.evalCount))+'</b></td></tr>'+
  '<tr><td>المستوى</td><td><b>'+esc(tier||'—')+'</b></td></tr></tbody></table>'+
  '<div class="certificate-foot"><div class="certificate-date">حُرّرت بتاريخ '+esc(issuedDate||'')+'</div>'+stamp+'</div>'+
  '<div class="certificate-signatures"><div class="certificate-sign"><span class="certificate-sign-line"></span><b>'+esc(signers.presidentName)+'</b><span>'+esc(signers.presidentRole)+'</span></div>'+
  '<div class="certificate-sign"><span class="certificate-sign-line"></span><b>'+esc(signers.coachName)+'</b><span>'+esc(signers.coachRole)+'</span></div></div>'+
  '<p class="certificate-note">وثيقة صادرة من سجلات المدرسة فقط، وتُعرض فيها الأرقام المسجلة دون أي تقدير إضافي.</p></article>';
}
function progressionSection(){
 const active=db.players.filter(p=>p.status!=='منسحب');
 if(!active.length)return '';
 if(!active.some(p=>p.id===progressionPlayerId))progressionPlayerId=active[0].id;
 const player=active.find(p=>p.id===progressionPlayerId)||active[0];
 const stats=progressionStats(db.evals,db.attendance,player.id);
 const badges=progressionBadges(stats);
 const tier=progressionTier(stats.evalAvg);
 const signers=certificateSigners(db.settings);
 const settingsReasons=[];
 if(!String(db.settings.school||'').trim())settingsReasons.push('اسم المدرسة غير مدخل في الإعدادات');
 if(!signers.presidentName)settingsReasons.push('اسم الرئيس غير مدخل في إعدادات موقّعي الشهادات');
 if(!signers.coachName)settingsReasons.push('اسم المدرب غير مدخل في إعدادات موقّعي الشهادات');
 const playerOptions=active.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===progressionPlayerId?'selected':'')+'>'+esc(p.name||'لاعب')+'</option>').join('');
 const badgesHTML=badges.length?'<div class="progression-badges">'+badges.map(b=>'<span class="progression-badge">🏅 '+esc(b.label)+'</span>').join('')+'</div>':'<p class="sub">لا توجد شارات مستحقة بعد وفق العتبات المعتمدة.</p>';
 const gateHTML=stats.sufficient?'':'<div class="notice">بيانات غير كافية: '+stats.insufficientReasons.map(r=>esc(r)).join('؛ ')+'.</div>';
 const certActions=isAdmin()?('<button class="btn primary" '+actionAttr('click',()=>issueCertificate(player.id))+'>🏅 إصدار الشهادة الرسمية</button> '):'<p class="sub">إصدار الشهادات الرسمية للمدير فقط.</p>';
 const missingHTML=settingsReasons.length?('<div class="notice">قبل إصدار الشهادة: '+settingsReasons.map(r=>esc(r)).join('؛ ')+'.</div>'+(isAdmin()?'<button class="btn" '+actionAttr('click',()=>go('admin'))+'>فتح إعدادات الموقّعين</button>':'')):'';
 return '<section class="card progression-section no-print" aria-labelledby="progressionTitle">'+
  '<div><h2 id="progressionTitle">📈 التطور والشهادات</h2><p class="sub">تُحسب الشارات من بيانات حقيقية فقط: حضور 90% فأعلى، ومتوسط تقييم 8 فأعلى، وانضباط 8 فأعلى. لا شارة ولا شهادة عند نقص البيانات (5 سجلات حضور على الأقل وتقييم واحد على الأقل).</p></div>'+
  '<label class="card-studio-label">اللاعب<select '+actionAttr('change',(_,el)=>{progressionPlayerId=el.value;render();})+'>'+playerOptions+'</select></label>'+
  '<div class="progression-stats"><div><span>نسبة الحضور</span><b>'+(stats.attendanceRate===null?'—':stats.attendanceRate+'%')+'</b><span class="sub">'+stats.attendancePresent+' من '+stats.attendanceCount+'</span></div>'+
  '<div><span>متوسط التقييم</span><b>'+(stats.evalAvg===null?'—':stats.evalAvg+' / 10')+'</b><span class="sub">'+stats.evalCount+' تقييم</span></div>'+
  '<div><span>المستوى</span><b>'+esc(tier||'—')+'</b><span class="sub">من أحدث تقييم</span></div></div>'+
  badgesHTML+gateHTML+
  '<div class="progression-actions">'+certActions+'</div>'+missingHTML+'</section>';
}
async function issueCertificate(playerId){
 if(!isAdmin()){denied();return;}
 const player=(db.players||[]).find(p=>p.id===playerId);
 const stats=progressionStats(db.evals,db.attendance,playerId);
 const readiness=certificateReadiness(player,stats,db.settings);
 if(!readiness.ready){alert('تعذّر إصدار الشهادة:\n'+readiness.reasons.join('\n'));return;}
 auditAdd('إصدار شهادة تطور رياضي',(player&&player.name||'')+' — حضور '+(stats.attendanceRate||0)+'%، متوسط تقييم '+(stats.evalAvg||0)+'/10');
 if(!await save())return;
 certificatePrintId=playerId;render();
}
function closeCertificate(){certificatePrintId='';render();}
function printCertificate(){
 const player=(db.players||[]).find(p=>p.id===certificatePrintId);
 const name=String((player&&player.name)||'لاعب').replace(/[\\/:*?"<>|]+/g,'').trim().slice(0,40)||'لاعب';
 exportPDF('شهادة-تطور-'+name+'-'+todayISO()+'.pdf',true);
}
let showcaseSignLayer=null;
function showcaseSignOpen(){
 if(showcaseSignLayer)showcaseSignLayer.remove();
 const layer=document.createElement('div');layer.className='showcase-sign-overlay';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','لوحة التوقيع');
 layer.innerHTML='<div class="showcase-sign-dialog"><div class="showcase-sign-head"><div><b>✍️ توقيع العرض</b><div class="sub">ارسم توقيعك هنا. يُستخدم في بطاقة العرض فقط خلال هذه الجلسة، ولا يُحفظ في قاعدة البيانات ولا يظهر على البطاقة الرسمية.</div></div><button type="button" class="btn sm" data-sign-close aria-label="إغلاق">✕</button></div>'+
  '<div class="showcase-sign-stage"><canvas class="showcase-sign-canvas" width="600" height="180" aria-label="لوحة رسم التوقيع"></canvas></div>'+
  '<div class="showcase-sign-status" data-sign-status role="status" aria-live="polite">ارسم توقيعك ثم اضغط «اعتماد التوقيع».</div>'+
  '<div class="showcase-sign-actions"><button type="button" class="btn" data-sign-clear>مسح</button><button type="button" class="btn" data-sign-close>إلغاء</button><button type="button" class="btn primary" data-sign-apply>اعتماد التوقيع</button></div></div>';
 document.body.appendChild(layer);showcaseSignLayer=layer;
 const canvas=layer.querySelector('canvas'),ctx=canvas.getContext('2d'),status=layer.querySelector('[data-sign-status]');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#0f172a';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
 let drawing=false,hasInk=false,last=null;
 const pos=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();drawing=true;last=pos(e);canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drawing||!last)return;const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;hasInk=true;});
 const finish=()=>{drawing=false;last=null;};
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 const close=()=>{layer.remove();if(showcaseSignLayer===layer)showcaseSignLayer=null;};
 layer.querySelectorAll('[data-sign-close]').forEach(b=>b.addEventListener('click',close));
 layer.querySelector('[data-sign-clear]').addEventListener('click',()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);hasInk=false;status.textContent='مُسح التوقيع. ارسم من جديد.';});
 layer.querySelector('[data-sign-apply]').addEventListener('click',()=>{if(!hasInk){status.textContent='ارسم توقيعًا أولًا قبل الاعتماد.';return;}showcaseSignature=canvas.toDataURL('image/png');close();render();});
 layer.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 layer.querySelector('[data-sign-close]').focus();
}
function appTheme(){return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark';}
function toggleAppTheme(){
 const next=appTheme()==='dark'?'light':'dark';
 document.documentElement.setAttribute('data-theme',next);
 try{localStorage.setItem('fsm_ui_theme',next);}catch(e){}
 const button=document.querySelector('.theme-toggle');
 if(button){
  button.setAttribute('aria-pressed',next==='light'?'true':'false');
  button.title=next==='dark'?'التبديل إلى الوضع الفاتح':'التبديل إلى الوضع الداكن';
  const icon=button.querySelector('[aria-hidden="true"]');
  if(icon)icon.textContent=next==='dark'?'☀️':'🌙';
 }
}
function head(t,s,actions){
 const theme=appTheme();
 const toggle='<button type="button" class="btn theme-toggle" aria-label="تبديل الوضع البصري" aria-pressed="'+(theme==='light'?'true':'false')+'" title="'+(theme==='dark'?'التبديل إلى الوضع الفاتح':'التبديل إلى الوضع الداكن')+'" '+actionAttr('click',toggleAppTheme)+'><span aria-hidden="true">'+(theme==='dark'?'☀️':'🌙')+'</span></button>';
 return '<div class="top"><div><h1>'+t+'</h1><div class="sub">'+s+'</div></div><div class="top-actions">'+appStylePickerHTML()+toggle+(actions||'')+'</div></div>';
}
function kpi(lab,val,cls,foot){return '<div class="card kpi"><div class="lab">'+lab+'</div><div class="val '+(cls||'')+'">'+val+'</div>'+(foot?'<div class="foot">'+foot+'</div>':'')+'</div>';}

const REQDOCS=['شهادة طبية','عقد التسجيل','الموافقة المكتوبة','وثيقة J6','استمارة التسجيل'];
function daysTo(d){if(!d)return null;const x=new Date(d+'T00:00:00'),n=new Date(todayISO()+'T00:00:00');return Math.round((x-n)/86400000);}
function docAlerts(){
 const out=[];
 const act=db.players.filter(p=>p.status!=='منسحب');
 act.forEach(function(p){
  REQDOCS.forEach(function(t){
   const d=(db.docs||[]).find(x=>x.player===p.id&&x.cat===t&&x.state!=='ناقصة')||(p.att||[]).find(x=>x.cat===t);
   if(!d)out.push({p:p.name||'',doc:t,playerId:p.id,st:'مفقودة',cls:'t-r',d:'—'});
  });
 });
 ['players','parents','coaches'].forEach(function(coll){
  (db[coll]||[]).forEach(function(r){
   (r.att||[]).forEach(function(f){
    const n=daysTo(f.exp);if(n===null)return;
    if(n<0)out.push({p:r.name||'',doc:(f.cat||f.name||''),st:'منتهية منذ '+(-n)+' يوم',cls:'t-r',d:f.exp});
    else if(n<=30)out.push({p:r.name||'',doc:(f.cat||f.name||''),st:'تنتهي بعد '+n+' يوم',cls:'t-o',d:f.exp});
   });
  });
 });
 (db.docs||[]).forEach(function(x){
  const n=daysTo(x.exp);if(n===null)return;
  const p=db.players.find(y=>y.id===x.player);
  if(n<0)out.push({p:(p&&p.name)||x.title||'',doc:x.cat||x.title||'',st:'منتهية منذ '+(-n)+' يوم',cls:'t-r',d:x.exp});
  else if(n<=30)out.push({p:(p&&p.name)||x.title||'',doc:x.cat||x.title||'',st:'تنتهي بعد '+n+' يوم',cls:'t-o',d:x.exp});
 });
 return out;
}
function equipAlerts(){
 const out=[];
 (db.equip||[]).forEach(function(e){
  const onLoan=(db.loans||[]).filter(l=>l.equip===e.id&&l.state==='مُعارة').reduce((a,l)=>a+(Number(l.qty)||0),0);
  const avail=(Number(e.total)||0)-(Number(e.used)||0)-onLoan;
  if(e.state==='تحتاج تعويض')out.push({n:e.name||'',st:'تحتاج تعويض',cls:'t-o',avail:avail});
  else if(avail<=0&&(Number(e.total)||0)>0)out.push({n:e.name||'',st:'المخزون نفذ',cls:'t-r',avail:avail});
 });
 (db.loans||[]).filter(l=>l.state==='مُعارة').forEach(function(l){
  const n=daysTo(l.out);
  if(n!==null&&n<=-30)out.push({n:refName('equip',l.equip)+(l.player?' ← '+refName('players',l.player):(l.coach?' ← '+refName('coaches',l.coach):(l.toType?' ← '+l.toType:''))),st:'مُعارة منذ '+(-n)+' يوم دون إرجاع',cls:'t-o',avail:'—'});
 });
 return out;
}
function docAlertActionHTML(row){
 if(!row.playerId)return '—';
 if(!isAdmin())return '<span class="sub">إبلاغ المدير</span>';
 return '<button class="btn sm" '+actionAttr('click',()=>openForm('players',row.playerId))+'>إرفاق</button>';
}
function alertsHTML(){
 const d=docAlerts(),e=equipAlerts();
 if(!d.length&&!e.length)return '<div class="card"><div class="empty">✅ لا توجد تنبيهات: الوثائق مكتملة والمعدات متوفرة.</div></div>';
 let html='';
 if(d.length)html+='<div class="tw"><table><thead><tr><th>اللاعب</th><th>الوثيقة</th><th>الحالة</th><th>انتهاء الصلاحية</th><th>الإجراء</th></tr></thead><tbody>'+
  d.slice(0,25).map(x=>'<tr><td>'+esc(x.p)+'</td><td>'+esc(x.doc)+'</td><td><span class="tag '+x.cls+'">'+esc(x.st)+'</span></td><td>'+esc(String(x.d))+'</td><td>'+docAlertActionHTML(x)+'</td></tr>').join('')+
  '</tbody></table></div>'+(d.length>25?'<div class="sub">و'+(d.length-25)+' حالة أخرى…</div>':'');
 if(e.length)html+='<div class="tw" style="margin-top:10px"><table><thead><tr><th>المعدة</th><th>التنبيه</th><th>المتوفر</th></tr></thead><tbody>'+
  e.slice(0,20).map(x=>'<tr><td>'+esc(x.n)+'</td><td><span class="tag '+x.cls+'">'+esc(x.st)+'</span></td><td>'+esc(String(x.avail))+'</td></tr>').join('')+'</tbody></table></div>';
 return html;
}
function trainingMinutes(value){const m=String(value||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function expandTrainingSeries(rec,isEdit){
 const out=[Object.assign({},rec)];
 if(isEdit||!rec.repeat||rec.repeat==='لا تكرار')return out;
 if(!rec.date||!rec.repeatUntil){alert('لإنشاء حصص متكررة، حدّد تاريخ البداية وتاريخ «تكرار حتى».');return null;}
 const start=new Date(rec.date+'T12:00:00'),until=new Date(rec.repeatUntil+'T12:00:00');
 if(!Number.isFinite(start.getTime())||!Number.isFinite(until.getTime())||until<start){alert('تاريخ نهاية التكرار غير صحيح.');return null;}
 if((until-start)/86400000>183){alert('لأمان الجدول، الحد الأقصى للتكرار ستة أشهر.');return null;}
 const step=rec.repeat==='كل أسبوعين'?14:7,seriesId=uid();
 for(let d=new Date(start);;){d.setDate(d.getDate()+step);if(d>until)break;const copy=Object.assign({},rec,{id:uid(),date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),seriesId:seriesId});out.push(copy);if(out.length>27){alert('الحد الأقصى 26 حصة متكررة في المرة الواحدة.');return null;}}
 out[0].seriesId=seriesId;
 return out;
}
function trainingConflicts(candidates,excludeId){
 const all=(db.trainings||[]).filter(x=>x&&x.id!==excludeId&&x.status!=='ملغاة'),conflicts=[];
 candidates.forEach(function(a){if(!a.date||a.status==='ملغاة')return;all.forEach(function(b){if(b.date!==a.date||b.status==='ملغاة')return;
  const sameCoach=!!a.coach&&a.coach===b.coach,sameTeam=!!a.team&&a.team===b.team;
  const sameField=!!a.field&&!!b.field&&String(a.field).trim().toLowerCase()===String(b.field).trim().toLowerCase();
  if(!sameCoach&&!sameTeam&&!sameField)return;
  const am=trainingMinutes(a.time),bm=trainingMinutes(b.time),ad=Math.max(15,Number(a.dur)||60),bd=Math.max(15,Number(b.dur)||60);
  const overlap=am===null||bm===null?true:(am<bm+bd&&bm<am+ad);
  if(overlap){const who=[sameField?'الملعب '+a.field:'',sameCoach?'المدرب '+refName('coaches',a.coach):'',sameTeam?'الفريق '+refName('teams',a.team):''].filter(Boolean).join('، ');conflicts.push((a.date||'')+' — '+(a.time||'وقت غير محدد')+' مع «'+(b.name||'حصة أخرى')+'» ('+who+')');}
 });});
 return conflicts;
}
function trainingReminderRows(){
 const now=Date.now();return (db.trainings||[]).filter(function(x){if(!x||x.status==='ملغاة'||!x.date||!x.time)return false;const lead=x.remindBefore==='قبل 24 ساعة'?24:(x.remindBefore==='قبل ساعتين'?2:0);if(!lead)return false;const at=new Date(x.date+'T'+x.time+':00').getTime();const h=(at-now)/3600000;return h>=0&&h<=lead;}).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function injuryFollowups(){return (db.injuries||[]).filter(function(x){return x&&x.status!=='مغلقة'&&x.followupDate&&daysTo(x.followupDate)<=7;});}
function injuriesPage(){
 const due=injuryFollowups();
 return (due.length?'<div class="notice" style="margin-bottom:14px">⚠️ توجد '+due.length+' متابعة مستحقة أو خلال 7 أيام. راجع الحالة وحدّث موعد المتابعة.</div>':'<div class="notice" style="margin-bottom:14px">سجل إداري للمتابعة فقط؛ لا يُستخدم للتشخيص أو تقرير الجاهزية الطبية. وثّق التصريح الطبي قبل تسجيل العودة للتدريب.</div>')+listPage('injuries');
}
const DEVICE_NOTIF_KEY='fsm_device_notifications_enabled';
const DEVICE_NOTIF_SEEN='fsm_device_notifications_seen_v1';
function deviceNotificationsEnabled(){try{return localStorage.getItem(DEVICE_NOTIF_KEY)==='1'&&('Notification' in window)&&Notification.permission==='granted';}catch(e){return false;}}
function notificationControlHTML(){
 if(!('Notification' in window))return '<div class="notice">إشعارات الجهاز غير مدعومة في هذا النظام.</div>';
 if(Notification.permission==='denied')return '<div class="notice">إشعارات التطبيق محظورة من إعدادات النظام. اسمح بها من إعدادات الإشعارات ثم أعد تشغيل التطبيق.</div>';
 if(deviceNotificationsEnabled())return '<button class="btn" '+actionAttr('click',()=>disableDeviceNotifications())+'>🔕 إيقاف إشعارات هذا الجهاز</button><span class="sub">الإشعارات تعمل أثناء تشغيل التطبيق فقط.</span>';
 return '<button class="btn primary" '+actionAttr('click',()=>enableDeviceNotifications())+'>🔔 تفعيل إشعارات هذا الجهاز</button><span class="sub">لن يطلب التطبيق الإذن إلا بعد ضغطك؛ لا تُرسل رسائل واتساب تلقائياً.</span>';
}
async function enableDeviceNotifications(){
 if(!('Notification' in window)){alert('إشعارات الجهاز غير مدعومة هنا.');return;}
 try{let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();if(permission!=='granted'){alert('لم يتم السماح بالإشعارات. يمكنك تفعيلها لاحقاً من إعدادات النظام.');return;}localStorage.setItem(DEVICE_NOTIF_KEY,'1');render();checkDeviceNotifications();}
 catch(e){alert('تعذر تفعيل إشعارات الجهاز: '+e.message);}
}
function disableDeviceNotifications(){try{localStorage.removeItem(DEVICE_NOTIF_KEY);}catch(e){}render();}
function seenDeviceNotification(key){try{const a=JSON.parse(localStorage.getItem(DEVICE_NOTIF_SEEN)||'[]');return Array.isArray(a)&&a.indexOf(key)>=0;}catch(e){return false;}}
function sendDeviceNotification(key,title,body,target){
 if(!deviceNotificationsEnabled()||seenDeviceNotification(key))return;
 try{const n=new Notification(title,{body:body,tag:key});n.onclick=function(){try{window.focus();if(canPage(target)){page=target;render();}}catch(e){}};let a=[];try{a=JSON.parse(localStorage.getItem(DEVICE_NOTIF_SEEN)||'[]');}catch(e){}if(!Array.isArray(a))a=[];a.push(key);localStorage.setItem(DEVICE_NOTIF_SEEN,JSON.stringify(a.slice(-500)));}
 catch(e){console.warn('تعذر إظهار إشعار الجهاز',e);}
}
function checkDeviceNotifications(){
 if(!deviceNotificationsEnabled()||!canPage('dash'))return;
 const now=Date.now();
 if(canPage('trainings'))(db.trainings||[]).forEach(function(x){if(!x||x.status==='ملغاة'||!x.date||!x.time)return;const lead=x.remindBefore==='قبل 24 ساعة'?24:(x.remindBefore==='قبل ساعتين'?2:0);if(!lead)return;const start=new Date(x.date+'T'+x.time+':00').getTime();if(!Number.isFinite(start))return;const due=start-lead*3600000;if(now>=due&&now<Math.min(start,due+3600000)){sendDeviceNotification('training:'+x.id+':'+x.date,'تذكير تدريب',String(x.name||'توجد حصة قادمة')+' — '+x.date+' '+x.time,'trainings');}});
 if(canSeeSensitive()&&canPage('injuries'))(db.injuries||[]).forEach(function(x){if(!x||x.status==='مغلقة'||!x.followupDate||x.followupDate>todayISO())return;sendDeviceNotification('injury:'+x.id+':'+todayISO(),'موعد متابعة مستحق','يوجد سجل متابعة يحتاج إلى مراجعة داخل التطبيق.','injuries');});
}
function trainingRemindersHTML(){
 const rows=trainingReminderRows(),control=notificationControlHTML();
 if(!rows.length)return '<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+control+'</div><div class="empty" style="margin-top:10px">لا توجد تذكيرات تدريب مستحقة الآن.</div></div>';
 return '<div class="card no-print" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'+control+'</div><div class="tw"><table><thead><tr><th>الحصة</th><th>الموعد</th><th>الفريق</th><th>المدرب</th><th>التذكير</th></tr></thead><tbody>'+rows.map(function(x){return '<tr><td>'+esc(x.name||'')+'</td><td>'+esc(x.date)+' '+esc(x.time||'')+'</td><td>'+esc(refName('teams',x.team))+'</td><td>'+esc(refName('coaches',x.coach))+'</td><td><span class="tag t-o">'+esc(x.remindBefore||'')+'</span></td></tr>';}).join('')+'</tbody></table></div><div class="sub" style="margin-top:6px">تظهر التذكيرات داخل التطبيق، ويمكن تفعيل إشعار الجهاز اختيارياً. تعمل أثناء تشغيل التطبيق فقط؛ لا تُرسل رسائل تلقائية إلى أولياء الأمور.</div>';
}
function injuryAlertsHTML(){
 if(!canSeeSensitive()||!canPage('injuries'))return '';
 const rows=injuryFollowups();return '<h2 class="sec">🩹 متابعات الإصابات القادمة والمستحقة</h2>'+(rows.length?'<div class="card">يوجد '+rows.length+' سجل يحتاج إلى مراجعة خلال 7 أيام أو متأخر. <button class="btn sm" '+actionAttr('click',()=>go('injuries'))+'>فتح سجل المتابعة</button></div>':'<div class="card"><div class="empty">لا توجد متابعات مستحقة أو خلال 7 أيام.</div></div>');
}
function dashboardRevenueChartHTML(now){
 const base=now||new Date(),points=[];
 for(let shift=5;shift>=0;shift--){
  const d=new Date(base.getFullYear(),base.getMonth()-shift,1),year=d.getFullYear(),month=MONTHS[d.getMonth()];
  const key=year+'-'+String(d.getMonth()+1).padStart(2,'0');
  const income=(db.subs||[]).filter(x=>x.month===month&&Number(x.year)===year).reduce((a,x)=>a+(Number(x.paid)||0),0);
  const expense=(db.expenses||[]).filter(x=>String(x.date||'').slice(0,7)===key).reduce((a,x)=>a+(Number(x.amount)||0),0);
  points.push({month:month,year:year,income:income,expense:expense});
 }
 const totalIncome=points.reduce((a,x)=>a+x.income,0),totalExpense=points.reduce((a,x)=>a+x.expense,0),hasData=points.some(x=>x.income>0||x.expense>0);
 const maxValue=Math.max(1,...points.map(x=>Math.max(x.income,x.expense))),x0=150,maxWidth=500;
 let grid='',rows='';
 if(hasData){
  for(let tick=0;tick<=4;tick++){
   const x=x0+(maxWidth*tick/4),value=Math.round(maxValue*tick/4);
   grid+='<line x1="'+x+'" y1="14" x2="'+x+'" y2="220" stroke="#2a2a30" stroke-width="1" />'+
    '<text x="'+x+'" y="239" text-anchor="middle" fill="#a89f8d" font-size="10" direction="ltr">'+value.toLocaleString('ar-MA')+'</text>';
  }
  rows=points.map(function(p,i){
   const y=20+i*33,w1=maxWidth*p.income/maxValue,w2=maxWidth*p.expense/maxValue;
   return '<text x="716" y="'+(y+17)+'" text-anchor="end" fill="#d8d2c2" font-size="12">'+esc(p.month)+'</text>'+ 
    '<rect x="'+x0+'" y="'+y+'" width="'+w1.toFixed(2)+'" height="9" rx="4.5" fill="#e3b341"><title>المداخيل '+esc(p.month+' '+p.year)+': '+esc(money(p.income))+'</title></rect>'+ 
    '<rect x="'+x0+'" y="'+(y+12)+'" width="'+w2.toFixed(2)+'" height="9" rx="4.5" fill="#4cc07a"><title>المصاريف '+esc(p.month+' '+p.year)+': '+esc(money(p.expense))+'</title></rect>';
  }).join('');
 }
 const chartMarkup=hasData?'<svg class="dash-revenue-svg" viewBox="0 0 730 246" role="img" aria-label="مقارنة المداخيل والمصاريف خلال آخر ستة أشهر">'+grid+rows+'</svg>':'<div class="dash-chart-empty"><b>لا توجد بيانات مالية مسجلة</b><span>ستظهر مقارنة آخر 6 أشهر بعد تسجيل المداخيل والمصاريف.</span></div>';
 return '<section class="card dash-revenue-card"><div class="dash-chart-legend"><span><i class="dash-key income"></i>المداخيل</span><span><i class="dash-key expense"></i>المصاريف</span><span class="sub">آخر 6 أشهر</span></div>'+ 
  chartMarkup+
  '<div class="dash-chart-totals"><span>إجمالي المداخيل <b>'+esc(money(totalIncome))+'</b></span><span>إجمالي المصاريف <b>'+esc(money(totalExpense))+'</b></span></div></section>';
}
function dashboardSubscriptionsDonutHTML(month,year){
 const current=(db.subs||[]).filter(x=>x.month===month&&Number(x.year)===Number(year));
 const rows=current.length?current:(db.subs||[]),scope=current.length?('اشتراكات '+month+' '+year):'جميع الاشتراكات';
 const items=[
  {key:PAY[0],label:'مؤدى',color:'#4cc07a'},
  {key:PAY[1],label:'أداء جزئي',color:'#e3b341'},
  {key:PAY[2],label:'غير مؤدى',color:'#e07a63'},
  {key:PAY[3],label:'معفى',color:'#8a93a3'}
 ];
 items.forEach(function(item){item.count=rows.filter(x=>x.state===item.key).length;});
 const known=items.map(x=>x.key),otherCount=rows.filter(x=>known.indexOf(x.state)<0).length;
 if(otherCount)items.push({key:'__other__',label:'حالات أخرى',color:'#77727e',count:otherCount});
 const total=rows.length,circ=2*Math.PI*44;let offset=0;
 const segments=items.map(function(item){
  const length=total?circ*item.count/total:0,part=length?'<circle cx="60" cy="60" r="44" fill="none" stroke="'+item.color+'" stroke-width="12" stroke-dasharray="'+length.toFixed(2)+' '+(circ-length).toFixed(2)+'" stroke-dashoffset="'+(-offset).toFixed(2)+'" transform="rotate(-90 60 60)" />':'';
  offset+=length;return part;
 }).join('');
 const legend=total?items.map(function(item){const pct=Math.round(item.count*100/total);return '<div class="dash-donut-row"><i style="--dash-swatch:'+item.color+'"></i><span>'+item.label+'</span><b>'+item.count+'</b><small>'+pct+'%</small></div>';}).join(''):'<div class="dash-donut-empty">لا توجد اشتراكات مسجلة بعد.</div>';
 const desc=items.map(x=>x.label+' '+x.count).join('، ');
 return '<section class="card dash-donut-card"><div class="dash-donut-heading"><b>توزيع حالات الاشتراك</b><span class="sub">'+esc(scope)+'</span></div><div class="dash-donut-content">'+
  '<svg class="dash-donut-svg" viewBox="0 0 120 120" role="img" aria-label="'+esc('توزيع '+scope+': '+desc)+'"><circle cx="60" cy="60" r="44" fill="none" stroke="#2a2a30" stroke-width="12" />'+segments+
  '<text x="60" y="57" text-anchor="middle" fill="#f2ede1" font-size="18" font-weight="800">'+total+'</text><text x="60" y="73" text-anchor="middle" fill="#a89f8d" font-size="8">اشتراك</text></svg><div class="dash-donut-legend">'+legend+'</div></div></section>';
}
function dashboardMastheadHTML(){
 const now=new Date();let dateLabel=todayISO(),timeLabel='';
 try{dateLabel=new Intl.DateTimeFormat('ar-MA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);timeLabel=new Intl.DateTimeFormat('ar-MA',{hour:'2-digit',minute:'2-digit'}).format(now);}catch(e){}
 const acctName=acctInfo&&(acctInfo.name||acctInfo.fullName||acctInfo.username),coach=myCoach();
 const actor=String(acctName||(acctInfo&&acctInfo.role?roleLabel():role==='coach'?(coach&&coach.name||'المدرب'):'مدير المدرسة'));
 const avatar=Array.from(actor.trim())[0]||'م',roleName=roleLabel();
 const noticeCount=(docAlerts()||[]).length+(equipAlerts()||[]).length;
 const scrollAction=actionAttr('click',function(){const target=document.querySelector('.dashboard-aside');if(target){const behavior=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';target.scrollIntoView({behavior:behavior,block:'start'});}});
 return '<div class="desktop-masthead" role="group" aria-label="معلومات اليوم والحساب">'+
  '<div class="desktop-date"><span aria-hidden="true">🗓️</span><span>'+esc(dateLabel)+'</span>'+(timeLabel?'<span class="desktop-clock" dir="ltr">'+esc(timeLabel)+'</span>':'')+'</div>'+ 
  '<button type="button" class="desktop-notification" '+scrollAction+' aria-label="عرض التنبيهات، '+noticeCount+' تنبيه"><span aria-hidden="true">🔔</span>'+(noticeCount?'<i>'+noticeCount+'</i>':'')+'</button>'+ 
  '<div class="desktop-user"><span class="desktop-avatar" aria-hidden="true">'+esc(avatar)+'</span><div><b>'+esc(actor)+'</b><small>'+esc(roleName)+'</small></div></div></div>';
}
function dashboardTrainingTableHTML(rows){
 if(!rows.length)return '<div class="empty">لا توجد حصص قادمة مسجلة. أضف تدريباً جديداً لبدء تنظيم برنامج الفرق.</div>';
 return '<div class="tw dash-schedule-table"><table><thead><tr><th>الحصة</th><th>التاريخ والساعة</th><th>الفريق</th><th>المدرب</th><th>الملعب</th></tr></thead><tbody>'+
  rows.map(function(x){return '<tr><td><b>'+esc(x.name||'حصة تدريبية')+'</b><div class="sub">'+esc(x.type||'تدريب')+'</div></td><td>'+esc(x.date||'—')+'<div class="sub">'+esc(x.time||'—')+'</div></td><td>'+esc(refName('teams',x.team))+'</td><td>'+esc(refName('coaches',x.coach))+'</td><td>'+esc(x.field||'—')+'</td></tr>';}).join('')+
  '</tbody></table></div>';
}
function dashboardMatchTableHTML(rows){
 if(!rows.length)return '<div class="empty">لا توجد مباريات قادمة مسجلة. يمكنك إضافة مباراة ودية أو بطولة من هذا القسم.</div>';
 return '<div class="dash-fixtures">'+rows.map(function(x){
  const team=refName('teams',x.team),when=[x.date,x.time].filter(Boolean).join(' • '),venue=x.field||x.ha||'لم يُحدد الملعب';
  return '<article class="dash-fixture"><span class="dash-fixture-ball" aria-hidden="true">⚽</span><div class="dash-fixture-info"><b>'+esc(team)+' <span>×</span> '+esc(x.opp||'الخصم')+'</b><small>'+esc(x.type||'مباراة')+' • '+esc(when||'موعد غير محدد')+'</small></div><span class="dash-fixture-venue">'+esc(venue)+'</span></article>';
 }).join('')+'</div>';
}
function dashboardRecentPlayersHTML(){
 if(!canPage('players'))return '';
 const rows=db.players.filter(function(p){return p.status!=='منسحب'&&playerAllowed(p);}).slice().sort(function(a,b){return String(b.reg||'').localeCompare(String(a.reg||''));}).slice(0,4);
 if(!rows.length)return '<div class="empty">لا يوجد لاعبون مسجلون بعد.</div>';
 return '<div class="dash-recent-players">'+rows.map(function(p){
  const photo=safeImg(p.photo),avatar=photo?'<img src="'+photo+'" alt="">':'<span aria-hidden="true">⚽</span>';
  return '<div class="dash-player-row"><span class="dash-player-avatar">'+avatar+'</span><span class="dash-player-name"><b>'+esc(p.name||'لاعب')+'</b><small>'+esc([p.cat,refName('teams',p.team)].filter(Boolean).join(' • ')||'فئة غير محددة')+'</small></span><span class="tag '+tagClass(p.status||'نشط')+'">'+esc(p.status||'نشط')+'</span></div>';
 }).join('')+'</div>';
}
function dash(){
 const now=new Date(),m=MONTHS[now.getMonth()],y=now.getFullYear(),t=todayISO();
 const active=db.players.filter(p=>p.status!=='منسحب'&&p.status!=='متوقف').length;
 const visiblePlayers=db.players.filter(playerAllowed);
 const visiblePlayerIds=new Set(visiblePlayers.map(function(p){return p.id;}));
 const todayAtt=db.attendance.filter(function(a){return a.date===t&&(!isCoach()||visiblePlayerIds.has(a.player));});
 const pres=todayAtt.filter(a=>a.state===ATT[0]||a.state===ATT[3]).length;
 const abs=todayAtt.filter(a=>a.state===ATT[1]||a.state===ATT[2]).length;
 const attendanceRate=todayAtt.length?Math.round(pres/todayAtt.length*100):null;
 const ms=db.subs.filter(s=>s.month===m&&Number(s.year)===y);
 const paidCount=ms.filter(s=>s.state===PAY[0]).length;
 const lateCount=db.subs.filter(s=>s.state===PAY[2]||s.state===PAY[1]).length;
 const income=db.subs.filter(s=>s.month===m&&Number(s.year)===y).reduce((a,s)=>a+(Number(s.paid)||0),0);
 const spent=db.expenses.filter(e=>(e.date||'').slice(0,7)===t.slice(0,7)).reduce((a,e)=>a+(Number(e.amount)||0),0);
 const bal=income-spent;
 const debt=db.subs.reduce((a,s)=>a+Math.max(0,actualDue(s)-(Number(s.paid)||0)),0);
 const allUpcomingTrainings=db.trainings.filter(function(x){return x.status!=='ملغاة'&&x.date>=t&&trainAllowed(x);}).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const upcoming=allUpcomingTrainings.slice(0,5);
 const allFixtures=db.matches.filter(function(x){const team=(db.teams||[]).find(function(v){return v.id===x.team;});return x.date>=t&&catAllowed(team?team.cat:'');}).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const fixtures=allFixtures.slice(0,4);
 const sevenDays=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()+7)).toISOString().slice(0,10);
 const upcomingWeek=allUpcomingTrainings.filter(function(x){return x.date<=sevenDays;}).length+allFixtures.filter(function(x){return x.date<=sevenDays;}).length;
 const activeTeams=db.teams.filter(function(x){return x.status!=='متوقف';}).length;
 const activeCoaches=db.coaches.filter(function(x){return x.status!=='مغادر'&&x.status!=='متوقف';}).length;
 return '<div class="dashboard-view">'+
  dashboardMastheadHTML()+
  head('⚽ إدارة النادي والمدرسة',db.settings.school+' • متابعة الفرق واللاعبين والتداريب',
   '<button class="btn" '+actionAttr('click',()=>go('att'))+'>✅ تسجيل الحضور</button> <button class="btn primary" '+actionAttr('click',()=>openForm('players'))+'>＋ تسجيل لاعب</button>')+
  dailyWorkHTML()+
  '<section class="dash-quick-actions" aria-label="إجراءات سريعة">'+
   '<button '+actionAttr('click',()=>openForm('players'))+'><span>👕</span><b>تسجيل لاعب</b><small>ملف عضوية جديد</small></button>'+
   '<button '+actionAttr('click',()=>go('att'))+'><span>✅</span><b>الحضور</b><small>تسجيل حضور الفرق</small></button>'+
   '<button '+actionAttr('click',()=>openForm('trainings'))+'><span>🗓️</span><b>برمجة تدريب</b><small>حصة أو موعد دوري</small></button>'+
   '<button '+actionAttr('click',()=>openForm('matches'))+'><span>🏆</span><b>إضافة مباراة</b><small>ودية أو بطولة</small></button>'+
   '<button '+actionAttr('click',()=>openForm('subs'))+'><span>🧾</span><b>تسجيل أداء</b><small>اشتراك أو رسوم</small></button>'+
  '</section>'+
  '<div class="grid kpis dashboard-kpis dashboard-primary-kpis">'+
   kpi('👕 اللاعبون النشيطون',active,'b','منخرطون في المدرسة')+
   kpi('🏟️ الفرق والفئات',activeTeams,'','ضمن البرنامج الرياضي')+
   kpi('📅 أنشطة هذا الأسبوع',upcomingWeek,'o','تدريبات ومباريات قادمة')+
   kpi('✅ حضور اليوم',attendanceRate===null?'—':attendanceRate+'%',attendanceRate===null?'':attendanceRate>=80?'g':attendanceRate>=50?'o':'r',todayAtt.length?pres+' حاضر • '+abs+' غائب':'لم يُسجل حضور اليوم')+
  '</div>'+
  '<details class="dashboard-more-kpis"><summary><span>مؤشرات الإدارة والمالية</span><b>6</b></summary><div class="grid kpis dashboard-secondary-kpis">'+
   kpi('🧑‍🏫 المدربون النشيطون',activeCoaches,'','')+
   kpi('✅ اشتراكات '+m,paidCount,'g','مؤداة')+
   kpi('⚠️ اشتراكات تحتاج متابعة',lateCount,'o',money(debt)+' غير محصلة — <a href="#" '+actionAttr('click',()=>{go('wa');return false})+'>التذكير</a>')+
   kpi('💰 مداخيل '+m,money(income),'g','')+
   kpi('💸 مصاريف الشهر',money(spent),'r','')+
   kpi('🏦 الرصيد التقديري',money(bal),bal>=0?'g':'r','')+
  '</div></details>'+
  '<section class="dashboard-main">'+
   '<div class="dash-section-heading"><div><h2 class="sec">🗓️ برنامج التداريب القادم</h2><span class="sub">تابع حصص الفئات والمدربين والملاعب</span></div><button class="btn sm" '+actionAttr('click',()=>go('trainings'))+'>عرض جدول التداريب</button></div>'+
   dashboardTrainingTableHTML(upcoming)+
   '<div class="dash-section-heading"><div><h2 class="sec">🏆 المباريات والبطولات</h2><span class="sub">المواعيد المقبلة للفرق</span></div><button class="btn sm" '+actionAttr('click',()=>go('matches'))+'>إدارة المباريات</button></div>'+
   dashboardMatchTableHTML(fixtures)+
   '<h2 class="sec">💰 المداخيل والمصاريف — آخر 6 أشهر</h2>'+dashboardRevenueChartHTML(now)+
   '<h2 class="sec">⏰ تذكيرات التدريبات</h2>'+trainingRemindersHTML()+
  '</section>'+ 
  '<section class="dashboard-aside">'+
   '<section class="card dash-attendance-card"><div class="dash-card-heading"><b>✅ حضور اليوم</b><button class="btn sm" '+actionAttr('click',()=>go('att'))+'>فتح السجل</button></div><div class="dash-attendance-numbers"><div><b>'+pres+'</b><span>حاضر ومتأخر</span></div><div><b>'+abs+'</b><span>غائب أو مبرر</span></div><div><b>'+(attendanceRate===null?'—':attendanceRate+'%')+'</b><span>نسبة الحضور</span></div></div>'+(todayAtt.length?'<div class="dash-attendance-bar" role="img" aria-label="نسبة الحضور '+attendanceRate+'%"><span style="width:'+attendanceRate+'%"></span></div>':'<p class="sub dash-no-attendance">لم تُسجل الحصة بعد؛ ابدأ تسجيل الحضور من هنا.</p>')+'</section>'+
   dashboardSubscriptionsDonutHTML(m,y)+
   (canPage('players')?'<section class="card dash-recent-card"><div class="dash-card-heading"><b>👕 أحدث المنخرطين</b><button class="btn sm" '+actionAttr('click',()=>go('players'))+'>عرض اللاعبين</button></div>'+dashboardRecentPlayersHTML()+'</section>':'')+
   '<h2 class="sec">🚨 تنبيهات الوثائق والمعدات</h2>'+alertsHTML()+injuryAlertsHTML()+
  '</section>'+
 '</div>';
}

/* الحضور */
let attTeam='',attDate=todayISO(),attMonth=todayISO().slice(0,7);
function restrictedAttendanceAccount(){return !!(mobileInfo&&mobileInfo.user&&mobileInfo.user.role!=='admin'&&(mobileInfo.user.permissions||[]).includes('att'));}
function attendanceSyncPanelHTML(){
 if(!restrictedAttendanceAccount())return '';
 const conflict=cloudStatusPhase==='conflict',failure=cloudStatusPhase==='error';
 const title=mobileAttendanceBusy?'جارٍ إرسال الحضور…':conflict?'توقف الإرسال بسبب تعارض':failure?'لم يؤكد الخادم حفظ الحضور':cloudStatusPhase==='attendance'?'أكد الخادم السجلات المرسلة':'حضور الهاتف ومزامنته';
 const note=(conflict||failure)?cloudStatusNote:'تأكيد الحضور يخص السجلات المرسلة فقط، لا قاعدة البيانات كاملة. يمكن تغيير الحالة؛ حذف سجل سبق تسجيله يتولاه المدير.';
 return '<section class="card attendance-sync-card" aria-labelledby="attendanceSyncTitle"><h2 id="attendanceSyncTitle">'+esc(title)+'</h2><p role="status">'+esc(note)+'</p><div class="attendance-sync-actions"><button class="btn primary" '+(mobileAttendanceBusy?'disabled ':'')+actionAttr('click',()=>mobileAttendancePush())+'>إعادة إرسال الحضور</button><button class="btn" '+actionAttr('click',()=>exportAttendanceReview())+'>حفظ نسخة الحضور للمراجعة</button></div><p class="sub">عند التعارض: احفظ نسخة للمراجعة وتواصل مع المدير. لا تسجّل الخروج ولا تجلب نسخة تستبدل تعديلاتك قبل حفظها. إعادة الإرسال لا تتجاوز التعارض.</p></section>';
}
function refreshAttendanceSyncPanel(){const el=document.getElementById('attendanceSyncPanel');if(el){el.innerHTML=attendanceSyncPanelHTML();pruneAppActionHandlers();}}
async function exportAttendanceReview(){
 if(!restrictedAttendanceAccount()||!canPage('att')){denied();return false;}
 try{
  await waitForLocalPersistence();
  const players=(db.players||[]).filter(playerAllowed),ids=new Set(players.map(p=>p.id));
  const snapshot={type:'malaabna-attendance-review',version:1,exportedAt:new Date().toISOString(),school:db.settings.school||'',baseUpdatedAt:db.settings.syncBase||'',players:players.map(p=>({id:p.id,name:p.name||''})),attendance:(db.attendance||[]).filter(a=>ids.has(a.player)).map(a=>({id:a.id,player:a.player,date:a.date,state:a.state,team:a.team||''}))};
  validateAttendanceReview(snapshot);
  const phrase=prompt('أنشئ عبارة حماية لنسخة الحضور (12 حرفاً على الأقل). هذه نسخة للمراجعة، وليست نسخة كاملة لاستعادة المدرسة.');if(phrase===null)return false;
  if(phrase.length<12){alert('عبارة الحماية يجب أن تتكون من 12 حرفاً على الأقل.');return false;}
  if(prompt('أعد إدخال عبارة حماية نسخة الحضور.')!==phrase){alert('العبارتان غير متطابقتين؛ أُلغيت النسخة.');return false;}
  const sealed=await window.encryptPortableBackup(JSON.stringify(snapshot),phrase);
  dl('attendance-review-'+todayISO()+'.malaabna',JSON.stringify(sealed),'application/json');syncToast('حُفظ ملف مراجعة الحضور المشفّر. احتفظ بعبارته؛ ليس نسخة لاستعادة قاعدة البيانات.');return true;
 }catch(error){syncToast('تعذر إنشاء نسخة مراجعة الحضور: '+error.message);return false;}
}

let attendanceReviewDocument=null,attendanceReviewOffset=0;
function validateAttendanceReview(value){
 if(!value||value.type!=='malaabna-attendance-review'||value.version!==1||typeof value.school!=='string'||value.school.length>500||!Array.isArray(value.players)||!Array.isArray(value.attendance)||value.players.length>10000||value.attendance.length>10000)throw new Error('هذه ليست نسخة مراجعة حضور مدعومة. لا تستعملها لاستعادة المدرسة.');
 const ids=new Set();
 for(const p of value.players){if(!p||typeof p.id!=='string'||!p.id||p.id.length>80||ids.has(p.id)||typeof p.name!=='string'||p.name.length>500)throw new Error('مراجع اللاعبين في الملف غير صالحة.');ids.add(p.id);}
 for(const row of value.attendance){const d=row&&typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)?Date.parse(row.date+'T00:00:00Z'):NaN;if(!row||!ids.has(row.player)||typeof row.id!=='string'||row.id.length>80||!Number.isFinite(d)||new Date(d).toISOString().slice(0,10)!==row.date||typeof row.state!=='string'||!row.state||row.state.length>40)throw new Error('بعض سجلات ملف المراجعة غير صالحة.');}
 return value;
}
function renderAttendanceReview(){
 const value=attendanceReviewDocument;if(!value)return;
 const players=new Map(value.players.map(p=>[p.id,p.name])),rows=value.attendance.slice(attendanceReviewOffset,attendanceReviewOffset+50);
 document.getElementById('mBody').innerHTML='<div class="mf full"><p class="notice">للقراءة والمقارنة فقط — محتوى ملف محلي، وليس إثباتاً لاعتماد الخادم. لم يتغير حضور المدرسة أو هذا الجهاز.</p><p><b>'+esc(value.school)+'</b> · '+value.attendance.length+' سجل</p><div class="tw"><table><thead><tr><th>اللاعب</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+esc(players.get(row.player))+'<br><span class="sub">'+esc(row.player)+'</span></td><td><bdi>'+esc(row.date)+'</bdi></td><td>'+esc(row.state)+'</td></tr>').join('')+'</tbody></table></div><p role="status">'+(value.attendance.length?'السجلات '+(attendanceReviewOffset+1)+'–'+(attendanceReviewOffset+rows.length):'لا توجد سجلات')+'</p>'+(value.attendance.length>50?'<div class="attendance-sync-actions"><button class="btn" '+(attendanceReviewOffset===0?'disabled ':'')+actionAttr('click',()=>{attendanceReviewOffset=Math.max(0,attendanceReviewOffset-50);renderAttendanceReview();})+'>السابق</button><button class="btn" '+(attendanceReviewOffset+50>=value.attendance.length?'disabled ':'')+actionAttr('click',()=>{attendanceReviewOffset+=50;renderAttendanceReview();})+'>التالي</button></div>':'')+'</div>';
 document.getElementById('mBody').scrollTop=0;pruneAppActionHandlers();
}
async function openAttendanceReviewFile(input){
 if(!canPage('att')){denied();input.value='';return false;}
 try{
  const file=input.files&&input.files[0];if(!file)return false;if(file.size>16*1024*1024)throw new Error('ملف المراجعة أكبر من الحد المسموح (16 ميغابايت).');
  const envelope=JSON.parse(await file.text());if(!envelope||envelope.__malaabnaBackup!==1)throw new Error('اختر نسخة مراجعة حضور مشفّرة وقابلة للنقل.');
  const phrase=prompt('أدخل عبارة حماية نسخة مراجعة الحضور. سيُفتح الملف للقراءة فقط.');if(phrase===null)return false;
  const value=validateAttendanceReview(JSON.parse(await window.decryptPortableBackup(envelope,phrase)));
  clearModalError();mFormDirty=false;mColl=null;mId=null;attendanceReviewDocument=value;attendanceReviewOffset=0;
  document.getElementById('mTitle').textContent='نسخة الحضور — للمراجعة فقط';renderAttendanceReview();
  setModalSaveAction(()=>closeModal(true),'تم');const ov=document.getElementById('ov');window._modalOpener=document.activeElement;ov.setAttribute('data-dialog-kind','attendance-review');ov.classList.add('on');ov.setAttribute('aria-hidden','false');ov.scrollTop=0;const close=document.getElementById('modalCloseBtn');close.textContent='إغلاق';close.focus();return true;
 }catch(error){syncToast('تعذر فتح نسخة المراجعة: '+error.message);return false;}
 finally{input.value='';}
}

function attPage(){
 const list=db.players.filter(p=>p.status!=='منسحب'&&(!attTeam||p.team===attTeam)&&playerAllowed(p));
 const rows=list.map(p=>{
  const rec=db.attendance.find(a=>a.player===p.id&&a.date===attDate);
  const st=rec?rec.state:'';
  const b=(lab,cls)=>'<button class="ab '+(st===lab?'on-'+cls:'')+'" '+actionAttr('click',()=>mark(p.id,lab))+'>'+lab+'</button>';
  const notify=(st===ATT[1]||st===ATT[2])?' <button class="ab" style="background:var(--greenS);border-color:#8fc7a8;color:#2b6b4a" '+actionAttr('click',()=>sendAbs(p.id,attDate))+'>💬 إشعار ولي الأمر'+(rec&&rec.waSent?' ✓':'')+'</button>':'';
  return '<div class="att-row"><div class="att-name">'+(p.photo?'<img class="avatar" src="'+safeImg(p.photo)+'">':'<span class="avatar"></span>')+esc(p.name)+' <span class="tag t-n">'+esc(p.cat||'')+'</span></div>'+
   '<div class="att-btns">'+b(ATT[0],'g')+b(ATT[1],'r')+b(ATT[2],'o')+b(ATT[3],'b')+notify+'</div></div>';
 }).join('');
 const done=db.attendance.filter(a=>a.date===attDate);
 return head('✅ الحضور','سجّل حضور الحصة بضغطة واحدة • '+done.length+' سجل في هذا التاريخ','<button class="btn" '+actionAttr('click',()=>document.getElementById('attendanceReviewFile').click())+'>فتح نسخة حضور للمراجعة</button><input id="attendanceReviewFile" type="file" accept=".malaabna,application/json" hidden '+actionAttr('change',(_,el)=>openAttendanceReviewFile(el))+'>')+
  '<div id="attendanceSyncPanel" class="no-print">'+attendanceSyncPanelHTML()+'</div>'+
  '<div class="tools"><input type="date" value="'+esc(attDate)+'" '+actionAttr('change',(_,el)=>{attDate=el.value;render();})+'>'+
  '<select '+actionAttr('change',(_,el)=>{attTeam=el.value;render();})+'><option value="">كل الفرق</option>'+db.teams.map(t=>'<option value="'+esc(t.id)+'" '+(attTeam===t.id?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select>'+
  '<button class="btn" '+actionAttr('click',()=>markAll())+'>تعليم الجميع حاضرين</button>'+
  '<button class="btn primary" '+actionAttr('click',()=>sendAbsAll())+'>💬 إشعار أولياء الغائبين</button></div>'+
  '<div class="tw">'+(list.length?rows:'<div class="empty">لا يوجد لاعبون في هذا الفريق.</div>')+'</div>'+
  '<h2 class="sec">إحصائيات الحضور '+(attMonth?'(شهر '+attMonth+')':'(كل السجلات)')+'</h2>'+
  '<div class="tools no-print"><input type="month" value="'+esc(attMonth)+'" '+actionAttr('change',(_,el)=>{attMonth=el.value;render();})+'>'+
  '<button class="btn" '+actionAttr('click',()=>{attMonth='';render();})+'>كل السجلات</button>'+
  '<button class="btn" '+actionAttr('click',()=>{attMonth=todayISO().slice(0,7);render();})+'>الشهر الحالي</button></div>'+attStats();
}
async function mark(pid,state){
 let r=db.attendance.find(a=>a.player===pid&&a.date===attDate);
 if(r&&r.state===state&&restrictedAttendanceAccount()){syncToast('لم نحذف السجل: اختر حالة أخرى للتصحيح، أو اطلب من المدير حذف التسجيل.');return;}
 if(r){r.state=(r.state===state)?'':state;if(!r.state)db.attendance=db.attendance.filter(a=>a!==r);}
 else db.attendance.push({id:uid(),player:pid,date:attDate,state:state,team:(db.players.find(p=>p.id===pid)||{}).team});
 if(!await save())return;render();
}
async function markAll(){db.players.filter(p=>p.status!=='منسحب'&&(!attTeam||p.team===attTeam)&&playerAllowed(p)).forEach(p=>{if(!db.attendance.find(a=>a.player===p.id&&a.date===attDate))db.attendance.push({id:uid(),player:p.id,date:attDate,state:ATT[0],team:p.team});});if(!await save())return;render();}
function attStats(){
 const rows=db.players.filter(playerAllowed).map(p=>{const my=db.attendance.filter(a=>a.player===p.id&&(!attMonth||String(a.date||'').slice(0,7)===attMonth));
  const g=my.filter(a=>a.state===ATT[0]).length,r=my.filter(a=>a.state===ATT[1]).length,o=my.filter(a=>a.state===ATT[2]).length,b=my.filter(a=>a.state===ATT[3]).length;
  const tot=my.length,rate=tot?Math.round((g+b)/tot*100):0;
  return {n:p.name,g:g,r:r,o:o,b:b,tot:tot,rate:rate};}).filter(x=>x.tot);
 if(!rows.length)return '<div class="card"><div class="empty">لا توجد سجلات حضور بعد.</div></div>';
 return '<div class="tw"><table><thead><tr><th>اللاعب</th><th>حاضر</th><th>غائب</th><th>مبرر</th><th>متأخر</th><th>نسبة الحضور</th></tr></thead><tbody>'+
  rows.sort((a,b)=>b.rate-a.rate).map(x=>'<tr><td>'+esc(x.n)+'</td><td>'+x.g+'</td><td>'+x.r+'</td><td>'+x.o+'</td><td>'+x.b+'</td><td><span class="tag '+(x.rate>=80?'t-g':x.rate>=50?'t-o':'t-r')+'">'+x.rate+'%</span></td></tr>').join('')+'</tbody></table></div>';
}

/* الاشتراكات والرسوم */
function roundCurrency(n){return Math.round((Number(n)||0)*100)/100;}
function receiptMoney(n,doc){return (Number(n)||0).toLocaleString('fr-MA')+' '+((doc&&doc.currency)||db.settings.currency||'درهم');}
function isExempt(s){return !!(s&&(s.exempt==='نعم'||s.state===PAY[3]));}
function actualDue(s){return isExempt(s)?0:Math.max(0,Number(s&&s.due)||0);}
function baseAmount(s){return Math.max(0,Number(s&&(s.baseDue!=null?s.baseDue:s.due))||0);}
function discountAmount(s){if(s&&s.discountAmount!=null)return Math.max(0,Number(s.discountAmount)||0);return Math.max(0,baseAmount(s)-Math.max(0,Number(s&&s.due)||0));}
function feeLabel(s){if(s&&s.kind==='رسوم التسجيل')return 'رسوم التسجيل'+(Number(s.registrationInstallmentCount)>1?' — الدفعة '+Number(s.registrationInstallment)+' من '+Number(s.registrationInstallmentCount):'');return (s&&s.month||'')+' '+(s&&s.year||'');}
function nextReceiptNumber(){return MalaabnaFinance.nextReceiptNumber(db.settings,db.subs,db.receipts);}
function updateSubEstimate(){const get=function(id){const e=document.getElementById(id);return e?e.value:'';};const base=Math.max(0,Number(get('f_baseDue'))||0),type=get('f_discountType'),value=Math.max(0,Number(get('f_discountValue'))||0),exempt=get('f_exempt')==='نعم';let d=type==='مبلغ ثابت'?Math.min(base,value):(type==='نسبة مئوية'?Math.min(base,base*value/100):0);d=roundCurrency(d);const due=exempt?0:Math.max(0,roundCurrency(base-d)),count=Number(get('f_registrationInstallmentCount'))||1;const box=document.getElementById('subFeeEstimate');if(box)box.textContent='المبلغ الأصلي: '+money(base)+' • الخصم: '+money(d)+' • المستحق بعد الخصم/الإعفاء: '+money(due)+(count>1?' • يُقسّم إلى '+count+' دفعات متقاربة؛ يُضاف فرق السنتيمات إلى الدفعة الأخيرة.':'')+(exempt?' • إعفاء كامل':'');}
function monthlyFeeForPlayer(player){const team=(db.teams||[]).find(function(x){return x.id===player?.team;});return Number(player&&player.fee)||Number(team&&team.fee)||Number(db.settings&&db.settings.fee)||0;}
function subscriptionStartForMonth(month,year){const index=MONTHS.indexOf(String(month||'')),y=Number(year);if(index<0||!Number.isInteger(y)||y<1900||y>9999)return '';const next=y*12+index+1,ny=Math.floor(next/12),nm=next%12+1;return String(ny).padStart(4,'0')+'-'+String(nm).padStart(2,'0')+'-01';}
function subscriptionStartForRecord(record){if(record&&/^\d{4}-\d{2}-\d{2}$/.test(String(record.subscriptionStartsOn||'')))return record.subscriptionStartsOn;if(record&&record.includedFirstMonth===true&&record.includedFirstMonthMonth&&Number(record.includedFirstMonthYear))return subscriptionStartForMonth(record.includedFirstMonthMonth,record.includedFirstMonthYear);return '';}
function monthPeriodStart(month,year){const index=MONTHS.indexOf(String(month||'')),y=Number(year);if(index<0||!Number.isInteger(y)||y<1900||y>9999)return '';return String(y).padStart(4,'0')+'-'+String(index+1).padStart(2,'0')+'-01';}
function isMonthlyPeriodBeforeStart(month,year,registration){const period=monthPeriodStart(month,year),start=subscriptionStartForRecord(registration);return !!(period&&start&&period<start);}
function updateRegistrationFeeEntryEstimate(){const get=function(id){const e=document.getElementById('f_'+id);return e?e.value:'';},box=document.getElementById('registrationFeeBundleNotice'),baseField=document.getElementById('f_baseDue');if(!box||!baseField)return;const month=get('month'),year=Number(get('year')),player=db.players.find(function(x){return x.id===get('player');}),registrationBase=Math.max(0,roundCurrency(Number(db.settings&&db.settings.registrationFee)||0)),monthly=player?Math.max(0,roundCurrency(monthlyFeeForPlayer(player))):0,alreadyMonthly=!!(player&&db.subs.some(function(x){return x.player===player.id&&(x.kind||'اشتراك شهري')==='اشتراك شهري'&&x.month===month&&Number(x.year)===year;}));baseField.value=roundCurrency(registrationBase+(alreadyMonthly?0:monthly));box.textContent=alreadyMonthly?'يوجد سجل شهري لهذا اللاعب في الفترة المحددة؛ سيُحتسب رسم التسجيل فقط لتجنب التكرار.':'يُسجّل إجمالي رسوم التسجيل والمبلغ المستحق لهذه الفترة في سجل مالي واحد. تبدأ الاستحقاقات الشهرية الدورية من بداية الشهر التالي.';updateSubEstimate();}
function openRegistrationFeeForm(){
 openForm('subs');const set=function(id,value){const e=document.getElementById('f_'+id);if(e)e.value=value;};const n=new Date();
 set('kind','رسوم التسجيل');set('baseDue',Number(db.settings.registrationFee)||0);set('month',MONTHS[n.getMonth()]);set('year',n.getFullYear());
 document.getElementById('mBody').insertAdjacentHTML('afterbegin','<div class="mf full notice" id="registrationFeeBundleNotice">يُسجّل إجمالي رسوم التسجيل والمبلغ المستحق لهذه الفترة في سجل مالي واحد. تبدأ الاستحقاقات الشهرية الدورية من بداية الشهر التالي.</div><div class="mf full"><label for="f_registrationInstallmentCount">تقسيم رسوم التسجيل</label><select id="f_registrationInstallmentCount"><option value="1">دفعة واحدة</option><option value="2">دفعتان</option><option value="3">3 دفعات</option></select><div class="sub">يُنشأ سجل مستقل لكل دفعة لتسجيل الأداء وإصدار وصل لكل دفعة.</div></div>');
 const installment=document.getElementById('f_registrationInstallmentCount');if(installment)installment.addEventListener('change',updateSubEstimate);const base=document.getElementById('f_baseDue');if(base)base.readOnly=true;
 ['f_player','f_month','f_year'].forEach(function(id){const el=document.getElementById(id);if(el){el.addEventListener('change',updateRegistrationFeeEntryEstimate);el.addEventListener('input',updateRegistrationFeeEntryEstimate);}});
 updateRegistrationFeeEntryEstimate();
}
/* كشف حساب اللاعب والأداء المباشر من الأقساط */
let accountPlayerId='',installmentPaymentBusy=false;
function canPlayerAccount(id){const p=db.players.find(p=>p.id===id);return !!(p&&canPage('subs')&&playerAllowed(p));}
function openPlayerAccount(id){if(!canPlayerAccount(id)){denied();return;}accountPlayerId=id;page='subs';render();}
function openAccountReceipt(id){if(!canPage('receipts')){denied();return;}const doc=(db.receipts||[]).find(x=>x.id===id);if(!doc||!canPlayerAccount(doc.s&&doc.s.player)){denied();return;}receiptId=id;receiptCopyState=null;page='receipts';render();}
function playerAccountModel(id){
 if(!canPlayerAccount(id))return null;
 const p=db.players.find(p=>p.id===id),team=db.teams.find(t=>t.id===p.team)||{},s=db.settings;
 return {player:{id:p.id,name:p.name||'—',category:p.cat||'',team:team.name||''},school:{school:s.school||'مدرسة كرة القدم',logo:s.logo||'',address:s.address||'',schoolPhone:s.phone||'',currency:s.currency||'درهم'},preparedAt:new Date().toISOString(),account:MalaabnaFinance.playerAccountSnapshot(id,db.subs)};
}
function playerAccountHTML(){
 const players=db.players.filter(p=>canPlayerAccount(p.id));
 const select='<div class="account-select"><label for="accountPlayer">كشف حساب اللاعب</label><select id="accountPlayer" '+actionAttr('change',(e,el)=>{accountPlayerId=el.value;render();})+'><option value="">اختر اللاعب…</option>'+players.map(p=>'<option value="'+esc(p.id)+'" '+(accountPlayerId===p.id?'selected':'')+'>'+esc(p.name||'—')+'</option>').join('')+'</select></div>';
 const model=playerAccountModel(accountPlayerId);if(!model)return '<section class="card account-panel">'+select+'<p class="sub">اختر لاعباً لعرض رسومه وأقساطه والأداءات وتنزيل كشف حسابه.</p></section>';
 const a=model.account,summary='<div class="account-summary">'+[['إجمالي المستحق',a.totals.due],['المؤدى',a.totals.paid],['المتبقي',a.totals.rest]].map(r=>'<div><span>'+r[0]+'</span><b>'+money(r[1])+'</b></div>').join('')+'</div>';
 const sections=a.groups.filter(g=>g.rows.length).map(g=>'<h3>'+g.title+'</h3><div class="account-lines">'+g.rows.map(r=>'<div class="account-line"><b>'+esc(r.label)+(r.exempt?' — معفى':'')+'</b><span>المستحق: '+money(r.due)+'</span><span>المؤدى: '+money(r.paid)+'</span><strong>المتبقي: '+money(r.rest)+'</strong></div>').join('')+'</div>').join('');
 const installments=db.subs.filter(s=>s.player===accountPlayerId&&s.kind==='رسوم التسجيل'&&Number(s.registrationInstallmentCount)>1).sort((a,b)=>String(a.registrationPlanId).localeCompare(String(b.registrationPlanId))||Number(a.registrationInstallment)-Number(b.registrationInstallment));
 const plans=installments.length?'<h3>جدول أقساط التسجيل</h3><div class="account-installments">'+installments.map(s=>{const rest=roundCurrency(actualDue(s)-(Number(s.paid)||0));return '<article class="account-installment"><div><b>'+esc(feeLabel(s))+'</b><p>المؤدى: '+money(s.paid)+' · المتبقي: '+money(Math.max(0,rest))+'</p></div><div class="account-row-actions">'+(isAdmin()&&rest>0&&!isExempt(s)?'<button class="btn primary" '+actionAttr('click',()=>openInstallmentPayment(s.id))+' >تسجيل أداء</button>':'<span class="tag">'+(isExempt(s)?'معفى':rest<=0?'مسددة':'للاطلاع')+'</span>')+(s.receiptDocId&&canPage('receipts')?'<button class="btn" '+actionAttr('click',()=>openAccountReceipt(s.receiptDocId))+'>عرض الوصل الأخير</button>':'')+'</div></article>';}).join('')+'</div>':'';
 const payments=a.payments.length?'<div class="account-payments">'+a.payments.map(e=>'<div class="account-payment"><div><b>'+esc(e.label)+'</b><p>'+esc(e.date||'تاريخ غير موثق')+' · '+esc(e.method||'طريقة غير موثقة')+(e.opening?' · مؤدى سابق مجمّع':'')+'</p><small dir="auto">'+esc(e.rec||'رقم وصل غير موثق')+'</small></div><div><strong>'+money(e.amount)+'</strong>'+(e.receiptId&&(db.receipts||[]).some(d=>d.id===e.receiptId)&&canPage('receipts')?'<button class="btn sm" '+actionAttr('click',()=>openAccountReceipt(e.receiptId))+'>عرض الوصل</button>':'')+'</div></div>').join('')+'</div>':'<p class="sub">لا توجد أداءات مسجلة.</p>';
 return '<section class="card account-panel">'+select+'<div class="account-heading"><div><h2>'+esc(model.player.name)+'</h2><p class="sub">'+esc([model.player.category,model.player.team].filter(Boolean).join(' — '))+'</p></div><button class="btn primary" '+actionAttr('click',()=>downloadPlayerAccountPDF(accountPlayerId))+'>تنزيل كشف الحساب PDF</button></div><p class="account-scope">الوضع الحالي لجميع الرسوم والاشتراكات الدورية المسجلة. هذا كشف حساب وليس وصلاً جديداً.</p>'+summary+(a.warnings.length?'<div class="notice" role="alert">الكشف غير مكتمل: '+a.warnings.map(esc).join('؛ ')+'؛ المجاميع لا تشمل السجلات ذات المبالغ غير الصالحة.</div>':'')+(sections||'<div class="empty">لا توجد رسوم مسجلة لهذا اللاعب.</div>')+plans+'<h3>تفصيل الأداءات</h3>'+payments+'<p class="sub">المؤدى السابق يُعرض كمبلغ مجمّع عند غياب سجل دفعات مفصل. لا تُجمع الوصولات المصححة أو النسخ المكررة مرة ثانية.</p></section>';
}
async function downloadPlayerAccountPDF(id){
 const model=playerAccountModel(id);if(!model){denied();return;}
 try{const blob=await MalaabnaReceipts.createAccountPDF(model);downloadReceiptPdf(blob,'player-account-'+String(id).replace(/[^a-zA-Z0-9_-]/g,'-')+'-'+model.preparedAt.slice(0,10)+'.pdf');}catch(e){alert('تعذر إنشاء كشف الحساب: '+(e&&e.message||'خطأ غير معروف'));}
}
function openInstallmentPayment(id){
 if(!isAdmin()||installmentPaymentBusy){if(!isAdmin())denied();return;}
 const s=db.subs.find(s=>s.id===id);if(!s||!canPlayerAccount(s.player)){denied();return;}
 const rest=roundCurrency(actualDue(s)-(Number(s.paid)||0));if(s.kind!=='رسوم التسجيل'||!s.registrationPlanId||Number(s.registrationInstallmentCount)<=1||isExempt(s)||rest<=0){alert('لا توجد دفعة مستحقة في هذا القسط.');return;}
 mFormDirty=false;clearModalError();mColl=null;mId=null;
 document.getElementById('mTitle').textContent='تسجيل أداء — '+feeLabel(s);
 const closeButton=document.getElementById('modalCloseBtn');if(closeButton)closeButton.textContent='إغلاق';
 document.getElementById('mBody').innerHTML='<div class="mf full notice">'+esc(refName('players',s.player))+' — المتبقي: <b>'+money(rest)+'</b><br>أدخل المبلغ الجديد فقط؛ يُضاف إلى المؤدى السابق ويصدر له وصل مستقل.</div><div class="mf"><label for="installmentAmount">مبلغ الأداء الجديد</label><input id="installmentAmount" type="number" min="0.01" max="'+esc(rest)+'" step="0.01" value="'+esc(rest)+'" required></div><div class="mf"><label for="installmentDate">تاريخ الأداء</label><input id="installmentDate" type="date" value="'+todayISO()+'" required></div><div class="mf full"><label for="installmentMethod">طريقة الأداء</label><select id="installmentMethod"><option>نقداً</option><option>تحويل بنكي</option><option>شيك</option><option>تحويل إلكتروني</option></select></div>';
 const expectedPaid=Number(s.paid)||0;setModalSaveAction(()=>saveInstallmentPayment(id,expectedPaid),'حفظ الأداء وإصدار الوصل');const ov=document.getElementById('ov');window._modalOpener=document.activeElement;ov.classList.add('on');ov.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('installmentAmount')?.focus(),0);
}
async function saveInstallmentPayment(id,expectedPaid){
 if(installmentPaymentBusy)return;
 if(!isAdmin()){denied();return;}
 const original=db,s=original.subs.find(s=>s.id===id);if(!s||!canPlayerAccount(s.player)){denied();return;}
 const input={amount:(document.getElementById('installmentAmount')||{}).value,date:(document.getElementById('installmentDate')||{}).value,method:(document.getElementById('installmentMethod')||{}).value,id:uid(),rec:'pending',receiptId:uid(),issuedAt:new Date().toISOString()};
 const checked=MalaabnaFinance.addInstallmentPayment(s,input,expectedPaid);
 const errors={stale_payment:'تغير المبلغ منذ فتح النموذج. أغلقه وأعد فتحه قبل الحفظ.',invalid_payment:'أدخل مبلغاً موجباً بحد أقصى منزلتين عشريتين.',paid_over_due:'المبلغ يتجاوز المتبقي من هذا القسط.',invalid_date:'أدخل تاريخ أداء صحيحاً.',invalid_method:'اختر طريقة الأداء.',invalid_ledger:'سجل الدفعات لا يطابق المؤدى الحالي. راجع البيانات قبل المتابعة.'};
 if(!checked.ok){showModalError(errors[checked.error]||'تعذر تسجيل الأداء؛ راجع بيانات القسط.');return;}
 installmentPaymentBusy=true;const button=document.querySelector('#ov .mfoot .btn.primary');if(button){button.disabled=true;button.textContent='جارٍ حفظ الأداء…';}
 try{
  db=MalaabnaFinance.snapshotDocument(original);const old=db.subs.find(s=>s.id===id);
  // Preserve any pre-existing receipt exactly as it stood, before adding the new payment.
  if(Number(old.paid)>0)ensureReceiptSnapshot(old);
  input.rec=nextReceiptNumber();const result=MalaabnaFinance.addInstallmentPayment(old,input,expectedPaid);if(!result.ok)throw new Error('تعذر التحقق من سجل الأداء.');
  const updated=result.record;updated.state=updated.paid>=actualDue(updated)?PAY[0]:PAY[1];db.subs[db.subs.findIndex(s=>s.id===id)]=updated;
  const fresh={...updated,receiptIssuedAt:''},doc=createReceiptDocument(fresh,input.issuedAt);doc.id=input.receiptId;doc.payment={...result.event,previousPaid:result.previousPaid,cumulativePaid:updated.paid};db.receipts.push(doc);
  auditAdd('تسجيل أداء قسط',refName('players',updated.player)+' — '+feeLabel(updated)+' — أداء جديد '+money(result.event.amount)+' — الوصل '+input.rec);
  db.settings.changed=new Date().toISOString();await persistDbSnapshot();
 }catch(e){db=original;showModalError('لم يُحفظ الأداء. '+(e&&e.message||'أعد المحاولة.'));return;}
 finally{installmentPaymentBusy=false;if(button){button.disabled=false;button.textContent='حفظ الأداء وإصدار الوصل';}}
 if(typeof syncSchedule==='function')syncSchedule();closeModal(true);receiptId=input.receiptId;receiptCopyState=null;page='receipts';render();
}

function subsPage(){
 const now=new Date(),debt=db.subs.reduce((a,s)=>a+Math.max(0,actualDue(s)-(Number(s.paid)||0)),0);
 return head('💰 الاشتراكات والرسوم',db.subs.length+' سجل • غير المحصل: '+money(debt),
  '<button class="btn" '+actionAttr('click',()=>genMonth())+'>توليد اشتراكات '+MONTHS[now.getMonth()]+'</button> <button class="btn" '+actionAttr('click',()=>openRegistrationFeeForm())+'>＋ رسوم تسجيل</button> <button class="btn primary" '+actionAttr('click',()=>openForm('subs'))+'>＋ إضافة رسم</button>')+
  playerAccountHTML()+subsTable(db.subs);
}
function subsTable(list){
 if(!list.length)return '<div class="card"><div class="empty">لا توجد رسوم بعد. استعمل «توليد اشتراكات الشهر» أو «رسوم تسجيل».</div></div>';
 return '<div class="tw"><table><thead><tr><th>اللاعب</th><th>نوع الرسم / الفترة</th><th>الأصلي</th><th>الخصم</th><th>المستحق</th><th>المؤدى</th><th>المتبقي</th><th>الحالة</th><th>رقم الوثيقة</th><th class="no-print">إجراءات</th></tr></thead><tbody>'+
 list.slice().sort((a,b)=>String(b.year||'').concat(b.month||'').localeCompare(String(a.year||'').concat(a.month||''))).map(function(s){
  const due=actualDue(s),paid=Math.max(0,Number(s.paid)||0),rest=Math.max(0,due-paid),exempt=isExempt(s),label=feeLabel(s.kind==='رسوم التسجيل'?s:{kind:'اشتراك شهري',month:s.month,year:s.year});
  const receiptBtn=exempt?'<button class="btn sm" '+actionAttr('click',()=>showReceipt(s.id,'exemption'))+'>سند إعفاء</button> ':paid>0?'<button class="btn sm" '+actionAttr('click',()=>showReceipt(s.id,'payment'))+'>إصدار وصل</button> ':'';
  return '<tr><td>'+esc(refName('players',s.player))+'</td><td>'+esc(label)+(s.kind==='رسوم التسجيل'?' <span class="tag t-b">'+(Number(s.registrationInstallmentCount)>1?'الدفعة '+s.registrationInstallment+'/'+s.registrationInstallmentCount:'مرة واحدة')+'</span>':'')+'</td><td>'+money(baseAmount(s))+'</td><td>'+money(discountAmount(s))+'</td><td>'+money(due)+'</td><td>'+money(paid)+'</td><td>'+(rest?'<b style="color:var(--red)">'+money(rest)+'</b>':money(0))+'</td>'+
   '<td><span class="tag '+tagClass(s.state)+'">'+esc(s.state||'')+'</span></td><td>'+esc(s.rec||'—')+'</td>'+
   '<td class="no-print">'+(isAdmin()&&s.kind==='رسوم التسجيل'&&Number(s.registrationInstallmentCount)>1&&rest>0&&!exempt?'<button class="btn sm primary" '+actionAttr('click',()=>openInstallmentPayment(s.id))+'>تسجيل أداء</button> ':'')+receiptBtn+'<button class="btn sm" '+actionAttr('click',()=>openForm('subs',s.id))+'>تعديل</button> <button class="btn sm danger" '+actionAttr('click',()=>del('subs',s.id))+'>حذف</button></td></tr>';
 }).join('')+'</tbody></table></div>';
}
async function genMonth(){
 const now=new Date(),m=MONTHS[now.getMonth()],y=now.getFullYear();let n=0;
 db.players.filter(p=>p.status!=='منسحب').forEach(p=>{
  if(db.subs.find(s=>s.player===p.id&&(s.kind||'اشتراك شهري')==='اشتراك شهري'&&s.month===m&&Number(s.year)===y))return;
  if(db.subs.some(s=>s.player===p.id&&s.kind==='رسوم التسجيل'&&isMonthlyPeriodBeforeStart(m,y,s)))return;
  const due=monthlyFeeForPlayer(p);
  db.subs.push({id:uid(),player:p.id,kind:'اشتراك شهري',month:m,year:y,baseDue:due,discountType:'بدون',discountValue:0,discountAmount:0,exempt:'لا',exemptionAmount:0,due:due,paid:0,state:PAY[2]});n++;
 });
 if(!await save())return;alert('تم توليد '+n+' اشتراك لشهر '+m);render();
}
let receiptId=null,receiptType='payment',receiptCopyState=null;
function createReceiptDocument(s,issuedAt){
 const p=db.players.find(x=>x.id===s.player)||{},team=db.teams.find(t=>t.id===p.team)||{},par=parentRecord(p);
 const snap={id:s.id,player:s.player,rec:s.rec||'',kind:s.kind||'اشتراك شهري',month:s.month||'',year:s.year||'',registrationPlanId:s.registrationPlanId||'',registrationInstallment:Number(s.registrationInstallment)||0,registrationInstallmentCount:Number(s.registrationInstallmentCount)||0,baseDue:baseAmount(s),registrationFeeBase:Number(s.registrationFeeBase)||0,discountType:s.discountType||'بدون',discountValue:Number(s.discountValue)||0,discountAmount:discountAmount(s),discountReason:s.discountReason||'',exempt:isExempt(s)?'نعم':'لا',exemptReason:s.exemptReason||'',exemptionAmount:Number(s.exemptionAmount)||0,due:actualDue(s),paid:Math.max(0,Number(s.paid)||0),date:s.date||todayISO(),method:s.method||'نقداً',state:s.state||'',correctionOf:s.receiptCorrectionOf||''};
 const due=snap.due,paid=snap.paid;const receiptIssuedAt=issuedAt||new Date().toISOString();
 const planSnapshot=s.receiptIssuedAt?null:MalaabnaFinance.registrationPlanSnapshot(s,db.subs,receiptIssuedAt);
 return {id:uid(),subsId:s.id,rec:snap.rec,issuedAt:receiptIssuedAt,registrationPlan:planSnapshot?MalaabnaFinance.snapshotDocument(planSnapshot):null,type:isExempt(s)?'exemption':'payment',s:MalaabnaFinance.snapshotDocument(snap),p:MalaabnaFinance.snapshotDocument({name:p.name||'—',cat:p.cat||''}),team:MalaabnaFinance.snapshotDocument({name:team.name||''}),par:MalaabnaFinance.snapshotDocument({name:par.name||'—'}),phone:playerNum(p),due:due,paid:paid,rest:Math.max(0,due-paid),base:snap.baseDue,discount:snap.discountAmount,school:db.settings.school||'مدرسة كرة القدم',address:db.settings.address||'',schoolPhone:db.settings.phone||'',logo:db.settings.logo||'',stamp:db.settings.stamp||'',directorName:db.settings.dirName||'',directorRole:db.settings.dirRole||'مدير المدرسة',currency:db.settings.currency||'درهم'};
}
function ensureReceiptSnapshot(s){
 if(!Array.isArray(db.receipts))db.receipts=[];
 return MalaabnaFinance.ensureReceiptSnapshot(db.receipts,s,createReceiptDocument);
}
async function migrateReceiptSnapshots(){
 if(!Array.isArray(db.receipts))db.receipts=[];
 const changed=MalaabnaFinance.migrateReceiptSnapshots(db.receipts,db.subs,createReceiptDocument);
 if(changed)if(!await save())return;
}
async function showReceipt(id,type){
 const s=(db.subs||[]).find(x=>x.id===id);if(!s)return;
 if(!isExempt(s)&&Number(s.paid)<=0){alert('لا يمكن إصدار وصل أداء قبل تسجيل مبلغ مؤدى.');return;}
 const previous=s.receiptDocId&&db.receipts.find(x=>x.id===s.receiptDocId);
 if(previous&&MalaabnaFinance.hasFinancialChanges(previous.s,s)){
  s.receiptDocId='';s.receiptIssuedAt='';s.rec=nextReceiptNumber();
 }
 receiptType=type||(isExempt(s)?'exemption':'payment');if(!s.rec)s.rec=nextReceiptNumber();
 const wasIssued=!!s.receiptIssuedAt,doc=ensureReceiptSnapshot(s);
 if(!wasIssued)auditAdd(receiptType==='exemption'?'إصدار سند إعفاء':'إصدار وصل أداء',(refName('players',s.player)||'')+' — '+s.rec);
 if(!await save())return;receiptId=doc.id;receiptCopyState=null;page='receipts';render();
}
function receiptEntries(){return Array.isArray(db.receipts)?db.receipts.slice().sort(function(a,b){return String(b.correction&&b.correction.preparedAt||b.issuedAt||'').localeCompare(String(a.correction&&a.correction.preparedAt||a.issuedAt||''));}):[];}
function receiptLabel(s){return isExempt(s)?'سند إعفاء':(s.kind==='رسوم التسجيل'?'وصل '+feeLabel(s):'وصل أداء الاشتراك');}
function receiptNumberLabel(doc){return doc&&doc.type==='exemption'?'رقم السند':'رقم الوصل';}
function receiptFeeDescription(s){if(s&&s.kind==='رسوم التسجيل')return feeLabel(s);const period=[s&&s.month,s&&s.year].filter(Boolean).join(' ');return period?'الاشتراك الشهري عن '+period:'الاشتراك الشهري';}
function receiptStatement(doc){
 const s=doc.s||{},player=doc.p&&doc.p.name||'—',guardian=doc.par&&doc.par.name||'ولي الأمر',school=doc.school||'المدرسة',fee=receiptFeeDescription(s);
 if(doc.type==='exemption')return 'يثبت هذا السند إعفاء اللاعب/اللاعبة '+player+' من مبلغ '+receiptMoney(Number(s.exemptionAmount)||Math.max(0,(Number(doc.base)||0)-(Number(doc.discount)||0)),doc)+' عن '+fee+'.'+(s.exemptReason?' سبب الإعفاء المسجل: '+s.exemptReason+'.':'');
 const team=((doc.p&&doc.p.cat)||'')+' '+((doc.team&&doc.team.name)||'');const due=Number(doc.rest)||0;
 return 'يثبت هذا الوصل أن '+school+' استلمت من وليّ أمر اللاعب/اللاعبة '+guardian+' مبلغاً قدره '+receiptMoney(receiptPrimaryAmount(doc),doc)+'، وذلك مقابل '+fee+' للاعب/اللاعبة '+player+(team.trim()?' ضمن فئة / فريق '+team.trim():'')+'. '+(due>0?(receiptIsInstallment(doc)?'متبقي هذه الدفعة: ':'المتبقي عن هذا السجل: ')+receiptMoney(due,doc)+'.':(receiptIsInstallment(doc)?'وقد سُدّدت هذه الدفعة كاملة؛ ولا يعني ذلك تسديد كامل خطة التسجيل.':'وقد سُدّد المستحق عن هذا السجل كاملاً.'));
}
function receiptPrimaryAmount(doc){const s=doc.s||{};return doc.type==='exemption'?(Number(s.exemptionAmount)||Math.max(0,(Number(doc.base)||0)-(Number(doc.discount)||0))):(doc.payment?Number(doc.payment.amount)||0:Number(doc.paid)||0);}
function receiptAmountWords(doc){return MalaabnaReceipts.amountInWords(receiptPrimaryAmount(doc),doc.currency||'درهم');}
function receiptIsInstallment(doc){return !!(doc&&doc.s&&doc.s.kind==='رسوم التسجيل'&&Number(doc.s.registrationInstallmentCount)>1);}
function receiptAmountLabels(doc){return receiptIsInstallment(doc)?['قيمة هذه الدفعة',doc.payment?'المؤدى المتراكم من هذه الدفعة':'المؤدى من هذه الدفعة','متبقي هذه الدفعة']:['المستحق عن هذا السجل','المبلغ المؤدى بهذا الوصل','المتبقي عن هذا السجل'];}
function receiptTotals(doc){const labels=receiptAmountLabels(doc);return doc.type==='exemption'?[['المبلغ المعفى',receiptPrimaryAmount(doc)],[labels[0],doc.due],[labels[2],doc.rest]]:[[doc.payment?'الأداء الجديد بهذا الوصل':receiptIsInstallment(doc)?'المؤدى من الدفعة':'المبلغ المؤدى',receiptPrimaryAmount(doc)],[receiptIsInstallment(doc)?'قيمة الدفعة':'المستحق',doc.due],[receiptIsInstallment(doc)?'متبقي الدفعة':'المتبقي',doc.rest]];}
function receiptPlanInfo(doc){
 if(!receiptIsInstallment(doc))return null;
 const p=doc.registrationPlan,s=doc.s,count=Number(s.registrationInstallmentCount),number=Number(s.registrationInstallment);
 let valid=!!(p&&p.version===1&&p.complete===true&&p.planId===s.registrationPlanId&&p.capturedAt===doc.issuedAt&&Number(p.count)===count&&Array.isArray(p.installments)&&p.installments.length===count&&['totalDue','totalPaid','totalRest'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&Number.isSafeInteger(Math.round(p[k]*100))));
 if(valid){const indexes=new Set();let due=0,paid=0;for(const row of p.installments){if(!Number.isInteger(row.number)||row.number<1||row.number>count||indexes.has(row.number)||!['due','paid','rest'].every(k=>Number.isFinite(row[k])&&row[k]>=0)||Math.round((row.due-row.paid-row.rest)*100)!==0){valid=false;break;}indexes.add(row.number);due+=Math.round(row.due*100);paid+=Math.round(row.paid*100);}const own=p.installments.find(r=>r.number===number);valid=valid&&due===Math.round(p.totalDue*100)&&paid===Math.round(p.totalPaid*100)&&due-paid===Math.round(p.totalRest*100)&&!!own&&['due','paid','rest'].every(k=>Math.round(own[k]*100)===Math.round(Number(doc[k])*100));}
 return {number:Number.isInteger(number)&&number>=1&&number<=count?number:'غير موثق',count:count,complete:valid,totalDue:valid?p.totalDue:null,totalPaid:valid?p.totalPaid:null,totalRest:valid?p.totalRest:null,note:valid?'إجماليات خطة رسوم التسجيل محفوظة عند إصدار هذا الوصل.':'إجمالي الخطة غير موثق في هذا الوصل؛ لم يُقدّر من البيانات الحالية.'};
}

function receiptPlanRows(doc){const p=receiptPlanInfo(doc);if(!p)return [];const rows=[['رقم الدفعة',p.number+' من '+p.count]];if(p.complete)rows.push(['إجمالي خطة التسجيل عند الإصدار',receiptMoney(p.totalDue,doc)],['المؤدى من كامل الخطة عند الإصدار',receiptMoney(p.totalPaid,doc)],['متبقي كامل الخطة عند الإصدار',receiptMoney(p.totalRest,doc)]);rows.push(['نطاق الخطة',p.note]);return rows;}
function receiptPlanHTML(doc){const p=receiptPlanInfo(doc);if(!p)return '';return '<section class="receipt-plan"><h4>خطة رسوم التسجيل — الدفعة '+esc(p.number)+' من '+esc(p.count)+'</h4>'+(p.complete?'<div class="receipt-plan-totals">'+[['إجمالي الخطة',p.totalDue],['المؤدى من الخطة',p.totalPaid],['متبقي الخطة',p.totalRest]].map(r=>'<div><span>'+esc(r[0])+'</span><b>'+esc(receiptMoney(r[1],doc))+'</b></div>').join('')+'</div>':'')+'<p>'+esc(p.note)+'</p></section>';}
function receiptCopyDetails(doc){return receiptCopyState&&doc&&receiptCopyState.receiptId===doc.id?Object.assign({},receiptCopyState):null;}
function receiptLocalDateTime(at){const d=new Date(at),pad=n=>String(n).padStart(2,'0'),offset=-d.getTimezoneOffset(),sign=offset>=0?'+':'-';return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+' (UTC'+sign+pad(Math.floor(Math.abs(offset)/60))+':'+pad(Math.abs(offset)%60)+')';}
async function prepareReceiptDuplicate(){
 const doc=receiptPayload();if(!doc)return;
 if(!receiptCopyDetails(doc)){const at=new Date().toISOString();receiptCopyState={receiptId:doc.id,preparedAt:at,displayDate:receiptLocalDateTime(at)};auditAdd('إعداد نسخة مكررة للوصل',String(doc.rec||doc.id)+' — تاريخ الإصدار الأصلي: '+String(doc.issuedAt||'')+' — إعداد النسخة: '+at);if(!await save()){receiptCopyState=null;return;}}
 render();
}
function showIssuedReceipt(){receiptCopyState=null;render();}
function receiptOutputName(doc){const copy=receiptCopyDetails(doc);return 'receipt-'+(doc.correction?'corrected-':'')+(copy?'duplicate-':'')+String(doc.rec||doc.id||'document').replace(/[^a-zA-Z0-9_-]/g,'-')+(copy?'-'+copy.preparedAt.replace(/[^0-9TZ]/g,''):'');}
function receiptCopyHTML(doc){
 const copy=receiptCopyDetails(doc);if(!copy)return '';
 const safeNumber=String(doc.rec||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40)||'—',originalDate=String(doc.issuedAt||'').slice(0,10).replace(/[^0-9-]/g,''),copyDate=copy.displayDate.replace(/[^0-9A-Z+(): -]/g,'');
 const printStyle='<style>@page receipt-'+receiptPaperSize()+'{@top-center{content:"نسخة مكررة — '+'\u2066'+safeNumber+'\u2069'+' — الإصدار: '+'\u2066'+originalDate+'\u2069'+'";font:9pt Arial;color:#624d22}@bottom-center{content:"إعداد النسخة: '+'\u2066'+copyDate+'\u2069'+' — صفحة " counter(page) " من " counter(pages);font:9pt Arial;color:#596a75}}</style>';
 return printStyle+'<aside class="receipt-copy"><strong>نسخة مكررة — إعادة طباعة</strong><span>تاريخ إعداد النسخة: <bdi>'+esc(copy.displayDate)+'</bdi></span><small>نفس رقم الوصل وتاريخ إصداره الأصلي؛ لا تمثل أداءً جديداً.</small></aside>';
}

function receiptPDFRows(doc){const rows=receiptRows(doc);const labels=receiptAmountLabels(doc);return rows.filter(r=>!labels.includes(r[0])||(doc.payment&&r[0]===labels[1]));}
function receiptRows(doc){
 const s=doc.s||{},exempt=doc.type==='exemption',rows=[
  ['وليّ أمر اللاعب/اللاعبة',doc.par&&doc.par.name||'—'],
  ['اسم اللاعب/اللاعبة',doc.p&&doc.p.name||'—'],
  ['الفئة / الفريق',(((doc.p&&doc.p.cat)||'')+' '+((doc.team&&doc.team.name)||'')).trim()||'—'],
  [doc.type==='exemption'?'المبلغ المعفى بالحروف':'المبلغ المؤدى بالحروف',receiptAmountWords(doc)||'تعذر تحويل المبلغ؛ راجع القيمة الرقمية'],
  ['المبلغ قبل الخصم',receiptMoney(doc.base,doc)],
  ['قيمة الخصم',receiptMoney(doc.discount,doc)]
 ];
 if(doc.correction)rows.push(['نوع النسخة','نسخة مصححة؛ لا تمثل أداءً جديداً'],['تصحيح للوثيقة',doc.correction.sourceRec],['تاريخ التصحيح',String(doc.correction.preparedAt).replace('T',' ').replace('Z',' UTC')],['ملاحظة التصحيح',doc.correction.reason]);
 if(s.correctionOf)rows.push(['وصل مُصحّح عن',s.correctionOf]);
 if(exempt)rows.push(['المبلغ المعفى',receiptMoney(Number(s.exemptionAmount)||Math.max(0,(Number(doc.base)||0)-(Number(doc.discount)||0)),doc)],['سبب الإعفاء',s.exemptReason||'—']);
 const amountLabels=receiptAmountLabels(doc);rows.push([amountLabels[0],receiptMoney(doc.due,doc)],[amountLabels[1],receiptMoney(doc.paid,doc)],[amountLabels[2],receiptMoney(doc.rest,doc)],[(exempt?'تاريخ الإعفاء':'تاريخ الأداء'),s.date||todayISO()]);
 if(!exempt)rows.push(['طريقة الأداء',s.method||'نقداً']);
 return rows;
}
let receiptVerificationBusy=false;
const receiptVerificationDigests=new Map();
function receiptPaperSize(){try{return sessionStorage.getItem('malaabna-receipt-paper')==='a5'?'a5':'a4';}catch(_){return 'a4';}}
function setReceiptPaperSize(value){try{sessionStorage.setItem('malaabna-receipt-paper',value==='a5'?'a5':'a4');}catch(_){}render();}
async function receiptFingerprint(doc){const bytes=new TextEncoder().encode(stableStr(JSON.parse(JSON.stringify(doc)))),hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}
function receiptVerificationFor(doc){
 const entry=db.settings._receiptVerifications&&db.settings._receiptVerifications[doc.id];
 if(!entry||entry.revoked||entry.connection!==syncConnectionKey())return null;
 let url;try{url=new URL(entry.url);if(!/^https?:$/.test(url.protocol)||url.origin!==new URL(syncApiUrl('/')).origin||!/^\/verify\/r\/[A-Za-z0-9_-]{43}$/.test(url.pathname)||url.search||url.hash||url.username||url.password)return null;}catch(_){return null;}
 const text=stableStr(doc),cached=receiptVerificationDigests.get(doc.id);
 if(cached&&cached.text===text)return cached.fingerprint===entry.fingerprint?entry:null;
 const pending={text,fingerprint:null};receiptVerificationDigests.set(doc.id,pending);
 receiptFingerprint(doc).then(fingerprint=>{if(receiptVerificationDigests.get(doc.id)!==pending)return;pending.fingerprint=fingerprint;if(page==='receipts'&&receiptId===doc.id)render();}).catch(()=>{});
 return null;
}
function receiptVerificationNote(entry){return entry?'امسح QR لفتح سجل التحقق على خادم المدرسة. قارن رقم الوصل والمبلغ والتاريخ؛ حالة الاعتماد قد تتغير لاحقاً.':'هذا الوصل غير مرفق برابط تحقق معتمد. زامن الوصل ثم فعّل التحقق من أدوات الوصولات؛ لا يُعد هذا المستند متحققاً إلكترونياً.';}
function receiptVerificationHTML(doc){
 const entry=receiptVerificationFor(doc);
 return entry?'<div class="receipt-qr">'+qrBox(entry.url,116,'تحقق من الوصل إلكترونياً')+'<span class="receipt-verify-hint">على خادم المدرسة</span></div>':'<div class="receipt-qr receipt-qr-pending"><b>التحقق غير مفعّل</b><span>لا يوجد رمز تحقق معتمد لهذه النسخة</span></div>';
}
function receiptToolsHTML(doc){
 const entry=receiptVerificationFor(doc),hasLocal=!!(db.settings._receiptVerifications&&db.settings._receiptVerifications[doc.id]);
 return '<div class="receipt-options no-print"><label for="receiptPaper">حجم الطباعة وPDF <select id="receiptPaper" '+actionAttr('change',(event,el)=>setReceiptPaperSize(el.value))+'><option value="a4" '+(receiptPaperSize()==='a4'?'selected':'')+'>A4 — ورقة كاملة</option><option value="a5" '+(receiptPaperSize()==='a5'?'selected':'')+'>A5 — نصف ورقة</option></select></label><div class="receipt-verification-actions">'+(isAdmin()?'<button class="btn" '+(receiptVerificationBusy?'disabled ':'')+actionAttr('click',()=>publishReceiptVerification())+'>🔗 تفعيل / تحديث التحقق</button>':'')+(entry?'<a class="btn" href="'+esc(entry.url)+'" target="_blank" rel="noopener noreferrer">فتح صفحة التحقق</a>':'')+(isAdmin()&&hasLocal?'<button class="btn danger" '+(receiptVerificationBusy?'disabled ':'')+actionAttr('click',()=>revokeReceiptVerification())+'>إلغاء رابط التحقق</button>':'')+'</div><p>التحقق يتطلب مزامنة الوصل وخادماً عاماً مضبوطاً بعنوان HTTPS. إلغاء الرابط لا يحذف الأداء أو يعيد المبلغ.</p></div>';
}
async function publishReceiptVerification(){
 if(!isAdmin()||!canPage('receipts')){denied();return;}if(receiptVerificationBusy)return;
 const current=receiptPayload();if(!current||!syncReady()){alert('اختر وصلاً وأكمل إعداد المزامنة أولاً.');return;}
 if(!confirm('سيُنشر ملخص الوصل: المدرسة والرقم والتاريخ والمبلغ، دون اسم اللاعب أو ولي الأمر أو الهاتف. يمكن لمن يملك الرابط الاطلاع عليه. هل تريد المتابعة؟'))return;
 const doc=JSON.parse(JSON.stringify(current)),connection=syncConnectionKey();receiptVerificationBusy=true;render();
 try{
  await waitForLocalPersistence();const fingerprint=await receiptFingerprint(doc);
  const r=await fetch(syncApiUrl('/api/receipts/verification'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody({action:'publish',receiptId:doc.id,fingerprint}))});
  const result=await r.json().catch(()=>null);if(!r.ok||!result||!result.ok)throw new Error(result&&result.message||'تعذر نشر التحقق. حدّث الخادم وزامن الوصل أولاً.');
  if(connection!==syncConnectionKey())throw new Error('تغيرت وجهة المزامنة. أعد المحاولة للوجهة الحالية.');
  const url=new URL(result.url);if(url.origin!==new URL(syncApiUrl('/')).origin||!/^https?:$/.test(url.protocol)||!/^\/verify\/r\/[A-Za-z0-9_-]{43}$/.test(url.pathname)||url.username||url.password||url.search||url.hash||result.fingerprint!==fingerprint||result.url.length>180)throw new Error('رابط التحقق لا يطابق الخادم أو النسخة الحالية. راجع PUBLIC_URL.');
  db.settings._receiptVerifications={...(db.settings._receiptVerifications||{}),[doc.id]:{url:url.href,fingerprint,connection,publishedAt:result.publishedAt}};
  receiptVerificationDigests.set(doc.id,{text:stableStr(doc),fingerprint});await persistDbSnapshot();
  alert('حُفظ رابط التحقق. أعد تنزيل PDF أو طباعة الوصل لتضمين رمز QR الجديد. لا تتغير الملفات القديمة تلقائياً.');
 }catch(error){alert('لم يكتمل تجهيز التحقق على هذا الجهاز: '+error.message);}
 finally{receiptVerificationBusy=false;render();}
}
async function revokeReceiptVerification(){
 if(!isAdmin()||!canPage('receipts')){denied();return;}if(receiptVerificationBusy)return;
 const doc=receiptPayload();if(!doc||!syncReady())return;
 if(!confirm('إلغاء رابط التحقق نهائياً لهذا الوصل؟ لن يُحذف الأداء ولن يُسترجع المبلغ. ستعرض الروابط المطبوعة أن الاعتماد ملغى.'))return;
 const connection=syncConnectionKey();receiptVerificationBusy=true;render();
 try{
  const r=await fetch(syncApiUrl('/api/receipts/verification'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody({action:'revoke',receiptId:doc.id}))});
  const result=await r.json().catch(()=>null);if(!r.ok||!result||!result.ok)throw new Error(result&&result.message||'تعذر إلغاء التحقق.');
  if(connection===syncConnectionKey()){
   const entry=db.settings._receiptVerifications&&db.settings._receiptVerifications[doc.id];if(entry){entry.revoked=true;await persistDbSnapshot();}
  }
  alert('أُلغي التحقق على الخادم. لا يعني ذلك إلغاء العملية المالية.');
 }catch(error){alert('تعذر إكمال إلغاء التحقق: '+error.message+' افتح رابط التحقق للتأكد من حالته على الخادم.');}
 finally{receiptVerificationBusy=false;render();}
}

function receiptDocumentHTML(doc){
 const s=doc.s||{},p=doc.p||{},issueDate=String(doc.issuedAt||todayISO()).slice(0,10),logo=safeImg(doc.logo||''),verification=receiptVerificationFor(doc);
 const rows=receiptRows(doc).filter(r=>!['وليّ أمر اللاعب/اللاعبة','اسم اللاعب/اللاعبة','الفئة / الفريق'].includes(r[0])).filter(r=>!receiptAmountLabels(doc).includes(r[0])||(doc.payment&&r[0]===receiptAmountLabels(doc)[1])).map(function(r){return '<tr'+(receiptIsInstallment(doc)&&receiptAmountLabels(doc).includes(r[0])&&!(doc.payment&&r[0]===receiptAmountLabels(doc)[1])?' class="receipt-money-detail"':'')+'><th scope="row">'+esc(r[0])+'</th><td>'+esc(r[1])+'</td></tr>';}).join('');
 const totals=receiptTotals(doc);
 const printNumber=String(doc.rec||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);
 const printMeta='<style>@page receipt-'+receiptPaperSize()+'{margin-bottom:12mm;@bottom-center{content:"'+printNumber+' — صفحة " counter(page) " من " counter(pages);font:9pt Arial;color:#596a75}}</style>';
 return printMeta+'<article class="receipt receipt-branded receipt-paper-'+receiptPaperSize()+'" aria-label="'+esc(receiptLabel(s))+'">'+
  '<header class="receipt-brand"><div class="receipt-logo">'+(logo?'<img src="'+logo+'" alt="شعار '+esc(doc.school||'المدرسة')+'">':'<span class="receipt-logo-empty" aria-label="شعار غير مضاف">⚽</span>')+'</div><div class="receipt-school"><div class="receipt-eyebrow">إدارة المدرسة الرياضية</div><h2>'+esc(doc.school||'مدرسة كرة القدم')+'</h2>'+(doc.address?'<p>'+esc(doc.address)+'</p>':'')+(doc.schoolPhone?'<p>هاتف المدرسة: <bdi>'+esc(doc.schoolPhone)+'</bdi></p>':'')+'</div></header>'+
  '<div class="receipt-content"><div class="receipt-title"><h3>'+esc(receiptLabel(s))+'</h3><span class="receipt-issued">'+(receiptCopyDetails(doc)?'نسخة مكررة':doc.correction?'نسخة مصححة':'نسخة صادرة')+'</span></div>'+
  '<div class="receipt-meta"><div><span>'+receiptNumberLabel(doc)+'</span><b dir="auto">'+esc(doc.rec||'—')+'</b></div><div><span>تاريخ الإصدار</span><b dir="auto">'+esc(issueDate)+'</b></div></div>'+
  receiptCopyHTML(doc)+'<section class="receipt-person"><span>وصل خاص باللاعب / اللاعبة</span><strong>'+esc(p.name||'—')+'</strong><div><span>ولي الأمر: '+esc(doc.par&&doc.par.name||'—')+'</span><span>'+esc([p.cat,doc.team&&doc.team.name].filter(Boolean).join(' · '))+'</span></div></section><div class="receipt-totals">'+totals.map(function(r,i){return '<div'+(i===0?' class="receipt-total-primary"':'')+'><span>'+esc(r[0])+'</span><strong>'+esc(receiptMoney(r[1],doc))+'</strong></div>';}).join('')+'</div>'+
  receiptPlanHTML(doc)+'<section class="receipt-statement"><h4>'+ (doc.type==='exemption'?'بيان الإعفاء':'إقرار الاستلام')+'</h4><p>'+esc(receiptStatement(doc))+'</p></section>'+
  '<h4 class="receipt-section-title">تفاصيل الوصل</h4><table class="receipt-details"><tbody>'+rows+'</tbody></table>'+
  '<footer class="receipt-footer">'+receiptVerificationHTML(doc)+'<div class="receipt-sign"><b>توقيع المسؤول والختم</b>'+(safeImg(doc.stamp||'')?'<img src="'+safeImg(doc.stamp)+'" alt="ختم المدرسة">':'<div class="receipt-sign-line"></div>')+'<span>'+esc(doc.directorName||'……………………')+'</span><small>'+esc(doc.directorRole||'مدير المدرسة')+'</small></div></footer>'+
  '<p class="receipt-note">'+esc(receiptVerificationNote(verification))+'</p><div class="receipt-thanks">شكراً لثقتكم وتعاونكم مع '+esc(doc.school||'مدرسة كرة القدم')+'</div></div></article>';
}
function receiptCorrectionFields(doc){
 return [['playerName','اسم اللاعب/اللاعبة',doc.p&&doc.p.name||'',true],['guardianName','وليّ أمر اللاعب/اللاعبة',doc.par&&doc.par.name||'',true],['category','الفئة',doc.p&&doc.p.cat||''],['teamName','الفريق',doc.team&&doc.team.name||''],['phone','هاتف ولي الأمر',doc.phone||''],['school','اسم المدرسة',doc.school||'',true],['address','عنوان المدرسة',doc.address||''],['schoolPhone','هاتف المدرسة',doc.schoolPhone||''],['directorName','اسم المسؤول',doc.directorName||''],['directorRole','صفة المسؤول',doc.directorRole||'']];
}
function openReceiptCorrection(){
 if(!isAdmin()||!canPage('receipts')){denied();return;}if(installmentPaymentBusy)return;
 const doc=receiptPayload();if(!doc||!canPlayerAccount(doc.s&&doc.s.player)){denied();return;}
 const newer=db.receipts.find(d=>d.correction&&d.correction.sourceId===doc.id);
 if(newer){alert('توجد نسخة مصححة لهذا الوصل. افتح النسخة المصححة من الأرشيف قبل إجراء تصحيح آخر.');receiptId=newer.id;receiptCopyState=null;render();return;}
 mFormDirty=false;clearModalError();mColl=null;mId=null;
 document.getElementById('mTitle').textContent='تصحيح بيانات الوصل';
 document.getElementById('mBody').innerHTML='<div class="mf full notice">تصحيح البيانات التعريفية فقط. تُحفظ النسخة الأصلية ويصدر رقم وثيقة جديد مرتبط بها، دون تسجيل أداء جديد أو تغيير المبالغ أو التاريخ أو طريقة الأداء أو بيانات اللاعب الأصلية.</div>'+receiptCorrectionFields(doc).map(f=>'<div class="mf"><label for="rc_'+f[0]+'">'+f[1]+'</label><input id="rc_'+f[0]+'" maxlength="200" value="'+esc(f[2])+'" '+(f[3]?'required':'')+'></div>').join('')+'<div class="mf full"><label for="rc_reason">ملاحظة التصحيح (مطلوبة)</label><textarea id="rc_reason" maxlength="500" required></textarea></div>';
 const expected=JSON.stringify(doc);setModalSaveAction(()=>saveReceiptCorrection(doc.id,expected),'حفظ النسخة المصححة');
 const ov=document.getElementById('ov');window._modalOpener=document.activeElement;ov.classList.add('on');ov.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('rc_playerName')?.focus(),0);
}
async function saveReceiptCorrection(id,expected){
 if(installmentPaymentBusy)return;
 if(!isAdmin()||!canPage('receipts')){denied();return;}
 const original=db,doc=db.receipts.find(d=>d.id===id);
 if(!doc||!canPlayerAccount(doc.s&&doc.s.player)){denied();return;}
 if(JSON.stringify(doc)!==expected||db.receipts.some(d=>d.correction&&d.correction.sourceId===id)){showModalError('تغير الوصل أو صدرت له نسخة مصححة. أغلق النموذج وافتح أحدث نسخة.');return;}
 const values={};let changed=false;
 for(const f of receiptCorrectionFields(doc)){
  const value=String((document.getElementById('rc_'+f[0])||{}).value||'').trim();
  if((f[3]&&!value)||value.length>200){showModalError('راجع حقل '+f[1]+' (الحد الأقصى 200 حرف).');return;}
  values[f[0]]=value;if(value!==String(f[2]))changed=true;
 }
 const reason=String((document.getElementById('rc_reason')||{}).value||'').trim();
 if(!reason||reason.length>500){showModalError('اكتب ملاحظة التصحيح بحد أقصى 500 حرف.');return;}
 if(!changed){showModalError('لم تتغير بيانات الوصل. عدّل الحقل المطلوب أولاً.');return;}
 installmentPaymentBusy=true;const button=document.querySelector('#ov .mfoot .btn.primary');if(button){button.disabled=true;button.textContent='جارٍ حفظ التصحيح…';}
 let corrected;
 try{
  db=MalaabnaFinance.snapshotDocument(original);corrected=MalaabnaFinance.snapshotDocument(doc);corrected.id=uid();corrected.rec=nextReceiptNumber();corrected.s.rec=corrected.rec;
  corrected.p={...corrected.p,name:values.playerName,cat:values.category};corrected.par={...corrected.par,name:values.guardianName};corrected.team={...corrected.team,name:values.teamName};
  for(const key of ['phone','school','address','schoolPhone','directorName','directorRole'])corrected[key]=values[key];
  corrected.correction={sourceId:doc.id,sourceRec:doc.rec,rootId:doc.correction&&doc.correction.rootId||doc.id,preparedAt:new Date().toISOString(),reason:reason};
  db.receipts.push(corrected);auditAdd('تصحيح بيانات الوصل',doc.rec+' ← '+corrected.rec+' — '+reason);
  db.settings.changed=new Date().toISOString();await persistDbSnapshot();
 }catch(e){db=original;showModalError('لم يُحفظ التصحيح. '+(e&&e.message||'أعد المحاولة.'));return;}
 finally{installmentPaymentBusy=false;if(button){button.disabled=false;button.textContent='حفظ النسخة المصححة';}}
 if(typeof syncSchedule==='function')syncSchedule();closeModal(true);receiptId=corrected.id;receiptCopyState=null;page='receipts';render();
}
function receiptsPage(){
 const eligible=receiptEntries();let doc=receiptId?eligible.find(x=>x.id===receiptId):null;if(!doc)doc=eligible[0];
 if(!doc)return head('🧾 الوصولات','أرشيف الوثائق المالية الصادرة')+'<div class="card"><div class="empty">لا توجد وثائق صادرة بعد. أصدر وصلًا من صفحة الاشتراكات والرسوم.</div></div>';
 receiptId=doc.id;const s=doc.s,p=doc.p,exempt=doc.type==='exemption',issueDate=String(doc.issuedAt||todayISO()).slice(0,10);
 return head('🧾 '+receiptLabel(s),'وصل محفوظ كما صدر؛ التعديلات المالية اللاحقة لا تغيّر نسخته المؤرشفة.',
  (isAdmin()?'<button class="btn" '+actionAttr('click',()=>openReceiptCorrection())+'>✏️ تصحيح الوصل</button> ':'')+'<select '+actionAttr('change',(event,el)=>{receiptId=el.value;receiptCopyState=null;render()})+'>'+eligible.map(function(x){const xs=x.s||{};return '<option value="'+esc(x.id)+'" '+(x.id===doc.id?'selected':'')+'>'+esc((x.p&&x.p.name)||'—')+' — '+esc(xs.kind==='رسوم التسجيل'?feeLabel(xs):(xs.month||'')+' '+(xs.year||''))+' — '+esc(x.rec||'بدون رقم')+(x.correction?' — نسخة مصححة':'')+'</option>';}).join('')+'</select> <button class="btn" '+actionAttr('click',()=>downloadCurrentReceiptPDF())+'>⬇️ PDF</button> <button class="btn" '+actionAttr('click',()=>exportReceiptExcel())+'>📊 Excel</button> <button class="btn" '+actionAttr('click',()=>shareReceipt())+'>📤 مشاركة</button> '+(!exempt?'<button class="btn primary" '+actionAttr('click',()=>sendReceiptWhatsApp())+'>💬 إرسال PDF عبر واتساب</button>':'')+'<button class="btn" '+actionAttr('click',()=>prepareReceiptDuplicate())+'>📑 إعداد نسخة مكررة</button> '+(receiptCopyDetails(doc)?'<button class="btn" '+actionAttr('click',()=>showIssuedReceipt())+'>عرض النسخة الصادرة</button> ':'')+'<button class="btn" '+actionAttr('click',()=>window.print())+'>🖨️ طباعة</button>').replace('class="top-actions"','class="top-actions receipt-actions"')+
  receiptToolsHTML(doc)+receiptDocumentHTML(doc);
}
function receiptPayload(){return receiptEntries().find(x=>x.id===receiptId)||null;}
function receiptShareText(){
 const x=receiptPayload();if(!x)return '';const s=x.s||{},issueDate=String(x.issuedAt||todayISO()).slice(0,10);
 const lines=['السلام عليكم،',receiptLabel(s),x.school||'مدرسة كرة القدم',receiptNumberLabel(x)+': '+(x.rec||'—'),'تاريخ الإصدار: '+issueDate,'',receiptStatement(x),''];
 const copy=receiptCopyDetails(x);if(copy)lines.splice(1,0,'نسخة مكررة — إعادة طباعة','تاريخ إعداد النسخة: '+copy.displayDate,'نفس رقم الوصل وتاريخ إصداره الأصلي؛ لا تمثل أداءً جديداً.');
 receiptRows(x).concat(receiptPlanRows(x)).forEach(function(row){lines.push(row[0]+': '+row[1]);});
 const verification=receiptVerificationFor(x);if(verification)lines.push('التحقق من الوصل: '+verification.url);
 lines.push('شكراً لثقتكم وتعاونكم مع '+(x.school||'مدرسة كرة القدم')+' ⚽');
 return lines.join('\n');
}
async function createReceiptCanvas(){
 const x=receiptPayload();if(!x)return null;const copy=receiptCopyDetails(x);
 if(document.fonts&&document.fonts.ready)await document.fonts.ready;
 const c=document.createElement('canvas');c.width=1240;c.height=1754;
 const g=c.getContext('2d');if(!g)return null;
 const navy='#173e51',gold='#c6a252',ink='#203542',muted='#596a75',line='#dce3e6',pale='#f4f7f8';
 const text=function(value,xp,yp,size,color,bold,maxWidth){g.direction=/[\u0600-\u06ff]/.test(String(value))?'rtl':'ltr';g.textAlign='right';g.fillStyle=color||ink;g.font=(bold?'700 ':'400 ')+size+'px Arial, sans-serif';g.fillText(String(value==null||value===''?'—':value),xp,yp,maxWidth||1050);};
 const wrap=function(value,width,size,bold){g.font=(bold?'700 ':'400 ')+size+'px Arial, sans-serif';const out=[];let row='';for(const word of String(value||'—').split(/\s+/)){const next=row?row+' '+word:word;if(row&&g.measureText(next).width>width){out.push(row);row=word;}else row=next;}out.push(row);return out;};
 const loadImg=function(src){return new Promise(function(resolve){if(!src){resolve(null);return;}const im=new Image();im.onload=function(){resolve(im);};im.onerror=function(){resolve(null);};im.src=src;});};
 const drawFit=function(im,xp,yp,mw,mh){if(!im)return;const scale=Math.min(mw/im.width,mh/im.height);const w=im.width*scale,h=im.height*scale;g.drawImage(im,xp+(mw-w)/2,yp+(mh-h)/2,w,h);};
 const s=x.s||{},issued=String(x.issuedAt||todayISO()).slice(0,10);
 const schoolLines=wrap(x.school||'مدرسة كرة القدم',820,44,true);
 const headerH=260+Math.max(0,schoolLines.length-1)*54;
 const statementLines=wrap(receiptStatement(x),1010,23,false),statementH=70+statementLines.length*33;
 const canvasRows=receiptRows(x).concat(receiptPlanRows(x));if(copy)canvasRows.unshift(['نوع النسخة','نسخة مكررة — إعادة طباعة'],['تاريخ إعداد النسخة',copy.displayDate]);
 const rows=canvasRows.map(function(r){return {label:wrap(r[0],370,23,false),value:wrap(r[1],620,24,true)};});
 const rowHeight=function(r){return Math.max(48,Math.max(r.label.length,r.value.length)*32+20);};
 const tableStart=headerH+350+statementH;
 const footY=tableStart+rows.reduce(function(sum,r){return sum+rowHeight(r);},0)+42;
 c.height=Math.max(1754,footY+300);
 g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
 g.fillStyle=navy;g.fillRect(0,0,c.width,headerH);g.fillStyle=gold;g.fillRect(0,headerH-6,c.width,6);
 g.fillStyle='#fff';g.fillRect(80,45,190,170);
 const logo=await loadImg(safeImg(x.logo||''));if(logo)drawFit(logo,95,60,160,140);else text('⚽',220,155,70,navy,true,130);
 text(copy?'نسخة مكررة — إعادة طباعة':'إدارة المدرسة الرياضية',1150,60,23,'#e8d6ac',false,820);
 schoolLines.forEach(function(v,i){text(v,1150,122+i*54,44,'#fff',true,820);});
 const contactY=156+(schoolLines.length-1)*54;
 if(x.address)text(x.address,1150,contactY,23,'#eef3f5',false,820);
 if(x.schoolPhone)text('هاتف المدرسة: '+'\u2066'+x.schoolPhone+'\u2069',1150,contactY+38,23,'#eef3f5',false,820);
 const top=headerH;
 text(receiptLabel(s),1150,top+65,38,navy,true,1080);
 text(receiptNumberLabel(x)+': '+'\u2066'+(x.rec||'—')+'\u2069',1150,top+114,24,ink,true,650);
 text('تاريخ الإصدار: '+'\u2066'+issued+'\u2069',530,top+114,23,muted,false,460);
 const totals=receiptTotals(x);
 totals.forEach(function(r,i){const left=814-i*372;g.fillStyle=i===0?navy:pale;g.fillRect(left,top+145,356,95);text(r[0],left+332,top+178,23,i===0?'#eef3f5':muted,false,310);text(receiptMoney(r[1],x),left+332,top+218,31,i===0?'#fff':ink,true,310);});
 const statementTop=top+264;g.fillStyle=pale;g.fillRect(70,statementTop,1100,statementH);g.fillStyle=gold;g.fillRect(1164,statementTop,6,statementH);
 text(x.type==='exemption'?'بيان الإعفاء':'إقرار الاستلام',1138,statementTop+34,24,navy,true,1020);
 statementLines.forEach(function(v,i){text(v,1138,statementTop+70+i*33,23,ink,false,1010);});
 text('تفاصيل الوصل',1150,tableStart-24,27,navy,true,1080);
 let y=tableStart;
 rows.forEach(function(r,i){const h=rowHeight(r);g.fillStyle=i%2===0?pale:'#fff';g.fillRect(70,y,1100,h);g.strokeStyle=line;g.lineWidth=1;g.beginPath();g.moveTo(70,y+h);g.lineTo(1170,y+h);g.stroke();r.label.forEach(function(v,j){text(v,1140,y+32+j*32,23,muted,false,370);});r.value.forEach(function(v,j){text(v,730,y+32+j*32,24,ink,true,620);});y+=h;});
 g.strokeStyle=line;g.beginPath();g.moveTo(70,footY-18);g.lineTo(1170,footY-18);g.stroke();
 const qrText=receiptLabel(s)+' '+(x.rec||'')+' | '+((x.p&&x.p.name)||'')+' | '+receiptFeeDescription(s)+' | '+receiptMoney(receiptPrimaryAmount(x),x)+' | '+(s.date||todayISO());
 try{const qr=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(QRGEN.svg(qrText,180)));drawFit(qr,85,footY,160,160);text('ملخص بيانات الوصل',275,footY+190,22,muted,false,300);}catch(e){}
 text('توقيع المسؤول والختم',1140,footY+30,24,navy,true,650);
 const stamp=await loadImg(safeImg(x.stamp||''));if(stamp)drawFit(stamp,900,footY+40,200,85);
 text(x.directorName||'……………………',1140,footY+155,25,ink,true,650);
 text(x.directorRole||'مدير المدرسة',1140,footY+190,23,muted,false,650);
 text('رمز QR لملخص البيانات؛ ليس تحققاً إلكترونياً.',1150,c.height-62,22,muted,false,1080);
 g.fillStyle=navy;g.fillRect(0,c.height-40,c.width,40);
 text('شكراً لثقتكم وتعاونكم مع '+(x.school||'مدرسة كرة القدم'),1150,c.height-12,22,'#fff',false,1080);
 return c;
}
async function receiptCanvasBlob(){
 const c=await createReceiptCanvas();if(!c)return null;
 return new Promise(function(resolve){c.toBlob(resolve,'image/png');});
}
async function receiptPDFBlob(documentSnapshot){
 const x=documentSnapshot||receiptPayload();if(!x)return null;
 if(typeof MalaabnaReceipts==='undefined')throw new Error('ملف أدوات الوصولات غير محمّل. حدّث ملفات التطبيق.');
 const s=x.s||{},fingerprint=await receiptFingerprint(x);receiptVerificationDigests.set(x.id,{text:stableStr(x),fingerprint});const verification=receiptVerificationFor(x);
 return MalaabnaReceipts.createPDF({document:x,paper:receiptPaperSize(),verificationURL:verification&&verification.url,title:receiptLabel(s),numberLabel:receiptNumberLabel(x),statement:receiptStatement(x),rows:receiptPDFRows(x),totals:receiptTotals(x),plan:receiptPlanInfo(x),copy:receiptCopyDetails(x),primaryAmount:receiptPrimaryAmount(x),qrSVG:verification?QRGEN.svg(verification.url,240):''});
}
async function shareReceipt(){
 const x=receiptPayload(),text=receiptShareText();if(!x||!text)return;
 try{const blob=await receiptPDFBlob(x),file=new File([blob],receiptOutputName(x)+'.pdf',{type:'application/pdf'});
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:receiptLabel(x.s),text,files:[file]});return;}
  downloadReceiptPdf(blob,receiptOutputName(x)+'.pdf');if(navigator.clipboard)try{await navigator.clipboard.writeText(text);}catch(_){}
  alert('تم تنزيل PDF للمشاركة. أرفقه يدوياً في التطبيق الذي تختاره.');
 }catch(error){if(error&&error.name==='AbortError')return;alert('تعذرت مشاركة PDF: '+error.message);}
}
function downloadReceiptPdf(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},60000);}
async function downloadCurrentReceiptPDF(){
 const x=receiptPayload();if(!x)return;
 const name=receiptOutputName(x);try{const blob=await receiptPDFBlob(x);if(!blob)throw new Error('لا يوجد وصل محدد.');downloadReceiptPdf(blob,name+'.pdf');}
 catch(e){alert('تعذر إنشاء PDF: '+(e&&e.message||'خطأ غير معروف'));}
}
function sendReceiptWhatsApp(){const x=receiptPayload();if(!x)return;if(x.type==='exemption'){alert('يمكن طباعة أو مشاركة سند الإعفاء من هذه الصفحة.');return;}const n=waPhone(x.phone||'');if(!n){alert('لا يوجد رقم هاتف محفوظ لولي الأمر عند إصدار الوصل.');return;}
 const text=receiptShareText()+'\n\nشكراً لتعاونكم مع '+(x.school||'مدرسة كرة القدم')+' ⚽';
 const filename=receiptOutputName(x)+'.pdf';
 (async function(){try{
  const pdf=await receiptPDFBlob(x);if(!pdf)throw new Error('تعذر إنشاء ملف PDF.');
  const file=new File([pdf],filename,{type:'application/pdf'});
  if(navigator.share&&navigator.canShare){try{if(navigator.canShare({files:[file]})){await navigator.share({title:receiptLabel(x.s),text:text,files:[file]});return;}}catch(shareError){if(shareError&&shareError.name==='AbortError')return;}}
  downloadReceiptPdf(pdf,filename);
  const url='https://wa.me/'+n+'?text='+encodeURIComponent(text),opened=window.open(url,'_blank');
  if(!opened)alert('تم تنزيل ملف الوصل PDF. افتح واتساب للمستلم وأرفق الملف الذي تم تنزيله قبل الإرسال.');
  else alert('تم فتح محادثة واتساب وتنزيل الوصل PDF. أرفق ملف '+filename+' في المحادثة ثم اضغط إرسال.');
 }catch(e){alert('تعذر تجهيز الوصل PDF: '+(e&&e.message||'خطأ غير معروف'));}})();
}
function exportReceiptExcel(){
 const x=receiptPayload();if(!x)return;const copy=receiptCopyDetails(x),rows=[['المدرسة',x.school],['نوع الوثيقة',receiptLabel(x.s)],['رقم الوثيقة',x.rec||''],['تاريخ الإصدار الأصلي',String(x.issuedAt||'').slice(0,10)]];
 if(copy)rows.push(['نوع النسخة','نسخة مكررة — إعادة طباعة'],['تاريخ إعداد النسخة',copy.displayDate]);
 rows.push.apply(rows,receiptRows(x).concat(receiptPlanRows(x)));exportExcel(receiptOutputName(x),[{title:receiptLabel(x.s)+' — '+(x.rec||''),headers:['البيان','القيمة'],rows:rows}]);
}

/* الإعلانات */
function announcementsPage(){
 const today=todayISO();const list=(db.announcements||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const active=list.filter(a=>(a.status||'منشور')!=='مسودة'&&(!a.until||a.until>=today));
 return head('📢 الإعلانات',active.length+' إعلان نشط','<button class="btn primary" '+actionAttr('click',()=>openForm('announcements'))+'>＋ إعلان جديد</button>')+
  (list.length?'<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">'+list.map(function(a){const expired=a.until&&a.until<today;const cls=a.priority==='عاجل'?'t-r':a.priority==='مهم'?'t-o':'t-b';return '<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><h3 style="margin:0">'+esc(a.title||'إعلان')+'</h3><span class="tag '+cls+'">'+esc(a.priority||'عادي')+'</span></div><div class="sub" style="margin:7px 0">'+esc(a.date||'')+(a.until?' → '+esc(a.until):'')+' • '+esc(a.audience||'الجميع')+(a.cat?' • '+esc(a.cat):'')+'</div><div style="white-space:pre-wrap">'+esc(a.body||'')+'</div><div style="display:flex;gap:8px;margin-top:12px"><span class="tag '+(expired?'t-r':a.status==='مسودة'?'t-o':'t-g')+'">'+(expired?'منتهي':esc(a.status||'منشور'))+'</span>'+(isAdmin()?'<button class="btn sm" '+actionAttr('click',()=>openForm('announcements',a.id))+'>✏️ تعديل</button><button class="btn sm danger" '+actionAttr('click',()=>del('announcements',a.id))+'>🗑️</button>':'')+'</div></div>';}).join('')+'</div>':'<div class="card"><div class="empty">لا توجد إعلانات بعد.</div></div>');
}

/* التقييم */
function evalsPage(){
 const keys=[['speed','السرعة'],['drib','المراوغة'],['pass','التمرير'],['shoot','التسديد'],['ctrl','التحكم'],['fit','اللياقة'],['disc','الانضباط'],['tw','اللعب الجماعي']];
 const avg=e=>{const v=keys.map(k=>Number(e[k[0]])||0);return Math.round(v.reduce((a,b)=>a+b,0)/8*10)/10;};
 const cards=db.evals.map(e=>'<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>'+esc(refName('players',e.player))+'</b><span class="tag '+(avg(e)>=7?'t-g':avg(e)>=5?'t-o':'t-r')+'">'+avg(e)+'/10</span></div>'+
  '<div class="bars">'+keys.map(k=>{const v=Number(e[k[0]])||0;return '<div class="bar"><span>'+k[1]+'</span><span class="track"><span class="fill" style="width:'+(v*10)+'%"></span></span><span>'+v+'</span></div>';}).join('')+'</div>'+
  '<div class="sub" style="margin-top:12px">'+esc(e.date||'')+' • '+esc(refName('coaches',e.coach))+'</div>'+
  '<div class="no-print" style="margin-top:12px"><button class="btn sm" '+actionAttr('click',()=>openForm('evals',e.id))+'>تعديل</button> <button class="btn sm danger" '+actionAttr('click',()=>del('evals',e.id))+'>حذف</button></div></div>').join('');
 return head('⭐ التقييم الرياضي',db.evals.length+' بطاقة تقييم','<button class="btn primary" '+actionAttr('click',()=>openForm('evals'))+'>＋ تقييم جديد</button>')+
  (db.evals.length?'<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr))">'+cards+'</div>':'<div class="card"><div class="empty">لا توجد تقييمات بعد.</div></div>');
}

/* تذكير واتساب */
let waMonth=MONTHS[new Date().getMonth()],waYear=new Date().getFullYear(),waOnly='late';
function waPhone(raw){
 let n=String(raw||'').replace(/[^0-9+]/g,'');
 if(!n)return '';
 if(n[0]==='+')n=n.slice(1);
 const cc=String(db.settings.cc||'212').replace(/[^0-9]/g,'');
 if(n[0]==='0')n=cc+n.slice(1);
 else if(!n.startsWith(cc)&&n.length<=10)n=cc+n;
 return n;
}
function tplFill(t,map){Object.keys(map).forEach(k=>{t=String(t).split(k).join(map[k]);});return t;}
function parentRecord(p){const x=p||{};return db.parents.find(y=>y.id===x.parent)||{};}
function parentName(p){const par=parentRecord(p),x=p||{};return par.name||x.guardianName||x.parentName||'ولي الأمر';}
function notificationMap(p,extra){
 const x=p||{}, guardian=parentName(x), player=x.name||'';
 return Object.assign({'{ولي_الأمر}':guardian,'{اسم_ولي_الأمر}':guardian,'{اسم_الولي}':guardian,'{اللاعب}':player,'{اسم_اللاعب}':player,'{اسم_اللاعب_الكامل}':player,'{المدرسة}':db.settings.school||'','{الهاتف}':db.settings.phone||''},extra||{});
}
function playerNum(p){const par=parentRecord(p);return waPhone((p||{}).pphone||par.phone||(p||{}).phone);}
function openWA(num,text){if(!num){alert('لا يوجد رقم هاتف لولي الأمر. أضف الرقم في ملف اللاعب أو ولي الأمر.');return false;}window.open('https://wa.me/'+num+'?text='+encodeURIComponent(text),'_blank');return true;}
function attRate(pid){const my=db.attendance.filter(a=>a.player===pid);if(!my.length)return '—';const ok=my.filter(a=>a.state===ATT[0]||a.state===ATT[3]).length;return Math.round(ok/my.length*100)+'%';}
/* إشعار الغياب */
function absText(p,date,state){
 return tplFill(db.settings.waAbs||DEFAULT_ABS,notificationMap(p,{'{الفئة}':p.cat||'','{التاريخ}':date,'{الحالة}':String(state||'').replace(/[^\u0600-\u06FF ]/g,'').trim(),'{نسبة_الحضور}':attRate(p.id)}));
}
async function sendAbs(pid,date){
 const p=db.players.find(x=>x.id===pid);if(!p)return;
 const rec=db.attendance.find(a=>a.player===pid&&a.date===date);
 if(!openWA(playerNum(p),absText(p,date,rec?rec.state:'')))return;
 if(rec){rec.waSent=new Date().toISOString().slice(0,16).replace('T',' ');if(!await save())return;}
 render();
}
function sendAbsAll(){
 const l=db.attendance.filter(a=>a.date===attDate&&(a.state===ATT[1]||a.state===ATT[2])&&(!attTeam||a.team===attTeam));
 if(!l.length){alert('لا يوجد غائبون في هذا التاريخ.');return;}
 if(!confirm('سيتم فتح '+l.length+' محادثة واتساب لإشعار أولياء الأمور بالغياب. متابعة؟'))return;
 l.forEach((a,i)=>setTimeout(()=>sendAbs(a.player,attDate),i*1200));
}
/* رسالة الشكر بعد الأداء */
function thxText(s){
 const p=db.players.find(x=>x.id===s.player)||{};const rest=Math.max(0,actualDue(s)-(Number(s.paid)||0));
 if(s.kind==='رسوم التسجيل')return 'السلام عليكم '+parentName(p)+'، توصلنا بمبلغ '+money(s.paid)+' عن '+feeLabel(s)+' للاعب '+(p.name||'')+'. رقم الوصل: '+(s.rec||'—')+'. شكراً لتعاونكم مع '+(db.settings.school||'مدرسة كرة القدم')+' ⚽';
 return tplFill(db.settings.waThx||DEFAULT_THX,notificationMap(p,{'{الفئة}':p.cat||'','{الشهر}':s.month||'','{السنة}':s.year||'','{المدفوع}':money(s.paid),'{المطلوب}':money(actualDue(s)),'{المتبقي}':money(rest),'{رقم_الوصل}':s.rec||'','{تاريخ_الأداء}':s.date||todayISO()}));
}
async function sendThx(id){
 const s=db.subs.find(x=>x.id===id);if(!s)return;
 const p=db.players.find(x=>x.id===s.player)||{};
 const num=playerNum(p);
 if(waCloudReady()&&num&&s.kind!=='رسوم التسجيل'){
  const rest=Math.max(0,actualDue(s)-(Number(s.paid)||0));
  waCloudSend('thanks',num,thxText(s),[parentName(p),p.name||'',s.month||'',String(s.year||''),money(s.paid),money(rest),s.rec||'',db.settings.school||'']).then(async function(res){
   if(res.ok){s.thxSent=new Date().toISOString().slice(0,16).replace('T',' ');s.thxPaid=Number(s.paid)||0;if(!await save())return;render();syncToast('✅ أُرسل عبر واتساب');}
   else alert('تعذّر الإرسال: '+res.message);
  });
  return;
 }
 if(!openWA(num,thxText(s)))return;
 s.thxSent=new Date().toISOString().slice(0,16).replace('T',' ');if(!await save())return;render();
}
function waText(s){
 const p=db.players.find(x=>x.id===s.player)||{};const rest=Math.max(0,actualDue(s)-(Number(s.paid)||0));
 if(s.kind==='رسوم التسجيل')return 'السلام عليكم '+parentName(p)+'، نذكّركم بـ'+feeLabel(s)+' للاعب '+(p.name||'')+'. المبلغ الأصلي: '+money(baseAmount(s))+'، الخصم: '+money(discountAmount(s))+'، المستحق: '+money(actualDue(s))+'، المتبقي: '+money(rest)+'. شكراً لكم.';
 const map=notificationMap(p,{'{الفئة}':p.cat||'','{الشهر}':s.month||'','{السنة}':s.year||'','{المطلوب}':money(actualDue(s)),'{المدفوع}':money(s.paid),'{المتبقي}':money(rest),'{رقم_الوصل}':s.rec||''});
 return tplFill(db.settings.wa||DEFAULT_WA,map);
}
function waNum(s){
 const p=db.players.find(x=>x.id===s.player)||{};
 const par=db.parents.find(x=>x.id===p.parent)||{};
 return waPhone(p.pphone||par.phone||p.phone);
}
async function waSend(id){
 const s=db.subs.find(x=>x.id===id);if(!s)return;
 const n=waNum(s);
 if(!n){alert('لا يوجد رقم هاتف لولي الأمر. أضف الرقم في ملف اللاعب أو ولي الأمر.');return;}
 s.waSent=new Date().toISOString().slice(0,16).replace('T',' ');if(!await save())return;
 window.open('https://wa.me/'+n+'?text='+encodeURIComponent(waText(s)),'_blank');
 render();
}
function waCopy(id){const s=db.subs.find(x=>x.id===id);if(!s)return;navigator.clipboard.writeText(waText(s)).then(()=>alert('تم نسخ الرسالة'),()=>alert(waText(s)));}
function waList(){
 return db.subs.filter(s=>s.month===waMonth&&Number(s.year)===Number(waYear))
  .filter(s=>waOnly==='all'?true:(s.state!==PAY[0]&&s.state!==PAY[3]));
}
function waSendAll(){
 const l=waList().filter(s=>waNum(s));
 if(!l.length){alert('لا توجد رسائل للإرسال.');return;}
 if(!confirm('سيتم فتح '+l.length+' محادثة واتساب واحدة تلو الأخرى. متابعة؟'))return;
 l.forEach((s,i)=>setTimeout(()=>waSend(s.id),i*1200));
}
function waExport(){
 const rows=waList().map(s=>[refName('players',s.player),waNum(s),waText(s).replace(/\n/g,' | ')]);
 dl('whatsapp-'+waMonth+'-'+waYear+'.csv','\ufeff'+[['اللاعب','الرقم','الرسالة']].concat(rows).map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv');
}
function waPage(){
 const list=waList();
 const ready=list.filter(s=>waNum(s)).length;
 const preview=list.length?esc(waText(list[0])):esc((db.settings.wa||DEFAULT_WA));
 return head('💬 تذكير أولياء الأمور عبر واتساب',list.length+' لاعب معني • '+ready+' رقم هاتف جاهز',
   '<button class="btn" '+actionAttr('click',()=>waExport())+'>⬇️ تصدير اللائحة</button> <button class="btn primary" '+actionAttr('click',()=>waSendAll())+'>📤 إرسال للجميع</button>')+
  '<div class="tools">'+
   '<select '+actionAttr('change',(event,el)=>{waMonth=el.value;render()})+'>'+MONTHS.map(m=>'<option '+(m===waMonth?'selected':'')+'>'+m+'</option>').join('')+'</select>'+
   '<input type="number" style="width:110px" value="'+waYear+'" '+actionAttr('change',(event,el)=>{waYear=el.value;render()})+'>'+
   '<select '+actionAttr('change',(event,el)=>{waOnly=el.value;render()})+'><option value="late" '+(waOnly==='late'?'selected':'')+'>المتأخرون فقط</option><option value="all" '+(waOnly==='all'?'selected':'')+'>كل اللاعبين</option></select>'+
  '</div>'+
  '<div class="card" style="margin-bottom:16px"><b>نموذج الرسالة</b>'+
   '<div class="sub" style="margin:8px 0">المتغيرات: {ولي_الأمر} {اسم_ولي_الأمر} {اللاعب} {اسم_اللاعب} {الفئة} {الشهر} {السنة} {المطلوب} {المدفوع} {المتبقي} {رقم_الوصل} {المدرسة} {الهاتف}</div>'+
   '<textarea id="waTpl" style="width:100%;min-height:150px;padding:12px;border:1px solid var(--bd);border-radius:8px">'+esc(db.settings.wa||DEFAULT_WA)+'</textarea>'+
   '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" '+actionAttr('click',async ()=>{db.settings.wa=document.getElementById('waTpl').value;if(!await save())return;render()})+'>حفظ النموذج</button>'+
   '<button class="btn" '+actionAttr('click',async ()=>{db.settings.wa=DEFAULT_WA;if(!await save())return;render()})+'>استعادة النموذج الافتراضي</button></div>'+
   '<div class="card" style="background:var(--soft);margin-top:16px;white-space:pre-wrap;font-size:14.5px">'+preview+'</div></div>'+
  '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(330px,1fr));margin-bottom:16px">'+
   '<div class="card"><b>💬 نموذج إشعار الغياب</b><div class="sub" style="margin:8px 0">يُرسل من صفحة الحضور • المتغيرات: {ولي_الأمر} {اسم_ولي_الأمر} {اللاعب} {اسم_اللاعب} {الفئة} {التاريخ} {الحالة} {نسبة_الحضور} {المدرسة} {الهاتف}</div>'+
   '<textarea id="waAbsTpl" style="width:100%;min-height:150px;padding:12px;border:1px solid var(--bd);border-radius:8px">'+esc(db.settings.waAbs||DEFAULT_ABS)+'</textarea>'+
   '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" '+actionAttr('click',async ()=>{db.settings.waAbs=document.getElementById('waAbsTpl').value;if(!await save())return;render()})+'>حفظ</button>'+
   '<button class="btn" '+actionAttr('click',async ()=>{db.settings.waAbs=DEFAULT_ABS;if(!await save())return;render()})+'>استعادة الافتراضي</button></div></div>'+
   '<div class="card"><b>💚 نموذج رسالة الشكر بعد الأداء</b><div class="sub" style="margin:8px 0">يُرسل من صفحة الاشتراكات • المتغيرات: {ولي_الأمر} {اسم_ولي_الأمر} {اللاعب} {اسم_اللاعب} {الفئة} {الشهر} {السنة} {المدفوع} {المتبقي} {رقم_الوصل} {تاريخ_الأداء} {المدرسة} {الهاتف}</div>'+
   '<textarea id="waThxTpl" style="width:100%;min-height:150px;padding:12px;border:1px solid var(--bd);border-radius:8px">'+esc(db.settings.waThx||DEFAULT_THX)+'</textarea>'+
   '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" '+actionAttr('click',async ()=>{db.settings.waThx=document.getElementById('waThxTpl').value;if(!await save())return;render()})+'>حفظ</button>'+
   '<button class="btn" '+actionAttr('click',async ()=>{db.settings.waThx=DEFAULT_THX;if(!await save())return;render()})+'>استعادة الافتراضي</button></div></div>'+
   '<div class="card"><b>📷 نموذج إشعار الوصول (مسح QR)</b><div class="sub" style="margin:8px 0">يُرسل عند مسح بطاقة اللاعب • المتغيرات: {ولي_الأمر} {اسم_ولي_الأمر} {اللاعب} {اسم_اللاعب} {الفئة} {التاريخ} {الساعة} {نسبة_الحضور} {المدرسة} {الهاتف}</div>'+
   '<textarea id="waArrTpl" style="width:100%;min-height:150px;padding:12px;border:1px solid var(--bd);border-radius:8px">'+esc(db.settings.waArr||DEFAULT_ARR)+'</textarea>'+
   '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" '+actionAttr('click',async ()=>{db.settings.waArr=document.getElementById('waArrTpl').value;if(!await save())return;render()})+'>حفظ</button>'+
   '<button class="btn" '+actionAttr('click',async ()=>{db.settings.waArr=DEFAULT_ARR;if(!await save())return;render()})+'>استعادة الافتراضي</button></div></div>'+
  '</div>'+
  (list.length?'<div class="tw"><table><thead><tr><th>اللاعب</th><th>ولي الأمر</th><th>الرقم</th><th>المتبقي</th><th>الحالة</th><th>آخر تذكير</th><th class="no-print">إجراءات</th></tr></thead><tbody>'+
   list.map(s=>{const p=db.players.find(x=>x.id===s.player)||{};const par=db.parents.find(x=>x.id===p.parent)||{};const n=waNum(s);
    const rest=Math.max(0,actualDue(s)-(Number(s.paid)||0));
    return '<tr><td>'+esc(p.name||'')+'</td><td>'+esc(par.name||'—')+'</td><td>'+(n?'+'+n:'<span class="tag t-r">بدون رقم</span>')+'</td>'+
     '<td><b style="color:var(--red)">'+money(rest)+'</b></td><td><span class="tag '+tagClass(s.state)+'">'+esc(s.state||'')+'</span></td>'+
     '<td>'+(s.waSent?'<span class="tag t-b">'+esc(s.waSent)+'</span>':'—')+'</td>'+
     '<td class="no-print"><button class="btn sm primary" '+actionAttr('click',()=>waSend(s.id))+'>💬 إرسال</button> <button class="btn sm" '+actionAttr('click',()=>waCopy(s.id))+'>نسخ</button></td></tr>';
   }).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لا توجد اشتراكات لهذا الشهر. ولّد الاشتراكات من صفحة الاشتراكات أولاً.</div></div>');
}

function alertsPage(){
 const today=todayISO(),soon=[];
 (db.docs||[]).forEach(function(d){if(d.exp){const n=daysTo(d.exp);if(n!==null&&n<=30)soon.push({who:refName('players',d.player),title:d.title||d.cat,exp:d.exp,n:n});}});
 (db.players||[]).forEach(function(p){(p.att||[]).forEach(function(a){if(a.exp){const n=daysTo(a.exp);if(n!==null&&n<=30)soon.push({who:p.name,title:a.cat||a.name,exp:a.exp,n:n});}});});
 const arrears=db.subs.filter(function(x){return x.state!==PAY[0]&&x.state!==PAY[3];});
 const pending=(db.players||[]).filter(function(p){return p.status!=='منسحب'&&p.parent&&p.consentStatus!=='موافق عليها';});
 const absent=(db.players||[]).map(function(p){const a=db.attendance.filter(function(x){return x.player===p.id;}).sort(function(x,y){return String(y.date||'').localeCompare(String(x.date||''));}).slice(0,3);return {p:p,n:a.length===3&&a.every(function(x){return x.state===ATT[1]||x.state===ATT[2];})?3:0};}).filter(function(x){return x.n;});
 return head('🚨 مركز التنبيهات','وثائق قاربت على الانتهاء، متأخرات وغيابات متتالية','<button class="btn" '+actionAttr('click',()=>exportPDF('alerts-'+today+'.pdf',true))+'>⬇️ PDF</button> <button class="btn" '+actionAttr('click',()=>exportAlertsExcel())+'>📊 Excel</button>')+
  '<div class="grid kpis">'+kpi('📄 وثائق تحتاج متابعة',soon.length,'o','خلال 30 يوماً أو منتهية')+kpi('💰 اشتراكات غير مكتملة',arrears.length,'r','')+kpi('🔴 غيابات متتالية',absent.length,'r','آخر 3 سجلات')+kpi('✍️ موافقات معلقة',pending.length,'o','تحتاج توقيع ولي الأمر')+'</div>'+
  '<h2 class="sec">📄 الوثائق</h2>'+(soon.length?'<div class="tw"><table><thead><tr><th>المرتبط</th><th>الوثيقة</th><th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>'+soon.map(function(x){return '<tr><td>'+esc(x.who||'')+'</td><td>'+esc(x.title||'')+'</td><td>'+esc(x.exp)+'</td><td><span class="tag '+(x.n<0?'t-r':'t-o')+'">'+(x.n<0?'منتهية':'باقي '+x.n+' يوم')+'</span></td></tr>';}).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لا توجد وثائق منتهية أو قريبة الانتهاء.</div></div>')+
  '<h2 class="sec">💰 المتأخرات</h2>'+(arrears.length?'<div class="tw"><table><thead><tr><th>اللاعب</th><th>ولي الأمر</th><th>الشهر</th><th>المتبقي</th></tr></thead><tbody>'+arrears.map(function(x){const p=db.players.find(function(q){return q.id===x.player;})||{};return '<tr><td>'+esc(p.name||'')+'</td><td>'+esc(parentName(p))+'</td><td>'+esc((x.month||'')+' '+(x.year||''))+'</td><td><b style="color:var(--red)">'+money(Math.max(0,actualDue(x)-(Number(x.paid)||0)))+'</b></td></tr>';}).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">لا توجد متأخرات حالياً.</div></div>')+
  '<h2 class="sec">✍️ موافقات ولي الأمر المعلقة</h2>'+(pending.length?'<div class="card">'+pending.map(function(p){return '<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><b>'+esc(p.name||'')+'</b> — '+esc(parentName(p))+' <button class="btn sm" '+actionAttr('click',()=>go('portal'))+'>فتح البوابة</button></div>';}).join('')+'</div>':'<div class="card"><div class="empty">لا توجد موافقات معلقة.</div></div>')+
  '<h2 class="sec">🔴 الغيابات المتتالية</h2>'+(absent.length?'<div class="card">'+absent.map(function(x){return '<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><b>'+esc(x.p.name||'')+'</b> — غاب في آخر 3 سجلات حضور</div>';}).join('')+'</div>':'<div class="card"><div class="empty">لا توجد غيابات متتالية مقلقة.</div></div>');
}
function exportAlertsExcel(){const rows=[];(db.subs||[]).filter(function(x){return x.state!==PAY[0]&&x.state!==PAY[3];}).forEach(function(x){const p=db.players.find(function(q){return q.id===x.player;})||{};rows.push([p.name||'',parentName(p),'اشتراك '+(x.month||'')+' '+(x.year||''),money(Math.max(0,actualDue(x)-(Number(x.paid)||0)))]);});exportExcel('alerts-'+todayISO(),[{title:'تنبيهات ملعبنا',headers:['اللاعب / المرتبط','ولي الأمر','التنبيه','القيمة'],rows:rows}]);}
function cashboxTotals(date){const income=db.subs.reduce(function(sum,s){const ledger=MalaabnaFinance.paymentLedger(s);return sum+(ledger.ok?ledger.entries.filter(e=>String(e.date||'')===date).reduce((n,e)=>n+Math.round(e.amount*100),0)/100:0);},0);const expense=db.expenses.filter(function(x){return String(x.date||'')===date&&x.status!=='في انتظار الأداء';}).reduce(function(a,x){return a+(Number(x.amount)||0);},0);return {income:income,expense:expense,balance:income-expense};}
async function closeCashbox(){if(!isAdmin()){denied();return;}const t=cashboxTotals(cashDate),actual=Number((document.getElementById('cashActual')||{}).value);if(!Number.isFinite(actual)){alert('أدخل الرصيد الفعلي للصندوق.');return;}const note=String((document.getElementById('cashNote')||{}).value||'').trim();db.cashClosings=db.cashClosings||[];const old=db.cashClosings.find(function(x){return x.date===cashDate;});const rec={id:old?old.id:uid(),date:cashDate,expected:t.balance,actual:actual,diff:actual-t.balance,note:note,closedAt:new Date().toISOString(),actor:roleLabel()};if(old)Object.assign(old,rec);else db.cashClosings.unshift(rec);auditAdd('إغلاق الصندوق','التاريخ: '+cashDate+' — الفرق: '+money(rec.diff));if(!await save())return;render();}
function cashboxPage(){const t=cashboxTotals(cashDate),c=(db.cashClosings||[]).find(function(x){return x.date===cashDate;});return head('💳 الصندوق اليومي','مطابقة المداخيل والمصاريف المؤداة وإغلاق اليوم','<button class="btn" '+actionAttr('click',()=>exportPDF('cashbox-'+cashDate+'.pdf',true))+'>⬇️ PDF</button> <button class="btn" '+actionAttr('click',()=>exportCashboxExcel())+'>📊 Excel</button>')+'<div class="tools no-print"><input type="date" value="'+esc(cashDate)+'" '+actionAttr('change',(event,el)=>{cashDate=el.value;render()})+'></div><div class="grid kpis">'+kpi('💰 المداخيل',money(t.income),'g','المبالغ المدفوعة في هذا التاريخ')+kpi('💸 المصاريف',money(t.expense),'r','الدفعات المؤداة فقط')+kpi('🏦 الرصيد المتوقع',money(t.balance),t.balance>=0?'g':'r','')+'</div><div class="card no-print" style="max-width:720px;margin-top:16px"><h3 style="margin-top:0">إغلاق الصندوق</h3><div class="mf"><label>الرصيد الفعلي بعد العد</label><input id="cashActual" type="number" min="0" step="0.01" value="'+esc(c?c.actual:t.balance)+'"></div><div class="mf" style="margin-top:10px"><label>ملاحظات الفرق</label><textarea id="cashNote">'+esc(c?c.note||'':'')+'</textarea></div><button class="btn primary" style="margin-top:12px" '+actionAttr('click',()=>closeCashbox())+'>✅ حفظ إغلاق اليوم</button>'+(c?'<div class="notice" style="margin-top:10px">آخر إغلاق: '+esc(c.closedAt||'')+' — الفرق: <b>'+money(c.diff)+'</b></div>':'')+'</div><h2 class="sec">سجل الإغلاقات</h2><div class="tw"><table><thead><tr><th>التاريخ</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>الملاحظات</th></tr></thead><tbody>'+(db.cashClosings||[]).map(function(x){return '<tr><td>'+esc(x.date)+'</td><td>'+money(x.expected)+'</td><td>'+money(x.actual)+'</td><td>'+money(x.diff)+'</td><td>'+esc(x.note||'')+'</td></tr>';}).join('')+'</tbody></table></div>';}
function exportCashboxExcel(){const rows=(db.cashClosings||[]).map(function(x){return [x.date,money(x.expected),money(x.actual),money(x.diff),x.note||''];});exportExcel('cashbox-'+todayISO(),[{title:'إغلاقات الصندوق',headers:['التاريخ','المتوقع','الفعلي','الفرق','الملاحظات'],rows:rows}]);}

/* التقارير */
let repMonth=new Date().toISOString().slice(0,7);
function coachRows(ym){
 const recs=db.attendance.filter(a=>String(a.date||'').slice(0,7)===ym);
 return (db.coaches||[]).filter(c=>c.status!=='مغادر').map(function(c){
  const cats=parseCats(c.teams).filter(x=>CATS.indexOf(x)>=0);
  const pl=db.players.filter(p=>p.status!=='منسحب'&&cats.indexOf(p.cat)>=0);
  const ids=pl.map(p=>p.id);
  const my=recs.filter(a=>ids.indexOf(a.player)>=0);
  const days={};my.forEach(a=>{days[a.date]=1;});
  const g=my.filter(a=>a.state===ATT[0]).length,r=my.filter(a=>a.state===ATT[1]).length,o=my.filter(a=>a.state===ATT[2]).length,b=my.filter(a=>a.state===ATT[3]).length;
  const tr=(db.trainings||[]).filter(t=>t.coach===c.id&&String(t.date||'').slice(0,7)===ym);
  const done=tr.filter(t=>t.status==='أُنجزت').length;
  return {c:c,cats:cats,np:pl.length,days:Object.keys(days).length,tot:my.length,g:g,r:r,o:o,b:b,
   rate:my.length?Math.round((g+b)/my.length*100):0,trn:tr.length,done:done};
 });
}
async function genSalaries(){
 if(!isAdmin()){denied();return;}
 const ym=repMonth,mi=Number(String(ym).slice(5,7))-1,label=(MONTHS[mi]||'')+' '+String(ym).slice(0,4);
 let n=0;
 (db.coaches||[]).filter(c=>c.status!=='مغادر'&&Number(c.salary)>0).forEach(function(c){
  const title='أجرة المدرب '+(c.name||'')+' — '+label;
  if((db.expenses||[]).some(e=>e.title===title))return;
  db.expenses.push({id:uid(),title:title,cat:'أجور المدربين',amount:Number(c.salary),date:ym+'-28',benef:c.name||'',method:'نقداً',status:'في انتظار الأداء'});n++;
 });
 if(n){if(!await save())return;render();}
 alert(n?('✅ تم توليد '+n+' أجرة لشهر '+label+' في صفحة المصاريف (في انتظار الأداء).'):'لا توجد أجور جديدة لهذا الشهر (تأكد من تعبئة «التعويض الشهري» للمدربين).');
}
function yearReport(){
 const y=Number(String(repMonth).slice(0,4))||new Date().getFullYear();
 const subs=db.subs.filter(s=>Number(s.year)===y);
 const due=subs.reduce((a,s)=>a+actualDue(s),0),paid=subs.reduce((a,s)=>a+(Number(s.paid)||0),0);
 const exps=(db.expenses||[]).filter(e=>String(e.date||'').slice(0,4)===String(y));
 const spent=exps.reduce((a,e)=>a+(Number(e.amount)||0),0);
 const byCat=EXPC.map(c=>[c,exps.filter(e=>e.cat===c).reduce((a,e)=>a+(Number(e.amount)||0),0)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
 const att=db.attendance.filter(a=>String(a.date||'').slice(0,4)===String(y));
 const ok=att.filter(a=>a.state===ATT[0]||a.state===ATT[3]).length;
 const ms=(db.matches||[]).filter(m=>String(m.date||'').slice(0,4)===String(y));
 const w=ms.filter(m=>m.res==='فوز').length,dr=ms.filter(m=>m.res==='تعادل').length,l=ms.filter(m=>m.res==='هزيمة').length;
 const gf=ms.reduce((a,m)=>a+(Number(m.gf)||0),0),ga=ms.reduce((a,m)=>a+(Number(m.ga)||0),0);
 const trn=(db.trainings||[]).filter(t=>String(t.date||'').slice(0,4)===String(y)).length;
 const newP=db.players.filter(p=>String(p.reg||'').slice(0,4)===String(y)).length;
 const rate=att.length?Math.round(ok/att.length*100):0;
 const coll=due?Math.round(paid/due*100):0;
 return '<div class="grid kpis">'+
  kpi('👕 اللاعبون',db.players.length,'b',newP+' تسجيل جديد سنة '+y)+
  kpi('💰 مداخيل السنة',money(paid),'g','من أصل '+money(due))+
  kpi('💸 مصاريف السنة',money(spent),'r','')+
  kpi('🏦 الرصيد السنوي',money(paid-spent),(paid-spent)>=0?'g':'r','')+
  kpi('📈 نسبة التحصيل',coll+'%',coll>=80?'g':'o','')+
  kpi('✅ نسبة الحضور',rate+'%',rate>=80?'g':'o',att.length+' سجل')+
  kpi('🗓️ الحصص التدريبية',trn,'','')+
  kpi('🏆 المباريات',ms.length,'',w+'فوز / '+dr+'تعادل / '+l+'هزيمة — '+gf+':'+ga)+
  '</div>'+
  (byCat.length?'<div class="tw"><table><thead><tr><th>باب الصرف</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>'+
   byCat.map(c=>'<tr><td>'+esc(c[0])+'</td><td>'+money(c[1])+'</td><td>'+Math.round(c[1]/spent*100)+'%</td></tr>').join('')+
   '<tr><td><b>المجموع</b></td><td><b>'+money(spent)+'</b></td><td></td></tr></tbody></table></div>':'');
}
function coachReport(){
 const rows=coachRows(repMonth);
 const bar=v=>'<span class="track" style="display:block;height:8px;background:var(--soft2);border-radius:999px"><span style="display:block;height:100%;width:'+v+'%;background:'+(v>=80?'var(--green)':v>=50?'var(--orange)':'var(--red)')+';border-radius:999px"></span></span>';
 if(!rows.length)return '<div class="card"><div class="empty">لم يُسجّل أي مدرب بعد.</div></div>';
 const body=rows.map(function(x){
  return '<tr><td><b>'+esc(x.c.name||'')+'</b><div class="sub">'+esc(x.c.spec||'')+'</div></td>'+
   '<td>'+(x.cats.length?x.cats.map(c=>'<span class="tag t-n">'+esc(c)+'</span>').join(' '):'<span class="sub">لم تُحدّد</span>')+'</td>'+
   '<td>'+x.np+'</td>'+
   '<td><b>'+x.days+'</b></td>'+
   '<td>'+x.done+' / '+x.trn+'</td>'+
   '<td>'+x.g+'</td><td>'+x.b+'</td><td>'+x.r+'</td><td>'+x.o+'</td>'+
   '<td style="min-width:120px"><span class="tag '+(x.rate>=80?'t-g':x.rate>=50?'t-o':'t-r')+'">'+x.rate+'%</span>'+bar(x.rate)+'</td></tr>';
 }).join('');
 const tot=rows.reduce((a,x)=>a+x.tot,0);
 return '<div class="tools no-print"><input type="month" value="'+repMonth+'" '+actionAttr('change',(event,el)=>{repMonth=el.value;render()})+'>'+
  '<button class="btn" '+actionAttr('click',()=>genSalaries())+'>💸 توليد أجور المدربين لهذا الشهر</button>'+'<span class="sub">إجمالي سجلات الحضور في الشهر: '+tot+'</span></div>'+
  '<div class="tw"><table><thead><tr><th>المدرب</th><th>الفئات</th><th>اللاعبون</th><th>حصص سُجّل فيها الحضور</th><th>تداريب مُنجزة / مبرمجة</th><th>🟢</th><th>🔵</th><th>🔴</th><th>🟠</th><th>نسبة حضور فئته</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
  '<div class="sub" style="margin-top:8px">«حصص سُجّل فيها الحضور» = عدد الأيام التي سُجّل فيها حضور لاعبي فئاته خلال الشهر المختار. النسبة = (حاضر + متأخر) ÷ كل السجلات.</div>';
}
let famMonth=MONTHS[new Date().getMonth()],famYear=String(new Date().getFullYear());
let portalParentId='',portalConsentPlayer='',portalCodeInput='';
let cashDate=todayISO();
async function ensurePortalCode(par){if(!par)return '';if(!/^\d{6}$/.test(String(par.portalCode||''))){par.portalCode=String(Math.floor(100000+Math.random()*900000));if(!await save())return '';}return String(par.portalCode);}
function portalLogin(){const code=String((document.getElementById('portalCode')||{}).value||'').trim();const par=(db.parents||[]).find(x=>String(x.portalCode||'')===code);if(!par){alert('رمز بوابة ولي الأمر غير صحيح.');return;}portalParentId=par.id;portalCodeInput=code;render();}
function portalLogout(){portalParentId='';portalConsentPlayer='';portalCodeInput='';render();}
async function portalAdminOpen(id){const par=db.parents.find(x=>x.id===id);if(!par)return;portalParentId=id;const code=await ensurePortalCode(par);if(!code)return;portalCodeInput=code;render();}
async function portalAdminCode(id){const par=db.parents.find(x=>x.id===id);if(!par)return;const code=await ensurePortalCode(par);if(!code)return;alert('رمز بوابة '+(par.name||'ولي الأمر')+': '+code+'\nسلّمه لولي الأمر عبر قناة آمنة.');render();}
function portalCanvasSetup(){const canvas=document.getElementById('portalSignature');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#153e2b';let drawing=false,last=null;const pos=e=>{const r=canvas.getBoundingClientRect(),p=e.touches&&e.touches[0]?e.touches[0]:e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height};};const start=e=>{e.preventDefault();drawing=true;last=pos(e);};const move=e=>{if(!drawing)return;e.preventDefault();const q=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(q.x,q.y);ctx.stroke();last=q;};const end=()=>{drawing=false;};canvas.onpointerdown=start;canvas.onpointermove=move;canvas.onpointerup=end;canvas.onpointerleave=end;canvas.ontouchstart=start;canvas.ontouchmove=move;canvas.ontouchend=end;}
function portalClearSignature(){const c=document.getElementById('portalSignature');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);}
function portalStartConsent(pid){portalConsentPlayer=pid;render();setTimeout(portalCanvasSetup,20);}
async function portalSubmitConsent(){const par=db.parents.find(x=>x.id===portalParentId),p=db.players.find(x=>x.id===portalConsentPlayer&&x.parent===portalParentId);const name=String((document.getElementById('portalSignerName')||{}).value||'').trim(),ok=!!(document.getElementById('portalConsentCheck')||{}).checked,c=document.getElementById('portalSignature');if(!par||!p)return;if(!name||!ok){alert('أدخل اسم ولي الأمر ووافق على نص الالتزام قبل التوقيع.');return;}const sig=c?c.toDataURL('image/png'):'';if(!sig||sig.length<200){alert('يرجى رسم التوقيع الإلكتروني داخل المربع.');return;}p.consentStatus='موافق عليها';p.consentName=name;p.consentAt=todayISO();p.consentSignature=sig;p.consentText=db.settings.consentText||'';p.consentParent=par.id;auditAdd('توقيع موافقة ولي الأمر','اللاعب: '+(p.name||'')+' — ولي الأمر: '+(par.name||''));if(!await save())return;portalConsentPlayer='';alert('تم حفظ موافقة ولي الأمر والتوقيع الإلكتروني.');render();}
function portalPage(){
 const par=portalParentId?db.parents.find(x=>x.id===portalParentId):null;
 if(!par)return head('👨‍👩‍👧‍👦 بوابة ولي الأمر','دخول آمن برمز خاص لعرض بيانات الأبناء والموافقة الإلكترونية','')+
  '<div class="card" style="max-width:560px;margin:0 auto;text-align:center"><div style="font-size:42px">🔐</div><h2>دخول ولي الأمر</h2><div class="sub">أدخل الرمز المكوّن من 6 أرقام الذي سلّمته لك الإدارة.</div><input id="portalCode" inputmode="numeric" maxlength="6" placeholder="000000" style="text-align:center;font-size:24px;letter-spacing:8px;max-width:240px;margin:12px auto;display:block"><button class="btn primary" '+actionAttr('click',()=>portalLogin())+'>دخول البوابة</button></div>'+
  (isAdmin()?'<div class="card" style="max-width:900px;margin:20px auto"><b>إدارة رموز البوابة</b><div class="sub" style="margin:6px 0 12px">ولّد رمزاً لكل ولي أمر وسلّمه له عبر قناة آمنة.</div><div class="tw"><table><thead><tr><th>ولي الأمر</th><th>الأبناء</th><th>الرمز</th><th>إجراء</th></tr></thead><tbody>'+(db.parents||[]).map(function(x){const kids=db.players.filter(p=>p.parent===x.id);return '<tr><td>'+esc(x.name||'')+'</td><td>'+kids.map(k=>esc(k.name||'')).join('، ')+'</td><td><b>'+esc(x.portalCode||'—')+'</b></td><td><button class="btn sm" '+actionAttr('click',()=>portalAdminCode(x.id))+'>توليد / عرض</button> <button class="btn sm primary" '+actionAttr('click',()=>portalAdminOpen(x.id))+'>فتح العرض</button></td></tr>';}).join('')+'</tbody></table></div></div>':'');
 const kids=db.players.filter(p=>p.parent===par.id&&p.status!=='منسحب');
 const consent=portalConsentPlayer?db.players.find(x=>x.id===portalConsentPlayer):null;
 return head('👨‍👩‍👧‍👦 بوابة ولي الأمر',par.name+' — عرض الأبناء والمستحقات','<button class="btn" '+actionAttr('click',()=>portalLogout())+'>🔒 خروج</button>')+
  '<div class="notice" style="margin-bottom:16px">هذه البوابة للعرض والموافقة الإلكترونية فقط. لا يمكن لولي الأمر تعديل السجلات المالية أو الإدارية.</div>'+
  '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">'+kids.map(function(p){const ss=db.subs.filter(x=>x.player===p.id),rest=ss.reduce((a,x)=>a+Math.max(0,actualDue(x)-(Number(x.paid)||0)),0);return '<div class="card"><b>'+esc(p.name||'')+'</b><div class="sub">'+esc(p.cat||'')+' • '+esc(refName('teams',p.team))+'</div><div style="margin-top:10px">المتأخرات: <b style="color:'+(rest?'var(--red)':'var(--green)')+'">'+money(rest)+'</b></div><div style="margin-top:6px">الموافقة: <span class="tag '+(p.consentStatus==='موافق عليها'?'t-g':'t-o')+'">'+esc(p.consentStatus||'في انتظار الموافقة')+'</span></div><button class="btn sm primary" style="margin-top:10px" '+actionAttr('click',()=>portalStartConsent(p.id))+'>'+(p.consentStatus==='موافق عليها'?'عرض / تحديث الموافقة':'✍️ توقيع الموافقة')+'</button></div>';}).join('')+'</div>'+
  (consent?'<div class="card" style="margin-top:18px;max-width:760px"><h3 style="margin-top:0">✍️ موافقة ولي الأمر — '+esc(consent.name||'')+'</h3><div class="notice" style="white-space:pre-wrap">'+esc(db.settings.consentText||'')+'</div><label style="display:flex;gap:8px;align-items:center;margin:14px 0"><input id="portalConsentCheck" type="checkbox"> أوافق على نص الالتزام أعلاه</label><div class="mf"><label>الاسم الكامل لولي الأمر</label><input id="portalSignerName" value="'+esc(par.name||'')+'"></div><div class="mf" style="margin-top:12px"><label>التوقيع الإلكتروني</label>'+(consent.consentSignature?'<div class="sub">التوقيع المحفوظ بتاريخ '+esc(consent.consentAt||'')+'</div><img src="'+safeImg(consent.consentSignature)+'" style="max-width:260px;max-height:90px;object-fit:contain;border:1px solid var(--bd);border-radius:8px;background:#fff;margin:6px 0">':'')+'<canvas id="portalSignature" width="700" height="190" style="width:100%;height:190px;border:1px dashed var(--bd);border-radius:10px;background:#fff;touch-action:none"></canvas></div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" '+actionAttr('click',()=>portalClearSignature())+'>مسح التوقيع</button><button class="btn primary" '+actionAttr('click',()=>portalSubmitConsent())+'>حفظ الموافقة والتوقيع</button></div></div>':'');
}
function famData(){
 return (db.parents||[]).map(function(par){
  const kids=db.players.filter(p=>p.parent===par.id&&p.status!=='منسحب');
  const ids=kids.map(k=>k.id);
  const ms=db.subs.filter(s=>ids.indexOf(s.player)>=0&&s.month===famMonth&&String(s.year)===String(famYear));
  const due=ms.reduce((a,s)=>a+actualDue(s),0);
  const paid=ms.reduce((a,s)=>a+(Number(s.paid)||0),0);
  const debt=db.subs.filter(s=>ids.indexOf(s.player)>=0).reduce((a,s)=>a+Math.max(0,actualDue(s)-(Number(s.paid)||0)),0);
  return {par:par,kids:kids,ms:ms,due:due,paid:paid,rest:Math.max(0,due-paid),debt:debt};
 }).filter(x=>x.kids.length);
}
function famNum(f){return waPhone(f.par.phone||f.par.phone2||(f.kids[0]||{}).pphone||(f.kids[0]||{}).phone);}
function famText(f){
 const L=String.fromCharCode(10);
 let t='السلام عليكم '+(f.par.name||'')+'،'+L+db.settings.school+' ⚽'+L+
  'تذكير باشتراك شهر '+famMonth+' '+famYear+':'+L;
 f.kids.forEach(function(k){
  const s=f.ms.find(x=>x.player===k.id);
  const rest=s?Math.max(0,actualDue(s)-(Number(s.paid)||0)):0;
  t+='• '+(k.name||'')+' ('+(k.cat||'')+'): '+(s?(rest>0?'المتبقي '+money(rest):'مؤدّى ✅'):'لا يوجد اشتراك مُولّد')+L;
 });
 t+=L+'المجموع المطلوب: '+money(f.rest)+L;
 if(f.debt>f.rest)t+='مجموع المتأخرات: '+money(f.debt)+L;
 t+=L+'شكراً لتعاونكم.'+(db.settings.phone?L+db.settings.phone:'');
 return t;
}
function famRemind(id){const f=famData().find(x=>x.par.id===id);if(!f)return;openWA(famNum(f),famText(f));}
function famRemindAll(){const list=famData().filter(f=>f.rest>0&&famNum(f));if(!list.length){alert('لا توجد عائلات عليها مستحقات هذا الشهر.');return;}if(!confirm('ستُفتح '+list.length+' محادثة واتساب واحدة تلو الأخرى. متابعة؟'))return;list.forEach(function(f,i){setTimeout(function(){openWA(famNum(f),famText(f));},i*1200);});}
function exportFamiliesExcel(){const data=famData();exportExcel('families-'+famMonth+'-'+famYear,[{title:'ملفات العائلات — '+famMonth+' '+famYear,headers:['ولي الأمر','الأبناء','المطلوب','المدفوع','المتبقي','مجموع المتأخرات'],rows:data.map(function(f){return [f.par.name||'',f.kids.map(function(k){return k.name||'';}).join('، '),money(f.due),money(f.paid),money(f.rest),money(f.debt)];})}]);}
function familyPage(){
 const data=famData();
 const yrs=[];for(let y=new Date().getFullYear()+1;y>=new Date().getFullYear()-3;y--)yrs.push(String(y));
 const cards=data.map(function(f){
  const kids=f.kids.map(k=>'<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0"><span>'+(k.photo?'<img class="avatar" src="'+safeImg(k.photo)+'">':'')+esc(k.name||'')+' <span class="tag t-n">'+esc(k.cat||'')+'</span></span><span class="sub">'+esc(refName('teams',k.team))+'</span></div>').join('');
  const st=f.rest<=0?'<span class="tag t-g">مؤدّى بالكامل</span>':(f.paid>0?'<span class="tag t-o">أداء جزئي</span>':'<span class="tag t-r">غير مؤدّى</span>');
  return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'+
   '<div><b>'+esc(f.par.name||'')+'</b><div class="sub">'+esc(f.par.phone||'بدون هاتف')+' • '+f.kids.length+' أبناء</div></div>'+st+'</div>'+
   '<div style="margin:10px 0;border-top:1px solid var(--bd);padding-top:8px">'+kids+'</div>'+
   '<div class="tw"><table><tbody>'+
   '<tr><td class="sub">المطلوب (الشهر)</td><td><b>'+money(f.due)+'</b></td></tr>'+
   '<tr><td class="sub">المدفوع</td><td>'+money(f.paid)+'</td></tr>'+
   '<tr><td class="sub">المتبقي</td><td><b style="color:'+(f.rest>0?'var(--red)':'var(--green)')+'">'+money(f.rest)+'</b></td></tr>'+
   '<tr><td class="sub">مجموع المتأخرات</td><td>'+money(f.debt)+'</td></tr>'+
   '</tbody></table></div>'+
   '<div class="no-print" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" style="background:var(--greenS);border-color:#8fc7a8;color:#2b6b4a" '+actionAttr('click',()=>famRemind(f.par.id))+'>💬 تذكير العائلة</button></div></div>';
 }).join('');
 const tDue=data.reduce((a,f)=>a+f.due,0),tPaid=data.reduce((a,f)=>a+f.paid,0),tRest=data.reduce((a,f)=>a+f.rest,0);
 return head('👪 ملفات العائلات','كل ولي أمر مع أبنائه ومجموع اشتراكاتهم','<button class="btn" '+actionAttr('click',()=>exportPDF('families-'+famMonth+'-'+famYear+'.pdf',true))+'>⬇️ PDF</button> <button class="btn" '+actionAttr('click',()=>exportFamiliesExcel())+'>📊 Excel</button> <button class="btn primary" '+actionAttr('click',()=>famRemindAll())+'>💬 تذكير كل العائلات المدينة</button>')+
  '<div class="tools no-print"><select '+actionAttr('change',(event,el)=>{famMonth=el.value;render()})+'>'+MONTHS.map(m=>'<option '+(famMonth===m?'selected':'')+'>'+m+'</option>').join('')+'</select>'+
  '<select '+actionAttr('change',(event,el)=>{famYear=el.value;render()})+'>'+yrs.map(y=>'<option '+(String(famYear)===y?'selected':'')+'>'+y+'</option>').join('')+'</select></div>'+
  '<div class="grid">'+kpi('المطلوب',money(tDue),'')+kpi('المدفوع',money(tPaid),'green')+kpi('المتبقي',money(tRest),'red')+kpi('عدد العائلات',String(data.length),'')+'</div>'+
  (data.length?'<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">'+cards+'</div>':'<div class="card"><div class="empty">اربط اللاعبين بأولياء أمورهم من ملف اللاعب لتظهر العائلات هنا.</div></div>');
}
function evaluationTrendRows(){const map={};(db.evals||[]).forEach(function(e){const k=e.player;if(!map[k])map[k]=[];const vals=['speed','drib','pass','shoot','ctrl','fit','disc','tw'].map(function(a){return Number(e[a])||0;});map[k].push({date:e.date||'',avg:Math.round(vals.reduce(function(a,b){return a+b;},0)/8*10)/10});});return Object.keys(map).map(function(pid){const a=map[pid].sort(function(x,y){return String(y.date).localeCompare(String(x.date));});const latest=a[0]||{avg:0},prev=a[1]||null;return {name:refName('players',pid),latest:latest.avg,previous:prev?prev.avg:null,delta:prev?Math.round((latest.avg-prev.avg)*10)/10:null};});}
function evaluationTrendHTML(){const rows=evaluationTrendRows();return '<h2 class="sec">⭐ تطور تقييم اللاعبين</h2>'+(rows.length?'<div class="tw"><table><thead><tr><th>اللاعب</th><th>آخر متوسط</th><th>المتوسط السابق</th><th>التغير</th></tr></thead><tbody>'+rows.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td>'+x.latest+'/10</td><td>'+(x.previous===null?'—':x.previous+'/10')+'</td><td>'+(x.delta===null?'—':'<span class="tag '+(x.delta>=0?'t-g':'t-r')+'">'+(x.delta>0?'+':'')+x.delta+'</span>')+'</td></tr>';}).join('')+'</tbody></table></div>':'<div class="card"><div class="empty">أضف تقييمين أو أكثر للاعب لعرض التطور.</div></div>');}
function reportsPage(){
 const y=new Date().getFullYear();
 const inc=MONTHS.map(m=>db.subs.filter(s=>s.month===m&&Number(s.year)===y).reduce((a,s)=>a+(Number(s.paid)||0),0));
 const exp=MONTHS.map((m,i)=>db.expenses.filter(e=>(e.date||'').slice(0,7)===y+'-'+String(i+1).padStart(2,'0')).reduce((a,e)=>a+(Number(e.amount)||0),0));
 const max=Math.max(1,...inc,...exp);
 const byCat=CATS.map(c=>[c,db.players.filter(p=>p.cat===c).length]).filter(x=>x[1]);
 return head('📈 التقارير','الموسم '+y,'<button class="btn" '+actionAttr('click',()=>exportPDF('report-'+y+'.pdf',true))+'>⬇️ PDF</button> <button class="btn" '+actionAttr('click',()=>exportReportsExcel())+'>📊 Excel</button> <button class="btn" '+actionAttr('click',()=>window.print())+'>🖨️ طباعة التقرير</button>')+
  '<h2 class="sec">التقرير المالي الشهري</h2><div class="tw"><table><thead><tr><th>الشهر</th><th>المداخيل</th><th>المصاريف</th><th>الرصيد</th><th style="width:220px">مقارنة</th></tr></thead><tbody>'+
  MONTHS.map((m,i)=>'<tr><td>'+m+'</td><td>'+money(inc[i])+'</td><td>'+money(exp[i])+'</td><td><b style="color:'+((inc[i]-exp[i])>=0?'var(--green)':'var(--red)')+'">'+money(inc[i]-exp[i])+'</b></td>'+
   '<td><span class="track" style="display:block;height:8px;background:var(--soft2);border-radius:999px"><span style="display:block;height:100%;width:'+Math.round(inc[i]/max*100)+'%;background:var(--green);border-radius:999px"></span></span>'+
   '<span class="track" style="display:block;height:8px;background:var(--soft2);border-radius:999px;margin-top:4px"><span style="display:block;height:100%;width:'+Math.round(exp[i]/max*100)+'%;background:var(--orange);border-radius:999px"></span></span></td></tr>').join('')+
  '<tr><td><b>المجموع</b></td><td><b>'+money(inc.reduce((a,b)=>a+b,0))+'</b></td><td><b>'+money(exp.reduce((a,b)=>a+b,0))+'</b></td><td><b>'+money(inc.reduce((a,b)=>a+b,0)-exp.reduce((a,b)=>a+b,0))+'</b></td><td></td></tr>'+
  '</tbody></table></div>'+
  '<h2 class="sec">توزيع اللاعبين حسب الفئة</h2>'+(byCat.length?'<div class="card bars">'+byCat.map(c=>'<div class="bar"><span>'+c[0]+'</span><span class="track"><span class="fill" style="width:'+Math.round(c[1]/Math.max(...byCat.map(x=>x[1]))*100)+'%"></span></span><span>'+c[1]+'</span></div>').join('')+'</div>':'<div class="card"><div class="empty">لا يوجد لاعبون بعد.</div></div>')+
  '<h2 class="sec">🧑‍🏫 أداء المدربين الشهري</h2>'+coachReport()+
  '<h2 class="sec">🗓️ التقرير السنوي</h2>'+yearReport()+
  evaluationTrendHTML()+'<h2 class="sec">🔴 المتأخرات</h2>'+subsTable(db.subs.filter(s=>s.state!==PAY[0]&&s.state!==PAY[3]));
}

function exportReportsExcel(){
 const y=new Date().getFullYear();
 const monthly=MONTHS.map(function(m,i){const inc=db.subs.filter(s=>s.month===m&&Number(s.year)===y).reduce((a,s)=>a+(Number(s.paid)||0),0);const exp=db.expenses.filter(e=>(e.date||'').slice(0,7)===y+'-'+String(i+1).padStart(2,'0')).reduce((a,e)=>a+(Number(e.amount)||0),0);return [m, money(inc), money(exp), money(inc-exp)];});
 const cats=CATS.map(function(c){return [c,db.players.filter(p=>p.cat===c).length];}).filter(function(x){return x[1];});
 const coaches=coachRows(repMonth).map(function(x){return [x.c.name||'',x.cats.join('، '),x.np,x.days,x.done+' / '+x.trn,x.rate+'%'];});
 const arrears=db.subs.filter(function(s){return s.state!==PAY[0]&&s.state!==PAY[3];}).map(function(s){const p=db.players.find(function(x){return x.id===s.player;})||{};return [p.name||'',parentName(p),s.month||'',s.year||'',money(actualDue(s)),money(s.paid),money(Math.max(0,actualDue(s)-(Number(s.paid)||0))),s.state||''];});
 exportExcel('reports-'+y,[
  {title:'التقرير المالي الشهري — '+y,headers:['الشهر','المداخيل','المصاريف','الرصيد'],rows:monthly},
  {title:'توزيع اللاعبين حسب الفئة',headers:['الفئة','عدد اللاعبين'],rows:cats},
  {title:'أداء المدربين — '+repMonth,headers:['المدرب','الفئات','اللاعبون','أيام الحضور','التداريب المنجزة / المبرمجة','نسبة الحضور'],rows:coaches},
  {title:'المتأخرات',headers:['اللاعب','ولي الأمر','الشهر','السنة','المطلوب','المدفوع','المتبقي','الحالة'],rows:arrears}
 ]);
}

/* اللوغو ومدير المدرسة */
function readImgTo(el,key,max){
 const f=el.files[0];if(!f)return;const r=new FileReader();
 r.onload=e=>{const img=new Image();img.onload=async ()=>{const m=max||420;let w=img.width,h=img.height;
  if(w>m||h>m){const k=Math.min(m/w,m/h);w=Math.round(w*k);h=Math.round(h*k);}
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
  db.settings[key]=c.toDataURL('image/png');if(!await save())return;render();};img.src=e.target.result;};
 r.readAsDataURL(f);
}
async function clearImg(key){db.settings[key]='';if(!await save())return;render();}
function imgBox(key,label,hint,h){
 const v=db.settings[key];
 return '<div class="card" style="text-align:center"><b>'+label+'</b><div class="sub" style="margin:8px 0 12px">'+hint+'</div>'+
  '<div style="height:'+(h||120)+'px;display:grid;place-items:center;background:var(--soft);border:1px dashed var(--bd);border-radius:12px;margin-bottom:12px">'+
  (v?'<img src="'+safeImg(v)+'" style="max-height:'+((h||120)-16)+'px;max-width:90%;object-fit:contain">':'<span class="sub">لا توجد صورة</span>')+'</div>'+
  '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'+
  '<label class="btn primary">🖼️ رفع صورة<input type="file" accept="image/*" style="display:none" '+actionAttr('change',(event,el)=>readImgTo(el,key))+'></label>'+
  (v?'<button class="btn danger" '+actionAttr('click',()=>clearImg(key))+'>حذف</button>':'')+'</div></div>';
}
function adminPage(){
 const s=db.settings,t=todayISO();
 const income=db.subs.reduce((a,x)=>a+(Number(x.paid)||0),0);
 const spent=db.expenses.reduce((a,x)=>a+(Number(x.amount)||0),0);
 const debt=db.subs.reduce((a,x)=>a+Math.max(0,actualDue(x)-(Number(x.paid)||0)),0);
 const f=(k,l,ty)=>'<div class="mf"><label>'+l+'</label><input id="a_'+k+'" type="'+(ty||'text')+'" value="'+esc(s[k]||'')+'"></div>';
 return head('👔 مدير المدرسة','بطاقة المدير وهوية المدرسة — تظهر تلقائياً في الوصولات والتقارير','<button class="btn" '+actionAttr('click',()=>window.print())+'>🖨️ طباعة البطاقة</button>')+
  '<div class="card" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-bottom:16px">'+
   '<div style="width:96px;height:96px;border-radius:16px;overflow:hidden;background:var(--soft);display:grid;place-items:center;font-size:38px">'+(s.dirPhoto?'<img src="'+safeImg(s.dirPhoto)+'" style="width:100%;height:100%;object-fit:cover">':'👤')+'</div>'+
   '<div style="flex:1;min-width:220px"><h2 style="margin:0">'+esc(s.dirName||'اسم المدير')+'</h2>'+
   '<div class="sub" style="margin-top:4px">'+esc(s.dirRole||'مدير المدرسة')+' — '+esc(s.school)+'</div>'+
   '<div class="sub" style="margin-top:8px">'+(s.dirPhone?'📞 '+esc(s.dirPhone)+'  ':'')+(s.dirEmail?'📧 '+esc(s.dirEmail)+'  ':'')+(s.dirCin?'🪪 '+esc(s.dirCin):'')+'</div></div>'+
   '<div style="width:120px;height:96px;display:grid;place-items:center">'+(s.logo?'<img src="'+safeImg(s.logo)+'" style="max-width:100%;max-height:100%;object-fit:contain">':'<span style="font-size:38px">⚽</span>')+'</div>'+
  '</div>'+
  '<div class="grid kpis" style="margin-bottom:16px">'+
   kpi('👕 اللاعبون',db.players.length,'b','')+
   kpi('🧑‍🏫 المدربون',db.coaches.length,'','')+
   kpi('💰 إجمالي المداخيل',money(income),'g','')+
   kpi('💸 إجمالي المصاريف',money(spent),'r','')+
   kpi('🏦 الرصيد',money(income-spent),(income-spent)>=0?'g':'r','')+
   kpi('⚠️ المتأخرات',money(debt),'o','غير محصلة')+
  '</div>'+
  '<h2 class="sec no-print">معلومات المدير</h2>'+
  '<div class="card no-print" style="max-width:760px"><div class="mb" style="padding:0">'+
   f('dirName','الاسم الكامل')+f('dirRole','الصفة')+f('dirPhone','الهاتف','tel')+f('dirEmail','البريد الإلكتروني')+
   f('dirCin','رقم البطاقة الوطنية')+f('dirSince','تاريخ التعيين','date')+
   '<div class="mf full"><label>ملاحظات / كلمة المدير</label><textarea id="a_dirNotes">'+esc(s.dirNotes||'')+'</textarea></div>'+
   '</div><div style="margin-top:16px"><button class="btn primary" '+actionAttr('click',()=>saveAdmin())+'>حفظ</button></div></div>'+
  '<h2 class="sec no-print">موقّعو الشهادات الرسمية</h2>'+
  '<div class="card no-print" style="max-width:760px"><p class="sub">تُستخدم هذه الأسماء في الشهادات الرسمية فقط. لا تُصدر شهادة قبل إدخال اسم الرئيس واسم المدرب؛ الصفتان اختياريتان (الافتراضي: رئيس النادي / مدرب).</p><div class="mb" style="padding:0">'+
   f('presidentName','اسم الرئيس')+f('presidentRole','صفة الرئيس')+f('coachName','اسم المدرب')+f('coachRole','صفة المدرب')+
  '</div><div style="margin-top:16px"><button class="btn primary" '+actionAttr('click',()=>saveCertificateSigners())+'>حفظ الموقّعين</button></div></div>'+
  '<h2 class="sec no-print">الصور الرسمية</h2>'+
  '<div class="grid no-print" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">'+
   imgBox('logo','⚽ لوغو المدرسة','يظهر في القائمة الجانبية والوصولات والتقارير')+
   imgBox('dirPhoto','👤 صورة المدير','تظهر في بطاقة المدير')+
   imgBox('stamp','🖋️ التوقيع والختم','يُطبع تلقائياً أسفل وصل الأداء')+
  '</div>'+
  (s.dirNotes?'<div class="card" style="margin-top:16px"><b>كلمة المدير</b><div style="margin-top:8px;white-space:pre-wrap">'+esc(s.dirNotes)+'</div></div>':'');
}
async function saveAdmin(){['dirName','dirRole','dirPhone','dirEmail','dirCin','dirSince','dirNotes'].forEach(k=>{const el=document.getElementById('a_'+k);if(el)db.settings[k]=el.value;});auditAdd('تحديث ملف المدير',db.settings.dirName||'');if(!await save())return;render();}
async function saveCertificateSigners(){['presidentName','presidentRole','coachName','coachRole'].forEach(k=>{const el=document.getElementById('a_'+k);if(el)db.settings[k]=el.value.trim();});auditAdd('تحديث موقّعي الشهادات',(db.settings.presidentName||'')+' / '+(db.settings.coachName||''));if(!await save())return;render();}

/* ==== لوحة دعوات الهاتف (المدير) ==== */
function invitesPage(){
 const canUse=!!(mobileInfo||syncReady());
 const perms=permItems().map(n=>'<label style="display:flex;align-items:center;gap:6px;font-size:13px;min-width:180px"><input type="checkbox" class="inv-perm" value="'+n.id+'"> '+n.i+' '+esc(n.l)+'</label>').join('');
 return head('🔗 دعوات الهاتف','أنشئ رابط دعوة لمدرب أو مستخدم من الهاتف، ثم شاركه مباشرة عبر واتساب.')+
  '<div class="card" style="max-width:820px">'+
   '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">'+
    '<div style="font-size:34px">📱</div><div style="flex:1;min-width:220px"><b>دعوة مستخدم جديد</b><div class="sub" style="margin-top:4px">الرابط يستعمل مرة واحدة. المدعو يختار اسم المستخدم وكلمة السر بنفسه.</div></div>'+
   '</div>'+
   '<div class="mb" style="padding:18px 0 0">'+
    '<div class="mf"><label>اسم المدعو</label><input id="invName" placeholder="مثال: المدرب أحمد"></div>'+
    '<div class="mf"><label>نوع الحساب</label><select id="invRole">'+roleOptionsHTML('coach')+'</select></div>'+
    '<div class="mf"><label>صلاحية الرابط</label><select id="invHours"><option value="24">24 ساعة</option><option value="48" selected>48 ساعة</option><option value="72">3 أيام</option><option value="168">7 أيام</option></select></div>'+
    '<div class="mf full"><label>الأقسام المسموح بها للحساب</label><div style="display:flex;flex-wrap:wrap;gap:9px 16px;padding:10px;border:1px solid var(--bd);border-radius:10px">'+perms+'</div></div>'+
   '</div>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn primary" '+actionAttr('click',()=>invCreate())+'>🔗 إنشاء رابط الدعوة</button><button class="btn" '+actionAttr('click',()=>invRefresh())+'>↻ تحديث</button></div>'+
   '<div id="invResult"></div><div id="invLists"></div>'+ 
   (!canUse?'<div class="notice" style="margin-top:14px">أكمل إعداد مساحة المزامنة أو سجّل الدخول بحساب المدير على الهاتف لتفعيل الدعوات.</div>':'')+
  '</div>';
}

/* الإعدادات */
let systemStatus=null,systemBusy=false,systemError='',systemFiles=[],systemFile='',systemCheck=null,systemNotice='';
function cleanSystemStatus(input){
 const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(x)&&Number.isFinite(Date.parse(x))?x:null;
 const error=x=>['backup_state_unreadable','backup_state_write_failed','backup_write_failed','backup_decode_failed','backup_schema_failed','backup_encryption_required','backup_latest_invalid','backup_checksum_failed','external_backup_failed'].includes(x)?x:null;
 const s=input&&input.storage||{},b=input&&input.backup||{},e=input&&input.external||{},d=input&&input.drill;
 return {version:/^\d+\.\d+\.\d+$/.test(input&&input.version||'')?input.version:'unknown',checkedAt:iso(input&&input.checkedAt),storage:{readable:s.readable===true,encrypted:s.encrypted===true,availableBytes:Number.isSafeInteger(s.availableBytes)&&s.availableBytes>=0?s.availableBytes:null},backup:{lastSuccessAt:iso(b.lastSuccessAt),latestVerified:b.latestVerified===true,overdue:b.overdue!==false,error:error(b.error)},external:{configured:e.configured===true,lastSuccessAt:iso(e.lastSuccessAt),error:error(e.error),offHostConfirmed:false},drill:d?{status:d.status==='passed'?'passed':'failed',finishedAt:iso(d.finishedAt),scope:'isolated-data-roundtrip'}:null,drillDue:!input||input.drillDue!==false};
}
function systemTime(value){return value?new Date(value).toLocaleString('ar-MA'):'لم يُسجَّل نجاح بعد';}
function systemPage(){
 const s=systemStatus,b=s&&s.backup,e=s&&s.external,d=s&&s.drill,disabled=systemBusy?' disabled':'';
 const btn=(label,fn,primary)=>'<button class="btn '+(primary?'primary':'')+'" '+actionAttr('click',fn)+disabled+'>'+label+'</button>';
 const card=(title,content)=>'<section class="card system-card"><h2>'+title+'</h2>'+content+'</section>';
 const p=text=>'<p>'+esc(text)+'</p>';
 let body='<div class="system-page">'+head('حالة النظام','متابعة الحفظ والنسخ الاحتياطية — للمدير فقط','')+'<div class="system-actions">'+btn(systemBusy?'جارٍ الفحص…':'تحديث الحالة',()=>loadSystemStatus(),true)+btn('إنشاء نسخة مفحوصة',()=>systemBackupAction('create'))+btn('تصدير تشخيص منقّح',()=>exportSystemDiagnostic())+'</div>';
 body+='<div aria-live="polite">'+(systemError?'<div class="system-alert risk">'+esc(systemError)+'</div>':'')+(systemNotice?'<div class="system-alert">'+esc(systemNotice)+'</div>':'')+'</div>';
 if(!s)body+='<div class="card system-card"><h2>لم تُفحص حالة الخادم</h2>'+p('احفظ إعدادات المزامنة ثم حدّث الحالة. عدم الاتصال لا يعني أن آخر تعديل محفوظ على الخادم.')+'</div>';
 if(s){
  body+='<p class="system-caption">فُحصت الحالة: '+esc(systemTime(s.checkedAt))+' · الخادم '+esc(s.version)+'</p><div class="system-grid">';
  body+=card('النسخة المحلية على الخادم','<strong class="system-state">'+(b.latestVerified&&!b.overdue?'نسخة مفحوصة وحديثة':'تحتاج إلى تدخل')+'</strong>'+p('آخر نجاح: '+systemTime(b.lastSuccessAt))+p(b.latestVerified?'فُحصت النسخة الأحدث عند قراءة الحالة.':'لا توجد نسخة أحدث مؤكدة السلامة.')+(b.overdue?p('تنبيه: لا توجد نسخة مفحوصة أو مضى أكثر من 26 ساعة على آخر نجاح.'):'')+(b.error?p('مرجع المشكلة: '+b.error):''));
  body+=card('النسخ إلى مجلد خارجي','<strong class="system-state">'+(e.configured?(e.error?'تعذّر النسخ الخارجي':'المجلد مضبوط'):'غير مضبوط')+'</strong>'+p('آخر نسخ ناجح: '+systemTime(e.lastSuccessAt))+p('لا يثبت مسار المجلد أنه على جهاز آخر. تحقّق من القرص أو NAS أو خدمة المزامنة، واحتفظ بالمفتاح منفصلًا.'));
  body+=card('اختبار استعادة معزول','<strong class="system-state">'+(d&&d.status==='passed'?'نجح فحص الاستعادة':d?'تعذّر الاختبار':'لم يُجرَ بعد')+'</strong>'+p('آخر اختبار: '+systemTime(d&&d.finishedAt))+(s.drillDue?p('النسخة الأحدث تحتاج إلى اختبار، أو مرّ أسبوع على الاختبار.'):'')+p('عملية منفصلة ومجلد مؤقت: فك تشفير، فحص البنية، كتابة وإعادة قراءة. لا يختبر تشغيل المدرسة كاملًا ولا يغيّر بياناتها.'));
  body+='</div><div class="system-grid">'+card('الخادم والتخزين',p(s.storage.readable?'ملف البيانات مقروء وبنيته صالحة.':'تعذرت قراءة ملف البيانات أو فحص بنيته.')+p(s.storage.encrypted?'التخزين مشفّر على القرص.':'تحذير: لم يُؤكد تشفير ملف البيانات.')+p(s.storage.availableBytes===null?'المساحة المتاحة غير معروفة.':'المساحة المتاحة: '+(s.storage.availableBytes/1073741824).toFixed(1)+' GB')+p('قراءة ناجحة لا تضمن نجاح الكتابة التالية.'))+card('هذا الجهاز والمزامنة',p(dbWriteFailed?'الحفظ المحلي لم ينجح.':pendingDbWrites?'توجد كتابة محلية جارية.':'لا توجد كتابة محلية معلّقة معروفة.')+p('حالة المزامنة: '+({idle:'لا توجد عملية جارية',syncing:'إرسال جارٍ',error:'خطأ يحتاج إلى مراجعة',conflict:'تعارض يحتاج إلى مراجعة',attendance:'تأكيد جزئي لسجلات الحضور'}[cloudStatusPhase]||'غير مؤكدة'))+p('ضمان النشر بعد الحفظ يغطي رفع البيانات والحضور والاسترجاع؛ لا يغطي جميع مسارات الحسابات بعد.'))+'</div>';
 }
 body+='<section class="card system-card"><h2>فحص النسخ وتجربة استعادتها</h2><label for="systemBackupFile">نسخة محفوظة على الخادم</label><select id="systemBackupFile" '+disabled+' '+actionAttr('change',(event,el)=>{systemFile=el.value;systemCheck=null;systemNotice='';render();})+'><option value="">اختر نسخة</option>'+systemFiles.map(f=>'<option value="'+esc(f)+'" '+(f===systemFile?'selected':'')+'>'+esc(f)+'</option>').join('')+'</select><div class="system-actions">'+btn('فحص سلامة النسخة',()=>systemBackupAction('verify'))+btn('اختبار استعادة معزول',()=>systemBackupAction('drill'))+'</div>'+p('هذه الأزرار لا تسترجع النسخة إلى بيانات المدرسة. الاسترجاع الفعلي يستبدل البيانات ويتطلب فحصًا وتأكيدًا صريحًا في واجهة الخادم.')+(systemCheck?p(systemCheck):'')+'</section>';
 body+='<details class="card system-card"><summary>نطاق التشخيص والحماية</summary>'+p('التقرير يحتوي على إصدار التطبيق والخادم، أوقات الفحص والنسخ، حالات عامة وأكواد أخطاء محددة. لا يضم أسماء اللاعبين أو المدرسة أو الهواتف أو كلمات السر أو الرموز أو روابط الخادم أو مسارات الملفات.')+p('تعمل الصيانة التلقائية ما دام الخادم قيد التشغيل: فحص كل ساعة، نسخة يومية حتى دون تغيّر البيانات، واختبار النسخة الأحدث عند الحاجة. فتح Drive أو بدء التنزيل ليس دليلًا على اكتمال رفع نسخة خارج الجهاز.')+'</details></div>';
 return body;
}
async function systemRequest(path,extra){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch(syncApiUrl(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody(extra||{})),signal:controller.signal});const j=await r.json().catch(()=>null);if(!r.ok||!j||j.ok!==true){const id=j&&/^[a-f0-9-]{36}$/.test(j.requestId||'')?j.requestId:'';throw new Error(r.status===403?'هذه العملية للمدير فقط.':r.status===401?'انتهى الدخول أو بيانات المزامنة غير صحيحة.':'لم يؤكد الخادم اكتمال العملية.'+(id?' مرجع الطلب: '+id:''));}return j;}catch(e){if(e.name==='AbortError')throw new Error('انتهت مهلة الاتصال؛ لم يُؤكَّد اكتمال العملية. حدّث الحالة قبل إعادة المحاولة.');throw e;}finally{clearTimeout(timer);}
}
async function loadSystemStatus(){
 if(!canPage('system')){denied();return;}if(systemBusy)return;systemBusy=true;systemError='';systemNotice='';systemCheck=null;render();
 try{if(!syncReady())throw new Error('إعدادات المزامنة غير مكتملة. راجع الإعدادات ثم أعد الفحص.');systemStatus=cleanSystemStatus(await systemRequest('/api/admin/system/status'));const list=await systemRequest('/api/admin/backups/list');systemFiles=Array.isArray(list.backups)?list.backups.filter(f=>typeof f==='string'&&/^workspaces-[0-9TZ._-]+\.json$/.test(f)).slice(0,100):[];if(!systemFiles.includes(systemFile))systemFile=systemFiles[0]||'';
 }catch(e){systemStatus=null;systemFiles=[];systemFile='';systemError=/^(إعدادات|هذه العملية|انتهى الدخول|لم يؤكد|انتهت مهلة)/.test(e.message||'')?e.message:'تعذّر الاتصال بالخادم. الحالة غير مؤكدة؛ لم تُعدَّل بيانات المدرسة.';}finally{systemBusy=false;if(page==='system')render();}
}
async function systemBackupAction(kind){
 if(!canPage('system')){denied();return;}if(systemBusy)return;
 if(!syncReady()){systemError='إعدادات المزامنة غير مكتملة.';render();return;}
 if(kind!=='create'&&!systemFile){systemError='اختر نسخة أولًا.';render();return;}
 if(!['create','verify','drill'].includes(kind))return;
 systemBusy=true;systemError='';systemNotice='';systemCheck=null;render();
 try{const result=await systemRequest(kind==='create'?'/api/admin/backups':'/api/admin/backups/'+kind,{file:systemFile});
  systemCheck=kind==='verify'?(result.tracked?'نجح فحص البصمة وفك التشفير والبنية ووجود بيانات المدرسة.':'نجح فك التشفير وفحص البنية. نسخة قديمة دون بصمة مسجّلة؛ لا يتوفر خط أساس لمقارنتها.') :kind==='drill'?'نجح اختبار استعادة البيانات في العملية المعزولة. لم تتغيّر بيانات المدرسة.':null;
  systemNotice=kind==='create'?(result.externalCopied?'نجح إنشاء النسخة وفحصها ونسخها إلى المجلد الخارجي.':'نجح إنشاء النسخة المحلية وفحصها. راجع حالة النسخ الخارجي.'):'اكتملت العملية دون استرجاع بيانات المدرسة.';
  if(kind==='create')systemFile=result.file;
  systemStatus=cleanSystemStatus(await systemRequest('/api/admin/system/status'));const list=await systemRequest('/api/admin/backups/list');systemFiles=(Array.isArray(list.backups)?list.backups:[]).filter(f=>typeof f==='string'&&/^workspaces-[0-9TZ._-]+\.json$/.test(f)).slice(0,100);
 }catch(e){systemError=/^(هذه العملية|انتهى الدخول|لم يؤكد|انتهت مهلة)/.test(e.message||'')?e.message:'لم تكتمل العملية. راجع الاتصال أو حالة الخادم؛ لا تعتبر النسخة مؤكدة.';systemStatus=null;systemCheck=null;}finally{systemBusy=false;if(page==='system')render();}
}
function exportSystemDiagnostic(){
 if(!canPage('system')){denied();return;}
 const report={type:'malaabna-system-diagnostic',version:1,appVersion:APP_VERSION,generatedAt:new Date().toISOString(),client:{online:navigator.onLine===true,localWriteFailed:dbWriteFailed===true,pendingWrites:Math.max(0,Number(pendingDbWrites)||0),syncPhase:['idle','syncing','error','conflict','attendance'].includes(cloudStatusPhase)?cloudStatusPhase:'unknown'},server:systemStatus?cleanSystemStatus(systemStatus):null};
 dl('malaabna-diagnostic-'+todayISO()+'.json',JSON.stringify(report,null,2),'application/json');
}

function settingsPage(){
 const s=db.settings;
 return head('⚙️ الإعدادات','معلومات المدرسة والنسخ الاحتياطي — الإصدار '+APP_VERSION,'<button class="btn" '+actionAttr('click',()=>openManageAccountsModal())+'>🛡️ الحسابات والصلاحيات</button> <button class="btn primary" '+actionAttr('click',()=>openNewAccountModal())+'>＋ إضافة حساب</button>')+
  '<div class="card" style="max-width:720px"><div class="mb" style="padding:0">'+
  '<div class="mf"><label>اسم المدرسة</label><input id="s_school" value="'+esc(s.school)+'"></div>'+
  '<div class="mf"><label>الهاتف</label><input id="s_phone" value="'+esc(s.phone)+'"></div>'+
  '<div class="mf full"><label>العنوان</label><input id="s_address" value="'+esc(s.address)+'"></div>'+
  '<div class="mf"><label>الاشتراك الافتراضي</label><input id="s_fee" type="number" step="0.01" value="'+esc(s.fee)+'"></div>'+
  '<div class="mf"><label>رسوم التسجيل لمرة واحدة</label><input id="s_registrationFee" type="number" min="0" step="0.01" value="'+esc(s.registrationFee||0)+'"></div>'+
  '<div class="mf"><label>العملة</label><input id="s_currency" value="'+esc(s.currency)+'"></div>'+
  '<div class="mf"><label>مفتاح الدولة للواتساب (مثال: 212)</label><input id="s_cc" value="'+esc(s.cc||'212')+'"></div>'+
  '<div class="mf full"><label>نص التزام وموافقة ولي الأمر</label><textarea id="s_consentText">'+esc(s.consentText||'')+'</textarea></div>'+
  '</div><div style="margin-top:16px"><button class="btn primary" '+actionAttr('click',()=>saveSettings())+'>حفظ</button></div></div>'+
  '<h2 class="sec">لوغو المدرسة</h2>'+
  '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">'+imgBox('logo','⚽ لوغو المدرسة','PNG أو JPG — يظهر في كل الوثائق')+imgBox('stamp','🖋️ التوقيع والختم','يُطبع أسفل الوصل')+'</div>'+
  '<h2 class="sec">🔄 المزامنة بين الأجهزة (خادم حقيقي)</h2>'+
  '<div class="card" style="max-width:720px"><div class="mb" style="padding:0">'+
  '<div class="mf full"><label>رابط الخادم</label><input id="s_serverUrl" placeholder="'+DEFAULT_SERVER+'" value="'+esc(s.serverUrl||'')+'"></div>'+
  '<div class="mf"><label>رمز المدرسة</label><input id="s_syncCode" placeholder="مثال: A1B2C3D4" style="text-transform:uppercase" value="'+esc(s.syncCode||'')+'"></div>'+
  '<div class="mf"><label>كلمة السر السرية</label><input id="s_syncSecret" type="password" autocomplete="off" value="'+esc(s.syncSecret||'')+'"></div>'+
  '<div class="mf full"><label>اسم هذا الجهاز</label><input id="s_device" placeholder="مثال: حاسوب الإدارة / حاسوب المدرب" value="'+esc(s.device||deviceName())+'"></div>'+
  '</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'+
  '<button class="btn primary" '+actionAttr('click',()=>saveSettings())+'>حفظ</button>'+
  (s.syncCode?'':'<button class="btn" '+actionAttr('click',()=>createWorkspace())+'>🆕 إنشاء مساحة مزامنة جديدة لهذه المدرسة</button>')+
  '<button class="btn" '+actionAttr('click',()=>cloudPush())+'>⬆️ رفع بيانات هذا الجهاز</button>'+
  '<button class="btn" '+actionAttr('click',()=>cloudPull())+'>⬇️ جلب آخر نسخة</button>'+
  (s.syncCode?'<button class="btn danger" '+actionAttr('click',()=>rotateSecret())+'>🔑 تجديد كلمة السر</button>':'')+
  '</div>'+
  '<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">'+
  '<label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" '+(s.syncAuto?'checked':'')+' '+actionAttr('change',async (event,el)=>{db.settings.syncAuto=el.checked;if(!await save())return;render()})+'><span><b>رفع تلقائي</b> بعد كل تعديل (خلال ثوانٍ)</span></label>'+
  '<label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" '+(s.syncOpen?'checked':'')+' '+actionAttr('change',async (event,el)=>{db.settings.syncOpen=el.checked;if(!await save())return;render()})+'><span><b>جلب تلقائي</b> عند فتح التطبيق (إذا كانت نسخة السحابة أحدث)</span></label></div>'+
  '<div class="card" style="margin-top:14px;background:var(--soft)"><b>💬 واتساب التلقائي (WhatsApp Cloud API)</b>'+
  '<div class="sub" style="margin:6px 0">يُرسل الخادم الرسائل مباشرة دون فتح واتساب. يتطلب حساب Meta Business وإعداد الخادم (server/README.md). تنتقل أسماء وأرقام أولياء الأمور إلى Meta.</div>'+
  '<label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" '+(s.waCloud?'checked':'')+' '+actionAttr('change',(event,el)=>waCloudToggle('waCloud',el.checked))+'><span><b>تفعيل الإرسال الحقيقي</b> (مسح QR والإرسال اليدوي للشكر يمرّان عبر الخادم)</span></label>'+
  '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;margin-top:8px"><input type="checkbox" '+(s.waAutoThx?'checked':'')+' '+actionAttr('change',(event,el)=>waCloudToggle('waAutoThx',el.checked))+'><span><b>إرسال وصل الأداء تلقائياً</b> عند حفظ اشتراك فيه مبلغ مدفوع</span></label>'+
  '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" '+actionAttr('click',()=>waCloudCheck())+'>اختبار إعداد الخادم</button><span id="waCloudMsg" class="sub"></span></div></div>'+
  '<div id="syncMsg" class="sub" style="margin-top:10px">'+esc(syncMsg||(s.syncLast?'آخر مزامنة: '+s.syncLast:'لم تتم أي مزامنة بعد'))+'</div>'+
  syncConflictHTML()+
  '<div class="sub" style="margin-top:12px;line-height:1.9"><b>طريقة الإعداد:</b><br>1) شغّل خادم المزامنة المرفق (مجلد <code>server/</code>) على حاسوب يبقى مُشغَّلاً، واربطه بالإنترنت عبر Cloudflare Tunnel حسب الدليل المرفق، ثم ضع رابطه أعلاه في «رابط الخادم».<br>2) من <b>أول</b> جهاز فقط، اضغط «إنشاء مساحة مزامنة جديدة» — سيولّد لك التطبيق <b>رمز المدرسة</b> و<b>كلمة سر</b> تلقائياً.<br>3) انسخ الرمز وكلمة السر ذاتهما إلى باقي الأجهزة (من نفس هذه الصفحة، بعد «حفظ»)، ثم اضغط «جلب آخر نسخة» في كل جهاز إضافي.<br>4) بعد ذلك، «رفع» و«جلب» يعملان تلقائياً (أو يدوياً بالأزرار) بين كل الأجهزة المشتركة في نفس الرمز.<br>⚠️ احتفظ بكلمة السر في مكان آمن — من يملكها يستطيع الوصول لكل بيانات المدرسة. إذا شككت في تسربها اضغط «تجديد كلمة السر».<br>⚠️ المزامنة تستبدل النسخة بالكامل — ارفع دائماً من الجهاز صاحب أحدث بيانات.</div></div>'+
  '<h2 class="sec">🔐 الصلاحيات (مدير / مدرب)</h2>'+
  '<div class="card" style="max-width:720px">'+
  '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;margin-bottom:12px"><input type="checkbox" '+(s.lock?'checked':'')+' '+actionAttr('change',async (event,el)=>{db.settings.lock=el.checked;if(!await save())return;render()})+'><span><b>تفعيل تسجيل الدخول</b> برمز سري عند فتح التطبيق</span></label>'+
  '<div class="mb" style="padding:0">'+
  '<div class="mf"><label>رمز المدير (صلاحيات كاملة)</label><input id="s_pinAdmin" type="password" inputmode="numeric" minlength="4" autocomplete="new-password" value="'+esc(s.pinAdmin||'')+'" placeholder="4 أرقام أو أكثر"></div>'+
  '<div class="mf"><label>رمز المدرب (الحضور فقط)</label><input id="s_pinCoach" type="password" inputmode="numeric" minlength="4" autocomplete="new-password" value="'+esc(s.pinCoach||'')+'" placeholder="4 أرقام أو أكثر"></div>'+
  '</div><div style="margin-top:10px"><button class="btn primary" '+actionAttr('click',()=>saveSettings())+'>حفظ الرموز</button></div>'+
  '<div class="sub" style="margin-top:12px;line-height:1.9"><b>حساب المدرب يرى ويستعمل فقط:</b> الحضور ✅، مسح QR 📷، لائحة اللاعبين والتداريب (للاطلاع فقط دون تعديل أو حذف).<br>المالية والاشتراكات والوصولات والإعدادات والتقارير — للمدير فقط.<br>🧑‍🏫 <b>رمز خاص لكل مدرب:</b> من صفحة «المدربون» أضف لكل مدرب <b>رمز الدخول الخاص</b> و<b>الفئات المشرف عليها</b> (مثال: U11، U13)، فلا يرى إلا لاعبي فئاته وحضورهم.<br>الرمز العام أعلاه يعطي حضور كل الفئات.<br>⚠️ إذا تركت رمز المدير فارغاً فلن تكون هناك حماية فعلية.</div></div>'+
  '<h2 class="sec">النسخ الاحتياطي</h2><div class="card" style="max-width:720px;display:flex;gap:8px;flex-wrap:wrap">'+
  '<button class="btn" '+actionAttr('click',()=>exportJSON(undefined,true))+'>⬇️ تصدير نسخة مشفّرة قابلة للنقل</button>'+
  '<label class="btn">⬆️ استيراد نسخة<input type="file" accept=".malaabna,application/json" style="display:none" '+actionAttr('change',(event,el)=>importJSON(el))+'></label>'+
  '<button class="btn" '+actionAttr('click',()=>exportCSV())+'>📄 تصدير لائحة اللاعبين (CSV)</button>'+
  '<button class="btn" '+actionAttr('click',()=>downloadImportTemplate())+'>📑 نموذج استيراد Excel</button>'+
  '<label class="btn">📥 استيراد Excel / CSV<input type="file" accept=".csv,.xls,text/csv,application/vnd.ms-excel" style="display:none" '+actionAttr('change',(event,el)=>importExcel(el))+'></label>'+
  '<button class="btn primary" '+actionAttr('click',()=>driveBackup())+'>☁️ نسخة إلى Google Drive</button>'+
  '<button class="btn danger" '+actionAttr('click',()=>resetAllData())+'>🗑️ تفريغ البيانات</button></div>'+
  '<div class="card" style="max-width:720px;margin-top:12px"><b>💾 نسخة احتياطية تلقائية</b>'+
  '<div class="mf full" style="margin-top:8px"><label>التكرار</label><select '+actionAttr('change',(event,el)=>setBkFreq(el.value))+'>'+
   '<option value="weekly" '+((s.bkFreq||'weekly')==='weekly'?'selected':'')+'>أسبوعية (موصى بها)</option>'+
   '<option value="daily" '+(s.bkFreq==='daily'?'selected':'')+'>يومية</option>'+
   '<option value="off" '+(s.bkFreq==='off'?'selected':'')+'>معطّلة</option></select></div>'+
  '<div class="sub" style="line-height:1.9">النسخة التلقائية مشفّرة بمفتاح هذا الجهاز ولا تُستعاد على جهاز آخر. لنسخة قابلة للنقل أو الحفظ في Drive، استعمل «تصدير نسخة مشفّرة قابلة للنقل» واحتفظ بعبارة النسخة منفصلة.<br>آخر طلب تنزيل تلقائي (غير مؤكّد على القرص): <b id="bkLast">'+esc(s.bkLast||'—')+'</b></div>'+
  '<div style="margin-top:10px"><button class="btn" '+actionAttr('click',()=>autoBackup(true,true))+'>💾 أخذ نسخة الآن</button></div></div>'+
  '<h2 class="sec">☁️ ربط Google Drive</h2>'+
  '<div class="card" style="max-width:720px"><b>الأسهل: مجلد Drive في الحاسوب (بلا كود)</b>'+
  '<div class="sub" style="margin-top:8px;line-height:1.9">1) ثبّت <b>Google Drive for desktop</b> من google.com/drive/download.<br>2) أنشئ داخل <b>My Drive</b> مجلداً باسم <b>FootballSchool</b>.<br>3) في Chrome: الإعدادات ← التنزيلات ← اجعل مجلد التنزيل هو ذلك المجلد.<br>4) ارفع النسخ اليدوية القابلة للنقل فقط؛ النسخ التلقائية مرتبطة بمفتاح الجهاز.<br>على الأندرويد: عند التصدير اختر «حفظ في Drive».</div></div>'+
  '<div class="card" style="max-width:720px;margin-top:16px"><b>التثبيت كتطبيق</b><div class="sub" style="margin-top:8px">ويندوز: افتح الملف في Chrome أو Edge ثم <b>تثبيت التطبيق</b> من شريط العنوان.<br>أندرويد: افتح الملف في Chrome ثم <b>إضافة إلى الشاشة الرئيسية</b>. تشتغل بدون إنترنت، والبيانات محفوظة داخل الجهاز.</div></div>';
}
async function saveSettings(){const pa=document.getElementById('s_pinAdmin'),pc=document.getElementById('s_pinCoach');for(const e of [pa,pc]){if(e&&e.value&&e.value.trim().length<4){alert('الرمز السري يجب أن يتكون من 4 خانات على الأقل.');e.focus();return;}}['school','phone','address','fee','registrationFee','currency','cc','consentText','bkFreq','serverUrl','syncCode','syncSecret','device','pinAdmin','pinCoach'].forEach(k=>{const e=document.getElementById('s_'+k);if(e)db.settings[k]=e.value;});if(db.settings.syncCode)db.settings.syncCode=String(db.settings.syncCode).trim().toUpperCase();if(db.settings.serverUrl)db.settings.serverUrl=String(db.settings.serverUrl).trim().replace(/\/+$/,'');auditAdd('تحديث الإعدادات','معلومات المدرسة أو الحماية أو المزامنة');if(!await save())return;render();}
function bkFreqDays(){const f=db.settings.bkFreq||'weekly';return f==='daily'?1:(f==='weekly'?7:0);}
function bkDue(){
 const n=bkFreqDays();if(!n)return false;
 const last=db.settings.bkLast||'';
 if(!last)return true;
 const d=Math.round((new Date(todayISO())-new Date(last))/86400000);
 return d>=n;
}
async function autoBackup(force,portable){
 try{
  if(!force&&!bkDue())return;
  const done=await exportJSON(undefined,!!portable);if(!done)return;
  db.settings.bkLast=todayISO();
  await persistDbSnapshot();
  if(typeof syncToast==='function')syncToast('💾 أُنشئ الملف وطُلب تنزيله. تأكد من وجوده وافحص استعادته؛ التنزيل غير مؤكّد.');
  const e=document.getElementById('bkLast');if(e)e.textContent=db.settings.bkLast;
 }catch(e){alert('تعذر إنشاء النسخة المشفّرة: '+(e.message||'خطأ غير معروف'));}
}
async function setBkFreq(v){db.settings.bkFreq=v;if(!await save())return;render();}
function dl(name,content,type){const b=new Blob([content],{type:type});const a=document.createElement('a');const u=URL.createObjectURL(b);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
function exportPDF(name,landscape){
 if(window.electronAPI&&window.electronAPI.printPDF){
  window.electronAPI.printPDF({filename:name||'malaabna.pdf',landscape:!!landscape}).then(function(r){if(r&&!r.ok&&!r.canceled)alert(r.message||'تعذر إنشاء ملف PDF.');}).catch(function(e){alert('تعذر إنشاء PDF: '+e.message);});
 }else{window.print();}
}
function excelValue(v){return v==null?'':String(v);}
function exportExcel(name,sheets){
 const list=Array.isArray(sheets)?sheets:[];
 let body='<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial;direction:rtl}table{border-collapse:collapse;margin:0 0 24px;width:100%}caption{font-size:18px;font-weight:bold;text-align:right;padding:8px;background:#14538f;color:#fff}th,td{border:1px solid #c9d3dc;padding:6px;text-align:right}th{background:#e5f2fc;font-weight:bold}</style></head><body dir="rtl">';
 list.forEach(function(sh){body+='<table><caption>'+esc(sh.title||'تقرير')+'</caption><thead><tr>'+(sh.headers||[]).map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+(sh.rows||[]).map(function(row){return '<tr>'+row.map(function(v){return '<td>'+esc(excelValue(v))+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';});
 body+='</body></html>';
 dl((name||'malaabna')+'.xls','\ufeff'+body,'application/vnd.ms-excel;charset=utf-8');
}
async function exportJSON(name,portable){
 let files={};try{files=await idbAll();}catch(e){}
 const out=Object.assign({},db,{__meta:{app:'football-school',version:3,exportedAt:new Date().toISOString()},__files:files});
 const clear=JSON.stringify(out,null,1);let sealed,filename=name||('backup-'+todayISO()+'.malaabna');
 if(portable){
  const phrase=prompt('أنشئ عبارة للنسخة الاحتياطية (12 حرفاً على الأقل). احتفظ بها؛ لا يمكن استرجاعها.');
  if(phrase===null)return false;
  if(phrase.length<12){alert('عبارة النسخة يجب أن تتكون من 12 حرفاً على الأقل.');return false;}
  const confirmPhrase=prompt('أعد إدخال عبارة النسخة للتأكيد.');if(confirmPhrase!==phrase){alert('العبارتان غير متطابقتين؛ أُلغيت النسخة.');return false;}
  sealed=await window.encryptPortableBackup(clear,phrase);
 }else sealed=await window.encryptMalaabnaFile(clear);
 filename=filename.replace(/\.json$/i,'.malaabna');
 dl(filename,JSON.stringify(sealed), 'application/json');return true;
}
function importJSON(el){const f=el.files[0];if(!f)return;const r=new FileReader();r.onload=async e=>{try{
 let envelope=JSON.parse(e.target.result),plain='';
 if(envelope&&envelope.__malaabnaBackup===1){const phrase=prompt('أدخل عبارة هذه النسخة الاحتياطية.');if(phrase===null){el.value='';return;}plain=await window.decryptPortableBackup(envelope,phrase);}
 else if(envelope&&envelope.__vaultFile===1)plain=await window.decryptMalaabnaFile(envelope);
 else{if(!confirm('هذه نسخة JSON قديمة غير مشفّرة. استيرادها قد يكشف بيانات حساسة. متابعة؟')){el.value='';return;}plain=JSON.stringify(envelope);}
 const j=JSON.parse(plain);if(!validateImport(j))throw new Error('البنية غير متوافقة');
 if(!confirm('سيتم استبدال بيانات هذا الجهاز. متابعة؟')){el.value='';return;}
 if(!await exportJSON('before-import-'+todayISO()+'.malaabna',true)){el.value='';return;}
 const files=j.__files||{};delete j.__files;delete j.__meta;for(const k in files){try{await idbPut(k,files[k]);}catch(x2){}}
 db=Object.assign(JSON.parse(JSON.stringify(blank)),j);migrateSalaryAdvancePlans();auditAdd('استيراد نسخة','الملف: '+f.name);if(!await save())return;alert('تم الاستيراد بنجاح');render();
 }catch(x){alert('تعذر فك النسخة أو أن الملف غير صالح: '+x.message);}finally{el.value='';}};r.onerror=()=>{alert('تعذر قراءة الملف');el.value='';};r.readAsText(f);}

function validateImport(j){if(!j||typeof j!=='object')return false;const copy=Object.assign({},j);delete copy.__files;delete copy.__meta;return validDbShape(copy);}
async function resetAllData(){if(!confirm('سيتم تنزيل نسخة احتياطية ثم مسح جميع البيانات. هل تريد المتابعة؟'))return;const phrase=prompt('للتأكيد اكتب كلمة: مسح');if(phrase!=='مسح'){alert('تم إلغاء العملية.');return;}if(!await exportJSON('before-reset-'+todayISO()+'.malaabna',true))return;localStorage.removeItem(KEY);db=seed();auditAdd('تهيئة البيانات','تم تفريغ قاعدة البيانات بعد أخذ نسخة');if(!await save())return;render();}
function exportCSV(){
 const h=['الاسم','الفئة','الفريق','المركز','رقم القميص','ولي الأمر','الهاتف','الحالة'];
 const rows=db.players.map(p=>[p.name,p.cat,refName('teams',p.team),p.pos,p.shirt,refName('parents',p.parent),canSeeSensitive()?p.pphone:'',p.status]);
 dl('players-'+todayISO()+'.csv','\ufeff'+[h].concat(rows).map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv');
}


function downloadImportTemplate(){const rows=[['الاسم','الفئة','الفريق','تاريخ الازدياد','المركز','رقم القميص','اسم ولي الأمر','هاتف ولي الأمر','الحالة','الاشتراك الشهري'],['مثال: محمد العلوي','U11','','2015-05-10','مهاجم','9','أحمد العلوي','0612345678','نشط','150']];dl('players-import-template-'+todayISO()+'.csv','\ufeff'+rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n'),'text/csv');}
function parseCSVRows(text){const rows=[],re=/(\,|\n|\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^"\,\n\r]*))/g;let row=[],m,last=0;while((m=re.exec(text))){if(m[1]==='\n'||m[1]==='\r'){if(row.length){rows.push(row);row=[];}}row.push(m[2]!==undefined?m[2].replace(/""/g,'"'):m[3]);last=re.lastIndex;}if(row.length)rows.push(row);return rows.filter(function(r){return r.some(function(x){return String(x||'').trim();});});}
function parseSpreadsheetRows(text){if(/<table[\s>]/i.test(text)){const doc=new DOMParser().parseFromString(text,'text/html');return Array.from(doc.querySelectorAll('tr')).map(function(tr){return Array.from(tr.querySelectorAll('th,td')).map(function(td){return td.textContent.trim();});}).filter(function(r){return r.length;});}return parseCSVRows(text);}
function importExcel(el){const f=el.files&&el.files[0];if(!f)return;const rd=new FileReader();rd.onload=async function(e){try{const rows=parseSpreadsheetRows(String(e.target.result||''));if(rows.length<2)throw new Error('الملف فارغ أو لا يحتوي على صفوف.');const h=rows[0].map(function(x){return String(x||'').trim().toLowerCase();});const get=function(row,names){const i=names.map(function(x){return h.indexOf(x);}).find(function(x){return x>=0;});return i>=0?String(row[i]||'').trim():'';};let added=0,parents=0,teams=0;const incoming=rows.slice(1);if(!confirm('سيتم استيراد '+incoming.length+' صفاً وإنشاء أولياء الأمور والفرق غير الموجودة تلقائياً. متابعة؟'))return;incoming.forEach(function(row){const name=get(row,['الاسم','اسم اللاعب','اللاعب','name']);if(!name)return;const cat=get(row,['الفئة','الفئة العمرية','cat']);let teamName=get(row,['الفريق','اسم الفريق','team']);let team=db.teams.find(function(x){return x.name===teamName||x.id===teamName;});if(teamName&&!team){team={id:uid(),name:teamName,cat:cat||'',fee:Number(get(row,['الاشتراك الشهري','fee']))||Number(db.settings.fee)||0,status:'نشط'};db.teams.push(team);teams++;}const pn=get(row,['اسم ولي الأمر','ولي الأمر','الولي','parent']);let par=pn?db.parents.find(function(x){return x.name===pn;}):null;if(pn&&!par){par={id:uid(),name:pn,rel:'الأب',phone:get(row,['هاتف ولي الأمر','هاتف الولي','الهاتف','phone']),portalCode:'',att:[],notes:'أضيف من استيراد Excel'};db.parents.push(par);parents++;}if(db.players.some(function(x){return String(x.name||'').trim()===name&&(!get(row,['تاريخ الازدياد','birth'])||x.birth===get(row,['تاريخ الازدياد','birth']))}))return;db.players.push({id:uid(),name:name,cat:cat,team:team?team.id:'',birth:get(row,['تاريخ الازدياد','birth']),pos:get(row,['المركز','position']),shirt:get(row,['رقم القميص','القميص','shirt'])||'',parent:par?par.id:'',pphone:get(row,['هاتف ولي الأمر','هاتف الولي','الهاتف','phone']),fee:Number(get(row,['الاشتراك الشهري','fee']))||'',reg:todayISO(),status:get(row,['الحالة','status'])||'نشط',consentStatus:'في انتظار الموافقة',att:[],notes:'أضيف من استيراد Excel'});added++;});auditAdd('استيراد لاعبين','الصفوف المضافة: '+added+' — أولياء الأمور: '+parents+' — الفرق: '+teams);if(!await save())return;alert('تم الاستيراد بنجاح: '+added+' لاعب، '+parents+' ولي أمر، '+teams+' فريق.');render();}catch(x){alert('تعذر استيراد الملف: '+x.message);}finally{el.value='';}};rd.readAsText(f,'UTF-8');}

/* ================= التسجيل الذكي بالوثائق ================= */
let docScanFiles=[],docScanBusy=false,docPdfBusy=false,docScanRaw='',geminiModel=localStorage.getItem('fsm_gemini_model')||'',geminiKeyCache='';
try{geminiKeyCache=String(window.__malaabnaGeminiKey||'');}catch(e){}
function geminiKey(){return geminiKeyCache;}
async function hydrateGeminiKey(){try{if(window.electronAPI&&window.electronAPI.getGeminiKey)geminiKeyCache=String(await window.electronAPI.getGeminiKey()||'');}catch(e){}}
const DOC_TYPES=[['birth','عقد الازدياد / رسم الولادة'],['cin','البطاقة الوطنية لولي الأمر'],['medical','الشهادة الطبية'],['other','وثيقة أخرى']];
function docScanPage(){
 const teamOpts='<option value="">— اختر الفريق —</option>'+db.teams.filter(x=>x.status!=='متوقف').map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+' — '+esc(x.cat||'')+'</option>').join('');
 return head('📄 التسجيل الذكي بالوثائق','إنشاء اللاعب وولي الأمر بعد قراءة الوثائق محلياً')+
  '<div class="notice" style="margin-bottom:16px"><b>الوضع السريع بـ Gemini:</b> أدخل مفتاح API داخل البرنامج، ثم تُرسل الصور إلى Google لاستخراج البيانات. يُحفظ المفتاح في التخزين الآمن لنظام التشغيل داخل تطبيق سطح المكتب، وفي جلسة المتصفح فقط في نسخة الهاتف، ولا يُدمج داخل ملف البرنامج. راجع البيانات دائماً قبل الحفظ.</div>'+
  '<div class="card" style="margin-bottom:16px"><div class="top" style="margin:0"><div><b>مفتاح Gemini API</b><div class="sub">ألصقه هنا داخل جهازك فقط، ولا ترسله في المحادثة.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="gKey" type="password" autocomplete="off" placeholder="AIza…" value="'+esc(geminiKey())+'" style="min-height:44px;border:1px solid var(--bd);border-radius:8px;padding:0 12px;min-width:260px"><button class="btn" '+actionAttr('click',()=>geminiSaveKey())+'>اختبار وحفظ على الجهاز</button><button class="btn danger" '+actionAttr('click',()=>geminiForgetKey())+'>حذف المفتاح</button></div></div><div id="gKeyStatus" class="sub" role="status" aria-live="polite" style="margin-top:8px">'+(geminiKey()?'✅ المفتاح محفوظ على هذا الجهاز':'لم يُدخل المفتاح بعد')+'</div></div>'+
  '<div class="card" style="margin-bottom:16px"><div class="top" style="margin:0">'+
   '<div><b>1. أضف صور الوثائق</b><div class="sub">عقد الازدياد، واجهة وظهر بطاقة ولي الأمر، والشهادة الطبية عند توفرها. بعد الرفع يمكنك تحديد إطار كل وثيقة وقصّ الحواف محلياً قبل القراءة.</div></div>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" '+actionAttr('click',()=>docCameraOpen())+'>📷 ماسح الوثائق بالكاميرا</button><label class="btn">⬆️ رفع صور<input type="file" accept="image/*" capture="environment" multiple style="display:none" '+actionAttr('change',(event,el)=>docAddFiles(el))+'></label></div></div>'+
   '<div id="docFiles" class="scan-docs" style="margin-top:14px">'+docFilesHTML()+'</div>'+
   '<div class="doc-scan-actions"><button class="btn primary" id="geminiRun" '+actionAttr('click',()=>geminiRunOCR())+' '+(!docScanFiles.length||docScanBusy?'disabled':'')+'>✨ قراءة سريعة بـ Gemini</button><button class="btn" id="ocrRun" '+actionAttr('click',()=>docRunOCR())+' '+(!docScanFiles.length||docScanBusy?'disabled':'')+'>قراءة محلية احتياطية</button><button class="btn" '+actionAttr('click',()=>docExportPdf())+' '+(!docScanFiles.length||docPdfBusy?'disabled':'')+'>⬇️ تنزيل PDF متعدد الصفحات</button><button class="btn danger" '+actionAttr('click',()=>docClear())+' '+(!docScanFiles.length?'disabled':'')+'>مسح الصور</button></div>'+
   '<div id="ocrStatus" class="sub" role="status" aria-live="polite" style="margin-top:10px">'+(docScanFiles.length?'جاهز لقراءة '+docScanFiles.length+' وثيقة.':'أضف صورة واضحة ومسطحة لكل وثيقة.')+'</div>'+
   '<div class="ocr-progress" style="margin-top:8px"><span id="ocrBar"></span></div></div>'+
  '<div class="card"><b>2. راجع البيانات المستخرجة</b><div class="sub" style="margin:4px 0 14px">الحقول القابلة للتعديل؛ لن يُنشأ أي ملف قبل الضغط على زر الحفظ.</div>'+
   '<div class="ocr-fields">'+
    ocrField('o_playerName','اسم اللاعب الكامل','text',1)+ocrField('o_birth','تاريخ ازدياد اللاعب','date')+
    ocrField('o_birthPlace','مكان الازدياد')+'<div class="mf"><label for="o_team">الفريق</label><select id="o_team">'+teamOpts+'</select></div>'+
    ocrField('o_parentName','اسم ولي الأمر الكامل','text',1)+ocrField('o_parentCin','رقم البطاقة الوطنية')+
    ocrField('o_phone','هاتف ولي الأمر','tel')+ocrField('o_address','العنوان')+
    ocrField('o_medExp','انتهاء الشهادة الطبية','date')+
    '<div class="mf"><label for="o_relation">صفة ولي الأمر</label><select id="o_relation"><option>الأب</option><option>الأم</option><option>وصي</option></select></div>'+
    '<div class="mf full ocr-result-field"><div class="ocr-result-head"><label for="o_raw">النص المستخرج الكامل (للمراجعة والنسخ)</label><button class="btn sm ocr-copy-btn" '+actionAttr('click',()=>copyDocOCRText())+'>📋 نسخ النص</button></div><textarea id="o_raw" style="min-height:150px" placeholder="سيظهر النص بعد القراءة">'+esc(docScanRaw)+'</textarea><div id="ocrCopyStatus" class="ocr-copy-status" role="status" aria-live="polite"></div><div class="sub">القراءة المحلية تدعم العربية والفرنسية والإنجليزية. لتصحيح OCR وتطبيقه على البيانات، عدّل النص داخل بطاقة الوثيقة واضغط «تطبيق النص المعدل».</div></div>'+
   '</div><div class="doc-retention"><b>🔒 خصوصية الوثائق</b><div>افتراضيًا لن تُحفظ الصور بعد إتمام التسجيل. فعّل الخيار أدناه فقط إذا أردت إرفاقها بملف اللاعب أو وليّ الأمر؛ عندها تُحفظ داخل التطبيق وقد تدخل ضمن النسخ الاحتياطية أو المزامنة بحسب إعداداتك.</div><label><input id="oKeepDocs" type="checkbox"> أوافق على الاحتفاظ بنسخ الوثائق وإرفاقها بالملف</label><div class="sub">تُحذف الملفات غير المرتبطة تلقائيًا عند تنظيف التخزين. يمكن استبدال المرفقات أو حذفها لاحقًا من تعديل ملف اللاعب أو ولي الأمر.</div></div><div style="margin-top:16px"><button class="btn primary" '+actionAttr('click',()=>docCreateRecords())+'>✅ إنشاء اللاعب وولي الأمر'+(docScanFiles.length?' وربط الوثائق':'')+'</button></div></div>';
}
function copyDocOCRText(){
 const textarea=document.getElementById('o_raw'),status=document.getElementById('ocrCopyStatus'),text=String(textarea?textarea.value:docScanRaw||'');
 if(!text.trim()){if(status)status.textContent='لا يوجد نص مستخرج لنسخه بعد.';return;}
 const copied=()=>{if(status)status.textContent='✅ تم نسخ النص المستخرج.';syncToast('✅ تم نسخ النص المستخرج');};
 const selected=()=>{if(textarea){textarea.focus();textarea.select();try{textarea.setSelectionRange(0,textarea.value.length);}catch(e){}}};
 (async function(){
  try{if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);copied();return;}}catch(e){}
  selected();
  try{if(document.execCommand&&document.execCommand('copy')){copied();return;}}catch(e){}
  if(status)status.textContent='تعذر النسخ التلقائي؛ تم تحديد النص. اضغط Ctrl+C لنسخه.';
 })();
}
function ocrField(id,label,type,req){return '<div class="mf"><label for="'+esc(id)+'">'+label+(req?' <span class="req">*</span>':'')+'</label><input id="'+esc(id)+'" type="'+esc(type||'text')+'" '+(req?'required aria-required="true"':'')+'></div>';}
function docFilesHTML(){if(!docScanFiles.length)return '<div class="empty" style="grid-column:1/-1">لم تُضف وثائق بعد.</div>';return docScanFiles.map((f,i)=>'<div class="scan-doc"><img src="'+safeImg(f.data)+'" alt="معاينة '+esc(f.name)+'"><select aria-label="نوع الوثيقة" '+actionAttr('change',(event,el)=>{docScanFiles[i].type=el.value;})+'><option value="birth" '+(f.type==='birth'?'selected':'')+'>عقد الازدياد / رسم الولادة</option><option value="cin" '+(f.type==='cin'?'selected':'')+'>البطاقة الوطنية لولي الأمر</option><option value="medical" '+(f.type==='medical'?'selected':'')+'>الشهادة الطبية</option><option value="other" '+(f.type==='other'?'selected':'')+'>وثيقة أخرى</option></select><div class="doc-scan-actions"><button class="btn sm primary" '+actionAttr('click',()=>docScanEditorOpen(i))+'>🪄 تصحيح وتحسين</button><button class="btn sm" '+actionAttr('click',()=>docCropOpen(i))+'>✂️ قص يدوي</button><button class="btn sm" '+actionAttr('click',()=>docRotate(i))+'>↻ تدوير</button><button class="btn sm danger" '+actionAttr('click',()=>docRemove(i))+'>حذف</button></div>'+(f.text?'<details class="scan-doc-ocr"><summary>📝 مراجعة نص OCR — دقة '+Number(f.confidence||0)+'%</summary><textarea id="docOcrText'+i+'" aria-label="النص المستخرج من '+esc(f.name)+'" dir="auto">'+esc(f.text)+'</textarea><button class="btn sm" '+actionAttr('click',()=>docApplyOCRFile(i))+'>تطبيق النص المعدل على الحقول</button></details>':'')+'<div class="sub" style="margin-top:6px;overflow:hidden;text-overflow:ellipsis">'+esc(f.name)+'</div></div>').join('');}
function guessDocType(name,i){const n=String(name||'').toLowerCase();if(/medical|médical|طبي/.test(n))return'medical';if(/cin|carte|بطاق/.test(n))return'cin';if(/birth|naissance|ولاد|ازدياد/.test(n))return'birth';return i===0?'birth':'cin';}
function imageData(file,max){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=e=>{const im=new Image();im.onerror=()=>res(e.target.result);im.onload=()=>{let w=im.width,h=im.height,k=Math.min(1,(max||3000)/Math.max(w,h));w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d',{willReadFrequently:true}).drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',.92));};im.src=e.target.result;};r.readAsDataURL(file);});}
async function docAddFiles(el){const fs=Array.from(el.files||[]);for(let i=0;i<fs.length;i++){if(!String(fs[i].type).startsWith('image/'))continue;if(fs[i].size>12*1048576){alert('الصورة '+fs[i].name+' أكبر من 12 م.ب.');continue;}const data=await imageData(fs[i],3000);docScanFiles.push({name:fs[i].name,type:guessDocType(fs[i].name,docScanFiles.length),data,text:'',confidence:0});}el.value='';render();}
let docCameraLayer=null,docCameraStream=null,docCameraTorch=false,docCameraTimer=null,docCameraProbe=null,docCameraStableFrames=0,docCameraLastQuad=null,docCameraAutoCaptured=false,docCameraCaptureBusy=false;
function docCameraClose(){
 if(docCameraTimer){clearInterval(docCameraTimer);docCameraTimer=null;}
 if(docCameraStream){docCameraStream.getTracks().forEach(function(track){track.stop();});docCameraStream=null;}
 docCameraTorch=false;docCameraProbe=null;docCameraStableFrames=0;docCameraLastQuad=null;docCameraAutoCaptured=false;docCameraCaptureBusy=false;
 if(docCameraLayer){docCameraLayer.remove();docCameraLayer=null;}
}
async function docCameraTune(track){
 try{
  const caps=track&&track.getCapabilities?track.getCapabilities():{},advanced={};
  if(Array.isArray(caps.focusMode)&&caps.focusMode.includes('continuous'))advanced.focusMode='continuous';
  if(Array.isArray(caps.exposureMode)&&caps.exposureMode.includes('continuous'))advanced.exposureMode='continuous';
  if(Array.isArray(caps.whiteBalanceMode)&&caps.whiteBalanceMode.includes('continuous'))advanced.whiteBalanceMode='continuous';
  if(Object.keys(advanced).length)await track.applyConstraints({advanced:[advanced]});
 }catch(e){}
}
async function docCameraToggleTorch(button){
 const track=docCameraStream&&docCameraStream.getVideoTracks()[0];if(!track)return;
 let caps={};try{caps=track.getCapabilities?track.getCapabilities():{};}catch(e){}
 if(!caps.torch){syncToast('💡 لا يدعم هذا الجهاز تشغيل الفلاش من المتصفح.');return;}
 try{docCameraTorch=!docCameraTorch;await track.applyConstraints({advanced:[{torch:docCameraTorch}]});button.textContent=docCameraTorch?'💡 إضاءة: مفعّلة':'💡 إضاءة';}
 catch(e){docCameraTorch=false;syncToast('⚠️ تعذر التحكم في إضاءة الكاميرا.');}
}
async function docCameraOpen(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert('التصوير المباشر غير متاح في هذا المتصفح. افتح التطبيق أو استخدم اتصالاً آمناً (HTTPS)، أو ارفع صورة.');return;}
 docCameraClose();
 try{
  docCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1440}},audio:false});
  const layer=document.createElement('div');layer.className='doc-camera-overlay';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','ماسح الوثائق بالكاميرا');
  layer.innerHTML='<div class="doc-camera-dialog"><div class="doc-camera-head"><div><b>📷 ماسح الوثائق</b><div class="doc-camera-message">ضع الوثيقة كاملة داخل الإطار الأخضر وثبّت الهاتف قبل التصوير.</div></div><button type="button" class="btn sm" data-camera-close aria-label="إغلاق">✕</button></div>'+
   '<div class="doc-camera-video-stage"><video class="doc-camera-video" autoplay playsinline muted></video><div class="doc-camera-frame landscape" aria-hidden="true"></div><canvas class="doc-camera-detection" aria-hidden="true"></canvas></div>'+
   '<div class="doc-camera-controls"><label>نوع الوثيقة <select data-camera-type>'+DOC_TYPES.map(x=>'<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>').join('')+'</select></label><label>اتجاه الإطار <select data-camera-orientation><option value="landscape">أفقي</option><option value="portrait">عمودي</option></select></label><button type="button" class="btn sm" data-camera-torch>💡 إضاءة</button><label class="doc-camera-auto"><input type="checkbox" data-camera-auto> التقاط تلقائي عند الثبات</label></div>'+
   '<div class="doc-camera-live-status" data-camera-status role="status" aria-live="polite">جارٍ فحص الإطار… ضع الوثيقة على خلفية متباينة.</div>'+
   '<div class="doc-camera-message" style="margin-top:8px">التقط صورة عالية الدقة؛ سيقترح الماسح حدود الوثيقة ثم يصحح المنظور ويحسّن الوضوح محلياً. ضع الورقة على خلفية متباينة، مع إضاءة جيدة وثبّت الهاتف.</div>'+
   '<div class="doc-camera-actions"><button type="button" class="btn" data-camera-close>إلغاء</button><button type="button" class="btn primary" data-camera-capture>التقاط الوثيقة</button></div></div>';
  document.body.appendChild(layer);docCameraLayer=layer;
  const video=layer.querySelector('video'),frame=layer.querySelector('.doc-camera-frame'),orientation=layer.querySelector('[data-camera-orientation]');
  video.srcObject=docCameraStream;
  await docCameraTune(docCameraStream.getVideoTracks()[0]);
  orientation.addEventListener('change',function(){frame.classList.toggle('portrait',orientation.value==='portrait');frame.classList.toggle('landscape',orientation.value!=='portrait');});
  layer.querySelectorAll('[data-camera-close]').forEach(function(button){button.addEventListener('click',docCameraClose);});
  layer.querySelector('[data-camera-torch]').addEventListener('click',function(){docCameraToggleTorch(this);});
  layer.querySelector('[data-camera-capture]').addEventListener('click',function(){docCameraCapture(video,layer.querySelector('.doc-camera-video-stage'),frame,layer.querySelector('[data-camera-type]').value,this);});
  layer.addEventListener('keydown',function(e){if(e.key==='Escape')docCameraClose();});
  try{await video.play();}catch(e){syncToast('⚠️ تعذر بدء معاينة الكاميرا.');}
  const detector=layer.querySelector('.doc-camera-detection'),liveStatus=layer.querySelector('[data-camera-status]');
  docCameraTimer=setInterval(function(){docCameraDetect(video,layer.querySelector('.doc-camera-video-stage'),detector,liveStatus,frame,layer.querySelector('[data-camera-auto]'),layer.querySelector('[data-camera-capture]'));},350);
  layer.querySelector('[data-camera-capture]').focus();
 }catch(e){docCameraClose();alert('تعذر تشغيل الكاميرا: '+(e&&e.message?e.message:'تحقق من إذن الكاميرا أو استخدم رفع الصور.'));}
}
function docCameraDetect(video,stage,overlay,status,frame,autoToggle,captureButton){
 if(docCameraCaptureBusy||!video||video.readyState<2||!video.videoWidth||!window.MalaabnaScanner)return;
 const sourceWidth=320,sourceHeight=Math.max(180,Math.round(sourceWidth*video.videoHeight/video.videoWidth)),probe=docCameraProbe||(docCameraProbe=document.createElement('canvas'));if(probe.width!==sourceWidth||probe.height!==sourceHeight){probe.width=sourceWidth;probe.height=sourceHeight;}
 const probeCtx=probe.getContext('2d',{willReadFrequently:true});probeCtx.drawImage(video,0,0,sourceWidth,sourceHeight);
 let imageData,quad=null,brightness=0;
 try{
  imageData=probeCtx.getImageData(0,0,sourceWidth,sourceHeight);
  const pixels=imageData.data,sampleStep=20;let total=0,samples=0;
  for(let i=0;i<pixels.length;i+=sampleStep*4){total+=pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114;samples++;}
  brightness=samples?total/samples:0;quad=MalaabnaScanner.detectDocumentQuad(imageData,sourceWidth,sourceHeight);
 }catch(e){return;}
 const rect=stage.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
 if(overlay.width!==Math.round(rect.width*dpr)||overlay.height!==Math.round(rect.height*dpr)){overlay.width=Math.round(rect.width*dpr);overlay.height=Math.round(rect.height*dpr);}
 const ctx=overlay.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
 if(!quad){
  docCameraLastQuad=null;docCameraStableFrames=0;
  status.textContent=brightness<52?'الإضاءة ضعيفة؛ شغّل الإضاءة أو اقترب من مصدر ضوء.':'لم تُكتشف حواف واضحة؛ ضع الورقة كاملة داخل الإطار الأخضر.';
  return;
 }
 const scale=Math.max(rect.width/video.videoWidth,rect.height/video.videoHeight),visibleWidth=rect.width/scale,visibleHeight=rect.height/scale,offsetX=(video.videoWidth-visibleWidth)/2,offsetY=(video.videoHeight-visibleHeight)/2;
 const mapped=quad.map(function(p){const x=p.x*video.videoWidth/sourceWidth,y=p.y*video.videoHeight/sourceHeight;return{x:(x-offsetX)*scale,y:(y-offsetY)*scale};});
 ctx.beginPath();ctx.moveTo(mapped[0].x,mapped[0].y);mapped.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();
 ctx.lineWidth=3;ctx.strokeStyle=brightness<52?'#ffcf5a':'#4cf08a';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=5;ctx.stroke();ctx.shadowBlur=0;
 if(docCameraLastQuad){
  const movement=quad.reduce(function(sum,p,i){return sum+Math.hypot(p.x-docCameraLastQuad[i].x,p.y-docCameraLastQuad[i].y);},0)/quad.length;
  docCameraStableFrames=movement<Math.min(sourceWidth,sourceHeight)*.025?docCameraStableFrames+1:0;
 }else docCameraStableFrames=0;
 docCameraLastQuad=quad.map(p=>({x:p.x,y:p.y}));
 if(brightness<52)status.textContent='تم رصد الوثيقة، لكن الإضاءة ضعيفة. حسّن الضوء قبل التصوير.';
 else if(docCameraStableFrames<3)status.textContent='تم رصد الحواف ✓ ثبّت الهاتف للحظة للحصول على صورة أوضح.';
 else if(autoToggle&&autoToggle.checked)status.textContent='الوثيقة ثابتة وجاهزة ✓ سيتم التصوير تلقائياً.';
 else status.textContent='الوثيقة ثابتة وجاهزة ✓ يمكنك التصوير الآن.';
 if(autoToggle&&autoToggle.checked&&docCameraStableFrames>=3&&brightness>=52&&!docCameraAutoCaptured){
  docCameraAutoCaptured=true;docCameraCapture(video,stage,frame,(docCameraLayer.querySelector('[data-camera-type]')||{}).value,captureButton);
 }
}
async function docCameraCapture(video,stage,frame,type,button){
 if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight){alert('انتظر حتى تظهر معاينة الكاميرا بوضوح.');return;}
 if(docCameraCaptureBusy)return;docCameraCaptureBusy=true;
 if(button){button.disabled=true;button.textContent='جارٍ التصوير…';}
 try{
  let data='';
  const track=docCameraStream&&docCameraStream.getVideoTracks()[0];
  if(track&&typeof ImageCapture!=='undefined'){
   try{const capture=new ImageCapture(track),photo=await capture.takePhoto();data=await imageData(photo,3000);}catch(e){}
  }
  if(!data){
   const scale=Math.min(1,3000/Math.max(video.videoWidth,video.videoHeight)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
   canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',.94);
  }
  const names={birth:'ازدياد',cin:'بطاقة-الولي',medical:'طبية',other:'أخرى'},name='وثيقة-'+(names[type]||'أخرى')+'-'+todayISO()+'-'+Date.now()+'.jpg',index=docScanFiles.length;
  docScanFiles.push({name:name,type:type||'other',data:data,text:'',confidence:0});
  docCameraClose();render();setTimeout(function(){docScanEditorOpen(index);},100);
 }catch(e){docCameraCaptureBusy=false;docCameraAutoCaptured=false;if(button){button.disabled=false;button.textContent='التقاط الوثيقة';}alert('تعذر تجهيز الصورة: '+(e&&e.message||'حاول التقاطها مرة أخرى.'));}
}
let docScanEditorLayer=null;
function docScanEditorOpen(index){
 const file=docScanFiles[index];if(!file)return;
 if(!window.MalaabnaScanner){alert('تعذر تحميل أدوات تصحيح الصورة. أعد تحميل التطبيق وحاول مجدداً.');return;}
 if(docScanEditorLayer)docScanEditorLayer.remove();
 const layer=document.createElement('div');layer.className='doc-scan-editor-overlay';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','تصحيح وتحسين الوثيقة');
 layer.innerHTML='<div class="doc-scan-editor"><div class="doc-scan-editor-head"><div><b>🪄 تصحيح وتحسين الوثيقة</b><div class="doc-scan-editor-hint">المس الزوايا الأربع واسحبها إلى حدود الورقة. سيُصحّح المنظور ويُحسّن الصورة على الجهاز.</div></div><button type="button" class="btn sm" data-scan-close aria-label="إغلاق">✕</button></div>'+
  '<div class="doc-scan-editor-stage"><canvas class="doc-scan-editor-canvas" aria-label="اسحب مقابض الزوايا لتحديد الوثيقة"></canvas></div>'+
  '<div class="doc-scan-editor-tools"><button type="button" class="btn sm" data-scan-detect>⌖ اقتراح حدود تلقائياً</button><button type="button" class="btn sm" data-scan-reset>إطار كامل</button><label>تحسين الصورة <select data-scan-filter><option value="enhanced" selected>ألوان محسّنة</option><option value="color">ألوان أصلية</option><option value="gray">رمادي واضح</option><option value="bw">أبيض وأسود للنصوص</option></select></label></div>'+
  '<div class="doc-scan-editor-status" data-scan-status role="status" aria-live="polite">حرّك النقاط الخضراء لتطابق زوايا الوثيقة؛ الاقتراح التلقائي قابل للتعديل.</div>'+
  '<div class="doc-scan-editor-actions"><button type="button" class="btn" data-scan-close>إلغاء</button><button type="button" class="btn primary" data-scan-apply>تصحيح المنظور وحفظ</button></div></div>';
 document.body.appendChild(layer);docScanEditorLayer=layer;
 const canvas=layer.querySelector('canvas'),ctx=canvas.getContext('2d'),img=new Image(),status=layer.querySelector('[data-scan-status]');
 let points=null,dragIndex=-1,scale=1;
 const defaultPoints=()=>[{x:canvas.width*.07,y:canvas.height*.07},{x:canvas.width*.93,y:canvas.height*.07},{x:canvas.width*.93,y:canvas.height*.93},{x:canvas.width*.07,y:canvas.height*.93}];
 const draw=()=>{
  if(!points)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(4,12,20,.55)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.globalCompositeOperation='source-over';
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='#4cf08a';ctx.lineWidth=Math.max(3,canvas.width/260);ctx.stroke();
  const radius=Math.max(10,canvas.width/48);
  points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fillStyle='#39d978';ctx.fill();ctx.lineWidth=Math.max(2,canvas.width/500);ctx.strokeStyle='#fff';ctx.stroke();ctx.fillStyle='#052411';ctx.font='bold '+Math.max(12,canvas.width/65)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),p.x,p.y);});
 };
 const reset=()=>{points=defaultPoints();draw();status.textContent='تم تحديد إطار كامل؛ اسحب الزوايا إلى حدود الورقة.';};
 const suggest=()=>{
  try{
   const scratch=document.createElement('canvas');scratch.width=canvas.width;scratch.height=canvas.height;
   const scratchCtx=scratch.getContext('2d',{willReadFrequently:true});scratchCtx.drawImage(img,0,0,canvas.width,canvas.height);
   const found=MalaabnaScanner.detectDocumentQuad(scratchCtx.getImageData(0,0,canvas.width,canvas.height),canvas.width,canvas.height);
   if(found){points=found;status.textContent='تم اقتراح حدود الوثيقة. راجع النقاط وعدّلها عند الحاجة.';}
   else{status.textContent='لم تُكتشف الحواف بوضوح؛ اسحب الزوايا يدوياً أو حسّن الإضاءة والتباين.';}
   draw();
  }catch(e){status.textContent='تعذر اكتشاف الحدود تلقائياً؛ حدّد الزوايا يدوياً.';}
 };
 const close=()=>{layer.remove();if(docScanEditorLayer===layer)docScanEditorLayer=null;};
 layer.querySelectorAll('[data-scan-close]').forEach(button=>button.addEventListener('click',close));
 layer.querySelector('[data-scan-reset]').addEventListener('click',reset);
 layer.querySelector('[data-scan-detect]').addEventListener('click',suggest);
 canvas.addEventListener('pointerdown',function(e){
  e.preventDefault();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height,radius=Math.max(18,canvas.width/r.width*30);
  let nearest=-1,best=radius*radius;
  points.forEach((p,i)=>{const d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);if(d<best){best=d;nearest=i;}});
  if(nearest>=0){dragIndex=nearest;canvas.setPointerCapture(e.pointerId);}
 });
 canvas.addEventListener('pointermove',function(e){
  if(dragIndex<0)return;const r=canvas.getBoundingClientRect();
  points[dragIndex]={x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};draw();
 });
 const finishDrag=()=>{dragIndex=-1;};
 canvas.addEventListener('pointerup',finishDrag);canvas.addEventListener('pointercancel',finishDrag);
 layer.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 img.onload=function(){
  scale=Math.min(1,1100/img.naturalWidth,700/img.naturalHeight);
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  ctx.drawImage(img,0,0,canvas.width,canvas.height);points=MalaabnaScanner.detectDocumentQuad(ctx.getImageData(0,0,canvas.width,canvas.height),canvas.width,canvas.height)||defaultPoints();
  status.textContent='راجع الاقتراح التلقائي؛ تحريك الزوايا يحسّن القصّ وتصحيح الميل.';draw();
 };
 img.onerror=function(){alert('تعذر فتح الصورة لتصحيحها.');close();};img.src=file.originalData||file.data;
 layer.querySelector('[data-scan-apply]').addEventListener('click',function(){
  if(!points||!MalaabnaScanner.isConvexQuad(points)){alert('رتّب الزوايا الأربع بحيث تحيط بالوثيقة من دون تقاطع.');return;}
  const button=this,filter=layer.querySelector('[data-scan-filter]').value;button.disabled=true;button.textContent='جارٍ تصحيح الصورة…';status.textContent='جارٍ تصحيح المنظور وتحسين الصورة محلياً…';
  setTimeout(function(){
   try{
    const source=document.createElement('canvas');source.width=img.naturalWidth;source.height=img.naturalHeight;const sourceCtx=source.getContext('2d',{willReadFrequently:true});sourceCtx.drawImage(img,0,0);
    const imageData=sourceCtx.getImageData(0,0,source.width,source.height),factorX=source.width/canvas.width,factorY=source.height/canvas.height;
    const quad=points.map(p=>({x:p.x*factorX,y:p.y*factorY})),result=MalaabnaScanner.rectifyRgba(imageData,source.width,source.height,quad,2600,filter);
    const output=document.createElement('canvas');output.width=result.width;output.height=result.height;const outCtx=output.getContext('2d');const outImage=outCtx.createImageData(result.width,result.height);outImage.data.set(result.data);outCtx.putImageData(outImage,0,0);
    file.originalData=file.originalData||file.data;file.data=output.toDataURL('image/jpeg',.94);file.scanFilter=filter;close();
    const box=document.getElementById('docFiles');if(box)box.innerHTML=docFilesHTML();setOcrStatus('✅ صُحّح المنظور وحُسّنت الصورة. راجعها قبل تشغيل القراءة.',null);
   }catch(e){button.disabled=false;button.textContent='تصحيح المنظور وحفظ';status.textContent='تعذر تصحيح الصورة: '+(e&&e.message||'حاول تقليل حجم الصورة أو إعادة تحديد الزوايا.');}
  },40);
 });
 layer.querySelector('[data-scan-close]').focus();
}
let docCropLayer=null;
function docCropOpen(index){
 const file=docScanFiles[index];if(!file)return;
 if(docCropLayer)docCropLayer.remove();
 const layer=document.createElement('div');layer.className='doc-crop-overlay';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','تحديد إطار الوثيقة');
 layer.innerHTML='<div class="doc-crop-dialog"><div class="doc-crop-head"><b>✂️ تحديد إطار الوثيقة</b><button type="button" class="btn sm" data-crop-close aria-label="إغلاق">✕</button></div><p class="sub">اسحب داخل الصورة لتحديد إطار جديد، أو اعتمد الإطار المقترح. سيُقصّ الجزء المحدد محلياً على هذا الجهاز.</p><div class="doc-crop-stage"><canvas class="doc-crop-canvas" aria-label="اسحب لتحديد إطار القص"></canvas></div><div class="doc-crop-actions"><button type="button" class="btn" data-crop-reset>إعادة الإطار المقترح</button><span class="crop-spacer"></span><button type="button" class="btn" data-crop-cancel>إلغاء</button><button type="button" class="btn primary" data-crop-apply>تأكيد الإطار وقص الوثيقة</button></div></div>';
 document.body.appendChild(layer);docCropLayer=layer;
 const canvas=layer.querySelector('canvas'),ctx=canvas.getContext('2d'),img=new Image();
 let crop=null,drag=null;
 const resize=()=>{const scale=Math.min(1,1050/img.naturalWidth,680/img.naturalHeight);canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));crop={x:canvas.width*.035,y:canvas.height*.035,w:canvas.width*.93,h:canvas.height*.93};draw();};
 const draw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);if(!crop)return;ctx.fillStyle='rgba(8,14,22,.48)';ctx.fillRect(0,0,canvas.width,crop.y);ctx.fillRect(0,crop.y+crop.h,canvas.width,canvas.height-crop.y-crop.h);ctx.fillRect(0,crop.y,crop.x,crop.h);ctx.fillRect(crop.x+crop.w,crop.y,canvas.width-crop.x-crop.w,crop.h);ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,canvas.width/500);ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);const n=Math.max(10,canvas.width/35);ctx.lineWidth=Math.max(3,canvas.width/300);ctx.beginPath();ctx.moveTo(crop.x,crop.y+n);ctx.lineTo(crop.x,crop.y);ctx.lineTo(crop.x+n,crop.y);ctx.moveTo(crop.x+crop.w-n,crop.y);ctx.lineTo(crop.x+crop.w,crop.y);ctx.lineTo(crop.x+crop.w,crop.y+n);ctx.moveTo(crop.x+crop.w,crop.y+crop.h-n);ctx.lineTo(crop.x+crop.w,crop.y+crop.h);ctx.lineTo(crop.x+crop.w-n,crop.y+crop.h);ctx.moveTo(crop.x+n,crop.y+crop.h);ctx.lineTo(crop.x,crop.y+crop.h);ctx.lineTo(crop.x,crop.y+crop.h-n);ctx.stroke();};
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};};
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();drag=point(e);crop={x:drag.x,y:drag.y,w:1,h:1};canvas.setPointerCapture(e.pointerId);draw();});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);crop={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)};draw();});
 canvas.addEventListener('pointerup',()=>{drag=null;});
 const close=()=>{layer.remove();if(docCropLayer===layer)docCropLayer=null;};
 layer.querySelector('[data-crop-close]').addEventListener('click',close);
 layer.querySelector('[data-crop-cancel]').addEventListener('click',close);
 layer.querySelector('[data-crop-reset]').addEventListener('click',()=>{crop={x:canvas.width*.035,y:canvas.height*.035,w:canvas.width*.93,h:canvas.height*.93};draw();});
 layer.querySelector('[data-crop-apply]').addEventListener('click',()=>{if(!crop||crop.w<12||crop.h<12){alert('حدّد إطاراً أكبر حول الوثيقة.');return;}const sx=Math.max(0,Math.round(crop.x*img.naturalWidth/canvas.width)),sy=Math.max(0,Math.round(crop.y*img.naturalHeight/canvas.height)),sw=Math.min(img.naturalWidth-sx,Math.round(crop.w*img.naturalWidth/canvas.width)),sh=Math.min(img.naturalHeight-sy,Math.round(crop.h*img.naturalHeight/canvas.height));const scale=Math.min(1,2200/Math.max(sw,sh)),out=document.createElement('canvas');out.width=Math.max(1,Math.round(sw*scale));out.height=Math.max(1,Math.round(sh*scale));out.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,out.width,out.height);docScanFiles[index].data=out.toDataURL('image/jpeg',.92);delete docScanFiles[index].originalData;close();const box=document.getElementById('docFiles');if(box)box.innerHTML=docFilesHTML();setOcrStatus('✅ قُصّت الوثيقة. شغّل القراءة لمراجعة البيانات المستخرجة.',null);});
 layer.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 img.onload=resize;img.onerror=()=>{alert('تعذر فتح الصورة لتحديد إطارها.');close();};img.src=file.data;
 layer.querySelector('[data-crop-close]').focus();
}
function docRemove(i){docScanFiles.splice(i,1);render();}
function docClear(){if(docScanFiles.length&&confirm('حذف الصور من شاشة التسجيل؟')){docScanFiles=[];docScanRaw='';render();}}
function rotateData(data){return new Promise((res,rej)=>{const im=new Image();im.onerror=rej;im.onload=()=>{const c=document.createElement('canvas');c.width=im.height;c.height=im.width;const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(Math.PI/2);x.drawImage(im,-im.width/2,-im.height/2);res(c.toDataURL('image/jpeg',.9));};im.src=data;});}
async function docRotate(i){if(!docScanFiles[i])return;docScanFiles[i].data=await rotateData(docScanFiles[i].data);delete docScanFiles[i].originalData;const b=document.getElementById('docFiles');if(b)b.innerHTML=docFilesHTML();}
function setOcrStatus(t,p){const e=document.getElementById('ocrStatus'),b=document.getElementById('ocrBar');if(e)e.textContent=t;if(b&&p!=null)b.style.width=Math.max(0,Math.min(100,p))+'%';}
function loadTesseract(){return new Promise((res,rej)=>{if(window.Tesseract)return res(window.Tesseract);const old=document.getElementById('tesseractLoader');if(old){old.addEventListener('load',()=>res(window.Tesseract),{once:true});old.addEventListener('error',()=>rej(new Error('تعذر تحميل محرك القراءة')),{once:true});return;}const sc=document.createElement('script');sc.id='tesseractLoader';// تثبيت نسخة محددة يقلل مخاطر التغيير غير المتوقع في مكتبة OCR الخارجية.
sc.src=new URL('ocr/tesseract.min.js',location.href).href;sc.onload=()=>res(window.Tesseract);sc.onerror=()=>rej(new Error('تعذر تحميل المحرك. تحقق من الإنترنت.'));document.head.appendChild(sc);});}
async function imgIsPortrait(data){return new Promise(res=>{const im=new Image();im.onload=()=>res(im.height>im.width*1.15);im.onerror=()=>res(false);im.src=data;});}
async function geminiPickModel(key){if(geminiModel&&/gemini-3\.6-flash/i.test(geminiModel))return geminiModel;geminiModel='';localStorage.removeItem('fsm_gemini_model');const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key}});if(!r.ok)throw new Error('رفض المفتاح أو تعذر الاتصال ('+r.status+')');const j=await r.json(),list=(j.models||[]).filter(x=>(x.supportedGenerationMethods||[]).includes('generateContent')&&/gemini/i.test(x.name||'')&&!/image|tts|live/i.test(x.name||''));const score=x=>{const m=String(x.name||'').match(/gemini-(\d+)(?:\.(\d+))?/i);return m?Number(m[1])*100+Number(m[2]||0):0;};const flash=list.filter(x=>/flash/i.test(x.name||'')).sort((a,b)=>score(b)-score(a));const preferred=flash.find(x=>/gemini-3\.6-flash/i.test(x.name||''))||flash[0]||list.sort((a,b)=>score(b)-score(a))[0];if(!preferred)throw new Error('لم يتم العثور على نموذج Gemini متوافق');geminiModel=String(preferred.name||'').replace(/^models\//,'');localStorage.setItem('fsm_gemini_model',geminiModel);return geminiModel;}
async function geminiSaveKey(){const e=document.getElementById('gKey'),st=document.getElementById('gKeyStatus'),key=String((e||{}).value||'').trim();if(!key){alert('ألصق مفتاح Gemini API أولاً.');return;}if(st)st.textContent='⏳ جارٍ اختبار المفتاح…';try{geminiModel='';localStorage.removeItem('fsm_gemini_model');const model=await geminiPickModel(key);geminiKeyCache=key;if(window.electronAPI&&window.electronAPI.setGeminiKey)await window.electronAPI.setGeminiKey(key);else sessionStorage.setItem('fsm_gemini_session',JSON.stringify(await window.encryptMalaabnaFile(key)));if(st)st.textContent='✅ المفتاح صالح — النموذج: '+model;}catch(x){geminiKeyCache='';if(window.electronAPI&&window.electronAPI.clearGeminiKey)await window.electronAPI.clearGeminiKey();else sessionStorage.removeItem('fsm_gemini_session');if(st)st.textContent='❌ '+x.message;}}
async function geminiForgetKey(){geminiKeyCache='';if(window.electronAPI&&window.electronAPI.clearGeminiKey)await window.electronAPI.clearGeminiKey();else sessionStorage.removeItem('fsm_gemini_session');localStorage.removeItem('fsm_gemini_model');geminiModel='';const e=document.getElementById('gKey'),st=document.getElementById('gKeyStatus');if(e)e.value='';if(st)st.textContent='تم حذف المفتاح المحفوظ من هذا الجهاز.';}
function geminiJson(text){text=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();return JSON.parse(text);}
function geminiApply(j){const p=j.player||{},g=j.guardian||j.parent||{},m=j.medical||{};setVal('o_playerName',p.fullName||p.name,'force');setVal('o_birth',p.birthDate,'force');setVal('o_birthPlace',p.birthPlace,'force');setVal('o_parentName',g.fullName||g.name,'force');setVal('o_parentCin',g.cin||g.nationalId,'force');setVal('o_phone',g.phone,'force');setVal('o_address',g.address,'force');setVal('o_medExp',m.expiryDate,'force');const rel=document.getElementById('o_relation');if(rel&&['الأب','الأم','وصي'].includes(g.relation))rel.value=g.relation;docScanRaw=JSON.stringify(j,null,2);const raw=document.getElementById('o_raw');if(raw)raw.value=docScanRaw;}
async function geminiRunOCR(){if(!canPage('docscan')){denied();return;}if(docScanBusy||!docScanFiles.length)return;const key=String(geminiKey()).trim();if(!key){alert('أدخل مفتاح Gemini ثم اضغط «اختبار وحفظ على الجهاز».');const e=document.getElementById('gKey');if(e)e.focus();return;}if(!confirm('سيتم إرسال صور الوثائق المحددة عبر الإنترنت إلى Google Gemini. قد تتضمن بيانات أطفال أو وثائق هوية. إن لم توافق، ألغِ العملية واستخدم «قراءة محلية احتياطية». هل تريد المتابعة؟'))return;docScanBusy=true;const b=document.getElementById('geminiRun'),l=document.getElementById('ocrRun');if(b)b.disabled=true;if(l)l.disabled=true;try{setOcrStatus('⏳ تجهيز الصور والاتصال بـ Gemini…',12);const model=await geminiPickModel(key);const prompt=`حلل صور وثائق التسجيل المغربية المرفقة. قد تتضمن: رسم ولادة للاعب، واجهة وظهر البطاقة الوطنية لولي الأمر، وشهادة طبية. استخرج المعلومات المكتوبة فعلاً فقط ولا تخمّن. البطاقة الوطنية تخص ولي الأمر وليس اللاعب. اقرأ المنطقة الآلية MRZ عندما تكون موجودة. أعد JSON صالحاً فقط بهذا الشكل:
{"player":{"fullName":"","birthDate":"YYYY-MM-DD","birthPlace":""},"guardian":{"fullName":"","cin":"","phone":"","address":"","relation":"الأب أو الأم أو وصي"},"medical":{"expiryDate":"YYYY-MM-DD"},"notes":""}
استعمل سلسلة فارغة عند غياب المعلومة.`;const parts=[{text:prompt}];for(const f of docScanFiles)parts.push({text:'نوع الوثيقة المحدد: '+((DOC_TYPES.find(x=>x[0]===f.type)||[])[1]||f.type)+'؛ اسم الملف: '+f.name},{inlineData:{mimeType:'image/jpeg',data:String(f.data).split(',')[1]}});setOcrStatus('✨ Gemini يقرأ الوثائق…',45);const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:.1,responseMimeType:'application/json',maxOutputTokens:2048}})});if(!r.ok){let msg='HTTP '+r.status;try{const x=await r.json();msg=x.error&&x.error.message||msg;}catch(e){}throw new Error(msg);}const j=await r.json();const text=(((j.candidates||[])[0]||{}).content||{}).parts||[];const answer=text.map(x=>x.text||'').join('');if(!answer)throw new Error('لم يُرجع Gemini نتيجة قابلة للقراءة');geminiApply(geminiJson(answer));setOcrStatus('✅ اكتملت القراءة السريعة. راجع البيانات قبل الحفظ.',100);}catch(e){setOcrStatus('❌ '+e.message,0);}finally{docScanBusy=false;if(b)b.disabled=false;if(l)l.disabled=false;}}
async function docRunOCR(){if(docScanBusy||!docScanFiles.length)return;docScanBusy=true;const btn=document.getElementById('ocrRun');if(btn)btn.disabled=true;try{const T=await loadTesseract();setOcrStatus('جارٍ تحميل قاموس العربية والفرنسية…',3);const ocrBase=new URL('ocr/',location.href);const worker=await T.createWorker('ara+fra+eng',undefined,{workerPath:new URL('worker.min.js',ocrBase).href,corePath:new URL('core/',ocrBase).href,langPath:new URL('lang',ocrBase).href,gzip:false,logger:m=>{if(m&&m.progress!=null)setOcrStatus('القراءة: '+Math.round(m.progress*100)+'%',5+m.progress*75);}});let all=[];for(let i=0;i<docScanFiles.length;i++){const f=docScanFiles[i];setOcrStatus('قراءة الوثيقة '+(i+1)+' من '+docScanFiles.length+'…',Math.round(i/docScanFiles.length*85));let r=await worker.recognize(f.data),best=r.data;if(await imgIsPortrait(f.data)){const rot=await rotateData(f.data);let rr=await worker.recognize(rot);if((rr.data.confidence||0)>(best.confidence||0)+3){best=rr.data;f.data=rot;}}f.text=best.text||'';f.confidence=Math.round(best.confidence||0);all.push('['+DOC_TYPES.find(x=>x[0]===f.type)[1]+' — دقة '+f.confidence+'%]\n'+f.text);}await worker.terminate();docScanRaw=all.join('\n\n');docParseAll();setOcrStatus('✅ اكتملت القراءة. راجع الحقول قبل الحفظ.',100);const raw=document.getElementById('o_raw');if(raw)raw.value=docScanRaw;const box=document.getElementById('docFiles');if(box)box.innerHTML=docFilesHTML();}catch(e){setOcrStatus('❌ '+e.message,0);}finally{docScanBusy=false;if(btn)btn.disabled=false;}}
function normDigits(s){return String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));}
function isoDate(y,m,d){y=Number(y);m=Number(m);d=Number(d);if(![y,m,d].every(Number.isInteger)||y<0)return'';if(y<100)y=y<=Number(String(new Date().getFullYear()).slice(-2))?2000+y:1900+y;if(y>9999||m<1||m>12||d<1||d>31)return'';const value=String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';}
function mrzDate(raw,expiry){raw=String(raw||'');const yy=Number(raw.slice(0,2)),m=raw.slice(2,4),d=raw.slice(4,6);return isoDate(expiry?2000+yy:yy,m,d);}
function datesIn(text){const t=normDigits(text),a=[];let m;const r=/(?<!\d)(?:(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})|(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4}|\d{2}))(?!\d)/g;while((m=r.exec(t)))a.push(m[1]?isoDate(m[1],m[2],m[3]):isoDate(m[6],m[5],m[4]));return a.filter(Boolean);}
function setVal(id,v,force){const e=document.getElementById(id);if(e&&v&&(force||!e.value))e.value=v;}
function parseMRZ(text){const u=normDigits(text).toUpperCase().replace(/[^A-Z0-9<\n]/g,'');const lines=u.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>15);let name='',cin='',birth='',expiry='';const nl=lines.find(x=>x.includes('<<')&&!/\d/.test(x)&&/[A-Z]{3}/.test(x)&&!x.startsWith('IDMAR'))||'';if(nl){const parts=nl.replace(/<+$/,'').split(/<<+/).filter(Boolean);if(parts.length)name=parts.slice().reverse().join(' ');}const candidates=u.match(/[A-Z]{1,2}\d{5,8}/g)||[];cin=candidates.find(x=>!/^ID|^MR|^OP/.test(x))||'';for(const l of lines){const m=l.match(/(\d{6})\d?[MF<](\d{6})/);if(m){birth=mrzDate(m[1],false);expiry=mrzDate(m[2],true);break;}}return{name,cin,birth,expiry};}
function afterLabel(text,labels){const ls=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);for(let i=0;i<ls.length;i++){for(const lab of labels){const pos=ls[i].toLowerCase().indexOf(lab.toLowerCase());if(pos>=0){const same=ls[i].slice(pos+lab.length).replace(/^\s*[:：\-]?\s*/,'').trim();if(same.length>2)return same.slice(0,80);if(ls[i+1]&&ls[i+1].length>2)return ls[i+1].slice(0,80);}}}return'';}
function docOCRProposals(f){
 const t=normDigits(f&&f.text||''),values={};if(!t)return values;
 if(f.type==='cin'){
  const m=parseMRZ(t);values.o_parentName=m.name||afterLabel(t,['الاسم العائلي','Nom','Née le']);
  values.o_parentCin=m.cin||((t.match(/\b[A-Z]{1,2}\s*\d{5,8}\b/i)||[])[0]||'').replace(/\s/g,'');
  values.o_address=afterLabel(t,['العنوان','Adresse']);
 }else if(f.type==='birth'){
  values.o_playerName=afterLabel(t,['الاسم الشخصي والعائلي','الاسم العائلي','الاسم الكامل','Nom et prénom']);
  const ds=datesIn(t);if(ds.length)values.o_birth=ds[0];
  values.o_birthPlace=afterLabel(t,['مكان الولادة','مكان الازدياد','Né à','Née à']);
  values.o_parentName=afterLabel(t,['والده هو','والده','والدته هي','والدته']);
 }else if(f.type==='medical'){const ds=datesIn(t);if(ds.length)values.o_medExp=ds[ds.length-1];}
 return values;
}
function docParseOne(f){for(const [id,value] of Object.entries(docOCRProposals(f)))setVal(id,value);}
function docParseAll(){for(const f of docScanFiles)docParseOne(f);}
function docOCRChanges(values){
 const labels={o_parentName:'اسم ولي الأمر',o_parentCin:'رقم البطاقة الوطنية',o_address:'العنوان',o_playerName:'اسم اللاعب',o_birth:'تاريخ الازدياد',o_birthPlace:'مكان الازدياد',o_medExp:'انتهاء الشهادة الطبية'};
 return Object.entries(values).filter(([id])=>labels[id]).map(([id,value])=>{
  const field=document.getElementById(id);return {id,label:labels[id],before:field?String(field.value):'',after:String(value||'').trim(),exists:!!field};
 }).filter(change=>change.exists&&change.after&&change.before.trim()!==change.after);
}
function docApplyOCRFile(index){
 if(!canPage('docscan')){denied();return;}
 const file=docScanFiles[index],field=document.getElementById('docOcrText'+index);if(!file||!field)return;
 const review={file,text:field.value,changes:docOCRChanges(docOCRProposals({...file,text:field.value}))};
 if(!review.changes.length){setOcrStatus('لا توجد تغييرات قابلة للاقتراح من هذا النص. يمكنك تعديل الحقول يدوياً؛ لم تُستبدل أي قيمة.',null);return;}
 mColl=null;mId=null;mFormDirty=false;clearModalError();
 document.getElementById('mTitle').textContent='مراجعة تغييرات OCR';
 document.getElementById('mBody').innerHTML='<div class="mf full notice">قارن القيم واختر الحقول التي تريد تطبيقها. استبدال الحقول الممتلئة غير محدد افتراضياً. لن تُحفظ سجلات جديدة قبل حفظ نموذج التسجيل.</div><div class="ocr-review-list">'+review.changes.map((change,i)=>'<section class="ocr-review-item"><label class="ocr-review-pick" for="ocrReviewPick'+i+'"><input id="ocrReviewPick'+i+'" type="checkbox" '+(!change.before.trim()?'checked':'')+'><b>'+esc(change.label)+'</b></label><div class="ocr-review-values"><div><span>القيمة الحالية</span><p dir="auto">'+esc(change.before||'حقل فارغ')+'</p></div><div><span>القيمة المقترحة</span><p dir="auto">'+esc(change.after)+'</p></div></div></section>').join('')+'</div>';
 setModalSaveAction(()=>applyOCRReview(review),'تطبيق الحقول المحددة');
 const overlay=document.getElementById('ov');window._modalOpener=document.activeElement;
 overlay.setAttribute('data-dialog-kind','ocr-review');
 const close=document.getElementById('modalCloseBtn');if(close)close.textContent='إغلاق';
 overlay.classList.add('on');overlay.setAttribute('aria-hidden','false');
 setTimeout(()=>document.getElementById('ocrReviewPick0')?.focus(),0);
}
function applyOCRReview(review){
 if(!canPage('docscan')){denied();return;}
 if(!docScanFiles.includes(review.file)){showModalError('تغيرت الوثيقة منذ فتح المراجعة. أغلق النافذة وأعد فتحها.');return;}
 const selected=review.changes.filter((change,i)=>(document.getElementById('ocrReviewPick'+i)||{}).checked);
 if(!selected.length){showModalError('اختر حقلاً واحداً على الأقل، أو ألغِ المراجعة دون تغيير البيانات.');return;}
 for(const change of selected){
  const field=document.getElementById(change.id);
  if(!field||String(field.value)!==change.before){showModalError('تغيرت قيمة أحد الحقول منذ فتح المراجعة. أغلق النافذة وأعد مراجعة المقارنة.');return;}
  if(field.type==='date'){
   const date=new Date(change.after+'T00:00:00Z');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(change.after)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==change.after){showModalError('التاريخ المقترح غير صالح. صحّح النص أو اترك حقل التاريخ دون تحديد.');return;}
  }
 }
 for(const change of selected)setVal(change.id,change.after,true);
 review.file.text=review.text;closeModal(true);
 setOcrStatus('طُبّقت '+selected.length+' تغييرات محددة على نموذج التسجيل فقط. راجعها ثم احفظ التسجيل عند الانتهاء.',null);
}

function docExportPdf(){if(!docScanFiles.length||docPdfBusy)return;if(!window.MalaabnaScanner||typeof window.MalaabnaScanner.createPdfFromJpegs!=='function'){alert('تعذر تحميل أداة إنشاء PDF. أعد تحميل التطبيق وحاول مجددًا.');return;}docPdfBusy=true;const btn=Array.from(document.querySelectorAll('.doc-scan-actions .btn')).find(b=>b.textContent.includes('تنزيل PDF'));if(btn){btn.disabled=true;btn.textContent='⏳ جارٍ تجهيز PDF…';}try{const bytes=window.MalaabnaScanner.createPdfFromJpegs(docScanFiles.map(f=>f.data));const blob=new Blob([bytes],{type:'application/pdf'});dl('وثائق-التسجيل-'+todayISO()+'.pdf',blob,'application/pdf');setOcrStatus('✅ تم تنزيل ملف PDF متعدد الصفحات ('+docScanFiles.length+' صفحة).',100);}catch(e){alert('تعذر إنشاء PDF: '+(e&&e.message||'تأكد من سلامة الصور.'));setOcrStatus('❌ تعذر إنشاء ملف PDF.',0);}finally{docPdfBusy=false;if(btn){btn.disabled=false;btn.textContent='⬇️ تنزيل PDF متعدد الصفحات';}}}

let docCreateBusy=false;
async function docCreateRecords(){
 if(docCreateBusy)return;docCreateBusy=true;try{
 if(!canPage('docscan')){denied();return;}
 if(geminiKey()&&!confirm('هل راجعت البيانات المستخرجة من Gemini وتأكدت من صحتها؟'))return;
 const g=id=>String((document.getElementById(id)||{}).value||'').trim(),pn=g('o_playerName'),parn=g('o_parentName');
 if(!pn){alert('أدخل اسم اللاعب بعد مراجعة نتيجة القراءة.');document.getElementById('o_playerName').focus();return;}
 if(!parn){alert('أدخل اسم ولي الأمر بعد مراجعة نتيجة القراءة.');document.getElementById('o_parentName').focus();return;}
 const keepScans=docScanFiles.length>0&&!!(document.getElementById('oKeepDocs')||{}).checked;
 if(keepScans&&!confirm('أكدتَ الاحتفاظ بصور الوثائق داخل ملف اللاعب أو ولي الأمر. قد تشمل هذه الملفات نسخًا احتياطية أو مزامنة التطبيق. متابعة؟'))return;
 const birth=g('o_birth'),cin=g('o_parentCin'),matches=dailyDuplicates('players',{name:pn,birth:birth},null);
 if(matches.some(x=>birth&&x.birth===birth)){alert('يوجد لاعب مطابق بالاسم وتاريخ الازدياد. راجع ملفه بدلاً من إنشاء نسخة مكررة.');return;}
 if(matches.length&&!confirm('يوجد اسم لاعب مشابه. هل راجعت السجل وتريد إنشاء شخص آخر دون دمجه؟'))return;
 let parent=db.parents.find(x=>(cin&&dailyNormalize(x.cin).replace(/\s/g,'')===dailyNormalize(cin).replace(/\s/g,''))||(!cin&&dailyNormalize(x.name)===dailyNormalize(parn)&&dailyPhone(g('o_phone'))&&dailyPhone(x.phone)===dailyPhone(g('o_phone'))));
 if(parent&&dailyNormalize(parent.name)!==dailyNormalize(parn)&&!confirm('رقم الهوية مرتبط بولي أمر باسم مختلف. هل تريد ربط اللاعب بالسجل الموجود دون تغيير بياناته؟'))return;
 if(!parent){parent={id:uid(),name:parn,rel:g('o_relation')||'الأب',phone:g('o_phone'),cin:cin,address:g('o_address'),att:[],notes:'أُنشئ من التسجيل الذكي بالوثائق'};db.parents.push(parent);}
 parent.att=parent.att||[];
 const player={id:uid(),name:pn,birth:birth,birthplace:g('o_birthPlace'),team:g('o_team'),cat:'',parent:parent.id,pphone:g('o_phone')||parent.phone||'',address:g('o_address')||parent.address||'',reg:todayISO(),status:'نشط',med:docScanFiles.some(x=>x.type==='medical'),ins:false,att:[],notes:'أُنشئ من التسجيل الذكي بالوثائق'};
 const team=db.teams.find(x=>x.id===player.team);if(team)player.cat=team.cat||'';
 if(keepScans){for(const f of docScanFiles){const id=uid(),meta={id,name:f.name,type:'image/jpeg',cat:f.type==='cin'?'نسخة البطاقة الوطنية':(f.type==='birth'?'شهادة الازدياد':(f.type==='medical'?'شهادة طبية':'أخرى')),date:todayISO(),exp:f.type==='medical'?g('o_medExp'):'',size:Math.round(String(f.data).length*.75),idb:1,data:''};try{await idbPut(id,f.data);}catch(e){meta.idb=0;meta.data=f.data;}if(f.type==='cin')parent.att.push(meta);else player.att.push(meta);if(f.type!=='cin')db.docs.push({id:uid(),title:meta.cat+' — '+pn,cat:meta.cat,player:player.id,date:todayISO(),exp:meta.exp,state:'مكتملة',notes:'أضيفت تلقائياً من التسجيل الذكي'});}}
 db.players.push(player);auditAdd('تسجيل ذكي بالوثائق','اللاعب: '+pn+' — ولي الأمر: '+parn+' — الاحتفاظ بالصور: '+(keepScans?'نعم':'لا'));
 if(await save()){alert('تم إنشاء اللاعب وولي الأمر بنجاح.'+(keepScans?' تم إرفاق الوثائق في ملفهما.':' لم يتم الاحتفاظ بصور الوثائق بعد التسجيل.'));docScanFiles=[];docScanRaw='';page='players';render();try{idbGC();}catch(e){}}
 }finally{docCreateBusy=false;}
}

/* ================= التوجيه ================= */

/* مسح QR لتسجيل الحضور */
let scanDate=todayISO(),scanSt=ATT[0],scanLog=[],scanOn=false,scanStream=null,scanTimer=null,scanMsg='',scanLast='',scanLastT=0;
let scanMode='attendance',verifyResult=null,verifyBusy=false,verifyMsg='',nfcAbort=null,jsqrCanvas=null;

let scanQueue=[],syncMsg='';
function arrText(p,date,state){
 const now=new Date();
 return tplFill(db.settings.waArr||DEFAULT_ARR,notificationMap(p,{'{الفئة}':p.cat||'','{التاريخ}':date,'{الساعة}':now.toTimeString().slice(0,5),'{الحالة}':String(state||'').replace(/[^\u0600-\u06FF ]/g,'').trim(),'{نسبة_الحضور}':attRate(p.id)}));
}
function scanNotify(p,ok){
 if(!ok)return;
 const isAbs=(scanSt===ATT[1]||scanSt===ATT[2]);
 const txt=isAbs?absText(p,scanDate,scanSt):arrText(p,scanDate,scanSt);
 const num=playerNum(p);
 const item={pid:p.id,n:p.name,num:num,t:txt,sent:false,k:isAbs?'غياب':'حضور'};
 scanQueue.unshift(item);
 if(scanQueue.length>50)scanQueue.pop();
 if(db.settings.scanAuto&&num){
  if(waCloudReady()){
   waCloudSend(isAbs?'absence':'arrival',num,txt,[parentName(p),p.name||'',p.cat||'',scanDate,db.settings.school||'']).then(function(res){
    if(res.ok)item.sent=true;else{item.err=res.message;syncToast('⚠️ تعذّر الإرسال التلقائي لـ '+(p.name||'')+': '+res.message);}
    scanQueueRefresh();
   });
  }else if(openWA(num,txt))item.sent=true;
 }
 scanQueueRefresh();
}
function scanQueueHTML(){
 if(!scanQueue.length)return '<div class="empty">لا توجد إشعارات بعد.</div>';
 return scanQueue.map((q,i)=>'<div class="it"><span>'+esc(q.n)+' <span class="tag t-n">'+q.k+'</span>'+(q.num?'':' <span class="tag t-r">لا يوجد رقم</span>')+'</span><span>'+(q.sent?'<span class="tag t-g">أُرسل ✓</span>':(q.num?'<button class="btn sm" '+actionAttr('click',()=>scanSendOne(i))+'>💬 إرسال</button>':'—'))+'</span></div>').join('');
}
function scanQueueRefresh(){const e=document.getElementById('scanQ');if(e)e.innerHTML=scanQueueHTML();const c=document.getElementById('scanQn');if(c)c.textContent=scanQueue.filter(q=>!q.sent&&q.num).length;}
function scanSendOne(i){const q=scanQueue[i];if(!q)return;if(openWA(q.num,q.t)){q.sent=true;scanQueueRefresh();}}
function scanSendAll(){
 const p=scanQueue.filter(q=>!q.sent&&q.num);
 if(!p.length){alert('لا توجد إشعارات جاهزة للإرسال.');return;}
 if(!confirm('سيتم فتح '+p.length+' محادثة واتساب. متابعة؟'))return;
 p.forEach((q,i)=>setTimeout(()=>{if(openWA(q.num,q.t))q.sent=true;scanQueueRefresh();},i*1200));
}
/* المزامنة بين الأجهزة */
function deviceName(){
 if(!db.settings.device){
  const ua=navigator.userAgent||'';
  let g='جهاز';
  if(/Android/i.test(ua))g='هاتف أندرويد';
  else if(/iPhone|iPad/i.test(ua))g='آيفون';
  else if(/Windows/i.test(ua))g='حاسوب ويندوز';
  else if(/Mac/i.test(ua))g='ماك';
  else if(/Linux/i.test(ua))g='حاسوب';
  db.settings.device=g+' - '+Math.random().toString(36).slice(2,5).toUpperCase();
  // Persisted with the next confirmed database save.
 }
 return db.settings.device;
}
function syncCounts(){return db.players.length+' لاعب / '+db.attendance.length+' حضور / '+db.subs.length+' اشتراك';}
function syncLogAdd(kind,auto){
 if(!Array.isArray(db.syncLog))db.syncLog=[];
 db.syncLog.unshift({t:new Date().toISOString(),kind:kind,auto:!!auto,device:deviceName()+(lockOn()&&role?' — '+roleLabel():''),info:syncCounts()});
 db.syncLog=db.syncLog.slice(0,40);
}
async function syncLogClear(){if(confirm('مسح سجل المزامنة؟')){db.syncLog=[];if(!await save())return;render();}}
function syncLogHTML(){
 const L=Array.isArray(db.syncLog)?db.syncLog:[];
 if(!L.length)return '<div class="sub" style="margin-top:10px">لا يوجد سجل مزامنة بعد.</div>';
 const rows=L.slice(0,15).map(function(e){
  const d=String(e.t||'').slice(0,16).replace('T',' ');
  const k=e.kind==='push'?'⬆️ رفع':'⬇️ جلب';
  const a=e.auto?'<span class="tag">تلقائي</span>':'<span class="tag">يدوي</span>';
  return '<tr><td>'+esc(d)+'</td><td>'+k+' '+a+'</td><td>'+esc(e.device||'')+'</td><td class="sub">'+esc(e.info||'')+'</td></tr>';
 }).join('');
 return '<div class="tw" style="margin-top:10px"><table><thead><tr><th>التاريخ</th><th>العملية</th><th>الجهاز</th><th>المحتوى</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function syncConflictHTML(){
 const c=db.settings&&db.settings.syncConflicts;
 if(!c||!c.count)return '';
 const items=(c.items||[]).slice(0,12).map(x=>esc(String(x.collection||'')+' / '+String(x.id||''))).join('، ');
 return '<div class="notice" style="margin-top:12px;border-inline-start:4px solid #E56458"><b>⚠️ تعارضات تحتاج مراجعة</b><div class="sub" style="margin:6px 0">تم حسم '+esc(c.count)+' تعارضاً لصالح هذا الجهاز بتاريخ '+esc(c.at||'')+'. راجع السجلات التالية، ثم صحّحها يدوياً عند الحاجة:</div><div style="font-family:monospace;direction:ltr;text-align:left;word-break:break-word">'+items+(c.count>12?' …':'')+'</div><button class="btn sm" style="margin-top:8px" '+actionAttr('click',()=>clearSyncConflicts())+'>تمت المراجعة</button></div>';
}
async function clearSyncConflicts(){if(db.settings)db.settings.syncConflicts=null;if(!await save())return;render();}
let syncBusy=false,syncTimer=null;
function syncToast(t){const e=document.getElementById('syncToast');if(!e)return;e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2800);}
async function driveBackup(){const tab=window.open('https://drive.google.com/drive/my-drive','_blank');if(!await exportJSON(undefined,true)&&tab)tab.close();}
/* ==== المزامنة عبر خادم حقيقي (Node.js + ملف JSON محلي) بدل Firebase/Apps Script ==== */
function syncReady(){if(mobileInfo)return !!(syncServerUrlAllowed(mobileInfo.serverUrl)&&mobileInfo.code&&mobileInfo.token);return !!(syncServerUrlAllowed(db.settings.serverUrl)&&(db.settings.syncCode||'').trim()&&(db.settings.syncSecret||'').trim());}
function syncOn(){
 // حسابات سطح المكتب غير الإدارية لا تستخدم سر مساحة العمل المشترك للرفع
 // أو الجلب الكامل. مزامنة الهاتف المقيّدة تمر عبر جلسة الهاتف وصلاحيات الخادم.
 if(window.electronAPI&&acctInfo&&acctInfo.role!=='admin')return false;
 return !!(syncReady()&&((mobileInfo&&mobileInfo.user&&mobileInfo.user.role==='admin')||(!mobileInfo&&(!acctInfo||acctInfo.role==='admin')&&db.settings.syncAuto)));
}
function syncSchedule(){
 if(mobileInfo&&mobileInfo.user&&mobileInfo.user.role!=='admin'){if(!(mobileInfo.user.permissions||[]).includes('att'))return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>{mobileAttendancePush();},2500);return;}
 if(syncBusy||!syncOn())return;
 clearTimeout(syncTimer);
 syncTimer=setTimeout(()=>{cloudPush(true);},4000);
}
let mobileAttendanceBusy=false;
async function mobileAttendancePush(){
 if(mobileAttendanceBusy||!mobileInfo||mobileInfo.user.role==='admin'||!(mobileInfo.user.permissions||[]).includes('att'))return;
 mobileAttendanceBusy=true;setCloudStatus('syncing');
 try{
  await waitForLocalPersistence();
  const updates=JSON.parse(JSON.stringify(db.attendance||[])),baseUpdatedAt=db.settings.syncBase||'';
  const r=await fetch(syncApiUrl('/api/auth/attendance'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody({updates,baseUpdatedAt}))});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||!j.ok){const error=new Error((j&&j.message)||('HTTP '+r.status));error.code=j&&j.code;if(j&&j.requestId)error.message+=' — مرجع الطلب: '+j.requestId;throw error;}
  if(typeof j.updatedAt!=='string'||!Number.isFinite(Date.parse(j.updatedAt)))throw new Error('رد الخادم لا يتضمن مرجع حفظ صالحاً. لم نؤكد المزامنة.');
  db.settings.syncBase=j.updatedAt;
  await persistDbSnapshot();
  if(stableStr(updates)===stableStr(db.attendance||[]))setCloudStatus('attendance');
  else{setCloudStatus('idle');syncSchedule();}
 }catch(error){setCloudFailure(error);syncToast('⚠️ تعذر مزامنة الحضور: '+error.message);}
 finally{mobileAttendanceBusy=false;refreshAttendanceSyncPanel();}
}
/* نسخة للرفع بدون أسرار الاتصال (كلمة سر المزامنة/الرمز/الرابط) — لا تغادر هذا الجهاز */
function dbForUpload(){const c=Object.assign({},db);c.settings=Object.assign({},db.settings);['syncSecret','syncCode','serverUrl','_localSyncAck','_receiptVerifications'].forEach(k=>{delete c.settings[k];});return c;}
/* ==== إرسال واتساب تلقائي حقيقي عبر خادم المزامنة + WhatsApp Cloud API ==== */
let waCloudState={checked:false,configured:false};
function waCloudReady(){return !!(db.settings.waCloud&&syncReady());}
async function waCloudSend(kind,num,text,params){
 if(!waCloudReady()||!num)return {ok:false,message:'الإرسال التلقائي غير مفعّل'};
 try{
  const r=await fetch(syncApiUrl('/api/whatsapp/send'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody({to:num,kind:kind,text:text,params:params||[]}))});
  const j=await r.json().catch(()=>null);
  if(r.ok&&j&&j.ok)return {ok:true};
  return {ok:false,message:(j&&j.message)||('HTTP '+r.status)};
 }catch(e){return {ok:false,message:e.message};}
}
async function waCloudCheck(){
 const el=document.getElementById('waCloudMsg');
 if(!syncReady()){if(el)el.textContent='أكمل إعداد المزامنة أولاً.';return;}
 if(el)el.textContent='⏳ جارٍ التحقق من إعداد الخادم…';
 try{
  const r=await fetch(syncApiUrl('/api/whatsapp/status'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody())});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.message)||('HTTP '+r.status));
  waCloudState={checked:true,configured:!!j.configured};
  if(el)el.textContent=j.configured?('✅ الخادم مهيّأ لإرسال واتساب ('+(j.templates&&j.templates.length?'قوالب: '+j.templates.join('، '):'رسائل نصية عادية')+')'):'⚠️ الخادم غير مهيّأ: ضع WA_TOKEN و WA_PHONE_ID في .env (راجع server/README.md).';
 }catch(e){if(el)el.textContent='❌ '+e.message;}
}
async function waCloudToggle(key,val){if(!isAdmin()){denied();render();return;}db.settings[key]=!!val;if(!await save())return;render();}
function waAutoThxAfterSave(rec){
 // بعد حفظ اشتراك: يُرسل وصل/شكر تلقائياً إن كان مفعّلاً وتغيّر المبلغ المدفوع منذ آخر إرسال
 try{
  if(!waCloudReady()||!db.settings.waAutoThx||rec.kind==='رسوم التسجيل')return;
  const paid=Number(rec.paid)||0;
  if(paid<=0||rec.thxPaid===paid)return;
  const p=db.players.find(x=>x.id===rec.player)||{};
  const num=playerNum(p);if(!num)return;
  const rest=Math.max(0,actualDue(rec)-paid);
  waCloudSend('thanks',num,thxText(rec),[parentName(p),p.name||'',rec.month||'',String(rec.year||''),money(paid),money(rest),rec.rec||'',db.settings.school||'']).then(async function(res){
   if(res.ok){rec.thxSent=new Date().toISOString().slice(0,16).replace('T',' ');rec.thxPaid=paid;if(!await save())return;syncToast('✅ أُرسل وصل الأداء لولي الأمر عبر واتساب');}
   else syncToast('⚠️ تعذّر إرسال الوصل تلقائياً: '+res.message);
  });
 }catch(e){console.warn(e);}
}
function syncApiUrl(path){return (mobileInfo?mobileInfo.serverUrl:(db.settings.serverUrl||'')).trim().replace(/\/+$/,'')+path;}
function syncAuthBody(extra){const base=mobileInfo?{token:mobileInfo.token,code:mobileInfo.code}:{code:(db.settings.syncCode||'').trim().toUpperCase(),secret:(db.settings.syncSecret||'').trim()};return Object.assign(base,extra||{});}
async function mobileServerUpsert(payload){if(!syncReady()||(!mobileInfo&&!(db.settings.syncSecret||'').trim()))return {ok:false,message:'أكمل إعداد مساحة المزامنة من جهاز المدير أولاً.'};
 if(mobileInfo&&(!mobileInfo.user||mobileInfo.user.role!=='admin'))return {ok:false,message:'هذه العملية متاحة للمدير فقط.'};try{const r=await fetch(syncApiUrl('/api/auth/users/upsert'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody(payload))});const j=await r.json().catch(()=>null);return r.ok&&j&&j.ok?j:{ok:false,message:(j&&j.message)||('HTTP '+r.status)};}catch(e){return {ok:false,message:e.message};}}

/* ==== دمج ثلاثي على مستوى السجل (يمنع ضياع تعديلات الأجهزة الأخرى) ====
   الأساس (base) = بصمة كل سجل عند آخر مزامنة ناجحة. نقارنه بالنسخة المحلية والبعيدة:
   - تغيّر في جهة واحدة فقط  → تُؤخذ تلك النسخة
   - تغيّر في الجهتين        → تعارض: يفوز هذا الجهاز ويُحصى في الرسالة
   - حذف في جهة وتعديل في أخرى → يُحتفظ بالسجل المعدَّل (لا نفقد بيانات) */
const SYNC_COLLS=['teams','parents','coaches','players','trainings','attendance','matches','evals','subs','receipts','expenses','salaryAdvances','equip','docs','loans','injuries','cashClosings','audit'];
const SYNC_BASE_KEY='fsm_sync_base';
function stableStr(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stableStr).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stableStr(v[k])).join(',')+'}';}
function recHash(o){const s=stableStr(o);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+'.'+s.length.toString(36);}
function syncSnapshotSave(src){try{const d=src||db,b={};SYNC_COLLS.forEach(c=>{b[c]={};(Array.isArray(d[c])?d[c]:[]).forEach(r=>{if(r&&r.id)b[c][r.id]=recHash(r);});});localStorage.setItem(SYNC_BASE_KEY,JSON.stringify(b));}catch(e){console.warn('تعذر حفظ أساس المزامنة',e);}}
function syncSnapshotLoad(){try{const r=localStorage.getItem(SYNC_BASE_KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
function mergeDb(local,remote,base){
 const out=JSON.parse(JSON.stringify(remote));let conflicts=0,dirty=false,conflictItems=[];
 SYNC_COLLS.forEach(c=>{
  const L=Array.isArray(local[c])?local[c]:[],R=Array.isArray(remote[c])?remote[c]:[],B=(base&&base[c])||{};
  const lm=new Map(),rm=new Map();
  L.forEach(x=>{if(x&&x.id)lm.set(x.id,x);});R.forEach(x=>{if(x&&x.id)rm.set(x.id,x);});
  const res=[];
  R.forEach(r=>{
   if(!r||!r.id){res.push(r);return;}
   const l=lm.get(r.id),b=B[r.id];
   if(!l){if(b===undefined||recHash(r)!==b)res.push(r);return;} // حُذف محلياً ولم يُعدَّل بعيداً → يبقى محذوفاً
   const hl=recHash(l),hr=recHash(r);
   if(hl===hr)res.push(l);
   else if(b===hl)res.push(r);
   else if(b===hr)res.push(l);
   else{res.push(l);conflicts++;if(conflictItems.length<50)conflictItems.push({collection:c,id:l.id});}
  });
  L.forEach(l=>{
   if(!l||!l.id||rm.has(l.id))return;
   const b=B[l.id];
   if(b===undefined||recHash(l)!==b)res.push(l); // جديد محلياً أو معدَّل محلياً؛ وإلا فقد حُذف بعيداً
  });
  if(c==='audit')res.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  out[c]=c==='audit'?res.slice(0,500):res;
  if(recHash(out[c])!==recHash(R))dirty=true;
 });
 out.settings=local.settings;out.syncLog=local.syncLog;
 return {db:out,conflicts:conflicts,dirty:dirty,conflictItems:conflictItems,receiptConflicts:MalaabnaFinance.receiptCorrectionConflicts(out.receipts)};
}
async function syncMerge(j){
 await waitForLocalPersistence();
 const m=mergeDb(db,j.db,syncSnapshotLoad());
 if(m.receiptConflicts.length){
  const conflict=m.receiptConflicts[0],accepted=(j.db.receipts||[]).find(r=>r.correction&&r.correction.sourceId===conflict.sourceId);
  const error=new Error('تعارض تصحيح الوصل '+(conflict.sourceRec||conflict.sourceId)+'. '+(accepted?'النسخة المعتمدة على الخادم: '+accepted.rec+'. ':'')+'لم تُدمج النسخ المتعارضة. صدّر نسخة احتياطية لهذا الجهاز، ثم اجلب آخر نسخة وافتح النسخة المعتمدة لإكمال التصحيح.');
  error.code='receipt_correction_conflict';throw error;
 }
 if(j.files){for(const fk in j.files){try{if(!(await idbGet(fk)))await idbPut(fk,j.files[fk]);}catch(e){}}}
 db=Object.assign(JSON.parse(JSON.stringify(blank)),m.db);
 if(migrateSalaryAdvancePlans())m.dirty=true;
 if(m.conflicts)db.settings.syncConflicts={count:m.conflicts,items:m.conflictItems,at:new Date().toISOString().slice(0,16).replace('T',' ')};
 return m;
}
async function createWorkspace(){
 const urlEl=document.getElementById('s_serverUrl');
 const serverUrl=String((urlEl&&urlEl.value)||db.settings.serverUrl||'').trim().replace(/\/+$/,'');
 if(!serverUrl){alert('أدخل رابط الخادم أولاً (بعد نشره حسب الدليل المرفق في مجلد server).');return;}
 if(!syncServerUrlAllowed(serverUrl)){alert('استخدم رابط HTTPS للخادم، أو HTTP على هذا الجهاز فقط (localhost).');return;}
 if(!confirm('سيتم إنشاء مساحة مزامنة جديدة لهذه المدرسة على الخادم. نفّذ هذا مرة واحدة فقط من أول جهاز. متابعة؟'))return;
 try{
  const r=await fetch(serverUrl+'/api/workspace/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schoolName:db.settings.school||''})});
  const j=await r.json();
  if(!r.ok||!j||!j.ok){alert('تعذر إنشاء مساحة المزامنة: '+((j&&j.message)||('HTTP '+r.status)));return;}
  db.settings.serverUrl=serverUrl;db.settings.syncCode=j.code;db.settings.syncSecret=j.secret;
  const saved=await save();if(saved)render();
  alert('تم إنشاء مساحة المزامنة على الخادم ✅'+(saved?'':'\n⚠️ تعذر حفظ إعداداتها محلياً. انسخ المعرّفين الآن ثم أعد إدخالهما واحفظ الإعدادات.')+'\n\nرمز المدرسة: '+j.code+'\nكلمة السر: '+j.secret+'\n\n⚠️ انسخ هذين المعرّفين فوراً إلى مكان آمن، وأدخلهما يدوياً في باقي الأجهزة (نفس الصفحة)، لأن كلمة السر لن تظهر مرة أخرى.');
 }catch(e){alert('تعذر الاتصال بالخادم: '+e.message);}
}
async function rotateSecret(){
 if(!syncReady()){alert('أكمل إعداد المزامنة أولاً.');return;}
 if(!confirm('سيتم إبطال كلمة السر الحالية فوراً على كل الأجهزة الأخرى حتى تُحدَّث فيها يدوياً. متابعة؟'))return;
 try{
  const r=await fetch(syncApiUrl('/api/workspace/rotate-secret'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody())});
  const j=await r.json();
  if(!r.ok||!j||!j.ok){alert('تعذر التجديد: '+((j&&j.message)||('HTTP '+r.status)));return;}
  db.settings.syncSecret=j.secret;const saved=await save();if(saved)render();
  alert('كلمة السر الجديدة: '+j.secret+(saved?'':'\n⚠️ تغيّرت كلمة السر على الخادم لكن تعذر حفظها محلياً. انسخها الآن ثم أعد إدخالها واحفظ الإعدادات.')+'\n\n⚠️ حدّثها فوراً في باقي الأجهزة، وإلا ستتوقف مزامنتها.');
 }catch(e){alert('تعذر الاتصال بالخادم: '+e.message);}
}
async function autoSyncOpen(){
 if(syncBusy||!(db.settings.syncOpen&&syncReady()))return;
 syncBusy=true;setCloudStatus('syncing');
 const pullConnection=syncConnectionKey();
 syncToast('⏳ جارٍ التحقق من السحابة...');
 try{
  const r=await fetch(syncApiUrl('/api/workspace/pull'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody())});
  const j=await r.json();
  if(pullConnection!==syncConnectionKey())throw new Error('تغيرت إعدادات المزامنة أثناء الجلب. أعد المحاولة.');
  if(!r.ok||!j||!j.ok){syncBusy=false;setCloudStatus('error',(j&&j.message)||'تعذر التحقق من نسخة الخادم.');syncToast('⚠️ تعذّر التحقق: '+((j&&j.message)||('HTTP '+r.status)));if(syncOn())cloudPush(true);return;}
  const data=j.db;
  if(!data||!data.players){syncBusy=false;setCloudStatus('idle');syncToast('ℹ️ لا توجد نسخة في السحابة بعد');if(syncOn())cloudPush(true);return;}
  const remote=String(j.updatedAt||'');
  const local=String(db.settings.changed||'');
  if(remote&&local&&remote<=local){syncBusy=false;setCloudStatus('idle');syncToast('✅ بيانات هذا الجهاز هي الأحدث');if(syncOn())cloudPush(true);return;}
  if(syncSnapshotLoad()&&db.settings.syncBase){
   syncBusy=true;
   const m=await syncMerge(j);
   db.settings.syncBase=remote;
   await markSyncAcknowledged(data,remote,pullConnection);
   db.settings.changed=new Date().toISOString();
   db.settings.syncLast=new Date().toISOString().slice(0,16).replace('T',' ');
   syncLogAdd('pull',true);
   await persistDbSnapshot();
   syncSnapshotSave(data);
   syncBusy=false;setCloudStatus('idle');render();
   syncToast('⬇️ تم دمج آخر نسخة من السحابة'+(m.conflicts?' — '+m.conflicts+' تعارض حُسم لصالح هذا الجهاز':''));
   if(m.dirty&&syncOn())cloudPush(true);
   return;
  }
  syncBusy=true;
  const su=db.settings.serverUrl,sc=db.settings.syncCode,ss=db.settings.syncSecret,a=db.settings.syncAuto,o=db.settings.syncOpen,dv=db.settings.device;
  db=Object.assign(JSON.parse(JSON.stringify(blank)),data);
  db.settings.serverUrl=su;db.settings.syncCode=sc;db.settings.syncSecret=ss;db.settings.syncAuto=a;db.settings.syncOpen=o;if(dv)db.settings.device=dv;
  db.settings.syncBase=remote;
  await markSyncAcknowledged(data,remote,pullConnection);
  const migratedAdvancePlans=migrateSalaryAdvancePlans();
  db.settings.changed=remote||new Date().toISOString();
  db.settings.syncLast=new Date().toISOString().slice(0,16).replace('T',' ');
  if(j.files){for(const fk in j.files){try{await idbPut(fk,j.files[fk]);}catch(e3){}}}
  syncLogAdd('pull',true);
  await persistDbSnapshot();
  syncSnapshotSave(data);
  syncBusy=false;setCloudStatus('idle');render();
  syncToast('⬇️ تم جلب آخر نسخة من السحابة');
  if(migratedAdvancePlans&&syncOn())setTimeout(()=>cloudPush(true),500);
 }catch(e){syncBusy=false;setCloudFailure(e);syncToast('⚠️ تعذّر الجلب: '+e.message);}
}
function setSyncMsg(t){syncMsg=t;const e=document.getElementById('syncMsg');if(e)e.textContent=t;}
async function cloudPush(silent,force,retried){
 if(syncBusy)return;
 if(window.electronAPI&&acctInfo&&acctInfo.role!=='admin'){
  if(!silent)setSyncMsg('مزامنة البيانات الكاملة متاحة لحساب المدير فقط.');
  return;
 }
 if(!syncReady()){if(silent)return;alert('أكمل إعداد المزامنة أولاً (رابط الخادم + رمز المدرسة + كلمة السر) ثم احفظ.');return;}
 if(silent)syncToast('⏳ جارٍ الرفع...');else setSyncMsg('⏳ جارٍ رفع البيانات...');
 syncBusy=true;setCloudStatus('syncing');
 try{
  await waitForLocalPersistence();
  syncLogAdd('push',!!silent);
  let files=null;try{files=await idbAll();}catch(e2){}
  let flen=0;if(files){for(const fk in files)flen+=String(files[fk]).length;}
  if(flen>4*1048576){files=null;if(silent)syncToast('⚠️ حجم الوثائق كبير — تمت مزامنة البيانات دون المرفقات');}
  const uploadDevice=deviceName(),uploadConnection=syncConnectionKey(),uploadSnapshot=JSON.parse(JSON.stringify(dbForUpload())),sentDigest=await syncDigest(uploadSnapshot);
  const body=JSON.stringify(syncAuthBody({device:uploadDevice,db:uploadSnapshot,files:files||undefined,baseUpdatedAt:db.settings.syncBase||'',force:!!force}));
  const r=await fetch(syncApiUrl('/api/workspace/push'),{method:'PUT',headers:{'Content-Type':'application/json'},body:body});
  const j=await r.json().catch(()=>null);
  if(j&&j.code==='receipt_correction_conflict'){const error=new Error(j.message);error.code=j.code;throw error;}
  if(r.status===409){
   if(!db.settings.syncBase){
    syncBusy=false;setCloudStatus('conflict','توجد بيانات على الخادم لم يجلبها هذا الجهاز. اجلب النسخة المعتمدة قبل الرفع.');
    if(silent){syncToast('⚠️ توجد بيانات في السحابة. اجلب آخر نسخة أولاً من الإعدادات ← المزامنة.');return;}
    if(confirm('توجد بيانات في السحابة لم يجلبها هذا الجهاز بعد. الاستمرار سيستبدلها ببيانات هذا الجهاز. هل تريد الاستبدال؟'))return cloudPush(false,true,true);
    setSyncMsg('⚠️ أُلغي الرفع. اضغط «جلب آخر نسخة» أولاً.');return;
   }
   if(retried){syncBusy=false;setCloudStatus('conflict','تعذر حسم تعارض المزامنة تلقائياً. أعد المحاولة بعد مراجعة النسخة المعتمدة.');if(silent)syncToast('⚠️ تعذّر الدمج التلقائي، أعد المحاولة');else setSyncMsg('⚠️ تعذّر الدمج التلقائي، أعد المحاولة بعد لحظات.');return;}
   const pr=await fetch(syncApiUrl('/api/workspace/pull'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody())});
   const pj=await pr.json().catch(()=>null);
   if(!pr.ok||!pj||!pj.ok||!pj.db||!pj.db.players)throw new Error('تعذّر جلب النسخة الأحدث للدمج');
   if(uploadConnection!==syncConnectionKey())throw new Error('تغيرت إعدادات المزامنة أثناء الدمج. أعد المحاولة.');
   const m=await syncMerge(pj);
   db.settings.syncBase=pj.updatedAt||'';
   await markSyncAcknowledged(pj.db,pj.updatedAt,uploadConnection);
   db.settings.changed=new Date().toISOString();
   await persistDbSnapshot();
   syncSnapshotSave(pj.db);
   syncBusy=false;setCloudStatus('idle');render();
   syncToast('🔀 دُمجت تعديلات جهاز آخر'+(m.conflicts?' — '+m.conflicts+' تعارض حُسم لصالح هذا الجهاز':''));
   return cloudPush(silent,false,true);
  }
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.message)||('HTTP '+r.status));
  const matchesSent=(await syncDigest(db))===sentDigest;
  if(uploadConnection!==syncConnectionKey()){syncBusy=false;setCloudStatus('idle');syncToast('اكتمل طلب الوجهة السابقة، لكن إعدادات المزامنة تغيرت. لم يُسجل تأكيد للوجهة الجديدة.');return;}
  db.settings.syncBase=j.updatedAt||'';
  if(matchesSent)db.settings.changed=j.updatedAt||new Date().toISOString();
  db.settings.syncLast=new Date().toISOString().slice(0,16).replace('T',' ');
  db.settings._localSyncAck={digest:sentDigest,at:j.updatedAt||new Date().toISOString(),connection:uploadConnection};
  await persistDbSnapshot();syncSnapshotSave(uploadSnapshot);syncBusy=false;setCloudStatus('idle');
  const newerChanges=(await syncDigest(db))!==sentDigest;
  if(newerChanges){syncToast('رُفعت النسخة المرسلة، وتوجد تعديلات أحدث محفوظة على الجهاز بانتظار المزامنة.');if(syncOn())syncSchedule();return;}
  if(silent){syncToast('☁️ تمت المزامنة — '+db.settings.syncLast);const el=document.getElementById('syncMsg');if(el)el.textContent='آخر مزامنة: '+db.settings.syncLast;}else setSyncMsg('✅ تم رفع البيانات — '+db.settings.syncLast);
 }catch(e){syncBusy=false;setCloudFailure(e);if(silent)syncToast('⚠️ تعذّر الرفع: '+e.message);else setSyncMsg('❌ فشل الرفع: '+e.message+' (تأكد من الإنترنت وإعدادات المزامنة)');}
}
async function cloudPull(){
 if(syncBusy)return;
 if(window.electronAPI&&acctInfo&&acctInfo.role!=='admin'){setSyncMsg('جلب البيانات الكاملة متاح لحساب المدير فقط.');return;}
 if(!syncReady()){alert('أكمل إعداد المزامنة أولاً (رابط الخادم + رمز المدرسة + كلمة السر) ثم احفظ.');return;}
 if(!confirm('ستُستبدل بيانات هذا الجهاز بالنسخة الموجودة في السحابة. متابعة؟'))return;
 const dv2=db.settings.device,pullConnection=syncConnectionKey();syncBusy=true;setCloudStatus('syncing');
 setSyncMsg('⏳ جارٍ تنزيل البيانات...');
 try{
  const r=await fetch(syncApiUrl('/api/workspace/pull'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody())});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.message)||('HTTP '+r.status));
  if(pullConnection!==syncConnectionKey())throw new Error('تغيرت إعدادات المزامنة أثناء الجلب. أعد المحاولة.');
  const data=j.db;
  if(!data||!data.players){throw new Error('لا توجد نسخة صالحة بعد على الخادم');}
  const su=db.settings.serverUrl,sc=db.settings.syncCode,ss=db.settings.syncSecret;
  db=Object.assign(JSON.parse(JSON.stringify(blank)),data);
  db.settings.serverUrl=su;db.settings.syncCode=sc;db.settings.syncSecret=ss;if(dv2)db.settings.device=dv2;
  db.settings.syncBase=j.updatedAt||'';
  await markSyncAcknowledged(data,j.updatedAt,pullConnection);
  db.settings.changed=j.updatedAt||new Date().toISOString();
  db.settings.syncLast=new Date().toISOString().slice(0,16).replace('T',' ');
  if(j.files){for(const fk in j.files){try{await idbPut(fk,j.files[fk]);}catch(e3){}}}
  syncLogAdd('pull',false);
  const migratedAdvancePlans=migrateSalaryAdvancePlans();
  if(migratedAdvancePlans)db.settings.changed=new Date().toISOString();
  await persistDbSnapshot();syncSnapshotSave(data);syncBusy=false;setCloudStatus('idle');setSyncMsg('✅ تم تنزيل البيانات'+(j.updatedAt?' (آخر تحديث: '+String(j.updatedAt).slice(0,16).replace('T',' ')+')':''));render();
 }catch(e){syncBusy=false;setCloudFailure(e);setSyncMsg('❌ فشل التنزيل: '+e.message);}
}
/* ==== التحقق من بطاقة العضوية (المرحلة 4): حد أدنى فقط، دون بيانات حساسة ==== */
function parseMemberQR(text){
 const t=String(text||'').trim();
 const parts=t.split('|');
 if(parts.length!==5||parts[0]!=='MALAABNA-MEMBER')return null;
 const memberId=parts[1].trim().toUpperCase(),playerId=parts[2].trim();
 if(!/^[A-Za-z0-9]{1,12}$/.test(memberId)||!/^[A-Za-z0-9-]{6,64}$/.test(playerId))return null;
 if(String(playerId).slice(-6).toUpperCase()!==memberId)return null;
 return {memberId:memberId,playerId:playerId,name:parts[3].trim(),school:parts[4].trim()};
}
function subscriptionStateForPlayer(subs,playerId,monthName,year){
 const rows=(subs||[]).filter(s=>s&&s.player===playerId&&s.kind==='اشتراك شهري'&&s.month===monthName&&Number(s.year)===Number(year));
 if(!rows.length)return 'لا يوجد سجل';
 if(rows.some(s=>s.exempt==='نعم'))return 'معفى';
 const remaining=rows.reduce((sum,s)=>sum+Math.max(0,Number(s.due)||0)-Math.max(0,Number(s.paid)||0),0);
 return remaining<=0?'مسدد':'متبقٍ';
}
function verifyServerOrigin(){return (mobileInfo?mobileInfo.serverUrl:(db.settings.serverUrl||DEFAULT_SERVER)).trim().replace(/\/+$/,'');}
async function verifyMemberPayload(text){
 const parsed=parseMemberQR(text);
 if(!parsed)return {parsed:null,formatOk:false,local:null,server:null,serverState:'unconfirmed',warnings:[]};
 const player=db.players.find(x=>String(x.id)===parsed.playerId&&String(x.id).slice(-6).toUpperCase()===parsed.memberId)||null;
 const now=new Date();
 const local=player?{name:player.name||'',memberId:parsed.memberId,status:String(player.status||''),category:String(player.cat||''),subscription:subscriptionStateForPlayer(db.subs,player.id,MONTHS[now.getMonth()],now.getFullYear()),school:String(db.settings.school||''),nameMismatch:parsed.name!==''&&parsed.name!==String(player.name||''),schoolMismatch:parsed.school!==''&&parsed.school!==String(db.settings.school||'')}:null;
 const warnings=[];
 if(local&&local.nameMismatch)warnings.push('الاسم في الرمز يختلف عن الاسم المسجل');
 if(local&&local.schoolMismatch)warnings.push('اسم المدرسة في الرمز يختلف عن المدرسة الحالية');
 let server=null,serverState='unconfirmed';
 try{
  const origin=verifyServerOrigin();
  if(!origin)throw new Error('no-origin');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
  let res;
  try{res=await fetch(origin+'/api/members/verify?memberId='+encodeURIComponent(parsed.memberId)+'&playerId='+encodeURIComponent(parsed.playerId),{headers:{'Accept':'application/json'},signal:ctrl.signal,cache:'no-store'});}
  finally{clearTimeout(timer);}
  if(res.ok){const j=await res.json().catch(()=>null);if(j&&j.ok){server={name:String(j.name||''),memberId:String(j.memberId||parsed.memberId),status:String(j.status||''),category:String(j.category||''),subscription:String(j.subscription||''),school:String(j.school||'')};serverState='confirmed';if(local&&server.name&&local.name!==server.name)warnings.push('الاسم على الخادم يختلف عن الاسم المحلي');}}
  else if(res.status===404)serverState='not-found';
 }catch(e){serverState='unconfirmed';}
 return {parsed:parsed,formatOk:true,local:local,server:server,serverState:serverState,warnings:warnings};
}
function verifyResultHTML(result){
 if(!result)return '<p class="sub">لم يُتحقق من أي بطاقة بعد.</p>';
 if(!result.formatOk)return '<div class="verify-banner verify-bad">❌ صيغة رمز غير معروفة — هذه ليست بطاقة عضوية ملعبنا.</div>';
 const shown=result.server||result.local;
 const banner=result.serverState==='confirmed'?'<div class="verify-banner verify-ok">✅ مؤكد من الخادم — البيانات أدناه من سجل المدرسة.</div>':result.serverState==='not-found'?'<div class="verify-banner verify-bad">⚠️ غير موجود على الخادم — قد تكون البطاقة ملغاة أو البيانات قديمة. لا تعتمد عليها.</div>':'<div class="verify-banner verify-warn">⚠️ قراءة محلية غير مؤكدة، لا يوجد توقيع — تعذّر الاتصال بالخادم.</div>';
 if(!shown)return banner+'<div class="notice">لا يوجد لاعب مطابق لهذه البطاقة في بيانات هذا الجهاز.</div>';
 const rows=[['الاسم',shown.name||'—'],['رقم العضوية',shown.memberId||'—'],['الحالة',shown.status||'—'],['الفئة',shown.category||'—'],['حالة الاشتراك (الشهر الحالي)',shown.subscription||'—'],['المدرسة',shown.school||'—']];
 const warn=result.warnings&&result.warnings.length?'<div class="notice">'+result.warnings.map(w=>esc(w)).join('؛ ')+'.</div>':'';
 return banner+'<table class="verify-table"><tbody>'+rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td><b>'+esc(r[1])+'</b></td></tr>').join('')+'</tbody></table>'+warn;
}
function setScanMode(mode){stopScan();scanMode=mode==='verify'?'verify':'attendance';verifyResult=null;verifyMsg='';render();}
function setVerifyMsg(t){verifyMsg=t;const e=document.getElementById('verifyMsg');if(e)e.textContent=t;}
function verifyRefresh(){const e=document.getElementById('verifyResult');if(e)e.innerHTML=verifyResultHTML(verifyResult);}
async function verifyScanned(text){
 if(verifyBusy)return;verifyBusy=true;
 try{verifyResult=await verifyMemberPayload(text);verifyRefresh();scanBeep(!!(verifyResult.local||verifyResult.server));}
 finally{verifyBusy=false;}
}
async function verifyManual(){
 const pick=document.getElementById('scanPick'),codeEl=document.getElementById('scanCode');
 let text='';
 if(pick&&pick.value){const p=db.players.find(x=>x.id===pick.value);if(p)text='MALAABNA-MEMBER|'+String(p.id).slice(-6).toUpperCase()+'|'+String(p.id)+'|'+String(p.name||'')+'|'+String(db.settings.school||'');}
 else if(codeEl&&codeEl.value.trim())text=codeEl.value.trim();
 if(codeEl)codeEl.value='';if(pick)pick.value='';
 if(!text){setVerifyMsg('أدخل نص الرمز أو اختر لاعبًا للتحقق.');return;}
 await verifyScanned(text);
}
function nfcSupported(){return typeof window!=='undefined'&&'NDEFReader' in window&&!!window.isSecureContext;}
function nfcUnavailableReason(){if(typeof window!=='undefined'&&!window.isSecureContext)return 'NFC يتطلب اتصالًا آمنًا (HTTPS).';return 'NFC يعمل فقط على Chrome في أندرويد عبر HTTPS — التحقق عبر QR متاح دائمًا.';}
async function startNfcScan(){
 if(!nfcSupported()){setVerifyMsg('⚠️ '+nfcUnavailableReason());return;}
 try{
  stopNfcScan();
  nfcAbort=new AbortController();
  const reader=new window.NDEFReader();
  await reader.scan({signal:nfcAbort.signal});
  setVerifyMsg('📳 قرّب البطاقة من الجهاز لقراءة NFC…');
  reader.onreading=async event=>{
   for(const record of event.message.records){
    if(record.recordType!=='text')continue;
    let text='';
    try{text=new TextDecoder(record.encoding||'utf-8').decode(record.data);}catch(e){continue;}
    if(text){await verifyScanned(text);break;}
   }
  };
  reader.onreadingerror=()=>{setVerifyMsg('⚠️ تعذّرت قراءة بطاقة NFC.');};
 }catch(e){if(e&&e.name==='AbortError')return;setVerifyMsg('⚠️ تعذّر بدء مسح NFC: '+((e&&e.message)||'غير مدعوم'));}
}
function stopNfcScan(){if(nfcAbort){try{nfcAbort.abort();}catch(e){}nfcAbort=null;}}
function jsqrAvailable(){return typeof window!=='undefined'&&typeof window.jsQR==='function';}
function scanSupported(){return typeof window!=='undefined'&&'BarcodeDetector' in window;}
function scanPage(){
 const opts=ATT.map(a=>'<option '+(scanSt===a?'selected':'')+'>'+a+'</option>').join('');
 const sup=scanSupported();
 const verifyMode=scanMode==='verify';
 const nfc=nfcSupported();
 const playerOptions=db.players.filter(p=>p.status!=='منسحب'&&playerAllowed(p)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+esc(p.cat||'')+'</option>').join('');
 const middleCard=verifyMode?
  '<div class="card"><b>🔍 التحقق اليدوي</b><div class="sub" style="margin:6px 0 10px">الصق نص رمز البطاقة كاملًا أو اختر اللاعب للتحقق من سجله</div>'+
   '<input id="scanCode" placeholder="MALAABNA-MEMBER|…" dir="ltr" style="width:100%;margin-bottom:8px">'+
   '<select id="scanPick" style="width:100%;margin-bottom:10px"><option value="">— اختر لاعباً —</option>'+playerOptions+'</select>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" '+actionAttr('click',()=>verifyManual())+'>🔍 تحقق من البطاقة</button>'+
   (nfc?'<button class="btn" '+actionAttr('click',()=>startNfcScan())+'>📳 مسح NFC</button>':'<button class="btn" disabled title="'+esc(nfcUnavailableReason())+'">📳 NFC غير مدعوم هنا</button>')+'</div>'+
   '<div id="verifyMsg" class="sub" style="margin-top:10px">'+esc(verifyMsg||(nfc?'NFC متاح على هذا الجهاز.':'NFC يعمل فقط على Chrome في أندرويد عبر HTTPS — التحقق عبر QR متاح دائمًا.'))+'</div>'+
   '<div id="verifyResult" class="verify-result" style="margin-top:12px">'+verifyResultHTML(verifyResult)+'</div></div>'
  :
  '<div class="card"><b>إدخال يدوي</b><div class="sub" style="margin:6px 0 10px">اكتب رقم العضوية المكتوب على البطاقة أو اختر اللاعب</div>'+
   '<input id="scanCode" placeholder="رقم العضوية" style="width:100%;margin-bottom:8px">'+
   '<select id="scanPick" style="width:100%;margin-bottom:10px"><option value="">— اختر لاعباً —</option>'+playerOptions+'</select>'+
   '<button class="btn primary" '+actionAttr('click',()=>scanManual())+'>➕ تسجيل الحضور</button>'+
   '<div style="margin-top:16px"><b>سجل المسح</b> <span id="scanCount" class="tag t-n">'+scanLog.length+'</span>'+
   '<div class="scanlog" id="scanLog">'+scanLogHTML()+'</div></div></div>';
 const notifyCard=verifyMode?'':
 '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>💬 إشعار أولياء الأمور</b>'+'<label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" '+(db.settings.scanAuto?'checked':'')+' '+actionAttr('change',async (event,el)=>{db.settings.scanAuto=el.checked;if(!await save())return;})+'> إرسال تلقائي</label></div>'+'<div class="sub" style="margin:8px 0">عند كل مسح تُجهّز رسالة لولي الأمر (إشعار وصول أو إشعار غياب حسب الحالة المختارة).</div>'+'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn primary" '+actionAttr('click',()=>scanSendAll())+'>📤 إرسال الكل (<span id="scanQn">'+scanQueue.filter(q=>!q.sent&&q.num).length+'</span>)</button>'+'<button class="btn" '+actionAttr('click',()=>{scanQueue=[];scanQueueRefresh()})+'>🧹 تفريغ</button></div>'+'<div class="scanlog" id="scanQ">'+scanQueueHTML()+'</div></div>';
 return head(verifyMode?'✅ التحقق من بطاقة العضوية':'📷 مسح QR للحضور',verifyMode?'امسح رمز البطاقة أو اقرأ NFC للتحقق من العضوية والحالة — دون أي بيانات حساسة':'وجّه بطاقة اللاعب نحو الكاميرا ويُسجّل حضوره تلقائياً')+
 '<div class="tools no-print">'+
  '<button class="btn'+(verifyMode?'':' primary')+'" '+actionAttr('click',()=>setScanMode('attendance'))+'>📷 حضور</button>'+
  '<button class="btn'+(verifyMode?' primary':'')+'" '+actionAttr('click',()=>setScanMode('verify'))+'>✅ تحقق من البطاقة</button>'+
  (verifyMode?'':'<input type="date" value="'+esc(scanDate)+'" '+actionAttr('change',(event,el)=>{scanDate=el.value;scanRefresh()})+'>'+
  '<select '+actionAttr('change',(event,el)=>scanSt=el.value)+'>'+opts+'</select>')+
  (scanOn?'<button class="btn danger" '+actionAttr('click',()=>{stopScan();render()})+'>⏹ إيقاف الكاميرا</button>':'<button class="btn primary" '+actionAttr('click',()=>startScan())+'>'+(verifyMode?'📷 تشغيل الكاميرا للتحقق':'📷 تشغيل الكاميرا')+'</button>')+
 '</div>'+
 '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr))">'+
  '<div class="card"><div class="scanwrap"><video id="scanVid" playsinline muted></video><div class="frame"></div></div>'+
   '<div id="scanMsg" class="sub" style="margin-top:10px;text-align:center">'+esc(scanMsg||(sup?'اضغط «تشغيل الكاميرا» ثم امسح بطاقات اللاعبين واحدة تلو الأخرى':jsqrAvailable()?'متصفحك لا يدعم BarcodeDetector — سيُستخدم القارئ الاحتياطي المحلي (jsQR) عند تشغيل الكاميرا':'متصفحك لا يدعم مسح QR — استعمل الإدخال اليدوي أو متصفح Chrome / Edge'))+'</div></div>'+
  middleCard+notifyCard+
 '</div>';
}
function scanLogHTML(){
 if(!scanLog.length)return '<div class="empty">لم يُمسح أي لاعب بعد.</div>';
 return scanLog.map(x=>'<div class="it"><span>'+esc(x.n)+'</span><span class="tag '+(x.ok?'t-g':'t-o')+'">'+esc(x.s)+'</span></div>').join('');
}
function scanRefresh(){
 const l=document.getElementById('scanLog');if(l)l.innerHTML=scanLogHTML();
 const c=document.getElementById('scanCount');if(c)c.textContent=scanLog.length;
}
function setScanMsg(t){scanMsg=t;const e=document.getElementById('scanMsg');if(e)e.textContent=t;}
function scanBeep(ok){try{const a=new (window.AudioContext||window.webkitAudioContext)();const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=ok?880:320;g.gain.value=.08;o.start();setTimeout(()=>{o.stop();a.close();},ok?120:260);}catch(e){}}
function findPlayerByCode(txt){
 const t=String(txt||'').trim();if(!t)return null;
 const parsed=parseMemberQR(t);
 if(parsed)return db.players.find(x=>String(x.id)===parsed.playerId&&String(x.id).slice(-6).toUpperCase()===parsed.memberId)||null;
 const lines=t.split(String.fromCharCode(10));
 let code='';const m=t.match(/ID:\s*([A-Za-z0-9_-]+)/);
 code=(m?m[1]:lines[0]).trim().toUpperCase();
 let p=db.players.find(x=>String(x.id).slice(-6).toUpperCase()===code)||db.players.find(x=>String(x.id).toUpperCase()===code);
 if(!p&&lines[1])p=db.players.find(x=>String(x.name||'').trim()===lines[1].trim());
 return p||null;
}
async function scanRecord(p){
 if(!p){scanBeep(false);setScanMsg('❌ بطاقة غير معروفة — اللاعب غير موجود');return;}
 if(!playerAllowed(p)){scanBeep(false);setScanMsg('⛔ '+p.name+' — خارج الفئات المسندة إليك');return;}
 let r=db.attendance.find(a=>a.player===p.id&&a.date===scanDate);
 let st='',ok=true;
 if(r&&r.state===scanSt){st='مسجّل مسبقاً';ok=false;}
 else if(r){r.state=scanSt;st=scanSt+' (تحديث)';if(!await save())return;}
 else {db.attendance.push({id:uid(),player:p.id,date:scanDate,state:scanSt,team:p.team});st=scanSt;if(!await save())return;}
 scanLog.unshift({n:p.name,s:st,ok:ok});if(scanLog.length>50)scanLog.pop();
 scanNotify(p,ok);
 scanBeep(ok);setScanMsg((ok?'✅ ':'ℹ️ ')+p.name+' — '+st);scanRefresh();
}
async function scanManual(){
 const pick=document.getElementById('scanPick'),codeEl=document.getElementById('scanCode');
 let p=null;
 if(pick&&pick.value)p=db.players.find(x=>x.id===pick.value);
 else if(codeEl&&codeEl.value.trim())p=findPlayerByCode(codeEl.value.trim());
 if(codeEl)codeEl.value='';if(pick)pick.value='';
 await scanRecord(p);
}
async function handleScannedValue(val){
 const now=Date.now();
 if(!val||(val===scanLast&&now-scanLastT<=2500))return;
 scanLast=val;scanLastT=now;
 if(scanMode==='verify')await verifyScanned(val);
 else await scanRecord(findPlayerByCode(val));
}
async function startScan(){
 if(!scanSupported()&&!jsqrAvailable()){setScanMsg('⚠️ هذا المتصفح لا يدعم مسح QR. استعمل Chrome أو Edge أو الإدخال اليدوي.');return;}
 try{scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});}
 catch(e){setScanMsg('⚠️ تعذّر فتح الكاميرا — اسمح بالوصول إلى الكاميرا ثم أعد المحاولة.');return;}
 scanOn=true;render();
 const v=document.getElementById('scanVid');
 if(!v){stopScan();return;}
 v.srcObject=scanStream;try{await v.play();}catch(e){}
 setScanMsg('🟢 الكاميرا تعمل — قرّب البطاقة من الإطار');
 if(scanSupported()){
  let det;try{det=new window.BarcodeDetector({formats:['qr_code']});}catch(e){setScanMsg('⚠️ تعذّر تشغيل قارئ QR');return;}
  scanTimer=setInterval(async()=>{
   if(!scanOn)return;
   try{const codes=await det.detect(v);
    if(codes&&codes.length)await handleScannedValue(codes[0].rawValue||'');
   }catch(e){}
  },350);
  return;
 }
 if(!jsqrCanvas)jsqrCanvas=document.createElement('canvas');
 scanTimer=setInterval(()=>{
  if(!scanOn||!v.videoWidth)return;
  try{
   jsqrCanvas.width=v.videoWidth;jsqrCanvas.height=v.videoHeight;
   const ctx=jsqrCanvas.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(v,0,0,jsqrCanvas.width,jsqrCanvas.height);
   const image=ctx.getImageData(0,0,jsqrCanvas.width,jsqrCanvas.height);
   const code=window.jsQR(image.data,image.width,image.height,{inversionAttempts:'dontInvert'});
   if(code&&code.data)handleScannedValue(code.data);
  }catch(e){}
 },350);
}
function stopScan(){
 scanOn=false;
 stopNfcScan();
 if(scanTimer){clearInterval(scanTimer);scanTimer=null;}
 if(scanStream){try{scanStream.getTracks().forEach(t=>t.stop());}catch(e){}scanStream=null;}
 scanMsg='';
}
function render(){
 refreshAppStatus();
 updateSchoolManifest();
 if(isMobileWeb()&&!mobileInfo){document.getElementById('nav').innerHTML='';document.getElementById('brandName').textContent='ملعبنا';const mn=document.getElementById('mobileNav');if(mn)mn.innerHTML='';const ms=document.getElementById('mobSchoolName');if(ms)ms.textContent='تسجيل الدخول';document.getElementById('view').innerHTML=mobileLoginHTML();return;}
 if(lockOn()&&!role&&!mobileInfo){document.getElementById('nav').innerHTML='';document.getElementById('brandName').textContent=db.settings.school;const mn=document.getElementById('mobileNav');if(mn)mn.innerHTML='';document.getElementById('view').innerHTML=loginHTML();return;}
 if(!canPage(page))page='att';
 document.getElementById('nav').innerHTML=navHTML();
 document.getElementById('brandName').textContent=db.settings.school;
 document.getElementById('brandLogo').innerHTML=db.settings.logo?'<img src="'+safeImg(db.settings.logo)+'" style="width:100%;height:100%;object-fit:cover;border-radius:10px">':'⚽';
 const n=NAV.find(x=>x.id===page);document.getElementById('mobTitle').textContent=n?n.l:'';
 const mobSchool=document.getElementById('mobSchoolName');if(mobSchool)mobSchool.textContent=db.settings.school||'ملعبنا';
 const mobLogo=document.getElementById('mobBrandLogo');if(mobLogo)mobLogo.innerHTML=db.settings.logo?'<img src="'+safeImg(db.settings.logo)+'">':'⚽';
 const mobileNav=document.getElementById('mobileNav');if(mobileNav)mobileNav.innerHTML=mobileNavHTML();
 let html='';
 if(page==='dash')html=dash();
 else if(page==='admin')html=adminPage();
 else if(page==='docscan')html=docScanPage();
 else if(page==='announcements')html=announcementsPage();
 else if(page==='injuries')html=injuriesPage();
 else if(page==='cards')html=cardsPage();
 else if(page==='att')html=attPage();
 else if(page==='scan')html=scanPage();
 else if(page==='subs')html=subsPage();
 else if(page==='receipts')html=receiptsPage();
 else if(page==='evals')html=evalsPage();
 else if(page==='wa')html=waPage();
 else if(page==='family')html=familyPage();
 else if(page==='portal')html=portalPage();
 else if(page==='alerts')html=alertsPage();
 else if(page==='cashbox')html=cashboxPage();
 else if(page==='reports')html=reportsPage();
 else if(page==='invites')html=invitesPage();
 else if(page==='settings')html=settingsPage();
 else if(page==='system')html=systemPage();
 else html=listPage(page);
 document.getElementById('view').innerHTML=printHead()+html;
 pruneAppActionHandlers();
 window.scrollTo(0,0);
}
document.getElementById('ov').addEventListener('click',e=>{if(e.target.id==='ov')closeModal();});
document.addEventListener('keydown',e=>{
 const overlay=document.getElementById('ov');if(!overlay||!overlay.classList.contains('on'))return;
 if(e.key==='Escape'){closeModal();return;}
 if(e.key!=='Tab')return;
 const dialog=overlay.querySelector('.modal');if(!dialog)return;
 const focusable=Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
 if(!focusable.length){e.preventDefault();return;}
 const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
 if(!dialog.contains(active)){e.preventDefault();(e.shiftKey?last:first).focus();}
 else if(e.shiftKey&&active===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&active===last){e.preventDefault();first.focus();}
});
let lastActivity=Date.now();['click','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{lastActivity=Date.now();},{passive:true}));setInterval(()=>{if(lockOn()&&role&&Date.now()-lastActivity>30*60*1000){logout();syncToast('🔒 تم قفل الجلسة بعد 30 دقيقة من عدم النشاط');}},60000);
if('serviceWorker' in navigator&&location.protocol!=='file:'){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});}
if(salaryAdvancePlansNeedMigration){salaryAdvancePlansNeedMigration=false;void save();}
migrateReceiptSnapshots();
function bindShellActions(){
 ['click','change','submit','keydown','beforeinput'].forEach(type=>document.addEventListener(type,function(event){
  if(!pendingDbWrites)return;
  event.preventDefault();event.stopImmediatePropagation();
 },true));
 const bind=(id,type,handler)=>{const el=document.getElementById(id);if(el)el.addEventListener(type,handler);};
 bind('acctBarAddBtn','click',openNewAccountModal);
 bind('acctBarManageBtn','click',openManageAccountsModal);
 bind('acctBarLogoutBtn','click',electronLogout);
 bind('mobileScrim','click',()=>toggleMenu());
 bind('mobileMenuBtn','click',event=>toggleMenu(event.currentTarget));
 bind('mobileHomeBtn','click',()=>go('dash'));
 bind('modalCloseBtn','click',closeModal);
 bind('mBody','input',clearModalFieldError);bind('mBody','change',clearModalFieldError);bind('mBody','input',markModalDirty);bind('mBody','change',markModalDirty);
 bind('modalCancelBtn','click',closeModal);
 bind('newAcctCloseBtn','click',closeNewAccountModal);
 bind('naRole','change',toggleNaPermsVisibility);
 bind('naSubmitBtn','click',submitNewAccount);
 bind('manageAcctCloseBtn','click',closeManageAccountsModal);
}
bindShellActions();
if(window.electronAPI){const accountBar=document.getElementById('acctBar');if(accountBar)accountBar.style.display='flex';}
render();
setInterval(checkDeviceNotifications,60000);
setTimeout(checkDeviceNotifications,3000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkDeviceNotifications();});
hydrateGeminiKey().then(()=>{if(page==='docscan')render();});
migrateFiles();
// في Electron ننتظر معرفة الحساب قبل تنفيذ أي مزامنة تلقائية، حتى لا
// يبدأ حساب غير إداري بطلب نسخة كاملة قبل تطبيق صلاحياته.
if(!window.electronAPI)autoSyncOpen();
setTimeout(function(){autoBackup();},3000);
mobileValidateSession();
window.addEventListener('online',()=>{refreshAppStatus();if(syncOn())cloudPush(true);});
window.addEventListener('offline',refreshAppStatus);
window.addEventListener('resize',refreshAppStatus,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&db.settings.syncOpen)autoSyncOpen();});

/* ==== شريط الحساب (تطبيق سطح المكتب) ==== */
async function electronLogout(){
 if(window.electronAPI&&window.electronAPI.logout){await window.electronAPI.logout();}
}
(async function initAcctBar(){
 try{
  if(window.electronAPI&&window.electronAPI.getUser){
   const u=await window.electronAPI.getUser();
   if(u&&u.id){
    acctInfo=u;
    acctReady=true;
    applySavedAppStyle();
    if(u.role!=='admin'){
     // لا نحتفظ بسر مساحة العمل داخل تخزين مستخدم سطح المكتب غير الإداري.
     db.settings.syncSecret='';
     db.settings.syncAuto=false;
     await persistDbSnapshot();
    }
    const el=document.getElementById('acctBarUser');
    const roleTxt=roleText(u.role);
    if(el&&u.name){el.textContent='⚽ '+u.name+' ('+roleTxt+')';}
    const addBtn=document.getElementById('acctBarAddBtn');
    if(addBtn&&u.role==='admin'){addBtn.style.display='inline-block';}
    const mgBtn=document.getElementById('acctBarManageBtn');
    if(mgBtn&&u.role==='admin'){mgBtn.style.display='inline-block';}
    render(); // إعادة الرسم الآن بعد معرفة صلاحيات الحساب لتصفية القائمة والصفحة الحالية
	    if(db.settings.syncOpen)autoSyncOpen();
   }
  }else if(window.electronAPI){
   acctReady=true;
   render();
  }
 }catch(e){if(window.electronAPI){acctReady=true;acctInfo=null;render();}}
})();

/* ==== دعوات الهاتف بالرابط + تفعيل/تعطيل حسابات الخادم (للمدير، من نسخة الحاسوب) ==== */
async function invPost(path,payload){
 if(!syncReady()||(!mobileInfo&&!(db.settings.syncSecret||'').trim()))return {ok:false,message:'أكمل إعداد مساحة المزامنة من جهاز المدير أولاً.'};
 try{const r=await fetch(syncApiUrl(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody(payload||{}))});const j=await r.json().catch(()=>null);return r.ok&&j&&j.ok?j:{ok:false,message:(j&&j.message)||('HTTP '+r.status)};}catch(e){return {ok:false,message:e.message};}
}
function invShare(url){return 'https://wa.me/?text='+encodeURIComponent('مرحباً، هذا رابط دعوتك إلى تطبيق ملعبنا (صالح لمدة محدودة ولاستعمال واحد):\n'+url);}
function invShowLink(r,title){
 const box=document.getElementById('invResult');if(!box)return;
 if(!r.ok){box.innerHTML='<div class="sub" style="color:#E56458">'+esc(r.message||'تعذر إنشاء الرابط.')+'</div>';return;}
 const exp=new Date(r.invite.expiresAt).toLocaleString('ar-MA');
 box.innerHTML='<div style="border:1px dashed var(--bd);border-radius:10px;padding:10px;margin-top:10px"><b>'+esc(title)+'</b><div class="sub">ينتهي: '+esc(exp)+' — يُعرض الرابط مرة واحدة فقط، انسخه الآن.</div>'+
  '<input id="invUrl" readonly dir="ltr" style="width:100%;min-height:36px;margin:8px 0;border:1px solid var(--bd);border-radius:8px;padding:0 8px" value="'+esc(r.url)+'" '+actionAttr('click',(event,el)=>el.select())+'>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" '+actionAttr('click',()=>invCopy())+'>📋 نسخ</button><a class="btn sm" target="_blank" rel="noopener" href="'+esc(invShare(r.url))+'">💬 مشاركة عبر واتساب</a></div></div>';
}
function invCopy(){const el=document.getElementById('invUrl');if(!el)return;el.select();try{navigator.clipboard.writeText(el.value);}catch(e){document.execCommand('copy');}syncToast('✅ تم نسخ الرابط');}
async function invCreate(){
 const name=(document.getElementById('invName').value||'').trim(),role=document.getElementById('invRole').value,hours=Number(document.getElementById('invHours').value)||48;
 const permissions=Array.prototype.map.call(document.querySelectorAll('.inv-perm:checked'),c=>c.value);
 if(!name){alert('أدخل اسم المدعو.');return;}
 const r=await invPost('/api/auth/invites/create',{kind:'join',name:name,role:role,permissions:permissions,hours:hours});
 invShowLink(r,'رابط دعوة '+name);if(r.ok){document.getElementById('invName').value='';invRefresh();}
}
async function invReset(id){
 const u=(window._srvUsers||[]).find(x=>x.id===id);if(!u)return;
 const r=await invPost('/api/auth/invites/create',{kind:'reset',userId:id,hours:24});
 invShowLink(r,'رابط إعادة تعيين كلمة سر '+u.name);if(r.ok)invRefresh();
}
async function invRevoke(id){if(!confirm('إلغاء هذه الدعوة؟ سيتوقف رابطها عن العمل.'))return;const r=await invPost('/api/auth/invites/revoke',{id:id});if(!r.ok)alert(r.message);invRefresh();}
async function invToggleStatus(id){
 const u=(window._srvUsers||[]).find(x=>x.id===id);if(!u)return;
 const to=u.status==='active'?'disabled':'active';
 if(to==='disabled'&&!confirm('تعطيل حساب '+u.name+'؟ سيُخرَج من جميع أجهزته ولن يستطيع الدخول حتى تعيد تفعيله.'))return;
 const r=await invPost('/api/auth/users/upsert',{name:u.name,username:u.username,role:u.role,permissions:u.permissions||[],status:to});
 if(!r.ok)alert(r.message||'تعذر تغيير الحالة.');invRefresh();
}
const INV_STATUS_LABEL={active:'مفعّل',pending:'معلّق',disabled:'معطّل'};
async function invRefresh(){
 const el=document.getElementById('invLists');if(!el)return;
 if(!syncReady()){el.innerHTML='<div class="sub">أكمل إعداد المزامنة (الإعدادات ← المزامنة) لتفعيل الدعوات وحسابات الهاتف.</div>';return;}
 const [ri,ru]=await Promise.all([invPost('/api/auth/invites/list'),invPost('/api/auth/users/list')]);
 window._srvUsers=ru.ok?ru.users:[];
 let h='';
 if(!ri.ok||!ru.ok)h+='<div class="sub" style="color:#E56458">'+esc((ri.message||ru.message)||'تعذر الاتصال بالخادم.')+'</div>';
 if(ri.ok){h+='<div class="sub" style="margin-top:10px"><b>الدعوات المعلّقة ('+ri.invites.length+')</b></div>'+(ri.invites.length?ri.invites.map(iv=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--bd)"><div>'+(iv.kind==='reset'?'🔑 إعادة تعيين — ':'➕ ')+esc(iv.name)+'<div class="sub">ينتهي '+esc(new Date(iv.expiresAt).toLocaleString('ar-MA'))+'</div></div><button class="btn sm danger" '+actionAttr('click',()=>invRevoke(iv.id))+'>إلغاء</button></div>').join(''):'<div class="sub">لا توجد دعوات معلّقة.</div>');}
 if(ru.ok){h+='<div class="sub" style="margin-top:12px"><b>حسابات الهاتف على الخادم ('+ru.users.length+')</b></div>'+(ru.users.length?ru.users.map(u=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--bd)"><div><b>'+esc(u.name)+'</b> <span class="sub">@'+esc(u.username)+' — '+esc(INV_STATUS_LABEL[u.status]||u.status)+'</span></div><div style="display:flex;gap:6px"><button class="btn sm" '+actionAttr('click',()=>invReset(u.id))+'>🔑 رابط إعادة تعيين</button><button class="btn sm '+(u.status==='active'?'danger':'')+'" '+actionAttr('click',()=>invToggleStatus(u.id))+'>'+(u.status==='active'?'تعطيل':'تفعيل')+'</button></div></div>').join(''):'<div class="sub">لا توجد حسابات هاتف بعد.</div>');}
 el.innerHTML=h;
}
function renderInvitePanel(){
 const list=document.getElementById('manageAcctList');if(!list)return;
 let p=document.getElementById('manageInvitePanel');
 if(!p){
  p=document.createElement('div');p.id='manageInvitePanel';p.className='card';p.style.marginBottom='14px';
  const perms=permItems().map(n=>'<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;min-width:150px"><input type="checkbox" class="inv-perm" value="'+n.id+'"> '+n.i+' '+esc(n.l)+'</label>').join('');
  p.innerHTML='<b>🔗 دعوة مستخدم هاتف بالرابط</b><div class="sub">أنشئ رابطاً يستعمل مرة واحدة؛ يختار المدعو اسم المستخدم وكلمة السر بنفسه، فلا تمرّ كلمة سر عبرك.</div>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><input id="invName" placeholder="اسم المدعو" style="min-height:36px;border:1px solid var(--bd);border-radius:8px;padding:0 8px;flex:1;min-width:150px">'+
   '<select id="invRole" style="min-height:36px;border:1px solid var(--bd);border-radius:8px;padding:0 8px">'+roleOptionsHTML('member')+'</select>'+
   '<select id="invHours" style="min-height:36px;border:1px solid var(--bd);border-radius:8px;padding:0 8px"><option value="24">24 ساعة</option><option value="48" selected>48 ساعة</option><option value="72">3 أيام</option><option value="168">7 أيام</option></select>'+
   '<button class="btn primary sm" '+actionAttr('click',()=>invCreate())+'>إنشاء الرابط</button></div>'+
   '<details><summary class="sub" style="cursor:pointer">الصلاحيات (للأدوار غير المدير)</summary><div style="display:flex;flex-wrap:wrap;gap:8px 14px;padding-top:8px">'+perms+'</div></details>'+
   '<div id="invResult"></div><div id="invLists"></div>';
  list.parentNode.insertBefore(p,list);
 }
 invRefresh();
}

/* ==== نافذة إدارة الحسابات والصلاحيات (للمدير فقط) ==== */
function openManageAccountsModal(){
 const ov=document.getElementById('manageAcctOv');
 ov.style.display='flex';ov.setAttribute('aria-hidden','false');
 loadManageAccounts();
}
function closeManageAccountsModal(){
 const ov=document.getElementById('manageAcctOv');
 ov.style.display='none';ov.setAttribute('aria-hidden','true');
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.getElementById('manageAcctOv').style.display==='flex')closeManageAccountsModal();
});
async function loadManageAccounts(){
 const list=document.getElementById('manageAcctList');
 list.innerHTML='<div class="sub">جارٍ التحميل…</div>';
 if(!window.electronAPI||!window.electronAPI.listUsers){list.innerHTML='<div class="sub">هذه الميزة غير متاحة إلا داخل تطبيق سطح المكتب.</div>';return;}
 try{
  const res=await window.electronAPI.listUsers();
  if(res&&res.ok)window._managedUsers=res.users||[];
  if(!res||!res.ok){list.innerHTML='<div class="sub" style="color:#E56458">'+esc((res&&res.message)||'تعذر التحميل.')+'</div>';return;}
  list.innerHTML=res.users.map(manageAcctRowHTML).join('');
  renderInvitePanel();
 }catch(e){list.innerHTML='<div class="sub" style="color:#E56458">حدث خطأ غير متوقع.</div>';}
}
function manageAcctRowHTML(u){
 const perms=Array.isArray(u.permissions)?u.permissions:[];
 const pagesHTML=permItems().map(n=>
  '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;min-width:150px">'+
  '<input type="checkbox" class="ma-perm" data-id="'+esc(u.id)+'" value="'+n.id+'" '+(perms.indexOf(n.id)>=0?'checked':'')+'>'+
  n.i+' '+esc(n.l)+'</label>'
 ).join('');
 return '<div class="card" style="margin-bottom:12px">'+
  '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">'+
   '<div><b>'+esc(u.name)+'</b><div class="sub">@'+esc(u.username)+'</div></div>'+
   '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
    '<select id="ma-role-'+esc(u.id)+'" style="min-height:36px;border:1px solid var(--bd);border-radius:8px;padding:0 8px">'+roleOptionsHTML(u.role)+'</select>'+
    '<button class="btn sm" '+actionAttr('click',()=>saveAccountPermissions(u.id))+'>حفظ</button>'+
    '<button class="btn sm danger" '+actionAttr('click',()=>deleteAccount(u.id))+'>حذف</button>'+
   '</div>'+
  '</div>'+
  '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0"><input id="ma-mobile-pass-'+esc(u.id)+'" type="password" placeholder="كلمة سر الهاتف (8+)" style="min-height:34px;border:1px solid var(--bd);border-radius:8px;padding:0 8px;max-width:220px"><button class="btn sm" '+actionAttr('click',()=>registerMobileAccess(u.id))+'>📱 تفعيل / تحديث دخول الهاتف</button></div>'+
  '<div style="display:flex;flex-wrap:wrap;gap:8px 14px;border-top:1px solid var(--bd);padding-top:8px">'+pagesHTML+'</div>'+
  '<div id="ma-msg-'+esc(u.id)+'" class="sub" style="margin-top:6px;min-height:14px"></div>'+
 '</div>';
}
async function registerMobileAccess(id){const u=(window._managedUsers||[]).find(x=>x.id===id),el=document.getElementById('ma-mobile-pass-'+id),pass=String((el||{}).value||'');if(!u)return;if(!syncReady()){alert('أكمل إعداد المزامنة من جهاز المدير أولاً.');return;}if(pass.length<8){alert('كلمة سر الهاتف يجب أن تكون 8 أحرف على الأقل.');return;}const r=await mobileServerUpsert({name:u.name,username:u.username,password:pass,role:u.role,permissions:u.permissions||[]});if(r.ok){if(el)el.value='';alert('تم تفعيل دخول الهاتف للحساب '+u.name+' بنجاح.');}else alert(r.message||'تعذر تفعيل الحساب للهاتف.');}
async function saveAccountPermissions(id){
 const msg=document.getElementById('ma-msg-'+id);
 const roleSel=document.getElementById('ma-role-'+id);
 const role=roleSel?roleSel.value:'member';
 const checks=document.querySelectorAll('.ma-perm[data-id="'+id+'"]:checked');
 const permissions=Array.prototype.map.call(checks,c=>c.value);
 if(msg){msg.style.color='';msg.textContent='جارٍ الحفظ…';}
 try{
  const res=await window.electronAPI.updatePermissions({id,role,permissions});
  if(res&&res.ok){
   if(msg){msg.style.color='#2b6b4a';msg.textContent='✔️ تم الحفظ محلياً.';}
   const u=(window._managedUsers||[]).find(x=>x.id===id);
   if(syncReady()&&u){const mr=await mobileServerUpsert({name:u.name,username:u.username,role:role,permissions:permissions});if(mr.ok){if(msg)msg.textContent='✔️ تم حفظ الصلاحيات محلياً وعلى الهاتف.';}else if(msg)msg.textContent='✔️ محلياً — لم يُحدّث الهاتف: '+(mr.message||'الحساب غير مفعّل هاتفياً.');}
   if(acctInfo&&acctInfo.id===id){acctInfo.role=role;acctInfo.permissions=permissions;render();}
  }else{
   if(msg){msg.style.color='#E56458';msg.textContent=(res&&res.message)||'تعذر الحفظ.';}
  }
 }catch(e){if(msg){msg.style.color='#E56458';msg.textContent='حدث خطأ غير متوقع.';}}
}
async function deleteAccount(id){
 if(!confirm('هل تريد حذف هذا الحساب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.'))return;
 try{
  const res=await window.electronAPI.deleteUser({id});
  if(res&&res.ok){if(syncReady()){try{const mu=(window._managedUsers||[]).find(x=>x.id===id);await fetch(syncApiUrl('/api/auth/users/delete'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(syncAuthBody({id:id,username:mu&&mu.username||''}))});}catch(e){}}loadManageAccounts();}
  else{alert((res&&res.message)||'تعذر الحذف.');}
 }catch(e){alert('حدث خطأ غير متوقع.');}
}

/* ==== نافذة إضافة حساب جديد من داخل التطبيق (للمدير فقط) ==== */
function renderNaPerms(){
 const c=document.getElementById('naPerms');
 if(!c)return;
 c.innerHTML=permItems().map(n=>
  '<label style="display:flex;align-items:center;gap:5px;font-size:12px;min-width:120px"><input type="checkbox" class="na-perm" value="'+n.id+'"> '+n.i+' '+esc(n.l)+'</label>'
 ).join('');
}
function toggleNaPermsVisibility(){
 const r=(document.getElementById('naRole')||{}).value||'member';
 const wrap=document.getElementById('naPermsWrap');
 if(wrap)wrap.style.display=r==='admin'?'none':'';
}
function openNewAccountModal(){
 const ov=document.getElementById('newAcctOv');
 document.getElementById('naName').value='';
 document.getElementById('naUser').value='';
 document.getElementById('naPass').value='';
 document.getElementById('naRole').value='member';
 renderNaPerms();
 toggleNaPermsVisibility();
 const msg=document.getElementById('naMsg');msg.textContent='';msg.style.color='';
 ov.style.display='flex';ov.setAttribute('aria-hidden','false');
 setTimeout(()=>document.getElementById('naName').focus(),50);
}
function closeNewAccountModal(){
 const ov=document.getElementById('newAcctOv');
 ov.style.display='none';ov.setAttribute('aria-hidden','true');
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.getElementById('newAcctOv').style.display==='flex')closeNewAccountModal();
});
async function submitNewAccount(){
 const btn=document.getElementById('naSubmitBtn');
 const msg=document.getElementById('naMsg');
 const name=document.getElementById('naName').value.trim();
 const username=document.getElementById('naUser').value.trim();
 const password=document.getElementById('naPass').value;
 const role=document.getElementById('naRole').value;
 msg.style.color='#E56458';
 if(!name||!username||!password){msg.textContent='يرجى ملء جميع الحقول.';return;}
 if(password.length<8){msg.textContent='كلمة السر يجب أن تكون 8 أحرف على الأقل.';return;}
 if(!window.electronAPI||!window.electronAPI.adminCreateAccount){msg.textContent='هذه الميزة غير متاحة.';return;}
 const permissions=Array.prototype.map.call(document.querySelectorAll('.na-perm:checked'),c=>c.value);
 btn.disabled=true;btn.textContent='جارٍ الإنشاء…';
 try{
  const res=await window.electronAPI.adminCreateAccount({name,username,password,role,permissions});
  if(res&&res.ok){
   msg.style.color='#2b6b4a';
   msg.textContent='تم إنشاء الحساب محلياً.';
   if(syncReady()){const mr=await mobileServerUpsert({name,username,password,role,permissions});if(mr.ok)msg.textContent='تم إنشاء الحساب وتفعيل دخوله من الهاتف.';else msg.textContent='تم إنشاء الحساب محلياً، لكن تعذر تفعيل الهاتف: '+(mr.message||'تحقق من المزامنة.');}
   setTimeout(closeNewAccountModal,1300);
  }else{
   msg.style.color='#E56458';
   msg.textContent=(res&&res.message)||'تعذر إنشاء الحساب.';
  }
 }catch(e){
  msg.style.color='#E56458';
  msg.textContent='حدث خطأ غير متوقع.';
 }finally{
  btn.disabled=false;btn.textContent='إنشاء الحساب';
 }
}


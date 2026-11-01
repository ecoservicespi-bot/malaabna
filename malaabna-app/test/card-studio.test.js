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

const qrTexts=[];
const context=vm.createContext({
 db:{settings:{school:'مدرسة الاختبار',schoolFr:'Test School',logo:''},teams:[]},
 esc:value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 safeImg:value=>/^data:image\/[a-z]+;base64,/i.test(String(value||''))?value:'',
 qrBox:text=>{qrTexts.push(String(text));return '<span class="qr-data">QR</span>';},
});
const helpers=[
 constant('MEMBER_CARD_FIELDS'),
 constant('MEMBER_CARD_PALETTES'),
 constant('MEMBER_CARD_DEFAULT'),
 declaration('normalizeMemberCardDesign','memberCardDate'),
 declaration('memberCardDate','memberCardValidity'),
 declaration('memberCardValidity','memberCardHTML'),
 declaration('memberCardHTML','memberCardDesign'),
].join('\n');
vm.runInContext(helpers,context);

test('card-design settings accept only known palettes and fields',()=>{
 const result=vm.runInContext(`normalizeMemberCardDesign({
   title:'  بطاقة <خاصة>  ',palette:'not-a-palette',showPhoto:false,
   fields:{birth:false,unknown:false,reg:true}
 })`,context);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{
  title:'بطاقة <خاصة>',palette:'blue',showPhoto:false,showSchoolFr:true,photoWidthMm:19,photoHeightMm:25,photoFit:'cover',photoZoomPercent:100,photoPositionX:50,photoPositionY:50,photoRotateDeg:0,photoBrightnessPercent:100,photoContrastPercent:100,photoFlipH:false,
  fields:{birth:false,birthplace:true,category:true,address:true,validity:true,reg:true},
 });
});
test('photo dimensions, fit, zoom, and two-axis position are safely applied to screen, mobile, and print',()=>{
 const result=vm.runInContext(`normalizeMemberCardDesign({photoWidthMm:99,photoHeightMm:1,photoFit:'unsafe',photoZoomPercent:300,photoPositionX:-10,photoPositionY:200,photoRotateDeg:270,photoBrightnessPercent:10,photoContrastPercent:999,photoFlipH:'yes'})`,context);
 assert.equal(result.photoWidthMm,23);
 assert.equal(result.photoHeightMm,17);
 assert.equal(result.photoFit,'cover');
 assert.equal(result.photoZoomPercent,200);
 assert.equal(result.photoPositionX,0);
 assert.equal(result.photoPositionY,100);
 assert.equal(result.photoRotateDeg,180);
 assert.equal(result.photoBrightnessPercent,50);
 assert.equal(result.photoContrastPercent,150);
 assert.equal(result.photoFlipH,false);
 context.player={id:'player-ABC123',name:'لاعب تجريبي',birth:'2014-01-02',birthplace:'الرباط',cat:'U13',address:'',reg:'2025-09-01',status:'نشط',photo:''};
 const html=vm.runInContext(`memberCardHTML(player,{photoWidthMm:23,photoHeightMm:28,photoFit:'contain',photoZoomPercent:150,photoPositionX:32,photoPositionY:24,photoRotateDeg:-45,photoBrightnessPercent:120,photoContrastPercent:80,photoFlipH:true})`,context);
 assert.match(html,/--member-photo-width:99px/);
 assert.match(html,/--member-photo-height:125px/);
 assert.match(html,/--member-photo-mobile-width:82px/);
 assert.match(html,/--member-photo-print-width:23mm/);
 assert.match(html,/--member-photo-print-height:28mm/);
 assert.match(html,/--member-photo-fit:contain/);
 assert.match(html,/--member-photo-zoom:1.5/);
 assert.match(html,/--member-photo-position-x:32%/);
 assert.match(html,/--member-photo-position-y:24%/);
 assert.match(html,/--member-photo-rotate:-45deg/);
 assert.match(html,/--member-photo-brightness:1.2/);
 assert.match(html,/--member-photo-contrast:0.8/);
 assert.match(html,/--member-photo-flip:-1/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/\.member-photo:not\(\.member-photo-empty\)\{[^}]*transform-origin:var\(--member-photo-position-x,50%\) var\(--member-photo-position-y,50%\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/\.member-photo:not\(\.member-photo-empty\)\{[^}]*rotate\(var\(--member-photo-rotate,0deg\)\)[^}]*scaleX\(var\(--member-photo-flip,1\)\)/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/filter:brightness\(var\(--member-photo-brightness,1\)\) contrast\(var\(--member-photo-contrast,1\)\)/);
});

test('card preview escapes editable text and retains QR/member identity',()=>{
 context.player={id:'player-ABC123',name:'لاعب <تجريبي>',birth:'2014-01-02',birthplace:'الرباط',cat:'U13',address:'',reg:'2025-09-01',status:'نشط',photo:''};
 const html=vm.runInContext(`memberCardHTML(player,{
  title:'<script>عنوان</script>',palette:'green',showPhoto:false,showSchoolFr:false,
  fields:{birth:false,birthplace:true,category:true,address:false,validity:false,reg:false}
 })`,context);
 assert.match(html,/class="mcard member-card palette-green"/);
 assert.match(html,/&lt;script&gt;عنوان&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/تاريخ الازدياد/);
 assert.match(html,/مكان الازدياد/);
 assert.doesNotMatch(html,/member-photo-wrap/);
 assert.match(html,/class="member-qr"><span class="qr-data">QR<\/span>/);
 assert.ok(qrTexts.some(text=>text.startsWith('MALAABNA-MEMBER|ABC123|player-ABC123')));
 assert.match(html,/رقم المنخرط/);
});

test('studio access is admin-only and individual printing remains available',()=>{
 assert.match(source,/function canEditMemberCardDesign\(\)\{return isAdmin\(\)\|\|!!\(acctInfo&&acctInfo\.role==='admin'\);}/);
 assert.doesNotMatch(source,/PERM_CARD_STUDIO/);
 assert.match(source,/if\(!cardStudioOpen\|\|!canEditMemberCardDesign\(\)\)return ''/);
 assert.match(source,/عرض إطار الصورة/);
 assert.match(source,/ارتفاع إطار الصورة/);
 assert.match(source,/ملاءمة الصورة/);
 assert.match(source,/تكبير الصورة/);
 assert.match(source,/موضع الصورة أفقيًا/);
 assert.match(source,/موضع الصورة عموديًا/);
 assert.match(source,/تدوير الصورة/);
 assert.match(source,/سطوع الصورة/);
 assert.match(source,/تباين الصورة/);
 assert.match(source,/قلب الصورة أفقيًا/);
 assert.match(source,/aria-label="اختيار لاعب لبطاقة منفردة"/);
 assert.match(source,/cardPlayer\?'🖨️ طباعة بطاقة اللاعب':'🖨️ طباعة البطاقات'/);
 assert.match(source,/function saveMemberCardDesign\(\)[\s\S]*?if\(!canEditMemberCardDesign\(\)\)\{denied\(\);return;\}/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/\.card-studio\{display:grid/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','app.css'),'utf8'),/\.card-studio\{display:none!important\}/);
});

test('shared-template editing is admin-only: studio permission cannot be delegated, while player-photo editing remains admin-only',()=>{
 assert.doesNotMatch(source,/PERM_CARD_STUDIO/);
 assert.match(source,/concat\(\[PERM_SENSITIVE,PERM_APPEARANCE\]\)/);
 assert.match(source,/syncApiUrl\('\/api\/auth\/card-design'\)/);
 assert.match(source,/if\(!isAdmin\(\)\)\{denied\(\);return;\}[^]*?async function saveModal/);
 assert.match(source,/تعديل صور اللاعبين يبقى للمدير من ملفاتهم/);
});
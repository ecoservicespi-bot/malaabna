(function(){
var box=document.getElementById('box'),h=new URLSearchParams(location.hash.replace(/^#/,'')),code=h.get('c')||'',token=h.get('t')||'',info=null;
try{history.replaceState(null,'',location.pathname);}catch(e){} // إخفاء الرمز من شريط العنوان
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function post(path,body){return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return null;}).then(function(j){return {ok:r.ok&&j&&j.ok,j:j||{}};});});}
function fail(m){box.innerHTML='<div class="err" style="font-size:16px">'+esc(m)+'</div>';}
if(!code||!token){fail('رابط الدعوة ناقص. اطلب رابطاً جديداً من المدير.');return;}
post('/api/auth/invites/info',{code:code,token:token}).then(function(r){
  if(!r.ok){fail(r.j.message||'رابط الدعوة غير صالح.');return;}
  info=r.j;if(info.schoolName)document.getElementById('school').textContent=info.schoolName;
  var reset=info.kind==='reset';
  box.innerHTML='<h2 style="margin:0 0 4px;font-size:19px">'+(reset?'إعادة تعيين كلمة السر':'مرحباً '+esc(info.name))+'</h2>'+
   '<div style="opacity:.8;font-size:14px">'+(reset?'اختر كلمة سر جديدة للحساب <span class="pill">'+esc(info.username)+'</span>':'اختر اسم المستخدم وكلمة السر لإنشاء حسابك.')+'</div>'+
   (reset?'':'<label for="u">اسم المستخدم</label><input id="u" autocomplete="username" autocapitalize="none" spellcheck="false">')+
   '<label for="p1">كلمة السر (8 أحرف على الأقل)</label><input id="p1" type="password" autocomplete="new-password">'+
   '<label for="p2">أعد كتابة كلمة السر</label><input id="p2" type="password" autocomplete="new-password">'+
   '<button class="btn" id="go">'+(reset?'حفظ كلمة السر':'إنشاء الحساب')+'</button><div class="err" id="msg"></div>';
  document.getElementById('go').onclick=submit;
  document.getElementById('p2').onkeydown=function(e){if(e.key==='Enter')submit();};
});
function submit(){
  var msg=document.getElementById('msg'),go=document.getElementById('go'),u=document.getElementById('u'),p1=document.getElementById('p1').value,p2=document.getElementById('p2').value;
  msg.textContent='';
  if(p1.length<8){msg.textContent='كلمة السر يجب أن تكون 8 أحرف على الأقل.';return;}
  if(p1!==p2){msg.textContent='كلمتا السر غير متطابقتين.';return;}
  go.disabled=true;
  post('/api/auth/invites/redeem',{code:code,token:token,username:u?u.value:'',password:p1}).then(function(r){
    if(!r.ok){go.disabled=false;msg.textContent=r.j.message||'تعذر الإتمام.';return;}
    done(r.j);
  }).catch(function(){go.disabled=false;msg.textContent='تعذر الاتصال بالخادم.';});
}
function done(j){
  var link='/app/?c='+encodeURIComponent(j.code)+'&u='+encodeURIComponent(j.username);
  box.innerHTML='<h2 style="margin:0 0 6px;font-size:19px">✅ '+(j.kind==='reset'?'تم تغيير كلمة السر':'تم إنشاء حسابك')+'</h2>'+
   '<div>اسم المستخدم: <span class="pill">'+esc(j.username)+'</span></div>'+
   '<a class="btn gold" href="'+link+'">فتح التطبيق وتسجيل الدخول</a>'+
   '<h3 style="margin:18px 0 4px;font-size:16px">📱 ثبّت التطبيق على هاتفك</h3>'+
   '<ol><li><b>أندرويد (Chrome):</b> القائمة ⋮ ← «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>'+
   '<li><b>آيفون (Safari):</b> زر المشاركة ⬆︎ ← «إضافة إلى الشاشة الرئيسية».</li></ol>'+
   '<small>افتح التطبيق أولاً من الزر أعلاه، ثم نفّذ خطوات التثبيت من تلك الصفحة.</small>';
}
})();
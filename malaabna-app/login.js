function showPane(which){
 document.getElementById('tabLogin').classList.toggle('on',which==='login');
 document.getElementById('tabReg').classList.toggle('on',which==='register');
 document.getElementById('paneLogin').classList.toggle('on',which==='login');
 document.getElementById('paneReg').classList.toggle('on',which==='register');
 document.getElementById('loginMsg').textContent='';
 document.getElementById('regMsg').textContent='';
}

async function doLogin(ev){
 ev.preventDefault();
 const btn=document.getElementById('loginBtn'),msg=document.getElementById('loginMsg');
 const username=document.getElementById('lu').value.trim();
 const password=document.getElementById('lp').value;
 const remember=document.getElementById('lr').checked;
 msg.className='msg';msg.textContent='';
 if(!username||!password){msg.className='msg err';msg.textContent='أدخل اسم المستخدم وكلمة السر.';return false;}
 btn.disabled=true;btn.textContent='جارٍ التحقق…';
 try{
  const res=await window.electronAPI.login({username,password,remember});
  if(!res||!res.ok){
   msg.className='msg err';msg.textContent=(res&&res.message)||'تعذر تسجيل الدخول.';
   btn.disabled=false;btn.textContent='دخول';
  }
  // عند النجاح، تتكفل العملية الرئيسية بفتح التطبيق مباشرة.
 }catch(e){
  msg.className='msg err';msg.textContent='حدث خطأ غير متوقع.';
  btn.disabled=false;btn.textContent='دخول';
 }
 return false;
}

async function doRegister(ev){
 ev.preventDefault();
 const btn=document.getElementById('regBtn'),msg=document.getElementById('regMsg');
 const name=document.getElementById('rn').value.trim();
 const username=document.getElementById('ru').value.trim();
 const password=document.getElementById('rp').value;
 const password2=document.getElementById('rp2').value;
 msg.className='msg';msg.textContent='';
 if(!name||!username||!password){msg.className='msg err';msg.textContent='املأ جميع الحقول.';return false;}
 if(password.length<8){msg.className='msg err';msg.textContent='كلمة السر يجب أن تكون 8 أحرف على الأقل.';return false;}
 if(password!==password2){msg.className='msg err';msg.textContent='كلمتا السر غير متطابقتين.';return false;}
 if(!/^[a-zA-Z0-9_\.\-\u0600-\u06FF]{3,30}$/.test(username)){msg.className='msg err';msg.textContent='اسم المستخدم غير صالح (3 إلى 30 خانة).';return false;}
 btn.disabled=true;btn.textContent='جارٍ الإنشاء…';
 try{
  const res=await window.electronAPI.register({name,username,password});
  if(!res||!res.ok){
   msg.className='msg err';msg.textContent=(res&&res.message)||'تعذر إنشاء الحساب.';
   btn.disabled=false;btn.textContent='إنشاء الحساب والدخول';
  }
 }catch(e){
  msg.className='msg err';msg.textContent='حدث خطأ غير متوقع.';
  btn.disabled=false;btn.textContent='إنشاء الحساب والدخول';
 }
 return false;
}

// إن كان هناك حساب واحد فقط مسجلاً من قبل (أول تشغيل)، افتح تبويب إنشاء حساب مباشرة
(async function(){
 try{
  if(window.electronAPI&&window.electronAPI.hasUsers){
   const has=await window.electronAPI.hasUsers();
   if(!has)showPane('register');
   else{
    // التسجيل العام مغلق بعد إنشاء أول حساب؛ المدير ينشئ الحسابات من داخل التطبيق
    document.querySelector('.tabs').style.display='none';
    showPane('login');
   }
  }
 }catch(e){}
})();

document.getElementById('tabLogin').addEventListener('click',()=>showPane('login'));
document.getElementById('tabReg').addEventListener('click',()=>showPane('register'));
document.getElementById('formLogin').addEventListener('submit',doLogin);
document.getElementById('formReg').addEventListener('submit',doRegister);

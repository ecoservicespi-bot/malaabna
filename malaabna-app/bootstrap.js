// تفضيل العرض محلي لهذا الجهاز، ولا يتضمن بيانات الحساب أو المدرسة.
(function(){
  var theme='dark';
  try{theme=localStorage.getItem('fsm_ui_theme')==='light'?'light':'dark';}catch(e){}
  document.documentElement.setAttribute('data-theme',theme);
  var styles=['ams','alwiam','sport-blue','violet'];
  var mobileUser=null;
  try{
    var session=window.__malaabnaMobileSession;
    mobileUser=session&&session.user?session.user:null;
  }catch(e){}
  var styleKey='fsm_ui_style_device';
  var mayChooseStyle=!mobileUser||mobileUser.role==='admin'||
    (Array.isArray(mobileUser.permissions)&&mobileUser.permissions.indexOf('appearance')>=0);
  if(mobileUser&&mobileUser.id)styleKey='fsm_ui_style_user_'+String(mobileUser.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,80);
  var style='ams';
  if(mayChooseStyle){
    try{
      var savedStyle=localStorage.getItem(styleKey);
      if(styles.indexOf(savedStyle)>=0)style=savedStyle;
    }catch(e){}
  }
  document.documentElement.setAttribute('data-style',style);

  function showStartupError(detail){
    var view=document.getElementById('view');
    if(!view)return;
    view.textContent='';
    var box=document.createElement('section');
    box.className='card web-startup-error';
    box.setAttribute('role','alert');
    var title=document.createElement('h2');
    title.textContent='تعذّر تشغيل واجهة الويب';
    var message=document.createElement('p');
    message.textContent=detail||'لم تُحمّل ملفات التطبيق كاملة. حدّث الصفحة، وإذا استمرت المشكلة حدّث ملفات الويب على الخادم ثم أعد فتح الموقع.';
    var refresh=document.createElement('button');
    refresh.className='btn primary';
    refresh.type='button';
    refresh.textContent='إعادة تحميل الصفحة';
    refresh.addEventListener('click',function(){location.reload();});
    box.append(title,message,refresh);
    view.appendChild(box);
  }

  function loadScript(src,onload){
    var script=document.createElement('script');
    script.src=src;
    script.onload=onload;
    script.onerror=function(){showStartupError('تعذّر تحميل '+src+'؛ تحقق من رفع ملفات التطبيق إلى مجلد الويب ثم أعد تحميل الصفحة.');};
    document.body.appendChild(script);
  }

  window.malaabnaVaultReady.then(function(){
    if(!window.electronAPI)document.documentElement.classList.add('web');
    var watchdog=setTimeout(function(){
      if(document.getElementById('webBootStatus'))showStartupError('بقيت الصفحة على شاشة التحميل. قد تكون نسخة الويب مخزّنة مؤقتاً أو لم تُرفع ملفات JavaScript الجديدة. حدّث ملفات الويب ثم أعد تحميل الصفحة.');
    },15000);
    loadScript('finance.js',function(){
      loadScript('scanner.js',function(){
        loadScript('app.js',function(){
          setTimeout(function(){
            if(document.getElementById('webBootStatus'))showStartupError();
            else clearTimeout(watchdog);
          },750);
          if(!window.electronAPI){var ab=document.getElementById('acctBar');if(ab)ab.style.display='none';var pw=document.createElement('script');pw.src='pwa.js';pw.onerror=function(){};document.body.appendChild(pw);}
          if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(function(){});
        });
      });
    });
  }).catch(function(error){
    document.body.innerHTML='<main dir="rtl" style="font:16px system-ui;padding:2rem;color:#8b1e1e">تعذر فتح مخزن البيانات المشفّر. لم تُحذف البيانات. أعد تشغيل التطبيق أو استرجع نسخة احتياطية.<br><small></small></main>';
    var sm=document.querySelector('small');sm.style.cssText='display:block;direction:ltr;white-space:pre-wrap;margin-top:12px;font-size:11px';sm.textContent=String(error&&(error.stack||error.message)||'').slice(0,1200);
  });
})();

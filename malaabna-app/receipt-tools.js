/* Searchable Arabic receipts; bundled jsPDF/Amiri, no network service. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MalaabnaReceipts=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const one=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
 const tens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
 const hundreds=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
 function under1000(n,linked){const h=Math.floor(n/100),r=n%100,parts=[];if(h)parts.push(h===2&&!r&&linked?'مائتا':hundreds[h]);if(r)parts.push(r<20?one[r]:((r%10?one[r%10]+' و':'')+tens[Math.floor(r/10)]));return parts.join(' و');}
 function integerWords(n,linked){if(n===0)return 'صفر';const scales=[null,['ألف','ألفان','ألفا','آلاف'],['مليون','مليونان','مليونا','ملايين'],['مليار','ملياران','مليارا','مليارات']];const chunks=[];let i=0;while(n){const part=n%1000;if(part)chunks.unshift({part:part,scale:i});n=Math.floor(n/1000);i++;}return chunks.map(function(c,index){const last=index===chunks.length-1,link=last&&linked;if(!c.scale)return under1000(c.part,link);const sc=scales[c.scale];if(c.part===1)return sc[0];if(c.part===2)return link?sc[2]:sc[1];const tail=c.part%100;return under1000(c.part,true)+' '+(tail>=3&&tail<=10?sc[3]:tail>=11&&!link?sc[0]+'اً':sc[0]);}).join(' و');}
 function counted(n,forms){if(n===1)return forms[0]+' واحد';if(n===2)return forms[1];if(n===0)return 'صفر '+forms[0];const tail=n%100;if(n>100&&tail===1)return integerWords(n-1,false)+' و'+forms[0]+' واحد';if(n>100&&tail===2)return integerWords(n-2,false)+' و'+forms[1];return integerWords(n,true)+' '+(tail>=3&&tail<=10?forms[2]:tail>=11?forms[3]:forms[0]);}
 function amountInWords(value,currency){const n=Number(value);if(!Number.isFinite(n)||n<0||n>999999999999.99)return '';const cents=Math.round((n+Number.EPSILON)*100);if(!Number.isSafeInteger(cents))return '';const whole=Math.floor(cents/100),fraction=cents%100,unit=String(currency||'درهم').trim();let main,minor;
  if(/^(درهم|درهم مغربي|MAD|د\.م\.?)$/i.test(unit)){main=['درهم','درهمان','دراهم','درهماً'];minor=['سنتيم','سنتيمان','سنتيمات','سنتيماً'];}
  else if(/^(دولار|USD|دولار أمريكي)$/i.test(unit)){main=['دولار','دولاران','دولارات','دولاراً'];minor=['سنت','سنتان','سنتات','سنتاً'];}
  else if(/^(يورو|EUR)$/i.test(unit)){main=['يورو','يوروان','يورو','يورو'];minor=['سنت','سنتان','سنتات','سنتاً'];}
  let text=main?counted(whole,main):integerWords(whole,true)+' '+unit;
  if(fraction)text+=' و'+(minor?counted(fraction,minor):integerWords(fraction,false)+' جزءاً من مائة من '+unit);
  return text+' فقط لا غير';
 }
 const base=typeof document!=='undefined'&&document.currentScript?document.currentScript.src:'';
 const pending={};
 function localScript(path){if(pending[path])return pending[path];pending[path]=new Promise(function(resolve,reject){const s=document.createElement('script');s.src=new URL(path,base||document.baseURI).href;s.onload=resolve;s.onerror=function(){delete pending[path];s.remove();reject(new Error('تعذر تحميل ملف PDF المحلي: '+path));};document.head.appendChild(s);});return pending[path];}
 async function dependencies(){if(!root.jspdf)await localScript('vendor/jspdf.umd.min.js');if(!root.MalaabnaReceiptFonts)await localScript('vendor/receipt-fonts.js');if(!root.jspdf||!root.MalaabnaReceiptFonts)throw new Error('ملفات PDF المحلية غير مكتملة.');}
 function safeImage(v){return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(String(v||''))?v:'';}
 function image(src){return new Promise(function(resolve){if(!src){resolve(null);return;}const im=new Image();im.onload=function(){resolve(im);};im.onerror=function(){resolve(null);};im.src=src;});}
 function png(im){const c=document.createElement('canvas');const scale=Math.min(1,600/Math.max(im.width,im.height));c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/png');}
 async function createPDF(model){
  await dependencies();const d=model.document||{},s=d.s||{},paper=model.paper==='a5'?'a5':'a4',small=paper==='a5';
  const pdf=new root.jspdf.jsPDF({unit:'pt',format:paper,orientation:'portrait',compress:true,putOnlyUsedFonts:true});
  pdf.addFileToVFS('Receipt-Regular.ttf',root.MalaabnaReceiptFonts.Regular);pdf.addFont('Receipt-Regular.ttf','Receipt','normal');
  pdf.addFileToVFS('Receipt-Bold.ttf',root.MalaabnaReceiptFonts.Bold);pdf.addFont('Receipt-Bold.ttf','Receipt','bold');pdf.setLanguage('ar');
  pdf.setProperties({title:(model.title||'وصل')+' — '+(d.rec||''),subject:'وثيقة مالية — '+(d.school||''),creator:'ملعبنا',author:d.school||''});
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight(),L=small?24:36,R=W-L,CW=R-L,BOTTOM=H-49;
  const ink='#203542',navy='#173e51',muted='#596a75',gold='#c6a252',pale='#f4f7f8',border='#dce3e6';
  function font(size,bold){pdf.setFont('Receipt',bold?'bold':'normal');pdf.setFontSize(size);}
  function text(value,x,y,size,color,bold){const str=String(value==null||value===''?'—':value);font(size||12,bold);pdf.setTextColor(color||ink);pdf.text(str,x,y,{align:'right',isInputVisual:false,isOutputVisual:true,isInputRtl:/[\u0600-\u06ff]/.test(str),isOutputRtl:false});}
  function width(str,size,bold){font(size,bold);return pdf.getTextWidth(str);}
  function wrap(value,max,size,bold){const lines=[];for(const paragraph of String(value==null||value===''?'—':value).split(/\r?\n/)){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(width(word,size,bold)>max){if(line){lines.push(line);line='';}let part='';for(const char of word){if(part&&width(part+char,size,bold)>max){lines.push(part);part=char;}else part+=char;}line=part;}else if(line&&width(line+' '+word,size,bold)>max){lines.push(line);line=word;}else line=line?line+' '+word:word;}lines.push(line||' ');}return lines;}
  function rect(x,y,w,h,color){pdf.setFillColor(color);pdf.rect(x,y,w,h,'F');}
  function rule(y){pdf.setDrawColor(border);pdf.setLineWidth(.5);pdf.line(L,y,R,y);}
  function fitted(im,x,y,w,h){if(!im)return;const scale=Math.min(w/im.width,h/im.height),iw=im.width*scale,ih=im.height*scale;pdf.addImage(png(im),'PNG',x+(w-iw)/2,y+(h-ih)/2,iw,ih,undefined,'FAST');}
  const logo=await image(safeImage(d.logo)),stamp=await image(safeImage(d.stamp));
  const qr=model.qrSVG?await image('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(model.qrSVG)):null;
  let y=0,page=0;
  function pageHeader(){page++;const nameLines=wrap(d.school||'مدرسة كرة القدم',CW-85,small?16:20,true);const contacts=[d.address,d.schoolPhone?'هاتف المدرسة: '+d.schoolPhone:''].filter(Boolean).flatMap(v=>wrap(v,CW-85,10.5,false));const h=Math.max(small?84:100,28+nameLines.length*(small?21:25)+contacts.length*14);
   rect(0,0,W,h,navy);rect(0,h-3,W,3,gold);if(logo){rect(L,20,68,65,'#ffffff');fitted(logo,L+5,25,58,55);}
   nameLines.forEach((v,i)=>text(v,R,30+i*(small?21:25),small?16:20,'#ffffff',true));contacts.forEach((v,i)=>text(v,R,32+nameLines.length*(small?21:25)+i*14,10.5,'#eef3f5',false));
   y=h+20;text(model.title||'وصل',R,y,small?15:17,navy,true);if(model.copy){y+=17;text('نسخة مكررة — إعادة طباعة',R,y,10.5,'#624d22',true);}y+=22;
   text(model.numberLabel||'رقم الوصل',R,y,10,muted,false);
   const numbers=wrap(d.rec||'—',CW-95,10.5,true);numbers.forEach((v,i)=>text(v,R-85,y+i*14,10.5,ink,true));y+=Math.max(17,numbers.length*14);
   text('تاريخ الإصدار',R,y,10,muted,false);text(String(d.issuedAt||'').slice(0,10),R-85,y,10.5,ink,true);y+=17;
   if(model.copy){text('إعداد النسخة',R,y,9.5,muted,false);const dates=wrap(model.copy.displayDate,CW-95,9.5,false);dates.forEach((v,i)=>text(v,R-85,y+i*13,9.5,ink,false));y+=Math.max(16,dates.length*13);}y+=8;
   if(page>1){text('تابع بيانات الوصل',R,y,11,muted,false);y+=19;}
  }
  function next(){pdf.addPage(paper,'portrait');pageHeader();}
  function ensure(h){if(y+h>BOTTOM)next();}
  pageHeader();
  const identity=[d.p&&d.p.name, [d.p&&d.p.cat,d.team&&d.team.name].filter(Boolean).join(' — '), d.par&&d.par.name?'ولي الأمر: '+d.par.name:''].filter(Boolean);
  for(let i=0;i<identity.length;i++){const lines=wrap(identity[i],CW-24,i===0?14:11,i===0);for(const line of lines){ensure(23);text(line,R-12,y+15,i===0?14:11,i===0?navy:muted,i===0);y+=21;}}y+=7;
  // Totals are compact and only appear once; no duplication of amounts across pages.
  const totals=model.totals||(d.type==='exemption'?[['المبلغ المعفى',model.primaryAmount],['المستحق',d.due],['المتبقي',d.rest]]:[['المبلغ المؤدى',d.paid],['المستحق',d.due],['المتبقي',d.rest]]);
  const money=n=>(Number(n)||0).toLocaleString('fr-MA')+' '+(d.currency||'درهم');
  const totalSize=small?13:16,cardW=(CW-16)/3;const cardLines=totals.map(r=>wrap(money(r[1]),cardW-16,totalSize,true));const cardH=34+Math.max(...cardLines.map(v=>v.length))*19;ensure(cardH+10);
  totals.forEach(function(r,i){const left=R-cardW-i*(cardW+8);rect(left,y,cardW,cardH,i===0?navy:pale);text(r[0],left+cardW-8,y+18,small?9.5:11,i===0?'#eef3f5':muted,false);const lines=cardLines[i];lines.forEach((v,j)=>text(v,left+cardW-8,y+38+j*17,totalSize,i===0?'#fff':ink,true));});y+=cardH+13;
  if(model.plan){const plan=model.plan;const title='خطة رسوم التسجيل — الدفعة '+plan.number+' من '+plan.count;const note=wrap(plan.note,CW-24,10,false);const ph=plan.complete?64+note.length*14:28+note.length*14;ensure(ph+10);rect(L,y,CW,ph,pale);text(title,R-12,y+17,12,navy,true);
   if(plan.complete){[['إجمالي الخطة',plan.totalDue],['المؤدى من الخطة',plan.totalPaid],['متبقي الخطة',plan.totalRest]].forEach(function(r,i){const right=R-12-i*(CW/3);text(r[0],right,y+34,10,muted,false);text(money(r[1]),right,y+51,12,ink,true);});}
   note.forEach((v,i)=>text(v,R-12,y+(plan.complete?68:34)+i*14,10,muted,false));y+=ph+13;
  }
  // A long statement flows in readable chunks, rather than a cropped fixed box.
  const statement=wrap(model.statement,CW-28,12,false);let at=0;
  while(at<statement.length){ensure(63);const count=Math.min(statement.length-at,Math.max(1,Math.floor((BOTTOM-y-35)/17)));const h=count*17+32;rect(L,y,CW,h,pale);rect(R-3,y,3,h,gold);text(at?'تابع البيان':(d.type==='exemption'?'بيان الإعفاء':'إقرار الاستلام'),R-12,y+17,12,navy,true);for(let i=0;i<count;i++)text(statement[at+i],R-12,y+35+i*17,12,ink,false);y+=h+13;at+=count;if(at<statement.length)next();}
  ensure(55);text('تفاصيل الوصل',R,y,13,navy,true);y+=10;
  const labelW=CW*.40,valueW=CW-labelW;
  (model.rows||[]).filter(row=>!['وليّ أمر اللاعب/اللاعبة','اسم اللاعب/اللاعبة','الفئة / الفريق'].includes(row[0])).forEach(function(row,index){const labels=wrap(row[0],labelW-20,11,false),values=wrap(row[1],valueW-20,12,true);let a=0,b=0;
   while(a<labels.length||b<values.length){ensure(33);const slots=Math.max(1,Math.floor((BOTTOM-y-10)/16));const take=Math.min(Math.max(labels.length-a,values.length-b),slots);const h=take*16+(d.payment?8:10);rect(L,y,CW,h,index%2===0?pale:'#ffffff');
    for(let i=0;i<take;i++){if(a+i<labels.length)text(labels[a+i],R-10,y+18+i*16,11,muted,false);if(b+i<values.length)text(values[b+i],R-labelW-10,y+18+i*16,12,ink,true);}
    rule(y+h);y+=h;a+=take;b+=take;if(a<labels.length||b<values.length){next();text('تابع: '+row[0],R,y,11,muted,false);y+=12;}
   }
  });
  // Keep the signature/QR together on the last page.
  const director=wrap(d.directorName||'……………………',CW-140,12,true),role=wrap(d.directorRole||'مدير المدرسة',CW-140,10.5,false);
  const footerH=110+(director.length+role.length-2)*16;
  ensure(footerH);y+=10;rule(y);y+=12;if(qr){fitted(qr,L,y,78,78);text('تحقق من الوصل',L+85,y+94,9.5,muted,false);if(model.verificationURL)pdf.link(L,y,78,78,{url:model.verificationURL});}else{text('التحقق غير مفعّل',L+110,y+28,10,muted,true);}
  text('توقيع المسؤول والختم',R,y+12,12,navy,true);if(stamp)fitted(stamp,R-140,y+18,120,38);
  let signY=y+67;director.forEach(v=>{text(v,R,signY,12,ink,true);signY+=16;});role.forEach(v=>{text(v,R,signY,10.5,muted,false);signY+=15;});
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);rule(H-43);text(model.verificationURL?'التحقق على خادم المدرسة؛ ليس توقيعاً إلكترونياً معتمداً.':'لا يوجد رابط تحقق إلكتروني معتمد لهذه النسخة.',R,H-25,9.5,muted,false);text('صفحة '+i+' من '+pages+' — '+paper.toUpperCase(),R,H-11,9.5,muted,false);}
  return pdf.output('blob');
 }
 async function createAccountPDF(model){
  await dependencies();const d=model.school||{},p=model.player||{},a=model.account;
  if(!a||!Array.isArray(a.groups))throw new Error('بيانات كشف الحساب غير متاحة.');
  const pdf=new root.jspdf.jsPDF({unit:'pt',format:'a4',orientation:'portrait',compress:true,putOnlyUsedFonts:true});
  pdf.addFileToVFS('Receipt-Regular.ttf',root.MalaabnaReceiptFonts.Regular);pdf.addFont('Receipt-Regular.ttf','Receipt','normal');pdf.addFileToVFS('Receipt-Bold.ttf',root.MalaabnaReceiptFonts.Bold);pdf.addFont('Receipt-Bold.ttf','Receipt','bold');pdf.setLanguage('ar');
  pdf.setProperties({title:'كشف حساب اللاعب — '+p.name,subject:'الوضع الحالي للرسوم والأداءات',creator:'ملعبنا',author:d.school||''});
  const W=pdf.internal.pageSize.getWidth(),H=pdf.internal.pageSize.getHeight(),L=36,R=W-36,CW=R-L,BOTTOM=H-48;
  const ink='#203542',navy='#173e51',muted='#596a75',gold='#c6a252',pale='#f4f7f8',border='#dce3e6';
  function font(size,bold){pdf.setFont('Receipt',bold?'bold':'normal');pdf.setFontSize(size);}
  function text(value,x,y,size=11,color=ink,bold=false){const s=String(value==null?'':value);font(size,bold);pdf.setTextColor(color);pdf.text(s,x,y,{align:'right',isInputVisual:false,isOutputVisual:true,isInputRtl:/[\u0600-\u06ff]/.test(s),isOutputRtl:false});}
  function wrap(value,max,size=11,bold=false){font(size,bold);const out=[];for(const paragraph of String(value||'—').split(/\r?\n/)){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(pdf.getTextWidth(word)>max){if(line){out.push(line);line='';}for(const ch of word){if(line&&pdf.getTextWidth(line+ch)>max){out.push(line);line='';}line+=ch;}}else if(line&&pdf.getTextWidth(line+' '+word)>max){out.push(line);line=word;}else line=line?line+' '+word:word;}out.push(line||' ');}return out;}
  function rect(x,y,w,h,color){pdf.setFillColor(color);pdf.rect(x,y,w,h,'F');}
  function rule(y){pdf.setDrawColor(border);pdf.setLineWidth(.5);pdf.line(L,y,R,y);}
  const logo=await image(safeImage(d.logo));let y=0,page=0;
  const money=n=>Number(n).toLocaleString('fr-MA',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(d.currency||'درهم');
  function header(){page++;const school=wrap(d.school||'مدرسة كرة القدم',CW-90,18,true),contact=wrap([d.address,d.schoolPhone].filter(Boolean).join(' — '),CW-90,10,false);const h=Math.max(96,32+school.length*23+contact.length*14);
   rect(0,0,W,h,navy);rect(0,h-3,W,3,gold);if(logo){const k=Math.min(58/logo.width,58/logo.height);rect(L,18,68,68,'#ffffff');pdf.addImage(png(logo),'PNG',L+5+(58-logo.width*k)/2,23+(58-logo.height*k)/2,logo.width*k,logo.height*k,undefined,'FAST');}
   school.forEach((v,i)=>text(v,R,31+i*23,18,'#ffffff',true));contact.forEach((v,i)=>text(v,R,36+school.length*23+i*14,10,'#eef3f5'));
   y=h+25;text('كشف حساب اللاعب',R,y,18,navy,true);text(String(model.preparedAt||'').slice(0,10),L+100,y,11,muted);y+=23;
   const names=wrap(p.name||'—',CW,14,true);names.forEach(v=>{text(v,R,y,14,ink,true);y+=19;});
   const cats=wrap([p.category,p.team].filter(Boolean).join(' — '),CW,11);cats.forEach(v=>{text(v,R,y,11,muted);y+=16;});y+=8;
  }
  function next(){pdf.addPage('a4','portrait');header();}
  function ensure(h){if(y+h>BOTTOM)next();}
  function paragraph(value,color=muted){const lines=wrap(value,CW-20,11);let at=0;while(at<lines.length){ensure(36);const count=Math.min(lines.length-at,Math.max(1,Math.floor((BOTTOM-y-16)/16)));rect(L,y,CW,count*16+14,pale);for(let i=0;i<count;i++)text(lines[at+i],R-10,y+18+i*16,11,color);y+=count*16+22;at+=count;if(at<lines.length)next();}}
  function heading(title){ensure(90);text(title,R,y+16,14,navy,true);y+=28;}
  function block(lines){if(lines.length<=12)ensure(lines.length*17+14);let at=0;while(at<lines.length){ensure(36);const count=Math.min(lines.length-at,Math.max(1,Math.floor((BOTTOM-y-16)/17)));rect(L,y,CW,count*17+14,pale);for(let i=0;i<count;i++){const line=lines[at+i];text(line.text,R-12,y+19+i*17,line.size||11,line.color||ink,!!line.bold);}y+=count*17+20;at+=count;if(at<lines.length)next();}}

  function values(items){const w=CW/3;items.forEach((item,i)=>{const right=R-i*w;const lines=wrap(money(item[1]),w-20,13,true);rect(right-w,y,w-6,53+Math.max(0,lines.length-1)*17,pale);text(item[0],right-12,y+17,11,muted);lines.forEach((v,j)=>text(v,right-12,y+38+j*17,13,ink,true));});y+=58;}
  header();paragraph('الوضع الحالي لجميع الرسوم المسجلة حتى إعداد الكشف. الاشتراكات الشهرية منفصلة عن رسوم التسجيل. هذا الكشف ليس وصلاً ولا يثبت أداءً جديداً.');ensure(65);values([['إجمالي المستحق',a.totals.due],['إجمالي المؤدى',a.totals.paid],['المتبقي',a.totals.rest]]);
  if(a.warnings.length)paragraph('الكشف غير مكتمل: '+a.warnings.join('؛ ')+'؛ المجاميع لا تشمل السجلات ذات المبالغ غير الصالحة.','#9b2525');
  let feeCount=0;
  for(const group of a.groups){if(!group.rows.length)continue;heading(group.title);for(const row of group.rows){feeCount++;const lines=wrap(row.label+(row.exempt?' — معفى':''),CW-24,12,true).map(text=>({text,size:12,bold:true}));lines.push(...wrap('المستحق: '+money(row.due)+' — المؤدى: '+money(row.paid)+' — المتبقي: '+money(row.rest),CW-24,11).map(text=>({text})));block(lines);}
   block(wrap('مجموع القسم: '+money(group.due)+' — المؤدى: '+money(group.paid)+' — المتبقي: '+money(group.rest),CW-24,11,true).map(text=>({text,color:navy,bold:true})));
  }
  if(!feeCount)paragraph('لا توجد رسوم مسجلة لهذا اللاعب.');
  ensure(a.payments.length?200:100);heading('تفصيل الأداءات');paragraph('المبالغ السابقة المجمعة ليست سجل عمليات مفصلاً. كل أداء جديد مسجل من جدول الأقساط يظهر بمبلغه ووصل مستقل. لا تُجمع الوصولات المصححة أو النسخ المكررة مرة ثانية.');
  if(!a.payments.length)paragraph('لا توجد أداءات مسجلة.');
  for(const event of a.payments){const label=wrap(event.label,CW-24,12,true).map(text=>({text,size:12,bold:true})),metadata=wrap([event.date||'تاريخ غير موثق',event.method||'طريقة غير موثقة',event.opening?'مؤدى سابق مجمّع':'أداء مستقل'].join(' — '),CW-24,11).map(text=>({text,color:muted})),refs=wrap(event.rec||'رقم وصل غير موثق',CW-24,10).map(text=>({text,size:10,color:muted}));block(label.concat(metadata,refs,wrap(money(event.amount),CW-24,13,true).map(text=>({text,size:13,color:navy,bold:true}))));} 
  const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);rule(H-36);text('كشف حساب — ليس وصلاً جديداً',R,H-21,10,muted);text('صفحة '+i+' من '+pages,L+95,H-21,10,muted);}
  return pdf.output('blob');
 }
 return {amountInWords:amountInWords,integerWords:integerWords,createPDF:createPDF,createAccountPDF:createAccountPDF};
});

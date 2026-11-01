'use strict';
const fs=require('node:fs'),path=require('node:path');
function readStore(file,key,decrypt){
 if(!fs.existsSync(file)){
  const backups=path.join(path.dirname(file),'backups');
  if(fs.existsSync(file+'.tmp')||(fs.existsSync(backups)&&fs.readdirSync(backups).some(name=>name.endsWith('.json'))))throw new Error('ملف البيانات مفقود مع وجود كتابة سابقة أو نسخ احتياطية؛ يلزم الاسترجاع الآمن.');
  return {};
 }
 const raw=fs.readFileSync(file,'utf8');if(!raw.trim())throw new Error('ملف البيانات موجود لكنه فارغ.');
 const data=JSON.parse(decrypt(raw,key));
 if(!data||Array.isArray(data)||typeof data!=='object'||Object.values(data).some(ws=>!ws||Array.isArray(ws)||typeof ws!=='object'))throw new Error('بنية ملف المدارس غير صالحة.');
 return data;
}
async function atomicWrite(file,text){
 let handle;try{
  handle=await fs.promises.open(file+'.tmp','w',0o600);await handle.chmod(0o600);
  await handle.writeFile(text,'utf8');await handle.sync();await handle.close();handle=null;
  await fs.promises.rename(file+'.tmp',file);
  // A successful rename is the commit point. Some platforms cannot fsync dirs.
  try{const dir=await fs.promises.open(path.dirname(file),'r');try{await dir.sync();}finally{await dir.close();}}catch(_){}
 }catch(error){if(handle)try{await handle.close();}catch(_){}throw error;}
}
async function guardedWrite(file,text,guard,publish){
 let handle;try{
  handle=await fs.promises.open(file+'.tmp','w',0o600);await handle.chmod(0o600);await handle.writeFile(text,'utf8');await handle.sync();await handle.close();handle=null;
  if(!guard()){const error=new Error('تغيرت بيانات الخادم أثناء الحفظ. اجلب النسخة الأحدث ثم أعد المحاولة.');error.code='STORE_CHANGED';throw error;}
  // Guard, atomic replacement and in-memory publication have no async gap.
  fs.renameSync(file+'.tmp',file);publish();
  try{const dir=await fs.promises.open(path.dirname(file),'r');try{await dir.sync();}finally{await dir.close();}}catch(_){}
 }catch(error){if(handle)try{await handle.close();}catch(_){}throw error;}
}
function createQueue(limit=80){
 let tail=Promise.resolve(),count=0;
 function run(task){
  if(count>=limit){const error=new Error('الخادم مشغول؛ أعد المحاولة بعد قليل.');error.code='SERVER_BUSY';return Promise.reject(error);}
  count++;const result=tail.catch(()=>{}).then(task);tail=result.catch(()=>{}).finally(()=>{count--;});return result;
 }
 return {run,idle:()=>tail};
}
module.exports={readStore,atomicWrite,guardedWrite,createQueue};

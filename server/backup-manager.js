'use strict';
// Backup acknowledgements are based on committed bytes, never the live object.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {decrypt}=require('./crypt');
const {validateDbPayload,sanitizeFilesPayload}=require('./validation');
const FILE=/^workspaces-[0-9TZ._-]+\.json$/;
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function fault(code){const e=new Error(code);e.code=code;return e;}
function decode(raw,key){
 let data;try{const envelope=JSON.parse(raw);if(key&&(!envelope||envelope.__enc!==1))throw fault('backup_encryption_required');data=JSON.parse(decrypt(raw,key));}catch(e){throw fault(e.code==='backup_encryption_required'?e.code:'backup_decode_failed');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw fault('backup_schema_failed');
 for(const ws of Object.values(data)){
  if(!ws||typeof ws!=='object'||Array.isArray(ws)||(ws.secretHash!==undefined&&typeof ws.secretHash!=='string'))throw fault('backup_schema_failed');
  if(ws.db!==null&&ws.db!==undefined&&!validateDbPayload(ws.db).ok)throw fault('backup_schema_failed');
  if(sanitizeFilesPayload(ws.files)===undefined)throw fault('backup_schema_failed');
 }
 return data;
}
function write(file,text){
 const tmp=file+'.tmp';let fd;
 try{fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,text,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(tmp,file);
  try{const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}catch(_){}
 }catch(e){if(fd!==undefined)try{fs.closeSync(fd);}catch(_){}try{fs.unlinkSync(tmp);}catch(_){}throw e;}
}
function createManager({dataFile,backupDir,stateFile,externalDir='',key,max=20,now=Date.now}){
 let state={version:1,entries:[],lastSuccessAt:null,lastAttemptAt:null,error:null,external:{lastSuccessAt:null,error:null},drill:null};
 let stateWarning=null;
 try{if(fs.existsSync(stateFile)){const s=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(s.version!==1||!Array.isArray(s.entries)||s.entries.some(e=>!FILE.test(e.file)||!/^[a-f0-9]{64}$/.test(e.sha256)||!Number.isFinite(Date.parse(e.createdAt))))throw Error();state={...state,...s,external:{...state.external,...s.external}};}}catch(_){stateWarning='backup_state_unreadable';}
 function persist(next){write(stateFile,JSON.stringify(next,null,2));state=next;stateWarning=null;}
 function recordError(code){try{persist({...state,lastAttemptAt:new Date(now()).toISOString(),error:code});}catch(_){stateWarning='backup_state_write_failed';}}
 function read(file,code){
  if(!FILE.test(file))throw fault('backup_name_invalid');
  const full=path.join(backupDir,file);let raw;try{if(!fs.lstatSync(full).isFile())throw Error();raw=fs.readFileSync(full,'utf8');}catch(_){throw fault('backup_unavailable');}
  const digest=hash(raw),tracked=state.entries.find(e=>e.file===file);
  if(tracked&&tracked.sha256!==digest)throw fault('backup_checksum_failed');
  const data=decode(raw,key);if(code&&(!data[code]||!data[code].db))throw fault('backup_workspace_missing');
  return {data,raw,sha256:digest,tracked:!!tracked,file};
 }
 function files(){return fs.readdirSync(backupDir).filter(f=>FILE.test(f)&&fs.lstatSync(path.join(backupDir,f)).isFile()).sort().reverse();}
 function create(){
  try{
   const raw=fs.readFileSync(dataFile,'utf8');decode(raw,key);
   const at=new Date(now()).toISOString(),file='workspaces-'+at.replace(/[:.]/g,'-')+'-'+crypto.randomInt(100000000,999999999)+'.json';
   write(path.join(backupDir,file),raw);
   const verified=read(file);if(verified.sha256!==hash(raw))throw fault('backup_checksum_failed');
   let external={...state.external,error:null};
   if(externalDir){try{
    fs.mkdirSync(externalDir,{recursive:true,mode:0o700});
    const dest=fs.realpathSync(externalDir),root=fs.realpathSync(path.dirname(dataFile));
    if(dest===root||dest.startsWith(root+path.sep))throw fault('external_inside_data');
    write(path.join(dest,file),raw);
    if(hash(fs.readFileSync(path.join(dest,file),'utf8'))!==verified.sha256)throw fault('external_checksum_failed');
    external={lastSuccessAt:at,error:null};
   }catch(_){external={...external,error:'external_backup_failed'};}}
   const entry={file,sha256:verified.sha256,createdAt:at,bytes:Buffer.byteLength(raw)},entries=[entry,...state.entries];
   // Retention removes only tracked verified copies, and only after a new success is acknowledged.
   persist({...state,entries,lastSuccessAt:at,lastAttemptAt:at,sourceHash:hash(raw),error:null,external});
   for(const old of entries.slice(max)){try{const v=read(old.file);if(v.sha256===old.sha256)fs.unlinkSync(path.join(backupDir,old.file));}catch(_){}}
   if(entries.length>max)try{persist({...state,entries:entries.filter(e=>fs.existsSync(path.join(backupDir,e.file)))});}catch(_){stateWarning='backup_state_write_failed';}
   return {file,sha256:entry.sha256,externalCopied:!!externalDir&&!external.error};
  }catch(e){recordError(e.code&&String(e.code).startsWith('backup_')?e.code:'backup_write_failed');throw fault(state.error||'backup_write_failed');}
 }
 function status(){
  let readable=false,encrypted=false;try{const raw=fs.readFileSync(dataFile,'utf8');decode(raw,key);readable=true;encrypted=JSON.parse(raw).__enc===1;}catch(_){}
  const latest=state.entries[0];let latestVerified=false;if(latest)try{latestVerified=read(latest.file).sha256===latest.sha256;}catch(_){}
  const due=!latestVerified||!state.lastSuccessAt||now()-Date.parse(state.lastSuccessAt)>26*3600000;
  return {storage:{readable,encrypted},backup:{lastSuccessAt:state.lastSuccessAt,lastAttemptAt:state.lastAttemptAt,latestVerified,overdue:due,error:stateWarning||state.error||(latest&&!latestVerified?'backup_latest_invalid':null),count:files().length},external:{configured:!!externalDir,lastSuccessAt:state.external.lastSuccessAt,error:state.external.error,offHostConfirmed:false},drill:state.drill,drillDue:!state.drill||state.drill.status!=='passed'||!latest||state.drill.sha256!==latest.sha256||now()-Date.parse(state.drill.finishedAt)>7*86400000};
 }
 function maybeCreate(){
  if(state.lastSuccessAt&&now()-Date.parse(state.lastSuccessAt)<3600000)return null;
  let unchanged=false;try{unchanged=hash(fs.readFileSync(dataFile,'utf8'))===state.sourceHash;}catch(_){}
  let valid=false;const latest=state.entries[0];if(latest)try{valid=read(latest.file).sha256===latest.sha256;}catch(_){}
  if(unchanged&&valid&&state.lastSuccessAt&&now()-Date.parse(state.lastSuccessAt)<24*3600000)return null;
  return create();
 }
 async function drill(file,code){
  const selected=read(file,code);const {runDrill}=require('./restore-drill');
  try{const result=await runDrill({raw:selected.raw,key,code,sha256:selected.sha256});
   const done={status:'passed',finishedAt:new Date(now()).toISOString(),sha256:selected.sha256,scope:'isolated-data-roundtrip'};
   persist({...state,drill:done});return {...result,...done};
  }catch(_){try{persist({...state,drill:{status:'failed',finishedAt:new Date(now()).toISOString(),scope:'isolated-data-roundtrip'}});}catch(_){stateWarning='backup_state_write_failed';}throw fault('restore_drill_failed');}
 }
 return {create,read,files,status,maybeCreate,drill,latest:()=>state.entries[0]&&state.entries[0].file};
}
module.exports={createManager,decode,write,hash};

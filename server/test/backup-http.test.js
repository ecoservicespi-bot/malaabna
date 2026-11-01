'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{REQUIRED_COLLECTIONS}=require('../validation');
test('admin backup/status, explicit checked restore, disk failure rollback, isolation, permission and sanitized output',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backup-http48-')),port=47000+Math.floor(Math.random()*2000),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,DATA_KEY:'e'.repeat(64),BACKUP_EXTERNAL_DIR:'',ALLOW_PLAINTEXT_DATA:'false'},stdio:['ignore','pipe','pipe']});const exit=new Promise(r=>child.on('exit',r));let out='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>out+=c);
 async function api(route,body,method='POST'){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
 try{
  for(let n=0;!out.includes('يعمل على المنفذ');n++){if(n>400||child.exitCode!==null)throw Error(out);await new Promise(r=>setTimeout(r,20));}
  const created=(await api('/api/workspace/create',{schoolName:'Sensitive school name'})).body,auth={code:created.code,secret:created.secret},db={settings:{school:'Sensitive school name'}};REQUIRED_COLLECTIONS.forEach(k=>db[k]=[]);db.players=[{id:'p1',name:'Sensitive player name'}];
  const first=await api('/api/workspace/push',{...auth,db},'PUT');assert.equal(first.status,200);
  const backup=await api('/api/admin/backups',auth);assert.equal(backup.status,200);
  const verify=(await api('/api/admin/backups/verify',{...auth,file:backup.body.file})).body;assert.equal(verify.ok,true);assert.equal(verify.tracked,true);
  const status=await api('/api/admin/system/status',auth);assert.equal(status.body.backup.latestVerified,true);assert.equal(status.body.external.configured,false);for(const secret of [auth.code,auth.secret,'Sensitive',dir,'secretHash','token'])assert.ok(!JSON.stringify(status.body).includes(secret),secret);
  assert.equal((await api('/api/admin/system/status',{...auth,secret:'wrong'})).status,401);
  await api('/api/auth/users/upsert',{...auth,username:'worker',name:'Worker',password:'TestPass123',role:'member',permissions:['settings','system']});const token=(await api('/api/auth/login',{code:auth.code,username:'worker',password:'TestPass123'})).body.token;
  for(const route of ['/api/admin/system/status','/api/admin/backups','/api/admin/backups/list','/api/admin/backups/verify','/api/admin/backups/drill','/api/admin/backups/restore'])assert.equal((await api(route,{token,file:backup.body.file})).status,403,route);
  assert.equal((await api('/api/admin/backups/restore',{...auth,file:backup.body.file})).status,428);
  const before=(await api('/api/workspace/pull',auth)).body;const next=structuredClone(before.db);next.players[0].name='Newer private name';assert.equal((await api('/api/workspace/push',{...auth,db:next,baseUpdatedAt:before.updatedAt},'PUT')).status,200);
  const checked=(await api('/api/admin/backups/verify',{...auth,file:backup.body.file})).body,restore={...auth,file:backup.body.file,sha256:checked.sha256,baseUpdatedAt:checked.updatedAt,confirmation:'RESTORE'};
  assert.equal((await api('/api/admin/backups/restore',{...restore,baseUpdatedAt:'stale'})).status,409);
  const liveBefore=(await api('/api/workspace/pull',auth)).body,diskBefore=fs.readFileSync(path.join(dir,'workspaces.json'),'utf8');
  fs.mkdirSync(path.join(dir,'workspaces.json.tmp'));const failed=await api('/api/admin/backups/restore',restore);assert.equal(failed.status,503);assert.ok(failed.body.requestId);assert.equal(fs.readFileSync(path.join(dir,'workspaces.json'),'utf8'),diskBefore);assert.deepEqual((await api('/api/workspace/pull',auth)).body,liveBefore);assert.equal((await api('/api/auth/data',{token})).status,200);fs.rmdirSync(path.join(dir,'workspaces.json.tmp'));
  const drill=await api('/api/admin/backups/drill',{...auth,file:backup.body.file});assert.equal(drill.body.status,'passed');assert.equal(fs.readFileSync(path.join(dir,'workspaces.json'),'utf8'),diskBefore);
  const restored=await api('/api/admin/backups/restore',restore);assert.equal(restored.status,200);assert.equal(restored.body.scope,'school-data-and-files');const after=(await api('/api/workspace/pull',auth)).body;assert.equal(after.db.players[0].name,'Sensitive player name');assert.notEqual(after.updatedAt,liveBefore.updatedAt);assert.equal((await api('/api/auth/data',{token})).status,401);
  const newLogin=(await api('/api/auth/login',{code:auth.code,username:'worker',password:'TestPass123'})).body;assert.ok(newLogin.token,'current accounts are retained, not replaced by older backup');
  const raw=fs.readFileSync(path.join(dir,'backups',backup.body.file),'utf8');fs.writeFileSync(path.join(dir,'backups',backup.body.file),raw+' ');assert.equal((await api('/api/admin/backups/verify',{...auth,file:backup.body.file})).body.code,'backup_checksum_failed');
 }finally{if(child.exitCode===null)child.kill();await exit;fs.rmSync(dir,{recursive:true,force:true});}
});

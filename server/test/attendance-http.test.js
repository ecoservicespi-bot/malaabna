'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {REQUIRED_COLLECTIONS}=require('../validation'),{encrypt,decrypt}=require('../crypt');
const key='a'.repeat(64),cwd=path.join(__dirname,'..');
function db(name){const data={settings:{school:name}};REQUIRED_COLLECTIONS.forEach(k=>data[k]=[]);data.players=[{id:'p1',name}];return data;}
function start(dir){const port=43000+Math.floor(Math.random()*2000),child=spawn(process.execPath,['server.js'],{cwd,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,DATA_KEY:key,ALLOW_PLAINTEXT_DATA:'false',TRUST_PROXY:'false',CORS_ORIGINS:'',BACKUP_EXTERNAL_DIR:''},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);const exited=new Promise(resolve=>child.on('exit',code=>resolve(code)));return {child,exited,base:'http://127.0.0.1:'+port,async ready(){const until=Date.now()+10000;while(Date.now()<until){if(output.includes('يعمل على المنفذ'))return;if(child.exitCode!==null)throw new Error(output);await new Promise(r=>setTimeout(r,20));}throw new Error('timeout '+output);},async stop(){if(child.exitCode===null){child.kill('SIGTERM');await exited;}}};}
test('HTTP attendance is durable, validates the whole batch, checks versions, deduplicates retries and rechecks permission',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'attendance-http-')),file=path.join(dir,'workspaces.json');let s=start(dir);
 try{
  await s.ready();const req=async(route,body,method='POST')=>{const response=await fetch(s.base+route,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const created=(await req('/api/workspace/create',{schoolName:'اختبار حضور'})).body,creds={code:created.code,secret:created.secret};assert.equal(created.ok,true);
  const seed=db('اختبار');seed.players=[{id:'p1',name:'لاعب أول',team:'t1'},{id:'p2',name:'لاعب ثان',team:'t1'}];seed.teams=[{id:'t1',name:'فريق'}];
  const initial=await req('/api/workspace/push',{...creds,db:seed},'PUT');assert.equal(initial.status,200);
  const user={...creds,username:'att-worker',name:'موظف حضور',password:'SyntheticPass123',role:'member',permissions:['att','players']};assert.equal((await req('/api/auth/users/upsert',user)).status,200);
  const login=(await req('/api/auth/login',{code:created.code,username:user.username,password:user.password})).body;assert.ok(login.token);
  const send=(updates,baseUpdatedAt)=>req('/api/auth/attendance',{token:login.token,updates,baseUpdatedAt});
  const pull=async()=>{const r=await req('/api/workspace/pull',creds);assert.equal(r.status,200);return r.body;};
  const row={id:'a1',player:'p1',date:'2026-10-28',state:'🟢 حاضر',team:'t1'};
  const before=await pull(),diskBefore=fs.readFileSync(file,'utf8');fs.mkdirSync(file+'.tmp');
  const failed=await send([row],before.updatedAt);assert.equal(failed.status,503);assert.equal(failed.body.code,'attendance_storage_failed');assert.ok(failed.body.requestId);
  assert.equal(fs.readFileSync(file,'utf8'),diskBefore);assert.deepEqual(await pull(),before);
  fs.rmdirSync(file+'.tmp');const committed=await send([row],before.updatedAt);assert.equal(committed.status,200);assert.equal(committed.body.inserted,1);const after=await pull();assert.equal(after.db.attendance.length,1);assert.deepEqual(after.db.players,before.db.players);assert.notEqual(after.updatedAt,before.updatedAt);
  const diskCommitted=fs.readFileSync(file,'utf8');await s.stop();s=start(dir);await s.ready();const replay=await send([row],before.updatedAt);assert.equal(replay.status,200);assert.equal(replay.body.unchanged,1);assert.equal(replay.body.replayed,true);assert.equal(replay.body.updatedAt,after.updatedAt);assert.equal(fs.readFileSync(file,'utf8'),diskCommitted);
  const equivalent=await send([{...row,id:'other-device-id'}],after.updatedAt);assert.equal(equivalent.status,200);assert.equal((await pull()).db.attendance[0].id,'a1');assert.equal(fs.readFileSync(file,'utf8'),diskCommitted);
  const missingBase=await send([{...row,id:'a2',player:'p2'}]);assert.equal(missingBase.status,428);assert.equal(missingBase.body.code,'attendance_base_required');
  for(const batch of [[{...row,id:'a2',player:'p2'},{...row,id:'bad',player:'unknown'}],[{...row,date:'2026-02-30'}],[row,{...row,id:'another'}],[{...row,player:'p2'}]]){const rejected=await send(batch,after.updatedAt);assert.ok([400,409,422].includes(rejected.status));assert.equal(fs.readFileSync(file,'utf8'),diskCommitted);}
  assert.equal((await send(Array(5001).fill(row),after.updatedAt)).status,413);
  const race=await Promise.all([send([{...row,state:'🔴 غائب'}],after.updatedAt),send([{...row,state:'🟠 غياب مبرر'}],after.updatedAt)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const latest=await pull(),dbCopy=structuredClone(latest.db);dbCopy.settings.test='full-upload-race';
  const mixed=await Promise.all([send([{...row,id:'new-date',date:'2026-10-29'}],latest.updatedAt),req('/api/workspace/push',{...creds,db:dbCopy,baseUpdatedAt:latest.updatedAt},'PUT')]);assert.deepEqual(mixed.map(r=>r.status).sort(),[200,409]);
  const persisted=await pull();const staleNoOp=await send(persisted.db.attendance,after.updatedAt);assert.equal(staleNoOp.status,409);assert.equal(staleNoOp.body.code,'attendance_version_conflict');assert.deepEqual(await pull(),persisted);await s.stop();s=start(dir);await s.ready();assert.deepEqual(await pull(),persisted);
  assert.equal((await req('/api/auth/users/upsert',{...user,password:'',permissions:[]})).status,200);
  const forbidden=await send([{...row,id:'tomorrow',date:'2026-10-30'}],persisted.updatedAt);assert.equal(forbidden.status,403);
  const expired=await req('/api/auth/attendance',{token:'not-a-real-session',updates:[row],baseUpdatedAt:persisted.updatedAt});assert.equal(expired.status,401);
 }finally{await s.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

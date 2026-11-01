'use strict';
// A separate process + private disposable directory. No production write or HTTP server.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
async function runDrill({raw,key,code,sha256}){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[__filename,'--child'],{env:{PATH:process.env.PATH||'',DATA_KEY:key,ALLOW_LEGACY_PASSPHRASE_DATA_KEY:process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY||''},stdio:['pipe','pipe','ignore']});
  let output='',settled=false;const timer=setTimeout(()=>{child.kill('SIGKILL');finish(Error('drill_timeout'));},15000);
  function finish(e,v){if(settled)return;settled=true;clearTimeout(timer);e?reject(e):resolve(v);}
  child.on('error',e=>finish(e));child.stdin.on('error',()=>{});
  child.stdout.on('data',b=>{output+=b;if(output.length>2048){child.kill('SIGKILL');finish(Error('drill_output'));}});
  child.on('exit',exit=>{if(exit!==0)return finish(Error('drill_failed'));try{const r=JSON.parse(output);if(r.ok!==true)throw Error();finish(null,{ok:true,checks:['checksum','decrypt','schema','isolated-write','read-back']});}catch(_){finish(Error('drill_failed'));}});
  child.stdin.end(JSON.stringify({raw,code,sha256}));
 });
}
if(process.argv[2]==='--child'){
 let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>{text+=c;if(text.length>128*1024*1024)process.exit(1);});
 process.stdin.on('end',()=>{let dir;try{
  const {decode,write,hash}=require('./backup-manager'),input=JSON.parse(text);if(hash(input.raw)!==input.sha256)throw Error();
  const before=decode(input.raw,process.env.DATA_KEY);if(input.code&&!before[input.code])throw Error();
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'malaabna-drill-'));fs.chmodSync(dir,0o700);
  const file=path.join(dir,'workspaces.json');write(file,input.raw);
  const after=fs.readFileSync(file,'utf8');if(hash(after)!==input.sha256||JSON.stringify(decode(after,process.env.DATA_KEY))!==JSON.stringify(before))throw Error();
  fs.rmSync(dir,{recursive:true,force:true});process.stdout.write(JSON.stringify({ok:true}));
 }catch(_){if(dir)try{fs.rmSync(dir,{recursive:true,force:true});}catch(_){}process.exitCode=1;}});
}
module.exports={runDrill};

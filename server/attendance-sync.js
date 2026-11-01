'use strict';
// A pure planner: validation never mutates the accepted workspace.
const STATES=['🟢 حاضر','🔴 غائب','🟠 غياب مبرر','🔵 متأخر'];
const LEGACY=['حاضر','غائب','غياب مبرر','متأخر'];
function fail(status,code,message){const error=new Error(message);error.status=status;error.code=code;throw error;}
function state(value){const i=LEGACY.indexOf(value);return i<0?value:STATES[i];}
function string(value,max=80){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1F\x7F]/.test(value);}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value;}
function key(row){return JSON.stringify([row.player,row.date]);}
function planAttendance(db,updates){
 if(!Array.isArray(updates))fail(400,'invalid_attendance_batch','يجب إرسال قائمة حضور صالحة.');
 if(updates.length>5000)fail(413,'attendance_batch_too_large','قائمة الحضور أكبر من 5000 سجل. لم يُحفظ أي جزء منها. قلّل حجم الطلب.');
 const players=new Map((db.players||[]).map(p=>[p.id,p]));
 const existing=Array.isArray(db.attendance)?db.attendance:[],byId=new Map(),byKey=new Map(),duplicateIds=new Set(),duplicateKeys=new Set();
 existing.forEach((r,i)=>{if(byId.has(r.id))duplicateIds.add(r.id);byId.set(r.id,i);const k=key(r);if(byKey.has(k))duplicateKeys.add(k);byKey.set(k,i);});
 const incomingIds=new Set(),incomingKeys=new Set(),records=existing.slice();let inserted=0,updated=0,unchanged=0;
 for(const row of updates){
  if(!row||Array.isArray(row)||typeof row!=='object'||!string(row.id)||!string(row.player)||!validDate(row.date)||!STATES.includes(state(row.state))||(row.team!==undefined&&row.team!==''&&!string(row.team))||(row.waSent!==undefined&&row.waSent!==null&&(typeof row.waSent!=='string'||row.waSent.length>30)))fail(400,'invalid_attendance_record','يوجد سجل حضور غير صالح: راجع المعرّف والتاريخ والحالة. لم يُحفظ أي جزء من الطلب.');
  const player=players.get(row.player);if(!player)fail(422,'unknown_attendance_player','لا يوجد أحد اللاعبين في مدرسة هذه الجلسة. راجع النسخة الحالية دون حذف تعديلك المحلي.');
  const k=key(row);
  if(incomingIds.has(row.id)||incomingKeys.has(k))fail(400,'duplicate_attendance_batch','توجد سجلات مكررة في الطلب للاعب والتاريخ نفسيهما. راجعها قبل الإرسال.');
  incomingIds.add(row.id);incomingKeys.add(k);
  if(duplicateIds.has(row.id)||duplicateKeys.has(k))fail(409,'attendance_history_conflict','توجد سجلات حضور قديمة مكررة لهذا اللاعب والتاريخ. راجعها مع المدير؛ لم نحذف أو ندمج تاريخاً تلقائياً.');
  const indexById=byId.get(row.id),indexByKey=byKey.get(k);
  if(indexById!==undefined&&key(existing[indexById])!==k)fail(409,'attendance_identity_conflict','معرّف الحضور مرتبط بلاعب أو تاريخ آخر. لا يمكن نقل هوية السجل عبر مزامنة الحضور.');
  const index=indexByKey,old=index===undefined?null:existing[index];
  // Existing historical team association cannot be rewritten through this endpoint.
  const team=old?String(old.team||''):String(player.team||'');
  if(row.team&&row.team!==team)fail(422,'attendance_team_conflict','الفريق المرسل لا يطابق مرجع هذا السجل. راجع الفريق والنسخة الحالية قبل المزامنة.');
  const next={...(old||{}),id:old?old.id:row.id,player:row.player,date:row.date,state:state(row.state),team};
  if(row.waSent!==undefined&&row.waSent!==null)next.waSent=row.waSent;
  const same=old&&state(old.state)===next.state&&String(old.team||'')===next.team&&String(old.waSent||'')===String(next.waSent||'');
  if(same){unchanged++;continue;}
  if(old){records[index]=next;updated++;}else{records.push(next);inserted++;}
 }
 return {records,inserted,updated,unchanged,changed:inserted+updated>0};
}
module.exports={planAttendance,STATES,validDate};

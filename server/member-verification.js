'use strict';
// التحقق من بطاقة العضوية: حد أدنى فقط، دون أي بيانات حساسة.
// لا يُعرض التأمين أو الشهادة الطبية أو الهاتف أو العنوان أو الميلاد أبدًا.
// البحث برقم العضوية ومعرّف اللاعب معًا (المعرّف غير قابل للتخمين عمليًا)،
// وحالة الاشتراك تُحسب من سجلات الشهر الحالي فقط دون عرض مبالغ.
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const MEMBER_ID_RE = /^[A-Za-z0-9]{1,12}$/;
const PLAYER_ID_RE = /^[A-Za-z0-9-]{6,64}$/;
function subscriptionState(subs, playerId, now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const month = MONTHS[d.getMonth()], year = d.getFullYear();
  const rows = (subs || []).filter(s => s && s.player === playerId && s.kind === 'اشتراك شهري' && s.month === month && Number(s.year) === year);
  if (!rows.length) return 'لا يوجد سجل';
  if (rows.some(s => s.exempt === 'نعم')) return 'معفى';
  const remaining = rows.reduce((sum, s) => sum + Math.max(0, Number(s.due) || 0) - Math.max(0, Number(s.paid) || 0), 0);
  return remaining <= 0 ? 'مسدد' : 'متبقٍ';
}
function lookup(store, memberId, playerId, now) {
  if (!MEMBER_ID_RE.test(String(memberId || '')) || !PLAYER_ID_RE.test(String(playerId || ''))) return null;
  const code = String(memberId).toUpperCase();
  for (const ws of Object.values(store || {})) {
    const db = ws && ws.db;
    if (!db) continue;
    const player = (db.players || []).find(p => p && p.id === playerId && String(p.id).slice(-6).toUpperCase() === code);
    if (!player) continue;
    return {
      memberId: code,
      name: String(player.name || ''),
      status: String(player.status || ''),
      category: String(player.cat || ''),
      subscription: subscriptionState(db.subs, playerId, now),
      school: String((db.settings && db.settings.school) || ''),
    };
  }
  return null;
}
module.exports = { lookup, subscriptionState, MONTHS };

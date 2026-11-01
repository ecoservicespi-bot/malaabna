'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MemberVerification = require('../member-verification');

const PLAYER = '11111111-2222-3333-4444-555555ABCDEF';
function storeWith(player, subs, school) {
  return { school1: { db: { settings: { school: school || 'مدرسة الاختبار' }, players: [player], subs: subs || [] } } };
}
const player = { id: PLAYER, name: 'لاعب الاختبار', status: 'نشط', cat: 'U13' };

test('lookup finds a player only when membership number and id agree', () => {
  const store = storeWith(player, []);
  assert.deepEqual(MemberVerification.lookup(store, 'ABCDEF', PLAYER), { memberId: 'ABCDEF', name: 'لاعب الاختبار', status: 'نشط', category: 'U13', subscription: 'لا يوجد سجل', school: 'مدرسة الاختبار' });
  assert.equal(MemberVerification.lookup(store, 'abcdef', PLAYER).memberId, 'ABCDEF');
  assert.equal(MemberVerification.lookup(store, 'ZZZZZZ', PLAYER), null);
  assert.equal(MemberVerification.lookup(store, 'ABCDEF', 'other-player-id-123456'), null);
  assert.equal(MemberVerification.lookup(store, '', PLAYER), null);
  assert.equal(MemberVerification.lookup(store, 'ABCDEF', 'short'), null);
  assert.equal(MemberVerification.lookup(store, 'ABC DEF!', PLAYER), null);
  assert.equal(MemberVerification.lookup({}, 'ABCDEF', PLAYER), null);
  assert.equal(MemberVerification.lookup(null, 'ABCDEF', PLAYER), null);
});

test('subscription state follows the current monthly record without amounts', () => {
  const now = new Date(2026, 9, 15);
  const base = (over) => Object.assign({ player: PLAYER, kind: 'اشتراك شهري', month: 'أكتوبر', year: 2026, due: 150, paid: 0 }, over);
  assert.equal(MemberVerification.subscriptionState([base({ paid: 150 })], PLAYER, now), 'مسدد');
  assert.equal(MemberVerification.subscriptionState([base({ paid: 50 })], PLAYER, now), 'متبقٍ');
  assert.equal(MemberVerification.subscriptionState([base({ paid: 0, exempt: 'نعم' })], PLAYER, now), 'معفى');
  assert.equal(MemberVerification.subscriptionState([base({ month: 'شتنبر', paid: 150 })], PLAYER, now), 'لا يوجد سجل');
  assert.equal(MemberVerification.subscriptionState([base({ kind: 'رسوم التسجيل', paid: 150 })], PLAYER, now), 'لا يوجد سجل');
  assert.equal(MemberVerification.subscriptionState([], PLAYER, now), 'لا يوجد سجل');
});

test('lookup returns only minimum fields and passes the stored status through', () => {
  const withdrawn = { id: PLAYER, name: 'لاعب منسحب', status: 'منسحب', cat: 'U15', phone: '0600000000', address: 'عنوان', birth: '2014-01-02', med: true, ins: true };
  const result = MemberVerification.lookup(storeWith(withdrawn, []), 'ABCDEF', PLAYER);
  assert.deepEqual(Object.keys(result).sort(), ['category', 'memberId', 'name', 'school', 'status', 'subscription']);
  assert.equal(result.status, 'منسحب');
  assert.equal('phone' in result, false);
});

test('the server exposes a rate-limited member verification endpoint', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /const MemberVerification = require\('\.\/member-verification'\)/);
  assert.match(server, /const memberVerifyLimiter = rateLimit\(\{ windowMs: 15 \* 60 \* 1000, limit: 60/);
  assert.match(server, /app\.get\('\/api\/members\/verify', memberVerifyLimiter/);
  assert.match(server, /MemberVerification\.lookup\(store, req\.query\.memberId, req\.query\.playerId\)/);
  assert.match(server, /Cache-Control': 'no-store, max-age=0'/);
});

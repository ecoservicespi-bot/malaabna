const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');

test('invite page loads its script externally under the strict CSP', () => {
  const html = fs.readFileSync(path.join(publicDir, 'join.html'), 'utf8');
  assert.match(html, /<script src="\/join\.js" defer><\/script>/);
  assert.doesNotMatch(html, /<script\s*>([\s\S]*?)<\/script>/i);
  assert.ok(fs.existsSync(path.join(publicDir, 'join.js')));
});
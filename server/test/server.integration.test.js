const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { REQUIRED_COLLECTIONS } = require('../validation');
const { decrypt } = require('../crypt');

let hasRuntimeDeps = true;
try {
  require.resolve('express', { paths: [path.join(__dirname, '..')] });
  require.resolve('bcryptjs', { paths: [path.join(__dirname, '..')] });
} catch (_e) {
  hasRuntimeDeps = false;
}

function validDb() {
  const db = { settings: { school: 'اختبار' } };
  REQUIRED_COLLECTIONS.forEach((name) => { db[name] = []; });
  db.players = [{ id: 'p1', name: 'لاعب اختبار' }];
  return db;
}

test('server smoke test covers legacy encryption migration, health, validation, push/pull, role restrictions and backup', { skip: !hasRuntimeDeps }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'malaabna-test-'));
  const dataDir = path.join(root, 'data');
  const externalDir = path.join(root, 'external');
  const port = 32000 + Math.floor(Math.random() * 1000);
  const androidFingerprint = Array(32).fill('AA').join(':');
  const legacyStore = { LEGACY01: { schoolName: 'مدرسة قديمة', db: null, files: null, users: [] } };
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'workspaces.json'), JSON.stringify(legacyStore), 'utf8');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      BACKUP_EXTERNAL_DIR: externalDir,
      DATA_KEY: 'a'.repeat(64),
      ALLOW_PLAINTEXT_DATA: 'false',
      TRUST_PROXY: 'false',
      CORS_ORIGINS: 'https://school.example',
      ALLOW_NULL_ORIGIN: 'false',
      ANDROID_TWA_PACKAGE_NAME: 'com.malaabna.app',
      ANDROID_TWA_SHA256_CERT_FINGERPRINTS: androidFingerprint,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  const waitForServer = new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`server start timeout: ${output}`)), 10000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('يعمل على المنفذ')) { clearTimeout(timer); resolve(); }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== null && code !== 0) reject(new Error(`server exited: ${code} ${output}`));
    });
  });

  try {
    await waitForServer;
    const storedFile = fs.readFileSync(path.join(dataDir, 'workspaces.json'), 'utf8');
    assert.equal(JSON.parse(storedFile).__enc, 1, 'legacy plain JSON must be encrypted before the server serves requests');
    assert.deepEqual(JSON.parse(decrypt(storedFile, 'a'.repeat(64))), legacyStore, 'migration must preserve existing workspace data');
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).encryptedStorage, true);
    assert.match(health.headers.get('content-security-policy') || '', /script-src-attr 'none'/);

    const appPage = await fetch(`${base}/app/`);
    assert.equal(appPage.status, 200);
    const appHtml = await appPage.text();
    assert.match(appHtml, /script-src-attr 'none'/);
    assert.doesNotMatch(appHtml, /\bon[a-z]+\s*=\s*['"]/i);
    const appScript = await fetch(`${base}/app/app.js`);
    assert.equal(appScript.status, 200);
    assert.doesNotMatch(await appScript.text(), /\bon[a-z]+\s*=\s*['"]/i);
    const webManifest = await (await fetch(`${base}/app/manifest.webmanifest`)).json();
    assert.equal(webManifest.start_url, '/app/');
    assert.ok(webManifest.icons.some((icon) => icon.src === '/app/icon-512.png' && icon.sizes === '512x512'));
    assert.ok(webManifest.icons.some((icon) => icon.src === '/app/icon-maskable-512.png' && icon.purpose === 'maskable'));
    const assetLinksResponse = await fetch(`${base}/.well-known/assetlinks.json`);
    assert.equal(assetLinksResponse.status, 200);
    assert.deepEqual(await assetLinksResponse.json(), [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.malaabna.app',
        sha256_cert_fingerprints: [androidFingerprint],
      },
    }]);
    const allowedOrigin = await fetch(`${base}/healthz`, { headers: { Origin: 'https://school.example' } });
    assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'https://school.example');
    const opaqueOrigin = await fetch(`${base}/healthz`, { headers: { Origin: 'null' } });
    assert.equal(opaqueOrigin.headers.get('access-control-allow-origin'), null);

    const created = await (await fetch(`${base}/api/workspace/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolName: 'اختبار' }),
    })).json();
    assert.equal(created.ok, true);

    const invalid = await fetch(`${base}/api/workspace/push`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, secret: created.secret, db: { settings: {} } }),
    });
    assert.equal(invalid.status, 400);

    const pushed = await (await fetch(`${base}/api/workspace/push`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, secret: created.secret, db: validDb(), device: 'test' }),
    })).json();
    assert.equal(pushed.ok, true);

    // Two devices start from one snapshot. Only one direct correction is accepted.
    const originalReceipt = {
      id: 'receipt-original', rec: 'R-00001-1111111111111111',
      issuedAt: '2026-10-25T10:00:00Z', type: 'payment',
      s: { player: 'p1', rec: 'R-00001-1111111111111111', paid: 100, date: '2026-10-25' },
      p: { name: 'اسم تجريبي' }, due: 150, paid: 100, rest: 50,
    };
    const withOriginal = validDb(); withOriginal.receipts = [originalReceipt];
    withOriginal.settings._localSyncAck = { digest: 'device-local-only', at: '2026-10-28T10:00:00Z' };
    const upload = body => fetch(`${base}/api/workspace/push`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, secret: created.secret, ...body }),
    });
    const initialized = await (await upload({ db: withOriginal, baseUpdatedAt: pushed.updatedAt })).json();
    assert.equal(initialized.ok, true);
    const branch = (id, suffix) => {
      const db = structuredClone(withOriginal), receipt = structuredClone(originalReceipt);
      receipt.id = id; receipt.rec = 'R-00002-' + suffix; receipt.s.rec = receipt.rec;
      receipt.p.name = 'اسم مصحح ' + id;
      receipt.correction = { sourceId: originalReceipt.id, sourceRec: originalReceipt.rec,
        rootId: originalReceipt.id, preparedAt: '2026-10-28T12:00:00Z', reason: 'تصحيح تجريبي' };
      db.receipts.push(receipt); return db;
    };
    const branches = [branch('device-a', '2222222222222222'), branch('device-b', '3333333333333333')];
    const responses = await Promise.all(branches.map(db => upload({ db, baseUpdatedAt: initialized.updatedAt })));
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const acceptedIndex = responses.findIndex(response => response.status === 200);
    const acceptedResponse = await responses[acceptedIndex].json();
    assert.notEqual(acceptedResponse.updatedAt, initialized.updatedAt);
    const alternate = branches[1 - acceptedIndex];
    const forceAttempt = await upload({ db: alternate, force: true });
    assert.equal(forceAttempt.status, 409);
    assert.equal((await forceAttempt.json()).code, 'receipt_correction_conflict');
    const mergedBranches = structuredClone(branches[0]);
    mergedBranches.receipts.push(branches[1].receipts[1]);
    const divergent = await upload({ db: mergedBranches, force: true });
    assert.equal(divergent.status, 409);
    assert.equal((await divergent.json()).code, 'receipt_correction_conflict');
    const droppingHistory = await upload({ db: withOriginal, force: true });
    assert.equal(droppingHistory.status, 409);

    const pulled = await (await fetch(`${base}/api/workspace/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, secret: created.secret }),
    })).json();
    assert.equal(pulled.ok, true);
    assert.equal(pulled.db.players[0].id, 'p1');
    assert.equal(pulled.db.settings._localSyncAck, undefined, 'device-local sync acknowledgements must not be shared');
    assert.deepEqual(pulled.db.receipts[0], originalReceipt);
    assert.equal(pulled.db.receipts.length, 2);
    assert.equal(pulled.db.receipts[1].id, branches[acceptedIndex].receipts[1].id);
    assert.equal(pulled.db.receipts[1].paid, originalReceipt.paid);
    // Further corrections must extend the accepted leaf instead of its predecessor.
    const chained = structuredClone(pulled.db), leaf = chained.receipts[1];
    const next = structuredClone(leaf);
    next.id = 'next-correction'; next.rec = 'R-00003-4444444444444444'; next.s.rec = next.rec;
    next.p.name = 'تصحيح لاحق';
    next.correction = { ...leaf.correction, sourceId: leaf.id, sourceRec: leaf.rec };
    chained.receipts.push(next);
    const chainedResponse = await upload({ db: chained, baseUpdatedAt: pulled.updatedAt });
    assert.equal(chainedResponse.status, 200);

    const memberCreated = await fetch(`${base}/api/auth/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: created.code,
        secret: created.secret,
        username: 'staff-test',
        name: 'موظف اختبار',
        password: 'TestPass123',
        role: 'member',
        permissions: [],
      }),
    });
    assert.equal(memberCreated.status, 200);

    const memberLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, username: 'staff-test', password: 'TestPass123' }),
    });
    assert.equal(memberLogin.status, 200);
    const memberToken = (await memberLogin.json()).token;
    assert.ok(memberToken);

    const memberUsersList = await fetch(`${base}/api/auth/users/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: memberToken }),
    });
    assert.equal(memberUsersList.status, 403);

    const memberPush = await fetch(`${base}/api/workspace/push`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: memberToken, db: validDb() }),
    });
    assert.equal(memberPush.status, 403);

    const memberBackup = await fetch(`${base}/api/admin/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: memberToken }),
    });
    assert.equal(memberBackup.status, 403);

    const backup = await (await fetch(`${base}/api/admin/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, secret: created.secret }),
    })).json();
    assert.equal(backup.ok, true);
    assert.equal(fs.existsSync(path.join(externalDir, backup.file)), true);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
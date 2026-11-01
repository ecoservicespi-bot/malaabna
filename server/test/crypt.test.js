const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../crypt');

test('encrypt/decrypt round trip works with a 32-byte hex key', () => {
  const key = 'a'.repeat(64);
  const input = JSON.stringify({ school: 'ملعبنا', players: [{ id: 'p1' }] });
  const encrypted = encrypt(input, key);

  assert.notEqual(encrypted, input);
  assert.deepEqual(JSON.parse(decrypt(encrypted, key)), JSON.parse(input));
});

test('wrong encryption key is rejected', () => {
  const encrypted = encrypt('private data', 'b'.repeat(64));
  assert.throws(() => decrypt(encrypted, 'c'.repeat(64)));
});

test('passphrase keys require the explicit legacy compatibility opt-in', () => {
  const previous = process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY;
  delete process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY;
  try {
    assert.throws(() => encrypt('private data', 'an old passphrase'), /64 خانة hex/);
    process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY = 'true';
    const encrypted = encrypt('private data', 'an old passphrase');
    assert.equal(decrypt(encrypted, 'an old passphrase'), 'private data');
  } finally {
    if (previous === undefined) delete process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY;
    else process.env.ALLOW_LEGACY_PASSPHRASE_DATA_KEY = previous;
  }
});

test('each encryption uses a fresh IV', () => {
  const input = 'same private data';
  const key = 'e'.repeat(64);
  const first = encrypt(input, key);
  const second = encrypt(input, key);

  assert.notEqual(first, second);
  assert.equal(decrypt(first, key), input);
  assert.equal(decrypt(second, key), input);
});

test('tampering with ciphertext is rejected by authenticated decryption', () => {
  const key = 'f'.repeat(64);
  const envelope = JSON.parse(encrypt('private data', key));
  const ciphertext = Buffer.from(envelope.data, 'base64');
  ciphertext[0] ^= 1;
  envelope.data = ciphertext.toString('base64');

  assert.throws(() => decrypt(JSON.stringify(envelope), key));
});

test('legacy plaintext data remains readable for migration', () => {
  assert.equal(decrypt('{"legacy":true}', 'd'.repeat(64)), '{"legacy":true}');
});
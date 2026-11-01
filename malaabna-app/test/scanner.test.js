const test = require('node:test');
const assert = require('node:assert/strict');
const scanner = require('../scanner.js');

test('perspective correction maps all four selected corners to a flat rectangle', () => {
  const width = 5, height = 5, pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      pixels[at] = x * 40;
      pixels[at + 1] = y * 40;
      pixels[at + 2] = 10;
      pixels[at + 3] = 255;
    }
  }
  const corrected = scanner.rectifyRgba(
    pixels,
    width,
    height,
    [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }],
    20,
    'color',
  );
  assert.equal(corrected.width, 3);
  assert.equal(corrected.height, 3);
  const first = corrected.data.slice(0, 3);
  const center = corrected.data.slice((1 * corrected.width + 1) * 4, (1 * corrected.width + 1) * 4 + 3);
  const last = corrected.data.slice((2 * corrected.width + 2) * 4, (2 * corrected.width + 2) * 4 + 3);
  assert.deepEqual(Array.from(first), [40, 40, 10]);
  assert.deepEqual(Array.from(center), [80, 80, 10]);
  assert.deepEqual(Array.from(last), [120, 120, 10]);
});

test('edge suggestion finds the approximate boundary of a high-contrast page', () => {
  const width = 40, height = 30, pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = x >= 8 && x <= 31 && y >= 5 && y <= 24 ? 245 : 24;
      const at = (y * width + x) * 4;
      pixels[at] = value; pixels[at + 1] = value; pixels[at + 2] = value; pixels[at + 3] = 255;
    }
  }
  const quad = scanner.detectDocumentQuad(pixels, width, height);
  assert.ok(quad, 'expected an edge-based suggestion');
  assert.equal(scanner.isConvexQuad(quad), true);
  assert.ok(scanner.polygonArea(quad) > width * height * 0.4);
  assert.ok(Math.abs(quad[0].x - 7) <= 2 && Math.abs(quad[0].y - 4) <= 2);
  assert.ok(Math.abs(quad[2].x - 32) <= 2 && Math.abs(quad[2].y - 25) <= 2);
});

test('invalid crossed corners are rejected', () => {
  assert.equal(scanner.isConvexQuad([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]), false);
});

test('PDF export creates a valid multi-page image document', () => {
  const jpeg = (width, height) => {
    const bytes = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
      (height >> 8) & 255, height & 255, (width >> 8) & 255, width & 255,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9,
    ]);
    return 'data:image/jpeg;base64,' + Buffer.from(bytes).toString('base64');
  };
  const pdf = scanner.createPdfFromJpegs([jpeg(600, 800), jpeg(900, 600)]);
  const text = Buffer.from(pdf).toString('latin1');
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/Width 600 \/Height 800/);
  assert.match(text, /\/Width 900 \/Height 600/);
  assert.match(text, /startxref\n\d+\n%%EOF$/);
  const xrefAt = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xrefAt, xrefAt + 5), 'xref\n');
});

test('PDF export rejects invalid and empty page lists', () => {
  assert.throws(() => scanner.createPdfFromJpegs([]), /صورة واحدة/);
  assert.throws(() => scanner.createPdfFromJpegs(['not-a-jpeg']), /يدعم PDF/);
});

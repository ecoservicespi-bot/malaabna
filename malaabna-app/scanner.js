/* Local document-scanning helpers: edge suggestions, perspective correction and filters. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MalaabnaScanner = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function polygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2;
  }

  function isConvexQuad(points) {
    if (!Array.isArray(points) || points.length !== 4) return false;
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-5) return false;
      const next = Math.sign(cross);
      if (sign && next !== sign) return false;
      sign = next;
    }
    return true;
  }

  /*
   * Suggest four document corners from strong image edges. This deliberately
   * returns a suggestion, not a promise of perfect detection: users can drag
   * each corner in the scan editor before the image is corrected.
   */
  function detectDocumentQuad(imageData, width, height) {
    const rgba = imageData && imageData.data ? imageData.data : imageData;
    if (!rgba || !width || !height || rgba.length < width * height * 4) return null;
    const gray = new Uint8Array(width * height);
    for (let i = 0, p = 0; p < gray.length; p++, i += 4) {
      gray[p] = Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
    }
    const edges = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (x < width * 0.015 || x > width * 0.985 || y < height * 0.015 || y > height * 0.985) continue;
        const at = y * width + x;
        const gx = -gray[at - width - 1] + gray[at - width + 1]
          - 2 * gray[at - 1] + 2 * gray[at + 1]
          - gray[at + width - 1] + gray[at + width + 1];
        const gy = -gray[at - width - 1] - 2 * gray[at - width] - gray[at - width + 1]
          + gray[at + width - 1] + 2 * gray[at + width] + gray[at + width + 1];
        const strength = Math.abs(gx) + Math.abs(gy);
        if (strength >= 95) edges.push({ x, y, strength, sum: x + y, diff: x - y });
      }
    }
    if (edges.length < 20) return null;
    function corner(filter, key, direction) {
      const candidates = edges.filter(filter);
      if (candidates.length < 2) return null;
      let extreme = candidates[0][key];
      for (let i = 1; i < candidates.length; i++) {
        extreme = direction < 0
          ? Math.min(extreme, candidates[i][key])
          : Math.max(extreme, candidates[i][key]);
      }
      const band = Math.max(3, Math.min(width, height) * 0.035);
      let best = null, bestScore = Infinity;
      candidates.forEach((p) => {
        const delta = Math.abs(p[key] - extreme);
        if (delta > band) return;
        const score = delta * 3 - Math.min(p.strength, 1200) / 1200;
        if (score < bestScore) { best = p; bestScore = score; }
      });
      return best ? { x: best.x, y: best.y } : null;
    }
    const points = [
      corner((p) => p.x < width * 0.57 && p.y < height * 0.57, 'sum', -1),
      corner((p) => p.x > width * 0.43 && p.y < height * 0.57, 'diff', 1),
      corner((p) => p.x > width * 0.43 && p.y > height * 0.43, 'sum', 1),
      corner((p) => p.x < width * 0.57 && p.y > height * 0.43, 'diff', -1),
    ];
    if (points.some((p) => !p) || !isConvexQuad(points)) return null;
    if (polygonArea(points) < width * height * 0.14) return null;
    if (points.some((p, i) => distance(p, points[(i + 1) % 4]) < Math.min(width, height) * 0.08)) return null;
    return points;
  }

  function solveLinear(matrix, vector) {
    const n = vector.length;
    const a = matrix.map((row, i) => row.slice().concat(vector[i]));
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      }
      if (Math.abs(a[pivot][col]) < 1e-10) throw new Error('تعذر تصحيح منظور الصورة');
      [a[col], a[pivot]] = [a[pivot], a[col]];
      const divisor = a[col][col];
      for (let j = col; j <= n; j++) a[col][j] /= divisor;
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = a[row][col];
        for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
      }
    }
    return a.map((row) => row[n]);
  }

  function perspectiveMap(sourceQuad, width, height) {
    const dest = [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: width - 1, y: height - 1 },
      { x: 0, y: height - 1 },
    ];
    const matrix = [], vector = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = dest[i], { x: u, y: v } = sourceQuad[i];
      matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); vector.push(u);
      matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]); vector.push(v);
    }
    const [a, b, c, d, e, f, g, h] = solveLinear(matrix, vector);
    return function map(x, y) {
      const denominator = g * x + h * y + 1;
      return {
        x: (a * x + b * y + c) / denominator,
        y: (d * x + e * y + f) / denominator,
      };
    };
  }

  function rectifiedSize(quad, maxDimension) {
    const width = (distance(quad[0], quad[1]) + distance(quad[3], quad[2])) / 2;
    const height = (distance(quad[0], quad[3]) + distance(quad[1], quad[2])) / 2;
    const scale = Math.min(1, (maxDimension || 2200) / Math.max(width, height));
    return {
      width: Math.max(2, Math.round(width * scale) + 1),
      height: Math.max(2, Math.round(height * scale) + 1),
    };
  }

  function otsuThreshold(histogram, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let sumBackground = 0, weightBackground = 0, bestVariance = -1, threshold = 180;
    for (let i = 0; i < 256; i++) {
      weightBackground += histogram[i];
      if (!weightBackground) continue;
      const weightForeground = total - weightBackground;
      if (!weightForeground) break;
      sumBackground += i * histogram[i];
      const meanBackground = sumBackground / weightBackground;
      const meanForeground = (sum - sumBackground) / weightForeground;
      const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
      if (variance > bestVariance) { bestVariance = variance; threshold = i; }
    }
    return threshold;
  }

  function rectifyRgba(imageData, sourceWidth, sourceHeight, quad, maxDimension, filter) {
    const src = imageData && imageData.data ? imageData.data : imageData;
    if (!src || src.length < sourceWidth * sourceHeight * 4 || !isConvexQuad(quad)) {
      throw new Error('إطار الوثيقة غير صالح');
    }
    const size = rectifiedSize(quad, maxDimension), width = size.width, height = size.height;
    const map = perspectiveMap(quad, width, height);
    const output = new Uint8ClampedArray(width * height * 4);
    const histogram = new Uint32Array(256);
    let offset = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = map(x, y), sx = Math.max(0, Math.min(sourceWidth - 1, p.x)), sy = Math.max(0, Math.min(sourceHeight - 1, p.y));
        const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(sourceWidth - 1, x0 + 1), y1 = Math.min(sourceHeight - 1, y0 + 1);
        const fx = sx - x0, fy = sy - y0;
        const i00 = (y0 * sourceWidth + x0) * 4, i10 = (y0 * sourceWidth + x1) * 4;
        const i01 = (y1 * sourceWidth + x0) * 4, i11 = (y1 * sourceWidth + x1) * 4;
        for (let c = 0; c < 3; c++) {
          const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
          const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
          output[offset + c] = top * (1 - fy) + bottom * fy;
        }
        output[offset + 3] = 255;
        const luminance = Math.round(output[offset] * 0.299 + output[offset + 1] * 0.587 + output[offset + 2] * 0.114);
        histogram[luminance]++;
        offset += 4;
      }
    }
    const mode = filter || 'enhanced';
    const threshold = mode === 'bw' ? otsuThreshold(histogram, width * height) : 0;
    for (let i = 0; i < output.length; i += 4) {
      const r = output[i], g = output[i + 1], b = output[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      if (mode === 'bw') {
        const value = luma >= threshold ? 255 : 0;
        output[i] = value; output[i + 1] = value; output[i + 2] = value;
      } else if (mode === 'gray') {
        const value = Math.max(0, Math.min(255, (luma - 128) * 1.12 + 134));
        output[i] = value; output[i + 1] = value; output[i + 2] = value;
      } else if (mode === 'enhanced') {
        const saturation = 1.08, contrast = 1.16;
        output[i] = Math.max(0, Math.min(255, ((luma + (r - luma) * saturation) - 128) * contrast + 136));
        output[i + 1] = Math.max(0, Math.min(255, ((luma + (g - luma) * saturation) - 128) * contrast + 136));
        output[i + 2] = Math.max(0, Math.min(255, ((luma + (b - luma) * saturation) - 128) * contrast + 136));
      }
    }
    return { data: output, width, height };
  }


  function decodeJpegDataUrl(dataUrl) {
    const match = /^data:image\/(?:jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
    if (!match) throw new Error('يدعم PDF صور JPEG فقط؛ أعد معالجة الصورة ثم حاول مجددًا');
    const base64 = match[1].replace(/\s/g, '');
    let bytes;
    if (typeof atob === 'function') {
      const binary = atob(base64); bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else if (typeof Buffer !== 'undefined') bytes = new Uint8Array(Buffer.from(base64, 'base64'));
    else throw new Error('متصفحك لا يدعم قراءة الصورة');
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('بيانات صورة JPEG غير صالحة');
    let width = 0, height = 0, offset = 2;
    const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 3 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if (sof.has(marker) && length >= 7) {
        height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        break;
      }
      offset += length;
    }
    if (!width || !height) throw new Error('تعذر تحديد أبعاد صورة JPEG');
    return { bytes, width, height };
  }

  function createPdfFromJpegs(dataUrls) {
    if (!Array.isArray(dataUrls) || !dataUrls.length) throw new Error('أضف صورة واحدة على الأقل');
    const enc = new TextEncoder();
    const ascii = (text) => enc.encode(text);
    const pages = dataUrls.map(decodeJpegDataUrl);
    const objectCount = 2 + pages.length * 3;
    const chunks = [ascii('%PDF-1.4\n%MALAABNA\n')];
    const offsets = new Array(objectCount + 1).fill(0);
    let length = chunks[0].length;
    const append = (chunk) => { chunks.push(chunk); length += chunk.length; };
    const addObject = (id, body) => { offsets[id] = length; append(ascii(id + ' 0 obj\n')); append(body); append(ascii('\nendobj\n')); };
    addObject(1, ascii('<< /Type /Catalog /Pages 2 0 R >>'));
    const kids = pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
    addObject(2, ascii('<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>'));
    pages.forEach((image, i) => {
      const pageId = 3 + i * 3, imageId = pageId + 1, contentId = pageId + 2;
      const landscape = image.width > image.height;
      const pageW = landscape ? 842 : 595, pageH = landscape ? 595 : 842, margin = 24;
      const scale = Math.min((pageW - margin * 2) / image.width, (pageH - margin * 2) / image.height);
      const drawW = Math.round(image.width * scale * 100) / 100, drawH = Math.round(image.height * scale * 100) / 100;
      const x = Math.round((pageW - drawW) / 2 * 100) / 100, y = Math.round((pageH - drawH) / 2 * 100) / 100;
      addObject(pageId, ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im0 ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>'));
      offsets[imageId] = length;
      append(ascii(imageId + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + image.width + ' /Height ' + image.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + image.bytes.length + ' >>\nstream\n'));
      append(image.bytes); append(ascii('\nendstream\nendobj\n'));
      const stream = ascii('q\n' + drawW + ' 0 0 ' + drawH + ' ' + x + ' ' + y + ' cm\n/Im0 Do\nQ\n');
      offsets[contentId] = length;
      append(ascii(contentId + ' 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n')); append(stream); append(ascii('endstream\nendobj\n'));
    });
    const xrefOffset = length;
    let xref = 'xref\n0 ' + (objectCount + 1) + '\n0000000000 65535 f \n';
    for (let i = 1; i <= objectCount; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    xref += 'trailer\n<< /Size ' + (objectCount + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
    append(ascii(xref));
    const output = new Uint8Array(length); let cursor = 0;
    for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
    return output;
  }

  return { detectDocumentQuad, isConvexQuad, polygonArea, rectifiedSize, perspectiveMap, rectifyRgba, createPdfFromJpegs };
}));
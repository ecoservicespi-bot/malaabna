# Offline PDF assets

- jsPDF 4.2.1, MIT: https://www.npmjs.com/package/jspdf/v/4.2.1
- Local Unicode CMap compatibility changes: see UNICODE-PATCH.md.
- Amiri Regular/Bold, SIL OFL 1.1: https://github.com/google/fonts/tree/main/ofl/amiri
- Bundled copies are loaded only from this application. No CDN or third-party requests at runtime.
- Only text/vector/image APIs are used; no HTML-to-PDF plugins or PDF autoPrint JavaScript.
- Font data is base64 to support HTTPS PWAs and Electron file URLs.
- jsQR 1.4.0, Apache-2.0: https://github.com/cozmo/jsQR — QR decoding fallback when `BarcodeDetector` is unavailable (e.g. Firefox). Loaded only from this application; no network use.
- Runtime hashes and license notices are included alongside these files.

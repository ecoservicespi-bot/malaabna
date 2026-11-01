'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function declaration(name, nextName) {
  let start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function ' + name + ' exists');
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const endMatch = nextName ? new RegExp('\\n(?:async )?function ' + nextName + '\\(').exec(source.slice(start)) : null;
  const end = endMatch ? start + endMatch.index : -1;
  return source.slice(start, end < 0 ? source.length : end).trim();
}

test('expense records support invoice attachments and safe image/PDF selection', () => {
  const expenseSchema = source.slice(source.indexOf(" expenses:{label:'المصاريف'"), source.indexOf(" equip:{label:'المعدات'"));
  assert.match(expenseSchema, /\{k:'att',l:'إرفاق الفاتورة \(صورة أو PDF\)',t:'files',full:1\}/);
  assert.match(source, /accept="image\/\*,application\/pdf"/);
  assert.match(source, /f\.size>6\*1048576/);
  assert.match(source, /'فاتورة المورد'/);
  assert.match(source, /يمكن إرفاق أكثر من فاتورة بصيغة صورة أو PDF/);
});

test('expense attachments remain in local storage and can be found by their record ID', () => {
  const db = {
    players: [{ id: 'player-1', att: [{ id: 'player-file' }] }],
    expenses: [{ id: 'expense-1', att: [{ id: 'invoice-file' }] }],
  };
  const context = vm.createContext({ db });
  vm.runInContext(declaration('attIds', 'idbGC') + '\n' + declaration('attFind', 'openAtt'), context);
  assert.deepEqual(Array.from(vm.runInContext('attIds()', context)), ['player-file', 'invoice-file']);
  assert.equal(vm.runInContext("attFind('expense-1').id", context), 'expense-1');
});

test('invoice list has a download action and downloaded filenames match the file type', async () => {
  assert.match(source, /function attListHTML\(r\)[\s\S]*?downloadAtt\(r\.id,i\)/);
  const downloaded = [];
  const context = vm.createContext({
    db: { expenses: [{ id: 'exp1', att: [{ id: 'file1', name: '../فاتورة.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,JVBERg==' }] }] },
    atob,
    Blob,
    attData: async (file) => file.data,
    downloadReceiptPdf: (blob, name) => downloaded.push({ type: blob.type, name }),
    alert: () => {},
  });
  vm.runInContext([
    declaration('attFind', 'openAtt'),
    declaration('attachmentDownloadName', 'downloadAtt'),
    declaration('downloadAtt', 'openTmpFile'),
    source.slice(source.indexOf('function dataURLtoBlob('), source.indexOf('\nasync function showBlob(', source.indexOf('function dataURLtoBlob('))),
  ].join('\n'), context);
  await vm.runInContext("downloadAtt('exp1',0)", context);
  assert.deepEqual(downloaded, [{ type: 'application/pdf', name: '.._فاتورة.pdf' }]);
});
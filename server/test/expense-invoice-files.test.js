'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function functionSource(name, nextText) {
  const start = server.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'function ' + name + ' exists');
  const end = nextText ? server.indexOf(nextText, start) : -1;
  assert.ok(end >= 0, 'end marker for ' + name + ' exists');
  return server.slice(start, end).trim();
}

const cleanMobileDb = functionSource('cleanMobileDb', '\n\n// لا نرسل مرفقات الوثائق');
const authorizedFiles = functionSource('authorizedFiles', '\nfunction sessionFromRequest');

test('mobile expense data hides invoice metadata unless the user has sensitive permission', () => {
  const context = vm.createContext({});
  vm.runInContext(cleanMobileDb, context);
  const db = { expenses: [{ id: 'exp-1', title: 'معدات', att: [{ id: 'invoice-1', name: 'supplier.pdf' }] }] };
  const ordinary = vm.runInContext(`cleanMobileDb(${JSON.stringify(db)}, {role:'member', permissions:['expenses']})`, context);
  const sensitive = vm.runInContext(`cleanMobileDb(${JSON.stringify(db)}, {role:'member', permissions:['expenses','sensitive']})`, context);
  assert.equal(Object.hasOwn(ordinary.expenses[0], 'att'), false);
  assert.equal(sensitive.expenses[0].att[0].id, 'invoice-1');
});

test('invoice file payloads require both sensitive and expense or report permission', () => {
  const context = vm.createContext({});
  vm.runInContext(authorizedFiles, context);
  const ws = {
    db: { expenses: [{ att: [{ id: 'invoice-1' }] }] },
    files: { 'invoice-1': 'invoice-data', 'unrelated-file': 'private-data' },
  };
  const authorized = vm.runInContext(`authorizedFiles(${JSON.stringify(ws)}, {role:'member', permissions:['sensitive','expenses']})`, context);
  const noSensitive = vm.runInContext(`authorizedFiles(${JSON.stringify(ws)}, {role:'member', permissions:['expenses']})`, context);
  const noExpenseAccess = vm.runInContext(`authorizedFiles(${JSON.stringify(ws)}, {role:'member', permissions:['sensitive']})`, context);
  const reports = vm.runInContext(`authorizedFiles(${JSON.stringify(ws)}, {role:'member', permissions:['sensitive','reports']})`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(authorized)), { 'invoice-1': 'invoice-data' });
  assert.deepEqual(JSON.parse(JSON.stringify(noSensitive)), {});
  assert.deepEqual(JSON.parse(JSON.stringify(noExpenseAccess)), {});
  assert.deepEqual(JSON.parse(JSON.stringify(reports)), { 'invoice-1': 'invoice-data' });
});
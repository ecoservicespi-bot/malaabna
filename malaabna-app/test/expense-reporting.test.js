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
  const next = new RegExp('\\n(?:async )?function ' + (nextName || '[A-Za-z_$][\\w$]*') + '\\(').exec(source.slice(start));
  return source.slice(start, next ? start + next.index : undefined).trim();
}

const sample = [
  { id: 'e1', date: '2026-10-04', title: 'كرات تدريب', cat: 'المعدات', benef: 'مورد ألف', inv: 'A-101', amount: 120, status: 'مؤدى' },
  { id: 'e2', date: '2026-10-18', title: 'كراء ملعب', cat: 'كراء الملعب', benef: 'مورد باء', inv: 'B-202', amount: 300, status: 'في انتظار الأداء' },
  { id: 'e3', date: '2026-11-02', title: 'نقل', cat: 'النقل', benef: 'مورد باء', inv: 'B-203', amount: 90, status: 'مؤدى' },
];

test('expense filters combine period, supplier, category, status, and invoice search', () => {
  const context = vm.createContext({ expenseFilters: {
    from: '2026-10-01', to: '2026-10-31', supplier: 'باء', category: '', status: 'في انتظار الأداء',
  } });
  vm.runInContext(declaration('expenseFilterRows', 'summarizeExpenseRows'), context);
  const ids = vm.runInContext(`expenseFilterRows(${JSON.stringify(sample)}, 'B-202')`, context).map((x) => x.id);
  assert.deepEqual(Array.from(ids), ['e2']);
  const noMatch = vm.runInContext(`expenseFilterRows(${JSON.stringify(sample)}, 'missing')`, context);
  assert.equal(noMatch.length, 0);
});

test('expense summaries separate totals, paid and pending amounts by category and supplier', () => {
  const context = vm.createContext({});
  vm.runInContext(declaration('summarizeExpenseRows'), context);
  const result = vm.runInContext(`summarizeExpenseRows(${JSON.stringify(sample)})`, context);
  assert.deepEqual(JSON.parse(JSON.stringify({
    count: result.count, total: result.total, paid: result.paid, pending: result.pending,
    categoryRent: result.byCategory['كراء الملعب'], supplierB: result.bySupplier['مورد باء'],
  })), {
    count: 3, total: 510, paid: 210, pending: 300,
    categoryRent: { count: 1, total: 300, paid: 0, pending: 300 },
    supplierB: { count: 2, total: 390, paid: 90, pending: 300 },
  });
});

test('current-month shortcut sets a full calendar-month date range', () => {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-29T12:00:00Z'])); }
  }
  const context = vm.createContext({ Date: FixedDate, expenseFilters: {}, render: () => {} });
  vm.runInContext(declaration('setExpenseCurrentMonth', 'clearExpenseFilters'), context);
  vm.runInContext('setExpenseCurrentMonth()', context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.expenseFilters)), {
    from: '2026-10-01', to: '2026-10-31',
  });
});

test('Excel export includes a summary, both breakdowns, and filtered invoice details', () => {
  const exported = [];
  const context = vm.createContext({
    expenseFilters: { from: '2026-10-01', to: '2026-10-31', supplier: '', category: '', status: '' },
    exportExcel: (name, sheets) => exported.push({ name, sheets }),
    todayISO: () => '2026-10-29',
  });
  vm.runInContext(declaration('summarizeExpenseRows') + '\n' + declaration('exportExpenseReport'), context);
  vm.runInContext(`exportExpenseReport(${JSON.stringify(sample.slice(0, 2))})`, context);
  assert.equal(exported.length, 1);
  assert.equal(exported[0].name, 'expense-report-2026-10-29');
  assert.deepEqual(Array.from(exported[0].sheets, (s) => s.title), [
    'ملخص المصاريف — 2026-10-01 — 2026-10-31',
    'المصاريف حسب النوع',
    'المصاريف حسب المورد',
    'تفاصيل المصاريف',
  ]);
  assert.deepEqual(Array.from(exported[0].sheets[3].rows[0]), [
    '2026-10-04', 'A-101', 'كرات تدريب', 'المعدات', 'مورد ألف', 120, '', 'مؤدى',
  ]);
});

test('expense page connects its filters and report export to the filtered result set', () => {
  const listPage = source.match(/^function listPage\(coll\)\{[\s\S]*?^\}/m);
  assert.ok(listPage);
  assert.match(listPage[0], /rows=expenseFilterRows\(rows,q\)/);
  assert.match(listPage[0], /expenseFiltersHTML\(\)/);
  assert.match(listPage[0], /expenseReportHTML\(rows\)/);
  assert.match(source, /function expenseFiltersHTML\(\)[\s\S]*?من تاريخ[\s\S]*?إلى تاريخ[\s\S]*?المورد \/ المستفيد[\s\S]*?نوع المصروف[\s\S]*?حالة الأداء/);
  assert.match(source, /طباعة \/ PDF/);
});
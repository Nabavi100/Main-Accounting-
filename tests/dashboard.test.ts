import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Invoice, Party } from '../src/types';
import {
  formatDashboardAmount, getMonthlySales, getPartyBalanceTotals, getRecentInvoices,
  normalizeDashboardSearch, parseDashboardDate, searchDashboardParties,
} from '../src/utils/dashboard';

const invoice = (fields: Partial<Invoice>): Invoice => ({
  id: 'invoice', invoiceNumber: '100', type: 'sell', date: '1405/07/23',
  partyId: 'party', partyName: 'طرف حساب آزمایشی', warehouseId: 'warehouse',
  currency: 'AFN', items: [], subtotal: 100, discount: 0, totalAmount: 100,
  paidAmount: 0, balanceAmount: 100, paymentStatus: 'unpaid', createdAt: '', ...fields,
});
const party = (fields: Partial<Party>): Party => ({
  id: 'party', name: 'مشتری آزمایشی', phone: '', type: 'customer',
  balanceAFN: 0, balanceUSD: 0, createdAt: '', ...fields,
});
const now = new Date('2026-10-15T09:00:00Z');
const toAFN = (amount: number, currency: string) => amount * (currency === 'USD' ? 65 : 1);

test('reads equivalent Persian, Arabic-digit, Gregorian and ISO invoice dates', () => {
  for (const value of ['1405/07/23', '۱۴۰۵/۷/۲۳', '١٤٠٥/٧/٢٣', '2026-10-15', '2026-10-15T04:00:00Z']) {
    assert.equal(parseDashboardDate(value)?.toISOString(), '2026-10-15T12:00:00.000Z');
  }
});

test('invalid dates are not silently counted in the current month', () => {
  for (const value of ['', '---', 'invalid', '1405/13/01', '1405/07/31', '2026/02/30', '2026/00/10', '1405/12/30']) {
    assert.equal(parseDashboardDate(value), null, value);
  }
});

test('monthly sales include only the correct year/month and subtract sales returns', () => {
  const result = getMonthlySales([
    invoice({ totalAmount: 1000 }),
    invoice({ date: '2026-10-14', currency: 'USD', totalAmount: 10 }),
    invoice({ type: 'return_sell', totalAmount: 150 }),
    invoice({ type: 'buy', totalAmount: 9000 }),
    invoice({ type: 'return_buy', totalAmount: 2000 }),
    invoice({ date: '1404/07/23', totalAmount: 99999 }),
    invoice({ date: '1405/06/15', totalAmount: 500 }),
    invoice({ date: 'invalid', totalAmount: 99999 }),
  ], toAFN, 'jalali', now);
  assert.deepEqual(result, { currentMonthAFN: 1500, previousMonthAFN: 500, growthPercent: 200, salesCount: 2 });
});

test('Gregorian calendar month boundaries differ correctly from Persian ones', () => {
  const invoices = [invoice({ date: '2026/09/28', totalAmount: 80 }), invoice({ date: '2026/10/02', totalAmount: 20 })];
  assert.equal(getMonthlySales(invoices, toAFN, 'jalali', now).currentMonthAFN, 100);
  assert.equal(getMonthlySales(invoices, toAFN, 'gregorian', now).currentMonthAFN, 20);
  assert.equal(getMonthlySales(invoices, toAFN, 'gregorian', now).previousMonthAFN, 80);
});

test('comparison crosses the Persian and Gregorian new-year boundaries', () => {
  const persian = getMonthlySales([
    invoice({ date: '1405/01/02', totalAmount: 20 }),
    invoice({ date: '1404/12/28', totalAmount: 10 }),
  ], toAFN, 'jalali', new Date('2026-03-25T09:00:00Z'));
  assert.equal(persian.currentMonthAFN, 20);
  assert.equal(persian.previousMonthAFN, 10);
  const gregorian = getMonthlySales([
    invoice({ date: '2026/01/02', totalAmount: 20 }),
    invoice({ date: '2025/12/28', totalAmount: 10 }),
  ], toAFN, 'gregorian', new Date('2026-01-15T09:00:00Z'));
  assert.equal(gregorian.currentMonthAFN, 20);
  assert.equal(gregorian.previousMonthAFN, 10);
});

test('no fabricated percentage when previous-month sales are zero', () => {
  assert.equal(getMonthlySales([], toAFN, 'jalali', now).growthPercent, null);
  assert.equal(getMonthlySales([invoice({})], toAFN, 'jalali', now).growthPercent, null);
});

test('net returns are order-independent and can truthfully produce negative net sales', () => {
  const invoices = [invoice({ type: 'return_sell', totalAmount: 200 }), invoice({ totalAmount: 50 })];
  assert.equal(getMonthlySales(invoices, toAFN, 'jalali', now).currentMonthAFN, -150);
  assert.equal(getMonthlySales([...invoices].reverse(), toAFN, 'jalali', now).currentMonthAFN, -150);
});

test('non-finite invoice amounts or unknown conversion rates cannot poison the summary', () => {
  const result = getMonthlySales([invoice({ totalAmount: NaN }), invoice({ currency: 'unknown' })], (amount, currency) => currency === 'unknown' ? NaN : amount, 'jalali', now);
  assert.equal(result.currentMonthAFN, 0);
  assert.equal(Number.isFinite(result.currentMonthAFN), true);
});

test('debtor and creditor totals use existing ledger signs independently per currency', () => {
  const totals = getPartyBalanceTotals([
    party({ balanceAFN: -100, balanceUSD: 30 }),
    party({ balanceAFN: 50, balanceUSD: -20 }),
    party({ balanceAFN: NaN, balanceUSD: Infinity }),
  ]);
  assert.deepEqual(totals, { receivableAFN: 100, receivableUSD: 20, payableAFN: 50, payableUSD: 30 });
  assert.deepEqual(getPartyBalanceTotals([]), { receivableAFN: 0, receivableUSD: 0, payableAFN: 0, payableUSD: 0 });
});

test('recent invoices are sorted without mutating accounting records', () => {
  const invoices = [invoice({ id: 'old', date: '1405/06/01' }), invoice({ id: 'new', date: '2026/10/15' }), invoice({ id: 'middle', date: '1405/07/01' })];
  assert.deepEqual(getRecentInvoices(invoices, 2).map(item => item.id), ['new', 'middle']);
  assert.deepEqual(invoices.map(item => item.id), ['old', 'new', 'middle']);
});

test('search matches Persian/Arabic letters, local digits, company, phone and code', () => {
  const parties = [party({ id: 'a', name: 'حاجی موسی', code: '123', phone: '0791234567', company: 'شرکت مرکزی' })];
  for (const query of ['حاجي موسى', 'موسی', '۱۲۳', '١٢٣', 'مرکزي', '۰۷۹۱۲۳۴۵۶۷']) {
    assert.equal(searchDashboardParties(parties, query)[0]?.id, 'a', query);
  }
  assert.deepEqual(searchDashboardParties(parties, '  '), []);
  assert.deepEqual(searchDashboardParties(parties, 'ناشناخته'), []);
  assert.equal(normalizeDashboardSearch('  شركت  مركزي  '), 'شرکت مرکزی');
});

test('numbers match reference Latin digits, separators and fixed decimal precision', () => {
  assert.equal(formatDashboardAmount(285204), '285,204.00');
  assert.equal(formatDashboardAmount(4872679, 0), '4,872,679');
  assert.equal(formatDashboardAmount(-125.99), '-125.99');
  assert.equal(formatDashboardAmount(NaN), '0.00');
});

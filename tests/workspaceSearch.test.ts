import test from 'node:test';
import assert from 'node:assert/strict';
import type { Party, CashRegisterAccount } from '../src/types';
import { workspacePages, workspacePageKey } from '../src/utils/navigation';
import { buildWorkspaceSearchIndex, normalizeWorkspaceSearch, searchWorkspace } from '../src/utils/workspaceSearch';

const party = (id: string, name: string, values: Partial<Party> = {}): Party => ({
  id, name, phone: '', type: 'customer', balanceAFN: 0, balanceUSD: 0, createdAt: '2026-10-15', ...values,
});
const accounts: CashRegisterAccount[] = [{ id: 'sample-bank', name: 'بانک نمونه', currency: 'USD', balance: 5, initialBalance: 5 }];

test('the header index includes every real sidebar leaf and each specific cash account', () => {
  const index = buildWorkspaceSearchIndex([], accounts);
  assert.equal(index.length, workspacePages(accounts).length + 4);
  assert.equal(new Set(index.map(entry => entry.id)).size, index.length);
  const bank = searchWorkspace(index, 'بانک نمونه').menus.find(entry => entry.pageId === 'cash-account-sample-bank');
  assert.ok(bank); assert.equal(workspacePageKey(bank.tab, bank.filter), 'cash:sample-bank');
});
test('Persian/Arabic letters, diacritics, bidi marks and both numeral alphabets normalize consistently', () => {
  assert.equal(normalizeWorkspaceSearch('  عَلِي كَاظمي\u200c ١۲۳\u200f '), 'علی کاظمی 123');
  assert.equal(normalizeWorkspaceSearch('آصف / أصف / إصف'), 'اصف / اصف / اصف');
});
test('phone and code search accepts Persian/Arabic digits and ignores phone formatting', () => {
  const index = buildWorkspaceSearchIndex([party('a', 'مشتری الف', { code: '101', phone: '+93 (700) 12-34-56' })]);
  assert.equal(searchWorkspace(index, '۱۰۱').customers[0]?.partyId, 'a');
  assert.equal(searchWorkspace(index, '٧٠٠١٢٣٤٥٦').customers[0]?.partyId, 'a');
  assert.equal(searchWorkspace(index, '+93 700').customers[0]?.partyId, 'a');
});
test('names, company names and multiword queries search current customer and supplier records', () => {
  const index = buildWorkspaceSearchIndex([
    party('a', 'علی رضا', { company: 'شرکت نبوی' }),
    party('b', 'شرکت مواد ساختمانی', { type: 'supplier', phone: '0700000001' }),
  ]);
  assert.equal(searchWorkspace(index, 'علي نبوي').customers[0]?.partyId, 'a');
  assert.equal(searchWorkspace(index, 'علیرضا').customers[0]?.partyId, 'a');
  assert.equal(searchWorkspace(index, 'مواد').customers[0]?.kind, 'party');
  assert.match(searchWorkspace(index, 'مواد').customers[0]?.description || '', /فروشنده/);
});
test('menu aliases resolve to actual destinations rather than fabricated search pages', () => {
  const index = buildWorkspaceSearchIndex([]);
  assert.ok(searchWorkspace(index, 'لیست خريد').menus.some(entry => entry.tab === 'purchase_invoices'));
  assert.ok(searchWorkspace(index, 'مشتریان').menus.some(entry => entry.tab === 'definitions' && entry.filter === 'parties'));
  assert.ok(searchWorkspace(index, 'اکسچینج').menus.some(entry => entry.tab === 'cash_exchange'));
  assert.ok(searchWorkspace(index, 'theme').menus.some(entry => entry.tab === 'appearance'));
});
test('exact names rank before partial names and duplicate display names keep their own IDs', () => {
  const index = buildWorkspaceSearchIndex([party('first', 'علی رضا'), party('exact', 'علی'), party('other', 'علی')]);
  assert.deepEqual(searchWorkspace(index, 'علی').customers.map(entry => entry.partyId), ['exact', 'other', 'first']);
});
test('empty search shows quick menu destinations, not an arbitrary disclosure of customers', () => {
  const index = buildWorkspaceSearchIndex([party('a', 'مشتری')]);
  const result = searchWorkspace(index, '  ');
  assert.equal(result.menus[0]?.tab, 'dashboard'); assert.equal(result.customers.length, 0);
  assert.ok(result.menus.some(entry => entry.tab === 'sales_invoices'));
  for (const punctuation of ['---', '+++', '( ) + -']) {
    assert.deepEqual(searchWorkspace(index, punctuation), result);
  }
});
test('visible results are capped per section but matching totals are not silently truncated', () => {
  const index = buildWorkspaceSearchIndex(Array.from({ length: 25 }, (_, id) => party(String(id), `مشتری نمونه ${id}`)));
  const result = searchWorkspace(index, 'نمونه', 4);
  assert.equal(result.customers.length, 4); assert.equal(result.customerCount, 25);
  assert.equal(searchWorkspace(index, 'نمونه', 0).customers.length, 0);
  assert.equal(searchWorkspace(index, 'نمونه', Infinity).customers.length, 6);
});
test('nonmatching search returns an honest empty result, including with an empty database', () => {
  const result = searchWorkspace(buildWorkspaceSearchIndex([]), 'نام-کاملاً-ناموجود-899921');
  assert.equal(result.menuCount, 0); assert.equal(result.customerCount, 0);
});
test('the index excludes Telegram secret/connection fields and never mutates accounting records', () => {
  const original = [party('a', 'نام <مشتری>', { telegramChatId: 'PRIVATE-CHAT-8844', telegramConnectionCode: 'PRIVATE-CONNECT-3311', balanceAFN: -123.123456 })];
  const before = JSON.stringify({ original, accounts });
  Object.freeze(original[0]); Object.freeze(original); Object.freeze(accounts[0]); Object.freeze(accounts);
  const index = buildWorkspaceSearchIndex(original, accounts);
  searchWorkspace(index, 'نام');
  assert.equal(JSON.stringify({ original, accounts }), before);
  assert.ok(!JSON.stringify(index).includes('PRIVATE-'));
  assert.equal(searchWorkspace(index, 'PRIVATE-').customerCount, 0);
  assert.equal(searchWorkspace(index, 'نام').customers[0]?.title, 'نام <مشتری>');
});
test('rebuilding after a rename/removal uses the new records instead of stale snapshots', () => {
  const old = party('a', 'مشتری قدیمی');
  assert.equal(searchWorkspace(buildWorkspaceSearchIndex([old]), 'قدیمی').customerCount, 1);
  const next = buildWorkspaceSearchIndex([{ ...old, name: 'مشتری تازه' }]);
  assert.equal(searchWorkspace(next, 'قدیمی').customerCount, 0);
  assert.equal(searchWorkspace(next, 'تازه').customers[0]?.partyId, 'a');
  assert.equal(searchWorkspace(buildWorkspaceSearchIndex([]), 'تازه').customerCount, 0);
});

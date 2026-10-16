import test from 'node:test';
import assert from 'node:assert/strict';
import type { CashRegisterAccount } from '../src/types';
import type { NavTab } from '../src/components/Sidebar';
import {
  activeWorkspacePage,
  itemizedSalesFilter,
  itemizedSalesProductId,
  canonicalWorkspaceLocation,
  workspacePageGroups,
  workspacePages,
  workspacePageKey,
  workspacePageTitle,
} from '../src/utils/navigation';

const accounts: CashRegisterAccount[] = [
  { id: 'afn_cash', name: 'صندوق نمونه', currency: 'AFN', balance: 12, initialBalance: 10 },
  { id: 'usd_cash', name: 'صندوق نمونه', currency: 'USD', balance: -3, initialBalance: 5 },
];
const pages = () => workspacePages(accounts);

test('every catalog destination has a unique ID and independent canonical page identity', () => {
  const groups = workspacePageGroups(accounts);
  const leaves = pages();
  assert.equal(new Set(groups.map(group => group.id)).size, groups.length);
  assert.equal(new Set(leaves.map(page => page.id)).size, leaves.length);
  assert.equal(new Set(leaves.map(page => workspacePageKey(page.tab, page.filter))).size, leaves.length);
  for (const page of leaves) {
    assert.ok(page.label.trim(), page.id);
    assert.equal(activeWorkspacePage(page.tab, page.filter, accounts)?.id, page.id);
  }
});

test('cash accounts with the same name are independently selected by ID without mutating data', () => {
  const original = structuredClone(accounts);
  const group = workspacePageGroups(accounts).find(group => group.id === 'cash')!;
  assert.equal(group.items.filter(page => page.label === 'صندوق نمونه').length, 2);
  assert.equal(activeWorkspacePage('cash', 'afn_cash', accounts)?.id, 'cash-account-afn_cash');
  assert.equal(activeWorkspacePage('cash', 'usd_cash', accounts)?.id, 'cash-account-usd_cash');
  assert.equal(activeWorkspacePage('cash', 'all', accounts)?.id, 'cash-registers');
  assert.equal(activeWorkspacePage('cash', 'missing', accounts), undefined);
  assert.deepEqual(accounts, original);
});

test('cash sidebar still exposes its summary and all operations when there are no accounts', () => {
  const group = workspacePageGroups().find(group => group.id === 'cash')!;
  assert.deepEqual(group.items.map(page => page.tab), ['cash', 'cash_transfer', 'cash_exchange', 'cash_transfer_history', 'cash_log']);
});

test('previously tab-only return, itemized, advanced treasury and management features stay reachable', () => {
  const ids = new Set(pages().map(page => page.id));
  for (const id of [
    'sale-return-create', 'sale-return-list', 'purchase-return-create', 'purchase-return-list',
    'itemized-sales', 'legacy-purchase-create', 'legacy-purchase-list', 'legacy-sale-create', 'legacy-sale-list', 'consignment', 'income-receipt', 'expense-payment',
    'legacy-receipt-create', 'legacy-payment-create', 'legacy-receipt-list', 'legacy-payment-list',
    'company', 'appearance', 'users', 'backup', 'quick-backup', 'quick-restore',
    'database-backup', 'financial-year', 'audit-log',
  ]) assert.ok(ids.has(id), `Missing reachable feature: ${id}`);
});

test('every original report section has exactly one sidebar destination', () => {
  const reports = pages().filter(page => page.tab === 'reports');
  assert.deepEqual(reports.map(page => page.filter).sort(), [
    'parties', 'inventory', 'sales', 'product_sales', 'purchases', 'expenses',
    'profit_loss', 'balance_sheet', 'journal', 'fixed_assets', 'shareholders', 'backup',
  ].sort());
});

test('all original Telegram sections and separate confidential settings are reachable', () => {
  const group = workspacePageGroups().find(group => group.id === 'telegram')!;
  assert.deepEqual(group.items.filter(page => page.tab === 'telegram_manager').map(page => page.filter), [
    'pending', 'connected', 'send_hub', 'logs', 'settings', 'guide',
  ]);
  assert.ok(group.items.some(page => page.tab === 'settings' && page.filter === 'telegram'));
});

test('dashboard definition shortcuts select the exact corresponding leaf', () => {
  for (const [tab, filter, expected] of [
    ['customers', 'group-a', 'definition-parties'],
    ['products', 'all', 'definition-products'],
    ['warehouses', 'consignment', 'definition-warehouses'],
    ['currencies', 'all', 'definition-currencies'],
    ['definitions', 'fixed_assets', 'fixed-assets'],
    ['definitions', 'shareholders', 'shareholders'],
  ] as [NavTab, string, string][]) {
    assert.equal(activeWorkspacePage(tab, filter)?.id, expected);
  }
});

test('legacy trade shortcut aliases resolve to the same page as their sidebar leaf', () => {
  for (const tab of ['trade_hub', 'invoices'] as const) {
    for (const [filter, destination] of [
      ['all', 'sales_invoices'], ['sell', 'sales_invoices'], ['buy', 'purchase_invoices'],
      ['return_buy', 'return_buy'], ['return_sell', 'return_sell'],
    ] as [string, NavTab][]) assert.equal(workspacePageKey(tab, filter), workspacePageKey(destination));
    assert.equal(workspacePageKey(tab, 'product_sales'), workspacePageKey('trade_hub', 'itemized'));
    assert.equal(activeWorkspacePage(tab, 'itemized')?.id, 'itemized-sales');
  }
});

test('default management, reports and treasury shortcuts select their real initial page', () => {
  for (const [tab, filter, id] of [
    ['definitions', 'all', 'definition-parties'],
    ['reports', 'all', 'report-parties'],
    ['reports', 'profit', 'profit-loss'],
    ['reports', 'pnl', 'profit-loss'],
    ['reports', 'balance', 'balance-sheet'],
    ['telegram_manager', 'all', 'telegram-pending'],
    ['settings', 'all', 'company'],
    ['quick_backup', 'all', 'quick-backup'],
    ['receipt_payment_hub', 'all', 'receipt-create'],
    ['receipt_payment_hub', 'cash_transfer', 'cash-transfer'],
  ] as [NavTab, string, string][]) assert.equal(activeWorkspacePage(tab, filter)?.id, id);
});

test('stale record filters do not change the selected identity of a standalone page', () => {
  for (const tab of ['new_purchase', 'new_sale', 'new_return_buy', 'return_sell', 'new_payment', 'income_receipt', 'cash_exchange'] as const) {
    assert.equal(workspacePageKey(tab, 'old-filter'), workspacePageKey(tab));
  }
  assert.notEqual(workspacePageKey('reports', 'sales'), workspacePageKey('reports', 'purchases'));
  assert.notEqual(workspacePageKey('definitions', 'products'), workspacePageKey('definitions', 'parties'));
  assert.notEqual(workspacePageKey('settings', 'company'), workspacePageKey('settings', 'roles'));
});

test('canonical locations are idempotent for all sidebar leaves and shortcuts', () => {
  for (const page of [...pages(), { tab: 'invoices' as const, filter: 'buy' }, { tab: 'customers' as const, filter: 'old-group' }]) {
    const location = canonicalWorkspaceLocation(page.tab, page.filter);
    assert.deepEqual(canonicalWorkspaceLocation(location.tab, location.filter), location);
  }
});

test('page headings match the catalog, including honest standalone information pages', () => {
  for (const page of workspacePageGroups().flatMap(group => group.items)) {
    assert.equal(workspacePageTitle(page.tab, page.filter), page.label);
  }
  assert.equal(workspacePageTitle('production'), 'فرآیند تولید');
  assert.equal(workspacePageTitle('company_units'), 'تغییر واحد شرکت');
  assert.equal(workspacePageTitle('dashboard'), 'داشبورد مدیریتی');
  assert.equal(workspacePageTitle('journal'), 'روزنامچه');
});

test('itemized product drill-down survives independent mounting without selecting another sidebar leaf', () => {
  for (const id of ['product-1', 'کالا / یک: دو', 'id%23']) {
    const filter = itemizedSalesFilter(id);
    assert.equal(itemizedSalesProductId(filter), id);
    assert.equal(workspacePageKey('trade_hub', filter), 'trade_hub:itemized');
    assert.equal(activeWorkspacePage('trade_hub', filter)?.id, 'itemized-sales');
  }
  assert.equal(itemizedSalesFilter(), 'itemized');
  assert.equal(itemizedSalesProductId('itemized:%invalid'), 'all');
  assert.equal(itemizedSalesProductId('itemized:'), 'all');
});

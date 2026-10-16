import test from 'node:test';
import assert from 'node:assert/strict';
import type { NavTab } from '../src/components/Sidebar';
import { activeWorkspacePage, treasuryCenterPage, workspacePageGroups, workspacePageKey, workspacePages } from '../src/utils/navigation';
import { isTreasuryCenterLocation, treasuryCenterNavigation, treasuryCenterSelectionKey } from '../src/utils/treasuryCenter';
import { buildWorkspaceSearchIndex, searchWorkspace } from '../src/utils/workspaceSearch';

const group = () => workspacePageGroups().find(group => group.id === 'treasury')!;

test('treasury has its own center, without changing old receipt/cash-transfer aliases', () => {
  assert.equal(group().landingPage, treasuryCenterPage);
  assert.equal(workspacePageKey(treasuryCenterPage.tab, treasuryCenterPage.filter), 'receipt_payment_hub:center');
  assert.equal(activeWorkspacePage('receipt_payment_hub', 'center')?.id, treasuryCenterPage.id);
  assert.equal(workspacePageKey('receipt_payment_hub'), 'new_receipt:all');
  assert.equal(workspacePageKey('receipt_payment_hub', 'cash_transfer'), 'cash_transfer:all');
});
test('the four adjacent treasury actions retain their real form/list targets and order', () => {
  assert.deepEqual(treasuryCenterNavigation().primary.map(page => workspacePageKey(page.tab, page.filter)), [
    'new_receipt:all', 'receipts_list:all', 'new_payment:all', 'payments_list:all',
  ]);
  assert.deepEqual(group().items.filter(page => page.inSidebar !== false).map(page => page.id), ['receipt-create', 'payment-create']);
});
test('all moved treasury features appear once and nothing is replaced by hidden sidebar shims', () => {
  const { primary, related, advanced } = treasuryCenterNavigation();
  const all = [...primary, ...related, ...advanced];
  assert.equal(new Set(all.map(page => page.id)).size, all.length);
  assert.deepEqual(all.map(page => page.id).sort(), group().items.map(page => page.id).sort());
  for (const page of group().items.filter(page => page.inSidebar === false)) assert.equal(all.filter(action => action.id === page.id).length, 1);
});
test('income, expense, both advanced forms and both histories keep their canonical identities', () => {
  const { related, advanced } = treasuryCenterNavigation();
  assert.deepEqual(related.map(page => workspacePageKey(page.tab, page.filter)), ['income_receipt:all', 'expense_payment:all']);
  assert.deepEqual(advanced.map(page => workspacePageKey(page.tab, page.filter)), [
    'legacy_receipt:all', 'legacy_receipts_list:all', 'legacy_payment:all', 'legacy_payments_list:all',
  ]);
});
test('the center selects the real receipt form by default and every individual page stays selectable', () => {
  assert.equal(treasuryCenterSelectionKey('receipt_payment_hub', 'center'), 'new_receipt:all');
  for (const page of group().items) assert.equal(treasuryCenterSelectionKey(page.tab, page.filter), workspacePageKey(page.tab, page.filter));
});
test('treasury headers never appear on invoice, cash-transfer or unrelated pages', () => {
  for (const page of group().items) assert.equal(isTreasuryCenterLocation(page.tab), true, page.id);
  assert.equal(isTreasuryCenterLocation('receipt_payment_hub', 'center'), true);
  assert.equal(isTreasuryCenterLocation('receipt_payment_hub', 'cash_transfer'), false);
  for (const tab of ['dashboard', 'cash_transfer', 'cash', 'cash_exchange', 'new_purchase', 'reports', 'settings'] as NavTab[]) assert.equal(isTreasuryCenterLocation(tab), false, tab);
});
test('local header search retains every treasury destination and discovers the center', () => {
  const index = buildWorkspaceSearchIndex([]);
  for (const page of [treasuryCenterPage, ...group().items]) assert.equal(index.filter(entry => entry.kind === 'menu' && entry.pageId === page.id).length, 1);
  assert.ok(searchWorkspace(index, 'treasury center').menus.some(entry => entry.pageId === treasuryCenterPage.id));
  assert.ok(searchWorkspace(index, 'لیست دریافت').menus.some(entry => entry.tab === 'receipts_list'));
});
test('the two centers have distinct titles, captions and nonduplicated catalog identities', () => {
  const trade = workspacePageGroups().find(group => group.id === 'trade')!;
  assert.notEqual(group().landingCaption, trade.landingCaption);
  const all = workspacePages();
  assert.equal(new Set(all.map(page => page.id)).size, all.length);
  assert.equal(new Set(all.map(page => workspacePageKey(page.tab, page.filter))).size, all.length);
  assert.equal(all.filter(page => page.id === 'treasury-center').length, 1);
});

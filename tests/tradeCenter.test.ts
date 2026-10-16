import test from 'node:test';
import assert from 'node:assert/strict';
import type { NavTab } from '../src/components/Sidebar';
import { activeWorkspacePage, canonicalWorkspaceLocation, tradeCenterPage, workspacePageGroups, workspacePageKey, workspacePages } from '../src/utils/navigation';
import { countTradeDocuments, isTradeCenterLocation, tradeCenterNavigation, tradeCenterSelectionKey } from '../src/utils/tradeCenter';
import { buildWorkspaceSearchIndex, searchWorkspace } from '../src/utils/workspaceSearch';

const group = () => workspacePageGroups().find(group => group.id === 'trade')!;

test('trade has a real general landing page distinct from each invoice workflow', () => {
  assert.equal(group().landingPage?.id, 'trade-center');
  assert.equal(workspacePageKey('trade_hub', 'center'), 'trade_hub:center');
  assert.equal(workspacePageKey('invoices', 'center'), 'trade_hub:center');
  assert.equal(activeWorkspacePage('trade_hub', 'center')?.id, tradeCenterPage.id);
  assert.deepEqual(canonicalWorkspaceLocation('trade_hub', 'center'), { tab: 'trade_hub', filter: 'center' });
  assert.notEqual(workspacePageKey('trade_hub', 'center'), workspacePageKey('sales_invoices'));
});
test('the trade sidebar contains only the four direct creation shortcuts', () => {
  const visible = group().items.filter(page => page.inSidebar !== false);
  assert.deepEqual(visible.map(page => page.id).sort(), ['purchase-create', 'sale-create', 'purchase-return-create', 'sale-return-create'].sort());
  assert.deepEqual(visible.map(page => page.tab).sort(), ['new_purchase', 'new_sale', 'new_return_buy', 'new_return_sell'].sort());
  assert.ok(group().items.filter(page => /-list$/.test(page.id)).every(page => page.inSidebar === false));
});
test('every moved destination is present exactly once among the center actions', () => {
  const navigation = tradeCenterNavigation();
  const actions = [...navigation.primary, ...navigation.related, ...navigation.advanced];
  assert.equal(navigation.primary.length, 6);
  assert.equal(new Set(actions.map(page => page.id)).size, actions.length);
  for (const page of group().items.filter(page => page.inSidebar === false)) {
    assert.equal(actions.filter(action => action.id === page.id).length, 1, page.id);
  }
  const reachable = new Set([...actions, ...group().items.filter(page => page.inSidebar !== false)].map(page => page.id));
  assert.deepEqual([...reachable].sort(), group().items.map(page => page.id).sort());
});
test('advanced forms, itemized sales and consignment keep their original canonical targets', () => {
  const navigation = tradeCenterNavigation();
  assert.deepEqual(navigation.advanced.map(page => workspacePageKey(page.tab, page.filter)), [
    'legacy_trade:buy-create', 'legacy_trade:buy-list', 'legacy_trade:sell-create', 'legacy_trade:sell-list',
  ]);
  assert.deepEqual(navigation.related.map(page => workspacePageKey(page.tab, page.filter)), ['trade_hub:itemized', 'consignment:all']);
  assert.equal(workspacePageKey('trade_hub', 'all'), 'sales_invoices:all');
  assert.equal(workspacePageKey('trade_hub', 'buy'), 'purchase_invoices:all');
});
test('the center opens live sales by default while preserving every specific selection', () => {
  assert.equal(tradeCenterSelectionKey('trade_hub', 'center'), 'sales_invoices:all');
  for (const page of group().items) {
    assert.equal(tradeCenterSelectionKey(page.tab, page.filter), workspacePageKey(page.tab, page.filter));
  }
});
test('counts reflect all four actual document types and do not mutate frozen records', () => {
  const invoices = Object.freeze([
    Object.freeze({ type: 'buy' as const }), Object.freeze({ type: 'sell' as const }), Object.freeze({ type: 'sell' as const }),
    Object.freeze({ type: 'return_sell' as const }), Object.freeze({ type: 'return_buy' as const }),
  ]);
  assert.deepEqual(countTradeDocuments(invoices), { buy: 1, sell: 2, return_buy: 1, return_sell: 1 });
  assert.deepEqual(countTradeDocuments([]), { buy: 0, sell: 0, return_buy: 0, return_sell: 0 });
  assert.equal(invoices.length, 5);
});
test('all invoice views share the center but unrelated sidebar pages remain independent', () => {
  for (const page of group().items) assert.equal(isTradeCenterLocation(page.tab), true, page.id);
  assert.equal(isTradeCenterLocation(tradeCenterPage.tab), true);
  for (const tab of ['dashboard', 'reports', 'definitions', 'new_receipt', 'new_payment', 'cash', 'settings'] as NavTab[]) {
    assert.equal(isTradeCenterLocation(tab), false, tab);
  }
});
test('header search retains moved pages and can find the new general center', () => {
  const index = buildWorkspaceSearchIndex([]);
  assert.equal(index.filter(entry => entry.kind === 'menu' && entry.pageId === tradeCenterPage.id).length, 1);
  assert.ok(searchWorkspace(index, 'مرکز فاکتورها').menus.some(entry => entry.pageId === 'trade-center'));
  assert.ok(searchWorkspace(index, 'لیست خریدها').menus.some(entry => entry.tab === 'purchase_invoices'));
  for (const page of group().items) assert.ok(index.some(entry => entry.kind === 'menu' && entry.pageId === page.id));
});
test('the expanded catalog has one identity per destination, not duplicate sidebar shims', () => {
  const pages = workspacePages();
  assert.equal(new Set(pages.map(page => page.id)).size, pages.length);
  assert.equal(new Set(pages.map(page => workspacePageKey(page.tab, page.filter))).size, pages.length);
  assert.equal(pages.filter(page => page.id === tradeCenterPage.id).length, 1);
});

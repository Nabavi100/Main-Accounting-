import type { Invoice, InvoiceType } from '../types';
import type { NavTab } from '../components/Sidebar';
import { workspacePageGroups, workspacePageKey, tradeCenterPage } from './navigation';

/** Six adjacent invoice sections, matching the reference; return creation stays in its list and sidebar. */
export const tradeCenterPrimaryIds = [
  'purchase-create', 'purchase-list', 'sale-create', 'sale-list', 'sale-return-list', 'purchase-return-list',
] as const;
export const tradeCenterRelatedIds = ['itemized-sales', 'consignment'] as const;
export const tradeCenterAdvancedIds = [
  'legacy-purchase-create', 'legacy-purchase-list', 'legacy-sale-create', 'legacy-sale-list',
] as const;

export const tradeCenterNavigation = () => {
  const pages = workspacePageGroups().find(group => group.id === 'trade')!.items;
  const resolve = (ids: readonly string[]) => ids.map(id => pages.find(page => page.id === id)!);
  return { primary: resolve(tradeCenterPrimaryIds), related: resolve(tradeCenterRelatedIds), advanced: resolve(tradeCenterAdvancedIds) };
};

/** Counts only: never add financial amounts across currencies, and never mutate invoice records. */
export const countTradeDocuments = (invoices: readonly Pick<Invoice, 'type'>[]): Record<InvoiceType, number> => {
  const counts: Record<InvoiceType, number> = { buy: 0, sell: 0, return_buy: 0, return_sell: 0 };
  for (const invoice of invoices) if (Object.hasOwn(counts, invoice.type)) counts[invoice.type]++;
  return counts;
};

const tradeTabs = new Set<NavTab>([
  'trade_hub', 'invoices', 'new_purchase', 'purchase_invoices', 'new_sale', 'sales_invoices',
  'new_return_buy', 'return_buy', 'new_return_sell', 'return_sell', 'legacy_trade', 'consignment',
]);
export const isTradeCenterLocation = (tab: NavTab): boolean => tradeTabs.has(tab);

/** The general center initially shows the live sales list; every other destination keeps its exact identity. */
export const tradeCenterSelectionKey = (tab: NavTab, filter = 'all'): string => {
  const key = workspacePageKey(tab, filter);
  return key === workspacePageKey(tradeCenterPage.tab, tradeCenterPage.filter) ? workspacePageKey('sales_invoices') : key;
};

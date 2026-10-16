import type { NavTab } from '../components/Sidebar';
import { treasuryCenterPage, workspacePageGroups, workspacePageKey } from './navigation';

export const treasuryCenterPrimaryIds = ['receipt-create', 'receipt-list', 'payment-create', 'payment-list'] as const;
export const treasuryCenterRelatedIds = ['income-receipt', 'expense-payment'] as const;
export const treasuryCenterAdvancedIds = ['legacy-receipt-create', 'legacy-receipt-list', 'legacy-payment-create', 'legacy-payment-list'] as const;

export const treasuryCenterNavigation = () => {
  const pages = workspacePageGroups().find(group => group.id === 'treasury')!.items;
  const resolve = (ids: readonly string[]) => ids.map(id => pages.find(page => page.id === id)!);
  return { primary: resolve(treasuryCenterPrimaryIds), related: resolve(treasuryCenterRelatedIds), advanced: resolve(treasuryCenterAdvancedIds) };
};

const treasuryTabs = new Set<NavTab>([
  'receipt_payment_hub', 'new_receipt', 'receipts_list', 'new_payment', 'payments_list',
  'income_receipt', 'expense_payment', 'legacy_receipt', 'legacy_payment', 'legacy_receipts_list', 'legacy_payments_list',
]);
export const isTreasuryCenterLocation = (tab: NavTab, filter = 'all'): boolean => treasuryTabs.has(tab) && !(tab === 'receipt_payment_hub' && filter === 'cash_transfer');

/** Keep the original receipt shortcut behavior; the general center starts with that same real form. */
export const treasuryCenterSelectionKey = (tab: NavTab, filter = 'all'): string => {
  const key = workspacePageKey(tab, filter);
  return key === workspacePageKey(treasuryCenterPage.tab, treasuryCenterPage.filter) ? workspacePageKey('new_receipt') : key;
};

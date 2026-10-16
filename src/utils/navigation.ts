import type { CashRegisterAccount } from '../types';
import type { NavTab } from '../components/Sidebar';

export interface WorkspacePage {
  id: string;
  label: string;
  tab: NavTab;
  filter?: string;
  /** False means this destination lives in its shared center, not as a sidebar row. */
  inSidebar?: boolean;
}
export interface WorkspacePageGroup {
  id: string;
  label: string;
  icon: 'definitions' | 'cash' | 'trade' | 'treasury' | 'assets' | 'reports' | 'accounting' | 'management' | 'telegram';
  items: WorkspacePage[];
  landingPage?: WorkspacePage;
  landingCaption?: string;
}

export const tradeCenterPage: WorkspacePage = {
  id: 'trade-center', label: 'مرکز فاکتورهای خرید، فروش و مرجوعی', tab: 'trade_hub', filter: 'center',
};

export const treasuryCenterPage: WorkspacePage = {
  id: 'treasury-center', label: 'مرکز دریافت و پرداخت', tab: 'receipt_payment_hub', filter: 'center',
};

/** Canonical destinations. Trade and treasury keep direct create shortcuts; their lists live in shared centers. */
export const workspacePageGroups = (accounts: CashRegisterAccount[] = []): WorkspacePageGroup[] => [
  { id: 'definitions', label: 'تعاریف اولیه', icon: 'definitions', items: [
    { id: 'definition-parties', label: 'تعریف طرف حساب', tab: 'definitions', filter: 'parties' },
    { id: 'definition-products', label: 'تعریف کالا و اجناس', tab: 'definitions', filter: 'products' },
    { id: 'definition-warehouses', label: 'تعریف گدام و انبار', tab: 'definitions', filter: 'warehouses' },
    { id: 'definition-cash', label: 'تعریف صندوق‌ها', tab: 'definitions', filter: 'cash' },
    { id: 'definition-expenses', label: 'تعریف هزینه‌ها', tab: 'definitions', filter: 'expenses' },
    { id: 'definition-incomes', label: 'تعریف عواید و درآمدها', tab: 'definitions', filter: 'incomes' },
    { id: 'definition-currencies', label: 'تعریف اسعار و ارزها', tab: 'definitions', filter: 'currencies' },
  ] },
  { id: 'cash', label: 'گردش صندوق‌ها', icon: 'cash', items: [
    { id: 'cash-registers', label: 'همه صندوق‌ها و حساب‌ها', tab: 'cash' },
    ...accounts.map(account => ({ id: `cash-account-${account.id}`, label: account.name, tab: 'cash' as const, filter: account.id })),
    { id: 'cash-transfer', label: 'عملیه صندوق به صندوق', tab: 'cash_transfer' },
    { id: 'cash-exchange', label: 'تبدیل و اکسچنج اسعار', tab: 'cash_exchange' },
    { id: 'cash-history', label: 'تاریخچهٔ انتقال و صرافی', tab: 'cash_transfer_history' },
    { id: 'cash-log', label: 'دفتر گردش وجوه', tab: 'cash_log' },
  ] },
  { id: 'trade', label: 'بازرگانی و مالی', icon: 'trade', landingPage: tradeCenterPage, landingCaption: 'مرکز فاکتورها', items: [
    { id: 'purchase-create', label: 'ثبت فاکتور خرید', tab: 'new_purchase' },
    { id: 'purchase-list', label: 'لیست خریدها', tab: 'purchase_invoices', inSidebar: false },
    { id: 'sale-create', label: 'ثبت فاکتور فروش', tab: 'new_sale' },
    { id: 'sale-list', label: 'لیست فروشات', tab: 'sales_invoices', inSidebar: false },
    { id: 'sale-return-create', label: 'ثبت برگشت از فروش', tab: 'new_return_sell' },
    { id: 'sale-return-list', label: 'فاکتورهای برگشت از فروش', tab: 'return_sell', inSidebar: false },
    { id: 'purchase-return-create', label: 'ثبت برگشت از خرید', tab: 'new_return_buy' },
    { id: 'purchase-return-list', label: 'فاکتورهای برگشت از خرید', tab: 'return_buy', inSidebar: false },
    { id: 'itemized-sales', label: 'تفکیک فروش کالاها و خریداران', tab: 'trade_hub', filter: 'itemized', inSidebar: false },
    { id: 'legacy-purchase-create', label: 'ثبت پیشرفتهٔ فاکتور خرید', tab: 'legacy_trade', filter: 'buy-create', inSidebar: false },
    { id: 'legacy-purchase-list', label: 'سوابق تفصیلی فاکتورهای خرید', tab: 'legacy_trade', filter: 'buy-list', inSidebar: false },
    { id: 'legacy-sale-create', label: 'ثبت پیشرفتهٔ فاکتور فروش', tab: 'legacy_trade', filter: 'sell-create', inSidebar: false },
    { id: 'legacy-sale-list', label: 'سوابق تفصیلی فاکتورهای فروش', tab: 'legacy_trade', filter: 'sell-list', inSidebar: false },
    { id: 'consignment', label: 'مدیریت گدام امانی', tab: 'consignment', inSidebar: false },
  ] },
  { id: 'treasury', label: 'دریافت و پرداخت', icon: 'treasury', landingPage: treasuryCenterPage, landingCaption: 'مرکز خزانه', items: [
    { id: 'receipt-create', label: 'ثبت دریافت (ورودی)', tab: 'new_receipt' },
    { id: 'receipt-list', label: 'لیست دریافت‌ها', tab: 'receipts_list', inSidebar: false },
    { id: 'payment-create', label: 'ثبت پرداخت (خروجی)', tab: 'new_payment' },
    { id: 'payment-list', label: 'لیست پرداخت‌ها', tab: 'payments_list', inSidebar: false },
    { id: 'income-receipt', label: 'دریافت عواید', tab: 'income_receipt', inSidebar: false },
    { id: 'expense-payment', label: 'پرداخت هزینه', tab: 'expense_payment', inSidebar: false },
    { id: 'legacy-receipt-create', label: 'فرم پیشرفتهٔ دریافت', tab: 'legacy_receipt', inSidebar: false },
    { id: 'legacy-payment-create', label: 'فرم پیشرفتهٔ پرداخت', tab: 'legacy_payment', inSidebar: false },
    { id: 'legacy-receipt-list', label: 'سوابق تفصیلی دریافت‌ها', tab: 'legacy_receipts_list', inSidebar: false },
    { id: 'legacy-payment-list', label: 'سوابق تفصیلی پرداخت‌ها', tab: 'legacy_payments_list', inSidebar: false },
  ] },
  { id: 'assets', label: 'دارایی‌های ثابت و سهامداران', icon: 'assets', items: [
    { id: 'fixed-assets', label: 'تجهیزات و دارایی‌های ثابت', tab: 'fixed_assets' },
    { id: 'shareholders', label: 'سهامداران و شرکا', tab: 'shareholders' },
  ] },
  { id: 'reports', label: 'گزارشات سیستمی', icon: 'reports', items: [
    { id: 'report-parties', label: 'گزارش طرف‌های حساب', tab: 'reports', filter: 'parties' },
    { id: 'report-inventory', label: 'گزارش موجودی گدام‌ها', tab: 'reports', filter: 'inventory' },
    { id: 'report-sales', label: 'گزارش فروش', tab: 'reports', filter: 'sales' },
    { id: 'report-product-sales', label: 'تحلیل فروش کالاها', tab: 'reports', filter: 'product_sales' },
    { id: 'report-purchases', label: 'گزارش خرید', tab: 'reports', filter: 'purchases' },
    { id: 'report-expenses', label: 'گزارش هزینه‌ها', tab: 'reports', filter: 'expenses' },
    { id: 'report-fixed-assets', label: 'گزارش دارایی‌های ثابت', tab: 'reports', filter: 'fixed_assets' },
    { id: 'report-shareholders', label: 'گزارش سهامداران', tab: 'reports', filter: 'shareholders' },
  ] },
  { id: 'accounting', label: 'حسابداری و سود و زیان', icon: 'accounting', items: [
    { id: 'profit-loss', label: 'صورت سود و زیان', tab: 'reports', filter: 'profit_loss' },
    { id: 'balance-sheet', label: 'بیلان و ترازنامه', tab: 'reports', filter: 'balance_sheet' },
    { id: 'journal-vouchers', label: 'اسناد حسابداری', tab: 'reports', filter: 'journal' },
    { id: 'transactions', label: 'دفتر کل و گردش حساب‌ها', tab: 'transactions' },
    { id: 'incomes', label: 'عواید و درآمدها', tab: 'incomes' },
    { id: 'expenses', label: 'هزینه‌ها و مصارف', tab: 'expenses' },
  ] },
  { id: 'management', label: 'مدیریت سیستم', icon: 'management', items: [
    { id: 'company', label: 'مشخصات شرکت', tab: 'settings', filter: 'company' },
    { id: 'appearance', label: 'تنظیمات ظاهر و تم', tab: 'appearance' },
    { id: 'users', label: 'کاربران و سطح دسترسی', tab: 'settings', filter: 'roles' },
    { id: 'backup', label: 'پشتیبان‌گیری و بازیابی', tab: 'settings', filter: 'backup' },
    { id: 'quick-backup', label: 'پشتیبان‌گیری سریع', tab: 'quick_backup', filter: 'export' },
    { id: 'quick-restore', label: 'بازیابی فایل پشتیبان', tab: 'quick_backup', filter: 'import' },
    { id: 'database-backup', label: 'مدیریت پشتیبان پایگاه داده', tab: 'reports', filter: 'backup' },
    { id: 'financial-year', label: 'سال مالی و بازنشانی داده‌ها', tab: 'settings', filter: 'reset' },
    { id: 'audit-log', label: 'دفتر ثبت رویدادها', tab: 'audit_log' },
  ] },
  { id: 'telegram', label: 'مدیریت ربات تلگرام', icon: 'telegram', items: [
    { id: 'telegram-pending', label: 'درخواست‌های اتصال تلگرام', tab: 'telegram_manager', filter: 'pending' },
    { id: 'telegram-connected', label: 'کاربران متصل تلگرام', tab: 'telegram_manager', filter: 'connected' },
    { id: 'telegram-send', label: 'ارسال اسناد و پیام', tab: 'telegram_manager', filter: 'send_hub' },
    { id: 'telegram-logs', label: 'گزارش ارسال‌های تلگرام', tab: 'telegram_manager', filter: 'logs' },
    { id: 'telegram-settings', label: 'تنظیمات توکن ربات', tab: 'telegram_manager', filter: 'settings' },
    { id: 'telegram-guide', label: 'راهنمای اتصال ربات', tab: 'telegram_manager', filter: 'guide' },
    { id: 'telegram-security', label: 'تنظیمات ربات تلگرام', tab: 'settings', filter: 'telegram' },
  ] },
];

/** Search and deep links retain every destination, including pages moved out of the sidebar. */
export const workspacePages = (accounts: CashRegisterAccount[] = []): WorkspacePage[] => workspacePageGroups(accounts)
  .flatMap(group => [...(group.landingPage ? [group.landingPage] : []), ...group.items]);

/** Compatibility for existing dashboard shortcuts and older component callbacks. */
export const canonicalWorkspaceLocation = (tab: NavTab, filter = 'all'): { tab: NavTab; filter: string } => {
  if (tab === 'products' || tab === 'currencies' || tab === 'warehouses') return { tab: 'definitions', filter: tab };
  if (tab === 'customers') return { tab: 'definitions', filter: 'parties' };
  if (tab === 'definitions' && (filter === 'fixed_assets' || filter === 'shareholders')) return { tab: filter, filter: 'all' };
  if (tab === 'definitions' && filter === 'all') return { tab, filter: 'parties' };
  if (tab === 'trade_hub' || tab === 'invoices') {
    if (filter === 'center') return { tab: 'trade_hub', filter: 'center' };
    if (filter === 'return_buy' || filter === 'return_sell') return { tab: filter, filter: 'all' };
    if (filter === 'itemized' || filter.startsWith('itemized:') || filter === 'product_sales') return { tab: 'trade_hub', filter: 'itemized' };
    return { tab: filter === 'buy' ? 'purchase_invoices' : 'sales_invoices', filter: 'all' };
  }
  if (tab === 'receipt_payment_hub') return filter === 'center' ? { tab, filter: 'center' } : { tab: filter === 'cash_transfer' ? 'cash_transfer' : 'new_receipt', filter: 'all' };
  if (tab === 'reports') return { tab, filter: filter === 'all' ? 'parties' : ['profit', 'pnl'].includes(filter) ? 'profit_loss' : filter === 'balance' ? 'balance_sheet' : filter };
  if (tab === 'telegram_manager' && filter === 'all') return { tab, filter: 'pending' };
  if (tab === 'legacy_trade' && filter === 'all') return { tab, filter: 'sell-list' };
  if (tab === 'settings' && filter === 'all') return { tab, filter: 'company' };
  if (tab === 'quick_backup' && filter === 'all') return { tab, filter: 'export' };
  if (!['definitions', 'cash', 'reports', 'settings', 'quick_backup', 'telegram_manager', 'legacy_trade'].includes(tab)) return { tab, filter: 'all' };
  return { tab, filter };
};
export const workspacePageKey = (tab: NavTab, filter = 'all'): string => {
  const location = canonicalWorkspaceLocation(tab, filter);
  return `${location.tab}:${location.filter}`;
};
export const activeWorkspacePage = (tab: NavTab, filter = 'all', accounts: CashRegisterAccount[] = []): WorkspacePage | undefined => {
  const key = workspacePageKey(tab, filter);
  return workspacePages(accounts).find(page => workspacePageKey(page.tab, page.filter) === key);
};
export const workspacePageTitle = (tab: NavTab, filter = 'all'): string => activeWorkspacePage(tab, filter)?.label || (tab === 'production' ? 'فرآیند تولید' : tab === 'company_units' ? 'تغییر واحد شرکت' : tab === 'dashboard' ? 'داشبورد مدیریتی' : tab === 'journal' ? 'روزنامچه' : 'حسابداری');

/** Preserve a product drill-down when its independent page mounts, without changing its active sidebar leaf. */
export const itemizedSalesFilter = (productId = 'all'): string => productId === 'all' ? 'itemized' : `itemized:${encodeURIComponent(productId)}`;
export const itemizedSalesProductId = (filter = 'itemized'): string => {
  if (!filter.startsWith('itemized:')) return 'all';
  try { return decodeURIComponent(filter.slice('itemized:'.length)) || 'all'; } catch { return 'all'; }
};

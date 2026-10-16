import type { CashRegisterAccount, Party } from '../types';
import type { NavTab } from '../components/Sidebar';
import { workspacePageGroups } from './navigation';

interface SearchEntry {
  id: string;
  title: string;
  description: string;
  terms: readonly string[];
}
export type WorkspaceSearchEntry = SearchEntry & (
  | { kind: 'menu'; tab: NavTab; filter?: string; pageId: string }
  | { kind: 'party'; partyId: string }
);

/** The same spelling/digits match in Persian, Arabic and keyboard-entered phone numbers. */
export const normalizeWorkspaceSearch = (value: string): string => String(value ?? '')
  .normalize('NFKC').toLowerCase()
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[أإٱآ]/g, 'ا').replace(/[ةۀ]/g, 'ه')
  .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
  .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
  .replace(/\s+/g, ' ').trim();
const compact = (value: string): string => value.replace(/[\s()+\-]/g, '');
const terms = (...values: (string | undefined)[]): string[] => values.filter(Boolean).map(value => compact(normalizeWorkspaceSearch(value!)));

const menuAliases: Record<string, string> = {
  'treasury-center': 'مرکز دریافت پرداخت خزانه همه اسناد دریافت و پرداخت treasury center hub',
  'trade-center': 'مرکز فاکتورها عملیات خرید و فروش همه فاکتورها invoice center trade hub',
  'definition-parties': 'مشتری مشتریان اشخاص طرف حساب مشتری جدید تعریف شخص customer clients contacts',
  'definition-products': 'کالا جنس اجناس محصول محصولات product items',
  'definition-warehouses': 'انبار گدام warehouse stock',
  'sale-create': 'ایجاد فروش فاکتور جدید sales invoice create',
  'sale-list': 'لیست فهرست فروش فروشات sales invoices list',
  'purchase-create': 'ایجاد خرید فاکتور جدید purchase invoice create',
  'purchase-list': 'لیست فهرست خرید خریدها purchase invoices list',
  'receipt-create': 'دریافت پول وجه ورودی receipt receive',
  'receipt-list': 'لیست دریافت دریافتی رسید receipts list',
  'payment-create': 'پرداخت پول وجه خروجی payment pay',
  'payment-list': 'لیست پرداخت پرداختی payments list',
  'cash-exchange': 'اکسچینج اکسچنج صرافی تبدیل ارز اسعار exchange',
  'appearance': 'تم رنگ ظاهر شخصی سازی theme appearance settings',
  'company': 'تنظیمات نام شرکت لوگو company settings',
  'profit-loss': 'سود زیان مفاد تاوان profit loss',
  'consignment': 'امانات گدام امانی حواله تحویل consignment',
};
const quickPages = ['dashboard', 'sale-list', 'sale-create', 'receipt-list', 'definition-parties', 'report-inventory'];

/** Read-only, local index. Never includes Telegram tokens, connection codes or other secret fields. */
export const buildWorkspaceSearchIndex = (
  parties: readonly Party[], accounts: CashRegisterAccount[] = [],
): WorkspaceSearchEntry[] => {
  const fixed = [
    { id: 'dashboard', label: 'داشبورد مدیریتی', tab: 'dashboard' as const, group: 'محیط کار' },
    { id: 'journal', label: 'روزنامچه', tab: 'journal' as const, group: 'حسابداری' },
    { id: 'production', label: 'فرآیند تولید', tab: 'production' as const, group: 'تولید' },
    { id: 'company-units', label: 'تغییر واحد شرکت', tab: 'company_units' as const, group: 'مدیریت سیستم' },
  ];
  const pages = [...fixed, ...workspacePageGroups(accounts).flatMap(group => [...(group.landingPage ? [group.landingPage] : []), ...group.items].map(page => ({ ...page, group: group.label })))];
  const menus: WorkspaceSearchEntry[] = pages.map(page => ({
    id: `menu:${page.id}`, kind: 'menu', pageId: page.id, tab: page.tab,
    filter: 'filter' in page ? page.filter : undefined,
    title: page.label, description: page.group,
    terms: terms(page.label, page.group, page.id, page.tab, menuAliases[page.id]),
  }));
  const customers: WorkspaceSearchEntry[] = parties.map(party => ({
    id: `party:${party.id}`, kind: 'party', partyId: party.id, title: party.name,
    description: [party.type === 'supplier' ? 'فروشنده' : party.type === 'both' ? 'مشتری / فروشنده' : 'مشتری', party.code ? `کد ${party.code}` : '', party.phone || party.company].filter(Boolean).join(' · '),
    terms: terms(party.name, party.code, party.phone, party.company),
  }));
  return [...menus, ...customers];
};

export const searchWorkspace = (index: readonly WorkspaceSearchEntry[], query: string, limit = 6) => {
  const normalized = normalizeWorkspaceSearch(query), joined = compact(normalized);
  const tokens = normalized.split(' ').filter(Boolean).map(compact);
  const ranked = index.flatMap((entry, order) => {
    if (!joined) {
      const quick = entry.kind === 'menu' ? quickPages.indexOf(entry.pageId) : -1;
      return quick < 0 ? [] : [{ entry, score: 100 - quick, order }];
    }
    if (!tokens.every(token => entry.terms.some(term => term.includes(token))) && !entry.terms.some(term => term.includes(joined))) return [];
    const title = compact(normalizeWorkspaceSearch(entry.title));
    const score = title === joined ? 100 : title.startsWith(joined) ? 80 : title.includes(joined) ? 60 : 30;
    return [{ entry, score, order }];
  }).sort((a, b) => b.score - a.score || a.order - b.order).map(item => item.entry);
  const menus = ranked.filter((entry): entry is WorkspaceSearchEntry & { kind: 'menu' } => entry.kind === 'menu');
  const customers = ranked.filter((entry): entry is WorkspaceSearchEntry & { kind: 'party' } => entry.kind === 'party');
  const size = Number.isFinite(limit) ? Math.max(0, Math.min(20, Math.floor(limit))) : 6;
  return { menus: menus.slice(0, size), customers: customers.slice(0, size), menuCount: menus.length, customerCount: customers.length };
};

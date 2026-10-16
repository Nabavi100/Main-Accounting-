import type {
  CashRegisterAccount,
  ExpenseItem,
  FinancialTransaction,
  IncomeItem,
} from '../types';
import { normalizeDashboardSearch, parseDashboardDate } from './dashboard';
import { roundTradeAmount } from './tradeInvoices';

export type CompanyCashKind = 'income' | 'expense';
export type CompanyCashDocument = IncomeItem | ExpenseItem;
export interface CompanyCashSource {
  kind: CompanyCashKind;
  document: CompanyCashDocument;
}

export const companyCashAccountId = (document: CompanyCashDocument): string =>
  document.cashRegisterId ||
  (document.currency === 'USD'
    ? 'usd_cash'
    : document.currency === 'AFN'
      ? 'afn_cash'
      : '');
export const companyCashNumber = (
  kind: CompanyCashKind,
  document: CompanyCashDocument,
): string =>
  (kind === 'income'
    ? (document as IncomeItem).incomeNumber
    : (document as ExpenseItem).expenseNumber) ||
  document.receiptNumber ||
  `${kind === 'income' ? 'INC' : 'EXP'}-${document.id}`;
const canonicalNumber = (value: string) =>
  normalizeDashboardSearch(value.trim())
    .replace(/^#/, '')
    .replace(/^(?:inc|exp)[-_]?(?=\d+$)/, '')
    .replace(/^0+(?=\d)/, '');
export const duplicateCompanyCashNumber = (
  documents: CompanyCashDocument[],
  kind: CompanyCashKind,
  number: string,
  excludingId?: string,
): boolean =>
  documents.some(
    (document) =>
      document.id !== excludingId &&
      canonicalNumber(companyCashNumber(kind, document)) ===
        canonicalNumber(number),
  );
export const nextCompanyCashNumber = (
  documents: CompanyCashDocument[],
  kind: CompanyCashKind,
): string => {
  let max = 0;
  for (const document of documents) {
    const match = normalizeDashboardSearch(
      companyCashNumber(kind, document),
    ).match(/\d+$/);
    if (match && Number.isSafeInteger(Number(match[0])))
      max = Math.max(max, Number(match[0]));
  }
  return `${kind === 'income' ? 'INC' : 'EXP'}-${String(max + 1).padStart(3, '0')}`;
};
export const validateCompanyCashDocument = (
  document: CompanyCashDocument,
  accounts: CashRegisterAccount[],
): string | null => {
  if (!document.title.trim()) return 'عنوان سند را وارد کنید.';
  if (!Number.isFinite(document.amount) || document.amount <= 0)
    return 'مبلغ واقعی صندوق باید معتبر و بیشتر از صفر باشد.';
  if (!parseDashboardDate(document.date)) return 'تاریخ سند معتبر نیست.';
  const account = accounts.find(
    (account) => account.id === companyCashAccountId(document),
  );
  if (!account) return 'صندوق یا بانک معتبر را انتخاب کنید.';
  if (account.currency !== document.currency)
    return 'ارز مبلغ سند باید با ارز صندوق انتخاب‌شده یکسان باشد؛ ابتدا تبدیل ارز را انجام دهید.';
  return null;
};
/** Only AFN/USD cross-quotes are represented by this rate. Unsupported pairs never silently use 1:1. */
export const companyCashConversion = (
  amount: number,
  from: string,
  to: string,
  afnPerUsd: number,
  exchange: boolean,
): number => {
  if (!Number.isFinite(amount) || amount <= 0) return NaN;
  if (from === to) return roundTradeAmount(amount);
  if (!exchange || !Number.isFinite(afnPerUsd) || afnPerUsd <= 0) return NaN;
  if (from === 'USD' && to === 'AFN')
    return roundTradeAmount(amount * afnPerUsd);
  if (from === 'AFN' && to === 'USD')
    return roundTradeAmount(amount / afnPerUsd);
  return NaN;
};
export const ownedCompanyCashSource = (
  transaction: Pick<FinancialTransaction, 'id' | 'incomeId' | 'expenseId'>,
  incomes: IncomeItem[],
  expenses: ExpenseItem[],
): CompanyCashSource | undefined => {
  const income = incomes.find(
    (document) =>
      transaction.incomeId === document.id ||
      transaction.id === `tx-inc-${document.id}`,
  );
  if (income) return { kind: 'income', document: income };
  const expense = expenses.find(
    (document) =>
      transaction.expenseId === document.id ||
      transaction.id === `tx-exp-${document.id}`,
  );
  if (expense) return { kind: 'expense', document: expense };
  return undefined;
};
export const isCompanyCashMirror = (
  transaction: FinancialTransaction,
  kind: CompanyCashKind,
  id: string,
): boolean =>
  kind === 'income'
    ? transaction.incomeId === id || transaction.id === `tx-inc-${id}`
    : transaction.expenseId === id || transaction.id === `tx-exp-${id}`;
export const companyCashTransaction = (
  kind: CompanyCashKind,
  document: CompanyCashDocument,
  previous?: FinancialTransaction,
): FinancialTransaction => ({
  id: previous?.id || `tx-${kind === 'income' ? 'inc' : 'exp'}-${document.id}`,
  transactionNumber: companyCashNumber(kind, document),
  type: kind === 'income' ? 'receive_payment' : 'expense',
  incomeId: kind === 'income' ? document.id : undefined,
  expenseId: kind === 'expense' ? document.id : undefined,
  treasuryCategory: kind,
  date: document.date,
  issueTime: document.issueTime,
  createdByName: document.createdByName,
  amount: document.amount,
  currency: document.currency,
  cashAmount: document.amount,
  cashCurrency: document.currency,
  cashRegister: companyCashAccountId(document),
  cashRegisterName: document.cashRegisterName,
  partyName:
    kind === 'income'
      ? (document as IncomeItem).payer || `عاید شرکت: ${document.title}`
      : (document as ExpenseItem).recipient ||
        (document as ExpenseItem).payee ||
        `هزینهٔ شرکت: ${document.title}`,
  transactionSubject: document.title,
  description: `${kind === 'income' ? 'دریافت عاید' : 'پرداخت هزینه'}: ${document.title}${document.categoryName ? ` (${document.categoryName})` : ''}${document.notes ? ` — ${document.notes}` : ''}`,
  notes: document.notes,
  createdAt: previous?.createdAt || document.createdAt,
});
export const syncCompanyCashTransaction = (
  transactions: FinancialTransaction[],
  kind: CompanyCashKind,
  document: CompanyCashDocument,
): FinancialTransaction[] => {
  const previous = transactions.find((transaction) =>
    isCompanyCashMirror(transaction, kind, document.id),
  );
  return [
    companyCashTransaction(kind, document, previous),
    ...transactions.filter(
      (transaction) => !isCompanyCashMirror(transaction, kind, document.id),
    ),
  ];
};
/** Read-only projection surfaces old source records too, without re-posting cash or rewriting saved history. */
export const projectCompanyCashTransactions = (
  transactions: FinancialTransaction[],
  incomes: IncomeItem[],
  expenses: ExpenseItem[],
): FinancialTransaction[] => {
  const remaining = transactions.filter(
    (transaction) => !ownedCompanyCashSource(transaction, incomes, expenses),
  );
  return [
    ...incomes.map((document) =>
      companyCashTransaction(
        'income',
        document,
        transactions.find((transaction) =>
          isCompanyCashMirror(transaction, 'income', document.id),
        ),
      ),
    ),
    ...expenses.map((document) =>
      companyCashTransaction(
        'expense',
        document,
        transactions.find((transaction) =>
          isCompanyCashMirror(transaction, 'expense', document.id),
        ),
      ),
    ),
    ...remaining,
  ];
};

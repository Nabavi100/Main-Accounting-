import type {
  CashRegisterAccount,
  FinancialTransaction,
  TransactionType,
} from "../types";
import { normalizeDashboardSearch, parseDashboardDate } from "./dashboard";
import { normalizeTradeInvoiceNumber, roundTradeAmount } from "./tradeInvoices";

export type TreasuryDirection = "receipt" | "payment";
export type TreasuryMode = "party" | "income" | "expense" | "transfer";
export const treasuryTransactionType = (
  direction: TreasuryDirection,
  mode: TreasuryMode,
): TransactionType =>
  mode === "transfer"
    ? "cash_transfer"
    : direction === "receipt"
      ? "receive_payment"
      : "make_payment";
const canonicalNumber = (number: string) =>
  normalizeDashboardSearch(normalizeTradeInvoiceNumber(number))
    .replace(/^(?:rec|pay|trx|trf|exc)[-_]?(?=\d+$)/, "")
    .replace(/^0+(?=\d)/, "");
export const duplicateTreasuryNumber = (
  transactions: FinancialTransaction[],
  type: TransactionType,
  number: string,
  excludingId?: string,
) =>
  transactions.some(
    (tx) =>
      tx.type === type &&
      tx.id !== excludingId &&
      canonicalNumber(tx.transactionNumber) === canonicalNumber(number),
  );
export const nextTreasuryNumber = (
  transactions: FinancialTransaction[],
  type: TransactionType,
): string => {
  let max = 0;
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const match = normalizeDashboardSearch(tx.transactionNumber).match(/\d+$/);
    if (match && Number.isSafeInteger(Number(match[0])))
      max = Math.max(max, Number(match[0]));
  }
  return String(max + 1);
};
export const convertTreasuryAmount = (
  amount: number,
  fromRate: number,
  toRate: number,
): number =>
  Number.isFinite(amount) && fromRate > 0 && toRate > 0
    ? roundTradeAmount((amount * fromRate) / toRate)
    : NaN;
export const treasuryEntries = (
  transactions: FinancialTransaction[],
  direction: TreasuryDirection,
) =>
  transactions
    .filter(
      (tx) =>
        tx.type ===
          (direction === "receipt" ? "receive_payment" : "make_payment") ||
        tx.type === "cash_transfer" ||
        tx.type === "currency_exchange" ||
        (direction === "payment" && tx.type === "expense"),
    )
    .sort(
      (a, b) =>
        (parseDashboardDate(b.date)?.getTime() || 0) -
          (parseDashboardDate(a.date)?.getTime() || 0) ||
        (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    );
export const treasuryEntryCash = (
  tx: FinancialTransaction,
  direction: TreasuryDirection,
  accounts: CashRegisterAccount[],
) => {
  const transfer =
    tx.type === "cash_transfer" || tx.type === "currency_exchange";
  const accountId = transfer
    ? direction === "receipt"
      ? tx.toCashRegister
      : tx.fromCashRegister
    : tx.cashRegister;
  const account = accounts.find((account) => account.id === accountId);
  const currency =
    transfer && direction === "receipt"
      ? tx.targetCurrency || account?.currency || tx.currency
      : tx.cashCurrency || account?.currency || tx.currency;
  const amount = transfer
    ? direction === "receipt"
      ? tx.isExchange || tx.type === "currency_exchange"
        ? (tx.targetAmount ?? tx.amount)
        : tx.amount
      : tx.amount
    : tx.isExchange
      ? (tx.cashAmount ?? tx.amount)
      : tx.amount;
  return {
    accountId,
    accountName: account?.name || tx.cashRegisterName || "—",
    currency,
    amount,
  };
};
export const treasuryCategory = (
  tx: FinancialTransaction,
):
  | "invoice"
  | "personal"
  | "refund"
  | "discount"
  | "transfer"
  | "income"
  | "expense"
  | "other" =>
  tx.incomeId || tx.treasuryCategory === "income"
    ? "income"
    : tx.expenseId || tx.type === "expense" || tx.treasuryCategory === "expense"
      ? "expense"
      : tx.invoiceId
        ? "invoice"
        : (tx.discountAmount || 0) > 0
          ? "discount"
          : tx.treasuryCategory === "refund"
            ? "refund"
            : tx.type === "cash_transfer" || tx.type === "currency_exchange"
              ? "transfer"
              : tx.partyId
                ? "personal"
                : "other";
export const treasurySearchMatch = (
  tx: FinancialTransaction,
  query: string,
  accountName = "",
) =>
  normalizeDashboardSearch(
    [
      tx.transactionNumber,
      tx.partyName,
      tx.partyPhone,
      tx.description,
      tx.transactionSubject,
      tx.createdByName,
      accountName,
    ].join(" "),
  ).includes(normalizeDashboardSearch(query));

import type {
  CashRegisterAccount,
  CashRegisterState,
  FinancialTransaction,
  Party,
} from "../types";
import { addInvoiceLedgerAmount } from "./invoiceLedger";

const roundLedgerAmount = (value: number) => addInvoiceLedgerAmount(0, value);

export const transactionPartyDelta = (tx: FinancialTransaction): number => {
  const direction =
    tx.type === "receive_payment" ? 1 : tx.type === "make_payment" ? -1 : 0;
  return roundLedgerAmount(direction * (tx.amount + (tx.discountAmount || 0)));
};
export const transactionCashAmount = (tx: FinancialTransaction): number =>
  tx.isExchange && typeof tx.cashAmount === "number"
    ? tx.cashAmount
    : tx.amount;
export const transactionCashPostings = (
  tx: FinancialTransaction,
): [string, number][] => {
  const cash = transactionCashAmount(tx);
  if (tx.type === "receive_payment")
    return tx.cashRegister ? [[tx.cashRegister, cash]] : [];
  if (tx.type === "make_payment" || tx.type === "expense")
    return tx.cashRegister ? [[tx.cashRegister, -cash]] : [];
  if (tx.type === "cash_transfer")
    return tx.fromCashRegister && tx.toCashRegister
      ? [
          [tx.fromCashRegister, -tx.amount],
          [
            tx.toCashRegister,
            tx.isExchange && typeof tx.targetAmount === "number"
              ? tx.targetAmount
              : tx.amount,
          ],
        ]
      : [];
  if (tx.type === "currency_exchange")
    return [
      [
        tx.fromCashRegister ||
          (tx.currency === "USD" ? "usd_cash" : "afn_cash"),
        -tx.amount,
      ],
      [
        tx.toCashRegister ||
          (tx.targetCurrency === "USD" ? "usd_cash" : "afn_cash"),
        tx.targetAmount || 0,
      ],
    ];
  return [];
};
export const applyTransactionParties = (
  parties: Party[],
  tx: FinancialTransaction,
  reverse = false,
): Party[] => {
  const delta = transactionPartyDelta(tx) * (reverse ? -1 : 1);
  if (!tx.partyId || !delta || !["USD", "AFN"].includes(tx.currency))
    return parties;
  const key = tx.currency === "AFN" ? "balanceAFN" : "balanceUSD";
  return parties.map((party) =>
    party.id === tx.partyId
      ? { ...party, [key]: roundLedgerAmount(party[key] + delta) }
      : party,
  );
};
export const applyTransactionCashAccounts = (
  accounts: CashRegisterAccount[],
  tx: FinancialTransaction,
  reverse = false,
): CashRegisterAccount[] => {
  const postings = transactionCashPostings(tx);
  return accounts.map((account) => {
    const delta =
      postings
        .filter(([id]) => id === account.id)
        .reduce((total, [, amount]) => total + amount, 0) * (reverse ? -1 : 1);
    return delta
      ? { ...account, balance: roundLedgerAmount(account.balance + delta) }
      : account;
  });
};
export const applyTransactionCashRegister = (
  register: CashRegisterState,
  tx: FinancialTransaction,
  reverse = false,
): CashRegisterState => {
  const next = { ...register };
  for (const [id, amount] of transactionCashPostings(tx)) {
    const key =
      id === "afn_cash"
        ? "afnBalance"
        : id === "usd_cash"
          ? "usdBalance"
          : id === "exchange_usd_cash"
            ? "exchangeUsdBalance"
            : null;
    if (key)
      next[key] = roundLedgerAmount(
        (next[key] || 0) + amount * (reverse ? -1 : 1),
      );
  }
  return next;
};

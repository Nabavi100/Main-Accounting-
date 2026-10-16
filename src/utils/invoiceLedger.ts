import type {
  CashRegisterAccount,
  CashRegisterState,
  Invoice,
  InvoiceType,
  Party,
} from "../types";

let fallbackIdSequence = 0;
/** Public document / row IDs, not authentication tokens. Also works on non-HTTPS LAN previews. */
export const createTradeEntityId = (prefix: string): string =>
  `${prefix}-${
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${++fallbackIdSequence}-${Math.random().toString(36).slice(2, 10)}`
  }`;

/** Same sign convention for stock and outstanding party debt; returns are exact opposites. */
export const invoiceStockDirection = (type: InvoiceType): 1 | -1 =>
  type === "buy" || type === "return_sell" ? 1 : -1;
export const invoiceCashDirection = (type: InvoiceType): 1 | -1 =>
  invoiceStockDirection(type) === 1 ? -1 : 1;

/** Invoices carry six-decimal values. Do not erase a negative balance with a zero clamp. */
export const addInvoiceLedgerAmount = (
  current: number,
  delta: number,
): number =>
  Math.round((current + delta + Number.EPSILON) * 1_000_000) / 1_000_000;

export const applyInvoicePartyBalance = (
  parties: Party[],
  invoice: Invoice,
  reverse = false,
): Party[] => {
  const field = invoice.currency === "AFN" ? "balanceAFN" : "balanceUSD";
  const delta =
    invoiceStockDirection(invoice.type) *
    invoice.balanceAmount *
    (reverse ? -1 : 1);
  return parties.map((party) =>
    party.id === invoice.partyId
      ? { ...party, [field]: addInvoiceLedgerAmount(party[field], delta) }
      : party,
  );
};

export const invoiceCashAccountId = (invoice: Invoice): string =>
  invoice.cashRegister ||
  invoice.cashRegisterId ||
  (invoice.currency === "AFN" ? "afn_cash" : "usd_cash");

export const applyInvoiceCashRegister = (
  register: CashRegisterState,
  invoice: Invoice,
  reverse = false,
): CashRegisterState => {
  if (!invoice.paidAmount) return register;
  const key = invoiceCashAccountId(invoice);
  const field =
    key === "afn_cash"
      ? "afnBalance"
      : key === "usd_cash"
        ? "usdBalance"
        : key === "exchange_usd_cash"
          ? "exchangeUsdBalance"
          : null;
  if (!field) return register; // Custom account balances live in cashAccounts, not the three legacy register fields.
  const delta =
    invoiceCashDirection(invoice.type) *
    invoice.paidAmount *
    (reverse ? -1 : 1);
  return {
    ...register,
    [field]: addInvoiceLedgerAmount(register[field] || 0, delta),
  };
};

export const applyInvoiceCashAccounts = (
  accounts: CashRegisterAccount[],
  invoice: Invoice,
  reverse = false,
): CashRegisterAccount[] => {
  if (!invoice.paidAmount) return accounts;
  const key = invoiceCashAccountId(invoice);
  const delta =
    invoiceCashDirection(invoice.type) *
    invoice.paidAmount *
    (reverse ? -1 : 1);
  return accounts.map((account) =>
    account.id === key
      ? { ...account, balance: addInvoiceLedgerAmount(account.balance, delta) }
      : account,
  );
};

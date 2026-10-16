import type {
  CashRegisterAccount,
  CurrencyDefinition,
  FinancialTransaction,
  Invoice,
} from "../types";

const positive = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** The user-facing quote always means 1 USD = this many AFN, never its inverse. */
export const systemUsdAfnQuote = (
  currencies: CurrencyDefinition[],
  cashRegisterQuote?: number,
): number => {
  const usd = currencies.find((currency) => currency.code === "USD");
  // An explicitly invalid definition needs correction, not an invented fallback.
  const value = usd ? usd.exchangeRateToAFN : cashRegisterQuote;
  return positive(value) ? value : NaN;
};

const afnValue = (
  currencies: CurrencyDefinition[],
  code: string,
  usdAfnQuote: number,
): number => {
  if (!positive(usdAfnQuote)) return NaN;
  if (code === "AFN") return 1;
  if (code === "USD") return usdAfnQuote;
  const value = currencies.find((currency) => currency.code === code)?.exchangeRateToAFN;
  return positive(value) ? value : NaN;
};

/** Keep the arithmetic ratio separate from the human-facing AFN-per-dollar quote. */
export const documentConversionRate = (
  currencies: CurrencyDefinition[],
  from: string,
  to: string,
  usdAfnQuote: number,
): number => afnValue(currencies, from, usdAfnQuote) / afnValue(currencies, to, usdAfnQuote);

export const documentRateToBase = (
  currencies: CurrencyDefinition[],
  code: string,
  usdAfnQuote: number,
): number => documentConversionRate(
  currencies, code, currencies.find((currency) => currency.isBase)?.code || "AFN", usdAfnQuote,
);

export const isUsdAfnPair = (from: string, to: string): boolean =>
  (from === "USD" && to === "AFN") || (from === "AFN" && to === "USD");

/** Remove only machine noise from a reciprocal, not meaningful historical precision. */
const inverseQuote = (rate: number): number => {
  const value = 1 / rate;
  const clean = Number(value.toPrecision(15));
  return Math.abs(clean - value) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4 ? clean : value;
};
const quoteFromBase = (code: string, base: string | undefined, rate: number | undefined): number => {
  if (!positive(rate)) return NaN;
  if (code === "AFN" && base === "USD") return inverseQuote(rate);
  if (code === "USD" && base === "AFN") return rate;
  return NaN;
};

export const initialInvoiceUsdAfnQuote = (
  currencies: CurrencyDefinition[],
  invoice?: Invoice,
  cashRegisterQuote?: number,
): number => {
  const historical = invoice && quoteFromBase(invoice.currency, invoice.exchangeRateBaseCurrency, invoice.exchangeRate);
  // Older editors know the applied mathematical rate, but may carry newer optional metadata unchanged.
  if (positive(historical)) {
    const explicit = invoice?.usdToAfnRate;
    return positive(explicit) && Math.abs(explicit - historical) <= Number.EPSILON * Math.max(1, historical) * 8 ? explicit : historical;
  }
  if (invoice?.usdToAfnRate !== undefined)
    return positive(invoice.usdToAfnRate) ? invoice.usdToAfnRate : NaN;
  // A base-currency invoice can still have an archived cross-currency expense quote.
  const expenseQuotes = (invoice?.extraExpenses || [])
    .filter((expense) => isUsdAfnPair(expense.currency, invoice!.currency) && positive(expense.exchangeRateToInvoice))
    .map((expense) => expense.currency === "USD" ? expense.exchangeRateToInvoice! : inverseQuote(expense.exchangeRateToInvoice!));
  if (expenseQuotes.length && expenseQuotes.every((quote) => Math.abs(quote - expenseQuotes[0]) <= 1e-10 * Math.max(1, quote)))
    return expenseQuotes[0];
  return systemUsdAfnQuote(currencies, cashRegisterQuote);
};

export const initialTransactionUsdAfnQuote = (
  currencies: CurrencyDefinition[],
  transaction?: FinancialTransaction,
  cashRegisterQuote?: number,
): number => {
  if (transaction) {
    const from = transaction.cashCurrency || transaction.currency;
    const to = transaction.type === "cash_transfer" || transaction.type === "currency_exchange"
      ? transaction.targetCurrency || transaction.currency : transaction.currency;
    if (transaction.isExchange && isUsdAfnPair(from, to) && positive(transaction.exchangeRate))
      return transaction.exchangeRate;
    if (transaction.usdToAfnRate !== undefined)
      return positive(transaction.usdToAfnRate) ? transaction.usdToAfnRate : NaN;
    const historical = quoteFromBase(from, transaction.exchangeRateBaseCurrency, transaction.quoteToBase);
    if (positive(historical)) return historical;
    // Old documents without rate metadata still have their explicit posted cash amounts.
    const cash = transaction.cashAmount ?? transaction.amount;
    const target = transaction.type === "cash_transfer" || transaction.type === "currency_exchange"
      ? transaction.targetAmount : transaction.amount;
    if (transaction.isExchange && isUsdAfnPair(from, to) && positive(cash) && positive(target))
      return from === "USD" ? target / cash : cash / target;
  }
  return systemUsdAfnQuote(currencies, cashRegisterQuote);
};

/** Prefer the company's main matching fund; sarafi/bank funds remain manually selectable. */
export const preferredCashAccountId = (
  accounts: CashRegisterAccount[],
  currency: string,
  excludingId?: string,
): string => {
  const matching = accounts.filter((account) => account.currency === currency && account.id !== excludingId);
  const primary = currency === "AFN" ? "afn_cash" : currency === "USD" ? "usd_cash" : "";
  const isExchange = (account: CashRegisterAccount) =>
    account.type === "exchange" || account.id === "exchange_usd_cash" || /صرافی|sarafi|exchange/i.test(account.name);
  return (matching.find((account) => account.id === primary)
    || matching.find((account) => account.isDefault && !isExchange(account))
    || matching.find((account) => account.type === "cash" && !isExchange(account))
    || matching.find((account) => !isExchange(account))
    || matching[0])?.id || "";
};

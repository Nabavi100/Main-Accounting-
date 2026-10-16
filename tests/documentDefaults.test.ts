import test from "node:test";
import assert from "node:assert/strict";
import type { CashRegisterAccount, CurrencyDefinition, FinancialTransaction, Invoice } from "../src/types";
import {
  documentConversionRate,
  documentRateToBase,
  initialInvoiceUsdAfnQuote,
  initialTransactionUsdAfnQuote,
  isUsdAfnPair,
  preferredCashAccountId,
  systemUsdAfnQuote,
} from "../src/utils/documentDefaults";
import { formatCurrency } from "../src/utils/formatters";
import { tradePaymentAmounts } from "../src/utils/tradeInvoices";

const currencies: CurrencyDefinition[] = [
  { id: "usd", code: "USD", name: "دالر", symbol: "$", isBase: true, exchangeRateToAFN: 65 },
  { id: "afn", code: "AFN", name: "افغانی", symbol: "؋", exchangeRateToAFN: 1 },
  { id: "eur", code: "EUR", name: "یورو", symbol: "€", exchangeRateToAFN: 70.5 },
];
const account = (id: string, currency: string, changes: Partial<CashRegisterAccount> = {}): CashRegisterAccount => ({
  id, name: id, currency, balance: 100, initialBalance: 100, ...changes,
});
const invoice = (changes: Partial<Invoice>): Invoice => ({
  id: "i", invoiceNumber: "1", type: "buy", currency: "AFN", warehouseId: "w", items: [], partyId: "p", partyName: "شخص نمونه",
  date: "1405/07/24", totalAmount: 6500, subtotal: 6500, discount: 0, paidAmount: 0,
  balanceAmount: 6500, paymentStatus: "unpaid", createdAt: "2026-10-16", ...changes,
});
const transaction = (changes: Partial<FinancialTransaction>): FinancialTransaction => ({
  id: "t", transactionNumber: "1", type: "receive_payment", currency: "USD", amount: 100,
  cashCurrency: "AFN", cashAmount: 6500, cashRegister: "afn_cash", isExchange: true,
  date: "1405/07/24", description: "آزمایش", createdAt: "2026-10-16", ...changes,
});

test("visible rate is the defined AFN per dollar, not the reciprocal or an invented fallback", () => {
  assert.equal(systemUsdAfnQuote(currencies, 70), 65);
  assert.equal(systemUsdAfnQuote([], 67.123456), 67.123456);
  assert.ok(Number.isNaN(systemUsdAfnQuote(currencies.map(c => c.code === "USD" ? { ...c, exchangeRateToAFN: 0 } : c), 65)));
  assert.ok(Number.isNaN(systemUsdAfnQuote([])));
});
test("65 AFN per dollar multiplies USD and divides AFN, independently of the system base", () => {
  for (const base of ["USD", "AFN", "EUR"]) {
    const definitions = currencies.map(c => ({ ...c, isBase: c.code === base }));
    assert.equal(documentConversionRate(definitions, "AFN", "USD", 65) * 6500, 100);
    assert.equal(documentConversionRate(definitions, "USD", "AFN", 65) * 100, 6500);
    assert.equal(documentConversionRate(definitions, "AFN", "AFN", 65), 1);
    assert.equal(documentConversionRate(definitions, "USD", "USD", 65), 1);
  }
  assert.equal(documentRateToBase(currencies, "AFN", 65), 1 / 65);
  assert.equal(documentRateToBase(currencies, "USD", 65), 1);
  const afnBase = currencies.map(c => ({ ...c, isBase: c.code === "AFN" }));
  assert.equal(documentRateToBase(afnBase, "USD", 65), 65);
  assert.equal(documentRateToBase(afnBase, "AFN", 65), 1);
});
test("other currencies retain their explicit definitions and invalid quotes cannot silently post", () => {
  assert.equal(documentConversionRate(currencies, "EUR", "AFN", 65), 70.5);
  assert.equal(documentConversionRate(currencies, "EUR", "USD", 50), 70.5 / 50);
  assert.ok(isUsdAfnPair("USD", "AFN")); assert.ok(isUsdAfnPair("AFN", "USD"));
  assert.equal(isUsdAfnPair("USD", "USD"), false); assert.equal(isUsdAfnPair("EUR", "AFN"), false);
  for (const quote of [0, -65, NaN, Infinity])
    for (const code of ["AFN", "USD"])
      assert.ok(Number.isNaN(documentRateToBase(currencies, code, quote)));
  assert.ok(Number.isNaN(documentConversionRate(currencies, "unknown", "USD", 65)));
});
test("archived invoice quotes do not change when today's rate or base currency changes", () => {
  const explicit = invoice({ usdToAfnRate: 50, exchangeRate: 0.02, exchangeRateBaseCurrency: "USD" });
  const changed = currencies.map(c => ({ ...c, isBase: c.code === "AFN", exchangeRateToAFN: c.code === "USD" ? 70 : c.exchangeRateToAFN }));
  const before = structuredClone(explicit);
  assert.equal(initialInvoiceUsdAfnQuote(changed, explicit), 50);
  assert.equal(initialInvoiceUsdAfnQuote(changed, invoice({ exchangeRate: 0.02, exchangeRateBaseCurrency: "USD" })), 50);
  assert.equal(initialInvoiceUsdAfnQuote(changed, invoice({ currency: "USD", exchangeRate: 60, exchangeRateBaseCurrency: "AFN" })), 60);
  assert.equal(initialInvoiceUsdAfnQuote(currencies, invoice({ exchangeRate: 1 / 65, exchangeRateBaseCurrency: "USD" })), 65);
  assert.deepEqual(explicit, before);
});
test("base-currency invoices can recover a consistent historical quote from foreign expenses", () => {
  assert.equal(initialInvoiceUsdAfnQuote(currencies, invoice({ currency: "USD", exchangeRate: 1, exchangeRateBaseCurrency: "USD", extraExpenses: [
    { id: "e", partyName: "راننده", title: "کرایه", amount: 500, currency: "AFN", exchangeRateToInvoice: 0.02 },
  ] })), 50);
  assert.equal(initialInvoiceUsdAfnQuote(currencies, invoice({ currency: "USD", exchangeRate: 1, exchangeRateBaseCurrency: "USD" })), 65);
});
test("receipts and both transfer directions recover historical 65, never display 0.015384", () => {
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ exchangeRate: 65, quoteToBase: 1 / 70, exchangeRateBaseCurrency: "USD" })), 65);
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ quoteToBase: 0.02, exchangeRateBaseCurrency: "USD" })), 50);
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({})), 65);
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ type: "cash_transfer", currency: "AFN", amount: 6500, targetCurrency: "USD", targetAmount: 100 })), 65);
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ type: "cash_transfer", currency: "USD", cashCurrency: "USD", cashAmount: 100, amount: 100, targetCurrency: "AFN", targetAmount: 6500 })), 65);
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ usdToAfnRate: 55, exchangeRate: 65 })), 65);
});
test("same-currency documents must not confuse their ratio of one with the dollar quote", () => {
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ isExchange: false, currency: "USD", cashCurrency: "USD", quoteToBase: 1, exchangeRateBaseCurrency: "USD", exchangeRate: 1 })), 65);
});
test("main company funds win even if a sarafi fund is listed first or marked default", () => {
  const accounts = [account("exchange_usd_cash", "USD", { isDefault: true }), account("usd_cash", "USD"), account("afn_cash", "AFN")];
  const before = structuredClone(accounts);
  assert.equal(preferredCashAccountId(accounts, "USD"), "usd_cash");
  assert.equal(preferredCashAccountId(accounts, "AFN"), "afn_cash");
  assert.equal(preferredCashAccountId(accounts, "USD", "usd_cash"), "exchange_usd_cash");
  assert.equal(preferredCashAccountId(accounts, "EUR"), "");
  assert.deepEqual(accounts, before);
});
test("custom matching funds are supported without selecting a fund in the wrong currency", () => {
  const accounts = [account("sarafi", "USD", { type: "exchange", isDefault: true }), account("branch", "USD", { type: "cash" }), account("afn", "AFN")];
  assert.equal(preferredCashAccountId(accounts, "USD"), "branch");
  assert.equal(preferredCashAccountId(accounts, "AFN"), "afn");
  assert.equal(preferredCashAccountId([account("afn_cash", "USD"), account("other", "AFN")], "AFN"), "other");
  assert.equal(preferredCashAccountId([], "USD"), "");
});
test("cash, credit and automatic half-credit stay exact while preserving a manually entered receipt", () => {
  assert.deepEqual(tradePaymentAmounts(6500, "نقدی"), { paid: 6500, balance: 0, status: "paid" });
  assert.deepEqual(tradePaymentAmounts(6500, "نسیه"), { paid: 0, balance: 6500, status: "unpaid" });
  assert.deepEqual(tradePaymentAmounts(6500, "نیمه نسیه"), { paid: 3250, balance: 3250, status: "partial" });
  assert.deepEqual(tradePaymentAmounts(6500, "نیمه نسیه", 37.123456), { paid: 37.123456, balance: 6462.876544, status: "partial" });
  assert.equal(tradePaymentAmounts(101.123455, "نیمه نسیه").paid, 50.561728);
  assert.equal(tradePaymentAmounts(6500, "نیمه نسیه", 0).paid, 0, "Do not replace a manual zero with half; validation must reject it");
});

test("applied historical rates beat stale optional metadata left behind by an older editor", () => {
  assert.equal(initialInvoiceUsdAfnQuote(currencies, invoice({ usdToAfnRate: 65, exchangeRate: 0.02, exchangeRateBaseCurrency: "USD" })), 50);
  assert.equal(initialTransactionUsdAfnQuote(currencies, transaction({ usdToAfnRate: 65, exchangeRate: 50 })), 50);
});
test("cash transfer currency formatting can show six decimals without changing existing two-decimal callers", () => {
  assert.equal(formatCurrency(0.015385, "USD"), "$۰٫۰۲");
  assert.equal(formatCurrency(0.015385, "USD", 6), "$۰٫۰۱۵۳۸۵");
  assert.equal(formatCurrency(-0.015385, "AFN", 6), "-۰٫۰۱۵۳۸۵ ؋");
});

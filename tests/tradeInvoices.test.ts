import test from "node:test";
import assert from "node:assert/strict";
import type {
  CurrencyDefinition,
  Invoice,
  InvoiceItem,
  Product,
} from "../src/types";
import {
  aggregateTradeInvoices,
  calculateTradeTotals,
  currencyRateToBase,
  duplicateTradeNumber,
  expenseRateToInvoice,
  filterTradeInvoices,
  initialTradeExchangeRate,
  tradeShamsiDate,
  nextTradeInvoiceNumber,
  normalizeTradeInvoiceNumber,
  normalizeTradePaymentType,
  parseTradeNumber,
  roundTradeAmount,
  tradeGregorianEquivalent,
  tradeItemSummary,
  tradePaymentAmounts,
  tradeUnitPrice,
  validateTradeDraft,
  type TradeDraftExpense,
  type TradeDraftRow,
  type TradeDraftValidation,
} from "../src/utils/tradeInvoices";

const currencies: CurrencyDefinition[] = [
  {
    id: "usd",
    code: "USD",
    name: "دالر",
    symbol: "$",
    exchangeRateToAFN: 65,
    isBase: true,
  },
  { id: "afn", code: "AFN", name: "افغانی", symbol: "؋", exchangeRateToAFN: 1 },
  {
    id: "eur",
    code: "EUR",
    name: "یورو",
    symbol: "€",
    exchangeRateToAFN: 70.5,
  },
];
const product: Product = {
  id: "p",
  name: "کالای آزمایشی",
  code: "1",
  category: "عمومی",
  bagWeightKg: 50,
  bagsPerTon: 20,
  buyPriceUSD: 25,
  sellPriceUSD: 35,
  buyPriceAFN: 1625,
  sellPriceAFN: 2275,
  minStockTons: 1,
};
const row: TradeDraftRow = {
  id: "r",
  productId: "p",
  unit: "ton",
  quantity: "2",
  unitPrice: "100",
  description: "",
};
const item: InvoiceItem = {
  id: "r",
  productId: "p",
  productName: "کالای آزمایشی",
  warehouseId: "w",
  unit: "ton",
  quantity: 2,
  bagsCount: 40,
  tonsCount: 2,
  unitPrice: 100,
  currency: "USD",
  totalPrice: 200,
};
const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "i",
  type: "buy",
  invoiceNumber: "1",
  date: "1405/07/23",
  partyId: "supplier",
  partyName: "شرکت کریمی",
  currency: "USD",
  warehouseId: "w",
  items: [item],
  subtotal: 200,
  discount: 0,
  totalAmount: 200,
  paidAmount: 100,
  balanceAmount: 100,
  paymentStatus: "partial",
  createdAt: "2026-10-15T10:00:00Z",
  ...overrides,
});
const draft: TradeDraftValidation = {
  partyId: "supplier",
  warehouseId: "w",
  number: "1",
  date: "1405/07/23",
  currency: "USD",
  exchangeRate: 1,
  rows: [row],
  expenses: [],
  discount: 0,
  subtotal: 200,
  shipping: 0,
  total: 200,
  paid: 100,
  paymentType: "نیمه نسیه",
  cashAccountId: "usd_cash",
  cashCurrency: "USD",
};

test("decimal parsing supports Persian / Arabic digits and separators, but rejects empty / malformed input", () => {
  assert.equal(parseTradeNumber("۱٬۲۳۴٫۵۶"), 1234.56);
  assert.equal(parseTradeNumber("٢.٥"), 2.5);
  assert.equal(parseTradeNumber("1,234.50"), 1234.5);
  assert.ok(Number.isNaN(parseTradeNumber("")));
  assert.ok(Number.isNaN(parseTradeNumber("3oops")));
  assert.ok(Number.isNaN(parseTradeNumber(Infinity)));
});

test("six-decimal rounding removes floating point residue without rounding bag prices to integers", () => {
  assert.equal(roundTradeAmount(0.1 + 0.2), 0.3);
  assert.equal(roundTradeAmount(1.1234567), 1.123457);
  assert.equal(tradeUnitPrice(product, "bag", "USD", "sell"), 1.75);
  assert.equal(tradeUnitPrice(product, "bag", "USD", "buy"), 1.25);
  assert.equal(tradeUnitPrice(product, "ton", "AFN", "sell"), 2275);
});

test("invoice numbering is pure, per type, and understands legacy prefixes and Persian numbers", () => {
  const invoices = [
    makeInvoice({ invoiceNumber: "PUR-۴۹" }),
    makeInvoice({ id: "s", type: "sell", invoiceNumber: "1704" }),
    makeInvoice({ id: "r", type: "return_buy", invoiceNumber: "PRT-200" }),
  ];
  const original = structuredClone(invoices);
  assert.equal(nextTradeInvoiceNumber(invoices, "buy"), "50");
  assert.equal(nextTradeInvoiceNumber(invoices, "buy"), "50");
  assert.equal(nextTradeInvoiceNumber(invoices, "sell"), "1705");
  assert.equal(nextTradeInvoiceNumber([], "buy"), "1");
  assert.deepEqual(invoices, original);
});

test("number normalization preserves legacy prefix / hyphen while normalizing digits", () => {
  assert.equal(normalizeTradeInvoiceNumber(" #PUR-۰۰۳ "), "PUR-003");
  assert.equal(normalizeTradeInvoiceNumber(" INV-123 "), "INV-123");
});

test("creation rejects a duplicate number but editing the same record is allowed", () => {
  const invoices = [makeInvoice({ invoiceNumber: "۴۹" })];
  assert.equal(duplicateTradeNumber(invoices, "buy", " #49 "), true);
  assert.equal(duplicateTradeNumber(invoices, "sell", "49"), false);
  assert.equal(duplicateTradeNumber(invoices, "buy", "49", "i"), false);
  assert.equal(
    duplicateTradeNumber(
      [makeInvoice({ invoiceNumber: "PUR-049" })],
      "buy",
      "49",
    ),
    true,
  );
});

test("USD base rate is one rather than the AFN conversion rate", () => {
  assert.equal(currencyRateToBase(currencies, "USD"), 1);
  assert.equal(currencyRateToBase(currencies, "AFN"), 1 / 65);
  assert.equal(currencyRateToBase(currencies, "EUR"), 70.5 / 65);
  assert.ok(Number.isNaN(currencyRateToBase(currencies, "unknown")));
});

test("expense conversion honors invoice currency and an explicit invoice exchange rate", () => {
  assert.equal(expenseRateToInvoice(currencies, "USD", "USD", 1), 1);
  assert.equal(expenseRateToInvoice(currencies, "AFN", "USD", 1), 1 / 65);
  assert.equal(expenseRateToInvoice(currencies, "USD", "AFN", 1 / 65), 65);
  assert.equal(expenseRateToInvoice(currencies, "USD", "AFN", 0.02), 50);
});

test("mixed-currency purchase expenses are converted, never simply summed", () => {
  const expenses: TradeDraftExpense[] = [
    {
      id: "e1",
      partyName: "راننده",
      title: "کرایه",
      currency: "AFN",
      amount: "650",
      exchangeRateToInvoice: 1 / 65,
    },
    {
      id: "e2",
      partyName: "بارگیر",
      title: "تخلیه",
      currency: "USD",
      amount: "5",
      exchangeRateToInvoice: 1,
    },
  ];
  assert.deepEqual(calculateTradeTotals([row], 10, 0, expenses, "USD"), {
    subtotal: 200,
    expensesTotal: 15,
    total: 205,
  });
  // Saved expense rates continue to give the same amount if today's currency definitions change.
  assert.equal(calculateTradeTotals([row], 10, 0, expenses, "USD").total, 205);
});

test("sales total includes shipping and subtracts discount, ignoring untouched blank rows", () => {
  const blank: TradeDraftRow = {
    ...row,
    id: "blank",
    productId: "",
    unit: "",
    quantity: "1",
    unitPrice: "0",
  };
  assert.deepEqual(calculateTradeTotals([row, blank], 10, 15, [], "USD"), {
    subtotal: 200,
    expensesTotal: 0,
    total: 205,
  });
});

test("cash / credit / partial payments produce exact outstanding amounts and statuses", () => {
  assert.deepEqual(tradePaymentAmounts(205, "نقدی", 0), {
    paid: 205,
    balance: 0,
    status: "paid",
  });
  assert.deepEqual(tradePaymentAmounts(205, "نسیه", 100), {
    paid: 0,
    balance: 205,
    status: "unpaid",
  });
  assert.deepEqual(tradePaymentAmounts(205, "نیمه نسیه", 100), {
    paid: 100,
    balance: 105,
    status: "partial",
  });
});

test("editing recognizes legacy English and Persian payment method labels", () => {
  assert.equal(
    normalizeTradePaymentType(makeInvoice({ paymentType: "cash" })),
    "نقدی",
  );
  assert.equal(
    normalizeTradePaymentType(makeInvoice({ paymentType: "credit" })),
    "نسیه",
  );
  assert.equal(
    normalizeTradePaymentType(makeInvoice({ paymentType: "hybrid" })),
    "نیمه نسیه",
  );
  assert.equal(
    normalizeTradePaymentType(makeInvoice({ paymentType: undefined })),
    "نیمه نسیه",
  );
});

test("list search filters by type and party, normalizes digits / Arabic letters, and never mutates data", () => {
  const invoices = [
    makeInvoice({ invoiceNumber: "1704" }),
    makeInvoice({ id: "s", type: "sell" }),
    makeInvoice({
      id: "older",
      partyId: "other",
      createdAt: "2026-10-14T10:00:00Z",
    }),
  ];
  const original = structuredClone(invoices);
  assert.equal(filterTradeInvoices(invoices, "buy", "", "#۱۷۰۴").length, 1);
  assert.equal(
    filterTradeInvoices(invoices, "buy", "supplier", "كريمي").length,
    1,
  );
  assert.equal(filterTradeInvoices(invoices, "buy", "other").length, 1);
  assert.deepEqual(invoices, original);
});

test("invoice search can find per-line product descriptions", () => {
  const invoice = makeInvoice({
    items: [{ ...item, description: "موتر شماره ۱۲۳" }],
  });
  assert.equal(filterTradeInvoices([invoice], "buy", "", "123").length, 1);
});

test("list totals separate all currencies including older EUR records", () => {
  const totals = aggregateTradeInvoices([
    makeInvoice(),
    makeInvoice({
      currency: "AFN",
      totalAmount: 650,
      paidAmount: 0,
      balanceAmount: 650,
    }),
    makeInvoice({
      currency: "EUR",
      totalAmount: 10,
      paidAmount: 5,
      balanceAmount: 5,
    }),
  ]);
  assert.deepEqual(totals.USD, { total: 200, paid: 100, balance: 100 });
  assert.deepEqual(totals.AFN, { total: 650, paid: 0, balance: 650 });
  assert.deepEqual(totals.EUR, { total: 10, paid: 5, balance: 5 });
  const unusualCode = aggregateTradeInvoices([
    makeInvoice({ currency: "__proto__" }),
  ]);
  assert.deepEqual(unusualCode["__proto__"], {
    total: 200,
    paid: 100,
    balance: 100,
  });
  assert.equal(Object.getPrototypeOf(unusualCode), Object.prototype);
});

test("empty list totals are real zeroes, not screenshot figures", () => {
  assert.deepEqual(aggregateTradeInvoices([]), {
    AFN: { total: 0, paid: 0, balance: 0 },
    USD: { total: 0, paid: 0, balance: 0 },
  });
});

test("quantity summary does not add tons to bags", () => {
  assert.deepEqual(tradeItemSummary([item]), {
    name: item.productName,
    quantity: 2,
    unit: "ton",
  });
  assert.equal(tradeItemSummary([item, { ...item, quantity: 3 }]).quantity, 5);
  assert.equal(
    tradeItemSummary([item, { ...item, unit: "bag" }]).quantity,
    null,
  );
});

test("Gregorian preview validates dates instead of showing today for an invalid input", () => {
  assert.equal(tradeGregorianEquivalent("۱۴۰۵/۰۷/۲۳"), "2026-10-15");
  assert.equal(tradeGregorianEquivalent("2026-10-15"), "2026-10-15");
  assert.equal(tradeGregorianEquivalent("1405/13/01"), "—");
  assert.equal(tradeGregorianEquivalent("not a date"), "—");
});

test("valid draft passes before a posting function is called", () => {
  assert.equal(validateTradeDraft(draft), null);
});

test("missing party, warehouse, product or an invalid date is rejected", () => {
  assert.ok(validateTradeDraft({ ...draft, partyId: "" }));
  assert.ok(validateTradeDraft({ ...draft, warehouseId: "" }));
  assert.ok(validateTradeDraft({ ...draft, rows: [] }));
  assert.ok(validateTradeDraft({ ...draft, date: "1405/13/01" }));
});

test("unfinished extra row cannot silently disappear from the submitted invoice", () => {
  assert.ok(
    validateTradeDraft({
      ...draft,
      rows: [row, { ...row, id: "unfinished", productId: "", quantity: "2" }],
    }),
  );
});

test("invalid quantity / price / discount / shipping / exchange rate is rejected", () => {
  for (const change of [
    { quantity: "0" },
    { quantity: "-2" },
    { unitPrice: "" },
    { unitPrice: "-1" },
    { unit: "" as const },
  ])
    assert.ok(validateTradeDraft({ ...draft, rows: [{ ...row, ...change }] }));
  for (const change of [
    { discount: 201 },
    { discount: -1 },
    { shipping: -1 },
    { exchangeRate: 0 },
  ])
    assert.ok(validateTradeDraft({ ...draft, ...change }));
});

test("overpayment / invalid partial amounts / missing or mismatched cash currency is rejected", () => {
  for (const change of [
    { paid: 201 },
    { paid: -1 },
    { paid: 0 },
    { paid: 200 },
    { cashAccountId: "" },
    { cashCurrency: "AFN" },
  ])
    assert.ok(validateTradeDraft({ ...draft, ...change }));
  assert.equal(
    validateTradeDraft({
      ...draft,
      paymentType: "نسیه",
      paid: 0,
      cashAccountId: "",
      cashCurrency: undefined,
    }),
    null,
  );
});

test("unsupported new invoice currency cannot accidentally post into the USD party ledger", () => {
  assert.ok(
    validateTradeDraft({ ...draft, currency: "EUR", cashCurrency: "EUR" }),
  );
});

test("expense rows require a payee, description, positive amount and a valid foreign conversion rate", () => {
  const expense: TradeDraftExpense = {
    id: "e",
    partyName: "راننده",
    title: "کرایه",
    currency: "AFN",
    amount: "650",
    exchangeRateToInvoice: 1 / 65,
  };
  assert.equal(validateTradeDraft({ ...draft, expenses: [expense] }), null);
  for (const change of [
    { partyName: "" },
    { title: "" },
    { amount: "0" },
    { exchangeRateToInvoice: undefined },
    { exchangeRateToInvoice: -1 },
  ])
    assert.ok(
      validateTradeDraft({ ...draft, expenses: [{ ...expense, ...change }] }),
    );
});

test("stored base currency makes historical rates unambiguous; older AFN-quoted USD rates need explicit review", () => {
  assert.equal(
    initialTradeExchangeRate(
      currencies,
      makeInvoice({ exchangeRate: 65 }),
      "USD",
    ),
    1,
  );
  assert.equal(
    initialTradeExchangeRate(
      currencies,
      makeInvoice({
        currency: "AFN",
        exchangeRate: 0.02,
        exchangeRateBaseCurrency: "USD",
      }),
      "AFN",
    ),
    0.02,
  );
  assert.equal(
    initialTradeExchangeRate(
      currencies,
      makeInvoice({ currency: "AFN", exchangeRate: 1 }),
      "AFN",
    ),
    1 / 65,
  );
});

test("editing a Gregorian date in the Shamsi form preserves the actual day", () => {
  assert.equal(tradeShamsiDate("2026/10/15"), "1405/07/23");
  assert.equal(tradeShamsiDate("۱۴۰۵/۷/۲۳"), "1405/07/23");
  assert.equal(tradeShamsiDate("not a date"), "not a date");
});

import type {
  CurrencyDefinition,
  Invoice,
  InvoiceItem,
  InvoiceType,
  Product,
  Unit,
} from "../types";
import {
  getRecentInvoices,
  normalizeDashboardSearch,
  parseDashboardDate,
} from "./dashboard";

export type TradeType = "buy" | "sell";
export type TradePaymentType = "نقدی" | "نسیه" | "نیمه نسیه";
export interface TradeDraftRow {
  id: string;
  productId: string;
  unit: Unit | "";
  quantity: string;
  unitPrice: string;
  description: string;
  warehouseId?: string;
  buyPrice?: number;
}
export interface TradeDraftExpense {
  id: string;
  partyId?: string;
  partyName: string;
  title: string;
  currency: string;
  amount: string;
  /** Historical conversion to this invoice's currency, not an AFN amount. */
  exchangeRateToInvoice?: number;
}

export const roundTradeAmount = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;

export const parseTradeNumber = (value: string | number): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const normalized = normalizeDashboardSearch(value)
    .replace(/[٬,]/g, "")
    .replace(/٫/g, ".");
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
    return NaN;
  return Number(normalized);
};

/** Pure numbering avoids reserving a number on every StrictMode render / tab visit. */
export const nextTradeInvoiceNumber = (
  invoices: Invoice[],
  type: InvoiceType,
): string => {
  let max = 0;
  for (const invoice of invoices) {
    if (invoice.type !== type) continue;
    const match = normalizeDashboardSearch(String(invoice.invoiceNumber)).match(
      /(\d+)$/,
    );
    if (match && Number.isSafeInteger(Number(match[1])))
      max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
};

export const normalizeTradeInvoiceNumber = (value: string): string =>
  value
    .trim()
    .replace(/^#/, "")
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export const tradeGregorianEquivalent = (value: string): string =>
  parseDashboardDate(value)?.toISOString().slice(0, 10) || "—";

export const duplicateTradeNumber = (
  invoices: Invoice[],
  type: InvoiceType,
  number: string,
  excludingId?: string,
): boolean => {
  const canonical = (value: string) =>
    normalizeDashboardSearch(normalizeTradeInvoiceNumber(value))
      .replace(/^(?:inv|pur|srt|prt)[-_]?(?=\d+$)/, "")
      .replace(/^0+(?=\d)/, "");
  const key = canonical(number);
  return invoices.some(
    (invoice) =>
      invoice.id !== excludingId &&
      invoice.type === type &&
      canonical(invoice.invoiceNumber) === key,
  );
};

export const currencyRateToBase = (
  currencies: CurrencyDefinition[],
  code: string,
): number => {
  const base =
    currencies.find((currency) => currency.isBase) ||
    currencies.find((currency) => currency.code === "AFN");
  const source = currencies.find((currency) => currency.code === code);
  if (code === base?.code) return 1;
  const sourceRate = code === "AFN" ? 1 : source?.exchangeRateToAFN;
  const baseRate = base?.exchangeRateToAFN || 1;
  return sourceRate && sourceRate > 0 && baseRate > 0
    ? sourceRate / baseRate
    : NaN;
};

export const initialTradeExchangeRate = (
  currencies: CurrencyDefinition[],
  invoice: Invoice | undefined,
  code: string,
): number => {
  const base = currencies.find((currency) => currency.isBase)?.code || "AFN";
  if (code === base) return 1;
  if (
    invoice?.exchangeRateBaseCurrency === base &&
    invoice.exchangeRate &&
    invoice.exchangeRate > 0
  )
    return invoice.exchangeRate;
  return currencyRateToBase(currencies, code);
};

export const tradeShamsiDate = (value: string): string => {
  const parsed = parseDashboardDate(value);
  if (!parsed) return value;
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join("/");
};

export const expenseRateToInvoice = (
  currencies: CurrencyDefinition[],
  expenseCurrency: string,
  invoiceCurrency: string,
  invoiceRate: number,
): number => {
  if (expenseCurrency === invoiceCurrency) return 1;
  const sourceRate = currencyRateToBase(currencies, expenseCurrency);
  return invoiceRate > 0 ? sourceRate / invoiceRate : NaN;
};

export const tradeUnitPrice = (
  product: Product,
  unit: Unit,
  currency: string,
  type: TradeType,
): number => {
  const tonPrice =
    type === "buy"
      ? currency === "USD"
        ? product.buyPriceUSD
        : product.buyPriceAFN
      : currency === "USD"
        ? product.sellPriceUSD
        : product.sellPriceAFN;
  const factor = unit === "bag" ? product.bagWeightKg / 1000 : 1;
  return roundTradeAmount((tonPrice || 0) * factor);
};

export const calculateTradeTotals = (
  rows: TradeDraftRow[],
  discount: number,
  shipping: number,
  expenses: TradeDraftExpense[],
  currency: string,
) => {
  const subtotal = roundTradeAmount(
    rows.reduce((sum, row) => {
      const quantity = parseTradeNumber(row.quantity);
      const price = parseTradeNumber(row.unitPrice);
      return (
        sum +
        (row.productId && Number.isFinite(quantity) && Number.isFinite(price)
          ? roundTradeAmount(quantity * price)
          : 0)
      );
    }, 0),
  );
  const expensesTotal = roundTradeAmount(
    expenses.reduce((sum, expense) => {
      const amount = parseTradeNumber(expense.amount);
      const rate =
        expense.currency === currency ? 1 : expense.exchangeRateToInvoice;
      return (
        sum +
        (Number.isFinite(amount) && Number.isFinite(rate)
          ? roundTradeAmount(amount * rate!)
          : 0)
      );
    }, 0),
  );
  const total = roundTradeAmount(
    subtotal - discount + shipping + expensesTotal,
  );
  return { subtotal, expensesTotal, total };
};

export const tradePaymentAmounts = (
  total: number,
  method: TradePaymentType,
  manualPaid: number | null = null,
) => {
  const paid = method === "نقدی" ? total : method === "نسیه" ? 0 : manualPaid ?? roundTradeAmount(total / 2);
  const balance = roundTradeAmount(total - paid);
  return {
    paid,
    balance,
    status:
      balance <= 0
        ? ("paid" as const)
        : paid > 0
          ? ("partial" as const)
          : ("unpaid" as const),
  };
};

export const normalizeTradePaymentType = (
  invoice: Invoice,
): TradePaymentType => {
  if (["نقدی", "cash"].includes(invoice.paymentType || "")) return "نقدی";
  if (["نسیه", "credit"].includes(invoice.paymentType || "")) return "نسیه";
  if (["نیمه نسیه", "hybrid"].includes(invoice.paymentType || ""))
    return "نیمه نسیه";
  return invoice.paidAmount >= invoice.totalAmount
    ? "نقدی"
    : invoice.paidAmount > 0
      ? "نیمه نسیه"
      : "نسیه";
};

export const filterTradeInvoices = (
  invoices: Invoice[],
  type: InvoiceType,
  partyId = "",
  query = "",
): Invoice[] => {
  const search = normalizeDashboardSearch(query).replace(/^#/, "");
  return getRecentInvoices(
    invoices.filter((invoice) => {
      if (invoice.type !== type || (partyId && invoice.partyId !== partyId))
        return false;
      if (!search) return true;
      return [
        invoice.invoiceNumber,
        invoice.partyName,
        invoice.partyPhone,
        invoice.notes,
        invoice.date,
        ...invoice.items.flatMap((item) => [
          item.productName,
          item.description,
        ]),
      ].some((value) => normalizeDashboardSearch(value || "").includes(search));
    }),
    invoices.length,
  );
};

export const aggregateTradeInvoices = (invoices: Invoice[]) => {
  const amounts = new Map<
    string,
    { total: number; paid: number; balance: number }
  >([
    ["AFN", { total: 0, paid: 0, balance: 0 }],
    ["USD", { total: 0, paid: 0, balance: 0 }],
  ]);
  for (const invoice of invoices) {
    const entry = amounts.get(invoice.currency) || {
      total: 0,
      paid: 0,
      balance: 0,
    };
    amounts.set(invoice.currency, entry);
    entry.total = roundTradeAmount(
      entry.total +
        (Number.isFinite(invoice.totalAmount) ? invoice.totalAmount : 0),
    );
    entry.paid = roundTradeAmount(
      entry.paid +
        (Number.isFinite(invoice.paidAmount) ? invoice.paidAmount : 0),
    );
    entry.balance = roundTradeAmount(
      entry.balance +
        (Number.isFinite(invoice.balanceAmount) ? invoice.balanceAmount : 0),
    );
  }
  return Object.fromEntries(amounts);
};

export const tradeItemSummary = (items: InvoiceItem[]) => {
  if (!items.length) return { name: "—", quantity: null, unit: "" };
  const sameUnit = items.every((item) => item.unit === items[0].unit);
  return {
    name:
      items.length === 1
        ? items[0].productName
        : `اقلام متعدد (${items.length} قلم)`,
    quantity: sameUnit
      ? roundTradeAmount(items.reduce((sum, item) => sum + item.quantity, 0))
      : null,
    unit: sameUnit ? items[0].unit : "",
  };
};

export interface TradeDraftValidation {
  partyId: string;
  warehouseId: string;
  number: string;
  date: string;
  currency: string;
  exchangeRate: number;
  rows: TradeDraftRow[];
  expenses: TradeDraftExpense[];
  discount: number;
  subtotal: number;
  shipping: number;
  total: number;
  paid: number;
  paymentType: TradePaymentType;
  cashAccountId: string;
  cashCurrency?: string;
}

/** All checks run before any context posting function is called. */
export const validateTradeDraft = (
  draft: TradeDraftValidation,
): string | null => {
  if (!draft.partyId) return "طرف حساب را از نتایج جستجو انتخاب کنید.";
  if (!parseDashboardDate(draft.date))
    return "تاریخ معتبر فاکتور را انتخاب کنید.";
  if (!draft.number.trim()) return "شمارهٔ فاکتور را وارد کنید.";
  if (!draft.warehouseId) return "گدام / انبار را انتخاب کنید.";
  // The current context's party balances only have AFN and USD ledgers.
  if (!["AFN", "USD"].includes(draft.currency))
    return "حساب‌های این نسخه از فاکتور افغانی و دالری پشتیبانی می‌کنند.";
  if (!Number.isFinite(draft.exchangeRate) || draft.exchangeRate <= 0)
    return "نرخ تسعیر باید عددی بزرگ‌تر از صفر باشد.";
  if (!draft.rows.some((row) => row.productId))
    return "حداقل یک کالا را از نتایج جستجو انتخاب کنید.";
  for (const row of draft.rows) {
    if (!row.productId) {
      if (
        row.description.trim() ||
        row.unit ||
        parseTradeNumber(row.quantity) !== 1 ||
        (row.unitPrice && parseTradeNumber(row.unitPrice) !== 0)
      )
        return "کالای ردیف ناقص را انتخاب کنید یا ردیف را حذف نمایید.";
      continue;
    }
    if (
      !row.unit ||
      !Number.isFinite(parseTradeNumber(row.quantity)) ||
      parseTradeNumber(row.quantity) <= 0
    )
      return "واحد و تعداد مثبت را برای تمام کالاها وارد کنید.";
    if (
      !Number.isFinite(parseTradeNumber(row.unitPrice)) ||
      parseTradeNumber(row.unitPrice) < 0
    )
      return "قیمت کالا نمی‌تواند خالی یا منفی باشد.";
  }
  if (
    !Number.isFinite(draft.discount) ||
    draft.discount < 0 ||
    draft.discount > draft.subtotal
  )
    return "تخفیف باید بین صفر و جمع اقلام باشد.";
  if (!Number.isFinite(draft.shipping) || draft.shipping < 0)
    return "کرایه باید عددی صفر یا مثبت باشد.";
  for (const expense of draft.expenses) {
    if (!expense.partyName.trim() || !expense.title.trim())
      return "طرف حساب و شرح تمام هزینه‌های جانبی را وارد کنید.";
    if (
      !Number.isFinite(parseTradeNumber(expense.amount)) ||
      parseTradeNumber(expense.amount) <= 0
    )
      return "مبلغ هر هزینهٔ جانبی باید بزرگ‌تر از صفر باشد.";
    if (
      expense.currency !== draft.currency &&
      (!Number.isFinite(expense.exchangeRateToInvoice) ||
        expense.exchangeRateToInvoice! <= 0)
    )
      return "نرخ تبدیل معتبر برای ارز هزینهٔ جانبی تعریف نشده است.";
  }
  if (!Number.isFinite(draft.total) || draft.total < 0)
    return "مبلغ نهایی فاکتور معتبر نیست.";
  if (
    !Number.isFinite(draft.paid) ||
    draft.paid < 0 ||
    draft.paid > draft.total
  )
    return "مبلغ پرداختی باید بین صفر و مبلغ نهایی باشد.";
  if (
    draft.paymentType === "نیمه نسیه" &&
    (draft.paid <= 0 || draft.paid >= draft.total)
  )
    return "در پرداخت نیمه نسیه، بخشی از مبلغ را وارد کنید؛ برای صفر یا تمام مبلغ، نوع پرداخت را تغییر دهید.";
  if (draft.paid > 0 && !draft.cashAccountId)
    return "صندوق پرداخت / دریافت را انتخاب کنید.";
  if (draft.paid > 0 && draft.cashCurrency !== draft.currency)
    return "ارز صندوق باید با ارز فاکتور یکسان باشد.";
  return null;
};

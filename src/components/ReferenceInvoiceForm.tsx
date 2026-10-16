import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  Coins,
  DollarSign,
  FileText,
  Plus,
  Printer,
  Save,
  Ticket,
  Trash2,
  User,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import { useAccounting } from "../context/AccountingContext";
import type { Invoice, InvoiceItem, Unit } from "../types";
import { formatDashboardAmount } from "../utils/dashboard";
import { createTradeEntityId } from "../utils/invoiceLedger";
import { normalizePersianDate } from "../utils/formatters";
import {
  calculateTradeTotals,
  initialTradeExchangeRate,
  tradeShamsiDate,
  duplicateTradeNumber,
  nextTradeInvoiceNumber,
  normalizeTradeInvoiceNumber,
  normalizeTradePaymentType,
  parseTradeNumber,
  roundTradeAmount,
  tradePaymentAmounts,
  tradeUnitPrice,
  tradeGregorianEquivalent,
  validateTradeDraft,
  type TradeDraftExpense,
  type TradeDraftRow,
  type TradePaymentType,
  type TradeType,
} from "../utils/tradeInvoices";
import {
  documentConversionRate,
  documentRateToBase,
  initialInvoiceUsdAfnQuote,
  preferredCashAccountId,
} from "../utils/documentDefaults";
import { QuickAddPartyModal } from "./QuickAddPartyModal";
import { ShamsiDatePickerModal } from "./ShamsiDatePickerModal";
import { TradeLookupInput } from "./TradeLookupInput";
import { getTelegramSettings } from "../services/telegramBotService";
import {
  buildInvoiceTelegramText,
  sendTelegramDirectMessage,
} from "../services/telegramApiService";

const newRow = (): TradeDraftRow => ({
  id: createTradeEntityId("row"),
  productId: "",
  unit: "",
  quantity: "1",
  unitPrice: "0",
  description: "",
});
const today = () => {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join("/");
};

const FieldLabel: React.FC<{
  htmlFor?: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ htmlFor, required, icon, children }) => (
  <label className="trade-field-label" htmlFor={htmlFor}>
    {icon}
    {children}
    {required && <span className="trade-required">*</span>}
  </label>
);

interface MoneyInputProps {
  id: string;
  currency: string;
  value: string | number;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  tone?: string;
  label?: string;
}
const MoneyInput: React.FC<MoneyInputProps> = ({
  id,
  currency,
  value,
  onChange,
  readOnly = false,
  tone = "",
  label,
}) => (
  <div className={`trade-money-input ${tone} ${readOnly ? "is-readonly" : ""}`}>
    <span>{currency}</span>
    <input
      id={id}
      aria-label={label}
      type="number"
      step="any"
      min="0"
      dir="ltr"
      value={Number.isNaN(value) ? "" : value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  </div>
);

interface ReferenceInvoiceFormProps {
  type: TradeType;
  invoice?: Invoice;
  onSaved: (invoice: Invoice) => void;
  onCancelEdit: () => void;
}

export const ReferenceInvoiceForm: React.FC<ReferenceInvoiceFormProps> = ({
  type,
  invoice,
  onSaved,
  onCancelEdit,
}) => {
  const {
    parties,
    products,
    warehouses,
    invoices,
    currencies,
    cashAccounts,
    cashRegister,
    createInvoice,
    updateInvoice,
    openPrintModal,
    getProductStock,
    companySettings,
    notify,
  } = useAccounting();
  const isBuy = type === "buy";
  const word = isBuy ? "خرید" : "فروش";
  const supportedCurrencies = currencies.filter(
    (currency) => currency.code === "USD" || currency.code === "AFN",
  );
  const defaultCurrency =
    supportedCurrencies.find((currency) => currency.code === "USD")?.code ||
    "AFN";
  const [partyId, setPartyId] = useState(invoice?.partyId || "");
  const [date, setDate] = useState(
    invoice?.date ? tradeShamsiDate(invoice.date) : today(),
  );
  const [number, setNumber] = useState(
    invoice?.invoiceNumber || nextTradeInvoiceNumber(invoices, type),
  );
  const [warehouseId, setWarehouseId] = useState(
    invoice?.warehouseId ||
      warehouses.find((warehouse) => warehouse.type === "standard")?.id ||
      warehouses[0]?.id ||
      "",
  );
  const [dealType, setDealType] = useState(
    invoice?.dealTypeLabel ||
      invoice?.dealType ||
      (isBuy ? "خرید قطعی (عادی)" : "فروش قطعی (عادی)"),
  );
  const [consignmentWarehouseId, setConsignmentWarehouseId] = useState(
    invoice?.consignmentWarehouseId || "",
  );
  const [currency, setCurrency] = useState(
    invoice?.currency || defaultCurrency,
  );
  const initialRate = initialTradeExchangeRate(
    currencies,
    invoice,
    invoice?.currency || defaultCurrency,
  );
  const initialUsdQuote = initialInvoiceUsdAfnQuote(currencies, invoice, cashRegister.usdToAfnRate);
  const [usdQuote, setUsdQuote] = useState(Number.isFinite(initialUsdQuote) ? String(initialUsdQuote) : "");
  // Mathematical base-currency rates remain internal; the form shows AFN per USD.
  const exchangeRate = documentRateToBase(currencies, currency, parseTradeNumber(usdQuote));
  const requiresRateReview =
    !!invoice &&
    ((invoice.extraExpenses || []).some(
      (expense) =>
        expense.currency !== invoice.currency && !expense.exchangeRateToInvoice,
    ) ||
      (!!invoice.exchangeRate &&
        invoice.exchangeRateBaseCurrency !==
          (currencies.find((currency) => currency.isBase)?.code || "AFN") &&
        (invoice.exchangeRate !== initialRate ||
          !!invoice.exchangeRateBaseCurrency)));
  const [rateReviewed, setRateReviewed] = useState(false);
  const [rows, setRows] = useState<TradeDraftRow[]>(() =>
    invoice?.items.length
      ? invoice.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          unit: item.unit,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          description: item.description || "",
          warehouseId: item.warehouseId,
          buyPrice: item.buyPrice,
        }))
      : [newRow()],
  );
  const [expenses, setExpenses] = useState<TradeDraftExpense[]>(() =>
    (invoice?.extraExpenses || []).map((expense) => ({
      ...expense,
      amount: String(expense.amount),
      exchangeRateToInvoice:
        expense.exchangeRateToInvoice ??
        documentConversionRate(
          currencies,
          expense.currency,
          invoice?.currency || defaultCurrency,
          initialUsdQuote,
        ),
    })),
  );
  const [tax, setTax] = useState(String(invoice?.tax || 0));
  const lastPositiveRate = useRef(initialUsdQuote);
  const [discount, setDiscount] = useState(String(invoice?.discount || 0));
  const [shipping, setShipping] = useState(String(invoice?.shippingCost || 0));
  const [method, setMethod] = useState<TradePaymentType>(
    invoice ? normalizeTradePaymentType(invoice) : "نقدی",
  );
  // null means automatic half-payment; an explicit edit remains the user's amount.
  const [manualPaid, setManualPaid] = useState<string | null>(
    invoice ? String(invoice.paidAmount) : null,
  );
  const [cashId, setCashId] = useState(
    invoice?.cashRegisterId || invoice?.cashRegister || preferredCashAccountId(cashAccounts, invoice?.currency || defaultCurrency),
  );
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [quickPartyTarget, setQuickPartyTarget] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const totals = calculateTradeTotals(
    rows,
    parseTradeNumber(discount),
    isBuy ? 0 : parseTradeNumber(shipping),
    isBuy ? expenses : [],
    currency,
  );
  const finalTotal = roundTradeAmount(totals.total + parseTradeNumber(tax));
  const payments = tradePaymentAmounts(
    finalTotal,
    method,
    manualPaid === null ? null : parseTradeNumber(manualPaid),
  );
  const baseCurrency =
    currencies.find((definition) => definition.isBase)?.code || "AFN";
  const baseEquivalent = finalTotal * parseTradeNumber(exchangeRate);
  const consignmentWarehouses = warehouses.filter(
    (warehouse) => warehouse.type !== "standard",
  );
  const isConsignment = /امانی|consignment/i.test(dealType);
  const partyOptions = useMemo(
    () =>
      parties.map((party) => ({
        id: party.id,
        label: party.name,
        description: [party.code, party.phone].filter(Boolean).join(" · "),
        keywords: party.company,
      })),
    [parties],
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        label: product.name,
        description: product.code,
        keywords: String(product.numericCode || ""),
      })),
    [products],
  );
  const matchingCashAccounts = cashAccounts.filter(
    (account) => account.currency === currency,
  );
  const dealTypes = isBuy
    ? ["خرید قطعی (عادی)", "خرید امانی (نزد ما)", "پیش خرید (تحویل بعداً)"]
    : [
        "فروش قطعی (عادی)",
        "ارسال امانی یعنی به گدام امانی سپرده میشود",
        "پیش فروش تحویل بعدا",
      ];
  const estimatedProfit = rows.reduce((sum, row) => {
    const product = products.find((product) => product.id === row.productId);
    if (!product || !row.unit) return sum;
    const cost =
      row.buyPrice ?? tradeUnitPrice(product, row.unit, currency, "buy");
    return (
      sum +
      ((parseTradeNumber(row.unitPrice) || 0) - cost) *
        (parseTradeNumber(row.quantity) || 0)
    );
  }, 0);

  const patchRow = (id: string, changes: Partial<TradeDraftRow>) =>
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  const selectProduct = (row: TradeDraftRow, id: string) => {
    const product = products.find((product) => product.id === id);
    if (!product) {
      patchRow(row.id, {
        productId: "",
        unit: "",
        unitPrice: "0",
        buyPrice: undefined,
      });
      return;
    }
    const unit: Unit = /کیسه|بوجی|bag/i.test(product.baseUnit || "")
      ? "bag"
      : "ton";
    patchRow(row.id, {
      productId: id,
      unit,
      unitPrice: String(tradeUnitPrice(product, unit, currency, type)),
      buyPrice: tradeUnitPrice(product, unit, currency, "buy"),
    });
  };
  const changeUnit = (row: TradeDraftRow, unit: Unit | "") => {
    const product = products.find((product) => product.id === row.productId);
    if (!product || !unit) {
      patchRow(row.id, { unit });
      return;
    }
    const factor =
      row.unit && row.unit !== unit
        ? unit === "bag"
          ? product.bagWeightKg / 1000
          : 1000 / product.bagWeightKg
        : 1;
    patchRow(row.id, {
      unit,
      unitPrice: String(
        roundTradeAmount((parseTradeNumber(row.unitPrice) || 0) * factor),
      ),
      buyPrice: roundTradeAmount(
        (row.buyPrice ??
          tradeUnitPrice(product, row.unit || unit, currency, "buy")) * factor,
      ),
    });
  };
  const patchExpense = (id: string, changes: Partial<TradeDraftExpense>) =>
    setExpenses((previous) =>
      previous.map((expense) =>
        expense.id === id ? { ...expense, ...changes } : expense,
      ),
    );
  const changeCurrency = (nextCurrency: string) => {
    if (nextCurrency === currency) return;
    const factor = documentConversionRate(currencies, currency, nextCurrency, parseTradeNumber(usdQuote));
    if (!Number.isFinite(factor) || factor <= 0) {
      setError("ابتدا نرخ تسعیر معتبر را وارد یا در تعاریف اسعار تنظیم کنید.");
      return;
    }
    const convert = (value: string) =>
      value === ""
        ? ""
        : String(roundTradeAmount(parseTradeNumber(value) * factor));
    setRows((previous) =>
      previous.map((row) => ({
        ...row,
        unitPrice: convert(row.unitPrice),
        buyPrice:
          row.buyPrice === undefined
            ? undefined
            : roundTradeAmount(row.buyPrice * factor),
      })),
    );
    setDiscount(convert(discount));
    setShipping(convert(shipping));
    setManualPaid(manualPaid === null ? null : convert(manualPaid));
    setTax(convert(tax));
    setExpenses((previous) =>
      previous.map((expense) => ({
        ...expense,
        exchangeRateToInvoice:
          expense.currency === nextCurrency
            ? 1
            : (expense.exchangeRateToInvoice || 1) * factor,
      })),
    );
    setCurrency(nextCurrency);
    setCashId(preferredCashAccountId(cashAccounts, nextCurrency));
    setError("");
  };
  const changeExchangeRate = (value: string) => {
    const next = parseTradeNumber(value);
    const old = lastPositiveRate.current;
    if (Number.isFinite(next) && next > 0) {
      setExpenses((previous) => previous.map((expense) => {
        const nextRate = documentConversionRate(currencies, expense.currency, currency, next);
        const oldRate = documentConversionRate(currencies, expense.currency, currency, old);
        return {
          ...expense,
          exchangeRateToInvoice: expense.currency === currency ? 1
            : Number.isFinite(expense.exchangeRateToInvoice) && expense.exchangeRateToInvoice! > 0 && oldRate > 0
              ? expense.exchangeRateToInvoice! * nextRate / oldRate : nextRate,
        };
      }));
      lastPositiveRate.current = next;
    }
    setUsdQuote(value);
  };
  const changePaymentType = (next: TradePaymentType) => {
    setMethod(next);
    setManualPaid(null);
  };

  const save = (print: boolean) => {
    if (submittingRef.current) return;
    setError("");
    const selectedParty = parties.find((party) => party.id === partyId);
    const selectedCash = cashAccounts.find((account) => account.id === cashId);
    const problem = validateTradeDraft({
      partyId: selectedParty?.id || "",
      warehouseId: warehouses.some((warehouse) => warehouse.id === warehouseId)
        ? warehouseId
        : "",
      number,
      date,
      currency,
      exchangeRate: parseTradeNumber(exchangeRate),
      rows,
      expenses: isBuy ? expenses : [],
      subtotal: totals.subtotal,
      discount: parseTradeNumber(discount),
      shipping: isBuy ? 0 : parseTradeNumber(shipping),
      total: finalTotal,
      paid: payments.paid,
      paymentType: method,
      cashAccountId: selectedCash?.id || "",
      cashCurrency: selectedCash?.currency,
    });
    if (problem) {
      setError(problem);
      return;
    }
    if (requiresRateReview && !rateReviewed) {
      setError(
        "پیش از ذخیره، نرخ تبدیل فاکتور قدیمی و هزینه‌های آن را بازبینی و تأیید کنید.",
      );
      return;
    }
    if (duplicateTradeNumber(invoices, type, number, invoice?.id)) {
      setError(
        "شمارهٔ فاکتور تکراری است؛ ثبت جدید، فاکتور قبلی را بازنویسی نمی‌کند.",
      );
      return;
    }
    if (invoice && !invoices.some((current) => current.id === invoice.id)) {
      setError("این فاکتور دیگر موجود نیست. به لیست برگردید.");
      return;
    }
    if (
      isConsignment &&
      !consignmentWarehouses.some(
        (warehouse) => warehouse.id === consignmentWarehouseId,
      )
    ) {
      setError("گدام امانی را انتخاب کنید.");
      return;
    }
    if (
      rows.some(
        (row) =>
          row.productId &&
          !products.some(
            (product) =>
              product.id === row.productId && product.bagWeightKg > 0,
          ),
      )
    ) {
      setError("کالا یا وزن کیسهٔ آن معتبر نیست؛ تعریف کالا را بررسی کنید.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const items: InvoiceItem[] = rows
        .filter((row) => row.productId)
        .map((row) => {
          const product = products.find(
            (product) => product.id === row.productId,
          )!;
          const quantity = parseTradeNumber(row.quantity);
          const unitPrice = parseTradeNumber(row.unitPrice);
          const rowWarehouseId = row.warehouseId || warehouseId;
          return {
            id: row.id,
            productId: product.id,
            productName: product.name,
            warehouseId: rowWarehouseId,
            warehouseName: warehouses.find(
              (warehouse) => warehouse.id === rowWarehouseId,
            )?.name,
            description: row.description.trim() || undefined,
            unit: row.unit as Unit,
            quantity,
            unitPrice,
            currency,
            bagsCount: roundTradeAmount(
              row.unit === "bag"
                ? quantity
                : (quantity * 1000) / product.bagWeightKg,
            ),
            tonsCount: roundTradeAmount(
              row.unit === "ton"
                ? quantity
                : (quantity * product.bagWeightKg) / 1000,
            ),
            buyPrice:
              row.buyPrice ??
              tradeUnitPrice(product, row.unit as Unit, currency, "buy"),
            totalPrice: roundTradeAmount(quantity * unitPrice),
          };
        });
      const data: Omit<Invoice, "id" | "createdAt"> = {
        ...invoice,
        type,
        invoiceNumber: normalizeTradeInvoiceNumber(number),
        date: tradeShamsiDate(date),
        partyId,
        partyName: selectedParty!.name,
        partyPhone: selectedParty!.phone,
        partyAddress: selectedParty!.address,
        partyGroupName: selectedParty!.groupName,
        warehouseId,
        currency,
        items,
        subtotal: totals.subtotal,
        subtotalAmount: totals.subtotal,
        discount: parseTradeNumber(discount),
        totalAmount: finalTotal,
        finalAmount: finalTotal,
        paidAmount: payments.paid,
        balanceAmount: payments.balance,
        paymentStatus: payments.status,
        tax: invoice?.tax !== undefined ? parseTradeNumber(tax) : undefined,
        dealType,
        dealTypeLabel: dealType,
        exchangeRate: parseTradeNumber(exchangeRate),
        exchangeRateBaseCurrency: baseCurrency,
        usdToAfnRate: parseTradeNumber(usdQuote),
        paymentType: method,
        cashRegister: payments.paid > 0 ? cashId : undefined,
        cashRegisterId: payments.paid > 0 ? cashId : undefined,
        shippingCost: isBuy ? undefined : parseTradeNumber(shipping),
        extraExpenses: isBuy
          ? expenses.map((expense) => ({
              ...expense,
              amount: parseTradeNumber(expense.amount),
              exchangeRateToInvoice:
                expense.currency === currency
                  ? 1
                  : expense.exchangeRateToInvoice,
              amountInInvoiceCurrency: roundTradeAmount(
                parseTradeNumber(expense.amount) *
                  (expense.currency === currency
                    ? 1
                    : expense.exchangeRateToInvoice!),
              ),
            }))
          : undefined,
        extraExpensesTotal: isBuy ? totals.expensesTotal : undefined,
        consignmentWarehouseId: isConsignment
          ? consignmentWarehouseId
          : undefined,
        consignmentWarehouseName: isConsignment
          ? warehouses.find(
              (warehouse) => warehouse.id === consignmentWarehouseId,
            )?.name
          : undefined,
        notes: notes.trim() || undefined,
      };
      const saved = invoice ? { ...invoice, ...data } : createInvoice(data);
      if (invoice) updateInvoice(saved);
      onSaved(saved);
      if (print) openPrintModal({ type: "invoice", invoice: saved });
      // Respect an already enabled integration; never make saving depend on a network send.
      try {
        if (!isBuy && !invoice) {
          const settings = getTelegramSettings();
          const chatId =
            selectedParty?.telegramChatId || settings.defaultChatId;
          if (settings.autoSendOnSave && chatId) {
            sendTelegramDirectMessage({
              chatId,
              partyId,
              partyName: saved.partyName,
              messageType: "invoice",
              title: `فاکتور #${saved.invoiceNumber}`,
              textContent: buildInvoiceTelegramText(
                saved,
                selectedParty!,
                companySettings,
              ),
            })
              .then((result) => {
                if (!result.success)
                  notify(
                    "warning",
                    "فاکتور ثبت شد",
                    "ارسال تلگرام انجام نشد؛ فاکتور را دوباره ثبت نکنید.",
                  );
              })
              .catch(() =>
                notify(
                  "warning",
                  "فاکتور ثبت شد",
                  "ارتباط تلگرام برقرار نشد؛ فاکتور در لیست محفوظ است.",
                ),
              );
          }
        }
      } catch {
        notify(
          "warning",
          "فاکتور ثبت شد",
          "تنظیمات ارسال تلگرام را بررسی کنید؛ ثبت مالی انجام شده است.",
        );
      }
    } catch (cause) {
      console.error(cause);
      setError("ثبت فاکتور انجام نشد؛ مقادیر را بررسی کنید.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const paymentFields = (
    <>
      <div className="trade-field">
        <FieldLabel htmlFor="trade-payment-type">نوع پرداخت</FieldLabel>
        <select
          id="trade-payment-type"
          value={method}
          onChange={(event) =>
            changePaymentType(event.target.value as TradePaymentType)
          }
        >
          <option>نقدی</option>
          <option>نسیه</option>
          <option>نیمه نسیه</option>
        </select>
      </div>
      <div className="trade-field">
        <FieldLabel
          htmlFor="trade-cash-account"
          required={payments.paid > 0}
          icon={<Wallet />}
        >
          {isBuy ? "پرداخت از صندوق مبدأ" : "واریز به صندوق مقصد"}
        </FieldLabel>
        <select
          id="trade-cash-account"
          value={cashId}
          disabled={method === "نسیه"}
          onChange={(event) => setCashId(event.target.value)}
        >
          <option value="">
            {isBuy ? "انتخاب صندوق مبدأ..." : "انتخاب صندوق مقصد..."}
          </option>
          {matchingCashAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>
      <div className="trade-field">
        <FieldLabel htmlFor="trade-paid-amount">
          {isBuy ? "مبلغ پرداختی" : "مبلغ دریافتی"}
        </FieldLabel>
        <MoneyInput
          id="trade-paid-amount"
          currency={isBuy ? currency : ""}
          value={method === "نیمه نسیه" && manualPaid !== null ? manualPaid : payments.paid}
          tone="is-paid"
          readOnly={method === "نسیه"}
          onChange={(value) => {
            setManualPaid(value);
            setMethod("نیمه نسیه");
          }}
        />
      </div>
      <div className="trade-field">
        <FieldLabel htmlFor="trade-balance-amount">
          {isBuy ? "باقی‌مانده بدهی" : "باقی‌مانده"}
        </FieldLabel>
        <MoneyInput
          id="trade-balance-amount"
          currency={currency}
          value={payments.balance}
          readOnly
          tone="is-balance"
        />
      </div>
    </>
  );
  const actions = (
    <div className="trade-form-actions">
      <button type="submit" className="trade-save-button" disabled={submitting}>
        <Save />
        {invoice ? "ذخیره تغییرات" : "ثبت فاکتور"}
      </button>
      <button
        type="button"
        className="trade-save-print-button"
        disabled={submitting}
        onClick={() => save(true)}
      >
        <Printer />
        {invoice ? "ذخیره و چاپ" : "ثبت و چاپ"}
      </button>
    </div>
  );

  return (
    <>
      <form
        className={`trade-invoice-form is-${type}`}
        aria-label={invoice ? `ویرایش فاکتور ${word}` : `ثبت فاکتور ${word}`}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
      >
        {invoice && (
          <div className="trade-edit-banner">
            <strong>ویرایش فاکتور #{invoice.invoiceNumber}</strong>
            <button type="button" onClick={onCancelEdit}>
              انصراف و بازگشت به لیست
            </button>
          </div>
        )}
        {requiresRateReview && (
          <div className="trade-rate-review" role="status">
            <p>
              نرخ پایه یا نرخ تاریخی هزینه‌های این فاکتور قدیمی مشخص نیست. مبالغ
              تبدیل‌شده با نرخ تعاریف فعلی نمایش داده می‌شوند؛ تا تأیید شما هیچ
              تغییر مالی ذخیره نمی‌شود.
            </p>
            <label>
              <input
                type="checkbox"
                checked={rateReviewed}
                onChange={(event) => setRateReviewed(event.target.checked)}
              />
              نرخ و مبلغ نهایی را بازبینی و تأیید کردم.
            </label>
          </div>
        )}
        {error && (
          <div className="trade-form-error" role="alert">
            <X />
            <span>{error}</span>
          </div>
        )}
        <div className="trade-form-heading-grid">
          <div className="trade-field">
            <FieldLabel htmlFor="trade-party" required icon={<User />}>
              طرف حساب ({isBuy ? "تأمین‌کننده کالا" : "مشتری"})
            </FieldLabel>
            <div className="trade-party-entry">
              <TradeLookupInput
                id="trade-party"
                value={partyId}
                onChange={setPartyId}
                options={partyOptions}
                placeholder="جستجو بر اساس نام یا کد..."
                label={isBuy ? "طرف حساب تأمین‌کننده" : "طرف حساب مشتری"}
                accent={type}
              />
              <button
                type="button"
                className="trade-add-party"
                title="افزودن طرف حساب جدید"
                aria-label="افزودن طرف حساب جدید"
                onClick={() => setQuickPartyTarget("main")}
              >
                <Plus />
              </button>
            </div>
          </div>
          <div className="trade-field">
            <FieldLabel htmlFor="trade-date" required icon={<CalendarDays />}>
              تاریخ {word} (شمسی)
            </FieldLabel>
            <div className="trade-date-entry">
              <input
                id="trade-date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                aria-label={`انتخاب تاریخ ${word}`}
                onClick={() => {
                  setDate(tradeShamsiDate(date));
                  setDatePickerOpen(true);
                }}
              >
                <CalendarDays />
              </button>
            </div>
            <small className="trade-gregorian-preview">
              <CheckCircle2 />
              معادل میلادی:{" "}
              <bdi>
                {tradeGregorianEquivalent(date) === "—"
                  ? "—"
                  : tradeGregorianEquivalent(date)
                      .split("-")
                      .reverse()
                      .join("-")}
              </bdi>
            </small>
          </div>
          <div className="trade-field">
            <FieldLabel
              htmlFor="trade-invoice-number"
              required
              icon={<FileText />}
            >
              شماره فاکتور {word}
            </FieldLabel>
            <input
              id="trade-invoice-number"
              type="text"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              dir="ltr"
            />
          </div>
          <div className="trade-field">
            <FieldLabel htmlFor="trade-warehouse" required icon={<Warehouse />}>
              گدام / انبار {isBuy ? "ورودی" : "خروجی"}
            </FieldLabel>
            <select
              id="trade-warehouse"
              value={warehouseId}
              onChange={(event) => {
                setWarehouseId(event.target.value);
                setRows((previous) =>
                  previous.map((row) => ({
                    ...row,
                    warehouseId: event.target.value,
                  })),
                );
              }}
            >
              <option value="">انتخاب انبار...</option>
              {warehouses.map((warehouse) => (
                <option value={warehouse.id} key={warehouse.id}>
                  {warehouse.name}
                  {warehouse.code ? ` (${warehouse.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="trade-field">
            <FieldLabel htmlFor="trade-deal-type" required icon={<Ticket />}>
              نوع معامله
            </FieldLabel>
            <select
              id="trade-deal-type"
              value={dealType}
              onChange={(event) => setDealType(event.target.value)}
            >
              {!dealTypes.includes(dealType) && <option>{dealType}</option>}
              {dealTypes.map((deal) => (
                <option key={deal}>{deal}</option>
              ))}
            </select>
          </div>
        </div>
        {isConsignment && (
          <div className="trade-consignment-field">
            <FieldLabel htmlFor="trade-consignment" required>
              گدام امانی
            </FieldLabel>
            <select
              id="trade-consignment"
              value={consignmentWarehouseId}
              onChange={(event) =>
                setConsignmentWarehouseId(event.target.value)
              }
            >
              <option value="">انتخاب گدام امانی...</option>
              {consignmentWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="trade-currency-grid">
          <div className="trade-field">
            <div className="trade-currency-label">
              <FieldLabel
                htmlFor="trade-currency"
                required
                icon={<DollarSign />}
              >
                انتخاب ارز فاکتور {word}
              </FieldLabel>
            </div>
            <select
              id="trade-currency"
              value={currency}
              onChange={(event) => changeCurrency(event.target.value)}
            >
              {!supportedCurrencies.some(
                (definition) => definition.code === currency,
              ) && (
                <option value={currency} disabled>
                  {currency} (حساب پشتیبانی‌نشده)
                </option>
              )}
              {supportedCurrencies.map((definition) => (
                <option key={definition.code} value={definition.code}>
                  {definition.name} ({definition.code})
                </option>
              ))}
            </select>
          </div>
          <div className="trade-field">
            <FieldLabel
              htmlFor="trade-exchange-rate"
              required
              icon={<ArrowLeftRight />}
            >
              نرخ تسعیر (۱ دالر = چند افغانی)
            </FieldLabel>
            <input
              id="trade-exchange-rate"
              type="number"
              step="any"
              min="0"
              value={usdQuote}
              onChange={(event) => changeExchangeRate(event.target.value)}
              dir="ltr"
            />
          </div>
        </div>
        <div className="trade-items-scroll">
          <table className="trade-items-table">
            <colgroup>
              {(isBuy
                ? [25, 15, 10, 13, 15, 14, 8]
                : [21, 15, 12, 10, 13, 13, 8, 8]
              ).map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>نام یا کد کالا</th>
                <th>واحد اندازه‌گیری</th>
                {!isBuy && <th>موجود در گدام</th>}
                <th>{isBuy ? "تعداد" : "تعداد فروش"}</th>
                <th>{isBuy ? "قیمت واحد" : "قیمت فروش (فی)"}</th>
                <th>{isBuy ? "مبلغ کل" : "جمع کل"}</th>
                <th>
                  توضیحات ردیف<small> (اختیاری)</small>
                </th>
                <th>{isBuy ? "عملیات" : "حذف"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const product = products.find(
                  (product) => product.id === row.productId,
                );
                const stock = product
                  ? getProductStock(product.id, row.warehouseId || warehouseId)
                  : null;
                const stockCount = stock
                  ? row.unit === "bag"
                    ? stock.bags
                    : stock.tons
                  : 0;
                const amount = roundTradeAmount(
                  (parseTradeNumber(row.quantity) || 0) *
                    (parseTradeNumber(row.unitPrice) || 0),
                );
                return (
                  <tr key={row.id}>
                    <td>
                      <TradeLookupInput
                        id={`trade-product-${row.id}`}
                        value={row.productId}
                        onChange={(id) => selectProduct(row, id)}
                        options={productOptions}
                        placeholder="جستجو نام یا کد کالا..."
                        label={`کالای ردیف ${index + 1}`}
                        accent={type}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`واحد ردیف ${index + 1}`}
                        value={row.unit}
                        onChange={(event) =>
                          changeUnit(row, event.target.value as Unit | "")
                        }
                      >
                        <option value="">انتخاب واحد...</option>
                        <option value="ton">تن (KG 1000)</option>
                        <option value="bag">
                          کیسه{product ? ` (${product.bagWeightKg}Kg)` : ""}
                        </option>
                      </select>
                    </td>
                    {!isBuy && (
                      <td>
                        <div
                          className="trade-stock-value"
                          aria-label={`موجودی ردیف ${index + 1}`}
                          dir="ltr"
                        >
                          {formatDashboardAmount(stockCount, 6)}
                        </div>
                      </td>
                    )}
                    <td>
                      <input
                        aria-label={`تعداد ردیف ${index + 1}`}
                        type="number"
                        step="any"
                        min="0"
                        value={row.quantity}
                        onChange={(event) =>
                          patchRow(row.id, { quantity: event.target.value })
                        }
                        dir="ltr"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`قیمت ردیف ${index + 1}`}
                        type="number"
                        step="any"
                        min="0"
                        value={row.unitPrice}
                        onChange={(event) =>
                          patchRow(row.id, { unitPrice: event.target.value })
                        }
                        dir="ltr"
                      />
                    </td>
                    <td>
                      <MoneyInput
                        id={`trade-row-total-${row.id}`}
                        currency={currency}
                        value={amount}
                        readOnly
                        label={`جمع ردیف ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`توضیحات ردیف ${index + 1}`}
                        type="text"
                        value={row.description}
                        placeholder="توضیحات اختیاری این ردیف"
                        onChange={(event) =>
                          patchRow(row.id, { description: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="trade-remove-row"
                        aria-label={`حذف ردیف ${index + 1}`}
                        onClick={() =>
                          setRows((previous) =>
                            previous.length === 1
                              ? [newRow()]
                              : previous.filter((item) => item.id !== row.id),
                          )
                        }
                      >
                        {isBuy ? <Trash2 /> : <X />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="trade-add-row-area">
          <button
            type="button"
            className="trade-add-row"
            onClick={() => setRows((previous) => [...previous, newRow()])}
          >
            <CirclePlus />
            {isBuy ? "افزودن ردیف جدید" : "افزودن ردیف کالا"}
          </button>
        </div>

        {isBuy ? (
          <>
            <div className="trade-purchase-subtotal">
              <div className="trade-field">
                <FieldLabel htmlFor="trade-subtotal">جمع کل اقلام</FieldLabel>
                <MoneyInput
                  id="trade-subtotal"
                  currency={currency}
                  value={totals.subtotal}
                  readOnly
                />
              </div>
              <div className="trade-field">
                <FieldLabel htmlFor="trade-discount">تخفیف کلی</FieldLabel>
                <MoneyInput
                  id="trade-discount"
                  currency={currency}
                  value={discount}
                  onChange={setDiscount}
                />
              </div>
            </div>
            <section
              className="trade-extra-expenses"
              aria-label="هزینه‌های جانبی فاکتور"
            >
              <h3>
                <Coins />
                هزینه‌های جانبی فاکتور (کرایه، تخلیه و غیره)
              </h3>
              <div className="trade-expenses-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>
                        طرف حساب (کد یا نام) <span>*</span>
                      </th>
                      <th>
                        شرح هزینه <span>*</span>
                      </th>
                      <th>
                        ارز پرداخت <span>*</span>
                      </th>
                      <th>
                        مبلغ هزینه <span>*</span>
                      </th>
                      <th>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense, index) => (
                      <tr key={expense.id}>
                        <td>
                          <TradeLookupInput
                            id={`trade-expense-party-${expense.id}`}
                            label={`طرف حساب هزینه ${index + 1}`}
                            value={expense.partyId || ""}
                            onChange={(id) =>
                              patchExpense(expense.id, {
                                partyId: id,
                                partyName:
                                  parties.find((party) => party.id === id)
                                    ?.name || "",
                              })
                            }
                            options={partyOptions}
                            placeholder="جستجو نام یا کد..."
                          />
                          {!expense.partyId && expense.partyName && (
                            <small>{expense.partyName}</small>
                          )}
                        </td>
                        <td>
                          <input
                            aria-label={`شرح هزینه ${index + 1}`}
                            value={expense.title}
                            onChange={(event) =>
                              patchExpense(expense.id, {
                                title: event.target.value,
                              })
                            }
                            placeholder="بابت هزینه..."
                          />
                        </td>
                        <td>
                          <select
                            aria-label={`ارز هزینه ${index + 1}`}
                            value={expense.currency}
                            onChange={(event) =>
                              patchExpense(expense.id, {
                                currency: event.target.value,
                                exchangeRateToInvoice: documentConversionRate(
                                  currencies,
                                  event.target.value,
                                  currency,
                                  parseTradeNumber(usdQuote),
                                ),
                              })
                            }
                          >
                            {!supportedCurrencies.some(
                              (definition) =>
                                definition.code === expense.currency,
                            ) && (
                              <option value={expense.currency} disabled>
                                {expense.currency} (ارز هزینهٔ قدیمی)
                              </option>
                            )}
                            {supportedCurrencies.map((definition) => (
                              <option
                                key={definition.code}
                                value={definition.code}
                              >
                                {definition.name} ({definition.code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <MoneyInput
                            id={`trade-expense-amount-${expense.id}`}
                            label={`مبلغ هزینه ${index + 1}`}
                            currency={expense.currency}
                            value={expense.amount}
                            onChange={(value) =>
                              patchExpense(expense.id, { amount: value })
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="trade-remove-row"
                            aria-label={`حذف هزینه ${index + 1}`}
                            onClick={() =>
                              setExpenses((previous) =>
                                previous.filter(
                                  (item) => item.id !== expense.id,
                                ),
                              )
                            }
                          >
                            <X />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="trade-add-expense"
                onClick={() =>
                  setExpenses((previous) => [
                    ...previous,
                    {
                      id: createTradeEntityId("expense"),
                      partyName: "",
                      title: "",
                      currency,
                      amount: "0",
                      exchangeRateToInvoice: 1,
                    },
                  ])
                }
              >
                <CirclePlus />
                افزودن هزینه جدید
              </button>
            </section>
            <div className="trade-purchase-conversion">
              <div className="trade-field">
                <FieldLabel htmlFor="trade-expenses-total">
                  مجموع هزینه‌های جانبی (تسعیرشده)
                </FieldLabel>
                <MoneyInput
                  id="trade-expenses-total"
                  currency={currency}
                  value={totals.expensesTotal}
                  readOnly
                />
              </div>
              <div className="trade-field">
                <FieldLabel htmlFor="trade-final-total">
                  مبلغ نهایی فاکتور + هزینه‌ها
                </FieldLabel>
                <MoneyInput
                  id="trade-final-total"
                  currency={currency}
                  value={finalTotal}
                  readOnly
                  tone="is-final"
                />
                <small className="trade-base-preview">
                  معادل ارز پایه:{" "}
                  <bdi>
                    {formatDashboardAmount(baseEquivalent, 2)} {baseCurrency}
                  </bdi>
                </small>
              </div>
            </div>
            <div className="trade-payment-grid">{paymentFields}</div>
            {actions}
          </>
        ) : (
          <section
            className="trade-sale-settlement"
            aria-label="جمع و پرداخت فاکتور فروش"
          >
            <div className="trade-sale-totals">
              <div className="trade-field">
                <FieldLabel htmlFor="trade-subtotal">جمع کل</FieldLabel>
                <MoneyInput
                  id="trade-subtotal"
                  currency={currency}
                  value={totals.subtotal}
                  readOnly
                />
              </div>
              <div className="trade-field">
                <FieldLabel htmlFor="trade-discount">تخفیف</FieldLabel>
                <MoneyInput
                  id="trade-discount"
                  currency={currency}
                  value={discount}
                  onChange={setDiscount}
                />
              </div>
              <div className="trade-field">
                <FieldLabel htmlFor="trade-shipping">
                  کرایه خروجی (+)
                </FieldLabel>
                <MoneyInput
                  id="trade-shipping"
                  currency={currency}
                  value={shipping}
                  onChange={setShipping}
                />
              </div>
              <div className="trade-field trade-sale-method">
                <FieldLabel htmlFor="trade-payment-type">نوع پرداخت</FieldLabel>
                <select
                  id="trade-payment-type"
                  value={method}
                  onChange={(event) =>
                    changePaymentType(event.target.value as TradePaymentType)
                  }
                >
                  <option>نقدی</option>
                  <option>نسیه</option>
                  <option>نیمه نسیه</option>
                </select>
              </div>
            </div>
            <div className="trade-sale-payment">
              {React.Children.toArray(paymentFields.props.children).slice(1)}
            </div>
            <div className="trade-sale-footer">
              <div className="trade-sale-result">
                <strong>
                  مبلغ نهایی جهت دریافت:{" "}
                  <bdi>
                    {currency} {formatDashboardAmount(finalTotal, 2)}
                  </bdi>
                </strong>
                <small className={estimatedProfit < 0 ? "is-loss" : ""}>
                  سود تخمینی (قبل از کرایه و تخفیف):{" "}
                  <bdi>
                    {currency} {formatDashboardAmount(estimatedProfit, 2)}
                  </bdi>
                </small>
              </div>
              {actions}
            </div>
          </section>
        )}
        {notes || invoice?.tax ? (
          <div className="trade-existing-metadata">
            {invoice?.tax ? (
              <span>
                مالیات ثبت‌شده و منظورشده در مبلغ نهایی:{" "}
                <bdi>
                  {tax} {currency}
                </bdi>
              </span>
            ) : null}
            <details>
              <summary>یادداشت فاکتور</summary>
              <textarea
                aria-label="یادداشت فاکتور"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </details>
          </div>
        ) : null}
      </form>
      <ShamsiDatePickerModal
        isOpen={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        value={date}
        onChange={(value) => {
          setDate(value);
          setDatePickerOpen(false);
        }}
        title={`تاریخ ${word} (شمسی)`}
        colorTheme={isBuy ? "blue" : "emerald"}
      />
      <QuickAddPartyModal
        isOpen={quickPartyTarget !== null}
        onClose={() => setQuickPartyTarget(null)}
        initialType={isBuy ? "supplier" : "customer"}
        defaultCurrency={currency}
        onPartyAdded={(party) => {
          if (quickPartyTarget === "main") setPartyId(party.id);
          else if (quickPartyTarget)
            patchExpense(quickPartyTarget, {
              partyId: party.id,
              partyName: party.name,
            });
          setQuickPartyTarget(null);
        }}
      />
    </>
  );
};

import React, { useState } from "react";
import { CheckCircle2, Plus, CalendarDays } from "lucide-react";
import { useAccounting } from "../context/AccountingContext";
import type { FinancialTransaction } from "../types";
import { TradeLookupInput } from "./TradeLookupInput";
import { QuickAddPartyModal } from "./QuickAddPartyModal";
import { ShamsiDatePickerModal } from "./ShamsiDatePickerModal";
import { IncomeReceiptDesk } from "./IncomeReceiptDesk";
import { ExpensePaymentDesk } from "./ExpensePaymentDesk";
import { getPersianDate, getCurrentTime } from "../utils/formatters";
import { formatDashboardAmount } from "../utils/dashboard";
import {
  parseTradeNumber,
  roundTradeAmount,
  tradeGregorianEquivalent,
  tradeShamsiDate,
} from "../utils/tradeInvoices";
import {
  documentConversionRate,
  documentRateToBase,
  initialTransactionUsdAfnQuote,
  isUsdAfnPair,
  preferredCashAccountId,
} from "../utils/documentDefaults";
import { applyTransactionParties } from "../utils/transactionLedger";
import {
  duplicateTreasuryNumber,
  nextTreasuryNumber,
  treasuryTransactionType,
  type TreasuryDirection,
  type TreasuryMode,
} from "../utils/treasury";

interface Props {
  direction: TreasuryDirection;
  initialPartyId?: string;
  initialMode?: TreasuryMode;
  transaction?: FinancialTransaction;
  onSaved: () => void;
}
const amountText = (value: number) =>
  Number.isFinite(value) ? formatDashboardAmount(value, 6) : "—";
const Money: React.FC<{
  id: string;
  currency: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  positive?: boolean;
}> = ({ id, currency, value, onChange, readOnly, positive }) => (
  <div className={`treasury-money ${positive ? "is-positive" : ""}`}>
    <span>
      {currency === "USD" ? "$" : currency === "AFN" ? "؋" : currency}
    </span>
    <input
      id={id}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      readOnly={readOnly}
      dir="ltr"
      inputMode="decimal"
    />
  </div>
);

export const ReferenceTreasuryForm: React.FC<Props> = ({
  direction,
  initialPartyId,
  initialMode,
  transaction,
  onSaved,
}) => {
  const {
    parties,
    cashAccounts,
    currencies,
    cashRegister,
    transactions,
    currentUser,
    createTransaction,
    updateTransaction,
  } = useAccounting();
  const receive = direction === "receipt";
  const baseCurrency =
    currencies.find((currency) => currency.isBase)?.code || "AFN";
  const storedTransfer = transaction?.type === "cash_transfer" || transaction?.type === "currency_exchange";
  const [mode, setMode] = useState<TreasuryMode>(
    storedTransfer
      ? "transfer"
      : transaction
        ? "party"
        : initialMode || (receive || initialPartyId ? "party" : "transfer"),
  );
  const type = transaction?.type || treasuryTransactionType(direction, mode);
  const [number, setNumber] = useState(
    transaction?.transactionNumber || nextTreasuryNumber(transactions, type),
  );
  const [date, setDate] = useState(
    tradeShamsiDate(transaction?.date || getPersianDate()),
  );
  const [issueTime, setIssueTime] = useState(
    transaction?.issueTime || getCurrentTime(),
  );
  const [partyId, setPartyId] = useState(
    transaction?.partyId || initialPartyId || "",
  );
  const [currency, setCurrency] = useState(
    transaction?.cashCurrency || transaction?.currency || baseCurrency,
  );
  const [partyCurrency, setPartyCurrency] = useState(
    transaction?.currency || baseCurrency,
  );
  const initialQuote = initialTransactionUsdAfnQuote(currencies, transaction && {
    ...transaction,
    targetCurrency: transaction.targetCurrency || cashAccounts.find((account) => account.id === transaction.toCashRegister)?.currency,
  }, cashRegister.usdToAfnRate);
  const [quote, setQuote] = useState(Number.isFinite(initialQuote) ? String(initialQuote) : "");
  const [cashAccount, setCashAccount] = useState(
    transaction?.cashRegister || transaction?.fromCashRegister || preferredCashAccountId(cashAccounts, currency),
  );
  const [destination, setDestination] = useState(
    transaction?.toCashRegister || "",
  );
  const [exchange, setExchange] = useState(Boolean(transaction?.isExchange));
  const [crossRate, setCrossRate] = useState(
    String(
      transaction?.isExchange
        ? storedTransfer
          ? (transaction.targetAmount || 0) / transaction.amount
          : transaction.amount / (transaction.cashAmount || transaction.amount)
        : 1,
    ),
  );
  const [amount, setAmount] = useState(
    String(
      transaction
        ? storedTransfer
          ? transaction.amount
          : (transaction.cashAmount ?? transaction.amount)
        : 0,
    ),
  );
  const [discount, setDiscount] = useState(
    String(transaction?.discountAmount || 0),
  );
  const [subject, setSubject] = useState(
    transaction?.transactionSubject ||
      (receive ? "دریافت بابت فاکتور نسیه" : "پرداخت بابت فاکتور نسیه"),
  );
  const [description, setDescription] = useState(
    transaction?.description || "",
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const target = cashAccounts.find((account) => account.id === destination);
  const ledgerCurrency =
    mode === "transfer"
      ? target?.currency || currency
      : exchange
        ? partyCurrency
        : currency;
  const cashValue = parseTradeNumber(amount),
    discountValue = mode === "transfer" ? 0 : parseTradeNumber(discount);
  const dollarExchange = isUsdAfnPair(currency, ledgerCurrency);
  const ratio = !exchange ? 1 : dollarExchange
    ? documentConversionRate(currencies, currency, ledgerCurrency, parseTradeNumber(quote))
    : parseTradeNumber(crossRate);
  const ledgerValue =
    Number.isFinite(cashValue) && Number.isFinite(ratio)
      ? roundTradeAmount(cashValue * ratio)
      : NaN;
  const beforeParties = transaction
    ? applyTransactionParties(parties, transaction, true)
    : parties;
  const party = beforeParties.find((item) => item.id === partyId);
  const balanceBefore = party
    ? ledgerCurrency === "AFN"
      ? party.balanceAFN
      : party.balanceUSD
    : 0;
  const balanceAfter = roundTradeAmount(
    balanceBefore + (receive ? 1 : -1) * (ledgerValue + discountValue),
  );
  const setConversion = (from: string, to: string, usdQuote = parseTradeNumber(quote)) =>
    setCrossRate(String(documentConversionRate(currencies, from, to, usdQuote)));
  const changeQuote = (value: string) => {
    setQuote(value);
    if (exchange) setConversion(currency, ledgerCurrency, parseTradeNumber(value));
  };
  const changeCurrency = (code: string) => {
    if (code === currency) return;
    const nextCash = preferredCashAccountId(cashAccounts, code);
    setCurrency(code);
    setCashAccount(nextCash);
    if (mode === "transfer" && target) {
      if (target.id === nextCash) { setDestination(""); setExchange(false); }
      else {
        setExchange(target.currency !== code);
        setConversion(code, target.currency);
      }
    } else if (!exchange) setPartyCurrency(code);
    else setConversion(code, ledgerCurrency);
  };
  const changeMode = (next: TreasuryMode) => {
    setMode(next);
    setError("");
    if (!transaction)
      setNumber(
        nextTreasuryNumber(
          transactions,
          treasuryTransactionType(direction, next),
        ),
      );
    setDiscount("0");
    setExchange(false);
    setCrossRate("1");
  };
  const toggleExchange = (checked: boolean) => {
    setExchange(checked);
    if (checked) {
      const to =
        mode === "transfer"
          ? target?.currency || (currency === "USD" ? "AFN" : "USD")
          : currency === "USD"
            ? "AFN"
            : "USD";
      setPartyCurrency(to);
      setConversion(currency, to, parseTradeNumber(quote));
    } else {
      setPartyCurrency(currency);
      setCrossRate("1");
    }
  };
  const selectDestination = (id: string) => {
    setDestination(id);
    const account = cashAccounts.find((item) => item.id === id);
    if (account && account.currency !== currency) {
      setExchange(true);
      setConversion(currency, account.currency, parseTradeNumber(quote));
    } else {
      setExchange(false);
      setCrossRate("1");
    }
  };
  const settleAll = (code: string, value: number) => {
    setPartyCurrency(code);
    const conversion = documentConversionRate(currencies, currency, code, parseTradeNumber(quote));
    setExchange(code !== currency);
    setCrossRate(String(code === currency ? 1 : conversion));
    if (conversion > 0)
      setAmount(String(roundTradeAmount(Math.abs(value) / conversion)));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const sourceAccount = cashAccounts.find(
      (account) => account.id === cashAccount,
    );
    if (!number.trim()) return setError("شمارهٔ سند را وارد کنید.");
    if (duplicateTreasuryNumber(transactions, type, number, transaction?.id))
      return setError(
        "این شمارهٔ سند قبلاً ثبت شده است؛ برای ویرایش از لیست اسناد استفاده کنید.",
      );
    if (tradeGregorianEquivalent(date) === "—")
      return setError("تاریخ معتبر وارد کنید.");
    if (!sourceAccount || sourceAccount.currency !== currency)
      return setError("صندوق معتبر با ارز انتخاب‌شده تعیین کنید.");
    if (!Number.isFinite(cashValue) || cashValue <= 0)
      return setError("مبلغ نقدی باید عدد معتبر و بیشتر از صفر باشد.");
    if (!Number.isFinite(discountValue) || discountValue < 0)
      return setError("تخفیف باید عدد معتبر و غیرمنفی باشد.");
    if (
      !Number.isFinite(parseTradeNumber(quote)) ||
      !(parseTradeNumber(quote) > 0) ||
      !Number.isFinite(documentRateToBase(currencies, currency, parseTradeNumber(quote))) ||
      !Number.isFinite(ratio) ||
      !(ratio > 0) ||
      !Number.isFinite(ledgerValue)
    )
      return setError("نرخ تبدیل باید معتبر و بیشتر از صفر باشد.");
    if (ledgerValue <= 0)
      return setError("مبلغ پس از تبدیل باید بیشتر از صفر و قابل ثبت با دقت شش رقم اعشار باشد.");
    if (
      mode === "party" &&
      (!party || !["AFN", "USD"].includes(ledgerCurrency))
    )
      return setError("طرف حساب و ارز معتبر حساب شخص را انتخاب کنید.");
    if (
      mode === "transfer" &&
      (!target ||
        target.id === sourceAccount.id ||
        (target.currency !== currency && !exchange))
    )
      return setError("صندوق مقصد متفاوت و نرخ تبدیل صحیح را انتخاب کنید.");
    setSubmitting(true);
    setError("");
    const data: Omit<FinancialTransaction, "id" | "createdAt"> = {
      transactionNumber: number.trim(),
      date: tradeShamsiDate(date),
      issueTime,
      type,
      amount: mode === "transfer" ? roundTradeAmount(cashValue) : ledgerValue,
      currency: mode === "transfer" ? currency : ledgerCurrency,
      cashAmount: roundTradeAmount(cashValue),
      cashCurrency: currency,
      cashRegister: mode === "transfer" ? undefined : sourceAccount.id,
      cashRegisterName: sourceAccount.name,
      fromCashRegister: mode === "transfer" ? sourceAccount.id : undefined,
      toCashRegister: mode === "transfer" ? target!.id : undefined,
      targetAmount: mode === "transfer" ? ledgerValue : undefined,
      targetCurrency: mode === "transfer" ? target!.currency : undefined,
      partyId: mode === "party" ? party!.id : undefined,
      partyName: mode === "party" ? party!.name : undefined,
      partyPhone: mode === "party" ? party!.phone : undefined,
      discountAmount: mode === "party" ? discountValue : 0,
      transactionSubject: subject,
      treasuryCategory:
        mode === "transfer"
          ? "transfer"
          : subject.includes("برگشت")
            ? "refund"
            : "personal",
      createdByName: transaction?.createdByName || currentUser.name,
      partyBalanceBefore: mode === "party" ? balanceBefore : undefined,
      partyBalanceAfter: mode === "party" ? balanceAfter : undefined,
      isExchange: exchange,
      exchangeRate: !exchange ? undefined : dollarExchange ? parseTradeNumber(quote)
        : currency === "USD" ? ratio : ratio > 0 ? 1 / ratio : undefined,
      usdToAfnRate: parseTradeNumber(quote),
      quoteToBase: documentRateToBase(currencies, currency, parseTradeNumber(quote)),
      exchangeRateBaseCurrency: baseCurrency,
      description:
        description.trim() ||
        (mode === "transfer"
          ? `انتقال وجه از ${sourceAccount.name} به ${target!.name}`
          : `${subject}؛ ${receive ? "دریافت از" : "پرداخت به"} ${party!.name}`),
    };
    if (transaction) updateTransaction({ ...transaction, ...data });
    else createTransaction(data);
    onSaved();
  };
  const header = (
    <div className="treasury-document-row">
      <div className="treasury-field">
        <label htmlFor="treasury-number">
          شمارهٔ سند {receive ? "دریافت" : "پرداخت"}
        </label>
        <input
          id="treasury-number"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          dir="ltr"
        />
      </div>
      <div className="treasury-field">
        <label htmlFor="treasury-mode">
          نوع عملیات {receive ? "دریافت" : "پرداخت"} <em>*</em>
        </label>
        <select
          id="treasury-mode"
          value={mode}
          onChange={(event) => changeMode(event.target.value as TreasuryMode)}
          disabled={Boolean(transaction)}
        >
          <option value="party">
            ۱. {receive ? "دریافت از" : "پرداخت به"} مشتری / تأمین‌کننده
          </option>
          <option value={receive ? "income" : "expense"}>
            ۲. {receive ? "دریافت عواید متفرقه" : "پرداخت هزینه و مصارف"}
          </option>
          <option value="transfer">
            ۳. {receive ? "دریافت" : "پرداخت"} بابت صندوق (انتقال / تبدیل)
          </option>
        </select>
      </div>
      <div className="treasury-field treasury-date">
        <label htmlFor="treasury-date">
          تاریخ {receive ? "دریافت" : "پرداخت"} (شمسی) <em>*</em>
        </label>
        <div>
          <input
            id="treasury-date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            dir="ltr"
          />
          <button
            type="button"
            aria-label="انتخاب تاریخ سند"
            onClick={() => setCalendarOpen(true)}
          >
            <CalendarDays />
          </button>
        </div>
        <small>
          <CheckCircle2 />
          معادل میلادی: <bdi>{tradeGregorianEquivalent(date)}</bdi>
        </small>
      </div>
    </div>
  );
  return (
    <>
      <section
        className={`treasury-document-form ${receive ? "is-receipt" : "is-payment"}`}
      >
        <h2>
          <Plus />
          {transaction ? "ویرایش" : "ثبت"}{" "}
          {receive ? "رسید دریافت" : "سند پرداخت"} نقدی{" "}
          {transaction ? `#${transaction.transactionNumber}` : "جدید"}
        </h2>
        {mode === "income" || mode === "expense" ? (
          <>
            <div className="treasury-form-body">{header}</div>
            {mode === "income" ? (
              <IncomeReceiptDesk onSuccess={onSaved} onViewList={onSaved} />
            ) : (
              <ExpensePaymentDesk onSuccess={onSaved} onViewList={onSaved} />
            )}
          </>
        ) : (
          <form className="treasury-form-body" onSubmit={submit}>
            {header}
            <div className="treasury-rate-band treasury-grid-2">
              <div className="treasury-field">
                <label htmlFor="treasury-currency">
                  {mode === "transfer"
                    ? "انتخاب ارز پرداخت"
                    : `ارز صندوق (پول ${receive ? "دریافتی" : "پرداختی"})`}{" "}
                  <em>*</em>
                </label>
                <select
                  id="treasury-currency"
                  value={currency}
                  onChange={(event) => changeCurrency(event.target.value)}
                >
                  {currencies.map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="treasury-field">
                <label htmlFor="treasury-rate">
                  نرخ تسعیر (۱ دالر = چند افغانی) <em>*</em>
                </label>
                <input
                  id="treasury-rate"
                  value={quote}
                  dir="ltr"
                  inputMode="decimal"
                  onChange={(event) => changeQuote(event.target.value)}
                />
              </div>
            </div>
            {mode === "transfer" ? (
              <div className="treasury-grid-2 treasury-transfer-accounts">
                <div className="treasury-field">
                  <label htmlFor="treasury-cash">
                    صندوق مبدأ (بانک / صندوق کسرشونده) <em>*</em>
                  </label>
                  <select
                    id="treasury-cash"
                    value={cashAccount}
                    onChange={(event) => setCashAccount(event.target.value)}
                  >
                    <option value="">انتخاب صندوق مبدأ...</option>
                    {cashAccounts
                      .filter((account) => account.currency === currency)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="treasury-field">
                  <label htmlFor="treasury-destination">
                    صندوق مقصد (بانک / صندوق دریافت‌کننده) <em>*</em>
                  </label>
                  <select
                    id="treasury-destination"
                    value={destination}
                    onChange={(event) => selectDestination(event.target.value)}
                  >
                    <option value="">انتخاب صندوق مقصد...</option>
                    {cashAccounts
                      .filter((account) => account.id !== cashAccount)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <div className="treasury-grid-2 treasury-party-row">
                  <div className="treasury-field">
                    <label htmlFor="treasury-party">
                      انتخاب مشتری / تأمین‌کننده <em>*</em>
                    </label>
                    <div className="treasury-party-lookup">
                      <TradeLookupInput
                        id="treasury-party"
                        value={partyId}
                        onChange={setPartyId}
                        options={parties.map((item) => ({
                          id: item.id,
                          label: item.name,
                          keywords: `${item.phone} ${item.code || ""}`,
                        }))}
                        label="طرف حساب سند"
                        placeholder="برای جستجوی شخص تایپ کنید..."
                        accent={receive ? "sell" : "buy"}
                      />
                      <button
                        type="button"
                        aria-label="افزودن طرف حساب سند"
                        onClick={() => setPartyModalOpen(true)}
                      >
                        <Plus />
                      </button>
                    </div>
                  </div>
                  <div className="treasury-field">
                    <label htmlFor="treasury-subject">
                      بابت معامله <em>*</em>
                    </label>
                    <select
                      id="treasury-subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    >
                      {[
                        receive
                          ? "دریافت بابت فاکتور نسیه"
                          : "پرداخت بابت فاکتور نسیه",
                        receive
                          ? "دریافت نقدی داخل دفتر"
                          : "پرداخت نقدی داخل دفتر",
                        "برگشت وجه",
                        "دریافت / پرداخت شخصی",
                        "تسویه حساب",
                        "سایر معاملات",
                      ].map((text) => (
                        <option key={text}>{text}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="treasury-party-status">
                  حالت حساب مشتری:{" "}
                  {party ? (
                    <span>
                      <bdi>{amountText(party.balanceUSD)} USD</bdi> ·{" "}
                      <bdi>{amountText(party.balanceAFN)} AFN</bdi>{" "}
                      <small>(منفی: طلب ما؛ مثبت: بدهی ما)</small>
                    </span>
                  ) : (
                    <span>
                      لطفاً ابتدا شخص مورد نظر را جستجو و انتخاب کنید.
                    </span>
                  )}
                </div>
              </>
            )}
            <label className="treasury-exchange-toggle">
              <input
                type="checkbox"
                checked={exchange}
                onChange={(event) => toggleExchange(event.target.checked)}
              />
              <span />
              فعال‌سازی تسویهٔ چندارزی (تبدیل مستقیم پول)
            </label>
            {exchange && (
              <div className="treasury-cross-fields treasury-grid-3">
                {mode !== "transfer" && (
                  <div className="treasury-field">
                    <label htmlFor="treasury-party-currency">
                      ارز حساب شخص
                    </label>
                    <select
                      id="treasury-party-currency"
                      value={partyCurrency}
                      onChange={(event) => {
                        setPartyCurrency(event.target.value);
                        setConversion(
                          currency,
                          event.target.value,
                          parseTradeNumber(quote),
                        );
                      }}
                    >
                      <option value="USD">USD</option>
                      <option value="AFN">AFN</option>
                    </select>
                  </div>
                )}
                <div className="treasury-field">
                  <label htmlFor="treasury-cross-rate">
                    {dollarExchange ? "هر ۱ دالر = چند افغانی؟" : `هر ۱ ${currency} = چند ${ledgerCurrency}؟`}
                  </label>
                  <input
                    id="treasury-cross-rate"
                    value={dollarExchange ? quote : crossRate}
                    onChange={(event) => dollarExchange ? changeQuote(event.target.value) : setCrossRate(event.target.value)}
                    dir="ltr"
                    inputMode="decimal"
                  />
                </div>
                <div className="treasury-field">
                  <label htmlFor="treasury-ledger-amount">
                    {mode === "transfer"
                      ? "مبلغ ورودی صندوق مقصد"
                      : "مبلغ تسویهٔ حساب شخص"}
                  </label>
                  <input
                    id="treasury-ledger-amount"
                    value={
                      Number.isFinite(ledgerValue) ? String(ledgerValue) : ""
                    }
                    dir="ltr"
                    inputMode="decimal"
                    onChange={(event) => {
                      const value = parseTradeNumber(event.target.value);
                      if (Number.isFinite(value) && ratio > 0)
                        setAmount(String(roundTradeAmount(value / ratio)));
                    }}
                  />
                </div>
              </div>
            )}
            <div
              className={`treasury-amount-row ${mode === "transfer" ? "is-transfer" : ""}`}
            >
              {mode !== "transfer" && (
                <div className="treasury-field">
                  <label htmlFor="treasury-cash">
                    {receive ? "واریز به صندوق" : "برداشت از صندوق"} <em>*</em>
                  </label>
                  <select
                    id="treasury-cash"
                    value={cashAccount}
                    onChange={(event) => setCashAccount(event.target.value)}
                  >
                    <option value="">
                      انتخاب صندوق {receive ? "مقصد" : "مبدأ"}...
                    </option>
                    {cashAccounts
                      .filter((account) => account.currency === currency)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="treasury-field">
                <label htmlFor="treasury-amount">
                  مبلغ {receive ? "دریافتی" : "پرداختی"} <em>*</em>
                </label>
                <Money
                  id="treasury-amount"
                  currency={currency}
                  value={amount}
                  onChange={setAmount}
                  positive={receive}
                />
              </div>
              <div className="treasury-field">
                <label htmlFor="treasury-discount">
                  تخفیف {receive ? "اعطا شده" : "دریافتی"}
                </label>
                <Money
                  id="treasury-discount"
                  currency={ledgerCurrency}
                  value={mode === "transfer" ? "0" : discount}
                  onChange={setDiscount}
                  readOnly={mode === "transfer"}
                />
              </div>
            </div>
            <div className="treasury-field treasury-description">
              <label htmlFor="treasury-description">
                شرح تفصیلی سند (توضیحات)
              </label>
              <textarea
                id="treasury-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="توضیحات سند را وارد کنید..."
                rows={1}
              />
            </div>
            <details className="treasury-more-fields">
              <summary>جزئیات بیشتر سند</summary>
              <div className="treasury-grid-3">
                <div className="treasury-field">
                  <label htmlFor="treasury-time">ساعت ثبت</label>
                  <input
                    id="treasury-time"
                    type="time"
                    value={issueTime}
                    onChange={(event) => setIssueTime(event.target.value)}
                  />
                </div>
                {party &&
                  ["USD", "AFN"].map((code) => (
                    <button
                      type="button"
                      key={code}
                      onClick={() =>
                        settleAll(
                          code,
                          code === "USD" ? party.balanceUSD : party.balanceAFN,
                        )
                      }
                    >
                      تسویهٔ کل {code}:{" "}
                      {amountText(
                        code === "USD" ? party.balanceUSD : party.balanceAFN,
                      )}
                    </button>
                  ))}
              </div>
              {mode === "transfer" && (
                <p>
                  انتقال داخلی تخفیف ندارد؛ تخفیف در تسویهٔ حساب اشخاص ثبت
                  می‌شود.
                </p>
              )}
            </details>
            {mode === "party" && (
              <div className="treasury-next-balance">
                باقی‌ماندهٔ حساب شخص پس از این سند:{" "}
                <strong>
                  <bdi>
                    {amountText(balanceAfter)} {ledgerCurrency}
                  </bdi>
                </strong>
              </div>
            )}
            {error && (
              <p className="treasury-form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="treasury-submit"
              type="submit"
              disabled={submitting}
            >
              {transaction
                ? "تأیید و ذخیرهٔ تغییرات سند"
                : `تأیید و ثبت ${receive ? "سند دریافت" : "نهایی سند پرداخت"}`}
            </button>
          </form>
        )}
      </section>
      <QuickAddPartyModal
        isOpen={partyModalOpen}
        onClose={() => setPartyModalOpen(false)}
        onPartyAdded={(item) => {
          setPartyId(item.id);
          setPartyModalOpen(false);
        }}
        initialType={receive ? "customer" : "supplier"}
      />
      <ShamsiDatePickerModal
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        value={date}
        onChange={setDate}
        colorTheme={receive ? "emerald" : "blue"}
      />
    </>
  );
};

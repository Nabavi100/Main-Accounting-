import { usePageReport } from './PageActionsToolbar';
import { tableReport, reportPaymentStatus } from '../utils/reportData';
import React, { useMemo, useState } from "react";
import { FileText, Pencil, Printer, Search, Trash2 } from "lucide-react";
import { useAccounting } from "../context/AccountingContext";
import type { Invoice } from "../types";
import {
  formatDashboardAmount,
  normalizeDashboardSearch,
} from "../utils/dashboard";
import { normalizePersianDate } from "../utils/formatters";
import {
  aggregateTradeInvoices,
  filterTradeInvoices,
  tradeItemSummary,
  type TradeType,
} from "../utils/tradeInvoices";
import { WorkspaceDialog } from "./WorkspaceShell";

interface ReferenceInvoiceListProps {
  type: TradeType;
  onViewInvoice: (id: string) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onCreate: () => void;
}

export const ReferenceInvoiceList: React.FC<ReferenceInvoiceListProps> = ({
  type,
  onViewInvoice,
  onEditInvoice,
  onCreate,
}) => {
  const { invoices, parties, currentUser, deleteInvoice, openPrintModal } =
    useAccounting();
  const isBuy = type === "buy";
  const [query, setQuery] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const canDelete = !!currentUser?.canDeleteRecords;
  const visible = useMemo(
    () => filterTradeInvoices(invoices, type, selectedPartyId, query),
    [invoices, type, selectedPartyId, query],
  );
  const amounts = useMemo(() => aggregateTradeInvoices(visible), [visible]);
  const currencyCodes = [
    "AFN",
    "USD",
    ...Object.keys(amounts).filter((code) => code !== "AFN" && code !== "USD"),
  ];
  const partyCards = useMemo(() => {
    const grouped = new Map<
      string,
      {
        name: string;
        count: number;
        balanceAFN: number;
        balanceUSD: number;
        isKnown: boolean;
      }
    >();
    for (const invoice of filterTradeInvoices(invoices, type)) {
      if (!invoice.partyId) continue;
      if (!grouped.has(invoice.partyId)) {
        const party = parties.find((party) => party.id === invoice.partyId);
        grouped.set(invoice.partyId, {
          name: party?.name || invoice.partyName,
          count: 0,
          balanceAFN: party?.balanceAFN || 0,
          balanceUSD: party?.balanceUSD || 0,
          isKnown: !!party,
        });
      }
      const group = grouped.get(invoice.partyId)!;
      group.count += 1;
      // Only use invoice balances as a fallback when the party no longer exists.
      if (!group.isKnown) {
        if (invoice.currency === "AFN")
          group.balanceAFN += invoice.balanceAmount;
        if (invoice.currency === "USD")
          group.balanceUSD += invoice.balanceAmount;
      }
    }
    const search = normalizeDashboardSearch(partyQuery);
    return Array.from(grouped, ([id, data]) => ({ id, ...data })).filter(
      (card) => {
        const party = parties.find((party) => party.id === card.id);
        return (
          !search ||
          normalizeDashboardSearch(
            `${card.name} ${party?.code || ""} ${party?.phone || ""} ${party?.company || ""}`,
          ).includes(search)
        );
      },
    );
  }, [invoices, type, parties, isBuy, partyQuery]);

  const headers = [
    "شماره فاکتور",
    isBuy ? "طرف حساب" : "مشتری",
    "نوع سند",
    "کالا",
    isBuy ? "مقدار" : "تعداد",
    isBuy ? "مبلغ نهایی" : "مبلغ فاکتور",
    ...(isBuy ? ["پرداختی", "باقیمانده"] : []),
    "تاریخ",
    "وضعیت",
    "عملیات",
  ];
  const widths = isBuy
    ? [6, 13, 8, 12, 11, 11, 9, 10, 7, 5, 8]
    : [7, 20, 10, 16, 12, 14, 9, 6, 6];

  usePageReport({
    title: isBuy ? 'لیست فاکتورهای خرید' : 'لیست فاکتورهای فروش',
    onCreate, createLabel: isBuy ? 'ایجاد خرید جدید' : 'ایجاد فروش جدید',
    search: { value: query, onChange: setQuery, id: 'trade-invoice-search', label: 'جستجوی فاکتور', clearLabel: 'پاک کردن جستجوی فاکتور', placeholder: isBuy ? 'جستجوی سریع فاکتور خرید...' : 'جستجوی فاکتور فروش...' },
    filters: [{ id: 'party', label: isBuy ? 'تأمین‌کننده' : 'مشتری', value: selectedPartyId, onChange: setSelectedPartyId, resetValue: '', options: [{ value: '', label: 'همه طرف‌های حساب' }, ...partyCards.map(party => ({ value: party.id, label: party.name }))] }],
    getReport: () => tableReport(isBuy ? 'لیست فاکتورهای خرید' : 'لیست فاکتورهای فروش',
      ['شماره فاکتور', 'تاریخ', 'طرف حساب', 'نوع سند', 'کالا', 'مبلغ کل', 'پرداخت‌شده', 'باقی‌مانده', 'ارز', 'وضعیت'],
      visible.map(invoice => [invoice.invoiceNumber, invoice.date, invoice.partyName, invoice.dealTypeLabel || (/امانی|consignment/i.test(invoice.dealType || '') ? 'امانی' : /پیش|pre_order/i.test(invoice.dealType || '') ? isBuy ? 'پیش خرید' : 'پیش فروش' : isBuy ? 'خرید قطعی' : 'فروش قطعی'), invoice.items.map(item => `${item.productName} — ${item.quantity} ${item.unit === 'bag' ? 'کیسه' : 'تن'}`).join('؛ '), invoice.totalAmount, invoice.paidAmount, invoice.balanceAmount, invoice.currency, reportPaymentStatus(invoice.paymentStatus)]),
      Object.entries(amounts).map(([currency, total]) => ['جمع', '', '', '', '', total.total, total.paid, total.balance, currency, ''])),
  });

  return (
    <div className={`trade-invoice-list is-${type}`}>
      <div
        className="trade-party-filter"
        aria-label={isBuy ? "فیلتر تأمین‌کنندگان" : "فیلتر مشتریان"}
      >
        <div className="trade-party-search">
          <Search aria-hidden="true" />
          <input
            aria-label={isBuy ? "جستجوی تأمین‌کننده" : "جستجوی مشتری"}
            placeholder={isBuy ? "جستجوی تأمین‌کننده..." : "جستجوی مشتری..."}
            value={partyQuery}
            onChange={(event) => setPartyQuery(event.target.value)}
          />
        </div>
        <div className="trade-party-cards">
          <button
            type="button"
            className={`trade-all-parties ${selectedPartyId ? "" : "is-selected"}`}
            aria-pressed={!selectedPartyId}
            onClick={() => setSelectedPartyId("")}
          >
            {isBuy ? "همه تأمین‌کنندگان" : "همه مشتریان"}
          </button>
          {partyCards.map((card) => {
            const balances = [
              ["AFN", card.balanceAFN],
              ["USD", card.balanceUSD],
            ] as const;
            const nonZero = balances.filter(([, balance]) => balance !== 0);
            return (
              <button
                key={card.id}
                type="button"
                className={`trade-party-card ${selectedPartyId === card.id ? "is-selected" : ""}`}
                aria-pressed={selectedPartyId === card.id}
                onClick={() => setSelectedPartyId(card.id)}
              >
                <span className="trade-party-card-name">{card.name}</span>
                <span
                  className="trade-party-card-balances"
                  title={
                    card.isKnown
                      ? "ماندهٔ فعلی حساب شخص؛ مستقل از جمع فاکتورهای فیلترشده"
                      : "باقی‌ماندهٔ فاکتورها؛ تعریف شخص دیگر موجود نیست"
                  }
                >
                  {(nonZero.length ? nonZero : [["USD", 0] as const]).map(
                    ([code, balance]) => (
                      <bdi
                        key={code}
                        title={
                          balance < 0
                            ? "بدهکار به ما"
                            : balance > 0
                              ? "طلبکار از ما"
                              : "حساب تسویه"
                        }
                      >
                        {code} {formatDashboardAmount(Math.abs(balance), 6)}
                      </bdi>
                    ),
                  )}
                </span>
                <small>فاکتور {formatDashboardAmount(card.count, 0)}</small>
              </button>
            );
          })}
          {!partyCards.length && (
            <p className="trade-party-empty">
              {partyQuery
                ? "نتیجه‌ای یافت نشد."
                : "هنوز طرف حسابی برای این بخش وجود ندارد."}
            </p>
          )}
        </div>
      </div>
      <div className="trade-list-main">
        <div
          className="trade-list-summaries"
          aria-label="جمع فاکتورهای نمایش‌داده‌شده"
        >
          {(
            [
              {
                key: "total",
                label: isBuy ? "مجموع کل خریدها" : "کل فروش",
                tone: isBuy ? "blue" : "green",
              },
              {
                key: "paid",
                label: isBuy ? "مجموع پرداختی" : "دریافتی",
                tone: "green",
              },
              {
                key: "balance",
                label: isBuy ? "مجموع باقیمانده" : "باقیمانده",
                tone: "red",
              },
            ] as const
          ).map((metric) => (
            <div
              key={metric.key}
              className={`trade-list-summary is-${metric.tone}`}
            >
              <strong>{metric.label}</strong>
              <div>
                {currencyCodes.map((code) => (
                  <bdi key={code}>
                    {code} {formatDashboardAmount(amounts[code][metric.key], 2)}
                  </bdi>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="trade-list-table-scroll">
          <table className="trade-list-table">
            <colgroup>
              {widths.map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((invoice) => {
                const item = tradeItemSummary(invoice.items);
                const remaining = invoice.balanceAmount;
                return (
                  <tr key={invoice.id}>
                    <td>
                      <button
                        type="button"
                        className="trade-invoice-number"
                        onClick={() => onViewInvoice(invoice.id)}
                        aria-label={`مشاهده فاکتور #${invoice.invoiceNumber}`}
                      >
                        <bdi>#{invoice.invoiceNumber}</bdi>
                      </button>
                    </td>
                    <td
                      className="trade-list-party-name"
                      title={invoice.partyName}
                    >
                      {invoice.partyName}
                    </td>
                    <td
                      className="trade-list-deal"
                      title={invoice.dealTypeLabel || invoice.dealType}
                    >
                      {/امانی|consignment/i.test(invoice.dealType || "")
                        ? "امانی"
                        : /پیش|pre_order/i.test(invoice.dealType || "")
                          ? isBuy
                            ? "پیش خرید"
                            : "پیش فروش"
                          : isBuy
                            ? "خرید قطعی"
                            : "فروش قطعی"}
                    </td>
                    <td
                      title={invoice.items
                        .map((item) => item.productName)
                        .join("، ")}
                    >
                      {item.name}
                    </td>
                    <td className="trade-list-quantity">
                      <bdi>
                        {item.quantity === null
                          ? "—"
                          : formatDashboardAmount(item.quantity, 6)}
                      </bdi>
                      {isBuy && item.unit && (
                        <small>
                          {item.unit === "ton"
                            ? "تن (KG 1000)"
                            : `کیسه${invoice.items.length === 1 && invoice.items[0].bagsCount > 0 && invoice.items[0].tonsCount > 0 ? ` (KG ${formatDashboardAmount((invoice.items[0].tonsCount * 1000) / invoice.items[0].bagsCount, 2)})` : ""}`}
                        </small>
                      )}
                    </td>
                    <td>
                      <bdi className="trade-list-money">
                        {invoice.currency}{" "}
                        {formatDashboardAmount(invoice.totalAmount, 6)}
                      </bdi>
                    </td>
                    {isBuy && (
                      <>
                        <td>
                          <bdi className="trade-list-money is-paid">
                            {invoice.currency}{" "}
                            {formatDashboardAmount(invoice.paidAmount, 6)}
                          </bdi>
                        </td>
                        <td>
                          <bdi className="trade-list-money is-balance">
                            {invoice.currency}{" "}
                            {formatDashboardAmount(remaining, 6)}
                          </bdi>
                        </td>
                      </>
                    )}
                    <td>
                      <bdi className="trade-list-date">
                        {normalizePersianDate(invoice.date)}
                      </bdi>
                    </td>
                    <td>
                      <span
                        className={`trade-payment-badge ${remaining <= 0 ? "is-settled" : "is-due"}`}
                      >
                        {remaining <= 0 ? "تسویه" : "بدهکار"}
                      </span>
                    </td>
                    <td>
                      <div className="trade-row-actions">
                        <button
                          type="button"
                          className="is-edit"
                          onClick={() => onEditInvoice(invoice)}
                          aria-label={`ویرایش فاکتور #${invoice.invoiceNumber}`}
                          title="ویرایش"
                        >
                          <Pencil />
                        </button>
                        <button
                          type="button"
                          className="is-print"
                          onClick={() =>
                            openPrintModal({ type: "invoice", invoice })
                          }
                          aria-label={`چاپ فاکتور #${invoice.invoiceNumber}`}
                          title="چاپ"
                        >
                          <Printer />
                        </button>
                        <button
                          type="button"
                          className="is-delete"
                          onClick={() => setDeleting(invoice)}
                          disabled={!canDelete}
                          aria-label={`حذف فاکتور #${invoice.invoiceNumber}`}
                          title={canDelete ? "حذف" : "دسترسی حذف ندارید"}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length && (
            <div className="trade-list-empty">
              <FileText />
              <p>
                {query || selectedPartyId
                  ? "فاکتوری مطابق این فیلتر پیدا نشد."
                  : `هنوز فاکتور ${isBuy ? "خرید" : "فروش"} ثبت نشده است.`}
              </p>
              {!query && !selectedPartyId && (
                <button type="button" onClick={onCreate}>
                  ثبت اولین فاکتور
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {deleting && (
        <WorkspaceDialog
          title={`حذف فاکتور #${deleting.invoiceNumber}`}
          onClose={() => setDeleting(null)}
        >
          <div className="trade-delete-confirmation">
            <p>
              فاکتور {isBuy ? "خرید" : "فروش"} مربوط به «{deleting.partyName}»
              حذف شود؟
            </p>
            <p>
              موجودی کالا، ماندهٔ حساب شخص و پرداخت پیوسته به این فاکتور نیز
              بازگردانی می‌شود. این کار قابل برگشت نیست.
            </p>
            <div>
              <button type="button" onClick={() => setDeleting(null)}>
                انصراف
              </button>
              <button
                type="button"
                className="is-danger"
                disabled={!canDelete}
                onClick={() => {
                  if (!canDelete) return;
                  deleteInvoice(deleting.id);
                  setDeleting(null);
                }}
              >
                حذف فاکتور
              </button>
            </div>
          </div>
        </WorkspaceDialog>
      )}
    </div>
  );
};

import { usePageReport } from './PageActionsToolbar';
import { tableReport } from '../utils/reportData';
import {
  ownedCompanyCashSource,
  projectCompanyCashTransactions,
} from "../utils/companyCash";
import { CompanyCashDocumentForm } from "./CompanyCashDocumentForm";
import type { ExpenseItem, IncomeItem } from "../types";
import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  FileText,
  Filter,
  Pencil,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useAccounting } from "../context/AccountingContext";
import type { FinancialTransaction } from "../types";
import { WorkspaceDialog } from "./WorkspaceShell";
import { ReferenceTreasuryForm } from "./ReferenceTreasuryForm";
import { EditInvoiceModal } from "./EditInvoiceModal";
import { ShamsiDatePickerModal } from "./ShamsiDatePickerModal";
import { formatDashboardAmount, parseDashboardDate } from "../utils/dashboard";
import { parseTradeNumber, tradeShamsiDate } from "../utils/tradeInvoices";
import {
  treasuryCategory,
  treasuryEntries,
  treasuryEntryCash,
  treasurySearchMatch,
  type TreasuryDirection,
} from "../utils/treasury";

export const ReferenceTreasuryList: React.FC<{
  direction: TreasuryDirection;
  onNew: () => void;
}> = ({ direction, onNew }) => {
  const {
    transactions: storedTransactions,
    incomes,
    expenses,
    parties,
    partyGroups,
    cashAccounts,
    invoices,
    deleteTransaction,
    openPrintModal,
  } = useAccounting();
  const transactions = useMemo(
    () => projectCompanyCashTransactions(storedTransactions, incomes, expenses),
    [storedTransactions, incomes, expenses],
  );
  const receive = direction === "receipt";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [groupId, setGroupId] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [datePicker, setDatePicker] = useState<"start" | "end" | null>(null);
  const [currency, setCurrency] = useState("all");
  const [cashId, setCashId] = useState("all");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      treasuryEntries(transactions, direction).filter((tx) => {
        const cash = treasuryEntryCash(tx, direction, cashAccounts);
        const party = parties.find((item) => item.id === tx.partyId);
        const date = parseDashboardDate(tx.date)?.getTime();
        if (category !== "all" && treasuryCategory(tx) !== category)
          return false;
        if (groupId !== "all" && party?.groupId !== groupId) return false;
        if (currency !== "all" && cash.currency !== currency) return false;
        if (cashId !== "all" && cash.accountId !== cashId) return false;
        if (
          start &&
          (!date || date < (parseDashboardDate(start)?.getTime() || 0))
        )
          return false;
        if (
          end &&
          (!date || date > (parseDashboardDate(end)?.getTime() || Infinity))
        )
          return false;
        if (min && cash.amount < parseTradeNumber(min)) return false;
        if (max && cash.amount > parseTradeNumber(max)) return false;
        return treasurySearchMatch(tx, search, cash.accountName);
      }),
    [
      transactions,
      direction,
      cashAccounts,
      parties,
      category,
      groupId,
      currency,
      cashId,
      start,
      end,
      min,
      max,
      search,
    ],
  );
  const totals = useMemo(
    () =>
      Object.fromEntries(
        [
          ...new Set(
            rows.map(
              (tx) => treasuryEntryCash(tx, direction, cashAccounts).currency,
            ),
          ),
        ].map((code) => [
          code,
          rows.reduce((total, tx) => {
            const cash = treasuryEntryCash(tx, direction, cashAccounts);
            return total + (cash.currency === code ? cash.amount : 0);
          }, 0),
        ]),
      ),
    [rows, direction, cashAccounts],
  );
  const filters = [
    ["all", "همه"],
    ["invoice", "تسویه فاکتور"],
    ["personal", receive ? "دریافت شخصی" : "پرداخت شخصی"],
    [receive ? "income" : "expense", receive ? "عواید شرکت" : "هزینه‌های شرکت"],
    ["refund", receive ? "دریافت‌های برگشتی" : "پرداخت‌های برگشتی"],
    ["discount", "تخفیف‌دار"],
  ] as const;
  const deleted = transactions.find((tx) => tx.id === deleteId);
  const print = (tx: FinancialTransaction) => {
    const source = ownedCompanyCashSource(tx, incomes, expenses);
    if (source?.kind === "income")
      openPrintModal({ type: "income", income: source.document as IncomeItem });
    else if (source?.kind === "expense")
      openPrintModal({
        type: "expense",
        expense: source.document as ExpenseItem,
      });
    else openPrintModal({ type: "transaction", transaction: tx });
  };
  const editingSource = editing
    ? ownedCompanyCashSource(editing, incomes, expenses)
    : undefined;
  const printReport = () =>
    openPrintModal({
      type: "report",
      title: receive ? "گزارش دریافت‌ها" : "گزارش پرداخت‌ها",
      subtitle: `تعداد اسناد: ${rows.length}`,
      customContent: (
        <table>
          <thead>
            <tr>
              <th>شماره سند</th>
              <th>تاریخ</th>
              <th>شخص</th>
              <th>شرح</th>
              <th>مبلغ نقدی</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => {
              const cash = treasuryEntryCash(tx, direction, cashAccounts);
              return (
                <tr key={tx.id}>
                  <td>{tx.transactionNumber}</td>
                  <td>{tx.date}</td>
                  <td>{tx.partyName || "—"}</td>
                  <td>{tx.description}</td>
                  <td>
                    {formatDashboardAmount(cash.amount, 6)} {cash.currency}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ),
    });
  usePageReport({
    title: receive ? 'لیست دریافت‌ها' : 'لیست پرداخت‌ها', onCreate: onNew, createLabel: receive ? 'ایجاد دریافت جدید' : 'ایجاد پرداخت جدید',
    search: { value: search, onChange: setSearch, label: 'جستجوی اسناد خزانه', placeholder: 'جستجوی سریع...' },
    filters: [
      { id: 'category', label: 'نوع سند', value: category, onChange: setCategory, options: filters.map(([value, label]) => ({ value, label })) },
      { id: 'group', label: 'گروه طرف حساب', value: groupId, onChange: setGroupId, options: [{ value: 'all', label: 'همه گروه‌ها' }, ...partyGroups.map(group => ({ value: group.id, label: group.name }))] },
      { id: 'cash', label: 'صندوق / بانک', value: cashId, onChange: setCashId, options: [{ value: 'all', label: 'همه صندوق‌ها' }, ...cashAccounts.map(account => ({ value: account.id, label: account.name }))] },
      { id: 'currency', label: 'ارز', value: currency, onChange: setCurrency, options: [{ value: 'all', label: 'همه ارزها' }, ...[...new Set(cashAccounts.map(account => account.currency))].map(value => ({ value, label: value }))] },
      { id: 'from', kind: 'date', label: 'از تاریخ', value: start, onChange: setStart, placeholder: '۱۴۰۵/۰۱/۰۱' },
      { id: 'to', kind: 'date', label: 'تا تاریخ', value: end, onChange: setEnd, placeholder: '۱۴۰۵/۱۲/۳۰' },
      { id: 'min', kind: 'amount', label: 'کمترین مبلغ', value: min, onChange: setMin },
      { id: 'max', kind: 'amount', label: 'بیشترین مبلغ', value: max, onChange: setMax },
    ],
    getReport: () => tableReport(receive ? 'گزارش دریافت‌ها' : 'گزارش پرداخت‌ها',
      ['شماره سند', 'تاریخ', 'طرف حساب', 'شرح', 'صندوق / بانک', 'مبلغ نقدی', 'ارز', 'تخفیف', 'ارز تخفیف', 'توسط (یوزر)', 'مانده طرف حساب', 'ارز مانده', 'نوع مانده'],
      rows.map(tx => {
        const cash = treasuryEntryCash(tx, direction, cashAccounts);
        const party = parties.find(party => party.id === tx.partyId);
        const historical = typeof tx.partyBalanceAfter === 'number';
        const balance = historical ? tx.partyBalanceAfter : party ? tx.currency === 'AFN' ? party.balanceAFN : party.balanceUSD : null;
        return [tx.transactionNumber, tx.date, tx.partyName || party?.name, tx.description, cash.accountName, cash.amount, cash.currency, tx.discountAmount, tx.currency, tx.createdByName, balance, tx.currency, historical ? 'پس از ثبت سند' : party ? 'کنونی' : ''];
      }),
      Object.entries(totals).map(([code, total]) => ['جمع نقدی', '', '', '', '', total, code, '', '', '', '', '', ''])),
  });

  return (
    <div className={`treasury-list ${receive ? "is-receipt" : "is-payment"}`}>
      <div className="treasury-list-toolbar">
        <div className="treasury-list-categories">
          {filters.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={category === key ? "is-active" : ""}
              onClick={() => setCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="treasury-list-filters">
          <span>
            <CalendarDays />
            از تاریخ:
          </span>
          <button
            type="button"
            onClick={() => setDatePicker("start")}
            aria-label="تاریخ شروع اسناد"
          >
            {start || "همه تاریخ‌ها"}
            <CalendarDays />
          </button>
          <span>تا:</span>
          <button
            type="button"
            onClick={() => setDatePicker("end")}
            aria-label="تاریخ پایان اسناد"
          >
            {end || "همه تاریخ‌ها"}
            <CalendarDays />
          </button>
          <select
            aria-label="گروه طرف حساب اسناد"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
          >
            <option value="all">همه گروه‌های طرف حساب</option>
            {partyGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="treasury-table-scroll">
        <table className="treasury-table">
          <thead>
            <tr>
              <th>شماره سند</th>
              <th>تاریخ ثبت</th>
              <th>صندوق / بانک {receive ? "مقصد" : "مبدأ"}</th>
              <th>{receive ? "پرداخت‌کننده" : "دریافت‌کننده"} (شخص)</th>
              <th>توسط (یوزر)</th>
              <th>شرح بابت معامله</th>
              <th>مبلغ {receive ? "دریافتی" : "پرداختی"}</th>
              <th>ماندهٔ لحظه‌ای</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => {
              const cash = treasuryEntryCash(tx, direction, cashAccounts);
              const liveParty = parties.find(
                (party) => party.id === tx.partyId,
              );
              const balance =
                typeof tx.partyBalanceAfter === "number"
                  ? tx.partyBalanceAfter
                  : liveParty
                    ? tx.currency === "AFN"
                      ? liveParty.balanceAFN
                      : liveParty.balanceUSD
                    : null;
              return (
                <tr key={tx.id}>
                  <td>
                    <bdi>#{tx.transactionNumber}</bdi>
                  </td>
                  <td>
                    <bdi>{tradeShamsiDate(tx.date)}</bdi>
                  </td>
                  <td>
                    {cash.accountName} <small>{cash.currency}</small>
                  </td>
                  <td>
                    <strong>{tx.partyName || liveParty?.name || "—"}</strong>
                  </td>
                  <td>
                    <span className="treasury-user-badge">
                      {tx.createdByName || "—"}
                    </span>
                  </td>
                  <td className="treasury-description-cell">
                    {tx.description}
                  </td>
                  <td className="treasury-list-amount">
                    <bdi>
                      {cash.currency} {formatDashboardAmount(cash.amount, 6)}
                    </bdi>
                  </td>
                  <td>
                    <bdi>
                      {balance === null
                        ? "—"
                        : `${tx.currency} ${formatDashboardAmount(balance, 6)}`}
                    </bdi>
                    {typeof tx.partyBalanceAfter !== "number" && liveParty && (
                      <small title="این سند قدیمی ماندهٔ تاریخی ثبت نکرده؛ ماندهٔ کنونی شخص نشان داده می‌شود.">
                        کنونی
                      </small>
                    )}
                  </td>
                  <td>
                    <div className="treasury-row-actions">
                      <button
                        type="button"
                        className="is-edit"
                        aria-label={`ویرایش سند #${tx.transactionNumber}`}
                        onClick={() =>
                          tx.invoiceId &&
                          tx.id === "tx-inv-" + tx.invoiceId &&
                          invoices.some(
                            (invoice) => invoice.id === tx.invoiceId,
                          )
                            ? setLinkedInvoice(tx.invoiceId)
                            : setEditing(tx)
                        }
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        className="is-print"
                        aria-label={`چاپ سند #${tx.transactionNumber}`}
                        onClick={() => print(tx)}
                      >
                        <Printer />
                      </button>
                      <button
                        type="button"
                        className="is-delete"
                        aria-label={`حذف سند #${tx.transactionNumber}`}
                        onClick={() => setDeleteId(tx.id)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="treasury-empty">
                  <FileText />
                  <p>
                    {search || category !== "all"
                      ? "سندی مطابق فیلترها پیدا نشد."
                      : `هنوز سند ${receive ? "دریافت" : "پرداخت"} ثبت نشده است.`}
                  </p>
                  <button type="button" onClick={onNew}>
                    ثبت اولین سند
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="treasury-list-bottom">
        <details className="treasury-advanced-filters">
          <summary>
            <Filter />
            فیلترهای بیشتر و گزارش
          </summary>
          <div>
            <button
              type="button"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
            >
              همهٔ تاریخ‌ها
            </button>
            {[1, 7, 30].map((days) => (
              <button
                type="button"
                key={days}
                onClick={() => {
                  setEnd(
                    tradeShamsiDate(new Date().toISOString().slice(0, 10)),
                  );
                  setStart(
                    tradeShamsiDate(
                      new Date(Date.now() - (days - 1) * 86400000)
                        .toISOString()
                        .slice(0, 10),
                    ),
                  );
                }}
              >
                {days === 1 ? "امروز" : `${days} روز اخیر`}
              </button>
            ))}
            <select
              aria-label="ارز اسناد خزانه"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option value="all">همه ارزها</option>
              {[
                ...new Set(cashAccounts.map((account) => account.currency)),
              ].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
            <select
              aria-label="صندوق اسناد خزانه"
              value={cashId}
              onChange={(event) => setCashId(event.target.value)}
            >
              <option value="all">همه صندوق‌ها</option>
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <input
              aria-label="حداقل مبلغ سند"
              placeholder="حداقل مبلغ"
              value={min}
              onChange={(event) => setMin(event.target.value)}
            />
            <input
              aria-label="حداکثر مبلغ سند"
              placeholder="حداکثر مبلغ"
              value={max}
              onChange={(event) => setMax(event.target.value)}
            />
            <button type="button" onClick={printReport}>
              <Printer />
              چاپ گزارش
            </button>
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setGroupId("all");
                setStart("");
                setEnd("");
                setSearch("");
                setCurrency("all");
                setCashId("all");
                setMin("");
                setMax("");
              }}
            >
              پاک کردن فیلترها
            </button>
          </div>
        </details>
        <span>
          تعداد: {rows.length}
          {Object.entries(totals).map(([code, amount]) => (
            <bdi key={code}>
              {" "}
              · {code} {formatDashboardAmount(amount, 6)}
            </bdi>
          ))}
        </span>
      </div>
      {editing && (
        <WorkspaceDialog
          title={`ویرایش سند #${editing.transactionNumber}`}
          onClose={() => setEditing(null)}
        >
          {editingSource ? (
            <CompanyCashDocumentForm
              source={editingSource}
              onSaved={() => setEditing(null)}
            />
          ) : (
            <ReferenceTreasuryForm
              direction={
                editing.type === "receive_payment" ? "receipt" : "payment"
              }
              transaction={editing}
              onSaved={() => setEditing(null)}
            />
          )}
        </WorkspaceDialog>
      )}
      {deleted && (
        <WorkspaceDialog title="حذف سند مالی" onClose={() => setDeleteId(null)}>
          <p>
            سند #{deleted.transactionNumber} حذف شود؟{" "}
            {ownedCompanyCashSource(deleted, incomes, expenses)
              ? "سند اصلی عاید/هزینه نیز حذف و اثر آن بر همان صندوق برگردانده می‌شود."
              : "اثر آن بر صندوق و حساب شخص به حالت قبل برمی‌گردد."}
            {deleted.invoiceId && " پرداخت فاکتور مرتبط نیز اصلاح خواهد شد."}
          </p>
          <div className="workspace-dialog-actions">
            <button type="button" onClick={() => setDeleteId(null)}>
              انصراف
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                deleteTransaction(deleted.id);
                setDeleteId(null);
              }}
            >
              تأیید حذف سند
            </button>
          </div>
        </WorkspaceDialog>
      )}
      <EditInvoiceModal
        isOpen={Boolean(linkedInvoice)}
        invoice={
          invoices.find((invoice) => invoice.id === linkedInvoice) || null
        }
        onClose={() => setLinkedInvoice(null)}
      />
      <ShamsiDatePickerModal
        isOpen={datePicker !== null}
        value={datePicker === "start" ? start || undefined : end || undefined}
        onChange={(value) =>
          datePicker === "start" ? setStart(value) : setEnd(value)
        }
        onClose={() => setDatePicker(null)}
        colorTheme={receive ? "emerald" : "blue"}
      />
    </div>
  );
};

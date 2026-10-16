import React, { useRef, useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import type { ExpenseItem, IncomeItem } from '../types';
import {
  companyCashAccountId,
  companyCashNumber,
  type CompanyCashSource,
} from '../utils/companyCash';
import { parseTradeNumber } from '../utils/tradeInvoices';
import { ShamsiDatePickerInput } from './ShamsiDatePickerInput';

/** Editing the source document, not an independent copy of its cash transaction. */
export const CompanyCashDocumentForm: React.FC<{
  source: CompanyCashSource;
  onSaved: () => void;
}> = ({ source, onSaved }) => {
  const {
    cashAccounts,
    incomeCategories,
    expenseCategories,
    updateIncome,
    updateExpense,
  } = useAccounting();
  const income = source.kind === 'income';
  const document = source.document;
  const [number, setNumber] = useState(
    companyCashNumber(source.kind, document),
  );
  const [title, setTitle] = useState(document.title);
  const [date, setDate] = useState(document.date);
  const [amount, setAmount] = useState(String(document.amount));
  const [accountId, setAccountId] = useState(companyCashAccountId(document));
  const [categoryId, setCategoryId] = useState(document.categoryId);
  const [partyName, setPartyName] = useState(
    income
      ? (document as IncomeItem).payer || ''
      : (document as ExpenseItem).recipient ||
          (document as ExpenseItem).payee ||
          '',
  );
  const [notes, setNotes] = useState(document.notes || '');
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const account = cashAccounts.find((account) => account.id === accountId);
  const categories = income ? incomeCategories : expenseCategories;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (submitting.current) return;
    setError('');
    if (!number.trim() || !account) {
      setError('شمارهٔ سند و صندوق معتبر را انتخاب کنید.');
      return;
    }
    const value = parseTradeNumber(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('مبلغ باید بیشتر از صفر باشد.');
      return;
    }
    const available =
      account.balance +
      (!income && companyCashAccountId(document) === accountId
        ? document.amount
        : 0);
    if (
      !income &&
      value > available &&
      !window.confirm('این پرداخت موجودی صندوق را منفی می‌کند. ادامه می‌دهید؟')
    )
      return;
    submitting.current = true;
    try {
      const data = {
        title: title.trim(),
        date,
        amount: value,
        currency: account.currency,
        cashRegisterId: accountId,
        categoryId,
        categoryName:
          categories.find((category) => category.id === categoryId)?.name ||
          document.categoryName,
        notes: notes.trim() || undefined,
      };
      if (income)
        updateIncome(document.id, {
          ...data,
          incomeNumber: number.trim(),
          payer: partyName.trim() || undefined,
        });
      else
        updateExpense(document.id, {
          ...data,
          expenseNumber: number.trim(),
          recipient: partyName.trim() || undefined,
          payee: partyName.trim() || undefined,
        });
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'ذخیرهٔ سند انجام نشد.',
      );
    } finally {
      submitting.current = false;
    }
  };
  return (
    <form
      onSubmit={submit}
      className="company-cash-document-form"
      data-company-cash-edit={source.kind}
    >
      <p className="company-cash-hint">
        ویرایش سند اصلی {income ? 'عاید' : 'هزینه'}؛ صندوق و لیست‌های مربوط
        همزمان اصلاح می‌شوند. مبلغ زیر به ارز صندوق است.
      </p>
      {error && (
        <p role="alert" className="company-cash-error">
          {error}
        </p>
      )}
      <div className="company-cash-fields">
        <label>
          شمارهٔ سند
          <input
            aria-label="شمارهٔ سند اصلی"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            required
          />
        </label>
        <label>
          تاریخ سند
          <ShamsiDatePickerInput
            id="company-cash-edit-date"
            value={date}
            onChange={setDate}
            className="w-full"
          />
        </label>
        <label>
          عنوان / بابت
          <input
            aria-label="عنوان سند اصلی"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label>
          {income ? 'پرداخت‌کننده' : 'دریافت‌کننده'}
          <input
            aria-label="شخص سند اصلی"
            value={partyName}
            onChange={(event) => setPartyName(event.target.value)}
          />
        </label>
        <label>
          صندوق / بانک
          <select
            aria-label="صندوق سند اصلی"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            required
          >
            <option value="" disabled>
              انتخاب صندوق
            </option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          مبلغ واقعی صندوق ({account?.currency || '—'})
          <input
            aria-label="مبلغ سند اصلی"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            dir="ltr"
            required
          />
        </label>
        <label>
          دسته‌بندی
          <select
            aria-label="دسته‌بندی سند اصلی"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">متفرقه / عمومی</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="company-cash-notes">
          یادداشت
          <textarea
            aria-label="یادداشت سند اصلی"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
        </label>
      </div>
      <div className="workspace-dialog-actions">
        <button className="treasury-submit" type="submit">
          ذخیرهٔ اصلاحات سند و صندوق
        </button>
      </div>
    </form>
  );
};

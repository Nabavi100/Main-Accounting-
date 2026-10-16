import React from 'react';
import type { CompanySettings, IncomeItem } from '../../types';
import { formatDashboardAmount } from '../../utils/dashboard';

export const PrintIncomeReceipt: React.FC<{
  income: IncomeItem;
  companySettings: CompanySettings;
  showSignatures?: boolean;
}> = ({ income, companySettings, showSignatures = true }) => (
  <div
    className="relative z-10 space-y-4 text-slate-900 printable-content"
    dir="rtl"
  >
    <header className="p-4 rounded-xl border-2 border-emerald-600 bg-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {companySettings.logoUrl ? (
          <img
            src={companySettings.logoUrl}
            alt={companySettings.name}
            className="w-14 h-14 object-contain"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-2xl font-black">
            {companySettings.logoIconText || 'ن'}
          </div>
        )}
        <div>
          <h1 className="text-base font-black">{companySettings.name}</h1>
          <p className="text-xs mt-1">سند رسمی دریافت عواید و واریز به صندوق</p>
        </div>
      </div>
      <div className="text-xs space-y-2 text-left">
        <strong>
          رسید عاید #{income.incomeNumber || income.receiptNumber || income.id}
        </strong>
        <p>
          {income.date}
          {income.issueTime ? ` • ${income.issueTime}` : ''}
        </p>
      </div>
    </header>
    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-300 text-xs">
      <div>
        <span className="block text-slate-500 mb-1">عنوان / بابت عاید</span>
        <strong>{income.title}</strong>
      </div>
      <div>
        <span className="block text-slate-500 mb-1">دسته‌بندی عاید</span>
        <strong>{income.categoryName || 'عواید متفرقه'}</strong>
      </div>
      <div>
        <span className="block text-slate-500 mb-1">پرداخت‌کننده</span>
        <strong>{income.payer || 'متفرقه'}</strong>
      </div>
      <div>
        <span className="block text-slate-500 mb-1">صندوق / بانک مقصد</span>
        <strong>
          {income.cashRegisterName ||
            (income.cashRegisterId === 'usd_cash' ||
            (!income.cashRegisterId && income.currency === 'USD')
              ? 'صندوق دالری شرکت'
              : income.cashRegisterId === 'afn_cash' ||
                  (!income.cashRegisterId && income.currency === 'AFN')
                ? 'صندوق افغانی شرکت'
                : income.cashRegisterId || '—')}
        </strong>
      </div>
      {income.quantity !== undefined && (
        <div>
          تعداد: <bdi>{formatDashboardAmount(income.quantity, 6)}</bdi>
        </div>
      )}
      {income.unitPrice !== undefined && (
        <div>
          فی واحد: <bdi>{formatDashboardAmount(income.unitPrice, 6)}</bdi>
        </div>
      )}
    </div>
    <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 flex justify-between gap-3 text-sm">
      <strong>مبلغ واقعی واریز به صندوق</strong>
      <bdi className="font-black">
        {formatDashboardAmount(income.amount, 6)} {income.currency}
      </bdi>
    </div>
    {income.notes && (
      <section className="p-4 border border-slate-200 rounded-xl text-xs leading-relaxed whitespace-pre-wrap">
        <strong className="block mb-2">شرح و یادداشت</strong>
        {income.notes}
      </section>
    )}
    {income.createdByName && (
      <p className="text-xs">ثبت‌کننده: {income.createdByName}</p>
    )}
    {showSignatures && (
      <footer className="grid grid-cols-3 gap-4 pt-8 text-center text-xs">
        <div className="border-t border-dashed border-slate-400 pt-2">
          امضای پرداخت‌کننده
        </div>
        <div className="border-t border-dashed border-slate-400 pt-2">
          امضای مسئول صندوق
        </div>
        <div className="border-t border-dashed border-slate-400 pt-2">
          تأیید مدیریت {companySettings.name}
        </div>
      </footer>
    )}
  </div>
);

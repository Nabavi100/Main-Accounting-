import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { ReceiptCreateView } from './ReceiptCreateView';
import { ReceiptsListView } from './ReceiptsListView';
import { PaymentCreateView } from './PaymentCreateView';
import { PaymentsListView } from './PaymentsListView';
import { CashToCashTransferView } from './CashToCashTransferView';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ListOrdered,
  PlusCircle,
  Wallet,
  Coins,
  History,
} from 'lucide-react';

export type ReceiptPaymentSubTab =
  | 'create_receipt'
  | 'list_receipts'
  | 'create_payment'
  | 'list_payments'
  | 'cash_transfer';

interface ReceiptPaymentHubViewProps {
  initialTab?: ReceiptPaymentSubTab;
  initialPartyId?: string;
  onViewInvoice?: (id: string) => void;
}

export const ReceiptPaymentHubView: React.FC<ReceiptPaymentHubViewProps> = ({
  initialTab = 'list_receipts',
  initialPartyId,
  onViewInvoice,
}) => {
  const { transactions } = useAccounting();

  // Active sub-tab among the 4 requested actions:
  // 1. 'create_receipt' (دریافت)
  // 2. 'list_receipts' (لیست دریافتی‌ها)
  // 3. 'create_payment' (پرداخت)
  // 4. 'list_payments' (لیست پرداختی‌ها)
  const [activeTab, setActiveTab] = useState<ReceiptPaymentSubTab>(initialTab);
  const [partyId, setPartyId] = useState<string | undefined>(initialPartyId);

  // Quick metrics
  const receiptsCount = transactions.filter(t => t.type === 'receive_payment').length;
  const paymentsCount = transactions.filter(t => t.type === 'make_payment').length;
  const cashTransfersCount = transactions.filter(t => t.type === 'cash_transfer').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto font-sans" dir="rtl">
      {/* ========================================================================= */}
      {/* TOP HEADER: 5 MAIN BUTTONS (دریافت • لیست دریافتی‌ها • پرداخت • لیست پرداختی‌ها • صندوق به صندوق) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-blue-600 block uppercase tracking-wider">
              مدیریت بازرگانی و مالی • بخش دریافت و پرداخت و انتقالات نقدی
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
              مدیریت دریافت، پرداخت و عملیه صندوق به صندوق
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>تعداد کل اسناد مالی:</span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
              {receiptsCount + paymentsCount + cashTransfersCount} سند
            </span>
          </div>
        </div>

        {/* 5 PRIMARY NAVIGATION BUTTONS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3 pt-4">
          {/* 1. دکمه دریافت */}
          <button
            type="button"
            id="hub-btn-create-receipt"
            onClick={() => setActiveTab('create_receipt')}
            className={`flex flex-col sm:flex-row items-center sm:items-start justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-right group ${
              activeTab === 'create_receipt'
                ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-emerald-50/30 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                  activeTab === 'create_receipt'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-600 border border-slate-200 group-hover:bg-emerald-600 group-hover:text-white'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-900 block">
                  دریافت (ثبت رسید جدید)
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ورود وجه نقدی یا بانکی به صندوق
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 mt-2 sm:mt-0 rounded-full text-[10px] font-bold ${
                activeTab === 'create_receipt'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              + ثبت جدید
            </span>
          </button>

          {/* 2. دکمه لیست دریافتی‌ها */}
          <button
            type="button"
            id="hub-btn-list-receipts"
            onClick={() => setActiveTab('list_receipts')}
            className={`flex flex-col sm:flex-row items-center sm:items-start justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-right group ${
              activeTab === 'list_receipts'
                ? 'bg-emerald-50/90 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-emerald-50/30 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                  activeTab === 'list_receipts'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-600 border border-slate-200 group-hover:bg-emerald-600 group-hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-900 block">
                  لیست دریافتی‌ها
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  فهرست کلیه اسناد دریافتی مشتریان
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 mt-2 sm:mt-0 rounded-full text-[10px] font-bold font-mono ${
                activeTab === 'list_receipts'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {receiptsCount} سند
            </span>
          </button>

          {/* 3. دکمه پرداخت */}
          <button
            type="button"
            id="hub-btn-create-payment"
            onClick={() => setActiveTab('create_payment')}
            className={`flex flex-col sm:flex-row items-center sm:items-start justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-right group ${
              activeTab === 'create_payment'
                ? 'bg-rose-50/90 border-rose-500 shadow-xs ring-2 ring-rose-500/20'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-rose-50/30 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                  activeTab === 'create_payment'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-600 border border-slate-200 group-hover:bg-rose-600 group-hover:text-white'
                }`}
              >
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-900 block">
                  پرداخت (ثبت سند جدید)
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  خروج وجه نقدی برای تأمین‌کننده یا هزینه
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 mt-2 sm:mt-0 rounded-full text-[10px] font-bold ${
                activeTab === 'create_payment'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              + ثبت جدید
            </span>
          </button>

          {/* 4. دکمه لیست پرداختی‌ها */}
          <button
            type="button"
            id="hub-btn-list-payments"
            onClick={() => setActiveTab('list_payments')}
            className={`flex flex-col sm:flex-row items-center sm:items-start justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-right group ${
              activeTab === 'list_payments'
                ? 'bg-rose-50/90 border-rose-500 shadow-xs ring-2 ring-rose-500/20'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-rose-50/30 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                  activeTab === 'list_payments'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-600 border border-slate-200 group-hover:bg-rose-600 group-hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-900 block">
                  لیست پرداختی‌ها
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  فهرست کلیه اسناد پرداختی و حواله‌ها
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 mt-2 sm:mt-0 rounded-full text-[10px] font-bold font-mono ${
                activeTab === 'list_payments'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {paymentsCount} سند
            </span>
          </button>

          {/* 5. دکمه عملیه صندوق به صندوق */}
          <button
            type="button"
            id="hub-btn-cash-transfer"
            onClick={() => setActiveTab('cash_transfer')}
            className={`flex flex-col sm:flex-row items-center sm:items-start justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer text-right group ${
              activeTab === 'cash_transfer'
                ? 'bg-amber-50/90 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-amber-50/30 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                  activeTab === 'cash_transfer'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-600 border border-slate-200 group-hover:bg-amber-600 group-hover:text-white'
                }`}
              >
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-900 block">
                  عملیه صندوق به صندوق
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  انتقال وجوه میان صندوق‌ها
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 mt-2 sm:mt-0 rounded-full text-[10px] font-bold font-mono ${
                activeTab === 'cash_transfer'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {cashTransfersCount} سند
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RENDER ACTIVE TAB CONTENT */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-2 sm:p-4 shadow-xs">
        {activeTab === 'create_receipt' && (
          <ReceiptCreateView
            initialPartyId={partyId}
            onBackToList={() => {
              setPartyId(undefined);
              setActiveTab('list_receipts');
            }}
            onCashTransfer={() => setActiveTab('cash_transfer')}
            onViewReceipt={() => setActiveTab('list_receipts')}
            onSwitchTab={(tab) => {
              setPartyId(undefined);
              setActiveTab(tab as any);
            }}
          />
        )}

        {activeTab === 'list_receipts' && (
          <ReceiptsListView
            onNewReceipt={() => {
              setPartyId(undefined);
              setActiveTab('create_receipt');
            }}
            onCashTransfer={() => setActiveTab('cash_transfer')}
            onViewInvoice={onViewInvoice}
          />
        )}

        {activeTab === 'create_payment' && (
          <PaymentCreateView
            initialPartyId={partyId}
            onBackToList={() => {
              setPartyId(undefined);
              setActiveTab('list_payments');
            }}
            onCashTransfer={() => setActiveTab('cash_transfer')}
            onViewPayment={() => setActiveTab('list_payments')}
            onSwitchTab={(tab) => {
              setPartyId(undefined);
              setActiveTab(tab as any);
            }}
          />
        )}

        {activeTab === 'list_payments' && (
          <PaymentsListView
            onNewPayment={() => {
              setPartyId(undefined);
              setActiveTab('create_payment');
            }}
            onCashTransfer={() => setActiveTab('cash_transfer')}
            onViewInvoice={onViewInvoice}
          />
        )}

        {activeTab === 'cash_transfer' && (
          <CashToCashTransferView
            onBackToList={() => setActiveTab('list_receipts')}
          />
        )}
      </div>
    </div>
  );
};

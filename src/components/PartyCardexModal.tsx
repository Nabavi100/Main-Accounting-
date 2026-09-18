import React, { useState, useEffect, useMemo } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Party, PartyLedgerEntry, Currency, Invoice, FinancialTransaction } from '../types';
import { formatNumber, formatCurrency, getPersianDate, isDateInRange, cleanCardexDescription } from '../utils/formatters';
import { EditInvoiceModal } from './EditInvoiceModal';
import { PaymentModal } from './PaymentModal';
import {
  X,
  User,
  Users,
  Building,
  Phone,
  MapPin,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Search,
  Calendar,
  FileText,
  Eye,
  Edit2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ArrowRight,
} from 'lucide-react';

interface PartyCardexModalProps {
  party: Party | null;
  isOpen: boolean;
  onClose: () => void;
  onViewInvoice?: (id: string) => void;
  onOpenPaymentModal?: (type: 'receive_payment' | 'make_payment', partyId: string) => void;
}

export const PartyCardexModal: React.FC<PartyCardexModalProps> = ({
  party,
  isOpen,
  onClose,
  onViewInvoice,
  onOpenPaymentModal,
}) => {
  const { invoices, transactions, openPrintModal } = useAccounting();

  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'AFN' | 'USD'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'invoices' | 'payments'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute full chronological ledger entries for this party
  const { entries, partyInvoices, partyTransactions } = useMemo(() => {
    if (!party) return { entries: [], partyInvoices: [], partyTransactions: [] };

    const matchedInvoices = invoices.filter(i => i.partyId === party.id);
    const matchedTransactions = transactions.filter(t => t.partyId === party.id);

    const list: PartyLedgerEntry[] = [];

    // 1. Invoices
    matchedInvoices.forEach(inv => {
      const isSale = inv.type === 'sell';
      const itemsSummary = inv.items.map(i => `${i.productName} (${formatNumber(i.quantity)} ${i.unit === 'ton' ? 'تن' : 'کیسه'})`).join('، ');

      list.push({
        id: `inv-${inv.id}`,
        date: inv.date,
        time: inv.issueTime,
        type: isSale ? 'invoice_sell' : 'invoice_buy',
        typeLabel: isSale ? 'فاکتور فروش کالا' : 'فاکتور خرید کالا',
        documentNumber: inv.invoiceNumber,
        invoiceId: inv.id,
        description: itemsSummary || inv.notes || 'فاکتور تجارتی',
        currency: inv.currency,
        // In sales: customer owes us (Debit/بدهکار). In purchases: we owe supplier (Credit/بستانکار)
        debit: isSale ? inv.totalAmount : 0,
        credit: !isSale ? inv.totalAmount : 0,
        balanceAFN: 0,
        balanceUSD: 0,
      });

      // If invoice had an upfront cash payment recorded with it
      if (inv.paidAmount > 0) {
        list.push({
          id: `inv-cash-${inv.id}`,
          date: inv.date,
          time: inv.issueTime,
          type: isSale ? 'payment_receive' : 'payment_make',
          typeLabel: isSale ? 'پرداخت نقدی سر فاکتور' : 'پیش‌پرداخت نقدی خرید',
          documentNumber: `نقد-${inv.invoiceNumber}`,
          invoiceId: inv.id,
          description: `تسویه نقدی همزمان با فاکتور #${inv.invoiceNumber}`,
          currency: inv.currency,
          // When customer pays cash upfront, they credit their account
          debit: !isSale ? inv.paidAmount : 0,
          credit: isSale ? inv.paidAmount : 0,
          balanceAFN: 0,
          balanceUSD: 0,
        });
      }
    });

    // 2. Financial Transactions (Payments / Receipts / Exchange)
    // Exclude automatic invoice transactions to prevent double counting with upfront cash above
    matchedTransactions
      .filter(tx => !tx.invoiceId && !tx.id.startsWith('tx-inv-'))
      .forEach(tx => {
      const isReceive = tx.type === 'receive_payment';
      list.push({
        id: `tx-${tx.id}`,
        date: tx.date,
        time: tx.issueTime,
        type: isReceive ? 'payment_receive' : 'payment_make',
        typeLabel: isReceive ? 'رسید دریافت وجه (صندوق)' : 'سند پرداخت وجه (صندوق)',
        documentNumber: tx.transactionNumber,
        transactionId: tx.id,
        description: tx.description || (isReceive ? 'دریافت نقدی از مشتری' : 'پرداخت نقدی به فروشنده'),
        currency: tx.currency,
        // When customer gives us money, they get credited (بستانکار). When we pay them, they get debited (بدهکار)
        debit: !isReceive ? tx.amount : 0,
        credit: isReceive ? tx.amount : 0,
        balanceAFN: 0,
        balanceUSD: 0,
      });
    });

    // Sort chronologically ascending
    list.sort((a, b) => {
      const dateA = `${a.date} ${a.time || '00:00'}`;
      const dateB = `${b.date} ${b.time || '00:00'}`;
      return dateA.localeCompare(dateB);
    });

    // Calculate total net debt from all current entries
    let recordedDebtAFN = 0;
    let recordedDebtUSD = 0;
    list.forEach(entry => {
      const net = entry.debit - entry.credit;
      if (entry.currency === 'AFN') recordedDebtAFN += net;
      else recordedDebtUSD += net;
    });

    // Opening balance difference (if party balance was initialized before or directly set)
    // Note: in party.balanceAFN, negative means debtor to us (+debt), positive means creditor to us (-debt)
    const expectedFinalDebtAFN = -party.balanceAFN;
    const openingDebtAFN = expectedFinalDebtAFN - recordedDebtAFN;

    const expectedFinalDebtUSD = -party.balanceUSD;
    const openingDebtUSD = expectedFinalDebtUSD - recordedDebtUSD;

    const openingEntries: PartyLedgerEntry[] = [];
    if (Math.abs(openingDebtAFN) > 0.01) {
      openingEntries.push({
        id: `opening-afn-${party.id}`,
        date: party.createdAt ? party.createdAt.split('T')[0] : '1403/01/01',
        time: '00:00',
        type: openingDebtAFN > 0 ? 'invoice_sell' : 'payment_receive',
        typeLabel: 'مانده قبلی / افتتاحیه',
        documentNumber: 'افتتاحیه',
        description: openingDebtAFN > 0 ? 'بدهی اولیه حساب قبل از دوره' : 'بستانکاری اولیه حساب قبل از دوره',
        currency: 'AFN',
        debit: openingDebtAFN > 0 ? openingDebtAFN : 0,
        credit: openingDebtAFN < 0 ? Math.abs(openingDebtAFN) : 0,
        balanceAFN: 0,
        balanceUSD: 0,
      });
    }

    if (Math.abs(openingDebtUSD) > 0.01) {
      openingEntries.push({
        id: `opening-usd-${party.id}`,
        date: party.createdAt ? party.createdAt.split('T')[0] : '1403/01/01',
        time: '00:00',
        type: openingDebtUSD > 0 ? 'invoice_sell' : 'payment_receive',
        typeLabel: 'مانده قبلی / افتتاحیه',
        documentNumber: 'افتتاحیه',
        description: openingDebtUSD > 0 ? 'بدهی اولیه دلاری قبل از دوره' : 'بستانکاری اولیه دلاری قبل از دوره',
        currency: 'USD',
        debit: openingDebtUSD > 0 ? openingDebtUSD : 0,
        credit: openingDebtUSD < 0 ? Math.abs(openingDebtUSD) : 0,
        balanceAFN: 0,
        balanceUSD: 0,
      });
    }

    const finalList = [...openingEntries, ...list];

    // Calculate running balance accurately
    let curAFN = 0;
    let curUSD = 0;

    finalList.forEach(entry => {
      const netDelta = entry.debit - entry.credit;
      if (entry.currency === 'AFN') {
        curAFN += netDelta;
      } else {
        curUSD += netDelta;
      }
      entry.balanceAFN = curAFN;
      entry.balanceUSD = curUSD;
    });

    return {
      entries: finalList,
      partyInvoices: matchedInvoices,
      partyTransactions: matchedTransactions,
    };
  }, [party, invoices, transactions]);

  if (!isOpen || !party) return null;

  const filteredEntries = entries.filter(e => {
    if (currencyFilter !== 'all' && e.currency !== currencyFilter) return false;
    if (typeFilter === 'invoices' && !e.type.startsWith('invoice')) return false;
    if (typeFilter === 'payments' && !e.type.startsWith('payment')) return false;

    // Date Range Filter
    if (e.date && e.date !== '---' && !isDateInRange(e.date, fromDate, toDate)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.documentNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.typeLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handlePrintStatement = () => {
    const filteredInvs = partyInvoices.filter(i => isDateInRange(i.date, fromDate, toDate));
    const filteredTrxs = partyTransactions.filter(t => isDateInRange(t.date, fromDate, toDate));
    openPrintModal({
      type: 'party_statement',
      party,
      partyLedgerInvoices: filteredInvs,
      partyLedgerTransactions: filteredTrxs,
      title: `کارتکس و صورت‌حساب دفتر کل: ${party.name}`,
    });
  };

  return (
    <div
      id="party-cardex-modal-backdrop"
      className={`fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 overflow-y-auto ${
        isFullScreen ? 'p-0 flex flex-col' : 'p-2 sm:p-4 md:p-6 flex items-center justify-center'
      }`}
      onClick={e => {
        if (e.target === e.currentTarget && !isFullScreen) onClose();
      }}
    >
      <div
        id="party-cardex-modal-container"
        className={`bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${
          isFullScreen
            ? 'w-full h-full rounded-none border-none max-h-screen'
            : 'rounded-3xl max-w-6xl w-full max-h-[94vh] my-auto'
        }`}
        dir="rtl"
      >
        {/* Header with Navigation & Full-Page Toggle */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl transition border border-white/15 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="بازگشت به لیست اشخاص و گزارشات"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">بازگشت به گزارش اشخاص</span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-md shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-white">
                  صفحه اختصاصی و کارتکس مالی: {party.name}
                </h3>
                {party.groupName && (
                  <span className="text-xs font-bold bg-white/15 px-2.5 py-0.5 rounded-full text-slate-200 border border-white/10">
                    گروه: {party.groupName}
                  </span>
                )}
                {isFullScreen && (
                  <span className="text-[10px] font-bold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-400/30">
                    صفحه کامل
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                گردش کامل فاکتورهای خرید، فروش، دریافت و پرداخت‌های نقدی و مانده لحظه‌ای افغانی و دالری
              </p>
            </div>
          </div>

          {/* Action buttons: Fullscreen toggle & Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl transition border border-white/15 cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs"
              title={isFullScreen ? 'خروج از حالت تمام صفحه' : 'نمایش صفحه کامل'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">حالت پنجره</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">صفحه اختصاصی کامل</span>
                </>
              )}
            </button>

            {/* Prominent Standardized Close Button */}
            <button
              id="party-cardex-modal-close-btn"
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white rounded-xl transition border border-white/15 hover:border-rose-500 cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-xs"
              title="بستن (ESC)"
            >
              <X className="w-4 h-4" />
              <span>بستن</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-slate-50 flex-1">
          {/* Party Balance Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* AFN Balance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">مانده حساب افغانی (AFN):</span>
              <div
                className={`text-lg font-black font-mono mt-1 ${
                  party.balanceAFN < 0
                    ? 'text-rose-600'
                    : party.balanceAFN > 0
                    ? 'text-emerald-600'
                    : 'text-slate-500'
                }`}
              >
                {formatCurrency(Math.abs(party.balanceAFN), 'AFN')}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 font-bold">
                {party.balanceAFN < 0 ? (
                  <span className="text-rose-600">قرضدار ما است (بدهکار)</span>
                ) : party.balanceAFN > 0 ? (
                  <span className="text-emerald-600">طلبکار از ما است (بستانکار)</span>
                ) : (
                  <span className="text-slate-400">حساب کاملاً تسویه است</span>
                )}
              </div>
            </div>

            {/* USD Balance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block">مانده حساب دالری (USD):</span>
              <div
                className={`text-lg font-black font-mono mt-1 ${
                  party.balanceUSD < 0
                    ? 'text-rose-600'
                    : party.balanceUSD > 0
                    ? 'text-emerald-600'
                    : 'text-slate-500'
                }`}
              >
                {formatCurrency(Math.abs(party.balanceUSD), 'USD')}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 font-bold">
                {party.balanceUSD < 0 ? (
                  <span className="text-rose-600">قرضدار ما است (بدهکار)</span>
                ) : party.balanceUSD > 0 ? (
                  <span className="text-emerald-600">طلبکار از ما است (بستانکار)</span>
                ) : (
                  <span className="text-slate-400">حساب کاملاً تسویه است</span>
                )}
              </div>
            </div>

            {/* Contact & Phone */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">مشخصات تماس:</span>
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">{party.phone}</span>
              </div>
              {party.company && (
                <div className="text-slate-600 truncate">شرکت: {party.company}</div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  if (onOpenPaymentModal) {
                    onOpenPaymentModal('receive_payment', party.id);
                  }
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>دریافت پول (تسویه)</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenPaymentModal) {
                    onOpenPaymentModal('make_payment', party.id);
                  }
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                <span>پرداخت وجه به طرف حساب</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجوی شماره سند، شرح یا فاکتور..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 w-52"
                />
              </div>

              <select
                value={currencyFilter}
                onChange={e => setCurrencyFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">همه ارزها (افغانی و دلار)</option>
                <option value="AFN">فقط گردش افغانی (AFN)</option>
                <option value="USD">فقط گردش دلاری (USD)</option>
              </select>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">همه اسناد و گردش‌ها ({entries.length})</option>
                <option value="invoices">فقط فاکتورهای خرید و فروش</option>
                <option value="payments">فقط رسیدها و پرداخت‌های نقدی</option>
              </select>

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[11px]">از:</span>
                <input
                  type="text"
                  placeholder="۱۴۰۳/۰۱/۰۱"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-20 bg-transparent text-xs font-mono outline-none text-slate-800"
                />
                <span className="text-slate-500 text-[11px]">تا:</span>
                <input
                  type="text"
                  placeholder="۱۴۰۳/۱۲/۲۹"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-20 bg-transparent text-xs font-mono outline-none text-slate-800"
                />
                {(fromDate || toDate) && (
                  <button
                    onClick={() => { setFromDate(''); setToDate(''); }}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                    title="حذف فیلتر تاریخ"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handlePrintStatement}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ صورت‌حساب رسمی A4</span>
            </button>
          </div>

          {/* Cardex Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3">تاریخ و ساعت</th>
                    <th className="py-3 px-3">نوع عملیات مالی</th>
                    <th className="py-3 px-3">شماره سند / فاکتور</th>
                    <th className="py-3 px-3">شرح معامله و اقلام کالا</th>
                    <th className="py-3 px-2 text-center">ارز</th>
                    <th className="py-3 px-3 text-left text-rose-700 bg-rose-50/40">بدهکار (طلب ما)</th>
                    <th className="py-3 px-3 text-left text-emerald-700 bg-emerald-50/40">بستانکار (پرداخت او)</th>
                    <th className="py-3 px-3 text-left font-black bg-slate-50">مانده حساب لحظه‌ای</th>
                    <th className="py-3 px-2 text-center w-14">مشاهده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        هیچ تراکنش یا سندی برای این طرف حساب با فیلتر فعلی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e, idx) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900 font-mono">{e.date}</div>
                          {e.time && <div className="text-[10px] text-slate-400 font-mono">{e.time}</div>}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {e.type === 'invoice_sell' && (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-[11px] inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" />
                              <span>فاکتور فروش</span>
                            </span>
                          )}
                          {e.type === 'invoice_buy' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-bold text-[11px] inline-flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>فاکتور خرید</span>
                            </span>
                          )}
                          {e.type === 'payment_receive' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[11px] inline-flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>دریافت نقد</span>
                            </span>
                          )}
                          {e.type === 'payment_make' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[11px] inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" />
                              <span>پرداخت نقد</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {e.documentNumber}
                        </td>
                        <td className="py-3 px-3 text-slate-700 leading-snug max-w-[220px] truncate" title={e.description}>
                          {cleanCardexDescription(e.description, 36)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                              e.currency === 'USD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {e.currency}
                          </span>
                        </td>
                        {/* Debit */}
                        <td className="py-3 px-3 text-left font-mono font-bold bg-rose-50/20 text-rose-700">
                          {e.debit > 0 ? formatCurrency(e.debit, e.currency) : '-'}
                        </td>
                        {/* Credit */}
                        <td className="py-3 px-3 text-left font-mono font-bold bg-emerald-50/20 text-emerald-700">
                          {e.credit > 0 ? formatCurrency(e.credit, e.currency) : '-'}
                        </td>
                        {/* Running Balance */}
                        <td className="py-3 px-3 text-left font-mono font-black text-slate-900 bg-slate-50/60 whitespace-nowrap">
                          {(() => {
                            const bal = e.currency === 'AFN' ? e.balanceAFN : e.balanceUSD;
                            const isDebtor = bal > 0.01;
                            const isCreditor = bal < -0.01;
                            return (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={isDebtor ? 'text-rose-600' : isCreditor ? 'text-emerald-600' : 'text-slate-500'}>
                                  {formatCurrency(Math.abs(bal), e.currency)}
                                </span>
                                {isDebtor && (
                                  <span className="text-[10px] px-1 py-0.2 rounded font-sans font-bold bg-rose-100 text-rose-700">
                                    بدهکار
                                  </span>
                                )}
                                {isCreditor && (
                                  <span className="text-[10px] px-1 py-0.2 rounded font-sans font-bold bg-emerald-100 text-emerald-700">
                                    طلبکار
                                  </span>
                                )}
                                {!isDebtor && !isCreditor && (
                                  <span className="text-[10px] px-1 py-0.2 rounded font-sans font-bold bg-slate-100 text-slate-500">
                                    تسویه
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* Action */}
                        <td className="py-3 px-2 text-center">
                          {e.invoiceId && onViewInvoice ? (
                            <button
                              onClick={() => {
                                onClose();
                                onViewInvoice(e.invoiceId!);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="مشاهده جزئیات فاکتور"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            تعداد ردیف‌های صورت‌حساب: {filteredEntries.length} تراکنش
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
          >
            بستن فرم (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};

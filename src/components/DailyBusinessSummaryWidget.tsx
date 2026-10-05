import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Receipt,
  Calendar,
  Eye,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Percent,
} from 'lucide-react';
import { Invoice, CurrencyDefinition } from '../types';
import { formatNumber, getPersianDate, getCurrentTime, getTodayDate } from '../utils/formatters';
import { NavTab } from './Sidebar';

interface DailyBusinessSummaryWidgetProps {
  invoices: Invoice[];
  baseCurrency: CurrencyDefinition;
  convertToBase: (amount: number, currency: string) => number;
  usdToAfnRate: number;
  onOpenNewInvoice: (type?: 'buy' | 'sell') => void;
  onViewInvoice: (invoiceId: string) => void;
  setActiveTab?: (tab: NavTab) => void;
}

// Convert any digit representations (Arabic / Persian / English) to English digits
const normalizeDigits = (str: string): string => {
  if (!str) return '';
  return String(str)
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9')
    .replace(/[-_.]/g, '/')
    .trim();
};

export const DailyBusinessSummaryWidget: React.FC<DailyBusinessSummaryWidgetProps> = ({
  invoices,
  baseCurrency,
  convertToBase,
  usdToAfnRate,
  onOpenNewInvoice,
  onViewInvoice,
  setActiveTab,
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<'BASE' | 'USD' | 'AFN'>('BASE');
  const [showInvoicesList, setShowInvoicesList] = useState<boolean>(false);

  const safeRateToAFN = usdToAfnRate > 0 ? usdToAfnRate : 65;

  // Convert amount between currencies safely
  const convertAmount = (amount: number, fromCurrency: string): number => {
    if (isNaN(amount) || amount === 0) return 0;
    const baseCode = (baseCurrency.code || 'USD').toUpperCase();
    const fromCode = (fromCurrency || baseCode).toUpperCase();

    // 1. Convert to base currency
    const baseAmt = convertToBase(amount, fromCode);

    // 2. Convert from base currency to selected target currency
    if (selectedCurrency === 'BASE') {
      return baseAmt;
    }

    if (selectedCurrency === 'USD') {
      if (baseCode === 'USD') return baseAmt;
      if (baseCode === 'AFN') return baseAmt / safeRateToAFN;
      return baseAmt / safeRateToAFN;
    }

    if (selectedCurrency === 'AFN') {
      if (baseCode === 'AFN') return baseAmt;
      if (baseCode === 'USD') return baseAmt * safeRateToAFN;
      return baseAmt * safeRateToAFN;
    }

    return baseAmt;
  };

  // Helper to determine if an invoice was generated today
  const isTodayInvoice = (inv: Invoice): boolean => {
    if (!inv) return false;
    const todayP = normalizeDigits(getPersianDate());
    const todayG = normalizeDigits(getTodayDate('gregorian'));
    const todayIso = new Date().toISOString().split('T')[0].replace(/-/g, '/');

    if (inv.date) {
      const invDate = normalizeDigits(inv.date);
      if (invDate === todayP || invDate === todayG || invDate === todayIso) return true;

      const stripZeros = (s: string) => s.split('/').map(part => parseInt(part, 10)).join('/');
      if (stripZeros(invDate) === stripZeros(todayP) || stripZeros(invDate) === stripZeros(todayG)) return true;
    }

    if (inv.createdAt) {
      try {
        const created = new Date(inv.createdAt);
        const now = new Date();
        if (
          created.getFullYear() === now.getFullYear() &&
          created.getMonth() === now.getMonth() &&
          created.getDate() === now.getDate()
        ) {
          return true;
        }
      } catch {}
    }

    return false;
  };

  // Filter today's invoices
  const todayInvoices = useMemo(() => {
    return invoices.filter(isTodayInvoice);
  }, [invoices]);

  // Financial calculations from invoices generated today
  const summary = useMemo(() => {
    let cashInflows = 0;
    let cashOutflows = 0;
    let netProfit = 0;
    let totalSalesGross = 0;
    let totalPurchasesGross = 0;
    let totalCreditSales = 0;

    let sellInvoicesCount = 0;
    let buyInvoicesCount = 0;
    let returnSellCount = 0;
    let returnBuyCount = 0;

    todayInvoices.forEach(inv => {
      const invCurr = inv.currency || baseCurrency.code || 'USD';
      const paidAmt = inv.paidAmount || 0;
      const totalAmt = inv.totalAmount || 0;
      const balanceAmt = inv.balanceAmount || 0;
      const directExpenses = (inv.shippingCost || 0) + (inv.extraExpensesTotal || 0);

      if (inv.type === 'sell') {
        sellInvoicesCount += 1;
        // Cash Inflow: cash received on today's sale invoice
        cashInflows += convertAmount(paidAmt, invCurr);
        totalSalesGross += convertAmount(totalAmt, invCurr);
        totalCreditSales += convertAmount(balanceAmt, invCurr);

        // If extra shipping/expenses were paid directly by company on this invoice
        if (directExpenses > 0) {
          cashOutflows += convertAmount(directExpenses, invCurr);
        }

        // Net Profit Calculation for Sale:
        // (Sum of Item Margins) - Invoice Discount - Direct Expenses
        const itemsMargin = (inv.items || []).reduce((sum, item) => {
          const unitPrice = item.unitPrice || 0;
          const buyPrice = item.buyPrice !== undefined && item.buyPrice > 0 ? item.buyPrice : unitPrice * 0.85;
          const qty = item.quantity || 0;
          return sum + (unitPrice - buyPrice) * qty;
        }, 0);

        const invNetProfit = itemsMargin - (inv.discount || 0) - directExpenses;
        netProfit += convertAmount(invNetProfit, invCurr);
      } else if (inv.type === 'buy') {
        buyInvoicesCount += 1;
        // Cash Outflow: cash paid on today's purchase invoice
        cashOutflows += convertAmount(paidAmt, invCurr);
        totalPurchasesGross += convertAmount(totalAmt, invCurr);

        if (directExpenses > 0) {
          cashOutflows += convertAmount(directExpenses, invCurr);
        }
      } else if (inv.type === 'return_sell') {
        returnSellCount += 1;
        // Cash Outflow: refund returned back to customer
        cashOutflows += convertAmount(paidAmt, invCurr);

        // Deduct returned profit
        const itemsMargin = (inv.items || []).reduce((sum, item) => {
          const unitPrice = item.unitPrice || 0;
          const buyPrice = item.buyPrice !== undefined && item.buyPrice > 0 ? item.buyPrice : unitPrice * 0.85;
          const qty = item.quantity || 0;
          return sum + (unitPrice - buyPrice) * qty;
        }, 0);
        const invLostProfit = itemsMargin - (inv.discount || 0);
        netProfit -= convertAmount(invLostProfit, invCurr);
      } else if (inv.type === 'return_buy') {
        returnBuyCount += 1;
        // Cash Inflow: refund received back from supplier
        cashInflows += convertAmount(paidAmt, invCurr);
      }
    });

    const netCashFlow = cashInflows - cashOutflows;
    const profitMarginPercent = totalSalesGross > 0 ? (netProfit / totalSalesGross) * 100 : 0;

    return {
      cashInflows,
      cashOutflows,
      netCashFlow,
      netProfit,
      totalSalesGross,
      totalPurchasesGross,
      totalCreditSales,
      sellInvoicesCount,
      buyInvoicesCount,
      returnSellCount,
      returnBuyCount,
      totalCount: todayInvoices.length,
      profitMarginPercent,
    };
  }, [todayInvoices, selectedCurrency, baseCurrency, safeRateToAFN]);

  // Currency label
  const currencySymbol =
    selectedCurrency === 'USD' ? '$' : selectedCurrency === 'AFN' ? '؋' : baseCurrency.code || 'USD';

  return (
    <div
      id="daily-business-summary-widget"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
      dir="rtl"
    >
      {/* ---------------- 1. WIDGET TITLEBAR ---------------- */}
      <div className="p-4 md:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0 shadow-inner">
            <Coins className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm md:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>خلاصه عملکرد تجارتی امروز</span>
                <span className="text-[11px] font-mono font-bold text-sky-300/80">
                  (Daily Business Summary)
                </span>
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-sky-200 border border-blue-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>محاسبه بلادرنگ از فاکتورها</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              تحلیل جریان وجوه نقد (ورودی و خروجی) و سود خالص حاصل از فاکتورهای صادرشده در تاریخ امروز
            </p>
          </div>
        </div>

        {/* Controls: Date & Currency Selector */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Today Date Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/15 rounded-xl text-xs font-mono font-bold text-white/95 shadow-inner">
            <Calendar className="w-3.5 h-3.5 text-sky-300" />
            <span>{getPersianDate()}</span>
          </div>

          {/* Currency Switcher */}
          <div className="flex items-center bg-white/10 p-0.5 rounded-xl border border-white/15 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedCurrency('BASE')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                selectedCurrency === 'BASE'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              title={`ارز مبنای سیستم (${baseCurrency.code})`}
            >
              ارز مبنا ({baseCurrency.code})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency('AFN')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                selectedCurrency === 'AFN'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="نمایش بر حسب افغانی (؋)"
            >
              افغانی (؋)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                selectedCurrency === 'USD'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="نمایش بر حسب دلار ($)"
            >
              دلار ($)
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- 2. PRIMARY 4 KPI METRIC CARDS ---------------- */}
      <div className="p-4 md:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: ورودی‌های نقد امروز (Total Cash Inflows) */}
          <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-emerald-300 transition group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black shadow-2xs group-hover:scale-105 transition-transform">
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-left font-mono">
                <span className="text-[10px] font-bold text-emerald-700/80 bg-emerald-100/80 px-2 py-0.5 rounded">
                  CASH-INFLOW
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 block mb-1">
                مجموع ورودی‌های نقد امروز
              </span>
              <div className="flex items-baseline gap-1.5 font-mono dir-ltr text-right">
                <span className="text-xl md:text-2xl font-black text-emerald-700 tracking-tight">
                  {formatNumber(summary.cashInflows)}
                </span>
                <span className="text-xs font-bold text-slate-500 font-sans">{currencySymbol}</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-emerald-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>دریافتی نقد فاکتورها:</span>
              <span className="font-mono font-bold text-emerald-800">
                {summary.sellInvoicesCount} فروش نقدی
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500" />
          </div>

          {/* Card 2: خروجی‌های نقد امروز (Total Cash Outflows) */}
          <div className="relative overflow-hidden rounded-xl border border-rose-200 bg-gradient-to-b from-rose-50/70 to-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-rose-300 transition group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black shadow-2xs group-hover:scale-105 transition-transform">
                <ArrowUpRight className="w-5 h-5 text-rose-600" />
              </div>
              <div className="text-left font-mono">
                <span className="text-[10px] font-bold text-rose-700/80 bg-rose-100/80 px-2 py-0.5 rounded">
                  CASH-OUTFLOW
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 block mb-1">
                مجموع خروجی‌های نقد امروز
              </span>
              <div className="flex items-baseline gap-1.5 font-mono dir-ltr text-right">
                <span className="text-xl md:text-2xl font-black text-rose-700 tracking-tight">
                  {formatNumber(summary.cashOutflows)}
                </span>
                <span className="text-xs font-bold text-slate-500 font-sans">{currencySymbol}</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-rose-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>پرداخت خرید و مصارف:</span>
              <span className="font-mono font-bold text-rose-800">
                {summary.buyInvoicesCount} خرید + مصارف
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500" />
          </div>

          {/* Card 3: سود خالص فاکتورهای امروز (Today's Net Profit) */}
          <div className="relative overflow-hidden rounded-xl border border-purple-200 bg-gradient-to-b from-purple-50/70 to-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-purple-300 transition group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black shadow-2xs group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left font-mono">
                <span className="text-[10px] font-bold text-purple-700/80 bg-purple-100/80 px-2 py-0.5 rounded">
                  NET-PROFIT
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-600">سود خالص فاکتورهای امروز</span>
                {summary.totalSalesGross > 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      summary.profitMarginPercent >= 0
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    حاشیه: {summary.profitMarginPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 font-mono dir-ltr text-right">
                <span
                  className={`text-xl md:text-2xl font-black tracking-tight ${
                    summary.netProfit >= 0 ? 'text-purple-700' : 'text-rose-700'
                  }`}
                >
                  {formatNumber(summary.netProfit)}
                </span>
                <span className="text-xs font-bold text-slate-500 font-sans">{currencySymbol}</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-purple-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>مارجین اقلام منهای تخفیفات:</span>
              <span
                className={`font-mono font-bold ${
                  summary.netProfit >= 0 ? 'text-purple-800' : 'text-rose-700'
                }`}
              >
                {summary.netProfit >= 0 ? 'سود قطعی' : 'زیان موقت'}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-purple-500" />
          </div>

          {/* Card 4: خالص جریان نقد امروز (Net Cash Flow) */}
          <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black shadow-2xs group-hover:scale-105 transition-transform">
                <Coins className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left font-mono">
                <span className="text-[10px] font-bold text-blue-700/80 bg-blue-100/80 px-2 py-0.5 rounded">
                  NET-FLOW
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 block mb-1">
                خالص جریان نقد فاکتورها (تراز)
              </span>
              <div className="flex items-baseline gap-1.5 font-mono dir-ltr text-right">
                <span
                  className={`text-xl md:text-2xl font-black tracking-tight ${
                    summary.netCashFlow >= 0 ? 'text-blue-700' : 'text-rose-600'
                  }`}
                >
                  {summary.netCashFlow > 0 ? '+' : ''}
                  {formatNumber(summary.netCashFlow)}
                </span>
                <span className="text-xs font-bold text-slate-500 font-sans">{currencySymbol}</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-blue-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>وضعیت مازاد / کسری:</span>
              <span
                className={`font-bold ${
                  summary.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {summary.netCashFlow >= 0 ? 'مازاد نقدینگی' : 'کسری نقدی فاکتورها'}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />
          </div>
        </div>

        {/* ---------------- 3. SECONDARY BUSINESS HEALTH METRICS STRIP ---------------- */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span className="text-slate-500">کل فاکتورهای امروز:</span>
              <span className="font-mono font-bold text-slate-900">{summary.totalCount} مورد</span>
              <span className="text-[10px] text-slate-400 font-medium">
                ({summary.sellInvoicesCount} فروش · {summary.buyInvoicesCount} خرید
                {summary.returnSellCount + summary.returnBuyCount > 0
                  ? ` · ${summary.returnSellCount + summary.returnBuyCount} مرجوعی`
                  : ''}
                )
              </span>
            </div>

            <div className="hidden sm:inline-block text-slate-300">|</div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">حجم کل فروش امروز:</span>
              <span className="font-mono font-bold text-emerald-700">
                {formatNumber(summary.totalSalesGross)} {currencySymbol}
              </span>
            </div>

            <div className="hidden sm:inline-block text-slate-300">|</div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">حجم کل خرید امروز:</span>
              <span className="font-mono font-bold text-blue-700">
                {formatNumber(summary.totalPurchasesGross)} {currencySymbol}
              </span>
            </div>

            <div className="hidden sm:inline-block text-slate-300">|</div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">مانده طلب نسیه ایجادشده:</span>
              <span className="font-mono font-bold text-amber-700">
                {formatNumber(summary.totalCreditSales)} {currencySymbol}
              </span>
            </div>
          </div>

          {/* Quick Action Toggle to see list of today's invoices */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInvoicesList(prev => !prev)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>{showInvoicesList ? 'بستن ریز فاکتورها' : `مشاهده ریز فاکتورهای امروز (${todayInvoices.length})`}</span>
              {showInvoicesList ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenNewInvoice('sell')}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
              title="صدور فاکتور فروش جدید برای امروز"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">فاکتور فروش</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenNewInvoice('buy')}
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
              title="صدور فاکتور خرید جدید برای امروز"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">فاکتور خرید</span>
            </button>
          </div>
        </div>

        {/* ---------------- 4. EXPANDABLE TODAY'S INVOICES DETAIL LIST ---------------- */}
        {showInvoicesList && (
          <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden animate-in fade-in duration-200">
            <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>لیست فاکتورهای ثبت‌شده در تاریخ امروز ({todayInvoices.length} فاکتور)</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                نرخ تبدیل: ۱ دلار = {safeRateToAFN} افغانی
              </span>
            </div>

            {todayInvoices.length > 0 ? (
              <div className="overflow-x-auto max-h-72 custom-scrollbar">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">شماره فاکتور</th>
                      <th className="py-2.5 px-3 font-bold">نوع معامله</th>
                      <th className="py-2.5 px-3 font-bold">طرف حساب (مشتری/فروشنده)</th>
                      <th className="py-2.5 px-3 font-bold">ساعت / تاریخ</th>
                      <th className="py-2.5 px-3 font-bold text-left">مبلغ کل فاکتور</th>
                      <th className="py-2.5 px-3 font-bold text-left">دریافتی / پرداختی نقد</th>
                      <th className="py-2.5 px-3 font-bold text-left">مانده قرضه</th>
                      <th className="py-2.5 px-3 font-bold text-left">سود ناخالص</th>
                      <th className="py-2.5 px-3 font-bold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {todayInvoices.map((inv, idx) => {
                      const isSell = inv.type === 'sell';
                      const isBuy = inv.type === 'buy';
                      const isReturnSell = inv.type === 'return_sell';
                      const isReturnBuy = inv.type === 'return_buy';

                      // Profit on this specific invoice
                      const itemsMargin = (inv.items || []).reduce((sum, item) => {
                        const unitPrice = item.unitPrice || 0;
                        const buyPrice =
                          item.buyPrice !== undefined && item.buyPrice > 0 ? item.buyPrice : unitPrice * 0.85;
                        const qty = item.quantity || 0;
                        return sum + (unitPrice - buyPrice) * qty;
                      }, 0);
                      const invProfit = isSell
                        ? itemsMargin - (inv.discount || 0) - (inv.shippingCost || 0)
                        : isReturnSell
                        ? -(itemsMargin - (inv.discount || 0))
                        : 0;

                      return (
                        <tr
                          key={inv.id || idx}
                          onClick={() => onViewInvoice(inv.id)}
                          className="hover:bg-blue-50/60 transition cursor-pointer"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                            #{inv.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isSell
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : isBuy
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : isReturnSell
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}
                            >
                              {isSell
                                ? 'فاکتور فروش'
                                : isBuy
                                ? 'فاکتور خرید'
                                : isReturnSell
                                ? 'برگشت از فروش'
                                : 'برگشت از خرید'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {inv.partyName || 'مشتری نقدی'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {inv.issueTime || inv.date || '---'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-left dir-ltr">
                            {formatNumber(inv.totalAmount || 0)} {inv.currency}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-left dir-ltr">
                            <span
                              className={
                                isSell || isReturnBuy
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }
                            >
                              {isSell || isReturnBuy ? '+' : '-'}
                              {formatNumber(inv.paidAmount || 0)} {inv.currency}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-left dir-ltr text-slate-600">
                            {inv.balanceAmount && inv.balanceAmount > 0
                              ? `${formatNumber(inv.balanceAmount)} ${inv.currency}`
                              : 'تسویه کامل'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-left dir-ltr">
                            {isSell || isReturnSell ? (
                              <span className={invProfit >= 0 ? 'text-purple-700' : 'text-rose-600'}>
                                {formatNumber(invProfit)} {inv.currency}
                              </span>
                            ) : (
                              <span className="text-slate-400">---</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onViewInvoice(inv.id);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded text-[11px] font-bold transition cursor-pointer shadow-2xs"
                              title="مشاهده کامل و چاپ فاکتور"
                            >
                              مشاهده
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center space-y-3 bg-white">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800">
                  هنوز فاکتوری در تاریخ امروز ({getPersianDate()}) صادر نشده است
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  به محض صدور اولین فاکتور فروش یا خرید در سیستم، جریان وجوه نقد (ورودی، خروجی و سود خالص)
                  به‌صورت زنده در این جدول و کارت‌های بالا نمایش داده می‌شود.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenNewInvoice('sell')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>صدور فاکتور فروش جدید امروز</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenNewInvoice('buy')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>صدور فاکتور خرید جدید امروز</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import { CloseButton } from './CloseButton';
import { usePageReport } from './PageActionsToolbar';
import { tableReport, reportPaymentStatus } from '../utils/reportData';
import React, { useState, useMemo } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { InvoiceType, Invoice, PaymentStatus, Currency } from '../types';
import { formatNumber, formatCurrency, getPersianDate } from '../utils/formatters';
import { SalesInvoiceCreateView } from './SalesInvoiceCreateView';
import { PurchaseInvoiceCreateView } from './PurchaseInvoiceCreateView';
import {
  ShoppingCart,
  Building2,
  RotateCcw,
  RotateCw,
  Plus,
  Search,
  Printer,
  Eye,
  Trash2,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Warehouse as WarehouseIcon,
  CreditCard,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Edit2,
  Package,
  Boxes,
} from 'lucide-react';
import { EditInvoiceModal } from './EditInvoiceModal';
import { ItemizedProductSalesView } from './ItemizedProductSalesView';

interface TradeOperationsHubViewProps {
  embeddedInCenter?: boolean;
  initialType?: 'sell' | 'buy' | 'return_sell' | 'return_buy';
  initialViewMode?: 'list' | 'create' | 'itemized';
  initialItemizedProductId?: string;
  pageTitle?: string;
  onNavigate?: (type: InvoiceType, mode: 'list' | 'create' | 'itemized', productId?: string) => void;
  onViewInvoice: (id: string) => void;
  onOpenPaymentModal?: (type: 'receive_payment' | 'make_payment', partyId?: string) => void;
}

export const LegacyTradeOperationsHubView: React.FC<TradeOperationsHubViewProps> = ({
  embeddedInCenter = false,
  initialType = 'sell',
  initialViewMode = 'list',
  initialItemizedProductId = 'all',
  pageTitle,
  onNavigate,
  onViewInvoice,
  onOpenPaymentModal,
}) => {
  const { invoices, deleteInvoice, openPrintModal } = useAccounting();

  // Active category: 'sell' (فروش), 'buy' (خرید), 'return_sell' (برگشت از فروش), 'return_buy' (برگشت از خرید)
  const [activeCategory, setActiveCategory] = useState<'sell' | 'buy' | 'return_sell' | 'return_buy'>(initialType);

  // Sub-view: 'list' (فهرست فاکتورها), 'create' (ثبت فاکتور جدید), or 'itemized' (تفکیک کالاها و خریداران)
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'itemized'>(initialViewMode || 'list');
  const [itemizedProductId, setItemizedProductId] = useState<string>(initialItemizedProductId);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Sync state when props change (e.g. from sidebar or quick navigation)
  React.useEffect(() => {
    setActiveCategory(initialType);
  }, [initialType]);

  React.useEffect(() => {
    setViewMode(initialViewMode || 'list');
  }, [initialViewMode]);

  // Filter and search states for the list view
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'AFN' | 'USD'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');

  // Filter invoices for the active category
  const categoryInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === activeCategory);
  }, [invoices, activeCategory]);

  const filteredInvoices = useMemo(() => {
    return categoryInvoices.filter(inv => {
      if (currencyFilter !== 'all' && inv.currency !== currencyFilter) return false;
      if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
        const matchParty = (inv.partyName || '').toLowerCase().includes(q);
        const matchNote = (inv.notes || '').toLowerCase().includes(q);
        const matchItem = inv.items?.some(it => it.productName.toLowerCase().includes(q));
        if (!matchNum && !matchParty && !matchNote && !matchItem) return false;
      }

      return true;
    });
  }, [categoryInvoices, currencyFilter, statusFilter, searchQuery]);

  // Aggregate metrics for active category
  const metrics = useMemo(() => {
    let totalAFN = 0;
    let totalUSD = 0;
    let totalPaidAFN = 0;
    let totalPaidUSD = 0;
    let totalDueAFN = 0;
    let totalDueUSD = 0;

    categoryInvoices.forEach(inv => {
      const invTotal = inv.totalAmount ?? 0;
      const invPaid = inv.paidAmount ?? 0;
      const invDue = inv.balanceAmount ?? 0;

      if (inv.currency === 'AFN') {
        totalAFN += invTotal;
        totalPaidAFN += invPaid;
        totalDueAFN += invDue;
      } else {
        totalUSD += invTotal;
        totalPaidUSD += invPaid;
        totalDueUSD += invDue;
      }
    });

    return { totalAFN, totalUSD, totalPaidAFN, totalPaidUSD, totalDueAFN, totalDueUSD };
  }, [categoryInvoices]);

  // Category counts
  const counts = useMemo(() => {
    return {
      sell: invoices.filter(i => i.type === 'sell').length,
      buy: invoices.filter(i => i.type === 'buy').length,
      return_sell: invoices.filter(i => i.type === 'return_sell').length,
      return_buy: invoices.filter(i => i.type === 'return_buy').length,
    };
  }, [invoices]);

  // Category info helpers
  const getCategoryInfo = () => {
    switch (activeCategory) {
      case 'sell':
        return {
          title: 'فروش (فاکتورهای فروش)',
          subtitle: 'مدیریت و صدور فاکتورهای فروش کالا به مشتریان همراه با کسر از موجودی انبار',
          createBtnLabel: 'صدور فاکتور فروش جدید',
          color: 'blue',
          accentBg: 'bg-blue-600',
          hoverBg: 'hover:bg-blue-700',
          borderActive: 'border-blue-600',
          textActive: 'text-blue-600',
          partyLabel: 'خریدار / مشتری',
        };
      case 'buy':
        return {
          title: 'خرید (فاکتورهای خرید)',
          subtitle: 'مدیریت و ثبت فاکتورهای خرید کالا از کارخانجات و تأمین‌کنندگان همراه با ورود به انبار',
          createBtnLabel: 'ثبت فاکتور خرید جدید',
          color: 'emerald',
          accentBg: 'bg-emerald-600',
          hoverBg: 'hover:bg-emerald-700',
          borderActive: 'border-emerald-600',
          textActive: 'text-emerald-600',
          partyLabel: 'فروشنده / کارخانه',
        };
      case 'return_sell':
        return {
          title: 'فاکتور برگشت از فروش (مرجوعی مشتری)',
          subtitle: 'مدیریت و صدور فاکتورهای مرجوعی مشتریان همراه با برگشت کالا به انبار و بستانکار شدن مشتری',
          createBtnLabel: 'صدور فاکتور برگشت از فروش',
          color: 'amber',
          accentBg: 'bg-amber-600',
          hoverBg: 'hover:bg-amber-700',
          borderActive: 'border-amber-600',
          textActive: 'text-amber-600',
          partyLabel: 'مشتری مرجوع‌کننده',
        };
      case 'return_buy':
        return {
          title: 'فاکتور برگشت از خرید (مرجوعی به تأمین‌کننده)',
          subtitle: 'مدیریت و ثبت فاکتورهای مرجوعی به فروشندگان همراه با کسر از موجودی انبار و بدهکار شدن تأمین‌کننده',
          createBtnLabel: 'ثبت فاکتور برگشت از خرید',
          color: 'purple',
          accentBg: 'bg-purple-600',
          hoverBg: 'hover:bg-purple-700',
          borderActive: 'border-purple-600',
          textActive: 'text-purple-600',
          partyLabel: 'تأمین‌کننده مرجوع‌شونده',
        };
    }
  };

  const categoryInfo = getCategoryInfo();

  const Heading = embeddedInCenter ? 'h2' : 'h1';
  const changeView = (mode: 'list' | 'create' | 'itemized', productId = itemizedProductId) => { setViewMode(mode); setItemizedProductId(productId); onNavigate?.(activeCategory, mode, productId); };

  usePageReport({
    title: pageTitle || categoryInfo.title, enabled: viewMode === 'list',
    search: { value: searchQuery, onChange: setSearchQuery, placeholder: `جستجو در شماره فاکتور، نام ${categoryInfo.partyLabel} یا اقلام کالا...` }, onCreate: () => { setEditingInvoice(null); setViewMode('create'); onNavigate?.(activeCategory, 'create'); }, createLabel: categoryInfo.createBtnLabel,
    filters: [{ id: 'currency', label: 'ارز', value: currencyFilter, onChange: value => setCurrencyFilter(value as typeof currencyFilter), options: [{ value: 'all', label: 'همه' }, { value: 'AFN', label: 'AFN' }, { value: 'USD', label: 'USD' }] }],
    getReport: () => tableReport(pageTitle || categoryInfo.title, ['شماره فاکتور', 'تاریخ', 'طرف حساب', 'کالاها', 'مبلغ کل', 'پرداخت‌شده', 'باقی‌مانده', 'ارز', 'وضعیت'], filteredInvoices.map(invoice => [invoice.invoiceNumber, invoice.date, invoice.partyName, invoice.items.map(item => `${item.productName} — ${item.quantity} ${item.unit}`).join('؛ '), invoice.totalAmount, invoice.paidAmount, invoice.balanceAmount, invoice.currency, reportPaymentStatus(invoice.paymentStatus)])),
  });

  return (
    <div className={`legacy-trade p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto font-sans ${embeddedInCenter ? 'is-in-center' : ''}`} dir="rtl">
      <header className="workspace-section-heading app-page-form-heading"><Heading>{pageTitle || (viewMode === 'itemized' ? 'تفکیک فروش کالاها و خریداران' : `${viewMode === 'create' ? 'ثبت' : 'لیست'} ${activeCategory === 'return_sell' ? 'برگشت از فروش' : activeCategory === 'return_buy' ? 'برگشت از خرید' : activeCategory === 'buy' ? 'فاکتور خرید' : 'فاکتور فروش'}`)}</Heading>{viewMode === 'create' && <CloseButton label="بستن فرم" aria-label="بستن فرم پیشرفته و بازگشت به فهرست" onClick={() => changeView('list')} />}</header>
      {viewMode === 'create' ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-2 sm:p-4 shadow-xs">
          {activeCategory === 'sell' || activeCategory === 'return_sell' ? (
            <SalesInvoiceCreateView
              invoiceType={activeCategory}
              onBackToList={() => changeView('list')}
              onViewInvoice={id => {
                changeView('list');
                onViewInvoice(id);
              }}
            />
          ) : (
            <PurchaseInvoiceCreateView
              invoiceType={activeCategory}
              onBackToList={() => changeView('list')}
              onViewInvoice={id => {
                changeView('list');
                onViewInvoice(id);
              }}
            />
          )}
        </div>
      ) : viewMode === 'itemized' ? (
        <ItemizedProductSalesView
          initialProductId={itemizedProductId}
          onViewInvoice={onViewInvoice}
          onOpenNewSale={() => {
            setActiveCategory('sell');
            changeView('create');
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Summary Financial Cards for Active Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">
                  مجموع فاکتورهای {categoryInfo.title}
                </span>
                <div className="mt-1 space-y-0.5">
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {formatNumber(metrics.totalAFN)} ؋
                  </div>
                  <div className="text-xs font-bold text-blue-600 font-mono">
                    ${formatNumber(metrics.totalUSD)}
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">تسویه نقدی / وصولی</span>
                <div className="mt-1 space-y-0.5">
                  <div className="text-xl font-black text-emerald-600 font-mono">
                    {formatNumber(metrics.totalPaidAFN)} ؋
                  </div>
                  <div className="text-xs font-bold text-emerald-600 font-mono">
                    ${formatNumber(metrics.totalPaidUSD)}
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">باقیمانده / نسیه حسابی</span>
                <div className="mt-1 space-y-0.5">
                  <div className="text-xl font-black text-rose-600 font-mono">
                    {formatNumber(metrics.totalDueAFN)} ؋
                  </div>
                  <div className="text-xs font-bold text-rose-600 font-mono">
                    ${formatNumber(metrics.totalDueUSD)}
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Notice Banner for Itemized Sales Breakdown */}
          {activeCategory === 'sell' && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-amber-50 border border-blue-200/90 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Boxes className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>گزارش تفکیکی اقلام فروخته‌شده امروز و خریداران</span>
                    <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-mono">
                      امروز {getPersianDate()}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    می‌توانید مشخص کنید امروز از یک جنس مشخص چه مقدار، با چه قیمتی و دقیقا به چه مشتریانی فروش انجام شده است.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  changeView('itemized', 'all');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
              >
                <Boxes className="w-4 h-4 text-amber-400" />
                <span>مشاهده تفکیک فروش کالاها و خریداران</span>
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Filters & Actions Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-1 items-center gap-3">
                

                <select
                  value={currencyFilter}
                  onChange={e => setCurrencyFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">همه اسعار</option>
                  <option value="AFN">افغانی (AFN)</option>
                  <option value="USD">دالر (USD)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">همه وضعیت‌های تسویه</option>
                  <option value="paid">کاملاً تسویه شده</option>
                  <option value="partial">پرداخت جزئی</option>
                  <option value="unpaid">نسیه / پرداخت‌نشده</option>
                </select>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {activeCategory === 'sell' && (
                  <button
                    type="button"
                    onClick={() => {
                      changeView('itemized', 'all');
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs transition shadow-xs cursor-pointer active:scale-95"
                    title="تفکیک هر جنس فروخته‌شده امروز: مقدار فروش و لیست خریداران آن"
                  >
                    <Boxes className="w-4 h-4 text-slate-950" />
                    <span>تفکیک کالاها و خریداران امروز</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => changeView('create')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ {categoryInfo.createBtnLabel}</span>
                </button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3.5 px-4">ردیف</th>
                    <th className="py-3.5 px-4">شماره فاکتور</th>
                    <th className="py-3.5 px-4">تاریخ صدور</th>
                    <th className="py-3.5 px-4">{categoryInfo.partyLabel}</th>
                    <th className="py-3.5 px-4">اقلام فاکتور</th>
                    <th className="py-3.5 px-4">مبلغ کل فاکتور</th>
                    <th className="py-3.5 px-4">پرداخت نقدی</th>
                    <th className="py-3.5 px-4">باقیمانده (قرض)</th>
                    <th className="py-3.5 px-4">وضعیت تسویه</th>
                    <th className="py-3.5 px-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-14 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-3.5">
                          <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 text-slate-500 flex items-center justify-center shadow-xs">
                            <FileText className="w-8 h-8 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-800">
                              هیچ فاکتوری در بخش {categoryInfo.title} ثبت نشده است
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              جهت ثبت و صدور فاکتور جدید با مشخصات ۵ قلم کالا، ۳ نوع تادیه (نقدی، نسیه، نیمه‌نسیه) و چاپ رسمی، روی دکمه زیر کلیک نمایید.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => changeView('create')}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{categoryInfo.createBtnLabel}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv, idx) => {
                      const totalTons = inv.items?.reduce((s, it) => s + (it.tonsCount || 0), 0) || 0;
                      const totalBags = inv.items?.reduce((s, it) => s + (it.bagsCount || 0), 0) || 0;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              {inv.invoiceNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            <div>{inv.date}</div>
                            {inv.issueTime && <div className="text-[10px] text-slate-400">{inv.issueTime}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900">{inv.partyName}</span>
                          </td>
                          <td className="py-3 px-4 min-w-[200px] max-w-sm">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap gap-1">
                                {inv.items && inv.items.length > 0 ? (
                                  inv.items.map((it, itemIdx) => (
                                    <span
                                      key={itemIdx}
                                      onClick={(e) => {
                                        if (activeCategory === 'sell') {
                                          e.stopPropagation();
                                          changeView('itemized', it.productId);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
                                        activeCategory === 'sell'
                                          ? 'bg-slate-100 hover:bg-blue-100 hover:border-blue-300 text-slate-800 hover:text-blue-900 cursor-pointer border-slate-200/70 group/item'
                                          : 'bg-slate-100 border-slate-200/70 text-slate-800'
                                      }`}
                                      title={activeCategory === 'sell' ? `کلیک برای تفکیک فروش و خریداران جنس: ${it.productName}` : `${it.productName}: ${formatNumber(it.quantity)}`}
                                    >
                                      <Package className="w-3 h-3 text-blue-600 shrink-0" />
                                      <strong className="font-bold text-slate-900">{it.productName}</strong>
                                      <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1 rounded border border-blue-200/60">
                                        {formatNumber(it.quantity)} {it.unit === 'ton' ? 'تن' : 'کیسه'}
                                      </span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 text-[11px]">بدون اقلام کالا</span>
                                )}
                              </div>
                              {(totalTons > 0 || totalBags > 0) && (
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 font-bold">
                                  <span className="text-slate-400">جمع:</span>
                                  <span>
                                    {totalTons > 0 ? `${formatNumber(totalTons)} تن` : ''}
                                    {totalTons > 0 && totalBags > 0 ? ' • ' : ''}
                                    {totalBags > 0 ? `${formatNumber(totalBags)} کیسه` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                            {formatCurrency(inv.totalAmount, inv.currency)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                            {formatCurrency(inv.paidAmount || 0, inv.currency)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                            {(inv.balanceAmount || 0) > 0 ? (
                              formatCurrency(inv.balanceAmount, inv.currency)
                            ) : (
                              <span className="text-slate-400 font-normal text-[11px]">تسویه شد</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                inv.paymentStatus === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : inv.paymentStatus === 'partial'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {inv.paymentStatus === 'paid' && <CheckCircle className="w-3 h-3" />}
                              {inv.paymentStatus === 'partial' && <Clock className="w-3 h-3" />}
                              {inv.paymentStatus === 'unpaid' && <AlertCircle className="w-3 h-3" />}
                              <span>
                                {inv.paymentStatus === 'paid'
                                  ? 'تسویه کامل'
                                  : inv.paymentStatus === 'partial'
                                  ? 'پرداخت جزئی'
                                  : 'نسیه / پرداخت‌نشده'}
                              </span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onViewInvoice(inv.id)}
                                className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="مشاهده جزئیات فاکتور"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInvoice(inv)}
                                className="p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                                title="ویرایش مجدد فاکتور"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openPrintModal('invoice', inv)}
                                className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                                title="چاپ فاکتور رسمی"
                              >
                                <Printer className="w-4 h-4 text-slate-600" />
                              </button>
                              {onOpenPaymentModal && (inv.balanceAmount || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPaymentModal(
                                      activeCategory === 'sell' || activeCategory === 'return_buy'
                                        ? 'receive_payment'
                                        : 'make_payment',
                                      inv.partyId
                                    )
                                  }
                                  className="p-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                                  title="ثبت دریافت/پرداخت وجه"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`آیا از حذف فاکتور ${inv.invoiceNumber} اطمینان دارید؟`)) {
                                    deleteInvoice(inv.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                title="حذف فاکتور"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filteredInvoices.length > 0 && (
                  <tfoot className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-left font-black">
                        جمع کل مبالغ نمایش‌داده‌شده:
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-sm text-slate-900">
                        {currencyFilter === 'AFN' && `${formatNumber(metrics.totalAFN)} ؋`}
                        {currencyFilter === 'USD' && `$${formatNumber(metrics.totalUSD)}`}
                        {currencyFilter === 'all' && (
                          <div className="space-y-0.5">
                            <div>{formatNumber(metrics.totalAFN)} ؋</div>
                            <div className="text-xs text-blue-700 font-bold">${formatNumber(metrics.totalUSD)}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {currencyFilter === 'AFN' && `${formatNumber(metrics.totalPaidAFN)} ؋`}
                        {currencyFilter === 'USD' && `$${formatNumber(metrics.totalPaidUSD)}`}
                        {currencyFilter === 'all' && (
                          <div className="space-y-0.5">
                            <div>{formatNumber(metrics.totalPaidAFN)} ؋</div>
                            <div className="text-xs text-emerald-700">${formatNumber(metrics.totalPaidUSD)}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">
                        {currencyFilter === 'AFN' && `${formatNumber(metrics.totalDueAFN)} ؋`}
                        {currencyFilter === 'USD' && `$${formatNumber(metrics.totalDueUSD)}`}
                        {currencyFilter === 'all' && (
                          <div className="space-y-0.5">
                            <div>{formatNumber(metrics.totalDueAFN)} ؋</div>
                            <div className="text-xs text-amber-700">${formatNumber(metrics.totalDueUSD)}</div>
                          </div>
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Re-edit Invoice Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          isOpen={!!editingInvoice}
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
        />
      )}
    </div>
  );
};

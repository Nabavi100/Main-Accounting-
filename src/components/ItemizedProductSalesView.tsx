import React, { useState, useMemo, useRef } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Product, Invoice, InvoiceItem } from '../types';
import {
  formatNumber,
  formatCurrency,
  getPersianDate,
  getTodayDate,
} from '../utils/formatters';
import {
  Boxes,
  Package,
  Search,
  Calendar,
  User,
  FileText,
  Eye,
  Printer,
  Filter,
  TrendingUp,
  ChevronDown,
  ChevronLeft,
  Building2,
  Clock,
  Phone,
  Layers,
  Plus,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  ArrowRightLeft,
  RotateCcw,
} from 'lucide-react';

interface ItemizedProductSalesViewProps {
  initialProductId?: string;
  initialDateFilter?: 'today' | 'last7' | 'this_month' | 'all';
  onViewInvoice: (id: string) => void;
  onOpenNewSale?: () => void;
}

// Normalize all digit representations (Persian/Arabic) to standard English numbers
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

export const ItemizedProductSalesView: React.FC<ItemizedProductSalesViewProps> = ({
  initialProductId = 'all',
  initialDateFilter = 'today',
  onViewInvoice,
  onOpenNewSale,
}) => {
  const { products, invoices, warehouses, baseCurrency } = useAccounting();

  // Selected product filter: 'all' or specific product id
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [productSearch, setProductSearch] = useState('');

  // Sync state when initialProductId prop changes
  React.useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  // Date filter: 'today' (default), 'last7', 'this_month', 'all'
  const [dateFilter, setDateFilter] = useState<'today' | 'last7' | 'this_month' | 'all'>(initialDateFilter);
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'AFN' | 'USD'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');

  // Today dates for comparison
  const todayP = normalizeDigits(getPersianDate());
  const todayG = normalizeDigits(getTodayDate('gregorian'));

  // Check if invoice matches the active date filter
  const matchesDate = (inv: Invoice): boolean => {
    if (dateFilter === 'all') return true;

    const invDateNorm = normalizeDigits(inv.date || '');

    if (dateFilter === 'today') {
      if (invDateNorm === todayP || invDateNorm === todayG) return true;

      // Match stripped leading zeros e.g. 1405/07/13 vs 1405/7/13
      const stripZeros = (s: string) => s.split('/').map(part => parseInt(part, 10)).join('/');
      if (stripZeros(invDateNorm) === stripZeros(todayP) || stripZeros(invDateNorm) === stripZeros(todayG)) return true;

      if (inv.createdAt) {
        try {
          const d = new Date(inv.createdAt);
          const now = new Date();
          if (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          ) {
            return true;
          }
        } catch {}
      }
      return false;
    }

    if (dateFilter === 'this_month') {
      const todayParts = todayP.split('/');
      const invParts = invDateNorm.split('/');
      if (todayParts.length >= 2 && invParts.length >= 2) {
        return todayParts[0] === invParts[0] && todayParts[1] === invParts[1];
      }
    }

    return true;
  };

  // Only take sales invoices
  const salesInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === 'sell' && matchesDate(inv));
  }, [invoices, dateFilter]);

  // Product map for quick lookups
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Warehouse map
  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    warehouses.forEach(w => map.set(w.id, w.name));
    return map;
  }, [warehouses]);

  // Flatten and extract all item sales records
  interface SoldItemRecord {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    date: string;
    issueTime?: string;
    partyId: string;
    partyName: string;
    partyPhone?: string;
    partyAddress?: string;
    productId: string;
    productName: string;
    productCode?: string;
    category?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
    discount: number;
    currency: string;
    warehouseId?: string;
    warehouseName?: string;
    paymentType?: string;
    isCredit: boolean;
    paidAmount: number;
    balanceAmount: number;
    driverName?: string;
    notes?: string;
  }

  const allSoldRecords = useMemo(() => {
    const list: SoldItemRecord[] = [];

    salesInvoices.forEach(inv => {
      if (currencyFilter !== 'all' && inv.currency !== currencyFilter) return;

      const items = inv.items || [];
      items.forEach((item, idx) => {
        if (warehouseFilter !== 'all' && item.warehouseId && item.warehouseId !== warehouseFilter) {
          return;
        }

        const prod = productMap.get(item.productId);
        const wName = item.warehouseId ? warehouseMap.get(item.warehouseId) : inv.warehouseId ? warehouseMap.get(inv.warehouseId) : 'گدام مرکزی';

        list.push({
          id: `${inv.id}-${idx}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          issueTime: inv.issueTime,
          partyId: inv.partyId,
          partyName: inv.partyName || 'مشتری نقدی',
          partyPhone: inv.partyPhone,
          partyAddress: inv.partyAddress,
          productId: item.productId,
          productName: item.productName || prod?.name || 'کالای نامشخص',
          productCode: prod?.code,
          category: prod?.category,
          quantity: item.quantity || 0,
          unit: item.unit === 'ton' ? 'تن' : item.unit === 'bag' ? 'کیسه' : (prod?.baseUnit || (prod as any)?.unit || 'کیسه'),
          unitPrice: item.unitPrice || 0,
          totalAmount: item.totalPrice || ((item.quantity || 0) * (item.unitPrice || 0) - ((item as any)?.discount || 0)),
          discount: (item as any)?.discount || 0,
          currency: inv.currency || 'AFN',
          warehouseId: item.warehouseId || inv.warehouseId,
          warehouseName: wName,
          paymentType: inv.paymentType,
          isCredit: (inv.balanceAmount || 0) > 0,
          paidAmount: inv.paidAmount || 0,
          balanceAmount: inv.balanceAmount || 0,
          driverName: inv.driverName,
          notes: inv.notes,
        });
      });
    });

    return list;
  }, [salesInvoices, currencyFilter, warehouseFilter, productMap, warehouseMap]);

  // Aggregate statistics per product (to show in the product items breakdown bar)
  interface ProductAggregatedStat {
    productId: string;
    productName: string;
    productCode?: string;
    category?: string;
    unit: string;
    totalQuantity: number;
    totalAmountAFN: number;
    totalAmountUSD: number;
    distinctBuyersCount: number;
    distinctInvoicesCount: number;
    buyersNames: string[];
    currentStock: number;
  }

  const productsAggregated = useMemo(() => {
    const map = new Map<string, ProductAggregatedStat>();

    allSoldRecords.forEach(rec => {
      const prod = productMap.get(rec.productId);
      let stat = map.get(rec.productId);
      if (!stat) {
        stat = {
          productId: rec.productId,
          productName: rec.productName,
          productCode: rec.productCode,
          category: rec.category,
          unit: rec.unit,
          totalQuantity: 0,
          totalAmountAFN: 0,
          totalAmountUSD: 0,
          distinctBuyersCount: 0,
          distinctInvoicesCount: 0,
          buyersNames: [],
          currentStock: (prod as any)?.currentStock ?? (prod?.initialStockTons ?? 0),
        };
        map.set(rec.productId, stat);
      }

      stat.totalQuantity += rec.quantity;
      if (rec.currency === 'AFN') {
        stat.totalAmountAFN += rec.totalAmount;
      } else {
        stat.totalAmountUSD += rec.totalAmount;
      }

      if (!stat.buyersNames.includes(rec.partyName)) {
        stat.buyersNames.push(rec.partyName);
      }
    });

    // Populate distinct counts
    map.forEach(stat => {
      stat.distinctBuyersCount = stat.buyersNames.length;
      stat.distinctInvoicesCount = new Set(
        allSoldRecords.filter(r => r.productId === stat.productId).map(r => r.invoiceId)
      ).size;
    });

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [allSoldRecords, productMap]);

  // Filtered records for the chosen specific product (or all products)
  const displayedRecords = useMemo(() => {
    return allSoldRecords.filter(rec => {
      if (selectedProductId !== 'all' && rec.productId !== selectedProductId) {
        return false;
      }

      if (buyerSearchQuery.trim()) {
        const q = buyerSearchQuery.toLowerCase();
        const matchBuyer = rec.partyName.toLowerCase().includes(q);
        const matchInvoice = rec.invoiceNumber.toLowerCase().includes(q);
        const matchPhone = (rec.partyPhone || '').includes(q);
        const matchProduct = rec.productName.toLowerCase().includes(q);
        if (!matchBuyer && !matchInvoice && !matchPhone && !matchProduct) return false;
      }

      return true;
    });
  }, [allSoldRecords, selectedProductId, buyerSearchQuery]);

  // Summary metrics for the selected product (or overall displayed)
  const currentSelectionSummary = useMemo(() => {
    let totalQty = 0;
    let totalAFN = 0;
    let totalUSD = 0;
    const buyerNames = new Set<string>();
    const invoiceIds = new Set<string>();

    displayedRecords.forEach(r => {
      totalQty += r.quantity;
      if (r.currency === 'AFN') totalAFN += r.totalAmount;
      else totalUSD += r.totalAmount;

      buyerNames.add(r.partyName);
      invoiceIds.add(r.invoiceId);
    });

    const activeProd = selectedProductId !== 'all' ? productMap.get(selectedProductId) : null;

    return {
      totalQty,
      totalAFN,
      totalUSD,
      distinctBuyers: buyerNames.size,
      distinctInvoices: invoiceIds.size,
      unit: activeProd?.baseUnit || (activeProd as any)?.unit || displayedRecords[0]?.unit || 'واحد',
      currentStock: (activeProd as any)?.currentStock ?? activeProd?.initialStockTons,
      productName: activeProd?.name,
    };
  }, [displayedRecords, selectedProductId, productMap]);

  // Filter product options for the dropdown
  const filteredProductOptions = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      p => p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 font-sans" dir="rtl">
      {/* ---------------- 1. HEADER & FILTER BAR ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0 shadow-2xs">
              <Boxes className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
                <span>تفکیک فروش کالاها و گزارش خریداران</span>
                <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                  Itemized Sales & Buyers
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                مشخص کنید امروز از یک جنس مشخص چه مقدار، با چه قیمتی و به چه کسانی فروش انجام شده است
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="چاپ گزارش تفکیکی فروش اجناس"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>چاپ گزارش</span>
            </button>

            {onOpenNewSale && (
              <button
                type="button"
                onClick={onOpenNewSale}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ثبت فاکتور فروش جدید</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Row: Date Presets & Product Selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* 1. Date Selector Tabs (Columns 1 to 4) */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>بازه زمانی فروشات:</span>
            </label>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDateFilter('today')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  dateFilter === 'today'
                    ? 'bg-blue-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>فروشات امروز</span>
                <span className="text-[10px] opacity-80 font-mono">({getPersianDate()})</span>
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('this_month')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilter === 'this_month'
                    ? 'bg-blue-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ماه جاری
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                کل تاریخ‌ها
              </button>
            </div>
          </div>

          {/* 2. Specific Product Dropdown Selector (Columns 5 to 9) */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>انتخاب جنس مشخص برای تفکیک:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {products.length} قلم کالا ثبت‌شده
              </span>
            </label>
            <div className="relative">
              <select
                id="select-itemized-product"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white text-xs font-bold text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition cursor-pointer"
              >
                <option value="all">📦 همه کالاها (نمایش تجمیعی تمام اجناس فروخته‌شده)</option>
                {filteredProductOptions.map(p => {
                  const stat = productsAggregated.find(s => s.productId === p.id);
                  const soldQty = stat ? stat.totalQuantity : 0;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `[کد: ${p.code}]` : ''} - {soldQty > 0 ? `(امروز ${soldQty} ${p.baseUnit || (p as any)?.unit || ''} فروش)` : '(بدون فروش امروز)'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 3. Currency Filter (Columns 10 to 12) */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">فیلتر ارز فاکتور:</label>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCurrencyFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  currencyFilter === 'all'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                همه ارزها
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('AFN')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  currencyFilter === 'AFN'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                افغانی (؋)
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('USD')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  currencyFilter === 'USD'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                دلار ($)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 2. SUMMARY KPI STATS CARDS FOR SELECTED PRODUCT ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: کل مقدار فروش رفته */}
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {dateFilter === 'today' ? 'مقدار کل فروش امروز' : 'مقدار کل فروش این دوره'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-black text-blue-700 tracking-tight">
              {formatNumber(currentSelectionSummary.totalQty)}
            </span>
            <span className="text-xs font-bold text-slate-500 font-sans">
              {currentSelectionSummary.unit}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {selectedProductId === 'all'
              ? `${productsAggregated.length} قلم کالای مختلف فروخته شده`
              : `از کالا: ${currentSelectionSummary.productName}`}
          </p>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />
        </div>

        {/* Metric 2: به چند خریدار / مشتری فروخته شده */}
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تعداد خریداران / مشتریان</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {currentSelectionSummary.distinctBuyers}
            </span>
            <span className="text-xs font-bold text-slate-500 font-sans">مشتری متمایز</span>
          </div>
          <p className="text-[11px] text-slate-400">
            در قالب {currentSelectionSummary.distinctInvoices} فاکتور فروش ثبت‌شده
          </p>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500" />
        </div>

        {/* Metric 3: مجموع ارزش فروش افغانی */}
        <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع فروش به افغانی</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono dir-ltr text-right">
            <span className="text-xl md:text-2xl font-black text-purple-700 tracking-tight">
              {formatNumber(currentSelectionSummary.totalAFN)}
            </span>
            <span className="text-xs font-bold text-slate-500 font-sans">AFN</span>
          </div>
          <p className="text-[11px] text-slate-400">گردش فروش افغانی اقلام انتخابی</p>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-purple-500" />
        </div>

        {/* Metric 4: مجموع ارزش فروش دلاری */}
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مجموع فروش به دلار</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono dir-ltr text-right">
            <span className="text-xl md:text-2xl font-black text-amber-700 tracking-tight">
              ${formatNumber(currentSelectionSummary.totalUSD)}
            </span>
            <span className="text-xs font-bold text-slate-500 font-sans">USD</span>
          </div>
          <p className="text-[11px] text-slate-400">گردش فروش دلاری اقلام انتخابی</p>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500" />
        </div>
      </div>

      {/* Dedicated Highlight Card when a specific product is selected */}
      {selectedProductId !== 'all' && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-300 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  تفکیک اختصاصی جنس:
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {currentSelectionSummary.productName}
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {dateFilter === 'today' ? 'امروز' : 'در این بازه'} دقیقا{' '}
                <strong className="text-emerald-700 font-mono font-black">
                  {formatNumber(currentSelectionSummary.totalQty)} {currentSelectionSummary.unit}
                </strong>{' '}
                از این جنس به{' '}
                <strong className="text-emerald-700 font-mono font-black">
                  {currentSelectionSummary.distinctBuyers} خریدار مختلف
                </strong>{' '}
                به شرح جدول زیر فروش شده است:
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedProductId('all')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start md:self-center shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>مشاهده همه کالاها</span>
          </button>
        </div>
      )}

      {/* ---------------- 3. PRODUCTS OVERVIEW HORIZONTAL CARDS STRIP ---------------- */}
      {selectedProductId === 'all' && productsAggregated.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span>فهرست اجناس فروخته‌شده {dateFilter === 'today' ? 'امروز' : 'این دوره'} (کلیک روی هر کالا جهت فیلتر خریداران):</span>
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {productsAggregated.length} قلم دارای فروش
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {productsAggregated.map(stat => (
              <div
                key={stat.productId}
                onClick={() => setSelectedProductId(stat.productId)}
                className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer flex flex-col justify-between space-y-2 group shadow-2xs"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                      {stat.productName}
                    </h4>
                    {stat.productCode && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        کد: {stat.productCode}
                      </span>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
                    {stat.distinctBuyersCount} خریدار
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="font-mono font-black text-slate-800">
                    {formatNumber(stat.totalQuantity)} {stat.unit}
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 group-hover:translate-x-[-2px] transition flex items-center gap-0.5">
                    <span>مشاهده خریداران</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 4. DETAILED BUYERS BREAKDOWN TABLE («به چه کسانی فروش شده») ---------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-0">
        {/* Table Top Header with Buyer Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" />
            <h4 className="font-bold text-xs md:text-sm text-slate-900">
              {selectedProductId === 'all'
                ? `ریز خریداران و اقلام فروخته‌شده ${dateFilter === 'today' ? 'امروز' : 'دوره'} (${displayedRecords.length} ردیف)`
                : `خریداران کالا «${currentSelectionSummary.productName}» در ${dateFilter === 'today' ? 'امروز' : 'دوره'} (${displayedRecords.length} مشتری)`}
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {selectedProductId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedProductId('all')}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>نمایش همه کالاها</span>
              </button>
            )}

            <div className="relative">
              <input
                type="text"
                value={buyerSearchQuery}
                onChange={e => setBuyerSearchQuery(e.target.value)}
                placeholder="جستجوی نام خریدار یا شماره فاکتور..."
                className="bg-white text-xs font-medium text-slate-800 placeholder-slate-400 px-3 py-1.5 pl-8 rounded-xl border border-slate-200 focus:border-blue-500 outline-none w-56 transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {displayedRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-3.5 font-bold">نام خریدار (طرف حساب)</th>
                  <th className="py-3 px-3.5 font-bold">کالای فروخته‌شده</th>
                  <th className="py-3 px-3.5 font-bold text-center">مقدار فروش رفته</th>
                  <th className="py-3 px-3.5 font-bold text-left">قیمت فی واحد</th>
                  <th className="py-3 px-3.5 font-bold text-left">مجموع مبلغ</th>
                  <th className="py-3 px-3.5 font-bold">شماره فاکتور</th>
                  <th className="py-3 px-3.5 font-bold">ساعت / تاریخ</th>
                  <th className="py-3 px-3.5 font-bold">گدام تحویل بار</th>
                  <th className="py-3 px-3.5 font-bold text-center">نوع تسویه</th>
                  <th className="py-3 px-3.5 font-bold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedRecords.map(rec => (
                  <tr
                    key={rec.id}
                    onClick={() => onViewInvoice(rec.invoiceId)}
                    className="hover:bg-blue-50/60 transition cursor-pointer"
                  >
                    {/* خریدار */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                          {rec.partyName.slice(0, 1)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{rec.partyName}</span>
                          {rec.partyPhone && (
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400" />
                              <span>{rec.partyPhone}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* کالا */}
                    <td className="py-3 px-3.5">
                      <div>
                        <span className="font-bold text-slate-800 block">{rec.productName}</span>
                        {rec.productCode && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            کد: {rec.productCode}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* مقدار فروش رفته */}
                    <td className="py-3 px-3.5 text-center font-mono font-black text-sm text-blue-700">
                      {formatNumber(rec.quantity)} {rec.unit}
                    </td>

                    {/* قیمت فی */}
                    <td className="py-3 px-3.5 font-mono text-left text-slate-700 dir-ltr">
                      {formatNumber(rec.unitPrice)} {rec.currency}
                    </td>

                    {/* مجموع مبلغ */}
                    <td className="py-3 px-3.5 font-mono font-black text-left text-slate-900 dir-ltr">
                      {formatNumber(rec.totalAmount)} {rec.currency}
                    </td>

                    {/* شماره فاکتور */}
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-600">
                      #{rec.invoiceNumber}
                    </td>

                    {/* زمان صدور */}
                    <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                      {rec.issueTime ? `${rec.issueTime} · ` : ''}{rec.date}
                    </td>

                    {/* گدام */}
                    <td className="py-3 px-3.5 text-slate-600 text-[11px]">
                      {rec.warehouseName}
                    </td>

                    {/* نحوه تسویه */}
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          !rec.isCredit
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {!rec.isCredit ? 'نقدی تسویه' : 'قرضه (نسیه)'}
                      </span>
                    </td>

                    {/* عملیات */}
                    <td className="py-3 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onViewInvoice(rec.invoiceId);
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                        title="مشاهده فاکتور این فروش"
                      >
                        مشاهده فاکتور
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3 bg-white">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
              <Boxes className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800">
              {dateFilter === 'today'
                ? `هیچ فروشی برای ${selectedProductId === 'all' ? 'اجناس' : 'این کالا'} در تاریخ امروز (${getPersianDate()}) ثبت نشده است`
                : 'موردی با فیلترهای مشخص‌شده یافت نشد'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              به محض ثبت فاکتور فروش برای این کالا، لیست دقیق خریداران، ساعات فروش، مقادیر و مبالغ در این بخش نمایش داده می‌شود.
            </p>
            {onOpenNewSale && (
              <button
                type="button"
                onClick={onOpenNewSale}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto cursor-pointer shadow-2xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت فاکتور فروش برای این کالا</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

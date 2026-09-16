import React, { useState, useEffect, useMemo } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Party, Product, Invoice, FinancialTransaction, Unit, Currency } from '../types';
import { formatNumber, formatCurrency, getPersianDate, calculateBagsAndTons, isDateInRange } from '../utils/formatters';
import { PartyCardexModal } from './PartyCardexModal';
import { ProductCardexModal } from './ProductCardexModal';
import { FixedAssetsView } from './FixedAssetsView';
import { ShareholdersView } from './ShareholdersView';
import {
  FileBarChart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText,
  DollarSign,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  Printer,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Building,
  Briefcase,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Warehouse as WarehouseIcon,
  ShieldCheck,
  Percent,
  PieChart,
  Calendar,
  X,
  Tag,
  BarChart2,
} from 'lucide-react';
import { ProductSalesAnalysis } from './ProductSalesAnalysis';

export type ReportSection =
  | 'parties'       // گزارش و مانده اشخاص (بدهکاران و بستانکاران)
  | 'inventory'     // موجودی کالا (کلی و به تفکیک گدام‌ها)
  | 'sales'         // گزارش فروشات
  | 'product_sales' // فروش کالاها (روزانه • ماهانه • سالانه)
  | 'purchases'     // گزارش خریدها
  | 'expenses'      // گزارش هزینه‌ها و مصارف
  | 'profit_loss'   // سود و زیان (P&L)
  | 'balance_sheet' // ترازنامه و بیلاننس
  | 'journal'       // اسناد حسابداری و دفتر روزنامه
  | 'fixed_assets'  // دارایی‌های ثابت و تجهیزات
  | 'shareholders'  // امور سهامداران و شرکا
  | 'backup';       // پشتیبان‌گیری و پایگاه داده

interface ReportsViewProps {
  initialSection?: string;
  onViewInvoice?: (id: string) => void;
  onOpenPaymentModal?: (type: 'receive_payment' | 'make_payment', partyId?: string) => void;
  onOpenTransferModal?: (warehouseId?: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  initialSection = 'parties',
  onViewInvoice,
  onOpenPaymentModal,
  onOpenTransferModal,
}) => {
  const {
    cashRegister,
    parties,
    partyGroups,
    invoices,
    stocks,
    warehouses,
    products,
    productCategories: definedProductCategories,
    transactions,
    expenses,
    expenseCategories,
    createExpense,
    deleteExpense,
    incomes,
    incomeCategories,
    calculateTotalStockValue,
    getProductStock,
    getWarehouseStockDetails,
    exportJSON,
    importJSON,
    resetToDemoData,
    resetNewFinancialYear,
    resetWipeCleanAll,
    openPrintModal,
    baseCurrency,
    convertToBase,
  } = useAccounting();

  // Normalizer for sub-report section
  const normalizeReportSection = (sec?: string): ReportSection => {
    if (!sec || sec === 'all') return 'parties';
    if (sec === 'pnl' || sec === 'profit_loss' || sec === 'profit') return 'profit_loss';
    if (sec === 'balance' || sec === 'balance_sheet') return 'balance_sheet';
    return sec as ReportSection;
  };

  // Active sub-report section
  const [activeSection, setActiveSection] = useState<ReportSection>(() =>
    normalizeReportSection(initialSection)
  );

  // Synchronize when initialSection prop updates from sidebar
  useEffect(() => {
    if (initialSection) {
      setActiveSection(normalizeReportSection(initialSection));
    }
  }, [initialSection]);

  // Cardex modal targets
  const [selectedPartyForCardex, setSelectedPartyForCardex] = useState<Party | null>(null);
  const [selectedProductForCardex, setSelectedProductForCardex] = useState<Product | null>(null);

  // Status for backup/import
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 1. PARTY BALANCES (گزارش و مانده اشخاص)
  // -------------------------------------------------------------
  const [partyStatusFilter, setPartyStatusFilter] = useState<'all' | 'debtors' | 'creditors' | 'settled'>('all');
  const [partyCurrencyFilter, setPartyCurrencyFilter] = useState<'all' | 'afn' | 'usd' | 'both'>('all');
  const [partyGroupFilter, setPartyGroupFilter] = useState<string>('all');
  const [partySearchQuery, setPartySearchQuery] = useState<string>('');
  const [partySortBy, setPartySortBy] = useState<'max_debt' | 'max_credit' | 'name' | 'activity'>('max_debt');

  // Filtered & Sorted Parties List
  const filteredParties = useMemo(() => {
    return parties
      .filter(p => {
        // Status filter (balance < 0 means they owe us = بدهکار, balance > 0 means we owe them = بستانکار)
        const isDebtor = p.balanceAFN < 0 || p.balanceUSD < 0;
        const isCreditor = p.balanceAFN > 0 || p.balanceUSD > 0;
        const isSettled = p.balanceAFN === 0 && p.balanceUSD === 0;

        if (partyStatusFilter === 'debtors' && !isDebtor) return false;
        if (partyStatusFilter === 'creditors' && !isCreditor) return false;
        if (partyStatusFilter === 'settled' && !isSettled) return false;

        // Currency filter
        if (partyCurrencyFilter === 'afn' && p.balanceAFN === 0) return false;
        if (partyCurrencyFilter === 'usd' && p.balanceUSD === 0) return false;
        if (partyCurrencyFilter === 'both' && (p.balanceAFN === 0 || p.balanceUSD === 0)) return false;

        // Group filter
        if (partyGroupFilter !== 'all' && p.groupId !== partyGroupFilter) return false;

        // Search query
        if (partySearchQuery.trim()) {
          const q = partySearchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchCompany = (p.company || '').toLowerCase().includes(q);
          const matchPhone = (p.phone || '').includes(q);
          const matchGroup = (p.groupName || '').toLowerCase().includes(q);
          if (!matchName && !matchCompany && !matchPhone && !matchGroup) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (partySortBy === 'name') {
          return a.name.localeCompare(b.name, 'fa');
        }
        if (partySortBy === 'max_debt') {
          // Sum debt in AFN equivalent (negative balances)
          const debtA =
            (a.balanceAFN < 0 ? Math.abs(a.balanceAFN) : 0) +
            (a.balanceUSD < 0 ? Math.abs(a.balanceUSD) * (cashRegister.usdToAfnRate || 70.8) : 0);
          const debtB =
            (b.balanceAFN < 0 ? Math.abs(b.balanceAFN) : 0) +
            (b.balanceUSD < 0 ? Math.abs(b.balanceUSD) * (cashRegister.usdToAfnRate || 70.8) : 0);
          return debtB - debtA;
        }
        if (partySortBy === 'max_credit') {
          const credA =
            (a.balanceAFN > 0 ? a.balanceAFN : 0) +
            (a.balanceUSD > 0 ? a.balanceUSD * (cashRegister.usdToAfnRate || 70.8) : 0);
          const credB =
            (b.balanceAFN > 0 ? b.balanceAFN : 0) +
            (b.balanceUSD > 0 ? b.balanceUSD * (cashRegister.usdToAfnRate || 70.8) : 0);
          return credB - credA;
        }
        return 0;
      });
  }, [parties, partyStatusFilter, partyCurrencyFilter, partyGroupFilter, partySearchQuery, partySortBy, cashRegister.usdToAfnRate]);

  // Party Balances KPI aggregations
  const partyMetrics = useMemo(() => {
    let totalDebtorsCount = 0;
    let totalCreditorsCount = 0;
    let totalSettledCount = 0;

    let debtAFN = 0;
    let debtUSD = 0;
    let creditAFN = 0;
    let creditUSD = 0;

    parties.forEach(p => {
      if (p.balanceAFN < 0) debtAFN += Math.abs(p.balanceAFN);
      if (p.balanceAFN > 0) creditAFN += p.balanceAFN;

      if (p.balanceUSD < 0) debtUSD += Math.abs(p.balanceUSD);
      if (p.balanceUSD > 0) creditUSD += p.balanceUSD;

      if (p.balanceAFN < 0 || p.balanceUSD < 0) totalDebtorsCount++;
      else if (p.balanceAFN > 0 || p.balanceUSD > 0) totalCreditorsCount++;
      else totalSettledCount++;
    });

    const netReceivablesAFN = debtAFN - creditAFN + (debtUSD - creditUSD) * (cashRegister.usdToAfnRate || 70.8);

    return {
      debtAFN,
      debtUSD,
      creditAFN,
      creditUSD,
      totalDebtorsCount,
      totalCreditorsCount,
      totalSettledCount,
      netReceivablesAFN,
    };
  }, [parties, cashRegister.usdToAfnRate]);

  // -------------------------------------------------------------
  // 2. PRODUCT INVENTORY (موجودی کالا کلی و در گدام‌ها)
  // -------------------------------------------------------------
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState<string>('all');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [stockSearchQuery, setStockSearchQuery] = useState<string>('');

  const stockStats = calculateTotalStockValue();

  // Categories list for filter
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    if (definedProductCategories && definedProductCategories.length > 0) {
      definedProductCategories.forEach(c => {
        if (c.name?.trim()) cats.add(c.name.trim());
      });
    }
    products.forEach(p => {
      if (p.category?.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [definedProductCategories, products]);

  // All Products with Stock Calculations for Inventory Table
  const allProductsWithStock = useMemo(() => {
    return products.map(prod => {
      // Overall stock across all warehouses
      const overallStock = getProductStock(prod.id);

      // Stock in each warehouse
      const warehouseBreakdown = warehouses.map(wh => {
        const whStock = getProductStock(prod.id, wh.id);
        return {
          warehouseId: wh.id,
          warehouseName: wh.name,
          warehouseType: wh.type,
          tons: whStock.tons,
          bags: whStock.bags,
        };
      });

      const minThreshold = prod.minStockTons !== undefined && prod.minStockTons !== null ? prod.minStockTons : 5;
      const isOut = overallStock.tons <= 0;
      const isLow = !isOut && overallStock.tons <= minThreshold;
      const isGood = overallStock.tons > minThreshold;
      const deficitTons = Math.max(0, parseFloat((minThreshold - overallStock.tons).toFixed(3)));
      const bagsPerTon = prod.bagsPerTon || (1000 / (prod.bagWeightKg || 50));
      const deficitBags = Math.round(deficitTons * bagsPerTon);

      // Value of this product
      const valueAFN = overallStock.tons * (prod.buyPriceAFN || 0);
      const valueUSD = overallStock.tons * (prod.buyPriceUSD || 0);

      return {
        product: prod,
        overallStock,
        warehouseBreakdown,
        minThreshold,
        deficitTons,
        deficitBags,
        isLow,
        isOut,
        isGood,
        valueAFN,
        valueUSD,
      };
    });
  }, [products, warehouses, getProductStock]);

  // Group stock summary: موجودی هر گروه
  const categoryStockSummary = useMemo(() => {
    const catMap = new Map<string, {
      name: string;
      productCount: number;
      totalTons: number;
      totalBags: number;
      valueAFN: number;
      valueUSD: number;
      lowCount: number;
      outCount: number;
    }>();

    // Initialize with all unique category names
    productCategories.forEach(catName => {
      catMap.set(catName, {
        name: catName,
        productCount: 0,
        totalTons: 0,
        totalBags: 0,
        valueAFN: 0,
        valueUSD: 0,
        lowCount: 0,
        outCount: 0,
      });
    });

    allProductsWithStock.forEach(item => {
      const catName = item.product.category?.trim() || 'عمومی';
      if (!catMap.has(catName)) {
        catMap.set(catName, {
          name: catName,
          productCount: 0,
          totalTons: 0,
          totalBags: 0,
          valueAFN: 0,
          valueUSD: 0,
          lowCount: 0,
          outCount: 0,
        });
      }
      const entry = catMap.get(catName)!;
      entry.productCount += 1;

      // Calculate stock based on selected warehouse or all warehouses
      let prodTons = item.overallStock.tons;
      let prodBags = item.overallStock.bags;
      if (stockWarehouseFilter !== 'all') {
        const whItem = item.warehouseBreakdown.find(w => w.warehouseId === stockWarehouseFilter);
        prodTons = whItem ? whItem.tons : 0;
        prodBags = whItem ? whItem.bags : 0;
      }

      entry.totalTons += prodTons;
      entry.totalBags += prodBags;
      entry.valueAFN += prodTons * (item.product.buyPriceAFN || 0);
      entry.valueUSD += prodTons * (item.product.buyPriceUSD || 0);

      if (item.isLow) entry.lowCount += 1;
      if (item.isOut) entry.outCount += 1;
    });

    return Array.from(catMap.values()).sort((a, b) => b.totalTons - a.totalTons);
  }, [productCategories, allProductsWithStock, stockWarehouseFilter]);

  // Filtered Products for Inventory Table
  const filteredProductsWithStock = useMemo(() => {
    return allProductsWithStock.filter(item => {
      // Category filter
      if (
        stockCategoryFilter !== 'all' &&
        item.product.category !== stockCategoryFilter &&
        item.product.categoryId !== stockCategoryFilter
      ) {
        return false;
      }

      // Status filter
      if (stockStatusFilter === 'available' && (item.isOut || item.isLow)) return false;
      if (stockStatusFilter === 'low' && !item.isLow) return false;
      if (stockStatusFilter === 'out' && !item.isOut) return false;

      // Warehouse filter (must have stock in selected warehouse)
      if (stockWarehouseFilter !== 'all') {
        const whItem = item.warehouseBreakdown.find(w => w.warehouseId === stockWarehouseFilter);
        if (!whItem || whItem.tons <= 0) return false;
      }

      // Search
      if (stockSearchQuery.trim()) {
        const q = stockSearchQuery.toLowerCase();
        const matchName = item.product.name.toLowerCase().includes(q);
        const matchCode = (item.product.code || '').toLowerCase().includes(q);
        const matchCat = (item.product.category || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }

      return true;
    });
  }, [allProductsWithStock, stockCategoryFilter, stockStatusFilter, stockWarehouseFilter, stockSearchQuery]);

  // -------------------------------------------------------------
  // 3. SALES REPORT (گزارش فروشات)
  // -------------------------------------------------------------
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesCurrencyFilter, setSalesCurrencyFilter] = useState<'all' | 'AFN' | 'USD'>('all');

  const sellInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === 'sell');
  }, [invoices]);

  const filteredSellInvoices = useMemo(() => {
    return sellInvoices.filter(inv => {
      if (salesCurrencyFilter !== 'all' && inv.currency !== salesCurrencyFilter) return false;
      if (salesSearchQuery.trim()) {
        const q = salesSearchQuery.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.partyName.toLowerCase().includes(q) ||
          inv.date.includes(q)
        );
      }
      return true;
    });
  }, [sellInvoices, salesCurrencyFilter, salesSearchQuery]);

  const salesAggregations = useMemo(() => {
    let totalAFN = 0;
    let totalUSD = 0;
    let paidAFN = 0;
    let paidUSD = 0;
    let debtAFN = 0;
    let debtUSD = 0;
    let totalTons = 0;
    let totalBags = 0;

    sellInvoices.forEach(inv => {
      if (inv.currency === 'AFN') {
        totalAFN += inv.totalAmount;
        paidAFN += inv.paidAmount;
        debtAFN += inv.balanceAmount;
      } else {
        totalUSD += inv.totalAmount;
        paidUSD += inv.paidAmount;
        debtUSD += inv.balanceAmount;
      }
      inv.items.forEach(it => {
        totalTons += it.tonsCount || 0;
        totalBags += it.bagsCount || 0;
      });
    });

    return { totalAFN, totalUSD, paidAFN, paidUSD, debtAFN, debtUSD, totalTons, totalBags };
  }, [sellInvoices]);

  // -------------------------------------------------------------
  // 4. PURCHASES REPORT (گزارش خریدها)
  // -------------------------------------------------------------
  const [buySearchQuery, setBuySearchQuery] = useState('');
  const [buyCurrencyFilter, setBuyCurrencyFilter] = useState<'all' | 'AFN' | 'USD'>('all');

  const buyInvoices = useMemo(() => {
    return invoices.filter(inv => inv.type === 'buy');
  }, [invoices]);

  const filteredBuyInvoices = useMemo(() => {
    return buyInvoices.filter(inv => {
      if (buyCurrencyFilter !== 'all' && inv.currency !== buyCurrencyFilter) return false;
      if (buySearchQuery.trim()) {
        const q = buySearchQuery.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.partyName.toLowerCase().includes(q) ||
          inv.date.includes(q)
        );
      }
      return true;
    });
  }, [buyInvoices, buyCurrencyFilter, buySearchQuery]);

  const buyAggregations = useMemo(() => {
    let totalAFN = 0;
    let totalUSD = 0;
    let paidAFN = 0;
    let paidUSD = 0;
    let payableAFN = 0;
    let payableUSD = 0;
    let totalTons = 0;
    let totalBags = 0;

    buyInvoices.forEach(inv => {
      if (inv.currency === 'AFN') {
        totalAFN += inv.totalAmount;
        paidAFN += inv.paidAmount;
        payableAFN += inv.balanceAmount;
      } else {
        totalUSD += inv.totalAmount;
        paidUSD += inv.paidAmount;
        payableUSD += inv.balanceAmount;
      }
      inv.items.forEach(it => {
        totalTons += it.tonsCount || 0;
        totalBags += it.bagsCount || 0;
      });
    });

    return { totalAFN, totalUSD, paidAFN, paidUSD, payableAFN, payableUSD, totalTons, totalBags };
  }, [buyInvoices]);

  // -------------------------------------------------------------
  // 5. EXPENSES & COSTS (هزینه‌ها و مصارف واقعی از سیستم)
  // -------------------------------------------------------------
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpCategoryId, setNewExpCategoryId] = useState('');
  const [newExpAmount, setNewExpAmount] = useState<number>(0);
  const [newExpCurrency, setNewExpCurrency] = useState<Currency>('AFN');
  const [newExpRecipient, setNewExpRecipient] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpTitle || newExpAmount <= 0) return;

    const selectedCat = expenseCategories.find(c => c.id === newExpCategoryId) || expenseCategories[0];

    createExpense({
      title: newExpTitle,
      categoryId: selectedCat?.id || 'exp-cat-transport',
      categoryName: selectedCat?.name || 'ترانسپورت و کرایه',
      amount: newExpAmount,
      currency: newExpCurrency,
      date: getPersianDate(),
      recipient: newExpRecipient || 'متفرقه',
      cashRegisterId: newExpCurrency === 'USD' ? 'usd_cash' : 'afn_cash',
      cashRegisterName: newExpCurrency === 'USD' ? 'صندوق شرکت دالری' : 'صندوق پولی افغانی',
    });

    setNewExpTitle('');
    setNewExpAmount(0);
    setNewExpRecipient('');
    setIsAddingExpense(false);
  };

  const totalExpensesAFN = useMemo(() => {
    return expenses.filter(e => e.currency === 'AFN').reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const totalExpensesUSD = useMemo(() => {
    return expenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const totalExpEquivalentAFN = useMemo(() => {
    const rate = cashRegister.usdToAfnRate || 70.8;
    return totalExpensesAFN + totalExpensesUSD * rate;
  }, [totalExpensesAFN, totalExpensesUSD, cashRegister.usdToAfnRate]);

  // Breakdown of expenses by category
  const expenseCategoryBreakdown = useMemo(() => {
    const map: Record<string, { id: string; name: string; amountAFN: number; amountUSD: number; color?: string }> = {};

    expenseCategories.forEach(cat => {
      map[cat.id] = { id: cat.id, name: cat.name, amountAFN: 0, amountUSD: 0, color: cat.color };
    });

    expenses.forEach(exp => {
      const catId = exp.categoryId || 'other';
      if (!map[catId]) {
        map[catId] = { id: catId, name: exp.categoryName || 'متفرقه', amountAFN: 0, amountUSD: 0 };
      }
      if (exp.currency === 'AFN') {
        map[catId].amountAFN += exp.amount;
      } else {
        map[catId].amountUSD += exp.amount;
      }
    });

    return Object.values(map).filter(cat => cat.amountAFN > 0 || cat.amountUSD > 0);
  }, [expenses, expenseCategories]);

  // -------------------------------------------------------------
  // 6. PROFIT & LOSS (سود و زیان تجارتی بر مبنای داده‌های واقعی و دوره مالی)
  // -------------------------------------------------------------
  const [pnlPeriod, setPnlPeriod] = useState<'all' | 'today' | 'month' | 'year' | 'custom'>('all');
  const [pnlStartDate, setPnlStartDate] = useState<string>('');
  const [pnlEndDate, setPnlEndDate] = useState<string>('');

  const effectivePnlDateRange = useMemo(() => {
    const today = getPersianDate();
    if (pnlPeriod === 'today') {
      return { from: today, to: today };
    }
    if (pnlPeriod === 'month') {
      const parts = today.split('/');
      if (parts.length >= 2) {
        return { from: `${parts[0]}/${parts[1]}/01`, to: `${parts[0]}/${parts[1]}/31` };
      }
    }
    if (pnlPeriod === 'year') {
      const parts = today.split('/');
      if (parts.length >= 1) {
        return { from: `${parts[0]}/01/01`, to: `${parts[0]}/12/29` };
      }
    }
    if (pnlPeriod === 'custom') {
      return { from: pnlStartDate, to: pnlEndDate };
    }
    return { from: '', to: '' };
  }, [pnlPeriod, pnlStartDate, pnlEndDate]);

  // Filtered sales invoices for P&L period
  const pnlSellInvoices = useMemo(() => {
    return sellInvoices.filter(inv => {
      if (effectivePnlDateRange.from || effectivePnlDateRange.to) {
        return isDateInRange(inv.date, effectivePnlDateRange.from, effectivePnlDateRange.to);
      }
      return true;
    });
  }, [sellInvoices, effectivePnlDateRange]);

  // Filtered expenses for P&L period
  const pnlExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (effectivePnlDateRange.from || effectivePnlDateRange.to) {
        return isDateInRange(exp.date, effectivePnlDateRange.from, effectivePnlDateRange.to);
      }
      return true;
    });
  }, [expenses, effectivePnlDateRange]);

  // Filtered incomes for P&L period
  const pnlIncomes = useMemo(() => {
    return (incomes || []).filter(inc => {
      if (effectivePnlDateRange.from || effectivePnlDateRange.to) {
        return isDateInRange(inc.date, effectivePnlDateRange.from, effectivePnlDateRange.to);
      }
      return true;
    });
  }, [incomes, effectivePnlDateRange]);

  // Sales totals for P&L
  const pnlSalesTotals = useMemo(() => {
    let totalAFN = 0;
    let totalUSD = 0;
    pnlSellInvoices.forEach(inv => {
      if (inv.currency === 'AFN') {
        totalAFN += inv.totalAmount;
      } else {
        totalUSD += inv.totalAmount;
      }
    });
    return { totalAFN, totalUSD };
  }, [pnlSellInvoices]);

  // Calculate real COGS from sold invoice items and product buy prices
  const cogsCalculations = useMemo(() => {
    let cogsAFN = 0;
    let cogsUSD = 0;

    pnlSellInvoices.forEach(inv => {
      inv.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        const buyPriceAFN = prod?.buyPriceAFN || 0;
        const buyPriceUSD = prod?.buyPriceUSD || 0;
        const tons = it.tonsCount || (it.unit === 'ton' ? it.quantity : it.quantity / 20);

        if (inv.currency === 'AFN') {
          cogsAFN += tons * buyPriceAFN;
        } else {
          cogsUSD += tons * buyPriceUSD;
        }
      });
    });

    return { cogsAFN, cogsUSD };
  }, [pnlSellInvoices, products]);

  const grossProfitAFN = pnlSalesTotals.totalAFN - cogsCalculations.cogsAFN;
  const grossProfitUSD = pnlSalesTotals.totalUSD - cogsCalculations.cogsUSD;
  const totalGrossProfitEquivalentBase = convertToBase(grossProfitAFN, 'AFN') + convertToBase(grossProfitUSD, 'USD');

  // P&L Expenses totals
  const pnlExpensesAFN = useMemo(() => {
    return pnlExpenses.filter(e => e.currency === 'AFN').reduce((sum, e) => sum + e.amount, 0);
  }, [pnlExpenses]);

  const pnlExpensesUSD = useMemo(() => {
    return pnlExpenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + e.amount, 0);
  }, [pnlExpenses]);

  const pnlTotalExpEquivalentBase = useMemo(() => {
    return convertToBase(pnlExpensesAFN, 'AFN') + convertToBase(pnlExpensesUSD, 'USD');
  }, [pnlExpensesAFN, pnlExpensesUSD, convertToBase]);

  // P&L Incomes totals
  const pnlIncomesAFN = useMemo(() => {
    return pnlIncomes.filter(i => i.currency === 'AFN').reduce((sum, i) => sum + i.amount, 0);
  }, [pnlIncomes]);

  const pnlIncomesUSD = useMemo(() => {
    return pnlIncomes.filter(i => i.currency === 'USD').reduce((sum, i) => sum + i.amount, 0);
  }, [pnlIncomes]);

  const pnlTotalIncomeEquivalentBase = useMemo(() => {
    return convertToBase(pnlIncomesAFN, 'AFN') + convertToBase(pnlIncomesUSD, 'USD');
  }, [pnlIncomesAFN, pnlIncomesUSD, convertToBase]);

  // Income category breakdown for P&L display
  const pnlIncomeCategoryBreakdown = useMemo(() => {
    const map: Record<string, { id: string; name: string; amountAFN: number; amountUSD: number }> = {};
    (incomeCategories || []).forEach(cat => {
      map[cat.id] = { id: cat.id, name: cat.name, amountAFN: 0, amountUSD: 0 };
    });
    pnlIncomes.forEach(inc => {
      const catId = inc.categoryId || 'other';
      if (!map[catId]) {
        map[catId] = { id: catId, name: inc.categoryName || 'عایدات متفرقه', amountAFN: 0, amountUSD: 0 };
      }
      if (inc.currency === 'AFN') {
        map[catId].amountAFN += inc.amount;
      } else {
        map[catId].amountUSD += inc.amount;
      }
    });
    return Object.values(map).filter(cat => cat.amountAFN > 0 || cat.amountUSD > 0);
  }, [pnlIncomes, incomeCategories]);

  // Net Operating Profit = (Gross Profit + Incomes) - Operating Expenses
  const netProfitBase = (totalGrossProfitEquivalentBase + pnlTotalIncomeEquivalentBase) - pnlTotalExpEquivalentBase;

  // -------------------------------------------------------------
  // 7. BALANCE SHEET (ترازنامه و بیلاننس مالی)
  // -------------------------------------------------------------
  const totalAssetsAFN =
    cashRegister.afnBalance +
    cashRegister.usdBalance * (cashRegister.usdToAfnRate || 70.8) +
    (cashRegister.exchangeUsdBalance || 0) * (cashRegister.usdToAfnRate || 70.8) +
    stockStats.afnValue +
    partyMetrics.debtAFN +
    partyMetrics.debtUSD * (cashRegister.usdToAfnRate || 70.8);

  const totalLiabilitiesAFN =
    partyMetrics.creditAFN + partyMetrics.creditUSD * (cashRegister.usdToAfnRate || 70.8);

  const netCompanyWorthAFN = totalAssetsAFN - totalLiabilitiesAFN;

  // -------------------------------------------------------------
  // 8. DYNAMIC DOUBLE-ENTRY ACCOUNTING JOURNAL (دفتر روزنامه و اسناد دوبل حسابداری)
  // -------------------------------------------------------------
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
  const [journalTypeFilter, setJournalTypeFilter] = useState<'all' | 'sales' | 'purchases' | 'payments' | 'expenses' | 'exchange'>('all');

  const journalEntries = useMemo(() => {
    const list: {
      id: string;
      voucherNo: string;
      date: string;
      title: string;
      description: string;
      debitTitle: string;
      creditTitle: string;
      amount: number;
      currency: Currency;
      type: 'sales' | 'purchases' | 'payments' | 'expenses' | 'exchange';
    }[] = [];

    // Sales Invoices -> Journal Vouchers
    invoices.filter(i => i.type === 'sell').forEach(inv => {
      list.push({
        id: `jv-sell-${inv.id}`,
        voucherNo: `VOU-${inv.invoiceNumber}`,
        date: inv.date,
        title: `سند فروش کالا (فاکتور ${inv.invoiceNumber})`,
        description: `فروش به ${inv.partyName} - اقلام: ${inv.items.map(it => it.productName).join('، ')}`,
        debitTitle: inv.paidAmount > 0 
          ? (inv.balanceAmount === 0 ? 'صندوق نقدی (دریافت کامل نقدی)' : `حساب دریافتنی (${inv.partyName}) + صندوق نقدی`)
          : `حساب‌های دریافتنی تجارتی (${inv.partyName})`,
        creditTitle: 'درآمد حاصل از فروش کالا',
        amount: inv.totalAmount,
        currency: inv.currency,
        type: 'sales',
      });
    });

    // Purchase Invoices -> Journal Vouchers
    invoices.filter(i => i.type === 'buy').forEach(inv => {
      list.push({
        id: `jv-buy-${inv.id}`,
        voucherNo: `VOU-${inv.invoiceNumber}`,
        date: inv.date,
        title: `سند خرید کالا (فاکتور خرید ${inv.invoiceNumber})`,
        description: `خرید از ${inv.partyName} - اقلام: ${inv.items.map(it => it.productName).join('، ')}`,
        debitTitle: 'موجودی کالای گدام‌ها / خرید تجارتی',
        creditTitle: inv.paidAmount > 0
          ? (inv.balanceAmount === 0 ? 'صندوق نقدی (پرداخت نقدی)' : `حساب‌های پرداختنی (${inv.partyName}) + صندوق`)
          : `حساب‌های پرداختنی تجارتی (${inv.partyName})`,
        amount: inv.totalAmount,
        currency: inv.currency,
        type: 'purchases',
      });
    });

    // Financial Transactions -> Journal Vouchers
    transactions.forEach(tx => {
      if (tx.type === 'receive_payment') {
        list.push({
          id: `jv-tx-${tx.id}`,
          voucherNo: `VOU-${tx.transactionNumber || tx.id.slice(-6)}`,
          date: tx.date,
          title: `سند دریافت وجه نقد / تسویه طلبات (${tx.partyName || 'مشتری'})`,
          description: tx.notes || `دریافت وجه از طرف حساب ${tx.partyName}`,
          debitTitle: tx.cashRegisterName || (tx.currency === 'USD' ? 'صندوق شرکت دالری' : 'صندوق پولی افغانی'),
          creditTitle: `حساب‌های دریافتنی (${tx.partyName || 'طرف حساب'})`,
          amount: tx.amount,
          currency: tx.currency,
          type: 'payments',
        });
      } else if (tx.type === 'make_payment') {
        list.push({
          id: `jv-tx-${tx.id}`,
          voucherNo: `VOU-${tx.transactionNumber || tx.id.slice(-6)}`,
          date: tx.date,
          title: `سند پرداخت وجه نقد / تسویه بدهی (${tx.partyName || 'تأمین‌کننده'})`,
          description: tx.notes || `پرداخت وجه به طرف حساب ${tx.partyName}`,
          debitTitle: `حساب‌های پرداختنی (${tx.partyName || 'طرف حساب'})`,
          creditTitle: tx.cashRegisterName || (tx.currency === 'USD' ? 'صندوق شرکت دالری' : 'صندوق پولی افغانی'),
          amount: tx.amount,
          currency: tx.currency,
          type: 'payments',
        });
      } else if (tx.type === 'currency_exchange') {
        list.push({
          id: `jv-tx-${tx.id}`,
          voucherNo: `VOU-${tx.transactionNumber || tx.id.slice(-6)}`,
          date: tx.date,
          title: `سند تبادله و تبدیل ارز (صرافی)`,
          description: tx.notes || `تبدیل ارز با نرخ برابری ${tx.exchangeRate || 1}`,
          debitTitle: 'صندوق مقصد (ارز دریافت شده)',
          creditTitle: 'صندوق مبدا (ارز پرداخت شده)',
          amount: tx.amount,
          currency: tx.currency,
          type: 'exchange',
        });
      }
    });

    // Expenses -> Journal Vouchers
    expenses.forEach(exp => {
      list.push({
        id: `jv-exp-${exp.id}`,
        voucherNo: `VOU-${exp.expenseNumber || exp.id.slice(-6)}`,
        date: exp.date,
        title: `سند هزینه ${exp.categoryName || 'جاری و اداری'}`,
        description: `${exp.title} • دریافت‌کننده: ${exp.recipient || 'متفرقه'}`,
        debitTitle: `هزینه‌های ${exp.categoryName || 'عملیاتی و تجارتی'}`,
        creditTitle: exp.cashRegisterName || (exp.currency === 'USD' ? 'صندوق شرکت دالری' : 'صندوق پولی افغانی'),
        amount: exp.amount,
        currency: exp.currency,
        type: 'expenses',
      });
    });

    // Sort descending by date
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, transactions, expenses]);

  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter(j => {
      if (journalTypeFilter !== 'all' && j.type !== journalTypeFilter) return false;
      if (journalSearchQuery.trim()) {
        const q = journalSearchQuery.toLowerCase();
        return (
          j.voucherNo.toLowerCase().includes(q) ||
          j.title.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          j.debitTitle.toLowerCase().includes(q) ||
          j.creditTitle.toLowerCase().includes(q) ||
          j.date.includes(q)
        );
      }
      return true;
    });
  }, [journalEntries, journalTypeFilter, journalSearchQuery]);

  // Backup handlers
  const handleDownloadBackup = () => {
    const jsonStr = exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hesabdar-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const success = importJSON(content);
      if (success) {
        setImportStatus('اطلاعات با موفقیت بازیابی شد.');
      } else {
        setImportStatus('خطا در فایل پشتیبان. فرمت نامعتبر است.');
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Top Header & Section Selector Tabs */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <FileBarChart className="w-7 h-7 text-indigo-600" />
              <span>مرکز گزارشات جامع، مانده اشخاص و حسابداری</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مشاهده طلبات، بدهیات، موجودی کالاها به تفکیک گدام، گزارش فروش و خرید، سود و زیان، و ترازنامه مالی
            </p>
          </div>

          {/* Quick Rate & Net Worth Badge */}
          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
            <span className="text-slate-500">نرخ روز صرافی:</span>
            <span className="font-mono text-emerald-700 font-black">1$ = {cashRegister.usdToAfnRate || 70.8} ؋</span>
            <div className="h-4 w-px bg-slate-300 mx-1" />
            <span className="text-slate-500">سرمایه خالص:</span>
            <span className="font-mono text-blue-700 font-black">{formatNumber(netCompanyWorthAFN)} ؋</span>
          </div>
        </div>

        {/* Scrollable Sub-Menu Navigation Tabs */}
        <div className="pt-4 flex items-center gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
          <button
            id="tab-btn-parties"
            onClick={() => setActiveSection('parties')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'parties'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>گزارش و مانده اشخاص (بدهکار/بستانکار)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${activeSection === 'parties' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {parties.length}
            </span>
          </button>

          <button
            id="tab-btn-inventory"
            onClick={() => setActiveSection('inventory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'inventory'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>موجودی کالا (کلی و در گدام‌ها)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${activeSection === 'inventory' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {products.length}
            </span>
          </button>

          <button
            id="tab-btn-sales"
            onClick={() => setActiveSection('sales')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'sales'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>گزارش فروشات</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${activeSection === 'sales' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {sellInvoices.length}
            </span>
          </button>

          <button
            id="tab-btn-product-sales"
            onClick={() => setActiveSection('product_sales')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'product_sales'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>فروش کالاها (روزانه/ماهانه/سالانه)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${activeSection === 'product_sales' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'}`}>
              تحلیلی
            </span>
          </button>

          <button
            id="tab-btn-purchases"
            onClick={() => setActiveSection('purchases')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'purchases'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>گزارش خریدها</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${activeSection === 'purchases' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {buyInvoices.length}
            </span>
          </button>

          <button
            id="tab-btn-expenses"
            onClick={() => setActiveSection('expenses')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'expenses'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>هزینه‌ها و مصارف</span>
          </button>

          <button
            id="tab-btn-profit-loss"
            onClick={() => setActiveSection('profit_loss')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'profit_loss'
                ? 'bg-teal-700 text-white shadow-sm shadow-teal-700/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>سود و زیان (P&L)</span>
          </button>

          <button
            id="tab-btn-balance-sheet"
            onClick={() => setActiveSection('balance_sheet')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'balance_sheet'
                ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>ترازنامه و بیلاننس</span>
          </button>

          <button
            id="tab-btn-journal"
            onClick={() => setActiveSection('journal')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'journal'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>اسناد حسابداری</span>
          </button>

          <button
            id="tab-btn-fixed-assets"
            onClick={() => setActiveSection('fixed_assets')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'fixed_assets'
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>دارایی‌های ثابت</span>
          </button>

          <button
            id="tab-btn-shareholders"
            onClick={() => setActiveSection('shareholders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'shareholders'
                ? 'bg-cyan-700 text-white shadow-sm shadow-cyan-700/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>امور سهامداران</span>
          </button>

          <button
            id="tab-btn-backup"
            onClick={() => setActiveSection('backup')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSection === 'backup'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>پشتیبان‌گیری</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECTION: PARTY BALANCES / گزارش و مانده اشخاص (بدهکاران و بستانکاران) */}
      {/* ========================================================================= */}
      {activeSection === 'parties' && (
        <div className="space-y-6">
          {/* Summary KPI Cards for Party Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Debtors in AFN & USD (Money owed to us) */}
            <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-xs space-y-2 bg-gradient-to-br from-rose-50/40 via-white to-white">
              <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                <span>طلبات ما از مشتریان (بدهکاران)</span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-mono">
                  {partyMetrics.totalDebtorsCount} نفر
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-black text-rose-700 font-mono">
                  {formatCurrency(partyMetrics.debtAFN, 'AFN')}
                </div>
                <div className="text-sm font-bold text-rose-600 font-mono">
                  {formatCurrency(partyMetrics.debtUSD, 'USD')}
                </div>
              </div>
              <p className="text-[10px] text-slate-400">مجموع قرضه مشتریان بابت فاکتورهای فروش</p>
            </div>

            {/* Creditors in AFN & USD (Money we owe to suppliers) */}
            <div className="bg-white p-5 rounded-3xl border border-blue-200/80 shadow-xs space-y-2 bg-gradient-to-br from-blue-50/40 via-white to-white">
              <div className="flex items-center justify-between text-xs font-bold text-blue-700">
                <span>بدهی ما به تأمین‌کنندگان (بستانکاران)</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">
                  {partyMetrics.totalCreditorsCount} نفر
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-black text-blue-700 font-mono">
                  {formatCurrency(partyMetrics.creditAFN, 'AFN')}
                </div>
                <div className="text-sm font-bold text-blue-600 font-mono">
                  {formatCurrency(partyMetrics.creditUSD, 'USD')}
                </div>
              </div>
              <p className="text-[10px] text-slate-400">مجموع مانده حساب و طلب فروشندگان و تجار</p>
            </div>

            {/* Net Receivables */}
            <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-xs space-y-2 bg-gradient-to-br from-emerald-50/40 via-white to-white">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                <span>خالص طلبات تجارتی (به معادل افغانی)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-800 font-mono">
                {formatNumber(partyMetrics.netReceivablesAFN)} ؋
              </div>
              <div className="text-xs font-bold text-slate-500 font-mono">
                معادل: ${formatNumber(partyMetrics.netReceivablesAFN / (cashRegister.usdToAfnRate || 70.8))}
              </div>
              <p className="text-[10px] text-slate-400">تفاضل طلبات منهای بدهی‌های تجارتی</p>
            </div>

            {/* Settled / Total Parties */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>وضعیت کلی حساب‌ها</span>
                <Users className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div>
                  <div className="text-lg font-black text-slate-900 font-mono">{parties.length}</div>
                  <div className="text-[10px] text-slate-400">کل طرف‌حساب‌ها</div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <div className="text-lg font-black text-slate-600 font-mono">{partyMetrics.totalSettledCount}</div>
                  <div className="text-[10px] text-slate-400">حساب‌های تسویه‌شده</div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">در {partyGroups.length} دسته‌بندی و گروه مجزا</p>
            </div>
          </div>

          {/* Search, Status Filter & Group Filter Bar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجوی نام شخص، شرکت، شماره تماس..."
                  value={partySearchQuery}
                  onChange={e => setPartySearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
                <button
                  onClick={() => setPartyStatusFilter('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    partyStatusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  همه ({parties.length})
                </button>
                <button
                  onClick={() => setPartyStatusFilter('debtors')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    partyStatusFilter === 'debtors'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  بدهکاران به ما ({partyMetrics.totalDebtorsCount})
                </button>
                <button
                  onClick={() => setPartyStatusFilter('creditors')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    partyStatusFilter === 'creditors'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  بستانکاران از ما ({partyMetrics.totalCreditorsCount})
                </button>
                <button
                  onClick={() => setPartyStatusFilter('settled')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    partyStatusFilter === 'settled'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  تسویه شده ({partyMetrics.totalSettledCount})
                </button>
              </div>

              {/* Group and Sort dropdowns */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <select
                  value={partyGroupFilter}
                  onChange={e => setPartyGroupFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 focus:outline-none"
                >
                  <option value="all">تمام گروه‌ها</option>
                  {partyGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <select
                  value={partySortBy}
                  onChange={e => setPartySortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 focus:outline-none"
                >
                  <option value="max_debt">بیشترین بدهکاری به ما</option>
                  <option value="max_credit">بیشترین بستانکاری (طلب)</option>
                  <option value="name">نام (الفبا)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Party Balances Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>لیست تفصیلی مانده حساب اشخاص (افغانی و دلاری)</span>
              </span>
              <span className="text-xs text-slate-500 font-bold">
                تعداد موارد: <strong className="text-slate-900 font-mono">{filteredParties.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">کد / نام شخص و شرکت</th>
                    <th className="px-5 py-3.5">شماره تماس / آدرس</th>
                    <th className="px-5 py-3.5">گروه طرف‌حساب</th>
                    <th className="px-5 py-3.5">وضعیت حساب</th>
                    <th className="px-5 py-3.5 text-left">مانده حساب افغانی (AFN)</th>
                    <th className="px-5 py-3.5 text-left">مانده حساب دلاری (USD)</th>
                    <th className="px-5 py-3.5 text-left">معادل کل به افغانی</th>
                    <th className="px-5 py-3.5 text-center">عملیات و کارتکس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParties.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        هیچ حسابی با مشخصات فیلتر شده یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredParties.map((p, idx) => {
                      const isDebtorAFN = p.balanceAFN < 0;
                      const isCreditorAFN = p.balanceAFN > 0;
                      const isDebtorUSD = p.balanceUSD < 0;
                      const isCreditorUSD = p.balanceUSD > 0;

                      const isOverallDebtor = p.balanceAFN < 0 || p.balanceUSD < 0;
                      const isOverallCreditor = p.balanceAFN > 0 || p.balanceUSD > 0;
                      const isSettled = p.balanceAFN === 0 && p.balanceUSD === 0;

                      // Total equivalent in AFN
                      const totalEquivalentAFN =
                        p.balanceAFN + p.balanceUSD * (cashRegister.usdToAfnRate || 70.8);

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-indigo-50/30 transition group"
                        >
                          {/* Name & Company */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-800">
                                {p.name[0]}
                              </div>
                              <div>
                                <span className="font-black text-slate-900 block">{p.name}</span>
                                {p.company && <span className="text-[10px] text-slate-400">{p.company}</span>}
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">
                            <div>{p.phone || '—'}</div>
                            {p.address && <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{p.address}</div>}
                          </td>

                          {/* Group */}
                          <td className="px-5 py-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              {p.groupName || 'عمومی'}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="px-5 py-3.5">
                            {isOverallDebtor && (
                              <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                <span>بدهکار به ما (قرضدار)</span>
                              </span>
                            )}
                            {isOverallCreditor && (
                              <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                <span>طلبکار از ما</span>
                              </span>
                            )}
                            {isSettled && (
                              <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                تسویه / بی‌حساب
                              </span>
                            )}
                          </td>

                          {/* AFN Balance */}
                          <td className="px-5 py-3.5 text-left font-mono">
                            <div
                              className={`font-black text-xs ${
                                isDebtorAFN
                                  ? 'text-rose-600'
                                  : isCreditorAFN
                                  ? 'text-blue-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {p.balanceAFN === 0
                                ? '0 ؋'
                                : `${formatNumber(Math.abs(p.balanceAFN))} ؋`}
                            </div>
                            {isDebtorAFN && <span className="text-[9px] text-rose-500 font-bold block">بدهکار</span>}
                            {isCreditorAFN && <span className="text-[9px] text-blue-500 font-bold block">طلبکار</span>}
                          </td>

                          {/* USD Balance */}
                          <td className="px-5 py-3.5 text-left font-mono">
                            <div
                              className={`font-black text-xs ${
                                isDebtorUSD
                                  ? 'text-rose-600'
                                  : isCreditorUSD
                                  ? 'text-blue-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {p.balanceUSD === 0
                                ? '$0'
                                : `$${formatNumber(Math.abs(p.balanceUSD))}`}
                            </div>
                            {isDebtorUSD && <span className="text-[9px] text-rose-500 font-bold block">بدهکار</span>}
                            {isCreditorUSD && <span className="text-[9px] text-blue-500 font-bold block">طلبکار</span>}
                          </td>

                          {/* Total Equivalent in AFN */}
                          <td className="px-5 py-3.5 text-left font-mono">
                            <span
                              className={`font-black text-xs ${
                                totalEquivalentAFN < 0
                                  ? 'text-rose-700'
                                  : totalEquivalentAFN > 0
                                  ? 'text-blue-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {totalEquivalentAFN === 0
                                ? '0 ؋'
                                : `${formatNumber(Math.abs(totalEquivalentAFN))} ؋`}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedPartyForCardex(p)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-indigo-200"
                                title="مشاهده صورت‌حساب کامل، گردش فاکتورها و دریافت/پرداخت"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>کارتکس / دفتر کل</span>
                              </button>

                              {onOpenPaymentModal && (
                                <>
                                  <button
                                    onClick={() => onOpenPaymentModal('receive_payment', p.id)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition cursor-pointer border border-emerald-200"
                                    title="دریافت پول از این شخص"
                                  >
                                    <ArrowDownLeft className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => onOpenPaymentModal('make_payment', p.id)}
                                    className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl transition cursor-pointer border border-orange-200"
                                    title="پرداخت پول به این شخص"
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECTION: PRODUCT INVENTORY / موجودی کالا (کلی و در گدام‌ها) */}
      {/* ========================================================================= */}
      {activeSection === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-xs space-y-2 bg-gradient-to-br from-emerald-50/40 via-white to-white">
              <span className="text-xs font-bold text-emerald-800">مجموع تناژ موجود در انبارها</span>
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {formatNumber(stockStats.totalTons)} <span className="text-sm font-sans">تن</span>
              </div>
              <div className="text-xs text-slate-500 font-mono font-bold">
                معادل {formatNumber(stockStats.totalBags)} کیسه استاندارد
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500">ارزش کل موجودی به افغانی (قیمت خرید)</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {formatNumber(stockStats.afnValue)} ؋
              </div>
              <div className="text-xs text-slate-400">بر اساس میانگین نرخ خرید اجناس</div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500">ارزش دلاری موجودی گدام‌ها</span>
              <div className="text-2xl font-black text-blue-700 font-mono">
                ${formatNumber(stockStats.usdValue)}
              </div>
              <div className="text-xs text-slate-400">سرمایه راکد در گدام‌های فعال</div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500">گدام‌های تحت پوشش</span>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {warehouses.length} <span className="text-sm font-sans">گدام</span>
              </div>
              <div className="text-xs text-slate-500">
                مرکزی کابل، هرات، امانی و ملکی
              </div>
            </div>
          </div>

          {/* Low Stock Alert Banner inside Inventory Report */}
          {allProductsWithStock.filter(p => p.isOut || p.isLow).length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-700 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span>سیستم هشدار موجودی پایین گدام‌ها</span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {allProductsWithStock.filter(p => p.isOut || p.isLow).length} قلم کالا زیر نقطه سفارش
                    </span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    موجودی کالاهای زیر به حد نصاب هشدار (حداقل مجاز) یا صفر رسیده است. توصیه می‌شود نسبت به ثبت فاکتور خرید یا انتقال اقدام فرمایید.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setStockStatusFilter(stockStatusFilter === 'low' ? 'all' : 'low')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    stockStatusFilter === 'low'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{stockStatusFilter === 'low' ? 'نمایش همه کالاها' : 'فیلتر اقلام دارای کسری و هشدار'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* بخش موجودی هر گروه: نمایش تعداد باقیمانده هر گروه در زیر جمله */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Boxes className="w-4 h-4 text-emerald-700" />
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    موجودی هر گروه
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                    {categoryStockSummary.length} گروه کالایی
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  تعداد و تناژ باقیمانده کالاهای هر گروه به تفکیک تن، کیسه و وضعیت انبار
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                {stockCategoryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setStockCategoryFilter('all')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-emerald-200 shadow-2xs"
                  >
                    <span>نمایش همه گروه‌ها (لغو فیلتر «{stockCategoryFilter}»)</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-[11px]">
                  {stockWarehouseFilter === 'all'
                    ? 'محاسبه در تمام گدام‌ها'
                    : `گدام: ${warehouses.find(w => w.id === stockWarehouseFilter)?.name || 'انتخابی'}`}
                </div>
              </div>
            </div>

            {/* کارت‌های تعداد باقیمانده هر گروه در زیر جمله */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {categoryStockSummary.map(cat => {
                const isSelected = stockCategoryFilter === cat.name;
                const isOut = cat.totalTons <= 0;
                const hasLow = cat.lowCount > 0;

                return (
                  <button
                    type="button"
                    key={cat.name}
                    id={`category-stock-card-${cat.name.replace(/\s+/g, '-')}`}
                    onClick={() => setStockCategoryFilter(isSelected ? 'all' : cat.name)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-right flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                        : isOut
                        ? 'bg-rose-50/30 hover:bg-rose-50/70 border-rose-200'
                        : hasLow
                        ? 'bg-amber-50/30 hover:bg-amber-50/70 border-amber-200'
                        : 'bg-slate-50/70 hover:bg-white hover:border-slate-300 hover:shadow-2xs border-slate-200'
                    }`}
                  >
                    <div className="w-full space-y-2.5">
                      {/* عنوان گروه و تعداد اقلام */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-slate-800 flex items-center gap-2 truncate">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isOut ? 'bg-rose-500' : hasLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          <span className="truncate group-hover:text-emerald-700 transition">
                            {cat.name}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0">
                          {cat.productCount} قلم کالا
                        </span>
                      </div>

                      {/* کادر تعداد باقیمانده */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold text-slate-500">تعداد باقیمانده:</span>
                          <div className="text-left font-mono">
                            <span className="text-base font-black text-slate-900">
                              {formatNumber(cat.totalTons)}
                            </span>
                            <span className="text-[11px] font-sans text-slate-600 font-bold mr-1">تن</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <span>معادل کیسه:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {formatNumber(cat.totalBags)} <span className="text-[10px] font-sans">کیسه</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* وضعیت و راهنمای فیلتر */}
                    <div className="w-full mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
                      {isOut ? (
                        <span className="text-rose-600 font-bold">● موجودی صفر</span>
                      ) : hasLow ? (
                        <span className="text-amber-700 font-bold">⚠️ {cat.lowCount} قلم نیازمند خرید</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">✓ موجودی کافی</span>
                      )}
                      <span className={`font-bold transition ${
                        isSelected ? 'text-emerald-700 underline font-black' : 'text-slate-400 group-hover:text-emerald-600'
                      }`}>
                        {isSelected ? 'فیلتر فعال' : 'کلیک برای فیلتر'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search and Category Filters */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="جستجوی نام کالا یا کد..."
                value={stockSearchQuery}
                onChange={e => setStockSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
              <select
                value={stockWarehouseFilter}
                onChange={e => setStockWarehouseFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="all">تمام گدام‌ها</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <select
                value={stockCategoryFilter}
                onChange={e => setStockCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 focus:outline-none font-medium"
              >
                <option value="all">تمام گروه‌ها (مجموع {formatNumber(stockStats.totalTons)} تن)</option>
                {categoryStockSummary.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} (باقیمانده: {formatNumber(c.totalTons)} تن)
                  </option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={e => setStockStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 focus:outline-none font-bold"
              >
                <option value="all">تمام وضعیت‌ها</option>
                <option value="available">موجودی کافی و مطلوب</option>
                <option value="low">⚠️ هشدار کسری و موجودی کم</option>
                <option value="out">❌ ناموجود (موجودی صفر)</option>
              </select>
            </div>
          </div>

          {/* Product Inventory Table (Total & Per Warehouse Breakdown) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>موجودی کلی کالاها، حد نصاب هشدار و تفکیک در هر گدام (تن و کیسه)</span>
              </span>
              <span className="text-xs text-slate-500 font-bold">
                تعداد اقلام: <strong className="text-slate-900 font-mono">{filteredProductsWithStock.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">کد / نام کالا و مشخصات</th>
                    <th className="px-5 py-3.5">دسته‌بندی و وزن کیسه</th>
                    <th className="px-5 py-3.5 text-center">حد نصاب هشدار (نقطه سفارش)</th>
                    <th className="px-5 py-3.5 text-center">موجودی کل و وضعیت</th>
                    <th className="px-5 py-3.5">موجودی تفکیکی در گدام‌ها</th>
                    <th className="px-5 py-3.5 text-left">نرخ خرید / فروش فی تن</th>
                    <th className="px-5 py-3.5 text-left">ارزش کل موجودی</th>
                    <th className="px-5 py-3.5 text-center">کارتکس کالا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProductsWithStock.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        کالایی با شرایط جستجو یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredProductsWithStock.map(({ product: prod, overallStock, warehouseBreakdown, minThreshold, deficitTons, isLow, isOut, valueAFN, valueUSD }) => (
                      <tr
                        key={prod.id}
                        className={`transition group ${
                          isOut
                            ? 'bg-rose-50/40 hover:bg-rose-50/70'
                            : isLow
                            ? 'bg-amber-50/40 hover:bg-amber-50/70'
                            : 'hover:bg-emerald-50/30'
                        }`}
                      >
                        {/* Name & Code */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block text-xs">{prod.name}</strong>
                              <span className="text-[10px] text-slate-400 font-mono">{prod.code}</span>
                            </div>
                          </div>
                        </td>

                        {/* Category & Bag Weight */}
                        <td className="px-5 py-3.5">
                          <div className="text-slate-700 font-bold">{prod.category || 'عمومی'}</div>
                          <div className="text-[10px] text-slate-400">
                            کیسه {prod.bagWeightKg || 50} کیلویی ({prod.bagsPerTon || 20} کیسه/تن)
                          </div>
                        </td>

                        {/* Minimum Threshold */}
                        <td className="px-5 py-3.5 text-center font-mono">
                          <div className="font-bold text-slate-800 text-xs">
                            {minThreshold} تن
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ({Math.round(minThreshold * (prod.bagsPerTon || 20))} کیسه)
                          </div>
                        </td>

                        {/* Total Stock & Low Stock Status Badge */}
                        <td className="px-5 py-3.5 text-center">
                          <div className="font-black text-sm text-slate-900 font-mono">
                            {formatNumber(overallStock.tons)} <span className="text-[10px] font-sans">تن</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold font-mono">
                            ({formatNumber(overallStock.bags)} کیسه)
                          </div>
                          {isOut ? (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[9px] font-extrabold border border-rose-200">
                              ❌ ناموجود
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex flex-col mt-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[9px] font-bold border border-amber-300">
                              <span className="flex items-center gap-0.5 justify-center">
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                <span>هشدار کسری</span>
                              </span>
                              <span className="text-[8px] text-rose-700">کسری: {deficitTons} تن</span>
                            </span>
                          ) : (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                              ✅ مطلوب
                            </span>
                          )}
                        </td>

                        {/* Breakdown Per Warehouse */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {warehouseBreakdown.map(wh => (
                              <div
                                key={wh.warehouseId}
                                className={`px-2.5 py-1 rounded-xl text-[10px] border flex items-center gap-1.5 font-mono ${
                                  wh.tons > 0
                                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                                    : 'bg-slate-50/50 border-slate-100 text-slate-400'
                                }`}
                              >
                                <span className="font-sans font-bold text-slate-600">{wh.warehouseName}:</span>
                                <strong className={wh.tons > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                                  {formatNumber(wh.tons)} تن
                                </strong>
                                <span className="text-[9px] text-slate-400">({formatNumber(wh.bags)} ک)</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Unit Prices */}
                        <td className="px-5 py-3.5 text-left font-mono">
                          <div className="text-[11px] text-slate-700">
                            خرید: <strong>{formatCurrency(prod.buyPriceAFN, 'AFN')}</strong>
                          </div>
                          <div className="text-[10px] text-emerald-700">
                            فروش: <strong>{formatCurrency(prod.sellPriceAFN, 'AFN')}</strong>
                          </div>
                        </td>

                        {/* Total Stock Value */}
                        <td className="px-5 py-3.5 text-left font-mono">
                          <div className="font-black text-xs text-slate-900">
                            {formatNumber(valueAFN)} ؋
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ${formatNumber(valueUSD)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedProductForCardex(prod)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-emerald-200"
                              title="مشاهده گردش ورود، خروج و انتقال کالا"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>کارتکس کالا</span>
                            </button>

                            {onOpenTransferModal && (
                              <button
                                onClick={() => onOpenTransferModal()}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                                title="حواله و انتقال بین گدام‌ها"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECTION: SALES REPORT / گزارش فروشات */}
      {/* ========================================================================= */}
      {activeSection === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-xs bg-gradient-to-br from-rose-50/40 via-white to-white">
              <span className="text-xs font-bold text-rose-800">مجموع فروش به افغانی</span>
              <div className="text-2xl font-black text-rose-700 font-mono mt-1">
                {formatCurrency(salesAggregations.totalAFN, 'AFN')}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                وصول نقدی: {formatCurrency(salesAggregations.paidAFN, 'AFN')} • نسیه: {formatCurrency(salesAggregations.debtAFN, 'AFN')}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-xs bg-gradient-to-br from-rose-50/40 via-white to-white">
              <span className="text-xs font-bold text-rose-800">مجموع فروش به دلار ($)</span>
              <div className="text-2xl font-black text-rose-700 font-mono mt-1">
                {formatCurrency(salesAggregations.totalUSD, 'USD')}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                وصول نقدی: ${formatNumber(salesAggregations.paidUSD)} • نسیه: ${formatNumber(salesAggregations.debtUSD)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500">کل تناژ و کیسه‌های فروخته شده</span>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                {formatNumber(salesAggregations.totalTons)} <span className="text-sm font-sans">تن</span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                معادل {formatNumber(salesAggregations.totalBags)} کیسه در {sellInvoices.length} فاکتور فروش
              </div>
            </div>
          </div>

          {/* بنر سوئیچ سریع به تحلیل و تفکیک فروشات کالاها */}
          <div className="p-4 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  تحلیل و مشخص کردن فروشات روزانه، ماهانه و سالانه کالاها
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  بررسی دقیق حجم، تناژ و ارزش فروش برای یک کالای مشخص یا چند کالای انتخابی
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('product_sales')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <TrendingUp className="w-4 h-4" />
              <span>مشاهده فروش روزانه، ماهانه و سالانه کالاها</span>
            </button>
          </div>

          {/* Sales Invoices Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-600" />
                <span>فهرست فاکتورهای فروش صادر شده</span>
              </span>
              <span className="text-xs text-slate-500 font-bold">
                تعداد: <strong className="text-slate-900 font-mono">{filteredSellInvoices.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">شماره فاکتور / تاریخ</th>
                    <th className="px-5 py-3.5">مشتری / خریدار</th>
                    <th className="px-5 py-3.5">اقلام و تناژ فروش</th>
                    <th className="px-5 py-3.5 text-left">مبلغ کل فاکتور</th>
                    <th className="px-5 py-3.5 text-left">پرداخت نقدی</th>
                    <th className="px-5 py-3.5 text-left">مانده نسیه</th>
                    <th className="px-5 py-3.5 text-center">مشاهده و چاپ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSellInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-rose-50/20 transition">
                      <td className="px-5 py-3.5 font-mono">
                        <strong className="text-slate-900">{inv.invoiceNumber}</strong>
                        <div className="text-[10px] text-slate-400">{inv.date}</div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {inv.partyName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {inv.items.map(it => `${it.productName} (${it.quantity} ${it.unit === 'ton' ? 'تن' : 'کیسه'})`).join(' , ')}
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono font-black text-slate-900">
                        {formatCurrency(inv.totalAmount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono text-emerald-700 font-bold">
                        {formatCurrency(inv.paidAmount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono text-rose-600 font-black">
                        {formatCurrency(inv.balanceAmount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => onViewInvoice && onViewInvoice(inv.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          نمایش و چاپ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.5. SECTION: PRODUCT SALES ANALYSIS / گزارش و تحلیل فروشات کالاها (روزانه • ماهانه • سالانه) */}
      {/* ========================================================================= */}
      {activeSection === 'product_sales' && (
        <ProductSalesAnalysis onViewInvoice={onViewInvoice} />
      )}

      {/* ========================================================================= */}
      {/* 4. SECTION: PURCHASES REPORT / گزارش خریدها */}
      {/* ========================================================================= */}
      {activeSection === 'purchases' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-blue-200 shadow-xs bg-gradient-to-br from-blue-50/40 via-white to-white">
              <span className="text-xs font-bold text-blue-800">مجموع خریدهای افغانی</span>
              <div className="text-2xl font-black text-blue-700 font-mono mt-1">
                {formatCurrency(buyAggregations.totalAFN, 'AFN')}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                پرداخت شده: {formatCurrency(buyAggregations.paidAFN, 'AFN')} • باقیمانده طلب: {formatCurrency(buyAggregations.payableAFN, 'AFN')}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-blue-200 shadow-xs bg-gradient-to-br from-blue-50/40 via-white to-white">
              <span className="text-xs font-bold text-blue-800">مجموع خریدهای دلاری ($)</span>
              <div className="text-2xl font-black text-blue-700 font-mono mt-1">
                {formatCurrency(buyAggregations.totalUSD, 'USD')}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                پرداخت شده: ${formatNumber(buyAggregations.paidUSD)} • مانده طلب: ${formatNumber(buyAggregations.payableUSD)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500">کل تناژ خریداری و وارده به گدام‌ها</span>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                {formatNumber(buyAggregations.totalTons)} <span className="text-sm font-sans">تن</span>
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                معادل {formatNumber(buyAggregations.totalBags)} کیسه در {buyInvoices.length} فاکتور خرید
              </div>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <span>فهرست فاکتورهای خرید و واردات کالا</span>
              </span>
              <span className="text-xs text-slate-500 font-bold">
                تعداد: <strong className="text-slate-900 font-mono">{filteredBuyInvoices.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">شماره فاکتور / تاریخ</th>
                    <th className="px-5 py-3.5">فروشنده / واردکننده</th>
                    <th className="px-5 py-3.5">اقلام خریداری شده</th>
                    <th className="px-5 py-3.5 text-left">مبلغ کل فاکتور</th>
                    <th className="px-5 py-3.5 text-left">پرداخت نقدی</th>
                    <th className="px-5 py-3.5 text-left">مانده طلب فروشنده</th>
                    <th className="px-5 py-3.5 text-center">مشاهده و چاپ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBuyInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-blue-50/20 transition">
                      <td className="px-5 py-3.5 font-mono">
                        <strong className="text-slate-900">{inv.invoiceNumber}</strong>
                        <div className="text-[10px] text-slate-400">{inv.date}</div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {inv.partyName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {inv.items.map(it => `${it.productName} (${it.quantity} ${it.unit === 'ton' ? 'تن' : 'کیسه'})`).join(' , ')}
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono font-black text-slate-900">
                        {formatCurrency(inv.totalAmount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono text-emerald-700 font-bold">
                        {formatCurrency(inv.paidAmount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-left font-mono text-blue-700 font-black">
                        {formatCurrency(inv.balanceAmount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => onViewInvoice && onViewInvoice(inv.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          نمایش و چاپ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECTION: EXPENSES / هزینه‌ها و مصارف */}
      {/* ========================================================================= */}
      {activeSection === 'expenses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white px-5 py-3 rounded-2xl border border-amber-200 shadow-xs">
                <span className="text-[10px] text-slate-500 block">مجموع هزینه‌های افغانی</span>
                <strong className="text-lg font-black text-amber-700 font-mono">
                  {formatCurrency(totalExpensesAFN, 'AFN')}
                </strong>
              </div>
              <div className="bg-white px-5 py-3 rounded-2xl border border-amber-200 shadow-xs">
                <span className="text-[10px] text-slate-500 block">مجموع هزینه‌های دلاری</span>
                <strong className="text-lg font-black text-amber-700 font-mono">
                  {formatCurrency(totalExpensesUSD, 'USD')}
                </strong>
              </div>
            </div>

            <button
              onClick={() => setIsAddingExpense(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مصارف و هزینه جدید</span>
            </button>
          </div>

          {/* Add Expense Form Modal */}
          {isAddingExpense && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <span>ثبت هزینه و مصارف جدید</span>
                </h3>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان و بابت هزینه</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: کرایه حمل موتر از بندر تورغندی"
                      value={newExpTitle}
                      onChange={e => setNewExpTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">دسته‌بندی</label>
                      <select
                        value={newExpCategoryId}
                        onChange={e => setNewExpCategoryId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                      >
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                        {expenseCategories.length === 0 && (
                          <option value="default">مصارف عمومی</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">واحد پولی</label>
                      <select
                        value={newExpCurrency}
                        onChange={e => setNewExpCurrency(e.target.value as Currency)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value="AFN">افغانی (AFN ؋)</option>
                        <option value="USD">دلار ($ USD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ پرداختی</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newExpAmount || ''}
                        onChange={e => setNewExpAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">دریافت‌کننده / راننده</label>
                      <input
                        type="text"
                        placeholder="نام شخص یا نهاد"
                        value={newExpRecipient}
                        onChange={e => setNewExpRecipient(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddingExpense(false)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      ثبت در دفاتر مصارف
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Expenses Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {expenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-600" />
                <p className="text-sm font-bold text-slate-600">هیچ هزینه‌ای در سیستم ثبت نشده است.</p>
                <p className="text-xs text-slate-400 mt-1">
                  می‌توانید با استفاده از دکمه «ثبت مصارف و هزینه جدید» هزینه‌ها را وارد نمایید.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">ردیف / تاریخ</th>
                      <th className="px-5 py-3.5">عنوان و بابت مصارف</th>
                      <th className="px-5 py-3.5">دسته‌بندی</th>
                      <th className="px-5 py-3.5">صندوق پرداخت‌کننده</th>
                      <th className="px-5 py-3.5">دریافت‌کننده وجه</th>
                      <th className="px-5 py-3.5 text-left">مبلغ پرداختی</th>
                      <th className="px-5 py-3.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((exp, i) => (
                      <tr key={exp.id} className="hover:bg-amber-50/20 transition">
                        <td className="px-5 py-3.5 font-mono text-slate-500">
                          #{i + 1} • {exp.date}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{exp.title}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                            {exp.categoryName || 'مصارف عمومی'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{exp.cashRegisterName || 'صندوق شرکت'}</td>
                        <td className="px-5 py-3.5 text-slate-800 font-medium">{exp.recipient || 'متفرقه'}</td>
                        <td className="px-5 py-3.5 text-left font-mono font-black text-rose-600">
                          {formatCurrency(exp.amount, exp.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => {
                              if (confirm(`آیا از حذف هزینه «${exp.title}» مطمئن هستید؟`)) {
                                deleteExpense(exp.id);
                              }
                            }}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                            title="حذف هزینه"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SECTION: PROFIT & LOSS / سود و زیان (P&L) */}
      {/* ========================================================================= */}
      {activeSection === 'profit_loss' && (
        <div className="space-y-6">
          {/* P&L Period Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5 ml-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>دوره محاسباتی سود و زیان:</span>
              </span>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPnlPeriod('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pnlPeriod === 'all' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  همه دوره‌ها (کل)
                </button>
                <button
                  type="button"
                  onClick={() => setPnlPeriod('today')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pnlPeriod === 'today' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  امروز
                </button>
                <button
                  type="button"
                  onClick={() => setPnlPeriod('month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pnlPeriod === 'month' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  این ماه
                </button>
                <button
                  type="button"
                  onClick={() => setPnlPeriod('year')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pnlPeriod === 'year' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  سال جاری
                </button>
                <button
                  type="button"
                  onClick={() => setPnlPeriod('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pnlPeriod === 'custom' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  بازه دلخواه
                </button>
              </div>

              {pnlPeriod === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-slate-500 text-[11px]">از:</span>
                  <input
                    type="text"
                    placeholder="۱۴۰۳/۰۱/۰۱"
                    value={pnlStartDate}
                    onChange={e => setPnlStartDate(e.target.value)}
                    className="w-20 bg-transparent text-xs font-mono outline-none text-slate-800"
                  />
                  <span className="text-slate-500 text-[11px]">تا:</span>
                  <input
                    type="text"
                    placeholder="۱۴۰۳/۱۲/۲۹"
                    value={pnlEndDate}
                    onChange={e => setPnlEndDate(e.target.value)}
                    className="w-20 bg-transparent text-xs font-mono outline-none text-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 font-mono font-medium">
              {pnlPeriod === 'all' && 'محاسبه از آغاز عملیات سیستم تا کنون'}
              {pnlPeriod === 'today' && `گزارش روزانه: ${getPersianDate()}`}
              {pnlPeriod === 'month' && 'گزارش ماه جاری بر مبنای تقویم شمسی'}
              {pnlPeriod === 'year' && 'گزارش کل سال مالی جاری'}
              {pnlPeriod === 'custom' && (effectivePnlDateRange.from || effectivePnlDateRange.to ? `از ${effectivePnlDateRange.from || 'ابتدا'} تا ${effectivePnlDateRange.to || 'اکنون'}` : 'لطفاً بازه تاریخ را وارد نمایید')}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md border border-teal-900">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-teal-400 font-bold uppercase tracking-wider">
                    سود خالص تجارتی دوره (Net Operating Profit)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold border border-teal-500/30">
                    ارز اصلی منتخب: {baseCurrency.name} ({baseCurrency.code})
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight">
                  {formatNumber(netProfitBase)} {baseCurrency.symbol || baseCurrency.code}
                </h3>
                <p className="text-xs text-teal-200 font-mono">
                  معادل افغانی: {formatNumber(convertToBase(netProfitBase, baseCurrency.code) * (baseCurrency.exchangeRateToAFN || 1))} ؋ | دلار: ${formatNumber((convertToBase(netProfitBase, baseCurrency.code) * (baseCurrency.exchangeRateToAFN || 1)) / (cashRegister.usdToAfnRate || 65))}
                </p>
              </div>

              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300">سود ناخالص بازرگانی:</span>
                  <span className="font-bold text-teal-300 font-mono">
                    {formatNumber(totalGrossProfitEquivalentBase)} {baseCurrency.symbol || baseCurrency.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">+ سایر عواید و درآمدها:</span>
                  <span className="font-bold text-emerald-300 font-mono">
                    {formatNumber(pnlTotalIncomeEquivalentBase)} {baseCurrency.symbol || baseCurrency.code}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">- کل هزینه‌ها و مصارف:</span>
                  <span className="font-bold text-rose-300 font-mono">
                    {formatNumber(pnlTotalExpEquivalentBase)} {baseCurrency.symbol || baseCurrency.code}
                  </span>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between text-teal-200 font-black">
                  <span>سود خالص نهایی:</span>
                  <span className="font-mono">
                    {formatNumber(netProfitBase)} {baseCurrency.symbol || baseCurrency.code}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sales & Gross Profit */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>درآمدها و فروشات کل دوره</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl font-mono">
                  <span className="text-slate-600">فروشات افغانی:</span>
                  <strong className="text-slate-900 font-bold">{formatCurrency(pnlSalesTotals.totalAFN, 'AFN')}</strong>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl font-mono">
                  <span className="text-slate-600">فروشات دلاری:</span>
                  <strong className="text-slate-900 font-bold">${formatNumber(pnlSalesTotals.totalUSD)}</strong>
                </div>
                <div className="flex justify-between p-3 bg-emerald-50 rounded-xl font-mono text-emerald-800 font-bold">
                  <span>بهای تمام شده (COGS):</span>
                  <span>{formatNumber(cogsCalculations.cogsAFN + cogsCalculations.cogsUSD * (cashRegister.usdToAfnRate || 70.8))} ؋</span>
                </div>
                <div className="flex justify-between p-3 bg-teal-50 rounded-xl font-mono text-teal-900 font-bold">
                  <span>سود ناخالص بازرگانی:</span>
                  <span>{formatNumber(totalGrossProfitEquivalentBase)} {baseCurrency.symbol || baseCurrency.code}</span>
                </div>
              </div>
            </div>

            {/* Other Incomes */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>سایر عواید و درآمدهای دوره</span>
              </h4>
              <div className="space-y-2 text-xs">
                {pnlIncomeCategoryBreakdown.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl font-bold">
                    هیچ عایدی متفرقه‌ای برای این دوره ثبت نشده است (۰ ؋)
                  </div>
                ) : (
                  pnlIncomeCategoryBreakdown.map(cat => (
                    <div key={cat.id} className="flex justify-between p-3 bg-slate-50 rounded-xl font-mono">
                      <span className="text-slate-700">{cat.name}:</span>
                      <strong className="text-emerald-700">
                        {cat.amountAFN > 0 && `${formatNumber(cat.amountAFN)} ؋`}
                        {cat.amountAFN > 0 && cat.amountUSD > 0 && ' + '}
                        {cat.amountUSD > 0 && `$${formatNumber(cat.amountUSD)}`}
                      </strong>
                    </div>
                  ))
                )}
                <div className="flex justify-between p-3 bg-emerald-50 rounded-xl font-mono text-emerald-900 font-bold border border-emerald-100">
                  <span>مجموع سایر عواید (معادل ارز اصلی):</span>
                  <span>{formatNumber(pnlTotalIncomeEquivalentBase)} {baseCurrency.symbol || baseCurrency.code}</span>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-600" />
                <span>هزینه‌ها و مصارف جاری دوره</span>
              </h4>
              <div className="space-y-2 text-xs">
                {pnlExpenses.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl font-bold">
                    هیچ هزینه‌ای برای این دوره مالی ثبت نشده است (۰ ؋)
                  </div>
                ) : (
                  expenseCategoryBreakdown.map(cat => (
                    <div key={cat.id} className="flex justify-between p-3 bg-slate-50 rounded-xl font-mono">
                      <span className="text-slate-700">{cat.name}:</span>
                      <strong className="text-slate-900">
                        {cat.amountAFN > 0 && `${formatNumber(cat.amountAFN)} ؋`}
                        {cat.amountAFN > 0 && cat.amountUSD > 0 && ' + '}
                        {cat.amountUSD > 0 && `$${formatNumber(cat.amountUSD)}`}
                      </strong>
                    </div>
                  ))
                )}
                <div className="flex justify-between p-3 bg-rose-50 rounded-xl font-mono text-rose-900 font-bold border border-rose-100">
                  <span>مجموع کل هزینه‌ها (معادل ارز اصلی):</span>
                  <span>{formatNumber(pnlTotalExpEquivalentBase)} {baseCurrency.symbol || baseCurrency.code}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SECTION: BALANCE SHEET / ترازنامه و بیلاننس مالی */}
      {/* ========================================================================= */}
      {activeSection === 'balance_sheet' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets (دارایی‌ها) */}
            <div className="bg-white rounded-3xl border border-emerald-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                <h4 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>دارایی‌های تجارتی (Assets)</span>
                </h4>
                <strong className="text-base font-black text-emerald-700 font-mono">
                  {formatNumber(totalAssetsAFN)} ؋
                </strong>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">نقدینگی در صندوق افغانی:</span>
                  <strong className="font-mono text-slate-900">{formatNumber(cashRegister.afnBalance)} ؋</strong>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">نقدینگی در صندوق دالری ($):</span>
                  <strong className="font-mono text-slate-900">${formatNumber(cashRegister.usdBalance)}</strong>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">صندوق دالری صرافی سرای شهزاده:</span>
                  <strong className="font-mono text-slate-900">${formatNumber(cashRegister.exchangeUsdBalance || 0)}</strong>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">ارزش کل موجودی کالا در گدام‌ها:</span>
                  <strong className="font-mono text-emerald-700">{formatNumber(stockStats.afnValue)} ؋</strong>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">طلبات از مشتریان (قرضداری‌ها):</span>
                  <strong className="font-mono text-rose-600">{formatNumber(partyMetrics.debtAFN)} ؋ + ${formatNumber(partyMetrics.debtUSD)}</strong>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity (بدهی‌ها و حقوق صاحبان سهام) */}
            <div className="bg-white rounded-3xl border border-blue-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                <h4 className="text-sm font-black text-blue-900 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  <span>بدهی‌ها و سرمایه خالص (Liabilities & Equity)</span>
                </h4>
                <strong className="text-base font-black text-blue-700 font-mono">
                  {formatNumber(totalAssetsAFN)} ؋
                </strong>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">بدهی ما به تامین‌کنندگان (افغانی):</span>
                  <strong className="font-mono text-blue-700">{formatNumber(partyMetrics.creditAFN)} ؋</strong>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600">بدهی ما به تامین‌کنندگان (دلار):</span>
                  <strong className="font-mono text-blue-700">${formatNumber(partyMetrics.creditUSD)}</strong>
                </div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between p-3 bg-emerald-50 rounded-xl">
                  <span className="text-emerald-900 font-bold">خالص حقوق صاحبان سرمایه (Net Worth):</span>
                  <strong className="font-mono text-emerald-800 font-black">{formatNumber(netCompanyWorthAFN)} ؋</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. SECTION: JOURNAL ENTRIES / اسناد حسابداری و دفتر روزنامه */}
      {/* ========================================================================= */}
      {activeSection === 'journal' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span className="font-black text-xs text-slate-800">دفتر روزنامه و اسناد دوبل حسابداری (Journal Entries)</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  {filteredJournalEntries.length} از {journalEntries.length} سند
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو در اسناد، طرف حساب و شرح..."
                    value={journalSearchQuery}
                    onChange={e => setJournalSearchQuery(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-xl text-[11px] font-bold">
                  <button
                    onClick={() => setJournalTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition ${journalTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    همه
                  </button>
                  <button
                    onClick={() => setJournalTypeFilter('sales')}
                    className={`px-2.5 py-1 rounded-lg transition ${journalTypeFilter === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    فروش
                  </button>
                  <button
                    onClick={() => setJournalTypeFilter('purchases')}
                    className={`px-2.5 py-1 rounded-lg transition ${journalTypeFilter === 'purchases' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    خرید
                  </button>
                  <button
                    onClick={() => setJournalTypeFilter('payments')}
                    className={`px-2.5 py-1 rounded-lg transition ${journalTypeFilter === 'payments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    دریافت/پرداخت
                  </button>
                  <button
                    onClick={() => setJournalTypeFilter('expenses')}
                    className={`px-2.5 py-1 rounded-lg transition ${journalTypeFilter === 'expenses' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    مصارف
                  </button>
                  <button
                    onClick={() => setJournalTypeFilter('exchange')}
                    className={`px-2.5 py-1 rounded-lg transition ${journalTypeFilter === 'exchange' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                  >
                    صرافی
                  </button>
                </div>
              </div>
            </div>

            {filteredJournalEntries.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-600" />
                <p className="text-sm font-bold text-slate-600">هیچ سند حسابداری ثبت نشده است.</p>
                <p className="text-xs text-slate-400 mt-1">
                  پس از ثبت فاکتورهای فروش/خرید، دریافت و پرداخت‌ها یا مصارف، اسناد دوبل حسابداری به‌صورت خودکار در این قسمت ثبت و نمایش داده می‌شوند.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">شماره سند / تاریخ</th>
                      <th className="px-5 py-3.5">شرح و بابت سند</th>
                      <th className="px-5 py-3.5">حساب بدهکار (Debit)</th>
                      <th className="px-5 py-3.5">حساب بستانکار (Credit)</th>
                      <th className="px-5 py-3.5 text-left">مبلغ سند</th>
                      <th className="px-5 py-3.5 text-center">چاپ سند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredJournalEntries.map(j => (
                      <tr key={j.id} className="hover:bg-purple-50/20 transition">
                        <td className="px-5 py-3.5 font-mono">
                          <strong className="text-slate-900">{j.voucherNo}</strong>
                          <div className="text-[10px] text-slate-400">{j.date}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-800">{j.title}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{j.description}</div>
                        </td>
                        <td className="px-5 py-3.5 text-rose-700 font-bold">{j.debitTitle}</td>
                        <td className="px-5 py-3.5 text-blue-700 font-bold">{j.creditTitle}</td>
                        <td className="px-5 py-3.5 text-left font-mono font-black text-slate-900">
                          {formatCurrency(j.amount, j.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => {
                              openPrintModal(
                                `سند دوبل حسابداری شماره ${j.voucherNo}`,
                                <div className="space-y-6 text-slate-800 font-vazir" dir="rtl">
                                  <div className="border-b pb-4 text-center">
                                    <h2 className="text-xl font-black text-slate-900">سند حسابداری (دفتر روزنامه)</h2>
                                    <p className="text-xs text-slate-500 mt-1">سیستم جامع حسابداری عمده‌فروشی بازرگانی</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
                                    <div><strong>شماره سند:</strong> {j.voucherNo}</div>
                                    <div><strong>تاریخ ثبت:</strong> {j.date}</div>
                                    <div className="col-span-2"><strong>عنوان سند:</strong> {j.title}</div>
                                    <div className="col-span-2"><strong>شرح و بابت:</strong> {j.description}</div>
                                  </div>
                                  <table className="w-full border-collapse border border-slate-300 text-xs">
                                    <thead>
                                      <tr className="bg-slate-100">
                                        <th className="border p-2">شرح ردیف حسابداری</th>
                                        <th className="border p-2 text-rose-700">بدهکار (Debit)</th>
                                        <th className="border p-2 text-blue-700">بستانکار (Credit)</th>
                                        <th className="border p-2">مبلغ</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="border p-2 font-bold">{j.debitTitle}</td>
                                        <td className="border p-2 font-mono font-bold text-rose-600">{formatCurrency(j.amount, j.currency)}</td>
                                        <td className="border p-2 text-center text-slate-400">-</td>
                                        <td className="border p-2 font-mono font-bold">{formatCurrency(j.amount, j.currency)}</td>
                                      </tr>
                                      <tr>
                                        <td className="border p-2 font-bold">{j.creditTitle}</td>
                                        <td className="border p-2 text-center text-slate-400">-</td>
                                        <td className="border p-2 font-mono font-bold text-blue-600">{formatCurrency(j.amount, j.currency)}</td>
                                        <td className="border p-2 font-mono font-bold">{formatCurrency(j.amount, j.currency)}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                  <div className="grid grid-cols-3 gap-4 pt-12 text-center text-xs">
                                    <div>امضای ثبت‌کننده: ....................</div>
                                    <div>امضای حسابدار: ....................</div>
                                    <div>امضای مدیر مالی: ....................</div>
                                  </div>
                                </div>
                              );
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>چاپ سند</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. SECTION: FIXED ASSETS / تجهیزات و دارایی‌های ثابت */}
      {/* ========================================================================= */}
      {activeSection === 'fixed_assets' && (
        <FixedAssetsView />
      )}

      {/* ========================================================================= */}
      {/* 10. SECTION: SHAREHOLDERS / امور سهامداران و شرکا */}
      {/* ========================================================================= */}
      {activeSection === 'shareholders' && (
        <ShareholdersView />
      )}

      {/* ========================================================================= */}
      {/* 11. SECTION: BACKUP & DATABASE / پشتیبان‌گیری و پایگاه داده */}
      {/* ========================================================================= */}
      {activeSection === 'backup' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
          <div>
            <h3 className="font-black text-slate-900 text-base mb-1">پشتیبان‌گیری و مدیریت پایگاه داده</h3>
            <p className="text-xs text-slate-500">
              شما می‌توانید از تمامی فاکتورها، حساب‌های اشخاص، موجودی گدام‌ها، هزینه‌ها و تراکنش‌های مالی نسخه پشتیبان بگیرید، آن را بازیابی کنید، یا دیتابیس را ریست و پاک‌سازی نمایید.
            </p>
          </div>

          {importStatus && (
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{importStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={handleDownloadBackup}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل پشتیبان کامل (JSON)</span>
            </button>

            <label className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition cursor-pointer border border-slate-200">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>بازیابی پایگاه داده از فایل</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                if (confirm('آیا مطمئن هستید که می‌خواهید تمام داده‌ها به حالت نمونه اولیه (Demo) بازنشانی شوند؟')) {
                  resetToDemoData();
                  setImportStatus('داده‌های نمونه پیش‌فرض با موفقیت بارگذاری شد.');
                  setTimeout(() => setImportStatus(null), 3000);
                }
              }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>بازنشانی به داده‌های دمو</span>
            </button>

            <button
              onClick={() => {
                if (confirm('آیا می‌خواهید سال مالی جدید شروع کنید؟ (فاکتورها، تراکنش‌ها و اسناد صفر شده و کالاها، اشخاص و مانده‌ها حفظ می‌گردند)')) {
                  resetNewFinancialYear();
                  setImportStatus('سال مالی جدید با موفقیت ایجاد گردید.');
                  setTimeout(() => setImportStatus(null), 3000);
                }
              }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 border border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-2xl text-xs font-bold transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>شروع سال مالی جدید</span>
            </button>

            <button
              onClick={() => {
                if (confirm('هشدار: آیا مطمئن هستید که می‌خواهید کل داده‌ها، اسناد، فاکتورها و هزینه‌ها را کاملاً پاک و صفر کنید (Wipe Clean)؟ این عملیات غیرقابل برگشت است.')) {
                  resetWipeCleanAll();
                  setImportStatus('تمامی اطلاعات، اسناد و هزینه‌ها با موفقیت پاک و صفر شدند.');
                  setTimeout(() => setImportStatus(null), 3000);
                }
              }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-2xl text-xs font-bold transition cursor-pointer col-span-1 sm:col-span-2 lg:col-span-1"
            >
              <Trash2 className="w-4 h-4" />
              <span>پاک‌سازی کامل کلیه اسناد و داده‌ها</span>
            </button>
          </div>
        </div>
      )}

      {/* PARTY CARDEX MODAL */}
      <PartyCardexModal
        party={selectedPartyForCardex}
        isOpen={!!selectedPartyForCardex}
        onClose={() => setSelectedPartyForCardex(null)}
        onViewInvoice={onViewInvoice}
        onOpenPaymentModal={onOpenPaymentModal}
      />

      {/* PRODUCT CARDEX MODAL */}
      <ProductCardexModal
        product={selectedProductForCardex}
        isOpen={!!selectedProductForCardex}
        onClose={() => setSelectedProductForCardex(null)}
        onViewInvoice={onViewInvoice}
      />
    </div>
  );
};

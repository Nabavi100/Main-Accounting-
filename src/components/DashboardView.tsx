import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRightLeft, ArrowUp, Bell, Boxes, ChartLine,
  ChevronLeft, CircleCheck, CircleHelp, FileMinus2, FilePlus2, Info,
  Landmark, RefreshCw, Search, ShoppingCart, Wallet, Warehouse, X,
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import type { Invoice, Party } from '../types';
import type { NavTab } from './Sidebar';
import { PartyCardexModal } from './PartyCardexModal';
import {
  formatDashboardAmount, getMonthlySales, getPartyBalanceTotals,
  getRecentInvoices, searchDashboardParties,
} from '../utils/dashboard';

interface DashboardViewProps {
  setActiveTab: (tab: NavTab) => void;
  setSubFilter?: (sub: string) => void;
  onOpenNewInvoice: (type?: 'buy' | 'sell') => void;
  onOpenPaymentModal: (type?: 'receive_payment' | 'make_payment', partyId?: string) => void;
  onOpenTransferModal: () => void;
  onViewInvoice: (invoiceId: string) => void;
  onSelectCashAccount?: (accountId: string) => void;
  onOpenDataBackup?: () => void;
}

const invoiceStatus: Record<Invoice['paymentStatus'], { label: string; className: string }> = {
  paid: { label: 'تسویه شده', className: 'is-paid' },
  partial: { label: 'تسویه جزئی', className: 'is-partial' },
  unpaid: { label: 'فاکتور باز', className: 'is-unpaid' },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab, setSubFilter, onOpenNewInvoice, onOpenPaymentModal,
  onViewInvoice, onSelectCashAccount, onOpenDataBackup,
}) => {
  const {
    parties, invoices, warehouses, products, stocks, cashAccounts,
    cashRegister, currencies, companySettings, currentUser, getLowStockAlerts,
  } = useAccounting();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [now, setNow] = useState(() => new Date());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchResults = useMemo(() => searchDashboardParties(parties, searchQuery), [parties, searchQuery]);
  const balances = useMemo(() => getPartyBalanceTotals(parties), [parties]);
  const recentInvoices = useMemo(() => getRecentInvoices(invoices), [invoices]);
  const lowStockAlerts = getLowStockAlerts();
  const rawMaterialCount = products.filter(product => /مواد اولیه|raw material/i.test(product.category)).length;

  const monthlySales = useMemo(() => getMonthlySales(invoices, (amount, currency) => {
    if (currency === 'AFN') return amount;
    const rate = currency === 'USD'
      ? cashRegister.usdToAfnRate
      : currencies.find(item => item.code === currency)?.exchangeRateToAFN;
    return rate && rate > 0 ? amount * rate : NaN;
  }, companySettings.calendarType || 'jalali', now), [invoices, currencies, cashRegister.usdToAfnRate, companySettings.calendarType, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], dialog');
      if (!editing && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === '/' || event.key.toLowerCase() === 'f')) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    const onOutsideClick = (event: PointerEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) setIsSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onOutsideClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutsideClick);
    };
  }, []);

  const navigate = (tab: NavTab, filter = 'all') => {
    setSubFilter?.(filter);
    setActiveTab(tab);
  };
  const openParty = (party: Party) => {
    setSelectedParty(party);
    setSearchQuery('');
    setIsSearchOpen(false);
  };
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsSearchOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsSearchOpen(true);
      if (searchResults.length) setSelectedIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + searchResults.length) % searchResults.length);
    }
    if (event.key === 'Enter' && isSearchOpen && searchResults.length) {
      event.preventDefault();
      openParty(searchResults[selectedIndex] || searchResults[0]);
    }
  };
  const showSearch = isSearchOpen && !!searchQuery.trim();

  return (
    <div className="reference-dashboard" dir="rtl">
      <h1 className="dashboard-greeting">خوش آمدید، جناب {currentUser.role === 'admin' ? 'مدیر کل سیستم' : currentUser.name}
        <span>خلاصه وضعیت مالی، فروش و موجودی گدام‌ها</span>
      </h1>

      <section className="dash-quick" aria-label="کارتایل سریع و میانبرها">
        <div className="dash-quick-intro">
          <h2><CircleHelp aria-hidden="true" /> کارتایل سریع و میانبرها</h2>
          <p>فوکوس روی کادر جستجو با فشردن کلید <kbd>/</kbd> یا <kbd>F</kbd></p>
          <div className="dash-quick-actions">
            <button type="button" id="dashboard-btn-new-sale" className="is-green" onClick={() => onOpenNewInvoice('sell')}><FilePlus2 aria-hidden="true" />فاکتور فروش جدید</button>
            <button type="button" id="dashboard-btn-new-purchase" className="is-red" onClick={() => onOpenNewInvoice('buy')}><ShoppingCart aria-hidden="true" />فاکتور خرید جدید</button>
            <button type="button" id="dashboard-btn-new-payment" className="is-blue" onClick={() => navigate('receipt_payment_hub')}><ArrowRightLeft aria-hidden="true" />دریافت و پرداخت جدید</button>
          </div>
        </div>
        <div className="dash-search" ref={searchContainerRef}>
          <Search className="dash-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef} id="dashboard-search-input" type="search" role="combobox"
            aria-label="جستجوی مشتری یا کد حساب" aria-autocomplete="list"
            aria-expanded={showSearch} aria-controls="dashboard-search-results"
            aria-activedescendant={showSearch && searchResults[selectedIndex] ? `dashboard-party-${searchResults[selectedIndex].id}` : undefined}
            autoComplete="off" value={searchQuery}
            placeholder="نام مشتری یا کد حساب را اینجا بنویسید (مثال: حاجی موسی، مرکزی)..."
            onChange={event => { setSearchQuery(event.target.value); setSelectedIndex(0); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)} onKeyDown={handleSearchKeyDown}
          />
          {searchQuery && <button type="button" className="dash-search-clear" aria-label="پاک کردن جستجو" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}><X /></button>}
          {showSearch && (
            <div className="dash-search-dropdown">
              <span className="dash-search-caption">نتایج جستجوی حساب‌ها ({searchResults.length})</span>
              <ul id="dashboard-search-results" role="listbox" aria-label="حساب‌های پیدا شده">
                {searchResults.map((party, index) => (
                  <li key={party.id} id={`dashboard-party-${party.id}`} role="option" aria-selected={index === selectedIndex}>
                    <button type="button" className={index === selectedIndex ? 'is-selected' : ''} onMouseEnter={() => setSelectedIndex(index)} onClick={() => openParty(party)}>
                      <span><strong>{party.name}</strong><small>{party.company || party.phone || 'طرف حساب'}{party.code ? ` · کد ${party.code}` : ''}</small></span>
                      <ChevronLeft aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {!searchResults.length && <p role="status">مشتری یا حسابی با این مشخصات پیدا نشد.</p>}
            </div>
          )}
        </div>
      </section>

      <section className="dash-metrics" aria-label="شاخص‌های مدیریتی">
        <button type="button" className="dash-metric" onClick={() => navigate('sales_invoices')}>
          <span className="dash-metric-icon is-blue"><ChartLine aria-hidden="true" /></span>
          <span className="dash-metric-label">فروش کل ماه جاری</span>
          <span className="dash-metric-value workspace-number"><small>AFN</small> {formatDashboardAmount(monthlySales.currentMonthAFN, 0)}</span>
          <span className="dash-metric-footer">
            {monthlySales.growthPercent !== null ? (
              <span className={`dash-growth ${monthlySales.growthPercent < 0 ? 'is-negative' : ''}`} title="مقایسه فروش خالص با کل ماه گذشته">
                {monthlySales.growthPercent < 0 ? <ArrowDown /> : <ArrowUp />} <b className="workspace-number">{formatDashboardAmount(Math.abs(monthlySales.growthPercent), 0)}%</b> {monthlySales.growthPercent < 0 ? 'کاهش' : 'رشد'}
              </span>
            ) : <span className="dash-metric-note">{monthlySales.salesCount ? `${monthlySales.salesCount} فاکتور در این ماه` : 'هنوز فروشی در این ماه ثبت نشده'}</span>}
          </span>
        </button>
        <button type="button" className="dash-metric" onClick={() => navigate('products')}>
          <span className="dash-metric-icon is-green"><Boxes aria-hidden="true" /></span>
          <span className="dash-metric-label">تنوع کالا در سیستم</span>
          <span className="dash-metric-value"><b className="workspace-number">{products.length}</b> <small>قلم</small></span>
          <span className="dash-metric-footer"><RefreshCw aria-hidden="true" /> شامل {rawMaterialCount} نوع مواد اولیه</span>
        </button>
        <button type="button" className="dash-metric" onClick={() => navigate('warehouses')}>
          <span className="dash-metric-icon is-yellow"><Warehouse aria-hidden="true" /></span>
          <span className="dash-metric-label">تعداد گدام‌های فعال</span>
          <span className="dash-metric-value"><b className="workspace-number">{warehouses.length}</b> <small>گدام</small></span>
          <span className="dash-metric-footer is-yellow"><Boxes aria-hidden="true" /> نظارت بر تفکیک کالاها</span>
        </button>
      </section>

      <section className="dash-balances" aria-label="طلب‌ها و بدهی‌ها">
        <div className="dash-balance is-receivable">
          <div className="dash-balance-heading"><FileMinus2 aria-hidden="true" /><div><h2>مجموع طلبکاری‌ها (طلب‌های ما)</h2><p>کل مبالغی که باید از طرف‌حساب‌ها و مشتریان دریافت کنیم</p></div></div>
          <div className="dash-balance-currencies">
            <div><span>طلب بر اساس ارز (USD):</span><strong className="workspace-number"><small>USD</small> {formatDashboardAmount(balances.receivableUSD)}</strong></div>
            <div><span>طلب بر اساس ارز (AFN):</span><strong className="workspace-number"><small>AFN</small> {formatDashboardAmount(balances.receivableAFN)}</strong></div>
          </div>
        </div>
        <div className="dash-balance is-payable">
          <div className="dash-balance-heading"><FilePlus2 aria-hidden="true" /><div><h2>مجموع بدهکاری‌ها (بدهی‌های ما)</h2><p>کل تعهدات مالی و مبالغی که باید به تأمین‌کنندگان پرداخت کنیم</p></div></div>
          <div className="dash-balance-currencies">
            <div><span>بدهی بر اساس ارز (USD):</span><strong className="workspace-number"><small>USD</small> {formatDashboardAmount(balances.payableUSD)}</strong></div>
            <div><span>بدهی بر اساس ارز (AFN):</span><strong className="workspace-number"><small>AFN</small> {formatDashboardAmount(balances.payableAFN)}</strong></div>
          </div>
        </div>
      </section>

      <section className="dash-section" aria-labelledby="dashboard-cash-title">
        <h2 id="dashboard-cash-title" className="dash-section-heading"><span className="is-blue"><Wallet aria-hidden="true" /></span>صندوق‌ها و حساب‌های فعال</h2>
        <div className="dash-account-grid">
          {cashAccounts.map(account => (
            <button type="button" className="dash-account-card" key={account.id} onClick={() => { setSubFilter?.('all'); onSelectCashAccount ? onSelectCashAccount(account.id) : navigate('cash', account.id); }}>
              <Landmark className="dash-bank-icon" aria-hidden="true" />
              <strong>{account.name}</strong><span className="dash-card-caption">موجودی فعلی:</span>
              <span className={`dash-account-amount workspace-number ${account.balance < 0 ? 'is-negative' : ''}`}><small>{account.currency === 'USD' ? '$' : account.currency}</small> {formatDashboardAmount(account.balance)}</span>
              <span className="dash-card-link">مشاهده ریز تراکنش‌ها <ChevronLeft aria-hidden="true" /></span>
            </button>
          ))}
          {!cashAccounts.length && <div className="dash-empty-panel"><Wallet aria-hidden="true" /><p>هنوز صندوقی تعریف نشده است.</p><button type="button" onClick={() => navigate('cash')}>تعریف صندوق</button></div>}
        </div>
      </section>

      <section className="dash-section" aria-labelledby="dashboard-warehouse-title">
        <h2 id="dashboard-warehouse-title" className="dash-section-heading"><span className="is-yellow"><Warehouse aria-hidden="true" /></span>وضعیت گدام‌ها (انبارها)</h2>
        <div className="dash-account-grid">
          {warehouses.map(warehouse => {
            const stockCount = new Set(stocks.filter(stock => stock.warehouseId === warehouse.id && (stock.quantityTons > 0 || stock.quantityBags > 0)).map(stock => stock.productId)).size;
            return (
              <button type="button" className="dash-warehouse-card" key={warehouse.id} onClick={() => navigate(warehouse.type === 'standard' ? 'warehouses' : 'consignment')}>
                <span className="dash-warehouse-tag">{warehouse.type === 'standard' ? 'ملکی' : warehouse.type === 'consignment_in' ? 'امانی دیگران' : 'امانی شرکت'}</span>
                <Warehouse className="dash-warehouse-icon" aria-hidden="true" />
                <strong>{warehouse.name}</strong><span className="dash-stock-count"><i className={stockCount ? 'has-stock' : ''} />{stockCount} قلم جنس موجود</span>
                <span className="dash-card-link">مشاهده موجودی گدام <ChevronLeft aria-hidden="true" /></span>
              </button>
            );
          })}
          {!warehouses.length && <div className="dash-empty-panel"><Warehouse aria-hidden="true" /><p>هنوز گدامی تعریف نشده است.</p><button type="button" onClick={() => navigate('warehouses')}>تعریف گدام</button></div>}
        </div>
      </section>

      <div className="dash-bottom-grid">
        <section className="dash-recent" aria-labelledby="dashboard-invoices-title">
          <div className="dash-panel-heading"><h2 id="dashboard-invoices-title">آخرین فاکتورهای بازرگانی</h2><button type="button" onClick={() => navigate('trade_hub')}>مشاهده همه</button></div>
          <div className="dash-table-scroll">
            <table className="dash-invoice-table">
              <thead><tr><th scope="col">مشتری / فروشنده</th><th scope="col">کد فاکتور</th><th scope="col">مبلغ کل</th><th scope="col">وضعیت فاکتور</th><th scope="col">تاریخ ثبت</th></tr></thead>
              <tbody>
                {recentInvoices.map(invoice => {
                  const status = invoiceStatus[invoice.paymentStatus] || invoiceStatus.unpaid;
                  return <tr key={invoice.id}>
                    <td><button type="button" className="dash-invoice-party" onClick={() => onViewInvoice(invoice.id)}><FilePlus2 aria-hidden="true" />{invoice.partyName}</button></td>
                    <td><button type="button" className="dash-invoice-code workspace-number" onClick={() => onViewInvoice(invoice.id)} aria-label={`مشاهده فاکتور ${invoice.invoiceNumber}`}>#{invoice.invoiceNumber.replace(/^#/, '')}</button></td>
                    <td><span className="workspace-number"><small>{invoice.currency}</small> {formatDashboardAmount(invoice.totalAmount)}</span></td>
                    <td><span className={`dash-invoice-status ${status.className}`}>{status.label}</span></td>
                    <td>{invoice.date}</td>
                  </tr>;
                })}
                {!recentInvoices.length && <tr><td colSpan={5} className="dash-empty-invoices"><FilePlus2 aria-hidden="true" /><p>هنوز فاکتوری ثبت نشده است.</p><button type="button" onClick={() => onOpenNewInvoice('sell')}>ثبت اولین فاکتور فروش</button></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="dash-announcements" aria-labelledby="dashboard-announcements-title">
          <h2 id="dashboard-announcements-title"><Bell aria-hidden="true" />اعلان‌های سیستم</h2>
          <p className="dash-announcements-caption">اعلان‌ها و وضعیت به‌روز سیستم حسابداری</p>
          {lowStockAlerts.length > 0 ? <button type="button" className="dash-announcement is-warning" onClick={() => navigate('reports', 'inventory')}><Info aria-hidden="true" /><span>موجودی {lowStockAlerts.length} قلم کالا به حداقل رسیده است.</span></button> : <div className="dash-announcement is-clear"><CircleCheck aria-hidden="true" /><span>در حال حاضر هشدار کمبود موجودی ندارید.</span></div>}
          <button type="button" className="dash-announcement is-info" onClick={() => onOpenDataBackup ? onOpenDataBackup() : navigate('audit_log')}><Info aria-hidden="true" /><span>پشتیبان‌گیری منظم از اطلاعات حسابداری را فراموش نکنید.</span></button>
        </section>
      </div>

      <PartyCardexModal party={selectedParty} isOpen={!!selectedParty} onClose={() => { setSelectedParty(null); searchInputRef.current?.focus(); }} onViewInvoice={onViewInvoice} onOpenPaymentModal={onOpenPaymentModal} />
    </div>
  );
};

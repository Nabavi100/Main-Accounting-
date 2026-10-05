import React, { useState, useEffect } from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SalesPurchaseView } from './components/SalesPurchaseView';
import { CustomersView } from './components/CustomersView';
import { InitialDefinitionsView } from './components/InitialDefinitionsView';
import { WarehousesView } from './components/WarehousesView';
import { CashAndExchangeView } from './components/CashAndExchangeView';
import { ProductsView } from './components/ProductsView';
import { CurrenciesView } from './components/CurrenciesView';
import { ExpensesView } from './components/ExpensesView';
import { IncomesView } from './components/IncomesView';
import { ReportsView } from './components/ReportsView';
import { DocumentPrintModal } from './components/DocumentPrintModal';
import { AccessAndResetModal } from './components/AccessAndResetModal';
import { PaymentModal } from './components/PaymentModal';
import { StockTransferModal } from './components/StockTransferModal';
import { InvoiceType, PrintableDocumentPayload, Invoice } from './types';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { EditInvoiceModal } from './components/EditInvoiceModal';
import { TransactionsLedgerView } from './components/TransactionsLedgerView';

import { FixedAssetsView } from './components/FixedAssetsView';
import { ShareholdersView } from './components/ShareholdersView';

// Dedicated standalone views
import { SalesInvoiceCreateView } from './components/SalesInvoiceCreateView';
import { SalesInvoicesListView } from './components/SalesInvoicesListView';
import { PurchaseInvoiceCreateView } from './components/PurchaseInvoiceCreateView';
import { PurchaseInvoicesListView } from './components/PurchaseInvoicesListView';
import { ReceiptCreateView } from './components/ReceiptCreateView';
import { ReceiptsListView } from './components/ReceiptsListView';
import { PaymentCreateView } from './components/PaymentCreateView';
import { PaymentsListView } from './components/PaymentsListView';
import { TradeOperationsHubView } from './components/TradeOperationsHubView';
import { ReceiptPaymentHubView } from './components/ReceiptPaymentHubView';
import { AuditLogView } from './components/AuditLogView';
import { ComprehensiveJournalView } from './components/ComprehensiveJournalView';
import { TelegramManagementView } from './components/TelegramManagementView';
import { TelegramBotModal } from './components/TelegramBotModal';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { LicenseStatusResult, verifyLicense } from './utils/licenseSecurity';
import { SecretLicenseModal } from './components/SecretLicenseModal';
import { LicenseWarningModal } from './components/LicenseWarningModal';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { QuickDataBackupModal } from './components/QuickDataBackupModal';
import { TelegramPendingApprovalModal } from './components/TelegramPendingApprovalModal';
import { fetchTelegramStatus } from './services/telegramApiService';
import { playChimeSound } from './utils/audio';
import { Bell } from 'lucide-react';

const MainApp: React.FC = () => {
  const {
    invoices,
    parties,
    updateParty,
    notify,
    activePrintDoc,
    closePrintModal,
    openPrintModal,
    isAuthenticated,
    companySettings,
    logout,
  } = useAccounting();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [subFilter, setSubFilter] = useState<string>('all');

  // References for live Telegram Bot listener
  const partiesRef = React.useRef(parties);
  partiesRef.current = parties;
  const invoicesRef = React.useRef(invoices);
  invoicesRef.current = invoices;
  const companySettingsRef = React.useRef(companySettings);
  companySettingsRef.current = companySettings;

  // Auto-sync client-side Telegram token with backend server polling engine
  useEffect(() => {
    try {
      const rawClientSettings =
        localStorage.getItem('accounting_telegram_settings_v1') ||
        localStorage.getItem('telegram_bot_settings');
      if (rawClientSettings) {
        const parsed = JSON.parse(rawClientSettings);
        if (parsed.botToken) {
          fetch('/api/telegram/config')
            .then(res => res.json())
            .then(serverCfg => {
              if (!serverCfg.botToken) {
                fetch('/api/telegram/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    botToken: parsed.botToken,
                    defaultChatId: parsed.defaultChatId || '',
                    autoPolling: true,
                    botUsername: parsed.botUsername,
                    botFirstName: parsed.botFirstName,
                  }),
                }).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, []);

  // License Security & Expiration Management State
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);
  const [isSecretLicenseModalOpen, setIsSecretLicenseModalOpen] = useState(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isQuickBackupModalOpen, setIsQuickBackupModalOpen] = useState(false);
  const [isTelegramPendingModalOpen, setIsTelegramPendingModalOpen] = useState(false);
  const [telegramPendingUsers, setTelegramPendingUsers] = useState<any[]>([]);
  const previousPendingIdsRef = React.useRef<Set<string>>(new Set());
  const previousActivityTimeRef = React.useRef<number>(0);
  const previousUserActiveTimesRef = React.useRef<Map<string, string>>(new Map());

  // Periodically check for Telegram users awaiting approval (fast 2.5s polling)
  useEffect(() => {
    let isMounted = true;
    const checkPendingTelegram = async () => {
      try {
        const status = await fetchTelegramStatus();
        if (!isMounted) return;
        const pending = status.pendingUsers || [];
        setTelegramPendingUsers(pending);

        // Alert user with chime and notification when new pending customers arrive or re-activate
        let hasNewArrival = false;
        let alertUser: any = null;

        pending.forEach(u => {
          const prevActive = previousUserActiveTimesRef.current.get(u.id);
          const currentActive = u.lastActiveAt || u.registeredAt;

          if (!previousPendingIdsRef.current.has(u.id)) {
            previousPendingIdsRef.current.add(u.id);
            previousUserActiveTimesRef.current.set(u.id, currentActive);
            hasNewArrival = true;
            alertUser = u;
          } else if (prevActive && currentActive && prevActive !== currentActive) {
            previousUserActiveTimesRef.current.set(u.id, currentActive);
            hasNewArrival = true;
            alertUser = u;
          }
        });

        // Also check if server detected general telegram activity
        if (
          status.latestActivityTimestamp &&
          previousActivityTimeRef.current !== 0 &&
          status.latestActivityTimestamp > previousActivityTimeRef.current &&
          pending.length > 0
        ) {
          hasNewArrival = true;
          if (!alertUser && pending.length > 0) alertUser = pending[0];
        }
        if (status.latestActivityTimestamp) {
          previousActivityTimeRef.current = status.latestActivityTimestamp;
        }

        if (hasNewArrival && alertUser) {
          playChimeSound();
          const displayName = alertUser.fullName || alertUser.username || alertUser.phoneNumber || 'کاربر جدید تلگرام';
          notify(
            'warning',
            '🔔 درخواست اتصال تلگرام',
            `کاربر ${displayName} (${alertUser.username || 'کد: ' + alertUser.connectionCode}) ربات را استارت زده و منتظر اتصال به حساب است.`
          );
        }
      } catch {}
    };

    checkPendingTelegram();
    const interval = setInterval(checkPendingTelegram, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [notify]);

  const refreshLicense = async () => {
    try {
      const res = await verifyLicense();
      setLicenseStatus(res);
      if (res.shouldShowDailyAlert || res.shouldShowHourlyAlert) {
        setIsWarningModalOpen(true);
      }
    } catch (e) {
      console.error('License check error:', e);
    }
  };

  useEffect(() => {
    refreshLicense();
    const interval = setInterval(refreshLicense, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-lock inactivity listener based on company settings
  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutMinutes = companySettings?.autoLockMinutes || 0;
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let timerId: any = null;

    const performLock = () => {
      logout();
    };

    const resetTimer = () => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(performLock, timeoutMs);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    let lastReset = Date.now();

    const handleActivity = () => {
      const now = Date.now();
      // Throttle event checks to at most once per 1.5 seconds
      if (now - lastReset > 1500) {
        lastReset = now;
        resetTimer();
      }
    };

    activityEvents.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    resetTimer();

    return () => {
      if (timerId) clearTimeout(timerId);
      activityEvents.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [isAuthenticated, companySettings?.autoLockMinutes, logout]);

  // Modals state
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<Invoice | null>(null);
  const [editingInvoiceGlobal, setEditingInvoiceGlobal] = useState<Invoice | null>(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessModalInitialTab, setAccessModalInitialTab] = useState<
    'roles' | 'reset' | 'backup' | 'company' | 'telegram'
  >('roles');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalType, setPaymentModalType] = useState<
    'receive_payment' | 'make_payment' | 'cash_transfer' | 'currency_exchange'
  >('receive_payment');
  const [paymentPartyId, setPaymentPartyId] = useState<string | undefined>(undefined);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromWarehouseId, setTransferFromWarehouseId] = useState<string | undefined>(undefined);

  const [salesInitialType, setSalesInitialType] = useState<InvoiceType>('sell');
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string | undefined>(undefined);

  const handleSelectCashAccount = (accountId: string) => {
    setSelectedCashAccountId(accountId);
    setActiveTab('cash');
  };

  const handleOpenNewInvoice = (type: InvoiceType = 'sell') => {
    if (type === 'buy') {
      setActiveTab('new_purchase');
    } else if (type === 'return_sell') {
      setSubFilter('return_sell');
      setActiveTab('new_return_sell');
    } else if (type === 'return_buy') {
      setSubFilter('return_buy');
      setActiveTab('new_return_buy');
    } else {
      setActiveTab('new_sale');
    }
  };

  const handleOpenPaymentModal = (
    type: 'receive_payment' | 'make_payment' | 'cash_transfer' | 'currency_exchange' = 'receive_payment',
    partyId?: string
  ) => {
    if (type === 'receive_payment') {
      setPaymentPartyId(partyId);
      setActiveTab('new_receipt');
    } else if (type === 'make_payment') {
      setPaymentPartyId(partyId);
      setActiveTab('new_payment');
    } else {
      setPaymentModalType(type);
      setPaymentPartyId(partyId);
      setIsPaymentModalOpen(true);
    }
  };

  const handleOpenTransferModal = (fromWarehouseId?: string) => {
    setTransferFromWarehouseId(fromWarehouseId);
    setIsTransferModalOpen(true);
  };

  const handleOpenAccessModal = (
    tab: 'roles' | 'reset' | 'backup' | 'company' | 'telegram' = 'roles'
  ) => {
    setAccessModalInitialTab(tab);
    setIsAccessModalOpen(true);
  };

  const handleViewInvoice = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      setSelectedInvoiceForDetail(inv);
    }
  };

  // Full Security Lock Screen if license is expired, tampered, or clock rolled back
  if (
    licenseStatus &&
    (!licenseStatus.isValid ||
      licenseStatus.isExpired ||
      licenseStatus.isTampered ||
      licenseStatus.isClockRolledBack)
  ) {
    return (
      <ErrorBoundary>
        <LicenseLockScreen
          status={licenseStatus}
          onActivated={refreshLicense}
          onOpenSecretModal={() => setIsSecretLicenseModalOpen(true)}
        />
        <SecretLicenseModal
          isOpen={isSecretLicenseModalOpen}
          onClose={() => setIsSecretLicenseModalOpen(false)}
          onLicenseUpdated={refreshLicense}
        />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginScreen />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-800 font-sans overflow-hidden select-none" dir="rtl">
      {/* Sidebar with Hierarchical Submenus and Dynamic Theme/Style */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        subFilter={subFilter}
        setSubFilter={setSubFilter}
        onOpenNewInvoice={handleOpenNewInvoice}
        onOpenPaymentModal={handleOpenPaymentModal}
        onOpenTransferModal={handleOpenTransferModal}
        onOpenAccessModal={handleOpenAccessModal}
        onOpenTelegramModal={() => setActiveTab('telegram_manager')}
        onOpenQuickBackupModal={() => setIsQuickBackupModalOpen(true)}
        onOpenTelegramPendingModal={() => setIsTelegramPendingModalOpen(true)}
        telegramPendingCount={telegramPendingUsers.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onOpenNewInvoice={handleOpenNewInvoice}
          onOpenPaymentModal={handleOpenPaymentModal}
          onOpenAccessModal={handleOpenAccessModal}
          onOpenTelegramModal={() => setActiveTab('telegram_manager')}
          onOpenDataBackupModal={() => setIsQuickBackupModalOpen(true)}
          onOpenTelegramPendingModal={() => setIsTelegramPendingModalOpen(true)}
          telegramPendingCount={telegramPendingUsers.length}
          telegramPendingPhone={telegramPendingUsers[0]?.phoneNumber}
          telegramPendingName={telegramPendingUsers[0]?.fullName || telegramPendingUsers[0]?.username}
        />

        {/* Telegram Pending Approval Global Alert Banner */}
        {telegramPendingUsers.length > 0 && (
          <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-300 text-slate-950 px-4 py-2.5 shadow-xs border-b border-amber-400/80 flex items-center justify-between gap-3 text-xs z-30 select-none animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black bg-slate-900 text-amber-300 px-2 py-0.5 rounded text-[11px] shrink-0">
                  🔔 درخواست اتصال تلگرام ({telegramPendingUsers.length})
                </span>
                <span className="font-bold text-slate-950 truncate">
                  کاربر <strong>{telegramPendingUsers[0]?.fullName || telegramPendingUsers[0]?.username || 'جدید'}</strong>
                  {telegramPendingUsers[0]?.username ? ` (${telegramPendingUsers[0]?.username})` : ''} ربات را استارت زده و منتظر تایید است.
                </span>
                {telegramPendingUsers[0]?.connectionCode && (
                  <span className="hidden sm:inline font-mono bg-white/70 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-900 border border-amber-400/50">
                    کد اتصال: {telegramPendingUsers[0]?.connectionCode}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsTelegramPendingModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-amber-300 font-black rounded-xl text-xs transition shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>مشاهده و اتصال به پرونده مشتری</span>
              </button>
            </div>
          </div>
        )}

        {/* View Body */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <DashboardView
                setActiveTab={setActiveTab}
                setSubFilter={setSubFilter}
                onOpenNewInvoice={handleOpenNewInvoice}
                onOpenPaymentModal={handleOpenPaymentModal}
                onOpenTransferModal={handleOpenTransferModal}
                onViewInvoice={handleViewInvoice}
                onSelectCashAccount={handleSelectCashAccount}
              />
            )}

            {/* Comprehensive Journal / روزنامچه جامع رویدادها و تراکنش‌ها */}
            {activeTab === 'journal' && (
              <ComprehensiveJournalView
                onViewInvoice={handleViewInvoice}
                onOpenPaymentModal={handleOpenPaymentModal}
              />
            )}

            {/* Master Ledger */}
            {activeTab === 'transactions' && (
              <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                <TransactionsLedgerView
                  onViewInvoice={handleViewInvoice}
                  onOpenNewInvoice={handleOpenNewInvoice}
                  onOpenPaymentModal={handleOpenPaymentModal}
                  onOpenTransferModal={handleOpenTransferModal}
                />
              </div>
            )}

            {/* TRADE OPERATIONS HUB (خرید، فروش، برگشت از خرید، برگشت از فروش) */}
            {(activeTab === 'trade_hub' ||
              activeTab === 'sales_invoices' ||
              activeTab === 'purchase_invoices' ||
              activeTab === 'new_sale' ||
              activeTab === 'new_purchase' ||
              activeTab === 'return_sell' ||
              activeTab === 'return_buy' ||
              activeTab === 'new_return_sell' ||
              activeTab === 'new_return_buy' ||
              activeTab === 'invoices') && (
              <TradeOperationsHubView
                key={`${activeTab}-${subFilter}`}
                initialType={
                  activeTab === 'new_return_sell' || activeTab === 'return_sell' || (activeTab === 'trade_hub' && subFilter === 'return_sell')
                    ? 'return_sell'
                    : activeTab === 'new_return_buy' || activeTab === 'return_buy' || (activeTab === 'trade_hub' && subFilter === 'return_buy')
                    ? 'return_buy'
                    : activeTab === 'new_purchase' || activeTab === 'purchase_invoices' || (activeTab === 'trade_hub' && subFilter === 'buy')
                    ? 'buy'
                    : 'sell'
                }
                initialViewMode={
                  activeTab === 'new_sale' || activeTab === 'new_purchase' || activeTab === 'new_return_sell' || activeTab === 'new_return_buy'
                    ? 'create'
                    : subFilter === 'itemized' || subFilter === 'product_sales'
                    ? 'itemized'
                    : 'list'
                }
                onViewInvoice={handleViewInvoice}
                onOpenPaymentModal={handleOpenPaymentModal}
              />
            )}

          {/* RECEIPTS & PAYMENTS HUB (دریافت، لیست دریافتی‌ها، پرداخت، لیست پرداختی‌ها) */}
          {(activeTab === 'receipt_payment_hub' ||
            activeTab === 'receipts_list' ||
            activeTab === 'payments_list' ||
            activeTab === 'new_receipt' ||
            activeTab === 'new_payment') && (
            <ReceiptPaymentHubView
              initialTab={
                activeTab === 'new_receipt'
                  ? 'create_receipt'
                  : activeTab === 'new_payment'
                  ? 'create_payment'
                  : activeTab === 'payments_list'
                  ? 'list_payments'
                  : 'list_receipts'
              }
              initialPartyId={paymentPartyId}
              onViewInvoice={handleViewInvoice}
            />
          )}

          {/* Definitions / تعاریف اولیه یکپارچه */}
          {activeTab === 'definitions' && (
            <InitialDefinitionsView
              initialSubTab={
                subFilter === 'products'
                  ? 'products'
                  : subFilter === 'warehouses'
                  ? 'warehouses'
                  : subFilter === 'cash'
                  ? 'cash'
                  : subFilter === 'expenses'
                  ? 'expenses'
                  : subFilter === 'incomes'
                  ? 'incomes'
                  : subFilter === 'currencies'
                  ? 'currencies'
                  : subFilter === 'fixed_assets'
                  ? 'fixed_assets'
                  : subFilter === 'shareholders'
                  ? 'shareholders'
                  : 'parties'
              }
              onOpenPaymentModal={handleOpenPaymentModal}
              onViewInvoice={handleViewInvoice}
              onOpenTransferModal={handleOpenTransferModal}
            />
          )}

          {/* Parties / Customers */}
          {activeTab === 'customers' && (
            <InitialDefinitionsView
              initialSubTab="parties"
              initialGroupId={subFilter !== 'all' ? subFilter : undefined}
              onOpenPaymentModal={handleOpenPaymentModal}
              onViewInvoice={handleViewInvoice}
              onOpenTransferModal={handleOpenTransferModal}
            />
          )}

          {/* Warehouses */}
          {activeTab === 'warehouses' && (
            <WarehousesView
              onOpenTransferModal={handleOpenTransferModal}
              consignmentOnly={false}
              initialFilterType={subFilter === 'consignment' ? 'consignment' : 'all'}
            />
          )}

          {activeTab === 'consignment' && (
            <WarehousesView
              onOpenTransferModal={handleOpenTransferModal}
              consignmentOnly={true}
              initialFilterType="consignment"
            />
          )}

          {/* Cash & Bank */}
          {activeTab === 'cash' && (
            <CashAndExchangeView
              onOpenPaymentModal={handleOpenPaymentModal}
              initialSelectedAccountId={subFilter && subFilter !== 'all' ? subFilter : selectedCashAccountId}
            />
          )}

          {/* Products & Price list */}
          {activeTab === 'products' && <ProductsView onViewInvoice={handleViewInvoice} />}

          {/* Expenses */}
          {activeTab === 'expenses' && (
            <ExpensesView
              onOpenPaymentModal={handleOpenPaymentModal}
              autoOpenCreate={subFilter === 'create' || subFilter === 'new_expense'}
            />
          )}

          {/* Incomes */}
          {activeTab === 'incomes' && (
            <IncomesView
              onOpenPaymentModal={handleOpenPaymentModal}
              autoOpenCreate={subFilter === 'create' || subFilter === 'new_income'}
            />
          )}

          {/* Currencies */}
          {activeTab === 'currencies' && <CurrenciesView />}

          {/* Fixed Assets */}
          {activeTab === 'fixed_assets' && <FixedAssetsView />}

          {/* Shareholders */}
          {activeTab === 'shareholders' && <ShareholdersView />}

          {/* Reports */}
          {activeTab === 'reports' && (
            <ReportsView
              initialSection={subFilter}
              onViewInvoice={handleViewInvoice}
              onOpenPaymentModal={handleOpenPaymentModal}
              onOpenTransferModal={handleOpenTransferModal}
            />
          )}

          {/* Audit Log / دفتر ممیزی، امنیت و رویدادهای سیستم */}
          {activeTab === 'audit_log' && <AuditLogView />}

          {/* Telegram Management View / ماژول جامع مدیریت تلگرام */}
          {activeTab === 'telegram_manager' && (
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
              <TelegramManagementView />
            </div>
          )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Notifications Toast */}
      <ToastContainer />

      {/* Invoice Detail Modal (Form Shik) */}
      <InvoiceDetailModal
        invoice={selectedInvoiceForDetail}
        isOpen={!!selectedInvoiceForDetail}
        onClose={() => setSelectedInvoiceForDetail(null)}
        onPrint={inv => {
          setSelectedInvoiceForDetail(null);
          openPrintModal({
            type: 'invoice',
            invoice: inv,
          });
        }}
        onOpenPayment={(type, partyId) => {
          handleOpenPaymentModal(type, partyId);
        }}
        onEditInvoice={inv => {
          setSelectedInvoiceForDetail(null);
          setEditingInvoiceGlobal(inv);
        }}
      />

      {/* Global Edit Invoice Modal */}
      <EditInvoiceModal
        isOpen={!!editingInvoiceGlobal}
        invoice={editingInvoiceGlobal}
        onClose={() => setEditingInvoiceGlobal(null)}
      />

      {/* Printing & Document Modal */}
      <DocumentPrintModal
        document={activePrintDoc}
        onClose={closePrintModal}
      />

      {/* Access Control & Reset Modal */}
      <AccessAndResetModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        initialTab={accessModalInitialTab}
      />

      {/* Quick Payment / Transfer Modal (fallback for quick modal actions) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentPartyId(undefined);
        }}
        initialType={paymentModalType}
        initialPartyId={paymentPartyId}
      />

      {/* Warehouse Stock Transfer Modal */}
      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferFromWarehouseId(undefined);
        }}
        initialFromWarehouseId={transferFromWarehouseId}
      />

      {/* License Warning Modal (Daily in last week / Hourly on last day) */}
      {licenseStatus && (
        <LicenseWarningModal
          status={licenseStatus}
          isOpen={isWarningModalOpen}
          onClose={() => setIsWarningModalOpen(false)}
          onActivated={refreshLicense}
          onOpenSecretModal={() => setIsSecretLicenseModalOpen(true)}
        />
      )}

      {/* Secret License Management Modal */}
      <SecretLicenseModal
        isOpen={isSecretLicenseModalOpen}
        onClose={() => setIsSecretLicenseModalOpen(false)}
        onLicenseUpdated={refreshLicense}
      />

      {/* Telegram Bot Settings Modal */}
      <TelegramBotModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* Quick Data Backup & Restore Modal (جهت ارسال دیتا به چت و بازیابی آسان دیتابیس) */}
      <QuickDataBackupModal
        isOpen={isQuickBackupModalOpen}
        onClose={() => setIsQuickBackupModalOpen(false)}
      />

      {/* Floating alert card when there are pending Telegram customer requests */}
      {telegramPendingUsers.length > 0 && !isTelegramPendingModalOpen && (
        <aside
          role="region"
          aria-label="درخواست‌های جدید ربات تلگرام"
          className="fixed bottom-6 left-6 z-[9990] max-w-sm bg-slate-900/95 backdrop-blur-md text-white border-2 border-amber-400 p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 animate-bounce">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-amber-300">🔔 مشتری جدید تلگرام منتظر تایید</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                  {telegramPendingUsers.length} مورد
                </span>
              </div>
              <p className="text-xs font-bold text-white mt-1 truncate">
                {telegramPendingUsers[0]?.fullName || telegramPendingUsers[0]?.username || 'کاربر جدید'}
                {telegramPendingUsers[0]?.connectionCode && (
                  <span className="text-amber-300 font-mono text-[11px] mr-1">
                    (کد: {telegramPendingUsers[0]?.connectionCode})
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ربات را استارت زده و در انتظار اتصال به حساب مالی است.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setIsTelegramPendingModalOpen(true)}
                  className="flex-1 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer text-center shadow-md active:scale-95"
                >
                  مشاهده و اتصال به پرونده
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Telegram Pending Approval Modal (تایید و اتصال فوری مشتریان جدید به حساب) */}
      <TelegramPendingApprovalModal
        isOpen={isTelegramPendingModalOpen}
        onClose={() => setIsTelegramPendingModalOpen(false)}
        onOpenQuickAddParty={(defaultName, defaultPhone) => {
          setIsTelegramPendingModalOpen(false);
          setActiveTab('customers');
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AccountingProvider>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </AccountingProvider>
    </ErrorBoundary>
  );
}

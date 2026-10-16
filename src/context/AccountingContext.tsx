import { matchesUserPassword } from "../utils/authentication";
import { companyCashAccountId, companyCashNumber, companyCashTransaction, duplicateCompanyCashNumber, isCompanyCashMirror, nextCompanyCashNumber, ownedCompanyCashSource, syncCompanyCashTransaction, validateCompanyCashDocument, type CompanyCashDocument, type CompanyCashKind } from '../utils/companyCash';
import { consignmentBalanceFor, consignmentHoldings, consignmentLots, consignmentSign, consignmentStockPost, consignmentTransfer, isInvoiceConsignmentMovement, roundConsignment, validateConsignmentMovement } from '../utils/consignment';
import { applyTransactionParties, applyTransactionCashAccounts, applyTransactionCashRegister } from '../utils/transactionLedger';
import { normalizeCompanyBranding } from '../utils/companyBranding';
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Product,
  ProductCategory,
  Warehouse,
  StockInventory,
  Party,
  PartyGroup,
  Invoice,
  InvoiceType,
  FinancialTransaction,
  TransactionType,
  StockTransfer,
  CashRegisterState,
  CashRegisterAccount,
  AssetGroup,
  FixedAsset,
  Shareholder,
  Currency,
  CurrencyDefinition,
  Unit,
  AppUser,
  UserRole,
  PrintableDocumentPayload,
  CompanySettings,
  AppFontSize,
  JournalVoucher,
  JournalVoucherLine,
  TrialBalanceAccount,
  ProductProfitabilityAnalysis,
  LowStockAlertItem,
  ExpenseDefinition,
  AuditLogEntry,
  ConsignmentMovement,
  InvoiceItem,
} from '../types';
import {
  initialProducts,
  initialProductCategories,
  initialWarehouses,
  initialStocks,
  initialParties,
  initialPartyGroups,
  initialInvoices,
  initialTransactions,
  initialTransfers,
  initialConsignmentMovements,
  initialCashRegister,
  initialCashAccounts,
  initialAssetGroups,
  initialFixedAssets,
  initialShareholders,
  initialUsers,
  initialCompanySettings,
  initialCurrencies,
  initialExpenseCategories,
  initialExpenseDefinitions,
  initialExpenses,
  initialIncomeCategories,
  initialIncomes,
  initialJournalVouchers,
  initialAuditLogs,
} from '../data/initialData';
import { getCurrentTime, getPersianDate, getTodayDate } from '../utils/formatters';
import { addInvoiceLedgerAmount, createTradeEntityId, applyInvoiceCashAccounts, applyInvoiceCashRegister, applyInvoicePartyBalance, invoiceCashAccountId, invoiceCashDirection, invoiceStockDirection } from '../utils/invoiceLedger';
import { ExpenseCategory, ExpenseItem, IncomeCategory, IncomeItem } from '../types';
import { syncPartiesToBackend } from '../services/telegramApiService';
import {
  startTelegramBotListener,
  stopTelegramBotListener,
  getTelegramSettings,
} from '../services/telegramBotService';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
}

interface AccountingContextType {
  companySettings: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  resetCompanySettings: () => void;

  appFontSize: AppFontSize;
  setAppFontSize: (size: AppFontSize) => void;
  fontSizeNumber: number;
  setFontSizeNumber: (size: number) => void;

  products: Product[];
  productCategories: ProductCategory[];
  addProductCategory: (category: Omit<ProductCategory, 'id' | 'createdAt'>) => ProductCategory;
  updateProductCategory: (id: string, category: Partial<ProductCategory>) => void;
  deleteProductCategory: (id: string) => void;
  getNextProductCode: () => string;
  warehouses: Warehouse[];
  stocks: StockInventory[];
  parties: Party[];
  partyGroups: PartyGroup[];
  getNextPartyCode: () => string;
  invoices: Invoice[];
  transactions: FinancialTransaction[];
  transfers: StockTransfer[];
  cashRegister: CashRegisterState;

  // Expenses & Financial Categories (هزینه‌ها و امور مالی)
  expenses: ExpenseItem[];
  expenseCategories: ExpenseCategory[];
  expenseDefinitions: ExpenseDefinition[];
  createExpense: (expense: Omit<ExpenseItem, 'id' | 'createdAt' | 'expenseNumber'> & { expenseNumber?: string }) => ExpenseItem;
  updateExpense: (id: string, expense: Partial<ExpenseItem>) => void;
  deleteExpense: (id: string) => void;
  addExpenseCategory: (category: Omit<ExpenseCategory, 'id' | 'createdAt'>) => ExpenseCategory;
  updateExpenseCategory: (id: string, category: Partial<ExpenseCategory>) => void;
  deleteExpenseCategory: (id: string) => void;
  addExpenseDefinition: (definition: Omit<ExpenseDefinition, 'id'>) => ExpenseDefinition;
  updateExpenseDefinition: (id: string, definition: Partial<ExpenseDefinition>) => void;
  deleteExpenseDefinition: (id: string) => void;

  // Incomes & Secondary Revenues (عواید، فروش کیسه سیمان، پالت و درآمدهای جانبی)
  incomes: IncomeItem[];
  incomeCategories: IncomeCategory[];
  createIncome: (income: Omit<IncomeItem, 'id' | 'createdAt' | 'incomeNumber'> & { incomeNumber?: string }) => IncomeItem;
  updateIncome: (id: string, income: Partial<IncomeItem>) => void;
  deleteIncome: (id: string) => void;
  addIncomeCategory: (category: Omit<IncomeCategory, 'id' | 'createdAt'>) => IncomeCategory;
  updateIncomeCategory: (id: string, category: Partial<IncomeCategory>) => void;
  deleteIncomeCategory: (id: string) => void;
  getNextIncomeNumber: () => string;

  // Currencies & Exchange Management (اسعار و ارزها)
  currencies: CurrencyDefinition[];
  baseCurrency: CurrencyDefinition;
  setBaseCurrency: (currencyIdOrCode: string) => void;
  convertToBase: (amount: number, fromCurrencyCode: string) => number;
  addCurrency: (currency: Omit<CurrencyDefinition, 'id' | 'createdAt'>) => CurrencyDefinition;
  updateCurrency: (id: string, currency: Partial<CurrencyDefinition>) => void;
  deleteCurrency: (id: string) => void;
  getCurrencyByCode: (code: string) => CurrencyDefinition | undefined;

  // Cash Register Accounts (صندوق‌ها)
  cashAccounts: CashRegisterAccount[];
  addCashAccount: (account: Omit<CashRegisterAccount, 'id' | 'createdAt'>) => CashRegisterAccount;
  updateCashAccount: (id: string, account: Partial<CashRegisterAccount>) => void;
  deleteCashAccount: (id: string) => void;

  // Fixed Asset Groups & Assets (تجهیزات و دارایی‌های ثابت)
  assetGroups: AssetGroup[];
  addAssetGroup: (group: Omit<AssetGroup, 'id' | 'createdAt'>) => AssetGroup;
  updateAssetGroup: (id: string, group: Partial<AssetGroup>) => void;
  deleteAssetGroup: (id: string) => void;

  fixedAssets: FixedAsset[];
  addFixedAsset: (asset: Omit<FixedAsset, 'id' | 'createdAt'>) => FixedAsset;
  updateFixedAsset: (id: string, asset: Partial<FixedAsset>) => void;
  deleteFixedAsset: (id: string) => void;

  // Shareholders & Partners (امور سهامداران و شرکا)
  shareholders: Shareholder[];
  addShareholder: (sh: Omit<Shareholder, 'id' | 'createdAt' | 'sharePercentage'>) => Shareholder;
  updateShareholder: (id: string, sh: Partial<Shareholder>) => void;
  deleteShareholder: (id: string) => void;

  // Party Groups CRUD
  addPartyGroup: (group: Omit<PartyGroup, 'id' | 'createdAt'>) => PartyGroup;
  updatePartyGroup: (id: string, group: Partial<PartyGroup>) => void;
  deletePartyGroup: (id: string) => void;

  // Users & Access Roles & Security
  users: AppUser[];
  currentUser: AppUser;
  setCurrentUser: (user: AppUser) => void;
  addUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => AppUser;
  updateUser: (id: string, user: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  isAuthenticated: boolean;
  login: (usernameOrId: string, passwordAttempt: string) => { success: boolean; message?: string };
  logout: () => void;

  // Printing & Document Modal
  activePrintDoc: PrintableDocumentPayload | null;
  openPrintModal: (docOrType: any, maybeData?: any) => void;
  closePrintModal: () => void;

  // Document Management & Editing (همه اسناد با قابلیت ویرایش)
  getNextInvoiceNumber: (type: InvoiceType) => string;
  getNextTransactionNumber: (type: TransactionType) => string;
  getNextTransferNumber: () => string;
  getNextExpenseNumber: () => string;
  getNextConsignmentDocNumber: () => string;
  createInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;

  createTransaction: (tx: Omit<FinancialTransaction, 'id' | 'createdAt'>) => FinancialTransaction;
  updateTransaction: (tx: FinancialTransaction) => void;
  deleteTransaction: (id: string) => void;

  createStockTransfer: (transfer: Omit<StockTransfer, 'id' | 'createdAt'>) => StockTransfer;
  updateStockTransfer: (transfer: StockTransfer) => void;
  deleteStockTransfer: (id: string) => void;

  // Consignment Customer Tracking & Movements
  consignmentMovements: ConsignmentMovement[];
  createConsignmentMovement: (movement: Omit<ConsignmentMovement, 'id' | 'createdAt'>) => ConsignmentMovement;
  updateConsignmentMovement: (id: string, movement: Partial<ConsignmentMovement>) => void;
  deleteConsignmentMovement: (id: string) => void;
  getCustomerConsignmentBalances: (warehouseId?: string) => Array<{
    partyId: string;
    partyName: string;
    partyPhone?: string;
    totalInTons: number;
    totalInBags: number;
    totalOutTons: number;
    totalOutBags: number;
    remainingTons: number;
    remainingBags: number;
    products: Array<{
      productId: string;
      productName: string;
      totalInTons: number;
      totalInBags: number;
      totalOutTons: number;
      totalOutBags: number;
      remainingTons: number;
      remainingBags: number;
    }>;
  }>;

  addProduct: (product: Omit<Product, 'id' | 'bagsPerTon'>) => Product;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addWarehouse: (warehouse: Omit<Warehouse, 'id'>) => Warehouse;
  updateWarehouse: (id: string, warehouse: Partial<Warehouse>) => void;
  deleteWarehouse: (id: string) => void;
  addParty: (party: Omit<Party, 'id' | 'createdAt'>) => Party;
  updateParty: (id: string, party: Partial<Party>) => void;
  deleteParty: (id: string) => void;
  updateExchangeRate: (newRate: number) => void;
  updateCashBalances: (afn: number, usd: number, exchangeUsd?: number) => void;

  // Helpers
  getProductStock: (productId: string, warehouseId?: string) => { tons: number; bags: number };
  getWarehouseStockDetails: (warehouseId: string) => { product: Product; tons: number; bags: number }[];
  getPartySummary: (partyId: string) => {
    party: Party | undefined;
    invoices: Invoice[];
    transactions: FinancialTransaction[];
  };
  calculateTotalStockValue: () => { afnValue: number; usdValue: number; totalTons: number; totalBags: number };
  getLowStockAlerts: () => LowStockAlertItem[];
  
  // Audit Logs (ممیزی و ردیابی رویدادها)
  auditLogs: AuditLogEntry[];
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  clearAuditLogs: () => void;

  // Real-time user action notifications / toasts (پیام برای هر عملیه)
  notifications: ToastNotification[];
  notify: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  removeNotification: (id: string) => void;

  // Data Reset & Backup
  resetToDemoData: () => void;
  resetNewFinancialYear: () => void;
  resetWipeCleanAll: () => void;
  exportJSON: () => string;
  importJSON: (jsonString: string) => boolean;
}

const LOCAL_STORAGE_KEY = 'AFGHAN_ACCOUNTING_DATA_V2';

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[Storage Warning] Failed to persist key "${key}":`, err);
    // If quota exceeded and this is audit logs, clear them to free space
    if (key.includes('_audit_logs')) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  }
};

const sanitizeAuditPayload = (obj: any): string => {
  if (!obj) return '';
  try {
    const raw = typeof obj === 'string' ? JSON.parse(obj) : obj;
    const clone = JSON.parse(JSON.stringify(raw));
    const truncateDeep = (target: any) => {
      if (!target || typeof target !== 'object') return;
      for (const k of Object.keys(target)) {
        if (typeof target[k] === 'string' && (target[k].startsWith('data:image') || target[k].length > 150)) {
          target[k] = `[داده تصویر/فایل باینری - ${target[k].substring(0, 24)}...]`;
        } else if (typeof target[k] === 'object') {
          truncateDeep(target[k]);
        }
      }
    };
    truncateDeep(clone);
    return JSON.stringify(clone, null, 2);
  } catch {
    return String(obj).substring(0, 150);
  }
};

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export const AccountingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appFontSize, setAppFontSizeState] = useState<AppFontSize>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_fontsize') as AppFontSize | null;
    return saved && ['sm', 'md', 'lg', 'xl'].includes(saved) ? saved : 'md';
  });

  const setAppFontSize = (size: AppFontSize) => {
    setAppFontSizeState(size);
    safeSetItem(LOCAL_STORAGE_KEY + '_fontsize', size);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-scale-sm', 'font-scale-md', 'font-scale-lg', 'font-scale-xl');
    root.classList.add(`font-scale-${appFontSize}`);
  }, [appFontSize]);

  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_company');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return normalizeCompanyBranding(parsed, initialCompanySettings);
      } catch (e) {
        return initialCompanySettings;
      }
    }
    return initialCompanySettings;
  });

  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_users');
    if (saved) {
      try {
        const parsed: AppUser[] = JSON.parse(saved);
        return parsed.map(u => {
          const updated = { ...u };
          if (updated.id === 'usr-1') {
            updated.name = 'علی احمد نبوی';
            updated.phone = '0794006460';
          }
          if (!updated.password) {
            updated.password = '123';
          }
          return updated;
        });
      } catch (e) {
        return initialUsers;
      }
    }
    return initialUsers;
  });

  const [currentUser, setCurrentUser] = useState<AppUser>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_current_user');
    if (saved) {
      try {
        const parsed: AppUser = JSON.parse(saved);
        if (parsed.id === 'usr-1') {
          return { ...parsed, name: 'علی احمد نبوی', phone: '0794006460', password: parsed.password || '123' };
        }
        return { ...parsed, password: parsed.password || '123' };
      } catch (e) {
        return initialUsers[0];
      }
    }
    return initialUsers[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Purge any legacy localStorage authentication flags so credentials are required when reopening
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY + '_is_authenticated');
    } catch {}

    // Require username and password whenever the application is closed and reopened.
    // In web browsers, sessionStorage is automatically deleted upon closing the tab/window.
    const savedSession = sessionStorage.getItem(LOCAL_STORAGE_KEY + '_auth_session');
    return savedSession === 'true';
  });

  const [activePrintDoc, setActivePrintDoc] = useState<PrintableDocumentPayload | null>(null);

  const [productCategories, setProductCategories] = useState<ProductCategory[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_product_categories');
    return saved ? JSON.parse(saved) : initialProductCategories;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_products');
    return saved ? JSON.parse(saved) : initialProducts;
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_warehouses');
    return saved ? JSON.parse(saved) : initialWarehouses;
  });

  const [stocks, setStocks] = useState<StockInventory[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_stocks');
    return saved ? JSON.parse(saved) : initialStocks;
  });

  const [parties, setParties] = useState<Party[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_parties');
    return saved ? JSON.parse(saved) : initialParties;
  });

  const [partyGroups, setPartyGroups] = useState<PartyGroup[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_party_groups');
    return saved ? JSON.parse(saved) : initialPartyGroups;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_invoices');
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [transfers, setTransfers] = useState<StockTransfer[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_transfers');
    return saved ? JSON.parse(saved) : initialTransfers;
  });

  const [currencies, setCurrencies] = useState<CurrencyDefinition[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_currencies');
    if (saved) {
      try {
        const parsed: CurrencyDefinition[] = JSON.parse(saved);
        if (!parsed.some(c => c.isBase)) {
          return parsed.map(c => (c.code === 'AFN' ? { ...c, isBase: true } : c));
        }
        return parsed;
      } catch (e) {
        return initialCurrencies;
      }
    }
    return initialCurrencies;
  });

  const [cashAccounts, setCashAccounts] = useState<CashRegisterAccount[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_cash_accounts');
    return saved ? JSON.parse(saved) : initialCashAccounts;
  });

  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_asset_groups');
    return saved ? JSON.parse(saved) : initialAssetGroups;
  });

  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_fixed_assets');
    return saved ? JSON.parse(saved) : initialFixedAssets;
  });

  const [shareholders, setShareholders] = useState<Shareholder[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_shareholders');
    return saved ? JSON.parse(saved) : initialShareholders;
  });

  const [cashRegister, setCashRegister] = useState<CashRegisterState>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_cash');
    return saved ? JSON.parse(saved) : initialCashRegister;
  });

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_expense_categories');
    return saved ? JSON.parse(saved) : initialExpenseCategories;
  });

  const [expenseDefinitions, setExpenseDefinitions] = useState<ExpenseDefinition[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_expense_definitions');
    return saved ? JSON.parse(saved) : initialExpenseDefinitions;
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_expenses');
    return saved ? JSON.parse(saved) : initialExpenses;
  });

  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_income_categories');
    return saved ? JSON.parse(saved) : initialIncomeCategories;
  });

  const [incomes, setIncomes] = useState<IncomeItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_incomes');
    return saved ? JSON.parse(saved) : initialIncomes;
  });

  const [consignmentMovements, setConsignmentMovements] = useState<ConsignmentMovement[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_consignment_movements');
    return saved ? JSON.parse(saved) : initialConsignmentMovements;
  });

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_consignment_movements', JSON.stringify(consignmentMovements));
  }, [consignmentMovements]);

  const [fontSizeNumber, setFontSizeNumberState] = useState<number>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_fontsizenumber');
    return saved ? Number(saved) : 13;
  });

  const setFontSizeNumber = (num: number) => {
    setFontSizeNumberState(num);
    safeSetItem(LOCAL_STORAGE_KEY + '_fontsizenumber', String(num));
    document.documentElement.style.setProperty('--app-base-font-size', `${num}px`);
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--app-base-font-size', `${fontSizeNumber}px`);
  }, [fontSizeNumber]);

  // Sync state changes with localStorage
  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_expense_categories', JSON.stringify(expenseCategories));
  }, [expenseCategories]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_expense_definitions', JSON.stringify(expenseDefinitions));
  }, [expenseDefinitions]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_income_categories', JSON.stringify(incomeCategories));
  }, [incomeCategories]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_incomes', JSON.stringify(incomes));
  }, [incomes]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_product_categories', JSON.stringify(productCategories));
  }, [productCategories]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_warehouses', JSON.stringify(warehouses));
  }, [warehouses]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_stocks', JSON.stringify(stocks));
  }, [stocks]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_parties', JSON.stringify(parties));
    const timer = setTimeout(() => {
      syncPartiesToBackend(parties).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [parties]);

  // Auto-sync Telegram configuration between localStorage and backend on startup
  useEffect(() => {
    try {
      const localTeleRaw = localStorage.getItem('accounting_telegram_settings_v1');
      if (localTeleRaw) {
        const parsed = JSON.parse(localTeleRaw);
        if (parsed?.botToken && parsed.botToken.includes(':')) {
          fetch('/api/telegram/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botToken: parsed.botToken,
              defaultChatId: parsed.defaultChatId || '',
              botUsername: parsed.botUsername || '',
              botFirstName: parsed.botFirstName || '',
              autoPolling: true,
            }),
          }).catch(() => {});
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_party_groups', JSON.stringify(partyGroups));
  }, [partyGroups]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_transfers', JSON.stringify(transfers));
  }, [transfers]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_currencies', JSON.stringify(currencies));
  }, [currencies]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_cash_accounts', JSON.stringify(cashAccounts));
  }, [cashAccounts]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_asset_groups', JSON.stringify(assetGroups));
  }, [assetGroups]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_fixed_assets', JSON.stringify(fixedAssets));
  }, [fixedAssets]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_shareholders', JSON.stringify(shareholders));
  }, [shareholders]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_company', JSON.stringify(companySettings));
    if (typeof document !== 'undefined') {
      document.title = companySettings.name || 'شرکت تجارتی برادران نبوی';
    }
  }, [companySettings]);

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_cash', JSON.stringify(cashRegister));
  }, [cashRegister]);

  // Audit Logs State (دفتر ثبت رویدادها و ممیزی سیستم)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_audit_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse audit logs', e);
      }
    }
    return initialAuditLogs;
  });

  useEffect(() => {
    safeSetItem(LOCAL_STORAGE_KEY + '_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    try {
      const newEntry: AuditLogEntry = {
        ...entry,
        id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        timestamp: `${getPersianDate()} - ${getCurrentTime()}`,
        user: entry.user || currentUser?.name || 'مدیر سیستم',
        userRole: entry.userRole || currentUser?.role || 'admin',
        previousValue: entry.previousValue ? sanitizeAuditPayload(entry.previousValue) : undefined,
        newValue: entry.newValue ? sanitizeAuditPayload(entry.newValue) : undefined,
      };
      setAuditLogs(prev => [newEntry, ...prev.slice(0, 199)]);
    } catch (err) {
      console.warn('Failed to add audit log:', err);
    }
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY + '_audit_logs');
    } catch {}
  };

  // Real-time Notifications / Toast Messages (پیغام لحظه‌ای برای هر عملیه)
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const notify = (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const newNotif: ToastNotification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Helper to determine if a deal type is a consignment transaction
  const isConsignmentDealType = (dealType?: string, dealTypeLabel?: string): boolean => {
    const dt = [dealType, dealTypeLabel].filter(Boolean).join(' ').toLowerCase();
    return dt.includes('امانی') || dt.includes('consignment');
  };

  // Helper to find the appropriate consignment warehouse
  const getConsignmentWarehouse = (preferredId?: string, excludeWhId?: string): Warehouse => {
    if (preferredId) {
      const wh = warehouses.find(w => w.id === preferredId);
      if (wh) return wh;
    }
    const found =
      warehouses.find(
        w =>
          (w.type === 'consignment_in' ||
            w.type === 'consignment' ||
            w.id === 'wh-2' ||
            (w.code && w.code.toLowerCase().includes('consignment')) ||
            w.name.includes('امانی')) &&
          w.id !== excludeWhId
      ) ||
      warehouses.find(w => w.id === 'wh-2') ||
      warehouses.find(w => w.type !== 'standard' && w.id !== excludeWhId) ||
      warehouses[0];
    return found;
  };

  const invoiceConsignmentWarehouse = (invoice: Invoice) => {
    const originIsConsigned = warehouses.some(warehouse => warehouse.id === invoice.warehouseId && warehouse.type !== 'standard');
    return getConsignmentWarehouse(invoice.consignmentWarehouseId || (originIsConsigned ? invoice.warehouseId : undefined), invoice.warehouseId);
  };
  const invoiceHasConsignment = (invoice: Invoice): boolean => isConsignmentDealType(invoice.dealType, invoice.dealTypeLabel) || warehouses.some(warehouse => warehouse.type !== 'standard' && (warehouse.id === invoice.warehouseId || warehouse.id === invoice.consignmentWarehouseId));
  const invoiceSourceWarehouse = (invoice: Invoice, item: InvoiceItem, consignment: boolean): string => {
    if (!consignment) return item.warehouseId || invoice.warehouseId;
    const standard = (id?: string) => warehouses.some(warehouse => warehouse.id === id && warehouse.type === 'standard');
    return standard(item.warehouseId) ? item.warehouseId! : standard(invoice.warehouseId) ? invoice.warehouseId : warehouses.find(warehouse => warehouse.type === 'standard')?.id || item.warehouseId || invoice.warehouseId;
  };
  const consignmentInvoiceGuard = (old: Invoice, next?: Invoice): string | null => {
    const consumed = consignmentLots(consignmentMovements, invoices).filter(lot => lot.invoiceId === old.id && (lot.totalOutTons > .000001 || lot.totalOutBags > .000001));
    if (!consumed.length) return null;
    if (!next) return 'از این فاکتور حوالهٔ خروج صادر شده است؛ ابتدا حواله‌های مرتبط را برگشت دهید.';
    const oldWarehouse = invoiceConsignmentWarehouse(old)?.id;
    const nextWarehouse = invoiceConsignmentWarehouse(next)?.id;
    if (next.partyId !== old.partyId || next.type !== old.type || !invoiceHasConsignment(next) || oldWarehouse !== nextWarehouse) return 'پس از تحویل بار، تغییر مشتری یا گدام فاکتور نیازمند برگشت حواله‌های مرتبط است.';
    for (const lot of consumed) {
      const items = next.items.filter(item => item.productId === lot.productId);
      if (items.reduce((sum, item) => sum + item.tonsCount, 0) + .000001 < lot.totalOutTons || items.reduce((sum, item) => sum + item.bagsCount, 0) + .000001 < lot.totalOutBags) return 'مقدار فاکتور نمی‌تواند از بار تحویل‌شدهٔ آن کمتر شود.';
    }
    return null;
  };

  // Auto-reconcile consignment transfers & stock for any existing consignment invoices
  useEffect(() => {
    if (!invoices || invoices.length === 0) return;

    const consignmentInvoices = invoices.filter(
      inv => (inv.type === 'sell' || inv.type === 'return_sell') && isConsignmentDealType(inv.dealType, inv.dealTypeLabel)
    );
    if (consignmentInvoices.length === 0) return;

    let missingTransfers: StockTransfer[] = [];
    let stocksToAdjust: { warehouseId: string; productId: string; deltaTons: number; deltaBags: number }[] = [];

    consignmentInvoices.forEach(inv => {
      const targetWh = invoiceConsignmentWarehouse(inv);
      const targetWhId = targetWh?.id || 'wh-2';
      const targetWhName = targetWh?.name || 'گدام امانی';
      const sourceWh = warehouses.find(w => w.id === inv.warehouseId);

      const hasTransfer = transfers.some(t => t.id.startsWith(`trf-inv-${inv.id}`));
      if (!hasTransfer) {
        inv.items.forEach((item, idx) => {
          if (item.warehouseId !== targetWhId) {
            const isSale = inv.type === 'sell';
            const fromWhId = isSale ? item.warehouseId : targetWhId;
            const fromWhName = isSale ? (item.warehouseName || sourceWh?.name || 'گدام مبدا') : targetWhName;
            const toWhId = isSale ? targetWhId : item.warehouseId;
            const toWhName = isSale ? targetWhName : (item.warehouseName || sourceWh?.name || 'گدام مبدا');
            const actionText = isSale ? 'ارسال امانی' : 'برگشت کالای امانی';

            missingTransfers.push({
              id: `trf-inv-${inv.id}-${item.productId || idx}`,
              transferNumber: `TRF-${inv.invoiceNumber}-${idx + 1}`,
              date: inv.date,
              issueTime: inv.issueTime || '10:00',
              productId: item.productId,
              productName: item.productName,
              fromWarehouseId: fromWhId,
              fromWarehouseName: fromWhName,
              toWarehouseId: toWhId,
              toWarehouseName: toWhName,
              quantity: item.quantity,
              unit: item.unit,
              tonsCount: item.tonsCount,
              bagsCount: item.bagsCount,
              driverName: inv.driverName || (isSale ? 'ارسال به گدام امانی' : 'برگشت از گدام امانی'),
              carPlate: inv.carPlate || '',
              description: `${actionText} بابت فاکتور ${isSale ? 'فروش' : 'مرجوعی'} #${inv.invoiceNumber} به طرف‌حساب ${inv.partyName}`,
              notes: `همگام‌سازی خودکار انتقال گدام امانی از فاکتور #${inv.invoiceNumber}`,
              createdAt: inv.createdAt || new Date().toISOString(),
            });

            // Adjust stock in target consignment warehouse
            const deltaTons = isSale ? item.tonsCount : -item.tonsCount;
            const deltaBags = isSale ? item.bagsCount : -item.bagsCount;
            stocksToAdjust.push({
              warehouseId: targetWhId,
              productId: item.productId,
              deltaTons,
              deltaBags,
            });
          }
        });
      }
    });

    if (missingTransfers.length > 0) {
      setTransfers(prev => [...missingTransfers, ...prev]);
      setStocks(prev => {
        let updated = [...prev];
        stocksToAdjust.forEach(adj => {
          const idx = updated.findIndex(s => s.warehouseId === adj.warehouseId && s.productId === adj.productId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              quantityTons: updated[idx].quantityTons + adj.deltaTons,
              quantityBags: updated[idx].quantityBags + adj.deltaBags,
            };
          } else {
            updated.push({
              warehouseId: adj.warehouseId,
              productId: adj.productId,
              quantityTons: adj.deltaTons,
              quantityBags: adj.deltaBags,
            });
          }
        });
        return updated;
      });
    }
  }, [invoices]);

  // Company Settings Handlers
  const updateCompanySettings = (newSettings: Partial<CompanySettings>) => {
    try {
      const prev = companySettings;
      const updated = { ...prev, ...newSettings, name: newSettings.name?.trim() || prev.name };
      setCompanySettings(updated);

      setTimeout(() => {
        try {
          addAuditLog({
            action: 'settings_change',
            actionLabel: 'تغییر مشخصات شرکت',
            category: 'system',
            entityTitle: 'تنظیمات عمومی شرکت',
            details: `تغییر مشخصات یا تنظیمات شرکت به "${updated.name}"`,
            previousValue: sanitizeAuditPayload(prev),
            newValue: sanitizeAuditPayload(updated),
          });
        } catch (auditErr) {
          console.warn('Failed to record audit log for company settings:', auditErr);
        }
      }, 0);

      notify('success', 'تنظیمات شرکت با موفقیت به‌روزرسانی شد');
    } catch (err) {
      console.error('Failed to update company settings:', err);
      notify('error', 'خطا در اعمال تغییرات تنظیمات شرکت');
    }
  };

  const resetCompanySettings = () => {
    setCompanySettings(initialCompanySettings);
    notify('info', 'تنظیمات شرکت به حالت اولیه بازنشانی شد');
  };

  // Product Categories CRUD
  const addProductCategory = (catData: Omit<ProductCategory, 'id' | 'createdAt'>): ProductCategory => {
    const newCat: ProductCategory = {
      ...catData,
      id: 'cat-' + Date.now(),
      createdAt: getTodayDate(companySettings.calendarType),
    };
    setProductCategories(prev => [...prev, newCat]);
    return newCat;
  };

  const updateProductCategory = (id: string, catData: Partial<ProductCategory>) => {
    setProductCategories(prev => prev.map(c => (c.id === id ? { ...c, ...catData } : c)));
    if (catData.name) {
      setProducts(prev =>
        prev.map(p => (p.categoryId === id ? { ...p, category: catData.name! } : p))
      );
    }
  };

  const deleteProductCategory = (id: string) => {
    setProductCategories(prev => prev.filter(c => c.id !== id));
  };

  // ================= AUTOMATIC SEQUENTIAL DOCUMENT NUMBER GENERATORS =================
  const issuedInvoiceNumbersRef = useRef<Record<string, number>>({});
  const issuedTransactionNumbersRef = useRef<Record<string, number>>({});
  const expensesRef = useRef(expenses); expensesRef.current = expenses;
  const incomesRef = useRef(incomes); incomesRef.current = incomes;
  const issuedPartyCodeRef = useRef<number>(0);
  const issuedTransferNumbersRef = useRef<number>(0);

  // 1. Invoices (Sales: INV-001 | Purchases: PUR-001 | Return Sales: SRT-001 | Return Purchases: PRT-001)
  const getNextInvoiceNumber = (type: InvoiceType): string => {
    try {
      let prefix = 'INV';
      if (type === 'buy') prefix = 'PUR';
      else if (type === 'return_sell') prefix = 'SRT';
      else if (type === 'return_buy') prefix = 'PRT';
      const relevant = (invoices || []).filter(i => i && i.type === type);
      let maxSequence = 0;

      relevant.forEach(inv => {
        if (!inv || !inv.invoiceNumber) return;
        const invNumStr = String(inv.invoiceNumber);
        const match = invNumStr.match(/(?:Inv|Pur|Srt|Prt|INV|PUR|SRT|PRT)?[-_]?(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxSequence) {
            maxSequence = val;
          }
        } else {
          const allDigits = invNumStr.replace(/\D/g, '');
          if (allDigits) {
            const val = parseInt(allDigits.slice(-4), 10);
            if (!isNaN(val) && val > maxSequence) {
              maxSequence = val;
            }
          }
        }
      });

      const nextVal = Math.max(maxSequence, issuedInvoiceNumbersRef.current[type] || 0) + 1;
      issuedInvoiceNumbersRef.current[type] = nextVal;
      return `${prefix}-${String(nextVal).padStart(3, '0')}`;
    } catch (err) {
      console.error('Error generating next invoice number:', err);
      const prefix = type === 'buy' ? 'PUR' : type === 'return_sell' ? 'SRT' : type === 'return_buy' ? 'PRT' : 'INV';
      return `${prefix}-001`;
    }
  };

  // 2. Financial Transactions (Receive: REC-001 | Pay: PAY-001 | Exchange: EXC-001 | General: TRX-001)
  const getNextTransactionNumber = (type: TransactionType): string => {
    try {
      let prefix = 'TRX';
      if (type === 'receive_payment') prefix = 'REC';
      else if (type === 'make_payment') prefix = 'PAY';
      else if (type === 'currency_exchange') prefix = 'EXC';

      const relevant = (transactions || []).filter(t => t && t.type === type);
      let maxSequence = 0;

      relevant.forEach(tx => {
        if (!tx || !tx.transactionNumber) return;
        const txNumStr = String(tx.transactionNumber);
        const match = txNumStr.match(/(?:Rec|Pay|Exc|Trx|REC|PAY|EXC|TRX)?[-_]?(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxSequence) {
            maxSequence = val;
          }
        } else {
          const allDigits = txNumStr.replace(/\D/g, '');
          if (allDigits) {
            const val = parseInt(allDigits.slice(-4), 10);
            if (!isNaN(val) && val > maxSequence) {
              maxSequence = val;
            }
          }
        }
      });

      const nextVal = Math.max(maxSequence, issuedTransactionNumbersRef.current[type] || 0) + 1;
      issuedTransactionNumbersRef.current[type] = nextVal;
      return `${prefix}-${String(nextVal).padStart(3, '0')}`;
    } catch (err) {
      console.error('Error generating transaction number:', err);
      return 'TRX-001';
    }
  };

  // 3. Products Code Generator (PRD-001, PRD-002...)
  const getNextProductCode = (): string => {
    try {
      const prefix = 'PRD';
      let maxSequence = 0;

      (products || []).forEach(p => {
        if (!p || !p.code) return;
        const codeStr = String(p.code);
        const match = codeStr.match(/(?:PRD|prod|Prod)?[-_]?(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxSequence) {
            maxSequence = val;
          }
        } else {
          const allDigits = codeStr.replace(/\D/g, '');
          if (allDigits) {
            const val = parseInt(allDigits.slice(-4), 10);
            if (!isNaN(val) && val > maxSequence) {
              maxSequence = val;
            }
          }
        }
      });

      const nextVal = maxSequence + 1;
      return `${prefix}-${String(nextVal).padStart(3, '0')}`;
    } catch (err) {
      console.error('Error generating product code:', err);
      return 'PRD-001';
    }
  };

  // 3.1 Party Code Generator (101, 102, 103...)
  const getNextPartyCode = (): string => {
    try {
      let maxVal = 0;
      (parties || []).forEach(p => {
        if (!p || !p.code) return;
        const numStr = String(p.code).replace(/\D/g, '');
        if (numStr) {
          const val = parseInt(numStr, 10);
          if (!isNaN(val) && val > maxVal) {
            maxVal = val;
          }
        }
      });
      const nextVal = Math.max(maxVal, issuedPartyCodeRef.current, 100) + 1;
      issuedPartyCodeRef.current = nextVal;
      return String(nextVal);
    } catch (err) {
      console.error('Error generating party code:', err);
      return '101';
    }
  };

  // 4. Stock Transfers (Warehouse transfer: TRF-001, TRF-002...)
  const getNextTransferNumber = (): string => {
    try {
      const prefix = 'TRF';
      let maxSequence = 0;

      (transfers || []).forEach(tr => {
        if (!tr || !tr.transferNumber) return;
        const trNumStr = String(tr.transferNumber);
        const match = trNumStr.match(/(?:Trf|TRF)?[-_]?(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxSequence) {
            maxSequence = val;
          }
        } else {
          const allDigits = trNumStr.replace(/\D/g, '');
          if (allDigits) {
            const val = parseInt(allDigits.slice(-4), 10);
            if (!isNaN(val) && val > maxSequence) {
              maxSequence = val;
            }
          }
        }
      });

      const nextVal = Math.max(maxSequence, issuedTransferNumbersRef.current || 0) + 1;
      issuedTransferNumbersRef.current = nextVal;
      return `${prefix}-${String(nextVal).padStart(3, '0')}`;
    } catch (err) {
      console.error('Error generating transfer number:', err);
      return 'TRF-001';
    }
  };

  // 5. Expenses (Expense voucher: EXP-001, EXP-002...)
  const getNextExpenseNumber = (): string => nextCompanyCashNumber(expensesRef.current, 'expense');

  // 6. Consignment Delivery Slips (CSG-001, CSG-002...)
  const getNextConsignmentDocNumber = (): string => {
    try {
      const prefix = 'CSG';
      let maxSequence = 0;

      (consignmentMovements || []).forEach(m => {
        if (!m || !m.documentNumber) return;
        const numStr = String(m.documentNumber);
        const match = numStr.match(/(?:Csg|CSG)?[-_]?(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxSequence) {
            maxSequence = val;
          }
        } else {
          const allDigits = numStr.replace(/\D/g, '');
          if (allDigits) {
            const val = parseInt(allDigits.slice(-4), 10);
            if (!isNaN(val) && val > maxSequence) {
              maxSequence = val;
            }
          }
        }
      });

      const nextVal = maxSequence + 1;
      return `${prefix}-${String(nextVal).padStart(3, '0')}`;
    } catch (err) {
      console.error('Error generating consignment doc number:', err);
      return 'CSG-001';
    }
  };

  // Create Invoice (Buy / Sell)
  const createInvoice = (invoiceData: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    const party = parties.find(p => p.id === invoiceData.partyId);
    const resolvedInvoiceNumber = (invoiceData.invoiceNumber || '').trim() || getNextInvoiceNumber(invoiceData.type);
    
    // Check if an invoice with this invoiceNumber and type already exists (prevent duplicate creation on repeated submit clicks)
    const existingSameInvoice = invoices.find(
      i => i.invoiceNumber.trim() === resolvedInvoiceNumber && i.type === invoiceData.type
    );

    if (existingSameInvoice) {
      const updatedInv: Invoice = {
        ...invoiceData,
        id: existingSameInvoice.id,
        invoiceNumber: resolvedInvoiceNumber,
        issueTime: invoiceData.issueTime || existingSameInvoice.issueTime || getCurrentTime(),
        partyPhone: invoiceData.partyPhone || party?.phone || '',
        partyAddress: invoiceData.partyAddress || party?.address || '',
        partyGroupName: invoiceData.partyGroupName || party?.groupName || '',
        createdAt: existingSameInvoice.createdAt,
      };
      updateInvoice(updatedInv);
      return updatedInv;
    }

    const newId = createTradeEntityId('inv');
    const newInvoice: Invoice = {
      ...invoiceData,
      id: newId,
      invoiceNumber: resolvedInvoiceNumber,
      issueTime: invoiceData.issueTime || getCurrentTime(),
      partyPhone: invoiceData.partyPhone || party?.phone || '',
      partyAddress: invoiceData.partyAddress || party?.address || '',
      partyGroupName: invoiceData.partyGroupName || party?.groupName || '',
      createdAt: new Date().toISOString(),
    };

    // 1. Update Invoices list
    setInvoices(prev => [newInvoice, ...prev]);

    // 2. Update stock quantities & handle consignment warehouse movement
    const isWhConsignment = (whId?: string) => {
      if (!whId) return false;
      const w = warehouses.find(wh => wh.id === whId);
      return w ? (w.type !== 'standard' || w.id === 'wh-2' || (w.code && w.code.toLowerCase().includes('consignment')) || w.name.includes('امانی')) : false;
    };

    const hasExplicitConsignment = isConsignmentDealType(newInvoice.dealType, newInvoice.dealTypeLabel);
    const hasConsignmentWh = isWhConsignment(newInvoice.warehouseId) || isWhConsignment(newInvoice.consignmentWarehouseId);
    const isConsignment = hasExplicitConsignment || hasConsignmentWh;

    const targetConsignmentWh = isConsignment
      ? getConsignmentWarehouse(
          isWhConsignment(newInvoice.consignmentWarehouseId) ? newInvoice.consignmentWarehouseId : (isWhConsignment(newInvoice.warehouseId) ? newInvoice.warehouseId : undefined)
        )
      : null;
    const targetConsignmentWhId = targetConsignmentWh?.id || 'wh-2';

    // Standard central warehouse from which goods are physically drawn if selling on consignment
    const standardCompanyWh = warehouses.find(w => w.type === 'standard' && w.id !== targetConsignmentWhId) || warehouses[0];
    const defaultSourceWhId = standardCompanyWh?.id || 'wh-1';

    setStocks(prevStocks => {
      let updated = [...prevStocks];
      newInvoice.items.forEach(item => {
        const isStockIn = newInvoice.type === 'buy' || newInvoice.type === 'return_sell';

        if (isConsignment) {
          // In a sales consignment deal: goods are drawn from company standard warehouse and DEPOSITED into consignment warehouse
          const sourceWhId = (item.warehouseId && !isWhConsignment(item.warehouseId))
            ? item.warehouseId
            : (newInvoice.warehouseId && !isWhConsignment(newInvoice.warehouseId))
            ? newInvoice.warehouseId
            : defaultSourceWhId;

          // 1) Deduct/Add from source warehouse
          const sourceDeltaTons = isStockIn ? item.tonsCount : -item.tonsCount;
          const sourceDeltaBags = isStockIn ? item.bagsCount : -item.bagsCount;
          const sourceIdx = updated.findIndex(s => s.warehouseId === sourceWhId && s.productId === item.productId);
          if (sourceIdx >= 0) {
            updated[sourceIdx] = {
              ...updated[sourceIdx],
              quantityTons: addInvoiceLedgerAmount(updated[sourceIdx].quantityTons, sourceDeltaTons),
              quantityBags: addInvoiceLedgerAmount(updated[sourceIdx].quantityBags, sourceDeltaBags),
            };
          } else {
            updated.push({
              warehouseId: sourceWhId,
              productId: item.productId,
              quantityTons: sourceDeltaTons,
              quantityBags: sourceDeltaBags,
            });
          }

          // 2) Add/Deduct to target consignment warehouse
          const cDeltaTons = isStockIn ? -item.tonsCount : item.tonsCount;
          const cDeltaBags = isStockIn ? -item.bagsCount : item.bagsCount;
          const cIdx = updated.findIndex(s => s.warehouseId === targetConsignmentWhId && s.productId === item.productId);
          if (cIdx >= 0) {
            updated[cIdx] = {
              ...updated[cIdx],
              quantityTons: addInvoiceLedgerAmount(updated[cIdx].quantityTons, cDeltaTons),
              quantityBags: addInvoiceLedgerAmount(updated[cIdx].quantityBags, cDeltaBags),
            };
          } else {
            updated.push({
              warehouseId: targetConsignmentWhId,
              productId: item.productId,
              quantityTons: cDeltaTons,
              quantityBags: cDeltaBags,
            });
          }
        } else {
          // Standard ordinary invoice
          const deltaTons = isStockIn ? item.tonsCount : -item.tonsCount;
          const deltaBags = isStockIn ? item.bagsCount : -item.bagsCount;
          const targetWh = item.warehouseId || newInvoice.warehouseId || defaultSourceWhId;
          const existingIdx = updated.findIndex(s => s.warehouseId === targetWh && s.productId === item.productId);

          if (existingIdx >= 0) {
            const current = updated[existingIdx];
            updated[existingIdx] = {
              ...current,
              quantityTons: addInvoiceLedgerAmount(current.quantityTons, deltaTons),
              quantityBags: addInvoiceLedgerAmount(current.quantityBags, deltaBags),
            };
          } else {
            updated.push({
              warehouseId: targetWh,
              productId: item.productId,
              quantityTons: deltaTons,
              quantityBags: deltaBags,
            });
          }
        }
      });
      return updated;
    });

    // Auto-create StockTransfer and ConsignmentMovement records for consignment transactions
    if (isConsignment && targetConsignmentWhId) {
      const sourceWhId = (newInvoice.warehouseId && !isWhConsignment(newInvoice.warehouseId))
        ? newInvoice.warehouseId
        : defaultSourceWhId;
      const sourceWh = warehouses.find(w => w.id === sourceWhId);

      const autoTransfers: StockTransfer[] = newInvoice.items.map((item, idx) => {
        const isSale = newInvoice.type === 'sell';
        const fromWhId = isSale ? sourceWhId : targetConsignmentWhId;
        const fromWhName = isSale ? (sourceWh?.name || 'گدام مرکزی ملکی') : (targetConsignmentWh?.name || 'گدام امانی');
        const toWhId = isSale ? targetConsignmentWhId : sourceWhId;
        const toWhName = isSale ? (targetConsignmentWh?.name || 'گدام امانی') : (sourceWh?.name || 'گدام مرکزی ملکی');
        const actionText = isSale ? 'ارسال امانی' : 'برگشت کالای امانی';

        return {
          id: `trf-inv-${newId}-${item.productId || idx}`,
          transferNumber: `TRF-${resolvedInvoiceNumber}-${idx + 1}`,
          date: newInvoice.date,
          issueTime: newInvoice.issueTime || getCurrentTime(),
          productId: item.productId,
          productName: item.productName,
          fromWarehouseId: fromWhId,
          fromWarehouseName: fromWhName,
          toWarehouseId: toWhId,
          toWarehouseName: toWhName,
          quantity: item.quantity,
          unit: item.unit,
          tonsCount: item.tonsCount,
          bagsCount: item.bagsCount,
          driverName: newInvoice.driverName || (isSale ? 'ارسال به گدام امانی' : 'برگشت از گدام امانی'),
          carPlate: newInvoice.carPlate || '',
          description: `${actionText} بابت فاکتور ${isSale ? 'فروش' : 'مرجوعی'} #${resolvedInvoiceNumber} به طرف‌حساب ${newInvoice.partyName}`,
          notes: `ثبت خودکار انتقال به گدام امانی از فاکتور #${resolvedInvoiceNumber}`,
          createdAt: new Date().toISOString(),
        };
      });

      if (autoTransfers.length > 0) {
        setTransfers(prev => [...autoTransfers, ...prev]);
      }

      // Automatically register Consignment Movement per customer inside the consignment warehouse
      const autoConsignments: ConsignmentMovement[] = newInvoice.items.map((item, idx) => {
        const isSale = newInvoice.type === 'sell';
        return {
          id: `csg-inv-${newId}-${item.productId || idx}`,
          invoiceId: newId,
          invoiceItemId: item.id,
          unit: item.unit,
          bagWeightKg: item.bagsCount > 0 ? item.tonsCount * 1000 / item.bagsCount : undefined,
          partyId: newInvoice.partyId,
          partyName: newInvoice.partyName,
          partyPhone: newInvoice.partyPhone || party?.phone,
          warehouseId: targetConsignmentWhId,
          warehouseName: targetConsignmentWh?.name || 'گدام امانی',
          productId: item.productId,
          productName: item.productName,
          date: newInvoice.date,
          issueTime: newInvoice.issueTime || getCurrentTime(),
          type: isSale ? 'deposit' : newInvoice.type === 'return_sell' ? 'return' : 'withdrawal',
          documentType: 'invoice',
          documentNumber: resolvedInvoiceNumber,
          quantityTons: item.tonsCount,
          quantityBags: item.bagsCount,
          driverName: newInvoice.driverName || (isSale ? 'تحویل به گدام امانی' : 'برگشت از گدام امانی'),
          carPlate: newInvoice.carPlate || '',
          notes: `واریز به گدام امانی از فاکتور ${isSale ? 'فروش' : 'مرجوعی'} #${resolvedInvoiceNumber} به نام «${newInvoice.partyName}»`,
          createdAt: new Date().toISOString(),
        };
      });

      if (autoConsignments.length > 0) {
        setConsignmentMovements(prev => [...autoConsignments, ...prev]);
      }
    }

    // 3. Update party balances using the same signs that edit/delete reverse.
    if (newInvoice.partyId) setParties(prev => applyInvoicePartyBalance(prev, newInvoice));

    // 4. Update Cash Register & Cash Accounts and record Financial Transaction
    if (newInvoice.paidAmount > 0) {
      const reg = invoiceCashAccountId(newInvoice);
      const isCashIn = invoiceCashDirection(newInvoice.type) > 0;
      setCashRegister(prev => applyInvoiceCashRegister(prev, newInvoice));
      setCashAccounts(prev => applyInvoiceCashAccounts(prev, newInvoice));

      // Auto-create linked transaction in transactions register
      const txType: TransactionType = isCashIn ? 'receive_payment' : 'make_payment';
      const descPrefix =
        newInvoice.type === 'sell'
          ? `دریافت نقدی بابت فاکتور فروش #${resolvedInvoiceNumber}`
          : newInvoice.type === 'return_sell'
          ? `پرداخت نقدی مرجوعی فروش #${resolvedInvoiceNumber}`
          : newInvoice.type === 'buy'
          ? `پرداخت نقدی بابت فاکتور خرید #${resolvedInvoiceNumber}`
          : `دریافت نقدی استرداد خرید #${resolvedInvoiceNumber}`;

      const autoTx: FinancialTransaction = {
        id: 'tx-inv-' + newId,
        transactionNumber: getNextTransactionNumber(txType),
        date: newInvoice.date,
        issueTime: newInvoice.issueTime || getCurrentTime(),
        type: txType,
        partyId: newInvoice.partyId,
        partyName: newInvoice.partyName,
        partyPhone: newInvoice.partyPhone,
        partyAddress: newInvoice.partyAddress,
        amount: newInvoice.paidAmount,
        currency: newInvoice.currency,
        cashRegister: reg,
        description: descPrefix,
        invoiceId: newId,
        createdAt: new Date().toISOString(),
      };
      setTransactions(prev => [autoTx, ...prev]);
    }

    // Add Audit Log Entry
    const invTypeName = newInvoice.type === 'sell' ? 'فروش' : newInvoice.type === 'buy' ? 'خرید' : 'مرجوعی';
    addAuditLog({
      action: 'create',
      actionLabel: `ثبت فاکتور ${invTypeName}`,
      category: 'invoice',
      entityId: newId,
      entityNumber: resolvedInvoiceNumber,
      entityTitle: `فاکتور #${resolvedInvoiceNumber} (${newInvoice.partyName})`,
      details: `ثبت فاکتور ${invTypeName} به مبلغ کل ${(newInvoice.totalAmount || 0).toLocaleString()} ${newInvoice.currency} (رسید نقدی: ${newInvoice.paidAmount.toLocaleString()} ${newInvoice.currency})`,
      newValue: JSON.stringify(newInvoice, null, 2),
    });

    notify(
      'success',
      `فاکتور ${invTypeName} با موفقیت در سیستم ثبت گردید`,
      `شماره فاکتور: #${resolvedInvoiceNumber} • طرف حساب: ${newInvoice.partyName} • مبلغ: ${(newInvoice.totalAmount || 0).toLocaleString()} ${newInvoice.currency}`
    );

    return newInvoice;
  };

  // Update Invoice (Edit existing invoice)
  function updateInvoice(updatedInvoice: Invoice) {
    const oldInvoice = invoices.find(i => i.id === updatedInvoice.id);
    if (!oldInvoice) return;
    const consignmentError = consignmentInvoiceGuard(oldInvoice, updatedInvoice);
    if (consignmentError) { notify('error', consignmentError); throw new Error(consignmentError); }

    // 1. Revert old stock changes, apply new stock changes
    const oldIsConsignment = invoiceHasConsignment(oldInvoice);
    const oldConsignmentWh = oldIsConsignment
      ? invoiceConsignmentWarehouse(oldInvoice)
      : null;
    const oldConsignmentWhId = oldConsignmentWh?.id || 'wh-2';

    const newIsConsignment = invoiceHasConsignment(updatedInvoice);
    const newConsignmentWh = newIsConsignment
      ? invoiceConsignmentWarehouse(updatedInvoice)
      : null;
    const newConsignmentWhId = newConsignmentWh?.id || 'wh-2';

    setStocks(prevStocks => {
      let updated = [...prevStocks];
      // Revert old
      oldInvoice.items.forEach(item => {
        const sourceId = invoiceSourceWarehouse(oldInvoice, item, oldIsConsignment);
        const idx = updated.findIndex(s => s.warehouseId === sourceId && s.productId === item.productId);
        const deltaTons = -invoiceStockDirection(oldInvoice.type) * item.tonsCount;
        const deltaBags = -invoiceStockDirection(oldInvoice.type) * item.bagsCount;
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            quantityTons: addInvoiceLedgerAmount(updated[idx].quantityTons, deltaTons),
            quantityBags: addInvoiceLedgerAmount(updated[idx].quantityBags, deltaBags),
          };
        }

        if (oldIsConsignment && oldConsignmentWhId && oldConsignmentWhId !== sourceId) {
          const cRevertDeltaTons = invoiceStockDirection(oldInvoice.type) * item.tonsCount;
          const cRevertDeltaBags = invoiceStockDirection(oldInvoice.type) * item.bagsCount;
          const cIdx = updated.findIndex(s => s.warehouseId === oldConsignmentWhId && s.productId === item.productId);
          if (cIdx >= 0) {
            updated[cIdx] = {
              ...updated[cIdx],
              quantityTons: addInvoiceLedgerAmount(updated[cIdx].quantityTons, cRevertDeltaTons),
              quantityBags: addInvoiceLedgerAmount(updated[cIdx].quantityBags, cRevertDeltaBags),
            };
          }
        }
      });

      // Apply new
      updatedInvoice.items.forEach(item => {
        const sourceId = invoiceSourceWarehouse(updatedInvoice, item, newIsConsignment);
        const idx = updated.findIndex(s => s.warehouseId === sourceId && s.productId === item.productId);
        const deltaTons = invoiceStockDirection(updatedInvoice.type) * item.tonsCount;
        const deltaBags = invoiceStockDirection(updatedInvoice.type) * item.bagsCount;
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            quantityTons: addInvoiceLedgerAmount(updated[idx].quantityTons, deltaTons),
            quantityBags: addInvoiceLedgerAmount(updated[idx].quantityBags, deltaBags),
          };
        } else {
          updated.push({
            warehouseId: sourceId,
            productId: item.productId,
            quantityTons: deltaTons,
            quantityBags: deltaBags,
          });
        }

        if (newIsConsignment && newConsignmentWhId && newConsignmentWhId !== sourceId) {
          const cApplyDeltaTons = -invoiceStockDirection(updatedInvoice.type) * item.tonsCount;
          const cApplyDeltaBags = -invoiceStockDirection(updatedInvoice.type) * item.bagsCount;
          const cIdx = updated.findIndex(s => s.warehouseId === newConsignmentWhId && s.productId === item.productId);
          if (cIdx >= 0) {
            updated[cIdx] = {
              ...updated[cIdx],
              quantityTons: addInvoiceLedgerAmount(updated[cIdx].quantityTons, cApplyDeltaTons),
              quantityBags: addInvoiceLedgerAmount(updated[cIdx].quantityBags, cApplyDeltaBags),
            };
          } else {
            updated.push({
              warehouseId: newConsignmentWhId,
              productId: item.productId,
              quantityTons: cApplyDeltaTons,
              quantityBags: cApplyDeltaBags,
            });
          }
        }
      });
      return updated;
    });

    // Update transfers for consignment
    setTransfers(prev => {
      const filtered = prev.filter(t => !t.id.startsWith(`trf-inv-${updatedInvoice.id}`));
      if (!newIsConsignment || !newConsignmentWhId) return filtered;

      const sourceWh = warehouses.find(w => w.id === updatedInvoice.warehouseId);
      const autoTransfers: StockTransfer[] = updatedInvoice.items
        .filter(item => invoiceSourceWarehouse(updatedInvoice, item, newIsConsignment) !== newConsignmentWhId)
        .map((item, idx) => {
          const isSale = updatedInvoice.type === 'sell';
          const sourceId = invoiceSourceWarehouse(updatedInvoice, item, newIsConsignment);
          const fromWhId = isSale ? sourceId : newConsignmentWhId;
          const fromWhName = isSale ? (item.warehouseName || sourceWh?.name || 'گدام مبدا') : (newConsignmentWh?.name || 'گدام امانی');
          const toWhId = isSale ? newConsignmentWhId : sourceId;
          const toWhName = isSale ? (newConsignmentWh?.name || 'گدام امانی') : (item.warehouseName || sourceWh?.name || 'گدام مبدا');
          const actionText = isSale ? 'ارسال امانی' : 'برگشت کالای امانی';

          return {
            id: `trf-inv-${updatedInvoice.id}-${item.productId || idx}`,
            transferNumber: `TRF-${updatedInvoice.invoiceNumber}-${idx + 1}`,
            date: updatedInvoice.date,
            issueTime: updatedInvoice.issueTime || getCurrentTime(),
            productId: item.productId,
            productName: item.productName,
            fromWarehouseId: fromWhId,
            fromWarehouseName: fromWhName,
            toWarehouseId: toWhId,
            toWarehouseName: toWhName,
            quantity: item.quantity,
            unit: item.unit,
            tonsCount: item.tonsCount,
            bagsCount: item.bagsCount,
            driverName: updatedInvoice.driverName || (isSale ? 'ارسال به گدام امانی' : 'برگشت از گدام امانی'),
            carPlate: updatedInvoice.carPlate || '',
            description: `${actionText} بابت فاکتور ${isSale ? 'فروش' : 'مرجوعی'} #${updatedInvoice.invoiceNumber} به طرف‌حساب ${updatedInvoice.partyName}`,
            notes: `ثبت خودکار انتقال به گدام امانی از فاکتور #${updatedInvoice.invoiceNumber}`,
            createdAt: new Date().toISOString(),
          };
        });

      return [...autoTransfers, ...filtered];
    });

    setConsignmentMovements(prev => {
      const oldRows = prev.filter(row => row.documentType === 'invoice' && (row.invoiceId === updatedInvoice.id || row.id.startsWith(`csg-inv-${updatedInvoice.id}-`)));
      const rest = prev.filter(row => !oldRows.some(old => old.id === row.id));
      if (!newIsConsignment) return rest;
      const rows: ConsignmentMovement[] = updatedInvoice.items.map((item, index) => {
        const existing = oldRows.find(row => row.productId === item.productId);
        return { id: `csg-inv-${updatedInvoice.id}-${item.productId || index}`, invoiceId: updatedInvoice.id, invoiceItemId: item.id, partyId: updatedInvoice.partyId, partyName: updatedInvoice.partyName, partyPhone: updatedInvoice.partyPhone, warehouseId: newConsignmentWhId, warehouseName: newConsignmentWh?.name, productId: item.productId, productName: item.productName, date: updatedInvoice.date, issueTime: updatedInvoice.issueTime, type: updatedInvoice.type === 'sell' ? 'deposit' : updatedInvoice.type === 'return_sell' ? 'return' : 'withdrawal', documentType: 'invoice', documentNumber: updatedInvoice.invoiceNumber, unit: item.unit, bagWeightKg: item.bagsCount > 0 ? item.tonsCount * 1000 / item.bagsCount : undefined, quantityTons: item.tonsCount, quantityBags: item.bagsCount, notes: existing?.notes || `تخصیص امانت از فاکتور #${updatedInvoice.invoiceNumber}`, createdAt: existing?.createdAt || updatedInvoice.createdAt };
      });
      return [...rows, ...rest];
    });

    // 2. Reverse the old document, then post the replacement (including a changed party/currency).
    setParties(prev => applyInvoicePartyBalance(applyInvoicePartyBalance(prev, oldInvoice, true), updatedInvoice));

    // 3. Reverse cash exactly; zero clamps would manufacture money on a later deletion.
    const newReg = invoiceCashAccountId(updatedInvoice);
    setCashRegister(prev => applyInvoiceCashRegister(applyInvoiceCashRegister(prev, oldInvoice, true), updatedInvoice));
    setCashAccounts(prev => applyInvoiceCashAccounts(applyInvoiceCashAccounts(prev, oldInvoice, true), updatedInvoice));

    // Update linked financial transaction in transactions list
    setTransactions(prev => {
      const linkedTransaction = prev.find(t => t.invoiceId === updatedInvoice.id || t.id === 'tx-inv-' + updatedInvoice.id);
      const filtered = prev.filter(t => t.invoiceId !== updatedInvoice.id && t.id !== 'tx-inv-' + updatedInvoice.id);
      if (updatedInvoice.paidAmount > 0) {
        const txType: TransactionType = invoiceCashDirection(updatedInvoice.type) > 0 ? 'receive_payment' : 'make_payment';
        const autoTx: FinancialTransaction = {
          id: 'tx-inv-' + updatedInvoice.id,
          transactionNumber: linkedTransaction?.type === txType ? linkedTransaction.transactionNumber : getNextTransactionNumber(txType),
          date: updatedInvoice.date,
          issueTime: updatedInvoice.issueTime || getCurrentTime(),
          type: txType,
          partyId: updatedInvoice.partyId,
          partyName: updatedInvoice.partyName,
          partyPhone: updatedInvoice.partyPhone,
          partyAddress: updatedInvoice.partyAddress,
          amount: updatedInvoice.paidAmount,
          currency: updatedInvoice.currency,
          cashRegister: newReg,
          description:
            updatedInvoice.type === 'sell' ? `دریافت نقدی بابت فاکتور فروش #${updatedInvoice.invoiceNumber}`
              : updatedInvoice.type === 'buy' ? `پرداخت نقدی بابت فاکتور خرید #${updatedInvoice.invoiceNumber}`
              : updatedInvoice.type === 'return_sell' ? `استرداد وجه بابت برگشت از فروش #${updatedInvoice.invoiceNumber}`
              : `دریافت وجه بابت برگشت از خرید #${updatedInvoice.invoiceNumber}`,
          invoiceId: updatedInvoice.id,
          createdAt: linkedTransaction?.createdAt || new Date().toISOString(),
        };
        return [autoTx, ...filtered];
      }
      return filtered;
    });

    setInvoices(prev => prev.map(inv => (inv.id === updatedInvoice.id ? updatedInvoice : inv)));

    // Add Audit Log Entry
    const invTypeName = updatedInvoice.type === 'sell' ? 'فروش' : updatedInvoice.type === 'buy' ? 'خرید' : 'مرجوعی';
    addAuditLog({
      action: 'update',
      actionLabel: `ویرایش فاکتور ${invTypeName}`,
      category: 'invoice',
      entityId: updatedInvoice.id,
      entityNumber: updatedInvoice.invoiceNumber,
      entityTitle: `فاکتور #${updatedInvoice.invoiceNumber} (${updatedInvoice.partyName})`,
      details: `ویرایش فاکتور ${invTypeName} شماره #${updatedInvoice.invoiceNumber}. مبلغ قبل: ${(oldInvoice.totalAmount || 0).toLocaleString()} ${oldInvoice.currency} -> مبلغ جدید: ${(updatedInvoice.totalAmount || 0).toLocaleString()} ${updatedInvoice.currency}`,
      previousValue: JSON.stringify(oldInvoice, null, 2),
      newValue: JSON.stringify(updatedInvoice, null, 2),
    });

    notify(
      'success',
      'فاکتور با موفقیت اصلاح شد',
      `فاکتور #${updatedInvoice.invoiceNumber} مربوط به ${updatedInvoice.partyName} به‌روزرسانی شد.`
    );
  };

  const deleteInvoice = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      const consignmentError = consignmentInvoiceGuard(inv);
      if (consignmentError) { notify('error', consignmentError); return; }
      const invTypeName = inv.type === 'sell' ? 'فروش' : inv.type === 'buy' ? 'خرید' : 'مرجوعی';

      // Add Audit Log Entry for Deletion
      addAuditLog({
        action: 'delete',
        actionLabel: `حذف فاکتور ${invTypeName}`,
        category: 'invoice',
        entityId: inv.id,
        entityNumber: inv.invoiceNumber,
        entityTitle: `فاکتور #${inv.invoiceNumber} (${inv.partyName})`,
        details: `حذف فاکتور ${invTypeName} شماره #${inv.invoiceNumber} به مبلغ کل ${(inv.totalAmount || 0).toLocaleString()} ${inv.currency} و بازگردانی خودکار انبار و حساب شخص`,
        previousValue: JSON.stringify(inv, null, 2),
      });

      notify(
        'warning',
        'فاکتور از سیستم حذف شد',
        `فاکتور #${inv.invoiceNumber} حذف و موجودی گدام و مانده حساب طرف حساب اصلاح گردید.`
      );

      // Revert stock changes (including consignment warehouse)
      const isConsignment = invoiceHasConsignment(inv);
      const consignmentWh = isConsignment
        ? invoiceConsignmentWarehouse(inv)
        : null;
      const consignmentWhId = consignmentWh?.id || 'wh-2';

      setStocks(prevStocks => {
        let updated = [...prevStocks];
        inv.items.forEach(item => {
          const sourceId = invoiceSourceWarehouse(inv, item, isConsignment);
          const idx = updated.findIndex(s => s.warehouseId === sourceId && s.productId === item.productId);
          const deltaTons = -invoiceStockDirection(inv.type) * item.tonsCount;
          const deltaBags = -invoiceStockDirection(inv.type) * item.bagsCount;
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              quantityTons: addInvoiceLedgerAmount(updated[idx].quantityTons, deltaTons),
              quantityBags: addInvoiceLedgerAmount(updated[idx].quantityBags, deltaBags),
            };
          }

          if (isConsignment && consignmentWhId && consignmentWhId !== sourceId) {
            const cRevertDeltaTons = invoiceStockDirection(inv.type) * item.tonsCount;
            const cRevertDeltaBags = invoiceStockDirection(inv.type) * item.bagsCount;
            const cIdx = updated.findIndex(s => s.warehouseId === consignmentWhId && s.productId === item.productId);
            if (cIdx >= 0) {
              updated[cIdx] = {
                ...updated[cIdx],
                quantityTons: addInvoiceLedgerAmount(updated[cIdx].quantityTons, cRevertDeltaTons),
                quantityBags: addInvoiceLedgerAmount(updated[cIdx].quantityBags, cRevertDeltaBags),
              };
            }
          }
        });
        return updated;
      });

      // Remove linked consignment transfers
      setTransfers(prev => prev.filter(t => !t.id.startsWith(`trf-inv-${id}`)));

      // Reverse only this invoice's party and cash effects; preserve opening / unrelated balances.
      if (inv.partyId) setParties(prev => applyInvoicePartyBalance(prev, inv, true));
      setCashRegister(prev => applyInvoiceCashRegister(prev, inv, true));
      setCashAccounts(prev => applyInvoiceCashAccounts(prev, inv, true));

      // Remove linked financial transaction
      setTransactions(prev => prev.filter(t => t.invoiceId !== id && t.id !== 'tx-inv-' + id));

      // Remove linked consignment movements & transfers
      setConsignmentMovements(prev => prev.filter(c => !c.id.startsWith(`csg-inv-${id}`)));
      setTransfers(prev => prev.filter(t => !t.id.startsWith(`trf-inv-${id}`)));
    }

    setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  // Create Financial Transaction (Receive money from debtor / Pay money to supplier / Exchange / Cash Transfer)
  const createTransaction = (txData: Omit<FinancialTransaction, 'id' | 'createdAt'>): FinancialTransaction => {
    if (txData.incomeId || txData.expenseId) throw new Error('سند عاید/هزینه را از فرم مخصوص آن ثبت کنید؛ گردش صندوق نباید دوباره ثبت شود.');
    const party = txData.partyId ? parties.find(p => p.id === txData.partyId) : undefined;
    const resolvedTxNumber = (txData.transactionNumber || '').trim() || getNextTransactionNumber(txData.type);

    // A create request must never silently overwrite an older financial document.
    const existingSameTx = transactions.find(t => t.transactionNumber.trim() === resolvedTxNumber && t.type === txData.type);
    if (existingSameTx) {
      notify('error', 'شمارهٔ سند تکراری است؛ از ویرایش لیست استفاده کنید.');
      return existingSameTx;
    }

    const newId = createTradeEntityId('tx');
    const newTx: FinancialTransaction = {
      ...txData,
      id: newId,
      transactionNumber: resolvedTxNumber,
      issueTime: txData.issueTime || getCurrentTime(),
      partyPhone: txData.partyPhone || party?.phone || '',
      partyAddress: txData.partyAddress || party?.address || '',
      createdAt: new Date().toISOString(),
    };

    setTransactions(prev => [newTx, ...prev]);

    setParties(prev => applyTransactionParties(prev, newTx));
    setCashRegister(prev => applyTransactionCashRegister(prev, newTx));
    setCashAccounts(prev => applyTransactionCashAccounts(prev, newTx));

    // Add Audit Log Entry
    const txLabelMap: Record<string, string> = {
      receive_payment: 'دریافت وجه',
      make_payment: 'پرداخت وجه',
      currency_exchange: 'تبادله اسعار',
      cash_transfer: 'انتقال صندوق به صندوق',
      expense: 'هزینه و مصارف',
    };
    const txLabel = txLabelMap[newTx.type] || 'سند مالی';

    addAuditLog({
      action: newTx.type === 'cash_transfer' ? 'transfer' : 'create',
      actionLabel: `ثبت ${txLabel}`,
      category: 'transaction',
      entityId: newId,
      entityNumber: resolvedTxNumber,
      entityTitle: `${txLabel} #${resolvedTxNumber}`,
      details: `ثبت ${txLabel} به مبلغ ${newTx.amount.toLocaleString()} ${newTx.currency}${newTx.partyName ? ` • طرف حساب: ${newTx.partyName}` : ''}${newTx.description ? ` (${newTx.description})` : ''}`,
      newValue: JSON.stringify(newTx, null, 2),
    });

    notify(
      'success',
      `${txLabel} با موفقیت ثبت شد`,
      `شماره سند: #${resolvedTxNumber} • مبلغ: ${newTx.amount.toLocaleString()} ${newTx.currency}`
    );

    return newTx;
  };

  const deleteTransaction = (id: string) => {
    const source = ownedCompanyCashSource(transactions.find(transaction => transaction.id === id) || { id }, incomesRef.current, expensesRef.current);
    if (source) { if (source.kind === 'income') deleteIncome(source.document.id); else deleteExpense(source.document.id); return; }
    const oldTx = transactions.find(t => t.id === id);
    const linkedInvoice = oldTx?.invoiceId && oldTx.id === 'tx-inv-' + oldTx.invoiceId ? invoices.find(invoice => invoice.id === oldTx.invoiceId) : undefined;
    if (linkedInvoice) {
      // Invoice-created payments belong to the invoice's due/cash posting, not a second party posting.
      updateInvoice({ ...linkedInvoice, paidAmount: 0, balanceAmount: linkedInvoice.totalAmount, paymentStatus: 'unpaid', paymentType: 'نسیه' });
      return;
    }
    if (oldTx) {
      const txLabelMap: Record<string, string> = {
        receive_payment: 'دریافت وجه',
        make_payment: 'پرداخت وجه',
        currency_exchange: 'تبادله اسعار',
        cash_transfer: 'انتقال صندوق به صندوق',
        expense: 'هزینه و مصارف',
      };
      const txLabel = txLabelMap[oldTx.type] || 'سند مالی';

      // Add Audit Log
      addAuditLog({
        action: 'delete',
        actionLabel: `حذف ${txLabel}`,
        category: 'transaction',
        entityId: oldTx.id,
        entityNumber: oldTx.transactionNumber,
        entityTitle: `${txLabel} #${oldTx.transactionNumber}`,
        details: `حذف ${txLabel} شماره #${oldTx.transactionNumber} به مبلغ ${oldTx.amount.toLocaleString()} ${oldTx.currency} و بازگردانی خودکار موجودی حساب‌ها`,
        previousValue: JSON.stringify(oldTx, null, 2),
      });

      notify(
        'warning',
        `${txLabel} از سیستم حذف شد`,
        `سند #${oldTx.transactionNumber} حذف و موجودی صندوق‌ها و حساب‌ها اصلاح گردید.`
      );

      setParties(prev => applyTransactionParties(prev, oldTx, true));
      setCashRegister(prev => applyTransactionCashRegister(prev, oldTx, true));
      setCashAccounts(prev => applyTransactionCashAccounts(prev, oldTx, true));
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Update Financial Transaction
  const updateTransaction = (updatedTx: FinancialTransaction) => {
    const source = ownedCompanyCashSource(transactions.find(transaction => transaction.id === updatedTx.id) || updatedTx, incomesRef.current, expensesRef.current);
    if (source) {
      if (source.kind === 'income' ? updatedTx.type !== 'receive_payment' : !['expense', 'make_payment'].includes(updatedTx.type)) throw new Error('نوع سند اصلی عاید/هزینه قابل تبدیل به تراکنش مستقل نیست.');
      if (updatedTx.partyId || updatedTx.invoiceId || (updatedTx.discountAmount || 0) !== 0 || updatedTx.type === 'cash_transfer' || updatedTx.type === 'currency_exchange') throw new Error('سند عاید/هزینه را از فرم مخصوص همان سند ویرایش کنید.');
      const data = { date: updatedTx.date, issueTime: updatedTx.issueTime, amount: updatedTx.isExchange ? updatedTx.cashAmount ?? updatedTx.amount : updatedTx.amount, currency: updatedTx.cashCurrency || updatedTx.currency, cashRegisterId: updatedTx.cashRegister, notes: updatedTx.notes };
      if (source.kind === 'income') updateIncome(source.document.id, { ...data, payer: updatedTx.partyName }); else updateExpense(source.document.id, { ...data, recipient: updatedTx.partyName });
      return;
    }
    const oldTx = transactions.find(t => t.id === updatedTx.id);
    if (!oldTx) return;
    const linkedInvoice = oldTx.invoiceId && oldTx.id === 'tx-inv-' + oldTx.invoiceId ? invoices.find(invoice => invoice.id === oldTx.invoiceId) : undefined;
    if (linkedInvoice) {
      if (updatedTx.partyId !== linkedInvoice.partyId || updatedTx.currency !== linkedInvoice.currency || updatedTx.isExchange || (updatedTx.discountAmount || 0) !== 0 || updatedTx.amount < 0 || updatedTx.amount > linkedInvoice.totalAmount || !Number.isFinite(updatedTx.amount)) {
        notify('error', 'برای تغییر ارز، شخص یا تخفیف این سند، فاکتور مرتبط را ویرایش کنید.');
        return;
      }
      updateInvoice({ ...linkedInvoice, paidAmount: updatedTx.amount, balanceAmount: linkedInvoice.totalAmount - updatedTx.amount, cashRegister: updatedTx.cashRegister, paymentStatus: updatedTx.amount >= linkedInvoice.totalAmount ? 'paid' : updatedTx.amount > 0 ? 'partial' : 'unpaid', paymentType: updatedTx.amount >= linkedInvoice.totalAmount ? 'نقدی' : updatedTx.amount > 0 ? 'نیمه نسیه' : 'نسیه' });
      setTransactions(prev => prev.map(tx => tx.id === oldTx.id ? { ...tx, description: updatedTx.description, date: updatedTx.date, issueTime: updatedTx.issueTime } : tx));
      return;
    }

    setParties(prev => applyTransactionParties(applyTransactionParties(prev, oldTx, true), updatedTx));
    setCashRegister(prev => applyTransactionCashRegister(applyTransactionCashRegister(prev, oldTx, true), updatedTx));
    setCashAccounts(prev => applyTransactionCashAccounts(applyTransactionCashAccounts(prev, oldTx, true), updatedTx));

    setTransactions(prev => prev.map(t => (t.id === updatedTx.id ? updatedTx : t)));

    // Add Audit Log
    const txLabelMap: Record<string, string> = {
      receive_payment: 'دریافت وجه',
      make_payment: 'پرداخت وجه',
      currency_exchange: 'تبادله اسعار',
      cash_transfer: 'انتقال صندوق به صندوق',
      expense: 'هزینه و مصارف',
    };
    const txLabel = txLabelMap[updatedTx.type] || 'سند مالی';

    addAuditLog({
      action: 'update',
      actionLabel: `ویرایش ${txLabel}`,
      category: 'transaction',
      entityId: updatedTx.id,
      entityNumber: updatedTx.transactionNumber,
      entityTitle: `${txLabel} #${updatedTx.transactionNumber}`,
      details: `ویرایش ${txLabel} شماره #${updatedTx.transactionNumber}. مبلغ قبل: ${oldTx.amount.toLocaleString()} ${oldTx.currency} -> مبلغ جدید: ${updatedTx.amount.toLocaleString()} ${updatedTx.currency}`,
      previousValue: JSON.stringify(oldTx, null, 2),
      newValue: JSON.stringify(updatedTx, null, 2),
    });

    notify(
      'success',
      `${txLabel} با موفقیت اصلاح گردید`,
      `سند شماره #${updatedTx.transactionNumber} به‌روزرسانی شد.`
    );
  };

  // Stock Transfer between warehouses
  const createStockTransfer = (transferData: Omit<StockTransfer, 'id' | 'createdAt'>): StockTransfer => {
    const newId = 'trf-' + Date.now();
    const resolvedTransferNumber = transferData.transferNumber || getNextTransferNumber();
    const newTransfer: StockTransfer = {
      ...transferData,
      id: newId,
      transferNumber: resolvedTransferNumber,
      createdAt: new Date().toISOString(),
    };

    setTransfers(prev => [newTransfer, ...prev]);

    // Update stocks
    setStocks(prevStocks => {
      let updated = [...prevStocks];

      // Decrease from source warehouse
      const sourceIdx = updated.findIndex(
        s => s.warehouseId === newTransfer.fromWarehouseId && s.productId === newTransfer.productId
      );
      if (sourceIdx >= 0) {
        const cur = updated[sourceIdx];
        updated[sourceIdx] = {
          ...cur,
          quantityTons: Math.max(0, cur.quantityTons - newTransfer.tonsCount),
          quantityBags: Math.max(0, cur.quantityBags - newTransfer.bagsCount),
        };
      }

      // Increase in target warehouse
      const targetIdx = updated.findIndex(
        s => s.warehouseId === newTransfer.toWarehouseId && s.productId === newTransfer.productId
      );
      if (targetIdx >= 0) {
        const cur = updated[targetIdx];
        updated[targetIdx] = {
          ...cur,
          quantityTons: cur.quantityTons + newTransfer.tonsCount,
          quantityBags: cur.quantityBags + newTransfer.bagsCount,
        };
      } else {
        updated.push({
          warehouseId: newTransfer.toWarehouseId,
          productId: newTransfer.productId,
          quantityTons: newTransfer.tonsCount,
          quantityBags: newTransfer.bagsCount,
        });
      }

      return updated;
    });

    return newTransfer;
  };

  const updateStockTransfer = (updatedTransfer: StockTransfer) => {
    const oldTransfer = transfers.find(t => t.id === updatedTransfer.id);
    if (!oldTransfer) return;

    setStocks(prevStocks => {
      let updated = [...prevStocks];
      // Revert old
      const oldSrcIdx = updated.findIndex(s => s.warehouseId === oldTransfer.fromWarehouseId && s.productId === oldTransfer.productId);
      if (oldSrcIdx >= 0) {
        updated[oldSrcIdx] = {
          ...updated[oldSrcIdx],
          quantityTons: updated[oldSrcIdx].quantityTons + oldTransfer.tonsCount,
          quantityBags: updated[oldSrcIdx].quantityBags + oldTransfer.bagsCount,
        };
      }
      const oldDstIdx = updated.findIndex(s => s.warehouseId === oldTransfer.toWarehouseId && s.productId === oldTransfer.productId);
      if (oldDstIdx >= 0) {
        updated[oldDstIdx] = {
          ...updated[oldDstIdx],
          quantityTons: Math.max(0, updated[oldDstIdx].quantityTons - oldTransfer.tonsCount),
          quantityBags: Math.max(0, updated[oldDstIdx].quantityBags - oldTransfer.bagsCount),
        };
      }

      // Apply new
      const newSrcIdx = updated.findIndex(s => s.warehouseId === updatedTransfer.fromWarehouseId && s.productId === updatedTransfer.productId);
      if (newSrcIdx >= 0) {
        updated[newSrcIdx] = {
          ...updated[newSrcIdx],
          quantityTons: Math.max(0, updated[newSrcIdx].quantityTons - updatedTransfer.tonsCount),
          quantityBags: Math.max(0, updated[newSrcIdx].quantityBags - updatedTransfer.bagsCount),
        };
      }
      const newDstIdx = updated.findIndex(s => s.warehouseId === updatedTransfer.toWarehouseId && s.productId === updatedTransfer.productId);
      if (newDstIdx >= 0) {
        updated[newDstIdx] = {
          ...updated[newDstIdx],
          quantityTons: updated[newDstIdx].quantityTons + updatedTransfer.tonsCount,
          quantityBags: updated[newDstIdx].quantityBags + updatedTransfer.bagsCount,
        };
      } else {
        updated.push({
          warehouseId: updatedTransfer.toWarehouseId,
          productId: updatedTransfer.productId,
          quantityTons: updatedTransfer.tonsCount,
          quantityBags: updatedTransfer.bagsCount,
        });
      }
      return updated;
    });

    setTransfers(prev => prev.map(t => (t.id === updatedTransfer.id ? updatedTransfer : t)));
  };

  const deleteStockTransfer = (id: string) => {
    const oldTransfer = transfers.find(t => t.id === id);
    if (oldTransfer) {
      setStocks(prevStocks => {
        let updated = [...prevStocks];
        // Revert source warehouse (add back transferred stock)
        const srcIdx = updated.findIndex(
          s => s.warehouseId === oldTransfer.fromWarehouseId && s.productId === oldTransfer.productId
        );
        if (srcIdx >= 0) {
          updated[srcIdx] = {
            ...updated[srcIdx],
            quantityTons: updated[srcIdx].quantityTons + oldTransfer.tonsCount,
            quantityBags: updated[srcIdx].quantityBags + oldTransfer.bagsCount,
          };
        }
        // Revert target warehouse (subtract transferred stock)
        const dstIdx = updated.findIndex(
          s => s.warehouseId === oldTransfer.toWarehouseId && s.productId === oldTransfer.productId
        );
        if (dstIdx >= 0) {
          updated[dstIdx] = {
            ...updated[dstIdx],
            quantityTons: Math.max(0, updated[dstIdx].quantityTons - oldTransfer.tonsCount),
            quantityBags: Math.max(0, updated[dstIdx].quantityBags - oldTransfer.bagsCount),
          };
        }
        return updated;
      });
    }
    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  // ================= CONSIGNMENT MOVEMENTS & CUSTOMER LEDGER =================
  const createConsignmentMovement = (data: Omit<ConsignmentMovement, 'id' | 'createdAt'>): ConsignmentMovement => {
    const resolved = { ...data, documentNumber: data.documentNumber.trim() || getNextConsignmentDocNumber() };
    const invalid = validateConsignmentMovement(resolved, consignmentMovements, stocks, warehouses, products);
    if (invalid) throw new Error(invalid);
    if (resolved.invoiceId && resolved.type !== 'deposit') {
      const lot = consignmentLots(consignmentMovements, invoices).find(lot => lot.invoiceId === resolved.invoiceId && lot.partyId === resolved.partyId && lot.warehouseId === resolved.warehouseId && lot.productId === resolved.productId);
      if (!lot || resolved.quantityTons > lot.remainingTons + .000001 || resolved.quantityBags > lot.remainingBags + .000001) throw new Error('مقدار تحویل از ماندهٔ فاکتور انتخاب‌شده بیشتر است.');
    }
    const current = consignmentBalanceFor(consignmentMovements, resolved);
    const movement: ConsignmentMovement = { ...resolved, id: createTradeEntityId('csg'), quantityTons: roundConsignment(resolved.quantityTons), quantityBags: roundConsignment(resolved.quantityBags), remainingTonsAfter: roundConsignment((current?.remainingTons || 0) + consignmentSign(resolved.type) * resolved.quantityTons), remainingBagsAfter: roundConsignment((current?.remainingBags || 0) + consignmentSign(resolved.type) * resolved.quantityBags), createdAt: new Date().toISOString() };
    setStocks(prev => consignmentStockPost(prev, movement));
    if (movement.type === 'withdrawal') setTransfers(prev => [consignmentTransfer(movement), ...prev]);
    setConsignmentMovements(prev => [movement, ...prev]);
    addAuditLog({ action: movement.type === 'withdrawal' ? 'transfer' : 'create', actionLabel: movement.type === 'deposit' ? 'ورود کالای امانی' : 'خروج کالای امانی', category: 'transaction', entityId: movement.id, entityNumber: movement.documentNumber, entityTitle: `${movement.partyName} - ${movement.productName}`, details: `حواله #${movement.documentNumber}: ${movement.quantityTons} تن (${movement.quantityBags} کیسه) در ${movement.warehouseName || movement.warehouseId}`, newValue: JSON.stringify(movement) });
    notify('success', 'سند امانی با موفقیت ثبت شد', `سند #${movement.documentNumber}`);
    return movement;
  };

  const deleteConsignmentMovement = (id: string) => {
    const movement = consignmentMovements.find(row => row.id === id);
    if (!movement) return;
    if (isInvoiceConsignmentMovement(movement)) { notify('error', 'این گردش از فاکتور ایجاد شده است؛ فاکتور مرتبط را ویرایش یا حذف کنید.'); return; }
    const without = consignmentMovements.filter(row => row.id !== id);
    const after = consignmentBalanceFor(without, movement);
    if (movement.type === 'deposit' && after && (after.remainingTons < -.000001 || after.remainingBags < -.000001)) { notify('error', 'از این سپرده قبلاً بار تحویل شده است؛ ابتدا حواله‌های خروج وابسته را اصلاح کنید.'); return; }
    setStocks(prev => consignmentStockPost(prev, movement, true));
    setTransfers(prev => prev.filter(transfer => transfer.id !== `trf-csg-out-${id}`));
    setConsignmentMovements(without);
    addAuditLog({ action: 'delete', actionLabel: 'حذف حوالهٔ امانی', category: 'transaction', entityId: id, entityNumber: movement.documentNumber, entityTitle: movement.partyName, details: 'برگشت دقیق اثر حواله بر موجودی همین گدام', previousValue: JSON.stringify(movement) });
    notify('warning', 'سند امانی حذف و موجودی برگشت داده شد', `سند #${movement.documentNumber}`);
  };

  const updateConsignmentMovement = (id: string, fields: Partial<ConsignmentMovement>) => {
    const old = consignmentMovements.find(row => row.id === id);
    if (!old) return;
    if (isInvoiceConsignmentMovement(old)) { notify('error', 'گردش ساخته‌شده از فاکتور را از همان فاکتور ویرایش کنید.'); return; }
    const without = consignmentMovements.filter(row => row.id !== id);
    const restored = consignmentStockPost(stocks, old, true);
    const updated = { ...old, ...fields, id: old.id, createdAt: old.createdAt };
    const invalid = validateConsignmentMovement(updated, without, restored, warehouses, products, id);
    if (invalid) { notify('error', invalid); return; }
    if (updated.invoiceId && updated.type !== 'deposit') {
      const lot = consignmentLots(without, invoices).find(lot => lot.invoiceId === updated.invoiceId && lot.partyId === updated.partyId && lot.warehouseId === updated.warehouseId && lot.productId === updated.productId);
      if (!lot || updated.quantityTons > lot.remainingTons + .000001 || updated.quantityBags > lot.remainingBags + .000001) { notify('error', 'مقدار جدید از ماندهٔ فاکتور مرتبط بیشتر است.'); return; }
    }
    const after = consignmentHoldings([...without, updated]);
    if (after.some(row => row.remainingTons < -.000001 || row.remainingBags < -.000001)) { notify('error', 'این تغییر ماندهٔ مشتری را منفی می‌کند؛ حواله‌های وابسته را ابتدا اصلاح کنید.'); return; }
    const balance = consignmentBalanceFor(without, updated);
    const next = { ...updated, remainingTonsAfter: roundConsignment((balance?.remainingTons || 0) + consignmentSign(updated.type) * updated.quantityTons), remainingBagsAfter: roundConsignment((balance?.remainingBags || 0) + consignmentSign(updated.type) * updated.quantityBags) };
    setStocks(prev => consignmentStockPost(consignmentStockPost(prev, old, true), next));
    setTransfers(prev => [...(next.type === 'withdrawal' ? [consignmentTransfer(next)] : []), ...prev.filter(transfer => transfer.id !== `trf-csg-out-${id}`)]);
    setConsignmentMovements(prev => prev.map(row => row.id === id ? next : row));
    notify('success', 'حوالهٔ امانی و موجودی مرتبط اصلاح شد', `سند #${next.documentNumber}`);
  };

  const getCustomerConsignmentBalances = (warehouseId?: string) => {
    const customers = new Map<string, { partyId: string; partyName: string; partyPhone?: string; totalInTons: number; totalInBags: number; totalOutTons: number; totalOutBags: number; remainingTons: number; remainingBags: number; products: { productId: string; productName: string; totalInTons: number; totalInBags: number; totalOutTons: number; totalOutBags: number; remainingTons: number; remainingBags: number }[] }>();
    for (const holding of consignmentHoldings(consignmentMovements, warehouseId)) {
      const key = holding.partyId || holding.partyName;
      const customer = customers.get(key) || { partyId: holding.partyId, partyName: holding.partyName, partyPhone: holding.partyPhone, totalInTons: 0, totalInBags: 0, totalOutTons: 0, totalOutBags: 0, remainingTons: 0, remainingBags: 0, products: [] };
      for (const field of ['totalInTons', 'totalInBags', 'totalOutTons', 'totalOutBags', 'remainingTons', 'remainingBags'] as const) customer[field] = roundConsignment(customer[field] + holding[field]);
      const product = customer.products.find(product => product.productId === holding.productId);
      if (product) for (const field of ['totalInTons', 'totalInBags', 'totalOutTons', 'totalOutBags', 'remainingTons', 'remainingBags'] as const) product[field] = roundConsignment(product[field] + holding[field]);
      else customer.products.push({ productId: holding.productId, productName: holding.productName, totalInTons: holding.totalInTons, totalInBags: holding.totalInBags, totalOutTons: holding.totalOutTons, totalOutBags: holding.totalOutBags, remainingTons: holding.remainingTons, remainingBags: holding.remainingBags });
      customers.set(key, customer);
    }
    return [...customers.values()];
  };

  // Products CRUD (with Opening Stock support)
  const addProduct = (productData: Omit<Product, 'id' | 'bagsPerTon'>): Product => {
    const bagsPerTon = 1000 / (productData.bagWeightKg || 50);
    const newProduct: Product = {
      ...productData,
      id: 'prod-' + Date.now(),
      bagsPerTon,
    };
    setProducts(prev => [...prev, newProduct]);

    // Handle initial opening stock if specified
    if (newProduct.initialStockTons && newProduct.initialStockTons > 0 && newProduct.initialWarehouseId) {
      setStocks(prev => {
        const existingIdx = prev.findIndex(s => s.warehouseId === newProduct.initialWarehouseId && s.productId === newProduct.id);
        const tons = newProduct.initialStockTons || 0;
        const bags = newProduct.initialStockBags || Math.round(tons * bagsPerTon);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantityTons: updated[existingIdx].quantityTons + tons,
            quantityBags: updated[existingIdx].quantityBags + bags,
          };
          return updated;
        }
        return [...prev, {
          warehouseId: newProduct.initialWarehouseId!,
          productId: newProduct.id,
          quantityTons: tons,
          quantityBags: bags,
        }];
      });
    }

    return newProduct;
  };

  const updateProduct = (id: string, productData: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, ...productData };
        if (productData.bagWeightKg) {
          updated.bagsPerTon = 1000 / productData.bagWeightKg;
        }
        return updated;
      })
    );
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setStocks(prev => prev.filter(s => s.productId !== id));
  };

  // Expenses & Categories CRUD
  const addExpenseCategory = (categoryData: Omit<ExpenseCategory, 'id' | 'createdAt'>): ExpenseCategory => {
    const newCat: ExpenseCategory = {
      ...categoryData,
      id: 'exp-cat-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setExpenseCategories(prev => [...prev, newCat]);
    return newCat;
  };

  const updateExpenseCategory = (id: string, categoryData: Partial<ExpenseCategory>) => {
    setExpenseCategories(prev => prev.map(c => (c.id === id ? { ...c, ...categoryData } : c)));
    if (categoryData.name) {
      setExpenses(prev => prev.map(e => (e.categoryId === id ? { ...e, categoryName: categoryData.name! } : e)));
    }
  };

  const deleteExpenseCategory = (id: string) => {
    setExpenseCategories(prev => prev.filter(c => c.id !== id));
  };

  const addExpenseDefinition = (definitionData: Omit<ExpenseDefinition, 'id'>): ExpenseDefinition => {
    const newDef: ExpenseDefinition = {
      ...definitionData,
      id: 'ed-' + Date.now(),
    };
    setExpenseDefinitions(prev => [...prev, newDef]);
    return newDef;
  };

  const updateExpenseDefinition = (id: string, definitionData: Partial<ExpenseDefinition>) => {
    setExpenseDefinitions(prev => prev.map(d => (d.id === id ? { ...d, ...definitionData } : d)));
  };

  const deleteExpenseDefinition = (id: string) => {
    setExpenseDefinitions(prev => prev.filter(d => d.id !== id));
  };

  // Income/expense documents own their cash posting; their transaction is a synchronized display mirror only.
  const postCompanyCashChange = (
    kind: CompanyCashKind,
    previous?: CompanyCashDocument,
    next?: CompanyCashDocument,
  ) => {
    const oldPosting = previous
      ? companyCashTransaction(kind, previous)
      : undefined;
    const newPosting = next ? companyCashTransaction(kind, next) : undefined;
    setCashRegister((value) => {
      const restored = oldPosting
        ? applyTransactionCashRegister(value, oldPosting, true)
        : value;
      return newPosting
        ? applyTransactionCashRegister(restored, newPosting)
        : restored;
    });
    setCashAccounts((value) => {
      const restored = oldPosting
        ? applyTransactionCashAccounts(value, oldPosting, true)
        : value;
      return newPosting
        ? applyTransactionCashAccounts(restored, newPosting)
        : restored;
    });
    setTransactions((value) =>
      next
        ? syncCompanyCashTransaction(value, kind, next)
        : value.filter(
            (transaction) =>
              !isCompanyCashMirror(transaction, kind, previous!.id),
          ),
    );
  };
  const assertCompanyCashDocument = (
    document: CompanyCashDocument,
    kind: CompanyCashKind,
    excludingId?: string,
  ) => {
    const invalid = validateCompanyCashDocument(document, cashAccounts);
    if (invalid) throw new Error(invalid);
    if (
      duplicateCompanyCashNumber(
        kind === 'income' ? incomesRef.current : expensesRef.current,
        kind,
        companyCashNumber(kind, document),
        excludingId,
      )
    )
      throw new Error('شمارهٔ سند تکراری است؛ سند قبلی را از لیست ویرایش کنید.');
  };
  const auditCompanyCashChange = (
    kind: CompanyCashKind,
    action: 'create' | 'update' | 'delete',
    document: CompanyCashDocument,
    previous?: CompanyCashDocument,
  ) => {
    const label = kind === 'income' ? 'عاید' : 'هزینه';
    addAuditLog({
      action,
      actionLabel: `${action === 'create' ? 'ثبت' : action === 'update' ? 'ویرایش' : 'حذف'} ${label}`,
      category: kind === 'expense' ? 'transaction' : 'income',
      entityId: document.id,
      entityNumber: companyCashNumber(kind, document),
      entityTitle: document.title,
      details: `${document.amount} ${document.currency} • ${document.cashRegisterName || companyCashAccountId(document)}`,
      previousValue: previous
        ? JSON.stringify(previous)
        : action === 'delete'
          ? JSON.stringify(document)
          : undefined,
      newValue: action !== 'delete' ? JSON.stringify(document) : undefined,
    });
  };

  const createExpense = (
    data: Omit<ExpenseItem, 'id' | 'createdAt' | 'expenseNumber'> & {
      expenseNumber?: string;
    },
  ): ExpenseItem => {
    const accountId =
      data.cashRegisterId || (data.currency === 'USD' ? 'usd_cash' : 'afn_cash');
    const expense: ExpenseItem = {
      ...data,
      recipient: data.recipient || data.payee,
      payee: data.recipient || data.payee,
      amount: addInvoiceLedgerAmount(0, data.amount),
      id: createTradeEntityId('exp'),
      expenseNumber: data.expenseNumber?.trim() || getNextExpenseNumber(),
      cashRegisterId: accountId,
      cashRegisterName: cashAccounts.find((account) => account.id === accountId)
        ?.name,
      categoryName:
        data.categoryName ||
        expenseCategories.find((category) => category.id === data.categoryId)
          ?.name ||
        'مصارف عمومی',
      createdByName: data.createdByName || currentUser.name,
      issueTime: data.issueTime || getCurrentTime(),
      createdAt: new Date().toISOString(),
    };
    assertCompanyCashDocument(expense, 'expense');
    expensesRef.current = [expense, ...expensesRef.current];
    setExpenses(expensesRef.current);
    postCompanyCashChange('expense', undefined, expense);
    auditCompanyCashChange('expense', 'create', expense);
    notify('success', 'هزینه ثبت و از صندوق انتخاب‌شده کسر شد', expense.title);
    return expense;
  };
  const updateExpense = (id: string, data: Partial<ExpenseItem>) => {
    const previous = expensesRef.current.find((document) => document.id === id);
    if (!previous) return;
    const recipient =
      data.recipient ?? data.payee ?? previous.recipient ?? previous.payee;
    const updated = {
      ...previous,
      ...data,
      recipient,
      payee: recipient,
      amount: addInvoiceLedgerAmount(0, data.amount ?? previous.amount),
      id,
      createdAt: previous.createdAt,
    };
    updated.cashRegisterId = companyCashAccountId(updated);
    updated.cashRegisterName = cashAccounts.find(
      (account) => account.id === updated.cashRegisterId,
    )?.name;
    assertCompanyCashDocument(updated, 'expense', id);
    expensesRef.current = expensesRef.current.map((document) =>
      document.id === id ? updated : document,
    );
    setExpenses(expensesRef.current);
    postCompanyCashChange('expense', previous, updated);
    auditCompanyCashChange('expense', 'update', updated, previous);
    notify('success', 'سند هزینه و موجودی صندوق اصلاح شد', updated.title);
  };
  const deleteExpense = (id: string) => {
    const previous = expensesRef.current.find((document) => document.id === id);
    if (!previous) return;
    expensesRef.current = expensesRef.current.filter(
      (document) => document.id !== id,
    );
    setExpenses(expensesRef.current);
    postCompanyCashChange('expense', previous);
    auditCompanyCashChange('expense', 'delete', previous);
    notify(
      'warning',
      'هزینه حذف و مبلغ آن به همان صندوق برگشت داده شد',
      previous.title,
    );
  };

  // Incomes & Secondary Revenues CRUD (ثبت و مدیریت عواید، فروش کیسه سیمان، پالت و ...)
  const getNextIncomeNumber = (): string =>
    nextCompanyCashNumber(incomesRef.current, 'income');

  const addIncomeCategory = (
    categoryData: Omit<IncomeCategory, 'id' | 'createdAt'>,
  ): IncomeCategory => {
    const newCat: IncomeCategory = {
      ...categoryData,
      id: 'inc-cat-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setIncomeCategories((prev) => [...prev, newCat]);
    return newCat;
  };

  const updateIncomeCategory = (
    id: string,
    categoryData: Partial<IncomeCategory>,
  ) => {
    setIncomeCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...categoryData } : c)),
    );
    if (categoryData.name) {
      setIncomes((prev) =>
        prev.map((i) =>
          i.categoryId === id ? { ...i, categoryName: categoryData.name! } : i,
        ),
      );
    }
  };

  const deleteIncomeCategory = (id: string) => {
    setIncomeCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const createIncome = (
    data: Omit<IncomeItem, 'id' | 'createdAt' | 'incomeNumber'> & {
      incomeNumber?: string;
    },
  ): IncomeItem => {
    const accountId =
      data.cashRegisterId || (data.currency === 'USD' ? 'usd_cash' : 'afn_cash');
    const income: IncomeItem = {
      ...data,
      amount: addInvoiceLedgerAmount(0, data.amount),
      id: createTradeEntityId('inc'),
      incomeNumber: data.incomeNumber?.trim() || getNextIncomeNumber(),
      cashRegisterId: accountId,
      cashRegisterName: cashAccounts.find((account) => account.id === accountId)
        ?.name,
      categoryName:
        data.categoryName ||
        incomeCategories.find((category) => category.id === data.categoryId)
          ?.name ||
        'عواید متفرقه',
      createdByName: data.createdByName || currentUser.name,
      issueTime: data.issueTime || getCurrentTime(),
      createdAt: new Date().toISOString(),
    };
    assertCompanyCashDocument(income, 'income');
    incomesRef.current = [income, ...incomesRef.current];
    setIncomes(incomesRef.current);
    postCompanyCashChange('income', undefined, income);
    auditCompanyCashChange('income', 'create', income);
    notify('success', 'عاید ثبت و به صندوق انتخاب‌شده اضافه شد', income.title);
    return income;
  };
  const updateIncome = (id: string, data: Partial<IncomeItem>) => {
    const previous = incomesRef.current.find((document) => document.id === id);
    if (!previous) return;
    const updated = {
      ...previous,
      ...data,
      amount: addInvoiceLedgerAmount(0, data.amount ?? previous.amount),
      id,
      createdAt: previous.createdAt,
    };
    updated.cashRegisterId = companyCashAccountId(updated);
    updated.cashRegisterName = cashAccounts.find(
      (account) => account.id === updated.cashRegisterId,
    )?.name;
    assertCompanyCashDocument(updated, 'income', id);
    incomesRef.current = incomesRef.current.map((document) =>
      document.id === id ? updated : document,
    );
    setIncomes(incomesRef.current);
    postCompanyCashChange('income', previous, updated);
    auditCompanyCashChange('income', 'update', updated, previous);
    notify('success', 'سند عاید و موجودی صندوق اصلاح شد', updated.title);
  };
  const deleteIncome = (id: string) => {
    const previous = incomesRef.current.find((document) => document.id === id);
    if (!previous) return;
    incomesRef.current = incomesRef.current.filter(
      (document) => document.id !== id,
    );
    setIncomes(incomesRef.current);
    postCompanyCashChange('income', previous);
    auditCompanyCashChange('income', 'delete', previous);
    notify(
      'warning',
      'عاید حذف و اثر آن از همان صندوق برگردانده شد',
      previous.title,
    );
  };

  // Warehouses CRUD
  const addWarehouse = (whData: Omit<Warehouse, 'id'>): Warehouse => {
    const newWh: Warehouse = {
      ...whData,
      id: 'wh-' + Date.now(),
    };
    setWarehouses(prev => [...prev, newWh]);
    return newWh;
  };

  const updateWarehouse = (id: string, whData: Partial<Warehouse>) => {
    setWarehouses(prev => prev.map(w => (w.id === id ? { ...w, ...whData } : w)));
  };

  const deleteWarehouse = (id: string) => {
    setWarehouses(prev => prev.filter(w => w.id !== id));
    // Also remove stock inventory records associated with this warehouse
    setStocks(prev => prev.filter(s => s.warehouseId !== id));
  };

  // Parties & Groups CRUD
  const addPartyGroup = (groupData: Omit<PartyGroup, 'id' | 'createdAt'>): PartyGroup => {
    const newGroup: PartyGroup = {
      ...groupData,
      id: 'grp-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setPartyGroups(prev => [...prev, newGroup]);
    return newGroup;
  };

  const updatePartyGroup = (id: string, groupData: Partial<PartyGroup>) => {
    setPartyGroups(prev => prev.map(g => (g.id === id ? { ...g, ...groupData } : g)));
    // Also sync party names if group name changed
    if (groupData.name) {
      setParties(prev =>
        prev.map(p => (p.groupId === id ? { ...p, groupName: groupData.name } : p))
      );
    }
  };

  const deletePartyGroup = (id: string) => {
    setPartyGroups(prev => prev.filter(g => g.id !== id));
    // Remove group association from parties
    setParties(prev =>
      prev.map(p => (p.groupId === id ? { ...p, groupId: undefined, groupName: undefined } : p))
    );
  };

  const addParty = (partyData: Omit<Party, 'id' | 'createdAt'>): Party => {
    let resolvedGroupName = partyData.groupName;
    if (partyData.groupId && !resolvedGroupName) {
      const grp = partyGroups.find(g => g.id === partyData.groupId);
      if (grp) resolvedGroupName = grp.name;
    }
    const requestedCode = (partyData.code || '').trim();
    // Prevent duplicate party codes: if code is empty or already taken by an existing party, auto-advance to next sequential code
    const isCodeTaken = requestedCode ? parties.some(p => p.code && p.code.trim() === requestedCode) : false;
    const resolvedCode = requestedCode && !isCodeTaken ? requestedCode : getNextPartyCode();
    const numVal = parseInt(resolvedCode.replace(/\D/g, ''), 10);
    if (!isNaN(numVal)) {
      issuedPartyCodeRef.current = Math.max(issuedPartyCodeRef.current, numVal);
    }
    const newParty: Party = {
      ...partyData,
      code: resolvedCode,
      groupName: resolvedGroupName,
      id: 'pty-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setParties(prev => [...prev, newParty]);

    addAuditLog({
      action: 'create',
      actionLabel: 'تعریف طرف حساب جدید',
      category: 'party',
      entityId: newParty.id,
      entityNumber: newParty.code,
      entityTitle: `${newParty.name} (${newParty.code})`,
      details: `ثبت طرف حساب جدید: ${newParty.name} با مانده ابتدایی ${newParty.balanceAFN.toLocaleString()} افغانی / ${newParty.balanceUSD.toLocaleString()} دالر`,
      newValue: JSON.stringify(newParty, null, 2),
    });

    notify('success', 'طرف حساب جدید با موفقیت ثبت شد', `${newParty.name} (${newParty.code})`);

    return newParty;
  };

  const updateParty = (id: string, partyData: Partial<Party>) => {
    const oldParty = parties.find(p => p.id === id);
    setParties(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        let resolvedGroupName = partyData.groupName ?? p.groupName;
        if (partyData.groupId !== undefined) {
          if (partyData.groupId) {
            const grp = partyGroups.find(g => g.id === partyData.groupId);
            resolvedGroupName = grp ? grp.name : undefined;
          } else {
            resolvedGroupName = undefined;
          }
        }
        return {
          ...p,
          ...partyData,
          groupName: resolvedGroupName,
        };
      })
    );

    if (oldParty) {
      addAuditLog({
        action: 'update',
        actionLabel: 'ویرایش طرف حساب',
        category: 'party',
        entityId: id,
        entityNumber: oldParty.code,
        entityTitle: `${partyData.name || oldParty.name} (${oldParty.code})`,
        details: `ویرایش مشخصات طرف حساب ${oldParty.name}`,
        previousValue: JSON.stringify(oldParty, null, 2),
        newValue: JSON.stringify({ ...oldParty, ...partyData }, null, 2),
      });

      notify('success', 'مشخصات طرف حساب به‌روزرسانی شد', partyData.name || oldParty.name);
    }
  };

  const deleteParty = (id: string) => {
    const p = parties.find(party => party.id === id);
    if (p) {
      addAuditLog({
        action: 'delete',
        actionLabel: 'حذف طرف حساب',
        category: 'party',
        entityId: id,
        entityNumber: p.code,
        entityTitle: `${p.name} (${p.code})`,
        details: `حذف طرف حساب ${p.name} با مانده حساب ${p.balanceAFN.toLocaleString()} افغانی و ${p.balanceUSD.toLocaleString()} دالر`,
        previousValue: JSON.stringify(p, null, 2),
      });

      notify('warning', 'طرف حساب از سیستم حذف شد', `${p.name} (${p.code})`);
    }
    setParties(prev => prev.filter(p => p.id !== id));
  };

  const updateExchangeRate = (newRate: number) => {
    setCashRegister(prev => ({ ...prev, usdToAfnRate: newRate }));
    setCurrencies(prev =>
      prev.map(c => (c.code === 'USD' ? { ...c, exchangeRateToAFN: newRate } : c))
    );
  };

  // Currencies CRUD
  const addCurrency = (currData: Omit<CurrencyDefinition, 'id' | 'createdAt'>): CurrencyDefinition => {
    const newCurr: CurrencyDefinition = {
      ...currData,
      id: 'curr-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setCurrencies(prev => [...prev, newCurr]);
    return newCurr;
  };

  const updateCurrency = (id: string, currData: Partial<CurrencyDefinition>) => {
    setCurrencies(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const updated = { ...c, ...currData };
        if (c.code === 'USD' && currData.exchangeRateToAFN !== undefined) {
          setCashRegister(cr => ({ ...cr, usdToAfnRate: currData.exchangeRateToAFN! }));
        }
        return updated;
      })
    );
  };

  const deleteCurrency = (id: string) => {
    const target = currencies.find(c => c.id === id);
    if (!target) return;
    if (target.isDefault || target.isBase) {
      notify('error', 'خطا در حذف ارز', 'ارزهای پیش‌فرض سیستم و ارز پایه قابل حذف نمی‌باشند.');
      return;
    }
    setCurrencies(prev => prev.filter(c => c.id !== id));
    notify('info', 'ارز حذف شد', `ارز «${target.name} (${target.code})» با موفقیت حذف گردید.`);
  };

  const getCurrencyByCode = (code: string): CurrencyDefinition | undefined => {
    return currencies.find(c => c.code.toUpperCase() === code.toUpperCase());
  };

  const baseCurrency = useMemo<CurrencyDefinition>(() => {
    const explicit = currencies.find(c => c.isBase);
    if (explicit) return explicit;
    const afn = currencies.find(c => c.code === 'AFN');
    if (afn) return afn;
    return currencies[0] || {
      id: 'curr-1',
      code: 'AFN',
      name: 'افغانی افغانستان',
      symbol: '؋',
      exchangeRateToAFN: 1,
      isBase: true,
    };
  }, [currencies]);

  const setBaseCurrency = (currencyIdOrCode: string) => {
    const target = currencies.find(
      c => c.id === currencyIdOrCode || c.code.toUpperCase() === currencyIdOrCode.toUpperCase()
    );
    if (!target) return;

    setCurrencies(prev =>
      prev.map(c => ({
        ...c,
        isBase: c.id === target.id,
      }))
    );
    notify('info', 'ارز اصلی محاسبات تغییر یافت', `ارز پایه سیستم: «${target.name} (${target.code})» به عنوان مبنای محاسبه سود و زیان تنظیم گردید.`);
  };

  const convertToBase = (amount: number, fromCurrencyCode: string): number => {
    if (!amount) return 0;
    const fromCode = (fromCurrencyCode || 'AFN').toUpperCase();
    const baseCode = (baseCurrency.code || 'AFN').toUpperCase();
    if (fromCode === baseCode) return amount;

    const fromDef = currencies.find(c => c.code.toUpperCase() === fromCode);
    const fromRateToAFN = fromDef?.exchangeRateToAFN ?? (fromCode === 'USD' ? (cashRegister.usdToAfnRate || 65) : 1);
    const baseRateToAFN = baseCurrency.exchangeRateToAFN ?? 1;

    if (baseRateToAFN <= 0) return amount;
    return (amount * fromRateToAFN) / baseRateToAFN;
  };

  const updateCashBalances = (afn: number, usd: number, exchangeUsd?: number) => {
    setCashRegister(prev => ({
      ...prev,
      afnBalance: afn,
      usdBalance: usd,
      exchangeUsdBalance: exchangeUsd !== undefined ? exchangeUsd : prev.exchangeUsdBalance,
    }));
  };

  // Helpers
  const getProductStock = (productId: string, warehouseId?: string) => {
    const relevant = stocks.filter(
      s => s.productId === productId && (!warehouseId || s.warehouseId === warehouseId)
    );
    const tons = relevant.reduce((acc, curr) => acc + curr.quantityTons, 0);
    const bags = relevant.reduce((acc, curr) => acc + curr.quantityBags, 0);
    return { tons, bags };
  };

  const getWarehouseStockDetails = (warehouseId: string) => {
    // Map all products to ensure we capture In-Stock (> 0), Out-of-Stock (=== 0), and Negative (< 0) items
    return products.map(prod => {
      const s = stocks.find(stk => stk.warehouseId === warehouseId && stk.productId === prod.id);
      const tons = s ? s.quantityTons : 0;
      const bags = s ? s.quantityBags : 0;
      return {
        product: prod,
        tons,
        bags,
      };
    });
  };

  const getPartySummary = (partyId: string) => {
    const party = parties.find(p => p.id === partyId);
    const partyInvoices = invoices.filter(inv => inv.partyId === partyId);
    const partyTxs = transactions.filter(tx => tx.partyId === partyId);
    return {
      party,
      invoices: partyInvoices,
      transactions: partyTxs,
    };
  };

  const calculateTotalStockValue = () => {
    let afnValue = 0;
    let usdValue = 0;
    let totalTons = 0;
    let totalBags = 0;

    stocks.forEach(s => {
      const prod = products.find(p => p.id === s.productId);
      if (prod) {
        totalTons += s.quantityTons;
        totalBags += s.quantityBags;
        afnValue += s.quantityTons * prod.buyPriceAFN;
        usdValue += s.quantityTons * prod.buyPriceUSD;
      }
    });

    return { afnValue, usdValue, totalTons, totalBags };
  };

  const getLowStockAlerts = (): LowStockAlertItem[] => {
    return products
      .map(prod => {
        const minThreshold =
          prod.minStockTons !== undefined && prod.minStockTons !== null
            ? prod.minStockTons
            : 5;
        const total = getProductStock(prod.id);
        const warehouseBreakdown = warehouses.map(w => {
          const wStock = getProductStock(prod.id, w.id);
          return {
            warehouseId: w.id,
            warehouseName: w.name,
            tons: wStock.tons,
            bags: wStock.bags,
          };
        });

        const isOutOfStock = total.tons <= 0;
        const isCritical = !isOutOfStock && total.tons <= minThreshold / 2;
        const isLow = !isOutOfStock && !isCritical && total.tons <= minThreshold;

        if (!isOutOfStock && !isCritical && !isLow) {
          return null;
        }

        const deficitTons = Math.max(0, parseFloat((minThreshold - total.tons).toFixed(3)));
        const bagsPerTon = prod.bagsPerTon || (1000 / (prod.bagWeightKg || 50));
        const deficitBags = Math.round(deficitTons * bagsPerTon);

        return {
          product: prod,
          currentStockTons: total.tons,
          currentStockBags: total.bags,
          minStockTons: minThreshold,
          deficitTons,
          deficitBags,
          status: isOutOfStock ? 'out_of_stock' : isCritical ? 'critical' : 'low',
          warehouseBreakdown,
        };
      })
      .filter((item): item is LowStockAlertItem => item !== null);
  };

  // Cash Accounts CRUD
  const addCashAccount = (accData: Omit<CashRegisterAccount, 'id' | 'createdAt'>): CashRegisterAccount => {
    const newAcc: CashRegisterAccount = {
      ...accData,
      id: 'csh-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setCashAccounts(prev => [...prev, newAcc]);
    return newAcc;
  };

  const updateCashAccount = (id: string, accData: Partial<CashRegisterAccount>) => {
    setCashAccounts(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, ...accData };
        // If balance changed on default accounts, also reflect in cashRegister
        if (accData.balance !== undefined) {
          if (id === 'afn_cash') setCashRegister(cr => ({ ...cr, afnBalance: accData.balance! }));
          if (id === 'usd_cash') setCashRegister(cr => ({ ...cr, usdBalance: accData.balance! }));
          if (id === 'exchange_usd_cash') setCashRegister(cr => ({ ...cr, exchangeUsdBalance: accData.balance! }));
        }
        return updated;
      })
    );
  };

  const deleteCashAccount = (id: string) => {
    setCashAccounts(prev => prev.filter(a => a.id !== id));
  };

  // Asset Groups CRUD
  const addAssetGroup = (groupData: Omit<AssetGroup, 'id' | 'createdAt'>): AssetGroup => {
    const newGroup: AssetGroup = {
      ...groupData,
      id: 'ag-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setAssetGroups(prev => [...prev, newGroup]);
    return newGroup;
  };

  const updateAssetGroup = (id: string, groupData: Partial<AssetGroup>) => {
    setAssetGroups(prev => prev.map(g => (g.id === id ? { ...g, ...groupData } : g)));
    if (groupData.name) {
      setFixedAssets(prev =>
        prev.map(a => (a.groupId === id ? { ...a, groupName: groupData.name! } : a))
      );
    }
  };

  const deleteAssetGroup = (id: string) => {
    setAssetGroups(prev => prev.filter(g => g.id !== id));
  };

  // Fixed Assets CRUD
  const addFixedAsset = (assetData: Omit<FixedAsset, 'id' | 'createdAt'>): FixedAsset => {
    let resolvedGroupName = assetData.groupName;
    if (assetData.groupId && !resolvedGroupName) {
      const grp = assetGroups.find(g => g.id === assetData.groupId);
      if (grp) resolvedGroupName = grp.name;
    }
    const newAsset: FixedAsset = {
      ...assetData,
      groupName: resolvedGroupName || 'عمومی',
      id: 'fa-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setFixedAssets(prev => [...prev, newAsset]);
    return newAsset;
  };

  const updateFixedAsset = (id: string, assetData: Partial<FixedAsset>) => {
    setFixedAssets(prev =>
      prev.map(a => {
        if (a.id !== id) return a;
        let resolvedGroupName = assetData.groupName ?? a.groupName;
        if (assetData.groupId !== undefined) {
          const grp = assetGroups.find(g => g.id === assetData.groupId);
          resolvedGroupName = grp ? grp.name : 'عمومی';
        }
        return {
          ...a,
          ...assetData,
          groupName: resolvedGroupName,
        };
      })
    );
  };

  const deleteFixedAsset = (id: string) => {
    setFixedAssets(prev => prev.filter(a => a.id !== id));
  };

  // Shareholders CRUD with automatic percentage calculation
  const recalculateSharePercentages = (list: Shareholder[]): Shareholder[] => {
    const rate = cashRegister.usdToAfnRate || 65;
    const totalUSD = list.reduce((acc, sh) => {
      const capUSD = sh.capitalUSD || 0;
      const capAFN = (sh.capitalAFN || 0) / rate;
      return acc + capUSD + capAFN;
    }, 0);

    return list.map(sh => {
      const shEquiv = (sh.capitalUSD || 0) + ((sh.capitalAFN || 0) / rate);
      const sharePercentage = totalUSD > 0 ? Number(((shEquiv / totalUSD) * 100).toFixed(2)) : 0;
      return { ...sh, sharePercentage };
    });
  };

  const addShareholder = (shData: Omit<Shareholder, 'id' | 'createdAt' | 'sharePercentage'>): Shareholder => {
    const newSh: Shareholder = {
      ...shData,
      id: 'sh-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-AF'),
    };
    setShareholders(prev => recalculateSharePercentages([...prev, newSh]));
    return newSh;
  };

  const updateShareholder = (id: string, shData: Partial<Shareholder>) => {
    setShareholders(prev => {
      const updated = prev.map(sh => (sh.id === id ? { ...sh, ...shData } : sh));
      return recalculateSharePercentages(updated);
    });
  };

  const deleteShareholder = (id: string) => {
    setShareholders(prev => recalculateSharePercentages(prev.filter(sh => sh.id !== id)));
  };

  // User Management CRUD & Security (مدیریت کاربران و امنیت سیستم)
  const login = (usernameOrId: string, passwordAttempt: string): { success: boolean; message?: string } => {
    const trimmedInput = usernameOrId.trim();
    let foundUser = users.find(
      u => u.id === trimmedInput || u.username.toLowerCase() === trimmedInput.toLowerCase() || u.name === trimmedInput
    );
    if (!foundUser && (trimmedInput.toLowerCase() === 'admin' || trimmedInput === 'مدیر' || trimmedInput === 'مدیر ارشد')) {
      foundUser = users[0];
    }
    if (!foundUser) {
      return { success: false, message: 'کاربری با این نام کاربری یافت نشد.' };
    }
    const isMatchingPassword = matchesUserPassword(foundUser.password, passwordAttempt);

    if (!isMatchingPassword) {
      return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
    }
    setCurrentUser(foundUser);
    setIsAuthenticated(true);
    sessionStorage.setItem(LOCAL_STORAGE_KEY + '_auth_session', 'true');
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY + '_is_authenticated');
    } catch {}
    localStorage.setItem(LOCAL_STORAGE_KEY + '_current_user', JSON.stringify(foundUser));
    notify('success', `خوش آمدید، جناب ${foundUser.name}`, `ورود به سیستم با سطح دسترسی ${foundUser.roleTitle} تأیید شد.`);
    return { success: true };
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(LOCAL_STORAGE_KEY + '_auth_session');
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY + '_is_authenticated');
    } catch {}
    notify('info', 'سیستم قفل شد', 'برای دسترسی مجدد، لطفاً نام کاربری و رمز عبور خود را وارد نمایید.');
  };

  const addUser = (userData: Omit<AppUser, 'id' | 'createdAt'>): AppUser => {
    const newUser: AppUser = {
      ...userData,
      password: userData.password?.trim() || '123',
      id: 'usr-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    notify('success', 'کاربر جدید ثبت شد', `کاربر «${newUser.name}» با رمز عبور تعیین‌شده ایجاد گردید.`);
    return newUser;
  };

  const updateUser = (id: string, userData: Partial<AppUser>) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...userData } : u)));
    if (currentUser.id === id) {
      setCurrentUser(prev => ({ ...prev, ...userData }));
    }
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (currentUser.id === id) {
      const fallback = users.find(u => u.id !== id) || initialUsers[0];
      setCurrentUser(fallback);
    }
  };

  // Document Printing Modal Helpers
  const openPrintModal = (docOrType: any, maybeData?: any) => {
    if (!docOrType) return;

    // 0. If docOrType itself is a React element
    if (React.isValidElement(docOrType) || (docOrType && (docOrType as any).$$typeof)) {
      setActivePrintDoc({
        type: 'custom',
        customContent: docOrType,
      });
      return;
    }

    // 1. If called with 2 arguments:
    // Case A: (titleString, jsxElement) or (titleString, { customContent })
    if (typeof docOrType === 'string') {
      if (React.isValidElement(maybeData) || (maybeData && (maybeData as any).$$typeof)) {
        setActivePrintDoc({
          type: 'custom',
          title: docOrType,
          customContent: maybeData,
        });
        return;
      }
      if (maybeData && maybeData.customContent) {
        setActivePrintDoc({
          type: 'custom',
          title: docOrType,
          ...maybeData,
        });
        return;
      }

      const typeStr = docOrType.toLowerCase();
      if (typeStr === 'invoice' || typeStr === 'buy' || typeStr === 'sell') {
        setActivePrintDoc({
          type: 'invoice',
          invoice: maybeData || {},
        });
        return;
      }
      if (typeStr === 'receipt' || typeStr === 'payment' || typeStr === 'transaction' || typeStr === 'payment_receipt' || typeStr === 'receive_payment' || typeStr === 'make_payment') {
        setActivePrintDoc({
          type: 'payment_receipt',
          transaction: maybeData || {},
        });
        return;
      }
      if (typeStr === 'stock_transfer') {
        setActivePrintDoc({
          type: 'stock_transfer',
          stockTransfer: maybeData || {},
        });
        return;
      }
      if (typeStr === 'consignment_delivery_slip' || typeStr === 'consignment' || typeStr === 'delivery_slip') {
        setActivePrintDoc({
          type: 'consignment_delivery_slip',
          consignmentDelivery: maybeData || {},
        });
        return;
      }
      if (typeStr === 'financial_report' || typeStr === 'report') {
        setActivePrintDoc({
          type: 'financial_report',
          ...(maybeData || {}),
        });
        return;
      }
      setActivePrintDoc({
        type: typeStr as any,
        title: docOrType,
        ...(maybeData || {}),
      });
      return;
    }

    // 2. If docOrType has customContent
    if (docOrType.customContent) {
      setActivePrintDoc({
        type: docOrType.type || (docOrType.documentType as any) || 'custom',
        ...docOrType,
      });
      return;
    }

    // 3. If passed an invoice object directly or wrapped
    if (docOrType.invoice || docOrType.invoiceNumber || docOrType.type === 'buy' || docOrType.type === 'sell' || docOrType.type === 'invoice') {
      const inv = docOrType.invoice || docOrType;
      setActivePrintDoc({
        type: 'invoice',
        invoice: inv,
        ...docOrType,
      });
      return;
    }

    // 4. If passed a transaction object directly or wrapped
    if (
      docOrType.transaction ||
      docOrType.transactionNumber ||
      docOrType.type === 'receive_payment' ||
      docOrType.type === 'make_payment' ||
      docOrType.type === 'transaction' ||
      docOrType.type === 'receipt' ||
      docOrType.type === 'payment' ||
      docOrType.type === 'payment_receipt' ||
      docOrType.type === 'cash_transfer'
    ) {
      const tx = docOrType.transaction || docOrType;
      setActivePrintDoc({
        type: 'payment_receipt',
        transaction: tx,
        ...docOrType,
      });
      return;
    }

    // 5. If passed a stock transfer directly or wrapped
    if (docOrType.stockTransfer || docOrType.transferNumber || docOrType.type === 'stock_transfer') {
      const trf = docOrType.stockTransfer || docOrType;
      setActivePrintDoc({
        type: 'stock_transfer',
        stockTransfer: trf,
        ...docOrType,
      });
      return;
    }

    // 5.5 If passed a consignment delivery slip directly or wrapped
    if (docOrType.consignmentDelivery || docOrType.type === 'consignment_delivery_slip') {
      const csg = docOrType.consignmentDelivery || docOrType;
      setActivePrintDoc({
        type: 'consignment_delivery_slip',
        consignmentDelivery: csg,
        ...docOrType,
      });
      return;
    }

    // 6. Default / Reports / Tables
    setActivePrintDoc({
      type: docOrType.type || (docOrType.documentType as any) || 'financial_report',
      ...docOrType,
    });
  };

  const closePrintModal = () => {
    setActivePrintDoc(null);
  };

  // Reset Strategies
  // 1. Reset completely to Initial Afghan Demo Business dataset
  const resetToDemoData = () => {
    setCompanySettings(initialCompanySettings);
    setProductCategories(initialProductCategories);
    setProducts(initialProducts);
    setWarehouses(initialWarehouses);
    setStocks(initialStocks);
    setParties(initialParties);
    setPartyGroups(initialPartyGroups);
    setInvoices(initialInvoices);
    setTransactions(initialTransactions);
    setTransfers(initialTransfers);
    setCurrencies(initialCurrencies);
    setCashAccounts(initialCashAccounts);
    setAssetGroups(initialAssetGroups);
    setFixedAssets(initialFixedAssets);
    setShareholders(initialShareholders);
    setCashRegister(initialCashRegister);
    setExpenseCategories(initialExpenseCategories);
    setExpenseDefinitions(initialExpenseDefinitions);
    setExpenses(initialExpenses);
    setIncomeCategories(initialIncomeCategories);
    setIncomes(initialIncomes);
    setUsers(initialUsers);
    setCurrentUser(initialUsers[0]);
    localStorage.clear();
  };

  // 2. Start a New Financial Year: Clears all invoices, transactions, transfers, resets customer balance to 0, preserves warehouse stock structure and products
  const resetNewFinancialYear = () => {
    setInvoices([]);
    setTransactions([]);
    setTransfers([]);
    setExpenses([]);
    setIncomes([]);
    setParties(prev => prev.map(p => ({ ...p, balanceAFN: 0, balanceUSD: 0 })));
    setCashAccounts(prev => prev.map(a => ({ ...a, balance: 0 })));
    setCashRegister(prev => ({
      ...prev,
      afnBalance: 0,
      usdBalance: 0,
      exchangeUsdBalance: 0,
    }));
  };

  // 3. Complete Blank Wipe: Fresh blank slate for a brand new enterprise
  const resetWipeCleanAll = () => {
    setProductCategories(initialProductCategories);
    setProducts([]);
    setWarehouses([
      {
        id: 'wh-main',
        code: '1',
        name: 'گدام اصلی تجارتی',
        location: 'هرات',
        type: 'standard',
        notes: 'گدام پیش‌فرض سیستم',
      },
    ]);
    setStocks([]);
    setParties([]);
    setPartyGroups([
      {
        id: 'grp-1',
        name: 'مشتریان عمومی',
        description: 'گروه پیش‌فرض طرف‌های حساب',
        color: 'emerald',
      },
    ]);
    setInvoices([]);
    setTransactions([]);
    setTransfers([]);
    setExpenseCategories(initialExpenseCategories);
    setExpenses([]);
    setIncomeCategories(initialIncomeCategories);
    setIncomes([]);
    setCurrencies(initialCurrencies);
    setCashAccounts([
      {
        id: 'usd_cash',
        name: 'صندوق شرکت دالری $',
        currency: 'USD',
        balance: 0,
        initialBalance: 0,
        isDefault: true,
        type: 'cash',
        accountNumber: 'CSH-USD-01',
      },
      {
        id: 'exchange_usd_cash',
        name: 'صندوق صرافی دالری $',
        currency: 'USD',
        balance: 0,
        initialBalance: 0,
        isDefault: true,
        type: 'exchange',
        accountNumber: 'EXC-USD-02',
      },
      {
        id: 'afn_cash',
        name: 'صندوق شرکت افغانی AFN',
        currency: 'AFN',
        balance: 0,
        initialBalance: 0,
        isDefault: true,
        type: 'cash',
        accountNumber: 'CSH-AFN-01',
      },
    ]);
    setAssetGroups([]);
    setFixedAssets([]);
    setShareholders([]);
    setCashRegister({
      afnBalance: 0,
      usdBalance: 0,
      exchangeUsdBalance: 0,
      usdToAfnRate: 65,
    });

    // Clear saved localStorage data so everything opens completely clean and blank
    const keysToWipe = [
      LOCAL_STORAGE_KEY + '_products',
      LOCAL_STORAGE_KEY + '_stocks',
      LOCAL_STORAGE_KEY + '_parties',
      LOCAL_STORAGE_KEY + '_invoices',
      LOCAL_STORAGE_KEY + '_transactions',
      LOCAL_STORAGE_KEY + '_transfers',
      LOCAL_STORAGE_KEY + '_expenses',
      LOCAL_STORAGE_KEY + '_incomes',
      LOCAL_STORAGE_KEY + '_cash_accounts',
      LOCAL_STORAGE_KEY + '_cash',
      LOCAL_STORAGE_KEY + '_fixed_assets',
      LOCAL_STORAGE_KEY + '_shareholders',
      LOCAL_STORAGE_KEY + '_warehouses',
    ];
    keysToWipe.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (err) {
        // ignore
      }
    });
  };

  const exportJSON = () => {
    const payload = {
      companySettings,
      users,
      currentUser,
      productCategories,
      products,
      warehouses,
      stocks,
      parties,
      partyGroups,
      invoices,
      transactions,
      transfers,
      consignmentMovements,
      expenseCategories,
      expenseDefinitions,
      expenses,
      incomeCategories,
      incomes,
      currencies,
      cashAccounts,
      assetGroups,
      fixedAssets,
      shareholders,
      cashRegister,
      exportDate: new Date().toISOString(),
      systemVersion: '2.5',
    };
    return JSON.stringify(payload, null, 2);
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (data.products && data.warehouses) {
        if (data.companySettings) {
          setCompanySettings(data.companySettings);
        }
        if (data.productCategories) setProductCategories(data.productCategories);
        setProducts(data.products || []);
        setWarehouses(data.warehouses || []);
        setStocks(data.stocks || []);
        setParties(data.parties || []);
        setPartyGroups(data.partyGroups || initialPartyGroups);
        setInvoices(data.invoices || []);
        setTransactions(data.transactions || []);
        setTransfers(data.transfers || []);
        if (data.consignmentMovements) setConsignmentMovements(data.consignmentMovements);
        if (data.expenseCategories) setExpenseCategories(data.expenseCategories);
        if (data.expenseDefinitions) setExpenseDefinitions(data.expenseDefinitions);
        if (data.expenses) setExpenses(data.expenses);
        if (data.incomeCategories) setIncomeCategories(data.incomeCategories);
        if (data.incomes) setIncomes(data.incomes);
        setCurrencies(data.currencies || initialCurrencies);
        setCashAccounts(data.cashAccounts || initialCashAccounts);
        setAssetGroups(data.assetGroups || initialAssetGroups);
        setFixedAssets(data.fixedAssets || initialFixedAssets);
        setShareholders(data.shareholders || initialShareholders);
        setCashRegister(data.cashRegister || initialCashRegister);
        if (data.users && data.users.length > 0) {
          setUsers(data.users);
          setCurrentUser(data.currentUser || data.users[0]);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AccountingContext.Provider
      value={{
        companySettings,
        updateCompanySettings,
        resetCompanySettings,
        appFontSize,
        setAppFontSize,
        fontSizeNumber,
        setFontSizeNumber,
        products,
        productCategories,
        addProductCategory,
        updateProductCategory,
        deleteProductCategory,
        getNextProductCode,
        warehouses,
        stocks,
        parties,
        partyGroups,
        getNextPartyCode,
        invoices,
        transactions,
        transfers,
        cashRegister,
        expenses,
        expenseCategories,
        expenseDefinitions,
        createExpense,
        updateExpense,
        deleteExpense,
        addExpenseCategory,
        updateExpenseCategory,
        deleteExpenseCategory,
        addExpenseDefinition,
        updateExpenseDefinition,
        deleteExpenseDefinition,
        incomes,
        incomeCategories,
        createIncome,
        updateIncome,
        deleteIncome,
        addIncomeCategory,
        updateIncomeCategory,
        deleteIncomeCategory,
        getNextIncomeNumber,
        currencies,
        baseCurrency,
        setBaseCurrency,
        convertToBase,
        addCurrency,
        updateCurrency,
        deleteCurrency,
        getCurrencyByCode,
        cashAccounts,
        addCashAccount,
        updateCashAccount,
        deleteCashAccount,
        assetGroups,
        addAssetGroup,
        updateAssetGroup,
        deleteAssetGroup,
        fixedAssets,
        addFixedAsset,
        updateFixedAsset,
        deleteFixedAsset,
        shareholders,
        addShareholder,
        updateShareholder,
        deleteShareholder,
        users,
        currentUser,
        setCurrentUser,
        addUser,
        updateUser,
        deleteUser,
        isAuthenticated,
        login,
        logout,
        addPartyGroup,
        updatePartyGroup,
        deletePartyGroup,
        activePrintDoc,
        openPrintModal,
        closePrintModal,
        auditLogs,
        addAuditLog,
        clearAuditLogs,
        notifications,
        notify,
        removeNotification,
        getNextInvoiceNumber,
        getNextTransactionNumber,
        getNextTransferNumber,
        getNextExpenseNumber,
        getNextConsignmentDocNumber,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        createStockTransfer,
        updateStockTransfer,
        deleteStockTransfer,
        consignmentMovements,
        createConsignmentMovement,
        updateConsignmentMovement,
        deleteConsignmentMovement,
        getCustomerConsignmentBalances,
        addProduct,
        updateProduct,
        deleteProduct,
        addWarehouse,
        updateWarehouse,
        deleteWarehouse,
        addParty,
        updateParty,
        deleteParty,
        updateExchangeRate,
        updateCashBalances,
        getProductStock,
        getWarehouseStockDetails,
        getPartySummary,
        calculateTotalStockValue,
        getLowStockAlerts,
        resetToDemoData,
        resetNewFinancialYear,
        resetWipeCleanAll,
        exportJSON,
        importJSON,
      }}
    >
      {children}
    </AccountingContext.Provider>
  );
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider');
  }
  return context;
};

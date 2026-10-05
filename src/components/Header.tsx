import React, { useState, useEffect, useRef } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { useTheme } from '../context/ThemeContext';
import {
  Building2,
  Menu,
  Lock,
  Cloud,
  Database,
  Bell,
  Search,
  Maximize2,
  Minimize2,
  Calendar,
  Clock as ClockIcon,
  ChevronDown,
  User,
  ShieldCheck,
  FileText,
  Boxes,
  Users,
  Wallet,
  X,
  Sparkles,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { ThemeSwitcherDropdown } from './ThemeSwitcherDropdown';
import { CurrencyRateCalculator } from './CurrencyRateCalculator';
import { APP_VERSION } from '../config/version';
import { getPersianDate } from '../utils/formatters';

interface HeaderProps {
  activeTab: NavTab;
  onOpenNewInvoice: (type?: 'buy' | 'sell') => void;
  onOpenPaymentModal: (type?: 'receive_payment' | 'make_payment' | 'cash_transfer' | 'currency_exchange') => void;
  onOpenAccessModal?: (tab?: 'roles' | 'reset' | 'backup' | 'company' | 'telegram') => void;
  onOpenTelegramModal?: () => void;
  onOpenDataBackupModal?: () => void;
  onOpenTelegramPendingModal?: () => void;
  telegramPendingCount?: number;
  telegramPendingPhone?: string;
  telegramPendingName?: string;
  onToggleSidebar?: () => void;
  onSelectNavTab?: (tab: NavTab, filter?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenNewInvoice,
  onOpenPaymentModal,
  onOpenAccessModal,
  onOpenTelegramModal,
  onOpenDataBackupModal,
  onOpenTelegramPendingModal,
  telegramPendingCount = 0,
  telegramPendingPhone = '',
  telegramPendingName = '',
  onToggleSidebar,
  onSelectNavTab,
}) => {
  const { currentUser, companySettings, logout, invoices, parties, products } = useAccounting();
  const { theme } = useTheme();

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Live Time
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Global Quick Search Bar (Like NovaTech shell-search)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Filter items matching query
  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    const matchedInvoices = invoices
      .filter(inv => inv.invoiceNumber?.toLowerCase().includes(q) || inv.partyName?.toLowerCase().includes(q))
      .slice(0, 4);

    const matchedParties = parties
      .filter(p => p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.code?.includes(q))
      .slice(0, 4);

    const matchedProducts = products
      .filter(pr => pr.name?.toLowerCase().includes(q) || pr.code?.includes(q))
      .slice(0, 4);

    return {
      invoices: matchedInvoices,
      parties: matchedParties,
      products: matchedProducts,
      total: matchedInvoices.length + matchedParties.length + matchedProducts.length,
    };
  }, [searchQuery, invoices, parties, products]);

  // User Profile Dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const headerBgClass =
    theme === 'executive'
      ? 'bg-gradient-to-r from-[#070b14] via-[#111a2e] to-[#070b14] border-b border-amber-500/30'
      : theme === 'dark'
      ? 'bg-slate-900 border-b border-slate-800'
      : theme === 'gold'
      ? 'bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950 border-b border-amber-500/40'
      : 'bg-gradient-to-r from-[#087bbd] via-[#076fa9] to-[#056ca9] border-b border-blue-900/40 text-white';

  return (
    <header
      id="shell-header-main"
      className={`h-16 ${headerBgClass} flex items-center justify-between px-3 sm:px-5 shrink-0 z-30 font-sans select-none text-white shadow-md relative`}
      dir="rtl"
    >
      {/* ---------------- RIGHT: Menu Button, Brand & Global Search ---------------- */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-9 h-9 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 rounded-xl transition cursor-pointer border border-white/20"
            aria-label="باز و بسته کردن منو"
            title="منوی اصلی سیستم"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Brand & Wordmark (NovaTech Style) */}
        <button
          type="button"
          onClick={() => onOpenAccessModal && onOpenAccessModal('company')}
          className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-white/10 rounded-xl transition cursor-pointer group text-right"
          title="مشخصات شرکت و تنظیمات سیستم"
        >
          <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
            {companySettings.logoUrl ? (
              <img src={companySettings.logoUrl} alt="لوگو" className="w-full h-full object-contain rounded-md" />
            ) : (
              <Building2 className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="flex flex-col text-right leading-tight max-w-[180px] sm:max-w-[240px]">
            <span className="text-xs sm:text-sm font-black text-white group-hover:text-amber-200 transition truncate">
              {companySettings.name || 'شرکت تجارتی برادران نبوی'}
            </span>
            <span className="text-[9.5px] text-white/80 font-medium tracking-tight truncate">
              {companySettings.slogan || 'دیتابس جامع مدیریت حسابداری و گدام'}
            </span>
          </div>
        </button>

        {/* Global Instant Search Bar (NovaTech shell-search) */}
        <div ref={searchContainerRef} className="relative hidden md:block w-64 lg:w-80">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="جستجوی سریع فاکتور، کالا، مشتری..."
              className="w-full pl-8 pr-9 py-1.5 bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-slate-900 border border-white/25 focus:border-white rounded-xl text-xs placeholder:text-white/60 outline-none transition shadow-inner font-sans"
            />
            <Search className="w-4 h-4 text-white/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchResults && (
            <div className="absolute top-full mt-2 w-80 lg:w-96 right-0 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn max-h-96 overflow-y-auto font-sans">
              {searchResults.total === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  موردی مطابق با عبارت «{searchQuery}» یافت نشد.
                </div>
              ) : (
                <>
                  {searchResults.invoices.length > 0 && (
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">فاکتورها:</span>
                      {searchResults.invoices.map(inv => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(false);
                            setSearchQuery('');
                            onSelectNavTab?.('trade_hub', inv.type === 'buy' ? 'buy' : 'sell');
                          }}
                          className="w-full text-right p-1.5 hover:bg-sky-50 rounded-lg flex items-center justify-between text-xs transition cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-bold font-mono">#{inv.invoiceNumber}</span>
                            <span className="text-slate-600 truncate max-w-[130px]">{inv.partyName}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{inv.totalAmount?.toLocaleString()} {inv.currency}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.parties.length > 0 && (
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">مشتریان و طرف‌های حساب:</span>
                      {searchResults.parties.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(false);
                            setSearchQuery('');
                            onSelectNavTab?.('customers');
                          }}
                          className="w-full text-right p-1.5 hover:bg-sky-50 rounded-lg flex items-center justify-between text-xs transition cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-bold">{p.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{p.phone || '---'}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.products.length > 0 && (
                    <div className="px-3 py-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">کالا و اجناس:</span>
                      {searchResults.products.map(pr => (
                        <button
                          key={pr.id}
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(false);
                            setSearchQuery('');
                            onSelectNavTab?.('products');
                          }}
                          className="w-full text-right p-1.5 hover:bg-sky-50 rounded-lg flex items-center justify-between text-xs transition cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-amber-600" />
                            <span className="font-bold">{pr.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{pr.code || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- LEFT: Date, Rates, Telegram, Tools, User ---------------- */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Live Shamsi Hijri Date & Clock Pill */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/15 rounded-xl text-xs font-mono font-medium text-white/90">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-200" />
            <span>{getPersianDate()}</span>
          </div>
          <span className="text-white/40">|</span>
          <div className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5 text-blue-200" />
            <span>{currentTime}</span>
          </div>
        </div>

        {/* Currency Rate Calculator Icon */}
        <CurrencyRateCalculator minimal />

        {/* Telegram Pending Approvals Alert Pill */}
        {telegramPendingCount > 0 && (
          <button
            type="button"
            id="header-btn-telegram-pending-alert"
            onClick={onOpenTelegramPendingModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md animate-pulse cursor-pointer transition active:scale-95 border border-amber-300"
            title="برای مشاهده و تایید حساب مشتری کلیک کنید"
          >
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {telegramPendingName
                ? `درخواست تلگرام: ${telegramPendingName}`
                : telegramPendingPhone
                ? `مشتری ${telegramPendingPhone}`
                : `${telegramPendingCount} مشتری در انتظار`}
            </span>
            <span className="sm:hidden">{telegramPendingCount}</span>
          </button>
        )}

        {/* Quick Data Backup Button */}
        <button
          type="button"
          id="header-btn-data-backup"
          onClick={onOpenDataBackupModal}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
          title="پشتیبان‌گیری و بازیابی اطلاعات دیتابیس"
          aria-label="پشتیبان داده‌ها"
        >
          <Database className="w-4 h-4" />
        </button>

        {/* Google Drive Cloud Button */}
        <button
          type="button"
          id="header-btn-google-drive"
          onClick={() => onOpenAccessModal && onOpenAccessModal('backup')}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
          title="پشتیبان‌گیری ابری گوگل درایو"
          aria-label="گوگل درایو"
        >
          <Cloud className="w-4 h-4" />
        </button>

        {/* Telegram Bot Management Button */}
        <button
          type="button"
          id="header-btn-telegram"
          onClick={() => (telegramPendingCount > 0 && onOpenTelegramPendingModal) ? onOpenTelegramPendingModal() : (onOpenTelegramModal ? onOpenTelegramModal() : onOpenAccessModal?.('telegram'))}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-sky-200 hover:text-white border border-white/20 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95 relative"
          title="ربات تلگرام و استعلام آنلاین مشتریان"
          aria-label="ربات تلگرام"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z" />
          </svg>
          {telegramPendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black flex items-center justify-center animate-bounce shadow-md">
              {telegramPendingCount}
            </span>
          )}
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
          title={isFullscreen ? 'خروج از تمام‌صفحه' : 'حالت تمام‌صفحه'}
          aria-label="تمام صفحه"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Minimal Theme Switcher Dropdown */}
        <ThemeSwitcherDropdown minimal />

        {/* User Profile Badge & Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            id="header-btn-user-profile"
            type="button"
            onClick={() => setIsProfileOpen(prev => !prev)}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/25 text-xs font-bold transition shadow-xs cursor-pointer"
            title={`کاربر جاری: ${currentUser?.name || 'admin'}`}
          >
            <div className={`w-6 h-6 rounded-lg ${currentUser?.avatarColor || 'bg-amber-500'} text-white flex items-center justify-center text-[10px] font-black shadow-xs ring-1 ring-white/50 shrink-0`}>
              {(currentUser?.name || 'A').slice(0, 1)}
            </div>
            <span className="text-xs font-black text-white hidden md:inline truncate max-w-[90px]">
              {currentUser?.name || 'admin'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-white/70" />
          </button>

          {isProfileOpen && (
            <div className="absolute top-full mt-2 left-0 w-56 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fadeIn font-sans">
              <div className="px-4 py-2 border-b border-slate-100">
                <span className="text-xs font-black text-slate-900 block truncate">{currentUser?.name || 'مدیر سیستم'}</span>
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  {currentUser?.roleTitle || 'مدیر ارشد (Admin)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  onOpenAccessModal?.('roles');
                }}
                className="w-full text-right px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>مدیریت کاربران و دسترسی‌ها</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  onOpenAccessModal?.('company');
                }}
                className="w-full text-right px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>مشخصات شرکت و سیستم</span>
              </button>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full text-right px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4 text-rose-500" />
                  <span>خروج از حساب (Logout)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Direct Lock / Logout Button */}
        <button
          type="button"
          id="header-btn-logout"
          onClick={logout}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-600/80 text-white/90 hover:text-white border border-white/20 hover:border-rose-400/50 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
          title="خروج از حساب و قفل برنامه"
          aria-label="قفل برنامه"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};


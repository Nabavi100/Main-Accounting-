import React from 'react';
import { useAccounting } from '../context/AccountingContext';
import {
  Building2,
  Menu,
  Lock,
  Cloud,
  Database,
  Bell,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { ThemeSwitcherDropdown } from './ThemeSwitcherDropdown';
import { CurrencyRateCalculator } from './CurrencyRateCalculator';
import { APP_VERSION } from '../config/version';

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
  onToggleSidebar?: () => void;
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
  onToggleSidebar,
}) => {
  const { currentUser, companySettings, logout } = useAccounting();

  return (
    <header className="h-16 bg-gradient-to-r from-[#0B1120] via-[#161F33] to-[#0B1120] border-b border-amber-500/25 flex items-center justify-between px-3 sm:px-6 shrink-0 z-10 font-sans select-none text-white shadow-lg" dir="rtl">
      {/* Right side: Menu button, Company Brand & Sleek Currency Rate Icon Button */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer border border-slate-700/60"
            aria-label="باز و بسته کردن منو"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Executive Company Wordmark Pill */}
        <button
          type="button"
          onClick={() => onOpenAccessModal && onOpenAccessModal('company')}
          className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700/90 border border-amber-400/30 rounded-xl shadow-xs transition cursor-pointer max-w-[220px] sm:max-w-none group"
          title="مشخصات و تنظیمات شرکت"
        >
          <div className="w-7 h-7 rounded-lg ring-1 ring-amber-400/50 p-0.5 bg-slate-950 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            {companySettings.logoUrl ? (
              <img src={companySettings.logoUrl} alt="لوگو" className="w-full h-full object-contain rounded-md" />
            ) : (
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
            )}
          </div>
          <div className="flex flex-col text-right leading-tight">
            <span className="text-xs font-black text-amber-100 group-hover:text-white transition truncate">
              {companySettings.name || 'شرکت تجارتی برادران نبوی'}
            </span>
            <span className="text-[9px] text-amber-300/80 font-bold tracking-tight">
              سامانه رسمی مدیریت بازرگانی
            </span>
          </div>
        </button>

        {/* System Version Badge */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 text-amber-300 rounded-lg text-[10px] font-mono font-bold border border-amber-500/30 shadow-2xs select-none"
          title="نسخه فعال سیستم بازرگانی"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{APP_VERSION}</span>
        </span>

        {/* Minimal Chic Currency Rate Icon Button */}
        <CurrencyRateCalculator minimal />

        {/* Telegram Pending Approval Live Alert Pill */}
        {telegramPendingCount > 0 && (
          <button
            type="button"
            id="header-btn-telegram-pending-alert"
            onClick={onOpenTelegramPendingModal}
            className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md animate-pulse cursor-pointer transition active:scale-95 border border-amber-300"
            title="برای مشاهده و اتصال به حساب مشتری کلیک کنید"
          >
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[280px]">
              {telegramPendingPhone
                ? `مشتری با شماره ${telegramPendingPhone} منتظر تایید است`
                : `${telegramPendingCount} مشتری تلگرام منتظر تایید`}
            </span>
          </button>
        )}
      </div>

      {/* Left side: Minimal Chic Action Icons (Backup, Google Drive, Telegram, Theme, User, Lock) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Data Backup & Restore Button (پشتیبان‌گیری، ارسال دیتا به هوش مصنوعی و بازیابی) */}
        <button
          type="button"
          id="header-btn-data-backup"
          onClick={onOpenDataBackupModal}
          className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 border border-slate-700/80 hover:border-emerald-500/40 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
          title="پشتیبان‌گیری، ارسال دیتا به چت و بازیابی اطلاعات"
          aria-label="پشتیبان داده‌ها"
        >
          <Database className="w-4 h-4" />
        </button>

        {/* Sleek Google Drive Cloud Backup Icon Button */}
        <button
          type="button"
          id="header-btn-google-drive"
          onClick={() => onOpenAccessModal && onOpenAccessModal('backup')}
          className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-blue-950/80 text-blue-400 hover:text-blue-300 border border-slate-700/80 hover:border-blue-500/40 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
          title="پشتیبان‌گیری ابری و تنظیمات گوگل درایو"
          aria-label="گوگل درایو"
        >
          <Cloud className="w-4 h-4" />
        </button>

        {/* Sleek Official Telegram Bot Icon Button */}
        <button
          type="button"
          id="header-btn-telegram"
          onClick={() => (telegramPendingCount > 0 && onOpenTelegramPendingModal) ? onOpenTelegramPendingModal() : (onOpenTelegramModal ? onOpenTelegramModal() : onOpenAccessModal?.('telegram'))}
          className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-sky-950/80 text-[#38bdf8] hover:text-[#7dd3fc] border border-slate-700/80 hover:border-sky-500/40 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95 relative"
          title={telegramPendingCount > 0 ? `${telegramPendingCount} مشتری در انتظار تأیید - کلیک برای اتصال` : 'مدیریت تلگرام و ارتباط با مشتریان'}
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

        {/* Minimal Theme Switcher Icon Button */}
        <ThemeSwitcherDropdown minimal />

        {/* Sleek User Profile Badge */}
        <button
          id="header-btn-user-profile"
          type="button"
          onClick={() => onOpenAccessModal && onOpenAccessModal('roles')}
          className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 rounded-xl border border-amber-500/30 text-xs font-bold transition shadow-xs cursor-pointer"
          title={`کاربر جاری: ${currentUser?.name || 'مدیر کل'} (${currentUser?.roleTitle || 'مدیر سیستم'}) - کلیک جهت مدیریت کاربران`}
        >
          <div className={`w-6 h-6 rounded-lg ${currentUser?.avatarColor || 'bg-amber-600'} text-white flex items-center justify-center text-[10px] font-black shadow-xs ring-1 ring-amber-400/50 shrink-0`}>
            {(currentUser?.name || 'مدیر').slice(0, 2)}
          </div>
          <span className="text-xs font-black text-slate-100 hidden md:inline truncate max-w-[100px]">
            {currentUser?.name || 'مدیر سیستم'}
          </span>
        </button>

        {/* Sleek Lock Screen / Logout Icon Button */}
        <button
          type="button"
          id="header-btn-logout"
          onClick={logout}
          className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
          title="خروج از حساب و قفل سیستم"
          aria-label="قفل برنامه"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

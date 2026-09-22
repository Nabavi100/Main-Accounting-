import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { formatNumber } from '../utils/formatters';
import {
  TrendingUp,
  Building2,
  Menu,
  RefreshCw,
  Lock,
  Coins,
  Cloud,
  Send,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { ThemeSwitcherDropdown } from './ThemeSwitcherDropdown';
import { CurrencyRateCalculator } from './CurrencyRateCalculator';

interface HeaderProps {
  activeTab: NavTab;
  onOpenNewInvoice: (type?: 'buy' | 'sell') => void;
  onOpenPaymentModal: (type?: 'receive_payment' | 'make_payment' | 'cash_transfer' | 'currency_exchange') => void;
  onOpenAccessModal?: (tab?: 'roles' | 'reset' | 'backup' | 'company' | 'telegram') => void;
  onOpenTelegramModal?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenNewInvoice,
  onOpenPaymentModal,
  onOpenAccessModal,
  onOpenTelegramModal,
  onToggleSidebar,
}) => {
  const { cashRegister, updateExchangeRate, currentUser, companySettings, baseCurrency, logout } = useAccounting();
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(cashRegister.usdToAfnRate.toString());

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(rateInput);
    if (!isNaN(val) && val > 0) {
      updateExchangeRate(val);
      setIsEditingRate(false);
    }
  };

  return (
    <header className="h-16 bg-[#F8FAFC] border-b border-slate-200/70 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 font-sans select-none" dir="rtl">
      {/* Right side: Company Header Pill Badge (Matching IMG-20260903-WA0001.jpg) */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            aria-label="باز و بسته کردن منو"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Rounded company badge matching screenshot */}
        <button
          type="button"
          onClick={() => onOpenAccessModal && onOpenAccessModal('company')}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full shadow-2xs transition cursor-pointer"
          title="مشخصات و تنظیمات لوگوی شرکت"
        >
          {companySettings.logoUrl ? (
            <img src={companySettings.logoUrl} alt="لوگو" className="w-4 h-4 object-contain rounded-full" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
          )}
          <span className="text-xs font-bold text-[#2563EB] truncate">
            {companySettings.name || 'شرکت تجارتی برادران نبوی'}
          </span>
        </button>

        {/* Base Currency Pill */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white border border-emerald-200/80 text-emerald-800 rounded-full text-xs shadow-2xs"
          title="ارز مبنای محاسبه سود و زیان"
        >
          <Coins className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] text-slate-500 font-medium">ارز مبنای سود:</span>
          <span className="text-[11px] font-black text-emerald-700 font-mono">
            {baseCurrency.code} ({baseCurrency.name})
          </span>
        </div>

        {/* Exchange Rate Mini Badge */}
        <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200/80 px-2.5 py-1 rounded-full text-xs shadow-2xs">
          <TrendingUp className="w-3 h-3 text-[#2563EB]" />
          <span className="text-[11px] text-slate-500 font-medium">اسعار:</span>
          {isEditingRate ? (
            <form onSubmit={handleSaveRate} className="flex items-center gap-1">
              <span className="text-slate-700 font-bold text-xs">$1=</span>
              <input
                type="number"
                step="0.1"
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                className="w-14 px-1 py-0.5 border border-blue-500 rounded bg-white text-slate-900 text-xs font-bold text-center outline-none"
                autoFocus
              />
              <span className="text-slate-700 font-bold text-xs">AFN</span>
              <button
                type="submit"
                className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer transition"
              >
                ثبت
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRateInput(cashRegister.usdToAfnRate.toString());
                setIsEditingRate(true);
              }}
              className="flex items-center gap-1 font-bold text-slate-800 text-[11px] cursor-pointer hover:text-blue-600 transition"
              title="برای تغییر نرخ کلیک کنید"
            >
              <span>$۱ = {formatNumber(cashRegister.usdToAfnRate)} AFN</span>
              <RefreshCw className="w-2.5 h-2.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Quick Currency Rate Calculator */}
        <CurrencyRateCalculator />
      </div>

      {/* Left side: Theme switcher, Google Drive backup pill, User profile pill & Lock button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Google Drive Cloud Backup Pill */}
        <button
          type="button"
          onClick={() => onOpenAccessModal && onOpenAccessModal('backup')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full border border-slate-200/90 text-xs font-bold transition shadow-2xs cursor-pointer"
          title="پشتیبان‌گیری ابری و تنظیمات گوگل درایو"
        >
          <Cloud className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[11px]">گوگل درایو</span>
        </button>

        {/* Quick Telegram Bot Pill */}
        <button
          type="button"
          onClick={() => (onOpenAccessModal ? onOpenAccessModal('telegram') : onOpenTelegramModal?.())}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-sky-50 text-slate-700 hover:text-[#229ED9] rounded-full border border-slate-200/90 text-xs font-bold transition shadow-2xs cursor-pointer"
          title="تنظیمات محرمانه ربات تلگرام و ارسال حسابات مشتریان (محافظت‌شده با رمز مدیر)"
        >
          <Send className="w-3.5 h-3.5 text-[#229ED9] -rotate-45" />
          <span className="text-[11px]">ربات تلگرام</span>
          <Lock className="w-2.5 h-2.5 text-amber-500" />
        </button>

        {/* Theme Manager Dropdown */}
        <ThemeSwitcherDropdown />

        {/* User Profile Pill */}
        <button
          id="header-btn-user-profile"
          type="button"
          onClick={() => onOpenAccessModal && onOpenAccessModal('roles')}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-white hover:bg-slate-50 text-slate-800 rounded-full border border-slate-200/90 text-xs font-bold transition shadow-2xs cursor-pointer"
          title="مدیریت دسترسی و کاربران سیستم"
        >
          <div className={`w-7 h-7 rounded-full ${currentUser?.avatarColor || 'bg-[#2563EB]'} text-white flex items-center justify-center text-[11px] font-black shadow-2xs shrink-0`}>
            {(currentUser?.name || 'مدیر').slice(0, 2)}
          </div>
          <div className="flex flex-col text-right leading-tight hidden sm:flex">
            <span className="text-xs font-black text-slate-900">
              {currentUser?.name || 'مدیر کل سیستم'}
            </span>
            <span className="text-[9.5px] text-slate-500 font-medium">
              {currentUser?.roleTitle || 'مدیر سیستم'}
            </span>
          </div>
        </button>

        {/* Lock Screen / Logout Button */}
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/90 hover:border-rose-200 rounded-full text-xs font-bold transition cursor-pointer shadow-2xs"
          title="خروج از حساب و قفل سیستم"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden md:inline">قفل برنامه</span>
        </button>
      </div>
    </header>
  );
};

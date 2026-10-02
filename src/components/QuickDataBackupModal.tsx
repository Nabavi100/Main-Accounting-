import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import {
  Download,
  Upload,
  Copy,
  Check,
  Database,
  X,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { getPersianDate } from '../utils/formatters';

interface QuickDataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickDataBackupModal: React.FC<QuickDataBackupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { exportJSON, importJSON, notify, invoices, transactions, parties, products } = useAccounting();
  const [copied, setCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isRestoring, setIsRestoring] = useState(false);

  if (!isOpen) return null;

  // Handle Copy to Clipboard for Chat
  const handleCopyToClipboard = async () => {
    try {
      const dataStr = exportJSON();
      await navigator.clipboard.writeText(dataStr);
      setCopied(true);
      notify(
        'success',
        'اطلاعات در کلیپ‌بورد کپی شد',
        'اکنون می‌توانید در کادر پیام خود در چت Paste (Ctrl+V) کنید تا بررسی و اعمال شود.'
      );
      setTimeout(() => setCopied(false), 4000);
    } catch {
      notify('error', 'خطا در کپی', 'امکان دسترسی خودکار به کلیپ‌بورد نبود، لطفاً فایل را دانلود کنید.');
    }
  };

  // Handle Download JSON File
  const handleDownloadFile = () => {
    try {
      const dataStr = exportJSON();
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hesabdar_data_backup_${getPersianDate().replace(/\//g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify('success', 'دانلود فایل پشتیبان', 'فایل دیتابیس با موفقیت دانلود و ذخیره شد.');
    } catch (e: any) {
      notify('error', 'خطا در دانلود فایل', e?.message);
    }
  };

  // Handle File Upload Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteInput(text);
      }
    };
    reader.readAsText(file);
  };

  // Handle Restore
  const handleApplyRestore = () => {
    if (!pasteInput.trim()) {
      notify('warning', 'متن یا فایل خالی است', 'لطفاً ابتدا کد JSON یا فایل پشتیبان را وارد فرمایید.');
      return;
    }

    if (!window.confirm('آیا از بازیابی اطلاعات اطمینان دارید؟ داده‌های فعلی با نسخه ورودی جایگزین خواهند شد.')) {
      return;
    }

    setIsRestoring(true);
    try {
      const success = importJSON(pasteInput);
      if (success) {
        notify('success', 'بازیابی موفق اطلاعات', 'کلیه اطلاعات مالی، فاکتورها و تراکنش‌ها با موفقیت بازیابی شد.');
        onClose();
      } else {
        notify('error', 'خطا در ساختار داده‌ها', 'فایل یا متن ارسالی ساختار معتبر سیستم حسابداری را ندارد.');
      }
    } catch (err: any) {
      notify('error', 'خطا در بازیابی', err?.message || 'خطای ناشناخته');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                پشتیبان‌گیری و ارسال داده‌های سیستم
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                ارسال آسان دیتا به چت هوش مصنوعی جهت بازبینی، یا دانلود و بازیابی نسخه‌های قبلی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition cursor-pointer"
            title="بستن (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100 p-1.5 gap-1 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-blue-700 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>ارسال و خروجی دیتا (جهت ارسال به چت)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-emerald-700 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>بازیابی اطلاعات قبلی (Restore)</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              {/* Summary Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs">
                <div>
                  <span className="text-slate-500 block">فاکتورها</span>
                  <strong className="text-slate-900 font-mono text-sm">{invoices.length} عدد</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">تراکنش‌های مالی</span>
                  <strong className="text-slate-900 font-mono text-sm">{transactions.length} عدد</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">مشتریان و طرف‌حساب</span>
                  <strong className="text-slate-900 font-mono text-sm">{parties.length} نفر</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">اقلام و کالاها</span>
                  <strong className="text-slate-900 font-mono text-sm">{products.length} قلم</strong>
                </div>
              </div>

              {/* Method 1: Instant Copy to Clipboard */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2.5 text-blue-950 font-black text-sm">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Copy className="w-4 h-4" />
                  </div>
                  <span>روش اول (سریع‌ترین): کپی مستقیم برای ارسال در چت</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  با کلیک روی دکمه زیر، تمام اطلاعات ثبت‌شده سیستم کپی می‌شود. سپس کافیست در کادر چت با دستیار هوش مصنوعی راست‌کلیک کرده و Paste نمایید:
                </p>
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-white" />
                      <span>کپی شد! در کادر چت Paste کنید</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>کپی کل اطلاعات سیستم در کلیپ‌بورد (جهت ارسال به چت)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Method 2: Download File */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2.5 text-slate-900 font-black text-sm">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200">
                    <Download className="w-4 h-4" />
                  </div>
                  <span>روش دوم: دانلود فایل پشتیبان دیتابیس (JSON)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  می‌توانید فایل کامل اطلاعات را دانلود کرده و در درایو کامپیوتر یا فلش ذخیره کنید یا در چت ارسال فرمایید:
                </p>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-slate-300"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل پشتیبان (hesabdar_data_backup.json)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <b>توجه:</b> بازیابی داده‌های قبلی، اطلاعات فعلی را با داده‌های وارد شده جایگزین خواهد کرد. لطفاً قبل از بازیابی اطمینان حاصل فرمایید.
                </p>
              </div>

              {/* File Upload Option */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  بارگذاری از فایل دانلودشده قبلی:
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-xl p-2 bg-slate-50"
                />
              </div>

              {/* Paste JSON Text Area */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  یا چسباندن (Paste) مستقیم کد JSON:
                </label>
                <textarea
                  rows={6}
                  value={pasteInput}
                  onChange={e => setPasteInput(e.target.value)}
                  placeholder="محتوای متنی فایل پشتیبان JSON را در اینجا Paste کنید..."
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition text-left"
                  dir="ltr"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyRestore}
                disabled={isRestoring || !pasteInput.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تایید و بازیابی اطلاعات به سیستم</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>پشتیبان‌گیری استاندارد آفلاین و ایمن بدون نیاز به اینترنت</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

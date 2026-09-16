import React, { useState, useEffect } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { AppUser, UserRole, CompanySettings } from '../types';
import { CompanyStampSeal } from './CompanyStampSeal';
import { SignatureAndSealModal } from './SignatureAndSealModal';
import {
  Shield,
  RotateCcw,
  Users,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  UserCheck,
  ShieldCheck,
  Building,
  HelpCircle,
  FileSpreadsheet,
  Layers,
  X,
  Image as ImageIcon,
  Phone,
  MapPin,
  Mail,
  FileText,
  Printer,
  Sparkles,
  Calendar,
  Stamp,
  PenTool,
} from 'lucide-react';

interface AccessAndResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'company' | 'roles' | 'reset' | 'backup';
}

export const AccessAndResetModal: React.FC<AccessAndResetModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'company',
}) => {
  const {
    companySettings,
    updateCompanySettings,
    resetCompanySettings,
    appFontSize,
    setAppFontSize,
    fontSizeNumber,
    setFontSizeNumber,
    users,
    currentUser,
    setCurrentUser,
    addUser,
    updateUser,
    deleteUser,
    resetToDemoData,
    resetNewFinancialYear,
    resetWipeCleanAll,
    exportJSON,
    importJSON,
    logout,
  } = useAccounting();

  const [activeSubTab, setActiveSubTab] = useState<'company' | 'roles' | 'reset' | 'backup'>(initialTab);

  // Company Settings Form State
  const [compForm, setCompForm] = useState<CompanySettings>(companySettings);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setCompForm(companySettings);
  }, [companySettings]);

  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle Logo Upload to Base64
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (1.5MB max)
    if (file.size > 1.5 * 1024 * 1024) {
      alert('حجم تصویر نباید بیشتر از ۱.۵ مگابایت باشد.');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const base64 = event.target?.result as string;
      setCompForm(prev => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Stamp & Signature Upload and Dialog Handlers
  const [isDrawSignatureModalOpen, setIsDrawSignatureModalOpen] = useState(false);

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل مهر نباید بیشتر از ۲ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      const base64 = event.target?.result as string;
      setCompForm(prev => ({ ...prev, stampUrl: base64, stampType: 'custom' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل امضا نباید بیشتر از ۲ مگابایت باشد.');
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      const base64 = event.target?.result as string;
      setCompForm(prev => ({ ...prev, signatureUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompanySettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanySettings(compForm);
    setSaveSuccessMessage('مشخصات شرکت و قالب چاپ فاکتورها با موفقیت ذخیره و در کل سیستم اعمال شد.');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  const handleResetCompanyToDefault = () => {
    if (window.confirm('آیا مایلید مشخصات شرکت به مشخصات اصلی برادران نبوی بازگردد؟')) {
      resetCompanySettings();
      setSaveSuccessMessage('مشخصات شرکت به پیش‌فرض نبوی بازگردانده شد.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    }
  };

  // New User Form State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState<UserRole>('accountant');
  const [newUserPhone, setNewUserPhone] = useState('');

  // Password Management & User Switching
  const [changePasswordUser, setChangePasswordUser] = useState<AppUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showChangePasswordInput, setShowChangePasswordInput] = useState(false);
  const [switchUserTarget, setSwitchUserTarget] = useState<AppUser | null>(null);
  const [switchPasswordInput, setSwitchPasswordInput] = useState('');
  const [switchPasswordError, setSwitchPasswordError] = useState('');

  // Confirmation Modal for Resets
  const [confirmResetType, setConfirmResetType] = useState<
    'demo' | 'new_year' | 'wipe_clean' | null
  >(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [backupFileContent, setBackupFileContent] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    const roleTitles: Record<UserRole, string> = {
      admin: 'مدیر کل و صاحب تجارت',
      accountant: 'مدیر مالی و حسابدار',
      warehouse_keeper: 'مدیر گدام و تحویل‌دار بار',
      cashier: 'صندوق‌دار و مسئول صرافی',
    };

    const avatarColors = [
      'bg-emerald-600',
      'bg-blue-600',
      'bg-purple-600',
      'bg-amber-600',
      'bg-rose-600',
      'bg-indigo-600',
    ];
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    addUser({
      name: newUserName.trim(),
      username: newUserUsername.trim() || newUserName.trim().toLowerCase().replace(/\s+/g, '_'),
      password: newUserPassword.trim() || '123',
      role: newUserRole,
      roleTitle: roleTitles[newUserRole],
      phone: newUserPhone.trim() || '0799000000',
      avatarColor: randomColor,
      canResetData: newUserRole === 'admin',
      canDeleteRecords: newUserRole === 'admin',
      canChangeRates: newUserRole === 'admin' || newUserRole === 'accountant',
      canViewReports: newUserRole === 'admin' || newUserRole === 'accountant',
      canManageUsers: newUserRole === 'admin',
    });

    setNewUserName('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserPhone('');
    setIsAddingUser(false);
  };

  const handleExecuteReset = () => {
    if (confirmResetType === 'demo') {
      resetToDemoData();
    } else if (confirmResetType === 'new_year') {
      resetNewFinancialYear();
    } else if (confirmResetType === 'wipe_clean') {
      resetWipeCleanAll();
    }
    setConfirmResetType(null);
    setConfirmInput('');
    onClose();
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hesabdar_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const success = importJSON(content);
      if (success) {
        setImportStatusMessage({
          type: 'success',
          text: 'اطلاعات پشتیبان با موفقیت در سیستم بارگذاری شد.',
        });
      } else {
        setImportStatusMessage({
          type: 'error',
          text: 'فایل نامعتبر است یا ساختار داده‌های حسابداری مطابقت ندارد.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="access-modal-backdrop"
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 z-50 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh] overflow-hidden">
        {/* Sticky Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-slate-200 bg-white shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-emerald-400 rounded-xl flex items-center justify-center shadow-xs shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  تنظیمات سیستم، مشخصات شرکت و امنیت
                </h2>
                <p className="text-xs text-slate-500">
                  مشخصات برند، سربرگ فاکتور، اندازه قلم، نقش‌های کاربری، بستن سال مالی و بکاپ
                </p>
              </div>
            </div>

            <button
              id="access-modal-close-btn"
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl transition border border-slate-200 hover:border-rose-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-2xs"
              title="بستن فرم (ESC)"
            >
              <X className="w-4 h-4" />
              <span>بستن (ESC)</span>
            </button>
          </div>

          {/* Sub-Tabs Nav */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-2xl gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSubTab('company')}
              className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer ${
                activeSubTab === 'company'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4 text-emerald-600" />
              <span>مشخصات شرکت و لوگو (چاپ)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('roles')}
              className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer ${
                activeSubTab === 'roles'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>پرسنل و امنیت ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('reset')}
              className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer ${
                activeSubTab === 'reset'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>ریست سال مالی و داده‌ها</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('backup')}
              className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer ${
                activeSubTab === 'backup'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>پشتیبان‌گیری JSON</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {saveSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

        {/* ================= TAB 0: COMPANY SETTINGS & PRINT CUSTOMIZATION ================= */}
        {activeSubTab === 'company' && (
          <div className="space-y-6">
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950 leading-relaxed">
                <strong className="font-black text-emerald-900 block mb-0.5">
                  سفارشی‌سازی کامل برند، لوگو و سربرگ اسناد چاپی
                </strong>
                تمامی اطلاعات ثبت شده در این بخش به صورت زنده و استاندارد در تمام فاکتورهای چاپی
                A4 (فروش سرخ، خرید آبی)، رسیدهای دریافت و پرداخت، حواله‌های انبار و صورت‌حساب‌های
                مشتریان اعمال خواهد شد.
              </div>
            </div>

            <form onSubmit={handleSaveCompanySettings} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Fields Column */}
                <div className="space-y-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-xs font-black text-slate-800 pb-2 border-b border-slate-200 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>مشخصات سازمانی و شماره‌های تماس</span>
                  </h3>

                  {/* Company Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      نام شرکت یا تجارتخانه <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={compForm.name}
                      onChange={e => setCompForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="مثلاً: شرکت تجارتی برادران نبوی"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>

                  {/* Tagline */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      شعار تجارتی یا زمینه فعالیت
                    </label>
                    <input
                      type="text"
                      value={compForm.tagline || ''}
                      onChange={e => setCompForm(prev => ({ ...prev, tagline: e.target.value }))}
                      placeholder="مثلاً: واردات، ترانزیت و پخش عمده آرد، برنج، روغن و شکر"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* Phones Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>شماره تماس اصلی</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={compForm.phone}
                        onChange={e => setCompForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="0794006460"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>شماره فرعی / واتساپ</span>
                      </label>
                      <input
                        type="text"
                        value={compForm.phoneSecondary || ''}
                        onChange={e =>
                          setCompForm(prev => ({ ...prev, phoneSecondary: e.target.value }))
                        }
                        placeholder="0780000000"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Email & Logo Letter */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>ایمیل شرکت</span>
                      </label>
                      <input
                        type="email"
                        value={compForm.email || ''}
                        onChange={e => setCompForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="nabavi100@gmail.com"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        حرف اختصاری نشان و مونوگرام
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={compForm.logoIconText || 'ن'}
                        onChange={e =>
                          setCompForm(prev => ({ ...prev, logoIconText: e.target.value }))
                        }
                        placeholder="ن"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 text-center font-bold outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Calendar Type & Commercial Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>سیستم تاریخ و تقویم</span>
                      </label>
                      <select
                        value={compForm.calendarType || 'jalali'}
                        onChange={e => setCompForm(prev => ({ ...prev, calendarType: e.target.value as 'jalali' | 'gregorian' }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-bold outline-none focus:border-emerald-500 transition"
                      >
                        <option value="jalali">تقویم هجری شمسی (مثلاً: ۱۴۰۳/۰۶/۱۱)</option>
                        <option value="gregorian">تقویم میلادی Gregorian (مثلاً: 2026-09-01)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                        <span>کد اقتصادی یا جواز تجارتی (TIN)</span>
                      </label>
                      <input
                        type="text"
                        value={compForm.commercialCode || ''}
                        onChange={e => setCompForm(prev => ({ ...prev, commercialCode: e.target.value }))}
                        placeholder="مثلاً: 900-452-110"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono outline-none focus:border-emerald-500 transition"
                      >
                      </input>
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>آدرس دقیق دفتر مرکزی و محل گدام‌ها</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={compForm.address}
                      onChange={e => setCompForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="کابل، سرای شهزاده، مارکیت رحیم‌داد، منزل ۲، دفتر شماره ۱۲"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-500 transition resize-none"
                    />
                  </div>

                  {/* Invoice Footer Note */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>شرایط و یادداشت پاورقی فاکتورها</span>
                    </label>
                    <textarea
                      rows={2}
                      value={compForm.invoiceFooterNote || ''}
                      onChange={e =>
                        setCompForm(prev => ({ ...prev, invoiceFooterNote: e.target.value }))
                      }
                      placeholder="کالای فروخته شده تا ۲۴ ساعت با ارائه فاکتور قابل بازبینی است..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-500 transition resize-none"
                    />
                  </div>
                </div>

                {/* Logo & Live Preview Column */}
                <div className="space-y-4 flex flex-col justify-between">
                  {/* Logo Management */}
                  <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                    <h3 className="text-xs font-black text-slate-800 pb-2 border-b border-slate-200 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      <span>لوگو و نشان تجارتی</span>
                    </h3>

                    <div className="flex items-center gap-4">
                      {compForm.logoUrl ? (
                        <div className="relative group">
                          <img
                            src={compForm.logoUrl}
                            alt="Logo"
                            className="w-20 h-20 object-contain rounded-2xl bg-white border border-slate-200 p-1 shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setCompForm(prev => ({ ...prev, logoUrl: '' }))}
                            className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700 transition"
                            title="حذف لوگو"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-3xl shadow-xs">
                          {compForm.logoIconText || compForm.name.slice(0, 1) || 'ن'}
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <label className="block">
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs">
                            <Upload className="w-4 h-4" />
                            <span>آپلود فایل عکس لوگو</span>
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoFileUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[11px] text-slate-500">
                          فرمت‌های PNG، JPG، WebP یا SVG (حداکثر ۱.۵ مگابایت)
                        </p>
                      </div>
                    </div>

                    {/* Or URL input */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        یا درج لینک اینترنتی لوگو (URL):
                      </label>
                      <input
                        type="url"
                        value={compForm.logoUrl || ''}
                        onChange={e => setCompForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Live Header Preview Card */}
                  <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-emerald-300 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>پیش‌نمایش زنده سربرگ اسناد و فاکتور A4:</span>
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        سربرگ واقعی
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 flex items-center justify-between gap-4">
                      {/* Logo side */}
                      <div className="flex items-center gap-3">
                        {compForm.logoUrl ? (
                          <img
                            src={compForm.logoUrl}
                            alt="Logo preview"
                            className="w-12 h-12 object-contain rounded-xl bg-white border border-slate-200 p-0.5"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xl shadow-xs">
                            {compForm.logoIconText || 'ن'}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{compForm.name}</h4>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{compForm.tagline}</p>
                          <div className="text-[10px] text-emerald-700 font-mono font-bold mt-0.5">
                            تماس: {compForm.phone} {compForm.phoneSecondary ? `| ${compForm.phoneSecondary}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Doc sample tag */}
                      <div className="text-left shrink-0">
                        <div className="text-[10px] font-bold text-slate-400 font-mono">
                          نمونه سند فاکتور
                        </div>
                        <div className="text-xs font-mono font-black text-slate-800">
                          № INV-1403-089
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stamp & Digital Signature Management Card (مهر شرکت و امضای دیجیتال فاکتورها) */}
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <Stamp className="w-4 h-4 text-amber-600" />
                        <span>مهر شرکت و امضای دیجیتال (پایین فاکتورها)</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsDrawSignatureModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition border border-blue-200 cursor-pointer"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>ترسیم یا انتخاب امضای آماده</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Company Stamp Box */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <Stamp className="w-3.5 h-3.5 text-amber-600" />
                            <span>مهر رسمی شرکت</span>
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                            {compForm.stampUrl ? 'عکس اختصاصی' : 'مهر سیستمی'}
                          </span>
                        </div>

                        {/* Stamp Preview & Switcher */}
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs shrink-0 overflow-hidden">
                            <CompanyStampSeal
                              size={52}
                              stampUrl={compForm.stampUrl}
                              color={compForm.stampColor || 'navy'}
                              companyName={compForm.name}
                              tilt={true}
                            />
                          </div>

                          <div className="space-y-2 flex-1">
                            <label className="block">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-2xs">
                                <Upload className="w-3 h-3" />
                                <span>آپلود عکس مهر</span>
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleStampUpload}
                                className="hidden"
                              />
                            </label>

                            {compForm.stampUrl ? (
                              <button
                                type="button"
                                onClick={() => setCompForm(prev => ({ ...prev, stampUrl: '' }))}
                                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>بازگشت به مهر سیستمی</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[10px] text-slate-500 font-bold">رنگ مهر:</span>
                                <button
                                  type="button"
                                  onClick={() => setCompForm(prev => ({ ...prev, stampColor: 'navy' }))}
                                  className={`w-4 h-4 rounded-full bg-blue-900 border ${
                                    compForm.stampColor === 'navy' || !compForm.stampColor
                                      ? 'ring-2 ring-amber-400'
                                      : ''
                                  }`}
                                  title="سرمه‌ای"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCompForm(prev => ({ ...prev, stampColor: 'red' }))}
                                  className={`w-4 h-4 rounded-full bg-rose-700 border ${
                                    compForm.stampColor === 'red' ? 'ring-2 ring-amber-400' : ''
                                  }`}
                                  title="قرمز"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCompForm(prev => ({ ...prev, stampColor: 'blue' }))}
                                  className={`w-4 h-4 rounded-full bg-sky-600 border ${
                                    compForm.stampColor === 'blue' ? 'ring-2 ring-amber-400' : ''
                                  }`}
                                  title="آبی"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer pt-1 border-t border-slate-100">
                          <input
                            type="checkbox"
                            checked={compForm.showStampOnInvoice !== false}
                            onChange={e =>
                              setCompForm(prev => ({
                                ...prev,
                                showStampOnInvoice: e.target.checked,
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-amber-600 accent-amber-600 cursor-pointer"
                          />
                          <span>چاپ پیش‌فرض مهر روی فاکتورها</span>
                        </label>
                      </div>

                      {/* Digital Signature Box */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <PenTool className="w-3.5 h-3.5 text-blue-600" />
                            <span>امضای دیجیتال صادرکننده</span>
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                            {compForm.signatureUrl ? 'فعال' : 'ثبت نشده'}
                          </span>
                        </div>

                        {/* Signature Preview & Controls */}
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs shrink-0 overflow-hidden">
                            {compForm.signatureUrl ? (
                              <img
                                src={compForm.signatureUrl}
                                alt="امضا"
                                className="max-h-full max-w-full object-contain filter contrast-125"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium text-center">
                                بدون امضا
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 flex-1">
                            <label className="block">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-2xs">
                                <Upload className="w-3 h-3" />
                                <span>آپلود فایل عکس</span>
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleSignatureUpload}
                                className="hidden"
                              />
                            </label>

                            {compForm.signatureUrl && (
                              <button
                                type="button"
                                onClick={() => setCompForm(prev => ({ ...prev, signatureUrl: '' }))}
                                className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف این امضا</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer pt-1 border-t border-slate-100">
                          <input
                            type="checkbox"
                            checked={compForm.showSignatureOnInvoice !== false}
                            onChange={e =>
                              setCompForm(prev => ({
                                ...prev,
                                showSignatureOnInvoice: e.target.checked,
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600 cursor-pointer"
                          />
                          <span>چاپ پیش‌فرض امضا روی فاکتورها</span>
                        </label>
                      </div>
                    </div>

                    {/* Bottom Invoice Simulation Box */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10.5px] font-bold text-slate-600 block mb-2">
                        پیش‌نمایش کادر امضا و مهر در پایین فاکتور:
                      </span>
                      <div className="relative border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50/50 flex flex-col items-center justify-between h-20">
                        <span className="text-[9.5px] text-slate-400 font-bold">امضا و مهر صادرکننده فاکتور</span>
                        <div className="relative h-10 w-full flex items-center justify-center">
                          {compForm.signatureUrl && (
                            <img
                              src={compForm.signatureUrl}
                              alt="امضا"
                              className="max-h-10 max-w-[120px] object-contain select-none z-10 filter contrast-125 pointer-events-none"
                            />
                          )}
                          <div
                            className={`absolute select-none pointer-events-none ${
                              compForm.signatureUrl ? 'right-6 -top-1 opacity-85' : 'opacity-90'
                            }`}
                          >
                            <CompanyStampSeal
                              size={46}
                              stampUrl={compForm.stampUrl}
                              color={compForm.stampColor || 'navy'}
                              companyName={compForm.name}
                              tilt={true}
                            />
                          </div>
                        </div>
                        <div className="border-t border-dashed border-slate-400 w-3/4 text-center pt-0.5 text-[10px] text-slate-800 font-bold">
                          مدیریت شرکت: {compForm.name}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Font Size Scaling Settings (تنظیم سایز فونت بر حسب شماره) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>اندازه فونت و مقیاس متن برنامه بر حسب شماره (Font Size)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          انتخاب سایز دقیق قلم به شماره (۱۰، ۱۲، ۱۴، ۱۶، ۱۸، ۲۰، ۲۲ پینتس/پیکسل)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-100 text-blue-900 rounded-lg border border-blue-200">
                          سایز جاری: {fontSizeNumber}px
                        </span>
                      </div>
                    </div>

                    {/* Numeric buttons bar */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                      {[10, 11, 12, 13, 14, 15, 16, 18, 20, 22].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setFontSizeNumber(num);
                            if (num <= 12) setAppFontSize('sm');
                            else if (num <= 14) setAppFontSize('md');
                            else if (num <= 17) setAppFontSize('lg');
                            else setAppFontSize('xl');
                          }}
                          className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition border cursor-pointer text-center ${
                            fontSizeNumber === num
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-105'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    {/* Slider & manual input */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[11px] text-slate-600 font-bold whitespace-nowrap">تنظیم دلخواه:</span>
                      <input
                        type="range"
                        min="9"
                        max="24"
                        step="1"
                        value={fontSizeNumber}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setFontSizeNumber(val);
                          if (val <= 12) setAppFontSize('sm');
                          else if (val <= 14) setAppFontSize('md');
                          else if (val <= 17) setAppFontSize('lg');
                          else setAppFontSize('xl');
                        }}
                        className="flex-1 accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md min-w-[36px] text-center">
                        {fontSizeNumber}
                      </span>
                    </div>
                  </div>

                  {/* Security & Auto-Lock Settings (تنظیم قفل خودکار برنامه بر اساس تایم تعیین شده) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>تنظیم قفل خودکار سیستم بر اساس زمان عدم فعالیت (Auto-Lock)</span>
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          اگر کاربر در مدت تعیین شده هیچ فعالیتی نداشته باشد، برنامه جهت حفظ امنیت اطلاعات مالی خودکار قفل می‌شود.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                          (compForm.autoLockMinutes || 0) > 0
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}>
                          {(compForm.autoLockMinutes || 0) > 0 ? `${compForm.autoLockMinutes} دقیقه` : 'غیرفعال (قفل نشود)'}
                        </span>
                      </div>
                    </div>

                    {/* Quick timeout preset options */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5">
                      {[
                        { label: 'غیرفعال', value: 0 },
                        { label: '۱ دقیقه (تست)', value: 1 },
                        { label: '۲ دقیقه', value: 2 },
                        { label: '۵ دقیقه', value: 5 },
                        { label: '۱۰ دقیقه', value: 10 },
                        { label: '۱۵ دقیقه', value: 15 },
                        { label: '۳۰ دقیقه', value: 30 },
                        { label: '۱ ساعت', value: 60 },
                      ].map(item => {
                        const isSelected = (compForm.autoLockMinutes || 0) === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setCompForm(prev => ({ ...prev, autoLockMinutes: item.value }))}
                            className={`py-2 px-1 rounded-xl text-xs font-bold transition border cursor-pointer text-center ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>تشخیص فعالیت کاربر از طریق ماوس، کیبورد، اسکرول و کلیک انجام می‌پذیرد.</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          logout();
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>قفل کردن فوری سیستم هم‌اکنون</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ذخیره و اعمال در کل سیستم و فاکتورها</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCompanyToDefault}
                      className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
                    >
                      بازگردانی پیش‌فرض
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 1: ROLES & USER MANAGEMENT ================= */}
        {activeSubTab === 'roles' && (
          <div className="space-y-6">
            {/* Active User Switcher Banner */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 ${currentUser.avatarColor} text-white rounded-xl flex items-center justify-center font-black text-lg`}
                >
                  {currentUser.name.slice(0, 1)}
                </div>
                <div>
                  <div className="text-[11px] text-emerald-400 font-bold">
                    کاربر فعال و وارد شده هم‌اکنون:
                  </div>
                  <div className="text-base font-black text-white">{currentUser.name}</div>
                  <div className="text-xs text-slate-300">
                    نقش: {currentUser.roleTitle} ({currentUser.role})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-300">تغییر کاربر سریع:</span>
                <select
                  value={currentUser.id}
                  onChange={e => {
                    const u = users.find(usr => usr.id === e.target.value);
                    if (u) setCurrentUser(u);
                  }}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.roleTitle})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Permissions Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>مدیر کل (Admin)</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  دسترسی نامحدود، ریست داده‌ها، حذف اسناد، تعیین نرخ صرافی و مدیریت پرسنل.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                  <span>حسابدار (Accountant)</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  ثبت فاکتورها، دریافت/پرداخت، عملیات صرافی و مشاهده گزارشات و دفاتر کل.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                  <Layers className="w-4 h-4 text-amber-700" />
                  <span>مدیر گدام (Warehouse)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  مشاهده موجودی تن/کیسه، ثبت انتقال بین گدام‌ها و صدور حواله خروج بار.
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-3 rounded-2xl">
                <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5 mb-1">
                  <KeyRound className="w-4 h-4 text-purple-700" />
                  <span>صندوق‌دار (Cashier)</span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  ثبت دریافت و پرداخت نقد، مشاهده مانده ۳ صندوق و صدور فاکتور فروش.
                </p>
              </div>
            </div>

            {/* Users List & Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  فهرست پرسنل و کاربران سیستم
                </h3>
                {!isAddingUser && (
                  <button
                    onClick={() => setIsAddingUser(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن کاربر جدید</span>
                  </button>
                )}
              </div>

              {/* Add User Inline Form */}
              {isAddingUser && (
                <form
                  onSubmit={handleAddUserSubmit}
                  className="bg-slate-50 border border-slate-300 p-4 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-emerald-600" />
                      <span>تعریف کاربر جدید به همراه رمز عبور ورود به برنامه:</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      رمز عبور پیش‌فرض: <strong className="font-mono">123</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        نام و تخلص: *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثلاً: محمد داوود کریمی"
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        نام کاربری جهت ورود:
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="مثلاً: karimi"
                        value={newUserUsername}
                        onChange={e => setNewUserUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center justify-between">
                        <span>رمز عبور ورود (پسورد): *</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showNewUserPassword ? 'text' : 'password'}
                          required
                          dir="ltr"
                          placeholder="رمز عبور (مثلاً: 123)"
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none pr-3 pl-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        نقش و سطح دسترسی:
                      </label>
                      <select
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer"
                      >
                        <option value="admin">مدیر کل (Admin - دسترسی نامحدود)</option>
                        <option value="accountant">مدیر مالی و حسابدار (Accountant)</option>
                        <option value="warehouse_keeper">مدیر گدام (Warehouse Keeper)</option>
                        <option value="cashier">صندوق‌دار و صراف (Cashier)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        شماره تماس:
                      </label>
                      <input
                        type="text"
                        placeholder="0799000000"
                        value={newUserPhone}
                        onChange={e => setNewUserPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ذخیره کاربر با رمز عبور</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">کاربر</th>
                      <th className="p-3">نام کاربری</th>
                      <th className="p-3">نقش و سطح</th>
                      <th className="p-3 text-center">رمز عبور</th>
                      <th className="p-3">شماره تماس</th>
                      <th className="p-3 text-center">وضعیت دسترسی</th>
                      <th className="p-3 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                      <tr key={u.id} className={u.id === currentUser.id ? 'bg-emerald-50/50' : ''}>
                        <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-7 h-7 rounded-lg ${u.avatarColor || 'bg-slate-700'} text-white flex items-center justify-center text-xs font-black`}
                          >
                            {u.name.slice(0, 1)}
                          </span>
                          <div>
                            <div>{u.name}</div>
                            {u.id === currentUser.id && (
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                                کاربر جاری
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {u.username || '---'}
                        </td>
                        <td className="p-3 font-semibold text-slate-700">{u.roleTitle}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setChangePasswordUser(u);
                              setNewPasswordInput(u.password || '123');
                              setShowChangePasswordInput(false);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            title="تغییر رمز عبور این کاربر"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                            <span>تغییر رمز</span>
                          </button>
                        </td>
                        <td className="p-3 font-mono text-slate-500">{u.phone || '---'}</td>
                        <td className="p-3 text-center">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                            {u.canResetData ? 'کامل (مدیر)' : u.canViewReports ? 'مالی و گزارشات' : 'محدود به بخش'}
                          </span>
                        </td>
                        <td className="p-3 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => {
                                  setSwitchUserTarget(u);
                                  setSwitchPasswordInput('');
                                  setSwitchPasswordError('');
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                <span>ورود به این حساب</span>
                              </button>
                            )}
                            {users.length > 1 && (
                              <button
                                onClick={() => {
                                  if (confirm(`آیا از حذف کاربر «${u.name}» اطمینان دارید؟`)) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="حذف کاربر"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: DATA RESET STRATEGIES ================= */}
        {activeSubTab === 'reset' && (
          <div className="space-y-6">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-rose-900">توجه مهم در خصوص ریست کردن اطلاعات:</div>
                <p className="text-rose-800 leading-relaxed">
                  عملیات ریست غیرقابل بازگشت است. توصیه می‌شود قبل از هرگونه ریست، ابتدا از زبانه
                  «پشتیبان‌گیری» یک فایل نسخه پشتیبان JSON دانلود و ذخیره نمایید.
                </p>
              </div>
            </div>

            {/* 3 Reset Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Demo Data */}
              <div className="bg-white border border-slate-300 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-400 transition shadow-xs">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    ریست به داده‌های نمونه تجارتی
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    بازگرداندن کلیه فاکتورها، گدام‌ها، محصولات و مشتریان به داده‌های اولیه پیش‌فرض
                    شرکت بازرگان افغانستان.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setConfirmResetType('demo');
                    setConfirmInput('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                >
                  ریست به دمو اولیه
                </button>
              </div>

              {/* Option 2: New Financial Year */}
              <div className="bg-white border border-amber-300 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-amber-400 transition shadow-xs">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold">
                    <Building className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    شروع سال / دوره مالی جدید
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    پاکسازی کلیه فاکتورها و تراکنش‌ها و صفر کردن مانده طلبات و بدهی‌ها، با حفظ
                    محصولات و مشخصات گدام‌ها.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setConfirmResetType('new_year');
                    setConfirmInput('');
                  }}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                >
                  بستن دوره و شروع سال جدید
                </button>
              </div>

              {/* Option 3: Wipe Clean All */}
              <div className="bg-white border border-rose-300 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-rose-400 transition shadow-xs">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-rose-100 text-rose-800 rounded-xl flex items-center justify-center font-bold">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    پاکسازی کامل کلیه اطلاعات
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    تخلیه کامل دیتابیس، پاک کردن همه فاکتورها، حساب‌ها، کالاها و صندوق‌ها جهت شروع
                    یک تجارت کاملاً جدید از صفر.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setConfirmResetType('wipe_clean');
                    setConfirmInput('');
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                >
                  پاکسازی کامل (Blank Slate)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: BACKUP & RESTORE ================= */}
        {activeSubTab === 'backup' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export Backup Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Download className="w-5 h-5 text-blue-600" />
                  <span>دریافت نسخه پشتیبان کامل (Export)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  یک نسخه کامل از تمام فاکتورها، تراکنش‌های مالی، موجودی گدام‌ها و حساب‌های مشتریان
                  در قالب یک فایل استاندارد JSON در سیستم شما دانلود خواهد شد.
                </p>
                <button
                  onClick={handleDownloadBackup}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل پشتیبان JSON</span>
                </button>
              </div>

              {/* Import Backup Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  <span>بازیابی اطلاعات از فایل پشتیبان (Import)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  فایل پشتیبان JSON دانلود شده از قبل را انتخاب نمایید تا دیتابیس به صورت کامل
                  جایگزین و بازگردانی شود.
                </p>
                <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>انتخاب و بارگذاری فایل JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Import Status Alert */}
            {importStatusMessage && (
              <div
                className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  importStatusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {importStatusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                )}
                <span>{importStatusMessage.text}</span>
              </div>
            )}
          </div>
        )}

        {/* ================= CONFIRMATION MODAL OVERLAY ================= */}
        {confirmResetType && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-300 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-8 h-8" />
                <div>
                  <h4 className="text-base font-black text-slate-900">تأیید نهایی عملیات ریست</h4>
                  <p className="text-xs text-slate-500">
                    {confirmResetType === 'demo'
                      ? 'ریست کامل به داده‌های پیش‌فرض دمو'
                      : confirmResetType === 'new_year'
                      ? 'بستن سال مالی و پاکسازی فاکتورها'
                      : 'تخلیه کامل کلیه داده‌های سیستم'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                آیا کاملاً مطمئن هستید؟ برای تأیید و اجرای عملیات، لطفاً کلمه{' '}
                <strong className="text-rose-600 font-black">«ریست»</strong> یا{' '}
                <strong className="text-rose-600 font-black">«RESET»</strong> را در کادر زیر وارد
                کنید:
              </p>

              <input
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder="کلمه «ریست» را بنویسید"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-rose-300 rounded-xl text-center text-sm font-black text-rose-700 outline-none"
                autoFocus
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetType(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف و بازگشت
                </button>
                <button
                  type="button"
                  disabled={confirmInput.trim() !== 'ریست' && confirmInput.trim().toUpperCase() !== 'RESET'}
                  onClick={handleExecuteReset}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition text-white ${
                    confirmInput.trim() === 'ریست' || confirmInput.trim().toUpperCase() === 'RESET'
                      ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed text-slate-500'
                  }`}
                >
                  تأیید و اجرای ریست
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ================= CHANGE PASSWORD MODAL ================= */}
        {changePasswordUser && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-70">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-300 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 text-blue-600">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">تغییر رمز عبور کاربر</h4>
                  <p className="text-xs text-slate-500">{changePasswordUser.name} ({changePasswordUser.roleTitle})</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  رمز عبور جدید را وارد نمایید:
                </label>
                <div className="relative">
                  <input
                    type={showChangePasswordInput ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={newPasswordInput}
                    onChange={e => setNewPasswordInput(e.target.value)}
                    placeholder="رمز جدید..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none pr-3 pl-8"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordInput(!showChangePasswordInput)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showChangePasswordInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePasswordUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newPasswordInput.trim()) return;
                    updateUser(changePasswordUser.id, { password: newPasswordInput.trim() });
                    setChangePasswordUser(null);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  ذخیره رمز عبور
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SWITCH USER MODAL ================= */}
        {switchUserTarget && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-70">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-300 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 text-slate-800">
                <span className={`w-10 h-10 rounded-xl ${switchUserTarget.avatarColor || 'bg-slate-800'} text-white flex items-center justify-center text-sm font-black shrink-0`}>
                  {switchUserTarget.name.slice(0, 1)}
                </span>
                <div>
                  <h4 className="text-sm font-black text-slate-900">ورود به حساب {switchUserTarget.name}</h4>
                  <p className="text-xs text-slate-500">نقش: {switchUserTarget.roleTitle}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  لطفاً رمز عبور حساب ({switchUserTarget.name}) را وارد نمایید:
                </label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={switchPasswordInput}
                  onChange={e => {
                    setSwitchPasswordInput(e.target.value);
                    setSwitchPasswordError('');
                  }}
                  placeholder="رمز عبور..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const expected = switchUserTarget.password || '123';
                      if (switchPasswordInput.trim() === expected.trim()) {
                        setCurrentUser(switchUserTarget);
                        setSwitchUserTarget(null);
                      } else {
                        setSwitchPasswordError('رمز عبور وارد شده نادرست است.');
                      }
                    }
                  }}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>رمز پیش‌فرض: 123</span>
                  <button
                    type="button"
                    onClick={() => setSwitchPasswordInput('123')}
                    className="text-blue-600 hover:underline cursor-pointer font-bold"
                  >
                    درج ۱۲۳
                  </button>
                </div>
              </div>

              {switchPasswordError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg text-center">
                  {switchPasswordError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSwitchUserTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const expected = switchUserTarget.password || '123';
                    if (switchPasswordInput.trim() === expected.trim()) {
                      setCurrentUser(switchUserTarget);
                      setSwitchUserTarget(null);
                    } else {
                      setSwitchPasswordError('رمز عبور وارد شده نادرست است.');
                    }
                  }}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  ورود به حساب
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature & Seal Canvas Drawing / Settings Modal */}
      <SignatureAndSealModal
        isOpen={isDrawSignatureModalOpen}
        onClose={() => setIsDrawSignatureModalOpen(false)}
        onApply={newSettings => {
          setCompForm(prev => ({
            ...prev,
            showStampOnInvoice: newSettings.showStamp,
            showSignatureOnInvoice: newSettings.showSignature,
            stampUrl: newSettings.stampUrl !== undefined ? newSettings.stampUrl : prev.stampUrl,
            signatureUrl:
              newSettings.signatureUrl !== undefined ? newSettings.signatureUrl : prev.signatureUrl,
            stampColor: newSettings.stampColor || prev.stampColor,
          }));
        }}
      />
    </div>
  </div>
);
};

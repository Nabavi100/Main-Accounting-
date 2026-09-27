import React, { useState } from 'react';
import {
  SlidersHorizontal,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Building2,
  FileSpreadsheet,
  FileText,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  Save,
} from 'lucide-react';

export type PrintMarginPreset = 'standard' | 'minimal' | 'medium' | 'wide' | 'zero' | 'custom';

export interface PrintPageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PrintAdvancedSettings {
  marginPreset: PrintMarginPreset;
  margins: PrintPageMargins;
  zoom: number; // 60 to 140 (%)
  showHeader: boolean;
  showFooter: boolean;
  letterheadSpacing: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintAdvancedSettings = {
  marginPreset: 'standard',
  margins: { top: 6, right: 8, bottom: 6, left: 8 },
  zoom: 100,
  showHeader: true,
  showFooter: true,
  letterheadSpacing: false,
};

export const MARGIN_PRESETS: Record<
  Exclude<PrintMarginPreset, 'custom'>,
  { label: string; desc: string; margins: PrintPageMargins }
> = {
  standard: {
    label: 'استاندارد (توصیه شده)',
    desc: 'بالا ۶mm، پایین ۶mm، راست ۸mm، چپ ۸mm (متعادل‌ترین چاپ)',
    margins: { top: 6, right: 8, bottom: 6, left: 8 },
  },
  minimal: {
    label: 'باریک / حداقل (حداکثر فضا)',
    desc: 'بالا ۲mm، پایین ۲mm، راست ۳mm، چپ ۳mm (مناسب ردیف‌های زیاد)',
    margins: { top: 2, right: 3, bottom: 2, left: 3 },
  },
  medium: {
    label: 'متوسط اداری',
    desc: '۱۰mm چهار طرف (مناسب برای پوشه و مطالعه راحت)',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  wide: {
    label: 'پهن / زونکنی (پانچ)',
    desc: 'بالا ۱۵mm، پایین ۱۵mm، راست ۱۸mm، چپ ۱۲mm (جای سوراخ زونکن)',
    margins: { top: 15, right: 18, bottom: 15, left: 12 },
  },
  zero: {
    label: 'بدون حاشیه (۰ میلی‌متر)',
    desc: '۰mm چهار طرف (چاپ لب‌به‌لب یا تنظیم حاشیه در پرینتر)',
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  },
};

const STORAGE_KEY = 'print_advanced_settings_v1';

export function loadStoredPrintSettings(): PrintAdvancedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        marginPreset: parsed.marginPreset || DEFAULT_PRINT_SETTINGS.marginPreset,
        margins: {
          top: typeof parsed.margins?.top === 'number' ? parsed.margins.top : DEFAULT_PRINT_SETTINGS.margins.top,
          right: typeof parsed.margins?.right === 'number' ? parsed.margins.right : DEFAULT_PRINT_SETTINGS.margins.right,
          bottom: typeof parsed.margins?.bottom === 'number' ? parsed.margins.bottom : DEFAULT_PRINT_SETTINGS.margins.bottom,
          left: typeof parsed.margins?.left === 'number' ? parsed.margins.left : DEFAULT_PRINT_SETTINGS.margins.left,
        },
        zoom: typeof parsed.zoom === 'number' ? Math.min(140, Math.max(60, parsed.zoom)) : DEFAULT_PRINT_SETTINGS.zoom,
        showHeader: parsed.showHeader !== undefined ? parsed.showHeader : DEFAULT_PRINT_SETTINGS.showHeader,
        showFooter: parsed.showFooter !== undefined ? parsed.showFooter : DEFAULT_PRINT_SETTINGS.showFooter,
        letterheadSpacing: parsed.letterheadSpacing !== undefined ? parsed.letterheadSpacing : DEFAULT_PRINT_SETTINGS.letterheadSpacing,
      };
    }
  } catch (e) {
    console.warn('Failed to load stored print settings:', e);
  }
  return DEFAULT_PRINT_SETTINGS;
}

export function saveStoredPrintSettings(settings: PrintAdvancedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save print settings to localStorage:', e);
  }
}

interface PrintAdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrintAdvancedSettings;
  onChange: (newSettings: PrintAdvancedSettings) => void;
}

export const PrintAdvancedSettingsModal: React.FC<PrintAdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChange,
}) => {
  const [localSettings, setLocalSettings] = useState<PrintAdvancedSettings>(settings);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync when opened
  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setSaveSuccessMsg(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: PrintMarginPreset) => {
    if (preset === 'custom') {
      const updated: PrintAdvancedSettings = {
        ...localSettings,
        marginPreset: 'custom',
      };
      setLocalSettings(updated);
      onChange(updated);
    } else {
      const presetData = MARGIN_PRESETS[preset];
      const updated: PrintAdvancedSettings = {
        ...localSettings,
        marginPreset: preset,
        margins: { ...presetData.margins },
      };
      setLocalSettings(updated);
      onChange(updated);
    }
  };

  const handleMarginChange = (side: keyof PrintPageMargins, value: number) => {
    const val = Math.max(0, Math.min(40, isNaN(value) ? 0 : value));
    const newMargins = { ...localSettings.margins, [side]: val };
    const updated: PrintAdvancedSettings = {
      ...localSettings,
      marginPreset: 'custom',
      margins: newMargins,
    };
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(60, Math.min(140, Math.round(newZoom)));
    const updated: PrintAdvancedSettings = {
      ...localSettings,
      zoom: clamped,
    };
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleToggleHeader = (show: boolean) => {
    const updated: PrintAdvancedSettings = {
      ...localSettings,
      showHeader: show,
    };
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleToggleFooter = (show: boolean) => {
    const updated: PrintAdvancedSettings = {
      ...localSettings,
      showFooter: show,
    };
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleToggleLetterhead = (spacing: boolean) => {
    const updated: PrintAdvancedSettings = {
      ...localSettings,
      letterheadSpacing: spacing,
    };
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleSaveAsDefault = () => {
    saveStoredPrintSettings(localSettings);
    setSaveSuccessMsg('تنظیمات به عنوان پیش‌فرض مرورگر ذخیره شد');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3000);
  };

  const handleResetToFactory = () => {
    setLocalSettings(DEFAULT_PRINT_SETTINGS);
    onChange(DEFAULT_PRINT_SETTINGS);
    saveStoredPrintSettings(DEFAULT_PRINT_SETTINGS);
    setSaveSuccessMsg('تنظیمات به حالت اولیه بازگردانده شد');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3000);
  };

  const zoomPresets = [75, 80, 85, 90, 95, 100, 105, 110, 120];

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[1050] overflow-y-auto"
      dir="rtl"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                پنل تنظیمات پیشرفته چاپ فاکتور و اسناد
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنظیم دقیق حاشیه‌ها (Margins)، مقیاس محتوا (Zoom) و مدیریت هدر و فوتر شرکت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification if saved */}
        {saveSuccessMsg && (
          <div className="mt-3 px-3.5 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        <div className="mt-4 space-y-5 max-h-[72vh] overflow-y-auto px-1 pr-1.5 custom-scrollbar">
          {/* ========================================================================= */}
          {/* SECTION 1: MARGINS (حاشیه‌های صفحه)                                      */}
          {/* ========================================================================= */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Maximize2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">حاشیه‌های صفحه برگه چاپ (Margins)</h3>
                  <span className="text-[11px] text-slate-500">تنظیم فاصله لبه‌های کاغذ A4 با محتوای فاکتور</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-200">
                {localSettings.marginPreset === 'custom'
                  ? `بالا:${localSettings.margins.top} راست:${localSettings.margins.right} پایین:${localSettings.margins.bottom} چپ:${localSettings.margins.left} mm`
                  : MARGIN_PRESETS[localSettings.marginPreset]?.label || 'استاندارد'}
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3.5">
              {(Object.keys(MARGIN_PRESETS) as Array<Exclude<PrintMarginPreset, 'custom'>>).map(key => {
                const item = MARGIN_PRESETS[key];
                const isActive = localSettings.marginPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    className={`text-right p-2.5 rounded-xl border transition cursor-pointer text-xs flex flex-col justify-between ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{item.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span
                      className={`text-[10px] mt-1 line-clamp-1 ${
                        isActive ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </span>
                  </button>
                );
              })}

              {/* Custom preset button */}
              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`text-right p-2.5 rounded-xl border transition cursor-pointer text-xs flex flex-col justify-between ${
                  localSettings.marginPreset === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>سفارشی (دستی)</span>
                  {localSettings.marginPreset === 'custom' && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 ${
                    localSettings.marginPreset === 'custom' ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  تعیین میلی‌متر دقیق هر طرف
                </span>
              </button>
            </div>

            {/* Custom Margin Numerical Inputs */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-bold text-slate-700 block mb-2">
                مقادیر حاشیه‌ها بر حسب میلی‌متر (mm):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Top */}
                <div>
                  <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                    <ArrowUp className="w-3 h-3 text-blue-600" />
                    <span>حاشیه بالا (Top):</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={localSettings.margins.top}
                      onChange={e => handleMarginChange('top', parseInt(e.target.value))}
                      className="w-full text-center bg-slate-50 font-mono font-bold text-xs p-1.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:bg-white outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mr-1 font-mono">mm</span>
                  </div>
                </div>

                {/* Right */}
                <div>
                  <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                    <ArrowRight className="w-3 h-3 text-blue-600" />
                    <span>حاشیه راست (Right):</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={localSettings.margins.right}
                      onChange={e => handleMarginChange('right', parseInt(e.target.value))}
                      className="w-full text-center bg-slate-50 font-mono font-bold text-xs p-1.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:bg-white outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mr-1 font-mono">mm</span>
                  </div>
                </div>

                {/* Bottom */}
                <div>
                  <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                    <ArrowDown className="w-3 h-3 text-blue-600" />
                    <span>حاشیه پایین (Bottom):</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={localSettings.margins.bottom}
                      onChange={e => handleMarginChange('bottom', parseInt(e.target.value))}
                      className="w-full text-center bg-slate-50 font-mono font-bold text-xs p-1.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:bg-white outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mr-1 font-mono">mm</span>
                  </div>
                </div>

                {/* Left */}
                <div>
                  <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                    <ArrowLeft className="w-3 h-3 text-blue-600" />
                    <span>حاشیه چپ (Left):</span>
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={localSettings.margins.left}
                      onChange={e => handleMarginChange('left', parseInt(e.target.value))}
                      className="w-full text-center bg-slate-50 font-mono font-bold text-xs p-1.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:bg-white outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mr-1 font-mono">mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: CONTENT SCALE & ZOOM (مقیاس و زوم محتوا)                       */}
          {/* ========================================================================= */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ZoomIn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">مقیاس و بزرگ‌نمایی محتوا (Content Zoom)</h3>
                  <span className="text-[11px] text-slate-500">تنظیم اندازه کل فاکتور جهت جاگیری کامل در یک برگه A4</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-full border border-emerald-200">
                  {localSettings.zoom}%
                </span>
                {localSettings.zoom !== 100 && (
                  <button
                    type="button"
                    onClick={() => handleZoomChange(100)}
                    className="text-[10px] font-bold text-slate-600 hover:text-blue-600 bg-white border border-slate-300 px-2 py-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
                    title="بازنشانی به ۱۰۰٪"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>۱۰۰٪</span>
                  </button>
                )}
              </div>
            </div>

            {/* Slider Control with Step Buttons */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleZoomChange(localSettings.zoom - 5)}
                  disabled={localSettings.zoom <= 60}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="کاهش ۵٪ مقیاس"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min={60}
                    max={140}
                    step={5}
                    value={localSettings.zoom}
                    onChange={e => handleZoomChange(parseInt(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleZoomChange(localSettings.zoom + 5)}
                  disabled={localSettings.zoom >= 140}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  title="افزایش ۵٪ مقیاس"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 px-1">
                <span>۶۰٪ (کوچک‌ترین)</span>
                <span className="font-bold text-slate-700">۱۰۰٪ (استاندارد)</span>
                <span>۱۴۰٪ (بزرگ‌ترین)</span>
              </div>
            </div>

            {/* Quick Zoom Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold ml-1">اندازه‌های پرکاربرد:</span>
              {zoomPresets.map(z => {
                const isActive = localSettings.zoom === z;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => handleZoomChange(z)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {z}% {z === 100 ? '(اصلی)' : ''}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg p-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>نکته حسابداری:</strong> اگر تعداد اقلام فاکتور زیاد است و به صفحه دوم سرریز می‌کند،
                کافیست مقیاس را روی <strong>۹۰٪</strong> یا <strong>۸۵٪</strong> تنظیم کنید تا کل فاکتور در یک
                برگه A4 فیت شود.
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: COMPANY HEADER & FOOTER (هدر و فوتر شرکت)                       */}
          {/* ========================================================================= */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">نمایش یا عدم نمایش هدر و فوتر شرکت</h3>
                <span className="text-[11px] text-slate-500">
                  مدیریت سربرگ چاپی، لوگو، اطلاعات سازمانی و پانوشت فاکتور
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Header Toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>چاپ هدر و سربرگ شرکت</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleHeader(!localSettings.showHeader)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localSettings.showHeader ? 'bg-purple-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          localSettings.showHeader ? '-translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    شامل لوگوی شرکت، نام تجارتی، شماره فاکتور و عنوان رسمی معامله در بالای برگه.
                  </p>
                </div>

                {/* Sub-option: Letterhead Blank Spacing */}
                {!localSettings.showHeader && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200">
                    <label className="flex items-center justify-between text-[11px] font-bold text-slate-700 cursor-pointer">
                      <span>فاصله خالی جهت سربرگ آماده شرکت:</span>
                      <input
                        type="checkbox"
                        checked={localSettings.letterheadSpacing}
                        onChange={e => handleToggleLetterhead(e.target.checked)}
                        className="rounded text-purple-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-purple-600"
                      />
                    </label>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      برای چاپ روی کاغذهای آماده‌ای که سربرگ فیزیکی دارند.
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                      <span>چاپ فوتر و پانوشت شرکت</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleFooter(!localSettings.showFooter)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localSettings.showFooter ? 'bg-purple-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          localSettings.showFooter ? '-translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    شامل آدرس پستی شرکت، شماره‌های تماس، و یادداشت رسمی اعتبار سند در پایین‌ترین سطر برگه.
                  </p>
                </div>

                <div className="mt-3 pt-2 text-[10.5px] font-medium text-slate-500">
                  وضعیت فعلی: {localSettings.showFooter ? 'نمایش در فاکتور' : 'مخفی در خروجی چاپ'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToFactory}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              title="بازنشانی تمام مقادیر به حالت پیش‌فرض اولیه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی پیش‌فرض</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAsDefault}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              title="ذخیره این تنظیمات به عنوان پیش‌فرض همیشگی در مرورگر شما"
            >
              <Save className="w-3.5 h-3.5" />
              <span>ذخیره به عنوان پیش‌فرض</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs hover:shadow cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>تایید و اعمال تنظیمات</span>
          </button>
        </div>
      </div>
    </div>
  );
};

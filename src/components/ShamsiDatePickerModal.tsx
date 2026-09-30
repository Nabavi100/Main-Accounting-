import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import {
  normalizePersianDate,
  getPersianDate,
  jalaliToGregorian,
  getGregorianEquivalent,
} from '../utils/formatters';

export interface ShamsiDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (selectedDate: string) => void;
  title?: string;
  colorTheme?: 'emerald' | 'blue' | 'slate';
}

export const PERSIAN_MONTHS = [
  { id: 1, name: 'حمل', altName: 'فروردین', days: 31 },
  { id: 2, name: 'ثور', altName: 'اردیبهشت', days: 31 },
  { id: 3, name: 'جوزا', altName: 'خرداد', days: 31 },
  { id: 4, name: 'سرطان', altName: 'تیر', days: 31 },
  { id: 5, name: 'اسد', altName: 'مرداد', days: 31 },
  { id: 6, name: 'سنبله', altName: 'شهریور', days: 31 },
  { id: 7, name: 'میزان', altName: 'مهر', days: 30 },
  { id: 8, name: 'عقرب', altName: 'آبان', days: 30 },
  { id: 9, name: 'قوس', altName: 'آذر', days: 30 },
  { id: 10, name: 'جدی', altName: 'دی', days: 30 },
  { id: 11, name: 'دلو', altName: 'بهمن', days: 30 },
  { id: 12, name: 'حوت', altName: 'اسفند', days: 29 },
];

export const WEEKDAYS = [
  { id: 0, label: 'شنبه', short: 'ش' },
  { id: 1, label: 'یکشنبه', short: 'ی' },
  { id: 2, label: 'دوشنبه', short: 'د' },
  { id: 3, label: 'سه‌شنبه', short: 'س' },
  { id: 4, label: 'چهارشنبه', short: 'چ' },
  { id: 5, label: 'پنجشنبه', short: 'پ' },
  { id: 6, label: 'جمعه', short: 'ج', isHoliday: true },
];

export function isLeapPersianYear(year: number): boolean {
  const rem = ((year - 474) % 2820 + 2820) % 2820;
  return ((rem * 682) % 2816) < 682;
}

export function getPersianDateFromDate(d: Date): string {
  try {
    const raw = new Intl.DateTimeFormat('fa-AF-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return normalizePersianDate(raw);
  } catch {
    return getPersianDate();
  }
}

/**
 * Format date in full Persian words: e.g. «۱۵ سنبله ۱۴۰۵»
 */
export function formatPersianDateInWords(dateStr: string): string {
  if (!dateStr) return '';
  const norm = normalizePersianDate(dateStr);
  const parts = norm.split('/').map(p => parseInt(p, 10));
  if (parts.length === 3 && parts[0] > 1300 && parts[1] >= 1 && parts[1] <= 12) {
    const month = PERSIAN_MONTHS[parts[1] - 1];
    return `${parts[2]} ${month.name} (${month.altName}) ${parts[0]}`;
  }
  return dateStr;
}

export const ShamsiDatePickerModal: React.FC<ShamsiDatePickerModalProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  title = 'انتخاب تاریخ شمسی',
  colorTheme = 'emerald',
}) => {
  const todayStr = useMemo(() => normalizePersianDate(getPersianDate()), []);
  const todayParts = useMemo(() => {
    const p = todayStr.split('/');
    return {
      year: parseInt(p[0], 10) || 1405,
      month: parseInt(p[1], 10) || 7,
      day: parseInt(p[2], 10) || 8,
    };
  }, [todayStr]);

  // Selected date state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const norm = normalizePersianDate(value);
    return norm && norm.includes('/') ? norm : todayStr;
  });

  // Calendar navigator state (viewed year & month)
  const [calYear, setCalYear] = useState<number>(todayParts.year);
  const [calMonth, setCalMonth] = useState<number>(todayParts.month);

  // Sync when modal opens or value changes
  useEffect(() => {
    if (isOpen) {
      const norm = normalizePersianDate(value);
      if (norm && norm.includes('/')) {
        const p = norm.split('/');
        const y = parseInt(p[0], 10);
        const m = parseInt(p[1], 10);
        if (y > 1300 && m >= 1 && m <= 12) {
          setSelectedDate(norm);
          setCalYear(y);
          setCalMonth(m);
          return;
        }
      }
      setSelectedDate(todayStr);
      setCalYear(todayParts.year);
      setCalMonth(todayParts.month);
    }
  }, [isOpen, value, todayStr, todayParts]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Number of days in the currently viewed month
  const daysInCalMonth = useMemo(() => {
    if (calMonth === 12) {
      return isLeapPersianYear(calYear) ? 30 : 29;
    }
    return PERSIAN_MONTHS[calMonth - 1]?.days || 30;
  }, [calYear, calMonth]);

  // Calculate start day of week for the 1st day of the viewed month
  // Persian week: Saturday = 0, Sunday = 1, ... Friday = 6
  const startDayOfWeek = useMemo(() => {
    try {
      const gregStr = jalaliToGregorian(calYear, calMonth, 1);
      const [gy, gm, gd] = gregStr.split('-').map(Number);
      const d = new Date(gy, gm - 1, gd);
      const jsDay = d.getDay(); // 0 is Sunday, 6 is Saturday
      return (jsDay + 1) % 7;
    } catch {
      return 0;
    }
  }, [calYear, calMonth]);

  // Years list for quick selection
  const yearsList = useMemo(() => {
    const list: number[] = [];
    const baseYear = todayParts.year;
    for (let y = baseYear - 10; y <= baseYear + 6; y++) {
      list.push(y);
    }
    return list;
  }, [todayParts.year]);

  if (!isOpen) return null;

  const handleSelectDay = (day: number, confirmNow = false) => {
    const formatted = `${calYear}/${String(calMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    setSelectedDate(formatted);
    if (confirmNow) {
      onChange(formatted);
      onClose();
    }
  };

  const handleApply = () => {
    onChange(selectedDate);
    onClose();
  };

  // Quick preset dates
  const handleQuickPreset = (preset: 'today' | 'yesterday' | 'tomorrow' | 'startOfMonth' | 'endOfMonth') => {
    const now = new Date();
    if (preset === 'today') {
      setSelectedDate(todayStr);
      setCalYear(todayParts.year);
      setCalMonth(todayParts.month);
      return;
    }
    if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const str = getPersianDateFromDate(y);
      setSelectedDate(str);
      const p = str.split('/');
      setCalYear(parseInt(p[0], 10));
      setCalMonth(parseInt(p[1], 10));
      return;
    }
    if (preset === 'tomorrow') {
      const t = new Date();
      t.setDate(now.getDate() + 1);
      const str = getPersianDateFromDate(t);
      setSelectedDate(str);
      const p = str.split('/');
      setCalYear(parseInt(p[0], 10));
      setCalMonth(parseInt(p[1], 10));
      return;
    }
    if (preset === 'startOfMonth') {
      const str = `${calYear}/${String(calMonth).padStart(2, '0')}/01`;
      setSelectedDate(str);
      return;
    }
    if (preset === 'endOfMonth') {
      const maxDays = calMonth === 12 && !isLeapPersianYear(calYear) ? 29 : PERSIAN_MONTHS[calMonth - 1]?.days || 30;
      const str = `${calYear}/${String(calMonth).padStart(2, '0')}/${String(maxDays).padStart(2, '0')}`;
      setSelectedDate(str);
      return;
    }
  };

  const themeColors = {
    emerald: {
      primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      accent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      selected: 'bg-emerald-600 text-white font-black shadow-xs ring-2 ring-emerald-400/50',
      activeBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      headerGradient: 'from-emerald-700 via-teal-800 to-slate-900',
    },
    blue: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      accent: 'text-blue-700 bg-blue-50 border-blue-200',
      selected: 'bg-blue-600 text-white font-black shadow-xs ring-2 ring-blue-400/50',
      activeBadge: 'bg-blue-100 text-blue-800 border-blue-300',
      headerGradient: 'from-blue-700 via-indigo-800 to-slate-900',
    },
    slate: {
      primary: 'bg-slate-800 hover:bg-slate-900 text-white',
      accent: 'text-slate-800 bg-slate-100 border-slate-300',
      selected: 'bg-slate-900 text-white font-black shadow-xs ring-2 ring-slate-400/50',
      activeBadge: 'bg-slate-200 text-slate-800 border-slate-400',
      headerGradient: 'from-slate-800 via-slate-900 to-black',
    },
  }[colorTheme];

  const gregorianEquiv = getGregorianEquivalent(selectedDate);
  const wordsDate = formatPersianDateInWords(selectedDate);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all"
        dir="rtl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with Title and Current Preview */}
        <div className={`p-4 bg-gradient-to-r ${themeColors.headerGradient} text-white relative`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-xs">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="text-[11px] text-white/80 font-medium">
                  تقویم رسمی هجری خورشیدی • انتخاب آسان با موس
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="بستن (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Selected Date Card Display */}
          <div className="mt-3 bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/70 block">تاریخ انتخاب‌شده:</span>
              <span className="text-sm font-black font-mono text-white tracking-wide">
                {selectedDate}
              </span>
              <span className="text-[11px] text-amber-200 font-bold block mt-0.5">
                {wordsDate}
              </span>
            </div>
            <div className="text-left bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/10">
              <span className="text-[9px] text-white/60 block">میلادی:</span>
              <span className="text-xs font-mono font-bold text-white/95">
                {gregorianEquiv}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] text-slate-500 font-bold shrink-0 ml-1">دسترسی سریع:</span>
          <button
            type="button"
            onClick={() => handleQuickPreset('today')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition border cursor-pointer shrink-0 ${
              selectedDate === todayStr
                ? themeColors.activeBadge
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            امروز
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('yesterday')}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            دیروز
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('tomorrow')}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            فردا
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('startOfMonth')}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            اول ماه
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('endOfMonth')}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            آخر ماه
          </button>
        </div>

        {/* Month and Year Navigator */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-white">
          <button
            type="button"
            onClick={() => {
              if (calMonth === 1) {
                setCalMonth(12);
                setCalYear(calYear - 1);
              } else {
                setCalMonth(calMonth - 1);
              }
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer active:scale-95"
            title="ماه قبل"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {/* Month Select */}
            <select
              value={calMonth}
              onChange={e => setCalMonth(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {PERSIAN_MONTHS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.altName})
                </option>
              ))}
            </select>

            {/* Year Select */}
            <select
              value={calYear}
              onChange={e => setCalYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {yearsList.map(y => (
                <option key={y} value={y}>
                  سال {y}
                </option>
              ))}
            </select>

            {/* Jump to Today's Month/Year */}
            <button
              type="button"
              onClick={() => {
                setCalYear(todayParts.year);
                setCalMonth(todayParts.month);
              }}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="بازگشت به ماه و سال جاری"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (calMonth === 12) {
                setCalMonth(1);
                setCalYear(calYear + 1);
              } else {
                setCalMonth(calMonth + 1);
              }
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer active:scale-95"
            title="ماه بعد"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 px-4 pt-3 pb-1 text-center bg-slate-50/50">
          {WEEKDAYS.map(w => (
            <div
              key={w.id}
              className={`text-[11px] font-black py-1 ${
                w.isHoliday ? 'text-rose-600' : 'text-slate-600'
              }`}
            >
              {w.label}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="p-4 grid grid-cols-7 gap-1.5 text-center">
          {/* Empty cells before 1st of month */}
          {Array.from({ length: startDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-9 w-full" />
          ))}

          {/* Days of viewed month */}
          {Array.from({ length: daysInCalMonth }).map((_, idx) => {
            const day = idx + 1;
            const dateFormatted = `${calYear}/${String(calMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
            const isSelected = dateFormatted === selectedDate;
            const isToday = dateFormatted === todayStr;
            const dayOfWeek = (startDayOfWeek + idx) % 7;
            const isFriday = dayOfWeek === 6;

            return (
              <button
                type="button"
                key={`day-${day}`}
                onClick={() => handleSelectDay(day)}
                onDoubleClick={() => handleSelectDay(day, true)}
                className={`h-9 w-full rounded-xl text-xs font-mono font-bold transition flex items-center justify-center relative cursor-pointer active:scale-95 ${
                  isSelected
                    ? themeColors.selected
                    : isToday
                    ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-black'
                    : isFriday
                    ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 bg-white border border-slate-100'
                    : 'text-slate-800 hover:bg-slate-100 bg-white border border-slate-100 hover:border-slate-300'
                }`}
              >
                <span>{day}</span>
                {isToday && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-medium">
            دوبار کلیک روی هر روز = انتخاب و تایید فوری
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleApply}
              className={`px-5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${themeColors.primary}`}
            >
              <Check className="w-4 h-4" />
              <span>تایید تاریخ ({selectedDate})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

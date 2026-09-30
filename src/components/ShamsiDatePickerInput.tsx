import React, { useState } from 'react';
import { Calendar, CalendarDays, CheckCircle2 } from 'lucide-react';
import { ShamsiDatePickerModal } from './ShamsiDatePickerModal';
import { getGregorianEquivalent } from '../utils/formatters';

export interface ShamsiDatePickerInputProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  colorTheme?: 'emerald' | 'blue' | 'slate';
  showGregorianPreview?: boolean;
  modalTitle?: string;
}

export const ShamsiDatePickerInput: React.FC<ShamsiDatePickerInputProps> = ({
  value,
  onChange,
  label,
  placeholder = '1405/06/15',
  id,
  className = '',
  inputClassName = '',
  required = false,
  disabled = false,
  readOnly = false,
  colorTheme = 'emerald',
  showGregorianPreview = false,
  modalTitle,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const gregorianEquiv = showGregorianPreview ? getGregorianEquivalent(value) : '';

  const focusRingClass = {
    emerald: 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
    blue: 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    slate: 'focus:border-slate-600 focus:ring-1 focus:ring-slate-600',
  }[colorTheme];

  const iconColorClass = {
    emerald: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50',
    blue: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
    slate: 'text-slate-600 hover:text-slate-800 hover:bg-slate-100',
  }[colorTheme];

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-bold text-slate-700 flex items-center justify-between"
        >
          <span className="flex items-center gap-1">
            {required && <span className="text-red-500">*</span>}
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{label}</span>
          </span>
          <button
            type="button"
            onClick={() => !disabled && setIsModalOpen(true)}
            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
            title="باز کردن تقویم و انتخاب تاریخ با موس"
          >
            <CalendarDays className="w-3 h-3" />
            <span>انتخاب از تقویم</span>
          </button>
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onClick={() => !disabled && setIsModalOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          className={`w-full pr-3 pl-10 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none transition text-center cursor-pointer hover:border-slate-400 ${focusRingClass} ${inputClassName} ${
            disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
          }`}
          title="برای انتخاب تاریخ شمسی با موس کلیک کنید"
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setIsModalOpen(true)}
          className={`absolute left-2 p-1.5 rounded-lg transition cursor-pointer active:scale-95 ${iconColorClass}`}
          title="باز کردن تقویم شمسی و انتخاب با موس"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {showGregorianPreview && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-mono mt-0.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>معادل میلادی: {gregorianEquiv}</span>
        </div>
      )}

      <ShamsiDatePickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        value={value}
        onChange={(newDate) => {
          onChange(newDate);
          setIsModalOpen(false);
        }}
        title={modalTitle || label || 'انتخاب تاریخ شمسی'}
        colorTheme={colorTheme}
      />
    </div>
  );
};

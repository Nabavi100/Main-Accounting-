import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, Check, Copy, RotateCcw, Save } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { convertCurrencyAmount, formatCalculatorAmount, formatWorkspaceRate, parseCurrencyInput, validCurrencyRate } from '../utils/workspaceHeader';
import { CloseButton } from './CloseButton';

interface CurrencyRateCalculatorProps { minimal?: boolean; compact?: boolean }

/** Local USD/AFN calculator. Only an explicit, confirmed save can change the system exchange rate. */
export const CurrencyRateCalculator: React.FC<CurrencyRateCalculatorProps> = ({ minimal = false, compact = false }) => {
  const { cashRegister, updateExchangeRate } = useAccounting();
  const systemRate = validCurrencyRate(cashRegister.usdToAfnRate) ? cashRegister.usdToAfnRate : null;
  const [open, setOpen] = useState(false);
  const [rateText, setRateText] = useState(systemRate === null ? '' : String(systemRate));
  const [source, setSource] = useState<'usd' | 'afn'>('usd');
  const [amountText, setAmountText] = useState('100');
  const [copied, setCopied] = useState<'usd' | 'afn' | null>(null);
  const [message, setMessage] = useState('');
  const [pendingRate, setPendingRate] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rate = parseCurrencyInput(rateText);
  const amount = parseCurrencyInput(amountText);
  const converted = convertCurrencyAmount(amount, rate, source);
  const usd = source === 'usd' ? amount : converted;
  const afn = source === 'afn' ? amount : converted;
  const customRate = validCurrencyRate(rate) && rate !== systemRate;

  useEffect(() => {
    setRateText(systemRate === null ? '' : String(systemRate));
    setPendingRate(null);
  }, [systemRate]);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [open]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const close = () => { setOpen(false); setPendingRate(null); };
  const editAmount = (direction: 'usd' | 'afn', value: string) => { setSource(direction); setAmountText(value); setMessage(''); };
  const copy = async (direction: 'usd' | 'afn') => {
    const value = direction === 'usd' ? usd : afn;
    if (value === null) return;
    try {
      await navigator.clipboard.writeText(formatCalculatorAmount(value, false));
      setCopied(direction); setMessage('مبلغ کپی شد.');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1600);
    } catch { setMessage('کپی در این مرورگر مجاز نیست.'); }
  };
  const applyRate = () => {
    if (!validCurrencyRate(pendingRate) || pendingRate !== rate) return;
    updateExchangeRate(pendingRate);
    setPendingRate(null); setMessage('نرخ برنامه ذخیره شد.');
  };
  const currencyField = (direction: 'usd' | 'afn') => {
    const isUsd = direction === 'usd', numeric = isUsd ? usd : afn;
    const quick = isUsd ? [10, 50, 100, 500, 1000] : [1000, 5000, 10000, 50000, 100000];
    return <div className={`currency-calculator-field ${source === direction ? 'is-active' : ''}`}>
      <div className="currency-calculator-label"><label htmlFor={`currency-calculator-${direction}`}>{isUsd ? 'دلار (USD)' : 'افغانی (AFN)'}</label>
        <button type="button" className="currency-calculator-copy" title={isUsd ? 'کپی مبلغ دلار' : 'کپی مبلغ افغانی'} aria-label={isUsd ? 'کپی مبلغ دلار' : 'کپی مبلغ افغانی'} disabled={numeric === null} onClick={() => { void copy(direction); }}>
          {copied === direction ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span>{copied === direction ? 'کپی شد' : 'کپی'}</span>
        </button>
      </div>
      <input id={`currency-calculator-${direction}`} type="text" inputMode="decimal" dir="ltr" autoComplete="off" spellCheck={false}
        value={source === direction ? amountText : formatCalculatorAmount(converted)}
        aria-invalid={source === direction && amountText !== '' && amount === null}
        onChange={event => editAmount(direction, event.target.value)} placeholder="0" />
      <div className="currency-calculator-quick" aria-label={isUsd ? 'مبالغ آماده دلار' : 'مبالغ آماده افغانی'}>
        {quick.map(value => <button key={value} type="button" onClick={() => editAmount(direction, String(value))}>
          <bdi dir="ltr">{isUsd ? '$' : ''}{new Intl.NumberFormat('fa-AF').format(value)}{isUsd ? '' : ' ؋'}</bdi>
        </button>)}
      </div>
    </div>;
  };

  return <div className="currency-rate-calculator">
    <button ref={triggerRef} id="header-btn-currency-calculator" type="button" className={`currency-calculator-trigger ${compact ? 'is-compact' : ''}`}
      aria-label="ماشین حساب ارزی" title="ماشین حساب ارزی؛ دلار و افغانی" aria-haspopup="dialog" aria-expanded={open} aria-controls="header-currency-calculator-popover"
      onClick={() => { setMessage(''); setPendingRate(null); setOpen(true); }}>
      <Calculator aria-hidden="true" />{!compact && <span>{minimal ? `$ ${formatWorkspaceRate(systemRate)}` : 'محاسبه ارز'}</span>}
    </button>
    {open && createPortal(<dialog ref={dialogRef} id="header-currency-calculator-popover" className="currency-calculator-dialog" aria-labelledby="currency-calculator-title"
      onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="currency-calculator-heading app-modal-heading"><div><h2 id="currency-calculator-title"><Calculator aria-hidden="true" />ماشین حساب ارزی</h2><p>دلار ↔ افغانی</p></div><CloseButton ref={closeRef} aria-label="بستن ماشین حساب ارزی" onClick={close} /></div>
      <div className="currency-calculator-body">
        <div className="currency-calculator-rate"><label htmlFor="currency-calculator-rate">نرخ محاسبه (موقت)</label>
          <div className="currency-calculator-rate-row"><input id="currency-calculator-rate" type="text" inputMode="decimal" dir="ltr" autoComplete="off" value={rateText}
            aria-invalid={!validCurrencyRate(rate)} onChange={event => { setRateText(event.target.value); setPendingRate(null); setMessage(''); }} placeholder="65" /><span>AFN / USD</span>
            {customRate && <button type="button" onClick={() => { setRateText(systemRate === null ? '' : String(systemRate)); setPendingRate(null); }} title="بازگشت به نرخ برنامه" aria-label="بازگشت به نرخ برنامه"><RotateCcw aria-hidden="true" /></button>}
          </div>
          <div className="currency-calculator-rate-note"><small>نرخ برنامه: {formatWorkspaceRate(systemRate)} ؋</small>
            {customRate && <button type="button" className="currency-calculator-save" onClick={() => setPendingRate(rate)} title="فقط با تأیید، نرخ برنامه تغییر می‌کند؛ اسناد قبلی بازنویسی نمی‌شوند."><Save aria-hidden="true" />ثبت نرخ سیستم</button>}
          </div>
          {!validCurrencyRate(rate) && <small className="currency-calculator-error">نرخ معتبر و بزرگ‌تر از صفر وارد کنید.</small>}
        </div>
        {pendingRate !== null && <section className="currency-calculator-confirm" aria-label="تأیید تغییر نرخ برنامه"><p>نرخ برنامه به {formatWorkspaceRate(pendingRate)} افغانی تغییر کند؟</p><div>
          <button type="button" className="is-primary" onClick={applyRate}>تأیید نرخ</button><button type="button" onClick={() => setPendingRate(null)}>انصراف</button>
        </div></section>}
        {currencyField('usd')}
        {currencyField('afn')}
        <output className="currency-calculator-summary" aria-label="نتیجه تبدیل">{converted === null ? '—' : <><bdi dir="ltr">{formatCalculatorAmount(usd)}</bdi> دلار = <bdi dir="ltr">{formatCalculatorAmount(afn)}</bdi> افغانی</>}</output>
        <p className="currency-calculator-message" role="status">{message}</p>
      </div>
    </dialog>, document.body)}
  </div>;
};

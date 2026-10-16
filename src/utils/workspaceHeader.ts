const timeZone = 'Asia/Kabul';
const dateFormatter = new Intl.DateTimeFormat('fa-AF-u-ca-persian', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const clockFormatter = new Intl.DateTimeFormat('fa-AF', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const fullDateFormatter = new Intl.DateTimeFormat('fa-AF-u-ca-persian', { timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

/** Real current time, including midnight rollover, in the accounting workspace's Kabul timezone. */
export const workspaceDateTime = (date: Date) => ({ date: dateFormatter.format(date), time: clockFormatter.format(date), fullDate: fullDateFormatter.format(date), iso: date.toISOString() });

/** Accept both local digit alphabets, decimal/thousands separators and plain keyboard numbers. */
export const parseCurrencyInput = (value: string | number): number | null => {
  const normalized = String(value).trim()
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u200e\u200f\u061c]/g, '')
    .replace(/[,٬\s]/g, '').replace(/٫/g, '.');
  if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};
export const validCurrencyRate = (rate: unknown): rate is number => typeof rate === 'number' && Number.isFinite(rate) && rate > 0;

/** Read-only conversion. Invalid or temporary-empty inputs must never reuse a stale valid rate. */
export const convertCurrencyAmount = (amount: number | null, rate: number | null, source: 'usd' | 'afn'): number | null => {
  if (amount === null || !Number.isFinite(amount) || amount < 0 || !validCurrencyRate(rate)) return null;
  const result = source === 'usd' ? amount * rate : amount / rate;
  return Number.isFinite(result) ? result : null;
};
export const formatCalculatorAmount = (value: number | null, grouped = true): string => value !== null && Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6, useGrouping: grouped }).format(value) : '';
export const formatWorkspaceRate = (rate: unknown): string => validCurrencyRate(rate)
  ? new Intl.NumberFormat('fa-AF', { maximumFractionDigits: 6 }).format(rate) : '—';

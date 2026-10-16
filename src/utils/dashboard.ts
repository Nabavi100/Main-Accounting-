import type { Invoice, Party } from '../types';
import { jalaliToGregorian, normalizePersianDate } from './formatters';

export type DashboardCalendar = 'jalali' | 'gregorian';

const persianCalendar = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Kabul', year: 'numeric', month: '2-digit', day: '2-digit',
});
const gregorianCalendar = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
  timeZone: 'Asia/Kabul', year: 'numeric', month: '2-digit', day: '2-digit',
});

const calendarParts = (date: Date, calendar: DashboardCalendar) => {
  const parts = (calendar === 'jalali' ? persianCalendar : gregorianCalendar).formatToParts(date);
  return {
    year: Number(parts.find(part => part.type === 'year')?.value),
    month: Number(parts.find(part => part.type === 'month')?.value),
    day: Number(parts.find(part => part.type === 'day')?.value),
  };
};

/** Read both legacy Persian dates and Gregorian dates without guessing today's date. */
export const parseDashboardDate = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = normalizePersianDate(value.split(/[T\s]/)[0]);
  const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1200) return null;

  const calendar: DashboardCalendar = year < 1700 ? 'jalali' : 'gregorian';
  const iso = calendar === 'jalali'
    ? jalaliToGregorian(year, month, day)
    : `${yearText}-${monthText}-${dayText}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const actual = calendarParts(date, calendar);
  return actual.year === year && actual.month === month && actual.day === day ? date : null;
};

export const getMonthlySales = (
  invoices: Invoice[],
  toAFN: (amount: number, currency: string) => number,
  calendar: DashboardCalendar = 'jalali',
  now: Date = new Date(),
) => {
  const current = calendarParts(now, calendar);
  const previous = current.month === 1
    ? { year: current.year - 1, month: 12 }
    : { year: current.year, month: current.month - 1 };
  let currentMonthAFN = 0;
  let previousMonthAFN = 0;
  let salesCount = 0;

  for (const invoice of invoices) {
    if (invoice.type !== 'sell' && invoice.type !== 'return_sell') continue;
    const date = parseDashboardDate(invoice.date);
    if (!date) continue;
    const period = calendarParts(date, calendar);
    const amount = Number.isFinite(invoice.totalAmount) ? invoice.totalAmount : 0;
    const converted = toAFN(amount, invoice.currency);
    if (!Number.isFinite(converted)) continue;
    const signedAmount = (invoice.type === 'return_sell' ? -1 : 1) * converted;
    if (period.year === current.year && period.month === current.month) {
      currentMonthAFN += signedAmount;
      if (invoice.type === 'sell') salesCount += 1;
    } else if (period.year === previous.year && period.month === previous.month) {
      previousMonthAFN += signedAmount;
    }
  }

  // No invented growth percentage when the comparison period has no positive sales.
  const growthPercent = previousMonthAFN > 0
    ? ((currentMonthAFN - previousMonthAFN) / previousMonthAFN) * 100
    : null;
  return { currentMonthAFN, previousMonthAFN, growthPercent, salesCount };
};

export const getPartyBalanceTotals = (parties: Party[]) => {
  const totals = { receivableAFN: 0, receivableUSD: 0, payableAFN: 0, payableUSD: 0 };
  for (const party of parties) {
    const afn = Number.isFinite(party.balanceAFN) ? party.balanceAFN : 0;
    const usd = Number.isFinite(party.balanceUSD) ? party.balanceUSD : 0;
    // The existing ledger uses negative balances for receivables, positive for payables.
    if (afn < 0) totals.receivableAFN -= afn;
    else totals.payableAFN += afn;
    if (usd < 0) totals.receivableUSD -= usd;
    else totals.payableUSD += usd;
  }
  return totals;
};

export const getRecentInvoices = (invoices: Invoice[], limit = 5): Invoice[] => {
  const timestamp = (invoice: Invoice) => {
    const createdAt = Date.parse(invoice.createdAt);
    if (Number.isFinite(createdAt)) return createdAt;
    return parseDashboardDate(invoice.date)?.getTime() ?? 0;
  };
  return [...invoices].sort((a, b) => timestamp(b) - timestamp(a)).slice(0, limit);
};

export const normalizeDashboardSearch = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[يى]/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/[\u200c\u200e\u200f]/g, '')
  .replace(/\s+/g, ' ');

export const searchDashboardParties = (parties: Party[], query: string): Party[] => {
  const term = normalizeDashboardSearch(query);
  if (!term) return [];
  return parties.filter(party => [party.name, party.code, party.phone, party.company]
    .some(value => normalizeDashboardSearch(value || '').includes(term))).slice(0, 8);
};

export const formatDashboardAmount = (value: number, decimals = 2): string => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(Number.isFinite(value) ? value : 0);

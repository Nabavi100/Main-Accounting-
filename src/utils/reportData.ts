export type ReportCell = string | number | null | undefined;
export interface ReportSection {
  title: string;
  headers: string[];
  rows: ReportCell[][];
  footer?: ReportCell[][];
}
export interface ReportData {
  title: string;
  subtitle?: string;
  metadata?: { label: string; value: string }[];
  sections: ReportSection[];
}
export interface ReportBrand { name: string; logoUrl?: string; phone?: string; address?: string }

export const reportCellText = (value: ReportCell): string => {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'مقدار نامعتبر';
  return String(value).replace(/\u0000/g, '');
};
export const reportRowCount = (report: ReportData): number => report.sections.reduce((sum, section) => sum + section.rows.length, 0);
export const safeReportFilename = (name: string): string => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 140) || 'گزارش';
export const uniqueSheetName = (title: string, used: Set<string>): string => {
  const base = title.replace(/[\\/*?:\[\]\u0000-\u001f]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31).replace(/[\uD800-\uDBFF]$/, '') || 'گزارش';
  let name = base, index = 2;
  while (used.has(name.toLocaleLowerCase())) { const suffix = ` (${index++})`; name = base.slice(0, 31 - suffix.length) + suffix; }
  used.add(name.toLocaleLowerCase());
  return name;
};
export const escapeReportHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text is chunked before HTML escaping, so Telegram's parsed-text length stays below 4096. No rows are silently dropped. */
export const reportTelegramChunks = (report: ReportData, brand: ReportBrand, limit = 3400): string[] => {
  if (limit < 100) throw new Error('Telegram chunk size is too small');
  const lines = [brand.name, report.title, report.subtitle || '', ...(report.metadata || []).map(item => `${item.label}: ${item.value}`)];
  for (const section of report.sections) {
    lines.push('', section.title, section.headers.join(' | '));
    section.rows.forEach((row, index) => lines.push(`${index + 1}. ${row.map(reportCellText).join(' | ')}`));
    if (!section.rows.length) lines.push('بدون ردیف مطابق فیلتر');
    section.footer?.forEach(row => lines.push(row.map(reportCellText).join(' | ')));
  }
  const chunks: string[] = [];
  let current = '';
  for (const original of lines) {
    // Split unusually long notes as well; never split a UTF-16 surrogate pair.
    let line = original;
    while (line.length) {
      let room = limit - current.length - (current ? 1 : 0);
      if (room <= 0) { chunks.push(current); current = ''; continue; }
      let piece = line.slice(0, room);
      if (/[\uD800-\uDBFF]$/.test(piece)) piece = piece.slice(0, -1);
      if (!piece) { chunks.push(current); current = ''; continue; }
      current += `${current ? '\n' : ''}${piece}`;
      line = line.slice(piece.length);
      if (line.length) { chunks.push(current); current = ''; }
    }
  }
  if (current) chunks.push(current);
  return chunks.map(escapeReportHtml);
};

/** Row-aware slicing for existing invoice/receipt paper. Oversized rows continue without losing pixels. */
export const planPdfSlices = (height: number, pageHeight: number, rows: { top: number; bottom: number }[] = []): { top: number; height: number }[] => {
  if (!Number.isFinite(height) || !Number.isFinite(pageHeight) || height <= 0 || pageHeight <= 0) throw new Error('Invalid PDF dimensions');
  const result: { top: number; height: number }[] = [];
  let top = 0;
  while (top < height - 0.1) {
    let bottom = Math.min(top + pageHeight, height);
    const crossing = rows.find(row => row.top < bottom - 0.1 && row.bottom > bottom + 0.1 && row.top > top + 1 && row.bottom - row.top < pageHeight);
    if (crossing) bottom = crossing.top;
    result.push({ top, height: bottom - top });
    top = bottom;
  }
  return result;
};

/** A fresh snapshot; callers supply the exact currently filtered data and native numeric values. */
export const tableReport = (title: string, headers: string[], rows: ReportCell[][], footer?: ReportCell[][]): ReportData => ({
  title, sections: [{ title, headers, rows, footer }],
});

/** Portable attachment name: some download managers discard non-ASCII names, including the extension. The document title stays Persian inside the file. */
export const portableReportFilename = (filename: string, date = new Date()): string => {
  const extension = filename.match(/\.(pdf|xlsx)$/i)?.[1].toLowerCase() || 'pdf';
  const safe = `${safeReportFilename(filename.replace(/\.(pdf|xlsx)$/i, '')).slice(0, 120)}.${extension}`;
  if (/^[\x20-\x7e]+$/.test(safe)) return safe;
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `accounting-report-${stamp}.${extension}`;
};

export const reportPaymentStatus = (value?: string): string => ({ paid: 'تسویه‌شده', partial: 'بخشی پرداخت‌شده', unpaid: 'پرداخت‌نشده' })[value || ''] || value || '';

export const normalizeReportDigits = (value: string): string => value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));

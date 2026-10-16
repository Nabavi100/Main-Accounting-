import type { ReportData, ReportSection } from './reportData';

// innerText follows rendered visibility; textContent would leak hidden responsive copies.
const text = (node: HTMLElement): string => node.innerText.replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const isVisible = (node: HTMLElement): boolean => !!node.getClientRects().length && !node.closest('[hidden], [aria-hidden="true"], dialog, [role="dialog"], [data-report-ignore]') && getComputedStyle(node).visibility !== 'hidden';
const cells = (row: HTMLTableRowElement): string[] => Array.from(row.cells).flatMap(cell => [text(cell), ...Array(Math.max(0, cell.colSpan - 1)).fill('')]);
const emptyState = (row: HTMLTableRowElement): boolean => row.cells.length === 1 && row.cells[0].colSpan > 1 && /(?:یافت نشد|پیدا نشد|وجود ندارد|هنوز .*(?:نشده|ندارد)|هیچ .*نیست|بدون .*مطابق)/.test(text(row.cells[0]));

/** Fallback for ordinary rendered tables. Native financial/card adapters are preferred. Never mutates accounting state. */
export const reportFromTables = (root: HTMLElement, title: string): ReportData => {
  const sections: ReportSection[] = [];
  for (const table of root.querySelectorAll<HTMLTableElement>('table')) {
    if (!isVisible(table) || table.parentElement?.closest('table')) continue;
    const header = Array.from(table.tHead?.rows || []).at(-1);
    if (!header) continue;
    const indices: number[] = [], headers: string[] = [];
    let column = 0;
    Array.from(header.cells).forEach(cell => {
      const label = text(cell), span = cell.colSpan;
      if (isVisible(cell) && !/^(?:عملیات|اقدامات|مدیریت سند)(?:\s|$)/.test(label) && !(!label && cell.querySelector('input,button'))) {
        for (let offset = 0; offset < span; offset++) { indices.push(column + offset); headers.push(label || `ستون ${column + offset + 1}`); }
      }
      column += span;
    });
    if (!headers.length) continue;
    const read = (row: HTMLTableRowElement) => { const expanded = cells(row); return indices.map(index => expanded[index] || ''); };
    const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows)).filter(row => isVisible(row) && !emptyState(row)).map(read);
    const footer = Array.from(table.tFoot?.rows || []).filter(isVisible).map(read);
    const panel = table.closest('section, [data-report-section]');
    const heading = panel?.querySelector<HTMLElement>('h2,h3,h4');
    sections.push({ title: heading ? text(heading) : sections.length ? `${title} — جدول ${sections.length + 1}` : title, headers, rows, footer });
  }
  if (!sections.length) throw new Error('در این نما جدول قابل خروجی وجود ندارد. ابتدا فهرست یا گزارش را باز کنید.');
  return { title, sections };
};

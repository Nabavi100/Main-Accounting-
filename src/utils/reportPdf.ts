import { reportCellText, reportRowCount, safeReportFilename, planPdfSlices, type ReportBrand, type ReportData, type ReportSection, type ReportCell } from './reportData';
import { downloadBlob } from './reportExcel';
import fontUrl from '@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2?url';

let exportFontReady: Promise<void> | undefined;
const ensureExportFont = (): Promise<void> => {
  if (!exportFontReady) exportFontReady = (async () => {
    // Canvas is created in the main document, even when the source is an iframe.
    // Register its Persian font in BOTH documents; iframe-only font faces render blank in canvas.
    const face = new FontFace('ExportVazirmatn', `url(${JSON.stringify(new URL(fontUrl, window.location.href).href)})`, { weight: '100 900' });
    await face.load(); document.fonts.add(face);
  })().catch(error => { exportFontReady = undefined; throw error; });
  return exportFontReady;
};

const pdfLibraries = async () => {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas-pro')]);
  return { jsPDF, html2canvas };
};
const addPdfPage = (pdf: import('jspdf').jsPDF, canvas: HTMLCanvasElement, width: number, first: boolean) => {
  if (!first) pdf.addPage();
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 10, 10, width, canvas.height / canvas.width * width, undefined, 'FAST');
  canvas.width = 1; canvas.height = 1;
};
const captureOptions = { scale: 1.7, backgroundColor: '#ffffff', useCORS: true, allowTaint: false, logging: false, imageTimeout: 10000 };

/** Direct PDF from the existing branded document preview. No print call and no Telegram side effect. */
export const downloadElementPdf = async (element: HTMLElement, filename: string): Promise<void> => {
  await document.fonts.ready;
  const { jsPDF, html2canvas } = await pdfLibraries();
  const width = Math.max(element.offsetWidth, element.scrollWidth);
  const height = Math.max(element.offsetHeight, element.scrollHeight);
  const landscape = width > 1100;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
  const printableWidth = pdf.internal.pageSize.getWidth() - 20;
  const printableHeight = pdf.internal.pageSize.getHeight() - 20;
  const bounds = element.getBoundingClientRect();
  const rows = Array.from(element.querySelectorAll('tr')).map(row => {
    const rect = row.getBoundingClientRect();
    return { top: rect.top - bounds.top, bottom: rect.bottom - bounds.top };
  });
  const slices = planPdfSlices(height, width * printableHeight / printableWidth, rows);
  for (let index = 0; index < slices.length; index++) {
    const slice = slices[index];
    const canvas = await html2canvas(element, { ...captureOptions, width, height: Math.ceil(slice.height), y: slice.top, windowWidth: Math.max(document.documentElement.clientWidth, width), onclone: cloned => {
      const paper = cloned.getElementById(element.id);
      if (paper) { paper.style.transition = 'none'; paper.style.boxShadow = 'none'; }
    } });
    addPdfPage(pdf, canvas, printableWidth, index === 0);
  }
  pdf.setProperties({ title: filename });
  downloadBlob(new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' }), `${safeReportFilename(filename)}.pdf`);
};

const make = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, value?: string): HTMLElementTagNameMap[K] => {
  const node = doc.createElement(tag);
  if (value !== undefined) node.textContent = value;
  return node;
};

/** Clean A4 report pages with repeat headers. Persian shaping comes from the browser + local font, not a remote PDF service. */
export const downloadReportPdf = async (report: ReportData, brand: ReportBrand): Promise<void> => {
  await ensureExportFont();
  const landscape = report.sections.some(section => section.headers.length > 7);
  const width = Math.round((landscape ? 297 : 210) * 96 / 25.4);
  const height = Math.round((landscape ? 210 : 297) * 96 / 25.4);
  const frame = document.createElement('iframe');
  frame.title = 'آماده‌سازی فایل PDF'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width + 30}px;height:${height + 60}px;border:0;pointer-events:none;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body></body></html>'); doc.close();
    const style = make(doc, 'style');
    style.textContent = `@font-face{font-family:ExportVazirmatn;src:url(${JSON.stringify(new URL(fontUrl, window.location.href).href)}) format('woff2');font-weight:100 900;font-display:block}*{box-sizing:border-box}body{margin:0;background:#fff;color:#172b3a;font-family:ExportVazirmatn,Tahoma,sans-serif;font-size:11px;direction:rtl}.report-page{position:relative;width:${width}px;min-height:${height}px;padding:28px 30px 50px;background:#fff;margin:0 0 15px}.report-heading{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1281aa;padding-bottom:12px;margin-bottom:14px}.report-heading img{width:54px;height:54px;object-fit:contain}h1{font-size:17px;margin:0 0 6px}h2{font-size:13px;margin:9px 0}p{margin:3px 0;line-height:1.8}.report-meta{font-size:10px;color:#46545e;margin:8px 0 14px;line-height:1.8}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}th,td{border:1px solid #b9cbd4;padding:6px 5px;vertical-align:top;text-align:right;word-break:break-word;white-space:pre-wrap;line-height:1.8}th{background:#dfeff6;font-weight:700}tbody tr:nth-child(even){background:#f7fafc}.report-footer{position:absolute;bottom:17px;left:30px;right:30px;border-top:1px solid #b9cbd4;padding-top:6px;font-size:9px;color:#4e5c65;display:flex;justify-content:space-between}`;
    doc.head.appendChild(style);
    await doc.fonts.load('12px ExportVazirmatn'); await doc.fonts.ready;
    const pages: HTMLElement[] = [];
    const createPage = () => {
      if (pages.length >= 500) throw new Error('گزارش بیش از حد بزرگ است؛ بازهٔ تاریخ یا فیلترها را محدود کنید.');
      const page = make(doc, 'article'); page.className = 'report-page'; doc.body.appendChild(page);
      const heading = make(doc, 'header'); heading.className = 'report-heading'; page.appendChild(heading);
      if (brand.logoUrl) { const image = make(doc, 'img'); image.crossOrigin = 'anonymous'; image.src = brand.logoUrl; image.alt = brand.name; heading.appendChild(image); }
      const titles = make(doc, 'div'); heading.appendChild(titles); titles.appendChild(make(doc, 'h1', brand.name)); titles.appendChild(make(doc, 'h2', report.title));
      if (report.subtitle) titles.appendChild(make(doc, 'p', report.subtitle));
      if (brand.phone || brand.address) titles.appendChild(make(doc, 'p', [brand.phone, brand.address].filter(Boolean).join(' — ')));
      const meta = make(doc, 'div', [`تعداد ردیف‌ها: ${reportRowCount(report)}`, ...(report.metadata || []).map(item => `${item.label}: ${item.value}`)].join(' • ')); meta.className = 'report-meta'; page.appendChild(meta);
      const body = make(doc, 'div'); page.appendChild(body); pages.push(page);
      return { page, body };
    };
    let current = createPage();
    const tableFor = (section: ReportSection, continued: boolean) => {
      const block = make(doc, 'section'); current.body.appendChild(block);
      block.appendChild(make(doc, 'h2', section.title + (continued ? ' (ادامه)' : '')));
      const table = make(doc, 'table'); block.appendChild(table);
      const tr = make(doc, 'tr'); table.appendChild(make(doc, 'thead')).appendChild(tr);
      section.headers.forEach(label => tr.appendChild(make(doc, 'th', label)));
      const tbody = make(doc, 'tbody'); table.appendChild(tbody);
      return { block, tbody };
    };
    for (const section of report.sections) {
      let target = tableFor(section, false);
      const pending: ReportCell[][] = [...section.rows, ...(section.footer || [])].map(row => row.slice());
      if (!pending.length) pending.push(['بدون ردیف مطابق فیلتر']);
      while (pending.length) {
        let row = pending.shift()!;
        const tr = make(doc, 'tr');
        const fill = () => { tr.replaceChildren(); section.headers.forEach((_, index) => { const cell = make(doc, 'td', reportCellText(row[index])); cell.dir = 'auto'; tr.appendChild(cell); }); };
        fill(); target.tbody.appendChild(tr);
        const tooTall = () => tr.getBoundingClientRect().bottom - current.page.getBoundingClientRect().top > height - 48;
        if (tooTall()) {
          tr.remove();
          if (target.tbody.rows.length === 0 && current.body.children.length === 1) {
            // An unusually long note can span pages. Only its continuation text is repeated; money cells are not duplicated.
            while (true) {
              const strings = row.map(reportCellText);
              const longest = strings.reduce((best, cell, index) => cell.length > strings[best].length ? index : best, 0);
              if (strings[longest].length < 2) throw new Error('اندازهٔ ردیف برای فایل PDF مناسب نیست.');
              let split = Math.ceil(strings[longest].length / 2);
              if (/[\uD800-\uDBFF]$/.test(strings[longest].slice(0, split))) split--;
              const remainder = strings.map((cell, index) => index === longest ? cell.slice(split) : '');
              row = strings.map((cell, index) => index === longest ? cell.slice(0, split) : cell);
              pending.unshift(remainder);
              fill(); target.tbody.appendChild(tr);
              if (!tooTall()) break;
              tr.remove();
            }
          } else {
            if (!target.tbody.rows.length) target.block.remove();
            current = createPage(); target = tableFor(section, true); pending.unshift(row);
          }
        }
      }
    }
    pages.forEach((page, index) => {
      const footer = make(doc, 'footer'); footer.className = 'report-footer';
      footer.appendChild(make(doc, 'span', new Date().toLocaleString('fa-AF'))); footer.appendChild(make(doc, 'span', `صفحه ${index + 1} از ${pages.length}`)); page.appendChild(footer);
    });
    const { jsPDF, html2canvas } = await pdfLibraries();
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    for (let index = 0; index < pages.length; index++) {
      const canvas = await html2canvas(pages[index], { ...captureOptions, width, height, windowWidth: width + 30, windowHeight: height + 60 });
      // The page already includes its margins and footer.
      if (index) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
      canvas.width = 1; canvas.height = 1;
    }
    pdf.setProperties({ title: report.title, author: brand.name, subject: report.subtitle || '' });
    downloadBlob(new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' }), `${safeReportFilename(report.title)}.pdf`);
  } finally { frame.remove(); }
};

import { reportCellText, safeReportFilename, portableReportFilename, uniqueSheetName, type ReportBrand, type ReportData } from './reportData';

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = portableReportFilename(filename); link.hidden = true;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Actual OOXML workbook, not CSV or HTML renamed to .xlsx. String cells cannot execute formulas. */
export const downloadReportExcel = async (report: ReportData, brand: ReportBrand): Promise<void> => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = brand.name; workbook.subject = report.title; workbook.created = new Date();
  const names = new Set<string>();
  for (const section of report.sections) {
    const sheet = workbook.addWorksheet(uniqueSheetName(section.title, names), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 + (report.metadata?.length || 0) }] });
    sheet.addRow([brand.name]); sheet.addRow([report.title]); sheet.addRow([report.subtitle || '']);
    report.metadata?.forEach(item => sheet.addRow([`${item.label}: ${item.value}`]));
    const header = sheet.addRow(section.headers);
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF183A52' }, name: 'Vazirmatn' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF0F7' } };
      cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
    });
    const add = (row: (string | number | null | undefined)[]) => sheet.addRow(row.map(value => typeof value === 'number' && Number.isFinite(value) ? value : reportCellText(value)));
    section.rows.forEach(add); section.footer?.forEach(add);
    sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: Math.max(1, section.headers.length) } };
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(55, Math.max(17, ...[section.headers[index] || '', ...section.rows.slice(0, 100).map(row => reportCellText(row[index]))].map(value => value.length + 3)));
      column.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
      column.numFmt = '0.###############';
    });
    sheet.eachRow((row, index) => {
      if (index < header.number) row.font = { name: 'Vazirmatn', bold: index < 3, size: index === 1 ? 16 : 11 };
      row.eachCell(cell => { if (!cell.font?.name) cell.font = { name: 'Vazirmatn', size: 11 }; });
    });
    sheet.pageSetup = { orientation: section.headers.length > 7 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${header.number}:${header.number}` };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeReportFilename(report.title)}.xlsx`);
};

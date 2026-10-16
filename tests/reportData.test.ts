import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reportCellText, reportRowCount, safeReportFilename, uniqueSheetName,
  escapeReportHtml, reportTelegramChunks, planPdfSlices, tableReport, portableReportFilename, reportPaymentStatus, normalizeReportDigits,
} from '../src/utils/reportData';
import { downloadReportExcel } from '../src/utils/reportExcel';

const brand = { name: 'شرکت تجارتی برادران نبوی' };

test('report cells preserve zero, negative amounts, fractional precision and literal text', () => {
  assert.equal(reportCellText(0), '0');
  assert.equal(reportCellText(-123.123456789), '-123.123456789');
  assert.equal(reportCellText('=SUM(1,2)'), '=SUM(1,2)');
  assert.equal(reportCellText('شرح فارسی\nخط دوم'), 'شرح فارسی\nخط دوم');
});
test('known settlement states are Persian; unknown or absent states are never invented', () => {
  assert.equal(reportPaymentStatus('paid'), 'تسویه‌شده'); assert.equal(reportPaymentStatus('partial'), 'بخشی پرداخت‌شده');
  assert.equal(reportPaymentStatus('unpaid'), 'پرداخت‌نشده'); assert.equal(reportPaymentStatus('old-state'), 'old-state');
  assert.equal(reportPaymentStatus(), '');
});
test('absent and nonfinite financial values never become fabricated zero amounts', () => {
  assert.equal(reportCellText(undefined), ''); assert.equal(reportCellText(null), '');
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(reportCellText(value), 'مقدار نامعتبر');
});
test('filenames cannot traverse directories or inject forbidden/control characters', () => {
  const name = safeReportFilename('گزارش / خرید\\فروش:<test>?*\u0000.pdf');
  assert.ok(!/[\\/:*?"<>|\u0000-\u001f]/.test(name)); assert.ok(name.endsWith('.pdf'));
  assert.equal(safeReportFilename('   '), 'گزارش');
});
test('download names retain real extensions even on ASCII-only download managers', () => {
  const now = new Date('2026-10-15T10:22:30Z');
  assert.equal(portableReportFilename('report.pdf', now), 'report.pdf');
  assert.equal(portableReportFilename('صورت حساب.pdf', now), 'accounting-report-20261015T102230Z.pdf');
  assert.equal(portableReportFilename('فهرست.xlsx', now), 'accounting-report-20261015T102230Z.xlsx');
  assert.ok(portableReportFilename('X'.repeat(300) + '.xlsx', now).endsWith('.xlsx'));
  assert.ok(portableReportFilename('گ'.repeat(300) + '.xlsx', now).endsWith('.xlsx'));
});
test('worksheet names handle illegal characters, the 31-character limit and case-insensitive collisions', () => {
  const used = new Set<string>();
  const first = uniqueSheetName('a/'.repeat(40), used);
  assert.ok(first.length <= 31); assert.ok(!/[\\/*?:\[\]]/.test(first));
  assert.notEqual(uniqueSheetName('A/'.repeat(40), used).toLowerCase(), first.toLowerCase());
  assert.equal(uniqueSheetName('same', used), 'same'); assert.equal(uniqueSheetName('SAME', used), 'SAME (2)');
});
test('worksheet names do not split surrogate pairs or retain XML control characters', () => {
  const name = uniqueSheetName('A'.repeat(30) + '📦\u0000', new Set());
  assert.ok(name.length <= 31); assert.ok(!/[\uD800-\uDBFF]$/.test(name)); assert.ok(!name.includes('\u0000'));
});
test('section row counts include all filtered sections but not footer totals', () => {
  const report = tableReport('گزارش', ['نام', 'مبلغ'], [['اول', 1], ['دوم', 2]], [['جمع', 3]]);
  report.sections.push({ title: 'دوم', headers: ['شرح'], rows: [['سطر سوم']] });
  assert.equal(reportRowCount(report), 3);
});
test('HTML in company names and customer notes is escaped rather than interpreted by Telegram', () => {
  assert.equal(escapeReportHtml('<b>الف & ب</b> "'), '&lt;b&gt;الف &amp; ب&lt;/b&gt; &quot;');
  const result = reportTelegramChunks(tableReport('<عنوان>', ['شرح'], [['<a href="x">یادداشت</a>']]), brand).join('');
  assert.ok(result.includes('&lt;عنوان&gt;')); assert.ok(!result.includes('<a'));
});
test('Telegram chunks include the last row, all sections and currency-separated totals', () => {
  const report = tableReport('آزمایش', ['کد', 'ارز', 'مبلغ'], Array.from({ length: 600 }, (_, index) => [`ROW-${index}`, index % 2 ? 'USD' : 'AFN', index + 0.123456789]), [['جمع USD', 'USD', 10], ['جمع AFN', 'AFN', 20]]);
  report.sections.push({ title: 'ادامه', headers: ['شرح'], rows: [['ردیف نهایی']] });
  const before = JSON.stringify(report), chunks = reportTelegramChunks(report, brand);
  assert.ok(chunks.length > 2); assert.ok(chunks.every(chunk => chunk.length <= 3400));
  const text = chunks.join('');
  assert.ok(text.includes('ROW-599')); assert.ok(text.includes('ردیف نهایی')); assert.ok(text.includes('جمع USD')); assert.ok(text.includes('جمع AFN'));
  assert.equal(JSON.stringify(report), before);
});
test('oversized notes and emoji are split without truncating content or cutting surrogate pairs', () => {
  const note = 'شرح📦'.repeat(5000) + 'END-OF-NOTE';
  const chunks = reportTelegramChunks(tableReport('آزمایش', ['شرح'], [[note]]), brand);
  assert.ok(chunks.every(chunk => chunk.length <= 3400 && !/[\uD800-\uDBFF]$/.test(chunk) && !/^[\uDC00-\uDFFF]/.test(chunk)));
  const text = chunks.join('').replace(/\n/g, '');
  assert.ok(text.includes(note)); assert.ok(text.endsWith('END-OF-NOTE'));
});
test('Telegram refuses unusably small chunk lengths', () => {
  assert.throws(() => reportTelegramChunks(tableReport('گزارش', ['الف'], []), brand, 10));
});
test('PDF slices cover every pixel with no gaps or overlaps', () => {
  for (const [height, page] of [[2900, 1000], [1000, 1000], [999.5, 400.25], [1, 100]]) {
    const slices = planPdfSlices(height, page);
    assert.equal(slices[0].top, 0);
    slices.forEach((slice, index) => { assert.ok(slice.height > 0 && slice.height <= page); if (index) assert.equal(slice.top, slices[index - 1].top + slices[index - 1].height); });
    assert.equal(slices.at(-1)!.top + slices.at(-1)!.height, height);
  }
});
test('PDF moves a normal crossing row to the following page instead of slicing it', () => {
  const slices = planPdfSlices(2200, 1000, [{ top: 900, bottom: 1050 }, { top: 1850, bottom: 2010 }]);
  assert.deepEqual(slices.map(slice => slice.top), [0, 900, 1850]);
  assert.equal(slices.at(-1)!.height, 350);
});
test('an oversized invoice row continues across PDF pages without dropping pixels', () => {
  const slices = planPdfSlices(3500, 1000, [{ top: 100, bottom: 3300 }]);
  assert.deepEqual(slices, [{ top: 0, height: 1000 }, { top: 1000, height: 1000 }, { top: 2000, height: 1000 }, { top: 3000, height: 500 }]);
});
test('invalid PDF dimensions fail clearly rather than looping or creating a blank download', () => {
  for (const [height, page] of [[0, 1], [1, 0], [NaN, 1], [1, Infinity], [-1, 2]]) assert.throws(() => planPdfSlices(height, page));
});

test('Excel download is real OOXML: RTL sheets, literal formula-like text, native numbers and no source mutation', async () => {
  const report = tableReport('گزارش مالی', ['کد', 'شرح', 'مبلغ', 'ارز'], [['0012', '=1+2', -12.123456789, 'USD'], ['بعدی', '<script>نمونه</script>', 0, 'AFN']], [['جمع', '', -12.123456789, 'USD']]);
  report.metadata = [{ label: 'جستجو', value: 'فیلتر جاری' }];
  report.sections.push({ title: report.sections[0].title, headers: ['شرح'], rows: [] });
  const before = JSON.stringify(report);
  let saved: Blob | undefined, suggested = '', clicked = false;
  const originalDocument = globalThis.document, createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  URL.createObjectURL = blob => { saved = blob as Blob; return 'blob:unit-test'; };
  URL.revokeObjectURL = () => {};
  globalThis.document = { body: { appendChild: () => {} }, createElement: () => ({ href: '', hidden: false, set download(value: string) { suggested = value; }, click: () => { clicked = true; }, remove: () => {} }) } as unknown as Document;
  try {
    await downloadReportExcel(report, brand);
    assert.ok(clicked && saved); assert.ok(suggested.endsWith('.xlsx'));
    const bytes = Buffer.from(await saved!.arrayBuffer()); assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    const { default: ExcelJS } = await import('exceljs'); const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    assert.equal(workbook.worksheets.length, 2); assert.equal(workbook.creator, brand.name);
    const sheet = workbook.worksheets[0]; assert.equal(sheet.views[0].rightToLeft, true);
    assert.equal(sheet.views[0].state, 'frozen'); assert.equal((sheet.views[0] as { ySplit?: number }).ySplit, 5);
    assert.equal(sheet.getCell('A6').value, '0012'); assert.equal(sheet.getCell('B6').value, '=1+2');
    assert.equal(sheet.getCell('B6').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('C6').value, -12.123456789); assert.equal(sheet.getCell('C7').value, 0);
    assert.equal(sheet.getCell('B7').value, '<script>نمونه</script>'); assert.ok(sheet.getCell('C6').numFmt.includes('###############'));
    assert.notEqual(workbook.worksheets[0].name, workbook.worksheets[1].name);
    assert.equal(sheet.getCell('A1').value, brand.name); assert.equal(JSON.stringify(report), before);
  } finally {
    globalThis.document = originalDocument; URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL;
  }
});

test('report filter digits accept both Persian and Arabic numerals without altering nonnumeric text', () => {
  assert.equal(normalizeReportDigits('۱۴۰۵/٧/٢٣'), '1405/7/23');
  assert.equal(normalizeReportDigits('-۱۲٫٣٤'), '-12٫34');
  assert.equal(normalizeReportDigits('شرح ۱'), 'شرح 1');
});

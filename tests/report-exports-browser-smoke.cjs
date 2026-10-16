/* End-to-end exports: real downloads, isolated synthetic data, every report leaf, and no live Telegram sends. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { launch, pageFor, login, navigateSidebar, clickSidebarPage, storagePrefix: prefix } = require('./browser-support.cjs');
const artifacts = process.env.REPORT_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-report-exports');
fs.mkdirSync(artifacts, { recursive: true });
const financeKeys = ['cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories', 'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements', 'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions', 'asset_groups', 'fixed_assets', 'shareholders', 'currencies'];
const snapshot = page => page.evaluate(({ prefix, financeKeys }) => Object.fromEntries(financeKeys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, financeKeys });
const toolbar = page => page.locator('[data-page-actions]');
const pdfPages = bytes => (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
const workbookRows = (workbook, heading) => {
  const sheet = workbook.worksheets[0]; let header = 0;
  sheet.eachRow((row, number) => { if (row.getCell(1).value === heading) header = number; });
  assert.ok(header > 0, `Missing header ${heading}`);
  const rows = []; for (let index = header + 1; index <= sheet.rowCount; index++) rows.push(sheet.getRow(index).values.slice(1));
  return rows;
};
async function download(page, button, filename) {
  const pending = page.waitForEvent('download', { timeout: 45000 });
  await button.click();
  let file;
  try { file = await pending; } catch (error) { console.error('Export UI:', await page.locator('.page-actions-error').allTextContents()); throw error; }
  assert.equal(await file.failure(), null); const name = file.suggestedFilename();
  assert.ok(name.endsWith(path.extname(filename)), `Real file extension is required: ${name}`);
  const location = path.join(artifacts, filename); await file.saveAs(location);
  const bytes = fs.readFileSync(location); assert.ok(bytes.length > 500);
  if (filename.endsWith('.pdf')) {
    assert.ok(bytes.subarray(0, 8).toString().startsWith('%PDF-'));
    assert.ok(bytes.subarray(-80).toString().includes('%%EOF')); assert.ok(pdfPages(bytes) >= 1);
  } else {
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes); return workbook;
  }
  return bytes;
}
async function seed(page) {
  await page.evaluate(async prefix => {
    const { getPersianDate } = await import('/src/utils/formatters.ts'); const date = getPersianDate();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 50;
    const context = canvas.getContext('2d'); context.fillStyle = '#ec2222'; context.fillRect(0, 0, 50, 50);
    context.fillStyle = '#ffffff'; context.fillRect(15, 8, 20, 34);
    const parties = [
      { id: 'alpha', code: '101', name: 'مشتری <مجاز> & همکار', groupId: 'g1', groupName: 'مشتریان', type: 'both', phone: '0700000000', balanceAFN: -120, balanceUSD: 35, initialBalanceAFN: -120, initialBalanceUSD: 35, createdAt: date, telegramChatId: 'test-party-chat' },
      { id: 'beta', code: '102', name: '=1+2', groupId: 'g2', groupName: 'همکاران', type: 'both', phone: '', balanceAFN: 10, balanceUSD: -5, createdAt: date },
    ];
    const invoices = [];
    for (const type of ['sell', 'buy']) for (let index = 0; index < (type === 'sell' ? 80 : 8); index++) {
      const party = parties[index % 2], amount = index + 0.123456789, currency = index % 2 ? 'USD' : 'AFN';
      invoices.push({ id: `${type}-${index}`, invoiceNumber: `EXPORT-${type.toUpperCase()}-${String(index).padStart(3, '0')}`, type, date, partyId: party.id, partyName: party.name, warehouseId: 'wh', warehouseName: 'گدام ملکی نمونه',
        items: [{ productId: 'product', productName: 'کالای نمونه', quantity: 1.25, unit: 'ton', unitPrice: amount / 1.25, total: amount, tonsCount: 1.25, bagsCount: 25, warehouseId: 'wh' }],
        totalAmount: amount, subTotal: amount, subtotal: amount, paidAmount: 0, balanceAmount: amount, discount: 0, shipping: 0, currency, paymentStatus: 'unpaid', paymentMethod: 'credit', exchangeRate: currency === 'USD' ? 65 : 1, createdAt: `2026-10-15T10:${String(index % 60).padStart(2, '0')}:00Z`, notes: 'اطلاعات ساختگی برای آزمون خروجی' });
    }
    for (const type of ['return_sell', 'return_buy']) invoices.push({ ...invoices[0], id: type, type, invoiceNumber: `EXPORT-${type}`, items: [...invoices[0].items] });
    const data = {
      company: { name: 'شرکت آزمایشی خروجی فارسی', phone: '0700000000', address: 'هرات — اطلاعات آزمایشی', logoUrl: canvas.toDataURL(), showStampOnInvoice: false, showSignatureOnInvoice: false },
      cash: { afnBalance: 5000, usdBalance: 200, exchangeUsdBalance: 0, usdToAfnRate: 65 },
      cash_accounts: [{ id: 'afn_cash', name: 'صندوق افغانی نمونه', currency: 'AFN', balance: 5000, initialBalance: 5000 }, { id: 'usd_cash', name: 'صندوق دالری نمونه', currency: 'USD', balance: 200, initialBalance: 200 }, { id: 'bank', name: 'بانک نمونه', currency: 'USD', balance: 40, initialBalance: 40 }],
      parties, party_groups: [{ id: 'g1', name: 'مشتریان' }, { id: 'g2', name: 'همکاران' }],
      products: [{ id: 'product', code: '201', name: 'کالای نمونه', categoryId: 'pc', category: 'گروه نمونه', baseUnit: 'تن (1000KG)', bagWeightKg: 50, bagsPerTon: 20, buyPriceAFN: 20, sellPriceAFN: 30, buyPriceUSD: 1, sellPriceUSD: 2, minStockTons: 1 }],
      product_categories: [{ id: 'pc', name: 'گروه نمونه' }],
      warehouses: [{ id: 'wh', name: 'گدام ملکی نمونه', code: '1', type: 'standard', location: 'هرات' }, { id: 'cw', name: 'گدام امانی نمونه', code: '2', type: 'consignment', location: 'هرات' }],
      stocks: [{ warehouseId: 'wh', productId: 'product', quantityTons: 10, quantityBags: 200 }], invoices,
      transactions: [
        { id: 'receipt', type: 'receive_payment', transactionNumber: 'TX-RECEIPT', date, partyId: 'alpha', partyName: parties[0].name, amount: 100, currency: 'USD', cashAmount: 6500, cashCurrency: 'AFN', isExchange: true, exchangeRate: 65, cashRegister: 'afn_cash', cashRegisterName: 'صندوق افغانی نمونه', description: 'دریافت تبدیلی نمونه', discountAmount: 1.123456 },
        { id: 'payment', type: 'make_payment', transactionNumber: 'TX-PAYMENT', date, partyId: 'beta', partyName: parties[1].name, amount: 10.123456, currency: 'USD', cashRegister: 'usd_cash', cashRegisterName: 'صندوق دالری نمونه', description: 'پرداخت نمونه' },
        { id: 'transfer', type: 'cash_transfer', transactionNumber: 'TX-TRANSFER', date, amount: 20.123456, targetAmount: 20.123456, currency: 'USD', targetCurrency: 'USD', fromCashRegister: 'usd_cash', toCashRegister: 'bank', description: 'انتقال نمونه' },
      ], transfers: [],
      consignment_movements: [{ id: 'deposit', type: 'deposit', documentNumber: 'CONS-1', documentType: 'manual', date, partyId: 'alpha', partyName: parties[0].name, productId: 'product', productName: 'کالای نمونه', warehouseId: 'cw', warehouseName: 'گدام امانی نمونه', quantityTons: 3, quantityBags: 60, unit: 'ton', notes: 'سپردهٔ نمونه' }],
      incomes: [{ id: 'income', incomeNumber: 'INC-1', receiptNumber: 'IR-1', title: 'عاید نمونه', categoryId: 'ic', categoryName: 'خدمات', date, amount: 12.123456, currency: 'AFN', payer: 'پرداخت‌کننده نمونه', cashRegisterId: 'afn_cash', cashRegisterName: 'صندوق افغانی نمونه' }],
      expenses: [{ id: 'expense', expenseNumber: 'EXP-1', receiptNumber: 'EP-1', title: 'هزینه نمونه', categoryId: 'ec', categoryName: 'مصارف نمونه', date, amount: 3.123456, currency: 'USD', recipient: 'دریافت‌کننده نمونه', cashRegisterId: 'usd_cash', cashRegisterName: 'صندوق دالری نمونه' }],
      income_categories: [{ id: 'ic', name: 'خدمات', code: '1' }], expense_categories: [{ id: 'ec', name: 'مصارف نمونه', code: '1' }], expense_definitions: [{ id: 'ed', code: '1', name: 'تعریف نمونه', categoryId: 'ec', categoryName: 'مصارف نمونه', description: 'شرح نمونه' }],
      asset_groups: [{ id: 'ag', name: 'تجهیزات', color: 'blue' }], fixed_assets: [{ id: 'asset', code: 'AS-1', name: 'دارایی نمونه', groupId: 'ag', groupName: 'تجهیزات', buyDate: date, cost: 1200.123456, currency: 'AFN', usefulLifeYears: 5, salvageValue: 0, location: 'دفتر', inCharge: 'مسئول نمونه' }],
      shareholders: [{ id: 'partner', name: 'شریک نمونه', role: 'شریک', capitalUSD: 200.123456, capitalAFN: 1000, profitShareAFN: 20, withdrawalsUSD: 5, phone: '' }],
      currencies: [{ id: 'AFN', code: 'AFN', name: 'افغانی', symbol: '؋', exchangeRateToAFN: 1, exchangeRateToUSD: 1 / 65, isBase: true }, { id: 'USD', code: 'USD', name: 'دالر', symbol: '$', exchangeRateToAFN: 65, exchangeRateToUSD: 1 }, { id: 'EUR', code: 'EUR', name: 'یورو', symbol: '€', exchangeRateToAFN: 75, exchangeRateToUSD: 75 / 65 }],
      audit_logs: Array.from({ length: 150 }, (_, index) => ({ id: `log-${index}`, timestamp: date, action: 'create', actionLabel: 'ایجاد', category: 'invoice', entityNumber: `AUDIT-${index}`, entityTitle: 'رویداد نمونه', details: `شرح ${index}`, user: 'آزمایش' })),
    };
    for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
    localStorage.setItem('accounting_telegram_settings_v1', JSON.stringify({ autoListenerEnabled: false, autoSendOnSave: true, botToken: 'not-a-real-token', defaultChatId: 'mock-chat', sendText: true, sendPhoto: false }));
  }, prefix);
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('.dash-quick').waitFor();
  await page.evaluate(() => document.querySelectorAll('[id^="toast-"] button').forEach(button => button.click()));
}
const eligible = destination => destination.id === 'sidebar-btn-journal' ||
  ['definitions', 'cash', 'cash_transfer_history', 'cash_log', 'purchase_invoices', 'sales_invoices', 'return_sell', 'return_buy', 'trade_hub', 'consignment', 'receipts_list', 'payments_list', 'legacy_receipts_list', 'legacy_payments_list', 'fixed_assets', 'shareholders', 'transactions', 'incomes', 'expenses', 'audit_log'].includes(destination.tab) ||
  destination.tab === 'legacy_trade' && destination.filter.endsWith('-list') || destination.tab === 'reports' && destination.filter !== 'backup' || destination.tab === 'telegram_manager' && destination.filter === 'logs';

(async () => {
  const started = Date.now(), errors = [], sent = []; let failSecond = true;
  const browser = await launch(); let page;
  try {
    page = await pageFor(browser, errors);
    await page.addInitScript(() => {
      window.__printCalls = 0; window.print = () => { window.__printCalls++; };
      window.__drawn = [];
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { window.__drawn.push(String(text)); return fill.call(this, text, ...args); };
    });
    await page.route('**/api/telegram/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ defaultChatId: 'mock-chat', botToken: '', autoPolling: false }) }));
    await page.route('**/api/telegram/send-message', route => {
      sent.push(JSON.parse(route.request().postData()));
      if (sent.length === 2 && failSecond) { failSecond = false; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'قطع آزمایشی ارسال' }) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, messageId: sent.length }) });
    });
    await login(page); await seed(page); const before = await snapshot(page);

    // Search is controlled by the real filtered list, not a decorative header input.
    await navigateSidebar(page, 'لیست فروشات'); await toolbar(page).waitFor();
    assert.equal(await page.locator('#trade-invoice-search').count(), 1);
    await page.locator('#trade-invoice-search').fill('EXPORT-SELL-003');
    assert.equal(await page.locator('.trade-invoice-list tbody tr').count(), 1);
    let workbook = await download(page, toolbar(page).locator('.is-excel'), 'filtered-sale.xlsx');
    let rows = workbookRows(workbook, 'شماره فاکتور');
    assert.equal(rows[0][0], 'EXPORT-SELL-003'); assert.equal(rows[0][5], 3.123456789); assert.equal(rows[0][2], '=1+2');
    assert.ok(!workbook.worksheets[0].getRow(5).values.includes('عملیات'));
    assert.ok(!rows.some(row => String(row[0]).includes('EXPORT-SELL-004')));
    assert.equal(workbook.worksheets[0].getCell('A1').value, 'شرکت آزمایشی خروجی فارسی');
    await page.evaluate(() => { window.__drawn = []; });
    await download(page, toolbar(page).locator('.is-pdf'), 'filtered-sale.pdf');
    assert.equal(await page.evaluate(() => window.__printCalls), 0); assert.equal(sent.length, 0);
    assert.ok(await page.evaluate(() => [...document.fonts].some(face => face.family === 'ExportVazirmatn' && face.status === 'loaded')), 'The Persian font must be registered in the canvas-owning document too');
    const text = await page.evaluate(() => window.__drawn.join(''));
    assert.ok(text.includes('EXPORT-SELL-003')); assert.ok(text.includes('شرکت') && text.includes('فارسی')); assert.ok(!text.includes('داشبورد مدیریتی'));

    await toolbar(page).getByRole('button', { name: 'فیلترهای فهرست', exact: true }).click();
    await page.locator('.page-actions-filters select').selectOption('alpha');
    assert.ok((await page.locator('.trade-invoice-list tbody').innerText()).includes('ثبت نشده') || await page.locator('.trade-invoice-list .trade-invoice-number').count() === 0);
    await page.locator('.page-actions-filters').getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();
    await toolbar(page).getByRole('button', { name: 'پاک کردن جستجوی فاکتور', exact: true }).click();
    assert.equal(await page.locator('.trade-invoice-number').count(), 80);
    await page.locator('.page-actions-filters').getByRole('button', { name: 'بستن فیلترهای فهرست', exact: true }).click();
    await page.evaluate(() => { window.__drawn = []; });
    const allPdf = await download(page, toolbar(page).locator('.is-pdf'), 'all-sales-multipage.pdf');
    assert.ok(pdfPages(allPdf) >= 2);
    const drawn = await page.evaluate(() => window.__drawn.join(''));
    for (let index = 0; index < 80; index++) assert.ok(drawn.includes(`EXPORT-SELL-${String(index).padStart(3, '0')}`), `PDF lost sale row ${index}`);

    // Real fullscreen and its fallback both remain usable; print preview exits fullscreen first.
    await toolbar(page).getByRole('button', { name: 'نمایش تمام‌صفحه', exact: true }).click();
    await toolbar(page).getByRole('button', { name: 'خروج از تمام‌صفحه', exact: true }).waitFor();
    await toolbar(page).locator('.is-print').click(); await page.locator('#printable-paper-canvas').waitFor();
    assert.equal(await page.evaluate(() => !!document.fullscreenElement || !!document.querySelector('.workspace-report-scope.is-expanded')), false);
    const previewPdf = await download(page, page.locator('#doc-pdf-execute-btn'), 'shared-report-preview.pdf'); assert.ok(pdfPages(previewPdf) >= 2);
    assert.equal(await page.evaluate(() => window.__printCalls), 0); assert.equal(sent.length, 0);
    await page.locator('#document-print-modal-close-btn').click();
    await page.evaluate(() => { Element.prototype.requestFullscreen = async () => { throw new Error('Fullscreen unavailable'); }; });
    await toolbar(page).getByRole('button', { name: 'نمایش تمام‌صفحه', exact: true }).click();
    await page.locator('.workspace-report-scope.is-expanded').waitFor(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.workspace-report-scope.is-expanded'));

    // The old shared invoice PDF button must not call print or invoice auto-send.
    await page.getByRole('button', { name: 'چاپ فاکتور #EXPORT-SELL-003', exact: true }).click();
    await page.locator('#printable-paper-canvas').waitFor();
    await download(page, page.locator('#doc-pdf-execute-btn'), 'invoice-direct.pdf');
    assert.equal(await page.evaluate(() => window.__printCalls), 0); assert.equal(sent.length, 0);
    await page.locator('#document-print-modal-close-btn').click();

    // Explicit Telegram recipient + confirmation. Opening/cancelling never sends; retry skips acknowledged parts.
    await toolbar(page).locator('.is-telegram').click(); let dialog = page.getByRole('dialog', { name: 'ارسال گزارش به تلگرام' });
    assert.equal(await dialog.getByRole('button', { name: 'تأیید و ارسال گزارش', exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'بستن', exact: true }).click(); assert.equal(sent.length, 0);
    await toolbar(page).locator('.is-telegram').click(); dialog = page.getByRole('dialog', { name: 'ارسال گزارش به تلگرام' });
    await dialog.getByLabel('گیرندهٔ گزارش تلگرام').selectOption('__default');
    await dialog.locator('input[type="checkbox"]').check(); await dialog.getByRole('button', { name: 'تأیید و ارسال گزارش', exact: true }).click();
    await dialog.getByRole('alert').waitFor(); assert.equal(sent.length, 2);
    await dialog.getByRole('button', { name: 'ادامهٔ ارسال', exact: true }).click();
    await dialog.getByRole('button', { name: 'ارسال شد', exact: true }).waitFor();
    assert.ok(sent.length > 2); assert.equal(sent.filter(payload => payload.textContent === sent[0].textContent).length, 1);
    assert.ok(sent.every(payload => payload.chatId === 'mock-chat' && payload.textContent.length < 10000));
    assert.ok(sent.map(payload => payload.textContent).join('').includes('EXPORT-SELL-079'));
    assert.ok(sent[0].textContent.includes('&lt;مجاز&gt;') && !sent[0].textContent.includes('<مجاز>'));
    await dialog.getByRole('button', { name: 'بستن', exact: true }).click();

    // DOM fallback retains colspan totals, drops operation columns, hidden children and empty-state filler rows.
    const dom = await page.evaluate(async () => {
      const { reportFromTables } = await import('/src/utils/reportDom.ts');
      const root = document.createElement('div'); root.innerHTML = '<table><thead><tr><th>نام</th><th>ارز</th><th>مبلغ</th><th>نوع عملیات</th><th>عملیات</th></tr></thead><tbody><tr><td>آزمایش<span hidden>متن مخفی</span></td><td>USD</td><td>12.123456</td><td>دریافت نقد</td><td><button>حذف</button></td></tr><tr><td colspan="2">جمع USD</td><td>12.123456</td><td></td><td></td></tr><tr><td colspan="5">نتیجه‌ای یافت نشد</td></tr></tbody><tfoot><tr><td colspan="2">جمع نهایی</td><td>12.123456</td><td></td><td></td></tr></tfoot></table><table hidden><thead><tr><th>مخفی</th></tr></thead></table>';
      document.body.appendChild(root); const report = reportFromTables(root, 'آزمایش'); root.remove(); return report;
    });
    assert.equal(dom.sections.length, 1); assert.deepEqual(dom.sections[0].headers, ['نام', 'ارز', 'مبلغ', 'نوع عملیات']);
    assert.equal(dom.sections[0].rows.length, 2); assert.equal(dom.sections[0].rows[0][0], 'آزمایش');
    assert.equal(dom.sections[0].rows[0][3], 'دریافت نقد'); assert.deepEqual(dom.sections[0].rows[1], ['جمع USD', '', '12.123456', '']); assert.equal(dom.sections[0].footer[0][0], 'جمع نهایی');

    // Oversized text gets continuation pages without duplicating the amount or losing its tail.
    await page.evaluate(() => { window.__drawn = []; });
    const tallDownload = page.waitForEvent('download', { timeout: 45000 });
    await page.evaluate(async () => {
      const { downloadReportPdf } = await import('/src/utils/reportPdf.ts');
      await downloadReportPdf({ title: 'آزمایش شرح بلند', sections: [{ title: 'شرح کامل', headers: ['شرح', 'مبلغ'], rows: [[('شرح فارسی بسیار طولانی '.repeat(300)) + 'TAIL-OF-LONG-ROW', 123.123456]] }] }, { name: 'شرکت آزمایشی خروجی فارسی' });
    });
    const tallFile = await tallDownload; await tallFile.saveAs(path.join(artifacts, 'oversized-row.pdf'));
    assert.ok(pdfPages(fs.readFileSync(path.join(artifacts, 'oversized-row.pdf'))) > 1);
    const tallText = await page.evaluate(() => window.__drawn.join('')); assert.ok(tallText.includes('TAIL-OF-LONG-ROW'));
    assert.equal((tallText.match(/123\.123456/g) || []).length, 1);

    // Persian/Arabic digits and unpadded Shamsi dates are usable in the new filter drawer too.
    await clickSidebarPage(page, 'sidebar-btn-journal');
    await toolbar(page).getByRole('button', { name: 'فیلترهای فهرست', exact: true }).click();
    const persianDate = await page.evaluate(async () => { const { getPersianDate, normalizePersianDate } = await import('/src/utils/formatters.ts'); return normalizePersianDate(getPersianDate()).split('/').map(Number).join('/').replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]); });
    const journalRows = await page.locator('.workspace-report-content tbody tr').count(); assert.ok(journalRows > 1);
    for (let index = 0; index < 2; index++) {
      const dateField = page.locator('.page-actions-filters input').nth(index);
      await dateField.fill(index ? persianDate.replace(/[۰-۹]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 144)) : persianDate); await dateField.press('Tab');
      assert.match(await dateField.inputValue(), /^\d{4}\/\d{2}\/\d{2}$/);
    }
    assert.equal(await page.locator('.workspace-report-content tbody tr').count(), journalRows);


    const destinations = await page.evaluate(async prefix => {
      const { workspacePageGroups } = await import('/src/utils/navigation.ts');
      const accounts = JSON.parse(localStorage.getItem(prefix + 'cash_accounts'));
      return [{ id: 'sidebar-btn-dashboard', tab: 'dashboard' }, { id: 'sidebar-btn-journal', tab: 'journal' }, ...workspacePageGroups(accounts).flatMap(group => group.items.map(item => ({ ...item, id: `sidebar-page-${item.id}`, group: group.id })))];
    }, prefix);
    let covered = 0;
    for (const destination of destinations) {
      await clickSidebarPage(page, destination.id, destination.group);
      const expected = eligible(destination);
      if (expected) {
        await toolbar(page).waitFor(); assert.equal(await toolbar(page).count(), 1, `Duplicate toolbar: ${destination.id}`);
        workbook = await download(page, toolbar(page).locator('.is-excel'), `page-${destination.id}.xlsx`);
        assert.ok(workbook.worksheets.length > 0); assert.equal(workbook.creator, 'شرکت آزمایشی خروجی فارسی');
        assert.ok(workbook.worksheets.every(sheet => sheet.views[0].rightToLeft));
        if (destination.id === 'sidebar-page-audit-log') assert.equal(workbookRows(workbook, 'ردیف').length, 150, 'Audit output must not silently stop at 100');
        if (destination.id === 'sidebar-page-consignment') assert.equal(workbook.worksheets.length, 2);
        if (destination.id === 'sidebar-page-receipt-list') {
          const receipt = workbookRows(workbook, 'شماره سند').find(row => row[0] === 'TX-RECEIPT');
          assert.equal(receipt[5], 6500); assert.equal(receipt[6], 'AFN');
          assert.equal(receipt[10], 35); assert.equal(receipt[11], 'USD'); assert.equal(receipt[12], 'کنونی');
          await toolbar(page).getByRole('button', { name: 'فیلترهای فهرست', exact: true }).click();
          const filters = page.locator('.page-actions-filters');
          await filters.getByLabel('گروه طرف حساب', { exact: true }).selectOption('g1');
          await filters.getByLabel('کمترین مبلغ', { exact: true }).fill('٦٬٥٠٠٫٠');
          assert.equal(await filters.getByLabel('کمترین مبلغ', { exact: true }).inputValue(), '6500.0');
          const filtered = await download(page, toolbar(page).locator('.is-excel'), 'receipt-group-amount.xlsx');
          assert.ok(JSON.stringify(filtered.worksheets[0].getSheetValues()).includes('گروه طرف حساب: مشتریان'));
          const filteredRows = workbookRows(filtered, 'شماره سند');
          assert.equal(filteredRows.length, 2); assert.equal(filteredRows[0][0], 'TX-RECEIPT');
          await filters.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();

        }
        if (destination.id === 'sidebar-page-profit-loss') {
          await toolbar(page).getByRole('button', { name: 'فیلترهای فهرست', exact: true }).click();
          const filters = page.locator('.page-actions-filters');
          await filters.locator('input').first().fill('۱۴۰۵/۱/۱'); await filters.locator('input').first().press('Tab');
          assert.equal(await filters.getByLabel('دوره مالی', { exact: true }).inputValue(), 'custom');
          await filters.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();
          assert.equal(await filters.getByLabel('دوره مالی', { exact: true }).inputValue(), 'all');
          assert.deepEqual(await filters.locator('input').evaluateAll(inputs => inputs.map(input => input.value)), ['', '']);
        }
        if (destination.tab === 'incomes') {
          const row = workbookRows(workbook, 'شماره سند').find(row => row[0] === 'INC-1');
          assert.ok(row); assert.equal(row[1], 'IR-1'); assert.equal(row[9], 12.123456); assert.equal(row[10], 'AFN');
        }
        if (destination.tab === 'expenses') {
          const row = workbookRows(workbook, 'شماره سند').find(row => row[0] === 'EXP-1');
          assert.ok(row); assert.equal(row[1], 'EP-1'); assert.equal(row[7], 3.123456); assert.equal(row[8], 'USD');
        }
        if (['sidebar-page-profit-loss', 'sidebar-page-balance-sheet', 'sidebar-page-consignment', 'sidebar-page-receipt-list', 'sidebar-page-definition-currencies', 'sidebar-page-fixed-assets'].includes(destination.id)) await download(page, toolbar(page).locator('.is-pdf'), `page-${destination.id}.pdf`);
        covered++;
      } else assert.equal(await toolbar(page).count(), 0, `No report tools on entry forms or settings: ${destination.id}`);
    }
    assert.deepEqual(await snapshot(page), before, 'Export, search, filter, fullscreen, print preview and messaging must not change finance');
    assert.equal(await page.evaluate(() => window.__printCalls), 0); assert.deepEqual(errors, []);

    // Compact/mobile toolbar: all actions, real search and a real PDF download without horizontal overflow.
    await page.setViewportSize({ width: 390, height: 844 }); await navigateSidebar(page, 'لیست فروشات');
    await page.locator('#trade-invoice-search').fill('EXPORT-SELL-003');
    for (const action of ['.is-create', '.is-excel', '.is-pdf', '.is-telegram', '.is-print']) assert.ok(await toolbar(page).locator(action).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(artifacts, 'toolbar-mobile.png'), animations: 'disabled', timeout: 60000 });
    await download(page, toolbar(page).locator('.is-pdf'), 'mobile-filtered.pdf');
    await page.setViewportSize({ width: 1600, height: 950 });
    await page.screenshot({ path: path.join(artifacts, 'toolbar-desktop.png'), animations: 'disabled', timeout: 60000 });
    await toolbar(page).locator('.is-create').click(); await page.locator('#trade-invoice-number').waitFor();
    assert.equal(await toolbar(page).count(), 0); assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(errors, []);
    console.log(`Report exports PASS (${((Date.now() - started) / 1000).toFixed(2)}s): ${covered} list/report leaves; real PDF/XLSX, Persian font, pagination, Telegram confirmation/retry, mobile and unchanged finance.`);
    console.log(`Synthetic test artifacts: ${artifacts}`);
  } catch (error) {
    if (page) {
      console.error('Current export errors:', await page.locator('.page-actions-error').allTextContents().catch(() => []));
      await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled', timeout: 60000 }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

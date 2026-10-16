/* Focused navigation round trips, always in a fresh context with synthetic financial data. */
const assert = require('node:assert/strict');
const {
  launch, pageFor, login, navigateSidebar, readData, storagePrefix: prefix,
} = require('./browser-support.cjs');
const dataKeys = ['cash', 'cash_accounts', 'parties', 'stocks', 'invoices', 'transactions'];
const snapshot = page => page.evaluate(({ prefix, keys }) => Object.fromEntries(keys.map(key => [key, JSON.parse(localStorage.getItem(prefix + key) || 'null')])), { prefix, keys: dataKeys });
const waitBalances = (page, afn, usd, bank) => page.waitForFunction(({ prefix, afn, usd, bank }) => {
  const accounts = JSON.parse(localStorage.getItem(prefix + 'cash_accounts') || '[]');
  return accounts.find(a => a.id === 'afn_cash')?.balance === afn && accounts.find(a => a.id === 'usd_cash')?.balance === usd && accounts.find(a => a.id === 'bank')?.balance === bank;
}, { prefix, afn, usd, bank });
const current = (page, key) => page.waitForFunction(key => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === key, key);
async function workflowSmoke(browser, errors) {
  const page = await pageFor(browser, errors);
  page.setDefaultTimeout(15000);
  page.on('dialog', dialog => dialog.accept());
  try {
    await login(page);
    await page.evaluate(prefix => {
      const data = {
        cash_accounts: [
          { id: 'afn_cash', name: 'صندوق افغانی نمونه', currency: 'AFN', balance: 5000, initialBalance: 5000 },
          { id: 'usd_cash', name: 'صندوق دالری نمونه', currency: 'USD', balance: 200, initialBalance: 200 },
          { id: 'bank', name: 'بانک نمونه', currency: 'USD', balance: 40, initialBalance: 40 },
        ],
        cash: { afnBalance: 5000, usdBalance: 200, exchangeUsdBalance: 0, usdToAfnRate: 65 },
        parties: [{ id: 'party', name: 'شخص آزمایشی', code: '101', type: 'both', phone: '', balanceUSD: -50, balanceAFN: 30, createdAt: '2026-10-15' }],
        products: [{ id: 'product', name: 'کالای آزمایشی', code: '201', category: 'آزمایش', baseUnit: 'تن (1000KG)', bagWeightKg: 50, bagsPerTon: 20, buyPriceUSD: 20, sellPriceUSD: 25, buyPriceAFN: 1300, sellPriceAFN: 1625, minStockTons: 1 }],
        warehouses: [{ id: 'wh', name: 'گدام نمونه', type: 'standard', location: '' }],
        stocks: [{ warehouseId: 'wh', productId: 'product', quantityTons: 5, quantityBags: 100 }],
        invoices: [], transactions: [], transfers: [], consignment_movements: [], incomes: [], expenses: [],
      };
      for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
    }, prefix);
    await page.reload({ waitUntil: 'networkidle' });
    const before = await snapshot(page);
    const main = page.locator('main');
    await navigateSidebar(page, 'ثبت فاکتور خرید');
    await page.locator('#trade-invoice-number').fill('unsaved-page-navigation');
    await navigateSidebar(page, 'ثبت فاکتور خرید');
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), '1', 'A sidebar click must open the selected page, even when re-selecting its current leaf');
    assert.deepEqual(await snapshot(page), before);
    // Editing within the history page must retain the populated fields and return to that history on cancel/save.
    await navigateSidebar(page, 'عملیه صندوق به صندوق');
    await main.locator('select').nth(0).selectOption('usd_cash');
    await main.locator('select').nth(1).selectOption('bank');
    await main.getByPlaceholder('مثال: 50,000', { exact: true }).fill('10');
    await main.getByRole('button', { name: 'ثبت سند انتقال', exact: true }).click();
    await waitBalances(page, 5000, 190, 50);
    let transaction = (await readData(page, 'transactions'))[0];
    await navigateSidebar(page, 'تاریخچهٔ انتقال و صرافی');
    const historyRow = () => main.locator('tbody tr').filter({ hasText: transaction.transactionNumber });
    await historyRow().getByTitle('ویرایش سند', { exact: true }).click();
    assert.equal(await main.getByPlaceholder('مثال: 50,000', { exact: true }).inputValue(), '10');
    await current(page, 'cash_transfer_history:all');
    // Re-selecting the same sidebar leaf must open its list, not leave a stale editor on that page.
    await navigateSidebar(page, 'تاریخچهٔ انتقال و صرافی');
    await historyRow().waitFor();
    await historyRow().getByTitle('ویرایش سند', { exact: true }).click();
    await main.getByRole('button', { name: 'انصراف از ویرایش', exact: true }).click();
    await historyRow().waitFor();
    await waitBalances(page, 5000, 190, 50);
    await historyRow().getByTitle('ویرایش سند', { exact: true }).click();
    await main.getByPlaceholder('مثال: 50,000', { exact: true }).fill('4');
    await main.getByRole('button', { name: 'ذخیره ویرایش سند', exact: true }).click();
    await waitBalances(page, 5000, 196, 44);
    await historyRow().waitFor();
    assert.equal((await readData(page, 'transactions'))[0].id, transaction.id);
    await historyRow().getByTitle('چاپ حواله رسمی', { exact: true }).click();
    await page.locator('#document-print-modal-container').waitFor();
    await page.locator('#document-print-modal-close-btn').click();
    await historyRow().getByTitle('ابطال / حذف سند', { exact: true }).click();
    await waitBalances(page, 5000, 200, 40);
    assert.deepEqual(await snapshot(page), before);

    await navigateSidebar(page, 'تبدیل و اکسچنج اسعار');
    await main.locator('input').first().fill('65');
    await main.getByRole('button', { name: 'ثبت سند تبادله اسعار', exact: true }).click();
    await waitBalances(page, 4935, 201, 40);
    transaction = (await readData(page, 'transactions'))[0];
    await navigateSidebar(page, 'تاریخچهٔ انتقال و صرافی');
    await historyRow().getByTitle('ویرایش سند', { exact: true }).click();
    assert.equal(await main.locator('input').first().inputValue(), '65');
    await main.locator('input').first().fill('130');
    await main.getByRole('button', { name: 'ذخیره ویرایش سند', exact: true }).click();
    await waitBalances(page, 4870, 202, 40);
    await historyRow().waitFor();
    await historyRow().getByTitle('ابطال / حذف سند', { exact: true }).click();
    await waitBalances(page, 5000, 200, 40);
    assert.deepEqual(await snapshot(page), before);
    console.log('PASS: standalone transfer/exchange/history, populated history edits, cancel/save return, printing and exact cash reversals.');

    for (const workflow of [
      { create: 'ثبت برگشت از فروش', type: 'return_sell', page: 'return_sell:all', submit: 'ثبت نهایی فاکتور برگشت' },
      { create: 'ثبت برگشت از خرید', type: 'return_buy', page: 'return_buy:all', submit: 'ثبت نهایی فاکتور برگشت' },
      { create: 'ثبت پیشرفتهٔ فاکتور فروش', type: 'sell', page: 'legacy_trade:sell-list', submit: 'ثبت فاکتور' },
      { create: 'ثبت پیشرفتهٔ فاکتور خرید', type: 'buy', page: 'legacy_trade:buy-list', submit: 'ثبت فاکتور' },
    ]) {
      await navigateSidebar(page, workflow.create);
      await main.getByPlaceholder('جستجو بر اساس نام یا کد...', { exact: true }).fill('101');
      await main.getByRole('button').filter({ hasText: 'شخص آزمایشی' }).click();
      await main.getByPlaceholder('تایپ نام، کد یا بارکد کالا...', { exact: true }).fill('201');
      await page.keyboard.press('Enter');
      await main.getByPlaceholder('تعداد', { exact: true }).fill('1');
      await main.getByPlaceholder('نرخ فی', { exact: true }).fill('25');
      await main.getByRole('button', { name: 'نسیه', exact: true }).click();
      await main.getByRole('button', { name: workflow.submit, exact: true }).click();
      await current(page, workflow.page);
      const invoices = await readData(page, 'invoices');
      assert.equal(invoices.length, 1);
      assert.equal(invoices[0].type, workflow.type);
      assert.equal(invoices[0].totalAmount, 25);
      // If a newly created invoice opened its detail dialog, close only the document overlay.
      const detail = page.locator('#invoice-detail-modal');
      if (await detail.count()) await page.keyboard.press('Escape');
      if (workflow.type === 'sell') {
        await main.getByTitle('کلیک برای تفکیک فروش و خریداران جنس: کالای آزمایشی', { exact: true }).click();
        await current(page, 'trade_hub:itemized');
        assert.equal(await page.locator('#workspace-sidebar [aria-current="page"]').getAttribute('id'), 'sidebar-group-trade');
        assert.equal(await main.locator('select:has(option[value="product"])').inputValue(), 'product', 'Product drill-down must survive page mounting');
        await main.getByRole('button', { name: 'ثبت فاکتور فروش جدید', exact: true }).click();
        await current(page, 'new_sale:all');
        await navigateSidebar(page, 'سوابق تفصیلی فاکتورهای فروش');
      }
      await main.getByTitle('حذف فاکتور', { exact: true }).click();
      await page.waitForFunction(prefix => JSON.parse(localStorage.getItem(prefix + 'invoices') || '[]').length === 0, prefix);
      assert.deepEqual(await snapshot(page), before, `Reversal after ${workflow.create}`);
    }
    console.log('PASS: both return workflows and retained advanced buy/sell forms save to their own lists, preserve itemized product filters and reverse synthetic invoice effects.');
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error('Workflow page:', await page.locator('body').innerText().then(text => text.slice(0, 5000)).catch(() => 'unavailable'));
    throw error;
  } finally {
    await page.context().close();
  }
}
module.exports = { workflowSmoke };
if (require.main === module) (async () => {
  const browser = await launch();
  try { await workflowSmoke(browser, []); } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

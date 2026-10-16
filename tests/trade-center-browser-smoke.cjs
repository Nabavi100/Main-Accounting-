/* Real invoice-center navigation; isolated synthetic records and blocked external requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, pageFor, login, navigateSidebar, clickSidebarPage, readData, storagePrefix: prefix } = require('./browser-support.cjs');
const artifacts = process.env.TRADE_CENTER_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-trade-center');
fs.mkdirSync(artifacts, { recursive: true });
const financeKeys = ['cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories', 'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements', 'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions', 'asset_groups', 'fixed_assets', 'shareholders', 'currencies'];
const snapshot = page => page.evaluate(({ prefix, keys }) => Object.fromEntries(keys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, keys: financeKeys });
const current = (page, key) => page.waitForFunction(key => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === key, key);
const action = (page, id) => page.locator(`#trade-center-page-${id}`);
const checkCounts = async page => {
  assert.equal(await page.locator('[data-trade-count="sell"]').innerText(), '۲');
  assert.equal(await page.locator('[data-trade-count="buy"]').innerText(), '۱');
  assert.equal(await page.locator('[data-trade-count="returns"]').innerText(), '۲');
};
const seed = page => page.evaluate(async prefix => {
  const { getPersianDate } = await import('/src/utils/formatters.ts');
  const date = getPersianDate();
  const invoice = (type, number, amount, currency = 'AFN') => ({
    id: `center-${number}`, invoiceNumber: `CENTER-${number}`, type, date,
    partyId: 'party', partyName: 'مشتری آزمایشی مرکز', warehouseId: 'wh', warehouseName: 'گدام نمونه',
    items: [{ productId: 'product', productName: 'کالای آزمایشی', quantity: 1, unit: 'ton', unitPrice: amount, total: amount, tonsCount: 1, bagsCount: 20, warehouseId: 'wh' }],
    totalAmount: amount, subTotal: amount, subtotal: amount, paidAmount: 0, balanceAmount: amount,
    discount: 0, shipping: 0, currency, paymentStatus: 'unpaid', paymentMethod: 'credit', exchangeRate: currency === 'AFN' ? 1 : 65,
    createdAt: `2026-10-16T09:${String(number).padStart(2, '0')}:00Z`, dealType: 'normal', notes: 'دادهٔ مصنوعی آزمون؛ نه سند واقعی',
  });
  const data = {
    cash_accounts: [{ id: 'afn_cash', name: 'صندوق افغانی نمونه', currency: 'AFN', balance: 5000, initialBalance: 5000 }, { id: 'usd_cash', name: 'صندوق دالری نمونه', currency: 'USD', balance: 200, initialBalance: 200 }],
    cash: { afnBalance: 5000, usdBalance: 200, exchangeUsdBalance: 0, usdToAfnRate: 65 },
    parties: [{ id: 'party', name: 'مشتری آزمایشی مرکز', code: '101', type: 'both', phone: '0700000001', balanceAFN: -120, balanceUSD: 0, createdAt: date }],
    products: [{ id: 'product', code: '201', name: 'کالای آزمایشی', category: 'آزمایش', baseUnit: 'تن (1000KG)', bagWeightKg: 50, bagsPerTon: 20, buyPriceAFN: 1300, sellPriceAFN: 1625, buyPriceUSD: 20, sellPriceUSD: 25, minStockTons: 1 }],
    warehouses: [{ id: 'wh', name: 'گدام نمونه', type: 'standard', location: '' }, { id: 'cw', name: 'گدام امانی نمونه', type: 'consignment', location: '' }],
    stocks: [{ warehouseId: 'wh', productId: 'product', quantityTons: 10, quantityBags: 200 }],
    invoices: [invoice('sell', 1, 8500), invoice('sell', 2, 40, 'USD'), invoice('buy', 3, 6500), invoice('return_sell', 4, 100), invoice('return_buy', 5, 10, 'USD')],
    transactions: [], transfers: [], consignment_movements: [], incomes: [], expenses: [],
  };
  for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
}, prefix);

(async () => {
  const browser = await launch();
  const errors = [];
  let page;
  try {
    page = await pageFor(browser, errors, { width: 1600, height: 1000 });
    page.setDefaultTimeout(18000);
    await login(page); await seed(page); await page.reload({ waitUntil: 'networkidle' });
    const before = await snapshot(page);
    await clickSidebarPage(page, 'sidebar-group-trade', 'trade');
    await current(page, 'trade_hub:center');
    await checkCounts(page);
    assert.equal(await action(page, 'sale-list').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('.trade-invoice-list tbody tr').count(), 2);
    const shortcuts = page.locator('#workspace-menu-trade > button');
    assert.equal(await shortcuts.count(), 4);
    assert.deepEqual((await shortcuts.allTextContents()).sort(), ['ثبت فاکتور خرید', 'ثبت فاکتور فروش', 'ثبت برگشت از خرید', 'ثبت برگشت از فروش'].sort());
    for (const id of ['purchase-list', 'sale-list', 'purchase-return-list', 'sale-return-list', 'itemized-sales', 'consignment', 'legacy-purchase-create', 'legacy-purchase-list', 'legacy-sale-create', 'legacy-sale-list']) {
      assert.equal(await page.locator(`#workspace-sidebar #sidebar-page-${id}`).count(), 0, `No leftover sidebar row for ${id}`);
    }
    assert.equal(await page.locator('.trade-center-primary > button').count(), 6);
    const rows = await page.locator('.trade-center-primary > button').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().y)));
    assert.equal(new Set(rows).size, 1, 'Desktop primary buttons must sit beside each other');
    assert.equal(await page.locator('.workspace-report-content #trade-invoice-center').count(), 0, 'Navigation must not leak into exported report content');
    const hero = await page.locator('#trade-invoice-center').boundingBox(), toolbar = await page.locator('.page-actions-toolbar').boundingBox();
    assert.ok(hero.y + hero.height <= toolbar.y + 1);
    await page.screenshot({ path: path.join(artifacts, 'trade-center-desktop.png'), animations: 'disabled' });

    for (const [id, key, count] of [
      ['purchase-list', 'purchase_invoices:all', 1], ['sale-list', 'sales_invoices:all', 2],
      ['sale-return-list', 'return_sell:all', 1], ['purchase-return-list', 'return_buy:all', 1],
    ]) {
      await action(page, id).click(); await current(page, key); await checkCounts(page);
      assert.equal(await action(page, id).getAttribute('aria-current'), 'page');
      const records = await readData(page, 'invoices'); assert.equal(records.length, 5);
      if (id === 'sale-list' || id === 'purchase-list') assert.equal(await page.locator('.trade-invoice-list tbody tr').count(), count);
      assert.equal(await page.locator('#workspace-sidebar [aria-current="page"]').getAttribute('id'), 'sidebar-group-trade');
    }
    // Return creation remains a real form reached from its central list, with a safe return to that same list.
    await page.locator('.page-actions-toolbar .is-create').click(); await current(page, 'new_return_buy:all');
    assert.ok(await page.locator('main form input').count() >= 6);
    await page.getByRole('button', { name: 'بستن فرم پیشرفته و بازگشت به فهرست', exact: true }).click();
    await current(page, 'return_buy:all');
    assert.deepEqual(await snapshot(page), before);

    for (const id of ['legacy-purchase-create', 'legacy-purchase-list', 'legacy-sale-create', 'legacy-sale-list']) {
      const more = page.locator('#trade-center-more-toggle');
      if (await more.getAttribute('aria-expanded') !== 'true') await more.click();
      await action(page, id).click();
      await current(page, `legacy_trade:${id.includes('purchase') ? 'buy' : 'sell'}-${id.endsWith('create') ? 'create' : 'list'}`);
      assert.equal(await action(page, id).getAttribute('aria-current'), 'page');
      if (id.endsWith('create')) assert.ok(await page.locator('main form input').count() >= 6);
      await checkCounts(page);
    }
    await action(page, 'itemized-sales').click(); await current(page, 'trade_hub:itemized');
    await action(page, 'consignment').click(); await current(page, 'consignment:all');
    assert.equal(await page.locator('.reference-consignment').count(), 1);

    await navigateSidebar(page, 'ثبت فاکتور خرید');
    await page.locator('#trade-invoice-number').fill('CENTER-DRAFT-17');
    await page.locator('#sidebar-group-toggle-trade').click();
    await page.locator('#sidebar-group-toggle-trade').click();
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'CENTER-DRAFT-17', 'Expanding shortcuts must not navigate or reset a form');
    await page.locator('#workspace-global-search').fill('۱۰۱'); await page.locator('#workspace-global-search').press('Enter');
    await page.locator('#party-cardex-modal-close-btn').click();
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'CENTER-DRAFT-17');
    await page.locator('#workspace-global-search').fill('لیست خریدها');
    await page.locator('.workspace-search-results [role="option"]').filter({ hasText: 'لیست خریدها' }).click();
    await current(page, 'purchase_invoices:all');
    assert.equal(await action(page, 'purchase-list').getAttribute('aria-current'), 'page');
    assert.deepEqual(await snapshot(page), before, 'Navigation, opening forms and search must not post or rewrite financial data');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await clickSidebarPage(page, 'sidebar-group-trade', 'trade');
      await current(page, 'trade_hub:center'); await checkCounts(page);
      assert.equal(await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.workspace-sidebar-overlay').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const layout = await page.locator('.trade-center-primary').evaluate(nav => ({
        left: nav.getBoundingClientRect().left, right: nav.getBoundingClientRect().right,
        overflow: nav.scrollWidth > nav.clientWidth,
        rows: [...nav.querySelectorAll('button')].map(button => Math.round(button.getBoundingClientRect().y)),
        heights: [...nav.querySelectorAll('button')].map(button => button.getBoundingClientRect().height),
      }));
      assert.equal(new Set(layout.rows).size, 1, 'All six mobile actions remain in ONE non-wrapping row');
      assert.ok(layout.left >= 0 && layout.right <= width + 1 && layout.overflow, 'Only the bounded action row scrolls, never the whole page');
      assert.ok(layout.heights.every(height => height >= 36));
      if (width === 390) await page.screenshot({ path: path.join(artifacts, 'trade-center-mobile.png'), animations: 'disabled' });
      await action(page, 'purchase-return-list').scrollIntoViewIfNeeded();
      const reachable = await action(page, 'purchase-return-list').boundingBox();
      assert.ok(reachable.x >= layout.left && reachable.x + reachable.width <= layout.right + 1, 'The last action stays reachable by scrolling');
      await action(page, 'purchase-list').click(); await current(page, 'purchase_invoices:all');
      await action(page, 'sale-list').click(); await current(page, 'sales_invoices:all');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [label, key] of [
      ['ثبت فاکتور خرید', 'new_purchase:all'], ['ثبت فاکتور فروش', 'new_sale:all'],
      ['ثبت برگشت از خرید', 'new_return_buy:all'], ['ثبت برگشت از فروش', 'new_return_sell:all'],
    ]) {
      await navigateSidebar(page, label); await current(page, key);
      assert.equal(await page.locator('#trade-invoice-center').count(), 1);
      assert.equal(await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded'), 'false');
    }
    assert.deepEqual(await snapshot(page), before, 'All 21 financial datasets must remain unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: shared invoice center, exactly four sidebar shortcuts, real adjacent navigation and counts, four lists/return creation, all advanced/related pages, header search and draft preservation, 390/320px single-row reachable controls, containment and 21 unchanged finance datasets.');
    console.log(`Screenshots: ${artifacts}`);
  } catch (error) {
    if (page) {
      console.error('Invoice-center diagnostics:', (await page.locator('body').innerText().catch(() => '')).slice(0, 6000));
      await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

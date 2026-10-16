/* Compact centers + live shell utilities. Fresh synthetic storage; no external messages or real postings. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, pageFor, login, clickSidebarPage, navigateSidebar, readData, storagePrefix: prefix } = require('./browser-support.cjs');
const artifacts = process.env.COMPACT_WORKSPACE_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-compact-workspace');
fs.mkdirSync(artifacts, { recursive: true });
const keys = ['cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories', 'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements', 'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions', 'asset_groups', 'fixed_assets', 'shareholders', 'currencies'];
const snapshot = page => page.evaluate(({ prefix, keys }) => Object.fromEntries(keys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, keys });
const current = (page, key) => page.waitForFunction(key => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === key, key);
const calc = page => page.locator('#header-currency-calculator-popover');
const openCalculator = async page => { await page.locator('#header-btn-currency-calculator').click(); await page.locator('dialog.currency-calculator-dialog[open]').waitFor(); };
const assertContained = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No whole-page horizontal overflow');
const geometry = (page, selector) => page.locator(selector).evaluateAll(buttons => buttons.map(button => {
  const rect = button.getBoundingClientRect();
  return { width: rect.width, height: rect.height, y: rect.y, grow: getComputedStyle(button).flexGrow };
}));
const assertRow = (values, count, mobile = false) => {
  assert.equal(values.length, count);
  assert.equal(new Set(values.map(value => Math.round(value.y))).size, 1, 'Every primary action occupies the SAME row');
  assert.ok(values.every(value => value.height >= (mobile ? 36 : 30) && value.height <= 36 && value.grow === '0'), 'Actions remain compact and never flex-grow');
};
const assertSameSizes = (before, after) => before.forEach((value, index) => {
  assert.ok(Math.abs(value.width - after[index].width) <= .5, 'Widening the page must not widen an action');
  assert.ok(Math.abs(value.height - after[index].height) <= .5, 'Widening the page must not heighten an action');
});
const seed = page => page.evaluate(async prefix => {
  const { getPersianDate } = await import('/src/utils/formatters.ts');
  const { initialCurrencies } = await import('/src/data/initialData.ts');
  const data = {
    cash: { afnBalance: 5000, usdBalance: 200, exchangeUsdBalance: 0, usdToAfnRate: 65 },
    cash_accounts: [{ id: 'afn_cash', name: 'صندوق افغانی نمونه', currency: 'AFN', balance: 5000, initialBalance: 5000 }, { id: 'usd_cash', name: 'صندوق دالری نمونه', currency: 'USD', balance: 200, initialBalance: 200 }],
    parties: [{ id: 'party', name: 'شخص آزمایشی سربرگ', code: '101', type: 'both', phone: '0700000001', balanceAFN: -120, balanceUSD: 0, createdAt: getPersianDate() }],
    warehouses: [{ id: 'wh', name: 'گدام نمونه', type: 'standard', location: '' }],
    products: [], stocks: [], invoices: [], transactions: [], transfers: [], consignment_movements: [], incomes: [], expenses: [],
    currencies: initialCurrencies,
  };
  for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
}, prefix);

(async () => {
  const browser = await launch(), errors = [];
  let page;
  try {
    page = await pageFor(browser, errors, { width: 1600, height: 1000 });
    page.setDefaultTimeout(18000);
    await login(page); await seed(page); await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const before = await snapshot(page);
    assert.equal(await page.locator('#workspace-usd-rate').getAttribute('data-rate'), '65');
    assert.match(await page.locator('#workspace-usd-rate').getAttribute('title'), /آنلاین بازار نیست/);
    assert.ok(await page.locator('.workspace-global-search').evaluate(element => element.getBoundingClientRect().width <= 260.5));
    assert.ok(await page.locator('.workspace-search-field').evaluate(element => element.getBoundingClientRect().height <= 36));
    const dateMatches = await page.evaluate(() => {
      const date = document.querySelector('#workspace-current-date'), time = document.querySelector('#workspace-current-time');
      const instant = new Date(date.getAttribute('datetime'));
      return date.textContent === new Intl.DateTimeFormat('fa-AF-u-ca-persian', { timeZone: 'Asia/Kabul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
        && time.textContent === new Intl.DateTimeFormat('fa-AF', { timeZone: 'Asia/Kabul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(instant);
    });
    assert.ok(dateMatches, 'The date and live clock share the same real Kabul instant');
    const oldTime = await page.locator('#workspace-current-time').innerText();
    await page.waitForFunction(time => document.querySelector('#workspace-current-time').textContent !== time, oldTime, { timeout: 3500 });

    for (const [id, label] of [['trade', 'بازرگانی و مالی'], ['treasury', 'دریافت و پرداخت']]) {
      const button = page.locator(`#sidebar-group-${id}`);
      assert.equal(await button.innerText(), label, 'Sidebar section buttons show only the section name');
      assert.equal(await button.locator('small').count(), 0, 'No second-line center caption enlarges the sidebar button');
      const height = await button.evaluate(element => element.getBoundingClientRect().height);
      const ordinaryHeight = await page.locator('#sidebar-group-definitions').evaluate(element => element.getBoundingClientRect().height);
      assert.ok(Math.abs(height - ordinaryHeight) <= 1, 'Center titles are as compact as the other sidebar buttons');
    }
    await navigateSidebar(page, 'مرکز فاکتورها');
    const trade = await geometry(page, '.trade-center-primary > button'); assertRow(trade, 6);
    await page.setViewportSize({ width: 2400, height: 1000 });
    const wideTrade = await geometry(page, '.trade-center-primary > button'); assertRow(wideTrade, 6); assertSameSizes(trade, wideTrade);
    assert.ok(await page.locator('.workspace-global-search').evaluate(element => element.getBoundingClientRect().width <= 260.5));
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.screenshot({ path: path.join(artifacts, 'compact-invoices-desktop.png'), animations: 'disabled' });

    await navigateSidebar(page, 'مرکز دریافت و پرداخت'); await current(page, 'receipt_payment_hub:center');
    assert.equal(await page.locator('#treasury-center-page-receipt-create').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#workspace-menu-treasury > button').count(), 2);
    assert.equal(await page.locator('#workspace-menu-treasury').innerText().then(text => text.includes('مرکز فاکتورها')), false);
    assert.equal(await page.locator('.workspace-report-content #treasury-center').count(), 0, 'Treasury navigation is excluded from exports');
    const treasury = await geometry(page, '.treasury-center-primary > button'); assertRow(treasury, 4);
    await page.setViewportSize({ width: 2400, height: 1000 }); assertSameSizes(treasury, await geometry(page, '.treasury-center-primary > button'));
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.screenshot({ path: path.join(artifacts, 'treasury-center-desktop.png'), animations: 'disabled' });
    for (const [id, key] of [['receipt-list', 'receipts_list:all'], ['payment-create', 'new_payment:all'], ['payment-list', 'payments_list:all'], ['receipt-create', 'new_receipt:all']]) {
      await page.locator(`#treasury-center-page-${id}`).click(); await current(page, key);
      assert.equal(await page.locator(`#treasury-center-page-${id}`).getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('#treasury-center').count(), 1);
      assertRow(await geometry(page, '.treasury-center-primary > button'), 4);
      if (id.endsWith('list')) assert.equal(await page.locator('.treasury-table').count(), 1);
      else assert.equal(await page.locator('#treasury-number').count(), 1);
    }
    await page.locator('#treasury-number').fill('TREASURY-UNSAVED-9');
    await page.locator('#sidebar-group-toggle-treasury').click(); await page.locator('#sidebar-group-toggle-treasury').click();
    assert.equal(await page.locator('#treasury-number').inputValue(), 'TREASURY-UNSAVED-9');
    await openCalculator(page); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#treasury-number').inputValue(), 'TREASURY-UNSAVED-9');
    await page.getByRole('button', { name: 'بستن فرم خزانه و بازگشت به فهرست', exact: true }).click(); await current(page, 'receipts_list:all');
    for (const [label, key] of [['دریافت عواید', 'income_receipt:all'], ['پرداخت هزینه', 'expense_payment:all'], ['فرم پیشرفتهٔ دریافت', 'legacy_receipt:all'], ['فرم پیشرفتهٔ پرداخت', 'legacy_payment:all'], ['سوابق تفصیلی دریافت‌ها', 'legacy_receipts_list:all'], ['سوابق تفصیلی پرداخت‌ها', 'legacy_payments_list:all']]) {
      await navigateSidebar(page, label); await current(page, key);
      assert.equal(await page.locator('#treasury-center').count(), 1);
    }
    await page.locator('#workspace-global-search').fill('لیست پرداخت');
    await page.locator('.workspace-search-results [role="option"]').filter({ hasText: 'لیست پرداخت‌ها' }).click();
    await current(page, 'payments_list:all');
    assert.deepEqual(await snapshot(page), before, 'Center navigation and opening forms/calculator are read-only');

    await navigateSidebar(page, 'ثبت فاکتور خرید'); await page.locator('#trade-invoice-number').fill('HEADER-DRAFT-321');
    await openCalculator(page);
    assert.equal(await calc(page).getAttribute('aria-labelledby'), 'currency-calculator-title');
    assert.equal(await page.locator('dialog.currency-calculator-dialog[open]').count(), 1);
    assert.equal(await calc(page).getByRole('button', { name: 'بستن ماشین حساب ارزی', exact: true }).getAttribute('type'), 'button');
    await page.keyboard.press('Control+k');
    assert.equal(await page.locator('#workspace-global-search').getAttribute('aria-expanded'), 'false', 'Search shortcut cannot steal focus through a modal');
    await page.locator('#currency-calculator-usd').fill('۱٫۲۵');
    assert.equal(await page.locator('#currency-calculator-afn').inputValue(), '81.25');
    await page.locator('#currency-calculator-rate').fill('۶۴٫۷۵');
    assert.equal(await page.locator('#currency-calculator-afn').inputValue(), '80.9375');
    assert.equal(await page.locator('#workspace-usd-rate').getAttribute('data-rate'), '65', 'A hypothetical calculator rate is NOT the saved program rate');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__calculatorCopied = text; } } }));
    await calc(page).getByRole('button', { name: 'کپی مبلغ افغانی', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__calculatorCopied), '80.9375');
    await page.locator('#currency-calculator-afn').fill('۱۲۳٫۱۲۳۴۵۶');
    assert.equal(await page.locator('#currency-calculator-usd').inputValue(), new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(123.123456 / 64.75));
    assert.equal(await calc(page).locator('.currency-calculator-quick > button').count(), 10, 'Both sets of quick amounts are preserved');
    await calc(page).locator('.currency-calculator-quick').first().getByRole('button').nth(2).click();
    assert.equal(await page.locator('#currency-calculator-usd').inputValue(), '100');
    await page.locator('#currency-calculator-rate').fill('');
    assert.equal(await page.locator('#currency-calculator-afn').inputValue(), '', 'Invalid rate clears the result instead of keeping a stale value');
    assert.equal(await calc(page).getByRole('button', { name: 'ثبت نرخ سیستم', exact: true }).count(), 0);
    await page.locator('#currency-calculator-rate').fill('64.75');
    await calc(page).getByRole('button', { name: 'ثبت نرخ سیستم', exact: true }).click();
    assert.deepEqual(await snapshot(page), before, 'Even requesting a system-rate change still requires confirmation');
    await calc(page).getByRole('button', { name: 'انصراف', exact: true }).click();
    await calc(page).getByRole('button', { name: 'بازگشت به نرخ برنامه', exact: true }).click();
    assert.equal(await page.locator('#currency-calculator-rate').inputValue(), '65');
    await page.screenshot({ path: path.join(artifacts, 'currency-calculator-desktop.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    assert.equal(await calc(page).count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'header-btn-currency-calculator');
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'HEADER-DRAFT-321');
    assert.deepEqual(await snapshot(page), before, 'Calculation, copying, reset, cancel and close leave all financial datasets untouched');

    // Exercise the old explicit system-rate-save feature only with synthetic data, then restore it.
    await clickSidebarPage(page, 'sidebar-btn-dashboard'); await openCalculator(page);
    await page.locator('#currency-calculator-rate').fill('66.125');
    await calc(page).getByRole('button', { name: 'ثبت نرخ سیستم', exact: true }).click();
    await calc(page).getByRole('button', { name: 'تأیید نرخ', exact: true }).click();
    await page.waitForFunction(prefix => JSON.parse(localStorage.getItem(prefix + 'cash')).usdToAfnRate === 66.125 && JSON.parse(localStorage.getItem(prefix + 'currencies')).find(currency => currency.code === 'USD').exchangeRateToAFN === 66.125, prefix);
    assert.equal(await page.locator('#workspace-usd-rate').getAttribute('data-rate'), '66.125');
    const changed = await snapshot(page);
    assert.deepEqual(keys.filter(key => changed[key] !== before[key]).sort(), ['cash', 'currencies']);
    await page.locator('#currency-calculator-rate').fill('65');
    await calc(page).getByRole('button', { name: 'ثبت نرخ سیستم', exact: true }).click();
    await calc(page).getByRole('button', { name: 'تأیید نرخ', exact: true }).click();
    await page.waitForFunction(prefix => JSON.parse(localStorage.getItem(prefix + 'cash')).usdToAfnRate === 65 && JSON.parse(localStorage.getItem(prefix + 'currencies')).find(currency => currency.code === 'USD').exchangeRateToAFN === 65, prefix);
    await calc(page).getByRole('button', { name: 'بستن ماشین حساب ارزی', exact: true }).click();
    assert.deepEqual(await snapshot(page), before);
    assert.equal((await readData(page, 'invoices')).length, 0);

    for (const width of [1280, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of ['workspace-current-date', 'workspace-current-time', 'workspace-usd-rate', 'header-btn-currency-calculator', 'workspace-global-search']) {
        const box = await page.locator(`#${id}`).boundingBox();
        assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `${id} must remain visible at ${width}px`);
      }
      await navigateSidebar(page, 'مرکز دریافت و پرداخت');
      assertRow(await geometry(page, '.treasury-center-primary > button'), 4, width <= 700);
      await assertContained(page);
      if (width <= 700) {
        await page.locator('#treasury-center-page-payment-list').scrollIntoViewIfNeeded();
        await page.locator('#treasury-center-page-payment-list').click(); await current(page, 'payments_list:all');
        await page.waitForFunction(() => {
          const nav = document.querySelector('.treasury-center-primary'), active = nav.querySelector('[aria-current="page"]');
          const container = nav.getBoundingClientRect(), button = active.getBoundingClientRect();
          return button.left >= container.left - 1 && button.right <= container.right + 1;
        }, null, { timeout: 3500 });
        if (width === 390) await page.screenshot({ path: path.join(artifacts, 'treasury-center-mobile.png'), animations: 'disabled' });
        await openCalculator(page);
        const box = await calc(page).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
        if (width === 390) await page.screenshot({ path: path.join(artifacts, 'currency-calculator-mobile.png'), animations: 'disabled' });
        await page.keyboard.press('Escape'); await assertContained(page);
      }
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await navigateSidebar(page, 'گزارش طرف‌های حساب');
    assert.equal(await page.locator('main').getByText('بدهکاران به ما', { exact: true }).count(), 1);
    await navigateSidebar(page, 'تنظیمات ربات تلگرام');
    assert.equal(await page.locator('main').getByRole('heading', { name: 'تنظیمات ربات تلگرام', exact: true }).count(), 1);
    assert.equal(await page.locator('main input[type="password"]').count(), 1, 'The shorter title must NOT remove the Telegram password gate');
    assert.equal(await page.locator('main').getByText('ورود مدیر', { exact: true }).count(), 1);
    assert.equal(await page.locator('[data-workspace-center]').count(), 0, 'Unrelated settings remain separate pages');
    assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(errors, []);
    console.log('PASS: fixed-size 6/4 single-row centers (1600→2400px), every treasury destination, short labels and retained Telegram password gate, smaller search, real Kabul date/clock, saved USD quote, localized six-decimal calculator/copy/quick amounts/reset/confirmed reversible rate save, draft preservation, responsive 1280/1024/768/390/320px containment and 21 restored financial datasets.');
    console.log(`Screenshots: ${artifacts}`);
  } catch (error) {
    if (page) {
      console.error('Compact-workspace diagnostics:', (await page.locator('body').innerText().catch(() => '')).slice(0, 6500));
      await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

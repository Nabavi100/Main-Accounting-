/* Working-page decluttering. Isolated synthetic storage; no live finance or external messages. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, pageFor, login, readData, navigateSidebar, clickSidebarPage, storagePrefix: prefix } = require('./browser-support.cjs');
const artifacts = process.env.DECLUTTER_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-declutter');
fs.mkdirSync(artifacts, { recursive: true });
const keys = ['cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories', 'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements', 'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions', 'asset_groups', 'fixed_assets', 'shareholders', 'currencies'];
const snapshot = page => page.evaluate(({ prefix, keys }) => Object.fromEntries(keys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, keys });
const current = (page, key) => page.waitForFunction(key => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === key, key);
const funnel = page => page.getByRole('button', { name: 'فیلترهای فهرست', exact: true });
const filter = (page, label) => page.locator('.page-actions-filters').getByLabel(label, { exact: true });
const ledger = page => page.locator('.cash-register-ledger');
const seed = page => page.evaluate(prefix => {
  const parties = Array.from({ length: 70 }, (_, index) => ({
    id: `party-${index + 1}`, name: `شخص آزمایشی ${index + 1}`, code: String(70001 + index),
    phone: `070${String(index + 1).padStart(7, '0')}`, type: 'both', groupId: 'sample-group', groupName: 'نمونه',
    balanceAFN: index % 3 === 0 ? -100 : index % 3 === 1 ? 50 : 0, balanceUSD: 0, createdAt: '2026-10-16',
  }));
  const transaction = (id, type, amount, day, description, cashRegister = 'afn_cash', currency = 'AFN') => ({
    id, transactionNumber: id.toUpperCase(), type, amount, date: `1405/07/${day}`, issueTime: '10:00', description,
    partyId: 'party-1', partyName: parties[0].name, currency, cashCurrency: currency, cashAmount: amount,
    cashRegister, exchangeRate: currency === 'AFN' ? 1 : 65, discountAmount: 0,
  });
  const data = {
    parties, party_groups: [{ id: 'sample-group', name: 'نمونه', createdAt: '2026-10-16' }],
    cash: { afnBalance: 1080, usdBalance: 50, exchangeUsdBalance: 0, usdToAfnRate: 65 },
    cash_accounts: [
      { id: 'afn_cash', name: 'صندوق افغانی نمونه', currency: 'AFN', balance: 1080, initialBalance: 1000 },
      { id: 'usd_cash', name: 'صندوق دالری نمونه', currency: 'USD', balance: 50, initialBalance: 20 },
    ],
    transactions: [
      transaction('ux-sale', 'receive_payment', 100, '20', 'دریافت فاکتور فروش آزمایشی'),
      transaction('ux-buy', 'make_payment', 25, '21', 'پرداخت فاکتور خرید آزمایشی'),
      transaction('ux-receive', 'receive_payment', 15, '22', 'دریافت عادی آزمایشی'),
      transaction('ux-expense', 'expense', 10, '23', 'هزینه آزمایشی'),
      transaction('ux-usd', 'receive_payment', 30, '22', 'دریافت دالری آزمایشی', 'usd_cash', 'USD'),
    ],
    invoices: [], products: [], stocks: [], transfers: [], incomes: [], expenses: [], consignment_movements: [],
  };
  for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
}, prefix);
async function checkHeader(page, width) {
  const data = await page.evaluate(() => {
    const header = document.querySelector('#workspace-header').getBoundingClientRect();
    const selectors = ['.workspace-company-pill', '.workspace-global-search', '.workspace-header-datetime', '#workspace-usd-rate', '#header-btn-currency-calculator', '#workspace-profile-toggle'];
    if (getComputedStyle(document.querySelector('.workspace-menu-toggle')).display !== 'none') selectors.push('.workspace-menu-toggle');
    return { height: header.height, searchWidth: document.querySelector('.workspace-global-search').getBoundingClientRect().width,
      boxes: selectors.map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, center: rect.top + rect.height / 2, inside: rect.left >= header.left - 1 && rect.right <= header.right + 1 }; }) };
  });
  assert.ok(data.height <= 60.5, `Header stays ONE row at ${width}px`);
  assert.ok(data.searchWidth <= (width <= 1100 ? 140.5 : 180.5), 'Search is significantly narrower than the previous 260px field');
  assert.ok(data.boxes.every(box => box.inside), JSON.stringify(data));
  assert.ok(Math.max(...data.boxes.map(box => box.center)) - Math.min(...data.boxes.map(box => box.center)) <= 1, 'Date, time, price, calculator and profile share one center line');
  for (let i = 0; i < data.boxes.length; i++) for (let j = i + 1; j < data.boxes.length; j++) {
    const a = data.boxes[i], b = data.boxes[j];
    assert.ok(Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 1, `Header controls overlap: ${a.selector} / ${b.selector}`);
  }
}
(async () => {
  const browser = await launch(), errors = [];
  let page;
  try {
    page = await pageFor(browser, errors, { width: 1600, height: 1000 });
    page.setDefaultTimeout(15000);
    await login(page); await seed(page); await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const before = await snapshot(page), companyName = (await readData(page, 'company')).name;
    for (const width of [1600, 1366, 1280, 1240, 1200, 1100, 1024, 960, 901, 900, 850, 768, 701]) {
      await page.setViewportSize({ width, height: 1000 }); await checkHeader(page, width);
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await navigateSidebar(page, 'تعریف طرف حساب');
    const table = page.getByRole('region', { name: 'جدول طرف حساب‌های فعال', exact: true });
    assert.equal(await table.locator('tbody tr').count(), 70);
    assert.equal(await page.locator('main [title="حرکت به بالا"], main [title="حرکت به پایین"]').count(), 0, 'No decorative scroll-arrow controls remain in the DOM');
    assert.ok(!(await page.locator('main').innerText()).includes(companyName), 'Company branding belongs in the shell and paper, not an extra page badge');
    assert.ok((await page.locator('.workspace-company-pill').innerText()).includes(companyName));
    await page.screenshot({ path: path.join(artifacts, 'parties-clean-desktop.png'), animations: 'disabled' });
    assert.ok(await table.evaluate(element => element.scrollHeight > element.clientHeight));
    await table.focus(); await table.press('PageDown');
    await page.waitForFunction(() => document.querySelector('[aria-label="جدول طرف حساب‌های فعال"]').scrollTop > 0);
    await table.evaluate(element => { element.scrollTop = 0; });
    await page.locator('#input-party-name').fill('پیش‌نویس بدون ثبت');
    await page.keyboard.press('Control+k'); await page.locator('#workspace-global-search').fill('۷۰۰۰۱');
    await page.locator('#workspace-global-search').press('Enter'); await page.locator('#party-cardex-modal-close-btn').click();
    assert.equal(await page.locator('#input-party-name').inputValue(), 'پیش‌نویس بدون ثبت');
    await page.locator('#workspace-global-search').press('Escape');
    await page.locator('#btn-print-parties').click(); await page.locator('#document-print-modal-container').waitFor();
    assert.ok((await page.locator('#printable-paper-canvas').innerText()).includes(companyName), 'Removing decorative page branding must not strip company identity from printed reports');
    await page.locator('#document-print-modal-close-btn').click();
    assert.deepEqual(await snapshot(page), before);

    await clickSidebarPage(page, 'sidebar-page-cash-account-afn_cash', 'cash'); await current(page, 'cash:afn_cash');
    assert.equal(await ledger(page).locator('select, input').count(), 0, 'No duplicate account/search/filter controls under the balance cards');
    assert.equal(await page.locator('main').getByText('فیلتر و جستجوی هوشمند تراکنش‌ها', { exact: true }).count(), 0);
    assert.equal(await page.locator('main').getByRole('button', { name: /^(بازگشت|نمایش.*صندوق|همه صندوق)/ }).count(), 0, 'The existing all-accounts sidebar destination is sufficient');
    assert.equal(await funnel(page).count(), 1);
    assert.equal(await funnel(page).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.page-actions-filters').count(), 0);
    assert.equal(await ledger(page).locator('tbody tr').count(), 5);
    await page.screenshot({ path: path.join(artifacts, 'cash-ledger-clean-desktop.png'), animations: 'disabled' });
    await funnel(page).click();
    assert.equal(await page.locator('.page-actions-filters select').count(), 2);
    assert.equal(await page.locator('.page-actions-filters input').count(), 2);
    assert.equal(await filter(page, 'انتخاب صندوق').inputValue(), 'afn_cash');
    assert.equal(await filter(page, 'نوع عملیات').locator('option[value="sale_receipt"]').count(), 1, 'The specific invoice-sale receipt filter is preserved');
    await filter(page, 'نوع عملیات').selectOption('sale_receipt');
    assert.equal(await ledger(page).locator('tbody tr').count(), 1);
    assert.match(await ledger(page).locator('tbody').innerText(), /دریافت فاکتور فروش آزمایشی/);
    assert.match(await ledger(page).innerText(), /1,080\.00/);
    await filter(page, 'نوع عملیات').selectOption('all');
    await filter(page, 'از تاریخ (شمسی)').fill('۱۴۰۵/۰۷/۲۱'); await filter(page, 'تا تاریخ (شمسی)').fill('۱۴۰۵/۰۷/۲۲');
    assert.equal(await ledger(page).locator('tbody tr').count(), 3, 'Date filters restrict transactions while retaining the opening-balance row');
    await ledger(page).evaluate(element => { element.dataset.testInstance = 'same-ledger'; });
    await page.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();
    assert.equal(await ledger(page).getAttribute('data-test-instance'), 'same-ledger', 'Resetting filters must not navigate/reopen the same account');
    assert.equal(await funnel(page).getAttribute('aria-expanded'), 'true');
    assert.equal(await filter(page, 'انتخاب صندوق').inputValue(), 'afn_cash');
    assert.equal(await ledger(page).locator('tbody tr').count(), 5);
    await page.locator('.page-actions-search input').fill('دریافت عادی');
    assert.equal(await ledger(page).locator('tbody tr').count(), 2);
    await page.locator('.page-actions-search input').fill('');
    await filter(page, 'انتخاب صندوق').selectOption('usd_cash'); await current(page, 'cash:usd_cash');
    assert.equal(await page.locator('#sidebar-page-cash-account-usd_cash').getAttribute('aria-current'), 'page');
    assert.equal(await ledger(page).locator('tbody tr').count(), 2);
    assert.equal(await ledger(page).getByRole('button', { name: 'چاپ دفتر صندوق', exact: true }).count(), 0, 'The detailed print format uses the existing toolbar, not a second button');
    await page.locator('.page-actions-toolbar .is-print').click(); await page.locator('#document-print-modal-container').waitFor();
    assert.ok((await page.locator('#printable-paper-canvas').innerText()).includes(companyName));
    assert.equal(await page.locator('#printable-paper-canvas').getByText('موجودی فعلی (مانده جاری صندوق):', { exact: true }).count(), 1, 'Toolbar print keeps the original detailed ledger format and balance cards');
    await page.locator('#document-print-modal-close-btn').click();
    await clickSidebarPage(page, 'sidebar-page-cash-registers', 'cash'); await current(page, 'cash:all');
    assert.equal(await page.locator('#sidebar-page-cash-registers').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('main').getByRole('button', { name: 'تعریف صندوق جدید', exact: true }).count(), 0, 'Account creation is not duplicated under its toolbar');
    await page.locator('.page-actions-toolbar .is-create').click();
    await page.locator('.app-modal-heading .app-close-button').last().click();
    await navigateSidebar(page, 'دفتر گردش وجوه');
    await page.getByRole('heading', { name: 'دفتر گردش وجوه', exact: true }).waitFor();
    assert.equal(await page.locator('main select').count(), 0, 'The all-funds log also has no second inline filter');
    assert.equal(await page.getByRole('button', { name: 'چاپ کل دفتر', exact: true }).count(), 0);
    await funnel(page).click();
    assert.equal(await filter(page, 'نوع عملیات').locator('option').count(), 6, 'All log operations, including expenses, remain in the single funnel');
    await filter(page, 'نوع عملیات').selectOption('expense');
    assert.equal(await page.locator('main tbody tr').count(), 1);
    assert.match(await page.locator('main tbody').innerText(), /هزینه آزمایشی/);
    await page.locator('.page-actions-toolbar .is-print').click();
    await page.locator('#document-print-modal-container').waitFor();
    const logPaper = await page.locator('#printable-paper-canvas').innerText();
    assert.ok(logPaper.includes(companyName)); assert.match(logPaper, /تعداد کل اسناد: 1/);
    await page.locator('#document-print-modal-close-btn').click();
    await page.getByRole('button', { name: 'پاک کردن فیلترها', exact: true }).click();
    assert.equal(await page.locator('main tbody tr').count(), 5);
    assert.deepEqual(await snapshot(page), before, 'Navigation, filters, print and native scrolling must not post or rewrite financial data');

    await page.setViewportSize({ width: 1024, height: 900 });
    await clickSidebarPage(page, 'sidebar-page-cash-account-afn_cash', 'cash'); await checkHeader(page, 1024);
    await page.screenshot({ path: path.join(artifacts, 'single-row-header-1024.png'), animations: 'disabled' });
    await page.keyboard.press('Control+k'); await page.locator('#workspace-global-search').fill('تعریف طرف حساب');
    const panel = await page.locator('.workspace-search-panel').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 1024, 'Compact search keeps a readable, contained result panel');
    await page.locator('.workspace-search-results [role="option"]').filter({ hasText: 'تعریف طرف حساب' }).click(); await current(page, 'definitions:parties');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await navigateSidebar(page, 'تعریف طرف حساب');
      assert.ok(!(await page.locator('main').innerText()).includes(companyName));
      assert.equal(await page.locator('main [title="حرکت به بالا"], main [title="حرکت به پایین"]').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await clickSidebarPage(page, 'sidebar-page-cash-account-afn_cash', 'cash'); await funnel(page).click();
      await filter(page, 'نوع عملیات').selectOption('sale_receipt');
      assert.equal(await ledger(page).locator('tbody tr').count(), 1);
      await page.getByRole('button', { name: 'بستن فیلترهای فهرست', exact: true }).click();
      assert.equal(await funnel(page).getAttribute('aria-expanded'), 'false');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 390) await page.screenshot({ path: path.join(artifacts, 'cash-ledger-clean-mobile.png'), animations: 'disabled' });
    }
    assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(errors, []);
    console.log('PASS: unobstructed 70-party table with native keyboard scroll, no repeated company badge (branding retained on print), one cash funnel with account/operation/date/search/reset and exact navigation, no redundant all-accounts page button, smaller single-row header at 13 widths from 701–1600px, 390/320px containment, retained drafts and 21 unchanged financial datasets.');
    console.log(`Screenshots: ${artifacts}`);
  } catch (error) {
    if (page) {
      console.error('Declutter diagnostics:', (await page.locator('body').innerText().catch(() => '')).slice(0, 6500));
      await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

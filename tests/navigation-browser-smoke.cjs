/* Sidebar integration: real pages, isolated storage, synthetic data and blocked external traffic. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  launch, pageFor, login, clickSidebarPage, navigateSidebar, openAppearanceSettings, storagePrefix: prefix,
} = require('./browser-support.cjs');
const screenshots = process.env.NAVIGATION_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-navigation-smoke');
fs.mkdirSync(screenshots, { recursive: true });
const financeKeys = [
  'cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories',
  'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements',
  'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions',
  'asset_groups', 'fixed_assets', 'shareholders', 'currencies',
];
const snapshot = page => page.evaluate(({ prefix, keys }) => Object.fromEntries(keys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, keys: financeKeys });
const seed = page => page.evaluate(prefix => {
  const data = {
    cash_accounts: [
      { id: 'afn_cash', name: 'صندوق افغانی نمونه', currency: 'AFN', balance: 5000, initialBalance: 5000 },
      { id: 'usd_cash', name: 'صندوق دالری نمونه', currency: 'USD', balance: 200, initialBalance: 200 },
      { id: 'bank', name: 'بانک نمونه', currency: 'USD', balance: 40, initialBalance: 40 },
    ],
    cash: { afnBalance: 5000, usdBalance: 200, exchangeUsdBalance: 0, usdToAfnRate: 65 },
    parties: [{ id: 'sample-party', name: 'شخص آزمایشی', code: '101', type: 'both', phone: '', balanceUSD: -50, balanceAFN: 30, createdAt: '2026-10-15' }],
    products: [{ id: 'product', name: 'کالای آزمایشی', code: '201', category: 'آزمایش', baseUnit: 'تن (1000KG)', bagWeightKg: 50, bagsPerTon: 20, buyPriceUSD: 20, sellPriceUSD: 25, buyPriceAFN: 1300, sellPriceAFN: 1625, minStockTons: 1 }],
    warehouses: [{ id: 'wh', name: 'گدام نمونه', type: 'standard', location: '' }],
    stocks: [{ warehouseId: 'wh', productId: 'product', quantityTons: 5, quantityBags: 100 }],
    invoices: [], transactions: [], transfers: [], consignment_movements: [], incomes: [], expenses: [], fixed_assets: [], shareholders: [],
  };
  for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
}, prefix);
const manifest = page => page.evaluate(async prefix => {
  const { workspacePageGroups, workspacePageKey } = await import('/src/utils/navigation.ts');
  const accounts = JSON.parse(localStorage.getItem(prefix + 'cash_accounts') || '[]');
  return [
    { id: 'sidebar-btn-dashboard', key: 'dashboard:all', label: 'داشبورد مدیریتی' },
    { id: 'sidebar-btn-journal', key: 'journal:all', label: 'روزنامچه' },
    ...workspacePageGroups(accounts).flatMap(group => [
      ...(group.landingPage ? [{ id: `sidebar-group-${group.id}`, key: workspacePageKey(group.landingPage.tab, group.landingPage.filter), label: group.landingPage.label, group: group.id, tab: group.landingPage.tab, landing: true }] : []),
      ...group.items.map(item => ({
        id: `sidebar-page-${item.id}`, key: workspacePageKey(item.tab, item.filter), label: item.label, group: group.id, tab: item.tab, inSidebar: item.inSidebar,
      })),
    ]),
    { id: 'sidebar-page-production', key: 'production:all', label: 'فرآیند تولید' },
    { id: 'sidebar-page-company-units', key: 'company_units:all', label: 'تغییر واحد شرکت' },
  ];
}, prefix);

async function checkDestination(page, destination, mobile = false) {
  try {
    await clickSidebarPage(page, destination.id, destination.group);
    const content = page.locator('.workspace-page-view');
    assert.equal(await content.getAttribute('data-workspace-page'), destination.key);
    assert.ok((await content.innerText()).trim().length > 20, 'Page must contain real content');
    assert.ok(await content.getByRole('heading').count(), 'Page must have a heading');
    const selected = page.locator('#workspace-sidebar [aria-current="page"]');
    assert.equal(await selected.count(), 1, 'Only the exact leaf can be active');
    assert.equal(await selected.getAttribute('id'), destination.inSidebar === false ? `sidebar-group-${destination.group}` : destination.id);
    assert.equal(await content.locator('#trade-invoice-center').count(), destination.group === 'trade' ? 1 : 0, 'Only trade pages share the invoice center');
    assert.equal(await content.locator('#treasury-center').count(), destination.group === 'treasury' ? 1 : 0, 'Only treasury pages share the receive/payment center');
    if (destination.inSidebar === false) assert.equal(await page.locator(`#workspace-sidebar #${destination.id}`).count(), 0, 'Moved pages must not remain as hidden sidebar buttons');
    assert.equal(await content.locator('.trade-tab-bar, .treasury-tab-bar, [role="tablist"], [id^="def-tab-"], [id^="tab-btn-"]').count(), 0, 'No obsolete page-selector bars outside the shared center navigation');
    assert.equal(await page.locator('dialog[open], #access-modal-backdrop').count(), 0, 'Sidebar destinations must be inline pages, not modal navigation');
    if (['definitions', 'reports', 'settings', 'telegram_manager', 'legacy_trade', 'quick_backup'].includes(destination.tab) || /^(new_purchase|purchase_invoices|new_sale|sales_invoices|new_receipt|receipts_list|new_payment|payments_list|income_receipt|expense_payment|legacy_receipt|legacy_payment)$/.test(destination.tab || '')) {
      assert.equal(await content.getByRole('heading', { name: destination.label, exact: true }).count(), 1, 'The heading must describe the selected page');
    }
    if (destination.tab === 'legacy_receipt' || destination.tab === 'legacy_payment') {
      assert.equal(await content.locator('form').count(), 1, 'Advanced form must remain available');
      assert.ok(await content.locator('form input').count() >= 6, 'Advanced form fields must not be removed');
      assert.ok(await content.locator('form input[type="number"]').count() >= 3);
      assert.ok(await content.locator('form select').count() >= 3);
      assert.equal(await content.locator(`[id="${destination.tab === 'legacy_receipt' ? 'receipt' : 'payment'}-create-date-input"]`).count(), 1);
    }
    if (mobile) {
      assert.equal(await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.workspace-sidebar-overlay').count(), 0);
      assert.equal(await page.locator('#workspace-sidebar').getAttribute('role'), null);
      assert.ok(await page.locator('#workspace-sidebar').evaluate(element => element.inert));
      assert.equal(await content.getByRole('button', { name: 'باز و بسته کردن منوی اصلی' }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The page must stay within the mobile viewport');
    }
  } catch (error) {
    console.error(`Failed destination: ${destination.id}`, error);
    await page.screenshot({ path: path.join(screenshots, `failed-${mobile ? 'mobile' : 'desktop'}-${destination.id}.png`), animations: 'disabled', timeout: 5000 }).catch(() => {});
    throw new Error(`${mobile ? 'Mobile' : 'Desktop'} ${destination.id}: ${error.message}`, { cause: error });
  }
}

async function embeddedSettings(page) {
  await navigateSidebar(page, 'مشخصات شرکت');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#access-settings-page').count(), 1, 'Escape must not dismiss an independent settings page');
  // Header dialogs remain optional quick actions; they must not replace the sidebar page.
  await page.locator('.workspace-profile-pill').click();
  await page.getByRole('button', { name: 'مدیریت کاربران و دسترسی‌ها', exact: true }).click();
  await page.locator('#access-modal-backdrop').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#access-modal-backdrop').count(), 0);
  assert.equal(await page.locator('.workspace-page-view').getAttribute('data-workspace-page'), 'settings:company');
  await page.locator('.workspace-profile-pill').click();
  await page.getByRole('button', { name: 'پشتیبان‌گیری اطلاعات', exact: true }).click();
  assert.equal(await page.locator('.workspace-main [data-workspace-page]').count(), 1);
  await page.getByRole('button', { name: 'بستن', exact: true }).click();

  await navigateSidebar(page, 'تنظیمات ظاهر و تم');
  assert.equal(await page.locator('section.appearance-page').count(), 1);
  const original = await page.locator('html').getAttribute('data-theme');
  const options = page.locator('.appearance-page .appearance-preset-option input');
  const saved = await options.evaluateAll(options => options.find(option => option.checked)?.value);
  const next = await options.evaluateAll(options => options.find(option => !option.checked)?.value);
  await page.locator(`.appearance-page .appearance-preset-option[data-preset-theme="${next}"]`).click();
  await page.getByRole('button', { name: 'انصراف از تغییرات', exact: true }).click();
  assert.equal(await page.locator('.appearance-page input:checked').first().inputValue(), saved);
  assert.equal(await page.locator('html').getAttribute('data-theme'), original);
  // An unsaved preview also rolls back when leaving the standalone page.
  await page.locator(`.appearance-page .appearance-preset-option[data-preset-theme="${next}"]`).click();
  await navigateSidebar(page, 'لیست فروشات');
  assert.equal(await page.locator('html').getAttribute('data-theme'), original);
  await openAppearanceSettings(page);
  await page.locator('dialog.appearance-dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
}

async function cashAccountSwitch(page) {
  await clickSidebarPage(page, 'sidebar-page-cash-account-afn_cash', 'cash');
  await page.getByRole('button', { name: 'فیلترهای فهرست', exact: true }).click();
  await page.getByRole('combobox', { name: 'انتخاب صندوق', exact: true }).selectOption('usd_cash');
  await page.waitForFunction(() => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === 'cash:usd_cash');
  assert.equal(await page.locator('#workspace-sidebar [aria-current="page"]').getAttribute('id'), 'sidebar-page-cash-account-usd_cash');
  await clickSidebarPage(page, 'sidebar-page-cash-registers', 'cash');
  await page.waitForFunction(() => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === 'cash:all');
  assert.equal(await page.locator('#workspace-sidebar [aria-current="page"]').getAttribute('id'), 'sidebar-page-cash-registers');
}

(async () => {
  const browser = await launch();
  const errors = [];
  try {
    const page = await pageFor(browser, errors);
    page.setDefaultTimeout(15000);
    await login(page);
    await seed(page);
    await page.reload({ waitUntil: 'networkidle' });
    const before = await snapshot(page), destinations = await manifest(page);
    for (const destination of destinations) await checkDestination(page, destination);
    assert.deepEqual(await snapshot(page), before, 'Visiting every sidebar page must not post, delete or change financial data');
    console.log(`PASS: ${destinations.length} desktop destinations, accurate sidebar/center selection, page headings and the two separate shared centers.`);
    await cashAccountSwitch(page);
    await embeddedSettings(page);
    assert.deepEqual(await snapshot(page), before, 'Settings navigation and account switching must not alter finances');
    await navigateSidebar(page, 'ثبت فاکتور خرید');
    await page.screenshot({ path: path.join(screenshots, 'purchase-sidebar-desktop.png'), animations: 'disabled', timeout: 60000 });

    await page.setViewportSize({ width: 390, height: 844 });
    for (const destination of destinations) await checkDestination(page, destination, true);
    assert.deepEqual(await snapshot(page), before, 'Mobile navigation must not alter finances');
    await navigateSidebar(page, 'لیست دریافت‌ها');
    await page.screenshot({ path: path.join(screenshots, 'receipts-mobile.png'), animations: 'disabled', timeout: 60000 });
    await page.locator('.workspace-menu-toggle').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('.workspace-menu-toggle').click();
    await page.locator('.workspace-sidebar-overlay').click({ position: { x: 5, y: 5 } });
    assert.equal(await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('.workspace-company-pill').click();
    await page.locator('.dash-quick').waitFor();
    assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(errors, []);
    console.log(`PASS: ${destinations.length} mobile destinations via real sidebar/center actions, closing drawer, Escape/overlay behavior, account switching, inline settings and retained header dialogs; finance snapshot unchanged.`);
    console.log(`Screenshots: ${screenshots}`);
    await page.context().close();
    await require('./navigation-workflows.cjs').workflowSmoke(browser, errors);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

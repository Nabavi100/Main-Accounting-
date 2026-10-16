/* Smart document defaults. Fresh synthetic storage; never posts real money or sends messages. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, pageFor, login, navigateSidebar, readData, storagePrefix: prefix } = require('./browser-support.cjs');
const artifacts = process.env.SMART_DOCUMENTS_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-smart-documents');
fs.mkdirSync(artifacts, { recursive: true });
const keys = ['cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories', 'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements', 'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions', 'asset_groups', 'fixed_assets', 'shareholders', 'currencies'];
const snapshot = page => page.evaluate(({ prefix, keys }) => Object.fromEntries(keys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, keys });
const number = async (page, selector) => Number(await page.locator(selector).inputValue());
const round = n => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
async function choose(page, selector, code) {
  await page.locator(selector).fill(code);
  await page.locator('.trade-lookup-popup button').first().click();
}
async function newInvoice(page, kind) {
  await navigateSidebar(page, kind === 'buy' ? 'ثبت فاکتور خرید' : 'ثبت فاکتور فروش');
  await choose(page, '#trade-party', '101');
  await choose(page, '[aria-label="کالای ردیف 1"]', '901');
}
async function removeInvoice(page, id = '1') {
  await page.getByRole('button', { name: `حذف فاکتور #${id}`, exact: true }).click();
  await page.locator('.workspace-dialog').getByRole('button', { name: 'حذف فاکتور', exact: true }).click();
}
async function removeTransaction(page, id) {
  await page.getByRole('button', { name: `حذف سند #${id}`, exact: true }).click();
  await page.getByRole('button', { name: 'تأیید حذف سند', exact: true }).click();
}
async function restored(page, before) {
  await page.waitForFunction(({ prefix, before }) => Object.entries(before).every(([key, value]) => localStorage.getItem(prefix + key) === value), { prefix, before });
  assert.deepEqual(await snapshot(page), before);
}
async function toggleTitle(page, group, draftSelector, expectedDraft) {
  const header = page.locator(`#sidebar-group-${group}`);
  const key = await page.locator('[data-workspace-page]').getAttribute('data-workspace-page');
  assert.equal(await header.getAttribute('aria-expanded'), 'true');
  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator(`#workspace-menu-${group}`).count(), 0);
  await header.click();
  assert.equal(await header.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('[data-workspace-page]').getAttribute('data-workspace-page'), key, 'Accordion titles do not navigate away from the current document');
  if (draftSelector) assert.equal(await page.locator(draftSelector).inputValue(), expectedDraft, 'Closing and reopening the title preserves the draft');
}
const seed = page => page.evaluate(prefix => {
  const data = {
    parties: [{ id: 'smart-party', name: 'طرف حساب آزمایشی', code: '101', phone: '', type: 'both', balanceAFN: 0, balanceUSD: 0, createdAt: '2026-10-16' }],
    products: [{ id: 'smart-product', name: 'کالای آزمایشی هوشمند', code: '901', category: 'نمونه', baseUnit: 'تن (1000KG)', bagWeightKg: 50, bagsPerTon: 20, buyPriceUSD: 100, buyPriceAFN: 6500, sellPriceUSD: 150, sellPriceAFN: 9750, minStockTons: 0 }],
    warehouses: [{ id: 'smart-wh', name: 'گدام نمونه', type: 'standard', location: '' }],
    stocks: [{ warehouseId: 'smart-wh', productId: 'smart-product', quantityTons: 10, quantityBags: 200 }],
    // Put sarafi first deliberately: array order must not defeat the main-company preference.
    cash_accounts: [
      { id: 'exchange_usd_cash', name: 'صندوق دالری صرافی', currency: 'USD', balance: 300, initialBalance: 300, isDefault: true, type: 'exchange' },
      { id: 'usd_cash', name: 'صندوق دالری شرکت', currency: 'USD', balance: 2000, initialBalance: 2000, isDefault: true, type: 'cash' },
      { id: 'afn_cash', name: 'صندوق افغانی شرکت', currency: 'AFN', balance: 100000, initialBalance: 100000, isDefault: true, type: 'cash' },
    ],
    cash: { usdBalance: 2000, afnBalance: 100000, exchangeUsdBalance: 300, usdToAfnRate: 65 },
    currencies: [
      { id: 'usd', code: 'USD', name: 'دالر', symbol: '$', isBase: true, isDefault: true, exchangeRateToAFN: 65, exchangeRateToUSD: 1 },
      { id: 'afn', code: 'AFN', name: 'افغانی', symbol: '؋', isDefault: true, exchangeRateToAFN: 1, exchangeRateToUSD: 1 / 65 },
    ],
    invoices: [], transactions: [], transfers: [], consignment_movements: [], incomes: [], expenses: [],
  };
  for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
}, prefix);
(async () => {
  const browser = await launch(), errors = [];
  let page;
  try {
    page = await pageFor(browser, errors, { width: 1600, height: 1050 });
    page.setDefaultTimeout(18000);
    page.on('dialog', dialog => dialog.accept());
    await login(page); await seed(page); await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const before = await snapshot(page);
    await newInvoice(page, 'buy');
    assert.equal(await page.locator('#trade-cash-account').inputValue(), 'usd_cash');
    assert.equal(await page.locator('#trade-exchange-rate').inputValue(), '65');
    for (const [method, paid, balance] of [['نقدی', 100, 0], ['نسیه', 0, 100], ['نیمه نسیه', 50, 50]]) {
      await page.locator('#trade-payment-type').selectOption(method);
      assert.equal(await number(page, '#trade-paid-amount'), paid);
      assert.equal(await number(page, '#trade-balance-amount'), balance);
    }
    await page.getByLabel('تعداد ردیف 1', { exact: true }).fill('3');
    assert.equal(await number(page, '#trade-paid-amount'), 150, 'Automatic half follows the live total');
    await page.locator('#trade-paid-amount').fill('37.123456');
    await page.getByLabel('تعداد ردیف 1', { exact: true }).fill('4');
    assert.equal(await number(page, '#trade-paid-amount'), 37.123456, 'A manual installment is never silently replaced');
    await page.locator('#trade-currency').selectOption('AFN');
    assert.equal(await page.locator('#trade-cash-account').inputValue(), 'afn_cash');
    assert.equal(await page.locator('#trade-exchange-rate').inputValue(), '65');
    assert.equal(await number(page, '#trade-paid-amount'), round(37.123456 * 65));
    for (const [method, paid, balance] of [['نسیه', 0, 26000], ['نقدی', 26000, 0], ['نیمه نسیه', 13000, 13000]]) {
      await page.locator('#trade-payment-type').selectOption(method);
      assert.equal(await number(page, '#trade-paid-amount'), paid);
      assert.equal(await number(page, '#trade-balance-amount'), balance);
    }
    await page.screenshot({ path: path.join(artifacts, 'invoice-afn-smart-defaults.png'), animations: 'disabled' });
    await page.locator('#trade-invoice-number').fill('SMART-DRAFT-17');
    await toggleTitle(page, 'trade', '#trade-invoice-number', 'SMART-DRAFT-17');
    await page.locator('#trade-currency').selectOption('USD');
    assert.equal(await page.locator('#trade-cash-account').inputValue(), 'usd_cash');
    await page.locator('#trade-cash-account').selectOption('exchange_usd_cash');
    await page.getByLabel('تعداد ردیف 1', { exact: true }).fill('5');
    assert.equal(await page.locator('#trade-cash-account').inputValue(), 'exchange_usd_cash');
    await page.getByRole('button', { name: 'افزودن هزینه جدید', exact: true }).click();
    await choose(page, '[aria-label="طرف حساب هزینه 1"]', '101');
    await page.getByLabel('شرح هزینه 1', { exact: true }).fill('کرایه نمونه');
    await page.getByLabel('ارز هزینه 1', { exact: true }).selectOption('AFN');
    await page.getByLabel('مبلغ هزینه 1', { exact: true }).fill('650');
    assert.equal(await number(page, '#trade-expenses-total'), 10);
    await page.locator('#trade-exchange-rate').fill('50');
    assert.equal(await number(page, '#trade-expenses-total'), 13);
    assert.equal(await page.locator('#trade-cash-account').inputValue(), 'exchange_usd_cash');
    await page.locator('#trade-exchange-rate').fill('0');
    await page.locator('.trade-save-button').click();
    assert.equal((await readData(page, 'invoices')).length, 0, 'An invalid quote cannot post even when USD is the system base');
    await page.locator('#trade-exchange-rate').fill('65');
    assert.deepEqual(await snapshot(page), before, 'All smart defaults, rates, method changes and title toggles are read-only until Save');

    // Actual AFN half-credit purchase: the correct fund, cash and outstanding balance are posted once.
    await newInvoice(page, 'buy');
    await page.locator('#trade-currency').selectOption('AFN');
    await page.locator('#trade-payment-type').selectOption('نیمه نسیه');
    assert.equal(await number(page, '#trade-paid-amount'), 3250);
    await page.locator('.trade-save-button').click(); await page.locator('.trade-invoice-list').waitFor();
    let document = (await readData(page, 'invoices'))[0];
    assert.equal(document.currency, 'AFN'); assert.equal(document.usdToAfnRate, 65);
    assert.equal(document.exchangeRate, 1 / 65); assert.equal(document.exchangeRateBaseCurrency, 'USD');
    assert.equal(document.cashRegisterId, 'afn_cash'); assert.equal(document.paidAmount, 3250); assert.equal(document.balanceAmount, 3250);
    assert.equal((await readData(page, 'cash')).afnBalance, 96750);
    assert.equal((await readData(page, 'parties'))[0].balanceAFN, 3250);
    await removeInvoice(page); await restored(page, before);

    // Manual sarafi choice is honored for a cash sale; it must not leak into the company USD fund.
    await newInvoice(page, 'sell');
    assert.equal(await number(page, '#trade-paid-amount'), 150);
    await page.locator('#trade-cash-account').selectOption('exchange_usd_cash');
    await page.locator('.trade-save-button').click(); await page.locator('.trade-invoice-list').waitFor();
    document = (await readData(page, 'invoices'))[0];
    assert.equal(document.cashRegisterId, 'exchange_usd_cash'); assert.equal(document.balanceAmount, 0);
    assert.equal((await readData(page, 'cash')).exchangeUsdBalance, 450);
    assert.equal((await readData(page, 'cash')).usdBalance, 2000);
    await removeInvoice(page); await restored(page, before);

    // Direct receipt: visible 65, internally divide 6500 AFN into exactly 100 USD of settlement.
    await navigateSidebar(page, 'ثبت دریافت (ورودی)');
    assert.equal(await page.locator('#treasury-cash').inputValue(), 'usd_cash');
    assert.equal(await page.locator('#treasury-rate').inputValue(), '65');
    await choose(page, '#treasury-party', '101');
    await page.locator('#treasury-number').fill('SMART-R');
    await page.locator('#treasury-currency').selectOption('AFN');
    assert.equal(await page.locator('#treasury-cash').inputValue(), 'afn_cash');
    await page.locator('.treasury-exchange-toggle').click();
    await page.locator('#treasury-amount').fill('6500');
    assert.equal(await page.locator('#treasury-cross-rate').inputValue(), '65');
    assert.equal(await number(page, '#treasury-ledger-amount'), 100);
    await toggleTitle(page, 'treasury', '#treasury-amount', '6500');
    await page.screenshot({ path: path.join(artifacts, 'receipt-afn-canonical-rate.png'), animations: 'disabled' });
    await page.locator('.treasury-submit').click();
    await page.locator('.treasury-list').waitFor();
    document = (await readData(page, 'transactions'))[0];
    assert.equal(document.usdToAfnRate, 65); assert.equal(document.exchangeRate, 65); assert.equal(document.quoteToBase, 1 / 65);
    assert.equal(document.amount, 100); assert.equal(document.cashAmount, 6500); assert.equal(document.cashRegister, 'afn_cash');
    assert.equal((await readData(page, 'cash')).afnBalance, 106500);
    await removeTransaction(page, 'SMART-R'); await restored(page, before);

    // The treasury transfer form uses the SAME 65 in both directions, not the direct ratio 0.015384.
    for (const [from, to, amount, target, id] of [['USD', 'afn_cash', '10', 650, 'SMART-T1'], ['AFN', 'usd_cash', '650', 10, 'SMART-T2']]) {
      await navigateSidebar(page, 'ثبت پرداخت (خروجی)');
      await page.locator('#treasury-number').fill(id);
      await page.locator('#treasury-currency').selectOption(from);
      assert.equal(await page.locator('#treasury-cash').inputValue(), from === 'USD' ? 'usd_cash' : 'afn_cash');
      await page.locator('#treasury-destination').selectOption(to);
      await page.locator('#treasury-amount').fill(amount);
      assert.equal(await page.locator('#treasury-rate').inputValue(), '65');
      assert.equal(await page.locator('#treasury-cross-rate').inputValue(), '65');
      assert.equal(await number(page, '#treasury-ledger-amount'), target);
      await page.locator('#treasury-cross-rate').fill('50');
      assert.equal(await page.locator('#treasury-rate').inputValue(), '50', 'Both rate controls share one canonical quote');
      assert.equal(await number(page, '#treasury-ledger-amount'), from === 'USD' ? 500 : 13);
      await page.locator('#treasury-rate').fill('65');
      await page.locator('.treasury-submit').click(); await page.locator('.treasury-list').waitFor();
      document = (await readData(page, 'transactions'))[0];
      assert.equal(document.targetAmount, target); assert.equal(document.exchangeRate, 65); assert.equal(document.usdToAfnRate, 65);
      await page.getByRole('button', { name: `ویرایش سند #${id}`, exact: true }).click();
      assert.equal(await page.locator('.workspace-dialog #treasury-rate').inputValue(), '65');
      await page.getByRole('button', { name: 'بستن پنجره', exact: true }).click();
      await removeTransaction(page, id); await restored(page, before);
    }

    // The standalone cash-to-cash screen uses the definition's quote too, without cent-rounding the result.
    await navigateSidebar(page, 'عملیه صندوق به صندوق');
    assert.equal(await page.locator('main select').nth(0).inputValue(), 'afn_cash');
    assert.equal(await page.locator('main select').nth(1).inputValue(), 'usd_cash');
    assert.equal(await page.locator('#transfer-cross-rate').inputValue(), '65');
    await page.locator('main').getByPlaceholder('مثال: 50,000', { exact: true }).fill('1');
    assert.equal(await page.locator('#transfer-target-amount').getAttribute('data-amount'), '0.015385');
    await page.locator('#transfer-cross-rate').fill('0');
    await page.getByRole('button', { name: 'ثبت سند انتقال', exact: true }).click();
    assert.equal((await readData(page, 'transactions')).length, 0, 'A zero quote must not silently fall back to 65');
    await page.locator('#transfer-cross-rate').fill('65');
    await page.getByRole('button', { name: 'ثبت سند انتقال', exact: true }).click();
    await navigateSidebar(page, 'تاریخچهٔ انتقال و صرافی');
    document = (await readData(page, 'transactions'))[0];
    assert.equal(document.targetAmount, 0.015385); assert.equal(document.exchangeRate, 65);
    assert.equal((await readData(page, 'cash')).usdBalance, 2000.015385);
    await navigateSidebar(page, 'لیست پرداخت‌ها');
    await page.getByRole('button', { name: `ویرایش سند #${document.transactionNumber}`, exact: true }).click();
    assert.equal(await page.locator('.workspace-dialog #treasury-mode').inputValue(), 'transfer', 'An exchange from the cash history is still an internal transfer when edited from treasury');
    assert.equal(await page.locator('.workspace-dialog #treasury-rate').inputValue(), '65');
    await page.locator('.workspace-dialog .treasury-submit').click();
    await page.locator('.workspace-dialog').waitFor({ state: 'detached' });
    assert.equal((await readData(page, 'transactions'))[0].type, 'currency_exchange');
    assert.equal((await readData(page, 'cash')).usdBalance, 2000.015385, 'Saving an unchanged exchange must never replay or reinterpret its cash effect');
    await navigateSidebar(page, 'تاریخچهٔ انتقال و صرافی');
    await page.locator('main tbody tr').filter({ hasText: document.transactionNumber }).getByTitle('ابطال / حذف سند', { exact: true }).click();
    await restored(page, before);

    // Income / expense ordinary documents also follow their currency and preserve manual sarafi choice.
    for (const [label, kind] of [['دریافت عواید', 'income'], ['پرداخت هزینه', 'expense']]) {
      await navigateSidebar(page, label);
      await page.locator(`#${kind}-currency`).selectOption('USD');
      assert.equal(await page.locator(`#${kind}-cash-account`).inputValue(), 'usd_cash');
      await page.locator(`#${kind}-cash-account`).selectOption('exchange_usd_cash');
      await page.locator(`#${kind}-amount`).fill('10');
      assert.equal(await page.locator(`#${kind}-cash-account`).inputValue(), 'exchange_usd_cash');
      await page.locator(`#${kind}-currency`).selectOption('AFN');
      assert.equal(await page.locator(`#${kind}-cash-account`).inputValue(), 'afn_cash');
    }
    await restored(page, before);

    // Whole title hit area, not merely the little chevron, works on phones too.
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await navigateSidebar(page, 'ثبت فاکتور فروش');
      await page.locator('#trade-invoice-number').fill(`MOBILE-${width}`);
      await page.locator('.workspace-menu-toggle').click();
      await toggleTitle(page, 'trade', '#trade-invoice-number', `MOBILE-${width}`);
      await page.locator('#sidebar-group-treasury').click();
      await page.waitForFunction(() => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === 'receipt_payment_hub:center');
      // Entering a different page closes the mobile drawer by design; accordion-only toggles do not.
      await page.waitForFunction(() => document.querySelector('.workspace-menu-toggle')?.getAttribute('aria-expanded') === 'false');
      await page.locator('.workspace-menu-toggle').click();
      await toggleTitle(page, 'treasury');
      assert.equal(await page.locator('.workspace-menu-toggle').getAttribute('aria-expanded'), 'true', 'Toggling an accordion must not close the entire mobile drawer');
      await page.locator('#workspace-sidebar .workspace-sidebar-close').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 390) await page.screenshot({ path: path.join(artifacts, 'smart-treasury-mobile.png'), animations: 'disabled' });
    }
    await restored(page, before); assert.deepEqual(errors, []);
    console.log('PASS: canonical 1 USD = 65 AFN in both conversion directions, matching main-company funds despite sarafi-first ordering, retained manual overrides, live cash/credit/half settlements and foreign expenses, exact synthetic purchase/sale/receipt/transfer posting + reversal, whole-title accordion toggles with retained drafts at desktop/390/320px, 21 restored financial datasets and no browser errors.');
    console.log(`Screenshots: ${artifacts}`);
  } catch (error) {
    if (page) {
      console.error('Smart-document diagnostics:', (await page.locator('body').innerText().catch(() => '')).slice(0, 6500));
      console.error('Financial state:', await readData(page, 'invoices').catch(() => null), await readData(page, 'transactions').catch(() => null));
      await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled' }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

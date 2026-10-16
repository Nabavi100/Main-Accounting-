/* Local UI regression: calm actions, discoverable close controls and genuine header search. No live messages/postings. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, pageFor, login, navigateSidebar, clickSidebarPage, openAppearanceSettings, storagePrefix: prefix } = require('./browser-support.cjs');
const artifacts = process.env.WORKSPACE_POLISH_SCREENSHOT_DIR || path.join(os.tmpdir(), 'accounting-workspace-polish');
fs.mkdirSync(artifacts, { recursive: true });
const financeKeys = ['cash', 'cash_accounts', 'parties', 'party_groups', 'products', 'product_categories', 'warehouses', 'stocks', 'invoices', 'transactions', 'transfers', 'consignment_movements', 'incomes', 'expenses', 'income_categories', 'expense_categories', 'expense_definitions', 'asset_groups', 'fixed_assets', 'shareholders', 'currencies'];
const snapshot = page => page.evaluate(({ prefix, financeKeys }) => Object.fromEntries(financeKeys.map(key => [key, localStorage.getItem(prefix + key)])), { prefix, financeKeys });
const search = page => page.locator('#workspace-global-search');
const options = page => page.locator('.workspace-search-option');
const assertContained = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No document-wide horizontal overflow');
async function visibleClose(button) {
  await button.waitFor();
  assert.equal(await button.getAttribute('type'), 'button');
  assert.match(await button.innerText(), /بستن/);
  const style = await button.evaluate(element => {
    const css = getComputedStyle(element), rect = element.getBoundingClientRect();
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => { const x = channel / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; });
    const luminance = value => { const c = rgb(value); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
    const a = luminance(css.color), b = luminance(css.backgroundColor);
    return { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), background: css.backgroundColor, color: css.color };
  });
  assert.ok(style.width >= 71 && style.height >= 35); assert.ok(style.contrast >= 4.5, JSON.stringify(style));
  assert.equal(style.background, 'rgb(173, 50, 67)'); assert.equal(style.color, 'rgb(255, 255, 255)');
}
(async () => {
  const browser = await launch(), errors = [];
  let page;
  try {
    page = await pageFor(browser, errors, { width: 1600, height: 980 });
    await login(page);
    await page.evaluate(prefix => {
      const data = {
        parties: [
          { id: 'alpha', name: 'علی کاظمی', code: '101', phone: '0700123456', company: 'تجارت نبوی', type: 'customer', balanceAFN: -123.123456, balanceUSD: 4, initialBalanceAFN: -123.123456, initialBalanceUSD: 4, createdAt: '2026-10-15', telegramChatId: 'PRIVATE-CHAT-NOT-SEARCHABLE' },
          { id: 'beta', name: 'علی رضا', code: '102', phone: '0700999888', type: 'both', balanceAFN: 0, balanceUSD: 10, createdAt: '2026-10-15' },
          { id: 'safe', name: 'نام <مشتری> نمونه', code: '103', phone: '', type: 'supplier', balanceAFN: 0, balanceUSD: 0, createdAt: '2026-10-15' },
        ],
        cash: { afnBalance: 5000, usdBalance: 200, exchangeUsdBalance: 0, usdToAfnRate: 65 },
        cash_accounts: [{ id: 'afn_cash', name: 'صندوق افغانی', currency: 'AFN', balance: 5000, initialBalance: 5000 }, { id: 'usd_cash', name: 'صندوق دالری', currency: 'USD', balance: 200, initialBalance: 200 }, { id: 'test-bank', name: 'بانک نمونه', currency: 'USD', balance: 40, initialBalance: 40 }],
        invoices: [], transactions: [], transfers: [], consignment_movements: [], incomes: [], expenses: [], fixed_assets: [], shareholders: [],
        income_categories: [{ id: 'income-category', name: 'خدمات' }], expense_categories: [{ id: 'expense-category', name: 'هزینه‌های جاری' }],
      };
      for (const [key, value] of Object.entries(data)) localStorage.setItem(prefix + key, JSON.stringify(value));
    }, prefix);
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('.dash-quick').waitFor();
    const before = await snapshot(page);
    assert.equal(await page.locator('.workspace-header .appearance-trigger, .workspace-header #btn-theme-switcher-toggle').count(), 0);
    assert.ok(await search(page).isVisible());

    await page.keyboard.press('Control+k'); assert.equal(await search(page).evaluate(element => element === document.activeElement), true);
    await search(page).fill('لیست خريد');
    await options(page).filter({ hasText: 'لیست خریدها' }).click();
    await page.locator('#trade-invoice-search').waitFor();
    assert.equal(await page.locator('#trade-center-page-purchase-list').getAttribute('aria-current'), 'page');
    await search(page).fill('بانک نمونه'); await options(page).filter({ hasText: 'بانک نمونه' }).click();
    assert.equal(await page.locator('#sidebar-page-cash-account-test-bank').getAttribute('aria-current'), 'page');

    await navigateSidebar(page, 'ثبت فاکتور خرید');
    await page.locator('#trade-invoice-number').fill('UNSAVED-321');
    await search(page).fill('علي كاظمي');
    assert.equal(await options(page).count(), 1);
    await page.screenshot({ path: path.join(artifacts, 'header-customer-search-desktop.png'), animations: 'disabled' });
    await search(page).press('Enter');
    const cardex = page.locator('#party-cardex-modal-container'); await cardex.waitFor();
    assert.match(await cardex.innerText(), /علی کاظمی/);
    await visibleClose(page.locator('#party-cardex-modal-close-btn'));
    assert.equal(await page.locator('#party-cardex-modal-close-btn').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Control+k'); assert.equal(await search(page).evaluate(element => element === document.activeElement), false);
    const afnTab = cardex.getByRole('button', { name: /حساب افغانی/ });
    const usdTab = cardex.getByRole('button', { name: /حساب دالری/ });
    assert.equal(await afnTab.getAttribute('aria-pressed'), 'true');
    assert.equal(await usdTab.getAttribute('aria-pressed'), 'false');
    const activeColor = await afnTab.evaluate(element => getComputedStyle(element).backgroundColor);
    assert.notEqual(activeColor, await usdTab.evaluate(element => getComputedStyle(element).backgroundColor));
    await usdTab.click();
    assert.equal(await afnTab.getAttribute('aria-pressed'), 'false');
    assert.equal(await usdTab.getAttribute('aria-pressed'), 'true');
    await afnTab.click();
    await page.screenshot({ path: path.join(artifacts, 'clear-cardex-close-desktop.png'), animations: 'disabled' });
    await page.locator('#party-cardex-modal-close-btn').click(); await cardex.waitFor({ state: 'detached' });
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'UNSAVED-321');
    await search(page).fill('٠٧٠٠١٢٣٤٥٦'); await search(page).press('Enter'); await cardex.waitFor();
    await page.keyboard.press('Escape'); await cardex.waitFor({ state: 'detached' });
    await search(page).fill('۱۰۲'); await search(page).press('Enter'); await cardex.waitFor();
    assert.match(await cardex.innerText(), /علی رضا/); await page.locator('#party-cardex-modal-close-btn').click();
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'UNSAVED-321');

    await search(page).fill('نام <مشتری>');
    assert.ok((await options(page).innerText()).includes('نام <مشتری> نمونه'));
    assert.equal(await page.locator('.workspace-search-results مشتری').count(), 0);
    await search(page).fill('PRIVATE-CHAT-NOT-SEARCHABLE'); await page.locator('.workspace-search-empty').waitFor();
    assert.equal(await options(page).count(), 0);
    await page.locator('.workspace-global-search-clear').click();
    assert.equal(await search(page).inputValue(), '');
    await search(page).press('Escape'); assert.equal(await search(page).getAttribute('aria-expanded'), 'false');
    await search(page).fill('گزارش');
    const first = await options(page).first().getAttribute('id');
    await search(page).press('ArrowDown'); assert.notEqual(await search(page).getAttribute('aria-activedescendant'), first);
    const selection = await search(page).getAttribute('aria-activedescendant');
    assert.equal(await page.locator(`[id="${selection}"]`).getAttribute('aria-selected'), 'true');
    await search(page).press('Escape');
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'UNSAVED-321');

    await page.getByRole('button', { name: 'افزودن طرف حساب جدید', exact: true }).click();
    const quickClose = page.locator('.app-modal-heading .app-close-button').last();
    await visibleClose(quickClose); await quickClose.click();
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'UNSAVED-321');
    await page.getByRole('button', { name: 'انتخاب تاریخ خرید', exact: true }).click();
    await visibleClose(page.getByRole('dialog').locator('.app-close-button'));
    await page.getByRole('dialog').locator('.app-close-button').click();
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'UNSAVED-321');
    await visibleClose(page.getByRole('button', { name: 'بستن فرم فاکتور و بازگشت به فهرست', exact: true }));
    await page.getByRole('button', { name: 'بستن فرم فاکتور و بازگشت به فهرست', exact: true }).click();
    assert.equal(await page.locator('#trade-center-page-purchase-list').getAttribute('aria-current'), 'page');

    // Ordinary output tools now share one quiet treatment, not separate red/green/cyan fills.
    const colors = await page.locator('.page-action:not(.is-create)').evaluateAll(buttons => buttons.map(button => ({ color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor })));
    assert.equal(new Set(colors.map(style => JSON.stringify(style))).size, 1);
    await page.screenshot({ path: path.join(artifacts, 'calm-output-actions-desktop.png'), animations: 'disabled' });
    await openAppearanceSettings(page);
    await visibleClose(page.getByRole('button', { name: 'بستن تنظیمات ظاهر', exact: true }));
    await page.getByRole('button', { name: 'بستن تنظیمات ظاهر', exact: true }).click();

    // Real form dialogs and full-page forms have visible exits; closing never saves.
    for (const section of ['عواید و درآمدها', 'هزینه‌ها و مصارف']) {
      await navigateSidebar(page, section);
      await page.locator(section === 'عواید و درآمدها' ? '#btn-new-income' : '#btn-new-expense').click();
      const close = page.locator('.app-modal-heading .app-close-button').last(); await visibleClose(close); await close.click();
    }
    await navigateSidebar(page, 'ثبت دریافت (ورودی)');
    await visibleClose(page.getByRole('button', { name: 'بستن فرم خزانه و بازگشت به فهرست', exact: true }));
    await page.getByRole('button', { name: 'بستن فرم خزانه و بازگشت به فهرست', exact: true }).click();
    assert.equal(await page.locator('#treasury-center-page-receipt-list').getAttribute('aria-current'), 'page');
    assert.deepEqual(await snapshot(page), before);

    await page.setViewportSize({ width: 390, height: 844 });
    await clickSidebarPage(page, 'sidebar-btn-dashboard');
    await search(page).fill('علی'); await assertContained(page);
    await page.screenshot({ path: path.join(artifacts, 'header-search-mobile.png'), animations: 'disabled' });
    await options(page).filter({ hasText: 'علی کاظمی' }).click(); await cardex.waitFor();
    await visibleClose(page.locator('#party-cardex-modal-close-btn')); await assertContained(page);
    await page.screenshot({ path: path.join(artifacts, 'clear-cardex-close-mobile.png'), animations: 'disabled' });
    await page.locator('#party-cardex-modal-close-btn').click();
    await navigateSidebar(page, 'ثبت فاکتور خرید');
    await visibleClose(page.getByRole('button', { name: 'بستن فرم فاکتور و بازگشت به فهرست', exact: true }));
    await page.getByRole('button', { name: 'انتخاب تاریخ خرید', exact: true }).click();
    await visibleClose(page.getByRole('dialog').locator('.app-close-button')); await assertContained(page);
    await page.screenshot({ path: path.join(artifacts, 'clear-calendar-close-mobile.png'), animations: 'disabled' });
    await page.getByRole('dialog').locator('.app-close-button').click();
    assert.deepEqual(await snapshot(page), before); assert.deepEqual(errors, []);
    console.log('PASS: header menu/customer search, aliases/digits/phone/code, real navigation/cardex, keyboard/Escape, draft preservation, no header theme button, calm outputs, contrasting non-submitting close controls, mobile containment and unchanged financial data.');
    console.log(`Screenshots: ${artifacts}`);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(artifacts, 'failure.png'), animations: 'disabled', timeout: 10000 }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

/* Native Electron smoke: isolated profile; real production bundle / local service / exports. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { setTimeout: delay } = require('node:timers/promises');
const ExcelJS = require('exceljs');
const { APP_ORIGIN } = require('../desktop/runtime.cjs');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nabavi-native-test-'));
const artifacts = path.join(root, 'out', 'desktop-test-artifacts');
const prefix = 'AFGHAN_ACCOUNTING_DATA_V2_';
fs.mkdirSync(artifacts, { recursive: true });
const errors = [];
let application;

async function launch() {
  application = await electron.launch({
    args: [path.join(root, 'out', 'desktop-app'), ...(process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless'] : [])],
    env: { ...process.env, NABAVI_DESKTOP_TEST_PROFILE: profile, NABAVI_DESKTOP_TEST_DOWNLOAD_DIR: artifacts },
    timeout: 45000,
  });
  await application.evaluate(({ session, app }) => {
    globalThis.__nabaviNativeDownloads = [];
    session.defaultSession.on('will-download', (_event, item) => {
      const record = { name: item.getFilename(), path: item.getSavePath(), state: 'progressing' };
      globalThis.__nabaviNativeDownloads.push(record);
      item.once('done', (_event, state) => { record.state = state; record.path = item.getSavePath(); });
    });
    if (app.isPackaged) throw new Error('Native source smoke must use the unpackaged runtime and its isolated test profile');
  });
  const context = application.context();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== APP_ORIGIN) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return route.continue();
  });
  const page = await application.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#login-password-input').waitFor();
  await page.locator('#login-password-input').fill('123');
  await page.locator('#login-submit-button').click();
  await page.locator('.dash-quick').waitFor();
  return page;
}

async function navigate(page, text, key) {
  await page.locator('#workspace-global-search').fill(text);
  await page.locator('#workspace-global-search').press('Enter');
  await page.waitForFunction(key => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === key, key);
}
async function exportFile(page, kind) {
  // Electron saves through Session's native DownloadItem; Playwright's browser
  // download event is not emitted consistently for these owned native saves.
  const previous = await application.evaluate(() => globalThis.__nabaviNativeDownloads.length);
  await page.locator(`[data-page-actions] .is-${kind}`).click();
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const records = await application.evaluate(() => globalThis.__nabaviNativeDownloads);
    const item = records[previous];
    if (item && item.state !== 'progressing') {
      assert.equal(item.state, 'completed', JSON.stringify(item));
      assert.equal(path.resolve(path.dirname(item.path)).toLowerCase(), path.resolve(artifacts).toLowerCase());
      assert.ok(fs.existsSync(item.path), `Native save handler did not save ${item.name}`);
      return fs.readFileSync(item.path);
    }
    const error = await page.locator('.page-actions-error').allTextContents();
    if (error.some(Boolean)) throw new Error(`Native ${kind} export: ${error.join(' ')}`);
    await delay(150);
  }
  throw new Error(`Native ${kind} save timed out; records: ${JSON.stringify(await application.evaluate(() => globalThis.__nabaviNativeDownloads))}`);
}

(async () => {
  try {
    let page = await launch();
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    const preferences = await application.evaluate(({ BrowserWindow }) => { const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(); return { nodeIntegration: p.nodeIntegration, contextIsolation: p.contextIsolation, sandbox: p.sandbox }; });
    assert.equal(preferences.nodeIntegration, false); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.sandbox, true);
    const anonymous = await fetch(`${APP_ORIGIN}/api/desktop/health`);
    assert.equal(anonymous.status, 403, 'A browser or another local process must not have access to the desktop backend');
    const health = await page.evaluate(() => fetch('/api/desktop/health').then(response => response.json()));
    assert.equal(health.appId, 'af.nabavi.accounting');
    for (const [id, label] of [['trade', 'بازرگانی و مالی'], ['treasury', 'دریافت و پرداخت']]) {
      assert.equal(await page.locator(`#sidebar-group-${id}`).innerText(), label);
      assert.equal(await page.locator(`#sidebar-group-${id} small`).count(), 0);
    }
    await page.evaluate(prefix => {
      const date = new Intl.DateTimeFormat('en-CA-u-ca-persian', { timeZone: 'Asia/Kabul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      localStorage.setItem(prefix + 'company', JSON.stringify({ name: 'شرکت آزمایشی نسخهٔ نصبی', phone: '', address: 'اطلاعات ساختگی' }));
      localStorage.setItem(prefix + 'parties', JSON.stringify([
        { id: 'desktop-party', code: 'D-101', name: 'طرف حساب آزمایشی نصب', type: 'both', phone: '', balanceAFN: -120, balanceUSD: 35, initialBalanceAFN: -120, initialBalanceUSD: 35, createdAt: date },
      ]));
      localStorage.setItem('NABAVI_NATIVE_TEST_SENTINEL', 'preserve-after-restart');
    }, prefix);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.dash-quick').waitFor();
    const before = await page.evaluate(prefix => Object.fromEntries(['parties', 'invoices', 'transactions', 'cash', 'cash_accounts', 'stocks', 'currencies'].map(key => [key, localStorage.getItem(prefix + key)])), prefix);
    await navigate(page, 'تعریف طرف حساب', 'definitions:parties');
    await page.locator('[data-page-actions]').waitFor();
    const xlsx = await exportFile(page, 'excel');
    assert.equal(xlsx.subarray(0, 2).toString(), 'PK');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(xlsx);
    assert.ok(workbook.worksheets[0].views.some(view => view.rightToLeft));
    const cells = []; workbook.worksheets[0].eachRow(row => cells.push(...row.values));
    assert.ok(cells.includes('طرف حساب آزمایشی نصب'));
    const pdf = await exportFile(page, 'pdf');
    assert.ok(pdf.subarray(0, 8).toString().startsWith('%PDF-'));
    assert.ok(pdf.subarray(-80).toString().includes('%%EOF'));
    assert.ok(await page.evaluate(() => [...document.fonts].some(font => font.family === 'ExportVazirmatn' && font.status === 'loaded')));
    assert.deepEqual(await page.evaluate(prefix => Object.fromEntries(['parties', 'invoices', 'transactions', 'cash', 'cash_accounts', 'stocks', 'currencies'].map(key => [key, localStorage.getItem(prefix + key)])), prefix), before, 'Native exports are read-only');
    await navigate(page, 'ثبت فاکتور خرید', 'new_purchase:all');
    await page.locator('#trade-invoice-number').fill('NATIVE-UNSAVED');
    const title = page.locator('#sidebar-group-trade');
    await title.click(); assert.equal(await title.getAttribute('aria-expanded'), 'false');
    await title.click(); assert.equal(await title.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#trade-invoice-number').inputValue(), 'NATIVE-UNSAVED');
    await page.screenshot({ path: path.join(artifacts, 'native-windows-desktop.png'), fullPage: false });
    await application.close(); application = null;
    page = await launch();
    assert.equal(await page.evaluate(() => localStorage.getItem('NABAVI_NATIVE_TEST_SENTINEL')), 'preserve-after-restart');
    assert.deepEqual(await page.evaluate(prefix => Object.fromEntries(['parties', 'invoices', 'transactions', 'cash', 'cash_accounts', 'stocks', 'currencies'].map(key => [key, localStorage.getItem(prefix + key)])), prefix), before);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: native Electron production UI, isolated persistent profile/restart, sandbox + no Node in renderer, private loopback API, compact sidebar/title toggles/draft, real native-saved Persian PDF and numeric RTL XLSX, unchanged finance.');
  } finally {
    if (application) await application.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

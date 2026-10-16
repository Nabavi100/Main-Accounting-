const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  launch,
  pageFor,
  login,
  readData,
  storagePrefix: prefix,
  baseURL,
  navigateSidebar,
} = require('./browser-support.cjs');
const screenshots =
  process.env.COMPANY_CASH_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), 'accounting-company-cash-smoke');
fs.mkdirSync(screenshots, { recursive: true });
const fixtures = {
  cash_accounts: [
    {
      id: 'afn_cash',
      name: 'صندوق افغانی نمونه',
      currency: 'AFN',
      balance: 100,
      initialBalance: 100,
    },
    {
      id: 'usd_cash',
      name: 'صندوق دالری نمونه',
      currency: 'USD',
      balance: 200,
      initialBalance: 200,
    },
    {
      id: 'test-bank',
      name: 'بانک نمونه',
      currency: 'USD',
      balance: 20,
      initialBalance: 20,
    },
  ],
  cash: {
    afnBalance: 100,
    usdBalance: 200,
    exchangeUsdBalance: 0,
    usdToAfnRate: 65,
  },
  parties: [
    {
      id: 'customer',
      name: 'شخص نمونه',
      type: 'customer',
      phone: '',
      balanceUSD: -50,
      balanceAFN: -200,
      createdAt: '2026-10-15',
    },
  ],
  transactions: [],
  incomes: [],
  expenses: [],
  invoices: [],
  transfers: [],
  consignment_movements: [],
};
const seed = (page, values) =>
  page.evaluate(
    ({ prefix, values }) => {
      for (const [key, value] of Object.entries(values))
        localStorage.setItem(prefix + key, JSON.stringify(value));
    },
    { prefix, values },
  );
const tab = (page, name) =>
  navigateSidebar(page, name);
const waitBalances = (page, afn, usd = 200, bank = 20) =>
  page.waitForFunction(
    ({ prefix, afn, usd, bank }) => {
      const accounts = JSON.parse(
          localStorage.getItem(prefix + 'cash_accounts') || '[]',
        ),
        cash = JSON.parse(localStorage.getItem(prefix + 'cash') || '{}');
      return (
        accounts.find((row) => row.id === 'afn_cash')?.balance === afn &&
        accounts.find((row) => row.id === 'usd_cash')?.balance === usd &&
        accounts.find((row) => row.id === 'test-bank')?.balance === bank &&
        cash.afnBalance === afn &&
        cash.usdBalance === usd
      );
    },
    { prefix, afn, usd, bank },
  );
const deleteRow = async (page, number) => {
  await page
    .getByRole('button', { name: `حذف سند #${number}`, exact: true })
    .click();
  await page
    .getByRole('button', { name: 'تأیید حذف سند', exact: true })
    .click();
};
const editRow = async (page, number, value, cash) => {
  await page
    .getByRole('button', { name: `ویرایش سند #${number}`, exact: true })
    .click();
  assert.equal(
    await page.locator('.workspace-dialog #treasury-party').count(),
    0,
    'source documents must not open a generic party transaction form',
  );
  await page.getByLabel('مبلغ سند اصلی', { exact: true }).fill(value);
  if (cash)
    await page.getByLabel('صندوق سند اصلی', { exact: true }).selectOption(cash);
  await page
    .getByRole('button', { name: 'ذخیرهٔ اصلاحات سند و صندوق', exact: true })
    .click();
};
const openDesk = async (page, kind) => {
  await tab(
    page,
    kind === 'income' ? 'ثبت دریافت (ورودی)' : 'ثبت پرداخت (خروجی)',
  );
  await page.locator('#treasury-mode').selectOption(kind);
  await page
    .locator(`#${kind}-title`)
    .fill(kind === 'income' ? 'عاید خدمات آزمایشی' : 'کرایهٔ آزمایشی');
};
const submitDesk = (page, kind) =>
  page
    .locator(`[data-company-cash-desk="${kind}"] form button[type="submit"]`)
    .click();
const assertPartyUntouched = async (page) =>
  assert.deepEqual(await readData(page, 'parties'), fixtures.parties);
async function uiSmoke() {
  const browser = await launch(),
    errors = [];
  try {
    const page = await pageFor(browser, errors);
    page.on('dialog', (dialog) => dialog.accept());
    await login(page);
    await seed(page, fixtures);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#dashboard-btn-new-payment').click();
    await page.locator('#treasury-mode').selectOption('income');
    await page.locator('#income-title').fill('عاید خدمات آزمایشی');
    await page.locator('#income-number').fill('INC-101');
    await page.locator('#income-amount').fill('25.123456');
    await page.locator('#income-receipt-desk-date').click();
    await page.keyboard.press('Escape');
    assert.equal((await readData(page, 'incomes')).length, 0);
    assert.equal((await readData(page, 'transactions')).length, 0);
    await submitDesk(page, 'income');
    await waitBalances(page, 125.123456);
    assert.equal((await readData(page, 'incomes'))[0].incomeNumber, 'INC-101');
    assert.equal((await readData(page, 'transactions')).length, 1);
    assert.equal(await page.locator('.treasury-table tbody tr').count(), 1);
    await page.getByRole('button', { name: 'عواید شرکت', exact: true }).click();
    assert.equal(await page.locator('.treasury-table tbody tr').count(), 1);
    await editRow(page, 'INC-101', '50.654321');
    await waitBalances(page, 150.654321);
    assert.equal((await readData(page, 'incomes'))[0].amount, 50.654321);
    await editRow(page, 'INC-101', '3.123456', 'test-bank');
    await waitBalances(page, 100, 200, 23.123456);
    assert.equal((await readData(page, 'incomes'))[0].currency, 'USD');
    await page
      .getByRole('button', { name: 'چاپ سند #INC-101', exact: true })
      .click();
    await page.locator('#printable-paper-canvas').waitFor();
    assert.match(
      await page.locator('#printable-paper-canvas').innerText(),
      /عاید خدمات آزمایشی/,
    );
    assert.match(
      await page.locator('#printable-paper-canvas').innerText(),
      /شرکت تجارتی برادران نبوی/,
    );
    await page.keyboard.press('Escape');
    await page.screenshot({
      path: path.join(screenshots, 'income-list.png'),
      fullPage: true,
    });
    await deleteRow(page, 'INC-101');
    await waitBalances(page, 100);
    assert.equal((await readData(page, 'incomes')).length, 0);
    assert.equal((await readData(page, 'transactions')).length, 0);

    await openDesk(page, 'expense');
    await page.locator('#expense-number').fill('EXP-201');
    await page.locator('#expense-amount').fill('200.123456');
    await submitDesk(page, 'expense');
    await waitBalances(page, -100.123456);
    assert.equal((await readData(page, 'expenses')).length, 1);
    assert.equal((await readData(page, 'transactions'))[0].type, 'expense');
    await page
      .getByRole('button', { name: 'هزینه‌های شرکت', exact: true })
      .click();
    assert.match(
      await page.locator('.treasury-table').innerText(),
      /کرایهٔ آزمایشی/,
    );
    await editRow(page, 'EXP-201', '150.654321');
    await waitBalances(page, -50.654321);
    await page
      .getByRole('button', { name: 'چاپ سند #EXP-201', exact: true })
      .click();
    await page.locator('#printable-paper-canvas').waitFor();
    assert.match(
      await page.locator('#printable-paper-canvas').innerText(),
      /کرایهٔ آزمایشی/,
    );
    await page.keyboard.press('Escape');
    await page.screenshot({
      path: path.join(screenshots, 'expense-list.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole('button', { name: 'ویرایش سند #EXP-201', exact: true })
      .click();
    assert.equal(
      await page
        .locator('[data-company-cash-edit="expense"]')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
    );
    await page.screenshot({
      path: path.join(screenshots, 'expense-edit-mobile.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'بستن پنجره', exact: true }).click();
    await page.setViewportSize({ width: 1908, height: 980 });
    await deleteRow(page, 'EXP-201');
    await waitBalances(page, 100);
    assert.equal((await readData(page, 'expenses')).length, 0);

    await openDesk(page, 'income');
    await page.locator('#income-number').fill('INC-102');
    await page.locator('#income-amount').fill('1');
    await page.locator('#income-cash-account').selectOption('usd_cash');
    // Currency selection is smart by default; enable intentional cross-currency settlement first.
    await page.locator('[data-company-cash-desk=income] input[type=checkbox]').check();
    await page.locator('#income-currency').selectOption('AFN');
    await page
      .locator('#income-rate')
      .waitFor({ timeout: 5000 })
      .catch(async (error) => {
        console.error(
          'FX state:',
          await page.locator('[data-company-cash-desk=income]').innerText(),
          await page.locator('#income-cash-account').inputValue(),
          await page.locator('#income-currency').inputValue(),
        );
        await page.screenshot({
          path: path.join(screenshots, 'fx-failure.png'),
          fullPage: true,
        });
        throw error;
      });
    await page.locator('#income-rate').fill('0');
    await submitDesk(page, 'income');
    assert.equal((await readData(page, 'incomes')).length, 0);
    await waitBalances(page, 100);
    await page.locator('#income-rate').fill('65');
    await page
      .locator('[data-company-cash-desk="income"] input[type="checkbox"]')
      .uncheck();
    await submitDesk(page, 'income');
    assert.equal((await readData(page, 'incomes')).length, 0);
    await page
      .locator('[data-company-cash-desk="income"] input[type="checkbox"]')
      .check();
    await page.locator('#income-currency').selectOption('EUR');
    await submitDesk(page, 'income');
    assert.equal((await readData(page, 'incomes')).length, 0);
    await page.locator('#income-currency').selectOption('AFN');
    await submitDesk(page, 'income');
    await waitBalances(page, 100, 200.015385);
    assert.equal((await readData(page, 'incomes'))[0].amount, 0.015385);
    await page.reload({ waitUntil: 'networkidle' });
    await waitBalances(page, 100, 200.015385);
    await tab(page, 'لیست دریافت‌ها');
    await deleteRow(page, 'INC-102');
    await waitBalances(page, 100);
    await assertPartyUntouched(page);
    assert.deepEqual(await readData(page, 'invoices'), []);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: actual income/expense desks post cash once, source-specific lists/filter/edit/delete/printing, negative funds, precision, invalid FX guards, reload and mobile.',
    );
  } finally {
    await browser.close();
  }
}
async function legacySmoke() {
  const browser = await launch(),
    errors = [];
  try {
    const page = await pageFor(browser, errors);
    await login(page);
    const income = {
      id: 'old-income',
      incomeNumber: 'INC-001',
      title: 'عاید قدیمی نمونه',
      categoryId: '',
      amount: 120,
      currency: 'AFN',
      date: '1405/07/22',
      createdAt: '2026-10-14T08:00:00Z',
    };
    const expense = {
      id: 'old-expense',
      expenseNumber: 'EXP-001',
      title: 'هزینهٔ قدیمی نمونه',
      categoryId: '',
      amount: 20,
      currency: 'AFN',
      date: '1405/07/22',
      createdAt: income.createdAt,
    };
    const oldTx = {
      id: 'tx-inc-old-income',
      transactionNumber: 'TRX-INC-INC-001',
      type: 'receive_payment',
      amount: 120,
      currency: 'AFN',
      date: income.date,
      description: 'عاید قدیمی',
      cashRegister: 'afn_cash',
      createdAt: income.createdAt,
    };
    await seed(page, {
      ...fixtures,
      incomes: [income],
      expenses: [expense],
      transactions: [
        { ...oldTx, id: 'linked-duplicate-id', incomeId: income.id },
        oldTx,
      ],
      cash_accounts: fixtures.cash_accounts.map((account) =>
        account.id === 'afn_cash'
          ? { ...account, initialBalance: 400, balance: 500 }
          : account,
      ),
      cash: { ...fixtures.cash, afnBalance: 500 },
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#dashboard-btn-new-payment').click().catch(async error => {
      console.error('Legacy reload diagnostics:', await page.locator('body').innerText());
      await page.screenshot({ path: path.join(screenshots, 'legacy-reload-failure.png'), animations: 'disabled' });
      throw error;
    });
    await tab(page, 'لیست دریافت‌ها');
    assert.equal(await page.locator('.treasury-table tbody tr').count(), 1);
    await waitBalances(page, 500);
    assert.equal(
      (await readData(page, 'transactions')).length,
      2,
      'projection must not rewrite saved history',
    );
    await editRow(page, 'INC-001', '130');
    await waitBalances(page, 510);
    assert.equal(
      (await readData(page, 'transactions')).length,
      1,
      'editing removes duplicate linked display mirrors',
    );
    assert.equal(
      (await readData(page, 'transactions'))[0].id,
      'linked-duplicate-id',
    );
    await tab(page, 'لیست پرداخت‌ها');
    assert.match(
      await page.locator('.treasury-table').innerText(),
      /هزینهٔ قدیمی نمونه/,
    );
    await waitBalances(page, 510);
    await editRow(page, 'EXP-001', '25');
    await waitBalances(page, 505);
    assert.equal(
      (await readData(page, 'transactions')).length,
      2,
      'editing recreates missing expense mirror without a second debit',
    );
    await deleteRow(page, 'EXP-001');
    await waitBalances(page, 530);
    await tab(page, 'لیست دریافت‌ها');
    await deleteRow(page, 'INC-001');
    await waitBalances(page, 400);
    assert.equal((await readData(page, 'transactions')).length, 0);
    await assertPartyUntouched(page);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: historical source-only expenses and duplicate/unlinked legacy income mirrors appear once; viewing never replays cash, editing repairs mirrors and deleting reverses source exactly.',
    );
  } finally {
    await browser.close();
  }
}
async function contextSmoke() {
  const browser = await launch(),
    errors = [];
  try {
    const page = await pageFor(browser, errors);
    const html = await (await fetch(baseURL + '/dashboard')).text(),
      provider = await (
        await fetch(baseURL + '/src/context/AccountingContext.tsx')
      ).text(),
      entry = await (await fetch(baseURL + '/src/main.tsx')).text();
    const reactURL = provider.match(
        /from\s+["']([^"']*\/react\.js[^"']*)["']/,
      )[1],
      domURL = entry.match(
        /from\s+["']([^"']*react-dom_client\.js[^"']*)["']/,
      )[1];
    const script = `import React from '${reactURL}';import Dom from '${domURL}';import{AccountingProvider,useAccounting}from'/src/context/AccountingContext.tsx';function Probe(){const ctx=useAccounting();window.__companyCash=ctx;return React.createElement('p',null,'ISOLATED COMPANY CASH TEST');}Dom.createRoot(document.getElementById('root')).render(React.createElement(AccountingProvider,null,React.createElement(Probe)));`;
    const testHTML = html.replace(
      /<script\b[^>]*src="\/src\/main\.tsx[^"]*"[^>]*>\s*<\/script>/,
      `<script type="module">${script}</script>`,
    );
    assert.notEqual(testHTML, html);
    await page.route('**/company-cash-context-check', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: testHTML }),
    );
    await page.addInitScript(
      ({ prefix, values }) => {
        for (const [key, value] of Object.entries(values))
          localStorage.setItem(prefix + key, JSON.stringify(value));
      },
      {
        prefix,
        values: {
          ...fixtures,
          cash_accounts: fixtures.cash_accounts.map((account) =>
            account.id === 'afn_cash'
              ? { ...account, balance: 0, initialBalance: 0 }
              : account,
          ),
          cash: { ...fixtures.cash, afnBalance: 0 },
        },
      },
    );
    await page.goto(baseURL + '/company-cash-context-check', {
      waitUntil: 'networkidle',
    });
    await page.waitForFunction(() => window.__companyCash);
    const data = {
      title: 'سند آزمایشی',
      categoryId: '',
      date: '1405/07/23',
      amount: 100.123456,
      currency: 'AFN',
      cashRegisterId: 'afn_cash',
    };
    const income = await page.evaluate(
      (data) => window.__companyCash.createIncome(data),
      data,
    );
    await waitBalances(page, 100.123456);
    const expense = await page.evaluate(
      (data) =>
        window.__companyCash.createExpense({ ...data, amount: 150.654321 }),
      data,
    );
    await waitBalances(page, -50.530865);
    assert.equal((await readData(page, 'transactions')).length, 2);
    await page.evaluate(
      (id) => window.__companyCash.updateIncome(id, { amount: 50.654321 }),
      income.id,
    );
    await waitBalances(page, -100);
    await page.evaluate(
      (id) => window.__companyCash.deleteExpense(id),
      expense.id,
    );
    await waitBalances(page, 50.654321);
    await page.evaluate(
      (id) =>
        window.__companyCash.updateIncome(id, {
          amount: 7.333333,
          currency: 'USD',
          cashRegisterId: 'test-bank',
        }),
      income.id,
    );
    await waitBalances(page, 0, 200, 27.333333);
    await page.evaluate((id) => {
      const ctx = window.__companyCash,
        tx = ctx.transactions.find((tx) => tx.incomeId === id);
      ctx.updateTransaction({ ...tx, amount: 8.123456 });
    }, income.id);
    await waitBalances(page, 0, 200, 28.123456);
    assert.equal((await readData(page, 'incomes'))[0].amount, 8.123456);
    const duplicateRejected = await page.evaluate((id) => {
      const ctx = window.__companyCash,
        tx = ctx.transactions.find((tx) => tx.incomeId === id);
      try {
        ctx.createTransaction(tx);
        return false;
      } catch {
        return true;
      }
    }, income.id);
    assert.equal(duplicateRejected, true);
    await page.evaluate((id) => {
      const ctx = window.__companyCash;
      ctx.deleteTransaction(
        ctx.transactions.find((tx) => tx.incomeId === id).id,
      );
    }, income.id);
    await waitBalances(page, 0);
    assert.equal((await readData(page, 'incomes')).length, 0);
    for (const invalid of [
      { amount: null },
      { amount: -1 },
      { cashRegisterId: 'missing' },
      { currency: 'USD', cashRegisterId: 'afn_cash' },
      { date: '1405/13/44' },
    ]) {
      const rejected = await page.evaluate(
        ({ data, invalid }) => {
          try {
            window.__companyCash.createExpense({
              ...data,
              ...invalid,
              amount:
                invalid.amount === null ? NaN : (invalid.amount ?? data.amount),
            });
            return false;
          } catch {
            return true;
          }
        },
        { data, invalid },
      );
      assert.equal(rejected, true);
    }
    await waitBalances(page, 0);
    assert.equal((await readData(page, 'expenses')).length, 0);
    const batch = await page.evaluate((data) => {
      const ctx = window.__companyCash;
      const first = ctx.createIncome(data),
        second = ctx.createIncome(data);
      return [first, second];
    }, data);
    assert.notEqual(batch[0].id, batch[1].id);
    assert.notEqual(batch[0].incomeNumber, batch[1].incomeNumber);
    await waitBalances(page, 200.246912);
    const duplicateSource = await page.evaluate(
      ({ data, number }) => {
        try {
          window.__companyCash.createIncome({ ...data, incomeNumber: number });
          return false;
        } catch {
          return true;
        }
      },
      { data, number: batch[0].incomeNumber },
    );
    assert.equal(duplicateSource, true);
    await page.evaluate(
      (ids) => {
        const ctx = window.__companyCash;
        for (const id of ids) {
          ctx.deleteIncome(id);
          ctx.deleteIncome(id);
        }
      },
      batch.map((row) => row.id),
    );
    await waitBalances(page, 0);
    const spent = await page.evaluate((data) => {
      const ctx = window.__companyCash,
        income = ctx.createIncome({ ...data, amount: 10 }),
        expense = ctx.createExpense({ ...data, amount: 20 });
      return { income: income.id, expense: expense.id };
    }, data);
    await waitBalances(page, -10);
    await page.evaluate(
      (id) => window.__companyCash.deleteIncome(id),
      spent.income,
    );
    await waitBalances(page, -20);
    await page.evaluate(
      (id) => window.__companyCash.deleteExpense(id),
      spent.expense,
    );
    await waitBalances(page, 0);
    const sameTick = await page.evaluate((data) => {
      const ctx = window.__companyCash,
        doc = ctx.createExpense(data);
      ctx.updateExpense(doc.id, { amount: 21 });
      ctx.updateExpense(doc.id, { amount: 22 });
      ctx.deleteExpense(doc.id);
      return doc.id;
    }, data);
    await waitBalances(page, 0);
    assert.equal(
      (await readData(page, 'expenses')).some((row) => row.id === sameTick),
      false,
    );
    assert.equal((await readData(page, 'transactions')).length, 0);
    await assertPartyUntouched(page);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: real Context income/expense signed CRUD, bank/currency moves, generic mirror routing, duplicate/no-double-post guards, validation, batched unique numbers/edits/deletes and exact negative-funds reversals.',
    );
  } finally {
    await browser.close();
  }
}
(async () => {
  const check = process.env.COMPANY_CASH_CHECK || 'all';
  if (check === 'all' || check === 'ui') await uiSmoke();
  if (check === 'all' || check === 'legacy') await legacySmoke();
  if (check === 'all' || check === 'context') await contextSmoke();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/* Optional integration test. Uses a new browser context, synthetic fixtures and blocked external requests.
 * Run with the dev server active. Playwright / Chromium are test-only, not app dependencies.
 */
const { launch, navigateSidebar } = require("./browser-support.cjs");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const baseURL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const allowedOrigin = new URL(baseURL).origin;
const shots =
  process.env.TRADE_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), "accounting-trade-smoke");
fs.mkdirSync(shots, { recursive: true });
const prefix = "AFGHAN_ACCOUNTING_DATA_V2_";

const parties = [
  {
    id: "test-supplier",
    code: "101",
    name: "تأمین‌کننده آزمایشی",
    phone: "0700000101",
    type: "supplier",
    balanceAFN: 0,
    balanceUSD: 0,
    createdAt: "2026-10-15T00:00:00Z",
  },
  {
    id: "test-customer",
    code: "102",
    name: "مشتری آزمایشی",
    phone: "0700000102",
    type: "customer",
    balanceAFN: 0,
    balanceUSD: 0,
    createdAt: "2026-10-15T00:00:00Z",
  },
  {
    id: "test-driver",
    code: "103",
    name: "راننده آزمایشی",
    phone: "0700000103",
    type: "both",
    balanceAFN: 0,
    balanceUSD: 0,
    createdAt: "2026-10-15T00:00:00Z",
  },
];
const products = [
  {
    id: "test-product",
    name: "کالای نمونه الف",
    code: "201",
    category: "آزمایش",
    baseUnit: "تن (1000KG)",
    bagWeightKg: 50,
    bagsPerTon: 20,
    buyPriceUSD: 25,
    sellPriceUSD: 35,
    buyPriceAFN: 1625,
    sellPriceAFN: 2275,
    minStockTons: 1,
  },
  {
    id: "test-product-zero",
    name: "کالای نمونه بدون موجودی",
    code: "202",
    category: "آزمایش",
    baseUnit: "تن (1000KG)",
    bagWeightKg: 50,
    bagsPerTon: 20,
    buyPriceUSD: 10,
    sellPriceUSD: 15,
    buyPriceAFN: 650,
    sellPriceAFN: 975,
    minStockTons: 1,
  },
];
const fixtures = {
  parties,
  products,
  invoices: [],
  transactions: [],
  transfers: [],
  consignment_movements: [],
  stocks: [
    {
      warehouseId: "wh-1",
      productId: "test-product",
      quantityTons: 5,
      quantityBags: 100,
    },
    {
      warehouseId: "wh-1",
      productId: "test-product-zero",
      quantityTons: 0,
      quantityBags: 0,
    },
  ],
  cash: {
    afnBalance: 10000,
    usdBalance: 1000,
    exchangeUsdBalance: 0,
    usdToAfnRate: 65,
  },
  cash_accounts: [
    {
      id: "usd_cash",
      name: "صندوق دالری آزمایشی",
      currency: "USD",
      balance: 1000,
      initialBalance: 1000,
      type: "cash",
      isDefault: true,
      createdAt: "2026-10-15",
    },
    {
      id: "afn_cash",
      name: "صندوق افغانی آزمایشی",
      currency: "AFN",
      balance: 10000,
      initialBalance: 10000,
      type: "cash",
      isDefault: true,
      createdAt: "2026-10-15",
    },
  ],
};

async function isolatedPage(browser, errors) {
  const context = await browser.newContext({
    viewport: { width: 1908, height: 891 },
    locale: "fa-AF",
    timezoneId: "Asia/Kabul",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error("Browser runtime:", error.message);
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== allowedOrigin)
      return route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      });
    if (url.pathname.startsWith("/api/telegram/"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          isConfigured: false,
          isPolling: false,
          pendingUsers: [],
          pendingCount: 0,
          botToken: "",
        }),
      });
    return route.continue();
  });
  await page.addInitScript(() => {
    window.print = () => {
      window.__printCalls = (window.__printCalls || 0) + 1;
    };
  });
  return page;
}
async function seed(page, data) {
  await page.evaluate(
    ({ data, prefix }) => {
      for (const [key, value] of Object.entries(data))
        localStorage.setItem(prefix + key, JSON.stringify(value));
    },
    { data, prefix },
  );
}
async function state(page) {
  return page.evaluate(
    (prefix) =>
      Object.fromEntries(
        [
          "invoices",
          "parties",
          "stocks",
          "transactions",
          "cash",
          "cash_accounts",
        ].map((key) => [
          key,
          JSON.parse(localStorage.getItem(prefix + key) || "null"),
        ]),
      ),
    prefix,
  );
}
async function choose(page, selector, text) {
  await page.locator(selector).fill(text);
  await page.keyboard.press("Enter");
}
async function waitCount(page, count) {
  await page.waitForFunction(
    ({ prefix, count }) =>
      JSON.parse(localStorage.getItem(prefix + "invoices") || "[]").length ===
      count,
    { prefix, count },
  );
}
async function dismissToasts(page) {
  await page.evaluate(() =>
    document
      .querySelectorAll('[id^="toast-"] button')
      .forEach((button) => button.click()),
  );
}

async function uiSmoke(browser, errors) {
  const page = await isolatedPage(browser, errors);
  await page.goto(baseURL + "/dashboard", { waitUntil: "networkidle" });
  await page.locator("#login-password-input").fill("123");
  await page.locator("#login-submit-button").click();
  await page.locator(".dash-quick").waitFor();
  await seed(page, fixtures);
  await page.reload({ waitUntil: "networkidle" });
  await dismissToasts(page);
  await page.locator("#dashboard-btn-new-purchase").click();
  assert.equal(await page.getByRole("tab").count(), 0);
  // Lists moved into the shared invoice center; four direct create shortcuts remain in the sidebar.
  assert.equal(await page.locator("#workspace-menu-trade > button").count(), 4);
  assert.equal(await page.locator("#trade-invoice-center .trade-center-primary > button").count(), 6);
  assert.equal(await page.locator("#trade-invoice-center .trade-center-related > button").count(), 2);
  assert.equal(await page.locator("#trade-invoice-number").inputValue(), "1");
  assert.equal(await page.locator("#trade-exchange-rate").inputValue(), "65");
  await choose(page, "#trade-party", "101");
  await choose(page, '[aria-label="کالای ردیف 1"]', "201");
  await page.getByLabel("تعداد ردیف 1", { exact: true }).fill("2");
  await page.locator("#trade-discount").fill("5");
  await page
    .getByRole("button", { name: "افزودن هزینه جدید", exact: true })
    .click();
  await choose(page, '[aria-label="طرف حساب هزینه 1"]', "103");
  await page.getByLabel("شرح هزینه 1", { exact: true }).fill("کرایه آزمایشی");
  await page.getByLabel("ارز هزینه 1", { exact: true }).selectOption("AFN");
  await page.getByLabel("مبلغ هزینه 1", { exact: true }).fill("650");
  assert.equal(await page.locator("#trade-expenses-total").inputValue(), "10");
  assert.equal(await page.locator("#trade-final-total").inputValue(), "55");
  await page.locator("#trade-payment-type").selectOption("نیمه نسیه");
  await page.locator("#trade-paid-amount").fill("20");
  await page.locator("#trade-cash-account").selectOption("usd_cash");
  // Opening/closing the calendar must likewise leave a complete invoice draft unposted.
  await page
    .getByRole("button", { name: "انتخاب تاریخ خرید", exact: true })
    .click();
  await page.getByRole("dialog").locator("button:has(svg.lucide-x)").click();
  assert.equal((await state(page)).invoices.length, 0);
  // A quick-party modal must not submit the surrounding invoice draft.
  await page
    .getByRole("button", { name: "افزودن طرف حساب جدید", exact: true })
    .click();
  await page
    .getByPlaceholder("مثلاً حاجی نعیم الله غزنوی")
    .fill("طرف حساب تازهٔ آزمایشی");
  await page
    .getByRole("button", { name: "ثبت و انتخاب طرف حساب", exact: true })
    .click();
  await page.waitForFunction(
    (prefix) =>
      JSON.parse(localStorage.getItem(prefix + "parties") || "[]").length === 4,
    prefix,
  );
  assert.equal((await state(page)).invoices.length, 0);
  assert.equal(
    await page.locator("#trade-party").inputValue(),
    "طرف حساب تازهٔ آزمایشی",
  );
  await choose(page, "#trade-party", "101");
  await page.locator(".trade-save-button").click();
  await waitCount(page, 1);
  await page.locator(".trade-invoice-list").waitFor();
  let data = await state(page);
  const id = data.invoices[0].id;
  assert.equal(data.invoices[0].totalAmount, 55);
  assert.equal(data.invoices[0].balanceAmount, 35);
  assert.equal(data.invoices[0].extraExpenses[0].amount, 650);
  assert.equal(data.invoices[0].extraExpenses[0].amountInInvoiceCurrency, 10);
  assert.equal(
    data.parties.find((p) => p.id === "test-supplier").balanceUSD,
    35,
  );
  assert.equal(data.cash.usdBalance, 980);
  assert.equal(
    data.stocks.find((s) => s.productId === "test-product").quantityTons,
    7,
  );
  assert.equal(data.transactions.filter((t) => t.invoiceId === id).length, 1);
  const originalPaymentNumber = data.transactions.find(
    (t) => t.invoiceId === id,
  ).transactionNumber;

  // A duplicate or a typed-but-unselected party cannot alter the saved invoice.
  await navigateSidebar(page, "ثبت فاکتور خرید");
  await choose(page, "#trade-party", "101");
  await choose(page, '[aria-label="کالای ردیف 1"]', "201");
  await page.locator("#trade-invoice-number").fill("1");
  await page.locator("#trade-payment-type").selectOption("نسیه");
  await page.locator("#trade-party").fill("شخص انتخاب‌نشده");
  await page.locator(".trade-save-button").click();
  assert.match(await page.getByRole("alert").innerText(), /طرف حساب/);
  await choose(page, "#trade-party", "101");
  await page.locator(".trade-save-button").click();
  assert.match(await page.getByRole("alert").innerText(), /تکراری/);
  assert.deepEqual((await state(page)).invoices, data.invoices);

  await navigateSidebar(page, "لیست خریدها");
  await page.locator("#trade-invoice-search").fill("#۱");
  assert.equal(await page.locator(".trade-list-table tbody tr").count(), 1);
  await page.locator("#trade-invoice-search").fill("پیدا نمی‌شود");
  assert.equal(await page.locator(".trade-list-table tbody tr").count(), 0);
  await page.getByRole("button", { name: "پاک کردن جستجوی فاکتور" }).click();
  await page
    .locator(".trade-party-card")
    .filter({ hasText: "تأمین‌کننده آزمایشی" })
    .click();
  assert.equal(await page.locator(".trade-list-table tbody tr").count(), 1);
  await page
    .getByRole("button", { name: "همه تأمین‌کنندگان", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ویرایش فاکتور #1", exact: true })
    .click();
  assert.equal(await page.locator("#trade-expenses-total").inputValue(), "10");
  await page.getByLabel("تعداد ردیف 1", { exact: true }).fill("3");
  await page.locator(".trade-save-print-button").click();
  await page.locator("#document-print-modal-container").waitFor();
  await page.locator("#doc-print-execute-btn").click();
  await page.waitForFunction(() => window.__printCalls === 1);
  await page.locator("#document-print-modal-close-btn").click();
  data = await state(page);
  assert.equal(data.invoices.length, 1);
  assert.equal(data.invoices[0].id, id);
  assert.equal(data.invoices[0].totalAmount, 80);
  assert.equal(data.invoices[0].balanceAmount, 60);
  assert.equal(
    data.parties.find((p) => p.id === "test-supplier").balanceUSD,
    60,
  );
  assert.equal(
    data.stocks.find((s) => s.productId === "test-product").quantityTons,
    8,
  );
  assert.equal(data.cash.usdBalance, 980);
  assert.equal(data.transactions.filter((t) => t.invoiceId === id).length, 1);
  assert.equal(
    data.transactions.find((t) => t.invoiceId === id).transactionNumber,
    originalPaymentNumber,
  );
  await page
    .getByRole("button", { name: "حذف فاکتور #1", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "انصراف", exact: true })
    .click();
  assert.equal((await state(page)).invoices.length, 1);
  await page
    .getByRole("button", { name: "حذف فاکتور #1", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "حذف فاکتور", exact: true })
    .click();
  await waitCount(page, 0);
  data = await state(page);
  assert.equal(data.cash.usdBalance, 1000);
  assert.equal(
    data.parties.find((p) => p.id === "test-supplier").balanceUSD,
    0,
  );
  assert.equal(
    data.stocks.find((s) => s.productId === "test-product").quantityTons,
    5,
  );
  assert.equal(data.transactions.length, 0);

  // Bag prices remain fractional; switching currency converts every monetary input.
  await navigateSidebar(page, "ثبت فاکتور فروش");
  await choose(page, "#trade-party", "102");
  await choose(page, '[aria-label="کالای ردیف 1"]', "201");
  await page.getByLabel("واحد ردیف 1", { exact: true }).selectOption("bag");
  assert.equal(
    await page.getByLabel("قیمت ردیف 1", { exact: true }).inputValue(),
    "1.75",
  );
  assert.equal(
    await page.getByLabel("موجودی ردیف 1", { exact: true }).innerText(),
    "100.000000",
  );
  await page.getByLabel("تعداد ردیف 1", { exact: true }).fill("3");
  await page.locator("#trade-discount").fill("0.25");
  await page.locator("#trade-shipping").fill("5");
  await page.locator("#trade-currency").selectOption("AFN");
  assert.equal(
    await page.getByLabel("قیمت ردیف 1", { exact: true }).inputValue(),
    "113.75",
  );
  assert.equal(await page.locator("#trade-discount").inputValue(), "16.25");
  assert.equal(await page.locator("#trade-shipping").inputValue(), "325");
  assert.equal(await page.locator("#trade-cash-account").inputValue(), "afn_cash");
  await page.locator("#trade-cash-account").selectOption("afn_cash");
  await page.locator(".trade-save-print-button").click();
  await waitCount(page, 1);
  await page.locator("#document-print-modal-close-btn").click();
  data = await state(page);
  assert.equal(data.invoices[0].totalAmount, 650);
  assert.equal(data.invoices[0].currency, "AFN");
  assert.equal(data.invoices[0].items[0].tonsCount, 0.15);
  assert.equal(data.cash.afnBalance, 10650);
  assert.equal(
    data.stocks.find((s) => s.productId === "test-product").quantityBags,
    97,
  );
  assert.equal(
    data.parties.find((p) => p.id === "test-customer").balanceAFN,
    0,
  );
  await page
    .getByRole("button", { name: "چاپ فاکتور #1", exact: true })
    .click();
  await page.locator("#document-print-modal-close-btn").click();
  assert.equal((await state(page)).invoices.length, 1);
  await page
    .getByRole("button", { name: "ویرایش فاکتور #1", exact: true })
    .click();
  await page.getByLabel("تعداد ردیف 1", { exact: true }).fill("4");
  await page.locator(".trade-save-button").click();
  await page.locator(".trade-invoice-list").waitFor();
  data = await state(page);
  assert.equal(data.invoices[0].totalAmount, 763.75);
  assert.equal(data.cash.afnBalance, 10763.75);
  await page
    .getByRole("button", { name: "حذف فاکتور #1", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "حذف فاکتور", exact: true })
    .click();
  await waitCount(page, 0);
  data = await state(page);
  assert.equal(data.cash.afnBalance, 10000);
  assert.equal(data.transactions.length, 0);
  assert.equal(
    data.stocks.find((s) => s.productId === "test-product").quantityBags,
    100,
  );

  // Sidebar keyboard activation and mobile horizontal containment / portalled lookup bounds.
  await page.locator("#sidebar-page-sale-create").focus();
  await page.keyboard.press("Enter");
  await page.locator(".trade-invoice-form.is-sell").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await choose(page, "#trade-party", "102");
  const width = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    main: document.querySelector("main").scrollWidth,
    client: document.querySelector("main").clientWidth,
  }));
  assert.equal(width.document, width.width);
  assert.equal(width.main, width.client);
  await page.locator('[aria-label="کالای ردیف 1"]').fill("کالای");
  const popup = await page.locator(".trade-lookup-popup").boundingBox();
  assert.ok(popup.x >= 0 && popup.x + popup.width <= 390);
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: path.join(shots, "sale-mobile.png"),
    animations: "disabled",
    timeout: 60000,
  });
  await navigateSidebar(page, "لیست فروشات");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.screenshot({
    path: path.join(shots, "sale-list-mobile.png"),
    animations: "disabled",
    timeout: 60000,
  });
  await page.context().close();
  console.log(
    "PASS: four views, calendar and quick party add without unintended posting, typed-ID safety, duplicate guard, mixed expenses, CRUD, linked cash/stock/party balances, print, currency conversion, keyboard, mobile",
  );
}

async function edgeSmoke(browser, errors) {
  const page = await isolatedPage(browser, errors);
  await page.goto(baseURL + "/dashboard", { waitUntil: "networkidle" });
  await page.locator("#login-password-input").fill("123");
  await page.locator("#login-submit-button").click();
  await page.locator(".dash-quick").waitFor();
  const legacy = {
    createdAt: "2026-10-15T00:00:00Z",
    partyName: "تأمین‌کننده آزمایشی",
    partyPhone: "0700000101",
    id: "legacy-buy",
    invoiceNumber: "77",
    type: "buy",
    date: "2026/10/15",
    partyId: "test-supplier",
    warehouseId: "wh-1",
    currency: "USD",
    exchangeRate: 65,
    items: [
      {
        productName: "کالای نمونه الف",
        productCode: "201",
        id: "legacy-item",
        productId: "test-product",
        warehouseId: "wh-1",
        unit: "ton",
        quantity: 1,
        tonsCount: 1,
        bagsCount: 20,
        unitPrice: 25,
        currency: "USD",
        totalPrice: 25,
      },
    ],
    subtotal: 25,
    discount: 0,
    tax: 2,
    extraExpenses: [
      {
        id: "legacy-expense",
        partyId: "test-driver",
        partyName: "راننده آزمایشی",
        title: "کرایه",
        amount: 650,
        currency: "AFN",
      },
    ],
    totalAmount: 37,
    paidAmount: 0,
    balanceAmount: 37,
    paymentStatus: "unpaid",
    paymentType: "نسیه",
    dealType: "regular",
  };
  const opening = {
    ...fixtures,
    invoices: [legacy],
    parties: parties.map((p) =>
      p.id === "test-supplier" ? { ...p, balanceUSD: 37 } : p,
    ),
    stocks: fixtures.stocks.map((s) =>
      s.productId === "test-product"
        ? { ...s, quantityTons: 6, quantityBags: 120 }
        : s,
    ),
  };
  await seed(page, opening);
  await page.reload({ waitUntil: "networkidle" });
  await dismissToasts(page);
  await page.locator("#dashboard-btn-new-purchase").click();
  await navigateSidebar(page, "لیست خریدها");
  await page
    .getByRole("button", { name: "ویرایش فاکتور #77", exact: true })
    .click();
  assert.equal(await page.locator("#trade-date").inputValue(), "1405/07/23");
  assert.equal(await page.locator("#trade-exchange-rate").inputValue(), "65");
  assert.equal(
    await page.locator("#trade-exchange-rate").getAttribute("readonly"),
    null,
  );
  assert.equal(await page.locator("#trade-final-total").inputValue(), "37");
  await page.locator(".trade-save-button").click();
  assert.equal((await state(page)).invoices[0].exchangeRate, 65);
  assert.equal((await state(page)).invoices[0].date, "2026/10/15");
  await page.locator(".trade-rate-review input").check();
  await page.locator(".trade-save-button").click();
  await page.locator(".trade-invoice-list").waitFor();
  let data = await state(page);
  assert.equal(data.invoices[0].date, "1405/07/23");
  assert.equal(data.invoices[0].exchangeRateBaseCurrency, "USD");
  assert.equal(data.invoices[0].exchangeRate, 1);
  assert.equal(data.invoices[0].tax, 2);
  assert.equal(data.invoices[0].totalAmount, 37);
  assert.equal(data.invoices[0].extraExpenses[0].amountInInvoiceCurrency, 10);
  assert.equal(
    data.parties.find((p) => p.id === "test-supplier").balanceUSD,
    37,
  );

  // Currency conversion must retain tax, and a temporarily blank/zero rate must not corrupt foreign costs.
  await page
    .getByRole("button", { name: "ویرایش فاکتور #77", exact: true })
    .click();
  await page.locator("#trade-currency").selectOption("AFN");
  assert.equal(await page.locator("#trade-final-total").inputValue(), "2405");
  await page
    .getByRole("button", { name: "افزودن هزینه جدید", exact: true })
    .click();
  await choose(page, '[aria-label="طرف حساب هزینه 2"]', "103");
  await page
    .getByLabel("شرح هزینه 2", { exact: true })
    .fill("هزینه دالری آزمایشی");
  await page.getByLabel("ارز هزینه 2", { exact: true }).selectOption("USD");
  await page.getByLabel("مبلغ هزینه 2", { exact: true }).fill("5");
  assert.equal(await page.locator("#trade-final-total").inputValue(), "2730");
  for (const value of ["", "0", "-1"]) {
    await page.locator("#trade-exchange-rate").fill(value);
    assert.equal(await page.locator("#trade-final-total").inputValue(), "2730");
    await page.locator(".trade-save-button").click();
    assert.equal((await state(page)).invoices[0].totalAmount, 37);
  }
  await page.locator("#trade-exchange-rate").fill("50");
  assert.equal(await page.locator("#trade-final-total").inputValue(), "2655");
  await page.locator(".trade-save-button").click();
  await page.locator(".trade-invoice-list").waitFor();
  data = await state(page);
  assert.equal(data.invoices[0].currency, "AFN");
  assert.equal(data.invoices[0].tax, 130);
  assert.equal(data.invoices[0].exchangeRate, 0.02);
  assert.equal(data.invoices[0].totalAmount, 2655);
  assert.equal(data.invoices[0].extraExpenses[1].exchangeRateToInvoice, 50);
  assert.equal(
    data.parties.find((p) => p.id === "test-supplier").balanceUSD,
    0,
  );
  assert.equal(
    data.parties.find((p) => p.id === "test-supplier").balanceAFN,
    2655,
  );
  assert.equal(data.cash.usdBalance, 1000);
  assert.equal(data.cash.afnBalance, 10000);
  await page
    .getByRole("button", { name: "ویرایش فاکتور #77", exact: true })
    .click();
  assert.equal(await page.locator("#trade-exchange-rate").inputValue(), "50");
  assert.equal(await page.locator("#trade-final-total").inputValue(), "2655");
  assert.equal(await page.locator(".trade-rate-review").count(), 0);

  // The same numeric rate expressed against a different archived base is still a units mismatch.
  await seed(page, {
    ...opening,
    invoices: [
      {
        ...legacy,
        exchangeRate: 1,
        exchangeRateBaseCurrency: "AFN",
        extraExpenses: [],
        totalAmount: 27,
        balanceAmount: 27,
      },
    ],
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#dashboard-btn-new-purchase").click();
  await navigateSidebar(page, "لیست خریدها");
  await page
    .getByRole("button", { name: "ویرایش فاکتور #77", exact: true })
    .click();
  assert.equal(await page.locator(".trade-rate-review").count(), 1);
  await page.locator(".trade-save-button").click();
  assert.equal((await state(page)).invoices[0].exchangeRateBaseCurrency, "AFN");
  await page.context().close();
  console.log(
    "PASS: archived FX review, Gregorian edit dates, explicit USD/AFN quote with unchanged internal base rate, tax conversion, temporary-invalid FX and retained historical rates",
  );
}

/* Intercepts a test-only URL in this isolated browser. No diagnostic API / harness is added to the app. */
async function postingSmoke(browser, errors) {
  const page = await isolatedPage(browser, errors);
  const html = await (await fetch(baseURL + "/dashboard")).text();
  const providerSource = await (
    await fetch(baseURL + "/src/context/AccountingContext.tsx")
  ).text();
  const mainSource = await (await fetch(baseURL + "/src/main.tsx")).text();
  const reactImport = providerSource.match(
    /from\s+["']([^"']*\/react\.js[^"']*)["']/,
  )[1];
  const domImport = mainSource.match(
    /from\s+["']([^"']*react-dom_client\.js[^"']*)["']/,
  )[1];
  const module = `import React from ${JSON.stringify(reactImport)}; import DomClient from ${JSON.stringify(domImport)}; const {createRoot}=DomClient;
    import {AccountingProvider,useAccounting} from '/src/context/AccountingContext.tsx';
    function Probe(){const ctx=useAccounting();React.useLayoutEffect(()=>{window.__posting={state:{invoices:ctx.invoices,stocks:ctx.stocks,parties:ctx.parties,cash:ctx.cashRegister,cash_accounts:ctx.cashAccounts,transactions:ctx.transactions},create:ctx.createInvoice,update:ctx.updateInvoice,remove:ctx.deleteInvoice};});return React.createElement('p',null,'ISOLATED TEST — NOT FINANCIAL DATA');}
    createRoot(document.getElementById('root')).render(React.createElement(AccountingProvider,null,React.createElement(Probe)));`;
  const testHTML = html.replace(
    /<script\b[^>]*src="\/src\/main\.tsx[^"]*"[^>]*>\s*<\/script>/,
    `<script type="module">${module}</script>`,
  );
  assert.notEqual(
    testHTML,
    html,
    "test harness must replace, not mount, the real app",
  );
  await page.route("**/isolated-invoice-posting-test", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: testHTML }),
  );
  await page.addInitScript(
    ({ prefix, fixtures }) => {
      for (const [key, value] of Object.entries(fixtures))
        localStorage.setItem(prefix + key, JSON.stringify(value));
    },
    { prefix, fixtures },
  );
  await page.goto(baseURL + "/isolated-invoice-posting-test", {
    waitUntil: "networkidle",
  });
  try {
    await page.waitForFunction(() => window.__posting);
  } catch (error) {
    console.error(
      "Posting harness errors:",
      errors,
      await page.locator("body").innerText(),
    );
    throw error;
  }
  const get = () => page.evaluate(() => window.__posting.state);
  const original = await get();
  for (const type of ["buy", "sell", "return_buy", "return_sell"]) {
    const sign = type === "buy" || type === "return_sell" ? 1 : -1;
    const invoice = {
      invoiceNumber: "91",
      type,
      date: "1405/07/23",
      partyId: "test-supplier",
      partyName: "تأمین‌کننده آزمایشی",
      warehouseId: "wh-1",
      currency: "USD",
      items: [
        {
          id: "row",
          productId: "test-product",
          productName: "کالای نمونه الف",
          warehouseId: "wh-1",
          unit: "ton",
          quantity: 2,
          tonsCount: 2,
          bagsCount: 40,
          unitPrice: 50,
          currency: "USD",
          totalPrice: 100,
        },
      ],
      subtotal: 100,
      discount: 0,
      totalAmount: 100,
      paidAmount: 10,
      balanceAmount: 90,
      paymentStatus: "partial",
      dealType: "regular",
      cashRegister: "usd_cash",
      cashRegisterId: "usd_cash",
    };
    const created = await page.evaluate(
      (data) => window.__posting.create(data),
      invoice,
    );
    await waitCount(page, 1);
    let data = await get();
    assert.equal(
      data.stocks.find((s) => s.productId === "test-product").quantityTons,
      5 + sign * 2,
      type + " create stock",
    );
    assert.equal(data.parties[0].balanceUSD, sign * 90, type + " create party");
    assert.equal(data.cash.usdBalance, 1000 - sign * 10, type + " create cash");
    const updated = {
      ...created,
      items: [
        {
          ...created.items[0],
          quantity: 3,
          tonsCount: 3,
          bagsCount: 60,
          totalPrice: 150,
        },
      ],
      subtotal: 150,
      totalAmount: 150,
      paidAmount: 20,
      balanceAmount: 130,
    };
    await page.evaluate((data) => window.__posting.update(data), updated);
    await page.waitForFunction(
      (id) =>
        window.__posting.state.invoices.find((i) => i.id === id)
          ?.totalAmount === 150,
      created.id,
    );
    data = await get();
    assert.equal(
      data.stocks.find((s) => s.productId === "test-product").quantityTons,
      5 + sign * 3,
      type + " update stock",
    );
    assert.equal(
      data.parties[0].balanceUSD,
      sign * 130,
      type + " update party",
    );
    assert.equal(data.cash.usdBalance, 1000 - sign * 20, type + " update cash");
    assert.equal(data.transactions.length, 1);
    assert.equal(
      data.transactions[0].type,
      sign === 1 ? "make_payment" : "receive_payment",
    );
    await page.evaluate((id) => window.__posting.remove(id), created.id);
    await waitCount(page, 0);
    data = await get();
    assert.deepEqual(data.stocks, original.stocks, type + " delete stock");
    assert.deepEqual(data.parties, original.parties, type + " delete party");
    assert.deepEqual(data.cash, original.cash, type + " delete cash");
    assert.deepEqual(data.cash_accounts, original.cash_accounts);
    assert.equal(data.transactions.length, 0);
  }
  // An existing negative stock / insufficient cash must not be silently clamped during edit / undo.
  const negative = {
    invoiceNumber: "92",
    type: "sell",
    date: "1405/07/23",
    partyId: "test-customer",
    partyName: "مشتری آزمایشی",
    warehouseId: "wh-1",
    currency: "USD",
    items: [
      {
        id: "negative-row",
        productId: "test-product-zero",
        productName: "کالای نمونه بدون موجودی",
        warehouseId: "wh-1",
        unit: "ton",
        quantity: 1,
        tonsCount: 1,
        bagsCount: 20,
        unitPrice: 15,
        currency: "USD",
        totalPrice: 15,
      },
    ],
    subtotal: 15,
    discount: 0,
    totalAmount: 15,
    paidAmount: 0,
    balanceAmount: 15,
    paymentStatus: "unpaid",
    dealType: "regular",
  };
  const sold = await page.evaluate(
    (data) => window.__posting.create(data),
    negative,
  );
  await waitCount(page, 1);
  await page.evaluate(
    (invoice) =>
      window.__posting.update({
        ...invoice,
        items: [
          {
            ...invoice.items[0],
            quantity: 2,
            tonsCount: 2,
            bagsCount: 40,
            totalPrice: 30,
          },
        ],
        subtotal: 30,
        totalAmount: 30,
        balanceAmount: 30,
      }),
    sold,
  );
  await page.waitForFunction(
    () => window.__posting.state.invoices[0]?.totalAmount === 30,
  );
  assert.equal(
    (await get()).stocks.find((s) => s.productId === "test-product-zero")
      .quantityTons,
    -2,
  );
  await page.evaluate((id) => window.__posting.remove(id), sold.id);
  await waitCount(page, 0);
  assert.equal(
    (await get()).stocks.find((s) => s.productId === "test-product-zero")
      .quantityTons,
    0,
  );
  const largePurchase = {
    ...negative,
    type: "buy",
    paidAmount: 1500,
    balanceAmount: 0,
    totalAmount: 1500,
    subtotal: 1500,
    paymentStatus: "paid",
    cashRegister: "usd_cash",
    cashRegisterId: "usd_cash",
    items: [{ ...negative.items[0], unitPrice: 1500, totalPrice: 1500 }],
  };
  const bought = await page.evaluate(
    (data) => window.__posting.create(data),
    largePurchase,
  );
  await waitCount(page, 1);
  assert.equal((await get()).cash.usdBalance, -500);
  await page.evaluate((id) => window.__posting.remove(id), bought.id);
  await waitCount(page, 0);
  assert.equal((await get()).cash.usdBalance, 1000);
  // Distinct invoices issued in the same millisecond must not share a primary / transaction ID.
  const ids = await page.evaluate((data) => {
    const old = Date.now;
    Date.now = () => 123456;
    try {
      return [
        window.__posting.create({ ...data, invoiceNumber: "93" }).id,
        window.__posting.create({ ...data, invoiceNumber: "94" }).id,
      ];
    } finally {
      Date.now = old;
    }
  }, negative);
  assert.notEqual(ids[0], ids[1]);
  await waitCount(page, 2);
  await page.context().close();
  console.log(
    "PASS: actual context create / update / delete round trips for buy, sell and both returns, negative inventory, cash reversal and unique IDs",
  );
}

(async () => {
  const errors = [];
  // Lambda Chromium's single-process mode may exit when its last context closes.
  const checks = { ui: uiSmoke, edge: edgeSmoke, posting: postingSmoke };
  for (const check of process.env.TRADE_CHECK
    ? [checks[process.env.TRADE_CHECK]]
    : Object.values(checks)) {
    assert.equal(
      typeof check,
      "function",
      "TRADE_CHECK must be ui, edge or posting",
    );
    const browser = await launch();
    try {
      await check(browser, errors);
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "ALL TRADE BROWSER CHECKS PASSED. No live financial data or external messages were used.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

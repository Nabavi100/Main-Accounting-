const assert = require("node:assert/strict");
const {
  launch,
  pageFor,
  login,
  readData,
  storagePrefix,
  navigateSidebar,
} = require("./browser-support.cjs");
const waitBalances = async (page, customer, supplier, usd, afn, bank) =>
  page.waitForFunction(
    ({ prefix, customer, supplier, usd, afn, bank }) => {
      const parties = JSON.parse(
          localStorage.getItem(prefix + "parties") || "[]",
        ),
        accounts = JSON.parse(
          localStorage.getItem(prefix + "cash_accounts") || "[]",
        );
      return (
        parties.find((p) => p.id === "test-customer")?.balanceUSD ===
          customer &&
        parties.find((p) => p.id === "test-supplier")?.balanceUSD ===
          supplier &&
        accounts.find((a) => a.id === "usd_cash")?.balance === usd &&
        accounts.find((a) => a.id === "afn_cash")?.balance === afn &&
        accounts.find((a) => a.id === "test-bank")?.balance === bank
      );
    },
    { prefix: storagePrefix, customer, supplier, usd, afn, bank },
  );
const pickParty = async (page, name) => {
  await page.locator("#treasury-party").fill(name);
  await page
    .locator(".trade-lookup-popup button")
    .filter({ hasText: name })
    .click();
};
const tab = (page, name) =>
  navigateSidebar(page, name);
const submit = (page) => page.locator(".treasury-submit").click();
const remove = async (page, number) => {
  await page
    .getByRole("button", { name: `حذف سند #${number}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "تأیید حذف سند", exact: true })
    .click();
};
(async () => {
  const browser = await launch();
  const errors = [];
  try {
    const page = await pageFor(browser, errors);
    await login(page);
    await page.evaluate((prefix) => {
      localStorage.setItem(
        prefix + "parties",
        JSON.stringify([
          {
            id: "test-customer",
            name: "مشتری آزمایشی",
            type: "customer",
            phone: "",
            balanceUSD: -1000,
            balanceAFN: 0,
            createdAt: "2026-10-15",
          },
          {
            id: "test-supplier",
            name: "تأمین‌کننده آزمایشی",
            type: "supplier",
            phone: "",
            balanceUSD: 200,
            balanceAFN: 500,
            createdAt: "2026-10-15",
          },
        ]),
      );
      localStorage.setItem(
        prefix + "cash_accounts",
        JSON.stringify([
          {
            id: "usd_cash",
            name: "صندوق دالری نمونه",
            currency: "USD",
            balance: 1000,
            initialBalance: 1000,
          },
          {
            id: "afn_cash",
            name: "صندوق افغانی نمونه",
            currency: "AFN",
            balance: 5000,
            initialBalance: 5000,
          },
          {
            id: "test-bank",
            name: "بانک نمونه",
            currency: "USD",
            balance: 200,
            initialBalance: 200,
          },
        ]),
      );
      localStorage.setItem(
        prefix + "cash",
        JSON.stringify({
          usdBalance: 1000,
          afnBalance: 5000,
          exchangeUsdBalance: 0,
          usdToAfnRate: 65,
        }),
      );
      localStorage.setItem(prefix + "transactions", "[]");
      localStorage.setItem(prefix + "invoices", "[]");
    }, storagePrefix);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#dashboard-btn-new-payment").click();
    assert.equal(await page.getByRole("tab").count(), 0);
    await page.locator("#treasury-number").fill("101");
    await pickParty(page, "مشتری آزمایشی");
    await page.locator("#treasury-cash").selectOption("usd_cash");
    await page.locator("#treasury-amount").fill("100");
    await page.locator("#treasury-discount").fill("5");
    // A valid draft opening its calendar must not accidentally submit the form.
    await page
      .getByRole("button", { name: "انتخاب تاریخ سند", exact: true })
      .click();
    await page.keyboard.press("Escape");
    assert.equal((await readData(page, "transactions")).length, 0);
    await submit(page);
    await waitBalances(page, -895, 200, 1100, 5000, 200);
    let tx = (await readData(page, "transactions"))[0];
    assert.equal(tx.discountAmount, 5);
    assert.equal(tx.partyBalanceAfter, -895);
    const originalCreated = tx.createdAt;
    await page
      .getByRole("button", { name: "ویرایش سند #101", exact: true })
      .click();
    await page.locator(".workspace-dialog #treasury-amount").fill("110");
    await page.locator(".workspace-dialog #treasury-discount").fill("7");
    await page.locator(".workspace-dialog .treasury-submit").click();
    await waitBalances(page, -883, 200, 1110, 5000, 200);
    tx = (await readData(page, "transactions"))[0];
    assert.equal(tx.createdAt, originalCreated);
    assert.equal(tx.transactionNumber, "101");
    await remove(page, "101");
    await waitBalances(page, -1000, 200, 1000, 5000, 200);

    // AFN cash for a USD ledger, with a discount in the ledger currency.
    await tab(page, "ثبت دریافت (ورودی)");
    await page.locator("#treasury-number").fill("102");
    await pickParty(page, "مشتری آزمایشی");
    await page.locator("#treasury-currency").selectOption("AFN");
    await page.locator("#treasury-cash").selectOption("afn_cash");
    await page
      .getByText("فعال‌سازی تسویهٔ چندارزی (تبدیل مستقیم پول)", { exact: true })
      .click();
    await page.locator("#treasury-amount").fill("6500");
    await page.locator("#treasury-discount").fill("5");
    assert.equal(
      await page.locator("#treasury-ledger-amount").inputValue(),
      "100",
    );
    await page.locator("#treasury-rate").fill("0");
    await submit(page);
    assert.equal((await readData(page, "transactions")).length, 0);
    await page.locator("#treasury-rate").fill("65");
    await submit(page);
    await waitBalances(page, -895, 200, 1000, 11500, 200);
    await page
      .getByRole("button", { name: "ویرایش سند #102", exact: true })
      .click();
    assert.equal(
      await page.locator(".workspace-dialog #treasury-amount").inputValue(),
      "6500",
    );
    await page.getByRole("button", { name: "بستن پنجره", exact: true }).click();

    // Supplier payment with received discount, with no hidden cash entry for the discount.
    await tab(page, "ثبت پرداخت (خروجی)");
    await page.locator("#treasury-mode").selectOption("party");
    await page.locator("#treasury-number").fill("103");
    await pickParty(page, "تأمین‌کننده آزمایشی");
    await page.locator("#treasury-cash").selectOption("usd_cash");
    await page.locator("#treasury-amount").fill("40");
    await page.locator("#treasury-discount").fill("3");
    await submit(page);
    await waitBalances(page, -895, 157, 960, 11500, 200);
    await remove(page, "103");
    await waitBalances(page, -895, 200, 1000, 11500, 200);

    // Internal transfer: both list sides, no party mutation, editable and reversible.
    await tab(page, "ثبت پرداخت (خروجی)");
    await page.locator("#treasury-number").fill("104");
    await page.locator("#treasury-cash").selectOption("usd_cash");
    await page.locator("#treasury-destination").selectOption("test-bank");
    await page.locator("#treasury-amount").fill("100");
    await submit(page);
    await waitBalances(page, -895, 200, 900, 11500, 300);
    await tab(page, "لیست دریافت‌ها");
    assert.ok(
      await page
        .getByRole("button", { name: "چاپ سند #104", exact: true })
        .isVisible(),
    );
    await tab(page, "لیست پرداخت‌ها");
    await page
      .getByRole("button", { name: "ویرایش سند #104", exact: true })
      .click();
    await page.locator(".workspace-dialog #treasury-amount").fill("50");
    await page.locator(".workspace-dialog .treasury-submit").click();
    await waitBalances(page, -895, 200, 950, 11500, 250);
    await remove(page, "104");
    await waitBalances(page, -895, 200, 1000, 11500, 200);

    // Direct USD->AFN transfer uses the target amount, not the source number in both currencies.
    await tab(page, "ثبت پرداخت (خروجی)");
    await page.locator("#treasury-number").fill("105");
    await page.locator("#treasury-cash").selectOption("usd_cash");
    await page.locator("#treasury-destination").selectOption("afn_cash");
    await page.locator("#treasury-amount").fill("10");
    assert.equal(
      await page.locator("#treasury-ledger-amount").inputValue(),
      "650",
    );
    await submit(page);
    await waitBalances(page, -895, 200, 990, 12150, 200);
    await page
      .getByRole("button", { name: "ویرایش سند #105", exact: true })
      .click();
    await page.locator(".workspace-dialog #treasury-amount").fill("12");
    await page.locator(".workspace-dialog .treasury-submit").click();
    await waitBalances(page, -895, 200, 988, 12280, 200);
    await remove(page, "105");
    await waitBalances(page, -895, 200, 1000, 11500, 200);
    await tab(page, "لیست دریافت‌ها");
    await page
      .getByLabel("جستجوی اسناد خزانه", { exact: true })
      .fill("نام ناموجود");
    assert.equal(
      await page
        .getByRole("button", { name: "چاپ سند #102", exact: true })
        .count(),
      0,
    );
    await page.getByLabel("جستجوی اسناد خزانه", { exact: true }).fill("102");
    assert.ok(
      await page
        .getByRole("button", { name: "چاپ سند #102", exact: true })
        .isVisible(),
    );
    await page.getByLabel("جستجوی اسناد خزانه", { exact: true }).fill("");
    await remove(page, "102");
    await waitBalances(page, -1000, 200, 1000, 5000, 200);

    // Duplicate guard, typed-ID safety, a new party on a valid draft, and mobile containment.
    await tab(page, "ثبت دریافت (ورودی)");
    await page.locator("#treasury-number").fill("106");
    await pickParty(page, "مشتری آزمایشی");
    await page.locator("#treasury-cash").selectOption("usd_cash");
    await page.locator("#treasury-amount").fill("1");
    await page.locator("#treasury-party").fill("نام انتخاب‌نشده");
    await submit(page);
    assert.equal((await readData(page, "transactions")).length, 0);
    await pickParty(page, "مشتری آزمایشی");
    await page
      .getByRole("button", { name: "افزودن طرف حساب سند", exact: true })
      .click();
    await page
      .getByPlaceholder("مثلاً حاجی نعیم الله غزنوی", { exact: true })
      .fill("شخص جدید آزمایشی");
    await page
      .getByRole("button", { name: "ثبت و انتخاب طرف حساب", exact: true })
      .click();
    assert.equal((await readData(page, "transactions")).length, 0);
    await pickParty(page, "مشتری آزمایشی");
    await submit(page);
    await tab(page, "ثبت دریافت (ورودی)");
    await page.locator("#treasury-number").fill("REC-0106");
    await pickParty(page, "مشتری آزمایشی");
    await page.locator("#treasury-cash").selectOption("usd_cash");
    await page.locator("#treasury-amount").fill("2");
    await submit(page);
    assert.equal((await readData(page, "transactions")).length, 1);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    await tab(page, "لیست دریافت‌ها");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: treasury create/edit/delete, receipt/payment discounts, cross-currency settlement, same/cross-currency transfers, both list directions, number/party/rate guards, calendar/quick-party isolation, filters, six-decimal Context balances, mobile.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

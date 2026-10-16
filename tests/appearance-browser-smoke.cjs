const { navigateSidebar, openAppearanceSettings } = require("./browser-support.cjs");
/* Optional UI-only integration test: independent browser storage, blocked external traffic and Telegram stubs. */
const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const assert = require("node:assert/strict");
const req = createRequire(path.join(process.cwd(), "package.json"));
const { chromium: playwright } = req("playwright");
const baseURL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const allowedOrigin = new URL(baseURL).origin;
const shots =
  process.env.APPEARANCE_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), "accounting-appearance-smoke");
fs.mkdirSync(shots, { recursive: true });
const financePrefix = "AFGHAN_ACCOUNTING_DATA_V2_";
const themeKey = "cement_erp_theme_mode";
const sidebarKey = "cement_erp_sidebar_style";
const rgb = (hex) =>
  `rgb(${hex
    .slice(1)
    .match(/.{2}/g)
    .map((v) => parseInt(v, 16))
    .join(", ")})`;

async function launch() {
  if (process.env.CHROMIUM_EXECUTABLE)
    return playwright.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      headless: true,
      args: ["--no-sandbox"],
    });
  try {
    return await playwright.launch({ headless: true });
  } catch {
    const module = req("@sparticuz/chromium");
    if (module.inflate && module.setupLambdaEnvironment) {
      let root = path.dirname(req.resolve("@sparticuz/chromium"));
      while (
        !fs.existsSync(path.join(root, "bin/al2023.tar.br")) &&
        root !== path.dirname(root)
      )
        root = path.dirname(root);
      await module.inflate(path.join(root, "bin/al2023.tar.br"));
      module.setupLambdaEnvironment("/tmp/al2023/lib");
    }
    const chromium = module.default || module;
    return playwright.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }
}
const finance = (page) =>
  page.evaluate(
    (prefix) =>
      Object.fromEntries(
        Object.keys(localStorage)
          .filter((key) => key.startsWith(prefix))
          .sort()
          .map((key) => [key, localStorage.getItem(key)]),
      ),
    financePrefix,
  );
const storedTheme = (page) =>
  page.evaluate((key) => localStorage.getItem(key), themeKey);
async function selected(page, theme) {
  await page.waitForFunction(
    (theme) => document.body.dataset.theme === theme,
    theme,
  );
}
const choose = (page, theme) =>
  page.locator(`[data-preset-theme="${theme}"]`).click();
const open = (page) => openAppearanceSettings(page);
const close = (page) =>
  page.getByRole("button", { name: "بستن تنظیمات ظاهر", exact: true }).click();
const save = (page) =>
  page.getByRole("button", { name: "ذخیره تنظیمات ظاهر", exact: true }).click();

(async () => {
  const browser = await launch();
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1908, height: 980 },
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
    await page.goto(baseURL + "/dashboard", { waitUntil: "networkidle" });
    await page.locator("#login-password-input").fill("123");
    await page.locator("#login-submit-button").click();
    await page.locator(".dash-quick").waitFor();
    await page.evaluate(() =>
      document
        .querySelectorAll('[id^="toast-"] button')
        .forEach((button) => button.click()),
    );
    const before = await finance(page);
    const originalTheme = await storedTheme(page);

    await open(page);
    await page
      .getByRole("dialog", { name: "تنظیمات ظاهر و رنگ سیستم", exact: true })
      .waitFor();
    assert.equal(await page.locator(".appearance-preset-option").count(), 4);
    assert.equal(await page.locator(".appearance-color-group > .appearance-color-grid > .appearance-color-row").count(), 13);
    assert.equal(await page.locator('.appearance-dialog input[type="color"]').count(), 0);
    assert.match(await page.locator(".appearance-future-note").innerText(), /کد HEX/);
    for (const [theme, color] of [
      ["novatech", "#eaf5fc"],
      ["executive", "#edf0fc"],
      ["vibrant", "#e8f5ed"],
      ["gold", "#fff6df"],
    ]) {
      await choose(page, theme);
      await selected(page, theme);
      assert.equal(
        await page
          .locator(".workspace-header")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        rgb(color),
      );
      assert.equal(
        await page
          .locator(".appearance-preview-card .appearance-mini-header")
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        rgb(color),
      );
      assert.equal(await storedTheme(page), originalTheme);
      assert.deepEqual(await finance(page), before);
      await page.screenshot({
        path: path.join(shots, `preset-${theme}.png`),
        animations: "disabled",
      });
    }
    await save(page);
    await page.waitForFunction(
      (key) => localStorage.getItem(key) === "gold",
      themeKey,
    );
    await close(page);
    await page.waitForFunction(
      () => document.activeElement.id === "workspace-profile-toggle",
    );
    await page.reload({ waitUntil: "networkidle" });
    await selected(page, "gold");
    assert.deepEqual(await finance(page), before);

    // Cancellation/escape restores the saved appearance, rather than saving a preview.
    await open(page);
    await choose(page, "novatech");
    await selected(page, "novatech");
    assert.equal(await storedTheme(page), "gold");
    await page.keyboard.press("Escape");
    await selected(page, "gold");
    assert.equal(await page.locator(".appearance-dialog").count(), 0);
    await open(page);
    await page
      .getByRole("button", { name: "بازگشت به تم اصلی", exact: true })
      .click();
    await selected(page, "novatech");
    assert.equal(await storedTheme(page), "gold");
    await save(page);
    await close(page);
    assert.equal(await storedTheme(page), "novatech");

    // All three old sidebar styles are still selectable and reversible.
    await open(page);
    await page.locator(".appearance-sidebar-options summary").click();
    await page
      .locator(".appearance-sidebar-options label")
      .filter({ hasText: "منوی فشرده" })
      .locator("input")
      .check();
    assert.equal(
      await page
        .locator(".workspace-sidebar")
        .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
      228,
    );
    await close(page);
    assert.equal(
      await page
        .locator(".workspace-sidebar")
        .evaluate((el) => Math.round(el.getBoundingClientRect().width)),
      256,
    );
    await open(page);
    await page.locator(".appearance-sidebar-options summary").click();
    await page
      .locator(".appearance-sidebar-options label")
      .filter({ hasText: "کارت‌های تفکیک‌شده" })
      .locator("input")
      .check();
    await save(page);
    await close(page);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), sidebarKey),
      "colored-cards",
    );
    await open(page);
    await page.locator(".appearance-sidebar-options summary").click();
    await page
      .locator(".appearance-sidebar-options label")
      .filter({ hasText: "لیستی مرتب" })
      .locator("input")
      .check();
    await save(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(shots, "appearance-desktop.png"),
      animations: "disabled",
    });
    const footer = await page.locator(".appearance-footer").boundingBox();
    assert.ok(footer.y + footer.height <= 980);
    await close(page);

    // The sidebar opens a standalone version of the same editor, not a modal.
    await page
      .getByRole("button", { name: "مدیریت سیستم", exact: true })
      .click();
    await page
      .getByRole("button", { name: "تنظیمات ظاهر و تم", exact: true })
      .click();
    await page.locator("section.appearance-page").waitFor();
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.getByRole("button", { name: "انصراف از تغییرات", exact: true }).click();
    await page.locator(".workspace-company-pill").click();

    // The header editor is a separate modal, so changing a theme cannot erase an unposted invoice draft.
    await page.locator("#dashboard-btn-new-purchase").click();
    await page.locator("#trade-invoice-number").fill("draft-theme-47");
    await page.getByLabel("تعداد ردیف 1", { exact: true }).fill("2.125");
    await page.locator("#trade-discount").fill("1.75");
    await open(page);
    await choose(page, "executive");
    await save(page);
    await close(page);
    assert.equal(
      await page.locator("#trade-invoice-number").inputValue(),
      "draft-theme-47",
    );
    assert.equal(
      await page.getByLabel("تعداد ردیف 1", { exact: true }).inputValue(),
      "2.125",
    );
    assert.equal(await page.locator("#trade-discount").inputValue(), "1.75");
    assert.deepEqual(await finance(page), before);
    assert.equal(
      await page
        .locator("#trade-final-total")
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(38, 60, 81)",
    );
    assert.equal(
      await page
        .locator("#trade-balance-amount")
        .evaluate((el) => getComputedStyle(el).color),
      rgb("#c73650"),
    );

    // Mobile containment and fixed visible save/cancel controls.
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    const box = await page.locator(".appearance-dialog").boundingBox();
    assert.ok(
      box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844,
    );
    const mobileFooter = await page.locator(".appearance-footer").boundingBox();
    assert.ok(mobileFooter.y + mobileFooter.height <= 844);
    await page.screenshot({
      path: path.join(shots, "appearance-mobile.png"),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1908, height: 980 });

    // Older saved choices are still available in the compact disclosure.
    await open(page);
    await page.locator(".appearance-legacy-themes summary").click();
    await page
      .getByRole("button", { name: "عاجی کلاسیک", exact: true })
      .click();
    await selected(page, "classic");
    await save(page);
    await close(page);
    await page.reload({ waitUntil: "networkidle" });
    await selected(page, "classic");
    await open(page);
    await page
      .getByRole("button", { name: "بازگشت به تم اصلی", exact: true })
      .click();
    await save(page);
    await close(page);
    assert.deepEqual(await finance(page), before);

    // Print preview/output keep their own paper styling when the application uses a dark theme.
    const invoice = {
      id: "appearance-test-invoice",
      createdAt: "2026-10-15T00:00:00Z",
      type: "buy",
      invoiceNumber: "901",
      date: "1405/07/23",
      partyId: "appearance-test-party",
      partyName: "طرف حساب نمایشی",
      partyPhone: "",
      warehouseId: "wh-1",
      warehouseName: "گدام مرکزی",
      currency: "USD",
      exchangeRate: 1,
      exchangeRateBaseCurrency: "USD",
      subtotal: 25,
      totalAmount: 25,
      paidAmount: 0,
      balanceAmount: 25,
      discount: 0,
      tax: 0,
      shippingCost: 0,
      paymentStatus: "unpaid",
      paymentType: "نسیه",
      dealType: "regular",
      items: [
        {
          id: "appearance-test-item",
          productId: "appearance-test-product",
          productName: "کالای نمایشی",
          productCode: "201",
          warehouseId: "wh-1",
          warehouseName: "گدام مرکزی",
          unit: "ton",
          quantity: 1,
          tonsCount: 1,
          bagsCount: 20,
          unitPrice: 25,
          totalPrice: 25,
          currency: "USD",
          buyPrice: 25,
        },
      ],
    };
    await page.evaluate(
      ({ prefix, invoice, key }) => {
        localStorage.setItem(prefix + "invoices", JSON.stringify([invoice]));
        localStorage.setItem(key, "gold");
      },
      { prefix: financePrefix, invoice, key: themeKey },
    );
    await page.reload({ waitUntil: "networkidle" });
    await selected(page, "gold");
    await page.locator("#dashboard-btn-new-purchase").click();
    await navigateSidebar(page, "لیست خریدها");
    await page
      .getByRole("button", { name: "چاپ فاکتور #901", exact: true })
      .click();
    await page.locator("#printable-paper-canvas").waitFor();
    assert.equal(
      await page
        .locator("#printable-paper-canvas")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(255, 255, 255)",
    );
    const beforePrint = await finance(page);
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .locator("#printable-paper-canvas")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(255, 255, 255)",
    );
    assert.deepEqual(await finance(page), beforePrint);
    await page.emulateMedia({ media: "screen" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: four presets, live 13-field preview, save/cancel/reset/reload, all legacy themes and sidebar layouts, draft preservation, unchanged finance data, mobile containment and theme-independent print paper.",
    );
    console.log(
      "ALL APPEARANCE BROWSER CHECKS PASSED. No production data or external messages were used.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require("node:assert/strict");
const {
  launch,
  pageFor,
  preparePage,
  login,
  readData,
  rgb,
  storagePrefix,
  baseURL,
  openAppearanceSettings,
} = require("./browser-support.cjs");
const financeSnapshot = async (page) =>
  page.evaluate(
    (prefix) =>
      Object.fromEntries(
        [
          "parties",
          "invoices",
          "transactions",
          "stocks",
          "cash",
          "cash_accounts",
        ].map((key) => [key, localStorage.getItem(prefix + key)]),
      ),
    storagePrefix,
  );
(async () => {
  let browser = await launch();
  const errors = [];
  try {
    let page = await pageFor(browser, errors);
    await login(page);
    assert.equal(
      (await readData(page, "company")).name,
      "شرکت تجارتی برادران نبوی",
    );
    await page.locator("#dashboard-btn-new-purchase").click();
    await page.locator(".workspace-company-pill").click();
    await page
      .locator(".dash-quick")
      .waitFor({ timeout: 12000 })
      .catch(async (error) => {
        console.error(
          "RELOAD PAGE:",
          await page.locator("body").innerText(),
          await page.evaluate(() => Object.keys(localStorage)),
        );
        await page.screenshot({ path: "/tmp/brand-reload-failure.png" });
        throw error;
      });
    assert.equal(await page.locator("#access-modal-backdrop").count(), 0);
    const beforeColors = await financeSnapshot(page);
    await openAppearanceSettings(page);
    assert.equal(await page.locator(".appearance-preset-option").count(), 4);
    for (const id of ["novatech", "executive", "vibrant", "gold"]) {
      await page.locator(`[data-preset-theme="${id}"]`).click();
      assert.equal(
        await page.evaluate(() => document.body.classList.contains("dark")),
        false,
      );
      assert.equal(
        await page.evaluate(() => document.body.dataset.colorMode),
        "light",
      );
      const surface = await page
        .locator(".appearance-dialog")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.equal(surface, rgb("#ffffff"));
    }
    await page.locator('[data-preset-theme="novatech"]').click();
    await page
      .getByRole("button", { name: "انتخاب رنگ رنگ سربرگ", exact: true })
      .click();
    await page
      .getByRole("button", { name: "انتخاب #e8f5ed", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".workspace-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      rgb("#e8f5ed"),
    );
    await page.getByLabel("کد رنگ رنگ سربرگ", { exact: true }).fill("#abcdef");
    assert.equal(
      await page
        .locator(".workspace-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      rgb("#abcdef"),
    );
    await page.getByLabel("کد رنگ رنگ سربرگ", { exact: true }).fill("#12");
    assert.equal(
      await page
        .locator(".workspace-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      rgb("#abcdef"),
    );
    await page
      .getByRole("button", { name: "رنگ اصلی این بخش", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".workspace-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      rgb("#eaf5fc"),
    );
    await page.getByLabel("کد رنگ رنگ سربرگ", { exact: true }).fill("#d0f0ea");
    await page
      .getByRole("button", { name: "بستن پالت رنگ", exact: true })
      .click();
    await page
      .getByRole("button", { name: "انتخاب رنگ سرستون جدول‌ها", exact: true })
      .click();
    await page
      .getByLabel("کد رنگ سرستون جدول‌ها", { exact: true })
      .fill("#e0e8fa");
    await page
      .getByRole("button", { name: "ذخیره تنظیمات ظاهر", exact: true })
      .click();
    assert.match(
      await page.locator(".appearance-save-state").innerText(),
      /ذخیره شد/,
    );
    await page
      .getByRole("button", { name: "بستن تنظیمات ظاهر", exact: true })
      .click();
    const savedBrowserState = await page.evaluate(() => ({
      local: Object.fromEntries(
        Object.keys(localStorage).map((key) => [
          key,
          localStorage.getItem(key),
        ]),
      ),
      session: Object.fromEntries(
        Object.keys(sessionStorage).map((key) => [
          key,
          sessionStorage.getItem(key),
        ]),
      ),
    }));
    await browser.close();
    browser = await launch();
    page = await pageFor(browser, errors);
    await page.addInitScript((state) => {
      if (sessionStorage.getItem("__testAppearanceRestored")) return;
      sessionStorage.setItem("__testAppearanceRestored", "true");
      for (const [key, value] of Object.entries(state.local))
        localStorage.setItem(key, value);
      for (const [key, value] of Object.entries(state.session))
        sessionStorage.setItem(key, value);
    }, savedBrowserState);
    await page.goto(baseURL + "/dashboard", { waitUntil: "networkidle" });
    await page.locator(".dash-quick").waitFor();
    assert.equal(
      await page
        .locator(".workspace-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      rgb("#d0f0ea"),
    );
    assert.deepEqual(await financeSnapshot(page), beforeColors);
    await openAppearanceSettings(page);
    await page
      .getByRole("button", { name: "انتخاب رنگ رنگ سربرگ", exact: true })
      .click();
    await page.getByLabel("کد رنگ رنگ سربرگ", { exact: true }).fill("#ffebcc");
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator(".workspace-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      rgb("#d0f0ea"),
    );
    // Every listed color, including surfaces/text/financial states, has a real picker.
    await openAppearanceSettings(page);
    await page.locator(".appearance-extra-colors summary").click();
    assert.equal(await page.locator(".appearance-color-row").count(), 23);
    assert.equal(
      await page
        .locator(".appearance-color-row .appearance-color-button")
        .count(),
      23,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1908, height: 980 });

    // Brand is changed through the actual settings form, with no mandatory fake contact data.
    const companyName = "شرکت نمونهٔ آزمون برند";
    const logo =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#1176aa"/><text x="16" y="23" text-anchor="middle" fill="white">N</text></svg>',
      );
    await page
      .getByRole("button", { name: "مدیریت سیستم", exact: true })
      .click();
    await page
      .getByRole("button", { name: "مشخصات شرکت", exact: true })
      .click();
    await page.locator("#company-name-input").fill(companyName);
    await page.locator("#company-logo-url").fill(logo);
    await page
      .getByRole("button", {
        name: "ذخیره و اعمال در کل سیستم و فاکتورها",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      ({ prefix, name }) =>
        JSON.parse(localStorage.getItem(prefix + "company")).name === name,
      { prefix: storagePrefix, name: companyName },
    );
    assert.equal(await page.locator("#access-modal-backdrop").count(), 0);
    assert.equal(await page.locator("#access-settings-page").count(), 1);
    assert.equal(await page.title(), companyName);
    assert.equal(
      await page.locator(".workspace-company-pill span").innerText(),
      companyName,
    );
    assert.equal(
      await page.locator(".workspace-sidebar-brand img").getAttribute("src"),
      logo,
    );
    assert.deepEqual(await financeSnapshot(page), beforeColors);

    // Test-only renderer exercises the same production print component, never an app endpoint or production dataset.
    const printSource = await (
      await fetch(baseURL + "/src/components/DocumentPrintModal.tsx")
    ).text();
    const providerURL = printSource.match(
      /from\s+["']([^"']*\/src\/context\/AccountingContext\.tsx[^"']*)["']/,
    )[1];
    const providerSource = await (await fetch(baseURL + providerURL)).text();
    const reactURL = providerSource.match(
      /from\s+["']([^"']*\/react\.js[^"']*)["']/,
    )[1];
    const mainSource = await (await fetch(baseURL + "/src/main.tsx")).text();
    const domURL = mainSource.match(
      /from\s+["']([^"']*react-dom_client\.js[^"']*)["']/,
    )[1];
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"/></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">
      import React from '${reactURL}'; import ReactDOM from '${domURL}';
      import {AccountingProvider,useAccounting} from '${providerURL}'; import {ThemeProvider} from '/src/context/ThemeContext.tsx'; import {DocumentPrintModal} from '/src/components/DocumentPrintModal.tsx';
      import '/src/index.css'; import '/src/styles/workspace.css'; import '/src/styles/appearance.css';
      function Probe(){const ctx=useAccounting(); window.__brandContext=ctx; return React.createElement(DocumentPrintModal,{document:ctx.activePrintDoc,onClose:ctx.closePrintModal});}
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AccountingProvider,null,React.createElement(ThemeProvider,null,React.createElement(Probe))));
    </script></body></html>`;
    await page.route("**/brand-render-check", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: html }),
    );
    await page.goto(baseURL + "/brand-render-check", {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => Boolean(window.__brandContext));
    const invoice = {
      id: "test-invoice",
      invoiceNumber: "1",
      type: "buy",
      date: "1405/07/23",
      partyId: "p",
      partyName: "شخص نمونه",
      currency: "USD",
      warehouseId: "w",
      items: [],
      subtotal: 100,
      totalAmount: 100,
      paidAmount: 0,
      balanceAmount: 100,
      discount: 0,
      paymentStatus: "unpaid",
      createdAt: "2026-10-15T00:00:00Z",
    };
    const transaction = {
      id: "test-tx",
      transactionNumber: "1",
      type: "receive_payment",
      date: "1405/07/23",
      amount: 10,
      currency: "USD",
      description: "نمونه",
      cashRegister: "usd_cash",
      createdAt: "2026-10-15T00:00:00Z",
    };
    const transfer = {
      id: "test-transfer",
      transferNumber: "1",
      date: "1405/07/23",
      productId: "product",
      productName: "کالای نمونه",
      fromWarehouseId: "w",
      toWarehouseId: "w2",
      quantity: 1,
      unit: "ton",
      bagsCount: 20,
      tonsCount: 1,
      createdAt: "2026-10-15T00:00:00Z",
    };
    for (const payload of [
      { type: "invoice", invoice },
      { type: "transaction", transaction },
      { type: "stock_transfer", stockTransfer: transfer },
      { type: "report", title: "گزارش نمونه" },
    ]) {
      await page.evaluate(
        (payload) => window.__brandContext.openPrintModal(payload),
        payload,
      );
      await page.locator("#printable-paper-canvas").waitFor();
      const paperText = await page
        .locator("#printable-paper-canvas")
        .innerText();
      assert.ok(paperText.includes(companyName));
      assert.equal(paperText.includes("واسعی"), false);
      assert.ok(
        (await page.locator("#printable-paper-canvas img").count()) > 0,
      );
      assert.equal(
        await page
          .locator("#printable-paper-canvas img")
          .first()
          .getAttribute("src"),
        logo,
      );
      await page.evaluate(() => window.__brandContext.closePrintModal());
    }
    // Rebranding already-open documents reads the current company context too.
    await page.evaluate(
      (invoice) =>
        window.__brandContext.openPrintModal({ type: "invoice", invoice }),
      invoice,
    );
    await page.evaluate(() =>
      window.__brandContext.updateCompanySettings({ name: "برند دوم نمونه" }),
    );
    await page.waitForFunction(() =>
      document
        .querySelector("#printable-paper-canvas")
        ?.textContent.includes("برند دوم نمونه"),
    );
    // Invoice-owned payments must be undone through the invoice, not posted a second time to a party.
    const createdParty = await page.evaluate(() =>
      window.__brandContext.addParty({
        name: "شخص آزمون پرداخت مرتبط",
        type: "both",
        phone: "",
        balanceUSD: 0,
        balanceAFN: 0,
      }),
    );
    await page.waitForFunction(
      (id) => window.__brandContext.parties.some((party) => party.id === id),
      createdParty.id,
    );
    const linked = await page.evaluate(
      ({ invoice, partyId }) =>
        window.__brandContext.createInvoice({
          ...invoice,
          id: undefined,
          partyId,
          paidAmount: 20,
          balanceAmount: 80,
          paymentStatus: "partial",
          cashRegister: "usd_cash",
          invoiceNumber: "link-test-1",
        }),
      { invoice, partyId: createdParty.id },
    );
    await page.waitForFunction(
      (id) =>
        window.__brandContext.transactions.some((tx) => tx.invoiceId === id),
      linked.id,
    );
    await page.evaluate((id) => {
      const tx = window.__brandContext.transactions.find(
        (tx) => tx.invoiceId === id,
      );
      window.__brandContext.deleteTransaction(tx.id);
    }, linked.id);
    await page.waitForFunction(
      (id) =>
        window.__brandContext.invoices.find((invoice) => invoice.id === id)
          ?.paidAmount === 0,
      linked.id,
    );
    assert.equal(
      await page.evaluate(
        (id) =>
          window.__brandContext.parties.find((party) => party.id === id)
            .balanceUSD,
        createdParty.id,
      ),
      100,
    );
    assert.equal(
      await page.evaluate(
        (id) =>
          window.__brandContext.transactions.filter((tx) => tx.invoiceId === id)
            .length,
        linked.id,
      ),
      0,
    );
    await page.evaluate(
      (id) => window.__brandContext.deleteInvoice(id),
      linked.id,
    );
    await page.waitForFunction(
      (id) =>
        window.__brandContext.parties.find((party) => party.id === id)
          ?.balanceUSD === 0,
      createdParty.id,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: light presets, editable 23-field palettes, custom HEX/color inputs, reset/save/cancel/restoration, finance isolation, mobile, default/custom branding, dashboard link, and live name/logo on invoice/receipt/warehouse transfer/report paper.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  launch,
  pageFor,
  login,
  readData,
  storagePrefix,
  baseURL,
  navigateSidebar,
} = require("./browser-support.cjs");
const shots =
  process.env.CONSIGNMENT_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), "accounting-consignment-smoke");
fs.mkdirSync(shots, { recursive: true });
const prefix = storagePrefix;
const product = {
  id: "test-product",
  code: "201",
  name: "کالای نمونه",
  category: "سیمان",
  baseUnit: "ton",
  bagWeightKg: 50,
  bagsPerTon: 20,
  buyPriceUSD: 10,
  sellPriceUSD: 20,
  buyPriceAFN: 650,
  sellPriceAFN: 1300,
  minStockTons: 0,
};
const invoice = {
  id: "test-consignment-invoice",
  invoiceNumber: "1707",
  type: "sell",
  date: "1405/07/20",
  partyId: "customer-a",
  partyName: "مشتری نمونه",
  currency: "USD",
  warehouseId: "standard",
  consignmentWarehouseId: "csg",
  consignmentWarehouseName: "گدام امانی اول",
  dealType: "consignment",
  dealTypeLabel: "امانی ارسالی",
  items: [
    {
      id: "item",
      productId: product.id,
      productName: product.name,
      warehouseId: "standard",
      unit: "ton",
      quantity: 10,
      tonsCount: 10,
      bagsCount: 400,
      unitPrice: 20,
      totalPrice: 200,
      currency: "USD",
    },
  ],
  subtotal: 200,
  discount: 0,
  totalAmount: 200,
  paidAmount: 0,
  balanceAmount: 200,
  paymentStatus: "unpaid",
  createdAt: "2026-10-12T00:00:00Z",
};
const deposit = (changes = {}) => ({
  id: "csg-inv-test-consignment-invoice-test-product",
  partyId: "customer-a",
  partyName: "مشتری نمونه",
  warehouseId: "csg",
  warehouseName: "گدام امانی اول",
  productId: product.id,
  productName: product.name,
  invoiceId: invoice.id,
  documentNumber: "1707",
  documentType: "invoice",
  type: "deposit",
  date: "1405/07/20",
  issueTime: "10:00",
  quantityTons: 10,
  quantityBags: 400,
  createdAt: "2026-10-12T00:00:00Z",
  ...changes,
});
const fixtures = {
  parties: [
    {
      id: "customer-a",
      name: "مشتری نمونه",
      phone: "",
      type: "customer",
      balanceUSD: -200,
      balanceAFN: 0,
      createdAt: "2026-10-12",
    },
    {
      id: "customer-b",
      name: "مشتری نمونه",
      phone: "",
      type: "customer",
      balanceUSD: 0,
      balanceAFN: 0,
      createdAt: "2026-10-12",
    },
  ],
  products: [product],
  warehouses: [
    { id: "standard", name: "گدام ملکی", type: "standard", location: "" },
    { id: "csg", name: "گدام امانی اول", type: "consignment_in", location: "" },
    {
      id: "csg2",
      name: "گدام امانی دوم",
      type: "consignment_in",
      location: "",
    },
  ],
  stocks: [
    {
      warehouseId: "standard",
      productId: product.id,
      quantityTons: 30,
      quantityBags: 600,
    },
    {
      warehouseId: "csg",
      productId: product.id,
      quantityTons: 13,
      quantityBags: 460,
    },
    {
      warehouseId: "csg2",
      productId: product.id,
      quantityTons: 5,
      quantityBags: 200,
    },
  ],
  invoices: [invoice],
  consignment_movements: [
    deposit(),
    deposit({
      id: "other-owner-deposit",
      partyId: "customer-b",
      documentType: "manual",
      invoiceId: undefined,
      documentNumber: "9",
      quantityTons: 3,
      quantityBags: 60,
    }),
    deposit({
      id: "other-warehouse-deposit",
      warehouseId: "csg2",
      warehouseName: "گدام امانی دوم",
      documentType: "manual",
      invoiceId: undefined,
      documentNumber: "10",
      quantityTons: 5,
      quantityBags: 200,
    }),
  ],
  transfers: [
    {
      id: "trf-inv-test-consignment-invoice-test-product",
      transferNumber: "TRF-1707-1",
      date: "1405/07/20",
      productId: product.id,
      productName: product.name,
      fromWarehouseId: "standard",
      toWarehouseId: "csg",
      quantity: 10,
      unit: "ton",
      tonsCount: 10,
      bagsCount: 400,
      createdAt: "2026-10-12T00:00:00Z",
    },
  ],
  transactions: [],
  cash: {
    usdBalance: 1000,
    afnBalance: 5000,
    exchangeUsdBalance: 0,
    usdToAfnRate: 65,
  },
  cash_accounts: [
    {
      id: "usd_cash",
      name: "صندوق دالری",
      currency: "USD",
      balance: 1000,
      initialBalance: 1000,
    },
  ],
};
const financial = (page) =>
  page.evaluate(
    (prefix) =>
      Object.fromEntries(
        ["parties", "invoices", "transactions", "cash", "cash_accounts"].map(
          (key) => [key, localStorage.getItem(prefix + key)],
        ),
      ),
    prefix,
  );
const openScreen = async (page) => {
  await navigateSidebar(page, 'مدیریت گدام امانی');
  await page.locator(".reference-consignment").waitFor();
};
const ownedOut = (rows) =>
  rows.filter((row) => row.documentType === "delivery_slip");
async function uiSmoke() {
  const browser = await launch();
  const errors = [];
  try {
    const page = await pageFor(browser, errors, { width: 1902, height: 863 });
    await login(page);
    await page.evaluate(
      ({ prefix, fixtures }) => {
        for (const [key, value] of Object.entries(fixtures))
          localStorage.setItem(prefix + key, JSON.stringify(value));
      },
      { prefix, fixtures },
    );
    await page.reload({ waitUntil: "networkidle" });
    await openScreen(page);
    assert.equal(
      await page.locator(".consignment-commitments-table tbody tr").count(),
      3,
    );
    const beforeFinancial = await financial(page);
    await page.screenshot({
      path: path.join(shots, "consignment-screen.png"),
      animations: "disabled",
    });
    await page
      .getByRole("button", {
        name: "صدور حواله خروج مشتری نمونه کالای نمونه #1707",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog", {
        name: "صدور حواله خروج از گدام امانی",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.locator("#csg-owner").inputValue(),
      "id:customer-a",
    );
    assert.equal(await page.locator("#csg-warehouse").inputValue(), "csg");
    assert.match(await page.locator("#csg-unit").innerText(), /25(?:\.0+)? KG/);
    await page.locator("#csg-quantity").fill("12");
    await page
      .getByRole("button", { name: "ثبت حواله خروج", exact: true })
      .click();
    assert.equal(
      ownedOut(await readData(page, "consignment_movements")).length,
      0,
    );
    await page.locator("#csg-unit").selectOption("bag");
    await page.locator("#csg-quantity").fill("100");
    await page
      .getByRole("button", { name: "تقویم حواله خروج", exact: true })
      .click();
    await page.keyboard.press("Escape");
    assert.ok(await page.locator(".consignment-delivery-dialog").isVisible());
    assert.equal(
      ownedOut(await readData(page, "consignment_movements")).length,
      0,
    );
    await page.locator("#csg-driver").fill("موتروان نمونه");
    await page.locator("#csg-plate").fill("TEST-123");
    await page.locator("#csg-destination").fill("مقصد نمونه");
    await page.screenshot({
      path: path.join(shots, "consignment-release.png"),
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "ثبت حواله خروج", exact: true })
      .click();
    await page.waitForFunction(
      (prefix) =>
        JSON.parse(localStorage.getItem(prefix + "consignment_movements")).some(
          (row) => row.documentType === "delivery_slip",
        ),
      prefix,
    );
    let movement = ownedOut(await readData(page, "consignment_movements"))[0];
    assert.equal(movement.quantityTons, 2.5);
    assert.equal(movement.quantityBags, 100);
    assert.equal(movement.invoiceId, invoice.id);
    let stock = await readData(page, "stocks");
    assert.equal(
      stock.find((row) => row.warehouseId === "csg").quantityTons,
      10.5,
    );
    assert.equal(
      stock.find((row) => row.warehouseId === "csg2").quantityTons,
      5,
    );
    assert.deepEqual(await financial(page), beforeFinancial);
    assert.equal(
      (await readData(page, "transfers")).filter(
        (row) => row.id === `trf-csg-out-${movement.id}`,
      ).length,
      1,
    );
    const mainRow = page
      .locator(".consignment-commitments-table tbody tr")
      .filter({ hasText: "#1707" });
    assert.match(await mainRow.innerText(), /7.5/);
    await page
      .getByLabel("نمایش گردش بار مشتری", { exact: true })
      .selectOption("id:customer-b");
    assert.equal(
      await page.locator(".consignment-history-table tbody tr").count(),
      1,
    );
    await page
      .getByLabel("نمایش گردش بار مشتری", { exact: true })
      .selectOption("all");
    await page
      .getByRole("button", {
        name: `حذف گردش امانی #${movement.documentNumber}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "تأیید حذف حواله", exact: true })
      .click();
    await page.waitForFunction(
      (prefix) =>
        !JSON.parse(
          localStorage.getItem(prefix + "consignment_movements"),
        ).some((row) => row.documentType === "delivery_slip"),
      prefix,
    );
    assert.deepEqual(await readData(page, "stocks"), fixtures.stocks);
    assert.equal((await readData(page, "transfers")).length, 1);
    // Saved+printed release uses the actual company brand and cannot post twice.
    await page
      .getByRole("button", {
        name: "صدور حواله خروج مشتری نمونه کالای نمونه #1707",
        exact: true,
      })
      .click();
    await page.locator("#csg-quantity").fill("1.25");
    await page
      .getByRole("button", { name: "ثبت و پیش‌نمایش چاپ", exact: true })
      .click();
    await page.locator("#printable-paper-canvas").waitFor();
    assert.match(
      await page.locator("#printable-paper-canvas").innerText(),
      /شرکت تجارتی برادران نبوی/,
    );
    assert.equal(
      ownedOut(await readData(page, "consignment_movements")).length,
      1,
    );
    await page
      .locator('#document-print-modal-backdrop button[title="بستن فرم (ESC)"]')
      .click();
    await page
      .getByRole("button", { name: "پیش‌نمایش چاپ بار", exact: true })
      .click();
    await page.locator("#printable-paper-canvas").waitFor();
    assert.match(
      await page.locator("#printable-paper-canvas").innerText(),
      /کارتکس/,
    );
    await page
      .locator('#document-print-modal-backdrop button[title="بستن فرم (ESC)"]')
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    await page
      .getByRole("button", {
        name: "صدور حواله خروج مشتری نمونه کالای نمونه #1707",
        exact: true,
      })
      .scrollIntoViewIfNeeded();
    await page
      .getByRole("button", {
        name: "صدور حواله خروج مشتری نمونه کالای نمونه #1707",
        exact: true,
      })
      .click();
    const footer = await page
      .locator(".consignment-delivery-footer")
      .boundingBox();
    assert.ok(footer.y + footer.height <= 844);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      390,
    );
    await page.screenshot({
      path: path.join(shots, "consignment-release-mobile.png"),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: matching consignment tables, identity/warehouse/product/packaging limits, partial releases, calendar isolation, correct stock+transfer reversal, no financial mutation, filtering, brand-aware release/cardex print and mobile.",
    );
  } finally {
    await browser.close();
  }
}
async function contextSmoke() {
  const browser = await launch();
  const errors = [];
  try {
    const page = await pageFor(browser, errors);
    const html = await (await fetch(baseURL + "/dashboard")).text();
    const provider = await (
      await fetch(baseURL + "/src/context/AccountingContext.tsx")
    ).text();
    const entry = await (await fetch(baseURL + "/src/main.tsx")).text();
    const reactURL = provider.match(
      /from\s+["']([^"']*\/react\.js[^"']*)["']/,
    )[1];
    const domURL = entry.match(
      /from\s+["']([^"']*react-dom_client\.js[^"']*)["']/,
    )[1];
    const script = `import React from '${reactURL}';import Dom from '${domURL}';import{AccountingProvider,useAccounting}from'/src/context/AccountingContext.tsx';function Probe(){const ctx=useAccounting();window.__consignmentContext=ctx;return React.createElement('p',null,'ISOLATED CONSIGNMENT TEST');}Dom.createRoot(document.getElementById('root')).render(React.createElement(AccountingProvider,null,React.createElement(Probe)));`;
    const testHTML = html.replace(
      /<script\b[^>]*src="\/src\/main\.tsx[^"]*"[^>]*>\s*<\/script>/,
      `<script type="module">${script}</script>`,
    );
    assert.notEqual(testHTML, html);
    await page.route("**/consignment-context-check", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: testHTML }),
    );
    await page.addInitScript(
      ({ prefix, fixtures }) => {
        for (const [key, value] of Object.entries(fixtures))
          localStorage.setItem(prefix + key, JSON.stringify(value));
      },
      {
        prefix,
        fixtures: {
          ...fixtures,
          invoices: [],
          consignment_movements: [],
          transfers: [],
          parties: [{ ...fixtures.parties[0], balanceUSD: 0 }],
          stocks: [
            {
              warehouseId: "standard",
              productId: product.id,
              quantityTons: 40,
              quantityBags: 1600,
            },
            {
              warehouseId: "csg",
              productId: product.id,
              quantityTons: 0,
              quantityBags: 0,
            },
          ],
        },
      },
    );
    await page.goto(baseURL + "/consignment-context-check", {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => window.__consignmentContext);
    const created = await page.evaluate(
      (invoice) =>
        window.__consignmentContext.createInvoice({
          ...invoice,
          id: undefined,
          invoiceNumber: "201",
        }),
      invoice,
    );
    await page.waitForFunction(
      (id) =>
        window.__consignmentContext.consignmentMovements.some(
          (row) => row.invoiceId === id,
        ),
      created.id,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__consignmentContext.stocks.find(
            (row) => row.warehouseId === "csg",
          ).quantityTons,
      ),
      10,
    );
    await page.evaluate((id) => {
      const ctx = window.__consignmentContext,
        inv = ctx.invoices.find((inv) => inv.id === id);
      ctx.updateInvoice({
        ...inv,
        items: inv.items.map((item) => ({
          ...item,
          quantity: 12,
          tonsCount: 12,
          bagsCount: 480,
        })),
      });
    }, created.id);
    await page.waitForFunction(
      () =>
        window.__consignmentContext.consignmentMovements[0].quantityTons === 12,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__consignmentContext.stocks.find(
            (row) => row.warehouseId === "csg",
          ).quantityTons,
      ),
      12,
    );
    const movement = await page.evaluate(
      (id) =>
        window.__consignmentContext.createConsignmentMovement({
          partyId: "customer-a",
          partyName: "مشتری نمونه",
          warehouseId: "csg",
          warehouseName: "گدام امانی اول",
          productId: "test-product",
          productName: "کالای نمونه",
          invoiceId: id,
          type: "withdrawal",
          documentType: "delivery_slip",
          documentNumber: "CSG-1",
          date: "1405/07/23",
          quantityTons: 2.5,
          quantityBags: 100,
        }),
      created.id,
    );
    await page.waitForFunction(
      () =>
        window.__consignmentContext.getCustomerConsignmentBalances("csg")[0]
          .remainingTons === 9.5,
    );
    const blocked = await page.evaluate((id) => {
      try {
        const ctx = window.__consignmentContext,
          inv = ctx.invoices.find((inv) => inv.id === id);
        ctx.updateInvoice({
          ...inv,
          items: inv.items.map((item) => ({
            ...item,
            quantity: 1,
            tonsCount: 1,
            bagsCount: 40,
          })),
        });
        return false;
      } catch {
        return true;
      }
    }, created.id);
    assert.equal(blocked, true);
    await page.evaluate(
      (id) => window.__consignmentContext.deleteInvoice(id),
      created.id,
    );
    assert.equal(
      await page.evaluate(() => window.__consignmentContext.invoices.length),
      1,
    );
    await page.evaluate(
      ({ id, movementId }) => {
        const ctx = window.__consignmentContext,
          inv = ctx.invoices.find((inv) => inv.id === id);
        ctx.updateInvoice({
          ...inv,
          items: inv.items.map((item) => ({
            ...item,
            quantity: 15,
            tonsCount: 15,
            bagsCount: 600,
          })),
        });
      },
      { id: created.id, movementId: movement.id },
    );
    await page.waitForFunction(
      (id) =>
        window.__consignmentContext.consignmentMovements.some(
          (row) => row.id === id,
        ),
      movement.id,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__consignmentContext.getCustomerConsignmentBalances("csg")[0]
            .remainingTons,
      ),
      12.5,
    );
    await page.evaluate(
      (id) =>
        window.__consignmentContext.updateConsignmentMovement(id, {
          quantityTons: 3,
          quantityBags: 120,
        }),
      movement.id,
    );
    await page.waitForFunction(
      () =>
        window.__consignmentContext.stocks.find(
          (row) => row.warehouseId === "csg",
        ).quantityTons === 12,
    );
    assert.equal(
      await page.evaluate(
        (id) =>
          window.__consignmentContext.transfers.find(
            (row) => row.id === "trf-csg-out-" + id,
          ).tonsCount,
        movement.id,
      ),
      3,
    );
    await page.evaluate(
      (id) => window.__consignmentContext.deleteConsignmentMovement(id),
      movement.id,
    );
    await page.waitForFunction(
      () =>
        window.__consignmentContext.getCustomerConsignmentBalances("csg")[0]
          .remainingTons === 15,
    );
    await page.evaluate(
      (id) => window.__consignmentContext.deleteInvoice(id),
      created.id,
    );
    await page.waitForFunction(
      () => window.__consignmentContext.invoices.length === 0,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__consignmentContext.stocks.find(
            (row) => row.warehouseId === "standard",
          ).quantityTons,
      ),
      40,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.__consignmentContext.stocks.find(
            (row) => row.warehouseId === "csg",
          ).quantityTons,
      ),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => window.__consignmentContext.parties[0].balanceUSD,
      ),
      0,
    );
    assert.equal(
      await page.evaluate(() => window.__consignmentContext.transfers.length),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => window.__consignmentContext.consignmentMovements.length,
      ),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: actual Context invoice consignment deposit/create/update, partial release, invoice guards, release update+transfer synchronization, deletion and exact stock/party reversal.",
    );
  } finally {
    await browser.close();
  }
}
(async () => {
  const mode = process.env.CONSIGNMENT_CHECK || "all";
  if (mode === "all" || mode === "ui") await uiSmoke();
  if (mode === "all" || mode === "context") await contextSmoke();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

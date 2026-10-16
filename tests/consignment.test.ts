import test from "node:test";
import assert from "node:assert/strict";
import type {
  ConsignmentMovement,
  Invoice,
  Product,
  StockInventory,
  Warehouse,
} from "../src/types";
import {
  consignmentHoldings,
  consignmentLots,
  consignmentQuantity,
  consignmentRunningRows,
  consignmentStockPost,
  consignmentTransfer,
  duplicateConsignmentNumber,
  isInvoiceConsignmentMovement,
  nextConsignmentNumber,
  validateConsignmentMovement,
} from "../src/utils/consignment";

const warehouse: Warehouse = {
  id: "csg",
  name: "گدام امانی نمونه",
  type: "consignment_in",
  location: "",
};
const other: Warehouse = { ...warehouse, id: "csg2" };
const product: Product = {
  id: "p",
  name: "کالای نمونه",
  code: "1",
  category: "",
  bagWeightKg: 50,
  bagsPerTon: 20,
  buyPriceAFN: 0,
  buyPriceUSD: 0,
  sellPriceAFN: 0,
  sellPriceUSD: 0,
  minStockTons: 0,
};
const m = (values: Partial<ConsignmentMovement> = {}): ConsignmentMovement => ({
  id: "d",
  partyId: "customer-a",
  partyName: "نام مشترک",
  warehouseId: "csg",
  productId: "p",
  productName: "کالای نمونه",
  date: "1405/07/20",
  issueTime: "10:00",
  type: "deposit",
  documentType: "manual",
  documentNumber: "1",
  quantityTons: 10,
  quantityBags: 200,
  createdAt: "2026-10-12T00:00:00Z",
  ...values,
});
const out = m({
  id: "w",
  date: "1405/07/23",
  type: "withdrawal",
  documentType: "delivery_slip",
  documentNumber: "CSG-001",
  quantityTons: 2.5,
  quantityBags: 50,
  createdAt: "2026-10-15T00:00:00Z",
});
const inventory: StockInventory[] = [
  { warehouseId: "csg", productId: "p", quantityTons: 10, quantityBags: 200 },
  {
    warehouseId: "standard",
    productId: "p",
    quantityTons: 30,
    quantityBags: 600,
  },
];
const invoice = (id = "inv", quantity = 10): Invoice => ({
  id,
  invoiceNumber: id,
  type: "sell",
  date: "1405/07/20",
  partyId: "customer-a",
  partyName: "نام مشترک",
  currency: "USD",
  warehouseId: "standard",
  consignmentWarehouseId: "csg",
  dealType: "consignment",
  items: [
    {
      id: "i",
      productId: "p",
      productName: "کالای نمونه",
      warehouseId: "standard",
      quantity,
      unit: "ton",
      tonsCount: quantity,
      bagsCount: quantity * 20,
      unitPrice: 10,
      currency: "USD",
      totalPrice: quantity * 10,
    },
  ],
  subtotal: quantity * 10,
  discount: 0,
  totalAmount: quantity * 10,
  paidAmount: 0,
  balanceAmount: quantity * 10,
  paymentStatus: "unpaid",
  createdAt: "2026-10-12T00:00:00Z",
});

test("newest-first movements retain the actual remainder instead of clamping a withdrawal before its deposit", () => {
  assert.equal(consignmentHoldings([out, m()])[0].remainingTons, 7.5);
  assert.deepEqual(
    consignmentHoldings([out, m()]),
    consignmentHoldings([m(), out]),
  );
});
test("equal party names with different IDs never share their cargo", () => {
  const rows = consignmentHoldings([
    m(),
    out,
    m({
      id: "other",
      partyId: "customer-b",
      quantityTons: 4,
      quantityBags: 80,
    }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(
    rows.find((row) => row.partyId === "customer-b")?.remainingTons,
    4,
  );
});
test("one owner/product in different warehouses remains isolated", () => {
  const rows = consignmentHoldings([
    m(),
    out,
    m({ id: "other", warehouseId: "csg2", quantityTons: 8, quantityBags: 160 }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(consignmentHoldings([m(), out], "csg2").length, 0);
});
test("different products keep independent running balances", () => {
  const rows = consignmentRunningRows([
    out,
    m({ id: "second", productId: "p2", quantityTons: 20, quantityBags: 800 }),
    m(),
  ]);
  assert.equal(rows.find((row) => row.id === "w")?.runningTons, 7.5);
  assert.equal(rows.find((row) => row.id === "second")?.runningTons, 20);
});
test("history is chronological and immutable, not newest-first", () => {
  const values = [out, m()];
  const before = structuredClone(values);
  assert.deepEqual(
    consignmentRunningRows(values).map((row) => row.id),
    ["d", "w"],
  );
  assert.deepEqual(values, before);
});
test("historical overdelivery stays negative and visible for reconciliation", () => {
  const excess = { ...out, quantityTons: 12, quantityBags: 240 };
  assert.equal(consignmentHoldings([excess, m()])[0].remainingTons, -2);
  assert.equal(consignmentRunningRows([excess, m()]).at(-1)?.runningBags, -40);
});
test("return movements reduce an existing customer deposit", () =>
  assert.equal(
    consignmentHoldings([m(), { ...out, type: "return" }])[0].remainingTons,
    7.5,
  ));
test("new outgoing stock posting and undo are precise and affect only the chosen warehouse/product", () => {
  const posted = consignmentStockPost(inventory, out);
  assert.equal(posted[0].quantityTons, 7.5);
  assert.deepEqual(posted[1], inventory[1]);
  assert.deepEqual(consignmentStockPost(posted, out, true), inventory);
  assert.equal(inventory[0].quantityTons, 10);
});
test("reversing an absent outgoing stock row creates its restored quantity rather than losing cargo", () =>
  assert.equal(consignmentStockPost([], out, true)[0].quantityTons, 2.5));
test("manual deposit update uses inverse-old / post-new without clamping", () => {
  const old = m();
  const next = { ...old, quantityTons: 12, quantityBags: 240 };
  const result = consignmentStockPost(
    consignmentStockPost(inventory, old, true),
    next,
  );
  assert.equal(result[0].quantityTons, 12);
  assert.deepEqual(consignmentStockPost(result, next, true)[0], {
    ...inventory[0],
    quantityTons: 0,
    quantityBags: 0,
  });
});
test("six-decimal quantities survive posting and reversal", () => {
  const fraction = { ...out, quantityTons: 0.000001, quantityBags: 0.00002 };
  assert.equal(
    consignmentStockPost(inventory, fraction)[0].quantityTons,
    9.999999,
  );
  assert.deepEqual(
    consignmentStockPost(
      consignmentStockPost(inventory, fraction),
      fraction,
      true,
    ),
    inventory,
  );
});
test("bag conversion uses the product/lot packaging instead of a hard-coded twenty bags", () => {
  assert.deepEqual(consignmentQuantity("۱۰۰", "bag", 25), {
    tons: 2.5,
    bags: 100,
  });
  assert.deepEqual(consignmentQuantity("2.5", "ton", 50), {
    tons: 2.5,
    bags: 50,
  });
});
test("blank, negative, non-finite and zero quantities/packaging are rejected", () => {
  for (const input of ["", "0", "-1", "Infinity", "abc"])
    assert.equal(consignmentQuantity(input, "ton", 50), null);
  assert.equal(consignmentQuantity("1", "ton", 0), null);
});
test("delivery number preview is pure, ignores invoice numbers and recognizes canonical duplicates", () => {
  const data = [m({ documentType: "invoice", documentNumber: "1707" }), out];
  assert.equal(nextConsignmentNumber(data), "CSG-002");
  assert.equal(nextConsignmentNumber(data), "CSG-002");
  assert.equal(duplicateConsignmentNumber(data, "csg-۰۰۱"), true);
  assert.equal(duplicateConsignmentNumber(data, "1", "w"), false);
});
test("validation limits a withdrawal to the exact warehouse and owner", () => {
  assert.equal(
    validateConsignmentMovement(
      { ...out, documentNumber: "2" },
      [m()],
      inventory,
      [warehouse],
      [product],
    ),
    null,
  );
  assert.match(
    validateConsignmentMovement(
      { ...out, documentNumber: "2", warehouseId: "csg2" },
      [m()],
      inventory,
      [warehouse, other],
      [product],
    )!,
    /مانده/,
  );
  assert.match(
    validateConsignmentMovement(
      { ...out, documentNumber: "2", partyId: "customer-b" },
      [m()],
      inventory,
      [warehouse],
      [product],
    )!,
    /مانده/,
  );
});
test("validation checks physical stock independently from a customer entitlement", () => {
  assert.match(
    validateConsignmentMovement(
      { ...out, documentNumber: "2" },
      [m()],
      [{ ...inventory[0], quantityTons: 1, quantityBags: 20 }],
      [warehouse],
      [product],
    )!,
    /فیزیکی/,
  );
});
test("invalid dates/products/warehouse/number never get a valid release", () => {
  assert.match(
    validateConsignmentMovement(
      { ...out, date: "1405/13/01" },
      [m()],
      inventory,
      [warehouse],
      [product],
    )!,
    /تاریخ/,
  );
  assert.match(
    validateConsignmentMovement(
      { ...out, productId: "missing" },
      [m()],
      inventory,
      [warehouse],
      [product],
    )!,
    /کالای/,
  );
  assert.match(
    validateConsignmentMovement(
      { ...out, warehouseId: "standard" },
      [m()],
      inventory,
      [warehouse],
      [product],
    )!,
    /گدام/,
  );
});
test("linked invoice deposits cannot be mistaken for a manual movement", () => {
  assert.equal(
    isInvoiceConsignmentMovement(
      m({ id: "csg-inv-inv-p", documentType: "invoice" }),
    ),
    true,
  );
  assert.equal(isInvoiceConsignmentMovement(out), false);
});
test("invoice-specific and old unlinked releases use distinct deterministic allocations", () => {
  const one = m({
    id: "csg-inv-inv-p",
    documentType: "invoice",
    invoiceId: "inv",
  });
  const two = m({
    id: "csg-inv-two-p",
    documentType: "invoice",
    invoiceId: "two",
    documentNumber: "two",
    quantityTons: 5,
    quantityBags: 100,
    date: "1405/07/21",
  });
  const rows = consignmentLots([two, out, one], [invoice(), invoice("two", 5)]);
  assert.equal(rows.find((row) => row.invoiceId === "inv")?.remainingTons, 7.5);
  assert.equal(rows.find((row) => row.invoiceId === "two")?.remainingTons, 5);
  const explicit = consignmentLots(
    [two, { ...out, invoiceId: "two" }, one],
    [invoice(), invoice("two", 5)],
  );
  assert.equal(
    explicit.find((row) => row.invoiceId === "inv")?.remainingTons,
    10,
  );
  assert.equal(
    explicit.find((row) => row.invoiceId === "two")?.remainingTons,
    2.5,
  );
});
test("old auto-deposit IDs resolve their invoice without requiring a destructive migration", () => {
  const rows = consignmentLots(
    [m({ id: "csg-inv-inv-p", documentType: "invoice" }), out],
    [invoice()],
  );
  assert.equal(rows[0].invoiceId, "inv");
  assert.equal(rows[0].remainingTons, 7.5);
});
test("invoice return consumes a sale lot without being reported as customer delivery", () => {
  const returned = { ...invoice("return", 2.5), type: "return_sell" as const };
  const rows = consignmentLots(
    [
      m({ id: "csg-inv-inv-p", invoiceId: "inv", documentType: "invoice" }),
      { ...out, type: "return", invoiceId: "return", documentType: "invoice" },
    ],
    [invoice(), returned],
  );
  assert.equal(rows[0].remainingTons, 7.5);
  assert.equal(rows[0].returnedTons, 2.5);
  assert.equal(rows[0].deliveredTons, 0);
});
test("generated physical transfer keeps the same document identity and quantity", () => {
  const transfer = consignmentTransfer(out);
  assert.equal(transfer.id, "trf-csg-out-w");
  assert.equal(transfer.tonsCount, 2.5);
  assert.equal(transfer.bagsCount, 50);
  assert.equal(transfer.fromWarehouseId, "csg");
  assert.equal(transfer.toWarehouseId, "customer-release");
});

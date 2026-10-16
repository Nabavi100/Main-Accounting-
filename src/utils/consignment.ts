import type {
  ConsignmentMovement,
  Invoice,
  Product,
  StockInventory,
  StockTransfer,
  Unit,
  Warehouse,
} from "../types";
import { addInvoiceLedgerAmount } from "./invoiceLedger";
import { normalizeDashboardSearch, parseDashboardDate } from "./dashboard";
import { normalizeTradeInvoiceNumber, parseTradeNumber } from "./tradeInvoices";

export const formatConsignmentQuantity = (value: number): string =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value)
    : "—";
export const roundConsignment = (value: number): number =>
  addInvoiceLedgerAmount(0, value);
export const consignmentSign = (type: ConsignmentMovement["type"]): 1 | -1 =>
  type === "deposit" ? 1 : -1;
export const consignmentOwnerKey = (
  movement: Pick<ConsignmentMovement, "partyId" | "partyName">,
): string =>
  movement.partyId ? `id:${movement.partyId}` : `name:${movement.partyName}`;
export const consignmentScopeKey = (
  movement: Pick<
    ConsignmentMovement,
    "partyId" | "partyName" | "warehouseId" | "productId"
  >,
): string =>
  JSON.stringify([
    consignmentOwnerKey(movement),
    movement.warehouseId,
    movement.productId,
  ]);
export const isConsignmentWarehouse = (warehouse: Warehouse): boolean =>
  warehouse.type !== "standard";
export const isInvoiceConsignmentMovement = (
  movement: ConsignmentMovement,
): boolean =>
  movement.documentType === "invoice" &&
  (Boolean(movement.invoiceId) || movement.id.startsWith("csg-inv-"));
export const consignmentMovementDate = (
  movement: ConsignmentMovement,
): number =>
  parseDashboardDate(movement.date)?.getTime() ||
  Date.parse(movement.createdAt) ||
  0;
export const chronologicalConsignmentMovements = (
  movements: ConsignmentMovement[],
): ConsignmentMovement[] =>
  [...movements].sort(
    (a, b) =>
      consignmentMovementDate(a) - consignmentMovementDate(b) ||
      (a.issueTime || "").localeCompare(b.issueTime || "") ||
      (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) ||
      a.id.localeCompare(b.id),
  );

export interface ConsignmentHolding {
  key: string;
  partyId: string;
  partyName: string;
  partyPhone?: string;
  warehouseId: string;
  warehouseName?: string;
  productId: string;
  productName: string;
  totalInTons: number;
  totalInBags: number;
  totalOutTons: number;
  totalOutBags: number;
  remainingTons: number;
  remainingBags: number;
}
/** Summation is order-independent. Never clamp a newest-first withdrawal to zero before adding its deposit. */
export const consignmentHoldings = (
  movements: ConsignmentMovement[],
  warehouseId?: string,
): ConsignmentHolding[] => {
  const map = new Map<string, ConsignmentHolding>();
  for (const movement of movements) {
    if (warehouseId && movement.warehouseId !== warehouseId) continue;
    const key = consignmentScopeKey(movement);
    const row = map.get(key) || {
      key,
      partyId: movement.partyId,
      partyName: movement.partyName,
      partyPhone: movement.partyPhone,
      warehouseId: movement.warehouseId,
      warehouseName: movement.warehouseName,
      productId: movement.productId,
      productName: movement.productName,
      totalInTons: 0,
      totalInBags: 0,
      totalOutTons: 0,
      totalOutBags: 0,
      remainingTons: 0,
      remainingBags: 0,
    };
    const incoming = movement.type === "deposit";
    row.totalInTons = roundConsignment(
      row.totalInTons + (incoming ? movement.quantityTons : 0),
    );
    row.totalInBags = roundConsignment(
      row.totalInBags + (incoming ? movement.quantityBags : 0),
    );
    row.totalOutTons = roundConsignment(
      row.totalOutTons + (!incoming ? movement.quantityTons : 0),
    );
    row.totalOutBags = roundConsignment(
      row.totalOutBags + (!incoming ? movement.quantityBags : 0),
    );
    row.remainingTons = roundConsignment(row.totalInTons - row.totalOutTons);
    row.remainingBags = roundConsignment(row.totalInBags - row.totalOutBags);
    map.set(key, row);
  }
  return [...map.values()];
};
export const consignmentRunningRows = (movements: ConsignmentMovement[]) => {
  const map = new Map<string, { tons: number; bags: number }>();
  return chronologicalConsignmentMovements(movements).map((movement) => {
    const key = consignmentScopeKey(movement),
      before = map.get(key) || { tons: 0, bags: 0 };
    const after = {
      tons: roundConsignment(
        before.tons + consignmentSign(movement.type) * movement.quantityTons,
      ),
      bags: roundConsignment(
        before.bags + consignmentSign(movement.type) * movement.quantityBags,
      ),
    };
    map.set(key, after);
    return { ...movement, runningTons: after.tons, runningBags: after.bags };
  });
};
export const consignmentInvoiceId = (
  movement: ConsignmentMovement,
  invoices: Invoice[],
): string | undefined => {
  if (movement.invoiceId) return movement.invoiceId;
  return invoices.find((invoice) =>
    invoice.items.some(
      (item, index) =>
        movement.id === `csg-inv-${invoice.id}-${item.productId || index}`,
    ),
  )?.id;
};
export interface ConsignmentLot extends ConsignmentHolding {
  depositIds: string[];
  invoiceId?: string;
  invoiceNumber: string;
  date: string;
  unit: Unit;
  bagWeightKg?: number;
  soldTons: number;
  soldBags: number;
  deliveredTons: number;
  deliveredBags: number;
  returnedTons: number;
  returnedBags: number;
  dealLabel: string;
}
/** Explicit invoice links take precedence; old unlinked releases are allocated FIFO within the exact owner/warehouse/product scope. No records are rewritten. */
export const consignmentLots = (
  movements: ConsignmentMovement[],
  invoices: Invoice[],
): ConsignmentLot[] => {
  const rows = new Map<string, ConsignmentLot>();
  const ordered = chronologicalConsignmentMovements(movements);
  for (const movement of ordered.filter(
    (movement) => movement.type === "deposit",
  )) {
    const invoiceId = consignmentInvoiceId(movement, invoices),
      invoice = invoices.find((invoice) => invoice.id === invoiceId);
    const key = JSON.stringify([
      consignmentScopeKey(movement),
      invoiceId || movement.documentNumber || movement.id,
    ]);
    const item = invoice?.items.find(
      (item) => item.productId === movement.productId,
    );
    const existing = rows.get(key);
    const row = existing || {
      key,
      partyId: movement.partyId,
      partyName: movement.partyName,
      partyPhone: movement.partyPhone,
      warehouseId: movement.warehouseId,
      warehouseName: movement.warehouseName,
      productId: movement.productId,
      productName: movement.productName,
      depositIds: [],
      invoiceId,
      invoiceNumber: invoice?.invoiceNumber || movement.documentNumber,
      date: invoice?.date || movement.date,
      unit: movement.unit || item?.unit || "ton",
      bagWeightKg:
        movement.bagWeightKg ||
        (movement.quantityBags > 0 && movement.quantityTons > 0
          ? (movement.quantityTons * 1000) / movement.quantityBags
          : undefined),
      dealLabel:
        invoice?.dealTypeLabel ||
        (invoice?.dealType === "pre_order" ? "پیش‌فروش" : "امانی ارسالی"),
      soldTons: 0,
      soldBags: 0,
      deliveredTons: 0,
      deliveredBags: 0,
      returnedTons: 0,
      returnedBags: 0,
      totalInTons: 0,
      totalInBags: 0,
      totalOutTons: 0,
      totalOutBags: 0,
      remainingTons: 0,
      remainingBags: 0,
    };
    row.depositIds.push(movement.id);
    row.soldTons = row.totalInTons = roundConsignment(
      row.soldTons + movement.quantityTons,
    );
    row.soldBags = row.totalInBags = roundConsignment(
      row.soldBags + movement.quantityBags,
    );
    row.remainingTons = row.soldTons;
    row.remainingBags = row.soldBags;
    rows.set(key, row);
  }
  const lots = [...rows.values()];
  for (const movement of ordered.filter(
    (movement) => movement.type !== "deposit",
  )) {
    const matching = lots.filter(
      (lot) =>
        consignmentScopeKey(lot) === consignmentScopeKey(movement) &&
        (!movement.invoiceId ||
          (movement.documentType === "invoice" &&
            invoices.find((invoice) => invoice.id === movement.invoiceId)
              ?.type === "return_sell") ||
          lot.invoiceId === movement.invoiceId),
    );
    let tons = movement.quantityTons,
      bags = movement.quantityBags;
    for (const lot of matching) {
      const takenTons = Math.min(
        Math.max(0, lot.remainingTons),
        Math.max(0, tons),
      );
      const takenBags = Math.min(
        Math.max(0, lot.remainingBags),
        Math.max(0, bags),
      );
      lot.remainingTons = roundConsignment(lot.remainingTons - takenTons);
      lot.remainingBags = roundConsignment(lot.remainingBags - takenBags);
      lot.totalOutTons = roundConsignment(lot.totalOutTons + takenTons);
      lot.totalOutBags = roundConsignment(lot.totalOutBags + takenBags);
      if (movement.type === "return") {
        lot.returnedTons = roundConsignment(lot.returnedTons + takenTons);
        lot.returnedBags = roundConsignment(lot.returnedBags + takenBags);
      } else {
        lot.deliveredTons = roundConsignment(lot.deliveredTons + takenTons);
        lot.deliveredBags = roundConsignment(lot.deliveredBags + takenBags);
      }
      tons = roundConsignment(tons - takenTons);
      bags = roundConsignment(bags - takenBags);
    }
  }
  return lots;
};
export const consignmentBalanceFor = (
  movements: ConsignmentMovement[],
  scope: Pick<
    ConsignmentMovement,
    "partyId" | "partyName" | "warehouseId" | "productId"
  >,
) =>
  consignmentHoldings(movements).find(
    (row) => row.key === consignmentScopeKey(scope),
  );
export const consignmentStockPost = (
  stocks: StockInventory[],
  movement: ConsignmentMovement,
  reverse = false,
): StockInventory[] => {
  const sign = consignmentSign(movement.type) * (reverse ? -1 : 1);
  const deltaTons = movement.quantityTons * sign,
    deltaBags = movement.quantityBags * sign;
  const found = stocks.some(
    (stock) =>
      stock.warehouseId === movement.warehouseId &&
      stock.productId === movement.productId,
  );
  const updated = stocks.map((stock) =>
    stock.warehouseId === movement.warehouseId &&
    stock.productId === movement.productId
      ? {
          ...stock,
          quantityTons: roundConsignment(stock.quantityTons + deltaTons),
          quantityBags: roundConsignment(stock.quantityBags + deltaBags),
        }
      : stock,
  );
  return found
    ? updated
    : [
        ...updated,
        {
          warehouseId: movement.warehouseId,
          productId: movement.productId,
          quantityTons: roundConsignment(deltaTons),
          quantityBags: roundConsignment(deltaBags),
        },
      ];
};
const canonicalDocument = (value: string) =>
  normalizeDashboardSearch(normalizeTradeInvoiceNumber(value))
    .replace(/^csg[-_]?/, "")
    .replace(/^0+(?=\d)/, "");
export const duplicateConsignmentNumber = (
  movements: ConsignmentMovement[],
  number: string,
  excludingId?: string,
): boolean =>
  movements.some(
    (movement) =>
      movement.id !== excludingId &&
      movement.documentType !== "invoice" &&
      canonicalDocument(movement.documentNumber) === canonicalDocument(number),
  );
export const nextConsignmentNumber = (
  movements: ConsignmentMovement[],
): string => {
  let max = 0;
  for (const movement of movements.filter(
    (movement) => movement.documentType !== "invoice",
  )) {
    const number = normalizeDashboardSearch(movement.documentNumber).match(
      /\d+$/,
    );
    if (number && Number.isSafeInteger(Number(number[0])))
      max = Math.max(max, Number(number[0]));
  }
  return `CSG-${String(max + 1).padStart(3, "0")}`;
};
export const consignmentQuantity = (
  value: string,
  unit: Unit,
  bagWeightKg: number,
) => {
  const quantity = parseTradeNumber(value);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(bagWeightKg) ||
    bagWeightKg <= 0
  )
    return null;
  const tons = unit === "ton" ? quantity : (quantity * bagWeightKg) / 1000;
  const bags = unit === "bag" ? quantity : (quantity * 1000) / bagWeightKg;
  return { tons: roundConsignment(tons), bags: roundConsignment(bags) };
};
export const validateConsignmentMovement = (
  movement: Omit<ConsignmentMovement, "id" | "createdAt">,
  movements: ConsignmentMovement[],
  stocks: StockInventory[],
  warehouses: Warehouse[],
  products: Product[],
  excludingId?: string,
): string | null => {
  if (!movement.partyId || !movement.partyName.trim())
    return "مشتری صاحب بار را انتخاب کنید.";
  if (
    !warehouses.some(
      (warehouse) =>
        warehouse.id === movement.warehouseId &&
        isConsignmentWarehouse(warehouse),
    )
  )
    return "گدام امانی معتبر را انتخاب کنید.";
  if (!products.some((product) => product.id === movement.productId))
    return "کالای معتبر را انتخاب کنید.";
  if (!parseDashboardDate(movement.date)) return "تاریخ تحویل معتبر نیست.";
  if (
    !movement.documentNumber.trim() ||
    duplicateConsignmentNumber(movements, movement.documentNumber, excludingId)
  )
    return "شمارهٔ حواله تکراری یا خالی است.";
  if (
    !Number.isFinite(movement.quantityTons) ||
    !Number.isFinite(movement.quantityBags) ||
    movement.quantityTons <= 0 ||
    movement.quantityBags <= 0
  )
    return "مقدار تحویل باید عدد معتبر و بیشتر از صفر باشد.";
  if (movement.type !== "deposit") {
    const before = consignmentBalanceFor(
      movements.filter((row) => row.id !== excludingId),
      movement,
    );
    const physical = stocks.find(
      (stock) =>
        stock.warehouseId === movement.warehouseId &&
        stock.productId === movement.productId,
    );
    if (
      !before ||
      movement.quantityTons > before.remainingTons + 0.000001 ||
      movement.quantityBags > before.remainingBags + 0.000001
    )
      return "مقدار تحویل از ماندهٔ همین مشتری، کالا و گدام بیشتر است.";
    if (
      !physical ||
      movement.quantityTons > physical.quantityTons + 0.000001 ||
      movement.quantityBags > physical.quantityBags + 0.000001
    )
      return "موجودی فیزیکی همین گدام برای تحویل کافی نیست.";
  }
  return null;
};
export const consignmentTransfer = (
  movement: ConsignmentMovement,
): StockTransfer => ({
  id: `trf-csg-out-${movement.id}`,
  transferNumber: `TRF-${movement.documentNumber}`,
  date: movement.date,
  issueTime: movement.issueTime,
  productId: movement.productId,
  productName: movement.productName,
  fromWarehouseId: movement.warehouseId,
  fromWarehouseName: movement.warehouseName || "گدام امانی",
  toWarehouseId: "customer-release",
  toWarehouseName: `تحویل به مشتری (${movement.partyName})`,
  quantity: movement.quantityTons,
  unit: "ton",
  tonsCount: movement.quantityTons,
  bagsCount: movement.quantityBags,
  driverName: movement.driverName,
  carPlate: movement.carPlate,
  description: `حواله خروج کالا؛ مشتری: ${movement.partyName}؛ ${movement.productName}؛ سند #${movement.documentNumber}`,
  notes: movement.notes,
  createdAt: movement.createdAt,
});

import { usePageReport } from './PageActionsToolbar';
import { tableReport } from '../utils/reportData';
import React, { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  FileText,
  History,
  PackageOpen,
  Printer,
  Trash2,
  Truck,
  UserCircle,
  Users,
} from "lucide-react";
import { useAccounting } from "../context/AccountingContext";
import type { ConsignmentMovement, Product, Unit } from "../types";
import { WorkspaceDialog } from "./WorkspaceShell";
import { ConsignmentDeliveryModal } from "./ConsignmentDeliveryModal";
import { formatDashboardAmount } from "../utils/dashboard";
import { tradeShamsiDate } from "../utils/tradeInvoices";
import {
  consignmentHoldings,
  formatConsignmentQuantity,
  consignmentInvoiceId,
  consignmentLots,
  consignmentOwnerKey,
  consignmentRunningRows,
  isInvoiceConsignmentMovement,
} from "../utils/consignment";

interface Props {
  onBackToInvoices: () => void;
  onManageWarehouses: () => void;
  onViewInvoice?: (id: string) => void;
}
const Quantity: React.FC<{
  tons: number;
  bags: number;
  unit: Unit;
  weight?: number;
  tone?: "remaining" | "incoming" | "outgoing";
}> = ({ tons, bags, unit, weight, tone }) => (
  <span className={`consignment-quantity ${tone ? `is-${tone}` : ""}`}>
    <bdi>{formatConsignmentQuantity(unit === "bag" ? bags : tons)}</bdi>{" "}
    {unit === "bag"
      ? `کیسه${weight ? ` (${formatConsignmentQuantity(weight)}KG)` : ""}`
      : "تن (KG 1000)"}
  </span>
);
export const ReferenceConsignmentView: React.FC<Props> = ({
  onBackToInvoices,
  onManageWarehouses,
  onViewInvoice,
}) => {
  const {
    invoices,
    products,
    parties,
    warehouses,
    consignmentMovements,
    deleteConsignmentMovement,
    openPrintModal,
  } = useAccounting();
  const [query, setQuery] = useState("");
  const matchesQuery = (text: string) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase());
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [delivery, setDelivery] = useState<{
    partyId?: string;
    partyName?: string;
    productId?: string;
    warehouseId?: string;
    invoiceId?: string;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [productProfile, setProductProfile] = useState<Product | null>(null);
  const [actionError, setActionError] = useState("");
  const historyRef = useRef<HTMLElement>(null);
  const lots = useMemo(
    () => consignmentLots(consignmentMovements, invoices),
    [consignmentMovements, invoices],
  );
  const active = lots.filter(
    (lot) => (lot.remainingTons > 0.000001 || lot.remainingBags > 0.000001) && matchesQuery(`${lot.partyName} ${lot.productName} ${lot.invoiceNumber} ${lot.warehouseName}`),
  );
  const runningRows = useMemo(
    () => consignmentRunningRows(consignmentMovements),
    [consignmentMovements],
  );
  const owners = [
    ...new Map(
      consignmentMovements.map((movement) => [
        consignmentOwnerKey(movement),
        {
          key: consignmentOwnerKey(movement),
          id: movement.partyId,
          name: movement.partyName,
        },
      ]),
    ).values(),
  ];
  const history = runningRows.filter(
    (movement) =>
      (ownerFilter === "all" ||
        consignmentOwnerKey(movement) === ownerFilter) &&
      (typeFilter === "all" || movement.type === typeFilter) &&
      (warehouseFilter === "all" || movement.warehouseId === warehouseFilter) && matchesQuery(`${movement.partyName} ${movement.productName} ${movement.documentNumber} ${movement.warehouseName} ${movement.notes || ""}`),
  );
  const negativeHoldings = consignmentHoldings(consignmentMovements).filter(
    (row) => row.remainingTons < -0.000001 || row.remainingBags < -0.000001,
  );
  const selectedOwner = owners.find((owner) => owner.key === ownerFilter);
  const profile = parties.find((party) => party.id === profileId);
  const toPrintRows = history.map((row) => ({
    ...row,
    remainingTonsAfter: row.runningTons,
    remainingBagsAfter: row.runningBags,
  }));
  const printHistory = () =>
    openPrintModal({
      type: "customer_consignment_cardex",
      party: parties.find((party) => party.id === selectedOwner?.id),
      partyName: selectedOwner?.name,
      customerName: selectedOwner?.name || "همه مشتریان امانی",
      consignmentMovements: toPrintRows,
      balanceByScope: true,
    });
  const getUnit = (movement: ConsignmentMovement) =>
    movement.unit ||
    invoices
      .find(
        (invoice) => invoice.id === consignmentInvoiceId(movement, invoices),
      )
      ?.items.find((item) => item.productId === movement.productId)?.unit ||
    (products
      .find((product) => product.id === movement.productId)
      ?.baseUnit?.includes("کیسه")
      ? "bag"
      : "ton");
  const getWeight = (movement: ConsignmentMovement) =>
    movement.bagWeightKg ||
    (movement.quantityBags > 0 && movement.quantityTons > 0
      ? (movement.quantityTons * 1000) / movement.quantityBags
      : undefined);
  const describe = (movement: ConsignmentMovement) =>
    [
      movement.type === "deposit"
        ? "سپردهٔ کالای مشتری در گدام"
        : movement.type === "return"
          ? "برگشت از امانت"
          : "حواله خروج کالا",
      `سند #${movement.documentNumber}`,
      movement.invoiceId
        ? `فاکتور #${invoices.find((invoice) => invoice.id === movement.invoiceId)?.invoiceNumber || movement.invoiceId}`
        : "",
      movement.driverName ? `موتروان: ${movement.driverName}` : "",
      movement.carPlate ? `پلاک: ${movement.carPlate}` : "",
      movement.receiverName ? `تحویل‌گیرنده: ${movement.receiverName}` : "",
      movement.notes || "",
    ]
      .filter(Boolean)
      .join(" — ");
  const deleting = consignmentMovements.find(
    (movement) => movement.id === deleteId,
  );
  usePageReport({
    title: 'تعهدات و گردش کالای امانی', onCreate: () => setDelivery({}), createLabel: 'ایجاد حواله خروج جدید',
    search: { value: query, onChange: setQuery, placeholder: 'جستجوی مشتری، کالا یا سند امانی' },
    filters: [
      { id: 'owner', label: 'مشتری در گردش', value: ownerFilter, onChange: setOwnerFilter, options: [{ value: 'all', label: 'همه مشتریان' }, ...owners.map(owner => ({ value: owner.key, label: owner.name }))] },
      { id: 'type', label: 'نوع گردش', value: typeFilter, onChange: setTypeFilter, options: [{ value: 'all', label: 'همه' }, { value: 'deposit', label: 'سپرده' }, { value: 'withdrawal', label: 'خروج' }, { value: 'return', label: 'برگشت' }] },
      { id: 'warehouse', label: 'گدام در گردش', value: warehouseFilter, onChange: setWarehouseFilter, options: [{ value: 'all', label: 'همه' }, ...warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name }))] },
    ],
    getReport: () => ({ title: 'تعهدات و گردش کالای امانی', sections: [
      { title: 'تعهدات فعال', headers: ['تاریخ', 'شماره فاکتور', 'نوع معامله', 'مشتری', 'کالا', 'گدام', 'فروخته‌شده (تن)', 'فروخته‌شده (کیسه)', 'تحویل‌شده (تن)', 'تحویل‌شده (کیسه)', 'باقی‌مانده (تن)', 'باقی‌مانده (کیسه)'], rows: active.map(lot => [lot.date, lot.invoiceNumber, lot.dealLabel, lot.partyName, lot.productName, lot.warehouseName, lot.soldTons, lot.soldBags, lot.deliveredTons, lot.deliveredBags, lot.remainingTons, lot.remainingBags]) },
      { title: 'گردش امانی با فیلترهای جاری', headers: ['تاریخ', 'شماره سند', 'مشتری', 'کالا', 'گدام', 'نوع', 'مقدار تن', 'مقدار کیسه', 'مانده جاری تن', 'مانده جاری کیسه', 'شرح'], rows: history.map(movement => [movement.date, movement.documentNumber, movement.partyName, movement.productName, movement.warehouseName, movement.type === 'deposit' ? 'ورودی' : movement.type === 'return' ? 'برگشت' : 'خروج', movement.quantityTons, movement.quantityBags, movement.runningTons, movement.runningBags, describe(movement)]) },
    ] }),
  });

  return (
    <div className="reference-consignment" dir="rtl">
      <div className="consignment-page-heading">
        <div>
          <h1>
            <PackageOpen aria-hidden="true" />
            سامانه تسلیم کالاهای پیش‌فروش و امانی
          </h1>
          <p>
            مشاهدهٔ زندهٔ موجودی پیش‌فروش مشتریان در گدام امانی و ثبت حوالهٔ
            تحویل تدریجی یا کامل کالا
          </p>
        </div>
        <button type="button" onClick={onBackToInvoices}>
          <ArrowRight />
          بازگشت به فاکتورها
        </button>
      </div>
      <section
        className="consignment-panel consignment-commitments"
        aria-labelledby="consignment-commitments-title"
      >
        <div className="consignment-panel-heading">
          <h2 id="consignment-commitments-title">
            <Users />
            لیست تعهدات پیش‌فروش فعال (کالاهای موجود در گدام امانی)
          </h2>
        </div>
        <div className="consignment-table-scroll">
          <table className="consignment-commitments-table">
            <thead>
              <tr>
                <th>تاریخ فاکتور</th>
                <th>شماره فاکتور</th>
                <th>نوع معامله</th>
                <th>مشتری (مشاهده پروفایل)</th>
                <th>نام کالا</th>
                <th>کل مقدار فروخته شده</th>
                <th>تحویل داده شده تا کنون</th>
                <th>باقی‌مانده در گدام امانی</th>
                <th>عملیات تحویل و گردش</th>
              </tr>
            </thead>
            <tbody>
              {active.map((lot) => (
                <tr key={lot.key}>
                  <td>
                    <bdi>{tradeShamsiDate(lot.date)}</bdi>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="consignment-invoice-link"
                      onClick={() =>
                        lot.invoiceId && onViewInvoice
                          ? onViewInvoice(lot.invoiceId)
                          : setOwnerFilter(consignmentOwnerKey(lot))
                      }
                    >
                      #{lot.invoiceNumber}
                    </button>
                  </td>
                  <td>
                    <span className="consignment-deal">{lot.dealLabel}</span>
                    {!lot.invoiceId && <small>سپردهٔ ثبت‌شده</small>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="consignment-party-link"
                      onClick={() => setProfileId(lot.partyId)}
                    >
                      <UserCircle />
                      {lot.partyName}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="consignment-product-link"
                      onClick={() =>
                        setProductProfile(
                          products.find(
                            (product) => product.id === lot.productId,
                          ) || null,
                        )
                      }
                    >
                      {lot.productName}
                    </button>
                  </td>
                  <td>
                    <Quantity
                      tons={lot.soldTons}
                      bags={lot.soldBags}
                      unit={lot.unit}
                      weight={lot.bagWeightKg}
                    />
                  </td>
                  <td>
                    <Quantity
                      tons={lot.deliveredTons}
                      bags={lot.deliveredBags}
                      unit={lot.unit}
                      weight={lot.bagWeightKg}
                      tone="incoming"
                    />
                  </td>
                  <td>
                    <Quantity
                      tons={lot.remainingTons}
                      bags={lot.remainingBags}
                      unit={lot.unit}
                      weight={lot.bagWeightKg}
                      tone="remaining"
                    />
                  </td>
                  <td>
                    <div className="consignment-commitment-actions">
                      <button
                        type="button"
                        className="consignment-release"
                        aria-label={`صدور حواله خروج ${lot.partyName} ${lot.productName} #${lot.invoiceNumber}`}
                        onClick={() =>
                          setDelivery({
                            partyId: lot.partyId,
                            partyName: lot.partyName,
                            warehouseId: lot.warehouseId,
                            productId: lot.productId,
                            invoiceId: lot.invoiceId,
                          })
                        }
                      >
                        <Truck />
                        صدور حواله خروج
                      </button>
                      <button
                        type="button"
                        className="consignment-view-history"
                        onClick={() => {
                          setOwnerFilter(consignmentOwnerKey(lot));
                          historyRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                      >
                        <History />
                        گردش تسلیم بار
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr>
                  <td colSpan={9} className="consignment-empty">
                    <PackageOpen />
                    <p>هنوز کالای امانی دارای مانده ثبت نشده است.</p>
                    <button type="button" onClick={onBackToInvoices}>
                      بازگشت به فاکتورهای فروش
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section
        ref={historyRef}
        className="consignment-panel consignment-history"
        aria-labelledby="consignment-history-title"
      >
        <div className="consignment-history-toolbar">
          <h2 id="consignment-history-title">
            <History />
            کاردکس و گردش بار فیزیکی مشتریان (سپرده و برگشتی)
          </h2>
          <div>
            <select
              aria-label="نمایش گردش بار مشتری"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="all">نمایش گردش بار همه مشتریان</option>
              {owners.map((owner) => (
                <option key={owner.key} value={owner.key}>
                  {owner.name} ({owner.id})
                </option>
              ))}
            </select>
            <button type="button" onClick={printHistory}>
              <Printer />
              پیش‌نمایش چاپ بار
            </button>
          </div>
        </div>
        <div className="consignment-table-scroll">
          <table className="consignment-history-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>زمان صدور حواله</th>
                <th>نام مشتری</th>
                <th>نام محصول</th>
                <th>مقدار بار (وارده)</th>
                <th>بیرون بار (صادره)</th>
                <th>باقی‌مانده گدام</th>
                <th>شرح حواله و جزئیات تسلیم</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {history.map((movement, index) => (
                <tr key={movement.id}>
                  <td>{index + 1}</td>
                  <td>
                    <bdi>
                      {tradeShamsiDate(movement.date)}{" "}
                      {movement.issueTime || ""}
                    </bdi>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="consignment-party-link"
                      onClick={() => setProfileId(movement.partyId)}
                    >
                      <UserCircle />
                      {movement.partyName}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="consignment-product-link"
                      onClick={() =>
                        setProductProfile(
                          products.find(
                            (product) => product.id === movement.productId,
                          ) || null,
                        )
                      }
                    >
                      {movement.productName}
                    </button>
                  </td>
                  <td>
                    {movement.type === "deposit" ? (
                      <Quantity
                        tons={movement.quantityTons}
                        bags={movement.quantityBags}
                        unit={getUnit(movement)}
                        weight={getWeight(movement)}
                        tone="incoming"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {movement.type !== "deposit" ? (
                      <Quantity
                        tons={movement.quantityTons}
                        bags={movement.quantityBags}
                        unit={getUnit(movement)}
                        weight={getWeight(movement)}
                        tone="outgoing"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Quantity
                      tons={movement.runningTons}
                      bags={movement.runningBags}
                      unit={getUnit(movement)}
                      weight={getWeight(movement)}
                      tone="incoming"
                    />
                  </td>
                  <td className="consignment-movement-description">
                    <button
                      type="button"
                      onClick={() =>
                        movement.type === "withdrawal"
                          ? openPrintModal({
                              type: "consignment_delivery_slip",
                              consignmentDelivery: {
                                ...movement,
                                remainingTonsAfter: movement.runningTons,
                                remainingBagsAfter: movement.runningBags,
                              },
                            })
                          : openPrintModal({
                              type: "customer_consignment_cardex",
                              customerName: movement.partyName,
                              party: parties.find(
                                (party) => party.id === movement.partyId,
                              ),
                              consignmentMovements: runningRows.filter(
                                (row) =>
                                  consignmentOwnerKey(row) ===
                                  consignmentOwnerKey(movement),
                              ),
                              balanceByScope: true,
                            })
                      }
                    >
                      {describe(movement)}
                    </button>
                    <small>
                      {movement.warehouseName ||
                        warehouses.find(
                          (warehouse) => warehouse.id === movement.warehouseId,
                        )?.name ||
                        movement.warehouseId}
                    </small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="consignment-delete"
                      aria-label={`حذف گردش امانی #${movement.documentNumber}`}
                      title={
                        isInvoiceConsignmentMovement(movement)
                          ? "ویرایش از فاکتور مرتبط"
                          : "حذف و برگشت موجودی"
                      }
                      onClick={() => {
                        if (isInvoiceConsignmentMovement(movement)) {
                          const invoiceId = consignmentInvoiceId(
                            movement,
                            invoices,
                          );
                          if (invoiceId && onViewInvoice)
                            onViewInvoice(invoiceId);
                          else
                            setActionError(
                              "این گردش از فاکتور ایجاد شده است؛ فاکتور مرتبط را ویرایش کنید.",
                            );
                        } else setDeleteId(movement.id);
                      }}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={9} className="consignment-empty">
                    <FileText />
                    <p>گردشی برای این انتخاب ثبت نشده است.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <details className="consignment-more">
          <summary>فیلتر گدام و نوع گردش / امکانات بیشتر</summary>
          <div>
            <select
              aria-label="گدام گردش امانی"
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
            >
              <option value="all">همهٔ گدام‌ها</option>
              {warehouses
                .filter((warehouse) => warehouse.type !== "standard")
                .map((warehouse) => (
                  <option value={warehouse.id} key={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="نوع گردش امانی"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">همهٔ گردش‌ها</option>
              <option value="deposit">سپرده / ورودی</option>
              <option value="withdrawal">تحویل / خروج</option>
              <option value="return">برگشت</option>
            </select>
            <button type="button" onClick={() => setDelivery({})}>
              <Truck />
              ثبت حواله خروج جدید
            </button>
            <button type="button" onClick={onManageWarehouses}>
              مدیریت گدام‌ها و امکانات قبلی
            </button>
          </div>
        </details>
        {negativeHoldings.length > 0 && (
          <p className="consignment-data-warning" role="status">
            در {negativeHoldings.length} ردیف، ماندهٔ تاریخی منفی است. این
            اختلاف پنهان یا صفر نشده؛ قبل از خروج بار، گردش‌های آن را حسابرسی
            کنید.
          </p>
        )}
        {actionError && (
          <p className="consignment-data-warning" role="alert">
            {actionError}
          </p>
        )}
      </section>
      <ConsignmentDeliveryModal
        isOpen={delivery !== null}
        onClose={() => setDelivery(null)}
        initialPartyId={delivery?.partyId}
        initialPartyName={delivery?.partyName}
        initialWarehouseId={delivery?.warehouseId}
        initialProductId={delivery?.productId}
        initialInvoiceId={delivery?.invoiceId}
      />
      {deleting && (
        <WorkspaceDialog
          title={`حذف حواله #${deleting.documentNumber}`}
          onClose={() => setDeleteId(null)}
        >
          <p>
            این گردش حذف شود؟ اثر آن بر موجودی و ماندهٔ همین مشتری در همین گدام
            برگردانده می‌شود.
          </p>
          <div className="workspace-dialog-actions">
            <button type="button" onClick={() => setDeleteId(null)}>
              انصراف
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                deleteConsignmentMovement(deleting.id);
                setDeleteId(null);
              }}
            >
              تأیید حذف حواله
            </button>
          </div>
        </WorkspaceDialog>
      )}
      {profileId && (
        <WorkspaceDialog
          title="پروفایل مشتری صاحب بار"
          onClose={() => setProfileId(null)}
        >
          <strong>
            {profile?.name ||
              owners.find((owner) => owner.id === profileId)?.name ||
              profileId}
          </strong>
          <p>شماره تماس: {profile?.phone || "—"}</p>
          <p>آدرس: {profile?.address || "—"}</p>
          {profile && (
            <p>
              <bdi>
                USD {formatDashboardAmount(profile.balanceUSD, 6)} · AFN{" "}
                {formatDashboardAmount(profile.balanceAFN, 6)}
              </bdi>
            </p>
          )}
          <div className="workspace-dialog-actions">
            <button
              type="button"
              onClick={() => {
                setOwnerFilter(`id:${profileId}`);
                setProfileId(null);
              }}
            >
              نمایش گردش بار این مشتری
            </button>
          </div>
        </WorkspaceDialog>
      )}
      {productProfile && (
        <WorkspaceDialog
          title="مشخصات کالای امانی"
          onClose={() => setProductProfile(null)}
        >
          <strong>{productProfile.name}</strong>
          <p>کد کالا: {productProfile.code}</p>
          <p>وزن بستهٔ کنونی: {productProfile.bagWeightKg} کیلوگرم</p>
          <p>مقادیر هر حواله با ضریب بسته‌بندی همان سند نمایش داده می‌شود.</p>
        </WorkspaceDialog>
      )}
    </div>
  );
};

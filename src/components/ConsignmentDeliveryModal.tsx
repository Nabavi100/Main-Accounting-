import { CloseButton } from './CloseButton';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Package, Printer, Truck, X } from "lucide-react";
import { useAccounting } from "../context/AccountingContext";
import type { Unit } from "../types";
import { ShamsiDatePickerModal } from "./ShamsiDatePickerModal";
import { getCurrentTime, getPersianDate } from "../utils/formatters";
import { formatDashboardAmount } from "../utils/dashboard";
import {
  tradeGregorianEquivalent,
  tradeShamsiDate,
} from "../utils/tradeInvoices";
import {
  consignmentHoldings,
  formatConsignmentQuantity,
  consignmentLots,
  consignmentOwnerKey,
  consignmentQuantity,
  isConsignmentWarehouse,
  nextConsignmentNumber,
  roundConsignment,
} from "../utils/consignment";

interface ConsignmentDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPartyId?: string;
  initialPartyName?: string;
  initialWarehouseId?: string;
  initialProductId?: string;
  initialInvoiceId?: string;
}
const qty = formatConsignmentQuantity;

const DeliveryPanel: React.FC<
  Omit<ConsignmentDeliveryModalProps, "isOpen">
> = ({
  onClose,
  initialPartyId,
  initialPartyName,
  initialWarehouseId,
  initialProductId,
  initialInvoiceId,
}) => {
  const {
    parties,
    warehouses,
    products,
    stocks,
    invoices,
    consignmentMovements,
    createConsignmentMovement,
    openPrintModal,
  } = useAccounting();
  const holdings = useMemo(
    () => consignmentHoldings(consignmentMovements),
    [consignmentMovements],
  );
  const lots = useMemo(
    () => consignmentLots(consignmentMovements, invoices),
    [consignmentMovements, invoices],
  );
  const owners = [
    ...new Map(
      holdings.map((holding) => [
        consignmentOwnerKey(holding),
        {
          id: holding.partyId,
          key: consignmentOwnerKey(holding),
          name: holding.partyName,
        },
      ]),
    ).values(),
  ];
  const initialOwner = initialPartyId
    ? owners.find((owner) => owner.id === initialPartyId)
    : owners.filter((owner) => owner.name === initialPartyName).length === 1
      ? owners.find((owner) => owner.name === initialPartyName)
      : undefined;
  const [ownerKey, setOwnerKey] = useState(initialOwner?.key || "");
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId || "");
  const [productId, setProductId] = useState(initialProductId || "");
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId || "");
  const [date, setDate] = useState(getPersianDate());
  const [issueTime, setIssueTime] = useState(getCurrentTime());
  const [unit, setUnit] = useState<Unit>("ton");
  const [quantity, setQuantity] = useState("1");
  const [driverName, setDriverName] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const number = nextConsignmentNumber(consignmentMovements);
  const owner = owners.find((owner) => owner.key === ownerKey);
  const party = parties.find((party) => party.id === owner?.id);
  const availableWarehouses = warehouses.filter((warehouse) =>
    isConsignmentWarehouse(warehouse),
  );
  const availableProducts = holdings.filter(
    (holding) =>
      consignmentOwnerKey(holding) === ownerKey &&
      holding.warehouseId === warehouseId &&
      holding.remainingTons > 0 &&
      holding.remainingBags > 0,
  );
  const holding = availableProducts.find(
    (holding) => holding.productId === productId,
  );
  const availableLots = lots.filter(
    (lot) =>
      consignmentOwnerKey(lot) === ownerKey &&
      lot.warehouseId === warehouseId &&
      lot.productId === productId &&
      lot.remainingTons > 0 &&
      lot.remainingBags > 0,
  );
  const chosenLot = invoiceId
    ? availableLots.find((lot) => lot.invoiceId === invoiceId)
    : undefined;
  const product = products.find((product) => product.id === productId);
  const physical = stocks.find(
    (stock) =>
      stock.warehouseId === warehouseId && stock.productId === productId,
  );
  const knownWeights = [
    ...new Set(
      availableLots
        .map((lot) =>
          lot.bagWeightKg ? roundConsignment(lot.bagWeightKg) : undefined,
        )
        .filter((weight) => weight !== undefined),
    ),
  ];
  const bagWeight =
    chosenLot?.bagWeightKg ||
    (knownWeights.length === 1 ? knownWeights[0] : product?.bagWeightKg) ||
    0;
  const entered = consignmentQuantity(quantity, unit, bagWeight);
  const remainingTons = chosenLot?.remainingTons ?? holding?.remainingTons ?? 0;
  const remainingBags = chosenLot?.remainingBags ?? holding?.remainingBags ?? 0;
  const insufficient = Boolean(
    entered &&
    (entered.tons > remainingTons + 0.000001 ||
      entered.bags > remainingBags + 0.000001 ||
      entered.tons > (physical?.quantityTons || 0) + 0.000001 ||
      entered.bags > (physical?.quantityBags || 0) + 0.000001),
  );

  useEffect(() => {
    const element = dialog.current;
    if (!returnFocus.current)
      returnFocus.current = document.activeElement as HTMLElement;
    element?.showModal();
    return () => {
      if (element?.open) element.close();
      requestAnimationFrame(() => {
        if (element?.isConnected && element.open) return;
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
      });
    };
  }, []);
  useEffect(() => {
    setError("");
  }, [ownerKey, warehouseId, productId, invoiceId, quantity, unit, date]);
  const save = (print: boolean) => {
    if (lock.current) return;
    setError("");
    if (!owner || !holding || !product)
      return setError("مشتری، گدام و کالای دارای مانده را انتخاب کنید.");
    if (!entered)
      return setError("مقدار و ضریب بسته‌بندی باید معتبر و بیشتر از صفر باشد.");
    if (insufficient)
      return setError(
        "مقدار درخواستی از ماندهٔ همین مشتری یا موجودی فیزیکی همین گدام بیشتر است.",
      );
    if (knownWeights.length > 1 && !chosenLot)
      return setError(
        "این کالا با چند بسته‌بندی ثبت شده است؛ فاکتور مربوط را انتخاب کنید.",
      );
    if (tradeGregorianEquivalent(date) === "—")
      return setError("تاریخ تحویل معتبر را وارد کنید.");
    lock.current = true;
    setBusy(true);
    try {
      const movement = createConsignmentMovement({
        partyId: owner.id,
        partyName: owner.name,
        partyPhone: party?.phone || holding.partyPhone,
        warehouseId,
        warehouseName: warehouses.find(
          (warehouse) => warehouse.id === warehouseId,
        )?.name,
        productId,
        productName: product.name,
        invoiceId: chosenLot?.invoiceId,
        documentType: "delivery_slip",
        documentNumber: number,
        date: tradeShamsiDate(date),
        issueTime,
        type: "withdrawal",
        unit,
        bagWeightKg: bagWeight,
        quantityTons: entered.tons,
        quantityBags: entered.bags,
        driverName: driverName.trim() || undefined,
        carPlate: carPlate.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        receiverName: receiverName.trim() || owner.name,
        destination: destination.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (print)
        openPrintModal({
          type: "consignment_delivery_slip",
          consignmentDelivery: movement,
        });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ثبت حواله انجام نشد.",
      );
      lock.current = false;
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="consignment-delivery-dialog"
      dir="rtl"
      aria-labelledby="consignment-delivery-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDownCapture={(event) => {
        if (calendarOpen && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setCalendarOpen(false);
        }
      }}
    >
      <div className="consignment-delivery-heading app-modal-heading">
        <span>
          <Truck />
        </span>
        <div>
          <h2 id="consignment-delivery-title">صدور حواله خروج از گدام امانی</h2>
          <p>تحویل مرحله‌ای بار به مشتری؛ کسر فقط از همین کالا و همین گدام</p>
        </div>
        <CloseButton type="button"
          onClick={onClose}
          aria-label="بستن فرم حواله خروج" />
      </div>
      <form
        id="consignment-delivery-form"
        className="consignment-delivery-body"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          save(false);
        }}
      >
        <div className="consignment-delivery-grid is-three">
          <div>
            <label htmlFor="csg-number">شمارهٔ حواله</label>
            <input id="csg-number" value={number} readOnly dir="ltr" />
          </div>
          <div>
            <label htmlFor="csg-date">تاریخ تحویل (شمسی)</label>
            <div className="consignment-date-input">
              <input
                id="csg-date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                aria-label="تقویم حواله خروج"
                onClick={() => setCalendarOpen(true)}
              >
                <CalendarDays />
              </button>
            </div>
            <small>
              معادل میلادی: <bdi>{tradeGregorianEquivalent(date)}</bdi>
            </small>
          </div>
          <div>
            <label htmlFor="csg-time">ساعت بارگیری</label>
            <input
              id="csg-time"
              type="time"
              value={issueTime}
              onChange={(event) => setIssueTime(event.target.value)}
            />
          </div>
        </div>
        <div className="consignment-delivery-grid">
          <div>
            <label htmlFor="csg-owner">
              مشتری صاحب بار <em>*</em>
            </label>
            <select
              id="csg-owner"
              value={ownerKey}
              onChange={(event) => {
                setOwnerKey(event.target.value);
                setProductId("");
                setInvoiceId("");
              }}
            >
              <option value="">انتخاب مشتری...</option>
              {owners.map((owner) => (
                <option key={owner.key} value={owner.key}>
                  {owner.name} ({owner.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="csg-warehouse">
              گدام امانی مبدأ <em>*</em>
            </label>
            <select
              id="csg-warehouse"
              value={warehouseId}
              onChange={(event) => {
                setWarehouseId(event.target.value);
                setProductId("");
                setInvoiceId("");
              }}
            >
              <option value="">انتخاب گدام...</option>
              {availableWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="consignment-delivery-grid">
          <div>
            <label htmlFor="csg-product">
              کالای امانی جهت تحویل <em>*</em>
            </label>
            <select
              id="csg-product"
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setInvoiceId("");
              }}
            >
              <option value="">انتخاب کالا...</option>
              {availableProducts.map((holding) => (
                <option key={holding.key} value={holding.productId}>
                  {holding.productName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="csg-invoice">فاکتور تخصیص امانت</label>
            <select
              id="csg-invoice"
              value={invoiceId}
              onChange={(event) => setInvoiceId(event.target.value)}
            >
              <option value="">تخصیص از قدیمی‌ترین سپرده‌های این مشتری</option>
              {availableLots
                .filter((lot) => lot.invoiceId)
                .map((lot) => (
                  <option key={lot.key} value={lot.invoiceId}>
                    #{lot.invoiceNumber} — {qty(lot.remainingTons)} تن
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="consignment-delivery-stock">
          <Package />
          <div>
            <span>ماندهٔ قابل تحویل این مشتری</span>
            <strong>
              <bdi>
                {qty(remainingTons)} تن · {qty(remainingBags)} کیسه
              </bdi>
            </strong>
          </div>
          <div>
            <span>موجودی فیزیکی همین گدام</span>
            <strong>
              <bdi>
                {qty(physical?.quantityTons || 0)} تن ·{" "}
                {qty(physical?.quantityBags || 0)} کیسه
              </bdi>
            </strong>
          </div>
        </div>
        <div className="consignment-delivery-grid is-three">
          <div>
            <label htmlFor="csg-unit">واحد تحویل</label>
            <select
              id="csg-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value as Unit)}
            >
              <option value="ton">تن (KG 1000)</option>
              <option value="bag">
                کیسه
                {bagWeight > 0
                  ? ` (${formatDashboardAmount(bagWeight, 2).replace(/\.?0+$/, "")} KG)`
                  : ""}
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="csg-quantity">
              مقدار تحویل <em>*</em>
            </label>
            <input
              id="csg-quantity"
              value={quantity}
              inputMode="decimal"
              dir="ltr"
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={insufficient}
            />
          </div>
          <div className="consignment-converted">
            <span>معادل بار خروجی</span>
            <strong>
              {entered
                ? `${qty(entered.tons)} تن · ${qty(entered.bags)} کیسه`
                : "—"}
            </strong>
          </div>
        </div>
        <div className="consignment-delivery-grid is-three">
          <div>
            <label htmlFor="csg-driver">نام موتروان</label>
            <input
              id="csg-driver"
              value={driverName}
              onChange={(event) => setDriverName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="csg-plate">پلاک موتر</label>
            <input
              id="csg-plate"
              value={carPlate}
              onChange={(event) => setCarPlate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="csg-phone">شمارهٔ تماس موتروان</label>
            <input
              id="csg-phone"
              value={driverPhone}
              onChange={(event) => setDriverPhone(event.target.value)}
              inputMode="tel"
            />
          </div>
        </div>
        <div className="consignment-delivery-grid">
          <div>
            <label htmlFor="csg-receiver">نام تحویل‌گیرنده</label>
            <input
              id="csg-receiver"
              value={receiverName}
              placeholder={owner?.name || ""}
              onChange={(event) => setReceiverName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="csg-destination">مقصد بار</label>
            <input
              id="csg-destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </div>
        </div>
        <label htmlFor="csg-notes">شرح حواله و یادداشت</label>
        <textarea
          id="csg-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
        />
        <p className="consignment-after-preview">
          مانده پس از این تحویل:{" "}
          <bdi>
            {entered
              ? `${qty(roundConsignment(remainingTons - entered.tons))} تن · ${qty(roundConsignment(remainingBags - entered.bags))} کیسه`
              : "—"}
          </bdi>
        </p>
        {error && (
          <p className="consignment-delivery-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="consignment-delivery-footer">
        <button type="button" onClick={onClose} disabled={busy}>
          انصراف
        </button>
        <button
          type="submit"
          form="consignment-delivery-form"
          disabled={busy}
          className="is-save"
        >
          <Truck />
          ثبت حواله خروج
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy}
          className="is-print"
        >
          <Printer />
          ثبت و پیش‌نمایش چاپ
        </button>
      </div>
      <ShamsiDatePickerModal
        isOpen={calendarOpen}
        value={date}
        onChange={setDate}
        onClose={() => setCalendarOpen(false)}
        colorTheme="blue"
      />
    </dialog>,
    document.body,
  );
};
export const ConsignmentDeliveryModal: React.FC<
  ConsignmentDeliveryModalProps
> = (props) => (props.isOpen ? <DeliveryPanel {...props} /> : null);

import { CloseButton } from './CloseButton';
import { itemizedSalesFilter } from '../utils/navigation';
import React, { useEffect, useState } from "react";
import type { Invoice, InvoiceType } from "../types";
import type { NavTab } from "./Sidebar";
import type { TradeType } from "../utils/tradeInvoices";
import { LegacyTradeOperationsHubView } from "./LegacyTradeOperationsHubView";
import { ReferenceInvoiceForm } from "./ReferenceInvoiceForm";
import { ReferenceInvoiceList } from "./ReferenceInvoiceList";

interface TradeOperationsHubViewProps {
  embeddedInCenter?: boolean;
  initialType?: InvoiceType;
  initialViewMode?: "list" | "create" | "itemized";
  onViewInvoice: (id: string) => void;
  onOpenPaymentModal?: (
    type: "receive_payment" | "make_payment",
    partyId?: string,
  ) => void;
  initialItemizedProductId?: string;
  onNavigate?: (tab: NavTab, filter?: string) => void;
}

const tabs = [
  {
    id: "buy-create",
    type: "buy",
    mode: "create",
    label: "ثبت فاکتور خرید",
    destination: "new_purchase",
  },
  {
    id: "buy-list",
    type: "buy",
    mode: "list",
    label: "لیست خریدها",
    destination: "purchase_invoices",
  },
  {
    id: "sell-create",
    type: "sell",
    mode: "create",
    label: "ثبت فاکتور فروش",
    destination: "new_sale",
  },
  {
    id: "sell-list",
    type: "sell",
    mode: "list",
    label: "لیست فروشات",
    destination: "sales_invoices",
  },
] as const;

export const TradeOperationsHubView: React.FC<TradeOperationsHubViewProps> = ({
  embeddedInCenter = false,
  initialType = "buy",
  initialViewMode = "create",
  onViewInvoice,
  initialItemizedProductId,
  onOpenPaymentModal,
  onNavigate,
}) => {
  const [type, setType] = useState<InvoiceType>(initialType);
  const [mode, setMode] = useState(initialViewMode);
  const [editing, setEditing] = useState<Invoice | undefined>(undefined);
  useEffect(() => {
    setType(initialType);
    setMode(initialViewMode);
    setEditing(undefined);
  }, [initialType, initialViewMode]);

  // Keep the existing return / itemized workflows available, rather than rewriting them from unseen screenshots.
  if (type === "return_buy" || type === "return_sell" || mode === "itemized") {
    return (
      <LegacyTradeOperationsHubView
        embeddedInCenter={embeddedInCenter}
        initialType={type}
        initialViewMode={mode}
        initialItemizedProductId={initialItemizedProductId}
        onViewInvoice={onViewInvoice}
        onOpenPaymentModal={onOpenPaymentModal}
        onNavigate={(nextType, nextMode, productId) => {
          const destination = nextMode === 'itemized' ? 'trade_hub' : nextType === 'return_sell' ? nextMode === 'create' ? 'new_return_sell' : 'return_sell' : nextType === 'return_buy' ? nextMode === 'create' ? 'new_return_buy' : 'return_buy' : nextType === 'buy' ? nextMode === 'create' ? 'new_purchase' : 'purchase_invoices' : nextMode === 'create' ? 'new_sale' : 'sales_invoices';
          onNavigate?.(destination, nextMode === 'itemized' ? itemizedSalesFilter(productId) : 'all');
        }}
      />
    );
  }

  const switchView = (nextType: TradeType, nextMode: "create" | "list") => {
    setEditing(undefined);
    setType(nextType);
    setMode(nextMode);
    const tab = tabs.find(
      (tab) => tab.type === nextType && tab.mode === nextMode,
    )!;
    onNavigate?.(tab.destination);
  };
  const Heading = embeddedInCenter ? "h2" : "h1";
  const pageTitle = editing ? `ویرایش فاکتور ${type === "buy" ? "خرید" : "فروش"} #${editing.invoiceNumber}` : tabs.find(page => page.type === type && page.mode === mode)?.label || "فاکتورها";

  return (
    <section
      className={`reference-trade ${embeddedInCenter ? "is-in-center" : ""}`}
      dir="rtl"
      aria-labelledby="trade-page-title"
    >
      <div className="trade-page-heading app-page-form-heading">
        <div><Heading id="trade-page-title">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 2h10l5 5v15H5z" fill="#0877f9" />
            <path d="M15 2v6h5" fill="none" stroke="#c9e0ff" />
            <path
              d="M12 10v10m3-8h-4a1.6 1.6 0 0 0 0 3h2a1.6 1.6 0 0 1 0 3H9"
              fill="none"
              stroke="#fff"
            />
          </svg>
          {pageTitle}
        </Heading>
        <p>
          ثبت، پیگیری و گزارش‌گیری فاکتورهای خرید، فروش و موجودی لحظه‌ای انبار
        </p></div>
        {mode === 'create' && <CloseButton label="بستن فرم" aria-label="بستن فرم فاکتور و بازگشت به فهرست" onClick={() => switchView(type as TradeType, 'list')} />}
      </div>
      <div className="trade-panel">
        <div className="trade-page-body">
          {mode === "create" ? (
            <ReferenceInvoiceForm
              key={`${type}-${editing?.id || "new"}`}
              type={type as TradeType}
              invoice={editing}
              onSaved={() => switchView(type as TradeType, "list")}
              onCancelEdit={() => switchView(type as TradeType, 'list')}
            />
          ) : (
            <ReferenceInvoiceList
              key={type}
              type={type as TradeType}
              onViewInvoice={onViewInvoice}
              onCreate={() => switchView(type as TradeType, "create")}
              onEditInvoice={(invoice) => {
                setEditing(invoice);
                setMode("create");
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
};

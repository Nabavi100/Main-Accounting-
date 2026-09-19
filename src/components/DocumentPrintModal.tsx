import React, { useState, useRef } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { PrintableDocumentPayload, InvoiceItem, Invoice, FinancialTransaction, StockTransfer } from '../types';
import { formatNumber, formatCurrency, getPersianDate, numberToPersianWords } from '../utils/formatters';
import { PrintPartyStatement } from './print/PrintPartyStatement';
import { PrintProductCardex } from './print/PrintProductCardex';
import { PrintConsignmentCardex } from './print/PrintConsignmentCardex';
import { PrintConsignmentDeliverySlip } from './print/PrintConsignmentDeliverySlip';
import { PrintInventoryReport } from './print/PrintInventoryReport';
import { PrintCashExchangeVoucher } from './print/PrintCashExchangeVoucher';
import { PrintInvoiceDocument } from './print/PrintInvoiceDocument';
import { CompanyStampSeal } from './CompanyStampSeal';
import { SignatureAndSealModal } from './SignatureAndSealModal';
import {
  Printer,
  X,
  FileCheck,
  Phone,
  MapPin,
  Truck,
  Scissors,
  Download,
  FileText,
  Receipt,
  Layers,
  CheckCircle2,
  Stamp,
  PenTool,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Hash,
  AlertCircle,
  Building2,
  PackageCheck,
} from 'lucide-react';

interface DocumentPrintModalProps {
  document: PrintableDocumentPayload | null;
  onClose: () => void;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({
  document,
  onClose,
}) => {
  const { companySettings, parties, warehouses, products, stocks } = useAccounting();

  // Print layout options
  const [invoiceLayout, setInvoiceLayout] = useState<'combo_a4' | 'invoice_only' | 'warehouse_only' | 'thermal'>('combo_a4');
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [watermarkText, setWatermarkText] = useState<'رسمی' | 'پرداخت شد' | 'تحویل شد' | 'تسویه شده'>(
    'رسمی'
  );
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showCustomerBalance, setShowCustomerBalance] = useState<boolean>(true);

  // Digital Signature and Stamp States
  const [showStamp, setShowStamp] = useState<boolean>(
    companySettings.showStampOnInvoice !== undefined ? companySettings.showStampOnInvoice : true
  );
  const [showSignature, setShowSignature] = useState<boolean>(
    companySettings.showSignatureOnInvoice !== undefined
      ? companySettings.showSignatureOnInvoice
      : true
  );
  const [stampUrl, setStampUrl] = useState<string>(companySettings.stampUrl || '');
  const [signatureUrl, setSignatureUrl] = useState<string>(companySettings.signatureUrl || '');
  const [stampColor, setStampColor] = useState<'navy' | 'blue' | 'red'>(
    companySettings.stampColor || 'navy'
  );
  const [stampSize, setStampSize] = useState<number>(companySettings.stampSize || 56);
  const [signatureSize, setSignatureSize] = useState<number>(companySettings.signatureSize || 48);
  const [isSealModalOpen, setIsSealModalOpen] = useState<boolean>(false);

  // Sync states if companySettings change
  React.useEffect(() => {
    if (companySettings.stampUrl !== undefined) setStampUrl(companySettings.stampUrl);
    if (companySettings.signatureUrl !== undefined) setSignatureUrl(companySettings.signatureUrl);
    if (companySettings.stampColor) setStampColor(companySettings.stampColor);
    if (companySettings.showStampOnInvoice !== undefined)
      setShowStamp(companySettings.showStampOnInvoice);
    if (companySettings.showSignatureOnInvoice !== undefined)
      setShowSignature(companySettings.showSignatureOnInvoice);
    if (companySettings.stampSize !== undefined) setStampSize(companySettings.stampSize);
    if (companySettings.signatureSize !== undefined) setSignatureSize(companySettings.signatureSize);
  }, [companySettings]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document, onClose]);

  if (!document) return null;

  // Resolve actual data safely regardless of packaging structure
  const invData = document.invoice || 
    (document.invoiceNumber && (document as any).items ? (document as unknown as Invoice) : undefined) ||
    ((document as any).rawRecord && (document as any).rawRecord.invoiceNumber ? (document as any).rawRecord as Invoice : undefined);

  const trxData = document.transaction || 
    (document.transactionNumber ? (document as unknown as FinancialTransaction) : undefined) ||
    ((document as any).rawRecord && ((document as any).rawRecord.transactionNumber || (document as any).rawRecord.type === 'receive_payment' || (document as any).rawRecord.type === 'make_payment') ? (document as any).rawRecord as FinancialTransaction : undefined);

  const trfData = document.stockTransfer || 
    (document.transferNumber ? (document as unknown as StockTransfer) : undefined) ||
    ((document as any).rawRecord && (document as any).rawRecord.transferNumber ? (document as any).rawRecord as StockTransfer : undefined);

  const customContent = document.customContent;

  const handlePrint = () => {
    // Reset scroll to top before printing to avoid offset clipping
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handleSavePdf = () => {
    handlePrint();
  };

  // Helper to find party details if not already attached on document
  const getPartyExtraInfo = (partyId?: string, partyName?: string) => {
    if (partyId) {
      const p = parties.find(x => x.id === partyId);
      if (p) return p;
    }
    if (partyName) {
      const p = parties.find(x => x.name === partyName);
      if (p) return p;
    }
    return null;
  };

  // Helper to find warehouse name
  const getWarehouseName = (warehouseId?: string) => {
    if (!warehouseId) return 'گدام اصلی تجارتی';
    const w = warehouses.find(x => x.id === warehouseId);
    return w ? w.name : 'گدام اصلی تجارتی';
  };

  return (
    <div
      ref={scrollContainerRef}
      id="document-print-modal-backdrop"
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 z-[999] overflow-y-auto print:p-0 print:bg-white print:static"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="document-print-modal-container"
        className="print-modal-container bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200 my-2 print:shadow-none print:border-none print:m-0 print:p-0 print:max-w-none print:w-full relative flex flex-col"
        dir="rtl"
      >
        {/* Sticky Top Control Bar (Always visible during scrolling) */}
        <div className="sticky top-0 bg-slate-900 text-white z-50 flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5 -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-4 rounded-t-3xl border-b border-slate-700 shadow-md no-print">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base text-white">پیش‌نمایش و چاپ سند</span>
                {(document.invoice || invData) && (
                  <span className="text-xs font-mono font-bold bg-white/15 px-2.5 py-0.5 rounded-full text-slate-200 border border-white/10">
                    #{(document.invoice || invData)?.invoiceNumber}
                  </span>
                )}
                {(document.transaction || trxData) && (
                  <span className="text-xs font-mono font-bold bg-emerald-500/20 px-2.5 py-0.5 rounded-full text-emerald-200 border border-emerald-400/20">
                    #{(document.transaction || trxData)?.transactionNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                برگه استاندارد A4 • تنظیم شده جهت جلوگیری از برش خوردن حاشیه‌ها
              </p>
            </div>
          </div>

          {/* Action and Layout Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Format Layout Switcher for Invoices */}
            {(document.type === 'invoice' || !!invData) && (
              <>
                <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setInvoiceLayout('combo_a4')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    invoiceLayout === 'combo_a4'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title="فاکتور رسمی ۲/۳ بالا + خط‌چین + حواله گدام ۱/۳ پایین (تک‌برگ A4)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>A4 ترکیبی (کامل)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInvoiceLayout('invoice_only')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    invoiceLayout === 'invoice_only'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title="فقط فاکتور رسمی تمام‌صفحه"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>فقط فاکتور</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInvoiceLayout('warehouse_only')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    invoiceLayout === 'warehouse_only'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title="فقط حواله خروجی گدام و راننده"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>فقط حواله انبار</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInvoiceLayout('thermal')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                    invoiceLayout === 'thermal'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title="کاغذ رول / ۸۰ میلی‌متری حرارتی"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>رول حرارتی</span>
                </button>
              </div>

              {/* Toggle Show Customer Balance Checkbox for Invoices */}
              <label
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer select-none transition"
                title="تیک جهت چاپ یا عدم چاپ الباقی مانده حساب مشتری روی فاکتور"
              >
                <input
                  type="checkbox"
                  checked={showCustomerBalance}
                  onChange={e => setShowCustomerBalance(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-blue-600"
                />
                <span>چاپ الباقی حساب مشتری</span>
              </label>
            </>
          )}

            {/* Seal & Signature Settings Button */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs gap-1">
              <button
                id="doc-stamp-settings-btn"
                type="button"
                onClick={() => setIsSealModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  showStamp || showSignature
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                title="شخصی‌سازی و تعیین اندازه مهر و امضای دیجیتال در پایین برگه فاکتور"
              >
                <Stamp className="w-3.5 h-3.5 text-amber-400" />
                <span>تنظیم مهر و امضا</span>
                <span className="text-[10px] text-amber-300/80 font-mono hidden sm:inline">
                  ({stampSize}px / {signatureSize}px)
                </span>
                {(stampUrl || signatureUrl) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="تصویر بارگذاری شده"></span>
                )}
              </button>

              {/* Fast Stamp Toggle */}
              <label
                className="inline-flex items-center gap-1 px-2 py-1 hover:bg-slate-700 text-slate-300 rounded-md cursor-pointer select-none"
                title="فعال یا غیرفعال کردن چاپ مهر رسمی شرکت"
              >
                <input
                  type="checkbox"
                  checked={showStamp}
                  onChange={e => setShowStamp(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 w-3 h-3 cursor-pointer accent-amber-500"
                />
                <span className="text-[11px] font-bold">مهر</span>
              </label>

              {/* Fast Signature Toggle */}
              <label
                className="inline-flex items-center gap-1 px-2 py-1 hover:bg-slate-700 text-slate-300 rounded-md cursor-pointer select-none"
                title="فعال یا غیرفعال کردن چاپ امضای دیجیتال"
              >
                <input
                  type="checkbox"
                  checked={showSignature}
                  onChange={e => setShowSignature(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-0 w-3 h-3 cursor-pointer accent-blue-500"
                />
                <span className="text-[11px] font-bold">امضا</span>
              </label>
            </div>

            {/* Print Button */}
            <button
              id="doc-print-execute-btn"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs hover:shadow cursor-pointer active:scale-95"
              title="چاپ فوری مستقیم با پرینتر"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ مستقیم (Print)</span>
            </button>

            {/* Save PDF Button */}
            <button
              id="doc-pdf-execute-btn"
              type="button"
              onClick={handleSavePdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              title="ذخیره به فرمت فایل PDF"
            >
              <Download className="w-4 h-4" />
              <span>خروجی PDF</span>
            </button>

            {/* Close Button */}
            <button
              id="document-print-modal-close-btn"
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white rounded-xl transition border border-white/15 hover:border-rose-500 cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 active:scale-95"
              title="بستن فرم (ESC)"
            >
              <X className="w-4 h-4" />
              <span>بستن</span>
            </button>
          </div>
        </div>

        {/* ================= PRINTABLE PAPER CANVAS (A4 Compact & Calibrated) ================= */}
        <div
          id="printable-paper-canvas"
          className={`print-canvas mx-auto bg-white text-slate-900 relative transition-all ${
            invoiceLayout === 'thermal' ? 'max-w-[380px] p-2' : 'max-w-3xl p-3 sm:p-4'
          } border border-slate-300 rounded-2xl shadow-xs print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full font-sans`}
        >
          {/* Optional Watermark Stamp Overlay */}
          {showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0 select-none">
              <span className="text-7xl font-black text-slate-900 border-8 border-slate-900 p-6 rounded-3xl -rotate-12">
                {watermarkText}
              </span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SPECIALIZED OFFICIAL PRINT LAYOUTS                                       */}
          {/* ========================================================================= */}

          {/* 1. PARTY STATEMENT / FINANCIAL CARDEX */}
          {document.type === 'party_statement' && (document.party || document.partyId) && (() => {
            const p = document.party || parties.find(x => x.id === document.partyId);
            if (!p) return null;
            return (
              <PrintPartyStatement
                party={p}
                partyInvoices={document.partyLedgerInvoices || []}
                partyTransactions={document.partyLedgerTransactions || []}
                companySettings={companySettings}
                showSignatures={showSignatures}
                selectedCurrency={document.selectedCurrency || document.currency}
              />
            );
          })()}

          {/* 2. PRODUCT STOCK CARDEX */}
          {document.type === 'product_cardex' && (document.product || document.productId) && (() => {
            const prod = document.product || products.find(x => x.id === document.productId);
            if (!prod) return null;
            return (
              <PrintProductCardex
                product={prod}
                productMovements={document.productMovements || []}
                companySettings={companySettings}
                summaryCards={document.summaryCards}
                metadata={document.metadata}
                showSignatures={showSignatures}
              />
            );
          })()}

          {/* 3. CONSIGNMENT CARDEX FOR CUSTOMER */}
          {document.type === 'customer_consignment_cardex' && (
            <PrintConsignmentCardex
              party={document.party}
              partyName={document.customerName || (document.party ? document.party.name : undefined)}
              consignmentMovements={document.consignmentMovements || []}
              companySettings={companySettings}
              showSignatures={showSignatures}
            />
          )}

          {/* 3.5 CONSIGNMENT DELIVERY SLIP (A4) */}
          {(document.type === 'consignment_delivery_slip' || document.consignmentDelivery) && (
            <PrintConsignmentDeliverySlip
              movement={document.consignmentDelivery || (document as any).movement || (document as any)}
              party={document.party || getPartyExtraInfo((document.consignmentDelivery || document).partyId, (document.consignmentDelivery || document).partyName) || undefined}
              companySettings={companySettings}
              showSignatures={showSignatures}
            />
          )}

          {/* 4. PRODUCTS INVENTORY REPORT (ALL PRODUCTS & WAREHOUSES) */}
          {document.type === 'products_inventory_report' && (
            <PrintInventoryReport
              products={document.inventoryProducts || products}
              warehouses={warehouses}
              stocks={document.inventoryStocks || stocks}
              companySettings={companySettings}
              selectedWarehouseName={document.selectedWarehouseName}
              selectedCategoryName={document.selectedCategoryName}
              showSignatures={showSignatures}
            />
          )}

          {/* 5. CASH TRANSFER / CURRENCY EXCHANGE VOUCHER */}
          {(document.type === 'cash_transfer_voucher' || document.type === 'currency_exchange' || (trxData && (trxData.isExchange || trxData.type === 'currency_exchange' || trxData.fromCashRegister))) && trxData && (
            <PrintCashExchangeVoucher
              transaction={trxData}
              companySettings={companySettings}
              showSignatures={showSignatures}
            />
          )}

          {/* ========================================================================= */}
          {/* 0. DOCUMENT TYPE: CUSTOM CONTENT (REPORTS, CARDS, DYNAMIC DEFINITIONS)   */}
          {/* ========================================================================= */}
          {customContent && document.type !== 'party_statement' && document.type !== 'product_cardex' && document.type !== 'customer_consignment_cardex' && document.type !== 'products_inventory_report' && (
            <div className="relative z-10 space-y-3">
              {/* Header */}
              <div className="p-3.5 rounded-xl border-2 border-slate-900 bg-white flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  {companySettings.logoUrl ? (
                    <img
                      src={companySettings.logoUrl}
                      alt={companySettings.name}
                      className="w-12 h-12 object-contain rounded-lg bg-white border border-slate-300 p-0.5"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                      {companySettings.logoIconText || 'ن'}
                    </div>
                  )}
                  <div>
                    <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                      {companySettings.name || 'شرکت تجارتی برادران نبوی'} • {document.title || 'گزارش رسمی و چاپی'}
                    </h1>
                    <p className="text-[10.5px] text-slate-600 font-medium">
                      {document.subtitle || `سیستم یکپارچه حسابداری • تاریخ صدور: ${getPersianDate()}`}
                    </p>
                  </div>
                </div>

                <div className="text-left font-mono shrink-0 flex flex-col items-end">
                  <span className="inline-block text-[11px] font-black px-3 py-1 rounded-lg bg-slate-900 text-white">
                    سند رسمی چاپی
                  </span>
                  <div className="text-[10.5px] text-slate-600 font-sans mt-1">
                    تاریخ: {getPersianDate()}
                  </div>
                </div>
              </div>

              {/* Metadata Badges */}
              {document.metadata && document.metadata.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  {document.metadata.map((m, idx) => (
                    <div key={idx}>
                      <span className="text-[10px] text-slate-500 block font-bold">{m.label}:</span>
                      <strong className="text-slate-900 font-black">{m.value}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Content Body */}
              <div className="bg-white rounded-xl overflow-hidden border border-slate-200 p-2">
                {customContent}
              </div>

              {/* Signatures */}
              {showSignatures && (
                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-center text-[10.5px]">
                  <div>
                    <span className="text-slate-500 block mb-7 font-bold">تنظیم‌کننده سند</span>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                      امور مالی و حسابداری
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-7 font-bold">تایید مدیر مالی</span>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                      مدیریت مالی شرکت
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-7 font-bold">امضا و تایید مدیریت عامله</span>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                      {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 1. DOCUMENT TYPE: INVOICE / WAREHOUSE EXIT SLIP                          */}
          {/* ========================================================================= */}
          {!customContent && invData && (
            <PrintInvoiceDocument
              inv={invData}
              companySettings={companySettings}
              invoiceLayout={invoiceLayout}
              showSignatures={showSignatures}
              showCustomerBalance={showCustomerBalance}
              showStamp={showStamp}
              showSignature={showSignature}
              stampUrl={stampUrl}
              signatureUrl={signatureUrl}
              stampColor={stampColor}
              stampSize={stampSize}
              signatureSize={signatureSize}
              getPartyExtraInfo={getPartyExtraInfo}
              getWarehouseName={getWarehouseName}
            />
          )}

          {/* ========================================================================= */}
          {/* 2. PAYMENT & TRANSACTION RECEIPT                                          */}
          {/* ========================================================================= */}
          {!customContent && !invData && trxData && !trxData.isExchange && trxData.type !== 'currency_exchange' && !trxData.fromCashRegister && document.type !== 'cash_transfer_voucher' && document.type !== 'currency_exchange' && document.type !== 'party_statement' && document.type !== 'product_cardex' && document.type !== 'customer_consignment_cardex' && document.type !== 'products_inventory_report' && (() => {
            const trx = trxData;
            const isReceive = trx.type === 'receive_payment';
            const themeBorder = isReceive ? 'border-emerald-600' : 'border-rose-600';
            const themeBadge = isReceive
              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
              : 'bg-rose-100 text-rose-950 border border-rose-300';

            const partyInfo = getPartyExtraInfo(trx.partyId, trx.partyName);
            const partyPhone = trx.partyPhone || partyInfo?.phone || '---';

            return (
              <div className="relative z-10 space-y-3">
                <div className={`p-3.5 rounded-xl border-2 ${themeBorder} bg-white flex items-center justify-between gap-3 shadow-xs`}>
                  <div className="flex items-center gap-3">
                    {companySettings.logoUrl ? (
                      <img
                        src={companySettings.logoUrl}
                        alt={companySettings.name}
                        className="w-12 h-12 object-contain rounded-lg bg-white border border-slate-300 p-0.5"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                        {companySettings.logoIconText || 'ن'}
                      </div>
                    )}
                    <div>
                      <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        {companySettings.name} • خزانه‌داری و امور مالی
                      </h1>
                      <p className="text-[10.5px] text-slate-600 font-medium">
                        سند رسمی دریافت و پرداخت و تسویه حسابات نقدی و صرافی
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono shrink-0 flex flex-col items-end">
                    <span className={`inline-block text-[11px] font-black px-3 py-1 rounded-lg ${themeBadge}`}>
                      {isReceive ? 'رسید دریافت وجه (ورودی)' : 'سند پرداخت وجه (خروجی)'}
                    </span>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      شماره سند: #{trx.transactionNumber}
                    </div>
                    <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                      تاریخ: {trx.date} {trx.issueTime ? `• ساعت: ${trx.issueTime}` : ''}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">طرف حساب / مشتری:</span>
                      <strong className="text-sm font-black text-slate-900">
                        {trx.partyName || 'حساب عمومی / متفرقه'}
                      </strong>
                      <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                        شماره تماس: {partyPhone}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">مبلغ قطعی سند:</span>
                      <strong className="text-base font-black text-emerald-800 font-mono">
                        {formatCurrency(trx.amount, trx.currency)}
                      </strong>
                      <span className="block text-[10px] text-slate-600 mt-0.5">
                        {trx.currency === 'USD' ? 'دلار آمریکایی' : 'افغانی'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">صندوق / محل واریز:</span>
                      <span className="font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200 inline-block">
                        {trx.cashRegister === 'usd_cash'
                          ? 'صندوق دلار شرکت'
                          : trx.cashRegister === 'afn_cash'
                          ? 'صندوق افغانی شرکت'
                          : trx.cashRegister === 'exchange_usd_cash'
                          ? 'صندوق صرافی و تبدیل'
                          : 'صندوق شرکت'}
                      </span>
                    </div>
                  </div>

                  {/* Customer Balance Status on Transaction Receipt */}
                  {partyInfo && (() => {
                    const partyBal = trx.currency === 'AFN' ? partyInfo.balanceAFN : partyInfo.balanceUSD;
                    return (
                      <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-lg border border-slate-300 text-xs">
                        <span className="font-bold text-slate-700">الباقی کل مانده حساب شخص در سیستم:</span>
                        <span className={`font-mono font-black ${partyBal < 0 ? 'text-rose-700' : partyBal > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                          {formatNumber(Math.abs(partyBal))} {trx.currency}{' '}
                          <span className="font-sans text-[10.5px]">
                            {partyBal < 0 ? '(قرضدار ما)' : partyBal > 0 ? '(طلبکار)' : '(تسویه کامل - صفر)'}
                          </span>
                        </span>
                      </div>
                    );
                  })()}

                  <div className="pt-1">
                    <span className="text-slate-500 block text-[10px] font-bold mb-1">بابت / توضیحات سند:</span>
                    <p className="text-slate-900 font-medium bg-white p-3 rounded-lg border border-slate-200 text-[11.5px] leading-relaxed">
                      {trx.description || 'تسویه نقدی بابت فاکتور و حساب تجارتی'}
                    </p>
                  </div>
                </div>

                {showSignatures && (
                  <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-center text-[10.5px]">
                    {/* Right: Issuer / Cashier signature */}
                    <div className="relative">
                      <span className="text-slate-500 block mb-1 font-bold">امضای صادرکننده / مسئول صندوق</span>
                      <div className="relative min-h-[44px] flex items-center justify-center">
                        {showSignature && signatureUrl ? (
                          <img
                            src={signatureUrl}
                            alt="امضای صادرکننده"
                            style={{
                              height: `${Math.min(signatureSize, 46)}px`,
                              maxWidth: `${Math.round(signatureSize * 2.5)}px`,
                            }}
                            className="object-contain select-none z-10 filter contrast-125 pointer-events-none"
                          />
                        ) : (
                          <span className="text-[9.5px] text-slate-300">(محل امضا)</span>
                        )}
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black truncate px-1">
                        {companySettings.name}
                      </div>
                    </div>

                    {/* Center: Official Company Stamp (وسط دو امضا) */}
                    <div className="relative">
                      <span className="text-slate-500 block mb-1 font-bold">مهر رسمی شرکت</span>
                      <div className="relative min-h-[44px] flex items-center justify-center">
                        {showStamp ? (
                          <div className="select-none pointer-events-none opacity-95 flex items-center justify-center">
                            <CompanyStampSeal size={Math.min(stampSize, 52)} stampUrl={stampUrl} color={stampColor} tilt={true} />
                          </div>
                        ) : (
                          <span className="text-[9.5px] text-slate-300">(محل مهر شرکت)</span>
                        )}
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                        تأییدیه مالی شرکت
                      </div>
                    </div>

                    {/* Left: Customer / Party signature */}
                    <div>
                      <span className="text-slate-500 block mb-1 font-bold">امضای طرف حساب</span>
                      <div className="relative min-h-[44px] flex items-center justify-center">
                        <span className="text-[9.5px] text-slate-300">(محل امضا و اثر انگشت)</span>
                      </div>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black truncate px-1" title={trx.partyName}>
                        {trx.partyName || 'تحویل‌گیرنده / پرداخت‌کننده'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* 3. STOCK TRANSFER SLIP                                                    */}
          {/* ========================================================================= */}
          {!customContent && !invData && !trxData && trfData && (() => {
            const trf = trfData;
            const fromW = getWarehouseName(trf.fromWarehouseId);
            const toW = getWarehouseName(trf.toWarehouseId);

            return (
              <div className="relative z-10 space-y-3">
                <div className="p-3.5 rounded-xl border-2 border-indigo-600 bg-white flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-black text-xl shadow-xs">
                      گدام
                    </div>
                    <div>
                      <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                        {companySettings.name} • حواله انتقال بین گدام‌ها
                      </h1>
                      <p className="text-[10.5px] text-slate-600 font-medium">
                        سند رسمی جابجایی و انتقال کالا میان گدام‌های شرکت
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono shrink-0 flex flex-col items-end">
                    <span className="inline-block text-[11px] font-black px-3 py-1 rounded-lg bg-indigo-100 text-indigo-950 border border-indigo-300">
                      حواله جابجایی گدام
                    </span>
                    <div className="text-xs font-black text-slate-900 mt-1">
                      شماره: #{trf.transferNumber}
                    </div>
                    <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                      تاریخ: {trf.date}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">گدام مبدا (خروج):</span>
                      <strong className="text-sm font-black text-rose-700">{fromW}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">گدام مقصد (ورود):</span>
                      <strong className="text-sm font-black text-emerald-700">{toW}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">نام کالا و جنس:</span>
                      <strong className="text-sm font-black text-slate-900">{trf.productName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold mb-0.5">مقدار کل انتقالی:</span>
                      <strong className="text-sm font-black text-blue-900 font-mono">
                        {formatNumber(trf.tonsCount)} تن ({formatNumber(trf.bagsCount)} خریطه)
                      </strong>
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className="text-slate-500 block text-[10px] font-bold mb-1">توضیحات و مشخصات راننده / موتر:</span>
                    <p className="text-slate-900 font-medium bg-white p-3 rounded-lg border border-slate-200 text-[11.5px] leading-relaxed">
                      {trf.notes || 'انتقال کالا با تایید گدام‌دار مبدا و تحویل‌گیرنده گدام مقصد صورت پذیرفت.'}
                    </p>
                  </div>
                </div>

                {showSignatures && (
                  <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-center text-[10.5px]">
                    <div>
                      <span className="text-slate-500 block mb-7 font-bold">امضا و مهر گدام مبدا</span>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                        تحویل‌دهنده کالا
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-7 font-bold">امضای راننده / حمل‌کننده</span>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                        راننده موتر
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-7 font-bold">امضا و مهر گدام مقصد</span>
                      <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                        تحویل‌گیرنده کالا
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* 4. FINANCIAL REPORT / LEDGER / CARDS & TABLES                             */}
          {/* ========================================================================= */}
          {!customContent && !invData && !trxData && !trfData && document.type !== 'party_statement' && document.type !== 'product_cardex' && document.type !== 'customer_consignment_cardex' && document.type !== 'consignment_delivery_slip' && !document.consignmentDelivery && document.type !== 'products_inventory_report' && document.type !== 'cash_transfer_voucher' && document.type !== 'currency_exchange' && (() => {
            const repTitle = document.title || 'گزارش رسمی مالی و کاردکس سیستم';
            const repSubtitle = document.subtitle || `سیستم حسابداری و کاردکس یکپارچه • تاریخ: ${getPersianDate()}`;
            const headers = document.tableHeaders || [];
            const rows = document.tableRows || [];
            const summaryCards = document.summaryCards || [];

              return (
                <div className="relative z-10 space-y-3">
                  {/* Report Header */}
                  <div className="p-3.5 rounded-xl border-2 border-slate-900 bg-white flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      {companySettings.logoUrl ? (
                        <img
                          src={companySettings.logoUrl}
                          alt={companySettings.name}
                          className="w-12 h-12 object-contain rounded-lg bg-white border border-slate-300 p-0.5"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                          {companySettings.logoIconText || 'ن'}
                        </div>
                      )}
                      <div>
                        <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                          {companySettings.name} • {repTitle}
                        </h1>
                        <p className="text-[10.5px] text-slate-600 font-medium">{repSubtitle}</p>
                      </div>
                    </div>

                    <div className="text-left font-mono shrink-0 flex flex-col items-end">
                      <span className="inline-block text-[11px] font-black px-3 py-1 rounded-lg bg-slate-900 text-white">
                        دفتر رسمی و گزارش مالی
                      </span>
                      <div className="text-[10.5px] text-slate-600 font-sans mt-1">
                        تاریخ چاپ: {getPersianDate()}
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  {summaryCards.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {summaryCards.map((card, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-center"
                        >
                          <span className="text-[10px] text-slate-600 block font-bold mb-0.5">
                            {card.label}
                          </span>
                          <strong className="text-sm sm:text-base font-black text-slate-900 font-mono">
                            {card.value}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Detailed Table */}
                  {headers.length > 0 && (
                    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-right border-collapse text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-900 text-white font-black">
                            {headers.map((h, hIdx) => (
                              <th
                                key={hIdx}
                                className="p-2 border border-slate-700 font-black text-center whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length > 0 ? (
                            rows.map((r, rIdx) => (
                              <tr
                                key={rIdx}
                                className={`border-b border-slate-200 ${
                                  rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                                }`}
                              >
                                {r.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`p-2 border border-slate-200 font-medium ${
                                      cIdx === 0 || cIdx === 1 ? 'text-center font-mono' : ''
                                    } ${
                                      String(cell).includes('افغانی') || String(cell).includes('دلار')
                                        ? 'font-mono font-bold'
                                        : ''
                                    }`}
                                  >
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={headers.length}
                                className="p-6 text-center text-slate-500 font-medium"
                              >
                                هیچ رکوردی در این گزارش یافت نشد.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Notes / Signatures */}
                  {showSignatures && (
                    <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200 text-center text-[10.5px]">
                      <div>
                        <span className="text-slate-500 block mb-7 font-bold">تنظیم‌کننده گزارش</span>
                        <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                          امور مالی و حسابداری
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-7 font-bold">تایید مدیر مالی</span>
                        <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                          مدیریت مالی شرکت
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-7 font-bold">تایید و امضای مدیریت عامله</span>
                        <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black">
                          {companySettings.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Footer note */}
          <div className="pt-2 text-center text-[9px] text-slate-400 font-mono border-t border-slate-200 mt-3">
            {companySettings.name} • {companySettings.phone} • تاریخ چاپ: {getPersianDate()} • سیستم یکپارچه تجارتی A4
          </div>
        </div>
      </div>

      {/* Digital Signature and Seal Settings Modal */}
      <SignatureAndSealModal
        isOpen={isSealModalOpen}
        onClose={() => setIsSealModalOpen(false)}
        onApply={newSettings => {
          setShowStamp(newSettings.showStamp);
          setShowSignature(newSettings.showSignature);
          if (newSettings.stampUrl !== undefined) setStampUrl(newSettings.stampUrl);
          if (newSettings.signatureUrl !== undefined) setSignatureUrl(newSettings.signatureUrl);
          if (newSettings.stampColor) setStampColor(newSettings.stampColor);
          if (newSettings.stampSize !== undefined) setStampSize(newSettings.stampSize);
          if (newSettings.signatureSize !== undefined) setSignatureSize(newSettings.signatureSize);
        }}
      />
    </div>
  );
};

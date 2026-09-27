import React from 'react';
import { Invoice, InvoiceItem } from '../../types';
import {
  formatNumber,
  formatCurrency,
  numberToPersianWords,
} from '../../utils/formatters';
import { CompanyStampSeal } from '../CompanyStampSeal';
import {
  Building2,
  User,
  Scissors,
  Phone,
  MapPin,
  ShieldCheck,
  Package,
} from 'lucide-react';

export type InvoiceTheme = 'navy' | 'gold' | 'emerald' | 'classic';

interface PrintInvoiceDocumentProps {
  inv: Invoice;
  companySettings: any;
  invoiceLayout: 'invoice_full' | 'combo_a4' | 'invoice_only' | 'warehouse_only' | 'thermal';
  showSignatures: boolean;
  showCustomerBalance: boolean;
  showStamp?: boolean;
  showSignature?: boolean;
  stampUrl?: string;
  signatureUrl?: string;
  stampColor?: 'navy' | 'blue' | 'red';
  stampSize?: number;
  signatureSize?: number;
  invoiceTheme?: InvoiceTheme;
  showWatermark?: boolean;
  watermarkText?: string;
  showBarcode?: boolean;
  getPartyExtraInfo: (partyId?: string, partyName?: string) => any;
  getWarehouseName: (warehouseId?: string) => string;
}

export const PrintInvoiceDocument: React.FC<PrintInvoiceDocumentProps> = ({
  inv,
  companySettings,
  invoiceLayout,
  showSignatures = true,
  showCustomerBalance = false,
  showStamp = true,
  showSignature = true,
  stampUrl,
  signatureUrl,
  stampColor = 'navy',
  stampSize = 58,
  signatureSize = 48,
  invoiceTheme = 'navy',
  showWatermark = false,
  watermarkText = 'رسمی',
  getPartyExtraInfo,
  getWarehouseName,
}) => {
  const isReturnSell = inv.type === 'return_sell';
  const isReturnBuy = inv.type === 'return_buy';
  const isSale = inv.type === 'sell' || isReturnSell;

  // Party Extra Information & Contacts
  const partyInfo = getPartyExtraInfo(inv.partyId, inv.partyName);
  const partyPhone = inv.partyPhone || partyInfo?.phone || '---';
  const partyAddress = inv.partyAddress || partyInfo?.address || '---';
  const issueTime = inv.issueTime || '۰۲:۳۸ بعد از ظهر';

  // Financial Calculations
  const discountVal = Number(inv.discount || 0);
  const shippingVal = Number(inv.shippingCost || 0);
  const taxVal = Number(inv.tax || 0);
  const extraExpVal = Number(inv.extraExpensesTotal || 0);
  const subtotalVal = Number(
    inv.subtotalAmount ||
      inv.subtotal ||
      inv.totalAmount + discountVal - shippingVal - taxVal - extraExpVal
  );

  const remainingBalance =
    inv.balanceAmount !== undefined
      ? inv.balanceAmount
      : inv.totalAmount - (inv.paidAmount || 0);

  const items = inv.items || [];

  // Digital Signature Graphic
  const renderDigitalSignature = (size: number) => {
    if (signatureUrl) {
      return (
        <img
          src={signatureUrl}
          alt="امضای صادرکننده"
          style={{
            height: `${size}px`,
            maxHeight: `${Math.round(size * 1.3)}px`,
            maxWidth: `${Math.round(size * 2.8)}px`,
          }}
          className="object-contain select-none pointer-events-none"
        />
      );
    }
    return (
      <div className="transform -rotate-6 scale-90">
        <svg
          width="90"
          height="28"
          viewBox="0 0 160 60"
          className="text-blue-900 stroke-current fill-none"
        >
          <path
            d="M 15 35 Q 35 10, 60 30 T 110 25 T 145 35"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 40 45 Q 80 15, 120 40"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  };

  // Digital Stamp Graphic
  const renderDigitalStamp = (size: number) => {
    return (
      <div className="select-none pointer-events-none opacity-90 flex items-center justify-center">
        <CompanyStampSeal
          size={size}
          stampUrl={stampUrl}
          color={stampColor}
          tilt={true}
        />
      </div>
    );
  };

  // Watermark Component
  const renderWatermark = () => {
    if (!showWatermark) return null;
    return (
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
        <div className="transform -rotate-25 text-slate-900/[0.04] font-black text-8xl tracking-widest border-4 border-slate-900/[0.03] rounded-3xl px-10 py-4">
          {watermarkText}
        </div>
      </div>
    );
  };

  // =========================================================================
  // 1. FULL A4 INVOICE (فاکتور رسمی استاندارد A4 - طرح اصلی، بسیار خوانا، زیبا و با ابعاد دقیق)
  // بدون هیچ‌گونه بسم الله جهت حفظ احترام شرعی و جلوگیری از زیر پا افتادن کاغذ
  // =========================================================================
  const renderFullA4Invoice = () => {
    // Fill to at least 7 rows for an elegant full A4 appearance
    const targetRowCount = Math.max(7, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-900 p-4 sm:p-6 border-2 border-slate-900 rounded-xl relative flex flex-col justify-between select-text"
        dir="rtl"
        style={{ minHeight: '275mm' }}
      >
        {renderWatermark()}

        <div className="space-y-3.5 relative z-10">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-3">
            {/* Right: Meta Information */}
            <div className="text-right text-xs text-slate-800 space-y-1 min-w-[150px]">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">شماره فاکتور:</span>
                <strong className="text-slate-950 font-mono font-black text-sm">
                  #{inv.invoiceNumber}
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">تاریخ ثبت:</span>
                <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">ساعت ثبت:</span>
                <strong className="text-slate-900 font-mono">{issueTime}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">نوع معامله:</span>
                <strong className="text-slate-950 font-bold">
                  {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی (اعتباری)')}
                </strong>
              </div>
            </div>

            {/* Center: Company Name & Official Invoice Badge */}
            <div className="text-center flex flex-col items-center justify-center flex-1 px-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
              </h1>
              <div className="mt-1.5">
                <span className="inline-block bg-sky-100 text-sky-900 border border-sky-300 text-xs font-black px-4 py-1 rounded-full shadow-2xs">
                  {isReturnSell
                    ? 'فاکتور رسمی برگشت از فروش کالا'
                    : isReturnBuy
                    ? 'فاکتور رسمی برگشت از خرید کالا'
                    : isSale
                    ? 'فاکتور رسمی فروش کالا و خدمات'
                    : 'فاکتور رسمی خرید کالا و خدمات'}
                </span>
              </div>
            </div>

            {/* Left: Company Logo */}
            <div className="flex items-center justify-end min-w-[150px]">
              {companySettings.logoUrl ? (
                <img
                  src={companySettings.logoUrl}
                  alt={companySettings.name}
                  className="w-16 h-16 object-contain rounded-full bg-white border-2 border-slate-300 p-0.5 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-slate-900 bg-white text-slate-900 flex flex-col items-center justify-center font-black text-xs shadow-xs p-1 text-center">
                  <Building2 className="w-6 h-6 text-slate-700 mb-0.5" />
                  <span className="text-[8px] font-mono leading-tight truncate max-w-[60px]">
                    {companySettings.name?.slice(0, 16) || 'شرکت تجارتی'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Company & Customer Information Cards (Two Boxes Side-by-Side) */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Right Box: اطلاعات شرکت (صادرکننده) */}
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-700" />
                  <span>مشخصات فروشنده / صادرکننده</span>
                </span>
                <span className="font-mono text-slate-600 text-[10px]">
                  کد/TIN: {companySettings.taxId || companySettings.tin || companySettings.commercialCode || '1'}
                </span>
              </div>
              <div className="p-2 space-y-1 text-slate-800 leading-normal">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">واحد تجاری:</span>
                  <strong className="text-slate-950 font-bold truncate max-w-[240px]">
                    {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">تلفن تماس:</span>
                  <span className="text-slate-900 font-mono font-bold">
                    {companySettings.phone || '0794511271'}
                    {companySettings.phoneSecondary && ` - ${companySettings.phoneSecondary}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">آدرس:</span>
                  <span className="truncate max-w-[240px]">
                    {companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}
                  </span>
                </div>
              </div>
            </div>

            {/* Left Box: اطلاعات طرف حساب (مشتری) */}
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-100 px-3 py-1 border-b border-slate-200 flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  <span>مشخصات خریدار / مشتری</span>
                </span>
                <span className="font-mono text-slate-600 text-[10px]">
                  کد تفصیلی: {partyInfo?.code || partyInfo?.numericCode || '139'}
                </span>
              </div>
              <div className="p-2 space-y-1 text-slate-800 leading-normal">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">مشتری محترم:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[240px]">
                    {inv.partyName || 'مشتری نقدی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">شماره تماس:</span>
                  <span className="text-slate-900 font-mono font-bold">{partyPhone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">آدرس:</span>
                  <span className="truncate max-w-[240px]">{partyAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Items Table */}
          <div className="border border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[38%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold h-8 border-b border-slate-900 text-xs">
                  <th className="py-1 px-1.5 border-l border-white/20 text-center">#</th>
                  <th className="py-1 px-2.5 border-l border-white/20 text-right">شرح کالا یا خدمات</th>
                  <th className="py-1 px-1.5 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-1 px-1.5 border-l border-white/20 text-center">واحد</th>
                  <th className="py-1 px-2 border-l border-white/20 text-center">قیمت فی ({inv.currency})</th>
                  <th className="py-1 px-2 border-l border-white/20 text-center">جمع کل ({inv.currency})</th>
                  <th className="py-1 px-1.5 text-center">توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((it, idx) => {
                  if (!it) {
                    return (
                      <tr key={`inv-empty-${idx}`} className="border-b border-slate-200 h-7">
                        <td className="py-1 px-1 border-l border-slate-200 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-1 border-l border-slate-200"></td>
                        <td className="py-1 px-1 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-1"></td>
                      </tr>
                    );
                  }
                  const unitDisplay = it.unit
                    ? it.unit === 'bag'
                      ? 'کیسه (37Kg)'
                      : it.unit === 'ton'
                      ? 'تُن'
                      : it.unit
                    : 'کیسه (37Kg)';

                  return (
                    <tr
                      key={`inv-it-${idx}`}
                      className="border-b border-slate-200 font-bold h-7.5 hover:bg-slate-50"
                    >
                      <td className="py-1 px-1.5 border-l border-slate-200 text-center font-mono text-slate-700">
                        {idx + 1}
                      </td>
                      <td
                        className="py-1 px-2.5 border-l border-slate-200 text-slate-950 font-bold truncate"
                        title={it.productName}
                      >
                        {it.productName}
                      </td>
                      <td className="py-1 px-1.5 border-l border-slate-200 text-center font-mono font-black text-slate-950">
                        {formatNumber(it.quantity)}
                      </td>
                      <td className="py-1 px-1.5 border-l border-slate-200 text-center text-slate-800 text-[11px]">
                        {unitDisplay}
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-center font-mono text-slate-900">
                        {formatNumber(it.unitPrice)}
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-center font-mono font-black text-slate-950">
                        {formatNumber(it.totalPrice)}
                      </td>
                      <td className="py-1 px-1.5 text-center text-slate-500 text-[10px] truncate">
                        {it.description || '---'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Area: Terms on Right & Financial Table on Left */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Right: قوانین و شرایط عمومی معامله + باکس برجسته مبلغ کل به حروف */}
            <div className="border border-slate-300 rounded-lg p-2.5 bg-white flex flex-col justify-between leading-relaxed space-y-2 shadow-2xs">
              <div>
                <div className="font-black text-slate-950 text-xs mb-1">
                  قوانین و شرایط عمومی معامله:
                </div>
                <div className="text-slate-700 text-[11px] space-y-0.5 pr-1">
                  <p>• لطفاً هنگام دریافت کالا مشخصات و سلامت جنس را بررسی نمایید.</p>
                  <p>• فاکتور هذا بدون مهر و امضای معتبر شرکت فاقد ارزش قانونی می‌باشد.</p>
                  <p>• اجناس فروخته شده پس از خروج از گدام و تایید تحویل‌گیرنده واپس گرفته نمی‌شود.</p>
                </div>
              </div>

              {/* الزام قانونی حسابداری: مبلغ کل به حروف */}
              <div className="bg-sky-50 border border-sky-300 rounded-lg p-2 flex items-center justify-between text-xs">
                <span className="text-sky-900 font-bold shrink-0">مبلغ کل به حروف:</span>
                <span className="text-slate-950 font-black font-sans truncate mr-2">
                  {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
                </span>
              </div>
            </div>

            {/* Left: Financial Breakdown Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white text-xs shadow-2xs">
              <table className="w-full text-right border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1 px-3 text-slate-600">جمع کل ناخالص:</td>
                    <td className="py-1 px-3 text-left font-mono font-bold text-slate-950">
                      {inv.currency} {formatNumber(subtotalVal)}
                    </td>
                  </tr>
                  {shippingVal > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="py-1 px-3 text-slate-600">هزینه کرایه حمل:</td>
                      <td className="py-1 px-3 text-left font-mono font-bold text-slate-800">
                        {inv.currency} {formatNumber(shippingVal)} +
                      </td>
                    </tr>
                  )}
                  {discountVal > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="py-1 px-3 text-slate-600">تخفیف کلی فاکتور:</td>
                      <td className="py-1 px-3 text-left font-mono font-bold text-slate-800">
                        {inv.currency} {formatNumber(discountVal)} -
                      </td>
                    </tr>
                  )}
                  {taxVal > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="py-1 px-3 text-slate-600">مالیات و عوارض قانونی:</td>
                      <td className="py-1 px-3 text-left font-mono font-bold text-slate-800">
                        {inv.currency} {formatNumber(taxVal)} +
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-200 bg-sky-50">
                    <td className="py-1.5 px-3 font-bold text-sky-900 text-xs">مبلغ نهایی قابل پرداخت:</td>
                    <td className="py-1.5 px-3 text-left font-mono font-black text-sky-900 text-sm">
                      {inv.currency} {formatNumber(inv.totalAmount)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1 px-3 text-slate-600">مبلغ پرداخت‌شده نقدی:</td>
                    <td className="py-1 px-3 text-left font-mono font-bold text-slate-800">
                      {inv.currency} {formatNumber(inv.paidAmount || 0)}
                    </td>
                  </tr>
                  <tr className="bg-rose-50/70">
                    <td className="py-1 px-3 font-bold text-rose-800">مبلغ باقی‌مانده (بدهی):</td>
                    <td className="py-1 px-3 text-left font-mono font-black text-rose-700 text-xs">
                      {inv.currency} {formatNumber(remainingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures of Main Invoice (3 Columns) with Stamps */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-4 pt-2 text-center text-xs">
              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-1">امضاء و مهر صادرکننده / تحویل‌دهنده</span>
                <div className="h-12 flex items-center justify-center relative">
                  {showSignature && renderDigitalSignature(signatureSize)}
                  {showStamp && (
                    <div className="absolute -top-1 opacity-90">
                      {renderDigitalStamp(stampSize)}
                    </div>
                  )}
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                  ....................................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-1">امضاء و تایید مسئول مالی و حسابداری</span>
                <div className="h-12 flex items-center justify-center text-slate-500 font-mono text-[11px]">
                  تایید شده
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                  ....................................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-1">امضاء و تایید مشتری / خریدار محترم</span>
                <div className="h-12 flex items-center justify-center text-slate-400 font-mono text-[11px]">
                  رویت و دریافت شد
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                  ....................................................................
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Clean Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-600 pt-2 border-t border-slate-300 mt-4 shrink-0">
          <div>
            سند معامله رسمی معتبر صادر شده توسط سیستم مالی {companySettings.name || 'شرکت'}
          </div>
          <div className="font-mono">
            آدرس: {companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'} | تلفن تماس:{' '}
            {companySettings.phone || '0794511271'}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 2. COMBO A4 INVOICE (فاکتور ۲/۳ + حواله گدام ۱/۳ با خط برش)
  // =========================================================================
  const renderComboA4Invoice = () => {
    const targetRowCount = Math.max(5, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-900 p-3 sm:p-4 border-2 border-slate-900 rounded-xl relative space-y-2 select-text"
        dir="rtl"
      >
        {renderWatermark()}

        {/* SECTION 1: MAIN INVOICE (بالای برگه) */}
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center justify-between gap-2 border-b border-slate-300 pb-1.5">
            <div className="text-right text-[10px] text-slate-800 space-y-0.5 min-w-[120px]">
              <div>
                <span className="text-slate-500 font-medium">شماره: </span>
                <strong className="text-slate-950 font-mono font-black text-xs">#{inv.invoiceNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">تاریخ: </span>
                <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">نوع پرداخت: </span>
                <strong className="text-slate-900 font-bold">
                  {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی')}
                </strong>
              </div>
            </div>

            <div className="text-center flex-1 px-1">
              <h1 className="text-base font-black text-slate-950">
                {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
              </h1>
              <span className="inline-block bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-bold px-3 py-0.5 rounded-full mt-0.5">
                {isSale ? 'فاکتور رسمی فروش کالا' : 'فاکتور رسمی خرید کالا'}
              </span>
            </div>

            <div className="flex items-center justify-end min-w-[120px]">
              {companySettings.logoUrl ? (
                <img
                  src={companySettings.logoUrl}
                  alt={companySettings.name}
                  className="w-12 h-12 object-contain rounded-full bg-white border border-slate-300 p-0.5"
                />
              ) : (
                <div className="w-12 h-12 rounded-full border border-slate-800 bg-white text-slate-900 flex flex-col items-center justify-center font-black text-[9px] p-0.5 text-center">
                  <Building2 className="w-4 h-4 text-slate-700" />
                </div>
              )}
            </div>
          </div>

          {/* Company & Customer row */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50">
              <div className="truncate"><span className="text-slate-500">فروشنده: </span><strong>{companySettings.name}</strong></div>
              <div className="font-mono text-[9px]"><span className="text-slate-500 font-sans">تلفن: </span>{companySettings.phone}</div>
            </div>
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50">
              <div className="truncate"><span className="text-slate-500">خریدار: </span><strong className="text-slate-950 font-black">{inv.partyName || 'نقدی'}</strong></div>
              <div className="font-mono text-[9px]"><span className="text-slate-500 font-sans">تلفن: </span>{partyPhone}</div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-900 rounded overflow-hidden">
            <table className="w-full text-right border-collapse text-[10px] table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[40%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold h-6 text-[10px]">
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-right">شرح کالا</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">واحد</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">فی ({inv.currency})</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-center">جمع ({inv.currency})</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((it, idx) => (
                  <tr key={`cb-inv-${idx}`} className="border-b border-slate-200 font-bold h-5.5">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                    <td className="py-0.5 px-2 border-l border-slate-200 truncate">{it?.productName || ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono">{it ? formatNumber(it.quantity) : ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-[9px]">{it?.unit === 'bag' ? 'کیسه' : it?.unit === 'ton' ? 'تُن' : it?.unit || ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono">{it ? formatNumber(it.unitPrice) : ''}</td>
                    <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.totalPrice) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Area */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="border border-slate-300 rounded p-1.5 flex flex-col justify-between">
              <div className="text-[9px] text-slate-600">فاکتور هذا بدون مهر و امضا فاقد اعتبار است.</div>
              <div className="bg-sky-50 border border-sky-200 rounded p-1 text-[9.5px] font-bold">
                مبلغ به حروف: {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
              </div>
            </div>

            <div className="border border-slate-300 rounded overflow-hidden text-[9.5px]">
              <table className="w-full text-right border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2 text-slate-600">جمع کل:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-bold">{inv.currency} {formatNumber(subtotalVal)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-sky-50/50">
                    <td className="py-0.5 px-2 font-bold text-sky-900">مبلغ نهایی:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-black text-sky-900 text-[11px]">{inv.currency} {formatNumber(inv.totalAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-2 text-rose-800 font-bold">باقیمانده:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-black text-rose-700">{inv.currency} {formatNumber(remainingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {showSignatures && (
            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[9px]">
              <div>
                <span className="font-bold text-slate-800 block mb-1">امضاء و مهر صادرکننده</span>
                <div className="h-8 flex items-center justify-center">
                  {showSignature && renderDigitalSignature(36)}
                  {showStamp && <div className="absolute">{renderDigitalStamp(42)}</div>}
                </div>
                <div className="border-t border-dotted border-slate-400"></div>
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-1">مسئول مالی</span>
                <div className="h-8 flex items-center justify-center text-slate-400">تایید شد</div>
                <div className="border-t border-dotted border-slate-400"></div>
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-1">خریدار محترم</span>
                <div className="h-8 flex items-center justify-center text-slate-400">دریافت شد</div>
                <div className="border-t border-dotted border-slate-400"></div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: PERFORATED CUT LINE */}
        <div className="relative my-2 flex items-center justify-center select-none shrink-0">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-slate-400" />
          </div>
          <div className="relative bg-white px-3 flex items-center gap-1.5 text-slate-700 text-[9px] font-bold border border-slate-300 rounded-full shadow-2xs">
            <Scissors className="w-3 h-3 text-slate-600 -rotate-90" />
            <span>محل برش برگه حواله گدامدار</span>
          </div>
        </div>

        {/* SECTION 3: WAREHOUSE EXIT SLIP */}
        <div className="border border-slate-300 rounded-lg p-2 bg-white space-y-1.5 text-[9.5px] relative z-10">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[9px]">
            <div className="flex items-center gap-1 font-black text-slate-950">
              <Package className="w-3.5 h-3.5 text-slate-700" />
              <span>برگه حواله خروج کالا از گدام (نسخه گدام‌دار)</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700 font-mono">
              <div>فاکتور: <strong>#{inv.invoiceNumber}</strong></div>
              <div>تاریخ: <strong>{inv.date}</strong></div>
              <div>مشتری: <strong className="font-sans text-slate-900">{inv.partyName || 'نقدی'}</strong></div>
            </div>
          </div>

          <div className="border border-slate-900 rounded overflow-hidden">
            <table className="w-full text-right border-collapse text-[9px] table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[55%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold h-5 border-b border-slate-900 text-[9px]">
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-right">نام و مشخصات جنس</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد / مقدار</th>
                  <th className="py-0.5 px-1 text-center">واحد سنجش</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((it, idx) => (
                  <tr key={`wh-combo-${idx}`} className="border-b border-slate-200 h-5">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                    <td className="py-0.5 px-2 border-l border-slate-200 truncate font-bold">{it?.productName || ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.quantity) : ''}</td>
                    <td className="py-0.5 px-1 text-center text-slate-700">{it?.unit === 'bag' ? 'کیسه (37Kg)' : it?.unit === 'ton' ? 'تُن' : it?.unit || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showSignatures && (
            <div className="grid grid-cols-2 gap-4 pt-1 text-center text-[9px]">
              <div>
                <span className="font-bold text-slate-800 block mb-1">امضاء و مهر مسئول گدام (تحویل‌دهنده)</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                  ....................................................................
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-1">امضاء و تایید خریدار / راننده (تحویل‌گیرنده)</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                  ....................................................................
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // 3. WAREHOUSE SLIP ONLY
  // =========================================================================
  const renderWarehouseSlipOnly = () => {
    const targetRowCount = Math.max(8, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-900 p-6 border-2 border-slate-900 rounded-xl relative space-y-4 select-text"
        dir="rtl"
        style={{ minHeight: '275mm' }}
      >
        {renderWatermark()}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <h1 className="text-xl font-black text-slate-950">
              {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
            </h1>
            <p className="text-xs text-slate-600 font-bold mt-1">حواله رسمی خروج و تحویل اجناس از گدام</p>
          </div>
          <div className="text-left font-mono text-xs space-y-1">
            <div>شماره فاکتور: <strong>#{inv.invoiceNumber}</strong></div>
            <div>تاریخ: <strong>{inv.date}</strong></div>
            <div>مشتری: <strong className="font-sans text-slate-950">{inv.partyName || 'نقدی'}</strong></div>
          </div>
        </div>

        <div className="border border-slate-900 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-right border-collapse text-xs table-fixed">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[50%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="bg-[#0f172a] text-white font-bold h-8 text-xs">
                <th className="py-1 px-2 border-l border-white/20 text-center">#</th>
                <th className="py-1 px-3 border-l border-white/20 text-right">نام و مشخصات جنس</th>
                <th className="py-1 px-2 border-l border-white/20 text-center">تعداد / مقدار</th>
                <th className="py-1 px-2 border-l border-white/20 text-center">واحد سنجش</th>
                <th className="py-1 px-2 text-center">توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((it, idx) => (
                <tr key={`wh-only-${idx}`} className="border-b border-slate-200 h-8 font-bold">
                  <td className="py-1 px-2 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                  <td className="py-1 px-3 border-l border-slate-200 truncate">{it?.productName || ''}</td>
                  <td className="py-1 px-2 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.quantity) : ''}</td>
                  <td className="py-1 px-2 border-l border-slate-200 text-center text-slate-700">{it?.unit === 'bag' ? 'کیسه (37Kg)' : it?.unit === 'ton' ? 'تُن' : it?.unit || ''}</td>
                  <td className="py-1 px-2 text-center text-slate-500 text-[10px]">{it?.description || '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showSignatures && (
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
            <div>
              <span className="font-bold text-slate-900 block mb-4">امضاء و مهر مسئول گدام (تایید تحویل کالا)</span>
              <div className="border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                ..................................................................................................
              </div>
            </div>
            <div>
              <span className="font-bold text-slate-900 block mb-4">امضاء و تایید خریدار / راننده (تایید دریافت کالا)</span>
              <div className="border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                ..................................................................................................
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 4. THERMAL RECEIPT
  // =========================================================================
  const renderThermalReceipt = () => {
    return (
      <div className="font-mono text-slate-900 bg-white p-3 space-y-2 border border-slate-300 rounded text-xs leading-tight max-w-[320px] mx-auto select-none" dir="rtl">
        <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-1">
          <div className="font-black text-sm text-slate-950 font-sans">
            {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
          </div>
          <div className="text-[10px] text-slate-600 font-sans">رسید چاپی معامله</div>
          <div className="text-[10px] text-slate-600">{companySettings.phone}</div>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>شماره:</span>
            <strong>#{inv.invoiceNumber}</strong>
          </div>
          <div className="flex justify-between">
            <span>تاریخ:</span>
            <span>{inv.date} ({issueTime})</span>
          </div>
          <div className="flex justify-between">
            <span>مشتری:</span>
            <strong>{inv.partyName || 'نقدی'}</strong>
          </div>
        </div>

        <table className="w-full text-right border-collapse text-xs table-fixed">
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[20%]" />
            <col className="w-[35%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-400 font-bold">
              <th className="py-1 text-right">کالا</th>
              <th className="py-1 text-center">تعداد</th>
              <th className="py-1 text-left">مجموع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={`th-${idx}`} className="border-b border-slate-200">
                <td className="py-1 truncate">{it.productName}</td>
                <td className="py-1 text-center font-bold">{formatNumber(it.quantity)}</td>
                <td className="py-1 text-left font-bold">{formatNumber(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 pt-1.5 border-t border-dashed border-slate-400 text-xs">
          <div className="flex justify-between font-black text-sm">
            <span>مبلغ کل:</span>
            <span>{formatCurrency(inv.totalAmount, inv.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-700">
            <span>پرداخت نقدی:</span>
            <span>{formatCurrency(inv.paidAmount || 0, inv.currency)}</span>
          </div>
          <div className="flex justify-between font-bold text-rose-700">
            <span>باقیمانده:</span>
            <span>{formatCurrency(remainingBalance, inv.currency)}</span>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-dashed border-slate-400 text-[10px] text-slate-500 font-sans">
          از خرید و همکاری شما متشکریم
        </div>
      </div>
    );
  };

  // Route to layout
  if (invoiceLayout === 'thermal') {
    return renderThermalReceipt();
  }
  if (invoiceLayout === 'warehouse_only') {
    return renderWarehouseSlipOnly();
  }
  if (invoiceLayout === 'combo_a4') {
    return renderComboA4Invoice();
  }
  // Default and 'invoice_full' / 'invoice_only':
  return renderFullA4Invoice();
};

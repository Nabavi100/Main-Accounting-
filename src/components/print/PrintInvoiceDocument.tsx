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
  Package,
} from 'lucide-react';

interface PrintInvoiceDocumentProps {
  inv: Invoice;
  companySettings: any;
  invoiceLayout: 'invoice_full' | 'combo_a4' | 'invoice_only' | 'warehouse_only' | 'thermal';
  showSignatures?: boolean;
  showCustomerBalance?: boolean;
  showStamp?: boolean;
  showSignature?: boolean;
  stampUrl?: string;
  signatureUrl?: string;
  stampColor?: 'navy' | 'blue' | 'red';
  stampSize?: number;
  signatureSize?: number;
  showWatermark?: boolean;
  watermarkText?: string;
  showBarcode?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  letterheadSpacing?: boolean;
  getPartyExtraInfo: (partyId?: string, partyName?: string) => any;
  getWarehouseName: (warehouseId?: string) => string;
}

export const PrintInvoiceDocument: React.FC<PrintInvoiceDocumentProps> = ({
  inv,
  companySettings,
  invoiceLayout,
  showSignatures = true,
  showStamp = true,
  showSignature = true,
  stampUrl,
  signatureUrl,
  stampColor = 'navy',
  stampSize = 52,
  signatureSize = 44,
  showWatermark = false,
  watermarkText = 'رسمی',
  showHeader = true,
  showFooter = true,
  letterheadSpacing = false,
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
  const partyCode = partyInfo?.code || partyInfo?.numericCode || inv.partyId?.slice(0, 6) || '---';
  const issueTime = inv.issueTime || '۰۲:۳۰ بعد از ظهر';

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
  const warehouseName = getWarehouseName(inv.warehouseId);

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
          width="85"
          height="26"
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
  // 1. FULL LEGAL A4 INVOICE (فاکتور رسمی کامل و معتبر قانونی - دقیقاً یک برگ A4)
  // بدون هیچ‌گونه اضافه بار و با طراحی منسجم و رسمی
  // =========================================================================
  const renderFullA4Invoice = () => {
    // Fill to 8 rows so the invoice has full legal stature with zero empty void
    const targetRowCount = Math.max(8, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-950 p-3 sm:p-4 border-2 border-slate-950 rounded-lg relative flex flex-col justify-between select-text"
        dir="rtl"
        style={{
          height: '280mm',
          maxHeight: '282mm',
          minHeight: '276mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {renderWatermark()}

        <div className={`space-y-2 relative z-10 flex-1 flex flex-col justify-between ${letterheadSpacing ? 'pt-16 sm:pt-24' : ''}`}>
          {/* Header Row */}
          {showHeader ? (
            <div className="flex items-center justify-between gap-3 border-b-2 border-slate-950 pb-2 shrink-0">
              {/* Right: Meta Information */}
              <div className="text-right text-xs text-slate-800 space-y-0.5 min-w-[150px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">شماره فاکتور:</span>
                  <strong className="text-slate-950 font-mono font-black text-sm">
                    #{inv.invoiceNumber}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">تاریخ صدور:</span>
                  <strong className="text-slate-950 font-mono font-bold">{inv.date}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">ساعت ثبت:</span>
                  <strong className="text-slate-900 font-mono text-[11px]">{issueTime}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">نوع تسویه:</span>
                  <strong className="text-slate-950 font-bold">
                    {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی (اعتباری)')}
                  </strong>
                </div>
              </div>

              {/* Center: Company Name & Official Invoice Badge */}
              <div className="text-center flex flex-col items-center justify-center flex-1 px-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                  {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                </h1>
                <div className="mt-1">
                  <span className="inline-block bg-slate-900 text-white text-xs font-black px-4 py-0.5 rounded-full shadow-2xs">
                    {isReturnSell
                      ? 'فاکتور رسمی برگشت از فروش کالا'
                      : isReturnBuy
                      ? 'فاکتور رسمی برگشت از خرید کالا'
                      : isSale
                      ? 'فاکتور رسمی فروش کالا و خدمات'
                      : 'فاکتور رسمی خرید کالا و خدمات'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-600 font-mono mt-0.5 font-bold">
                  کد اقتصادی / TIN: {companySettings.taxId || companySettings.tin || companySettings.commercialCode || '1015694'}
                </span>
              </div>

              {/* Left: Company Logo or Emblem */}
              <div className="flex items-center justify-end min-w-[150px]">
                {companySettings.logoUrl ? (
                  <img
                    src={companySettings.logoUrl}
                    alt={companySettings.name}
                    className="w-14 h-14 object-contain rounded-full bg-white border-2 border-slate-400 p-0.5 shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-slate-900 bg-white text-slate-900 flex flex-col items-center justify-center font-black text-xs shadow-xs p-1 text-center">
                    <Building2 className="w-5 h-5 text-slate-700 mb-0.5" />
                    <span className="text-[8px] font-mono leading-tight truncate max-w-[55px]">
                      {companySettings.name?.slice(0, 14) || 'شرکت'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-1.5 text-xs shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-600 font-medium">شماره فاکتور: </span>
                  <strong className="text-slate-950 font-mono font-black text-sm">#{inv.invoiceNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">تاریخ: </span>
                  <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">ساعت: </span>
                  <span className="text-slate-800 font-mono">{issueTime}</span>
                </div>
              </div>
              <span className="bg-slate-900 text-white text-xs font-black px-3 py-0.5 rounded-full">
                {isReturnSell ? 'فاکتور برگشت از فروش' : isSale ? 'فاکتور رسمی فروش' : 'فاکتور رسمی خرید'}
              </span>
              <div className="text-xs font-mono font-bold text-slate-700">
                {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی')}
              </div>
            </div>
          )}

          {/* Company & Customer Official Cards */}
          <div className="grid grid-cols-2 gap-2 text-xs shrink-0">
            {/* Seller Card */}
            <div className="border border-slate-400 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-100 px-2.5 py-0.5 border-b border-slate-300 flex items-center justify-between font-bold text-slate-900 text-[11px]">
                <span className="flex items-center gap-1 font-black">
                  <Building2 className="w-3.5 h-3.5 text-slate-700" />
                  <span>مشخصات فروشنده / صادرکننده</span>
                </span>
                <span className="font-mono text-slate-600 text-[10px]">
                  TIN: {companySettings.taxId || companySettings.tin || companySettings.commercialCode || '1015694'}
                </span>
              </div>
              <div className="p-1.5 space-y-0.5 text-slate-800 text-[11px] leading-tight">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">نام شرکت:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[220px]">
                    {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">شماره تماس:</span>
                  <span className="text-slate-950 font-mono font-bold">
                    {companySettings.phone || '0794511271'}
                    {companySettings.phoneSecondary && ` - ${companySettings.phoneSecondary}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">نشانی دفتر:</span>
                  <span className="truncate max-w-[220px] text-slate-800">
                    {companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}
                  </span>
                </div>
              </div>
            </div>

            {/* Buyer Card */}
            <div className="border border-slate-400 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-100 px-2.5 py-0.5 border-b border-slate-300 flex items-center justify-between font-bold text-slate-900 text-[11px]">
                <span className="flex items-center gap-1 font-black">
                  <User className="w-3.5 h-3.5 text-slate-700" />
                  <span>مشخصات خریدار / مشتری</span>
                </span>
                <span className="font-mono text-slate-600 text-[10px]">
                  کد تفصیلی: {partyCode}
                </span>
              </div>
              <div className="p-1.5 space-y-0.5 text-slate-800 text-[11px] leading-tight">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">مشتری محترم:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[220px]">
                    {inv.partyName || 'مشتری نقدی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">شماره تماس:</span>
                  <span className="text-slate-950 font-mono font-bold">{partyPhone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">آدرس / موقعیت:</span>
                  <span className="truncate max-w-[220px] text-slate-800">{partyAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Items Table */}
          <div className="border border-slate-950 rounded-lg overflow-hidden bg-white shadow-2xs flex-1">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[42%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold h-7 border-b border-slate-950 text-xs">
                  <th className="py-1 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-1 px-2 border-l border-white/20 text-right">شرح مشخصات کالا یا خدمات</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">واحد</th>
                  <th className="py-1 px-1.5 border-l border-white/20 text-center">قیمت فی ({inv.currency})</th>
                  <th className="py-1 px-2 text-center">جمع کل ({inv.currency})</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((it, idx) => {
                  if (!it) {
                    return (
                      <tr key={`inv-empty-${idx}`} className="border-b border-slate-200 h-6">
                        <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-300">
                          {idx + 1}
                        </td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-1 border-l border-slate-200"></td>
                        <td className="py-0.5 px-1 border-l border-slate-200"></td>
                        <td className="py-0.5 px-1.5 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2"></td>
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
                      className="border-b border-slate-200 font-bold h-6.5 hover:bg-slate-50"
                    >
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-700">
                        {idx + 1}
                      </td>
                      <td
                        className="py-0.5 px-2 border-l border-slate-200 text-slate-950 font-bold truncate"
                        title={it.productName}
                      >
                        {it.productName}
                      </td>
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black text-slate-950">
                        {formatNumber(it.quantity)}
                      </td>
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-800 text-[11px]">
                        {unitDisplay}
                      </td>
                      <td className="py-0.5 px-1.5 border-l border-slate-200 text-center font-mono text-slate-900">
                        {formatNumber(it.unitPrice)}
                      </td>
                      <td className="py-0.5 px-2 text-center font-mono font-black text-slate-950">
                        {formatNumber(it.totalPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Area: Terms & Financial Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-xs shrink-0">
            {/* Legal Terms & Amount in Words */}
            <div className="border border-slate-300 rounded-lg p-2 bg-white flex flex-col justify-between leading-normal space-y-1.5 shadow-2xs">
              <div>
                <div className="font-black text-slate-950 text-[11px] mb-0.5">
                  شرایط و ضوابط رسمی معامله:
                </div>
                <div className="text-slate-700 text-[10px] space-y-0.5 pr-1">
                  <p>• فاکتور هذا به منزله سند رسمی قطعی معامله بوده و بدون مهر و امضا فاقد اعتبار است.</p>
                  <p>• خریدار محترم موظف است هنگام تحویل، کمیت و کیفیت ظاهری اقلام را کنترل فرماید.</p>
                  <p>• اجناس پس از خروج از گدام ({warehouseName}) مسترد نمی‌گردد.</p>
                </div>
              </div>

              {/* Legal Requirement: Total in Persian Words */}
              <div className="bg-slate-100 border border-slate-300 rounded p-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-800 font-bold shrink-0 text-[11px]">مبلغ به حروف:</span>
                <span className="text-slate-950 font-black font-sans truncate mr-1.5 text-[11px]">
                  {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
                </span>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="border border-slate-400 rounded-lg overflow-hidden bg-white text-xs shadow-2xs">
              <table className="w-full text-right border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2.5 text-slate-600 text-[11px]">جمع ناخالص اقلام:</td>
                    <td className="py-0.5 px-2.5 text-left font-mono font-bold text-slate-950 text-[11px]">
                      {inv.currency} {formatNumber(subtotalVal)}
                    </td>
                  </tr>
                  {discountVal > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="py-0.5 px-2.5 text-slate-600 text-[11px]">تخفیف تجارتی:</td>
                      <td className="py-0.5 px-2.5 text-left font-mono font-bold text-emerald-800 text-[11px]">
                        {inv.currency} {formatNumber(discountVal)} -
                      </td>
                    </tr>
                  )}
                  {shippingVal > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="py-0.5 px-2.5 text-slate-600 text-[11px]">هزینه کرایه باربری:</td>
                      <td className="py-0.5 px-2.5 text-left font-mono font-bold text-slate-800 text-[11px]">
                        {inv.currency} {formatNumber(shippingVal)} +
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <td className="py-1 px-2.5 font-black text-slate-950 text-xs">مبلغ نهایی معامله:</td>
                    <td className="py-1 px-2.5 text-left font-mono font-black text-slate-950 text-sm">
                      {inv.currency} {formatNumber(inv.totalAmount)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2.5 text-slate-600 text-[11px]">پرداخت نقد:</td>
                    <td className="py-0.5 px-2.5 text-left font-mono font-bold text-slate-800 text-[11px]">
                      {inv.currency} {formatNumber(inv.paidAmount || 0)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="py-0.5 px-2.5 font-bold text-rose-800 text-[11px]">باقی‌مانده این فاکتور:</td>
                    <td className="py-0.5 px-2.5 text-left font-mono font-black text-rose-700 text-xs">
                      {inv.currency} {formatNumber(remainingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Signatures (3 Columns) */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-3 pt-0.5 text-center text-xs shrink-0">
              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-0.5 text-[11px]">امضاء و مهر صادرکننده</span>
                <div className="h-9 flex items-center justify-center relative">
                  {showSignature && renderDigitalSignature(signatureSize)}
                  {showStamp && (
                    <div className="absolute -top-1 opacity-90">
                      {renderDigitalStamp(stampSize)}
                    </div>
                  )}
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ............................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-0.5 text-[11px]">امضاء امور مالی و حسابداری</span>
                <div className="h-9 flex items-center justify-center text-slate-600 font-mono text-[10px]">
                  ثبت سیستم مالی گردید
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ............................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-0.5 text-[11px]">امضاء و تایید خریدار محترم</span>
                <div className="h-9 flex items-center justify-center text-slate-500 font-mono text-[10px]">
                  صحت اقلام تایید گردید
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ............................................................
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Clean Footer */}
        {showFooter && (
          <div className="flex items-center justify-between text-[9.5px] text-slate-600 pt-1 border-t border-slate-300 shrink-0 mt-1">
            <div>
              سند رسمی معامله صادر شده از سیستم حسابداری {companySettings.name || 'شرکت تجارتی'}
            </div>
            <div className="font-mono">
              آدرس: {companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'} | تلفن: {companySettings.phone || '0794511271'}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 2. COMBO A4 INVOICE (فاکتور رسمی + حواله گدام - فیکس کامل روی یک برگه A4)
  // بدون هیچ‌گونه صفحه خالی و بدون ایجاد صفحه دوم
  // =========================================================================
  const renderComboA4Invoice = () => {
    // 5 rows for upper invoice fills upper 60% with zero blank gaps
    const targetRowCount = Math.max(5, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    // 4 rows for warehouse slip fills bottom 38% with zero blank gaps
    const whRowCount = Math.max(4, items.length);
    const whRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < whRowCount; i++) {
      whRows.push(items[i] || null);
    }

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-950 p-3 sm:p-4 border-2 border-slate-950 rounded-lg relative flex flex-col justify-between select-text"
        dir="rtl"
        style={{
          height: '280mm',
          maxHeight: '282mm',
          minHeight: '276mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {renderWatermark()}

        {/* ================= SECTION 1: UPPER MAIN INVOICE (~60%) ================= */}
        <div className={`space-y-1.5 relative z-10 flex-1 flex flex-col justify-between ${letterheadSpacing ? 'pt-12' : ''}`}>
          {/* Header */}
          {showHeader ? (
            <div className="flex items-center justify-between gap-2 border-b-2 border-slate-950 pb-1 shrink-0">
              <div className="text-right text-[10px] text-slate-800 space-y-0.5 min-w-[125px]">
                <div>
                  <span className="text-slate-600 font-medium">شماره فاکتور: </span>
                  <strong className="text-slate-950 font-mono font-black text-xs">#{inv.invoiceNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">تاریخ صدور: </span>
                  <strong className="text-slate-950 font-mono font-bold">{inv.date}</strong>
                </div>
                <div>
                  <span className="text-slate-600 font-medium">نوع تسویه: </span>
                  <strong className="text-slate-950 font-bold">
                    {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی')}
                  </strong>
                </div>
              </div>

              <div className="text-center flex-1 px-1">
                <h1 className="text-base font-black text-slate-950 tracking-tight leading-tight">
                  {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                </h1>
                <div className="mt-0.5">
                  <span className="inline-block bg-slate-900 text-white text-[10px] font-black px-3 py-0.5 rounded-full">
                    {isSale ? 'فاکتور رسمی فروش کالا و خدمات' : 'فاکتور رسمی خرید کالا'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end min-w-[125px]">
                {companySettings.logoUrl ? (
                  <img
                    src={companySettings.logoUrl}
                    alt={companySettings.name}
                    className="w-11 h-11 object-contain rounded-full bg-white border border-slate-300 p-0.5"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full border border-slate-800 bg-white text-slate-900 flex flex-col items-center justify-center font-black text-[9px] p-0.5 text-center">
                    <Building2 className="w-4 h-4 text-slate-700" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-1 text-[10px] shrink-0">
              <div>
                <span className="text-slate-600 font-medium">شماره فاکتور: </span>
                <strong className="text-slate-950 font-mono font-black">#{inv.invoiceNumber}</strong>
              </div>
              <div>
                <span className="text-slate-600 font-medium">تاریخ: </span>
                <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
              </div>
              <div className="font-bold text-slate-700">
                {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی')}
              </div>
            </div>
          )}

          {/* Seller & Buyer Box */}
          <div className="grid grid-cols-2 gap-2 text-[10px] shrink-0">
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/70 leading-tight">
              <div className="truncate"><span className="text-slate-500">فروشنده: </span><strong className="text-slate-950 font-black">{companySettings.name}</strong></div>
              <div className="flex items-center justify-between font-mono text-[9px] mt-0.5">
                <span>تلفن: {companySettings.phone}</span>
                <span>TIN: {companySettings.taxId || '1015694'}</span>
              </div>
            </div>
            <div className="border border-slate-300 rounded p-1.5 bg-slate-50/70 leading-tight">
              <div className="truncate"><span className="text-slate-500">خریدار: </span><strong className="text-slate-950 font-black">{inv.partyName || 'مشتری نقدی'}</strong></div>
              <div className="flex items-center justify-between font-mono text-[9px] mt-0.5">
                <span>تلفن: {partyPhone}</span>
                <span>کد تفصیلی: {partyCode}</span>
              </div>
            </div>
          </div>

          {/* Upper Items Table */}
          <div className="border border-slate-950 rounded overflow-hidden flex-1">
            <table className="w-full text-right border-collapse text-[10px] table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[42%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold h-6 text-[10px]">
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-right">شرح مشخصات جنس</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">واحد</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">فی ({inv.currency})</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-center">جمع ({inv.currency})</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((it, idx) => (
                  <tr key={`cb-inv-${idx}`} className="border-b border-slate-200 font-bold h-5.5">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-700">{idx + 1}</td>
                    <td className="py-0.5 px-2 border-l border-slate-200 truncate">{it?.productName || ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.quantity) : ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-[9px]">{it?.unit === 'bag' ? 'کیسه' : it?.unit === 'ton' ? 'تُن' : it?.unit || ''}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono">{it ? formatNumber(it.unitPrice) : ''}</td>
                    <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.totalPrice) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Financial & Words */}
          <div className="grid grid-cols-2 gap-2 text-[10px] shrink-0">
            <div className="border border-slate-300 rounded p-1.5 flex flex-col justify-between bg-white">
              <div className="text-[9px] text-slate-600">فاکتور هذا به عنوان سند قطعی معامله بدون مهر و امضا فاقد اعتبار است.</div>
              <div className="bg-slate-100 border border-slate-300 rounded p-1 text-[9.5px] font-bold text-slate-950 truncate">
                مبلغ به حروف: {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
              </div>
            </div>

            <div className="border border-slate-300 rounded overflow-hidden text-[9.5px] bg-white">
              <table className="w-full text-right border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2 text-slate-600">جمع ناخالص:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-bold">{inv.currency} {formatNumber(subtotalVal)}</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <td className="py-0.5 px-2 font-black text-slate-950">مبلغ نهایی معامله:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-black text-slate-950 text-[11px]">{inv.currency} {formatNumber(inv.totalAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 px-2 text-rose-800 font-bold">باقیمانده:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-black text-rose-700">{inv.currency} {formatNumber(remainingBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Invoice Signatures */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-2 pt-0.5 text-center text-[9px] shrink-0">
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">امضاء و مهر صادرکننده</span>
                <div className="h-6 flex items-center justify-center relative">
                  {showSignature && renderDigitalSignature(26)}
                  {showStamp && <div className="absolute">{renderDigitalStamp(34)}</div>}
                </div>
                <div className="border-t border-dotted border-slate-400"></div>
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">مسئول مالی و ثبت</span>
                <div className="h-6 flex items-center justify-center text-slate-500 font-mono text-[9px]">ثبت سیستم شد</div>
                <div className="border-t border-dotted border-slate-400"></div>
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">خریدار محترم</span>
                <div className="h-6 flex items-center justify-center text-slate-400 font-mono text-[9px]">رویت و تایید شد</div>
                <div className="border-t border-dotted border-slate-400"></div>
              </div>
            </div>
          )}
        </div>

        {/* ================= SECTION 2: PERFORATED CUT LINE ================= */}
        <div className="relative my-1 flex items-center justify-center select-none shrink-0">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-slate-400" />
          </div>
          <div className="relative bg-white px-2.5 flex items-center gap-1.5 text-slate-700 text-[8.5px] font-bold border border-slate-300 rounded-full shadow-2xs">
            <Scissors className="w-3 h-3 text-slate-600 -rotate-90" />
            <span>محل برش برگه حواله خروج گدام (نسخه گدام‌دار)</span>
          </div>
        </div>

        {/* ================= SECTION 3: WAREHOUSE EXIT SLIP (~38%) ================= */}
        <div className="border border-slate-400 rounded-lg p-2 bg-white space-y-1 text-[9.5px] relative z-10 shrink-0">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[9px]">
            <div className="flex items-center gap-1 font-black text-slate-950">
              <Package className="w-3.5 h-3.5 text-slate-700" />
              <span>برگه حواله رسمی خروج کالا از گدام ({warehouseName})</span>
            </div>
            <div className="flex items-center gap-3 text-slate-800 font-mono">
              <div>فاکتور: <strong>#{inv.invoiceNumber}</strong></div>
              <div>تاریخ: <strong>{inv.date}</strong></div>
              <div>مشتری: <strong className="font-sans text-slate-950">{inv.partyName || 'نقدی'}</strong></div>
            </div>
          </div>

          <div className="border border-slate-950 rounded overflow-hidden">
            <table className="w-full text-right border-collapse text-[9px] table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[55%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0f172a] text-white font-bold h-5 border-b border-slate-950 text-[9px]">
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-right">نام و مشخصات جنس</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد / مقدار</th>
                  <th className="py-0.5 px-1 text-center">واحد سنجش</th>
                </tr>
              </thead>
              <tbody>
                {whRows.map((it, idx) => (
                  <tr key={`wh-combo-${idx}`} className="border-b border-slate-200 h-5 font-bold">
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
                <span className="font-bold text-slate-800 block mb-0.5">امضاء و مهر مسئول گدام (تحویل‌دهنده)</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                  ....................................................................
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-800 block mb-0.5">امضاء و تایید خریدار / راننده (تحویل‌گیرنده)</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                  ....................................................................
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Clean Footer for Combo A4 */}
        {showFooter && (
          <div className="flex items-center justify-between text-[8px] text-slate-500 pt-0.5 border-t border-slate-200 mt-0.5 shrink-0">
            <div>
              سند رسمی مالی صادر شده توسط سیستم حسابداری {companySettings.name || 'شرکت'}
            </div>
            <div className="font-mono">
              {companySettings.address ? `${companySettings.address} | ` : ''}تلفن: {companySettings.phone || '0794511271'}
            </div>
          </div>
        )}
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
        className="a4-print-page w-full bg-white text-slate-950 p-5 border-2 border-slate-950 rounded-lg relative space-y-4 select-text flex flex-col justify-between"
        dir="rtl"
        style={{
          height: '280mm',
          maxHeight: '282mm',
          minHeight: '276mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {renderWatermark()}
        {showHeader ? (
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <h1 className="text-xl font-black text-slate-950">
                {companySettings.name || 'شرکت تجارتی'}
              </h1>
              <span className="inline-block bg-slate-900 text-white text-xs font-bold px-3 py-0.5 rounded-full mt-1">
                حواله رسمی خروج کالا از گدام ({warehouseName})
              </span>
            </div>
            <div className="text-right text-xs space-y-1 font-mono">
              <div>شماره حواله: <strong>#{inv.invoiceNumber}</strong></div>
              <div>تاریخ صدور: <strong>{inv.date}</strong></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 text-xs">
            <div>شماره حواله: <strong>#{inv.invoiceNumber}</strong></div>
            <div>تاریخ: <strong>{inv.date}</strong></div>
            <div className="font-bold">حواله خروج انبار ({warehouseName})</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded p-3 bg-slate-50">
          <div><span className="text-slate-500">تحویل‌گیرنده / مشتری:</span> <strong className="font-black text-slate-900">{inv.partyName || 'نقدی'}</strong></div>
          <div><span className="text-slate-500">شماره تماس:</span> <span className="font-mono font-bold">{partyPhone}</span></div>
          <div><span className="text-slate-500">انبار مبدا:</span> <strong>{warehouseName}</strong></div>
          <div><span className="text-slate-500">فاکتور عطف:</span> <span className="font-mono">#{inv.invoiceNumber}</span></div>
        </div>

        <div className="border border-slate-950 rounded overflow-hidden flex-1">
          <table className="w-full text-right border-collapse text-xs table-fixed">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[54%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-900 text-white font-bold h-7">
                <th className="py-1 px-2 border-l border-white/20 text-center">#</th>
                <th className="py-1 px-3 border-l border-white/20 text-right">نام جنس و مشخصات فنی</th>
                <th className="py-1 px-2 border-l border-white/20 text-center">تعداد / مقدار</th>
                <th className="py-1 px-2 text-center">واحد سنجش</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((it, idx) => (
                <tr key={`wh-only-${idx}`} className="border-b border-slate-200 h-6.5 font-bold">
                  <td className="py-1 px-2 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                  <td className="py-1 px-3 border-l border-slate-200 truncate">{it?.productName || ''}</td>
                  <td className="py-1 px-2 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.quantity) : ''}</td>
                  <td className="py-1 px-2 text-center text-slate-700">{it?.unit === 'bag' ? 'کیسه (37Kg)' : it?.unit === 'ton' ? 'تُن' : it?.unit || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showSignatures && (
          <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs">
            <div>
              <span className="font-bold text-slate-900 block mb-4">امضاء و مهر مسئول انبار (تحویل‌دهنده)</span>
              <div className="border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                ....................................................................
              </div>
            </div>
            <div>
              <span className="font-bold text-slate-900 block mb-4">امضاء و تایید خریدار / راننده (تحویل‌گیرنده)</span>
              <div className="border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                ....................................................................
              </div>
            </div>
          </div>
        )}

        {showFooter && (
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-300">
            <div>حواله رسمی خروج کالا صادر شده از سیستم حسابداری</div>
            <div className="font-mono">تلفن شرکت: {companySettings.phone || '0794511271'}</div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 4. THERMAL RECEIPT (80mm)
  // =========================================================================
  const renderThermalReceipt = () => {
    return (
      <div
        className="w-[80mm] max-w-full bg-white text-slate-950 p-2 text-xs font-mono space-y-2 mx-auto"
        dir="rtl"
      >
        <div className="text-center border-b border-dashed border-slate-400 pb-2">
          <h2 className="font-black text-sm">{companySettings.name || 'شرکت تجارتی'}</h2>
          <div className="text-[10px] text-slate-600 mt-0.5">{companySettings.phone}</div>
          <div className="text-[10px] font-bold bg-slate-900 text-white rounded-full px-2 py-0.5 inline-block mt-1">
            فیش تحویل کالا
          </div>
        </div>

        <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-300 pb-1.5">
          <div className="flex justify-between">
            <span>شماره:</span>
            <span className="font-bold">#{inv.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>تاریخ:</span>
            <span>{inv.date}</span>
          </div>
          <div className="flex justify-between">
            <span>مشتری:</span>
            <span className="font-bold">{inv.partyName || 'نقدی'}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-slate-400 pb-2">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600">
                <th className="text-right py-0.5">کالا</th>
                <th className="text-center py-0.5">تعداد</th>
                <th className="text-left py-0.5">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={`th-${idx}`} className="border-b border-slate-100">
                  <td className="py-1 truncate max-w-[120px] font-sans">{it.productName}</td>
                  <td className="text-center py-1">{formatNumber(it.quantity)}</td>
                  <td className="text-left py-1 font-bold">{formatNumber(it.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 text-xs pt-1">
          <div className="flex justify-between">
            <span>جمع اقلام:</span>
            <span>{formatCurrency(subtotalVal, inv.currency)}</span>
          </div>
          {discountVal > 0 && (
            <div className="flex justify-between text-rose-700">
              <span>تخفیف:</span>
              <span>{formatCurrency(discountVal, inv.currency)} -</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-t border-slate-400 pt-1">
            <span>مبلغ نهایی:</span>
            <span>{formatCurrency(inv.totalAmount, inv.currency)}</span>
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
  // Default: 'invoice_full' or 'invoice_only'
  return renderFullA4Invoice();
};

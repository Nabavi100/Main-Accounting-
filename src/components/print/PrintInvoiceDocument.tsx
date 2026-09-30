import React from 'react';
import { Invoice, InvoiceItem } from '../../types';
import {
  formatNumber,
  formatCurrency,
} from '../../utils/formatters';
import { CompanyStampSeal } from '../CompanyStampSeal';
import {
  Building2,
  User,
  Scissors,
  Package,
} from 'lucide-react';
import { APP_VERSION } from '../../config/version';

interface PrintInvoiceDocumentProps {
  inv: Invoice;
  companySettings: any;
  invoiceLayout?: 'invoice_full' | 'combo_a4' | 'invoice_only' | 'warehouse_only' | 'thermal';
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
  invoiceLayout = 'combo_a4',
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
  const partyCode = partyInfo?.code || partyInfo?.numericCode || inv.partyId?.slice(0, 6) || '139';
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
  const warehouseName = getWarehouseName(inv.warehouseId) || 'انبار مرکزی';

  // Helper for unit text
  const formatItemUnit = (unit?: string) => {
    if (!unit) return 'کیسه (37Kg)';
    if (unit === 'bag') return 'کیسه (37Kg)';
    if (unit === 'ton') return 'تُن';
    if (unit === 'kg') return 'کیلوگرم';
    if (unit === 'carton') return 'کارتن';
    return unit;
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

  // Construct EXACTLY 5 rows for Upper Invoice table
  const upperRows: (InvoiceItem | null)[] = [];
  for (let i = 0; i < 5; i++) {
    upperRows.push(items[i] || null);
  }

  // Construct EXACTLY 5 rows for Lower Warehouse table
  const whRows: (InvoiceItem | null)[] = [];
  for (let i = 0; i < 5; i++) {
    whRows.push(items[i] || null);
  }

  // =========================================================================
  // COMBO A4 INVOICE: EXACT REPLICA OF USER'S ATTACHED SCREENSHOT
  // Upper: Sales Invoice with exactly 5 rows, side-by-side terms & financial box
  // Lower: Warehouse exit slip with exactly 5 rows, signatures & subfooter
  // Strictly fits on 1 sheet of A4
  // =========================================================================
  const renderComboA4Invoice = () => {
    return (
      <div
        className="a4-print-page w-full bg-white text-slate-950 p-3 sm:p-4 border border-slate-300 rounded-sm relative flex flex-col justify-between select-text"
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

        {/* ================= SECTION 1: UPPER MAIN INVOICE ================= */}
        <div className={`space-y-2 relative z-10 flex flex-col justify-between ${letterheadSpacing ? 'pt-6' : ''}`}>
          {/* Header matching exact layout in image */}
          {showHeader && (
            <div className="flex items-center justify-between gap-2 pb-1.5 shrink-0">
              {/* Right: Meta Information */}
              <div className="text-right text-[11px] text-slate-800 space-y-0.5 min-w-[150px]">
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-bold">شماره فاکتور:</span>
                  <strong className="text-slate-950 font-mono font-black text-xs">
                    #{inv.invoiceNumber}
                  </strong>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-bold">تاریخ ثبت:</span>
                  <strong className="text-slate-950 font-mono">{inv.date}</strong>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-bold">ساعت ثبت:</span>
                  <strong className="text-slate-800 font-mono">{issueTime}</strong>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-600 font-bold">نوع پرداخت:</span>
                  <strong className="text-slate-950 font-bold">
                    {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی (اعتباری)')}
                  </strong>
                </div>
              </div>

              {/* Center: Company Name & Official Badge */}
              <div className="text-center flex-1 px-2 flex flex-col items-center justify-center">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                  {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                </h1>
                <div className="mt-1">
                  <span className="inline-block bg-sky-100 text-sky-700 border border-sky-200 text-xs font-black px-4 py-0.5 rounded-full shadow-2xs">
                    {isReturnSell
                      ? 'فاکتور رسمی برگشت از فروش کالا'
                      : isReturnBuy
                      ? 'فاکتور رسمی برگشت از خرید کالا'
                      : isSale
                      ? 'فاکتور رسمی فروش کالا'
                      : 'فاکتور رسمی خرید کالا'}
                  </span>
                </div>
              </div>

              {/* Left: Circular Company Logo */}
              <div className="flex items-center justify-end min-w-[150px]">
                {companySettings.logoUrl ? (
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full border border-slate-300 p-0.5 overflow-hidden flex items-center justify-center bg-white shadow-2xs">
                    <img
                      src={companySettings.logoUrl}
                      alt={companySettings.name}
                      className="max-h-full max-w-full object-contain rounded-full"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full border-2 border-slate-800 p-1 flex flex-col items-center justify-center bg-white text-slate-800 shadow-2xs relative">
                    <div className="absolute inset-1 rounded-full border border-dashed border-slate-400 flex flex-col items-center justify-center p-1 text-center">
                      <Building2 className="w-6 h-6 text-slate-700 mb-0.5" />
                      <span className="text-[7.5px] font-black leading-tight truncate max-w-[65px] text-slate-900">
                        {companySettings.name?.slice(0, 16) || 'شرکت تجارتی'}
                      </span>
                      <span className="text-[6.5px] font-mono text-slate-500 font-bold">HERAT</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Symmetrical Seller & Buyer Cards with Dark Header Strips */}
          <div className="grid grid-cols-2 gap-3 text-xs shrink-0">
            {/* Right: Seller Information (اطلاعات شرکت صادرکننده) */}
            <div className="border border-slate-400 rounded-md overflow-hidden bg-white shadow-2xs">
              <div className="bg-[#1E293B] text-white px-3 py-1 flex items-center justify-between font-bold text-xs">
                <span className="flex items-center gap-1.5 font-bold">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>اطلاعات شرکت (صادرکننده)</span>
                </span>
                <span className="font-mono text-[11px] text-slate-200">
                  کد تجاری: {companySettings.taxId || companySettings.tin || '1'}
                </span>
              </div>
              <div className="p-2 space-y-1 text-slate-800 text-xs leading-normal bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">نام واحد تجاری:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[210px]">
                    {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">شماره تماس:</span>
                  <span className="text-slate-950 font-mono font-bold">
                    {companySettings.phone || '0794511271'} - {companySettings.phoneSecondary || '0795986263'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">آدرس شرکت:</span>
                  <span className="truncate max-w-[210px] text-slate-800 font-medium">
                    {companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}
                  </span>
                </div>
              </div>
            </div>

            {/* Left: Customer Information (اطلاعات طرف حساب مشتری) */}
            <div className="border border-slate-400 rounded-md overflow-hidden bg-white shadow-2xs">
              <div className="bg-[#1E293B] text-white px-3 py-1 flex items-center justify-between font-bold text-xs">
                <span className="flex items-center gap-1.5 font-bold">
                  <User className="w-3.5 h-3.5" />
                  <span>اطلاعات طرف حساب (مشتری)</span>
                </span>
                <span className="font-mono text-[11px] text-slate-200">
                  کد حساب: {partyCode}
                </span>
              </div>
              <div className="p-2 space-y-1 text-slate-800 text-xs leading-normal bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">مشتری محترم:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[210px]">
                    {inv.partyName || 'شرکت جهان نیرو'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">شماره تماس:</span>
                  <span className="text-slate-950 font-mono font-bold">{partyPhone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">آدرس مشتری:</span>
                  <span className="truncate max-w-[210px] text-slate-800 font-medium">{partyAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upper Table: ALWAYS EXACTLY 5 ROWS (نه کم و نه اضافه) */}
          <div className="border border-slate-800 rounded-xs overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[38%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#1E293B] text-white font-bold h-7 text-xs">
                  <th className="py-1 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-1 px-2.5 border-l border-white/20 text-right">شرح کالا یا خدمات</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">واحد</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">قیمت ({inv.currency || 'AFN'})</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">جمع کل ({inv.currency || 'AFN'})</th>
                  <th className="py-1 px-2 text-center">توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {upperRows.map((it, idx) => {
                  const unitDisplay = it ? formatItemUnit(it.unit) : '';

                  return (
                    <tr
                      key={`upper-row-${idx}`}
                      className="border-b border-slate-300 h-6 font-bold text-xs"
                    >
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono text-slate-700">
                        {idx + 1}
                      </td>
                      <td className="py-0.5 px-2 border-l border-slate-300 truncate text-slate-950 font-black">
                        {it?.productName || ''}
                      </td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono font-black text-slate-950">
                        {it ? formatNumber(it.quantity) : ''}
                      </td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center text-slate-800">
                        {unitDisplay}
                      </td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono text-slate-900">
                        {it ? formatNumber(it.unitPrice) : ''}
                      </td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono font-black text-slate-950">
                        {it ? formatNumber(it.totalPrice) : ''}
                      </td>
                      <td className="py-0.5 px-2 text-center text-slate-600 font-normal truncate">
                        {it?.description || (it ? '---' : '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Middle Section: Side-by-side Commercial Rules (Right) & Financial Summary Box (Left) */}
          <div className="grid grid-cols-2 gap-3 text-xs shrink-0">
            {/* Right: قوانین و شرایط عمومی معامله (Exact matching text from uploaded screenshot) */}
            <div className="space-y-1 text-slate-800 text-[10.5px] leading-relaxed pr-1 flex flex-col justify-center">
              <div className="font-black text-slate-950 text-xs mb-0.5">
                قوانین و شرایط عمومی معامله:
              </div>
              <p>• لطفا در مورد جنس اطمینان خود را حاصل نموده ، شکایت بعدی قابل قبول نمیباشد.</p>
              <p>• فاکتور هذا بدون مهر و امضاء اعتبار ندارد.</p>
              <p>• اجناس فروخته شده برای تمام مشترکین موسسات و شرکت ها بدون مالیه میباشد.</p>
              <p>• جنس فروخته شده واپس گرفته نمیشود.</p>
              {inv.notes && (
                <p className="text-amber-900 font-bold">• یادداشت: {inv.notes}</p>
              )}
            </div>

            {/* Left: Financial Summary Box (جدول مبالغ - دقیقا مثل تصویر کاربر) */}
            <div className="border border-slate-300 rounded overflow-hidden text-xs bg-white shadow-2xs">
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1 px-3 bg-slate-50 text-slate-700 font-bold border-l border-slate-200 text-right">
                      جمع کل مبلغ:
                    </td>
                    <td className="py-1 px-3 text-left font-mono font-bold text-slate-950">
                      {inv.currency || 'AFN'} {formatNumber(subtotalVal)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1 px-3 bg-slate-50 text-slate-700 font-bold border-l border-slate-200 text-right">
                      هزینه کرایه حمل:
                    </td>
                    <td className="py-1 px-3 text-left font-mono font-bold text-slate-900">
                      {inv.currency || 'AFN'} {formatNumber(shippingVal)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1 px-3 bg-slate-50 text-slate-700 font-bold border-l border-slate-200 text-right">
                      تخفیف کلی فاکتور:
                    </td>
                    <td className="py-1 px-3 text-left font-mono font-bold text-slate-700">
                      {inv.currency || 'AFN'} {formatNumber(discountVal)} -
                    </td>
                  </tr>
                  {/* Highlighted Net Payable Row */}
                  <tr className="border-b border-sky-300 bg-sky-50 text-sky-800">
                    <td className="py-1 px-3 font-black border-l border-sky-300 text-right">
                      مبلغ نهایی معامله:
                    </td>
                    <td className="py-1 px-3 text-left font-mono font-black text-sky-800 text-sm">
                      {inv.currency || 'AFN'} {formatNumber(inv.totalAmount)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1 px-3 bg-slate-50 text-slate-700 font-bold border-l border-slate-200 text-right">
                      مبلغ پرداخت‌شده:
                    </td>
                    <td className="py-1 px-3 text-left font-mono font-bold text-slate-900">
                      {inv.currency || 'AFN'} {formatNumber(inv.paidAmount || 0)}
                    </td>
                  </tr>
                  {/* Remaining Balance Row */}
                  <tr className="bg-rose-50 text-rose-700">
                    <td className="py-1 px-3 font-black border-l border-rose-200 text-right">
                      مبلغ باقی‌مانده بدهی:
                    </td>
                    <td className="py-1 px-3 text-left font-mono font-black text-rose-700 text-sm">
                      {inv.currency || 'AFN'} {formatNumber(remainingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Upper Signatures (3 Columns: تحویل‌دهنده، مسئول مالی، خریدار) */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-4 pt-1.5 text-center text-xs shrink-0">
              {/* Right: امضاء و مهر تحویل‌دهنده */}
              <div>
                <span className="font-bold text-slate-900 block mb-1">امضاء و مهر تحویل‌دهنده</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ....................................................................
                </div>
              </div>

              {/* Center: امضاء و مهر مسئول مالی */}
              <div>
                <span className="font-bold text-slate-900 block mb-1">امضاء و مهر مسئول مالی</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ....................................................................
                </div>
              </div>

              {/* Left: امضاء و تایید خریدار */}
              <div>
                <span className="font-bold text-slate-900 block mb-1">امضاء و تایید خریدار</span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ....................................................................
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= SECTION 2: PERFORATED CUT LINE ================= */}
        <div className="relative my-1 flex items-center justify-center select-none shrink-0">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-slate-400" />
          </div>
          <div className="relative bg-white px-3 flex items-center gap-1.5 text-slate-800 text-[9.5px] font-bold border border-slate-300 rounded-full shadow-2xs">
            <Scissors className="w-3.5 h-3.5 text-slate-700 -rotate-90" />
            <span>محل برش برگه حواله گدام‌دار</span>
          </div>
        </div>

        {/* ================= SECTION 3: WAREHOUSE EXIT SLIP (دقیقاً ۵ ردیف ثابت) ================= */}
        <div className="space-y-1.5 relative z-10 shrink-0">
          {/* Warehouse Header Bar matching screenshot */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1 text-xs">
            <div className="flex items-center gap-1.5 font-black text-slate-950 text-xs">
              <Package className="w-4 h-4 text-slate-800" />
              <span className="text-sm font-black">
                برگه حواله خروج کالا از گدام (نسخه گدام‌دار)
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-800 text-xs">
              <div>
                شماره فاکتور مرجع: <strong className="text-slate-950 font-black font-mono">#{inv.invoiceNumber}</strong>
              </div>
              <div>
                تاریخ ثبت: <strong className="font-mono">{inv.date}</strong>
              </div>
              <div>
                ساعت ثبت: <strong className="font-mono">{issueTime}</strong>
              </div>
              <div>
                تحویل به مشتری: <strong className="font-sans text-slate-950 font-black">{inv.partyName || 'شرکت جهان نیرو'}</strong>
              </div>
            </div>
          </div>

          {/* Lower Table: ALWAYS EXACTLY 5 FIXED ROWS (۵ ردیف) */}
          <div className="border border-slate-800 rounded-xs overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[48%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#1E293B] text-white font-bold h-6 text-xs">
                  <th className="py-0.5 px-1 border-l border-white/20 text-center font-bold">#</th>
                  <th className="py-0.5 px-2.5 border-l border-white/20 text-right font-bold">نام و شرح کالای تحویلی</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-center font-bold">تعداد / مقدار</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-center font-bold">واحد سنجش</th>
                  <th className="py-0.5 px-2 text-center font-bold">توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {whRows.map((it, idx) => (
                  <tr
                    key={`wh-row-${idx}`}
                    className="border-b border-slate-300 h-6 font-bold text-xs"
                  >
                    <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono text-slate-700">
                      {idx + 1}
                    </td>
                    <td className="py-0.5 px-2.5 border-l border-slate-300 truncate text-slate-950 font-black">
                      {it?.productName || ''}
                    </td>
                    <td className="py-0.5 px-2 border-l border-slate-300 text-center font-mono font-black text-slate-950 text-xs">
                      {it ? formatNumber(it.quantity) : ''}
                    </td>
                    <td className="py-0.5 px-2 border-l border-slate-300 text-center text-slate-800 text-[11px] font-bold">
                      {it ? formatItemUnit(it.unit) : ''}
                    </td>
                    <td className="py-0.5 px-2 text-center text-slate-600 font-normal truncate">
                      {it?.description || (it ? '---' : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lower Signatures (2 Columns: مسئول گدام و تحویل‌گیرنده) */}
          {showSignatures && (
            <div className="grid grid-cols-2 gap-8 pt-1 text-center text-xs">
              {/* Right: مسئول گدام */}
              <div>
                <span className="font-bold text-slate-900 block mb-1">
                  امضاء و مهر مسئول گدام (تایید تحویل کالا)
                </span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ....................................................................................................
                </div>
              </div>

              {/* Left: خریدار / راننده */}
              <div>
                <span className="font-bold text-slate-900 block mb-1">
                  امضاء و تایید خریدار / راننده (تایید دریافت کالا)
                </span>
                <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ....................................................................................................
                </div>
              </div>
            </div>
          )}

          {/* Sub-footer line matching screenshot */}
          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200">
            <div>
              نسخه گدام‌دار - هرات، افغانستان
            </div>
            <div>
              سیستم مالی یکپارچه {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
            </div>
          </div>
        </div>

        {/* Global Footer with System Version */}
        {showFooter && (
          <div className="flex items-center justify-between text-[8.5px] text-slate-600 pt-1 border-t border-slate-300 shrink-0">
            <div>
              سند معامله رسمی معتبر صادر شده توسط سیستم مالی {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
            </div>
            <div className="font-mono flex items-center gap-2">
              <span>{companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}</span>
              <span>تلفن تماس: {companySettings.phone || '0794511271'}</span>
              <span className="text-slate-400 font-bold">[{APP_VERSION}]</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Thermal Receipt (80mm)
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

  if (invoiceLayout === 'thermal') {
    return renderThermalReceipt();
  }

  // Both combo_a4 and invoice_full use the exact single-page A4 design from user's image
  return renderComboA4Invoice();
};

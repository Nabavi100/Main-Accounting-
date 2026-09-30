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
  Phone,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Truck,
  Hash,
  Landmark,
} from 'lucide-react';

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
  stampSize = 54,
  signatureSize = 46,
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
  const warehouseName = getWarehouseName(inv.warehouseId) || 'انبار مرکزی';

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
      <div className="transform -rotate-6 scale-95">
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

  // Helper for unit text
  const formatItemUnit = (unit?: string) => {
    if (!unit) return 'کیسه (37Kg)';
    if (unit === 'bag') return 'کیسه (37Kg)';
    if (unit === 'ton') return 'تُن';
    if (unit === 'kg') return 'کیلوگرم';
    if (unit === 'carton') return 'کارتن';
    return unit;
  };

  // =========================================================================
  // 1. COMBO A4 INVOICE (فاکتور رسمی تجارتی + حواله خروج انبار - دقیقاً یک برگ A4)
  // بخش بالا: فاکتور فروش معتبر با لوگوی بزرگ، کادرهای لوکس، جمع مبلغ متصل به آخرین قلم و مقررات کامل
  // بخش پایین: فرم خروجی انبار ۵ ردیف با فونت‌های درشت و امضاهای کامل
  // =========================================================================
  const renderComboA4Invoice = () => {
    // Top invoice displays the actual items (up to 5 in combo mode)
    const upperItems = items.length > 0 ? items.slice(0, 5) : [];

    // Bottom warehouse slip ALWAYS has exactly 5 fixed rows as requested
    const targetWhCount = 5;
    const whRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetWhCount; i++) {
      whRows.push(items[i] || null);
    }

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-950 p-2 sm:p-2.5 border-2 border-slate-950 rounded-lg relative flex flex-col justify-between select-text"
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

        {/* ================= SECTION 1: UPPER MAIN INVOICE (~61% HEIGHT) ================= */}
        <div className={`space-y-1.5 relative z-10 flex flex-col justify-between ${letterheadSpacing ? 'pt-8' : ''}`}>
          {/* Header with LARGE PROMINENT LOGO, Calligraphy & Executive Metadata */}
          {showHeader && (
            <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-1 shrink-0">
              {/* Right: Meta Information Box with Luxury Border & High Contrast */}
              <div className="text-right text-[10px] text-slate-800 space-y-0.5 min-w-[160px] border border-slate-300 rounded-lg p-1.5 bg-slate-50/70 shadow-2xs">
                <div className="flex items-center justify-between gap-1 border-b border-slate-200 pb-0.5">
                  <span className="text-slate-600 font-bold text-[9.5px]">شماره فاکتور:</span>
                  <strong className="text-rose-700 font-mono font-black text-xs bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    #{inv.invoiceNumber}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-600 font-bold text-[9.5px]">تاریخ صدور:</span>
                  <strong className="text-slate-950 font-mono font-black text-[10.5px]">{inv.date}</strong>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-slate-600 font-bold text-[9.5px]">ساعت ثبت:</span>
                  <strong className="text-slate-800 font-mono text-[9.5px]">{issueTime}</strong>
                </div>
                <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-slate-200">
                  <span className="text-slate-600 font-bold text-[9.5px]">نوع معامله:</span>
                  <strong className="text-slate-950 font-black text-[10px] bg-slate-200/80 px-1.5 py-0.2 rounded">
                    {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی (اعتباری)')}
                  </strong>
                </div>
              </div>

              {/* Center: Bismillah, Company Name & Official Invoice Badge */}
              <div className="text-center flex-1 px-2 flex flex-col items-center justify-center">
                <div className="text-[11px] font-bold text-slate-600 tracking-wider mb-0.5">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                  {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                </h1>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="inline-block bg-slate-900 text-white text-[11px] font-black px-4 py-0.5 rounded-full shadow-xs tracking-wide">
                    {isReturnSell
                      ? 'فاکتور رسمی برگشت از فروش کالا'
                      : isReturnBuy
                      ? 'فاکتور رسمی برگشت از خرید کالا'
                      : isSale
                      ? 'فاکتور رسمی فروش کالا و خدمات'
                      : 'فاکتور رسمی خرید کالا'}
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-slate-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                    TIN: {companySettings.taxId || companySettings.tin || companySettings.commercialCode || '1015694'}
                  </span>
                </div>
                <div className="text-[9.5px] text-slate-600 font-bold mt-0.5">
                  مرکز واردات و توزیع عمده آرد، غلات و مواد خوراکه استاندارد تجارتی
                </div>
              </div>

              {/* Left: LARGE PROMINENT LUXURY LOGO (لوگوی بزرگ و چشم‌نواز) */}
              <div className="flex items-center justify-end min-w-[160px]">
                {companySettings.logoUrl ? (
                  <div className="w-24 h-22 sm:w-28 sm:h-24 rounded-xl border-2 border-slate-900 bg-white p-1 shadow-sm flex items-center justify-center overflow-hidden">
                    <img
                      src={companySettings.logoUrl}
                      alt={companySettings.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-22 sm:w-28 sm:h-24 rounded-xl border-2 border-slate-900 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white flex flex-col items-center justify-center font-black p-1 shadow-sm text-center">
                    <Building2 className="w-9 h-9 text-amber-400 mb-0.5" />
                    <span className="text-[9.5px] font-black leading-tight truncate max-w-[85px]">
                      {companySettings.name?.slice(0, 18) || 'شرکت تجارتی'}
                    </span>
                    <span className="text-[8px] font-mono text-amber-300 font-normal">Est. 2012</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Luxury Executive Seller & Buyer Cards (کادر لوکس مشخصات شرکت و مشتری) */}
          <div className="grid grid-cols-2 gap-2 text-xs shrink-0">
            {/* Seller Card */}
            <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-900 text-white px-2.5 py-0.5 flex items-center justify-between font-bold text-[10.5px] border-b-2 border-amber-500">
                <span className="flex items-center gap-1 font-black">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>مشخصات فروشنده (صادرکننده)</span>
                </span>
                <span className="font-mono text-amber-300 text-[9.5px] font-bold">
                  کد اقتصادی: {companySettings.taxId || companySettings.tin || '1015694'}
                </span>
              </div>
              <div className="p-1.5 space-y-0.5 text-slate-800 text-[10.5px] leading-tight bg-gradient-to-b from-white to-slate-50/70">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">نام تجارتی:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[210px]">
                    {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">شماره تماس:</span>
                  <span className="text-slate-950 font-mono font-bold">
                    {companySettings.phone || '0794511271'}
                    {companySettings.phoneSecondary && ` - ${companySettings.phoneSecondary}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">نشانی دفتر:</span>
                  <span className="truncate max-w-[210px] text-slate-800 font-medium">
                    {companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}
                  </span>
                </div>
              </div>
            </div>

            {/* Buyer Card */}
            <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-900 text-white px-2.5 py-0.5 flex items-center justify-between font-bold text-[10.5px] border-b-2 border-amber-500">
                <span className="flex items-center gap-1 font-black">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>مشخصات خریدار (مشتری محترم)</span>
                </span>
                <span className="font-mono text-amber-300 text-[9.5px] font-bold">
                  کد تفصیلی: {partyCode}
                </span>
              </div>
              <div className="p-1.5 space-y-0.5 text-slate-800 text-[10.5px] leading-tight bg-gradient-to-b from-white to-slate-50/70">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">مشتری گرامی:</span>
                  <strong className="text-slate-950 font-black truncate max-w-[210px]">
                    {inv.partyName || 'مشتری نقدی'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">شماره همراه:</span>
                  <span className="text-slate-950 font-mono font-bold">{partyPhone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">آدرس / موقعیت:</span>
                  <span className="truncate max-w-[210px] text-slate-800 font-medium">{partyAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table + Immediate Attached Financial Summary (جمع مبلغ دقیقاً زیر آخرین قلم کالا - بدون فاصله خالی) */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-[10.5px] table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[43%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[14%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-900 text-white font-bold h-6 text-[10.5px]">
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-right">شرح مشخصات کامل جنس یا خدمات</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">واحد</th>
                  <th className="py-0.5 px-1 border-l border-white/20 text-center">قیمت فی ({inv.currency})</th>
                  <th className="py-0.5 px-2 text-center">جمع کل ({inv.currency})</th>
                </tr>
              </thead>
              <tbody>
                {upperItems.map((it, idx) => {
                  const unitDisplay = formatItemUnit(it.unit);

                  return (
                    <tr key={`cb-inv-${idx}`} className="border-b border-slate-300 font-bold h-6 hover:bg-slate-50">
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono text-slate-700">{idx + 1}</td>
                      <td className="py-0.5 px-2 border-l border-slate-300 truncate text-slate-950">{it?.productName || ''}</td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono font-black text-slate-950">{formatNumber(it.quantity)}</td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center text-[10px] text-slate-800">{unitDisplay}</td>
                      <td className="py-0.5 px-1 border-l border-slate-300 text-center font-mono text-slate-900">{formatNumber(it.unitPrice)}</td>
                      <td className="py-0.5 px-2 text-center font-mono font-black text-slate-950">{formatNumber(it.totalPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Financial summary attached directly below the last item (بدون جای خالی) */}
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-[10.5px]">
                  <td colSpan={4} className="py-0.5 px-3 text-right font-black text-slate-900 border-l border-slate-300">
                    مجموع ناخالص اقلام فاکتور:
                  </td>
                  <td colSpan={2} className="py-0.5 px-3 text-left font-mono font-black text-slate-950 text-[11.5px]">
                    {inv.currency} {formatNumber(subtotalVal)}
                  </td>
                </tr>
                {discountVal > 0 && (
                  <tr className="bg-emerald-50 border-t border-slate-300 text-[10.5px]">
                    <td colSpan={4} className="py-0.5 px-3 text-right font-bold text-emerald-900 border-l border-slate-300">
                      تخفیف ویژه تجارتی:
                    </td>
                    <td colSpan={2} className="py-0.5 px-3 text-left font-mono font-black text-emerald-800 text-[11.5px]">
                      {inv.currency} {formatNumber(discountVal)} -
                    </td>
                  </tr>
                )}
                {shippingVal > 0 && (
                  <tr className="bg-slate-50 border-t border-slate-300 text-[10.5px]">
                    <td colSpan={4} className="py-0.5 px-3 text-right font-bold text-slate-800 border-l border-slate-300">
                      هزینه حمل و باربری:
                    </td>
                    <td colSpan={2} className="py-0.5 px-3 text-left font-mono font-black text-slate-900 text-[11.5px]">
                      {inv.currency} {formatNumber(shippingVal)} +
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                  <td colSpan={4} className="py-1 px-3 text-right font-black tracking-wide border-l border-slate-800">
                    مبلغ کل نهایی قابل پرداخت:
                  </td>
                  <td colSpan={2} className="py-1 px-3 text-left font-mono font-black text-amber-300 text-sm">
                    {inv.currency} {formatNumber(inv.totalAmount)}
                  </td>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-300 text-[10px] font-bold">
                  <td colSpan={2} className="py-0.5 px-2 text-right border-l border-slate-300 text-slate-700">
                    پرداخت نقدی: <span className="font-mono text-slate-950 font-black">{inv.currency} {formatNumber(inv.paidAmount || 0)}</span>
                  </td>
                  <td colSpan={4} className="py-0.5 px-2 text-left text-rose-800 font-black">
                    باقی‌مانده این فاکتور: <span className="font-mono text-xs">{inv.currency} {formatNumber(remainingBalance)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Commercial Regulations & Legal Terms in place of empty void (توضیحات و مقررات رسمی جایگزین فضای خالی) */}
          <div className="grid grid-cols-2 gap-2 text-[10px] shrink-0">
            {/* Box 1: ضوابط و شرایط قطعی معامله و تحویل کالا */}
            <div className="border border-slate-400 rounded-lg p-2 bg-slate-50/70 flex flex-col justify-between leading-snug space-y-1 shadow-2xs">
              <div className="font-black text-slate-950 text-[10.5px] flex items-center gap-1 border-b border-slate-300 pb-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                <span>ضوابط و مقررات رسمی و قانونی معامله:</span>
              </div>
              <div className="text-slate-800 text-[9.5px] space-y-0.5 pr-1">
                <p>• این فاکتور سند رسمی قطعی معامله بوده و بدون مهر و امضای معتبر شرکت فاقد وجاهت قانونی است.</p>
                <p>• خریدار محترم موظف است هنگام تحویل از گدام ({warehouseName})، کمیت و مشخصات ظاهری اجناس را دقیقاً تطبیق نماید.</p>
                <p>• کالای تحویل‌شده مطابق موازین تجارتی پس از خروج از گدام و تایید تحویل‌گیرنده مسترد یا تعویض نمی‌گردد.</p>
                <p>• هرگونه تسویه حسابی صرفاً با ارائه رسید چاپی صندوق معتبر می‌باشد.</p>
              </div>
            </div>

            {/* Box 2: مبلغ کل به حروف و مشخصات واریز بانکی و یادداشت */}
            <div className="border border-slate-400 rounded-lg p-2 bg-white flex flex-col justify-between shadow-2xs">
              <div>
                <div className="font-black text-slate-950 text-[10.5px] border-b border-slate-300 pb-0.5 flex items-center justify-between">
                  <span>الزام قانونی: مبلغ به حروف</span>
                  <span className="font-mono text-[9px] text-slate-500">واحد: {inv.currency}</span>
                </div>
                <div className="bg-slate-100 border border-slate-300 rounded p-1 mt-1 text-[10.5px] font-black text-slate-950 leading-tight">
                  مبلغ به حروف: {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
                </div>
                {inv.notes && (
                  <div className="mt-1 text-[9.5px] text-slate-700 bg-amber-50/60 border border-amber-200 rounded px-1.5 py-0.5 truncate">
                    <span className="font-bold text-amber-900">یادداشت فاکتور:</span> {inv.notes}
                  </div>
                )}
              </div>
              <div className="mt-1 pt-1 border-t border-slate-200 text-[9px] text-slate-600 flex items-center justify-between font-medium">
                <span>امور مالی و خزانه‌داری: {companySettings.phone || '0794511271'}</span>
                <span className="font-mono">ثبت قطعی سیستم حسابداری</span>
              </div>
            </div>
          </div>

          {/* Official Signatures (3 Columns) */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-3 pt-0.5 text-center text-xs shrink-0">
              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-0.5 text-[10.5px]">امضاء و مهر صادرکننده (فروشنده)</span>
                <div className="h-8 flex items-center justify-center relative">
                  {showSignature && renderDigitalSignature(26)}
                  {showStamp && <div className="absolute">{renderDigitalStamp(34)}</div>}
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ............................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-0.5 text-[10.5px]">امضاء و تایید مسئول مالی و حسابداری</span>
                <div className="h-8 flex items-center justify-center text-slate-600 font-mono text-[9.5px]">
                  تایید و ثبت سیستم گردید
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ............................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-0.5 text-[10.5px]">امضاء و تایید خریدار محترم</span>
                <div className="h-8 flex items-center justify-center text-slate-500 font-mono text-[9.5px]">
                  صحت مشخصات و قیمت تایید شد
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[8px]">
                  ............................................................
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= SECTION 2: PERFORATED CUT LINE ================= */}
        <div className="relative my-0.5 flex items-center justify-center select-none shrink-0">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t-2 border-dashed border-slate-400" />
          </div>
          <div className="relative bg-white px-3 flex items-center gap-1.5 text-slate-900 text-[9px] font-black border border-slate-400 rounded-full shadow-2xs">
            <Scissors className="w-3.5 h-3.5 text-slate-700 -rotate-90" />
            <span>محل برش برگه حواله خروج انبار (نسخه انباردار)</span>
          </div>
        </div>

        {/* ================= SECTION 3: WAREHOUSE EXIT SLIP (دقیقاً ۵ ردیف ثابت + فونت‌های بزرگتر و خوانا) ================= */}
        <div className="border-2 border-slate-900 rounded-lg p-2 bg-white space-y-1 relative z-10 shrink-0 shadow-2xs">
          {/* Warehouse Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1 text-xs">
            <div className="flex items-center gap-1.5 font-black text-slate-950 text-xs">
              <Package className="w-4 h-4 text-slate-800" />
              <span className="text-sm font-black">برگه رسمی حواله خروج کالا از گدام ({warehouseName})</span>
            </div>
            <div className="flex items-center gap-3 text-slate-900 font-mono text-xs">
              <div>فاکتور عطف: <strong className="text-slate-950 font-black">#{inv.invoiceNumber}</strong></div>
              <div>تاریخ: <strong>{inv.date}</strong></div>
              <div>خریدار: <strong className="font-sans text-slate-950 font-black">{inv.partyName || 'نقدی'}</strong></div>
            </div>
          </div>

          {/* EXACTLY 5 FIXED ROWS WITH LARGER READABLE TYPOGRAPHY (فونت‌های بزرگتر و درشت) */}
          <div className="border border-slate-900 rounded overflow-hidden">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[52%]" />
                <col className="w-[20%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-900 text-white font-bold h-6 text-xs">
                  <th className="py-0.5 px-1.5 border-l border-white/20 text-center font-bold">ردیف</th>
                  <th className="py-0.5 px-2.5 border-l border-white/20 text-right font-bold">نام و مشخصات جنس بارگیری‌شده</th>
                  <th className="py-0.5 px-2 border-l border-white/20 text-center font-bold">تعداد / مقدار بارگیری</th>
                  <th className="py-0.5 px-2 text-center font-bold">واحد سنجش</th>
                </tr>
              </thead>
              <tbody>
                {whRows.map((it, idx) => (
                  <tr key={`wh-combo-${idx}`} className="border-b border-slate-300 h-6 font-bold text-xs hover:bg-slate-50">
                    <td className="py-0.5 px-1.5 border-l border-slate-300 text-center font-mono text-slate-700">{idx + 1}</td>
                    <td className="py-0.5 px-2.5 border-l border-slate-300 truncate text-slate-950 font-black">
                      {it?.productName || ''}
                    </td>
                    <td className="py-0.5 px-2 border-l border-slate-300 text-center font-mono font-black text-slate-950 text-xs">
                      {it ? formatNumber(it.quantity) : ''}
                    </td>
                    <td className="py-0.5 px-2 text-center text-slate-800 text-[11px] font-bold">
                      {it ? formatItemUnit(it.unit) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dispatch Details & Signatures */}
          <div className="grid grid-cols-2 gap-3 pt-0.5 text-xs">
            {/* Driver & Truck Specs */}
            <div className="border border-slate-300 rounded p-1 bg-slate-50 text-[10.5px] space-y-0.5 font-medium">
              <div>مشخصات راننده / موتر باربری: <span className="font-mono text-slate-500">..................................................</span></div>
              <div className="flex justify-between">
                <span>شماره پلاک / بارنامه: <span className="font-mono text-slate-500">...................</span></span>
                <span>تلفن راننده: <span className="font-mono text-slate-500">...................</span></span>
              </div>
            </div>

            {/* Warehouse & Driver Signatures */}
            {showSignatures && (
              <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                <div>
                  <span className="font-black text-slate-900 block mb-0.5">امضاء و مهر مسئول انبار (تحویل‌دهنده)</span>
                  <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7.5px]">
                    ....................................................................
                  </div>
                </div>
                <div>
                  <span className="font-black text-slate-900 block mb-0.5">امضاء و تایید خریدار / راننده (تحویل‌گیرنده)</span>
                  <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7.5px]">
                    ....................................................................
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Clean Footer for Combo A4 */}
        {showFooter && (
          <div className="flex items-center justify-between text-[8.5px] text-slate-500 pt-0.5 border-t border-slate-200 mt-0.5 shrink-0">
            <div>
              سند رسمی مالی و انبارداری صادر شده توسط سیستم حسابداری {companySettings.name || 'شرکت تجارتی'}
            </div>
            <div className="font-mono">
              {companySettings.address ? `${companySettings.address} | ` : ''}تلفن تماس: {companySettings.phone || '0794511271'}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 2. FULL LEGAL A4 INVOICE (فاکتور کامل تمام‌صفحه A4)
  // =========================================================================
  const renderFullA4Invoice = () => {
    // If fewer than 5 items, we display actual items and attach summary immediately
    const displayItems = items;

    return (
      <div
        className="a4-print-page w-full bg-white text-slate-950 p-4 border-2 border-slate-950 rounded-lg relative flex flex-col justify-between select-text"
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

        <div className={`space-y-2 relative z-10 flex flex-col justify-between flex-1 ${letterheadSpacing ? 'pt-8' : ''}`}>
          {/* Header */}
          {showHeader && (
            <div className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-2 shrink-0">
              <div className="text-right text-[11px] text-slate-800 space-y-1 min-w-[170px] border border-slate-300 rounded-lg p-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">شماره فاکتور:</span>
                  <strong className="text-rose-700 font-mono font-black text-sm bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    #{inv.invoiceNumber}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">تاریخ صدور:</span>
                  <strong className="text-slate-950 font-mono font-black">{inv.date}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">نوع معامله:</span>
                  <strong className="text-slate-950 font-black">
                    {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی (اعتباری)')}
                  </strong>
                </div>
              </div>

              <div className="text-center flex-1 px-2 flex flex-col items-center justify-center">
                <div className="text-[12px] font-bold text-slate-600 tracking-wider mb-0.5">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
                  {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                </h1>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="inline-block bg-slate-900 text-white text-xs font-black px-4 py-0.5 rounded-full shadow-xs">
                    {isReturnSell
                      ? 'فاکتور رسمی برگشت از فروش کالا'
                      : isReturnBuy
                      ? 'فاکتور رسمی برگشت از خرید کالا'
                      : isSale
                      ? 'فاکتور رسمی فروش کالا و خدمات'
                      : 'فاکتور رسمی خرید کالا'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                    TIN: {companySettings.taxId || companySettings.tin || '1015694'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end min-w-[170px]">
                {companySettings.logoUrl ? (
                  <div className="w-28 h-24 rounded-xl border-2 border-slate-900 bg-white p-1 shadow-sm flex items-center justify-center overflow-hidden">
                    <img
                      src={companySettings.logoUrl}
                      alt={companySettings.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-28 h-24 rounded-xl border-2 border-slate-900 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center font-black p-1 shadow-sm text-center">
                    <Building2 className="w-10 h-10 text-amber-400 mb-0.5" />
                    <span className="text-[10px] font-bold leading-tight truncate max-w-[90px]">
                      {companySettings.name?.slice(0, 18) || 'شرکت تجارتی'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Luxury Executive Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs shrink-0">
            <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-900 text-white px-3 py-1 flex items-center justify-between font-bold text-[11px] border-b-2 border-amber-500">
                <span className="flex items-center gap-1 font-black">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>مشخصات فروشنده (صادرکننده)</span>
                </span>
                <span className="font-mono text-amber-300 text-[10px]">
                  کد اقتصادی: {companySettings.taxId || companySettings.tin || '1015694'}
                </span>
              </div>
              <div className="p-2 space-y-1 text-slate-800 text-[11px] leading-tight bg-gradient-to-b from-white to-slate-50/70">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">نام تجارتی:</span>
                  <strong className="text-slate-950 font-black">{companySettings.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">شماره تماس:</span>
                  <span className="text-slate-950 font-mono font-bold">{companySettings.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">نشانی:</span>
                  <span className="text-slate-800">{companySettings.address}</span>
                </div>
              </div>
            </div>

            <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-900 text-white px-3 py-1 flex items-center justify-between font-bold text-[11px] border-b-2 border-amber-500">
                <span className="flex items-center gap-1 font-black">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>مشخصات خریدار (طرف حساب)</span>
                </span>
                <span className="font-mono text-amber-300 text-[10px]">کد اشتراک: {partyCode}</span>
              </div>
              <div className="p-2 space-y-1 text-slate-800 text-[11px] leading-tight bg-gradient-to-b from-white to-slate-50/70">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">مشتری گرامی:</span>
                  <strong className="text-slate-950 font-black">{inv.partyName || 'نقدی'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">شماره همراه:</span>
                  <span className="text-slate-950 font-mono font-bold">{partyPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">موقعیت / نشانی:</span>
                  <span className="text-slate-800">{partyAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table with immediate attached totals (بدون جای خالی) */}
          <div className="border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[43%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[14%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-900 text-white font-bold h-7 text-xs">
                  <th className="py-1 px-1 border-l border-white/20 text-center">#</th>
                  <th className="py-1 px-2 border-l border-white/20 text-right">شرح مشخصات جنس یا خدمات</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">تعداد</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">واحد</th>
                  <th className="py-1 px-1 border-l border-white/20 text-center">قیمت فی ({inv.currency})</th>
                  <th className="py-1 px-2 text-center">جمع کل ({inv.currency})</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((it, idx) => (
                  <tr key={`full-inv-${idx}`} className="border-b border-slate-300 font-bold h-7 hover:bg-slate-50">
                    <td className="py-1 px-1 border-l border-slate-300 text-center font-mono text-slate-700">{idx + 1}</td>
                    <td className="py-1 px-2 border-l border-slate-300 truncate text-slate-950 font-black">{it.productName}</td>
                    <td className="py-1 px-1 border-l border-slate-300 text-center font-mono font-black text-slate-950">{formatNumber(it.quantity)}</td>
                    <td className="py-1 px-1 border-l border-slate-300 text-center text-slate-800">{formatItemUnit(it.unit)}</td>
                    <td className="py-1 px-1 border-l border-slate-300 text-center font-mono text-slate-900">{formatNumber(it.unitPrice)}</td>
                    <td className="py-1 px-2 text-center font-mono font-black text-slate-950">{formatNumber(it.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-xs">
                  <td colSpan={4} className="py-1 px-3 text-right font-black text-slate-900 border-l border-slate-300">
                    مجموع ناخالص اقلام فاکتور:
                  </td>
                  <td colSpan={2} className="py-1 px-3 text-left font-mono font-black text-slate-950 text-sm">
                    {inv.currency} {formatNumber(subtotalVal)}
                  </td>
                </tr>
                {discountVal > 0 && (
                  <tr className="bg-emerald-50 border-t border-slate-300 text-xs">
                    <td colSpan={4} className="py-1 px-3 text-right font-bold text-emerald-900 border-l border-slate-300">
                      تخفیف ویژه تجارتی:
                    </td>
                    <td colSpan={2} className="py-1 px-3 text-left font-mono font-black text-emerald-800 text-sm">
                      {inv.currency} {formatNumber(discountVal)} -
                    </td>
                  </tr>
                )}
                {shippingVal > 0 && (
                  <tr className="bg-slate-50 border-t border-slate-300 text-xs">
                    <td colSpan={4} className="py-1 px-3 text-right font-bold text-slate-800 border-l border-slate-300">
                      هزینه حمل و باربری:
                    </td>
                    <td colSpan={2} className="py-1 px-3 text-left font-mono font-black text-slate-900 text-sm">
                      {inv.currency} {formatNumber(shippingVal)} +
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-900 text-white font-black text-sm border-t-2 border-slate-950">
                  <td colSpan={4} className="py-1.5 px-3 text-right font-black tracking-wide border-l border-slate-800">
                    مبلغ کل نهایی قابل پرداخت:
                  </td>
                  <td colSpan={2} className="py-1.5 px-3 text-left font-mono font-black text-amber-300 text-base">
                    {inv.currency} {formatNumber(inv.totalAmount)}
                  </td>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-300 text-xs font-bold">
                  <td colSpan={2} className="py-1 px-2 text-right border-l border-slate-300 text-slate-700">
                    پرداخت نقدی: <span className="font-mono text-slate-950 font-black">{inv.currency} {formatNumber(inv.paidAmount || 0)}</span>
                  </td>
                  <td colSpan={4} className="py-1 px-2 text-left text-rose-800 font-black">
                    باقی‌مانده این فاکتور: <span className="font-mono text-sm">{inv.currency} {formatNumber(remainingBalance)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Regulations & Commercial Terms (جایگزین فضای خالی) */}
          <div className="grid grid-cols-2 gap-3 text-xs shrink-0">
            <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50/70 space-y-1 shadow-2xs">
              <div className="font-black text-slate-950 text-xs flex items-center gap-1 border-b border-slate-300 pb-1">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>ضوابط و مقررات رسمی و قانونی معامله:</span>
              </div>
              <div className="text-slate-800 text-[10.5px] space-y-1 pr-1 leading-relaxed">
                <p>• این فاکتور سند رسمی قطعی معامله بوده و بدون مهر و امضای معتبر شرکت فاقد وجاهت قانونی است.</p>
                <p>• خریدار محترم موظف است هنگام تحویل از گدام ({warehouseName})، کمیت و مشخصات اجناس را تطبیق نماید.</p>
                <p>• کالای تحویل‌شده پس از خروج از گدام و تایید تحویل‌گیرنده مسترد یا تعویض نمی‌گردد.</p>
                <p>• تسویه حساب صرفاً با ارائه رسید چاپی صندوق معتبر می‌باشد.</p>
              </div>
            </div>

            <div className="border border-slate-400 rounded-lg p-2.5 bg-white flex flex-col justify-between shadow-2xs">
              <div>
                <div className="font-black text-slate-950 text-xs border-b border-slate-300 pb-1 flex items-center justify-between">
                  <span>الزام قانونی: مبلغ به حروف</span>
                  <span className="font-mono text-[10px] text-slate-500">واحد: {inv.currency}</span>
                </div>
                <div className="bg-slate-100 border border-slate-300 rounded p-2 mt-1 text-xs font-black text-slate-950 leading-tight">
                  مبلغ به حروف: {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
                </div>
                {inv.notes && (
                  <div className="mt-1.5 text-[10.5px] text-slate-700 bg-amber-50/60 border border-amber-200 rounded px-2 py-1">
                    <span className="font-bold text-amber-900">یادداشت فاکتور:</span> {inv.notes}
                  </div>
                )}
              </div>
              <div className="mt-2 pt-1 border-t border-slate-200 text-[10px] text-slate-600 flex items-center justify-between font-medium">
                <span>امور مالی و خزانه‌داری: {companySettings.phone || '0794511271'}</span>
                <span className="font-mono">ثبت قطعی سیستم حسابداری</span>
              </div>
            </div>
          </div>

          {/* Three Signatures */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-4 pt-2 text-center text-xs shrink-0">
              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-1">امضاء و مهر صادرکننده (فروشنده)</span>
                <div className="h-10 flex items-center justify-center relative">
                  {showSignature && renderDigitalSignature(30)}
                  {showStamp && <div className="absolute">{renderDigitalStamp(40)}</div>}
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                  ............................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-1">امضاء و تایید مسئول مالی و حسابداری</span>
                <div className="h-10 flex items-center justify-center text-slate-600 font-mono text-xs">
                  تایید و ثبت سیستم گردید
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                  ............................................................
                </div>
              </div>

              <div className="relative flex flex-col items-center">
                <span className="text-slate-900 font-bold block mb-1">امضاء و تایید خریدار محترم</span>
                <div className="h-10 flex items-center justify-center text-slate-500 font-mono text-xs">
                  صحت مشخصات و قیمت تایید شد
                </div>
                <div className="w-full border-t border-dotted border-slate-400 pt-1 text-slate-400 font-mono text-[9px]">
                  ............................................................
                </div>
              </div>
            </div>
          )}
        </div>

        {showFooter && (
          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-200 mt-1 shrink-0">
            <div>
              سند رسمی مالی صادر شده توسط سیستم حسابداری {companySettings.name || 'شرکت تجارتی'}
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
    const targetRowCount = 5;
    const whRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      whRows.push(items[i] || null);
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
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">
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
              {whRows.map((it, idx) => (
                <tr key={`wh-only-${idx}`} className="border-b border-slate-200 h-7 font-bold">
                  <td className="py-1 px-2 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                  <td className="py-1 px-3 border-l border-slate-200 truncate font-black text-slate-950">{it?.productName || ''}</td>
                  <td className="py-1 px-2 border-l border-slate-200 text-center font-mono font-black">{it ? formatNumber(it.quantity) : ''}</td>
                  <td className="py-1 px-2 text-center text-slate-700">{it ? formatItemUnit(it.unit) : ''}</td>
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

  // Layout dispatcher
  if (invoiceLayout === 'thermal') {
    return renderThermalReceipt();
  }
  if (invoiceLayout === 'warehouse_only') {
    return renderWarehouseSlipOnly();
  }
  if (invoiceLayout === 'invoice_full') {
    return renderFullA4Invoice();
  }
  return renderComboA4Invoice();
};

import React from 'react';
import { Invoice, InvoiceItem } from '../../types';
import {
  formatNumber,
  formatCurrency,
  numberToPersianWords,
  getGregorianEquivalent,
} from '../../utils/formatters';
import { CompanyStampSeal } from '../CompanyStampSeal';
import { InvoiceBarcodeQR } from '../InvoiceBarcodeQR';
import {
  Building2,
  User,
  Scissors,
  FileText,
  Truck,
  ShieldCheck,
} from 'lucide-react';

export type InvoiceTheme = 'navy' | 'gold' | 'emerald' | 'classic';

interface PrintInvoiceDocumentProps {
  inv: Invoice;
  companySettings: any;
  invoiceLayout: 'combo_a4' | 'invoice_only' | 'warehouse_only' | 'invoice_full' | 'thermal';
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
  stampSize = 54,
  signatureSize = 46,
  invoiceTheme = 'navy',
  showWatermark = false,
  watermarkText = 'رسمی',
  showBarcode = false,
  getPartyExtraInfo,
  getWarehouseName,
}) => {
  const isReturnSell = inv.type === 'return_sell';
  const isReturnBuy = inv.type === 'return_buy';
  const isReturn = isReturnSell || isReturnBuy;
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
          className="object-contain select-none z-10 pointer-events-none"
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
      <div className="select-none pointer-events-none opacity-95 flex items-center justify-center">
        <CompanyStampSeal
          size={size}
          stampUrl={stampUrl}
          color={stampColor}
          tilt={true}
        />
      </div>
    );
  };

  // Watermark Component (Optional)
  const renderWatermark = () => {
    if (!showWatermark) return null;
    return (
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
        <div className="transform -rotate-25 text-slate-900/[0.045] font-black text-7xl tracking-widest border-4 border-slate-900/[0.035] rounded-3xl px-8 py-3">
          {watermarkText}
        </div>
      </div>
    );
  };

  // =========================================================================
  // SECTION 1: INVOICE MAIN BODY (قابل استفاده در حالت‌های ترکیبی و تک‌صفحه)
  // بدون بسم الله برای حفظ احترام و جلوگیری از زیر پا افتادن برگه
  // =========================================================================
  const renderInvoiceMainBody = (targetRowsCount: number, isStandalone: boolean = false) => {
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowsCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div className={`space-y-2 relative z-10 ${isStandalone ? 'p-2' : ''}`}>
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-300 pb-2">
          {/* Right: Meta Information Block */}
          <div className="text-right text-[8.5px] text-slate-800 space-y-0.5 min-w-[130px]">
            <div>
              <span className="text-slate-500 font-medium">شماره فاکتور: </span>
              <strong className="text-slate-950 font-mono font-black text-xs">
                #{inv.invoiceNumber}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">تاریخ ثبت: </span>
              <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">ساعت ثبت: </span>
              <strong className="text-slate-900 font-mono">{issueTime}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">نوع پرداخت: </span>
              <strong className="text-slate-900 font-bold">
                {inv.dealTypeLabel || (inv.paymentType ? `${inv.paymentType}` : 'قرضی (اعتباری)')}
              </strong>
            </div>
          </div>

          {/* Center: Company Name & Official Invoice Badge */}
          <div className="text-center flex flex-col items-center justify-center flex-1 px-2">
            <h1 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
              {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
            </h1>
            <div className="mt-1">
              <span className="inline-block bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-bold px-4 py-0.5 rounded-full shadow-2xs">
                {isReturnSell
                  ? 'فاکتور برگشت از فروش کالا'
                  : isReturnBuy
                  ? 'فاکتور برگشت از خرید کالا'
                  : isSale
                  ? 'فاکتور رسمی فروش کالا'
                  : 'فاکتور رسمی خرید کالا'}
              </span>
            </div>
          </div>

          {/* Left: Company Logo */}
          <div className="flex items-center justify-end min-w-[130px]">
            {companySettings.logoUrl ? (
              <img
                src={companySettings.logoUrl}
                alt={companySettings.name}
                className="w-14 h-14 object-contain rounded-full bg-white border border-slate-300 p-0.5 shadow-2xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-full border-2 border-slate-800 bg-white text-slate-900 flex flex-col items-center justify-center font-black text-xs shadow-2xs p-1 text-center">
                <Building2 className="w-5 h-5 text-slate-700" />
                <span className="text-[7px] font-mono leading-tight truncate max-w-[50px]">
                  {companySettings.name?.slice(0, 14) || 'شرکت تجارتی'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Company & Customer Information Cards (Two Boxes Side-by-Side) */}
        <div className="grid grid-cols-2 gap-2 text-[8.5px]">
          {/* Right Box: اطلاعات شرکت (صادرکننده) */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100/90 px-2 py-0.5 border-b border-slate-200 flex items-center justify-between font-bold text-[8.5px] text-slate-900">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-700" />
                <span>اطلاعات شرکت (صادرکننده)</span>
              </span>
            </div>
            <div className="p-1.5 space-y-0.5 text-slate-800 leading-tight">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <span className="text-slate-500">نام واحد تجاری: </span>
                  <strong className="text-slate-950 font-bold">
                    {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
                  </strong>
                </div>
                <span className="font-mono text-slate-600 text-[8px] shrink-0 mr-1">
                  کد/TIN: {companySettings.taxId || companySettings.tin || companySettings.commercialCode || '1'}
                </span>
              </div>
              <div className="font-mono flex items-center gap-1 truncate">
                <span className="text-slate-500 font-sans">شماره تماس: </span>
                <span className="text-slate-900 font-bold">
                  {companySettings.phone || '0794511271'}
                </span>
                {companySettings.phoneSecondary && (
                  <span className="text-slate-600"> - {companySettings.phoneSecondary}</span>
                )}
              </div>
              <div className="truncate">
                <span className="text-slate-500">آدرس شرکت: </span>
                <span>{companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}</span>
              </div>
            </div>
          </div>

          {/* Left Box: اطلاعات طرف حساب (مشتری) */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100/90 px-2 py-0.5 border-b border-slate-200 flex items-center justify-between font-bold text-[8.5px] text-slate-900">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-slate-700" />
                <span>اطلاعات طرف حساب (مشتری)</span>
              </span>
            </div>
            <div className="p-1.5 space-y-0.5 text-slate-800 leading-tight">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <span className="text-slate-500">مشتری محترم: </span>
                  <strong className="text-slate-950 font-black">
                    {inv.partyName || 'مشتری نقدی'}
                  </strong>
                </div>
                <span className="font-mono text-slate-600 text-[8px] shrink-0 mr-1">
                  کد حساب: {partyInfo?.code || partyInfo?.numericCode || '139'}
                </span>
              </div>
              <div className="font-mono flex items-center gap-1 truncate">
                <span className="text-slate-500 font-sans">شماره تماس: </span>
                <span className="text-slate-900 font-bold">{partyPhone}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">آدرس مشتری: </span>
                <span>{partyAddress}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Items Table */}
        <div className="border border-slate-900 rounded-lg overflow-hidden bg-white shadow-2xs">
          <table className="w-full text-right border-collapse text-[8.5px] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[36%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="bg-[#0f172a] text-white font-bold h-6 border-b border-slate-900">
                <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                <th className="py-0.5 px-2 border-l border-white/20 text-right">شرح کالا یا خدمات</th>
                <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد</th>
                <th className="py-0.5 px-1 border-l border-white/20 text-center">واحد</th>
                <th className="py-0.5 px-1 border-l border-white/20 text-center">قیمت ({inv.currency})</th>
                <th className="py-0.5 px-2 border-l border-white/20 text-center">جمع کل ({inv.currency})</th>
                <th className="py-0.5 px-1 text-center">توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((it, idx) => {
                if (!it) {
                  return (
                    <tr key={`inv-empty-${idx}`} className="border-b border-slate-200 h-5">
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-0.5 px-2 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-2 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1"></td>
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
                    className="border-b border-slate-200 font-bold h-5.5 hover:bg-slate-50"
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
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-800 text-[8px]">
                      {unitDisplay}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-900">
                      {formatNumber(it.unitPrice)}
                    </td>
                    <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono font-black text-slate-950">
                      {formatNumber(it.totalPrice)}
                    </td>
                    <td className="py-0.5 px-1 text-center text-slate-500 text-[7.5px] truncate">
                      {it.description || '---'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Area: Terms on Right & Financial Table on Left */}
        <div className="grid grid-cols-2 gap-2 text-[8.5px]">
          {/* Right: قوانین و شرایط عمومی معامله + مبلغ به حروف */}
          <div className="border border-slate-300 rounded-lg p-2 bg-white flex flex-col justify-between leading-tight space-y-1.5 shadow-2xs">
            <div>
              <div className="font-bold text-slate-950 text-[9px] mb-1">
                قوانین و شرایط عمومی معامله:
              </div>
              <div className="text-slate-700 text-[8px] space-y-1 pr-0.5 leading-relaxed">
                <p>لطفا در مورد جنس اطمینان خود را حاصل نموده ، شکایت بعدی قابل قبول نمیباشد.</p>
                <p>فاکتور هذا بدون مهر و امضاء اعتبار ندارد.</p>
                <p>اجناس فروخته شده برای تمام مشترکین موسسات و شرکت ها بدون مالیه میباشد.</p>
                <p>جنس فروخته شده واپس گرفته نمیشود.</p>
              </div>
            </div>

            {/* الزام قانونی حسابداری: مبلغ کل به حروف */}
            <div className="bg-slate-50 border border-slate-300 rounded px-2 py-1 flex items-center justify-between text-[8px]">
              <span className="text-slate-600 font-bold shrink-0">مبلغ کل به حروف:</span>
              <span className="text-slate-950 font-black font-sans truncate mr-1.5 text-[8.5px]">
                {numberToPersianWords(inv.totalAmount)} {inv.currency} تمام
              </span>
            </div>
          </div>

          {/* Left: Financial Breakdown Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white text-[8px] shadow-2xs">
            <table className="w-full text-right border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-0.5 px-2 text-slate-600">جمع کل مبلغ:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-bold text-slate-950">
                    {inv.currency} {formatNumber(subtotalVal)}
                  </td>
                </tr>
                {shippingVal > 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2 text-slate-600">هزینه کرایه حمل:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-bold text-slate-800">
                      {inv.currency} {formatNumber(shippingVal)}
                    </td>
                  </tr>
                )}
                {discountVal > 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2 text-slate-600">تخفیف کلی فاکتور:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-bold text-slate-800">
                      {inv.currency} {formatNumber(discountVal)} -
                    </td>
                  </tr>
                )}
                {taxVal > 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="py-0.5 px-2 text-slate-600">مالیات و عوارض قانونی:</td>
                    <td className="py-0.5 px-2 text-left font-mono font-bold text-slate-800">
                      {inv.currency} {formatNumber(taxVal)} +
                    </td>
                  </tr>
                )}
                <tr className="border-b border-slate-200 bg-sky-50/40">
                  <td className="py-0.5 px-2 font-bold text-sky-800">مبلغ نهایی معامله:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-black text-sky-600 text-[9.5px]">
                    {inv.currency} {formatNumber(inv.totalAmount)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-0.5 px-2 text-slate-600">مبلغ پرداخت‌شده:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-bold text-slate-800">
                    {inv.currency} {formatNumber(inv.paidAmount || 0)}
                  </td>
                </tr>
                <tr className="bg-rose-50/40">
                  <td className="py-0.5 px-2 font-bold text-rose-800">مبلغ باقی‌مانده بدهی:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-black text-rose-600 text-[9.5px]">
                    {inv.currency} {formatNumber(remainingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures of Main Invoice (3 Columns) with Digital Stamps */}
        {showSignatures && (
          <div className="grid grid-cols-3 gap-3 pt-1 text-center text-[8.5px]">
            <div className="relative flex flex-col items-center">
              <span className="text-slate-800 font-bold block mb-1">امضاء و مهر صادرکننده / تحویل‌دهنده</span>
              <div className="h-9 flex items-center justify-center relative">
                {showSignature && renderDigitalSignature(signatureSize)}
                {showStamp && (
                  <div className="absolute -top-1 opacity-90">
                    {renderDigitalStamp(stampSize)}
                  </div>
                )}
              </div>
              <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                ....................................................
              </div>
            </div>

            <div className="relative flex flex-col items-center">
              <span className="text-slate-800 font-bold block mb-1">امضاء و تایید مسئول مالی و حسابداری</span>
              <div className="h-9 flex items-center justify-center text-[8px] text-slate-500 font-mono">
                تایید شده
              </div>
              <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                ....................................................
              </div>
            </div>

            <div className="relative flex flex-col items-center">
              <span className="text-slate-800 font-bold block mb-1">امضاء و تایید مشتری / خریدار محترم</span>
              <div className="h-9 flex items-center justify-center text-[8px] text-slate-400 font-mono">
                رویت و دریافت شد
              </div>
              <div className="w-full border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                ....................................................
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // SECTION 3: WAREHOUSE EXIT SLIP (حواله خروج کالا از گدام - نسخه گدام‌دار)
  // =========================================================================
  const renderWarehouseSlipBody = (targetRowsCount: number, isStandalone: boolean = false) => {
    const warehouseRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowsCount; i++) {
      warehouseRows.push(items[i] || null);
    }

    return (
      <div className={`border border-slate-300 rounded-xl p-2 bg-white space-y-1.5 text-[8.5px] shadow-2xs relative z-10 ${isStandalone ? 'p-3' : ''}`}>
        {/* Warehouse Header Line */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-1 text-[8px]">
          <div className="flex items-center gap-1 font-black text-slate-950 text-[9px]">
            <Building2 className="w-3.5 h-3.5 text-slate-700" />
            <span>برگه حواله خروج کالا از گدام (نسخه گدام‌دار)</span>
          </div>
          <div className="flex items-center gap-3 text-slate-700">
            <div>
              <span>شماره فاکتور مرجع: </span>
              <strong className="text-slate-950 font-mono font-bold">#{inv.invoiceNumber}</strong>
            </div>
            <div>
              <span>تاریخ ثبت: </span>
              <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
            </div>
            <div>
              <span>ساعت ثبت: </span>
              <strong className="text-slate-900 font-mono">{issueTime}</strong>
            </div>
            <div className="truncate max-w-[150px]">
              <span>تحویل به مشتری: </span>
              <strong className="text-slate-950 font-bold">{inv.partyName || 'مشتری نقدی'}</strong>
            </div>
          </div>
        </div>

        {/* Warehouse Items Table */}
        <div className="border border-slate-900 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-right border-collapse text-[8px] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[46%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="bg-[#0f172a] text-white font-bold h-5 border-b border-slate-900">
                <th className="py-0.5 px-1 border-l border-white/20 text-center">#</th>
                <th className="py-0.5 px-2 border-l border-white/20 text-right">نام و شرح کالای تحویلی</th>
                <th className="py-0.5 px-1 border-l border-white/20 text-center">تعداد / مقدار</th>
                <th className="py-0.5 px-1 border-l border-white/20 text-center">واحد سنجش</th>
                <th className="py-0.5 px-1 text-center">توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {warehouseRows.map((it, idx) => {
                if (!it) {
                  return (
                    <tr key={`wh-empty-${idx}`} className="border-b border-slate-200 h-4.5">
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-0.5 px-2 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1"></td>
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
                    key={`wh-it-${idx}`}
                    className="border-b border-slate-200 font-bold h-5 hover:bg-slate-50"
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
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-800 text-[8px]">
                      {unitDisplay}
                    </td>
                    <td className="py-0.5 px-1 text-center text-slate-500 text-[7.5px] truncate">
                      {it.description || '---'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Warehouse Signatures */}
        {showSignatures && (
          <div className="grid grid-cols-2 gap-6 pt-1 text-center text-[8px]">
            <div>
              <span className="text-slate-800 font-bold block mb-2">
                امضاء و مهر مسئول گدام (تایید تحویل کالا)
              </span>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                ......................................................................................
              </div>
            </div>
            <div>
              <span className="text-slate-800 font-bold block mb-2">
                امضاء و تایید خریدار / راننده (تایید دریافت کالا)
              </span>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px]">
                ......................................................................................
              </div>
            </div>
          </div>
        )}

        {/* Sub-footer */}
        <div className="flex items-center justify-between text-[7px] text-slate-500 pt-0.5 border-t border-slate-200">
          <div>نسخه گدام‌دار - هرات، افغانستان</div>
          <div>
            سیستم مالی یکپارچه {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // COMBO A4 INVOICE (طرح دقیق و بی‌نظیر منطبق با تصویر ارسالی کاربر)
  // بدون بسم الله، محصور در کادر سراسری صفحه بدون بیرون‌زدگی
  // =========================================================================
  const renderComboA4Invoice = () => {
    const targetRowCount = Math.max(5, items.length);

    return (
      <div
        className="a4-combo-enclosed-page w-full border-2 border-slate-900 rounded-xl p-3 sm:p-4 bg-white box-border text-[8.5px] leading-tight select-text relative flex flex-col justify-between overflow-hidden shadow-2xs"
        dir="rtl"
      >
        {renderWatermark()}

        {/* SECTION 1: MAIN INVOICE (بالای برگه) */}
        {renderInvoiceMainBody(targetRowCount, false)}

        {/* SECTION 2: PERFORATED CUT LINE (محل خط برش) */}
        <div className="relative my-1.5 flex items-center justify-center select-none shrink-0">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-slate-400" />
          </div>
          <div className="relative bg-white px-3 flex items-center gap-1.5 text-slate-700 text-[8px] font-bold border border-slate-300 rounded-full shadow-2xs">
            <Scissors className="w-3 h-3 text-slate-600 -rotate-90" />
            <span>محل برش برگه حواله گدامدار</span>
          </div>
        </div>

        {/* SECTION 3: WAREHOUSE EXIT SLIP (پایین برگه) */}
        {renderWarehouseSlipBody(targetRowCount, false)}

        {/* SECTION 4: VERY BOTTOM FOOTER */}
        <div className="flex items-center justify-between text-[7.5px] text-slate-600 pt-1 border-t border-slate-300 shrink-0">
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
  // STANDALONE INVOICE ONLY (تنها فاکتور رسمی بدون حواله گدام)
  // =========================================================================
  const renderStandaloneInvoice = () => {
    const targetRowCount = Math.max(8, items.length);

    return (
      <div
        className="a4-combo-enclosed-page w-full border-2 border-slate-900 rounded-xl p-4 sm:p-6 bg-white box-border text-[9px] leading-normal select-text relative flex flex-col justify-between overflow-hidden shadow-2xs"
        dir="rtl"
      >
        {renderWatermark()}
        {renderInvoiceMainBody(targetRowCount, true)}
        <div className="flex items-center justify-between text-[8px] text-slate-600 pt-2 border-t border-slate-300 shrink-0 mt-4">
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
  // STANDALONE WAREHOUSE SLIP ONLY (تنها حواله گدامدار)
  // =========================================================================
  const renderStandaloneWarehouseSlip = () => {
    const targetRowCount = Math.max(8, items.length);

    return (
      <div
        className="a4-combo-enclosed-page w-full border-2 border-slate-900 rounded-xl p-4 sm:p-6 bg-white box-border text-[9px] leading-normal select-text relative flex flex-col justify-between overflow-hidden shadow-2xs"
        dir="rtl"
      >
        {renderWatermark()}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <div>
              <h2 className="text-base font-black text-slate-900">
                {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
              </h2>
              <p className="text-xs text-slate-600">برگه رسمی حواله خروج و تحویل اجناس از گدام</p>
            </div>
            <div className="text-left font-mono text-xs">
              <div>شماره فاکتور: <strong>#{inv.invoiceNumber}</strong></div>
              <div>تاریخ: <strong>{inv.date}</strong></div>
            </div>
          </div>
          {renderWarehouseSlipBody(targetRowCount, true)}
        </div>
        <div className="flex items-center justify-between text-[8px] text-slate-600 pt-2 border-t border-slate-300 shrink-0 mt-4">
          <div>سیستم اتوماسیون گدامداری و انبار</div>
          <div className="font-mono">تلفن: {companySettings.phone || '0794511271'}</div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // THERMAL RECEIPT
  // =========================================================================
  const renderThermalReceipt = () => {
    return (
      <div className="font-mono text-slate-900 bg-white p-3 space-y-2 border border-slate-300 rounded text-[9.5px] leading-tight max-w-[320px] mx-auto select-none" dir="rtl">
        <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
          <div className="font-black text-xs text-slate-950 font-sans">
            {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
          </div>
          <div className="text-[8.5px] text-slate-600 font-sans">رسید چاپی معامله</div>
          <div className="text-[8.5px] text-slate-600">{companySettings.phone}</div>
        </div>

        <div className="space-y-0.5 text-[8.5px]">
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

        <table className="w-full text-right border-collapse text-[9px] table-fixed">
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[20%]" />
            <col className="w-[35%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-400 font-bold">
              <th className="py-0.5 text-right">کالا</th>
              <th className="py-0.5 text-center">تعداد</th>
              <th className="py-0.5 text-left">مجموع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={`th-${idx}`} className="border-b border-slate-200">
                <td className="py-0.5 truncate">{it.productName}</td>
                <td className="py-0.5 text-center">{formatNumber(it.quantity)}</td>
                <td className="py-0.5 text-left font-bold">{formatNumber(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-0.5 pt-1 border-t border-dashed border-slate-400 text-[9.5px]">
          <div className="flex justify-between font-black text-[11px]">
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

        <div className="text-center pt-2 border-t border-dashed border-slate-400 text-[8.5px] text-slate-500 font-sans">
          از خرید و همکاری شما متشکریم
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER BASED ON LAYOUT OPTION
  // =========================================================================

  // OPTION 1: THERMAL RECEIPT
  if (invoiceLayout === 'thermal') {
    return renderThermalReceipt();
  }

  // OPTION 2: STANDALONE INVOICE ONLY
  if (invoiceLayout === 'invoice_only') {
    return renderStandaloneInvoice();
  }

  // OPTION 3: STANDALONE WAREHOUSE SLIP ONLY
  if (invoiceLayout === 'warehouse_only') {
    return renderStandaloneWarehouseSlip();
  }

  // DEFAULT & FULL A4: COMBO A4 (فاکتور رسمی ۲/۳ + حواله گدامدار ۱/۳ در یک صفحه با کادر کامل بدون بیرون‌زدگی)
  return renderComboA4Invoice();
};

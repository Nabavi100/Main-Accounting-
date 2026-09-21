import React from 'react';
import { Invoice, InvoiceItem } from '../../types';
import { formatNumber, formatCurrency, numberToPersianWords } from '../../utils/formatters';
import { CompanyStampSeal } from '../CompanyStampSeal';
import {
  Phone,
  MapPin,
  Truck,
  Scissors,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';

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
  getPartyExtraInfo: (partyId?: string, partyName?: string) => any;
  getWarehouseName: (warehouseId?: string) => string;
}

export const PrintInvoiceDocument: React.FC<PrintInvoiceDocumentProps> = ({
  inv,
  companySettings,
  invoiceLayout,
  showSignatures,
  showCustomerBalance,
  showStamp = true,
  showSignature = true,
  stampUrl,
  signatureUrl,
  stampColor = 'navy',
  stampSize = 56,
  signatureSize = 48,
  getPartyExtraInfo,
  getWarehouseName,
}) => {
  const isReturnSell = inv.type === 'return_sell';
  const isReturnBuy = inv.type === 'return_buy';
  const isReturn = isReturnSell || isReturnBuy;
  const isSale = inv.type === 'sell' || isReturnSell;

  const themeBadge = isReturn
    ? 'bg-amber-100 text-amber-950 border border-amber-500 font-black'
    : isSale
    ? 'bg-rose-100 text-rose-950 border border-rose-300 font-black'
    : 'bg-blue-100 text-blue-950 border border-blue-300 font-black';
  const themeTableHead = 'bg-slate-100 text-slate-900';

  const partyInfo = getPartyExtraInfo(inv.partyId, inv.partyName);
  const partyPhone = inv.partyPhone || partyInfo?.phone || '---';
  const partyAddress = inv.partyAddress || partyInfo?.address || '---';
  const issueTime = inv.issueTime || '۱۰:۳۰';

  const discountVal = Number(inv.discount || 0);
  const shippingVal = Number(inv.shippingCost || 0);
  const extraExpVal = Number(inv.extraExpensesTotal || 0);
  const subtotalVal = Number(
    inv.subtotalAmount ||
      inv.subtotal ||
      inv.totalAmount + discountVal - shippingVal - extraExpVal
  );

  const remainingBalance =
    inv.balanceAmount !== undefined
      ? inv.balanceAmount
      : inv.totalAmount - (inv.paidAmount || 0);
  const isFullySettled =
    remainingBalance <= 0.001 ||
    (inv.paidAmount >= inv.totalAmount && inv.totalAmount > 0) ||
    inv.paymentStatus === 'paid' ||
    (inv.paymentType === 'نقدی' && remainingBalance <= 0.001);

  const currencyName =
    inv.currency === 'USD'
      ? 'دلار آمریکایی'
      : inv.currency === 'AFN'
      ? 'افغانی'
      : inv.currency;
  const totalAmountInWords = numberToPersianWords(inv.totalAmount, currencyName);

  const items = inv.items || [];
  const totalTons = items.reduce((s, it) => s + (it.tonsCount || 0), 0);
  const totalBags = items.reduce((s, it) => s + (it.bagsCount || 0), 0);

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
          className="object-contain select-none z-10 filter contrast-125 pointer-events-none"
        />
      );
    }
    return (
      <div className="transform -rotate-6 scale-90">
        <svg width="100" height="34" viewBox="0 0 160 60" className="text-blue-900 stroke-current fill-none">
          <path d="M 15 35 Q 35 10, 60 30 T 110 25 T 145 35" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 40 45 Q 80 15, 120 40" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M 50 15 L 65 48" strokeWidth="2" strokeLinecap="round" />
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

  // =========================================================================
  // 2/3 PAGE INVOICE (فاکتور رسمی - دو سوم صفحه A4 بدون بیرون‌زدگی)
  // =========================================================================
  const renderTwoThirdsInvoice = () => {
    const rowCount = Math.max(4, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < rowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div className="invoice-print-frame two-thirds-a4-box border-1.5 border-slate-900 rounded-xl p-2.5 sm:p-3 bg-white box-border w-full shadow-2xs space-y-1.5 text-[9.5px] leading-tight" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
          <div className="flex items-center gap-2.5">
            {companySettings.logoUrl ? (
              <img
                src={companySettings.logoUrl}
                alt={companySettings.name}
                className="w-10 h-10 object-contain rounded-lg bg-white border border-slate-300 p-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xs">
                {companySettings.logoIconText || 'نبوی'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </h1>
                <span className="text-[8.5px] text-slate-500 font-medium">
                  {companySettings.tagline || 'عرضه عمده سیمان، گچ و مصالح ساختمانی'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 text-[8.5px] text-slate-600 mt-0.5">
                <span className="font-mono flex items-center gap-0.5">
                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                  <span>تلفن: {companySettings.phone || '۰۷۹۹۱۱۱۱۱'}</span>
                  {companySettings.phoneSecondary && <span> / {companySettings.phoneSecondary}</span>}
                </span>
                {companySettings.address && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5 text-slate-500" />
                    <span>آدرس: {companySettings.address}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta Information */}
          <div className="text-left font-mono shrink-0 flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-lg ${themeBadge}`}>
                {isReturnSell
                  ? 'فاکتور برگشت از فروش'
                  : isReturnBuy
                  ? 'فاکتور برگشت از خرید'
                  : isSale
                  ? 'فاکتور رسمی فروش کالا'
                  : 'فاکتور رسمی خرید کالا'}
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-900">
                #{inv.invoiceNumber}
              </span>
            </div>
            <div className="text-[8.5px] text-slate-600 font-sans mt-0.5 flex items-center gap-1.5">
              <span>تاریخ: <strong className="font-mono text-slate-900">{inv.date}</strong></span>
              <span>ساعت: <strong className="font-mono text-slate-900">{issueTime}</strong></span>
              {isFullySettled && (
                <span className="text-[8px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                  ✓ تسویه نقدی
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Customer & Transaction Profile Grid */}
        <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-lg bg-slate-50 border border-slate-300 text-[9px]">
          <div className="truncate">
            <span className="text-slate-500 block text-[7.5px] font-bold">طرف حساب / خریدار:</span>
            <strong className="text-slate-900 font-black text-[10.5px] truncate block">{inv.partyName || 'مشتری متفرقه (نقدی)'}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[7.5px] font-bold">شماره تماس مشتری:</span>
            <span className="font-mono font-bold text-slate-800">{partyPhone}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[7.5px] font-bold">واحد ارزی و نحوه تسویه:</span>
            <span className="font-bold text-slate-900 truncate block">
              {currencyName} ({inv.dealTypeLabel || inv.dealType || 'نقدی'})
            </span>
          </div>
          <div className="truncate">
            <span className="text-slate-500 block text-[7.5px] font-bold">
              {inv.driverName ? 'موتروان و بارگیری:' : 'گدام و مقصد بار:'}
            </span>
            <span className="text-slate-800 truncate block font-medium">
              {inv.driverName
                ? `${inv.driverName} ${inv.carPlate ? `(${inv.carPlate})` : ''}`
                : `${getWarehouseName(inv.warehouseId)} • ${partyAddress || 'تحویل درب انبار'}`}
            </span>
          </div>
        </div>

        {/* Table of Items (Proportional to 2/3 page) */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-right border-collapse text-[9px] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[33%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className={`${themeTableHead} font-bold border-b border-slate-800 h-5.5`}>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">#</th>
                <th className="py-0.5 px-1.5 border-l border-slate-300 text-right">نام جنس و مشخصات کالا</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">مقدار</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">واحد</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">معادل (تن/کیسه)</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">قیمت فی</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-left">مجموع ({inv.currency})</th>
                <th className="py-0.5 px-1 text-center">گدام</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((it, idx) => {
                if (!it) {
                  return (
                    <tr key={`inv-empty-${idx}`} className="border-b border-slate-200 h-5.5">
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-300">{idx + 1}</td>
                      <td className="py-0.5 px-1.5 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1"></td>
                    </tr>
                  );
                }
                return (
                  <tr key={`inv-it-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold h-6">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-0.5 px-1.5 border-l border-slate-200 text-slate-900 font-black truncate" title={it.productName}>{it.productName}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                      {formatNumber(it.quantity)}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-600">{it.unit || 'عدد'}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-600 text-[8.5px]">
                      {it.tonsCount ? `${formatNumber(it.tonsCount)} تن` : ''}
                      {it.tonsCount && it.bagsCount ? ' / ' : ''}
                      {it.bagsCount ? `${formatNumber(it.bagsCount)} کیسه` : (!it.tonsCount ? '---' : '')}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-700">
                      {formatNumber(it.unitPrice)}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-left font-mono font-black text-slate-950">
                      {formatNumber(it.totalPrice)}
                    </td>
                    <td className="py-0.5 px-1 text-center text-slate-600 text-[8px] truncate">
                      {getWarehouseName(it.warehouseId || inv.warehouseId)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-800 h-5.5">
                <td colSpan={4} className="py-0.5 px-1.5 text-left border-l border-slate-300 font-black">
                  مجموع تناژ و خریطه (کیسه):
                </td>
                <td className="py-0.5 px-1 text-center border-l border-slate-300 font-mono text-slate-950 font-black text-[8.5px]">
                  {formatNumber(totalTons)} تن / {formatNumber(totalBags)} کیسه
                </td>
                <td className="py-0.5 px-1 text-center border-l border-slate-300 text-slate-600">جمع کل:</td>
                <td className="py-0.5 px-1 text-left border-l border-slate-300 font-mono font-black text-[10px]">
                  {formatNumber(subtotalVal)}
                </td>
                <td className="py-0.5 px-1 text-center text-slate-500 font-mono">{inv.currency}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Financial Breakdown & Terms/Notes (2 Columns) */}
        <div className="grid grid-cols-2 gap-2 text-[8.5px]">
          {/* Left Column: Conditions, Notes, & Words */}
          <div className="flex flex-col justify-between border border-slate-300 rounded-lg p-1.5 bg-slate-50/70 space-y-1">
            <div>
              <div className="font-bold text-slate-800 text-[8.5px] mb-0.5 flex items-center gap-1">
                <FileCheck className="w-3 h-3 text-blue-700" />
                <span>ملاحظات و شرایط تحویل کالا:</span>
              </div>
              <p className="text-slate-600 leading-tight text-[8px]">
                {inv.notes || 'اجناس فوق به صورت صحیح و سالم تحویل خریدار گردید. ادعای هرگونه نقص پس از بارگیری پذیرفته نمی‌شود.'}
              </p>
            </div>
            <div className="pt-1 border-t border-slate-200">
              <div className="text-blue-950 font-black text-[8.5px] leading-tight">
                <span className="text-slate-500 font-medium">مبلغ کل به حروف: </span>
                {totalAmountInWords}
              </div>
              <div className="text-[7.5px] text-slate-500 mt-0.5 flex justify-between">
                <span>محل بارگیری: {getWarehouseName(inv.warehouseId)}</span>
                <span>مقصد: {partyAddress || 'درب انبار'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Complete Financial Settlement Card */}
          <div className="border border-slate-800 rounded-lg p-1.5 bg-white space-y-0.5">
            <div className="flex items-center justify-between text-slate-700 pb-0.5 border-b border-slate-200 text-[8px]">
              <span>جمع اولیه اقلام:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(subtotalVal, inv.currency)}</span>
            </div>

            {discountVal > 0 && (
              <div className="flex items-center justify-between text-rose-700 pb-0.5 border-b border-slate-200 text-[8px]">
                <span className="font-bold">تخفیف ویژه:</span>
                <span className="font-mono font-black">- {formatCurrency(discountVal, inv.currency)}</span>
              </div>
            )}

            {shippingVal > 0 && (
              <div className="flex items-center justify-between text-amber-800 pb-0.5 border-b border-slate-200 text-[8px]">
                <span>کرایه حمل بار:</span>
                <span className="font-mono font-bold">+ {formatCurrency(shippingVal, inv.currency)}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-0.5 px-1.5 bg-slate-900 text-white rounded font-black text-[9.5px]">
              <span>مبلغ نهایی قابل پرداخت:</span>
              <span className="font-mono">{formatCurrency(inv.totalAmount, inv.currency)}</span>
            </div>

            <div className="flex items-center justify-between pt-0.5 text-[8px]">
              <span className="text-slate-600">پرداخت نقدی: <strong className="font-mono text-emerald-700 font-black">{formatCurrency(inv.paidAmount || 0, inv.currency)}</strong></span>
              <span className="text-slate-700">مانده فاکتور: <strong className="font-mono text-rose-700 font-black">{formatCurrency(remainingBalance, inv.currency)}</strong></span>
            </div>

            {showCustomerBalance && partyInfo && (
              <div className="flex items-center justify-between text-[7.5px] text-slate-600 pt-0.5 border-t border-dashed border-slate-300">
                <span>الباقی کل حساب مشتری:</span>
                <span className="font-mono font-bold">
                  {(partyInfo.balanceAFN || 0).toLocaleString()} AFN / ${(partyInfo.balanceUSD || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Signatures & Stamp */}
        {showSignatures && (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-300 text-center text-[8px]">
            <div className="flex flex-col justify-between min-h-[38px]">
              <span className="text-slate-600 font-bold text-[7.5px]">صادرکننده فاکتور</span>
              <div className="h-5 flex items-center justify-center">
                {showSignature && renderDigitalSignature(signatureSize ? Math.min(signatureSize, 34) : 30)}
              </div>
              <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold text-[7.5px]">
                مدیریت فروش و حسابداری
              </div>
            </div>

            <div className="flex flex-col justify-between min-h-[38px]">
              <span className="text-slate-600 font-bold text-[7.5px]">مهر رسمی شرکت</span>
              <div className="h-5 flex items-center justify-center">
                {showStamp && renderDigitalStamp(stampSize ? Math.min(stampSize, 40) : 34)}
              </div>
              <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold text-[7.5px]">
                {companySettings.name || 'شرکت برادران نبوی'}
              </div>
            </div>

            <div className="flex flex-col justify-between min-h-[38px]">
              <span className="text-slate-600 font-bold text-[7.5px]">امضا و اثر انگشت خریدار</span>
              <div className="h-5 flex items-center justify-center text-[7px] text-slate-300 select-none">
                (محل امضا یا اثر انگشت)
              </div>
              <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold text-[7.5px]">
                {inv.partyName || 'خریدار محترم'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 1/3 PAGE WAREHOUSE EXIT SLIP (فرم خروجی انبار - یک سوم صفحه A4)
  // =========================================================================
  const renderOneThirdWarehouseSlip = () => {
    const whRows: (InvoiceItem | null)[] = items.length <= 1 ? [items[0] || null, null] : [...items];

    return (
      <div className="warehouse-exit-slip-frame one-third-a4-box border-1.5 border-slate-900 rounded-lg p-2 bg-slate-50/40 box-border w-full shadow-2xs space-y-1 text-[8.5px] leading-tight" dir="rtl">
        {/* Warehouse Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-black shadow-xs">
              <Truck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-black text-slate-900">
                  {isReturn ? 'رسید ورود کالا به گدام (برگشت کالا)' : 'حواله رسمی خروج کالا و تحویل بار از گدام'}
                </h2>
                <span className="text-[7.5px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                  {companySettings.name || 'شرکت برادران نبوی'}
                </span>
              </div>
              <p className="text-[8px] text-slate-600">
                گدام تحویل: <strong>{getWarehouseName(inv.warehouseId)}</strong> • فاکتور عطف: #{inv.invoiceNumber}
              </p>
            </div>
          </div>

          <div className="text-left font-mono text-[8.5px] shrink-0">
            <div className="font-bold text-slate-900">
              حواله انبار: #{inv.invoiceNumber}
            </div>
            <div className="text-slate-600 text-[8px]">
              تاریخ: <strong className="font-mono">{inv.date}</strong> ({issueTime})
            </div>
            {isFullySettled ? (
              <span className="text-[7.5px] font-bold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded mt-0.5 inline-block border border-emerald-300">
                تسویه شده
              </span>
            ) : (
              <span className="text-[7.5px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded mt-0.5 inline-block border border-amber-300">
                تایید حسابداری
              </span>
            )}
          </div>
        </div>

        {/* Recipient & Logistics Strip */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded bg-white border border-slate-300 text-[8px]">
          <div className="truncate">
            <span className="text-slate-500 block text-[7px] font-bold">تحویل‌گیرنده:</span>
            <strong className="text-slate-900 font-bold truncate block">{inv.partyName || 'مشتری متفرقه'}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[7px] font-bold">تماس خریدار:</span>
            <span className="font-mono font-bold text-slate-800">{partyPhone}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[7px] font-bold">راننده و موتروان:</span>
            <span className="font-bold text-slate-800 truncate block">
              {inv.driverName || 'تحویل حضوری'} {inv.carPlate ? `(${inv.carPlate})` : ''}
            </span>
          </div>
          <div className="truncate">
            <span className="text-slate-500 block text-[7px] font-bold">محل تخلیه بار:</span>
            <span className="text-slate-800 truncate block font-medium">{partyAddress || 'تحویل درب انبار'}</span>
          </div>
        </div>

        {/* Warehouse Items Table */}
        <div className="border border-slate-800 rounded overflow-hidden bg-white">
          <table className="w-full text-right border-collapse text-[8px] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[36%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-800 h-4.5">
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">#</th>
                <th className="py-0.5 px-1.5 border-l border-slate-300 text-right">نام و مشخصات کالا</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">مقدار تحویلی</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">واحد</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">معادل تناژ (تن)</th>
                <th className="py-0.5 px-1 border-l border-slate-300 text-center">معادل خریطه (کیسه)</th>
                <th className="py-0.5 px-1 text-center">گدام تحویل</th>
              </tr>
            </thead>
            <tbody>
              {whRows.map((it, idx) => {
                if (!it) {
                  return (
                    <tr key={`wh-empty-${idx}`} className="border-b border-slate-200 h-4.5">
                      <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-300">{idx + 1}</td>
                      <td className="py-0.5 px-1.5 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1 border-l border-slate-200"></td>
                      <td className="py-0.5 px-1"></td>
                    </tr>
                  );
                }
                return (
                  <tr key={`wh-it-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold h-5">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-0.5 px-1.5 border-l border-slate-200 text-slate-900 font-bold truncate" title={it.productName}>{it.productName}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                      {formatNumber(it.quantity)}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-600">{it.unit || 'عدد'}</td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-700">
                      {it.tonsCount ? `${formatNumber(it.tonsCount)} تن` : '---'}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-700">
                      {it.bagsCount ? `${formatNumber(it.bagsCount)} کیسه` : '---'}
                    </td>
                    <td className="py-0.5 px-1 text-center text-slate-600 text-[8px] truncate">
                      {getWarehouseName(it.warehouseId || inv.warehouseId)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-4.5 bg-slate-100 border-t border-slate-800">
                <td colSpan={2} className="py-0.5 px-1.5 text-slate-900 font-black border-l border-slate-300">
                  مجموع اقلام تحویلی گدام:
                </td>
                <td colSpan={5} className="py-0.5 px-1 text-slate-950 font-mono font-black whitespace-nowrap text-[8px]">
                  {formatNumber(totalTons)} تن معادل {formatNumber(totalBags)} کیسه
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Warehouse Signatures */}
        {showSignatures && (
          <div className="grid grid-cols-3 gap-2 pt-0.5 border-t border-slate-300 text-center text-[7.5px]">
            <div className="flex flex-col justify-between min-h-[32px]">
              <span className="text-slate-500 text-[7px]">امضای انباردار (تحویل‌دهنده)</span>
              <div className="h-3.5 flex items-center justify-center text-[6.5px] text-slate-300 select-none">
                (محل امضای انباردار)
              </div>
              <div className="border-t border-dashed border-slate-400 pt-0.2 text-slate-800 font-bold text-[7px]">
                مسئول گدام
              </div>
            </div>
            <div className="flex flex-col justify-between min-h-[32px]">
              <span className="text-slate-500 text-[7px]">امضای راننده / موتروان</span>
              <div className="h-3.5 flex items-center justify-center text-[6.5px] text-slate-300 select-none">
                (محل امضای راننده)
              </div>
              <div className="border-t border-dashed border-slate-400 pt-0.2 text-slate-800 font-bold text-[7px]">
                {inv.driverName || 'راننده بار'}
              </div>
            </div>
            <div className="flex flex-col justify-between min-h-[32px]">
              <span className="text-slate-500 text-[7px]">امضای تحویل‌گیرنده کالا</span>
              <div className="h-3.5 flex items-center justify-center text-[6.5px] text-slate-300 select-none">
                (محل امضا یا اثر انگشت)
              </div>
              <div className="border-t border-dashed border-slate-400 pt-0.2 text-slate-800 font-bold text-[7px]">
                {inv.partyName || 'مشتری / نماینده'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // FULL-PAGE INVOICE (فاکتور رسمی تمام‌صفحه A4)
  // =========================================================================
  const renderFullPageInvoice = () => {
    const fullRowCount = Math.max(7, items.length);
    const fullDisplayRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < fullRowCount; i++) {
      fullDisplayRows.push(items[i] || null);
    }

    return (
      <div className="relative z-10 font-sans text-slate-900 space-y-3 w-full box-border printable-content" dir="rtl">
        <div className="invoice-print-frame border-2 border-slate-900 rounded-2xl p-4 sm:p-5 bg-white space-y-3.5 box-border w-full shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-3.5">
              {companySettings.logoUrl ? (
                <img
                  src={companySettings.logoUrl}
                  alt={companySettings.name}
                  className="w-14 h-14 object-contain rounded-xl bg-white border border-slate-300 p-1"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                  {companySettings.logoIconText || 'نبوی'}
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  {companySettings.tagline || 'واردات و عرضه عمده سیمان، گچ و مصالح ساختمانی'}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-600 mt-1 font-mono">
                  <span>تلفن تماس: {companySettings.phone} {companySettings.phoneSecondary ? ` / ${companySettings.phoneSecondary}` : ''}</span>
                  {companySettings.address && <span>• آدرس: {companySettings.address}</span>}
                </div>
              </div>
            </div>

            <div className="text-left font-mono shrink-0 flex flex-col items-end">
              <span className={`text-xs font-black px-3 py-1 rounded-xl ${themeBadge}`}>
                {isReturnSell
                  ? 'فاکتور برگشت از فروش'
                  : isReturnBuy
                  ? 'فاکتور برگشت از خرید'
                  : isSale
                  ? 'فاکتور رسمی فروش کالا'
                  : 'فاکتور رسمی خرید کالا'}
              </span>
              <div className="text-sm font-black text-slate-900 mt-1.5">
                شماره فاکتور: <span className="text-rose-700">#{inv.invoiceNumber}</span>
              </div>
              <div className="text-xs text-slate-600 font-sans mt-0.5 flex items-center gap-2">
                <span>تاریخ: <strong className="font-mono text-slate-900">{inv.date}</strong></span>
                <span>ساعت: <strong className="font-mono text-slate-900">{issueTime}</strong></span>
              </div>
              {isFullySettled && (
                <span className="mt-1 text-[10.5px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                  ✓ تسویه کامل نقدی
                </span>
              )}
            </div>
          </div>

          {/* Customer Profile & Deal Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs">
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">نام طرف حساب / مشتری:</span>
              <strong className="text-slate-900 font-black text-sm">{inv.partyName || 'مشتری نقدی'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">شماره تماس مشتری:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{partyPhone}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">واحد ارزی و تسویه:</span>
              <strong className="text-blue-900 font-black text-xs">{currencyName} ({inv.paymentType || 'نقدی'})</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">نوع معامله و تحویل:</span>
              <span className="font-bold text-slate-800 text-xs">
                {inv.dealTypeLabel || inv.dealType || 'فروش کالا'} • {getWarehouseName(inv.warehouseId)}
              </span>
            </div>
          </div>

          {/* Logistics Bar (if provided) */}
          {(inv.driverName || inv.carPlate || inv.driverPhone || inv.shippingCost) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
              <div>
                <span className="text-amber-900 block text-[10px] font-bold">نام راننده / موتروان:</span>
                <strong className="text-slate-900">{inv.driverName || '---'}</strong>
              </div>
              <div>
                <span className="text-amber-900 block text-[10px] font-bold">شماره پلاک موتر:</span>
                <span className="font-mono font-bold text-slate-900">{inv.carPlate || '---'}</span>
              </div>
              <div>
                <span className="text-amber-900 block text-[10px] font-bold">تلفن راننده:</span>
                <span className="font-mono font-bold text-slate-900">{inv.driverPhone || '---'}</span>
              </div>
              <div>
                <span className="text-amber-900 block text-[10px] font-bold">مقصد تخلیه بار:</span>
                <span className="text-slate-800 truncate" title={partyAddress}>{partyAddress}</span>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="border border-slate-900 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-xs table-fixed">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[34%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className={`${themeTableHead} font-black border-b border-slate-300`}>
                  <th className="py-2 px-2.5 border-l border-slate-300 text-center">#</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-right">شرح کالا و مشخصات</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center">مقدار</th>
                  <th className="py-2 px-2.5 border-l border-slate-300 text-center">واحد</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center">معادل (تن/کیسه)</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center">قیمت فی</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-left">مجموع ({inv.currency})</th>
                  <th className="py-2 px-3 text-center">گدام تحویل</th>
                </tr>
              </thead>
              <tbody>
                {fullDisplayRows.map((it, idx) => {
                  if (!it) {
                    return (
                      <tr key={`full-empty-${idx}`} className="border-b border-slate-200 h-8">
                        <td className="py-1 px-2 border-l border-slate-200 text-center font-mono text-slate-300">{idx + 1}</td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2 border-l border-slate-200"></td>
                        <td className="py-1 px-2"></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`full-item-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold">
                      <td className="py-2 px-2.5 border-l border-slate-200 text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-slate-900 font-black truncate">{it.productName}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono font-black text-slate-900 text-sm">
                        {formatNumber(it.quantity)}
                      </td>
                      <td className="py-2 px-2.5 border-l border-slate-200 text-center text-slate-700 text-xs">{it.unit || 'عدد'}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono text-slate-700 text-xs">
                        {it.tonsCount ? `${formatNumber(it.tonsCount)} تن` : ''}
                        {it.tonsCount && it.bagsCount ? ' / ' : ''}
                        {it.bagsCount ? `${formatNumber(it.bagsCount)} کیسه` : (!it.tonsCount ? '---' : '')}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono text-slate-800 text-xs">
                        {formatNumber(it.unitPrice)}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 text-left font-mono font-black text-slate-950 text-xs">
                        {formatNumber(it.totalPrice)}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700 text-xs truncate">
                        {getWarehouseName(it.warehouseId || inv.warehouseId)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td colSpan={4} className="py-2 px-3 text-left border-l border-slate-300">
                    مجموع تناژ و کیسه:
                  </td>
                  <td className="py-2 px-3 text-center border-l border-slate-300 font-mono text-slate-950 font-black">
                    {formatNumber(totalTons)} تن / {formatNumber(totalBags)} کیسه
                  </td>
                  <td className="py-2 px-3 text-center border-l border-slate-300 text-slate-600 text-xs">
                    جمع اولیه اقلام:
                  </td>
                  <td className="py-2 px-3 text-left border-l border-slate-300 font-mono font-black text-sm">
                    {formatNumber(subtotalVal)}
                  </td>
                  <td className="py-2 px-3 text-center text-slate-500 text-xs">{inv.currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Financial Summary Breakdown & Notes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Left: Official Notes & Terms */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-300 text-xs">
              <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-blue-700" />
                <span>شرایط و ملاحظات رسمی فاکتور:</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {inv.notes ||
                  'اجناس فوق به صورت صحیح و سالم تحویل خریدار گردید. ادعای هرگونه نقص بعد از امضای فاکتور پذیرفته نمی‌شود.'}
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                <span>محل بارگیری: <strong>{getWarehouseName(inv.warehouseId)}</strong></span>
                <span>آدرس تحویل: <strong>{partyAddress}</strong></span>
              </div>
            </div>

            {/* Right: Comprehensive Financial Settlement Card */}
            <div className="p-3 bg-white rounded-xl border-2 border-slate-900 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-600 pb-1 border-b border-slate-200">
                <span>جمع کل اقلام (Subtotal):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(subtotalVal, inv.currency)}</span>
              </div>

              {discountVal > 0 && (
                <div className="flex items-center justify-between text-rose-700 pb-1 border-b border-slate-200">
                  <span className="font-bold">تخفیف ویژه همکاری:</span>
                  <span className="font-mono font-black">- {formatCurrency(discountVal, inv.currency)}</span>
                </div>
              )}

              {shippingVal > 0 && (
                <div className="flex items-center justify-between text-amber-800 pb-1 border-b border-slate-200">
                  <span className="font-bold">کرایه حمل بار (انتقال):</span>
                  <span className="font-mono font-bold">+ {formatCurrency(shippingVal, inv.currency)}</span>
                </div>
              )}

              {extraExpVal > 0 && (
                <div className="flex items-center justify-between text-slate-700 pb-1 border-b border-slate-200">
                  <span>هزینه‌های جانبی:</span>
                  <span className="font-mono font-bold">+ {formatCurrency(extraExpVal, inv.currency)}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-1.5 px-2 bg-slate-900 text-white rounded-lg font-black text-sm">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <span className="font-mono text-base">{formatCurrency(inv.totalAmount, inv.currency)}</span>
              </div>

              <div className="pt-1 flex items-center justify-between text-slate-700 text-xs">
                <span>پرداخت نقدی اولیه:</span>
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(inv.paidAmount || 0, inv.currency)}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                <span className="font-bold">مانده قابل تصفیه این فاکتور:</span>
                <span className="font-mono font-black text-rose-700">{formatCurrency(remainingBalance, inv.currency)}</span>
              </div>

              <div className="pt-1 text-[11px] font-bold text-blue-950 border-t border-dashed border-slate-300">
                <span className="text-slate-500">مبلغ به حروف: </span>{totalAmountInWords}
              </div>

              {showCustomerBalance && partyInfo && (
                <div className="mt-2 pt-2 border-t-2 border-dashed border-slate-300 bg-slate-50 p-2 rounded-lg text-[11px] space-y-1">
                  <div className="font-black text-slate-800 flex items-center justify-between">
                    <span>وضعیت الباقی کلی حساب مشتری ({inv.partyName}):</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono">
                    <div className="flex justify-between border-l border-slate-300 pl-2">
                      <span>مانده افغانی:</span>
                      <strong className={partyInfo.balanceAFN > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        {formatNumber(partyInfo.balanceAFN || 0)} AFN
                      </strong>
                    </div>
                    <div className="flex justify-between pr-2">
                      <span>مانده دلاری:</span>
                      <strong className={partyInfo.balanceUSD > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        ${formatNumber(partyInfo.balanceUSD || 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          {showSignatures && (
            <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
              <div className="relative flex flex-col justify-between min-h-[65px]">
                <span className="font-black text-slate-800 block text-[11px]">امضای صادرکننده فاکتور</span>
                <div className="h-10 flex items-center justify-center">
                  {showSignature && renderDigitalSignature(signatureSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[10px]">
                  مدیریت فروش و حسابداری
                </div>
              </div>

              <div className="relative flex flex-col justify-between min-h-[65px]">
                <span className="font-black text-slate-800 block text-[11px]">مهر رسمی شرکت</span>
                <div className="h-10 flex items-center justify-center">
                  {showStamp && renderDigitalStamp(stampSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[10px]">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </div>
              </div>

              <div className="relative flex flex-col justify-between min-h-[65px]">
                <span className="font-black text-slate-800 block text-[11px]">امضا و اثر انگشت خریدار</span>
                <div className="h-10 flex items-center justify-center">
                  <span className="text-[10px] text-slate-300 select-none">(محل امضا یا اثر انگشت خریدار)</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[10px]">
                  {inv.partyName || 'طرف حساب محترم'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // THERMAL RECEIPT LAYOUT (رول حرارتی)
  // =========================================================================
  const renderThermalReceipt = () => {
    return (
      <div className="w-full max-w-[340px] mx-auto bg-white p-3 font-mono text-[10px] leading-tight space-y-2 border border-slate-400 rounded-lg text-slate-900 printable-content" dir="rtl">
        <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5 font-sans">
          <h2 className="font-black text-xs">{companySettings.name || 'شرکت برادران نبوی'}</h2>
          <p className="text-[9px] text-slate-600">{companySettings.tagline || 'عرضه عمده مصالح ساختمانی'}</p>
          <div className="text-[9px] font-mono mt-0.5">{companySettings.phone}</div>
        </div>

        <div className="space-y-0.5 border-b border-dashed border-slate-400 pb-1.5 text-[9.5px]">
          <div className="flex justify-between"><span>شماره فاکتور:</span><strong>#{inv.invoiceNumber}</strong></div>
          <div className="flex justify-between"><span>تاریخ:</span><span>{inv.date} ({issueTime})</span></div>
          <div className="flex justify-between"><span>مشتری:</span><strong>{inv.partyName || 'نقدی'}</strong></div>
          {inv.driverName && <div className="flex justify-between"><span>موتروان:</span><span>{inv.driverName}</span></div>}
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
          از خرید شما متشکریم
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER BASED ON LAYOUT OPTION
  // =========================================================================

  // OPTION: THERMAL RECEIPT
  if (invoiceLayout === 'thermal') {
    return renderThermalReceipt();
  }

  // OPTION: FULL-PAGE INVOICE
  if (invoiceLayout === 'invoice_full') {
    return renderFullPageInvoice();
  }

  // OPTION: INVOICE ONLY (تنها فاکتور - دو سوم صفحه A4)
  if (invoiceLayout === 'invoice_only') {
    return (
      <div className="relative z-10 w-full box-border printable-content" dir="rtl">
        {renderTwoThirdsInvoice()}
      </div>
    );
  }

  // OPTION: WAREHOUSE EXIT SLIP ONLY (تنها فرم خروجی انبار - یک سوم صفحه A4)
  if (invoiceLayout === 'warehouse_only') {
    return (
      <div className="relative z-10 w-full box-border printable-content" dir="rtl">
        {renderOneThirdWarehouseSlip()}
      </div>
    );
  }

  // DEFAULT OPTION: COMBO A4 (فاکتور ۲/۳ صفحه + خط‌چین برش + فرم خروجی انبار ۱/۳ صفحه = کاغذ کامل A4)
  return (
    <div className="relative z-10 space-y-1 text-[9.5px] leading-tight w-full box-border printable-content a4-combo-container" dir="rtl">
      {/* SECTION 1: INVOICE (دو سوم صفحه A4) */}
      {renderTwoThirdsInvoice()}

      {/* SECTION 2: PERFORATED CUT LINE */}
      <div className="relative my-0.5 py-0.5 flex items-center justify-center select-none">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t-2 border-dashed border-slate-400" />
        </div>
        <div className="relative bg-white px-2.5 flex items-center gap-1.5 text-slate-700 text-[8px] font-bold border border-slate-300 rounded-full shadow-2xs">
          <Scissors className="w-2.5 h-2.5 text-slate-600 -rotate-90" />
          <span>محل برش با قیچی • فرم خروجی انبار (مخصوص انباردار و بارگیری)</span>
        </div>
      </div>

      {/* SECTION 3: WAREHOUSE EXIT SLIP (یک سوم صفحه A4) */}
      {renderOneThirdWarehouseSlip()}
    </div>
  );
};

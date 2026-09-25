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
  // 2/3 PAGE INVOICE (فاکتور رسمی - دو سوم صفحه A4 دقیقاً مطابق برگه نمونه)
  // =========================================================================
  const renderTwoThirdsInvoice = () => {
    const targetRowCount = Math.max(5, items.length);
    const invoiceRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < targetRowCount; i++) {
      invoiceRows.push(items[i] || null);
    }

    return (
      <div className="invoice-print-frame two-thirds-a4-box border-1.5 border-slate-900 rounded-xl p-2.5 sm:p-3 bg-white box-border w-full shadow-2xs space-y-1.5 text-[9px] leading-tight" dir="rtl">
        {/* Top Header Row matching Reference Layout */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
          {/* Right: Meta Information */}
          <div className="text-right text-[8.5px] text-slate-700 space-y-0.5 min-w-[130px]">
            <div>
              <span>شماره فاکتور: </span>
              <strong className="text-slate-900 font-mono font-black text-xs">#{inv.invoiceNumber}</strong>
            </div>
            <div>
              <span>تاریخ ثبت: </span>
              <strong className="text-slate-900 font-mono font-bold">{inv.date}</strong>
            </div>
            <div>
              <span>ساعت ثبت: </span>
              <strong className="text-slate-900 font-mono">{issueTime}</strong>
            </div>
            <div>
              <span>نوع پرداخت: </span>
              <strong className="text-slate-900 font-bold">{inv.dealTypeLabel || inv.dealType || 'قرضی (اعتباری)'}</strong>
            </div>
          </div>

          {/* Center: Company Name & Official Invoice Badge */}
          <div className="text-center flex flex-col items-center justify-center flex-1 px-2">
            <h1 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
              {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}
            </h1>
            <div className="mt-1">
              <span className="inline-block bg-sky-100 text-sky-800 border border-sky-300 font-black text-[9.5px] px-3.5 py-0.5 rounded-full shadow-2xs">
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

          {/* Left: Circular / Bordered Company Logo */}
          <div className="flex items-center justify-end min-w-[110px]">
            {companySettings.logoUrl ? (
              <img
                src={companySettings.logoUrl}
                alt={companySettings.name}
                className="w-14 h-14 object-contain rounded-xl bg-white border border-slate-300 p-0.5"
              />
            ) : (
              <div className="w-13 h-13 rounded-full border-2 border-slate-900 bg-slate-900 text-white flex items-center justify-center font-black text-base shadow-xs">
                {companySettings.logoIconText || 'هارون'}
              </div>
            )}
          </div>
        </div>

        {/* Two Information Boxes Side-by-Side (صادرکننده & طرف حساب) */}
        <div className="grid grid-cols-2 gap-2 text-[8.5px]">
          {/* Right Card: اطلاعات شرکت (صادرکننده) */}
          <div className="border border-slate-400 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-100 px-2 py-0.5 border-b border-slate-300 flex items-center justify-between font-bold text-slate-800 text-[8px]">
              <span className="flex items-center gap-1">
                <span>🏢</span>
                <span>اطلاعات شرکت (صادرکننده)</span>
              </span>
              <span className="font-mono text-slate-500">کد تجاری: 1</span>
            </div>
            <div className="p-1.5 space-y-0.5 text-slate-700 leading-tight">
              <div>
                <span className="text-slate-500">نام واحد تجاری: </span>
                <strong className="text-slate-900 font-bold">{companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}</strong>
              </div>
              <div className="font-mono">
                <span className="text-slate-500 font-sans">شماره تماس: </span>
                <span className="text-slate-900 font-bold">{companySettings.phone || '0794511271'}</span>
                {companySettings.phoneSecondary && <span> - {companySettings.phoneSecondary}</span>}
              </div>
              <div className="truncate">
                <span className="text-slate-500">آدرس شرکت: </span>
                <span>{companySettings.address || 'هرات ، سرک 64 متره - نقطه هفت'}</span>
              </div>
            </div>
          </div>

          {/* Left Card: اطلاعات طرف حساب (مشتری) */}
          <div className="border border-slate-400 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-100 px-2 py-0.5 border-b border-slate-300 flex items-center justify-between font-bold text-slate-800 text-[8px]">
              <span className="flex items-center gap-1">
                <span>👤</span>
                <span>اطلاعات طرف حساب (مشتری)</span>
              </span>
              <span className="font-mono text-slate-500">کد حساب: {partyInfo?.code || partyInfo?.numericCode || '139'}</span>
            </div>
            <div className="p-1.5 space-y-0.5 text-slate-700 leading-tight">
              <div className="truncate">
                <span className="text-slate-500">مشتری محترم: </span>
                <strong className="text-slate-900 font-black text-[9.5px]">{inv.partyName || 'شرکت جهان نیرو'}</strong>
              </div>
              <div className="font-mono">
                <span className="text-slate-500 font-sans">شماره تماس: </span>
                <span className="text-slate-900 font-bold">{partyPhone}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">آدرس مشتری: </span>
                <span>{partyAddress || 'تحویل درب انبار'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table of Items (5 rows matching reference image) */}
        <div className="border border-slate-900 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-right border-collapse text-[8.5px] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[34%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-900 text-white font-bold h-6 border-b border-slate-900">
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">#</th>
                <th className="py-0.5 px-1.5 border-l border-slate-700 text-right">شرح کالا یا خدمات</th>
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">تعداد</th>
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">واحد</th>
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">قیمت ({inv.currency})</th>
                <th className="py-0.5 px-1 border-l border-slate-700 text-left">جمع کل ({inv.currency})</th>
                <th className="py-0.5 px-1 text-center">توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((it, idx) => {
                if (!it) {
                  return (
                    <tr key={`inv-empty-${idx}`} className="border-b border-slate-200 h-5">
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
                const unitDisplay = it.unit
                  ? it.unit === 'bag'
                    ? 'کیسه (37Kg)'
                    : it.unit === 'ton'
                    ? 'تُن'
                    : it.unit
                  : 'کیسه (37Kg)';

                return (
                  <tr key={`inv-it-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold h-5.5">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-600">{idx + 1}</td>
                    <td className="py-0.5 px-1.5 border-l border-slate-200 text-slate-900 font-bold truncate" title={it.productName}>
                      {it.productName}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                      {formatNumber(it.quantity)}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-700 text-[8px]">
                      {unitDisplay}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-700">
                      {formatNumber(it.unitPrice)}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-left font-mono font-black text-slate-950">
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

        {/* Bottom Section: Terms on Right & Financial Card on Left */}
        <div className="grid grid-cols-2 gap-2 text-[8.5px]">
          {/* Right Column: قوانین و شرایط عمومی معامله */}
          <div className="border border-slate-400 rounded-lg p-2 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-900 text-[8.5px] mb-1 flex items-center gap-1">
                <span>قوانین و شرایط عمومی معامله:</span>
              </div>
              <ul className="text-slate-600 text-[7.5px] leading-tight space-y-0.5 list-none">
                <li>• لطفا در مورد جنس اطمینان خود را حاصل نموده ، شکایت بعدی قابل قبول نمیباشد.</li>
                <li>• فاکتور هذا بدون مهر و امضاء اعتبار ندارد.</li>
                <li>• اجناس فروخته شده برای تمام مشترکین موسسات و شرکت ها بدون مالیه میباشد.</li>
                <li>• جنس فروخته شده واپس گرفته نمیشود.</li>
              </ul>
            </div>
            <div className="pt-1 border-t border-slate-200 mt-1 flex items-center justify-between text-[7.5px] text-slate-500 font-mono">
              <span>محل بارگیری: {getWarehouseName(inv.warehouseId)}</span>
              <span>سند معامله رسمی</span>
            </div>
          </div>

          {/* Left Column: Financial Breakdown Table */}
          <div className="border border-slate-900 rounded-lg overflow-hidden bg-white text-[8px]">
            <table className="w-full text-right border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-0.5 px-2 text-slate-600">جمع کل مبلغ:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-bold text-slate-900">
                    {inv.currency} {formatNumber(subtotalVal)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-0.5 px-2 text-slate-600">هزینه کرایه حمل:</td>
                  <td className="py-0.5 px-2 text-left font-mono text-slate-800">
                    {inv.currency} {formatNumber(shippingVal)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-0.5 px-2 text-slate-600">تخفیف کلی فاکتور:</td>
                  <td className="py-0.5 px-2 text-left font-mono text-rose-600 font-bold">
                    {inv.currency} {formatNumber(discountVal)} -
                  </td>
                </tr>
                <tr className="border-b border-slate-300 bg-sky-50/50">
                  <td className="py-0.5 px-2 font-black text-sky-900 text-[8.5px]">مبلغ نهایی معامله:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-black text-sky-700 text-[9.5px]">
                    {inv.currency} {formatNumber(inv.totalAmount)}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-0.5 px-2 text-slate-600">مبلغ پرداخت‌شده:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-bold text-emerald-700">
                    {inv.currency} {formatNumber(inv.paidAmount || 0)}
                  </td>
                </tr>
                <tr className="bg-rose-50/40">
                  <td className="py-0.5 px-2 font-black text-rose-900 text-[8.5px]">مبلغ باقی‌مانده بدهی:</td>
                  <td className="py-0.5 px-2 text-left font-mono font-black text-rose-700 text-[9.5px]">
                    {inv.currency} {formatNumber(remainingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures & Stamp Row (3 Columns) */}
        {showSignatures && (
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-300 text-center text-[7.5px]">
            <div className="flex flex-col justify-between min-h-[36px]">
              <span className="text-slate-600 font-bold">امضاء و مهر تحویل‌دهنده</span>
              <div className="h-4 flex items-center justify-center">
                {showSignature && renderDigitalSignature(signatureSize ? Math.min(signatureSize, 28) : 26)}
              </div>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-500 font-mono text-[7px]">
                ....................................................
              </div>
            </div>

            <div className="flex flex-col justify-between min-h-[36px]">
              <span className="text-slate-600 font-bold">امضاء و مهر مسئول مالی</span>
              <div className="h-4 flex items-center justify-center">
                {showStamp && renderDigitalStamp(stampSize ? Math.min(stampSize, 34) : 28)}
              </div>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-500 font-mono text-[7px]">
                ....................................................
              </div>
            </div>

            <div className="flex flex-col justify-between min-h-[36px]">
              <span className="text-slate-600 font-bold">امضاء و تایید خریدار</span>
              <div className="h-4 flex items-center justify-center text-[6.5px] text-slate-300 select-none">
                (محل امضا یا اثر انگشت)
              </div>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-500 font-mono text-[7px]">
                ....................................................
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 1/3 PAGE WAREHOUSE EXIT SLIP (فرم خروجی انبار - نسخه گدام‌دار)
  // =========================================================================
  const renderOneThirdWarehouseSlip = () => {
    const whTargetRowCount = Math.max(5, items.length);
    const whRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < whTargetRowCount; i++) {
      whRows.push(items[i] || null);
    }

    return (
      <div className="warehouse-exit-slip-frame one-third-a4-box border-1.5 border-slate-900 rounded-lg p-2 bg-white box-border w-full shadow-2xs space-y-1 text-[8.5px] leading-tight" dir="rtl">
        {/* Warehouse Header Line */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[8px]">
          <div className="flex items-center gap-1.5 font-black text-slate-950 text-[9.5px]">
            <span>🏢</span>
            <span>برگه حواله خروج کالا از گدام (نسخه گدام‌دار)</span>
          </div>

          <div className="flex items-center gap-3 text-slate-700">
            <div>
              <span>شماره فاکتور مرجع: </span>
              <strong className="text-slate-900 font-mono font-bold">#{inv.invoiceNumber}</strong>
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
              <strong className="text-slate-900 font-black">{inv.partyName || 'شرکت جهان نیرو'}</strong>
            </div>
          </div>
        </div>

        {/* Warehouse Items Table (5 columns matching reference image) */}
        <div className="border border-slate-900 rounded overflow-hidden bg-white">
          <table className="w-full text-right border-collapse text-[8px] table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[42%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-900 text-white font-bold h-5 border-b border-slate-900">
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">#</th>
                <th className="py-0.5 px-1.5 border-l border-slate-700 text-right">نام و شرح کالای تحویلی</th>
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">تعداد / مقدار</th>
                <th className="py-0.5 px-1 border-l border-slate-700 text-center">واحد سنجش</th>
                <th className="py-0.5 px-1 text-center">توضیحات</th>
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
                  <tr key={`wh-it-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold h-5">
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono text-slate-600">{idx + 1}</td>
                    <td className="py-0.5 px-1.5 border-l border-slate-200 text-slate-900 font-bold truncate" title={it.productName}>
                      {it.productName}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                      {formatNumber(it.quantity)}
                    </td>
                    <td className="py-0.5 px-1 border-l border-slate-200 text-center text-slate-700 text-[7.5px]">
                      {unitDisplay}
                    </td>
                    <td className="py-0.5 px-1 text-center text-slate-500 text-[7.5px] truncate">
                      {it.description || `انبار: ${getWarehouseName(it.warehouseId || inv.warehouseId)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Warehouse Signatures (2 Columns matching reference) */}
        {showSignatures && (
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-300 text-center text-[7.5px]">
            <div className="flex flex-col justify-between min-h-[30px]">
              <span className="text-slate-600 font-bold">امضاء و مهر مسئول گدام (تایید تحویل کالا)</span>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px] mt-2">
                ......................................................................................
              </div>
            </div>

            <div className="flex flex-col justify-between min-h-[30px]">
              <span className="text-slate-600 font-bold">امضاء و تایید خریدار / راننده (تایید دریافت کالا)</span>
              <div className="border-t border-dotted border-slate-400 pt-0.5 text-slate-400 font-mono text-[7px] mt-2">
                ......................................................................................
              </div>
            </div>
          </div>
        )}

        {/* Warehouse Footer Information */}
        <div className="flex items-center justify-between text-[7px] text-slate-500 pt-0.5 border-t border-slate-200">
          <div>نسخه گدام‌دار - هرات، افغانستان</div>
          <div>سیستم مالی یکپارچه {companySettings.name || 'شرکت تجارتی اسحاق هارون واسعی'}</div>
          <div>
            سند معامله رسمی صادر شده توسط سیستم مالی شرکت • {companySettings.address || 'هرات ، سرک 64 متره'}
            {companySettings.phone && ` • تلفن: ${companySettings.phone}`}
          </div>
        </div>
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
    <div className="relative z-10 space-y-1 print:space-y-0 text-[9.5px] leading-tight w-full box-border printable-content a4-combo-container print:m-0 print:p-0" dir="rtl">
      {/* SECTION 1: INVOICE (دو سوم صفحه A4) */}
      {renderTwoThirdsInvoice()}

      {/* SECTION 2: PERFORATED CUT LINE */}
      <div className="relative my-0.5 py-0.5 print:my-0 print:py-0.5 flex items-center justify-center select-none shrink-0">
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

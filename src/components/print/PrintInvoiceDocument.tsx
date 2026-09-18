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
  invoiceLayout: 'combo_a4' | 'invoice_only' | 'warehouse_only' | 'thermal';
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
    ? 'bg-amber-100 text-amber-950 border-2 border-amber-500 font-black shadow-2xs'
    : isSale
    ? 'bg-rose-100 text-rose-950 border border-rose-300'
    : 'bg-blue-100 text-blue-950 border border-blue-300';
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
            maxHeight: '65px',
            maxWidth: `${Math.round(size * 2.8)}px`,
          }}
          className="object-contain select-none z-10 filter contrast-125 pointer-events-none"
        />
      );
    }
    return (
      <div className="transform -rotate-6 scale-90">
        <svg width="120" height="42" viewBox="0 0 160 60" className="text-blue-900 stroke-current fill-none">
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
  // OPTION 1: DEDICATED FULL-PAGE WAREHOUSE EXIT SLIP (حواله اختصاصی انبارداری)
  // =========================================================================
  if (invoiceLayout === 'warehouse_only') {
    const whRowCount = Math.max(6, items.length);
    const whDisplayRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < whRowCount; i++) {
      whDisplayRows.push(items[i] || null);
    }

    return (
      <div className="relative z-10 font-sans text-slate-900 space-y-3 w-full box-border printable-content" dir="rtl">
        <div className="warehouse-exit-slip-frame border-2 border-slate-900 rounded-2xl p-4 sm:p-5 bg-white space-y-3.5 box-border w-full shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-3">
              {companySettings.logoUrl ? (
                <img
                  src={companySettings.logoUrl}
                  alt={companySettings.name}
                  className="w-14 h-14 object-contain rounded-xl bg-white border border-slate-300 p-1"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                  {companySettings.logoIconText || 'انبار'}
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </h1>
                <p className="text-xs text-amber-900 font-bold mt-0.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-700" />
                  <span>مدیریت گدام‌ها و خزانه‌داری کالا • برگه رسمی خروج و حواله بارگیری</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-600 mt-1 font-mono">
                  <span>تلفن گدام و هماهنگی: {companySettings.phone || '---'}</span>
                  {companySettings.address && <span>• آدرس: {companySettings.address}</span>}
                </div>
              </div>
            </div>

            <div className="text-left font-mono shrink-0 flex flex-col items-end">
              <span className="text-xs font-black px-3 py-1 rounded-xl bg-slate-900 text-white shadow-xs">
                {isReturn ? 'رسید رسمی ورود کالا به گدام' : 'حواله رسمی خروج کالا از گدام'}
              </span>
              <div className="text-sm font-black text-slate-900 mt-1.5">
                شماره حواله: <span className="text-blue-700">#{inv.invoiceNumber}</span>
              </div>
              <div className="text-xs text-slate-600 font-sans mt-0.5 flex items-center gap-2">
                <span>تاریخ: <strong className="font-mono text-slate-900">{inv.date}</strong></span>
                <span>ساعت: <strong className="font-mono text-slate-900">{issueTime}</strong></span>
              </div>
              <div className="mt-1">
                {isFullySettled ? (
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                    فاکتور تسویه مالی شده
                  </span>
                ) : (
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                    خروج بار با تایید حسابداری
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Warehouse Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs">
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">تحویل‌گیرنده / مشتری:</span>
              <strong className="text-slate-900 font-black text-sm">{inv.partyName || 'مشتری متفرقه'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">شماره تماس تحویل‌گیرنده:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{partyPhone}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">گدام مبدا بارگیری:</span>
              <strong className="text-blue-900 font-black text-xs">{getWarehouseName(inv.warehouseId)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10.5px] font-bold mb-0.5">نوع سند / معامله:</span>
              <span className="font-bold text-slate-800 text-xs">
                {isReturn ? 'برگشتی به انبار' : inv.dealTypeLabel || inv.dealType || 'فروش قطعی'}
              </span>
            </div>
          </div>

          {/* Logistics & Driver Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-300 text-xs">
            <div>
              <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">نام راننده / موتروان:</span>
              <strong className="text-slate-900 font-black text-xs">{inv.driverName || 'تحویل حضوری مشتری'}</strong>
            </div>
            <div>
              <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">شماره پلاک موتر:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{inv.carPlate || '---'}</span>
            </div>
            <div>
              <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">شماره تماس راننده:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">{inv.driverPhone || '---'}</span>
            </div>
            <div>
              <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">محل و آدرس تخلیه بار:</span>
              <span className="text-slate-800 font-medium text-xs truncate" title={partyAddress}>{partyAddress}</span>
            </div>
          </div>

          {/* Warehouse Items Table */}
          <div className="border border-slate-900 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs font-black">
              <span>اقلام مجاز جهت بارگیری و خروج از گدام (بدون درج مبالغ مالی)</span>
              <span>تعداد ردیف: {items.length}</span>
            </div>
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-black border-b border-slate-300">
                  <th className="py-2 px-2.5 border-l border-slate-300 text-center w-10">#</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-right">نام و شرح دقیق کالا / جنس</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center w-28">مقدار تحویلی</th>
                  <th className="py-2 px-2.5 border-l border-slate-300 text-center w-20">واحد سنجش</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center w-28">معادل تناژ (تن)</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center w-28">معادل خریطه (کیسه)</th>
                  <th className="py-2 px-3 border-l border-slate-300 text-center w-36">گدام تحویل</th>
                  <th className="py-2 px-3 text-right">توضیحات و مشخصات بسته</th>
                </tr>
              </thead>
              <tbody>
                {whDisplayRows.map((it, idx) => {
                  if (!it) {
                    return (
                      <tr key={`wh-empty-${idx}`} className="border-b border-slate-200 h-8">
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
                    <tr key={`wh-item-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold">
                      <td className="py-2 px-2.5 border-l border-slate-200 text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-slate-900 font-black">{it.productName}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono font-black text-slate-900 text-sm">
                        {formatNumber(it.quantity)}
                      </td>
                      <td className="py-2 px-2.5 border-l border-slate-200 text-center text-slate-700 text-xs">{it.unit || 'عدد'}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono font-bold text-blue-900 text-xs">
                        {it.tonsCount ? `${formatNumber(it.tonsCount)} تن` : '---'}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono font-bold text-blue-900 text-xs">
                        {it.bagsCount ? `${formatNumber(it.bagsCount)} کیسه` : '---'}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center text-slate-800 text-xs">
                        {getWarehouseName(it.warehouseId || inv.warehouseId)}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-xs">{it.description || 'بارگیری طبق مشخصات استاندارد'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                  <td colSpan={4} className="py-2 px-3 text-left border-l border-slate-300 font-black">
                    مجموع کل تناژ و بسته‌های تحویلی از گدام:
                  </td>
                  <td className="py-2 px-3 text-center border-l border-slate-300 font-mono text-blue-950 font-black text-sm">
                    {formatNumber(totalTons)} تن
                  </td>
                  <td className="py-2 px-3 text-center border-l border-slate-300 font-mono text-blue-950 font-black text-sm">
                    {formatNumber(totalBags)} کیسه
                  </td>
                  <td colSpan={2} className="py-2 px-3 text-slate-600 text-[11px]">
                    اقلام فوق کامل و بدون کسری بارگیری گردید.
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Warehouse Release Conditions Note */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-300 text-[11px] text-slate-700 leading-relaxed">
            <strong>شرایط تحویل و خروج کالا از گدام:</strong> کالای فوق با مشخصات مندرج در جدول به صورت کاملاً سالم، بدون کسری یا صدمه، تحویل متصدی حمل بار / خریدار گردید. با خروج بار از درب محوطه گدام شرکت، مسئولیت حفظ سلامت، باربری و تخلیه به عهده تحویل‌گیرنده و متصدی حمل خواهد بود.
          </div>

          {/* 4 Official Warehouse Signatures */}
          {showSignatures && (
            <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-4 gap-3 text-center text-xs">
              <div className="space-y-8">
                <span className="font-black text-slate-800 block text-[11px]">امضای انباردار (تحویل‌دهنده)</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <span className="text-[10px] text-slate-500 block font-mono">مسئول گدام</span>
              </div>
              <div className="space-y-8">
                <span className="font-black text-slate-800 block text-[11px]">امضای راننده / موتروان</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <span className="text-[10px] text-slate-500 block font-mono">{inv.driverName || 'متصدی حمل'}</span>
              </div>
              <div className="space-y-8">
                <span className="font-black text-slate-800 block text-[11px]">امضا و اثر انگشت خریدار</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto"></div>
                <span className="text-[10px] text-slate-500 block font-mono">{inv.partyName || 'تحویل‌گیرنده'}</span>
              </div>
              <div className="relative flex flex-col justify-between">
                <span className="font-black text-slate-800 block text-[11px]">تأیید و مهر رسمی شرکت</span>
                <div className="h-16 flex items-center justify-center">
                  {showStamp && renderDigitalStamp(stampSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[10px]">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // OPTION 2: DEDICATED FULL-PAGE INVOICE (فقط فاکتور رسمی تمام‌صفحه)
  // =========================================================================
  if (invoiceLayout === 'invoice_only') {
    const fullRowCount = Math.max(7, items.length);
    const fullDisplayRows: (InvoiceItem | null)[] = [];
    for (let i = 0; i < fullRowCount; i++) {
      fullDisplayRows.push(items[i] || null);
    }

    return (
      <div className="relative z-10 font-sans text-slate-900 space-y-3 w-full box-border printable-content" dir="rtl">
        <div className="invoice-print-frame border-2 border-slate-900 rounded-2xl p-4 sm:p-5 bg-white space-y-3.5 box-border w-full shadow-xs">
          {/* Official Header */}
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
                <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">راننده / موتروان:</span>
                <span className="font-black text-slate-900">{inv.driverName || '---'}</span>
              </div>
              <div>
                <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">شماره پلاک موتر:</span>
                <span className="font-mono font-bold text-slate-900">{inv.carPlate || '---'}</span>
              </div>
              <div>
                <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">شماره تماس راننده:</span>
                <span className="font-mono font-bold text-slate-900">{inv.driverPhone || '---'}</span>
              </div>
              <div>
                <span className="text-amber-900 block text-[10.5px] font-bold mb-0.5">کرایه حمل بار:</span>
                <span className="font-mono font-black text-amber-900">
                  {inv.shippingCost ? formatCurrency(inv.shippingCost, inv.currency) : 'توافقی / تحویل حضوری'}
                </span>
              </div>
            </div>
          )}

          {/* Full Invoice Items Table */}
          <div className="border border-slate-900 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-black">
                  <th className="py-2 px-2.5 border-l border-slate-800 text-center w-10">#</th>
                  <th className="py-2 px-3 border-l border-slate-800 text-right">نام کالا و مشخصات فنی</th>
                  <th className="py-2 px-3 border-l border-slate-800 text-center w-24">مقدار</th>
                  <th className="py-2 px-2.5 border-l border-slate-800 text-center w-20">واحد</th>
                  <th className="py-2 px-3 border-l border-slate-800 text-center w-28">معادل تناژ و کیسه</th>
                  <th className="py-2 px-3 border-l border-slate-800 text-center w-28">قیمت فی ({inv.currency})</th>
                  <th className="py-2 px-3 border-l border-slate-800 text-left w-32">مجموع قیمت ({inv.currency})</th>
                  <th className="py-2 px-3 text-center w-28">گدام مبدا</th>
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
                      <td className="py-2 px-3 border-l border-slate-200 text-slate-900 font-black">{it.productName}</td>
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
                      <td className="py-2 px-3 text-center text-slate-700 text-xs">
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

              {/* Grand Total Amount */}
              <div className="flex items-center justify-between py-1.5 px-2 bg-slate-900 text-white rounded-lg font-black text-sm">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <span className="font-mono text-base">{formatCurrency(inv.totalAmount, inv.currency)}</span>
              </div>

              {/* Amount in Words */}
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 text-[11px] font-bold leading-normal">
                <span>مبلغ کل به حروف: </span>
                <strong className="text-blue-900">{totalAmountInWords}</strong>
              </div>

              {/* Paid Amount & Invoice Balance */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block">پرداخت نقدی / تسویه:</span>
                  <span className="font-mono font-black text-emerald-950 text-xs">
                    {formatCurrency(inv.paidAmount || 0, inv.currency)}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">باقیمانده فاکتور:</span>
                  <span className="font-mono font-black text-rose-950 text-xs">
                    {formatCurrency(remainingBalance, inv.currency)}
                  </span>
                </div>
              </div>

              {/* Customer Overall Balance (if toggled) */}
              {showCustomerBalance && partyInfo && (
                <div className="pt-1.5 border-t border-dashed border-slate-300 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 font-bold">الباقی کل حساب مشتری در سیستم:</span>
                  <span className={`font-mono font-black ${partyInfo.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatCurrency(Math.abs(partyInfo.balance), inv.currency)}
                    <span className="text-[10px] font-sans font-bold mr-1">
                      {partyInfo.balance > 0 ? '(بدهکار به ما)' : partyInfo.balance < 0 ? '(بستانکار)' : '(تسویه)'}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Settlement Announcement Banner */}
          {isFullySettled && (
            <div className="p-2 rounded-xl bg-emerald-500 text-white font-black text-center text-xs flex items-center justify-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>این فاکتور کاملاً تسویه و مبالغ آن به صورت قطعی کارسازی گردیده است.</span>
            </div>
          )}

          {/* 3 Official Signatures */}
          {showSignatures && (
            <div className="pt-3 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs">
              <div className="relative flex flex-col justify-between">
                <span className="font-black text-slate-800 block text-xs">امضای صادرکننده فاکتور</span>
                <div className="h-16 flex items-center justify-center">
                  {showSignature && renderDigitalSignature(signatureSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[11px]">
                  مدیریت فروش و حسابداری
                </div>
              </div>

              <div className="relative flex flex-col justify-between">
                <span className="font-black text-slate-800 block text-xs">مهر رسمی شرکت</span>
                <div className="h-16 flex items-center justify-center">
                  {showStamp && renderDigitalStamp(stampSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[11px]">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </div>
              </div>

              <div className="relative flex flex-col justify-between">
                <span className="font-black text-slate-800 block text-xs">امضا و اثر انگشت خریدار</span>
                <div className="h-16 flex items-center justify-center">
                  <span className="text-[10px] text-slate-300 select-none">(محل امضا و اثر انگشت)</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-1 text-slate-800 font-black text-[11px]">
                  {inv.partyName || 'طرف حساب محترم'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // OPTION 3: COMBO A4 (فاکتور ۲/۳ بالا + خط‌چین برش + حواله انبار ۱/۳ پایین)
  // =========================================================================
  const comboRowCount = Math.max(5, items.length);
  const displayRows: (InvoiceItem | null)[] = [];
  for (let i = 0; i < comboRowCount; i++) {
    displayRows.push(items[i] || null);
  }

  return (
    <div className="relative z-10 space-y-2.5 print:space-y-2 text-[11px] leading-tight w-full box-border printable-content" dir="rtl">
      {/* ---------------- SECTION 1: TOP 2/3 OFFICIAL INVOICE ---------------- */}
      {(invoiceLayout === 'combo_a4' || invoiceLayout === 'thermal') && (
        <div className="invoice-print-frame border-2 border-slate-900 rounded-xl p-2.5 sm:p-3 bg-white space-y-2 box-border w-full shadow-2xs">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2.5">
              {companySettings.logoUrl ? (
                <img
                  src={companySettings.logoUrl}
                  alt={companySettings.name}
                  className="w-11 h-11 object-contain rounded-lg bg-white border border-slate-300 p-0.5"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-xs">
                  {companySettings.logoIconText || 'نبوی'}
                </div>
              )}
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </h1>
                <p className="text-[10px] text-slate-600 font-medium">
                  {companySettings.tagline || 'واردات و عرضه عمده سیمان، گچ و مصالح ساختمانی'}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 text-[9.5px] text-slate-600 mt-0.5">
                  <span className="font-mono flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-slate-500" />
                    <span>{companySettings.phone}</span>
                    {companySettings.phoneSecondary && <span> / {companySettings.phoneSecondary}</span>}
                  </span>
                  {companySettings.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-slate-500" />
                      <span>{companySettings.address}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="text-left font-mono shrink-0 flex flex-col items-end">
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-md ${themeBadge}`}>
                {isReturnSell
                  ? 'فاکتور برگشت از فروش'
                  : isReturnBuy
                  ? 'فاکتور برگشت از خرید'
                  : isSale
                  ? 'فاکتور فروش کالا'
                  : 'فاکتور خرید کالا'}
              </span>
              <div className="text-xs font-black text-slate-900 mt-0.5">
                {isReturn ? 'شماره فاکتور برگشت: ' : 'شماره: '}
                {inv.invoiceNumber}
              </div>
              <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                تاریخ: <strong className="font-mono">{inv.date}</strong> ({issueTime})
              </div>
              {isFullySettled && (
                <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded mt-0.5 border border-emerald-300">
                  تسویه نقدی
                </span>
              )}
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 sm:p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px]">
            <div>
              <span className="text-slate-500 block text-[9px] font-bold">طرف حساب:</span>
              <strong className="text-slate-900 font-bold">{inv.partyName || 'مشتری متفرقه'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] font-bold">تلفن:</span>
              <span className="font-mono font-bold text-slate-800">{partyPhone}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] font-bold">واحد ارزی و معامله:</span>
              <span className="font-bold text-slate-800">
                {currencyName} ({inv.dealTypeLabel || inv.dealType || 'معامله نقدی'})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] font-bold">آدرس تحویل:</span>
              <span className="text-slate-800 truncate block" title={partyAddress}>{partyAddress}</span>
            </div>
          </div>

          {/* Driver / Logistics banner if available */}
          {(inv.driverName || inv.carPlate || inv.shippingCost) && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded-md bg-amber-50/70 border border-amber-200 text-[9.5px]">
              <div className="flex items-center gap-3">
                <span>موتروان: <strong>{inv.driverName || '---'}</strong></span>
                <span>پلاک: <strong className="font-mono">{inv.carPlate || '---'}</strong></span>
                {inv.driverPhone && <span>تماس: <strong className="font-mono">{inv.driverPhone}</strong></span>}
              </div>
              {inv.shippingCost ? (
                <div className="font-mono font-bold text-amber-900">
                  کرایه بار: {formatCurrency(inv.shippingCost, inv.currency)}
                </div>
              ) : null}
            </div>
          )}

          {/* Items Table */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-right border-collapse text-[10px]">
              <thead>
                <tr className={`${themeTableHead} font-bold border-b border-slate-800`}>
                  <th className="py-1 px-1.5 border-l border-slate-300 text-center w-7">#</th>
                  <th className="py-1 px-2 border-l border-slate-300 text-right">نام جنس و کالا</th>
                  <th className="py-1 px-2 border-l border-slate-300 text-center w-16">مقدار</th>
                  <th className="py-1 px-1.5 border-l border-slate-300 text-center w-12">واحد</th>
                  <th className="py-1 px-2 border-l border-slate-300 text-center w-24">معادل (تن/کیسه)</th>
                  <th className="py-1 px-2 border-l border-slate-300 text-center w-20">قیمت فی</th>
                  <th className="py-1 px-2 border-l border-slate-300 text-left w-24">مجموع ({inv.currency})</th>
                  <th className="py-1 px-2 text-center w-24">گدام</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((it, idx) => {
                  if (!it) {
                    return (
                      <tr key={`empty-${idx}`} className="border-b border-slate-200 h-5">
                        <td className="py-0.5 px-1.5 border-l border-slate-200 text-center font-mono text-slate-300">{idx + 1}</td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-1.5 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2"></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`it-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold h-5.5">
                      <td className="py-0.5 px-1.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-slate-900 font-bold">{it.productName}</td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                        {formatNumber(it.quantity)}
                      </td>
                      <td className="py-0.5 px-1.5 border-l border-slate-200 text-center text-slate-600">{it.unit || 'عدد'}</td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono text-slate-600 text-[9.5px]">
                        {it.tonsCount ? `${formatNumber(it.tonsCount)} تن` : ''}
                        {it.tonsCount && it.bagsCount ? ' / ' : ''}
                        {it.bagsCount ? `${formatNumber(it.bagsCount)} کیسه` : (!it.tonsCount ? '---' : '')}
                      </td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono text-slate-700">
                        {formatNumber(it.unitPrice)}
                      </td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-left font-mono font-black text-slate-900">
                        {formatNumber(it.totalPrice)}
                      </td>
                      <td className="py-0.5 px-2 text-center text-slate-600 text-[9.5px]">
                        {getWarehouseName(it.warehouseId || inv.warehouseId)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-800 h-5.5">
                  <td colSpan={4} className="py-0.5 px-2 text-left border-l border-slate-300 font-black">
                    مجموع تناژ و کیسه:
                  </td>
                  <td className="py-0.5 px-2 text-center border-l border-slate-300 font-mono text-slate-900 font-black">
                    {formatNumber(totalTons)} تن / {formatNumber(totalBags)} کیسه
                  </td>
                  <td className="py-0.5 px-2 text-center border-l border-slate-300 text-slate-600">جمع اولیه:</td>
                  <td className="py-0.5 px-2 text-left border-l border-slate-300 font-mono font-black">
                    {formatNumber(subtotalVal)}
                  </td>
                  <td className="py-0.5 px-2 text-center text-slate-500 font-mono">{inv.currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Financial Summary & Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {/* Right: Notes & Origin */}
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 block text-[9px] font-bold">توضیحات فاکتور:</span>
              <p className="text-slate-700 leading-tight">
                {inv.notes || 'کالای فوق با مشخصات مندرج به صورت کاملاً سالم و بدون نقص تحویل خریدار گردید.'}
              </p>
              <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                <span>گدام: <strong>{getWarehouseName(inv.warehouseId)}</strong></span>
                <span>محل تخلیه: <strong>{partyAddress}</strong></span>
              </div>
            </div>

            {/* Left: Financial calculation */}
            <div className="p-1.5 rounded-lg border border-slate-800 bg-white space-y-1">
              {discountVal > 0 && (
                <div className="flex items-center justify-between text-rose-700 font-bold text-[9.5px]">
                  <span>تخفیف همکاری:</span>
                  <span className="font-mono">- {formatCurrency(discountVal, inv.currency)}</span>
                </div>
              )}
              {shippingVal > 0 && (
                <div className="flex items-center justify-between text-amber-800 font-bold text-[9.5px]">
                  <span>کرایه حمل بار:</span>
                  <span className="font-mono">+ {formatCurrency(shippingVal, inv.currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-black text-slate-900 border-b border-slate-200 pb-0.5">
                <span>مبلغ کل فاکتور:</span>
                <span className="font-mono text-xs">{formatCurrency(inv.totalAmount, inv.currency)}</span>
              </div>
              <div className="text-[9px] text-blue-900 bg-blue-50/80 px-1 py-0.5 rounded font-bold leading-tight truncate" title={totalAmountInWords}>
                به حروف: {totalAmountInWords}
              </div>
              <div className="flex items-center justify-between text-slate-600 pt-0.5">
                <span>پرداخت نقدی: <strong className="font-mono text-emerald-700">{formatCurrency(inv.paidAmount || 0, inv.currency)}</strong></span>
                <span>باقیمانده: <strong className="font-mono text-rose-700">{formatCurrency(remainingBalance, inv.currency)}</strong></span>
              </div>
              {showCustomerBalance && partyInfo && (
                <div className="pt-0.5 border-t border-dashed border-slate-300 flex items-center justify-between text-[9px]">
                  <span className="text-slate-500">مانده کل مشتری:</span>
                  <span className={`font-mono font-bold ${partyInfo.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatCurrency(Math.abs(partyInfo.balance), inv.currency)} {partyInfo.balance > 0 ? '(بدهکار)' : '(تسویه)'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Fully Settled Green Banner */}
          {isFullySettled && (
            <div className="p-1 rounded-md bg-emerald-500 text-white font-black text-center text-[10px] flex items-center justify-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3 h-3" />
              <span>این فاکتور کاملاً تسویه و مبالغ آن پرداخت گردیده است.</span>
            </div>
          )}

          {/* Invoice Signatures */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 text-center text-[9.5px]">
              <div className="relative flex flex-col justify-between min-h-[50px]">
                <span className="text-slate-500 block mb-0.5">صادرکننده فاکتور</span>
                <div className="h-7 flex items-center justify-center">
                  {showSignature && renderDigitalSignature(signatureSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold">
                  مدیریت فروش
                </div>
              </div>

              <div className="relative flex flex-col justify-between min-h-[50px]">
                <span className="text-slate-500 block mb-0.5">مهر رسمی شرکت</span>
                <div className="h-7 flex items-center justify-center">
                  {showStamp && renderDigitalStamp(stampSize)}
                </div>
                <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold">
                  {companySettings.name || 'شرکت تجارتی برادران نبوی'}
                </div>
              </div>

              <div className="relative flex flex-col justify-between min-h-[50px]">
                <span className="text-slate-500 block mb-0.5">امضای خریدار / تحویل‌گیرنده</span>
                <div className="h-7 flex items-center justify-center">
                  <span className="text-[8.5px] text-slate-300 select-none">(محل امضا یا اثر انگشت)</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold">
                  {inv.partyName || 'طرف حساب محترم'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- SECTION 2: PERFORATED CUT LINE ---------------- */}
      {invoiceLayout === 'combo_a4' && (
        <div className="relative my-2 py-0.5 flex items-center justify-center select-none">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t-2 border-dashed border-slate-400" />
          </div>
          <div className="relative bg-white px-3 flex items-center gap-1.5 text-slate-500 text-[9.5px] font-bold border border-slate-300 rounded-full shadow-2xs">
            <Scissors className="w-3 h-3 text-slate-600 -rotate-90" />
            <span>محل برش • حواله رسمی خروج کالا از گدام (مخصوص تحویل‌گیرنده و انباردار)</span>
          </div>
        </div>
      )}

      {/* ---------------- SECTION 3: BOTTOM 1/3 WAREHOUSE EXIT SLIP ---------------- */}
      {invoiceLayout === 'combo_a4' && (
        <div className="warehouse-exit-slip-frame border-2 border-slate-900 rounded-xl p-2 bg-slate-50/70 space-y-1.5 box-border w-full mb-1 shadow-2xs">
          {/* Warehouse Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black shadow-xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-black text-slate-900">
                    {isReturn ? 'رسید ورود کالا به گدام (برگشت از فروش)' : 'حواله رسمی خروج کالا و تحویل بار از گدام'}
                  </h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                    {companySettings.name || 'شرکت برادران نبوی'}
                  </span>
                </div>
                <p className="text-[9px] text-slate-600">
                  گدام مبدا تحویل: <strong>{getWarehouseName(inv.warehouseId)}</strong> • فاکتور عطف: #{inv.invoiceNumber}
                </p>
              </div>
            </div>

            <div className="text-left font-mono text-[9.5px] shrink-0">
              <div className="font-bold text-slate-800">
                حواله انبار: #{inv.invoiceNumber}
              </div>
              <div className="text-slate-600">
                تاریخ: <strong className="font-mono">{inv.date}</strong> ({issueTime})
              </div>
              {isFullySettled ? (
                <span className="text-[8.5px] font-bold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded mt-0.5 inline-block border border-emerald-300">
                  تسویه شده
                </span>
              ) : (
                <span className="text-[8.5px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded mt-0.5 inline-block border border-amber-300">
                  تایید حسابداری
                </span>
              )}
            </div>
          </div>

          {/* Recipient & Logistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-lg bg-white border border-slate-300 text-[9.5px]">
            <div>
              <span className="text-slate-500 block text-[8.5px] font-bold">تحویل‌گیرنده:</span>
              <strong className="text-slate-900 font-bold">{inv.partyName || 'مشتری متفرقه'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[8.5px] font-bold">تماس خریدار:</span>
              <span className="font-mono font-bold text-slate-800">{partyPhone}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8.5px] font-bold">راننده و موتروان:</span>
              <span className="font-bold text-slate-800">
                {inv.driverName || 'تحویل حضوری'} {inv.carPlate ? `(${inv.carPlate})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8.5px] font-bold">محل تخلیه:</span>
              <span className="text-slate-800 truncate block" title={partyAddress}>{partyAddress}</span>
            </div>
          </div>

          {/* Warehouse Items Table */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-right border-collapse text-[9.5px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-800">
                  <th className="py-0.5 px-1.5 border-l border-slate-300 text-center w-7">#</th>
                  <th className="py-0.5 px-2 border-l border-slate-300 text-right">نام و مشخصات کالا</th>
                  <th className="py-0.5 px-2 border-l border-slate-300 text-center w-20">مقدار تحویلی</th>
                  <th className="py-0.5 px-1.5 border-l border-slate-300 text-center w-12">واحد</th>
                  <th className="py-0.5 px-2 border-l border-slate-300 text-center w-24">معادل تناژ (تن)</th>
                  <th className="py-0.5 px-2 border-l border-slate-300 text-center w-24">معادل خریطه (کیسه)</th>
                  <th className="py-0.5 px-2 text-center w-28">گدام تحویل</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((it, idx) => {
                  if (!it) {
                    return (
                      <tr key={`wh-empty-${idx}`} className="border-b border-slate-200 h-5">
                        <td className="py-0.5 px-1.5 border-l border-slate-200 text-center font-mono text-slate-300">{idx + 1}</td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-1.5 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2 border-l border-slate-200"></td>
                        <td className="py-0.5 px-2"></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={`wh-it-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 font-bold h-5.5">
                      <td className="py-0.5 px-1.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-slate-900 font-bold">{it.productName}</td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono font-black text-slate-900">
                        {formatNumber(it.quantity)}
                      </td>
                      <td className="py-0.5 px-1.5 border-l border-slate-200 text-center text-slate-600">{it.unit || 'عدد'}</td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono text-slate-700">
                        {it.tonsCount ? `${formatNumber(it.tonsCount)} تن` : '---'}
                      </td>
                      <td className="py-0.5 px-2 border-l border-slate-200 text-center font-mono text-slate-700">
                        {it.bagsCount ? `${formatNumber(it.bagsCount)} کیسه` : '---'}
                      </td>
                      <td className="py-0.5 px-2 text-center text-slate-600">
                        {getWarehouseName(it.warehouseId || inv.warehouseId)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="h-5.5 bg-slate-100 border-t border-slate-800">
                  <td colSpan={2} className="py-0.5 px-2 text-slate-900 font-black border-l border-slate-300">
                    مجموع اقلام تحویلی گدام:
                  </td>
                  <td colSpan={5} className="py-0.5 px-2 text-slate-950 font-mono font-black whitespace-nowrap">
                    {formatNumber(totalTons)} تن معادل {formatNumber(totalBags)} کیسه
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Warehouse Signatures */}
          {showSignatures && (
            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[9.5px]">
              <div className="relative flex flex-col justify-between min-h-[50px]">
                <span className="text-slate-500 block mb-0.5">امضای انباردار (تحویل‌دهنده)</span>
                <div className="h-6 flex items-center justify-center">
                  <span className="text-[8.5px] text-slate-300 select-none">(محل امضای انباردار)</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold">
                  مسئول گدام
                </div>
              </div>
              <div className="relative flex flex-col justify-between min-h-[50px]">
                <span className="text-slate-500 block mb-0.5">امضای راننده / موتروان</span>
                <div className="h-6 flex items-center justify-center">
                  <span className="text-[8.5px] text-slate-300 select-none">(محل امضای راننده)</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold">
                  {inv.driverName || 'راننده حمل بار'}
                </div>
              </div>
              <div className="relative flex flex-col justify-between min-h-[50px]">
                <span className="text-slate-500 block mb-0.5">امضای تحویل‌گیرنده کالا</span>
                <div className="h-6 flex items-center justify-center">
                  <span className="text-[8.5px] text-slate-300 select-none">(محل امضا یا اثر انگشت)</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-0.5 text-slate-800 font-bold">
                  {inv.partyName || 'مشتری / نماینده'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

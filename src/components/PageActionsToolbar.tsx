import { CloseButton } from './CloseButton';
import React, { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CirclePlus, Download, FileSpreadsheet, Filter, Loader2, Maximize2, Minimize2, Printer, Search, Send, X } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { reportFromTables } from '../utils/reportDom';
import { normalizePersianDate } from '../utils/formatters';
import { reportRowCount, reportTelegramChunks, normalizeReportDigits, type ReportData } from '../utils/reportData';
import { ReportPrintContent } from './ReportPrintContent';
import { WorkspaceDialog } from './WorkspaceShell';
import { getTelegramSettings } from '../services/telegramBotService';
import { fetchTelegramConfig, sendTelegramDirectMessage } from '../services/telegramApiService';

export interface ReportFilter {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
  resetValue?: string;
  kind?: 'date' | 'amount';
}
export interface PageReportSource {
  title: string;
  enabled?: boolean;
  priority?: number;
  getReport?: () => ReportData;
  onCreate?: () => void;
  /** Preserve a view-specific paper format without a second print button inside the page. */
  onPrint?: () => void;
  createLabel?: string;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string; id?: string; label?: string; clearLabel?: string };
  filters?: ReportFilter[];
}
const Registration = createContext<{ register: (id: string, source: PageReportSource) => () => void } | null>(null);

/** Only the active page registers. Provider updates do not re-render its children or create an effect loop. */
export const usePageReport = (source: PageReportSource): void => {
  const registration = useContext(Registration);
  const id = useId();
  useLayoutEffect(() => {
    if (!registration || source.enabled === false) return;
    return registration.register(id, source);
  }, [registration, id, source]);
};

export const PageReportScope: React.FC<{ children: React.ReactNode; header?: React.ReactNode }> = ({ children, header }) => {
  const sources = useRef(new Map<string, PageReportSource>());
  const [source, setSource] = useState<PageReportSource | null>(null);
  const scope = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const register = useCallback((id: string, value: PageReportSource) => {
    const update = () => setSource(Array.from(sources.current.values()).sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null);
    sources.current.set(id, value); update();
    return () => { sources.current.delete(id); update(); };
  }, []);
  const registration = useMemo(() => ({ register }), [register]);
  return <Registration.Provider value={registration}><div ref={scope} className="workspace-report-scope">
    {header}
    {source && <PageActionsToolbar source={source} scope={scope} content={content} />}
    <div ref={content} className="workspace-report-content">{children}</div>
  </div></Registration.Provider>;
};

const PageActionsToolbar: React.FC<{ source: PageReportSource; scope: React.RefObject<HTMLDivElement>; content: React.RefObject<HTMLDivElement> }> = ({ source, scope, content }) => {
  const { companySettings, openPrintModal } = useAccounting();
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [full, setFull] = useState(false);
  const [telegramReport, setTelegramReport] = useState<ReportData | null>(null);
  const filterId = useId();
  React.useEffect(() => {
    const update = () => setFull(document.fullscreenElement === scope.current || !!scope.current?.classList.contains('is-expanded'));
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.fullscreenElement === scope.current) document.exitFullscreen().catch(() => {});
      scope.current?.classList.remove('is-expanded'); setFull(false);
    };
    document.addEventListener('fullscreenchange', update); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('fullscreenchange', update); document.removeEventListener('keydown', escape); scope.current?.classList.remove('is-expanded'); };
  }, [scope]);
  const report = (): ReportData => {
    const data = source.getReport ? source.getReport() : reportFromTables(content.current!, source.title);
    const active = [
      ...(source.search?.value ? [{ label: 'جستجو', value: source.search.value }] : []),
      ...(source.filters || []).filter(filter => filter.value && filter.value !== (filter.resetValue ?? 'all')).map(filter => ({ label: filter.label, value: filter.options?.find(option => option.value === filter.value)?.label || filter.value })),
    ];
    return { ...data, title: data.title || source.title, subtitle: data.subtitle || 'خروجی فهرست با جستجو و فیلترهای جاری', metadata: [...(data.metadata || []), ...active] };
  };
  const run = async (kind: 'pdf' | 'excel') => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(kind); setError('');
    try {
      const data = report(), brand = { ...companySettings };
      if (kind === 'pdf') await (await import('../utils/reportPdf')).downloadReportPdf(data, brand);
      else await (await import('../utils/reportExcel')).downloadReportExcel(data, brand);
    } catch (error) { setError(error instanceof Error ? error.message : 'خروجی فایل انجام نشد؛ دوباره تلاش کنید.'); }
    finally { busyRef.current = false; setBusy(null); }
  };
  const print = async () => {
    setError('');
    try {
      if (document.fullscreenElement === scope.current) await document.exitFullscreen();
      scope.current?.classList.remove('is-expanded'); setFull(false);
      if (source.onPrint) { source.onPrint(); return; }
      const data = report();
      openPrintModal({ type: 'report', title: data.title, subtitle: data.subtitle, metadata: [...(data.metadata || []), { label: 'تعداد ردیف‌ها', value: String(reportRowCount(data)) }], customContent: <ReportPrintContent report={data} /> });
    } catch (error) { setError((error as Error).message); }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement === scope.current) await document.exitFullscreen();
      else if (scope.current?.classList.contains('is-expanded')) { scope.current.classList.remove('is-expanded'); setFull(false); }
      else if (scope.current?.requestFullscreen) await scope.current.requestFullscreen();
      else { scope.current?.classList.add('is-expanded'); setFull(true); }
    } catch { scope.current?.classList.toggle('is-expanded'); setFull(!!scope.current?.classList.contains('is-expanded')); }
  };
  return <>
    <div className="page-actions-toolbar" role="toolbar" aria-label="عملیات فهرست و خروجی" dir="rtl" data-page-actions>
      <div className="page-actions-buttons">
        {source.onCreate && <button type="button" className="page-action is-create" onClick={source.onCreate}><CirclePlus /><span>{source.createLabel || 'ایجاد جدید'}</span></button>}
        <button type="button" className="page-action is-excel" onClick={() => run('excel')} disabled={!!busy} aria-busy={busy === 'excel'}>{busy === 'excel' ? <Loader2 className="is-spinning" /> : <span className="page-action-circle"><FileSpreadsheet /></span>}<span>اکسل</span></button>
        <button type="button" className="page-action is-pdf" onClick={() => run('pdf')} disabled={!!busy} aria-busy={busy === 'pdf'}>{busy === 'pdf' ? <Loader2 className="is-spinning" /> : <span className="page-action-circle"><Download /></span>}<span>پی‌دی‌اف</span></button>
        <button type="button" className="page-action is-telegram" onClick={() => { try { setError(''); setTelegramReport(report()); } catch (error) { setError((error as Error).message); } }}><span className="page-action-circle"><Send /></span><span>تلگرام</span></button>
        <button type="button" className="page-action is-print" onClick={print}><span className="page-action-circle"><Printer /></span><span>پرینت</span></button>
      </div>
      <div className="page-actions-tools">
        {!!source.filters?.length && <button type="button" className="page-action-icon" aria-label="فیلترهای فهرست" aria-controls={filterId} aria-expanded={showFilters} onClick={() => setShowFilters(open => !open)}><Filter /></button>}
        <button type="button" className="page-action-icon" aria-label={full ? 'خروج از تمام‌صفحه' : 'نمایش تمام‌صفحه'} aria-pressed={full} onClick={fullscreen}>{full ? <Minimize2 /> : <Maximize2 />}</button>
        {source.search && <label className="page-actions-search"><Search aria-hidden="true" /><input type="search" id={source.search.id || 'page-actions-search'} aria-label={source.search.label || 'جستجو در لیست'} placeholder={source.search.placeholder || 'جستجو در لیست'} value={source.search.value} onChange={event => source.search!.onChange(event.target.value)} />{source.search.value && <button type="button" aria-label={source.search.clearLabel || 'پاک کردن جستجوی فهرست'} onClick={() => source.search!.onChange('')}><X /></button>}</label>}
      </div>
    </div>
    {showFilters && !!source.filters?.length && <div className="page-actions-filters" id={filterId} role="region" aria-label="فیلترهای خروجی و لیست">
      {source.filters.map(filter => <label key={filter.id}>{filter.label}{filter.kind === 'date' && ' (شمسی)'}{filter.options ? <select aria-label={filter.label} value={filter.value} onChange={event => filter.onChange(event.target.value)}>{filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type="text" aria-label={`${filter.label}${filter.kind === 'date' ? ' (شمسی)' : ''}`} inputMode={filter.kind === 'amount' ? 'decimal' : 'text'} value={filter.value} placeholder={filter.placeholder || (filter.kind === 'date' ? '۱۴۰۵/۰۱/۰۱' : 'همه')} onChange={event => {
        let value = filter.kind ? normalizeReportDigits(event.target.value) : event.target.value;
        if (filter.kind === 'amount') value = value.replace(/٫/g, '.').replace(/[,٬،]/g, '');
        filter.onChange(value);
      }} onBlur={() => { if (filter.kind === 'date' && filter.value) filter.onChange(normalizePersianDate(filter.value)); }} />}</label>)}
      <button type="button" onClick={() => [...(source.filters || []).filter(filter => !filter.options), ...(source.filters || []).filter(filter => filter.options)].forEach(filter => filter.onChange(filter.resetValue ?? (filter.options ? 'all' : '')))}>پاک کردن فیلترها</button>
      <CloseButton type="button" aria-label="بستن فیلترهای فهرست" onClick={() => setShowFilters(false)} />
    </div>}
    {!!busy && <p className="page-actions-status" role="status">در حال آماده‌سازی فایل {busy === 'pdf' ? 'PDF' : 'Excel'}؛ لطفاً منتظر بمانید…</p>}
    {!!error && <p className="page-actions-error" role="alert">{error}</p>}
    {telegramReport && <ReportTelegramDialog report={telegramReport} onClose={() => setTelegramReport(null)} />}
  </>;
};

const ReportTelegramDialog: React.FC<{ report: ReportData; onClose: () => void }> = ({ report, onClose }) => {
  const { companySettings, parties } = useAccounting();
  const [defaultChat, setDefaultChat] = useState(() => getTelegramSettings().defaultChatId || '');
  const [recipient, setRecipient] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [sent, setSent] = useState(0);
  const sentRef = useRef(0);
  const chunks = useMemo(() => reportTelegramChunks(report, companySettings), [report, companySettings]);
  React.useEffect(() => { let alive = true; fetchTelegramConfig().then(config => { if (alive && config.defaultChatId) setDefaultChat(config.defaultChatId); }).catch(() => {}); return () => { alive = false; }; }, []);
  const send = async () => {
    if (busy || !confirmed || !recipient) return;
    const party = parties.find(party => party.id === recipient);
    const chatId = recipient === '__default' ? defaultChat : party?.telegramChatId;
    if (!chatId) { setFailed(true); setMessage('گیرنده به ربات متصل نیست. ابتدا اتصال تلگرام را تنظیم کنید.'); return; }
    setBusy(true); setFailed(false); setMessage('در حال ارسال گزارش…');
    try {
      // Continue after the last acknowledged part if a later request failed. Never re-send confirmed parts.
      for (let index = sentRef.current; index < chunks.length; index++) {
        const result = await sendTelegramDirectMessage({ chatId, partyId: party?.id, partyName: party?.name, messageType: 'statement', title: report.title, textContent: chunks[index] }, AbortSignal.timeout(30000));
        if (!result.success) throw new Error(result.error || 'ارسال گزارش انجام نشد. وضعیت ربات را بررسی کنید.');
        sentRef.current = index + 1; setSent(index + 1);
      }
      setMessage('گزارش با موفقیت ارسال شد.');
    } catch (error) { setFailed(true); setMessage(`${(error as Error).name === 'TimeoutError' ? 'پاسخ ارسال دریافت نشد؛ پیش از تلاش مجدد، وضعیت پیام را در تلگرام بررسی کنید.' : (error as Error).message}${sentRef.current ? ` — ${sentRef.current} از ${chunks.length} بخش تأیید شد؛ بخش‌های تأییدشده دوباره فرستاده نمی‌شوند.` : ''}`); }
    finally { setBusy(false); }
  };
  return <WorkspaceDialog title="ارسال گزارش به تلگرام" closeDisabled={busy} onClose={() => { if (!busy) onClose(); }}>
    <div className="report-telegram-form">
      <p><strong>{report.title}</strong> • {reportRowCount(report)} ردیف • {chunks.length} پیام</p>
      <label>گیرندهٔ گزارش<select aria-label="گیرندهٔ گزارش تلگرام" disabled={busy || sent > 0} value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">گیرنده را انتخاب کنید…</option>{defaultChat && <option value="__default">گیرندهٔ پیش‌فرض ربات</option>}{parties.filter(party => party.telegramChatId).map(party => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
      {!defaultChat && !parties.some(party => party.telegramChatId) && <p role="status">گیرندهٔ متصلی وجود ندارد؛ ابتدا از بخش مدیریت تلگرام، ربات و طرف حساب را متصل کنید.</p>}
      <details><summary>پیش‌نمایش متن ارسالی</summary><pre>{chunks.join('\n\n──────────\n\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')}</pre></details>
      <label className="report-send-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />ارسال این اطلاعات مالی برای گیرندهٔ انتخاب‌شده را تأیید می‌کنم.</label>
      {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
      <div className="workspace-dialog-actions"><CloseButton type="button" disabled={busy} onClick={onClose} variant="outline" label="بستن" aria-label="بستن" /><button type="button" disabled={busy || !confirmed || !recipient || sent === chunks.length} onClick={send}>{busy ? 'در حال ارسال…' : sent ? sent === chunks.length ? 'ارسال شد' : 'ادامهٔ ارسال' : 'تأیید و ارسال گزارش'}</button></div>
    </div>
  </WorkspaceDialog>;
};

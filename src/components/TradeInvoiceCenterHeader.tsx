import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Boxes, ChevronDown, FileText, LayoutGrid,
  List, RotateCcw, RotateCw, SlidersHorizontal, Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { countTradeDocuments, tradeCenterNavigation, tradeCenterSelectionKey } from '../utils/tradeCenter';
import { tradeCenterPage, workspacePageKey, type WorkspacePage } from '../utils/navigation';
import type { NavTab } from './Sidebar';

interface Props {
  activeTab: NavTab;
  subFilter: string;
  onNavigate: (tab: NavTab, filter?: string) => void;
}

const icons: Record<string, LucideIcon> = {
  'purchase-create': ArrowDownLeft, 'purchase-list': List, 'sale-create': ArrowUpRight, 'sale-list': FileText,
  'sale-return-list': RotateCw, 'purchase-return-list': RotateCcw, 'itemized-sales': Boxes, consignment: Warehouse,
};
const shortLabels: Record<string, string> = {
  'sale-return-list': 'مرجوعی فروش', 'purchase-return-list': 'مرجوعی خرید',
  'itemized-sales': 'تفکیک فروش', consignment: 'گدام امانی',
};

/** Shared, read-only navigation around the real invoice forms/lists — not a second financial implementation. */
export const TradeInvoiceCenterHeader: React.FC<Props> = ({ activeTab, subFilter, onNavigate }) => {
  const { invoices } = useAccounting();
  const counts = useMemo(() => countTradeDocuments(invoices), [invoices]);
  const [advancedOpen, setAdvancedOpen] = useState(activeTab === 'legacy_trade');
  const navigation = tradeCenterNavigation();
  const selected = tradeCenterSelectionKey(activeTab, subFilter);
  const primaryNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // A narrow row can scroll, but its current action should never open off-screen.
    primaryNavRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  const formatCount = (value: number) => new Intl.NumberFormat('fa-AF').format(value);
  const pageCounts: Record<string, number> = {
    'purchase-list': counts.buy, 'sale-list': counts.sell,
    'purchase-return-list': counts.return_buy, 'sale-return-list': counts.return_sell,
  };
  const action = (page: WorkspacePage, secondary = false) => {
    const active = workspacePageKey(page.tab, page.filter) === selected;
    const Icon = icons[page.id] || FileText;
    return <button key={page.id} id={`trade-center-page-${page.id}`} type="button"
      className={`trade-center-action ${secondary ? 'is-secondary' : 'center-page-action'} ${active ? 'is-active is-primary' : ''}`}
      aria-label={page.label} aria-current={active ? 'page' : undefined}
      onFocus={event => { if (!secondary) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}
      onClick={() => onNavigate(page.tab, page.filter || 'all')}>
      <Icon aria-hidden="true" /><span>{shortLabels[page.id] || page.label}</span>
      {pageCounts[page.id] !== undefined && <b className="trade-center-count" aria-hidden="true">{formatCount(pageCounts[page.id])}</b>}
    </button>;
  };

  return <header className="trade-center-header" id="trade-invoice-center" data-workspace-center="trade" aria-labelledby="trade-center-title" data-export-exclude="true">
    <div className="trade-center-overview">
      <div className="trade-center-intro">
        <span className="trade-center-emblem" aria-hidden="true"><FileText /></span>
        <div><span className="trade-center-eyebrow">مرکز عملیات بازرگانی</span>
          <h1 id="trade-center-title">{tradeCenterPage.label}</h1>
          <p>ثبت و پیگیری فاکتورها</p>
        </div>
      </div>
      <dl className="trade-center-statistics" aria-label="تعداد اسناد ثبت‌شده">
        <div><dt>فاکتور فروش</dt><dd data-trade-count="sell">{formatCount(counts.sell)}</dd></div>
        <div><dt>فاکتور خرید</dt><dd data-trade-count="buy">{formatCount(counts.buy)}</dd></div>
        <div><dt>جمع مرجوعی‌ها</dt><dd data-trade-count="returns">{formatCount(counts.return_buy + counts.return_sell)}</dd></div>
      </dl>
    </div>
    <nav ref={primaryNavRef} className="trade-center-primary center-page-nav" aria-label="صفحات فاکتورها">
      {navigation.primary.map(page => action(page))}
    </nav>
    <div className="trade-center-supporting">
      <nav className="trade-center-related" aria-label="عملیات مرتبط با فاکتورها">
        {navigation.related.map(page => action(page, true))}
      </nav>
      <button type="button" id="trade-center-more-toggle" className={`trade-center-more ${activeTab === 'legacy_trade' ? 'is-active' : ''}`}
        aria-expanded={advancedOpen} aria-controls="trade-center-advanced" onClick={() => setAdvancedOpen(open => !open)}>
        <SlidersHorizontal aria-hidden="true" /><span>امکانات پیشرفته</span><ChevronDown aria-hidden="true" className={advancedOpen ? 'is-open' : ''} />
      </button>
    </div>
    {advancedOpen && <nav className="trade-center-advanced" id="trade-center-advanced" aria-label="صفحات پیشرفتهٔ فاکتورها">
      <span className="trade-center-advanced-label"><LayoutGrid aria-hidden="true" /> امکانات تکمیلی</span>
      {navigation.advanced.map(page => action(page, true))}
    </nav>}
  </header>;
};

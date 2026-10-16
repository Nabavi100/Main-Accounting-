import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, ChevronDown, FileText, List, SlidersHorizontal } from 'lucide-react';
import type { NavTab } from './Sidebar';
import { treasuryCenterPage, workspacePageKey, type WorkspacePage } from '../utils/navigation';
import { treasuryCenterNavigation, treasuryCenterSelectionKey } from '../utils/treasuryCenter';

interface Props { activeTab: NavTab; subFilter: string; onNavigate: (tab: NavTab, filter?: string) => void }
const icons = { 'receipt-create': ArrowDownToLine, 'receipt-list': List, 'payment-create': ArrowUpFromLine, 'payment-list': FileText };
const shortLabels: Record<string, string> = { 'receipt-create': 'ثبت دریافت', 'payment-create': 'ثبت پرداخت' };

/** Navigation only. All forms, filtering, posting and printing remain in the existing treasury views. */
export const TreasuryCenterHeader: React.FC<Props> = ({ activeTab, subFilter, onNavigate }) => {
  const navigation = treasuryCenterNavigation();
  const selected = treasuryCenterSelectionKey(activeTab, subFilter);
  const primaryNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // A narrow row can scroll, but its current action should never open off-screen.
    primaryNavRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  const [advancedOpen, setAdvancedOpen] = useState(activeTab.startsWith('legacy_'));
  const action = (page: WorkspacePage, primary = false) => {
    const active = workspacePageKey(page.tab, page.filter) === selected;
    const Icon = icons[page.id as keyof typeof icons] || FileText;
    return <button key={page.id} id={`treasury-center-page-${page.id}`} type="button"
      className={`treasury-center-action ${primary ? 'center-page-action' : 'is-secondary'} ${active ? 'is-active is-primary' : ''}`}
      aria-label={page.label} aria-current={active ? 'page' : undefined}
      onFocus={event => { if (primary) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}
      onClick={() => onNavigate(page.tab, page.filter || 'all')}>
      <Icon aria-hidden="true" /><span>{shortLabels[page.id] || page.label}</span>
    </button>;
  };
  return <header className="treasury-center-header" id="treasury-center" data-workspace-center="treasury" aria-labelledby="treasury-center-title" data-export-exclude="true">
    <div className="treasury-center-heading"><Banknote aria-hidden="true" /><h1 id="treasury-center-title">{treasuryCenterPage.label}</h1></div>
    <nav ref={primaryNavRef} className="treasury-center-primary center-page-nav" aria-label="صفحات دریافت و پرداخت">
      {navigation.primary.map(page => action(page, true))}
    </nav>
    <div className="treasury-center-supporting">
      <nav className="treasury-center-related" aria-label="عملیات مرتبط خزانه">{navigation.related.map(page => action(page))}</nav>
      <button id="treasury-center-more-toggle" type="button" className="treasury-center-more" aria-expanded={advancedOpen} aria-controls="treasury-center-advanced" onClick={() => setAdvancedOpen(open => !open)}>
        <SlidersHorizontal aria-hidden="true" /><span>امکانات پیشرفته</span><ChevronDown aria-hidden="true" className={advancedOpen ? 'is-open' : ''} />
      </button>
    </div>
    {advancedOpen && <nav className="treasury-center-advanced" id="treasury-center-advanced" aria-label="فرم‌ها و سوابق پیشرفته خزانه">{navigation.advanced.map(page => action(page))}</nav>}
  </header>;
};

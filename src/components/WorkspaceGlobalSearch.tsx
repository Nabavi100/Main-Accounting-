import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpLeft, CornerDownLeft, Search, UserRound, X, Rows3 } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { buildWorkspaceSearchIndex, searchWorkspace, type WorkspaceSearchEntry } from '../utils/workspaceSearch';
import type { NavTab } from './Sidebar';

interface Props {
  onNavigate: (tab: NavTab, filter?: string) => void;
  onSelectParty: (id: string) => void;
  locationKey: string;
}

/** One local search across real sidebar destinations and current customer/party records. */
export const WorkspaceGlobalSearch: React.FC<Props> = ({ onNavigate, onSelectParty, locationKey }) => {
  const { parties, cashAccounts } = useAccounting();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const index = useMemo(() => buildWorkspaceSearchIndex(parties, cashAccounts), [parties, cashAccounts]);
  const result = useMemo(() => searchWorkspace(index, query), [index, query]);
  const entries = [...result.menus, ...result.customers];
  const active = Math.min(selected, Math.max(0, entries.length - 1));
  const optionId = (offset: number) => `${listId}-option-${offset}`;
  const count = (value: number) => new Intl.NumberFormat('fa-AF').format(value);

  useEffect(() => { setOpen(false); setQuery(''); setSelected(0); }, [locationKey]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || !(event.key.toLowerCase() === 'k' || event.code === 'KeyK')) return;
      // Do not steal focus from an open form dialog, a mobile drawer or native fullscreen.
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') || document.fullscreenElement || Array.from(document.querySelectorAll('.app-modal-heading .app-close-button')).some(heading => heading.getClientRects().length)) return;
      event.preventDefault(); input.current?.focus(); setOpen(true);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', shortcut);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', shortcut); };
  }, []);
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [open, active, query]);

  const choose = (entry: WorkspaceSearchEntry) => {
    setOpen(false); setQuery(''); setSelected(0);
    if (entry.kind === 'menu') onNavigate(entry.tab, entry.filter || 'all');
    else onSelectParty(entry.partyId);
  };
  const keyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      if (entries.length) setSelected(offset => open ? (offset + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length : event.key === 'ArrowDown' ? 0 : entries.length - 1);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && entries[active]) choose(entries[active]);
      else setOpen(true);
    }
  };
  const option = (entry: WorkspaceSearchEntry, offset: number) => <button
    key={entry.id} id={optionId(offset)} type="button" role="option" tabIndex={-1}
    aria-selected={active === offset} className={`workspace-search-option ${active === offset ? 'is-selected' : ''}`}
    onPointerMove={() => setSelected(offset)} onMouseDown={event => event.preventDefault()} onClick={() => choose(entry)}
  >
    <span className="workspace-search-result-icon" aria-hidden="true">{entry.kind === 'party' ? <UserRound /> : <Rows3 />}</span>
    <span className="workspace-search-result-copy"><strong>{entry.title}</strong><small>{entry.description}</small></span>
    <span className="workspace-search-result-target">{entry.kind === 'party' ? 'کارتکس' : 'باز کردن'}<ArrowUpLeft aria-hidden="true" /></span>
  </button>;

  return <div className="workspace-global-search" ref={root} dir="rtl" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <div className={`workspace-search-field ${open ? 'is-open' : ''}`}>
      <Search className="workspace-global-search-icon" aria-hidden="true" />
      <input
        ref={input} id="workspace-global-search" type="search" role="combobox"
        aria-label="جستجوی منوها و مشتریان" placeholder="منو یا مشتری…"
        autoComplete="off" spellCheck={false} maxLength={160} value={query}
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && entries.length ? optionId(active) : undefined}
        onFocus={() => setOpen(true)} onKeyDown={keyDown}
        onChange={event => { setQuery(event.target.value); setSelected(0); setOpen(true); }}
      />
      {query ? <button type="button" className="workspace-global-search-clear" aria-label="پاک کردن جستجوی سربرگ" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(''); setSelected(0); input.current?.focus(); setOpen(true); }}><X aria-hidden="true" /></button>
        : <kbd className="workspace-search-shortcut" title="میانبر جستجو: Ctrl + K"><span>Ctrl</span><span>K</span></kbd>}
    </div>
    {open && <div className="workspace-search-panel">
      <div className="workspace-search-panel-caption"><Search aria-hidden="true" /><span>{query.trim() ? 'نتایج جستجو در محیط کار' : 'دسترسی سریع به بخش‌های پرکاربرد'}</span><kbd>Esc</kbd></div>
      <div id={listId} role="listbox" aria-label="نتایج منوها و مشتریان" className="workspace-search-results">
        {!!result.menus.length && <div role="group" aria-labelledby={`${listId}-menus`}>
          <div className="workspace-search-group-title" id={`${listId}-menus`}><span>منوها</span>{query.trim() && <small>{count(result.menus.length)} از {count(result.menuCount)}</small>}</div>
          {result.menus.map((entry, offset) => option(entry, offset))}
        </div>}
        {!!result.customers.length && <div role="group" aria-labelledby={`${listId}-parties`}>
          <div className="workspace-search-group-title" id={`${listId}-parties`}><span>مشتریان و طرف‌های حساب</span><small>{count(result.customers.length)} از {count(result.customerCount)}</small></div>
          {result.customers.map((entry, offset) => option(entry, offset + result.menus.length))}
        </div>}
        {!entries.length && <div className="workspace-search-empty"><Search aria-hidden="true" /><strong>نتیجه‌ای پیدا نشد</strong><p>نام بخش، نام مشتری، شماره تماس یا کد مشتری را امتحان کنید.</p></div>}
      </div>
      <div className="workspace-search-panel-footer"><span>{query.trim() ? 'انتخاب مشتری، کارتکس او را بدون ثبت یا تغییر اطلاعات باز می‌کند.' : 'برای یافتن مشتری، نام، شماره تماس یا کد او را بنویسید.'}</span><span className="workspace-search-key-hint"><CornerDownLeft aria-hidden="true" />انتخاب</span></div>
    </div>}
    <span className="sr-only" role="status" aria-live="polite">{open && query.trim() ? `${count(result.menuCount)} منو و ${count(result.customerCount)} طرف حساب یافت شد.` : ''}</span>
  </div>;
};

import { CloseButton } from './CloseButton';
import { workspacePageGroups, workspacePageKey, type WorkspacePage } from '../utils/navigation';
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Banknote, BookOpen, Building2, ChevronDown, CreditCard, Factory,
  FolderOpen, Landmark, Menu, PieChart, Power, TrendingUp, Truck,
  Users, Warehouse, X,
  type LucideIcon,
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { WorkspaceGlobalSearch } from './WorkspaceGlobalSearch';
import { WorkspaceHeaderUtilities } from './WorkspaceHeaderUtilities';
import type { NavTab } from './Sidebar';

type AccessTab = 'roles' | 'reset' | 'backup' | 'company' | 'telegram';

interface WorkspaceHeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenAccessModal: (tab?: AccessTab) => void;
  onOpenDataBackupModal: () => void;
  onGoDashboard: () => void;
  onNavigate: (tab: NavTab, filter?: string) => void;
  onSelectParty: (id: string) => void;
  locationKey: string;
  onOpenAppearance: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  onToggleSidebar, isSidebarOpen, onOpenAccessModal, onOpenDataBackupModal, onOpenAppearance, onGoDashboard, onNavigate, onSelectParty, locationKey,
}) => {
  const { companySettings, currentUser, logout } = useAccounting();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuId = useId();

  useEffect(() => {
    const onOutsideClick = (event: Event) => {
      if (!profileRef.current?.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isProfileOpen) {
        setIsProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onOutsideClick);
    document.addEventListener('focusin', onOutsideClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onOutsideClick);
      document.removeEventListener('focusin', onOutsideClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isProfileOpen]);

  return (
    <header className="workspace-header" id="workspace-header">
      <div className="workspace-header-company">
        <button type="button" className="workspace-menu-toggle" onClick={onToggleSidebar} aria-label="باز و بسته کردن منوی اصلی" aria-expanded={isSidebarOpen} aria-controls="workspace-sidebar"><Menu aria-hidden="true" /></button>
        <button type="button" className="workspace-company-pill" onClick={onGoDashboard} title="بازگشت به داشبورد"><Building2 aria-hidden="true" /><span>{companySettings.name}</span></button>
      </div>
      <WorkspaceGlobalSearch onNavigate={onNavigate} onSelectParty={onSelectParty} locationKey={locationKey} />
      <WorkspaceHeaderUtilities />
      <div className="workspace-header-tools">
      <div className="workspace-profile" ref={profileRef}>
        <button ref={profileButtonRef} id="workspace-profile-toggle" type="button" className="workspace-profile-pill" aria-label="گزینه‌های حساب کاربری" aria-expanded={isProfileOpen} aria-controls={profileMenuId} onClick={() => setIsProfileOpen(open => !open)}>
          <span className="workspace-profile-avatar">{currentUser.role === 'admin' ? 'مدیر' : currentUser.name.slice(0, 1)}</span>
          <span className="workspace-profile-copy"><strong>{currentUser.role === 'admin' ? 'مدیر کل سیستم' : currentUser.name}</strong><small>{currentUser.role === 'admin' ? 'مدیر سیستم' : currentUser.roleTitle}</small></span>
        </button>
        {isProfileOpen && <div className="workspace-profile-dropdown" id={profileMenuId} aria-label="گزینه‌های حساب کاربری">
          <span>{currentUser.name}</span>
          <button type="button" onClick={() => { setIsProfileOpen(false); onOpenAccessModal('roles'); }}>مدیریت کاربران و دسترسی‌ها</button>
          <button type="button" onClick={() => { setIsProfileOpen(false); onOpenAppearance(); }}>تنظیمات ظاهر</button>
          <button type="button" onClick={() => { setIsProfileOpen(false); onOpenDataBackupModal(); }}>پشتیبان‌گیری اطلاعات</button>
          <button type="button" className="is-danger" onClick={() => { setIsProfileOpen(false); logout(); }}>خروج از سیستم</button>
        </div>}
      </div>
      </div>
    </header>
  );
};

interface WorkspaceSidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  subFilter: string;
  setSubFilter: (filter: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenAccessModal: (tab?: AccessTab) => void;
  onOpenQuickBackupModal: () => void;
  onOpenTelegramPendingModal: () => void;
  telegramPendingCount: number;
  onOpenAppearance: () => void;
}

/** Native dialog supplies focus trapping, Escape handling and focus restoration. */
export const WorkspaceDialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; closeDisabled?: boolean }> = ({ title, onClose, children, closeDisabled = false }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog className="workspace-dialog" ref={dialogRef} onCancel={event => { event.preventDefault(); if (!closeDisabled) onClose(); }} onClick={event => { if (!closeDisabled && event.target === event.currentTarget) onClose(); }} aria-labelledby={titleId}>
    <div className="workspace-dialog-heading app-modal-heading"><h2 id={titleId}>{title}</h2><CloseButton type="button" onClick={onClose} disabled={closeDisabled} aria-label="بستن پنجره" /></div>
    {children}
  </dialog>;
};

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab, setActiveTab, subFilter, setSubFilter, isOpen, onClose,
  onOpenAccessModal, onOpenQuickBackupModal, onOpenTelegramPendingModal, telegramPendingCount, onOpenAppearance,
}) => {
  const { companySettings, cashAccounts, logout } = useAccounting();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'logout' | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);

  const icons = { definitions: FolderOpen, cash: Banknote, trade: Truck, treasury: CreditCard, assets: Warehouse, reports: TrendingUp, accounting: CreditCard, management: Users, telegram: Users };
  const groups = workspacePageGroups(cashAccounts).map(group => ({ ...group, icon: icons[group.icon] }));
  const pageKey = workspacePageKey(activeTab, subFilter);
  const itemIsActive = (item: WorkspacePage) => workspacePageKey(item.tab, item.filter) === pageKey;
  const activeGroup = groups.find(group => group.items.some(itemIsActive) || (group.landingPage && itemIsActive(group.landingPage)))?.id || null;
  useEffect(() => { setOpenGroup(activeGroup); }, [activeGroup, pageKey]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const onChange = () => setIsMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    sidebarRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === sidebarRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [isOpen, isMobile, onClose]);

  const navigate = (item: Pick<WorkspacePage, 'tab' | 'filter'>) => {
    setSubFilter(item.filter || 'all');
    setActiveTab(item.tab);
    onClose();
  };
  // A section title is an accordion control too, not a link that forcibly reopens it.
  // Entering another center still opens its landing page; toggling the current one keeps its draft.
  const toggleCenterGroup = (id: string, landingPage: WorkspacePage) => {
    const opening = openGroup !== id;
    setOpenGroup(opening ? id : null);
    if (opening && activeGroup !== id) {
      setSubFilter(landingPage.filter || 'all');
      setActiveTab(landingPage.tab);
    }
  };
  const brandName = companySettings.name;

  return <>
    {isOpen && isMobile && <button type="button" className="workspace-sidebar-overlay" onClick={onClose} aria-label="بستن منوی اصلی" />}
    <aside id="workspace-sidebar" className={`workspace-sidebar ${isOpen ? 'is-open' : ''}`} ref={sidebarRef} tabIndex={-1} aria-label="منوی اصلی" role={isMobile && isOpen ? 'dialog' : undefined} aria-modal={isMobile && isOpen ? true : undefined} inert={isMobile && !isOpen ? true : undefined}>
      <div className="workspace-sidebar-brand">
        {companySettings.logoUrl ? <img src={companySettings.logoUrl} alt="نشان شرکت" /> : <span className="workspace-brand-emblem" aria-hidden="true"><Landmark /></span>}
        <span><strong>{brandName}</strong><small dir="ltr">.SYSTEM MANAGEMENT</small></span>
        <button type="button" className="workspace-sidebar-close" onClick={onClose} aria-label="بستن منوی اصلی"><X /></button>
      </div>
      <nav className="workspace-navigation" aria-label="بخش‌های حسابداری">
        <button type="button" id="sidebar-btn-dashboard" className={`workspace-nav-item ${activeTab === 'dashboard' ? 'is-active' : ''}`} aria-current={activeTab === 'dashboard' ? 'page' : undefined} onClick={() => navigate({ tab: 'dashboard' })}><PieChart aria-hidden="true" /><span>داشبورد مدیریتی</span></button>
        <button type="button" id="sidebar-btn-journal" className={`workspace-nav-item ${activeTab === 'journal' ? 'is-active' : ''}`} aria-current={activeTab === 'journal' ? 'page' : undefined} onClick={() => navigate({ tab: 'journal' })}><BookOpen aria-hidden="true" /><span>روزنامچه</span></button>
        {groups.map((group, index) => <React.Fragment key={group.id}>
          {index === 4 && <button type="button" id="sidebar-page-production" aria-current={activeTab === 'production' ? 'page' : undefined} className={`workspace-nav-item ${activeTab === 'production' ? 'is-active' : ''}`} onClick={() => navigate({ tab: 'production' })}><Factory aria-hidden="true" /><span>فرآیند تولید</span></button>}
          <div className="workspace-nav-group">
            {group.landingPage ? <div className="workspace-nav-landing">
              <button type="button" id={`sidebar-group-${group.id}`} className={`workspace-nav-item ${activeGroup === group.id ? 'is-section-active' : ''} ${activeGroup === group.id && !group.items.some(item => item.inSidebar !== false && itemIsActive(item)) ? 'is-active' : ''}`}
                aria-current={activeGroup === group.id && !group.items.some(item => item.inSidebar !== false && itemIsActive(item)) ? 'page' : undefined}
                aria-expanded={openGroup === group.id} aria-controls={`workspace-menu-${group.id}`}
                title={group.landingPage.label} onClick={() => toggleCenterGroup(group.id, group.landingPage!)}>
                <group.icon aria-hidden="true" /><span>{group.label}</span>
              </button>
              <button type="button" id={`sidebar-group-toggle-${group.id}`} className="workspace-nav-group-toggle" aria-label={`باز و بسته کردن میانبرهای ${group.label}`}
                aria-expanded={openGroup === group.id} aria-controls={`workspace-menu-${group.id}`} onClick={() => setOpenGroup(open => open === group.id ? null : group.id)}>
                <ChevronDown aria-hidden="true" className={`workspace-nav-chevron ${openGroup === group.id ? 'is-open' : ''}`} />
              </button>
            </div> : <button type="button" id={`sidebar-group-${group.id}`} className={`workspace-nav-item ${activeGroup === group.id ? 'is-section-active' : ''}`} aria-expanded={openGroup === group.id} aria-controls={`workspace-menu-${group.id}`} onClick={() => setOpenGroup(open => open === group.id ? null : group.id)}><group.icon aria-hidden="true" /><span>{group.label}</span><ChevronDown aria-hidden="true" className={`workspace-nav-chevron ${openGroup === group.id ? 'is-open' : ''}`} /></button>}
            {openGroup === group.id && <div className="workspace-submenu" id={`workspace-menu-${group.id}`}>
              {group.items.filter(item => item.inSidebar !== false).map(item => <button key={item.id} id={`sidebar-page-${item.id}`} type="button" className={itemIsActive(item) ? 'is-active' : ''} aria-current={itemIsActive(item) ? 'page' : undefined} onClick={() => navigate(item)}>{item.label}{item.id === 'telegram-pending' && telegramPendingCount > 0 ? ` (${telegramPendingCount})` : ''}</button>)}
            </div>}
          </div>
        </React.Fragment>)}
        <div className="workspace-nav-actions">
          <button type="button" id="sidebar-page-company-units" aria-current={activeTab === 'company_units' ? 'page' : undefined} className={`workspace-nav-item workspace-switch-company ${activeTab === 'company_units' ? 'is-active' : ''}`} onClick={() => navigate({ tab: 'company_units' })}><Building2 aria-hidden="true" />تغییر واحد شرکت</button>
          <button type="button" className="workspace-logout" onClick={() => setDialog('logout')}><Power aria-hidden="true" />خروج از سیستم</button>
        </div>
      </nav>
    </aside>
    {dialog === 'logout' && <WorkspaceDialog title="خروج از سیستم" onClose={() => setDialog(null)}>
      <p>آیا می‌خواهید از حساب کاربری خارج شوید؟ اطلاعات ثبت‌شده حذف نمی‌شوند.</p>
      <div className="workspace-dialog-actions"><button type="button" onClick={() => setDialog(null)}>انصراف</button><button type="button" className="is-danger" onClick={() => { setDialog(null); onClose(); logout(); }}>خروج از سیستم</button></div>
    </WorkspaceDialog>}
  </>;
};

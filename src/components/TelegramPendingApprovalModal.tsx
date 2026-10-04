import React, { useState, useEffect } from 'react';
import { useAccounting } from '../context/AccountingContext';
import {
  fetchTelegramUsers,
  linkTelegramUserToParty,
  unlinkTelegramUser,
  TelegramUser,
} from '../services/telegramApiService';
import {
  Bell,
  CheckCircle2,
  X,
  UserCheck,
  UserPlus,
  Trash2,
  Smartphone,
  Hash,
  Clock,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface TelegramPendingApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickAddParty?: (defaultName?: string, defaultPhone?: string) => void;
}

export const TelegramPendingApprovalModal: React.FC<TelegramPendingApprovalModalProps> = ({
  isOpen,
  onClose,
  onOpenQuickAddParty,
}) => {
  const { parties, updateParty, notify } = useAccounting();
  const [pendingUsers, setPendingUsers] = useState<TelegramUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPartiesMap, setSelectedPartiesMap] = useState<Record<string, string>>({});
  const [partySearchTerm, setPartySearchTerm] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load pending users from server
  const loadPending = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTelegramUsers();
      setPendingUsers(data.pending || []);
    } catch (e) {
      console.warn('Failed to fetch pending telegram users:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPending();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle linking user to an existing party
  const handleLinkUser = async (user: TelegramUser) => {
    const partyId = selectedPartiesMap[user.id];
    if (!partyId) {
      notify('warning', 'انتخاب مشتری الزامی است', 'لطفاً ابتدا مشتری مورد نظر را از لیست انتخاب فرمایید.');
      return;
    }

    const party = parties.find(p => p.id === partyId);
    if (!party) return;

    setActionLoadingId(user.id);
    try {
      const res = await linkTelegramUserToParty({
        chatId: user.telegramChatId,
        identifier: user.id,
        partyId,
        partyName: party.name,
        phone: user.phoneNumber,
        connectionCode: user.connectionCode,
      });
      if (res.success) {
        // Update local party in context
        updateParty(partyId, {
          telegramChatId: user.telegramChatId,
          telegramUsername: user.username,
          phone: party.phone || user.phoneNumber,
          telegramLinkedAt: new Date().toISOString(),
          telegramLastInquiry: new Date().toISOString(),
        });

        notify(
          'success',
          'اتصال مشتری به تلگرام با موفقیت انجام شد',
          `شماره ${user.phoneNumber || user.connectionCode} به پرونده «${party.name}» وصل شد و پیام تایید برای مشتری ارسال گردید.`
        );

        // Remove from local pending list
        setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      } else {
        notify('error', 'خطا در اتصال', res.error || 'عملیات با خطا مواجه شد.');
      }
    } catch (err: any) {
      notify('error', 'خطا در شبکه', err?.message || 'ارتباط با سرور برقرار نشد.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle dismissing/rejecting a pending request
  const handleDismissUser = async (user: TelegramUser) => {
    setActionLoadingId(user.id);
    try {
      const res = await unlinkTelegramUser(user.telegramChatId || user.id);
      if (res.success) {
        notify('info', 'درخواست رد شد', `درخواست کاربر ${user.firstName || user.phoneNumber} نادیده گرفته شد.`);
        setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      }
    } catch {
      notify('error', 'خطا', 'عدم امکان حذف درخواست.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  درخواست‌های اتصال تلگرام در انتظار تایید
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs font-mono shadow-xs">
                  {pendingUsers.length} مورد
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                مشتریانی که ربات تلگرام را استارت زده‌اند و منتظر اتصال به پرونده مالی و ارسال صورت‌حساب هستند
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadPending}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="بروزرسانی لیست"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition cursor-pointer"
              title="بستن (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {isLoading && pendingUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-xs font-bold">درحال بررسی درخواست‌های جدید تلگرام...</p>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-black text-slate-800">
                هیچ درخواست معلقی وجود ندارد!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                تمام مشتریانی که ربات تلگرام را استارت زده‌اند به پرونده‌هایشان متصل شده‌اند یا درخواست جدیدی ثبت نشده است.
              </p>
            </div>
          ) : (
            pendingUsers.map(user => {
              const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'کاربر تلگرام';
              const searchStr = partySearchTerm[user.id] || '';
              const filteredParties = parties.filter(p => {
                if (!searchStr) return true;
                return (
                  p.name.toLowerCase().includes(searchStr.toLowerCase()) ||
                  (p.phone && p.phone.includes(searchStr)) ||
                  (p.code && p.code.includes(searchStr))
                );
              });

              // Suggested match based on phone number
              const suggestedParty = user.phoneNumber
                ? parties.find(p => p.phone && p.phone.replace(/\D/g, '').endsWith(user.phoneNumber.replace(/\D/g, '').slice(-7)))
                : null;

              return (
                <div
                  key={user.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-4 sm:p-5 shadow-xs transition-all space-y-4"
                >
                  {/* User Profile Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                        {user.firstName ? user.firstName.charAt(0) : '؟'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">{fullName}</span>
                          {user.username && (
                            <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
                              {user.username.startsWith('@') ? user.username : `@${user.username}`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                            {user.phoneNumber ? user.phoneNumber : 'شماره تلفن اشتراک گذاشته نشده'}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            کد اتصال: <strong className="text-indigo-600">{user.connectionCode}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(user.registeredAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleDismissUser(user)}
                        disabled={actionLoadingId === user.id}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        title="رد درخواست"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>رد</span>
                      </button>
                    </div>
                  </div>

                  {/* Suggested Match Alert */}
                  {suggestedParty && !selectedPartiesMap[user.id] && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          پیشنهاد هوشمند: تطابق با شماره مشتری <b>«{suggestedParty.name}»</b> ({suggestedParty.phone})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPartiesMap(prev => ({ ...prev, [user.id]: suggestedParty.id }))
                        }
                        className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition cursor-pointer shrink-0"
                      >
                        انتخاب این مشتری
                      </button>
                    </div>
                  )}

                  {/* Actions: Link to Existing Party or Create New Party */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="sm:col-span-8 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>انتخاب مشتری برای اتصال:</span>
                        <span className="text-[10px] text-slate-400">جستجو با نام یا شماره تماس</span>
                      </label>
                      <div className="relative">
                        <select
                          value={selectedPartiesMap[user.id] || ''}
                          onChange={e =>
                            setSelectedPartiesMap(prev => ({ ...prev, [user.id]: e.target.value }))
                          }
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                        >
                          <option value="">-- انتخاب مشتری از لیست سیستم --</option>
                          {parties.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.phone ? `(${p.phone})` : ''} - کد: {p.code || p.id.slice(0, 4)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLinkUser(user)}
                        disabled={actionLoadingId === user.id || !selectedPartiesMap[user.id]}
                        className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>تأیید و اتصال حساب</span>
                      </button>

                      {onOpenQuickAddParty && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenQuickAddParty(fullName, user.phoneNumber);
                          }}
                          className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                          title="تعریف مشتری جدید با این شماره"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span className="hidden sm:inline">مشتری جدید</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>به محض تایید، صورت‌حساب اختصاصی مشتری فوراً در تلگرام برای وی ارسال می‌شود.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

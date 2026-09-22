import React, { useState, useEffect } from 'react';
import {
  Send,
  Bot,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Key,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  RefreshCw,
  Sparkles,
  Users,
  ShieldCheck,
  Phone,
  Activity,
  Trash2,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  TelegramSettings,
  TelegramSubscriber,
  TelegramLogEntry,
  getTelegramSettings,
  saveTelegramSettings,
  testTelegramBotConnection,
  getSubscribersList,
  removeTelegramSubscriber,
  getTelegramLogs,
  clearTelegramLogs,
  sendCustomerAccountStatement,
  isTelegramListenerRunning,
} from '../services/telegramBotService';
import { useAccounting } from '../context/AccountingContext';

interface TelegramBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (settings: TelegramSettings) => void;
}

export const TelegramBotModal: React.FC<TelegramBotModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const { parties, invoices, companySettings, notify } = useAccounting();

  const [activeTab, setActiveTab] = useState<'settings' | 'customers' | 'logs' | 'guide'>('settings');
  const [settings, setSettings] = useState<TelegramSettings>(getTelegramSettings());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    botName?: string;
    username?: string;
    error?: string;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSendingTestMsg, setIsSendingTestMsg] = useState(false);
  const [testMsgStatus, setTestMsgStatus] = useState<string | null>(null);

  // Subscribers & Logs State
  const [subscribers, setSubscribers] = useState<TelegramSubscriber[]>([]);
  const [logs, setLogs] = useState<TelegramLogEntry[]>([]);
  const [sendingPartyId, setSendingPartyId] = useState<string | null>(null);

  const refreshData = () => {
    setSettings(getTelegramSettings());
    setSubscribers(getSubscribersList());
    setLogs(getTelegramLogs());
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
      setTestResult(null);
      setSavedSuccess(false);
      setTestMsgStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!settings.botToken) {
      setTestResult({ success: false, error: 'لطفاً توکن ربات را وارد کنید.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testTelegramBotConnection(settings.botToken);
      setTestResult(res);
      if (res.success) {
        setSettings(prev => ({
          ...prev,
          botUsername: res.username,
          botFirstName: res.botName,
          lastTestStatus: 'connected',
          lastTestedAt: new Date().toLocaleTimeString('fa-IR'),
        }));
      } else {
        setSettings(prev => ({
          ...prev,
          lastTestStatus: 'error',
          lastError: res.error,
        }));
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e?.message || 'خطا در ارتباط' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!settings.botToken || !settings.defaultChatId) {
      setTestMsgStatus('لطفاً هم توکن و هم شناسه چت (Chat ID) را تکمیل کنید.');
      return;
    }

    setIsSendingTestMsg(true);
    setTestMsgStatus(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${settings.botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.defaultChatId.trim(),
          text: `
🤖 <b>اتصال موفق ربات حسابداری به تلگرام</b>
━━━━━━━━━━━━━━━━━━━━
این پیام آزمایشی جهت تایید کارکرد ربات سیستم حسابداری شرکت «${companySettings.name || 'شرکت تجارتی'}» ارسال شده است.
سیستم استعلام اختصاصی با تطبیق شماره تماس مشتریان فعال می‌باشد.
━━━━━━━━━━━━━━━━━━━━
✨ <i>صادر شده از سیستم مالی</i>
`.trim(),
          parse_mode: 'HTML',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setTestMsgStatus('✅ پیام آزمایشی با موفقیت به تلگرام فرستاده شد!');
      } else {
        setTestMsgStatus(`❌ خطا از تلگرام: ${data.description || 'ناموفق'}`);
      }
    } catch (err: any) {
      setTestMsgStatus(`❌ خطای شبکه: ${err?.message || 'عدم دسترسی'}`);
    } finally {
      setIsSendingTestMsg(false);
    }
  };

  const handleSave = () => {
    saveTelegramSettings(settings);
    setSavedSuccess(true);
    if (onSettingsSaved) {
      onSettingsSaved(settings);
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleRemoveSubscriber = (chatId: string) => {
    if (window.confirm('آیا از قطع اتصال این مشتری از ربات تلگرام اطمینان دارید؟')) {
      removeTelegramSubscriber(chatId);
      refreshData();
    }
  };

  const handleSendStatementToParty = async (sub: TelegramSubscriber) => {
    const party = parties.find(p => p.id === sub.partyId);
    if (!party) {
      notify('error', 'مشتری در سیستم یافت نشد');
      return;
    }

    setSendingPartyId(sub.partyId);
    try {
      const success = await sendCustomerAccountStatement(
        sub.chatId,
        party,
        invoices,
        companySettings,
        settings
      );
      if (success) {
        notify('success', 'ارسال موفق', `جمله حساب اختصاصی برای محترم ${party.name} ارسال شد.`);
        refreshData();
      } else {
        notify('error', 'خطا در ارسال', 'ارسال پیام به تلگرام مشتری با خطا مواجه شد.');
      }
    } catch (e: any) {
      notify('error', 'خطای شبکه', e?.message || 'ناموفق');
    } finally {
      setSendingPartyId(null);
    }
  };

  const handleClearAllLogs = () => {
    if (window.confirm('آیا مایلید تمام لاگ‌های ثبت‌شده تلگرام پاک شوند؟')) {
      clearTelegramLogs();
      setLogs([]);
    }
  };

  const isListenerRunning = isTelegramListenerRunning();

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 z-[1000] overflow-y-auto"
      dir="rtl"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-black">
              <Send className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  ربات تلگرام و استعلام اختصاصی حساب مشتریان
                </h2>
                {settings.botToken && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isListenerRunning
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isListenerRunning ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                      }`}
                    />
                    {isListenerRunning ? 'شنود فعال و آماده پاسخ' : 'در انتظار اتصال'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تطبیق شماره مشتری و ارسال خودکار «جمله حساب» فقط برای همان مشتری
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>تنظیمات توکن و اتصال</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('customers');
              refreshData();
            }}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>مشتریان متصل</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/30 text-current">
              {subscribers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('logs');
              refreshData();
            }}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>لاگ رخدادها و استعلام‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>راهنمای کارکرد اختصاصی</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 text-xs">
          {/* TAB 1: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-3.5">
              {/* Bot Token */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>توکن ربات تلگرام (Bot Token):</span>
                  </span>
                  {settings.botUsername && (
                    <span className="text-[11px] font-mono text-sky-700 font-bold">
                      @{settings.botUsername}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                    value={settings.botToken}
                    onChange={e => setSettings({ ...settings, botToken: e.target.value })}
                    className="w-full pl-24 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Bot className="w-3 h-3" />
                    )}
                    <span>تست توکن</span>
                  </button>
                </div>
              </div>

              {/* Test Status Feedback */}
              {testResult && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {testResult.success ? (
                      <div>
                        <div className="font-bold">اتصال به ربات موفق بود!</div>
                        <div className="text-[11px] text-emerald-800 mt-0.5">
                          نام ربات: <strong>{testResult.botName}</strong> (@{testResult.username})
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold">خطا در اتصال:</div>
                        <div className="text-[11px] text-rose-700 mt-0.5">{testResult.error}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Automatic Listener Switch */}
              <div className="p-3 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>پاسخگویی خودکار و شنود آنلاین (Auto-Reply Polling)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    وقتی برنامه باز است، ربات پیام‌های /start و شماره‌های مشتریان را بررسی کرده و
                    بلافاصله فقط جمله حساب خودشان را ارسال می‌کند.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.autoListenerEnabled}
                    onChange={e =>
                      setSettings({ ...settings, autoListenerEnabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Default Chat ID for Management / Backup */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                    <span>شناسه مدیریت یا کانال اعلان شرکت (اختیاری):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (جهت ارسال پیام‌های تست یا ارسال کلی)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="مثلاً: 123456789 یا @my_channel"
                    value={settings.defaultChatId}
                    onChange={e => setSettings({ ...settings, defaultChatId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition"
                  />
                  {settings.defaultChatId && settings.botToken && (
                    <button
                      type="button"
                      onClick={handleSendTestMessage}
                      disabled={isSendingTestMsg}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {isSendingTestMsg ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>ارسال پیام تست</span>
                    </button>
                  )}
                </div>
                {testMsgStatus && (
                  <p
                    className={`text-[11px] font-bold mt-1 ${
                      testMsgStatus.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {testMsgStatus}
                  </p>
                )}
              </div>

              {/* What to Send */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block text-xs mb-1">
                  محتویات ارسالی فاکتورها به تلگرام:
                </span>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.sendPhoto}
                    onChange={e => setSettings({ ...settings, sendPhoto: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-sky-600"
                  />
                  <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                  <span className="text-slate-700">ارسال تصویر فاکتور (Photo Image)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.sendText}
                    onChange={e => setSettings({ ...settings, sendText: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-sky-600"
                  />
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-700">
                    ارسال متن صورت‌حساب (نام، تماس، مانده افغانی و دلاری)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.sendDocument}
                    onChange={e => setSettings({ ...settings, sendDocument: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-sky-600"
                  />
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-slate-700">ارسال فایل متنی سند (.txt Document)</span>
                </label>

                <div className="pt-2 border-t border-slate-200 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={settings.autoSendOnSave}
                      onChange={e => setSettings({ ...settings, autoSendOnSave: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer accent-blue-600"
                    />
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>ارسال خودکار به تلگرام مشتری بلافاصله پس از ثبت هر فاکتور</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONNECTED CUSTOMERS */}
          {activeTab === 'customers' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11.5px] text-emerald-950 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>سیستم تفکیک ۱۰۰٪ مستقل مشتریان:</strong> هر مشتری که دکمه استارت را می‌زند
                  و شماره تماس خود را می‌فرستد، در این لیست ثبت شده و ربات فقط و فقط حساب اختصاصی خودش
                  را برای او ارسال می‌کند.
                </div>
              </div>

              {subscribers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-bold text-slate-600">هنوز مشتری‌ای به ربات وصل نشده است</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    کافی است مشتری به ربات شما (@{settings.botUsername || 'your_bot'}) برود و دکمه
                    Start را بزند تا با شماره تلفن خود متصل شود.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {subscribers.map((sub, idx) => {
                    const party = parties.find(p => p.id === sub.partyId);
                    const balAFN = party?.balanceAFN || 0;
                    const balUSD = party?.balanceUSD || 0;
                    return (
                      <div
                        key={sub.chatId}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-black text-slate-900 text-xs">
                              {sub.partyName || party?.name || 'مشتری'}
                            </span>
                            {sub.telegramUsername && (
                              <span className="text-[10px] font-mono text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                                {sub.telegramUsername}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{sub.phone}</span>
                            </span>
                            <span>ChatID: {sub.chatId}</span>
                            {sub.lastInquiryAt && (
                              <span className="text-[10px] text-slate-400">
                                آخرین استعلام: {new Date(sub.lastInquiryAt).toLocaleTimeString('fa-IR')}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-bold">
                            مانده فعلی:{' '}
                            <span
                              className={
                                balAFN < 0
                                  ? 'text-rose-600'
                                  : balAFN > 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-500'
                              }
                            >
                              {balAFN < 0
                                ? `${Math.abs(balAFN).toLocaleString()} AFN بدهکار`
                                : balAFN > 0
                                ? `${balAFN.toLocaleString()} AFN طلبکار`
                                : '۰ AFN تسویه'}
                            </span>
                            {balUSD !== 0 && (
                              <span className="mr-2 text-indigo-700">
                                | {balUSD.toLocaleString()} $
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSendStatementToParty(sub)}
                            disabled={sendingPartyId === sub.partyId}
                            className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="ارسال دستی آخرین وضعیت حساب به تلگرام این مشتری"
                          >
                            {sendingPartyId === sub.partyId ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3 -rotate-45" />
                            )}
                            <span>ارسال حساب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveSubscriber(sub.chatId)}
                            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                            title="قطع اتصال این مشتری از ربات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">
                  لاگ پیام‌ها و احراز هویت‌های زنده مشتریان:
                </span>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllLogs}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    پاک‌سازی لاگ‌ها
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="font-bold text-slate-600">هنوز رخدادی ثبت نشده است</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    پیام‌های دریافتی از مشتریان و استعلام‌های حساب در اینجا نمایش داده می‌شوند.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto font-mono text-[11px]">
                  {logs.map(log => {
                    let badgeColor = 'bg-slate-100 text-slate-700';
                    if (log.type === 'auth_success') badgeColor = 'bg-emerald-100 text-emerald-800';
                    if (log.type === 'auth_failed') badgeColor = 'bg-rose-100 text-rose-800';
                    if (log.type === 'inquiry') badgeColor = 'bg-sky-100 text-sky-800';

                    return (
                      <div
                        key={log.id}
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-start gap-2"
                      >
                        <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                          {log.timestamp}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded shrink-0 ${badgeColor}`}
                        >
                          {log.type}
                        </span>
                        <div className="flex-1 font-sans text-slate-800 break-words leading-relaxed">
                          {log.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRIVACY & ARCHITECTURE GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-3 leading-relaxed text-slate-700 text-xs">
              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-2xl space-y-2">
                <div className="font-black text-sky-950 text-sm flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-sky-600" />
                  <span>نحوه عملکرد ربات برای ۱۰۰+ مشتری به صورت کاملاً تفکیک‌شده:</span>
                </div>
                <p>
                  در این سیستم امنیت و محرمانگی به گونه‌ای طراحی شده که <strong>هیچ مشتری‌ای نمی‌تواند
                  حساب مشتری دیگر را ببیند</strong>:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pr-1 text-slate-800 font-medium">
                  <li>
                    <strong>ثبت شماره در سیستم:</strong> شما شماره تماس مشتری (مثلاً <code>0799123456</code>)
                    را در بخش طرف حساب‌ها و مشتریان برنامه ثبت می‌کنید.
                  </li>
                  <li>
                    <strong>ورود مشتری به ربات:</strong> مشتری به آدرس ربات شما در تلگرام رفته و دکمه{' '}
                    <strong>Start</strong> را می‌زند.
                  </li>
                  <li>
                    <strong>احراز هویت با یک کلیک:</strong> ربات دکمه امن تلگرام (📱 ارسال شماره تماس
                    من جهت احراز هویت) را نمایش می‌دهد.
                  </li>
                  <li>
                    <strong>تطبیق شماره:</strong> سیستم شماره مشتری را با لیست مشتریان شرکت تطبیق داده
                    و شناسه چت تلگرام او را منحصراً به پرونده همان مشتری متصل می‌کند.
                  </li>
                  <li>
                    <strong>ارسال جمله حساب اختصاصی:</strong> بلافاصله مانده حساب دقیق، فاکتورهای اخیر
                    و دکمه‌های بروزرسانی فقط برای همان شخص فرستاده می‌شود.
                  </li>
                  <li>
                    <strong>جلوگیری از نفوذ شماره‌های متفرقه:</strong> اگر فرد ناشناسی که شماره‌اش در
                    برنامه نیست وارد ربات شود، ربات پیام اخطار داده و هیچ اطلاعاتی را افشا نمی‌کند.
                  </li>
                </ol>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-1 text-[11.5px]">
                <div className="font-bold text-slate-900">نکته مهم در رابطه با شماره‌ها:</div>
                <p className="text-slate-600">
                  سیستم به صورت خودکار پیش‌شماره‌های بین‌المللی (مانند <code>+93</code> یا <code>0093</code>)
                  و صفرهای اولیه را یکسان‌سازی می‌کند؛ بنابراین اگر مشتری شماره را به هر شکلی وارد کند،
                  دقیقاً شناسایی خواهد شد.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>تنظیمات ذخیره شد!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>ذخیره تنظیمات ربات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

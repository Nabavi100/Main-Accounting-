import { Party, Invoice, FinancialTransaction, CompanySettings } from '../types';
import { formatNumber, getPersianDate } from '../utils/formatters';

export interface TelegramStatusResponse {
  isConfigured: boolean;
  botUsername: string;
  botFirstName: string;
  defaultChatId: string;
  isPolling: boolean;
  pendingCount: number;
  connectedCount: number;
  lastTestStatus: 'connected' | 'error' | 'idle';
  lastTestedAt?: string;
  lastError?: string;
}

export interface TelegramUser {
  id: string;
  telegramUserId: string;
  telegramChatId: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  username?: string;
  connectionCode: string;
  registeredAt: string;
  status: 'pending' | 'connected';
  partyId?: string;
  partyName?: string;
  linkedAt?: string;
  lastMessageSent?: string;
  lastInquiryAt?: string;
  inquiriesCount?: number;
}

export interface TelegramLog {
  id: string;
  timestamp: string;
  type: string;
  chatId: string;
  partyName?: string;
  message: string;
  status: 'success' | 'failed';
  errorDetails?: string;
}

export interface SendMessagePayload {
  chatId: string;
  partyId?: string;
  partyName?: string;
  messageType: 'invoice' | 'receive_receipt' | 'payment_receipt' | 'statement' | 'balance' | 'announcement' | 'manual' | 'test';
  title: string;
  textContent: string;
  photoBase64?: string;
}

// ================= API CLIENT METHODS =================

export async function fetchTelegramStatus(): Promise<TelegramStatusResponse> {
  try {
    const res = await fetch('/api/telegram/status');
    if (!res.ok) throw new Error('Network response not ok');
    return await res.json();
  } catch (e: any) {
    return {
      isConfigured: false,
      botUsername: '',
      botFirstName: '',
      defaultChatId: '',
      isPolling: false,
      pendingCount: 0,
      connectedCount: 0,
      lastTestStatus: 'idle',
      lastError: e?.message,
    };
  }
}

export async function saveTelegramConfig(data: {
  botToken?: string;
  defaultChatId?: string;
  autoPolling?: boolean;
}): Promise<{ success: boolean; botUsername?: string; botFirstName?: string; error?: string }> {
  const res = await fetch('/api/telegram/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function testTelegramBotConnection(botToken?: string): Promise<{
  success: boolean;
  botName?: string;
  username?: string;
  error?: string;
}> {
  const res = await fetch('/api/telegram/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken }),
  });
  return await res.json();
}

export async function fetchTelegramUsers(): Promise<{
  pending: TelegramUser[];
  connected: TelegramUser[];
  total: number;
}> {
  try {
    const res = await fetch('/api/telegram/users');
    if (!res.ok) throw new Error('Network response not ok');
    return await res.json();
  } catch (e) {
    return { pending: [], connected: [], total: 0 };
  }
}

export async function linkTelegramUserToParty(data: {
  chatId?: string;
  connectionCode?: string;
  partyId: string;
  partyName: string;
}): Promise<{ success: boolean; user?: TelegramUser; error?: string }> {
  const res = await fetch('/api/telegram/link-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function unlinkTelegramUser(chatId: string): Promise<{ success: boolean; user?: TelegramUser; error?: string }> {
  const res = await fetch('/api/telegram/unlink-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
  });
  return await res.json();
}

export async function sendTelegramDirectMessage(payload: SendMessagePayload): Promise<{
  success: boolean;
  messageId?: number;
  error?: string;
}> {
  const res = await fetch('/api/telegram/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function fetchTelegramLogs(): Promise<TelegramLog[]> {
  try {
    const res = await fetch('/api/telegram/logs');
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
  } catch {
    return [];
  }
}

export async function clearTelegramLogsApi(): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram/clear-logs', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncPartiesWithBackend(parties: Party[]): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram/sync-parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parties }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ================= MESSAGE TEMPLATE BUILDERS =================

/**
 * 1. Invoice Message
 */
export function buildInvoiceTelegramText(
  inv: Invoice,
  party: Party | undefined,
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';
  const partyName = inv.partyName || party?.name || 'مشتری گرامی';
  const partyPhone = party?.phone || inv.partyPhone || 'ثبت نشده';
  const date = inv.date || getPersianDate();
  const time = inv.issueTime || '';
  const currency = inv.currency || 'AFN';

  const total = inv.totalAmount || 0;
  const paid = inv.paidAmount || 0;
  const rem = Math.max(0, total - paid);
  const statusBadge = rem <= 0.01 ? '🟢 تسویه کامل' : '🔴 بدهکار (قرضدار)';

  // Overall customer balance
  const balAFN = party?.balanceAFN || 0;
  const balUSD = party?.balanceUSD || 0;
  const overallAFN = balAFN < -0.01 ? `${formatNumber(Math.abs(balAFN))} افغانی بدهکار` : balAFN > 0.01 ? `${formatNumber(balAFN)} افغانی طلبکار` : '۰ افغانی (تسویه)';
  const overallUSD = balUSD < -0.01 ? `${formatNumber(Math.abs(balUSD))} $ بدهکار` : balUSD > 0.01 ? `${formatNumber(balUSD)} $ طلبکار` : '۰ $ (تسویه)';

  const itemsLines = (inv.items || [])
    .map(
      (it, idx) =>
        `  ${idx + 1}. <b>${it.productName}</b>: ${formatNumber(it.quantity)} ${it.unit || ''} × ${formatNumber(it.unitPrice)} = <b>${formatNumber(it.totalPrice)} ${currency}</b>`
    )
    .join('\n');

  return `
🏢 <b>${companyName}</b>
🧾 <b>فاکتور رسمی فروش #${inv.invoiceNumber}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>طرف حساب:</b> ${partyName}
📞 <b>شماره تماس:</b> <code>${partyPhone}</code>
📅 <b>تاریخ و ساعت صدور:</b> ${date} ${time ? `• ${time}` : ''}
💳 <b>نحوه پرداخت:</b> ${inv.dealTypeLabel || inv.dealType || 'قرضی'} (${statusBadge})

📦 <b>اقلام کالا:</b>
${itemsLines || '  اقلام فاکتور'}

💰 <b>مبلغ کل فاکتور:</b> <b>${formatNumber(total)} ${currency}</b>
💵 <b>مبلغ پرداخت‌شده:</b> <b>${formatNumber(paid)} ${currency}</b>
🔴 <b>باقی‌مانده این فاکتور:</b> <b>${formatNumber(rem)} ${currency}</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>مانده حساب کلی مشتری:</b>
• به افغانی: <b>${overallAFN}</b>
• به دلار: <b>${overallUSD}</b>
${companyPhone ? `\n☎️ تلفن دفتر: <code>${companyPhone}</code>` : ''}
━━━━━━━━━━━━━━━━━━━━
✨ <i>ارسال مستقیم از سیستم حسابداری</i>
`.trim();
}

/**
 * 2. Receive Payment Receipt Message (رسید دریافت پول از مشتری)
 */
export function buildReceiveReceiptTelegramText(
  tx: FinancialTransaction,
  party: Party | undefined,
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';
  const partyName = tx.partyName || party?.name || 'مشتری گرامی';
  const date = tx.date || getPersianDate();
  const time = tx.issueTime || '';
  const currency = tx.currency || 'AFN';

  const balAFN = party?.balanceAFN || 0;
  const balUSD = party?.balanceUSD || 0;
  const overallAFN = balAFN < -0.01 ? `${formatNumber(Math.abs(balAFN))} افغانی بدهکار به شرکت` : balAFN > 0.01 ? `${formatNumber(balAFN)} افغانی طلبکار از شرکت` : '۰ افغانی (تسویه کامل)';
  const overallUSD = balUSD < -0.01 ? `${formatNumber(Math.abs(balUSD))} $ بدهکار` : balUSD > 0.01 ? `${formatNumber(balUSD)} $ طلبکار` : '۰ $ (تسویه)';

  return `
🏢 <b>${companyName}</b>
🟢 <b>قبض رسمی دریافت وجه (سند وصول) #${tx.transactionNumber}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>دریافت‌شده از:</b> ${partyName}
💵 <b>مبلغ دریافتی:</b> <b>${formatNumber(tx.amount)} ${currency}</b>
📅 <b>تاریخ و ساعت دریافت:</b> ${date} ${time ? `• ${time}` : ''}
🏦 <b>صندوق واریزی:</b> ${tx.cashRegisterName || 'صندوق مرکزی'}
${tx.description ? `📝 <b>بابت / شرح:</b> ${tx.description}` : ''}
${tx.trackingNumber ? `🔢 <b>شماره پیگیری / حواله:</b> <code>${tx.trackingNumber}</code>` : ''}
━━━━━━━━━━━━━━━━━━━━
📊 <b>وضعیت جدید مانده حساب شما پس از این دریافت:</b>
• مانده افغانی: <b>${overallAFN}</b>
• مانده دلاری: <b>${overallUSD}</b>
━━━━━━━━━━━━━━━━━━━━
🔒 <i>سند فوق در دفاتر مالی شرکت ثبت و تایید گردید. با تشکر از پرداخت به موقع شما.</i>
${companyPhone ? `☎️ تماس با امور مالی: <code>${companyPhone}</code>` : ''}
`.trim();
}

/**
 * 3. Make Payment Receipt Message (رسید پرداخت پول به شخص)
 */
export function buildPaymentReceiptTelegramText(
  tx: FinancialTransaction,
  party: Party | undefined,
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';
  const partyName = tx.partyName || party?.name || 'فروشنده / همکار محترم';
  const date = tx.date || getPersianDate();
  const time = tx.issueTime || '';
  const currency = tx.currency || 'AFN';

  const balAFN = party?.balanceAFN || 0;
  const balUSD = party?.balanceUSD || 0;
  const overallAFN = balAFN < -0.01 ? `${formatNumber(Math.abs(balAFN))} افغانی بدهکار` : balAFN > 0.01 ? `${formatNumber(balAFN)} افغانی طلبکار` : '۰ افغانی (تسویه کامل)';
  const overallUSD = balUSD < -0.01 ? `${formatNumber(Math.abs(balUSD))} $ بدهکار` : balUSD > 0.01 ? `${formatNumber(balUSD)} $ طلبکار` : '۰ $ (تسویه)';

  return `
🏢 <b>${companyName}</b>
📤 <b>سند رسمی پرداخت وجه (قبض خروج وجه) #${tx.transactionNumber}</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>پرداخت‌شده به:</b> ${partyName}
💵 <b>مبلغ پرداختی:</b> <b>${formatNumber(tx.amount)} ${currency}</b>
📅 <b>تاریخ و ساعت پرداخت:</b> ${date} ${time ? `• ${time}` : ''}
🏦 <b>صندوق پرداختی:</b> ${tx.cashRegisterName || 'صندوق مرکزی'}
${tx.description ? `📝 <b>بابت / شرح:</b> ${tx.description}` : ''}
${tx.trackingNumber ? `🔢 <b>شماره حواله / چک:</b> <code>${tx.trackingNumber}</code>` : ''}
━━━━━━━━━━━━━━━━━━━━
📊 <b>وضعیت جدید مانده حساب شما پس از این پرداخت:</b>
• مانده افغانی: <b>${overallAFN}</b>
• مانده دلاری: <b>${overallUSD}</b>
━━━━━━━━━━━━━━━━━━━━
${companyPhone ? `☎️ تماس با واحد مالی: <code>${companyPhone}</code>` : ''}
`.trim();
}

/**
 * 4. Comprehensive Statement (صورتحساب کامل)
 */
export function buildStatementTelegramText(
  party: Party,
  invoices: Invoice[],
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';
  const date = getPersianDate();
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

  const balAFN = party.balanceAFN || 0;
  const balUSD = party.balanceUSD || 0;
  const textAFN = balAFN < -0.01 ? `🔴 <b>${formatNumber(Math.abs(balAFN))} افغانی</b> (بدهکار به ما / قرضدار)` : balAFN > 0.01 ? `🟢 <b>${formatNumber(balAFN)} افغانی</b> (طلبکار از ما / مازاد)` : `⚪ <b>۰ افغانی</b> (بی‌حساب / تسویه کامل)`;
  const textUSD = balUSD < -0.01 ? `🔴 <b>${formatNumber(Math.abs(balUSD))} $</b> (بدهکار به ما)` : balUSD > 0.01 ? `🟢 <b>${formatNumber(balUSD)} $</b> (طلبکار از ما)` : `⚪ <b>۰ $</b> (بی‌حساب / تسویه کامل)`;

  const partyInvoices = (invoices || [])
    .filter(inv => inv.partyId === party.id || inv.partyName === party.name)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 4);

  let invoicesSummary = '';
  if (partyInvoices.length > 0) {
    invoicesSummary = partyInvoices
      .map(inv => {
        const total = inv.totalAmount || 0;
        const paid = inv.paidAmount || 0;
        const rem = Math.max(0, total - paid);
        return `• 🧾 <b>فاکتور #${inv.invoiceNumber}</b> (${inv.date}): مبلغ: <b>${formatNumber(total)} ${inv.currency}</b> | مانده: <b>${formatNumber(rem)} ${inv.currency}</b>`;
      })
      .join('\n');
  } else {
    invoicesSummary = '• <i>هیچ فاکتور اخیری ثبت نشده است.</i>';
  }

  return `
🏢 <b>${companyName}</b>
📋 <b>صورت وضعیت و جمله حساب رسمی</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>طرف حساب:</b> ${party.name} ${party.code ? `(کد: #${party.code})` : ''}
📞 <b>شماره تماس:</b> <code>${party.phone || 'ثبت نشده'}</code>
📅 <b>تاریخ و ساعت صدور:</b> ${date} • ${time}
━━━━━━━━━━━━━━━━━━━━
💰 <b>خلاصه وضعیت مانده حساب شما:</b>
👉 <b>مانده افغانی:</b>
   ${textAFN}

👉 <b>مانده دلاری:</b>
   ${textUSD}
━━━━━━━━━━━━━━━━━━━━
📦 <b>خلاصه آخرین معاملات و فاکتورها:</b>
${invoicesSummary}
━━━━━━━━━━━━━━━━━━━━
🔒 <i>این صورت‌حساب به صورت اختصاصی برای شخص شما صادر گردیده و محفوظ می‌باشد.</i>
${companyPhone ? `☎️ تماس با دفتر: <code>${companyPhone}</code>` : ''}
`.trim();
}

/**
 * 5. Balance Reminder Notice (یادآوری مانده حساب)
 */
export function buildBalanceReminderTelegramText(
  party: Party,
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';
  const date = getPersianDate();

  const balAFN = party.balanceAFN || 0;
  const balUSD = party.balanceUSD || 0;

  let balanceText = '';
  if (balAFN < -0.01 || balUSD < -0.01) {
    balanceText = `⚠️ <b>مشتری گرامی جناب «${party.name}»</b>، ضمن تشکر از همکاری و اعتماد شما، طبق آخرین بروزرسانی سیستم حسابداری در تاریخ <b>${date}</b> مانده حساب بدهی شما به شرح زیر می‌باشد:\n\n`;
    if (balAFN < -0.01) {
      balanceText += `🔴 <b>بدهی به افغانی:</b> <b>${formatNumber(Math.abs(balAFN))} افغانی</b>\n`;
    }
    if (balUSD < -0.01) {
      balanceText += `🔴 <b>بدهی به دلار:</b> <b>${formatNumber(Math.abs(balUSD))} $</b>\n`;
    }
    balanceText += `\nخواهشمند است جهت تسویه یا هماهنگی حساب با مدیریت یا حسابداری شرکت تماس حاصل فرمایید.`;
  } else if (balAFN > 0.01 || balUSD > 0.01) {
    balanceText = `🟢 <b>مشتری گرامی جناب «${party.name}»</b>، مانده حساب شما نزد شرکت دارای بستانکاری و مازاد می‌باشد:\n\n`;
    if (balAFN > 0.01) balanceText += `🟢 <b>طلبکار از ما:</b> <b>${formatNumber(balAFN)} افغانی</b>\n`;
    if (balUSD > 0.01) balanceText += `🟢 <b>طلبکار از ما:</b> <b>${formatNumber(balUSD)} $</b>\n`;
  } else {
    balanceText = `⚪ <b>مشتری گرامی جناب «${party.name}»</b>، حساب شما در سیستم حسابداری کاملاً بی‌حساب و تسویه شده است. مانده: ۰`;
  }

  return `
🏢 <b>${companyName}</b>
🔔 <b>اعلان وضعیت مانده حساب</b>
━━━━━━━━━━━━━━━━━━━━
${balanceText}
━━━━━━━━━━━━━━━━━━━━
${companyPhone ? `☎️ تلفن‌های هماهنگی و تسویه: <code>${companyPhone}</code>` : ''}
`.trim();
}

/**
 * 6. Official Announcement (اطلاعیه رسمی)
 */
export function buildAnnouncementTelegramText(
  title: string,
  message: string,
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';
  const date = getPersianDate();

  return `
🏢 <b>${companyName}</b>
📢 <b>${title || 'اطلاعیه رسمی'}</b>
━━━━━━━━━━━━━━━━━━━━
📅 <b>تاریخ صدور:</b> ${date}
━━━━━━━━━━━━━━━━━━━━
${message}
━━━━━━━━━━━━━━━━━━━━
${companyPhone ? `☎️ تلفن دفتر شرکت: <code>${companyPhone}</code>` : ''}
`.trim();
}

/**
 * 7. Custom Manual Message (پیام دستی مدیر)
 */
export function buildManualTelegramText(
  text: string,
  party: Party,
  companySettings: CompanySettings
): string {
  const companyName = companySettings.name || 'شرکت تجارتی برادران نبوی';
  const companyPhone = companySettings.phone || '';

  return `
🏢 <b>${companyName}</b>
👤 <b>مخاطب:</b> محترم ${party.name}
━━━━━━━━━━━━━━━━━━━━
${text}
━━━━━━━━━━━━━━━━━━━━
${companyPhone ? `☎️ تماس با دفتر: <code>${companyPhone}</code>` : ''}
`.trim();
}

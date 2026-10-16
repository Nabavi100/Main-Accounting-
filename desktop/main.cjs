'use strict';

const { app, BrowserWindow, Menu, dialog, session, shell, screen, utilityProcess } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { APP_ID, DATA_DIRECTORY_NAME, BACKEND_HOST, BACKEND_PORT, APP_ORIGIN, AUTH_HEADER, PRODUCT_NAME, isAppUrl, isPrintUrl, isSafeExternalUrl, shouldAuthenticateRequest, safeDownloadName } = require('./runtime.cjs');
const publicFirebaseConfig = require('./firebase-public.json');

app.setName('Nabavi Accounting');
app.setAppUserModelId(APP_ID);
// A test must explicitly opt into a separate profile; never touch the installed user's data.
const userDataPath = process.env.NABAVI_DESKTOP_TEST_PROFILE && !app.isPackaged
  ? path.resolve(process.env.NABAVI_DESKTOP_TEST_PROFILE)
  : path.join(app.getPath('appData'), DATA_DIRECTORY_NAME);
fs.mkdirSync(userDataPath, { recursive: true });
app.setPath('userData', userDataPath);
fs.mkdirSync(path.join(userDataPath, 'browser'), { recursive: true });
app.setPath('sessionData', path.join(userDataPath, 'browser'));

let mainWindow = null;
let service = null;
let quitting = false;
const trustedContents = new Set();
const desktopToken = crypto.randomBytes(32).toString('hex');
const authHosts = new Set(['accounts.google.com', publicFirebaseConfig.authDomain].filter(Boolean));
const safeWindowOptions = { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: false };

function isAuthUrl(value) {
  try { return isSafeExternalUrl(value) && authHosts.has(new URL(value).hostname); }
  catch { return false; }
}

async function openExternal(value) {
  if (!isSafeExternalUrl(value)) return;
  const result = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'question', title: PRODUCT_NAME, message: 'بازکردن پیوند در مرورگر سیستم؟',
    detail: new URL(value).hostname, buttons: ['بازکردن', 'انصراف'], defaultId: 1, cancelId: 1,
  });
  if (result.response === 0) await shell.openExternal(value);
}

function secureWindow(window, authPopup = false) {
  const contents = window.webContents;
  const contentsId = contents.id;
  if (!authPopup) trustedContents.add(contentsId);
  contents.once('destroyed', () => trustedContents.delete(contentsId));
  contents.on('will-attach-webview', event => event.preventDefault());
  const guard = (event, value) => {
    if (isAppUrl(value)) { trustedContents.add(contents.id); return; }
    if (isPrintUrl(value)) return;
    if (window !== mainWindow && isAuthUrl(value)) { trustedContents.delete(contents.id); return; }
    event.preventDefault();
    void openExternal(value);
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);
  contents.setWindowOpenHandler(({ url }) => {
    if (isPrintUrl(url) || isAppUrl(url) || isAuthUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        title: PRODUCT_NAME, icon: path.join(__dirname, 'assets', 'icon.png'),
        width: 1080, height: 800, backgroundColor: '#f5f8fc', webPreferences: safeWindowOptions,
      } };
    }
    void openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', (child, details) => secureWindow(child, isAuthUrl(details.url)));
}

function openHelpFile(filename) {
  // Windows applications cannot open an OS editor on a virtual file inside ASAR.
  // Copy a versioned template once; never overwrite a report the user has edited.
  const directory = path.join(userDataPath, 'help', app.getVersion());
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, filename);
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(__dirname, filename), destination);
  void shell.openPath(destination);
}

function setNativeMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'فایل', submenu: [
      { label: 'پوشهٔ خروجی‌ها', click: () => { void shell.openPath(app.getPath('downloads')); } },
      { label: 'پوشهٔ داده‌های برنامه', click: () => { void shell.openPath(userDataPath); } },
      { type: 'separator' },
      { label: 'خروج', role: 'quit' },
    ] },
    { label: 'ویرایش', submenu: [
      { label: 'واگرد', role: 'undo' }, { label: 'انجام دوباره', role: 'redo' }, { type: 'separator' },
      { label: 'برش', role: 'cut' }, { label: 'کپی', role: 'copy' }, { label: 'چسباندن', role: 'paste' }, { label: 'انتخاب همه', role: 'selectAll' },
    ] },
    { label: 'نمایش', submenu: [
      { label: 'اندازهٔ اصلی', role: 'resetZoom' }, { label: 'بزرگ‌نمایی', role: 'zoomIn' }, { label: 'کوچک‌نمایی', role: 'zoomOut' },
      { type: 'separator' }, { label: 'تمام‌صفحه', role: 'togglefullscreen' },
    ] },
    { label: 'راهنما', submenu: [
      { label: 'راهنمای نصب و آزمایش', click: () => { openHelpFile('GUIDE-fa.txt'); } },
      { label: 'فرم گزارش ایراد', click: () => { openHelpFile('BUG-REPORT-fa.txt'); } },
      { type: 'separator' },
      { label: 'دربارهٔ برنامه', click: () => { void dialog.showMessageBox(mainWindow || undefined, {
        type: 'info', title: PRODUCT_NAME, message: PRODUCT_NAME,
        detail: `نسخهٔ آزمایشی ${app.getVersion()}\nویندوز ۱۰/۱۱ — ۶۴ بیتی\n\nنرم‌افزار برای بررسی و ثبت ایرادها آماده شده است؛ پیش از استفادهٔ واقعی، از اطلاعات پشتیبان بگیرید.\n\nداده‌ها روی همین کامپیوتر نگهداری می‌شوند. اتصال تلگرام و گوگل به اینترنت و تنظیمات حساب مربوط نیاز دارد.`,
      }); } },
    ] },
  ]));
}

async function waitForService() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_ORIGIN}/api/desktop/health`, {
        headers: { [AUTH_HEADER]: desktopToken }, redirect: 'error', signal: AbortSignal.timeout(1000),
      });
      const health = await response.json();
      if (response.ok && health.appId === APP_ID && health.version === app.getVersion()) return;
      throw new Error('Unexpected local application response.');
    } catch {
      if (!service) throw new Error('The local service exited before becoming ready.');
      await delay(200);
    }
  }
  throw new Error(`Local application service could not start on ${APP_ORIGIN}. Close any conflicting program and try again.`);
}

async function startApplication() {
  const serverData = path.join(userDataPath, 'server');
  fs.mkdirSync(serverData, { recursive: true });
  service = utilityProcess.fork(path.join(__dirname, 'server.cjs'), [], {
    serviceName: 'Nabavi Accounting Service',
    cwd: serverData,
    env: {
      ...process.env, NODE_ENV: 'production', PORT: String(BACKEND_PORT),
      ACCOUNTING_HOST: BACKEND_HOST, ACCOUNTING_DATA_DIR: serverData,
      ACCOUNTING_STATIC_DIR: path.join(app.getAppPath(), 'dist'),
      ACCOUNTING_DESKTOP_TOKEN: desktopToken, ACCOUNTING_DESKTOP_VERSION: app.getVersion(),
    },
    stdio: 'pipe',
  });
  // Drain pipes without writing Telegram credentials / financial data into desktop logs.
  service.stdout?.on('data', () => {});
  service.stderr?.on('data', () => {});
  service.on('exit', () => {
    service = null;
    if (!quitting && mainWindow) {
      dialog.showErrorBox(PRODUCT_NAME, 'سرویس داخلی متوقف شد. برنامه را ببندید و دوباره اجرا کنید. داده‌های ذخیره‌شده حذف نشده‌اند.');
      app.quit();
    }
  });
  await waitForService();

  const currentSession = session.defaultSession;
  currentSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(isAppUrl(contents.getURL()) && permission === 'clipboard-sanitized-write');
  });
  currentSession.setPermissionCheckHandler((contents, permission, origin) => {
    return Boolean(contents && isAppUrl(origin) && permission === 'clipboard-sanitized-write');
  });
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    title: PRODUCT_NAME, width: Math.min(1440, workArea.width), height: Math.min(960, workArea.height), minWidth: Math.min(900, workArea.width), minHeight: Math.min(640, workArea.height),
    show: false, backgroundColor: '#f5f8fc', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: safeWindowOptions,
  });
  currentSession.webRequest.onBeforeSendHeaders({ urls: [`${APP_ORIGIN}/*`] }, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    if (trustedContents.has(details.webContentsId) && shouldAuthenticateRequest(details, details.webContentsId)) requestHeaders[AUTH_HEADER] = desktopToken;
    callback({ requestHeaders });
  });
  currentSession.on('will-download', (_event, item) => {
    const filename = safeDownloadName(item.getFilename());
    if (!app.isPackaged && process.env.NABAVI_DESKTOP_TEST_DOWNLOAD_DIR) {
      item.setSavePath(path.join(process.env.NABAVI_DESKTOP_TEST_DOWNLOAD_DIR, filename));
    } else {
      const extension = path.extname(filename).slice(1);
      item.setSaveDialogOptions({
        title: 'ذخیرهٔ خروجی حسابداری', defaultPath: path.join(app.getPath('downloads'), filename),
        ...(extension ? { filters: [{ name: extension.toUpperCase(), extensions: [extension] }, { name: 'All files', extensions: ['*'] }] } : {}),
      });
    }
    item.once('done', (_doneEvent, state) => {
      if (state !== 'completed' && state !== 'cancelled' && !quitting) {
        dialog.showErrorBox(PRODUCT_NAME, 'ذخیرهٔ فایل کامل نشد. فضای دیسک و دسترسی پوشهٔ انتخابی را بررسی و دوباره تلاش کنید.');
      }
    });
  });
  secureWindow(mainWindow);
  setNativeMenu();
  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
  mainWindow.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !quitting) {
      dialog.showErrorBox(PRODUCT_NAME, 'بارگذاری برنامه انجام نشد. برنامه را ببندید و دوباره اجرا کنید.');
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; app.quit(); });
  await mainWindow.loadURL(`${APP_ORIGIN}/dashboard`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
  });
  app.whenReady().then(startApplication).catch(error => {
    dialog.showErrorBox(PRODUCT_NAME, `راه‌اندازی برنامه انجام نشد.\n\n${error.message}\n\nاگر برنامهٔ دیگری پورت ${BACKEND_PORT} را اشغال کرده، آن را ببندید. برنامه را همزمان در چند حساب ویندوز اجرا نکنید. داده‌های قبلی پاک نشده‌اند.`);
    app.quit();
  });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  quitting = true;
  if (app.isReady()) session.defaultSession.flushStorageData();
  if (service) { service.kill(); service = null; }
});

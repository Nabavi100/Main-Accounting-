'use strict';

// Keep both names stable between releases: Chromium financial storage is origin-scoped.
const APP_ID = 'af.nabavi.accounting';
const DATA_DIRECTORY_NAME = 'NabaviAccounting';
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 47653;
const APP_ORIGIN = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const AUTH_HEADER = 'x-nabavi-desktop-token';
const PRODUCT_NAME = 'حسابداری برادران نبوی';

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isPrintUrl(value) {
  return value === 'about:blank' || value.startsWith(`blob:${APP_ORIGIN}/`);
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function shouldAuthenticateRequest(details, mainContentsId) {
  if (details.webContentsId !== mainContentsId || !isAppUrl(details.url)) return false;
  if (details.resourceType === 'mainFrame') return true;
  // Inherited about:blank/srcdoc print frames are trusted only while all their
  // ancestors belong to this app. An external OAuth iframe never gets the token.
  try {
    let frame = details.frame;
    if (!frame) return isAppUrl(details.referrer || '');
    while (frame) {
      if (!isAppUrl(frame.url) && !isPrintUrl(frame.url) && frame.url !== 'about:srcdoc') return false;
      frame = frame.parent;
    }
    return true;
  } catch { return false; }
}

function safeDownloadName(filename) {
  // Keep Persian names, but exclude paths, device names and illegal Windows characters.
  let name = String(filename || '').split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `Nabavi-export-${name || 'file'}`;
  return name.slice(0, 180);
}

module.exports = { APP_ID, DATA_DIRECTORY_NAME, BACKEND_HOST, BACKEND_PORT, APP_ORIGIN, AUTH_HEADER, PRODUCT_NAME, isAppUrl, isPrintUrl, isSafeExternalUrl, shouldAuthenticateRequest, safeDownloadName };

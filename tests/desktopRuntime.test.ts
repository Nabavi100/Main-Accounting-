import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { APP_ORIGIN, APP_ID, DATA_DIRECTORY_NAME, isAppUrl, isPrintUrl, isSafeExternalUrl, shouldAuthenticateRequest, safeDownloadName } = require('../desktop/runtime.cjs');

test('desktop origin and data identity are stable across updates', () => {
  assert.equal(APP_ORIGIN, 'http://127.0.0.1:47653');
  assert.equal(APP_ID, 'af.nabavi.accounting');
  assert.equal(DATA_DIRECTORY_NAME, 'NabaviAccounting');
});
test('desktop navigation rejects lookalike origins, other ports and executable schemes', () => {
  for (const value of [`${APP_ORIGIN}/dashboard`, `${APP_ORIGIN}/assets/index.js`]) assert.equal(isAppUrl(value), true);
  for (const value of ['http://127.0.0.1:47654/', 'https://127.0.0.1:47653/', 'http://127.0.0.1.evil.test:47653/', 'file:///C:/Windows/cmd.exe', 'javascript:alert(1)', 'https://example.com/', 'not a URL', 'http://u:p@127.0.0.1:47653/']) assert.equal(isAppUrl(value), false);
});
test('only app-owned blank/blob documents are accepted for printing', () => {
  assert.equal(isPrintUrl('about:blank'), true);
  assert.equal(isPrintUrl(`blob:${APP_ORIGIN}/document`), true);
  assert.equal(isPrintUrl('blob:https://example.com/document'), false);
  assert.equal(isPrintUrl('data:text/html,hello'), false);
});
test('only credential-free HTTPS URLs can leave the desktop host', () => {
  assert.equal(isSafeExternalUrl('https://accounts.google.com/'), true);
  for (const value of ['file:///C:/x.exe', 'javascript:alert(1)', 'ms-excel:ofe|u|http://evil.test', 'http://example.com', 'https://user:pass@example.com']) assert.equal(isSafeExternalUrl(value), false);
});
test('the private backend token is limited to the owning renderer and origin', () => {
  const details = { webContentsId: 7, url: `${APP_ORIGIN}/api/telegram/config`, resourceType: 'xhr', frame: { url: `${APP_ORIGIN}/dashboard`, parent: null } };
  assert.equal(shouldAuthenticateRequest(details, 7), true);
  assert.equal(shouldAuthenticateRequest(details, 8), false);
  assert.equal(shouldAuthenticateRequest({ ...details, url: 'https://example.com/api' }, 7), false);
  assert.equal(shouldAuthenticateRequest({ ...details, frame: { url: 'https://accounts.google.com', parent: details.frame } }, 7), false);
});
test('print srcdoc ancestry is allowed without granting external iframes local API access', () => {
  const details = { webContentsId: 7, url: `${APP_ORIGIN}/assets/font.woff2`, resourceType: 'font', frame: { url: 'about:srcdoc', parent: { url: `${APP_ORIGIN}/dashboard`, parent: null } } };
  assert.equal(shouldAuthenticateRequest(details, 7), true);
  assert.equal(shouldAuthenticateRequest({ ...details, frame: { url: 'about:srcdoc', parent: { url: 'https://external.test', parent: details.frame.parent } } }, 7), false);
});
test('Persian export filenames are retained but Windows paths and device names are not', () => {
  assert.equal(safeDownloadName('گزارش فروش.xlsx'), 'گزارش فروش.xlsx');
  assert.equal(safeDownloadName('../../گزارش.pdf'), 'گزارش.pdf');
  assert.equal(safeDownloadName('C:\\temp\\report.xlsx'), 'report.xlsx');
  assert.equal(safeDownloadName('CON.pdf'), 'Nabavi-export-CON.pdf');
  assert.equal(safeDownloadName('bad:name?.xlsx'), 'bad_name_.xlsx');
});

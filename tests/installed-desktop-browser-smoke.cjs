/* Windows-only: silently install and check the real ASAR-packaged, fused executable. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright');
const { APP_ORIGIN } = require('../desktop/runtime.cjs');
const pkg = require('../package.json');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'out', 'desktop-test-artifacts');
const installer = path.join(root, 'desktop-release', `Nabavi-Accounting-${pkg.version}-Setup-x64.exe`);
let running;
let browser;

function findExecutable(directory, depth = 0) {
  if (depth > 4 || !fs.existsSync(directory)) return null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === 'Nabavi Accounting.exe') return file;
    if (entry.isDirectory()) { const found = findExecutable(file, depth + 1); if (found) return found; }
  }
  return null;
}
function completed(process, timeout = 120000) {
  return new Promise((resolve, reject) => {
    if (process.exitCode !== null) return process.exitCode === 0 ? resolve() : reject(new Error(`Process exited ${process.exitCode}`));
    const timer = setTimeout(() => { process.kill(); reject(new Error('Process exit timeout')); }, timeout);
    process.once('error', error => { clearTimeout(timer); reject(error); });
    process.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Process exited ${code}`)); });
  });
}
async function launch(executable) {
  running = spawn(executable, ['--remote-debugging-port=48729', '--remote-debugging-address=127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  running.stdout.on('data', () => {}); running.stderr.on('data', () => {});
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    assert.equal(running.exitCode, null, 'Installed executable exited unexpectedly');
    try {
      const response = await fetch('http://127.0.0.1:48729/json/version', { signal: AbortSignal.timeout(750) });
      if (response.ok) break;
    } catch { /* wait for Chromium's own debugging endpoint */ }
    await delay(200);
  }
  browser = await chromium.connectOverCDP('http://127.0.0.1:48729');
  const context = browser.contexts()[0];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== APP_ORIGIN) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return route.continue();
  });
  const deadlinePage = Date.now() + 20000;
  let page;
  while (Date.now() < deadlinePage) {
    page = context.pages().find(page => page.url().startsWith(APP_ORIGIN));
    if (page) break;
    await delay(100);
  }
  assert.ok(page, 'The installed application did not open its main window');
  page.setDefaultTimeout(20000);
  await page.locator('#login-password-input').waitFor();
  return page;
}
async function closeApplication(page) {
  const process = running;
  await page.evaluate(() => window.close()).catch(() => {});
  await completed(process, 20000);
  running = null;
  await browser?.close().catch(() => {}); browser = null;
}

(async () => {
  assert.equal(process.platform, 'win32', 'This test requires the actual Windows build runner');
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    const installation = spawn(installer, ['/S', '/currentuser'], { stdio: 'inherit' });
    await completed(installation);
    const executable = findExecutable(path.join(process.env.LOCALAPPDATA, 'Programs'));
    assert.ok(executable, 'The NSIS installer did not install the application');
    // Silent setup is not supposed to auto-launch the UI. If it did, close that exact
    // test executable so the next launch can supply a renderer-only CDP switch.
    const cleanup = spawn('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Name 'Nabavi Accounting' -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }; exit 0`], { stdio: 'ignore' });
    await completed(cleanup); await delay(1500);
    let page = await launch(executable);
    await page.locator('#login-password-input').fill('123');
    await page.locator('#login-submit-button').click(); await page.locator('.dash-quick').waitFor();
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal((await fetch(`${APP_ORIGIN}/api/desktop/health`)).status, 403);
    const health = await page.evaluate(() => fetch('/api/desktop/health').then(response => response.json()));
    assert.equal(health.version, pkg.version);
    assert.equal(await page.locator('#sidebar-group-trade').innerText(), 'بازرگانی و مالی');
    assert.equal(await page.locator('#sidebar-group-treasury').innerText(), 'دریافت و پرداخت');
    await page.evaluate(() => localStorage.setItem('NABAVI_INSTALLED_RESTART_TEST', 'persisted'));
    await page.screenshot({ path: path.join(artifacts, 'installed-windows-application.png'), fullPage: false });
    await closeApplication(page);
    page = await launch(executable);
    assert.equal(await page.evaluate(() => localStorage.getItem('NABAVI_INSTALLED_RESTART_TEST')), 'persisted');
    await closeApplication(page);
    console.log('PASS: real Windows NSIS install, installed ASAR + native backend launch, renderer isolation, initial login, private API, compact labels, clean shutdown and persistent data across restart.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (running) running.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

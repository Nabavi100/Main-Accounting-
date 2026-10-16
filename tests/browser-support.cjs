const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const req = createRequire(path.join(process.cwd(), "package.json"));
const { chromium: playwright } = req("playwright");
const baseURL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const origin = new URL(baseURL).origin;
async function launch() {
  if (process.env.CHROMIUM_EXECUTABLE)
    return playwright.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      headless: true,
      args: ["--no-sandbox"],
    });
  try {
    return await playwright.launch({ headless: true });
  } catch {
    const sp = req("@sparticuz/chromium");
    let root = path.dirname(req.resolve("@sparticuz/chromium"));
    while (
      !fs.existsSync(path.join(root, "bin/al2023.tar.br")) &&
      root !== path.dirname(root)
    )
      root = path.dirname(root);
    if (sp.inflate) {
      await sp.inflate(path.join(root, "bin/al2023.tar.br"));
      sp.setupLambdaEnvironment("/tmp/al2023/lib");
    }
    const c = sp.default || sp;
    return playwright.launch({
      executablePath: await c.executablePath(),
      args: c.args.filter((arg) => arg !== "--single-process"),
      headless: true,
    });
  }
}
async function preparePage(page, errors) {
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin)
      return route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      });
    if (url.pathname.startsWith("/api/telegram/"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          isConfigured: false,
          isPolling: false,
          pendingUsers: [],
          pendingCount: 0,
          botToken: "",
        }),
      });
    return route.continue();
  });
  return page;
}
async function pageFor(
  browser,
  errors,
  viewport = { width: 1908, height: 980 },
) {
  const context = await browser.newContext({
    viewport,
    locale: "fa-AF",
    timezoneId: "Asia/Kabul",
  });
  return preparePage(await context.newPage(), errors);
}
async function login(page) {
  await page.goto(baseURL + "/dashboard", { waitUntil: "networkidle" });
  await page.locator("#login-password-input").fill("123");
  await page.locator("#login-submit-button").click();
  await page.locator(".dash-quick").waitFor();
}
const storagePrefix = "AFGHAN_ACCOUNTING_DATA_V2_";
const readData = (page, suffix) =>
  page.evaluate(
    ({ prefix, suffix }) =>
      JSON.parse(localStorage.getItem(prefix + suffix) || "null"),
    { prefix: storagePrefix, suffix },
  );
/** Follow the real sidebar shortcut or shared-center button; never add hidden compatibility links. */
async function clickSidebarPage(page, id, group) {
  await page.locator('.workspace-navigation').waitFor().catch(async error => {
    console.error('Workspace navigation unavailable:', page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 5000));
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'accounting-navigation-unavailable.png'), animations: 'disabled' }).catch(() => {});
    throw error;
  });
  const destination = await page.evaluate(async ({ id, groupId }) => {
    const { workspacePageGroups, workspacePageKey } = await import('/src/utils/navigation.ts');
    const group = workspacePageGroups().find(group => group.id === groupId);
    const item = group?.items.find(item => `sidebar-page-${item.id}` === id);
    const landing = group?.landingPage;
    return item ? { hidden: item.inSidebar === false, pageId: item.id, key: workspacePageKey(item.tab, item.filter) }
      : landing && id === `sidebar-group-${groupId}` ? { landing: true, label: landing.label, key: workspacePageKey(landing.tab, landing.filter) } : null;
  }, { id, groupId: group });
  const toggle = page.locator('.workspace-menu-toggle');
  const closeDrawer = async () => {
    if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'true')
      await page.locator('#workspace-sidebar .workspace-sidebar-close').click();
  };
  if (destination?.hidden || destination?.landing) {
    const center = page.locator(`[data-workspace-center="${group}"]`);
    if (!await center.count()) {
      if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      const header = page.locator(`#sidebar-group-${group}`);
      if (await header.getAttribute('aria-expanded') === 'true') await header.click();
      await header.click();
      await center.waitFor();
    }
    await closeDrawer();
    if (destination.hidden) {
      if (destination.pageId.startsWith('legacy-')) {
        const more = page.locator(`#${group}-center-more-toggle`);
        if (await more.getAttribute('aria-expanded') !== 'true') await more.click();
      }
      await page.locator(`#${group}-center-page-${destination.pageId}`).click();
    } else if (await page.locator('[data-workspace-page]').getAttribute('data-workspace-page') !== destination.key) {
      // Reopening the current accordion intentionally retains its draft. Use the real
      // global navigation search when the center's overview itself is requested.
      const search = page.locator('#workspace-global-search');
      await search.fill(destination.label); await search.press('Enter');
    }
    await page.waitForFunction(key => document.querySelector('[data-workspace-page]')?.getAttribute('data-workspace-page') === key, destination.key);
    return;
  }
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  if (group) {
    const separate = page.locator(`#sidebar-group-toggle-${group}`);
    const header = await separate.count() ? separate : page.locator(`#sidebar-group-${group}`);
    if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
  }
  await page.locator(`#${id}`).click();
  await page.waitForFunction(id => document.getElementById(id)?.getAttribute('aria-current') === 'page', id);
  await page.locator('.workspace-page-view').waitFor();
}
async function navigateSidebar(page, label) {
  const target = await page.evaluate(async label => {
    const { workspacePageGroups } = await import('/src/utils/navigation.ts');
    for (const group of workspacePageGroups()) {
      if (group.landingPage && [group.landingPage.label, group.landingCaption, group.label].includes(label)) return { id: `sidebar-group-${group.id}`, group: group.id };
      const item = group.items.find(item => item.label === label);
      if (item) return { id: `sidebar-page-${item.id}`, group: group.id };
    }
  }, label);
  if (!target) throw new Error(`Unknown workspace destination: ${label}`);
  await clickSidebarPage(page, target.id, target.group);
}
/** Appearance remains available from the account menu without occupying the header search slot. */
async function openAppearanceSettings(page) {
  const profile = page.locator('#workspace-profile-toggle');
  if (await profile.getAttribute('aria-expanded') !== 'true') await profile.click();
  await page.locator('.workspace-profile-dropdown').getByRole('button', { name: 'تنظیمات ظاهر', exact: true }).click();
  await page.locator('dialog.appearance-dialog').waitFor();
}
const rgb = (hex) =>
  `rgb(${hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => parseInt(value, 16))
    .join(", ")})`;
module.exports = {
  launch,
  pageFor,
  preparePage,
  login,
  readData,
  rgb,
  baseURL,
  storagePrefix,
  clickSidebarPage,
  navigateSidebar,
  openAppearanceSettings,
};

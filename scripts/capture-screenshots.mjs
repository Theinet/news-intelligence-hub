import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.APP_URL ?? 'http://localhost:5173';
const email = process.env.DEMO_EMAIL ?? 'demo@example.com';
const password = process.env.DEMO_PASSWORD ?? 'Password123!';
const outDir = path.resolve('docs/screenshots');

async function launchBrowser() {
  const launchOptions = [
    {channel: 'chrome'},
    {channel: 'msedge'},
    {},
  ];
  let lastError;

  for (const options of launchOptions) {
    try {
      return await chromium.launch({headless: true, ...options});
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function clickNav(page, label) {
  await page.getByRole('button', {name: new RegExp(label, 'i')}).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
}

async function screenshot(page, fileName) {
  await page.screenshot({
    path: path.join(outDir, fileName),
    fullPage: true,
  });
}

await mkdir(outDir, {recursive: true});

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: {width: 1440, height: 900},
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);

await page.goto(baseUrl, {waitUntil: 'networkidle'});

const loginButton = page.getByRole('button', {name: /^login$/i});
if (!(await loginButton.isVisible().catch(() => false))) {
  const useExisting = page.getByText(/use existing account/i);
  if (await useExisting.isVisible().catch(() => false)) {
    await useExisting.click();
  }
}

if (await loginButton.isVisible().catch(() => false)) {
  await page.locator('input').nth(0).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await loginButton.click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: /articles/i}).waitFor();
}

await clickNav(page, 'Articles');
await screenshot(page, 'articles.png');

const firstArticle = page.getByText('Microsoft ships new AI runtime for developers').first();
if (await firstArticle.isVisible().catch(() => false)) {
  await firstArticle.click();
  await page.waitForTimeout(500);
}
await screenshot(page, 'article-detail.png');

await clickNav(page, 'Graph');
await page.locator('.react-flow').waitFor();
await screenshot(page, 'graph.png');

await clickNav(page, 'Settings');
await screenshot(page, 'settings.png');

await clickNav(page, 'Digests');
await screenshot(page, 'digests.png');

await clickNav(page, 'Telemetry');
await screenshot(page, 'telemetry.png');

await browser.close();

console.log(`Screenshots saved to ${outDir}`);

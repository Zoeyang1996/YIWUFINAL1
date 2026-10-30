// Requires a local static server and Playwright; uses installed Chrome, no browser download.
// node scripts/asset-tools/browser-check.mjs --url http://127.0.0.1:4173 --output .preview-check/browser
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:4173' }, output: { type: 'string', default: '.preview-check/browser' },
  originals: { type: 'string' }, playwright: { type: 'string', default: 'playwright-core' }, chrome: { type: 'string', default: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
} });
const { chromium } = await import(values.playwright);
await fs.mkdir(values.output, { recursive: true });
const browser = await chromium.launch({ executablePath: values.chrome, headless: true,
  args: ['--headless=new', '--use-angle=metal'] });
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    if (values.originals) await context.route('**/*.glb*', async route => {
      const file = path.join(values.originals, decodeURI(new URL(route.request().url()).pathname));
      try {
        await fs.access(file);
        // Stream large baseline GLBs through HTTP instead of copying them through CDP.
        await route.continue({ url: `${values.url}/${values.originals}/${new URL(route.request().url()).pathname.replace(/^\//, '')}` });
      }
      catch { await route.continue(); }
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    const mode = mobile ? 'mobile' : 'desktop';
    for (const phase of ['overview', 'morning', 'noon', 'night']) {
      console.log(`Loading ${mode}/${phase}...`);
      const started = Date.now();
      await page.goto(`${values.url}/${phase === 'overview' ? 'index.html' : `market.html?phase=${phase}`}`, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForSelector(phase === 'overview' ? '#curtain.is-done' : '#marketLoading.is-done', { state: 'attached', timeout: 120000 });
      } catch (error) {
        console.error(errors);
        await page.screenshot({ path: path.join(values.output, `${mode}-${phase}-failure.png`) });
        console.error(await page.locator('body').innerText());
        throw error;
      }
      const readyMs = Date.now() - started;
      await page.waitForTimeout(1200);
      const metrics = await page.evaluate(async () => {
        const samples = []; let last = performance.now(); const start = last;
        await new Promise(resolve => {
          function frame(now) { samples.push(now - last); last = now; if (now - start < 2500) requestAnimationFrame(frame); else resolve(); }
          requestAnimationFrame(frame);
        });
        samples.shift(); samples.sort((a, b) => a - b);
        const canvas = document.querySelector('canvas');
        return { medianFrameMs: samples[Math.floor(samples.length * .5)], p95FrameMs: samples[Math.floor(samples.length * .95)],
          canvas: [canvas.width, canvas.height], glbBytes: performance.getEntriesByType('resource').filter(r => /\.glb|\/packed\//.test(r.name)).reduce((sum, r) => sum + r.encodedBodySize, 0) };
      });
      await page.screenshot({ path: path.join(values.output, `${mode}-${phase}.png`) });
      if (phase !== 'overview') {
        await page.locator('#shopDirectory summary').click();
        const buttons = page.locator('.directory-list button');
        assert.equal(await buttons.count(), 3);
        for (let i = 0; i < 3; i++) {
          if (i) await page.locator('#shopDirectory summary').click();
          const name = await buttons.nth(i).textContent();
          await buttons.nth(i).click();
          await page.waitForSelector('#stallPanel[aria-hidden="false"]', { timeout: 30000 });
          await page.screenshot({ path: path.join(values.output, `${mode}-${phase}-shop-${i}.png`) });
          if (i === 0) {
            await page.locator('[data-act="open"]').first().click();
            await page.waitForSelector('.product-overlay:not([hidden]) .product-loading[hidden]', { state: 'attached', timeout: 30000 });
            await page.screenshot({ path: path.join(values.output, `${mode}-${phase}-product.png`) });
            await page.locator('.product-close').click();
          }
          await page.locator('.panel-close').click();
          await page.waitForSelector('#stallPanel[aria-hidden="true"]', { state: 'attached' });
          console.log(`${mode}/${phase}/${name}: pass`);
        }
        await page.keyboard.down('ArrowUp'); await page.waitForTimeout(600); await page.keyboard.up('ArrowUp');
      }
      assert.deepEqual(errors, [], `${mode}/${phase}: browser errors`);
      const result = { mode, phase, readyMs, ...metrics, errors: [...errors] };
      results.push(result); console.log(JSON.stringify(result));
    }
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(values.output, 'results.json'), JSON.stringify(results, null, 2));
}

const { chromium, expect } = require('../web/node_modules/@playwright/test');
const { readFileSync } = require('node:fs');
const { parseEnv } = require('node:util');
const path = require('node:path');

// Start `python3 -m http.server 8087 --bind 127.0.0.1` at the repo root.
// --deployed checks the password-protected preview without printing credentials.
const deployed = process.argv.includes('--deployed');
const access = deployed ? parseEnv(readFileSync(path.join(__dirname, '../deploy/.env.preview-access'), 'utf8')) : null;
const baseURL = access?.PREVIEW_URL || 'http://127.0.0.1:8087';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [768, 1024], [390, 844], [375, 667], [320, 568]]) {
      const page = await browser.newPage({
        baseURL, viewport: { width, height }, reducedMotion: 'reduce',
        ...(access ? { httpCredentials: { username: access.PREVIEW_USER, password: access.PREVIEW_PASSWORD } } : {}),
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
      await expect(page.locator('header [data-account]')).toHaveAttribute('href', /\/home$/);
      // The landing page shows the confirmed dates and venue, and no offer.
      await expect(page.locator('#details .event-facts')).toContainText('24–25 October 2026');
      await expect(page.locator('#details .event-facts')).toContainText('Nerul Gymkhana');
      await expect(page.locator('main')).not.toContainText(/Early bird/);
      await expect(page.locator('.hero-copy > .eyebrow')).toHaveText('TENNIS. CONNECTED.');
      const sections = page.locator('main > section');
      await expect(sections).toHaveCount(7);
      if (width >= 1280) {
        const prizeHeight = await page.locator('#prizes').evaluate(element => element.getBoundingClientRect().height);
        expect(prizeHeight, 'Prize section fits one desktop fold').toBeLessThanOrEqual(height + 2);
      }
      const geometry = await sections.evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect();
        return { id: element.id || 'hero', top: box.top + scrollY, height: box.height, overflow: element.scrollHeight > element.clientHeight + 2 };
      }));
      geometry.forEach((section, index) => {
        const previousEnd = index ? geometry[index - 1].top + geometry[index - 1].height : 0;
        expect(Math.abs(section.top - previousEnd), `${width}: ${section.id} continuity`).toBeLessThanOrEqual(2);
        expect(section.height, `${width}: ${section.id} visible`).toBeGreaterThan(0);
        expect(section.overflow, `${width}: ${section.id} clipping`).toBe(false);
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      // Existing interactions must remain usable within the reflowed layout.
      await page.locator('.coach-background summary').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.coach-background')).toHaveAttribute('open', '');
      await expect(page.locator('.coach-background p').first()).toBeVisible();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Next coach photo' }).click();
      await expect(page.locator('#coach-count')).toHaveText('02 / 04');
      await page.locator('#sponsors [data-open-sponsor]').click();
      await expect(page.locator('#sponsor-dialog')).toBeVisible();
      await expect(page.locator('#sponsor-form')).toHaveAttribute('action', /script\.google\.com/);
      await expect(page.locator('#sponsor-form button[type="submit"]')).toBeEnabled();
      await page.locator('#sponsor-dialog [data-close-sponsor]').first().click();
      expect(errors).toEqual([]);
      console.log(`PASS ${width}×${height}: seven sections, no clipping/overflow; biography, carousel and sponsor dialog work.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

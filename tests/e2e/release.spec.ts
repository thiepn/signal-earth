import { expect, test } from '@playwright/test';

test('packaged release identity matches the UI and service worker @production', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One browser is enough for static release identity certification.');

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible();

  const releaseResponse = await page.request.get('./release.json');
  expect(releaseResponse.ok()).toBe(true);
  const release = await releaseResponse.json() as { name?: string; version?: string; commit?: string };
  expect(release.name).toBe('Signal Earth');
  expect(release.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  expect(release.commit).toMatch(/^(?:local|[0-9a-f]{40})$/i);

  const swResponse = await page.request.get('./sw.js');
  expect(swResponse.ok()).toBe(true);
  const sw = await swResponse.text();
  expect(sw).toContain(`const CACHE_VERSION = 'signal-earth-${release.version}'`);
  expect(sw).not.toContain('__SIGNAL_EARTH_CACHE_VERSION__');
  expect(sw).not.toContain('__SIGNAL_EARTH_PRECACHE__');

  await page.getByRole('button', { name: 'Open settings' }).click();
  const releaseSection = page.locator('.settings-section').filter({ hasText: 'Release tools' });
  await expect(releaseSection.locator('.quality-pill')).toHaveText(`V${release.version}`);
});

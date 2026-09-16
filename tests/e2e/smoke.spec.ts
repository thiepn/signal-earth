import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

function isNarrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 10_000) <= 760;
}

test.beforeEach(async ({ page, browserName }) => {
  if (browserName !== 'chromium') return;

  // Hosted Linux Chromium renders Signal Earth's WebGL scene through software
  // (SwiftShader). Synthetic high-end CPU/memory hints can therefore select a
  // quality profile the runner cannot render responsively. Constrain only those
  // hardware hints so the product exercises its real Auto/low-quality path;
  // viewport, device emulation, UI, providers and interaction coverage remain
  // unchanged.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      get: () => 2,
    });
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      get: () => 2,
    });
  });
});

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function boot(page: Page): Promise<void> {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Signal Earth globe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search Signal Earth' })).toBeVisible();
}

async function expectViewportContained(page: Page): Promise<void> {
  const result = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 2);
}

async function expectElementInViewport(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function closeBottomSheet(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close panel' }).click();
  await expect(dialog).toBeHidden();
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open settings' }).click();
  if (isNarrow(page)) {
    await expect(page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Display' }) })).toBeVisible();
  } else {
    await expect(page.locator('.desktop-settings')).toContainText('Display');
  }
  await expect(page.getByText('Earth view', { exact: true })).toBeVisible();
}

async function closeSettings(page: Page): Promise<void> {
  if (isNarrow(page)) await closeBottomSheet(page);
  else {
    const closeButton = page.getByRole('button', { name: 'Close settings' });
    await expect(closeButton).toBeVisible();
    await closeButton.click({ force: true });
    await expect(page.locator('.desktop-settings')).toBeHidden();
  }
}

async function openMobileDock(page: Page, name: string, heading: RegExp | string): Promise<void> {
  const dock = page.getByRole('navigation', { name: 'Signal Earth controls' });
  await expectElementInViewport(page, dock);
  const button = dock.getByRole('button', { name: new RegExp(name, 'i') });
  await expectElementInViewport(page, button);
  await button.click();
  await expect(page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: heading }) })).toBeVisible();
}

test('shell boots without viewport overflow @production', async ({ page }, testInfo) => {
  const pageErrors = collectPageErrors(page);
  await boot(page);
  await expectViewportContained(page);

  if (isNarrow(page)) {
    const dock = page.getByRole('navigation', { name: 'Signal Earth controls' });
    await expectElementInViewport(page, dock);
    for (const button of await dock.getByRole('button').all()) {
      await expectElementInViewport(page, button);
    }
  }

  expect(pageErrors, `${testInfo.project.name} emitted uncaught page errors`).toEqual([]);
});

test('search opens from keyboard and navigates to a bundled city @production', async ({ page }, testInfo) => {
  const pageErrors = collectPageErrors(page);
  await boot(page);
  await page.keyboard.press('/');

  const searchDialog = page.getByRole('dialog', { name: 'Search and commands' });
  await expect(searchDialog).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Search Signal Earth' });
  await expect(input).toBeFocused();
  await input.fill('Tokyo');
  const tokyo = page.getByRole('option').filter({ hasText: /Tokyo/i }).first();
  await expect(tokyo).toBeVisible();
  await tokyo.click();
  await expect(searchDialog).toBeHidden();

  if (isNarrow(page)) {
    await openMobileDock(page, 'Inspect', /Tokyo/i);
    await closeBottomSheet(page);
  } else {
    await expect(page.locator('.desktop-right')).toContainText(/Tokyo/i);
  }

  expect(pageErrors, `${testInfo.project.name} emitted uncaught page errors`).toEqual([]);
});

test('primary panels remain reachable and dismissible @production', async ({ page }, testInfo) => {
  // This intentionally exercises every primary mobile sheet in one session.
  // SwiftShader on hosted Chromium is much slower than physical mobile GPUs,
  // so preserve strict per-action timeouts while allowing the full sweep to finish.
  test.setTimeout(120_000);

  const pageErrors = collectPageErrors(page);
  await boot(page);

  if (isNarrow(page)) {
    await openMobileDock(page, 'Now', 'What matters now');
    await closeBottomSheet(page);
    await openMobileDock(page, 'Layers', 'Layers');
    await closeBottomSheet(page);
    await openMobileDock(page, 'Here', 'Above Me');
    await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
    await closeBottomSheet(page);
    await openMobileDock(page, 'Time', 'Time');
    await closeBottomSheet(page);
    await openMobileDock(page, 'Inspect', 'Selection');
    await closeBottomSheet(page);
  } else {
    await page.getByRole('button', { name: 'Open Signal Earth Now' }).click();
    await expect(page.locator('.desktop-now')).toContainText('What matters now');
    await page.getByRole('button', { name: 'Close Signal Earth Now' }).click();

    await page.getByRole('button', { name: 'Open Above Me' }).click();
    await expect(page.locator('.desktop-here')).toContainText('Above Me');
    await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Above Me' }).click();
  }

  await openSettings(page);
  const nightMode = page.locator('.visual-mode-card').filter({ hasText: 'Night' });
  await expect(nightMode).toBeVisible();
  await nightMode.click();
  await expect(nightMode).toHaveAttribute('aria-pressed', 'true');
  await closeSettings(page);

  await page.keyboard.press('b');
  await expect(page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Planetary Briefings' }) })).toBeVisible();
  await page.getByRole('button', { name: 'Close briefings' }).click();

  expect(pageErrors, `${testInfo.project.name} emitted uncaught page errors`).toEqual([]);
});

test('global shortcuts do not hijack focused controls @production', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Shortcut focus behavior only needs one browser engine.');
  await boot(page);
  const playback = page.locator('.desktop-timeline').getByRole('button', { name: /Pause time|Play time/ });
  const initialLabel = await playback.getAttribute('aria-label');
  expect(initialLabel).toBeTruthy();

  const settings = page.getByRole('button', { name: 'Open settings' });
  await settings.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.desktop-settings')).toBeVisible();
  await expect(playback).toHaveAttribute('aria-label', initialLabel!);
});

test('query navigations do not accumulate duplicate runtime shell entries @production', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium-desktop', 'Service-worker cache audit runs once in Chromium desktop.');
  await boot(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto('./?audit_nav=one', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.goto('./?audit_nav=two', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible();

  const cachedAuditNavigations = await page.evaluate(async () => {
    const matches: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.endsWith('-runtime')) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (url.origin === location.origin && url.searchParams.has('audit_nav')) matches.push(url.href);
      }
    }
    return matches;
  });
  expect(cachedAuditNavigations).toEqual([]);
});

test('timeline controls keep deterministic interaction state @production', async ({ page }) => {
  await boot(page);
  let scope = page.locator('.desktop-timeline');
  if (isNarrow(page)) {
    await openMobileDock(page, 'Time', 'Time');
    scope = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Time' }) });
  }

  const ranges = scope.getByRole('group', { name: 'Historical timeline range' });
  const week = ranges.getByRole('button', { name: '7D' });
  await week.click();
  await expect(week).toHaveAttribute('aria-pressed', 'true');

  const playback = scope.getByRole('button', { name: /Pause time|Play time/ });
  const initialLabel = await playback.getAttribute('aria-label');
  await playback.click();
  if (initialLabel === 'Pause time') await expect(scope.getByRole('button', { name: 'Play time' })).toBeVisible();
  else await expect(scope.getByRole('button', { name: 'Pause time' })).toBeVisible();

  await scope.getByRole('button', { name: /LIVE/ }).click();
  await expect(scope.getByRole('button', { name: /LIVE/ })).toHaveAttribute('aria-pressed', 'true');

  if (isNarrow(page)) await closeBottomSheet(page);
});

test('Saved Worlds can create and delete a local preset @production', async ({ page }) => {
  await boot(page);
  await openSettings(page);

  const nameInput = page.getByLabel('Name this view');
  await nameInput.fill('QA World');
  await page.getByRole('button', { name: 'Save current world' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Saved locally as “QA World”/ })).toBeVisible();
  const world = page.locator('.saved-world-card').filter({ hasText: 'QA World' });
  await expect(world).toBeVisible();
  await world.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Deleted “QA World”/ })).toBeVisible();
  await expect(world).toBeHidden();

  await closeSettings(page);
});

test('system reduced-motion preference is reflected in settings @production', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  await openSettings(page);
  const motionSection = page.locator('.settings-section').filter({ hasText: 'Motion' });
  await expect(motionSection.locator('.quality-pill')).toHaveText('REDUCED');
  await closeSettings(page);
});

test('external provider failures do not take down the observatory', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Provider failure isolation only needs one browser engine.');
  const base = new URL(String(testInfo.project.use.baseURL));
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === base.origin) await route.continue();
    else await route.abort('failed');
  });

  const pageErrors = collectPageErrors(page);
  await boot(page);
  await page.getByRole('button', { name: 'Open Signal Earth Now' }).click();
  await expect(page.locator('.desktop-now')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search Signal Earth' })).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByRole('dialog', { name: 'Search and commands' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(pageErrors).toEqual([]);
});

test('offline reopening preserves shell and already-used lazy tools', async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'One service-worker-capable browser engine is enough for offline acceptance.');
  test.skip(!/chromium-desktop/.test(testInfo.project.name), 'Run once on the standard desktop project.');

  await boot(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Reset Signal Earth globe' })).toBeVisible();

  await page.keyboard.press('/');
  await expect(page.getByRole('dialog', { name: 'Search and commands' })).toBeVisible();
  await page.keyboard.press('Escape');
  await openSettings(page);
  await closeSettings(page);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Reset Signal Earth globe' })).toBeVisible();
    await page.keyboard.press('/');
    await expect(page.getByRole('dialog', { name: 'Search and commands' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('mobile orientation changes keep controls inside the viewport', async ({ page }, testInfo) => {
  test.skip(!/android-chromium|ios-webkit/.test(testInfo.project.name), 'Orientation scenario applies to phone projects.');
  await boot(page);
  await expectViewportContained(page);

  await page.setViewportSize({ width: 844, height: 390 });
  await expectElementInViewport(page, page.getByRole('button', { name: 'Search Signal Earth' }));
  await expectViewportContained(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectElementInViewport(page, page.getByRole('navigation', { name: 'Signal Earth controls' }));
  await expectViewportContained(page);
});

test.describe('lazy chunk failure containment', () => {
  // Production service workers pre-cache lazy chunks. Block them only for these
  // synthetic network-failure tests so Playwright can deterministically abort
  // the requested module instead of receiving it from the service-worker cache.
  test.use({ serviceWorkers: 'block' });

  test('rejected Search lazy chunk is contained instead of crashing the app', async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.QA_BASE_URL), 'Chunk-failure injection is only for the local production build.');
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Chunk-failure containment is engine-independent.');
    await page.route('**/SearchOverlayImpl-*.js', (route) => route.abort('failed'));
    await boot(page);
    await page.getByRole('button', { name: 'Search Signal Earth' }).click();
    await expect(page.getByRole('alert')).toContainText(/Search.*failed to load/i);
    await expect(page.getByRole('button', { name: 'Reset Signal Earth globe' })).toBeVisible();
  });

  test('rejected globe chunk leaves the application shell recoverable', async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.QA_BASE_URL), 'Chunk-failure injection is only for the local production build.');
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Critical chunk containment is engine-independent.');
    await page.route('**/GlobeViewportBase-*.js', (route) => route.abort('failed'));
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Reset Signal Earth globe' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/3D globe.*failed to load/i);
    await page.getByRole('button', { name: 'Search Signal Earth' }).click();
    await expect(page.getByRole('dialog', { name: 'Search and commands' })).toBeVisible();
  });
});

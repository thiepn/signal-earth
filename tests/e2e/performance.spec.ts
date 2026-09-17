import { expect, test } from '@playwright/test';

test('capable desktop does not boot into emergency-resolution rendering @performance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Visual-resolution gate runs once on Chromium desktop.');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 });
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1_500);
  const ratio = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 ? (element as HTMLCanvasElement).width / rect.width : 0;
  });
  expect(ratio).toBeGreaterThanOrEqual(0.9);
});

test('runtime frame cadence stays responsive and UI avoids live backdrop blur @performance', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Runtime cadence gate runs once on Chromium desktop.');
  test.setTimeout(35_000);

  // CI Chromium uses software WebGL. Pin the product to its real constrained
  // Auto path so this is a stable regression baseline rather than a runner-CPU lottery.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
  });

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(6_000);

  const surfaceSelectors = ['.top-bar', '.desktop-left .panel-surface', '.desktop-timeline .timeline-bar'];
  const compositing = await page.evaluate((selectors) => selectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, value: 'missing' };
    const style = getComputedStyle(element);
    return { selector, value: style.getPropertyValue('backdrop-filter') || style.getPropertyValue('-webkit-backdrop-filter') || 'none' };
  }), surfaceSelectors);
  for (const item of compositing) {
    expect(item.value.trim(), `${item.selector} must not blur the animated WebGL canvas`).toBe('none');
  }

  await page.keyboard.press('/');
  await expect(page.getByRole('dialog', { name: 'Search and commands' })).toBeVisible();
  const scrimFilter = await page.locator('.search-scrim').evaluate((element) => {
    const style = getComputedStyle(element);
    return style.getPropertyValue('backdrop-filter') || style.getPropertyValue('-webkit-backdrop-filter') || 'none';
  });
  expect(scrimFilter.trim()).toBe('none');
  await page.keyboard.press('Escape');

  const cadence = await page.evaluate(async () => {
    const deltas: number[] = [];
    const startedAt = performance.now();
    let previous = startedAt;
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const delta = now - previous;
        previous = now;
        if (delta > 0 && delta < 250) deltas.push(delta);
        if (now - startedAt >= 5_000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...deltas].sort((a, b) => a - b);
    const average = deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length);
    const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 999;
    const longFrames = deltas.filter((value) => value > 50).length;
    return { samples: deltas.length, fps: average > 0 ? 1000 / average : 0, p95, longFrameRate: deltas.length ? longFrames / deltas.length : 1 };
  });

  expect(cadence.samples).toBeGreaterThan(100);
  expect(cadence.fps, JSON.stringify(cadence)).toBeGreaterThanOrEqual(40);
  expect(cadence.p95, JSON.stringify(cadence)).toBeLessThanOrEqual(45);
  expect(cadence.longFrameRate, JSON.stringify(cadence)).toBeLessThanOrEqual(0.10);
});

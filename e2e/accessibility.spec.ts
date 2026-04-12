import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  { name: 'Index (Swedish)', path: '/' },
  { name: 'Historical', path: '/historical' },
  { name: 'Skatteutgifter', path: '/skatteutgifter' },
  { name: 'About', path: '/about' },
  { name: 'Index (English)', path: '/en' },
  { name: '404 Not Found', path: '/nonexistent-page' },
];

for (const route of routes) {
  test(`${route.name} (${route.path}) should have no accessibility violations`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));

    if (violations.length > 0) {
      console.log(`\n--- A11y violations on ${route.path} ---`);
      for (const v of violations) {
        console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
        console.log(`    Affected: ${v.nodes} node(s), e.g. ${v.targets.join(', ')}`);
        console.log(`    Help: ${v.helpUrl}`);
      }
    }

    expect(violations, `A11y violations on ${route.path}`).toEqual([]);
  });
}

test('Skip to content link works', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.locator('a[href="#main-content"]');
  await expect(skipLink).toBeFocused();
  await skipLink.click();
  const main = page.locator('#main-content');
  await expect(main).toBeVisible();
});

test('Keyboard navigation through header links', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const nav = page.locator('nav[aria-label="Huvudnavigation"]');
  const links = nav.locator('a');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    await link.focus();
    await expect(link).toBeFocused();
  }
});

test('Language toggle is keyboard accessible', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const langGroup = page.locator('[role="group"][aria-label="Språk / Language"]');
  await expect(langGroup).toBeVisible();
  const links = langGroup.locator('a');
  expect(await links.count()).toBe(2);
});

test('Explorer mode selector has proper radiogroup role', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const radioGroup = page.locator('[role="radiogroup"]');
  if (await radioGroup.count() > 0) {
    const radios = radioGroup.locator('[role="radio"]');
    const count = await radios.count();
    expect(count).toBeGreaterThan(0);
    const checked = radioGroup.locator('[role="radio"][aria-checked="true"]');
    expect(await checked.count()).toBe(1);
  }
});

test('All images have alt text', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const images = page.locator('img:not([aria-hidden="true"])');
  const count = await images.count();
  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const alt = await img.getAttribute('alt');
    const role = await img.getAttribute('role');
    expect(alt !== null || role === 'presentation', `Image ${i} missing alt text`).toBeTruthy();
  }
});

test('Focus is visible on interactive elements', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
});

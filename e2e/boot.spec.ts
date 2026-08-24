/**
 * Lot 0 acceptance — SPEC.md §4.11:
 * "Boots with the plugin list empty: shell, desk, empty document via seed,
 *  placeholder view, zero console errors."
 */
import { expect, test, type ConsoleMessage } from '@playwright/test';

function collectProblems(messages: string[]) {
  return (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      messages.push(`${msg.type()}: ${msg.text()}`);
    }
  };
}

test('the kernel boots with zero plugins and no console errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', collectProblems(problems));
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

  await page.goto('/');

  // shell chrome
  await expect(page.getByRole('link', { name: 'Maquette' })).toBeVisible();
  await expect(page.getByTestId('env-badge')).toHaveText('local');

  // placeholder view — the litmus test (SPEC.md §2)
  await expect(page.getByTestId('placeholder-view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No plugins loaded' })).toBeVisible();

  // nothing a plugin would have provided
  await expect(page.getByTestId('panel-dock')).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Tools' })).toHaveCount(0);

  expect(problems).toEqual([]);
});

test('the desk is daylight, and paper is the brightest object', async ({ page }) => {
  await page.goto('/');

  const desk = page.locator('main');
  await expect(desk).toHaveCSS('background-color', 'rgb(239, 237, 231)'); // --color-desk

  const paper = page.getByTestId('placeholder-view').locator('div').first();
  await expect(paper).toHaveCSS('background-color', 'rgb(255, 255, 255)'); // --color-paper
});

test('undo and redo start disabled, because nothing has happened yet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('the seeded document survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('placeholder-view')).toBeVisible();

  const first = await page.evaluate(() => localStorage.getItem('maquette:lastDocumentId'));
  expect(first).toBeTruthy();

  await page.reload();
  await expect(page.getByTestId('placeholder-view')).toBeVisible();

  const second = await page.evaluate(() => localStorage.getItem('maquette:lastDocumentId'));
  expect(second).toBe(first);
});

test('an unknown route falls back to the placeholder rather than a white screen', async ({
  page,
}) => {
  await page.goto('/spread/does-not-exist');
  await expect(page.getByTestId('placeholder-view')).toBeVisible();
});

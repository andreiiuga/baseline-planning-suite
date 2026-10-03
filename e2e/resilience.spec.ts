import { expect, test } from '@playwright/test';
import { openSection, panel } from './support';

/** Makes one remote's entry file fail, as if its container were down. */
async function breakRemote(
  page: import('@playwright/test').Page,
  remote: 'people' | 'delivery',
): Promise<void> {
  const port =
    remote === 'people'
      ? (process.env['PEOPLE_PORT'] ?? '8081')
      : (process.env['DELIVERY_PORT'] ?? '8082');
  await page.route(`**:${port}/**`, (route) => route.abort('connectionrefused'));
}

test('when People fails to load, the shell stays up, says so in place of People, and Delivery still works', async ({
  page,
}) => {
  await breakRemote(page, 'people');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Baseline' })).toBeVisible();
  await expect(panel(page, 'people').getByRole('alert')).toContainText('people is unavailable');
  await expect(panel(page, 'people').getByRole('button', { name: 'Retry' })).toBeVisible();

  await openSection(page, 'Delivery');
  await expect(panel(page, 'delivery').getByRole('table')).toBeVisible();
  // Hours and cost need People, so they are switched off rather than shown wrong.
  await expect(panel(page, 'delivery').getByText(/People is not available/)).toBeVisible();
  await expect(panel(page, 'delivery').getByRole('radio', { name: 'Hours' })).toBeDisabled();
  await expect(panel(page, 'delivery').getByRole('radio', { name: 'Person-months' })).toBeEnabled();
});

test('when Delivery fails to load, the shell stays up and People says capacity is unavailable', async ({
  page,
}) => {
  await breakRemote(page, 'delivery');
  await page.goto('/');
  await expect(panel(page, 'people').getByRole('button', { name: /Adaeze Okafor/ })).toBeVisible();
  await expect(panel(page, 'people').getByText(/Capacity data is unavailable/)).toBeVisible();
  await expect(panel(page, 'people').getByText('Oversubscribed')).toHaveCount(0);

  await openSection(page, 'Delivery');
  await expect(panel(page, 'delivery').getByRole('alert')).toContainText('delivery is unavailable');
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
});

test('People still edits rates while Delivery is down', async ({ page }) => {
  await breakRemote(page, 'delivery');
  await page.goto('/');
  const people = panel(page, 'people');
  await people.getByLabel(/Search by name or role/).fill('okafor');
  await people.getByRole('button', { name: /Adaeze Okafor/ }).click();
  await people.getByLabel(/Valid from/).fill('2026-09-01');
  await people.getByLabel(/Hourly cost/).fill('101.50');
  await people.getByRole('button', { name: 'Add rate' }).click();
  await expect(people.getByRole('rowheader', { name: '2026-09-01' })).toBeVisible();
});

test('a broken config.json shows an explicit error screen, not a blank page', async ({ page }) => {
  await page.route('**/config.json', (route) => route.fulfill({ status: 500, body: 'nope' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Baseline cannot start');
  await expect(page.getByRole('alert')).toContainText('config.json');
});

import { expect, test } from '@playwright/test';
import { chooseUnit, openSection, panel, personCell } from './support';

test('the root URL becomes /people', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByRole('region', { name: 'Employees' })).toBeVisible();
});

test('a deep link to /delivery opens Delivery (the server falls back to the shell)', async ({
  page,
}) => {
  await page.goto('/delivery');
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(panel(page, 'delivery').getByRole('table')).toBeVisible();
  await expect(page).toHaveTitle('Delivery · Baseline');
  await expect(
    page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Delivery' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('an unknown path is replaced with /people', async ({ page }) => {
  await page.goto('/no/such/place');
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByRole('region', { name: 'Employees' })).toBeVisible();
});

test('navigation entries are real links, and the browser Back and Forward buttons work', async ({
  page,
}) => {
  await page.goto('/people');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.getByRole('link', { name: 'Delivery' })).toHaveAttribute('href', '/delivery');

  await openSection(page, 'Delivery');
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page).toHaveTitle('Delivery · Baseline');

  await page.goBack();
  await expect(page).toHaveURL(/\/people$/);
  await expect(panel(page, 'people')).toBeVisible();
  await expect(panel(page, 'delivery')).toBeHidden();

  await page.goForward();
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(panel(page, 'delivery')).toBeVisible();
});

test('switching sections keeps both panels mounted, so nothing a user was doing is lost', async ({
  page,
}) => {
  await page.goto('/delivery');
  await panel(page, 'delivery').getByRole('table').waitFor();
  await chooseUnit(page, /Cost/);
  await panel(page, 'delivery')
    .getByRole('button', { name: /Earlier/ })
    .click();
  await expect(personCell(page, 'emp-001', 'wbs-012')).toHaveValue('7,880.00');

  await openSection(page, 'People');
  await panel(page, 'people')
    .getByLabel(/Search by name or role/)
    .fill('okafor');
  await openSection(page, 'Delivery');
  // Delivery was not unmounted: still in cost view, still on March
  await expect(personCell(page, 'emp-001', 'wbs-012')).toHaveValue('7,880.00');

  await page.goBack();
  await expect(panel(page, 'people').getByLabel(/Search by name or role/)).toHaveValue('okafor');
});

test('after navigating, focus moves into the new panel', async ({ page }) => {
  await page.goto('/people');
  await openSection(page, 'Delivery');
  await expect(panel(page, 'delivery')).toBeFocused();
});

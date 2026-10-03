import { expect, test } from '@playwright/test';

/** Each remote's own origin: the same container that serves its federation entry to the shell. */
const PEOPLE = `http://localhost:${process.env['PEOPLE_PORT'] ?? '8081'}`;
const DELIVERY = `http://localhost:${process.env['DELIVERY_PORT'] ?? '8082'}`;

for (const [name, origin] of [
  ['People', PEOPLE],
  ['Delivery', DELIVERY],
] as const) {
  test(`${name} serves a standalone page and its federation entry from the same build`, async ({
    request,
  }) => {
    const page = await request.get(`${origin}/`);
    expect(page.ok()).toBe(true);
    expect(await page.text()).toContain('standalone');
    const entry = await request.get(`${origin}/remoteEntry.js`);
    expect(entry.ok()).toBe(true);
    expect(entry.headers()['access-control-allow-origin']).toBe('http://localhost:8080');
  });
}

test('People runs standalone, with Delivery capacity from its own fixtures, and its own storage', async ({
  page,
}) => {
  await page.goto(PEOPLE);
  const register = page.getByRole('region', { name: 'Employees' });
  await expect(
    register.getByRole('button', { name: /Milan Brandt/ }).getByText('Oversubscribed'),
  ).toBeVisible();
  await expect(register.getByText('Oversubscribed')).toHaveCount(6);

  await page.getByLabel(/Search by name or role/).fill('okafor');
  await register.getByRole('button', { name: /Adaeze Okafor/ }).click();
  await page.getByLabel(/Valid from/).fill('2026-09-01');
  await page.getByLabel(/Hourly cost/).fill('101.50');
  await page.getByRole('button', { name: 'Add rate' }).click();
  await expect(page.getByRole('rowheader', { name: '2026-09-01' })).toBeVisible();

  await page.reload();
  await page.getByLabel(/Search by name or role/).fill('okafor');
  await register.getByRole('button', { name: /Adaeze Okafor/ }).click();
  await expect(page.getByRole('rowheader', { name: '2026-09-01' })).toBeVisible(); // persisted

  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('button', { name: 'Yes, reset' }).click();
  await page.getByLabel(/Search by name or role/).fill('okafor');
  await register.getByRole('button', { name: /Adaeze Okafor/ }).click();
  await expect(page.getByRole('rowheader', { name: '2026-09-01' })).toHaveCount(0);
});

test('Delivery runs standalone and prices from its own fixture rates', async ({ page }) => {
  await page.goto(DELIVERY);
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: /Earlier/ }).click(); // March 2026
  await page.getByText(/Cost \(EUR\)/).click();
  await expect(
    page.locator('tr[data-person="emp-001"][data-item="wbs-012"] input').first(),
  ).toHaveValue('7,880.00');
  await expect(page.getByRole('region', { name: 'Over capacity' })).toContainText('Milan Brandt');
});

test('Delivery standalone edits persist across a reload and reset restores the shipped plan', async ({
  page,
}) => {
  await page.goto(DELIVERY);
  const cell = page.locator('tr[data-person="emp-016"][data-item="wbs-012"] input').nth(1);
  await cell.fill('0.9');
  await cell.press('Enter');
  await expect(cell).toHaveValue('0.90');

  await page.reload();
  await expect(
    page.locator('tr[data-person="emp-016"][data-item="wbs-012"] input').nth(1),
  ).toHaveValue('0.90');

  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('button', { name: 'Yes, reset' }).click();
  await expect(
    page.locator('tr[data-person="emp-016"][data-item="wbs-012"] input').nth(1),
  ).toHaveValue('0.20');
});

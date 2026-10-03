import { expect, test } from '@playwright/test';
import { chooseUnit, openSection, openShell, panel, personCell } from './support';

test('a rate edited in People reaches an open Delivery cost view with no reload', async ({
  page,
}) => {
  await openShell(page);
  await openSection(page, 'Delivery');
  await panel(page, 'delivery')
    .getByRole('button', { name: /Earlier/ })
    .click(); // March 2026
  await chooseUnit(page, /Cost/);
  await expect(personCell(page, 'emp-001', 'wbs-012')).toHaveValue('7,880.00'); // 8 x 4 x 80 + 14 x 4 x 95

  await page.evaluate(() => {
    (window as unknown as { __loaded: boolean }).__loaded = true;
  });

  await openSection(page, 'People');
  const people = panel(page, 'people');
  await people.getByLabel(/Search by name or role/).fill('okafor');
  await people.getByRole('button', { name: /Adaeze Okafor/ }).click();
  await people.getByRole('button', { name: 'Edit 2026-03-12' }).click();
  await people.getByLabel(/Hourly cost/).fill('100');
  await people.getByRole('button', { name: 'Save rate' }).click();
  await expect(people.getByRole('cell', { name: '100.00' })).toBeVisible();

  await openSection(page, 'Delivery');
  await expect(personCell(page, 'emp-001', 'wbs-012')).toHaveValue('8,160.00'); // 2,560 + 14 x 4 x 100
  expect(await page.evaluate(() => (window as unknown as { __loaded?: boolean }).__loaded)).toBe(
    true,
  );
});

test('a retroactive rate in People reprices an earlier month in Delivery', async ({ page }) => {
  await openShell(page);
  await openSection(page, 'Delivery');
  await panel(page, 'delivery')
    .getByRole('button', { name: /Earlier/ })
    .click();
  await chooseUnit(page, /Cost/);
  await expect(personCell(page, 'emp-001', 'wbs-012')).toHaveValue('7,880.00');

  await openSection(page, 'People');
  const people = panel(page, 'people');
  await people.getByLabel(/Search by name or role/).fill('okafor');
  await people.getByRole('button', { name: /Adaeze Okafor/ }).click();
  // Remove the 2026-03-12 change entirely: all of March is now priced at EUR 80.
  await people.getByRole('button', { name: 'Remove 2026-03-12' }).click();
  await people.getByRole('button', { name: 'Confirm remove 2026-03-12' }).click();

  await openSection(page, 'Delivery');
  await expect(personCell(page, 'emp-001', 'wbs-012')).toHaveValue('7,040.00'); // 22 x 4 x 80
});

test('an allocation edited in Delivery flags the person as oversubscribed in People', async ({
  page,
}) => {
  await openShell(page);
  const people = panel(page, 'people');
  const okafor = people.getByRole('button', { name: /Adaeze Okafor/ });
  await expect(people.getByText('Oversubscribed')).toHaveCount(6); // from the shipped data
  await expect(okafor.getByText('Oversubscribed')).toHaveCount(0);

  await openSection(page, 'Delivery');
  await panel(page, 'delivery')
    .getByRole('button', { name: /Earlier/ })
    .click(); // March 2026
  const cell = personCell(page, 'emp-001', 'wbs-012');
  await cell.fill('1.4');
  await cell.press('Enter');
  await expect(panel(page, 'delivery').getByText(/over capacity in Mar 26/)).toBeVisible(); // flagged, not blocked

  await openSection(page, 'People');
  await expect(okafor.getByText('Oversubscribed')).toHaveCount(1);
  await expect(people.getByText('Oversubscribed')).toHaveCount(7);
});

test('Brandt is flagged in both apps, and Delivery names the allocation that caused it', async ({
  page,
}) => {
  await openShell(page);
  const people = panel(page, 'people');
  await expect(
    people.getByRole('button', { name: /Milan Brandt/ }).getByText('Oversubscribed'),
  ).toBeVisible();

  await openSection(page, 'Delivery');
  const over = panel(page, 'delivery').getByRole('region', { name: 'Over capacity' });
  await expect(over).toContainText('Milan Brandt, Jun 26');
  await expect(over).toContainText('1.18 person-months');
  await expect(over).toContainText('Most recently edited: Client Portal Rebuild');
});

test('edits survive a reload', async ({ page }) => {
  await openShell(page);
  await openSection(page, 'Delivery');
  const cell = personCell(page, 'emp-016', 'wbs-012', 1);
  await cell.fill('0.9');
  await cell.press('Enter');
  await expect(cell).toHaveValue('0.90');

  await page.reload();
  await openSection(page, 'Delivery');
  await expect(personCell(page, 'emp-016', 'wbs-012', 1)).toHaveValue('0.90');
});

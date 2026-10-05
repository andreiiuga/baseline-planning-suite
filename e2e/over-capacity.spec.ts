import { expect, test } from '@playwright/test';
import { openSection, openShell, panel } from './support';

const overTab = (page: import('@playwright/test').Page) =>
  panel(page, 'delivery').getByRole('button', { name: /^Over capacity/ });

test('correcting an allocation in the Over capacity view clears the flag in People', async ({
  page,
}) => {
  await openShell(page);
  const people = panel(page, 'people');
  const brandt = people.getByRole('button', { name: /Milan Brandt/ });
  await expect(brandt.getByText('Oversubscribed')).toBeVisible();
  await expect(people.getByText('Oversubscribed')).toHaveCount(6);

  await openSection(page, 'Delivery');
  await expect(overTab(page)).toContainText('6');
  await overTab(page).click();

  const row = panel(page, 'delivery').locator('li[data-employee="emp-003"][data-month="2026-06"]');
  await expect(row).toContainText('1.18 person-months allocated, over by 0.18');
  // both allocations are visible here, one of them in another project
  await expect(row.locator('tbody tr')).toHaveCount(2);
  await expect(row).toContainText('Client Portal Rebuild');
  await expect(row).toContainText('Ledger Consolidation');

  await row.getByRole('button', { name: 'Reduce to 0.41' }).first().click();
  await expect(row).toHaveCount(0);
  await expect(overTab(page)).toContainText('5');
  await expect(
    panel(page, 'delivery').getByRole('status').filter({ hasText: 'now within capacity' }),
  ).toBeVisible();

  await openSection(page, 'People');
  await expect(brandt.getByText('Oversubscribed')).toHaveCount(0);
  await expect(people.getByText('Oversubscribed')).toHaveCount(5);
});

test('the staffing grid links to the view, and typing an amount there works', async ({ page }) => {
  await openShell(page);
  await openSection(page, 'Delivery');
  await panel(page, 'delivery')
    .getByRole('button', { name: /Review and correct/ })
    .click();
  const row = panel(page, 'delivery').locator('li[data-employee="emp-003"][data-month="2026-06"]');
  const amount = row.locator('tr[data-allocation="alloc-073"] input');
  await amount.fill('0.55');
  await amount.press('Enter');
  await expect(row).toContainText('1.14 person-months allocated, over by 0.14');
  await expect(
    panel(page, 'delivery').getByRole('status').filter({ hasText: 'still over capacity' }),
  ).toBeVisible();
});

import { expect, type Locator, type Page } from '@playwright/test';

/** The shell's two panels. Employee roles also contain the word "Delivery", so scope by panel. */
export const panel = (page: Page, name: 'people' | 'delivery'): Locator =>
  page.locator(`[data-panel="${name}"]`);

export async function openSection(page: Page, name: 'People' | 'Delivery'): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name, exact: true })
    .click();
}

export async function openShell(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Employees' })).toBeVisible();
}

/** The input of one person's cell on one leaf; month index 0 is the first month shown. */
export const personCell = (
  page: Page,
  employeeId: string,
  itemId: string,
  monthIndex = 0,
): Locator =>
  panel(page, 'delivery')
    .locator(`tr[data-person="${employeeId}"][data-item="${itemId}"] input`)
    .nth(monthIndex);

export async function chooseUnit(page: Page, name: string | RegExp): Promise<void> {
  // The radio is visually hidden behind its label, so click the label text.
  await panel(page, 'delivery')
    .getByText(name, { exact: typeof name === 'string' })
    .first()
    .click();
}

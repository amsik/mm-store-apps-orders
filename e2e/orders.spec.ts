import { expect, test, type Page } from '@playwright/test';

const fillOrder = async (page: Page, customer: string, email: string) => {
  await page.goto('/#/new');
  await page.getByLabel('Customer name').fill(customer);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Item 1 SKU').fill('TV-55');
  await page.getByLabel('Item 1 name').fill('OLED TV 55"');
  await page.getByLabel('Item 1 quantity').fill('2');
  await page.getByLabel(/Item 1 unit price/).fill('499.99');
  await page.getByRole('button', { name: 'Create order' }).click();
};

test('create an order, find it in the list, start it with an employee and complete it', async ({ page }) => {
  const customer = `E2E customer ${String(Date.now())}`;
  await fillOrder(page, customer, 'e2e@example.com');

  await expect(page).toHaveURL(/#\/orders\/[a-f\d]{24}$/);
  await expect(page.getByTestId('order-state')).toHaveText('OPEN');

  await page.getByRole('navigation').getByRole('link', { name: 'Orders' }).click();
  const row = page.getByRole('row', { name: new RegExp(customer) });
  await expect(row).toContainText('OPEN');
  await expect(row).toContainText('€999.98');
  await row.getByRole('link', { name: customer }).click();

  const start = page.getByRole('button', { name: 'Start' });
  await expect(start).toBeDisabled();
  await page.getByLabel('Employee').selectOption({ index: 1 });
  await start.click();
  await expect(page.getByTestId('order-state')).toHaveText('IN PROGRESS');
  await expect(page.getByTestId('assigned-employee')).not.toHaveText('—');

  await page.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByTestId('order-state')).toHaveText('COMPLETE');
  await expect(page.getByText('No further actions')).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(2);
});

test('shows a server-side validation error in the form', async ({ page }) => {
  // Passes the client's basic email check; the API's stricter check (a top-level domain) rejects it.
  await fillOrder(page, 'E2E invalid email', 'ada@example');

  await expect(page.getByText('email must be an email')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/#\/new$/);
});

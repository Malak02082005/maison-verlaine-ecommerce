// Card payments with Stripe in TEST mode (no real money). These tests talk to Stripe's real test
// environment, so they only run when both test keys are set: STRIPE_SECRET_KEY (sk_test_...) in
// server/.env and VITE_STRIPE_PUBLISHABLE_KEY (pk_test_...) in client/.env. Otherwise they're skipped.
import fs from 'node:fs';
import { test, expect } from './fixtures';
import { addToCart, adminOrderRow, fillCheckout, loginAsAdmin, logout, newCustomer } from './helpers';

const readKey = (file, name) => {
  try {
    const line = fs.readFileSync(new URL(file, import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : '';
  } catch {
    return '';
  }
};
const hasStripeKeys =
  readKey('../../server/.env', 'STRIPE_SECRET_KEY').startsWith('sk_test_') &&
  readKey('../.env', 'VITE_STRIPE_PUBLISHABLE_KEY').startsWith('pk_test_');

// Fill in Stripe's card form (it lives in an iframe on the page)
async function payWithCard(page, number) {
  const card = page.frameLocator('iframe[title*="Secure payment input frame"]').first();
  await card.locator('[name="number"]').fill(number);
  await card.locator('[name="expiry"]').fill('12 / 34');
  await card.locator('[name="cvc"]').fill('123');
  const postalCode = card.locator('[name="postalCode"]');
  if (await postalCode.isVisible().catch(() => false)) await postalCode.fill('12345');
  await page.getByRole('button', { name: /^Pay €/ }).click();
}

test.describe('Card payments (Stripe test mode)', () => {
  test.skip(!hasStripeKeys, 'Stripe test keys are not set in server/.env and client/.env');
  test.setTimeout(120_000);

  test('pay with the test card 4242 4242 4242 4242, then the admin refunds it', async ({ page, request }) => {
    await newCustomer(page, request, 'Iris Hughes');
    await addToCart(page, 'silver-pendant-atelier'); // €39.95 + €5.00 shipping
    await fillCheckout(page, 'card');
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();

    await payWithCard(page, '4242424242424242');
    await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.status')).toHaveText('Paid');
    const orderNo = (await page.getByRole('heading', { level: 1 }).textContent()).replace('Order ', '').trim();
    await logout(page);

    // Admin cancels the paid order: the money is refunded through Stripe
    await loginAsAdmin(page);
    await page.goto('/admin/orders');
    await expect(adminOrderRow(page, orderNo)).toContainText('€44.95');
    await adminOrderRow(page, orderNo).getByRole('button', { name: 'Cancel & refund' }).click();
    const dialog = page.locator('.modal-card');
    await expect(dialog).toContainText('€44.95 is refunded to the customer');
    await dialog.getByText('Customer asked to cancel').click();
    await dialog.getByRole('button', { name: 'Cancel & refund' }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(adminOrderRow(page, orderNo).locator('.status')).toHaveText('Cancelled');
  });

  test('a declined card shows an error and the order stays unpaid', async ({ page, request }) => {
    await newCustomer(page, request, 'Tom Peters');
    await addToCart(page, 'cashmere-beanie-oat');
    await fillCheckout(page, 'card');
    await page.getByRole('button', { name: 'Continue to payment' }).click();

    await payWithCard(page, '4000000000000002'); // Stripe's "card declined" test card
    await expect(page.locator('.payment-form .alert-error')).toContainText('declined', { timeout: 30_000 });

    // The order is still waiting for payment and can be paid later
    await page.getByRole('link', { name: 'your order page' }).click();
    await expect(page.locator('.status')).toHaveText('Awaiting payment');
    await expect(page.getByRole('heading', { name: 'This order is waiting for payment' })).toBeVisible();
  });
});

// Shopping cart: adding, changing and removing items, totals and shipping.
import { test, expect } from './fixtures';
import { addToCart } from './helpers';

const summary = (page, label) => page.locator('.summary-row', { hasText: label }).locator('span').last();

test.describe('Shopping cart', () => {
  test('add, change and remove items', async ({ page }) => {
    await addToCart(page, 'leather-belt'); // €69.00
    await expect(page.getByRole('link', { name: 'Cart, 1 items' })).toBeVisible();

    await page.getByRole('link', { name: 'View cart' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
    await expect(page.locator('.cart-item-name')).toHaveText(['Leather Belt']);
    await expect(summary(page, 'Subtotal')).toHaveText('€69.00');
    await expect(summary(page, 'Shipping')).toHaveText('€5.00'); // under €100
    await expect(summary(page, 'Total')).toHaveText('€74.00');
    await expect(page.getByText('more for free shipping')).toBeVisible();

    // Two belts: over €100, so shipping becomes free
    await page.getByRole('button', { name: 'More' }).click();
    await expect(summary(page, 'Subtotal')).toHaveText('€138.00');
    await expect(summary(page, 'Shipping')).toHaveText('Free');
    await expect(summary(page, 'Total')).toHaveText('€138.00');

    // The cart is kept after a page reload
    await page.reload();
    await expect(summary(page, 'Total')).toHaveText('€138.00');

    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  });

  test('you can’t add more than is in stock', async ({ page }) => {
    // The signet ring has only 2 in stock
    await page.goto('/product/gold-vermeil-signet-ring-ms');
    await page.locator('.size-btn', { hasText: 'One Size' }).click();
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('button', { name: 'More' })).toBeDisabled();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('button', { name: 'All in your cart' })).toBeDisabled();
  });

  test('checking out asks you to log in first', async ({ page }) => {
    await addToCart(page, 'leather-belt');
    await page.goto('/cart');
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

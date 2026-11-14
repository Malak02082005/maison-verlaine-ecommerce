// Shopping cart: adding, changing and removing items, totals and shipping.
import { test, expect } from './fixtures';
import { addToCart, login, logout, newCustomer } from './helpers';

const summary = (page, label) => page.locator('.summary-row', { hasText: label }).locator('span').last();
const cartLink = (page) => page.locator('header a.cart-btn');

test.describe('Shopping cart', () => {
  test('add, change and remove items', async ({ page }) => {
    await addToCart(page, 'leather-belt'); // €69.00
    await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();

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

  test('checking out asks you to log in first, and the cart comes along', async ({ page, request }) => {
    await addToCart(page, 'leather-belt');
    await page.goto('/cart');
    await page.getByRole('button', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // After logging in, the items added as a guest are in the account's cart
    await newCustomer(page, request, 'Grace Turner');
    await page.goto('/cart');
    await expect(page.locator('.cart-item-name')).toHaveText(['Leather Belt']);
  });

  test('every account has its own cart', async ({ page, request }) => {
    const anna = await newCustomer(page, request, 'Anna Price');
    await addToCart(page, 'leather-belt');
    await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');

    // Logging out empties the cart on screen
    await logout(page);
    await expect(cartLink(page)).toHaveAccessibleName('Cart, 0 items');

    // Another customer on the same computer doesn't see Anna's cart
    await newCustomer(page, request, 'Ben Hall');
    await expect(cartLink(page)).toHaveAccessibleName('Cart, 0 items');
    await addToCart(page, 'merino-socks-oat', { quantity: 2 });
    await expect(cartLink(page)).toHaveAccessibleName('Cart, 2 items');
    await logout(page);

    // Anna gets her own cart back when she logs in again
    await login(page, anna.email, anna.password);
    await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');
    await page.goto('/cart');
    await expect(page.locator('.cart-item-name')).toHaveText(['Leather Belt']);
  });
});

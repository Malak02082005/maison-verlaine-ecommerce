// Product catalogue: browsing, filtering, searching and product pages.
import { test, expect } from './fixtures';

const cards = (page) => page.locator('.product-card');

test.describe('Product catalogue', () => {
  test('the home page leads to the collection', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.product-card').first()).toBeVisible(); // featured products

    await page.getByRole('link', { name: 'Shop the collection' }).click();
    await expect(page).toHaveURL(/\/shop/);
    await expect(page.getByRole('heading', { level: 1, name: 'The collection' })).toBeVisible();
    await expect(cards(page)).toHaveCount(12); // 12 products per page
    await expect(page.locator('.page-btn')).toHaveText(['1', '2', '3']);
  });

  test('filter by category, type and colour', async ({ page }) => {
    await page.goto('/shop');
    await page.locator('.chip', { hasText: 'Bags' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bags' })).toBeVisible();
    await expect(cards(page)).toHaveCount(9);

    await page.locator('.check', { hasText: 'Shoulder Bags' }).click();
    await expect(cards(page)).toHaveCount(3);
    await expect(page.locator('.product-card-meta')).toHaveText([/Shoulder Bags/, /Shoulder Bags/, /Shoulder Bags/]);

    // The colour list has its own search box
    await page.getByPlaceholder('Search colour…').fill('burg');
    await page.locator('.check', { hasText: 'Burgundy' }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.locator('.product-card-name')).toHaveText('Shoulder Bag');

    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(cards(page)).toHaveCount(12);
  });

  test('sort by price', async ({ page }) => {
    await page.goto('/shop?category=Jewelry&sort=price_asc');
    await expect(page.locator('.product-card-price')).toHaveText(['€39.95', '€49.95']);
    await page.goto('/shop?category=Jewelry&sort=price_desc');
    await expect(page.locator('.product-card-price')).toHaveText(['€49.95', '€39.95']);
  });

  test('search from the header', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Search products').fill('scarf');
    await page.getByLabel('Search products').press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Results for “scarf”' })).toBeVisible();
    await expect(cards(page)).toHaveCount(2);
  });

  test('a product page shows photos, price, sizes and stock', async ({ page }) => {
    await page.goto('/shop?category=Coats');
    await page.locator('.product-card', { hasText: 'Wool Overcoat – Camel' }).click();

    await expect(page).toHaveURL(/\/product\/wool-overcoat-camel$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Wool Overcoat – Camel' })).toBeVisible();
    await expect(page.getByText('€189.95').first()).toBeVisible();
    await expect(page.locator('.gallery-thumb')).toHaveCount(2);
    await expect(page.locator('.size-btn')).toHaveText(['XS', 'S', 'M', 'L', 'XL']);

    await page.locator('.size-btn', { hasText: 'XL' }).click();
    await expect(page.locator('.stock-warning')).toHaveText('Hurry, only 1 left in XL');
  });

  test('an unknown product shows a friendly message', async ({ page }) => {
    await page.goto('/product/does-not-exist');
    await expect(page.getByRole('link', { name: 'Back to the shop' })).toBeVisible();
  });
});

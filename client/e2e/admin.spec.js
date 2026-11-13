// Product management (admin): adding, editing and deleting products, and updating stock.
import { test, expect } from './fixtures';
import { loginAsAdmin, stockOnAdminPage } from './helpers';

test.describe('Product management', () => {
  test('admin adds a product, edits it, and deletes it', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin$/); // admins land on the dashboard

    await page.goto('/admin/products/new');
    await page.getByLabel('Name', { exact: true }).fill('Pearl Drop Necklace');
    await page.getByLabel('Description').fill('A single freshwater pearl on a fine gold chain.');
    await page.getByLabel(/^Category/).selectOption('Jewelry');
    await page.getByLabel(/^Type/).selectOption('Necklaces');
    await page.getByLabel('Colour').fill('Gold');
    await page.getByLabel('Price (EUR, incl. VAT)').fill('64.50');
    await page.getByLabel('Size', { exact: true }).first().selectOption('One Size');
    await page.getByLabel('Stock', { exact: true }).first().fill('4');
    await page.getByLabel('Image 1').fill('/products/mv-pendant-silver.jpg');
    await page.getByRole('button', { name: 'Add product' }).click();
    await expect(page.locator('.alert-success')).toHaveText('Added Pearl Drop Necklace');

    // Customers can find it in the shop
    await page.goto('/shop?category=Jewelry');
    await page.locator('.product-card', { hasText: 'Pearl Drop Necklace' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pearl Drop Necklace' })).toBeVisible();
    await expect(page.getByText('€64.50').first()).toBeVisible();

    // Edit the price
    await page.goto('/admin/products');
    const row = page.locator('.table tbody tr', { hasText: 'Pearl Drop Necklace' });
    await row.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Price (EUR, incl. VAT)').fill('59.00');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.alert-success')).toHaveText('Updated Pearl Drop Necklace');
    await expect(row).toContainText('€59.00');

    // Delete it
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
    await page.goto('/shop?category=Jewelry');
    await expect(page.locator('.product-card')).toHaveCount(2);
  });

  test('admin updates stock, and the shop follows', async ({ page }) => {
    await loginAsAdmin(page);
    expect(await stockOnAdminPage(page, 'Travel Pouch – Noir')).toBe(7);

    // Sell out
    const input = page.getByLabel('Travel Pouch – Noir, size One Size, stock', { exact: true });
    await input.fill('0');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.table tbody tr', { hasText: 'Travel Pouch – Noir' })).toContainText('Sold out');
    await page.goto('/product/travel-pouch-noir');
    await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled();

    // Restock
    await stockOnAdminPage(page, 'Travel Pouch – Noir');
    await page.getByLabel('Travel Pouch – Noir, size One Size, stock', { exact: true }).fill('7');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.table tbody tr', { hasText: 'Travel Pouch – Noir' })).toContainText('In stock');
    await page.goto('/product/travel-pouch-noir');
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });
});

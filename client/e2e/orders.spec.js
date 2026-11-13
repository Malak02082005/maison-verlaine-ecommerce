// Order management: the full journey from cart to delivery, stock tracking, and cancelling
// (by the customer and by the admin) with a reason. Uses cash on delivery, so no payment
// service is needed; card payments are tested in payment.spec.js.
import { test, expect } from './fixtures';
import { addToCart, adminOrderRow, login, loginAsAdmin, logout, newCustomer, placeCashOrder, stockOnAdminPage } from './helpers';

test.describe('Orders', () => {
  test('customer orders, admin ships and delivers, stock goes down', async ({ page, request }) => {
    await loginAsAdmin(page);
    const stockBefore = await stockOnAdminPage(page, 'Gloves');
    await logout(page);

    // Customer: cart → checkout with cash on delivery
    await newCustomer(page, request, 'Mia Johnson');
    await addToCart(page, 'gloves', { quantity: 2 }); // 2 × €89.00 = €178.00, free shipping
    const orderNo = await placeCashOrder(page);
    await expect(page.locator('.status')).toHaveText('Placed · cash');
    await expect(page.getByText('Please have €178.00 in cash ready when it arrives.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart, 0 items' })).toBeVisible(); // cart emptied

    // The order is in My orders
    await page.goto('/orders');
    await expect(page.getByText(orderNo)).toBeVisible();
    await logout(page);

    // Admin: the stock went down by 2 and the order can be shipped and delivered
    await loginAsAdmin(page);
    expect(await stockOnAdminPage(page, 'Gloves')).toBe(stockBefore - 2);
    await page.goto('/admin/orders');
    await adminOrderRow(page, orderNo).getByRole('button', { name: 'Mark shipped' }).click();
    await expect(adminOrderRow(page, orderNo).locator('.status')).toHaveText('Shipped');
    await adminOrderRow(page, orderNo).getByRole('button', { name: 'Delivered & cash received' }).click();
    await expect(adminOrderRow(page, orderNo).locator('.status')).toHaveText('Delivered');

    // The admin dashboard counts the cash as revenue once delivered
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Best sellers' })).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Best sellers' })).toContainText('Gloves');
  });

  test('customer cancels with a reason, the admin sees it, stock comes back', async ({ page, request }) => {
    await newCustomer(page, request, 'Daniel Smith');
    await addToCart(page, 'bucket-bag');
    const orderNo = await placeCashOrder(page);

    await page.getByRole('button', { name: 'Cancel order' }).click();
    const dialog = page.locator('.modal-card');
    await expect(dialog.getByRole('heading', { name: `Cancel order ${orderNo}?` })).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Cancel order' });
    await expect(confirm).toBeDisabled(); // a reason is required

    await dialog.getByText('Other', { exact: true }).click();
    await expect(confirm).toBeDisabled(); // "Other" needs a note
    await dialog.getByText('Ordered by mistake').click();
    await dialog.locator('textarea').fill('Meant to buy the shoulder bag');
    await confirm.click();

    await expect(page.locator('.status')).toHaveText('Cancelled');
    await expect(page.locator('.alert-muted')).toContainText('Reason: Ordered by mistake');
    await expect(page.locator('.alert-muted')).toContainText('Meant to buy the shoulder bag');
    await logout(page);

    // Admin: the reason is shown with the order and on the dashboard; the bag is back in stock
    await loginAsAdmin(page);
    await page.goto('/admin/orders?status=cancelled');
    await expect(adminOrderRow(page, orderNo).locator('.cancel-reason')).toContainText('Ordered by mistake');
    await page.goto('/admin');
    await expect(page.locator('.card', { hasText: 'Why orders are cancelled' })).toContainText('Ordered by mistake');
    expect(await stockOnAdminPage(page, 'Bucket Bag')).toBe(7);
  });

  test('admin cancels an order with a reason, the customer sees it', async ({ page, request }) => {
    const customer = await newCustomer(page, request, 'Sam Wilson');
    await addToCart(page, 'keychain-brass');
    const orderNo = await placeCashOrder(page);
    const orderUrl = page.url();
    await logout(page);

    await loginAsAdmin(page);
    await page.goto('/admin/orders');
    await adminOrderRow(page, orderNo).getByRole('button', { name: 'Cancel' }).click();
    const dialog = page.locator('.modal-card');
    await dialog.getByText('Out of stock').click();
    await dialog.getByRole('button', { name: 'Cancel order' }).click();
    await expect(dialog).toBeHidden();
    await expect(adminOrderRow(page, orderNo).locator('.status')).toHaveText('Cancelled');
    await expect(adminOrderRow(page, orderNo).locator('.cancel-reason')).toContainText('Out of stock');
    await logout(page);

    // The customer sees that the shop cancelled it, and why
    await login(page, customer.email, customer.password);
    await page.goto(orderUrl);
    await expect(page.locator('.status')).toHaveText('Cancelled');
    await expect(page.locator('.alert-muted')).toContainText('Reason: Out of stock');
  });

  test('admin sees customers and their orders', async ({ page, request }) => {
    const customer = await newCustomer(page, request, 'Fiona Miller');
    await addToCart(page, 'merino-socks-oat', { quantity: 3 }); // 3 × €29.95 + €5.00 shipping = €94.85
    const orderNo = await placeCashOrder(page);
    await logout(page);

    await loginAsAdmin(page);
    await page.goto('/admin/customers');
    await page.getByPlaceholder('Search name or email…').fill(customer.email);
    const row = page.locator('.table tbody tr', { hasText: customer.email });
    await expect(row).toContainText('€0.00'); // cash isn't counted as spent until delivered
    await row.getByRole('button', { name: 'Fiona Miller' }).click();
    await expect(page.locator('.customer-orders')).toContainText(orderNo);
    await expect(page.locator('.customer-orders')).toContainText('€94.85');
    await expect(page.locator('.customer-orders')).toContainText('Cash on delivery');
  });
});

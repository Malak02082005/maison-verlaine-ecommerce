import { expect } from './fixtures';

export const API = 'http://localhost:5181/api';

// The admin account created by server/scripts/e2e-server.js
export const ADMIN = { email: 'admin@e2e.test', password: 'password123' };

export const ADDRESS = {
  fullName: 'Sara Ali',
  phone: '+44 20 7946 0123',
  street: '12 Market Street',
  city: 'London',
  country: 'United Kingdom',
};

// A new email address for every test, so tests never get in each other's way
let counter = 0;
export const uniqueEmail = (name) => `${name}.${Date.now()}.${(counter += 1)}@e2e.test`;

// Log in through the login form
export async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export const loginAsAdmin = (page) => login(page, ADMIN.email, ADMIN.password);

// A customer account created through the API (fast), then logged in through the form
export async function newCustomer(page, request, name = 'Test Customer') {
  const customer = { name, email: uniqueEmail(name.split(' ')[0].toLowerCase()), password: 'password123' };
  const res = await request.post(`${API}/auth/register`, { data: customer });
  expect(res.ok()).toBeTruthy();
  await login(page, customer.email, customer.password);
  return customer;
}

// Log out through the account menu in the shop header (admin pages have their own layout,
// so go to the home page first)
export async function logout(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.locator('.dropdown').getByRole('button', { name: 'Log out' }).click();
  await expect(page.locator('header').getByRole('link', { name: 'Log in' })).toBeVisible();
}

// Open a product page and add it to the cart
export async function addToCart(page, slug, { size = 'One Size', quantity = 1 } = {}) {
  await page.goto(`/product/${slug}`);
  await page.locator('.size-btn', { hasText: size }).click();
  for (let i = 1; i < quantity; i += 1) await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.locator('.alert-success')).toBeVisible();
}

// From a filled cart: fill in the shipping address and choose the payment method
export async function fillCheckout(page, paymentMethod) {
  await page.goto('/checkout');
  for (const [label, value] of [['Full name', ADDRESS.fullName], ['Phone', ADDRESS.phone], ['Street address', ADDRESS.street], ['City', ADDRESS.city], ['Country', ADDRESS.country]]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.locator('.pay-option', { hasText: paymentMethod === 'cod' ? 'Cash on delivery' : 'Card' }).click();
}

// Place a cash-on-delivery order for the products already in the cart; returns the order number (#ABC123)
export async function placeCashOrder(page) {
  await fillCheckout(page, 'cod');
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for your order!' })).toBeVisible();
  const heading = await page.getByRole('heading', { level: 1 }).textContent();
  return heading.replace('Order ', '').trim();
}

// The stock of a product as the admin's Stock page shows it
export async function stockOnAdminPage(page, productName, size = 'One Size') {
  await page.goto('/admin/inventory');
  await page.getByPlaceholder('Search name, type or colour…').fill(productName);
  return Number(await page.getByLabel(`${productName}, size ${size}, stock`, { exact: true }).inputValue());
}

// The row of an order in the admin's Orders table
export const adminOrderRow = (page, orderNo) => page.locator('.table tbody tr', { hasText: orderNo }).first();

// User accounts: registering, logging in and out, editing details, and who may see what.
import { test, expect } from './fixtures';
import { login, logout, newCustomer, uniqueEmail } from './helpers';

test.describe('User accounts', () => {
  test('register, get sent to the login page, then log in', async ({ page }) => {
    const email = uniqueEmail('nora');
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Nora Visser');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('short');
    await expect(page.getByText('At least 8 characters')).toBeVisible();
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Sent to the login page, with the new email already filled in
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Your account has been created. Log in to start shopping.')).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue(email);

    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.locator('.dropdown-name')).toHaveText('Nora Visser');
  });

  test('a wrong password is rejected', async ({ page, request }) => {
    const customer = await newCustomer(page, request);
    await logout(page);
    await page.goto('/login');
    await page.getByLabel('Email').fill(customer.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.locator('.alert-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('change your name and password on My account', async ({ page, request }) => {
    const customer = await newCustomer(page, request, 'Lena Bakker');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.locator('.dropdown').getByRole('link', { name: 'My account' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible();

    await page.getByLabel('Full name').fill('Lena de Boer');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.locator('.alert-success').first()).toBeVisible();

    await page.getByLabel('Current password').fill(customer.password);
    await page.getByLabel('New password', { exact: true }).fill('new-password-456');
    await page.getByLabel('Repeat new password').fill('new-password-456');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.locator('.alert-success').last()).toBeVisible();

    // The new password works, and the new name is shown
    await logout(page);
    await login(page, customer.email, 'new-password-456');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.locator('.dropdown-name')).toHaveText('Lena de Boer');
  });

  test('pages for logged-in users and admins are protected', async ({ page, request }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);

    // A customer can't open the admin panel
    await newCustomer(page, request);
    await page.goto('/admin');
    await expect(page).toHaveURL('/');
  });
});

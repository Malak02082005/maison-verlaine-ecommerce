const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, clearDb, createUser, api } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const newCustomer = { name: 'Sara Ali', email: 'sara@example.com', password: 'password123' };

describe('Sign up (POST /api/auth/register)', () => {
  it('creates a customer account and logs them in', async () => {
    const res = await api().post('/api/auth/register', newCustomer);
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'customer');
    assert.equal(res.body.user.password, undefined); // the hash is never sent
  });

  it('can’t be used to create an admin', async () => {
    const res = await api().post('/api/auth/register', { ...newCustomer, role: 'admin' });
    assert.equal(res.body.user.role, 'customer');
  });

  it('rejects a short password and a duplicate email', async () => {
    const short = await api().post('/api/auth/register', { ...newCustomer, password: 'short' });
    assert.equal(short.status, 400);
    assert.match(short.body.message, /at least 8 characters/);

    await api().post('/api/auth/register', newCustomer);
    const duplicate = await api().post('/api/auth/register', { ...newCustomer, email: 'SARA@example.com' });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.body.message, /email already exists/);
  });
});

describe('Log in (POST /api/auth/login)', () => {
  it('logs in with the right password', async () => {
    await api().post('/api/auth/register', newCustomer);
    const res = await api().post('/api/auth/login', { email: 'sara@example.com', password: 'password123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await api().post('/api/auth/register', newCustomer);
    const wrong = await api().post('/api/auth/login', { email: 'sara@example.com', password: 'nope-nope' });
    const unknown = await api().post('/api/auth/login', { email: 'who@example.com', password: 'password123' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });
});

describe('Protected routes', () => {
  it('GET /api/auth/me returns the logged-in user', async () => {
    const { token } = await createUser();
    const res = await api(token).get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'customer@shop.test');
  });

  it('rejects requests without a valid token', async () => {
    assert.equal((await api().get('/api/orders/mine')).status, 401);
    assert.equal((await api('not-a-token').get('/api/orders/mine')).status, 401);
  });

  it('keeps customers out of admin routes', async () => {
    const { token } = await createUser();
    const res = await api(token).get('/api/admin/stats');
    assert.equal(res.status, 403);
  });
});

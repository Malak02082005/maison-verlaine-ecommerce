const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startDb, stopDb, clearDb, createUser, api, sampleProduct, createProduct } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const names = (res) => res.body.products.map((p) => p.name);

describe('Browsing products (public)', () => {
  beforeEach(async () => {
    await createProduct({ name: 'Linen Summer Dress', price: 49.99 });
    await createProduct({
      name: 'Denim Jacket', description: 'A classic jean jacket.', category: 'Coats', type: 'Jackets',
      color: 'Blue', price: 89, sizes: [{ size: 'L', stock: 3 }],
    });
    await createProduct({
      name: 'Leather Tote Bag', description: 'Roomy everyday bag.', category: 'Bags', type: 'Totes',
      color: 'Brown', price: 120, sizes: [{ size: 'One Size', stock: 0 }],
    });
  });

  it('lists products without logging in, newest first', async () => {
    const res = await api().get('/api/products');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.deepEqual(names(res), ['Leather Tote Bag', 'Denim Jacket', 'Linen Summer Dress']);
  });

  it('filters by category, search text and price', async () => {
    assert.deepEqual(names(await api().get('/api/products?category=Bags')), ['Leather Tote Bag']);
    assert.deepEqual(names(await api().get('/api/products?search=linen')), ['Linen Summer Dress']);
    assert.deepEqual(names(await api().get('/api/products?minPrice=50&maxPrice=100')), ['Denim Jacket']);
  });

  it('filters by size (in stock only) and colour', async () => {
    assert.deepEqual(names(await api().get('/api/products?size=L')), ['Denim Jacket']);
    assert.deepEqual(names(await api().get('/api/products?size=One%20Size')), []); // sold out
    assert.deepEqual(names(await api().get('/api/products?color=blue')), ['Denim Jacket']);
  });

  it('sorts by price and pages through results', async () => {
    const cheapest = await api().get('/api/products?sort=price_asc&limit=2&page=1');
    assert.deepEqual(names(cheapest), ['Linen Summer Dress', 'Denim Jacket']);
    assert.equal(cheapest.body.pages, 2);
    assert.deepEqual(names(await api().get('/api/products?sort=price_asc&limit=2&page=2')), ['Leather Tote Bag']);
  });

  it('treats search text literally (no regex tricks)', async () => {
    const res = await api().get('/api/products?search=.*');
    assert.equal(res.body.total, 0);
  });

  it('returns the available filter options', async () => {
    const res = await api().get('/api/products/filters');
    assert.deepEqual(res.body.types.Coats, ['Coats', 'Jackets']);
    assert.deepEqual(res.body.colors, ['Beige', 'Blue', 'Brown']);
    assert.equal(res.body.minPrice, 49.99);
    assert.equal(res.body.maxPrice, 120);
    assert.deepEqual(res.body.sizes, ['S', 'M', 'L', 'One Size']); // standard order, not alphabetical
  });

  it('limits colours, sizes and prices to the chosen category', async () => {
    const res = await api().get('/api/products/filters?category=Bags');
    assert.deepEqual(res.body.colors, ['Brown']);
    assert.deepEqual(res.body.sizes, ['One Size']);
    assert.equal(res.body.minPrice, 120);
    assert.deepEqual(Object.keys(res.body.types).sort(), ['Bags', 'Coats']); // all categories
  });

  it('gets one product by its slug or id, with its total stock', async () => {
    const bySlug = await api().get('/api/products/linen-summer-dress');
    assert.equal(bySlug.status, 200);
    assert.equal(bySlug.body.totalStock, 7);
    const byId = await api().get(`/api/products/${bySlug.body._id}`);
    assert.equal(byId.body.name, 'Linen Summer Dress');
    assert.equal((await api().get('/api/products/no-such-product')).status, 404);
  });
});

describe('Managing products (admin)', () => {
  it('lets an admin create, update and delete a product', async () => {
    const { token } = await createUser({ role: 'admin' });

    const created = await api(token).post('/api/products', sampleProduct());
    assert.equal(created.status, 201);
    assert.equal(created.body.slug, 'linen-summer-dress');

    const updated = await api(token).put(`/api/products/${created.body._id}`, { ...sampleProduct(), price: 39.99 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.price, 39.99);

    const deleted = await api(token).delete(`/api/products/${created.body._id}`);
    assert.equal(deleted.status, 200);
    assert.equal((await api().get(`/api/products/${created.body._id}`)).status, 404);
  });

  it('gives products with the same name different slugs', async () => {
    const { token } = await createUser({ role: 'admin' });
    await api(token).post('/api/products', sampleProduct());
    const second = await api(token).post('/api/products', sampleProduct({ color: 'Black' }));
    assert.equal(second.body.slug, 'linen-summer-dress-2');
  });

  it('validates the product', async () => {
    const { token } = await createUser({ role: 'admin' });
    const wrongType = await api(token).post('/api/products', sampleProduct({ type: 'Jeans', category: 'Accessories' }));
    assert.equal(wrongType.status, 400);
    assert.match(wrongType.body.message, /not a product type in this category/);

    const noSizes = await api(token).post('/api/products', sampleProduct({ sizes: [] }));
    assert.match(noSizes.body.message, /at least one size/);

    const sameSizeTwice = await api(token).post('/api/products', sampleProduct({ sizes: [{ size: 'S', stock: 1 }, { size: 'S', stock: 2 }] }));
    assert.match(sameSizeTwice.body.message, /only be listed once/);
  });

  it('keeps sizes in the standard order', async () => {
    const { token } = await createUser({ role: 'admin' });
    const res = await api(token).post('/api/products', sampleProduct({
      sizes: [{ size: 'XL', stock: 1 }, { size: 'S', stock: 1 }, { size: 'M', stock: 1 }],
    }));
    assert.deepEqual(res.body.sizes.map((s) => s.size), ['S', 'M', 'XL']);
  });

  it('doesn’t let customers change products', async () => {
    const { token } = await createUser();
    const res = await api(token).post('/api/products', sampleProduct());
    assert.equal(res.status, 403);
  });
});

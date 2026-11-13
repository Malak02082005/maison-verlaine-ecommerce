const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { SIZES } = require('../data/catalog');

const router = express.Router();

// Accept only known fields, so clients can't set _id, slug, createdAt, etc.
const pickFields = ({ name, description, category, type, color, price, images, sizes, featured } = {}) => ({
  name, description, category, type, color, price, images, sizes, featured,
});

// Makes user text safe to use inside a regular expression ("a+b" matches the literal text)
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asString = (value) => (typeof value === 'string' ? value.trim() : '');
const asList = (value) => asString(value).split(',').map((v) => v.trim()).filter(Boolean);

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

// LIST  →  GET /api/products
// Optional query: search, category, type, size, color (comma-separated), minPrice, maxPrice,
//                 inStock=1, featured=1, sort (newest | price_asc | price_desc | name), page, limit
router.get('/', async (req, res) => {
  const q = req.query;
  const filter = {};

  const search = asString(q.search);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }, { color: pattern }, { type: pattern }];
  }
  if (asString(q.category)) filter.category = asString(q.category);
  if (asList(q.type).length) filter.type = { $in: asList(q.type) };
  if (asList(q.color).length) {
    filter.color = { $in: asList(q.color).map((c) => new RegExp(`^${escapeRegex(c)}$`, 'i')) };
  }
  // A size filter only matches products that have that size in stock
  if (asList(q.size).length) {
    filter.sizes = { $elemMatch: { size: { $in: asList(q.size) }, stock: { $gt: 0 } } };
  } else if (q.inStock === '1') {
    filter['sizes.stock'] = { $gt: 0 };
  }
  const minPrice = Number(q.minPrice);
  const maxPrice = Number(q.maxPrice);
  if (q.minPrice && Number.isFinite(minPrice)) filter.price = { ...filter.price, $gte: minPrice };
  if (q.maxPrice && Number.isFinite(maxPrice)) filter.price = { ...filter.price, $lte: maxPrice };
  if (q.featured === '1') filter.featured = true;

  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 12, 1), 100);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const sort = SORTS[q.sort] || SORTS.newest;

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ products, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

// FILTER OPTIONS  →  GET /api/products/filters?category=Women
// What's actually in the shop right now: types per category, plus the colours, sizes and price
// range of the chosen category (or of the whole shop)
router.get('/filters', async (req, res) => {
  const scope = asString(req.query.category) ? { category: asString(req.query.category) } : {};
  const [types, colors, sizes, prices] = await Promise.all([
    Product.aggregate([{ $group: { _id: { category: '$category', type: '$type' } } }]),
    Product.distinct('color', scope),
    Product.distinct('sizes.size', scope),
    Product.aggregate([
      { $match: scope },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]),
  ]);

  const typesByCategory = {};
  for (const { _id } of types) (typesByCategory[_id.category] ||= []).push(_id.type);
  Object.values(typesByCategory).forEach((list) => list.sort());

  res.json({
    types: typesByCategory,
    colors: colors.sort(),
    sizes: sizes.sort((a, b) => SIZES.indexOf(a) - SIZES.indexOf(b)), // XS, S, M… then 36, 37…
    minPrice: prices[0]?.min ?? 0,
    maxPrice: prices[0]?.max ?? 0,
  });
});

// ONE  →  GET /api/products/:idOrSlug   (product pages use the slug, the admin uses the id)
router.get('/:idOrSlug', async (req, res) => {
  const key = req.params.idOrSlug;
  const product = mongoose.isValidObjectId(key)
    ? await Product.findById(key)
    : await Product.findOne({ slug: key });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

// ---------- Admin only ----------

// CREATE  →  POST /api/products
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.create(pickFields(req.body));
  res.status(201).json(product);
});

// UPDATE  →  PUT /api/products/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.set(pickFields(req.body));
  await product.save(); // load → change → save, so every schema rule runs
  res.json(product);
});

// DELETE  →  DELETE /api/products/:id
// Past orders keep their own copy of the product's name, price and image.
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

module.exports = router;

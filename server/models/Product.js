const mongoose = require('mongoose');
const { CATEGORIES, TYPES, SIZES } = require('../data/catalog');

// "Classic Tote Bag" → "classic-tote-bag" (used in product page URLs)
const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // é → e
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// How many of one size are in stock
const sizeSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
      enum: { values: SIZES, message: '"{VALUE}" is not a valid size' },
    },
    stock: { type: Number, required: true, min: [0, 'Stock can’t be negative'], default: 0 },
  },
  { _id: false }
);

// One product in one colour. Each size has its own stock.
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 2000 },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: '"{VALUE}" is not a valid category' },
    },
    type: {
      type: String,
      required: [true, 'Product type is required'],
      validate: {
        // `this` is the product, so the type must belong to its category
        validator: function (value) {
          return (TYPES[this.category] || []).includes(value);
        },
        message: (props) => `"${props.value}" is not a product type in this category`,
      },
    },
    color: { type: String, required: [true, 'Colour is required'], trim: true, maxlength: 40 },
    price: { type: Number, required: [true, 'Price is required'], min: [0.5, 'Price must be at least €0.50'] },
    images: {
      type: [{ type: String, trim: true }],
      validate: { validator: (list) => list.length > 0, message: 'Add at least one image' },
    },
    sizes: {
      type: [sizeSchema],
      validate: [
        { validator: (list) => list.length > 0, message: 'Add at least one size' },
        {
          validator: (list) => new Set(list.map((s) => s.size)).size === list.length,
          message: 'Each size can only be listed once',
        },
      ],
    },
    featured: { type: Boolean, default: false }, // shown on the home page
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Total stock across all sizes
productSchema.virtual('totalStock').get(function () {
  return (this.sizes || []).reduce((sum, s) => sum + s.stock, 0);
});

// Give every product a unique, readable URL slug, e.g. "linen-summer-dress-2"
productSchema.pre('validate', async function () {
  if (this.slug && !this.isModified('name')) return;
  const base = slugify(this.name || '') || 'product';
  let slug = base;
  for (let n = 2; await this.constructor.exists({ slug, _id: { $ne: this._id } }); n += 1) {
    slug = `${base}-${n}`;
  }
  this.slug = slug;
});

// Keep sizes in the standard order (S before M before L…)
productSchema.pre('save', function () {
  if (this.isModified('sizes')) {
    this.sizes.sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size));
  }
});

productSchema.index({ category: 1, type: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);

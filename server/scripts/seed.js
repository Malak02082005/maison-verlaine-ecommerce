// Fills the shop with the sample products in data/seed-products.js.
// Usage (from the server folder):
//   npm run seed              adds the samples only if there are no products yet
//   npm run seed -- --reset   deletes ALL products first, then adds the samples
// Orders and accounts are never touched.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const samples = require('../data/seed-products');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in server/.env');
  await mongoose.connect(process.env.MONGO_URI);

  const reset = process.argv.includes('--reset');
  const existing = await Product.countDocuments();
  if (existing > 0 && !reset) {
    console.log(`The shop already has ${existing} products, so nothing was added.`);
    console.log('Run "npm run seed -- --reset" to replace them with the samples.');
    return;
  }
  if (reset) {
    await Product.deleteMany({});
    console.log(`Deleted ${existing} existing products.`);
  }

  // Mix the categories so "New arrivals" (the newest products) shows a bit of everything:
  // the first product of each category is added last, so it counts as the newest.
  const byCategory = Object.values(Object.groupBy(samples, (s) => s.category));
  const mixed = [];
  for (let i = 0; i < Math.max(...byCategory.map((list) => list.length)); i += 1) {
    for (const list of byCategory) if (list[i]) mixed.push(list[i]);
  }

  // One by one (oldest first), so each product gets its slug and passes every schema rule
  for (const sample of mixed.reverse()) await Product.create(sample);
  console.log(`Added ${samples.length} sample products.`);
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

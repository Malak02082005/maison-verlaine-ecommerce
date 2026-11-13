// Reserving and releasing stock. Each update is atomic: MongoDB only takes items from a size
// that still has enough left, so two customers can never buy the last item at the same time.
const Product = require('../models/Product');

// Takes `quantity` items of `size` out of stock. Returns false if there aren't enough left.
async function takeFromStock(productId, size, quantity) {
  const result = await Product.updateOne(
    { _id: productId, sizes: { $elemMatch: { size, stock: { $gte: quantity } } } },
    { $inc: { 'sizes.$.stock': -quantity } }
  );
  return result.modifiedCount === 1;
}

// Puts items back into stock (e.g. an order was cancelled). Products that were deleted in the
// meantime are simply skipped.
async function returnToStock(items) {
  await Promise.all(
    items.map((item) =>
      Product.updateOne(
        { _id: item.product, 'sizes.size': item.size },
        { $inc: { 'sizes.$.stock': item.quantity } }
      )
    )
  );
}

module.exports = { takeFromStock, returnToStock };

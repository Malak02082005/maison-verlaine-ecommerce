const mongoose = require('mongoose');

// One line of an order. Name, image and price are copied from the product when the order is
// placed, so the order still shows what was bought even if the product changes or is deleted.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String },
    image: { type: String },
    color: { type: String },
    size: { type: String, required: true },
    price: { type: Number, required: true }, // price of one item at the time of the order
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 100 },
    phone: { type: String, required: [true, 'Phone number is required'], trim: true, maxlength: 30 },
    street: { type: String, required: [true, 'Street address is required'], trim: true, maxlength: 200 },
    city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, required: [true, 'Country is required'], trim: true, maxlength: 60 },
  },
  { _id: false }
);

// Order life cycle:
//   card:              pending_payment → paid → shipped → delivered
//   cash on delivery:  placed → shipped → delivered   (paid in cash on delivery)
//   pending_payment / placed / paid → cancelled   (the items go back into stock)
const STATUSES = ['pending_payment', 'placed', 'paid', 'shipped', 'delivered', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (list) => list.length > 0, message: 'An order needs at least one item' },
    },
    shippingAddress: { type: addressSchema, required: true },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: STATUSES, default: 'pending_payment', index: true },
    payment: {
      // "stripe" = card payment online; "cod" = cash on delivery
      provider: { type: String, enum: ['stripe', 'cod'], default: 'stripe' },
      paymentIntentId: { type: String }, // Stripe only
      paidAt: { type: Date }, // card: when paid online; cash: when the order was delivered
    },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    // Why the order was cancelled, and by whom
    cancellation: {
      reason: { type: String, trim: true },
      note: { type: String, trim: true, maxlength: [500, 'Keep the note under 500 characters'] },
      by: { type: String, enum: ['customer', 'admin'] },
    },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;

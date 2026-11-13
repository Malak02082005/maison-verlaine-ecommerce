// The fixed lists the Maison Verlaine store is built around. The four categories come from the
// Maison Verlaine package (data/maison-verlaine/products.json). The product types within each
// category are the shop's own grouping, used for filters.
const CATEGORIES = ['Bags', 'Coats', 'Accessories', 'Jewelry'];

// Product types per category
const TYPES = {
  Bags: ['Totes', 'Top-Handle Bags', 'Shoulder Bags', 'Crossbody & Mini Bags', 'Clutches', 'Backpacks'],
  Coats: ['Coats', 'Jackets', 'Blazers'],
  Accessories: ['Scarves', 'Belts', 'Eyewear', 'Watches', 'Gloves & Hats', 'Small Leather Goods', 'Socks'],
  Jewelry: ['Rings', 'Necklaces'],
};

// Allowed sizes, in display order (coats come in letter sizes; everything else is one size)
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];

// Orders: free shipping from this subtotal, otherwise a flat fee (in euros, incl. VAT)
const FREE_SHIPPING_FROM = 100;
const SHIPPING_FEE = 5;

// Reasons someone can give when cancelling an order ("Other" needs a short note)
const CANCEL_REASONS = {
  customer: [
    'Changed my mind',
    'Found a better price elsewhere',
    'Ordered by mistake',
    'Delivery takes too long',
    'Want a different size or colour',
    'Other',
  ],
  admin: ['Out of stock', 'Customer asked to cancel', 'Payment not received', 'Other'],
};

module.exports = { CATEGORIES, TYPES, SIZES, FREE_SHIPPING_FROM, SHIPPING_FEE, CANCEL_REASONS };

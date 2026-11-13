// Sample products for `npm run seed`: the Maison Verlaine catalogue.
//
// WHERE THE DATA COMES FROM
//   From the Maison Verlaine package (data/maison-verlaine/products.json):
//     name, description, price (EUR, incl. VAT), category, main photo + detail photo.
//     The photos are in client/public/products/ and are not edited.
//   Added by the shop (the package doesn't include them, but the store needs them):
//     a product type (for filters), a colour, sizes + stock, and which products are
//     "featured" on the home page. These are set in EXTRA below.
const { products } = require('./maison-verlaine/products.json');

// Package category → shop category
const CATEGORY = { bags: 'Bags', coats: 'Coats', accessories: 'Accessories', jewelry: 'Jewelry' };

// Stock helpers: coats come in sizes, everything else is one size
const coatSizes = (xs, s, m, l, xl) =>
  [['XS', xs], ['S', s], ['M', m], ['L', l], ['XL', xl]].map(([size, stock]) => ({ size, stock }));
const oneSize = (stock) => [{ size: 'One Size', stock }];

// Per product (by the package id): type, colour, stock and whether it's featured
const EXTRA = {
  'mv-tote': { type: 'Totes', color: 'Black', sizes: oneSize(8), featured: true },
  'mv-crossbody': { type: 'Crossbody & Mini Bags', color: 'White', sizes: oneSize(10) },
  'mv-clutch': { type: 'Clutches', color: 'Gold', sizes: oneSize(5), featured: true },
  'mv-backpack': { type: 'Backpacks', color: 'Navy', sizes: oneSize(6) },
  'mv-bucket': { type: 'Shoulder Bags', color: 'Beige', sizes: oneSize(7) },
  'mv-shoulder': { type: 'Shoulder Bags', color: 'Burgundy', sizes: oneSize(4) },
  'mv-mini': { type: 'Crossbody & Mini Bags', color: 'Ivory', sizes: oneSize(6) },
  'mv-hobo': { type: 'Shoulder Bags', color: 'Grey', sizes: oneSize(5) },
  'mv-top-handle': { type: 'Top-Handle Bags', color: 'Black', sizes: oneSize(3), featured: true },
  'mv-wool-coat': { type: 'Coats', color: 'Camel', sizes: coatSizes(2, 4, 5, 3, 1), featured: true },
  'mv-leather-jacket': { type: 'Jackets', color: 'Black', sizes: coatSizes(1, 2, 3, 2, 1) },
  'mv-trench': { type: 'Coats', color: 'Sand', sizes: coatSizes(2, 3, 4, 3, 1), featured: true },
  'mv-puffer': { type: 'Jackets', color: 'Olive', sizes: coatSizes(2, 4, 4, 3, 2) },
  'mv-blazer': { type: 'Blazers', color: 'Charcoal', sizes: coatSizes(1, 3, 4, 3, 1) },
  'mv-wrap-coat': { type: 'Coats', color: 'Oat', sizes: coatSizes(1, 2, 3, 2, 0) },
  'mv-scarf': { type: 'Scarves', color: 'Ivory', sizes: oneSize(12), featured: true },
  'mv-belt': { type: 'Belts', color: 'Black', sizes: oneSize(15) },
  'mv-sunglasses': { type: 'Eyewear', color: 'Gold', sizes: oneSize(9) },
  'mv-watch': { type: 'Watches', color: 'Rose Gold', sizes: oneSize(4), featured: true },
  'mv-gloves': { type: 'Gloves & Hats', color: 'Black', sizes: oneSize(10) },
  'mv-hat': { type: 'Gloves & Hats', color: 'Oat', sizes: oneSize(14) },
  'mv-cardholder': { type: 'Small Leather Goods', color: 'Black', sizes: oneSize(20) },
  'mv-wallet': { type: 'Small Leather Goods', color: 'Black', sizes: oneSize(9) },
  'mv-keychain': { type: 'Small Leather Goods', color: 'Brass', sizes: oneSize(18) },
  'mv-socks': { type: 'Socks', color: 'Oat', sizes: oneSize(25) },
  'mv-travel-pouch': { type: 'Small Leather Goods', color: 'Black', sizes: oneSize(7) },
  'mv-pocket-square': { type: 'Scarves', color: 'Floral', sizes: oneSize(10) },
  'mv-signet-ring': { type: 'Rings', color: 'Gold', sizes: oneSize(2), featured: true },
  'mv-pendant': { type: 'Necklaces', color: 'Silver', sizes: oneSize(11) },
};

// Package products the shop doesn't sell (removed from the range; their photos were removed too)
const EXCLUDED = ['mv-puffer', 'mv-blazer', 'mv-cardholder', 'mv-wallet'];

// "images/mv-tote-black.jpg" → "/products/mv-tote-black.jpg" (served by the frontend)
const photo = (file) => `/products/${file.replace(/^images\//, '')}`;

module.exports = products.filter((p) => !EXCLUDED.includes(p.id)).map((p) => {
  const extra = EXTRA[p.id];
  if (!extra) throw new Error(`No shop details for ${p.id} in seed-products.js`);
  return {
    name: p.name,
    description: p.description,
    price: p.price_eur,
    category: CATEGORY[p.category],
    images: [photo(p.main_photo), photo(p.detail_photo)],
    ...extra,
  };
});

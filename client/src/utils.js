// Prices are in euros, incl. VAT, shown English-style: "€89.00"
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
export const formatPrice = (amount) => money.format(amount || 0);

export const formatDate = (date) =>
  new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Order statuses: label for people + colour of the badge
export const ORDER_STATUS = {
  pending_payment: { label: 'Awaiting payment', tone: 'warn' },
  placed: { label: 'Placed · cash', tone: 'info' }, // cash on delivery, not shipped yet
  paid: { label: 'Paid', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'accent' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

// "#64b7f0c2a1b2c3d4e5f60718" → "#F60718" (short, readable order number)
// plural(1, 'item') → "1 item", plural(3, 'item') → "3 items"
export const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

export const orderNumber = (id) => `#${String(id).slice(-6).toUpperCase()}`;

export const totalStock = (product) => (product.sizes || []).reduce((sum, s) => sum + s.stock, 0);

// Smaller copy of an Unsplash photo for thumbnails (other image URLs are used as they are)
export const thumb = (url, width = 400) =>
  url?.includes('images.unsplash.com') ? url.replace(/w=\d+/, `w=${width}`) : url;

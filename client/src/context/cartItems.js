// Shared by the cart context and the pages that show cart items
export const itemKey = (item) => `${item.productId}|${item.size}`;
export const MAX_PER_ITEM = 10; // same limit as the server

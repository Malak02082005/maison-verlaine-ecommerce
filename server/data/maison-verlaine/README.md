# Maison Verlaine product package

This folder holds the product data the Maison Verlaine store is built from.

## What's in the package

| File / folder | Contents |
| --- | --- |
| `products.json` | All **29 products**, each with a name, description, price in euros, category, and its photo files (`main_photo` and `detail_photo`). This is the source of truth for the catalogue. |
| `client/public/products/` | The product photos (a main photo and a detail photo per product, max. 1400 px, optimised for the web). The file names match the paths in `products.json`. |

## Categories (29 products)

- **Bags**: 9 products
- **Coats**: 6 products
- **Accessories**: 12 products
- **Jewelry**: 2 products

## Guidelines for building the shop

1. **Create the products** with exactly the names, descriptions and prices from `products.json`.
2. **Use the photos as delivered**: the main photo as the product image, the detail photo as the second image (gallery and hover). The photos are not edited or regenerated.
3. Brand name: **Maison Verlaine**, with a luxury fashion look.
4. Shop structure: the categories as navigation and filters, product pages with a photo gallery, a shopping cart and a checkout.
5. Prices are in euros and include VAT.
6. Document which data comes from this package (see below).

## How the shop uses this data

`server/data/seed-products.js` loads `products.json` and turns it into the shop's products (`npm run seed`).

- **Taken from the package:** product names, descriptions, prices, categories, and the main and detail photos.
- **Added by the shop:** a product type for the filters, a colour, sizes and stock, and which products are featured on the home page.
- **Not sold:** four package products (puffer jacket, wool blazer, card holder and wallet) were left out of the range.
- **Prices** are shown in English style, e.g. "€89.00".

# Maison Verlaine: E-Commerce Website

A full-stack online fashion store built with **React**, **Node.js/Express** and **MongoDB**. Customers can browse a catalogue of bags, coats, accessories and jewelry, add products to a cart, and check out with **Stripe** (test mode) or **cash on delivery**. Admins manage products, stock, orders and customers from a dashboard.

Built for the **Auspify Full Stack Internship, Task 4: E-Commerce Website**.

## Features

### Product catalogue
- 25 products across 4 categories: Bags, Coats, Accessories and Jewelry
- Product search, filters for category, type, colour, size and price (type and colour lists have their own search box), and sorting by newest, price or name
- Product pages with a photo gallery, size selection and live stock levels
- Featured products and new arrivals on the home page

### Shopping cart
- Add, update and remove items; the cart is saved in the browser
- Free shipping from €100, otherwise a flat €5 fee
- Prices are always recalculated on the server, so the cart can't be tampered with

### Checkout and payments
- **Card payments with Stripe** (test mode, Stripe Payment Element)
- **Cash on delivery**
- Stock is reserved when an order is placed and returned if the order is cancelled

### User accounts
- Register, log in and log out (passwords hashed with bcrypt, JWT login tokens)
- After registering, the customer is sent to the login page
- **My account**: change name, email and password
- **My orders**: order history, order status timeline, and cancelling an order with a reason

### Order management (admin)
- **Dashboard**: revenue, order counts, best sellers and why orders are cancelled
- **Products**: add, edit and delete products
- **Stock**: stock per product and size, low stock and sold-out warnings, quick stock updates
- **Orders**: move orders from paid/placed to shipped to delivered, or cancel them with a reason (card payments are refunded automatically)
- **Customers**: search customers, see their orders and total spent, and make someone an admin

## Tech stack

| Part | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, Stripe React components |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB (MongoDB Atlas) |
| Payments | Stripe (test mode) |
| Auth | JSON Web Tokens, bcrypt |
| Tests | Node's built-in test runner, Supertest, mongodb-memory-server |

## Project structure

```
ecommerce-website/
├── client/                React frontend
│   ├── public/products/   product photos
│   └── src/
│       ├── pages/         shop pages and admin pages
│       ├── components/    header, product card, filters, dialogs, ...
│       └── api.js         all calls to the backend
└── server/                Express API
    ├── data/              product data and the shop's fixed lists
    ├── models/            User, Product and Order
    ├── routes/            auth, products, orders and admin
    ├── lib/payments.js    Stripe
    ├── scripts/           seed the products and create an admin
    └── tests/             automated API tests
```

## Getting started

### Requirements
- Node.js 20 or newer
- A MongoDB database (a free MongoDB Atlas cluster works)
- A Stripe account in test mode (free) for card payments

### 1. Install

```bash
cd server
npm install
cd ../client
npm install
```

### 2. Add your settings

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then fill in your own values:

| File | Setting | What it is |
| --- | --- | --- |
| `server/.env` | `MONGO_URI` | MongoDB connection string, ending in `/ecommerce` |
| `server/.env` | `JWT_SECRET` | Any long random string |
| `server/.env` | `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...`) |
| `server/.env` | `PORT` | API port (default `5001`) |
| `client/.env` | `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_...`) |

The Stripe keys are under **Developers → API keys** in the Stripe dashboard. The `.env` files are ignored by Git and must never be committed.

### 3. Add the products

```bash
cd server
npm run seed
```

This adds the 25 products. Use `npm run seed -- --reset` to replace existing products.

### 4. Create an admin account

```bash
cd server
npm run create-admin -- "Your Name" you@example.com "a-strong-password"
```

### 5. Run the app

Start the backend and the frontend in two terminals:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Open **http://localhost:5174**. The API runs on http://localhost:5001. Log in with your admin account and open **/admin** for the admin panel.

## Testing a payment

Stripe is in test mode, so no real money is charged. Use this test card at checkout:

| Field | Value |
| --- | --- |
| Card number | `4242 4242 4242 4242` |
| Expiry date | Any future date, e.g. `12/34` |
| CVC | Any 3 digits, e.g. `123` |

To see a declined payment, use `4000 0000 0000 0002`. Test payments appear in the Stripe dashboard under **Payments**.

## Automated tests

```bash
cd server
npm test
```

The tests run against an in-memory database with Stripe faked, so they don't need your `.env`. The 52 tests cover:
- registering, logging in and editing accounts
- browsing, filtering and managing products
- the full order flow: placing an order, card and cash payments, stock reservation, cancelling with a reason, and admin status updates
- admin stock and customer management

## API overview

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/me`, `PUT /api/auth/me/password` |
| Products | `GET /api/products`, `GET /api/products/filters`, `GET /api/products/:idOrSlug`; admin: `POST`, `PUT`, `DELETE` |
| Orders | `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/:id`, `GET /api/orders/:id/payment`, `POST /api/orders/:id/confirm-payment`, `POST /api/orders/:id/cancel` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`, `GET /api/admin/inventory`, `PATCH /api/admin/products/:id/stock`, `GET /api/admin/users`, `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/role` |
| Other | `GET /api/catalog` (categories, sizes, shipping, cancel reasons), `GET /api/health` |

## Product data

The products, descriptions, prices and photos come from the Maison Verlaine product package in `server/data/maison-verlaine/` (see the README there). The shop adds a product type, colour, sizes and stock for each product.

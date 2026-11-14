# Parvati Poshaks API

REST API for the Parvati Poshaks store: catalogue with sizes and colours, cart, wishlist, coupons, checkout with Razorpay or cash on delivery, orders, reviews and admin tools.

Built with Node.js, Express 5 and MongoDB (Mongoose).

## Setup

```bash
npm install
cp .env.example .env      # then fill in the values
npm run dev               # nodemon, restarts on change
npm start                 # plain node, for production
```

`MONGO_DB_URL` and `JWT_SECRET` are required; the server refuses to start without them. Everything else has a default, listed in `.env.example`.

- **Email**: leave `SMTP_MAIL` empty in development and emails are skipped with a log line.
- **Razorpay**: without `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, online checkout answers 503 and cash on delivery still works. Point a Razorpay webhook for `payment.captured` and `payment.failed` at `POST /api/v1/payment/webhook` and set `RAZORPAY_WEBHOOK_SECRET` to its secret.
- **Email verification**: set `REQUIRE_EMAIL_VERIFICATION=true` to require a verified email for checkout and reviews.

## Going live

- Set `NODE_ENV=production` and list every storefront address in `CORS_ORIGIN` (comma separated). Requests that change data are refused unless they come from one of those addresses or from the API's own host. This stops other websites from acting with a signed-in shopper's cookies.
- Rate limits are counted in MongoDB, so they hold across several server instances.
- In production, logs go to standard output as JSON for the hosting platform to collect. Set `LOG_TO_FILES=true` to also write `logs/*.log`.
- On `SIGTERM` the server stops taking new requests, finishes the ones in progress, then exits.
- Request bodies are limited to 100 KB, except sign-up and profile update (5 MB, for the photo).

## Upgrading an existing database

Field names and the order and review structure changed. Convert existing data once:

```bash
npm run migrate -- --dry-run   # shows what would change
npm run migrate                # applies it; safe to run again
```

Back up the database first. Orders created before the upgrade are recorded as paid online, which is how the old code stored them.

## Tests

```bash
npm test
```

Tests start an in-memory MongoDB. Where its download is blocked, point them at any MongoDB instead; each run uses its own throwaway database:

```bash
MONGO_TEST_URL=mongodb://localhost:27017 npm test
```

Razorpay, Cloudinary and email are replaced by fakes in tests.

## Responses

```json
{ "success": true, "message": "…", "data": { } }
{ "success": false, "message": "…", "errors": [{ "field": "email", "message": "…" }] }
```

## Lists

List endpoints take `page` and `limit` and return `count`, `currentPage` and `totalPages` alongside the items. The default is 20 per page (50 for a product's reviews and a shopper's own orders), up to 100.

## Sessions

Signing in sets two httpOnly cookies: a 15-minute `accessToken` and a 30-day `refreshToken`. When a request answers 401, call `POST /token/refresh` and retry. Each refresh token works once. The access token is also returned in the response body and accepted as `Authorization: Bearer <token>`.

## Endpoints

All paths are under `/api/v1`. **U** needs a signed-in user, **A** needs an admin.

### Account
| Method | Path | | Notes |
|---|---|---|---|
| POST | `/signup` | | `name`, `email`, `username`, `password`, optional `avatar` (image file, or a PNG, JPEG, WebP or GIF data URI) |
| POST | `/signin` | | `email`, `password` |
| POST | `/token/refresh` | | uses the refresh cookie |
| POST | `/logout` | | this device |
| POST | `/logout-all` | U | every device |
| GET | `/email/verify/:token` | | |
| POST | `/email/resend` | U | |
| POST | `/password/forgot` | | `email` |
| POST | `/password/reset/:token` | | `password`, `confirmedPassword` |
| PUT | `/password/update` | U | `oldPassword`, `newPassword`, `confirmNewPassword` |
| GET | `/profile` | U | |
| PUT | `/profile` | U | `name`, `email`, `avatar` |

### Catalogue
| Method | Path | | Notes |
|---|---|---|---|
| GET | `/products` | | `keyword`, `category`, `price[gte]`, `price[lte]`, `ratings[gte]`, `inStock=true`, `sort` (`newest`, `price`, `-price`, `ratings`, `-ratings`), `page`, `limit` |
| GET | `/product/:id` | | |
| GET | `/product/:id/reviews` | | |
| PUT | `/product/:id/review` | U | `rating` 1 to 5, `comment`; one review per user |
| DELETE | `/review/:id` | U | author or admin |

### Contact
| Method | Path | | Notes |
|---|---|---|---|
| POST | `/contact` | | `name`, `email`, `subject`, `message`; emailed to `SMTP_MAIL`. Answers 503 when no mailbox is configured |
| POST | `/newsletter` | | `email` |

### Cart and wishlist
| Method | Path | | Notes |
|---|---|---|---|
| GET | `/cart` | U | prices are always current |
| POST | `/cart/items` | U | `productId`, `quantity`, `variantId` when the product has options |
| PUT | `/cart/items/:itemId` | U | `quantity` |
| DELETE | `/cart/items/:itemId` | U | |
| PUT | `/cart` | U | `items: [{ productId, variantId, quantity }]`; replaces the whole cart |
| DELETE | `/cart` | U | empties the cart |
| GET | `/wishlist` | U | |
| POST, DELETE | `/wishlist/:productId` | U | |
| POST | `/coupon/validate` | U | `code`; previews totals for the current cart |

### Checkout and orders
| Method | Path | | Notes |
|---|---|---|---|
| POST | `/checkout` | U | `shippingInfo`, `paymentMethod` (`razorpay` or `cod`), optional `couponCode` |
| GET | `/checkout/summary` | U | totals for the current cart; optional `couponCode` |
| POST | `/payment/verify` | U | `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` |
| POST | `/payment/webhook` | | called by Razorpay |
| GET | `/orders/me` | U | |
| GET | `/order/:id` | U | owner or admin |
| POST | `/order/:id/cancel` | U | before shipping |

Checkout builds the order from the cart with prices, discount, tax and shipping calculated on the server, and reserves stock.

- **Cash on delivery**: the order is `Processing` straight away.
- **Razorpay**: the order is `Pending` and the response carries `payment: { razorpayOrderId, amount, currency, keyId }` for Razorpay Checkout. Send the result to `/payment/verify`; the order becomes `Processing`. Unpaid orders are cancelled and their stock released after `PENDING_PAYMENT_MINUTES`.

### Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users` | |
| GET, PUT, DELETE | `/admin/user/:id` | PUT takes `role` (`user` or `admin`) |
| GET | `/admin/products` | full list |
| POST | `/admin/product` | `name`, `description`, `price`, `mrp` (optional list price), `category`, `stock`, `images`, `variants` |
| PUT, DELETE | `/admin/product/:id` | |
| GET, POST | `/admin/coupons` | `code`, `type` (`percent` or `flat`), `value`, `minOrderValue`, `maxDiscount`, `expiresAt`, `usageLimit`, `perUserLimit`, `active` |
| PUT, DELETE | `/admin/coupon/:id` | |
| GET | `/admin/orders` | `status`, `page`, `limit` |
| PUT | `/admin/order/:id` | `status`: Processing to Shipped to Delivered, or Cancelled before shipping |
| PUT | `/admin/order/:id/payment` | `paymentStatus`: `paid` (cash collected) or `refunded` |
| DELETE | `/admin/order/:id` | delivered or cancelled orders only |
| GET | `/admin/subscribers` | newsletter sign-ups |
| GET | `/admin/stats` | revenue, orders by status, top products, low stock, users |

Cancelling an order that was paid online refunds it through Razorpay automatically and marks it `refunded`. If Razorpay refuses, the order stays `paid` with a "refund required" note: refund it in the Razorpay dashboard, then mark the order `refunded` here.

## Project layout

```
config/       environment loading and validation
controllers/  request handlers
middleware/   auth, validation, rate limits, error handling
models/       Mongoose schemas
routes/       URL to controller mapping
services/     business logic: stock, pricing, orders, payments, sessions, email
validators/   request validation rules, one file per area
scripts/      data migration
__tests__/    API tests
```

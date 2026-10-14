# ShopKart — MERN Labs 01–06

A React storefront using Node.js, Express, MongoDB and Mongoose. All six problem statements from https://github.com/mrinal1224/Lab-2029-Problem-Statements were checked on **8 October 2026**. Labs 01–05 were unchanged; Lab 06 now adds mandatory Razorpay Test Mode payments, shipping, orders and history. Exact statements are saved in `requirements/`.

## Run

Prerequisites: Node.js 22+, MongoDB and an installed Microsoft Edge browser for optional browser tests.

```powershell
npm --prefix backend ci
npm --prefix frontend ci
# Only if backend/.env does not already exist:
Copy-Item backend/.env.example backend/.env
```

Configure `MONGO_URI` and a random `JWT_SECRET` of at least 32 characters. Existing `.env` is preserved. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

In one terminal, start the local database (or use an existing MongoDB Atlas replica set):

```powershell
npm run db
```

This starts **persistent** MongoDB bound to `127.0.0.1:27017`, with the `shopkart-rs` replica set. It initializes the replica set automatically and preserves data in `backend/.local-mongodb/`. A replica set is necessary because payment confirmation saves the paid order and clears the customer cart in one transaction. Logs are saved to `backend/.local-mongodb/mongod.log`. Its first launch may download MongoDB. If a standalone MongoDB already occupies this port, stop that development instance or configure an existing replica set instead; do not run two databases on the same port.

In another terminal:

```powershell
npm run seed
npm run dev
```

Open http://localhost:5173. Register your own customer account. Eight sample products include all four categories and an out-of-stock item. Seeding preserves existing data; React always reads products from APIs.

To serve the built app from Express at http://localhost:5000:

```powershell
npm run build
npm start
```

Vite proxies `/api` to Express during development. The production SPA and `/api` use one origin. Original lab endpoint paths also work in API clients. For an external frontend origin, configure `VITE_API_URL`, `CLIENT_ORIGIN` and `PUBLIC_ORIGIN`. HTTPS cookies use `Secure` in production.

## Enable Razorpay Test Mode

The integration code is implemented. The remaining external setup is your Razorpay **Test Mode** account credentials. These were intentionally left for you to add later.

1. Open the Razorpay Dashboard, select Test Mode and generate API keys.
2. Set **only in `backend/.env`**:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_secret
```

3. Restart the backend. Use Razorpay's automatic payment capture setting for the test integration.
4. Add a product → Cart → Checkout → enter shipping details → Place Order → complete Razorpay's Test Checkout.
5. The backend verifies the signature before marking the order `PAID` / `PLACED` and clearing the cart. Navbar becomes `Cart (0)` immediately. Confirmation and Orders pages display the saved purchase.
6. Also cancel or deliberately fail a test payment: a visible error appears, the cart stays intact, and no successful confirmation is shown.

Missing keys or Live Mode keys are rejected. The secret never enters React, an API response or MongoDB. `.env` is ignored by Git. No card/CVV form is implemented by ShopKart; Razorpay hosts payment entry. Until your keys are configured, actual provider payment is **not verified**. Automated tests use isolated provider doubles and cannot prove a real Razorpay transaction.

Official integration reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

## Requirements mapping

| Lab | Implementation |
| --- | --- |
| 01 | MVC, mandatory registration fields, unique normalized email, bcrypt hashes, JWT HttpOnly cookie, protected profile, logout, no password response; old-password-verified password-change bonus |
| 02 | Controlled React registration/login, validation, register → login → home, credentials, restored protected sessions, name/email/phone, navbar logout, responsive layout |
| 03 | Validated Product schema; create/list/detail APIs; literal case-insensitive name search; category and combined filters; dynamic API cards and details; loading/error/empty states; price-sort bonus |
| 04 | Persistent Product ObjectId wishlist, populated data, protected current-user APIs, duplicate 409, invalid/missing 400/404, save/remove/view/navigation, pending/error/retry states; toggle and backend-derived count bonuses |
| 05 | Product reference + integer quantity, protected add/read/update/delete, repeated-add increments, stock validation, populated latest products, persistence, global Cart Context, shared navbar units and derived subtotal, quantity controls, remove, loading/error/empty/retry |
| 06 | Validated shipping form, final summary, server cart/stock/pricing validation, immutable item snapshots, pending order, backend Razorpay order in paise, hosted Test Checkout, server HMAC verification, atomic paid-order/cart transaction, confirmation, private history/details APIs and pages, payment/script/cancellation/verification failure handling, loading/error/empty/retry |

`REQUIREMENTS_AUDIT.md` contains the detailed checklist. Payment provider verification requires credentials as described above; no incomplete preview page remains. Coursework requirements such as individual submission and viva still depend on the student.

Wishlist uses backend persistence and page/component state, respecting Lab 04's restriction on global wishlist state. Only the cart uses Context, as Lab 05 requires. No Redux, third-party authentication service or non-MERN backend/database is used. Razorpay is the payment provider explicitly required by Lab 06.

## Order status bonus

Set `ORDER_ADMIN_EMAILS=your_registered_email@example.com` in `backend/.env`, restart the backend, and use a paid order's details screen. Development-only buttons advance one step at a time:

`PLACED → CONFIRMED → SHIPPED → DELIVERED`

The protected endpoint is `PATCH /orders/:id/status` with `{ "status": "CONFIRMED" }`. Only allowlisted development accounts can manage their own orders. The endpoint is disabled in production; status skips and unpaid orders are rejected. Orders display status badges and a progression list.

## APIs

All endpoints also support an `/api` prefix. HttpOnly cookies are sent automatically by React, and bearer JWTs are accepted for API clients such as Postman. Missing, invalid, or expired authentication returns 401; identity always comes from the signed session, never a client `userId`.

| Method | Path | Body / behavior |
| --- | --- | --- |
| POST | `/customers/register` | `{fullName,email,password,phone}`; 201; duplicate 409; invalid 400 |
| POST | `/customers/login` | `{email,password}`; cookie + safe customer; invalid credentials 401 |
| GET | `/customers/me` | Protected safe profile |
| POST | `/customers/logout` | Protected cookie clearing |
| PATCH | `/customers/change-password` | `{oldPassword,newPassword}` |
| POST | `/products` | `{name,description,price,category,image,stock}`; public as Lab 03 permits |
| GET | `/products` | `search`, `category`, `sort=price_asc/price_desc` |
| GET | `/products/:id` | Single product; invalid 400, missing 404 |
| GET / POST / DELETE | `/wishlist` / `/wishlist/:productId` | Protected populated list/add/remove; duplicate 409 |
| GET | `/cart` | Protected populated cart |
| POST / PATCH / DELETE | `/cart/:productId` | Add/update/remove; PATCH `{quantity}`; rejects stock/quantity violations |
| POST | `/orders/create-payment-order` | `{shippingAddress:{fullName,phone,addressLine1,city,state,pincode}}`; protected; 201 safe Checkout data |
| POST | `/orders` | Alias for the lab's older test-plan URL |
| POST | `/orders/verify-payment` | `{shopKartOrderId,razorpay_order_id,razorpay_payment_id,razorpay_signature}`; protected signature verification |
| GET | `/orders` | Current user's orders, newest first |
| GET | `/orders/:id` | Current user's snapshot; another user's order returns 404 |
| PATCH | `/orders/:id/status` | Development-only authorized sequential status progression |

The server ignores client amounts/items, calculates INR paise using current Products, and stores name/price/quantity/image snapshots. Creating a Razorpay order does not clear the cart. Invalid signatures preserve the cart. Valid verification updates Order and Customer atomically, with safe retries: replaying a verified callback never deletes a newly populated cart. Failed provider creation persists a failed attempt without confirming an order. A lost verification response can be retried without another payment; public payment identifiers/signature are kept only in this customer's sessionStorage for recovery. The API never trusts a browser `paymentSuccess` boolean.

Conditional atomic wishlist insertion prevents concurrent duplicates. Optimistic concurrency retries prevent lost cart increments. Deleted products remain visible/removable in the cart and cannot be checked out. Search treats regex punctuation literally. Origin checks reject unapproved browser mutations.

## Tests

```powershell
npm test
npm run build
npm run test:ui
npm run test:checkout-ui
```

API tests cover all six labs using disposable databases, including a replica set for payment transactions. Tests do not touch normal customer data. They include shipping errors, empty/deleted/insufficient-stock carts, fake totals, missing/live-key rejection, provider failure, pending snapshots, forged signatures, ownership, transactional rollback, signed retry, replay safety, historical prices, persistence and status progression.

Browser suites drive actual React pages in headless Edge. They cover the original auth/catalog/wishlist/cart flow plus checkout client validation without server requests, Checkout options, provider failure/cancellation, verification retry, paid confirmation/cart reset, order persistence/history/errors, status progression, script-load failure and mobile layout. Razorpay APIs/Checkout are doubled only inside the isolated tests. Actual Razorpay verification remains pending your credentials. Screenshots are in `test-results/`; override `PLAYWRIGHT_CHANNEL` to use installed Chrome if needed.

Import `ShopKart.postman_collection.json` for manual lab testing. Postman keeps cookies after login. Product creation saves `productId`; payment creation saves `shopKartOrderId` and `razorpayOrderId`. Copy the genuine Test Checkout payment ID and signature into collection variables for verification. Never generate a signature on the frontend or treat a fake signature as a payment. Postman itself was not used to execute automated tests.

## Explanation for viva

- **Authentication:** bcrypt compares a password to its one-way hash. JWT identifies the customer. HttpOnly prevents JavaScript from reading the cookie. Middleware verifies the signed identity and loads the customer; `/me` restores the session after refresh.
- **Products and URLs:** MongoDB is the product source of truth. `/products/:id` selects one product; query parameters search/filter/sort a collection. React `.map()` renders API results.
- **Wishlist/cart:** Product references avoid duplicating prices and stock. `ref` identifies the model to populate. Wishlist needs only references; cart also needs quantity. Server checks stock regardless of disabled UI controls.
- **State:** Cart Context keeps Navbar, cards and totals consistent. Subtotal and total units are derived, never stored redundantly. Successful mutations replace shared state with server results. Logout clears client state while preserving MongoDB data.
- **Orders:** An order stores a historical snapshot so later product edits/deletions cannot rewrite purchase history. Shipping is validated on both sides. Latest products are checked again before checkout.
- **Payments:** Razorpay orders are created on the server with amounts in paise (`₹1 = 100`). The key secret stays server-side. Checkout's callback is evidence to verify, not permission to trust a boolean. HMAC SHA256 uses the database's Razorpay order ID and returned payment ID; constant-time comparison checks the signature. Only then does a transaction mark the order paid and clear the cart.
- **Failure handling:** Pending order creation, cancellation, declined payment, script failure and invalid signature leave the cart intact. Failed verification can be retried. Order ownership is part of every query. Progression controls are explicitly development-only.

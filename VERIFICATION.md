# Verification — 8 October 2026

All six statements in the supplied repository were downloaded/compared. Labs 01–05 are unchanged from 5 October; Lab 06 has been implemented. `REQUIREMENTS_AUDIT.md` maps every functional requirement and bonus to code and checks.

| Check | Result |
| --- | --- |
| `npm test` | 17 tests passed; 0 failures/cancellations on the final run |
| `npm run build` | Passed, Vite 8.3.2 |
| `npm run test:ui` | Original auth/catalog/wishlist/cart browser suite passed |
| `npm run test:checkout-ui` | Checkout/order browser suite passed with isolated Razorpay fixtures |
| Backend dependency audit | 0 reported vulnerabilities after SDK dependency fix |
| Frontend dependency audit | 0 reported vulnerabilities |
| Persistent local database | Converted development helper to `shopkart-rs` replica set, preserving existing database files |

API checks cover all earlier auth/product/wishlist/cart contracts, plus shipping fields/phone/pincode/whitespace, empty/deleted/stale-stock carts, forged totals/items, missing/live-key rejection, pending snapshots, provider request amounts/receipt, duplicate checkout request IDs, provider outage/cart preservation, fake and mismatched payment signatures, ownership, valid HMAC verification, transaction rollback, safe retries, callback replay preserving new cart contents, paid state/cart clearing, historical prices, reconnect persistence and gated sequential status progression.

Browser checks cover shipping client validation without API calls, Razorpay options in INR paise, failed/cancelled payment and preserved cart, verification outage/retry, paid confirmation/global Cart(0), persistent order history, empty/error/retry screens, status progression, script-load failure, desktop/mobile checkout, mobile orders and long payment references. The earlier suite was rerun for regressions. Both suites use real React pages in headless Edge and disposable databases, separate from normal customers.

Visual artifacts: `test-results/checkout-desktop.png`, `checkout-mobile.png`, `order-confirmation.png`, `orders-mobile.png`, `order-details-mobile.png`, plus the earlier catalog screenshots. Desktop checkout/confirmation were inspected. Mobile checks explicitly reject horizontal overflow.

The initial API run downloaded MongoDB, causing the old-lab test's 120-second timer to expire. Re-running after caching completed with all 17 tests passing. No feature failure was hidden by that initial timeout.

## Remaining external verification

The user explicitly deferred entering Razorpay keys. No normal credentials have been fabricated. The real SDK and hosted Checkout integration are implemented, but an actual Razorpay Test Mode payment has **not** been executed. Automated provider/Checkout doubles are restricted to isolated test files and establish application behavior, not provider credentials or a genuine provider transaction.

After adding `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to backend/.env and restarting the backend, run one successful Razorpay Test Checkout and one deliberately failed/cancelled payment. Confirm PAID/PLACED + Cart(0) on success, and preserved cart/no confirmation on failure. Never use Live Mode keys or real money for this lab.

The expanded Postman collection is provided for manual evaluation. Postman was not used to run automated tests. Individual submission/viva remain student responsibilities.

# Requirements audit — 8 October 2026

Source: the six exact problem statements saved under `requirements/`. Labs 01–05 matched their previously saved contents. Lab 06 is new. All functional requirements and optional bonuses have implementation coverage below. Actual Razorpay account/payment verification is the one external check deferred by the user until test keys are added.

| Requirement group | Coverage / evidence |
| --- | --- |
| Lab 01 schema, MVC, required fields, unique email, bcrypt | Customer model/controller, required-field/type/length/email/hash/duplicate API tests |
| Lab 01 JWT, HttpOnly cookie, profile protection, logout, safe responses | Auth middleware/token helper; missing/invalid/expired/Bearer/cookie/profile/logout tests |
| Lab 01 password change bonus | Protected endpoint + Home form; old-password failure and changed-login tests |
| Lab 02 controlled register/login, validation, redirect, cookies, protected Home, profile, logout | React forms, App session restore/protection, Navbar; original real-browser suite |
| Lab 03 product schema/create/list/detail/search/category/combined queries | Product model/controller; mandatory fields, price/stock/ID/search/filter API tests |
| Lab 03 dynamic cards/details/URL params/states/responsiveness | Products/ProductDetails/ProductCard; browser details/filter/loading/empty/error/retry/mobile checks |
| Lab 03 price sorting bonus | Server sorts and UI selector; ascending/descending API + browser tests |
| Lab 04 ObjectId/ref/default/persistence/populate/current-user identity | Customer wishlist + protected controller; MongoDB reference, population, reconnect and user-isolation tests |
| Lab 04 add/remove/duplicate/invalid/missing/unauthenticated statuses | Atomic conditional updates; 201/409/400/404/401 API tests |
| Lab 04 card save/loading/success/error/view/remove/nav/no reload, Wishlist page states | Local page/component state; API-backed dynamic cards; browser save/count/remove/empty/error/retry |
| Lab 04 toggle/count bonuses | Save/remove toggle and backend-derived Navbar count; browser checks |
| Lab 05 reference+quantity/default/stock/add increment/get/update/remove/protected APIs | Cart controller and schema; validation, concurrency, population and isolation tests |
| Lab 05 one global state, per-action loading, controls, dynamic units/subtotal/nav/persistence | Cart Context/ProductCard/Cart/Navbar; browser count/totals/refresh/re-login/removal tests |
| Lab 05 loading/empty/error/retry/current price/stock/no hardcoded data | API population and derived state; API current-price/stock + browser states; deleted references now removable |
| Lab 06 Order model: customer/product refs, name/price/quantity/image snapshots, address/total/status/timestamps/payment IDs | Order model; persisted pending/paid/failed snapshots and historical price tests |
| Lab 06 shipping: all fields, phone, six-digit pincode, whitespace rejection, client prevents invalid calls | Checkout form + backend validation; API tests and browser request-count assertions |
| Lab 06 final review, empty cart/deleted product/latest stock/latest prices/server total/fake total rejection | Checkout summary + order creation reloads raw authenticated cart/current Products; API tests |
| Lab 06 backend pending ShopKart order + Razorpay order creation in INR paise; safe key ID only | Razorpay SDK/config/controller; provider request assertions, failed-provider case and secret response check |
| Lab 06 frontend Standard Checkout, script-load failure, request/loading feedback, payment.failed/cancel errors | Checkout + Razorpay loader; browser test double exercises options, failure, dismissal, script failure |
| Lab 06 mandatory HMAC verification with stored Razorpay order ID | Crypto timing-safe signature comparison; forged/mismatched/valid fixture signature tests |
| Lab 06 PAID/PLACED only after verification; cart clears backend + Context + Navbar | Atomic transaction and acceptConfirmedCart; rollback/signed retry/replay API tests + browser Cart(0) |
| Lab 06 confirmation with ID/total/status/navigation | OrderDetails + `/order-success/:id`; real React browser confirmation test |
| Lab 06 My Orders newest first/private API/dynamic snapshots/loading/empty/error/retry | Protected list/get, Orders/OrderDetails; API isolation/persistence + browser empty/history/reload/error/retry |
| Lab 06 development status progression bonus | Allowlisted email and non-production guard, strictly sequential paid-order updates; API and browser tests |
| Submission artifacts | README explanation/run instructions, exact statements, expanded Postman collection, automated test scripts, verification report and screenshots |

## Deferred external verification

The user said they will add Razorpay keys later. `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are therefore not fabricated or populated. The normal app calls the actual Razorpay SDK and hosted Checkout when configured. Missing/live keys produce a clear setup error. Test doubles are confined to disposable test processes and are never enabled through a normal environment variable.

**Pending:** complete a genuine Razorpay Test Mode success and deliberate failed payment after keys are configured. Automated fixture-based tests prove application validation/state/signature/transaction behavior, but do not prove provider credentials or a real provider transaction.

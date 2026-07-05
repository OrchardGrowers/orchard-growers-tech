# Backend Review

## Scope

Reviewed only `apps/backend` against:

- `docs/PROJECT_CONSTITUTION.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/BUSINESS_RULES.md`
- `docs/DOMAIN_MODEL.md`
- `docs/IMPLEMENTATION_BACKLOG.md`

Note: `docs/PROJECT_OVERVIEW.md` is currently empty.

No code was modified.

## Executive Summary

The backend has a usable foundation for identity, KYC, grower lot creation, offers, deal/order creation, logistics assignment, delivery tracking, admin management, and ERP-style finance views.

The main incomplete area is the core financial transaction flow required by the constitution. Razorpay Route is not implemented. Current payment code uses BillDesk-style test escrow and Cashfree payment session/status/webhook routes. Settlement, documents, and ledgers exist as ERP schemas and derived/admin views, but they are not yet fully wired into a single immutable deal-payment-settlement-document-ledger workflow.

The second major concern is domain overlap. The same business concepts are split across `Product`, `Auction`, `Quotation`, `Order`, `Delivery`, `LogisticsShipment`, and ERP records. This is workable as a transitional architecture, but the next implementation should establish a canonical Deal/Transaction contract before adding more finance features.

## Backend Module Inventory

Implemented or partially implemented backend areas:

- Identity/auth: `authRoutes.js`, `authController.js`, `authMiddleware.js`, `User.js`
- User roles/profiles/KYC: `userRoutes.js`, `kycRoutes.js`, `userController.js`, `VerificationRequest.js`
- Admin ERP/RBAC: `adminRoutes.js`, `adminController.js`, `adminErpController.js`, `Admin.js`
- Lots/marketplace: `productRoutes.js`, `productController.js`, `Product.js`, `CaptureSession.js`
- Auction/deal compatibility: `auctionRoutes.js`, `Auction.js`, socket handlers in `server.js`
- Offers/quotes: `quotationRoutes.js`, `Quotation.js`
- Orders/payments/logistics assignment: `orderRoutes.js`, `Order.js`
- Payment providers: `billdeskRoutes.js`, `cashfreeRoutes.js`
- Delivery/tracking/settlement OTP: `deliveryRoutes.js`, `Delivery.js`
- Logistics admin/provider operations: `logisticsRoutes.js`, `logisticsController.js`, `LogisticsShipment.js`, `logistics/`
- ERP finance foundation: `ErpPaymentTransaction.js`, `ErpSettlement.js`, `ErpCommissionLedger.js`, `ErpDocumentRecord.js`, `ErpLedgerEntry.js`, `ErpAuditEvent.js`, `erpFinanceMaterializationService.js`
- Notifications foundation: `mailService.js`, `mobileOtpService.js`, `ErpNotificationLog.js`
- Extra modules outside the current backlog: Orchard AI leads, public profile publication, mandi rates, HSN, Cloudinary, sitemap/search

## Implementation Backlog Review

Legend:

- `[x]` Completed in backend
- `[/]` Partially implemented or foundation present
- `[ ]` Missing from backend

### EPIC 1 - Identity & Access

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | User Registration | `/api/auth/register`, OTP verification, password hashing, `User` model |
| [x] | User Login | `/api/auth/login` |
| [x] | JWT Authentication | `authMiddleware.js`, `jwt.verify`, protected routes |
| [x] | Refresh Token | `/api/auth/refresh` and JWT refresh secret |
| [x] | Role Assignment | `/api/user/set-role`, `/roles`, `/switch-role`, `/create-role-profile` |
| [/] | Permission Management | Role checks and admin role groups exist, but no dedicated `Permission` entity or granular permission management |
| [x] | Profile Management | `/api/user/profile`, profile media, public profiles |
| [x] | Verification (KYC) | `/api/kyc`, admin KYC review, `VerificationRequest` for OG verification |

### EPIC 2 - Marketplace

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | Lot Creation | Grower lot creation through `Product` with KYC gate and grade lots |
| [x] | Lot Images | Upload middleware, Cloudinary service, grade images, capture sessions |
| [ ] | Lot Approval | No dedicated lot approval workflow before marketplace visibility |
| [/] | Lot Search | `GET /api/products` and `/api/search` exist, but product search is not a dedicated robust lot search API |
| [/] | Lot Filters | Platform filtering exists; full fruit/grade/location/price/status filters are incomplete |
| [x] | Lot Details | `GET /api/products/:id` with auction/closed deal summary |

### EPIC 3 - Offer Management

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | Submit Offer | `/api/quotes`, `/api/quotes/lots/:lotId`, `Quotation` |
| [ ] | Counter Offer | No grower counter-offer entity or endpoint found |
| [x] | Accept Offer | `/api/quotes/:quoteId/accept` creates/updates `Order` and lot state |
| [x] | Reject Offer | `/api/quotes/:quoteId/reject` |
| [ ] | Offer History | No immutable offer/price history model; updates overwrite active quotation fields |

### EPIC 4 - Deal Management

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | Deal Creation | Accepted quote creates an `Order`; auction ending can also create `Order` |
| [x] | Deal Status | Status fields exist on `Product`, `Auction`, `Quotation`, and `Order` |
| [ ] | Deal Timeline | No canonical deal timeline or event history module found |
| [ ] | Deal Cancellation | Status enums include cancellation in places, but no complete cancellation workflow found |

### EPIC 5 - Payments

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [ ] | Razorpay Order | No Razorpay/Razorpay Route order route or service found |
| [/] | Payment Verification | Cashfree confirm/webhook and BillDesk test callback exist, but not Razorpay Route |
| [x] | Payment Status | Cashfree status, BillDesk status, and `Order.paymentStatus` exist |
| [/] | Failed Payments | Cashfree can mark failures, but no complete payment failure recovery workflow |
| [/] | Webhooks | Cashfree webhook exists; Razorpay Route webhook is missing |

### EPIC 6 - Settlement

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [/] | Split Settlement | Beneficiary mapping and ERP settlement records exist, but no Razorpay Route split settlement execution |
| [/] | Grower Settlement | Settlement eligibility and grower payout fields exist, but no real payout provider workflow |
| [x] | Commission Calculation | `dealCalculationService.js`, quote/order commission fields, ERP commission ledger |
| [/] | Settlement History | `ErpSettlement` has events and admin read APIs, but settlement creation is not fully wired into live payment flow |

### EPIC 7 - Logistics

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | Driver | Driver role/profile, assignment, acceptance/rejection |
| [/] | Vehicle | Vehicle fields exist on `User`/`Order`, but no dedicated `Vehicle` entity |
| [x] | Transport Assignment | `/api/orders/:id/logistics-assignment` and assignment accept/reject |
| [x] | Live Tracking | Delivery location updates and tracking routes exist |
| [ ] | Proof of Delivery | Delivery OTP exists, but no POD media/document workflow found |

### EPIC 8 - Documents

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [/] | Sale Bill | Invoice fields and ERP document records exist; no complete generated document file workflow |
| [ ] | Delivery Challan | Document type exists, but no generation workflow found |
| [ ] | Settlement Statement | Document type exists, but no generation workflow found |
| [/] | Commission Invoice | Order fields and ERP records exist; no complete document generation/delivery workflow |

### EPIC 9 - Accounting

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [/] | General Ledger | `ErpLedgerEntry` and admin ledger views exist, but posting is not fully integrated |
| [/] | Buyer Ledger | Party ledger fields exist, but no buyer-specific ledger module/API |
| [/] | Grower Ledger | Party ledger fields exist, but no grower-specific ledger module/API |
| [/] | Journal Entries | Journal numbers exist in materialization service, but no explicit journal posting/void workflow |

### EPIC 10 - Admin ERP

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | Dashboard | `/api/admin/erp/dashboard` |
| [x] | Analytics | `/api/admin/analytics` and ERP dashboard analytics |
| [/] | Reports | ERP list endpoints exist, but export/reporting workflows are incomplete |
| [/] | Audit Logs | Admin embedded audit logs and `ErpAuditEvent` exist; not yet universal for all important actions |
| [x] | User Management | `/api/admin/users`, status updates, KYC/verification reviews |

### EPIC 11 - Notifications

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [x] | Email | `mailService.js`, OTP/admin reset email |
| [x] | SMS | `mobileOtpService.js`, offer/logistics SMS calls |
| [ ] | Push Notification | No push notification sender/service found |
| [ ] | In-App Notification | No in-app notification module/API found |

### EPIC 12 - Testing

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [/] | Unit Testing | Vitest exists, but tests are concentrated around Orchard AI/profile publication |
| [/] | API Testing | Orchard AI route tests exist; core marketplace/payment tests are missing |
| [ ] | Integration Testing | No core integration test suite found |
| [ ] | Payment Testing | No Razorpay/payment integration test suite found |
| [ ] | Security Testing | No backend security test suite found |
| [ ] | Performance Testing | No performance test suite found |

### Production

| Status | Backlog Item | Backend Evidence |
| --- | --- | --- |
| [ ] | UAT | No backend evidence found |
| [ ] | Production Deployment | No backend deployment evidence reviewed in `apps/backend` |
| [/] | Monitoring | Health endpoints and logs exist; full monitoring/alerting not found |
| [ ] | Backup Strategy | No backend backup strategy found |

## Missing Backend Modules

1. Razorpay Route payment module
   - Razorpay order creation
   - Payment verification
   - Webhook processing
   - Route account/beneficiary onboarding
   - Split settlement and payout reconciliation

2. Canonical Deal module
   - Dedicated deal identifier and lifecycle
   - Single source of truth for accepted offer/order/payment/logistics/documents/accounting
   - Timeline/event history
   - Cancellation workflow

3. Counter-offer and offer history module
   - Counter offers linked to original offers
   - Immutable offer price history
   - Buyer/grower offer event trail

4. Lot approval and soft-delete workflow
   - Admin approval before marketplace publication
   - Status transitions for draft/pending/approved/rejected/archived
   - Soft delete instead of physical delete for lots and dependent business data

5. Proof of Delivery module
   - POD upload/capture
   - POD verification
   - Linkage to delivery, deal, settlement, and documents

6. Document generation module
   - Sale bill files
   - Delivery challan files
   - Settlement statement files
   - Commission invoice files
   - Immutable versioning and storage links

7. Accounting posting module
   - Double-entry posting service
   - Buyer/grower/commission/escrow ledgers
   - Journal posting, reversal, and void controls
   - Automatic posting from payment/settlement events

8. Settlement execution module
   - Settlement batches
   - Provider payout status
   - Failed settlement manual review
   - Immutable completion records

9. Granular permission module
   - Dedicated `Permission` entity
   - Permission assignment per admin role/class
   - Sensitive finance operation permissions

10. Notification module
    - Notification templates
    - In-app notifications
    - Push notification provider
    - Centralized notification logs wired into outbound email/SMS/push

11. Disputes, refunds, wallet, and adjustments
    - Domain model lists these entities, but backend support is only partial or read-only foundation.

12. Core test suites
    - Marketplace flow tests
    - Offer/deal/order tests
    - Payment/settlement tests
    - RBAC/security tests
    - API integration tests

## Duplicate Or Overlapping Modules

1. `Product` as both catalog product and eFruitMandi lot
   - `Product.createdSource`, `inventoryType`, and `gradeLots` distinguish use cases.
   - This is workable but makes lot-specific rules harder to enforce.

2. `Auction`, `Quotation`, and `Order` all represent parts of deal flow
   - `Auction` handles live deal/bid behavior.
   - `Quotation` handles structured offers.
   - `Order` becomes the transaction record.
   - A canonical `Deal` boundary is missing.

3. `/api/auctions` and `/api/deals`
   - Same router mounted under both names for compatibility.
   - Socket events also maintain legacy and business aliases: `placeDeal`, `submitQuote`, `dealUpdate`, `quoteUpdate`.

4. REST quotes and socket auction quotes overlap
   - REST `/api/quotes` creates `Quotation` records.
   - Socket `submitQuote` updates `Auction` highest bid without creating quotation history.

5. Stale/unmounted controllers
   - `controllers/auctionController.js` and `controllers/orderController.js` export legacy handlers that are not mounted by the current route files.

6. Payments are split across non-target providers
   - `billdeskRoutes.js` and `cashfreeRoutes.js` exist.
   - ERP models include `RAZORPAY_ROUTE`, but no Razorpay implementation exists.

7. Verification and KYC overlap
   - KYC is stored inside `User.kyc` and `User.kycByRole`.
   - OG verification uses `VerificationRequest` and `ogVerificationByRole`.
   - Admin review routes handle both concepts.

8. Logistics split across three concepts
   - `Order.logisticsAssignment` for marketplace assignment.
   - `Delivery` for driver delivery/OTP/location.
   - `LogisticsShipment` for admin courier/provider operations.

9. Audit records overlap
   - `Admin.auditLogs` stores embedded admin audit events.
   - `ErpAuditEvent` stores ERP-style audit events.
   - Important marketplace/payment actions are not yet consistently audited.

10. Mandi rate route alias
    - `mandiRatesRoutes.js` only re-exports `mandiRates.js`.

## Constitution And Business Rule Gaps

- Razorpay Route is required by the constitution but is not implemented.
- Financial traceability is only partially complete because settlements, documents, ledgers, and payments are not always created together from the same canonical deal event.
- Completed settlements are not yet clearly immutable through service/API constraints.
- Audit history is not universal across all important actions.
- Soft delete is not consistently followed. Some code physically deletes products, auctions, quotations, users, admins, and leads.
- One user can support multiple roles, which is implemented, but granular permission management is not.
- POD is mandatory before completion per business rules, but the backend currently relies on delivery OTP rather than POD records.
- Reporting export is not implemented.

## Recommended Next Implementation Priority

Priority: implement the canonical deal-to-payment-to-settlement backbone, starting with Razorpay Route.

Recommended order:

1. Define a canonical `Deal` service/contract without breaking current routes.
   - Accepted `Quotation` and completed `Auction` should both create or attach to the same canonical deal transaction.
   - Preserve existing `/api/auctions`, `/api/deals`, `/api/quotes`, and `/api/orders` behavior as compatibility layers.

2. Implement Razorpay Route payment and webhook flow.
   - Create Razorpay orders from confirmed deals.
   - Verify buyer payments.
   - Persist payment transactions.
   - Process webhooks idempotently.

3. Wire split settlement to the same flow.
   - Create grower/platform/logistics settlement rows.
   - Track settlement eligibility and provider payout status.
   - Handle failed settlements and manual review.

4. Materialize documents and ledgers from payment/settlement events.
   - Sale bill, commission invoice, settlement statement, and ledger entries should be generated from the same transaction event.
   - Ensure every settlement links to deal, payment, document, and ledger entry.

This priority unlocks the core business flow after offer acceptance and reduces the largest mismatch between the current backend and the project constitution.

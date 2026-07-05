# Local Fix Report

Date: 2026-07-05

## Problem Fixed

The eFruitMandi home page could show expired, ended, or otherwise incomplete lots inside "Recently Closed Deals" because closed-looking lot or auction statuses were being treated as completed deals.

The fix now requires an actual completed marketplace order signal before a lot can appear as closed:

- Payment status is `ESCROW`, `PAID`, or `RELEASED`; or
- Delivery status is `DELIVERED`.

Expired, cancelled, deleted, ended, unpaid, abandoned, pending-payment, and quote-accepted-only records are not treated as completed deals.

## Backend Changes

- Centralized lifecycle rules in `apps/backend/services/dealLifecycleService.js`.
- Public auction and product list responses now attach an explicit completed lifecycle marker only when a completed order exists.
- Expired or past-end-time public lots/auctions are hidden unless backed by a completed order.
- Lot detail closed-deal summaries now require a completed order; accepted quotes or ended auctions alone no longer produce a "Deal Closed" summary.
- ERP documents and ledger-derived rows now filter against the same completed-order rule.
- ERP materialization skips commission, settlement, document, and ledger artifacts for incomplete orders.

## Frontend Changes

- `apps/efruitmandi-frontend/src/utils/marketplaceVisibility.js` no longer treats raw `ENDED`, `SOLD`, `QUOTE_ACCEPTED`, `DEAL_CONFIRMED`, `CLOSED`, or `EXPIRED` statuses as completed deals.
- `apps/efruitmandi-frontend/src/pages/Home.js` shows only live lots and truly completed closed deals on the home feed.
- Past-end-time lots without a completed order resolve to a non-feed "Deal Ended" state, not "Deal Closed".
- `apps/efruitmandi-frontend/src/pages/LotDetails.js` uses the same completed-deal visibility rule for closed badges.

## Admin Panel Review

The admin panel already had eFruitMandi Deal Management and Invoices / Chalan sections in the existing theme, so no new route or redesign was needed.

Small lifecycle UI fixes were added in-place:

- Completed deal counts now use the completed-order rule.
- Invoices / Chalan rows now exclude incomplete, unpaid, or pending-payment orders.
- Existing dark theme cards, tables, and metric components were preserved.

## Verification

- Ran `npm run build` in `apps/efruitmandi-frontend`: passed.
- Ran `npm run build` in `apps/admin-panel`: passed.
- Ran backend syntax checks with `node --check`: passed for `server.js`, lifecycle service, auction routes, product controller, and admin ERP controller.
- Ran backend start check with `PORT=0`: server started and stayed alive long enough to initialize.

Backend start check caveat:

- Local MongoDB was not reachable at `127.0.0.1:27017`, so the backend logged DB-offline retry messages during startup.
- The temporary backend process started for the check was stopped afterward.

## Commit

No commit was made.

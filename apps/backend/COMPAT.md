Compatibility notes: auction -> deals/quotes
===========================================

Purpose
-------
This file documents lightweight backward-compatible aliases added to the backend to allow a gradual migration
from internal naming that used `auction`/`bid` to business-friendly naming `deal`/`quote`/`quotedPrice`.

What was added
--------------
- Route aliases (same router mounted under multiple paths):
  - `/api/auctions` (legacy)
  - `/api/deals` (alias)
  - `/api/quotes` (alias)

- Socket event aliases and duplicate emits:
  - Legacy events kept: `joinAuction`, `placeDeal`, `dealUpdate`, `auctionStarted`, `auctionEnded`.
  - New aliases emitted in addition to legacy events: `dealStarted`, `dealEnded`.

Notes for frontend teams
-----------------------
- You can start calling the new HTTP endpoints under `/api/deals` and `/api/quotes` immediately — they
  are handled by the same router as `/api/auctions` and are backward compatible.
- Real-time: servers will emit both legacy and new event names. Client teams can listen for either or both.
  Recommended transition path:
  1. Add listeners for the new event names (`dealStarted`, `dealEnded`, `quoteUpdate`) while keeping
     existing listeners for `auctionStarted`/`auctionEnded`/`dealUpdate`.
  2. After all clients are migrated and monitored in staging, remove the legacy listeners.

Security & Compatibility
------------------------
- No runtime behavior changed for existing endpoints; only aliases/duplicate emits were added.
- Keep an eye on logs for duplicate processing if clients act on both legacy and alias events — initial
  deployment should use feature flags or staging rollout and telemetry.

Where to look
-------------
- Main server: `apps/backend/server.js`
- Auction router: `apps/backend/routes/auctionRoutes.js`

If you need a one-line patch to replace client event names, I can prepare sample frontend diffs for you.

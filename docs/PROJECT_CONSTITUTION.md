# eFruitMandi Project Constitution

## Project
eFruitMandi.live

## Company
Orchard Growers Private Limited

## Business Type
Agricultural marketplace for fruit growers, buyers, logistics partners, and administrators.

## Non-Negotiable Rules
- Do not change existing UI/UX unless explicitly approved.
- Do not remove existing routes unless explicitly approved.
- Do not break existing APIs.
- Do not remove working features.
- Extend existing modules instead of replacing them.
- Maintain backward compatibility.

## Architecture Rules
- Use enterprise-grade, modular architecture.
- Every major business entity must have a unique identifier.
- Every major business entity must support status tracking.
- Every major business entity must support audit history.
- Prefer soft delete over hard delete.
- Every financial transaction must be traceable.
- Every settlement must be linked to a deal, payment, document, and ledger entry.
- One user account can support multiple roles in the future.

## Business Flow
Grower creates lot.
Buyer submits offer.
Grower accepts, rejects, or counters offer.
Deal is confirmed.
Buyer makes payment.
Payment is processed through Razorpay Route.
Settlement is split between grower and Orchard Growers Private Limited.
Documents and ledgers are generated.
Transaction is completed after delivery and settlement.

## Payment Rule
Razorpay Route is the intended split-settlement system.

## Admin Rule
Admin panel must support multiple permission levels for operations, finance, support, management, and super admin.

## Development Rule
All future development must follow this constitution.

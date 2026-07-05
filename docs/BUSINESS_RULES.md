# Business Rules

## Project
eFruitMandi.live

## Purpose

This document defines the business rules that govern the eFruitMandi marketplace. These rules are mandatory for all modules, APIs, reports, and future development.

---

# User Rules

- One user must have only one account.
- One account can support multiple roles in the future.
- User identity remains permanent.
- Every user must complete required verification before accessing restricted features.

---

# Marketplace Rules

- Only verified growers can create lots.
- Every lot belongs to exactly one grower.
- A lot can receive multiple offers.
- A buyer can submit multiple offers on different lots.
- The grower may Accept, Reject, or Counter an offer.
- A confirmed offer becomes a Deal.
- Once confirmed, the deal becomes the master business transaction.

---

# Pricing Rules

- Buyers determine offer prices.
- Growers decide whether to accept or reject offers.
- Counter offers remain linked to the original offer.
- Every price change must be recorded in price history.

---

# Payment Rules

- Payment is allowed only after deal confirmation.
- Razorpay Route is the intended payment gateway.
- Split settlement distributes funds according to business rules.
- Commission is deducted before grower settlement.
- Every payment must generate an audit record.

---

# Settlement Rules

- Every settlement must reference a payment.
- Settlement status must always be traceable.
- Failed settlements require manual review.
- Completed settlements become immutable financial records.

---

# Logistics Rules

- Logistics starts only after successful payment.
- Every shipment must have delivery tracking.
- Proof of Delivery (POD) is mandatory before order completion.

---

# Document Rules

The system automatically generates business documents where applicable.

Examples include:

- Sale Bill
- Delivery Challan
- Commission Invoice
- Settlement Statement
- Refund Voucher

Documents are permanent records and cannot be physically deleted.

---

# Accounting Rules

Every financial activity must create accounting entries.

Examples:

- Buyer Payment
- Commission
- Settlement
- Refund
- Adjustment

Accounting history must remain permanent.

---

# Audit Rules

Every important action must record:

- Created By
- Updated By
- Approved By
- Timestamp
- Status
- Version

Audit history must never be removed.

---

# Security Rules

- Role Based Access Control (RBAC) is mandatory.
- Users may access only authorized resources.
- Sensitive financial operations require elevated permissions.

---

# Reporting Rules

Every module must support:

- Search
- Filtering
- Sorting
- Export
- Analytics

---

# Future Expansion

The architecture must support:

- Additional user roles
- Multiple payment gateways
- Multiple logistics providers
- GST automation
- AI recommendations
- International expansion


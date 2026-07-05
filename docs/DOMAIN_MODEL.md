# Enterprise Domain Model

## Purpose

This document defines the core business domains of eFruitMandi. It is independent of database design and implementation.

---

# Identity Domain

Entities

- User
- Profile
- Role
- Permission
- Authentication
- Verification
- Notification Preference

Owner

Identity Management

---

# Marketplace Domain

Entities

- Lot
- Offer
- Counter Offer
- Deal
- Category
- Fruit Variety
- Grade
- Packaging
- Season
- Price History

Owner

Marketplace Operations

---

# Transaction Domain

Entities

- Payment
- Escrow
- Settlement
- Commission
- Wallet
- Refund
- Adjustment
- Dispute

Owner

Finance

---

# Logistics Domain

Entities

- Transporter
- Driver
- Vehicle
- Trip
- Delivery
- Tracking
- Proof of Delivery (POD)

Owner

Logistics

---

# Document Domain

Entities

- Sale Bill
- Delivery Challan
- Commission Invoice
- Settlement Statement
- Refund Voucher
- Audit Log

Owner

Documentation System

---

# Accounting Domain

Entities

- General Ledger
- Buyer Ledger
- Grower Ledger
- Settlement Ledger
- Commission Ledger
- Escrow Ledger
- Journal Entry

Owner

Accounting

---

# Administration Domain

Entities

- Admin User
- Operations
- Finance
- Customer Support
- Analytics
- Audit

Owner

Administration

---

# Master User Principle

A single user account may have one or more business roles.

Examples

User
 ├── Grower
 ├── Buyer
 ├── Driver
 ├── Transporter
 └── Future Roles

No duplicate user accounts should exist.

---

# Master Transaction Principle

Every completed business transaction originates from a Deal.

Deal
 ├── Payment
 ├── Settlement
 ├── Logistics
 ├── Documents
 ├── Accounting
 ├── Notifications
 └── Audit

Every downstream process references the originating Deal.

---

# Cross-Domain Principles

- Domains communicate through services.
- Business entities remain independent.
- Financial records are immutable after finalization.
- Audit history is mandatory.
- Future modules must integrate without breaking existing domains.


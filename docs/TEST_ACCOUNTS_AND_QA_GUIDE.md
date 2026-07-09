# eFruitMandi Test Accounts and QA Guide

Company: Orchard Growers Private Limited
Platform: eFruitMandi.live

## Purpose

This document defines official test accounts for local testing, live QA, Play Store review, payment gateway verification, logistics testing, and external provider testing.

These accounts must be used instead of personal, real customer, real grower, or super admin accounts.

## Why Test Accounts Are Required

Test accounts are required for:

* Local development testing
* Live production smoke testing
* Razorpay Route testing
* Future payment gateway testing
* Play Store app review
* Logistics workflow testing
* Auction and order lifecycle testing
* External provider support/debugging
* Internal QA and regression testing

## Golden Rule

Never share real production user credentials, real grower credentials, real buyer credentials, or super admin credentials with any external party.

Only demo/test credentials should be shared.

## Core Test Accounts

### Buyer Test Account

Name: Test Buyer
Email: [buyer.test@efruitmandi.live](mailto:buyer.test@efruitmandi.live)
Role: BUYER
Purpose:

* Login testing
* Auction bidding
* Order creation
* Razorpay payment testing
* Escrow payment testing
* Play Store review testing

### Grower Test Account

Name: Test Grower
Email: [grower.test@efruitmandi.live](mailto:grower.test@efruitmandi.live)
Role: GROWER
Purpose:

* Fruit lot creation
* Auction listing
* Grower settlement testing
* Razorpay Route linked account testing
* ERP settlement testing

### Logistics / Driver Test Account

Name: Test Driver
Email: [driver.test@efruitmandi.live](mailto:driver.test@efruitmandi.live)
Role: DRIVER
Purpose:

* Pickup assignment
* Delivery tracking
* Logistics workflow testing
* Trip status testing
* Delivery completion testing

### Admin Demo Account

Name: Demo Admin
Email: [admin.demo@efruitmandi.live](mailto:admin.demo@efruitmandi.live)
Role: ADMIN
Purpose:

* Admin panel testing
* Play Store reviewer access
* External support testing
* Payment provider verification
* QA review

Important: This account must not have super admin privileges unless specifically required.

## Recommended Environment-Specific Accounts

### Local Testing

[buyer.local@efruitmandi.live](mailto:buyer.local@efruitmandi.live)
[grower.local@efruitmandi.live](mailto:grower.local@efruitmandi.live)
[driver.local@efruitmandi.live](mailto:driver.local@efruitmandi.live)
[admin.local@efruitmandi.live](mailto:admin.local@efruitmandi.live)

### Live Demo / Play Store Review

[buyer.demo@efruitmandi.live](mailto:buyer.demo@efruitmandi.live)
[grower.demo@efruitmandi.live](mailto:grower.demo@efruitmandi.live)
[driver.demo@efruitmandi.live](mailto:driver.demo@efruitmandi.live)
[admin.demo@efruitmandi.live](mailto:admin.demo@efruitmandi.live)

### Razorpay Testing

[buyer.razorpay@efruitmandi.live](mailto:buyer.razorpay@efruitmandi.live)
[grower.razorpay@efruitmandi.live](mailto:grower.razorpay@efruitmandi.live)
[driver.razorpay@efruitmandi.live](mailto:driver.razorpay@efruitmandi.live)
[admin.razorpay@efruitmandi.live](mailto:admin.razorpay@efruitmandi.live)

## Password Policy

Passwords must be strong and stored securely.

Recommended format:

EFM-Test-Role-Year-Symbol

Example:

EFM-Test-Buyer-2026@123

Do not commit real passwords into GitHub.

If credentials are needed for documentation, use placeholders only.

## Credential Sharing Policy

Allowed to share demo credentials with:

* Google Play Store review team
* Razorpay support
* Cashfree support
* BillDesk support
* Internal QA team
* Trusted development team members

Not allowed to share:

* Super admin credentials
* Personal user credentials
* Real grower accounts
* Real buyer accounts
* Real bank-linked accounts
* Production payment secret keys

## Payment Testing Rule

Payment gateway testing must always use buyer test accounts.

The payment lifecycle must remain:

Buyer
→ Auction Ends
→ Order Created
→ Buyer Pays
→ Escrow
→ Logistics
→ Delivery
→ Settlement
→ Grower Payment
→ Platform Commission

Only the payment provider may change.

## Razorpay Route Test Account

Current Razorpay test linked account:

acc_TA9YAal8HsORS0

This account should be used only for Razorpay Route testing until production linked accounts are configured.

## Required Test Data

For complete payment testing, the system must have:

* One active buyer test account
* One active grower test account
* One active logistics/driver account
* One fruit lot created by test grower
* One completed auction
* One pending order with paymentStatus = PENDING
* One Razorpay test payment
* One escrow status update
* One logistics assignment
* One delivered order
* One settlement record

## Minimum QA Flow

1. Login as grower.
2. Create fruit lot.
3. Login as buyer.
4. Place bid.
5. End auction.
6. Confirm order is created.
7. Confirm order paymentStatus is PENDING.
8. Create Razorpay order.
9. Open Razorpay checkout.
10. Complete test payment.
11. Verify payment.
12. Confirm paymentStatus becomes ESCROW.
13. Assign logistics.
14. Mark delivery completed.
15. Trigger settlement.
16. Confirm grower payout and platform commission.

## Production Safety Rules

* Test accounts must be clearly identifiable.
* Test orders should not be mixed with real customer orders.
* Admin panel should allow filtering test/demo records if needed.
* Payment gateway test mode must not be confused with live mode.
* Never delete existing business logic during testing.
* Never remove BillDesk or Cashfree code until Razorpay is fully verified.

## Implementation Notes

Test accounts can be created through:

1. Existing registration APIs
2. Admin panel
3. Safe backend seed script

Preferred method for local and staging:

Safe backend seed script.

Preferred method for production demo:

Admin-created controlled accounts.

## Next Implementation Step

Create a safe seed script that:

* Creates test buyer
* Creates test grower
* Creates test driver
* Creates demo admin
* Does not duplicate users if they already exist
* Does not overwrite real users
* Uses environment variables for passwords
* Prints login emails only, not passwords

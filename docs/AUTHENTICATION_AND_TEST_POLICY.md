# Test OTP, Play Store Review, and Demo Account Policy

## Purpose

This policy defines how eFruitMandi handles OTP testing, demo accounts, Play Store review access, and production security.

The goal is to support smooth testing without weakening production authentication.

---

# Environment Policy

## Local Development

Local development may use test OTP mode.

```env
ALLOW_TEST_OTP=true
TEST_OTP=123456
```

Purpose:

* Developer testing
* Local QA
* Razorpay sandbox testing
* Automated test flows

---

## Staging / UAT

Staging may use test OTP mode when required.

```env
ALLOW_TEST_OTP=true
TEST_OTP=123456
```

Purpose:

* Internal QA
* Payment gateway sandbox testing
* Regression testing
* Demo flow verification

---

## Production

Production must not use open test OTP mode.

```env
ALLOW_TEST_OTP=false
```

Purpose:

* Real user security
* OTP integrity
* Payment safety
* Compliance
* Audit protection

---

# Play Store Review Policy

Play Store reviewers must not receive real user credentials or super admin credentials.

Play Store review should use dedicated demo accounts only.

Recommended accounts:

```text
testbuyer@efruitmandi.live
testgrower@efruitmandi.live
testdriver@efruitmandi.live
```

These accounts should have:

* Verified login
* Completed role profile
* Demo KYC status
* Demo auction/order data
* Safe non-real payment flow where applicable

---

# Optional Future Review Mode

If Play Store review requires simplified OTP access, implement a restricted review mode later.

Example environment variables:

```env
PLAY_STORE_REVIEW_MODE=false
PLAY_STORE_TEST_EMAIL=testbuyer@efruitmandi.live
PLAY_STORE_TEST_PHONE=1234567890
PLAY_STORE_TEST_OTP=123456
```

Review mode rules:

* Must work only for predefined demo accounts.
* Must not work for real users.
* Must be disabled by default.
* Must be enabled only for a limited review/testing window.
* Must be disabled immediately after review completion.
* Must never expose super admin access.
* Must never bypass payment security for real transactions.

---

# Forbidden Practices

Never enable unrestricted test OTP in production.

Never share:

* Super admin credentials
* Real buyer credentials
* Real grower credentials
* Real logistics credentials
* Razorpay secret keys
* Database credentials
* Production admin access

Never allow test OTP for arbitrary production users.

---

# Recommended Production Approach

Production should use normal OTP delivery.

Demo accounts should be prepared in advance and should follow the same login/security flow as real users unless restricted Review Mode is intentionally enabled.

---

# Current Implementation Decision

For now:

```text
Local Development:
ALLOW_TEST_OTP=true

Production:
ALLOW_TEST_OTP=false

Play Store Review Mode:
Not implemented yet
```

Play Store demo account handling will be implemented later as a controlled and restricted feature.

---

# Next Payment Testing Scope

Continue Razorpay testing using local development test OTP mode first.

After local Razorpay flow is verified, repeat the flow on staging or production demo accounts according to the environment policy.

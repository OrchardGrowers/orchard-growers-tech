# Contact Identity & Role Combination Rules

## Business Objective

A single individual should be able to operate multiple businesses within the eFruitMandi ecosystem using **one login account**, **one email address**, and **one mobile number**, while maintaining business integrity and preventing conflicts of interest.

These rules are mandatory across the Backend, Frontend, Admin Panel, Mobile App, ERP, Logistics, Auction, Settlement, and Payment modules.

---

# Identity Rules

Each person owns only **one User Account**.

A User Account is uniquely identified by:

* Email Address
* Mobile Number

Both remain the primary identity of the user throughout the platform.

All business profiles are attached to this single authenticated user account.

---

# Supported Business Profiles

A User Account may create the following profiles:

* Fruit Buyer
* Fruit Grower
* Logistics Partner

These are business profiles, **not separate login accounts**.

---

# Contact Information

All supported business profiles share the same:

* Email Address
* Mobile Number

No additional login account is required when creating another allowed profile.

Example:

Email

```text
qa.user@efruitmandi.live
```

Mobile

```text
9876543210
```

Profiles

```text
✓ Buyer
✓ Grower
```

---

# Allowed Profile Combinations

## Buyer + Grower

**Allowed**

The same Email Address and Mobile Number may be used.

Reason:

Many fruit growers also purchase fruits from other growers for resale or trading.

---

## Grower + Logistics

**Allowed**

The same Email Address and Mobile Number may be used.

Reason:

Many growers transport their own produce using their own logistics vehicles.

---

# Restricted Profile Combination

## Buyer + Logistics

**Not Allowed**

The same Email Address and Mobile Number cannot simultaneously own both:

* Buyer Profile
* Logistics Profile

Reason:

To prevent conflicts of interest between purchasing operations and transportation operations.

This separation protects:

* Auction fairness
* Logistics neutrality
* Delivery workflow
* Settlement integrity
* Financial transparency
* ERP accounting
* Platform compliance
* Audit requirements

---

# Validation Matrix

| Buyer | Grower | Logistics | Same Email | Same Mobile | Allowed |
| ----- | ------ | --------- | ---------- | ----------- | ------- |
| ✓     | ✗      | ✗         | ✓          | ✓           | Yes     |
| ✗     | ✓      | ✗         | ✓          | ✓           | Yes     |
| ✗     | ✗      | ✓         | ✓          | ✓           | Yes     |
| ✓     | ✓      | ✗         | ✓          | ✓           | Yes     |
| ✗     | ✓      | ✓         | ✓          | ✓           | Yes     |
| ✓     | ✗      | ✓         | ✓          | ✓           | **No**  |
| ✓     | ✓      | ✓         | ✓          | ✓           | **No**  |

---

# Profile Creation Rules

## Creating Buyer Profile

Allowed when:

* User has no profile.
* User already owns a Grower profile.

Rejected when:

* User already owns a Logistics profile.

---

## Creating Grower Profile

Allowed when:

* User has no profile.
* User already owns a Buyer profile.
* User already owns a Logistics profile.

---

## Creating Logistics Profile

Allowed when:

* User has no profile.
* User already owns a Grower profile.

Rejected when:

* User already owns a Buyer profile.

---

# Role Switching

A User may own multiple allowed profiles.

Only one profile remains active at any time.

Example:

```text
Login

↓

Buyer Profile

↓

Switch Role

↓

Grower Profile

↓

Switch Role

↓

Buyer Profile
```

Authentication does not change.

Only the active business profile changes.

---

# Implementation Rules

These validations must be enforced only during:

* Create Role Profile
* Add New Profile
* Switch Role (role existence validation)

These rules must **not** affect:

* User Signup
* User Login
* OTP Verification
* Password Reset

---

# Future Compatibility

Future business profiles such as:

* Exporter
* Commission Agent
* Cold Storage
* Warehouse
* Retailer
* Quality Inspector

must define their compatibility with existing profiles before implementation.

No new profile type may bypass these business rules without updating this architecture document.

# Identity and Access Management (IAM)

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V08-D24

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

This document defines the Identity and Access Management (IAM) framework for the Digital Fruit Intelligence Platform.

Its purpose is to ensure that every person, device, service, and application interacting with the platform is uniquely identified, authenticated, authorized, and continuously governed.

IAM protects the platform without restricting legitimate business operations.

---

# 2. Objectives

The IAM framework shall:

- uniquely identify every entity
- authenticate users securely
- authorize platform actions
- support role-based permissions
- manage device identities
- protect privileged access
- maintain complete auditability

---

# 3. Identity Model

The platform may manage identities for:

- Growers
- Buyers
- Logistics Partners
- Inspectors
- Platform Administrators
- Super Administrators
- AI Services
- Internal Services
- Hardware Devices
- External Integrations

Each identity should possess a unique platform identifier.

---

# 4. Authentication

Supported authentication methods may include:

- email authentication
- mobile OTP
- password authentication
- multi-factor authentication (MFA)
- API keys
- service accounts
- device certificates

Authentication methods should evolve independently from business workflows.

---

# 5. Authorization

Authorization should determine:

- accessible modules
- permitted operations
- resource ownership
- administrative privileges
- device permissions
- API permissions

Authorization should always occur after successful authentication.

---

# 6. Role-Based Access Control

Platform roles may include:

- Grower
- Buyer
- Logistics Partner
- Inspector
- Customer Support
- Finance
- Operations
- Administrator
- Super Administrator
- System Service

Future roles may be added without redesigning the authorization framework.

---

# 7. Least Privilege

Every identity should receive only the permissions required to perform its responsibilities.

Unused privileges should not be granted by default.

Privileged access should be periodically reviewed.

---

# 8. Session Management

The platform may support:

- secure session creation
- session expiration
- session renewal
- concurrent session policies
- forced logout
- suspicious activity detection

Sessions should remain traceable.

---

# 9. Device Identity

Every registered device may include:

- device identifier
- registration status
- owner reference
- firmware version
- trust status
- synchronization status

Devices should authenticate before accessing protected services.

---

# 10. Audit Logging

IAM events may include:

- user login
- logout
- authentication failure
- password change
- OTP verification
- role changes
- permission changes
- device registration
- administrative actions

Audit logs should remain immutable whenever practical.

---

# 11. Future Evolution

Future IAM capabilities may include:

- biometric authentication
- passwordless authentication
- hardware security keys
- enterprise SSO
- federated identity
- adaptive authentication
- risk-based authentication

---

# 12. Design Principles

The IAM framework should remain:

- secure
- modular
- auditable
- scalable
- privacy-aware
- standards-aligned
- resilient
- backward compatible

---

# Document Dependencies

- 23_Platform_Security_Architecture.md
- 13_AI_Governance.md
- 20_Hardware_Architecture.md

# Next Document

25_Data_Protection_and_Privacy.md
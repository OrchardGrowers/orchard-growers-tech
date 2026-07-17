# Capture Pipeline

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V02-D04

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

This document defines the complete image acquisition pipeline used by the Live Scanner.

The Capture Pipeline is responsible for collecting high-quality media in a structured, repeatable, and auditable manner before inspection begins.

It defines the lifecycle from camera initialization to successful upload.

---

# 2. Objectives

The Capture Pipeline shall:

- acquire consistent media
- guide the Grower
- minimize unusable captures
- collect structured metadata
- support future AI workflows
- preserve user transparency
- remain device independent

---

# 3. Capture Lifecycle

```text
Start Scan
    ↓
Consent
    ↓
Open Camera
    ↓
Live Preview
    ↓
Frame Quality Analysis
    ↓
Guide Alignment
    ↓
Capture Trigger
    ↓
Frame Validation
    ↓
Metadata Collection
    ↓
Compression
    ↓
Upload
    ↓
Upload Verification
    ↓
Inspection Ready
```

---

# 4. Consent

Capture begins only after explicit user action.

The platform must clearly communicate:

- camera usage
- capture purpose
- inspection purpose
- upload behaviour
- privacy expectations

Hidden capture is prohibited.

---

# 5. Camera Initialization

The system should:

- request permission
- initialize the preferred camera
- verify stream availability
- expose resolution
- report failures clearly

---

# 6. Live Preview

The preview exists to help the Grower position the fruit correctly.

The preview should not imply that inspection has already occurred.

---

# 7. Frame Quality Stage

The Frame Quality stage evaluates capture conditions such as:

- lighting
- brightness
- contrast
- sharpness
- motion
- stability

These measurements improve image quality only.

They are not fruit quality measurements.

---

# 8. Capture Trigger

Future trigger methods may include:

- manual button
- countdown timer
- stable-frame trigger
- remote trigger
- hardware trigger
- burst mode

Each trigger should create an auditable capture event.

---

# 9. Frame Validation

Before upload, the system may validate:

- image exists
- supported format
- minimum resolution
- corruption detection
- session validity
- upload eligibility

Validation failures should produce recoverable guidance where possible.

---

# 10. Metadata Collection

Each capture may record:

- capture timestamp
- session identifier
- user identifier
- Fruit Lot reference
- scan mode
- frame dimensions
- orientation
- browser
- operating system
- application version

Future metadata must remain backward compatible.

---

# 11. Compression

Compression should:

- preserve inspection usefulness
- reduce upload size
- remain configurable
- avoid unnecessary quality loss

Original capture policies may vary by future hardware.

---

# 12. Upload

The Upload stage should:

- authenticate when required
- verify session ownership
- report progress
- retry recoverable failures
- preserve metadata integrity

Successful upload does not imply successful inspection.

---

# 13. Failure Handling

Examples include:

- permission denied
- unsupported browser
- camera unavailable
- capture cancelled
- session expired
- upload failed
- invalid media

Every failure should produce a clear recovery path whenever practical.

---

# 14. Security

The Capture Pipeline must:

- prevent unauthorized uploads
- protect session ownership
- validate supported media
- avoid exposing internal storage details
- preserve auditability

---

# 15. Future Evolution

The Capture Pipeline should support:

- multiple captures
- stereo cameras
- depth sensors
- controlled lighting
- dedicated scanner hardware
- industrial conveyor systems

These enhancements should extend the pipeline without changing its core lifecycle.

---

# 16. Design Principles

The Capture Pipeline should remain:

- deterministic
- modular
- reusable
- transparent
- secure
- observable
- hardware independent
- AI ready
- backward compatible

---

# Document Dependencies

- 00_Master_Index.md
- 01_Project_Vision.md
- 02_Business_Philosophy.md
- 03_Live_Scanner_Architecture.md

# Next Document

05_Vision_Engine.md
# Dataset Architecture

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V05-D11

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

This document defines the architecture of datasets used by the Digital Fruit Intelligence Platform.

The objective is to create reliable, traceable, versioned, and continuously improving datasets for computer vision, inspection, analytics, and future artificial intelligence models.

Datasets are long-term platform assets.

---

# 2. Objectives

The Dataset Architecture shall:

- standardize collected data
- preserve traceability
- support AI training
- support research
- support analytics
- support human verification
- support future hardware scanners

---

# 3. Dataset Pipeline

```text
Scanner
      ↓
Capture Session
      ↓
Inspection
      ↓
Human Verification
      ↓
Buyer Feedback
      ↓
Marketplace Events
      ↓
Ground Truth
      ↓
Training Dataset
      ↓
Model Training
```

---

# 4. Dataset Sources

Future datasets may contain:

- captured images
- captured videos
- scanner metadata
- frame quality
- measurement observations
- colour observations
- surface observations
- packing observations
- inspection reports
- Grower input
- Buyer feedback
- Administrator verification
- logistics outcomes
- settlement outcomes

---

# 5. Data Categories

Each record may belong to one or more categories:

- Raw Data
- Processed Data
- Human Verified Data
- Ground Truth
- AI Predictions
- Research Data
- Analytics Data

---

# 6. Dataset Versioning

Every dataset should record:

- dataset ID
- version
- creation date
- source
- processing version
- validation status

Datasets must remain reproducible whenever practical.

---

# 7. Ground Truth

Ground Truth represents the highest-confidence reference available.

Possible contributors include:

- verified Growers
- Buyers
- inspectors
- administrators
- laboratory reports
- multiple independent reviews

Ground Truth should remain versioned.

---

# 8. Privacy

Datasets should respect:

- ownership
- consent
- access control
- retention policies
- applicable legal requirements

Personal and commercial information should be separated whenever practical.

---

# 9. Data Quality

Each dataset should include quality indicators such as:

- completeness
- consistency
- verification level
- confidence
- validation history

Poor-quality data should not silently enter production AI datasets.

---

# 10. Future Evolution

Future datasets may include:

- depth information
- multispectral images
- hyperspectral images
- IoT sensor data
- environmental conditions
- dedicated scanner hardware outputs

---

# 11. Design Principles

The Dataset Architecture should remain:

- modular
- versioned
- auditable
- traceable
- privacy-aware
- scalable
- AI ready
- backward compatible

---

# Document Dependencies

- 09_Fruit_Profile_System.md
- 10_Inspection_Engine.md

# Next Document

12_AI_Model_Lifecycle.md
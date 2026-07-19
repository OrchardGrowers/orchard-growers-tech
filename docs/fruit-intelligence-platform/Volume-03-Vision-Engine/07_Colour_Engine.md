# Colour Engine

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V03-D07

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

The Colour Engine observes visible colour characteristics of fruit captured by the Live Scanner.

Its purpose is to generate structured colour observations that support inspection reports, future AI models, and buyer transparency.

The Colour Engine performs colour observation.

It does not determine commercial grade.

---

# 2. Objectives

The Colour Engine shall:

- observe visible fruit colour
- estimate dominant colours
- estimate colour coverage
- estimate colour uniformity
- detect visible colour variation
- provide confidence values
- support future AI models

---

# 3. High-Level Pipeline

```text
Captured Image
        ↓
Colour Normalization
        ↓
Fruit Region
        ↓
Pixel Analysis
        ↓
Dominant Colour Detection
        ↓
Coverage Analysis
        ↓
Uniformity Analysis
        ↓
Colour Observation
        ↓
Confidence
```

---

# 4. Responsibilities

The Colour Engine is responsible for:

- colour extraction
- dominant colour estimation
- colour percentage estimation
- colour distribution
- colour uniformity
- visible colour variation
- confidence calculation

---

# 5. Inputs

Possible inputs include:

- cropped fruit region
- frame quality
- calibration status
- fruit profile
- image resolution

---

# 6. Outputs

The engine may produce:

- dominant colours
- secondary colours
- colour coverage percentage
- colour uniformity
- colour variation
- confidence score
- observation notes

Outputs remain advisory.

---

# 7. Colour Spaces

Future implementations may use:

- RGB
- HSV
- LAB

The architecture does not require a specific colour space.

Implementations may evolve without changing external report formats.

---

# 8. Influencing Factors

Colour observations may be influenced by:

- lighting
- shadows
- reflections
- camera sensor
- white balance
- exposure
- compression
- fruit moisture
- fruit variety

These limitations should be reflected in confidence values.

---

# 9. Fruit Profiles

Each fruit profile may define:

- expected colour ranges
- maturity colours
- acceptable variation
- seasonal variation
- variety-specific colours

These rules belong to the Fruit Profile System.

---

# 10. Confidence

Confidence may consider:

- lighting quality
- exposure quality
- colour consistency
- visible surface area
- camera quality
- calibration quality

Confidence should never be presented as certainty.

---

# 11. Future Evolution

Future versions may support:

- controlled lighting
- colour calibration cards
- multispectral cameras
- hyperspectral cameras
- dedicated scanner hardware
- industrial colour inspection

---

# 12. Design Principles

The Colour Engine should remain:

- modular
- explainable
- versioned
- reusable
- calibration-aware
- hardware independent
- AI compatible
- backward compatible

---

# Document Dependencies

- 05_Vision_Engine.md
- 06_Measurement_Engine.md

# Next Document

08_Surface_Analysis.md
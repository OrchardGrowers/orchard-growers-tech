# Fruit Profile System

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V04-D09

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

The Fruit Profile System defines standardized technical profiles for every fruit supported by the Digital Fruit Intelligence Platform.

Each Fruit Profile provides the reference data required by the Vision Engine, Inspection Engine, AI models, Marketplace, and future hardware scanners.

The Fruit Profile System acts as the knowledge layer of the platform.

---

# 2. Objectives

The Fruit Profile System shall:

- standardize fruit definitions
- provide reusable measurement rules
- define colour expectations
- define packing standards
- define inspection references
- support multiple fruit varieties
- remain configurable without changing application logic

---

# 3. Architecture

```text
Fruit
    ↓
Fruit Profile
    ↓
Variety Profile
    ↓
Measurement Rules
    ↓
Colour Rules
    ↓
Packing Rules
    ↓
Inspection Rules
    ↓
AI Configuration
```

---

# 4. Fruit Profile Contents

Each Fruit Profile may contain:

- Fruit Name
- Scientific Name
- Supported Varieties
- Seasons
- Production Regions
- Typical Shape
- Typical Surface
- Typical Colour
- Expected Size Range
- Packing Standards
- Inspection Rules
- AI Configuration Reference

---

# 5. Variety Profile

Each variety may define:

- variety name
- commercial name
- expected diameter range
- expected colour range
- expected texture
- expected maturity characteristics
- special handling requirements

Variety rules extend the Fruit Profile without replacing it.

---

# 6. Measurement Rules

The profile may define:

- minimum diameter
- maximum diameter
- size bands
- preferred measurement method
- calibration requirements
- expected tolerances

---

# 7. Colour Rules

Each profile may define:

- dominant colours
- acceptable colour variation
- maturity colours
- seasonal colour variation
- colour observation notes

---

# 8. Packing Rules

Packing definitions may include:

- package types
- tray layouts
- package capacities
- pieces per tray
- pieces per package
- weight ranges
- packing codes

These rules provide reference information and do not automatically change Grower-entered packing data.

---

# 9. Inspection Rules

Each profile may define:

- recommended scan modes
- preferred camera distance
- expected observation priorities
- common visible defects
- confidence guidance
- known limitations

---

# 10. AI Configuration

Future AI configuration may reference:

- supported models
- model versions
- required datasets
- preprocessing rules
- confidence thresholds

AI configuration remains separate from business rules.

---

# 11. Extensibility

New fruits should be added by creating new Fruit Profiles.

Existing application logic should not require modification for every new fruit.

---

# 12. Design Principles

The Fruit Profile System should remain:

- configurable
- modular
- reusable
- versioned
- explainable
- AI ready
- hardware compatible
- backward compatible

---

# Document Dependencies

- 05_Vision_Engine.md
- 06_Measurement_Engine.md
- 07_Colour_Engine.md
- 08_Surface_Analysis.md

# Next Document

10_Inspection_Engine.md
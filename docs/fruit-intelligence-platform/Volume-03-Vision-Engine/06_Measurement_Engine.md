# Measurement Engine

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V03-D06

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

The Measurement Engine converts visible fruit geometry into structured physical observations.

Its purpose is to estimate measurable characteristics while clearly communicating confidence and limitations.

The Measurement Engine performs estimation.

It does not certify measurements.

---

# 2. Objectives

The Measurement Engine shall:

- estimate fruit dimensions
- estimate visible size distribution
- support packing validation
- support inspection reports
- support future AI
- support future hardware calibration

---

# 3. High-Level Pipeline

```text
ROI
    ↓
Fruit Candidate
    ↓
Boundary Extraction
    ↓
Reference Calibration
    ↓
Pixel Measurement
    ↓
Physical Estimation
    ↓
Confidence Evaluation
    ↓
Structured Measurement Output
```

---

# 4. Responsibilities

The Measurement Engine is responsible for:

- candidate measurement
- diameter estimation
- width estimation
- height estimation
- size-band mapping
- measurement confidence
- calibration awareness

---

# 5. Inputs

Possible inputs include:

- ROI
- detected fruit boundary
- calibration reference
- image resolution
- camera metadata
- frame quality
- fruit profile

---

# 6. Outputs

The engine may produce:

- estimated diameter
- estimated width
- estimated height
- size category
- confidence score
- calibration status
- measurement limitations

Outputs remain advisory until verified.

---

# 7. Calibration

Measurements should always indicate calibration quality.

Possible states:

- Not Calibrated
- Approximate
- Reference Calibrated
- Hardware Calibrated

Calibration quality directly affects confidence.

---

# 8. Confidence

Confidence may depend upon:

- boundary quality
- calibration quality
- frame quality
- visibility
- candidate completeness
- measurement consistency

Confidence must never imply guaranteed accuracy.

---

# 9. Size Mapping

Measurements may be mapped to fruit-specific size bands.

Examples:

- Apple
- Mango
- Pear
- Peach
- Plum

The mapping rules belong to the Fruit Profile System rather than the Measurement Engine itself.

---

# 10. Limitations

The Measurement Engine should clearly communicate situations such as:

- partial visibility
- overlapping fruit
- poor calibration
- motion blur
- insufficient resolution
- uncertain boundaries

---

# 11. Future Evolution

Future versions may support:

- stereo cameras
- depth estimation
- LiDAR
- structured light
- dedicated scanner hardware
- industrial measurement systems

---

# 12. Design Principles

The Measurement Engine should remain:

- modular
- deterministic where possible
- explainable
- calibration-aware
- versioned
- reusable
- hardware independent
- AI compatible

---

# Document Dependencies

- 03_Live_Scanner_Architecture.md
- 04_Capture_Pipeline.md
- 05_Vision_Engine.md

# Next Document

07_Colour_Engine.md
# Live Scanner Architecture

**Project:** Digital Fruit Intelligence Platform (DFIP)

**Platform:** eFruitMandi.live

**Company:** Orchard Growers Private Limited

**Document ID:** DFIP-V02-D03

**Version:** 1.0

**Status:** Draft

**Last Updated:** 2026-07-17

---

# 1. Purpose

This document defines the architecture of the Live Scanner.

The Live Scanner is responsible for acquiring images and videos of Fruit Lots in a structured, repeatable, and transparent manner before any inspection takes place.

The scanner is a data acquisition system, not a grading system.

---

# 2. Objectives

The Live Scanner shall:

- guide the Grower during capture
- improve image consistency
- reduce unusable captures
- collect structured metadata
- support future AI processing
- support future dedicated hardware
- remain transparent to the user

---

# 3. Scope

The scanner is responsible only for image acquisition.

It is **not responsible** for:

- grading
- pricing
- buyer recommendations
- commercial decisions
- payment
- logistics
- inspection approval

Those belong to later modules.

---

# 4. High-Level Pipeline

```text
Camera
    ↓
Permission
    ↓
Live Preview
    ↓
Scanner Session
    ↓
Frame Quality
    ↓
Guide Overlay
    ↓
Manual / Automatic Capture
    ↓
Image Validation
    ↓
Upload
    ↓
Inspection Pipeline
```

---

# 5. Scanner Components

The Live Scanner consists of the following logical components:

- Camera Manager
- Permission Manager
- Session Manager
- Preview Renderer
- Guide Overlay
- Frame Quality Analyzer
- Capture Controller
- Upload Manager
- Metadata Collector
- Error Handler

Each component should have a single responsibility.

---

# 6. Scanner Session

Every scanning operation belongs to one Scanner Session.

A Scanner Session represents:

- one user
- one Fruit Lot
- one capture workflow
- one inspection attempt

Future versions may allow multiple captures within the same session.

---

# 7. Camera Layer

Responsibilities:

- open camera
- close camera
- switch cameras (future)
- maintain stream lifecycle
- recover from interruptions
- expose frame dimensions
- expose camera capabilities when available

The Camera Layer must not contain grading logic.

---

# 8. Guide Overlay

Guide Overlay helps the Grower position the fruit correctly.

Future overlay types:

- Single Fruit
- Fruit Group
- Tray
- Package
- Custom Overlay

The overlay provides visual guidance only.

---

# 9. Frame Quality Layer

Frame Quality checks may include:

- lighting
- brightness
- contrast
- sharpness
- motion
- stability

These checks help the Grower capture better images.

They do not determine fruit quality.

---

# 10. Capture Modes

Supported modes may include:

- Manual Capture
- Timed Capture
- Stable Frame Capture
- Burst Capture
- Continuous Capture
- Video Capture

Availability depends on future implementation.

---

# 11. Metadata Collection

Each capture may collect:

- timestamp
- session ID
- scan mode
- image resolution
- orientation
- camera facing
- browser information
- device information
- application version

Additional metadata should be versioned and documented.

---

# 12. Upload Layer

The Upload Layer is responsible for:

- packaging media
- validating uploads
- retry handling
- progress reporting
- upload completion
- failure reporting

Business logic must remain outside this layer.

---

# 13. Error Recovery

Scanner failures should recover gracefully.

Examples:

- permission denied
- camera unavailable
- upload failed
- session expired
- network interruption
- unsupported browser

The Grower should receive clear guidance whenever recovery is possible.

---

# 14. Future Hardware Compatibility

The Live Scanner architecture should remain compatible with:

- mobile browsers
- desktop browsers
- Android application
- iOS application
- dedicated scanner hardware
- industrial scanning systems

Hardware differences should be isolated behind the Camera Layer.

---

# 15. Design Principles

The Live Scanner follows these principles:

- modular
- reusable
- device independent
- transparent
- backward compatible
- future AI compatible
- future hardware compatible
- secure
- observable
- testable

---

# 16. Out of Scope

The Live Scanner will not:

- estimate prices
- assign grades automatically
- overwrite Grower data
- approve inspection reports
- generate invoices
- make commercial decisions

Those responsibilities belong to later platform modules.

---

# Document Dependencies

- 00_Master_Index.md
- 01_Project_Vision.md
- 02_Business_Philosophy.md

# Next Document

04_Capture_Pipeline.md
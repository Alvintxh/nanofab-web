<!-- Source: https://wiki.nanofab.ucsb.edu/wiki/Lithography_Recipes -->
<!-- Fetched: 2026-04-05 -->

# Lithography Recipes - UCSB Nanofab Wiki

## Overview

This comprehensive resource documents lithography processes and chemical recipes available at UCSB's Nanofabrication Facility, organized by process type and equipment.

## Main Process Categories

### 1. Photolithography Processes

**UV Optical Lithography** includes:
- Stocked chemicals and photoresist materials with datasheets
- Starting recipes for spin, bake, exposure, and development
- Contact aligner recipes (Suss MJB-3, Suss MA-6)
- Stepper recipes (GCA 6300, GCA AutoStep 200, ASML PAS 5500/300 DUV)
- Direct-write recipes (Heidelberg MLA150, Raith EBPG 5150+, Raith Velion FIB)
- Automated coater recipes (S-Cubed Flexi)

### 2. General Photolithography Techniques

Procedures addressing common challenges:
- HMDS process improves photoresist adhesion to substrates
- Edge-bead removal techniques for etcher compatibility
- Photoresist reflow for creating slanted sidewalls
- Focus-exposure matrix calibration for process optimization

### 3. Lift-Off Recipes

Verified processes for various tools:
- I-Line lift-off using LOL2000 underlayer (up to ~130nm metal)
- I-Line lift-off using PMGI underlayer (up to ~2.5um metal)
- DUV lift-off using UV6 resist with PMGI (up to ~65nm metal)

### 4. E-Beam Lithography

Recipes for JEOL JBX-6300FS system (under development)

### 5. FIB Lithography

Raith Velion focused ion-beam recipes (to be added)

### 6. Holography

Recipes for 1-D and 2-D gratings with 220nm nominal period on substrates up to 1 inch square

### 7. Edge-Bead Removal Techniques

Methods for clamp-based etcher compatibility and resolution improvement

## Photolithography Materials

### Underlayers
- PMGI (multiple formulations SF3, 5, 8, 11, 15)
- Shipley LOL2000

### Anti-Reflection Coatings (BARC)
- XHRiC-11 (i-line)
- DUV42P-6 (DUV)
- DS-K101-304 (DUV developable)

### Contrast Enhancement Materials
- CEM365iS for resolution enhancement

### Adhesion Promoters
- HMDS
- AP3000 BCB Adhesion Promoter
- Omnicoat (SU-8)
- OrmoPrime08

### Spin-On Dielectrics
- BCB Cyclotene 3022-46
- PhotoBCB Cyclotene 4024-40
- Spin-on-Glass Honeywell 512B

## Process Maturity Levels

| Level | Description |
|-------|-------------|
| A | Allowed, materials available, never executed |
| R1 | Process run at least once |
| R2 | Process documented |
| R3 | Process documented with available data |
| R4 | Regular use (>=4x/year) without in-situ control |
| R5 | Regular use (>=4x/year) with in-situ control |
| R6 | Controlled process with control charts/limits |

## Positive Photoresists (I-line and Broadband)

- AZ4110, AZ4210, AZ4330RS
- AZ4620
- OCG 825-35CS
- SPR 955 CM (0.9 and 1.8 versions)
- SPR 220-3.0 and 220-7.0
- THMR-IP3600 HP D
- UV6-0.8 (DUV)
- UV210-0.3 (DUV)
- UV26-2.5 (DUV)

## Negative Photoresists (I-line and Broadband)

- AZ5214-EIR
- AZnLOF series (2020, 2035, 2070, 5510)
- Futurrex NR9 series (1000PY, 3000PY, 6000PY)
- SU-8 (2005, 2010, 2015, 2075)
- UVN30-0.8 (DUV)

## S-Cubed Flexi Automated System Recipes

Pre-loaded recipes for automated coating, baking, and developing:

### Hotplate Temperature Settings
- HP4-SET-220C, 210C, 200C, 185C (for DSK)
- HP1-HP3 fixed at: HP1=135C, HP2=170C, HP3=170C

### Bottom Anti-Reflection Coating (DS-K101)

**Spin speeds:** 1.5krpm and 5.0krpm

**Bake temperatures:** 185C, 200C, 210C, 220C

Notes: 185C bake allows DSK to dissolve during develop, enabling undercut. 220C bake allows dry-etchable BARC use, equivalent to DUV42P.

### Imaging Resist (UV6-0.8)

**Spin speeds:** 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0 krpm

**Bake temperature:** 135C

### Chain Recipes (DSK + UV6)

Multiple combinations available with:
- DSK at 185C or 220C
- UV6 at various spin speeds
- Processing time: ~10-15 minutes per wafer

### Post-Exposure Bake and Developing

**PEB:** 135C for 90 seconds, cool 15 seconds

**Developer:** AZ300MIF at 300rpm chuck speed

**Developer times available:** 10s, 15s, 20s, 25s, 30s, 35s, 40s, 45s

**Warning:** Only use listed developer recipes to prevent equipment damage.

### Standalone Developing Routes

Developer recipes available without PEB, with same timing options and parameters.

## Low-K Spin-On Dielectric Recipes

Documented recipes for:
- Photo BCB (4024-40)
- Standard BCB (3022-46)
- SOG (T512B)

## Developers and Removers

**Developers:**
- AZ400K (standard and 1:4 dilution)
- AZ300MIF
- DS2100 BCB Developer
- SU-8 Developer
- 101A Developer (DUV flood exposed PMGI)

**Photoresist Removers:**
- AZ NMP (replaces 1165)
- AZ300T
- Remover PG (SU-8 stripper)
- AZ EBR (Edge Bead Remover, PGMEA)

## E-Beam Resists

- PMMA and P(MMA-MAA) copolymer
- maN 2403

## Nanoimprinting Materials

- NX1020
- MRI-7020
- MR-UVCur21
- Ormostamp

## Holography Process Details

Standard processes for SiO2 on Si substrates:
- 1-D and 2-D gratings with 220nm nominal period
- Uses XHRiC-11 BARC and THMR-IP3600HP-D high-resolution i-line resist
- Processes available for varying setup angles and etch depths
- Methods for reducing nanowire diameter via thermal oxidation and vapor HF etching

## General Resources

**Foundational Techniques:**
- Lift-off description covering process limits and design considerations
- On tools with autofocus (steppers & direct-write litho tools), calibrate via Focus Exposure Matrix/Array (FEM/FEA)
- Photoresist reflow for creating curved surfaces

*Last updated: February 4, 2026*

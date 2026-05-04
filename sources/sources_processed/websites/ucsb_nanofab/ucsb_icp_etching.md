<!-- Source: https://wiki.nanofab.ucsb.edu/wiki/ICP_Etching_Recipes -->
<!-- Fetched: 2026-04-05 -->

# ICP Etching Recipes - UCSB Nanofab Wiki

## Overview
This wiki documents ICP (Inductively Coupled Plasma) etching recipes and procedures for multiple tools at UCSB Nanofab, including equipment from PlasmaTherm, Panasonic, and Oxford.

## Main Equipment Categories

### 1. DSEIII (PlasmaTherm/Deep Silicon Etcher)

**Process Tips:**
- Use Santovac oil for mounting small pieces to silicon carrier wafers to improve thermal conduction
- Oil dissolves in Acetone or NMP for cleanup
- Weekly process control data tracks tool performance

**Key Recipes:**

**STD_Bosch_Si (Production - 2024-10)**
- Standard deep reactive-ion etching for high aspect-ratio silicon
- Cycles between polymer deposition, polymer etch, and silicon etch steps
- Selectivity to photoresist: ~60
- Less than 1% center-to-edge variability
- Etch rate approximately 4.25 um/min for TSV processes

**SF6-C4F8-CF4 Si Etch v1 (Single-Step, 2026-01)**
- 12mT, 20/850W power
- Etch rate: 339.4 nm/min
- Selectivity to UV6 photoresist: 4.9
- Smooth, vertical sidewalls with +/-5% uniformity

**CF4-C4F8 SiO2 Etch v1 (Production - 2026-01)**
- 3mT, 70/800W power
- C4F8/CF4 = 7.5/32.5 sccm
- Etch rate: 270 nm/min
- Selectivity to SPR955 resist: 1.3

### Edge-Bead Removal (DSEiii)
Remove photoresist from wafer edges to prevent sticking to clamp. Two approaches:
- Custom metal mask with flood exposure (ASML DUV)
- Manual removal with swabs and EBR100 (requires careful execution)

### Through Silicon Via (TSV) Process
**Materials and Deposition:**
- 150nm Al2O3 via Veeco Nexus IBD or AJA Sputter
- ~3nm SiO2 in situ for adhesion
- Lithography with >=500nm thick resist
- Al2O3 etch in Panasonic ICP with 20% overetch

**Bosch Etch Parameters for TSV:**
- Dep: 1.2 sec
- Etch A: 1.5 sec
- Etch B: 2.0 sec
- Rate: approximately 4.25 um/min

**Post-Etch:**
- Strip Al2O3/SiO2 with buffered HF (~2 min) or dry etch
- For wax-mounted samples: dissolve in acetone overnight or heat to 150C

### 2. PlasmaTherm/SLR Fluorine ICP Etcher

**SiVertHFv2 Si Etch (Production)**
- 20mTorr, RF=18W, ICP=950W
- C4F8/SF6/CF4 = 120/48/54 sccm
- Selectivity Si:PR ~ 5
- Etch rates: Si ~ 300-350 nm/min; SiO2 ~ 30-35 nm/min
- 89-90 degree vertical etch angle

**SiO2 Etch-50W (Production)**
- 3.8mT, RF=50W, ICP=900W
- CHF3/CF4 = 10/30 sccm
- SiO2 etch rate: ~250 nm/min
- Selectivity SiO2:PR ~ 1.10-1.20
- Selectivity SiO2:Ru ~ 36

**Si3N4 Etching**
- ICP = 950/75W, Pressure = 5mT
- Low polymer: CF4 = 60 sccm, ER = 420 nm/min
- Higher verticality: CF4 = 35, CHF3 = 25 sccm, ER = 380 nm/min

**Photoresist Stripping**
- Old recipe: "PostBARC Etch/PR Strip (STD)" - O2=100sccm, 5mT, RF1=10W, RF2=825W
- New recipe: "PostBARC Etch/PR Strip (STD)_V2" - same but RF1=100W (10x increase)
- New version completely removes resist without residue

### SiO2 Etching with Ruthenium Hardmask
- Sputtered or ALD Ru hardmask with SiO2 topcoat
- 50W bias (recommended): ER=263 nm/min, selectivity to Ru=36
- 200W bias (higher rate): ER=471 nm/min, selectivity to Ru=38

### 3. ICP Etch 1 (Panasonic E646V)

**Status:** Currently down - use Panasonic ICP#2

**Historical Recipes Available:**
- SiO2 vertical etch (CHF3): ~2300 A/min
- SiNx (CF4-O2)
- Al (Cl2/BCl3)
- Cr (Cl2/O2)
- Ta (Cl2/BCl3)
- Ti (Cl2/Ar)
- W-TiW (SF6/Ar)
- GaAs/AlGaAs (Cl2-BCl3-Ar)
- GaN (Cl2/N2)
- SiC (SF6 with Ni mask)
- Sapphire (BCl3-Cl2)

### 4. ICP Etch 2 (Panasonic E626I)

**SiO2 Vertical Etch (CF4/CHF3)**
- Stable +/-5% over time
- Process control data tracked weekly

**Al2O3 Etching (ALD)**
- BCl3 = 30 sccm
- Pressure = 0.50 Pa
- ICP = 500W
- 50W bias: 39.6 nm/min (0.66 nm/sec)
- 250W bias: 60.0 nm/min (1.0 nm/sec)

**GaAs Etch**
- Etch rate: ~1 um/min
- Selectivity to SiO2: ~27:1
- Sidewalls: ~90 degrees
- Highly pressure-sensitive
- Recipe: 0.5Pa, 100/900W, N2/Cl2=10/20sccm

**Photoresist/ARC Etching:**

*DUV-42P or AR6 ARC:*
- O2 = 40 sccm, 0.5 Pa
- ICP = 75W, RF = 75W
- Time: 45 sec for ~60nm

*Photoresist Strip (UV6-0.8):*
- O2 = 40 sccm, 1.0 Pa
- ICP = 350W, RF = 100W
- Etch rate: 518.5 nm/min
- Time for full removal: 2m 30sec with 200% overetch

**Ruthenium Etch**
- O2/Cl2 chemistry
- Published in JVST-A 2021

### 5. Oxford ICP Etcher (PlasmaPro 100 Cobra)

**Process Tips:**
- Santovac oil for small piece mounting
- InP requires >=150C for volatile products
- Weekly process control calibrations

**InP Ridge Etch - High Temp (200C)**
- Cl2/H2/Ar chemistry
- Etch rate: ~2 um/min
- Selectivity to SiO2: ~30:1
- Sidewalls: ~90 degrees
- Very dependent on open area
- Cal sample: ~1cm piece on Si carrier

**InP Ridge Etch - Low Temp (60C)**
- Cl2/CH4/H2 chemistry
- No longer calibrated as of 2025-05
- Historical data available

**InP Grating Etch**
- Cl2/CH4/H2/Ar at 20C
- 1/4-wafer 50mm InP on Si carrier (rough side up)

**GaN Etch (6" Configuration - Current)**
- BCl3/Cl2/Ar at 200C
- 4.5mT, 700W/50W
- Cl2/Ar/BCl3 = 49.1/16.4/12.2 sccm
- ~850nm deep GaN with SiN mask
- 140% flow increase from 4" configuration

**GaAs Etch**
- BCl3/Ar at 20C (SiO mask) - 2025-01
- Cl2/N2 at 30C (SiO mask) - 2025-12
- ~1cm die on 4" Si carrier with SiO hardmask

## Process Control Data

The facility maintains weekly calibration data for:
- DSE Bosch Si etch (C4F8/SF6/Ar)
- Fluorine ICP Si etch (C4F8/SF6/CF4)
- Fluorine ICP SiO2 etch (CHF3/CF4)
- Panasonic 1 & 2 SiO2 etch
- Panasonic 2 GaAs etch
- Oxford InP etch (200C and 60C)
- Oxford GaN etch

All data tracked in Google Sheets with plots for trend analysis.

## General Guidelines

**Resist and Hardmask Selection:**
- Thick PR (>=10um) tends to burn - use hardmasks instead
- Al2O3/SiO2 hardmask recommended for deep etches
- ALD Al2O3 works well for high aspect ratio silicon etching

**Mounting Options:**
- Full wafers: direct helium cooling
- Small pieces: Santovac oil on silicon carrier
- Through-wafer: UV-Release Dicing tape (preferred) or wax-mounting (with staff approval)

**Common Issues:**
- Low etch rates with photoresist masks: try brief SiO2 etch or PR/BARC etch first
- Polymer residue: increase bias power during strip
- Black/rough trenches in Si: increase Etch A time or reduce Dep time

*Document last updated: 2026-03-03*

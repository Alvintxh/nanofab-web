<!-- Source: https://wiki.nanofab.ucsb.edu/wiki/PECVD_Recipes -->
<!-- Fetched: 2026-04-05 -->

# PECVD Recipes - UCSB Nanofab Wiki

## PECVD 1 (PlasmaTherm 790)

### PECVD 1 Process Control Plots
Links to plots of all process control data available.

### SiO2 Deposition (PECVD #1)
- Standard Recipe available via Google Sheets
- Current Process Control Data tracks film properties: deposition rate, stress, particle count, refractive index
- Historical Data available from October 2021 and earlier

### SiN Deposition (PECVD #1)
- Si3N4 Standard Recipe provided
- Current Process Control Data includes film characterization metrics
- Historical Data archived from October 2021 and earlier

### Low Stress Si3N4 (PECVD#1)
- Standard Recipe available as PDF document
- Demonstrates stress modification via N2 flow variation
- Refractive index remains relatively constant while stress varies from tensile to compressive
- Historical data from 2021-10 and earlier available

### SiOxNy Deposition (PECVD #1)
- Standard Recipe provided
- Process Control Data from 2014 with film characterization
- Thickness uniformity data available

### Standard Cleaning Procedure (PECVD #1)
Two-step cleaning process required:

1. **Wet Cleaning**: Use cleanroom wipe with DI water, then isopropyl alcohol
2. **Plasma Cleaning**: Run "CF4/O2 Clean" recipe with specified times

**Cleaning Times:**
| Film Deposited | Cleaning Time |
|---|---|
| SiO2 | 1 min clean per 1 min deposition |
| Si3N4 | 1 min clean per 7 min deposition |
| SiOxNy | Same as SiO2 |
| a-Si | Same as Si3N4 |

---

## PECVD 2 (Advanced Vacuum)

### PECVD 2 Process Control Plots
Comprehensive plots of all process control data available.

### SiO2 Deposition (PECVD #2)
- New Standard Recipe: "STD SiO2 v2"
- Old Standard Recipe available for reference
- Current Process Control Data tracked continuously
- Deposition rate at 150C: **35 nm/min**
- Historical Data from before October 2021

### SiN Deposition (PECVD #2)
- New Standard Recipe: "STD Si3N4 v3"
- Old Standard Recipe: "Nitride2"
- Current Process Control Data maintained
- Historical Data from before October 2021

### Low-Stress SiN Deposition (PECVD #2)
Target: **< +/-100 MPa stress**

- New Standard Recipe: "STD LS-Si3N4 v4"
- Old Standard Recipe: "Old LSNitride2 recipe"
- Current Process Control Data tracked
- Plots of Low-Stress Si3N4 data available
- Historical Data and older recipe versions (2014-2018) available

#### Low-Stress SiN 3xTime (PECVD #2)
- Recipe: "STD LS-Si3N4 3xTime v1"
- Longer step duration (3x) improves stability over months
- Thicker compressive/tensile layers less susceptible to RF ignition delays
- Process Control Data and calibration charts available
- Developed September 2024

### Amorphous-Si Deposition (PECVD #2)
- Current Recipe and Deposition Process (2025-11)
  - Developed by Ryan Hersey & Skyler Palatnik
  - Group of Prof. Max Millar-Blanchaer
- Amorphous Si Deposition Recipe (2013-09, Ning Cao)
- Characterization and Stress documentation available
- DOE/recipe variations documented

### Standard Cleaning Procedure (PECVD #2)

Two-step process:

1. **Wet Cleaning** (if >29 min total season+deposition time):
   - Use cleanroom wipe with DI water on upper chamber sidewalls
   - Follow with isopropyl alcohol
   - Do NOT clean shower-head

2. **Plasma Cleaning**: Load "STD CF4/O2 Clean" recipe

**Clean Times:**
| Film Deposited | Cleaning Time (Dry) |
|---|---|
| SiO2 | 1 min clean per 1 min deposition |
| Si3N4 | 1 min clean per 7 min deposition |
| a-Si | 2 min clean per 1 min deposition |
| a-Si (max) | Break up depositions >60 min, clean chamber |
| Other films (>29 min total) | Wet clean upper lid/chamber |

---

## ICP-PECVD (Unaxis VLR)

**Current Configuration**: Deuterated Silane (SiD4) installed
- Identical to SiH4 except significantly lowers optical absorption in near-infrared
- Applicable for optical applications
- More expensive than standard precursor

### Process Control Data (Unaxis ICP-PECVD)

Regular monitoring executed by NanoFab Interns:
- ICP-PECVD Process Control Plots available
- Low Deposition Rate SiO2 data
- High Deposition Rate SiO2 data
- Si3N4 data
- Low Stress Si3N4 data

### Low Deposition Rate SiO2 [ICP-PECVD]
- Standard Recipe: "SiO2 LDR250C-new May 2024"
- Process Control Data includes full characterization
- Previous Recipe: "SiO2 LDR250C - replaced on May 2024"
- Old Recipe from 2019 available
- Historical Data from before October 2021

### High Deposition Rate SiO2 [ICP-PECVD]
- Standard Recipe: "SiO2 HDR250C-new May 2024"
- Current Process Control Data maintained
- Previous Recipe: "SiO2 HDR250C-replace on May 2024"
- Old Recipe from 2019 available
- Historical Data available

### Gap-Fill SiO2 [ICP-PECVD]
**Designer**: Warren Jin

**NOTE**: Contact tool supervisor before running - requires special scheduling.

**Capabilities**: Effectively fills ~1:1 and ~1:2 aspect ratio gaps in silicon and glass structures (waveguides, optical gratings) with void-free filling.

**Parameters:**
- High 400W RF Bias reduces corner buildup preventing voids
- Category: "SiO2 GapFill - Std."
- Flow: "SiO2 GapFill 250C"
- Sequence: "SiO2 GapFill 250C 450W" (do not modify)
- Edit TIME only in step
- Deposition rate: **99.968 nm/min** (9/20/23)

### Si3N4 [ICP-PECVD]
- Standard Recipe: "SiN 250C-new May 2024"
- Current Process Control Data tracked
- Previous Recipe: "SiN 250C- replaced on May 2024"
- Old Recipe from 2019 available
- Historical Data from before October 2021

### Low Stress Si3N4 [ICP-PECVD]
- Standard Recipe: "SiN Low Stress 250C-new May 2024"
- Current Process Control Data maintained
- Previous Recipe: "SiN Low Stress 250C - replaced on May 2024"
- Old Recipe from 2019 available

### Standard Seasoning Procedure [ICP-PECVD]

Edit seasoning recipes to change only the seasoning time (coating ~200nm of film on chamber walls).

**Seasoning Recipes:**
- SiO2 seasoning - Std
- SiN seasoning - Std

### Standard Cleaning Procedure [ICP-PECVD]

Edit Post-Dep Clean recipe per deposited thickness and material.

**Etch Rates:**
- SiNx: **20 nm/min**
- SiO2: **40 nm/min**

**Standard Clean Recipe:**
- Post Deposition Clean 250C

### General Recipe Notes (Unaxis VLR ICP-PECVD)

- **RF1** = Bias
- **RF2** = ICP Power
- All recipes begin with Argon pre-clean at 0W bias (gentle) to improve adhesion/nucleation
- **Maximum SiO2 deposition thickness**: 800 nm
  - Above this, run chamber clean/season before additional product wafer deposition

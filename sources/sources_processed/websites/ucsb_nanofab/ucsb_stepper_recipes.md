<!-- Source: https://wiki.nanofab.ucsb.edu/wiki/Stepper_Recipes -->
<!-- Fetched: 2026-04-05 -->

# Stepper Recipes - UCSB Nanofab Wiki

## Overview

This wiki documents lithography recipes for three stepper systems at UCSB Nanofab. Stepper 1 and Stepper 2 are i-line systems with good piece handling capabilities. Stepper 3 uses DUV (248nm) wavelength, primarily for full 100mm wafers. DUV resists do not work for i-line and i-line resists do not work for DUV.

## General Guidance

The recipes serve as starting points. For critical lithography steps, you should run your own exposure and/or focus array to determine the proper parameters. Variables affecting outcomes include sample reflectivity, absorption, ARC layer use, and surface topography.

## Stepper 1 (GCA 6300)

**Conversion Factor:** Multiply GCA 6300 exposure times by 0.30 for the GCA AutoStep 200 system.

### Positive Resist (GCA 6300)

| Resist | Spin Cond. | Bake | Thickness | Exposure Time | Focus Offset | PEB | Developer | Dev. Time | Comments |
|--------|-----------|------|-----------|---------------|--------------|-----|-----------|-----------|----------|
| SPR955CM0.9 | 3 krpm/30" | 95C/60" | ~0.9 um | 1.2" | 0 | 110C/60" | AZ300MIF | 60" | 0.5 um isolated lines |
| SPR955CM-0.9 | 3 krpm/30" | 95C/60" | ~0.9 um | 3.0" | 4 | 110C/60" | AZ300MIF | 60" | 0.5 um holes |
| SPR955CM-0.9 + CEM365iS | 3 krpm/30" + 5 krpm/30" | 95C/90" | ~0.9 um | 2.2" | -10 | 110C/60" | AZ300MIF | 60" | 0.35 um isolated spaces |
| SPR950-0.8 | 4 krpm/30" | 95C/60" | ~0.8 um | 1.0" | 0 | 105C/60" | AZ300MIF | 60" | -- |
| SPR955CM-1.8 | 4 krpm/30" | 90C/90" | ~1.8 um | 2.3" | 0 | 110C/90" | AZ300MIF | 60" | 0.5 um isolated lines |
| SPR955CM-1.8 | 4 krpm/30" | 90C/90" | ~1.8 um | 1.7" | -5 | 110C/90" | AZ300MIF | 60" | 1 um isolated posts |
| SPR220-3.0 | 2.5 krpm/30" | 115C/90" | ~2.7 um | 2.4" | 10 | 115C/90" | AZ300MIF | 60" | 0.5 um isolated lines |
| SPR220-7.0 | 3.5 krpm/45" | 115C/120" | ~7.0 um | 4.5" | 0 | 50C/60", then 115C/90" | AZ300MIF | 120" | 1.0 um lines; 1.25 um spaces |

**CEM Note:** For recipes with CEM, the CEM is spun on after the first resist bake, exposure is then done, and the CEM is rinsed off with DI water before the PEB.

### Negative Resist (GCA 6300)

| Resist | Spin Cond. | Bake | Thickness | Exposure Time | Focus Offset | PEB | Flood | Developer | Dev. Time | Comments |
|--------|-----------|------|-----------|---------------|--------------|-----|-------|-----------|-----------|----------|
| AZ5214 | 6 krpm/30" | 95C/60" | ~1.0 um | 0.2" | 0 | 110C/60" | 60" | AZ300MIF | 60" | 0.7 um resolution possible |
| nLOF5510 | 3 krpm/30" | 90C/60" | ~0.93 um | 0.74" | -6 | 110C/60" | none | AZ300MIF | 60" | 0.5 um line openings |
| nLOF2020 | 4 krpm/30" | 110C/60" | ~2 um | 0.55" | -6 | 110C/60" | none | AZ300MIF | 90" | ~0.85 um line opening |

**AZ5214 Special Note:** To use AZ5214 as a negative PR requires Flood Exposure with the MA6 or MJB aligner after PEB, before developing.

## Stepper 2 (AutoStep 200)

**Important Note:** Bolded exposure times were calculated by multiplying GCA 6300 times by 0.30. You will need to do an exposure array to get precise times. Resolution achievable is approximately 100 nm smaller than GCA 6300.

### Positive Resist (AutoStep 200)

| Resist | Spin Cond. | Bake | Thickness | Exposure Time | Focus Offset | PEB | Developer | Dev. Time | Comments |
|--------|-----------|------|-----------|---------------|--------------|-----|-----------|-----------|----------|
| SPR955CM-0.9 | 3 krpm/30" | 95C/90" | ~0.9 um | 0.35" | 0 | 110C/90" | AZ300MIF | 60" | 0.5 um dense lines |
| SPR955CM-0.9 | 3 krpm/30" | 95C/90" | ~0.9 um | 0.8" | 0 | 110C/90" | AZ300MIF | 60" | 0.5 um holes |
| SPR955CM-1.8 | 4 krpm/30" | 95C/90" | ~1.8 um | 0.4" | -1 | 110C/90" | AZ300MIF | 60" | -- |
| SPR950-0.8 | 4 krpm/30" | 95C/60" | ~0.8 um | 0.30" | 0 | 105C/60" | AZ300MIF | 60" | -- |
| SPR220-3.0 | 2.5 krpm/30" | 115C/90" | ~2.7 um | 0.72" | 10 | 115C/90" | AZ300MIF | 60" | 0.5 um isolated lines |
| SPR220-7.0 | 3.5 krpm/45" | 115C/120" | ~7.0 um | 1.35" | 0 | 50C/60", then 115C/90" | AZ300MIF | 120" | 1.0 um lines; 1.25 um spaces |
| AZ4210 | 500 rpm/5", 4 krpm/45" | 95C/60" | ~2.1 um | 0.75" | 0 | -- | AZ400K:DI=1:4 | 60" | 2.0 um dense holes |

### Negative Resist (AutoStep 200)

| Resist | Spin Cond. | Bake | Thickness | Exposure Time | Focus Offset | PEB | Flood | Developer | Dev. Time | Comments |
|--------|-----------|------|-----------|---------------|--------------|-----|-------|-----------|-----------|----------|
| nLOF5510 | 3 krpm/30" | 90C/60" | ~0.93 um | 0.25" | -1 | 110C/60" | 0 | AZ300MIF | 60" | 0.4 um dense lines |
| AZ5214 | 6 krpm/30" | 95C/60" | ~1.0 um | 0.06" | 0 | 110C/60" | 60" | AZ300MIF | 60" | 0.7 um resolution |
| nLOF2020 | 4 krpm/30" | 110C/60" | ~2 um | 0.17" | -6 | 110C/60" | 0 | AZ300MIF | 90" | ~0.85 um line opening |
| NR9-1000PY | 3 krpm/30" | 135C/180" lid down | ~1.2 um | 0.92" | 0 | 115C/120" lid down | 0 | AZ300MIF | 20" | ~0.55 um line opening |

## Stepper 3 (ASML DUV)

### Process Control Data

The Process Group measures lithography Critical Dimension (CD) and wafer-stage particulate contamination using sensitive processes.

**Particle Checks:** The calibration process enables ~300nm critical dimension logging and particle detection on the exposure chuck.

### General Information

**Focus Movement:** A positive focus offset moves the wafer stage upwards, closer to the lens.

**Feature Size Control:** The ASML provides fine control over feature size via exposure dose (mJ/cm2) variations.

**BARC Etching:** The DUV42P BARC layer, which is best suited for resolving small features, needs to be O2 etched after develop. BARC and ARC etches are available on primary etchers: ICP#1, ICP#2, RIE#5, FL-ICP, and Technics PEii ashers.

### Anti-Reflective Coatings

**DUV-42P-6 (replacement for AR2)**
- Spin at 2500 rpm for optimal properties (~60 nm)
- Bake at 220C for 60 seconds on hotplate
- Removed via oxygen plasma
- Can be etched on multiple platforms

**DS-K101-304**
- Spin at 1500 rpm, bake at 185C for 60 seconds
- Approximately 40 nm for best anti-reflective properties
- Develops away and undercuts in AZ300MIF
- Can increase bake temperature to reduce undercut
- Alternative: bake at 220C for dry etch removal

### Positive Resist (ASML DUV)

| Resist | Spin Cond. | Bake | Thickness | Exposure Dose (mJ) | Focus Offset | PEB | Developer | Dev. Time | Comments |
|--------|-----------|------|-----------|-------------------|--------------|-----|-----------|-----------|----------|
| UV6-0.7 | 3.5 krpm/30" | 135C/60" | 630 nm | 17 | -0.2 | 135C/90" | AZ300MIF | 45" | 200 nm dense line/space; Eo ~5.5 mJ |
| UV210-0.3 | 5.0 krpm/30" | 135C/60" | 230 nm | 20 | -0.1 | 135C/90" | AZ300MIF | 45" | 150 nm dense line/space; Annular illumination |
| UV210-0.3 | 3.0 krpm/30" | 135C/90" | 260 nm | 85 | -0.2 | 135C/90" | AZ300MIF | 80" | 170 nm isolated holes; Annular illumination |
| UV26-2.5 | -- | 135C/90" | ~2.5 um | ~40 | ~+0.8 | 110C/90" | AZ300MIF | Unknown | No characterized recipes |

### Negative Resist (ASML DUV)

| Resist | Spin Cond. | Bake | Thickness | Exposure Dose (mJ) | Focus Offset | PEB | Flood | Developer | Dev. Time | Comments |
|--------|-----------|------|-----------|-------------------|--------------|-----|-------|-----------|-----------|----------|
| UVN30-0.8 | 3.5 krpm/30" | 110C/60" | ~550 nm | 27 | +0.15 | 105C/60" | Not used | AZ300MIF | ~20 sec | Replaced UVN2300; not thoroughly calibrated |

### Other Lithography Processes

- DUV Photolithographic Edge Bead Removal
- DUV Lift-Off Process with PMGI Underlayer
- Lithography Calibration - Analyzing Focus-Exposure Matrix (FEM)

## Additional Notes

- Underlayers such as LOL2000 or PMGI can be used on stepper systems
- Post-develop bakes (not listed) are used to increase etch resistance
- Care should be taken with post development bakes as resist reflow can occur
- Unless otherwise noted, all exposures are done on flat silicon wafers
- This listing is a guideline to get you started

*Page last edited: February 12, 2026*

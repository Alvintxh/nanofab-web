<!-- Source: https://wiki.nanofab.ucsb.edu/wiki/Sputtering_Recipes -->
<!-- Fetched: 2026-04-05 -->

# Sputtering Recipes - UCSB Nanofab Wiki

## Overview

This document provides comprehensive sputtering deposition recipes and parameters from the UCSB Nanofab facility, covering multiple sputtering systems and ion beam deposition equipment.

## Sputter 3 (AJA ATC 2000-F)

### Tips & Tricks

**Ignition Issues**: Plasma ignition failures can be resolved by increasing the chamber pressure just for the ignition step, then drop down to the process pressure (approximately 10-30 mTorr for ignition, then 3 mTorr for deposition).

### Materials Table (Sputter 3)

Key parameters tracked include:
- Pressure (mT)
- Power (W)
- Substrate bias (W)
- Temperature (C)
- Gas flows: Argon, Nitrogen, Oxygen
- Height-Tilt (mm)
- Deposition Rate (nm/min)
- Stress (MPa)
- Sheet Resistance (uOhm-cm)
- Refractive Index at 633nm
- Extinction Coefficient at 633nm

Selected materials and parameters:

| Material | P(mT) | Pow(W) | Rate(nm/min) | Status |
|----------|--------|--------|--------------|--------|
| Al2O3 | 3 | 200 (RF2) | 5.32 | No |
| Co | 10(5) | 200 | 2.3 | Yes |
| Cu | 1.5 | 50 (395v) | 4.15 | No |
| Cu | 5 | 150 (~490v) | 8 | Yes |
| Fe | 10(5) | 200 | 1.25 | No |
| Mo | 3 | 200 | 13.15 | Yes |
| Ni | 5 | 150 | 5.23 | Yes |
| Pt | 3 | 50 | 2.9 | No |
| SiN | 3 | 200 | 1.56 | Yes |
| SiO2 | 3 | 200 | 3.68 | Yes |
| Ti | 3 | 100 | 1.34 | Yes |
| TiW | 4.5 | DC-300W(10%)/DC-50W | 16 | Yes |
| W | 4.5 | 300 | 16 | Yes |

### Height Conversion for Older Recipes

| Old (mm) | New (inches) | Typical Gun Tilt (mm) |
|----------|--------------|----------------------|
| 15 | 25 | 0.82 |
| 9 | 44 | 1.52 |
| 4 | -- | -- |

### Specialized Deposition Processes

**Fe and Co Deposition**: Dedicated recipe documentation available for ferromagnetic material deposition.
**Cu Deposition**: Low-pressure and standard recipes provided for copper film formation.
**Mo Deposition**: Parameters optimized for molybdenum sputtering.
**Ni and Ta Deposition**: Multiple recipe variations including standard and low-power options.
**SiO2 Deposition**: Uniformity data and flow/bias variation studies included.
**SiN Deposition**: Flow and RF variation characterization with AFM roughness measurements.
**Ti Deposition**: Film recipes at 3 mTorr and 100W conditions.
**TiW Co-Sputter Deposition**: Combined DC sputtering approach for titanium-tungsten alloys.
**W Deposition**: DC sputtering parameters for tungsten films.

---

## Sputter 4 (AJA ATC 2200-V)

### Materials Table (Sputter 4)

| Material | P(mT) | Power Source | Pow(W) | Rate(nm/min) | Status |
|----------|--------|--------------|--------|--------------|--------|
| Al | 5 | DC | 200 | 4.4 | Yes |
| Al2O3 | 3 | RF4-Sw1 | 200 | 5.1 | Partial |
| Au | 5 | DC | 200 | 17.7 | Yes |
| Au | 10 | DC | 200 | 35.5 | Yes |
| Cu | 5 | DC | 150 | 6.7 | No |
| Nb | 4 | DC | 250 | 7.5 | No |
| Pt | 5 | DC | 200 | 7.4 | Yes |
| Pt | 3 | DC | 50 (439V) | 3.9 | Yes |
| Ru | 3 | DC | 200 | ~10 | Yes |
| Ti | 10 | DC | 200 | 2.3 | Yes |
| TiN | 3 | DC | 150 | 2 | No |
| TiO2 | 3 | RF | 250 (450V) | 4.3 | Yes |
| TiW | 4.5 | DC | 200 | 4.7 | Yes |
| TiW | 4.5 | DC | 300 | 9.5 | Yes |
| W | 3 | DC | 300 | 11.5 | Yes |

### Material-Specific Details

**Au Deposition**: AFM step and roughness characterization available.
**Al Deposition**: SEM profile analysis included.
**Al2O3 Deposition**: Rate of 5.134 nm/min with Cauchy refractive index parameters (A=1.626, B=5.980E-3, C=1.622E-4) across 190-1700nm wavelength range.
**Pt Deposition**: AFM step and roughness data documented.
**Ru Deposition**: Deposition Rate ~10nm/min for hardmask applications with fluorine-ICP etching compatibility.
**Ti-Au Deposition**: Combined recipe with SEM cross-sectional analysis.
**TiO2 Deposition**: Refractive index spectrum, resistivity, and AFM roughness characterization.
**TiW Deposition**: AFM step and roughness measurements at 4.5 mTorr, 300W.
**W-TiW Deposition**: Layered deposition recipe for tungsten-titanium films.

---

## Sputter 5 (AJA ATC 2200-V)

### Materials Table (Sputter 5)

| Material | P(mT) | Power Source | Pow(W) | Rate(nm/min) | Status |
|----------|--------|--------------|--------|--------------|--------|
| Al | 5 | DC/RF | 200/300 | ? | No |
| Al2O3 | 1.5 | DC5-SW1 | 150 | 5.3 | No |
| Cr | 5.0 | RF | 200 | 4.47 | No |
| Pt | 3.0 | DC | 200 (507v) | 7.03 | No |
| SiO2 | 3 | DC | 250 | 2.32 | No |
| SiO2 | 3 | DC | 250 | 2.29 | No |
| SiO2 | 3 | DC | 250 | 2.32 | Yes |
| Ti | 3.0 | DC | 200 (374v) | 2.52 | No |

**SiO2 Deposition**: Multiple recipes with varying oxygen flow rates (2-6 sccm) and stress/uniformity characterization.

---

## Ion Beam Deposition (Veeco NEXUS)

High-density reactive sputtering system for dielectric film stacks with angled/rotating fixtures.

### SiO2 Deposition (IBD)

**Process Parameters**:
- Deposition rate: ~5.2 nm/min (user calibration required)
- HF etch rate: ~350 nm/min
- Stress: ~-390 MPa (compressive)
- Refractive Index: ~1.494

**Cauchy Parameters (350-2000nm)**:
- A = 1.480
- B = 0.00498
- C = -3.2606e-5

**Uniformity Data** (June 2010):
- Mean thickness: 1677.80 nm
- Min: 1671.09 nm
- Max: 1688.9 nm
- Standard deviation: 5.99 nm
- Refractive index uniformity: Mean 1.480, std. dev. 8.6e-4

### Si3N4 Deposition (IBD)

**Properties**:
- Deposition rate: ~4.10 nm/min
- HF etch rate: ~11 nm/min
- Stress: ~-1590 MPa (compressive)
- Refractive index: ~1.969

**Cauchy Parameters (350-2000nm)**:
- A = 2.000
- B = 0.01974
- C = 1.2478e-4

### Ta2O5 Deposition (IBD)

**Properties**:
- Deposition rate: ~7.8 nm/min
- HF etch rate: ~2 nm/min
- Stress: ~-232 MPa (compressive)
- Refractive index: ~2.172

**Cauchy Parameters (350-2000nm)**:
- A = 2.1123
- B = 0.018901
- C = -0.016222

### Al2O3 Deposition (IBD)

**Properties**:
- Deposition rate: ~2.05 nm/min
- HF etch rate: ~167 nm/min
- Stress: ~-332 MPa (compressive)
- Refractive index: ~1.656
- Absorbs below ~350 nm

### TiO2 Deposition (IBD)

**Properties**:
- Deposition rate: ~1.29 nm/min
- HF etch rate: ~5.34 nm/min
- Stress: ~-445 MPa (compressive)
- Refractive index: ~2.259

**Cauchy Parameters (350-2000nm)**:
- A = 2.435
- B = -4.9045e-4
- C = 0.01309
- Absorbs below ~350 nm

### SiOxNy Deposition (IBD)

Variable composition films with refractive index tunable between Si3N4 (n~1.969) and SiO2 (n~1.494) through oxygen and nitrogen gas flow adjustment. Deposition rate ranges 5-53 A/min depending on oxygen flow.

### Standard Cleaning Procedure (IBD)

Grid cleaning duration requirements:
- 5 min GridClean for <=1 hr deposition
- 10 min GridClean for up to 2 hrs deposition
- Maximum 2-hour continuous deposition; longer processes require multiple 2-hour subroutines with intervening cleans

---

## Reference Recipes (Disabled Tools)

### Sputter 2 (SFI Endeavor)

Historical reference documentation for decommissioned system:
- **Al Deposition**: Legacy recipe available
- **AlNx Deposition**: Aluminum nitride process documentation
- **Au Deposition**: Gold film sputtering parameters
- **TiO2 Deposition**: Titanium dioxide reactive sputtering

---

## Process Control Resources

- SignupMonkey pages track currently installed targets for Sputter 3, 4, and 5
- Process control data sheets available in Google Sheets format
- Historical characterization data retained for reference

## Notes

For critical depositions, calibrations are recommended across all systems. User-specific process optimization is essential for achieving target film properties.

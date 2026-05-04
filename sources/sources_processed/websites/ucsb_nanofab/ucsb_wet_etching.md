<!-- Source: https://wiki.nanofab.ucsb.edu/wiki/Wet_Etching_Recipes -->
<!-- Fetched: 2026-04-05 -->

# Wet Etching Recipes - UCSB Nanofab Wiki

## Contents
1. Chemicals Available
2. Table of Wet Etching Recipes
3. Wet Etching References
4. Organic Removal
5. Gold Plating Bench
6. Chemi-Mechanical Polishing (CMP)
7. Mechanical Polishing (Allied)

## Chemicals Available

The Chemical Lists document stocked chemicals, photolithography chemicals, and procedures for introducing new chemicals.

## Table of Wet Etching Recipes

The table is sortable by material, etchant, rate, anisotropy, selectivity, and references.

### Key Recipes:

**Photoresist & Organics**
- Etchant: H2SO4:H2O2 = 3:1 (Piranha Solution)
- Rate: 5-10 min typical for polymer residue
- Selective to: Cr, W, Au, Pt, Si, SiO2, SiN
- Note: Dangerous boiling hazard - etches Ti, Ni, Hf as well
- Confirmed: Demis D. John, 2017

**InP Compounds**
- H3PO4:HCl = 3:1 at ~1000 nm/min (highly anisotropic)
- Selective to InGaAsP with high selectivity

**InGaAs**
- H2SO4:H2O2:H2O = 1:10 at ~600 nm/min
- Selective to InP with high selectivity
- Note: Exothermic reaction

**GaAs**
- NH4OH:H2O2 = 1:30 (selective to AlGaAs)
- ~200nm stop-etch capability

**AlGaAs (Al >=80%)**
- HF:H2O = 1:20 (selective to GaAs)

**Oxides**

*Oxide of InP:*
- NH4OH:H2O = 1:10 at 1 min removal time
- Selective to InP

*Oxide of GaAs:*
- HCl:H2O = 1:10 at 1 min removal time
- Selective to GaAs

**Al2O3 (ALD Plasma 300C)**
- Developer 300MIF: ~1.6 nm/min
- Developer 400K: ~2.2 nm/min
- Developer 400K (1:4): ~1.6 nm/min
- NH4OH:H2O2:H2O (1:2:50): <0.5 nm/min
- Note: Rate slows with time

**Al2O3 (IBD)**
- HF (Buffered HF Improved, Transene): ~170 nm/min
- Selective to photoresist with high selectivity
- Note: May need thin SiO2 adhesion layer with 100C baked HMDS
- Confirmed: Biljana Stamenic, 2017-12

**Al2O3 (AJA#4)**
- Developer 726 MiF: 3.5 nm/min
- Developer 300 MiF: 4.30 nm/min

**SiO2 (PECVD #1)**
- HF (Buffered HF Improved, Transene): ~550 nm/min
- Confirmed: Biljana Stamenic, 2023

**SiO2 (PECVD #2)**
- HF (Buffered HF Improved, Transene): ~680 nm/min
- Confirmed: Biljana Stamenic, 2023

**SiO2 (ALD -BDEAS 300C)**
- HF (Buffered) diluted 1:100: ~7.46 nm/min
- Confirmed: Biljana Stamenic, 2024

**SiO2 (IBD)**
- HF (Buffered HF Improved, Transene): ~260 nm/min
- Confirmed: Biljana Stamenic, 2023

**SiO2 LDR (Unaxis VLR)**
- HF (Buffered HF Improved, Transene): ~170 nm/min
- Confirmed: Biljana Stamenic, 2023

**SiO2 HDR (Unaxis VLR)**
- HF (Buffered HF Improved, Transene): ~230 nm/min
- Confirmed: Biljana Stamenic, 2023

**Si3N4 (PECVD#1)**
- HF (Buffered HF Improved, Transene): ~120 nm/min
- Confirmed: Biljana Stamenic, 2023

**Si3N4 (PECVD#2)**
- HF (Buffered HF Improved, Transene): ~35 nm/min
- Confirmed: Biljana Stamenic, 2023

**Si3N4 Low-Stress (PECVD#2)**
- HF (Buffered HF Improved, Transene): ~30 nm/min
- Confirmed: Biljana Stamenic, 2023

**Si3N4 (IBD)**
- HF (Buffered HF Improved, Transene): ~5 nm/min
- Confirmed: Biljana Stamenic, 2023

**SiN (Unaxis VLR)**
- HF (Buffered HF Improved, Transene): ~10 nm/min
- Confirmed: Biljana Stamenic, 2023

**SiN Low Stress (Unaxis VLR)**
- HF (Buffered HF Improved, Transene): ~135 nm/min
- Confirmed: Biljana Stamenic, 2023

**Ta2O5 (IBD)**
- HF (Buffered HF Improved, Transene): 0.07 nm/min
- Confirmed: Biljana Stamenic, 2023

**TiO2 (IBD)**
- HF (Buffered HF Improved, Transene): 1.0-2.0 nm/min
- Confirmed: Biljana Stamenic, 2014-12

**Si (<100> crystalline)**
- KOH (45%) @ 87C: ~730 nm/min
- Highly anisotropic, crystallographic (~55 degrees)
- Selective to Low-Stress Si3N4 (PECVD #2 or commercial LPCVD)
- Notes: PR etches quickly, SiO2 etches slowly
- Use covered, heated vertical bath (Bay 4)
- Confirmed: Brian Thibeault, 2017

## Wet Etching References

### Compound Semiconductor Etching
[Guide reference: A.R. Clawson, 2001] - Provides an impressively vast list of various III-V wet etches, organized by various applications.

### Metal Etching
- Selective Wet Etch of Cr over Ta using Cr Etchant
- Wet Etch of ITO using Heated, Diluted HCl Solution

### Silicon Etching
References to IEEE Journal of MEMS publications (1996, 2003) for etch rate tables.

## Organic Removal

### Piranha Solution
Safety resources:
- MIT's Piranha Solution safety document
- Harvard EHS Handling Document

Used for etching photoresist residues after dry etching. Careful preparation and handling required.

### PureStrip (Transene)
- Heat to 70C
- Located on Wafer Toxic-Corrosive bench in Bay 4
- Loses potency after a few days when heated; requires draining and replenishment
- Duration: ~30-90 min to remove stubborn microscopic photoresist residues from dry etching

## Gold Plating Bench (Technic SEMCON 1000)

Standard plating recipes taught during equipment training.

Process steps:
1. Sputter-coat thin (~100nm) Au "seed layer" on all wafer surfaces (consider shadowing in high-aspect ratio trenches)
2. Perform photolithography to protect areas (open 4 contact points on wafer edge for electrode contact)
3. Optionally use EBR100 to clear photoresist from contact points
4. Execute electroplating on Technic SemCon with electrodes contacting seed layer (program for desired current/time to achieve plating thickness, typically microns)
5. Strip photoresist using standard solvents
6. Use Oxford Ion Mill to blanket etch seed layer across wafer (100nm removal from plated regions negligible vs. ~1um plated)

## Chemi-Mechanical Polishing (CMP)
*To Be Added*

## Mechanical Polishing (Allied)
*To Be Added*

*Last edited: October 11, 2025*

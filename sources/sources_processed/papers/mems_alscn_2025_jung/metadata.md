# Recent Progress in Aluminum Nitride for Piezoelectric MEMS Mirror Applications: Enhancements with Scandium Doping
- **Authors:** Yohan Jung, Dongseok Lee, Jongbaeg Kim
- **Journal:** Microsystems & Nanoengineering (Nature)
- **Year:** 2025
- **DOI:** 10.1038/s41378-025-01053-8
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC12479902/

## Abstract
Piezoelectric microelectromechanical systems (MEMS) mirrors facilitate precise, rapid beam steering with minimal power requirements, serving as essential components in light detection and ranging (LiDAR) and optical imaging systems. While lead zirconate titanate (PZT) demonstrates high piezoelectric coefficients suitable for such applications, its elevated processing temperatures (500-700 C), lead contamination risks during complementary metal-oxide-semiconductor (CMOS) integration, and hysteresis-related nonlinearity restrict broader implementation. Aluminum nitride (AlN) presents an appealing alternative with low deposition temperatures below 400 C, contamination-free composition enabling CMOS compatibility, environmental stability, and minimal hysteresis, though its inherently reduced piezoelectric coefficient constrains actuation efficiency for achieving large scan angles. Scandium doping addresses this limitation by substantially enhancing AlN's piezoelectric response. Scandium-doped AlN (AlScN) enables considerable scan angles in MEMS mirror applications through significantly amplified piezoelectric coefficients and decreased mechanical stiffness, while preserving advantages including CMOS compatibility and environmental robustness. This review examines recent developments in AlN and AlScN for MEMS mirror applications, emphasizing effects on piezoelectric properties, fabrication methodologies, and mirror performance.

## Key Points
- Reviews AlN and AlScN (scandium-doped AlN) for piezoelectric MEMS mirror applications
- AlScN offers 3-5x higher piezoelectric coefficients than undoped AlN
- CMOS-compatible processing (< 400 C deposition) unlike PZT (500-700 C)
- Applications in LiDAR beam steering and optical imaging systems
- Discusses fabrication methods, thin film quality, and device performance metrics

## Relevance to Nanofab Book
This Microsystems & Nanoengineering review covers the emerging AlScN material platform that is transforming piezoelectric MEMS, providing essential content for the MEMS/NEMS section on advanced piezoelectric materials and CMOS-compatible fabrication.

## Full Text

*(Full text successfully extracted from PMC12479902. Article is open access under Nature/Creative Commons license.)*

### Introduction

MEMS mirrors are essential components in advanced optical applications including display projectors, optical switches, optical coherence tomography, head-up displays, and smart headlights. In LiDAR systems, these devices enable high-speed beam steering for high-resolution 3D mapping and real-time environmental perception in autonomous vehicles.

Among actuation mechanisms, piezoelectric actuation offers precise angular control, fast response times, and low steady-state power consumption at moderate driving voltages. PZT possesses high piezoelectric coefficient (d33 = 200-600 pC/N) but requires 500-700 C processing, incompatible with CMOS back-end-of-line integration. Pb can diffuse into gate dielectrics and contaminate cleanroom tools. PZT's ferroelectric nature introduces residual polarization and nonlinear hysteresis.

AlN presents a compelling alternative with low-temperature deposition (<400 C) enabling CMOS integration. AlN forms a wurtzite crystal structure during sputtering, exhibiting intrinsic piezoelectric properties without additional polarization treatments. However, AlN's intrinsically low piezoelectric response limits performance.

Scandium doping induces lattice distortion and increases ionicity in the AlN crystal lattice, resulting in enhanced spontaneous polarization. Doping AlN with 40% Sc increases piezoelectric coefficient by approximately 500%.

### Properties of AlScN Thin Films

Scandium has the lowest formation energy (0.3 eV) among various metal dopants when substituting for aluminum. Akiyama et al. reported d33 values of 27.6 pC/N at 43% Sc concentration under CMOS-compatible conditions (400 C). The piezoelectric coefficient increases from 8.4 pC/N for undoped AlN to 23.6 pC/N at 33.2% Sc.

However, hardness declines from 23 to 13.5 GPa, and Young's modulus decreases from 338 to 193 GPa as Sc concentration rises to ~43%. At Sc concentrations above 51%, a phase transition from wurtzite to rock-salt eliminates piezoelectricity.

The coercive field remains high (>1.5 MV/cm), indicating polarization reversal requires much stronger electric field than PZT (0.03-0.12 MV/cm). Under typical low-voltage driving conditions, AlScN actuators exhibit hysteresis-free mechanical behavior.

Multilayer structuring increases breakdown field from ~5.9 MV/cm in single-layer to 7.2 MV/cm in seven-layer structure. Double-layer ferroelectric architectures achieve performance on par with PZT actuators while requiring only about half the electric field.

### Fabrication of AlScN for MEMS Mirrors

Achieving highly c-axis-oriented AlScN thin films is critical. Challenges include oxygen ingress forming Sc2O3 impurities, abnormally oriented grains (AOGs) at higher Sc concentrations, and residual stress during deposition.

Reactive sputtering has emerged as the most practical deposition method. Optimized processes achieve FWHM values below 2 degrees for AlScN films with Sc concentrations between 6 and 30%.

Etching behavior is strongly influenced by Sc concentration. AlN exhibits ~13 nm/s etch rate with ICP, while increasing Sc concentration reduces rates to ~1.3 nm/s due to strong Sc-N bonds (13.35 eV dissociation energy) and low-volatility ScCl3 byproducts. Dry etching techniques (RIBE at ~36 nm/min, ICP at 230 nm/min with Cl2/BCl3/N2) provide superior anisotropy.

### AlN and AlScN-Based MEMS Micromirrors

The first AlN-based MEMS micromirror was fabricated by Shao et al. in 2018. 1-DOF designs achieved 137.9 degrees scan angle at 20 VAC and 3385 Hz with closed-loop feedback. 2-DOF gimbaled designs achieved optical scan angles of 51.2 and 50.8 degrees along x- and y-axes with Q-factor near 18000.

The first AlScN-based MEMS micromirror was presented by Gu-Stoppel et al. in 2019. Three-level constructions separate mirror plates from concealed actuators via vertical pillars, maximizing fill factors. Single-layer designs integrate mirrors and actuators monolithically.

Key AlScN achievements: quasi-static TOSA of 10.4 degrees at +/-20 VDC; resonant TOSAs of 102.8 and 104.8 degrees in vacuum at 810 and 891 Hz; fast steering mirrors with 0.5 ms response time and 0.3 microrad angular resolution.

### Comparative Analysis: AlN vs. AlScN

At identical electric fields, AlScN achieves 3-4x improvements in tilt angle and displacement vs AlN. At 100 MV/m, tilt angles were 1.2 degrees for AlN and 4.3 degrees for AlScN. Achieving 20 degrees TOSA required 240 Vpp for AlN vs 140 Vpp for AlScN.

### Applications

- **LiDAR**: Field-of-view >25 degrees, diameters >2 mm, resonance >0.8 kHz; withstanding 900g shock and 20g vibration
- **Laser projection**: For automotive smart headlights and AR smartglasses
- **Laser material processing**: Large-aperture (7-10 mm) mirrors for high-power laser scanning
- **Cold-atom control**: Precise beam steering for quantum optics
- **Laser tracking**: Tracking speeds up to 3.77 m/s at 5 m distance, stable operation over 110 m

### Conclusion

AlScN combines CMOS-compatible processing, low-temperature deposition, and substantially enhanced actuation efficiency (~3-4x higher than pure AlN). Future research directions include optimizing Sc concentrations, multilayer engineering for improved breakdown strength, advanced etching for higher-aspect-ratio features, and closed-loop control integration.

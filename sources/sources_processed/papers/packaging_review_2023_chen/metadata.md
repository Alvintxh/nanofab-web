# Challenges and Prospects for Advanced Packaging
- **Authors:** Zhiwen Chen, Jiaju Zhang, Shizhao Wang, Ching-Ping Wong
- **Journal:** Fundamental Research
- **Year:** 2023
- **DOI:** 10.1016/j.fmre.2023.04.014
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC11670716/

## Abstract
In the post-Moore era, advanced packaging is becoming more critical to meet the everlasting demands of electronic products with smaller size, more powerful performance and lower cost. In this paper, developments in advanced packaging have been discussed, such as 3D IC packaging, fan-out packaging, and chiplet packaging. Insights on the major advantages and challenges have also been briefly introduced. Our prospects about the solutions to some fundamental issues in sustainable development of advanced packaging have also been elucidated. The critical aspects and opportunities lie in standardization, co-design tools, new handling technologies, as well as multi-scale modeling and simulation.

## Key Points
- Reviews 3D IC packaging, fan-out packaging, and chiplet-based packaging architectures
- Discusses hybrid bonding for ultra-fine pitch interconnects (<10 um, down to <1 um)
- Addresses standardization challenges (UCIe) and co-design methodology needs
- Covers TSV technology, redistribution layers, and thermal management
- Authored by Ching-Ping Wong, a leading authority in electronic packaging

## Relevance to Nanofab Book
This review provides essential coverage of advanced packaging technologies (3D IC, chiplets, hybrid bonding) that represent the fastest-growing area of semiconductor manufacturing -- critical for the applications chapter of the v2 book.

## Full Text

*(Full text successfully extracted from PMC11670716. Article is open access.)*

### 1. Introduction

The performance of electronic products is driven by advances in semiconductor processes, especially lithography technology. However, the electronics community has witnessed a slow deviation from Moore's law since the 2010s due to soaring development costs and physical limits. Advanced packaging is a promising approach to sustain PPAC (power, performance, area, and cost) scaling.

SiP and PoP laid the beginning of advanced packaging for higher integration density. 2D integration (WLP, FC) and 3D IC (TSV) further reduced interconnection distance. Notable platforms include TSMC's InFO and CoWoS, ASE's FOCoS, Amkor's SLIM and SWIFT.

### 2. Challenges in Advanced Packaging

#### 2.1. 3D IC Packaging

3D IC architectures combine multiple devices interconnected via vertical interconnects. TSV is the core technology, providing shortest chip-to-chip interconnections with: (a) better electrical performance; (b) ~80% lower power consumption; (c) greater data width and bandwidth; (d) higher density.

Key challenges: (1) Yield drops ~40% when stacked layers increase from 2 to 8 in W2W bonding; (2) Bonding requires surface roughness <1 nm; (3) Thermal management for middle chips is extremely challenging; (4) Testability and reliability in harsh environments.

#### 2.2. Fan-out Packaging

Fan-out is a substrate-less package using temporary carrier and molding compound. RDL "fans out" I/Os beyond chip size limits. High-end fan-out at 1-1 um and below is expected for HBM applications.

Challenges: (1) Die shifting (must be within +/-5 um); (2) Warpage can reach ~2.20 mm for 8-inch wafers after grinding; (3) Process compatibility issues.

#### 2.3. Chiplet Packaging

Chiplets partition SoC functions into smaller, mature, modular IP blocks. Benefits include 40% reduction in development and manufacturing cost of 32-core CPU, and 1.7x yield improvement for 720 mm2 chip system using 8-chiplet design.

Challenges: (1) Complex heterogeneous interfaces; (2) Warpage affecting fine-feature alignment; (3) EDA toolchain ecosystem needs.

### 3. Prospects in Advanced Packaging

Key opportunities: (1) Standardization (UCIe for chiplets, panel size for fan-out); (2) New handling technologies (low-cost high-performance bonding, large-scale metrology); (3) Co-design tools bridging IC and package design; (4) Multi-scale and multi-physics modeling from mm (package) to nm (IC) levels.

### 4. Concluding Remarks

Advanced packaging can further exploit benefits of scaling down by developing new architecture, reducing communication distance and achieving higher packaging density. Standardization, new techniques, co-design tools and multi-scale simulation are critical to sustainable development.

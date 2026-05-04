# Review of Directed Self-Assembly Material, Processing, and Application in Advanced Lithography and Patterning
- **Authors:** Xiuyan Cheng, Di Liang, Miao Jiang, Yufei Sha, Xiaonan Liu, Jinlai Liu, Qingchen Cao, Jiangliu Shi
- **Journal:** Micromachines
- **Year:** 2025
- **DOI:** 10.3390/mi16060667
- **URL:** https://pmc.ncbi.nlm.nih.gov/articles/PMC12194818/

## Abstract
Directed self-assembly (DSA) lithography represents an advanced patterning approach leveraging block copolymer (BCP) self-assembly properties. This technique combines DSA with established lithographic methods -- including extreme ultraviolet, deep ultraviolet, electron beam, and nanoimprint lithography -- to substantially enhance pattern resolution and device density. The two primary DSA methods are graphoepitaxy, which employs topographic templates to direct BCP assembly, and chemoepitaxy, utilizing chemically patterned surfaces with controlled interfacial energies. Through DSA technology, nanoscale patterns with smaller feature sizes and higher densities can be obtained, enabling hole and line pattern miniaturization, pitch multiplication, and improved roughness alongside critical dimension uniformity. The approach shows considerable promise for logic, memory, and optoelectronic device fabrication applications.

## Key Points
- Comprehensive review of DSA materials, processing, and semiconductor applications
- Covers both graphoepitaxy (topographic templates) and chemoepitaxy (chemical patterns)
- DSA integration with EUV, DUV, EBL, and NIL for enhanced resolution
- Discusses pitch multiplication, hole shrink, and CD uniformity improvements
- Applications in logic, memory, and optoelectronic device fabrication

## Relevance to Nanofab Book
This review provides the most current overview of DSA for semiconductor patterning, essential for updating the self-assembly chapter with practical integration strategies and the latest BCP material developments.

## Full Text

*(Full text successfully extracted from PMC12194818. Article is open access under MDPI/Creative Commons license.)*
*(Due to article length (~15,000 words), full text is available at: https://pmc.ncbi.nlm.nih.gov/articles/PMC12194818/)*
*(Key sections extracted below)*

### 1. Introduction

The semiconductor industry faces escalating challenges as conventional photolithography approaches fundamental resolution limits. With feature sizes entering the sub-10 nm regime, the limitations of optical diffraction and escalating costs associated with advanced lithographic techniques threaten the continuation of Moore's Law.

EUV lithography enables 7 nm node production but encounters significant commercialization obstacles. Tool costs exceed $150 million, and complex vacuum system requirements present barriers to widespread adoption. Meanwhile, multi-patterning techniques have increased mask counts from 40 layers at 28 nm to over 100 layers at 5 nm nodes, expanding lithography's cost contribution from 18% to 42% of total wafer fabrication budgets.

DSA has emerged as a particularly promising candidate for next-generation patterning. The International Roadmap for Devices and Systems (IRDS) identifies DSA, in combination with EUV, as a next-generation advanced patterning technique. The synergy enables sub-10 nm resolution enhancement, defect rectification, and improved roughness while reducing EUV dose requirements by 30-50% through self-aligned pattern multiplication.

At its core, DSA represents transformation from conventional top-down patterning to bottom-up nanostructure formation, using the inherent self-assembly properties of BCPs. Block copolymers are architecturally precise macromolecules consisting of two or more chemically distinct polymer blocks covalently bonded together.

When thermally annealed, BCPs undergo microphase separation driven by the Flory-Huggins interaction parameter (chi), which quantifies polymer block incompatibility. The polystyrene-block-poly(methyl methacrylate) (PS-b-PMMA) system separates into periodic nanodomains with dimensions directly controlled by the degree of polymerization (N) and chi value, enabling a sub-5 nm feature size through high-chi BCPs.

Compared to EUV or nanoimprint lithography (NIL), DSA eliminates the need for expensive light sources, masks, and multi-patterning steps, significantly reducing manufacturing costs while achieving sub-5 nm feature resolution.

### 2. DSA Process Flow Introduction

Two mainstream process strategies enable BCPs to form highly ordered nanostructures over large areas. In the graphoepitaxy method, the BCP assembly region is confined by physical barriers, whereas in the chemoepitaxy method, it is determined by chemical modifications in surface energy on the substrate.

**Graphoepitaxy** offers advantages such as simple processing, high tolerance, fewer defects, and precise pattern alignment. The template pattern of the substrate imposes structural constraints on the BCPs. The self-assembly of the BCPs is initiated and guided by the sidewalls of the template and then propagated to the central region.

**Chemoepitaxy** employs substrate-selective chemical patterning to guide self-assembly, eliminating spatial limitations while improving long-range order through tailored interfacial energy gradients. Three major chemoepitaxy flows are discussed:
- **LiNe flow**: Guiding layer (X-PS) is patterned first, then neutral brush layer is coated
- **SMART flow**: Neutral layer is patterned first, then guiding material is applied
- **ULST flow**: Underlayer surface treatment eliminates need for brush material, simplifying process

### 3. Materials for DSA Lithography

Key material components include:
- **Underlayers (ULs)**: Polymeric (PS-r-MMA, 60-80% styrene) and inorganic (SiO2, SiNx with SAM modification)
- **Neutral Layers (NLs)**: PS-r-PMMA random copolymer brushes achieving perpendicular domain orientation
- **BCP Materials**: PS-b-PMMA (chi: 0.03-0.05, 15-30 nm), PS-b-P2VP (chi: 0.10-0.15, 8-15 nm), PS-b-PDMS (chi: 0.25-0.35, 5-10 nm)

High-chi BCPs (chi > 0.2 at 150 C) like PS-b-PDMS enable sub-10 nm features but require advanced etch selectivity enhancement techniques. Tokyo Ohka Kogyo (TOK) researchers developed novel BCPs that achieve sub-10 nm and perpendicular orientations under the same conditions as PS-b-PMMA.

### 4. Pattern Transfer Techniques

- **Dry etching**: RIE with O2 plasma selectively removes PMMA block, leaving PS as hard mask
- **Wet etching**: Offers high selectivity, reduced substrate damage; one-step PMMA removal processes developed

### 5. DSA Simulation

Core simulation technologies include:
- **SCFT**: Predicts equilibrium BCP morphologies (lamellae, cylinders)
- **MD simulations**: Track dynamic processes during domain formation and defect evolution
- **DFT**: Provides atomic-scale insights into BCP interactions and substrate-polymer bonding
- **Machine learning**: Accelerates BCP self-assembly predictions, enables inverse DSA design

### 6. DSA Industrial Application

Recent industrial advances include:
- **Pattern rectification**: Intel reported LER/LWR improvement to 1.70/1.40 from 1.88/2.71 using DSA
- **Pitch multiplication**: TEL achieved 30-50 nm pitch hexagonal hole patterns with 9x multiplication
- **LCDU improvement**: High-chi BCP improved LCDU from 1.71 nm to 1.41 nm and PPE from 3.13 nm to 2.18 nm
- **Sony**: First production-grade back-illuminated CMOS image sensor using DSA process
- **Cost reduction**: 17% cost reduction in Si-based FEOL processes through batch-processed DSA
- IBM, IMEC, Intel, TEL, CEA-Leti have established 300 mm wafer DSA pilot lines

### 7. DSA Challenges

- **Defect density**: Current benchmarks (~10/cm2) far exceed industry standards (<1/cm2)
- **BCP material complexity**: Precise control of polymer composition, molecular weight, interfacial interactions
- **Metrology**: Insufficient chemical contrast during pre-etch evaluation, throughput constraints in defect inspection

### 8. Conclusions and Outlook

DSA lithography offers advantages such as reduced manufacturing costs, CD shrinkage, pattern density multiplication, and improved roughness. When combined with EUV, DUV, EBL and NIL, DSA enhances pattern resolution, repairs defects, and improves CDU. Future developments include advanced BCP materials, DSA-specific simulation software, novel self-assembly methods, and hybrid strategies combining DSA with next-generation lithography. There is urgent need to establish an integrated DSA-based patterning ecosystem including materials, equipment, processes, computational lithography, simulation tools, and electronic design automation (EDA).

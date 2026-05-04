# 纳米制造技术：原理、工艺与实践

---

## 前言

纳米制造（nanofabrication）是现代技术的基础工艺之一。从集成电路（integrated circuit）的持续微缩，到光子器件（photonic device）、微机电系统（MEMS）和生物芯片（bioMEMS）的兴起，纳米尺度的图形化与加工能力决定了众多领域的技术边界。

然而，纳米制造的知识体系分散在大量英文文献中，且不同来源的侧重点各异：有的偏重物理原理，有的强调工艺实践，有的聚焦于特定技术路线。对于需要系统掌握这一领域的工程师和研究人员而言，缺少一本结构清晰、覆盖全面的中文参考书。

本书正是为填补这一空缺而编写。我们从四部权威来源中提取核心内容，经过系统整理和交叉验证，编纂为这本中文参考手册：

- **Cui (2025)**《Nanofabrication: Principles, Capabilities and Limits》——全面覆盖纳米制造各项技术的原理与极限，共419页，是本书的主要骨架来源。
- **Campbell (2008)**《Fabrication Engineering at the Micro and Nanoscale》第3版——半导体制造工艺的经典教材，共825页，提供了扎实的工艺基础和器件背景。
- **De Teresa (2020)**《Nanofabrication: Nanolithography Techniques and Their Applications》——一篇精炼的综述，梳理了各类纳米光刻技术的对比与应用前景。
- **Georgia Tech EBL Facility**——来自佐治亚理工学院电子束光刻实验室的实际操作手册，提供了具体的工艺参数和配方。

本书不是上述文献的简单翻译，而是在理解原意的基础上进行了重新组织、精简和补充。每个技术点都标注了出处，读者可据此查阅原文获取更多细节。

---

## 本书结构

全书分为四篇，共十二章：

**第一篇 光刻技术基础**（第1–3章）

奠定纳米制造的基础知识。第1章介绍纳米制造的基本概念与技术分类；第2章系统讲解光学光刻（optical lithography）的原理、分辨率极限与工艺流程；第3章详述电子束光刻（electron beam lithography, EBL）的成像机理、邻近效应校正与典型应用。

**第二篇 直写与压印技术**（第4–6章）

覆盖三种非掩模（maskless）图形化技术。第4章讨论聚焦离子束（focused ion beam, FIB）的加工原理与应用；第5章介绍扫描探针光刻（scanning probe lithography, SPL）的各种模式；第6章讲解纳米压印（nanoimprint lithography, NIL）的工艺方案与模具制备。

**第三篇 图形转移与自组装**（第7–9章）

从光刻胶图形到功能结构的关键步骤。第7章涵盖干法与湿法刻蚀（etching）技术及其选择性控制；第8章介绍薄膜沉积（thin film deposition）方法，包括物理气相沉积（PVD）和化学气相沉积（CVD）；第9章讨论自组装（self-assembly）与嵌段共聚物光刻（block copolymer lithography）等自下而上的方法。

**第四篇 工艺实践与应用**（第10–12章）

面向实际操作。第10章讲解衬底（substrate）准备与表面处理；第11章汇总常用工艺配方与参数窗口；第12章以典型应用案例展示各技术的集成与选择。

---

## 参考来源说明

本书所有技术论述均标注来源，以便读者追溯和深入阅读。引用格式如下：

> 在正文中，来源信息以括注形式出现在相关段落末尾，格式为：
>
> **（参见：Cui 2025, §X.X, pp.XX）**

其中 `§` 后为原文章节编号，`pp.` 后为原文页码。多个来源时用分号分隔，例如：

> （参见：Cui 2025, §3.2, pp.45–48; Campbell 2008, §7.1, pp.201–205）

四个来源的缩写分别为：

| 缩写 | 完整来源 |
|------|---------|
| Cui 2025 | Zheng Cui,《Nanofabrication: Principles, Capabilities and Limits》, 2025 |
| Campbell 2008 | Stephen A. Campbell,《Fabrication Engineering at the Micro and Nanoscale》3rd ed., 2008 |
| De Teresa 2020 | De Teresa et al.,《Nanofabrication: Nanolithography Techniques and Their Applications》, 2020 |
| GT EBL | Georgia Tech EBL Facility, nanolithography.gatech.edu |

当某一论述仅基于编者的综合理解而非某一特定段落时，会标注多个来源并注明"综合"。

---

## 阅读建议

本书可以通篇顺序阅读，也可以根据读者背景和需求选择重点章节：

**IC工艺工程师**
建议优先阅读第2章（光学光刻）、第7章（刻蚀）、第8章（沉积）和第10章（衬底准备）。这四章覆盖了半导体产线中最常用的工艺模块。有需要时再参考第3章了解电子束直写在掩模制备中的应用。

**科研人员**
建议重点阅读第3章（EBL）、第4章（FIB）、第5章（SPL）和第9章（自组装）。这些章节涉及实验室中常用的纳米加工手段及其前沿进展。第11章的工艺配方对实验方案设计有直接参考价值。

**初学者**
建议从第1章开始，建立对纳米制造技术体系的整体认识，然后根据兴趣选择后续章节。第2章和第7章的内容相对基础，适合作为进一步学习的起点。

无论哪种读者，第12章的应用案例都值得浏览，它展示了不同技术如何在实际器件制造中协同工作。

---

*本书编纂于2026年。技术参数以各来源出版时的数据为准，读者在实际工艺中应参考设备厂商的最新规格。*

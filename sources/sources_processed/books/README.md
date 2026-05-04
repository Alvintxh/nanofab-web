# Extracted Book Sources

All 11 textbooks extracted 2026-04-05 using PyMuPDF (extract_pdf.py).

## Extraction Summary

| Book Key | File | Pages | Words | Page Numbering |
|----------|------|-------|-------|----------------|
| cui_2025 | Zheng Cui - Nanofabrication (4th ed) | 419 | ~158K | PDF labels (C1, i-xi, 1-407) |
| campbell_2008 | Campbell - Fabrication Engineering (3e) | 825 | ~369K | offset=18 (front-1..18, then 1-807) |
| teresa_2020 | De Teresa - Nanofabrication (full) | 451 | ~183K | offset=0 (sequential PDF pages) |
| madou_vol1_2011 | Madou - Fundamentals of Microfab Vol.1 | 646 | ~366K | PDF labels |
| madou_vol2_2011 | Madou - Fundamentals of Microfab Vol.2 | 658 | ~346K | PDF labels |
| madou_vol3_2011 | Madou - Fundamentals of Microfab Vol.3 | 642 | ~349K | PDF labels |
| plummer_2022 | Plummer & Griffin - IC Fabrication | 635 | ~270K | offset=12 (pre-pub draft) |
| franssila_2010 | Franssila - Intro to Microfabrication (2e) | 508 | ~281K | offset=12 |
| lieberman_2005 | Lieberman - Plasma Discharges & Mat. Processing | 794 | ~255K | offset=37 |
| may_spanos_2006 | May & Spanos - Semiconductor Manufacturing | 480 | ~152K | offset=16 |
| lian_2022 | Lian - Semiconductor Microchips & Fabrication | 314 | ~99K | PDF labels (C1, 1-312) |
| **Total** | | **6,372** | **~2.83M** | |

## File Format

Each `<book_key>_full.txt` contains:
- Header with metadata (source filename, total pages, numbering method)
- Text organized with `[Page N]` markers before each page
- TOC extracted as `<book_key>_toc.txt` when available

## Page Number Conventions

- **PDF labels**: Books with embedded page labels use the label directly (e.g., "C1", "i", "1")
- **Offset**: Books without labels use `book_page = pdf_page_index - offset + 1`
  - Pages before the offset are labeled `front-N`
  - Pages after start from 1
- **Teresa 2020**: Uses chapter-relative numbering in the book (1-1, 2-1, etc.) but extraction uses sequential PDF page numbers for simplicity

## Citation Reference

When citing in the v2 book, use format: `[Book Key, p.N]`
- Example: `[Cui 2025, p.130]` → search for `[Page 130]` in cui_2025_full.txt
- Example: `[Campbell 2008, p.45]` → search for `[Page 45]` in campbell_2008_full.txt

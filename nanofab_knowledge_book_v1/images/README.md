# Book Figures

## Naming Convention
All figure files follow this pattern:
```
fig_chXX_short_description.svg
```

## Figure Registry

| File | Chapter | Section | Description |
|------|---------|---------|-------------|
| fig_ch02_projection_litho.svg | Ch.2 | 2.1 | Projection optical lithography system schematic |
| fig_ch03_ebl_column.svg | Ch.3 | 3.2 | EBL electron optical column cross-section |
| fig_ch03_proximity_effect.svg | Ch.3 | 3.4 | Electron scattering and proximity effect PSF |
| fig_ch07_rie_chamber.svg | Ch.7 | 7.3 | RIE chamber cross-section |
| fig_ch08_ald_cycle.svg | Ch.8 | 8.3.3 | ALD cycle 4-panel diagram (TMA/H2O) |
| fig_ch02_euv_system.svg | Ch.2 | 2.6 | EUV lithography system (all-reflective, Mo/Si multilayer) |
| fig_ch06_nil_comparison.svg | Ch.6 | 6.2-6.3 | T-NIL vs UV-NIL process comparison |
| fig_ch07_bosch_process.svg | Ch.7 | 7.5.1 | Bosch DRIE process cycle with scalloping |
| fig_ch08_liftoff.svg | Ch.8 | 8.5.1 | Bilayer resist liftoff process |
| fig_ch08_sputtering.svg | Ch.8 | 8.2.2 | DC magnetron sputtering chamber |
| fig_ch09_dsa.svg | Ch.9 | 9.5.2 | BCP directed self-assembly (chemoepitaxy) |

## Style Guidelines
- All SVGs use a shared color palette (see `../styles/figure-palette.css` for reference)
- Chinese labels use 'Noto Sans SC', fallback to sans-serif
- ViewBox sizes: equipment schematics ~500x700, process diagrams ~800-900x350-450
- Academic style: clean lines, no cartoonish elements, proper annotations

## Color Palette
- Chamber/body: #1a2332 (dark navy)
- Electrodes/metal: #667788 (steel gray)
- Beam/energy: #50c878 (green) or #7b68ee (violet for light)
- Plasma/glow: #4a9eff (blue)
- Ions/arrows: #f0a050 (amber)
- Scatter/heat: #e06040 (orange-red)
- Resist: #c0d8e8 (light blue)
- Substrate: #889098 (gray)
- Lenses/glass: #a8d0e8 (blue glass)
- Coils/copper: #c8956c (copper)

## Adding New Figures
1. Create SVG following naming convention and color palette
2. Add entry to this registry table
3. Insert `<img>` tag in the chapter markdown at the appropriate section
4. Rebuild: `python build.py`

## Updating Figure Styles
- Color palette changes: update the hex values here and in each SVG
- Font changes: search-replace font-family in all SVG files
- Future improvement: extract SVG styles to a shared CSS include

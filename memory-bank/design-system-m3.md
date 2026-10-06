# Design system — Material 3 rule base

The POS look is **Google Material 3 (M3)**, owner decision 2026-10-06 after comparing it with Polaris, Fluent 2, Carbon and Apple Liquid Glass. This file is the rule base for every UI change and for the design refactor. Read it before touching any component's styling.

**Sources (verified, not from memory):**
- `material-components/material-web` design tokens v0.192 (`tokens/versions/v0_192/_md-sys-*.scss`, `_md-comp-*.scss`) and its docs (`docs/theming/*`, `docs/components/*`).
- `@material/material-color-utilities` 0.3.0 `SchemeTonalSpot`, seed `#006A60`, which generated the colour roles.
- The owner-approved v2 mockups (`byp-pos-v2/docs/design/*.dc.html`) pin primary and the surface ladder.
- m3.material.io renders client-side and can't be fetched. Where this file states guidance (emphasis, roles), it matches the material-web docs text.

**Where it lives in code:**
- `src/lib/theme.ts`: `M3_DARK_THEME`, `M3_LIGHT_THEME`, `T.m3` roles, `M3_SHAPE`, `M3_TYPE`, `M3_STATE`.
- `src/styles/globals.css`: the "Material 3" block for focus ring, state layers and numerals.
- `ThemeProvider` sets `html[data-ds="m3"]` and `--m3-focus`.

## 1. Colour roles — use the role, never a raw hex

| Role | Dark | Light | Use for |
|---|---|---|---|
| primary / on-primary | `#6EEAD2` / `#00332C` | `#006A60` / `#FFFFFF` | **The one main action on a surface** (Bill Out, Confirm payment, Save, Sign in), checkboxes, progress, the focused chart series |
| primary-container / on- | `#00504A` / `#8AF8DF` | `#9EF2E4` / `#00504A` | One hero figure per screen (Projected · Today, Total budget, amount due), the active owner folder tab |
| **secondary-container / on-** (`T.sel` / `T.onSel`) | `#334B47` / `#CCE8E2` | `#CCE8E2` / `#334B47` | **Every selected state:** segmented buttons, filter chips, active nav item, date-range presets, seat chips, view toggles |
| secondary | `#B1CCC6` | `#4A635F` | Focus ring (`--m3-focus`), low-emphasis icons |
| tertiary / container | `#ADCAE6` / `#2D4961` | `#466179` / `#CCE5FF` | Contrast accents that aren't status: info, takeout, reserved |
| error / container | `#FFB4AB` / `#93000A` | `#BA1A1A` / `#FFDAD6` | Destructive actions (Void, Delete), errors, losses |
| surface ladder | `#0E1210` bg → `#1B2022` (low) → `#20262A` → `#2B3236` (high) → `#363E42` (highest) | `#EEF3F1` → `#FFFFFF` → `#F4F8F6` → `#E3EAE7` | Page → cards → rows/tiles inside cards → chips/fields → pressed |
| on-surface / on-surface-variant | `#E2E5E3` / `#A9B2AE` | `#171D1B` / `#3F4946` | Body text / secondary text, labels, axis text |
| outline / outline-variant | `#899390` / `#3F4947` | `#6F7977` / `#BEC9C6` | Outlined buttons and text fields / hairline dividers (only where spacing can't separate) |

Status colours (`okContainer`, `warnContainer`, `badContainer`, `infoContainer` + tints) are app-specific extensions. Use them only for real status (table state, KDS age, low stock, negative balance), always paired with a text label.

**Rules**
1. **Primary is scarce.** One filled-primary element per area. If two things look equally loud, one of them is wrong.
2. **Selection ≠ action.** A chosen tab, chip or segment is `secondary-container`, never primary.
3. **Hierarchy comes from tonal surfaces, not borders.** Step up the surface ladder for nesting; avoid 1px boxes.
4. **Colour never carries meaning alone.** Pair it with a label, icon or shape (WCAG 1.4.1).
5. **Text contrast:** 4.5:1 for body text, 3:1 for ≥24px or bold UI. The `on-*` pairs are built to pass; don't put `on-surface-variant` text on `surface-container-highest` below 14px.

## 2. Typography — house typefaces, M3 type scale for sizes (`M3_TYPE`)

**House typefaces (owner decision 2026-10-06): Roboto for text, Roboto Mono for numerals, at the current weights** (600 titles, 700 key numbers). The owner finds them clean and legible. M3 governs **sizes and line-heights**; weights in the table below are M3 defaults for reference, and the house weights win where they differ.

| Role | Size / line / weight | POS use |
|---|---|---|
| headline-medium | 28/36/400 | Hero KPI value |
| headline-small | 24/32/400 | KPI and balance tile values |
| title-large | 22/28/400 | Page title (Budget, Reports) |
| title-medium | 16/24/500 | Card and section titles (Floor, Kitchen display, Running ledger) |
| title-small | 14/20/500 | Table-card labels in dense lists, dialog sub-heads |
| body-medium | 14/20/400 | Default text, table cells |
| body-small | 12/16/400 | Notes, helper text, "+₱X unbilled" |
| label-large | 14/20/500 | Button labels |
| label-medium | 12/16/500 | Table column headers, KPI labels, chip text |
| label-small | 11/16/500 | Badges, tiny counters |

**Rules**
1. **Hierarchy comes from size and colour first.** Keep the house weights (600 titles, 700 key figures), but don't add bold to body text or labels to create hierarchy; step the size or colour instead.
2. **Sentence case everywhere.** No ALL-CAPS labels or headers; M3 removed uppercase from buttons and labels. Letter-spacing comes from the scale only.
3. **Numerals:** Roboto Mono (house choice) with `tabular-nums` (set globally for M3). Right-align numbers in tables.
4. **Currency:** `₱` prefix, thousands separators, 2 decimals in transactional views (cart, payment, ledger exports) and whole pesos only in glanceable KPIs and charts. Negative values: `−₱1,234` (true minus sign) plus error colour.

## 3. Shape (`M3_SHAPE`)

| Token | px | Use |
|---|---|---|
| extra-small | 4 | Outlined and filled text fields (top corners), tooltips |
| small | 8 | Chips, badges, tags, small toggles |
| medium | 12 | Rows, list items, inputs in forms, menus |
| large | 16 | Tiles inside cards (table cards, menu tiles, ticket rows) |
| large-increased | 20 | KPI and balance tiles |
| extra-large | 28 | Panels and cards, dialogs, sheets |
| full | 9999 | All buttons, segmented-button tracks, search field, nav pills, FAB |

**Rules:** nested shapes are concentric (inner radius = outer radius − padding). Don't invent radii between tokens; existing 14/24 values are backlog (§9).

## 4. Elevation — tonal first, shadow last

- Level 0 (no shadow) for in-flow content: cards, tiles and rows separate by surface tone and spacing.
- Level 1 (`elev1`, kept subtle) for KPI tiles and cards resting on the page.
- Level 3 (`level3`, `shadowModal`) for dialogs, menus and popovers, plus a scrim (black at 32% light / 55% dark).
- Never stack shadows on nested surfaces.

## 5. Interaction states (global CSS, `M3_STATE`)

- **State layers:** hover 8% and pressed 12% of the element's content colour (`currentColor`), overlaid on any background. Applied automatically to `button`, `[role=button]`, `[role=tab]` and any element with `cursor: pointer`. Don't hand-roll `onMouseEnter` colour swaps in M3 branches.
- **Focus:** 3px ring in `secondary`, 2px outside the element, keyboard focus only (`:focus-visible`). Never remove it.
- **Disabled:** container `on-surface` at 12%, content at 38%, cursor `not-allowed`. Keep disabled buttons visible; explain why when not obvious ("Enter cash received").
- **Selected:** `secondary-container` (§1.2), optionally with a leading check for filter chips and segmented buttons.
- **Touch targets:** ≥ 48×48px on staff-facing screens (floor, order, payment, KDS, waiter). The visual can be 40px if the hit area pads to 48.

## 6. Components

| Component | Spec | POS notes |
|---|---|---|
| **Buttons** | Height 40 (48 on touch screens), shape full, label-large. Emphasis order: **filled** (primary) > **filled tonal** (secondary-container) > **outlined** (outline) > **text** | One filled per area. Secondary actions (Split, Move, Export, Cancel) are tonal or outlined. Destructive actions use error / error-container, never primary |
| **Segmented buttons** | Height 40, full-shape track; the selected segment is secondary-container with on-secondary-container text | Section filter, station filter, date presets, Day/Ledger, column switch. 2–5 options; more than that → menu or chips |
| **Chips** | Height 32, small shape (8). Filter chips: unselected outlined or surface-container-high, selected secondary-container with a check | Menu sub-categories, discount types, void reasons. Always in a set |
| **Cards** | Filled: surface-container (low/high), no shadow. Elevated: surface-container-low + level1. Outlined: surface + outline-variant | Panels are filled cards at extra-large shape; tiles at large |
| **Navigation** | Top-level tabs: tonal pill track with the active item in secondary-container. Owner sub-sections: primary-container folder tabs (approved mockup). Primary tabs (3px primary underline) for in-page tabs | Keep at most 6 top-level destinations |
| **Text fields** | Filled (surface-container-highest, extra-small top corners, 1px bottom indicator, 2px primary on focus) or outlined (outline, 4px corners). Height 56 for forms, 40 for compact toolbars | Search is a full-shape search bar. Every field has a visible label, not just a placeholder |
| **Dialogs** | surface-container-high, extra-large shape, level3, 24px padding, headline-small title, actions right-aligned (text/tonal, then filled) | Payment, split and void confirmations. Focus is trapped and Escape closes |
| **Lists and tables** | Rows ≥ 48px (56 for touch). Separate by spacing or alternating surface-container tone, not grid lines. Header row label-medium in on-surface-variant, sentence case | Numbers right-aligned and tabular; the totals row is surface-container-highest |
| **Badges and tags** | label-small or label-medium, small shape, container/on-container pair | Status only; don't decorate |

## 7. Data presentation (Reports, Dashboard, Owner)

1. **Read order (Z-pattern):** what is happening (KPIs) → how it's changing (trend) → what drives it (breakdowns) → what exactly happened (tables).
2. **KPIs:** 4–7 per view, each with a comparison ("+12% vs last week", "₱X unbilled"). A number with no context isn't a KPI. Only one is a hero (primary-container).
3. **Chart choice:**
   - Line or area for change over time; the overlapping area chart with a gradient fill is the house style for P&L.
   - Ranked horizontal bars for category comparisons.
   - Bars, not pies, for parts of a whole when exact comparison matters.
   - No 3D and no dual axes.
4. **Chart colours:** the same series keeps the same colour everywhere:
   - Gross: tertiary/info blue
   - Cost: amber
   - Net: green
   - Expenses: error red
   - Comparison period: a muted dashed line in outline colour.
5. **Interactivity:**
   - Hover or tap readouts list every series value.
   - Legend chips toggle series.
   - Every chart has a non-visual equivalent (a table or readout) for accessibility.
6. **Tables:**
   - Text columns left-aligned, numbers right-aligned.
   - Concise sentence-case headers, sortable where useful.
   - Sticky header when it scrolls, restrained dividers.
   - Semantic colour only where it means something (negative, low stock).
7. **Empty, loading and error states** are designed, never blank. Example: "No ledger days in this range."

## 8. Motion

Deferred by the owner (2026-10-06): no new animation. For reference only, tokens are `easing-standard cubic-bezier(0.2,0,0,1)` and durations short (50–200ms) to medium (250–400ms). If motion is added later:
- Animate only opacity and transform.
- Respect `prefers-reduced-motion`.
- Test on the oldest Linux POS machine.
- Replace the box-shadow pulse (`bp-attn`, `bp-aging`) and the dialog `backdrop-filter: blur` first, since they're the expensive ones.

## 9. Implementation rules and refactor backlog

**How to write M3 styles**
- Branch on `T.m3`; the classic branch stays byte-identical (classic themes are kept for rollback only).
- Use role tokens (`T.sel`, `T.m3.secondaryContainer`, …) and the `M3_TYPE` / `M3_SHAPE` constants. Never use raw hex or ad-hoc sizes.
- Interaction states come from globals.css; don't add per-element hover handlers in M3 branches.

**Applied on dev 2026-10-06**
- Full role set, type/shape/state constants.
- Global focus ring, state layers, tabular numerals.
- Selection states moved to secondary-container across about 25 controls, including the top nav.
- M3 sizes and line-heights on section titles, KPI and balance values (house weights kept).
- Dialog elevation level3.
- Budget ledger headers in sentence case.

**Backlog (do in this order)**
1. Uppercase 11px table headers still exist in ~30 M3 branches (Menu, Inventory, Recipe, OPEX, Sales, Daily, Reports, Dashboard, Pay, KDS). Convert them to label-medium sentence case.
2. Body text and labels that are bold only for emphasis: step size or colour instead (§2.1).
3. Radii 14 and 24 → 12/16 and 28 per §3.
4. Text fields: move form inputs to the M3 filled or outlined spec with visible labels.
5. Hand-rolled `onMouseEnter` colour swaps in M3 branches: delete them (the global state layer covers them).
6. Secondary buttons currently using surface-container-high: switch to filled tonal (secondary-container) or outlined, depending on emphasis.

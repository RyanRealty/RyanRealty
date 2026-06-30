# Mobile — Pickers, Modals & Action Sheets

Every field in the mobile CRM that exposes a constrained set of choices, an agent roster, or an automation list renders via a full-screen modal sheet on a 390×844 pt logical canvas — the same interaction model that Follow Up Boss uses in its native iOS app. This section specifies (a) the shared `<BottomSheetPicker>` component that powers all single-select and multi-select field pickers, (b) each concrete picker instance bound to its data source and the field that triggers it, (c) the Assign-To modal (which extends the base pattern with search + sectioned list), (d) the Filter Deals modal (which extends it further with a segmented Deal Status control), and (e) the Settings modal (which is a distinct pattern — a full-screen grouped settings page, not a picker). All implementations use the Ryan Realty design system (navy `#102742`, cream `#faf8f4`, Geist body, shadcn/ui `@/components/ui/`) while preserving FUB's information architecture, layout proportions, and interaction patterns exactly.

---

## 1. Canonical `<BottomSheetPicker>` — Base Pattern

**[OBSERVED — basis: mob-35 (Stage), mob-54 (Source), mob-36 (Time Frame), mob-15 (Automations)]**

All four of these pickers share the same full-screen modal chrome. The component spec below is the single authoritative shape that each instance instantiates.

### 1.1 Screen regions (390×844 pt logical canvas)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| Mobile status bar (web simulation) | 0–44 | 44 pt | `#000000` (or device status bar) |
| Sheet header bar | 44–100 | 56 pt | `bg-primary` = `#102742` (navy) |
| Scrollable option list | 100–810 | 710 pt | `#ffffff` (option rows); trailing empty area `bg-muted` = `#f1f0ed` |
| Bottom safe-area pad | 810–844 | 34 pt | `#f1f0ed` (matches home-indicator zone) |

FUB original header: `#3d5060` / `#2E4A58` / `#3D5166` / `#2C4055` (varies slightly per screen, all the same dark teal-slate). Ryan Realty replacement: `bg-primary` = navy `#102742`. Visual weight is identical.

### 1.2 Header bar — exact element spec

**[OBSERVED — mob-35, mob-54, mob-36, mob-15]**

```
┌────────────────────────────────────────────────────────────────┐
│  Cancel                  {title}                     Select    │
│  ←16pt                  centered                       16pt→   │
└────────────────────────────────────────────────────────────────┘
```

| Element | Exact text | Color | Font | Size | Weight | Position |
|---|---|---|---|---|---|---|
| Left button | `Cancel` | `#ffffff` | Geist | 17px | 400 (regular) | left, 16 pt inset |
| Center title | picker-specific (see §2–§6) | `#ffffff` | Geist | 17px | 600 (semibold) | horizontally centered |
| Right button | `Select` — active: `#ffffff`; inactive/no-selection: `rgba(255,255,255,0.45)` | see note | Geist | 17px | 400 (regular) | right, 16 pt inset |

**"Select" disabled state:** `rgba(255,255,255,0.45)` — muted white, no pointer cursor (`cursor-default`). Becomes full `#ffffff` when any row is tapped. **[OBSERVED mob-36 — "Select" visibly dimmed when no option chosen]**

**"Select" button label alternate:** Some pickers (Stage — mob-35, Source — mob-54) label this `Select` and trigger confirm-then-dismiss. Others may auto-dismiss on tap. Implementation: always use the two-step pattern (tap row → tap Select) for consistency.

Header bar height: 56 pt. Top corner radius: `border-radius: 12px 12px 0 0` (sheet card appearance). No separator line between header and list (dark header bleeds naturally into white list background).

### 1.3 Option row anatomy

**[OBSERVED — mob-35, mob-54, mob-36, mob-15]**

| Property | Value |
|---|---|
| Row height | 52 pt (Stage) / 56–60 pt (Source) / 56 pt (Time Frame) / 50 pt (Automations) — use **52 pt default**, override per instance |
| Background — unselected | `#ffffff` |
| Background — selected | `#f2f6ff` (very light blue tint; FUB original ~`#EEF2FF`) |
| Label text | `text-foreground` = `#1c1c1e` (dark charcoal), 17px, `font-normal` |
| Label left padding | 16–20 pt (use 20 pt for source/assign pickers; 16 pt for stage/timeframe) |
| Row divider | `border-b border-border` = 1 px `#e0e0e2`, full width (no left inset) |
| Right-side checkmark — selected | `✓` (Lucide `Check` icon), color `text-primary` = `#102742` (Ryan Realty navy); FUB original `#2d7ff9` / `#007AFF` |
| Right-side checkmark — unselected | hidden (nothing on right) |
| Checkmark margin-right | 16 pt |
| Checkmark size | 18×18 px |

**Selected row** (single-select): exactly one row has the checkmark and light blue-tint background. All others show plain white.

### 1.4 Web presentation pattern

**[INFERRED — basis: mob-35 build notes + standard mobile web sheet pattern]**

```
// Full-screen fixed overlay on mobile (<640px):
position: fixed; inset: 0; z-index: 9999;
// Sheet container:
transform: translateY(0);   // open
transform: translateY(100%); // closed
transition: transform 300ms ease-out;
// Backdrop:
background: rgba(0,0,0,0.40);
// Sheet card:
border-radius: 12px 12px 0 0;
overflow: hidden;
max-height: 100dvh;
```

On desktop (≥640 px breakpoint): render as a centered `<Dialog>` max-width 390 px, max-height 80vh, with the same internal layout (header + scrollable list). Per `@/components/ui/sheet` (`side="bottom"`) or `@/components/ui/dialog`.

### 1.5 Base component interface

```typescript
interface BottomSheetPickerProps {
  open: boolean;
  title: string;                         // e.g. "Stage", "Source", "Time frame"
  options: PickerOption[];
  selected: string | null;               // value key of currently selected option
  onSelect: (value: string) => void;     // called when user taps Select
  onCancel: () => void;                  // called when user taps Cancel
  rowHeight?: number;                    // default 52 (pt/px)
  labelPaddingLeft?: number;             // default 16
}

interface PickerOption {
  value: string;    // internal key
  label: string;    // display string (rendered verbatim, no normalization)
}
```

### 1.6 Component tree

```tsx
<BottomSheetPicker open={open} title={title} options={options} selected={selected}
  onSelect={onSelect} onCancel={onCancel}>

  {/* Backdrop */}
  <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onCancel} />

  {/* Sheet card */}
  <div className="fixed bottom-0 left-0 right-0 z-[9999] rounded-t-xl overflow-hidden
                  flex flex-col max-h-[100dvh] bg-white">

    {/* Header bar */}
    <div className="flex items-center justify-between h-[56px] px-4 bg-primary flex-shrink-0"
         style={{ borderRadius: '12px 12px 0 0' }}>
      <button onClick={onCancel}
              className="text-white text-[17px] font-normal py-2 pr-4 min-w-[44px]">
        Cancel
      </button>
      <span className="text-white text-[17px] font-semibold flex-1 text-center">
        {title}
      </span>
      <button onClick={() => onSelect(pendingValue)}
              disabled={!pendingValue}
              className="text-[17px] font-normal py-2 pl-4 min-w-[44px]"
              style={{ color: pendingValue ? '#ffffff' : 'rgba(255,255,255,0.45)' }}>
        Select
      </button>
    </div>

    {/* Scrollable option list */}
    <ScrollArea className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
      <ul role="radiogroup" aria-label={title}>
        {options.map(opt => (
          <li key={opt.value}
              role="radio"
              aria-checked={pendingValue === opt.value}
              className="flex items-center border-b border-border cursor-pointer"
              style={{
                minHeight: `${rowHeight}px`,
                background: pendingValue === opt.value ? '#f2f6ff' : '#ffffff',
              }}
              onClick={() => setPendingValue(opt.value)}>
            <span className="flex-1 text-[17px] font-normal text-foreground"
                  style={{ paddingLeft: `${labelPaddingLeft}px` }}>
              {opt.label}
            </span>
            {pendingValue === opt.value && (
              <Check className="text-primary mr-4 w-[18px] h-[18px]" />
            )}
          </li>
        ))}
      </ul>
      {/* Trailing empty area fill */}
      <div className="bg-muted" style={{ minHeight: '40px' }} />
    </ScrollArea>

    {/* Bottom safe-area pad */}
    <div className="flex-shrink-0 bg-muted" style={{ height: '34px' }} />
  </div>
</BottomSheetPicker>
```

### 1.7 Acceptance criteria — base pattern

- AC-BSP-1: Sheet slides up from bottom with 300 ms ease-out transform animation; slides down to dismiss (Cancel or Select).
- AC-BSP-2: Backdrop `rgba(0,0,0,0.40)` renders behind the sheet; tapping backdrop fires `onCancel`.
- AC-BSP-3: Header is navy `#102742` with three text controls (Cancel / title / Select) in white Geist 17px.
- AC-BSP-4: "Select" text is `rgba(255,255,255,0.45)` (muted) when no row is pending-selected; becomes `#ffffff` (full white) when any row is tapped.
- AC-BSP-5: Tapping a row sets it as pending (checkmark appears, row background `#f2f6ff`); does NOT dismiss — user must tap "Select".
- AC-BSP-6: Tapping "Cancel" dismisses sheet; calls `onCancel()`; no field value is written.
- AC-BSP-7: Tapping "Select" calls `onSelect(pendingValue)` then dismisses.
- AC-BSP-8: List is scrollable (`overflow-y: auto`; `-webkit-overflow-scrolling: touch`); native momentum scroll on iOS Safari.
- AC-BSP-9: On desktop ≥640 px the sheet renders as a centered dialog (max-width 390 px, max-height 80vh); same internal layout.
- AC-BSP-10: Each row has `role="radio"` and `aria-checked` reflecting selection state; list has `role="radiogroup"`.
- AC-BSP-11: Row minimum tap target height 52 px; no row below 44 px (iOS HIG minimum).

---

## 2. Stage Picker

**[OBSERVED — mob-35]**

### 2.1 Trigger

Person Detail → **Stage** field in the Details section. On mobile, inline-edit is replaced by full-screen picker. **[INFERRED — basis: desktop §07a §5.1 — inline dropdown on desktop becomes full-screen picker on mobile]**

### 2.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Header bar | 44–100 | 56 pt | `#102742` (navy) |
| Scrollable stage list | 100–810 | 710 pt | `#ffffff` per row; selected row `#f2f6ff` |
| Bottom safe-area | 810–844 | 34 pt | `#eff0f3` |

### 2.3 Header

- Title: **`Stage`** — white, 17px, semibold **[OBSERVED]**
- Left: **`Cancel`** — white, 17px, regular **[OBSERVED]**
- Right: **`Select`** — white when selection pending, `rgba(255,255,255,0.45)` when nothing selected **[OBSERVED mob-35 shows "Select" in active white because "Lead" is pre-selected]**

### 2.4 Option list — all 16 stages (verbatim, top to bottom)

**[OBSERVED — mob-35 — complete list confirmed, "Lead" currently selected]**

| # | Label (exact) | Selected state in screenshot |
|---|---|---|
| 1 | `Seller Prospect` | unselected |
| 2 | `Lead` | **SELECTED** (blue checkmark `✓`, row bg `#f2f6ff`) |
| 3 | `A - Hot 1-3 Months` | unselected |
| 4 | `B - Warm 3-6 Months` | unselected |
| 5 | `C - Cold 6+ Months` | unselected |
| 6 | `Renter - future buyer` | unselected |
| 7 | `Active Client` | unselected |
| 8 | `Pending` | unselected |
| 9 | `Past Client` | unselected |
| 10 | `Sphere` | unselected |
| 11 | `Archive` | unselected |
| 12 | `Closed` | unselected |
| 13 | `Trash` | unselected |
| 14 | `Real Estate Agent` | unselected |
| 15 | `Vendor` | unselected |
| 16 | `Nurture` | unselected |

Row height: **52 pt**. Label left padding: **16 pt**. Total list height: 16 × 52 = 832 pt — slightly exceeds the 710 pt available viewport; requires a small scroll to reach `Nurture`. **[OBSERVED — native iOS scroll indicator visible at y≈300–420 pt right edge]**

### 2.5 Data

```typescript
const STAGE_PICKER_OPTIONS: PickerOption[] = [
  { value: 'seller_prospect',     label: 'Seller Prospect' },
  { value: 'lead',                label: 'Lead' },
  { value: 'a_hot_1_3_months',    label: 'A - Hot 1-3 Months' },
  { value: 'b_warm_3_6_months',   label: 'B - Warm 3-6 Months' },
  { value: 'c_cold_6_months',     label: 'C - Cold 6+ Months' },
  { value: 'renter_future_buyer', label: 'Renter - future buyer' },
  { value: 'active_client',       label: 'Active Client' },
  { value: 'pending',             label: 'Pending' },
  { value: 'past_client',         label: 'Past Client' },
  { value: 'sphere',              label: 'Sphere' },
  { value: 'archive',             label: 'Archive' },
  { value: 'closed',              label: 'Closed' },
  { value: 'trash',               label: 'Trash' },
  { value: 'real_estate_agent',   label: 'Real Estate Agent' },
  { value: 'vendor',              label: 'Vendor' },
  { value: 'nurture',             label: 'Nurture' },
];
// Source: crm_stages table; display_order must match this sequence
// Cross-ref: desktop §07a §5.1; admin §14 Custom Stages tab
```

### 2.6 Data touched

- Reads: `crm_stages` (ordered list)
- Writes: `crm_people.stage_id` → FK `crm_stages`
- Side-effect: `crm_timeline` Change Log entry on stage change; automation `stage_changed` event fires (not bypassed for individual edit)
- "Trash" stage side-effect: hides contact from smart lists, pauses action plans

### 2.7 Acceptance criteria

- AC-STG-MOB-1: Stage picker opens full-screen from the Stage field row on the mobile Person Detail screen.
- AC-STG-MOB-2: All 16 stages render in the exact order shown above.
- AC-STG-MOB-3: The contact's current stage is pre-selected (checkmark visible, row tinted) on picker open.
- AC-STG-MOB-4: "Select" is active (full white) on open because a stage is always pre-selected.
- AC-STG-MOB-5: Saving a new stage writes `crm_people.stage_id`, writes a Change Log timeline entry, and fires the `stage_changed` automation event.
- AC-STG-MOB-6: System stages (Lead, Closed, Trash) render in the list but are not visually distinguished from non-system stages in this picker — they are all selectable.
- AC-STG-MOB-7: After Select, the Person Detail Stage field updates immediately (optimistic UI).

---

## 3. Source Picker

**[OBSERVED — mob-54]**

### 3.1 Trigger

Person Detail → **Source** field in the Details section. On mobile, desktop inline dropdown becomes full-screen picker. **[INFERRED — basis: desktop §07a §5.3]**

### 3.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Header bar | 44–100 | 56 pt | `#102742` |
| Scrollable source list | 100–844 | 744 pt | `#ffffff` |
| Bottom safe-area | overlapping | 34 pt | device native |

Row height: **56–60 pt** (larger than Stage rows due to longer label text). **[OBSERVED mob-54]**

### 3.3 Header

- Title: **`Source`** **[OBSERVED]**
- Left: **`Cancel`** **[OBSERVED]**
- Right: **`Select`** **[OBSERVED]**

### 3.4 Option list (verbatim, top to bottom — partial; list continues below fold)

**[OBSERVED — mob-54 — rows 1–17 visible; `Import` selected]**

| # | Label (exact) | Notes |
|---|---|---|
| 1 | `<unspecified>` | Pinned at top (not alpha-sorted) |
| 2 | `AI- Claude` | Note: space before hyphen — render verbatim |
| 3 | `Cold Call` | |
| 4 | `Company` | |
| 5 | `County Assessor — West Side Bend 2026-05` | Long label — allow wrap or truncate with ellipsis |
| 6 | `Expired Listing` | |
| 7 | `Expired Listing Cron` | Title-case display name |
| 8 | `expired-listing-cron` | Kebab-case as stored — render verbatim, no normalization |
| 9 | `Facebook` | |
| 10 | `Farm` | |
| 11 | `Follow Up Boss` | |
| 12 | `FSBO` | |
| 13 | `Google` | |
| 14 | `IG` | |
| 15 | `Import` | **SELECTED** (checkmark, row bg `#f2f6ff`) |
| 16 | `Open House` | |
| 17 | `Realtor.com` | Partially visible at bottom edge |
| 18+ | Additional sources below fold | Inferred: `Referral`, `Sign Call`, `Walk In`, `Website`, `Zillow`, custom sources |

**Sort order:** `<unspecified>` pinned first; all others alphabetical. **[OBSERVED]**

**Duplicate entry note:** Two entries exist for `expired-listing-cron` (one title-cased, one kebab-cased). This reflects FUB storing the raw programmatic source string alongside a normalized display name. Render both exactly as stored — no deduplication. **[OBSERVED mob-54]**

### 3.5 Selected row treatment

- Row `Import`: background `#EEF2FF` tint; right-side `✓` checkmark, color `text-primary` = `#102742`. **[OBSERVED mob-54 — FUB original checkmark `#007AFF`]**

### 3.6 Data

```typescript
// Source options loaded from crm_lead_sources or API
interface SourcePickerData {
  options: PickerOption[];  // sorted: <unspecified> first, then alpha
  selected: string | null;  // current crm_people.source value
}
// API: GET /api/crm/sources → returns all source strings in account
// On select: PATCH /api/crm/people/{id} { source: value }
// Side-effect: crm_timeline Change Log entry
```

### 3.7 Spacing notes

- Label left padding: **20 pt** **[OBSERVED mob-54]**
- Right checkmark margin-right: **20 pt** **[OBSERVED mob-54]**
- Row height: **56 pt** (min-height; allow content to expand for long labels) **[OBSERVED]**
- Row divider: 1 px `#E5E7EB` full-width **[OBSERVED]**

### 3.8 Acceptance criteria

- AC-SRC-MOB-1: Source picker opens full-screen from the Source field row on mobile Person Detail.
- AC-SRC-MOB-2: `<unspecified>` renders as the first option regardless of alphabetical order.
- AC-SRC-MOB-3: All source strings render verbatim (no normalization of kebab-case or spacing).
- AC-SRC-MOB-4: Current contact source is pre-selected on open.
- AC-SRC-MOB-5: Selecting a source + tapping Select writes `crm_people.source`, logs a Change Log timeline entry, and dismisses.
- AC-SRC-MOB-6: Long labels (e.g., "County Assessor — West Side Bend 2026-05") do not truncate mid-character; row expands or uses `overflow-hidden text-ellipsis`.

---

## 4. Time Frame Picker

**[OBSERVED — mob-36]**

### 4.1 Trigger

Person Detail → **Timeframe** field in the Details section. Alternatively, People list filter → "Time frame" filter chip. **[OBSERVED mob-36 via People filter flow; also used on Person Detail per desktop §07a §5.5]**

### 4.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Header bar | 44–100 | 56 pt | `#102742` |
| Option list (5 rows) | 100–380 | 280 pt | `#ffffff` |
| Trailing empty area | 380–810 | 430 pt | `bg-muted` = `#f1f0ef` (cool gray) |
| Bottom safe-area | 810–844 | 34 pt | `bg-muted` |

The 5 options do not fill the full viewport — a large empty trailing area is visible below "No Plans". **[OBSERVED mob-36]**

### 4.3 Header

- Title: **`Time frame`** (note: lowercase "frame" — space between "Time" and "frame") **[OBSERVED]**
- Left: **`Cancel`** **[OBSERVED]**
- Right: **`Select`** — **dimmed** (`rgba(255,255,255,0.45)`) in the screenshot because no option is pre-selected (contact has no timeframe set) **[OBSERVED mob-36]**. Becomes full white when a row is tapped.

### 4.4 Option list — all 5 options (complete, verbatim)

**[OBSERVED — mob-36 — all 5 confirmed; none selected in screenshot]**

| # | Label (exact) | Stored enum key |
|---|---|---|
| 1 | `0-3 Months` | `0_3_months` |
| 2 | `3-6 Months` | `3_6_months` |
| 3 | `6-12 Months` | `6_12_months` |
| 4 | `12+ Months` | `12_plus_months` |
| 5 | `No Plans` | `no_plans` |

Row height: **56 pt**. Label left padding: **16 pt**. Row divider: 1 px `#E0E0E0` full-width. **[OBSERVED mob-36]**

No "Select an Option" / clear row in the picker sheet itself. **[OBSERVED — mob-36 shows only these 5 rows]** Clear/unset is available on the desktop inline dropdown only (desktop §07a §5.5). On mobile, to clear the field the user taps the currently-selected row to deselect it **[INFERRED]**, or a separate "Clear" affordance can be added as the first row.

### 4.5 Data

```typescript
const TIMEFRAME_OPTIONS: PickerOption[] = [
  { value: '0_3_months',      label: '0-3 Months' },
  { value: '3_6_months',      label: '3-6 Months' },
  { value: '6_12_months',     label: '6-12 Months' },
  { value: '12_plus_months',  label: '12+ Months' },
  { value: 'no_plans',        label: 'No Plans' },
];
// Writes: crm_people.timeframe (enum column)
// Cross-ref: desktop §07a §5.5 — confirmed enum; admin §14 (no admin config, this is a fixed enum)
```

### 4.6 Usage contexts

1. **Person Detail field** — reads/writes `crm_people.timeframe`. Pre-selects the current value.
2. **People list filter** — reads the filter state; on Select, applies as a smart list filter parameter. The picker modal is identical in both contexts. **[OBSERVED mob-36 reached via People filter flow]**

### 4.7 Acceptance criteria

- AC-TF-MOB-1: Time Frame picker opens full-screen with the 5 options in the exact order above.
- AC-TF-MOB-2: "Select" button is dimmed (`rgba(255,255,255,0.45)`) when no option is selected; becomes white when a row is tapped.
- AC-TF-MOB-3: If contact already has a timeframe value, that row is pre-selected (checkmark, tinted bg) and "Select" is white on open.
- AC-TF-MOB-4: Tapping "Select" with a pending selection writes `crm_people.timeframe` and dismisses.
- AC-TF-MOB-5: Trailing area below the 5 rows uses `bg-muted` (not white) — matching the FUB `#EEF0F4` trailing fill.
- AC-TF-MOB-6: When used as a People filter picker, tapping Select applies the timeframe filter to the active People query and dismisses — no field write.

---

## 5. Assign-To Picker

**[OBSERVED — mob-34]**

The Assign-To picker extends `<BottomSheetPicker>` with: a "Currently assigned to" banner, an inline search field, and a sectioned list (Me / PONDS / GROUPS / TEAM MEMBERS). It does not use "Cancel / Title / Select" — it auto-dismisses immediately on row tap. **[OBSERVED mob-34 — no Select button visible in header; tap = instant assignment]**

### 5.1 Trigger

Person Detail → **Assigned to** field in the Details section. Also: bulk action "Assign" from People list toolbar. **[INFERRED — basis: mob-34 description; desktop §07a §5.2]**

### 5.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Header bar | 0–100 | ~100 pt (status bar + nav) | `#1B3A4A` (dark teal-navy; Ryan Realty: `#102742`) |
| "Currently:" banner | 100–136 | 36 pt | `#F2F2F7` (light gray) |
| Search bar | 136–180 | 44 pt | `#F2F2F7` (field itself white `#ffffff`) |
| Scrollable sectioned list | 180–844 | 664 pt | `#F2F2F7` (page bg); rows white/near-white |

### 5.3 Header

**[OBSERVED mob-34]**

- Background: `#102742` (navy; FUB original `#1B3A4A`)
- Left: **`Cancel`** — white, ~15 pt, regular weight — dismisses with no assignment change
- Center: **`Assign To`** — white, ~17 pt, semibold
- Right: none **[OBSERVED]**

### 5.4 "Currently: {name}" banner

**[OBSERVED mob-34]**

```
Currently: Matt Ryan
```

- Background: `#F2F2F7` (system light gray)
- Text: `Currently: {assignedBrokerName}` — `font-semibold` 600 weight, ~15 pt, `#1C1C1E` (dark charcoal)
- Left padding: 16 pt; height: 36 pt
- Full-width row, no right content, no divider above

Ryan Realty token: `text-foreground font-semibold text-[15px]` on `bg-muted`.

### 5.5 Search bar

**[OBSERVED mob-34]**

- Rounded rectangle input, white background `#ffffff`, corner-radius ~10 pt
- Leading icon: magnifying glass (`Search` from lucide-react), gray `#8E8E93`
- Placeholder: **`Search`** — gray `#8E8E93`, 16 pt regular
- Horizontal inset: 16 pt each side; height: ~36 pt
- Filters all sections (Me / ponds / groups / team members) in real time as user types **[INFERRED]**

Ryan Realty component: `<Input>` from `@/components/ui/input` with leading `Search` icon.

### 5.6 Sectioned list — complete structure

**[OBSERVED mob-34 — all rows confirmed]**

#### Unsectioned: "Me" row (first row, no section header)

| Element | Detail |
|---|---|
| Avatar | 40 pt circle, actual headshot photo (Matt Ryan) |
| Label | **`Me`** — `#1C1C1E`, 16 pt regular |
| Sublabel | none |
| Row height | ~60 pt |
| Divider | 1 pt hairline `#E5E5EA` below |
| Tap | Immediately assigns to the logged-in user and dismisses |

#### Section header: PONDS

- Text: `PONDS` — all-caps, 12 pt, `#8E8E93` gray, 500 weight, 16 pt left padding, height 28 pt
- Background: `#F2F2F7`
- Hairline dividers above and below

**[OBSERVED mob-34 — exactly 1 pond visible:]**

| Row | Avatar | Label | Sublabel | Avatar bg |
|---|---|---|---|---|
| Out Of State Home Owners | 40 pt initials circle, initials `OO` | `Out Of State Home Owners` | none | `#A07070` (brownish-mauve) |

#### Section header: GROUPS

- Same styling as PONDS section header
- Text: `GROUPS`

**[OBSERVED mob-34 — exactly 2 groups visible:]**

| Row | Initials | Label | Sublabel | Avatar bg |
|---|---|---|---|---|
| Seller Leads | `SL` | `Seller Leads` | `Round Robin` — gray `#8E8E93`, 13 pt | `#6B7C3A` (olive green) |
| Team Ryan | `TR` | `Team Ryan` | `Round Robin` — gray `#8E8E93`, 13 pt | `#C0392B` (crimson red) |

Rows with sublabel: height ~70 pt (two text lines).

#### Section header: TEAM MEMBERS

- Same styling as other section headers
- Text: `TEAM MEMBERS`

**[OBSERVED mob-34 — all 3 brokers confirmed:]**

| Row | Avatar | Label | Photo source |
|---|---|---|---|
| Matt Ryan | 40 pt headshot photo | `Matt Ryan` | `design_system/ryan-realty/assets/team/matt-ryan.png` |
| Paul Stevenson | 40 pt headshot photo | `Paul Stevenson` | `design_system/ryan-realty/assets/team/paul-stevenson.png` |
| Rebecca Peterson | 40 pt headshot photo (partially visible at bottom) | `Rebecca Peterson` | `design_system/ryan-realty/assets/team/peterson-rebecca.png` |

Row height: ~60–70 pt.

### 5.7 Component tree

```tsx
<AssignToSheet open={open} onDismiss={onDismiss} currentAssignee={currentAssignee}
               onAssign={onAssign} brokers={brokers} ponds={ponds} groups={groups}>

  {/* Header */}
  <SheetHeader bg="bg-primary">
    <Button variant="ghost" className="text-white" onClick={onDismiss}>Cancel</Button>
    <SheetTitle className="text-white font-semibold text-[17px]">Assign To</SheetTitle>
    {/* no right control */}
  </SheetHeader>

  {/* Currently banner */}
  <div className="bg-muted px-4 h-[36px] flex items-center">
    <span className="text-foreground font-semibold text-[15px]">
      Currently: {currentAssignee.fullName}
    </span>
  </div>

  {/* Search */}
  <div className="bg-muted px-4 py-2">
    <Input placeholder="Search" className="bg-white rounded-[10px]"
           value={search} onChange={e => setSearch(e.target.value)} />
  </div>

  <ScrollArea className="flex-1">

    {/* Me row */}
    <AssigneeRow avatar={<PhotoAvatar src={currentUser.photoUrl} size={40} />}
                 label="Me" onPress={() => onAssign(currentUser)} />
    <Separator />

    {/* PONDS */}
    <ListSectionHeader label="PONDS" />
    {filteredPonds.map(pond => (
      <AssigneeRow key={pond.id}
                   avatar={<InitialAvatar initials={pond.initials} bg={pond.color} size={40} />}
                   label={pond.name}
                   onPress={() => onAssign(pond)} />
    ))}

    {/* GROUPS */}
    <ListSectionHeader label="GROUPS" />
    {filteredGroups.map(group => (
      <AssigneeRow key={group.id}
                   avatar={<InitialAvatar initials={group.initials} bg={group.color} size={40} />}
                   label={group.name}
                   sublabel={group.assignmentType}
                   onPress={() => onAssign(group)} />
    ))}

    {/* TEAM MEMBERS */}
    <ListSectionHeader label="TEAM MEMBERS" />
    {filteredBrokers.map(broker => (
      <AssigneeRow key={broker.id}
                   avatar={<Avatar><AvatarImage src={broker.photoUrl} /><AvatarFallback>{broker.initials}</AvatarFallback></Avatar>}
                   label={broker.fullName}
                   onPress={() => onAssign(broker)} />
    ))}

  </ScrollArea>
</AssignToSheet>
```

### 5.8 Data model

```typescript
interface AssignTarget {
  id: string;
  type: 'user' | 'pond' | 'group';
  fullName?: string;      // for type='user'
  name?: string;          // for type='pond' | 'group'
  initials?: string;      // for pond/group initials avatars
  color?: string;         // avatar bg hex for pond/group
  photoUrl?: string;      // for type='user' brokers
  assignmentType?: string; // "Round Robin" for groups
}

// On assign:
// type='user'  → PATCH crm_people { assigned_agent_id: id }
// type='pond'  → PATCH crm_people { assigned_pond_id: id } (FUB routing fires)
// type='group' → PATCH crm_people { assigned_group_id: id } (round robin fires)
// All → crm_timeline Change Log entry
```

### 5.9 Sizing spec

| Metric | Value |
|---|---|
| Header height | 50 pt |
| Currently banner height | 36 pt |
| Search bar height | 36 pt + 8 pt padding = 44 pt zone |
| Section header height | 28 pt |
| Row height — single line | ~60 pt |
| Row height — two lines (sublabel) | ~70 pt |
| Avatar diameter | 40 pt |
| Avatar to label gap | 12 pt |
| Row left padding | 16 pt |
| Row divider | 0.5–1 pt `#E5E5EA` hairline |

### 5.10 Acceptance criteria

- AC-ASST-MOB-1: Assign-To sheet opens full-screen over the Person Detail screen when the Assigned To field is tapped.
- AC-ASST-MOB-2: "Currently: {name}" banner shows the contact's current assignee before any change.
- AC-ASST-MOB-3: Search input filters all rows (Me / ponds / groups / team members) in real time.
- AC-ASST-MOB-4: Three sections — PONDS, GROUPS, TEAM MEMBERS — render with all-caps gray section headers matching the FUB pattern.
- AC-ASST-MOB-5: Tapping any row immediately fires the assignment API call and dismisses the sheet (no "Select" button needed — tap = instant action).
- AC-ASST-MOB-6: Pond rows show a generated initials avatar (colored circle + white initials); broker rows show their headshot photo.
- AC-ASST-MOB-7: Groups with "Round Robin" assignment type show `Round Robin` as a gray 13 pt sublabel.
- AC-ASST-MOB-8: Broker photos load from `design_system/ryan-realty/assets/team/` (transparent PNG versions); fallback to `<AvatarFallback>` with initials.
- AC-ASST-MOB-9: Assignment write: `crm_people.assigned_agent_id` (for user assignment) or `crm_people.assigned_pond_id` (for pond); Change Log entry written.

---

## 6. Automations Picker

**[OBSERVED — mob-15]**

### 6.1 Trigger

Person Detail → **Automations** action / "Add to Automation" button (right rail on desktop; action button on mobile Person Detail). **[OBSERVED mob-15; desktop §07c]**

### 6.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Status bar | 0–54 | 54 pt | `#1A1A1A` (near-black) |
| Header bar | 54–98 | 44 pt | `#102742` (navy; FUB original `#2C4055`) |
| Scrollable automation list | 98–844 | 746 pt | `#ffffff` |

No bottom tab bar — modal covers full screen. **[OBSERVED]**

### 6.3 Header

**[OBSERVED mob-15]**

- Title: **`Automations`** — white, 17 pt, semibold/bold **[OBSERVED]**
- Left: **`Cancel`** — white, 17 pt, regular **[OBSERVED]**
- Right: **`Select`** — dimmed gray `#8E8E93` in screenshot (inactive state — no row yet selected) **[OBSERVED]**

**"Select" double role:** When dimmed and tapped with no selection → no-op. When a row is selected → becomes active white and tapping it confirms the selection. **[INFERRED — mob-15 build notes]**

**Multi-select mode:** Tapping "Select" when no row is pre-selected may toggle into multi-select mode where each row shows a circular checkbox and "Select" becomes a "Enroll in N plans" confirm. **[INFERRED from mob-15 analysis]**

### 6.4 Option list — all 16 automations (verbatim, alphabetical)

**[OBSERVED — mob-15 — all 16 confirmed; none selected in screenshot]**

| # | Automation name (exact) |
|---|---|
| 1 | `Assign to a lender` |
| 2 | `Birthday Email - Start by Automations` |
| 3 | `Buyer Long Term Nurture` |
| 4 | `Buyer New Lead Website Registration` |
| 5 | `Facebook Lead Ads` |
| 6 | `Open House Follow Up` |
| 7 | `Open House Leads` |
| 8 | `Past Client Saved a Home` |
| 9 | `Post Closing Plan` |
| 10 | `Seller - Home Evaluation Request` |
| 11 | `Seller Lead Drip` |
| 12 | `Stale Lead Engagement` |
| 13 | `Unconverted and active now. Call!` |
| 14 | `Unsubscribed` |
| 15 | `Web Inquiry Option 01` |
| 16 | `Web Inquiry Option 03` |

**Note: "Web Inquiry Option 02" is absent from this account** — the gap between 01 and 03 is a data fact, not a rendering artifact. **[OBSERVED mob-15]**

Row anatomy:
- Height: **50 pt**
- Content: **single-line text only** — no avatar, no icon, no badge, no secondary text, no right chevron **[OBSERVED]**
- Label: `#1C1C1E`, 17 pt, `font-normal`
- Label left padding: 16 pt
- Row divider: 1 pt `#C6C6C8` full-width (slightly darker than other pickers' `#E0E0E0`) **[OBSERVED]**

Total list height: 16 × 50 = 800 pt. Available viewport: ~746 pt. Small scroll required to reach last item. **[OBSERVED — list slightly overflows]**

### 6.5 Data

```typescript
interface Automation {
  id: string;      // FUB action plan ID
  name: string;    // display name (rendered verbatim)
}

// Fetch: GET /api/crm/action-plans → sorted alphabetically by name
// Enroll: POST /api/crm/action-plans/{id}/subscribers { personId }
// Multi-enroll: POST each in sequence or batch endpoint if available
```

### 6.6 Acceptance criteria

- AC-AUTO-MOB-1: Automations picker opens full-screen from the Add to Automation action on the mobile Person Detail.
- AC-AUTO-MOB-2: All automation names render in exact alphabetical order, verbatim (no truncation, no normalization).
- AC-AUTO-MOB-3: Row is text-only — no icon, no avatar, no secondary line.
- AC-AUTO-MOB-4: "Select" button is dimmed (`#8E8E93`) when no row is pending; becomes white `#ffffff` when a row is tapped.
- AC-AUTO-MOB-5: Tapping "Select" enrolls the contact in the selected action plan via `POST /api/crm/action-plans/{id}/subscribers`.
- AC-AUTO-MOB-6: Multi-select mode (if implemented): tapping "Select" when nothing is highlighted toggles circular checkboxes on all rows; "Select" footer button shows "Enroll in N plans".
- AC-AUTO-MOB-7: Absent automations (like "Web Inquiry Option 02") are simply not in the list — no placeholder row.

---

## 7. Filter Deals / Agent Picker

**[OBSERVED — mob-11]**

The Filter Deals modal extends the base picker pattern significantly: it adds a Deal Status segmented control above the agent picker list, making it a compound filter modal rather than a pure picker.

### 7.1 Trigger

Deals tab list → agent/filter control ("Everyone" pill or person icon) in the Deals header. **[OBSERVED mob-11]**

### 7.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Status bar | 0–54 | 54 pt | `#000000` |
| Header bar | 54–108 | 54 pt | `#102742` (FUB original `#2C4A56`) |
| Deal Status section | 108–270 | 162 pt | `#EEF1F4` (cool light blue-gray; use `bg-muted`) |
| Scope label + search | 270–370 | 100 pt | `#EEF1F4` |
| Hairline divider | 370–371 | 1 pt | `#D0D5DC` |
| Scrollable agent list | 371–750 | 379 pt | `#EEF1F4` |
| Trailing empty space | 750–844 | 94 pt | `#EEF1F4` |

### 7.3 Header

**[OBSERVED mob-11]**

- Background: `#102742` (FUB original `#2C4A56`)
- Left: **`Cancel`** — white, 17 pt, regular — dismisses with no filter change
- Center: **`Filter Deals`** — white, 17 pt, semibold
- Right: none **[OBSERVED]**

### 7.4 Deal Status segmented control

**[OBSERVED mob-11]**

```
Section heading: "Deal Status"  — 18pt bold, #2A3A4A, left 20pt, top 20pt below nav
┌─────────────────────────────────────────────────────┐
│  [ Current ]     Archived     │    All               │
│   ← selected    unselected    divider  unselected    │
└─────────────────────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Section label text | `Deal Status` |
| Section label style | 18 pt, 700 weight, `#2A3A4A` (dark navy-gray) |
| Container background | `#E2E5EA` (light gray pill) |
| Container border-radius | 12 pt (pill) |
| Container height | 40 pt |
| Container horizontal margin | 16 pt from content padding |
| Selected segment ("Current") | White `#FFFFFF` inset pill, text `#0D0D0D` 15 pt 600 weight |
| Unselected segments | No background, text `#7A8A9A` 15 pt 400 weight |
| Divider between segments | 1 pt vertical `#C8CDD4` (only between "Archived" and "All" — not between "Current" and "Archived") **[OBSERVED]** |
| Tap segment | Immediately filters Deals by that status; label below updates |

Ryan Realty component: `<Tabs>` from `@/components/ui/tabs` styled as pill segmented control.

### 7.5 "Showing deals for:" label + search

**[OBSERVED mob-11]**

```
Showing deals for: Everyone
[🔍 Search                        ]
```

- Label: `Showing deals for: {agentName}` — 18 pt bold/700, `#2A3A4A`, left 20 pt — updates dynamically on agent tap **[OBSERVED]**
- Search field: placeholder `Search`, gray `#9AABB8`, leading magnify icon; no border/card (inline, bare, `bg-transparent`)
- Below label: `<Input>` from `@/components/ui/input`, transparent background, placeholder color `text-muted-foreground`

### 7.6 Scrollable agent list

**[OBSERVED mob-11 — all 5 rows confirmed]**

Row anatomy:
- Height: **80 pt**
- Avatar: **48 pt** circle (larger than other pickers' 40 pt)
- Avatar left margin: **20 pt**
- Label: agent name, 18 pt regular, `#3A4A5C`
- Label left offset: 20 + 48 + 14 = **82 pt** from left screen edge
- No right chevron, no checkmark
- Row divider: 1 pt `#D0D5DC` full-bleed

**Row 1 — Everyone**

| Element | Value |
|---|---|
| Avatar | 48 pt solid circle, dark forest/olive green `#3D6148`, letter `E` white 22 pt bold — generated initial avatar |
| Label | `Everyone` |
| Tap | Sets filter to "everyone" scope; updates "Showing deals for: Everyone"; dismisses |

**Row 2 — Me**

| Element | Value |
|---|---|
| Avatar | 48 pt headshot photo of Matt Ryan |
| Label | `Me` |
| Tap | Sets filter to "me" scope; updates label; dismisses |

**Section header — TEAM MEMBERS**

- Text: `TEAM MEMBERS` — all-caps, 12 pt, 600 weight, `#8A9BB0` muted blue-gray, left 20 pt
- Background: `#EEF1F4` (same as page bg, not distinct)
- 1 pt divider below **[OBSERVED]**

**Row 3 — Matt Ryan**

| Avatar | Headshot photo of Matt Ryan (48 pt) | Label | `Matt Ryan` |

**Row 4 — Paul Stevenson**

| Avatar | Headshot photo, flat-brim cap, glasses (48 pt) | Label | `Paul Stevenson` |

**Row 5 — Rebecca Peterson**

| Avatar | Headshot photo, dark wavy hair (48 pt) | Label | `Rebecca Peterson` |

### 7.7 Component tree

```tsx
<FilterDealsModal open={open} onDismiss={onDismiss}
                  dealStatus={dealStatus} onDealStatusChange={setDealStatus}
                  selectedAgent={selectedAgent} onAgentSelect={handleAgentSelect}>

  <TopBar bg="bg-primary">
    <Button variant="ghost" className="text-white" onClick={onDismiss}>Cancel</Button>
    <span className="text-white font-semibold text-[17px]">Filter Deals</span>
  </TopBar>

  <ScrollView className="bg-muted">

    {/* Deal Status section */}
    <div className="px-5 pt-5 pb-5">
      <h3 className="text-[18px] font-bold text-[#2A3A4A] mb-3">Deal Status</h3>
      <Tabs value={dealStatus} onValueChange={setDealStatus}
            className="bg-[#E2E5EA] rounded-xl p-1 h-[40px]">
        <TabsList className="w-full">
          <TabsTrigger value="current"   className="flex-1 text-[15px]">Current</TabsTrigger>
          <TabsTrigger value="archived"  className="flex-1 text-[15px]">Archived</TabsTrigger>
          <TabsTrigger value="all"       className="flex-1 text-[15px]">All</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    {/* Agent scope + search */}
    <div className="px-5 pb-3">
      <h3 className="text-[18px] font-bold text-[#2A3A4A] mb-3">
        Showing deals for: {selectedAgentName}
      </h3>
      <Input placeholder="Search" className="bg-transparent border-none shadow-none"
             value={agentSearch} onChange={e => setAgentSearch(e.target.value)} />
    </div>

    <Separator className="bg-[#D0D5DC]" />

    {/* Everyone */}
    <AgentRow avatar={<InitialAvatar letter="E" bg="#3D6148" size={48} fontSize={22} />}
              label="Everyone" onPress={() => handleAgentSelect('everyone')} />
    <AgentRow avatar={<PhotoAvatar src={currentUser.photoUrl} size={48} />}
              label="Me" onPress={() => handleAgentSelect('me')} />

    <TeamMembersSectionHeader />

    {filteredBrokers.map(broker => (
      <AgentRow key={broker.id}
                avatar={<Avatar><AvatarImage src={broker.photoUrl} /><AvatarFallback>{broker.initials}</AvatarFallback></Avatar>}
                label={broker.fullName}
                onPress={() => handleAgentSelect(broker.id)} />
    ))}

  </ScrollView>
</FilterDealsModal>
```

### 7.8 Data bindings

```typescript
dealStatus: 'current' | 'archived' | 'all'
  → maps to Deals API `?status=` param

selectedAgentId: 'everyone' | 'me' | string (broker id)
  → maps to Deals API `?assignedUserId=` param

selectedAgentName: string
  → display value in "Showing deals for: {name}" label

agentSearch: string
  → client-side filter on broker rows by fullName
```

### 7.9 Acceptance criteria

- AC-FLT-MOB-1: Filter Deals modal opens full-screen from the Deals tab filter control.
- AC-FLT-MOB-2: Segmented control shows three options: Current / Archived / All. "Current" is selected by default.
- AC-FLT-MOB-3: Tapping any segment immediately updates the Deals list status filter; modal remains open.
- AC-FLT-MOB-4: "Showing deals for: {name}" label updates dynamically when an agent row is tapped.
- AC-FLT-MOB-5: Search field filters the agent rows in real time by name.
- AC-FLT-MOB-6: "Everyone" row uses a dark green `#3D6148` initial avatar with white `E`.
- AC-FLT-MOB-7: Broker rows use 48 pt headshot photos (larger than other picker avatars).
- AC-FLT-MOB-8: Tapping any agent row applies the agent filter, updates the label, and dismisses the modal.
- AC-FLT-MOB-9: Tapping "Cancel" dismisses with no filter change.
- AC-FLT-MOB-10: The `TEAM MEMBERS` section header is all-caps, 12 pt, `text-muted-foreground`.

---

## 8. Settings Modal

**[OBSERVED — mob-06]**

The Settings modal is a full-screen grouped settings page — distinct from the picker pattern. It uses a "Close" dismiss button (not "Cancel"), no list selection, and a grouped card layout with section gaps.

### 8.1 Trigger

User avatar / profile icon from any primary tab → **Settings** modal slides up full-screen. **[OBSERVED mob-06]**

### 8.2 Screen layout (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Status bar | 0–44 | 44 pt | `#102742` (FUB original `#3A4A58`) |
| Header bar | 44–94 | 50 pt | `#102742` |
| Profile card | 94–170 | 76 pt | `#ffffff` |
| Section gap | 170–186 | 16 pt | `#EEF0F3` (use `bg-muted`) |
| Feature settings section | 186–490 | 304 pt | `#ffffff` |
| Section gap | 490–506 | 16 pt | `bg-muted` |
| Support / links section | 506–760 | 254 pt | `#ffffff` |
| Bottom safe-area | 760–844 | 84 pt | `bg-muted` |

### 8.3 Header

**[OBSERVED mob-06]**

- Background: `#102742` (FUB original `#3A4A58`)
- Left: **`Close`** — white, 17 pt, regular — tap dismisses the Settings modal (slide-down animation) **[OBSERVED — label is "Close" not "Cancel"]**
- Center: **`Settings`** — white, 17 pt, semibold **[OBSERVED]**
- Right: none **[OBSERVED]**

### 8.4 Profile card (y 94–170 pt)

**[OBSERVED mob-06]**

```
[ avatar 52pt ] Matt Ryan
                Admin
```

| Element | Detail |
|---|---|
| Avatar | 52 pt circle, 1 pt border `#E5E7EA`, actual headshot photo of Matt Ryan |
| Primary text | `Matt Ryan` — 17 pt, 600 weight, `#1A2B3C` (dark navy) |
| Secondary text | `Admin` — 14 pt, 400 weight, `#8A95A0` (medium gray) |
| Row height | ~76 pt |
| Left padding | 16 pt |
| Background | `#ffffff` |
| Tap | Navigate to account/profile edit screen **[INFERRED]** |

Ryan Realty: `<Avatar>` from `@/components/ui/avatar`; name `text-foreground font-semibold text-[17px]`; role `text-muted-foreground text-[14px]`.

### 8.5 Feature settings section (5 rows)

**[OBSERVED mob-06 — all 5 rows confirmed]**

Row pattern (rows 1–4): `iconCircle(36pt) + primaryLabel + secondaryLabel + rightControl`
- Row left padding: 16 pt
- Icon circle to label gap: 12 pt
- Row divider: 1 pt `#E5E7EA`, inset ~64 pt from left (starts after icon+gap)
- Row height: ~64 pt

#### Row 1 — App version

| Element | Value |
|---|---|
| Icon circle bg | Orange `#F5943C` |
| Icon glyph | White smartphone outline (mobile phone icon) |
| Primary text | `Your app is up to date` — `#1A2B3C`, 16 pt, **semibold** |
| Secondary text | `Currently using version 6.06.0100 (271)` — `#8A95A0`, 13 pt, regular |
| Right control | none |
| Tappable | No (informational) |

Ryan Realty adaptation: replace FUB version string with web app version from `package.json`. Replace "Your app is up to date" with the equivalent web app update check status.

#### Row 2 — Push notifications

| Element | Value |
|---|---|
| Icon circle bg | Purple `#9B59B6` |
| Icon glyph | White speech-bubble notification icon |
| Primary text | `Push notifications` — `#1A2B3C`, 16 pt, semibold |
| Secondary text | `Get notified of new leads and texts` — `#8A95A0`, 13 pt, regular |
| Right control | Text `Enabled` — `#8A95A0`, 15 pt, regular |
| Tappable | Yes → opens browser notification permission flow or OS Settings **[INFERRED]** |

#### Row 3 — Zillow lead alerts (**[INFERRED: omit or replace in Ryan Realty CRM]**)

**[OBSERVED mob-06]** — FUB-specific feature. In the Ryan Realty in-house CRM, replace with a relevant integration toggle (e.g., "Realtor.com lead alerts", "Zillow bridge alerts", or remove entirely if not applicable).

| FUB element | Value | Ryan Realty replacement |
|---|---|---|
| Icon circle bg | Blue `#2B7CD3` | Blue `#2B7CD3` or `bg-primary` |
| Icon glyph | Zillow Z logomark | Relevant integration icon |
| Primary text | `Zillow lead alerts` | `Lead source alerts` or similar |
| Secondary text | `Allow time-sensitive Zillow lead alerts` | Per integration |
| Right | `Enabled` text | `<Switch>` toggle from `@/components/ui/switch` |

#### Row 4 — Caller ID

| Element | Value |
|---|---|
| Icon circle bg | Green `#27AE60` |
| Icon glyph | White classic phone handset icon |
| Primary text | `Caller ID` — `#1A2B3C`, 16 pt, semibold |
| Secondary text | `Show name on incoming calls` — `#8A95A0`, 13 pt, regular |
| Right control | Text `Enabled` — `#8A95A0`, 15 pt, regular |
| Tappable | Yes → browser contact permission or OS deep-link **[INFERRED]** |

Ryan Realty adaptation: "Show name on incoming calls" relates to Twilio Caller ID registration. Keep as-is; wire to the Twilio caller-ID setting.

#### Row 5 — Always text in app (toggle row)

**[OBSERVED mob-06 — the one toggle visible]**

| Element | Value |
|---|---|
| Icon | **None** — no icon circle on this row **[OBSERVED]** |
| Left padding | 16 pt (flush left, no icon offset) |
| Primary text | `Always text in app` — `#1A2B3C`, 16 pt, semibold |
| Secondary text | `Send all texts via Follow Up Boss` — `#8A95A0`, 13 pt, regular |
| Right control | **iOS UISwitch toggle** — state: **ON** — green track `#34C759`, white thumb on right side |
| Tappable | Toggle flips ON/OFF — controls whether SMS routes through the in-app SMS composer vs. device native Messages |

Ryan Realty adaptation: Replace "Follow Up Boss" in subtitle with "Ryan Realty CRM". Use `<Switch>` from `@/components/ui/switch` with `checked={alwaysTextInApp}` and `onCheckedChange={setAlwaysTextInApp}`. Green ON state color: `#34C759` (iOS system green / Tailwind `green-500`).

### 8.6 Support / links section (5 rows)

**[OBSERVED mob-06 — all 5 rows confirmed]**

Row pattern (link rows): `primaryLabel + rightControl(chevron or email link)`
- Row height: ~52 pt
- No icon circles
- Row left padding: 16 pt
- Row divider: 1 pt `#E5E7EA`

#### Row 1 — Report a bug

| Element | Value |
|---|---|
| Primary text | `Report a bug` — `#1A2B3C`, 16 pt, regular |
| Right control | Chevron `›` — gray `#C7C9CC`, 14 pt |
| Tap | Opens in-app feedback form or email compose to bug report address **[INFERRED]** |

#### Row 2 — Support

| Element | Value |
|---|---|
| Primary text | `Support` — `#1A2B3C`, 16 pt, regular |
| Right value | `support@followupboss.com` — `#3B7FC4` link blue, 13 pt, right-aligned |
| Right control | No chevron |
| Tap | `mailto:support@followupboss.com` **[INFERRED]** |

Ryan Realty: replace email with `matt@ryan-realty.com` or a Ryan Realty support contact.

#### Row 3 — Feedback

| Element | Value |
|---|---|
| Primary text | `Feedback` — `#1A2B3C`, 16 pt, regular |
| Right value | `product@followupboss.com` — `#3B7FC4` link blue, 13 pt, right-aligned |
| Tap | `mailto:product@followupboss.com` **[INFERRED]** |

Ryan Realty: replace with Ryan Realty feedback email.

#### Row 4 — Acknowledgements

| Element | Value |
|---|---|
| Primary text | `Acknowledgements` — `#1A2B3C`, 16 pt, regular |
| Right control | Chevron `›` — gray `#C7C9CC`, 14 pt |
| Tap | Pushes open-source licence list **[INFERRED]** |

#### Row 5 — Community

| Element | Value |
|---|---|
| Primary text | `Community` — `#1A2B3C`, 16 pt, regular |
| Right control | Chevron `›` — gray `#C7C9CC`, 14 pt |
| Tap | Opens FUB Community URL in browser **[INFERRED]** |

Ryan Realty: replace with Ryan Realty community / help channel link.

### 8.7 Component tree

```tsx
<SettingsModal open={open} onClose={onClose}>

  <Sheet side="bottom" /* or full-screen Dialog */>

    {/* Top bar — sticky */}
    <div className="flex items-center justify-between h-[50px] px-4 bg-primary flex-shrink-0">
      <Button variant="ghost" className="text-white text-[17px] font-normal" onClick={onClose}>
        Close
      </Button>
      <span className="text-white text-[17px] font-semibold">Settings</span>
      <div className="w-[60px]" /> {/* spacer to center title */}
    </div>

    <ScrollArea className="flex-1">

      {/* Profile card */}
      <div className="bg-white">
        <button className="flex items-center gap-3 w-full px-4 py-4 h-[76px]"
                onClick={navigateToProfileEdit}>
          <Avatar className="h-[52px] w-[52px] border border-border">
            <AvatarImage src={user.photoUrl} />
            <AvatarFallback className="bg-primary text-white">{user.initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[17px] font-semibold text-foreground">{user.fullName}</p>
            <p className="text-[14px] text-muted-foreground">{user.role}</p>
          </div>
        </button>
      </div>

      <div className="h-[16px] bg-muted" />

      {/* Feature settings */}
      <div className="bg-white">
        <SettingsIconRow iconBg="#F5943C" iconGlyph={<Smartphone className="text-white w-5 h-5" />}
          label="Your app is up to date" subtitle={`Version ${appVersion}`} />
        <Separator />
        <SettingsIconRow iconBg="#9B59B6" iconGlyph={<Bell className="text-white w-5 h-5" />}
          label="Push notifications" subtitle="Get notified of new leads and texts"
          rightControl={<span className="text-muted-foreground text-[15px]">Enabled</span>}
          onPress={openPushSettings} />
        <Separator />
        {/* Zillow row → adapt to Ryan Realty integration */}
        <SettingsIconRow iconBg="#2B7CD3" iconGlyph={<Zap className="text-white w-5 h-5" />}
          label="Lead source alerts" subtitle="Allow time-sensitive new lead alerts"
          rightControl={<span className="text-muted-foreground text-[15px]">Enabled</span>}
          onPress={openLeadAlertSettings} />
        <Separator />
        <SettingsIconRow iconBg="#27AE60" iconGlyph={<Phone className="text-white w-5 h-5" />}
          label="Caller ID" subtitle="Show name on incoming calls"
          rightControl={<span className="text-muted-foreground text-[15px]">Enabled</span>}
          onPress={openCallerIdSettings} />
        <Separator />
        {/* Toggle row — no icon */}
        <div className="flex items-center justify-between px-4 py-4 min-h-[64px]">
          <div>
            <p className="text-[16px] font-semibold text-foreground">Always text in app</p>
            <p className="text-[13px] text-muted-foreground">Send all texts via Ryan Realty CRM</p>
          </div>
          <Switch checked={alwaysTextInApp} onCheckedChange={setAlwaysTextInApp}
                  className="data-[state=checked]:bg-[#34C759]" />
        </div>
      </div>

      <div className="h-[16px] bg-muted" />

      {/* Support links */}
      <div className="bg-white">
        <SettingsLinkRow label="Report a bug" onPress={openBugReport} />
        <Separator />
        <SettingsEmailRow label="Support" email="matt@ryan-realty.com" />
        <Separator />
        <SettingsEmailRow label="Feedback" email="feedback@ryan-realty.com" />
        <Separator />
        <SettingsLinkRow label="Acknowledgements" onPress={openAcknowledgements} />
        <Separator />
        <SettingsLinkRow label="Community" onPress={openCommunityUrl} />
      </div>

      <div className="h-[84px] bg-muted" /> {/* bottom safe area */}

    </ScrollArea>
  </Sheet>

</SettingsModal>
```

### 8.8 Sizing spec

| Metric | Value |
|---|---|
| Header height | 50 pt |
| Profile row height | 76 pt |
| Avatar diameter | 52 pt |
| Avatar border | 1 pt `#E5E7EA` |
| Feature row height | ~64 pt |
| Support row height | ~52 pt |
| Icon circle diameter | 36 pt |
| Icon circle to label gap | 12 pt |
| Row left padding | 16 pt |
| Section gap height | 16 pt |
| Row divider | 1 pt `#E5E7EA` (from `<Separator>`) |
| Toggle (Switch) width | ~51 pt (Radix `<Switch>`) |
| Chevron | Lucide `ChevronRight`, gray `#C7C9CC`, 14 pt |
| Link email color | `#3B7FC4` → Ryan Realty: `text-primary underline` |

### 8.9 Data bindings

| Component | Binds to |
|---|---|
| Profile card | `currentUser.fullName`, `currentUser.role`, `currentUser.photoUrl` |
| Version row | `appInfo.version` from `package.json` |
| Push notifications status | `notificationPermission.status` |
| Caller ID | `userSettings.callerIdEnabled` |
| Always text in app | `userSettings.alwaysTextInApp` bool; mutated via `PATCH /api/crm/users/settings` |

### 8.10 Acceptance criteria

- AC-SET-MOB-1: Settings modal opens full-screen with a "Close" button (not "Cancel") in the header.
- AC-SET-MOB-2: Profile card shows the logged-in broker's headshot photo (52 pt circle), full name, and role ("Admin" / "Broker" per `crm_users.role`).
- AC-SET-MOB-3: Feature section shows 5 rows in the exact order: app version (non-tappable) / push notifications / lead alerts / caller ID / always text in app toggle.
- AC-SET-MOB-4: "Always text in app" toggle uses `<Switch>` from `@/components/ui/switch`; ON state is `#34C759`; flips write `userSettings.alwaysTextInApp` via API.
- AC-SET-MOB-5: Support section shows 5 rows in order: report a bug / support email / feedback email / acknowledgements / community — each with appropriate right control (chevron or tappable email link).
- AC-SET-MOB-6: FUB-specific copy replaced: "Follow Up Boss" → "Ryan Realty CRM"; support/feedback emails → Ryan Realty addresses.
- AC-SET-MOB-7: Section gaps (16 pt height, `bg-muted`) separate the three visual groups (profile / feature settings / support links).
- AC-SET-MOB-8: Tapping "Close" dismisses the modal with a slide-down animation.
- AC-SET-MOB-9: Chevron rows (`Report a bug`, `Acknowledgements`, `Community`) show `ChevronRight` icon in gray `#C7C9CC`.
- AC-SET-MOB-10: No tab bar is visible behind the modal.

---

## 9. Design System Token Mapping — FUB → Ryan Realty

| FUB element | FUB hex/style | Ryan Realty token | Ryan Realty hex |
|---|---|---|---|
| Modal header background | `#3d5060` / `#2C4055` / `#1B3A4A` (varies) | `bg-primary` | `#102742` |
| Header text / controls | `#ffffff` | `text-white` | `#ffffff` |
| List row background (unselected) | `#ffffff` | `bg-white` | `#ffffff` |
| List row background (selected) | `#EEF2FF` / `#f2f6ff` | `bg-[#f2f6ff]` | `#f2f6ff` |
| Row label text | `#2d3e50` / `#1C1C1E` | `text-foreground` | `#1c1c1e` |
| Row divider | `#e0e0e2` / `#E5E7EB` / `#C6C6C8` | `border-border` | `#e5e7eb` |
| Checkmark / selection accent | `#2d7ff9` / `#007AFF` / FUB teal | `text-primary` | `#102742` |
| "Select" dimmed state | `rgba(255,255,255,0.45)` | same | `rgba(255,255,255,0.45)` |
| Page / muted area background | `#EEF0F3` / `#F2F2F7` / `#EEF1F4` | `bg-muted` | `#f1f0ed` (RR cream variant) |
| Section header text (PONDS / TEAM MEMBERS) | `#8E8E93` / `#8A9BB0` | `text-muted-foreground` | `#8a8a8a` |
| Primary text (Settings rows) | `#1A2B3C` | `text-foreground` | `#1c1c1e` |
| Secondary text (Settings subtitles) | `#8A95A0` | `text-muted-foreground` | `#8a8a8a` |
| Link/email text | `#3B7FC4` | `text-primary underline` | `#102742` |
| Toggle ON color | `#34C759` (iOS green) | keep as-is for system match | `#34C759` |
| Avatar initials background (broker) | navy `#102742` in-house | `bg-primary` | `#102742` |

**Font substitution:** All FUB native screens use SF Pro (iOS system font). Web rebuild uses Geist (loaded via `next/font/geist`, applied via `--font-sans`). `font-size` values translate 1:1 (17 pt iOS → 17 px web). For picker titles and section headers that warrant display treatment, `font-display` (Amboqia Boriango) is NOT used — these are UI chrome strings, not display/hero copy; Geist 600 is correct.

---

## 10. Cross-References

- **§23 — Mobile Shell & Navigation:** Bottom tab bar is hidden behind all pickers and the Settings modal. The `<BottomSheetPicker>` renders in a portal above the tab bar (`z-index: 9999`).
- **§24 — People List:** Stage picker and Source picker are also used as filter controls from the People list filter flow (same component, different `onSelect` handler — writes to filter state vs. field value).
- **§25 — Person Detail (Mobile):** Stage, Source, Timeframe, Assigned To, and Automations pickers all originate from the Person Detail field taps on mobile.
- **§26 — Deals (Mobile):** Filter Deals modal (§7 above) is triggered from the Deals list header; the Deal Status segmented control is unique to this modal.
- **§27 — Mobile Compose:** No picker modals in the compose flow itself; pickers are field-edit affordances only.
- **Desktop §07a:** Confirms the full 16-stage list, 5-timeframe enum, Assigned-to dropdown structure (Me / PONDS / GROUPS / TEAM MEMBERS), and Source autocomplete. Mobile pickers replicate this data with a full-screen sheet instead of inline dropdown.
- **Desktop §14:** Confirms the stage list comes from `crm_stages` (admin-configurable; system stages Lead/Closed/Trash are immutable). Automation names come from the Action Plans admin tab.

---

## Sources

| Source | Type | Usage |
|---|---|---|
| `mob-35` | **[OBSERVED]** screenshot | Stage picker — complete 16-option list; "Lead" pre-selected; header spec; row anatomy; scroll indicator |
| `mob-54` | **[OBSERVED]** screenshot | Source picker — partial list (17 rows visible); "Import" pre-selected; row height 56–60 pt; duplicate entries |
| `mob-36` | **[OBSERVED]** screenshot | Time Frame picker — all 5 options confirmed; "Select" dimmed when nothing selected; trailing empty area |
| `mob-34` | **[OBSERVED]** screenshot | Assign-To picker — "Currently: Matt Ryan" banner; search bar; Me / PONDS (Out Of State Home Owners) / GROUPS (Seller Leads Round Robin, Team Ryan Round Robin) / TEAM MEMBERS (Matt Ryan, Paul Stevenson, Rebecca Peterson) |
| `mob-15` | **[OBSERVED]** screenshot | Automations picker — 16 automation names verbatim; text-only rows; "Select" dimmed; note on absent "Web Inquiry Option 02" |
| `mob-11` | **[OBSERVED]** screenshot | Filter Deals modal — Deal Status segmented control (Current/Archived/All); "Showing deals for: Everyone"; search; agent rows (Everyone, Me, TEAM MEMBERS section, Matt Ryan, Paul Stevenson, Rebecca Peterson) |
| `mob-06` | **[OBSERVED]** screenshot | Settings modal — "Close" header (not Cancel); profile card (Matt Ryan / Admin / 52 pt avatar); 5 feature rows with icon circles and toggle; 5 support rows with chevrons/emails; app version "6.06.0100 (271)" |
| `07a-person-detail-sidebar-and-inline-edit.md` | **[BASIS for INFERRED]** desktop spec | Field triggers: Stage (§5.1), Assigned to (§5.2), Source (§5.3), Timeframe (§5.5); data model; desktop inline edit pattern adapted to mobile sheet |
| `14-admin-config-stages-tags-fields-leadflow.md` | **[BASIS for INFERRED]** desktop spec | Stage list sourced from `crm_stages`; Automation plans sourced from `crm_action_plans`; admin token mapping |

**Inferred screens / behaviors:**
- Picker trigger mechanism (tapping a Person Detail field to open the sheet) — inferred from desktop §07a §12 (inline edit pattern) + standard mobile CRM UX convention.
- Automations multi-select mode — inferred from mob-15 build notes analysis of the dimmed "Select" button.
- Assign-To auto-dismiss-on-tap (vs. Select button) — inferred from mob-34 (no Select button visible in header).
- Filter Deals modal auto-dismiss on agent row tap — inferred from mob-11 interaction analysis.
- Settings modal sub-screens (profile edit, push settings, acknowledgements, community URL) — inferred from standard iOS Settings UX pattern + mob-06 analysis.

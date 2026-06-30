<!-- Mobile per-screen appendix. Original: IMG_6002.PNG | id: mob-36 | tiles: mob-tiles/mob-36_{full,t,m,b}.png -->

# mob-36 — fub-ios — Time Frame Picker (single-select modal)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iOS app)
- **module:** Picker / Modal / Action sheet
- **screen:** "Time frame" single-select picker — a full-screen modal sheet presented over a People/Contacts filter flow. Used to filter contacts/leads by their stated buying or selling time horizon.
- **how to reach:** People tab → filter icon (or Smart List filter) → tap "Time frame" filter chip → this modal pushes up.
- **iOS status bar:** 8:45 · 2/4 signal bars · WiFi · battery 36% — white glyphs on solid black background.
- **URL bar:** N/A (native iOS app, not web).

---

## Screen regions (top → bottom, ~390×844 pt logical)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0 – 44 | 44 pt | #000000 (solid black) |
| Modal nav bar | 44 – 100 | ~56 pt | #3D5166 (dark teal-slate — FUB header) |
| Option list (scrollable) | 100 – ~440 | ~340 pt | #FFFFFF |
| Empty / trailing area | ~440 – 844 | ~404 pt | #EEF0F4 (very light blue-gray) |
| Right-edge collapse handle | overlaid right edge ~y 300–420 | — | #8A8E96 rounded pill, ~18×60 pt |

No bottom tab bar visible — this modal covers it entirely.

---

## Nav / header bar (exact)

- **Background:** #3D5166 (dark desaturated teal, FUB's canonical modal header color). Slight rounded top corners (card sheet presentation).
- **Left control:** Text label "Cancel" — white (#FFFFFF), ~17 pt regular weight, left-aligned with ~16 pt leading inset. Tap → dismisses modal with no selection change.
- **Center title:** "Time frame" — white (#FFFFFF), ~17 pt semibold/medium, centered horizontally.
- **Right control:** Text label "Select" — appears in a muted/dimmer white (~#8BABB8 or rgba(255,255,255,0.45)), ~17 pt regular. Dimmed state = no option currently highlighted/selected. Tap when an option is selected → commits the selection and dismisses.

> Pattern: Cancel / Title / Select is the standard FUB full-screen picker chrome. "Select" remains muted until the user taps a row.

---

## Bottom tab bar

**Not visible** — modal sheet covers the entire screen including the tab bar. There is no FAB visible either.

---

## Content — every element, in order

### Option list (white background, full width)

Each row is a plain text list item:
- **Height per row:** ~56 pt
- **Text:** dark charcoal (#2C3E50 or ~#333D47), ~17 pt regular weight, left-aligned, 16 pt leading inset.
- **Dividers:** 1 px (hairline) light gray (#E0E0E0) bottom-border on each row, full width (no insets).
- **No checkmark or selection indicator visible** — none of the 5 options is pre-selected in this screenshot.
- **Tap behavior:** tapping a row (INFERRED) highlights it with a selection indicator (checkmark on right or row highlight) and activates the "Select" button.
- **No swipe actions.**
- **No section headers.**

Rows in order (exact text verbatim):

| # | Label |
|---|---|
| 1 | 0-3 Months |
| 2 | 3-6 Months |
| 3 | 6-12 Months |
| 4 | 12+ Months |
| 5 | No Plans |

### Empty trailing area

Below "No Plans" (~y 440 to bottom): solid light blue-gray (#EEF0F4). No content, no footer, no additional controls. This space exists because the list has only 5 items and does not fill the screen height.

### Right-edge collapse handle

A rounded-rectangle gray pill (~#8A8E96, ~18 pt wide × 60 pt tall, fully rounded ends) appears flush against the right edge of the screen, vertically centered around the list rows (~y 340–400 pt). This is the FUB sliding-panel collapse affordance — it belongs to the underlying parent view bleeding through, not to this modal itself. The "<" chevron is rendered inside the pill in white. [INFERRED: tapping it collapses a side drawer or filter panel behind the modal.]

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | #3D5166 (FUB dark teal-slate) |
| Header text (active) | #FFFFFF |
| Header "Select" (inactive) | rgba(255,255,255,0.45) — muted white |
| Row text | #333D47 (near-black charcoal) |
| Row divider | #E0E0E0 (1 px hairline) |
| List background | #FFFFFF |
| Trailing empty area | #EEF0F4 (cool light gray-blue) |
| Status bar | #000000 background, white glyphs |
| Collapse handle pill | #8A8E96 |

**Typography:**
- Nav title: SF Pro Display or SF Pro Text, ~17 pt, medium/semibold, white.
- Nav actions (Cancel / Select): SF Pro Text, ~17 pt, regular, white / muted white.
- Row labels: SF Pro Text, ~17 pt, regular, #333D47.

**Accent color:** #3D5166 (FUB's teal-navy — NOT the in-house navy #102742 or cream #faf8f4). Confirms fub-ios.

**Icons:** Only a "<" chevron inside the right-edge collapse handle. No icons in list rows.

---

## Interactions & gestures

| Interaction | Behavior |
|---|---|
| Tap "Cancel" | Dismisses modal, no filter applied [CONFIRMED from label] |
| Tap "Select" (when active) | Commits chosen option, applies filter, dismisses modal [INFERRED] |
| Tap any row | Selects that option; row gains a checkmark on the right; "Select" button activates to full white [INFERRED] |
| Tap "Select" (dimmed — no selection) | No-op / does nothing [INFERRED] |
| Swipe down on modal | Dismisses modal (iOS modal swipe-to-dismiss) [INFERRED] |
| Scroll list | Only 5 items fit without scrolling; list is not scrollable in practice here [INFERRED] |
| Tap right-edge pill "<" | Collapses/closes a side panel behind this modal [INFERRED — belongs to parent] |

---

## Build notes (component tree)

This is a **full-screen single-select picker modal** in the web CRM. Recommended implementation:

```
<PickerModal
  open={boolean}
  onClose={() => void}           // Cancel button
  onSelect={(value: string) => void}  // Select button
  title="Time frame"
>
  <PickerOptionList
    options={[
      { label: "0-3 Months",  value: "0_3_months" },
      { label: "3-6 Months",  value: "3_6_months" },
      { label: "6-12 Months", value: "6_12_months" },
      { label: "12+ Months",  value: "12_plus_months" },
      { label: "No Plans",    value: "no_plans" },
    ]}
    selected={currentValue}
    onChange={(value) => setCurrentValue(value)}
  />
</PickerModal>
```

### Component breakdown

**PickerModal wrapper**
- Renders as a bottom-sheet or full-screen modal on mobile (Radix `<Dialog>` with custom sheet animation, or `<Sheet>` from `@/components/ui/sheet`).
- Background: white for list area, #EEF0F4 for any trailing empty space.
- On desktop: centered dialog ~390 pt wide.

**PickerModalHeader** (sticky top)
- Background: #3D5166.
- Three-column flex row, height 56 pt.
- Left: `<Button variant="ghost" className="text-white text-[17px] font-normal">Cancel</Button>` — tap calls `onClose()`.
- Center: `<span className="text-white text-[17px] font-medium">Time frame</span>`.
- Right: `<Button variant="ghost" className="text-[17px] font-normal" disabled={!selected} style={{color: selected ? '#fff' : 'rgba(255,255,255,0.45)'}}>Select</Button>` — tap calls `onSelect(selected)`.

**PickerOptionList**
- `<ul>` with no padding.
- Each row: `<li>` — full-width tap target, height 56 pt, 16 pt left padding.
- Label text: 17 pt, `font-normal`, `text-[#333D47]`.
- Bottom border: `border-b border-[#E0E0E0]` (1 px hairline), no insets.
- Selected row: adds a checkmark icon on the right (SF-style checkmark, FUB teal #3D5166 or accent color) — NOT visible here since no row is selected yet.
- Tap → sets `selected` state, re-renders right control to active white.

**Data binding:**
- `options` array is static for this picker — the five time-frame values are a fixed enum in FUB's lead profile model.
- `currentValue` comes from the active filter state (e.g., a URL param, a smart-list filter object, or a contact field value).
- On confirm, the value is written to `contact.timeframe` or the active People filter query.

**Spacing:**
- Row height: 56 pt (44 pt touch target + 12 pt breathing room — matches iOS Human Interface Guidelines minimums).
- Left inset for text: 16 pt.
- No right inset unless a checkmark is shown (then 16 pt from right edge).
- Header padding: 0 pt top (status bar handled by safe-area-inset-top), 16 pt horizontal.

**Accessibility:**
- Each row: `role="radio"`, `aria-checked` reflects selected state.
- List: `role="radiogroup"`, `aria-label="Time frame"`.
- Header buttons: `aria-label="Cancel"` / `aria-label="Select time frame"`.

<!-- Mobile per-screen appendix. Original: IMG_6024.PNG | id: mob-54 | tiles: mob-tiles/mob-54_{full,t,m,b}.png -->

# mob-54 — fub-ios — Source Picker (Lead Source Filter Modal)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iPhone app)
- **module:** Picker / Modal / Action sheet
- **screen:** Source picker — a full-screen modal for selecting a lead source filter; presented over the People / Contacts list (or a contact edit form) when the user taps a "Source" filter control
- **how to reach:** People tab → filter controls (or edit a contact's Source field) → tap "Source" → this modal slides up full-screen
- **iOS status bar:** 7:44 · 2 of 4 cell bars · WiFi · battery 16% (yellow low-battery indicator)
- **URL bar:** none — native iOS app, no Safari chrome

---

## Screen regions (top → bottom, y-bands on 390×844pt logical screen)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | ~54pt | Black `#000000` |
| Modal nav/header bar | 54–110 | ~56pt | Dark teal-slate `#2E4A58` (FUB brand dark header) |
| Scrollable picker list | 110–844 | ~734pt | White `#FFFFFF` |
| Bottom tab bar | not visible | — | Covered by modal / not applicable |

No FAB. No sub-tab strip. No Safari chrome (native app).

---

## Nav / header bar (exact)

Full-width bar, dark teal-slate background (`#2E4A58` est.), ~56pt tall.

| Position | Control | Exact text | Style |
|---|---|---|---|
| Left | Dismiss button | `Cancel` | White, ~17pt, regular weight, tappable — dismisses modal without saving selection |
| Center | Title | `Source` | White, ~17pt, regular weight |
| Right | Confirm button | `Select` | White, ~17pt, regular weight, tappable — confirms current selection and returns to caller |

No back chevron. No search icon. No badge. No kebab.

---

## Bottom tab bar

Not rendered. This modal covers the full screen. The underlying tab bar (Inbox / Activity / Calendar / People / Deals) is behind the modal and not visible or interactive.

---

## Content — every element, in order

### List anatomy

- Full-width rows on white background
- Row height: ~56–60pt each
- Left padding: ~20pt; text left-aligned
- Single-line label text: dark navy-charcoal `#2D3F4F` est., ~17pt, regular weight
- Thin 1px horizontal divider between every row: light gray `#E5E7EB` est., full width
- Right side: empty for unselected rows; blue checkmark icon for selected row
- Thin gray scroll-position indicator on far right edge (iOS native scroll bar)
- Tapping a row selects it (checkmark appears, row gets highlight tint) and may auto-dismiss or wait for "Select"

### Selected row treatment
- Row: `Import` — light blue-gray tint background `#EEF2FF` est., distinguishing it from all others
- Right side: bright blue checkmark `✓` at ~17pt, color `#007AFF` (iOS system blue or FUB blue-teal)

### Complete list of options (verbatim, top to bottom in scroll order)

| # | Label (exact) | State |
|---|---|---|
| 1 | `<unspecified>` | unselected |
| 2 | `AI- Claude` | unselected |
| 3 | `Cold Call` | unselected |
| 4 | `Company` | unselected |
| 5 | `County Assessor — West Side Bend 2026-05` | unselected |
| 6 | `Expired Listing` | unselected |
| 7 | `Expired Listing Cron` | unselected |
| 8 | `expired-listing-cron` | unselected |
| 9 | `Facebook` | unselected |
| 10 | `Farm` | unselected |
| 11 | `Follow Up Boss` | unselected |
| 12 | `FSBO` | unselected |
| 13 | `Google` | unselected |
| 14 | `IG` | unselected |
| 15 | `Import` | **SELECTED** (blue checkmark, tinted row) |
| 16 | `Open House` | unselected |
| 17 | `Realtor.com` | partially visible at bottom edge — list continues below scroll |

**Note:** The list is sorted roughly alphabetically (with `<unspecified>` pinned at top). Additional options below `Realtor.com` exist but are not visible (list is scrolled to approx. 70% of total length given scrollbar position).

Likely additional options below visible area (inferred from FUB source taxonomy): `Referral`, `Sign Call`, `Walk In`, `Website`, `Zillow`, and any other custom sources.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | `#2E4A58` dark teal-slate (FUB brand) |
| Header text / controls | `#FFFFFF` white |
| List background | `#FFFFFF` |
| Row label text | `#2D3F4F` dark navy-charcoal (FUB's standard body text) |
| Row dividers | `#E5E7EB` ~1px, full width |
| Selected row background | `#EEF2FF` light blue tint |
| Selected checkmark | `#007AFF` iOS system blue (or FUB accent ~`#1A73E8`) |
| Scrollbar | `#C7C7CC` light gray, thin, right edge |
| Status bar | `#000000` black |
| Battery icon | Yellow (low battery warning, ~16%) |
| Font family | SF Pro (iOS system font) |
| Font sizes | Status bar ~12pt · Header controls/title ~17pt · Row labels ~17pt |
| Font weight | Regular throughout |

FUB accent is the blue/teal tone — the header uses `#2E4A58` (distinct from the in-house navy `#102742`). Checkmark uses iOS blue `#007AFF`.

---

## Interactions & gestures

| Gesture / Target | Behavior |
|---|---|
| Tap `Cancel` (left) | Dismiss modal without changing selection; return to caller screen |
| Tap `Select` (right) | Confirm current selection (the checked row) and return to caller with value |
| Tap any unselected row | Toggle checkmark onto that row (deselects previous); row background gets tint |
| Tap the already-selected row | Deselects it (checkmark removed, row returns to white) — effectively clears the filter |
| Scroll up/down | Reveals additional source options above/below (momentum scroll, native iOS) |
| Swipe down (edge dismiss) [INFERRED] | May dismiss modal like a sheet, equivalent to Cancel |
| Pull-to-refresh | Not applicable — static enumeration list |
| Long-press [INFERRED] | No action — list items are not long-pressable |

---

## Build notes (component tree)

```
<MobileShell>
  <StatusBar style="light" backgroundColor="#000000" />

  <PickerModal>
    {/* Header */}
    <PickerHeader backgroundColor="#2E4A58">
      <PickerHeaderButton position="left" onPress={onCancel}>
        Cancel   {/* white, 17pt, regular */}
      </PickerHeaderButton>
      <PickerHeaderTitle>
        Source   {/* white, 17pt, regular, centered */}
      </PickerHeaderTitle>
      <PickerHeaderButton position="right" onPress={onSelect}>
        Select   {/* white, 17pt, regular */}
      </PickerHeaderButton>
    </PickerHeader>

    {/* Scrollable option list */}
    <ScrollView bounces showsVerticalScrollIndicator>
      <SourceOptionList>
        {sources.map(source => (
          <SourceOptionRow
            key={source.value}
            label={source.label}           /* string — exact label text */
            selected={source.value === selectedValue}
            onPress={() => setSelectedValue(source.value)}
          >
            {/* Row internals */}
            <OptionLabel
              style={{
                fontSize: 17,
                color: '#2D3F4F',
                paddingLeft: 20,
                paddingVertical: 18,
              }}
            >
              {source.label}
            </OptionLabel>
            {selected && (
              <CheckmarkIcon
                color="#007AFF"
                size={17}
                style={{ marginRight: 20 }}
              />
            )}
            {/* Full-width 1px divider below each row */}
            <RowDivider color="#E5E7EB" />
          </SourceOptionRow>
        ))}
      </SourceOptionList>
    </ScrollView>
  </PickerModal>
</MobileShell>
```

### Data shape
```ts
interface SourceOption {
  value: string;         // internal key (may differ from label — see kebab variants)
  label: string;         // display string rendered verbatim
}

// Confirmed options from screenshot:
const sources: SourceOption[] = [
  { value: 'unspecified',                          label: '<unspecified>' },
  { value: 'ai-claude',                            label: 'AI- Claude' },
  { value: 'cold-call',                            label: 'Cold Call' },
  { value: 'company',                              label: 'Company' },
  { value: 'county-assessor-west-side-bend-2026-05', label: 'County Assessor — West Side Bend 2026-05' },
  { value: 'expired-listing',                      label: 'Expired Listing' },
  { value: 'expired-listing-cron-display',         label: 'Expired Listing Cron' },
  { value: 'expired-listing-cron',                 label: 'expired-listing-cron' },
  { value: 'facebook',                             label: 'Facebook' },
  { value: 'farm',                                 label: 'Farm' },
  { value: 'follow-up-boss',                       label: 'Follow Up Boss' },
  { value: 'fsbo',                                 label: 'FSBO' },
  { value: 'google',                               label: 'Google' },
  { value: 'ig',                                   label: 'IG' },
  { value: 'import',                               label: 'Import' },   // ← SELECTED
  { value: 'open-house',                           label: 'Open House' },
  { value: 'realtor-com',                          label: 'Realtor.com' },
  // ... more items scroll below
];

const selectedValue = 'import';
```

### Spacing & sizing notes
- Header bar: height 56pt, all three controls vertically centered
- "Cancel" left edge inset ~20pt; "Select" right edge inset ~20pt
- List rows: min-height 56pt, label 17pt, vertical padding ~18pt top+bottom
- Left text inset: 20pt
- Right checkmark inset: 20pt from right edge
- Dividers: 1px solid, full width (no left indent unlike some iOS patterns)
- Scroll indicator: native iOS thin bar, right edge

### Rendering note on duplicate source entries
Two entries exist for "expired-listing-cron": one in Title Case (`Expired Listing Cron`) and one in kebab-case (`expired-listing-cron`). This reflects FUB storing the raw programmatic source string as-sent alongside a normalized display version — the web rebuild should render the value exactly as stored, no normalization.

<!-- Mobile per-screen appendix. Original: IMG_5999.PNG | id: mob-35 | tiles: mob-tiles/mob-35_{full,t,m,b}.png -->

# mob-35 — fub-ios — Stage Picker (Modal)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iOS app — dark teal/slate header, FUB stage taxonomy)
- **module:** Picker / Modal / Action sheet
- **screen:** Full-screen modal list picker for selecting a contact's Stage value
- **how to reach:** From a Contact Detail (Lead Profile) screen, tap the Stage field → this modal is pushed/presented full-screen over the previous view
- **iOS status bar:** Time 8:44 (left, white text) · signal 2/4 bars · WiFi icon · battery 36% (all right-aligned, white text on black)
- **URL:** N/A — native app, no URL bar

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical canvas)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0 – 54 | 54pt | #000000 (black) |
| Modal nav/header bar | 54 – 104 | 50pt | #3d5060 (dark teal-slate, FUB brand) |
| Scrollable stage list | 104 – 810 | ~706pt | #ffffff / #f9f9fb alternating by selection |
| Bottom safe area / home indicator zone | 810 – 844 | 34pt | #eff0f3 (very light blue-gray) |

No bottom tab bar is visible — this modal covers the full screen including where the tab bar would be.

---

## Nav / header bar (exact)

- **Background:** #3d5060 (dark blue-gray/teal slate, the FUB brand header color). Rounded top corners visible (sheet presentation style from below).
- **Left control:** Text button — "Cancel" — white, ~17pt, regular weight. Tap dismisses the modal without saving the selection.
- **Center:** Title — "Stage" — white, ~17pt, semibold/medium weight, horizontally centered.
- **Right control:** Text button — "Select" — white, ~17pt, regular weight. Tap confirms and saves the currently-checked stage to the contact record.
- No icons, no search, no back chevron — purely text controls on either side.

---

## Bottom tab bar

**Not visible** — this is a full-screen modal overlay. The underlying tab bar (Inbox / Activity / Calendar / People / Deals) is hidden beneath the sheet. No FAB visible.

---

## Content — every element in order

### Scrollable Stage List

The list is a full-width, single-column picker. Each row is a tappable stage option. "Lead" is the currently selected value, indicated by a blue checkmark.

**Row anatomy:**
- Height: ~52pt per row
- Left-inset text, ~16pt inset from left edge (~16–20pt padding-left)
- Primary label: stage name, ~16–17pt, regular weight, color #2d3e50 (dark blue-slate)
- Right side: checkmark icon only for the selected row (blue checkmark, ~#2d7ff9); all other rows have no right-side decoration
- Horizontal divider between each row: 1pt, ~#e0e0e0 / #d9d9d9, full width
- Selected row ("Lead") has a barely-perceptible light tint background (~#f5f7ff or #f0f4ff) versus pure white for unselected rows
- No avatar, no secondary text, no chevron, no right-side meta other than the checkmark

**Scroll position indicator (native iOS fast-scroll handle):**
A gray rounded rectangle (~8pt wide × ~60pt tall, color #9a9a9f) appears at the far right edge of the screen at approximately y=300–420pt. This is the native iOS scroll-view position indicator (visible when the list is scrollable and the user has recently scrolled). It is not interactive — it is the UIScrollView position tracker.

**Complete verbatim list of stage options (top to bottom, as shown):**

1. Seller Prospect
2. **Lead** ← currently selected (blue checkmark ✓ on right)
3. A - Hot 1-3 Months
4. B - Warm 3-6 Months
5. C - Cold 6+ Months
6. Renter - future buyer
7. Active Client
8. Pending
9. Past Client
10. Sphere
11. Archive
12. Closed
13. Trash
14. Real Estate Agent
15. Vendor
16. Nurture

(List ends here; the bottom safe area / home indicator strip is visible below "Nurture", suggesting this is the end of the stage options list — no additional rows exist below the fold.)

**Empty state:** N/A — list always has content (these are the system-defined FUB stages).

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | #3d5060 (FUB dark teal-slate) |
| Header text (Cancel / Stage / Select) | #ffffff, ~17pt, system font (SF Pro), regular/medium |
| Status bar background | #000000 |
| Status bar text/icons | #ffffff |
| List row background (unselected) | #ffffff |
| List row background (selected "Lead") | ~#f2f6ff (very subtle blue tint, barely visible) |
| Row label text color | #2d3e50 (dark slate blue — FUB body text) |
| Row label font | SF Pro Display / SF Pro Text, ~17pt, weight 400 (regular) |
| Row divider | 1pt #e0e0e2 (light gray) |
| Selection checkmark | #2d7ff9 (FUB blue accent) — SF Symbols "checkmark" glyph |
| Scroll indicator handle | #9a9a9f (gray pill, native iOS scroll indicator) |
| Bottom safe area | #eff0f3 (light blue-gray) |
| Accent color | #2d7ff9 (FUB blue — used for checkmark, and presumably "Select" / "Cancel" on other modals) |

Note: This is the FUB teal accent theme (#3d5060 header), NOT the Ryan Realty in-house navy #102742 / cream #faf8f4 system.

---

## Interactions & gestures

| Interaction | Behavior |
|---|---|
| Tap any unselected row | Moves the checkmark to that row (single-select); row background tints lightly [INFERRED: may auto-dismiss on tap, or may require tapping "Select"] |
| Tap "Select" (top-right) | Saves the currently checked stage to the contact record and dismisses the modal, returning to the Contact Detail screen |
| Tap "Cancel" (top-left) | Dismisses the modal without saving any change; returns to Contact Detail with the original stage intact |
| Swipe down from top of sheet | [INFERRED] May dismiss as "Cancel" on newer FUB versions (interactive sheet dismiss) |
| Scroll list | Standard vertical scroll; fast-scroll indicator appears during scroll; list is ~16 items × 52pt = ~832pt total content height, meaning it is slightly taller than the available viewport and requires a small scroll to reach "Nurture" |
| Long-press on row | [INFERRED] No action — this is a simple picker |

---

## Build notes (component tree)

### Responsive web rebuild structure

```
<StagePickerModal>
  <!-- iOS/Web full-screen sheet or bottom-sheet-to-full-screen -->

  <ModalHeader>
    <!-- bg: #3d5060, height: 50pt, rounded top corners (8–12pt radius) -->
    <TextButton label="Cancel" onClick={onCancel}
      style="color:#fff; font:17px SF Pro / system-ui; font-weight:400; padding:0 16px;" />
    <ModalTitle text="Stage"
      style="color:#fff; font:17px system-ui; font-weight:600; text-align:center; flex:1;" />
    <TextButton label="Select" onClick={onConfirm}
      style="color:#fff; font:17px SF Pro / system-ui; font-weight:400; padding:0 16px;" />
  </ModalHeader>

  <ScrollableList>
    <!-- overflow-y: auto; -webkit-overflow-scrolling: touch; -->
    <!-- Data: FUB_STAGES array (see below) -->
    {FUB_STAGES.map(stage => (
      <StageRow
        key={stage.value}
        label={stage.label}
        isSelected={selectedStage === stage.value}
        onTap={() => setSelectedStage(stage.value)}
      />
    ))}
  </ScrollableList>

  <SafeAreaPad height="34pt" bg="#eff0f3" />
    <!-- matches iOS home indicator zone -->

</StagePickerModal>

<!-- StageRow anatomy: -->
<StageRow>
  <!-- height: 52px; display:flex; align-items:center; bg: isSelected ? #f2f6ff : #fff; -->
  <!-- border-bottom: 1px solid #e0e0e2; -->
  <label style="
    flex: 1;
    padding: 0 16px;
    font: 17px system-ui, -apple-system;
    font-weight: 400;
    color: #2d3e50;
  ">{stage.label}</label>
  {isSelected && (
    <CheckIcon style="color:#2d7ff9; margin-right:16px; width:18px; height:18px;" />
    <!-- SF Symbols "checkmark" — use a simple ✓ SVG icon -->
  )}
</StageRow>
```

### Data binding

```typescript
const FUB_STAGES = [
  { value: 'seller_prospect',    label: 'Seller Prospect' },
  { value: 'lead',               label: 'Lead' },           // ← currently selected
  { value: 'a_hot_1_3_months',   label: 'A - Hot 1-3 Months' },
  { value: 'b_warm_3_6_months',  label: 'B - Warm 3-6 Months' },
  { value: 'c_cold_6_months',    label: 'C - Cold 6+ Months' },
  { value: 'renter_future_buyer',label: 'Renter - future buyer' },
  { value: 'active_client',      label: 'Active Client' },
  { value: 'pending',            label: 'Pending' },
  { value: 'past_client',        label: 'Past Client' },
  { value: 'sphere',             label: 'Sphere' },
  { value: 'archive',            label: 'Archive' },
  { value: 'closed',             label: 'Closed' },
  { value: 'trash',              label: 'Trash' },
  { value: 'real_estate_agent',  label: 'Real Estate Agent' },
  { value: 'vendor',             label: 'Vendor' },
  { value: 'nurture',            label: 'Nurture' },
];

// Props passed to modal:
interface StagePickerProps {
  currentStage: string;          // e.g. 'lead'
  onSelect: (stage: string) => void;
  onCancel: () => void;
}
```

### Sizing / spacing specifics
- Modal header height: 50px
- Row height: 52px minimum (comfortable tap target)
- Row left text padding: 16px
- Row right icon (checkmark) margin-right: 16px
- Checkmark icon size: 18×18px, color #2d7ff9
- Row divider: 1px solid #e0e0e2
- Total list height: 16 rows × 52px = 832px (slightly exceeds typical viewport; requires scroll)
- Modal max-height: 100dvh (or calc(100vh - status bar height))
- Sheet presentation: slide-up from bottom with rounded top corners (border-radius: 12px 12px 0 0 on the modal container)
- No top border/separator below the header bar (color blends from dark header into white list)

### Web implementation pattern
```
// Present as a fixed-position full-screen overlay (z-index: 9999)
// or as a sheet within a <dialog> element
// Animate: transform: translateY(100%) → translateY(0) on open
// Dismiss: translateY(0) → translateY(100%) on Cancel/Select/swipe-down
// Backdrop: rgba(0,0,0,0.4) behind the sheet
```

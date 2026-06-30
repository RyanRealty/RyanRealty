<!-- Mobile per-screen appendix. Original: IMG_5836.PNG | id: mob-15 | tiles: mob-tiles/mob-15_{full,t,m,b}.png -->

# mob-15 — fub-ios — Automations Picker (Modal)

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app
- **module:** Picker / Modal / Action sheet
- **screen:** Automations Picker — a full-screen modal listing all available FUB action plans / automation workflows the agent can enroll a contact into
- **how to reach:** From a Contact Detail screen (People tab → contact row → contact profile) → tap "Automations" or "Add to Automation" action → this modal is pushed/presented modally over the contact detail
- **iOS status bar:** Time 4:34 (left), cellular signal bars + WiFi arc + battery 100% with charging bolt (right); status bar background is near-black matching the header
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | Approx y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | #1A1A1A (near-black, bleeds into header) |
| Nav / header bar | 54–98 | 44 | #2C4055 (dark slate-teal, FUB brand) |
| Scrollable list content | 98–844 | 746 | #FFFFFF (pure white) |
| Bottom tab bar | **not present** — modal covers full screen | — | — |
| Safari chrome | **not present** — native app | — | — |

No FAB. No sub-tab strip. No floating elements.

---

## Nav / header bar (exact)

- **Background:** dark slate-teal ~#2C4055 (FUB brand accent, slightly desaturated navy-teal)
- **Left control:** Text button "Cancel" — SF Pro Text, ~17pt, white (#FFFFFF), regular weight. Tap dismisses the modal without selecting any automation.
- **Center title:** "Automations" — SF Pro Text or SF Pro Display, ~17pt, white (#FFFFFF), **semibold/bold**. Static title, no ▾ filter dropdown, no subtitle.
- **Right control:** Text button "Select" — SF Pro Text, ~17pt, muted gray (~#8E8E93 or similar disabled-state gray), regular weight. Dimmed/inactive state — implies it becomes actionable either (a) after the user taps a row to pre-select it, enabling a "Select" confirm, or (b) tapping "Select" toggles into multi-select/bulk-enrollment mode with checkboxes. Currently non-interactive in appearance.

---

## Bottom tab bar (exact)

**Not visible.** This screen is presented as a full-screen modal over the parent view. The FUB bottom tab bar (Inbox / Activity / Calendar / People / Deals) is hidden behind this modal. No FAB present.

---

## Content — every element, in order

### List structure
- **Layout:** Plain UITableView-style vertically scrolling list, no section headers, no grouping.
- **Alphabetically sorted** by automation name (A → Z confirmed across all visible rows).
- **Row count visible:** 16 rows. The bottom tile confirms "Web Inquiry Option 03" is the last item (a thin divider appears below it, suggesting end of list — no "load more" indicator).
- **Scroll state:** Scrolled to top (first row is "Assign to a lender" immediately below the header with no gap).

### Row anatomy (every row is identical in structure)
- **Height:** ~50 pt per row
- **Left inset:** ~16 pt padding from left edge
- **Right inset:** ~16 pt from right edge
- **Content:** Single-line text only. Name of the automation plan. NO avatar, NO icon, NO badge, NO secondary/subtitle text, NO right-side chevron (›), NO disclosure indicator.
- **Divider:** 1 pt hairline, light gray ~#C6C6C8, full-width (edge-to-edge, not inset)
- **Tap behavior:** Tapping a row selects that automation and either (a) immediately dismisses and enrolls the contact, or (b) shows a checkmark and enables the "Select" button for confirmation [INFERRED]
- **Swipe actions:** None apparent
- **Long-press:** None apparent

### Complete verbatim list of automation names (top to bottom)

1. Assign to a lender
2. Birthday Email - Start by Automations
3. Buyer Long Term Nurture
4. Buyer New Lead Website Registration
5. Facebook Lead Ads
6. Open House Follow Up
7. Open House Leads
8. Past Client Saved a Home
9. Post Closing Plan
10. Seller - Home Evaluation Request
11. Seller Lead Drip
12. Stale Lead Engagement
13. Unconverted and active now. Call!
14. Unsubscribed
15. Web Inquiry Option 01
16. Web Inquiry Option 03

*(Note: "Web Inquiry Option 02" is absent — the gap between 01 and 03 is visible in data, not a rendering artifact.)*

### Selected state
No row shows a selected/checked state in this screenshot. All rows appear in the default unselected style (no checkmark, no highlight fill, no teal accent).

### Empty state
Not applicable — list has 16 items.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | ~#2C4055 (dark slate-teal; FUB brand — NOT in-house navy #102742) |
| Status bar background | ~#1A1A1A (near-black, continuous with header) |
| Header "Cancel" text | #FFFFFF, SF Pro Text ~17pt, weight 400 |
| Header "Automations" title | #FFFFFF, SF Pro Text ~17pt, weight 600 (semibold) |
| Header "Select" text | ~#8E8E93 (iOS system gray, disabled appearance), SF Pro Text ~17pt, weight 400 |
| List background | #FFFFFF |
| Row text (automation name) | ~#1C1C1E (iOS label color, near-black), SF Pro Text ~17pt, weight 400 (regular) |
| Row dividers | ~#C6C6C8 (iOS separator color), 1 pt hairline, full-width |
| Active/accent color | ~#2C7B8C or #3B82A0 (FUB teal — used in header; not appearing in list rows here) |
| Selected row state (not shown) | Teal checkmark + teal text [INFERRED from FUB design pattern] |

**Font family:** SF Pro Text (system font on iOS). All text is the native system font — no custom typeface visible. NOT Amboqia or Geist (this is FUB native app, not Ryan Realty in-house).

**Iconography:** No icons in this screen other than the iOS status bar system icons (cell signal, WiFi, battery). The list rows are text-only with no glyphs.

---

## Interactions & gestures

- **Tap "Cancel" (top-left):** Dismisses modal, returns to contact detail with no change [INFERRED]
- **Tap "Select" (top-right):** Toggles into multi-select mode — rows gain circular checkboxes on the left; "Select" changes to "Done" or becomes a confirmation button; "Cancel" stays [INFERRED from FUB UX pattern]
- **Tap any automation row (single-select mode):** Selects that automation and either auto-dismisses (enrolling the contact immediately) or highlights the row and activates the "Select" button for a confirm tap [INFERRED]
- **Pull to refresh:** Not applicable for a static automation list [INFERRED — no refresh indicator visible]
- **Scroll:** Standard vertical scroll through 16 rows; list fits within the screen height (no evidence that more rows exist below "Web Inquiry Option 03")
- **Swipe left on row:** No swipe-to-delete or swipe actions apparent [INFERRED]
- **Long press:** No contextual menu apparent [INFERRED]
- **Modal dismiss via swipe-down:** May be disabled (Cancel button is the explicit dismiss path); iOS 13+ interactive dismiss may be blocked [INFERRED]

---

## Build notes (component tree)

```
<MobileShell fullscreen modal>

  <StatusBar
    time="4:34"
    signal={cellBars}
    wifi={true}
    battery={100}
    charging={true}
    style={{ background: '#1A1A1A', barStyle: 'light-content' }}
  />

  <TopBar
    background="#2C4055"
    height={44}
    leftControl={
      <TextButton
        label="Cancel"
        color="#FFFFFF"
        fontSize={17}
        fontWeight={400}
        onTap={() => dismissModal()}
      />
    }
    centerTitle={
      <Text
        value="Automations"
        color="#FFFFFF"
        fontSize={17}
        fontWeight={600}
      />
    }
    rightControl={
      <TextButton
        label="Select"
        color="#8E8E93"
        fontSize={17}
        fontWeight={400}
        disabled={!hasSelection}
        onTap={() => toggleMultiSelectMode()}
      />
    }
  />

  <ScrollView
    background="#FFFFFF"
    contentInset={{ top: 0, bottom: 0 }}
    showsScrollIndicator={true}
  >
    {automations.map((automation, index) => (
      <AutomationRow
        key={automation.id}
        name={automation.name}          // string — automation plan display name
        isSelected={selectedIds.includes(automation.id)}
        onTap={() => handleAutomationSelect(automation.id)}
        showDivider={true}              // always; full-width hairline
        height={50}                     // pt
        paddingLeft={16}               // pt
        paddingRight={16}              // pt
        textColor="#1C1C1E"
        fontSize={17}
        fontWeight={400}
        dividerColor="#C6C6C8"
        // In multi-select mode: show left-side circular checkbox
        multiSelectMode={isMultiSelectMode}
        checkboxColor="#2C7B8C"         // FUB teal accent [INFERRED]
      />
    ))}
  </ScrollView>

  {/* No BottomTabBar — modal hides parent nav */}
  {/* No FAB */}

</MobileShell>
```

### Data model the component binds to

```typescript
interface Automation {
  id: string;               // FUB internal action plan ID
  name: string;             // Display name (verbatim list above)
  // No description, no icon, no category grouping shown
}

// Complete dataset visible in screenshot:
const automations: Automation[] = [
  { id: '...', name: 'Assign to a lender' },
  { id: '...', name: 'Birthday Email - Start by Automations' },
  { id: '...', name: 'Buyer Long Term Nurture' },
  { id: '...', name: 'Buyer New Lead Website Registration' },
  { id: '...', name: 'Facebook Lead Ads' },
  { id: '...', name: 'Open House Follow Up' },
  { id: '...', name: 'Open House Leads' },
  { id: '...', name: 'Past Client Saved a Home' },
  { id: '...', name: 'Post Closing Plan' },
  { id: '...', name: 'Seller - Home Evaluation Request' },
  { id: '...', name: 'Seller Lead Drip' },
  { id: '...', name: 'Stale Lead Engagement' },
  { id: '...', name: 'Unconverted and active now. Call!' },
  { id: '...', name: 'Unsubscribed' },
  { id: '...', name: 'Web Inquiry Option 01' },
  { id: '...', name: 'Web Inquiry Option 03' },
  // NOTE: Web Inquiry Option 02 absent from FUB account
];
```

### Spacing / sizing summary

| Property | Value |
|---|---|
| Header height | 44 pt |
| Status bar height | 54 pt (notch device) |
| Row height | ~50 pt |
| Row left text padding | 16 pt |
| Row divider thickness | 1 pt (hairline) |
| Total list items | 16 |
| Estimated total list height | 16 × 50 = 800 pt |
| Screen available for list | ~746 pt (844 − 54 − 44) |
| Scroll needed | Yes — list overflows by ~54 pt; slight scroll required to reach last item |

### In-house web rebuild notes

For the Ryan Realty in-house CRM rebuild of this picker:
- Present as a full-screen modal `<Dialog>` (or `<Sheet>` from `@/components/ui/sheet`) with `side="bottom"` or full-screen
- Replace FUB teal `#2C4055` header with in-house navy `#102742`
- Replace "Select" with in-house styled text button using `text-muted-foreground` token
- "Cancel" maps to a `<Button variant="ghost">` in cream/white
- List rows map to `<button>` elements inside a `<ScrollArea>` with `border-b border-border` dividers
- Use FUB's `/v1/actionPlans` API endpoint to fetch available automations for the account
- On row tap, call FUB API to enroll the person: `POST /v1/actionPlans/{id}/subscribers` with `personId`
- Sort list alphabetically client-side on `name` field
- Multi-select mode (matching "Select" button): wrap rows in a `<Checkbox>` pattern from `@/components/ui/checkbox`, add a "Enroll in X plans" confirm button at the bottom

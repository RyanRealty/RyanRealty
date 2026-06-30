<!-- Mobile per-screen appendix. Original: IMG_6013.PNG | id: mob-45 | tiles: mob-tiles/mob-45_{full,t,m,b}.png -->

# mob-45 — inhouse-web — Contact Detail: Memberships / Workflows (keyboard open)

## Identity

- **app_source:** inhouse-web
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact detail — "Memberships" sub-panel, scrolled mid-page, iOS numeric keypad open (a phone/numeric input field below the fold is active)
- **how to reach:** Bottom tab "People" → tap any contact row → scroll down past profile fields to the "Memberships" section; tapping a phone-number or ID field triggered the numeric keyboard
- **iOS status bar:** 7:39 · 2-bar cell signal · WiFi · battery 17% (yellow low-battery indicator)
- **URL in address bar:** ryan-realty.com (centered in Safari's combined address/search bar)
- **Safari chrome row (top):** Sparkle AI-assistant icon (left) · "ryan-realty.com" (center, gray pill) · Share icon ↑ (right)

---

## Screen regions (y-bands on 390×844 pt logical canvas)

| Region | Approx y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | #FFFFFF white |
| Safari address bar | 54–98 | 44 pt | #F2F2F7 light gray pill on white |
| Scrollable content | 98–620 | ~522 pt | #FFFFFF white |
| Bottom tab bar | 620–690 | ~70 pt | #FFFFFF white, thin top border #E5E5EA |
| iOS QuickType / autofill toolbar | 690–738 | ~48 pt | #D1D1D6 light gray |
| iOS numeric keypad | 738–844 | ~310 pt (extends below fold) | #D1D1D6 / white key tiles |

> The keyboard pushes up from the bottom, compressing visible content. The Safari bottom nav chrome (back/forward/+/tabs/share) is fully hidden behind the keyboard.

---

## Nav / header bar (exact)

This is Safari's native address bar — not an in-app nav bar.

- **Left:** Sparkle icon (4-pointed star / AI assistant shortcut, gray ~#8E8E93)
- **Center:** "ryan-realty.com" in a gray rounded-rect pill (~#F2F2F7 bg, dark label ~#000000)
- **Right:** Share sheet icon (box with upward arrow, gray ~#8E8E93)

No in-app back chevron is visible; the page is likely a long-scroll detail, not a pushed modal. The contact's name / header section is scrolled above the fold.

---

## Bottom tab bar (exact)

Five tabs, left to right. The keyboard dismiss blue button overlays the far-right slot.

| # | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline (home) | *(no label visible)* | none | inactive — dark ~#3C3C43 |
| 2 | Arch / chat-bubble outline (inbox) | *(no label visible)* | none | inactive — dark ~#3C3C43 |
| 3 | Two-person silhouette (group/people) | **People** | none | **active — navy #102742** (logical active, since contact detail is within People) |
| 4 | Three stacked horizontal layers (deals/pipeline) | **Deals** | none | inactive — dark ~#3C3C43 |
| 5 | Pulse / waveform (activity) | *(hidden behind keyboard dismiss)* | none | inactive |

**FAB:** Blue filled circle (~56 pt diameter), white "+" glyph centered, positioned bottom-right of the scrollable content area at approximately (x: 350 pt, y: 610 pt) — overlaying the "Newsletter & Alerts" section. Color: ~#2563EB (medium blue, distinct from the navy brand color #102742).

---

## Content — every element, in order (top to bottom, scroll mid-position)

### Visible above the fold

#### Section heading
- Text: **"Memberships"**
- Style: ~22 pt semibold, dark #111111
- Left-aligned, 16 pt left margin, 24 pt top padding from whatever is above
- No right control

#### Sub-section group header: WORKFLOWS
- Text: **"WORKFLOWS"**
- Style: ~11 pt, all-caps, medium weight, gray ~#8E8E93
- Left-aligned, 16 pt left margin, ~12 pt top padding
- Background: same white as content

#### Toggle row 1
- Label: **"Buyer Lead — Master Workflow"**
- Control: iOS-style toggle switch, OFF state (gray track ~#E9E9EA, white thumb)
- Row height: ~52 pt
- Divider: 1 pt #E5E5EA hairline, full width, inset 16 pt left only

#### Toggle row 2
- Label: **"Expired Recovery (auto)"**
- Control: toggle OFF (gray)
- Row height: ~52 pt
- Divider: same hairline

#### Toggle row 3
- Label: **"FSBO Recovery (auto)"**
- Control: toggle OFF (gray)
- Row height: ~52 pt
- Divider: hairline

#### Toggle row 4
- Label: **"Seller Lead — Master Workflow"**
- Control: toggle OFF (gray)
- Row height: ~52 pt
- Divider: hairline

#### Sub-section group header: NEWSLETTER & ALERTS
- Text: **"NEWSLETTER & ALERTS"**
- Style: ~11 pt, all-caps, gray ~#8E8E93, 16 pt left margin
- ~12 pt top padding (grouping gap)

#### Newsletter display row
- Primary text: **"Newsletter"** (~16 pt semibold, dark #111111)
- Secondary text: **"Not subscribed"** (~13 pt regular, gray ~#8E8E93)
- No toggle control — read-only display, tap may navigate to subscription management
- Row height: ~56 pt
- Divider: hairline

#### Content continues below (partially obscured by keyboard)
- At least one more row/section is partially visible; text not legible.

---

## iOS Keyboard (system keyboard — not part of app)

**Type:** iOS number pad (phone-style), triggered by a numeric/phone input field

**QuickType / Autofill accessory bar** (above numpad, ~48 pt height, gray #D1D1D6 bg):
- Left: 🔑 key/password icon (autofill saved passwords)
- Center-left: credit card icon (autofill card numbers)
- Center: 📍 location pin icon (autofill address/location)
- Right: blue keyboard-dismiss icon (iOS keyboard hide button, ~24×24 pt, blue ~#007AFF)

**Number pad layout** (4 rows × 3 columns):

| Col 1 | Col 2 | Col 3 |
|---|---|---|
| 1 | 2 ABC | 3 DEF |
| 4 GHI | 5 JKL | 6 MNO |
| 7 PQRS | 8 TUV | 9 WXYZ |
| *(blank)* | 0 | ⌫ (backspace, shield-with-X glyph) |

Key tiles: white rounded-rect on light gray background (#D1D1D6), ~18 pt numeral + ~9 pt letter sub-labels in dark #111111, corner radius ~10 pt.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Page background | #FFFFFF |
| Status bar / Safari chrome bg | #FFFFFF |
| Address bar pill bg | #F2F2F7 |
| Section heading "Memberships" | #111111, ~22 pt semibold |
| Group header (WORKFLOWS / NEWSLETTER & ALERTS) | #8E8E93, ~11 pt medium, all-caps |
| Row label (primary) | #111111, ~16–17 pt regular/medium |
| Row sub-label ("Not subscribed") | #8E8E93, ~13 pt regular |
| Toggle OFF track | #E9E9EA |
| Toggle ON track (not shown) | #34C759 (iOS green) or navy #102742 [INFERRED] |
| Row hairline divider | #E5E5EA, 1 pt, left-inset 16 pt |
| FAB circle bg | ~#2563EB (medium blue) |
| FAB "+" glyph | #FFFFFF |
| Bottom tab bar bg | #FFFFFF |
| Tab inactive icon+label | ~#3C3C43 |
| Tab active (People) | #102742 navy [INFERRED] |
| iOS keyboard dismiss button | #007AFF system blue |
| Font family | San Francisco (system) throughout; body 16–17 pt, labels 13 pt, group headers 11 pt all-caps |

---

## Interactions & gestures

| Target | Action |
|---|---|
| Toggle (any workflow row) | Tap to flip ON/OFF — fires PATCH to contact's workflow enrollment API [INFERRED] |
| "Newsletter" row | Tap → navigate to newsletter subscription management sub-screen [INFERRED] |
| FAB (+) blue circle | Tap → present action sheet or modal to add a new membership / workflow enrollment [INFERRED] |
| Home tab | Navigate to Home / Dashboard |
| People tab | Navigate to People list (back from this detail) |
| Deals tab | Navigate to Deals pipeline |
| Activity tab | Navigate to Activity feed |
| Keyboard dismiss (blue icon) | Dismiss iOS keyboard, restores full-screen content view |
| Scroll up | Reveal contact name / header / profile fields above current scroll position [INFERRED] |
| Pull-to-refresh | Reload contact's membership/workflow data [INFERRED] |
| Swipe right (any toggle row) | No swipe-to-delete expected; these are membership enrollments not list records [INFERRED] |

---

## Build notes (component tree)

```
<MobileShell>                              /* full-viewport flex-col */

  <SafariAddressBar                        /* inhouse-web only — native Safari chrome */
    leftIcon="sparkle-ai"
    url="ryan-realty.com"
    rightIcon="share-sheet"
    bg="#F2F2F7"
    height={44}
  />

  <ScrollView flex=1 bg="#FFFFFF">

    <SectionHeading                        /* "Memberships" */
      text="Memberships"
      fontSize={22}
      fontWeight="600"
      color="#111111"
      px={16} pt={24} pb={12}
    />

    <GroupHeader label="WORKFLOWS" />     /* all-caps 11pt gray #8E8E93 */

    <ToggleRow                            /* repeat × 4 */
      label="Buyer Lead — Master Workflow"
      value={false}
      onChange={(v) => patchWorkflowEnrollment(contactId, workflowId, v)}
    />
    <HairlineDivider insetLeft={16} />

    <ToggleRow label="Expired Recovery (auto)" value={false} ... />
    <HairlineDivider insetLeft={16} />

    <ToggleRow label="FSBO Recovery (auto)" value={false} ... />
    <HairlineDivider insetLeft={16} />

    <ToggleRow label="Seller Lead — Master Workflow" value={false} ... />
    <HairlineDivider insetLeft={16} />

    <GroupHeader label="NEWSLETTER & ALERTS" />

    <DisplayRow                           /* read-only, no toggle */
      primary="Newsletter"
      secondary="Not subscribed"
      onPress={() => navigate('/contact/:id/newsletter')}
    />
    <HairlineDivider insetLeft={16} />

    {/* more rows below — not visible in this capture */}

  </ScrollView>

  <FAB                                   /* floating action button */
    icon="plus"
    bg="#2563EB"
    size={56}
    position="absolute"
    bottom={80}                          /* sits above bottom tab bar */
    right={16}
    onPress={() => openAddMembershipSheet()}
  />

  <BottomTabBar
    tabs={[
      { icon: "home-outline",    label: "Home",     active: false },
      { icon: "inbox-outline",   label: "Inbox",    active: false },
      { icon: "people-outline",  label: "People",   active: true  },
      { icon: "deals-layers",    label: "Deals",    active: false },
      { icon: "activity-pulse",  label: "Activity", active: false },
    ]}
    activeColor="#102742"
    inactiveColor="#3C3C43"
    bg="#FFFFFF"
    borderTop="1px solid #E5E5EA"
    height={70}
  />

  {/* iOS system keyboard rendered by browser/OS — not a React component */}
  {/* Triggered when a phone/numeric <input type="tel"> field below fold is focused */}

</MobileShell>
```

### Key data bindings

| Component | Data source |
|---|---|
| ToggleRow × 4 | `contact.workflowEnrollments[]` — array of `{ workflowId, workflowName, enrolled: boolean }` |
| DisplayRow "Newsletter" | `contact.newsletterSubscription` — `{ subscribed: boolean, email?: string }` |
| FAB onPress | Opens sheet to pick from available workflows not yet enrolled |

### Spacing / sizing notes

- Left/right content padding: 16 pt
- Row height (toggle rows): ~52–56 pt
- Row height (display rows): ~56 pt
- Group header top padding: ~20 pt; bottom padding: ~8 pt
- Dividers: 1 pt, color #E5E5EA, left-inset 16 pt (not full-bleed)
- FAB: 56 pt circle, 16 pt from right edge, 80 pt from bottom of viewport (above tab bar)
- Toggle: standard iOS UISwitch dimensions (~51×31 pt)

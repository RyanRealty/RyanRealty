<!-- Mobile per-screen appendix. Original: IMG_5831.PNG | id: mob-11 | tiles: mob-tiles/mob-11_{full,t,m,b}.png -->

# mob-11 — fub-ios — Filter Deals / Agent Picker Modal

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app
- **module:** Picker / Modal / Action sheet (Deals agent filter)
- **screen name:** Filter Deals — Agent Picker modal
- **how to reach:** From the Deals tab list view, tap the agent/filter control (person icon or "Everyone" pill) in the header; presented as a full-screen modal push/sheet over the Deals list
- **iOS status bar:** 4:33 · 2-bar cellular signal · WiFi · 100% battery — all white glyphs on solid black background
- **URL bar:** N/A — native iOS app, no browser chrome

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical canvas)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | #000000 solid black |
| Nav / header bar | 54–108 | 54 pt | #2C4A56 (dark teal-slate) |
| Content: Deal Status section | 108–270 | 162 pt | #EEF1F4 (light blue-gray) |
| Content: Agent scope label + search | 270–370 | 100 pt | #EEF1F4 |
| Hairline divider | 370–371 | 1 pt | #D0D5DC |
| Content: scrollable agent picker list | 371–750 | 379 pt | #EEF1F4 |
| Empty space (list end, no bottom tab bar) | 750–844 | 94 pt | #EEF1F4 |

No bottom tab bar is visible — this modal covers it. No FAB. No Safari chrome.

---

## Nav / header bar (exact)

- **Background:** #2C4A56 (dark desaturated teal — the FUB brand header color)
- **Left control:** Text button — "Cancel" — white, ~17pt regular weight, tappable, dismisses modal without applying changes
- **Center:** Text — "Filter Deals" — white, ~17pt semibold, non-interactive title
- **Right control:** None

---

## Bottom tab bar (exact)

Not visible in this screen — the Filter Deals modal is presented full-screen and covers the tab bar entirely. The originating tab is **Deals**.

No FAB visible.

---

## Content — every element, in order

### 1. Deal Status section header
- Text: **"Deal Status"**
- Style: ~18pt bold/heavy, color #2A3A4A (dark navy-gray), left-aligned
- Top padding: ~20 pt below nav bar
- Left margin: ~20 pt

### 2. Segmented control (Deal Status)
- Container: rounded pill shape (~12 pt radius), full width minus ~16 pt horizontal margins, background #E2E5EA (light gray pill container)
- Height: ~40 pt
- Three segments side by side:

| Segment | Label | State | Visual |
|---|---|---|---|
| 1 | **Current** | SELECTED | White rounded rectangle inset pill, black text ~15pt semibold |
| 2 | **Archived** | unselected | No background, medium gray text ~15pt regular |
| 3 | **All** | unselected | No background, medium gray text ~15pt regular — separated from "Archived" by a 1pt vertical hairline divider #C8CDD4 |

- A 1 pt vertical hairline divider appears between "Archived" and "All" segments only (not between "Current" and "Archived", because "Current" pill occupies left segment).
- Tapping any segment immediately updates the deals filter.

### 3. Scope label
- Text: **"Showing deals for: Everyone"**
- Style: ~18pt bold/heavy, color #2A3A4A, left-aligned
- "Everyone" is part of the bold string (no separate color accent)
- Top margin: ~18 pt below segmented control
- Left margin: ~20 pt
- This label updates dynamically when a different agent row is tapped.

### 4. Search field
- Placeholder text: **"Search"** — medium gray ~#9AABB8, ~16pt regular
- Leading icon: magnifying glass glyph, gray ~#9AABB8, ~16pt
- Background: transparent / same as content bg #EEF1F4 (no card/border, flush inline)
- No border or card outline; appears as bare inline search row
- Keyboard: search type [INFERRED]
- Filters the agent list below as user types

### 5. Hairline full-width divider
- 1 pt, color ~#D0D5DC, full bleed edge-to-edge
- Separates the filter header zone from the scrollable picker list

### 6. Scrollable agent list

The list is a single-column picker. Each row:
- **Height:** ~80 pt
- **Avatar:** 48 pt circle, left-aligned, left margin ~20 pt
- **Label:** agent name, ~18pt regular, color #3A4A5C (medium dark navy-gray), left of center, vertically centered beside avatar
- **No right-side chevron or checkmark visible** on any row
- **Row divider:** 1 pt full-bleed horizontal hairline #D0D5DC between each row
- **Tap action:** selects this agent as the filter scope, updates "Showing deals for:" label, and presumably dismisses the modal [INFERRED]
- **No swipe actions** [INFERRED]

**Row 1 — Everyone**
- Avatar: 48 pt solid dark olive-green circle (~#3D6148), white uppercase letter **"E"** centered, ~22pt bold — this is a generated initial avatar, NOT a photo
- Label: **"Everyone"**

**Row 2 — Me**
- Avatar: 48 pt circle, cropped headshot photo of Matt Ryan (bald, smiling, light blue shirt)
- Label: **"Me"**

**Section header — TEAM MEMBERS**
- Text: **"TEAM MEMBERS"** — all caps, ~12pt semibold, muted blue-gray ~#8A9BB0, left-aligned, left margin ~20 pt
- Background: same #EEF1F4 (no distinct section header background tint)
- Full-width 1 pt hairline divider below the label

**Row 3 — Matt Ryan**
- Avatar: 48 pt circle, cropped headshot photo of Matt Ryan (bald, smiling, light blue/white check shirt) — identical photo to "Me" row
- Label: **"Matt Ryan"**

**Row 4 — Paul Stevenson**
- Avatar: 48 pt circle, cropped headshot photo — man wearing flat-brim baseball cap (dark), glasses, dark navy/black top
- Label: **"Paul Stevenson"**

**Row 5 — Rebecca Peterson**
- Avatar: 48 pt circle, cropped headshot photo — woman with long dark wavy hair, dark sleeveless top, warm background
- Label: **"Rebecca Peterson"**

**Empty area:** after Rebecca Peterson's row, the list ends with ~94 pt of empty #EEF1F4 space to bottom of viewport. No "no results" state. No pagination.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Status bar bg | #000000 |
| Nav/header bg | #2C4A56 (dark teal-slate, FUB brand) |
| Nav text (Cancel, title) | #FFFFFF |
| Content bg | #EEF1F4 (cool light blue-gray) |
| Section headers ("Deal Status", "Showing deals for: Everyone") | #2A3A4A, ~18pt bold |
| Segmented control container | #E2E5EA |
| Selected segment pill | #FFFFFF |
| Selected segment text | #0D0D0D, ~15pt semibold |
| Unselected segment text | #7A8A9A, ~15pt regular |
| Segment vertical hairline | #C8CDD4 |
| Search icon + placeholder | #9AABB8 |
| Row name text | #3A4A5C, ~18pt regular |
| "TEAM MEMBERS" section label | #8A9BB0, ~12pt semibold, ALL CAPS, letter-spacing ~0.08em |
| Row dividers | #D0D5DC, 1 pt full-bleed |
| "Everyone" avatar bg | #3D6148 (dark forest/olive green) |
| "Everyone" initial letter | #FFFFFF, ~22pt bold |
| Broker avatar | 48 pt circle crop, real headshot photo |
| Accent / active color | FUB teal — not visible in selection state on this screen; nav header is #2C4A56 |

No navy #102742 or cream #faf8f4 (those are the in-house CRM tokens). This is unambiguously the FUB native app.

---

## Interactions & gestures

- **Tap "Cancel"** — dismisses modal, returns to Deals list with no filter change [INFERRED]
- **Tap a segmented control segment** — immediately switches Deal Status filter (Current / Archived / All); label below may update [INFERRED]
- **Type in Search field** — live-filters the agent rows below by name [INFERRED]
- **Tap any agent row (Everyone / Me / Matt Ryan / Paul Stevenson / Rebecca Peterson)** — applies that agent scope, updates "Showing deals for: <Name>", dismisses modal [INFERRED]
- **Pull-to-refresh** — not applicable (this is a picker, not a live feed) [INFERRED]
- **Scroll** — list is scrollable if more agents exist below current viewport; 5 rows visible, ~80 pt each [INFERRED]
- **No long-press** context action observed or inferred
- **No swipe-to-delete / swipe actions** on picker rows
- **Modal presented as:** full-screen push (or form sheet from bottom) — the status bar behind it is black, suggesting a full-screen cover rather than a card sheet

---

## Build notes (component tree)

```
<MobileShell statusBarStyle="light-content" statusBarBg="#000">

  {/* Full-screen modal — presented over Deals list */}
  <FilterDealsModal>

    <TopBar
      bg="#2C4A56"
      leftControl={<TextButton label="Cancel" color="#FFF" onPress={onDismiss} />}
      title="Filter Deals"
      titleColor="#FFF"
      titleWeight="600"
      rightControl={null}
    />

    {/* Scrollable filter content */}
    <ScrollView bg="#EEF1F4" contentPaddingTop={20}>

      {/* Deal Status segmented control section */}
      <SectionBlock paddingH={20} paddingBottom={20}>
        <SectionTitle text="Deal Status" size={18} weight="700" color="#2A3A4A" marginBottom={12} />
        <SegmentedControl
          options={["Current", "Archived", "All"]}
          selected={dealStatus}          // "Current" | "Archived" | "All"
          onChange={setDealStatus}
          containerBg="#E2E5EA"
          containerRadius={12}
          containerHeight={40}
          activePillBg="#FFFFFF"
          activePillRadius={10}
          activeTextColor="#0D0D0D"
          activeTextWeight="600"
          inactiveTextColor="#7A8A9A"
          inactiveTextWeight="400"
          fontSize={15}
          hasDividerBetween={[1, 2]}     // divider between Archived and All only
          dividerColor="#C8CDD4"
        />
      </SectionBlock>

      {/* Agent scope indicator */}
      <SectionBlock paddingH={20} paddingBottom={12}>
        <SectionTitle
          text={`Showing deals for: ${selectedAgentName}`}
          size={18}
          weight="700"
          color="#2A3A4A"
          marginBottom={12}
        />
        {/* Inline search — no card border */}
        <SearchField
          placeholder="Search"
          placeholderColor="#9AABB8"
          iconColor="#9AABB8"
          bg="transparent"
          fontSize={16}
          value={agentSearch}
          onChange={setAgentSearch}
        />
      </SectionBlock>

      {/* Full-bleed hairline divider */}
      <Divider color="#D0D5DC" thickness={1} fullBleed />

      {/* "Everyone" row */}
      <AgentPickerRow
        avatar={<InitialAvatar letter="E" bg="#3D6148" textColor="#FFF" size={48} fontSize={22} />}
        label="Everyone"
        onPress={() => selectAgent("everyone")}
        height={80}
        paddingH={20}
        textColor="#3A4A5C"
        fontSize={18}
        dividerBelow
        dividerColor="#D0D5DC"
      />

      {/* "Me" row */}
      <AgentPickerRow
        avatar={<PhotoAvatar src={currentUserPhotoUrl} size={48} />}
        label="Me"
        onPress={() => selectAgent("me")}
        height={80}
        paddingH={20}
        textColor="#3A4A5C"
        fontSize={18}
        dividerBelow
        dividerColor="#D0D5DC"
      />

      {/* TEAM MEMBERS section header */}
      <ListSectionHeader
        label="TEAM MEMBERS"
        labelColor="#8A9BB0"
        fontSize={12}
        fontWeight="600"
        letterSpacing={0.08}
        paddingH={20}
        paddingV={8}
        bg="#EEF1F4"
        dividerBelow
        dividerColor="#D0D5DC"
      />

      {/* Matt Ryan row */}
      <AgentPickerRow
        avatar={<PhotoAvatar src="/images/brokers/ryan-matt.png" size={48} />}
        label="Matt Ryan"
        onPress={() => selectAgent("matt-ryan")}
        height={80}
        paddingH={20}
        textColor="#3A4A5C"
        fontSize={18}
        dividerBelow
        dividerColor="#D0D5DC"
      />

      {/* Paul Stevenson row */}
      <AgentPickerRow
        avatar={<PhotoAvatar src="/images/brokers/stevenson-paul.png" size={48} />}
        label="Paul Stevenson"
        onPress={() => selectAgent("paul-stevenson")}
        height={80}
        paddingH={20}
        textColor="#3A4A5C"
        fontSize={18}
        dividerBelow
        dividerColor="#D0D5DC"
      />

      {/* Rebecca Peterson row */}
      <AgentPickerRow
        avatar={<PhotoAvatar src="/images/brokers/peterson-rebecca.png" size={48} />}
        label="Rebecca Peterson"
        onPress={() => selectAgent("rebecca-peterson")}
        height={80}
        paddingH={20}
        textColor="#3A4A5C"
        fontSize={18}
        dividerBelow={false}
      />

    </ScrollView>
  </FilterDealsModal>

</MobileShell>
```

### Data bindings
- `dealStatus: "Current" | "Archived" | "All"` — maps to FUB deals API `status` param
- `selectedAgentId: "everyone" | "me" | <userId>` — maps to FUB deals API `assignedUserId` param
- `selectedAgentName: string` — display name in the "Showing deals for: X" label
- `agentSearch: string` — client-side filter applied to the rendered agent rows
- `brokers[]` — fetched from `/api/admin/brokers` or from FUB `/v1/users`; photo URLs from `public.brokers` table (`photo_url` column)

### Key spacing notes
- Horizontal content padding: 20 pt
- Row height: ~80 pt (avatar 48 pt + 16 pt top/bottom padding)
- Avatar left offset: 20 pt; label left offset: 20 + 48 + 14 = 82 pt from screen edge
- Segmented control margin: 16 pt horizontal from content padding edge
- Section title to segmented control gap: ~12 pt
- No right-side chevron, no checkmark, no badge on any picker row

### Web rebuild notes
- Implement as a `<Dialog>` (full-screen on mobile, max-w-sm centered on desktop) from `@/components/ui/dialog`
- Use `<Tabs>` from `@/components/ui/tabs` for the Deal Status segmented control, styled to match the pill appearance
- Use `<Input>` from `@/components/ui/input` for the search field with leading `Search` icon
- Avatar: `<Avatar>` from `@/components/ui/avatar`; fallback to `<AvatarFallback>` with green bg + "E" initial for "Everyone"
- List rows: plain `<button>` elements styled as full-width flex rows — no `<Table>`, no `<Card>` per component mapping rules
- The "TEAM MEMBERS" section header uses `text-muted-foreground` token
- Apply `font-variant-numeric: tabular-nums` to any numeric UI (not present here but standard across CRM)

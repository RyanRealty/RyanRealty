<!-- Mobile per-screen appendix. Original: IMG_5830.PNG | id: mob-10 | tiles: mob-tiles/mob-10_{full,t,m,b}.png -->

# mob-10 — fub-ios — All Recent Online Activity (Smart List)

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app (dark steel-teal header, initials-avatar rows, no Safari chrome, no browser URL bar)
- **module:** Smart Lists / Filters (a filtered People list, navigated into from the People tab or a Smart Lists index)
- **screen:** "All Recent Online Activity" — a FUB Smart List showing every contact who has visited Ryan-Realty.com recently, filtered to "Everyone" (all agents). This is one of FUB's built-in behavioral smart lists.
- **How to reach:** People tab → Smart Lists section → tap "All Recent Online Activity" row; OR Activity tab → tap a smart-list shortcut. The presence of a back-chevron (←) confirms this is a pushed secondary screen, not a root tab.
- **iOS status bar:** 4:33 (time, left), signal bars (2 of 4 filled), Wi-Fi icon, "100" battery with charging bolt (right)
- **URL bar:** N/A — native app, no browser chrome

---

## Screen regions (y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark steel-teal ~`#3C4F5C` (inherited from header) |
| Nav / header bar | 54–108 | 54 pt | Dark steel-teal ~`#3C4F5C` |
| Count bar ("8 people") | 108–132 | 24 pt | Very light blue-gray ~`#EEF1F4` |
| Scrollable list (8 rows) | 132–844+ | fills remainder | White `#FFFFFF` |
| Bottom tab bar | NOT VISIBLE | — | Pushed navigation stack hides root tab bar |

---

## Nav / header bar (exact)

- **Left control:** Back chevron `‹` — plain white/light gray chevron glyph, ~20 pt hit area. Taps to pop back to the parent smart-lists index or People tab root.
- **Center — title line:** Laptop emoji icon (🖥 or 💻, small ~18 pt, left of text) followed by bold white text **"All Recent Online Activity"** (~17–18 pt semibold, white `#FFFFFF`).
- **Center — subtitle / filter line:** Gray text **"Everyone"** followed by a downward chevron `∨` (~13 pt, muted white-gray ~`#A8B8C4`). This is an agent/broker filter picker — tapping it opens a sheet to filter by individual broker vs. "Everyone".
- **Right control:** Search icon — magnifying glass glyph (~22 pt), white. Taps to open an inline search/filter bar within this list.
- **No additional right controls** (no bell, no kebab, no Edit/Select).

---

## Bottom tab bar

**Not rendered** — this is a pushed (drilled-in) navigation screen. The FUB root tab bar (Inbox / Activity / — / People / Deals) is hidden under the navigation stack. No FAB (+) visible.

---

## Content — every element in order

### Count bar
- Full-width pill/band directly below nav bar
- Background: light blue-gray ~`#EEF1F4`, height ~24 pt
- Text: **"8 people"** — left-aligned, ~13 pt, muted medium-gray ~`#6B7F8C`
- No controls; purely informational

### Contact list (scrollable, 8 rows visible, list appears complete at 8)

Row anatomy (per row):
- **Left avatar:** Circle, ~44 pt diameter, 12 pt from left edge. Either an initials circle (auto-colored) or a real profile photo (circular crop). 
- **Primary text:** Contact full name — ~17 pt, dark near-black ~`#1C2B36`, medium-weight, 12 pt left of avatar right edge.
- **Secondary text:** Lead source URL — ~13 pt, muted gray ~`#8FA3AE`, same left alignment as primary.
- **Right trailing:** Single gray chevron `›` (~12 pt, light gray ~`#C5CDD2`), vertically centered, ~16 pt from right edge.
- **Divider:** 1 px horizontal line full width, light gray ~`#E4E9EC`, at bottom of each row (inset from left ~68 pt, aligned after avatar).
- **Row height:** ~72 pt per row.
- **Tap behavior:** Taps entire row → pushes Contact Detail / Lead Profile screen for that person.
- **Swipe actions:** [INFERRED] Likely reveal left/right swipe actions (e.g., swipe-left for quick actions like "Add Task," "Send Email"; standard FUB pattern).

**Row-by-row data (verbatim):**

| # | Avatar | Name | Source |
|---|---|---|---|
| 1 | Initials "MR", purple-periwinkle circle ~`#6B6EB8` | **Matthew Ryan** | Ryan-Realty.com |
| 2 | Initials "MR", purple-periwinkle circle ~`#6B6EB8` | **Matt Ryan** | Ryan-Realty.com |
| 3 | Initials "TW", red/coral circle ~`#D93030` | **Theresa Wise** | Ryan-Realty.com |
| 4 | Initial "S", olive/army-green circle ~`#7A7A00` | **Scdvf** | Ryan-Realty.com |
| 5 | Real headshot photo (circular) — dark suit, professional male | **Derek Winchell** | Ryan-Realty.com |
| 6 | Real image (circular) — appears to be a logo/brand image, text "RIVER TO THE SEA" with ocean wave graphic | **Tide Rivers** | Ryan-Realty.com |
| 7 | Initials "LM", medium-gray circle ~`#6B7280` | **Laurie McAdam** | Ryan-Realty.com |
| 8 | Real headshot photo (circular) — casual, light-colored shirt, bearded male | **Matt Ryan** | Ryan-Realty.com |

**Notes on data:**
- All 8 contacts share the same source "Ryan-Realty.com" — this is the website visit trigger that placed them in this smart list.
- No date/time column is shown (unlike FUB's Activity feed which shows timestamps). This list shows WHO has been active, not WHEN.
- No status badges, stage pills, or assigned-agent chips are shown per row.
- "Scdvf" appears to be a test/garbage contact that made it into production.
- Three entries named "Matt Ryan" (rows 1, 2, 8) — likely duplicate contacts or the broker's own browsing sessions being tracked.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar bg | Dark steel-teal ~`#3C4F5C` (FUB's characteristic header — not the in-house navy `#102742`) |
| Header title text | White `#FFFFFF`, ~17–18 pt, SF Pro semibold |
| Header subtitle filter | Muted white-gray ~`#A8B8C4`, ~13 pt, SF Pro regular |
| Count bar bg | Light blue-gray ~`#EEF1F4` |
| Count bar text | Medium gray ~`#6B7F8C`, ~13 pt |
| Row primary text | Near-black ~`#1C2B36`, ~17 pt, SF Pro regular/medium |
| Row secondary text (source) | Muted gray ~`#8FA3AE`, ~13 pt, SF Pro regular |
| Row chevron | Light gray ~`#C5CDD2` |
| Row divider | Light gray ~`#E4E9EC`, 1 px |
| Row bg | White `#FFFFFF` |
| Avatar — initials MR (×2) | Purple-periwinkle ~`#6B6EB8` |
| Avatar — initials TW | Red/coral ~`#D93030` |
| Avatar — initial S | Olive/army-green ~`#7A7A00` |
| Avatar — initials LM | Medium gray ~`#6B7280` |
| Avatar — photo rows | Circular crop of actual image |
| Back chevron icon | White `#FFFFFF`, ~16 pt SF Symbol `chevron.left` |
| Search icon | White `#FFFFFF`, ~20 pt SF Symbol `magnifyingglass` |
| Filter chevron (▾) | Same muted gray as subtitle, ~10 pt |

---

## Interactions & gestures

- **Tap row** → pushes Contact Detail / Lead Profile screen for that person [STANDARD FUB]
- **Tap back chevron (←)** → pops back to parent (Smart Lists index or People tab root)
- **Tap "Everyone ▾"** → presents an agent-filter action sheet or picker; options are "Everyone" plus individual broker names (Matt Ryan, Paul Stevenson, Rebecca Peterson); selecting one filters the list to only that agent's assigned contacts [INFERRED from standard FUB pattern]
- **Tap search icon (🔍)** → reveals inline search bar below nav bar; keyboard raises; type to filter contact names in real time [INFERRED]
- **Pull to refresh** → reloads the smart list with fresh website-activity data [INFERRED]
- **Swipe left on row** → reveals quick-action buttons (typical FUB: Phone, Text, Email, or custom actions) [INFERRED]
- **Long-press row** → may reveal context menu for bulk-select [INFERRED]

---

## Build notes (component tree)

```
<MobileShell bg="#FFFFFF">

  {/* iOS status bar — rendered by OS, mimic with a fixed div */}
  <StatusBar
    time="4:33"
    signal={2}
    wifi={true}
    battery={100}
    charging={true}
    bg="#3C4F5C"
    textColor="#FFFFFF"
    height={54}
  />

  {/* Navigation / header bar */}
  <TopBar
    bg="#3C4F5C"
    height={54}
    left={<BackChevron color="#FFFFFF" onTap={navigateBack} />}
    center={
      <TopBarCenter>
        <Row gap={6}>
          <Emoji>💻</Emoji>  {/* laptop emoji ~18pt */}
          <Text style="semibold 17pt #FFFFFF">All Recent Online Activity</Text>
        </Row>
        <AgentFilterPill
          label="Everyone"
          trailingChevron
          color="#A8B8C4"
          fontSize={13}
          onTap={openAgentFilterSheet}
        />
      </TopBarCenter>
    }
    right={<SearchIcon color="#FFFFFF" size={22} onTap={openSearch} />}
  />

  {/* Count bar */}
  <CountBar
    bg="#EEF1F4"
    height={24}
    paddingLeft={16}
    text="8 people"
    textStyle="13pt #6B7F8C"
  />

  {/* Scrollable contact list */}
  <ScrollView>
    <ContactList>
      {contacts.map(contact => (
        <ContactRow
          key={contact.id}
          height={72}
          onTap={() => navigateTo(`/contacts/${contact.id}`)}
          dividerInset={68}      /* divider starts after avatar */
        >
          <Avatar
            size={44}
            shape="circle"
            initials={contact.initials}      /* e.g. "MR", "TW", "LM" */
            bgColor={contact.avatarColor}    /* auto-assigned by FUB from name hash */
            photoUrl={contact.photoUrl}      /* overrides initials if present */
          />
          <ContactRowText>
            <PrimaryText style="17pt #1C2B36 medium">{contact.fullName}</PrimaryText>
            <SecondaryText style="13pt #8FA3AE">{contact.source}</SecondaryText>
            {/* source = "Ryan-Realty.com" for all rows in this list */}
          </ContactRowText>
          <TrailingChevron color="#C5CDD2" size={12} />
        </ContactRow>
      ))}
    </ContactList>
  </ScrollView>

</MobileShell>
```

### Data bindings
- `contacts[]` — fetched from FUB smart list API: `GET /api/v1/people?smartListId=<online-activity-id>&assignedTo=everyone&sort=recentActivity`
- Each contact: `{ id, firstName, lastName, initials, avatarColor, photoUrl, source }` where source is the referring website domain tracked by FUB pixel.
- `contact.avatarColor` — FUB auto-assigns a color from a fixed palette based on name hash. Palette observed: purple-periwinkle `#6B6EB8`, red `#D93030`, olive `#7A7A00`, gray `#6B7280`.

### Spacing / sizing (pt, logical screen 390 wide)
- Avatar left margin: 16 pt
- Gap between avatar right edge and text left: 12 pt
- Text block right padding (before chevron): 16 pt
- Row height: 72 pt (avatar 44 pt + 14 pt vertical padding top + bottom)
- Divider: 1 px at y = row-bottom, inset-left = avatar-left (16) + avatar-width (44) + gap (8) = 68 pt
- Count bar height: 24 pt, text left-pad 16 pt

### Agent-filter sheet (tapping "Everyone ▾") [INFERRED]
- Modal sheet from bottom
- Options: "Everyone", "Matt Ryan", "Paul Stevenson", "Rebecca Peterson"
- Selected option has a teal checkmark
- Cancel button at bottom

### No FAB, no tab bar on this screen
- This is a second-level pushed screen; the root tab bar (Inbox / Activity / — / People / Deals) is hidden under the navigation stack and does not appear.

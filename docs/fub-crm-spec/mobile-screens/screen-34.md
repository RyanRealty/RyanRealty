<!-- Mobile per-screen appendix. Original: IMG_5998.PNG | id: mob-34 | tiles: mob-tiles/mob-34_{full,t,m,b}.png -->

# mob-34 — fub-ios — Assign To Picker (Lead Re-assignment Sheet)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Picker / Modal / Action sheet
- **screen:** "Assign To" full-screen modal picker — reassigns a lead/contact to a different agent, pond, or group
- **how to reach:** Tapping the "Assign To" action on a contact/lead detail screen or from a bulk-action toolbar; slides up as a full-screen modal (not a half-sheet)
- **iOS status bar:** 8:44 · signal 2/4 bars · WiFi · battery 36% (outlined, not charging) — all white/light on dark header
- **URL:** N/A (native iOS app)

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical screen)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | Dark teal/navy ~#1B3A4A (matches header) |
| Nav / header bar | 54–100 | 46 | Dark teal/navy ~#1B3A4A |
| "Currently:" label row | 100–136 | 36 | Light gray ~#F2F2F7 |
| Search bar | 136–180 | 44 | Light gray ~#F2F2F7 (search field is white ~#FFFFFF with rounded rect) |
| Scrollable list content | 180–844 | 664 | Light gray ~#F2F2F7 (section headers slightly darker; rows white/near-white) |
| Bottom tab bar | none visible | — | Not present (full-screen modal covers it) |
| Right-edge pull tab | ~y 380–440 | 60 | Mid-gray ~#8E8E93, rounded left corners — a floating collapse/expand handle |

---

## Nav / header bar (exact)

- **Left control:** Text button — "Cancel" — white, ~15pt, regular weight. Tapping dismisses the modal without saving.
- **Center title:** "Assign To" — white, ~17pt, semibold. No subtitle. No filter chevron.
- **Right controls:** None visible.

---

## Bottom tab bar (exact)

Not present — this is a full-screen modal overlaying the main tab interface. The bottom tab bar (Inbox / Activity / Calendar / People / Deals) is hidden beneath the sheet. No FAB visible.

---

## Content — every element, in order

### 1. "Currently:" label (y ~100–136)
- Background: light gray ~#F2F2F7, no divider above
- Text: **"Currently: Matt Ryan"** — bold (~600 weight), dark charcoal ~#1C1C1E, ~15pt
- Left padding: ~16pt; no right content; full-width row

### 2. Search bar (y ~136–180)
- Rounded rectangle input field, white background, ~10pt corner radius
- Left icon: magnifying glass glyph, gray ~#8E8E93
- Placeholder text: "Search" — gray ~#8E8E93, ~16pt regular
- Horizontally inset ~16pt from edges; height ~36pt

### 3. "Me" row (no section header — top of list, y ~180–240)
- Left: circular headshot photo avatar, ~40pt diameter — Matt Ryan's actual headshot (older bald man in light blue dress shirt)
- Primary text: "Me" — dark charcoal ~#1C1C1E, ~16pt regular
- No secondary text
- No right chevron visible
- Bottom divider: 1pt hairline, light gray ~#E5E5EA
- Tapping assigns the lead to the currently logged-in user (Matt Ryan)

### 4. Section header: PONDS (y ~240–268)
- Background: light gray ~#F2F2F7 (same as page background, slightly recessed)
- Text: "PONDS" — all caps, ~12pt, gray ~#8E8E93, semibold/medium weight
- Left padding: ~16pt
- Height: ~28pt
- Top + bottom hairline dividers

#### 4a. "Out Of State Home Owners" row (y ~268–330)
- Left: circular initials avatar, ~40pt diameter, background color: muted brownish-mauve/rose ~#A07070, white initials "OO"
- Primary text: "Out Of State Home Owners" — dark charcoal, ~16pt regular
- No secondary text
- No right chevron
- Bottom divider: hairline

### 5. Section header: GROUPS (y ~330–358)
- Same styling as PONDS header
- Text: "GROUPS"

#### 5a. "Seller Leads" row (y ~358–430)
- Left: circular initials avatar, ~40pt, background: olive/army green ~#6B7C3A, white initials "SL"
- Primary text: "Seller Leads" — dark charcoal, ~16pt regular
- Secondary text: "Round Robin" — gray ~#8E8E93, ~13pt regular, below primary
- No right chevron
- Bottom divider: hairline

#### 5b. "Team Ryan" row (y ~430–502)
- Left: circular initials avatar, ~40pt, background: red/crimson ~#C0392B, white initials "TR"
- Primary text: "Team Ryan" — dark charcoal, ~16pt regular
- Secondary text: "Round Robin" — gray ~#8E8E93, ~13pt regular
- No right chevron
- Bottom divider: hairline

### 6. Section header: TEAM MEMBERS (y ~502–530)
- Same styling as other section headers
- Text: "TEAM MEMBERS"

#### 6a. "Matt Ryan" row (y ~530–610)
- Left: circular headshot photo avatar, ~40pt — same Matt Ryan photo as "Me" row
- Primary text: "Matt Ryan" — dark charcoal, ~16pt regular
- No secondary text; no chevron
- Bottom divider: hairline

#### 6b. "Paul Stevenson" row (y ~610–690)
- Left: circular headshot photo avatar, ~40pt — Paul Stevenson (man wearing dark flat-cap/beanie, glasses, dark shirt)
- Primary text: "Paul Stevenson" — dark charcoal, ~16pt regular
- No secondary text; no chevron
- Bottom divider: hairline

#### 6c. "Rebecca Peterson" row (y ~690–770, partially visible at bottom)
- Left: circular headshot photo avatar, ~40pt — Rebecca Peterson (woman with long dark hair, smiling)
- Primary text: "Rebecca Peterson" — dark charcoal, ~16pt regular
- Row clips at screen bottom; more content may exist below the visible area

### 7. Right-edge pull handle (y ~380–440)
- Floating gray rounded-rect tab (~28pt wide × 60pt tall) anchored to right edge of screen
- Color: mid-gray ~#8E8E93 with rounded left corners
- Contains a left-pointing chevron "‹" in white/light
- [INFERRED] This is a FUB-native side-panel or "collapse panel" affordance — likely collapses an adjacent panel or is a visual artifact of a split-view being displayed in portrait mode

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar bg | Dark teal-navy ~#1B3A4A (FUB brand color) |
| Header text (Cancel, title) | White #FFFFFF |
| Page / list bg | System light gray ~#F2F2F7 |
| Row bg | White ~#FFFFFF or very near-white |
| Primary row text | Dark charcoal ~#1C1C1E |
| Secondary row text (Round Robin) | Gray ~#8E8E93 |
| Section header text | Gray ~#8E8E93, all-caps, ~12pt medium |
| Row dividers | Hairline 1pt ~#E5E5EA |
| "Currently:" text | Bold ~#1C1C1E |
| Search placeholder | Gray ~#8E8E93 |
| Avatar — OO (Out of State) | Brownish-mauve ~#A07070 |
| Avatar — SL (Seller Leads) | Olive green ~#6B7C3A |
| Avatar — TR (Team Ryan) | Crimson red ~#C0392B |
| Avatar — headshots | Circular crop, actual photo, white border ~1pt |
| Right-edge handle | Mid-gray ~#8E8E93 |
| FUB accent (active/highlight) | Not visible on this screen — typically teal ~#0A7EA4 |
| Font weight impressions | "Currently:" = 600; section headers = 500 caps; row primary = 400; secondary = 400 |

---

## Interactions & gestures (mark [INFERRED])

- **Tap "Cancel"** — dismisses modal, returns to previous screen with no change to assignment
- **Tap any row** — immediately assigns the lead to that person / pond / group and dismisses the modal [INFERRED: no "Save" button; selection is instant]
- **Type in Search** — filters all items (Me, ponds, groups, team members) in real time [INFERRED]
- **Scroll down** — reveals more TEAM MEMBERS if list continues below Rebecca Peterson [INFERRED]
- **Tap right-edge pull handle** — [INFERRED] may collapse/expand a side panel; likely a FUB portrait-mode split-view artifact; tapping the ‹ chevron may dismiss a peeking right panel
- **Swipe down** — [INFERRED] may dismiss modal (standard iOS modal dismiss gesture)
- **Pull-to-refresh** — unlikely on this picker type [INFERRED: not applicable]

---

## Build notes (component tree)

```
<MobileShell fullScreenModal>

  <IOSStatusBar
    time="8:44"
    signal={2}
    wifi={true}
    battery={36}
    style="light-content"          /* white text on dark bg */
    bgColor="#1B3A4A"
  />

  <AssignToHeader>
    <CancelButton onPress={dismissModal} />          /* left, text "Cancel", white */
    <ModalTitle>Assign To</ModalTitle>               /* center, white semibold */
    {/* no right control */}
  </AssignToHeader>

  <CurrentAssigneeBanner>
    {/* "Currently: Matt Ryan" — full-width, bold, #1C1C1E, h=36pt, px-16 */}
  </CurrentAssigneeBanner>

  <SearchBar
    placeholder="Search"
    icon="magnifier"
    onChangeText={filterList}
    bgColor="#FFFFFF"
    cornerRadius={10}
  />

  <ScrollView contentInsetAdjustmentBehavior="automatic">

    {/* ── Unheadered "Me" shortcut ── */}
    <AssigneeRow
      avatarType="photo"
      avatarSrc={currentUser.photoUrl}
      label="Me"
      onPress={() => assign(currentUser)}
    />

    {/* ── PONDS section ── */}
    <SectionHeader label="PONDS" />
    {ponds.map(pond => (
      <AssigneeRow
        key={pond.id}
        avatarType="initials"
        initials={pond.initials}          /* e.g. "OO" */
        avatarBg={pond.color}             /* e.g. #A07070 */
        label={pond.name}                 /* "Out Of State Home Owners" */
        onPress={() => assign(pond)}
      />
    ))}

    {/* ── GROUPS section ── */}
    <SectionHeader label="GROUPS" />
    {groups.map(group => (
      <AssigneeRow
        key={group.id}
        avatarType="initials"
        initials={group.initials}         /* "SL", "TR" */
        avatarBg={group.color}            /* #6B7C3A, #C0392B */
        label={group.name}                /* "Seller Leads", "Team Ryan" */
        sublabel={group.assignmentType}   /* "Round Robin" */
        onPress={() => assign(group)}
      />
    ))}

    {/* ── TEAM MEMBERS section ── */}
    <SectionHeader label="TEAM MEMBERS" />
    {teamMembers.map(member => (
      <AssigneeRow
        key={member.id}
        avatarType="photo"
        avatarSrc={member.photoUrl}
        label={member.fullName}           /* "Matt Ryan", "Paul Stevenson", "Rebecca Peterson" */
        onPress={() => assign(member)}
      />
    ))}

  </ScrollView>

  {/* Right-edge panel handle — only shown when a side panel is partially open */}
  <RightEdgePullHandle
    icon="chevronLeft"
    bgColor="#8E8E93"
    position="absolute right-0 top-[380pt]"
    onPress={toggleSidePanel}
  />

</MobileShell>
```

### Data bindings
- `currentUser` — logged-in agent object with `photoUrl`, `id`, `fullName`
- `ponds[]` — FUB pond objects: `{ id, name, initials, color }`
- `groups[]` — FUB group objects: `{ id, name, initials, color, assignmentType: "Round Robin" | "..." }`
- `teamMembers[]` — FUB broker/agent objects: `{ id, fullName, photoUrl }`
- `assign(target)` — API call to `PATCH /v1/people/{personId}` setting `assignedUserId` or `pondId`; then dismisses modal

### Spacing / sizing notes
- Avatar diameter: 40pt (80px @2x)
- Row height: ~60–70pt for rows with two lines (label + sublabel); ~60pt for single-line rows
- Section header height: ~28pt; left-padded 16pt
- Row horizontal padding: 16pt left (to avatar), 12pt gap avatar-to-text
- Hairline dividers: 0.5pt @1x → 1px @2x, color ~#E5E5EA
- Search bar: height ~36pt, corner radius ~10pt, inset 16pt each side
- "Currently:" banner: height ~36pt, text ~15pt 600-weight
- Header bar height: ~46pt (below safe area top)

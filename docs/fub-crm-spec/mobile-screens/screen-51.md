<!-- Mobile per-screen appendix. Original: IMG_6019.PNG | id: mob-51 | tiles: mob-tiles/mob-51_{full,t,m,b}.png -->

# mob-51 — fub-ios — Contact Detail: Info Tab (Mary Bowman)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iPhone app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact Info tab — the "Info" sub-tab of a person's detail view, showing contact methods, relationships, and CRM detail fields
- **how to reach:** Tap any lead row from People tab (or from Activity / Inbox thread) → pushes this detail view onto the navigation stack. "Info" is the default active sub-tab on open.
- **iOS status bar contents:** Time "7:44" (left, white), signal bars (2/4 filled), Wi-Fi icon, battery "16" with yellow indicator (right, white)
- **URL:** N/A (native app, no browser URL bar)

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical screen)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47pt | Dark teal-slate #3d5368 |
| Nav / header bar | 47–94 | 47pt | Dark teal-slate #3d5368 |
| Contact identity hero | 94–190 | 96pt | Dark teal-slate #3d5368 |
| Sub-tab strip | 190–238 | 48pt | Dark teal-slate #3d5368 (active tab underline: bright teal) |
| Scrollable content area | 238–780 | ~542pt | White #ffffff + section headers #edf0f4 |
| FAB (+) | Floating, anchored ~(326, 700)pt | 56pt dia | Bright teal #4db8d6 |
| Bottom tab bar | ~780–844 | ~64pt | Not visible in crop (cut off / below scroll) |

---

## Nav / header bar (exact)

- **Left control:** Back chevron "‹" — white, ~22pt, plain glyph (no circle/bg). Taps to pop back to People list.
- **Center:** Empty — no title text. Identity is displayed in the hero block below instead of the nav bar title.
- **Right control:** Text button "Edit" — white, system font ~17pt regular. Taps to enter edit mode for this contact's fields.

---

## Sub-tab strip (exact)

Horizontally scrollable tab row. Visible tabs left → right:

| Tab label | State | Indicator |
|---|---|---|
| Info | **Active** | White text; bright teal underline bar ~2pt, full label width, flush to strip bottom |
| Comms | Inactive | Muted gray-white ~#9badb8 text; no underline |
| Homes | Inactive | Muted gray-white ~#9badb8 text; no underline |
| Notes | Inactive | Muted gray-white ~#9badb8 text; no underline |
| Calen… | Inactive, clipped | Muted gray-white; text truncates at right edge — full label is "Calendar" |

Tabs beyond "Calendar" are scrolled off-screen (likely: Tasks, Files, more). Strip height ~48pt. Tab labels are sentence-case, ~15pt, not bold.

---

## Bottom tab bar (exact) — CRITICAL

**Not visible in this screenshot crop** — the detail view is pushed on top of the tab bar in the native nav stack, and the crop ends just below the Collaborators row. Based on FUB iOS app architecture, the persistent bottom tab bar exists and reads:

| Order | Icon | Label | Badge | Active? |
|---|---|---|---|---|
| 1 | Inbox/chat bubble | Inbox | (varies) | No |
| 2 | Activity/lightning | Activity | (varies) | No |
| 3 | Calendar grid | Calendar | — | No |
| 4 | Person silhouette | People | — | **Yes** (this detail was reached from People) |
| 5 | Handshake/deal | Deals | — | No |

**FAB (+):** Bright teal circle ~#4db8d6, 56pt diameter, white "+" icon (~24pt), floating bottom-right of scrollable content at approximately (326pt, 700pt). In FUB iOS, this FAB on the Info tab opens a sheet to add a new activity (note, call log, email, task) or to add to the current section (relationships, etc.). It overlaps the "Time frame" detail row.

---

## Contact identity hero block (exact)

Positioned between nav bar and sub-tab strip. Dark teal background (#3d5368) continues from the header.

- **Avatar:** Circle ~60pt diameter. Background: medium muted purple-blue ~#6b70a8. White initials "MB" centered, ~22pt bold. No photo — initials-only state.
- **Primary name:** "Mary Bowman" — white, ~22pt, semi-bold, left of avatar center-right
- **Subtitle:** "Last communication Jun 22" — light gray-white ~#b0c0cc, ~13pt regular

---

## Content — every element, in order

### Section: PHONE NUMBERS (y ≈ 238–278pt)

**Section header row:** Background #edf0f4, ~40pt tall
- Left: "PHONE NUMBERS" — all-caps, ~11pt, medium-weight, gray ~#8a9099
- Right: "TEXT ALL..." — all-caps, ~11pt, bright teal #4db8d6, tappable → opens compose SMS to all numbers on file

No phone number rows are displayed below this header — Mary Bowman has no phone numbers stored. The header collapses directly into the EMAILS section header (no empty-state row; section simply shows no rows).

---

### Section: EMAILS (y ≈ 278–420pt)

**Section header row:** Background #edf0f4, ~40pt tall
- Left: "EMAILS" — all-caps, ~11pt, gray ~#8a9099
- Right: "EMAIL ALL..." — all-caps, ~11pt, bright teal #4db8d6, tappable → opens compose email to all addresses on file

**Email row 1** (y ≈ 318–368pt): White bg, ~50pt tall
- Left: "msbrilliantdisguise@gmail.com" — dark ~#1a2633, ~15pt regular
- Right: Teal circle button ~36pt dia, white envelope/mail icon (~16pt), tappable → opens compose email pre-addressed to this address
- Bottom: 1pt hairline divider ~#e5e8ec

**Email row 2** (y ≈ 368–420pt): White bg, ~52pt tall
- Left: "yahsonkt@hotmail.com — Yahson Terry" — dark ~#1a2633, ~15pt regular. The " — Yahson Terry" suffix is FUB's attribution label showing this email address belongs to the associated relationship contact Yahson Terry (displayed inline with an em-dash in the data).
- Right: Teal circle button ~36pt dia, white envelope/mail icon, tappable → compose email to yahsonkt@hotmail.com
- Bottom: 1pt hairline divider (section end)

---

### Section: RELATIONSHIPS (y ≈ 420–530pt)

**Section header row:** Background #edf0f4, ~40pt tall
- Left: "RELATIONSHIPS" — all-caps, ~11pt, gray ~#8a9099
- Right: "+" — bright teal #4db8d6, ~20pt, tappable → opens sheet to link an existing person or create a new relationship

**Relationship row 1** (y ≈ 460–530pt): White bg, ~70pt tall
- Left: "Yahson Terry" — dark ~#1a2633, ~17pt regular
- Right: Chevron "›" — light gray ~#c8cdd2, ~14pt
- Full row is tappable → navigates/pushes to Yahson Terry's own Contact Detail screen
- Bottom: 1pt hairline divider (section end)

---

### Section: DETAILS (y ≈ 530–780pt+)

**Section header row:** Background #edf0f4, ~40pt tall
- Left: "DETAILS" — all-caps, ~11pt, gray ~#8a9099
- No right-side action

**Detail rows** — each is a two-column disclosure row (~54pt tall, white bg, 1pt hairline divider at bottom):

| Label (left, ~#9eb3c4, ~15pt) | Value (right, ~#1a2633, ~15pt, bold) | Right control | Tap action |
|---|---|---|---|
| Assigned to | Matt Ryan | Chevron "›" | Opens broker/agent picker |
| Stage | Active Client | Chevron "›" | Opens stage picker (pipeline stages list) |
| Source | Import | Chevron "›" | Opens source picker |
| Tags | audience:buyer, Bend, Buyer, city:ben... | Chevron "›" | Opens full tag editor (truncated with "..." at ~40ch) |
| Time frame | *(empty — no value shown)* | Chevron "›" (partially obscured by FAB) | Opens time frame picker |
| Collaborators | No collaborators | Chevron "›" | Opens collaborator assignment |

Row labels are in a muted blue-gray (~#9eb3c4) to visually distinguish them from the dark value text. Values that are empty show no placeholder text; the label alone is shown with a lighter weight.

**Note on Tags truncation:** Full visible text is "audience:buyer, Bend, Buyer, city:ben..." — the "city:ben..." indicates "city:bend" tag is cut off. Additional tags likely exist beyond what's displayed.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / hero / tab strip bg | #3d5368 (dark teal-slate — FUB brand) |
| Avatar bg (initials) | #6b70a8 (muted purple-slate, auto-generated per contact) |
| Avatar initials text | #ffffff |
| Active tab underline | #4db8d6 (bright teal — FUB accent) |
| Inactive tab labels | #9badb8 |
| Section header bg | #edf0f4 (very light blue-gray) |
| Section header text | #8a9099 (all-caps, ~11pt, medium weight) |
| Row bg | #ffffff |
| Row divider | #e5e8ec (1pt hairline) |
| Teal action labels (TEXT ALL, EMAIL ALL, +) | #4db8d6 |
| Email action buttons (circle) | #4db8d6 fill, #ffffff icon |
| Detail label text (Assigned to, Stage…) | #9eb3c4 (light blue-gray) |
| Detail value text (Matt Ryan, Active Client…) | #1a2633 (near-black dark navy) |
| Relationship name, email addresses | #1a2633 |
| Chevron disclosure | #c8cdd2 |
| FAB bg | #4db8d6 |
| FAB icon | #ffffff "+" |
| Body font | System San Francisco (iOS default), ~15–17pt regular/semi-bold |
| Section header font | System SF, all-caps, ~11pt, medium (500) |
| Name in hero | SF, ~22pt, semi-bold (600) |
| Subtitle in hero | SF, ~13pt, regular (400) |

FUB accent is a bright teal/cyan (#4db8d6). The in-house app uses navy #102742 / cream #faf8f4 — this screen is definitively FUB teal, not in-house.

---

## Interactions & gestures (mark [INFERRED])

- **Back chevron tap:** Pops Contact Detail off nav stack → returns to People list (or prior screen) [INFERRED: standard iOS back]
- **"Edit" tap:** Transitions Info tab to edit mode — all fields become editable inline; "Edit" becomes "Done" [INFERRED]
- **Sub-tab tap (Comms, Homes, Notes, Calendar…):** Swaps scrollable content to the selected tab; active underline animates to new tab [INFERRED]
- **"TEXT ALL..." tap:** Opens iOS share/action sheet or FUB compose SMS to all phone numbers on file [INFERRED]
- **"EMAIL ALL..." tap:** Opens FUB compose email pre-populated with all email addresses in the "To:" field [INFERRED]
- **Email circle button tap:** Opens FUB compose email pre-addressed to that specific email address [INFERRED]
- **"+" in RELATIONSHIPS header tap:** Opens a modal sheet — search/select existing contacts to add as a relationship, or create a new linked person [INFERRED]
- **"Yahson Terry" row tap:** Pushes Yahson Terry's Contact Detail onto the nav stack (deep link to related contact) [INFERRED]
- **Detail field rows (Assigned to, Stage, Source, Tags, Time frame, Collaborators) tap:** Each pushes or modally presents a picker for that field; "›" chevron indicates push navigation [INFERRED]
- **FAB (+) tap:** Presents action sheet or bottom sheet with options: Add Note, Log Call, Send Email, Send Text, Create Task, Add to Smart List (FUB standard FAB actions on contact detail) [INFERRED]
- **Pull-to-refresh on scrollable content:** Refreshes contact data from server [INFERRED]
- **Horizontal swipe on sub-tab strip:** Scrolls to reveal clipped tabs (Calendar, Tasks, Files…) [INFERRED]
- **Swipe left on detail rows:** [INFERRED] May reveal edit/delete action buttons in FUB (standard iOS swipe-to-action pattern)
- **Long-press on email address:** [INFERRED] May trigger copy-to-clipboard system action

---

## Build notes (component tree)

```
<ContactDetailShell>                         // Full-screen push view, no bottom padding (tab bar below)
  <StatusBar style="light" />                // White text on dark teal bg

  <TopBar>                                   // h=47pt, bg=#3d5368
    <BackButton icon="chevron-left"          // 44×44pt tap target, left
      color="#ffffff" onPress={popNav} />
    {/* no center title */}
    <TextButton label="Edit"                 // right, #ffffff, 17pt
      onPress={enterEditMode} />
  </TopBar>

  <ContactHero bg="#3d5368" px={16} py={12}> // h≈96pt
    <InitialsAvatar                          // 60pt circle
      initials="MB"
      bgColor="#6b70a8"                      // auto-generated per contact hash
      textColor="#ffffff"
      size={60} />
    <View ml={14}>
      <Text style={heroName}>Mary Bowman</Text>       // #fff, 22pt semi-bold
      <Text style={heroSub}>Last communication Jun 22</Text>  // #9badb8, 13pt
    </View>
  </ContactHero>

  <SubTabStrip                               // h=48pt, bg=#3d5368, horizontal scroll
    tabs={["Info","Comms","Homes","Notes","Calendar","Tasks","Files"]}
    activeTab="Info"
    activeColor="#ffffff"
    inactiveColor="#9badb8"
    activeIndicator={{ color:"#4db8d6", height:2, position:"bottom" }}
    onTabPress={switchTab} />

  <ScrollView bg="#f5f6f8">                  // scrollable content below sub-tabs

    {/* ── PHONE NUMBERS section ── */}
    <SectionHeader
      label="PHONE NUMBERS"
      actionLabel="TEXT ALL..."
      actionColor="#4db8d6"
      onAction={textAll} />
    {/* No phone rows — empty state renders no rows (section header only) */}

    {/* ── EMAILS section ── */}
    <SectionHeader
      label="EMAILS"
      actionLabel="EMAIL ALL..."
      actionColor="#4db8d6"
      onAction={emailAll} />
    <EmailRow
      address="msbrilliantdisguise@gmail.com"
      attribution={null}
      onEmailPress={() => composeEmail("msbrilliantdisguise@gmail.com")} />
    <EmailRow
      address="yahsonkt@hotmail.com"
      attribution="Yahson Terry"           // rendered as "yahsonkt@hotmail.com — Yahson Terry"
      onEmailPress={() => composeEmail("yahsonkt@hotmail.com")} />

    {/* ── RELATIONSHIPS section ── */}
    <SectionHeader
      label="RELATIONSHIPS"
      actionIcon="plus"
      actionColor="#4db8d6"
      onAction={addRelationship} />
    <DisclosureRow
      label="Yahson Terry"
      labelStyle="value"                   // dark text, not muted — this is a name not a field label
      onPress={() => pushContactDetail("yahsonTerry")} />

    {/* ── DETAILS section ── */}
    <SectionHeader label="DETAILS" />
    <DetailFieldRow label="Assigned to"    value="Matt Ryan"
      onPress={() => openPicker("assignedTo")} />
    <DetailFieldRow label="Stage"          value="Active Client"
      onPress={() => openPicker("stage")} />
    <DetailFieldRow label="Source"         value="Import"
      onPress={() => openPicker("source")} />
    <DetailFieldRow label="Tags"           value="audience:buyer, Bend, Buyer, city:ben..."
      truncate={true}
      onPress={() => openTagEditor()} />
    <DetailFieldRow label="Time frame"     value={null}
      onPress={() => openPicker("timeFrame")} />
    <DetailFieldRow label="Collaborators"  value="No collaborators"
      onPress={() => openPicker("collaborators")} />

  </ScrollView>

  <FAB                                      // floating, fixed bottom-right
    icon="plus"
    color="#4db8d6"
    size={56}
    position={{ bottom: 80, right: 16 }}   // above bottom tab bar
    onPress={openActivitySheet} />

</ContactDetailShell>
```

### Component specs

**`<SectionHeader>`**
- Height: 40pt, bg: #edf0f4
- Label: all-caps, SF 11pt medium (500), color #8a9099, left-aligned, px=16
- Action (right): teal #4db8d6, all-caps, 11pt, or "+" icon 20pt; 44×44pt tap target

**`<EmailRow>`**
- Height: ~50–54pt, bg: #ffffff
- Left: email address string, SF 15pt regular, color #1a2633; if attribution: " — {name}" appended in same style
- Right: teal circle button 36pt dia, envelope icon ~16pt (SF Symbols "envelope.fill" or custom), bg #4db8d6, icon #ffffff
- Bottom: 1pt divider #e5e8ec
- Row itself NOT tappable; only the circle button is the tap target

**`<DisclosureRow>`**
- Height: ~66pt, bg: #ffffff
- Left: primary text SF 17pt regular, color #1a2633
- Right: chevron "›" SF 14pt, color #c8cdd2
- Bottom: 1pt divider #e5e8ec
- Full row tappable

**`<DetailFieldRow>`**
- Height: ~54pt, bg: #ffffff
- Left: label SF 15pt regular, color #9eb3c4 (muted blue-gray); right: value SF 15pt regular-to-semibold, color #1a2633, right-aligned before chevron
- Chevron "›" SF 14pt, color #c8cdd2, rightmost
- When value is null: right side empty (no placeholder text)
- Bottom: 1pt divider #e5e8ec
- Full row tappable → push or modal picker

**`<InitialsAvatar>`**
- Background color auto-generated from contact name hash (consistent per person)
- Fallback palette used by FUB includes muted purple-blues, greens, oranges
- This instance: "MB" → #6b70a8

### Data bindings
- `contact.displayName` → hero name
- `contact.lastCommunicationDate` → hero subtitle formatted as "Last communication {Mon D}"
- `contact.emails[]` → EmailRow list (address + attribution name if cross-linked contact)
- `contact.phoneNumbers[]` → PhoneRow list (not visible here — empty)
- `contact.relationships[]` → DisclosureRow list (Yahson Terry)
- `contact.assignedTo` → DetailFieldRow value (Matt Ryan)
- `contact.stage` → DetailFieldRow value (Active Client)
- `contact.source` → DetailFieldRow value (Import)
- `contact.tags[]` → comma-joined, truncated at display width (audience:buyer, Bend, Buyer, city:bend…)
- `contact.timeFrame` → DetailFieldRow value (null here)
- `contact.collaborators[]` → DetailFieldRow value ("No collaborators" empty state)

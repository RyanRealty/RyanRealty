<!-- Mobile per-screen appendix. Original: IMG_6003.PNG | id: mob-37 | tiles: mob-tiles/mob-37_{full,t,m,b}.png -->

# mob-37 — fub-ios — Contact Detail: Notes Tab

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app
- **module:** Contact Detail (Lead Profile)
- **screen:** Notes sub-tab within a Contact Detail record
- **how to reach:** People tab → tap any contact row → sub-tab bar → tap "Notes"
- **iOS status bar:** 8:45 · signal 2/4 bars · WiFi · battery 36% (all white icons on dark bg)
- **URL bar:** n/a (native app, no Safari chrome)

---

## Screen regions (y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | ~54 pt | #2e3c4e (dark teal-grey, matches header) |
| Nav / header bar (back + contact hero) | 54–170 | ~116 pt | #2e3c4e (dark teal-grey) |
| Sub-tab strip | 170–210 | ~40 pt | #2e3c4e → slight bottom shadow into content |
| "Add note" action row | 210–250 | ~40 pt | #f0f0f0 (light grey) |
| Scrollable notes list | 250–820 | ~570 pt | #ffffff cards on #f0f0f0 background |
| FAB (floating, bottom-right) | ~730 absolute | 56 pt diameter | #4a90d9 (FUB blue) |
| Bottom tab bar | 820–844 | ~24 pt (home-indicator zone only — bar may be fully off-crop) | not visible |

---

## Nav / header bar (exact)

**Left control:** `<` back chevron, white, ~24 pt, top-left corner (~22 pt from left edge, vertically centered in status-bar row). Taps → pops back to the People list or previous screen.

**Center / hero block (below status bar, full-width):**
- Avatar: filled circle ~72 pt diameter, color #7b68c8 (medium purple), white bold initials **"MR"** (~22 pt, semibold)
- Primary name: **"Matthew Ryan"** — white, ~24 pt, bold, left-aligned next to avatar
- Subtitle: **"No communication yet"** — white/cream at ~60% opacity, ~14 pt regular, left-aligned under name

No right-side controls visible in the header bar on this screen.

---

## Sub-tab strip (exact)

Single horizontal scrollable strip immediately below the contact hero. Tabs in visible order (left → right):

| # | Label | State | Indicator |
|---|---|---|---|
| 1 | Comms | inactive | no underline, lighter grey text |
| 2 | Homes | inactive | no underline, lighter grey text |
| 3 | **Notes** | **ACTIVE** | bold white text + 3 pt teal/blue underline rule (#4a90d9 approx) |
| 4 | Calendar | inactive | lighter grey text |
| 5 | Auto… | inactive | partially clipped — full label is "Automations" |

Strip background: same dark teal-grey as header, no separator line.
Active tab text weight: 600 (semibold). Inactive: 400, ~70% white.
Underline bar: ~3 pt high, spans the label width, sits flush at strip bottom.

---

## Bottom tab bar (exact)

The main FUB bottom tab bar is not visible in this crop — the contact detail sub-tab strip is the primary navigation surface on this screen. Based on FUB iOS conventions the main bar (Inbox / Activity / Calendar / People / Deals) is present but scrolled under the home indicator or cropped. The active tab in the main bar would be **People** (since we navigated from the People list into a contact).

No FAB in the main tab bar; the only FAB on-screen is the Notes-specific "+" add button (see below).

---

## Floating Action Button

- Circle, ~56 pt diameter
- Color: #4a90d9 (FUB blue — same as active tab indicator)
- Icon: white **+** (plus), ~24 pt, centered
- Position: fixed bottom-right, ~20 pt from right edge, ~90 pt from bottom of visible content area
- Tap action: opens "Add note" composer sheet (modal bottom sheet or push view)

---

## Content — every element, in order

### "Add note" action row (y ~210–250 pt)
- Blue **+** icon (~20 pt), FUB blue #4a90d9, left-aligned with ~16 pt left padding
- Label: **"Add note"** in FUB blue #4a90d9, ~16 pt regular, vertically centered
- Full-width tap target → same action as FAB (opens note composer)
- Background: #f0f0f0 (light grey page background shows through; no card border)

### Notes list (scrollable, y ~250 pt → bottom)

Each note is a **card** with:
- White (#ffffff) background
- Thin top/bottom divider (1 pt, ~#e0e0e0)
- ~16 pt horizontal padding, ~12 pt vertical padding
- No chevron (notes are expanded in-place, not list→detail)

**Row anatomy:**
```
[Avatar 36pt circle] [Author name bold]      [Date right-aligned]
                      [Body text — multiline, truncated if long]
```

Avatar: broker headshot photo (circular crop, 36 pt). For Matt Ryan = actual profile photo visible (man in blue blazer, photographed from shoulders up).

---

**Note 1**
- Author: **Matt Ryan**
- Date: **Tue, 8:16pm** (right-aligned, ~12 pt, muted grey #8a8a8a)
- Body: `Matt alert: matt@ryan-realty.com is back on the website and viewing https://ryan-realty.com/ (Ryan Realty. Central Oregon Real Estate | Bend, Redmond, Sisters, Sunriver).`
  - "matt@ryan-realty.com" rendered as tappable blue hyperlink
  - "https://ryan-realty.com/" rendered as tappable blue hyperlink

**Note 2**
- Author: **Matt Ryan**
- Date: **Tue, 12:02pm**
- Body: `Matt alert: matt@ryan-realty.com is back on the website and viewing https://ryan-realty.com/communities/tetherow (Tetherow Homes for Sale | Bend, Oregon | Ryan Realt…` [truncated with ellipsis]

**Note 3**
- Author: **Matt Ryan**
- Date: **Jun 22**
- Body: `Matt alert: matt@ryan-realty.com is back on the website and viewing https://ryan-realty.com/homes-for-sale/bend/the-highlands-at-broken-top/19100-macalpine-2…` [truncated]

**Note 4**
- Author: **Matt Ryan**
- Date: **Jun 19**
- Body: `Matt alert: matt@ryan-realty.com is back on the website and viewing https://ryan-realty.com/ (Ryan Realty. Central Oregon…` [partially obscured by FAB overlay]

**Note 5** (partially visible at very bottom of scroll)
- Author: **Matt Ryan** (name visible, date/body cut off)

**Pattern:** All visible notes are auto-generated FUB "Matt alert" website-activity notes, logged by the FUB website-tracking pixel. They all follow the template: `Matt alert: <email> is back on the website and viewing <URL> (<page title>).`

**Empty state** (not shown but inferred): would display something like "No notes yet" with the Add note prompt prominent.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / sub-tab bg | #2e3c4e (dark blue-grey teal — FUB brand) |
| Active tab underline + FAB + links + Add-note label | #4a90d9 (FUB blue accent) |
| Contact avatar bg | #7b68c8 (medium purple — FUB auto-assigns per initials) |
| Avatar initials text | #ffffff |
| Header primary name | #ffffff |
| Header subtitle | rgba(255,255,255,0.60) |
| Inactive sub-tab labels | rgba(255,255,255,0.55) |
| Active sub-tab label | #ffffff semibold |
| Page / list bg | #f0f0f0 |
| Note card bg | #ffffff |
| Note card divider | #e0e0e0 |
| Note author name | #1a1a1a bold ~14 pt |
| Note date | #8a8a8a regular ~12 pt |
| Note body | #3a3a3a regular ~13–14 pt |
| Hyperlinks in body | #4a90d9 (FUB blue, underlined) |
| Back chevron | #ffffff |

**Font impressions:**
- System font (SF Pro) throughout
- Author name: SF Pro 600 ~14 pt
- Date: SF Pro 400 ~12 pt
- Body: SF Pro 400 ~13 pt, line-height ~1.4
- Sub-tab labels: active SF Pro 600 ~14 pt, inactive SF Pro 400 ~13 pt

**Note:** FUB accent is blue/teal (#4a90d9), NOT the Ryan Realty navy #102742. This is the native FUB app, not the in-house CRM.

---

## Interactions & gestures [INFERRED]

| Target | Action |
|---|---|
| Back `<` chevron | Pop navigation → previous screen (People list or search results) |
| Sub-tab "Comms" | Push/slide to Comms sub-tab (calls/texts/emails log) |
| Sub-tab "Homes" | Push to Homes sub-tab (saved searches / viewed properties) |
| Sub-tab "Calendar" | Push to Calendar sub-tab (appointments for this contact) |
| Sub-tab "Auto…" | Push to Automations sub-tab (active drip plans) |
| "Add note" action row | Opens note composer modal (bottom sheet with text field + Save) |
| FAB `+` | Same as "Add note" row |
| Note card tap | Likely expands the note in-place or opens edit view |
| Email/URL hyperlinks in note body | Opens Mail.app / Safari respectively |
| Pull-to-refresh (scrollable list) | Refreshes notes from FUB server |
| Swipe left on note row | [INFERRED] Reveals delete action (red trash icon) |
| Long-press note | [INFERRED] Context menu: Edit / Copy / Delete |
| Horizontal scroll sub-tab strip | Reveals hidden tabs (Automations fully, possibly more) |

---

## Build notes (component tree)

```tsx
<MobileShell statusBarStyle="light-content" statusBarBg="#2e3c4e">

  {/* Header region */}
  <ContactDetailHeader bg="#2e3c4e">
    <BackButton icon="chevron-left" color="#fff" onPress={navigateBack} />
    <ContactHero>
      <Avatar
        size={72}
        initials="MR"
        photoUrl={contact.photoUrl}   // if photo exists, show photo; else initials
        initialsColor="#ffffff"
        bg="#7b68c8"                  // FUB assigns color by initials hash
      />
      <ContactInfo>
        <ContactName>{contact.fullName}</ContactName>   {/* "Matthew Ryan" */}
        <ContactSubtitle>{contact.lastCommSummary ?? "No communication yet"}</ContactSubtitle>
      </ContactInfo>
    </ContactHero>
  </ContactDetailHeader>

  {/* Sub-tab strip */}
  <SubTabStrip
    tabs={["Comms", "Homes", "Notes", "Calendar", "Automations"]}
    activeTab="Notes"
    accentColor="#4a90d9"
    textColor="#ffffff"
    inactiveOpacity={0.55}
    indicatorHeight={3}
    scrollable            // tabs overflow horizontally, strip is scrollable
  />

  {/* Notes tab content */}
  <ScrollView bg="#f0f0f0">

    {/* Add note action row */}
    <AddNoteRow onPress={openNoteComposer}>
      <Icon name="plus-circle" color="#4a90d9" size={20} />
      <AddNoteLabel>Add note</AddNoteLabel>
    </AddNoteRow>

    {/* Notes list */}
    <NotesList>
      {notes.map(note => (
        <NoteCard key={note.id} onPress={() => openNoteDetail(note)}>
          <NoteHeader>
            <BrokerAvatar
              size={36}
              photoUrl={note.author.photoUrl}
              initials={note.author.initials}
            />
            <NoteAuthorName>{note.author.fullName}</NoteAuthorName>
            <NoteDate>{formatNoteDate(note.createdAt)}</NoteDate>
            {/* Date format: "Tue, 8:16pm" for this week; "Jun 22" for older */}
          </NoteHeader>
          <NoteBody
            linkifiedText={note.body}   // email + URL auto-linked
            linkColor="#4a90d9"
            numberOfLines={4}           // truncates with ellipsis
          />
        </NoteCard>
      ))}
    </NotesList>

  </ScrollView>

  {/* FAB */}
  <FloatingActionButton
    size={56}
    bg="#4a90d9"
    icon="plus"
    iconColor="#ffffff"
    position={{ bottom: 24, right: 20 }}
    onPress={openNoteComposer}
  />

</MobileShell>
```

### Data bindings
| Component | Data source |
|---|---|
| `ContactHero` | `GET /v1/people/:id` → `name`, `photoUrl`, last comm timestamp |
| `ContactSubtitle` | Derived from last comm timestamp; if null → "No communication yet" |
| `Avatar` bg color | Hash of initials → one of FUB's fixed palette (~8 colors incl. purple) |
| `NotesList` | `GET /v1/notes?personId=:id&sort=-createdAt` paginated |
| `NoteCard.author` | `note.user.name` + `note.user.imageUrl` (broker who created the note) |
| `NoteDate` | `note.createdAt` ISO8601 → "Tue, 8:16pm" (same week) / "Jun 22" (older) |
| `NoteBody` | `note.body` plaintext, linkified (email regex + URL regex → `<a>` tags) |

### Spacing / sizing callouts
- Note card: 16 pt horizontal padding, 12 pt top/bottom padding, 1 pt divider at top
- Avatar to author name gap: 10 pt
- Author name to date: flex-1 spacer (name left, date right)
- Author name to body gap: 6 pt vertical
- Between note cards: 0 pt (dividers only, no gap between cards)
- Add-note row height: ~44 pt (standard tap target), 16 pt left padding
- FAB bottom offset from home indicator: ~32 pt

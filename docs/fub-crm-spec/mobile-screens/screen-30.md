<!-- Mobile per-screen appendix. Original: IMG_5992.PNG | id: mob-30 | tiles: mob-tiles/mob-30_{full,t,m,b}.png -->

# mob-30 — fub-ios — Contact Detail: Notes Tab

## Identity
- **app_source:** fub-ios (Follow Up Boss native iPhone app)
- **module:** Contact Detail (Lead Profile) — Notes sub-tab
- **screen:** Notes list for a contact named "Tide Rivers"; shows all broker-authored notes attached to this lead
- **how to reach:** People tab → tap any contact row → lands on Comms sub-tab by default → tap "Notes" sub-tab to arrive here
- **iOS status bar:** Time "8:40" (left, white); signal bars + WiFi icon + battery "37%" (right, white)
- **URL bar:** n/a — native iOS app, no browser chrome

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–50 | 50 | Transparent over header (#3d5466) |
| Nav / header bar (contact identity) | 50–155 | 105 | Dark slate-teal ~#3d5466 |
| Sub-tab strip | 155–205 | 50 | Same dark slate-teal ~#3d5466 |
| Scrollable content area | 205–795 | 590 | Light blue-gray ~#eef0f4 |
| FAB overlay | 740–795 | — | Transparent; FAB floats at bottom-right |
| Home indicator | 795–844 | 49 | Transparent/system |

No bottom tab bar is visible — this is a pushed detail screen; FUB iOS hides the main tab bar on push navigation. No Safari chrome.

---

## Nav / header bar (exact)

**Left control:** `<` back chevron, white, ~22pt, vertically centered in header. Taps to pop back to the contact list (People tab stack).

**Center-left identity block (horizontal stack):**
- Circular avatar, ~52pt diameter, displaying a photographic logo image: ocean wave/surf graphic with text "RIVERS TO THE SEA" — appears to be a company/organization logo rather than a personal headshot. No initials fallback visible.
- To the right of avatar:
  - Primary text: **"Tide Rivers"** — white, ~22pt, semibold/bold, single line
  - Secondary text: **"Last communication Jun 14"** — light gray-white (#c8d4de), ~13pt, regular weight, single line

**Right controls:** None visible at this zoom level. (FUB contact detail header typically has a kebab `⋮` or action button at far right, but it is not visible or off-screen to the right in this crop.)

**Right-edge drawer handle:** A vertical pill/capsule (~14pt wide × 60pt tall) with a left-pointing chevron `‹` (white icon), positioned flush against the right edge of the screen at approximately y:240–300pt. This is FUB's slide-out right-panel toggle (used in iPad layout and some iPhone landscape flows). On iPhone portrait it collapses a details/actions side panel. Background: dark rounded-rect ~#2e4457 at ~70% opacity.

---

## Bottom tab bar (exact)

**Not present on this screen.** FUB iOS pushes contact detail as a modal/pushed view and hides the main tab bar. The main tabs (Inbox / Activity / Calendar / People / Deals) are not shown.

**FAB (Floating Action Button):**
- Position: bottom-right corner, ~x:334pt, y:740pt (above home indicator)
- Size: ~56pt diameter circle
- Color: steel blue ~#6b9dc8 (same family as FUB's teal/blue accent, slightly desaturated)
- Icon: white bold `+` (plus sign), ~24pt
- Action: Opens the "Add note" composer sheet for this contact (same as tapping the inline "Add note" row at top of list)

---

## Sub-tab strip (exact)

Horizontal scrollable tab strip, dark header background continues behind it, bottom border / separator is the content area edge.

Tabs visible left-to-right (partially scrolled — leftmost tab is clipped):

| Tab label | State | Indicator |
|---|---|---|
| Comms | inactive (partially clipped left edge) | none |
| Homes | inactive | none |
| **Notes** | **active** | blue underline bar ~3pt tall, full tab width, color ~#5b9bd5 |
| Calendar | inactive | none |
| Auto... (truncated) | inactive | none |

- Active tab text: white, ~15pt, semibold
- Inactive tab text: gray-white ~#8fa8be, ~15pt, regular
- Active underline: solid blue ~#5b9bd5, ~3pt height, spans full tab width
- Tab strip is horizontally scrollable (additional tabs exist off-screen to the right; "Auto" is truncated suggesting "Automations" continues)
- No badge counts on any tab

---

## Content — every element, in order

### "Add note" inline action row
- y: ~210–252pt
- Background: light blue-gray ~#eef0f4 (same as page background — no separate card)
- Layout: horizontal row, 16pt left padding
- Left: filled circle icon (~20pt), color blue ~#5b9bd5, white `+` inside
- Label: **"Add note"** — blue ~#5b9bd5, ~16pt, regular weight
- Full row is tappable (tap opens note composer sheet)
- No divider below; note card begins with ~8pt vertical gap

### Note card #1 (the only visible note)
- y: ~260–400pt
- Background: white (#ffffff)
- Border: subtle shadow or thin border (1pt, ~#dde2e8) — card sits on light gray bg, giving a floating card appearance
- Corner radius: ~8pt
- Horizontal padding: ~12pt left/right
- Vertical padding: ~12pt top/bottom

**Card header (top row):**
- Left: circular avatar photo of Matt Ryan (headshot, ~40pt diameter, real photo showing blue/white business attire)
- Right of avatar (vertical stack):
  - **"Matt Ryan"** — dark charcoal ~#1a2b3c, ~15pt, bold/semibold
  - **"Jun 13"** — gray ~#8a9bb0, ~13pt, regular

**Card body (below header, full card width):**
All text is dark charcoal ~#1a2b3c, ~14pt, regular weight, left-aligned, line-height ~20pt:

```
LEAD ORIGIN
Source: Seller LP (Home Value)
Page: /lp/seller-home-value
Campaign: concept-m-mountain (facebook/...
```

- "LEAD ORIGIN" — uppercase, appears to be a section heading within the note body (same font weight/size as body, just ALL CAPS — not a separate styled element)
- The Campaign line is truncated with `...` at the right edge — full value is not shown (likely: "concept-m-mountain (facebook/[something])")
- No "edit" or "delete" button visible on the card itself; [INFERRED] long-press or swipe may reveal edit/delete actions

**Empty state below card:**
- Large empty area (~y:400–740pt) — only one note exists for this contact
- Background: light blue-gray ~#eef0f4, no content, no empty-state illustration or text
- FAB occupies bottom-right of this region

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / sub-tab background | ~#3d5466 (dark slate-teal — FUB's characteristic dark header) |
| Content area background | ~#eef0f4 (light blue-gray) |
| Card background | #ffffff |
| Active tab underline / accent | ~#5b9bd5 (steel blue — FUB blue accent) |
| FAB color | ~#6b9dc8 (slightly desaturated steel blue) |
| "Add note" icon + label | ~#5b9bd5 |
| Contact name (header) | #ffffff |
| "Last communication" subtitle | ~#c0cfd8 (light gray-white) |
| Inactive tab labels | ~#8fa8be |
| Note author name | ~#1a2b3c (near-black) |
| Note date | ~#8a9bb0 (mid-gray) |
| Note body text | ~#1a2b3c |
| Card border/shadow | ~#dde4eb / subtle drop shadow |
| Right-panel handle bg | ~#2e4457 |

**Typography impressions:**
- Contact name: ~22pt, semibold, SF Pro Display or similar system font (FUB uses system fonts)
- Sub-header subtitle: ~13pt, regular
- Tab labels: ~15pt, semibold (active) / regular (inactive)
- Note author: ~15pt, semibold/bold
- Note date: ~13pt, regular
- Note body: ~14pt, regular, line-height ~20pt

**Iconography:**
- Back chevron: standard iOS `<` chevron, ~22pt, white, SF Symbols "chevron.left"
- Add note circle icon: filled circle with white plus, ~20pt
- Right-panel handle: `‹` chevron, white, inside a dark rounded pill
- FAB: bold white `+`, ~24pt, inside 56pt blue circle

---

## Interactions & gestures

- **Tap `<` back chevron:** Pop contact detail off navigation stack → returns to People/contact list [INFERRED]
- **Tap "Notes" sub-tab:** Already active; no change [INFERRED swipe between tabs is also supported]
- **Swipe sub-tab strip horizontally:** Reveals additional tabs (Automations, possibly Tasks, Deals sub-tabs) [INFERRED]
- **Tap "Add note" row:** Opens note composer modal/sheet from bottom — text input with keyboard, possibly title field, Save/Cancel controls [INFERRED]
- **Tap FAB `+`:** Same as "Add note" tap — opens note composer [INFERRED]
- **Tap note card:** [INFERRED] Opens note detail/edit view or expands truncated content in-place
- **Long-press or swipe-left on note card:** [INFERRED] Reveals edit / delete swipe actions (FUB standard pattern)
- **Tap right-panel handle `‹`:** [INFERRED] Slides open a right-side panel with additional contact actions/fields (FUB iPad-style panel, behavior on iPhone may be a modal sheet)
- **Pull-to-refresh on content area:** [INFERRED] Reloads notes list from FUB API
- **Swipe between sub-tabs (horizontal swipe on content):** [INFERRED] Navigates between Comms / Homes / Notes / Calendar / Auto tabs

---

## Build notes (component tree)

```tsx
<ContactDetailShell>
  {/* iOS status bar — system managed */}

  <ContactDetailHeader bg="#3d5466">
    <BackChevron onPress={navigation.goBack} color="#fff" />
    <ContactIdentityBlock>
      <Avatar
        src={contact.avatarUrl}         // org logo image or initials fallback
        size={52}
        shape="circle"
      />
      <VStack gap={2}>
        <Text style={styles.contactName}>{contact.name}</Text>
        {/* "Tide Rivers" — white 22pt semibold */}
        <Text style={styles.lastComm}>
          Last communication {contact.lastCommDate}
        </Text>
        {/* "Last communication Jun 14" — #c0cfd8 13pt */}
      </VStack>
    </ContactIdentityBlock>
    <RightPanelHandle onPress={toggleRightPanel} />
    {/* Vertical pill with ‹ chevron, flush right edge */}
  </ContactDetailHeader>

  <SubTabStrip
    tabs={["Comms", "Homes", "Notes", "Calendar", "Automations"]}
    activeTab="Notes"
    accentColor="#5b9bd5"
    bg="#3d5466"
    onTabChange={setActiveTab}
    // horizontally scrollable, active underline indicator
  />

  <ScrollView bg="#eef0f4" contentPaddingTop={8}>

    <AddNoteRow
      iconColor="#5b9bd5"
      labelColor="#5b9bd5"
      label="Add note"
      onPress={openNoteComposer}
      // inline row, full-width tap target, 16pt left padding
    />

    {notes.map(note => (
      <NoteCard key={note.id} bg="#fff" borderRadius={8} mx={16} mb={8}>
        <NoteCardHeader>
          <BrokerAvatar
            src={note.authorAvatarUrl}   // Matt Ryan headshot
            size={40}
            shape="circle"
          />
          <VStack gap={2}>
            <Text style={styles.noteAuthor}>{note.authorName}</Text>
            {/* "Matt Ryan" — #1a2b3c 15pt semibold */}
            <Text style={styles.noteDate}>{note.date}</Text>
            {/* "Jun 13" — #8a9bb0 13pt */}
          </VStack>
        </NoteCardHeader>
        <NoteCardBody>
          <Text style={styles.noteBody} numberOfLines={6}>
            {note.body}
          </Text>
          {/*
            Body verbatim:
            "LEAD ORIGIN\nSource: Seller LP (Home Value)\nPage: /lp/seller-home-value\nCampaign: concept-m-mountain (facebook/..."
            — #1a2b3c 14pt regular, line-height 20pt
            Truncated with ... at line limit; tap card to expand
          */}
        </NoteCardBody>
      </NoteCard>
    ))}

    {notes.length === 0 && (
      <EmptyState message="No notes yet" />
      // [INFERRED] empty state not shown here (1 note exists)
    )}

  </ScrollView>

  <FAB
    icon="plus"
    color="#6b9dc8"
    size={56}
    position="bottom-right"
    bottom={54}   // above home indicator
    right={16}
    onPress={openNoteComposer}
  />

</ContactDetailShell>
```

**Data bindings:**
- `contact.name` → "Tide Rivers"
- `contact.avatarUrl` → org logo image (ocean/surf graphic)
- `contact.lastCommDate` → "Jun 14"
- `notes[]` → array from FUB `/v1/notes?personId=<id>` — each has `{ id, authorName, authorAvatarUrl, date, body }`
- Note body is plain text (no markdown rendering visible); line breaks preserved

**Key spacing/sizing:**
- Header height: ~105pt (50pt status bar + 55pt content)
- Sub-tab strip height: ~50pt
- Avatar in header: 52pt circle
- Avatar in note card: 40pt circle
- Note card margin: 16pt horizontal, 8pt bottom gap between cards
- Note card padding: 12pt all sides
- FAB: 56pt circle, 16pt from right edge, 54pt from bottom
- "Add note" row: ~42pt tall, 16pt left padding, left-aligned icon+label

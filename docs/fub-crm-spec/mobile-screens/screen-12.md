<!-- Mobile per-screen appendix. Original: IMG_5833.PNG | id: mob-12 | tiles: mob-tiles/mob-12_{full,t,m,b}.png -->

# mob-12 — fub-ios — Contact Detail / Info Tab (Jim Langevin)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile) — Info sub-tab
- **screen:** Contact detail for "Jim Langevin", Info tab active
- **How to reach:** People tab → tap any contact row → Contact Detail pushes on navigation stack → "Info" is the default active sub-tab
- **iOS status bar:** 4:34 time (left), signal bars + WiFi + 100% battery (right)
- **No browser URL bar** (native app, not web)

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | Approx y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 pt | Dark steel-teal ~#3d4f5e |
| Nav bar (back + Edit) | 47–91 | 44 pt | Dark steel-teal ~#3d4f5e |
| Contact hero (avatar + name + badge) | 91–200 | ~109 pt | Dark steel-teal ~#3d4f5e |
| Sub-tab strip | 200–242 | 42 pt | Dark steel-teal ~#3d4f5e, active underline blue |
| Scrollable content | 242–844 | ~602 pt | Light gray ~#f0f2f5 (section headers), white (rows) |
| FAB (floating) | ~700–760 (right side) | 56 pt circle | Mid-blue ~#5b8ecf |
| Bottom tab bar | Below visible area (cropped / scrolled off) | 83 pt | — |

---

## Nav / header bar (exact)

**Left control:** `<` back chevron — white, ~22 pt, navigates back to People list (or previous screen on stack)

**Center:** empty — no title text in the nav bar itself; the contact name lives in the hero section below

**Right control:** text button "Edit" — white, ~17 pt regular weight — taps into contact edit mode (editable form fields for all contact data)

**Hero section (below nav bar, same dark background):**
- Avatar: circle ~52 pt diameter, muted rose-taupe fill ~#8e6e6e, white "JL" initials, ~18 pt semibold
- Name: "Jim Langevin" — white, ~22 pt semibold/bold, left of avatar
- Subtitle: "Last communication May 21" — muted warm gray ~#9aabb8, ~13 pt regular, below name
- Price pill badge: "$655K" — bright green fill ~#2dc97a, white text ~13 pt semibold, ~8 pt corner radius, ~6 pt horizontal padding, positioned below subtitle

---

## Sub-tab strip (exact)

All tabs sit on the same dark header background. Active tab has a 2 pt blue underline bar ~#4a9ce8.

| Order | Label | State | Color |
|---|---|---|---|
| 1 | Info | **Active** | White, 2 pt blue underline |
| 2 | Comms | Inactive | Muted gray ~#8fa4b4 |
| 3 | Homes | Inactive | Muted gray ~#8fa4b4 |
| 4 | Notes | Inactive | Muted gray ~#8fa4b4 |
| 5 | Caler… (Calendar) | Inactive, truncated | Muted gray ~#8fa4b4 |

Tab font: ~14 pt regular. Strip height: ~42 pt. No badge counts on any sub-tab. Tabs are horizontally scrollable (Calendar truncated implies more tabs exist off-screen to the right).

---

## Bottom tab bar (exact)

**Not visible in this screenshot** — the view is either scrolled so the tab bar is off-screen, or the screenshot was captured mid-scroll. Based on the FUB iOS app's canonical tab bar structure:

| Order | Label | Icon | Inferred active |
|---|---|---|---|
| 1 | Inbox | Speech bubble | — |
| 2 | Activity | Lightning bolt | — |
| 3 | Calendar | Calendar icon | — |
| 4 | People | Person silhouette | **Yes** (contact detail pushed from People) |
| 5 | Deals | Dollar sign / handshake | — |

No FAB "+" integrated into the tab bar. A separate floating blue "+" button sits over the scrollable content.

---

## Content — every element in order (Info tab, top to bottom)

### Section 1 — RECENT MESSAGES

**Section header row:**
- Label: "RECENT MESSAGES" — uppercase, ~11 pt, gray ~#8a9aaa, weight 600
- Background: light gray ~#eef0f4, full-width, ~32 pt tall

**Conversation row:**
- Avatar: circle ~44 pt, blue-purple fill ~#7b8fcf, white icon of two overlapping speech bubbles (group conversation glyph)
- Primary text: "Lisa Langevin, Jim Langevin, M..." — bold ~16 pt dark ~#1a2533, truncated with ellipsis
- Date: "Apr 7" — right-aligned, ~13 pt gray ~#9aabb8
- Secondary line 1: "(415) 827-4577, (510) 219-0753, (541) 703-3095" — ~13 pt gray ~#6a7a8a
- Secondary line 2: "Hey guys, here's some measurements th..." — ~13 pt gray ~#6a7a8a, truncated
- Row height: ~72 pt, white background
- Tappable: navigates into the group conversation thread (Comms-style detail)
- No right chevron visible
- Bottom 1 pt divider: light gray ~#e0e3e8

---

### Section 2 — PHONE NUMBERS

**Section header row:**
- Left label: "PHONE NUMBERS" — uppercase, ~11 pt, gray ~#8a9aaa, weight 600
- Right action: "TEXT ALL..." — ~12 pt, teal/cyan ~#4ab8d4, taps to open compose-text to all phone numbers simultaneously
- Background: light gray ~#eef0f4, full-width, ~36 pt tall

**Phone row 1:**
- Primary text: "(510) 219-0753 — " dark ~#1a2533, "(mobile)" muted gray ~#9aabb8, both ~15 pt regular
- Right side: two circular action buttons (44 pt each, 8 pt gap):
  - SMS button: blue-purple fill ~#7b8fcf, white speech bubble icon
  - Call button: green fill ~#2dc97a, white phone receiver icon
- Row height: ~52 pt, white background
- Bottom 1 pt divider: light gray ~#e0e3e8

**Phone row 2:**
- Primary text: "(415) 827-4577 — " dark ~#1a2533, "Lisa Langevin" dark + " (Sp..." gray (truncated "Spouse"), ~15 pt regular
- Right side: same two circular action buttons (SMS blue-purple + Call green)
- Row height: ~52 pt, white background
- Bottom 1 pt divider: light gray ~#e0e3e8

---

### Section 3 — EMAILS

**Section header row:**
- Left label: "EMAILS" — uppercase, ~11 pt, gray ~#8a9aaa, weight 600
- Right action: "EMAIL ALL..." — ~12 pt, teal/cyan ~#4ab8d4, taps to compose email to all addresses
- Background: light gray ~#eef0f4, full-width, ~36 pt tall

**Email row 1:**
- Primary text: "jimlangevin@att.net" — dark ~#1a2533, ~15 pt regular
- Right side: circular action button ~44 pt, light blue fill ~#5bc8f0, white envelope icon
- Row height: ~52 pt, white background
- Bottom 1 pt divider: light gray ~#e0e3e8

**Email row 2:**
- Primary text: "the4langevins@att.net — Lisa Langevin (..." — dark ~#1a2533, truncated, ~15 pt regular; "(..." is gray
- Right side: circular action button ~44 pt, light blue fill ~#5bc8f0, white envelope icon
- Row height: ~52 pt, white background
- Bottom 1 pt divider: light gray ~#e0e3e8

---

### Section 4 — RELATIONSHIPS

**Section header row:**
- Left label: "RELATIONSHIPS" — uppercase, ~11 pt, gray ~#8a9aaa, weight 600
- Right control: "+" icon — teal/cyan ~#4ab8d4, ~20 pt, taps to add a new relationship link
- Background: light gray ~#eef0f4, full-width, ~36 pt tall

**Relationship row 1:**
- Primary text: "Lisa Langevin" — dark ~#1a2533, ~15 pt regular; " (Spouse)" — gray ~#9aabb8, ~15 pt regular
- Right: ">" chevron — gray ~#c0c8d0
- Row height: ~52 pt, white background
- Tappable: navigates to Lisa Langevin's contact detail screen
- Bottom 1 pt divider: light gray ~#e0e3e8

---

### Floating Action Button (FAB)

- Circle: ~56 pt diameter, mid-blue fill ~#5b8ecf
- Icon: white "+" plus sign, ~24 pt
- Position: bottom-right, approximately 16 pt from right edge, overlapping the transition between RELATIONSHIPS and DETAILS sections (~700–760 pt y)
- Tap action: [INFERRED] opens a quick-action sheet to add note / log activity / send message / create task

---

### Section 5 — DETAILS (partially visible at screen bottom)

**Section header row:**
- Label: "DETAILS" — uppercase, ~11 pt, gray ~#8a9aaa, weight 600
- Background: light gray ~#eef0f4, full-width, ~36 pt tall

**Detail row 1 (partially in view):**
- Left label: "Assigned to" — gray ~#9aabb8, ~15 pt regular
- Right value: "Matt Ryan" — dark ~#1a2533, ~15 pt regular, followed by ">" chevron ~#c0c8d0
- Row height: ~52 pt, white background
- Tappable: [INFERRED] opens agent/broker assignment picker

*Additional DETAILS rows exist below the visible scroll position (e.g., Source, Stage, Lead Type, Tags, etc.)*

---

## Colors, type & iconography

| Element | Color (hex estimate) |
|---|---|
| Header / hero / sub-tab background | #3d4f5e (dark steel-teal) |
| Header text (name) | #ffffff |
| Header subtitle | #8faabb |
| Active sub-tab text | #ffffff |
| Sub-tab active underline | #4a9ce8 (FUB teal-blue) |
| Inactive sub-tab text | #8fa4b4 |
| Section header background | #eef0f4 |
| Section header label text | #8a9aaa (uppercase, tracking +0.5) |
| Section action text (TEXT ALL / EMAIL ALL / +) | #4ab8d4 (cyan-teal) |
| Row background | #ffffff |
| Row primary text | #1a2533 |
| Row secondary / muted text | #9aabb8 or #6a7a8a |
| Row dividers | #e0e3e8 (1 pt) |
| Chevron ">" | #c0c8d0 |
| Avatar fill (Jim, initials) | #8e6e6e (muted rose-taupe) |
| Avatar text (initials) | #ffffff |
| Group conversation avatar | #7b8fcf (blue-purple) |
| Price badge fill | #2dc97a (bright green) |
| Price badge text | #ffffff |
| SMS button fill | #7b8fcf (blue-purple) |
| Call button fill | #2dc97a (green) |
| Email button fill | #5bc8f0 (light sky blue) |
| FAB fill | #5b8ecf (mid-blue) |
| FAB icon | #ffffff |

**Typography:**
- Contact name: ~22 pt semibold, white
- Sub-tab labels: ~14 pt regular
- Section headers: ~11 pt uppercase, letter-spacing ~0.5pt, weight 600, gray
- Row primary text: ~15–16 pt regular, dark
- Row secondary text: ~13 pt regular, gray
- Date (message row): ~13 pt regular, gray
- Action links (TEXT ALL / EMAIL ALL): ~12 pt regular, uppercase, cyan-teal
- Price badge: ~13 pt semibold, white on green

**Iconography:**
- Back chevron: standard iOS `<` stroke, white
- Group conversation: two overlapping speech bubbles, white on blue-purple circle
- SMS: filled speech bubble, white on blue-purple circle
- Call: phone receiver, white on green circle
- Email: envelope outline, white on sky-blue circle
- FAB: bold plus sign, white on mid-blue circle
- Relationship ">" chevron: thin gray

---

## Interactions & gestures [INFERRED where marked]

| Target | Action |
|---|---|
| `<` back chevron | Pop contact detail, return to People list |
| "Edit" (top right) | Push edit form for all contact fields |
| Avatar circle | [INFERRED] Opens avatar/photo picker or no-op |
| Sub-tab "Info" | Already active; no-op or scroll to top |
| Sub-tab "Comms" | Switch to full communication history (emails/texts/calls) |
| Sub-tab "Homes" | Switch to Homes/properties view |
| Sub-tab "Notes" | Switch to notes list |
| Sub-tab "Calendar" | Switch to appointments/calendar view |
| Recent Messages row | Navigate into group conversation thread |
| "TEXT ALL..." | Open compose-text with all phone numbers pre-populated |
| SMS button (any phone row) | Open compose-text with that specific number pre-populated |
| Call button (any phone row) | Initiate phone call to that number via iOS |
| "EMAIL ALL..." | Open compose-email with all email addresses pre-populated |
| Email button (any email row) | Open compose-email to that specific address |
| "+" (RELATIONSHIPS header) | Open relationship picker / add relationship sheet |
| "Lisa Langevin (Spouse)" row | Navigate to Lisa Langevin's contact detail |
| "Assigned to — Matt Ryan" row | Open agent assignment picker |
| FAB "+" | [INFERRED] Bottom sheet with quick actions: Log Call, Send Text, Send Email, Add Note, Create Task, Add Appointment |
| Pull-to-refresh on scroll view | [INFERRED] Refresh contact data from FUB server |
| Swipe left on phone/email row | [INFERRED] Reveal delete action |

---

## Build notes (component tree)

```tsx
<MobileShell>

  {/* Status bar — OS-rendered, 47pt, dark bg bleeds through */}
  <StatusBar style="light-content" backgroundColor="#3d4f5e" />

  {/* Fixed header stack — does NOT scroll */}
  <ContactDetailHeader bg="#3d4f5e">

    <NavBar>
      <BackButton icon="chevron-left" color="#fff" onPress={goBack} />
      <Spacer flex={1} />
      <TextButton label="Edit" color="#fff" size={17} onPress={openEditMode} />
    </NavBar>

    <ContactHero>
      <Avatar
        size={52}
        fill="#8e6e6e"
        initials="JL"          /* derived: first char of first + last name */
        textColor="#fff"
        textSize={18}
      />
      <VStack ml={12} flex={1}>
        <Text style={styles.heroName}>Jim Langevin</Text>
        <Text style={styles.heroSubtitle}>Last communication May 21</Text>
        <PriceBadge
          value="$655K"
          bg="#2dc97a"
          textColor="#fff"
          fontSize={13}
          borderRadius={8}
          px={8}
          py={3}
        />
      </VStack>
    </ContactHero>

    <SubTabStrip
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar"]}
      activeTab="Info"
      activeColor="#fff"
      inactiveColor="#8fa4b4"
      underlineColor="#4a9ce8"
      underlineHeight={2}
      scrollable={true}       /* tabs overflow horizontally */
      bg="#3d4f5e"
    />

  </ContactDetailHeader>

  {/* Scrollable content — starts below fixed header */}
  <ScrollView bg="#eef0f4">

    {/* RECENT MESSAGES */}
    <SectionHeader label="RECENT MESSAGES" />
    <ContactInfoRow
      leading={
        <AvatarIcon size={44} fill="#7b8fcf" icon="group-conversation" />
      }
      primaryText="Lisa Langevin, Jim Langevin, M..."
      secondaryLines={[
        "(415) 827-4577, (510) 219-0753, (541) 703-3095",
        "Hey guys, here's some measurements th..."
      ]}
      trailingMeta="Apr 7"
      onPress={openConversationThread}
    />

    {/* PHONE NUMBERS */}
    <SectionHeader
      label="PHONE NUMBERS"
      action={{ label: "TEXT ALL...", color: "#4ab8d4", onPress: textAll }}
    />
    <PhoneRow
      number="(510) 219-0753"
      label="mobile"
      owner={null}                 /* primary contact's own number */
      onSMS={openSMS}
      onCall={initiateCall}
      smsBg="#7b8fcf"
      callBg="#2dc97a"
    />
    <PhoneRow
      number="(415) 827-4577"
      label="Sp..."           /* truncated relationship label */
      owner="Lisa Langevin"
      onSMS={openSMS}
      onCall={initiateCall}
      smsBg="#7b8fcf"
      callBg="#2dc97a"
    />

    {/* EMAILS */}
    <SectionHeader
      label="EMAILS"
      action={{ label: "EMAIL ALL...", color: "#4ab8d4", onPress: emailAll }}
    />
    <EmailRow
      address="jimlangevin@att.net"
      owner={null}
      onEmail={openCompose}
      emailBg="#5bc8f0"
    />
    <EmailRow
      address="the4langevins@att.net"
      owner="Lisa Langevin"
      onEmail={openCompose}
      emailBg="#5bc8f0"
    />

    {/* RELATIONSHIPS */}
    <SectionHeader
      label="RELATIONSHIPS"
      action={{ icon: "plus", color: "#4ab8d4", onPress: addRelationship }}
    />
    <RelationshipRow
      name="Lisa Langevin"
      relationship="Spouse"
      onPress={navigateToContact}
    />

    {/* DETAILS */}
    <SectionHeader label="DETAILS" />
    <DetailRow
      label="Assigned to"
      value="Matt Ryan"
      onPress={openAssignmentPicker}
    />
    {/* Additional detail rows below fold: Source, Stage, Lead Type, Tags, etc. */}

    <BottomSpacer height={100} />  {/* clears the FAB */}

  </ScrollView>

  {/* Floating Action Button */}
  <FAB
    icon="plus"
    size={56}
    bg="#5b8ecf"
    iconColor="#fff"
    position={{ bottom: 24, right: 16 }}
    onPress={openQuickActionSheet}
  />

</MobileShell>
```

### Key spacing / sizing constants

| Token | Value |
|---|---|
| Nav bar height | 44 pt |
| Hero section height | ~109 pt |
| Sub-tab strip height | 42 pt |
| Total fixed header height | ~195 pt (status 47 + nav 44 + hero 109 + tabs 42 — but hero/tabs sit inside one dark block) |
| Section header height | ~36 pt |
| Standard row height | 52 pt |
| Conversation row height | ~72 pt (3 text lines) |
| Action button size | 44 pt diameter |
| Action button gap | 8 pt |
| Row horizontal padding | 16 pt |
| Row divider | 1 pt, #e0e3e8 |
| FAB size | 56 pt diameter |
| FAB bottom margin | 24 pt |
| FAB right margin | 16 pt |

### Data bindings

| Component | Data source |
|---|---|
| Avatar initials + fill color | `contact.firstName[0] + contact.lastName[0]`; fill = hashed from name |
| Price badge "$655K" | `contact.price` formatted to nearest $K (from FUB budget/price field) |
| "Last communication May 21" | `contact.lastActivityAt` formatted relative/absolute |
| Recent Messages row | `GET /v1/textMessages?personId=<id>` or `/v1/emails?personId=<id>`, most recent thread |
| Phone number rows | `contact.phones[]` — each has `{number, type, person}` |
| Email rows | `contact.emails[]` — each has `{value, person}` |
| Relationship rows | `contact.relationships[]` — each has `{person, type}` |
| Assigned to | `contact.assignedTo.name` |

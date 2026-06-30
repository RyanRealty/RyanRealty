<!-- Mobile per-screen appendix. Original: IMG_5822.PNG | id: mob-02 | tiles: mob-tiles/mob-02_{full,t,m,b}.png -->

# mob-02 — fub-ios — Contact Detail (Info tab)

## Identity
- **app_source:** fub-ios — confirmed by dark slate-teal nav header, orange initials avatar, FUB's characteristic teal active-tab underline, and the Info / Comms / Homes / Notes / Calen sub-tab strip which is exclusive to FUB contact detail views.
- **module:** Contact Detail (Lead Profile) — Info tab active
- **screen:** Full contact profile, Info sub-tab. Reached by tapping a person row in the People list (or from an activity feed row), which pushes this view onto the navigation stack. No bottom tab bar is visible; the tab bar is suppressed at this navigation depth in FUB iOS.
- **iOS status bar (verbatim):** Left: "4:32" (white). Right: 2-bar cellular signal icon (white), WiFi arc icon (white), "100" battery with charging bolt (white).
- **URL bar:** N/A (native iOS app).

---

## Screen regions (top → bottom, 390×844 pt logical)

| Region | y-band (pt) | Height (est.) | Background color |
|---|---|---|---|
| iOS status bar | 0 – 54 | 54 pt | Same as nav header: #3a4e5f |
| Nav / header bar | 54 – 100 | 46 pt | #3a4e5f (dark slate-teal) |
| Contact hero block | 100 – 172 | 72 pt | #3a4e5f (continuous with header) |
| Sub-tab strip | 172 – 214 | 42 pt | #3a4e5f; active underline teal #29b5e8 |
| Scrollable content area | 214 – 844 | 630 pt | #eef1f4 (section headers) / #ffffff (rows) |
| Floating action button (FAB) | ~740 – 800 (float) | 56 pt diameter | #5685c5 blue, z-top |
| Bottom tab bar | NOT VISIBLE | — | Suppressed in pushed detail view |

---

## Nav / header bar (exact)

- **Left control:** Plain back chevron "<" (white, ~18 pt, SF-style angle bracket). No label text next to it. Tappable area covers full left quadrant. Pops view, returns to People list.
- **Center:** Empty — no title text in the nav bar itself. The contact name appears in the hero block below (FUB's detail layout keeps the name in the hero, not the nav title).
- **Right control:** Text button **"Edit"** (white, ~16 pt semibold). Tapping opens the contact edit form (full editable fields for name, phone, email, stage, source, tags, etc.).

---

## Bottom tab bar (exact)

**NOT RENDERED** on this screen. The FUB iOS contact detail view suppresses the bottom tab bar when pushed from the People tab. The tab bar (Inbox / Activity / Calendar / People / Deals) would be present on the list-level screens but is hidden here. No tab labels, icons, or badges are visible.

---

## Contact hero block (sub-nav region, y ~100–214 pt)

### Avatar
- Shape: Circle
- Diameter: ~56 pt
- Color: Orange ~#c8721a
- Content: White initials **"AC"** (bold, ~20 pt, SF Rounded or similar)
- Position: Left-aligned, vertically centered in the hero block, ~16 pt from left edge

### Name + status
- **Primary text:** "Andy Christensen" — white, ~22 pt semibold, left-aligned next to avatar
- **Secondary text:** "No communication yet" — muted gray-white ~#a8b8c8, ~14 pt regular, below the name

### Sub-tab strip (y ~172–214 pt)
All tabs sit in a horizontal scrollable strip. Background: same dark slate #3a4e5f. Active indicator: 2 pt teal underline #29b5e8 below the active tab label only.

| Order | Label | State | Text color |
|---|---|---|---|
| 1 | Info | ACTIVE | white, ~15 pt semibold |
| 2 | Comms | inactive | gray ~#8a9db0, ~15 pt regular |
| 3 | Homes | inactive | gray ~#8a9db0 |
| 4 | Notes | inactive | gray ~#8a9db0 |
| 5 | Calen (Calendar — truncated at right edge) | inactive | gray ~#8a9db0 |

Tabs are evenly spaced; the strip is horizontally scrollable (Calendar is clipped, implying at least one more tab exists off-screen — likely "Tasks" or "Files").

---

## Content — every element, in scroll order (y ~214 pt downward)

### Section: PHONE NUMBERS

**Section header row**
- Background: #eef1f4 (light blue-gray)
- Text: "PHONE NUMBERS" — uppercase, ~11 pt semibold, gray ~#8a9db0
- Height: ~36 pt

**Phone number row**
- Background: #ffffff
- Height: ~60 pt
- Left text block:
  - Primary: "7865808921" — dark near-black ~#1a2332, ~17 pt regular
  - Dash separator: " — " (em-dash literal)
  - Label: "(mobile)" — teal/FUB accent ~#29b5e8, ~15 pt regular
- Right action buttons (two circular icon buttons, right-aligned, ~16 pt from right edge):
  1. **SMS/Message button:** Circle ~40 pt diameter, fill ~#6b7fc4 (medium blue-purple). White speech-bubble icon with a dot (iMessage-style). Tap → opens text compose for this number.
  2. **Call button:** Circle ~40 pt diameter, fill #4cb87e (green). White phone handset icon. Tap → initiates phone call to this number.
- No chevron (the action buttons replace a detail disclosure)
- Bottom divider: 1 pt #e8ecf0

---

### Section: EMAILS

**Section header row**
- Background: #eef1f4
- Text: "EMAILS" — uppercase, ~11 pt semibold, gray ~#8a9db0
- Height: ~36 pt

**Email address row**
- Background: #ffffff
- Height: ~60 pt
- Left text: "AndyChristensen@heritageconstructions..." — dark ~#1a2332, ~17 pt regular (truncated with ellipsis because the full address exceeds available width)
  - Full address inferred: AndyChristensen@heritageconstructions.com (truncated)
- Right action button (one circular icon button):
  1. **Email button:** Circle ~40 pt diameter, fill ~#29b5e8 (FUB teal/light blue). White envelope icon. Tap → opens email compose for this address.
- Bottom divider: 1 pt #e8ecf0

---

### Section: RELATIONSHIPS

**Section header row**
- Background: #eef1f4
- Text: "RELATIONSHIPS" — uppercase, ~11 pt semibold, gray ~#8a9db0
- Height: ~36 pt

**Add relationship row**
- Background: #ffffff
- Height: ~52 pt
- Content: "Add Relationship..." — teal/FUB accent ~#29b5e8, ~17 pt regular (functions as a tappable link)
- No right-side element, no chevron
- Tap → opens a picker or modal to associate another contact as spouse, co-buyer, referral partner, etc.
- Bottom divider: 1 pt #e8ecf0

---

### Section: DETAILS

**Section header row**
- Background: #eef1f4
- Text: "DETAILS" — uppercase, ~11 pt semibold, gray ~#8a9db0
- Height: ~36 pt

All detail rows share the same anatomy:
- Background: #ffffff
- Height: ~52 pt
- **Left:** field label — gray ~#8a9db0, ~16 pt regular
- **Right:** field value — dark ~#1a2332, ~16 pt regular (or muted if empty)
- **Far right:** disclosure chevron ">" — gray ~#c0c8d0, ~13 pt
- Bottom divider: 1 pt #e8ecf0

**Row 1 — Assigned to**
- Label: "Assigned to"
- Value: "Matt Ryan"
- Tap → opens agent/broker picker

**Row 2 — Stage**
- Label: "Stage"
- Value: "Lead"
- Tap → opens stage picker (Lead / Active / Under Contract / Past Client / etc.)

**Row 3 — Source**
- Label: "Source"
- Value: "Ryan-Realty.com"
- Tap → opens source picker

**Row 4 — Tags**
- Label: "Tags"
- Value: "audience:buyer, Bounced, broker:matt" (truncated — more tags may exist beyond the visible right-side area before the chevron)
- Value text size: ~15 pt (slightly smaller than other rows to fit multiple tags on one line)
- Tap → opens tag editor (add/remove tags)

**Row 5 — Time frame**
- Label: "Time frame"
- Value: (empty — no value text rendered)
- Tap → opens time frame picker (Now / 3 months / 6 months / 1 year / 1-2 years / etc.)

**Row 6 — Collaborators**
- Label: "Collaborators"
- Value: "No collaborators"
- Value text color: muted gray ~#8a9db0 (indicates empty/none state)
- Tap → opens collaborator picker to add co-agents

---

## Floating Action Button (FAB)

- Shape: Circle, ~56 pt diameter
- Color: Medium blue ~#5685c5
- Icon: White "+" (plus sign), ~22 pt stroke weight
- Position: Bottom-right, ~20 pt from right edge, ~80 pt from bottom of visible content (floats over scroll)
- Z-order: Above all scroll content
- Tap behavior [INFERRED]: Opens a bottom action sheet or modal with quick-add options relevant to this contact — e.g. "Add Note", "Log Activity", "Schedule Appointment", "Create Task", "Send Message"

---

## Colors, type & iconography

### Color palette
| Role | Hex estimate |
|---|---|
| Nav / hero header background | #3a4e5f |
| Active tab underline / accent | #29b5e8 (FUB teal) |
| Section header background | #eef1f4 |
| Content row background | #ffffff |
| Contact initials avatar | #c8721a (orange) |
| Avatar initials text | #ffffff |
| Nav text (name, Edit, Back) | #ffffff |
| Active tab label | #ffffff |
| Inactive tab label | #8a9db0 |
| Section header label | #8a9db0 |
| Detail row label (left) | #8a9db0 |
| Detail row value (right) | #1a2332 |
| Empty / none value text | #8a9db0 |
| "Add Relationship..." link | #29b5e8 |
| Disclosure chevron ">" | #c0c8d0 |
| Row divider | #e8ecf0 |
| SMS action button | #6b7fc4 (blue-purple) |
| Call action button | #4cb87e (green) |
| Email action button | #29b5e8 (FUB teal) |
| FAB | #5685c5 (blue) |
| FAB icon | #ffffff |

### Typography impressions
- Contact name: ~22 pt semibold, white
- Sub-header label: ~14 pt regular, muted gray-white
- Tab labels: ~15 pt, semibold (active) / regular (inactive)
- Section header labels: ~11 pt semibold, ALL CAPS, gray
- Detail row labels (left): ~16 pt regular, gray
- Detail row values (right): ~16–17 pt regular, near-black
- Action tappable link ("Add Relationship..."): ~17 pt regular, teal
- Phone / email primary text: ~17 pt regular, near-black
- Phone type label "(mobile)": ~15 pt regular, teal

### Iconography
- Back chevron: SF Symbols "chevron.left" style, white, ~18 pt
- SMS/message button icon: Speech bubble with dot, white on blue-purple circle
- Call button icon: Phone handset, white on green circle
- Email button icon: Envelope outline, white on teal circle
- Disclosure chevron: ">" right-pointing chevron, gray, ~13 pt
- FAB icon: "+" plus, white on blue circle

---

## Interactions & gestures [INFERRED unless noted]

| Interaction | Target | Behavior |
|---|---|---|
| Tap "< " (back) | Nav back control | Pop view → return to People list |
| Tap "Edit" | Nav right | Push full edit form for this contact |
| Tap contact name / avatar (hero) [INFERRED] | Hero block | Possible no-op or expand hero; most likely no-op |
| Tap "Info" tab | Sub-tab (already active) | No-op / scroll to top |
| Tap "Comms" tab | Sub-tab | Switch content to comms timeline (emails, texts, calls log) |
| Tap "Homes" tab | Sub-tab | Switch content to homes/properties associated with contact |
| Tap "Notes" tab | Sub-tab | Switch content to notes list |
| Tap "Calen(dar)" tab | Sub-tab | Switch content to calendar/appointments for this contact |
| Tap SMS button (blue-purple) | Phone row | Open SMS compose → pre-fills to 7865808921 |
| Tap Call button (green) | Phone row | Initiate phone call to 7865808921 via FUB dialer or native phone |
| Tap email address row or email button (teal) | Email row | Open email compose → pre-fills to AndyChristensen@heritageconstructions... |
| Tap "Add Relationship..." | Relationships row | Present modal/picker: select relationship type + search for a contact |
| Tap "Assigned to" row | Details row | Present agent picker sheet |
| Tap "Stage" row | Details row | Present stage picker sheet (Lead, Active, Under Contract, etc.) |
| Tap "Source" row | Details row | Present source picker sheet |
| Tap "Tags" row | Details row | Present tag editor (chip-style multi-select + free-form add) |
| Tap "Time frame" row | Details row | Present time frame picker (Now / 3 months / 6–12 months / 1+ year) |
| Tap "Collaborators" row | Details row | Present collaborator picker (add broker/agent) |
| Tap FAB "+" | Floating button | Present bottom action sheet: Log Call / Send Text / Send Email / Add Note / Create Task / Schedule Appointment |
| Swipe right (edge) | Screen | Pop to People list (iOS standard swipe-back gesture) |
| Pull-to-refresh | Scrollable content | Reload contact data from FUB server |
| Long-press phone/email [INFERRED] | Phone or email row | Copy to clipboard |

---

## Build notes (component tree)

```
<MobileShell safeArea bg="#3a4e5f">

  <StatusBar style="light-content" bg="#3a4e5f" />

  <NavBar bg="#3a4e5f" borderBottom="none">
    <BackButton icon="chevron-left" color="#ffffff" onPress={popToList} />
    {/* center: empty — name is in hero, not nav title */}
    <TextButton label="Edit" color="#ffffff" weight="semibold" onPress={openEditForm} />
  </NavBar>

  <ContactHero bg="#3a4e5f" px={16} py={12} flexDirection="row" alignItems="center" gap={14}>
    <InitialsAvatar
      initials="AC"
      size={56}
      bgColor="#c8721a"
      textColor="#ffffff"
      textSize={20}
      fontWeight="bold"
      shape="circle"
    />
    <View>
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "600" }}>
        Andy Christensen
      </Text>
      <Text style={{ color: "#a8b8c8", fontSize: 14, fontWeight: "400", marginTop: 3 }}>
        No communication yet
      </Text>
    </View>
  </ContactHero>

  <SubTabStrip
    bg="#3a4e5f"
    activeUnderlineColor="#29b5e8"
    activeUnderlineHeight={2}
    tabs={[
      { key: "info",    label: "Info",     active: true  },
      { key: "comms",   label: "Comms",    active: false },
      { key: "homes",   label: "Homes",    active: false },
      { key: "notes",   label: "Notes",    active: false },
      { key: "cal",     label: "Calendar", active: false },
      /* possibly more off-screen */
    ]}
    labelActiveColor="#ffffff"
    labelInactiveColor="#8a9db0"
    labelSize={15}
    scrollable={true}
    height={42}
  />

  <ScrollView bg="#eef1f4" flex={1}>

    {/* ── PHONE NUMBERS ── */}
    <SectionHeader label="PHONE NUMBERS" />
    <ContactActionRow
      bg="#ffffff"
      height={60}
      primaryText="7865808921"
      separator=" — "
      labelText="(mobile)"
      labelColor="#29b5e8"
      actions={[
        { icon: "message-bubble", bg: "#6b7fc4", onPress: () => openSMS("7865808921") },
        { icon: "phone-handset",  bg: "#4cb87e", onPress: () => initiateCall("7865808921") },
      ]}
    />
    <RowDivider />

    {/* ── EMAILS ── */}
    <SectionHeader label="EMAILS" />
    <ContactActionRow
      bg="#ffffff"
      height={60}
      primaryText="AndyChristensen@heritageconstructions..."
      actions={[
        { icon: "envelope", bg: "#29b5e8", onPress: () => openEmail("AndyChristensen@heritageconstructions.com") },
      ]}
    />
    <RowDivider />

    {/* ── RELATIONSHIPS ── */}
    <SectionHeader label="RELATIONSHIPS" />
    <LinkRow
      bg="#ffffff"
      height={52}
      label="Add Relationship..."
      labelColor="#29b5e8"
      onPress={openRelationshipPicker}
    />
    <RowDivider />

    {/* ── DETAILS ── */}
    <SectionHeader label="DETAILS" />
    <DetailRow label="Assigned to"   value="Matt Ryan"                           onPress={openAgentPicker}      />
    <DetailRow label="Stage"          value="Lead"                                onPress={openStagePicker}      />
    <DetailRow label="Source"         value="Ryan-Realty.com"                     onPress={openSourcePicker}     />
    <DetailRow label="Tags"           value="audience:buyer, Bounced, broker:matt" onPress={openTagEditor}       valueSize={15} />
    <DetailRow label="Time frame"     value=""                                    onPress={openTimeframePicker}  />
    <DetailRow label="Collaborators"  value="No collaborators"  valueColor="#8a9db0" onPress={openCollaboratorPicker} />

  </ScrollView>

  <FAB
    icon="plus"
    bg="#5685c5"
    iconColor="#ffffff"
    size={56}
    position="absolute"
    bottom={28}
    right={20}
    onPress={openQuickAddSheet}
    shadow={{ color: "#5685c5", opacity: 0.35, radius: 8, offsetY: 4 }}
  />

  {/* Bottom tab bar NOT rendered at this navigation depth */}

</MobileShell>
```

### Key data bindings
| Component | Binds to |
|---|---|
| `InitialsAvatar` | `contact.firstName[0] + contact.lastName[0]`, avatar color from deterministic hash of contact.id |
| `ContactHero` name | `contact.fullName` |
| `ContactHero` subtitle | `contact.lastCommunicationAt` → "No communication yet" when null |
| `SubTabStrip` | Static tab config; `activeTab` state |
| Phone number row | `contact.phones[]` — one row per phone; `phone.number`, `phone.type` → "(mobile)" etc. |
| Email row | `contact.emails[]` — one row per email; `email.address` |
| Assigned to | `contact.assignedTo.name` |
| Stage | `contact.stage` |
| Source | `contact.source` |
| Tags | `contact.tags[]` → joined with ", " |
| Time frame | `contact.timeFrame` (nullable) |
| Collaborators | `contact.collaborators[]` → "No collaborators" when empty |

### Spacing / sizing constants
- Section header height: 36 pt, px 16 pt
- Action row height (phone/email): 60 pt, px 16 pt
- Detail row height: 52 pt, px 16 pt
- Action button circle diameter: 40 pt, gap between buttons: 10 pt
- FAB diameter: 56 pt, bottom: 28 pt, right: 20 pt
- Row divider: 1 pt, color #e8ecf0
- Sub-tab strip height: 42 pt, active underline: 2 pt
- Avatar circle diameter: 56 pt
- Hero block total height: ~72 pt (including avatar + name/subtitle stack)

<!-- Mobile per-screen appendix. Original: IMG_6018.PNG | id: mob-50 | tiles: mob-tiles/mob-50_{full,t,m,b}.png -->

# mob-50 — fub-ios — Contact Detail: Info Tab (Mary Bowman)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact detail for Mary Bowman, "Info" sub-tab active — shows Recent Messages, Phone Numbers, Emails, and Relationships sections
- **how to reach:** Tap any contact row in People tab (or from Inbox/Activity), pushes this detail screen
- **iOS status bar:** Time "7:44" left; signal bars (2 of 4 filled), WiFi icon, battery "16" (yellow low-battery outline) — all white on dark header
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (top → bottom, 390×844 pt logical)

| Region | y-band (pt) | Height est. | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark teal #2d3f4f (inherits header) |
| Nav bar | 54–98 | 44 pt | Dark teal #2d3f4f |
| Contact hero (avatar + name + subtitle) | 98–172 | 74 pt | Dark teal #2d3f4f |
| Sub-tab strip | 172–210 | 38 pt | Dark teal #2d3f4f; active indicator cyan #29b5c5 |
| Scrollable content | 210–844+ | variable | White #ffffff / section headers light gray #f2f4f6 |
| Bottom tab bar | not visible in screenshot | — | — (hidden on push detail or cropped) |

---

## Nav / header bar (exact)

- **Left control:** "<" back chevron, white, ~22 pt, left-aligned ~16 pt from edge. Taps to pop back to the People list.
- **Center:** empty — no title text in the nav bar itself; identity is established in the hero block below.
- **Right control:** "Edit" — plain white text, ~17 pt regular weight, right-aligned ~16 pt from edge. Taps to push contact edit form.

---

## Contact hero block (below nav bar, on dark bg)

- **Avatar:** Circle, ~52 pt diameter. Background: muted periwinkle/lavender ~#7b7fc4. White bold initials "MB", ~20 pt, centered. No border.
- **Name:** "Mary Bowman" — white, ~20 pt, medium/semibold weight, left of center aligned with avatar.
- **Subtitle:** "Last communication Jun 22" — light gray ~#a8b4bf, ~13 pt regular, directly under name.
- Layout: avatar floats left (~16 pt margin), name + subtitle stack to its right, vertically centered.

---

## Sub-tab strip (exact)

Horizontally scrollable tab row pinned to bottom of dark header area. Tabs visible left→right:

| Order | Label | State | Indicator |
|---|---|---|---|
| 1 | Info | ACTIVE | White text + 2 pt cyan underline bar (#29b5c5 / ~#4dd0e1) full tab width |
| 2 | Comms | inactive | Muted gray ~#8a9aaa text, no underline |
| 3 | Homes | inactive | Muted gray text |
| 4 | Notes | inactive | Muted gray text |
| 5 | Caler… | inactive | Truncated ("Calendar"), tab scrolls right to reveal more |

- More tabs likely exist off-screen to the right (horizontally scrollable).
- Tab height ~38 pt. Each tab label ~14 pt. Active underline bar sits flush at bottom of strip.
- No FAB or badge on sub-tabs.

---

## Bottom tab bar (exact)

Not visible in this screenshot. FUB's bottom tab bar (Inbox / Activity / Calendar / People / Deals) is hidden or scrolled off on pushed detail views, or cropped by screenshot bounds. The active tab before navigation was likely "People".

---

## Content — every element, in order (scrollable area, y ~210 pt downward)

### Section header 1: RECENT MESSAGES

- Background: light gray #f2f4f6, full width, height ~28 pt
- Label: "RECENT MESSAGES" — all caps, small (~11 pt), gray ~#8a9aaa, left-padded ~16 pt
- No right action on this header

---

**Row 1 — Group SMS thread**
- **Avatar:** Circle ~44 pt, periwinkle ~#7b7fc4. Icon: two overlapping speech bubbles (group thread indicator), white, ~22 pt.
- **Primary text (bold):** "Matt Ryan, Mary Bowman, Yah…" — truncated, ~15 pt semibold, dark ~#1a2733. Date right-aligned: "Jun 12" — gray ~#8a9aaa, ~13 pt.
- **Secondary line 1:** "(541) 703-3095, (714) 337-6028, (909) 343-0531" — gray ~#5a6a77, ~13 pt regular.
- **Secondary line 2:** "Good morning Mary and Yahson. Please…" — gray ~#5a6a77, ~13 pt regular, truncated.
- **Divider:** 1 px hairline #e0e4e8, inset to content (not full-bleed, ~16 pt left margin).
- **Tap action:** Opens the group SMS/text thread in Comms view.

**Row 2 — SMS from Mary Bowman**
- **Avatar:** Circle ~44 pt, periwinkle ~#7b7fc4. Icon: single speech bubble (chat), white, ~20 pt.
- **Primary text (bold):** "Mary Bowman" — ~15 pt semibold. Date right-aligned: "May 19" — gray.
- **Secondary:** "Ok thank you so much!…" — gray, ~13 pt, truncated.
- **Divider:** 1 px hairline, same style.
- **Tap action:** Opens that individual SMS thread.

**Row 3 — SMS from Mary Bowman**
- **Avatar:** Circle ~44 pt, periwinkle ~#7b7fc4. Single speech bubble icon, white.
- **Primary text (bold):** "Mary Bowman" — ~15 pt semibold. Date right-aligned: "Jan 28" — gray.
- **Secondary:** "Ok I have this scheduled with Bend Lock…" — gray, truncated.
- **No divider below** (section changes).
- **Tap action:** Opens that SMS thread.

---

### Section header 2: PHONE NUMBERS

- Background: light gray #f2f4f6, height ~28 pt.
- Left label: "PHONE NUMBERS" — all caps, ~11 pt, gray ~#8a9aaa.
- Right action: "TEXT ALL…" — cyan/teal ~#29b5c5, ~13 pt, right-padded ~16 pt. Taps to compose a group text to all listed numbers.

**Phone row 1:**
- **Left text:** "(714) 337-6028" — dark ~#1a2733, ~15 pt regular.
- **Type label:** "— (mobile)" — cyan ~#29b5c5, ~13 pt, inline after number.
- **Right action buttons (two circles, ~36 pt each, 8 pt gap):**
  - Circle 1: periwinkle ~#7b7fc4, white speech bubble icon → opens SMS compose to this number.
  - Circle 2: green ~#4caf50, white phone handset icon → initiates call to this number.
- **Divider:** 1 px hairline.

**Phone row 2:**
- **Left text:** "9093430531" — dark, ~15 pt (no formatting parens/dashes).
- **Associated name + type:** "— Yahson Terry (mobi…" — cyan for type label, "Yahson Terry" in muted gray, truncated.
- **Right action buttons:** Same pattern — periwinkle SMS circle + green call circle.
- **No divider below** (section changes).

---

### Section header 3: EMAILS

- Background: light gray #f2f4f6, height ~28 pt.
- Left label: "EMAILS" — all caps, ~11 pt, gray.
- Right action: "EMAIL ALL…" — cyan ~#29b5c5, ~13 pt. Taps to compose email to all addresses.

**Email row 1:**
- **Left text:** "msbrilliantdisguise@gmail.com" — dark ~#1a2733, ~15 pt.
- **Right action button:** Light blue circle ~36 pt, white envelope icon → compose email to this address.
- **Divider:** 1 px hairline.

**Email row 2:**
- **Left text:** "yahsonkt@hotmail.com — Yahson Terry" — dark text, "Yahson Terry" appears as an associated-contact attribution in muted gray.
- No action button visible (partially obscured by FAB).

---

### FAB (Floating Action Button)

- **Position:** Bottom-right corner of viewport, approximately x ~342 pt, y ~780 pt (over the content area, above safe area bottom).
- **Primary FAB:** Large circle ~56 pt, periwinkle/blue ~#5b6dba or gradient blue. White "+" glyph ~24 pt, bold. **Action:** Opens a compose/add action sheet (add phone, email, note, log activity — [INFERRED]).
- **Secondary mini-FAB (revealed/animating):** Smaller circle ~40 pt, lighter blue ~#4fc3f7, white envelope icon. Visible overlapping just above the primary FAB — likely a quick "compose email" shortcut that appears when FAB is expanded or mid-animation.

---

### Section header 4: RELATIONSHIPS (partially visible, bottom of viewport)

- Background: light gray #f2f4f6.
- Left label: "RELATIONSHIPS" — all caps, ~11 pt, gray.
- Right control: "+" — cyan ~#29b5c5. Taps to add a relationship link to another contact.
- Content rows below are scrolled off screen.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar / hero / sub-tab bg | Dark teal #2d3f4f (approximately) |
| Sub-tab active underline | Cyan #29b5c5 / #4dd0e1 |
| Section header bg | Light gray #f2f4f6 |
| Content rows bg | White #ffffff |
| Primary text | Dark navy ~#1a2733 |
| Secondary / meta text | Gray ~#5a6a77 |
| Date / label text | Gray ~#8a9aaa |
| Cyan accent (TEXT ALL, EMAIL ALL, type labels, RELATIONSHIPS +) | ~#29b5c5 |
| Avatar / SMS circle bg | Periwinkle lavender ~#7b7fc4 |
| Call button circle bg | Green ~#4caf50 |
| Email action circle | Light blue ~#4fc3f7 |
| FAB primary | Blue-periwinkle ~#5b6dba |
| Row divider | 1 px #e0e4e8 |
| Active tab label | White |
| Inactive tab label | ~#8a9aaa |
| Font: primary | System SF Pro Display/Text (iOS), semibold for row titles |
| Font: section headers | SF Pro Text, ~11 pt, uppercase, letter-spaced |
| Battery indicator | Yellow (low battery), ~16% |

**FUB accent is teal/cyan (~#29b5c5), NOT navy.** This is the FUB iOS app, not the in-house web CRM (which uses navy #102742 / cream #faf8f4).

---

## Interactions & gestures

- **Tap "<" back chevron:** Pop to People list (or wherever this was pushed from). [INFERRED standard iOS nav]
- **Tap "Edit":** Push contact edit form — all fields editable. [INFERRED]
- **Tap sub-tab (Info/Comms/Homes/Notes/Calendar):** Switches scrollable content pane in-place, no navigation push; header/hero stays fixed.
- **Scroll content area:** Header hero + sub-tab strip remain STICKY at top; content below scrolls. [INFERRED — FUB standard pattern]
- **Tap RECENT MESSAGES row:** Pushes into the specific conversation thread (SMS or group SMS).
- **Tap phone number SMS circle (periwinkle):** Opens in-app SMS compose to that number.
- **Tap phone number call circle (green):** Initiates phone call via device dialer (possibly FUB dialer).
- **Tap "TEXT ALL…":** Opens group SMS compose to all numbers in the list.
- **Tap email address email circle:** Opens in-app email compose to that address.
- **Tap "EMAIL ALL…":** Opens group email compose to all addresses.
- **Tap FAB "+":** Expands into a speed-dial of action options (add communication, add note, log activity, etc.). [INFERRED — FAB is animating/partially expanded in screenshot]
- **Tap "+" next to RELATIONSHIPS:** Opens picker to search + link another contact as a relationship.
- **Swipe left on rows:** Likely reveals delete/archive/call/text quick actions. [INFERRED — FUB standard]
- **Pull to refresh:** Refreshes contact data from FUB server. [INFERRED]
- **Horizontal swipe on sub-tab strip:** Scrolls to reveal additional tabs (Calendar, etc.) [INFERRED from truncated "Caler…"]

---

## Build notes (component tree)

```
<ContactDetailShell>

  {/* Sticky header block — stays fixed above scroll */}
  <ContactDetailHeader bgColor="#2d3f4f">
    <StatusBar time="7:44" signal={2} wifi battery={16} textColor="white" />
    <NavBar
      left={<BackChevron color="white" onTap={popNavigation} />}
      right={<TextButton label="Edit" color="white" onTap={pushEditForm} />}
      bg="transparent"  {/* inherits header bg */}
    />
    <ContactHero>
      <Avatar
        initials="MB"
        size={52}
        bgColor="#7b7fc4"
        textColor="white"
        fontWeight="bold"
        fontSize={20}
      />
      <Stack spacing={2}>
        <Text style="name" color="white" size={20} weight="semibold">Mary Bowman</Text>
        <Text style="subtitle" color="#a8b4bf" size={13}>Last communication Jun 22</Text>
      </Stack>
    </ContactHero>
    <SubTabStrip
      tabs={["Info","Comms","Homes","Notes","Calendar"]}
      activeTab="Info"
      activeColor="white"
      activeIndicatorColor="#29b5c5"
      inactiveColor="#8a9aaa"
      indicatorHeight={2}
      scrollable={true}
    />
  </ContactDetailHeader>

  {/* Scrollable content */}
  <ScrollView>

    {/* RECENT MESSAGES */}
    <SectionHeader label="RECENT MESSAGES" />
    <MessageRow
      avatarIcon="group-chat"       {/* two overlapping bubbles */}
      avatarBg="#7b7fc4"
      primaryText="Matt Ryan, Mary Bowman, Yah…"
      date="Jun 12"
      line2="(541) 703-3095, (714) 337-6028, (909) 343-0531"
      line3="Good morning Mary and Yahson. Please…"
      onTap={openThread}
    />
    <MessageRow
      avatarIcon="chat-bubble"
      avatarBg="#7b7fc4"
      primaryText="Mary Bowman"
      date="May 19"
      line2="Ok thank you so much!…"
      onTap={openThread}
    />
    <MessageRow
      avatarIcon="chat-bubble"
      avatarBg="#7b7fc4"
      primaryText="Mary Bowman"
      date="Jan 28"
      line2="Ok I have this scheduled with Bend Lock…"
      onTap={openThread}
    />

    {/* PHONE NUMBERS */}
    <SectionHeader
      label="PHONE NUMBERS"
      rightAction={<CyanLink label="TEXT ALL…" onTap={openGroupSMS} />}
    />
    <PhoneRow
      number="(714) 337-6028"
      type="mobile"
      typeColor="#29b5c5"
      actions={[
        <ActionCircle icon="chat" bg="#7b7fc4" onTap={openSMS} />,
        <ActionCircle icon="phone" bg="#4caf50" onTap={initCall} />
      ]}
    />
    <PhoneRow
      number="9093430531"
      associatedName="Yahson Terry"
      type="mobile"
      typeColor="#29b5c5"
      actions={[
        <ActionCircle icon="chat" bg="#7b7fc4" onTap={openSMS} />,
        <ActionCircle icon="phone" bg="#4caf50" onTap={initCall} />
      ]}
    />

    {/* EMAILS */}
    <SectionHeader
      label="EMAILS"
      rightAction={<CyanLink label="EMAIL ALL…" onTap={openGroupEmail} />}
    />
    <EmailRow
      address="msbrilliantdisguise@gmail.com"
      action={<ActionCircle icon="envelope" bg="#4fc3f7" onTap={composeEmail} />}
    />
    <EmailRow
      address="yahsonkt@hotmail.com"
      associatedName="Yahson Terry"
    />

    {/* RELATIONSHIPS */}
    <SectionHeader
      label="RELATIONSHIPS"
      rightAction={<CyanIconButton icon="plus" color="#29b5c5" onTap={addRelationship} />}
    />
    {/* rows scrolled off screen */}

  </ScrollView>

  {/* FAB — position: fixed, bottom-right */}
  <FloatingActionButton
    icon="plus"
    size={56}
    bg="#5b6dba"
    iconColor="white"
    position={{ bottom: 32, right: 16 }}
    onTap={expandActions}
    {/* Speed-dial expansion reveals sub-actions (email, SMS, note, etc.) */}
  />

</ContactDetailShell>
```

### Spacing / sizing notes
- Avatar size: 52 pt diameter
- Action circle buttons (phone/SMS/email): 36 pt diameter, 8 pt gap between pair
- FAB: 56 pt diameter
- Section header height: ~28 pt, 16 pt left padding, uppercase 11 pt SF Pro Text, letter-spacing ~0.5 pt
- Row padding: 16 pt horizontal, 12 pt vertical per row
- Sub-tab strip height: 38 pt; tab font ~14 pt SF Pro Text
- Hero block: 74 pt total height including avatar + text stack
- Sticky header total (nav + hero + tabs): ~156 pt

### Data bindings
- Contact: `{ id, fullName, initials, avatarColor, lastCommunicationDate }`
- Messages: `crm_timeline` or FUB `/v1/textMessages?personId=` — sorted desc by date, show last 3
- Phone numbers: `person.phoneNumbers[]` — `{ number, type, associatedContactName? }`
- Emails: `person.emails[]` — `{ address, associatedContactName? }`
- Relationships: `person.relationships[]` — `{ relatedPerson, relationshipType }`

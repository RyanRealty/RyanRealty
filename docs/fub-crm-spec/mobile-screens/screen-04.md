<!-- Mobile per-screen appendix. Original: IMG_5824.PNG | id: mob-04 | tiles: mob-tiles/mob-04_{full,t,m,b}.png -->

# mob-04 — fub-ios — Contact Detail: Comms Tab

## Identity

- **app_source:** fub-ios (Follow Up Boss native iOS app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact detail view with the "Comms" sub-tab active, showing the email communication history for a lead
- **how to reach:** People tab → tap any contact row → lands on Info tab → tap "Comms" sub-tab
- **iOS status bar:** Time "4:32" left-aligned white text; right side: cellular signal (2 of 4 bars), WiFi icon, battery "100" with charging indicator — all white on dark header background
- **URL bar:** N/A — this is the native FUB iOS app, not a web view

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 | #2d3f50 (dark slate-teal) |
| Nav bar (back only) | 47–91 | 44 | #2d3f50 |
| Contact hero (avatar + name + subtitle) | 91–185 | 94 | #2d3f50 |
| Sub-tab strip | 185–222 | 37 | #2d3f50 fading to white at bottom; active tab underline bleeds into content |
| Scrollable content area | 222–790 | 568 | #FFFFFF (rows); #EEF1F5 (empty space below last row) |
| FAB (floating, fixed) | ~758–814 | 56 | — (floats over content) |
| Bottom tab bar | NOT VISIBLE in this screenshot | — | — |

---

## Nav / header bar (exact)

**Left control:** Single left-pointing chevron "‹" (~22pt), white, ~16pt from left edge, vertically centered in the 44pt nav bar. Tapping pops back to the previous People list screen.

**Center:** Empty — no title text in the nav bar row itself. The contact name is displayed in the hero block immediately below, not inline in the nav bar.

**Right controls:** None visible.

---

## Sub-tab strip (exact)

Five tabs rendered as text labels on the dark header background, separated by equal spacing, horizontally scrollable (rightmost tab "Calen" is clipped, indicating a fifth or sixth tab exists off-screen):

| Order | Label | State | Indicator |
|---|---|---|---|
| 1 | Info | Inactive | No underline; muted gray text ~#8A9BB0 |
| 2 | Comms | **Active** | White text; solid blue underline bar ~3pt height, color ~#5BA4CF, spans full label width |
| 3 | Homes | Inactive | Muted gray text ~#8A9BB0 |
| 4 | Notes | Inactive | Muted gray text ~#8A9BB0 |
| 5 | Calen[dar] | Inactive (clipped) | Muted gray, truncated by right edge — full label is "Calendar" |

Font: system sans-serif ~15pt medium weight. Active tab "Comms" appears slightly bolder/white vs gray inactive.

---

## Contact hero block (exact)

Rendered inside the dark header, below the nav bar.

**Avatar:** Circle, ~52pt diameter, background red ~#E53935, white initials "TW" in bold system font ~18pt. Positioned ~16pt from left edge, vertically centered in the hero block.

**Name:** "Theresa Wise" — white, ~22pt, semibold, left-aligned, right of avatar with ~12pt gap.

**Subtitle:** "Last communication Jun 17" — muted light-gray ~#9BB5CA, ~13pt regular, below name, same left alignment.

---

## Bottom tab bar (exact)

Not captured in this screenshot. FUB iOS standard bottom tab bar has five tabs: **Inbox | Activity | Calendar | People | Deals**. The People tab would be active (since we navigated from People). The tab bar is presumed present behind/below the viewport in this screenshot crop; its absence suggests the screen was captured without the safe-area bottom or the tab bar is obscured by the FAB.

**FAB:** Blue circle ~56pt diameter, color ~#5BA4CF (medium steel blue), white "+" glyph (~22pt stroke weight). Fixed-position bottom-right, ~20pt inset from right edge, ~20pt above the bottom safe area. Tapping opens a compose/log action sheet (email, text, call, note — standard FUB options).

---

## Content — every element, in order

### Row 1 — Inbound email thread

**Layout:** Full-width row, white background, left icon + right-aligned date + multi-line text block.

- **Left icon:** Blue envelope icon (~24pt square), color ~#5BA4CF, vertically anchored to top of text block. The envelope is a standard outlined-envelope glyph (two diagonal lines forming the flap, rectangular body).
- **Top-right:** "Jun 17" — muted gray ~#9E9E9E, ~12pt.
- **Line 1 (subject/primary):** "Re: Your Bend home search is set, Theresa" — dark near-black ~#1A1A1A, ~15pt medium weight.
- **Line 2 (sender + thread count):** "Theresa Wise" — dark ~#1A1A1A, ~15pt regular; immediately followed by a gray circle badge containing white numeral "3" (~16pt diameter, background ~#9E9E9E). The badge indicates 3 messages in the thread or 3 participants.
- **Line 3 (body preview):** "Hi Matt, Great thanks for the confirmation and working on the update! Thank you for..." — muted gray ~#9E9E9E, ~13pt regular, truncated with ellipsis at approximately 2 lines.
- **Row padding:** ~12pt top/bottom, ~16pt left (after icon), ~16pt right.
- **Divider:** 1pt horizontal line, light gray ~#E0E3E8, full width, at row bottom.
- **Tappable:** Entire row. Opens the email thread detail view.
- **Swipe actions:** [INFERRED] Left-swipe likely reveals archive/delete actions; right-swipe may mark as unread or tag.

### Row 2 — Outbound archived email

**Layout:** Same template as Row 1 but with an additional "archived" status label and an open-tracking sub-line.

- **Status label (above sender):** "archived" — lowercase, muted gray ~#9E9E9E, ~11pt regular. Appears as a subtle descriptor above the sender name (not a badge, just plain text).
- **Left icon:** Blue envelope icon (~24pt), same style as Row 1.
- **Top-right:** "Jun 17" — muted gray, ~12pt.
- **Sender line:** "Matt Ryan" — dark ~#1A1A1A, ~15pt semibold. (Outbound from the broker.)
- **Body preview:** "archived (https://ryan-realty.com?_pxl=djoxLGM6OGZiOWNkMzYzOTM5MzIs..." — muted gray ~#9E9E9E, ~13pt. The visible URL contains a pixel-tracking parameter. Truncated with "..." at approximately 2 lines.
- **Open-tracking sub-line:** 
  - Orange/amber envelope icon (~16pt), color ~#F5A023 (warm orange), outlined style
  - "1 open" — dark text ~#1A1A1A, ~13pt medium
  - "Last opened Jun 17" — muted gray ~#9E9E9E, ~13pt regular
  - All on one line, left-aligned with the text column
- **Row padding:** ~12pt top/bottom.
- **No divider visible** below Row 2 (transitions to empty gray area).
- **Tappable:** Entire row. Opens email detail/sent email view.

### Empty state area

Below Row 2, the remaining visible content area is a flat light gray ~#EEF1F5. No empty-state message, illustration, or call-to-action is shown — the list simply ends and the area fills with the background color. The FAB floats over this area.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header/nav background | ~#2d3f50 (dark slate-teal, NOT pure navy) |
| Active tab underline | ~#5BA4CF (FUB accent blue) |
| Active tab text | #FFFFFF |
| Inactive tab text | ~#8A9BB0 |
| Contact name text | #FFFFFF |
| Last-comm subtitle | ~#9BB5CA |
| Back chevron | #FFFFFF |
| Avatar background | ~#E53935 (red — color is contact-assigned, not a fixed brand color) |
| Avatar initials | #FFFFFF |
| Row primary text (sender/subject) | ~#1A1A1A |
| Row date text | ~#9E9E9E |
| Row preview text | ~#9E9E9E |
| "archived" label | ~#9E9E9E |
| Row divider | ~#E0E3E8 |
| Email icon (blue) | ~#5BA4CF |
| Open-tracking icon (orange) | ~#F5A023 |
| Content background | #FFFFFF |
| Empty-area background | ~#EEF1F5 |
| FAB background | ~#5BA4CF |
| FAB icon | #FFFFFF |

**Type scale (impressions):**
- Contact name: ~22pt semibold
- Sub-tab labels: ~15pt medium (active) / regular (inactive)
- Row subject/sender (primary): ~15pt medium
- Row date: ~12pt regular
- Row preview text: ~13pt regular
- "archived" label: ~11pt regular
- Open-tracking line: ~13pt (mixed weights)

**This is FUB's blue/teal accent system** (~#5BA4CF), not the Ryan Realty in-house navy #102742 / cream #faf8f4 palette.

**Thread count badge:** Gray filled circle ~16pt diameter, white numeral inside, ~12pt bold. Sits inline after sender name text.

---

## Interactions & gestures [INFERRED]

| Target | Gesture | Action |
|---|---|---|
| Back chevron "‹" | Tap | Pop back to People/Contacts list |
| "Info" sub-tab | Tap | Switch to Info tab (contact fields, source, stage, assigned agent, tags, etc.) |
| "Comms" sub-tab | Already active | No-op |
| "Homes" sub-tab | Tap | Switch to Homes tab (saved searches, matched listings) |
| "Notes" sub-tab | Tap | Switch to Notes tab (broker notes log) |
| "Calendar" sub-tab | Tap | Switch to Calendar tab (appointments, reminders for this contact) |
| Sub-tab strip | Horizontal swipe | Scroll to reveal additional tabs beyond "Calendar" |
| Email row (Row 1) | Tap | Push to email thread detail view |
| Email row (Row 2) | Tap | Push to sent email detail / open-tracking detail |
| Email row | Left swipe | [INFERRED] Reveal archive / delete action buttons |
| Email row | Right swipe | [INFERRED] Reveal mark-unread or quick-reply action |
| FAB "+" | Tap | Present action sheet: Log Email / Log Call / Send Text / Log Note / Schedule Appointment |
| Content area | Pull-to-refresh | Reload communication history from FUB server |
| Avatar circle | Tap | [INFERRED] No action, or opens contact edit view |
| Contact name/hero area | Tap | [INFERRED] No action (already on detail), or opens quick-edit |

---

## Build notes (component tree)

```tsx
<MobileShell safeArea="ios">

  {/* Fixed header block — dark slate-teal bg */}
  <ContactDetailHeader bg="#2d3f50">
    <StatusBar style="light" />          {/* white text, dark bg */}

    <NavBar>
      <BackButton icon="chevron-left" color="#fff" onPress={popToList} />
      {/* no center title, no right controls */}
    </NavBar>

    <ContactHero>
      <Avatar
        initials="TW"
        bg="#E53935"          {/* color is per-contact, from FUB avatar color assignment */}
        size={52}
        shape="circle"
        textColor="#fff"
        textSize={18}
      />
      <VStack gap={2} ml={12}>
        <Text style="contact-name" color="#fff" size={22} weight="semibold">
          Theresa Wise
        </Text>
        <Text style="contact-subtitle" color="#9BB5CA" size={13}>
          Last communication Jun 17
        </Text>
      </VStack>
    </ContactHero>

    <SubTabStrip
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar"]}
      activeTab="Comms"
      activeColor="#fff"
      inactiveColor="#8A9BB0"
      indicatorColor="#5BA4CF"
      indicatorHeight={3}
      scrollable={true}     {/* horizontally scrollable, Calendar truncated at right edge */}
      tabFontSize={15}
    />
  </ContactDetailHeader>

  {/* Scrollable content — white bg */}
  <ScrollView bg="#fff">

    {/* Row 1 — inbound email thread */}
    <CommRow onPress={() => openThread(thread1)}>
      <MailIcon color="#5BA4CF" size={24} />
      <CommRowBody>
        <HStack justifyContent="space-between">
          <Text style="subject" size={15} weight="medium" color="#1A1A1A" numberOfLines={1}>
            Re: Your Bend home search is set, Theresa
          </Text>
          <Text style="date" size={12} color="#9E9E9E">Jun 17</Text>
        </HStack>
        <HStack gap={6} alignItems="center">
          <Text style="sender" size={15} color="#1A1A1A">Theresa Wise</Text>
          <ThreadCountBadge count={3} bg="#9E9E9E" textColor="#fff" size={16} />
        </HStack>
        <Text style="preview" size={13} color="#9E9E9E" numberOfLines={2}>
          Hi Matt, Great thanks for the confirmation and working on the update! Thank you for...
        </Text>
      </CommRowBody>
    </CommRow>
    <RowDivider color="#E0E3E8" />

    {/* Row 2 — outbound archived email with open tracking */}
    <CommRow onPress={() => openEmailDetail(email2)}>
      <MailIcon color="#5BA4CF" size={24} />
      <CommRowBody>
        <HStack justifyContent="space-between">
          <Text style="archived-label" size={11} color="#9E9E9E">archived</Text>
          <Text style="date" size={12} color="#9E9E9E">Jun 17</Text>
        </HStack>
        <Text style="sender" size={15} weight="semibold" color="#1A1A1A">Matt Ryan</Text>
        <Text style="preview" size={13} color="#9E9E9E" numberOfLines={2}>
          archived (https://ryan-realty.com?_pxl=djoxLGM6OGZiOWNkMzYzOTM5MzIs...
        </Text>
        <OpenTrackingLine>
          <MailIcon color="#F5A023" size={16} variant="outlined-orange" />
          <Text size={13} weight="medium" color="#1A1A1A">1 open</Text>
          <Text size={13} color="#9E9E9E"> Last opened Jun 17</Text>
        </OpenTrackingLine>
      </CommRowBody>
    </CommRow>

    {/* Empty area — no more comms */}
    <View flex={1} bg="#EEF1F5" minHeight={260} />

  </ScrollView>

  {/* FAB — fixed bottom-right */}
  <FAB
    icon="plus"
    iconColor="#fff"
    bg="#5BA4CF"
    size={56}
    position="bottom-right"
    insetRight={20}
    insetBottom={20}
    onPress={openComposeActionSheet}
    /* Action sheet options: Log Email / Log Call / Send Text / Log Note / Schedule Appt */
  />

  {/* Bottom tab bar — standard FUB 5-tab; presumed present but not captured */}
  <BottomTabBar
    tabs={[
      { label: "Inbox",    icon: "inbox",    badge: null },
      { label: "Activity", icon: "activity", badge: null },
      { label: "Calendar", icon: "calendar", badge: null },
      { label: "People",   icon: "people",   active: true },
      { label: "Deals",    icon: "deals",    badge: null },
    ]}
    activeColor="#5BA4CF"
    inactiveColor="#8A9BB0"
    bg="#fff"
    borderTop="1px solid #E0E3E8"
  />

</MobileShell>
```

### Key data bindings

| Component | Data source |
|---|---|
| `Avatar` initials | `contact.firstName[0] + contact.lastName[0]` |
| `Avatar` bg color | `contact.avatarColor` (FUB assigns per-contact) |
| `ContactHero` name | `contact.name` |
| `ContactHero` subtitle | `"Last communication " + formatDate(contact.lastCommunicationDate)` |
| `CommRow` email rows | `GET /v1/emails?personId={contactId}` ordered by `created` desc |
| `ThreadCountBadge` count | email thread participant/message count from FUB API |
| "archived" label | `email.isArchived === true` |
| "1 open" + date | `email.openCount`, `email.lastOpenedAt` (FUB email tracking fields) |
| Open-tracking preview URL | `email.body` containing pixel URL fragment |
| FAB compose sheet | Routes to FUB compose endpoints by type (email / SMS / call log / note) |

### Spacing constants

- Header left padding: 16pt
- Avatar size: 52pt
- Avatar → name gap: 12pt
- Sub-tab height: 37pt (including 3pt underline)
- Row left padding: 16pt (icon column: 24pt icon + 12pt gap = 36pt indent for text)
- Row vertical padding: 12pt top + 12pt bottom
- Row divider: 1pt, inset 0 (full bleed)
- FAB diameter: 56pt, inset 20pt right, 20pt above bottom safe area
- Thread count badge: 16pt diameter, 6pt gap after sender name

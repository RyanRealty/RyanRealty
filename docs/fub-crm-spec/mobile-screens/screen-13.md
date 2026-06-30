<!-- Mobile per-screen appendix. Original: IMG_5834.PNG | id: mob-13 | tiles: mob-tiles/mob-13_{full,t,m,b}.png -->

# mob-13 — fub-ios — Contact Detail: Comms Tab

## Identity
- **app_source:** fub-ios (Follow Up Boss native iOS app)
- **module:** Contact Detail (Lead Profile) — Comms sub-tab
- **screen:** Communications history for a specific contact (Jim Langevin), showing all email threads and SMS/text exchanges in reverse-chronological order
- **how to reach:** Tap a contact row in People tab (or from Activity/Inbox) → Contact Detail loads on "Info" tab by default → tap "Comms" sub-tab
- **iOS status bar:** 4:34 (time, left), signal bars (2/4 filled, right cluster), WiFi arc icon, battery "100" with charging indicator (right)
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (top → bottom, ~390×844 pt logical)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 pt | ~#364D5E (dark slate-teal, blends with header) |
| Nav bar (back + nothing right) | 44–88 | 44 pt | ~#364D5E |
| Contact hero header | 88–210 | 122 pt | ~#364D5E |
| Sub-tab strip | 210–254 | 44 pt | ~#364D5E (tabs on dark bg) |
| Scrollable comms list | 254–820 | ~566 pt | #FFFFFF |
| Bottom tab bar | ~820–844 | ~0 pt visible (clipped / not captured) | — |
| FAB overlay | fixed, ~bottom-right | 56×56 pt circle | ~#4A90E8 (blue) |

---

## Nav / header bar (exact)

**Back control (left):** White `<` chevron glyph, ~22 pt, tappable area full left rail (~44×44 pt hit target). Tapping pops the contact detail and returns to the previous list screen (People list or wherever the user navigated from).

**Center:** Empty — no title text in the nav bar itself; the contact name lives in the hero below.

**Right controls:** None visible in the nav bar row.

**Contact hero block** (sits below the nav bar, still on dark header bg):
- **Avatar:** Circle, diameter ~64 pt, fill color ~#8B7B72 (muted mauve/dusty-rose). Initials "JL" in white, ~18 pt medium weight, centered. No photo.
- **Name:** "Jim Langevin" — white, ~22 pt, semibold/bold, left-of-center aligned next to avatar.
- **Sub-label:** "Last communication May 21" — ~13 pt, muted gray ~#A0B0BE.
- **Price pill:** "$655K" — green pill badge, bg ~#27AE60, white text ~12 pt semibold, ~6 pt corner radius, ~24 pt tall × ~58 pt wide. Represents the contact's price point / deal value.

---

## Bottom tab bar (exact)

**Not captured** in this screenshot (the scrollable content + FAB fill the visible frame; the tab bar chrome is at the very bottom and appears clipped). Based on FUB iOS app structure the standard tabs are:

| Position | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | Inbox envelope | Inbox | — | inactive |
| 2 | Activity pulse | Activity | — | inactive |
| 3 | Calendar grid | Calendar | — | inactive |
| 4 | Person silhouette | People | — | active (user navigated from here) |
| 5 | $ tag / handshake | Deals | — | inactive |

**FAB:** Round circle ~56 pt diameter, fixed position bottom-right corner (~330 pt x, ~760 pt y), bg ~#4A90E8 (medium blue), white "+" glyph ~20 pt. Tapping opens a compose/new-action sheet (new email, text, note, call log, or task — contextually offered for this contact).

---

## Sub-tab strip (exact)

Five tabs displayed in a horizontally scrollable strip on the dark header background:

| Tab | Label | State | Indicator |
|---|---|---|---|
| 1 | Info | inactive | none |
| 2 | Comms | **active** | 3 pt blue underline bar ~#4A90E8 |
| 3 | Homes | inactive | none |
| 4 | Notes | inactive | none |
| 5 | Calen[dar] | inactive (truncated, partially visible) | none |

- Font: ~15 pt, active tab white, inactive tabs ~#A0B0C0 (muted)
- Tabs are horizontally scrollable off-screen (at minimum Calendar/Files/Tasks likely exist beyond)
- Underline bar is flush-bottom of the strip, width matches label

---

## Content — every element, in order

All rows live in a white-background scrollable list. Each row is separated by a 1 pt horizontal hairline divider at full width, color ~#E8EAED. The list is ordered reverse-chronologically (newest at top).

---

### Row anatomy (shared pattern)

```
[Icon 36×36 pt]  [Primary line .............] [Date right-aligned]
                 [Secondary line (participants + badge)]
                 [Preview text (1–2 lines, gray)]
```

- Row height: ~80–90 pt (3-line content rows), ~70 pt (2-line rows)
- Left icon: 36 pt, vertically centered in row, ~16 pt left margin
- Text block: left edge ~64 pt (after icon + gap), right edge ~300 pt (leaves ~24 pt for date)
- Date: right-aligned, ~14 pt, ~#8A9BAD
- Tappable: entire row (tap navigates into the thread / message detail)
- Swipe actions: [INFERRED] swipe-left likely reveals Mark Unread / Delete / Archive
- No disclosure chevron visible on any row

---

### Row 1 — Email thread (most recent)

**Icon:** Envelope outline, ~36×36 pt, blue ~#5BA4CF, square with envelope flap. Open-envelope style (not filled).

**Primary line:** "Re: Mid term rental needed" — ~15 pt, near-black ~#1A2B3A, medium weight  
**Date:** "May 21" — ~14 pt, ~#8A9BAD, right-aligned

**Secondary line:** "Jim and Lisa Langevin" — ~14 pt, near-black, medium weight. Followed immediately by a small circular thread-count badge: circle bg ~#C4C9CE (light gray), text "4" in ~#5A6A78 (dark gray), ~18 pt diameter, ~4 pt left of text.  
(The "4" indicates 4 messages in this email thread.)

**Preview text (2 lines):** "Thanks, Matt! Really appreciate your help!! Sent from my iPhone On May 21, 2026, at..." — ~13 pt, ~#8A9BAD, truncated with ellipsis

---

### Row 2 — Email thread

**Icon:** Same envelope outline as Row 1.

**Primary line:** "Re: Desert Sage" — ~15 pt, near-black  
**Date:** "May 16"

**Secondary line:** "Jim And Lisa Langevin" + thread-count badge "9" (same circle style, larger count)

**Preview text (2 lines):** "Absolutely! Sent from my iPhone On May 16, 2026, at 11:36, Matthew Ryan <matt@ryan-r..." — ~13 pt, ~#8A9BAD, truncated

---

### Row 3 — SMS/Text message (outbound)

**Icon:** Two overlapping speech-bubble circles, ~36×36 pt. Larger circle left-back, smaller circle front-right overlay. Blue ~#6B8FDE (medium periwinkle-blue, slightly darker/different hue than the envelope). This is the FUB "text message" icon.

**Primary line:** "You texted Lisa Langevin, Jim Langevin" — ~15 pt, near-black  
**Date:** "Apr 7"

**No secondary participants line** (participants already in primary line)

**Preview text (2 lines):** "Hey guys, here's some measurements that I took. ..." — ~14 pt, near-black (notably DARKER than email preview text — indicates unread or different treatment; or just less muted). Truncated with "..."

---

### Row 4 — SMS/Text message (inbound, external number)

**Icon:** Same speech-bubble pair icon as Row 3.

**Primary line:** "+14158373306 texted Lisa Langevin, Comp..." — ~15 pt, near-black. Truncated ("Comp..." = "Company" or contact name).  
**Date:** "Apr 7"

**Preview text (1 line):** "Thanks!" — ~14 pt, near-black

---

### Row 5 — SMS/Text message (between contacts)

**Icon:** Same speech-bubble pair.

**Primary line:** "Lisa Langevin texted +14158373306, Comp..." — ~15 pt, near-black  
**Date:** "Apr 7"

**Preview text (1 line):** "New string with Jim's new number." — ~14 pt, near-black

---

### Row 6 — SMS/Text message (between contacts, agent notified)

**Icon:** Same speech-bubble pair.

**Primary line:** "Lisa Langevin texted Jim Langevin, you" — ~15 pt, near-black  
**Date:** "Apr 7"

**Preview text (2 lines):** "Matt, Jim has a new phone number: 415-837-3306. Will start a new text st" — truncated (cut off by FAB overlay on right side)

---

### Row 7 — partially visible (scroll continues below)

**Primary line (barely visible):** "Lisa Langevin texted Jim Langevin, you"  
**Date:** "Apr 6" — partially visible at very bottom of screen

Content continues below the visible viewport (user can scroll down for older communications).

---

## Colors, type & iconography

### Color palette
| Element | Hex estimate |
|---|---|
| Header / nav bg | ~#364D5E |
| Active tab underline | ~#4A90E8 |
| Avatar bg (JL) | ~#8B7B72 |
| Price pill bg | ~#27AE60 |
| Price pill text | #FFFFFF |
| Content area bg | #FFFFFF |
| Row divider | ~#E8EAED |
| Email icon | ~#5BA4CF |
| SMS icon | ~#6B8FDE |
| Primary text (name, preview dark) | ~#1A2B3A |
| Secondary/muted text (preview gray, dates) | ~#8A9BAD |
| Thread count badge bg | ~#C4C9CE |
| Thread count badge text | ~#5A6A78 |
| FAB bg | ~#4A90E8 |
| FAB "+" | #FFFFFF |
| Active tab label | #FFFFFF |
| Inactive tab labels | ~#A0B0C0 |
| Status bar text/icons | #FFFFFF |

### Typography
- Contact name: ~22 pt, semibold, white
- Sub-label ("Last communication..."): ~13 pt, regular, ~#A0B0BE
- Tab labels: ~15 pt, medium; active = white, inactive = muted gray
- Row primary line (thread subject): ~15 pt, medium/semibold, ~#1A2B3A
- Row date: ~14 pt, regular, ~#8A9BAD
- Row secondary line (participants): ~14 pt, medium, ~#1A2B3A
- Thread badge number: ~11 pt, medium, inside 18 pt circle
- Row preview text (email): ~13 pt, regular, ~#8A9BAD
- Row preview text (SMS, dark): ~14 pt, regular, ~#1A2B3A

### Iconography
- **Email:** Square envelope outline, open-flap style, ~#5BA4CF, ~36×36 pt
- **SMS/Text:** Two overlapping speech-bubble circles, ~#6B8FDE, ~36×36 pt. The two-circle arrangement (large behind, small front-offset) is the FUB signature text icon distinguishing it from the single-bubble note icon.
- **Back chevron:** `<` glyph, white, ~22 pt
- **FAB:** "+" glyph, white, ~20 pt in a ~56 pt blue circle

---

## Interactions & gestures

- **Tap any comms row** → pushes thread detail view (email thread viewer or SMS conversation view) [INFERRED]
- **Tap back chevron** → pops to previous screen (likely People list or Activity feed) [CONFIRMED]
- **Tap sub-tabs (Info / Homes / Notes / Calendar)** → switches tab content within the same contact detail, preserving header/hero [INFERRED]
- **Tap FAB (+)** → opens action sheet offering: New Email, New Text, Log Call, Add Note, Add Task (FUB standard compose options for a contact) [INFERRED]
- **Scroll down** → reveals older communications; header collapses [INFERRED — standard iOS detail pattern]
- **Swipe left on row** → likely reveals Delete / Archive / Mark Read actions [INFERRED]
- **Pull-to-refresh** → re-fetches communications from FUB server [INFERRED]
- **Tap price pill ($655K)** → may navigate to associated deal or allow editing the price range [INFERRED]
- **Long-press on row** → may reveal contextual menu [INFERRED]

---

## Build notes (component tree)

```tsx
<MobileShell>

  {/* iOS-style status bar — passthrough or simulated */}
  <StatusBar style="light" bg="#364D5E" />

  {/* Sticky header — does NOT scroll away; collapses on scroll [INFERRED] */}
  <ContactDetailHeader bg="#364D5E">
    <NavBar>
      <BackButton icon="chevron-left" color="white" onTap={popScreen} />
      {/* no right controls */}
    </NavBar>

    <ContactHero>
      <Avatar
        size={64}
        bg="#8B7B72"
        initials="JL"
        initialsColor="white"
        initialsSize={18}
        /* no photo for this contact */
      />
      <ContactMeta>
        <ContactName text="Jim Langevin" color="white" size={22} weight="semibold" />
        <LastComm text="Last communication May 21" color="#A0B0BE" size={13} />
        <PricePill value="$655K" bg="#27AE60" textColor="white" size={12} borderRadius={6} />
      </ContactMeta>
    </ContactHero>

    <SubTabStrip
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar", /* ...more */]}
      activeTab="Comms"
      activeColor="white"
      inactiveColor="#A0B0C0"
      indicatorColor="#4A90E8"
      indicatorHeight={3}
      bg="#364D5E"
      scrollable={true}
    />
  </ContactDetailHeader>

  {/* Scrollable comms list */}
  <ScrollView bg="white" contentInset={{ bottom: 80 }}>
    {commsItems.map(item => (
      <CommsRow
        key={item.id}
        type={item.type}           // "email" | "sms"
        onTap={() => openThread(item)}
      >
        <CommsIcon
          type={item.type}
          /* email: envelope outline #5BA4CF */
          /* sms: overlapping bubbles #6B8FDE */
          size={36}
        />
        <CommsRowContent>
          <CommsRowTop>
            <CommsSubject text={item.subject} size={15} weight="medium" color="#1A2B3A" />
            <CommsDate text={item.dateLabel} size={14} color="#8A9BAD" />
          </CommsRowTop>
          {item.participants && (
            <CommsRowMiddle>
              <CommsParticipants text={item.participants} size={14} weight="medium" color="#1A2B3A" />
              {item.threadCount && (
                <ThreadCountBadge
                  count={item.threadCount}
                  bg="#C4C9CE"
                  textColor="#5A6A78"
                  size={18}
                  fontSize={11}
                />
              )}
            </CommsRowMiddle>
          )}
          <CommsPreview
            text={item.previewText}
            size={item.type === "email" ? 13 : 14}
            color={item.type === "email" ? "#8A9BAD" : "#1A2B3A"}
            numberOfLines={2}
          />
        </CommsRowContent>
      </CommsRow>
    ))}
  </ScrollView>

  {/* Floating action button */}
  <FAB
    icon="plus"
    bg="#4A90E8"
    iconColor="white"
    size={56}
    position="fixed"
    bottom={24}
    right={20}
    onTap={openComposeSheet}
    /* Sheet options: New Email, New Text, Log Call, Add Note, Add Task */
  />

  {/* Bottom tab bar — standard FUB 5-tab */}
  <BottomTabBar
    tabs={[
      { icon: "inbox", label: "Inbox", active: false },
      { icon: "activity", label: "Activity", active: false },
      { icon: "calendar", label: "Calendar", active: false },
      { icon: "person", label: "People", active: true },
      { icon: "deals", label: "Deals", active: false },
    ]}
    activeColor="#4A90E8"
    inactiveColor="#8A9BAD"
    bg="white"
    borderTop="1px solid #E8EAED"
  />

</MobileShell>
```

### Data bindings per component

| Component | Data source |
|---|---|
| `ContactHero` | `contact.firstName`, `contact.lastName`, `contact.initials`, `contact.avatarUrl`, `contact.lastCommunicationDate`, `contact.pricePoint` |
| `PricePill` | `contact.pricePoint` formatted as `$XK` or `$XM` |
| `SubTabStrip` | Static tab list; `activeTab` from route state |
| `CommsRow` (email) | `emailThread.subject`, `emailThread.participants[]`, `emailThread.messageCount`, `emailThread.latestPreview`, `emailThread.latestDate` |
| `CommsRow` (sms) | `smsThread.direction` ("outbound"/"inbound"), `smsThread.participants` (contact names or phone numbers), `smsThread.latestBody`, `smsThread.latestDate` |
| `ThreadCountBadge` | `emailThread.messageCount` (integer) |
| `FAB` | Opens compose sheet with `contactId` pre-filled |

### Key spacing & sizing
- Row left padding: 16 pt
- Icon → text gap: 12 pt  
- Text right margin (from date): 8 pt
- Row vertical padding: ~12 pt top + bottom (auto-sized by content)
- Sub-tab height: 44 pt
- Sub-tab label padding: 0 16 pt
- Hero section padding: 16 pt horizontal, 12 pt vertical
- Avatar size: 64 pt diameter
- FAB: 56 pt diameter, bottom: 24 pt, right: 20 pt
- Row divider: 1 px, left-inset to icon start (~16 pt) or full-bleed — appears full-bleed

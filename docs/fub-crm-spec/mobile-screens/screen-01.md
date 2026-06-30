<!-- Mobile per-screen appendix. Original: IMG_5821.PNG | id: mob-01 | tiles: mob-tiles/mob-01_{full,t,m,b}.png -->

# mob-01 — fub-ios — Activity Feed / New Leads List

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Activity / Leads feed
- **screen:** Activity tab → "New Leads" sub-tab. Displays a chronological reverse-sorted list of new leads sourced via Ryan-Realty.com.
- **how to reach:** Tap the "Activity" tab (index 1, zero-based) in the bottom tab bar from anywhere in the app. Defaults to the "New Leads" sub-tab.
- **iOS status bar:** Time 4:32 (left), signal bars 2/4 + WiFi + Battery 100% with charging indicator (right). Light text on dark header background — no separate status bar region; the header bleeds into it.
- **URL bar:** N/A — native iOS app, no browser chrome.

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical screen)

| Region | y-band (approx pt) | Height (approx pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | Absorbed into header (#2E4A5C dark slate) |
| Nav / header bar | 54–110 | 56 | #2E4A5C (dark blue-gray slate) |
| Sub-tab strip | 110–154 | 44 | #2E4A5C (same dark header color, flush) |
| Active tab indicator line | 154–157 | 3 | #4AACED (bright blue) |
| Scrollable lead list | 157–766 | ~609 | #FFFFFF white |
| FAB (floating) | ~700–766 | 56 | Overlaps list + tab bar boundary |
| Bottom tab bar | 766–844 | 78 | #F7F7F7 (near-white with hairline top border) |

---

## Nav / header bar (exact)

**Left control:** Circular avatar of the logged-in broker (Matt Ryan). Real headshot photo, bald man in blue collared shirt, approximately 36×36 pt circle with white circular crop border (~1pt). Tappable — opens profile/settings drawer or user profile.

**Center:** Text label "Everyone" in white, font-weight ~500, ~17pt. Followed by a downward chevron "▾" in white. This is a team-member filter dropdown — tapping opens a picker sheet to filter activity by agent ("Everyone", "Me", individual broker names). The full center element is tappable.

**Right controls (left to right):**
1. Bell icon — outline bell glyph, white, ~24×24pt. Tapping opens notifications. No badge visible in this screenshot.
2. Magnifying glass icon — outline search glyph, white, ~24×24pt. Tapping opens a search input within Activity.

---

## Sub-tab strip (exact)

Three tabs spanning full width, equal thirds, flush below the nav bar, same dark header background:

| Index | Label | State | Color | Indicator |
|---|---|---|---|---|
| 0 | New Leads | ACTIVE | White (#FFFFFF), weight 600 | 3pt bright-blue (#4AACED) bottom line, full-width of tab cell |
| 1 | Emails | Inactive | Medium gray (~#8FA8BB) | None |
| 2 | Website | Inactive | Medium gray (~#8FA8BB) | None |

Tab font: ~15pt, system sans. Tap switches sub-tab and reloads the list below.

---

## Bottom tab bar (exact) — CRITICAL

Five tabs, equal width (~78pt each), on a near-white (#F7F7F7) bar with a hairline top border (~#E0E0E0):

| Order | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 0 | Inbox tray / in-tray outline | Inbox | Red circle "30" (white numerals, ~18pt circle) | Inactive — gray (#9BA8B0) |
| 1 | Line chart / activity squiggle (three connected upward peaks) | Activity | None | **ACTIVE** — bright blue #4AACED, label + icon both blue |
| 2 | Calendar grid (3×3 grid with top bar) | Calendar | None | Inactive — gray (#9BA8B0) |
| 3 | Two-person silhouette (people) | People | None | Inactive — gray (#9BA8B0) |
| 4 | Price tag with dollar sign "$" | Deals | None | Inactive — gray (#9BA8B0) |

Active tab text + icon: #4AACED (bright cornflower blue). Inactive: #9BA8B0 (blue-gray).

**FAB (Floating Action Button):**
- Bright blue circle (~56pt diameter), color #4AACED (matches active tab accent)
- White "+" glyph centered (~24pt)
- Positioned bottom-right, approximately x=334pt, y=710pt (overlapping the last list row and above the tab bar)
- Action [INFERRED]: Opens a "New Lead / New Contact" creation sheet

---

## Content — every element, in order

### Lead list rows

Each row follows a consistent anatomy:

```
[Avatar 44pt circle] [Primary name ~17pt dark] [Date ~13pt gray]
                     [Secondary "via Ryan-Realty.com" ~13pt gray]
```

- **Avatar:** 44pt circle, no border. Either (a) solid-color circle with 1–2 white initials (weight 600, ~17pt) when no photo, or (b) real contact photo cropped to circle when photo exists.
- **Primary text:** Contact full name. Dark navy #1D2F3E, ~17pt, weight 500 (medium). Left-aligned, vertically centered in upper half of row.
- **Source text:** "via Ryan-Realty.com" — gray #8FA8BB, ~13pt, weight 400. Immediately below name.
- **Date:** Right-aligned, ~13pt, #8FA8BB gray. Most-recent shows full timestamp (date + time); older shows abbreviated month+day.
- **Row height:** ~72–76pt.
- **Divider:** 1px hairline #E8EDF0, full width, sitting at the bottom of each row (not inset).
- **Tap target:** Entire row. [INFERRED] Opens Contact Detail / Lead Profile for that person.
- **Swipe actions:** [INFERRED] FUB standard — swipe-left to reveal action buttons (e.g., Call, Text, Archive); swipe-right may mark as read or add to plan.

### Row-by-row verbatim data

| # | Avatar | Name (verbatim) | Source | Date/Time |
|---|---|---|---|---|
| 1 | Orange circle "AC" (~#B55A00 burnt orange) | Andy Christensen | via Ryan-Realty.com | 6/19/26, 10:58am |
| 2 | Red circle "TW" (~#D93025 vivid red) | Theresa Wise | via Ryan-Realty.com | Jun 17 |
| 3 | Olive/dark yellow circle "S" (~#707A00 olive) | Scdvf | via Ryan-Realty.com | Jun 15 |
| 4 | Real headshot photo (man in dark suit, dark bg) | Derek Winchell | via Ryan-Realty.com | Jun 13 |
| 5 | Real photo (stylized ocean/surfer image, text "RIVERS TO THE SEA") | Tide Rivers | via Ryan-Realty.com | Jun 13 |
| 6 | Gray circle "LM" (~#6B7A8D medium gray) | Laurie McAdam | via Ryan-Realty.com | Jun 12 |
| 7 | Orange circle "A" (~#B55A00 same orange as #1) | As | via Ryan-Realty.com | Jun 12 |

**Notes on rows:**
- Row 3 "Scdvf" — appears to be a test/garbage contact name, slug-like.
- Row 5 "Tide Rivers" — avatar is a circular crop of what looks like a book cover or promotional image (ocean waves + text), not a headshot.
- Row 1 is the only row showing a full datetime stamp; all others show abbreviated "Mon DD" format, indicating the same-year convention.
- The list is sorted newest-first (descending by lead creation / activity date).
- The list is scrollable; more rows exist below "As" (not visible).
- No section headers, no group separators — flat list.
- No count bar or "X total leads" header visible.
- No empty state visible (list has content).

---

## Colors, type & iconography

| Token | Value | Usage |
|---|---|---|
| Header bg | #2E4A5C (dark blue-gray slate) | Nav bar + sub-tab strip background |
| Accent / active | #4AACED (bright cornflower blue) | Active tab indicator line, active tab label+icon, FAB, sub-tab active underline |
| Header text | #FFFFFF | Nav bar title, active sub-tab label |
| Inactive sub-tab | #8FA8BB | Inactive sub-tab labels |
| Primary text | #1D2F3E | Contact name in list rows |
| Secondary text | #8FA8BB | "via Ryan-Realty.com" source line + date |
| Row divider | #E8EDF0 | Full-width 1px hairline between rows |
| List bg | #FFFFFF | Scrollable content area |
| Tab bar bg | #F7F7F7 | Bottom tab bar |
| Tab bar inactive | #9BA8B0 | Inactive tab icon + label |
| Badge bg | #E53E3E | Inbox badge (red) |
| Badge text | #FFFFFF | Badge numeral "30" |
| Avatar colors | See per-row table | Varies: burnt orange, vivid red, olive, medium gray |

**Typography:**
- Nav title "Everyone ▾": ~17pt, weight 500, white
- Sub-tab labels: ~15pt, weight 600 (active) / 400 (inactive)
- Contact name: ~17pt, weight 500, dark navy
- Source + date: ~13pt, weight 400, gray
- Avatar initials: ~17pt, weight 600, white
- Bottom tab labels: ~10pt, weight 400

**Iconography style:** Outline/line icons (not filled). Bell, search, inbox tray, activity squiggle, calendar grid, people silhouette, deals tag — all single-weight stroke outline in the tab bar accent color (active) or gray (inactive).

**This is NOT the in-house CRM.** Header is dark slate (not navy #102742), accent is cornflower blue (not Ryan Realty cream/navy), and the tab set (Inbox/Activity/Calendar/People/Deals) is the canonical Follow Up Boss tab set. Confirmed: fub-ios.

---

## Interactions & gestures (mark [INFERRED])

| Interaction | Target | Behavior |
|---|---|---|
| Tap avatar (header) | Broker headshot (top-left) | [INFERRED] Opens logged-in broker profile / settings sheet |
| Tap "Everyone ▾" | Center nav label | [INFERRED] Presents a picker sheet listing team members; selecting one filters the activity feed |
| Tap bell | Notification icon (top-right) | [INFERRED] Pushes Notifications screen |
| Tap search | Magnifying glass (top-right) | [INFERRED] Opens search bar inline or pushes Search screen |
| Tap sub-tab | "New Leads" / "Emails" / "Website" | Switches list content in the scrollable area below; active tab underline slides |
| Tap lead row | Any lead row | Pushes Contact Detail / Lead Profile for that person |
| Swipe row left | Lead row | [INFERRED] Reveals quick-action buttons: Call, Text, Archive (FUB standard) |
| Swipe row right | Lead row | [INFERRED] Possible mark-as-read or Add to Plan action |
| Pull to refresh | Scroll area | [INFERRED] Refreshes the lead list from FUB API |
| Tap FAB "+" | Blue circle (bottom-right) | [INFERRED] Opens New Contact / Add Lead creation modal sheet |
| Tap "Inbox" tab | Tab bar | Switches to Inbox screen; badge "30" indicates 30 unread inbox items |
| Tap "Calendar" tab | Tab bar | Switches to Calendar / Appointments screen |
| Tap "People" tab | Tab bar | Switches to People / Contacts list |
| Tap "Deals" tab | Tab bar | Switches to Deals pipeline screen |

---

## Build notes (component tree)

```tsx
<MobileShell>

  {/* Fixed top region — dark header */}
  <StatusBarSpacer height={54} bg="#2E4A5C" />

  <TopBar bg="#2E4A5C">
    <BrokerAvatar
      src={broker.headshotUrl}
      size={36}
      shape="circle"
      border="1pt white"
      onTap={() => openProfileDrawer()}
    />
    <TeamFilterPill
      label="Everyone"
      showChevron
      textColor="#FFFFFF"
      fontSize={17}
      fontWeight={500}
      onTap={() => presentTeamPickerSheet()}
    />
    <IconButton icon={<BellOutline />} color="#FFFFFF" size={24} onTap={() => pushNotifications()} />
    <IconButton icon={<SearchOutline />} color="#FFFFFF" size={24} onTap={() => openSearch()} />
  </TopBar>

  <SubTabStrip
    bg="#2E4A5C"
    activeIndicatorColor="#4AACED"
    activeIndicatorHeight={3}
    tabs={[
      { label: "New Leads", key: "new_leads" },
      { label: "Emails",    key: "emails"    },
      { label: "Website",   key: "website"   },
    ]}
    activeTab="new_leads"
    labelActiveColor="#FFFFFF"
    labelInactiveColor="#8FA8BB"
    fontSize={15}
    height={44}
    onTabChange={(key) => setActiveSubTab(key)}
  />

  {/* Scrollable lead list — white bg */}
  <ScrollView bg="#FFFFFF" pullToRefresh={fetchLeads}>

    {leads.map((lead) => (
      <LeadRow
        key={lead.id}
        avatar={
          lead.photoUrl
            ? <CirclePhoto src={lead.photoUrl} size={44} />
            : <InitialsAvatar
                initials={lead.initials}        // e.g. "AC", "TW", "LM"
                bg={lead.avatarColor}           // deterministic color from name hash
                size={44}
                textColor="#FFFFFF"
                fontSize={17}
                fontWeight={600}
              />
        }
        primaryText={lead.fullName}             // e.g. "Andy Christensen"
        primaryColor="#1D2F3E"
        primaryFontSize={17}
        primaryFontWeight={500}
        secondaryText={`via ${lead.sourceLabel}`} // e.g. "via Ryan-Realty.com"
        secondaryColor="#8FA8BB"
        secondaryFontSize={13}
        date={formatLeadDate(lead.createdAt)}   // "6/19/26, 10:58am" if today-ish else "Jun 17"
        dateColor="#8FA8BB"
        dateFontSize={13}
        rowHeight={74}
        divider={{ color: "#E8EDF0", height: 1, inset: 0 }}
        onTap={() => pushContactDetail(lead.id)}
        swipeLeftActions={[
          { label: "Call",    icon: <PhoneIcon />,  color: "#4CAF50", onTap: () => callLead(lead) },
          { label: "Text",    icon: <SmsIcon />,    color: "#4AACED", onTap: () => textLead(lead) },
          { label: "Archive", icon: <ArchiveIcon />, color: "#FF5722", onTap: () => archiveLead(lead) },
        ]}
      />
    ))}

  </ScrollView>

  {/* Floating Action Button */}
  <Fab
    icon={<PlusIcon size={24} color="#FFFFFF" />}
    bg="#4AACED"
    size={56}
    position={{ bottom: 86, right: 16 }}   // sits just above the tab bar
    shadow="0 4px 12px rgba(74,172,237,0.4)"
    onTap={() => presentNewLeadSheet()}
  />

  {/* Bottom tab bar */}
  <BottomTabBar
    bg="#F7F7F7"
    borderTop="1px solid #E0E0E0"
    height={78}
    activeColor="#4AACED"
    inactiveColor="#9BA8B0"
    labelFontSize={10}
    tabs={[
      {
        key: "inbox",
        label: "Inbox",
        icon: <InboxTrayOutline />,
        badge: { count: 30, bg: "#E53E3E", textColor: "#FFFFFF" },
      },
      {
        key: "activity",
        label: "Activity",
        icon: <ActivitySquiggleOutline />,
        active: true,
      },
      {
        key: "calendar",
        label: "Calendar",
        icon: <CalendarGridOutline />,
      },
      {
        key: "people",
        label: "People",
        icon: <PeopleOutline />,
      },
      {
        key: "deals",
        label: "Deals",
        icon: <PriceTagDollarOutline />,
      },
    ]}
    onTabChange={(key) => navigateToTab(key)}
  />

</MobileShell>
```

### Data bindings

| Component | Data source | Key fields |
|---|---|---|
| `BrokerAvatar` | Authenticated session | `broker.headshotUrl`, `broker.name` |
| `TeamFilterPill` | FUB team members | `filter.label` ("Everyone" / broker name) |
| `LeadRow` | FUB `/v1/people?sort=-created&limit=25&stage=new` | `id`, `firstName`, `lastName`, `avatarColor`, `photoUrl`, `sourceUrl`, `created` |
| `SubTabStrip` | Local UI state | `activeTab: 'new_leads' | 'emails' | 'website'` |
| `Fab` | N/A | Triggers new-lead modal |
| Badge "30" | FUB inbox unread count | `inbox.unreadCount` |

### Avatar color assignment
Derive a consistent color from the contact's name hash — map to a palette of ~8 colors (burnt orange #B55A00, vivid red #D93025, olive #707A00, medium gray #6B7A8D, teal, purple, etc.). This matches FUB's own color-assignment pattern visible across the rows.

### Date formatting rules
- If `createdAt` is today or yesterday → show `M/D/YY, h:mma` (e.g. "6/19/26, 10:58am")
- If `createdAt` is within current year, older than yesterday → show `Mon D` (e.g. "Jun 17")
- If `createdAt` is prior year → show `Mon D, YYYY`

### Spacing & sizing summary
- Header avatar: 36×36pt circle, 1pt white border
- Sub-tab strip height: 44pt
- Active indicator: 3pt bottom border, full cell width
- Lead row height: ~74pt
- Avatar size in rows: 44×44pt circle
- Left padding (avatar): 16pt from edge
- Gap (avatar to text): 12pt
- Right padding (date): 16pt from edge
- FAB size: 56pt diameter, 16pt from right, 86pt from bottom (above tab bar)
- Tab bar height: 78pt (includes home indicator safe area on modern iPhones)
- Badge: ~18pt circle, red, positioned top-right of inbox icon

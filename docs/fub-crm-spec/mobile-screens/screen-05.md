<!-- Mobile per-screen appendix. Original: IMG_5825.PNG | id: mob-05 | tiles: mob-tiles/mob-05_{full,t,m,b}.png -->

# mob-05 — fub-ios — Activity Feed / Website Sub-tab

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal header, FUB bottom nav Inbox/Activity/Calendar/People/Deals)
- **module:** Activity / Leads feed
- **screen:** Activity feed filtered to "Website" activity sub-tab — shows contacts who recently visited the website
- **how to reach:** Tap "Activity" in bottom tab bar → tap "Website" in the sub-tab strip
- **iOS status bar:** Time "4:32" (left) · signal bars + WiFi + battery "100" (right); white text on dark header bg
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (top → bottom, 390×844 pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 | transparent over header (#2D3E4F) |
| Nav / header bar | 44–100 | 56 | dark teal #2D3E4F |
| Sub-tab strip | 100–144 | 44 | dark teal #2D3E4F (same as header) |
| Scrollable contact list | 144–754 | ~610 | white #FFFFFF |
| Floating action button | overlaid ~690–754 right | 56×56 | bright blue #4B9EF5 |
| Bottom tab bar | 754–844 | 90 (incl. home indicator) | white #FFFFFF |

---

## Nav / header bar (exact)

**Left control:** Circular agent avatar photo, ~36 pt diameter, showing Matt Ryan headshot (real photo, not initials). Tappable — opens agent/profile switcher or settings.

**Center:** "Everyone" text in white, ~17 pt medium weight + downward chevron (▾) immediately to its right. Whole unit is tappable — opens an agent/team filter picker sheet. Center-aligned horizontally.

**Right controls (left to right):**
1. Bell icon — outline bell glyph, ~22 pt, white — opens notifications
2. Magnifying glass icon — outline search glyph, ~22 pt, white — opens search / find contacts

---

## Sub-tab strip (exact)

Three horizontally-distributed tabs, all caps optional (rendered in sentence case), same dark teal background as header. A 2–3 pt bright blue underline indicator sits flush below the active tab.

| Position | Label | State | Text color |
|---|---|---|---|
| Left | New Leads | inactive | gray ~#8A9BAC |
| Center | Emails | inactive | gray ~#8A9BAC |
| Right | **Website** | **ACTIVE** | white #FFFFFF |

Active underline color: bright blue ~#4B9EF5, ~3 pt tall, full tab width.
Font: ~14 pt, regular weight for inactive; medium weight for active.

---

## Bottom tab bar (exact) — CRITICAL

White background (#FFFFFF), ~83 pt tall (incl. ~34 pt safe-area home indicator zone). Thin 1 pt top border ~#E0E0E0.

| Order | Icon glyph | Label | Badge | State | Color |
|---|---|---|---|---|---|
| 1 | Inbox tray / open envelope | **Inbox** | Red pill "30" (white numeral) | inactive | gray #999999 |
| 2 | Squiggly trend/activity line | **Activity** | — | **ACTIVE** | bright blue #4B9EF5 |
| 3 | Calendar grid 3×3 | **Calendar** | — | inactive | gray #999999 |
| 4 | Two-person silhouette | **People** | — | inactive | gray #999999 |
| 5 | Price-tag with $ glyph | **Deals** | — | inactive | gray #999999 |

**FAB (+):** Bright blue circle #4B9EF5, 56 pt diameter, positioned bottom-right of the scrollable content area (~x 334, y 698 pt), floating above the last list row. White "+" glyph centered. Tappable — creates new contact or logs new activity. NOT inside the tab bar; it overlaps the content zone.

---

## Content — every element in order

### List anatomy (per row)

Each row is a full-width touchable cell. Structure left-to-right:

```
[Avatar 40pt circle] [16pt gap] [Name + optional sub-label stacked] [flex spacer] [Date string]
```

- **Avatar:** 40 pt diameter circle, no border. Either:
  - **Initials avatar:** solid color fill, white 2-letter initials, ~15 pt bold (e.g. "MR", "MN", "ZP", "RG", "K")
  - **Photo avatar:** real circular headshot (e.g. Jessica King)
- **Primary text (name):** ~16 pt, medium/semibold weight, near-black ~#1A1A1A
- **Secondary text (activity sub-label):** rendered on a second line below the name when present — orange eye icon (👁 ~14 pt) + gray label text ~14 pt ~#999999. Text: "Visited Website" or "Viewed"
- **Date string:** right-aligned, ~13 pt, gray #999999. Format: "2d", "3d", "Jun 2", "May 21", "May 14", "May 9", "May 6"
- **Divider:** 1 pt horizontal line at row bottom, left-inset to align with name column (starts at ~x 72 pt), color ~#EBEBEB
- **Row height:** ~78 pt when sub-label present; ~64 pt when no sub-label
- **Swipe actions:** [INFERRED] left swipe → quick actions (call, text, email); right swipe → not typical in FUB

### Rows in order (verbatim data)

1. **Matthew Ryan** — avatar: purple-periwinkle #6B6EAB initials "MR" — date: "2d" — no sub-label (no eye icon row)
2. **Matt Ryan** — avatar: purple-periwinkle #6B6EAB initials "MR" — date: "3d" — no sub-label
3. **Kungfumailman** — avatar: slate-teal #5A7F80 initial "K" — date: "Jun 2" — 👁 "Visited Website"
4. **Mikayla Nelson** — avatar: purple-periwinkle #6B6EAB initials "MN" — date: "May 21" — 👁 "Viewed"
5. **Jessica King** — avatar: real circular photo (woman, blonde hair, outdoor/warm light) — date: "May 14" — 👁 "Viewed"
6. **Zack Porter** — avatar: bright blue #2196F3 initials "ZP" — date: "May 9" — 👁 "Viewed"
7. **Rachael Greenwalt** — avatar: brick-rust red #B34033 initials "RG" — date: partially clipped "May [6]" — sub-label not visible (row cut off by FAB + bottom)

### Sub-label icon spec
- Eye icon glyph: outline eye with a filled inner circle/pupil, ~14 pt
- Icon color: orange ~#E87322
- Label text color: gray #999999, ~13–14 pt regular weight
- Gap between icon and text: ~4 pt

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / sub-tab bg | dark teal #2D3E4F (FUB brand dark) |
| Active accent (tab underline, FAB, active tab icon) | bright blue #4B9EF5 |
| Inactive tab icon + date text | gray #999999 |
| Name primary text | near-black #1A1A1A |
| Eye icon / activity accent | orange #E87322 |
| Activity sub-label text | gray #999999 |
| Row divider | very light gray #EBEBEB |
| Content bg | white #FFFFFF |
| Tab bar bg | white #FFFFFF |
| Tab bar top border | #E0E0E0 |
| Inbox badge bg | red #FF3B30 |
| Inbox badge text | white #FFFFFF |
| Avatar colors observed | purple #6B6EAB · slate-teal #5A7F80 · bright blue #2196F3 · brick-red #B34033 |

**Typography:**
- Header center label ("Everyone"): ~17 pt, medium, white
- Sub-tab labels: ~14 pt, regular (inactive) / medium (active)
- Contact name: ~16 pt, semibold, #1A1A1A
- Activity sub-label: ~13 pt, regular, #999999
- Date: ~13 pt, regular, #999999
- Avatar initials: ~15 pt, bold, white
- Tab bar labels: ~10 pt, regular

**Iconography style:** All icons (bell, search, calendar, people, deals, inbox) are outline/stroke style, no fill. Activity (squiggly line) and inbox tray are also stroke-based.

---

## Interactions & gestures

| Target | Gesture | Result |
|---|---|---|
| Agent avatar (top-left) | Tap | Opens agent switcher / profile/settings sheet [INFERRED] |
| "Everyone ▾" | Tap | Bottom sheet picker: filter by agent (Everyone / Matt Ryan / specific brokers) |
| Bell icon | Tap | Push to notifications list |
| Search icon | Tap | Expand search bar / push to search screen |
| "New Leads" sub-tab | Tap | Switch list to new lead activity events |
| "Emails" sub-tab | Tap | Switch list to email open/click activity events |
| "Website" sub-tab | Tap | Current view — website visit activity events |
| Any contact row | Tap | Push to Contact Detail / Lead Profile screen |
| FAB "+" | Tap | Modal sheet — create new contact or log activity |
| Inbox tab | Tap | Push to Inbox / Conversations |
| Calendar tab | Tap | Push to Calendar / Appointments |
| People tab | Tap | Push to People / Contacts list |
| Deals tab | Tap | Push to Deals |
| List | Pull down | Pull-to-refresh — re-fetches activity feed |
| Row | Swipe left | [INFERRED] Quick action buttons (call / text / email) |

---

## Build notes (component tree)

```tsx
<MobileShell safeAreaTop safeAreaBottom>

  {/* iOS status bar — handled natively or via meta viewport */}
  <StatusBar style="light" />

  {/* Header nav bar */}
  <TopBar bg="#2D3E4F" height={56}>
    <AgentAvatar
      src={mattRyanPhoto}
      size={36}
      shape="circle"
      onPress={openAgentSwitcher}
    />
    <FilterPill
      label="Everyone"
      chevron
      color="white"
      fontSize={17}
      fontWeight="500"
      onPress={openTeamFilterSheet}
    />
    <IconButton icon={<BellOutline />} color="white" size={22} badge={null} onPress={openNotifications} />
    <IconButton icon={<SearchOutline />} color="white" size={22} onPress={openSearch} />
  </TopBar>

  {/* Sub-tab strip — same bg as header */}
  <SubTabStrip bg="#2D3E4F" height={44} activeColor="#4B9EF5" inactiveColor="#8A9BAC" indicatorHeight={3}>
    <SubTab label="New Leads" active={false} />
    <SubTab label="Emails" active={false} />
    <SubTab label="Website" active={true} />
  </SubTabStrip>

  {/* Scrollable contact list */}
  <ScrollView bg="white" flex={1}>
    {contacts.map(contact => (
      <ActivityRow
        key={contact.id}
        onPress={() => nav.push('ContactDetail', { id: contact.id })}
      >
        <ContactAvatar
          photo={contact.photo ?? null}
          initials={contact.initials}       // e.g. "MR", "K", "MN"
          color={contact.avatarColor}        // #6B6EAB | #5A7F80 | #2196F3 | #B34033
          size={40}
          shape="circle"
        />
        <View flex={1} ml={16}>
          <Text fontSize={16} fontWeight="600" color="#1A1A1A">{contact.name}</Text>
          {contact.activityLabel && (
            <Row mt={2} alignItems="center" gap={4}>
              <EyeIcon size={14} color="#E87322" />
              <Text fontSize={13} color="#999999">{contact.activityLabel}</Text>
              {/* activityLabel: "Visited Website" | "Viewed" */}
            </Row>
          )}
        </View>
        <Text fontSize={13} color="#999999" alignSelf="center">{contact.dateLabel}</Text>
        {/* dateLabel: "2d" | "3d" | "Jun 2" | "May 21" | "May 14" | "May 9" | "May 6" */}
        <RowDivider left={72} color="#EBEBEB" height={1} />
      </ActivityRow>
    ))}
  </ScrollView>

  {/* Floating action button */}
  <FAB
    icon={<PlusIcon color="white" size={24} />}
    bg="#4B9EF5"
    size={56}
    position="absolute"
    bottom={90 + 16}   /* above tab bar + 16pt margin */
    right={16}
    onPress={openCreateSheet}
  />

  {/* Bottom tab bar */}
  <BottomTabBar bg="white" height={83} borderTop="1px solid #E0E0E0">
    <Tab icon={<InboxTrayOutline />} label="Inbox" active={false} color="#999999"
         badge={{ count: 30, bg: '#FF3B30', textColor: 'white' }} />
    <Tab icon={<ActivityLineOutline />} label="Activity" active={true}
         activeColor="#4B9EF5" />
    <Tab icon={<CalendarGridOutline />} label="Calendar" active={false} color="#999999" />
    <Tab icon={<PeopleOutline />} label="People" active={false} color="#999999" />
    <Tab icon={<PriceTagOutline />} label="Deals" active={false} color="#999999" />
  </BottomTabBar>

</MobileShell>
```

### Data bindings
- **contacts[]**: fetched from FUB `/v1/events?type=website&assignedTo=everyone&sort=-created` (or equivalent activity endpoint filtered to website events)
- **contact.initials**: first letter of first + last name
- **contact.avatarColor**: deterministic from contact ID hash → one of the palette colors
- **contact.activityLabel**: "Visited Website" for first event type, "Viewed" for subsequent; some rows have no label (raw website hit with no sub-action)
- **contact.dateLabel**: relative if < 7 days ("2d", "3d"), absolute "Mon DD" if older
- **badge count 30**: total unread inbox items (crosses all sub-tabs of Inbox)

### Spacing constants
- Row left padding: 16 pt
- Avatar size: 40 pt circle
- Avatar → name gap: 16 pt
- Name → date gap: auto (flex)
- Row right padding: 16 pt
- Row min-height: 64 pt (no sub-label); 78 pt (with sub-label)
- Divider left inset: 72 pt (16 + 40 + 16)
- FAB right: 16 pt, bottom: 16 pt above tab bar
- Tab bar label font: 10 pt
- Sub-tab height: 44 pt (matches iOS standard tab height)

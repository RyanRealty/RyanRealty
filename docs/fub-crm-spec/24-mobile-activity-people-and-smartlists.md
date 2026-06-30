# Mobile — Activity Feed, People & Smart Lists

The Activity and People tabs are the two highest-frequency surfaces on the Ryan Realty in-house CRM mobile experience. The Activity tab is the broker's live pulse — a reverse-chronological feed of new leads, email opens/clicks, and website visits, filtered by team scope and segmented into three sub-tabs. The People tab is the contact navigator — an alphabetical smart-list directory that lets any broker jump from a curated queue (smart list) into a flat contact roster and drill into a single person's profile without touching the desktop. This section specifies both tab families at pixel precision, translated from FUB's iOS native app to a responsive-web implementation using the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist + Amboqia, shadcn/ui `@/components/ui/*`). FUB's information architecture and interaction patterns are preserved exactly; only the color palette and typeface tokens are adapted to the Ryan Realty brand.

---

## Design System Color Map

Before per-screen specs, this table resolves every FUB iOS color token to its Ryan Realty equivalent. All subsequent component specs use only Ryan Realty token names.

| FUB visual role | FUB observed hex | Ryan Realty token | Ryan Realty hex |
|---|---|---|---|
| Nav/header background | `#2E4A5C` / `#2D3E4F` / `#3C4F5C` / `#3d5a6e` | `bg-primary` | `#102742` |
| Active tab indicator / FAB / active tab label | `#4AACED` / `#4B9EF5` / `#4a9fd4` / `#2196b5` | `bg-primary` / `text-primary` | `#102742` |
| Header text (title, active sub-tab) | `#FFFFFF` | `text-primary-foreground` | `#faf8f4` (cream) |
| Inactive sub-tab label | `#8FA8BB` / `#8A9BAC` / rgba(255,255,255,0.6) | `text-muted-foreground` | `#6b7280` |
| Row primary text (name) | `#1D2F3E` / `#1A1A1A` / `#1c1c1e` / `#1C2B36` | `text-foreground` | `#111827` |
| Row secondary text (source, date, activity) | `#8FA8BB` / `#999999` / `#8e8e93` / `#8FA3AE` | `text-muted-foreground` | `#6b7280` |
| Row divider hairline | `#E8EDF0` / `#EBEBEB` / `#e0e0e0` / `#E4E9EC` | `border-border` | `#e5e7eb` |
| List / content background | `#FFFFFF` | `bg-card` | `#ffffff` |
| Bottom tab bar background | `#F7F7F7` / `#f4f5f6` / `#FFFFFF` | `bg-muted` | `#f3f4f6` |
| Tab bar border | `#E0E0E0` / `#d8dadc` | `border-border` | `#e5e7eb` |
| Inactive tab icon + label | `#9BA8B0` / `#9aa5ae` / `#8e8e93` / `#999999` | `text-muted-foreground` | `#9ca3af` |
| Inbox badge (red) | `#E53E3E` / `#FF3B30` / `#ff3b30` / `#e53935` | `bg-destructive` | `#dc2626` |
| Badge text | `#FFFFFF` | `text-destructive-foreground` | `#ffffff` |
| Count text (smart list) | `#2196b5` (FUB teal) | `text-primary` | `#102742` |
| Sub-tab strip bg (People tab) | `#eef0f2` | `bg-muted` | `#f3f4f6` |
| Active sub-tab indicator (People tab) | `#1a2e3d` | `bg-primary` | `#102742` |
| Count bar bg (smart list detail) | `#EEF1F4` | `bg-muted` | `#f3f4f6` |
| Count bar text | `#6B7F8C` | `text-muted-foreground` | `#6b7280` |
| Trailing chevron (smart list row) | `#C5CDD2` | `text-muted-foreground` | `#9ca3af` |
| Eye icon (website activity) | `#E87322` (functional orange) | keep `#E87322` — no RR orange token; use CSS custom prop `--color-activity-orange` | `#E87322` |
| FAB background | `#4AACED` / `#4a9fd4` / `#4B9EF5` | `bg-primary` | `#102742` |
| FAB icon | `#FFFFFF` | `text-primary-foreground` | `#faf8f4` |

**Typography:** Replace all SF Pro Text references with `font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif`. Display headings (screen titles) use Amboqia Boriango via `<H2>` primitives where the design calls for a large brand header; all body/list text uses Geist.

---

## Screen 1 — Activity Feed: New Leads Sub-tab

**[OBSERVED: mob-01]**

### 1.1 Purpose

Default landing screen when the broker opens the Activity tab. Shows every new lead sourced via ryan-realty.com (and other configured sources), newest first, scoped to the selected team filter.

### 1.2 Screen regions (390×844 pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background token |
|---|---|---|---|
| Safe area / status bar | 0–54 | 54 | `bg-primary` `#102742` |
| Top nav / header bar | 54–110 | 56 | `bg-primary` `#102742` |
| Sub-tab strip | 110–154 | 44 | `bg-primary` `#102742` (flush with header) |
| Active tab indicator line | 154–157 | 3 | `bg-primary-foreground` `#faf8f4` (cream line on navy) |
| Scrollable lead list | 157–766 | ~609 | `bg-card` `#ffffff` |
| FAB zone (overlaid) | ~710–766 | 56 | overlaps list |
| Bottom tab bar | 766–844 | 78 | `bg-muted` `#f3f4f6` |

### 1.3 Top nav / header bar — exact element spec

```
[BrokerAvatar 36pt] ·· [Everyone ▾ 17pt/500] ·· [BellIcon 24pt] [SearchIcon 24pt]
```

| Element | Spec |
|---|---|
| **BrokerAvatar** | 36×36 pt circle crop of the signed-in broker's headshot photo. 1 pt `bg-card` `#ffffff` circular border (contrast separator against navy). Left edge 16 pt from screen edge. Tappable — opens profile/settings bottom sheet. |
| **Team filter label** | Text: "Everyone" (or current broker name if scoped). Font: Geist 17 pt weight 500. Color: `text-primary-foreground` `#faf8f4`. Immediately followed by downward chevron `▾` in same color, ~12 pt. The entire unit is a single tappable hit target — opens the **Team Filter Sheet** (§A). Horizontally centered in the header. |
| **Bell icon** | Outline bell glyph, 24 pt, `text-primary-foreground` `#faf8f4`. No badge in base state (badge appears when unread notifications exist — red circle, 18 pt, `bg-destructive`, white numeral, positioned top-right of icon). Tapping pushes the Notification Center screen (spec: §20 of sibling section). |
| **Search icon** | Outline magnifying glass, 24 pt, `text-primary-foreground`. Right edge 16 pt from screen edge. Tapping opens the Activity search overlay (inline expansion — keyboard raises, search field appears below header). |

### 1.4 Sub-tab strip — exact element spec

Three equal-width tabs spanning full width, 44 pt tall, same `bg-primary` navy background as the header (flush, no gap). The active indicator is a 3 pt solid horizontal bar at the bottom edge of the tab cell.

| Tab index | Label text | Active state | Inactive state | Indicator |
|---|---|---|---|---|
| 0 | New Leads | Geist 15 pt weight 600, `text-primary-foreground` `#faf8f4` | Geist 15 pt weight 400, `text-muted-foreground` `#6b7280` | 3 pt cream `#faf8f4` bar, full cell width |
| 1 | Emails | — | Same inactive style | None |
| 2 | Website | — | Same inactive style | None |

Tapping any tab switches the list content via local state — no page navigation. Indicator slides to the active tab (CSS transition: 150 ms ease-out `left` / `transform`).

### 1.5 Lead list row — exact anatomy

Each row is a full-width touchable cell. No section headers. Flat list, newest first.

```
[Avatar 44pt] ···12pt··· [Name 17pt]                    [Date 13pt]
                         [via Ryan-Realty.com 13pt]
```

| Element | Spec |
|---|---|
| **Row height** | 74 pt (auto from padding: 15 pt top + 15 pt bottom + content) |
| **Left padding** | 16 pt (avatar left edge) |
| **Avatar** | 44×44 pt circle. If `contact.photoUrl` exists: circular photo crop. If no photo: initials circle with deterministic background color from name hash (see §1.8 Color Assignment) + white initials text, Geist 17 pt weight 600. |
| **Avatar-to-text gap** | 12 pt |
| **Primary text (name)** | Geist 17 pt weight 500, `text-foreground` `#111827`. Contact full name verbatim. Vertically centered upper half of row. |
| **Secondary text (source)** | Geist 13 pt weight 400, `text-muted-foreground` `#6b7280`. Format: `"via {sourceLabel}"` — e.g. `"via Ryan-Realty.com"`. Immediately below name, left-aligned. |
| **Date** | Geist 13 pt weight 400, `text-muted-foreground`. Right-aligned, 16 pt from right edge. Vertically centered. Format per §1.8 date rules. |
| **Row divider** | 1 px `border-border` `#e5e7eb`, full width edge-to-edge, at row bottom. |
| **Tap behavior** | Entire row is tap target. Navigates to Contact Detail (Person Profile) for that contact (`/crm/contacts/{id}`). |
| **Swipe-left actions** | [INFERRED from FUB docs §12a] Reveals 3 action buttons right-to-left: "Archive" (`bg-destructive`), "Text" (`bg-primary`), "Call" (`bg-success` green). Each 80 pt wide. Standard iOS/web swipe-reveal pattern. |

### 1.6 Verbatim sample data (from mob-01)

| # | Avatar bg | Initials | Name | Source | Date |
|---|---|---|---|---|---|
| 1 | `#B55A00` burnt orange | AC | Andy Christensen | via Ryan-Realty.com | 6/19/26, 10:58am |
| 2 | `#D93025` vivid red | TW | Theresa Wise | via Ryan-Realty.com | Jun 17 |
| 3 | `#707A00` olive | S | Scdvf | via Ryan-Realty.com | Jun 15 |
| 4 | (real photo — man in dark suit) | — | Derek Winchell | via Ryan-Realty.com | Jun 13 |
| 5 | (real image — "RIVERS TO THE SEA" wave graphic) | — | Tide Rivers | via Ryan-Realty.com | Jun 13 |
| 6 | `#6B7A8D` medium gray | LM | Laurie McAdam | via Ryan-Realty.com | Jun 12 |
| 7 | `#B55A00` burnt orange | A | As | via Ryan-Realty.com | Jun 12 |

### 1.7 FAB (Floating Action Button)

- Circle, 56 pt diameter, `bg-primary` `#102742`
- White `+` glyph, 24 pt, `text-primary-foreground`
- Position: `position: fixed`, `bottom: 94pt` (16 pt above tab bar), `right: 16pt`
- Shadow: `0 4px 12px rgba(16,39,66,0.35)`
- z-index above scroll content and tab bar
- Tap: opens **Quick Actions Sheet** (§G)

### 1.8 Computed rules

**Date formatting:**
- Today or yesterday, within ~24h: `M/D/YY, h:mma` — e.g. `"6/19/26, 10:58am"`
- Same year, older than yesterday: `"Mon D"` — e.g. `"Jun 17"`, `"Jun 12"`
- Prior year: `"Mon D, YYYY"` — e.g. `"Dec 3, 2025"`

**Avatar color assignment:** Derive from `djb2(contact.id) % 8`. Palette (from observed FUB colors adapted to remain visually distinct on `#ffffff` background):
```
0: #B55A00  (burnt orange)
1: #D93025  (vivid red)
2: #707A00  (olive green)
3: #6B7A8D  (slate blue-gray)
4: #6B6EAB  (purple periwinkle)
5: #4E7580  (slate teal)
6: #2196F3  (bright blue)
7: #B34033  (brick rust)
```

**Source label:** Pull `contact.source` from `crm_people.source`. If the raw value is a URL (e.g. `"ryan-realty.com"`), prefix with `"via "`. If it is a label (e.g. `"Import"`, `"Farm"`), render as-is without `"via "`.

### 1.9 Component tree

```tsx
<MobileShell>

  {/* Fixed top — navy header */}
  <StatusBarSpacer height={54} className="bg-primary" />

  <TopBar className="bg-primary h-[56pt] flex items-center px-4 gap-3">
    <BrokerAvatarButton
      src={session.broker.headshotUrl}
      size={36}
      ringColor="#faf8f4"
      ringWidth={1}
      onTap={openProfileSheet}
    />
    <TeamFilterPill
      label={teamFilter.label}       // "Everyone" | broker name
      className="flex-1 text-center text-[17px] font-medium text-primary-foreground"
      chevron
      onTap={openTeamFilterSheet}
    />
    <IconButton icon={<Bell />} className="text-primary-foreground" size={24}
      badge={notificationCount > 0 ? { count: notificationCount } : undefined}
      onTap={pushNotificationCenter}
    />
    <IconButton icon={<Search />} className="text-primary-foreground" size={24}
      onTap={openActivitySearch}
    />
  </TopBar>

  <SubTabStrip
    className="bg-primary h-[44pt]"
    activeIndicatorClassName="bg-primary-foreground h-[3px]"
    activeLabelClassName="text-primary-foreground font-semibold text-[15px]"
    inactiveLabelClassName="text-muted-foreground font-normal text-[15px]"
    tabs={[
      { key: "new_leads", label: "New Leads" },
      { key: "emails",    label: "Emails"    },
      { key: "website",   label: "Website"   },
    ]}
    activeTab={activeSubTab}           // 'new_leads' | 'emails' | 'website'
    onTabChange={setActiveSubTab}
  />

  <ScrollView
    className="flex-1 bg-card"
    onRefresh={refreshNewLeads}
  >
    {newLeads.map(lead => (
      <LeadRow
        key={lead.id}
        avatar={
          lead.photoUrl
            ? <CirclePhoto src={lead.photoUrl} size={44} />
            : <InitialsAvatar
                initials={lead.initials}
                bg={avatarColor(lead.id)}
                size={44}
                className="text-[17px] font-semibold text-white"
              />
        }
        primaryText={lead.fullName}
        primaryClassName="text-[17px] font-medium text-foreground"
        secondaryText={`via ${lead.sourceLabel}`}
        secondaryClassName="text-[13px] text-muted-foreground"
        date={formatLeadDate(lead.createdAt)}
        dateClassName="text-[13px] text-muted-foreground"
        rowHeight={74}
        divider
        onTap={() => navigate(`/crm/contacts/${lead.id}`)}
        swipeLeftActions={[
          { label: "Call",    icon: <Phone />,   bg: "bg-success",      onTap: () => initCall(lead)    },
          { label: "Text",    icon: <MessageSquare />, bg: "bg-primary", onTap: () => openText(lead)   },
          { label: "Archive", icon: <Archive />, bg: "bg-destructive",  onTap: () => archiveLead(lead) },
        ]}
      />
    ))}

    {newLeads.length === 0 && !loading && (
      <EmptyState
        icon={<Users className="text-muted-foreground" size={48} />}
        title="No new leads"
        subtitle="New leads will appear here as they come in."
      />
    )}
  </ScrollView>

  <Fab
    icon={<Plus size={24} className="text-primary-foreground" />}
    className="bg-primary"
    size={56}
    style={{ position: 'fixed', bottom: 94, right: 16 }}
    shadow="0 4px 12px rgba(16,39,66,0.35)"
    onTap={openQuickActionsSheet}
  />

  <BottomTabBar
    className="bg-muted border-t border-border h-[78pt]"
    activeColor="text-primary"
    inactiveColor="text-muted-foreground"
    labelClassName="text-[10px]"
    tabs={[
      { key: "inbox",    label: "Inbox",    icon: <InboxIcon />,       badge: inboxUnreadCount },
      { key: "activity", label: "Activity", icon: <ActivityIcon />,    active: true },
      { key: "calendar", label: "Calendar", icon: <CalendarIcon />     },
      { key: "people",   label: "People",   icon: <UsersIcon />        },
      { key: "deals",    label: "Deals",    icon: <TagDollarIcon />    },
    ]}
    onTabChange={navigateToTab}
  />

</MobileShell>
```

### 1.10 Data bindings

| Component | Table / endpoint | Key fields |
|---|---|---|
| `BrokerAvatarButton` | `crm_brokers` | `headshotUrl`, `name` |
| `TeamFilterPill` | Local state + `crm_brokers` | `filter: 'everyone' \| brokerId` |
| `LeadRow[]` | `crm_people` WHERE `stage = 'Lead'` AND `createdAt > cutoff`, sorted `createdAt DESC`, paginated 25 | `id`, `firstName`, `lastName`, `photoUrl`, `source`, `createdAt` |
| Inbox badge | `crm_inbox_threads` COUNT WHERE `readAt IS NULL` AND `assignedTo = session.userId` | `unreadCount` |
| Active sub-tab | Local UI state | `'new_leads' \| 'emails' \| 'website'` |

### 1.11 Acceptance criteria

1. [ ] Status bar area fills `bg-primary` (`#102742`) with no white gap above the header.
2. [ ] Header shows: broker avatar (36 pt circle, 1 pt cream ring) · "Everyone ▾" centered (Geist 17 pt/500, cream) · bell icon · search icon — all cream icons.
3. [ ] Sub-tab strip is flush below header, same navy background. Active tab "New Leads" has cream 3 pt indicator. Inactive tabs are `text-muted-foreground`.
4. [ ] Lead rows: 74 pt height, 44 pt avatar (initials or photo), `text-foreground` name 17 pt/500, `text-muted-foreground` source 13 pt, right-aligned date 13 pt, full-width 1 px `border-border` divider.
5. [ ] Same-day/yesterday leads show full datetime; older same-year leads show "Mon D" abbreviated.
6. [ ] Avatar initials background color is deterministic from contact ID — same contact always renders same color.
7. [ ] Swipe-left on any row reveals Call / Text / Archive actions.
8. [ ] Pull-to-refresh triggers re-fetch.
9. [ ] FAB is fixed bottom-right at 94 pt above bottom, navy circle, cream `+`.
10. [ ] Bottom tab bar: 78 pt, `bg-muted`, 5 tabs, Activity tab icon+label is `text-primary`, others `text-muted-foreground`. Inbox badge is red `bg-destructive`.
11. [ ] Tapping "Everyone ▾" opens the Team Filter Sheet (§A).
12. [ ] Tapping a row navigates to `/crm/contacts/{id}`.
13. [ ] Empty state renders when `newLeads.length === 0`.

---

## Screen 2 — Activity Feed: Emails Sub-tab

**[OBSERVED: mob-32]**

### 2.1 Purpose

Shows contacts who have recently opened or clicked an email sent by the brokerage. Same header and sub-tab strip as Screen 1, with "Emails" active. No activity sub-label icon in this tab (rows show only name + date — no eye icon).

### 2.2 Screen regions

Identical y-band layout to Screen 1 (§1.2). Sub-tab strip active underline moves to position index 1 ("Emails"). Content background: `bg-card` `#ffffff`.

### 2.3 Sub-tab strip diff from Screen 1

| Tab index | State |
|---|---|
| 0 New Leads | Inactive — `text-muted-foreground`, no indicator |
| **1 Emails** | **Active** — `text-primary-foreground` cream, 3 pt cream indicator bar |
| 2 Website | Inactive — `text-muted-foreground`, no indicator |

### 2.4 Email activity row anatomy

```
[Avatar 44pt] ···12pt··· [Name 17pt]                    [Date 14pt gray]
```

Row height: 72–76 pt (no secondary sub-label line — single-line content).

| Element | Spec |
|---|---|
| **Avatar** | 44×44 pt circle. Photo or initials (same rules as Screen 1 §1.8). |
| **Name** | Geist 17 pt weight 500, `text-foreground`. |
| **Date** | Geist 14 pt weight 400, `text-muted-foreground`. Right-aligned 16 pt from edge. |
| **Row divider** | 1 px `border-border`, left-inset to `16 + 44 + 12 = 72 pt` (starts at the name left edge, does not cut under the avatar). |
| **No sub-label** | The Emails tab does not show the eye icon or "Visited Website" / "Viewed" text — rows are name-only. |

### 2.5 Verbatim sample data (from mob-32)

| # | Avatar | Name | Date |
|---|---|---|---|
| 1 | Real photo — dark suit | Derek Winchell | 5d |
| 2 | `#8e9ba8` gray initials "LM" | Laurie McAdam | 5d |
| 3 | `#4e7580` steel teal initial "K" | Kungfumailman | 6d |
| 4 | `#7a8c1e` olive initials "NT" | Nadean TaberMartinez | Jun 20 |
| 5 | `#c0392b` red initials "TW" | Theresa Wise | Jun 17 |
| 6 | `#7a8c1e` olive initial "S" | Scdvf | Jun 17 |
| 7 | Real photo — casual, bearded male | Matt Ryan | Jun 15 |

### 2.6 Date formatting for Emails tab

- Within last 7 days: `"Nd"` — e.g. `"5d"`, `"6d"`
- Older: `"Mon DD"` — e.g. `"Jun 20"`, `"Jun 17"`

### 2.7 Right-edge panel handle [OBSERVED: mob-32]

A small rounded-rect pull-tab is pinned to the right edge of the screen, approximately y 290–310 pt, 16 pt wide × 50 pt tall, `bg-muted-foreground` `#9ca3af`, left-facing chevron `‹` glyph. Tapping/swiping opens a right-side panel (agent quick-filter or contact detail pane). **[INFERRED: implementation]** In responsive web, this maps to a slide-in right drawer component (`<Sheet side="right">`) for a quick agent filter or context panel.

### 2.8 Component tree diff from Screen 1

Replace the `ScrollView` content:

```tsx
<ScrollView className="flex-1 bg-card" onRefresh={refreshEmailActivity}>
  {emailActivity.map(contact => (
    <ActivityRow
      key={contact.id}
      avatar={contact.photoUrl
        ? <CirclePhoto src={contact.photoUrl} size={44} />
        : <InitialsAvatar initials={contact.initials} bg={avatarColor(contact.id)} size={44} />
      }
      name={contact.name}
      nameClassName="text-[17px] font-medium text-foreground"
      date={formatRelativeDate(contact.lastEmailAt)}  // "5d" | "Jun 20"
      dateClassName="text-[14px] text-muted-foreground"
      dividerInset={72}   // inset under avatar
      onTap={() => navigate(`/crm/contacts/${contact.id}`)}
    />
  ))}
</ScrollView>

{/* Right-edge panel handle */}
<div
  className="fixed right-0 flex items-center justify-center w-4 h-12 bg-muted rounded-l-lg cursor-pointer"
  style={{ top: 290 }}
  onClick={openRightPanel}
>
  <ChevronLeft className="text-muted-foreground" size={12} />
</div>
```

### 2.9 Data bindings

| Field | Source |
|---|---|
| `emailActivity[]` | `crm_timeline` JOIN `crm_people` WHERE `event_type IN ('email_open','email_click')` AND `assignedTo = filter`, sorted `event_at DESC`, LIMIT 50 |
| `contact.lastEmailAt` | `MAX(event_at)` per contact |

### 2.10 Acceptance criteria

1. [ ] Sub-tab "Emails" active, cream indicator. "New Leads" and "Website" inactive.
2. [ ] Row height 72–76 pt, single-line (name + date only, no sub-label).
3. [ ] Divider starts at 72 pt from left (inset to name column, does not break under avatar).
4. [ ] Date format: relative "Nd" for ≤ 7 days; "Mon DD" for older.
5. [ ] Right-edge panel handle visible at y~290 on right side; tap opens context drawer.
6. [ ] All other shell elements (header, sub-tabs, FAB, tab bar) identical to Screen 1.

---

## Screen 3 — Activity Feed: Website Sub-tab

**[OBSERVED: mob-05]**

### 3.1 Purpose

Shows contacts who have recently visited ryan-realty.com — the website-tracking pixel feed. Each row includes an eye icon + activity label ("Visited Website" or "Viewed") as a sub-label.

### 3.2 Sub-tab strip state

Tab index 2 "Website" is active. Tabs 0 and 1 are inactive.

### 3.3 Website activity row anatomy — the key difference

```
[Avatar 40pt] ···16pt··· [Name 16pt/semibold]              [Date 13pt gray]
                         [👁 eye-icon 14pt orange] [Visited Website 13pt gray]
```

| Element | Spec |
|---|---|
| **Avatar size** | 40 pt (mob-05 observed — slightly smaller than New Leads/Emails 44 pt). |
| **Name** | Geist 16 pt weight 600 (semibold), `text-foreground`. |
| **Activity sub-label row** | `display: flex; align-items: center; gap: 4pt; margin-top: 2pt`. |
| **Eye icon** | Outline eye with filled inner pupil glyph, 14 pt, color `#E87322` (functional orange — use CSS var `--color-activity-orange`). |
| **Activity label text** | Geist 13 pt weight 400, `text-muted-foreground`. Values: `"Visited Website"` (first event) or `"Viewed"` (subsequent visits). |
| **Row height** | 78 pt when sub-label present; 64 pt when sub-label absent (some rows show no activity label). |
| **Divider** | 1 px `border-border`, left-inset to `16 + 40 + 16 = 72 pt`. |

### 3.4 Verbatim sample data (from mob-05)

| # | Avatar | Name | Activity label | Date |
|---|---|---|---|---|
| 1 | `#6B6EAB` purple initials "MR" | Matthew Ryan | (none — no eye icon) | 2d |
| 2 | `#6B6EAB` purple initials "MR" | Matt Ryan | (none — no eye icon) | 3d |
| 3 | `#5A7F80` slate-teal initial "K" | Kungfumailman | 👁 Visited Website | Jun 2 |
| 4 | `#6B6EAB` purple initials "MN" | Mikayla Nelson | 👁 Viewed | May 21 |
| 5 | Real photo — woman, blonde, outdoors | Jessica King | 👁 Viewed | May 14 |
| 6 | `#2196F3` bright blue initials "ZP" | Zack Porter | 👁 Viewed | May 9 |
| 7 | `#B34033` brick-rust initials "RG" | Rachael Greenwalt | 👁 Viewed (clipped) | May 6 |

### 3.5 Date format (Website tab)

- ≤ 7 days: `"Nd"` — `"2d"`, `"3d"`
- 7–30 days: `"Mon D"` — `"Jun 2"`, `"May 21"`

### 3.6 Component tree diff — website row

```tsx
<ActivityRow onTap={() => navigate(`/crm/contacts/${contact.id}`)}>
  <ContactAvatar
    photo={contact.photoUrl}
    initials={contact.initials}
    color={avatarColor(contact.id)}
    size={40}
  />
  <div className="flex-1 ml-4">
    <p className="text-[16px] font-semibold text-foreground">{contact.name}</p>
    {contact.activityLabel && (
      <div className="flex items-center gap-1 mt-0.5">
        <EyeIcon size={14} style={{ color: 'var(--color-activity-orange)' }} />
        <span className="text-[13px] text-muted-foreground">{contact.activityLabel}</span>
        {/* activityLabel: "Visited Website" | "Viewed" | undefined */}
      </div>
    )}
  </div>
  <span className="text-[13px] text-muted-foreground self-center">
    {formatRelativeDate(contact.lastVisitAt)}
  </span>
  <RowDivider inset={72} />
</ActivityRow>
```

### 3.7 Data bindings

| Field | Source |
|---|---|
| `websiteVisitors[]` | `crm_website_events` JOIN `crm_people` WHERE `event_type IN ('page_view','property_view')` AND `assignedTo = filter`, GROUP BY `contact_id`, sorted `MAX(event_at) DESC` |
| `contact.activityLabel` | `'Visited Website'` if `event_type = 'page_view'`; `'Viewed'` if `event_type = 'property_view'`; `undefined` if event classification unknown |
| `contact.lastVisitAt` | `MAX(event_at)` per contact |

### 3.8 Acceptance criteria

1. [ ] "Website" sub-tab active, cream 3 pt indicator.
2. [ ] Rows with website activity show eye icon (`#E87322`) + activity label below name.
3. [ ] Rows without a classified activity label show name + date only (no sub-label row).
4. [ ] Avatar is 40 pt (not 44 pt as in New Leads/Emails tabs).
5. [ ] Row height auto-adjusts: 78 pt when sub-label present, 64 pt when absent.
6. [ ] Date format: "Nd" for ≤ 7 days, "Mon D" for older.

---

## Section A — Team Filter Sheet

**[INFERRED — basis: mob-01 "Everyone ▾" header control; mob-05 picker sheet description; FUB docs §12h; desktop §05 §7.2 agent scope dropdown]**

### A.1 Trigger

Tapping the "Everyone ▾" center control in the Activity or People header. Presents as a **bottom sheet** (slides up from screen bottom, partially dimmed scrim behind).

### A.2 Bottom sheet anatomy

```
┌──────────────────────────────────────────────┐
│   ————  (drag handle, 32×4 pt, rounded)      │
│                                              │
│  Filter by agent                             │  ← sheet title, Geist 15 pt, text-foreground
│  ────────────────────────────────────────    │
│                                              │
│  ✓  Everyone                                 │  ← selected (checkmark, text-primary)
│     Me                                       │
│  ────────────────────────────────────────    │
│     TEAM MEMBERS                             │  ← section header, 11 pt caps, text-muted-foreground
│  [avatar] Matt Ryan                          │
│  [avatar] Paul Stevenson                     │
│  [avatar] Rebecca Peterson                   │
│                                              │
│         [Cancel]                             │  ← ghost button, full width
└──────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Sheet bg** | `bg-card` `#ffffff`, top `border-radius: 12px` |
| **Drag handle** | 32×4 pt rounded pill, `bg-muted` `#e5e7eb`, centered at top |
| **Title** | "Filter by agent", Geist 15 pt, `text-foreground`, 16 pt left pad, 16 pt top pad |
| **Separator** | 1 pt `border-border` |
| **Row: "Everyone"** | Geist 16 pt weight 400, 48 pt row height, 16 pt h-pad. When selected: checkmark icon (`text-primary`) on left, label `text-primary` weight 600. |
| **Row: "Me"** | Same anatomy, no checkmark when "Everyone" is selected |
| **Section header: "TEAM MEMBERS"** | Geist 11 pt uppercase, `text-muted-foreground`, 16 pt l-pad, 8 pt v-pad, `bg-muted` row bg |
| **Broker rows** | 32 pt avatar circle (broker headshot), 8 pt gap, broker full name Geist 16 pt `text-foreground`, 48 pt row height |
| **Cancel button** | `<Button variant="ghost">`, full-width minus 32 pt h-margin, 48 pt height, `text-muted-foreground`, 16 pt below broker rows |
| **Selection behavior** | Tapping any row: (1) updates the header label to the selected value, (2) re-scopes the activity list, (3) closes the sheet automatically |

### A.3 Data

Broker rows pulled from `crm_brokers` (Matt Ryan, Paul Stevenson, Rebecca Peterson). "Me" scopes to `session.userId`. "Everyone" removes the scope filter.

---

## Screen 4 — People Tab: All Lists View

**[OBSERVED: mob-09]**

### 4.1 Purpose

Root of the People tab. Shows a directory of all smart lists (Collections) in a flat scrollable list. The broker taps a list to drill into its contact roster. This is the most common entry point for working a pipeline cadence on mobile.

### 4.2 Screen regions (390×844 pt)

| Region | y-band (pt) | Height (pt) | Background token |
|---|---|---|---|
| Safe area / status bar | 0–47 | 47 | `bg-primary` |
| Top nav / header bar | 47–103 | 56 | `bg-primary` |
| Sub-tab strip | 103–143 | 40 | `bg-muted` `#f3f4f6` |
| Sub-tab hairline | 143–144 | 1 | `border-border` |
| Scrollable smart list | 144–762 | 618 | `bg-card` `#ffffff` |
| Bottom tab bar | 762–844 | 82 | `bg-muted` |

**Key structural difference from Activity tab:** The sub-tab strip background is `bg-muted` `#f3f4f6` (light), not navy — creating a distinct two-zone look (dark header, light sub-tab strip, white list body).

### 4.3 Top nav header bar — People tab specifics

```
[BrokerAvatar 44pt w/ring] ·············· [People 17pt center] ··············· [Bell 24pt] [Search 24pt]
```

| Element | Spec |
|---|---|
| **BrokerAvatar** | 44×44 pt circle (larger than in Activity: 44 vs 36 pt). 2 pt `#faf8f4` ring. Tappable. |
| **Center title** | Plain text "People", Geist 17 pt weight 400, `text-primary-foreground`. **Non-interactive** — no chevron, no dropdown (this is different from the Activity tab). |
| **Bell icon** | Outline bell, 24 pt, `text-primary-foreground`. No badge in base state. |
| **Search icon** | Outline magnifying glass, 24 pt, `text-primary-foreground`. Tapping pushes the People search screen (§F). |

### 4.4 Sub-tab strip

Two equal-width tabs, 40 pt tall, `bg-muted` `#f3f4f6` background. Active indicator: 2 pt `bg-primary` `#102742` bottom bar, full tab width.

| Tab | State | Label style |
|---|---|---|
| **All Lists** | **ACTIVE** | Geist 14 pt weight 600, `text-foreground` `#111827` |
| Stages | Inactive | Geist 14 pt weight 400, `text-muted-foreground` `#9ca3af` |

Switching to Stages shows contacts grouped by pipeline stage (see §E — Stages sub-tab).

### 4.5 Smart list row — exact anatomy

Each row is a full-width tap target, 58 pt tall.

```
[Optional emoji 22pt] ···8pt··· [List name 16pt]  ·flex·  [Count 16pt teal]
```

| Element | Spec |
|---|---|
| **Row height** | 58 pt |
| **Left padding** | 16 pt |
| **Right padding** | 16 pt |
| **Emoji** | Native emoji character, 22 pt. Present only when the list has an assigned emoji. When absent, the name label starts at the left pad. Gap between emoji and label: 8 pt. |
| **List name** | Geist 16 pt weight 400, `text-foreground` `#111827`. Grows to fill available width (flex: 1). |
| **Count badge** | Geist 16 pt weight 400, `text-primary` `#102742` (formerly FUB teal `#2196b5` → mapped to `text-primary`). Right-aligned. Format: integers ≥ 1000 abbreviated as `"1.2k"`, `"7k"` etc.; 0 renders as `"0"` (not hidden). |
| **Row divider** | 1 px `border-border` full width edge-to-edge at row bottom. |
| **No chevron** | The All Lists view does NOT show a right-facing chevron — the count is the only right-side element. |
| **Tap** | Pushes the smart list detail screen for that list (Screen 5 pattern). |
| **Swipe-left** | [INFERRED] Reveals contextual actions: "Edit" (rename) for user-created lists, "Delete" for deletable lists. System lists show "Edit" only. |

### 4.6 Verbatim data (from mob-09, exact order)

| # | Emoji | List name | Count |
|---|---|---|---|
| 1 | 🖥️ | All Recent Online Activity | 11 |
| 2 | (none) | All Expireds | 637 |
| 3 | (none) | Expired No Contact | 138 |
| 4 | (none) | Absentee Owners | 805 |
| 5 | (none) | Absentee Owners No Contact | 550 |
| 6 | (none) | Matts Sphere | 1.2k |
| 7 | (none) | All Clients | 23 |
| 8 | (none) | Realtors | 0 |
| 9 | (none) | Migration Realtors | 0 |
| 10 | 🚨 | New Leads: No Call Attempt | 4 |
| 11 | 🤩 | Active & Pending Clients | 8 (partially behind FAB) |

**Note:** The count `1.2k` for "Matts Sphere" is rendered as a string: `formatCount(n: number): string { return n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'k' : String(n); }`.

### 4.7 FAB

Same spec as §1.7 but with a different action: tapping opens the **Add Person Sheet** (§H) instead of Quick Actions. The FAB overlaps the last visible row and the bottom tab bar at approximately x=334, y=706 pt (center).

### 4.8 Bottom tab bar — People tab active

Same 5-tab bar. "People" tab icon (two-person silhouette, filled) and label are `text-primary`. All others are `text-muted-foreground`. Inbox badge "30".

### 4.9 Component tree

```tsx
<MobileShell>

  <StatusBarSpacer height={47} className="bg-primary" />

  <TopBar className="bg-primary h-[56pt] flex items-center px-4">
    <BrokerAvatarButton src={session.broker.headshotUrl} size={44} ring={2} onTap={openProfileSheet} />
    <span className="flex-1 text-center text-[17px] font-normal text-primary-foreground">People</span>
    <IconButton icon={<Bell />} className="text-primary-foreground" size={24} onTap={pushNotificationCenter} />
    <IconButton icon={<Search />} className="text-primary-foreground" size={24} onTap={pushPeopleSearch} />
  </TopBar>

  <SubTabStrip
    className="bg-muted h-[40pt] border-b border-border"
    tabs={[
      { key: "all-lists", label: "All Lists" },
      { key: "stages",    label: "Stages"    },
    ]}
    activeTab={activePeopleTab}
    activeIndicatorClassName="bg-primary h-[2px]"
    activeLabelClassName="text-[14px] font-semibold text-foreground"
    inactiveLabelClassName="text-[14px] font-normal text-muted-foreground"
    onTabChange={setActivePeopleTab}
  />

  <ScrollView className="flex-1 bg-card" onRefresh={refreshSmartListCounts}>
    {smartLists.map(list => (
      <SmartListRow
        key={list.id}
        emoji={list.emoji}
        label={list.name}
        count={list.count}
        onTap={() => navigate(`/crm/people/list/${list.id}`)}
        swipeLeftActions={[
          { label: "Edit",   icon: <Pencil />,  bg: "bg-primary",     onTap: () => openEditListSheet(list) },
          ...(list.isDeletable
            ? [{ label: "Delete", icon: <Trash2 />, bg: "bg-destructive", onTap: () => confirmDeleteList(list) }]
            : []),
        ]}
      />
      // SmartListRow layout (inline):
      //   height: 58pt, flexDirection: row, alignItems: center,
      //   paddingHorizontal: 16pt
      //
      //   Left: {emoji && <Text text-[22px]>{emoji}</Text>} gap-2
      //          <Text flex-1 text-[16px] text-foreground>{label}</Text>
      //   Right: <Text text-[16px] text-primary>{formatCount(count)}</Text>
      //   Bottom: <Separator className="border-border" />
    ))}
  </ScrollView>

  <Fab
    icon={<Plus className="text-primary-foreground" size={24} />}
    className="bg-primary"
    size={56}
    style={{ position: 'fixed', bottom: 90, right: 16 }}
    onTap={openAddPersonSheet}
  />

  <BottomTabBar
    className="bg-muted border-t border-border h-[82pt]"
    tabs={[
      { key: "inbox",    label: "Inbox",    icon: <InboxIcon />,   badge: 30 },
      { key: "activity", label: "Activity", icon: <ActivityIcon /> },
      { key: "calendar", label: "Calendar", icon: <CalendarIcon /> },
      { key: "people",   label: "People",   icon: <UsersIcon />,   active: true },
      { key: "deals",    label: "Deals",    icon: <TagDollarIcon /> },
    ]}
    activeColor="text-primary"
    inactiveColor="text-muted-foreground"
    onTabChange={navigateToTab}
  />

</MobileShell>
```

### 4.10 Data bindings

| Component | Source | Key fields |
|---|---|---|
| `SmartListRow[]` | `crm_smart_lists` WHERE `isVisible = true` AND `(createdBy = session.userId OR sharedWith INCLUDES session.userId)`, sorted by `sort_order` | `id`, `name`, `emoji`, `count_cache` |
| Count refresh | Poll `GET /crm/api/smart-lists/counts` every 10 min while screen is open | Updates `count_cache` per list |

### 4.11 Acceptance criteria

1. [ ] Header shows "People" as static non-interactive center title (no chevron).
2. [ ] Broker avatar is 44 pt (not 36 pt as in Activity tab).
3. [ ] Sub-tab strip background is `bg-muted` (light gray), not navy.
4. [ ] "All Lists" sub-tab active with 2 pt `bg-primary` indicator.
5. [ ] Each smart list row is 58 pt, no trailing chevron, count right-aligned in `text-primary`.
6. [ ] Counts ≥ 1000 abbreviated as `"1.2k"`, `"7k"` etc.; 0 renders as `"0"`.
7. [ ] Emoji renders at 22 pt with 8 pt gap before label text. Rows without emoji start label flush left at 16 pt pad.
8. [ ] Swipe-left reveals Edit (all lists) and Delete (user-created lists only).
9. [ ] Tap navigates to smart list detail screen.
10. [ ] FAB taps open Add Person Sheet.
11. [ ] Pull-to-refresh triggers count re-fetch.

---

## Screen 5 — People Tab: Smart List Detail

**[OBSERVED: mob-10 — "All Recent Online Activity" list]**

### 5.1 Purpose

Second-level pushed screen. Shows all contacts matching a smart list's filter criteria. Back navigation returns to All Lists (Screen 4). The root bottom tab bar is **hidden** (native navigation stack behavior — the tab bar does not appear on pushed screens).

### 5.2 Screen regions (390×844 pt)

| Region | y-band (pt) | Height (pt) | Background token |
|---|---|---|---|
| Safe area / status bar | 0–54 | 54 | `bg-primary` |
| Nav / header bar | 54–108 | 54 | `bg-primary` |
| Count bar | 108–132 | 24 | `bg-muted` `#f3f4f6` |
| Scrollable contact list | 132–844+ | fills remainder | `bg-card` `#ffffff` |
| *(no bottom tab bar)* | — | — | — |
| *(no FAB)* | — | — | — |

### 5.3 Nav / header bar — smart list detail specifics

```
[‹ back 20pt] ·· [💻 emoji] [List name 17pt bold] ·· [Search 22pt]
                  [Everyone ▾ 13pt muted]
```

The header has two rows stacked vertically:

**Row 1 (title row):**

| Element | Spec |
|---|---|
| **Back chevron** | `‹` SF Symbol / Lucide `ChevronLeft`, white `text-primary-foreground`, 20 pt hit area. Tapping pops back to All Lists. |
| **Emoji prefix** | List's assigned emoji (e.g. `💻`), 18 pt, to the left of the list name. Present only when the list has an emoji. |
| **List name** | Geist 17 pt weight 600 (semibold), `text-primary-foreground`. Centered horizontally between back chevron and search icon. |
| **Search icon** | Magnifying glass, 22 pt, `text-primary-foreground`, right edge 16 pt. |

**Row 2 (agent filter sub-label):**

| Element | Spec |
|---|---|
| **Agent filter label** | Text: `"Everyone"` (or current agent name), Geist 13 pt weight 400, `text-primary-foreground` at 60% opacity (`rgba(250,248,244,0.6)`) |
| **Chevron** | `∨` 10 pt, same muted cream |
| **Tap target** | Entire sub-label row. Opens the Team Filter Sheet (§A) to scope the list to a specific broker. |

Combined header height: 54 pt (slightly shorter than Activity tab's 56 pt).

### 5.4 Count bar

Full-width band, 24 pt tall, `bg-muted` `#f3f4f6`, directly below nav bar.

```
8 people
```

- Text: `"{N} people"`, Geist 13 pt weight 400, `text-muted-foreground`, 16 pt left-pad.
- No controls. Read-only informational label.
- Updates when the agent filter changes.

### 5.5 Contact list row — smart list detail anatomy

```
[Avatar 44pt] ···12pt··· [Name 17pt]              [› chevron 12pt gray]
                         [Source 13pt muted]
```

Row height: 72 pt.

| Element | Spec |
|---|---|
| **Avatar** | 44×44 pt circle. Photo crop or initials (same palette as Activity tab §1.8). Left: 16 pt. |
| **Name** | Geist 17 pt weight 500 (or 400 — see mob-10: "regular/medium"), `text-foreground` `#111827`. |
| **Source sub-label** | Geist 13 pt weight 400, `text-muted-foreground`. Source string from contact record (e.g. `"Ryan-Realty.com"` for this list). |
| **Trailing chevron** | `›` ChevronRight, 12 pt, `text-muted-foreground` `#9ca3af`. Right-aligned, 16 pt from edge. Vertically centered. |
| **No date shown** | Smart list detail does NOT show dates per row (unlike Activity feed). |
| **Row divider** | 1 px `border-border`, left-inset to 68 pt (`16 + 44 + 8 = 68`). |
| **Tap** | Navigates to Contact Detail (`/crm/contacts/{id}`). |
| **Swipe-left** | [INFERRED] Reveals quick actions: Call, Text, Email. |

### 5.6 Verbatim sample data (from mob-10)

| # | Avatar | Name | Source |
|---|---|---|---|
| 1 | `#6B6EB8` purple-periwinkle "MR" | Matthew Ryan | Ryan-Realty.com |
| 2 | `#6B6EB8` purple-periwinkle "MR" | Matt Ryan | Ryan-Realty.com |
| 3 | `#D93030` red/coral "TW" | Theresa Wise | Ryan-Realty.com |
| 4 | `#7A7A00` olive "S" | Scdvf | Ryan-Realty.com |
| 5 | Real headshot — dark suit | Derek Winchell | Ryan-Realty.com |
| 6 | Real image — "RIVER TO THE SEA" wave | Tide Rivers | Ryan-Realty.com |
| 7 | `#6B7280` medium gray "LM" | Laurie McAdam | Ryan-Realty.com |
| 8 | Real headshot — casual, bearded | Matt Ryan | Ryan-Realty.com |

Total count: 8 people (shown in count bar). No date column in this view.

### 5.7 Component tree

```tsx
<MobileShell>

  <StatusBarSpacer height={54} className="bg-primary" />

  <TopBar className="bg-primary h-[54pt] flex-col justify-center px-4">
    <div className="flex items-center">
      <button onClick={navigateBack} className="text-primary-foreground p-1">
        <ChevronLeft size={20} />
      </button>
      <div className="flex-1 flex items-center justify-center gap-1.5">
        {list.emoji && <span className="text-[18px]">{list.emoji}</span>}
        <span className="text-[17px] font-semibold text-primary-foreground">{list.name}</span>
      </div>
      <button onClick={openSearch} className="text-primary-foreground p-1">
        <Search size={22} />
      </button>
    </div>
    <button
      onClick={openTeamFilterSheet}
      className="flex items-center justify-center gap-1 mt-1"
    >
      <span className="text-[13px] text-primary-foreground/60">{agentFilter.label}</span>
      <ChevronDown size={10} className="text-primary-foreground/60" />
    </button>
  </TopBar>

  <CountBar className="bg-muted h-[24pt] flex items-center px-4">
    <span className="text-[13px] text-muted-foreground">{contacts.length} people</span>
  </CountBar>

  <ScrollView className="flex-1 bg-card" onRefresh={refreshSmartList}>
    {contacts.map(contact => (
      <SmartListContactRow
        key={contact.id}
        avatar={
          contact.photoUrl
            ? <CirclePhoto src={contact.photoUrl} size={44} />
            : <InitialsAvatar
                initials={contact.initials}
                bg={avatarColor(contact.id)}
                size={44}
              />
        }
        name={contact.fullName}
        nameClassName="text-[17px] font-medium text-foreground"
        source={contact.source}           // e.g. "Ryan-Realty.com"
        sourceClassName="text-[13px] text-muted-foreground"
        trailingChevron
        dividerInset={68}
        onTap={() => navigate(`/crm/contacts/${contact.id}`)}
        swipeLeftActions={[
          { label: "Call",  icon: <Phone />,          bg: "bg-success",  onTap: () => initCall(contact)  },
          { label: "Text",  icon: <MessageSquare />,  bg: "bg-primary",  onTap: () => openText(contact)  },
          { label: "Email", icon: <Mail />,           bg: "bg-secondary",onTap: () => openEmail(contact) },
        ]}
      />
    ))}

    {contacts.length === 0 && (
      <EmptyState
        icon={<Users className="text-muted-foreground" size={48} />}
        title="No people found"
        subtitle="No contacts match the current filter."
      />
    )}
  </ScrollView>

  {/* No FAB and no bottom tab bar on this pushed screen */}

</MobileShell>
```

### 5.8 Data bindings

| Component | Source | Fields |
|---|---|---|
| `contacts[]` | `GET /crm/api/smart-lists/{id}/contacts?agent={agentFilter}` | `id`, `firstName`, `lastName`, `photoUrl`, `source`, `initials` |
| Count bar | `contacts.length` (or server-provided total) | integer |
| `list.emoji` | `crm_smart_lists.emoji` | optional string |
| `list.name` | `crm_smart_lists.name` | string |

### 5.9 Acceptance criteria

1. [ ] No bottom tab bar and no FAB — this is a pushed secondary screen.
2. [ ] Header has two rows: (1) back chevron + emoji + list name + search icon; (2) "Everyone ▾" agent filter sub-label.
3. [ ] Count bar is 24 pt `bg-muted`, left-aligned text `"{N} people"` in `text-muted-foreground`.
4. [ ] Each contact row: 72 pt, 44 pt avatar, name 17 pt, source sub-label 13 pt, trailing `›` chevron, divider at 68 pt left-inset.
5. [ ] No date column shown (unlike Activity feed).
6. [ ] Tap row navigates to contact detail.
7. [ ] Swipe-left reveals Call / Text / Email actions.
8. [ ] Agent filter sub-label tap opens Team Filter Sheet; re-scopes contact list.
9. [ ] Search icon taps opens inline search bar below header with keyboard up.
10. [ ] Pull-to-refresh re-fetches the list's contact membership.
11. [ ] Empty state when `contacts.length === 0`.

---

## Screen 6 — People Tab: All People Flat Contact List

**[INFERRED — basis: desktop §05 §3 "All People" view; mob-10 row pattern; FUB docs §12h "All Lists tab…can be executed/worked"]**

### 6.1 Purpose

The "All People" list is not shown directly in the mobile screenshots, but it is the implicit target when no smart list filter is active. On mobile, it is accessed by tapping a hypothetical "All People" row at the top of the All Lists screen, or via a URL param (`/crm/people`). It renders all contacts in the account (scoped to the signed-in agent's accessible contacts), sorted by last activity descending.

### 6.2 Header bar differences from Screen 5

- **No emoji** in the header (no list emoji for "All People").
- **Title:** "All People" (static, centered).
- **No agent filter sub-label row** in the header (agent filter available via the search/filter icon instead).
- **No count bar** (or count bar shows total: e.g. "17,123 people" — same format).

### 6.3 Contact row anatomy

Same anatomy as Screen 5 (Smart List Detail) §5.5, with one difference: **no "source" sub-label** in the simplest mobile version. The row shows name + trailing chevron only. If the column config for All People is carried to mobile, the row may include a source or last activity sub-label — see §6.4.

```
[Avatar 44pt] ···12pt··· [Name 17pt]              [› 12pt gray]
```

### 6.4 Extended row (with source sub-label) — recommended

Consistent with Screen 5 pattern and the desktop spec §05 §13 (row anatomy with source sub-label), render:

```
[Avatar 44pt] ···12pt··· [Name 17pt]              [› 12pt gray]
                         [Source 13pt muted]
```

Source sub-label text: contact's `source` field (e.g. `"Import"`, `"Ryan-Realty.com"`, `"Farm"`, `"Expired Listing"`).

### 6.5 Sorting

Default sort: `createdAt DESC` (newest contacts first). Alternate: `lastLeadActivity DESC` (via `/crm/people?sort=-lastLeadActivity`). Sort control can be exposed via a `…` icon or filter sheet.

### 6.6 Acceptance criteria (All People)

1. [ ] Header: "All People" static title, back chevron if pushed from elsewhere, search icon.
2. [ ] Rows: 44 pt avatar, name 17 pt, optional source sub-label 13 pt, trailing chevron.
3. [ ] Count bar: `"17,123 people"` or scoped count (full number, not abbreviated, in count bar on this screen).
4. [ ] Infinite scroll / pagination (load next 50 on bottom approach).
5. [ ] Pull-to-refresh.
6. [ ] Tap → contact detail.

---

## Screen 7 — People Tab: Stages Sub-tab

**[INFERRED — basis: mob-09 "Stages" inactive tab; FUB docs §12h "Stages tab: View contacts organized by pipeline stage"; desktop §05 §17.3 stage system]**

### 7.1 Purpose

Accessed by tapping the "Stages" sub-tab from the People > All Lists screen. Shows contacts grouped by their pipeline stage, with an expandable/collapsible section per stage.

### 7.2 Layout

Same shell as Screen 4 (All Lists) but the scroll content replaces the flat smart-list rows with **grouped stage rows**.

### 7.3 Stage section anatomy

```
[Stage name 15pt semibold]                  [N contacts 13pt muted]
──────────────────────────────────────────────────────────────────
[Avatar 40pt] [Contact name 16pt]              [Last activity 12pt gray]
[Avatar 40pt] [Contact name 16pt]              [Last activity 12pt gray]
```

Each stage section:
- **Section header:** Stage name left-aligned, Geist 15 pt weight 600, `text-foreground`. Contact count right-aligned, Geist 13 pt, `text-muted-foreground`. `bg-muted` row background, 40 pt height. Tappable to collapse/expand the stage's contact rows.
- **Chevron:** `▼` / `▶` on header right to indicate expanded/collapsed state.
- **Contact rows under stage:** 56 pt height, 40 pt avatar, name 16 pt, last activity date 12 pt right-aligned.

### 7.4 Stage order

Render stages in the order defined in `crm_stages.sort_order`. System stages first (Lead, Active Client, Pending, Closed, Trash). Custom stages follow.

### 7.5 Acceptance criteria

1. [ ] "Stages" sub-tab active when on this view.
2. [ ] Contacts grouped by stage with collapsible section headers.
3. [ ] Section header shows stage name + contact count.
4. [ ] Each contact row: 40 pt avatar, name, last activity date.
5. [ ] Tap any contact row → contact detail.
6. [ ] Collapsed stages show header only; expanded stages show all contact rows.

---

## Section B — Activity Search Overlay

**[INFERRED — basis: mob-01/05 search icon; FUB docs §12h "Search: search by name or select from recently accessed leads"]**

### B.1 Trigger

Tapping the search icon (magnifying glass) in the Activity tab header.

### B.2 Behavior

The search bar expands **inline**, replacing the top nav bar content:

```
[‹ Cancel]  [🔍 Search leads...        ×]
```

- `<Input>` Geist 16 pt, `bg-card` rounded, `text-foreground` placeholder `text-muted-foreground`. 
- Keyboard raises immediately.
- "Cancel" (left) collapses search, restores the header.
- As the user types, the scrollable list below filters in real time by contact name match (client-side for the already-loaded page; server-side for full-account search).
- Results show the same row anatomy as the active sub-tab's rows.

---

## Section C — People Search Screen

**[INFERRED — basis: mob-09 search icon; FUB docs §12h "search by name or select from recently accessed leads"; desktop §05 §4.1]**

### C.1 Trigger

Tapping the search icon (magnifying glass) in the People tab header (All Lists screen or Smart List Detail screen).

### C.2 Full-screen search sheet anatomy

```
┌──────────────────────────────────────────────────────┐
│ [‹ Cancel]  [🔍 Search people...            ×] 16pt  │  ← nav bar replaced
├──────────────────────────────────────────────────────┤
│ RECENTLY ACCESSED                                     │  ← section header 11pt caps muted
│ [avatar] Derek Winchell                              │
│ [avatar] Theresa Wise                                │
│ ──────────────────────────────────────────────────── │
│ ALL CONTACTS                                         │  ← section header
│ (results update as user types)                       │
│ [avatar] Andy Christensen      via Ryan-Realty.com  │
│ [avatar] Laurie McAdam         via Ryan-Realty.com  │
└──────────────────────────────────────────────────────┘
```

- **Recently Accessed** section: last 5–10 contacts the broker navigated to, from local session cache.
- **All Contacts** section: server-side search (`GET /crm/api/contacts/search?q={query}`) returning name/phone/email matches.
- Rows: 44 pt avatar + name 17 pt + source sub-label 13 pt. Same row anatomy as Screen 5.
- Tap any row → navigates to Contact Detail.

---

## Section D — FAB Quick Actions Sheet

**[INFERRED — basis: mob-01 FAB observed; FUB docs §12k "Quick Actions — 6 actions"; FUB iOS native behavior]**

### D.1 Trigger

Tapping the blue `+` FAB from the Activity tab (Screen 1, 2, or 3). A different action appears from the People tab FAB (see §H Add Person).

### D.2 Bottom sheet anatomy

```
┌──────────────────────────────────────────────┐
│   ———— (drag handle)                         │
│                                              │
│  Quick Actions                               │  ← title 16pt/semibold
│  ──────────────────────────────────────────  │
│  👤  Add a Person                            │
│  💬  Send Text                               │
│  📞  Make a Call                             │
│  ✉   Send Email                              │
│  📅  Schedule Appointment                    │
│  ✓   Add Task                                │
│  ──────────────────────────────────────────  │
│         [Cancel]                             │
└──────────────────────────────────────────────┘
```

| Row | Icon | Label | Action |
|---|---|---|---|
| 1 | UserPlus | Add a Person | Opens Add Person Sheet (§H) |
| 2 | MessageSquare | Send Text | Opens compose text modal (contact picker → text compose) |
| 3 | Phone | Make a Call | Opens dial pad or contact picker + call |
| 4 | Mail | Send Email | Opens email compose (contact picker → compose) |
| 5 | Calendar | Schedule Appointment | Opens appointment create form |
| 6 | CheckSquare | Add Task | Opens task create form |

Row height: 56 pt. Icon: 24 pt `text-primary`. Label: Geist 16 pt weight 400 `text-foreground`. Separator `border-border` between action rows.

---

## Section E — Add Person Sheet

**[INFERRED — basis: mob-09 FAB; desktop §05 §16 Add Person Modal; FUB docs §12k "Add a Person"]**

### E.1 Trigger

FAB on People tab, or "Add a Person" from the Quick Actions Sheet.

### E.2 Bottom sheet form anatomy

```
┌──────────────────────────────────────────────┐
│   ———— (drag handle)                         │
│  Add Person                    [× Close]     │
│  ──────────────────────────────────────────  │
│  [First Name ________] [Last Name _______]   │  ← 50%/50%
│  [Email ________________________________]    │  ← full width
│  [Phone ________________________________]    │  ← full width
│  [Select a lead source ▾               ]     │  ← full width dropdown
│  ──────────────────────────────────────────  │
│  [Cancel]           [Add person]             │
└──────────────────────────────────────────────┘
```

All fields use `<Input>` from `@/components/ui/input`. "Select a lead source" uses `<Select>` from `@/components/ui/select`. "Add person" (lowercase p — exact label from desktop spec §05 §16.5) button is `<Button>` (default navy), disabled until at least First Name is non-empty. "Cancel" is `<Button variant="ghost">`.

---

## Section F — Mobile Bulk / Multi-select

**[INFERRED — basis: desktop §05 §14; FUB docs mobile §12h "Actions from People: Add contacts, reassign contacts, assign action plans"]**

On mobile, full bulk-action functionality (the 11-item dropdown, checkbox multi-select bar, export modal) from the desktop is **not available directly** in the All Lists or Smart List Detail views. The mobile approximation:

### F.1 Per-row swipe actions (primary path on mobile)

Already specified per screen: swipe-left reveals 2–3 contextual actions (Call, Text, Archive/Email). These are single-contact quick actions, not bulk.

### F.2 Long-press multi-select [INFERRED]

Long-pressing a contact row in the Smart List Detail (Screen 5) activates multi-select mode:

- Checkboxes appear on the left of each row (same circle checkbox pattern as desktop).
- A multi-select action bar slides in above the list:
  ```
  [✓ 2 selected] ···· [Tag ▾] [Assign ▾] [More ▾] [✗ Cancel]
  ```
- "Tag ▾" opens Add Tags / Remove Tags sub-sheet.
- "Assign ▾" opens agent assignment picker.
- "More ▾" reveals: Update Stage, Update Timeframe, Apply Automation (subset of the 11 desktop bulk actions).
- Mass actions bypass automations (same architectural rule as desktop — see desktop §05 §14.3).
- Long-press to activate, tap to add/remove from selection, "Cancel" to exit mode.

---

## Global Shell Constants

| CSS token / constant | Value | Notes |
|---|---|---|
| `--mobile-shell-width` | `390pt` | Logical screen width |
| `--safe-area-top` | `47–54pt` | Varies by screen — status bar absorption |
| `--header-height` | `54–56pt` | Top nav bar |
| `--subtab-height` | `40–44pt` | Activity: 44 pt; People: 40 pt |
| `--tab-bar-height` | `78–82pt` | Activity: 78; People: 82 |
| `--fab-size` | `56pt` | Diameter |
| `--fab-bottom-offset` | `90–94pt` | Bottom edge of FAB above screen bottom |
| `--fab-right-offset` | `16pt` | Right edge of FAB from screen edge |
| `--row-avatar-large` | `44pt` | New Leads, Emails, Smart List Detail |
| `--row-avatar-medium` | `40pt` | Website sub-tab, Stages view |
| `--row-height-with-sublabel` | `74–78pt` | Activity rows with source/eye sub-label |
| `--row-height-single-line` | `64–72pt` | Email tab rows / smart list rows |
| `--smart-list-row-height` | `58pt` | All Lists directory rows |
| `--divider-inset-after-avatar-large` | `72pt` | `16 + 44 + 12` (Activity / Emails) |
| `--divider-inset-after-avatar-medium` | `72pt` | `16 + 40 + 16` (Website) |
| `--divider-inset-smart-list-detail` | `68pt` | `16 + 44 + 8` (Smart List Detail) |
| `--count-bar-height` | `24pt` | Smart list detail count bar |
| `--color-activity-orange` | `#E87322` | Eye icon / website activity accent |

---

## Data Model — Entities Touched

| Table | Operation | By which screen |
|---|---|---|
| `crm_people` | SELECT (paginated, filtered) | All screens |
| `crm_smart_lists` | SELECT (name, emoji, count_cache) | Screen 4 All Lists |
| `crm_smart_list_filters` | SELECT (to evaluate membership) | Screen 5 Smart List Detail |
| `crm_brokers` | SELECT (headshots, names, IDs) | Team Filter Sheet §A |
| `crm_website_events` | SELECT (filtered to contact) | Screen 3 Website |
| `crm_timeline` (or `crm_lead_events`) | SELECT (filtered by event_type) | Screen 2 Emails, Screen 3 Website |
| `crm_stages` | SELECT (for Stages tab grouping) | Screen 7 Stages |
| `crm_contact_stages` | SELECT (stage per contact) | Screen 7 Stages |
| `crm_inbox_threads` | COUNT unread | Inbox tab badge |
| `crm_notifications` | SELECT (unread count) | Bell badge |

**Key computed fields required:**
- `lastEmailAt` — `MAX(event_at)` from `crm_timeline` WHERE `event_type IN ('email_open','email_click')` AND `person_id = contact.id`
- `lastVisitAt` — `MAX(event_at)` from `crm_website_events` WHERE `person_id = contact.id`
- `smartList.count_cache` — refreshed on 10-min polling + on-demand when list is tapped
- `contact.initials` — computed: `firstName[0] + lastName[0]` (or `firstName[0..1]` if no lastName)
- `contact.avatarColor` — `djb2(contact.id) % 8` → palette index

---

## Acceptance Criteria — Overall Mobile Activity + People Module

### Navigation shell
1. [ ] Activity tab is always index 1 in the bottom bar (Inbox / Activity / Calendar / People / Deals).
2. [ ] People tab is always index 3. Both use outline icons when inactive, `text-primary` filled icons when active.
3. [ ] Inbox badge shows `crm_inbox_threads` unread count. Badge uses `bg-destructive` `#dc2626`, white numeral, 18 pt circle.
4. [ ] Pushed screens (Smart List Detail, Contact Detail) hide the bottom tab bar.
5. [ ] FAB is 56 pt, `bg-primary`, cream `+` icon, fixed at `bottom: 90–94pt, right: 16pt`, z-index above all content.
6. [ ] Safe area top fills `bg-primary` — no white gap on any screen.

### Activity tab
7. [ ] New Leads sub-tab: rows show name + "via {source}" sub-label + right-aligned date.
8. [ ] Emails sub-tab: rows show name + right-aligned relative date only (no sub-label). Divider at 72 pt left-inset.
9. [ ] Website sub-tab: rows show name + eye icon (`#E87322`) + activity label ("Visited Website" / "Viewed"). Rows without activity label show name + date only.
10. [ ] Date formatting: same-day → `M/D/YY, h:mma`; same-year older → `Mon D`; Emails/Website ≤ 7 days → `Nd`; Emails/Website older → `Mon DD`.
11. [ ] "Everyone ▾" tapping opens Team Filter Sheet with Everyone, Me, and 3 broker rows.
12. [ ] Bell icon shows badge when notifications exist; tapping pushes Notification Center.
13. [ ] Search icon opens inline search overlay in Activity; full-screen search in People.

### People tab
14. [ ] All Lists sub-tab: rows are 58 pt, emoji prefix (22 pt) or no prefix, name 16 pt, count `text-primary` right-aligned.
15. [ ] Count format: ≥ 1000 → `"Nk"` abbreviated; 0 → `"0"` (not hidden); 1–999 → integer string.
16. [ ] Stages sub-tab: contacts grouped by stage, collapsible sections, stage name + count header.
17. [ ] Tapping a smart list row pushes Smart List Detail (Screen 5).
18. [ ] Smart List Detail: back chevron in header, emoji + list name title, "Everyone ▾" filter sub-label, 24 pt count bar.
19. [ ] Smart List Detail rows: 44 pt avatar, name 17 pt, source sub-label 13 pt, trailing `›` chevron.
20. [ ] No FAB and no bottom tab bar on Smart List Detail screen.
21. [ ] Pull-to-refresh on all list screens.
22. [ ] Swipe-left on any contact row reveals action buttons (at minimum: Call, Text, Archive or Email).
23. [ ] Long-press activates multi-select mode with action bar.
24. [ ] Empty state renders with icon + message when list has 0 contacts.

---

## Cross-References

| Sibling section | File | Relationship |
|---|---|---|
| Desktop People List | `05-people-list-and-bulk-actions.md` | Data model, bulk actions, column spec, filter operators — mobile subset of desktop capability |
| Desktop Smart Lists | `06a-smart-lists-collections-and-list-management.md` | Smart list data model, emoji, sharing, per-list filter definitions |
| Desktop Filter Panel | `06b-smart-list-filters-columns-and-grouping.md` | Filter types — not shown on mobile but power the list membership |
| Mobile Inbox | Sibling §23 (mob-02, mob-03 etc.) | Inbox tab — adjacent tab, same bottom tab bar shell |
| Mobile Person Detail | Sibling §25 | Navigation target on all list row taps |
| Mobile Calendar | Sibling §26 | Adjacent tab |
| Mobile Deals | Sibling §27 | Adjacent tab |
| Mobile Notifications | Sibling §20 `20-mobile-apps-and-notifications.md` | Bell icon target; push notification config |
| Notification Center (mobile) | `20-mobile-apps-and-notifications.md` §12l | Bell → notification list screen |
| FUB iPhone People docs | `fub-docs/notifications-mobile.md` §12h | Authoritative mobile People tab behavior |
| FUB iPhone Quick Actions | `fub-docs/notifications-mobile.md` §12k | FAB action menu — 6 actions |

---

## Sources

### Observed screenshots (pixel-perfect basis)

| File | Screen | What was observed |
|---|---|---|
| **mob-01** | Activity / New Leads sub-tab | Complete header anatomy, "Everyone ▾", bell, search, sub-tab strip (3 tabs), lead row anatomy, 7 verbatim rows with avatar colors, date formats, FAB, bottom tab bar with Inbox badge "30" |
| **mob-05** | Activity / Website sub-tab | Website sub-tab active, eye icon + orange `#E87322` + "Visited Website"/"Viewed" sub-label rows, 7 verbatim rows, 40 pt avatar (smaller), relative date format "Nd", FAB, tab bar |
| **mob-32** | Activity / Emails sub-tab | Emails sub-tab active, single-line rows (no sub-label), 7 verbatim rows, right-edge panel handle, `#3d5a6e` header bg, sub-tab active underline `#5ab4e8`, FAB, tab bar |
| **mob-09** | People tab / All Lists | People tab header ("People" static title, 44 pt avatar with 2 pt ring), light `#eef0f2` sub-tab strip, All Lists vs Stages tabs, 11 verbatim smart list rows with emojis and counts (including "1.2k" format), FAB, People tab active in bottom bar |
| **mob-10** | People / Smart List Detail ("All Recent Online Activity") | Second-level pushed header with back chevron + emoji title + "Everyone ▾" sub-label + search, 24 pt count bar "8 people", 8 verbatim contact rows with trailing `›` chevron and source sub-label, no FAB, no bottom tab bar |

### Inferred screens (basis noted)

| Inferred screen | Basis |
|---|---|
| Team Filter Sheet (§A) | mob-01 "Everyone ▾" center control; mob-05 picker description; desktop §05 §7.2; FUB docs §13g |
| All People flat list (§6) | Desktop §05 §3–§6; mob-10 row pattern; FUB docs §12h |
| Stages sub-tab (§7) | mob-09 inactive "Stages" tab; FUB docs §12h "Stages tab: View contacts organized by pipeline stage"; desktop §05 §17.3 |
| Activity Search Overlay (§B) | mob-01/05 search icon; FUB docs §12h search behavior |
| People Search Screen (§C) | mob-09 search icon; FUB docs §12h |
| FAB Quick Actions Sheet (§D) | mob-01 FAB; FUB docs §12k 6 quick actions |
| Add Person Sheet (§E) | mob-09 FAB; desktop §05 §16 |
| Mobile Multi-select (§F) | Desktop §05 §14; FUB docs §12h "Actions from People: reassign contacts, assign action plans" |

### Desktop spec sections read

- `docs/fub-crm-spec/05-people-list-and-bulk-actions.md` — full (data model, row anatomy, bulk actions, Add Person modal, Export modal)
- `docs/fub-crm-spec/06a-smart-lists-collections-and-list-management.md` — full (smart list data model, filter definitions, Manage Lists page)
- `docs/fub-crm-spec/06b-smart-list-filters-columns-and-grouping.md` — referenced for filter operators

### FUB official documentation

- `fub-docs/notifications-mobile.md` — §12f Activity tab (3 sub-tab filters), §12h People tab (All Lists + Stages + search + Ponds limitation), §12k Quick Actions (6 actions), §12l Notification Center (badge + mark-all-read + limitations), §10 Mobile Push (event types + iOS settings)

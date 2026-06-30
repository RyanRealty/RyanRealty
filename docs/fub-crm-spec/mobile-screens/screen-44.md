<!-- Mobile per-screen appendix. Original: IMG_6012.PNG | id: mob-44 | tiles: mob-tiles/mob-44_{full,t,m,b}.png -->

# mob-44 — inhouse-web — Home Dashboard (Website activity tab)

## Identity
- **app_source:** inhouse-web
- **module:** Home / Dashboard
- **screen:** CRM Home Dashboard with the "Website" sub-tab active inside the activity-feed card. Shows site-visitor contacts sorted by recency, plus an empty-state "Needs your action" section below.
- **how to reach:** Tap the "Home" tab (leftmost) in the bottom tab bar from any other CRM screen.
- **iOS status bar:** Time "7:34" · Signal 1/4 bars · WiFi · Battery 17% (yellow warning)
- **URL bar:** `ryan-realty.com` (Safari compact address bar, centered text; sparkle/AI icon on left edge, share icon on right edge)

---

## Screen regions (top → bottom, y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | #FFFFFF (white) |
| Safari URL bar | 54–98 | 44 | #F2F2F7 (system grey pill) |
| App nav/header bar | 98–154 | 56 | #FFFFFF with 1 px bottom border #E5E5EA |
| Greeting + filter row | 154–210 | 56 | #F5F5F5 (off-white page bg) |
| Activity card (sub-tabs + list) | 210–590 | 380 | #FFFFFF (card), card bg #F5F5F5 |
| Gap / page bg | 590–615 | 25 | #F5F5F5 |
| "Needs your action" section | 615–760 | 145 | Header ~#1C1C1E (near-black), body #FFFFFF |
| Bottom tab bar (app) | 760–824 | 64 | #FFFFFF with 0.5 px top border #C6C6C8 |
| Safari chrome toolbar | 824–844 | ~49 | #F9F9F9 (Safari system bg) |

---

## Nav / header bar (exact)

**Left control:** Hamburger menu — three horizontal lines (≡), ~24×18 pt, dark grey (#3C3C43), tap opens side-drawer or navigation menu.

**Center:** Ryan Realty wordmark image — Amboqia Boriango typeface, navy `#102742`, text reads "Ryan Realty" on one line with "BEND·OREGON" small-caps subtitle below, centered in header. This is an `<img>` logo asset, not live text.

**Right controls (left to right):**
1. Search — magnifying glass icon inside a rounded-rectangle button (~32×32 pt, 8 px radius border), stroke weight medium, grey (#3C3C43). Tap → opens search/filter overlay.
2. Avatar button — circular pill ~32×32 pt, light grey background (#E5E5EA), contains bold letter "M" (for Matt), dark navy text. Tap → opens profile/account settings.

---

## Bottom tab bar (exact)

Five equal-width tabs across full width (~78 pt each). Active = **Home**.

| Position | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline (home glyph, slightly filled/bolder) | **Home** | none | **ACTIVE** — label bold weight, icon darker #1C1C1E |
| 2 | Inbox tray outline | Inbox | none | inactive — #8E8E93 |
| 3 | Two-person silhouette outline | People | none | inactive — #8E8E93 |
| 4 | Stacked layers / stack icon (3 horizontal layers) | Deals | none | inactive — #8E8E93 |
| 5 | Activity/pulse waveform (zigzag line) | Activity | none | inactive — #8E8E93 |

Active label color: #1C1C1E (near-black). Inactive label + icon: #8E8E93 (system grey). Tab bar background: #FFFFFF. Top separator: 0.5 pt, #C6C6C8.

**FAB (Floating Action Button):** Blue circle ~56 pt diameter, color #2F6FED (medium blue), white "+" icon 24 pt. Positioned at x≈340 pt, y≈695 pt (bottom-right, overlapping the "Needs your action" body area, above the tab bar). Tap → [INFERRED] opens new lead / new contact creation sheet.

**Safari chrome (below tab bar):**
Row of 5 controls: ← Back (grey) · → Forward (grey) · ⊕ New Tab (circle outline, grey) · ⎕2 Tabs count (rounded-square with "2", grey) · ··· More (ellipsis, grey). Background #F9F9F9.

---

## Content — every element, in order

### 1. Greeting + scope-filter row (y ~154–210 pt)

- **Left:** Bold large text "Good morning, Matt." — font ~22 pt, weight 700, color #1C1C1E. Left-padded ~16 pt.
- **Right:** Segmented toggle pill — two options side-by-side in a rounded-rect container (~120 pt wide, ~32 pt tall, bg #E5E5EA, 16 px radius):
  - Segment 1: "Everyone" — inactive, text ~13 pt medium, color #8E8E93
  - Segment 2: "Just me" — **active**, text ~13 pt semibold, color #1C1C1E, white background pill (#FFFFFF) with subtle shadow, ~8 px inner radius
- Tapping "Everyone" switches feed to show all-broker activity; "Just me" filters to Matt only.

### 2. Activity card (y ~215–590 pt)

White rounded-rectangle card, corner radius ~16 pt, shadow subtle (0 2 8 rgba(0,0,0,0.06)), horizontal margin ~12 pt from screen edges.

#### 2a. Sub-tab strip (inside card, y ~215–260 pt)

Three equal-width tabs spanning full card width. Thin 1 pt bottom divider beneath the row (#E5E5EA).

| Tab | State | Style |
|---|---|---|
| New Leads | inactive | ~14 pt, weight 400, color #8E8E93, no border |
| Emails | inactive | ~14 pt, weight 400, color #8E8E93, no border |
| **Website** | **ACTIVE** | ~14 pt, weight 700, color #1C1C1E; surrounded by a visible rounded-rectangle border box (~4 px radius, 1.5 pt stroke, #1C1C1E), occupying the full tab cell width |

Active indicator: a solid rounded-rectangle outline drawn around the "Website" cell (not a simple underline). This is a box-selection style indicator.

#### 2b. Contact rows (inside card, y ~260–590 pt)

Four rows, each separated by a 1 pt horizontal divider (#E5E5EA), full card width. Row height ~80 pt. All rows show the same activity type: "Viewed the site".

**Row anatomy:**
```
[Avatar 44pt circle] [Name 16pt bold] [right-aligned age badge]
                     [Activity text 13pt grey]
```

Row data (verbatim):

| # | Avatar | Name | Activity | Age |
|---|---|---|---|---|
| 1 | Purple circle `#5B4FCF` (indigo-purple), white initials "MR" | **Matthew Ryan** | Viewed the site | 5d |
| 2 | Real photo (circular crop): person in snow/mountain outdoor scene, grey-toned | **Matt Ryan** | Viewed the site | 6d |
| 3 | Blue circle `#2F6FED`, white initials "AC" | **Andy Christensen** | Viewed the site | 10d |
| 4 | Green circle `#65A30D` (lime-green), white initials "TW" | **Theresa Wise** | Viewed the site | 12d |

- **Avatar:** 44 pt diameter circle. Initials-based avatars use 2-char uppercase initials, white text ~15 pt semibold. Photo avatars show the contact's actual photo (circular mask).
- **Name:** ~16 pt, weight 600/semibold, color #1C1C1E, left of avatar + 12 pt gap.
- **Activity text:** "Viewed the site" — ~13 pt, weight 400, color #8E8E93 (grey), directly below name.
- **Age badge:** Right-aligned, ~13 pt, color #8E8E93, e.g. "5d", "6d", "10d", "12d". No badge container (raw text).
- **Tappable:** Entire row tap → navigates to that contact's detail/profile page.
- **Swipe actions:** [INFERRED] left-swipe likely reveals quick actions (call, text, email) consistent with other CRM list screens.
- **No chevron (›):** Rows do not show a right-chevron indicator. Tap affordance is implied by full-row hit target.

### 3. "Needs your action" section (y ~615–760 pt)

Dark rounded-rectangle card, corner radius ~16 pt, horizontal margin ~12 pt, same as the activity card.

**Header bar** (inside card, top portion, ~44 pt tall):
- Background: near-black `#1C1C1E` (or `#222222`)
- Text: "Needs your action" — ~15 pt, weight 600, color #FFFFFF, left-padded ~16 pt

**Body area** (below header, white background):
- **Empty state:** Green circle-checkmark icon, ~36 pt diameter, stroke `#22C55E` (green), with a checkmark glyph inside. Centered horizontally.
- **Text below icon:** "You are all caught up" — ~15 pt, weight 400, color #1C1C1E, centered. (Partially clipped at the bottom of the visible viewport.)
- This is the empty-state for the "Needs your action" task/action queue — no pending tasks exist.

---

## Colors, type & iconography

| Token | Value | Usage |
|---|---|---|
| Page background | `#F5F5F5` | Body bg behind cards |
| Card background | `#FFFFFF` | Activity card, Needs-your-action body |
| Nav bar bg | `#FFFFFF` | App header |
| Dark header bg | `#1C1C1E` | "Needs your action" header band |
| Primary text | `#1C1C1E` | Names, greeting, active tab |
| Secondary text | `#8E8E93` | Activity subtitle, inactive tabs, ages |
| Divider | `#E5E5EA` | Row separators, card border subtle |
| Active tab border | `#1C1C1E` | Box-outline on "Website" tab |
| FAB blue | `#2F6FED` | Floating action button |
| Avatar purple | `#5B4FCF` | Matthew Ryan initials avatar |
| Avatar blue | `#2F6FED` | Andy Christensen initials avatar |
| Avatar green | `#65A30D` | Theresa Wise initials avatar |
| Empty-state green | `#22C55E` | Checkmark circle icon |
| Navy brand | `#102742` | Ryan Realty wordmark logo |

**Typography:**
- Greeting "Good morning, Matt." — ~22 pt, weight 700, SF Pro Display or system sans
- Card names — ~16 pt, weight 600
- Activity subtitle / ages — ~13 pt, weight 400
- Sub-tab labels — ~14 pt (inactive 400, active 700)
- "Needs your action" header — ~15 pt, weight 600, white
- Bottom tab labels — ~10 pt, weight 400 (inactive), 600 (active)

**Iconography:**
- Hamburger: 3-line stroke icon
- Search: magnifying glass in rounded-rect button
- "M" avatar: circular badge with letter
- Home tab: outlined house glyph
- Inbox tab: tray/inbox outline
- People tab: two-person silhouette
- Deals tab: stacked-layers (3 horizontal ovals)
- Activity tab: waveform/pulse zigzag

---

## Interactions & gestures

- **Tap "Home" tab** → stays on this screen (already active). [INFERRED]
- **Tap "Inbox" tab** → navigates to conversation inbox list. [INFERRED]
- **Tap "People" tab** → navigates to contacts/people list. [INFERRED]
- **Tap "Deals" tab** → navigates to deals pipeline. [INFERRED]
- **Tap "Activity" tab** → navigates to full activity feed. [INFERRED]
- **Tap "New Leads" sub-tab** → switches activity card to show newly registered leads. [INFERRED]
- **Tap "Emails" sub-tab** → switches activity card to show contacts who sent/opened emails. [INFERRED]
- **Tap "Website" sub-tab** → already active; shows contacts who viewed the site.
- **Tap "Everyone" toggle** → switches feed to show activity from all brokers. [INFERRED]
- **Tap "Just me" toggle** → already active; filters to Matt's contacts only.
- **Tap any contact row** → pushes to that contact's detail/profile screen. [INFERRED]
- **Swipe left on row** → [INFERRED] reveals quick-action buttons (e.g., call, text, email).
- **Pull-to-refresh on scroll area** → [INFERRED] reloads activity feed from server.
- **Tap FAB (+)** → [INFERRED] opens bottom sheet to create new lead/contact/task.
- **Tap hamburger (≡)** → [INFERRED] opens left side-drawer with nav links.
- **Tap search icon** → [INFERRED] opens search overlay for contacts.
- **Tap "M" avatar button** → [INFERRED] opens profile/account settings panel.
- **Scroll down in page** → reveals more of "Needs your action" section and any content below.

---

## Build notes (component tree)

```tsx
<MobileShell>
  {/* Safari URL bar rendered by browser — not buildable */}

  <TopBar>
    <HamburgerButton onClick={openSideDrawer} />
    <BrandLogo src="/brand/logo-blue.png" alt="Ryan Realty BEND·OREGON" />
    <SearchButton icon="search" shape="rounded-rect" onClick={openSearch} />
    <AvatarButton initials="M" onClick={openProfile} />
  </TopBar>

  <PageContent bg="#F5F5F5" paddingX={12}>

    {/* Greeting row */}
    <GreetingRow>
      <Heading size="xl" weight={700} color="#1C1C1E">
        Good morning, Matt.
      </Heading>
      <ScopeToggle
        options={["Everyone", "Just me"]}
        active="Just me"
        onChange={setScopeFilter}
        // active segment: white pill, shadow, #1C1C1E text
        // inactive: transparent, #8E8E93 text
      />
    </GreetingRow>

    {/* Activity card */}
    <Card radius={16} bg="#FFFFFF" shadow="0 2px 8px rgba(0,0,0,0.06)" marginTop={8}>

      {/* Sub-tab strip */}
      <SubTabStrip
        tabs={["New Leads", "Emails", "Website"]}
        active="Website"
        onChange={setActivityTab}
        activeStyle="box-outline"  // solid border-box, not underline
        borderColor="#1C1C1E"
        borderRadius={4}
        height={44}
        dividerBottom="1px solid #E5E5EA"
      />

      {/* Contact rows — Website visitors */}
      <ContactList divider="1px solid #E5E5EA">
        {websiteVisitors.map(contact => (
          <ContactRow
            key={contact.id}
            onTap={() => navigate(`/contacts/${contact.id}`)}
            height={80}
            paddingX={16}
          >
            <Avatar
              size={44}
              shape="circle"
              src={contact.photoUrl}           // null → initials fallback
              initials={contact.initials}       // e.g. "MR", "AC", "TW"
              bg={contact.avatarColor}          // deterministic color from name hash
              textColor="#FFFFFF"
              fontSize={15}
              fontWeight={600}
            />
            <ContactMeta flex={1} marginLeft={12}>
              <ContactName size={16} weight={600} color="#1C1C1E">
                {contact.fullName}
              </ContactName>
              <ActivityLabel size={13} color="#8E8E93">
                Viewed the site
              </ActivityLabel>
            </ContactMeta>
            <AgeBadge size={13} color="#8E8E93">
              {contact.daysAgo}d
            </AgeBadge>
          </ContactRow>
        ))}
      </ContactList>
    </Card>

    {/* Needs your action card */}
    <Card radius={16} bg="#FFFFFF" shadow="0 2px 8px rgba(0,0,0,0.06)" marginTop={12}>
      <SectionHeader
        bg="#1C1C1E"
        color="#FFFFFF"
        size={15}
        weight={600}
        paddingX={16}
        height={44}
        borderRadius="16px 16px 0 0"
      >
        Needs your action
      </SectionHeader>
      <SectionBody padding={24} alignItems="center">
        {tasks.length === 0 ? (
          <EmptyState>
            <CheckCircleIcon size={36} color="#22C55E" strokeWidth={2} />
            <EmptyText size={15} color="#1C1C1E" marginTop={12}>
              You are all caught up
            </EmptyText>
          </EmptyState>
        ) : (
          <TaskList tasks={tasks} />
        )}
      </SectionBody>
    </Card>

  </PageContent>

  {/* Floating Action Button */}
  <Fab
    icon="plus"
    bg="#2F6FED"
    iconColor="#FFFFFF"
    size={56}
    position="fixed"
    bottom={80}   // above tab bar + breathing room
    right={16}
    onClick={openNewContactSheet}
    shadow="0 4px 12px rgba(47,111,237,0.35)"
  />

  {/* Bottom tab bar */}
  <BottomTabBar
    tabs={[
      { id: "home",     label: "Home",     icon: HomeIcon,     active: true  },
      { id: "inbox",    label: "Inbox",    icon: InboxIcon,    active: false },
      { id: "people",   label: "People",   icon: PeopleIcon,   active: false },
      { id: "deals",    label: "Deals",    icon: StackIcon,    active: false },
      { id: "activity", label: "Activity", icon: ActivityIcon, active: false },
    ]}
    activeColor="#1C1C1E"
    inactiveColor="#8E8E93"
    bg="#FFFFFF"
    topBorder="0.5px solid #C6C6C8"
    height={64}
    labelSize={10}
  />

  {/* Safari chrome: back/forward/+/tabs/more — rendered by browser, not buildable */}
</MobileShell>
```

### Data bindings

| Component | Data source |
|---|---|
| `GreetingRow` heading | `currentUser.firstName`, time-of-day logic (`getGreeting()`) |
| `ScopeToggle` | `GET /api/crm/scope-filter` — persisted per-user preference |
| `SubTabStrip` | Static tab config; active tab → `GET /api/crm/home/activity?tab=website&scope=me` |
| `ContactRow` avatar color | Deterministic from `hashColor(contact.fullName)` (consistent across sessions) |
| `ContactRow` `daysAgo` | `Math.floor((now - contact.lastSiteVisit) / 86400000)` |
| `Needs your action` | `GET /api/crm/tasks?assignee=me&status=pending` — empty = show caught-up state |
| FAB | Opens `<NewContactSheet>` or `<QuickActionSheet>` bottom modal |

### Spacing constants
- Screen horizontal padding: **16 pt**
- Card horizontal margin from screen edge: **12 pt** (card fills 390 − 24 = 366 pt)
- Row height (contact list): **80 pt**
- Avatar size: **44 pt** diameter
- Avatar ↔ text gap: **12 pt**
- Sub-tab height: **44 pt**
- Section header height: **44 pt**
- Bottom tab bar height: **64 pt** (excluding Safari chrome)
- FAB size: **56 pt** diameter
- FAB bottom offset from tab bar top: **16 pt** (FAB bottom edge = tab bar top − 16)

# Mobile — In-House Web (current build) vs FUB mobile

This section documents every captured screen of the Ryan Realty in-house CRM as it renders in mobile Safari on iPhone (url: ryan-realty.com), establishes a pixel-accurate baseline, translates each screen into a build-ready component tree, and closes with a comprehensive gap table comparing the current in-house mobile web experience to the FUB iOS app target. The audience is the build team responsible for bringing the in-house CRM mobile web experience to FUB parity. Every measurement below derives from actual screenshots (390×844 pt logical canvas, iPhone 14/15 scale) unless explicitly tagged [INFERRED].

All screen coordinates assume the 390×844 pt logical canvas used by modern iPhone models (iPhone 14 / 15 family). y=0 is the top of the physical screen including the iOS status bar.

Cross-references: the desktop feature descriptions live in `§21 21-gap-map-vs-inhouse-crm.md`. FUB mobile app screens in §23–§29 of this spec (FUB-captured screens). Data model in `04-data-model-and-erd.md`.

---

## Screen 1 — Home Dashboard (Website activity tab)

**[OBSERVED — mob-44]**

### How to reach
Tap the "Home" tab (leftmost) in the bottom tab bar from any CRM screen. Default landing screen after login.

### Screen regions (390×844 pt)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | `#FFFFFF` |
| Safari URL bar | 54–98 | 44 | `#F2F2F7` pill on white |
| App nav/header bar | 98–154 | 56 | `#FFFFFF` + 1 px bottom `#E5E5EA` |
| Greeting + filter row | 154–210 | 56 | `#F5F5F5` |
| Activity card (sub-tabs + rows) | 210–590 | 380 | card `#FFFFFF` on page `#F5F5F5` |
| Page gap | 590–615 | 25 | `#F5F5F5` |
| "Needs your action" section | 615–760 | 145 | header `#1C1C1E`, body `#FFFFFF` |
| Bottom tab bar | 760–824 | 64 | `#FFFFFF` + 0.5 px top `#C6C6C8` |
| Safari chrome toolbar | 824–844 | ~20 | `#F9F9F9` (OS-rendered) |

### Nav / header bar — exact elements

| Slot | Element | Size | Color |
|---|---|---|---|
| Left | Hamburger (≡) — 3-line stroke icon | 24×18 pt | `#3C3C43` |
| Center | Ryan Realty wordmark (`<img>` asset, Amboqia Boriango) + "BEND·OREGON" sub-label | ~140 pt wide | navy `#102742` |
| Right-1 | Search — magnifying glass in rounded-rect button | 32×32 pt, 8 px radius border | `#3C3C43` icon |
| Right-2 | "M" avatar — circle with bold letter "M" | 32×32 pt | `#E5E5EA` bg, navy text |

### Greeting + filter row (y 154–210)

- **Left:** "Good morning, Matt." — 22 pt, weight 700, `#1C1C1E`, left pad 16 pt
- **Right:** Segmented toggle pill, 120 pt wide, 32 pt tall, `#E5E5EA` bg, 16 px radius
  - "Everyone" — inactive, 13 pt medium, `#8E8E93`
  - "Just me" — ACTIVE, 13 pt semibold, `#1C1C1E`, white pill `#FFFFFF` with shadow, 8 px inner radius

### Activity card (y 210–590)

- Container: 16 pt corner radius, shadow `0 2px 8px rgba(0,0,0,0.06)`, 12 pt horizontal margins (card = 366 pt wide)
- **Sub-tab strip** (y 215–260, 44 pt tall): 3 equal tabs, 1 px bottom divider `#E5E5EA`

| Tab | State | Style |
|---|---|---|
| New Leads | inactive | 14 pt w400 `#8E8E93` |
| Emails | inactive | 14 pt w400 `#8E8E93` |
| **Website** | **ACTIVE** | 14 pt w700 `#1C1C1E` + solid border-box outline 1.5 pt `#1C1C1E` 4 px radius (box-selection style — NOT an underline) |

- **Contact rows** (y 260–590): 4 rows, 80 pt each, 1 px divider `#E5E5EA`

Row anatomy:
```
[Avatar 44pt circle] [Name 16pt w600 #1C1C1E]          [age: 13pt #8E8E93]
                     [Activity 13pt #8E8E93]
```

| # | Avatar | Initials/Photo | Name | Activity | Age |
|---|---|---|---|---|---|
| 1 | circle `#5B4FCF` (indigo-purple) | "MR" white 15 pt w600 | **Matthew Ryan** | Viewed the site | 5d |
| 2 | real photo (circular crop, mountain scene) | photo | **Matt Ryan** | Viewed the site | 6d |
| 3 | circle `#2F6FED` (blue) | "AC" white | **Andy Christensen** | Viewed the site | 10d |
| 4 | circle `#65A30D` (lime-green) | "TW" white | **Theresa Wise** | Viewed the site | 12d |

### "Needs your action" section (y 615–760)

- Rounded-rect card, 16 pt radius, 12 pt horizontal margins
- **Header bar** (44 pt): `#1C1C1E` bg, "Needs your action" 15 pt w600 white, left pad 16 pt
- **Body** (empty state): Green circle-checkmark `#22C55E` 36 pt centered + "You are all caught up" 15 pt w400 `#1C1C1E` centered

### Bottom tab bar (y 760–824)

| # | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline | **Home** | none | **ACTIVE** — `#1C1C1E`, bold |
| 2 | Inbox tray outline | Inbox | none | inactive `#8E8E93` |
| 3 | Two-person silhouette | People | none | inactive `#8E8E93` |
| 4 | Stacked layers (3 horizontal) | Deals | none | inactive `#8E8E93` |
| 5 | Waveform / pulse zigzag | Activity | none | inactive `#8E8E93` |

- Tab bar bg: `#FFFFFF`, top border 0.5 pt `#C6C6C8`, height 64 pt
- Active: `#1C1C1E` label + icon bolder. Inactive: `#8E8E93`. Labels: 10 pt.

### FAB

- Position: fixed, x≈340, y≈695 (above tab bar). Size: 56 pt diameter circle
- Color: `#2F6FED` (medium blue). Icon: white "+" 24 pt
- Shadow: `0 4px 12px rgba(47,111,237,0.35)`
- Action [INFERRED]: opens new contact / new lead creation bottom sheet

### Component tree

```tsx
<MobileShell>
  {/* Safari URL bar — OS-rendered */}

  <TopBar height={56} bg="#FFFFFF" borderBottom="1px solid #E5E5EA">
    <HamburgerButton icon="≡" size={24} color="#3C3C43" onClick={openSideDrawer} />
    <BrandLogo
      src="/design_system/ryan-realty/assets/brand/logo-blue.png"
      alt="Ryan Realty BEND·OREGON"
    />
    <SearchButton shape="rounded-rect" radius={8} size={32} color="#3C3C43" onClick={openSearch} />
    <AvatarButton initials="M" size={32} bg="#E5E5EA" textColor="#1C1C1E" onClick={openProfile} />
  </TopBar>

  <PageContent bg="#F5F5F5" px={12}>

    <GreetingRow pt={16} pb={8}>
      <Heading size={22} weight={700} color="#1C1C1E">
        {getGreeting()}, {currentUser.firstName}.
      </Heading>
      <ScopeToggle
        options={["Everyone", "Just me"]}
        active={scopeFilter}          // persisted preference
        activeStyle={{ bg: "#FFFFFF", shadow: "sm", textColor: "#1C1C1E" }}
        inactiveStyle={{ textColor: "#8E8E93" }}
        containerBg="#E5E5EA"
        containerRadius={16}
        innerRadius={8}
        width={120}
        height={32}
        onChange={setScopeFilter}
      />
    </GreetingRow>

    <Card radius={16} bg="#FFFFFF" shadow="0 2px 8px rgba(0,0,0,0.06)" mt={8}>
      <SubTabStrip
        tabs={["New Leads", "Emails", "Website"]}
        active={activityTab}
        onChange={setActivityTab}
        height={44}
        dividerBottom="1px solid #E5E5EA"
        activeStyle="box-outline"          // solid rounded-rect border, NOT underline
        activeBoxBorderColor="#1C1C1E"
        activeBoxRadius={4}
        activeFont={{ size: 14, weight: 700, color: "#1C1C1E" }}
        inactiveFont={{ size: 14, weight: 400, color: "#8E8E93" }}
      />
      <ContactList divider="1px solid #E5E5EA">
        {websiteVisitors.map(c => (
          <ContactRow
            key={c.id}
            height={80}
            px={16}
            onTap={() => navigate(`/admin/console/leads/${c.id}`)}
          >
            <Avatar
              size={44}
              shape="circle"
              src={c.photoUrl ?? null}
              initials={c.initials}         // 2-char uppercase
              bg={hashAvatarColor(c.id)}    // deterministic: #5B4FCF / #2F6FED / #65A30D etc.
              textColor="#FFFFFF"
              fontSize={15}
              fontWeight={600}
            />
            <ContactMeta flex={1} ml={12}>
              <ContactName size={16} weight={600} color="#1C1C1E">{c.fullName}</ContactName>
              <ActivityLabel size={13} color="#8E8E93">Viewed the site</ActivityLabel>
            </ContactMeta>
            <AgeBadge size={13} color="#8E8E93">{c.daysAgo}d</AgeBadge>
          </ContactRow>
        ))}
      </ContactList>
    </Card>

    <Card radius={16} bg="#FFFFFF" shadow="0 2px 8px rgba(0,0,0,0.06)" mt={12}>
      <SectionHeader
        bg="#1C1C1E" color="#FFFFFF" size={15} weight={600}
        px={16} height={44} borderRadius="16px 16px 0 0"
      >
        Needs your action
      </SectionHeader>
      <SectionBody p={24} align="center">
        {tasks.length === 0 ? (
          <>
            <CheckCircleIcon size={36} color="#22C55E" strokeWidth={2} />
            <Text size={15} color="#1C1C1E" mt={12}>You are all caught up</Text>
          </>
        ) : (
          <TaskList tasks={tasks} />
        )}
      </SectionBody>
    </Card>

  </PageContent>

  <Fab
    icon="plus" bg="#2F6FED" iconColor="#FFFFFF" size={56}
    position="fixed" bottom={80} right={16}
    shadow="0 4px 12px rgba(47,111,237,0.35)"
    onClick={openNewContactSheet}
  />

  <BottomTabBar
    height={64} bg="#FFFFFF" topBorder="0.5px solid #C6C6C8"
    activeColor="#1C1C1E" inactiveColor="#8E8E93" labelSize={10}
    tabs={[
      { id: "home",     label: "Home",     icon: HomeIcon,     active: true  },
      { id: "inbox",    label: "Inbox",    icon: InboxIcon,    active: false },
      { id: "people",   label: "People",   icon: PeopleIcon,   active: false },
      { id: "deals",    label: "Deals",    icon: StackIcon,    active: false },
      { id: "activity", label: "Activity", icon: ActivityIcon, active: false },
    ]}
  />
</MobileShell>
```

### Data touched

| Component | Entity / fields |
|---|---|
| Greeting | `currentUser.firstName`, `new Date().getHours()` |
| ScopeToggle | user preference (persisted) |
| Website visitors | `crm_timeline` WHERE kind='web_event' + scope + recency ORDER BY created_at DESC |
| Avatar colors | deterministic hash of `crm_people.id` |
| Needs your action | `crm_tasks` WHERE assignee=me AND status='open' ORDER BY due_at |

### Spacing constants

- Screen horizontal padding: 16 pt; Card margin: 12 pt each side
- Row height (contact): 80 pt; Avatar: 44 pt; Avatar↔text gap: 12 pt
- Sub-tab height: 44 pt; Section header: 44 pt; Bottom tab bar: 64 pt; FAB: 56 pt

### Acceptance criteria

1. Greeting text renders "Good morning / afternoon / evening, {first name}." based on local time.
2. "Just me" scope filter is the default; toggling "Everyone" reloads the list.
3. Active sub-tab ("Website" by default) shows a **box-outline** border, not an underline.
4. Avatar color is deterministic from contact ID — same color across sessions.
5. Photo avatar (circular crop) renders when `photoUrl` is non-null; initials fallback otherwise.
6. Tapping any row navigates to `/admin/console/leads/[id]`.
7. "Needs your action" shows green checkmark + "You are all caught up" when `crm_tasks` is empty for the broker.
8. FAB is `#2F6FED` (not the brand navy) and fixed above the tab bar.
9. Bottom tab bar: 5 tabs, Home is active, 64 pt height, labels 10 pt.

---

## Screen 2 — Contact Detail: Memberships / Workflows (keyboard-open state)

**[OBSERVED — mob-45]**

### How to reach
Bottom tab → People → tap any contact row → scroll down past profile fields to the "Memberships" section. A phone/numeric input field below the fold is active, triggering the iOS numpad.

### Screen regions (390×844 pt, keyboard raised)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | `#FFFFFF` |
| Safari address bar | 54–98 | 44 | `#F2F2F7` pill |
| Scrollable content | 98–620 | 522 | `#FFFFFF` |
| Bottom tab bar | 620–690 | 70 | `#FFFFFF`, top border `#E5E5EA` |
| iOS QuickType bar | 690–738 | 48 | `#D1D1D6` |
| iOS numeric keypad | 738–844+ | 310+ (extends below) | `#D1D1D6` / white key tiles |

> The iOS keyboard pushes up from the bottom; Safari bottom chrome is fully hidden behind the keyboard.

### Nav / header bar
Safari native address bar only (no in-app back chevron). Center: "ryan-realty.com" in gray pill. Left: Sparkle AI icon `#8E8E93`. Right: Share sheet icon `#8E8E93`. The contact name / header section is scrolled above the fold.

### Bottom tab bar (keyboard-state)

| # | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline | — | none | inactive `#3C3C43` |
| 2 | Arch / chat outline | — | none | inactive `#3C3C43` |
| 3 | Two-person silhouette | **People** | none | **ACTIVE** `#102742` navy |
| 4 | Stacked layers | **Deals** | none | inactive `#3C3C43` |
| 5 | Waveform | — | hidden (keyboard dismiss overlaps) | inactive |

FAB: blue `#2563EB`, 56 pt circle, white "+", bottom-right x≈350, y≈610.

### Content — Memberships section (y 98–620 visible)

**Section heading "Memberships"**
- 22 pt semibold, `#111111`, left 16 pt, top pad 24 pt

**Group header: "WORKFLOWS"**
- 11 pt all-caps medium `#8E8E93`, left 16 pt, top 12 pt

**Toggle rows × 4** (each 52 pt tall, 1 px divider `#E5E5EA` left-inset 16 pt):

| Label | Toggle state |
|---|---|
| "Buyer Lead — Master Workflow" | OFF — gray `#E9E9EA` track, white thumb |
| "Expired Recovery (auto)" | OFF |
| "FSBO Recovery (auto)" | OFF |
| "Seller Lead — Master Workflow" | OFF |

Row anatomy: label left 16 pt (16 pt regular `#111111`), iOS-style toggle right (51×31 pt).

**Group header: "NEWSLETTER & ALERTS"**
- Same style as WORKFLOWS header

**Display row: "Newsletter"**
- Primary: "Newsletter" — 16 pt semibold `#111111`
- Secondary: "Not subscribed" — 13 pt regular `#8E8E93`
- No toggle — read-only display row (tap navigates to subscription management)
- Row height: ~56 pt

**Content continues below fold** (keyboard covers it).

### iOS Keyboard (OS-rendered, not buildable)

QuickType bar: key/password icon, credit card icon, location pin icon, blue keyboard-dismiss `#007AFF`.
Numpad: 3-col layout (1, 2 ABC, 3 DEF / 4 GHI, 5 JKL, 6 MNO / 7 PQRS, 8 TUV, 9 WXYZ / blank, 0, ⌫). White rounded-rect keys on `#D1D1D6` bg.

### Component tree

```tsx
<MobileShell>
  <SafariAddressBar /> {/* OS chrome */}

  <ScrollView flex={1} bg="#FFFFFF" contentInset={{ bottom: 310 }}>
    {/* Contact header above fold (not visible in this capture) */}

    <SectionHeading text="Memberships" fontSize={22} fontWeight={600} color="#111111" px={16} pt={24} />

    <GroupHeader label="WORKFLOWS" />        {/* all-caps 11pt #8E8E93 */}

    {workflows.map(wf => (
      <>
        <ToggleRow
          key={wf.id}
          label={wf.name}
          value={wf.enrolled}
          onChange={(v) => patchWorkflowEnrollment(contactId, wf.id, v)}
          height={52}
          px={16}
          labelSize={16}
          labelColor="#111111"
          toggleOffTrack="#E9E9EA"
          toggleOnTrack="#102742"   // Ryan Realty navy for ON state
        />
        <HairlineDivider color="#E5E5EA" insetLeft={16} />
      </>
    ))}

    <GroupHeader label="NEWSLETTER & ALERTS" />

    <DisplayRow
      primary="Newsletter"
      primarySize={16}
      primaryWeight={600}
      primaryColor="#111111"
      secondary="Not subscribed"
      secondarySize={13}
      secondaryColor="#8E8E93"
      height={56}
      px={16}
      onPress={() => navigate(`/admin/console/leads/${contactId}/newsletter`)}
    />
    <HairlineDivider color="#E5E5EA" insetLeft={16} />

    {/* "Listing alerts" row — below fold in this capture [INFERRED] */}
    <DisplayRow
      primary="Listing alerts"
      secondary={`${contact.savedSearchCount} saved searches`}
      onPress={() => navigate(`/admin/console/leads/${contactId}/alerts`)}
    />
  </ScrollView>

  <FAB icon="plus" bg="#2563EB" size={56} position="absolute" bottom={80} right={16}
    onPress={openAddMembershipSheet} />

  <BottomTabBar
    height={70} bg="#FFFFFF" borderTop="1px solid #E5E5EA"
    activeColor="#102742" inactiveColor="#3C3C43"
    tabs={[
      { id: "home",     label: "Home",     icon: HomeIcon     },
      { id: "inbox",    label: "Inbox",    icon: InboxIcon    },
      { id: "people",   label: "People",   icon: PeopleIcon,  active: true },
      { id: "deals",    label: "Deals",    icon: StackIcon    },
      { id: "activity", label: "Activity", icon: ActivityIcon },
    ]}
  />
</MobileShell>
```

### Data touched

| Component | Entity / fields |
|---|---|
| ToggleRow × 4 | `crm_sequence_enrollments` filtered to `contact_id` + workflow type, or `crm_people.workflow_flags` |
| Newsletter row | `crm_report_subscriptions` WHERE person_id=id AND type='newsletter' |
| Listing alerts row | `crm_people.saved_search_count` or count from `saved_searches` table |

### Acceptance criteria

1. All four workflow toggle rows render with OFF state by default when the contact has no enrollments.
2. Toggling ON enrolls the contact in that workflow (PATCH to enrollment API); toggle animates to ON `#102742` navy track.
3. "Not subscribed" subtitle updates to "Subscribed" after newsletter toggle ON [INFERRED per standard CRM behavior].
4. Numeric input below fold correctly triggers iOS numpad (type="tel" or inputMode="numeric").
5. Keyboard-raised state: ScrollView has `contentInset.bottom = keyboardHeight` so the active input remains visible.
6. Bottom tab bar remains visible above the keyboard (height 70 pt).
7. FAB sits above the tab bar (bottom offset = tab bar height + 10 pt).

---

## Screen 3 — Contact Detail: Custom Fields

**[OBSERVED — mob-46]**

### How to reach
Bottom tab → People → tap contact row → scroll or tap to "Custom fields" section.

### Screen regions (390×844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | `#FFFFFF` |
| Safari URL bar | 54–88 | 34 | `#F2F2F7` |
| App header/nav bar | 88–148 | 60 | `#FFFFFF` + bottom border `#E5E7EB` |
| Scrollable content | 148–780 | 632 | `#FFFFFF` |
| Bottom tab bar | 780–844 | 64 | `#FFFFFF` + top border `#E5E7EB` |

### Nav header (y 88–148)

| Slot | Element |
|---|---|
| Left | Hamburger ≡, ~20×16 pt, `#1A1A2E` (navy-dark) |
| Center | "Ryan Realty" Amboqia ~22 pt navy `#102742` + "BEND·OREGON" 9 pt all-caps |
| Right-1 | Search icon in rounded-rect, 36×36 pt, border `#D1D5DB`, bg `#FFFFFF`, icon `#6B7280` |
| Right-2 | "M" avatar circle 36×36 pt, bg `#9CA3AF`, white "M" |

### Bottom tab bar

| # | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline | Home | none | inactive `#9CA3AF` |
| 2 | Inbox/envelope outline | Inbox | none | inactive `#9CA3AF` |
| 3 | Two-person silhouette | **People** | none | **ACTIVE** `#102742` navy, label bold |
| 4 | Stacked layers | Deals | none | inactive `#9CA3AF` |
| 5 | Waveform/pulse | Activity | none | inactive `#9CA3AF` |

FAB: `#2563EB` 56 pt circle, white "+", bottom-right x≈340, y≈720.

### Content — Custom fields (y 148–780)

**Page heading "Custom fields"**
- 22–24 pt w700 `#111827`, left 16 pt, top pad 24 pt

A 4 pt left-inset border `#E5E7EB` runs the full content container height at x≈46 pt — creates a "card within page" visual.

**Group: ENGAGEMENT (read-only)**

Group label: "ENGAGEMENT" — all-caps, 11 pt w600 `#6B7280`, left 16 pt, top margin 16 pt, bottom 8 pt.

Each row: field label (15 pt `#6B7280`) · `—` value (15 pt `#6B7280`) · NO edit control. Row height 44 pt. Divider 1 pt `#F3F4F6`.

Fields (all show `—`): Lead Score · Seller Score · Lead Tier · Engagement Streak Days · Last Active Date · Listings Viewed · Listings Saved · CMA Downloads

**Group: BUYER (editable)**

Group label: "BUYER" — same all-caps style.

Each row: field label (15 pt `#6B7280`) · `—` value · "Edit" text tap-target (14 pt `#6B7280` right-aligned, 44×44 pt hit area). Row height 48 pt. Divider 1 pt `#F3F4F6`.

Fields (all show `— Edit`): Buyer Budget Min · Buyer Budget Max · Buyer Search Areas · Preferred Communities · Preferred Beds · Preferred Baths · Preferred Property Type · Move Timeline

**Group: SELLER (partially below fold)**

Group label "SELLER" visible at very bottom. Fields below viewport. Content continues.

### Component tree

```tsx
<MobileShell>
  <SafariAddressBar url="ryan-realty.com" />

  <TopBar height={60} bg="#FFFFFF" borderBottom="1px solid #E5E7EB">
    <HamburgerButton color="#1A1A2E" size={20} onPress={openDrawer} />
    <BrandLogo wordmark="Ryan Realty" subtitle="BEND·OREGON" color="#102742" />
    <SearchButton variant="rounded-rect" size={36} border="#D1D5DB" bg="#FFFFFF" icon="#6B7280" onPress={openSearch} />
    <AvatarButton initials="M" size={36} bg="#9CA3AF" color="#FFFFFF" onPress={openAccountMenu} />
  </TopBar>

  <ScrollView contentInset={{ bottom: 64 }} bg="#FFFFFF">
    {/* 4pt left-border container */}
    <Box borderLeft="4px solid #E5E7EB" ml={46}>

      <SectionHeading text="Custom fields" fontSize={22} fontWeight={700}
        color="#111827" pl={16} pt={24} pb={8} />

      {/* ENGAGEMENT — read-only */}
      <CustomFieldGroup label="ENGAGEMENT">
        {engagementFields.map(f => (
          <CustomFieldRow key={f.key} label={f.label} value={f.value} editable={false} />
        ))}
      </CustomFieldGroup>

      {/* BUYER — editable */}
      <CustomFieldGroup label="BUYER">
        {buyerFields.map(f => (
          <CustomFieldRow
            key={f.key}
            label={f.label}
            value={f.value}
            editable={true}
            onEdit={() => openFieldEditor(f.key)}
          />
        ))}
      </CustomFieldGroup>

      {/* SELLER — partially below fold */}
      <CustomFieldGroup label="SELLER">
        {sellerFields.map(f => (
          <CustomFieldRow key={f.key} label={f.label} value={f.value} editable={true}
            onEdit={() => openFieldEditor(f.key)} />
        ))}
      </CustomFieldGroup>

    </Box>
  </ScrollView>

  <Fab icon="plus" bg="#2563EB" size={56} position="bottom-right"
    right={16} bottom={72} onPress={createNewContact} />

  <BottomTabBar height={64} bg="#FFFFFF" borderTop="1px solid #E5E7EB"
    activeColor="#102742" inactiveColor="#9CA3AF"
    tabs={[
      { id:"home", icon:HomeIcon }, { id:"inbox", icon:InboxIcon },
      { id:"people", icon:PeopleIcon, active:true },
      { id:"deals", icon:StackIcon }, { id:"activity", icon:ActivityIcon },
    ]}
  />
</MobileShell>
```

### CustomFieldRow component spec

```tsx
// editable=false: renders label + "—" (no Edit button)
// editable=true: renders label + value/dash + "Edit" text tap-target
<CustomFieldRow>
  ┌──────────────────────────────────────────────────────┐
  │ [label 15pt #6B7280]  [value/dash 15pt #6B7280]  [Edit?]  │  h=44–48pt
  └──────────────────────────────────────────────────────┘
  {/* 1pt divider #F3F4F6 below */}
</CustomFieldRow>

// "Edit" is plain text, NOT a Button component — color #6B7280, 14pt, 44×44pt hit area
// value=null → render em-dash "—" in #6B7280
```

### CustomFieldGroup component spec

```tsx
<CustomFieldGroup label="ENGAGEMENT">
  <GroupLabel>
    {/* ALL CAPS, 11pt, #6B7280, w600, pl=16, mt=16, mb=8 */}
  </GroupLabel>
  {children}
</CustomFieldGroup>
```

### Data touched

| Component | Entity / fields |
|---|---|
| ENGAGEMENT rows | `crm_people` computed fields: lead_score, seller_score, lead_tier, engagement_streak_days, last_active_date; `crm_timeline` aggregates: listings_viewed, listings_saved, cma_downloads |
| BUYER rows | `crm_field_definitions` WHERE group='BUYER' → `crm_people.custom_fields` jsonb |
| SELLER rows | `crm_field_definitions` WHERE group='SELLER' → `crm_people.custom_fields` jsonb |

### Acceptance criteria

1. ENGAGEMENT group fields are read-only — no "Edit" button renders.
2. BUYER + SELLER group fields all show "Edit" text tap-target.
3. Tapping "Edit" opens an inline editor or bottom sheet (input or picker per field type).
4. Empty values render as em-dash `—` (not blank, not "null").
5. The 4 pt left-border on the content container renders at x≈46 pt.
6. Scroll past the SELLER group header reveals all seller-specific fields.
7. People tab is active (navy `#102742`), all other tabs are `#9CA3AF`.

---

## Screen 4 — Contact Detail: Subscriptions + Relationships (scrolled mid-page)

**[OBSERVED — mob-47]**

### How to reach
Bottom tab → People → tap any contact → scroll down past contact info / timeline to Automation card and Relationships card.

### Screen regions (390×844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 | `#FFFFFF` |
| Safari address bar | 44–88 | 44 | `#FFFFFF`, gray pill |
| App nav/header bar | 88–144 | 56 | `#FFFFFF`, bottom `#E5E7EB` |
| Scrollable content | 144–760 | 616 | `#F2F2F7` page bg |
| FAB | ~680–748 (right edge) | 68 dia | blue `#3B82F6` floating |
| Bottom tab bar | 760–844 | 84 | `#FFFFFF`, top `#E5E7EB` |

### Nav header (y 88–144)

| Slot | Element | Color |
|---|---|---|
| Left | Hamburger ≡, 20×14 pt | `#6B7280` |
| Center | Wordmark lockup, ~140×36 pt | navy `#102742` |
| Right-1 | Search in rounded-rect chip, 36×36 | icon `#6B7280`, bg `#F3F4F6` |
| Right-2 | "M" avatar pill, 32 pt circle | bg `#102742` navy, text `#FFFFFF` |

### Bottom tab bar

5 tabs, tab height 84 pt. People = ACTIVE `#102742` navy filled icon + bold label. Others: `#9CA3AF`. FAB: `#3B82F6` blue 56 pt above tab bar.

### Content (scrolled mid-page, y 144–760)

**Card 1 — Automation / Subscriptions** (top scrolled off; partially visible at top)

White card `#FFFFFF`, 16 pt radius, 16 pt margins, 1 px border `#E5E7EB`.

Visible rows:

| Element | Label | Value |
|---|---|---|
| Toggle row (52 pt) | "Seller Lead — Master Workflow" | OFF — `#D1D5DB` track |
| Section sub-header | "NEWSLETTER & ALERTS" | 11 pt w600 `#6B7280` all-caps |
| Toggle row (60 pt) | "Newsletter" / sub: "Not subscribed" | OFF |
| Toggle row (60 pt) | "Listing alerts" / sub: "0 saved searches" | OFF |

Bottom 24 pt padding, then card ends.

~16 pt gap (`#F2F2F7` shows through).

**Card 2 — Relationships** (full card visible)

White card `#FFFFFF`, 16 pt radius, 16 pt margins, px 16 pt, py 20 pt.

Elements in order:

- Section title: "Relationships" — 22 pt w700 `#111827`, pt 20, pl 16
- Empty state text: "No linked contacts yet. Link a spouse, co-buyer, or referrer below." — 15 pt w400 `#6B7280`, pt 12, px 16, line-height 22 pt
- Divider: 1 px `#E5E7EB`, full card width, mb 16
- Sub-section header: "LINK A CONTACT" — all-caps 11 pt w600 `#6B7280`, pt 16, pl 16
- Field label "Relationship" — 13 pt `#6B7280`, pt 8, pl 16
- Select input: value "Spouse", border 1 px `#D1D5DB`, radius 10 pt, height 48 pt, mx 16; right icon ⬡ up-down chevron `#6B7280` 18 pt; options [INFERRED]: Spouse, Co-buyer, Referrer, Other
- Field label "Related contact id" — 13 pt `#6B7280`, pt 12, pl 16
- Text input: value "0", border 1 px `#D1D5DB`, radius 10 pt, height 48 pt, mx 16; inputMode: numeric
- "Link" button: bg `#1C1C1C` near-black, text "Link" 16 pt w600 white, radius 10 pt, height 52 pt, mx 16, full width
- Help text: "Use the related contact's id (the number in their profile url). The reverse link is created on both records automatically." — 12 pt w400 `#9CA3AF`, pt 8, px 16, pb 20

Below Relationships card: top edge of another card (~24 pt visible, additional section below).

### Component tree

```tsx
<MobileShell bg="#F2F2F7">
  <SafariAddressBar url="ryan-realty.com" />

  <TopBar bg="#FFFFFF" borderBottom="1px solid #E5E7EB" height={56}>
    <HamburgerButton color="#6B7280" />
    <BrandLogo src="/design_system/ryan-realty/assets/brand/logo-blue.png" width={140} />
    <SearchButton bg="#F3F4F6" icon="#6B7280" size={36} rounded />
    <AvatarPill initials="M" bg="#102742" color="#FFFFFF" size={32} />
  </TopBar>

  <ScrollView flex={1} px={16} py={12} gap={12}>

    {/* Card 1: Automation + Subscriptions (partially scrolled into view) */}
    <Card bg="#FFFFFF" radius={16} border="1px solid #E5E7EB">
      <ToggleRow
        label="Seller Lead — Master Workflow"
        value={contact.sellerWorkflowEnrolled}
        onChange={(v) => patchContact(contactId, { sellerWorkflow: v })}
        height={52} px={16}
        trackOff="#D1D5DB" trackOn="#102742"
      />
      <SectionSubHeader label="NEWSLETTER & ALERTS" px={16} pt={8} pb={4}
        color="#6B7280" size={11} caps />
      <ToggleRow
        label="Newsletter" subtitle={contact.newsletterSubscribed ? "Subscribed" : "Not subscribed"}
        value={contact.newsletterSubscribed}
        onChange={(v) => patchContact(contactId, { newsletterSubscribed: v })}
        height={60} px={16} dividerBottom="1px solid #E5E7EB"
      />
      <ToggleRow
        label="Listing alerts" subtitle={`${contact.savedSearchCount} saved searches`}
        value={contact.listingAlertsEnabled}
        onChange={(v) => patchContact(contactId, { listingAlertsEnabled: v })}
        height={60} px={16}
      />
    </Card>

    {/* Card 2: Relationships */}
    <Card bg="#FFFFFF" radius={16} px={16} py={20} border="1px solid #E5E7EB">
      <SectionTitle text="Relationships" size={22} weight={700} color="#111827" mb={8} />
      {relationships.length === 0 ? (
        <EmptyStateText color="#6B7280" size={15} lineHeight={22}>
          No linked contacts yet. Link a spouse, co-buyer, or referrer below.
        </EmptyStateText>
      ) : (
        <RelationshipList relationships={relationships} onRemove={removeRelationship} />
      )}
      <Divider color="#E5E7EB" my={16} />
      <SectionSubHeader label="LINK A CONTACT" caps size={11} color="#6B7280" mb={12} />
      <FieldLabel text="Relationship" size={13} color="#6B7280" mb={4} />
      <Select
        value={relationship} onChange={setRelationship}
        options={["Spouse", "Co-buyer", "Referrer", "Other"]}
        height={48} border="1px solid #D1D5DB" radius={10} mb={12}
        rightIcon={<UpDownChevron size={18} color="#6B7280" />}
      />
      <FieldLabel text="Related contact id" size={13} color="#6B7280" mb={4} />
      <Input
        value={relatedId} onChange={setRelatedId}
        inputMode="numeric" height={48}
        border="1px solid #D1D5DB" radius={10} mb={16}
        fontSize={16} color="#111827"
      />
      <Button
        onPress={linkContact} label="Link" bg="#1C1C1C" color="#FFFFFF"
        height={52} radius={10} fullWidth mb={10}
        fontSize={16} fontWeight={600}
      />
      <HelpText color="#9CA3AF" size={12} lineHeight={18}>
        Use the related contact's id (the number in their profile url).
        The reverse link is created on both records automatically.
      </HelpText>
    </Card>

  </ScrollView>

  <FAB icon="plus" bg="#3B82F6" color="#FFFFFF" size={56}
    position="absolute" bottom={96} right={16} onPress={openNewContactSheet} />

  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E7EB" height={84}
    activeColor="#102742" inactiveColor="#9CA3AF"
    tabs={[
      { id:"home",icon:HomeIcon },{ id:"inbox",icon:InboxIcon },
      { id:"people",icon:PeopleIcon,active:true },
      { id:"deals",icon:StackIcon },{ id:"activity",icon:ActivityIcon },
    ]}
  />
</MobileShell>
```

### Data touched

| Component | Entity / fields |
|---|---|
| Newsletter toggle | `crm_report_subscriptions` WHERE person_id=id AND type='newsletter' |
| Listing alerts toggle | `crm_people.listing_alerts_enabled`; saved search count from `crm_saved_searches` |
| Relationships card | `crm_relationships` WHERE (person_id=id OR related_person_id=id) |
| Link button | POST `/api/crm/contacts/${id}/relationships` `{ type, relatedId }` |
| Reverse link | auto-created by the API on the related contact |

### Acceptance criteria

1. Toggle ON state uses `#102742` navy track (not iOS green `#34C759`).
2. Newsletter subtitle updates to "Subscribed" / "Not subscribed" dynamically.
3. Listing alerts subtitle shows live saved search count.
4. Relationships empty state: exact text "No linked contacts yet. Link a spouse, co-buyer, or referrer below."
5. When relationships exist, each renders as a `<RelationshipRow>` with avatar, name, relationship type chip, and remove (×) button above the divider.
6. "Link" button POST creates a bidirectional relationship (reverse link on related contact created server-side).
7. Help text renders below "Link" button at 12 pt `#9CA3AF`.
8. Bottom tab bar height 84 pt (includes iOS home-indicator safe area).

---

## Screen 5 — Contact Detail: Comms Tab — Email Compose (first capture)

**[OBSERVED — mob-48]**

### How to reach
Bottom tab → People → tap contact → sub-tab "Comms" (active by default) → "Send a message" compose card is the default Comms view.

### Screen regions (390×844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | `#FFFFFF` |
| Safari URL bar | 54–94 | 40 | `#F2F2F7` |
| App nav/header bar | 94–142 | 48 | `#F8F8F8` near-white |
| Contact identity header (dark band) | 142–205 | 63 | `#1A1A1A` near-black |
| Sub-tab strip | 205–242 | 37 | `#1A1A1A` |
| Scrollable content | 242–736 | 494 | `#F5F5F5` |
| Bottom tab bar | 736–800 | 64 | `#FFFFFF` |
| Safari chrome | 800–844 | 44 | `#F2F2F7` |

### Nav header (y 94–142, height 48 pt)

Left: hamburger gray. Center: Ryan Realty wordmark Amboqia `#102742` 22 pt + "BEND·OREGON" 9 pt. Right: search (white rounded-square 32×32 pt) + "M" avatar circle 32 pt `#E8E8E8` bg.

### Contact identity header (y 142–205, height 63 pt, bg `#1A1A1A`)

| Element | Spec |
|---|---|
| Avatar | 56 pt circle, bg `#555555` dark gray, white "M" 22 pt bold |
| Name | "Matthew Ryan" — white, 20 pt w700 |
| Meta | "Owner · Matt Ryan · Last contact …" — gray `#9E9E9E`, 12 pt, truncated |
| Lead pill | white bg, 8 pt filled circle `#1C6EF3` blue + "Lead" text `#1C6EF3` 13 pt w500, pill height 28 pt |

### Sub-tab strip (y 205–242, height 37 pt, bg `#1A1A1A`)

Horizontally scrollable. Active = white text + 3 pt blue underline `#007AFF`. Inactive = gray `#9E9E9E` 13 pt.

| # | Label | State |
|---|---|---|
| 1 | Info | inactive |
| 2 | **Comms** | **ACTIVE** — white, blue underline `#007AFF` |
| 3 | Tasks | inactive |
| 4 | Homes | inactive |
| 5 | Workflow | inactive |
| 6 | Activi… (Activity) | inactive, clipped |

### Email Compose card (y ~260–736+, bg `#FFFFFF`, radius 12 pt, mx 12 pt)

| Element | Value | Style |
|---|---|---|
| Card title | "Send a message" | `#1A1A1A`, 18 pt w600, pt 16 inside card |
| Channel selector | "EMAIL · MATT@RYAN-REALTY.COM" | "EMAIL ·" gray `#9E9E9E` 11 pt all-caps; email address same gray + underline (tappable channel picker) |
| Template dropdown | "Blank email" (selected) | full-width, bg `#F5F5F5`, border `#E0E0E0`, radius 8 pt, height 44 pt; right: ⇅ sorter chevron gray 20 pt |
| To: row | "To" label gray `#9E9E9E` 13 pt; value "Matthew Ryan · matt@ryan-realty.com" dark `#1A1A1A` 15 pt w500 | divider 1 pt `#E5E5E5` below |
| Subject input | placeholder "Subject" `#BDBDBD` 15 pt | bg `#F5F5F5`, border `#E0E0E0`, radius 8 pt, height 44 pt |
| Preview row | "Preview, what sends" gray `#9E9E9E` 13 pt · "Edit" button | Edit: bg `#1A1A1A` rounded pill h 32 pt w 64 pt, "Edit" white 13 pt w600 |
| Merge fields header | "MERGE FIELDS — CLICK TO INSERT AT CURSOR" | all-caps gray `#9E9E9E`, 10 pt w500, wide letter-spacing |

**Merge field chips** (by category):

| Category label | Chips |
|---|---|
| "CONTACT" | "First name" |
| "PROPERTY" | "Seller property address" / "Property address" / "Address (short)" (wraps to 2 rows) |
| "CMA" | "CMA link" |

Chip style: outlined pill, 1 pt border `#BDBDBD`, white bg, text `#1A1A1A`, **monospace font** (Courier New / `font-family: monospace`) 12 pt, radius 16 pt, px 10 pt, height 28 pt. Tapping inserts merge tag at cursor in body textarea.

**Message body textarea** (partially visible, below fold):
- Placeholder: "Message. Sends from the signed-in broker's own mailbox." — gray `#BDBDBD` 14 pt
- bg `#F9F9F9`, border `#E0E0E0`, radius 8 pt, minHeight ~120 pt

### Component tree

```tsx
<MobileShell>
  <SafariURLBar url="ryan-realty.com" />

  <TopBar height={48} bg="#F8F8F8">
    <HamburgerButton />
    <RyanRealtyLogo />
    <SearchButton variant="rounded-square" bg="#FFFFFF" size={32} />
    <BrokerAvatarButton initial="M" bg="#E8E8E8" size={32} />
  </TopBar>

  <ContactHeaderBand bg="#1A1A1A" height={63} px={16}>
    <InitialsAvatar name="Matthew Ryan" size={56} bg="#555555" color="#FFFFFF" fontSize={22} />
    <ContactIdentity ml={12}>
      <ContactName color="#FFFFFF" size={20} weight={700}>Matthew Ryan</ContactName>
      <ContactMeta color="#9E9E9E" size={12} truncate>
        Owner · Matt Ryan · Last contact …
      </ContactMeta>
    </ContactIdentity>
    <LeadStagePill dot="#1C6EF3" label="Lead" textColor="#1C6EF3" bg="#FFFFFF" height={28} />
  </ContactHeaderBand>

  <SubTabStrip
    bg="#1A1A1A"
    tabs={["Info", "Comms", "Tasks", "Homes", "Workflow", "Activity"]}
    activeTab="Comms"
    activeColor="#FFFFFF"
    activeUnderline="#007AFF"
    activeUnderlineHeight={3}
    inactiveColor="#9E9E9E"
    fontSize={13}
    height={37}
    scrollable
  />

  <ScrollArea bg="#F5F5F5">
    <Card bg="#FFFFFF" radius={12} mx={12} mt={12} px={16} py={16}
      shadow="0 1px 4px rgba(0,0,0,0.08)">

      <CardTitle size={18} weight={600} color="#1A1A1A" mb={12}>
        Send a message
      </CardTitle>

      <ChannelSelector
        channel="EMAIL"
        address="MATT@RYAN-REALTY.COM"
        channelStyle={{ color:"#9E9E9E", size:11, caps:true }}
        addressStyle={{ color:"#9E9E9E", size:11, caps:true, underline:true }}
        onPress={openChannelPicker}
        mb={12}
      />

      <TemplateSelect
        value="Blank email"
        options={emailTemplates}           // GET /api/crm/email-templates
        onChange={setTemplate}
        bg="#F5F5F5" border="#E0E0E0" radius={8} height={44}
        rightIcon={<SorterChevron size={20} color="#9E9E9E" />}
        mb={12}
      />

      <ToField label="To" labelColor="#9E9E9E" labelSize={13}
        recipient={`${contact.displayName} · ${contact.email}`}
        recipientColor="#1A1A1A" recipientSize={15} recipientWeight={500}
      />
      <Divider color="#E5E5E5" mb={12} />

      <Input placeholder="Subject" value={subject} onChange={setSubject}
        placeholderColor="#BDBDBD" bg="#F5F5F5" border="#E0E0E0"
        radius={8} height={44} fontSize={15} mb={12} />

      <Row justify="space-between" align="center" mb={16}>
        <Text color="#9E9E9E" size={13}>Preview, what sends</Text>
        <Button bg="#1A1A1A" color="#FFFFFF" size="sm"
          radius={20} px={16} height={32} fontSize={13} fontWeight={600}
          onPress={openPreview}>
          Edit
        </Button>
      </Row>

      <MergeFieldsSection>
        <MergeHeader caps size={10} weight={500} color="#9E9E9E" tracking="wide">
          MERGE FIELDS — CLICK TO INSERT AT CURSOR
        </MergeHeader>

        <MergeCategory label="CONTACT" labelColor="#9E9E9E" labelSize={11} caps mt={12}>
          <MergeChip label="First name" token="{{contact.first_name}}"
            onPress={() => insertAtCursor("{{contact.first_name}}")}
            fontFamily="monospace" fontSize={12}
            border="#BDBDBD" bg="#FFFFFF" textColor="#1A1A1A"
            radius={16} px={10} height={28}
          />
        </MergeCategory>

        <MergeCategory label="PROPERTY" labelColor="#9E9E9E" labelSize={11} caps mt={8}>
          <MergeChipRow wrap>
            <MergeChip label="Seller property address" token="{{property.seller_address}}" {...chipProps} />
            <MergeChip label="Property address" token="{{property.address}}" {...chipProps} />
            <MergeChip label="Address (short)" token="{{property.address_short}}" {...chipProps} />
          </MergeChipRow>
        </MergeCategory>

        <MergeCategory label="CMA" labelColor="#9E9E9E" labelSize={11} caps mt={8}>
          <MergeChip label="CMA link" token="{{cma.link}}" {...chipProps} />
        </MergeCategory>
      </MergeFieldsSection>

      <Textarea
        placeholder="Message. Sends from the signed-in broker's own mailbox."
        placeholderColor="#BDBDBD"
        value={body} onChange={setBody}
        ref={bodyRef}
        minHeight={120} bg="#F9F9F9" border="#E0E0E0" radius={8}
        fontSize={14} px={12} py={10} mt={16}
      />

      {/* Send button below fold */}
      <Button fullWidth mt={16} bg="#102742" color="#FFFFFF"
        height={52} radius={10} fontSize={16} fontWeight={600}
        disabled={!subject && !body}
        onPress={sendEmail}>
        Send
      </Button>

    </Card>
  </ScrollArea>

  <Fab bg="#1C6EF3" icon="plus" size={60} position="bottom-right" bottom={80} right={16} />

  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E5E5" height={64}
    activeColor="#102742" inactiveColor="#8E8E93"
    tabs={[
      { id:"home",label:"Home",icon:HomeIcon },
      { id:"inbox",label:"Inbox",icon:InboxIcon },
      { id:"people",label:"People",icon:PeopleIcon,active:true },
      { id:"deals",label:"Deals",icon:DealsIcon },
      { id:"activity",label:"Activity",icon:ActivityIcon },
    ]}
  />
</MobileShell>
```

### Data touched

| Component | Entity / fields |
|---|---|
| ContactHeaderBand | `crm_people`: display_name, email, phone, stage, assigned_broker_name |
| ChannelSelector | `brokers.email` (send-from address) |
| TemplateSelect | `crm_templates` WHERE channel='email' AND is_active=true |
| MergeChip | Static merge-token catalog (CONTACT / PROPERTY / AGENT / CMA categories) |
| Textarea ref | cursor_position tracked for merge-field insertion |
| Send | POST `/api/crm/contacts/${id}/email` `{ templateId, subject, body, from: broker.email }` |

### Implementation notes

1. **Merge chip font is distinctly monospace** — `font-family: monospace` (Courier New or equivalent), not Geist. This distinguishes tokens visually as "code" objects.
2. Merge chips wrap within their category row (PROPERTY has 3 chips that wrap to 2 lines).
3. The "Edit" pill button uses a sorter chevron ⇅ on the template dropdown, not a standard chevron — indicates a step-through / cycle picker style.
4. Sub-tabs are horizontally scrollable; the strip fits 5 visible tabs at 13 pt; "Activity" is clipped at the right edge.
5. The compose card "Send" button is below the fold — not visible in this screenshot but must be present.
6. "Preview, what sends" is a passive label; "Edit" is the CTA — they are side-by-side in a Row, not a combined button.

### Acceptance criteria

1. Dark contact header band (`#1A1A1A`) shows avatar, name, meta (role · broker · last contact), lead stage pill.
2. Sub-tab strip on dark band: 6 tabs, horizontally scrollable, blue underline `#007AFF` 3 pt on active.
3. "Comms" is the default active sub-tab on the Contact Detail.
4. Template dropdown defaults to "Blank email" and loads available templates from `crm_templates`.
5. To: field auto-populates from contact's email address.
6. Tapping any merge chip inserts the token at the textarea cursor position.
7. Merge chip font is **monospace**, NOT Geist.
8. Send button fires POST to `/api/crm/contacts/:id/email` using the broker's Gmail account (DWD, via `lib/crm/gmail.ts`).
9. Channel selector tap opens a sheet to switch between Email and SMS channels.

---

## Screen 6 — Contact Detail: Comms Tab — Email Compose (second capture, with Quick Action Pills)

**[OBSERVED — mob-57]**

> This screen is a second capture of the same Comms tab, showing a different contact ("Lead annaasmith664@...") and revealing a Quick Action Pills row above the compose card not visible in mob-48.

### Differences from Screen 5

| Element | mob-48 (Matthew Ryan) | mob-57 (Lead anna...) |
|---|---|---|
| Time | 7:39 | 4:55 |
| Battery | 16% yellow | 100% charging |
| Contact avatar | 56 pt circle, `#555555`, "M" | 80 pt **rounded-square** (radius 12 pt), `#3A3A3A`, "L" |
| Contact name | "Matthew Ryan" | "Lead annaasmith664@..." (placeholder/email-derived, truncated) |
| Email | "matt@ryan-realty.com" | "annaasmith664@gmail.com" |
| Phone | (not shown) | "123.456.7890" |
| Active underline | `#007AFF` | `#2563EB` |
| App header bg | `#F8F8F8` | `#F2F2F2` |

### Additional element: Quick Action Pill Grid (y ~310–400, NOT in mob-48)

Two rows of 2 pills each (2×2 grid), white bg, gray border `#E0E0E0` 1 pt, rounded-full, height 44 pt, text dark `#1A1A1A` 15 pt medium.

| Row | Left | Right |
|---|---|---|
| 1 | [envelope icon] **Newsletter** | [chain-link icon] **Automations** |
| 2 | [magnifier icon] **Saved searches** | [bar-chart icon] **Market reports** |

Each pill occupies ~50% width minus 10 pt gap (≈(390 - 32 - 10) / 2 = 174 pt each).

Tapping each [INFERRED]: navigates to the corresponding subscription/service management screen for this contact.

### Avatar shape change

The contact avatar in mob-57 is a **rounded-square** (border-radius 12 pt, 80×80 pt) vs mob-48's **circle** (56 pt). This likely reflects a different fallback for contacts with no name (email-only / placeholder names use rounded-square "L" for "Lead").

### Component delta

```tsx
{/* Insert this ABOVE the Send-a-message Card */}
<QuickActionPillGrid cols={2} gap={10} mb={16}>
  <QuickActionPill
    icon={<EnvelopeIcon size={16} />}
    label="Newsletter"
    onTap={() => navigate(`/admin/console/leads/${contactId}/newsletter`)}
    bg="#FFFFFF" border="#E0E0E0" height={44} radius={22}
    fontSize={15} fontWeight={500} color="#1A1A1A"
  />
  <QuickActionPill icon={<AutomationsIcon size={16} />} label="Automations"
    onTap={() => navigate(`/admin/console/leads/${contactId}/automations`)} {...pillProps} />
  <QuickActionPill icon={<SearchIcon size={16} />} label="Saved searches"
    onTap={() => navigate(`/admin/console/leads/${contactId}/searches`)} {...pillProps} />
  <QuickActionPill icon={<BarChartIcon size={16} />} label="Market reports"
    onTap={() => navigate(`/admin/console/leads/${contactId}/reports`)} {...pillProps} />
</QuickActionPillGrid>
```

### Acceptance criteria

1. Quick Action Pill Grid renders 4 pills in a 2×2 layout above the compose card.
2. Each pill has a leading icon at 16 pt and label at 15 pt medium.
3. For contacts with no real name (display name starts with "Lead " or is email-derived), avatar renders as a **rounded-square** (radius 12 pt) not a circle, letter derived from first char of display_name.
4. All other elements match Screen 5 acceptance criteria.

---

## Screen 7 — Contact Detail: SMS Compose + Note + Email Engagement

**[OBSERVED — mob-58]**

### How to reach
Bottom tab → People → tap a contact → scroll down past header/timeline to communication tools band.

### Screen regions (390×844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | `#FFFFFF` |
| Safari address bar | 54–94 | 40 | `#F2F2F7` |
| App nav/header bar | 94–148 | 54 | `#FFFFFF` + thin bottom border |
| Scrollable content | 148–754 | 606 | `#F2F2F7` page bg |
| Bottom tab bar | 754–810 | 56 | `#FFFFFF` + thin top border |
| Safari chrome row | 810–844 | 34 | `#F2F2F7` |

### Nav header (y 94–148)

Left: hamburger ≡ gray. Center: Ryan Realty wordmark `#102742`, Amboqia + "BEND·OREGON". Right: search (32×32 pt, bg `#F5F5F5`, radius 8 pt) + "M" avatar 28 pt circle, navy `#102742` bg, white "M".

### Bottom tab bar (height 56 pt)

5 tabs. People = ACTIVE, icon filled/bold, label bold `#1C1C1E`. Others: gray. Top border 1 pt `#E5E5EA`.

| # | Icon | Label | State |
|---|---|---|---|
| 1 | House outline | Home | inactive gray |
| 2 | Inbox tray | Inbox | inactive gray |
| 3 | Two-person silhouette | **People** | **ACTIVE** `#1C1C1E` bold |
| 4 | Stacked layers | Deals | inactive gray |
| 5 | Heartbeat line | Activity | inactive gray |

Safari chrome row: ← → ⊕ [3] ···

FAB: `#4A90E2` mid-blue, 56 pt circle, white "+", fixed bottom-right x≈330, y≈700.

### Content (y 148–754)

#### Card 1 — SMS Compose + Add a Note (combined white card, radius 12 pt, mx 16 pt, px 16, py 16)

**Section header "TEXT · 123.456.7890"** (y ~160–194)
- "TEXT" — all-caps, gray `#8E8E93`, 11 pt w600, tracking 0.08em
- "·" middot separator
- "123.456.7890" — underlined tappable tel: link, same gray 11 pt

**Template selector** (height 44 pt):
- Value: "Blank sms" — 15 pt regular `#1C1C1E`
- Border 1 pt `#D1D1D6`, radius 8 pt, bg `#FFFFFF`
- Right: ⇅ up-down chevron gray

**Recipient "To" row:**
- "To" label gray 13 pt regular, left
- Recipient pill: **"Lead annaasmith664@gmail.com"** — bg `#1C1C1E` near-black, white text 13 pt medium, radius 20 pt (pill), px 12 pt, py 6 pt

**Message input row** (height 44 pt, bg `#F9F9F9`, border 1 pt `#D1D1D6`, radius 10 pt):
- Left: "+" plus icon 20 pt dark gray (attachment picker)
- Center: placeholder "Text message · SMS" gray `#8E8E93` 15 pt
- Right: send button circle 36 pt, **gray `#8E8E93` bg** (INACTIVE — no text entered yet), white ↑ arrow icon. Turns active (navy/blue) when text is present

**Quiet hours checkbox row:**
- Unchecked square checkbox 18 pt, border 1.5 pt `#D1D1D6`, radius 3 pt
- Label: "Send anyway (quiet hours)" gray `#8E8E93` 13 pt regular

**Horizontal divider** 1 pt `#E5E5EA` (separates SMS form from Note section)

**Section header "ADD A NOTE":**
- All-caps, gray `#8E8E93`, 11 pt w600, tracking 0.08em, top pad 16 pt

**Note textarea** (height 80 pt, border 1 pt `#D1D1D6`, bg `#FFFFFF`, radius 10 pt, px 12, py 10):
- Placeholder: "Logs to the timeline" gray `#8E8E93` 15 pt

**"Save note" button** (right-aligned):
- bg `#1C1C1E`, text "Save note" white 15 pt w500, radius 10 pt, height 40 pt, width 120 pt

**Gap 12 pt between cards**

#### Card 2 — Email Engagement (white card, radius 12 pt, mx 16 pt, px 16, py 16, height ~90 pt)

- Title: "Email engagement" — `#1C1C1E` 17 pt w600, left, top pad 16 pt
- Body: "No email activity recorded yet." — gray `#8E8E93` 15 pt regular — empty state
- No CTA inside card; FAB floats above bottom-right corner

### Component tree

```tsx
<MobileShell bg="#F2F2F7">
  <SafariAddressBar url="ryan-realty.com" />

  <TopBar height={54} bg="#FFFFFF" borderBottom="thin">
    <HamburgerButton onPress={openSideNav} />
    <BrandLogo src="/design_system/ryan-realty/assets/brand/logo-blue.png" height={32} />
    <SearchButton bg="#F5F5F5" radius={8} size={32} />
    <UserAvatar initial="M" bg="#102742" color="#FFFFFF" size={28} />
  </TopBar>

  <ScrollView flex={1}>
    {/* ... contact header + timeline above (scrolled off) ... */}

    {/* Card 1: SMS Compose + Note */}
    <Card bg="#FFFFFF" radius={12} mx={16} mb={12} px={16} py={16}>

      <SectionLabel caps size={11} weight={600} color="#8E8E93" tracking={0.08}>
        TEXT · <PhoneLink href={`tel:${contact.phone}`}>{contact.phoneFormatted}</PhoneLink>
      </SectionLabel>

      <TemplatePicker
        value={smsTemplate} onChange={setSmsTemplate}
        options={smsTemplates}                // GET /api/crm/sms-templates
        bg="#FFFFFF" border="1px solid #D1D1D6" radius={8} height={44} mt={8}
        rightIcon={<SorterChevron gray />}
      />

      <RecipientRow mt={12} align="center">
        <RecipientLabel color="#8E8E93" size={13} mr={8}>To</RecipientLabel>
        <RecipientPill bg="#1C1C1E" color="#FFFFFF" radius={20} px={12} py={6} size={13} weight={500}>
          {contact.name ?? contact.email}
        </RecipientPill>
      </RecipientRow>

      <MessageInputRow
        mt={12} bg="#F9F9F9" border="1px solid #D1D1D6" radius={10} height={44}
        px={8} align="center"
      >
        <AttachButton icon="plus" size={20} color="#3C3C43" onPress={openAttachPicker} />
        <TextInput
          flex={1} value={smsBody} onChange={setSmsBody}
          placeholder="Text message · SMS" placeholderColor="#8E8E93" size={15}
        />
        <SendButton
          size={36} radius={18}
          bg={smsBody.length > 0 ? "#102742" : "#8E8E93"}
          icon="arrow-up" iconColor="#FFFFFF"
          disabled={smsBody.length === 0}
          onPress={sendSms}
        />
      </MessageInputRow>

      <CheckboxRow mt={8} align="center" gap={8}>
        <Checkbox
          checked={overrideQuietHours} onChange={setOverrideQuietHours}
          size={18} border="1.5px solid #D1D1D6" radius={3}
        />
        <CheckboxLabel color="#8E8E93" size={13}>Send anyway (quiet hours)</CheckboxLabel>
      </CheckboxRow>

      <Divider color="#E5E5EA" mt={16} mb={0} />

      <SectionLabel caps size={11} weight={600} color="#8E8E93" tracking={0.08} pt={16}>
        ADD A NOTE
      </SectionLabel>

      <Textarea
        value={noteText} onChange={setNoteText}
        placeholder="Logs to the timeline" placeholderColor="#8E8E93"
        minHeight={80} border="1px solid #D1D1D6" bg="#FFFFFF"
        radius={10} px={12} py={10} fontSize={15} mt={8}
      />

      <Row justifyContent="flex-end" mt={12}>
        <Button
          onPress={saveNote}
          bg="#1C1C1E" color="#FFFFFF" radius={10}
          width={120} height={40} fontSize={15} fontWeight={500}
        >
          Save note
        </Button>
      </Row>

    </Card>

    {/* Card 2: Email Engagement */}
    <Card bg="#FFFFFF" radius={12} mx={16} mb={12} px={16} py={16} minHeight={90}>
      <CardTitle fontSize={17} fontWeight={600} color="#1C1C1E" mb={4}>
        Email engagement
      </CardTitle>
      {emailEvents.length === 0 ? (
        <EmptyText color="#8E8E93" fontSize={15}>No email activity recorded yet.</EmptyText>
      ) : (
        <EmailEngagementList events={emailEvents} />
      )}
    </Card>

  </ScrollView>

  <Fab bg="#4A90E2" icon="plus" iconColor="#FFFFFF" size={56}
    position="fixed" bottom={70} right={16} zIndex={100}
    onPress={openQuickComposeSheet}
  />

  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E5EA" height={56}
    activeColor="#1C1C1E" inactiveColor="#8E8E93"
    tabs={[
      { id:"home",icon:HomeIcon },{ id:"inbox",icon:InboxIcon },
      { id:"people",icon:PeopleIcon,active:true },
      { id:"deals",icon:StackIcon },{ id:"activity",icon:ActivityIcon },
    ]}
  />
</MobileShell>
```

### Data touched

| Component | Entity / fields |
|---|---|
| PhoneLink | `crm_people.phone` |
| SMS templates | `crm_templates` WHERE channel='sms' AND is_active=true |
| Recipient pill | `crm_people.display_name` or `email` fallback |
| sendSms | POST `/api/crm/contacts/:id/sms` `{ templateId, body, overrideQuietHours }` — writes sms_out to `crm_timeline` |
| saveNote | POST `/api/crm/contacts/:id/notes` `{ body: noteText }` — writes note to `crm_timeline` |
| Email engagement | `email_events` WHERE person_id=id, empty state when no rows |
| FAB | Opens `<QuickComposeSheet>` with options: Send email / Send text / Add note / Log call |

### Acceptance criteria

1. SMS template picker defaults to "Blank sms"; loads templates from `crm_templates` channel='sms'.
2. Recipient pill renders the contact's display_name (or email if name is placeholder), black bg `#1C1C1E`, white text.
3. Send button is **gray `#8E8E93`** (disabled) when no message text. Turns **navy `#102742`** and enabled when text ≥ 1 char.
4. "Send anyway (quiet hours)" checkbox unchecked by default; when checked, the `overrideQuietHours: true` flag is sent.
5. Note textarea placeholder "Logs to the timeline". "Save note" saves to `crm_timeline` kind='note'.
6. Email engagement card shows "No email activity recorded yet." empty state when `email_events` is empty.
7. When email events exist, they render as engagement rows (open / click / bounce per event).
8. FAB is `#4A90E2` (not brand navy) and opens a QuickCompose bottom sheet.
9. Bottom tab bar height 56 pt (shorter than other screens — inconsistency to normalize).

---

## Inferred Screens (no screenshot captured)

The following Contact Detail sub-tabs are referenced in the sub-tab strip (mob-48, mob-57) but have no separate mobile screenshot. They are [INFERRED] from the desktop spec (§21 `21-gap-map-vs-inhouse-crm.md` §3, Person Detail section) and the component imports documented there.

### Contact Detail: "Info" sub-tab

**[INFERRED — BASIS: desktop §21 §3 "Person Detail" + standard CRM pattern]**

- Full identity sidebar content: name (editable inline), stage pill, source badge, broker assignment, tags (add/remove), background notes textarea
- Lead source, assigned broker (dropdown), stage change (dropdown)
- Contact info: email, phone (editable inline rows with "Edit" tap targets matching mob-46 style)
- The "Info" tab is the first sub-tab — likely the default landing when navigating to a new contact, before the user taps "Comms"

### Contact Detail: "Tasks" sub-tab

**[INFERRED — BASIS: desktop §21 §5 "Tasks" + `crm_tasks` table]**

- Task list for this contact (today / overdue / upcoming grouped)
- Add task via inline form or FAB
- Complete/snooze per task row (swipe-left action or row button)

### Contact Detail: "Homes" sub-tab

**[INFERRED — BASIS: desktop §21 §3 `OwnedHomeCard`, `ViewedHomeCard`, `ContactListingAlertsPanel`]**

- Owned home match card
- Viewed listings (recently viewed properties, from `crm_timeline` web_event rows with listing context)
- Listing alerts panel (saved searches with area + price range)

### Contact Detail: "Workflow" sub-tab

**[INFERRED — BASIS: desktop §21 §9 sequence enrollments + mob-45 which shows the Memberships/Workflows panel on a separate scroll level]**

- Active sequence enrollment(s): name, step index (e.g. "Step 2 of 6"), next_run_at, status (running/paused/completed)
- Enrollment history
- Enroll / unenroll button
- Automation rule triggers that apply to this contact

### Contact Detail: "Activity" sub-tab

**[INFERRED — BASIS: desktop §21 §3 `getContactActivityFeed.ts`]**

- Chronological activity feed for this contact from `crm_timeline`
- Kinds: email_in, email_out, sms_in, sms_out, call, voicemail, note, stage_change, web_event, system
- Each row: kind icon + description + timestamp
- Infinite scroll or paginated

---

## Color + Design System Token Map

The in-house mobile web CRM uses a hybrid color system. The Ryan Realty brand navy (`#102742`) appears in the wordmark and as the active tab indicator in the People context. Interactive CRM elements (FAB, active underlines, lead badges) use blue variants (`#2F6FED`, `#2563EB`, `#1C6EF3`, `#4A90E2`) — intentionally distinct from brand navy to signal "action" vs "brand". The target rebuild should rationalize this to the Ryan Realty design system tokens while preserving the IAs and layout patterns.

| Current in-house hex | Usage | RR Design System token to use |
|---|---|---|
| `#102742` | Wordmark, active tab People, avatar "M" bg (mob-47) | `--rr-navy` / `bg-primary` |
| `#2F6FED` | FAB (mob-44), avatar color (Andy Christensen) | `bg-primary` (rationalize FAB to navy) |
| `#2563EB` | FAB (mob-45, mob-46, mob-47, mob-57), active underline (mob-57) | `bg-primary` |
| `#1C6EF3` | FAB (mob-48), Lead pill dot + text | `bg-primary` |
| `#4A90E2` | FAB (mob-58) | `bg-primary` |
| `#007AFF` | Active underline (mob-48) | `border-primary` |
| `#1C1C1E` | Active tab Home, section headers dark, recipient pill bg | `text-foreground` / `bg-foreground` |
| `#F5F5F5` | Page bg (mob-44, mob-48) | `bg-background` |
| `#F2F2F7` | Page bg (mob-47, mob-58) | `bg-background` |
| `#FFFFFF` | Card bg, tab bar bg | `bg-card` |
| `#8E8E93` | Inactive tabs, secondary text | `text-muted-foreground` |
| `#9CA3AF` | Inactive tabs (mob-46, mob-47), field labels | `text-muted-foreground` |
| `#6B7280` | Field labels, group headers (mob-46, mob-47) | `text-muted-foreground` |
| `#E5E5EA` | Dividers (mob-44, mob-58) | `border-border` |
| `#E5E7EB` | Dividers (mob-46, mob-47) | `border-border` |
| `#D1D5DB` | Toggle OFF track, input borders (mob-47) | `border-input` |
| `#D1D1D6` | Input borders (mob-45, mob-58) | `border-input` |
| `#22C55E` | Empty-state checkmark (mob-44) | `text-success` |
| `#E9E9EA` | Toggle OFF track (mob-45) | `border-input` |
| `#F9F9F9` | Message input / textarea bg (mob-58) | `bg-muted` |

**Bottom tab bar height inconsistency across screens:**
- mob-44: 64 pt
- mob-45: 70 pt
- mob-46, mob-48, mob-57: 64 pt
- mob-47: 84 pt (includes iOS home-indicator)
- mob-58: 56 pt

**Target:** normalize to 64 pt content + iOS safe area inset handled by `env(safe-area-inset-bottom)` CSS variable.

---

## Gap Table: In-House Mobile Web (current) vs FUB Mobile (target)

| Surface / Feature | In-House Mobile Web (current) | FUB iOS App (target) | Status | Build Action |
|---|---|---|---|---|
| **Bottom tab bar** | 5 tabs: Home / Inbox / People / Deals / Activity. Height inconsistent (56–84 pt across screens). Active state uses `#1C1C1E` near-black on Home, `#102742` navy on People. FAB bg varies (`#2F6FED`, `#2563EB`, `#1C6EF3`, `#4A90E2`). | 5 tabs matching labels. Consistent 49 pt iOS tab bar. FAB consistent blue. | 🟡 Partial | Normalize tab bar to 64 pt + `env(safe-area-inset-bottom)`. Normalize FAB to single color (`bg-primary` navy `#102742`). Active state: consistent navy across all tabs. |
| **Home Dashboard** | Greeting + "Just me / Everyone" scope toggle. Sub-tabs: New Leads / Emails / Website (box-outline active indicator). Contact rows (avatar + name + activity + age). "Needs your action" dark card. | Greeting + scope toggle. Sub-tabs: New Leads / Emails / Website (underline active indicator). Contact rows with chevron (›). Action required with task count badge. | 🟡 Partial | Replace box-outline active indicator with 2–3 pt underline per FUB spec. Add right chevron (›) to contact rows. Add task count badge to "Needs your action" header. Ensure pull-to-refresh wired. |
| **Activity feed sub-tabs** | 3 sub-tabs: New Leads · Emails · Website | 3 sub-tabs: New Leads · Emails · Website | ✅ Match | None |
| **Contact row anatomy** | Avatar (circle, deterministic color) + Name + "Viewed the site" activity + age badge. No chevron. No swipe actions observed. | Avatar + Name + last activity text + ago badge + right chevron (›). Left-swipe reveals: Call / Text / Email quick actions. | 🟡 Partial | Add right chevron (›) to all contact rows. Wire left-swipe to reveal Call / Text / Email quick-action buttons. |
| **Contact Detail dark header band** | Name + meta ("Owner · Matt Ryan · Last contact …") + lead stage pill on `#1A1A1A` band. Avatar: circle (named contacts) or rounded-square (email-only contacts). | Name + source + assigned agent + lead stage chip + call/text/email quick-action icons on the header band. | 🟡 Partial | Add direct call / text / email icon buttons to the contact header band (next to the lead stage pill). Replace meta truncation with scrollable overflow or multi-line. |
| **Sub-tab strip** | 6 tabs (Info / Comms / Tasks / Homes / Workflow / Activity), horizontally scrollable on dark band, blue underline active (2–3 pt `#007AFF` or `#2563EB`). | 6 tabs (Info / Activity / Tasks / Homes / Action Plans / Files). Active = white underline 2 pt. Tab order differs. | 🟡 Partial | Align tab labels + order to match FUB: Info / Activity / Tasks / Homes / Action Plans / Files. Rename "Workflow" → "Action Plans". Add "Files" tab. Normalize underline to 2 pt white on dark band. |
| **Comms tab — Email compose** | "Send a message" card: channel selector (EMAIL · address), template dropdown, To field, Subject, Preview/"Edit" row, merge chips by category (CONTACT / PROPERTY / CMA), body textarea. Merge chips: monospace font, outlined pill. | Compose sheet / modal: To, Subject, body, template, merge field picker ("+ Merge Field" button → token picker modal). No inline merge chip grid. | 🟡 Partial | Merge chip UX matches neither pattern well — consider adding a "+ Merge Field" button (per FUB) as an alternative to the inline chip grid. Both approaches are acceptable; the current chip grid is more discoverable on mobile. |
| **Quick Action Pills (mob-57)** | 4 pills: Newsletter / Automations / Saved searches / Market reports. 2×2 grid above compose card. | FUB has no equivalent pill grid; these actions are accessed via the right-rail or sub-tabs. | ✅ In-house advantage | Keep the Quick Action Pills — they are a better mobile UX than FUB's buried right-rail. |
| **SMS compose** | Template picker + recipient pill + message input with attachment (+) and send button (gray→active). "Send anyway (quiet hours)" checkbox. Section label "TEXT · {phone}". | SMS compose: recipient, template, message field, send button. No quiet-hours checkbox visible in FUB (handled server-side). | 🟡 Partial | Add media/attachment support for MMS (wire the "+" icon to a file picker). Ensure send button activation on text entry (gray→`#102742`). |
| **Add a Note** | Single textarea ("Logs to the timeline"), "Save note" button (right-aligned). Section label "ADD A NOTE". | Note input with type selector (call / SMS / note / appointment). Broader note types. | 🔴 Missing note types | Add note "type" selector (call log / note / SMS / appointment) above the textarea to match FUB's note-type classification. |
| **Email engagement card** | Title "Email engagement" + empty state "No email activity recorded yet." | FUB shows: sent count / opened count / clicked count / unsubscribed — summary stats + timeline of email events. | 🟡 Partial | When `email_events` exist, render opens / clicks / bounces as a stats row + chronological event list (not just "No activity" empty state). |
| **Memberships / Workflows** | Toggle rows for 4 workflows (Buyer Lead / Expired Recovery / FSBO Recovery / Seller Lead). Newsletter + Listing alerts toggle rows. Section grouped by all-caps headers. | FUB shows Action Plans (not called Workflows). Toggle ON/OFF per plan. Shows step progress "1 of 6 complete". | 🟡 Partial | Add step progress display to enrolled workflows (pull from `crm_sequence_enrollments.step_index`). Rename section "Action Plans" to match FUB terminology. |
| **Custom Fields** | 3 groups: ENGAGEMENT (8 read-only) / BUYER (8 editable) / SELLER (below fold). "Edit" plain-text tap-target per editable field. | FUB custom fields: inline edit on tap (no separate "Edit" tap-target — field itself becomes editable). | 🟡 Partial | Replace "Edit" text tap-target with tap-to-edit directly on the field row (tap the row → input appears inline). Matches FUB pattern. |
| **Relationships panel** | "No linked contacts yet" empty state + "LINK A CONTACT" sub-form with Relationship select + Related contact id numeric input + "Link" button. Help text explains ID lookup. | FUB: relationships shown as contact cards (avatar + name + relationship type). Link via contact search (not by raw ID). | 🔴 Missing search UX | Replace raw "Related contact id" numeric input with a contact search picker (type name → autocomplete → tap to link). The current ID-input UX is developer-oriented, not broker-oriented. |
| **Search** | Search icon in top-right nav opens overlay (behavior inferred). | FUB: dedicated Search tab or modal — search by name, email, phone, address. Instant results. | [INFERRED] 🟡 | Verify search overlay wired and returns instant results. Consider adding search to bottom tab bar (replacing Activity if needed) per FUB IA. |
| **People list (mobile)** | Not captured (mob-44–58 focus on other screens). | FUB: contacts list with filter chips (Stage / Tag / Agent), sort control, infinite scroll, swipe-to-quick-action. | 🟡 Partial (INFERRED) | People list mobile layout needs: stage/tag/agent filter chips below top bar, infinite scroll (not paginated), left-swipe quick actions. See desktop §21 §1. |
| **Inbox (mobile)** | Not captured. | FUB: conversation list with unread badges, thread reader, inline reply. | [INFERRED] 🟡 | See desktop §21 §4 for inbox gap. Mobile: thread-based layout (conversation list → single thread), inline reply with keyboard-avoidance. |
| **Deals (mobile)** | Not captured. | FUB: pipeline Kanban columns, swipeable cards, drag-to-stage (native app). | [INFERRED] 🟡 | Mobile Kanban: horizontal scroll through pipeline stages (swipe left/right). Drag-to-restage on long-press. See desktop §21 §7. |
| **Notifications / push** | SMS alerts only (new leads → Twilio SMS to broker cell). No web push, no in-app notification bell. | FUB: push notifications for new leads, new messages, task reminders. Notification center in app. | 🔴 Missing | Implement web push (service worker + Push API) for new-lead and new-message alerts. Add in-app notification bell to top-right nav with badge count. See desktop §21 §18. |
| **FAB behavior** | FAB present on all screens (blue circle "+"). No sheet content captured. | FUB: FAB opens a quick-add sheet with clearly labeled options (New Lead / New Task / Log Call / New Note). | [INFERRED] 🟡 | Wire FAB to `<QuickComposeSheet>` with 4 options: New Contact, Add Task, Log Call, Compose Message. |
| **Dark contact header** | Avatar shape differs by contact type (circle for named, rounded-square for email-only). | FUB: always circle avatar. Shape is consistent. | 🟡 Minor | Normalize avatar shape to circle for all contacts on mobile. Remove rounded-square variant. |
| **Typography / brand** | Amboqia Boriango in nav wordmark; Geist (system sans) for all body. Active tab color varies by screen context. | FUB (iOS): San Francisco system font throughout. Active tab: FUB blue. | In-house is BETTER — consistent with RR brand system. | Keep Amboqia for wordmark, Geist for body. Normalize active tab to `#102742` navy consistently. |
| **Pull to refresh** | Not confirmed (INFERRED on all scrollable surfaces). | FUB: pull-to-refresh on every list. | [INFERRED] 🟡 | Wire pull-to-refresh on all ScrollViews: Home activity, People list, Contact Detail sub-tabs, Inbox, Deals. |
| **Swipe gestures** | Left-swipe on contact rows: INFERRED (not confirmed). | FUB: left-swipe reveals Call / Text / Email quick actions. Right-swipe: mark read (Inbox). | [INFERRED] 🔴 | Implement left-swipe on people list rows and inbox rows to reveal quick-action buttons. |
| **Offline / loading states** | Not captured. | FUB: skeleton loaders on every list during fetch. | [INFERRED] 🔴 | Add `<Skeleton>` from `@/components/ui/skeleton` on every list while fetching. |

---

## Build Priority for Mobile Gap Closure

Ordered by impact on daily broker mobile use:

1. **FAB unification** — single color (`#102742` or `bg-primary`), single QuickCompose sheet with 4 options. Currently 5 different blue hex values across 7 screens.
2. **Bottom tab bar normalization** — 64 pt height, `env(safe-area-inset-bottom)`, consistent active color `#102742` navy, consistent inactive `#8E8E93`.
3. **Swipe-to-quick-action on contact rows** — Call / Text / Email (left-swipe) — most-used mobile CRM gesture.
4. **Pull-to-refresh on all ScrollViews** — every list surface.
5. **Relationship panel: contact search picker** — replace raw ID input with autocomplete search.
6. **Active tab indicator normalization** — box-outline → underline (2–3 pt) to match FUB.
7. **Push notifications** — service worker + Push API for new-lead alerts.
8. **Note type selector** — add call log / note / SMS / appointment type above textarea.
9. **Email engagement stats** — render open/click/bounce counts when events exist.
10. **Workflow step progress** — show "Step N of M complete" on enrolled workflows.

---

## Sources

### Observed screens (from actual screenshots)

| Screen | Source file | Module |
|---|---|---|
| Home Dashboard — Website activity tab | `mob-44.md` | Home / Dashboard |
| Contact Detail — Memberships / Workflows (keyboard open) | `mob-45.md` | People → Contact → Memberships |
| Contact Detail — Custom Fields | `mob-46.md` | People → Contact → Custom Fields |
| Contact Detail — Subscriptions + Relationships | `mob-47.md` | People → Contact → scroll |
| Contact Detail — Comms tab — Email compose (Matthew Ryan) | `mob-48.md` | People → Contact → Comms |
| Contact Detail — Comms tab — Email compose (Lead anna...) with Quick Pills | `mob-57.md` | People → Contact → Comms |
| Contact Detail — SMS compose + Note + Email engagement | `mob-58.md` | People → Contact → scroll |

### Inferred screens (reconstructed from desktop spec + component list)

| Screen | Basis |
|---|---|
| Contact Detail "Info" sub-tab | `21-gap-map-vs-inhouse-crm.md` §3 "Person Detail" — ConversationFeed, identity sidebar |
| Contact Detail "Tasks" sub-tab | `21-gap-map-vs-inhouse-crm.md` §5 "Tasks" — `crm_tasks`, `getTaskQueue.ts` |
| Contact Detail "Homes" sub-tab | `21-gap-map-vs-inhouse-crm.md` §3 — `OwnedHomeCard`, `ViewedHomeCard`, `ContactListingAlertsPanel` |
| Contact Detail "Workflow/Action Plans" sub-tab | `21-gap-map-vs-inhouse-crm.md` §9 "Sequences" — `crm_sequence_enrollments` |
| Contact Detail "Activity" sub-tab | `21-gap-map-vs-inhouse-crm.md` §3 — `getContactActivityFeed.ts`, `crm_timeline` |
| People list (mobile) | `21-gap-map-vs-inhouse-crm.md` §1 "People List" — `BulkAssignWrapper`, `ContactsSearch` |
| Inbox (mobile) | `21-gap-map-vs-inhouse-crm.md` §4 "Inbox" — `InboxQueue`, `InboxThread` |
| Deals (mobile) | `21-gap-map-vs-inhouse-crm.md` §7 "Deals" — `DealHeader`, Kanban board |
| FAB QuickCompose sheet | Mobile CRM pattern (standard), not captured |

### Desktop spec sections referenced

- `21-gap-map-vs-inhouse-crm.md` — authoritative gap audit (2026-06-30), all feature areas §1–§18
- Data model context from `04-data-model-and-erd.md` (cross-referenced via entity names)
- Component names from `21-gap-map-vs-inhouse-crm.md` §3 component imports list

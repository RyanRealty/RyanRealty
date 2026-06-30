# Mobile — App Architecture, Navigation & Shell

**Spec version:** 1.0 · **Date:** 2026-06-30  
**Scope:** Foundation specification for building the Ryan Realty in-house CRM as a responsive web app targeting mobile Safari on iPhone (390×844 pt logical canvas, 3× retina). This section defines the complete app shell — screen frame, both tab-bar variants, the reusable bottom-sheet picker pattern, navigation model, gesture map, color/type token mapping, and a full mobile coverage map. All sibling mobile sections (§24–§30) inherit the shell, token mappings, and component primitives defined here. Build each shell primitive once; do not re-implement per-module.

**Build target:** Responsive web (Next.js app-router, served at `ryan-realty.com`). Not a native app. Mobile Safari is the primary runtime. The in-house CRM is accessed via Mobile Safari — the Safari URL bar and Safari chrome toolbar are rendered by the OS and are NOT buildable; only the in-app regions below them are in scope.

---

## Tag convention

Throughout this document:

- **[OBSERVED]** — element or behavior confirmed by a real screenshot (cite: mob-NN).
- **[INFERRED]** — element reconstructed from the FUB iOS reference pattern, the desktop spec (§03), official FUB docs, or standard mobile UX convention. Basis is always cited.

---

## 1. Screen Frame — Physical Layer Stack

All measurements on the 390×844 pt logical canvas (iPhone 14/15 Pro baseline). All layers are drawn top-to-bottom.

```
┌────────────────────────────────────────────────────┐  y=0
│  iOS STATUS BAR                ~54 pt              │  Rendered by iOS — no app markup
│  Time · Signal · WiFi · Battery                    │  App background bleeds up behind it
├────────────────────────────────────────────────────┤  y=54
│  SAFARI URL BAR                ~40–44 pt           │  Rendered by Safari — no app markup
│  (compact address bar, visible on inhouse-web)     │  Disappears on scroll-down (Safari behavior)
├────────────────────────────────────────────────────┤  y=98
│  APP NAV / HEADER BAR          48–64 pt            │  First buildable region
│  [left control] [center title] [right controls]    │
├────────────────────────────────────────────────────┤  y=154–162
│  OPTIONAL CONTACT HERO BAND    63 pt               │  Contact detail screens only
│  (dark band: avatar + name + stage pill)           │
├────────────────────────────────────────────────────┤  y=162–217
│  OPTIONAL SUB-TAB STRIP        37–48 pt            │  Present when module has sub-tabs
│  (horizontal scrollable tabs, active underline)    │
├────────────────────────────────────────────────────┤  y=~217
│                                                    │
│  SCROLLABLE CONTENT AREA       flex-fill           │  Fills remaining vertical space
│  (list rows, cards, calendar, compose forms)       │
│                                                    │
│                                                    │
├────────────────────────────────────────────────────┤  y=760–780
│  BOTTOM TAB BAR                64–82 pt            │  Fixed, always visible on root tabs
│  (5 tabs, equal width, icons + labels)             │  Hidden on pushed detail views
├────────────────────────────────────────────────────┤  y=824–844
│  SAFARI CHROME TOOLBAR         ~44 pt              │  Rendered by Safari — no app markup
│  (Back · Fwd · New Tab · Tab count · More)         │
└────────────────────────────────────────────────────┘  y=844
```

**Note on "safe area":** Modern iPhones have a home indicator zone at the physical bottom. The app bottom tab bar must absorb the safe area inset (`env(safe-area-inset-bottom)`, ~34 pt on Face ID iPhones). The tab bar's total rendered height — including the safe-area padding — is 64–82 pt depending on the screen.

---

## 2. App Nav / Header Bar — Exact Spec

**[OBSERVED in mob-01, mob-02, mob-07, mob-08, mob-09, mob-44, mob-48]**

The header bar is the primary navigation surface. It spans the full app width below the Safari URL bar. Every root-level screen and every pushed detail screen has a header bar.

### 2a. FUB iOS Header (reference implementation)

| Property | Value |
|---|---|
| Height | 56–64 pt (variable; mob-01: 56 pt, mob-07: 64 pt) |
| Background | Dark teal-slate: varies per screen — `#2E4A5C` (mob-01), `#3A4E5F` (mob-02), `#405C70` (mob-07), `#364859` (mob-08), `#2E4D5E` (mob-09) |
| Status bar bleed | Header background extends behind the iOS status bar (no separate status bar band) |
| Text color | `#FFFFFF` white for all text and icons |

**Left control variants:**

| Screen context | Left control | Tap action |
|---|---|---|
| Root tab screens (Activity, Inbox, Calendar, People, Deals) | Circular broker avatar, ~36–44 pt, white 2 pt border ring, real headshot photo | Opens account/profile settings sheet |
| Pushed detail views (Contact Detail, Stage Picker) | Back chevron `<` (18 pt, SF-style) or "Cancel" text button (17 pt) | Pops view / dismisses modal |

**Center control — root tabs:**

| Tab | Center element | Tap action |
|---|---|---|
| Activity | Text "Everyone ▾" (~17 pt, weight 500, white), dropdown chevron | Opens team-member filter picker sheet |
| Inbox | Text "My Inbox ▾" (~18 pt, weight 600, white), dropdown chevron | Opens inbox scope picker (My / Team / All) |
| Calendar | Text "June ^" (~20 pt, weight semibold, white), up-caret | Toggles month/week view or opens month picker |
| People | Text "People" (~17 pt, weight 400, white), NO chevron | Static label; non-interactive |
| Deals | Text "Deals" or pipeline name | Static or picker |

**Right controls (left to right, consistent across all root tabs):**

| Control | Icon | Size | Tap action |
|---|---|---|---|
| Bell (Notifications) | Outline bell glyph | ~24 pt | Pushes Notifications screen; red badge count when unread |
| Search | Outline magnifying glass | ~24 pt | Opens search overlay / pushes search screen |

**Pushed detail view right control:**

| Screen | Right control |
|---|---|
| Contact Detail | Text button "Edit" (white, ~16 pt semibold) |
| Stage Picker | Text button "Select" (white, ~17 pt regular) |

### 2b. In-House Web Header (actual build target)

**[OBSERVED in mob-44 (Home), mob-48 (Contact Comms)]**

| Property | FUB Value | In-house Value | Ryan Realty Token |
|---|---|---|---|
| Background | Dark teal-slate `#2E4A5C`–`#405C70` | White `#FFFFFF` / near-white `#F8F8F8` | `bg-background` |
| Height | 56–64 pt | 48–56 pt | — |
| Status bar bleed | Dark bg extends into status bar | White bleeds into status bar (white on white) | — |
| Text / icon color | White | Navy `#102742` or dark gray `#3C3C43` | `text-primary` |

**In-house left control:**

Hamburger menu (≡, three horizontal lines, ~24×18 pt, dark gray `#3C3C43`). Tap opens side-drawer navigation. **[OBSERVED mob-44, mob-48]**

**In-house center:**

Ryan Realty wordmark — `<img>` asset, Amboqia Boriango typeface, navy `#102742`, reads "Ryan Realty" with "BEND·OREGON" small-caps subtitle below. Centered horizontally. Do NOT re-typeset; use `design_system/ryan-realty/assets/brand/logo-blue.png`. **[OBSERVED mob-44, mob-48]**

**In-house right controls (left to right):**

1. Search icon — magnifying glass inside a rounded-rectangle button (~32×32 pt, 8 px radius, border/shadow), gray stroke.
2. Broker avatar button — circle ~32 pt, light gray bg `#E5E5EA`, letter initial (e.g., "M" for Matt), dark navy text. Tap opens broker account menu.

**Component tree — in-house header:**

```tsx
<TopBar
  className="fixed top-0 inset-x-0 z-40 h-14 bg-background border-b border-border flex items-center px-4"
  style={{ marginTop: 'env(safe-area-inset-top)' }}
>
  <button
    className="p-1 text-muted-foreground"
    onClick={openSideDrawer}
    aria-label="Menu"
  >
    <MenuIcon className="w-6 h-6" />
  </button>

  <div className="flex-1 flex justify-center">
    <img
      src="/brand/logo-blue.png"
      alt="Ryan Realty BEND·OREGON"
      className="h-8 w-auto"
    />
  </div>

  <div className="flex items-center gap-2">
    <button
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card"
      onClick={openSearch}
      aria-label="Search"
    >
      <SearchIcon className="w-4 h-4 text-muted-foreground" />
    </button>
    <Avatar
      className="w-8 h-8 cursor-pointer"
      onClick={openAccountMenu}
    >
      <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
        {brokerInitial}
      </AvatarFallback>
    </Avatar>
  </div>
</TopBar>
```

---

## 3. Contact Hero Band — Contact Detail Screens Only

**[OBSERVED mob-02 (FUB iOS), mob-48 (in-house web)]**

A dark band that extends below the header bar on contact detail screens. Contains the avatar, name, status subtitle (FUB) or title/meta/stage-pill row (in-house).

### 3a. FUB iOS Contact Hero

| Property | Value |
|---|---|
| Height | ~72 pt (continuous with header — no visible break) |
| Background | Same dark slate as header (`#3A4E5F`) |
| Avatar | Circle 56 pt, initials or photo, initials font 20 pt bold white |
| Name | White, 22 pt, weight 600 |
| Subtitle | Gray-white `#A8B8C8`, 14 pt, regular ("No communication yet" when no comms) |
| Position | Avatar left-aligned 16 pt from edge; name + subtitle stacked right of avatar |

### 3b. In-House Contact Hero

| Property | Value |
|---|---|
| Height | ~63 pt |
| Background | Near-black `#1A1A1A` |
| Avatar | Circle 56 pt, dark gray bg `#555555`, initials "M" ~22 pt bold white |
| Name | White, ~20 pt, weight 700 |
| Meta subtitle | Gray `#9E9E9E`, ~12 pt — "Owner · Matt Ryan · Last contact …" (truncated) |
| Stage pill | Right-side pill: white bg, filled blue circle dot `#1C6EF3` + "Lead" text in blue `#1C6EF3`, ~13 pt, weight 500 |

**Component tree — in-house contact hero:**

```tsx
<ContactHeaderBand
  className="bg-[#1A1A1A] px-4 py-3 flex items-center gap-4"
>
  <Avatar className="w-14 h-14 flex-shrink-0">
    {contact.photoUrl ? (
      <AvatarImage src={contact.photoUrl} />
    ) : (
      <AvatarFallback className="bg-[#555555] text-white text-2xl font-bold">
        {contact.initials}
      </AvatarFallback>
    )}
  </Avatar>

  <div className="flex-1 min-w-0">
    <p className="text-white text-xl font-bold truncate">{contact.displayName}</p>
    <p className="text-[#9E9E9E] text-xs truncate mt-0.5">
      {contact.title} · {contact.assignedBroker} · Last contact {contact.lastContactRelative}
    </p>
  </div>

  <Badge
    variant="outline"
    className="bg-white text-[#1C6EF3] border-[#1C6EF3]/20 flex-shrink-0"
  >
    <span className="w-2 h-2 rounded-full bg-[#1C6EF3] mr-1.5" />
    {contact.stage}
  </Badge>
</ContactHeaderBand>
```

---

## 4. Sub-Tab Strip — Module Sub-Navigation

**[OBSERVED mob-01 (Activity sub-tabs), mob-02 (Contact Info/Comms/Homes/Notes/Calen), mob-07 (Inbox sub-tabs), mob-09 (All Lists/Stages), mob-44 (New Leads/Emails/Website), mob-48 (Info/Comms/Tasks/Homes/Workflow/Activity)]**

Sub-tab strips appear directly below the header/hero band. Two distinct visual treatments exist: the FUB iOS style (dark bg, colored underline indicator) and the in-house web style (light bg OR dark band, underline or box-outline indicator).

### 4a. FUB iOS Sub-Tab Strip (reference)

| Property | Value |
|---|---|
| Height | 40–48 pt |
| Background | Same dark slate as header (continuous, no divider) |
| Tab font | SF Pro, ~14–15 pt |
| Active tab label | White `#FFFFFF`, weight 600 |
| Active indicator | 2–3 pt bottom underline, FUB teal `#4AACED` or `#29B5E8` |
| Inactive tab label | Gray `#8A9DB0` or `#8FA8BB`, weight 400 |
| Scrollable | Yes on Contact Detail (6+ tabs; Calendar is clipped at right edge) |

**Variants observed:**

| Screen | Tabs | Indicator style |
|---|---|---|
| Activity (mob-01) | New Leads · Emails · Website | 3 pt teal `#4AACED` full-width underline |
| Contact Detail (mob-02) | Info · Comms · Homes · Notes · Calen[dar] | 2 pt teal `#29B5E8` underline, scrollable |
| Inbox (mob-07) | Inbox · Assigned · Sent · Closed (as filled pill + filter icon) | Active: filled pill bg `#527082`; segmented control style |
| People (mob-09) | All Lists · Stages | 2 pt near-black `#1A2E3D` underline, light gray bg `#EEF0F2` |

### 4b. In-House Web Sub-Tab Strip

| Screen | Style | Active indicator | Background |
|---|---|---|---|
| Home dashboard (mob-44) | Box-outline around active tab cell | 1.5 pt solid border-box `#1C1C1E`, radius 4 pt | White, 1 pt bottom divider `#E5E5EA` |
| Contact Comms (mob-48) | Underline | 3 pt `#007AFF` (iOS blue) bottom underline | Dark band `#1A1A1A`, continuous with hero |

### 4c. Sub-Tab Component (in-house build)

```tsx
interface SubTabStripProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  variant: 'underline' | 'box-outline';
  bg?: string;               // e.g. '#1A1A1A' for dark hero continuation
  indicatorColor?: string;   // e.g. '#007AFF'
  scrollable?: boolean;
}

// Underline variant (Contact Comms, Activity):
<div
  className="flex overflow-x-auto scrollbar-hide border-b border-border"
  style={{ backgroundColor: bg ?? 'transparent' }}
>
  {tabs.map(tab => (
    <button
      key={tab.key}
      className={cn(
        "flex-shrink-0 px-3 py-2.5 text-[13px] whitespace-nowrap transition-colors",
        tab.key === activeTab
          ? "text-white font-semibold border-b-[3px]"
          : "text-[#9E9E9E] font-normal border-b-[3px] border-transparent"
      )}
      style={tab.key === activeTab ? { borderColor: indicatorColor ?? '#007AFF' } : {}}
      onClick={() => onTabChange(tab.key)}
    >
      {tab.label}
    </button>
  ))}
</div>

// Box-outline variant (Home dashboard activity card):
<div className="flex border-b border-border">
  {tabs.map(tab => (
    <button
      key={tab.key}
      className={cn(
        "flex-1 py-3 text-[14px] font-normal transition-all",
        tab.key === activeTab
          ? "text-foreground font-bold border border-foreground rounded-[4px] mx-1"
          : "text-muted-foreground"
      )}
      onClick={() => onTabChange(tab.key)}
    >
      {tab.label}
    </button>
  ))}
</div>
```

---

## 5. Bottom Tab Bar — Both Variants (Exact Spec)

The single most important navigation element. Defined exhaustively below for **both** the FUB iOS reference and the in-house web implementation.

### 5a. FUB iOS Bottom Tab Bar **[OBSERVED]**

**Sources:** mob-01, mob-07, mob-08, mob-09. Also confirmed by FUB docs (notifications-mobile.md §12: "Navigation tabs (bottom bar): Inbox / Activity / Calendar / People / Deals").

| Property | Value |
|---|---|
| Height | 78–82 pt (includes home-indicator safe area) |
| Background | `#F7F7F7` (mob-01) / `#F4F5F6` (mob-09) / `#FFFFFF` (mob-07, mob-08) — near-white |
| Top border | 1 pt hairline `#D8DADC`–`#E0E0E0` |
| Tab count | 5 equal-width tabs, ~78 pt each |
| Active color | Teal-blue: `#4AACED` (mob-01) / `#00A4BD` (mob-07) / `#29A8E0` (mob-08) / `#2196B5` (mob-09) |
| Inactive color | `#9BA8B0` (mob-01) / `#8E8E93` (mob-07, mob-08) / `#9AA5AE` (mob-09) — blue-gray |
| Icon size | ~24 pt |
| Icon style | Outline/line icons (not filled); active tab icon = same outline but colored teal |
| Label font | SF Pro, ~10 pt, weight 400 |
| Label position | Below icon |

**Tab definitions (left to right):**

| Order | Tab key | Icon glyph | Label | Badge rule |
|---|---|---|---|---|
| 0 | `inbox` | Inbox tray (rectangular tray with envelope/in-tray) — outline | **Inbox** | Red filled circle `#E53935`–`#FF3B30`, white numerals; count = unread conversation count (e.g., "30") |
| 1 | `activity` | Activity sparkline (3-node connected zigzag line trending up) — outline | **Activity** | None |
| 2 | `calendar` | Calendar grid (rectangle with top bar + grid lines inside) — outline; FILLED when active | **Calendar** | None |
| 3 | `people` | Two-person silhouette (head + shoulders, grouped) — outline; FILLED when active | **People** | None |
| 4 | `deals` | Price-tag outline with dollar-sign "$" inside — outline | **Deals** | None |

**Badge spec (Inbox):**

- Shape: filled circle
- Diameter: ~18 pt (mob-01) / ~16 pt (mob-07)
- Background: `#E53935` / `#FF3B30` (iOS system red, slight variant per screen)
- Text: white, ~11 pt, weight 600
- Position: top-right of icon, center overlapping top-right quadrant of the icon bounding box
- Value: integer string of unread conversation count; value "30" confirmed across all screenshots

**Tab bar suppression rule (FUB iOS):** The bottom tab bar is **not rendered** on pushed detail views (Contact Detail — mob-02). It is present only at the root navigation depth of each tab. **[OBSERVED mob-02]**

### 5b. In-House Web Bottom Tab Bar **[OBSERVED mob-44, mob-48]**

**Confirmed at:** `ryan-realty.com` in Mobile Safari.

| Property | Value |
|---|---|
| Height | 64 pt (excluding Safari chrome) |
| Background | `#FFFFFF` |
| Top border | 0.5 pt `#C6C6C8` (iOS system separator gray) |
| Tab count | 5 equal-width tabs, ~78 pt each |
| Active color | Near-black `#1C1C1E` (mob-44) / Navy `#102742` (mob-48) |
| Inactive color | `#8E8E93` (iOS system gray) |
| Icon size | ~24 pt |
| Icon style | Outline on inactive; slightly bolder/filled on active |
| Label font | System sans, ~10 pt, weight 400 (inactive) / 600 (active) |

**In-house tab set (left to right) — DIFFERENT from FUB iOS:**

| Order | Tab key | Icon glyph | Label | Badge rule |
|---|---|---|---|---|
| 0 | `home` | House outline (home glyph) | **Home** | None |
| 1 | `inbox` | Inbox tray / envelope-tray outline | **Inbox** | None visible (mob-44, mob-48); implementation should show badge when unread count > 0 |
| 2 | `people` | Two overlapping person silhouettes | **People** | None |
| 3 | `deals` | Three stacked horizontal layers / cards | **Deals** | None |
| 4 | `activity` | Activity pulse / heartbeat / zigzag waveform | **Activity** | None |

**Key difference from FUB iOS:**

| Axis | FUB iOS | In-House Web |
|---|---|---|
| Tab order | Inbox · Activity · Calendar · People · Deals | Home · Inbox · People · Deals · Activity |
| Deals icon | Price-tag with $ | Stacked layers / cards |
| Calendar tab | Present (tab 2) | **Absent** — Calendar not a top-level tab |
| Home tab | **Absent** | Present (tab 0) |

**Build decision for in-house:** Follow the in-house tab set as observed (mob-44, mob-48). The Calendar surface is accessible via the Home dashboard or from contact detail. **[INFERRED from mob-44 observation; no Calendar tab in in-house screenshots]**

### 5c. Bottom Tab Bar Component (in-house build)

```tsx
const TABS = [
  { key: 'home',     label: 'Home',     icon: HomeIcon,     href: '/crm' },
  { key: 'inbox',    label: 'Inbox',    icon: InboxIcon,    href: '/crm/inbox' },
  { key: 'people',   label: 'People',   icon: PeopleIcon,   href: '/crm/people' },
  { key: 'deals',    label: 'Deals',    icon: StackIcon,    href: '/crm/deals' },
  { key: 'activity', label: 'Activity', icon: ActivityIcon, href: '/crm/activity' },
] as const;

<nav
  className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#C6C6C8]"
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
  <div className="flex h-16">
    {TABS.map(tab => (
      <Link
        key={tab.key}
        href={tab.href}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
          activeTab === tab.key
            ? "text-primary"        // navy #102742
            : "text-[#8E8E93]"
        )}
      >
        <tab.icon
          className={cn(
            "w-6 h-6",
            activeTab === tab.key ? "stroke-[2.5px]" : "stroke-[1.5px]"
          )}
        />
        <span
          className={cn(
            "text-[10px]",
            activeTab === tab.key ? "font-semibold" : "font-normal"
          )}
        >
          {tab.label}
        </span>
        {tab.key === 'inbox' && inboxBadgeCount > 0 && (
          <span className="absolute top-2 right-[calc(50%-20px)] min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
            {inboxBadgeCount}
          </span>
        )}
      </Link>
    ))}
  </div>
</nav>

// Content area must have bottom padding to clear tab bar:
// className="pb-[calc(64px+env(safe-area-inset-bottom))]"
```

**Data binding for badge:** `inboxBadgeCount` ← `GET /api/crm/inbox/unread-count` → `crm_inbox_threads` WHERE `status='open' AND read_at IS NULL AND assigned_to = currentUser.id`. Poll every 60 s or on WebSocket push.

---

## 6. Floating Action Button (FAB)

**[OBSERVED mob-01, mob-02, mob-07, mob-08, mob-09, mob-44, mob-48]**

Present on every screen. Floats above the bottom tab bar.

### 6a. FUB iOS FAB

| Property | Value |
|---|---|
| Diameter | 50–56 pt |
| Background | Cornflower blue `#4AACED` (mob-01), cobalt `#2979FF` (mob-07), medium blue `#4AAEE8` (mob-08), FUB blue `#4A9FD4` (mob-09) |
| Icon | White "+" plus sign, ~22–24 pt, weight 2 pt stroke |
| Position | `bottom: 86–90 pt` (above tab bar with ~8–16 pt gap), `right: 16 pt` |
| Shadow | `0 4px 12px rgba(74,172,237,0.4)` |
| Z-index | Above scroll content, above tab bar |

### 6b. In-House Web FAB

| Property | Value |
|---|---|
| Diameter | 56–60 pt |
| Background | `#2F6FED` (mob-44) / `#1C6EF3` (mob-48) |
| Icon | White "+" 24 pt |
| Position | `bottom: 80 pt`, `right: 16 pt` (fixed, above tab bar) |

**FAB per-screen actions:**

| Screen | FAB tap action |
|---|---|
| Home / Activity | Opens "Add Person" / New Contact bottom sheet |
| Inbox | Opens compose sheet (new email or SMS) |
| People | Opens "Add Person" sheet |
| Contact Detail | Opens quick-action sheet: Send Text · Send Email · Log Call · Add Note · Add Task · Schedule Appointment |
| Calendar | Opens create sheet: New Appointment or New Task |
| Deals | Opens "Add Deal" sheet |

**Component:**

```tsx
<button
  className="fixed z-50 flex items-center justify-center rounded-full shadow-lg"
  style={{
    width: 56,
    height: 56,
    backgroundColor: '#1C6EF3',
    bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)',
    right: 16,
    boxShadow: '0 4px 12px rgba(28,110,243,0.4)',
  }}
  onClick={openFabSheet}
  aria-label="Quick actions"
>
  <PlusIcon className="w-6 h-6 text-white" strokeWidth={2.5} />
</button>
```

---

## 7. Scrollable Content Area

**[OBSERVED all mob-NN screens]**

Occupies all vertical space between the sub-tab strip (or header if no sub-tabs) and the bottom tab bar.

| Property | Value |
|---|---|
| Background | FUB iOS: `#FFFFFF` for list content. In-house: `#F5F5F5` page bg, `#FFFFFF` cards |
| Overflow | `overflow-y: auto; -webkit-overflow-scrolling: touch` |
| Pull-to-refresh | Standard: drag down past top → spinner appears → data reload **[INFERRED all screens from mobile convention + FUB docs]** |
| Bottom inset | Must clear bottom tab bar: `padding-bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` to prevent last row being obscured by FAB + tab bar |

---

## 8. Bottom-Sheet Picker / Action-Sheet Pattern

**[OBSERVED mob-35 (Stage Picker — full-screen modal)]**  
**[INFERRED for all other pickers: Source/Assign/Tags/Timeframe/Team-filter/Inbox-scope/FAB actions — basis: mob-35 + FUB docs §12j + desktop §03 §4.8 modal pattern]**

This is the canonical pattern for all single-select and multi-select pickers on mobile. Used for: Stage, Source, Assigned-to, Tags, Time frame, Collaborators, Team member filter, Inbox scope, Calendar view toggle, FAB quick-action selection.

### 8a. Modal Header Bar

| Property | Value |
|---|---|
| Background | FUB: `#3D5060` (dark teal-slate). In-house: `bg-primary` navy `#102742` |
| Height | 50 pt |
| Corner radius | 12 pt top-left + top-right (sheet presentation from below) |
| Left control | Text button "Cancel" — white, 17 pt, regular. Dismiss without saving |
| Center | Modal title (e.g., "Stage", "Source", "Assign to") — white, 17 pt, weight 600, centered |
| Right control | Text button "Select" (single-select) or "Done" (multi-select) — white, 17 pt, regular. Saves current selection and dismisses |

### 8b. Option Rows

| Property | Value |
|---|---|
| Row height | 52 pt |
| Left padding | 16 pt |
| Label font | 17 pt, weight 400, dark `#2D3E50` (FUB) / `text-foreground` (in-house) |
| Label color | FUB: `#2D3E50`. In-house: `text-foreground` |
| Selected row bg | FUB: very subtle blue tint `#F2F6FF`. In-house: `bg-primary/5` |
| Unselected row bg | `#FFFFFF` |
| Checkmark (selected) | Right-aligned, 18 pt, `#2D7FF9` (FUB) / `text-primary` (in-house), SF Symbols "checkmark" |
| Divider | 1 pt `#E0E0E2` full-width between rows |
| Scroll handle | Native iOS scroll indicator appears on long lists (non-interactive) |

### 8c. Stage Picker — Exact Data

**[OBSERVED mob-35]** All 16 options in order:

```
1. Seller Prospect
2. Lead               ← selected by default (checkmark #2D7FF9)
3. A - Hot 1-3 Months
4. B - Warm 3-6 Months
5. C - Cold 6+ Months
6. Renter - future buyer
7. Active Client
8. Pending
9. Past Client
10. Sphere
11. Archive
12. Closed
13. Trash
14. Real Estate Agent
15. Vendor
16. Nurture
```

Total list height: 16 × 52 = 832 pt; slightly taller than available viewport → slight scroll required to reach "Nurture".

### 8d. Sheet Presentation (Web Implementation)

```tsx
// Bottom sheet implementation — slides up from bottom, full-screen
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent
    side="bottom"
    className="p-0 rounded-t-xl overflow-hidden"
    style={{ maxHeight: '100dvh' }}
  >
    {/* Header */}
    <div
      className="flex items-center justify-between px-4 h-[50px] flex-shrink-0"
      style={{ backgroundColor: '#102742' }}
    >
      <button
        className="text-white text-[17px] font-normal"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      <span className="text-white text-[17px] font-semibold">{title}</span>
      <button
        className="text-white text-[17px] font-normal"
        onClick={handleSelect}
      >
        Select
      </button>
    </div>

    {/* Scrollable option list */}
    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 50px - 34px)' }}>
      {options.map(option => (
        <button
          key={option.value}
          className={cn(
            "w-full flex items-center justify-between px-4 border-b border-[#E0E0E2] h-[52px]",
            selectedValue === option.value ? "bg-primary/5" : "bg-white"
          )}
          onClick={() => setSelectedValue(option.value)}
        >
          <span className="text-[17px] text-foreground">{option.label}</span>
          {selectedValue === option.value && (
            <CheckIcon className="w-[18px] h-[18px] text-primary" />
          )}
        </button>
      ))}
    </div>

    {/* Safe area bottom pad */}
    <div
      className="bg-[#EFF0F3] flex-shrink-0"
      style={{ height: 'env(safe-area-inset-bottom)' }}
    />
  </SheetContent>
</Sheet>

// Backdrop + slide animation: provided by shadcn Sheet via Radix Dialog
// Animation: transform: translateY(100%) → translateY(0) on open
//            translateY(0) → translateY(100%) on close
// Duration: 300ms ease-out
// Backdrop: rgba(0,0,0,0.4) behind the sheet
```

### 8e. FAB Quick-Action Sheet (Multi-Option)

**[INFERRED — basis: mob-01 FAB tap, mob-02 FAB tap, FUB docs §12k Quick Actions]**

When the FAB is tapped on the Contact Detail screen, this action-list sheet presents:

| Icon | Action label | Behavior |
|---|---|---|
| `<PhoneIcon />` | Make a call | Opens dialer / confirms number |
| `<MessageIcon />` | Send text | Opens SMS compose |
| `<MailIcon />` | Send email | Opens email compose (switches to Comms tab compose) |
| `<FileTextIcon />` | Add note | Opens note compose textarea |
| `<CheckSquareIcon />` | Add task | Opens task create sheet |
| `<CalendarIcon />` | Schedule appointment | Opens appointment create sheet |

Sheet header: "Add activity" (or no header — bare list from bottom). No Cancel/Select pattern — each row is an immediate action that dismisses the sheet.

---

## 9. Navigation Model

### 9a. Stack-Based Push/Pop Navigation

The in-house CRM uses a stack-based navigation model matching FUB iOS behavior:

```
Root Tab (e.g., People)
  └── Smart List → People List
        └── Contact Detail (pushed)
              └── Contact Edit form (pushed)
              └── Stage Picker modal (full-screen sheet)
              └── Tag Editor modal (full-screen sheet)
```

**Push behavior:** Tapping a list row navigates to the detail view. The header bar replaces its left control with a back chevron `<`. The bottom tab bar is **suppressed** on pushed detail views. **[OBSERVED mob-02: "Bottom tab bar NOT RENDERED on this screen"]**

**Pop behavior:** Tapping the back chevron `<` returns to the previous screen. iOS edge-swipe (from left edge) also triggers pop (browser `history.back()` equivalent in responsive web). **[INFERRED from mob-02 observation + standard mobile web UX]**

**Full-screen modals (Stage Picker, Tag Editor, Add Person):** Presented as `position: fixed; inset: 0; z-index: 9999` overlays. They obscure the tab bar. "Cancel" dismisses without saving; "Select" / "Done" saves and dismisses. **[OBSERVED mob-35]**

### 9b. Tab-Level Navigation Rules

| Rule | Detail |
|---|---|
| Tab switch always returns to root | Tapping a tab icon always navigates to that tab's root screen (e.g., People → Smart List index), not a previous detail view |
| Deep-link into tab | `href="/crm/people/{contactId}"` can deep-link directly to a contact within the People tab stack |
| Active tab re-tap | Scrolls the content back to top (standard mobile tab behavior) **[INFERRED from convention]** |
| Back-stack per tab | Each tab maintains its own navigation stack; switching tabs and returning restores the stack **[INFERRED from standard mobile UX]** |

### 9c. Tab Bar Visibility Rules

| Navigation depth | Bottom tab bar visible? |
|---|---|
| Root tab screen (Home, Inbox, People, Deals, Activity) | YES |
| Pushed detail view (Contact Detail, Deal Detail, Thread Detail) | NO **[OBSERVED mob-02]** |
| Full-screen modal (Stage Picker, Add Person) | NO **[OBSERVED mob-35]** |
| Bottom sheet (FAB actions, pickers presented as sheets) | YES — tab bar is beneath the sheet scrim |

---

## 10. Color + Type System — FUB → Ryan Realty Token Mapping

The in-house CRM copies FUB's **structure, layout, and interaction patterns** exactly but uses Ryan Realty design tokens for all styling. This table is authoritative for the mobile build.

### 10a. Color Mapping

| FUB element | FUB hex (observed) | Ryan Realty component | Ryan Realty token / CSS |
|---|---|---|---|
| Header / nav bar background | `#2E4A5C`–`#405C70` (dark teal-slate) | App header (in-house: white) | `bg-background` → `#FAFAF8` |
| Contact hero dark band | `#3A4E5F` | Contact hero band | `bg-[#1A1A1A]` (in-house observed) |
| Active tab indicator (underline) | `#4AACED`, `#29B5E8`, `#00A4BD` | Sub-tab active underline | `border-primary` → navy `#102742`; or `#007AFF` as-is (in-house observed mob-48) |
| FAB button | `#4AACED`, `#2979FF`, `#4A9FD4` | FAB | `#1C6EF3` (in-house observed); maps to `bg-accent` or custom blue |
| Active bottom tab icon/label | `#4AACED`, `#00A4BD`, `#29A8E0`, `#2196B5` | Active tab | `text-primary` → navy `#102742` |
| Inactive tab icon/label | `#9BA8B0`, `#8E8E93`, `#9AA5AE` | Inactive tab | `text-muted-foreground` → gray `#8E8E93` |
| Tab bar background | `#F7F7F7`, `#F4F5F6`, `#FFFFFF` | Tab bar | `bg-background` → `#FFFFFF` |
| Tab bar top border | `#E0E0E0`, `#D8DADC` | Tab bar separator | `border-border` → `#C6C6C8` |
| Inbox badge | `#E53935`, `#FF3B30` | Unread badge | `bg-destructive` |
| Section header bg (list groups) | `#EEF1F4`, `#EEF0F3` | Section header | `bg-muted` |
| Row divider | `#E8EDF0`, `#E5E5EA` | Row separator | `border-border` |
| List row bg | `#FFFFFF` | Row bg | `bg-card` |
| Page bg | `#F9F9F9`, `#F2F2F7` | Page bg | `bg-background` → cream `#FAF8F4` |
| Primary text (names, titles) | `#1D2F3E`, `#1C1C1E`, `#263238` | Primary text | `text-foreground` |
| Secondary text (dates, sources, subtitles) | `#8FA8BB`, `#8E8E93`, `#90A4AE` | Secondary text | `text-muted-foreground` |
| Action call button | `#4CB87E` (green) | Call action button | `bg-success` |
| Action SMS button | `#6B7FC4` (blue-purple) | SMS action button | `bg-accent` |
| Action email button | `#29B5E8` (FUB teal) | Email action button | `bg-primary` |
| Detail row value text | `#1A2332`, `#2D3E50` | Detail row value | `text-foreground` |
| Detail row label text | `#8A9DB0` | Detail row label | `text-muted-foreground` |
| Disclosure chevron | `#C0C8D0` | Disclosure chevron | `text-muted-foreground/50` |
| Stage picker selected row | `#F2F6FF` (subtle blue tint) | Selected option row | `bg-primary/5` |
| Stage picker checkmark | `#2D7FF9` | Checkmark icon | `text-primary` |
| Modal header | `#3D5060` | Modal / sheet header | `bg-primary` navy `#102742` |
| Task checkbox | `#F5A623` (orange border) | Task checkbox | `border-warning` or `border-[#F5A623]` |
| Calendar dark bg | `#364859` | Calendar header/grid bg | `bg-primary` navy `#102742` |
| Avatar initials palette | Orange `#B55A00`, red `#D93025`, olive `#707A00`, gray `#6B7A8D` | Avatar fallback colors | Same palette — deterministic from `hashColor(contact.fullName)` |

### 10b. Type Mapping

| Context | FUB font (iOS) | In-house font | How to apply |
|---|---|---|---|
| Header title ("People", "My Inbox") | SF Pro, 17–20 pt, weight 400–600 | Geist 500–600 | `text-lg font-semibold` or `font-medium` |
| Ryan Realty wordmark (in-house center) | N/A | Amboqia Boriango | `<img>` from `logo-blue.png` — never re-typeset |
| Sub-tab labels | SF Pro, 14–15 pt | Geist | `text-[14px]` or `text-sm` |
| Contact name (hero) | SF Pro, 22 pt, weight 600 | Geist 700 | `text-xl font-bold` |
| Contact name (list row) | SF Pro, 16–17 pt, weight 500 | Geist 500–600 | `text-base font-semibold` |
| Source / date (list row) | SF Pro, 13 pt, weight 400 | Geist 400 | `text-[13px] text-muted-foreground` |
| Section header labels | SF Pro, 11 pt, ALL CAPS | Geist 500 | `text-[11px] uppercase tracking-wide text-muted-foreground` |
| Detail row label (left) | SF Pro, 16 pt | Geist 400 | `text-base text-muted-foreground` |
| Detail row value (right) | SF Pro, 16–17 pt | Geist 400 | `text-base text-foreground` |
| Stage picker option | SF Pro, 17 pt | Geist 400 | `text-[17px]` |
| Tab labels | SF Pro, 10 pt | Geist 400 | `text-[10px]` |
| Avatar initials | SF Pro, 13–20 pt, weight 600 | Geist 600 | `text-sm font-semibold` (small) / `text-xl font-bold` (hero) |
| All numeric values | SF Pro tabular | Geist | `tabular-nums` on all numeric elements |

### 10c. Radius Mapping

| FUB element | FUB radius (approx) | In-house |
|---|---|---|
| Card (activity card, needs-action) | Variable | `rounded-xl` (16 pt) per mob-44 |
| Input fields | 8 pt | `rounded-lg` |
| Sheet / modal rounded top | 12 pt | `rounded-t-xl` |
| Sub-tab active box | 4 pt | `rounded-[4px]` |
| Lead stage pill | Full pill | `rounded-full` |
| Badge (inbox count) | Full circle | `rounded-full` |
| FAB | Full circle | `rounded-full` |

---

## 11. Gestures

| Gesture | Target | Behavior |
|---|---|---|
| **Tap** | Any list row | Navigate to detail (push) |
| **Tap** | Tab bar item | Switch to that root tab |
| **Tap** | Header back `<` | Pop to previous screen |
| **Tap** | "Cancel" (sheet header) | Dismiss sheet without saving |
| **Tap** | "Select" / "Done" (sheet header) | Save selection, dismiss sheet |
| **Tap** | FAB | Open quick-action sheet |
| **Tap** | Sub-tab | Switch content to that tab's data |
| **Tap** | Team/scope filter pill | Open picker sheet |
| **Tap** | Stage / Source / Tags field row | Open corresponding picker sheet |
| **Tap** | Bell icon | Push notifications screen (or slide-in panel) |
| **Tap** | Search icon | Open search overlay (keyboard up, inline filter field) |
| **Swipe left on row** | List row (Activity, Inbox, People) | Reveal action buttons (FUB: Call / Text / Archive for leads; Done / Assign for inbox). **[INFERRED — basis: mob-01 "FUB standard", mob-07 confirmed "Swipe left → Done/Assign", FUB docs §12a "Swipe left → close conversation"]** |
| **Swipe right on row** | Inbox conversation | **[INFERRED from FUB docs §12a]** Assign conversation to teammate |
| **Swipe right (screen edge)** | Pushed detail view | Pop to previous screen (iOS standard back gesture) **[INFERRED from mob-02 + standard iOS]** |
| **Pull-to-refresh** | Scrollable content area | Reload list/data from API. Show spinner above first row. **[INFERRED — universal mobile convention + noted in all mob analyses]** |
| **Long-press** | Phone / email row | Copy to clipboard **[INFERRED from mob-02 + standard iOS convention]** |
| **Horizontal scroll** | Sub-tab strip (Contact Detail) | Reveals additional tabs off-screen right (Homes, Calendar, etc.) |
| **Tap date cell** | Calendar grid | Selects date, scrolls task list to that date's section **[OBSERVED mob-08]** |
| **Swipe left/right on calendar grid** | Month grid | Previous/next month **[INFERRED from mob-08 + FUB docs §12g]** |
| **Tap task checkbox** | Calendar task row | Marks task complete; row animates out **[INFERRED from mob-08]** |
| **Swipe down** | Full-screen modal sheet | Dismisses as "Cancel" (interactive sheet dismiss) **[INFERRED from mob-35 + iOS sheet convention]** |

---

## 12. The `<MobileShell>` Component

All mobile screens are wrapped in a single `<MobileShell>` component that handles the fixed layout layers. Screens inject their content into the scrollable slot.

```tsx
interface MobileShellProps {
  activeTab: 'home' | 'inbox' | 'people' | 'deals' | 'activity';
  showTabBar?: boolean;    // default true; false on pushed detail views
  showFab?: boolean;       // default true
  fabAction?: () => void;
  headerLeft?: ReactNode;  // overrides hamburger menu (e.g., back chevron on detail)
  headerCenter?: ReactNode; // overrides wordmark (e.g., "Cancel / Stage / Select" on pickers)
  headerRight?: ReactNode; // overrides search+avatar (e.g., "Edit" on contact detail)
  subTabs?: ReactNode;     // optional sub-tab strip below header
  contactHero?: ReactNode; // optional contact hero band (contact detail only)
  children: ReactNode;     // scrollable content area
}

export function MobileShell({
  activeTab,
  showTabBar = true,
  showFab = true,
  fabAction,
  headerLeft,
  headerCenter,
  headerRight,
  subTabs,
  contactHero,
  children,
}: MobileShellProps) {
  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">

      {/* Fixed header region */}
      <header className="flex-shrink-0 z-40">
        <TopBar
          left={headerLeft ?? <HamburgerButton />}
          center={headerCenter ?? <RyanRealtyLogo />}
          right={headerRight ?? <DefaultHeaderActions />}
        />
        {contactHero}
        {subTabs}
      </header>

      {/* Scrollable content — fills remaining space */}
      <main
        className="flex-1 overflow-y-auto overscroll-y-contain"
        style={{
          paddingBottom: showTabBar
            ? 'calc(64px + env(safe-area-inset-bottom) + 16px)'
            : 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
      </main>

      {/* Floating action button */}
      {showFab && (
        <Fab
          onClick={fabAction}
          style={{
            position: 'fixed',
            bottom: showTabBar
              ? 'calc(64px + env(safe-area-inset-bottom) + 16px)'
              : 'calc(16px + env(safe-area-inset-bottom))',
            right: 16,
          }}
        />
      )}

      {/* Bottom tab bar */}
      {showTabBar && <BottomTabBar activeTab={activeTab} />}

    </div>
  );
}
```

---

## 13. Loading States (Mobile)

**[INFERRED from desktop §03 §4.11 + mobile convention]**

| State | When | Implementation |
|---|---|---|
| **List skeleton rows** | Initial load of Activity / Inbox / People / Deals lists | 8 skeleton rows matching row height of that list: `<Skeleton className="h-[74px] w-full" />` |
| **Pull-to-refresh spinner** | User drags list past top | CSS `@keyframes spin` circle above first row, disappears when data arrives |
| **Empty state** | No data matching filter | Icon + "No [items] yet" text centered in content area |
| **Tab content swap** | Tapping sub-tab triggers async load | Skeleton for the incoming content; existing content replaced immediately on data arrival |
| **Picker list loading** | Stage/Source picker with async options | Skeleton rows in picker list |

---

## 14. Notification Bell (Mobile)

**[INFERRED — basis: FUB docs §12l notifications-mobile.md; bell icon observed in mob-01, mob-07, mob-08, mob-09]**

The bell icon in the header bar's right cluster shows a badge when unread notifications exist. On tap it pushes a Notifications screen (not a side panel — mobile pushes a full screen).

| Property | Value |
|---|---|
| Badge shape | Red filled circle |
| Badge bg | `bg-destructive` |
| Badge text | White numeral, unread count |
| Notification row | Type icon + title text + relative time + blue unread dot |
| Tap row | Mark as read + navigate to related entity (contact / deal / thread) |
| "Mark all as read" | Button at top of notifications screen |
| Badge disappears | When count reaches 0 |

**Notification types to implement (per FUB docs):**
- New lead assigned
- Lead reassignment
- Lead inquiry (existing contact)
- New text message received
- Missed call / voicemail
- Inbox conversation assigned
- @mention in a note
- Email opened / clicked
- Task assigned / due

**In-house improvement over FUB:** FUB docs document that mobile notification settings cannot be changed from the app. The in-house CRM should surface a link to notification preferences from the bell screen.

---

## 15. Mobile Coverage Map

This table maps every core mobile feature to the observed screenshots and inferred basis. Use this to drive the implementation backlog for §24–§30.

| Feature | Module | Observed screenshots | Inferred basis |
|---|---|---|---|
| **Activity feed — New Leads sub-tab** | Activity | **mob-01** (FUB iOS) | — |
| **Activity feed — Emails sub-tab** | Activity | None | FUB docs §12f; desktop §08 Inbox; mob-01 sub-tab strip observed |
| **Activity feed — Website sub-tab** | Activity | **mob-44** (in-house web, inside Home dashboard card) | — |
| **Activity feed — team filter picker** | Activity | None | mob-01 "Everyone ▾" picker observed; mob-35 picker pattern |
| **Home dashboard** | Home | **mob-44** (in-house web) | — |
| **Home — Needs your action (empty)** | Home | **mob-44** (in-house web, empty-state checkmark) | — |
| **Home — Needs your action (populated)** | Home | None | Desktop tasks pattern §09; mob-08 task rows |
| **Inbox — conversation list** | Inbox | **mob-07** (FUB iOS, "My Inbox") | — |
| **Inbox — scope picker (My/Team/All)** | Inbox | None | mob-07 "My Inbox ▾" picker header; mob-35 picker pattern |
| **Inbox — conversation thread detail** | Inbox | None | Desktop §08 reading pane; FUB docs §12a |
| **Inbox — compose (email)** | Inbox | **mob-48** (in-house web, Contact Comms tab compose card) | — |
| **Inbox — compose (SMS)** | Inbox | None | FUB docs §12d; mob-48 channel selector observed |
| **Calendar — month grid** | Calendar | **mob-08** (FUB iOS) | — |
| **Calendar — task list below grid** | Calendar | **mob-08** (FUB iOS, task rows) | — |
| **Calendar — appointment create sheet** | Calendar | None | mob-08 FAB tap; FUB docs §12g |
| **Calendar — task create sheet** | Calendar | None | mob-08 FAB tap; FUB docs §12k |
| **People — Smart Lists (All Lists tab)** | People | **mob-09** (FUB iOS) | — |
| **People — Stages tab** | People | None | mob-09 "Stages" inactive sub-tab; FUB docs §12h |
| **People — filtered list (after tapping smart list)** | People | None | Desktop §05 People list; mob-09 row tap → pushes filtered list |
| **Contact Detail — Info tab** | Contact | **mob-02** (FUB iOS) | — |
| **Contact Detail — Comms tab** | Contact | **mob-48** (in-house web, email compose open) | — |
| **Contact Detail — Tasks tab** | Contact | None | mob-48 sub-tabs observed; FUB docs §12j |
| **Contact Detail — Homes tab** | Contact | None | mob-02 "Homes" sub-tab; FUB docs §12j |
| **Contact Detail — Workflow/Plans tab** | Contact | None | mob-48 "Workflow" sub-tab; FUB docs §12j |
| **Contact Detail — Activity tab** | Contact | None | mob-48 "Activi…" sub-tab; FUB docs §12j |
| **Contact Detail — quick-action FAB sheet** | Contact | None | mob-02 FAB observed; FUB docs §12k |
| **Contact Edit form** | Contact | None | mob-02 "Edit" button; desktop §07a |
| **Stage Picker modal** | Contact | **mob-35** (FUB iOS) | — |
| **Source Picker modal** | Contact | None | mob-35 pattern; mob-02 Source row |
| **Assigned-to Picker modal** | Contact | None | mob-35 pattern; mob-02 Assigned to row |
| **Tags Editor modal** | Contact | None | mob-35 pattern; mob-02 Tags row |
| **Time frame Picker modal** | Contact | None | mob-35 pattern; mob-02 Time frame row |
| **Add Relationship modal** | Contact | None | mob-02 "Add Relationship…" row |
| **Deals tab** | Deals | None | FUB docs §12i; desktop §10 |
| **Deal detail** | Deals | None | FUB docs §12i; desktop §10 |
| **Notifications screen** | Global | None | FUB docs §12l; bell icon observed all screens |
| **Search overlay** | Global | None | Search icon observed mob-01, mob-07, mob-09; FUB docs §12h |
| **Account/profile settings sheet** | Global | None | Avatar button observed mob-01, mob-07, mob-09; desktop §16 |
| **Add Person / New Contact sheet** | Global | None | FAB observed all screens; FUB docs §12k |
| **Settings** | Global | None | FUB docs §12; desktop §16 |

**Legend:**
- **Bold** = observed (screenshot exists as mob-NN)
- Regular = inferred (no screenshot; built from FUB docs / desktop spec / mob pattern)

---

## 16. Acceptance Criteria

Numbered acceptance criteria for the shell. Each must pass before any module-level mobile spec is considered buildable on this foundation.

1. `<MobileShell>` renders correctly at 390 pt width with `showTabBar={true}` — header, scrollable content, FAB, and tab bar are all present and non-overlapping.
2. `<MobileShell showTabBar={false}>` — tab bar is absent; FAB bottom adjusts to clear safe-area only.
3. Content area bottom padding clears the FAB + tab bar: last list row is fully visible above both, with 8 pt breathing room.
4. Status bar region (top 54 pt) is not covered by any buildable element — it shows through cleanly.
5. Safari URL bar (40 pt below status bar) is not covered by any buildable element.
6. Bottom tab bar absorbs the iOS home-indicator safe area (`env(safe-area-inset-bottom)`) — no content sits in that zone.
7. FAB is `position: fixed` at `bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` — does not scroll with content.
8. In-house tab set (Home · Inbox · People · Deals · Activity) renders in that order, equal width, icons + 10 pt labels.
9. Active tab: icon weight increases (bolder stroke), label is `font-semibold`, color is `text-primary` (navy `#102742`).
10. Inactive tabs: `text-muted-foreground` (#8E8E93), `font-normal` labels.
11. Inbox badge: red `bg-destructive` circle, white numeral, overlapping top-right of Inbox icon; only shown when `inboxBadgeCount > 0`.
12. Ryan Realty wordmark centered in header — not re-typeset, served as `logo-blue.png` image.
13. All numeric values in the shell use `tabular-nums`.
14. Sub-tab strip underline variant: 3 pt colored border-bottom on active tab cell.
15. Sub-tab strip box-outline variant: solid 1.5 pt border around active tab cell.
16. Bottom-sheet picker: slides up from bottom with 300 ms ease-out, `border-radius: 12px 12px 0 0`, navy header `#102742`.
17. Bottom-sheet picker rows: 52 pt height, 16 pt left padding, `text-[17px]`, full-width 1 pt `#E0E0E2` divider.
18. Selected option row: `bg-primary/5` tint, navy `text-primary` checkmark right-aligned at 16 pt from right edge.
19. "Cancel" tap dismisses sheet with no state change. "Select" / "Done" calls `onSelect(selectedValue)` and dismisses.
20. Swipe-down gesture on picker sheet dismisses it (implement via touch-start/move/end handlers or CSS `overscroll-behavior`).
21. Pull-to-refresh: spinning indicator appears when user drags list past top boundary; triggers async data reload; indicator dismisses when data arrives.
22. No raw `<button>`, `<input>`, `<select>`, `<div className="rounded-full...">` for shell elements — all from `@/components/ui/`.
23. No hex colors in className strings (e.g., `bg-[#102742]`) — use `bg-primary`, `text-muted-foreground`, etc.
24. All icons are outline-style when inactive, slightly bolder when active — no filled-solid icons except where explicitly noted (calendar icon active = filled in FUB reference; replicate).
25. `MobileShell` renders in < 50 ms to first paint — no async data fetches in the shell itself; badge counts loaded asynchronously via SWR without blocking render.

---

## 17. Data Touched

| Shell element | Supabase table / API | Key fields |
|---|---|---|
| Broker avatar (header) | `public.brokers` | `headshotUrl`, `name`, `initials`, `id` |
| Inbox badge count | `crm_inbox_threads` | `status='open'`, `read_at IS NULL`, `assigned_to = userId` → COUNT |
| Notification bell badge | `crm_notifications` (or equivalent) | `read_at IS NULL`, `user_id = userId` → COUNT |
| Active tab (router) | Next.js `usePathname()` | Current route path → maps to tab key |
| Bottom-sheet picker options (Stage) | `public.crm_stages` or local constant | `value`, `label` |
| Bottom-sheet picker options (Source) | `public.crm_sources` or FUB API | `value`, `label` |
| Bottom-sheet picker options (Assign) | `public.brokers` | `id`, `name`, `headshotUrl` |
| Team-filter picker | `public.brokers` + `crm_ponds` | `id`, `name`, `avatarUrl` |

---

## Sources

### Observed screenshots (real pixels — authoritative)

| File | App source | Key patterns captured |
|---|---|---|
| `mob-01.md` | fub-ios | Activity feed, FUB bottom tab bar (5 tabs: Inbox/Activity/Calendar/People/Deals), FAB, sub-tab strip (3 tabs), broker avatar header |
| `mob-02.md` | fub-ios | Contact Detail Info tab, dark hero band, sub-tab strip (5+ tabs scrollable), tab bar SUPPRESSED, FAB, detail row pattern, action button circles |
| `mob-07.md` | fub-ios | Inbox / My Inbox, segmented pill sub-tabs, conversation rows, unread dot, 30 badge, FAB (cobalt #2979FF) |
| `mob-08.md` | fub-ios | Calendar month grid, task list below, date section headers, task row anatomy (checkbox/icon/text/time/assignee badge), reminder row |
| `mob-09.md` | fub-ios | People / Smart Lists (All Lists tab), smart list row anatomy (emoji + label + teal count), All Lists/Stages sub-tab, FAB |
| `mob-35.md` | fub-ios | Stage Picker modal — full-screen sheet, Cancel/Stage/Select header, 16-option list, checkmark on selected row, dark modal header |
| `mob-44.md` | inhouse-web | Home dashboard, in-house bottom tab bar (Home/Inbox/People/Deals/Activity), Ryan Realty wordmark header, activity card, Needs-your-action card, FAB (#2F6FED) |
| `mob-48.md` | inhouse-web | Contact Detail Comms tab, email compose card, dark contact hero band, scrollable sub-tabs (6 visible), in-house tab bar (People active, navy) |

### Desktop spec (structure / behavior reference)

- `docs/fub-crm-spec/03-app-shell-and-shared-ui-patterns.md` — §4.1 app shell regions, §4.2 top nav bar, §4.3 module sub-nav, §4.8 modal pattern, §4.14 design-system mapping table, loading states §4.11

### Official FUB documentation

- `fub-docs/notifications-mobile.md` — §12 iPhone App: navigation tabs, §12a Inbox swipe actions, §12f Activity filters, §12g Calendar visual indicators, §12h People tab (All Lists/Stages), §12i Deals, §12j Lead Profile tabs, §12k Quick Actions, §12l Notification Center, §13 Android App

### Inferred items and their basis

The following items have no screenshot evidence and are reconstructed:

| Item | Inferred basis |
|---|---|
| Tab bar suppression on pushed views | mob-02 explicitly: "Bottom tab bar NOT RENDERED on this screen" |
| Swipe-left reveal actions | mob-01 "FUB standard — swipe-left Call/Text/Archive"; mob-07 "[INFERRED] Left-swipe reveals Done/Assign"; FUB docs §12a |
| FAB quick-action sheet contents | FUB docs §12k (6 Quick Actions list); mob-02 FAB onTap description |
| Notification screen contents | FUB docs §12l (iPhone Notification Center) |
| Pull-to-refresh | All mob analyses note "[INFERRED] Pull-to-refresh"; universal mobile convention |
| Calendar tab absent from in-house tab bar | mob-44 and mob-48 both show 5-tab bar without Calendar; Calendar integrated into Home dashboard |
| Contact hero band sub-tabs scrollable beyond 6 | mob-48 shows "Activi…" truncated at right edge — implies more tabs off-screen |

### Cross-references to sibling sections

- **§24** — Activity Feed (mobile): builds on mob-01 Activity sub-tab rows
- **§25** — Inbox (mobile): builds on mob-07 conversation list + mob-48 compose
- **§26** — People / Smart Lists (mobile): builds on mob-09 list index + mob-02 contact detail
- **§27** — Contact Detail tabs (mobile): builds on mob-02 Info tab + mob-48 Comms tab + mob-35 pickers
- **§28** — Calendar / Tasks (mobile): builds on mob-08 calendar grid + task list
- **§29** — Deals (mobile): inferred from FUB docs §12i + desktop §10
- **§30** — Compose / Quick Actions (mobile): inferred from mob-48 compose card + FUB docs §12k

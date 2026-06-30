<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.31.25 AM.png | Sequential id: shot-53 | Tiles: fub-tiles/shot-53_{full,q1,q2,q3,q4}.png -->

# shot-53 — Admin > Team Members List

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/teams`
- **Browser tab title:** "Team - Follow Up Boss"
- **Top-nav active item:** "Admin" (rendered in teal/blue accent color, distinguished from the other dark-charcoal nav items)
- **Sub-nav active tab:** "Team" (underlined with a blue/teal ~2px bottom border; text is slightly bolder than inactive tabs)
- **Breadcrumbs:** None visible — no breadcrumb row between sub-nav and content
- **Logged-in user:** Matt Ryan (circular avatar photo in top-right corner of the primary nav bar; appears to match the first row in the table)
- **Account / brokerage name:** Ryan Realty (visible in the Chrome bookmarks bar: "Ryan Realty" with a small icon)
- **FUB account ID in URL:** `/2/` — numeric account identifier is `2`

---

## Layout

The page uses FUB's standard three-zone chrome:

### Zone 1 — Browser chrome (macOS / Chrome)
- Standard macOS traffic-light close/minimize/maximize buttons top-left
- Chrome address bar showing the URL
- Browser bookmarks bar with several pinned tabs/extensions (Claude, CRM mobile UI, Lindsay mail form, Application cost, etc.)

### Zone 2 — FUB Application Shell (~100% width)
Two horizontal bars stacked:

**Primary nav bar** (~48px tall, dark charcoal ~`#2d3748` or `#333f52`):
- Far left: hamburger/grid icon (≡ menu collapse toggle)
- Nav items left-to-right: People (person icon), Inbox (bell/mail icon with badge), Tasks (checklist icon), Calendar (calendar icon), Deals (handshake/dollar icon), Reporting (bar-chart icon), Admin (gear/cog icon) — **Admin is highlighted teal**
- Center: Search input field (rounded pill, placeholder "Search", medium width ~220px)
- Far right: cluster of icon buttons (notification bell, user avatar circular photo ~32px, and 3–4 additional icons for integrations/apps)

**Admin sub-nav bar** (~40px tall, white background, bottom border `#e2e8f0`-ish):
- Tabs left-to-right (text only, no icons): Overview · Lead Flow · Groups · **Team** · Action Plans · Automations · Ponds · Email Templates · Text Templates · Import · Custom Fields · Stages · Phone Numbers · Tags · Integrations · Company · API · More ▼
- "Team" tab has a teal/blue underline border (active indicator)
- Far right of sub-nav: "? How Teams work" — small text link with a circle-question icon, color teal/blue, links to help docs

### Zone 3 — Main Content Area (white/light gray `#f5f6f7` background)
- Centered content container, max-width roughly 700–800px, horizontally centered on page
- Content begins ~20px below sub-nav
- **Top of content:** "3 team members" label (left-aligned, gray medium-weight text, ~14px) + "+ Add Team Members" button (right-aligned, teal/blue filled pill)
- **Below that:** the team members data table (full width of the container)
- **Below table:** large empty area (no more rows, no pagination, no empty-state message)
- **Bottom of page:** a small horizontal scrollbar pill indicator centered at very bottom (indicates horizontal overflow is possible); no visible footer bar or "Getting Started" progress bar

---

## Every UI Element (exhaustive)

### Primary Navigation Bar (dark charcoal)

| Element | Type | State / Value |
|---|---|---|
| ≡ (hamburger/grid) | Icon button | Collapses/expands left rail [INFERRED] |
| People | Nav link with person icon | Inactive |
| Inbox | Nav link with notification icon | Inactive; has a small red badge (count obscured at this zoom) |
| Tasks | Nav link with checklist icon | Inactive |
| Calendar | Nav link with calendar icon | Inactive |
| Deals | Nav link with icon | Inactive |
| Reporting | Nav link with bar chart icon | Inactive |
| Admin | Nav link with gear/cog icon | **Active** — teal text color |
| Search | Text input | Placeholder "Search"; rounded pill shape |
| (4 icon buttons right) | Icon cluster | Include: notification bell, user avatar (Matt Ryan photo), and additional utility icons |

### Admin Sub-Navigation Tabs

All tabs are plain text, no icons. Left-to-right in order:

1. Overview
2. Lead Flow
3. Groups
4. **Team** ← active (blue/teal underline)
5. Action Plans
6. Automations
7. Ponds
8. Email Templates
9. Text Templates
10. Import
11. Custom Fields
12. Stages
13. Phone Numbers
14. Tags
15. Integrations
16. Company
17. API
18. More ▼ (dropdown — reveals additional sub-nav items)

Far right of sub-nav bar (outside tab flow):
- **"? How Teams work"** — icon (circle with question mark) + text link, teal, opens help documentation [INFERRED external link or modal]

### Content Header Row

- **"3 team members"** — plain text label, left-aligned, gray, ~14px font-size. Dynamically reflects the count of rows in the table.
- **"+ Add Team Members"** — button, right-aligned. Style: filled teal/blue pill (`background: ~#3b82f6` or FUB teal `#17a2b8`), white text, rounded corners (~20px border-radius). The "+" prefix is part of the label text. Clicking opens an invite/add flow [INFERRED — likely opens a modal to input name/email/role/phone].

### Team Members Table

#### Column Headers (left to right)

| # | Header Label | Notes |
|---|---|---|
| 1 | Name | No sort indicator visible |
| 2 | Role | No sort indicator |
| 3 | Phone | No sort indicator |
| 4 | Connected Email | No sort indicator |
| 5 | Connected MLS | No sort indicator |
| 6 | Last Seen | No sort indicator |
| 7 | Can Export | Two-line header: "Can" / "Export" |
| 8 | Pause Leads | Two-line header: "Pause" / "Leads" |
| 9 | Actions | No sort indicator |

Headers are rendered in a lighter-weight gray font (~12–13px, uppercase or small caps feel), sitting above a thin horizontal divider line. No column-resize handles visible.

---

#### Row 1 — Matt Ryan (Owner)

- **Avatar:** Circular photo thumbnail (~36–40px diameter), shows Matt Ryan's face (male, beard, slightly gray/brown)
- **Name (primary text):** "Matt Ryan" — dark text, ~14px, semibold
- **Email (secondary text below name):** "matt@ryan-realty..." — truncated with ellipsis, gray/muted, ~12px. Full value inferred: `matt@ryan-realty.com`
- **Role:** "Owner" — plain text, no dropdown arrow. Indicates this role cannot be changed inline (Owner role is immutable [INFERRED])
- **Phone:** "(541) 213-6706" — preceded by a phone/handset icon (small gray glyph)
- **Connected Email:** "matt@ryan-r..." (truncated) — preceded by an envelope icon. To the right of the truncated address are two small icons:
  - A **blue/teal checkmark** ✓ — indicates email is verified/connected
  - A **teal lightning-bolt or sync icon** ⚡/↻ — indicates sync is active
- **Connected MLS:** "Not connected" — plain gray text
- **Last Seen:** Two sub-rows stacked:
  - 🌐 Web: "6 minutes..." (truncated — likely "6 minutes ago")
  - 🍎 iOS: "an hour ago"
  - Each prefixed with a platform icon: globe icon for Web, Apple logo (🍎) for iOS
- **Can Export:** Checkbox — **checked** (filled blue/teal checkbox, ~16px). Matt Ryan is the only team member with this box checked.
- **Pause Leads:** Checkbox — **unchecked** (empty box)
- **Actions:** Only "Edit" link displayed (no "Delete" — Owner cannot be deleted [INFERRED])

---

#### Row 2 — Rebecca Peterson (Admin)

- **Avatar:** Circular photo thumbnail (~36–40px), female, light-colored hair
- **Name (primary):** "Rebecca Peterson" — dark, semibold
- **Email (secondary):** "rebeccapeterson..." — truncated. Full value inferred: `rebeccapeterson@ryan-realty.com` or similar
- **Role:** "Admin ▼" — "Admin" text followed by a small downward-pointing chevron/caret, indicating an inline dropdown to change the role. Roles available [INFERRED from FUB conventions]: Owner, Admin, Agent, Lender, ISA
- **Phone:** "(415) 308-9087" — phone icon prefix
- **Connected Email:** "rebeccapete..." (truncated) + blue checkmark ✓ + teal sync icon
- **Connected MLS:** "Not connected"
- **Last Seen:**
  - 🌐 Web: "4 months ..." (truncated — "4 months ago")
  - 🍎 iOS: "15 days ago"
- **Can Export:** Checkbox — **unchecked**
- **Pause Leads:** Checkbox — **unchecked**
- **Actions:** "Edit" link + "Delete" link — both in blue/teal text, separated by a space. "Delete" is a destructive action [INFERRED — likely triggers a confirmation modal]

---

#### Row 3 — Paul Stevenson (Agent)

- **Avatar:** Circular photo thumbnail (~36–40px), male, dark hair, slightly younger-looking
- **Name (primary):** "Paul Stevenson" — dark, semibold
- **Email (secondary):** "paul@ryan-realty..." — truncated. Full value inferred: `paul@ryan-realty.com`
- **Role:** "Agent ▼" — "Agent" text + downward chevron for inline role-change dropdown
- **Phone:** "(541) 977-6841" — phone icon prefix
- **Connected Email:** "paul@ryan-re..." (truncated) + blue checkmark ✓ + teal sync icon
- **Connected MLS:** "Not connected"
- **Last Seen:**
  - 🌐 Web: "5 months ..." (truncated — "5 months ago")
  - 🍎 iOS: "4 months a..." (truncated — "4 months ago")
- **Can Export:** Checkbox — **unchecked**
- **Pause Leads:** Checkbox — **unchecked**
- **Actions:** "Edit" + "Delete" links

---

### Table-Level Notes

- **Row count:** 3 rows total; no pagination controls visible; all rows fit on one screen
- **No bulk-action bar:** No "select all" checkbox in the header; rows are not individually selectable for bulk operations
- **No sort controls:** No clickable column headers or sort arrows visible
- **No search/filter bar** within the table itself
- **Row separators:** Thin horizontal lines between rows (~1px, light gray `#e2e8f0`)
- **Row hover state:** Not visible in static screenshot; [INFERRED] rows likely highlight on hover with a light gray background

### Floating / Peripheral Elements

- **Horizontal scrollbar** (bottom of page): Small rounded pill/thumb, gray, centered horizontally. Indicates the table has more content to the right than the viewport shows (the rightmost columns — Can Export, Pause Leads, Actions — are barely visible and the horizontal scroll accommodates viewing them fully).
- **Help button** (bottom-right corner): Circular button, teal/blue border and icon, contains "?" question mark. ~36px diameter. Fixed-position floating widget. [INFERRED] Opens FUB's in-app help chat or help center.

---

## Colors, Typography & Style

### Colors
- **Primary nav bar background:** Dark charcoal/slate, approximately `#2d3748` or `#333f52`
- **Sub-nav bar background:** White `#ffffff`
- **Content area background:** Very light gray `#f5f6f7` or `#f8f9fa`
- **Table rows:** White `#ffffff` background with `#e2e8f0` row separators
- **Active nav/tab accent:** Teal/blue — approximately `#17a2b8` or `#3b82f6` (FUB's primary brand teal)
- **"+ Add Team Members" button:** Teal/blue fill, white text — same brand teal
- **Action links (Edit, Delete):** Teal/blue text color, no underline at rest
- **Checkmark icons (email connected):** Blue/teal `✓`
- **Sync icons (email sync):** Teal lightning or circular arrow
- **Platform icons (Web globe, Apple logo):** Medium gray `#6b7280`
- **Muted/secondary text:** Gray `#6b7280` or `#9ca3af`
- **Primary text (names):** Dark `#1a202c` or `#111827`
- **"Not connected" text:** Gray `#9ca3af` or `#6b7280`
- **Checked checkbox:** Filled teal/blue square with white checkmark
- **Unchecked checkbox:** Empty square, ~1px gray border

### Typography
- **Nav items:** ~13–14px, medium weight (500), white/light gray on dark bar
- **Sub-nav tabs:** ~13–14px, regular/medium weight, gray when inactive, dark + underline when active
- **Table column headers:** ~12–13px, gray, slightly lighter weight, possibly uppercase or small-caps styling
- **Name (primary row text):** ~14px, semibold (~600)
- **Email sub-text under name:** ~12px, gray, regular weight
- **Role, Phone, MLS text:** ~14px, regular weight
- **Last Seen timestamps:** ~12–13px, gray, with platform icon prefix
- **Action links:** ~13–14px, teal/blue, regular weight
- **Count label ("3 team members"):** ~13–14px, gray medium weight
- **Button text ("+ Add Team Members"):** ~13–14px, white, medium weight

### Style Notes
- **Border radius:** Table has minimal radius; the "+ Add Team Members" button has high radius (~20px pill); help button is a perfect circle
- **Density:** Medium — rows are approximately 56–64px tall (avatar + two lines of name/email)
- **Iconography style:** Line/outline icons in the nav; solid filled icons for checkboxes; platform logos (globe, Apple) for Last Seen
- **No shadows** on the table or content cards — flat design
- **No "Getting Started" green progress bar** visible at the very bottom of this screen

---

## State & Data Shown

- **Active filter/context:** No filter; showing ALL team members for the account (Ryan Realty, account ID 2)
- **Total count:** 3 team members
- **No selected rows**
- **No active search query**

### Sample Data (real values from the screen)

| Field | Matt Ryan | Rebecca Peterson | Paul Stevenson |
|---|---|---|---|
| Display Name | Matt Ryan | Rebecca Peterson | Paul Stevenson |
| Email (truncated) | matt@ryan-realty... | rebeccapeterson... | paul@ryan-realty... |
| Role | Owner | Admin | Agent |
| Phone | (541) 213-6706 | (415) 308-9087 | (541) 977-6841 |
| Email Connected | Yes (checkmark + sync) | Yes (checkmark + sync) | Yes (checkmark + sync) |
| MLS Connected | Not connected | Not connected | Not connected |
| Last Seen Web | 6 minutes ago | 4 months ago | 5 months ago |
| Last Seen iOS | an hour ago | 15 days ago | 4 months ago |
| Can Export | ✅ checked | ☐ unchecked | ☐ unchecked |
| Pause Leads | ☐ unchecked | ☐ unchecked | ☐ unchecked |
| Actions available | Edit | Edit, Delete | Edit, Delete |

### Role enum values visible on this screen
- `Owner` (non-editable inline; presumably only one per account)
- `Admin` (editable via inline dropdown)
- `Agent` (editable via inline dropdown)

---

## Interactions & Behaviors

### "+ Add Team Members" button
- [INFERRED] Opens a modal or slide-over panel to invite a new team member. Fields likely include: Name, Email, Phone, Role (dropdown). An invitation email is sent to the new member's email address. The member count increments from 3 to 4 once confirmed.

### Role dropdown (Admin ▼ / Agent ▼)
- [INFERRED] Clicking the chevron opens an inline dropdown with the available role options (e.g., Owner, Admin, Agent, Lender, ISA). Selecting a new role immediately saves via API without a separate "Save" step.
- The Owner row does not have this dropdown — the Owner role cannot be changed by another admin.

### Connected Email column — checkmark icon
- [INFERRED] The blue checkmark indicates the team member's email (Gmail/Outlook) has been authorized and connected. Clicking the icon might navigate to email integration settings or show a tooltip confirming the connected account.

### Connected Email column — sync/lightning icon
- [INFERRED] The teal sync icon indicates that email sync (two-way, pulling inbox activity) is active. Clicking it might toggle sync or show sync status details.

### Connected MLS — "Not connected" text
- [INFERRED] Clicking this text (or an associated icon) would navigate to MLS integration settings for that agent, allowing them to connect their MLS ID/credentials so listing activity can be attributed to them.

### Last Seen — Web / iOS
- Read-only display — timestamps showing when each agent last accessed FUB via browser and via the iOS mobile app.
- [INFERRED] Timestamps are relative ("6 minutes ago", "15 days ago") and likely update in real time or on page refresh.
- Platform icons: globe glyph for Web, Apple logo for iOS.

### Can Export checkbox
- Toggling this checkbox grants or revokes the ability for this team member to export lead/contact data (CSV export).
- Matt Ryan (Owner) has it checked by default. Other roles have it unchecked by default.
- [INFERRED] Saving is immediate (auto-saves on toggle via API PATCH call).

### Pause Leads checkbox
- Toggling this checkbox pauses automatic lead routing to this agent. While paused, new leads will not be assigned to them via round-robin or automatic distribution.
- All three members have this unchecked (leads flowing normally).
- [INFERRED] This is a useful feature when an agent is on vacation or temporarily unavailable.

### "Edit" action link
- [INFERRED] Clicking "Edit" opens an edit panel or modal for that team member, allowing updates to their name, email, phone, role, and other profile settings.
- Available for all three members including the Owner.

### "Delete" action link
- Available only for non-Owner members (Rebecca Peterson and Paul Stevenson).
- [INFERRED] Clicking "Delete" triggers a confirmation modal warning about what happens to the agent's leads (reassignment options). Deletion removes the user from the FUB account.
- Owner cannot be deleted (no Delete link shown for Matt Ryan).

### "? How Teams work" help link
- [INFERRED] Opens FUB's help documentation page about the Team feature — likely in a new tab or a contextual help panel.

### Help button (? circle, bottom right)
- [INFERRED] Fixed-position floating button. Opens FUB's in-app support chat (Intercom or similar) or a help center overlay.

### Horizontal scrollbar
- The table content extends slightly beyond the visible viewport width. Scrolling right reveals additional column content that is partially clipped (the right-side columns Can Export, Pause Leads, Actions are partially visible).

---

## Data Model Signals

### Entities

**`team_members` / `users` table:**
- `id` — internal FUB user ID
- `account_id` — FK to accounts table (here: `2`)
- `name` / `display_name` — string
- `email` — string (shown truncated)
- `phone` — string, formatted as `(NNN) NNN-NNNN`
- `role` — enum: `owner`, `admin`, `agent` (at minimum; likely also `lender`, `isa`)
- `avatar_url` / `profile_photo` — URL to circular photo
- `can_export` — boolean
- `pause_leads` — boolean (lead routing paused flag)
- `last_seen_web` — timestamp (relative display: "6 minutes ago")
- `last_seen_ios` — timestamp (relative display: "an hour ago")
- `connected_email` — nullable string (the connected Gmail/Outlook address)
- `email_connected` — boolean (checkmark state)
- `email_sync_active` — boolean (sync icon state)
- `connected_mls` — nullable string / FK to MLS integration; "Not connected" = null

**`accounts` table:**
- `id` = 2
- `name` = "Ryan Realty" (visible in bookmarks bar)

### Relationships
- One account has many team members
- One team member has exactly one role
- One team member optionally has one connected email integration
- One team member optionally has one connected MLS integration
- Role `owner` is unique per account (only one owner row)

### Enum Values
- **Role:** `Owner`, `Admin`, `Agent` (observed); `Lender`, `ISA` likely exist [INFERRED from FUB product knowledge]

### Format Conventions
- Phone displayed as `(NNN) NNN-NNNN` with a phone handset icon prefix
- Email shown truncated with ellipsis when it exceeds column width
- Timestamps shown relative (e.g., "6 minutes ago", "an hour ago", "15 days ago", "4 months ago")
- Platform icons: globe for web sessions, Apple logo for iOS app sessions

---

## Rebuild Notes

### Component Breakdown

```
<AdminTeamPage>
  ├── <AppShell>
  │     ├── <PrimaryNavBar>          // dark charcoal bar; People/Inbox/Tasks/Calendar/Deals/Reporting/Admin links
  │     │     ├── <NavCollapseButton />
  │     │     ├── <NavItem icon="person">People</NavItem>
  │     │     ├── <NavItem icon="bell" badge={N}>Inbox</NavItem>
  │     │     ├── <NavItem icon="tasks">Tasks</NavItem>
  │     │     ├── <NavItem icon="calendar">Calendar</NavItem>
  │     │     ├── <NavItem icon="deals">Deals</NavItem>
  │     │     ├── <NavItem icon="chart">Reporting</NavItem>
  │     │     ├── <NavItem icon="gear" active>Admin</NavItem>
  │     │     ├── <GlobalSearchInput placeholder="Search" />
  │     │     └── <NavRightCluster>         // notification bell + avatar + other icons
  │     └── <AdminSubNav>            // white bar below primary nav
  │           ├── <SubNavTab>Overview</SubNavTab>
  │           ├── <SubNavTab>Lead Flow</SubNavTab>
  │           ├── <SubNavTab>Groups</SubNavTab>
  │           ├── <SubNavTab active>Team</SubNavTab>
  │           ├── <SubNavTab>Action Plans</SubNavTab>
  │           ├── <SubNavTab>Automations</SubNavTab>
  │           ├── <SubNavTab>Ponds</SubNavTab>
  │           ├── <SubNavTab>Email Templates</SubNavTab>
  │           ├── <SubNavTab>Text Templates</SubNavTab>
  │           ├── <SubNavTab>Import</SubNavTab>
  │           ├── <SubNavTab>Custom Fields</SubNavTab>
  │           ├── <SubNavTab>Stages</SubNavTab>
  │           ├── <SubNavTab>Phone Numbers</SubNavTab>
  │           ├── <SubNavTab>Tags</SubNavTab>
  │           ├── <SubNavTab>Integrations</SubNavTab>
  │           ├── <SubNavTab>Company</SubNavTab>
  │           ├── <SubNavTab>API</SubNavTab>
  │           ├── <SubNavTab>More ▼</SubNavTab>
  │           └── <HelpLink icon="?" href="...">How Teams work</HelpLink>
  └── <MainContent>
        ├── <TeamPageHeader>
        │     ├── <MemberCount>3 team members</MemberCount>
        │     └── <Button variant="primary" onClick={openAddModal}>+ Add Team Members</Button>
        └── <TeamMembersTable>
              ├── <TableHeader>
              │     └── columns: Name | Role | Phone | Connected Email | Connected MLS | Last Seen | Can Export | Pause Leads | Actions
              └── <TableBody>
                    ├── <TeamMemberRow member={mattRyan} />
                    ├── <TeamMemberRow member={rebeccaPeterson} />
                    └── <TeamMemberRow member={paulStevenson} />
```

### `<TeamMemberRow>` sub-elements:
```
<TeamMemberRow>
  ├── <NameCell>
  │     ├── <Avatar src={member.avatarUrl} size={36} />
  │     ├── <MemberName>{member.name}</MemberName>
  │     └── <MemberEmail truncate>{member.email}</MemberEmail>
  ├── <RoleCell>
  │     // If role === 'owner': plain text "Owner" (no dropdown)
  │     // Else: <RoleDropdown value={member.role} options={['Admin','Agent',...]} onChange={...} />
  ├── <PhoneCell>
  │     <PhoneIcon /> {member.phone}
  ├── <ConnectedEmailCell>
  │     <EmailIcon /> <TruncatedText>{member.connectedEmail}</TruncatedText>
  │     {member.emailConnected && <CheckIcon color="teal" />}
  │     {member.emailSyncActive && <SyncIcon color="teal" />}
  ├── <ConnectedMLSCell>
  │     {member.connectedMls ?? "Not connected"}
  ├── <LastSeenCell>
  │     <LastSeenRow platform="web" icon={<GlobeIcon />} time={member.lastSeenWeb} />
  │     <LastSeenRow platform="ios" icon={<AppleIcon />} time={member.lastSeenIos} />
  ├── <CanExportCell>
  │     <Checkbox checked={member.canExport} onChange={handleToggleCanExport} />
  ├── <PauseLeadsCell>
  │     <Checkbox checked={member.pauseLeads} onChange={handleTogglePauseLeads} />
  └── <ActionsCell>
        <ActionLink onClick={openEditModal}>Edit</ActionLink>
        {member.role !== 'owner' && (
          <ActionLink onClick={confirmDelete} variant="danger">Delete</ActionLink>
        )}
```

### Non-Obvious Logic

1. **Owner row restrictions:** The Owner is identified server-side and rendered with no role dropdown and no Delete action link. The frontend checks `member.role === 'owner'` (or `member.isOwner`) to conditionally suppress these controls.

2. **Can Export default:** Owner has `canExport: true` by default; Admin and Agent have `canExport: false` by default. Changing this toggles via an immediate API PATCH (no submit button).

3. **Pause Leads logic:** When checked, the system's lead-routing engine (round-robin or rule-based) skips this agent. The toggle also makes an immediate API PATCH.

4. **Role dropdown behavior:** The role change is applied immediately on selection (no confirm button), triggering a PATCH to `/api/v1/users/{id}` with `{ role: newRole }`. Changing a user to Owner would demote the current Owner — [INFERRED] FUB may prevent this or warn.

5. **Connected Email icons:** Two distinct states rendered side-by-side:
   - Checkmark (✓) = OAuth authorization granted / email address is linked
   - Sync icon (⚡ or ↻) = Ongoing sync is healthy and active
   If sync is broken, the sync icon would likely appear in red or with an error state [INFERRED].

6. **Connected MLS "Not connected":** All three members here show MLS as not connected, suggesting MLS integration (Spark, RETS, RESO) is configured at the account level but individual agent credentials/IDs haven't been linked per-broker.

7. **Last Seen timestamps:** Computed relative to current time at render. Both Web (browser) and iOS (mobile app) sessions are tracked separately, implying FUB logs session events per platform into the database.

8. **Member count label:** "3 team members" is a dynamic count derived from the table row count or a separate metadata field returned by the API endpoint for `/2/teams`.

9. **Horizontal overflow:** The table likely has a fixed `min-width` that exceeds narrow viewport widths, causing horizontal scroll. The table container uses `overflow-x: auto`.

10. **Delete confirmation modal [INFERRED]:** When Delete is clicked, a modal appears asking "Are you sure you want to remove [name] from the team?" with options for what happens to their leads (e.g., reassign to another agent, unassign, etc.).

11. **"+ Add Team Members" flow [INFERRED]:** The add flow likely sends an email invitation to the new member's email address. The new member clicks the link, sets up their password (or logs in via SSO/Google), and is added to the account. Before they accept, they may appear in a "Pending" state (not visible in this view, but likely exists).

12. **URL pattern:** `/2/teams` — account-scoped (`/2/`) routes are standard in FUB. The `teams` segment maps directly to this Admin > Team view.

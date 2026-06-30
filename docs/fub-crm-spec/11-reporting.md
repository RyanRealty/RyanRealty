# Module: Reporting & Analytics

The Reporting module is the analytics hub of Follow Up Boss — a structured set of 14 named reports (grouped under 11 sub-navigation tabs) that gives account owners, admins, and agents visibility into lead volume, communication activity, pipeline performance, and marketing attribution. Every report is filterable by agent, lead type, and date range; most emit CSV exports; all data is role-scoped so agents see only their own numbers. The in-house CRM must implement all 14 reports from real timeline, call, text, email, deal, and appointment data — this is the single biggest build gap relative to the current codebase (per §21 Gap Map). Styling: navy `#102742` / cream `#faf8f4`, Geist body + Amboqia display headings, shadcn/ui `@/components/ui/*` throughout. Brand-voice copy gate does not apply to this admin/internal surface; design-token gate does.

---

## 11.1 Shell: Reporting Layout & Sub-Navigation

### URL
`/crm/reporting` (root) and `/crm/reporting/{tab-slug}` per sub-tab.

### Top-Level Shell (inherited from CRM global nav)
The CRM global top nav bar renders above the Reporting module identically to all other modules. Within Reporting, the content area has two fixed regions before the scrollable body:

**Sub-navigation tab strip** (full-width, `~44px` tall, `border-b-1` separator below):
- Tabs left-to-right (all text links, `text-sm font-medium`):

| # | Tab label | URL slug | Report(s) accessible |
|---|---|---|---|
| 1 | Overview | `overview` | Navigation index (no data) |
| 2 | Agent Activity | `agent-activity` | Agent Activity report |
| 3 | Properties | `properties` | Properties report (map + list) |
| 4 | Lead Sources | `lead-sources` | Source Report + Speed To Lead + Contact Attempts + Closed Deals By Source (via "Show me" selector) |
| 5 | Calls | `calls` | Call Report + Call Logs (via "Show me" selector) |
| 6 | Texts | `texts` | Texts report |
| 7 | Batch Emails | `batch-emails` | Batch Emails report |
| 8 | Marketing | `marketing` | Marketing UTM Report |
| 9 | Deals | `deals` | Deals Report |
| 10 | Appointments | `appointments` | Appointments report |
| 11 | Agent Goals | `agent-goals` | Agent Goals report + goal editor |

- **Active tab style:** dark text (`text-foreground`), `border-b-2 border-primary` blue underline. All others: `text-muted-foreground`.
- **Right-aligned pill** (outside the tab group, `ml-auto`): `ⓘ How Reporting works` — outlined button, `variant="outline" size="sm"`, opens a help modal or documentation link. Text includes an info-circle icon on the left.
- **Tab strip has no overflow scroll on desktop.** On narrow viewports, horizontal scroll is applied.

### Loading State (per GIF analysis — critical build requirement)
Every tab click triggers a two-phase render. Do NOT use skeleton shimmer components in the content area.

**Phase 1 (immediate, synchronous):**
- Active tab indicator moves to the clicked tab instantly (before any data arrives).
- Page title / "Show me [X] ▼" query header renders from route config.
- Filter controls row renders (populated with current filter values).
- Content area below filters goes fully blank gray (`bg-muted` or `bg-[#f0f2f5]`).
- A thin orange/amber progress bar appears at the very bottom of the viewport (`fixed bottom-0 left-0 h-[3px] bg-amber-500 animate-loading-bar`).
- A centered spinner (`<Spinner />`) appears in the middle of the blank content area.

**Phase 2 (async, after data fetch, 0.5–1.5 s):**
- Full content renders: chart first, then KPI card row, then table. No fade transition — direct replace.
- Progress bar and spinner disappear.

---

## 11.2 Reporting Overview (Index / Hub Page)

**Tab:** Overview  
**Purpose:** Navigation directory of all 14 reports. Contains zero live data.

### Layout
Three-zone scrollable body (`bg-muted` light gray background, `~16px` padding):

#### Zone 1: "Agents" section
Section label: `"Agents"` — `text-sm text-muted-foreground font-medium uppercase tracking-wide mb-3`.

**7 report cards** in a 4-column CSS grid (`grid grid-cols-4 gap-4`):

| Card | Icon | Title | Description text (exact) |
|---|---|---|---|
| 1 | 👤📊 | Agent Activity | "See the number of leads per agent alongside stats on follow up." |
| 2 | 📞 (red phone SVG) | Calls | "See calls made, conversations, missed calls, talk time and more by agent." |
| 3 | 📋 (log/phone SVG) | Call Logs | "See and listen to recent inbound and outbound calls." |
| 4 | 💬 (speech bubble) | Texts | "See text message delivery rates and other stats by phone number." |
| 5 | 📅 (calendar SVG) | Appointments | "See a list of appointments & outcomes with details on lead source and agent." |
| 6 | 💰 (money bag) | Deals | "See a list of deals with commissions by deal stage and lead source." |
| 7 | 📝 (pencil/target) | Agent Goals | "Manage annual commission and personal goals for each agent." |

Cards 1–4 are in the first row; Cards 5–7 begin a second row (with Card 7 alone or continuing into the second row depending on column math at current viewport).

#### Zone 2: "Lead Sources" section
Section label: `"Lead Sources"` — same style as above.

**4 report cards:**

| Card | Icon | Title | Description text (exact) |
|---|---|---|---|
| 1 | 📊 (rising bar chart, red tint) | Source Report | "See your top lead providers and sources of appointments." |
| 2 | 🚀 (rocket/upward arrow, red) | Speed To Lead | "See how quickly you follow up by source and follow up type." |
| 3 | 📱 (mobile phone with signal bars) | Contact Attempts | "See how many times you follow up on average by source." |
| 4 | 🤓 (nerd face emoji — literal emoji character) | Closed Deals By Source | "See which lead source has the most closed deals, commission and conversion rate %." |

#### Zone 3: "Marketing" section
Section label: `"Marketing"` — same style.

**3 report cards:**

| Card | Icon | Title | Description text (exact) |
|---|---|---|---|
| 1 | 💌 (heart-letter / red email) | Batch Emails | "See the results of your email campaigns, opens & clicks." |
| 2 | 🏠 (house, green/teal tint) | Properties | "See which properties and zipcodes have the most inquiries." |
| 3 | 🔍 (magnifying glass, gray) | Marketing UTM Report | "See advanced UTM and campaign metrics and appointments & deals." |

### Report Card Component
```tsx
interface ReportCardProps {
  icon: string;        // emoji or custom SVG element
  title: string;       // bold, text-base (16px), text-foreground
  description: string; // text-sm (13–14px), text-muted-foreground, line-height 1.4
  href: string;        // navigates to corresponding tab route
}
// Style: bg-card, rounded-xl (~10px radius), shadow-sm, p-5, cursor-pointer, w-full
// Hover: shadow-md (inferred) — card surface is fully clickable (entire <a> or onClick)
// Icon: ~20–22px, sits above or inline-left of the title
// No count badges, no data, no active state — purely navigational
```

### Dual Navigation Note
Both clicking a card on the Overview AND clicking the corresponding sub-nav tab navigate to the same report route. The Overview is a visual index of the sub-nav tabs — both routes must resolve to identical pages.

### Non-Obvious: Card Count (14) vs Tab Count (10 report tabs + Overview)
The sub-nav has 11 tabs total but only 10 are report destinations. The Lead Sources tab hosts 4 reports (Source Report, Speed To Lead, Contact Attempts, Closed Deals By Source) switchable via the "Show me ▾" selector. The Calls tab hosts 2 reports (Call Report, Call Logs) via the same selector. The Overview is not a data tab. Total distinct report surfaces: 14 (matching the 14 cards).

### Acceptance Criteria — Overview
1. All 14 cards render with exact icon, title, and description text as specified above.
2. Clicking any card navigates to the correct sub-report (same as clicking the corresponding tab).
3. Section labels ("Agents", "Lead Sources", "Marketing") render with correct groupings.
4. No live data, no filters, no date pickers on the Overview — purely navigational.
5. "How Reporting works" pill button renders right-aligned in the tab strip.
6. The grid collapses from 4 columns to 2 or 1 on narrow viewports.

---

## 11.3 Interactive Page Title Pattern ("Show me [X] ▾")

This is a distinctive FUB UX pattern that appears on most data reports. **The page's `<h1>` IS an interactive query selector.**

### Render
```tsx
<button className="text-xl font-semibold text-foreground flex items-center gap-1">
  <span className="text-muted-foreground font-normal">Show me </span>
  <span className="text-primary underline">{currentQueryLabel}</span>
  <ChevronDown className="h-4 w-4 text-primary" />
</button>
```

The blue underlined variable text is the selected query mode. Clicking opens a dropdown/flyout listing alternate query modes for that report section. Changing the selection:
- Updates the page title text
- Re-fetches data with the new metric set
- Updates the chart primary metric
- Updates the KPI card row columns
- Updates the table columns

### Reports using this pattern
- Agent Activity: default `"total lead count and total agent activity"` + alternate: `"which team member has closed the most deals"`
- Properties: default `"which property has the most inquiries"` + alternate: Zip Codes view (per docs)
- Lead Sources: default `"total lead count and total activity by lead source"` + alternates covering 6 views (see §11.6)
- Calls: selector switches between "Call Report" and "Call Logs"

### Reports NOT using this pattern
- Batch Emails (plain title "Recent Batch Emails")
- Agent Goals (plain title "2026 Goals" + year selector only)
- Marketing (plain title "Marketing Report" + subtitle with inline cross-links)
- Deals (plain title; stage pill checkboxes are the filtering mechanism)
- Appointments (plain title)
- Texts (plain title)

---

## 11.4 Cache Notice Banner

Renders below the page title / filter controls row on all data-heavy reports (Agent Activity, Lead Sources, Calls, Texts, Properties, Deals, Appointments, Marketing):

```
"Reporting results may be cached for up to 10 minutes. [Refresh results.]"
```

- "Refresh results." is a clickable inline link (`text-primary underline cursor-pointer`).
- Clicking it bypasses the 10-minute cache and forces a fresh data fetch.
- The banner is `text-sm text-muted-foreground` — not a `<Alert>` component, just an inline paragraph.
- **Per FUB docs:** this is not a warning state — it is always present on these reports. Data freshness is eventual, not real-time.

---

## 11.5 Agent Activity Report

**Tab:** Agent Activity  
**URL:** `/crm/reporting/agent-activity`  
**Page title (interactive):** "Show me **total lead count and total agent activity** ▾"

### Filters Row (upper right)
Four filter controls rendered as a row of outlined dropdown buttons:

| Control | Default | Options |
|---|---|---|
| Agent selector | "Everyone ▾" | Everyone / Me / [individual brokers] / [teams] |
| Lead type | "Web leads ▾" | Web leads / Manual leads / All leads |
| Date range | "This Month ▾" | Today / This Week / This Month / This Year / Custom date range |
| Export | ↓ (icon button) | Triggers CSV export (requires `can_export` permission) |

### Chart Section
- **Type:** Area line chart (single trace or dual trace with comparison)
- **X-axis:** Date labels for the selected period (e.g., "Mon, Jun 1st, 2026" → "Tue, Jun 30th, 2026"), grouped by day/week/month
- **Y-axis:** Count (0–N, auto-scaled)
- **Controls row above chart (left-aligned):**
  - `[New Leads ▾]` — primary metric dropdown (what the chart plots)
  - `vs`
  - `[Select ▾]` — optional overlay metric dropdown
  - `[Daily ▾]` — granularity toggle (Daily / Weekly / Monthly)
  - `☐ Compare to previous period: {prior_period_date_range}` — checkbox; checking it overlays a second trace for the prior period. Pre-populates the prior period date range in the label (e.g., "Fri, May 1st, 2026 – Sat, May 30th, 2026").
- **Hover tooltip:** hovering a data point shows exact count + date (per FUB docs, also shows calculation details). Gray `?` help icons appear inline on the chart.

### KPI Card Row (horizontally scrolling)
A horizontal strip of metric tile cards (`flex overflow-x-auto gap-3`). Each tile:
```tsx
interface KPITileProps {
  label: string;           // UPPERCASE, text-xs, text-muted-foreground
  value: number | string;  // large, font-tabular-nums text-2xl font-semibold
  deltaPercent: string;    // e.g. "↓(99.5%)" or "↑445.5%" — signed arrow + parens
  deltaBaseline: number;   // "vs {N}" in text-muted-foreground
  sparkline?: number[];    // micro-sparkline chart (optional per tile)
  drillThroughLink?: string; // optional inline hyperlink inside the card body
}
```

**Exact KPI tiles visible (with real Ryan Realty data from GIF, "This Month" filter):**

| Tile label | Value (June 2026) | Delta |
|---|---|---|
| NEW LEADS | 25 | ↓(99.5%) vs 5,021 |
| INITIALLY ASSIGNED LEADS | 25 | ↓(99.5%) vs 5,021 |
| CURRENTLY ASSIGNED LEADS | 26 | ↓(99.5%) vs 5,021 |
| CALLS | 60 | ↑445.5% vs 11 |
| EMAILS | 103 | ↑35.5% vs 76 |
| TEXTS | 14 | ↓(80.8%) vs 73 |
| NOTES | 7,811 | ↑1579.8% vs 465 |
| TASKS COMPLETED | 2 | — |
| APPOINTMENTS SET | 0 | — |
| APPOINTMENTS | 0 | — |

Note: The CALLS KPI tile contains an embedded "Call Logs" hyperlink inside the card body — a drill-through link that navigates to the Call Logs sub-report. This is the only KPI card with an embedded navigation link.

**"+ Add Column" button** appears as a pseudo-tile at the right end of the KPI row. Clicking opens a column picker to add additional metric columns. The same "+ Add Column" button also appears at the right end of the agent table header row.

### Agent Breakdown Table

**Columns (exact, from GIF):**

| Column | Type | Notes |
|---|---|---|
| Agent | text | Avatar photo + full name. Sortable. |
| New Leads | numeric link | Blue hyperlink → filtered People list |
| Initially Assigned Leads | numeric link | Blue hyperlink |
| Currently Assigned Leads | numeric link | Blue hyperlink |
| Calls | numeric link | Blue hyperlink |
| Emails | numeric link | Blue hyperlink |
| Texts | numeric link | Blue hyperlink |
| Notes | numeric link | Blue hyperlink |
| Tasks Completed | numeric link | Blue hyperlink |
| Appointments Set | numeric | |
| Appointments | numeric | |
| [+ Add Column] | button | Trailing pseudo-column |

**All numeric values in blue** = hyperlinked drill-throughs to a filtered entity list (e.g., clicking Matt Ryan's "25" under New Leads opens People filtered to Matt Ryan's new leads this month).

**Real data rows (Ryan Realty, June 2026, "This Month"):**

| Agent | New Leads | Init Assigned | Curr Assigned | Calls | Emails | Texts | Notes | Tasks Done | Appts Set | Appts |
|---|---|---|---|---|---|---|---|---|---|---|
| Matt Ryan | 25 | 25 | 26 | 36 | 103 | 14 | 7,811 | 2 | 0 | 0 |
| Paul Stevenson | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Rebecca Peterson | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Column totals row** at the bottom: aggregate sum for each column + `% change` from prior period (per FUB docs).

### Metric Definitions (per FUB docs — critical for query logic)

| Metric | Definition |
|---|---|
| New Leads | Leads created in the period that are currently assigned to this agent |
| Initially Assigned Leads | Historical: leads first-assigned to this agent even if later reassigned |
| Currently Assigned Leads | Leads assigned to this agent during the period who are STILL assigned |
| Leads Not Acted On | Leads with zero outbound call, email, or text (1:1 personal only; automated/batch excluded) |
| Leads Not Called / Not Emailed / Not Texted | Subsets of unactioned (addable via "+ Add Column") |
| Calls / Emails / Texts / Notes | Personal 1:1 communications ONLY — automated action plans and batch emails are EXCLUDED |
| Tasks Completed | Tasks marked done by the agent in the period |
| Appointments Set | Appointments created by this agent (different from attending) |
| Appointments | Appointments where this agent is an attendee |
| Avg Speed to Action | Time from lead creation → first personal 1:1 contact (call, email, or text) |
| Avg Speed to First Call / Text / Email | Decomposed speed metrics (addable via "+ Add Column") |
| Contact Attempts | Avg calls + emails + texts per lead (personal 1:1 only; automated excluded) |
| Email / Phone / Text Response Rate | % of leads who replied to agent-generated outreach (automated excluded) |

**Critical query note:** Every metric that counts "calls," "emails," or "texts" MUST filter to `communication_type = 'personal_1to1'`. Automated action plan messages and batch emails are `communication_type = 'automated_marketing'` and are silently excluded from Agent Activity metrics. (They are NOT silently excluded from the Activity Leaderboard email count — this asymmetry is intentional and documented per FUB docs.)

### "Show me" Alternate View: Closed Deals by Agent
When the user selects "which team member has closed the most deals" from the "Show me" dropdown:
- Table pivots to: Agent Name | Closed Deals (count) | Commission Earned (from Agent Split field)
- Chart changes to show closed deal volume over the period
- KPI tiles update accordingly

### Data Model
```
crm_people        → agent_id, created_at, currently_assigned_agent_id
crm_timeline      → person_id, actor_id, event_type, communication_type, created_at
crm_tasks         → assignee_id, completed_at
crm_appointments  → created_by, attendees[], appointment_date
crm_deals         → agent_id, commission, stage_id, close_date
```

### Acceptance Criteria — Agent Activity
1. KPI card row renders all 10 base metrics with correct values from live data.
2. Numeric values are hyperlinked drill-throughs to filtered People lists.
3. "+ Add Column" opens a picker with available metric columns.
4. Chart renders time series for selected metric; "Compare to previous period" overlays prior period trace.
5. Granularity selector (Daily/Weekly/Monthly) changes the chart x-axis grouping.
6. "Everyone" filter scopes table to all agents; individual agent selection scopes to one row.
7. Agents see only their own row; admins/owners see all rows.
8. Cache notice banner renders below title with clickable "Refresh results" link.
9. "Show me" selector switches between Activity view and Closed Deals by Agent view.
10. Speed metrics exclude automated communications; only personal 1:1 counts.

---

## 11.6 Lead Sources Report

**Tab:** Lead Sources  
**URL:** `/crm/reporting/lead-sources`  
**Page title (interactive):** "Show me **total lead count and total activity by lead source** ▾"

### Six "Show me" Views (per FUB docs)

| View label | Columns |
|---|---|
| Total Lead Count & Activity (default) | New Leads, Calls, Emails, Texts, Notes, Tasks Completed, Appointments |
| Unacted Leads | New Leads, Not Acted On, Not Called, Not Emailed, Not Texted |
| Contact Attempts | New Leads, Avg Call Attempts, Avg Email Attempts, Avg Text Attempts |
| Lead Responses | % Responding by Email, % Responding by Phone, % Responding by Text |
| Deal Performance | Appointments, Conversion Rate, Deals Closed, Deal Value, Deal Commission |
| Website Activity | Registrations, Inquiries, Properties Viewed/Saved, Page Views, Visits |

Each view maps to a different column set in the breakdown table AND updates the KPI card row and chart.

### Filters Row
Same filter controls as Agent Activity: Everyone ▾ | Web leads ▾ | This Month ▾ | ↓ Export

### KPI Card Row (default "Total Lead Count & Activity" view, June 2026 Ryan Realty data)

| Tile | Value | Delta |
|---|---|---|
| NEW LEADS | 25 | ↓(99.5%) vs 5,021 |
| CALLS | 4 | ↓(55.6%) vs 9 |
| EMAILS | 107 | ↑35.4% vs 79 |
| TEXTS | 9 | ↓(60.9%) vs 23 |
| NOTES | 7,811 | ↑1579.8% vs 465 |
| TASKS COMPLETED | 2 | — |
| APPOINTMENTS | 0 | — |
| [+ Add Column] | — | — |

Note: The CALLS tile also has a "Call Logs" drill-through link embedded in the tile body (same pattern as Agent Activity).

### Lead Sources Breakdown Table

**Columns (default view):**

| Column | Notes |
|---|---|
| Name | Lead source label string |
| New Leads | numeric, blue hyperlink |
| Calls | numeric, blue hyperlink |
| Emails | numeric, blue hyperlink |
| Texts | numeric, blue hyperlink |
| Notes | numeric |
| Tasks Completed | numeric |
| Appointments | numeric |
| Actions | Trash icon — delete this lead source label (with confirmation dialog) |

**Important:** The Actions column with a trash/delete icon makes this table a **configuration surface**, not purely read-only. Clicking the trash icon should show a confirmation dialog before deleting the lead source label.

**Real production source names (Ryan Realty FUB, June 2026 — exact from GIF):**

| Source Name | New Leads | Calls | Emails | Texts | Notes | Tasks | Appts |
|---|---|---|---|---|---|---|---|
| `<unspecified>` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `AI- Claude` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `Cold Call` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `Company` | 0 | 0 | 4 | 0 | 213 | 1 | 0 |
| `County Assessor — West Side Bend 2026-05` | 0 | 0 | 0 | 0 | 6,571 | 0 | 0 |
| `Expired Listing` | 0 | 2 | 0 | 2 | 0 | 0 | 0 |
| `Expired Listing Cron` | 0 | 0 | 0 | 7 | 0 | 0 | 0 |
| `expired-listing-cron` | 12 | 0 | 25 | 0 | 23 | 0 | 0 |

**Deduplication issue visible:** "Expired Listing Cron" (capitalized) and "expired-listing-cron" (lowercase) are two separate source labels with different data — a naming inconsistency in the FUB instance. The in-house CRM should enforce normalized (lowercased or slug-form) source names at ingestion to prevent this.

### Speed To Lead Sub-Report (via "Show me" selector)

When the user selects a speed-focused view, the chart changes to show average speed over time and the table columns change to speed metrics per source:

| Metric | Definition (per FUB docs) |
|---|---|
| Avg Speed to Action | Time from lead creation → first 1:1 call/email/text from assigned agent |
| Avg Speed to First Call | Time → first outbound call from assigned agent |
| Avg Speed to First Text | Time → first outbound text |
| Avg Speed to First Email | Time → first outbound email |

**Critical rule:** Automated action plan messages and batch emails do NOT count toward speed metrics. Only the assigned agent's actions count — other team members' contact does not affect the speed metric for that assignment.

### Closed Deals By Source Sub-Report (via "Show me" → Deal Performance)

Columns (customizable via "+ Add Columns"):
- Lead Source name
- New Leads (count in period)
- Appointments (count)
- Average Contact Attempts
- Deals Closed (count)
- Deal Amount (total transaction value)
- Commission (total agent split)
- Lead Conversion % (deals closed / new leads × 100)

Chart: Bar or line comparing two values (default: deals count vs. deal amount) over monthly timeframes.

### Data Model
```
crm_people          → source, created_at, assigned_agent_id
crm_timeline        → person_id, actor_id, event_type, communication_type, created_at
crm_deals           → person_id, stage_id, close_date, price, commission
lead_source_labels  → id, name (configurable list; deletable)
```

### Acceptance Criteria — Lead Sources
1. Default view shows exact source names from `crm_people.source` field.
2. Six "Show me" views render correct column sets and recompute chart/KPIs on selection.
3. Trash icon per row opens a confirmation dialog and deletes the source label on confirm.
4. Speed metrics exclude automated messages; only assigned agent's personal 1:1 counts.
5. Blue hyperlinked counts drill through to filtered People list scoped to that source.
6. "+ Add Column" picker available.
7. Cache notice banner present.
8. Export to CSV respects active filters and `can_export` permission.

---

## 11.7 Calls Report

**Tab:** Calls (sub-report: "Call Report")  
**URL:** `/crm/reporting/calls`  
**Page title (interactive):** "Show me **call report** ▾"

### Filters Row
Agent: Everyone ▾ | Date: This Month ▾ | ↓ Export  
Note: No lead-type filter on this report (unlike Agent Activity and Lead Sources).

### KPI Card Row (unique metric set — different from all other reports)

Each tile shows a **dual-value format**: primary count + sub-label `"(N person/people)"` stacked beneath:

```tsx
// Dual-value KPI tile for Calls report
<div className="value">{count}</div>
<div className="sub text-muted-foreground text-xs">{n} {n === 1 ? 'person' : 'people'}</div>
```

**Exact tiles (Ryan Realty, June 2026 from GIF):**

| Tile | Count | Sub-label |
|---|---|---|
| CALLS MADE | 2 | 1 person |
| CONNECTED | 2 | 1 person |
| CONVERSATIONS | 1 | 1 person |
| RECEIVED | 34 | 2 people |
| CALLS MISSED | 3 | — |
| TALK TIME | 13 min 29 sec | — |
| ANSWER TIME | 0 sec | — |

### Metric Definitions (per FUB docs — exact)

| Metric | Definition |
|---|---|
| Calls Made | Total calls made (connected + non-connected outbound) |
| Connected | Calls lasting **1 or more minutes** |
| Conversations | Calls lasting **2 or more minutes** |
| Received | Total inbound calls including voicemails (from contacts AND unknown numbers) |
| Calls Missed | Incoming calls where no voicemail was left |
| Total Talk Time | Aggregate duration of all calls including voicemails |
| Answer Time | Average time before an incoming call is answered on the **desktop app** specifically |

**Connected vs Conversations distinction (critical):** A 90-second call is Connected but NOT a Conversation. These are two separate, distinct thresholds (1 min and 2 min) and must be stored as separate computed fields.

**Unknown callers:** Still counted in Received and Missed metrics even if not in the contact database.

### Display Convention (per FUB docs)

| Color | Meaning |
|---|---|
| Black numbers | Team totals / message counts |
| Blue numbers | Unique contact counts |

Clicking a blue number navigates to a filtered People list showing those contacts.

### Calls Breakdown Table

**Columns (from GIF — dual-value cell format):**

| Column | Format |
|---|---|
| Agent | Avatar + full name |
| Calls Made | `{count}` + `({n} person/people)` |
| Connected | `{count}` + `({n} person/people)` |
| Conversations | `{count}` + `({n} person/people)` |
| Received | `{count}` + `({n} person/people)` |
| Calls Missed | `{count}` |
| Total Talk Time | `{H}h {M}m {S}s` or `{M} min {S} sec` |
| Answer Time | `{avg_time}` or `—` |

**"—" (en-dash) renders for N/A cells** (agents with no call activity).

**Real data (Ryan Realty, June 2026):**

| Agent | Calls Made | Connected | Conversations | Received | Calls Missed | Total Talk Time | Answer Time |
|---|---|---|---|---|---|---|---|
| Matt Ryan | 2 / 1 person | 2 / 1 person | 1 / 1 person | 34 / 2 people | 3 / 0 | 13 min 29 sec | — |
| Paul Stevenson | 0 | 0 | 0 | 0 | 0 | — | — |
| Rebecca Peterson | 0 | 0 | 0 | 0 | 0 | — | — |

Columns are sortable ascending/descending.

### Plan Requirement
Call Reporting requires Grow, Pro, or Platform plan + 2 or more users with Calling enabled (per FUB docs). In the in-house CRM: requires Twilio integration active and at least one CRM phone number provisioned.

---

## 11.8 Call Logs Sub-Report

**Access:** Reporting > Calls > "Show me" selector → "Call Logs"  
Also accessible via the "Call Logs" drill-through link inside the CALLS KPI tile on Agent Activity and Lead Sources.

**Page title:** "Show me **call logs** ▾"

### Table Columns (per FUB docs — exact)

| Column | Details |
|---|---|
| Agent / Inbox | Agent name + FUB phone number (with inbox label if applicable). Manually logged calls omit the number. |
| Type | Icon representing call direction (inbound/outbound ↔) + outcome (answered ✓ / voicemail 📱 / missed ✗) |
| Person | Contact name (blue hyperlink → lead profile); unknown callers show phone number only |
| Time | Timestamp; hover reveals full datetime tooltip |
| Duration | Call length in minutes:seconds. Manually logged calls show no duration. |
| Inbox | Team Inbox or "My Inbox" association; links to conversation if active. Greyed-out = no access or outbound-only. |
| Actions | Listen to voicemail/recording (play icon) + download (download icon) |

**Sort order:** Newest to oldest by default.

**Filters:** Agent (admin on Platform can filter to everyone/single user/team; agents see own calls only) + Date range.

**Manual Call Logging:** Manually logged calls appear in the log but show no duration and no FUB phone number in the Agent/Inbox column. This is a documented difference from auto-logged calls.

### Acceptance Criteria — Calls + Call Logs
1. Seven KPI tiles with dual-value format (count + N person/people) render correctly.
2. Connected = calls ≥ 60 seconds; Conversations = calls ≥ 120 seconds — stored as separate boolean/computed fields.
3. Call Logs table renders with all 7 columns; play button streams/downloads audio from stored recording URL.
4. Unknown callers appear in Received and Missed counts; show phone number in Person column.
5. Sort order defaults to newest-first on Call Logs.
6. "Show me" selector toggles between Call Report (aggregate KPIs) and Call Logs (record-level table).
7. Agents see only their own call records; admins see all.
8. Export to CSV available.

---

## 11.9 Texts Report

**Tab:** Texts  
**URL:** `/crm/reporting/texts`  
**Page title:** "Show me **text report** ▾" (inferred)

### Purpose
Delivery rate monitoring and compliance coaching surface. Displays per-phone-number statistics.

### Columns / Metrics

| Metric | Definition (per FUB docs) |
|---|---|
| Texts Sent | Total outbound texts to leads |
| Texts Received | Total inbound texts from leads |
| Delivery Rate | % of sent texts successfully delivered (see tier thresholds below) |
| Opt-Outs | Count of recipients who opted out (STOP keyword response) |
| Carrier Filtered | Messages blocked by carriers as spam |
| Other Errors | Failures due to invalid numbers, landlines, or unregistered numbers |

### Delivery Rate Tiers (per FUB docs — exact values required for UI alert coloring)

| Tier | Rate | UI color treatment |
|---|---|---|
| Excellent | 97–100% | Green badge |
| Good | 95–96% | Green/neutral badge |
| Low | 90–94% | Amber/warning badge |
| Very Low | ≤89% | Red badge — signals carrier reputation risk + potential 10DLC compliance issue |

Very Low delivery rate should surface a visible alert with a link to compliance documentation.

### Display Convention
- **Black numbers:** message counts
- **Blue numbers:** unique contact counts (clickable → filtered People list)

### Permissions (per FUB docs)
- **Admin users:** Can access reports for ALL FUB numbers on the account
- **Agents:** Can view only their own FUB number's report

### Filters
Date range | Export to CSV available | Columns sortable ascending/descending

### Data Model
```
twilio_messages   → direction, to_number, from_number, status, created_at, contact_id
twilio_numbers    → id, number, assigned_agent_id
```
Delivery status from Twilio webhook callbacks (`delivered`, `failed`, `carrier_filtered`, etc.). Rolling delivery rate computed per agent per CRM number over the selected period.

### Acceptance Criteria — Texts
1. Delivery rate tiers render with correct color coding at exact percentage thresholds.
2. Very Low delivery rate surfaces a prominent warning.
3. Opt-Outs and Carrier Filtered counts are tracked separately from total failures.
4. Admin can filter to any agent's text report; agents see only their own.
5. Blue unique-contact counts are hyperlinked drill-throughs.

---

## 11.10 Appointments Report

**Tab:** Appointments  
**URL:** `/crm/reporting/appointments`

### Table Columns (per FUB docs — exact)

| Column | Notes |
|---|---|
| Title | Appointment name/label |
| People | Contact(s) associated with the appointment (linked names) |
| Team | Invitees from the internal team |
| Created By | Agent who created the appointment |
| Date / Time | Sortable (old-to-new or new-to-old); clicking sorts |
| Type | Appointment category (configured in Admin > Appointment Stages) |
| Outcome | Appointment result (configured in Admin > Appointment Stages) |
| Contact Lead Source | Lead source of the associated contact |
| Marketing Source | UTM/marketing attribution of the associated contact |

### Appointment Inclusion Rule (per FUB docs — critical)
An appointment appears in this report ONLY if it has **at least one lead profile selected as an invitee**. Appointments created directly in Google Calendar without a FUB contact invitee do NOT appear in this report. The in-house CRM must enforce: `appointment.contact_invitees.length >= 1` as the inclusion predicate.

### Filters
- Time Frame
- Agent (Users)
- Appointment Type
- Appointment Outcome

### Display Limit
**40 appointments per page maximum** (per FUB docs). Pagination required. Export to CSV recommended for larger datasets.

### Admin Configuration
Appointment types and outcomes are configured by the account owner in Admin > Appointment Stages. The report table values in Type and Outcome columns populate from these configured enumerations.

### Acceptance Criteria — Appointments
1. Table renders all 9 columns with correct data.
2. Appointments without a contact invitee are excluded from this report.
3. 40-record page limit with pagination.
4. Filter by Type and Outcome using the admin-configured enumerations.
5. Clicking column headers sorts ascending/descending.
6. Export to CSV available.

---

## 11.11 Deals Report

**Tab:** Deals  
**URL:** `/crm/reporting/deals`

### Three-Zone Layout (from GIF — fully observed)

#### Zone 1: Pipeline Funnel Strip (top)
A horizontal strip of stage pills. Each pill is a **checkbox + deal count + $total + $commission average**:

```
[☑] Start (temp stage)    0    $0 total ($0 avg)    $0 commission ($0 avg)
[☑] Buyer Contract        0    $0 total ($0 avg)    $0 commission ($0 avg)
[☑] Offer                 0    $0 total ($0 avg)    $0 commission ($0 avg)
[☑] Pending               {count}  ${total}         ${commission}
                                                    Closed Deals →  $5.8M total  $120.2K commission
```

- The checkboxes are **filter toggles** — unchecking a stage removes those deals from the chart and table below.
- The "Closed Deals" tile at the far right is a summary tile (non-checkbox) showing aggregate totals for the designated close stage.
- Stage pills are ordered left-to-right matching the pipeline stage order.
- "Add D..." button (Add Deal) renders top-right of the strip.

#### Zone 2: Dual-Metric Line Chart
- **Two independent metric selectors** above the chart: `[Deals ▾]` vs `[Price Total ▾]` — each opens a dropdown to change what that trace plots.
- Date selector: `[All time ▾]` — scopes the chart's x-axis (independent of the table's date filter).
- Single time-series chart with dual traces overlaid.

#### Zone 3: Deals Table

**Columns (exact from GIF):**

| Column | Notes |
|---|---|
| Name | Property address or deal name (blue hyperlink → deal detail page) |
| Stage | Current deal stage |
| Status | Always shows "Active" — confirmed in GIF and FUB API research (per MEMORY `reference_fub_deals_api_truth.md`): status field is always "Active"; stage truth lives in Stage + Entered Stage |
| Entered Stage | Date the deal entered its current stage |
| Time in Stage | Duration in current stage (e.g., "144 days") |
| Close Date ↓ | Close date (default sort column, descending) |
| Time to Close | Duration from deal creation to close |
| Price | Transaction price |
| Commission | Agent commission amount |

**Real data rows (Ryan Realty from GIF):**

| Name | Stage | Status | Entered Stage | Time in Stage | Close Date | Time to Close | Price | Commission |
|---|---|---|---|---|---|---|---|---|
| 19571 SW Simpson Ave | Pending | Active | Feb 5 2026 | 144 days | Mar 20 2026 | 50 days | $735K | $9.2K |
| 61260 Sunflower Ln | Lost | Active | Feb 26 2026 | 123 days | Feb 26 2026 | 38 days | $500K | $0 |
| 2680 Nordic Ave | Closed | Active | Oct 13 2025 | 259 days | Oct 10 2025 | 100 days | $1.4M | $33.8K |
| 703 SW 7th | Closed | Active | Sep 30 2025 | 272 days | Sep 30 2025 | 92 days | $355K | $8.9K |
| 61271 Kwinnum Dr | Closed | Active | Aug 27 2025 | 306 days | Aug 27 2025 | 56 days | $750K | $16.9K |
| 3480 SW 45th Street | Closed | Active | Aug 27 2025 | 307 days | Aug 14 2025 | 43 days | $650K | $16.3K |
| 3235 NW Cedar | Closed | Active | Jul 18 2025 | 346 days | Jul 14 2025 | 14 days | $530K | $13.3K |
| 2732 NW Ordway | Closed | Active | Aug 27 2025 | 306 days | Jun 9 2025 | — | $880K | $22K |
| 2680 Nordic Ave (2nd row) | Lost | Active | Jul 18 2025 | 346 days | — | — | $1.4M | $35.6K |

Note: Commission = $0 on "Lost" deals. "Time to Close" and "Close Date" show `—` for deals with no close date.

### Deal "Closed" Definition (per FUB docs — critical for leaderboard and report)
A deal qualifies as "closed" for reporting and leaderboard purposes when:
1. `deal.close_date` falls within the selected timeframe, AND
2. `deal.stage_id == pipeline.close_stage_id` (the stage designated as the close stage in pipeline settings)

Store `is_close_stage: boolean` on each pipeline stage record. Archived deals are still included if their close date is in range.

### Stage Transition Timestamps
For Time in Stage and the pipeline velocity report, store a `deal_stage_transitions` table:
```sql
deal_stage_transitions (
  id, deal_id, stage_id, entered_at, exited_at
)
```
Time in Stage = `NOW() - entered_at` for the current stage. Time to Close = `close_date - deal_created_at`.

### Filters (per FUB docs)
- Deal Stage (via pill checkboxes in the funnel strip)
- Deal Price
- Deal Close Date (chart-level)
- Pipeline (select specific pipeline or all)
- Agent (Users)

### Acceptance Criteria — Deals
1. Pipeline funnel strip renders stage pills with checkbox toggles, counts, and $totals.
2. Toggling a stage checkbox filters the chart and table dynamically.
3. "Closed Deals" summary tile renders aggregate totals for the close stage.
4. Table renders all 9 columns with correct sort (Close Date descending by default).
5. Commission = $0 on Lost/non-closed deals.
6. "Status" column always displays "Active" (reflecting FUB API behavior).
7. Deal name is a hyperlink to the deal detail page.
8. Stage transition timestamps stored to enable Time in Stage and Time to Close calculations.

---

## 11.12 Batch Emails Report

**Tab:** Batch Emails  
**URL:** `/crm/reporting/batch-emails`  
**Page title:** "Recent Batch Emails" (plain, non-interactive — NOT a "Show me" dropdown)

### Layout Differences vs Other Reports
- **No chart.** No KPI card row. No date filter. No agent filter.
- **Only one control:** a "Refresh" button (top-right, icon only — replaces the export icon on other reports).
- Minimal UI relative to other reports.

### Table Columns (per FUB docs — exact)

| Column | Definition |
|---|---|
| Subject | Email subject line + "From: {AgentName}" sub-line below |
| From | Sender agent name (or shown as sub-line under Subject) |
| Created | Date the batch email was sent (e.g., "Apr 9th '26") |
| Recipients | Count of unique email addresses targeted |
| Sent | Delivered count (excludes failures, unsubscribes, bounces) |
| Opens | Open count + % of recipients |
| Clicks | Link click count + % of recipients |
| Unsubscribes | Unsubscribe count + % |
| Bounces | Bounced count + % (per FUB docs — visible in table; may not have appeared in GIF) |
| Status | Enum: `sending` / `finished` / `failure` / `scheduled`. "(Details)" hyperlink appears inline in the Status cell for completed campaigns. |

**"(Details)" link** in the Status cell navigates to per-campaign analytics showing opens/clicks/unsubscribes per individual recipient. This is a drill-through to recipient-level data.

**Real subject lines (Ryan Realty production data, from GIF):**

| Subject | Created | Status |
|---|---|---|
| A neighbor update — 56628 Sunstone Loop at Caldera Springs | Apr 9th '26 | Finished (Details) |
| Since your showing — Sunstone Loop update | Apr 9th '26 | Finished (Details) |
| New listing at Sunstone Loop — fully turnkey | Apr 9th '26 | Finished (Details) |
| Your clients and Caldera Springs — worth 60 seconds | Apr 9th '26 | Finished (Details) |
| Will the housing 'stalemate' finally end in 2026? | Jan 7th '26 | Finished (Details) |
| A standout custom home at 56628 Sunstone Loop | Dec 18th '25 | Finished (Details) |

All from Matt Ryan (sole active sender as of June 2026).

### Display Limit
**100 most recent batch emails** visible in the UI (per FUB docs). Older history requires CSV export. The "Refresh" button re-fetches the list; there is no time filter.

### Open Rate Caveat (per FUB docs — required UI disclosure)
Open rates may be inflated by spam filter scans (server-side opens). The system should note this limitation near the Opens column header or in a tooltip: "Opens may be inflated by spam filter scans."

### Permissions
Admin users can filter to view other agents' batch emails. Agents see only their own. A filter control for agent selection should appear when the viewer is admin.

### Per-Campaign Detail Page
Clicking "(Details)" opens a per-campaign analytics page showing:
- Subject, From, Sent date, Status
- Aggregate stats: Total Recipients, Sent, Opens (count + %), Clicks (count + %), Unsubscribes (count + %), Bounces (count + %)
- Per-recipient table: contact name/email | sent ✓/✗ | opened ✓/✗ | clicked ✓/✗ | unsubscribed ✓/✗ | bounced ✓/✗

### Acceptance Criteria — Batch Emails
1. Table renders with 9 columns including Bounces (even if not visible in GIF — required per FUB docs).
2. "(Details)" link per row navigates to per-campaign recipient-level analytics.
3. "Refresh" button re-fetches the list without caching.
4. Display limit of 100 rows; older data requires export.
5. Open rate inflation caveat displayed near Opens column.
6. Admin can toggle to view other agents' campaigns; agents see own only.
7. No chart, no KPI tiles, no date filter on this report.

---

## 11.13 Agent Goals Report

**Tab:** Agent Goals  
**URL:** `/crm/reporting/agent-goals`  
**Page title:** "2026 Goals" (year-scoped, plain)

### Controls
**Year selector only:** `[2026 ▾]` — a `<Select>` dropdown in the top right showing calendar years. Changes the year scope for the entire report. No date range picker. No agent filter. **Data is locked to current calendar year; no custom date range available** (per FUB docs).

### Goals Summary Table

**Columns (from GIF — exact):**

| Column | Notes |
|---|---|
| Agent ↑ | Sortable; avatar + full name |
| Closed Deals | Count of deals in the close stage with close date in selected year |
| Upcoming Deals | Deals with future close dates not yet in the close stage |
| Commission Earned | Total agent split from closed deals YTD (from `deal.agent_split` field — NOT `deal.price`) |
| Commission Goal | Target; shows "Set goal" (blue inline hyperlink) when unset |
| Goal Progress | Progress bar rendered only when a goal is set; empty/blank when no goal configured |

**Real data (Ryan Realty, 2026, from GIF):**

| Agent | Closed Deals | Upcoming Deals | Commission Earned | Commission Goal | Goal Progress |
|---|---|---|---|---|---|
| Matt Ryan | 0 | 0 | $0 | Set goal | — |
| Paul Stevenson | 0 | 0 | $0 | Set goal | — |
| Rebecca Peterson | 0 | 0 | $0 | Set goal | — |

"Set goal" is an **inline blue hyperlink** (not a button, not a pre-filled input). Clicking it opens a goal-setting flow or modal for that agent.

### Commission Goal Critical Rule (per FUB docs)
Commission tracking pulls from the **`deal.agent_split` field**, NOT the total deal price. If `agent_split` is not filled in on a deal, that deal's commission does NOT appear in the goal report. This means a deal for $880K with no agent split filled in contributes $0 to commission earned.

### Goal Types (per FUB docs)

#### A. Commission Goals
- Financial target based on agent split commissions
- Tracks:
  - **Commission Earned:** Total `agent_split` from deals in close stage with close date YTD
  - **Pending Commission:** Total `agent_split` from deals with future close dates not yet in close stage
- Year-to-date only (no custom range)

#### B. Personal Goals
- Freeform custom objectives with text label + emoji
- Admin or agent can create, rearrange, and delete
- Manual checkbox for completion (displays crossed-out text when marked done)
- **Drag-to-reorder** via 8-dot handle on the left of each goal item
- Emoji customizable (defaults to trophy 🏆)
- Delete via trash icon
- These are reminders only — NO automatic progress tracking from CRM activity

#### Agent Overview Section
Shown when viewing an individual agent's goals (below the goals table):
- Name + contact info
- Deals closed (count, current year)
- Sales volume (total deal value, current year)
- Currently assigned leads (count)
- Unique conversations (2+ min calls, count, current year)
- Appointments held (count, current year)

### Permission Scope (per FUB docs)
- **Admins/Owners:** See all agents' goals
- **Agents:** See only their own goals
- **Lenders:** Explicitly excluded — no access to Agent Goals at any tier (per FUB docs)

### Acceptance Criteria — Agent Goals
1. Year selector defaults to current year; changing it refreshes data.
2. "Set goal" inline link opens a goal-setting modal per agent.
3. Progress bar renders only when a commission goal has been set.
4. Commission Earned pulls from `deal.agent_split`, not `deal.price`.
5. Personal goals support CRUD + drag-to-reorder + checkbox completion.
6. No custom date range — locked to calendar year.
7. Agents see only their own row; admins see all.
8. Lender role is blocked from this route.

---

## 11.14 Properties Report

**Tab:** Properties  
**URL:** `/crm/reporting/properties`  
**Page title (interactive):** "Show me **which property has the most inquiries** ▾"

### Layout: Split List + Map View
This is the ONLY map-based report in the module. Two-panel layout:

**Left panel (~35% width):** Ranked address list
- Each row: `{address}` — `{N} inq` (inquiry count)
- Ordered by inquiry count descending
- Clicking an inquiry count opens a Smart List of contacts who inquired on that property

**Right panel (~65% width):** Interactive map
- Google Maps (or Mapbox) embed centered on the account's service area (Central Oregon / Bend metro for Ryan Realty)
- Colored numbered markers at property locations indicating inquiry counts
- Clicking a map pin shows a popup with property address + inquiry count
- `[Map ▾]` view toggle button at top right of the map panel (toggles between map and table view, per docs — "Show me: Properties vs Zip Codes")

**Real properties visible (Ryan Realty, June 2026, from GIF):**
- 63094 NW Newhall Pl, Bend, OR 97703 — 1 inq
- 3735 Eagle Rd, Bend, OR 97701 — 1 inq
- 20310 Murphy Rd, Bend, OR 97702 — 1 inq
- 62285 Deer Trail Rd, Bend, OR 97701 — 1 inq
- 20889 SE Caldera Dr, Bend, OR 97702 — 1 inq

### "Show me" Selector Views
- Properties view: ranked by inquiry count per property address
- Zip Codes view: ranked by inquiry count per zip code

### Filters
Date: This Month ▾ (only — no agent filter, no lead-type filter on this report; unique among reports)

### Data Requirement (per FUB docs)
Properties only appear if property inquiries are sent directly to FUB from the lead source. FUB Pixel on the brokerage website is the recommended mechanism. Properties browsed on third-party sites without a FUB integration are invisible. The in-house CRM requires a `property_inquiry_events` table:
```sql
property_inquiry_events (
  id, property_address, zip_code, lat, lon, contact_id, event_type, created_at
)
```
Geocoding (lat/lon) is required for the map visualization.

### Acceptance Criteria — Properties
1. Split list + map view renders correctly with a real map embed.
2. Left panel ranks properties by inquiry count descending.
3. Map pins appear at geocoded property locations with inquiry count labels.
4. Clicking a map pin shows a popup (address + inquiry count).
5. Clicking an inquiry count on the left panel navigates to a filtered contact list.
6. "Show me" selector switches between Properties and Zip Codes views.
7. Only date filter is available (no agent or lead-type filter).

---

## 11.15 Marketing (UTM) Report

**Tab:** Marketing  
**URL:** `/crm/reporting/marketing`  
**Page title:** "Marketing Report" (plain)  
**Subtitle:** "Report based on UTM parameters, view Lead Source report for all sources" — contains two inline hyperlinks: "UTM parameters" (links to UTM settings or documentation) and "Lead Source report" (cross-tab navigation to the Lead Sources tab).

### Filters Row
↓ Export | `[All marketing ▾]` (marketing type toggle) | `[This Month ▾]` (date range)

### "Marketing Type" Toggle (per FUB docs)
Two attribution models:
- **All Touch:** Shows all marketing events tied to any lead (multi-touch attribution)
- **First Touch:** Original lead source only (last-touch not yet observed in FUB)

### UTM Fields Captured (6 fields per lead — per FUB docs)
| Field | Notes |
|---|---|
| Platform | Marketing source name |
| Source | UTM source parameter |
| Campaign | UTM campaign parameter |
| Term | UTM term parameter |
| Medium | UTM medium parameter |
| Content | UTM content parameter |

These display on individual lead profiles when hovering over the Marketing Source field. Automatic population: Google Ads, Bing Ads, Facebook Ads auto-populate UTM data. Other campaigns use a manual UTM builder.

### Table Columns (per FUB docs)

| Column | Definition |
|---|---|
| Platform | Marketing source / platform name |
| Leads | Contact count from that source (blue hyperlink → filtered contact list) |
| Appointments | Meetings generated from that source |
| Deals Closed | Closed transactions attributed to that source |
| Deal Value | Total revenue from closed deals per source |

### Data Model
```
crm_people   → utm_platform, utm_source, utm_campaign, utm_term, utm_medium, utm_content (6 fields, stored at lead ingestion)
crm_deals    → person_id, stage_id, close_date, price
crm_appointments → person_id, appointment_date, outcome
```

### Export Permission
Marketing Report CSV export is limited to **Account Owner only** (per FUB docs) — not available to all admins. Requires `user.role === 'owner'` gate on the export endpoint.

### Loading State Note
From GIF: the Marketing tab shows a loading state where the page title + subtitle + filter controls render immediately before data loads. The content area was blank in the recording (data did not finish loading in the GIF). The cross-link structure in the subtitle is visible during this loading phase.

### Acceptance Criteria — Marketing
1. Six UTM fields captured on lead ingestion and stored per lead record.
2. "All Touch" vs "First Touch" toggle changes the attribution model.
3. Table renders Platform, Leads, Appointments, Deals Closed, Deal Value.
4. Blue hyperlinked Leads count drills through to filtered contact list.
5. Export limited to Account Owner (not all admins).
6. Subtitle cross-links navigate to UTM settings and Lead Sources tab respectively.

---

## 11.16 Activity Leaderboard & Deals Leaderboard

**Access (per FUB docs):** Reporting > Leaderboards (not a visible sub-nav tab in the 11-tab strip — accessible via the "Show me" selector on Agent Activity, or as a separate Leaderboards section per FUB docs). The sub-nav tab for this was not observed in GIF/screenshots. Implement as a hidden sub-route or as an additional tab beyond the 11 shown.

### Activity Leaderboard Point System (per FUB docs — exact values)

| Activity | Points |
|---|---|
| Appointment Set (created inside the CRM) | **500 points** |
| Phone Conversation (CRM number, ≥ 2 min) | **100 points** |
| Phone Call Attempt (any length on CRM number) | **10 points** |
| Text Message Sent (outbound, CRM number) | **2 points** |
| Email Sent (outbound, CRM system) | **1 point** |

**Critical asymmetry:** Batch emails count as emails sent for leaderboard purposes (1 pt each) even though batch emails are **excluded** from Agent Activity contact metrics. These are different rules for different reports and must be implemented correctly.

**Conversation threshold:** Strictly ≥ 120 seconds on a CRM phone number. Call duration starts when the call is answered (by human OR by voicemail recording). External/personal calls not on a CRM number do not count.

**Appointment rule:** Only appointments created inside the CRM count (500 pts). Appointments imported from Google Calendar directly (without a CRM entry) score 0 pts.

### Activity Leaderboard Display
- Ranked list of agents by point total
- Date range options: Today / This Week / This Month / This Year / Custom (end-date = today)
- Team selector: "Everyone" or specific team
- Option to hide specific team members from display
- **Fullscreen mode:** for TV/big-screen display via casting, Apple TV, or Roku. Implement as a fullscreen CSS toggle.

### Deals Leaderboard
- Ranks agents by total closed deal VALUE (sum of deal prices — not deal count)
- Uses same closed deal definition: `deal.stage_id == pipeline.close_stage_id AND deal.close_date IN [range_start, range_end]`
- Archived deals are included if their close date is in range
- Date range: This Month / This Year / Year To Date / All-Time / Custom (end-date = today)
- Filters: Pipeline (all or specific) | People (individual or team) | Exclusion (hide specific users)
- Fullscreen mode for TV display

### Acceptance Criteria — Leaderboards
1. Activity Leaderboard computes points with exact values: 500 / 100 / 10 / 2 / 1.
2. Batch emails contribute 1 pt each to the leaderboard email count.
3. Call duration tracked from pickup (human or voicemail), not from dial.
4. Appointments created inside the CRM score 500 pts; external calendar entries score 0.
5. Deals Leaderboard ranks by deal VALUE (sum of `deal.price`), not deal count.
6. Archived deals are included in the Deals Leaderboard if close date is in range.
7. Both leaderboards support fullscreen TV display mode.

---

## 11.17 Weekly Business Insights Email

**Not a report tab but part of the reporting module (per FUB docs).**  
**Config path:** Admin > Company Settings > Business Insights section.

### Schedule
Every Monday morning (automated cron), covering the prior week.

### Content
- Account overview for the previous week
- Progress toward annual production goals (YTD sum of deal prices for all deals with close date Jan 1 → today)
- Clickable links that open the relevant report or list inside the CRM

### Prerequisites (per FUB docs — must enforce)
- "Real Estate" must be selected as the Industry in Company Settings — if not set, the email will NOT send. Implement a check: if `company.industry !== 'Real Estate'`, skip the cron job for this account.
- Only Admin users can configure recipients.

### Configuration
- Recipient list: team members selectable + any external email address (e.g., a business coach)
- Stored in `company_settings.business_insights_recipients: string[]`

### Acceptance Criteria — Weekly Insights Email
1. Cron runs every Monday morning.
2. Email only sends if `company.industry === 'Real Estate'`.
3. Email includes prior-week metrics and YTD production progress.
4. Recipient list supports both internal team members and external email addresses.
5. Links in the email deep-link back into the CRM's reports.

---

## 11.18 Export System

**Access:** Reporting > [any report] > ↓ Export button (downward arrow icon)

### Exportable Reports (per FUB docs)
1. Agent Activity Report
2. Lead Source Report
3. Calls Report
4. Marketing Report — **Account Owner only** (not all admins)
5. Deals Report
6. Appointment Report
7. Text Report

**Not exportable from UI** (but viewable in UI): Batch Emails (only accessible via Refresh button, no export icon), Agent Goals, Properties. Use export on the above 7 reports for data extraction.

### Process Flow
1. Navigate to report
2. Adjust filters, timeframe, and user scope
3. Click ↓ Export button
4. Column selection dialog opens (checkboxes for each available column)
5. Click "Export to CSV" — downloads `.csv` file

### Permission Model (per FUB docs)
- **`can_export` permission:** A separate boolean flag per user, toggled by the Account Owner in Admin > Team settings. It is NOT automatically granted with any role (including Admin).
- Export respects the user's role-based data scope (an agent with `can_export` can only export their own data, not all agents).
- Marketing Report export: Owner-only regardless of `can_export`.
- "Exporting never removes data from Follow Up Boss" (per FUB docs) — display this in the export confirmation.

### Implementation Note
Store `user.can_export: boolean` in the `brokers` or user settings table. The export endpoint must check both `can_export` AND role-based scope. For Marketing Report: also check `user.role === 'owner'`.

---

## 11.19 Role-Based Reporting Scope

All report data queries must enforce these scope rules at the database query level (not UI-level):

| Role | Report Scope |
|---|---|
| Account Owner | All team members' data |
| Admin | All team members' data |
| ISA / Account Team Lead | Their team's data only |
| Team Lead | Their team's data only |
| Agent | Their own data only |
| **Lender** | **Zero reporting access — hard block on all reporting routes** |

**Lender hard block:** The Lender role is explicitly excluded from ALL reporting in FUB documentation. Implement as a route-level guard: `if (user.role === 'lender') { return redirect('/crm') }` on the `/crm/reporting` root and all sub-routes.

**Export permission:** Separate boolean `can_export` per user, admin-controlled. Not tied to role alone.

**Teams-within-Teams:** Available on Platform tier only. Requires recursive team membership resolution for report scope queries.

**Deleted contacts:** Hard-deleting a contact permanently removes their statistics from all reports — no recovery. This is a documented FUB behavior with serious data implications. Implement soft-delete (stage = 'Trash') as the recommended workflow; surface a warning on hard-delete: "This will permanently remove this contact's activity from all reports."

**Removed team members:** Historical communication logs remain visible on individual contact profiles but are excluded from aggregated report totals going forward.

---

## 11.20 Data Touched

### Primary Read Entities
```
crm_people                    → source, created_at, assigned_agent_id, stage, tags, utm_* (6 fields)
crm_timeline                  → person_id, actor_id, event_type, communication_type, direction,
                                created_at, duration_seconds, delivered, opened, clicked
crm_tasks                     → assignee_id, completed_at, created_at
crm_appointments              → person_id[], team_invitees[], type, outcome, created_at,
                                created_by, appointment_date
crm_deals                     → person_id, agent_id, stage_id, close_date, price, agent_split,
                                is_archived, created_at
deal_stage_transitions        → deal_id, stage_id, entered_at, exited_at
crm_batch_emails              → subject, from_agent_id, created_at, status,
                                recipients_count, sent_count, opens_count, clicks_count,
                                unsubscribes_count, bounces_count
crm_batch_email_recipients    → batch_email_id, contact_id, sent, opened, clicked,
                                unsubscribed, bounced
property_inquiry_events       → property_address, zip_code, lat, lon, contact_id, created_at
twilio_messages               → direction, status, from_number, to_number, contact_id,
                                agent_id, created_at, duration_seconds
twilio_numbers                → id, number, assigned_agent_id
agent_goals                   → agent_id, year, commission_target, created_at
agent_personal_goals          → id, agent_id, year, label, emoji, completed, sort_order
brokers                       → id, role, can_export, team_id
pipeline_stages               → id, pipeline_id, name, sort_order, is_close_stage
lead_source_labels            → id, name (deletable)
company_settings              → industry, business_insights_recipients[], production_goal_ytd
```

### Primary Write Entities
```
agent_goals              → commission_target (set via "Set goal" link in Agent Goals)
agent_personal_goals     → CRUD + sort_order (drag-to-reorder, checkbox complete)
lead_source_labels       → DELETE (via trash icon in Lead Sources table)
company_settings         → business_insights_recipients (add/remove via Admin)
```

---

## 11.21 Prior Spec Errors Corrected (§12 of FUB_CRM_FEATURE_SPEC.md)

The prior spec in `docs/FUB_CRM_FEATURE_SPEC.md §12` was accurate in its broad strokes but had these gaps and errors that this spec corrects:

1. **Card count error:** Prior spec says "13 report cards" — **correct count is 14**. The prior spec missed "Call Logs" as a distinct card separate from "Calls."

2. **No "Show me" dropdown documented:** The prior spec says each card leads "to a dedicated report with its own date-range and filters (inferred)" — misses the critical "Show me [X] ▾" interactive page title pattern that is the primary query selector for Lead Sources (6 views), Calls (2 views), Agent Activity (2 views), and Properties (2 views).

3. **Deals "Status" column always "Active":** The prior spec does not flag this. GIF and MEMORY confirm the Status column always shows "Active" for all deals — stage truth lives in Stage + Entered Stage columns. The prior spec's `[illegible]` in this area resolves to "Active."

4. **No cache notice documented:** The prior spec omits the "Reporting results may be cached for up to 10 minutes. Refresh results." banner present on all data reports.

5. **Two-phase loading pattern not documented:** Prior spec omits the blank-content loading state (no skeleton shimmer) with immediate tab activation and deferred content render.

6. **No leaderboard point values:** Prior spec omits the Activity Leaderboard entirely. Exact values: 500 / 100 / 10 / 2 / 1.

7. **No role-based scope rules:** Prior spec omits the lender hard-block and the agent/admin/owner scope hierarchy for all reports.

8. **No delivery rate thresholds for Texts:** Prior spec omits the Excellent/Good/Low/Very Low tiers with exact percentages (97% / 95% / 90% / 89%).

9. **No display limits documented:** Prior spec omits the 40-appointment/page limit and the 100-batch-email display limit.

10. **No `can_export` permission:** Prior spec omits that export is a separate boolean permission per user, not automatic with any role.

11. **Marketing export is Owner-only:** Prior spec does not flag that the Marketing Report CSV export is limited to Account Owner (not all admins).

12. **Commission goal tracks `agent_split`, not `deal.price`:** Prior spec says "annual commission" goals without clarifying the source field. A deal with no `agent_split` filled in contributes $0 to the goal report.

13. **Lead Sources Actions column:** Prior spec describes Lead Sources as read-only. It is a hybrid read/config surface — the trash icon per source row deletes the source label.

14. **Properties report has no agent filter:** Prior spec implies standard filters. Properties has date-only filtering (no agent, no lead-type filter) — unique among all reports.

15. **Real source names with deduplication issue:** Prior spec has `[illegible]` for source names. GIF reveals exact names: `AI- Claude`, `County Assessor — West Side Bend 2026-05`, `Expired Listing Cron`, `expired-listing-cron` (two variants of the same cron with different capitalization — a real data quality issue in this FUB instance).

---

## 11.22 Biggest In-House Gap

The Reporting module is the **single largest unbuilt gap** between the current in-house CRM and FUB (confirmed in §21 Gap Map). The current codebase has partial reporting infrastructure at `/admin/crm/health` and a broker digest, but none of the 14 individual reports exist.

**Priority build order (based on usage data in the GIF and Ryan Realty's active patterns):**

1. **Agent Activity Report** — most complex; drives coaching; captures the 25-lead / 60-call / 7,811-note patterns visible in live data
2. **Lead Sources Report** — critical for attribution; reveals the `AI-Claude` + `expired-listing-cron` source deduplication issue that needs cleanup
3. **Deals Report** — pipeline visibility with the 3-zone layout (funnel + chart + table)
4. **Call Logs** — audio playback from Twilio recordings; already partially wired via `crm_timeline`
5. **Batch Emails** — simple flat table; relatively low complexity
6. **Agent Goals** — write-capable; simple but requires `agent_goals` table + personal goals drag-and-drop
7. **Properties (Map view)** — requires geocoding + map embed; nice-to-have for inquiry attribution
8. **All remaining reports** — Calls aggregate, Texts, Appointments, Marketing UTM

The Activity Leaderboard is a high-value motivational surface but requires a real-time point computation engine — defer until core reports are done.

---

## Sources

| Source | Content |
|---|---|
| `shot-32.md` | Reporting Overview hub — all 14 card descriptions, section groupings, sub-nav tab list, UI element inventory, card style, colors, typography |
| `reporting.md` (GIF) | 9 distinct report screens with real data: Deals Report (9 deal rows), Overview Hub, Agent Activity, Properties/Map, Lead Sources (8 source rows), Calls, Batch Emails, Agent Goals, Marketing loading state. 29 dynamic behaviors. "Show me" pattern, two-phase loading, dual-value Calls cells, Lead Sources delete column |
| `feat1.md` (GIF) | Additional frames: Agent Activity fully loaded (frame 15 — KPI values cross-check), Properties split view (frame 17 — 5 specific property addresses), Lead Sources (frame 19 — source names cross-check), Reporting Overview (frame 13), loading states (frames 14, 16, 18, 20) |
| `reporting.md` (FUB docs) | 26 help center articles. Exact leaderboard point values, role scope rules, lender hard-block, delivery rate tiers, display limits (40 appts / 100 batch emails), export permission model, Marketing export Owner-only, speed metric definitions, agent_split vs price for commission goals, deleted contact data loss, voicemail = answered for duration, April 4 2017 speed metric cutoff, appointment inclusion rule, archived deals in leaderboard, UTM 6-field list, Weekly Business Insights email prerequisites |
| `docs/FUB_CRM_FEATURE_SPEC.md §12` | Prior spec for error identification and correction (14 errors corrected above) |

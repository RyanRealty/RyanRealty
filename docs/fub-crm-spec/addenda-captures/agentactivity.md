<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §11 Reporting — Agent Activity report -->

# FUB Agent Activity Report — Exhaustive Buildable Spec
## For spec §11 Reporting

**Source images:** `fub-gif-frames/reporting/f04_*.png` (loaded state), `f02_full.png` (reporting overview index),  
`fub-docs/reporting.md` (official FUB help-center documentation, 26 articles),  
`fub-analysis/shot-32.md` (reporting overview UI analysis).  
**Date captured:** 2026-06-30. Account: Ryan Realty / matt@ryan-realty.com.  
**Active filters in capture:** Everyone · Web leads · This Month (Jun 1–30, 2026).

---

## 1. Page Location & Navigation

**Route in FUB:** `https://ryan-realty.followupboss.com/2/reporting/agent-activity` (or equivalent slug)  
**Entry points (two):**
1. Click "Agent Activity" sub-nav tab from any Reporting page.
2. Click "Agent Activity" card on the Reporting Overview index page.

**URL in in-house CRM:** `/admin/crm/reporting/agent-activity` (proposed)

---

## 2. Chrome + Sub-Navigation

### 2a. Application Top Nav Bar
Fixed, full-width, dark slate/charcoal `~#2d3748`.

| Position | Element | Type | Value |
|---|---|---|---|
| Left | People | Nav link | Inactive |
| Left | Inbox | Nav link | Inactive (red badge dot on icon) |
| Left | Tasks | Nav link | Inactive |
| Left | Calendar | Nav link | Inactive |
| Left | Deals | Nav link | Inactive |
| Left | Reporting | Nav link | **Active** (white text, chart icon) |
| Left | Admin | Nav link | Inactive |
| Center | Search | Input | Placeholder: "Search" |
| Right | Email icon | Icon button | Blue envelope |
| Right | Chat icon | Icon button | Purple speech bubble |
| Right | Admin/person icon | Icon button | Gray silhouette |
| Right | Notification bell + ▾ | Icon button + dropdown | Gray |
| Right | User avatar | Avatar button | Circular headshot (Matt Ryan) |

### 2b. Reporting Sub-Navigation Tab Bar
Sticky, full-width, white background, `border-bottom: 1px solid #e2e8f0`.  
Active tab indicator: `border-bottom: 2px solid #3182ce` (blue underline), dark text.  
Inactive tabs: gray `#718096` text.

Tabs left-to-right (exact labels):

| # | Label | State in capture |
|---|---|---|
| 1 | Overview | Inactive |
| 2 | Agent Activity | **Active** (blue underline, dark text) |
| 3 | Properties | Inactive |
| 4 | Lead Sources | Inactive |
| 5 | Calls | Inactive |
| 6 | Texts | Inactive |
| 7 | Batch Emails | Inactive |
| 8 | Marketing | Inactive |
| 9 | Deals | Inactive |
| 10 | Appointments | Inactive |
| 11 | Agent Goals | Inactive |

**Far right of tab bar:** `ⓘ How Reporting works` — outlined pill button, gray border + gray text + info circle icon, right-aligned via `margin-left: auto`. Opens help/documentation overlay.

---

## 3. Report Header — "Show Me" View Selector

### 3a. Sentence-style view selector
Positioned top-left of report content area, below the sub-nav tab bar.

```
Show me  [total lead count and total agent activity ▾]
```

- "Show me" — plain gray text (~14px, `#718096`)
- "total lead count and total agent activity ▾" — **blue/teal hyperlink-style text** with a trailing ▾ chevron
- Clicking the blue phrase opens a dropdown menu to switch report views

**Known dropdown options (from docs):**
| Option label | What it shows |
|---|---|
| total lead count and total agent activity | Default — KPI tiles + chart + per-agent table (all activity metrics) |
| which team member has closed the most deals | Pivots to Closed Deals by Agent view (agent name, deal count, commission earned) |

(Additional "Show Me" variants may exist per Six Views documented in Lead Sources report; Agent Activity specifically has at minimum these two documented options.)

### 3b. Cache notice
Below the view selector, small gray italic text:
```
Reporting results may be cached for up to 10 minutes.  Refresh results.
```
- "Refresh results." is a clickable blue link that forces a cache bypass and re-queries live data.
- Font: ~12px, `color: #a0aec0` or similar muted gray.

---

## 4. Filter Controls Bar

Positioned in the top-right of the content area, on the same horizontal band as (or just below) the "Show me" sentence. Rendered as a flex row, right-aligned.

### 4a. Export button
- Icon: downward-arrow / download glyph
- Style: light gray outlined icon button, no label text
- Click: opens column selection dialog → CSV export
- Permission gate: `user.can_export = true` (admin-controlled per-user toggle; not automatic with any role)

### 4b. Everyone ▾ — Agent filter
- Default value: **"Everyone"**
- Dropdown options: Everyone / Me / [Team names] / [Individual agent names]
- Scope by role:
  - Account Owner / Admin: can select Everyone or any individual
  - Team Lead / ISA: can only see their team's members
  - Agent: sees only their own data (dropdown locked to "Me")

### 4c. Web leads ▾ — Lead type filter
- Default value shown: **"Web leads"** (other options: Manual leads / All leads)
- Affects which leads are counted in all metrics and table values

### 4d. This Month ▾ — Date range filter
- Default: **"This Month"**
- Other options (from docs): Today / This week / This month / This year / Custom date range
- In capture: Jun 1–30, 2026

---

## 5. Chart Section

### 5a. Layout
Full-width area chart/line chart below the filter controls. White/very-light background, thin gray border or card treatment.

### 5b. Chart Controls (above the chart)
Left side of the chart header row:

**Metric A selector:**
```
[■ New Leads ▾]  vs  [Select ▾]
```
- Left pill: metric A — "New Leads" with a small colored square legend icon (blue) + dropdown chevron
- "vs" — gray separator text
- Right pill: metric B — "Select" + dropdown chevron (used for period-over-period or dual-metric overlays)
- Both are dropdown selectors for what the chart's two series display

**Granularity selector:**
```
[Daily ▾]
```
- Options: Daily / Weekly / Monthly
- Controls how the x-axis is grouped

**Right side of chart header row:**
- Checkbox (unchecked in capture): "Compare to previous period:"
- When unchecked: shows label "Fri, May 1st, 2026 - Sat, May 30th, 2026" (the would-be comparison window, greyed)
- Checking the box overlays the prior period's data as a second semi-transparent series on the chart

### 5c. Chart visualization
- Type: Area chart (line with light-blue fill below)
- Y-axis: numeric labels visible at `3` and `6` in capture (auto-scales to data range)
- X-axis: date labels on left ("Mon, Jun 1st, 2026") and right ("Tue, Jun 30th, 2026") endpoint labels; intermediate tick marks at regular intervals
- Series in capture: a single "New Leads" area series, blue fill `rgba(66, 153, 225, 0.2)` with blue line `#3182ce`
- Data points: small dots on the line at each date tick; hovering reveals a tooltip with exact value + date
- Shape: shows a spike pattern (peaks mid-month, lower at month start/end)
- The chart responds to the metric A/B selectors above it in real time

---

## 6. KPI Tile Strip

A horizontal scrolling row (or wrapping grid) of summary metric tiles below the chart. Each tile is a white card with `border-radius: ~8px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`, `padding: ~16px`.

### Tile anatomy (per tile)

```
[METRIC LABEL]                    [Optional: blue text link e.g. "Call Logs"]
[large numeric value]
[change indicator] vs [prior period value]
[sparkline — small inline area chart]
```

- **METRIC LABEL:** ~11px ALL CAPS, `color: #718096` (muted gray), tracked
- **Optional blue link:** e.g., "Call Logs" appears on the CALLS tile as a blue hyperlink navigating to the Call Logs sub-report
- **Large numeric value:** `~28–32px`, `font-weight: 700`, `color: #1a202c`
- **Change indicator:** `↑` or `↓` arrow, percentage in parentheses e.g. `↓(99.5%)`, then `vs 5,021` showing the prior period's absolute value. Arrow green for positive, red for negative. Change is in parentheses when negative (FUB convention).
- **Sparkline:** Small ~60×24px area/line chart, light blue, showing the trend for that metric over the selected period. No axis labels.

### Row 1 — 7 tiles visible (scroll right for more)

| # | Tile label | Captured value | Change indicator | Prior value | Optional link |
|---|---|---|---|---|---|
| 1 | NEW LEADS | **25** | ↓(99.5%) | vs 5,021 | — |
| 2 | INITIALLY ASSIGNED LEADS | **25** | ↓(99.5%) | vs 5,021 | — |
| 3 | CURRENTLY ASSIGNED LEADS | **26** | ↓(99.5%) | vs 5,021 | — |
| 4 | CALLS | **60** | ↑445.5% | vs 11 | "Call Logs" (blue link) |
| 5 | EMAILS | **103** | ↑35.5% | vs 76 | — |
| 6 | TEXTS | **14** | ↓(80.8%) | vs 73 | — |
| 7 | NOTES | **7,811** | ↑1579.8% | vs 465 | — |

**Note on CALLS tile:** The "Call Logs" link on tile 4 navigates to the Call Logs sub-report (a separate report view showing individual call records with playback). The CALLS tile itself shows aggregate call count across all agents for the period.

### Row 2 — 3 tiles + 1 "Add Columns" card

| # | Tile label | Captured value | Change indicator |
|---|---|---|---|
| 8 | TASKS COMPLETED | **2** | (sparkline visible, no % shown in capture) |
| 9 | APPOINTMENTS SET | **0** | — |
| 10 | APPOINTMENTS | **0** | — |

**"+ Add Columns" card:**
- Dashed border card, same size as a metric tile
- Centered text: "+ Add Columns" in gray/muted styling
- Click: opens a column picker panel/modal listing all available metrics not currently displayed
- Allows adding additional metric tiles to both the KPI strip AND corresponding columns to the agent table below
- The dashed border signals "additive / placeholder" state (ghost card pattern)

### Complete metric inventory (from docs — not all visible in capture)

Beyond the 10 tiles captured, these additional metrics are available via "+ Add Columns":
- LEADS NOT ACTED ON
- LEADS NOT CALLED
- LEADS NOT EMAILED
- LEADS NOT TEXTED
- AVG. SPEED TO ACTION
- AVG. SPEED TO FIRST CALL
- AVG. SPEED TO FIRST TEXT
- AVG. SPEED TO FIRST EMAIL
- AVG. CONTACT ATTEMPTS
- EMAIL RESPONSE RATE (%)
- PHONE RESPONSE RATE (%)
- TEXT RESPONSE RATE (%)

---

## 7. Agent Table

Positioned below the KPI tile strip. Full-width, white background, clean data table.

### 7a. Column headers (exact order in capture)

| # | Header label | Display notes |
|---|---|---|
| 1 | Name | Left-aligned, includes avatar + linked name |
| 2 | New Leads | Right-aligned numeric |
| 3 | Initially Assigned Leads | Right-aligned numeric |
| 4 | Currently Assigned Leads | Right-aligned numeric |
| 5 | Calls | Right-aligned numeric |
| 6 | Emails | Right-aligned numeric |
| 7 | Texts | Right-aligned numeric |
| 8 | Notes | Right-aligned numeric |
| 9 | Tasks Completed | Right-aligned numeric |
| 10 | Appointments Set | Right-aligned numeric |
| 11 | Appointments | Right-aligned numeric |

- Column headers: ~12px, `font-weight: 600`, `color: #4a5568` or `#718096`, sentence case
- Multi-word headers wrap within their column header cell (e.g., "Initially Assigned Leads" wraps over ~2 lines in the header)
- Columns are sortable (ascending/descending) — clicking a header sorts; active sort shown with arrow indicator

### 7b. Representative row — Matt Ryan

| Column | Value | Style |
|---|---|---|
| Name | ●avatar Matt Ryan | Avatar: ~24px circular headshot (man, brown hair). "Matt Ryan" as blue hyperlink — clicks through to agent detail/contact record |
| New Leads | 25 | Blue hyperlink — clicks through to filtered people list of those leads |
| Initially Assigned Leads | 25 | Blue hyperlink |
| Currently Assigned Leads | 26 | Blue hyperlink |
| Calls | 36 | Blue hyperlink |
| Emails | 103 | Blue hyperlink |
| Texts | 14 | Blue hyperlink |
| Notes | 7,811 | Blue hyperlink |
| Tasks Completed | 2 | Blue hyperlink |
| Appointments Set | 0 | Plain `0` (no link when zero, or still linked — verify) |
| Appointments | 0 | Plain `0` |

**Note:** Non-zero numeric values in blue link directly to a pre-filtered people list showing exactly which contacts contribute to that count. This is a core FUB interaction: every number in the table is a clickable drill-through, not just a display value.

### 7c. Row — Paul Stevenson

| Column | Value |
|---|---|
| Name | ●avatar Paul Stevenson (hyperlink) |
| All numeric columns | 0 (no blue link; zero values may render as plain text) |

### 7d. Row — Rebecca Peterson

| Column | Value |
|---|---|
| Name | ●avatar Rebecca Peterson (hyperlink) |
| All numeric columns | 0 |

### 7e. Table footer / totals
Not explicitly visible in captured frames. FUB documentation references "column totals row with % change from prior period" — a summary/totals row likely appears at the bottom of the table. Implement a sticky or pinned totals row with sum of each numeric column.

### 7f. Numeric value style notes
- **Blue (linked):** `color: #3182ce` (FUB link blue), `text-decoration: none`, cursor pointer, hover underline
- **Zero values:** `color: #4a5568` plain text (or gray `#a0aec0`), may not be linked
- **Large numbers:** comma-formatted (e.g., `7,811`)
- **Tabular numerals:** `font-variant-numeric: tabular-nums` for column alignment
- Row height: ~44–48px
- Row separator: `border-bottom: 1px solid #edf2f7`
- Alternating row backgrounds: not used (all white)
- Hover state: subtle `background: #f7fafc` on row hover

---

## 8. "Show Me" Alternate View — Closed Deals By Agent

When the "Show me" dropdown is changed to "which team member has closed the most deals":

**Table changes to:**

| Column | Description |
|---|---|
| Name | Agent name + avatar |
| Closed Deals | Count of deals in designated close stage with close_date in selected window |
| Commission | Total agent split (from deal's Agent Split field) |

**No chart, no KPI tiles** in this view — it's a pure tabular ranking.

**Filter controls still present:** Everyone ▾, lead type ▾, date range ▾.

---

## 9. Interaction Patterns

### 9a. Drill-through on numeric values
Clicking any non-zero numeric value in the agent table navigates to the People list pre-filtered to exactly those contacts. The filter parameters are constructed from: the agent row's broker, the column's metric, and the active date range / lead type filter. This is the most important interaction in the report.

### 9b. Sort
Every column header is clickable to sort the table ascending or descending. Default sort: by Name (alphabetical) or by a primary metric descending.

### 9c. Date range changes
Changing the date range filter (e.g., "This Month" → "This Year") re-queries all KPI tiles, the chart, and the agent table simultaneously. The "Compare to previous period" window label below the chart updates to match.

### 9d. Agent filter changes
"Everyone" → a specific agent collapses the table to one row (the selected agent) and updates all KPI tiles to that agent's numbers only. Admins use this to pull individual coaching reports.

### 9e. Lead type filter
"Web leads" → "All leads" includes manually-entered contacts in addition to web leads. "Manual leads" shows only manually-added contacts.

### 9f. Compare to previous period toggle
Checking the checkbox adds a second semi-transparent series to the chart (prior period) and adds a "% change" annotation to each KPI tile (visible in capture as ↑/↓ % vs prior period value). The prior period window label is always visible even when the checkbox is unchecked (to show what the comparison would be).

### 9g. Chart metric selector (metric A "vs" metric B)
Allows plotting two different metrics on the same chart axis. Example: "New Leads vs Calls" would show two lines. When only metric A is selected and metric B is "Select" (empty), only one series renders.

### 9h. Granularity toggle (Daily / Weekly / Monthly)
Changes the x-axis tick density and how data points are grouped. Daily shows every day; Weekly groups into 7-day bins; Monthly aggregates to full months.

### 9i. Call Logs link on CALLS tile
Clicking "Call Logs" text on the CALLS KPI tile navigates to the Call Logs sub-report (a separate record-level view with individual call rows, duration, and playback controls), pre-filtered to the same date range + agent filter.

### 9j. + Add Columns
Opens a column picker. Available columns are the full metric inventory listed in §6. Selected columns appear as new KPI tiles AND as new columns in the agent table. Columns persist per session (or possibly per user preference). The dashed "+ Add Columns" card is always the last element in the KPI tile row.

### 9k. Export
1. Click export icon
2. Column selection dialog opens (pre-selected: currently displayed columns)
3. Click "Export to CSV"
4. CSV downloads with: one row per agent, one column per selected metric, date range in filename or header row
5. Permission gate: only available if `user.can_export = true`

### 9l. Refresh results link
Clicking "Refresh results." clears the 10-minute cache and re-fetches all report data from the live database. Useful when agents want to see activity they just completed.

---

## 10. Metric Definitions (exact FUB spec)

### Lead Metrics

| Metric | Definition | Scope |
|---|---|---|
| New Leads | Leads created during the selected timeframe that are currently assigned to the agent | Current assignment |
| Initially Assigned Leads | Historical count — leads first-assigned to this agent in the window (even if later reassigned) | Historical |
| Currently Assigned Leads | Leads assigned to this agent during the timeframe who are still assigned to them | Point-in-time assignment |
| Leads Not Acted On | Leads with zero outbound calls, emails, or texts (excludes automated/marketing messages) | Uncontacted |
| Leads Not Called | Subset of Not Acted On — no outbound call from assigned agent | |
| Leads Not Emailed | Subset — no outbound email from assigned agent | |
| Leads Not Texted | Subset — no outbound text from assigned agent | |

### Communication Metrics (1:1 personal only — action plans and batch emails EXCLUDED)

| Metric | Definition |
|---|---|
| Calls | Inbound + outbound calls logged through the CRM phone number |
| Emails | 1:1 personal emails only (not batch email campaigns, not automated action plan sends) |
| Texts | 1:1 personal texts only (not automated/bulk) |
| Notes | Notes added to contact records by this agent |
| Tasks Completed | Tasks marked complete (any type) |
| Appointments Set | Appointments CREATED by the agent (different from attending) |
| Appointments | Appointments where the agent is an invitee/attendee |

### Speed Metrics (requires `first_personal_action_at` per lead-agent assignment)

| Metric | Definition |
|---|---|
| Avg. Speed to Action | Average time from lead creation to first contact of any type (call, email, or text) by the assigned agent |
| Avg. Speed to First Call | Average time from lead creation to first outbound call by assigned agent |
| Avg. Speed to First Text | Average time from lead creation to first outbound text by assigned agent |
| Avg. Speed to First Email | Average time from lead creation to first outbound email by assigned agent |

- Speed measures only the assigned agent's outreach. Other team members' contact attempts are excluded.
- Historical data cutoff: available only since April 4, 2017 in FUB (our system: from CRM go-live date).

### Response Rate Metrics

| Metric | Definition |
|---|---|
| Email Response Rate | % of leads who replied to a 1:1 agent email (action plan responses excluded) |
| Phone Response Rate | % of leads who picked up or called back after an outbound call attempt |
| Text Response Rate | % of leads who replied to an agent text |

### Contact Attempts Metric

```
avg_contact_attempts = SUM(personal_1to1 messages per lead) / COUNT(leads in period)
```

Example (from docs): 2 leads — lead A had 2 calls, lead B had 1 call → average = 1.5.

---

## 11. Role-Based Access Rules

| Role | Report Scope | Can change agent filter? |
|---|---|---|
| Account Owner | All agents | Yes — any agent or "Everyone" |
| Admin | All agents | Yes — any agent or "Everyone" |
| ISA / Account Team Lead | Their team's agents only | Yes, within their team |
| Team Lead | Their team's agents only | Yes, within their team |
| Agent | Own data only | No — locked to "Me" |
| Lender | **No access** | N/A — route blocked |

**Export permission:** Separate boolean flag `user.can_export`, toggled per-user by account owner in Admin > Team settings. Not automatic with any role. The export button is hidden or disabled if `can_export = false`.

---

## 12. Data Model Requirements for Rebuild

### 12a. Tables required

| Table | Purpose |
|---|---|
| `crm_people` | Lead records (count new leads, assigned leads) |
| `crm_timeline` | All communication events (calls, emails, texts, notes) |
| `crm_tasks` | Tasks completed count |
| `crm_appointments` | Appointments set + attended |
| `brokers` | Agent roster for the table rows + avatar URLs |

### 12b. Communication classification
Every `crm_timeline` event must carry `communication_type: 'personal_1to1' | 'automated_marketing'`.  
**Only `personal_1to1` events count** toward Calls, Emails, Texts, Notes, Leads Not Acted On, Contact Attempts, and Response Rates.  
`automated_marketing` events (action plan sends, batch emails) are excluded from all Agent Activity metrics.

### 12c. Lead assignment tracking
Requires a `crm_lead_assignments` table (or equivalent logic) to track:
- `lead_id`, `broker_id`, `assigned_at`, `unassigned_at` (nullable)
- "Initially Assigned" = first assignment ever
- "Currently Assigned" = assignment is still active (unassigned_at IS NULL) as of query time

### 12d. Speed metric fields
Store on each `crm_lead_assignments` record:
- `first_personal_action_at TIMESTAMPTZ` — updated when a `personal_1to1` event first fires from the assigned broker
- Reset to NULL when a lead is reassigned (new assignment gets a fresh speed clock)

### 12e. Unactioned lead flags
Per assignment record:
```sql
has_been_called   BOOLEAN DEFAULT FALSE
has_been_emailed  BOOLEAN DEFAULT FALSE
has_been_texted   BOOLEAN DEFAULT FALSE
```
Updated via trigger/event when a personal_1to1 communication fires from the assigned broker.

### 12f. Key queries

**KPI tile — New Leads (for agent or Everyone):**
```sql
SELECT COUNT(*)
FROM crm_people p
WHERE p.created_at BETWEEN :start AND :end
  AND (:broker_id IS NULL OR p.assigned_broker_id = :broker_id)
  AND (:lead_type = 'all' OR p.lead_type = :lead_type)
```

**KPI tile — Calls (personal_1to1 only):**
```sql
SELECT COUNT(*)
FROM crm_timeline t
WHERE t.event_type = 'call'
  AND t.communication_type = 'personal_1to1'
  AND t.created_at BETWEEN :start AND :end
  AND (:broker_id IS NULL OR t.actor_id = :broker_id)
```

**Sparkline data (for each tile):**
```sql
SELECT DATE_TRUNC(:granularity, created_at) as period, COUNT(*) as value
FROM crm_timeline
WHERE [same filters]
GROUP BY 1 ORDER BY 1
```

**Chart data (area chart):**
```sql
SELECT DATE_TRUNC(:granularity, ...) as period, COUNT(*) as metric_a_value
[, COUNT(*) as metric_b_value if dual-series]
FROM ...
GROUP BY 1 ORDER BY 1
```

**Agent table row:**
```sql
SELECT
  b.id, b.name, b.avatar_url,
  COUNT(DISTINCT CASE WHEN p.created_at BETWEEN :start AND :end THEN p.id END) AS new_leads,
  COUNT(DISTINCT la.lead_id) FILTER (WHERE la.is_initial) AS initially_assigned,
  COUNT(DISTINCT la.lead_id) FILTER (WHERE la.is_current) AS currently_assigned,
  COUNT(*) FILTER (WHERE t.event_type='call' AND t.communication_type='personal_1to1') AS calls,
  COUNT(*) FILTER (WHERE t.event_type='email' AND t.communication_type='personal_1to1') AS emails,
  COUNT(*) FILTER (WHERE t.event_type='sms' AND t.communication_type='personal_1to1') AS texts,
  COUNT(*) FILTER (WHERE t.event_type='note') AS notes,
  COUNT(*) FILTER (WHERE tk.completed_at BETWEEN :start AND :end) AS tasks_completed,
  COUNT(DISTINCT a.id) FILTER (WHERE a.created_by = b.id) AS appointments_set,
  COUNT(DISTINCT a.id) FILTER (WHERE :broker_id IN (SELECT ai.broker_id FROM crm_appointment_invitees ai WHERE ai.appointment_id = a.id)) AS appointments
FROM brokers b
LEFT JOIN crm_timeline t ON t.actor_id = b.id AND t.created_at BETWEEN :start AND :end
LEFT JOIN crm_lead_assignments la ON la.broker_id = b.id AND la.assigned_at BETWEEN :start AND :end
LEFT JOIN crm_tasks tk ON tk.assigned_to = b.id
LEFT JOIN crm_appointments a ON a.start_time BETWEEN :start AND :end
GROUP BY b.id, b.name, b.avatar_url
ORDER BY new_leads DESC
```

### 12g. "Totals" row
A row at the bottom of the agent table summing all numeric columns. Style: `font-weight: 600`, slightly different background `#f7fafc`, label in Name column: "Total" or "All agents".

---

## 13. Component Tree (React/Next.js)

```
<CrmReportingLayout>
  <ReportingSubNavTabs activeTab="agent-activity" />

  <AgentActivityReport>

    {/* Header row */}
    <ShowMeSelector
      value="total_lead_count_and_activity"
      onChange={handleViewChange}
      options={[
        { value: 'total_lead_count_and_activity', label: 'total lead count and total agent activity' },
        { value: 'closed_deals_by_agent', label: 'which team member has closed the most deals' },
      ]}
    />
    <CacheNotice onRefresh={refetch} />   {/* "may be cached 10 min. Refresh results." */}

    {/* Filter bar */}
    <ReportFilterBar>
      <ExportButton onClick={openExportDialog} disabled={!canExport} />
      <AgentFilterDropdown value={agentFilter} onChange={setAgentFilter} />   {/* Everyone | Me | [agent] */}
      <LeadTypeDropdown value={leadType} onChange={setLeadType} />            {/* All leads | Web leads | Manual leads */}
      <DateRangeDropdown value={dateRange} onChange={setDateRange} />         {/* Today | This week | This month | This year | Custom */}
    </ReportFilterBar>

    {/* Chart section */}
    <ReportChart>
      <ChartControls>
        <MetricSelector
          metricA={metricA} onChangeA={setMetricA}   {/* "New Leads" pill */}
          metricB={metricB} onChangeB={setMetricB}   {/* "Select" pill */}
          granularity={granularity} onChangeGranularity={setGranularity}  {/* Daily/Weekly/Monthly */}
        />
        <ComparePeriodToggle
          enabled={compareEnabled}
          onChange={setCompareEnabled}
          comparePeriodLabel={comparePeriodLabel}   {/* "Fri, May 1st ... Sat, May 30th, 2026" */}
        />
      </ChartControls>
      <AreaChart
        data={chartData}                 {/* [{period, metricA, metricB?}] */}
        compareData={compareChartData}   {/* prior period series, null if !compareEnabled */}
        granularity={granularity}
        xAxisStart={dateRange.start}
        xAxisEnd={dateRange.end}
      />
    </ReportChart>

    {/* KPI tile strip — row 1 */}
    <KpiTileRow>
      <KpiTile label="NEW LEADS" value={25} changePct={-99.5} priorValue={5021} sparklineData={...} />
      <KpiTile label="INITIALLY ASSIGNED LEADS" value={25} changePct={-99.5} priorValue={5021} sparklineData={...} />
      <KpiTile label="CURRENTLY ASSIGNED LEADS" value={26} changePct={-99.5} priorValue={5021} sparklineData={...} />
      <KpiTile label="CALLS" value={60} changePct={445.5} priorValue={11} sparklineData={...}
               auxiliaryLink={{ label: 'Call Logs', href: '/admin/crm/reporting/call-logs' }} />
      <KpiTile label="EMAILS" value={103} changePct={35.5} priorValue={76} sparklineData={...} />
      <KpiTile label="TEXTS" value={14} changePct={-80.8} priorValue={73} sparklineData={...} />
      <KpiTile label="NOTES" value={7811} changePct={1579.8} priorValue={465} sparklineData={...} />
    </KpiTileRow>

    {/* KPI tile strip — row 2 */}
    <KpiTileRow>
      <KpiTile label="TASKS COMPLETED" value={2} sparklineData={...} />
      <KpiTile label="APPOINTMENTS SET" value={0} />
      <KpiTile label="APPOINTMENTS" value={0} />
      <AddColumnsCard onClick={openColumnPicker} />   {/* dashed border ghost card */}
    </KpiTileRow>

    {/* Agent table */}
    <AgentActivityTable
      rows={[
        {
          broker: { id: 'matt', name: 'Matt Ryan', avatarUrl: '/images/brokers/ryan-matt.png' },
          newLeads: 25, initiallyAssigned: 25, currentlyAssigned: 26,
          calls: 36, emails: 103, texts: 14, notes: 7811,
          tasksCompleted: 2, appointmentsSet: 0, appointments: 0,
        },
        { broker: { id: 'paul', name: 'Paul Stevenson', avatarUrl: '/images/brokers/stevenson-paul.png' },
          newLeads: 0, initiallyAssigned: 0, currentlyAssigned: 0,
          calls: 0, emails: 0, texts: 0, notes: 0,
          tasksCompleted: 0, appointmentsSet: 0, appointments: 0 },
        { broker: { id: 'rebecca', name: 'Rebecca Peterson', avatarUrl: '/images/brokers/peterson-rebecca.png' },
          newLeads: 0, initiallyAssigned: 0, currentlyAssigned: 0,
          calls: 0, emails: 0, texts: 0, notes: 0,
          tasksCompleted: 0, appointmentsSet: 0, appointments: 0 },
      ]}
      onCellClick={handleDrillThrough}   {/* opens people list filtered to that metric */}
      totalsRow={true}
      sortable={true}
    />

  </AgentActivityReport>
</CrmReportingLayout>
```

---

## 14. KpiTile Component Spec

```tsx
interface KpiTileProps {
  label: string                    // ALL CAPS label, ~11px muted gray
  value: number                    // large number, comma-formatted
  changePct?: number               // signed float: positive = up, negative = down
  priorValue?: number              // absolute value of prior period for "vs N" display
  sparklineData?: number[]         // array of daily/weekly values for the mini chart
  auxiliaryLink?: {                // optional — shown on CALLS tile as "Call Logs"
    label: string
    href: string
  }
}

// Change indicator rendering:
// changePct > 0  → "↑ {changePct}% vs {priorValue}" in green
// changePct < 0  → "↓({Math.abs(changePct)}%) vs {priorValue}" in red  [FUB uses parens for negative]
// changePct undefined → no change row (tile shows value + sparkline only)
// value === 0 → still renders 0, change row may be hidden
```

---

## 15. AgentActivityTable Component Spec

```tsx
interface AgentRow {
  broker: {
    id: string
    name: string
    avatarUrl: string
    profileHref: string           // link to broker's contact/profile page
  }
  newLeads: number
  initiallyAssigned: number
  currentlyAssigned: number
  calls: number
  emails: number
  texts: number
  notes: number
  tasksCompleted: number
  appointmentsSet: number
  appointments: number
  // Additional optional columns added via "+ Add Columns":
  leadsNotActedOn?: number
  leadsNotCalled?: number
  leadsNotEmailed?: number
  leadsNotTexted?: number
  avgSpeedToAction?: string        // formatted duration, e.g. "2h 14m"
  avgSpeedToFirstCall?: string
  avgSpeedToFirstText?: string
  avgSpeedToFirstEmail?: string
  avgContactAttempts?: number      // one decimal, e.g. 1.5
  emailResponseRate?: number       // percentage
  phoneResponseRate?: number
  textResponseRate?: number
}

interface AgentActivityTableProps {
  rows: AgentRow[]
  onCellClick: (brokerId: string, metric: keyof AgentRow, value: number) => void
  // ^ navigates to /admin/crm?broker=<id>&metric=<metric>&dateStart=...&dateEnd=...
  totalsRow: boolean
  sortable: boolean
  defaultSortKey?: keyof AgentRow   // default: 'newLeads' descending
}
```

**Cell rendering rules:**
- `value > 0` → render as blue link `<button className="text-blue-500 hover:underline">{value.toLocaleString()}</button>`
- `value === 0` → render as plain `<span className="text-gray-400">0</span>` (no click)
- Name cell → `<div className="flex items-center gap-2"><Avatar src={avatarUrl} size={24} /><a href={profileHref} className="text-blue-500 hover:underline">{name}</a></div>`
- Totals row → plain `<span className="font-semibold">{value.toLocaleString()}</span>` (no link), `background: #f7fafc`

---

## 16. "Closed Deals By Agent" Alternate View Spec

Activated when "Show me" is changed to "which team member has closed the most deals".

**Table columns:**

| Column | Header label | Description |
|---|---|---|
| 1 | Name | Agent avatar + name (linked) |
| 2 | Closed Deals | Count of deals in the close stage with close_date in window |
| 3 | Commission | SUM(deal.agent_split) for qualifying deals |

**Close deal criteria:**
- `deal.stage_id = pipeline.close_stage_id` (whichever stage is flagged as the close stage)
- `deal.close_date BETWEEN :start AND :end`
- Archived deals are INCLUDED if they meet the date criteria

**No KPI tiles, no chart in this alternate view.**

**Filter controls remain:** Everyone ▾, lead type ▾, date range ▾.

---

## 17. Export Dialog Spec

Opens when export button is clicked (only if `user.can_export = true`).

```
[Export to CSV dialog]
─────────────────────────────────
Select columns to export:

[x] Name
[x] New Leads
[x] Initially Assigned Leads
[x] Currently Assigned Leads
[x] Calls
[x] Emails
[x] Texts
[x] Notes
[x] Tasks Completed
[x] Appointments Set
[x] Appointments
[ ] Leads Not Acted On
[ ] Leads Not Called
[ ] Leads Not Emailed
[ ] Leads Not Texted
[ ] Avg. Speed to Action
[ ] Avg. Speed to First Call
[ ] Avg. Speed to First Text
[ ] Avg. Speed to First Email
[ ] Avg. Contact Attempts
[ ] Email Response Rate
[ ] Phone Response Rate
[ ] Text Response Rate

          [Cancel]  [Export to CSV]
─────────────────────────────────
```

- Default checked: currently displayed columns
- CSV output: one row per agent, column headers match display labels, date range in first row or filename
- Numbers: no formatting (raw integers/floats, not comma-separated, for spreadsheet compatibility)
- Response rates: as decimal fractions or percentages (e.g. 0.45 or 45.0)

---

## 18. Caching & Data Freshness

**Cache TTL:** 10 minutes (matches FUB's documented behavior).  
**Implementation:** `unstable_cache` with `revalidate: 600` or Redis TTL.  
**Bust on:** "Refresh results." click → invalidate cache key for the current user+filter combination and re-fetch.  
**Cache key components:** `[agentFilter, leadType, dateRange.start, dateRange.end]`

---

## 19. Empty / Zero States

| Scenario | Rendering |
|---|---|
| Agent has 0 for every column | Row still shows (all zeros in gray text). Agent is not hidden. |
| No leads in selected period | KPI tiles show 0, chart shows flat line, table rows all-zero |
| No agents in account | Table shows empty state message |
| Report loading | Skeleton cards for each KPI tile (shimmer animation), skeleton rows in table |
| Cache error / fetch failure | Error state with retry button, no stale data shown |

---

## 20. Accessibility Notes

- KPI tiles must have aria-label: `"{label}: {value}, {changePct}% change from prior period"`
- Sparklines are decorative — `aria-hidden="true"`
- Table: proper `<th scope="col">` for all column headers
- Sortable columns: `aria-sort="ascending|descending|none"`
- All blue links: descriptive link text (not "25" alone — context from `aria-label` or `<title>`)
- Color-coded change indicators (green/red arrows) must not rely on color alone — the ↑/↓ arrow character carries the direction semantics

---

## 21. Discrepancies / Open Questions from Captured Data

1. **CALLS tile (60) vs Matt Ryan row (36):** The aggregate tile shows 60 calls but Matt's row shows 36 and Paul/Rebecca show 0. Sum of rows = 36 ≠ 60. Possible explanation: The tile may count ALL calls through the CRM number (including inbound from unknown numbers, or calls on non-lead contacts) while the table counts calls specifically on leads assigned during the window. Alternatively, a totals row below the visible frame accounts for the difference. **Implement tiles from a broader query, table rows from per-agent-per-lead-assignment scope.** Verify against FUB documentation: "Calls (inbound + outbound)" in docs may explain this.

2. **"vs 5,021" on New Leads, Initially Assigned, Currently Assigned tiles:** The prior period (May 2026) shows 5,021 leads while the current period shows 25. This appears to be a YoY or all-time total comparison rather than a month-over-month — or the comparison window is the entire account history to date vs. this month. Investigate the exact calculation of the "prior period" value when a date range is selected.

3. **NOTES = 7,811:** An unusually large number (7,811 notes in one month from Matt Ryan). This likely counts automated system notes, CRM-synced events, and status-change notes rather than just manual notes. Clarify whether the Notes column counts all `crm_timeline` notes events (including automated) or only manually authored notes.

4. **Scrollable tile row:** It is not confirmed whether the 7 tiles in row 1 require horizontal scrolling or all fit within the viewport. On a 1440px wide screen they likely fit without scroll; on 1280px they may require scroll or wrap to row 2. Implement as a horizontal scroll container with `overflow-x: auto` and no visible scrollbar on desktop.


> **Verify correction (2026-06-30):** the cache notice "Reporting results may be cached for up to 10 minutes. Refresh results." renders in uniform muted gray — "Refresh results." is NOT a distinct blue link (it's gray like the rest). Build it as plain muted text, not a hyperlink style.

<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.28.47 AM.png | Sequential id: shot-43 | Tiles: fub-tiles/shot-43_{full,q1,q2,q3,q4}.png -->

# shot-43 — Admin API Keys & Integrations Settings Page

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/api`
- **Browser tab title:** "API Key - Follow Up Boss"
- **Page/section title:** "API Keys"
- **Top-nav active item:** Not visible (the FUB top nav bar is not shown in this screenshot — the view appears to be a settings sub-page accessed from an Admin/Settings area; the URL path `/2/api` suggests this is under the account settings section, number `2` being the account identifier)
- **Sub-nav/tab active:** None visible — this page renders as a standalone settings card with no tab strip
- **Breadcrumbs:** None visible
- **Logged-in user (top-right):** Not directly visible in the content area; the browser chrome shows a Google Chrome profile avatar labeled "Work" in the top-right of the browser window
- **Account/brokerage name:** "Ryan Realty" (inferred from the account slug `ryan-realty` in the subdomain and from API key names like "Ryan Realty Platform", "Ryan Realty LP - Vercel")

---

## Layout

The viewport is divided into two horizontal regions:

### Left region — Gray background sidebar (~40% of viewport width)
- Solid medium light-gray background (~`#f0f0f2` / `#eeeef0` estimated)
- Contains no visible content or nav items in this screenshot — the FUB left rail navigation is either scrolled out of view or this portion of the page is the collapsed/background state of the settings left-nav
- Occupies the left ~40% of the total page width

### Right region — White content card (~60% of viewport width)
- White (`#ffffff`) background, presented as a card/panel
- Slightly inset from the left edge with a thin top-border separating it from any header above
- Contains all the interactive content: API keys table, OAuth section, lead email, lead processing toggle, API usage table
- This panel is **scrollable** — content extends below the visible fold (confirmed by the bottom scrollbar handle visible at the very bottom of q3 and q4 images)
- Content is padded with approximately 24–32px internal padding on all sides

### Overall page structure (top to bottom within the white card):
1. **API Keys section** — header row with section title + CTA button + API key management table
2. **Connected OAuth Applications section** — sub-section with empty state
3. **Lead Email Address section** — label + read-only input + helper text + team-members link
4. **Lead Processing section** — label + current account + ON/OFF toggle + description text
5. **API Usage Last 30 Days section** — section label + two-column usage table

### Floating elements:
- **Help button** — fixed-position circle "?" icon, bottom-right corner of the viewport

---

## Every UI Element (Exhaustive)

### Section 1 — API Keys

**Section header row:**
- Left: Section label text — `API Keys` (medium-weight, dark gray, ~16px)
- Center: Helper text — `To connect a new integration, create a new API key →` (lighter gray, ~13px, with a right-arrow character as punctuation)
- Right: Primary action button — `Create API Key` (filled teal/green button, rounded, ~`#4CAF50` or `#3ec7a0` estimated; white text, ~13-14px font, ~8px border-radius, ~8px vertical padding, ~16px horizontal padding)

**API Keys table:**

Columns (left to right):
1. **Name** — text, left-aligned, ~35% of table width
2. **API Key** — text, left-aligned, monospace masked value, ~30% of table width
3. **Created** — relative timestamp, left-aligned, ~15% of table width; this column has an **up-arrow sort indicator (↑)** indicating it is currently sorted ascending by Created date
4. **Last Used** — relative timestamp, left-aligned, ~15% of table width
5. **Actions** — icon buttons, right-aligned, ~5% of table width

Table rows (5 total):

| Name | API Key (masked) | Created | Last Used |
|------|-----------------|---------|-----------|
| Agent Fire | `**********v7Ip` | a year ago | a month ago |
| Zapier | `**********HjF6` | 7 months ago | a month ago |
| RyanRealtyApp | `**********T1tI` | 4 months ago | 10 hours ago |
| CLAUDE COWORK | `**********5dAb` | 3 months ago | 3 months ago |
| Ryan Realty LP - Vercel | `**********p1sH` | 2 months ago | 2 months ago |

**Row details:**
- API key values are masked with asterisks, showing only the last 4 characters: `v7Ip`, `HjF6`, `T1tI`, `5dAb`, `p1sH`
- The masking format is: 10 asterisks `**********` followed by 4 visible characters (total key preview is 14 characters wide)
- Each row has two action icons in the Actions column:
  - **Pencil/edit icon** — light gray outline pencil glyph; [INFERRED] opens a rename/edit modal for the API key
  - **Trash/delete icon** — light gray outline trash can glyph; [INFERRED] triggers a delete confirmation modal/dialog
- Row hover state: [INFERRED] likely shows a slightly darker row background
- No checkboxes, no bulk-action bar, no pagination controls visible — list is short enough to show all rows

**Table styling:**
- Thin horizontal divider lines between rows (light gray, ~`#e5e5e5`)
- Column headers in slightly lighter weight text than row content
- Rows have ~12–14px vertical padding
- Table has a top border and the full table sits within the white card; no outer border on the table itself

---

### Section 2 — Connected OAuth Applications

**Section label:** `Connected OAuth Applications` (medium-weight, dark gray, ~16px, same weight as "API Keys")

**OAuth table columns:**
1. **Name** — ~60% of table width
2. **Consented** — ~25% of table width
3. **Actions** — ~15% of table width

**Empty state:**
- Single row spanning all columns with centered text: `No OAuth applications have been connected yet.`
- Text color: medium gray (~`#888` or `#999`)
- No action button or CTA within the empty state row itself (the expectation is OAuth apps are connected via third-party "Connect" flows, not via a button on this page)

**Table styling:**
- Same thin horizontal divider lines as the API Keys table
- The empty-state row has a light-gray background or simply shows a light-bordered empty body
- Table has a bottom border

---

### Section 3 — Lead Email Address

**Layout:** Two-column label + content grid row

**Label (left column):** `Lead Email Address` (medium gray, ~13–14px, font-weight ~500)

**Content (right column):**
- Read-only text input field displaying: `ryan.realty@followupboss.me`
  - Field has a light border, white background, rounded corners (~4px border-radius)
  - Text is dark, standard body weight
  - Field appears to be a static/read-only display (not editable inline)
- **`Copy` button** — positioned at the right edge of the input field or immediately to its right; teal/blue text link style (`Copy`), no border, no background — clicking copies the email address to clipboard
- **"View all 2 team members" link** — teal/blue hyperlink text, appears below the input field on its own line; `View all 2 team members` — the number `2` indicates this FUB account has 2 team members total; [INFERRED] clicking navigates to the team members management page
- **Helper text** — smaller gray text (~12px) below the link:
  > "If you are using a non-Google account you can have your lead notifications sent to your unique @followupboss.me email address listed above. Learn More"
  - `Learn More` is a teal/blue hyperlink inline within the sentence

---

### Section 4 — Lead Processing

**Layout:** Two-column label + content grid row, same grid as Lead Email Address section

**Label (left column):** `Lead Processing` (medium gray, ~13–14px, font-weight ~500)

**Content (right column):**
- **Account identifier (bold):** `matt@ryan-realty.com (google)` — displayed in bold dark text, ~14px; indicates the Google account being monitored for lead notifications; `(google)` suffix in parentheses identifies the auth provider
- **Toggle switch** — positioned to the right of the account identifier on the same line:
  - Current state: **ON** (enabled)
  - Visual: pill-shaped toggle, green/teal fill (`#4CAF50` or similar) with white circular thumb positioned to the right
  - "ON" label text appears in white inside the toggle pill on the left side
  - Approximate dimensions: ~52px wide × ~24px tall
- **Description text** — smaller gray text below the bold account line:
  > "We will monitor your email inbox for new lead notifications and put them in Follow Up Boss automatically."
  - ~12–13px, light gray, ~`#666` or `#777`

---

### Section 5 — API Usage Last 30 Days

**Section label:** `API Usage Last 30 Days (all users)` (medium-weight, dark gray, ~14–15px)
- Note: `(all users)` qualifier in parentheses, same weight, indicates this shows aggregate usage across all team member API keys

**Usage table:**

Columns:
1. **System** — name of the API key / integration, left-aligned, ~70% of table width; header shown in lighter gray label style
2. **API Calls** — numeric count, right-aligned, ~30% of table width; column has a **down-arrow sort indicator (↓)** indicating sorted **descending** by API call count (highest usage first)

Rows (4 total, sorted by API Calls descending):

| System | API Calls |
|--------|-----------|
| ryanrealty-web | 62,036 |
| Ryan Realty Platform | 1,979 |
| ryan realty website | 218 |
| ryanrealty | 15 |

**Notes on data:**
- `ryanrealty-web` dominates with 62,036 calls — this is by far the highest-volume integration (likely the main website's CRM sync or lead capture pipeline)
- `Ryan Realty Platform` at 1,979 calls is the second most active (likely the Supabase/Next.js platform backend)
- `ryan realty website` at 218 calls is a separate lower-volume integration (possibly a different web property or staging environment)
- `ryanrealty` at 15 calls is minimal usage (possibly a direct API key for testing or a rarely-used integration)
- Numbers are displayed without comma formatting in the screenshot (shown as `62036`, `1979`, `218`, `15`)
- The "System" column header text is lighter/muted compared to the data rows

**Table styling:**
- Same divider-line pattern as other tables on the page
- Contained within a bordered card/sub-section within the white panel
- No pagination (small enough data set)

---

### Floating / Fixed UI Elements

**Help button (bottom-right):**
- Circle outline button with a `?` glyph inside
- Approximately 40px diameter
- Light teal/blue border and `?` character
- Fixed position at bottom-right corner of the viewport
- [INFERRED] Opens a help center chat widget or help documentation overlay

---

## Colors, Typography & Style

### Colors
- **Page background (left gray region):** ~`#eeeff1` or `#f0f1f3` — flat neutral gray
- **Content card background:** `#ffffff` — pure white
- **Table divider lines:** ~`#e5e7eb` or `#ebebeb` — very light gray
- **Section label text:** ~`#555` or `#5a5a5a` — medium gray
- **Body/row text:** ~`#333` or `#2d2d2d` — near-black dark gray
- **Muted/helper text:** ~`#777` or `#888888` — lighter gray
- **Hyperlinks:** ~`#3498db` or `#2a9fd6` (teal-blue) — used for "View all 2 team members", "Learn More", "Copy"
- **Primary CTA button:** ~`#4CAF50` or `#3ec7a0` (teal-green) fill with `#ffffff` text
- **Toggle ON state:** ~`#4CAF50` or `#38a169` green fill
- **Sort indicator arrows:** light gray icons inline with column headers
- **Action icon color (pencil + trash):** light gray (~`#aaa` or `#bbb`), likely darken on hover

### Typography
- **Section title text:** ~16px, font-weight 500 or 600, dark gray
- **Table column headers:** ~13px, font-weight 400–500, slightly muted gray
- **Table row data:** ~13–14px, font-weight 400, near-black
- **Bold identifiers (e.g. `matt@ryan-realty.com (google)`):** ~14px, font-weight 700
- **Helper text:** ~12–13px, font-weight 400, muted gray
- **CTA button text:** ~13–14px, font-weight 500–600, white
- **Font family:** System sans-serif or Inter/similar — clean geometric sans used throughout FUB UI

### Iconography
- **Edit (pencil):** Simple outline pencil icon, ~14×14px, light gray fill
- **Delete (trash):** Simple outline trash can icon, ~14×14px, light gray fill
- **Sort arrows:** Simple ↑ / ↓ unicode or inline SVG arrows in column headers
- **Help (?):** Outlined circle with question mark, ~40px total diameter, bottom-right fixed

### Component style
- No visible box-shadows on the white card in this view (flat style)
- Minimal border-radius (~4–6px on inputs and buttons)
- Very compact/dense table layout — tight row heights (~36–40px per row)
- Overall aesthetic: clean, low-contrast, functional admin UI with minimal decoration

### Bottom progress bar
- The "Getting Started" green progress bar that sometimes appears at the very bottom of FUB is **not visible** in this screenshot

---

## State & Data Shown

- **Current page/section:** API & Integrations settings for the Ryan Realty FUB account
- **Account slug:** `ryan-realty` (from subdomain)
- **API keys count:** 5 active API keys
- **OAuth apps:** 0 connected (empty state)
- **Lead email:** `ryan.realty@followupboss.me` (FUB-assigned unique inbound email for this account)
- **Team member count:** 2 (from "View all 2 team members" link)
- **Lead processing account:** `matt@ryan-realty.com` via Google OAuth
- **Lead processing status:** Enabled (toggle is ON)
- **API usage window:** Last 30 days, all users combined
- **API usage breakdown:**
  - `ryanrealty-web`: 62,036 calls
  - `Ryan Realty Platform`: 1,979 calls
  - `ryan realty website`: 218 calls
  - `ryanrealty`: 15 calls
  - Total: ~64,248 calls in last 30 days
- **API key sort order:** Created date, ascending (↑ on Created column) — oldest first
- **API Usage sort order:** API Calls, descending (↓ on API Calls column) — highest usage first
- **Active filter chips:** None
- **Selected items:** None

---

## Interactions & Behaviors

### API Keys Table
- **Clicking column header "Created" (with ↑ sort active):** Toggles sort direction to descending; clicking "Name" or "Last Used" would sort by those columns [INFERRED]
- **Clicking pencil/edit icon on a row:** [INFERRED] Opens an inline rename field or a small modal/popover allowing the user to rename the API key (the key value itself cannot be changed — only the label)
- **Clicking trash/delete icon on a row:** [INFERRED] Opens a confirmation dialog ("Are you sure you want to delete this API key? This will break any integrations using it.") with Cancel / Delete buttons
- **Clicking "Create API Key" button:** [INFERRED] Opens a modal dialog prompting for a name/label for the new key, then generates and displays the full API key value (shown once, copy-to-clipboard encouraged); after creation the new key appears in the table

### Connected OAuth Applications
- **No action button visible for adding OAuth apps** — OAuth connections are initiated from third-party app directories or from within other FUB settings sections (e.g., Integrations page) [INFERRED]

### Lead Email Address
- **Clicking "Copy" button:** Copies `ryan.realty@followupboss.me` to the clipboard; button may briefly show "Copied!" feedback [INFERRED]
- **Clicking "View all 2 team members":** [INFERRED] Navigates to `/2/team` or similar team management page showing all members and their individual @followupboss.me lead email addresses
- **Clicking "Learn More":** [INFERRED] Opens FUB help article about @followupboss.me lead forwarding in a new tab or help overlay

### Lead Processing Toggle
- **Clicking the ON toggle:** [INFERRED] Switches to OFF state (gray), stopping FUB from monitoring the connected Google inbox for lead notifications; likely shows a confirmation prompt or simply saves immediately
- **The account `matt@ryan-realty.com (google)` is a linked Google OAuth account** — changing which Google account monitors lead processing would be done via a separate OAuth reconnect flow [INFERRED]

### API Usage Table
- **Clicking "API Calls" column header (with ↓ sort active):** [INFERRED] Toggles to ascending sort; clicking "System" would sort alphabetically
- **Row click:** [INFERRED] No action on row click — this is a read-only analytics table; rows may be hyperlinked to a per-integration detail view or may be static
- The numbers represent aggregated API calls made by each named system in the last 30 days; "all users" parenthetical means it sums across every team member using that key [INFERRED]

### Help Button
- **Clicking "?" floating button:** [INFERRED] Opens an in-app chat/help widget (likely Intercom or similar), or opens the FUB help center knowledge base

---

## Data Model Signals

### Entities and Fields Revealed

**`api_keys` table:**
- `id` (internal)
- `account_id` (FK to account)
- `name` (string, user-assigned label — e.g. "Agent Fire", "Zapier", "RyanRealtyApp", "CLAUDE COWORK", "Ryan Realty LP - Vercel")
- `key_value` (string, sensitive — masked in UI, only last 4 chars shown)
- `created_at` (timestamp, displayed as relative "X ago")
- `last_used_at` (timestamp, displayed as relative "X ago"; nullable — key may never have been used)

**`oauth_applications` table:**
- `id`
- `account_id` (FK)
- `name` (string)
- `consented_at` (timestamp)
- Currently empty for this account

**`account_settings` / `account` table fields revealed:**
- `lead_email_address` (string, format: `<slug>@followupboss.me` — system-assigned, read-only)
- `lead_processing_enabled` (boolean — the toggle)
- `lead_processing_account` (string — email of the Google account being monitored, e.g. `matt@ryan-realty.com`)
- `lead_processing_provider` (enum: `google` | possibly `microsoft` | `other`)

**`api_usage_stats` / `api_calls_log` table:**
- `account_id`
- `system_name` (string — matches the API key `name` field)
- `call_count` (integer — aggregated over 30-day window)
- `period_start` / `period_end` (timestamps for the 30-day window)
- `aggregated_across_all_users` (boolean — the "(all users)" qualifier)

**Enum values revealed:**
- OAuth provider types: `google` (visible in `matt@ryan-realty.com (google)`)
- Lead processing providers: at minimum `google`; the help text says "if you are using a non-Google account" implying other providers exist

**Relationships:**
- Account → many API Keys (1:N)
- Account → many OAuth Applications (1:N, currently 0)
- Account → one Lead Email Address (1:1, system-assigned)
- Account → one Lead Processing configuration (1:1)
- Account → many API Usage Stats (1:N, by system name)
- API Key name → API Usage Stat system name (loose FK via string match)

---

## Rebuild Notes

### Component Breakdown

```
<AdminSettingsPage>
  <LeftSidebarBackground />          // gray #eeeff1, ~40% width, no content visible
  <SettingsContentCard>              // white card, scrollable, ~60% width, 24-32px padding

    <ApiKeysSection>
      <SectionHeader>
        <SectionTitle>API Keys</SectionTitle>
        <SectionHelperText>To connect a new integration, create a new API key →</SectionHelperText>
        <Button variant="primary" onClick={openCreateModal}>Create API Key</Button>
      </SectionHeader>
      <ApiKeysTable>
        <TableHeader>
          <Col label="Name" sortable />
          <Col label="API Key" />
          <Col label="Created" sortable sortDirection="asc" active />
          <Col label="Last Used" sortable />
          <Col label="Actions" />
        </TableHeader>
        <TableBody>
          {apiKeys.map(key => (
            <ApiKeyRow key={key.id}>
              <Cell>{key.name}</Cell>
              <Cell><MaskedApiKey value={key.value} visibleChars={4} /></Cell>
              <Cell><RelativeTime value={key.createdAt} /></Cell>
              <Cell><RelativeTime value={key.lastUsedAt} /></Cell>
              <Cell>
                <IconButton icon="pencil" onClick={() => openRenameModal(key)} />
                <IconButton icon="trash" onClick={() => openDeleteConfirm(key)} />
              </Cell>
            </ApiKeyRow>
          ))}
        </TableBody>
      </ApiKeysTable>
    </ApiKeysSection>

    <ConnectedOAuthSection>
      <SectionTitle>Connected OAuth Applications</SectionTitle>
      <OAuthTable>
        <TableHeader>
          <Col label="Name" />
          <Col label="Consented" />
          <Col label="Actions" />
        </TableHeader>
        <EmptyState message="No OAuth applications have been connected yet." />
      </OAuthTable>
    </ConnectedOAuthSection>

    <LeadEmailSection>
      <SettingsRow label="Lead Email Address">
        <ReadOnlyInput value="ryan.realty@followupboss.me" />
        <CopyButton targetValue="ryan.realty@followupboss.me" />
        <Link href="/2/team">View all 2 team members</Link>
        <HelperText>
          If you are using a non-Google account you can have your lead notifications
          sent to your unique @followupboss.me email address listed above.
          <ExternalLink href="...">Learn More</ExternalLink>
        </HelperText>
      </SettingsRow>
    </LeadEmailSection>

    <LeadProcessingSection>
      <SettingsRow label="Lead Processing">
        <BoldValue>matt@ryan-realty.com (google)</BoldValue>
        <Toggle checked={true} onChange={handleToggleLeadProcessing} label="ON" />
        <HelperText>
          We will monitor your email inbox for new lead notifications and put them
          in Follow Up Boss automatically.
        </HelperText>
      </SettingsRow>
    </LeadProcessingSection>

    <ApiUsageSection>
      <SectionTitle>API Usage Last 30 Days (all users)</SectionTitle>
      <ApiUsageTable>
        <TableHeader>
          <Col label="System" />
          <Col label="API Calls" sortable sortDirection="desc" active />
        </TableHeader>
        <TableBody>
          {usageStats.map(stat => (
            <UsageRow key={stat.system}>
              <Cell>{stat.systemName}</Cell>
              <Cell align="right">{stat.callCount.toLocaleString()}</Cell>
            </UsageRow>
          ))}
        </TableBody>
      </ApiUsageTable>
    </ApiUsageSection>

  </SettingsContentCard>

  <FloatingHelpButton />             // fixed bottom-right, ? icon in circle
</AdminSettingsPage>
```

### Non-Obvious Implementation Notes

1. **API key masking:** The key preview shows `**********` (10 asterisks) + last 4 characters. Store the full key hashed server-side; only expose the 4-char suffix and the full key once at creation time. Never re-expose the full key.

2. **`MaskedApiKey` component:** Renders as `**********XXXX` where X is a real character. May have a "reveal" button on hover [INFERRED not visible in screenshot].

3. **`RelativeTime` component:** Standard relative-time formatter (e.g. "a year ago", "7 months ago", "10 hours ago"). Uses a library like `date-fns/formatDistanceToNow` or `moment.fromNow()`. The specific phrasing "a year ago" (not "12 months ago") suggests the formatter rounds to years at that threshold.

4. **`SettingsRow` layout:** Two-column grid where the left column is a fixed-width label (~150–180px) and the right column is the content area. Used consistently for "Lead Email Address" and "Lead Processing" rows.

5. **`Toggle` component with embedded label:** The green toggle shows "ON" text inside the pill body. This is a custom toggle style (not a standard HTML checkbox). The label text "ON"/"OFF" renders inside the pill to the left of the thumb, switching side/text when toggled.

6. **`ConnectedOAuthSection` empty state:** The empty state is a table row spanning all columns with centered muted text. No CTA within the empty state — OAuth connections are managed elsewhere (third-party OAuth flows would redirect back to FUB after consent).

7. **Lead Email Address read-only field:** The `@followupboss.me` address is system-generated and cannot be changed by the user. It is the inbound email address FUB provides for lead forwarding. The subdomain/prefix (`ryan.realty`) appears to be based on the account slug + a period separator.

8. **"View all 2 team members" link count:** The `2` is a dynamic count from the account's team member roster. The link leads to a team management page where each member's individual @followupboss.me lead email is shown.

9. **API Usage table sorting:** Default sort is by "API Calls" descending (shows highest-usage integrations first). The "Created" sort ascending in the API Keys table (oldest first) allows tracking which integrations were set up in order.

10. **`(all users)` in API Usage title:** The usage aggregates all API keys across all team members. The "System" column corresponds to the API key `name` field — meaning the system names in the usage table are user-assigned labels, not auto-detected. This requires that the API key name be stored and associated with each API call log entry.

11. **Create API Key modal (not shown):** [INFERRED] Would include: a text input for the key name/label, a "Generate Key" or "Create" action, and then display of the newly generated key with a one-time copy-to-clipboard prompt ("Save this key — you won't be able to see it again").

12. **Page URL pattern:** `/2/api` — the `2` is an account-level identifier in FUB's routing, not a page version number. All admin/settings pages would share this prefix (e.g., `/2/team`, `/2/billing`).

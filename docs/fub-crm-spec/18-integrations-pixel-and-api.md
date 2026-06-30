# Integrations, Pixel & Public API

This section covers every developer-facing and integration surface in the FUB admin: the Admin > API settings page (API keys, OAuth apps, lead email, lead processing, usage analytics), the FUB Pixel (tracking JavaScript, form capture, Call To Action widget), the IDX & All Integrations catalog (connected badges, detail sub-pages, per-integration configuration), and the public REST API (base URL, authentication, key endpoints, webhooks, rate limiting, event types, pagination, error codes). It is the authoritative build spec for the Ryan Realty in-house CRM's equivalent surfaces. Styling uses the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist + Amboqia, shadcn/ui `@/components/ui/*`); FUB's blue/teal color language is replaced by the Ryan Realty token set throughout. Brand-voice copy gate does not apply to admin UI text.

---

## 18.1 Admin > API Settings (`/admin/api`)

### 18.1.1 Layout & Navigation Context

**Route:** `/admin/api`  
**Live account URL:** `ryan-realty.followupboss.com/2/api`  
**Browser tab title:** "API Key - Follow Up Boss"

The page lives within the Admin shell. The Admin sub-navigation tab bar is a full-width horizontal scrollable list. The tab marked **API** is active (teal/primary underline in FUB; maps to `border-b-2 border-primary` in the Ryan Realty design system). Tabs visible in the bar:

`Overview` · `Lead Flow` · `Groups` · `Team` · `Action Plans` · `Automations` · `Ponds` · `Email Templates` · `Text Templates` · `Import` · `Custom Fields` · `Stages` · `Phone Numbers` · `Tags` · `Integrations` · `Company` · **`API`** (active) · `More ▾`

Far-right of the tab bar, outside the scrollable list: a persistent **"ⓘ How API works"** link/button (outlined pill, info-circle icon prefix). Clicking opens FUB API documentation in a new tab. (inferred)

**Page heading** (inside content area): `⚙ API Settings` — gear icon glyph + "API Settings" in H1 weight.

**Layout:** Single-column content card (approximately 60–65% of viewport width, centered or left-aligned from ~240 px from left). Page background is light gray (`bg-muted`); the content card is white (`bg-card`). No sidebar on this admin sub-page — the tab bar handles all navigation.

**Floating help button:** Fixed bottom-right, approximately 44 px circle, `?` glyph, outlined style. (inferred: opens Intercom or help center)

### 18.1.2 Section 1 — API Keys

**Section label (left):** "API Keys" — `text-sm font-medium text-muted-foreground`

**Helper text (right, same row):** "To connect a new integration, create a new API key →" — gray, `text-sm`

**Primary action button (far right, same row):** `Create API Key` — filled pill button. In Ryan Realty design system: `bg-primary text-primary-foreground` rounded-full, ~130 px wide.

#### API Keys Table

White card with light `border-border` dividers between rows. No vertical dividers. Column widths approximate.

| Column | Width | Sort | Notes |
|---|---|---|---|
| **Name** | ~35% | None | User-assigned label, plain text |
| **API Key** | ~30% | None | Masked: `**********` + last 4 chars, monospace font |
| **Created** | ~15% | ↑ ascending (active default) | Relative timestamp ("a year ago", "7 months ago", etc.) |
| **Last Used** | ~15% | None | Relative timestamp; nullable (never used = blank or em-dash) |
| **Actions** | ~5% | None | Icon buttons, right-aligned |

**API Key masking format:** Exactly 10 asterisks (`**********`) followed by the last 4 alphanumeric characters of the key. The full key is shown ONLY once, at creation time. No "reveal" or "copy" affordance exists on the table row after initial creation.

**Observed rows (Ryan Realty production data — 5 keys total):**

| # | Name | API Key (masked) | Created | Last Used |
|---|---|---|---|---|
| 1 | Agent Fire | `**********v7Ip` | a year ago | a month ago |
| 2 | Zapier | `**********HjF6` | 7 months ago | a month ago |
| 3 | RyanRealtyApp | `**********T1tI` | 4 months ago | 10–11 hours ago |
| 4 | CLAUDE COWORK | `**********5dAb` | 3 months ago | 3 months ago |
| 5 | Ryan Realty LP - Vercel | `**********p1sH` | 2 months ago | 2 months ago |

**Default sort:** Created ascending (oldest first = Agent Fire at row 1). Note: this is the non-standard default — most apps sort newest first. Implement as the default; allow toggling by clicking the Created header.

**Per-row Actions (rightmost column):**
- **Pencil/edit icon** — 16 px outlined icon, `text-muted-foreground`. Clicking opens a rename modal for the key label only. The key value itself cannot be changed.
- **Trash/delete icon** — 16 px outlined icon, `text-muted-foreground`. Clicking opens a confirmation dialog: "Are you sure you want to delete this API key? Any integration using it will immediately lose access. This cannot be undone." Buttons: `Cancel` (secondary) | `Delete` (destructive/`bg-destructive`).
- Both icons spaced ~8 px apart; no labels.

**Row hover state:** (inferred) Slightly darker `bg-muted/40` background.

**No checkboxes, no bulk delete, no pagination** — list is short by design.

#### Create API Key Flow (modal — not directly captured but inferred from FUB docs)

1. Click "Create API Key" → modal opens.
2. Form field: **Name** (text input, required, placeholder: "Integration name") — label "Agent Fire", "Zapier", etc.
3. CTA: "Generate Key" or "Create" → server generates key.
4. **One-time reveal:** Full key displayed in a read-only field with a prominent "Copy to clipboard" button and a warning: "Copy this key now — you won't be able to see the full key again."
5. After copy/dismiss, modal closes and new row appears at the bottom of the table (masked, Created = "just now", Last Used = "—").

Per FUB docs: API keys grant access to ALL information in the FUB account. There is no granular scope control per key. Key access level matches the role of the user who created it.

**Special case (per FUB docs):** Accounts created before July 30, 2021 may have a "Default" API key. Deleting it logs the user out of mobile apps. Build an `is_default` flag on API key records to trigger a special warning on deletion.

**API Key Restriction Power-Up (per FUB docs):** An optional account-level setting disables new key creation entirely. Build as an `api_key_creation_disabled` boolean in account settings with an admin-only toggle. When enabled, "Create API Key" button is disabled or hidden.

### 18.1.3 Section 2 — Connected OAuth Applications

**Section label:** "Connected OAuth Applications" — same style as Section 1 label.

**OAuth table columns:**

| Column | Width |
|---|---|
| **Name** | ~60% |
| **Consented** | ~25% |
| **Actions** | ~15% |

**Empty state (observed — Ryan Realty has 0 OAuth apps):**

Single row spanning all columns, centered text: "No OAuth applications have been connected yet."  
Color: `text-muted-foreground`. No illustration. No CTA button.

OAuth applications connect via a separate OAuth Authorization Code Grant flow initiated from the third-party application side — there is no "Add OAuth App" button on this page. (per FUB docs)

When an OAuth app is present (non-empty state), each row has: Name (string), Consented date (relative timestamp), and Actions (likely a "Revoke" or "Disconnect" button — not observed directly). (inferred)

**OAuth vs API keys distinction:** API keys use HTTP Basic Auth (key as username, blank password). OAuth apps use Bearer tokens via Authorization Code Grant. They are separate auth mechanisms and appear in separate sections. (per FUB docs)

### 18.1.4 Section 3 — Lead Email Address

**Layout:** Two-column label + content grid row (left label ~150–180 px, right content fills remainder).

**Left label:** "Lead Email Address" — `text-sm font-medium text-muted-foreground`

**Right content — read-only field:** `ryan.realty@followupboss.me`
- Light border (`border-border`), `bg-muted/30`, rounded (`rounded-md`), ~4 px border-radius
- Text is dark, normal weight, non-editable
- Address format: `<account-slug>.<account-name-segment>@followupboss.me` (the in-house equivalent uses `@ryanrealty.app` or similar — define the domain at account creation)

**"Copy" button:** Ghost text button, `text-primary`, inline or immediately right of the field. On click: copies the email to clipboard; button text briefly changes to "Copied!" for ~2 seconds.

**Link below field:** `View all 2 team members` — `text-primary underline text-sm`. The number `2` is dynamic (count of users in the account). Clicking navigates to `/admin/team` or opens a modal listing each team member and their individual `@followupboss.me` lead email address. (inferred: each user has a unique address)

**Helper text (two lines, below link):**
> "If you are using a non-Google account you can have your lead notifications sent to your unique @followupboss.me email address listed above. **Learn More**"

- Font: `text-sm text-muted-foreground`
- "Learn More" is a `text-primary underline` inline link → opens FUB help docs in a new tab.

**Functional behavior (per FUB docs):**
- Any email forwarded to `ryan.realty@followupboss.me` whose body matches one of the three FUB email parser templates (Short, Full, or Advanced — see §18.5) is parsed and creates/updates a contact in FUB.
- The parser triggers lead-flow rules and action plans exactly as if the lead arrived via API.
- New leads are created; duplicates (matched by email or name+phone) update the existing contact.
- Leads are automatically assigned to the user whose address received the email.
- The account owner can see all team members' routing addresses via the "View all N team members" link.
- Gmail auto-forwarding setup: Admin > API → copy address → Gmail Settings > Forwarding > Add forwarding address → Google sends verification email → FUB forwards it to your login email → Create Gmail filter to forward matching leads.

### 18.1.5 Section 4 — Lead Processing

**Layout:** Two-column grid row, same structure as Section 3.

**Left label:** "Lead Processing" — `text-sm font-medium text-muted-foreground`

**Right content:**

**Account identifier (bold):** `matt@ryan-realty.com (google)`
- Font: `text-sm font-bold text-foreground`
- Format: `<email> (<provider>)` where provider = `google` | `microsoft` | other
- This is the Google-OAuth-connected inbox that FUB monitors.

**Toggle switch:** Positioned to the right of the account identifier on the same line.
- Current state: **ON** (enabled)
- Visual: pill-shaped toggle, ~52 px wide × ~24 px tall
- ON state: `bg-success` (or `bg-primary`) fill, white circular thumb right-aligned, "ON" label white text inside pill on left side
- OFF state: `bg-muted` gray fill, thumb left-aligned, "OFF" label (inferred)
- Clicking toggles immediately; likely shows a brief confirmation or saves optimistically.

**Helper text (below, ~12–13 px, muted):**
> "We will monitor your email inbox for new lead notifications and put them in Follow Up Boss automatically."

**Functional behavior (per FUB docs):**
- When ON: FUB scans the connected Gmail inbox for incoming lead notification emails from any detectable lead source and auto-creates contacts.
- Works indiscriminately — pulls leads from ALL detectable sources. For granular per-source control, use the `@followupboss.me` routing email approach instead.
- Activates automatically for account owners on email connection. Admins and agents must enable manually.
- The `(google)` provider label indicates the inbox is connected via Google OAuth (Gmail API), not IMAP/SMTP.
- Toggling OFF stops FUB from monitoring the inbox; new leads from email are not auto-created until re-enabled.

**Account change:** Swapping which Gmail account is monitored requires disconnecting and reconnecting via a separate OAuth reconnect flow — not an inline edit on this page. (inferred)

### 18.1.6 Section 5 — API Usage Last 30 Days (all users)

**Section label:** "API Usage Last 30 Days (all users)" — `text-sm font-semibold text-foreground`. The parenthetical "(all users)" indicates aggregate across all team member keys/integrations.

**Usage table:**

Column headers:
| Column | Sort |
|---|---|
| **System** | None (sortable by name — inferred) |
| **API Calls** | ↓ descending (active default — highest usage first) |

**Observed rows (Ryan Realty production data — 4 systems, ~30-day window from capture date ~2026-06-30):**

| # | System | API Calls |
|---|---|---|
| 1 | `ryanrealty-web` | 62,036 |
| 2 | `Ryan Realty Platform` | 1,979 |
| 3 | `ryan realty website` | 218 |
| 4 | `ryanrealty` | 15 |
| — | **Total** | **64,248** |

**Note on prior spec:** The prior spec (§15.9) only listed 2 of the 4 rows. All 4 are confirmed by shot-43 vision analysis. Correct the prior spec: `ryan realty website` (218) and `ryanrealty` (15) are real rows.

**"System" column semantics:** The string in the System column corresponds to the `name` field on the API keys table. Usage is aggregated per key name. This means the "System" column is user-assigned (not auto-detected). The usage tracking pipeline must store the key's name alongside each API call log entry.

**Relative bar chart (observed):** Each row has a horizontal gray bar in the System column area proportional to its call count. `ryanrealty-web` at 62,036 = full width (~70% of column); `Ryan Realty Platform` at 1,979 ≈ 3% width. Bar is decorative/non-interactive; no click on bars.

**Sorting:** Clicking "API Calls" header toggles ascending/descending. Clicking "System" sorts alphabetically.

**No pagination** — small dataset; show all rows.

**Data freshness:** 30-day rolling window ending now. Refresh on page load. No manual refresh button observed.

### 18.1.7 Data Model — API Settings Entities

```ts
// API Keys
interface ApiKey {
  id: string;                   // PK
  account_id: string;           // FK → accounts
  name: string;                 // user-assigned label ("Agent Fire", "Zapier", etc.)
  key_hash: string;             // bcrypt/SHA256 hash of full key — never stored plaintext
  key_suffix: string;           // last 4 chars of the full key (displayed in table)
  is_default: boolean;          // legacy "Default" key — special deletion warning
  created_at: Date;
  last_used_at: Date | null;
  created_by_user_id: string;   // FK → users
}

// OAuth Applications
interface OAuthApplication {
  id: string;
  account_id: string;
  name: string;
  consented_at: Date;
  access_token: string;         // encrypted
  refresh_token: string;        // encrypted
  scope: string;
}

// Account-level settings (subset)
interface AccountApiSettings {
  lead_email_address: string;       // "<slug>@<domain>.me" — system-assigned, read-only
  lead_processing_enabled: boolean;
  lead_processing_email: string;    // "matt@ryan-realty.com"
  lead_processing_provider: 'google' | 'microsoft' | 'other';
  api_key_creation_disabled: boolean; // Power-Up: disable new key creation
}

// API Usage Stats (aggregate)
interface ApiUsageStat {
  account_id: string;
  system_name: string;       // matches ApiKey.name
  call_count: number;        // 30-day rolling total
  window_start: Date;
  window_end: Date;
}

// API Call Log (raw, for aggregation)
interface ApiCallLog {
  id: string;
  account_id: string;
  api_key_id: string;
  system_name: string;       // denormalized from ApiKey.name at call time
  endpoint: string;
  method: string;
  called_at: Date;
  status_code: number;
}
```

### 18.1.8 Acceptance Criteria — API Settings

1. API Keys table renders all 5 observed Ryan Realty keys with correct masked format (`**********XXXX`) and relative timestamps.
2. "Create API Key" opens modal, accepts a name, generates a random key, displays it once in full with copy-to-clipboard, then closes and adds the masked row to the table.
3. Edit (pencil) icon opens rename modal; key suffix and created/last-used dates are preserved; key value is immutable.
4. Delete (trash) icon opens confirmation dialog; on confirm, key is removed; deletion of `is_default=true` key shows an additional warning about mobile app logout.
5. Created column sorts ascending/descending on header click (default: ascending = oldest first).
6. API Calls column sorts descending/ascending on header click (default: descending = highest first).
7. Connected OAuth Applications section shows empty state "No OAuth applications have been connected yet." when no apps are connected.
8. Lead Email Address is read-only (`@ryanrealty.app` or equivalent domain); Copy button copies to clipboard with "Copied!" feedback.
9. "View all N team members" link shows correct count and navigates to team member list.
10. Lead Processing toggle persists ON/OFF state; label shows connected email and provider; description text is shown below.
11. API Usage table shows all systems sorted by call count descending; totals match the 4 observed rows for Ryan Realty.
12. "ⓘ How API works" link in the sub-nav row opens documentation.
13. Floating "?" help button is fixed bottom-right on this page.

---

## 18.2 The FUB Pixel

### 18.2.1 Pixel in the Admin Overview

The Admin Overview (`/admin`) features a dedicated **Pixel** card in the **Integrations** section:
- **Icon:** sparkle/star
- **Title:** Pixel
- **Description:** "Track all your website activity to prioritize your follow up, use the CTA to increase leads."
- Clicking navigates to the Pixel detail page (not the Integrations catalog — a dedicated two-panel page).

### 18.2.2 Pixel Integration Detail Page (Two-Panel Layout)

**Route:** `/admin/integrations/pixel` (inferred from pattern)

This is NOT a modal. It is a full-page dedicated route with a two-panel layout (confirmed by GIF feat2 frame 25 and admin4 frames 10–14).

**Left panel (~30% viewport width):**
- FUB Pixel logo: colorful "P" or FUB chevron logo variant + "Pixel / by Follow Up Boss" wordmark
- **Category:** Website Tracking
- **Website:** followupboss.com (linked)
- **Description text:** "The Follow Up Boss Pixel lets you see who visited your website recently and what they did so you can follow up with them quickly, personalize your message and close more deals."
- **"< Go back"** link (bottom of panel) — returns to the Integrations grid.

**Right panel (~70% viewport width):**

Three sub-tabs: **Description** · **Tracking** · **Call To Action**

These are distinct from any other tab bar — they are local to the right panel of this detail page.

#### Description Tab (default active)

- Embedded video player, 1:39 duration, thumbnail with play button. Video title (per admin4 GIF): the general Pixel intro.
- Bullet points:
  1. "Get a real-time view of who's on your site, see all the pages your leads view and create awesome personalized emails/texts."
  2. "Drive more inbound leads with built-in Call To Action"
  3. "Retarget your database with emails that link to any of your sites and identify leads who respond even if they don't register on the site."
  4. "Automatically tag marketing sources so you can see which ones are working."
- Body text: "Pixel supports virtually any IDX website (even multiple websites) and installs in minutes."
- Footer text: "Full details and helpful videos on what the Pixel can do for you can be found in the help center."
- CTA button: "Follow Up Boss Pixel Settings" (`bg-primary text-primary-foreground`) — navigates to/scrolls to the Tracking or Settings sub-tab. (inferred)

#### Tracking Tab

**Route:** `/admin/integrations/pixel?tab=tracking` (inferred)

**Instructions text:**
> "You'll need to place the code below in the area of your websites that allows for JavaScript (usually the same place as Google Analytics) to be inserted."

**Help links:** "Check our help guides, reach out to your website developer, or contact our support team at support@followupboss.com."

**JavaScript code block (exact code for Ryan Realty FUB Pixel — Widget ID: `WT-QPDMEALA`):**
```html
<!-- begin Widget Tracker Code -->
<script>
!function(w,i,d,g,e,t){w["WidgetTrackerObject"]=g;
w[g]=w[g]||function(){(w[g].q=w[g].q||[]).push(arguments)},
{(w[g].d=new Date()),(e=d.createElement(e)),
(t=d.getElementsByTagName(e)[0]);t.async=1;t.src=i;
e.parentNode.insertBefore(t,e)}}
(window,"https://widgetbe.com/agent",document,"widgetTracker");
window.widgetTracker("create","WT-QPDMEALA");
window.widgetTracker("send","pageview");
</script>
<!-- end Widget Tracker Code -->
```

- Code block is displayed in a `<pre>` or syntax-highlighted box, read-only.
- **"Copy code"** button (`bg-primary text-primary-foreground`) — copies the full snippet to clipboard.
- Inline instruction: "and paste on your website inside the `<head>` tag"
- Secondary link: "Or email your web developer instructions" — opens a mailto or send-instructions modal. (inferred)

**Toggle — Form Capture:**
- Label: "Enable form capture and creating new leads in FUB"
- Current state: **OFF** (gray toggle)
- Sub-text: "If you already receive leads from your website via API or email it's best practice to leave this off."
- **Critical note:** Ryan Realty has this toggle OFF because leads arrive via API integration. Enabling it with API also active would cause duplicate contact creation. (per FUB docs)

**Tracking status line:**
- Text: "Waiting for tracking activity on your website"
- An animated spinner/dot indicating the system is waiting for the first Pixel event to fire.
- This status changes to "Active" once the Pixel successfully fires a page view. (inferred)

**Footer link:** "Need help with Follow Up Boss Pixel?" — links to help docs.

**Pixel behavior (per FUB docs):**
- One Pixel code per team account. Same code tracks multiple websites; FUB distinguishes by domain automatically.
- Identifies returning visitors via `?email=EMAILADDRESS` URL parameter appended to outbound email links.
- Tracks: page views, property interactions (viewed/saved), form submissions (when form capture enabled), source attribution.
- Fires `eventsCreated` webhooks on activity.
- Form capture iFrame limitation: if the website form is inside an iframe and the Pixel code is outside the iframe, form submissions cannot be tracked.
- **Do NOT install on Real Geeks (2-way integration) or Ylopo sites** — conflicts with lead creation.
- Agents cannot access the Pixel code directly — admins only, one code per team.

**Widget ID format:** `WT-XXXXXXXX` (alphanumeric, 8 chars). Ryan Realty's production ID: `WT-QPDMEALA`.

#### Call To Action Tab

**Route:** `/admin/integrations/pixel?tab=cta` (inferred)

**Header line:** "Increase incoming calls and texts from your website - Learn More" (linked)

##### WEBSITE OPTIONS section

**Live desktop widget preview (rendered iframe-style card):**
- Matt Ryan's circular headshot photo
- "Matt Ryan" name
- "Do you have questions? Call or text today, we are here to help!" — body copy
- Phone number: **`541-703-3095`** (FUB-tracked number, NOT the direct `541-213-6706`)
- X close button (top right of widget)
- Widget positioned bottom-right of preview area

**Toggle — "Display on desktop website":** ON (enabled) — Ryan Realty has desktop widget enabled.

**Live mobile widget preview (rendered card):**
- Simplified popup with two buttons: "Call" (phone icon) | "Text" (message icon)
- "Matt" label with circular headshot thumbnail
- X close button

**Toggle — "Display on mobile website":** ON (enabled)

##### DISPLAY OPTIONS section (radio buttons)

**Option 1 (selected by default):** "Display assigned agent information. If not assigned, use this number:" → text input field for a fallback number.

**Option 2:** "Display only this number:" → "Select Number" dropdown for picking a fixed number to show all visitors.

**TCPA disclaimer text (visible in scrolled state of the widget preview):**
> "...agree to be contacted by [business_name] via text, call & email. To opt-out, reply 'stop' or click unsubscribe."

This disclaimer auto-appears in the widget — not configurable (per FUB docs: Terms of Service text displayed for unassigned new leads; disappears once lead is assigned).

**CTA widget display logic (per FUB docs):**
1. Initial state (visitor not identified): Generic CTA with team phone number.
2. After lead identification (clicked tracked email link / registered): Personalized CTA with assigned agent's photo and name.
3. Unassigned new leads: Terms of Service displayed on desktop; widget disappears once lead is assigned.
4. Visitors can copy phone number or close widget.
5. Desktop: bottom-right corner. Mobile: bottom of screen (both call and text shown simultaneously).

**Data flow:** Widget phone number (`541-703-3095`) routes through FUB for attribution. This is the FUB-tracked number separate from Matt's direct line (`541-213-6706`).

### 18.2.3 UTM Tracking (per FUB docs)

FUB Pixel captures 6 UTM parameters per lead event:

| Parameter | Field |
|---|---|
| Platform | utm_platform |
| Source | utm_source |
| Campaign | utm_campaign |
| Term | utm_term |
| Medium | utm_medium |
| Content | utm_content |

**Auto-captured from:** Google Ads, Bing Ads, Facebook Ads (usually included automatically in click URLs).

**Displayed:** Marketing Report (aggregated by platform, "first touch" and "all touch" attribution modes) + Lead Profile (hover over "Marketing Source" field to see all 6 UTM values).

### 18.2.4 Pixel Data Model

```ts
interface PixelAccount {
  account_id: string;
  widget_id: string;          // "WT-QPDMEALA" — generated at account creation
  form_capture_enabled: boolean;
  cta_desktop_enabled: boolean;
  cta_mobile_enabled: boolean;
  cta_display_mode: 'assigned_agent' | 'fixed_number';
  cta_fallback_number: string | null;  // when mode=assigned_agent
  cta_fixed_number: string | null;     // when mode=fixed_number
}

interface PixelEvent {
  id: string;
  account_id: string;
  person_id: string | null;       // null if visitor not identified
  session_id: string;             // browser session identifier
  event_type: 'page_view' | 'property_view' | 'property_save' | 'form_submit' | 'return_visit';
  page_url: string;
  page_title: string | null;
  referrer: string | null;
  domain: string;                 // tracks multiple websites
  utm_platform: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  occurred_at: Date;
}
```

### 18.2.5 Acceptance Criteria — Pixel

1. Pixel detail page renders as a two-panel layout (left: info/logo/go-back; right: three sub-tabs).
2. Description tab shows intro video, four bullet features, and "Follow Up Boss Pixel Settings" CTA.
3. Tracking tab shows the exact JavaScript snippet with the account's widget ID; "Copy code" copies it; form capture toggle is present with helper text.
4. Tracking status line shows "Waiting for tracking activity" (spinner) until a Pixel event fires.
5. Call To Action tab shows live desktop and mobile widget previews using the assigned agent's headshot and tracked phone number.
6. Desktop/mobile toggles are independently controllable and persist.
7. Display mode radio buttons switch between "assigned agent with fallback" and "fixed number only".
8. TCPA disclaimer text appears in the widget preview.
9. Pixel code is account-unique (widget ID generated per account, format `WT-XXXXXXXX`).
10. Pixel events write to `crm_timeline` as web-activity entries; return visits auto-create call tasks (per §17.6 of main spec).

---

## 18.3 Admin > Integrations Catalog

### 18.3.1 Layout

**Route:** `/admin/integrations`

Accessed via the "Integrations" tab in the Admin sub-nav (observed with dropdown indicator `▾`). No loading state captured — renders immediately.

**Help link (top right):** "How Integrations work" (ⓘ)

**Page structure:** Two labeled sections, each containing a card grid.

### 18.3.2 Section: Email Marketing

Cards (left to right):

| Logo | Name | Category Label |
|---|---|---|
| Mailchimp (yellow/monkey) | Mailchimp | Newsletters |
| BombBomb (dark circle) | BombBomb | Videos |
| SendGrid (blue grid) | SendGrid | Batch Email Provider |

### 18.3.3 Section: Integrations

Cards (left to right in observed order):

| Logo | Name | Category Label | Connected (Ryan Realty) |
|---|---|---|---|
| FUB Pixel (rainbow arrows) | Pixel by Follow Up Boss | Follow Up Boss Pixel | Green checkmark ✓ |
| facebook (blue wordmark) | Facebook | Lead Provider | Green checkmark ✓ |
| MOJO (red text) | MOJO | Outbound Prospecting | — |
| zapier (orange/black) | Zapier | Other | — |
| Zillow Premier Agent (blue Z) | Zillow Premier Agent | Lead Provider | — |
| SPACIO (orange diamond) | SPACIO | Lead Provider | — |
| AGENT LEGEND (gear) | Agent Legend | Lead Conversion | — |
| Aiva (red house/speech bubble) | Aiva | Lead Conversion | — |
| CallAction (C icon) | CallAction | Lead Conversion | — |
| RealScout (R icon) | RealScout | Lead Engagement | — |
| StreetText (yellow speech) | StreetText | Lead Generation | — |
| VERIFY by CallAction (checkmark) | Verify by CallAction | Other | — |

**Total integration tiles: 15** (3 Email Marketing + 12 Integrations)

### 18.3.4 Card Visual Spec

- White card (`bg-card`), rounded corners (`rounded-xl`), ~4–6 px border radius
- Logo: centered/large in card body
- Category label: `text-xs text-muted-foreground` below logo, bottom of card
- Card height: fixed, consistent across all tiles; logo scale varies per brand
- **Connected state:** Green circle-checkmark badge absolutely positioned top-right corner of card (`z-10`, `bg-success text-white rounded-full`, ~20 px)
- **Hover state:** `bg-blue-50` or `bg-muted/40` light tint on the entire card
- **Click:** Full-page navigation to integration detail route (`/admin/integrations/<slug>`)

**Connected integrations in Ryan Realty account:** Pixel by Follow Up Boss, Facebook (both show green checkmark badge).

### 18.3.5 Integration Detail Page (Generic Two-Panel Template)

All integrations share a two-column detail page layout.

**Left description panel (~30% width):**
- Integration logo (large)
- **Category:** `<Category> / <Sub-category>` (e.g., "Integrations / Lead Provider")
- **Website:** `<domain>` (linked)
- **Description text:** Integration description paragraph
- **"< Go back"** link → returns to Integrations grid

**Right panel (~70% width):**
Two sub-tabs: **Description** | **⚙ Settings**

- **Description tab:** Feature summary + embedded video (if available)
- **Settings tab:** Integration-specific configuration (the active tab when the integration is connected)

### 18.3.6 Facebook Integration Detail — Connected State

**Left panel:**
- Facebook wordmark logo (full-color blue)
- Category: Integrations / Lead Provider
- Website: facebook.com
- Description: "Facebook lead ads makes the lead generation process easy. People simply tap your ad and a form pops up, already pre-populated with the contact information they've shared with Facebook, ready to be sent directly to you. Just like that, they can get the information they want — and you generate a qualified lead for your business."

**Right panel — Settings tab (active, Ryan Realty is connected):**

**Connected status banner (green/teal outlined box):**
> "You are connected to Matt Ryan on Facebook."

**Three-step instructions:**
1. Click the Connect button to connect your Facebook account
2. Select each Facebook page you want to process leads from
3. Click Update selected pages to start processing leads

**FACEBOOK PAGES section** (all-caps label):

Loading state (observed): "Checking connection status with Facebook..." (spinner/text) — the pages list loads asynchronously from the Facebook Graph API after the page renders.

**"Need help connecting Facebook?"** — help link

**Disconnect button:** `bg-destructive text-destructive-foreground` coral/red pill, right-aligned, labeled "Disconnect"

**Facebook integration behavior (per FUB docs):**
- Setup requires: Admin > Integrations > Facebook > "Connect Facebook" → authenticate via Facebook login → opt in to current businesses only → select which Facebook Pages → save.
- For Business Manager accounts: Meta Business Settings > Integrations > Lead Access > assign FUB as CRM for specific pages.
- Data captured: Name, phone, email, address, custom form question responses. Language: English, Spanish, French supported.
- Source automatically set to "Facebook" in FUB.
- Auto-tagging: Leads tagged with Facebook Page name AND Lead Form name automatically.
- 64-character tag limit: Tags over 64 chars are silently dropped.
- Default assignment: Goes to the account that connected Facebook.
- Custom field mapping is NOT possible via direct integration — requires Zapier (paid plan).

**Facebook direct integration troubleshooting guide (per FUB docs):**

| Issue | Cause | Resolution |
|---|---|---|
| Disconnection warning | App permissions revoked | Reconnect the account |
| Lead delays | Pages lack Lead Access config | Meta Business Settings > Integrations > Lead Access > assign FUB as CRM |
| Page appears grayed out | Insufficient permissions | Page admin must grant moderator/admin role |
| Tags not added | Tag name > 64 characters | Shorten page/form names |
| Persistent issues | Unknown auth state | Full reset: disconnect > remove app > reconnect > test lead |
| Business page not appearing | Integration scope issue | Page must be within opted-in business scope |
| Two-factor permission warning | 2FA not configured | Configure 2FA on Facebook |
| No longer subscribed | Webhook subscription dropped | Reconnect integration |
| Already connected to another account | Page connected to different FUB account | Disconnect from the other account first |
| Missing permission for a page | Admin rights required | Obtain admin rights for the page |

### 18.3.7 IDX Integrations (Admin Overview Card)

From Admin Overview, a separate **IDX Integrations** card exists in the Integrations section:
- **Icon:** monitor
- **Description:** "See which Real Estate website providers are best integrated with Follow Up Boss."
- **Title:** IDX Integrations

This navigates to the IDX-specific page (not the main Integrations grid). The IDX integration tiers (per FUB docs):

**Tier 1 — API-Integrated (robust, maintained):**
AgentFire, Agent Locator, AgentLoft, Curaytor, Dakno, Easy Agent Pro, Galtline Design, Luxury Presence, RealSavvy, RealScout, RealtyNA, Realty Ninja, Realtyna, Showcase IDX, Sierra Interactive, Union Street Media, Ylopo

**Tier 2 — Email Parsing (basic):**
Agent Jet, Boomtown, Commissions Inc, Diverse Solutions, IDX Broker, iHomeFinder, Kunversion, Market Leader, Placester, Point2, Real Geeks, Redman Tech, Remax Websites, Terabitz, Tiger Leads, Zurple

**Tier 3 — Custom Websites:** Open API or web forms.

**Ryan Realty uses:** AgentFire (Tier 1, connected via API key `v7Ip` = "Agent Fire"), plus the FUB Pixel on the AgentFire site.

**AgentFire integration specifics (per FUB docs):**
- Direction: One-way AgentFire → FUB for form submissions; also an embedded app in FUB.
- Data sent: Name, email, phone, lead source, message, property/page being viewed, submission timestamp.
- Not synced: FUB data does NOT flow to AgentFire automatically.
- Setup: FUB Admin > API > Create API Key "AgentFire" → paste into AgentFire Lead Manager > Connect CRM > Follow Up Boss. Then enable AgentFire as an embedded app in FUB.

### 18.3.8 All Integrations Card (Admin Overview)

- **Title:** All Integrations
- **Icon:** link icon
- **Description:** "Email marketing, Facebook, Zillow, Drip Texting — see all our other integrations here."
- Navigates to the `/admin/integrations` grid page.

### 18.3.9 Acceptance Criteria — Integrations Catalog

1. Integrations grid renders with two sections: Email Marketing (3 tiles) and Integrations (12 tiles).
2. Connected integrations (Pixel, Facebook in Ryan Realty account) show green checkmark badge overlaid top-right of the card.
3. Hovering a card shows light blue/muted background highlight.
4. Clicking any card navigates to the integration detail page (two-panel layout).
5. Facebook detail page shows connected status banner, three-step instructions, and async page loading for the FACEBOOK PAGES section.
6. "Disconnect" button on connected integrations is destructive-styled; clicking opens confirmation.
7. "< Go back" link returns to the Integrations grid.
8. Admin Overview "API Keys & Lead Email", "Pixel", "IDX Integrations", and "All Integrations" cards all navigate to the correct sub-pages.

---

## 18.4 Public REST API Specification

This section documents the external-facing REST API that integrators use to connect to FUB. The in-house Ryan Realty CRM must implement API parity to maintain backward compatibility with existing integrations (RyanRealtyApp, Vercel LP, CLAUDE COWORK, AgentFire, Zapier).

### 18.4.1 Base URL and Protocol

**Base URL (per FUB docs):** `https://api.followupboss.com/v1/{resource}`

In-house equivalent: `https://api.ryan-realty.com/v1/{resource}` (define at build time).

**Requirements:**
- HTTPS required. HTTP will not work.
- Version v1 only. No v2 or higher.
- Support contact: api@followupboss.com (FUB). In-house: `api@ryan-realty.com`.

### 18.4.2 Authentication

**Method 1 — API Key (HTTP Basic Auth):**
```
Authorization: Basic base64(API_KEY:)
```
Use the API key as the username; leave the password blank (note the trailing colon in the base64 input).

**Method 2 — OAuth Bearer Token:**
```
Authorization: Bearer <access_token>
```
For OAuth-based integrations after Authorization Code Grant flow completes.

**Common mistake:** Using Bearer for API keys or Basic for OAuth tokens. The two paths are strictly separate.

**Role-based access levels:**

| Role | API Access |
|---|---|
| Owner | Full account access including webhook management |
| Admin/Broker | Comprehensive access except webhooks |
| Agent | Limited to assigned contacts or collaborations; restricted action plan access |
| Lender | Similar to agents with fewer available actions |

**Expired accounts:** API keys remain functional during grace period but most endpoints return 403. Exception: `POST /v1/events` stays active to prevent data loss.

### 18.4.3 System Registration and X-System Headers

Any integration building a product must register at the system registration URL. Registration generates:
- `X-System`: System name (e.g., "RyanRealtyApp")
- `X-System-Key`: Unique system key (e.g., "560270f7914b5b4a5f4dc1793ebc2796")

Both headers are required in every HTTP API request when system-registered.

**Benefits of valid X-System-Key:**
- Higher rate limits (see §18.4.4)
- Access to rate limit monitoring endpoints
- Ability to manage webhooks
- The X-System-Key is also used as the HMAC-SHA256 secret for webhook signature verification

### 18.4.4 Rate Limiting

Rate limits use a **sliding 10-second window** (not per-minute or per-hour).

**Every API response includes headers:**
- `X-RateLimit-Limit` — max requests for this context
- `X-RateLimit-Remaining` — requests remaining before limit
- `X-RateLimit-Window` — "10" (seconds)
- `X-RateLimit-Context` — which limit category applies

**Limits WITH valid X-System-Key:**

| Context | Limit per 10s | Endpoint | Method |
|---|---|---|---|
| global | 250 | All endpoints | All |
| POST.events | Unlimited | /v1/events | POST |
| events | 20 | /v1/events | GET |
| PUT.people | 25 | /v1/people | PUT |
| notes | 10 | /v1/notes | All |

**Limits WITHOUT valid X-System-Key:**

| Context | Limit per 10s | Endpoint | Method |
|---|---|---|---|
| global | 125 | All endpoints | All |
| POST.events | Unlimited | /v1/events | POST |
| events | 10 | /v1/events | GET |
| PUT.people | 25 | /v1/people | PUT |
| PUT.notes | 10 | /v1/notes | PUT |

**Note:** `POST /v1/events` is unlimited in both tiers — intentional to prevent lead loss during bursts.

**429 handling:** Returns `429 Too Many Requests` with `Retry-After: <seconds>`. Clients must respect this header and not retry before the specified time.

**Usage monitoring endpoints (require X-System + X-System-Key):**
- `GET /v1/rateLimit/usage` — 24-hour rolling totals
- `GET /v1/rateLimit/limits` — currently configured limits

### 18.4.5 Pagination

| Parameter | Default | Max |
|---|---|---|
| `offset` | 0 | — |
| `limit` | 10 | 100 |

**Preferred method:** Use the `next` cursor token from `_metadata.next` (keyset pagination). More efficient than offset for deep pagination.

**Response `_metadata` structure:**
```json
{
  "_metadata": {
    "collection": "people",
    "offset": 0,
    "limit": 10,
    "total": 1847,
    "next": "<opaque cursor token>",
    "nextLink": "https://api.followupboss.com/v1/people?next=..."
  }
}
```

**Default sort:** Reverse by `id` (newest first).

### 18.4.6 Error Responses

| HTTP Status | Meaning |
|---|---|
| 200 OK | Success; existing person updated |
| 201 Created | Success; new person created |
| 204 No Content | Lead flow archived/ignored (no body returned) |
| 400 Bad Request | Malformed request; body contains `{"errorMessage": "..."}` |
| 403 Forbidden | Access denied (also returned by expired accounts) |
| 404 Not Found | Resource doesn't exist |
| 429 Too Many Requests | Rate limit exceeded; check Retry-After header |
| 500 Internal Server Error | Server error |
| 503 Service Unavailable | Temporary outage |
| 504 Gateway Timeout | Timeout |

**Retry strategy for 5xx:** Truncated exponential backoff: `min(((2^n) + random_ms), max_backoff)` where max_backoff is typically 32–64 seconds.

**Critical 204 note:** A `204` response from `POST /v1/events` means the lead was routed to an archived/ignored bucket — the lead was NOT created. This is not an HTTP error but means FUB's lead flow rules silently discarded the event. Check lead flow routing configuration if leads are disappearing.

### 18.4.7 Key API Endpoints

#### `POST /v1/events` — The ONLY correct way to send new leads

This is the canonical lead ingestion endpoint. **Do NOT use `POST /v1/people` to send new leads.** Using `/v1/people` bypasses automations, can create duplicates, and breaks workflow triggers.

**Request body fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| source | string | recommended | Lead source name (domain without "www", e.g., `ryan-realty.com`) |
| system | string | recommended | Your system's name |
| type | enum | yes | Event classification (see valid values below) |
| message | string | no | User's message/inquiry |
| description | string | no | Additional info |
| person | object | yes | Lead contact info; auto-deduplicates on email or phone |
| property | object | no | Property-related event details |
| propertySearch | object | no | Search criteria |
| campaign | object | no | Marketing source data (requires `source` field) |
| pageTitle | string | no | Page title (for Viewed Page events) |
| pageUrl | string | no | Page URL |
| pageReferrer | string | no | Referrer URL |
| pageDuration | int32 | no | Time on page in seconds |
| occurredAt | date | no | When event occurred; events >1 day old do NOT trigger workflows |

**Valid `type` enum values (14 total):**
- `Registration`
- `Inquiry`
- `Seller Inquiry`
- `Property Inquiry`
- `General Inquiry`
- `Viewed Property`
- `Saved Property`
- `Visited Website`
- `Incoming Call`
- `Unsubscribed`
- `Property Search`
- `Saved Property Search`
- `Visited Open House`
- `Viewed Page`

**Workflow trigger matrix:**
| Event Type | Triggers Action Plans | Triggers Automations |
|---|---|---|
| Registration | Yes | Yes |
| Seller Inquiry | Yes | Yes |
| Property Inquiry | Yes | Yes |
| General Inquiry | Yes | Yes |
| Visited Open House | Yes | No |
| All others | No | No |

**Historical events:** If `occurredAt` is more than 1 day in the past, the event records to the contact timeline but does NOT trigger action plans or automations. This is intentional behavior.

**Response codes:**
- `200`: Event created; existing person updated
- `201`: Event created; new person created
- `204`: Lead flow archived/ignored (no body)
- `404`: Referenced person not found

**Source field format:** Domain without "www" prefix (e.g., `ryan-realty.com` not `www.ryan-realty.com`).

#### `GET /v1/events` — Retrieve events

- Max 100 per request (use `limit` parameter)
- Some lead events are only visible within the FUB app, not via API

#### `PUT /v1/people/:id` — Update existing person

- Rate-limited: 25 per 10-second window
- Only for updating known persons; do not use to create new leads

#### `GET /v1/people` — List people

- Default 10 per page, max 100
- To retrieve custom field values: append `fields=allFields` to query

#### `GET /v1/customfields` — Discover custom field names

**Critical:** Custom field display names do NOT equal API field names. Display name "Close Date" → API field name `customCloseDate`. Names are camelCase with `custom` prefix and are case-sensitive. Always query this endpoint before building custom field integrations.

#### Other documented endpoints:

```
GET    /v1/people/:id
DELETE /v1/people/:id
GET    /v1/notes
POST   /v1/notes
PUT    /v1/notes/:id
DELETE /v1/notes/:id
GET    /v1/tasks
POST   /v1/tasks
PUT    /v1/tasks/:id
GET    /v1/deals
POST   /v1/deals
GET    /v1/webhooks
POST   /v1/webhooks
GET    /v1/webhooks/:id
PUT    /v1/webhooks/:id
DELETE /v1/webhooks/:id
GET    /v1/webhookEvents/:id
GET    /v1/rateLimit/usage
GET    /v1/rateLimit/limits
DELETE /v1/oauthApps/revokeAccess
POST   /v1/inboxApps/install
```

#### New contact access delay (per FUB docs)

After creating a person via `POST /v1/events`, there is a processing delay before the person is accessible to other endpoints (e.g., creating notes or calls). The delay depends on the account's Lead Flow configuration:
- Round Robin: longer delay (needs assignment resolution)
- Direct assignment: shorter delay

**Implementation requirement:** Do not make sequential API calls immediately after creating a person. Implement a retry loop with exponential backoff for subsequent operations on a newly created person.

### 18.4.8 OAuth 2.0

**Flow:** Authorization Code Grant

**Endpoints:**

| Purpose | Method | URL |
|---|---|---|
| Authorization | GET | `/oauth/authorize` (on app domain) |
| Token Exchange | POST | `/oauth/token` (on app domain) |
| Token Revocation | DELETE | `/v1/oauthApps/revokeAccess` |

**Authorization request parameters:** `response_type`, `client_id`, `redirect_uri`, `state`, `prompt`

**Token exchange parameters:** `grant_type=authorization_code`, `code`, `redirect_uri`, `state`

**Token refresh parameters:** `grant_type=refresh_token`, `refresh_token`

**Client authentication:** HTTP Basic Auth with Base64-encoded `client_id:client_secret`

**API requests with OAuth:** `Authorization: Bearer <access_token>`

No explicit OAuth scopes are documented publicly. All scopes are implicitly full-account access.

### 18.4.9 Webhooks

**Access restriction:** Owner-only. Only the account owner can create, update, or delete webhooks. Admins and agents cannot manage webhooks.

**Webhook management endpoints:**
- `GET /v1/webhooks` — list all webhooks
- `POST /v1/webhooks` — create webhook
- `GET /v1/webhooks/:id` — get specific webhook
- `PUT /v1/webhooks/:id` — update webhook
- `DELETE /v1/webhooks/:id` — delete webhook
- `GET /v1/webhookEvents/:id` — retrieve specific webhook event (events older than 3 days may be unavailable)

**Limit:** 2 webhooks per event type **per registered system** (API integration) — an account with N integrations can register up to 2×N webhooks for one event type (per docs.followupboss.com/reference/webhooks-guide, verified 2026-06-30). Unregister unused webhooks.

**Payload structure:**
```json
{
  "eventId": "unique-uuid",
  "eventCreated": "2019-07-01T17:22:28+00:00",
  "event": "peopleTagsCreated",
  "resourceIds": [40773, 40772],
  "uri": "https://api.followupboss.com/v1/people?id=40773,40772",
  "data": {"tags": ["TagName"]}
}
```

**Webhook endpoint requirements:**
- Must be a publicly accessible HTTPS URL
- Must accept HTTP POST with JSON body
- Must respond within 10 seconds with a 2XX status
- Return 406 or 410 to request automatic webhook deletion

**Retry schedule on non-2XX response:**
1 minute → 5 minutes → 5 minutes → 10 minutes → 30 minutes
Maximum retry window: 8 hours total.

**Auto-disable:** Webhooks with >50% failure over 48 hours that do not recover within 1 week are automatically disabled.

**Security — Signature verification:**
1. Base64-encode the raw JSON payload
2. Compute SHA256 HMAC hash using your `X-System-Key`
3. Compare to the `FUB-Signature` header value in the delivery

Every webhook request includes an `X-System` header identifying the registered system.

**Complete webhook event type catalog:**

*People:*
`peopleCreated`, `peopleUpdated`, `peopleDeleted`, `peopleTagsCreated`, `peopleStageUpdated`, `peopleRelationshipCreated`, `peopleRelationshipUpdated`, `peopleRelationshipDeleted`

*Communications:*
`notesCreated`, `notesUpdated`, `notesDeleted`, `emailsCreated`, `emailsUpdated`, `emailsDeleted`, `textMessagesCreated`, `textMessagesUpdated`, `textMessagesDeleted`, `callsCreated`, `callsUpdated`, `callsDeleted`, `threadedReplyCreated`, `threadedReplyUpdated`, `threadedReplyDeleted`

*Tasks & Appointments:*
`tasksCreated`, `tasksUpdated`, `tasksDeleted`, `appointmentsCreated`, `appointmentsUpdated`, `appointmentsDeleted`

*Deals & Pipeline:*
`dealsCreated`, `dealsUpdated`, `dealsDeleted`, `pipelineCreated`, `pipelineUpdated`, `pipelineDeleted`, `pipelineStageCreated`, `pipelineStageUpdated`, `pipelineStageDeleted`

*Configuration:*
`customFieldsCreated`, `customFieldsUpdated`, `customFieldsDeleted`, `dealCustomFieldsCreated`, `dealCustomFieldsUpdated`, `dealCustomFieldsDeleted`, `stageCreated`, `stageUpdated`, `stageDeleted`

*Engagement:*
`emEventsOpened`, `emEventsClicked`, `emEventsUnsubscribed`, `reactionCreated`, `reactionDeleted`, `eventsCreated`

**Webhook behavior caveats:**
- Bulk operations (batch tag changes, stage/source/agent reassignment) may split into multiple webhook deliveries. Build idempotent event processing.
- Custom fields: Webhook payload alone does not include custom field values. Must make a separate API call with `fields=allFields` to retrieve them.
- Appointment webhooks only fire for FUB-created appointments, NOT for calendar integration appointments (Google Calendar, Microsoft 365).
- `stageCreated`/`stageUpdated`/`stageDeleted` track pipeline stage configuration changes, not lead stage assignments. `peopleStageUpdated` tracks actual lead stage assignments.
- Deal file changes do NOT trigger `dealsUpdated`.

**Recommended architecture:** Decouple event receipt from processing. Receive webhooks in a lightweight endpoint that records to a queue/DB, then process asynchronously to prevent the 10-second response timeout from being exceeded.

### 18.4.10 Embedded Apps and Inbox Apps

**Embedded Apps:** iframes loaded directly into the FUB interface.
- Display contexts: right-hand side of a Lead Profile; Inbox view when a conversation is selected.
- Configure in: Admin > Integrations > "Create an embedded app"
- Fields: app name, company website, category, company bio, description, secure HTTPS URL (iframe src)
- Enable/disable: account-level, applies to all users simultaneously
- Test debug states: "account not found," "person not found," "unauthorized"

**Inbox Apps (8 available):**
- CallAction, Conversations by StreetText, Leaf360, Leadngage, RealScout, Texting Betty, Ylopo, Zillow Messages
- Installation via: `POST /v1/inboxApps/install` with `publishedInboxAppId`, `userId` (0 = account-wide), `subscriptionUrl`
- Subscription URL validation: FUB sends `{"test": 1}` synchronously during install; must return 200.
- `inboxAppDeactivated` webhook event sent on deactivation.

### 18.4.11 Zapier Integration

**Available FUB Triggers (6 total) for outbound Zaps:**
- New Contact
- Tag Added to Contact
- New Appointment
- Deal Stage Updated
- (2 additional not fully enumerated in docs)

**Available FUB Actions (13 total) for inbound Zaps:**
1. New Inquiry or Website Event (recommended for most zaps — triggers action plans correctly)
2. Create or Update Contact Without Triggering Action Plans (silent upsert — no alerts, no automations)
3. Add tag to contact
4. Apply action plan
5. Change lead stage
6. Create deal
7. Add note
8. Create task
9. Add collaborator
(Plus ~4 additional)

**Constraints:**
- Paid Zapier required for: multi-step Zaps (3+ steps), premium connectors (Facebook Lead Ads)
- Max 5 custom field mappings per Zap
- Task time defaults to 12:00 a.m. if time not specified
- "Create or Update Contact Without Triggering Action Plans" — does NOT alert anyone or activate action plans

**Ryan Realty's Zapier key:** `**********HjF6` (last-used: a month ago, created: 7 months ago)

### 18.4.12 API Gotchas and Edge Cases

1. **New person access delay:** Creating a person via `/v1/events` then immediately creating a note or call for them will fail. Implement delay + retry logic. Delay varies by Lead Flow configuration.

2. **Custom field name resolution:** Display name "My Custom Field" does NOT equal API name `customMyField`. Always query `GET /v1/customfields` to get exact camelCase API names. Case-sensitivity causes silent field-not-found failures.

3. **Basic Auth vs Bearer Auth mismatch:** Most common auth error. API keys = Basic Auth. OAuth tokens = Bearer Auth.

4. **Webhook auto-disable:** Systems down for 48+ hours can lose webhook subscriptions permanently if failure rate exceeds 50%. Build re-subscription logic into service health checks.

5. **Deal delete in Zillow two-way = Zillow transaction cancellation.** Archive deals instead of deleting when Zillow two-way integration is active.

6. **Batch operation webhook splitting:** Bulk operations affecting many contacts split into multiple webhook deliveries. Build idempotent event processing (use `eventId` for dedup).

7. **Appointment webhook scope:** Only FUB-created appointments fire webhooks. Calendar integration appointments (Google Calendar, Microsoft 365) do NOT fire appointment webhooks.

8. **Stage webhooks vs stage assignment:** `stageCreated/Updated/Deleted` = stage configuration changes. `peopleStageUpdated` = actual lead stage assignment. Different events.

9. **Custom fields in webhooks:** Webhook payload does not include custom field values. Must make separate API call with `fields=allFields`.

10. **`occurredAt` workflow cutoff:** Historical events (>1 day old) record to timeline but do NOT trigger workflows. Intentional.

11. **`POST /v1/events` 204 response:** Lead was silently discarded by lead flow rules. Not an HTTP error — check lead flow routing.

12. **Pixel + form capture + API = duplicates:** Disable form capture if the site already sends leads via API.

13. **Multi-domain Pixel tracking:** One Pixel code tracks multiple websites. FUB distinguishes by domain automatically. No additional config needed per domain.

### 18.4.13 Acceptance Criteria — Public API

1. `POST /v1/events` endpoint accepts all 14 event types, deduplicates by email or phone, returns 200/201/204 per spec, and fires action plans/automations only for the 5 qualifying event types.
2. Historical events (`occurredAt` > 1 day old) record to timeline but do NOT trigger workflows.
3. Rate limits: 250/10s global (with X-System-Key), 125/10s without; `POST /v1/events` unlimited; response headers include all 4 `X-RateLimit-*` fields; 429 response includes `Retry-After`.
4. `GET /v1/rateLimit/usage` and `/limits` endpoints return 24-hour rolling totals for systems with valid X-System-Key.
5. Pagination: default 10, max 100, `_metadata` includes `collection`, `offset`, `limit`, `total`, `next`, `nextLink`.
6. All 9 error status codes return correctly per spec.
7. Webhooks: owner-only management; 2-per-event-type limit; 10-second response timeout; retry schedule (1min, 5min, 5min, 10min, 30min, 8-hour max); auto-disable on >50% failure over 48 hours; `FUB-Signature` header on every delivery using HMAC-SHA256 with X-System-Key.
8. All 45+ webhook event types are implemented and deliverable.
9. OAuth Authorization Code Grant flow with /authorize, /token, /token-refresh, and /revoke endpoints.
10. `GET /v1/customfields` returns all custom field definitions with camelCase API names.
11. `fields=allFields` query parameter on people endpoints includes custom field values.
12. New person access delay: sub-systems that create notes/calls after creating a person handle the processing delay gracefully (retry logic, not synchronous failure).

---

## 18.5 Email Parser (Lead Email Format Specification)

Documented separately from the UI, this governs what emails sent to the `@followupboss.me` (or in-house equivalent) address are parsed as new leads.

**Activation trigger:** Email body must begin with "New lead activity notification" to register as a new lead.

**Three template formats:**

**Short Format (3 fields):**
```
New lead activity notification
Name:
Email:
Phone:
```

**Full Format (6 fields):**
```
New lead activity notification
Name:
Email:
Phone:
Price:
Source:
Notes:
```

**Advanced Format (29 fields):**
```
New lead activity notification
First Name:
Last Name:
Email:
Phone:
Source:
Source URL:
Campaign:
Lead Type:
Lead Stage:
Tags:
Street:
City:
State:
Postal Code:
MLS:
Price:
Bedrooms:
Bathrooms:
Area:
Lot:
Type:
URL:
Message:
Description:
Background:
Address:
Notes:
[+ 2 additional fields documented]
```

**Critical constraint:** Do NOT delete unused rows from the template — leave them blank. Deleting rows breaks the parser's format recognition.

**Custom fields:** Not supported in the email parser. Send extra data in the Notes field.

**Zapier parser limitation:** Zapier's Parser cannot write to custom fields in FUB. Custom field data requires a direct API integration.

---

## 18.6 Additional Integration Catalog Details

### Zillow Integrations

**One-Way (Zillow → FUB only):**
- New Zillow leads auto-sent to FUB on creation.
- Existing leads updated when they re-inquire on Zillow.
- Agent assignments from Zillow sync to FUB.
- "Respond First" causes 3–4 minute delays.
- Unmatched agents receive "Zillow Agent Not Found" tag.

**Two-Way (bidirectional):**
- Stage assignments ↔ Zillow Status.
- Lead assignments ↔ Zillow agent assignment.
- Notes ↔ Zillow (fulfills Zillow update requirements).
- Deals ↔ Zillow transactions (CAUTION: deleting a FUB deal cancels the Zillow transaction — archive instead).
- Price point changes, browsing history (past 4 weeks).
- Zillow applies prefixed tags: "Zillow High Intent," "Zillow Specific Home Interest," "Re-engaged Buyer" (exclusive to two-way).
- FUB tags do NOT sync back to Zillow.
- Initial sync: leads modified within past 2 years.
- Team lead must activate before members can participate.

**Zillow My Agent:** 30 unique invites per 24-hour rolling period. Each consumer can only be linked to one agent at a time.

**Likely to List (Beta, Zillow Pro only):** AI flag applied weekly (Thursday/Friday) to contacts whose property address has high listing likelihood. Creates FUB smart list.

### Real Geeks Integration

**Two-way (recommended):**
- Bidirectional: lead details, property interactions, search activity, agent assignments.
- All agents must have identical email addresses in both platforms.
- **Do NOT install FUB Pixel on Real Geeks sites using the 2-way integration** — conflict.

**One-way:** Email parsing to `@followupboss.me` address. Real Geeks → FUB only.

### Transaction Management Integrations

**Dotloop:** One-way (Dotloop → FUB). 5-minute sync interval via Realsynch. Syncs: price → Deal price, close date, commission, loop URL (to custom field).

**Brokermint:** Bidirectional, 2–5 minute sync. Contacts, leads, transactions, custom field mappings.

**Nekst:** AI contract processing. One FUB account per Nekst workspace.

**Open to Close:** Embedded widget in FUB. Bidirectional real-time for contacts, documents, tasks, timelines.

### Email Marketing Integrations

**Mailchimp:** Via Zapier (2 Zaps required — one for existing contacts via tag trigger, one for new contacts). Fields synced: first name, last name, primary email.

**ActivePipe:** Bidirectional every 2–3 hours. Primary email only (secondary emails not synced).

**BombBomb:** Video record/attach in FUB email compose. API key connection.

**HubSpot:** Install from HubSpot App Marketplace. Bidirectional. Conflict resolution configurable. Custom mapping requires HubSpot CRM Suite Starter subscription.

### FUB's Position on Mass Texting

FUB deliberately does not provide native drip or mass texting. Official partners: SendHub, Slick Text, Textedly, Voizee. Not all integrate directly with FUB. Mass texting carries A2P 10DLC and TCPA risk — outsource to dedicated platforms rather than building natively.

---

## 18.7 Enrichment Provider (Custom Field Context)

The `Enrichment Provider` custom field (type: Text) has 5,851 contacts populated in Ryan Realty's account — the highest non-zero count among all 64 custom fields. This field stores the name of the third-party data enrichment service that populated demographic/property data fields. The demographic fields that follow it in the custom field list (Phone Type: 4,843; Include in FB CAS: 7,255; Realtor License/Type/Brokerage: 163 each) are populated primarily by enrichment pipelines.

**Enrichment pipeline behavior (per prior spec §17.8, confirmed):**
- Third-party enrichment writes to custom fields using the FUB API's custom field write path.
- Custom field names follow `customCamelCase` convention (e.g., `customEnrichmentProvider`).
- Retrieve custom field values via `GET /v1/people/:id?fields=allFields`.
- The `Include In FB CAS` field (Facebook Custom Audience Sync, 7,255 contacts) is used to flag which contacts should be synced to Facebook Custom Audiences via a third-party tool (StreetText or Adwerx — FUB has no native Custom Audience sync).

**Data model correction from prior spec (§17.8):** The prior spec described "direct FUB Facebook Custom Audience Sync" — this does NOT exist natively in FUB. Facebook Custom Audience retargeting requires StreetText or Adwerx as intermediaries. The `Include In FB CAS` field is a marker field only; the actual sync is external.

---

## 18.8 Design System Implementation Notes

This section is an internal admin surface. Apply Ryan Realty design tokens:

| FUB Pattern | Ryan Realty Equivalent |
|---|---|
| Teal "Create API Key" button | `<Button>` from `@/components/ui/button` with `bg-primary text-primary-foreground` |
| Gray toggle (OFF) | `<Switch>` from `@/components/ui/switch`, unchecked state |
| Green toggle (ON) | `<Switch>`, checked state, `data-[state=checked]:bg-success` |
| Table card container | `<Card>` from `@/components/ui/card` |
| Masked API key field | `<Input>` from `@/components/ui/input`, `readOnly`, monospace `font-mono` |
| Copy button (ghost) | `<Button variant="ghost">` |
| Integration tiles | `<Card>` with relative positioning for connected badge overlay |
| Section labels (left column) | `text-sm font-medium text-muted-foreground` |
| Admin sub-nav tabs | `<Tabs>` from `@/components/ui/tabs`, border-bottom active indicator using `border-primary` |
| Two-panel integration detail | CSS Grid: `grid-cols-[30%_1fr]`, left panel static, right panel scrollable |
| Code block (JS snippet) | `<pre>` with `bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto` |
| Status spinner ("Waiting") | `<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />` |
| Destructive button (Disconnect) | `<Button variant="destructive">` |
| Info badge (UNCLAIMED) | `<Badge variant="warning">` from `@/components/ui/badge` |

Display headings (page H1 "API Settings") use Geist at admin-appropriate weight (`text-xl font-semibold`). Amboqia is reserved for public-facing hero moments — not admin UI. Never use raw `<button>`, `<select>`, or `<table>` on these surfaces; always use the shadcn/ui equivalents per CLAUDE.md design system rules.

---

## Sources

**Screenshots (vision-verified):**
- shot-42.md — Admin > API Settings (full page, labeled tiles q1–q4)
- shot-43.md — Admin > API Settings (alternate capture confirming all 4 API Usage rows)

**GIF analyses (dynamic behavior):**
- feat2.md — Frames 23–26: API Settings loading state, Pixel two-panel detail, Integrations catalog with connected badges
- admin1.md — Admin Overview card grid (full transcription of Integrations section cards)
- admin2.md — (Automations/Email Templates; referenced for sub-nav tab patterns)
- admin3.md — Frames 5–6: Integrations grid catalog, Facebook detail page (both panels, connected state, async page loading), Admin Overview complete card inventory
- admin4.md — Frames 10–14: Pixel three-tab detail (Description + Tracking + Call To Action), widget previews, live JS code block with `WT-QPDMEALA`, TCPA disclaimer text, form capture toggle state

**Official FUB Documentation:**
- fub-docs/integrations-api.md — Full compiled research from ~80 FUB help center articles and developer docs
  - §1 Lead Email Address, §2 Inbox Lead Processing, §3 Email Parser templates, §5 FUB Pixel (Overview/Form Capture/CTA/UTM), §6 API Key Management, §7 REST API (base URL/auth/rate limits/pagination/errors/endpoints/OAuth/webhooks), §8 Embedded Apps, §9 Inbox Apps, §10 Zapier, §11 Zillow (1-way/2-way/Workspace/My Agent/Likely to List), §12 Facebook Lead Ads (direct/Zapier/Custom Audience), §13 Real Geeks, §14 IDX Tiers, §15 AgentFire, §18 RealScout, §21 Email Marketing (Mailchimp/ActivePipe/BombBomb/HubSpot), §24 Other integrations

**Prior spec sections superseded/corrected:**
- §15.9 API Keys & Lead Email — corrected: API Usage table has 4 rows (not 2); now fully documented
- §15.10 Other admin surfaces — superseded by this section's full detail on Pixel, IDX, Integrations catalog, Facebook detail page, and integration-specific behavior
- §17.8 Enrichment & integrations — corrected: FUB has NO native Facebook Custom Audience sync; `Include In FB CAS` is a marker field only; external tools (StreetText/Adwerx) perform the actual sync
- §17.6 Web activity & attribution (Pixel) — extended with Pixel form capture behavior, multi-domain tracking, iFrame limitation, CTA widget logic, and UTM parameter spec

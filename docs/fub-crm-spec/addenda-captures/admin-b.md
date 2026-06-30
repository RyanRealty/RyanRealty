<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §14/§15/§18 Admin: EmailAuth/Integrations/Pixel/LeadFlow/Settings -->

# FUB Admin-B Screen Recording — Exhaustive Buildable Analysis
## Scope: Email Domain Authentication · Integrations Catalog · Pixel Config · Lead Flow Editor · My Settings

Source: 12 frames + 48 quadrant tiles from `fub-gif-frames/admin-b/`
Target spec sections: §14 / §15 / §18 Admin

---

## 1. Global Navigation Context

### 1.1 Top Navigation Bar (all frames)

```
[☆ logo] | People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (active)
                                            [Search input — full width center]
          [email icon] [chat icon] [team icon] [bell icon] [avatar]
```

- Active section: **Admin** (highlighted/underlined)
- Top-right icon row (left to right): compose-email icon, chat/SMS icon, team-switch icon, notification bell, user avatar with dropdown caret

### 1.2 Admin Sub-Tab Bar (most frames)

```
Overview | Lead Flow | Groups | Team | Action Plans | Automations | Ponds |
Email Templates | Text Templates | Import | Custom Fields | Calling | Stages |
Phone Numbers | Tags | [More ▾] or [Appointments ▾] or [Integrations ▾]
```

The rightmost tab label changes context-dependently:
- When on Appointments page: label is **"Appointments ▾"**
- When on Integrations page: label is **"Integrations ▾"**
- When on Lead Flow / Settings: label is **"More ▾"**

Right side of sub-tab bar: contextual help link (e.g., "Admin Overview", "How Integrations work", "How Lead Flow works", "How Settings work") — rendered as a light outlined button with an info `ⓘ` icon.

### 1.3 "More" / Overflow Dropdown Menu

Seen in **f01** — clicking the rightmost overflow tab ("Appointments") reveals a dropdown:

| Menu Item | Route |
|---|---|
| Integrations | /admin/integrations |
| Company | /admin/company |
| API | /admin/api |
| Appointments | /admin/appointments (current page in f01) |
| Email Domain Authentication | /admin/email-domain-authentication |

Dropdown renders as a white card with a subtle shadow, left-aligned to the overflow tab button, no icons next to items, plain text links.

---

## 2. Appointments Page (f01 — starting state)

**URL context:** Admin > Appointments  
**Help link (top-right):** "Admin Overview" button

### 2.1 Appointment Types Section

```
[Appointment Types]                          [Add Type] (blue button)

+------------------------------------------+----------+
| Name                                      | Actions  |
+------------------------------------------+----------+
| ⠿  Buyer consultation                    | [✏] [🗑] |
| ⠿  Listing                               | [✏] [🗑] |
+------------------------------------------+----------+
```

- Header: "Appointment Types" (H2)
- Button: "Add Type" (solid blue, right-aligned)
- Table columns: Name | Actions
- Row drag handle: ⠿ (six-dot drag handle icon, left side)
- Actions column: edit icon (pencil/square) + delete icon (trash bin) — both icon-only buttons
- Existing entries: "Buyer consultation", "Listing"

### 2.2 Appointment Outcomes Section

```
[Appointment Outcomes]                     [Add Outcome] (blue button)

+------------------------------------------+----------+
| Name                                      | Actions  |
+------------------------------------------+----------+
| ⠿  No show                               | [✏] [🗑] |
| ⠿  Working with buyers                   | [✏] [🗑] |
| ⠿  Listing obtained                      | [✏] [🗑] |
+------------------------------------------+----------+
```

- Same structure as Appointment Types
- Button: "Add Outcome" (solid blue)
- Existing entries: "No show", "Working with buyers", "Listing obtained"

---

## 3. Email Domain Authentication (referenced but not navigated to in frames)

**Navigation path:** Admin > [overflow dropdown] > "Email Domain Authentication"

**Status in recording:** The menu item is visible in f01's dropdown but the user does not click it — no content frame is captured for this page.

**What we know from the menu item alone:**
- Route: `/admin/email-domain-authentication`
- Appears as 5th item in the overflow dropdown beneath API and Appointments
- Purpose (inferred from FUB's product): allows setting up SPF/DKIM/DMARC records so emails from FUB are sent from the broker's own domain (e.g., `@ryan-realty.com`) instead of FUB's shared sending domain
- Expected UI pattern (standard FUB page): DNS record table with copy buttons for TXT/CNAME records, verification status indicators (pending / verified / failed), domain input field, "Add Domain" CTA

**Build note for spec §15:** This page must be built based on FUB's published docs since no frame content was captured. The nav slot and route are confirmed from f01.

---

## 4. Integrations Catalog (f02 · f03 · f04)

**URL context:** Admin > Integrations  
**Active tab:** Integrations (underlined in sub-tab bar)  
**Help link (top-right):** "How Integrations work" — outlined button with info icon

### 4.1 Page-Level Layout

Two-column implicit grid for integration cards (3 columns visible at this viewport width — approximately 1280–1440px desktop). Cards are uniform size, white background, rounded corners, logo centered in upper portion, category label centered below logo.

One card (Facebook) has a green checkmark badge overlay (top-right corner of the card) indicating it is **connected/active**. The Mailchimp card has an orange warning/alert badge.

---

### 4.2 Section: Email Marketing

Section heading: **"Email Marketing"** (H2, left-aligned, above card row)

| Card | Logo | Label |
|---|---|---|
| Mailchimp | Yellow background, Mailchimp monkey logo | "Newsletters" |
| BombBomb | Dark/black background, BombBomb text logo | "Videos" |
| SendGrid | Blue background, SendGrid logo (blue square + text) | "Batch Email Provider" |

- Mailchimp has an orange alert badge (warning/attention needed — likely disconnected or setup needed)
- Cards are ~200px × ~130px visible area plus label beneath

---

### 4.3 Section: Integrations

Section heading: **"Integrations"** (H2)

| Card | Logo | Category Label | Status Badge |
|---|---|---|---|
| Pixel (by Follow Up Boss) | FUB arrow logo + "Pixel by Follow Up Boss" text | "Follow Up Boss Pixel" | — |
| Facebook | Facebook text logo (blue on white) | "Lead Provider" | Green checkmark (connected) |
| Mojo | "MOJO" red text logo | "Outbound Prospecting" | — |
| Zapier | "—zapier" logo (dark background) | "Other" | — |
| Zillow Premier Agent | Zillow house logo + "PREMIER AGENT" text | "Lead Provider" | — |
| Spacio | "SPACIO" logo | "Lead Provider" | — |
| Agent Legend | Gear/cog icon + "AGENT LEGEND" text | "Lead Conversion" | — |
| Aiva | Red circle icon + "Aiva" text | "Lead Conversion" | — |
| CallAction | CallAction logo | "Lead Conversion" | — |
| RealScout | House icon + "RealScout Capture. Engage. Convert." | "Lead Engagement" | — |
| StreetText | StreetText logo | "Lead Generation" | — |
| Verify (by CallAction) | Checkmark + "VERIFY by CalAction" | "Other" | — |

Total: 12 cards in this section.

---

### 4.4 Section: IDX Integrations

Section heading: **"IDX Integrations"** (H2)

All cards in this section use the category label: **"Website"**

| Card | Logo |
|---|---|
| AgentFire | White text logo on dark blue background |
| Ylopo | Ylopo house icon + text |
| Sierra Interactive | Sierra Interactive circular logo on dark background |
| RealGeeks | Cartoon robot/mascot + "RealGeeks" text |
| IDX | "IDX" bold green text logo |
| RealSavvy | House icon + "RealSavvy" text (with "Scrolled" interaction indicator visible in f03) |
| Showcase IDX | "Showcase IDX" text logo on black background |
| Union Street Media | "UNION STREET MEDIA" text logo with swoosh graphic |

Total: 8 cards in this section.

---

### 4.5 Section: Inbox Apps

Section heading: **"Inbox Apps"** (H2)

| Card | Logo | Category Label |
|---|---|---|
| Ylopo | Ylopo logo | "Ylopo AI Text" |
| Texting Betty | Speech bubble + "Texting Betty" text | "Texting Betty" |
| Leadngage | "Leadngage" chat bubble logo | "Leadngage" |
| CallAction (Inbox) | "CallAction · Follow Up Boss Inbox App" | "CallAction" |
| Conversations by StreetText | Chat icon + "Conversations by StreetText" | "StreetText" |
| Agent Legend | Gear icon + "AGENT LEGEND" | "Agent Legend" |
| RealScout | "RealScout Capture. Engage. Convert." | "RealScout" |
| Callingly | Callingly logo | "Callingly" |
| Follow Up Boss | FUB arrow logo | (partially visible at bottom of f03) |
| [one more partially cut off] | — | — |

Total: at least 9 visible cards (bottom of section cut off in frames).

---

### 4.6 Integration Card Component Spec

```
┌────────────────────────────────────┐
│                                    │  ← white card, rounded corners ~8-10px
│   [optional status badge ●]        │  ← top-right corner overlay
│                                    │
│         [LOGO / IMAGE]             │  ← centered, ~60-80% card width
│                                    │
│         Category Label             │  ← text below logo, centered, ~14px
│                                    │
└────────────────────────────────────┘
```

- Status badge variants: green circle with white checkmark (connected), orange triangle/circle (warning/attention)
- Hover state: not captured, but expected to show elevation/shadow change + cursor:pointer
- Click action: opens integration detail panel/page (demonstrated with Pixel in f06/f07)

---

## 5. Pixel Integration Detail (f06 · f07)

**Navigation path:** Admin > Integrations > [click "Pixel" card]  
**Left panel:** static info panel  
**Right panel:** tabbed content panel

### 5.1 Layout Structure

Two-column layout:
- **Left column** (~35% width): Integration info card
- **Right column** (~65% width): Tabbed detail panel

### 5.2 Left Column — Integration Info Card

```
┌──────────────────────────────────┐
│   [FUB Arrow Logo]               │
│   Pixel                          │
│   by Follow Up Boss              │
│                                  │
│   Category: Website Tracking     │
│   Website: followupboss.com      │
│                                  │
│   The Follow Up Boss Pixel lets  │
│   you see who visited your       │
│   website recently and what they │
│   did so you can follow up with  │
│   them quickly, personalize your │
│   message and close more deals.  │
│                                  │
│   ← Go back                      │
└──────────────────────────────────┘
```

Exact field values:
- **Category:** Website Tracking
- **Website:** followupboss.com (hyperlinked)
- **Description:** "The Follow Up Boss Pixel lets you see who visited your website recently and what they did so you can follow up with them quickly, personalize your message and close more deals."
- **Back link:** "← Go back" (left-arrow + text, bottom of card)

### 5.3 Right Column — Tab Bar

Three tabs:
1. `☰ Description` (active in f06)
2. `⟲ Tracking` (active in f07)
3. `📞 Call To Action` (third tab, not navigated to in frames)

Tab icons are small inline icons to the left of each label.

---

### 5.4 Description Tab (f06)

Content when "Description" tab is active:

**Embedded video section:**
- FUB logo header bar above video
- Headline: **"Follow Up Boss Pixel"**
- Subtitle: "Track your visitors for Better Lead Nurturing, Prioritization, and Conversion. Generate more Calls and Texts with our mobile-friendly Call to Action 🔥"
- Play button centered over video thumbnail (duration visible: 1:39)
- Video player controls: progress bar, volume control, settings gear

**Feature bullet list (below video):**
- "Pixel supports virtually any IDX website (even multiple websites!) and installs in minutes."
- "Get a real-time view of who's on your site, **see all the pages** your leads view and create awesome personalized emails/texts."
  - "**see all the pages**" is a hyperlink (blue)
- "Drive more inbound leads with built-in **Call To Action**."
  - "**Call To Action**" is a hyperlink (blue)
- "Retarget your database with emails that link to any of your sites and identify leads who respond even if they don't register on the site."
- "Automatically tag marketing sources so you can **see which ones are working**."
  - "**see which ones are working**" is a hyperlink (blue)
- "Full details and helpful videos on what the Pixel can do for you can be found in the **help center**."
  - "**help center**" is a hyperlink (blue)

**CTA Button (bottom of right panel):**
- Button: **"Follow Up Boss Pixel Settings"** — solid blue, full width of right panel

---

### 5.5 Tracking Tab (f07)

Content when "Tracking" tab is active:

**Introductory text:**
> "You'll need to place the code below in the area of your websites that allows for JavaScript (usually the same place as Google Analytics) to be inserted."
>
> "Need help installing your code? Check our **help guides**, reach out to our **website developer**, or contact our support team at **support@followupboss.com**."

(All bolded items are hyperlinks.)

**Widget Tracker Code Block:**

```html
<!-- begin Widget Tracker Code -->
<script>
(function(w,i,d,g,e,t){w["WidgetTrackerObject"]=g;
w[g]=w[g]||function() {(w[g].q=w[g].q||[]).push(arguments)},
w[g].ds=1=new Date(), (t=d.createElement(e)),
(e=d.getElementsByTagName(e)[0]);t.async=1;t.src=i;
e.parentNode.insertBefore(t,e);})
(window,"https://widgetbe.com/agent",document,"widgetTracker");
window.widgetTracker("create", "WT-GPDMEALA7");
window.widgetTracker("send", "pageview");
</script>
<!-- end Widget Tracker Code -->
```

Note: **Tracker ID for Ryan Realty's FUB account: `WT-GPDMEALA7`**

**Code block styling:** dark background code block (monospace font), displayed inline in the panel.

**Below code block:**

```
[Copy code] (blue button with copy icon)   ...and paste on your website inside the <head> tag

Or email your web developer instructions.    (link)

[Toggle: OFF] Enable form capture and creating new leads in FUB
              If you already receive leads from your website via API or email it's
              best practice to leave this off.

[Grey status box] Waiting for tracking activity on your website

Need help with Follow Up Boss Pixel?   (link)
```

Element-by-element:
- **"Copy code" button:** blue, with clipboard icon, copies the code block to clipboard
- **"...and paste on your website inside the `<head>` tag"** — instructional text to the right of the button
- **"Or email your web developer instructions."** — link below the button
- **Toggle:** label "Enable form capture and creating new leads in FUB" — currently in **OFF** state (grey toggle)
  - Helper text: "If you already receive leads from your website via API or email it's best practice to leave this off."
- **Status bar:** "Waiting for tracking activity on your website" — greyed out/inactive state box indicating pixel has not yet fired on the site
- **Help link:** "Need help with Follow Up Boss Pixel?" (blue link)

---

## 6. Lead Flow Page (f08 · f09)

**URL context:** Admin > Lead Flow  
**Active tab:** "Lead Flow" (underlined)  
**Help link (top-right):** "How Lead Flow works" — outlined button with info icon

**Informational links (below sub-tab bar, above list):**
> "Learn about **Lead Routing** and **Advanced Lead Flow Rules**"

Both "Lead Routing" and "Advanced Lead Flow Rules" are blue hyperlinks.

### 6.1 Top Controls Row

```
                              [Unarchived ▾]    [+ Add Lead Flow] (blue button)
```

- **Filter dropdown:** "Unarchived" — with dropdown caret. Enum values inferred: Unarchived (default) / Archived / All
- **Add button:** "+ Add Lead Flow" — solid blue, right-aligned
- **Advanced Rules link (right side):** "⚙ View Advanced Rules (3)" — gear icon + link text. The "(3)" indicates 3 advanced rules currently configured.

### 6.2 Lead Flow List Entries

Each Lead Flow card/row occupies a white card spanning full width, with two rows of content:

#### Row format — top line:
`[Source Name] • [Lead Type] • [Assigned Agent] (API)`

#### Row format — second line:
`[Last lead info] • [Lead count]`  
`⚙ Advanced Settings • [#] | 🗂 Archive`  
`[Distribution pill] [Agent pill] [Lender pill] [Automation pill]`

The Distribution/Lender/Automation pills appear on the right side of the card (only when the card row is hovered or when these settings are configured — they appear in the right portion of the row).

---

**Entry 1: Ryan-Realty.com**
- **Source name:** `Ryan-Realty.com`
- **Lead type:** Buyers
- **Assigned agent:** Matt Ryan (API)
- **Last lead:** Andy Christensen · 11 days ago · 83 leads
- **Advanced Settings count:** (3) — indicates 3 advanced rules/conditions configured
- **Actions:** Advanced Settings · Archive
- **Right-side pills:** (collapsed in this view, not showing distribution details)
- Note: 83 leads total — the most active lead flow source

**Entry 2: ryanrealty.vercel.app**
- **Source name:** `ryanrealty.vercel.app`
- **Lead type:** Buyers
- **Assigned agent:** Matt Ryan (API)
- **Last lead:** Lead Deleted · 5 leads
- **Right-side pills:**
  - Distribution: `Matt Ryan (default)` (grey pill)
  - Lender: `No assigned lender` (grey pill)
  - Automation: `No automation` (grey pill)
- **Actions:** Advanced Settings · Archive

**Entry 3: expired-listing-cron**
- **Source name:** `expired-listing-cron`
- **Lead type:** Buyers
- **Assigned agent:** Matt Ryan (API)
- **Last lead:** Anna Anna Kilgore · 19 days ago · 12 leads
- **Right-side pills:**
  - Distribution: `Matt Ryan (default)`
  - Lender: `No assigned lender`
  - Automation: `No automation`
- **Actions:** Advanced Settings · Archive

**Entry 4: Expired Listing**
- **Source name:** `Expired Listing`
- **Lead type:** Buyers
- **Assigned agent:** Matt Ryan (API)
- **Status:** "Waiting for first lead" — no leads yet
- **Setup link:** `Setup Guide` (blue link, shown instead of lead-count info)
- **Right-side pills:**
  - Distribution: `Matt Ryan (default)`
  - Lender: `No assigned lender`
  - Automation: `No automation`
- **Actions:** Advanced Settings · Archive

---

### 6.3 Lead Flow Card Component Spec

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Source Name] • [Lead Type] • [Agent] (API)                  [Dist pill]   │
│ Last lead • [Name] • [N] days ago • [N] leads                [Lender pill]  │
│ ⚙ Advanced Settings • (N)   🗂 Archive                      [Auto pill]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**States:**
1. **Active with leads** — shows last lead name, days ago, total lead count
2. **Waiting for first lead** — shows "Waiting for first lead" + "Setup Guide" link
3. **Lead Deleted** — shows "Lead Deleted" where the name would be

**Pills (right column):**
- All three always visible: Distribution, Lender, Automation
- Default state: `[Agent name] (default)` / `No assigned lender` / `No automation`
- Pills are light grey with dark text, rounded, non-interactive in list view (click to edit)

**Advanced Settings expand:** clicking "Advanced Settings" likely expands inline sub-form or navigates to a detail page for that lead flow entry. The "(3)" count shown on the Ryan-Realty.com entry indicates 3 sub-rules configured for that source.

---

### 6.4 Lead Flow "Add Lead Flow" Modal (not captured)

The "+ Add Lead Flow" button is visible but not clicked in these frames. Expected fields (from FUB product knowledge):
- Source name
- Lead type (Buyers / Sellers / enum)
- Assigned agent
- Distribution rules
- Lender assignment
- Automation assignment

---

## 7. My Settings Page (f10 · f11 · f12)

**Navigation path:** Clicked avatar/user menu in top-right → "My Settings"  
**Route:** `/settings` or `/user/settings`  
**Help link (top-right):** "How Settings work" — outlined button with info icon  
**Page header:** `⚙ Settings` (gear icon + "Settings" H1)

The page is a centered card (~680px wide) with clearly delineated sections separated by horizontal rules and section-label dividers (e.g., "VCARD", "EMAIL", "MLS PROFILE VERIFICATION", "NOTIFICATIONS", "OTHER SETTINGS").

---

### 7.1 Section: Profile Fields

Standard two-column form layout (label left, input right):

| Field Label | Current Value | Input Type |
|---|---|---|
| Name | Matt Ryan | Text input |
| Phone | (541) 213-6706 | Text input |
| Time Zone | Pacific Time (GMT-07:00) | Select dropdown (▾ caret) |
| Portrait | [headshot thumbnail] + "Remove photo" button | File/avatar upload |
| Login Email | matt@ryan-realty.com | Text input (disabled-looking) |
| — | ✓ Email verified (green checkmark + text) | Status display |
| — | Reset password (blue link) | Link |

Notes:
- **Time Zone** has a dropdown arrow (▾) to the right of the value
- **Portrait** shows the current headshot (Matt Ryan's headshot, small circle/square thumbnail) alongside a "Remove photo" secondary button
- **Login Email** has two sub-elements below: "Email verified" status with checkmark (green), and "Reset password" link (blue, right-aligned)

---

### 7.2 Section: VCARD

Section divider label: `VCARD` (all-caps, centered, acting as a horizontal rule label)

This section shows Matt's digital business card / contact card. It is a read-only preview with an "Edit Card Details" link top-right.

**vCard Preview Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [Headshot]   Matt Ryan                    Edit Card Details│
│               Ryan Realty                                   │
│               Principal Broker                               │
├──────────────────────────────┬──────────────────────────────┤
│ Phones                       │ Emails                       │
│ (541) 872-3851               │ matt@ryan-realty.com         │
│ Business                     │ Business                     │
│ (541) 213-6706               │ team@ryan-realty.com         │
│ Business                     │ Business                     │
├──────────────────────────────┼──────────────────────────────┤
│ Addresses                    │ URLs                         │
│ 115 Nw Oregon Ave. #2        │ ryan-realty.com/matt-ryan/   │
│ Bend, Oregon 97703,          │ Business                     │
│ United States                │ facebook.com/RyanRealtyBend  │
│ Business                     │ Business                     │
│                              │ youtube.com/@Ryan-Realty     │
│                              │ Business                     │
│                              │ instagram.com/ryanrealtybend/│
│                              │ Business                     │
│                              │ linkedin.com/company/        │
│                              │ ryan-realty-llc-bend-o       │
│                              │ Business                     │
│                              │ x.com/RyanRealtyBend         │
│                              │ Business                     │
└──────────────────────────────┴──────────────────────────────┘
```

**Exact values captured:**

Phones:
- (541) 872-3851 — Business
- (541) 213-6706 — Business

Emails:
- matt@ryan-realty.com — Business
- team@ryan-realty.com — Business

Addresses:
- 115 Nw Oregon Ave. #2, Bend, Oregon 97703, United States — Business

URLs:
- ryan-realty.com/matt-ryan/ — Business
- facebook.com/RyanRealtyBend — Business
- youtube.com/@Ryan-Realty — Business
- instagram.com/ryanrealtybend/ — Business
- linkedin.com/company/ryan-realty-llc-bend-o — Business
- x.com/RyanRealtyBend — Business

---

### 7.3 Section: EMAIL

Section divider label: `EMAIL` (all-caps, centered divider)

**Connected Email row:**
```
Connected Email    matt@ryan-realty.com (google)   [Disconnect]
                   ☑ Share your emails    ⓘ Learn more
                   ☑ Share your calendar
```

- Label: "Connected Email"
- Value: `matt@ryan-realty.com (google)` — provider in parentheses
- "Disconnect" link (blue) — right-aligned
- Checkbox 1 (checked): "Share your emails" + "ⓘ Learn more" info button
- Checkbox 2 (checked): "Share your calendar"

Both checkboxes are checked (blue checkmarks).

---

### 7.4 Section: Signature

**Signature row:**
```
Signature
    ┌──────────────────────────────────┐
    │ Preview                   ✏ Edit │
    │                                  │
    │ [headshot]  Matt Ryan            │
    │             Owner & Principal    │
    │             Broker · Ryan        │
    │             Realty LLC           │
    │                                  │
    │             541.703.3095         │
    │             matt@ryan-realty.com │
    │             ryan-realty.com      │
    │                                  │
    │ Building community through       │
    │ authentic relationships and      │
    │ exceptional customer service.    │
    │                                  │
    │ [Ryan Realty logo]               │
    │ Read our Google reviews ·        │
    │ Oregon Initial Agency Disclosure │
    │ Pamphlet                         │
    │                                  │
    │ Ryan Realty LLC · Oregon         │
    │ Principal Broker #201206613 ·    │
    │ Equal Housing Opportunity · Not  │
    │ a solicitation of listings under │
    │ contract with another broker.    │
    └──────────────────────────────────┘
```

**Exact signature content (verbatim):**

Line 1: **Matt Ryan**  
Line 2: Owner & Principal Broker · Ryan Realty LLC  
Line 3: 541.703.3095  
Line 4: matt@ryan-realty.com  
Line 5: ryan-realty.com  
Line 6: *(blank)*  
Line 7 (italic): *Building community through authentic relationships and exceptional customer service.*  
Line 8: *(blank)*  
[Ryan Realty logo image block]  
Link row: "Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet"  
Disclosure line: "Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker."

**UI controls:**
- Section label: "Signature" (field label, left column)
- Preview box: white inner card, header row shows "Preview" (left) + "✏ Edit" (right, blue link with pencil icon)
- Click "Edit" opens the signature editor (not captured in these frames)

**Signature editor (not directly captured):**
- Expected to be a rich-text / HTML editor
- Accessed via the "✏ Edit" link in the Preview box

---

### 7.5 Section: MLS PROFILE VERIFICATION

Section divider label: `MLS PROFILE VERIFICATION` (all-caps, centered)

```
┌────────────────────────────────────────────────────────────┐
│ MLS Profile Membership                        [Disconnect] │
│ MLS Agent ID: c10676                                       │
│                                                            │
│  [Add a profile]  (white button, bordered)                 │
└────────────────────────────────────────────────────────────┘
```

**Fields:**
- Section title: "MLS Profile Membership"
- MLS Agent ID: `c10676`
- "Disconnect" link (blue, top-right of the card)
- "Add a profile" — white/outlined button (below the agent ID, left-aligned)

The "Add a profile" button likely opens a modal or inline form to add additional MLS memberships/profiles. The current connected profile shows Agent ID `c10676`.

---

### 7.6 Section: NOTIFICATIONS

Section divider label: `NOTIFICATIONS` (all-caps, centered)

```
Preferences    [Manage Notification Settings]  (blue link)
               ☑ Receive daily hot sheet emails
```

**Elements:**
- Label: "Preferences"
- "Manage Notification Settings" — blue link (opens full notification settings page)
- Checkbox (checked): "Receive daily hot sheet emails"

The "Manage Notification Settings" link navigates to a separate, more detailed notifications configuration page (not captured in these frames).

---

### 7.7 Section: OTHER SETTINGS

Section divider label: `OTHER SETTINGS` (all-caps, centered)

```
User Merge Field    [________________] ⓘ
```

**Elements:**
- Label: "User Merge Field"
- Input: empty text input
- Info icon (ⓘ) to the right of the input — tooltip/help popover on hover

The "User Merge Field" is a custom value associated with this user account that can be referenced in email/text merge tags (e.g., `{{agent.merge_field}}`).

---

### 7.8 Save Button

```
                                            [Save]  (solid blue, right-aligned)
```

- Single "Save" button at the very bottom of the Settings page
- Solid blue, medium size, right-aligned within the card
- Saves all sections (Profile, vCard, Email, Signature, MLS, Notifications, Other Settings) as a single form

---

## 8. Component Tree for Responsive-Web Rebuild

### 8.1 Integrations Page

```
<AdminIntegrationsPage>
  <AdminSubTabBar activeTab="integrations" />
  <PageHeader>
    <HelpLink href="integrations-help">How Integrations work</HelpLink>
  </PageHeader>

  <IntegrationSection title="Email Marketing">
    <IntegrationGrid columns={3}>
      <IntegrationCard
        logo={<MailchimpLogo />}
        label="Newsletters"
        badge="warning"           // orange badge — disconnected/attention
      />
      <IntegrationCard
        logo={<BombBombLogo />}
        label="Videos"
      />
      <IntegrationCard
        logo={<SendGridLogo />}
        label="Batch Email Provider"
      />
    </IntegrationGrid>
  </IntegrationSection>

  <IntegrationSection title="Integrations">
    <IntegrationGrid columns={3}>
      <IntegrationCard logo={<FUBPixelLogo />}     label="Follow Up Boss Pixel"   />
      <IntegrationCard logo={<FacebookLogo />}     label="Lead Provider"          badge="connected" />
      <IntegrationCard logo={<MojoLogo />}         label="Outbound Prospecting"   />
      <IntegrationCard logo={<ZapierLogo />}       label="Other"                  />
      <IntegrationCard logo={<ZillowPALogo />}     label="Lead Provider"          />
      <IntegrationCard logo={<SpacioLogo />}       label="Lead Provider"          />
      <IntegrationCard logo={<AgentLegendLogo />}  label="Lead Conversion"        />
      <IntegrationCard logo={<AivaLogo />}         label="Lead Conversion"        />
      <IntegrationCard logo={<CallActionLogo />}   label="Lead Conversion"        />
      <IntegrationCard logo={<RealScoutLogo />}    label="Lead Engagement"        />
      <IntegrationCard logo={<StreetTextLogo />}   label="Lead Generation"        />
      <IntegrationCard logo={<VerifyLogo />}       label="Other"                  />
    </IntegrationGrid>
  </IntegrationSection>

  <IntegrationSection title="IDX Integrations">
    <IntegrationGrid columns={4}>
      <IntegrationCard logo={<AgentFireLogo />}     label="Website" />
      <IntegrationCard logo={<YlopoLogo />}         label="Website" />
      <IntegrationCard logo={<SierraInteractiveLogo />} label="Website" />
      <IntegrationCard logo={<RealGeeksLogo />}     label="Website" />
      <IntegrationCard logo={<IDXLogo />}           label="Website" />
      <IntegrationCard logo={<RealSavvyLogo />}     label="Website" />
      <IntegrationCard logo={<ShowcaseIDXLogo />}   label="Website" />
      <IntegrationCard logo={<UnionStreetMediaLogo />} label="Website" />
    </IntegrationGrid>
  </IntegrationSection>

  <IntegrationSection title="Inbox Apps">
    <IntegrationGrid columns={4}>
      <IntegrationCard logo={<YlopoLogo />}         label="Ylopo AI Text"  />
      <IntegrationCard logo={<TextingBettyLogo />}  label="Texting Betty"  />
      <IntegrationCard logo={<LeadngageLogo />}     label="Leadngage"      />
      <IntegrationCard logo={<CallActionInboxLogo />} label="CallAction"   />
      <IntegrationCard logo={<StreetTextConversationsLogo />} label="StreetText" />
      <IntegrationCard logo={<AgentLegendLogo />}   label="Agent Legend"   />
      <IntegrationCard logo={<RealScoutLogo />}     label="RealScout"      />
      <IntegrationCard logo={<CallinglyLogo />}     label="Callingly"      />
      {/* ...additional inbox apps at bottom of section */}
    </IntegrationGrid>
  </IntegrationSection>
</AdminIntegrationsPage>
```

### 8.2 Pixel Integration Detail Page

```
<IntegrationDetailPage>
  <IntegrationDetailLayout>
    <IntegrationInfoPanel>
      <IntegrationLogo />           {/* FUB Pixel logo */}
      <IntegrationName>Pixel by Follow Up Boss</IntegrationName>
      <IntegrationMeta>
        <MetaItem label="Category">Website Tracking</MetaItem>
        <MetaItem label="Website">
          <Link href="https://followupboss.com">followupboss.com</Link>
        </MetaItem>
      </IntegrationMeta>
      <IntegrationDescription>
        The Follow Up Boss Pixel lets you see who visited your website
        recently and what they did so you can follow up with them
        quickly, personalize your message and close more deals.
      </IntegrationDescription>
      <BackLink href="/admin/integrations">Go back</BackLink>
    </IntegrationInfoPanel>

    <IntegrationDetailPanel>
      <TabBar>
        <Tab icon="list" label="Description" />
        <Tab icon="tracking" label="Tracking" />
        <Tab icon="phone" label="Call To Action" />
      </TabBar>

      {/* Description tab */}
      <DescriptionTabContent>
        <VideoEmbed
          title="Follow Up Boss Pixel"
          subtitle="Track your visitors for Better Lead Nurturing..."
          duration="1:39"
        />
        <FeatureBulletList>
          <li>Supports virtually any IDX website (even multiple websites!) and installs in minutes.</li>
          <li>Real-time view of who's on your site... <a>see all the pages</a></li>
          <li>Drive more inbound leads with built-in <a>Call To Action</a></li>
          <li>Retarget your database with emails...</li>
          <li>Automatically tag marketing sources... <a>see which ones are working</a></li>
          <li>Full details... <a>help center</a></li>
        </FeatureBulletList>
        <CTAButton primary>Follow Up Boss Pixel Settings</CTAButton>
      </DescriptionTabContent>

      {/* Tracking tab */}
      <TrackingTabContent>
        <InstructionText>
          You'll need to place the code below in the area of your websites
          that allows for JavaScript (usually the same place as Google
          Analytics) to be inserted.
        </InstructionText>
        <HelpLinks>
          <Link>help guides</Link>
          <Link>website developer</Link>
          <Link>support@followupboss.com</Link>
        </HelpLinks>
        <CodeBlock language="html">
          {pixelWidgetCode}  {/* WT-GPDMEALA7 tracker */}
        </CodeBlock>
        <CodeActions>
          <Button icon="copy">Copy code</Button>
          <span>and paste on your website inside the &lt;head&gt; tag</span>
        </CodeActions>
        <Link>Or email your web developer instructions.</Link>
        <Toggle
          label="Enable form capture and creating new leads in FUB"
          defaultValue={false}
          helperText="If you already receive leads from your website via API or email it's best practice to leave this off."
        />
        <TrackingStatus state="waiting">
          Waiting for tracking activity on your website
        </TrackingStatus>
        <Link>Need help with Follow Up Boss Pixel?</Link>
      </TrackingTabContent>
    </IntegrationDetailPanel>
  </IntegrationDetailLayout>
</IntegrationDetailPage>
```

### 8.3 Lead Flow Page

```
<AdminLeadFlowPage>
  <AdminSubTabBar activeTab="lead-flow" />
  <PageHeader>
    <InfoLinks>
      Learn about <Link>Lead Routing</Link> and <Link>Advanced Lead Flow Rules</Link>
    </InfoLinks>
    <Controls>
      <Select value="Unarchived" options={["Unarchived", "Archived", "All"]} />
      <Button primary icon="plus">Add Lead Flow</Button>
    </Controls>
    <AdvancedRulesLink>
      <Icon name="gear" /> View Advanced Rules (3)
    </AdvancedRulesLink>
  </PageHeader>

  <LeadFlowList>
    <LeadFlowCard
      sourceName="Ryan-Realty.com"
      leadType="Buyers"
      assignedAgent="Matt Ryan"
      apiSource={true}
      lastLead={{ name: "Andy Christensen", daysAgo: 11 }}
      totalLeads={83}
      advancedSettingsCount={3}
      distribution="Matt Ryan (default)"
      lender="No assigned lender"
      automation="No automation"
    />
    <LeadFlowCard
      sourceName="ryanrealty.vercel.app"
      leadType="Buyers"
      assignedAgent="Matt Ryan"
      apiSource={true}
      lastLead={{ name: "Lead Deleted", daysAgo: null }}
      totalLeads={5}
      distribution="Matt Ryan (default)"
      lender="No assigned lender"
      automation="No automation"
    />
    <LeadFlowCard
      sourceName="expired-listing-cron"
      leadType="Buyers"
      assignedAgent="Matt Ryan"
      apiSource={true}
      lastLead={{ name: "Anna Anna Kilgore", daysAgo: 19 }}
      totalLeads={12}
      distribution="Matt Ryan (default)"
      lender="No assigned lender"
      automation="No automation"
    />
    <LeadFlowCard
      sourceName="Expired Listing"
      leadType="Buyers"
      assignedAgent="Matt Ryan"
      apiSource={true}
      waitingForFirstLead={true}
      setupGuideLink={true}
      distribution="Matt Ryan (default)"
      lender="No assigned lender"
      automation="No automation"
    />
  </LeadFlowList>
</AdminLeadFlowPage>
```

### 8.4 My Settings Page

```
<UserSettingsPage>
  <PageHeader icon="gear" title="Settings">
    <HelpLink>How Settings work</HelpLink>
  </PageHeader>

  <SettingsCard>
    {/* Profile Section */}
    <FormField label="Name">
      <TextInput value="Matt Ryan" />
    </FormField>
    <FormField label="Phone">
      <TextInput value="(541) 213-6706" />
    </FormField>
    <FormField label="Time Zone">
      <Select value="Pacific Time (GMT-07:00)" />
    </FormField>
    <FormField label="Portrait">
      <AvatarUpload currentImage={headshot} />
      <Button secondary>Remove photo</Button>
    </FormField>
    <FormField label="Login Email">
      <TextInput value="matt@ryan-realty.com" readOnly />
      <StatusBadge variant="success">Email verified</StatusBadge>
      <Link>Reset password</Link>
    </FormField>

    <SectionDivider label="VCARD" />
    <VCardPreview>
      <VCardHeader>
        <Avatar src={headshot} />
        <VCardName>Matt Ryan</VCardName>
        <VCardTitle>Ryan Realty</VCardTitle>
        <VCardSubtitle>Principal Broker</VCardSubtitle>
        <EditLink>Edit Card Details</EditLink>
      </VCardHeader>
      <VCardGrid>
        <VCardSection title="Phones">
          <VCardItem label="Business">(541) 872-3851</VCardItem>
          <VCardItem label="Business">(541) 213-6706</VCardItem>
        </VCardSection>
        <VCardSection title="Emails">
          <VCardItem label="Business">matt@ryan-realty.com</VCardItem>
          <VCardItem label="Business">team@ryan-realty.com</VCardItem>
        </VCardSection>
        <VCardSection title="Addresses">
          <VCardItem label="Business">
            115 Nw Oregon Ave. #2, Bend, Oregon 97703, United States
          </VCardItem>
        </VCardSection>
        <VCardSection title="URLs">
          <VCardItem label="Business">ryan-realty.com/matt-ryan/</VCardItem>
          <VCardItem label="Business">facebook.com/RyanRealtyBend</VCardItem>
          <VCardItem label="Business">youtube.com/@Ryan-Realty</VCardItem>
          <VCardItem label="Business">instagram.com/ryanrealtybend/</VCardItem>
          <VCardItem label="Business">linkedin.com/company/ryan-realty-llc-bend-o</VCardItem>
          <VCardItem label="Business">x.com/RyanRealtyBend</VCardItem>
        </VCardSection>
      </VCardGrid>
    </VCardPreview>

    <SectionDivider label="EMAIL" />
    <FormField label="Connected Email">
      <ConnectedEmailDisplay
        email="matt@ryan-realty.com"
        provider="google"
      />
      <Link>Disconnect</Link>
      <Checkbox checked label="Share your emails">
        <InfoButton>Learn more</InfoButton>
      </Checkbox>
      <Checkbox checked label="Share your calendar" />
    </FormField>

    <FormField label="Signature">
      <SignaturePreview>
        <PreviewLabel>Preview</PreviewLabel>
        <EditButton icon="pencil">Edit</EditButton>
        <SignatureHTML>
          {/* rendered HTML signature with headshot, name, title,
              phone, email, website, tagline, logo, links, disclaimer */}
        </SignatureHTML>
      </SignaturePreview>
    </FormField>

    <SectionDivider label="MLS PROFILE VERIFICATION" />
    <MLSProfileSection>
      <MLSCard>
        <MLSCardTitle>MLS Profile Membership</MLSCardTitle>
        <MLSAgentId>MLS Agent ID: c10676</MLSAgentId>
        <Link>Disconnect</Link>
        <Button secondary>Add a profile</Button>
      </MLSCard>
    </MLSProfileSection>

    <SectionDivider label="NOTIFICATIONS" />
    <FormField label="Preferences">
      <Link>Manage Notification Settings</Link>
      <Checkbox checked label="Receive daily hot sheet emails" />
    </FormField>

    <SectionDivider label="OTHER SETTINGS" />
    <FormField label="User Merge Field">
      <TextInput value="" placeholder="" />
      <InfoIcon tooltip="..." />
    </FormField>

    <FormActions>
      <Button primary>Save</Button>
    </FormActions>
  </SettingsCard>
</UserSettingsPage>
```

---

## 9. Exact Text Transcriptions (Verbatim)

### 9.1 Admin Overflow Dropdown Items
```
Integrations
Company
API
Appointments
Email Domain Authentication
```

### 9.2 Pixel Description Bullets (verbatim)
```
"Pixel supports virtually any IDX website (even multiple websites!) and installs in minutes."

"Get a real-time view of who's on your site, see all the pages your leads view and create awesome personalized emails/texts."

"Drive more inbound leads with built-in Call To Action."

"Retarget your database with emails that link to any of your sites and identify leads who respond even if they don't register on the site."

"Automatically tag marketing sources so you can see which ones are working."

"Full details and helpful videos on what the Pixel can do for you can be found in the help center."
```

### 9.3 Pixel Tracking Tab Instruction Text (verbatim)
```
"You'll need to place the code below in the area of your websites that allows for JavaScript (usually the same place as Google Analytics) to be inserted."

"Need help installing your code? Check our help guides, reach out to our website developer, or contact our support team at support@followupboss.com."
```

### 9.4 Pixel Widget Tracker Code (verbatim)
```html
<!-- begin Widget Tracker Code -->
<script>
(function(w,i,d,g,e,t){w["WidgetTrackerObject"]=g;
w[g]=w[g]||function() {(w[g].q=w[g].q||[]).push(arguments)},
w[g].ds=1=new Date(), (t=d.createElement(e)),
(e=d.getElementsByTagName(e)[0]);t.async=1;t.src=i;
e.parentNode.insertBefore(t,e);})
(window,"https://widgetbe.com/agent",document,"widgetTracker");
window.widgetTracker("create", "WT-GPDMEALA7");
window.widgetTracker("send", "pageview");
</script>
<!-- end Widget Tracker Code -->
```

Tracker account ID: **WT-GPDMEALA7**

### 9.5 Pixel Form Capture Toggle Helper Text (verbatim)
```
"If you already receive leads from your website via API or email it's best practice to leave this off."
```

### 9.6 Lead Flow Info Links (verbatim)
```
"Learn about Lead Routing and Advanced Lead Flow Rules"
```

### 9.7 My Settings Signature (verbatim)
```
Matt Ryan
Owner & Principal Broker · Ryan Realty LLC

541.703.3095
matt@ryan-realty.com
ryan-realty.com

Building community through authentic relationships and exceptional customer service.

[Ryan Realty logo]
Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet
Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker.
```

### 9.8 MLS Profile Data (verbatim)
```
MLS Profile Membership
MLS Agent ID: c10676
```

### 9.9 Footer Trial Banner (verbatim — visible in all frames)
```
"You have 14 days left on your trial"   [Upgrade Now] (green/teal button)
```

---

## 10. Frame-by-Frame State Log

| Frame | Page / State | Key Change |
|---|---|---|
| f01 | Admin > Appointments — overflow dropdown open | Dropdown shows 5 items including "Email Domain Authentication". Current page shows Appointment Types (Buyer consultation, Listing) + Appointment Outcomes (No show, Working with buyers, Listing obtained). |
| f02 | Admin > Integrations (top) | Navigated from dropdown. Shows Email Marketing section + top of Integrations section. Facebook card has green connected badge. Mailchimp has orange alert. |
| f03 | Admin > Integrations (scrolled down) | IDX Integrations section (8 cards) + Inbox Apps section (9+ cards) visible. |
| f04 | Admin > Integrations (scrolled back to top) | Same as f02 but "Scrolled" interaction indicator visible — user scrolled back up. |
| f05 | Transitional / loading state | Navigation click on avatar or settings. Content area blank. Likely navigating to My Settings. |
| f06 | Pixel Integration Detail > Description tab | Two-column layout. Left: info card with category, website, description, "Go back" link. Right: Description tab active — FUB Pixel marketing video + feature bullets + "Follow Up Boss Pixel Settings" CTA. |
| f07 | Pixel Integration Detail > Tracking tab | Same left panel. Right: Tracking tab active — installation instructions, full widget code block, Copy code button, form capture toggle (OFF), waiting status. |
| f08 | Lead Flow loading state | Navigation to Lead Flow. Content area blank/loading. "How Lead Flow works" help link visible. |
| f09 | Admin > Lead Flow — loaded | 4 lead flow entries visible. "View Advanced Rules (3)" link. Filter dropdown shows "Unarchived". All 4 entries show Distribution/Lender/Automation pills. |
| f10 | My Settings — Profile + vCard sections | Settings card loaded. Profile fields: Name (Matt Ryan), Phone ((541) 213-6706), Time Zone (Pacific Time GMT-07:00), Portrait (headshot + Remove photo), Login Email (matt@ryan-realty.com + verified + reset password). vCard preview with 6 URL entries. |
| f11 | My Settings — Email + Signature + MLS + Notifications | EMAIL section: connected to matt@ryan-realty.com (google), both share checkboxes checked. Signature preview shown. MLS: c10676 connected. Notifications: Manage link + "Receive daily hot sheet emails" checked. "Scrolled" indicator. |
| f12 | My Settings — same as f11 (stable state) | Nearly identical to f11. "wait" browser indicator visible. Bottom of page with Save button visible in q4. |

---

## 11. Gaps and Build Notes for Spec §14/§15/§18

### Gap 1: Email Domain Authentication page content
- **What's missing:** The actual page content for `/admin/email-domain-authentication`
- **What we know:** The page exists as a named menu item in the overflow dropdown
- **Build recommendation:** Pull from FUB's published help docs. Expected fields: domain input, DNS record table (SPF / DKIM / DMARC TXT records with copy buttons), verification status per domain, "Add Domain" CTA button, "Verify" button per record.

### Gap 2: Pixel "Call To Action" tab
- **What's missing:** The third tab ("Call To Action") of the Pixel detail page
- **What we know:** Tab label and icon visible, tab not clicked in recording
- **Build recommendation:** This tab likely configures the FUB Pixel popup/banner that appears on the website to capture visitor leads. Expected controls: enable/disable toggle, CTA text editor, button text, phone number to display, popup timing settings.

### Gap 3: Lead Flow Advanced Settings modal
- **What's missing:** The expanded "Advanced Settings" panel for any lead flow entry
- **What we know:** "(3)" count visible on Ryan-Realty.com entry indicates 3 rules
- **Build recommendation:** Advanced Settings likely includes: lead type filtering, source URL matching rules, time-of-day routing, round-robin vs fixed assignment, lender assignment rules.

### Gap 4: Add Lead Flow modal
- **What's missing:** The modal/form opened by "+ Add Lead Flow"
- **What we know:** Button text and position confirmed. "Unarchived" filter implies an archiveable state machine.

### Gap 5: Signature editor
- **What's missing:** The rich-text editor opened by clicking "✏ Edit" in the Signature section
- **What we know:** The rendered output signature is fully captured (see §9.7)

### Gap 6: Manage Notification Settings page
- **What's missing:** The full notification preferences page linked from Settings
- **What we know:** Link text: "Manage Notification Settings". One visible toggle: "Receive daily hot sheet emails" (checked).

### Gap 7: Integrations Inbox Apps — bottom of section
- **What's missing:** The last 2–3 Inbox App cards (partially cut off at bottom of f03)
- **What we know:** At least one more Follow Up Boss entry visible partially

---

## 12. Live Account Data Points (Ryan Realty / Matt Ryan)

| Data Point | Value | Source Frame |
|---|---|---|
| FUB Pixel Tracker ID | WT-GPDMEALA7 | f07 |
| FUB Pixel widget domain | widgetbe.com | f07 |
| Pixel form capture toggle | OFF | f07 |
| Facebook integration | Connected (green badge) | f02 |
| Mailchimp | Warning / attention needed | f02 |
| Lead Flow sources | Ryan-Realty.com, ryanrealty.vercel.app, expired-listing-cron, Expired Listing | f09 |
| Total leads (Ryan-Realty.com) | 83 | f09 |
| Total leads (expired-listing-cron) | 12 | f09 |
| Total leads (ryanrealty.vercel.app) | 5 | f09 |
| Advanced rules count | 3 | f09 |
| Default distribution agent | Matt Ryan (default) | f09 |
| Login email | matt@ryan-realty.com | f10 |
| Provider | Google | f11 |
| Time zone | Pacific Time (GMT-07:00) | f10 |
| MLS Agent ID | c10676 | f11 |
| vCard phones | (541) 872-3851, (541) 213-6706 | f10 |
| vCard emails | matt@ryan-realty.com, team@ryan-realty.com | f10 |
| vCard address | 115 Nw Oregon Ave. #2, Bend, OR 97703 | f10 |
| Signature phone | 541.703.3095 (FUB-tracked) | f11 |
| Trial status | 14 days remaining | all frames |

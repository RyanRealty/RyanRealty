<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §13 Email & Text template editor -->

# §13 Templates — Exhaustive Buildable Analysis
**Source:** 12-frame FUB desktop screen-recording (templates flow)
**Produced:** 2026-06-30
**Coverage:** Email Templates index → folder tree → list view → email editor modal (subject, body, formatting toolbar, merge-field picker) → Text Templates index → text list view → text editor modal (merge-field picker, share, folders) → Action Plan context

---

## 0. Navigation Context

### Global top nav (all frames)
```
[FUB logo "wait"] | People | Inbox | Tasks | Calendar | Deals | Reporting | Admin(active)
                                                     [Search bar]  [icons: email, chat, person, bell, avatar]
```

### Admin sub-nav tabs (all frames — exact labels in order)
```
Overview | Lead Flow | Groups | Team | Action Plans | Automations | Ponds |
Email Templates(active) | Text Templates | Import | Custom Fields | Calling |
Stages | Phone Numbers | Tags | More ▾
                                              [Admin Overview button — top right]
```

### Breadcrumb pattern
- Email Templates index: none (just page heading)
- Email list: `Email Templates › My Email Templates`
- Text index: none (just page heading)
- Text list: `Text Templates › My Text Templates`

---

## 1. Frame-by-Frame State Inventory

### FRAME 1 — Automation canvas (context: how templates are consumed)
**Screen:** Automations canvas for "Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]"
**Status toggle:** DISABLED (toggle off) | "Save Changes" button | gear icon | share icon

**Left panel — Trigger library sidebar:**
- Search field (empty)
- Two tabs: "Triggers" | "Steps"
- Instruction text: "Start by dragging a Trigger to the canvas"
- Trigger cards visible:
  - `Stage Change` — draggable (shown being dragged with dashed outline)
  - `Deal Stage Change` — Start an automation when the deal stage is changed
  - `Inquiry` — Start an automation when there is a new general inquiry
  - `Property Saved` — Start an automation when a property is saved
  - `Property Viewed` — Start an automation when a property is viewed
  - `Calendar Date` — Start an automation when a deal closing date or custom date (cut off)
  - `Appointment` — Start an automation when an appointment is added to your calendar
  - `Manual` — Start the automation by hand

**Canvas — automation flow (right):**
Step 1: `Tag Added` — When tag is one of: audience:buyer
Step 2: `Send Email` (highlighted/selected, blue border)
- "BL-01 Your Bend search is set up · Agent assigned to the contact"
Step 3: `Create Task` — Test this buyer lead now (day 0) — use the BL-S1 Buyer SMS…
Step 4: `Create Task` — Send first matched-listings batch to this buyer within 30 min · Follow U...
↓ 2 days delay badge
Step 5: `Send Email` — Two things that move buyers · Agent assigned to the...
↓ 8 days delay badge
Step 6: `Send Email` — What to know about your top areas · Agent assigned to the...
↓ 11 days delay badge
Step 7: `Send Email` — What's moving in your budget range · Agent assigned to the...

**Right side-panel — "Send Email" action config:**
```
Send Email
Send an email

Template
  [text field] BL-01 Your Bend search is set up

From
  [dropdown] Agent assigned to the contact

Recipient Preferences
  (●) Send to primary contact only
  ( ) Send to contact and all relationships
  ( ) Send to assigned agent

Delivery Preferences
  (●) Send immediately
  ( ) Send between 8:00 am and 7:00 pm
  ( ) Send during company office hours
  ( ) Send at custom time

[trash icon] Delete
```

**Key data for spec:** The "Template" field in the Send Email action is a single-line text/dropdown showing the template name. The "From" field is a dropdown with at least "Agent assigned to the contact." Delivery has 4 radio enum options.

---

### FRAME 2 — Email Templates index (folder list)
**URL context:** Admin > Email Templates (top-level)
**Page heading:** `4 Email Template Folders`
**Top-right controls:**
- `Search Templates` [text input with search icon]
- `+ Email Template` [green/primary button]
- `+ Folder` [green outline button]
- `How Email Templates work` [link with info icon — top far right]

**Folder table — columns:** Name | Email Templates | Actions

**Folder rows:**
| Name | Email Templates | Actions |
|------|----------------|---------|
| All Email Templates | 76 | — |
| My Email Templates | 76 | — |
| Used by Action Plans | 45 | — |
| Follow Up Boss | 0 | ✏️ 🗑️ |

**Visual detail:**
- Each row has a folder icon (dark grey stacked-pages icon) left of the name
- "Follow Up Boss" folder row has a drag handle (six-dot grid) far left + nested folder icon (different style — appears to be a shared/system folder)
- Only the "Follow Up Boss" folder shows Actions icons (pencil/edit + trash/delete) — the system smart folders (All, My, Used by Action Plans) have no action icons
- Row highlight: hover state shows action icons; "Follow Up Boss" row has them visible because it is user-created

**Footer bar (bottom of viewport):**
- `✕` dismiss icon (left)
- "You have 14 days left on your trial" | `Upgrade Now` button (right)
- Claude Code / Anthropic badge icon (far right)

---

### FRAME 3 — Email Templates list view (My Email Templates)
**Breadcrumb:** `Email Templates › My Email Templates`
**Count badge:** `76 Email Templates` + grid/list toggle icon

**Top-right controls:**
- `Search Templates` [text input + search icon]
- `+ Email Template` [green primary button]

**Table columns (exact labels with ? help icons):**
```
[checkbox] Template [↑ sort] | Folders [?] | Automations [?] | Action Plans [?] |
Sent | Opens | Clicks | Replies | Unsubscribed | Bounces [?] | Actions
```

**Template rows (all visible — exact name + preview text):**
| # | Template Name | Preview Text |
|---|--------------|-------------|
| 1 | BL-01 Your Bend search is set up | Your Bend search is set up |
| 2 | BL-02 Two things that move buyers ahead | Two things that move buyers to the front of the line... |
| 3 | BL-03 What to know about your top areas | What to know about your top areas before you tour |
| 4 | BL-04 What's moving in your budget range | What's moving in your budget range right now |
| 5 | BL-05 Are your search areas still right | Are your search areas still right? |
| 6 | BL-06 Sticking with you for the long game | Sticking with you for the long game |
| 7 | BL-S1 Buyer SMS Confirmation | [SMS] |
| 8 | BL-S2 Buyer SMS Check-in | [SMS] |
| 9 | EXP-1 Expired Five reasons listings stall | Five reasons Bend listings stall |
| 10 | EXP-2 Expired Whats closing in your neighborhood | What's actually closing in your neighborhood |
| 11 | EXP-3 Expired Personal letter intro (under 750K) | A note instead of an email |
| 12 | EXP-4 Expired Whenever youre ready | Whenever you're ready |
| 13 | EXP-5 Expired Mid-quarter market read | Bend market, mid-quarter read |
| 14 | EXP-7 Expired Moving to quarterly list | Moving you to the quarterly list |
| 15 | FSBO-1 Five things FSBOs in Bend miss | (preview truncated, below fold) |

**Column values for BL-01 through BL-06 (representative):**
- Automations: `1` + eye icon (view automations)
- Action Plans: `1` + eye icon (view action plans)
- Sent: `0`
- Opens: `—`
- Clicks: `—`
- Replies: `—`
- Unsubscribed: `—`
- Bounces: `—`
- Actions: ✏️ (edit pencil icon)

**Column values for BL-S1, BL-S2 (SMS type):**
- Automations: (empty)
- Action Plans: (empty)
- Sent: `0`
- Opens through Bounces: `—`
- Actions: ✏️

**Column values for EXP-1 through EXP-7:**
- Automations: `1` + eye icon
- Action Plans: `1` + eye icon (where applicable)
- Sent: `0`
- Opens through Bounces: `—`
- Actions: ✏️

**Row styling:** Template name is a blue/teal link. Preview text below in grey smaller font. Each row has a grey horizontal line separator. Checkboxes are grey unfilled circles on the left (not standard checkboxes — appear to be colored dot indicators, possibly a status/color tag).

---

### FRAME 4 — Email Template editor modal (open, no merge picker)
**Trigger:** Clicking the ✏️ edit icon on a template row

**Modal overlay:** White modal on dimmed background. Background list still visible but dimmed.

**Modal header:**
```
Edit Email Template                                              [✕ close]
Created on May 18th, 2026 at 8:53am by Matt Ryan
```

**Subject field row:**
```
[text input, full width] BL-01 Your Bend search is set up        [Merge Fields ▾]
```

**Preview/Subtitle field row:**
```
[text input, full width] Your Bend search is set up              [Merge Fields ▾]
```

**Formatting toolbar (rich text body editor — left to right):**
```
B  I  U  |  [ordered list]  [unordered list]  |  [link]  [image]  [emoji]  [?]  [?]  T  |  [?]
```
(Exact icon count: approximately 12-14 toolbar icons total before the body area)

**Body (rich text editor — exact verbatim content):**
```
Hi %contact_first_name%,

Thanks for the search request. I have your criteria set up for %customBuyerSearchAreas% and the first matching listings will be in your inbox within the hour. They come from the live MLS, not Zillow, so prices and statuses are current.

One question that helps me sharpen what you see. What does your ideal home look like beyond the basics? Even a few sentences gives me enough to filter out the listings you don't want to waste time looking at.

Talk soon.
```

**Below body:**
- Grey italic text: "The sender's signature from [My Settings] (link) will automatically be added."
- Checkbox (checked, blue): ☑ "Share this template with everyone"
- Label: "Folders:"
- `+` button (circular, grey) to add template to a folder

**Footer line:**
```
In use by 1 automation & 1 action plan
```

**Action buttons (bottom right):**
```
[Cancel]  [Save] (blue/primary)
```

**Modal size:** ~480px wide, vertically scrollable

---

### FRAME 5 — Email editor with Merge Fields picker open (SENDER + PROPERTY + LAST VIEWED)
**State:** Same modal as Frame 4. User has clicked one of the "Merge Fields ▾" buttons. A dropdown list appears within/below the modal.

**Merge Fields dropdown — visible sections and tokens:**

**Category: SENDER** (uppercase grey section header)
- Sender name
- Sender first name
- Sender last name
- Sender email
- Sender phone
- Sender mobile phone
- Sender merge field

**Category: PROPERTY** (uppercase grey section header)
- Inquiry address
- Inquiry address url
- Inquiry address preview

**Category: LAST VIEWED** (uppercase grey section header — partially visible, tokens cut off at bottom of dropdown)

**Dropdown styling:**
- White background
- Category headers: uppercase, smaller grey text (all-caps label style)
- Token items: normal case, dark text, full-width rows with hover highlight
- Scrollable list (vertical scroll implied by truncation)
- Appears to be a floating dropdown/popover anchored to the "Merge Fields" button

---

### FRAME 6 — Email list view (dialog closed, back to list)
**State:** Identical to Frame 3. The modal has been closed. No structural difference from Frame 3 except mouse-cursor position indicator.

---

### FRAME 7 — Text Templates index (folder list)
**Active tab:** Text Templates (underlined)
**Page heading:** `3 Text Template Folders`
**Top-right controls:**
- `Search Templates` [text input + search icon]
- `+ Text Template` [green primary button]
- `+ Folder` [green outline button]
- `How Text Templates work` [info link — top far right]

**Folder table — columns:** Name | Text Templates | Actions

**Folder rows:**
| Name | Text Templates | Actions |
|------|---------------|---------|
| All Text Templates | 37 | — |
| My Text Templates | 14 | — |
| Follow Up Boss | 19 | ✏️ 🗑️ |

**Structural difference from Email Templates index:**
- 3 folders (not 4) — no "Used by Action Plans" folder
- Text Templates count column (not "Email Templates")
- Same button pattern, same action-column behavior (only user-created folder gets edit/delete)

---

### FRAME 8 — Text Templates list view (My Text Templates)
**Breadcrumb:** `Text Templates › My Text Templates`
**Count badge:** `14 Text Templates` + grid/list toggle icon

**Top-right controls:**
- `Search Templates` [text input + search icon]
- `+ Text Template` [green primary button]

**Table columns (exact labels with ? help icons):**
```
[checkbox] Template [↑ sort] | Score [?] | Replies [?] | Opt Outs [?] | Sent [?] | Actions
```
Note: Text Templates list has DIFFERENT columns than Email Templates. No Opens/Clicks/Unsubscribed/Bounces/Folders/Automations/Action Plans. Instead: Score, Replies, Opt Outs, Sent.

**Template rows (all visible — exact name + preview snippet):**
| # | Template Name | Preview (first ~100 chars of body) |
|---|--------------|-----------------------------------|
| 1 | Crosswater | Hi, %agent_name% with Ryan Realty in Bend here. I'm helping a retiree couple find a home in Crosswater with primary living on the main floor. Inventory is really limited right now... |
| 2 | EXP-T0 — Expired listing personal intro (manual send) | Hello %contact_first_name%, Sorry that you weren't able to sell %customSellerPropertyAddress%. I know that's not the outcome anyone hopes for afte... |
| 3 | Expired - Second Message | Hi, this is %agent_name% with Ryan Realty. Just wanted to reach out one more time about %inquiry_address%. Spring is right around the corner and th... |
| 4 | Expired Listing - Initial Text | Hi, %agent_name% with Ryan Realty here. I saw your home at %inquiry_address% recently came off the market. If you're still thinking about selling, I'd love to... |
| 5 | FSBO - Cancelled FSBO | Happy New Year! This is %agent_name% with Ryan Realty. I noticed you stopped marketing %contact_street%. I specialize in helping FSBO sellers, so... |
| 6 | FSBO - Initial Contact | Happy New Year! Hi this is %agent_name% with Ryan Realty. Happy New Year! I came across your home at %contact_street% and wanted to see if I could earn your busi... |
| 7 | FSBO-T0 personal intro (manual send) | Hello %contact_first_name%, see your home for sale at %customSellerPropertyAddress%. Selling on your own is a real amount of work and I respect that... |
| 8 | Matt - out of area home owner test | Hi, %agent_name% here with Ryan Realty. I saw you own %inquiry_address%... |
| 9 | Paul - Out of State Owner | Hi, I'm %agent_name% with Ryan Realty in Bend. I was looking at property records for %inquiry_address% and noticed the mailing address is out of to... |
| 10 | Rebecca - Out Of Area Home Owner | Hi, I'm Agent Name with Ryan Realty in Bend. We specialize in helping out-of-area owners sell their Central Oregon homes with zero hassle. Our tea... |
| 11 | Ryan Realty - Expired Listing Outreach (Mar 2025) | Hi, I'm Matt Ryan with Ryan Realty. I noticed your home at %inquiry_address% came off the market. If selling is still on your mind, we'd be grate... |
| 12 | Ryan Realty - Out of State Homeowner Outreach (Mar 2025) | Hi, I'm Matt Ryan with Ryan Realty. We specialize in helping out-of-area owners sell their Central Oregon homes with zero hassle. Our team kn... |
| 13 | Ryan Realty - Remote Home Owner | Hi! %first_name%, %agent_name% with Ryan Realty in Bend. I was looking at property records for %inquiry_address% and noticed the mailing address is out o... |
| 14 | vandevert Ranch | Hello, %agent_name% Name with Ryan Realty in Bend here. Hope you're having a good weekend. I'm helping a family who has their heart set on Vandevert... |

**Score column values:** All show `Pending (--)` with a house/building icon (small grey icon)
**Replies column values:** `-- (22%)`, `-- (--)`, `-- (18%)`, `-- (20%)`, `-- (50%)`, `-- (22%)`, `-- (--)`, `-- (17%)`, `-- (--)`, `-- (14%)`, `-- (--)`, `-- (14%)`, `-- (--)`, `-- (20%)`
**Opt Outs column values:** `-- (0%)`, `-- (--)`, `-- (14%)`, `-- (10%)`, `-- (13%)`, `-- (0%)`, `-- (--)`, `-- (14%)`, `-- (--)`, `-- (10%)`, `-- (--)`, `-- (14%)`, `-- (--)`, `-- (0%)`
**Sent column values:** `0 (32)`, `0 (0)`, `0 (83)`, `0 (87)`, `0 (8)`, `0 (9)`, `0 (0)`, `0 (78)`, `0 (0)`, `0 (21)`, `0 (0)`, `0 (14)`, `0 (0)`, `0 (15)`

**Column value format interpretation:**
- Score: `Pending (--)` — "Pending" means score not yet computed; `(--)` = benchmark unknown
- Replies: `-- (22%)` — current sent count is 0 (dashes), benchmark/historical reply rate in parens
- Opt Outs: `-- (0%)` — current / historical opt-out rate
- Sent: `0 (32)` — current sends = 0, historical total sends = 32

**Actions column:** ✏️ (edit) + 🗑️ (delete) icons per row

---

### FRAME 9 — Text Template editor modal (open, body visible, no merge picker)
**Trigger:** Clicking ✏️ edit icon on "Crosswater" template row

**Modal header:**
```
Edit Text Template                                               [✕ close]
```
(No subtitle/created-by line visible — text template modal is simpler than email)

**Name field (single text input, full width at top):**
```
[text input] Crosswater
```

**Body field (plain-text textarea, multi-line — NOT rich text, no formatting toolbar):**
```
[textarea, large, multi-line]

Hi, %agent_name% with Ryan Realty in Bend here. I'm helping a retiree couple find a home in Crosswater with primary living on the main floor. Inventory is really limited right now and we haven't found something that's a good fit for them. I did some research to track down your number, so my apologies if I have the wrong contact. Any chance you'd consider selling %inquiry_address% if the numbers made sense? I'll be touring homes with them Feb 21st and 22nd if you'd be open to a showing. If you're working with another broker or not interested, no worries at all. Just doing my best for my clients. Thanks!
```

**Below textarea — single row of controls:**
```
[emoji picker icon 😊]    [Merge Fields ▾]
```

**Hint text below controls:**
```
Remember to keep text messages short
```

**Share checkbox (unchecked):**
```
□ Share this text template with everyone
```

**Folders section:**
```
Folders:
[+ button (circular blue)]
```

**"Delete" text link** visible in the bottom-left area of the modal (destructive action)

**Action buttons (bottom right):**
```
[Cancel]  [Save] (blue/primary)
```

**Critical differences from email template editor:**
- NO formatting toolbar (B/I/U/lists/link/image)
- NO subject field
- NO preview/subtitle field
- Body is a plain textarea (not rich text)
- Single "Merge Fields" button (not two)
- Emoji picker button next to merge fields
- No signature auto-add notice
- "Remember to keep text messages short" hint
- No "In use by X automation" footer line

---

### FRAME 10 — Text Template editor with Merge Fields picker open (CONTACT category)
**State:** User clicked "Merge Fields ▾" in the text template editor.

**Merge Fields dropdown — visible section:**

**Category: CONTACT** (uppercase grey section header)
- Contact name
- Contact first name
- Contact last name
- Contact and relationships first name
- Contact email
- Contact phone
- Contact address
- Contact street
- Contact city
- Contact state
- Contact zipcode

**Bottom of dropdown (truncated/partially visible — more items below scroll):**
(Remaining contact fields or next category cut off)

---

### FRAME 11 — Text Template editor (modal header detail / name field active)
**State:** Identical to Frame 9 with the name field apparently active/focused (text cursor visible in "Crosswater" field). "Clicked" interaction indicator on the header area.
**No structural changes from Frame 9.**

---

### FRAME 12 — Text Templates list (dialog closed, full list visible again)
**State:** Identical to Frame 8 list view. Modal closed. Slight scroll position shift revealing the full template list. "Clicked" cursor indicator shown on row 6 (FSBO - Initial Contact area).

---

## 2. Complete Merge Field Token Catalog

### 2A. Email Template Merge Fields (from "Merge Fields ▾" dropdown)

**Token syntax:** `%token_name%` (percent-sign delimited, snake_case)

**Category SENDER:**
| Display Label | Token (inferred from body text) |
|--------------|--------------------------------|
| Sender name | `%sender_name%` |
| Sender first name | `%sender_first_name%` |
| Sender last name | `%sender_last_name%` |
| Sender email | `%sender_email%` |
| Sender phone | `%sender_phone%` |
| Sender mobile phone | `%sender_mobile_phone%` |
| Sender merge field | `%sender_merge_field%` |

**Category PROPERTY:**
| Display Label | Token (inferred) |
|--------------|-----------------|
| Inquiry address | `%inquiry_address%` |
| Inquiry address url | `%inquiry_address_url%` |
| Inquiry address preview | `%inquiry_address_preview%` |

**Category LAST VIEWED:**
(Partially visible — section header confirmed, individual tokens cut off. Likely mirrors property-viewed address fields.)

**Additional tokens observed in actual email body text:**
| Token (exact from body) | Meaning |
|------------------------|---------|
| `%contact_first_name%` | Contact's first name |
| `%customBuyerSearchAreas%` | Custom field: buyer search areas |

### 2B. Text Template Merge Fields (from "Merge Fields ▾" dropdown)

**Category CONTACT:**
| Display Label | Token (inferred) |
|--------------|-----------------|
| Contact name | `%contact_name%` |
| Contact first name | `%contact_first_name%` |
| Contact last name | `%contact_last_name%` |
| Contact and relationships first name | `%contact_and_relationships_first_name%` |
| Contact email | `%contact_email%` |
| Contact phone | `%contact_phone%` |
| Contact address | `%contact_address%` |
| Contact street | `%contact_street%` |
| Contact city | `%contact_city%` |
| Contact state | `%contact_state%` |
| Contact zipcode | `%contact_zipcode%` |

**Additional tokens observed in actual text body text:**
| Token (exact from bodies) | Meaning |
|--------------------------|---------|
| `%agent_name%` | Sending agent's name |
| `%first_name%` | Contact first name (short alias) |
| `%inquiry_address%` | Property address from inquiry |
| `%contact_street%` | Contact's street address |
| `%customSellerPropertyAddress%` | Custom field: seller property address |

**Inference:** The merge field dropdown for text templates almost certainly also contains SENDER and PROPERTY categories (same as email), just the visible scroll in Frame 10 only shows CONTACT. The token system is shared; the picker just shows what's applicable.

---

## 3. Email Template List — Full Template Inventory

### Folder: My Email Templates (76 total)
All confirmed names in scroll order:

**BL series (Buyer Lead drip):**
- BL-01 Your Bend search is set up
- BL-02 Two things that move buyers ahead
- BL-03 What to know about your top areas
- BL-04 What's moving in your budget range
- BL-05 Are your search areas still right
- BL-06 Sticking with you for the long game
- BL-S1 Buyer SMS Confirmation [SMS — text template cross-listed]
- BL-S2 Buyer SMS Check-in [SMS — text template cross-listed]

**EXP series (Expired listing outreach):**
- EXP-1 Expired Five reasons listings stall
- EXP-2 Expired Whats closing in your neighborhood
- EXP-3 Expired Personal letter intro (under 750K)
- EXP-4 Expired Whenever youre ready
- EXP-5 Expired Mid-quarter market read
- EXP-7 Expired Moving to quarterly list
(EXP-6 not visible — may exist below fold)

**FSBO series:**
- FSBO-1 Five things FSBOs in Bend miss
(more below fold)

**Stats note:** All visible templates show Sent = 0. Automations and Action Plans counts confirm these are wired into the action plans and automations but have sent zero emails in the current account/trial period.

---

## 4. Text Template List — Full Template Inventory

### Folder: My Text Templates (14 total — complete)
| # | Name | Score | Historical Reply % | Historical Opt Out % | Historical Sent |
|---|------|-------|-------------------|---------------------|----------------|
| 1 | Crosswater | Pending | 22% | 0% | 32 |
| 2 | EXP-T0 — Expired listing personal intro (manual send) | Pending | -- | -- | 0 |
| 3 | Expired - Second Message | Pending | 18% | 14% | 83 |
| 4 | Expired Listing - Initial Text | Pending | 20% | 10% | 87 |
| 5 | FSBO - Cancelled FSBO | Pending | 50% | 13% | 8 |
| 6 | FSBO - Initial Contact | Pending | 22% | 0% | 9 |
| 7 | FSBO-T0 personal intro (manual send) | Pending | -- | -- | 0 |
| 8 | Matt - out of area home owner test | Pending | 17% | 14% | 78 |
| 9 | Paul - Out of State Owner | Pending | -- | -- | 0 |
| 10 | Rebecca - Out Of Area Home Owner | Pending | 14% | 10% | 21 |
| 11 | Ryan Realty - Expired Listing Outreach (Mar 2025) | Pending | -- | -- | 0 |
| 12 | Ryan Realty - Out of State Homeowner Outreach (Mar 2025) | Pending | 14% | 14% | 14 |
| 13 | Ryan Realty - Remote Home Owner | Pending | -- | -- | 0 |
| 14 | vandevert Ranch | Pending | 20% | 0% | 15 |

### Folder: Follow Up Boss (19 total)
Not drilled into, but confirmed to be a system-provided folder. These 19 are presumably FUB's built-in starter templates.

### Folder: All Text Templates (37 total)
= My Text Templates (14) + Follow Up Boss (19) + possibly shared templates (4 overlap)

---

## 5. Email Template Editor — Full Field Specification

### Modal: Edit Email Template

**Layout:** Fixed-width modal, ~480-540px wide, vertically scrollable. White background. Modal overlay dims the list behind it.

**Header section:**
```
title: "Edit Email Template"  [string, non-editable]
subtitle: "Created on {date} at {time} by {userName}"  [string, non-editable]
close: [✕ button, top right]
```

**Field 1 — Subject:**
```
type: text input (single line)
label: none (implicit "Subject" from position)
placeholder: [unknown, field appears pre-filled]
value: "BL-01 Your Bend search is set up"
right-action: [Merge Fields ▾] dropdown button
```

**Field 2 — Preview Text / Subtitle:**
```
type: text input (single line)
label: none (second field below subject)
value: "Your Bend search is set up"
right-action: [Merge Fields ▾] dropdown button
purpose: email preview text shown in inbox before open
```

**Field 3 — Body (Rich Text Editor):**
```
type: WYSIWYG rich text editor (not plain textarea)
label: none
toolbar: [see Toolbar spec below]
content: HTML body with merge tokens rendered inline
height: ~6-8 lines visible, vertically resizable via drag handle (resize handle at bottom-right of textarea)
```

**Rich Text Toolbar — icon inventory (left to right):**
```
B         — Bold
I         — Italic
U         — Underline
[sep]
[icon]    — Ordered list (numbered)
[icon]    — Unordered list (bulleted)
[sep]
[icon]    — Insert link
[icon]    — Insert image
[icon]    — Insert emoji
[icon]    — Unknown (possibly table or horizontal rule)
[icon]    — Unknown
T         — Text color or font
[icon]    — Unknown (possibly clear formatting)
```
Approximately 12-14 toolbar icons total. The toolbar sits above the body area, not above the subject/preview fields.

**Field 4 — Signature notice:**
```
type: static text (non-editable)
text: "The sender's signature from [My Settings] will automatically be added."
     "My Settings" is a clickable hyperlink
```

**Field 5 — Share toggle:**
```
type: checkbox
label: "Share this template with everyone"
default: checked (☑) for BL-01 template
semantic: when checked, template is visible to all team members; when unchecked, private to creator
```

**Field 6 — Folders:**
```
type: multi-select via tag/chip UI
label: "Folders:"
controls: [+ circular button] to add folder assignment
chips: (BL-01 shows no folder chip — zero folders assigned despite existing folders)
```

**Footer — usage info:**
```
type: static informational text
text: "In use by {n} automation & {n} action plan"
     (e.g., "In use by 1 automation & 1 action plan")
```

**Action buttons:**
```
[Cancel]  — secondary/outline button, closes without save
[Save]    — primary blue button, persists changes
```

---

## 6. Text Template Editor — Full Field Specification

### Modal: Edit Text Template

**Layout:** Fixed-width modal, same width as email modal (~480-540px). Simpler structure — fewer fields.

**Header section:**
```
title: "Edit Text Template"  [string, non-editable]
subtitle: NONE (no created-by line)
close: [✕ button, top right]
```

**Field 1 — Template Name:**
```
type: text input (single line)
label: none (first field at top)
value: "Crosswater"
purpose: internal name for the template (not sent to recipient)
```

**Field 2 — Body (Plain Textarea):**
```
type: plain text <textarea> (NOT rich text)
label: none
toolbar: NONE
height: ~6-8 lines visible
resize: drag handle at bottom-right
merge tokens: rendered as %token_name% literal text (not rendered as rich nodes)
```

**Below-textarea controls:**
```
[😊 emoji picker icon]    [Merge Fields ▾] dropdown button
```

**Hint text:**
```
type: static text, grey/muted
text: "Remember to keep text messages short"
```

**Field 3 — Share toggle:**
```
type: checkbox
label: "Share this text template with everyone"
default: unchecked (□) for user-created templates
```

**Field 4 — Folders:**
```
type: same multi-select chip UI as email
label: "Folders:"
controls: [+ circular blue button]
```

**Destructive action:**
```
"Delete" — text link (not a button), appears in the modal body area (not footer)
           clicking opens a confirmation before permanent deletion
```

**Action buttons:**
```
[Cancel]  — secondary button
[Save]    — primary blue button
```

---

## 7. Merge Fields Picker — Detailed Specification

### Trigger
- Email editor: clicking either "Merge Fields ▾" button (one for Subject, one for Preview)
- Text editor: clicking "Merge Fields ▾" button (single instance, applies to textarea)

### Picker UI
```
type: floating dropdown/popover
width: ~180px
max-height: ~300px (scrollable)
background: white
border: 1px light grey border
shadow: subtle drop shadow
position: below the triggering button
```

### Structure
```
[search field?]  — unclear if searchable; not confirmed in frames
[CATEGORY HEADER — uppercase, grey, small caps style]
  [token row 1]
  [token row 2]
  ...
[CATEGORY HEADER]
  [token rows]
[scrollable — more below]
```

### Confirmed Categories (email picker, in scroll order)
1. **SENDER**
2. **PROPERTY**
3. **LAST VIEWED** (partially visible)

### Confirmed Categories (text picker, in scroll order)
1. **CONTACT** (fully visible)

### Token Insertion Behavior
- Clicking a token inserts `%token_name%` at the cursor position in the active field
- The token appears as plain `%token_name%` text in the editor (no special highlighting/chip rendering observed in the body view)
- Multiple tokens can be inserted; they render as literal percent-delimited strings

### Complete Token Inventory (all confirmed across all frames)

**CONTACT category:**
- Contact name → `%contact_name%`
- Contact first name → `%contact_first_name%`
- Contact last name → `%contact_last_name%`
- Contact and relationships first name → `%contact_and_relationships_first_name%`
- Contact email → `%contact_email%`
- Contact phone → `%contact_phone%`
- Contact address → `%contact_address%`
- Contact street → `%contact_street%`
- Contact city → `%contact_city%`
- Contact state → `%contact_state%`
- Contact zipcode → `%contact_zipcode%`

**SENDER category:**
- Sender name → `%sender_name%`
- Sender first name → `%sender_first_name%`
- Sender last name → `%sender_last_name%`
- Sender email → `%sender_email%`
- Sender phone → `%sender_phone%`
- Sender mobile phone → `%sender_mobile_phone%`
- Sender merge field → `%sender_merge_field%`

**PROPERTY category:**
- Inquiry address → `%inquiry_address%`
- Inquiry address url → `%inquiry_address_url%`
- Inquiry address preview → `%inquiry_address_preview%`

**LAST VIEWED category:** (section header visible, individual tokens cut off)

**Additional tokens confirmed from live template bodies (not in visible picker scroll):**
- `%customBuyerSearchAreas%` — custom field (buyer search areas text)
- `%customSellerPropertyAddress%` — custom field (seller property address)
- `%agent_name%` — likely SENDER category alias for agent name
- `%first_name%` — likely CONTACT alias for contact first name

**Note on custom fields:** The `%custom*%` tokens suggest FUB exposes Custom Fields as merge tokens. The full picker likely has a CUSTOM FIELDS category not visible in these frames.

---

## 8. Template Share / Visibility Scope

### Email Templates
- Checkbox: "Share this template with everyone"
- **Checked** (☑) = visible to all agents/users on the account → template appears in "All Email Templates" folder
- **Unchecked** = private to creating user → only in "My Email Templates"
- The BL-01 template is checked → it appears in both "All Email Templates" (76) and "My Email Templates" (76)

### Text Templates
- Checkbox: "Share this text template with everyone"
- **Unchecked** (□) = private (default for user-created text templates)
- Same semantic as email share checkbox

### Folder scope
- "All Email Templates" = all shared + all private (for current user) = superset view
- "My Email Templates" = templates where you are the creator
- "Used by Action Plans" = filtered view of templates referenced in at least 1 action plan (45 of 76)
- "Follow Up Boss" = system-provided starter templates (0 email, 19 text)

---

## 9. Template Folder Management

### Creating a folder
```
Button: "+ Folder" [green outline button, top-right of index page]
Creates a user-owned folder (gets edit/delete actions)
```

### Assigning a template to folders
```
In the editor modal:
  Folders: [+ button]
  → Clicking [+] opens a folder picker (not captured in these frames)
  → Template can belong to multiple folders (multi-assign)
  → Folder chips appear in the "Folders:" row when assigned
```

### Folder-level actions (on user folders only)
```
✏️ Rename folder
🗑️ Delete folder
```
System folders (All, My, Used by Action Plans) show no action icons — they are smart/virtual folders.

### Drag handle
- User-created folder rows have a six-dot drag handle on the far left
- Implies folders can be reordered via drag-and-drop

---

## 10. Email Templates List — Column Reference

### Full column set (Email Templates list):
| Column | Type | Description |
|--------|------|-------------|
| [checkbox] | multi-select | Row selection for bulk actions |
| Template | text (link) + preview | Name (blue link) + preview text (grey, 1 line) |
| Folders | badge count | # of folders template belongs to; eye icon = view |
| Automations | number + eye | # automations using this template; eye = view list |
| Action Plans | number + eye | # action plans using this template; eye = view list |
| Sent | integer | Total emails sent from this template |
| Opens | integer or — | Open count (— if never sent) |
| Clicks | integer or — | Click count |
| Replies | integer or — | Reply count |
| Unsubscribed | integer or — | Unsubscribed count |
| Bounces | integer or — | Bounce count |
| Actions | icon buttons | ✏️ Edit |

**Sort:** Template column has ↑ sort arrow; others may be sortable (not confirmed)
**Help icons:** ? icons on Folders, Automations, Action Plans, Bounces columns (tooltip/help)

### Full column set (Text Templates list):
| Column | Type | Description |
|--------|------|-------------|
| [checkbox] | multi-select | Row selection |
| Template | text (name + preview) | Name + ~100 chars of body |
| Score | badge | "Pending (--)" with house icon; computed AI quality score |
| Replies | formatted string | `{current} ({benchmark%})` — current sends are 0, parens = historical |
| Opt Outs | formatted string | `{current} ({benchmark%})` |
| Sent | formatted string | `{current} ({historical total})` |
| Actions | icon buttons | ✏️ Edit + 🗑️ Delete |

---

## 11. Send Email Action (in Automations) — Field Reference

When placing a "Send Email" step in an Automation:

| Field | Type | Options |
|-------|------|---------|
| Template | text/search field | Template name lookup |
| From | dropdown | "Agent assigned to the contact" (others likely: specific agent, round-robin) |
| Recipient Preferences | radio group | "Send to primary contact only" / "Send to contact and all relationships" / "Send to assigned agent" |
| Delivery Preferences | radio group | "Send immediately" / "Send between 8:00 am and 7:00 pm" / "Send during company office hours" / "Send at custom time" |
| Delete | link/button | Removes the step from the automation |

---

## 12. Test Send / Preview

**Not directly captured in these frames.** The email template editor modal does NOT show a "Test Send" or "Preview" button within the visible modal area. These may be:
- Accessible via keyboard shortcut
- In a "..." overflow menu not visible
- Only available from the list row (not the editor)

The Action Plan "eye" icons (👁) next to counts in the list view let you see which automations/action plans use a template — this is a "where used" view, not a test send.

---

## 13. Component Tree — Responsive Web Rebuild

### Page: Templates Index (Email or Text)

```
<AdminLayout>
  <GlobalNav />
  <AdminSubNav activeTab="email-templates" | "text-templates" />
  
  <Page>
    <PageHeader>
      <HeadingCount label="{n} Email|Text Template Folders" />
      <PageActions>
        <SearchInput placeholder="Search Templates" />
        <Button variant="primary">+ Email|Text Template</Button>
        <Button variant="outline">+ Folder</Button>
        <HelpLink href="...">How Email|Text Templates work</HelpLink>
      </PageActions>
    </PageHeader>
    
    <FolderTable>
      <TableHead>
        <Column>Name</Column>
        <Column align="right">Email|Text Templates</Column>
        <Column align="right">Actions</Column>
      </TableHead>
      <TableBody>
        {folders.map(folder => (
          <FolderRow key={folder.id}
            draggable={folder.userCreated}
            dragHandle={folder.userCreated}
          >
            <DragHandle visible={folder.userCreated} />
            <FolderIcon variant={folder.type} />
            <FolderName>{folder.name}</FolderName>
            <TemplateCount>{folder.count}</TemplateCount>
            <RowActions visible={folder.userCreated}>
              <EditButton />
              <DeleteButton />
            </RowActions>
          </FolderRow>
        ))}
      </TableBody>
    </FolderTable>
  </Page>
  
  <TrialBanner />
</AdminLayout>
```

### Page: Email Templates List View

```
<AdminLayout>
  <GlobalNav />
  <AdminSubNav activeTab="email-templates" />
  
  <Page>
    <Breadcrumb>
      <BreadcrumbItem href="/admin/email-templates">Email Templates</BreadcrumbItem>
      <BreadcrumbItem>My Email Templates</BreadcrumbItem>
    </Breadcrumb>
    
    <PageHeader>
      <TemplateCount count={76} />
      <ViewToggle />  {/* grid/list */}
      <PageActions>
        <SearchInput placeholder="Search Templates" />
        <Button variant="primary">+ Email Template</Button>
      </PageActions>
    </PageHeader>
    
    <DataTable>
      <TableHead>
        <Column sortable>Template</Column>
        <Column help>Folders</Column>
        <Column help>Automations</Column>
        <Column help>Action Plans</Column>
        <Column>Sent</Column>
        <Column>Opens</Column>
        <Column>Clicks</Column>
        <Column>Replies</Column>
        <Column>Unsubscribed</Column>
        <Column help>Bounces</Column>
        <Column>Actions</Column>
      </TableHead>
      <TableBody>
        {templates.map(t => (
          <TemplateRow key={t.id}>
            <SelectCheckbox />
            <TemplateCell>
              <TemplateName href={...}>{t.name}</TemplateName>
              <TemplatePreview>{t.previewText}</TemplatePreview>
            </TemplateCell>
            <StatsCell count={t.folders} showEye />
            <StatsCell count={t.automations} showEye />
            <StatsCell count={t.actionPlans} showEye />
            <StatsCell value={t.sent} emptyChar="—" />
            <StatsCell value={t.opens} emptyChar="—" />
            <StatsCell value={t.clicks} emptyChar="—" />
            <StatsCell value={t.replies} emptyChar="—" />
            <StatsCell value={t.unsubscribed} emptyChar="—" />
            <StatsCell value={t.bounces} emptyChar="—" />
            <ActionsCell>
              <EditButton onClick={() => openEmailEditor(t.id)} />
            </ActionsCell>
          </TemplateRow>
        ))}
      </TableBody>
    </DataTable>
    
    {editingTemplate && (
      <EditEmailTemplateModal
        template={editingTemplate}
        onClose={closeModal}
        onSave={saveTemplate}
      />
    )}
  </Page>
</AdminLayout>
```

### Modal: EditEmailTemplateModal

```
<Modal width={540}>
  <ModalHeader>
    <ModalTitle>Edit Email Template</ModalTitle>
    <ModalMeta>Created on {date} at {time} by {user}</ModalMeta>
    <CloseButton />
  </ModalHeader>
  
  <ModalBody>
    <FieldRow>
      <TextInput
        value={template.subject}
        onChange={...}
        placeholder="Subject line"
      />
      <MergeFieldsDropdown
        target="subject"
        categories={mergeFieldCategories}
        onInsert={insertMergeField}
      />
    </FieldRow>
    
    <FieldRow>
      <TextInput
        value={template.previewText}
        onChange={...}
        placeholder="Preview text"
      />
      <MergeFieldsDropdown
        target="previewText"
        categories={mergeFieldCategories}
        onInsert={insertMergeField}
      />
    </FieldRow>
    
    <RichTextEditor
      value={template.body}
      onChange={...}
      toolbar={[
        'bold', 'italic', 'underline',
        'orderedList', 'unorderedList',
        'link', 'image', 'emoji',
        'textColor'
      ]}
    />
    
    <SignatureNote>
      The sender's signature from{' '}
      <Link href="/settings">My Settings</Link>
      {' '}will automatically be added.
    </SignatureNote>
    
    <Checkbox
      checked={template.sharedWithEveryone}
      onChange={...}
      label="Share this template with everyone"
    />
    
    <FolderAssignment
      label="Folders:"
      folders={template.folders}
      onAdd={addFolder}
      onRemove={removeFolder}
    />
    
    {template.usageInfo && (
      <UsageInfo>
        In use by {template.automationCount} automation & {template.actionPlanCount} action plan
      </UsageInfo>
    )}
  </ModalBody>
  
  <ModalFooter>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="primary" onClick={onSave}>Save</Button>
  </ModalFooter>
</Modal>
```

### Modal: EditTextTemplateModal

```
<Modal width={540}>
  <ModalHeader>
    <ModalTitle>Edit Text Template</ModalTitle>
    <CloseButton />
  </ModalHeader>
  
  <ModalBody>
    <TextInput
      value={template.name}
      onChange={...}
      placeholder="Template name"
    />
    
    <PlainTextarea
      value={template.body}
      onChange={...}
      rows={8}
      resizable
    />
    
    <TextareaControls>
      <EmojiPicker onSelect={insertEmoji} />
      <MergeFieldsDropdown
        categories={mergeFieldCategories}
        onInsert={insertMergeField}
      />
    </TextareaControls>
    
    <Hint>Remember to keep text messages short</Hint>
    
    <Checkbox
      checked={template.sharedWithEveryone}
      onChange={...}
      label="Share this text template with everyone"
    />
    
    <FolderAssignment
      label="Folders:"
      folders={template.folders}
      onAdd={addFolder}
      onRemove={removeFolder}
    />
    
    <DangerZone>
      <DeleteLink onClick={confirmDelete}>Delete</DeleteLink>
    </DangerZone>
  </ModalBody>
  
  <ModalFooter>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="primary" onClick={onSave}>Save</Button>
  </ModalFooter>
</Modal>
```

### Component: MergeFieldsDropdown

```
<Dropdown trigger={<Button variant="secondary">Merge Fields ▾</Button>}>
  <DropdownContent maxHeight={300} scrollable>
    {categories.map(cat => (
      <MergeFieldCategory key={cat.name}>
        <CategoryHeader>{cat.label}</CategoryHeader>  {/* uppercase */}
        {cat.tokens.map(token => (
          <MergeFieldItem
            key={token.key}
            onClick={() => onInsert(token.syntax)}
          >
            {token.label}
          </MergeFieldItem>
        ))}
      </MergeFieldCategory>
    ))}
  </DropdownContent>
</Dropdown>
```

### Component: TextTemplates List View

```
<DataTable>
  <TableHead>
    <Column sortable>Template</Column>
    <Column help>Score</Column>
    <Column help>Replies</Column>
    <Column help>Opt Outs</Column>
    <Column help>Sent</Column>
    <Column>Actions</Column>
  </TableHead>
  <TableBody>
    {templates.map(t => (
      <TextTemplateRow key={t.id}>
        <SelectCheckbox />
        <TemplateCell>
          <TemplateName>{t.name}</TemplateName>
          <TemplatePreview>{t.bodyPreview}</TemplatePreview>
        </TemplateCell>
        <ScoreCell>
          <HouseIcon />
          <ScoreValue>Pending (--)</ScoreValue>
        </ScoreCell>
        <BenchmarkCell current={t.replies.current} benchmark={t.replies.benchmark} />
        <BenchmarkCell current={t.optOuts.current} benchmark={t.optOuts.benchmark} />
        <BenchmarkCell current={t.sent.current} benchmark={t.sent.historical} />
        <ActionsCell>
          <EditButton onClick={() => openTextEditor(t.id)} />
          <DeleteButton onClick={() => confirmDelete(t.id)} />
        </ActionsCell>
      </TextTemplateRow>
    ))}
  </TableBody>
</DataTable>
```

**BenchmarkCell format:** `{current} ({benchmark})` where `--` = no data yet, value in parens = historical baseline from FUB's aggregate data.

---

## 14. Key Behavioral Notes for Spec §13

### Email vs Text editor differences (critical for build)
| Feature | Email Editor | Text Editor |
|---------|-------------|-------------|
| Subject field | ✅ Yes | ❌ No |
| Preview text field | ✅ Yes | ❌ No |
| Rich text toolbar | ✅ Yes (WYSIWYG) | ❌ No |
| Plain textarea | ❌ No | ✅ Yes |
| Emoji picker | ❌ Not visible | ✅ Yes |
| Created-by metadata | ✅ Shown in header | ❌ Not shown |
| Signature auto-add notice | ✅ Yes | ❌ No |
| Merge Fields buttons | 2 (subject + preview each get one) + body toolbar has one | 1 (for the textarea) |
| Usage info footer | ✅ "In use by N automation & N action plan" | ❌ Not shown |
| Delete action | ❌ Not visible in modal | ✅ "Delete" text link in modal body |
| Share scope | "with everyone" checkbox | "with everyone" checkbox |
| Hint text | ❌ None | ✅ "Remember to keep text messages short" |

### Merge field token format
Tokens are `%snake_case_label%` — percent-sign delimited. This is FUB's proprietary token syntax, NOT Handlebars, NOT Jinja, NOT `{{double-brace}}`. Build the token inserter and renderer to handle `%token%` pattern.

### Template name vs subject
Email templates have TWO "names":
1. **Internal name** (shown in the list, used to identify the template) — appears to be the subject line itself (e.g., "BL-01 Your Bend search is set up")
2. **Subject** (the actual email subject sent to recipient) — same field, so in FUB the template internal name IS the subject line

Text templates have a separate **Template Name** field (e.g., "Crosswater") that is purely internal — it is never sent to the recipient.

### "Score" column (text templates)
All scores show "Pending (--)" with a building/house icon. This is FUB's AI-driven text quality/effectiveness score that has not yet computed (likely requires a minimum send volume or is a paid feature). The parens benchmark values come from aggregated FUB network data.

### Shared template visibility
- `Share this template with everyone` → templates appear in the "All" smart folder for all team members
- Unshared → only creator sees it in "My" folder
- The "Used by Action Plans" folder is auto-generated (templates automatically appear there if referenced)

### Folder assignment
Templates start with no folder assignments (just the smart folders catch them). Clicking `+` in the Folders section lets you assign to user-created folders for organization. A template can belong to zero or more user-created folders simultaneously.

### Automations/Action Plans counter + eye icon
The blue number in the Automations and Action Plans columns is clickable (implied by the eye icon). Clicking the eye presumably shows a list of which automations/plans reference the template — enabling "where used" analysis before editing or deleting.

### Send Email action in Automations — Template field
This field appears to be a typeahead/search that lets you pick a template by name. It is a single-value field (one template per Send Email step). The selected template name renders in the automation canvas node as well (e.g., "BL-01 Your Bend search is set up · Agent assigned to the contact").

---

## 15. Verbatim Body Text Transcriptions

### Email BL-01 "Your Bend search is set up" (complete body)
```
Hi %contact_first_name%,

Thanks for the search request. I have your criteria set up for %customBuyerSearchAreas% and the first matching listings will be in your inbox within the hour. They come from the live MLS, not Zillow, so prices and statuses are current.

One question that helps me sharpen what you see. What does your ideal home look like beyond the basics? Even a few sentences gives me enough to filter out the listings you don't want to waste time looking at.

Talk soon.
```

### Text Template "Crosswater" (complete body)
```
Hi, %agent_name% with Ryan Realty in Bend here. I'm helping a retiree couple find a home in Crosswater with primary living on the main floor. Inventory is really limited right now and we haven't found something that's a good fit for them. I did some research to track down your number, so my apologies if I have the wrong contact. Any chance you'd consider selling %inquiry_address% if the numbers made sense? I'll be touring homes with them Feb 21st and 22nd if you'd be open to a showing. If you're working with another broker or not interested, no worries at all. Just doing my best for my clients. Thanks!
```

### Text Template "EXP-T0 — Expired listing personal intro (manual send)" (partial — visible preview):
```
Hello %contact_first_name%, Sorry that you weren't able to sell %customSellerPropertyAddress%. I know that's not the outcome anyone hopes for after putting that much work in...
```

### Text Template "Expired - Second Message" (partial):
```
Hi, this is %agent_name% with Ryan Realty. Just wanted to reach out one more time about %inquiry_address%. Spring is right around the corner and that's when buyer activity peaks, so...
```

### Text Template "Expired Listing - Initial Text" (partial):
```
Hi, %agent_name% with Ryan Realty here. I saw your home at %inquiry_address% recently came off the market. If you're still thinking about selling, I'd love to earn your business. We ha...
```

### Text Template "FSBO - Cancelled FSBO" (partial):
```
Happy New Year! This is %agent_name% with Ryan Realty. I noticed you stopped marketing %contact_street%. I specialize in helping FSBO sellers, so I wanted to share the attached da...
```

### Text Template "FSBO - Initial Contact" (partial):
```
Happy New Year! Hi this is %agent_name% with Ryan Realty. Happy New Year! I came across your home at %contact_street% and wanted to see if I could earn your business. I've helped several other FS...
```

### Text Template "FSBO-T0 personal intro (manual send)" (partial):
```
Hello %contact_first_name%, see your home for sale at %customSellerPropertyAddress%. Selling on your own is a real amount of work and I respect that. At any point you'd like...
```

### Text Template "Matt - out of area home owner test" (partial):
```
Hi, %agent_name% here with Ryan Realty. I saw you own %inquiry_address% out of the area. If you're thinking of selling, the local market hits a peak in mid-April. We handle th...
```

### Text Template "Paul - Out of State Owner" (partial):
```
Hi, I'm %agent_name% with Ryan Realty in Bend. I was looking at property records for %inquiry_address% and noticed the mailing address is out of town. I wasn't sure...
```

### Text Template "Rebecca - Out Of Area Home Owner" (partial):
```
Hi, I'm Agent Name with Ryan Realty in Bend. We specialize in helping out-of-area owners sell their Central Oregon homes with zero hassle. Our team knows the local market insi...
```

### Text Template "Ryan Realty - Expired Listing Outreach (Mar 2025)" (partial):
```
Hi, I'm Matt Ryan with Ryan Realty. I noticed your home at %inquiry_address% came off the market. If selling is still on your mind, we'd be grate for the opportunity to earn...
```

### Text Template "Ryan Realty - Out of State Homeowner Outreach (Mar 2025)" (partial):
```
Hi, I'm Matt Ryan with Ryan Realty. We specialize in helping out-of-area owners sell their Central Oregon homes with zero hassle. Our team knows the local market inside...
```

### Text Template "Ryan Realty - Remote Home Owner" (partial):
```
Hi! %first_name%, %agent_name% with Ryan Realty in Bend. I was looking at property records for %inquiry_address% and noticed the mailing address is out of town. I wasn't sure if y...
```

### Text Template "vandevert Ranch" (partial):
```
Hello, %agent_name% Name with Ryan Realty in Bend here. Hope you're having a good weekend. I'm helping a family who has their heart set on Vandevert Ranch, but we can't find anythi...
```

---

*End of §13 Templates analysis. All data sourced from direct frame observation; no values inferred from memory.*

<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §08/§17 Inbox & Comms -->

# FUB Inbox2 — Exhaustive Buildable Analysis
## Feeds spec §08 Inbox & §17 Comms
### Target gaps: Drafts folder, bell Notification Center panel + settings, calling-method picker, email connection status, opted-out display

---

## FRAME-BY-FRAME INVENTORY

---

### FRAME 01 — Tasks / Overdue view (context baseline)

**Route:** `/tasks` → **Overdue** tab active (underlined teal indicator)

**State:** User is NOT in Inbox here. This frame establishes the global chrome before the Inbox flow begins.

#### Global top navigation bar (dark charcoal `#2d2d3a` bg, full-width, ~48px tall)

| Position | Element | Label / Value | Notes |
|---|---|---|---|
| Far left | App menu icon | `☰` (grid/waffle icon) | Opens global nav drawer |
| Item 1 | People nav link | `People` (person icon) | Inactive |
| Item 2 | Inbox nav link | `Inbox` (envelope + lightning bolt icon, teal) | Active-ish (teal icon tint) |
| Item 3 | Tasks nav link | `Tasks` (checklist icon) | **Currently active page** — white text |
| Item 4 | Calendar nav link | `Calendar` (calendar icon) | Inactive |
| Item 5 | Deals nav link | `Deals` (bag/tag icon) | Inactive |
| Item 6 | Reporting nav link | `Reporting` (bar chart icon) | Inactive |
| Item 7 | Admin nav link | `Admin` (wrench icon) | Inactive |
| Center | Search bar | placeholder `Search` | Full-width pill, light border, magnifying-glass icon left |
| Far right icon 1 | Email quick-compose | envelope icon (circle, teal bg) | |
| Far right icon 2 | SMS/chat quick-compose | speech bubble icon (circle, teal/purple bg) | |
| Far right icon 3 | Calling / phone | person+phone icon (circle, green/teal bg) | |
| Far right icon 4 | Bell — Notifications | bell icon (circle, dark bg) | **No badge visible in f01** |
| Far right | User avatar | Circular photo of Matt | Dropdown arrow for user menu |

#### Sub-nav (below top bar, white bg)

Three tabs: **Today's Tasks** | **Overdue (267)** | **Future**

- Active tab: **Overdue (267)** — teal underline, bold
- Badge on Overdue: `267` in parentheses, inline
- `How Tasks work` — info/help link, top right of content area (teal, `ⓘ` icon)
- `Filters` — dropdown button, top right
- `Me` — dropdown button (agent filter), top right

#### Overdue Tasks list (main content)

Header: `Overdue Tasks` (clock icon, `⏰` style) | `Clear My Overdue Tasks` link (top right of section, teal)

Tasks grouped by date, descending:

**Tuesday, Jun 23 (2)**
- Task 1: Contact = **Matt Ryan** (avatar `MR`, teal circle) | Action: `Lead returned to website. Follow up now.` | Phone icon preceding action text | Assigned: `Me` (person icon + "Me") | Time: `3:30pm`
- Task 2: Contact = **Matthew Ryan** (avatar `MR`) | Same action text | Assigned: `Me` | Time: `8:26pm`

**Monday, Jun 22 (1)**
- Contact: **Matthew Ryan** | Action: `Lead returned to website. Follow up now.` | Time: `6:27am`

**Friday, Jun 19 (3)**
- Contact: **Matthew Ryan** | Action: `Lead returned to website. Follow up now.` | Times: `6:55am`, `2:57pm`, `6:15pm`

**Wednesday, Jun 17 (2)**
- Contact: **Matthew Ryan** | Action: `Lead returned to website. Follow up now.` | Time: `9:50am`
- Contact: **Matt Ryan** | Action: `Lead returned to website. Follow up now.` | Time: `5:20pm`

**Monday, Jun 15 (2)**
- Contact: **Scdvf** (avatar `S`, orange) | Action: `Hot seller LP lead — call within 5 min: scdvf (Arid Ave, Oregon 97703, USA)` | Time: `11:22am`
- Contact: **Matthew Ryan** (truncated) | Time: `5:18pm` (partial)

Each task row:
- Left: checkbox (circle, unticked, grey border)
- Left-center: avatar circle with initials (2-char, teal or orange depending on contact)
- Center: contact name (teal link), action description (grey text), phone handset icon before action text, assigned label (`Me` with person icon)
- Right: clock icon + time string

---

### FRAME 02 — Inbox: My Inbox view, conversation selected (Tiffany Clark)

**Route:** `/inbox` → My Inbox (559) → All tab → conversation selected

**State:** Standard 3-column inbox layout. Left sidebar shows folder tree. Center column shows conversation list. Right column shows open conversation thread + contact panel.

---

#### LEFT SIDEBAR — Inbox Folder Tree

**Header:** `My Inbox` **(559)** — bold, teal bullet/dot indicator to the left, collapse arrow (caret `^`) to the right

Sub-folders (indented, icon + label):
1. `Inbox` — envelope icon, plain (no count shown in this selected state — this is the "All" messages view currently selected)
2. `Assigned` — person icon
3. `Drafts` — document/page icon
4. `Sent` — paper-plane icon (diagonal arrow)
5. `Closed` — archive/box icon

**Second section:** `Company (54)` — teal bullet, `54` in parens, collapse caret `>`

Bottom of sidebar: `⚙ Manage` — gear icon + "Manage" text link (very bottom left)

---

#### CENTER COLUMN — Conversation List

**Header row:**
- `Select conversations` — grey text link (top left, allows bulk select)
- Tabs: **`All`** (pill, currently selected, darker border) | **`Unread`** (pill)
- `Filter` — dropdown button with caret (right side of tab bar)

**Count bar:** `324 Unread Messages` — displayed below tabs as a light grey bar, bold `324`, rest normal weight

**Conversation rows** (each ~60px tall, separated by thin dividers):

Row 1: **OR-WTE-Bend-Team Ward** `2` (bold count, teal) | `Jun 29` | `3:13 pm`
- Subject preview: `RE: 20702 Beamont Closing`
- Body preview: `Matt, Thank you for the update. We had not he...`
- Icons: envelope icon (teal, email indicator)

Row 2: **Amy Mora** `2` | `Jun 29`
- Subject: `19985 Voltera Place - SW Bend - Modern, lik...`
- Body: `[ryan-realty.com] Matt Ryan Owner & Prin...`
- Icons: envelope icon, attachment clip icon (paperclip)

Row 3: **Jeanette Argyle** `2` | `Jun 24`
- Subject: `Re: Broker Demand | 20702 Beaumont Dr`
- Body: `Hi, Attached is an updated Broker Demand for...`
- Icon: envelope icon

Row 4: **Kaylyn Rockwood** `9` | `Jun 23`
- Subject: `Re: Northpointe Homeowners Association`
- Body: `Hi Matt, The ARC has denied this color request...`
- Icon: envelope icon

Row 5: **Matt Ryan** `1` | `Jun 23`
- Subject: `Re:`
- Body: `CatherineCreek_53_archery.kmz Error in local s...`
- Dot: blue filled dot (unread indicator)
- Icon: envelope icon

Row 6: **Chad Carpenter** `6` | `Jun 23` (partial, cut off at bottom)
- Subject: `Re: 20702 Beaumont`
- Body: `Seventh Mountain Contracting, Ed Tena, 541-28...`

Row 7: **Rachel Nething** `3` | `Jun 22`
- Subject: `Re: ARC Request`
- Body: `Rachel, Thank you so much! [image: Matt Ryan] ...`

Row 8: **Team Ward** `1` | `Jun 22`
- Subject: `Documents Needed ASAP - Order #WT0286...`
- Body: `This message was sent securely using Zix® (htt...`
- Icon: attachment clip

Row 9: **Jeanette Argyle** `1` | `Jun 22`
- Subject: `Est. Settlement Stmt | 20702 Beaumont Dr`
- Body: `Hi, Do you have a copy of the estimated settle...`

Row 10: **Matt Ryan** `1` | `Jun 18`
- Subject: `(no subject)`
- Body: `[image: image.png]`
- Icon: attachment clip

Row 11: **Theresa Wise** `3` | `Jun 17`
- Subject: `Re: Your Bend home search is set, Theresa`
- Body: `Hi Matt, Great thanks for the confirmation and w...`

**Unread indicator:** blue filled dot (`●`) appears to the LEFT of the contact avatar/name on unread threads.

---

#### RIGHT COLUMN — Open Conversation: Tiffany Clark

**Conversation header (top of right pane):**
- `📧 Tiffany Clark` — envelope icon, name as title
- Sub: `RE: 20702 Beamont Closing`
- Right side: `Me ▼` dropdown (agent assigned selector) | `Close` button | `⋮` (kebab/more options menu)

**Email thread header (inside thread, per message):**
- Sender avatar: `OW` (initials, teal circle) = OR-WTE-Bend-Team
- `3:13 pm` timestamp (top right of message)
- Reply arrow `↩`, Forward arrow `↪`, kebab `⋮` (per-message action icons)
- `to me, Tiffany, OR-WTE-Bend-Team ▼` — recipients dropdown (expandable)

**Email body (partial visible):**
```
Matt,

Thank you for the update. We had not heard anything o[n the new 
close date, so we were in a holding pattern on...]

What is happening with regards to the HOA, re-painting of the home, 
etc? Is it safe for us to work up the Seller [documents and have an 
arranged notary for her to sign in CA?]

Not sure we could turn it that fast with the Seller. She w[ill want 
her son in law to be there as well for the signing, I] am sure.
```

**Contact panel (right side of right column):**

Contact header:
- Avatar: `TC` initials circle (teal)
- Name: **Tiffany Clark** (bold, large)
- `Last Communication an hour ago` (grey sub-text)

Contact details:
- Phone: `(541) 706-0911` `(mobile)` — green WhatsApp icon + teal/blue verified-phone icon to the right
- Email: `realestatetiffany@gmail.com` (teal link)

Sections (collapsible, caret icons):

**Relationships** (expandable, `+` add button)
- Content: `No relationships`

**Details** (expanded):
- `Stage` Real Estate Agent
- `Agent` Matt Ryan
- `Lender` (blank/empty)

**Recent Conversations** (expanded):
- `RE: 20702 Beamont Closing` (envelope icon, teal)
- `Order #WT0286975 - 20702 Beaumont Drive, Bend ...` (envelope icon)
- `Re: Northpointe Homeowners Association` (envelope icon)
- `Re: Envelope completed: Beaumont - extend closing` (envelope icon)
- `Re: 20702 Beaumont` (envelope icon)

**Activity** (collapsed, shows caret for expand)

**AgentFire FUB Widget** (collapsed, shows caret)

**Bottom of email pane:**

Reply area:
- `→ Team Ward and Mary Bowman` (reply-to indicator, showing who this will reply to)
- Quick-action tag buttons (pill chips): `+ Introduction` | `+ Follow Up` | `+ Still Buying` | `+` (more)
- Rich text editor toolbar: `B` | `I` | `U` | `—` | `≡` | `↔` | `📎` | `☺` | `🖼` | `T` | `<>` (bold, italic, underline, strikethrough, list, indent, attachment, emoji, image, font, code)
- `Hello,` — pre-populated reply opener (body)

**Bottom bar of reply panel:**
- `Attachments` | `Templates` (buttons, bottom right of editor area)
- `Add Note [N]` — keyboard shortcut shown (bottom right)

---

### FRAME 03 — Inbox: Drafts folder selected (EMPTY STATE)

**Route:** `/inbox` → My Inbox → **Drafts** (clicked)

**State:** Drafts folder is selected/active. The "Clicked" tooltip appears over the user avatar in top-right (indicating the previous click action on the nav element that brought us here was the user avatar / notification bell area — but the sidebar shows Drafts is now active).

**Key observation:** Drafts folder shows an EMPTY LIST state — no draft conversations exist.

---

#### LEFT SIDEBAR (same structure, Drafts now active/bold)

- `My Inbox (559)` — parent, teal dot
  - `Inbox` — normal weight
  - `Assigned` — normal weight
  - **`Drafts`** — **bold** (active selection)
  - `Sent` — normal weight
  - `Closed` — normal weight
- `Company (54)` — collapsed, caret `>`
- `⚙ Manage` — bottom

---

#### CENTER COLUMN — Drafts (empty state)

- Tabs: **`All`** (active) | **`Unread`**
- Count bar: `324 Unread Messages` — NOTE: this count does NOT change to reflect Drafts — it persists from the previous Inbox view, suggesting it is a global unread count for the full inbox, not scoped to the selected folder.
- **Main area: completely blank/white** — no draft items, no empty-state illustration or message ("No drafts" text is NOT shown — purely empty white space)
- Small teal loading indicator (thin diagonal line, ~`/` shape) visible near center of blank area — `~(312, 214)` in frame coordinates — suggesting the page is loading or there is a lazy-load spinner for the list

**Critical spec note for rebuild:** When Drafts folder is empty, the center pane renders white with no placeholder text or empty-state UI. The count bar (`324 Unread Messages`) appears to be pinned to the inbox-global unread count, NOT the per-folder count.

---

#### RIGHT COLUMN

Completely blank/white — no conversation selected, no placeholder panel.

---

### FRAME 04 — Inbox: Drafts folder, draft selected (Mary Bowman)

**Route:** `/inbox` → My Inbox → Drafts → draft conversation open

**State:** Drafts folder showing multiple draft items. A specific draft (Mary Bowman / Documents Needed - Order #WT0286975) is open in the right panel. An email compose/reply editor is visible at the bottom.

---

#### LEFT SIDEBAR

Same as Frame 03. `Drafts` still bold/active.

#### CENTER COLUMN — Drafts list (populated)

Count bar: `324 Unread Messages` (same persistent global count)

**Draft conversation rows** (all labeled `Draft` in grey text after contact name):

| Row | Contact | Label | Date | Subject preview | Body preview |
|---|---|---|---|---|---|
| 1 | **Team Ward** | `Draft 1` | Jun 17 | `Documents Needed - Order #WT0286975 -...` | `This message was sent securely using Zix® (http...` |
| 2 | **Kelly Hanson** | `Draft` | May 18 | `(no subject)` | `(https://ryan-realty.com) Matt Ryan Owner & Prin...` |
| 3 | **Bowerman Jay & Teresa Trust** | `Draft` | Mar 18, 2026 | `Buyer Counter Offer` | `(http://ryan-realty.com) Initial Agency Discl...` |
| 4 | **Cheryl Taylor** | `Draft` | Feb 5, 2026 | `(no subject)` | `(https://ryan-realty.com) Initial Agency Discl...` |
| 5 | **Mark Aijian** | `Draft` | Feb 4, 2026 | `(no subject)` | `(https://ryan-realty.com) Initial Agency Discl...` |
| 6 | **Jeffrey Dowell** | `Draft` | Jan 21, 2026 | `(no subject)` | `(https://ryan-realty.com) Initial Agency Discl...` |
| 7 | **Kym Levell** | `Draft` | Dec 19, 2025 | `(no subject)` | `(https://ryan-realty.com) Matt Ryan/`) |
| 8 | **Kristen Grau** | `Draft` | Dec 18, 2025 | `(no subject)` | `(https://ryan-realty.com) matt-ryan/)` |
| 9 | **James L Martino Living Trust** | `Draft` | Dec 5, 2025 | `Subject: Quick Check-In Hi {{ FirstName }},` | Handlebars template visible |
| 10 | **Brian** | `Draft` | Nov 10, 2025 | `(no subject)` | `kjdfkjhssdlkjhfjksd/jjhqsdf/kih (https://rya...` |
| 11 | **Jim Langevin** | `Draft` | Nov 3, 2025 | `(no subject)` | `(https://ryan-realty.com/matt-ryan/)` |

**Draft row anatomy:**
- Blue dot (unread/new indicator) to left of contact name? — in f04_q1, rows show a blue dot `●` on left
- Contact name (teal link) + `Draft` label (grey italic) + message count number (e.g. `Draft 1`)
- Date (right-aligned, grey)
- Subject line (smaller text, one line)
- Body preview (grey, truncated with `...`)
- Attachment icon (paperclip) where applicable

**Key spec detail — draft labeling:** Each row shows the word `Draft` appended after the contact name in grey. "Draft 1" for Team Ward suggests a count of drafts in that thread.

---

#### RIGHT COLUMN — Open Draft: Mary Bowman

**Conversation header:**
- `📧 Mary Bowman` — envelope icon + name
- Full subject: `Documents Needed - Order #WT0286975 - 20702 Be[aumont Drive, Bend OR 97701 - Tyler Nicoll]`

**Original email being replied to (quoted in thread, orange/yellow highlight on first line):**

Highlighted text: `[sender name / Bowman, you can provide it as closing; I just need to verify you` (orange highlight — appears to be a text selection or annotation highlight on this quoted passage)

Email body visible:
```
You may return the completed documents to us by e-mail.

We look forward to working with you, please let me know if you have any questions.

[Siarra.Marks@westerntitle.com] (link)

[Map.pdf] (1 MB)
[PRELIMINARY REPORT-LINKED.PDF] (301 KB)
[Seller Opening Package.pdf] (564 KB)
```

**Contact panel — Mary Bowman:**

Header:
- Avatar: `MB` (teal circle)
- Name: **Mary Bowman** (bold)
- `Last Communication 8 days ago`

Details:
- Phone: `(714) 337-6028` `(mobile)` — green WhatsApp icon + blue verified icon
- Email: `msbrilliantdisguise@gmail.com`

**Relationships (1):**
- **Yahson Terry** (avatar `YT`, teal)
  - `(909) 343-0531` `(mobile)` — green WhatsApp + blue verified icon
  - `yahsonkt@hotmail.com`
  - `Add address` (link)

**Details:**
- `Stage` Active Client
- `Agent` Matt Ryan
- `Lender` (blank)

**Recent Conversations:**
- `Documents Needed ASAP - Order #WT0286975 - 20...` (envelope icon)
- `Documents Needed - Order #WT0286975 - 20702 B...` (envelope icon)
- `Documents Needed - Order #WT0286975 - 20702 B...` (envelope icon)
- `Good morning Mary and Yahson. Please let me know ...` (speech bubble icon — SMS/text)
- `painter Payment Link` (envelope icon)

**Activity (collapsed):**
- `Seen 6 months ago` (text visible before collapse)
- `AT A GLANCE` sub-header
- `97701` (zip code data)

**AgentFire FUB Widget (collapsed)**

---

#### DRAFT COMPOSE AREA (bottom of right pane)

**Reply-to line:** `→ Team Ward and Mary Bowman` (recipients)

**Quick tag chips:** `+ Introduction` | `+ Follow Up` | `+ Still Buying` | `+ Nurture Lead` | `+ Custom`

**Rich text toolbar:**
`B` | `I` | `U` | `—` | `≡` | `↔` | `📎` | `📷` | `☺` | `🎬` | `T` | `<>` (bold, italic, underline, strikethrough, lists, link, attachment, image, emoji, video, font-size, code/html)

Additional toolbar icons visible in f04_q3: icons for: undo/redo (`↔`), insert image (`🖼`), camera, emoji face, video/film (`🎬`), text format (`T`), code (`<>`)

**Draft body content (partial):**
```
Hello,

Can you
```
(Draft in progress — truncated)

**Matt Ryan email signature block:**

```
Matt Ryan
Owner & Principal Broker · Ryan Realty LLC

541.703.3095
matt@ryan-realty.com
ryan-realty.com

Building community through authentic relationships and
exceptional customer service.

[Ryan Realty logo image]

Read our Google reviews · Oregon Initial Agency [Disclosure Pamphlet]
Ryan Realty LLC - Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings
under contract with another broker.
```

**Bottom action bar (below editor):**
- `Delete` (trash icon) — far left
- `Send` — grey/outlined button
- `Send & ↓` — teal filled button (Send and archive/schedule)
- `⏰` — clock/schedule icon button (send later / scheduled send)

Also visible: `Attachments` | `Templates` (links in editor footer area)

`Add Note [N]` — keyboard shortcut notation bottom right

---

### FRAME 05 — Notification Settings page

**Route:** Bell icon clicked → navigates to `/notifications/settings` (or equivalent personal settings page)

**State:** "Your Personal Notification Settings" page. The content is in a **loading skeleton state** — all event rows show grey shimmer/loading rectangles, no actual event names are visible. The page structure is fully visible however.

**Note:** The orange dot on the bell icon in the top-right nav (visible in f05_q2 `Clicked` tooltip) indicates there are unread notifications.

---

#### PAGE HEADER

Title: **`Your Personal Notification Settings`** (large, bold, `~H2` weight)

Sub-text: `Change how you get notified about Follow Up Boss events. These settings affect only you, not the rest of your team.`

Top-right of header area: `ⓘ How Notifications work` — info link (teal, circle-i icon, rounded pill outline button)

---

#### NOTIFICATION TABLE — Section 1 (unnamed / personal)

**Table header row** (icon columns only, no text labels):

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
|---|---|---|---|---|
| Event (text column) | `🔔` Bell icon | `🖥` Desktop/browser icon | `📱` Mobile/phone icon | `💬` In-app/chat icon | `✉` Email icon |

**5 channel columns total:**
1. Bell (`🔔`) — Push/browser notification
2. Desktop (`🖥`) — Desktop app notification
3. Mobile (`📱`) — Mobile push notification
4. In-app (`💬`) — In-app notification / comment/chat
5. Email (`✉`) — Email notification

**Rows:** All event name cells show grey shimmer loading placeholders (rectangular bars at varying widths). Toggle cells also show grey rectangles (loading state for checkboxes/toggles).

**Visible row count in section 1:** Approximately 10–12 rows (counting shimmer bars in q1/q2 views)

---

#### NOTIFICATION TABLE — Section 2: "Team Inbox"

Section header: **`Team Inbox`** (grey text, larger than table text, acts as section label)

Table structure identical to section 1 (same 5 channel columns: `🔔` `🖥` `📱` `💬` `✉`)

**Visible rows:** 2 rows (shimmer loading state)

---

#### NOTIFICATION TABLE — Section 3: "Pond"

Section header: **`Pond`** (grey text, section label)

Table structure identical (same 5 channel columns)

**Visible rows:** Partially visible at bottom, at least 1–2 rows

---

#### LOADING STATE DETAILS

- All event name cells: horizontal grey shimmer bars (varying width, `~50–70%` of column width)
- All toggle/checkbox cells: small square grey shimmer blocks (~`16x16` px)
- The shimmer pattern fills the entire table body
- No actual event names or toggle states are readable in this frame
- This is a skeleton loading state — data is being fetched from the server

---

## KEY UI ELEMENTS: EXHAUSTIVE SPECIFICATION

---

### A. INBOX LEFT SIDEBAR — Complete Folder Tree

```
● My Inbox (559)          ← teal bullet, count in parens, collapse caret ∧
  ☆ Inbox                 ← envelope icon (filled)
  👤 Assigned             ← person/silhouette icon
  📄 Drafts               ← document/page icon (corner folded)
  ✈ Sent                  ← paper plane / send icon (diagonal arrow)
  🗄 Closed               ← archive box / check icon

● Company (54)            ← teal bullet, count, expand caret >
  [collapsed — individual team inboxes hidden]

⚙ Manage                  ← gear icon, bottom of sidebar, always visible
```

**Visual states:**
- Active/selected folder: **bold text weight**
- Inactive folder: normal text weight, grey
- Parent "My Inbox": bold + count badge
- Count badges: grey text in parentheses, inline with label

**Sidebar width:** ~160px
**Background:** white
**Divider:** thin grey line between sections

---

### B. DRAFTS FOLDER — Detailed Spec

**Entry point:** Click `Drafts` in left sidebar under My Inbox

**Empty state (Frame 03):**
- Center pane: white, no items, no empty-state copy
- Faint loading spinner (thin teal diagonal line) while fetching
- Tab bar still shows: `All` | `Unread`
- Count bar still shows global: `324 Unread Messages` (NOT scoped to Drafts count)
- Right pane: blank white

**Populated state (Frame 04):**
- Each draft row shows:
  - Blue unread dot (●) left of contact name
  - Contact name (teal, clickable) + `Draft` label in grey italic
  - Draft count (e.g., `Draft 1`) — number of drafts in that thread
  - Date (right-aligned)
  - Subject line
  - Body preview (truncated)
  - Attachment paperclip icon (where applicable)
- No thread-action icons on hover visible in these frames (may appear on hover)

**Draft compose panel (open state):**
- Shows in right column with the original email thread above
- Bottom section: reply editor with full toolbar
- Actions: `Delete` | `Send` | `Send & ↓` | `⏰` (clock = schedule send)
- Signature auto-injected (Matt Ryan block with logo, license disclosure)
- Templates accessible via `Templates` link in editor footer

---

### C. TOP-RIGHT ICON BAR — Complete Spec

The top-right of the nav bar contains 5 icon buttons (left to right):

```
[📧] [💬] [👤📞] [🔔] [👤▼]
```

#### Icon 1 — Email Compose (envelope)
- Circle button, teal background
- Icon: envelope/email
- Function: quick-compose new email

#### Icon 2 — SMS / Chat Compose (speech bubble)
- Circle button, purple/blue-teal background
- Icon: speech bubble / comment
- Function: quick-compose SMS or in-app message

#### Icon 3 — Phone / Calling (person + phone)
- Circle button, green background
- Icon: person silhouette with phone handset OR phone receiver
- Function: **CALLING METHOD PICKER** — this is the calling-method selector

**Calling method picker spec (inferred from icon and FUB convention):**

When clicked, opens a small dropdown/popover with calling method options:

| Option | Description |
|---|---|
| **Internet** | Call via FUB's built-in VoIP/browser calling |
| **Mobile** | Call via mobile device (FUB mobile app dials out) |
| **Ask** | Prompt user to choose method at call time |

The current selected method is represented by the icon state or a checkmark on the active option. In these frames, the icon appears as a solid green circle with a phone/person icon — no dropdown is shown open, so the exact dropdown UI is not captured in these frames, only the trigger icon.

#### Icon 4 — Bell / Notification Center
- Circle button, dark grey background (charcoal)
- Icon: bell (`🔔`)
- **Badge:** Small orange/red dot visible on the bell in frames where notifications are unread (f05_q2 shows an orange dot at top-right of the bell circle)
- **Badge color:** Orange-red (not a numeric badge in these frames — just a dot indicating "unread notifications exist")

**Bell click behavior (Frame 05):**
- Clicking the bell icon navigates to the full **Notification Settings page** (`/notifications/settings` or similar route)
- The page is NOT a slide-out panel/dropdown — it is a full-page route change
- The "Clicked" tooltip appears in f05 over the orange bell dot area

#### Icon 5 — User Avatar / Account Menu
- Circle button, shows Matt's actual headshot photo
- Dropdown arrow `▼` to the right
- Click opens user account menu (not shown in these frames)

---

### D. NOTIFICATION SETTINGS PAGE — Full Spec

**Page title:** `Your Personal Notification Settings`
**Sub-description:** `Change how you get notified about Follow Up Boss events. These settings affect only you, not the rest of your team.`
**Help link:** `ⓘ How Notifications work` (top right of page header)

**Page structure — three sections with notification matrix tables:**

#### Section 1 (personal / My Inbox events)
- No section label (default/implicit section)
- ~10–12 event rows

#### Section 2: `Team Inbox`
- Section label: `Team Inbox` (grey, above table)
- ~2 event rows

#### Section 3: `Pond`
- Section label: `Pond` (grey, above table)
- Partially visible rows

**Matrix table columns (5 delivery channels) for ALL sections:**

| Column | Icon | Meaning |
|---|---|---|
| 1 | `🔔` Bell | Push notification (browser/OS) |
| 2 | `🖥` Monitor/desktop | Desktop app notification |
| 3 | `📱` Mobile phone | Mobile push notification (FUB mobile app) |
| 4 | `💬` Chat bubble | In-app notification |
| 5 | `✉` Envelope | Email notification |

**Table row structure:**
- Column 1 (Event): event name text (loading skeleton in this frame)
- Columns 2–6: toggle or checkbox control (loading skeleton in this frame)

**Toggle/checkbox style:** Small rectangular grey shimmer in loading state — likely renders as checkbox or toggle switch when loaded

**Background:** light grey/off-white (`#f5f5f5` approx) page background
**Table sections:** white card/panel with `8–10px` border radius (estimated), light shadow or border

---

### E. INBOX CONVERSATION LIST — Detailed Anatomy

Per-row elements:
1. **Unread dot** — filled blue circle (`●`) left edge, appears when thread has unread messages
2. **Contact avatar** — circular, 2-letter initials, teal background (or custom color)
3. **Contact name** — teal/blue link, bold if unread
4. **Message count** — small number after name (e.g., `2`, `6`, `9`) indicating messages in thread
5. **Date** — right-aligned, grey, relative or absolute (e.g., `Jun 23`, `May 18`, `Mar 18, 2026`)
6. **Subject line** — normal weight, truncated
7. **Body preview** — grey, smaller, truncated with `...`
8. **Type icon** — left of subject:
   - `📧` Envelope = email
   - `💬` Bubble = SMS/text
   - `📎` Paperclip = has attachment
9. **Attachment icon** — paperclip (`📎`) right-aligned on rows with attachments

**Unread visual treatment:** Unread rows have blue dot + bolder contact name
**Read visual treatment:** No dot, lighter weight

---

### F. CONVERSATION OPEN STATE — Right Panel Structure

Top header:
- `📧 [Contact Name]` — type icon + name (H2-level)
- Subject line (below name, smaller)
- `[Agent avatar] [Agent Name] ▼` — assigned agent picker (dropdown)
- `Close` button — moves conversation to Closed folder
- `⋮` — kebab menu (more options: snooze, mark unread, delete, etc.)

Per-message header:
- Sender avatar (initials circle)
- Reply `↩` | Forward `↪` | Kebab `⋮` icons (right side of message header)
- `to [recipients list] ▼` — expandable recipient list
- Timestamp (right-aligned)

Email body: rendered HTML email content

Attachments: listed by filename + size (KB/MB), clickable links

Contact right-panel (persistent alongside thread):
- Avatar + Name (header)
- `Last Communication [X time ago]` (sub-header)
- Phone(s) with channel icons:
  - Green WhatsApp/SMS icon
  - Teal/blue verified-phone icon (indicates FUB-dialer-verified number)
- Email address(es)
- **Relationships** section (collapsible)
- **Details** section: Stage, Agent, Lender
- **Recent Conversations** (collapsible list)
- **Activity** (collapsible)
- **AgentFire FUB Widget** (3rd-party widget, collapsible)

---

### G. PHONE NUMBER ROW — Channel Icons Spec

Each phone number in the contact panel displays:
- Number as text link: `(541) 706-0911`
- Phone type label: `(mobile)` in grey
- **Green circle icon** (WhatsApp/Messenger/SMS indicator) — solid green circle, likely indicates SMS-capable or WhatsApp-linked
- **Teal/blue circle icon** — verified phone / FUB-dialer verified indicator

These two icons appear side-by-side after the phone type label on every phone row where applicable.

---

### H. EMAIL STATUS / EMAIL CONNECTION INDICATOR

In Frame 02 (q2), the conversation header shows the top-right nav icons. The first circle icon (envelope) = email integration shortcut. Connection status of email accounts is indicated separately via Admin settings (not directly shown in these frames in inbox view).

However, within individual email messages:
- Emails originating from integrated accounts show normally
- The `Me ▼` dropdown at conversation top-right allows switching the sending agent/account

**Email connection health indicators (inferred from FUB architecture, not directly visible in these frames):** Email connection status would appear in Admin > Email Integrations, not in the inbox view itself. The inbox treats all connected email as seamless; disconnected email would likely show a banner or warning at inbox load.

---

### I. OPTED-OUT DISPLAY

Not directly visible in these 5 frames. Based on FUB conventions observed elsewhere:

From the inbox conversation panel, opted-out contacts would show:
- An "Opted Out" badge or indicator near the phone number row (replacing or supplementing the green/teal icons)
- SMS/email compose actions would be disabled or show a warning tooltip

The specific opted-out display UI is NOT captured in these frames.

---

### J. EMAIL SIGNATURE BLOCK — Full Transcription (from Frame 04)

```
Matt Ryan
Owner & Principal Broker · Ryan Realty LLC

541.703.3095
matt@ryan-realty.com
ryan-realty.com

Building community through authentic relationships and
exceptional customer service.

[Ryan Realty logo — rectangular image, "Ryan Realty" wordmark]

Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet
Ryan Realty LLC - Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker.
```

---

### K. DRAFT COMPOSE TOOLBAR — Complete Icon Set

Visible toolbar icons in draft compose area:

**Text formatting:**
- `B` Bold
- `I` Italic
- `U` Underline
- `—` Strikethrough

**Structure:**
- `≡` Bulleted/ordered list
- `↔` Indent/outdent or alignment

**Insert:**
- `📎` Attachment (file upload)
- `🖼` Image insert
- `☺` Emoji picker
- `🎬` Video embed (or GIF)
- `T` Font/text size
- `<>` HTML/source code toggle

**Send actions (bottom bar):**
- `Delete` (trash icon, red/destructive)
- `Send` (outlined, secondary button)
- `Send & ↓` (teal filled, primary — send and archive/close)
- `⏰` (clock icon, scheduled send)

---

### L. GLOBAL UNREAD COUNT vs FOLDER COUNT

**Important spec finding:**

The `324 Unread Messages` count bar appears in BOTH:
- Frame 02 (My Inbox / All tab selected) — correct context
- Frame 03 (Drafts folder selected) — same count persists

This indicates the `324 Unread Messages` count is a **global inbox count**, not a per-folder count. It does NOT update when navigating between Inbox/Assigned/Drafts/Sent/Closed subfolders.

The folder-level count is shown only in the sidebar parent item: `My Inbox (559)`.

The tab bar (`All` | `Unread`) persists across all subfolder views.

---

## COMPONENT TREE FOR RESPONSIVE-WEB REBUILD

```
<InboxLayout>
  ├── <GlobalNav>                        # Top bar, full-width, dark bg
  │   ├── <AppMenuIcon />                # Grid/waffle
  │   ├── <NavLink to="/people" />
  │   ├── <NavLink to="/inbox" icon="inbox" active />
  │   ├── <NavLink to="/tasks" />
  │   ├── <NavLink to="/calendar" />
  │   ├── <NavLink to="/deals" />
  │   ├── <NavLink to="/reporting" />
  │   ├── <NavLink to="/admin" />
  │   ├── <GlobalSearch placeholder="Search" />
  │   └── <QuickActionBar>
  │       ├── <QuickComposeEmail />      # Teal circle, envelope icon
  │       ├── <QuickComposeSMS />        # Purple circle, bubble icon
  │       ├── <CallingMethodPicker>      # Green circle, phone icon
  │       │   └── <CallingMethodDropdown>
  │       │       ├── <CallingOption value="internet" label="Internet" />
  │       │       ├── <CallingOption value="mobile" label="Mobile" />
  │       │       └── <CallingOption value="ask" label="Ask" />
  │       ├── <NotificationBell badge={hasUnread} />   # Dark circle, bell
  │       │   # Navigates to /notifications/settings (full page)
  │       └── <UserAccountMenu avatar={photo} />
  │
  ├── <InboxSidebar>                     # ~160px, white bg
  │   ├── <InboxSection label="My Inbox" count={559} collapsible>
  │   │   ├── <FolderLink icon="inbox" label="Inbox" />
  │   │   ├── <FolderLink icon="assigned" label="Assigned" />
  │   │   ├── <FolderLink icon="drafts" label="Drafts" active />
  │   │   ├── <FolderLink icon="sent" label="Sent" />
  │   │   └── <FolderLink icon="closed" label="Closed" />
  │   ├── <InboxSection label="Company" count={54} collapsible collapsed />
  │   └── <ManageLink />                 # Gear icon, always at bottom
  │
  ├── <ConversationList>                 # Center column, ~280px
  │   ├── <BulkSelectHeader label="Select conversations" />
  │   ├── <FilterTabBar>
  │   │   ├── <Tab label="All" active />
  │   │   └── <Tab label="Unread" />
  │   │   └── <FilterButton label="Filter" />   # Dropdown
  │   ├── <UnreadCountBar count={324} />         # "324 Unread Messages"
  │   └── <ConversationListItems>
  │       └── <ConversationRow
  │               unread={bool}
  │               avatar={initials|photo}
  │               contactName={string}
  │               messageCount={number}
  │               date={string}
  │               subject={string}
  │               bodyPreview={string}
  │               messageType={"email"|"sms"}
  │               hasAttachment={bool}
  │               isDraft={bool}         # Shows "Draft" label when true
  │           />
  │
  └── <ConversationPane>                 # Right column, flex-1
      ├── <ConversationHeader>
      │   ├── <MessageTypeIcon type="email" />
      │   ├── <ConversationTitle name={contactName} subject={subject} />
      │   ├── <AgentPicker value={agent} />
      │   ├── <CloseButton />
      │   └── <MoreActionsMenu />
      ├── <ThreadMessages>
      │   └── <EmailMessage
      │           sender={name}
      │           timestamp={string}
      │           recipients={array}
      │           body={html}
      │           attachments={array}
      │           actions={[reply, forward, more]}
      │       />
      ├── <ContactPanel>                 # Right rail within conversation pane
      │   ├── <ContactHeader avatar initials name lastComm />
      │   ├── <PhoneRow
      │           number="(541) 706-0911"
      │           type="mobile"
      │           smsEnabled={bool}      # Green WhatsApp icon
      │           dialerVerified={bool}  # Teal verified icon
      │           optedOut={bool}        # (not captured) opted-out badge
      │       />
      │   ├── <EmailRow address={email} />
      │   ├── <RelationshipsSection count={n} collapsible addable />
      │   ├── <DetailsSection>
      │   │   ├── <DetailField label="Stage" value={stage} />
      │   │   ├── <DetailField label="Agent" value={agent} />
      │   │   └── <DetailField label="Lender" value={lender} />
      │   ├── <RecentConversationsSection conversations={array} />
      │   ├── <ActivitySection />
      │   └── <AgentFireWidget />        # 3rd-party integration widget
      └── <ComposeArea>
          ├── <ReplyToBar recipients={array} />
          ├── <QuickTagChips tags={["Introduction","Follow Up","Still Buying","Nurture Lead","Custom"]} />
          ├── <RichTextEditor
          │       toolbar={[bold,italic,underline,strike,list,indent,attach,image,emoji,video,fontsize,code]}
          │   />
          ├── <EmailSignatureBlock>
          │   └── {/* Matt Ryan signature with logo + legal disclosure */}
          └── <ComposeActionBar>
              ├── <DeleteDraftButton />
              ├── <SendButton />
              ├── <SendAndArchiveButton />   # "Send & ↓"
              ├── <ScheduleSendButton />     # Clock icon
              ├── <AttachmentsButton />
              └── <TemplatesButton />
```

---

## NOTIFICATION SETTINGS PAGE — Component Tree

```
<NotificationSettingsPage route="/notifications/settings">
  ├── <PageHeader>
  │   ├── <PageTitle>Your Personal Notification Settings</PageTitle>
  │   ├── <PageDescription>
  │   │     Change how you get notified about Follow Up Boss events.
  │   │     These settings affect only you, not the rest of your team.
  │   │   </PageDescription>
  │   └── <HowNotificationsWorkLink />    # "ⓘ How Notifications work"
  │
  ├── <NotificationSection label={null}>  # Personal / My Inbox events
  │   └── <NotificationMatrix>
  │       ├── <MatrixHeader>
  │       │   ├── <Column>Event</Column>
  │       │   ├── <Column icon="bell">Push</Column>
  │       │   ├── <Column icon="desktop">Desktop</Column>
  │       │   ├── <Column icon="mobile">Mobile</Column>
  │       │   ├── <Column icon="chat">In-App</Column>
  │       │   └── <Column icon="email">Email</Column>
  │       └── <MatrixRows>               # ~10-12 rows (names loading)
  │           └── <MatrixRow
  │                   eventName={string}
  │                   channels={{push, desktop, mobile, inApp, email}}
  │               />
  │
  ├── <NotificationSection label="Team Inbox">
  │   └── <NotificationMatrix>           # ~2 rows
  │
  └── <NotificationSection label="Pond">
      └── <NotificationMatrix>           # ~2+ rows
```

**MatrixRow cell controls** (rendered when loaded, shimmer when loading):
- Each channel cell: checkbox or toggle switch
- `checked` = notification enabled for that event + channel
- `unchecked` = notification disabled

---

## EXACT TEXT TRANSCRIPTIONS

### Frame 03 — Drafts folder empty state
- Sidebar: `My Inbox (559)`, `Inbox`, `Assigned`, **`Drafts`** (bold), `Sent`, `Closed`, `Company (54)`, `⚙ Manage`
- Tab bar: `All` | `Unread`
- Count bar: `324 Unread Messages`
- Main area: (blank, no text)

### Frame 04 — Drafts list visible, Mary Bowman open
- Draft rows include `Draft` label in grey after contact name
- Template text visible in James L Martino row: `Subject: Quick Check-In Hi {{ FirstName }},` — confirms Handlebars-style template variable syntax `{{ FirstName }}`
- "Documents Needed - Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701 - Tyler Nicoll" — exact subject
- Highlighted passage: `Bowman, you can provide it as closing; I just need to verify you` (orange/yellow highlight in quoted email)
- Document names: `Map.pdf (1 MB)`, `PRELIMINARY REPORT-LINKED.PDF (301 KB)`, `Seller Opening Package.pdf (564 KB)`
- Activity: `Seen 6 months ago` | `AT A GLANCE` | `97701`

### Frame 05 — Notification Settings page
- `Your Personal Notification Settings`
- `Change how you get notified about Follow Up Boss events. These settings affect only you, not the rest of your team.`
- `ⓘ How Notifications work`
- Section labels: `Team Inbox`, `Pond`
- Column headers (icons only): Bell | Desktop | Mobile | Chat | Email

### Frame 02 — Contact panel phone icons
- `(541) 706-0911 (mobile)` + green circle + teal circle
- `realestatetiffany@gmail.com`
- `(714) 337-6028 (mobile)` + green circle + blue circle (Mary Bowman)
- `(909) 343-0531 (mobile)` + green circle + blue circle (Yahson Terry)

---

## SUMMARY OF GAPS NAILED

| Gap | Documented |
|---|---|
| **Drafts folder** | Empty state (white, no placeholder), populated state (Draft label on rows, draft count, compose panel with Delete/Send/Send+Archive/Schedule actions, signature auto-injected, Templates link) |
| **Notification Center panel** | Full-page route (not slide-out), titled "Your Personal Notification Settings", 3 sections (personal/Team Inbox/Pond), 5 channel columns (Bell/Desktop/Mobile/In-App/Email), per-event toggles, "How Notifications work" help link, per-user scope note |
| **Bell icon** | Dark circle, orange dot badge on unread, navigates to full settings page |
| **Calling method picker** | Green circle icon (phone/person), triggers dropdown with Internet/Mobile/Ask options (icon confirmed, dropdown not open in these frames) |
| **Email connection status** | Not surfaced in inbox view; handled in Admin; no visible per-inbox connection banner in these frames |
| **Opted-out display** | Not captured in these frames — would appear near phone number row in contact panel |
| **Inbox folder tree** | Complete: Inbox, Assigned, Drafts, Sent, Closed under My Inbox; Company section collapsible; Manage link at bottom |
| **Conversation list anatomy** | Unread dot, avatar, name, thread count, date, subject, preview, type icon, attachment icon, Draft label |
| **Contact panel** | Phone with WhatsApp/verified icons, email, Relationships, Details (Stage/Agent/Lender), Recent Conversations, Activity, AgentFire widget |
| **Rich text toolbar** | Full 12-icon set documented |
| **Email signature** | Full transcription with logo, legal line, license #, contact info |

<!-- Mobile per-screen appendix. Original: IMG_6016.PNG | id: mob-48 | tiles: mob-tiles/mob-48_{full,t,m,b}.png -->

# mob-48 — inhouse-web — Contact Detail > Comms Tab > Email Compose Panel

## Identity
- **app_source:** inhouse-web
- **URL in address bar:** ryan-realty.com
- **Module:** Contact Detail (Lead Profile) — Comms sub-tab, email compose panel open
- **How to reach:** Bottom tab "People" → tap any contact row → sub-tab "Comms" (active) → the "Send a message" compose card is the default Comms view
- **iOS status bar contents:** Time "7:39" left-aligned; signal bars (2/4 filled) + WiFi icon + battery icon with "16" label in yellow/amber (low battery) right-aligned
- **Safari chrome:** Present — URL bar shows "ryan-realty.com"; bottom Safari chrome row shows ← → + [2] ···

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt logical canvas)

| Region | y-band (approx pt) | Height | Background color |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | #FFFFFF white |
| Safari URL bar | 54–94 | 40 pt | #F2F2F7 light gray pill on white chrome |
| App nav / header bar | 94–142 | 48 pt | #F8F8F8 near-white (very subtle gray) |
| Contact identity header | 142–205 | 63 pt | #1A1A1A near-black dark band |
| Sub-tab strip | 205–242 | 37 pt | #1A1A1A near-black, same dark band |
| Scrollable content area | 242–736 | 494 pt | #F5F5F5 off-white / page bg |
| App bottom tab bar | 736–800 | 64 pt | #FFFFFF white |
| Safari chrome row | 800–844 | 44 pt | #F2F2F7 light gray |

---

## Nav / header bar (exact)

**Left control:** Hamburger menu icon (three horizontal lines, ≈20pt) — gray, opens side nav drawer.

**Center:** Ryan Realty wordmark — "Ryan Realty" in Amboqia Boriango serif, navy #102742, ~22pt. Sub-label "BEND·OREGON" in small caps, ~9pt, navy. Logo is centered horizontally.

**Right controls (left to right):**
1. Search icon — magnifying glass glyph in white rounded square button (~32×32pt, bg #FFFFFF, border or shadow), gray icon stroke.
2. "M" avatar button — circular, ~32pt diameter, light gray bg (#E8E8E8), letter "M" in dark gray, ~14pt — tapping opens broker account menu.

---

## Bottom tab bar (exact)

Five tabs, evenly distributed, white background, 1pt gray top border:

| Order | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline (home icon) | Home | none | inactive — gray |
| 2 | Inbox tray / envelope-tray outline | Inbox | none | inactive — gray |
| 3 | Two overlapping person silhouettes | **People** | none | **ACTIVE — navy #102742 / bold** |
| 4 | Three stacked layers / cards | Deals | none | inactive — gray |
| 5 | Activity pulse / heartbeat line | Activity | none | inactive — gray |

Active tab (People): icon and label rendered in navy #102742 (or near-black), label font weight ~600. Inactive tabs: gray #8E8E93, weight ~400.

**FAB:** Blue circle button, ~60×60pt, bg #1C6EF3 (bright blue), white "+" icon centered, ~24pt. Positioned bottom-right of the scrollable content area, ~16pt from right edge and above the bottom tab bar, floating (position: fixed). Tapping opens a compose/action picker (new message, new task, etc.) — [INFERRED].

---

## Contact identity header (dark band, exact)

**Left:** Circle avatar, ~56pt diameter, bg #555555 dark gray, white letter "M" centered, ~22pt bold — represents contact initials (Matthew Ryan).

**Center-right of avatar:**
- Primary name: "Matthew Ryan" — white, ~20pt, font-weight 700
- Subtitle line: "Owner · Matt Ryan · Last contact …" — gray #9E9E9E, ~12pt, truncated with ellipsis. "Owner" = contact role/title; "Matt Ryan" = assigned broker; "Last contact …" = last-contact timestamp (truncated).

**Far right:** Lead stage pill badge — white bg (#FFFFFF), rounded pill (~28pt height), contains: filled blue circle dot (~8pt) + "Lead" text in blue #1C6EF3, ~13pt font-weight 500.

---

## Sub-tab strip (exact)

Horizontally scrollable tab row on the dark header band (#1A1A1A). Tabs visible:

| Tab label | State |
|---|---|
| Info | inactive — gray text |
| **Comms** | **ACTIVE — white text + 3pt blue underline (#007AFF)** |
| Tasks | inactive — gray text |
| Homes | inactive — gray text |
| Workflow | inactive — gray text |
| Activi… | inactive — gray text, truncated (full label: "Activity") |

Tab labels ~13pt, white when active with blue underline bar flush to bottom of strip, gray (#9E9E9E) when inactive. Strip is horizontally scrollable; more tabs likely off-screen to the right.

---

## Content — every element, in order (Comms tab, email compose card)

### Card wrapper
- Rounded card, bg #FFFFFF white, radius ~12pt, subtle drop shadow or 1pt #E5E5E5 border
- 12–16pt margin from screen edges
- Begins at y≈260pt

### 1. Card title
- Text: **"Send a message"**
- Style: dark #1A1A1A, ~18pt, font-weight 600
- Top padding ~16pt inside card

### 2. Channel / from-address selector row
- Label line: **"EMAIL · MATT@RYAN-REALTY.COM"**
  - "EMAIL ·" in gray #9E9E9E, ~11pt, all-caps, font-weight 400
  - "MATT@RYAN-REALTY.COM" in gray #9E9E9E but underlined — tappable link to change the from-email / channel. Same ~11pt all-caps.
- Tapping the email presumably opens a channel picker (email vs. SMS, or alternate email) — [INFERRED]

### 3. Template selector (dropdown)
- Full-width rounded rect, bg #F5F5F5 light gray, border #E0E0E0, radius ~8pt, height ~44pt
- Selected value: **"Blank email"** — dark #1A1A1A, ~15pt, font-weight 400
- Right icon: up-down chevron sorter (⇅) glyph, gray, ~20pt — tapping opens template picker sheet
- Options would include saved email templates — [INFERRED]

### 4. To: recipient row
- "To" label: gray #9E9E9E, ~13pt, font-weight 400, left-aligned
- Recipient value: **"Matthew Ryan · matt@ryan-realty.com"** — dark #1A1A1A, ~15pt, font-weight 500
  - Format: contact display name · email address
- Horizontal divider below: 1pt #E5E5E5 line, full width within card

### 5. Subject field
- Rounded rect input, bg #F5F5F5, border #E0E0E0, radius ~8pt, height ~44pt
- Placeholder text: **"Subject"** — gray #BDBDBD, ~15pt, italic or weight 300
- Empty (user has not typed anything)

### 6. "Preview, what sends" row
- Left text: **"Preview, what sends"** — gray #9E9E9E, ~13pt
- Right: **"Edit"** button
  - Bg: #1A1A1A near-black, rounded pill, ~32pt height, ~64pt width
  - Text: "Edit" — white #FFFFFF, ~13pt, font-weight 600
  - Tapping opens the email body editor or template editor — [INFERRED]

### 7. Merge fields section

**Section header:**
- Text: **"MERGE FIELDS — CLICK TO INSERT AT CURSOR"** — all-caps, gray #9E9E9E, ~10pt, font-weight 500, letter-spacing wide

**Row 1 — CONTACT category:**
- Category label: **"CONTACT"** — gray #9E9E9E, ~11pt, all-caps, font-weight 500
- Chip: **"First name"**
  - Style: monospace/Courier-style font (not system sans), ~12pt
  - Bordered pill: 1pt #BDBDBD border on white bg, radius ~16pt (full pill), horizontal padding ~10pt, height ~28pt
  - Tapping inserts the merge tag at cursor position in the message body

**Row 2 — PROPERTY category (label + 1st chip on same row, 2nd row of chips wraps below):**
- Category label: **"PROPERTY"** — gray #9E9E9E, ~11pt, all-caps
- Chip 1: **"Seller property address"** — monospace pill, same style as above
- Chip 2 (wraps to next line): **"Property address"** — monospace pill
- Chip 3 (same wrapped line): **"Address (short)"** — monospace pill

**Row 3 — CMA category:**
- Category label: **"CMA"** — gray #9E9E9E, ~11pt, all-caps
- Chip: **"CMA link"** — monospace pill

### 8. Message body textarea (partially visible, cut off)
- Large rounded rect, bg #F9F9F9 or #FFFFFF, border #E0E0E0, radius ~8pt
- Placeholder text: **"Message. Sends from the signed-in broker's own mailbox."** — gray #BDBDBD, ~14pt, regular weight (italic unclear)
- Height: tall, ~80pt visible before screen clips, more scrollable below
- Empty (no user input)

---

## Colors, type & iconography

| Element | Color / style |
|---|---|
| App nav bar bg | #F8F8F8 near-white |
| Contact header bg | #1A1A1A near-black |
| Ryan Realty wordmark | #102742 navy, Amboqia Boriango serif |
| Active sub-tab text | #FFFFFF white |
| Active sub-tab underline | #007AFF iOS blue |
| Inactive sub-tab text | #9E9E9E medium gray |
| Lead pill bg | #FFFFFF white |
| Lead pill dot | #1C6EF3 blue |
| Lead pill text | #1C6EF3 blue, ~13pt |
| Avatar bg | #555555 dark gray |
| Avatar letter | #FFFFFF white |
| Card bg | #FFFFFF white |
| Card radius | ~12pt |
| Page bg | #F5F5F5 off-white |
| Primary text | #1A1A1A near-black |
| Secondary / label text | #9E9E9E medium gray |
| Placeholder text | #BDBDBD light gray |
| Input bg | #F5F5F5 light gray |
| Input border | #E0E0E0 |
| Input radius | ~8pt |
| Edit button bg | #1A1A1A |
| Edit button text | #FFFFFF, ~13pt, weight 600 |
| Chip border | #BDBDBD, 1pt |
| Chip text font | Monospace (Courier New or similar), ~12pt |
| FAB bg | #1C6EF3 bright blue |
| FAB icon | #FFFFFF, "+" 24pt |
| Bottom tab active | #102742 navy (or matching dark) |
| Bottom tab inactive | #8E8E93 gray |
| Merge field section header | #9E9E9E, all-caps, wide letter-spacing |
| Section header size | ~10–11pt |

---

## Interactions & gestures [INFERRED]

- **Tap "EMAIL · MATT@RYAN-REALTY.COM"** → opens channel picker sheet (switch between email/SMS, or change from-address)
- **Tap template dropdown ("Blank email" + ⇅)** → presents bottom sheet with list of saved email templates; selecting one populates subject + body
- **Tap To: recipient row** → may open recipient search to add more recipients or change the To address
- **Tap Subject input** → keyboard appears, user types subject line
- **Tap "Preview, what sends"** → opens a preview panel showing how the merged email will look with real contact data substituted
- **Tap "Edit" (black button)** → opens full body editor view (rich text or plain text)
- **Tap merge field chip** → inserts the corresponding merge tag (e.g., `{{contact.first_name}}`) at cursor position in the message body textarea
- **Tap message textarea** → keyboard appears, user types body; merge field chips stay accessible above keyboard
- **Tap FAB (+)** → opens action picker sheet (new email, new SMS, new note, new task, new call log — [INFERRED from context])
- **Swipe sub-tab strip left/right** → reveals additional tabs (Homes, Workflow, Activity)
- **Pull-to-refresh on content area** → refreshes contact data + comms history — [INFERRED]
- **Scroll content area down** → reveals the full message body textarea and possibly send button / additional options below the visible fold
- **Tap bottom tab (Home/Inbox/Deals/Activity)** → navigates to that top-level section, replacing the current contact detail view
- **Safari ← button** → back navigation to People list
- **Safari [2] tab count** → opens tab switcher showing 2 open tabs

---

## Build notes (component tree)

```tsx
<MobileShell>

  {/* iOS status bar — rendered by OS, no markup needed */}
  <SafariURLBar url="ryan-realty.com" />

  {/* App header */}
  <TopBar>
    <HamburgerButton onClick={openSideNav} />
    <RyanRealtyLogo /> {/* SVG or <img> from design_system/ryan-realty/assets/brand/logo-blue.png */}
    <SearchButton rounded />
    <BrokerAvatarButton initial="M" onClick={openAccountMenu} />
  </TopBar>

  {/* Contact identity band */}
  <ContactHeaderBand bg="#1A1A1A">
    <InitialsAvatar name="Matthew Ryan" size={56} bg="#555555" />
    <ContactIdentity>
      <ContactName>Matthew Ryan</ContactName>
      <ContactMeta>Owner · Matt Ryan · Last contact …</ContactMeta>
    </ContactIdentity>
    <LeadStagePill dot color="#1C6EF3" label="Lead" />
  </ContactHeaderBand>

  {/* Sub-tab navigation strip */}
  <SubTabStrip bg="#1A1A1A" scrollable>
    <SubTab label="Info" active={false} />
    <SubTab label="Comms" active={true} underlineColor="#007AFF" />
    <SubTab label="Tasks" active={false} />
    <SubTab label="Homes" active={false} />
    <SubTab label="Workflow" active={false} />
    <SubTab label="Activity" active={false} />
  </SubTabStrip>

  {/* Scrollable content area */}
  <ScrollArea bg="#F5F5F5">

    {/* Email compose card */}
    <Card radius={12} shadow bg="#FFFFFF" mx={12} mt={12}>

      <CardTitle>Send a message</CardTitle>

      {/* Channel selector */}
      <ChannelLabel>
        <span className="channel-type">EMAIL ·</span>
        <a className="channel-address" href="#" onClick={openChannelPicker}>
          MATT@RYAN-REALTY.COM
        </a>
      </ChannelLabel>

      {/* Template dropdown */}
      <TemplateSelect
        value="Blank email"
        icon="updown-chevron"
        onChange={handleTemplateChange}
        options={[/* fetched from /api/crm/email-templates */]}
      />

      {/* To field */}
      <ToField>
        <ToLabel>To</ToLabel>
        <RecipientValue>Matthew Ryan · matt@ryan-realty.com</RecipientValue>
      </ToField>
      <Divider />

      {/* Subject */}
      <Input
        placeholder="Subject"
        value={subject}
        onChange={setSubject}
        bg="#F5F5F5"
        border="#E0E0E0"
        radius={8}
      />

      {/* Preview row */}
      <PreviewRow>
        <PreviewLabel>Preview, what sends</PreviewLabel>
        <Button variant="dark" size="sm" onClick={openPreview}>Edit</Button>
      </PreviewRow>

      {/* Merge fields */}
      <MergeFieldsSection>
        <MergeFieldsHeader>MERGE FIELDS — CLICK TO INSERT AT CURSOR</MergeFieldsHeader>

        <MergeCategory label="CONTACT">
          <MergeChip tag="{{contact.first_name}}" label="First name" onClick={insertAtCursor} />
        </MergeCategory>

        <MergeCategory label="PROPERTY">
          <MergeChip tag="{{property.seller_address}}" label="Seller property address" onClick={insertAtCursor} />
          <MergeChip tag="{{property.address}}" label="Property address" onClick={insertAtCursor} />
          <MergeChip tag="{{property.address_short}}" label="Address (short)" onClick={insertAtCursor} />
        </MergeCategory>

        <MergeCategory label="CMA">
          <MergeChip tag="{{cma.link}}" label="CMA link" onClick={insertAtCursor} />
        </MergeCategory>
      </MergeFieldsSection>

      {/* Message body */}
      <Textarea
        placeholder="Message. Sends from the signed-in broker's own mailbox."
        value={body}
        onChange={setBody}
        minHeight={120}
        bg="#F9F9F9"
        border="#E0E0E0"
        radius={8}
        ref={bodyRef} {/* for insertAtCursor targeting */}
      />

      {/* Send button — likely below the fold, not visible in screenshot */}
      {/* <SendButton /> */}

    </Card>

  </ScrollArea>

  {/* Floating action button */}
  <Fab
    bg="#1C6EF3"
    icon="plus"
    position="bottom-right"
    bottom={80} {/* above tab bar */}
    right={16}
    size={60}
    onClick={openActionPicker}
  />

  {/* Bottom tab bar */}
  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E5E5">
    <Tab icon={<HomeIcon />} label="Home" active={false} href="/crm" />
    <Tab icon={<InboxIcon />} label="Inbox" active={false} href="/crm/inbox" />
    <Tab icon={<PeopleIcon />} label="People" active={true} href="/crm/people" />
    <Tab icon={<DealsIcon />} label="Deals" active={false} href="/crm/deals" />
    <Tab icon={<ActivityIcon />} label="Activity" active={false} href="/crm/activity" />
  </BottomTabBar>

  {/* Safari chrome — rendered by OS/browser, no app markup */}
  <SafariChrome back forward newTab tabCount={2} more />

</MobileShell>
```

### Sizing & spacing notes
- **Card:** mx 12pt, radius 12pt, padding 16pt inside, white bg, subtle shadow
- **Contact header band:** height ~63pt, horizontal padding 16pt
- **Sub-tab strip:** height ~37pt, tab padding 0 12pt, font ~13pt
- **TopBar:** height ~48pt, px 16pt
- **Avatar:** 56pt diameter, initials 22pt
- **TemplateSelect:** height ~44pt, radius 8pt
- **Input / Textarea:** radius 8pt, bg #F5F5F5, border 1pt #E0E0E0, padding 12pt
- **Merge chip:** radius 16pt (full pill), border 1pt #BDBDBD, px 10pt, height ~28pt, font: monospace ~12pt
- **Edit button:** radius 20pt pill, px 16pt, height ~32pt, bg #1A1A1A
- **FAB:** 60pt diameter, radius 30pt (full circle), bg #1C6EF3
- **Bottom tab bar:** height 64pt, 5 items evenly spaced, icon ~24pt, label ~10pt

### Data bindings
- `contact.id` → drives the whole page
- `contact.display_name` → "Matthew Ryan"
- `contact.initials` → "M"
- `contact.title` → "Owner"
- `contact.assigned_broker` → "Matt Ryan"
- `contact.last_contact_at` → "Last contact …" (truncated)
- `contact.stage` → "Lead"
- `broker.email` → "matt@ryan-realty.com" (send-from address)
- `email_templates[]` → populates template dropdown
- `merge_fields[]` → grouped by category (CONTACT, PROPERTY, CMA); each has `{ label, tag, category }`
- `compose.subject`, `compose.body` → local state
- `cursor_position` → tracked in textarea ref for merge-field insertion

### Key implementation notes
1. The merge chip font is distinctly **monospace** (Courier New or `font-family: monospace`) — not the system sans-serif — this distinguishes them as "code/token" chips visually.
2. Merge chips wrap across lines within their category row (PROPERTY has 3 chips that wrap to 2 lines).
3. The message textarea hint says "Sends from the signed-in broker's own mailbox" — the send action must use the authenticated broker's Gmail/email credentials (not a generic noreply address).
4. The "Preview, what sends" text + Edit button: "Preview" is a passive label, "Edit" is the CTA — they are side by side, not a button labeled "Preview, what sends."
5. The FAB is overlaid at position fixed above the tab bar — it partially obscures the rightmost merge chip (CMA link row) in the screenshot.
6. Sub-tabs are horizontally scrollable; only 6 are visible, more may exist (e.g., Notes, Files).
7. The template dropdown uses an up-down sorter/stepper chevron (⇅), not a standard single-direction chevron — indicates a spinner-style or sort-style interaction.

<!-- Mobile per-screen appendix. Original: IMG_6029.PNG | id: mob-57 | tiles: mob-tiles/mob-57_{full,t,m,b}.png -->

# mob-57 — inhouse-web — Contact Detail: Comms Tab (Email Compose)

## Identity
- **app_source:** inhouse-web
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact Detail page, "Comms" sub-tab active, showing the email compose/send-a-message panel with merge-field picker open
- **how to reach:** Bottom tab bar → People → tap a contact row → sub-tab "Comms"
- **iOS status bar:** 4:55 (left), signal bars (3/4 filled) + WiFi + 100% battery with charging bolt (right)
- **URL in Safari address bar:** `ryan-realty.com` (centered in the collapsed Safari address bar chrome, no path visible)

---

## Screen regions (top → bottom, 390×844 pt logical)

| Region | Approx y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | white `#ffffff` |
| Safari URL bar (collapsed) | 54–88 | 34 | white `#ffffff`, text `ryan-realty.com` centered in gray |
| App nav/header bar | 88–140 | 52 | light gray `#f2f2f2` |
| Contact hero card | 140–258 | 118 | dark charcoal `#1e1e1e` / `#222222` |
| Sub-tab strip | 258–300 | 42 | dark charcoal `#1e1e1e` / `#222222` |
| Scrollable content area | 300–780 | 480 | light gray `#f0f0f0` / `#f5f5f5` |
| Bottom tab bar | 780–844 | 64 | white `#ffffff` |

---

## Nav / header bar (exact)

- **Left control:** Hamburger menu icon (three horizontal lines, ≈18pt, dark gray `#444444`), positioned ~14pt from left edge
- **Center:** Ryan Realty wordmark — "Ryan Realty" in Amboqia Boriango (brand display font), navy `#102742`, roughly 110pt wide; sub-label "BEND·OREGON" in small caps below the wordmark, same navy color, ≈9pt
- **Right controls (left to right):**
  1. Search icon — magnifier glyph in a white rounded-rect button (~36×36 pt, white bg, light shadow/border), `#444444`
  2. Avatar pill — circle with letter "M" (for Matt), light gray `#e0e0e0` bg, dark text `#333333`, ≈36pt diameter

---

## Bottom tab bar (exact)

| # | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline | Home | none | inactive, gray `#9ca3af` |
| 2 | Inbox/tray outline | Inbox | none | inactive, gray `#9ca3af` |
| 3 | Two-person silhouette (group) | People | none | **ACTIVE**, dark `#111111` / `#1a1a1a` (bolder icon + bolder label) |
| 4 | Stacked layers (3 overlapping rectangles) | Deals | none | inactive, gray `#9ca3af` |
| 5 | Heartbeat/pulse line | Activity | none | inactive, gray `#9ca3af` |

**FAB (Floating Action Button):** Blue circle `#2563eb` (approx), ≈52pt diameter, white `+` plus icon centered, positioned bottom-right corner, ≈20pt from right edge, overlapping above the bottom tab bar at approx y=724pt. Tap action: [INFERRED] compose new message or create new contact/lead.

---

## Contact hero card (exact)

**Background:** dark charcoal `#1e1e1e` spanning full width, ≈118pt tall.

**Left — Avatar:**
- Shape: rounded square (border-radius ≈12pt), ≈80×80pt
- Background: dark gray `#3a3a3a` / `#404040`
- Content: single uppercase letter "L" in white, large (~36pt), semibold, centered — represents "Lead" (no real name/photo available)

**Right of avatar (stacked top to bottom):**
1. **Name line:** "Lead annaasmith664@..." — white, ≈16pt semibold, truncated with ellipsis. This is the auto-generated display name from the email address (the clean-placeholder pattern).
2. **Email line:** "annaasmith664@gmail.com" — light gray `#cccccc`, ≈13pt regular
3. **Phone line:** "123.456.7890" — light gray `#cccccc`, ≈13pt regular
4. **Badge + broker row:**
   - "Lead" badge: white pill background, blue dot `#2563eb` on left, "Lead" text in blue `#2563eb`, border `#2563eb` at ≈1pt, ≈24pt tall, ≈60pt wide, rounded-full
   - Broker attribution: "Matt Ryan" — gray `#999999`, ≈13pt regular, positioned immediately right of the badge

---

## Sub-tab strip (exact)

Full-width, dark charcoal `#1e1e1e` bg, horizontally scrollable (6 tabs, rightmost is clipped).

| # | Label | State |
|---|---|---|
| 1 | Info | inactive, gray `#888888`, ≈14pt regular |
| 2 | **Comms** | **ACTIVE** — white `#ffffff`, ≈14pt semibold, blue underline indicator `#2563eb` ≈2pt thick below the text |
| 3 | Tasks | inactive, gray `#888888`, ≈14pt regular |
| 4 | Homes | inactive, gray `#888888`, ≈14pt regular |
| 5 | Workflow | inactive, gray `#888888`, ≈14pt regular |
| 6 | Activi... | inactive, gray `#888888`, ≈14pt regular (clipped — full label is "Activity") |

The active underline is a solid rectangle pinned to the bottom edge of the tab strip, only under "Comms".

---

## Content (scrollable area) — every element in order

### Section 1 — Quick Action Pills (y ≈ 310–400 pt)

Two rows of pill-shaped action buttons, white background, gray border `#e0e0e0` ~1pt, rounded-full, ≈44pt tall, approximately half-width each (minus gutters). Text is dark `#1a1a1a`, ≈15pt medium. Each has a leading icon.

**Row 1:**
- **Newsletter** — envelope/letter icon (outline, ≈16pt) to left of label
- **Automations** — two interlocking gear/loop icon (looks like a chain-link or automation symbol, ≈16pt) to left of label

**Row 2:**
- **Saved searches** — magnifier icon (≈16pt) to left of label
- **Market reports** — bar-chart icon with ascending bars (≈16pt) to left of label

Tap behavior [INFERRED]: each navigates to the corresponding subscription/service management screen for this contact.

---

### Section 2 — "Send a message" Card (y ≈ 415–780+ pt, scrolls off screen)

A white card, border-radius ≈12pt, subtle shadow, full-width minus 16pt horizontal gutters, padding 16pt inside.

#### Card header
- **"Send a message"** — dark `#1a1a1a`, ≈18pt semibold, top of card

#### Channel / recipient line
- Label: **"EMAIL · ANNAASMITH664@GMAIL.COM"** — small all-caps, gray `#999999`, ≈11pt, spaced tracking; the email address portion is in a slightly different shade (blue-ish underline or just gray, indicating it's a tab/link selector for the channel). The dot `·` separates "EMAIL" from the address.
- This line functions as the active channel selector. [INFERRED] Tapping could switch channel (e.g., SMS vs. Email).

#### Template picker (select/dropdown)
- Full-width rounded-rect input, white bg, gray border `#e0e0e0`, ≈44pt tall
- Current value: **"Blank email"** — dark `#1a1a1a`, ≈15pt regular
- Right side: up/down chevron stepper icon (`⌃⌄`) gray, indicates native `<select>` or custom picker
- Tap: opens a picker/sheet to choose an email template (e.g., pre-built drip templates, or "Blank email")

#### To field
- No input box — displayed as a label row
- **"To"** — gray `#999999`, ≈13pt regular, left side
- **"Lead annaasmith664@gmail.com · annasmi..."** — dark `#1a1a1a`, ≈15pt regular, truncated with ellipsis. The recipient is auto-populated from the contact's email. The "annasmi..." part appears to be a second recipient chip or a name label.
- Thin horizontal divider line `#e8e8e8` below this row

#### Subject field
- Rounded-rect input, white bg, gray border `#e5e5e5`, ≈44pt tall, full card width
- Placeholder: **"Subject"** — gray `#9ca3af`, ≈15pt regular
- Empty state — no value entered yet
- Tap: focuses keyboard to type subject

#### Preview / body section
- **"Preview, what sends"** — dark `#1a1a1a`, ≈15pt regular, left-aligned
- **"Edit"** button — immediately to the right, dark near-black `#111111` filled rounded-rect button (≈80×36pt, border-radius ≈8pt), white label "Edit" ≈14pt semibold
- Tap "Edit" [INFERRED]: expands or navigates to full email body editor

#### Merge fields section
- Section header: **"MERGE FIELDS — CLICK TO INSERT AT CURSOR"** — all-caps, gray `#999999`, ≈11pt, tracking, not bold
- **CONTACT** sub-label: gray `#999999`, ≈11pt, left-aligned
  - Pill chip: **"First name"** — outlined pill, white bg, gray border, dark text `#1a1a1a`, monospace-ish font (appears to render in a monospace or small-caps style), ≈32pt tall, ≈100pt wide
- **PROPERTY** sub-label: gray `#999999`, ≈11pt, left-aligned
  - Pill chip: **"Seller property address"** — same outlined pill style, ≈32pt tall, wider (≈195pt)
  - (Below, partially visible): **"Property address"** pill and **"Address (short)"** pill — side by side in a flow/wrapping row

Tap any merge field pill [INFERRED]: inserts the corresponding merge tag token (e.g., `{{contact.first_name}}`) at the current cursor position in the email body/subject field.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| App header bg | `#f2f2f2` (light warm gray) |
| Contact hero bg | `#1e1e1e` (dark charcoal) |
| Sub-tab strip bg | `#1e1e1e` (matches hero) |
| Active tab underline | `#2563eb` (blue) |
| Active tab text | `#ffffff` white |
| Inactive tab text | `#888888` medium gray |
| Content area bg | `#f0f0f0` / `#f5f5f5` light gray |
| Card bg | `#ffffff` white |
| Card border-radius | ~12pt |
| Card shadow | subtle, `rgba(0,0,0,0.08)` |
| Lead badge color | `#2563eb` blue (dot + text + border) |
| FAB color | `#2563eb` blue |
| Edit button bg | `#111111` near-black |
| Edit button text | `#ffffff` white |
| Pill border | `#e0e0e0` light gray |
| Quick-action pill bg | `#ffffff` white |
| Bottom tab active | `#111111` near-black |
| Bottom tab inactive | `#9ca3af` gray |
| Bottom tab bar bg | `#ffffff` white |
| Primary font | Geist (body/UI) per design system |
| Display/logo font | Amboqia Boriango (nav header wordmark only) |
| Body text color | `#1a1a1a` near-black |
| Secondary text color | `#9ca3af` / `#888888` gray |
| White text (on dark hero) | `#ffffff` and `#cccccc` |
| Merge field pill font | appears monospace/code-style for the pill labels |
| Accent | `#2563eb` blue (not navy #102742 — this is the CRM action blue) |

**Note on accent vs brand navy:** The interactive CRM accent (active tab, badge, FAB, Lead pill) is blue `≈#2563eb`, not the brand navy `#102742`. The brand navy appears only in the Ryan Realty wordmark in the header. This is consistent with other inhouse-web CRM screens.

---

## Interactions & gestures

- **Tap hamburger (☰):** Opens side drawer/nav menu [INFERRED]
- **Tap search icon:** Opens global contact/listing search [INFERRED]
- **Tap "M" avatar:** Opens current broker profile or account settings [INFERRED]
- **Tap "Info" sub-tab:** Switches to contact info view (fields, lead source, stage, etc.)
- **Tap "Comms" sub-tab:** Current screen (no-op)
- **Tap "Tasks" / "Homes" / "Workflow" / "Activity" sub-tabs:** Navigates to respective sub-sections
- **Horizontal scroll on sub-tab strip:** Reveals remaining tabs (at minimum "Activity" is clipped)
- **Tap "Newsletter" pill:** [INFERRED] Opens newsletter subscription management for this contact
- **Tap "Automations" pill:** [INFERRED] Opens automation enrollment panel for this contact
- **Tap "Saved searches" pill:** [INFERRED] Shows/manages saved property searches for this contact
- **Tap "Market reports" pill:** [INFERRED] Opens market report subscription management
- **Tap template picker ("Blank email"):** Opens a bottom sheet or native picker with template options
- **Tap "To" field row:** [INFERRED] Opens recipient selector/editor
- **Tap "Subject" input:** Focuses keyboard, allows typing the email subject
- **Tap "Preview, what sends":** [INFERRED] Shows a preview modal/sheet of what the compiled email will look like
- **Tap "Edit" button:** [INFERRED] Expands email body composer / navigates to full editor view
- **Tap merge field pill (e.g., "First name"):** Inserts merge tag at cursor position in the focused text field
- **Scroll up/down in content area:** Reveals more merge field categories (there are likely more: Date, Agent, etc.)
- **Tap FAB (+):** [INFERRED] Opens compose sheet for new message or quick-create action
- **Tap bottom tab items:** Navigates to Home / Inbox / People list / Deals / Activity feed
- **Pull-to-refresh on scrollable area:** [INFERRED] Refreshes comms history
- **Tap contact name in hero (underlined):** [INFERRED] May allow editing the name

---

## Build notes (component tree)

```
<MobileShell>                          /* full-screen 390×844pt container */

  <iOSStatusBar />                     /* system-rendered; 54pt */

  <SafariURLBar url="ryan-realty.com" />  /* 34pt; Safari chrome, collapsed */

  <AppNavBar>                          /* 52pt, bg=#f2f2f2 */
    <HamburgerIcon />                  /* left, opens drawer */
    <BrandWordmark
      src="design_system/assets/brand/logo-blue.png"
      subLabel="BEND·OREGON"
    />                                 /* center */
    <SearchIconButton />               /* right-1, white rounded-rect */
    <BrokerAvatarPill initial="M" />   /* right-2, circle avatar */
  </AppNavBar>

  <ContactHeroCard bg="#1e1e1e">       /* 118pt dark card */
    <InitialAvatar
      letter="L"
      size={80}
      bg="#3a3a3a"
      borderRadius={12}
    />
    <ContactHeroInfo>
      <ContactName
        value="Lead annaasmith664@..."
        color="#ffffff"
        fontSize={16}
        fontWeight={600}
        truncate
      />
      <ContactEmail value="annaasmith664@gmail.com" color="#cccccc" fontSize={13} />
      <ContactPhone value="123.456.7890" color="#cccccc" fontSize={13} />
      <ContactMetaRow>
        <LeadStageBadge
          dot="#2563eb"
          label="Lead"
          color="#2563eb"
          bg="white"
          border="#2563eb"
        />
        <AssignedBroker value="Matt Ryan" color="#999999" fontSize={13} />
      </ContactMetaRow>
    </ContactHeroInfo>
  </ContactHeroCard>

  <ContactSubTabStrip
    bg="#1e1e1e"
    activeColor="#ffffff"
    inactiveColor="#888888"
    activeUnderlineColor="#2563eb"
    scrollable
    tabs={["Info", "Comms", "Tasks", "Homes", "Workflow", "Activity"]}
    activeTab="Comms"
  />

  <ScrollableContent bg="#f0f0f0" px={16} pt={16}>

    <QuickActionPillGrid cols={2} gap={10} mb={16}>
      <QuickActionPill icon={<EnvelopeIcon />} label="Newsletter" onTap={...} />
      <QuickActionPill icon={<AutomationsIcon />} label="Automations" onTap={...} />
      <QuickActionPill icon={<SearchIcon />} label="Saved searches" onTap={...} />
      <QuickActionPill icon={<BarChartIcon />} label="Market reports" onTap={...} />
    </QuickActionPillGrid>

    <Card bg="#ffffff" borderRadius={12} shadow px={16} py={16}>
      <CardTitle text="Send a message" fontSize={18} fontWeight={600} mb={16} />

      <ChannelSelector
        channel="EMAIL"
        address="ANNAASMITH664@GMAIL.COM"
        labelStyle="allcaps-small"
        color="#999999"
        mb={12}
      />

      <TemplatePickerSelect
        value="Blank email"
        options={["Blank email", /* other saved templates */]}
        height={44}
        borderRadius={8}
        mb={12}
      />

      <ToField
        label="To"
        recipients={["Lead annaasmith664@gmail.com", "annaasmith664@gmail.com"]}
        truncate
        mb={0}
      />
      <Divider color="#e8e8e8" />

      <SubjectInput
        placeholder="Subject"
        value=""
        height={44}
        borderRadius={8}
        mt={12}
        mb={12}
      />

      <PreviewRow>
        <PreviewLabel text="Preview, what sends" />
        <EditButton
          label="Edit"
          bg="#111111"
          color="#ffffff"
          borderRadius={8}
          px={16}
          height={36}
        />
      </PreviewRow>

      <MergeFieldsSection mt={16}>
        <SectionHeader text="MERGE FIELDS — CLICK TO INSERT AT CURSOR" />

        <MergeFieldGroup label="CONTACT">
          <MergeFieldPill label="First name" token="{{contact.first_name}}" />
        </MergeFieldGroup>

        <MergeFieldGroup label="PROPERTY">
          <MergeFieldPill label="Seller property address" token="{{property.seller_address}}" />
          <MergeFieldPillRow>
            <MergeFieldPill label="Property address" token="{{property.address}}" />
            <MergeFieldPill label="Address (short)" token="{{property.address_short}}" />
          </MergeFieldPillRow>
          {/* more pills scroll off screen */}
        </MergeFieldGroup>
      </MergeFieldsSection>

    </Card>

  </ScrollableContent>

  <FAB
    icon="+"
    bg="#2563eb"
    color="#ffffff"
    size={52}
    position="bottom-right"
    bottom={80}
    right={20}
  />

  <BottomTabBar bg="#ffffff" height={64}>
    <TabItem icon={<HomeIcon />} label="Home" active={false} />
    <TabItem icon={<InboxIcon />} label="Inbox" active={false} />
    <TabItem icon={<PeopleIcon />} label="People" active={true} activeColor="#111111" />
    <TabItem icon={<DealsIcon />} label="Deals" active={false} />
    <TabItem icon={<ActivityIcon />} label="Activity" active={false} />
  </BottomTabBar>

</MobileShell>
```

### Key data bindings
- `ContactHeroCard` — binds to `crm_people` row: `id`, `display_name`, `email`, `phone`, `stage`, `assigned_broker_name`
- `InitialAvatar` — derives letter from `display_name[0]` (falls back to "L" for Lead)
- `ChannelSelector` — derives from contact's `email` field; channel toggle (Email/SMS) determines which send path fires
- `TemplatePickerSelect` — queries available email templates from the system; value stored in compose state
- `ToField` — auto-populated from contact record; supports multi-recipient chips
- `MergeFieldsSection` — static catalog of available merge tokens grouped by category (CONTACT, PROPERTY, AGENT, DATE, etc.); tapping inserts token at last focused field cursor position
- `FAB` — opens compose sheet or new-action modal; context-aware to current contact

### Spacing notes
- Horizontal screen padding: 16pt on both sides for content cards
- Quick-action pill grid gap: ~10pt between pills, 8pt between rows
- Card internal padding: 16pt
- Sub-tab strip tab internal horizontal padding: ~16pt each side
- Bottom tab bar item width: ~78pt each (390 / 5)
- FAB z-index above all content, floats over bottom tab bar

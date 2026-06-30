<!-- Mobile per-screen appendix. Original: IMG_6030.PNG | id: mob-58 | tiles: mob-tiles/mob-58_{full,t,m,b}.png -->

# mob-58 — inhouse-web — Contact Detail: SMS Compose + Note + Email Engagement

## Identity

- **app_source:** inhouse-web
- **module:** Contact Detail (Lead Profile) — scrolled to the communication/compose band
- **screen:** Contact detail page mid-scroll, showing three embedded sections: (1) TEXT / SMS compose form, (2) ADD A NOTE form, (3) Email engagement empty-state card
- **how to reach:** People tab → tap a contact row → contact detail page → scroll down past header/timeline to the communication tools band
- **iOS status bar:** 4:55 · signal (3 of 4 bars) · WiFi · 100% battery (black pill badge)
- **URL in address bar:** ryan-realty.com (Safari address bar, top of viewport)

---

## Screen regions (top → bottom, y in pt on 390×844 logical screen)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | #FFFFFF |
| Safari address bar | 54–94 | 40 pt | #F2F2F7 (iOS system gray pill) |
| App nav/header bar | 94–148 | 54 pt | #FFFFFF with thin bottom border |
| Scrollable content | 148–754 | 606 pt | #F2F2F7 (page bg) — white cards inside |
| Bottom tab bar (in-house CRM) | 754–810 | 56 pt | #FFFFFF with thin top border |
| Safari chrome row | 810–844 | 34 pt | #F2F2F7 / #FFFFFF |

---

## Nav / header bar (exact)

- **Left control:** Hamburger menu icon (three horizontal lines, ≡) — gray, ~20×16 pt glyph — opens side nav drawer [INFERRED]
- **Center:** Ryan Realty wordmark logo — "Ryan Realty" in Amboqia Boriango display font, navy #102742, with "BEND·OREGON" in small caps/AzoSans beneath it, navy — ~120 pt wide
- **Right controls (L→R):**
  1. Search icon — magnifying glass glyph inside a light-gray rounded square (~32×32 pt, border-radius ~8 pt, bg ~#F5F5F5) — taps to open global search [INFERRED]
  2. "M" avatar — circular or pill badge (~28 pt), navy bg #102742, white letter "M" — Matt's user avatar; taps to open account/profile menu [INFERRED]
- **No back chevron visible** — page is reached via People tab; back navigation available via Safari back arrow in the Safari chrome row

---

## Bottom tab bar (exact)

Five tabs, left to right, all with icon above label:

| Position | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline (home) | Home | none | inactive — gray icon + gray label |
| 2 | Inbox tray outline | Inbox | none | inactive — gray |
| 3 | Two overlapping person silhouettes | People | none | **ACTIVE** — icon filled/bold, label bold black #1C1C1E |
| 4 | Three stacked layers / cards | Deals | none | inactive — gray |
| 5 | Heartbeat / waveform line | Activity | none | inactive — gray |

- Tab bar height: ~56 pt; white background; single 1 pt top border #E5E5EA
- No FAB inside the tab bar; the FAB floats above content (see below)

### Safari chrome row (below tab bar)

Controls L→R: ← back arrow | → forward arrow | ⊕ new-tab (gray circle, + inside) | [3] tab count (rounded rect badge with "3") | ··· more (three dots)
Background: system white/gray, ~34 pt tall

---

## Floating Action Button (FAB)

- **Color:** Medium blue ~#3B7FDE / #4A90E2 (not the in-house navy; looks like a distinct "compose/quick-action" blue)
- **Icon:** White "+" plus sign, ~24 pt
- **Size:** ~56 pt diameter circle
- **Position:** Fixed, bottom-right, approximately x=330, y=700 (floats over the Email engagement card near the bottom-right corner of the scrollable area)
- **Action:** [INFERRED] — opens a quick-compose or quick-add sheet (new text, new note, new email, etc.) for this contact

---

## Content — every element, in order (top to bottom within scrollable area)

### 1. TEXT / SMS Compose Card

**Container:** White card, rounded corners (~12 pt radius), full-width minus ~16 pt horizontal margins, elevated with subtle shadow. Card is partially clipped at top (scroll position mid-page — top of this card already scrolled past).

#### 1a. Section header row
- Label: **"TEXT · 123.456.7890"**
  - "TEXT" — uppercase, gray, ~11 pt, semibold, tracking ~0.08em (section label style)
  - " · " — middot separator
  - "123.456.7890" — underlined (tappable tel: link), same gray, ~11 pt — tapping initiates a phone call or copies the number [INFERRED]
- Full-width, padding ~16 pt horizontal, ~12 pt vertical

#### 1b. Template selector (dropdown)
- **Control type:** Native-styled select / custom dropdown — full-width rounded rectangle (~8 pt radius), border ~1 pt #D1D1D6 (iOS gray), bg #FFFFFF
- **Selected value:** "Blank sms" — left-aligned, ~15 pt regular, #1C1C1E
- **Right control:** Up/down chevron stepper icon (⇅) — gray, right-padded ~12 pt — indicates a picker; tapping opens a list of SMS templates [INFERRED]
- Height: ~44 pt; horizontal padding ~12 pt

#### 1c. Recipient "To" row
- **Label:** "To" — gray, ~13 pt, regular weight; left-aligned
- **Recipient chip/pill:** "Lead annaasmith664@gmail.com"
  - Background: #1C1C1E (near-black / very dark charcoal)
  - Text: white, ~13 pt, medium weight
  - Border-radius: pill (fully rounded ends, ~20 pt radius)
  - Padding: ~6 pt vertical, ~12 pt horizontal
  - Represents the recipient; tapping may edit the recipient [INFERRED]
- Row layout: "To" label on left ~32 pt wide; pill immediately to its right

#### 1d. Message input row
- **Container:** Full-width rounded rectangle, border ~1 pt #D1D1D6, bg #F9F9F9 (very light gray), radius ~10 pt, height ~44 pt
- **Left icon:** "+" plus icon, ~20 pt, dark gray — tapping opens media/attachment picker [INFERRED]
- **Placeholder text:** "Text message · SMS" — gray, ~15 pt, regular weight, italic-ish (placeholder style)
- **Right control:** Gray circular send button, ~36 pt diameter, bg #8E8E93 (iOS gray 2), white arrow-up (↑) glyph inside — button is GRAY (inactive/disabled state because no message text has been entered); turns blue/navy when content is present [INFERRED]
- Horizontal padding: ~8 pt left, ~6 pt right

#### 1e. Quiet-hours checkbox row
- **Checkbox:** Square checkbox, unchecked (~18 pt), border ~1.5 pt #D1D1D6, bg white, rounded corners ~3 pt
- **Label:** "Send anyway (quiet hours)" — gray #8E8E93, ~13 pt, regular
- Row padding: ~8 pt vertical; left-aligned with 16 pt margin

#### 1f. Horizontal rule separator
- Full-width 1 pt divider, #E5E5EA — separates the SMS form from the Add a Note section below

---

### 2. ADD A NOTE Section (within or below the same card)

#### 2a. Section header
- Label: **"ADD A NOTE"** — uppercase, gray #8E8E93, ~11 pt, semibold, tracking ~0.08em — same section-label style as "TEXT"
- Top padding ~16 pt

#### 2b. Note textarea
- **Container:** Full-width rounded rectangle, border ~1 pt #D1D1D6, bg #FFFFFF, radius ~10 pt, height ~80 pt (multiline)
- **Placeholder text:** "Logs to the timeline" — gray #8E8E93, ~15 pt, regular — describes where the saved note will appear
- Tapping focuses the textarea and opens keyboard [INFERRED]

#### 2c. Save note button
- **Text:** "Save note"
- **Style:** Solid black (#1C1C1E) rounded rectangle, ~10 pt radius, white text, ~15 pt medium weight
- **Size:** ~120 pt wide × ~40 pt tall
- **Alignment:** Right-aligned within the card
- **Action:** Saves the note text to the contact's timeline; clears the textarea after success [INFERRED]

---

### 3. Email Engagement Card

**Container:** Separate white card below the SMS/Note card — ~12 pt gap between cards; same border-radius ~12 pt, shadow.

- **Title:** "Email engagement" — black, ~17 pt, bold/semibold, left-aligned; top padding ~16 pt
- **Body:** "No email activity recorded yet." — gray #8E8E93, ~15 pt, regular — empty state message
- **Height:** ~90 pt (compact card with just title + empty state)
- **No CTA inside the card** — the FAB (blue +) floats above its bottom-right corner and likely opens an email compose flow [INFERRED]

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Page background | #F2F2F7 (iOS system grouped background) |
| Card background | #FFFFFF |
| Card border/shadow | ~1 pt #E5E5EA + subtle drop shadow |
| App header background | #FFFFFF |
| Brand logo color | #102742 (navy — Ryan Realty brand) |
| Nav icon (inactive) | #8E8E93 (iOS gray 2) |
| Nav label (inactive) | #8E8E93 |
| Nav icon + label (active — People) | #1C1C1E (near-black, bold) |
| Section label text ("TEXT", "ADD A NOTE") | #8E8E93, 11 pt, uppercase, semibold, tracking 0.08em |
| Recipient pill background | #1C1C1E |
| Recipient pill text | #FFFFFF |
| Phone number link underline | #8E8E93 or system link blue [INFERRED underline decoration] |
| Checkbox border (unchecked) | #D1D1D6 |
| Checkbox label | #8E8E93 |
| Message placeholder | #8E8E93 |
| Send button (inactive) | #8E8E93 circle |
| Send button icon | #FFFFFF ↑ arrow |
| "Save note" button bg | #1C1C1E |
| "Save note" button text | #FFFFFF |
| "Email engagement" title | #1C1C1E, ~17 pt bold |
| Empty state text | #8E8E93 |
| FAB color | ~#4A90E2 (mid blue, distinct from brand navy) |
| FAB icon | #FFFFFF "+" |
| Divider lines | #E5E5EA 1 pt |
| Body font (UI) | Geist / SF Pro (system sans-serif, 15 pt regular for body) |
| Section labels | Geist / SF Pro 11 pt semibold uppercase |
| Brand display font | Amboqia Boriango (logo only) |
| Tab bar top border | #E5E5EA 1 pt |

---

## Interactions & gestures [INFERRED]

- **Tap "123.456.7890"** — initiates tel: call or copies number to clipboard; underline suggests link
- **Tap template selector ("Blank sms")** — opens bottom sheet or picker with list of SMS templates (e.g., "Blank sms", saved drip templates, quick-reply templates)
- **Tap recipient pill ("Lead annaasmith664@gmail.com")** — may open a contact lookup to change recipient, or may be read-only (auto-set from contact context)
- **Tap "+" in message input** — opens attachment picker (image, document) for MMS [INFERRED]
- **Type in message input** — send button transitions from gray (#8E8E93) → blue/navy (active) once text is entered
- **Tap send button (↑)** — sends the SMS to the contact's phone number; shows success/error toast; the "quiet hours" checkbox overrides time-based send restrictions
- **Check "Send anyway (quiet hours)"** — enables sending outside configured quiet hours window
- **Tap note textarea** — focuses input, opens keyboard; "Logs to the timeline" placeholder disappears
- **Tap "Save note"** — POST note to contact timeline API; textarea clears; success feedback [INFERRED]
- **Tap blue FAB (+)** — opens a quick-compose bottom sheet or action sheet with options (e.g., Send email, Send text, Add note, Log call) [INFERRED]
- **Scroll up** — reveals contact header (name, tags, source, assigned broker), timeline feed above these sections
- **Pull-to-refresh** — reloads contact detail + timeline [INFERRED]
- **Tab bar taps** — navigate between Home / Inbox / People / Deals / Activity
- **Safari back (←) in chrome row** — pops back to previous page (likely the People list)

---

## Build notes (component tree)

```
<MobileShell bg="#F2F2F7">

  {/* Safari address bar — rendered by iOS, not web */}
  <SafariAddressBar url="ryan-realty.com" />

  {/* App header — sticky */}
  <TopBar>
    <HamburgerButton onPress={openSideNav} />
    <BrandLogo src="/design_system/assets/brand/logo-blue.png" height={32} />
    <SearchButton iconBg="#F5F5F5" />
    <UserAvatar initial="M" bg="#102742" color="#FFFFFF" size={28} />
  </TopBar>

  {/* Scrollable contact detail body */}
  <ScrollView>

    {/* ... contact header + timeline sections above (scrolled off-screen) ... */}

    {/* ── SMS Compose Card ── */}
    <Card radius={12} bg="#FFFFFF" mx={16} mb={12} px={16} py={16}>

      {/* Section label + phone link */}
      <SectionLabel>TEXT · <PhoneLink href="tel:1234567890">123.456.7890</PhoneLink></SectionLabel>

      {/* Template picker */}
      <TemplatePicker
        value="Blank sms"
        options={smsTemplates}         {/* fetched from /api/crm/sms-templates */}
        onChange={setTemplate}
        borderRadius={8}
        height={44}
      />

      {/* Recipient row */}
      <RecipientRow mt={12}>
        <RecipientLabel>To</RecipientLabel>
        <RecipientPill bg="#1C1C1E" color="#FFFFFF" radius={20} px={12} py={6}>
          Lead annaasmith664@gmail.com
        </RecipientPill>
      </RecipientRow>

      {/* Message input with attachment + send */}
      <MessageInputRow mt={12} bg="#F9F9F9" border="1px solid #D1D1D6" radius={10} height={44}>
        <AttachButton icon="plus" size={20} />
        <TextInput
          placeholder="Text message · SMS"
          value={messageText}
          onChange={setMessageText}
          flex={1}
        />
        <SendButton
          icon="arrow-up"
          bg={messageText.length > 0 ? "#102742" : "#8E8E93"}
          disabled={messageText.length === 0}
          onPress={sendSms}
          size={36}
          radius={18}
        />
      </MessageInputRow>

      {/* Quiet hours override */}
      <CheckboxRow mt={8}>
        <Checkbox checked={sendInQuietHours} onChange={setSendInQuietHours} size={18} />
        <CheckboxLabel color="#8E8E93">Send anyway (quiet hours)</CheckboxLabel>
      </CheckboxRow>

      <Divider color="#E5E5EA" my={16} />

      {/* ── Add a Note sub-section ── */}
      <SectionLabel>ADD A NOTE</SectionLabel>

      <Textarea
        placeholder="Logs to the timeline"
        value={noteText}
        onChange={setNoteText}
        minHeight={80}
        border="1px solid #D1D1D6"
        radius={10}
        mt={8}
        px={12}
        py={10}
        fontSize={15}
      />

      <Row justifyContent="flex-end" mt={12}>
        <Button
          variant="solid"
          bg="#1C1C1E"
          color="#FFFFFF"
          radius={10}
          px={16}
          py={10}
          fontSize={15}
          fontWeight={500}
          onPress={saveNote}
        >
          Save note
        </Button>
      </Row>

    </Card>

    {/* ── Email Engagement Card ── */}
    <Card radius={12} bg="#FFFFFF" mx={16} mb={12} px={16} py={16}>
      <CardTitle fontSize={17} fontWeight={600} color="#1C1C1E">Email engagement</CardTitle>
      <EmptyState color="#8E8E93" fontSize={15} mt={4}>
        No email activity recorded yet.
      </EmptyState>
    </Card>

  </ScrollView>

  {/* Floating Action Button — fixed over content */}
  <Fab
    bg="#4A90E2"
    icon="plus"
    iconColor="#FFFFFF"
    size={56}
    position="fixed"
    bottom={70}        {/* above bottom tab bar */}
    right={16}
    onPress={openQuickComposeSheet}
    zIndex={100}
  />

  {/* Bottom tab bar */}
  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E5EA" height={56}>
    <Tab icon="home-outline"   label="Home"     active={false} />
    <Tab icon="inbox-outline"  label="Inbox"    active={false} />
    <Tab icon="people-filled"  label="People"   active={true}  activeColor="#1C1C1E" />
    <Tab icon="layers-outline" label="Deals"    active={false} />
    <Tab icon="waveform"       label="Activity" active={false} />
  </BottomTabBar>

  {/* Safari chrome — rendered by iOS browser, not web */}
  <SafariChrome back forward newTab tabCount={3} more />

</MobileShell>
```

### Data bindings

| Component | Data source |
|---|---|
| PhoneLink | `contact.phone` (primary phone for this contact) |
| TemplatePicker options | `GET /api/crm/sms-templates` → `{ id, name, body }[]` |
| RecipientPill | `contact.name ?? contact.email` — label "Lead" prefix when name is placeholder/email-only |
| SendButton.onPress | `POST /api/crm/contacts/:id/sms { templateId, body, overrideQuietHours }` |
| saveNote.onPress | `POST /api/crm/contacts/:id/notes { body: noteText }` — appends to `crm_timeline` |
| Email engagement section | `GET /api/crm/contacts/:id/email-engagement` — empty state when `events.length === 0` |
| FAB.onPress | Opens `<QuickComposeSheet>` with options: Send email / Send text / Add note / Log call |

### Spacing constants
- Card horizontal margin: 16 pt each side
- Card internal padding: 16 pt
- Gap between cards: 12 pt
- Section label → first control gap: 8 pt
- Input field height (single line): 44 pt
- Textarea min-height: 80 pt
- FAB bottom offset (above tab bar): 70 pt
- FAB right: 16 pt

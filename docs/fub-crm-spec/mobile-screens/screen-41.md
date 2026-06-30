<!-- Mobile per-screen appendix. Original: IMG_6009.PNG | id: mob-41 | tiles: mob-tiles/mob-41_{full,t,m,b}.png -->

# mob-41 — fub-ios — Email Compose (New Email to Contact)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iPhone app)
- **module:** Compose (email / text / call)
- **screen:** Email compose sheet — new outbound email to a contact
- **how to reach:** From a contact's profile or the Inbox tab → tap the email compose action (pencil/mail icon); a modal or pushed view appears with To pre-filled from the contact
- **iOS status bar:** Time "6:52" (left), signal bars + "5G" + battery "22" with yellow fill (right)
- **URL bar:** None — native app, no Safari chrome

---

## Screen regions (top → bottom, y-bands on 390×844 pt logical screen)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | ~54 pt | Inherits nav bar color (#3d4a56 dark slate) |
| Nav / header bar | 54–100 | ~46 pt | Dark slate-gray ~#3d4a56 |
| To: recipient row | 100–148 | ~48 pt | White #FFFFFF |
| Thin divider | 148–149 | 1 pt | Light gray #E5E5EA |
| Subject: row | 149–197 | ~48 pt | White #FFFFFF |
| Thin divider | 197–198 | 1 pt | Light gray #E5E5EA |
| Body / signature area | 198–~520 | ~322 pt | White #FFFFFF |
| Templates bar | ~488–520 | ~32 pt | White #FFFFFF (bottom of body area) |
| Thin divider | 520–521 | 1 pt | Light gray #E5E5EA |
| Keyboard accessory bar (Wispr Flow) | 521–565 | ~44 pt | Light gray #D1D1D6 |
| iOS system keyboard | 565–844 | ~279 pt | Light gray #D1D1D6 |

---

## Nav / header bar (exact)

- **Background:** Dark slate-gray ~#3d4a56 (FUB's standard dark header)
- **Left control:** Single left-pointing chevron `‹` in white; tap = dismiss/go back to contact profile without sending
- **Center:** Empty — no title text in this compose view (the header is minimal, all context is in the To/Subject fields below)
- **Right control:** Text label **"Send"** in white, regular weight; tap = send the email; disabled/grayed state when fields incomplete [INFERRED]

---

## Bottom tab bar

**Not visible** — the iOS keyboard is raised and occupies the full bottom ~279 pt, completely obscuring the FUB bottom tab bar. Standard FUB tabs (Inbox / Activity / Calendar / People / Deals) are present but hidden.

No FAB visible (also hidden by keyboard).

---

## Content — every element, in order

### 1. To: row (y ≈ 100–148)
- **Label:** "To:" in medium-gray ~#8E8E93, left-aligned, ~15 pt
- **Value:** "Andy Christensen" in black #000000, ~17 pt, regular weight — this is the pre-filled recipient resolved from the contact record
- **Right control:** "CC/BCC" tappable text link in FUB accent teal ~#2D9CDB, ~15 pt — tap expands CC and BCC address fields below the To row [INFERRED]
- **Full-width bottom divider:** 1 pt #E5E5EA

### 2. Subject: row (y ≈ 149–197)
- **Label:** "Subject:" in medium-gray ~#8E8E93, left-aligned, ~15 pt
- **Input value:** Empty — the text field is active (has keyboard focus), shown by a blinking blue cursor `|` immediately after the label, color ~#007AFF
- **No placeholder text visible**
- **Full-width bottom divider:** 1 pt #E5E5EA

### 3. Body / email signature area (y ≈ 198–520)
The body compose area is open and shows the broker's auto-inserted email signature. No user body text has been typed yet.

**Signature layout — two-column card:**
- **Left column:** Headshot photo of Matt Ryan, approximately 120×150 pt cropped rectangle, top-left anchored; real photo (not avatar), showing a middle-aged man in a blue/gray collared shirt, smiling, against a neutral background
- **Right column (text block):**
  - Line 1: **"Matt Ryan"** — bold, ~18 pt, black #000000
  - Line 2: "Owner & Principal Broker · Ryan Realty LLC" — regular, ~13 pt, dark gray ~#333333, wraps to two display lines ("Owner & Principal / Broker · Ryan Realty / LLC")
  - Blank line gap
  - Line 3: "541.703.3095" — regular, ~13 pt, dark gray
  - Line 4: "matt@ryan-realty.com" — regular, ~13 pt, dark gray (likely tappable mailto link)
  - Line 5: "ryan-realty.com" — regular, ~13 pt, dark gray (likely tappable URL)
  - Blank line gap
  - Line 6–7: *"Building community through authentic relationships and..."* — italic, ~12 pt, dark gray, truncated (text is cut off by the Templates bar)

### 4. Templates bar (y ≈ 488–520, bottom of body area)
- **Layout:** Full-width row pinned to the bottom of the compose body area, above the keyboard accessory
- **Content:** Text label **"Templates"** right-aligned in FUB accent teal ~#2D9CDB, ~15 pt — tap opens a template picker sheet to insert a pre-written email template into the body [INFERRED]

### 5. Keyboard accessory bar — Wispr Flow (y ≈ 521–565)
This is a third-party keyboard extension toolbar (Wispr Flow), not a FUB UI element.
- **Background:** Light gray #D1D1D6
- **Left:** Hamburger icon (three horizontal lines, ≡) in dark gray — tap opens Wispr Flow menu
- **Right:** Black pill button labeled **"Start"** with a bar-chart / audio-waveform icon (vertical bars of varying height) — tap starts Wispr Flow voice dictation

### 6. iOS system keyboard (y ≈ 565–844)
Standard QWERTY keyboard, "Wispr Flow" custom keyboard active.
- **Background:** Light gray #D1D1D6
- **Key caps:** White rounded-rect keys, black letter glyphs
- **Row 1:** Q W E R T Y U I O P
- **Row 2:** A S D F G H J K L
- **Row 3:** Shift (↑ solid black arrow on white key) · Z X C V B N M · Backspace (⌫)
- **Bottom row:** "123" (numbers/symbols toggle) · "Wispr Flow" (space bar — custom label) · Return (↩)
- **Globe icon (⊕):** Bottom-left below keyboard, gray — tap switches input method

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | ~#3d4a56 (FUB dark slate) |
| Header text / icons | #FFFFFF |
| FUB accent (CC/BCC, Templates) | ~#2D9CDB (teal-blue) |
| Body background | #FFFFFF |
| "To:" / "Subject:" labels | ~#8E8E93 (system gray) |
| Recipient name text | #000000 |
| Subject cursor | ~#007AFF (iOS blue) |
| Signature name | #000000 bold |
| Signature body text | ~#333333 regular / ~#555555 italic |
| Row dividers | #E5E5EA (1 pt) |
| Keyboard accessory bg | #D1D1D6 |
| Wispr Flow "Start" pill | #000000 bg, #FFFFFF text |
| Keyboard bg | #D1D1D6 |
| Keyboard keys | #FFFFFF |
| Font — FUB UI | San Francisco (iOS system), ~15–17 pt body |
| Font — signature name | SF Pro / system bold ~18 pt |

---

## Interactions & gestures

- **Tap "‹" (back):** Dismiss compose; likely prompts "Discard draft?" confirmation sheet [INFERRED]
- **Tap "Send":** Validates To + Subject not empty → sends email via FUB email integration → dismisses view + creates activity record on contact [INFERRED]
- **Tap "Andy Christensen" in To: field:** Opens contact/person picker to change or add recipients [INFERRED]
- **Tap "CC/BCC":** Expands two additional address rows (CC and BCC) below the To row, each with an address-picker field [INFERRED]
- **Tap Subject: field:** Keyboard focus moves to subject; cursor appears; user types subject line
- **Tap body area:** Keyboard focus moves to body above the signature; cursor appears for typing
- **Tap "Templates":** Presents a modal bottom sheet listing saved FUB email templates; selecting one inserts the template text into the body above the signature [INFERRED]
- **Tap headshot in signature:** No action (static image in compose) [INFERRED]
- **Tap phone / email / URL in signature:** May trigger tel:, mailto:, or open browser [INFERRED]
- **Tap "Wispr Flow" space bar:** Inserts a space character
- **Tap "Start" (Wispr Flow pill):** Activates voice-to-text dictation via the Wispr Flow engine
- **Swipe down on compose:** May dismiss with "Save draft / Discard" options [INFERRED]
- **Pull to refresh:** Not applicable in compose mode

---

## Build notes (component tree)

```
<MobileShell>

  <StatusBar style="light" />   {/* white text on dark header bg */}

  <ComposeEmailTopBar>
    <BackButton icon="chevron-left" color="#FFFFFF" onTap="dismissOrConfirmDiscard" />
    {/* no center title */}
    <SendButton label="Send" color="#FFFFFF" disabled={!canSend} onTap="sendEmail" />
    {/* bg: #3d4a56, height: ~46pt */}
  </ComposeEmailTopBar>

  <ScrollView flex keyboardDismissMode="interactive">

    <RecipientRow>
      {/* height ~48pt, bg white, bottom divider #E5E5EA */}
      <FieldLabel text="To:" color="#8E8E93" />
      <RecipientChip
        name="Andy Christensen"
        personId={contact.id}
        onTap="openPersonPicker"
      />
      <CCBCCToggle label="CC/BCC" color="#2D9CDB" onTap="expandCCBCC" />
    </RecipientRow>

    {/* Conditional: CCRow + BCCRow, hidden until CCBCCToggle tapped */}
    <CCRow hidden>
      <FieldLabel text="Cc:" color="#8E8E93" />
      <RecipientInput placeholder="" />
    </CCRow>
    <BCCRow hidden>
      <FieldLabel text="Bcc:" color="#8E8E93" />
      <RecipientInput placeholder="" />
    </BCCRow>

    <SubjectRow>
      {/* height ~48pt, bg white, bottom divider #E5E5EA */}
      <FieldLabel text="Subject:" color="#8E8E93" />
      <TextInput
        value={subject}
        placeholder=""
        autoFocus={false}
        returnKeyType="next"
        onChangeText={setSubject}
      />
    </SubjectRow>

    <BodyArea flex minHeight={200}>
      {/* bg white, padding 12pt */}
      <TextInput
        multiline
        value={body}
        placeholder=""
        onChangeText={setBody}
        style={{ flex: 1 }}
      />

      <EmailSignatureBlock>
        {/* two-column layout, horizontal padding 12pt */}
        <BrokerHeadshot
          src={broker.headshotUrl}   {/* resolves to matt's headshot */}
          width={120} height={150}
          style={{ borderRadius: 4 }}
        />
        <SignatureText>
          <BrokerName>{broker.fullName}</BrokerName>            {/* "Matt Ryan", bold ~18pt */}
          <BrokerTitle>{broker.title}</BrokerTitle>             {/* "Owner & Principal Broker · Ryan Realty LLC" */}
          <Phone>{broker.phone}</Phone>                         {/* "541.703.3095" */}
          <Email>{broker.email}</Email>                         {/* "matt@ryan-realty.com" */}
          <Website>{broker.website}</Website>                   {/* "ryan-realty.com" */}
          <Tagline>{broker.tagline}</Tagline>                   {/* italic: "Building community through authentic relationships and..." */}
        </SignatureText>
      </EmailSignatureBlock>

      <TemplatesBar>
        {/* right-aligned, bottom of body area, above keyboard */}
        <TemplatesLink label="Templates" color="#2D9CDB" onTap="openTemplatesPicker" />
      </TemplatesBar>
    </BodyArea>

  </ScrollView>

  {/* Bottom tab bar hidden by keyboard when active */}
  <BottomTabBar tabs={["Inbox","Activity","Calendar","People","Deals"]} hidden={keyboardVisible} />

</MobileShell>

{/* Sheet — presented when "Templates" tapped */}
<TemplatesPickerSheet>
  <SheetHandle />
  <SearchInput placeholder="Search templates..." />
  <TemplateList>
    <TemplateRow name={t.name} preview={t.preview} onTap="insertTemplate(t)" />
  </TemplateList>
</TemplatesPickerSheet>
```

### Data bindings
| Component | Data source |
|---|---|
| `RecipientChip` | FUB contact: `person.name`, `person.id` |
| `EmailSignatureBlock` | Logged-in FUB user profile: `user.name`, `user.title`, `user.phone`, `user.email`, `user.website`, `user.tagline`, `user.avatarUrl` |
| `TemplatesList` | FUB `/v1/emailTemplates` endpoint — list of saved templates |
| `SendButton` | Fires `POST /v1/emails` with `{ to: recipients, subject, body, personId }` |

### Spacing / sizing notes
- Header bar: height ~46 pt, left/right padding ~16 pt
- Row dividers: 1 pt, full bleed, color #E5E5EA
- To/Subject rows: 48 pt tall, 16 pt left indent for labels
- Signature block: horizontal padding 12 pt, headshot 120×150 pt, gap between columns ~10 pt
- Templates bar: right-aligned, ~32 pt tall, right padding 16 pt
- "Send" button: no background, plain text — becomes tappable pill or remains plain text label [INFERRED tappable region ~44×44 pt]

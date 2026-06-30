# Mobile — Compose: Email, Text, Call & AI

This section specifies every compose surface accessible from the mobile CRM: the FUB iOS email compose sheet, the SMS Select Recipients modal, the AI-powered conversation thread with chip strip and draft panel, the SMS attachment-picker bottom sheet, the in-house web "Send a message" card with merge-field chips, the inline SMS compose + Note + Email engagement cards, and the click-to-call / Log Call flow. Every send path — regardless of channel — routes through a non-negotiable compliance suppression gate that checks opt-out status, do-not-text / hard-stop tags, quiet-hours window, and A2P 10DLC registration status before transmitting. The section cross-references desktop spec §07c (compose bar, modals, right rail) and §17 (communications + compliance layer); mobile surfaces inherit the same data model and business rules with a touch-first layout adapted for 390 pt viewport width.

All y-bands target a 390×844 pt logical canvas (iPhone 14 equivalent). Ryan Realty design-system tokens (`navy #102742`, `cream #faf8f4`, Geist + Amboqia, `@/components/ui/*` shadcn) replace FUB's teal/slate chrome. FUB hex values are documented where observed for reference, followed by the Ryan Realty token to use in the in-house build.

---

## Screen Index

| ID | Screen / State | Source | mob-NN |
|---|---|---|---|
| S1 | FUB iOS — Email Compose | **[OBSERVED]** | mob-41 |
| S2 | FUB iOS — SMS Select Recipients modal | **[OBSERVED]** | mob-43 |
| S3 | FUB iOS — AI Conversation Thread + Chip Strip | **[OBSERVED]** | mob-40 |
| S4 | FUB iOS — SMS Attachment Picker Sheet | **[OBSERVED]** | mob-39 |
| S5 | In-house Web — Email Compose Card (Comms tab) | **[OBSERVED]** | mob-48 |
| S6 | In-house Web — Email Compose + Merge Fields open | **[OBSERVED]** | mob-57 |
| S7 | In-house Web — SMS Compose + Note + Email Engagement | **[OBSERVED]** | mob-58 |
| S8 | Click-to-Call flow + Live Call screen (mobile web) | **[INFERRED]** | BASIS: §17.4, calling.md §5, mob-39 nav bar phone icon |
| S9 | Log Call form (mobile web) | **[INFERRED]** | BASIS: §07c.5, §17.4.2, calling.md |
| S10 | Compliance Suppression Gate (all channels) | **[INFERRED]** | BASIS: §17.6, texting.md §2, §17.3.6 |

---

## S1 — FUB iOS Email Compose **[OBSERVED — mob-41]**

### Purpose
New outbound 1:1 email composed from a contact's profile or Inbox. To field pre-filled with contact. Signature auto-inserted from broker's profile.

### Screen regions (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Inherits nav bar `#3d4a56` |
| Nav / header bar | 54–100 | 46 pt | Dark slate-gray `#3d4a56` |
| To: recipient row | 100–148 | 48 pt | `#FFFFFF` |
| Divider | 148–149 | 1 pt | `#E5E5EA` |
| Subject: row | 149–197 | 48 pt | `#FFFFFF` |
| Divider | 197–198 | 1 pt | `#E5E5EA` |
| Body / signature area | 198–520 | 322 pt | `#FFFFFF` |
| Templates bar | 488–520 | 32 pt | `#FFFFFF` (bottom of body, pinned) |
| Divider | 520–521 | 1 pt | `#E5E5EA` |
| Keyboard accessory bar | 521–565 | 44 pt | `#D1D1D6` |
| iOS keyboard (hidden when not focused) | 565–844 | 279 pt | `#D1D1D6` |

### Nav / header bar (exact)

- **Background:** `#3d4a56` (FUB dark slate; RR token: `bg-primary` `#102742`)
- **Left:** Chevron `‹` white `#FFFFFF` ~22 pt → dismiss; prompt "Discard draft?" confirmation [INFERRED] if body is non-empty
- **Center:** Empty — no title text
- **Right:** Text label **"Send"** white `#FFFFFF` regular ~15 pt; disabled/muted when To or Subject empty; tap → send via email integration → create `crm_timeline` record (type `email`, direction `outbound`)

### Content elements

#### 1. To: row (y 100–148)
- **"To:"** label — `#8E8E93` (FUB gray; RR: `text-muted-foreground`), left-aligned, ~15 pt, Geist 400
- **Recipient chip value:** "Andy Christensen" — `#000000`, ~17 pt, Geist 400; resolves from `crm_people.display_name`
- **"CC/BCC" link** — right-aligned; FUB accent teal `#2D9CDB` (RR: `text-primary`), ~15 pt; tap → expand CC + BCC rows below [INFERRED]
- **Bottom divider:** 1 pt `#E5E5EA`

#### 2. Subject: row (y 149–197)
- **"Subject:"** label — `#8E8E93`, ~15 pt, Geist 400
- **Input field:** empty `<TextInput>`, placeholder none, active cursor `#007AFF` iOS blue; receives keyboard focus when tapped
- **Bottom divider:** 1 pt `#E5E5EA`

#### 3. CC row (hidden by default)
- Revealed by tapping "CC/BCC"; label "Cc:" in `#8E8E93`; email address chip input

#### 4. BCC row (hidden by default)
- Revealed after "CC/BCC" tap; label "Bcc:" in `#8E8E93`; email address chip input

#### 5. Body area + signature (y 198–488)
Email body compose area. Pre-populated with broker signature block (loaded async after compose opens):

**Signature layout — two-column card, left-float headshot:**

| Element | Value | Style |
|---|---|---|
| Headshot photo | Matt Ryan photo — real photo, blue/gray shirt, neutral bg | ~120×150 pt cropped rect, top-left anchored |
| Broker name | "Matt Ryan" | bold ~18 pt `#000000` |
| Title line | "Owner & Principal Broker · Ryan Realty LLC" | regular ~13 pt `#333333`, wraps |
| Phone | "541.703.3095" | regular ~13 pt `#333333` (tel: link) |
| Email | "matt@ryan-realty.com" | regular ~13 pt `#333333` (mailto: link) |
| Website | "ryan-realty.com" | regular ~13 pt `#333333` (URL link) |
| Tagline | "Building community through authentic relationships and..." | italic ~12 pt `#555555`, truncated by Templates bar |

Signature is stored in `broker_email_connections.signature_html`. Rendered via `dangerouslySetInnerHTML` in sandboxed div (inline styles only — no `<style>` blocks, no `<iframe>` per §17.2.6).

**Async load behavior:** On compose open, show spinner/skeleton in body zone → fetch `signature_html` from broker settings → inject below cursor. Template chips / Templates bar appear after signature loads.

#### 6. Templates bar (y 488–520, pinned bottom of body area)
- **"Templates"** — right-aligned teal text `#2D9CDB` (RR: `text-primary`), ~15 pt; right padding 16 pt
- Tap → present `TemplatesPickerSheet` (search + list of saved email templates)
- Selecting a template inserts subject + body content into compose fields (confirm-replace if body already contains text)

### Component tree

```tsx
<MobileShell>
  <StatusBar style="light" bg="#102742" />

  <ComposeEmailTopBar bg="#102742" height={46} px={16}>
    <BackButton icon="chevron-left" color="#FFFFFF" size={22}
      onPress={handleDismiss}  // confirm discard if body non-empty
    />
    {/* no center title */}
    <SendButton
      label="Send"
      color="#FFFFFF"
      fontSize={15}
      disabled={!canSend}  // canSend = to.length > 0 && subject.trim().length > 0
      onPress={sendEmail}
    />
  </ComposeEmailTopBar>

  <KeyboardAvoidingView behavior="padding" flex={1}>
    <ScrollView keyboardDismissMode="interactive" bg="#FFFFFF">

      {/* To row */}
      <RecipientRow height={48} px={16} borderBottom="1px solid #E5E5EA">
        <FieldLabel text="To:" color="#8E8E93" fontSize={15} />
        <RecipientChip
          name={contact.display_name}
          personId={contact.id}
          onPress={openPersonPicker}
        />
        <TextButton label="CC/BCC" color="#102742" fontSize={15}
          onPress={toggleCCBCC} />
      </RecipientRow>

      {/* CC / BCC rows — conditionally rendered */}
      {showCCBCC && (
        <>
          <CCRow height={48} px={16} borderBottom="1px solid #E5E5EA">
            <FieldLabel text="Cc:" color="#8E8E93" fontSize={15} />
            <RecipientChipInput value={cc} onChange={setCc} />
          </CCRow>
          <BCCRow height={48} px={16} borderBottom="1px solid #E5E5EA">
            <FieldLabel text="Bcc:" color="#8E8E93" fontSize={15} />
            <RecipientChipInput value={bcc} onChange={setBcc} />
          </BCCRow>
        </>
      )}

      {/* Subject row */}
      <SubjectRow height={48} px={16} borderBottom="1px solid #E5E5EA">
        <FieldLabel text="Subject:" color="#8E8E93" fontSize={15} />
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder=""
          returnKeyType="next"
          onSubmitEditing={() => bodyRef.current?.focus()}
          flex={1}
          fontSize={17}
          color="#000000"
        />
      </SubjectRow>

      {/* Body + signature */}
      <BodyArea flex={1} minHeight={200} px={12} pt={12}>
        <TextInput
          ref={bodyRef}
          multiline
          value={body}
          onChangeText={setBody}
          placeholder=""
          fontSize={15}
          color="#1C1C1E"
          style={{ flex: 1 }}
        />

        {signatureLoaded ? (
          <EmailSignatureBlock>
            {/* Two-column layout */}
            <BrokerHeadshot
              src={broker.headshotUrl}
              width={120} height={150}
              style={{ borderRadius: 4 }}
            />
            <SignatureText gap={4}>
              <BrokerName fontSize={18} fontWeight="700" color="#000000">
                {broker.fullName}
              </BrokerName>
              <BrokerTitle fontSize={13} color="#333333">
                {broker.title} · {broker.brokerage}
              </BrokerTitle>
              <PhoneLink href={`tel:${broker.phone}`} fontSize={13} color="#333333">
                {broker.phone}
              </PhoneLink>
              <EmailLink href={`mailto:${broker.email}`} fontSize={13} color="#333333">
                {broker.email}
              </EmailLink>
              <WebLink href={`https://${broker.website}`} fontSize={13} color="#333333">
                {broker.website}
              </WebLink>
              <Tagline fontSize={12} fontStyle="italic" color="#555555">
                {broker.tagline}
              </Tagline>
            </SignatureText>
          </EmailSignatureBlock>
        ) : (
          <SignatureSkeleton height={150} />
        )}
      </BodyArea>

      {/* Templates bar — pinned inside scroll above keyboard */}
      <TemplatesBar px={16} height={32} justifyContent="flex-end" alignItems="center"
        borderTop="1px solid #E5E5EA">
        <TextButton label="Templates" color="#102742" fontSize={15}
          onPress={openTemplatesPicker} />
      </TemplatesBar>

    </ScrollView>
  </KeyboardAvoidingView>

  {/* Floating action sheet — templates picker */}
  {templatesOpen && (
    <BottomSheet onDismiss={closeTemplatesPicker} snapPoints={['70%']}>
      <SearchInput placeholder="Search templates..." />
      <TemplateList>
        {templates.map(t => (
          <TemplateRow key={t.id}
            name={t.name}
            preview={t.subject ?? t.body_preview}
            onPress={() => insertTemplate(t)}
          />
        ))}
      </TemplateList>
    </BottomSheet>
  )}

</MobileShell>
```

### Data bindings

| Component | Source |
|---|---|
| `RecipientChip.name` | `crm_people.display_name` |
| `RecipientChip.personId` | `crm_people.id` |
| `EmailSignatureBlock` | `brokers.signature_html` (async fetch) — `brokers.headshot_url`, `brokers.full_name`, `brokers.title`, `brokers.phone`, `brokers.email`, `brokers.website`, `brokers.tagline` |
| `TemplateList` | `GET /api/crm/email-templates` → `{ id, name, subject, body }[]` (shared + own) |
| `sendEmail()` | Fires suppression check (S10) → `POST /api/crm/contacts/:id/email { to, cc, bcc, subject, body }` → sends via `broker_email_connections` OAuth → writes `crm_timeline` row |

### Sizing constants
- Header bar: height 46 pt, px 16 pt
- Row dividers: 1 pt full-bleed `#E5E5EA`
- To / Subject rows: 48 pt tall, label left at 16 pt
- Signature block: px 12 pt, headshot 120×150 pt, column gap 10 pt
- Templates bar: 32 pt tall, right-aligned text, px 16 pt
- "Send" tap target: ~44×44 pt

### Interactions

| Target | Action | Result |
|---|---|---|
| `‹` back | Tap | Prompt "Discard draft?" if body non-empty; dismiss on confirm |
| "Send" | Tap | Suppression check → send → dismiss + timeline entry |
| To: chip | Tap | Open person picker to change/add recipient |
| "CC/BCC" | Tap | Expand CC + BCC input rows |
| Subject field | Tap | Keyboard focus to subject |
| Body area | Tap | Keyboard focus above signature |
| "Templates" | Tap | Present templates picker sheet |
| Signature phone/email/URL | Tap | Open tel: / mailto: / browser |
| Swipe down | Pull | Dismiss with discard confirmation |

### Acceptance criteria

1. To field pre-populated with current contact's `display_name` chip.
2. "Send" disabled until both To and Subject are non-empty.
3. Tapping Send fires S10 suppression check first; blocked if `email_opt_out = true`.
4. Signature zone shows skeleton while loading; broker headshot + name + title + phone + email + website + italic tagline render after async fetch.
5. Signature HTML rendered inline-styles only (no `<style>` blocks, no `<iframe>` injected).
6. CC/BCC rows hidden by default; expand on "CC/BCC" tap.
7. "Templates" tap presents searchable bottom sheet of shared + own templates.
8. Selecting a template inserts subject + body; shows confirm-replace if body already has content.
9. Dismissing with content shows "Discard draft?" sheet; "Keep Draft" saves to `crm_scheduled_sends` or local draft state [INFERRED].
10. All timeline writes go to `crm_timeline` (type `email`, direction `outbound`).

---

## S2 — FUB iOS SMS Compose / Select Recipients **[OBSERVED — mob-43]**

### Purpose
Modal sheet for choosing SMS recipients before composing. Presents the selected contact as a token pill, a horizontally scrollable AI template chip row, and the SMS input bar. Slides up over the previous screen.

### Screen regions (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | `#3d5060` |
| Modal header bar | 54–98 | 44 pt | `#3d5060` dark teal-slate |
| To: recipient token row | 98–142 | 44 pt | `#FFFFFF` |
| Hairline divider | 142–143 | 1 pt | `#E5E7EB` |
| Contact search / suggestion area | 143–530 | 387 pt | `#FFFFFF` |
| AI template pill row | 530–580 | 50 pt | `#FFFFFF` + top separator |
| SMS compose input bar | 580–632 | 52 pt | `#FFFFFF` |
| iOS keyboard | 632–844 | 212 pt | `#D1D1D6` |

> Note: Bottom tab bar not visible — keyboard + modal covers it.

### Modal header bar (exact)

- **Background:** `#3d5060` (FUB dark teal-slate; RR token: `bg-primary` `#102742`)
- **Left:** "Cancel" — white `#FFFFFF`, Geist 400 ~17 pt; tap → dismiss modal, no recipient saved
- **Center:** "**Select Recipients**" — white `#FFFFFF`, Geist 600 ~17 pt
- **Right:** "Done" — white `#FFFFFF`, Geist 400 ~17 pt; tap → confirm recipients, advance to SMS body compose

### Content elements

#### 1. To: recipient token row (y 98–142)
- **"To:"** label — `#6b7280` (RR: `text-muted-foreground`), ~15 pt, Geist 500
- **Recipient token pill — "Andy Christensen":**
  - Shape: fully-rounded pill (border-radius ~16 pt)
  - Border: 1.5 pt solid `#8fa3b8` (muted blue-gray; RR: `border-border`)
  - Background: transparent / white
  - Text: "Andy Christensen" — `#5b7a94` (muted teal-blue; RR: `text-primary`), ~15 pt, Geist 500
  - Height: ~32 pt; horizontal padding ~12 pt
  - Tap → deselect / remove this recipient token

#### 2. Contact search / suggestion area (y 143–530)
- Background: `#FFFFFF`, completely blank in this state (contact already selected)
- Live search field activates when user taps this area [INFERRED]
- Populates with contact matches from `crm_people` search as user types [INFERRED]
- Selecting a result adds another recipient token to the To: row [INFERRED]

#### 3. AI template pill row (y 530–580)
Horizontally scrollable row. Top separator `#E5E7EB`. Left padding 12 pt. Pill gap 10 pt.

| # | Icon glyph | Label | State | Style |
|---|---|---|---|---|
| 1 | ✦ sparkle | "Introduction" | Outlined | 1 pt border `#1a1a2e`, white bg, black text `#000000` |
| 2 | ✦ sparkle | "Follow Up" | Outlined | Same |
| 3 | + plus | "Custom" | Outlined | Same |
| 4 | (clipped — partially visible) | Unknown | — | — |

**Pill anatomy:**
- Shape: fully-rounded stadium, height ~36 pt, px ~16 pt
- Border: ~1 pt solid `#1a1a2e` (near-black; RR: `border` with `text-foreground`)
- Background: `#FFFFFF`
- Icon: 4-pointed sparkle ✦ (AI indicator) for AI templates; `+` for Custom; ~14 pt, `#000000`
- Text: `#000000`, ~14 pt, Geist 500
- Tap behavior: "Introduction" → pre-fills SMS input with AI-generated introduction text [INFERRED]; "Follow Up" → follow-up text; "+ Custom" → opens custom template picker or blank compose [INFERRED]
- Row scrollable horizontally (`overflow-x: auto`); snap to pill boundaries

#### 4. SMS compose input bar (y 580–632)
Three elements in a horizontal row, height ~52 pt, horizontal padding 8 pt, vertical padding 8 pt:

**a. Attachment "+" button (left)**
- Circle ~36 pt diameter
- Background: `#E5E7EB` (RR: `bg-muted`)
- Icon: `+` plus, color `#6b7280` (RR: `text-muted-foreground`)
- Tap → open attachment picker (S4 equivalent on mobile web — bottom sheet with Photo Library, Camera, Send vCard, Use template) [INFERRED]

**b. SMS text input (center, flex-grow)**
- Rounded pill input, height ~44 pt, border-radius 22 pt
- Background: `#FFFFFF`, border 1 pt `#D1D5DB` (RR: `border-input`)
- Placeholder: "Text message • SMS" — `#9ca3af` (RR: `text-muted-foreground`), ~15 pt, Geist 400
- Multiline; `returnKeyType="send"`

**c. Send button (right)**
- Circle ~36 pt diameter
- Background: `#3b9ed4` (FUB blue; RR: `bg-primary` `#102742`)
- Icon: upward arrow ↑, white `#FFFFFF`, ~18 pt
- Active even with empty input when recipient is selected [OBSERVED]
- Tap → compliance check → send SMS via Twilio → write `crm_timeline` event [INFERRED]

### Component tree

```tsx
<SMSComposeModal
  visible={open}
  onDismiss={handleCancel}
  animationType="slide"
  presentationStyle="pageSheet"
>
  <StatusBar style="light" bg="#102742" />

  <ModalHeader bg="#102742" height={44} px={16}>
    <TextButton label="Cancel" color="#FFFFFF" fontSize={17}
      onPress={handleCancel} />
    <Text style={{ color:'#FFF', fontWeight:'600', fontSize:17 }}>
      Select Recipients
    </Text>
    <TextButton label="Done" color="#FFFFFF" fontSize={17}
      onPress={confirmRecipients} />
  </ModalHeader>

  {/* Recipient token row */}
  <RecipientRow height={44} px={16} borderBottom="1px solid #E5E7EB">
    <Label text="To:" color="#6b7280" fontSize={15} fontWeight="500" />
    <RecipientTokenList flexWrap gap={6}>
      {selectedContacts.map(c => (
        <RecipientToken
          key={c.id}
          name={c.display_name}
          textColor="#5b7a94"
          borderColor="#8fa3b8"
          borderWidth={1.5}
          borderRadius={16}
          bg="transparent"
          px={12} height={32}
          onPress={() => removeRecipient(c.id)}
        />
      ))}
      {/* Live search input follows tokens */}
      <TokenSearchInput
        placeholder=""
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoFocus={selectedContacts.length === 0}
      />
    </RecipientTokenList>
  </RecipientRow>

  {/* Contact search results */}
  <ContactSearchArea flex={1} bg="#FFFFFF">
    {searchResults.map(r => (
      <ContactSearchRow key={r.id}
        name={r.display_name}
        phone={r.primary_phone}
        onPress={() => addRecipient(r)}
      />
    ))}
  </ContactSearchArea>

  {/* AI template pill row */}
  <TemplatePillRow
    horizontal scrollable
    borderTop="1px solid #E5E7EB"
    bg="#FFFFFF"
    py={8} px={12} gap={10} height={50}
  >
    <TemplatePill icon="sparkle" label="Introduction"
      onPress={() => insertAITemplate('introduction')} />
    <TemplatePill icon="sparkle" label="Follow Up"
      onPress={() => insertAITemplate('follow_up')} />
    <TemplatePill icon="plus" label="Custom"
      onPress={openCustomTemplatePicker} />
    {/* additional AI templates scrolled off-screen */}
  </TemplatePillRow>

  {/* SMS compose bar */}
  <SMSInputBar px={8} py={8} flexDirection="row" alignItems="center" gap={8} bg="#FFFFFF">
    <AttachButton
      icon="plus" bg="#E5E7EB" iconColor="#6b7280"
      size={36} shape="circle"
      onPress={openAttachmentPicker}
    />
    <TextInput
      placeholder="Text message • SMS"
      placeholderTextColor="#9ca3af"
      value={messageBody}
      onChangeText={setMessageBody}
      flex={1} height={44} borderRadius={22}
      borderColor="#D1D5DB" borderWidth={1}
      px={16} fontSize={15} bg="#FFFFFF"
      multiline returnKeyType="send"
    />
    <SendButton
      icon="arrow-up" bg="#102742" iconColor="#FFFFFF"
      size={36} shape="circle"
      disabled={selectedContacts.length === 0}
      onPress={handleSendSMS}
    />
  </SMSInputBar>

</SMSComposeModal>
```

### Data bindings

| Component | Source |
|---|---|
| `RecipientToken.name` | `crm_people.display_name` |
| `ContactSearchArea` | `GET /api/crm/people/search?q=${query}` |
| `TemplatePill` actions | FUB AI template API or in-house `/api/crm/ai-drafts?type=introduction&personId=N` |
| `sendSMS()` | Compliance check (S10) → Twilio API → `POST /api/crm/contacts/:id/sms` → `crm_timeline` write |
| `messageBody` | Local compose state `string` |

### Acceptance criteria

1. Modal slides up from bottom with iOS sheet animation.
2. Contact chip pre-populated from current contact context.
3. "Done" disabled when no recipients selected.
4. "Cancel" dismisses without side effects.
5. Contact search filters `crm_people` as user types; results render in suggestion area.
6. Selecting a result adds a second chip to the To: row (group SMS, max 10 total).
7. AI template pills render in scrollable horizontal row; "Introduction" and "Follow Up" have ✦ sparkle icon; "Custom" has + icon.
8. Tapping an AI pill pre-fills the SMS input with an AI-generated draft (editable before send).
9. Send button fires S10 compliance check; blocked if `text_opt_out = true` or `hard_stop` tag present.
10. Character counter visible below input; warning at >320 chars.

---

## S3 — FUB iOS AI Conversation Thread + AI Chip Strip **[OBSERVED — mob-40]**

### Purpose
Open conversation thread with a contact, AI compose panel expanded at bottom. AI has generated a draft ("Follow Up" chip selected, purple gradient). Broker reviews/edits draft before sending.

### Screen regions (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | `#3D4F5C` |
| Conversation nav bar | 54–110 | 56 pt | `#3D4F5C` |
| Conversation body (scrollable message bubbles) | 110–680 | 570 pt | `#FFFFFF` (empty in this state) |
| AI suggestion chip strip | 680–730 | 50 pt | `#FFFFFF` + top border |
| Message compose area (AI draft) | 730–844 | 114 pt | `#FFFFFF` |

### Conversation nav bar (exact, y 54–110)

- **Background:** `#3D4F5C` (FUB slate-teal; RR: `bg-primary` `#102742`)
- **Left:** Back chevron `<` white `#FFFFFF` ~22 pt → pop back to inbox conversation list
- **Center-left (tappable → contact detail):**
  - Orange circle avatar `#C05A1F` (burnt orange; RR: auto-assigned by hash of `person.id`), 36 pt diameter, white initials "AC" ~14 pt bold
  - Contact name "Andy Christensen" — white `#FFFFFF`, ~17 pt Geist 600
  - Right chevron `>` — white `#FFFFFF` ~12 pt; entire name+avatar row taps to navigate to contact detail
- **Right controls (flush right, 8 pt gap):**
  - Phone handset icon — white `#FFFFFF`, ~22 pt; tap → initiate call to Andy (click-to-call, S8)
  - Horizontal ellipsis `···` — white `#FFFFFF`, ~22 pt; tap → action sheet (archive, assign, mark unread, mute)

### Conversation body (y 110–680)

- Background: `#FFFFFF` pure white
- Empty in this capture — either first outreach or all prior messages scrolled above viewport
- Renders `<MessageBubble>` components (inbound right-aligned, outbound left-aligned) when messages exist
- No empty-state illustration — just white space when no messages
- Pull-to-refresh loads older messages [INFERRED]

### AI suggestion chip strip (y 680–730)

Horizontally scrollable row of action chips. Top border hairline `#E0E0E0`. Background `#FFFFFF`. Left padding 12 pt. Chip gap 10 pt.

**Chips observed (left to right):**

| # | Label | State | Fill | Border | Text |
|---|---|---|---|---|---|
| 1 | ✦ **Follow Up** | **SELECTED / ACTIVE** | Gradient `linear-gradient(135deg, #A855F7, #7C3AED)` (violet/purple) | `#6D28D9` dark purple ~1.5 pt | `#FFFFFF` white |
| 2 | **+ Custom** | Unselected | `#FFFFFF` | `#D1D5DB` light gray | `#111827` near-black |
| 3 | ✦ **Still Buying** | Unselected | `#FFFFFF` | `#D1D5DB` | `#111827` |
| 4+ | (scrolled off-screen, partially clipped at right) | — | — | — | — |

**RR design-system mapping:**
- Selected chip: `bg-primary` with `text-primary-foreground` (use navy `#102742` fill + white text, NOT the purple gradient — the purple is FUB-specific branding)
- Unselected chip: `bg-background` with `border-border` outline and `text-foreground`

**Chip anatomy:**
- Shape: fully-rounded pill, height ~38 pt, px 16 pt
- Icon: 4-pointed sparkle ✦ glyph (14 pt) left of text for AI chips; `+` for Custom
- Text: ~15 pt Geist 600
- Tap: selects chip → AI draft in compose area regenerates for that template type [INFERRED]
- Row: `overflow-x: auto; scroll-snap-type: x mandatory`

### Message compose area / AI draft (y 730–844)

Contains three elements in a horizontal flex row, padding 12 pt horizontal, 10 pt vertical:

**a. Attachment "+" button (left)**
- Circle ~36 pt, background `#E5E7EB`, `+` icon `#6B7280`
- Tap → opens attachment/media picker [INFERRED]

**b. Draft text area (center, flex-grow)**
- Rounded rectangle, border 1 pt `#E5E7EB`, bg `#FFFFFF`, radius ~12 pt
- Font: ~15 pt Geist 400, color `#1C1C1E`
- **Verbatim AI-generated content (as observed):**
  > "Hi Andy, just following up on your general inquiry from earlier this month. If you have any specific properties or areas in mind, I'd be happy to help you explore options that fit your needs. Let me know if you want to set up a time to chat!"
- The draft IS editable — tap to place cursor and modify before sending [INFERRED]
- Padding: 12 pt top/bottom, 12 pt left/right inside bubble
- Multi-line, ~6 lines visible at this zoom; min-height ~80 pt

**c. Send button (right)**
- Circle ~36 pt, background `#3B82F6` (FUB bright blue; RR: `bg-primary` `#102742`)
- Icon: upward arrow ↑ white `#FFFFFF`, ~20 pt
- Tap → compliance check (S10) → send message (SMS or email per channel context) → bubble appears in thread → compose clears [INFERRED]
- Disabled when `draftText.trim().length === 0`

### Component tree

```tsx
<MobileShell bg="#102742">

  <StatusBar style="light" bg="#102742" />

  <ConversationTopBar bg="#102742" height={56} px={16}>
    <BackButton icon="chevron-left" color="#FFFFFF" size={22}
      onPress={popToInbox} />
    <ContactHeader
      onPress={navigateToContactDetail}
      flexDirection="row" alignItems="center" gap={8}
    >
      <Avatar
        initials={contact.initials}
        bg={contact.avatarColor}  // auto-assigned hex by hash of person.id
        size={36} shape="circle"
        textColor="#FFFFFF" fontSize={14} fontWeight="700"
      />
      <ContactName
        text={contact.display_name}
        color="#FFFFFF" fontSize={17} fontWeight="600"
      />
      <ChevronRight color="#FFFFFF" size={12} />
    </ContactHeader>
    <TopBarActions gap={12}>
      <IconButton icon="phone" color="#FFFFFF" size={22}
        onPress={() => initiateCall(contact)} />
      <IconButton icon="ellipsis-horizontal" color="#FFFFFF" size={22}
        onPress={openConversationMenu} />
    </TopBarActions>
  </ConversationTopBar>

  <ConversationBody flex={1} bg="#FFFFFF" scrollable pullToRefresh>
    {messages.length === 0 ? (
      <EmptyConversation />  // blank white space — no illustration
    ) : (
      messages.map(msg => (
        <MessageBubble
          key={msg.id}
          direction={msg.direction}  // 'inbound' | 'outbound'
          text={msg.body_text}
          timestamp={msg.created_at}
          channel={msg.type}  // 'text' | 'email'
          deliveryStatus={msg.sms_status}
        />
      ))
    )}
  </ConversationBody>

  <ComposePanel bg="#FFFFFF" borderTop="1px solid #E0E0E0">

    {/* AI chip strip */}
    <AIChipStrip
      horizontal scrollable
      height={50} px={12} gap={10}
      borderTop="1px solid #E0E0E0"
      bg="#FFFFFF"
    >
      {aiTemplateOptions.map(t => (
        <AIChip
          key={t.id}
          label={t.label}
          icon={t.isAI ? 'sparkle' : 'plus'}
          selected={t.id === selectedTemplateId}
          selectedStyle={{
            bg: '#102742',           // RR navy (NOT purple gradient)
            borderColor: '#102742',
            textColor: '#FFFFFF',
          }}
          unselectedStyle={{
            bg: '#FFFFFF',
            borderColor: '#D1D5DB',
            textColor: '#111827',
          }}
          height={38} px={16}
          fontSize={15} fontWeight="600"
          borderRadius={19}
          onPress={() => selectAITemplate(t.id)}
        />
      ))}
    </AIChipStrip>

    {/* Compose row */}
    <ComposeRow px={12} py={10} gap={10} flexDirection="row" alignItems="center">
      <AttachButton
        icon="plus" bg="#E5E7EB" iconColor="#6B7280"
        size={36} shape="circle"
        onPress={openAttachmentPicker}
      />
      <DraftTextArea
        flex={1}
        value={draftText}
        onChangeText={setDraftText}
        placeholder="Write a message..."
        bg="#FFFFFF"
        border="1px solid #E5E7EB"
        borderRadius={12}
        px={12} py={12}
        fontSize={15} color="#1C1C1E"
        multiline minHeight={80}
        /* AI draft pre-populated verbatim:
           "Hi Andy, just following up on your general inquiry from earlier
            this month. If you have any specific properties or areas in mind,
            I'd be happy to help you explore options that fit your needs.
            Let me know if you want to set up a time to chat!" */
      />
      <SendButton
        icon="arrow-up" bg="#102742" iconColor="#FFFFFF"
        size={36} shape="circle"
        disabled={draftText.trim().length === 0}
        onPress={handleSend}
      />
    </ComposeRow>

  </ComposePanel>

</MobileShell>
```

### AI template generation flow

1. User arrives at conversation thread → AI chip strip auto-appears with template options
2. Default chip selected: "Follow Up" (or most contextually appropriate based on contact data)
3. AI draft auto-generated from: `contact.timeline` (last email, notes, calls), `contact.stage`, `contact.lead_source`, current date delta from last contact
4. Draft text pre-populates the `DraftTextArea`
5. Agent reads draft → optionally edits → taps Send
6. **Gate:** Agent must review and edit before sending — auto-send of AI-generated content is prohibited (per §07c.3.5 + texting.md §10)
7. After send: bubble appears in `ConversationBody`, chip strip collapses or resets

### Data bindings

| Component | Source |
|---|---|
| `contact.*` | `crm_people` row |
| `contact.avatarColor` | Deterministic HSL hash of `person.id` |
| `messages[]` | `crm_timeline WHERE person_id = :id AND type IN ('text','email') ORDER BY created_at ASC` |
| `aiTemplateOptions` | In-house AI template config (Introduction / Follow Up / Still Buying / Nurture Lead / Custom) |
| `draftText` | Generated by `POST /api/crm/ai/draft { personId, templateType }` using Claude API |
| `handleSend()` | Compliance check (S10) → channel-appropriate send → `crm_timeline` write |

### Acceptance criteria

1. Nav bar renders with avatar (initials + contact-specific color), name + `>` chevron, phone icon, `···` menu.
2. Tap contact name/chevron → navigates to contact detail (§25 / mob-25 pattern).
3. Tap phone icon → initiates click-to-call (S8).
4. Conversation body renders message bubbles sorted oldest-first (scroll to bottom on open).
5. AI chip strip shows at minimum: Follow Up ✦, Custom +, Still Buying ✦ (scrollable for more).
6. Active/selected chip shows navy fill + white text (NOT FUB's purple gradient).
7. AI draft pre-populates `DraftTextArea` — editable before send.
8. Send disabled when draft is empty.
9. Compliance gate fires before send; blocks opt-out contacts with non-dismissible error.
10. After successful send: new outbound bubble appears at bottom of conversation; draft clears.

---

## S4 — FUB iOS SMS Attachment Picker Sheet **[OBSERVED — mob-39]**

### Purpose
Modal bottom sheet presented when the `+` attachment button is tapped in the SMS compose toolbar. Offers six options split into two groups: media capture (4 rows) and CRM-specific actions (2 rows). Slides up over the active conversation thread, which is dimmed/inactive behind it.

### Screen regions (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | `#2e4a58` (nav bar color) |
| Nav / conversation header | 54–104 | 50 pt | `#2e4a58` dark teal |
| Dimmed conversation background (inactive) | 104–525 | ~421 pt | `#e5e5e5` scrim over thread |
| Bottom sheet drag handle zone | 525–545 | 20 pt | `#FFFFFF` |
| Sheet — Group 1 (media, 4 rows) | 545–800 | ~255 pt | `#FFFFFF` |
| Sheet — divider between groups | ~800–802 | 2 pt | `#e0e0e0` |
| Sheet — Group 2 (CRM, 2 rows) | 802–930 | ~128 pt | `#FFFFFF` |
| Safe-area padding + home indicator | 930+ | remainder | `#FFFFFF` |

### Navigation bar (persists above dimmed thread, y 54–104)

Identical to S3 nav bar pattern:
- **Background:** `#2e4a58` (RR: `bg-primary` `#102742`)
- **Left:** Back chevron `<` white → pop to previous screen
- **Center-left:** Avatar circle "AC" `#c96a1a` (burnt orange), "Andy Christensen" white ~17 pt Geist 600, chevron `>`
- **Right-1:** Phone handset icon white → click-to-call
- **Right-2:** `···` kebab white → context menu

### Bottom sheet

**Sheet surface:** `#FFFFFF`, top corners radius ~14 pt. Standard iOS sheet presentation (`position: fixed; bottom: 0; width: 100%`).

**Drag handle:** 36×4 pt pill, centered, `#d0d0d0`, at y ~532 pt.

**Tap outside or swipe down to dismiss.**

#### Group 1 — Media attachment options (no section header)

Row anatomy: 20 pt left padding | 24×24 pt stroke icon `#1a1a1a` | 16 pt gap | label text ~17 pt Geist 400 `#1a1a1a` | full-width tap target ~58 pt tall | no right chevron | no intra-group dividers.

| Row | Icon glyph (stroke, 24×24 pt) | Label | Action |
|---|---|---|---|
| 1 | Stacked photo frames (landscape with mountain inside) | "Photo Library" | Opens `ImagePicker` in photo mode |
| 2 | Film strip + play triangle | "Video Library" | Opens `ImagePicker` filtered to videos |
| 3 | Camera body outline (rounded rect, circular lens, shutter bump) | "Take picture" | Opens device camera in photo mode |
| 4 | Camera outline + record dot indicator | "Record video" | Opens device camera in video record mode |

#### Group divider
Full-width 1 pt `#e0e0e0` hairline between groups.

#### Group 2 — CRM-specific actions (no section header)

Same row anatomy as Group 1.

| Row | Icon glyph | Label | Action |
|---|---|---|---|
| 5 | Document with person silhouette + text lines | "Send vCard" | Attaches + sends broker's vCard (name, FUB number, cell, email, avatar, company address) as MMS |
| 6 | Stacked pages with dashed back page | "Use template" | Opens SMS template library picker; selecting inserts template into compose |

#### Bottom padding
~80–100 pt white space below "Use template" before home indicator.

### Component tree

```tsx
{/* Underlying conversation — dimmed while sheet open */}
<ConversationThread
  contact={contact}
  pointerEvents="none"
  style={{ opacity: 0.85, filter: 'brightness(0.85)' }}
/>

{/* Sticky nav bar above everything */}
<ConversationTopBar bg="#102742" position="sticky" top={0} zIndex={10}>
  {/* ... same as S3 nav bar ... */}
</ConversationTopBar>

{/* Bottom sheet */}
<BottomSheet
  visible={attachmentSheetOpen}
  onDismiss={closeAttachmentSheet}
  bg="#FFFFFF"
  borderTopLeftRadius={14}
  borderTopRightRadius={14}
  snapPoints={['auto']}
>
  <DragHandle
    width={36} height={4}
    bg="#d0d0d0" borderRadius={2}
    alignSelf="center" mt={8} mb={12}
  />

  {/* Group 1 */}
  <SheetRow
    icon={<PhotoLibraryIcon size={24} color="#1a1a1a" strokeWidth={1.5} />}
    label="Photo Library"
    onPress={() => { closeSheet(); openImagePicker('photo-library') }}
  />
  <SheetRow
    icon={<VideoLibraryIcon size={24} color="#1a1a1a" strokeWidth={1.5} />}
    label="Video Library"
    onPress={() => { closeSheet(); openImagePicker('video-library') }}
  />
  <SheetRow
    icon={<CameraIcon size={24} color="#1a1a1a" strokeWidth={1.5} />}
    label="Take picture"
    onPress={() => { closeSheet(); openCamera('photo') }}
  />
  <SheetRow
    icon={<RecordVideoIcon size={24} color="#1a1a1a" strokeWidth={1.5} />}
    label="Record video"
    onPress={() => { closeSheet(); openCamera('video') }}
  />

  <Divider color="#e0e0e0" height={1} />

  {/* Group 2 */}
  <SheetRow
    icon={<VCardIcon size={24} color="#1a1a1a" strokeWidth={1.5} />}
    label="Send vCard"
    onPress={sendBrokerVCard}
  />
  <SheetRow
    icon={<TemplateIcon size={24} color="#1a1a1a" strokeWidth={1.5} />}
    label="Use template"
    onPress={openSMSTemplatePicker}
  />

  <SafeAreaPad />
</BottomSheet>
```

#### `<SheetRow>` anatomy

```tsx
<SheetRow>
  /* height: 58 pt */
  /* px: 20 pt */
  /* flexDirection: row */
  /* alignItems: center */
  /* gap: 16 pt */
  /* bg: #FFFFFF */
  /* activeOpacity: 0.6 (press feedback) */

  <Icon size={24} strokeColor="#1a1a1a" strokeWidth={1.5} />
  <Text fontSize={17} fontWeight="400" color="#1a1a1a">
    {label}
  </Text>
  {/* No right-side chevron */}
</SheetRow>
```

### MMS / vCard constraints (from §17.3.10)

- Videos under 5 MB: sent inline as MMS
- Videos over 5 MB: delivered as redirect link to browser; max 500 MB
- One video per message
- vCard sends: name, FUB number, cell phone, email, avatar photo, company address
- Max 4 vCards per single message

### Acceptance criteria

1. Sheet slides up from bottom with spring animation when `+` attachment button tapped in any SMS compose.
2. Underlying conversation dims (opacity ~0.85 or rgba scrim overlay).
3. Nav bar remains sticky above sheet.
4. Drag handle pill visible; swipe down or tap outside dismisses sheet.
5. Group 1 renders 4 rows: Photo Library, Video Library, Take picture, Record video.
6. Divider separates groups (1 pt `border-border`).
7. Group 2 renders 2 rows: Send vCard, Use template.
8. Row touch targets 58 pt tall; icon 24 pt stroke; label 17 pt Geist 400.
9. "Photo Library" → browser `<input type="file" accept="image/*">` or native media picker API.
10. "Send vCard" → constructs and attaches broker's `.vcf` data to the pending MMS.
11. "Use template" → presents SMS template picker sheet (separate modal).
12. Home indicator safe-area padding preserved.

---

## S5 + S6 — In-house Web Email Compose Card (Comms tab) **[OBSERVED — mob-48, mob-57]**

### Purpose
The "Send a message" card within the Comms sub-tab on the mobile-web contact detail page. Provides channel selector, template picker, To field, subject, merge-field chips, body textarea, and preview. The in-house implementation uses the Ryan Realty design system and extends FUB's functionality with additional merge-field categories.

### Context within page

- Reached via: Bottom tab "People" → contact row → sub-tab "Comms"
- Sub-tab strip (dark charcoal bg `#1e1e1e`) with "Comms" active (white text + `#2563eb` blue underline)
- Above the "Send a message" card: **Quick Action Pills** in a 2×2 grid

**Quick Action Pills (mob-57 — Section above compose card, y ≈ 310–400 pt):**

| Pill | Icon | Label | Action |
|---|---|---|---|
| 1 | Envelope outline ~16 pt | "Newsletter" | Opens newsletter subscription management for this contact |
| 2 | Chain-link / automation symbol ~16 pt | "Automations" | Opens automation enrollment panel |
| 3 | Magnifier ~16 pt | "Saved searches" | Shows/manages saved property searches |
| 4 | Bar chart ascending ~16 pt | "Market reports" | Opens market report subscription management |

**Quick Action Pill style:**
- Shape: fully-rounded pill, ~44 pt tall, ~50% viewport width each (minus gutters)
- Background: `#FFFFFF`, border 1 pt `#E0E0E0` (RR: `bg-card border-border`)
- Text: `#1a1a1a` ~15 pt Geist 500
- Icon: leading, ~16 pt, `#1a1a1a`
- Grid: 2 columns, 10 pt column gap, 8 pt row gap

### "Send a message" card (y ≈ 415–780+ pt, scrolls off-screen)

**Container:** White card `#FFFFFF`, border-radius ~12 pt, subtle shadow `rgba(0,0,0,0.08)`, 16 pt horizontal margins, 16 pt internal padding.

#### Element 1 — Card title
- **"Send a message"** — `#1A1A1A`, ~18 pt Geist 600, top of card, 16 pt top padding

#### Element 2 — Channel / from-address selector
- **"EMAIL · MATT@RYAN-REALTY.COM"** (or "EMAIL · ANNAASMITH664@GMAIL.COM" for the contact's email)
- "EMAIL ·" — `#9E9E9E`, ~11 pt Geist 400, all-caps, tracking ~0.08em
- Email address — same gray, underlined tappable link → opens channel picker (email vs SMS, or alternate send-from address) [INFERRED]
- Font: Geist (NOT AzoSans — per design system v2 body font)

**Channel picker behavior [INFERRED]:**
- Bottom sheet or popover listing available channels: Email (from matt@ryan-realty.com), SMS (from 541.703.3095)
- Selecting SMS channel transforms the card to the SMS compose layout (S7)

#### Element 3 — Template selector dropdown
- **Control:** Full-width rounded rect, bg `#F5F5F5` (RR: `bg-muted`), border 1 pt `#E0E0E0`, radius ~8 pt, height ~44 pt
- **Selected value:** "Blank email" — `#1A1A1A`, ~15 pt Geist 400
- **Right icon:** Up-down chevron stepper `⇅` — `#9E9E9E`, ~20 pt — tap → bottom sheet with saved email templates
- Template options: "Blank email" + all shared/own email templates from `email_templates` table

#### Element 4 — To: recipient row
- **"To"** label — `#9E9E9E`, ~13 pt Geist 400, left-aligned
- **Recipient value:** `"Matthew Ryan · matt@ryan-realty.com"` (mob-48) or `"Lead annaasmith664@gmail.com · annaasmith664@gmail.com"` (mob-57)
  - Format: `{display_name} · {email}` or `{email} · {email}` when name is placeholder
  - `#1A1A1A`, ~15 pt Geist 500, truncated with ellipsis at viewport edge
- **Divider:** 1 pt `#E5E5E5` full-width below row

#### Element 5 — Subject field
- **Input:** Rounded rect, bg `#F5F5F5`, border 1 pt `#E0E0E0`, radius ~8 pt, height ~44 pt
- **Placeholder:** "Subject" — `#BDBDBD`, ~15 pt Geist 300 or 400 (light weight)
- Empty by default; tap → keyboard focus

#### Element 6 — Preview / Edit row
- **"Preview, what sends"** — `#9E9E9E`, ~13 pt Geist 400, left-aligned
- **"Edit" button** — right-aligned
  - Background: `#1A1A1A` (RR: `bg-foreground` or custom near-black)
  - Text: "Edit" white `#FFFFFF`, ~13 pt Geist 600
  - Shape: rounded pill, ~32 pt height, ~64 pt width, radius ~20 pt
  - Tap → opens full email body editor (rich text view or expanded panel) [INFERRED]

#### Element 7 — Merge fields section

**Section header:**
- **"MERGE FIELDS — CLICK TO INSERT AT CURSOR"** — all-caps, `#9E9E9E`, ~10 pt Geist 500, letter-spacing wide (`tracking-widest`)

**Category: CONTACT**
- Category label: "CONTACT" — `#9E9E9E`, ~11 pt Geist 500, all-caps
- Chip: **"First name"**
  - Style: monospace/Courier font (NOT system sans), ~12 pt — marks it as a code/token chip
  - Outlined pill: border 1 pt `#BDBDBD`, white bg `#FFFFFF`, radius ~16 pt (full pill), px ~10 pt, height ~28 pt
  - Tap → inserts `{{contact.first_name}}` at cursor position in focused field

**Category: PROPERTY**
- Category label: "PROPERTY" — same style
- Chips (flow-wrap across lines):
  - **"Seller property address"** → `{{property.seller_address}}`
  - **"Property address"** → `{{property.address}}`
  - **"Address (short)"** → `{{property.address_short}}`

**Category: CMA**
- Category label: "CMA" — same style
- Chip: **"CMA link"** → `{{cma.link}}`

> NOTE: The in-house app extends FUB's merge field taxonomy with custom categories (PROPERTY, CMA) not present in the standard FUB implementation. Full token catalog should also include: AGENT (name, phone, email), DATE, LEAD SOURCE per §17.2.4.

**Merge chip font critical detail:** The font inside merge chips is **monospace** (Courier New or `font-family: ui-monospace, 'Courier New', monospace`). This distinguishes them from UI text and signals "code token" semantics to the broker.

#### Element 8 — Message body textarea
- **Container:** Rounded rect, bg `#F9F9F9` (near-white), border 1 pt `#E0E0E0`, radius ~8 pt, min-height ~80 pt
- **Placeholder:** "Message. Sends from the signed-in broker's own mailbox." — `#BDBDBD`, ~14 pt Geist 400
- Empty; tap → keyboard appears; merge field chip taps insert token at `cursor_position` via `textarea.setRangeText()`
- Sends from authenticated broker's Gmail/email credentials (NOT a generic noreply address)

#### Element 9 — Send button (below fold, not visible in mob-48/57)
- **[INFERRED from desktop §17.2.4]:** "Send Email" — `<Button variant="default">` navy fill `#102742`, cream text `#faf8f4`
- Disabled when To or Subject empty
- Fires S10 suppression check before send

### Component tree

```tsx
<MobileShell bg="#F5F5F5">

  {/* System bars */}
  <iOSStatusBar />
  <SafariURLBar url="ryan-realty.com" />

  {/* App nav */}
  <TopBar bg="#f2f2f2" height={52} px={14}>
    <HamburgerButton onPress={openDrawer} />
    <BrandWordmark
      src="/design_system/assets/brand/logo-blue.png"
      subLabel="BEND·OREGON"
    />
    <SearchButton bg="#FFFFFF" shadow borderRadius={8} size={36} />
    <BrokerAvatarButton initial="M" bg="#E0E0E0" size={36} />
  </TopBar>

  {/* Contact hero card */}
  <ContactHeroCard bg="#1e1e1e" height={118} px={16}>
    <InitialsAvatar letter={contact.initials} size={80} bg="#3a3a3a" borderRadius={12} />
    <ContactHeroInfo>
      <ContactName color="#FFFFFF" fontSize={16} fontWeight={600} truncate>
        {contact.display_name}
      </ContactName>
      <ContactEmail color="#CCCCCC" fontSize={13}>{contact.email}</ContactEmail>
      <ContactPhone color="#CCCCCC" fontSize={13}>{contact.phone}</ContactPhone>
      <Row gap={8} mt={4}>
        <LeadStageBadge
          dot="#2563eb" label="Lead" color="#2563eb"
          bg="white" border="#2563eb" height={24}
        />
        <AssignedBroker value="Matt Ryan" color="#999999" fontSize={13} />
      </Row>
    </ContactHeroInfo>
  </ContactHeroCard>

  {/* Sub-tab strip */}
  <ContactSubTabStrip
    bg="#1e1e1e" height={42}
    activeColor="#FFFFFF" activeUnderlineColor="#2563eb"
    inactiveColor="#888888"
    scrollable
    tabs={["Info","Comms","Tasks","Homes","Workflow","Activity"]}
    activeTab="Comms"
  />

  <ScrollView bg="#f0f0f0" px={16} pt={16}>

    {/* Quick action pills 2×2 grid */}
    <QuickActionGrid cols={2} gap={10} mb={16}>
      <QuickActionPill icon={<EnvelopeIcon size={16} />} label="Newsletter"
        onPress={() => navigate('newsletter', contact.id)} />
      <QuickActionPill icon={<AutomationsIcon size={16} />} label="Automations"
        onPress={() => navigate('automations', contact.id)} />
      <QuickActionPill icon={<SearchIcon size={16} />} label="Saved searches"
        onPress={() => navigate('saved-searches', contact.id)} />
      <QuickActionPill icon={<BarChartIcon size={16} />} label="Market reports"
        onPress={() => navigate('market-reports', contact.id)} />
    </QuickActionGrid>

    {/* Send a message card */}
    <Card bg="#FFFFFF" borderRadius={12} shadow="sm" p={16} mb={12}>

      <CardTitle fontSize={18} fontWeight={600} color="#1A1A1A" mb={12}>
        Send a message
      </CardTitle>

      {/* Channel selector */}
      <ChannelSelector mb={12}>
        <Text color="#9E9E9E" fontSize={11} letterSpacing={0.8} uppercase>
          EMAIL ·{' '}
        </Text>
        <Pressable onPress={openChannelPicker}>
          <Text color="#9E9E9E" fontSize={11} letterSpacing={0.8} uppercase
            textDecorationLine="underline">
            {broker.email.toUpperCase()}
          </Text>
        </Pressable>
      </ChannelSelector>

      {/* Template dropdown */}
      <Select
        value={selectedTemplate}
        onChange={handleTemplateChange}
        options={emailTemplates}
        placeholder="Blank email"
        height={44} borderRadius={8}
        bg="#F5F5F5" borderColor="#E0E0E0"
        rightIcon={<UpDownChevron color="#9E9E9E" size={20} />}
        mb={12}
      />

      {/* To field */}
      <Row mb={0}>
        <Label color="#9E9E9E" fontSize={13} width={32}>To</Label>
        <Text color="#1A1A1A" fontSize={15} fontWeight={500} flex={1} numberOfLines={1}>
          {contact.display_name} · {contact.email}
        </Text>
      </Row>
      <Divider color="#E5E5E5" my={10} />

      {/* Subject */}
      <Input
        placeholder="Subject"
        value={subject}
        onChangeText={setSubject}
        height={44} borderRadius={8}
        bg="#F5F5F5" borderColor="#E0E0E0"
        fontSize={15} mb={12}
        ref={subjectRef}
      />

      {/* Preview + Edit */}
      <Row justifyContent="space-between" alignItems="center" mb={16}>
        <Text color="#9E9E9E" fontSize={13}>Preview, what sends</Text>
        <Button
          label="Edit"
          bg="#1A1A1A" color="#FFFFFF"
          borderRadius={20} px={16} height={32}
          fontSize={13} fontWeight={600}
          onPress={openPreview}
        />
      </Row>

      {/* Merge fields */}
      <MergeFieldsSection>
        <SectionHeader
          text="MERGE FIELDS — CLICK TO INSERT AT CURSOR"
          color="#9E9E9E" fontSize={10} letterSpacing={1.2}
          mb={10}
        />

        <MergeFieldGroup label="CONTACT" mb={10}>
          <MergeChip
            label="First name"
            token="{{contact.first_name}}"
            onPress={() => insertAtCursor('{{contact.first_name}}')}
          />
        </MergeFieldGroup>

        <MergeFieldGroup label="PROPERTY" mb={10}>
          <MergeChipsWrap gap={8}>
            <MergeChip label="Seller property address"
              token="{{property.seller_address}}"
              onPress={() => insertAtCursor('{{property.seller_address}}')} />
            <MergeChip label="Property address"
              token="{{property.address}}"
              onPress={() => insertAtCursor('{{property.address}}')} />
            <MergeChip label="Address (short)"
              token="{{property.address_short}}"
              onPress={() => insertAtCursor('{{property.address_short}}')} />
          </MergeChipsWrap>
        </MergeFieldGroup>

        <MergeFieldGroup label="CMA" mb={10}>
          <MergeChip label="CMA link"
            token="{{cma.link}}"
            onPress={() => insertAtCursor('{{cma.link}}')} />
        </MergeFieldGroup>
      </MergeFieldsSection>

      {/* Message body */}
      <Textarea
        ref={bodyRef}
        placeholder="Message. Sends from the signed-in broker's own mailbox."
        placeholderTextColor="#BDBDBD"
        value={body}
        onChangeText={setBody}
        minHeight={120}
        bg="#F9F9F9" borderColor="#E0E0E0"
        borderRadius={8} px={12} py={10}
        fontSize={14} color="#1A1A1A"
        mb={16}
      />

      {/* Send button */}
      <Button
        label="Send Email"
        variant="default"
        bg="#102742" color="#faf8f4"
        disabled={!subject.trim() || !body.trim()}
        onPress={handleSendEmail}
        fullWidth height={48} borderRadius={8}
      />

    </Card>

  </ScrollView>

  {/* Floating action button */}
  <FAB
    bg="#2563eb" icon="plus" iconColor="#FFFFFF"
    size={52} position="fixed" bottom={80} right={16}
    onPress={openQuickComposeSheet}
    zIndex={100}
  />

  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E5EA" height={64}>
    <Tab icon="home-outline" label="Home" href="/crm" />
    <Tab icon="inbox-outline" label="Inbox" href="/crm/inbox" />
    <Tab icon="people-filled" label="People" active href="/crm/people" activeColor="#111111" />
    <Tab icon="layers-outline" label="Deals" href="/crm/deals" />
    <Tab icon="waveform" label="Activity" href="/crm/activity" />
  </BottomTabBar>

</MobileShell>
```

#### `<MergeChip>` component spec

```tsx
<MergeChip>
  /* border-radius: 16pt (full pill) */
  /* border: 1pt solid #BDBDBD */
  /* bg: #FFFFFF */
  /* px: 10pt */
  /* height: ~28pt */
  /* font-family: ui-monospace, 'Courier New', monospace */
  /* font-size: 12pt */
  /* color: #1A1A1A */
  /* press feedback: opacity 0.7 */

  {label}   {/* "First name", "Seller property address", etc. */}
</MergeChip>
```

**`insertAtCursor(token)` implementation:**

```typescript
function insertAtCursor(token: string) {
  const el = bodyRef.current as HTMLTextAreaElement
  if (!el) return
  const start = el.selectionStart ?? body.length
  const end = el.selectionEnd ?? body.length
  const newBody = body.slice(0, start) + token + body.slice(end)
  setBody(newBody)
  // restore cursor after token
  requestAnimationFrame(() => {
    el.setSelectionRange(start + token.length, start + token.length)
    el.focus()
  })
}
```

### Data bindings

| Component | Source |
|---|---|
| `ChannelSelector` | `broker.email` (from auth session) |
| `Select` options | `GET /api/crm/email-templates` |
| `ToField` value | `contact.display_name + ' · ' + contact.email` |
| Merge field chips | Static catalog: `CONTACT` / `PROPERTY` / `CMA` / `AGENT` / `DATE` categories |
| `body` textarea | Local compose state; tokens inserted via `insertAtCursor()` |
| `handleSendEmail()` | S10 suppression check → `POST /api/crm/contacts/:id/email` → `crm_timeline` write |

### Acceptance criteria

1. Quick action pill grid (2×2) renders above compose card with correct icons and labels.
2. "EMAIL · {broker.email}" channel selector renders in all-caps with tappable email link.
3. Template dropdown shows "Blank email" by default; opens template list on tap.
4. To field auto-populated from `contact.display_name + ' · ' + contact.email`; truncated.
5. Subject input accepts free text; tap focuses keyboard.
6. "Preview, what sends" + "Edit" button side by side; "Edit" taps open body editor.
7. Merge field section header in all-caps small gray text.
8. "First name" chip renders in monospace font (NOT Geist).
9. PROPERTY category shows 3 chips: "Seller property address", "Property address", "Address (short)"; chips wrap to multiple lines.
10. CMA category shows "CMA link" chip.
11. Tapping any merge chip inserts its token at cursor position in focused field (subject or body).
12. Body textarea placeholder reads exactly: "Message. Sends from the signed-in broker's own mailbox."
13. Send button disabled until subject AND body are non-empty.
14. Send fires S10 suppression check; blocked for `email_opt_out` contacts with clear error.
15. FAB floats bottom-right above tab bar; opens quick-compose sheet with all channel options.

---

## S7 — In-house Web SMS Compose + Note + Email Engagement **[OBSERVED — mob-58]**

### Purpose
Scroll-down state of the contact detail page showing three embedded sections within the comms card: (1) TEXT/SMS compose with template picker + recipient chip + message input + quiet-hours override, (2) ADD A NOTE textarea + Save button, (3) Email engagement empty-state card. Different from S5/S6 which shows the email-first view.

### Screen regions (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | `#FFFFFF` |
| Safari address bar | 54–94 | 40 pt | `#F2F2F7` iOS system gray |
| App nav/header bar | 94–148 | 54 pt | `#FFFFFF` with thin bottom border |
| Scrollable content | 148–754 | 606 pt | `#F2F2F7` page bg — white cards inside |
| Bottom tab bar | 754–810 | 56 pt | `#FFFFFF` top border `#E5E5EA` |
| Safari chrome row | 810–844 | 34 pt | `#F2F2F7` |

### App nav bar (y 94–148, exact)

- **Left:** Hamburger `≡` icon ~20×16 pt gray `#444444`
- **Center:** Ryan Realty wordmark (Amboqia Boriango, navy `#102742`, "BEND·OREGON" small caps below)
- **Right-1:** Search magnifier in light-gray rounded-square bg `#F5F5F5`, ~32×32 pt
- **Right-2:** "M" avatar — circle, navy bg `#102742`, white "M", ~28 pt

### Section 1 — TEXT / SMS Compose Card

**Container:** White card `#FFFFFF`, radius ~12 pt, 16 pt horizontal margins, 16 pt internal padding, subtle shadow.

#### 1a. Section header row
- **"TEXT · 123.456.7890"**
  - "TEXT" — uppercase, `#8E8E93`, ~11 pt Geist 500, tracking `0.08em` (RR: `text-muted-foreground` uppercase section label)
  - "·" — middot separator
  - "123.456.7890" — underlined, same `#8E8E93` style; tap → `tel:1234567890` call or copy [INFERRED]
  - In production: resolves from `contact.primary_phone` or `crm_people.contact_points`

#### 1b. Template selector
- Full-width rounded rect, border 1 pt `#D1D1D6`, bg `#FFFFFF`
- **Selected value:** "Blank sms" — `#1C1C1E`, ~15 pt Geist 400
- **Right:** Up-down chevron `⇅` gray; tap → bottom sheet with SMS templates
- Height: ~44 pt; px 12 pt; radius ~8 pt

#### 1c. Recipient "To" row
- **"To"** label — gray, ~13 pt Geist 400
- **Recipient pill:** "Lead annaasmith664@gmail.com"
  - Background: `#1C1C1E` near-black (RR: `bg-foreground`)
  - Text: white `#FFFFFF`, ~13 pt Geist 500
  - Border-radius: pill (fully rounded), ~20 pt radius
  - Padding: ~6 pt vertical, ~12 pt horizontal
  - Name resolution: uses `display_name` (prepends "Lead" when name is placeholder/email-only)

#### 1d. Message input row
- **Container:** Full-width rounded rect, border 1 pt `#D1D1D6`, bg `#F9F9F9`, radius ~10 pt, height ~44 pt
- **Left:** `+` plus icon ~20 pt dark gray — tap → opens attachment picker (S4-equivalent web sheet) [INFERRED]
- **Placeholder:** "Text message · SMS" — gray `#8E8E93`, ~15 pt Geist 400
- **Right:** Gray circle send button, ~36 pt, bg `#8E8E93` in EMPTY/inactive state
  - Transitions to `bg-primary` `#102742` navy when text is entered [INFERRED]
  - Icon: white ↑ arrow `#FFFFFF` ~18 pt
  - Tap (when active) → compliance check → Twilio send → `crm_timeline` write

#### 1e. Quiet-hours checkbox row
- **Checkbox:** Unchecked, ~18 pt, border 1.5 pt `#D1D1D6`, bg white, radius 3 pt (RR: `<Checkbox>` from `@/components/ui/checkbox`)
- **Label:** "Send anyway (quiet hours)" — `#8E8E93`, ~13 pt Geist 400
- Row padding: ~8 pt vertical; left margin 16 pt
- When checked: allows sending outside 9pm–8am quiet window (per §17.3.6)

#### 1f. Divider
- 1 pt `#E5E5EA` full-width separating SMS form from Note section

### Section 2 — ADD A NOTE

#### 2a. Section header
- **"ADD A NOTE"** — uppercase, `#8E8E93`, ~11 pt Geist 500, tracking `0.08em`
- Top padding ~16 pt

#### 2b. Note textarea
- Full-width rounded rect, border 1 pt `#D1D1D6`, bg `#FFFFFF`, radius ~10 pt, height ~80 pt (multiline)
- **Placeholder:** "Logs to the timeline" — `#8E8E93`, ~15 pt Geist 400
- Tap → keyboard focus, placeholder disappears

#### 2c. Save note button
- **Text:** "Save note"
- **Background:** `#1C1C1E` near-black (RR: `bg-foreground` or `<Button variant="default">`)
- **Text color:** `#FFFFFF`, ~15 pt Geist 500
- **Size:** ~120 pt wide × ~40 pt tall, radius ~10 pt
- **Alignment:** Right-aligned within card
- Tap → `POST /api/crm/contacts/:id/notes { body: noteText }` → appends to `crm_timeline` (type: `note`) → clears textarea

### Section 3 — Email Engagement Card

**Container:** Separate white card, ~12 pt gap from SMS/Note card, same radius + shadow.

- **Title:** "Email engagement" — `#1C1C1E`, ~17 pt Geist 600, top padding 16 pt, left-aligned
- **Body:** "No email activity recorded yet." — `#8E8E93`, ~15 pt Geist 400 (empty state)
- **Height:** ~90 pt compact
- FAB (blue `+`) floats above bottom-right of this card

### Component tree

```tsx
<MobileShell bg="#F2F2F7">

  <SafariAddressBar url="ryan-realty.com" />
  <TopBar bg="#FFFFFF" borderBottom="1px solid #E5E5EA" height={54} px={14}>
    <HamburgerButton />
    <BrandLogo src="/design_system/assets/brand/logo-blue.png" height={32} />
    <SearchButton iconBg="#F5F5F5" borderRadius={8} size={32} />
    <UserAvatar initial="M" bg="#102742" color="#FFFFFF" size={28} />
  </TopBar>

  <ScrollView>
    {/* ... contact hero + sub-tabs above (scrolled off-screen) ... */}

    {/* ── SMS Compose Card ── */}
    <Card radius={12} bg="#FFFFFF" mx={16} mb={12} px={16} py={16}>

      <SectionLabel mb={8}>
        TEXT · <PhoneLink href={`tel:${contact.phone}`}>{contact.phone}</PhoneLink>
      </SectionLabel>

      <TemplatePicker
        value={smsTemplate}
        options={smsTemplates}
        onChange={setSmsTemplate}
        height={44} borderRadius={8}
        bg="#FFFFFF" borderColor="#D1D1D6"
        rightIcon={<UpDownChevron />}
        mb={12}
      />

      <Row mb={12} alignItems="center">
        <RecipientLabel color="#9E9E9E" fontSize={13} width={24}>To</RecipientLabel>
        <RecipientPill bg="#1C1C1E" color="#FFFFFF" borderRadius={20} px={12} py={6}
          fontSize={13} fontWeight={500}>
          {contact.display_name_with_prefix}
          {/* "Lead {email}" when name is placeholder */}
        </RecipientPill>
      </Row>

      <MessageInputRow
        flexDirection="row" alignItems="center"
        bg="#F9F9F9" border="1px solid #D1D1D6"
        borderRadius={10} height={44}
        px={8} mb={8}
      >
        <AttachButton icon="plus" color="#444" size={20}
          onPress={openAttachmentSheet} />
        <TextInput
          placeholder="Text message · SMS"
          placeholderTextColor="#8E8E93"
          value={smsBody}
          onChangeText={setSmsBody}
          flex={1} fontSize={15} color="#1C1C1E"
          multiline={false}
        />
        <SendButton
          icon="arrow-up"
          bg={smsBody.length > 0 ? '#102742' : '#8E8E93'}
          iconColor="#FFFFFF"
          size={36} shape="circle"
          disabled={smsBody.length === 0}
          onPress={handleSendSMS}
        />
      </MessageInputRow>

      {/* Character counter */}
      {smsBody.length > 0 && (
        <CharCounter
          count={smsBody.length}
          limit={320}
          warningColor="#F59E0B"
          errorColor="#EF4444"
          fontSize={11}
          color="#8E8E93"
          mb={4}
        />
      )}

      <CheckboxRow mt={2} mb={16} gap={8} flexDirection="row" alignItems="center">
        <Checkbox
          checked={sendInQuietHours}
          onCheckedChange={setSendInQuietHours}
          id="quiet-hours"
        />
        <Label htmlFor="quiet-hours" color="#8E8E93" fontSize={13}>
          Send anyway (quiet hours)
        </Label>
      </CheckboxRow>

      <Separator color="#E5E5EA" my={0} />

      {/* ── Add a Note ── */}
      <SectionLabel mt={16} mb={8}>ADD A NOTE</SectionLabel>

      <Textarea
        placeholder="Logs to the timeline"
        placeholderTextColor="#8E8E93"
        value={noteBody}
        onChangeText={setNoteBody}
        minHeight={80}
        border="1px solid #D1D1D6"
        borderRadius={10}
        px={12} py={10}
        fontSize={15} color="#1C1C1E"
        mb={12}
      />

      <Row justifyContent="flex-end">
        <Button
          label="Save note"
          bg="#1C1C1E" color="#FFFFFF"
          borderRadius={10} px={16} height={40}
          fontSize={15} fontWeight={500}
          disabled={noteBody.trim().length === 0}
          onPress={handleSaveNote}
        />
      </Row>

    </Card>

    {/* ── Email Engagement Card ── */}
    <Card radius={12} bg="#FFFFFF" mx={16} mb={12} px={16} py={16}>
      <CardTitle fontSize={17} fontWeight={600} color="#1C1C1E" mb={6}>
        Email engagement
      </CardTitle>
      <EmptyStateText color="#8E8E93" fontSize={15}>
        No email activity recorded yet.
      </EmptyStateText>
    </Card>

  </ScrollView>

  <FAB
    bg="#4A90E2" icon="plus" iconColor="#FFFFFF"
    size={56} position="fixed" bottom={70} right={16}
    onPress={openQuickComposeSheet}
    zIndex={100}
  />

  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E5E5EA" height={56}>
    <Tab icon="home-outline" label="Home" />
    <Tab icon="inbox-outline" label="Inbox" />
    <Tab icon="people-filled" label="People" active activeColor="#1C1C1E" />
    <Tab icon="layers-outline" label="Deals" />
    <Tab icon="waveform" label="Activity" />
  </BottomTabBar>

</MobileShell>
```

#### `<SectionLabel>` spec

```tsx
<SectionLabel>
  /* font-size: 11pt */
  /* font-weight: 500 */
  /* color: #8E8E93 */
  /* text-transform: uppercase */
  /* letter-spacing: 0.08em */
  /* font-family: Geist */
</SectionLabel>
```

### Data bindings

| Component | Source |
|---|---|
| `PhoneLink` | `contact.primary_phone` from `crm_people.contact_points` |
| `TemplatePicker.options` | `GET /api/crm/sms-templates` → `{ id, name, body }[]` |
| `RecipientPill` | `contact.display_name ?? 'Lead ' + contact.email` |
| `SendButton.onPress` | S10 gate → Twilio `POST /api/crm/contacts/:id/sms { templateId, body, overrideQuietHours }` |
| `handleSaveNote()` | `POST /api/crm/contacts/:id/notes { body: noteBody }` → appends to `crm_timeline` (type `note`) |
| Email engagement data | `GET /api/crm/contacts/:id/email-engagement` → empty state when `events.length === 0` |

### Compliance: quiet-hours behavior

Per §17.3.6: the quiet-hours window is 9pm–8am in the **assigned broker's** local time (not the contact's timezone). When SMS is attempted during quiet hours WITHOUT the override checkbox:
1. Show toast: "Quiet hours — message queued for 8am" (non-dismissible 3s)
2. Set `crm_timeline.sms_status = 'queued'` and `send_at = next_8am_broker_tz`
3. Store in `crm_scheduled_sends`
4. Display pending status in timeline

When "Send anyway (quiet hours)" is checked: send immediately, bypass quiet-hours check.

### Acceptance criteria

1. "TEXT · {phone}" header renders with phone as a tappable tel: link.
2. Template picker defaults to "Blank sms"; opens SMS template list on tap.
3. Recipient pill shows `display_name` or "Lead {email}" prefix; dark pill bg `bg-foreground`.
4. Message input row: `+` attachment on left, input center (placeholder "Text message · SMS"), circular send button right.
5. Send button gray `#8E8E93` when input empty; turns navy `#102742` when text is entered.
6. Character counter appears when typing; amber warning when >280 chars; shown count/320.
7. "Send anyway (quiet hours)" checkbox unchecked by default; checking allows outside-window sends.
8. Send fires S10 compliance gate: blocks if `text_opt_out = true` or `hard_stop` tag.
9. Successful send: outbound bubble appears in timeline; input clears.
10. Divider visually separates SMS form from "ADD A NOTE" sub-section.
11. Note textarea placeholder "Logs to the timeline"; Save button right-aligned.
12. "Save note" creates `crm_timeline` event (type `note`) and clears the textarea.
13. Email engagement card shows empty-state when `email_engagement_events.length === 0`.
14. FAB floats bottom-right, bg `#2563eb` (CRM action blue, distinct from brand navy), opens quick-compose sheet.

---

## S8 — Click-to-Call Flow + Live Call Screen **[INFERRED — BASIS: §17.4, calling.md §5, mob-39 nav bar phone icon]**

### How to reach

1. Tap phone handset icon in conversation nav bar (mob-39, mob-40 nav bar)
2. Tap phone icon in contact hero card (contact detail header)
3. Tap phone number link in contact detail sidebar
4. Tap FAB → select "Log call" or "Call" from quick-compose sheet

### Pre-call: calling method selector **[INFERRED]**

When broker has calling enabled (`brokers.twilio_number IS NOT NULL`), tapping any call trigger presents a brief bottom sheet (or immediately calls if "Always Use Internet" is configured):

**Calling method bottom sheet:**
```
┌─────────────────────────────┐
│  Call Andy Christensen       │
│  (541) 788-0691             │
├─────────────────────────────┤
│  📞  Call via Internet      │  ← VoIP, browser media
│  📱  Call via Mobile        │  ← Twilio bridge to broker cell
├─────────────────────────────┤
│  Cancel                     │
└─────────────────────────────┘
```

- Sheet bg `#FFFFFF`, radius 14 pt
- Row height 58 pt, icon 24 pt, label 17 pt Geist 400 `#1a1a1a`
- "Cancel" button full-width, 48 pt, `#FF3B30` iOS destructive red (RR: `text-destructive`)

### Live call screen **[INFERRED]**

Presented as a full-screen overlay when call connects. Eliminates bottom tab bar and compose UI.

**Screen regions:**

| Region | y-band | Height | Background |
|---|---|---|---|
| Status bar | 0–54 | 54 pt | Dark `#102742` |
| Call header | 54–250 | 196 pt | Dark navy `#102742` |
| Call controls | 250–580 | 330 pt | `#1A1A1A` near-black |
| Notes area | 580–750 | 170 pt | `#FFFFFF` |
| Hang up zone | 750–844 | 94 pt | `#1A1A1A` |

**Call header (y 54–250):**
- Contact avatar (large, ~80 pt circle, initials + contact-specific color)
- Contact name — white `#FFFFFF`, ~24 pt Geist 600
- "Connected · 00:23" timer — white `#FFFFFF`, ~15 pt Geist 400, counting up
- Call status: "Ringing…" → "Connected" → "Call ended"

**Call controls (y 250–580), 3×2 grid:**

| Icon | Label | Action |
|---|---|---|
| Mute (microphone with slash) | "Mute" | Toggle mic mute (fill changes to active navy when muted) |
| Keypad (3×3 dots) | "Keypad" | Reveal DTMF dialpad overlay for IVR navigation |
| Speaker (sound waves) | "Speaker" | Toggle loudspeaker |
| Add call (+) | "Add" | Conference a second caller [INFERRED] |
| Transfer | "Transfer" | Warm transfer to team member (desktop-only per docs; disabled on mobile) |
| Notes (pencil) | "Notes" | Scroll to notes area / focus notes textarea |

- Grid: 3 columns × 2 rows, equal width cells
- Icon circles: ~64 pt diameter, bg `rgba(255,255,255,0.12)`, icon white `#FFFFFF` 28 pt
- Label: white `#FFFFFF`, ~12 pt Geist 400, below icon
- Active state (muted, speaker on): bg `rgba(255,255,255,0.30)` or filled white

**Notes area (y 580–750):**
- White card, radius 12 pt, px 16 pt, py 12 pt
- Label: "Call notes" — `#9E9E9E`, ~13 pt Geist 500 uppercase
- Textarea: placeholder "Type notes during the call..." — `#BDBDBD`, ~15 pt Geist 400
- Notes save to `crm_timeline.body_text` on call end

**Hang up zone (y 750–844):**
- Large red circle button `#EF4444` (RR: `bg-destructive`), ~72 pt diameter, centered
- Icon: phone handset with downward arrow, white, ~32 pt
- Tap → end call → transition to Call Summary / Log Call screen (S9)

### Component tree

```tsx
<LiveCallScreen position="fixed" inset={0} zIndex={200}>
  <StatusBar style="light" bg="#102742" />

  {/* Call header */}
  <CallHeader bg="#102742" height={196} px={24} pb={24}
    justifyContent="flex-end" alignItems="center">
    <ContactAvatar
      initials={contact.initials}
      bg={contact.avatarColor}
      size={80} shape="circle"
      textColor="#FFFFFF" fontSize={28} fontWeight="700"
    />
    <ContactName color="#FFFFFF" fontSize={24} fontWeight="600" mt={12}>
      {contact.display_name}
    </ContactName>
    <CallStatus color="#FFFFFF" fontSize={15} mt={4}>
      {callStatus} · {formatDuration(callDuration)}
    </CallStatus>
  </CallHeader>

  {/* Controls grid */}
  <ControlsGrid bg="#1A1A1A" px={24} py={32} gap={24} cols={3}>
    <CallControl icon="mic-off" label="Mute" active={isMuted}
      onPress={toggleMute} />
    <CallControl icon="dialpad" label="Keypad"
      onPress={showKeypad} />
    <CallControl icon="volume-high" label="Speaker" active={isSpeaker}
      onPress={toggleSpeaker} />
    <CallControl icon="add-call" label="Add"
      onPress={addCallParticipant} />
    <CallControl icon="transfer" label="Transfer" disabled
      /* desktop-only per §17.4.4 */ />
    <CallControl icon="pencil" label="Notes"
      onPress={() => notesRef.current?.focus()} />
  </ControlsGrid>

  {/* Notes */}
  <NotesArea bg="#FFFFFF" mx={16} borderRadius={12} px={16} py={12}>
    <NotesLabel>CALL NOTES</NotesLabel>
    <Textarea
      ref={notesRef}
      placeholder="Type notes during the call..."
      value={callNotes}
      onChangeText={setCallNotes}
      minHeight={80}
      fontSize={15} color="#1C1C1E"
    />
  </NotesArea>

  {/* Hang up */}
  <HangUpZone bg="#1A1A1A" height={94} justifyContent="center" alignItems="center">
    <HangUpButton
      bg="#EF4444" size={72} shape="circle"
      icon="phone-down" iconColor="#FFFFFF" iconSize={32}
      onPress={handleEndCall}
    />
  </HangUpZone>

</LiveCallScreen>
```

### Acceptance criteria (S8)

1. Calling method sheet presents "Call via Internet" and "Call via Mobile" options when broker has `twilio_number`.
2. If only one method configured, skip sheet and call immediately.
3. Live call screen is full-screen overlay (z-index above all navigation).
4. Call timer counts up from 0:00 in HH:MM:SS or MM:SS format.
5. Mute, Speaker, Keypad controls respond to tap; active state clearly visible.
6. "Transfer" control disabled on mobile (desktop-only per §17.4.4).
7. Notes textarea accepts free text; content auto-saved to `crm_timeline` body on call end.
8. Hang up button large (72 pt), red, centered — easily tappable.
9. On end call: transition to S9 (Log Call summary screen).

---

## S9 — Log Call Form (mobile web) **[INFERRED — BASIS: §07c.5, §17.4.2, calling.md]**

### Purpose
Post-call summary form that auto-fills from call data (outcome, duration). Broker adds call outcome disposition and notes, then submits to create a `crm_timeline` event (type `call`).

### Screen regions (390×844 pt)

| Region | y-band | Height | Background |
|---|---|---|---|
| Status bar | 0–54 | 54 pt | `#FFFFFF` |
| App nav bar | 54–102 | 48 pt | `#FFFFFF` with bottom border |
| "Log Call" card | 102–680 | ~578 pt | `#F5F5F5` bg, white card inside |
| Bottom tab bar | 680–744 | 64 pt | `#FFFFFF` |

### Log Call card content

**Card title:** "Log Call" — `#1A1A1A`, ~20 pt Geist 600, top of card, 16 pt padding

**1. Contact display (read-only)**
- Avatar + contact name + primary phone number
- Same style as contact hero (dark band with initials avatar) but in a lighter card context

**2. Phone number selector**
- **Label:** "Called number" — `#9E9E9E`, ~13 pt
- **Select dropdown:** Lists all phone numbers on contact's profile (`crm_people.contact_points WHERE type='phone'`)
- Pre-selects the number that was just dialed

**3. Call duration (auto-filled for dialer calls; manual for manual logs)**
- **Label:** "Duration" — `#9E9E9E`, ~13 pt
- **Value:** "0:23" (from call session if dialer call) OR manual time input (`MM:SS` or `H:MM:SS`)
- If logging a past external call: manual input

**4. Call outcome / disposition**
- **Label:** "Outcome" — `#9E9E9E`, ~13 pt
- **Select:** Dropdown with options:
  - "Left voicemail"
  - "Spoke with lead" (connected call)
  - "No answer"
  - "Wrong number"
  - "Do not contact"
  - "Other"
- Maps to `crm_timeline.call_outcome` enum

**5. Notes textarea**
- Same as Live Call notes from S8 (pre-populated if notes were taken during call)
- **Label:** "Call notes" — `#9E9E9E`, ~13 pt uppercase Geist 500
- **Textarea:** multiline, placeholder "Add call notes...", min-height 100 pt

**6. Submit button**
- **"Log Call"** — `<Button variant="default">` navy `#102742`, cream `#faf8f4`
- Full-width, 48 pt height
- Tap → create `crm_timeline` event (type `call`, direction `outbound`, outcome, duration, body_text) → update `crm_people.last_call_at` → navigate back to contact detail

**7. Cancel link (below button)**
- "Cancel" — gray, small, center-aligned; dismisses without logging

### Component tree

```tsx
<LogCallSheet>
  <SheetHeader title="Log Call" onClose={handleCancel} />

  <ScrollView px={16} pt={16}>

    <ContactSummaryRow contact={contact} mb={16} />

    <FormField label="Called number" mb={12}>
      <Select
        value={calledNumber}
        options={contact.phones.map(p => ({
          value: p.number, label: `${p.label} · ${p.number}`
        }))}
        onChange={setCalledNumber}
        height={44} borderRadius={8}
      />
    </FormField>

    <FormField label="Duration" mb={12}>
      <Input
        value={formatDuration(callDuration)}
        onChangeText={setCallDurationText}
        placeholder="0:00"
        keyboardType="numbers-and-punctuation"
        height={44} borderRadius={8}
      />
    </FormField>

    <FormField label="Outcome" mb={12}>
      <Select
        value={callOutcome}
        options={CALL_OUTCOMES}  // array of { value, label }
        onChange={setCallOutcome}
        height={44} borderRadius={8}
      />
    </FormField>

    <FormField label="Call notes" mb={24}>
      <Textarea
        value={callNotes}
        onChangeText={setCallNotes}
        placeholder="Add call notes..."
        minHeight={100}
        borderRadius={8} px={12} py={10}
        fontSize={15}
      />
    </FormField>

    <Button
      label="Log Call"
      variant="default"
      bg="#102742" color="#faf8f4"
      fullWidth height={48} borderRadius={8}
      disabled={!callOutcome}
      onPress={handleLogCall}
      mb={12}
    />

    <TextButton
      label="Cancel"
      color="#8E8E93" fontSize={14}
      alignSelf="center"
      onPress={handleCancel}
    />

  </ScrollView>
</LogCallSheet>
```

### Data written on submit

```typescript
const event: Partial<TimelineEvent> = {
  person_id: contact.id,
  type: 'call',
  direction: 'outbound',
  from_user_id: broker.id,
  from_address: broker.twilio_number,
  to_address: calledNumber,
  call_duration_seconds: parseDuration(callDurationText),
  call_outcome: callOutcome,
  body_text: callNotes,
  via_automation: false,
}
```

### Acceptance criteria (S9)

1. Log Call form presents after call ends (auto-transition from S8) OR accessible from compose bar "Log Call" tab.
2. Called number dropdown pre-populated with all contact phones; correct number pre-selected.
3. Duration auto-filled from call session (if FUB dialer call); manual input allowed for external calls.
4. Outcome dropdown includes all 6 options; "Submit" disabled until outcome is selected.
5. Notes textarea pre-populated with notes taken during live call.
6. Submit creates `crm_timeline` event (type `call`) and returns to contact detail.
7. Cancel does not create any timeline event.

---

## S10 — Compliance Suppression Gate (ALL channels) **[INFERRED — BASIS: §17.6, §17.3.5, §17.3.12, texting.md §2, emailing.md §12]**

### Purpose
Non-negotiable pre-send gate that checks the contact's compliance state before any outbound message is transmitted. Fires synchronously before every email, SMS, or AI-generated message send. Non-dismissible errors block send entirely.

### Gate evaluation order

Every send path calls this sequence before transmitting:

```typescript
async function runSuppressionGate(
  contactId: number,
  channel: 'email' | 'sms',
  messageType: 'direct' | 'marketing' | 'batch' | 'action_plan'
): Promise<{ allowed: boolean; reason?: string }> {

  const contact = await getContactCompliance(contactId)
  // contact includes: email_opt_out, text_opt_out, tags[], phone_status, email_status

  // 1. HARD STOP — blocks all channels, all message types
  if (contact.tags.includes('contact:hard-stop') ||
      contact.tags.includes('compliance:hard-stop')) {
    return { allowed: false, reason: 'HARD_STOP' }
  }

  // 2. DO NOT CONTACT
  if (contact.tags.includes('contact:do-not-contact')) {
    return { allowed: false, reason: 'DO_NOT_CONTACT' }
  }

  // 3. Channel-specific: SMS
  if (channel === 'sms') {
    // A2P not registered
    if (!account.a2p_registered) {
      return { allowed: false, reason: 'A2P_NOT_REGISTERED' }
    }
    // Number warming up
    if (contact.assigned_phone_status === 'warming_up') {
      return { allowed: false, reason: 'NUMBER_WARMING_UP' }
    }
    // Text opt-out
    if (contact.text_opt_out) {
      return { allowed: false, reason: 'TEXT_OPT_OUT' }
    }
    // Do not text tag
    if (contact.tags.includes('contact:do-not-text')) {
      return { allowed: false, reason: 'DO_NOT_TEXT' }
    }
    // TCPA litigator
    if (contact.tags.includes('compliance:tcpa-litigator')) {
      return { allowed: false, reason: 'TCPA_LITIGATOR' }
    }
    // Deceased
    if (contact.tags.includes('contact:deceased')) {
      return { allowed: false, reason: 'DECEASED' }
    }
    // Quiet hours (not a block — queues instead)
    if (!options.overrideQuietHours && isInQuietHours(broker.timezone)) {
      return { allowed: false, reason: 'QUIET_HOURS', action: 'QUEUE' }
    }
  }

  // 4. Channel-specific: Email
  if (channel === 'email') {
    // Direct 1:1 — allow even if unsubscribed
    if (messageType === 'direct') {
      return { allowed: true }
    }
    // Marketing / Batch / Action Plan — block if unsubscribed OR bounced
    if (contact.email_unsubscribed && messageType !== 'direct') {
      return { allowed: false, reason: 'EMAIL_UNSUBSCRIBED' }
    }
    if (contact.email_bounced && messageType !== 'direct') {
      return { allowed: false, reason: 'EMAIL_BOUNCED' }
    }
    // Do not email tag
    if (contact.tags.includes('contact:do-not-email')) {
      return { allowed: false, reason: 'DO_NOT_EMAIL' }
    }
  }

  return { allowed: true }
}
```

### Mobile UI — error display per reason

All errors are **non-dismissible** until the contact's compliance state changes. Display as a full-width red alert banner replacing the compose bar, OR as a modal blocker with a single "OK" button.

| Reason code | Error message shown to broker | Color |
|---|---|---|
| `HARD_STOP` | "This contact is flagged as a compliance hard stop. No messages can be sent." | `bg-destructive` `#EF4444` |
| `DO_NOT_CONTACT` | "This contact is marked Do Not Contact." | `bg-destructive` |
| `TEXT_OPT_OUT` | "This contact has opted out of text messages (replied STOP)." | `bg-destructive` |
| `DO_NOT_TEXT` | "This contact is marked Do Not Text." | `bg-destructive` |
| `TCPA_LITIGATOR` | "This contact has litigation risk. Texting is blocked." | `bg-destructive` |
| `A2P_NOT_REGISTERED` | "Business registration (A2P 10DLC) required before sending texts. Contact your admin." | `bg-warning text-warning-foreground` |
| `NUMBER_WARMING_UP` | "Your FUB number is warming up. Calls are available; texting will be enabled soon." | `bg-warning` |
| `EMAIL_UNSUBSCRIBED` | "This contact unsubscribed from marketing emails. Direct 1:1 emails may still be sent." | `bg-warning` |
| `EMAIL_BOUNCED` | "This email address has bounced. Marketing emails are blocked." | `bg-warning` |
| `QUIET_HOURS` (QUEUE action) | Toast: "Quiet hours — message queued for 8am" | `bg-muted` |
| `DECEASED` | "This contact is marked deceased. No messages can be sent." | `bg-destructive` |

### Compliance indicator on contact profile

When any suppression flag is active, display a compliance badge on the contact hero card:
- Color pill: `bg-destructive` red for hard stops; `bg-warning` amber for soft blocks
- Text: "Do Not Text" / "Unsubscribed" / "Hard Stop" / etc.
- Clicking the pill → opens a compliance detail sheet showing which flags are set and when

### First-touch SMS compliance check **[per §17.3.4 + texting.md §17]**

For the first outbound SMS to a contact with no prior text history:
1. Check template body includes: agent name + company name + purpose + a question
2. If missing: show inline warning banner (NOT a block): "First contact should include your name, company name, purpose, and a question. Templates tagged for first contact include this automatically."
3. CTIA opt-out reminder: first message should include "Reply STOP to unsubscribe"

### Acceptance criteria (S10)

1. Every SMS and email send path calls `runSuppressionGate()` before any API call.
2. `HARD_STOP` and `DO_NOT_CONTACT` block all channels with non-dismissible destructive alert.
3. `TEXT_OPT_OUT` blocks SMS but does NOT block email; correct per-channel error shown.
4. `EMAIL_UNSUBSCRIBED` blocks marketing/batch/action-plan emails; direct 1:1 email still allowed.
5. `QUIET_HOURS` queues the message (not blocks); toast shows scheduled delivery time; checkbox override bypasses.
6. `A2P_NOT_REGISTERED` shows warning with guidance to contact admin.
7. Compliance badges render on contact hero when suppression flags are set.
8. First-touch SMS shows compliance reminder banner (non-blocking) if template lacks required elements.
9. Phone numbers showing in orange in contact sidebar = `text_opt_out = true` or `email_bounced = true` (orange = `text-warning`).
10. TCPA litigator contacts show hard stop for SMS; zero exceptions.

---

## Design Token Mapping (FUB → Ryan Realty)

| Element | FUB hex | FUB purpose | Ryan Realty token | In-house hex |
|---|---|---|---|---|
| Header / nav bar bg | `#3d4a56` / `#3D4F5C` | FUB dark slate-teal | `bg-primary` | `#102742` |
| Header text + icons | `#FFFFFF` | White | `text-primary-foreground` | `#faf8f4` |
| FUB accent (CC/BCC, Templates, chips) | `#2D9CDB` teal | FUB blue accent | `text-primary` | `#102742` |
| Send button | `#3b9ed4` / `#3B82F6` | FUB blue | `bg-primary` | `#102742` |
| AI chip — selected | Gradient `#A855F7→#7C3AED` | FUB violet | `bg-primary` | `#102742` navy fill |
| AI chip — unselected | `#FFFFFF` bg, `#D1D5DB` border | | `bg-background border-border` | |
| Recipient token text | `#5b7a94` | Muted blue | `text-primary` | `#102742` |
| Template pill border | `#1a1a2e` | Near-black | `border-foreground` | `#102742` |
| Row dividers | `#E5E5EA` | iOS gray | `border-border` | |
| Label / secondary text | `#8E8E93` / `#9E9E9E` | iOS gray | `text-muted-foreground` | |
| Body text | `#1C1C1E` / `#1A1A1A` | Near-black | `text-foreground` | |
| Card background | `#FFFFFF` | White | `bg-card` | `#FFFFFF` |
| Input background | `#F5F5F5` | Light gray | `bg-muted` | |
| Page background | `#F2F2F7` / `#F5F5F5` | iOS grouped bg | `bg-background` | `#faf8f4` |
| Compliance destructive | `#EF4444` / `#FF3B30` | Red | `bg-destructive` | |
| Compliance warning | `#F59E0B` / amber | Amber | `bg-warning text-warning-foreground` | |
| Email bounce / opt-out indicator | Orange (FUB) | Orange text | `text-warning` | |
| CRM action FAB | `#2563eb` / `#4A90E2` | Action blue | `bg-accent` | (use CRM accent; not brand navy) |
| Quiet-hours "still available" state | `#38b2ac` teal | Teal pill | `bg-success` | |
| Section label uppercase text | Gray, 11 pt, tracking | Section header style | `text-muted-foreground text-xs uppercase tracking-widest font-medium` | |

**Font system:** Replace all FUB San Francisco (iOS system) with:
- UI / body / inputs: `Geist` (400/500/600)
- Display labels (section headers IF using display style): `Geist` 500 all-caps
- Brand wordmark only: `Amboqia Boriango`
- Merge field chip labels: `ui-monospace, 'Courier New', monospace` (intentional — marks them as code tokens)

**Border radius:** Use design-system ladder — inputs/buttons `lg` (10 pt / 8 pt), cards `xl` (14 pt / 12 pt), pills `rounded-full`. Do NOT use raw pt values from FUB analysis in production CSS — map to design system ladder.

---

## Cross-references

- **§26 — Mobile Inbox and Conversations** (26-mobile-inbox-and-conversations.md): The conversation thread (S3) is part of the Inbox flow; compose overlays that inbox view.
- **§25 — Mobile Contact Detail** (25-mobile-contact-detail.md): The Comms sub-tab (S5, S6, S7) lives inside the contact detail shell; sub-tab strip and contact hero card are specified there.
- **§07c** (07c-person-detail-compose-modals-and-right-rail.md): Desktop compose bar, template chips, merge fields, email signature — mobile inherits all data model and business rules from this spec.
- **§17** (17-communications-and-compliance.md): Unified timeline writes, email sync, quiet hours, opt-out handling, Twilio architecture, A2P gates — the compliance layer (S10) implements §17.6.
- **§28 — Mobile Pickers, Modals, and Action Sheets** (28-mobile-pickers-modals-and-action-sheets.md): The attachment picker sheet (S4) and template picker sheets are catalogued there as reusable sheet patterns.
- **§29 — Mobile Calendar and Tasks** (29-mobile-calendar-and-tasks.md): Log Call (S9) creates a `call` timeline event; call scheduling references appointment reminder texts (§17.3.15).
- **emailing.md**: Merge field token taxonomy, signature requirements, 1:1 vs marketing email distinction, batch limits.
- **texting.md**: A2P registration, quiet hours, opt-out keywords (STOP/UNSUBSCRIBE/CANCEL/END/QUIT), carrier filtering triggers, first-touch compliance, vCard rules.
- **calling.md**: Calling method selector (Internet vs. Mobile), Twilio bridge behavior, iOS setup steps.

---

## Sources

### Observed (real screenshots)
| mob-NN | Content | Key findings |
|---|---|---|
| mob-41 | FUB iOS email compose | Exact fields (To, Subject, CC/BCC toggle), signature layout (two-column headshot + text), Templates bar, header bg `#3d4a56`, "Send" button right |
| mob-43 | FUB iOS SMS Select Recipients | AI template pill row (✦ Introduction, ✦ Follow Up, + Custom), recipient token pill style, send button `#3b9ed4`, input placeholder "Text message • SMS" |
| mob-40 | FUB iOS AI conversation thread | AI chip strip with selected purple chip "✦ Follow Up", verbatim AI draft text, compose row layout (+, textarea, ↑ send), contact nav bar with phone + kebab icons |
| mob-39 | FUB iOS SMS attachment picker sheet | 6-row sheet (Photo Library, Video Library, Take picture, Record video ÷ Send vCard, Use template), row heights ~58 pt, icon stroke style, drag handle, `#2e4a58` nav |
| mob-48 | In-house web email compose card | Channel selector ("EMAIL · MATT@RYAN-REALTY.COM"), template dropdown "Blank email" + ⇅ icon, merge field chips (First name, Seller property address, Property address, Address short, CMA link) in monospace pill style, "Preview, what sends" + "Edit" button |
| mob-57 | In-house web email + merge fields expanded | Quick action pill grid (Newsletter, Automations, Saved searches, Market reports), merge field categories CONTACT/PROPERTY visible, sub-tab strip, contact hero dark band |
| mob-58 | In-house web SMS + Note + Email engagement | TEXT section label + phone link, "Blank sms" template picker, recipient dark pill ("Lead annaasmith664@gmail.com"), message input with gray disabled send button, "Send anyway (quiet hours)" checkbox, ADD A NOTE textarea + "Save note" button, Email engagement empty state |

### Inferred (no screenshot — reconstructed from desktop spec + docs)
| Screen | Basis |
|---|---|
| S8 Click-to-Call + Live Call | §17.4 (calling architecture), calling.md §3–5 (iPhone calling), mob-39/mob-40 nav bar phone icon trigger, §17.4.3 (inbound routing) |
| S9 Log Call form | §07c.5 (desktop Log Call mode), §17.4.2 (click-to-call), calling.md (auto-log on completion) |
| S10 Compliance gate | §17.6 (suppression check), §17.3.5 (SMS flow), §17.3.6 (quiet hours), §17.3.12 (opt-out), texting.md §2 (A2P gate), emailing.md §12 (unsubscribes), project memory (TCPA litigator handling, A2P verified) |
| S2 "Done" advances to body compose | §07c.4.1 (desktop text compose flow), mob-43 (shows compose bar, not body — body is next step) |
| S5/S6 "Send Email" button | mob-48/57 scroll below viewport; confirmed by §07c.3 desktop pattern |

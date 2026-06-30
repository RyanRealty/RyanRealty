<!-- Mobile per-screen appendix. Original: IMG_6011.PNG | id: mob-43 | tiles: mob-tiles/mob-43_{full,t,m,b}.png -->

# mob-43 — fub-ios — SMS Compose / Select Recipients

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal/slate header, white text, FUB compose pattern)
- **module:** Compose (email / text / call) — SMS path
- **screen:** "Select Recipients" modal — the contact-token recipient picker for an outbound SMS thread
- **how to reach:** From a contact's detail page or the Inbox tab, tap the SMS / text compose action → this modal sheet slides up. It is presented modally (Cancel / Done pattern), sitting on top of the previous screen.
- **iOS status bar:** 6:54 · signal bars (3/4) · 5G · battery 21% (yellow warning fill)
- **URL bar:** N/A (native app)

---

## Screen regions (y-bands, 390×844 pt logical)

| Region | Approx y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | #3d5060 (dark teal/slate — matches header) |
| Nav / header bar | 54–98 | 44 pt | #3d5060 (dark teal/slate) |
| To: recipient token row | 98–142 | 44 pt | #ffffff |
| Hairline divider | 142–143 | 1 pt | #d1d5db (light gray) |
| Empty recipient search area | 143–530 | ~387 pt | #ffffff |
| AI template pill row | 530–580 | ~50 pt | #ffffff (slight top shadow/separator) |
| SMS compose input bar | 580–632 | ~52 pt | #ffffff |
| iOS keyboard (Wispr Flow) | 632–844 | ~212 pt | #d1d5db (system keyboard gray) |

> Note: No bottom tab bar is visible — the keyboard is active and fully covers the tab bar area. This is a modal sheet so the tab bar from the presenting screen is hidden behind the overlay.

---

## Nav / header bar (exact)

- **Background:** dark teal/slate ~#3d5060 (FUB's characteristic dark header — not quite navy #102742, lighter with a blue-gray teal cast)
- **Left control:** Text button "Cancel" — white, system font weight regular, ~17 pt. Tap: dismisses modal without saving recipient selection, returns to the previous screen.
- **Center title:** "**Select Recipients**" — white, bold (~17 pt, semibold). No subtitle. No dropdown/filter chevron.
- **Right control:** Text button "Done" — white, system font weight regular, ~17 pt. Tap: confirms the current recipient token(s) and advances to the SMS compose body view.

---

## Bottom tab bar (exact)

**Not visible in this screenshot** — the iOS software keyboard is raised and occupies the bottom of the screen, covering the tab bar. This is a modal sheet; the underlying tab bar belongs to the presenting screen beneath the modal overlay.

For reference (standard FUB iOS tab bar): Inbox · Activity · Calendar · People · Deals — none active in this modal context.

**No FAB** visible on this screen.

---

## Content — every element, in order

### 1. To: recipient token row (y ~98–142 pt)

- **"To:"** label — left-aligned, ~15 pt, medium weight, color ~#6b7280 (gray)
- **Recipient token pill — "Andy Christensen"**
  - Rounded-rectangle pill shape, ~radius 16 pt
  - Border: ~1.5 pt solid #8fa3b8 (blue-gray, muted teal-slate)
  - Background: white (transparent/white)
  - Text: "Andy Christensen" — ~#5b7a94 (muted teal-blue), ~15 pt, medium weight
  - The pill is tappable: tap to deselect/remove this recipient token
  - Positioned immediately after the "To:" label with ~8 pt gap
- **Hairline divider** below the row: 1 pt, #e5e7eb

### 2. Empty recipient search / suggestion area (y ~143–530 pt)

- **Background:** solid white #ffffff
- **Contents:** completely empty — no contacts list, no search bar placeholder, no empty-state illustration or text
- **Behavior [INFERRED]:** This area would normally show a search field or auto-suggested contact list for adding more recipients. At this moment, "Andy Christensen" has already been selected, and the user has not typed to search for additional recipients. Tapping in this area likely invokes a contact search field.

### 3. AI template pill row (y ~530–580 pt)

Horizontally scrollable row of template preset pills. The row has a subtle top separator line (~#e5e7eb) and white background. Three pills visible; a fourth is partially clipped at right edge (indicated by cropping in the full screenshot).

| Pill | Icon | Label | Style |
|---|---|---|---|
| 1 | ✦ (sparkle/AI 4-pointed star glyph) | "Introduction" | Outlined pill, border ~#1a1a2e dark, white bg, black text |
| 2 | ✦ (sparkle/AI 4-pointed star glyph) | "Follow Up" | Outlined pill, border ~#1a1a2e dark, white bg, black text |
| 3 | + (plus sign) | "Custom" | Outlined pill, border ~#1a1a2e dark, white bg, black text |
| 4 | (partially visible, clipped at right edge) | (unknown) | — |

- **Pill shape:** fully rounded (pill/stadium), height ~36 pt, horizontal padding ~16 pt
- **Border:** ~1 pt solid dark (#1a1a2e or #000000)
- **Background:** white
- **Text + icon color:** black (~#000000 / #1a1a2e), ~14 pt, medium weight
- **Sparkle icon:** 4-pointed star/sparkle glyph indicating AI-generated template content (FUB AI writing assist feature)
- **Tap behavior [INFERRED]:** Tapping "Introduction" or "Follow Up" pre-fills the SMS compose field with an AI-generated message template appropriate to that context. Tapping "+ Custom" opens a custom template picker or blank compose.
- **Scroll behavior [INFERRED]:** Row horizontally scrollable; more pills exist to the right (the row overflows the viewport).

### 4. SMS compose input bar (y ~580–632 pt)

Three elements in a horizontal row:

**a. "+" attachment/media button (left)**
- Circle button, diameter ~36 pt
- Background: ~#e5e7eb (light gray)
- Icon: "+" (plus sign), color ~#6b7280 (medium gray)
- Tap behavior [INFERRED]: Opens attachment/media picker (photos, files, etc.) to attach to SMS/MMS

**b. Text message input field (center)**
- Rounded input pill, flex-grows to fill available width, height ~44 pt, radius ~22 pt
- Background: white, border ~#d1d5db
- Placeholder text: "Text message • SMS" — color ~#9ca3af (gray), ~15 pt
- Currently empty (keyboard is active but no text typed yet)
- Tap: focuses field, keyboard remains up

**c. Send / submit button (right, inside or adjacent to input pill)**
- Circle button, diameter ~36 pt
- Background: ~#3b9ed4 (medium blue, FUB's send accent)
- Icon: arrow pointing upward (↑), white, ~18 pt
- Active/enabled state — visible even with empty input (may be enabled because recipient is selected)
- Tap [INFERRED]: sends the composed SMS to the selected recipient(s)

### 5. Wispr Flow keyboard toolbar (y ~632–660 pt approximate)

This is the accessory/toolbar row sitting above the keyboard keys, part of the Wispr Flow 3rd-party iOS keyboard extension:

- **Left:** "≡" hamburger/menu icon — 3 horizontal lines, dark gray/black, ~20 pt. Tap [INFERRED]: opens Wispr Flow settings/options menu.
- **Right:** Black pill button with label "Start" + waveform/bar-chart icon (▐▐▌ — audio waveform bars). Background: #000000 (black), text: white, ~15 pt. Tap [INFERRED]: activates Wispr Flow dictation/voice-to-text recording mode.

### 6. iOS QWERTY keyboard (y ~660–844 pt)

Standard iOS software keyboard in light/default theme:
- **Background:** #d1d5db (system keyboard gray)
- **Key background:** white (#ffffff) with subtle shadow
- **Key text color:** #000000
- **Layout:** QWERTY — rows: q w e r t y u i o p / a s d f g h j k l / ⇧ z x c v b n m ⌫
- **Bottom row:** "123" (numbers/symbols toggle) · "Wispr Flow" (space bar, labeled with 3rd-party keyboard name) · "↵" (return key)
- **Globe icon (bottom-left):** keyboard language/switch icon — tap to switch keyboards
- No autocorrect bar visible above keyboard (space occupied by Wispr Flow toolbar)

---

## Colors, type & iconography

| Element | Color (hex estimate) | Notes |
|---|---|---|
| Header background | #3d5060 | Dark teal-slate; FUB's characteristic header — not navy #102742 |
| Header text (Cancel, title, Done) | #ffffff | White |
| Recipient token border | #8fa3b8 | Muted blue-gray |
| Recipient token text | #5b7a94 | Muted teal-blue |
| "To:" label | #6b7280 | System gray |
| Template pill border | #1a1a2e | Very dark (near-black) |
| Template pill text/icon | #000000 | Black |
| Send button background | #3b9ed4 | FUB blue accent |
| Send button icon | #ffffff | White arrow |
| "+" attachment button bg | #e5e7eb | Light gray |
| "+" attachment button icon | #6b7280 | Medium gray |
| Wispr Flow "Start" pill bg | #000000 | Black |
| Input placeholder text | #9ca3af | Gray |
| Hairline dividers | #e5e7eb | Very light gray |
| Keyboard background | #d1d5db | System keyboard gray |
| Keyboard key background | #ffffff | White |

**Font impressions:**
- Header title: SF Pro Display semibold, ~17 pt, white
- Cancel / Done: SF Pro Text regular, ~17 pt, white
- "To:" label: SF Pro Text medium, ~15 pt, #6b7280
- Recipient token: SF Pro Text medium, ~15 pt, #5b7a94
- Template pill labels: SF Pro Text medium, ~14 pt, #000000
- Input placeholder: SF Pro Text regular, ~15 pt, #9ca3af
- Keyboard keys: SF Pro Text, system sizing

**Iconography:**
- Template sparkle icon: 4-pointed star (✦) — FUB's AI-assist indicator glyph
- Send button: upward arrow (↑) in white on blue circle
- Attachment: "+" on light gray circle
- Wispr Flow dictation: bar-chart waveform glyph (▐▐▌)
- Wispr Flow menu: triple horizontal bars (≡)
- Keyboard return: bent arrow (↵)
- Shift: hollow up-arrow (⇧)
- Backspace: ← with X inside box (⌫)
- Globe: filled globe outline (keyboard language switch)

---

## Interactions & gestures (mark [INFERRED])

| Target | Action | Result |
|---|---|---|
| "Cancel" button | Tap | Dismisses the Select Recipients modal without changes; returns to previous screen [INFERRED] |
| "Done" button | Tap | Confirms recipient selection ("Andy Christensen"); advances to SMS body compose view [INFERRED] |
| Recipient token "Andy Christensen" | Tap | Deselects / removes the token from the To: field [INFERRED] |
| Empty search area | Tap | Focuses a contact search field; keyboard may show suggestions / contact list [INFERRED] |
| "Introduction" pill | Tap | Pre-fills SMS input with AI-generated introduction message [INFERRED] |
| "Follow Up" pill | Tap | Pre-fills SMS input with AI-generated follow-up message [INFERRED] |
| "+ Custom" pill | Tap | Opens custom template picker or blank template creation flow [INFERRED] |
| Template pill row | Swipe left/right | Scrolls horizontally to reveal more template options [INFERRED] |
| "+" (attachment) button | Tap | Opens iOS media/file picker for MMS attachment [INFERRED] |
| SMS input field | Tap | Keyboard focus (already focused); begin typing message body |
| Send button (↑) | Tap | Sends the SMS to selected recipient(s) [INFERRED] |
| "≡" Wispr menu | Tap | Opens Wispr Flow keyboard settings overlay [INFERRED] |
| "Start" dictation pill | Tap | Activates Wispr Flow voice dictation — transcribes speech to text in the SMS field [INFERRED] |
| Globe icon | Tap | Switches iOS keyboard language/input method [INFERRED] |
| Whole screen | Pull down (swipe from top of modal) | Dismisses the modal sheet (iOS swipe-to-dismiss gesture) [INFERRED] |

---

## Build notes (component tree)

```
<SMSComposeModal>

  <IOSStatusBar
    time="6:54"
    signal="4bar_5G"
    battery={21}
    batteryColor="yellow"
    bg="#3d5060"
  />

  <ModalHeader
    bg="#3d5060"
    left={
      <TextButton label="Cancel" color="#fff" onPress={dismissModal} />
    }
    center={
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 17 }}>
        Select Recipients
      </Text>
    }
    right={
      <TextButton label="Done" color="#fff" onPress={confirmRecipients} />
    }
  />

  {/* Recipient token row — h ~44pt */}
  <RecipientRow>
    <Label text="To:" color="#6b7280" fontSize={15} />
    <RecipientTokenList>
      {/* Each selected contact renders as a pill */}
      <RecipientToken
        name="Andy Christensen"
        textColor="#5b7a94"
        borderColor="#8fa3b8"
        borderWidth={1.5}
        borderRadius={16}
        bg="transparent"
        onPress={removeRecipient}
      />
      {/* Additional tokens or a live search input would render here */}
    </RecipientTokenList>
  </RecipientRow>

  <Divider color="#e5e7eb" height={1} />

  {/* Contact search / suggestion area — expands to fill space above compose bar */}
  <ContactSearchArea
    bg="#ffffff"
    flex={1}
    {/* Empty state: no illustration, no text — blank white */}
    emptyState={null}
    {/* Would populate with search results or recent contacts as user types */}
    onContactSelect={addRecipientToken}
  />

  {/* AI template quick-action pill row */}
  <TemplatePillRow
    horizontal
    scrollable
    separator={{ top: true, color: '#e5e7eb' }}
    bg="#ffffff"
    paddingVertical={8}
    paddingHorizontal={12}
    gap={10}
  >
    <TemplatePill icon="sparkle" label="Introduction" onPress={insertIntroTemplate} />
    <TemplatePill icon="sparkle" label="Follow Up" onPress={insertFollowUpTemplate} />
    <TemplatePill icon="plus" label="Custom" onPress={openCustomTemplatePicker} />
    {/* Additional pills hidden, scroll to reveal */}
  </TemplatePillRow>

  {/* SMS compose input bar */}
  <SMSInputBar
    paddingHorizontal={12}
    paddingVertical={8}
    bg="#ffffff"
    flexDirection="row"
    alignItems="center"
    gap={8}
  >
    <AttachmentButton
      icon="plus"
      bg="#e5e7eb"
      iconColor="#6b7280"
      size={36}
      shape="circle"
      onPress={openAttachmentPicker}
    />
    <TextInput
      placeholder="Text message • SMS"
      placeholderTextColor="#9ca3af"
      flex={1}
      height={44}
      borderRadius={22}
      borderColor="#d1d5db"
      borderWidth={1}
      paddingHorizontal={16}
      fontSize={15}
      bg="#ffffff"
      value={messageBody}
      onChangeText={setMessageBody}
      multiline
      returnKeyType="send"
    />
    <SendButton
      icon="arrow-up"
      bg="#3b9ed4"
      iconColor="#ffffff"
      size={36}
      shape="circle"
      disabled={false}
      onPress={sendSMS}
    />
  </SMSInputBar>

  {/* iOS system keyboard — rendered natively by iOS */}
  {/* Wispr Flow keyboard extension overlays the toolbar row above keys */}
  <WisprFlowKeyboardToolbar>
    <MenuIcon icon="hamburger" size={20} color="#1a1a1a" onPress={openWisprMenu} />
    <DictationButton
      label="Start"
      icon="waveform-bars"
      bg="#000000"
      textColor="#ffffff"
      borderRadius={22}
      paddingHorizontal={16}
      onPress={startWisprDictation}
    />
  </WisprFlowKeyboardToolbar>

  <IOSKeyboard
    type="qwerty"
    theme="light"
    spaceBarLabel="Wispr Flow"
    showGlobeKey
  />

</SMSComposeModal>
```

### Data bindings
| Component | Data source |
|---|---|
| `RecipientToken name` | `contact.displayName` resolved from FUB contacts |
| `TemplatePill` templates | FUB AI template API (Introduction / Follow Up variants) |
| `TextInput value` | Local compose state `messageBody: string` |
| `SendButton disabled` | `messageBody.trim().length > 0 || recipients.length > 0` |
| `ContactSearchArea results` | FUB contacts search API, filtered by search query |

### Spacing / sizing reference (390 pt wide canvas)
- Header bar height: 44 pt (plus 54 pt status bar = 98 pt total from top)
- Recipient row height: ~44 pt
- Token pill height: ~32 pt, border-radius: ~16 pt
- Template pill row height: ~52 pt (pill height ~36 pt + 8 pt vertical padding each)
- SMS input bar height: ~60 pt
- Input field height: ~44 pt, border-radius: 22 pt
- Attachment/send button size: 36×36 pt circle
- Keyboard toolbar height: ~44 pt
- QWERTY keyboard height: ~216 pt (standard iOS landscape-up height)

### Re-build considerations
1. **Modal presentation:** Use a bottom-sheet or full-screen modal. On web, `position: fixed; inset: 0` with slide-up animation.
2. **Recipient tokens:** Implement as a flex-wrap row with `<input>` for live search immediately after the last token. Use an accessible combobox pattern (ARIA role="combobox").
3. **Template pills:** Horizontal `overflow-x: auto` scrollable flex row with `scroll-snap-type: x mandatory` for pill alignment.
4. **Keyboard avoidance:** On mobile web, use `env(keyboard-inset-height)` CSS env variable or `visualViewport` resize event to push the compose bar above the virtual keyboard.
5. **FUB accent color:** The send button blue (#3b9ed4) is FUB's brand blue, distinct from Ryan Realty navy (#102742). In the in-house rebuild, use the design system primary (#102742) for the send button and accent elements.
6. **Wispr Flow toolbar:** This is a 3rd-party keyboard extension — not reproduced in the web rebuild. The web equivalent would be a browser-native dictation button (`<button>` invoking `SpeechRecognition` API).

<!-- Mobile per-screen appendix. Original: IMG_6005.PNG | id: mob-38 | tiles: mob-tiles/mob-38_{full,t,m,b}.png -->

# mob-38 — fub-ios — SMS Conversation Thread (Empty State)

## Identity

- **app_source:** fub-ios (native Follow Up Boss iOS app — confirmed by dark slate header, orange initials avatar, FUB AI-suggestion pill row with sparkle icon, FUB phone + kebab right controls, no browser chrome)
- **module:** Inbox / Conversations
- **screen:** SMS/Text message conversation thread for contact "Andy Christensen" — empty state (zero messages exchanged)
- **how to reach:** Inbox tab → tap an SMS conversation row for Andy Christensen; OR from Andy Christensen's contact/lead profile → tap the SMS/text action button
- **iOS status bar:** Time 6:51 (left), signal bars (4 bars full) + "5G" + battery icon showing 23% (yellow — low charge) (right)
- **URL bar:** N/A — native iOS app, no browser chrome

---

## Screen regions (top → bottom, logical 390×844 pt)

| Region | Approx y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS Status Bar | 0–54 | 54 | Dark slate ~#3B4D5C (same as header, no break) |
| Nav / Header Bar | 54–110 | 56 | Dark slate ~#3B4D5C |
| Scrollable message content area | 110–746 | 636 | White #FFFFFF (empty — no messages) |
| AI suggestion pill strip | 746–796 | 50 | White #FFFFFF, card panel with top rounded corners (radius ~12 pt) |
| Compose / input row | 796–844 | 48 | White #FFFFFF (sits above home indicator area) |
| Home indicator bar | 844–~878 | ~34 | White #FFFFFF |

**Note:** The bottom compose area (AI pills + input row) is a floating card panel anchored to the bottom of the screen above the system home indicator. It has a top-left and top-right rounded corner (~12 pt radius) and a very subtle top shadow/border separator from the white message area.

---

## Nav / Header bar (exact)

**Background:** Dark slate/muted teal — estimated hex #3A4D5C (same family as FUB's standard dark header, not pure navy #102742)

**Left control:** White left-pointing chevron `<` — back navigation; returns to the Inbox conversation list

**Center cluster (all inline, horizontally centered):**
- Orange filled circle avatar, ~34 pt diameter, white initials **"AC"** in medium-weight sans (approximately 14 pt). Orange: ~#C0621A (burnt orange/amber-brown)
- Contact name: **"Andy Christensen"** — white, ~17 pt, semibold
- Right-pointing chevron `>` — white, smaller than back chevron (~10 pt) — tapping navigates to Andy Christensen's full contact/lead profile

**Right controls (left to right):**
1. Phone/handset icon — white filled glyph (~22 pt touch target) — initiates a call to the contact
2. Three-dot horizontal kebab `···` — white, three evenly-spaced dots — opens contextual action sheet (archive, mark unread, snooze, view contact, etc.)

---

## Bottom tab bar

**Not visible.** This is a pushed navigation view (drilled into from the Inbox list). The standard FUB bottom tab bar (Inbox / Activity / Calendar / People / Deals) is absent — suppressed by the navigation stack push. No FAB present either.

---

## Content — every element, in order

### Scrollable message content area (y ~110–746)

**State:** Completely empty — pure white canvas. No messages, no date dividers, no system messages, no "conversation started" placeholder. The thread has zero history.

**Empty state rendering:** Solid white background with no illustration, no instructional copy, and no loading indicator. The emptiness is intentional — the user lands here to compose the first outbound SMS.

---

### Compose panel (y ~746–844+)

The compose panel is a white floating card that sits above the keyboard (keyboard is not shown — the field is unfocused). It contains two rows.

#### Row 1 — AI suggestion pills (y ~750–796)

A horizontally scrollable strip of pill-shaped suggestion buttons. Pills are visible left-to-right:

| # | Icon | Label | Notes |
|---|---|---|---|
| 1 | Sparkle asterisk (✦ — 4-point star burst, ~12 pt) | **Introduction** | Full pill visible |
| 2 | Sparkle asterisk (✦ — same icon) | **Follow Up** | Full pill visible |
| 3 | Plus sign `+` (no sparkle) | **Custom** | Full pill visible |
| 4 | (unknown — cut off at right edge) | (unknown) | Partially visible — at least one more pill off-screen to the right |

**Pill style:** Outlined pill shape — border ~1–1.5 pt, color dark gray/near-black (~#2D2D2D), background white, corner radius pill (fully rounded). Label text: dark near-black, ~14 pt, medium weight. Icon sits inline to left of label text. Pill height ~34 pt.

**Behavior [INFERRED]:** Tapping "Introduction" or "Follow Up" opens an AI-generated SMS draft pre-populated with FUB's built-in introduction or follow-up template for the contact, editable before send. Tapping "Custom" opens a free-form AI prompt input or a custom template selector. The strip scrolls horizontally to reveal additional pill options.

#### Row 2 — Compose input row (y ~796–844)

Three elements inline, left to right:

1. **Attachment/Media button:** Gray filled circle (~34 pt diameter, ~#D1D1D6 background), white `+` plus icon centered. Tap opens a media/attachment picker (photo, document, etc.) for MMS.

2. **Text input field:** Rounded rectangle, occupies most of the width, border ~1 pt light gray (~#C7C7CC), background white, corner radius ~18 pt (pill-shaped). Placeholder text: **"Text message · SMS"** — light gray, ~15 pt regular weight. The bullet separator `·` between "Text message" and "SMS" distinguishes the channel type.

3. **Send button:** Solid light blue circle (~34 pt diameter), white upward-pointing arrow `↑` centered. Blue: estimated ~#4DAFDF or ~#5BB4E0 (FUB's standard send button color, a soft/bright medium blue). Currently active/enabled despite no text in the field (this is the default FUB rendering — the button is always shown).

**Inset / spacing:** ~8 pt horizontal padding from screen edges. ~6 pt gap between attachment button and input field. ~6 pt gap between input field right edge and send button.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar background | ~#3A4D5C (dark slate-teal, FUB brand dark) |
| Header text (contact name) | #FFFFFF white, ~17 pt semibold |
| Header back chevron | #FFFFFF |
| Header phone icon | #FFFFFF filled handset glyph |
| Header kebab dots | #FFFFFF |
| Contact avatar circle | ~#C0621A burnt orange |
| Avatar initials | #FFFFFF, ~14 pt medium |
| Contact name chevron `>` | #FFFFFF, ~10–11 pt |
| Message area bg | #FFFFFF |
| Compose panel bg | #FFFFFF |
| Suggestion pill border | ~#2B2B2B near-black |
| Suggestion pill text | ~#1C1C1E near-black, ~14 pt medium |
| Sparkle icon (AI pills) | #000000 or ~#1C1C1E |
| Attachment button circle | ~#D1D1D6 light gray |
| Attachment button `+` | #FFFFFF |
| Input field border | ~#C7C7CC light gray |
| Input placeholder text | ~#8E8E93 mid-gray |
| Send button circle | ~#4DAFDF / #5BB4E0 light blue |
| Send button arrow | #FFFFFF |
| Battery indicator | Yellow (~#FFD60A) — low battery warning |

**Note on accent color:** FUB's blue/teal accent (send button, links, active tabs) is a soft sky-blue (~#4EB6E5), not the in-house navy #102742 or cream #faf8f4. This confirms fub-ios, not inhouse-web.

**Font impression:** System San Francisco throughout; no custom brand fonts.

---

## Interactions & gestures [INFERRED]

| Target | Action | Result |
|---|---|---|
| Back chevron `<` | Tap | Pop to Inbox conversation list |
| Avatar + name + `>` cluster | Tap | Push to Andy Christensen's full lead/contact profile screen |
| Phone handset icon | Tap | Initiate FUB in-app call (or native dialer) to contact's primary phone |
| Kebab `···` | Tap | Bottom action sheet: Archive, Mark as Unread, Snooze, Assign, View Contact, Block |
| AI pill "Introduction" | Tap | Populates input field with AI-drafted introduction SMS |
| AI pill "Follow Up" | Tap | Populates input field with AI-drafted follow-up SMS |
| AI pill "+ Custom" | Tap | Opens AI prompt modal or custom template picker |
| Pill strip | Swipe left | Scrolls horizontally to reveal additional AI suggestion pills |
| Input field | Tap | Keyboard rises; compose panel anchors above it |
| Input field | Type | Input text appears; send button activates (color may brighten slightly) |
| Send button | Tap | Sends SMS via FUB's Twilio-backed SMS layer; message bubble appears in thread |
| Attachment `+` button | Tap | MMS media picker (photo library, camera, document) |
| Message area (empty) | Pull down | Pull-to-refresh (load message history if any exists) |
| Message bubble (if present) | Long-press | Context menu: Copy, Reply, Forward, Delete |

---

## Build notes (component tree)

```
<MobileShell bg="#FFFFFF">

  {/* iOS Status Bar — rendered by OS, replicated with status bar component */}
  <StatusBar
    time="6:51"
    signal={4}
    networkType="5G"
    batteryLevel={23}
    batteryColor="#FFD60A"
    style="light"           // white icons on dark header bg
    bg="#3A4D5C"
  />

  {/* Navigation / Header */}
  <ConversationTopBar bg="#3A4D5C">
    <BackChevron color="#FFFFFF" onPress={popToInbox} />

    <ContactHeaderCluster onPress={navigateToContactProfile}>
      <InitialsAvatar
        initials="AC"
        bg="#C0621A"
        size={34}
        textColor="#FFFFFF"
        textSize={14}
      />
      <Text color="#FFFFFF" size={17} weight="600">Andy Christensen</Text>
      <ChevronRight size={11} color="#FFFFFF" />
    </ContactHeaderCluster>

    <HeaderActions>
      <IconButton icon="phone-handset" color="#FFFFFF" onPress={initiateCall} />
      <IconButton icon="kebab-horizontal" color="#FFFFFF" onPress={openContextSheet} />
    </HeaderActions>
  </ConversationTopBar>

  {/* Message Thread — empty state */}
  <ScrollView
    flex={1}
    bg="#FFFFFF"
    contentInsetBottom={composeBarHeight}  // ensure content clears compose panel
  >
    {/* No MessageBubble components — thread is empty */}
    {/* No EmptyStateIllustration — FUB renders a plain white canvas */}
  </ScrollView>

  {/* Compose Panel — floats above keyboard */}
  <ComposePanel
    bg="#FFFFFF"
    borderTopLeftRadius={12}
    borderTopRightRadius={12}
    shadowTop="0 -1px 4px rgba(0,0,0,0.08)"
  >

    {/* Row 1: AI suggestion pill strip */}
    <HorizontalScrollView
      horizontal
      showsScrollIndicator={false}
      paddingHorizontal={12}
      paddingVertical={8}
      gap={8}
    >
      <AISuggestionPill
        icon="sparkle"      // 4-point asterisk star burst
        label="Introduction"
        onPress={injectIntroductionDraft}
      />
      <AISuggestionPill
        icon="sparkle"
        label="Follow Up"
        onPress={injectFollowUpDraft}
      />
      <AISuggestionPill
        icon="plus"         // plain + icon, no sparkle
        label="Custom"
        onPress={openCustomAIPrompt}
      />
      {/* Additional pills scroll off-screen to right */}
    </HorizontalScrollView>

    {/* Row 2: Input row */}
    <InputRow paddingHorizontal={8} paddingBottom={8} gap={6} alignItems="center">
      <AttachmentButton
        bg="#D1D1D6"
        icon="plus"
        iconColor="#FFFFFF"
        size={34}
        borderRadius={17}
        onPress={openMediaPicker}
      />
      <TextInput
        flex={1}
        placeholder="Text message · SMS"
        placeholderColor="#8E8E93"
        borderRadius={18}
        borderWidth={1}
        borderColor="#C7C7CC"
        paddingHorizontal={14}
        paddingVertical={8}
        fontSize={15}
        minHeight={34}
        multiline
      />
      <SendButton
        bg="#4DAFDF"
        icon="arrow-up"
        iconColor="#FFFFFF"
        size={34}
        borderRadius={17}
        onPress={sendSMS}
      />
    </InputRow>

  </ComposePanel>

  {/* Home indicator spacer */}
  <SafeAreaBottom bg="#FFFFFF" />

</MobileShell>
```

### Data bindings

| Component | Data source |
|---|---|
| `InitialsAvatar initials` | `contact.firstName[0] + contact.lastName[0]` → "AC" |
| `InitialsAvatar bg` | Deterministic color from contact ID hash → burnt orange |
| `ContactHeaderCluster` name | `contact.fullName` → "Andy Christensen" |
| `ScrollView` messages | `GET /v1/textMessages?personId={contactId}` → empty array |
| `AISuggestionPill` content | FUB AI template engine (Introduction / Follow Up are built-in; Custom triggers user prompt) |
| `TextInput` value | Local compose state |
| `SendButton` onPress | `POST /v1/textMessages { personId, body, type: "sms" }` |
| `AttachmentButton` onPress | Native media picker → `POST /v1/textMessages` with `mediaUrl` |

### Key spacing / sizing notes

- Header height: ~56 pt (standard FUB header)
- Avatar diameter: ~34 pt
- Pill height: ~34 pt, pill text ~14 pt medium
- Pill strip row total height: ~50 pt (8 pt pad top + 34 pt pill + 8 pt pad bottom)
- Input row height: ~48 pt
- Attachment and send button diameter: ~34 pt
- Input field corner radius: ~18 pt (fully pill-shaped for single-line)
- Compose panel total height: ~98 pt (pill strip 50 + input row 48)
- Empty message area fills remaining vertical space between header (110 pt) and compose panel (~746 pt) = ~636 pt

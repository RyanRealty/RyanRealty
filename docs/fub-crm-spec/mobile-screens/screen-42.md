<!-- Mobile per-screen appendix. Original: IMG_6010.PNG | id: mob-42 | tiles: mob-tiles/mob-42_{full,t,m,b}.png -->

# mob-42 — fub-ios — SMS Conversation Thread (Kebab Action Sheet Open)

## Identity

- **app_source:** fub-ios — Follow Up Boss native iPhone app (confirmed by dark charcoal/teal header, colored-initials avatar, AI quick-reply pill strip, "Text message • SMS" composer placeholder, and Call / Email / Start a group message / Block action sheet pattern)
- **module:** Inbox / Conversations
- **screen:** SMS conversation thread for contact Andy Christensen, with the header "..." (kebab) menu expanded as a floating action sheet
- **how to reach:** Tap "Inbox" tab → tap any SMS conversation row → then tap "..." in the top-right header
- **iOS status bar:** 6:54 (time, left) · signal bars + "5G" (right-center) · battery 21% with yellow warning indicator (far right)
- **URL bar:** N/A — native iOS app

---

## Screen regions (y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height (est.) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark charcoal #2C3440 (matches header) |
| Nav / header bar | 54–108 | 54 pt | Dark charcoal #2C3440 |
| Conversation body (scrollable) | 108–720 | 612 pt | White #FFFFFF (empty in this state) |
| Kebab action sheet overlay | ~108–340 | ~232 pt | White #FFFFFF card, 14 pt radius corners, light shadow |
| Quick-reply pill strip | 720–770 | ~50 pt | White #FFFFFF, top border hairline #E5E7EB |
| Compose bar | 770–820 | ~50 pt | White #FFFFFF |
| Home indicator inset | 820–844 | 24 pt | White |

> The bottom tab bar is **not visible in this screen** — the conversation thread + composer occupy the full below-header area. The standard FUB tab bar (Inbox / Activity / Calendar / People / Deals) is displaced. Inbox is the inferred active tab from context.

---

## Nav / header bar (exact)

```
[ < ]   [AC]  Andy Christensen >   [ phone ]  [ ··· ]
```

- **Left control:** `<` back chevron (white, ~18 pt, returns to Inbox list)
- **Avatar:** 32 pt circle, rust/brown fill (#A0522D or similar warm brown), white initials "AC" centered, ~13 pt medium weight. Tappable — navigates to contact detail profile.
- **Center title:** "Andy Christensen" in white, medium weight ~17 pt, followed immediately by `>` chevron (indicating tappable — opens contact detail / lead profile). No subtitle line visible.
- **Right controls (left to right):**
  1. Phone handset icon — white, ~22 pt — tap initiates a FUB call to the contact
  2. "···" (three horizontal dots) — white — tap opens the action sheet that is currently expanded in this screenshot

---

## Kebab action sheet (currently open)

A white rounded-corner card (border-radius ~14 pt, subtle drop shadow rgba(0,0,0,0.12)) anchors below the "···" button. The card is NOT a full-screen modal — it is a floating popover positioned from ~x 165 to ~x 385 pt, y ~108 to ~340 pt.

### Rows (top to bottom, separated by 1 pt #E5E7EB hairline dividers):

| # | Label | Icon (right side) | Style | Action |
|---|---|---|---|---|
| 1 | **Call** | Phone handset glyph, black, ~20 pt | Black text ~17 pt, normal weight | Initiates a FUB-tracked outbound call to contact's number |
| 2 | **Email** | Envelope glyph (square with X-flap), black, ~20 pt | Black text ~17 pt, normal weight | Opens email compose for the contact |
| 3 | **Start a group message** | Chat bubble with "+" glyph, black, ~20 pt | Black text ~17 pt, normal weight | Initiates an SMS group thread |
| 4 | **Block (786) 580-8921** | Phone handset glyph, red/coral ~20 pt | Red/coral text (#E53E3E) ~17 pt, normal weight | Blocks the contact's phone number (destructive action) |

Row height: ~54 pt each. The "Block" row is visually separated by the red color as a destructive action. Tapping outside the popover dismisses it.

---

## Bottom tab bar (exact)

**Not rendered in frame.** The conversation thread view hides the standard FUB bottom tab bar. Standard FUB tabs (for reference when building shell):

`Inbox* · Activity · Calendar · People · Deals`

Inbox is the active tab (user navigated here from Inbox). No badge counts visible.

---

## Conversation body

The message thread area (y 108–720 pt) is **empty / blank white** in this screenshot. Either:
- No prior messages have been sent in this SMS thread, OR
- The screen was captured the moment the conversation opened before any messages loaded

No message bubbles, timestamps, or delivery indicators are visible. The background is plain white #FFFFFF.

---

## Quick-reply pill strip (y ~720–770 pt)

A horizontally scrollable row of pill buttons, sitting above the compose bar. Top edge has a 1 pt hairline divider #E5E7EB. Padding: ~12 pt left, ~8 pt gap between pills.

Visible pills (left to right; row scrolls horizontally — additional pills may exist off-screen to the right):

| Pill | Left icon | Label | Border | Background |
|---|---|---|---|---|
| 1 | Sparkles/AI wand glyph (4-pointed star cluster, black ~14 pt) | **Introduction** | 1 pt solid #6B7280 | White |
| 2 | Sparkles/AI wand glyph (same style) | **Follow Up** | 1 pt solid #6B7280 | White |
| 3 | "+" plain plus sign, black ~14 pt | **Custom** | 1 pt solid #6B7280 | White |
| (4+) | (cut off — partially visible at right edge) | (unknown) | — | — |

Pill anatomy: ~36 pt height, ~16 pt horizontal padding, ~18 pt border-radius (fully rounded), white fill, dark border, black text ~14 pt regular weight. AI-generated pills (Introduction, Follow Up) use the sparkle/wand icon prefix indicating LLM-assisted content generation. "+ Custom" allows freeform template creation.

Tap behavior: tapping an AI pill pre-fills the compose bar with a generated message (Introduction message or Follow Up message). Tapping "+ Custom" likely opens a template picker or blank compose.

---

## Compose bar (y ~770–820 pt)

Single row, full width. Three zones:

| Zone | Element | Detail |
|---|---|---|
| Left | "+" circle button | ~36 pt circle, light gray fill #E5E7EB, "+" glyph black ~20 pt. Tap opens attachment/media picker (likely: photo, file, audio note). |
| Center | Text input field | Full-width pill input, 1 pt border #D1D5DB, white fill, placeholder text "Text message • SMS" in gray #9CA3AF, ~16 pt regular. Tappable — raises keyboard. |
| Right (inside input) | Send button | ~32 pt circle, blue fill (#3B82F6 or similar FUB blue/teal accent), white up-arrow chevron glyph. Disabled (grayed?) when input is empty; active (blue) once text entered — but appears blue here indicating the button is always rendered in its active color. |

---

## Colors, type & iconography

| Token | Value | Usage |
|---|---|---|
| Header background | #2C3440 (dark charcoal, slight blue-tint) | Nav bar, status bar background |
| Avatar fill | ~#A0522D (rust/terracotta brown) | "AC" initials avatar |
| White | #FFFFFF | Avatar text, header icons, action sheet bg, conversation bg |
| Accent blue | ~#3B82F6 | Send button fill |
| Text primary | #111827 | Action sheet labels |
| Text destructive | ~#E53E3E (red/coral) | "Block (786) 580-8921" label + icon |
| Divider | #E5E7EB (hairline) | Between action sheet rows, top of pill strip |
| Pill border | #6B7280 | Quick-reply pill borders |
| Compose border | #D1D5DB | Text input border |
| Placeholder | #9CA3AF | "Text message • SMS" placeholder |

**Typography:** System SF Pro Display/Text throughout. Header title ~17 pt medium. Action sheet rows ~17 pt regular. Pill labels ~14 pt regular. Compose placeholder ~16 pt regular.

**Iconography style:** SF Symbols-compatible line icons. Phone handset (2 variants — standard black, red for block). Envelope (classic square with V-flap). Chat bubble with plus. Sparkle/wand cluster (4 asymmetric 4-pointed stars). Standard "+" and up-arrow chevron.

**FUB accent color:** The app uses blue (~#3B82F6) for interactive/active states — NOT navy #102742. This is the FUB native app, not the Ryan Realty in-house web app.

---

## Interactions & gestures

| Gesture / Tap | Target | Result |
|---|---|---|
| Tap `<` | Back chevron | Pop to Inbox list (conversation list) |
| Tap avatar "AC" | Contact avatar | [INFERRED] Push to contact detail / lead profile for Andy Christensen |
| Tap "Andy Christensen >" | Title + chevron | [INFERRED] Push to contact detail / lead profile |
| Tap phone icon | Phone button in header | [INFERRED] Initiate FUB-tracked call directly (bypasses action sheet) |
| Tap "···" | Kebab menu | Presents the floating action sheet (currently open in screenshot) |
| Tap "Call" in sheet | Row 1 | Dismiss sheet + initiate outbound call |
| Tap "Email" in sheet | Row 2 | Dismiss sheet + open email compose for Andy Christensen |
| Tap "Start a group message" in sheet | Row 3 | Dismiss sheet + open group SMS thread creator |
| Tap "Block (786) 580-8921" in sheet | Row 4 | [INFERRED] Confirmation alert before blocking the number |
| Tap outside action sheet | Overlay backdrop | Dismiss action sheet without action |
| Tap "Introduction" pill | Quick-reply pill 1 | Pre-fill compose bar with AI-generated introduction message |
| Tap "Follow Up" pill | Quick-reply pill 2 | Pre-fill compose bar with AI-generated follow-up message |
| Tap "+ Custom" pill | Quick-reply pill 3 | [INFERRED] Open template picker or inline template editor |
| Tap "+" button | Attachment button | [INFERRED] Present bottom sheet with: photo library, camera, file attachment, audio note options |
| Tap compose field | Text input | Raise keyboard, pills scroll above keyboard |
| Tap send button | Blue up-arrow | Send composed SMS to contact; message bubble appears in thread |
| Swipe right on compose | — | [INFERRED] No action (iOS back swipe goes to list) |
| Pull to refresh (conversation body) | Thread area | [INFERRED] Reload message thread from FUB backend |

---

## Build notes — component tree

```tsx
<MobileShell>

  {/* Layer 1 — Base screen (always mounted) */}
  <StatusBar style="light" backgroundColor="#2C3440" />

  <ConversationHeader>
    {/* ~54pt tall, bg #2C3440 */}
    <BackButton icon="chevron-left" color="white" onPress={navToInbox} />
    <ContactAvatar
      initials="AC"
      size={32}
      fillColor="#A0522D"
      textColor="white"
      onPress={navToContactDetail}
    />
    <TitleButton
      label="Andy Christensen"
      chevron={true}
      color="white"
      fontSize={17}
      fontWeight="500"
      onPress={navToContactDetail}
    />
    <IconButton icon="phone-handset" color="white" size={22} onPress={initiateCall} />
    <IconButton icon="ellipsis-horizontal" color="white" size={22} onPress={openKebabSheet} />
  </ConversationHeader>

  <SMSThreadBody>
    {/* Scrollable; bg #FFFFFF; flex:1 */}
    {/* Empty state: blank white — no EmptyState component visible */}
    {messages.map(msg => <MessageBubble key={msg.id} {...msg} />)}
  </SMSThreadBody>

  {/* Layer 2 — Compose toolbar (fixed bottom, above home indicator) */}
  <ComposeToolbar>
    <QuickReplyPillStrip scrollable horizontal>
      {/* Top hairline border #E5E7EB, bg white, padding 12pt left */}
      <QuickReplyPill icon="sparkles" label="Introduction" onPress={fillIntro} />
      <QuickReplyPill icon="sparkles" label="Follow Up" onPress={fillFollowUp} />
      <QuickReplyPill icon="plus" label="Custom" onPress={openCustomTemplate} />
      {/* Additional pills possible; horizontal scroll */}
    </QuickReplyPillStrip>

    <ComposeRow>
      {/* Row: 50pt tall, bg white, horizontal padding 12pt */}
      <AttachmentButton
        icon="plus"
        size={36}
        fillColor="#E5E7EB"
        iconColor="#111827"
        onPress={openAttachmentPicker}
      />
      <TextInput
        placeholder="Text message • SMS"
        placeholderColor="#9CA3AF"
        borderColor="#D1D5DB"
        borderRadius={20}
        flex={1}
        fontSize={16}
        multiline
        onChangeText={setDraft}
      />
      <SendButton
        icon="arrow-up"
        size={32}
        fillColor="#3B82F6"
        iconColor="white"
        disabled={draft.length === 0}
        onPress={sendSMS}
      />
    </ComposeRow>
  </ComposeToolbar>

  {/* Layer 3 — Kebab action sheet (conditionally rendered, z-index above body) */}
  {kebabOpen && (
    <FloatingActionSheet
      anchorPosition={{ top: 108, right: 16 }}
      width={220}
      borderRadius={14}
      shadow="rgba(0,0,0,0.12) 0 4px 16px"
      onDismiss={closeKebabSheet}
    >
      <ActionSheetRow
        label="Call"
        icon="phone-handset"
        iconColor="#111827"
        textColor="#111827"
        onPress={initiateCall}
      />
      <Divider color="#E5E7EB" height={1} />
      <ActionSheetRow
        label="Email"
        icon="envelope"
        iconColor="#111827"
        textColor="#111827"
        onPress={openEmailCompose}
      />
      <Divider color="#E5E7EB" height={1} />
      <ActionSheetRow
        label="Start a group message"
        icon="chat-plus"
        iconColor="#111827"
        textColor="#111827"
        onPress={startGroupMessage}
      />
      <Divider color="#E5E7EB" height={1} />
      <ActionSheetRow
        label="Block (786) 580-8921"
        icon="phone-handset"
        iconColor="#E53E3E"
        textColor="#E53E3E"
        destructive
        onPress={blockContact}
      />
    </FloatingActionSheet>
  )}

  {/* Tap-to-dismiss overlay behind action sheet */}
  {kebabOpen && (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={closeKebabSheet}
      transparent
    />
  )}

</MobileShell>
```

### Key data bindings

| Component | Data field |
|---|---|
| `ContactAvatar` | `contact.firstName[0] + contact.lastName[0]`, `contact.avatarColor` |
| `TitleButton` | `contact.fullName` |
| `MessageBubble` | `message.body`, `message.direction` (inbound/outbound), `message.sentAt`, `message.status` (delivered/read/failed) |
| `ActionSheetRow[Block]` | `contact.primaryPhone` — rendered verbatim as "(786) 580-8921" |
| `QuickReplyPill[Introduction/FollowUp]` | AI-generated content from FUB's suggestion API (keyed by contact stage/context) |
| `TextInput` | Local draft state, cleared on send |

### Spacing constants
- Header height: 54 pt (+ 54 pt status bar = 108 pt total top inset)
- Avatar size: 32 pt diameter
- Action sheet row height: 54 pt
- Action sheet width: ~220 pt (anchored top-right under the "..." button)
- Pill height: 36 pt, border-radius: 18 pt (fully rounded)
- Compose row height: 50 pt
- Home indicator inset: 24 pt (safe area bottom)

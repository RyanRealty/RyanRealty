<!-- Mobile per-screen appendix. Original: IMG_6007.PNG | id: mob-40 | tiles: mob-tiles/mob-40_{full,t,m,b}.png -->

# mob-40 — fub-ios — AI Message Compose (Conversation Thread)

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app (confirmed: dark slate-teal header bg ~#3d4f5c, orange initials avatar, FUB-style phone + kebab controls, AI sparkle chip strip)
- **module:** Inbox / Conversations → Compose
- **screen:** Conversation thread for a single contact, with AI-powered message draft panel open at the bottom. This is the compose state — the AI has generated a draft and the user is reviewing it before sending.
- **how to reach:** Tap any conversation row in the Inbox tab → opens the thread view → the AI compose toolbar appears at the bottom (auto-expanded or manually triggered). The bottom tab bar is hidden/pushed off-screen because the compose panel + soft keyboard have taken over the lower portion.
- **iOS status bar:** Time 6:52 (left), signal bars + "5G" + battery 22% with yellow low-battery indicator (right)
- **URL:** n/a (native app)

---

## Screen regions (y-bands, 390×844 pt logical)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | ~#3d4f5c (slate-teal, same as nav) |
| Nav / header bar | 54–110 | 56 | ~#3d4f5c (dark slate-teal) |
| Conversation body (scrollable) | 110–680 | 570 | #FFFFFF (pure white, empty in this state) |
| AI suggestion chip strip | 680–730 | 50 | #FFFFFF with light top border (subtle gray) |
| Message compose area (draft) | 730–844 | ~114 | #FFFFFF |

Note: The iOS soft keyboard is dismissed or off-screen in this capture. The compose area sits at the bottom of the visible viewport. No bottom tab bar is visible — it is hidden beneath the compose panel.

---

## Nav / header bar (exact)

- **Left control:** Back chevron `<` — white, ~22pt, tappable: pops back to the inbox/conversation list
- **Center (left-of-center, not truly centered):**
  - Orange filled circle avatar, ~36pt diameter, initials **"AC"** in white bold sans-serif (~14pt). Color: ~#C05A1F (burnt orange / terra cotta)
  - Contact name **"Andy Christensen"** in white bold (~17pt semibold) immediately right of avatar
  - Right-pointing chevron `>` in white (~12pt) immediately after the name — tappable: navigates to the full contact/lead profile detail screen
- **Right controls (flush right):**
  - Telephone handset icon — white filled glyph (~22pt). Tappable: initiates a call to Andy Christensen via FUB dialer
  - Horizontal ellipsis `···` (kebab/more menu) — white, three dots (~22pt). Tappable: opens an action sheet with options (e.g., Mark as read, Archive, Assign, etc.)
- **Header bg:** ~#3d4f5c (dark slate/teal — the FUB brand nav color, not the in-house app navy #102742)

---

## Bottom tab bar (exact)

**Not visible in this screen state.** The AI compose panel + keyboard have pushed the standard FUB bottom tab bar (Inbox / Activity / Calendar / People / Deals) off-screen. No FAB is present in this compose context.

---

## Content — every element, in order

### 1. Conversation body (y 110–680)
- **Background:** pure white (#FFFFFF)
- **Content:** Completely empty — no prior message bubbles are rendered. This could mean: (a) this is the first outreach to Andy, (b) the view is scrolled all the way to the bottom with all prior messages above the visible area, or (c) the conversation has no prior messages and this is the first compose action.
- No section headers, no timestamps, no "today" dividers visible.
- No empty-state illustration or text is shown — just white space.

### 2. AI suggestion chip strip (y ~680–730)

A horizontally scrollable row of pill-shaped action chips. The strip has a very light top border (hairline, ~#E0E0E0). Background: white. Chips are left-aligned with ~12pt padding on left edge; the row overflows right (partially clipped chips indicate scroll).

**Chips visible left-to-right:**

| # | Label | State | Style |
|---|---|---|---|
| 1 | **✨ Follow Up** | SELECTED / ACTIVE | Filled gradient purple (#A855F7 → #7C3AED), dark purple border (~#6D28D9), white bold text, sparkle/AI icon left of text. Pill shape, ~38pt height, ~130pt width. |
| 2 | **+ Custom** | Unselected | Outlined pill, white bg, dark gray border (~#D1D5DB), black text ("+" prefix glyph), ~38pt height. Tappable: opens a custom message input flow. |
| 3 | **✨ Still Buying** | Unselected | Outlined pill, white bg, dark gray border, black text, sparkle/AI icon left of text. Same size as Custom. Tappable: generates a "still buying?" AI draft. |
| 4+ | (partially visible) | Unknown | Additional chips scroll off-screen to the right — at least one more chip partially visible at the right edge. |

**Chip anatomy:**
- Icon: 4-pointed sparkle/star glyph (the "AI" indicator — same icon FUB uses for AI suggestions throughout) — ~14pt, displayed to the left of the label text
- Label: ~15pt semibold, black (unselected) or white (selected)
- Border radius: fully rounded (pill) — ~19pt radius
- Horizontal padding: ~16pt left, ~16pt right
- Gap between chips: ~10pt

### 3. Message compose area / AI draft (y ~730–844)

A rounded-rectangle text area containing an AI-generated draft message. The compose area is bordered with a light gray rounded rect (~#E5E7EB border, ~12pt radius).

**Left control — Attachment / Add button:**
- Gray circle button, ~36pt diameter, `+` glyph in dark gray
- Position: vertically centered left of the text area, ~16pt from left edge
- Tappable: opens attachment/media picker (photos, documents, etc.) [INFERRED]

**Text area — AI draft message:**
- Rounded rectangle, light gray border (~#E5E7EB), white background, ~12pt corner radius
- Font: ~15pt regular, dark charcoal/near-black (#1C1C1E or similar)
- Content (verbatim): **"Hi Andy, just following up on your general inquiry from earlier this month. If you have any specific properties or areas in mind, I'd be happy to help you explore options that fit your needs. Let me know if you want to set up a time to chat!"**
- The text is NOT editable in its current visual state (it reads as a preview/draft that was generated by AI). The user can tap to edit before sending [INFERRED].
- Multi-line display: ~6 lines of wrapped text visible at this zoom.
- Vertical padding: ~12pt top and bottom inside the bubble.
- Horizontal padding: ~12pt left and right inside the bubble.

**Right control — Send button:**
- Solid teal/blue filled circle, ~36pt diameter. Color: ~#3B82F6 (bright blue) or FUB's brand blue (~#0EA5E9)
- Icon: upward-pointing arrow (↑) in white, filled, ~20pt
- Position: vertically centered right of the text area, ~16pt from right edge
- Tappable: sends the drafted message to Andy Christensen via the selected channel (SMS or email per FUB's routing) [INFERRED]

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | ~#3D4F5C (FUB slate-teal — NOT in-house navy #102742) |
| Header text / icons | #FFFFFF |
| Contact avatar bg | ~#C05A1F (burnt orange / terra cotta) |
| Contact avatar initials | #FFFFFF bold |
| AI chip — selected fill | Gradient #A855F7 → #7C3AED (violet/purple) |
| AI chip — selected border | ~#6D28D9 |
| AI chip — unselected bg | #FFFFFF |
| AI chip — unselected border | ~#D1D5DB (light gray) |
| AI chip — unselected text | #111827 (near-black) |
| Conversation body bg | #FFFFFF |
| Compose area border | ~#E5E7EB |
| Draft message text | ~#1C1C1E (near-black) |
| Attachment (+) button bg | ~#E5E7EB (light gray circle) |
| Attachment (+) glyph | ~#6B7280 (medium gray) |
| Send button bg | ~#3B82F6 (bright blue) |
| Send button arrow | #FFFFFF |
| Nav font | SF Pro Display, ~17pt semibold (system) |
| Body / chip font | SF Pro Text, ~15pt regular/semibold |
| Sparkle icon | 4-pointed star-burst (FUB AI indicator glyph) |

---

## Interactions & gestures (mark [INFERRED])

- **Tap back chevron `<`:** Pops navigation back to Inbox conversation list [INFERRED]
- **Tap "Andy Christensen >":** Navigates to full lead/contact detail profile screen [INFERRED]
- **Tap phone handset icon:** Opens FUB dialer to call Andy [INFERRED]
- **Tap `···` kebab:** Presents action sheet (archive, assign, mark unread, mute, etc.) [INFERRED]
- **Scroll conversation body (swipe up/down):** Scrolls message history [INFERRED]; pull-to-refresh may load newer messages [INFERRED]
- **Tap "Follow Up" chip:** Selects this AI template category — the draft below updates to a follow-up message (already active/selected in this view)
- **Tap "+ Custom":** Clears AI draft, focuses cursor in compose text area for manual typing [INFERRED]
- **Tap "✨ Still Buying":** Replaces the AI draft below with a "still buying?" check-in message [INFERRED]
- **Swipe chip strip horizontally:** Reveals additional AI template chips to the right [INFERRED]
- **Tap draft text area:** Enters edit mode — iOS keyboard raises, cursor placed at tap point [INFERRED]
- **Tap `+` (attachment button):** Opens iOS share sheet or attachment picker [INFERRED]
- **Tap blue send button (↑):** Sends the composed message; bubble appears in conversation; compose field clears; chip strip may collapse [INFERRED]
- **Long-press draft message:** May allow selecting text [INFERRED]

---

## Build notes (component tree)

```
<MobileShell bg="#3D4F5C">

  <StatusBar
    time="6:52"
    signal="4-bar"
    networkType="5G"
    battery={22}
    batteryColor="yellow"   // low-battery warning
    textColor="#FFFFFF"
    bg="#3D4F5C"
  />

  <ConversationTopBar bg="#3D4F5C">
    <BackButton icon="chevron-left" color="#FFFFFF" onTap={popToInbox} />

    <ContactHeader onTap={navigateToLeadProfile}>
      <Avatar
        initials="AC"
        bg="#C05A1F"       // burnt orange — contact-specific color assigned by FUB
        size={36}
        textColor="#FFFFFF"
        shape="circle"
      />
      <ContactName text="Andy Christensen" color="#FFFFFF" fontSize={17} fontWeight="600" />
      <ChevronRight color="#FFFFFF" size={12} />
    </ContactHeader>

    <TopBarActions>
      <IconButton icon="phone-handset" color="#FFFFFF" size={22} onTap={initiateCall} />
      <IconButton icon="ellipsis-horizontal" color="#FFFFFF" size={22} onTap={openActionSheet} />
    </TopBarActions>
  </ConversationTopBar>

  <ConversationBody
    flex={1}
    bg="#FFFFFF"
    scrollable={true}
    pullToRefresh={true}
  >
    {/* Empty in this capture — no message bubbles rendered */}
    {messages.length === 0 && <EmptyConversationState />}
    {messages.map(msg => (
      <MessageBubble
        key={msg.id}
        direction={msg.fromAgent ? "outbound" : "inbound"}
        text={msg.body}
        timestamp={msg.sentAt}
        channel={msg.channel}  // "sms" | "email"
      />
    ))}
  </ConversationBody>

  <ComposePanel bg="#FFFFFF" borderTop="1px solid #E5E7EB">

    <AIChipStrip horizontal scrollable paddingX={12} gap={10} height={50}>
      {aiTemplates.map(template => (
        <AIChipButton
          key={template.id}
          label={template.label}               // "Follow Up" | "Custom" | "Still Buying" | ...
          icon={template.isAI ? "sparkle" : "plus"}
          selected={template.id === selectedTemplateId}
          selectedStyle={{
            bg: "linear-gradient(135deg, #A855F7, #7C3AED)",
            borderColor: "#6D28D9",
            textColor: "#FFFFFF"
          }}
          unselectedStyle={{
            bg: "#FFFFFF",
            borderColor: "#D1D5DB",
            textColor: "#111827"
          }}
          pillRadius={19}
          paddingX={16}
          height={38}
          fontSize={15}
          fontWeight="600"
          onTap={() => selectTemplate(template.id)}
        />
      ))}
    </AIChipStrip>

    <ComposeRow paddingX={12} paddingY={10} gap={10} alignItems="center">
      <AttachmentButton
        icon="plus"
        bg="#E5E7EB"
        iconColor="#6B7280"
        size={36}
        shape="circle"
        onTap={openAttachmentPicker}
      />

      <DraftTextArea
        flex={1}
        value={draftText}
        onChange={setDraftText}
        placeholder="Write a message..."
        bg="#FFFFFF"
        border="1px solid #E5E7EB"
        borderRadius={12}
        paddingX={12}
        paddingY={12}
        fontSize={15}
        color="#1C1C1E"
        multiline={true}
        minHeight={80}
        /* AI-populated content (verbatim):
           "Hi Andy, just following up on your general inquiry from earlier
            this month. If you have any specific properties or areas in mind,
            I'd be happy to help you explore options that fit your needs.
            Let me know if you want to set up a time to chat!" */
      />

      <SendButton
        icon="arrow-up"
        bg="#3B82F6"
        iconColor="#FFFFFF"
        size={36}
        shape="circle"
        disabled={draftText.trim().length === 0}
        onTap={sendMessage}
      />
    </ComposeRow>

  </ComposePanel>

</MobileShell>
```

### Data bindings
- `contact.id` → resolves avatar color, initials, name, phone number
- `selectedTemplateId` → drives chip active state + triggers AI draft generation via FUB AI API
- `draftText` → mutable string, pre-populated by AI generation, editable by user
- `messages[]` → conversation timeline for this contact (empty in this capture)
- `sendMessage()` → POST to FUB API / Twilio to send SMS or email depending on contact preferences

### Sizing notes (390pt viewport)
- TopBar total height: ~110pt (54pt status + 56pt nav)
- Avatar circle: 36×36pt
- Chip strip height: ~50pt (12pt top padding + 38pt chip + hairline border)
- Compose row height: ~114pt (10pt padding top + ~80pt textarea + 10pt padding bottom + safe area)
- Attachment and Send buttons: 36×36pt circles, vertically centered in compose row
- Draft textarea: grows dynamically; min ~80pt, max ~200pt before scrolling [INFERRED]

<!-- Mobile per-screen appendix. Original: IMG_6017.PNG | id: mob-49 | tiles: mob-tiles/mob-49_{full,t,m,b}.png -->

# mob-49 — fub-ios — SMS Group Thread / Conversation Detail (Mary, Yahson)

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app (dark teal header, FUB avatar+name pattern, teal message bubbles, SMS compose bar)
- **module:** Inbox / Conversations
- **screen:** Group SMS conversation detail thread — 2 contacts (Mary, Yahson)
- **how to reach:** Inbox tab → tap a conversation row with "2 people" group thread
- **iOS status bar:** 7:44 (time, left) · signal bars + WiFi icon (center-ish) · "16" battery % (right, low battery)
- **URL bar:** n/a (native iOS app, no browser chrome)

---

## Screen regions (y-bands on 390×844pt logical screen)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark teal (same as header), translucent |
| Nav / header bar | 54–108 | ~54 pt | Dark teal ~#0e6b7a |
| Scrollable conversation content | 108–750 | ~642 pt | Off-white / light gray ~#f2f2f7 |
| Compose bar | 750–800 | ~50 pt | White ~#ffffff with top hairline border |
| Home indicator area | 800–844 | 44 pt | White |

---

## Nav / header bar (exact)

- **Left control:** `<` chevron (back arrow), white, ~24pt, navigates back to inbox list
- **Center-left:** Circle avatar, ~40pt diameter, teal-ish fill (~#1a8f9b), white text initials **"M YT"** (representing the two contacts — M for Mary, YT for Yahson/Tagalog initials; the two-initial display is FUB's "group" avatar treatment)
- **Center title stack (two-line):**
  - Line 1: **"Mary, Yahson"** — white, bold, ~17pt + a **`>`** right-pointing chevron immediately after the name (tappable — opens the group/person detail or linked contact profiles), white ~14pt
  - Line 2: **"2 people"** — white, regular weight, ~13pt, muted (subtitle, centered under the name)
- **Right control:** **`...`** three-dot kebab icon (horizontal ellipsis), white ~24pt. Opens options menu (likely: call, email, add note, create task, view contact, mark unread, etc.)
- **Header bg:** Dark teal approximately **#0d6b78** (FUB's signature dark teal-navy)

---

## Bottom tab bar (exact)

**Not visible in this screen.** The compose bar occupies the bottom position and replaces the tab bar, consistent with FUB iOS behavior where entering a conversation thread hides the global tab bar so the keyboard/compose input can anchor to the bottom. The active tab before entering this screen was **Inbox**.

No FAB (+) in this screen — the "+" to the left of the compose input is an attachment/action button for the thread, not the global FAB.

---

## Content — every element, in order (top → bottom)

### Message thread (scrollable, background ~#f2f2f7)

Messages render in full-width teal bubble cards left-aligned inside the scroll area. All visible messages are **outgoing from the broker (Matt)** — FUB renders both sent and received SMS in the same left-aligned teal bubble style (not iMessage-style split left/right), or these are all broker-sent messages in sequence. No visible inbound/contact reply messages in the current scroll position.

---

#### Message 1 (teal bubble, full width, left-anchored)
**No timestamp header above this message** — it continues from earlier scroll context (off the top of screen).

Bubble bg: **teal ~#1a8f9b**, rounded corners ~18pt, left+right margins ~12pt, top margin ~8pt.
White text, regular weight, ~15pt, line-height ~22pt.

Full verbatim text:
> "We quoted the unit that is most comparable to yours, and that is the quote we received. I will let you talk to Donnie about the next steps and whether you want to move forward.
> We need to decide on this soon so we can get it installed before the appraisal. I let them know you're closing on the 23rd and asked if they could explore options for you paying at close of escrow. I'll let you work through those with Mountain View. Let me know if you have any questions. I gave Donnie at Mountain View your phone number, both Jason and you. He will call, and you can answer any questions you have."

---

#### Message 2 (teal bubble, continuation — no separator between 1 and 2, they may be distinct send events)
Same bubble style.

Full verbatim text:
> "Please let me know if you have any questions. I'm here to take a phone call now if you would like."

---

#### Date separator
Centered, gray text ~#8e8e93, ~12–13pt, regular weight, ~32pt vertical padding above/below:
> **"Jun 10, 2026, 10:13 AM"**

---

#### Message 3 (teal bubble)
Same bubble style. Contains a hyperlink (white underline).

Full verbatim text:
> "Please use this link to pay the painter so we can get your home painted prior to the appraisal.
>
> https://connect.intuit.com/t/scs-v1-dd4098651bfe4fed95afdd3637d83e6671f9264e1f904e4c8a715fe7923bbb932b02a44370ab474abd00601245279ca8?cta=viewinvoicenow&locale=en_US"

URL renders as a tappable underlined white hyperlink within the bubble.

---

#### Date separator
Centered gray text:
> **"Jun 12, 2026, 10:00 AM"**

---

#### Message 4 (teal bubble — last visible message, near bottom of scroll)
Same bubble style.

Full verbatim text:
> "Good morning Mary and Yahson. Please let me know when you have paid the painter and I will call him to make sure he gets started ASAP. Thank you!"

---

### Compose bar (y ~750–800pt, fixed/sticky at bottom)

Background: **white**, top hairline border ~#c6c6c8.

Left to right layout:
1. **"+" circle button** — ~36pt diameter, gray fill (~#8e8e93), white "+" glyph. Attachment/media/template action sheet.
2. **Text input pill** — rounded rectangle, ~280pt wide, ~40pt tall, bg ~#f2f2f7, placeholder text **"Text message • SMS"** in gray ~#8e8e93, ~15pt. Tap focuses keyboard; typing updates the send button state. The "• SMS" sub-label indicates this thread is SMS channel (vs email).
3. **Send button** — ~40pt diameter circle, teal fill ~#1a8f9b (matches bubble color), white upward-pointing arrow glyph (↑). Disabled/inactive when input is empty (may show at reduced opacity or stay teal — not clearly distinguishable here).

---

## Colors, type & iconography

| Element | Color (hex est.) |
|---|---|
| Header background | `#0d6b78` (dark teal) |
| Header text / icons | `#ffffff` |
| Avatar circle fill | `#1a8f9b` (mid teal) |
| Message bubble background | `#1a8f9b` (mid teal) |
| Message text (in bubble) | `#ffffff` |
| Hyperlink in bubble | `#ffffff` underlined |
| Screen / scroll background | `#f2f2f7` (iOS system light gray) |
| Date separator text | `#8e8e93` (iOS secondary label) |
| Compose bar background | `#ffffff` |
| Compose input background | `#f2f2f7` |
| Compose input placeholder | `#8e8e93` |
| Send button fill | `#1a8f9b` |
| Send button icon | `#ffffff` |
| "+" attachment button | `#8e8e93` fill, `#ffffff` glyph |

**Typography:**
- Header title "Mary, Yahson": SF Pro Display Semibold, ~17pt, white
- Header subtitle "2 people": SF Pro Text Regular, ~13pt, white (muted)
- Message body: SF Pro Text Regular, ~15pt, white
- Date separators: SF Pro Text Regular, ~12pt, `#8e8e93`
- Compose placeholder: SF Pro Text Regular, ~15pt, `#8e8e93`

**FUB accent color:** The teal (~`#1a8f9b`) is FUB's signature teal-blue accent — distinct from the in-house app's navy `#102742`.

**Iconography:**
- Back chevron: SF Symbols `chevron.left`, ~20pt, white
- Kebab menu: SF Symbols `ellipsis` (horizontal three dots), ~22pt, white
- ">" after name: SF Symbols `chevron.right`, ~14pt, white
- Send button: SF Symbols `arrow.up` inside a filled circle, white on teal
- Attachment "+": SF Symbols `plus` inside a filled circle, white on gray

---

## Interactions & gestures (mark [INFERRED])

- **Back chevron tap** → pops to Inbox conversation list [INFERRED]
- **"Mary, Yahson" + ">" tap** → pushes to Group Contact detail view showing both Mary and Yahson's profiles, linked deal, notes [INFERRED]
- **"..." kebab tap** → bottom action sheet with: Call, Email, Add Note, Create Task, Mark Unread, View Contact(s), Archive/Delete thread [INFERRED]
- **Hyperlink tap** → opens URL in in-app Safari/SFSafariViewController [INFERRED]
- **Compose "+" tap** → action sheet: Photo Library, Camera, Template/Canned Response, Schedule Send [INFERRED]
- **Compose input tap** → iOS keyboard rises, compose bar sticks above keyboard (adjustsForKeyboard), send button activates [INFERRED]
- **Send button tap** → sends SMS via FUB's Twilio integration, new bubble appears at bottom, input clears [INFERRED]
- **Pull-to-refresh (scroll down past top)** → reloads thread from FUB API [INFERRED]
- **Long-press on message bubble** → copy text / forward / delete options [INFERRED]
- **Swipe left on a message** (possibly) → no clear swipe action visible in thread; thread-level swipe actions live in the list view, not inside the thread [INFERRED]
- **Scroll up** → loads older messages in the thread (pagination) [INFERRED]

---

## Build notes (component tree)

```tsx
<MobileShell>

  {/* iOS status bar — native, no web equivalent needed */}
  <StatusBar style="light" />   {/* white text on teal header */}

  {/* Header / Top Bar */}
  <TopBar
    bg="#0d6b78"
    left={<BackChevron color="#fff" onPress={() => router.back()} />}
    center={
      <ThreadHeader
        avatarInitials="M YT"
        avatarBg="#1a8f9b"
        title="Mary, Yahson"
        titleChevron              {/* tappable > icon opens contact detail */}
        subtitle="2 people"
        onTitlePress={() => nav.push('/contacts/group/[id]')}
      />
    }
    right={<KebabMenu color="#fff" onPress={openOptions} />}
  />

  {/* Scrollable message thread */}
  <ScrollView
    style={{ bg: '#f2f2f7', flex: 1 }}
    keyboardDismissMode="interactive"
    inverted={false}            {/* messages render top→bottom */}
  >
    {messages.map((msg, i) => (
      <Fragment key={msg.id}>
        {/* Date separator — rendered when date changes between messages */}
        {showDateSeparator(msg, messages[i-1]) && (
          <DateSeparator
            label={formatThreadDate(msg.sentAt)}  // "Jun 10, 2026, 10:13 AM"
            color="#8e8e93"
            fontSize={12}
            py={16}
          />
        )}
        <MessageBubble
          text={msg.body}
          direction={msg.fromBroker ? 'outgoing' : 'incoming'}
          /* Both outgoing and incoming render left-aligned in FUB's thread view
             in the teal bubble style; no iMessage-style split */
          bubbleBg="#1a8f9b"
          textColor="#ffffff"
          borderRadius={18}
          mx={12}
          mb={4}
          hasLinks={containsUrl(msg.body)}
          onLinkPress={(url) => openInAppBrowser(url)}
        />
      </Fragment>
    ))}
  </ScrollView>

  {/* Compose bar — sticks above keyboard */}
  <KeyboardAvoidingView behavior="padding">
    <ComposeBar
      bg="#ffffff"
      borderTopColor="#c6c6c8"
      borderTopWidth={0.5}
      left={
        <AttachButton
          size={36}
          bg="#8e8e93"
          iconColor="#fff"
          onPress={openAttachmentSheet}
        />
      }
      center={
        <TextInput
          placeholder="Text message • SMS"
          placeholderTextColor="#8e8e93"
          bg="#f2f2f7"
          borderRadius={20}
          fontSize={15}
          px={14}
          py={8}
          multiline
          value={draft}
          onChangeText={setDraft}
        />
      }
      right={
        <SendButton
          size={40}
          bg="#1a8f9b"
          iconColor="#fff"
          icon="arrow-up"
          disabled={!draft.trim()}
          onPress={handleSend}
          /* data: POSTs to FUB SMS API → Twilio → contacts' phones */
        />
      }
    />
  </KeyboardAvoidingView>

</MobileShell>
```

### Data bindings
- `thread.contacts[]` → `{ id, firstName, lastName, phone }` (array; length = "2 people")
- `thread.channel` → `"sms"` (drives placeholder "Text message • SMS")
- `messages[]` → `{ id, body, sentAt, fromBroker: bool, brokerUserId, contactId? }`
- Date separators: computed from `messages[i].sentAt` vs `messages[i-1].sentAt` (group by calendar date)
- URL detection: regex on `message.body` → render as tappable `<Link>`
- Compose draft: local state, clears on successful send

### Key spacing
- Header height: 54pt (+ 54pt status bar = 108pt from top edge)
- Avatar circle: 40pt diameter
- Message bubble horizontal margin: 12pt each side
- Message bubble vertical gap: 4pt between same-direction consecutive messages, 8pt after a date separator
- Compose bar height: ~50pt; total with safe area: ~84pt
- Send + attachment buttons: 36–40pt diameter circles

### Notes for web responsive rebuild
- On web, replicate the fixed-bottom compose bar using `position: sticky` or `position: fixed` bottom with `padding-bottom` = `env(safe-area-inset-bottom)`
- The tab bar that is normally at the bottom of FUB is hidden on this screen — web rebuild should also hide/collapse the bottom nav when inside a thread view and show a back arrow in the top bar
- FUB teal `#1a8f9b` (not in-house navy `#102742`) — this is FUB's own brand color
- All visible messages are outgoing (broker-sent); the inbound contact replies would appear with a white or light-gray bubble if scrolled up to them [INFERRED from FUB conventions]
- "Text message • SMS" channel indicator in the compose placeholder informs users they are sending via SMS, not email

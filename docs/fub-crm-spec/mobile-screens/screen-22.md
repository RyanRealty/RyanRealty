<!-- Mobile per-screen appendix. Original: IMG_5984.PNG | id: mob-22 | tiles: mob-tiles/mob-22_{full,t,m,b}.png -->

# mob-22 — fub-ios — Email Message Detail (Contact Conversation Thread)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iOS app)
- **module:** Inbox / Conversations
- **screen:** Individual email message detail view, opened within a contact's (Tiffany Clark) conversation thread
- **how to reach:** Inbox tab → tap a conversation thread row for Tiffany Clark → tap a specific email message ("Order #WT0286975…") in the thread timeline → this full-screen pushed view renders the raw email body
- **iOS status bar:** 8:39 (time, left), signal bars + WiFi icon + 37% battery icon (right); white text on dark background
- **URL bar:** n/a (native iOS app, no Safari chrome)

---

## Screen regions (top → bottom, ~390×844 pt logical)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | ~54 pt | Dark slate ~#3a4655 |
| Nav / header bar | 54–104 | ~50 pt | Dark slate ~#3a4655 |
| Email subject block | 104–190 | ~86 pt | White #ffffff |
| Sender / meta row | 190–244 | ~54 pt | White #ffffff, thin divider below |
| Email body (scrollable) | 244–790 | ~546 pt | White #ffffff |
| Home indicator safe area | 790–844 | ~54 pt | Light gray ~#f2f2f7 |

No bottom tab bar is visible — this is a full-screen pushed detail view (navigation stack). No FAB. No floating controls except the right-edge panel handle.

---

## Nav / header bar (exact)

- **Background:** Dark slate / dark teal ~#3a4655 (FUB's signature dark header)
- **Left control:** Back chevron "‹" — white, ~20 pt, ~44×44 pt tap target; navigates back to the conversation thread list or thread detail
- **Center:** Red/coral circle avatar (solid ~#e05252, 28 pt diameter) with white initials **"TC"** (font ~11 pt, bold) + white label **"Tiffany Clark"** (~17 pt medium, centered); the avatar + name together represent the contact this message belongs to
- **Right control:** **"···"** three-dot kebab icon (white, horizontal ellipsis glyph, ~44×44 pt tap target); opens an action sheet with options such as Reply, Forward, Mark Unread, Archive, etc.

---

## Bottom tab bar (exact)

The bottom tab bar is **not visible** in this pushed detail view — the navigation stack has fully replaced it. Based on FUB iOS conventions, the originating tab was **Inbox**. Standard FUB tab bar for reference:

| Order | Tab | Glyph | Badge | Active? |
|---|---|---|---|---|
| 1 | Inbox | Envelope/chat bubble | — | yes (origin) |
| 2 | Activity | Lightning bolt | — | — |
| 3 | Calendar | Calendar grid | — | — |
| 4 | People | Person silhouette | — | — |
| 5 | Deals | Dollar sign / handshake | — | — |

No FAB visible in this view.

---

## Content — every element, in order

### 1. Email subject block (y ~104–190 pt)

- **Full-width white card area**, no border/shadow, padding ~16 pt horizontal
- **Text:** "Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701"
  - Font: ~22 pt, bold/semibold, dark near-black ~#1a1a1a
  - Wraps to two lines
  - Line 1: "Order #WT0286975 - 20702"
  - Line 2: "Beaumont Drive, Bend OR 97701"
- This is the email **Subject** field rendered as the section heading for this message

### 2. Sender / meta row (y ~190–244 pt)

Anatomy (left → right):
- **Avatar:** Dark green circle (~36 pt diameter), solid ~#3d7a5a, white initials **"DW"** (~13 pt bold) — auto-generated from sender name
- **Sender name:** **"WTE Distribution"** — ~15 pt semibold, dark ~#1a1a1a
- **Timestamp:** **"Wed, 5:04pm"** — ~13 pt regular, medium gray ~#8e8e93, rendered below sender name
- **Reply button (right):** Light gray rounded-rectangle icon button (~36×36 pt, radius ~8 pt, bg ~#e9e9eb), containing a reply arrow glyph (curved arrow pointing left-up); tap opens reply composer for this specific email
- **Thin horizontal divider** below the row, ~1 pt, light gray ~#c6c6c8, full-width

### 3. Email body (y ~244–790 pt, scrollable)

White background, padding ~16 pt horizontal, body text ~15 pt regular, dark ~#1a1a1a, line-height ~1.5.

Content rendered in order:

**a. Logo block**
- Mountain-peak mark (two arched lines, SVG-style, black) centered or left-aligned
- Wordmark: **"Western"** in large serif (~28 pt), **"Title & Escrow"** in smaller caps/sans (~14 pt), presented inline or stacked below the mark
- No background, rendered on white

**b. Body paragraph 1**
> "Your Title Documents are attached."

**c. Body paragraph 2**
> "Please note this email address is not monitored."

**d. Body paragraph 3 (multi-sentence)**
> "For any Title related questions please contact Title Officer Support at titleofficersupport@westerntitle.com. For any Escrow related questions please contact your Escrow Officer by locating their contact information on your attached Report."
- The email address **titleofficersupport@westerntitle.com** is rendered as a tappable hyperlink in blue ~#007aff

**e. Body paragraph 4**
> "Western Title & Escrow Company greatly appreciates your business."

**f. Sign-off block**
> "Thank you,"
> (blank line)
> "The Distribution Team"

**g. Footer link**
> "www.westerntitle.com" — blue hyperlink ~#007aff, underlined, tappable; opens in Safari

### 4. Right-edge panel handle

- A small dark rounded pill/tab (~6×48 pt) visible at the right edge of the screen, approximately mid-screen vertically (~y 390 pt)
- Color: dark gray ~#636366, partially clipped by screen edge
- This is FUB's conversation-thread side-panel drawer handle; swiping left from the right edge or tapping it reveals a contextual side panel (thread navigator or contact info panel)

### 5. Bottom safe area

- ~54 pt tall, light gray ~#f2f2f7
- System home indicator bar centered
- No app UI content

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav bar bg | Dark slate ~#3a4655 (FUB brand dark teal/navy) |
| Status bar text | White #ffffff |
| Contact avatar (TC) | Coral/red ~#e05252, white text |
| Sender avatar (DW) | Dark green ~#3d7a5a, white text |
| Subject text | Near-black ~#1a1a1a, ~22 pt bold |
| Sender name | Near-black ~#1a1a1a, ~15 pt semibold |
| Timestamp | Medium gray ~#8e8e93, ~13 pt regular |
| Reply button bg | Light gray ~#e9e9eb |
| Body text | Near-black ~#1a1a1a, ~15 pt regular, line-height 1.5 |
| Hyperlinks | iOS blue ~#007aff, underlined |
| Row divider | Light gray ~#c6c6c8, 1 pt |
| Page background | White #ffffff |
| Home safe area | System gray ~#f2f2f7 |
| Side panel handle | Dark gray ~#636366 |
| FUB accent | Dark teal/slate header — NOT navy #102742 (this is FUB, not in-house app) |

**Typography:**
- Subject: ~22 pt, weight 700 (bold)
- Sender name: ~15 pt, weight 600 (semibold)
- Timestamp: ~13 pt, weight 400 (regular)
- Body: ~15–16 pt, weight 400, line-height ~1.5
- Avatar initials: ~11–13 pt, weight 700, white

**Iconography:**
- Back chevron: system SF Symbol `chevron.left`
- Kebab: system SF Symbol `ellipsis` (horizontal)
- Reply button: system SF Symbol `arrowshape.turn.up.left` or `arrowshape.turn.up.left.fill`
- Side handle: custom rounded rect pill

---

## Interactions & gestures [INFERRED]

| Gesture / Target | Behavior |
|---|---|
| Tap back chevron | Pop to previous screen (conversation thread or thread list) |
| Tap "Tiffany Clark" name / avatar in header | Navigate to Tiffany Clark's contact/lead profile page |
| Tap "···" kebab | Present action sheet: Reply, Reply All, Forward, Mark as Unread, Archive, Move to Folder, Delete |
| Tap reply arrow button (sender row) | Open compose sheet pre-filled as reply to this specific email |
| Tap email hyperlink (titleofficersupport@…) | Open iOS mail compose sheet or copy prompt |
| Tap www.westerntitle.com | Open in Safari in-app browser or system Safari |
| Swipe right from left edge | Pop back (iOS standard swipe-back gesture) |
| Tap / swipe left from right edge handle | Reveal side panel (thread navigator or contact context drawer) |
| Scroll up/down in body | Scrolls the email body content; header remains fixed |
| Pull down past top | Pull-to-refresh (may reload email thread) [INFERRED] |
| Long-press body text | iOS text selection menu (copy, look up, etc.) |

---

## Build notes (component tree)

```
<MobileShell bg="#ffffff">

  <StatusBar
    time="8:39"
    signal={true}
    wifi={true}
    battery={37}
    textColor="#ffffff"
    bg="#3a4655"
  />

  <TopBar bg="#3a4655" height={50}>
    <BackButton
      icon="chevron.left"
      color="#ffffff"
      onPress={() => navigation.goBack()}
    />
    <ContactIdentity centered>
      <Avatar
        initials="TC"
        bg="#e05252"
        size={28}
        textColor="#ffffff"
        fontSize={11}
      />
      <Label text="Tiffany Clark" color="#ffffff" fontSize={17} weight={500} />
    </ContactIdentity>
    <KebabMenu
      icon="ellipsis"
      color="#ffffff"
      options={["Reply", "Reply All", "Forward", "Mark Unread", "Archive", "Delete"]}
    />
  </TopBar>

  <ScrollView contentBg="#ffffff">

    {/* Subject section */}
    <SubjectBlock px={16} pt={16} pb={16}>
      <SubjectText
        text="Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701"
        fontSize={22}
        fontWeight={700}
        color="#1a1a1a"
        lineHeight={1.3}
      />
    </SubjectBlock>

    {/* Sender row */}
    <SenderRow px={16} py={12} borderBottom="1px solid #c6c6c8">
      <Avatar
        initials="DW"
        bg="#3d7a5a"
        size={36}
        textColor="#ffffff"
        fontSize={13}
        fontWeight={700}
      />
      <SenderMeta ml={10} flex={1}>
        <SenderName
          text="WTE Distribution"
          fontSize={15}
          fontWeight={600}
          color="#1a1a1a"
        />
        <Timestamp
          text="Wed, 5:04pm"
          fontSize={13}
          color="#8e8e93"
        />
      </SenderMeta>
      <ReplyButton
        icon="arrowshape.turn.up.left"
        bg="#e9e9eb"
        size={36}
        radius={8}
        iconColor="#3a4655"
        onPress={() => openReplyCompose(emailId)}
      />
    </SenderRow>

    {/* Email body — rendered HTML/webview or parsed text */}
    <EmailBody px={16} pt={20}>
      <EmailLogoBlock>
        {/* Western Title & Escrow SVG mountain mark + wordmark */}
        <Image src="western-title-escrow-logo.svg" height={60} resizeMode="contain" />
      </EmailLogoBlock>

      <BodyParagraph mt={20}>
        Your Title Documents are attached.
      </BodyParagraph>

      <BodyParagraph mt={16}>
        Please note this email address is not monitored.
      </BodyParagraph>

      <BodyParagraph mt={16}>
        For any Title related questions please contact Title Officer Support at{" "}
        <HyperLink href="mailto:titleofficersupport@westerntitle.com">
          titleofficersupport@westerntitle.com
        </HyperLink>.
        {" "}For any Escrow related questions please contact your Escrow Officer
        by locating their contact information on your attached Report.
      </BodyParagraph>

      <BodyParagraph mt={16}>
        Western Title & Escrow Company greatly appreciates your business.
      </BodyParagraph>

      <SignOff mt={24}>
        <BodyText>Thank you,</BodyText>
        <BodyText mt={8}>The Distribution Team</BodyText>
        <HyperLink href="https://www.westerntitle.com" mt={8}>
          www.westerntitle.com
        </HyperLink>
      </SignOff>
    </EmailBody>

  </ScrollView>

  {/* Right-edge side panel handle */}
  <SidePanelHandle
    position="absolute"
    right={0}
    top="50%"
    width={6}
    height={48}
    bg="#636366"
    borderRadius={3}
    onPress={() => openContextDrawer()}
  />

  <HomeIndicator bg="#f2f2f7" />

</MobileShell>
```

### Data bindings

| Component | Data field |
|---|---|
| TopBar contact name | `contact.displayName` ("Tiffany Clark") |
| TopBar avatar | `contact.initials` ("TC"), `contact.avatarColor` (#e05252) |
| SubjectText | `email.subject` |
| SenderRow avatar initials | `email.senderInitials` ("DW") auto-generated from sender name |
| SenderRow avatar color | auto-assigned from sender hash (green ~#3d7a5a for "WTE Distribution") |
| SenderName | `email.senderName` ("WTE Distribution") |
| Timestamp | `email.sentAt` formatted as "Wed, 5:04pm" |
| EmailBody | `email.bodyHtml` — render via WebView or sanitized dangerouslySetInnerHTML |

### Spacing / sizing specifics

- Header height: 50 pt (nav bar only, excluding status bar)
- Back chevron tap target: 44×44 pt minimum
- Contact avatar in header: 28 pt diameter
- Sender avatar in row: 36 pt diameter
- Reply button: 36×36 pt, border-radius 8 pt
- Subject block padding: 16 pt horizontal, 16 pt vertical
- Sender row padding: 16 pt horizontal, 12 pt vertical
- Email body padding: 16 pt horizontal, 20 pt top
- Body font: 15 pt, line-height 1.5 (~22–24 pt)
- Paragraph spacing: 16 pt between blocks
- Side panel handle: 6×48 pt, radius 3 pt, absolute right edge

### Implementation notes

- The email body is likely rendered in a `WKWebView` (iOS) or `WebView`/`iframe` (web rebuild) to preserve HTML formatting, logo images, and link styles from the original email
- For the web rebuild: use a sandboxed `<iframe srcdoc={email.bodyHtml}>` with `sandbox="allow-same-origin allow-popups"` OR sanitize + render with DOMPurify and inject into a scrollable `<div>`
- Avatar colors should be deterministically assigned from a hash of the sender/contact name to ensure consistency across sessions
- The reply button should trigger the Compose module (inline sheet or push to compose screen) pre-populated with To, Subject (Re:…), and thread quote
- The side panel handle maps to a Radix `<Sheet side="right">` drawer revealing contact context (Tiffany Clark's deal/lead info, notes, prior messages)

<!-- Mobile per-screen appendix. Original: IMG_6006.PNG | id: mob-39 | tiles: mob-tiles/mob-39_{full,t,m,b}.png -->

# mob-39 — fub-ios — SMS Attachment Picker Sheet (over Conversation View)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Compose (email / text / call) — SMS attachment-type picker action sheet
- **screen:** A modal bottom sheet that slides up over an open SMS/text conversation with lead "Andy Christensen". The sheet offers six attachment/action options for the message composer. The conversation thread is the underlying view (dimmed/inactive behind the sheet).
- **How to reach:** Open a lead's conversation thread (Inbox tab → conversation row → SMS thread view) → tap the attachment/media icon in the message composer toolbar. The sheet slides up from the bottom, partially obscuring the thread.
- **iOS status bar:** Time "6:51" (left), signal bars + "5G" + battery "22" with yellow low-battery indicator (right). White text on dark teal background.
- **URL bar:** N/A — native iOS app, no Safari chrome.

---

## Screen regions (top → bottom, y-bands in pt on 390×844pt canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | `#2e4a58` (dark teal, same as nav bar) |
| Nav / header bar | 54–104 | 50 | `#2e4a58` (dark teal) |
| Dimmed conversation background | 104–525 | ~421 | `#e5e5e5` (light gray — the message thread, visually inactive behind the sheet) |
| Bottom sheet drag handle zone | 525–545 | 20 | `#FFFFFF` (white sheet, pill handle visible) |
| Bottom sheet content — Group 1 (media) | 545–800 | ~255 | `#FFFFFF` |
| Bottom sheet divider | ~800–802 | 2 | `#e0e0e0` (hairline separator) |
| Bottom sheet content — Group 2 (advanced) | 802–930 | ~128 | `#FFFFFF` |
| Bottom sheet safe-area padding / home indicator | 930–844+ | remainder | `#FFFFFF` |

---

## Nav / header bar (exact)

**Background:** `#2e4a58` (FUB dark teal — same slate-blue-green used throughout the FUB iOS nav chrome)

| Position | Element | Detail |
|---|---|---|
| Left | Back chevron `<` | White, ~22pt, standard iOS back glyph; taps back to the previous list/conversation list |
| Center-left | Avatar circle | 34pt diameter, burnt-orange fill (`#c96a1a` approx.), white "AC" initials in ~14pt medium weight. Tappable — navigates to Andy Christensen's full contact profile |
| Center | Name title | "Andy Christensen" — white, ~17pt semibold. Followed immediately by a `>` chevron (white, small) indicating the name itself is a tappable link to the contact detail view |
| Right-1 | Phone handset icon | White outlined telephone/handset glyph, ~22pt. Taps to initiate a call to Andy Christensen |
| Right-2 | Kebab / more icon | Three horizontal dots `···`, white, ~22pt. Opens a secondary options menu for the conversation (e.g., mark unread, snooze, notes) |

---

## Bottom tab bar (exact)

**Not visible in this screenshot** — the bottom sheet extends to the bottom of the screen and covers the tab bar entirely. The tab bar is present in the underlying view but cannot be seen or read.

FUB iOS standard tab bar order (inferred from other screens): Inbox · Activity · Calendar · People · Deals. Active tab cannot be determined from this view; the user most likely arrived via the Inbox tab (conversation thread). No badge counts or active-color indicators are readable.

---

## Content — every element in order

### A. Dimmed underlying conversation area (y 104–525)

- Large uniform light-gray rectangle (`#e5e5e5`). This is the SMS message thread view rendered beneath the sheet. No message bubbles, timestamps, or composer toolbar are legible — the area appears as a solid scrim, either because the conversation has no messages yet or because the background is dimmed/blurred by the sheet overlay.
- No interactive elements are accessible while the sheet is open.

### B. Bottom sheet modal

**Sheet surface:** White `#FFFFFF`, full-width (390pt), presented as a detached floating card with rounded top corners (radius ~14pt). Slides up from bottom via standard iOS `UISheetPresentationController` or equivalent.

**Drag handle / dismiss indicator**
- Horizontal pill: ~36pt wide × 4pt tall, `#d0d0d0` (light gray), centered horizontally at ~y 532pt.
- Tap anywhere outside the sheet OR swipe down to dismiss.

---

#### Group 1 — Media attachment options (no section header)

Each row: 20pt left padding, icon (~24×24pt, stroke style, black `#1a1a1a`), 16pt gap, label text (~17pt regular weight, black `#1a1a1a`), full-width tap target (~56–60pt tall), no right-side chevron, no divider between rows within this group.

**Row 1 — Photo Library**
- Icon: stacked photo frames (two overlapping rectangles with a small mountain/landscape inside the top one). Standard iOS photo-picker icon style.
- Label: "Photo Library"
- Action [INFERRED]: Opens iOS Photos library picker (PHPickerViewController) to select an existing photo to send in the SMS thread.

**Row 2 — Video Library**
- Icon: Film strip with play-button triangle inside (clapperboard/filmstrip style). Three horizontal dashes on left edge representing sprocket holes.
- Label: "Video Library"
- Action [INFERRED]: Opens iOS Photos library filtered to videos only.

**Row 3 — Take picture**
- Icon: Camera body outline (rounded rectangle body, small circular lens, top shutter bump). Standard camera glyph.
- Label: "Take picture"
- Action [INFERRED]: Launches device camera in photo mode (AVFoundation camera capture).

**Row 4 — Record video**
- Icon: Combination of a camera body outline + a film/record indicator (small vertical line to the right of the lens circle, representing a video-record cue). Slightly different from the still-camera icon.
- Label: "Record video"
- Action [INFERRED]: Launches device camera in video-record mode.

---

#### Divider
- Full-width hairline `#e0e0e0` (1pt), separates media capture rows from the functional/CRM rows below.

---

#### Group 2 — CRM-specific actions (no section header)

Same row anatomy as Group 1. Same 20pt left padding, icon + label layout.

**Row 5 — Send vCard**
- Icon: Document/card with a contact silhouette (person outline) and horizontal lines suggesting text fields. vCard/contact-card glyph.
- Label: "Send vCard"
- Action [INFERRED]: Attaches and sends the logged-in agent's vCard (contact info) as an MMS to the lead, so the lead can easily save the broker's contact details.

**Row 6 — Use template**
- Icon: Stacked pages/sheets glyph — a document in the background with a slightly smaller foreground document overlapping it (template/clone metaphor). Dashed border on back page.
- Label: "Use template"
- Action [INFERRED]: Opens FUB's built-in SMS template library, allowing the broker to insert a pre-written message template into the composer before sending.

---

#### Bottom padding
- ~80–100pt of empty white space below "Use template" before the home indicator, providing visual breathing room and accommodating the iPhone home bar.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav bar background | `#2e4a58` (dark teal — FUB brand, NOT in-house navy `#102742`) |
| Header text | `#FFFFFF` white |
| Avatar fill | `#c96a1a` (burnt orange/amber — FUB auto-assigns avatar colors per contact initials hash) |
| Avatar initials | `#FFFFFF` white |
| Sheet background | `#FFFFFF` pure white |
| Sheet row label text | `#1a1a1a` near-black |
| Sheet row icon stroke | `#1a1a1a` near-black, stroke weight ~1.5–2pt |
| Drag handle pill | `#d0d0d0` mid-gray |
| Group divider | `#e0e0e0` hairline |
| Conversation scrim background | `#e5e5e5` light gray |
| iOS status bar text/icons | `#FFFFFF` white |
| Battery indicator (low) | Yellow `#FFD60A` background with "22" |
| Font — nav title | ~17pt, semibold weight, SF Pro Text (iOS system) |
| Font — row labels | ~17pt, regular weight, SF Pro Text |
| Icon style | Outline/stroke (not filled), ~24×24pt, consistent 1.5pt stroke weight |
| FUB accent color | Teal `#2e4a58` (header/nav chrome); orange accent for avatars is per-contact auto-generated |

---

## Interactions & gestures

| Target | Gesture | Action |
|---|---|---|
| Back chevron `<` | Tap | Pop back to prior screen (conversation list or contact detail, depending on nav stack) |
| "Andy Christensen >" in header | Tap | Push to Andy Christensen's full contact/lead detail profile view |
| Phone handset icon | Tap | Initiate phone call to Andy Christensen (via FUB's dialer flow) |
| `···` kebab icon | Tap | Open contextual action menu for the conversation (mark unread, snooze, etc.) [INFERRED] |
| Drag handle / sheet background outside rows | Swipe down or tap outside | Dismiss sheet, return to composer |
| Photo Library row | Tap | Opens iOS Photos picker for images |
| Video Library row | Tap | Opens iOS Photos picker filtered to videos |
| Take picture row | Tap | Opens device camera → photo mode |
| Record video row | Tap | Opens device camera → video mode |
| Send vCard row | Tap | Composes and sends agent vCard as MMS; may show confirmation dialog [INFERRED] |
| Use template row | Tap | Pushes to template library screen OR fills composer with template text [INFERRED] |
| Pull-to-refresh | N/A | Sheet modal does not support pull-to-refresh; underlying conversation may |

---

## Build notes (component tree)

```
<MobileShell bg="#e5e5e5">

  {/* Underlying conversation — dimmed/inactive while sheet open */}
  <ConversationThread
    contact={andyChristensen}
    dimmed={true}                         // overlay applied: rgba(0,0,0,0.15) or similar
    style={{ pointerEvents: 'none' }}
  />

  {/* Sticky nav bar — stays above conversation AND sheet */}
  <TopBar bg="#2e4a58">
    <BackChevron color="#FFFFFF" onPress={popNavigation} />
    <ContactHeaderButton onPress={navigateToContactDetail}>
      <AvatarCircle
        initials="AC"
        size={34}
        fill="#c96a1a"
        textColor="#FFFFFF"
      />
      <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 17 }}>
        Andy Christensen
      </Text>
      <ChevronRight size={14} color="#FFFFFF" />
    </ContactHeaderButton>
    <IconButton icon="phone" color="#FFFFFF" onPress={initiateCall} />
    <IconButton icon="dots-horizontal" color="#FFFFFF" onPress={openContextMenu} />
  </TopBar>

  {/* Bottom sheet modal */}
  <BottomSheet
    snapPoints={['auto']}               // content-height driven, ~60% of screen
    cornerRadius={14}
    bg="#FFFFFF"
    handleIndicatorColor="#d0d0d0"
    onDismiss={closeSheet}
  >
    <DragHandle />                        {/* 36×4pt pill, centered, color #d0d0d0 */}

    {/* Group 1 — Media options */}
    <SheetOptionRow
      icon={<PhotoLibraryIcon />}         {/* stacked photos glyph, 24×24, stroke */}
      label="Photo Library"
      onPress={openPhotoLibrary}
    />
    <SheetOptionRow
      icon={<VideoLibraryIcon />}         {/* filmstrip + play glyph */}
      label="Video Library"
      onPress={openVideoLibrary}
    />
    <SheetOptionRow
      icon={<CameraIcon />}               {/* camera body glyph */}
      label="Take picture"
      onPress={openCamera}
    />
    <SheetOptionRow
      icon={<RecordVideoIcon />}          {/* camera + record indicator glyph */}
      label="Record video"
      onPress={openVideoRecorder}
    />

    <Divider color="#e0e0e0" />

    {/* Group 2 — CRM actions */}
    <SheetOptionRow
      icon={<VCardIcon />}                {/* contact card glyph */}
      label="Send vCard"
      onPress={sendVCard}
    />
    <SheetOptionRow
      icon={<TemplateIcon />}             {/* stacked-pages glyph */}
      label="Use template"
      onPress={openTemplateLibrary}
    />

    <SafeAreaBottomPad />
  </BottomSheet>

</MobileShell>
```

### SheetOptionRow anatomy
```
<SheetOptionRow>
  padding: 0 20pt
  height: ~58pt
  flexDirection: row
  alignItems: center
  gap: 16pt
  bg: #FFFFFF
  activeOpacity: 0.6   // iOS standard press feedback

  <Icon size={24} strokeColor="#1a1a1a" strokeWidth={1.5} />
  <Text fontSize={17} fontWeight="400" color="#1a1a1a" letterSpacing={0}>
    {label}
  </Text>
  {/* No right-side chevron */}
</SheetOptionRow>
```

### Data bindings
- `contact.id` → used to resolve who the vCard is for, which template defaults to show
- `contact.displayName` → "Andy Christensen" in header
- `contact.initials` → "AC" avatar
- `contact.avatarColor` → `#c96a1a` (FUB-assigned per contact hash)
- `conversation.id` → attachment is threaded into this conversation on upload
- `agent.vCardData` → payload for Send vCard action
- `templates[]` → list loaded when "Use template" is tapped

### Sizing constants
- Nav bar total height (status + header): 104pt
- Sheet drag handle: 36pt × 4pt, y-centered in 20pt handle zone
- Sheet option row height: 58pt
- Icon size: 24×24pt, stroke 1.5pt, color `#1a1a1a`
- Icon-to-label gap: 16pt
- Left padding: 20pt
- Group divider: 1pt, full width, `#e0e0e0`
- Sheet corner radius (top only): 14pt
- Sheet min bottom padding: 34pt (iPhone home indicator safe area)

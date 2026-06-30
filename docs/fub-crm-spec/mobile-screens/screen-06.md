<!-- Mobile per-screen appendix. Original: IMG_5826.PNG | id: mob-06 | tiles: mob-tiles/mob-06_{full,t,m,b}.png -->

# mob-06 — fub-ios — Settings (Modal)

## Identity
- **app_source:** fub-ios — native Follow Up Boss iPhone app. Confirmed by: dark slate header (#3A4A58 approx), "Close" dismiss button (modal presentation pattern), FUB-specific feature rows (Zillow lead alerts, Caller ID, "Follow Up Boss" brand text in row copy), app version string "6.06.0100 (271)".
- **module:** Settings / Account
- **screen name:** Settings
- **how to reach:** Tap the user avatar/profile icon from any primary tab (typically the hamburger or avatar in the top-left of Activity/Inbox/People tabs) → Settings presented as a **full-screen modal** (not a pushed navigation stack). The "Close" button in the top-left of the nav bar dismisses the modal back to the triggering tab.
- **iOS status bar:** Time: **4:33** · Signal: 2 of 4 bars · WiFi icon · Battery: **100%** with charging (lightning bolt) indicator. Status bar text and icons render **white** on the dark slate header background.
- **URL bar:** N/A — native iOS app, no Safari chrome.

---

## Screen regions (top → bottom, 390×844 pt logical)

| Region | y-band (pt) | Height (approx) | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 pt | Dark slate `#3A4A58` |
| Nav / header bar | 44–94 | 50 pt | Dark slate `#3A4A58` |
| Profile card | 94–170 | 76 pt | White `#FFFFFF` |
| Section gap | 170–186 | 16 pt | Light gray `#EEF0F3` |
| Feature settings section | 186–490 | 304 pt | White `#FFFFFF` |
| Section gap | 490–506 | 16 pt | Light gray `#EEF0F3` |
| Support / links section | 506–760 | 254 pt | White `#FFFFFF` |
| Bottom safe-area padding | 760–844 | 84 pt | Light gray `#EEF0F3` |

No bottom tab bar is visible — this is a modal sheet that occludes the tab bar.

---

## Nav / header bar (exact)

- **Background:** Dark slate `#3A4A58`
- **Left control:** Text button "**Close**" — white, SF Pro Regular ~17 pt. Tapping dismisses the modal (pop/dismiss animation).
- **Center:** Title "**Settings**" — white, SF Pro Semibold ~17 pt, horizontally centered.
- **Right control:** None.

---

## Bottom tab bar (exact)

**Not visible.** This screen is a full-screen modal; the tab bar from the originating view is hidden beneath it. No FAB (+) present on this screen.

---

## Content — every element, in order

### 1. Profile card (y ~94–170 pt)

Single row, white background, 16 pt left/right padding, ~76 pt tall.

| Sub-element | Detail |
|---|---|
| Avatar | Circular photo, ~52×52 pt, 1 pt light gray border ring, displays Matt Ryan's actual headshot photo (bald man in light blue collared shirt, smiling). No initials fallback visible. |
| Primary text | "**Matt Ryan**" — dark navy `#1A2B3C` approx, SF Pro Semibold ~17 pt |
| Secondary text | "**Admin**" — medium gray `#8A95A0` approx, SF Pro Regular ~14 pt, below name |

Row is tappable [INFERRED] → navigates to account/profile edit screen.

---

### 2. Feature settings section (y ~186–490 pt)

White background. Five rows, separated by 1 pt hairline dividers in `#E5E7EA`. Each row is ~60–68 pt tall with 16 pt left padding. Left icon area is a filled circle badge ~36 pt diameter with white glyph inside.

#### Row 1 — App version status

| Element | Value |
|---|---|
| Icon circle color | Orange `#F5943C` |
| Icon glyph | White mobile phone / smartphone silhouette (front-facing phone outline) |
| Primary text | "**Your app is up to date**" — dark `#1A2B3C`, SF Pro Semibold ~16 pt |
| Secondary text | "Currently using version 6.06.0100 (271)" — gray `#8A95A0`, SF Pro Regular ~13 pt |
| Right control | None (no chevron, no status label) |
| Tappable | No / informational only [INFERRED] |

#### Row 2 — Push notifications

| Element | Value |
|---|---|
| Icon circle color | Purple `#9B59B6` |
| Icon glyph | White speech bubble with horizontal lines (notification/chat bubble icon) |
| Primary text | "**Push notifications**" — dark `#1A2B3C`, SF Pro Semibold ~16 pt |
| Secondary text | "Get notified of new leads and texts" — gray `#8A95A0`, SF Pro Regular ~13 pt |
| Right control | Text label "**Enabled**" — gray `#8A95A0`, SF Pro Regular ~15 pt, right-aligned |
| Tappable | Yes → navigates to push notification permission / OS settings deep-link [INFERRED] |

#### Row 3 — Zillow lead alerts

| Element | Value |
|---|---|
| Icon circle color | Blue `#2B7CD3` |
| Icon glyph | Zillow "Z" logo mark (blue circle with white stylized Z — Zillow brand badge) |
| Primary text | "**Zillow lead alerts**" — dark `#1A2B3C`, SF Pro Semibold ~16 pt |
| Secondary text | "Allow time-sensitive Zillow lead alerts" — gray `#8A95A0`, SF Pro Regular ~13 pt |
| Right control | Text label "**Enabled**" — gray `#8A95A0`, SF Pro Regular ~15 pt, right-aligned |
| Tappable | Yes → toggles or navigates to Zillow alert permission settings [INFERRED] |

#### Row 4 — Caller ID

| Element | Value |
|---|---|
| Icon circle color | Green `#27AE60` |
| Icon glyph | White phone handset icon (classic telephone receiver, angled left) |
| Primary text | "**Caller ID**" — dark `#1A2B3C`, SF Pro Semibold ~16 pt |
| Secondary text | "Show name on incoming calls" — gray `#8A95A0`, SF Pro Regular ~13 pt |
| Right control | Text label "**Enabled**" — gray `#8A95A0`, SF Pro Regular ~15 pt, right-aligned |
| Tappable | Yes → navigates to Caller ID permission / iOS contacts permission [INFERRED] |

#### Row 5 — Always text in app

| Element | Value |
|---|---|
| Icon | None — no left icon circle on this row |
| Left padding | 16 pt (flush left, no icon offset) |
| Primary text | "**Always text in app**" — dark `#1A2B3C`, SF Pro Semibold ~16 pt |
| Secondary text | "Send all texts via Follow Up Boss" — gray `#8A95A0`, SF Pro Regular ~13 pt |
| Right control | **iOS UISwitch toggle** — state: **ON** (green `#34C759` / system green). Thumb is white circle on right side of track. |
| Tappable | Yes → toggle flips between ON/OFF, controls whether SMS uses FUB in-app texting or native iOS Messages |

---

### 3. Support / links section (y ~506–760 pt)

White background. Five rows, 1 pt hairline dividers `#E5E7EA`. Each row ~50–56 pt tall, 16 pt left padding, 16 pt right padding.

#### Row 1 — Report a bug

| Element | Value |
|---|---|
| Primary text | "**Report a bug**" — dark `#1A2B3C`, SF Pro Regular ~16 pt |
| Right control | Chevron `›` — gray `#C7C9CC`, ~14 pt |
| Tappable | Yes → opens bug report form or email compose [INFERRED] |

#### Row 2 — Support

| Element | Value |
|---|---|
| Primary text | "**Support**" — dark `#1A2B3C`, SF Pro Regular ~16 pt |
| Right value | "support@followupboss.com" — teal/blue link color `#3B7FC4` approx, SF Pro Regular ~13 pt, right-aligned |
| Right control | No chevron |
| Tappable | Yes → opens Mail app to compose to support@followupboss.com [INFERRED] |

#### Row 3 — Feedback

| Element | Value |
|---|---|
| Primary text | "**Feedback**" — dark `#1A2B3C`, SF Pro Regular ~16 pt |
| Right value | "product@followupboss.com" — teal/blue link color `#3B7FC4` approx, SF Pro Regular ~13 pt, right-aligned |
| Right control | No chevron |
| Tappable | Yes → opens Mail app to compose to product@followupboss.com [INFERRED] |

#### Row 4 — Acknowledgements

| Element | Value |
|---|---|
| Primary text | "**Acknowledgements**" — dark `#1A2B3C`, SF Pro Regular ~16 pt |
| Right control | Chevron `›` — gray `#C7C9CC`, ~14 pt |
| Tappable | Yes → pushes third-party open-source acknowledgements screen [INFERRED] |

#### Row 5 — Community

| Element | Value |
|---|---|
| Primary text | "**Community**" — dark `#1A2B3C`, SF Pro Regular ~16 pt |
| Right control | Chevron `›` — gray `#C7C9CC`, ~14 pt |
| Tappable | Yes → opens FUB Community forum (external Safari or in-app WKWebView) [INFERRED] |

---

## Colors, type & iconography

| Token | Value | Usage |
|---|---|---|
| Header bg | `#3A4A58` (dark slate) | Nav bar, status bar |
| Header text | `#FFFFFF` | "Close", "Settings", status bar icons |
| Page bg (sections) | `#FFFFFF` | Profile card, feature rows, support rows |
| Section separator bg | `#EEF0F3` | Between section groups, bottom safe area |
| Row dividers | `#E5E7EA` hairline 1 pt | Between rows within sections |
| Primary text | `#1A2B3C` (dark navy) | Row labels |
| Secondary text / meta | `#8A95A0` (medium gray) | Subtitles, "Enabled" labels |
| Link/email color | `#3B7FC4` (FUB blue) | support@, product@ email addresses |
| Chevron | `#C7C9CC` (light gray) | Right-side navigation indicators |
| Icon circle — orange | `#F5943C` | App version row |
| Icon circle — purple | `#9B59B6` | Push notifications row |
| Icon circle — blue | `#2B7CD3` | Zillow lead alerts row (Zillow brand blue) |
| Icon circle — green | `#27AE60` | Caller ID row |
| Toggle ON color | `#34C759` (system green) | "Always text in app" toggle |
| Avatar border | `#E5E7EA` 1 pt ring | Profile photo |

**Typography:** All SF Pro (system font). Nav bar title: Semibold 17 pt. Row primary labels: Semibold 16 pt (feature section) / Regular 16 pt (support section). Row subtitles: Regular 13 pt. Right meta ("Enabled", emails): Regular 13–15 pt. Avatar name: Semibold 17 pt. Avatar role: Regular 14 pt.

**FUB accent:** The FUB accent is a blue-teal `#3B7FC4` — used on email link values and inferred as the active tab color in the underlying tab bar.

---

## Interactions & gestures (mark [INFERRED])

| Gesture / Target | Behavior |
|---|---|
| Tap "Close" | Dismiss modal, return to originating tab with slide-down animation [INFERRED] |
| Tap profile card row | Navigate to account/profile edit screen (push) [INFERRED] |
| Tap "Your app is up to date" row | No-op / informational — may show an alert or check for updates [INFERRED] |
| Tap "Push notifications" | Deep-links to iOS Settings > Notifications > FUB [INFERRED] |
| Tap "Zillow lead alerts" | Navigates to Zillow alerts sub-setting screen or toggles permission [INFERRED] |
| Tap "Caller ID" | Deep-links to iOS Contacts permission or FUB caller-ID sub-setting [INFERRED] |
| Toggle "Always text in app" | Flips switch; writes preference to FUB account settings via API [INFERRED] |
| Tap "Report a bug" | Presents in-app feedback form or opens Mail compose to a bug-report address [INFERRED] |
| Tap "Support" | Opens `mailto:support@followupboss.com` in Mail app [INFERRED] |
| Tap "Feedback" | Opens `mailto:product@followupboss.com` in Mail app [INFERRED] |
| Tap "Acknowledgements" | Pushes full-screen open-source licence list [INFERRED] |
| Tap "Community" | Opens FUB Community URL in Safari or WKWebView [INFERRED] |
| Pull to refresh | Not applicable on a settings screen [INFERRED] |
| Swipe down | Dismisses modal on iOS 13+ interactive dismissal [INFERRED] |

---

## Build notes (component tree)

```
<SettingsModal>                          /* Full-screen modal, no tab bar */

  <TopBar                                /* sticky, z-index above scroll */
    leftControl={<TextButton label="Close" onPress={onDismiss} />}
    title="Settings"
    bg="#3A4A58"
    titleColor="#FFFFFF"
    leftColor="#FFFFFF"
  />

  <ScrollView contentInsetAdjustmentBehavior="automatic">

    {/* Profile card */}
    <SectionCard topMargin={0}>
      <ProfileRow
        avatar={<CircleAvatar src={user.photoUrl} size={52} borderColor="#E5E7EA" />}
        name="Matt Ryan"                 /* user.fullName */
        role="Admin"                     /* user.role */
        onPress={navigateToProfileEdit}
      />
    </SectionCard>

    <SectionGap height={16} bg="#EEF0F3" />

    {/* Feature settings group */}
    <SectionCard>

      <SettingsIconRow
        iconBg="#F5943C"
        iconGlyph="smartphone"           /* outline mobile phone icon, white */
        label="Your app is up to date"
        subtitle={`Currently using version ${appVersion}`}
        rightControl={null}
        tappable={false}
      />
      <RowDivider />

      <SettingsIconRow
        iconBg="#9B59B6"
        iconGlyph="notification-bubble"  /* white speech bubble, notification style */
        label="Push notifications"
        subtitle="Get notified of new leads and texts"
        rightControl={<StatusLabel text="Enabled" />}
        onPress={openPushNotificationSettings}
      />
      <RowDivider />

      <SettingsIconRow
        iconBg="#2B7CD3"
        iconGlyph="zillow-z"             /* Zillow Z logomark, white on blue */
        label="Zillow lead alerts"
        subtitle="Allow time-sensitive Zillow lead alerts"
        rightControl={<StatusLabel text="Enabled" />}
        onPress={openZillowAlertSettings}
      />
      <RowDivider />

      <SettingsIconRow
        iconBg="#27AE60"
        iconGlyph="phone-handset"        /* white classic telephone receiver */
        label="Caller ID"
        subtitle="Show name on incoming calls"
        rightControl={<StatusLabel text="Enabled" />}
        onPress={openCallerIdSettings}
      />
      <RowDivider />

      <SettingsToggleRow
        iconCircle={null}                /* no icon on this row */
        label="Always text in app"
        subtitle="Send all texts via Follow Up Boss"
        value={alwaysTextInApp}          /* boolean, true = ON */
        onChange={setAlwaysTextInApp}
        toggleColor="#34C759"
      />

    </SectionCard>

    <SectionGap height={16} bg="#EEF0F3" />

    {/* Support links group */}
    <SectionCard>

      <SettingsLinkRow
        label="Report a bug"
        rightControl={<Chevron />}
        onPress={openBugReport}
      />
      <RowDivider />

      <SettingsEmailRow
        label="Support"
        email="support@followupboss.com"
        emailColor="#3B7FC4"
      />
      <RowDivider />

      <SettingsEmailRow
        label="Feedback"
        email="product@followupboss.com"
        emailColor="#3B7FC4"
      />
      <RowDivider />

      <SettingsLinkRow
        label="Acknowledgements"
        rightControl={<Chevron />}
        onPress={openAcknowledgements}
      />
      <RowDivider />

      <SettingsLinkRow
        label="Community"
        rightControl={<Chevron />}
        onPress={openCommunityUrl}
      />

    </SectionCard>

    <SectionGap height={84} bg="#EEF0F3" />   /* bottom safe area */

  </ScrollView>

</SettingsModal>
```

### Sizing / spacing spec

| Metric | Value |
|---|---|
| TopBar height | 50 pt (44 pt nav + visual padding) |
| Profile row height | ~76 pt |
| Avatar diameter | 52 pt |
| Avatar border | 1 pt `#E5E7EA` |
| Feature row height | ~64 pt |
| Support row height | ~52 pt |
| Row left padding | 16 pt |
| Row right padding | 16 pt |
| Icon circle diameter | 36 pt |
| Icon circle to label gap | 12 pt |
| Section gap height | 16 pt |
| RowDivider | 1 pt `#E5E7EA`, inset 16 pt from left (starts after icon area, ~64 pt from left) |
| Toggle width | ~51 pt (standard iOS UISwitch) |
| Toggle height | ~31 pt |
| Chevron glyph | SF Symbol `chevron.right`, gray `#C7C9CC`, 14 pt |

### Data bindings

| Component | Binds to |
|---|---|
| ProfileRow | `currentUser.fullName`, `currentUser.role`, `currentUser.avatarUrl` |
| App version row | `appInfo.version` string from native bundle |
| Push notifications status | `notificationPermission.status` ("Enabled" / "Disabled") |
| Zillow lead alerts status | `settings.zillowAlerts` boolean / string |
| Caller ID status | `settings.callerIdEnabled` boolean |
| Always text in app toggle | `settings.alwaysTextInApp` boolean, mutated via PATCH /v1/users/settings |
| Support email | hardcoded "support@followupboss.com" |
| Feedback email | hardcoded "product@followupboss.com" |

### In-house web rebuild notes

For the Ryan Realty in-house CRM equivalent, replace:
- Dark slate header `#3A4A58` → navy `#102742`
- FUB blue link color `#3B7FC4` → in-house accent blue
- "Follow Up Boss" references in row subtitles → "Ryan Realty CRM"
- Zillow-specific row → omit or replace with a Ryan Realty-relevant integration toggle
- App version string → web app version from `package.json`
- The modal pattern stays identical (full-screen sheet with Close button, no tab bar visible)
- Use `<Sheet>` from `@/components/ui/sheet` for the modal container
- Use `<Switch>` from `@/components/ui/switch` for the toggle
- Use `<Avatar>` from `@/components/ui/avatar` for the profile photo
- Row dividers: `<Separator>` from `@/components/ui/separator`

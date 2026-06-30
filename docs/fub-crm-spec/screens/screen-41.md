<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.28.28 AM.png | Sequential id: shot-41 | Tiles: fub-tiles/shot-41_{full,q1,q2,q3,q4}.png -->

# shot-41 — Company Settings (Admin) — Calling, Office Hours, Subdomain, Business Insights, Block List

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/company-settings`
- **Browser tab title:** "Company Settings - Follow U…" (truncated)
- **Active top-nav item:** Not directly visible (this is within the Admin → Company Settings area; the FUB primary nav is above the scroll position or not in frame at its typical left-rail position)
- **Sub-nav / tab active:** This is a scrolled-down view of the Company Settings form. The visible portion starts mid-page, showing the Phone/Calling subsection through the Block List section. No tab strip is visible — this is a single long scrolling page.
- **Breadcrumbs:** None visible
- **Logged-in user:** The browser top-right shows a profile avatar labeled **"Work"** (a profile switcher in Chrome, not a FUB user indicator). Within FUB itself, the account is **Ryan Realty** (confirmed by: subdomain `ryan-realty.followupboss.com`, spam label protection "Ryan Realty LLC", and the Production Goals value).
- **Account / brokerage name:** Ryan Realty LLC

---

## Layout

The screen is a scrolled-down view of the FUB Company Settings admin page. The page has scrolled past the top of the form; no FUB global top navigation bar or settings left-rail category navigation is visible in this frame.

### Regions visible in this frame

| Region | Approximate position (full image, ~768×471px) | Description |
|---|---|---|
| **Left gray empty area** | x 0–230, y 0–471 | Pure light-gray (`#f0f2f5` approx.) background. This is the area where a settings left-rail navigation would typically sit (above the scroll point) or where the form label column starts but has no labels for these rows. |
| **Settings form content column** | x 230–520, y 0–471 | The primary content: a two-column layout of (label/description col) + (value/control col). Fields are grouped under all-caps section headers with horizontal rule dividers. |
| **Right gray empty area** | x 520–768, y 0–471 | Light-gray background. Right margin of the centered settings panel. |
| **Save button** | x ~460–510, y ~437–453 | Bottom-right of the form content area. Blue filled rounded button. |
| **Help/chat widget** | x ~750–768, y ~450–471 | "?" icon in a circle, bottom-right corner of the page. Support chat or help trigger. |

### Layout pattern

- The settings page uses a **two-column form layout** within a centered content card:
  - **Left column** (~55% of the content area): Label text, help icons, description prose
  - **Right column** (~45% of the content area): Value display, input controls, action links
- Section dividers are **small-caps all-uppercase centered headers** ("OFFICE HOURS", "SUBDOMAIN", "BUSINESS INSIGHTS", "BLOCK LIST") flanked by thin horizontal rules, creating visual grouping without full card separation.
- The page appears to be a **scrollable single column** (no sticky header visible in frame).
- A thin vertical **scrollbar** appears at the far right edge of the browser window, indicating the page is scrollable and this is not the top.
- The left portion (~230px wide) is fully empty gray — this is where the **settings category sidebar nav** lives when the page is at the top, but in this scrolled position it appears empty (the sidebar is fixed-position and would be visible at the top; this area just shows background).

---

## Every UI element (exhaustive)

### PHONE section

**Section label/group header:** Implicit — the word "Phone" appears as a field label (not a full section header bar), paired with a **"?" (help / tooltip icon)** to its right. This is the top of the visible area.

**"Manage Settings" link:**
- Appears to the right of the Phone field label row
- Preceded by a small **external-link or settings icon** (a small square with an arrow, or a settings cog — approximately 12×12px)
- Text: `Manage Settings` in blue link color (`#4a90e2` approx.)
- [INFERRED] Opens a sub-page or modal to configure the phone/calling feature in detail (likely links to a dedicated calling settings page)

**Fallback number field:**
- **Label:** `Fallback number` with a **"?" help icon** (circle with question mark, ~14px)
- **Value displayed:** `(541) 213-6706`
- Rendered as plain text with a light-bordered **text input field** visible around it (light gray border, white background, standard input height ~32px)
- [INFERRED] This is the phone number calls route to if no agent is available in the team inbox

**Spam label calling protection:**
- **Label:** `Spam label calling protection` (plain text, no help icon visible)
- **Value displayed:** `Ryan Realty LLC` followed by `(Change)` in blue link color
- The `(Change)` is a clickable inline link
- [INFERRED] This sets the caller ID name / STIR-SHAKEN label displayed to call recipients. Clicking `(Change)` opens a modal or inline editor to update the business name associated with spam-label protection services.

**Call Recording:**
- **Label:** `Call Recording` with a **"?" help icon** (circle ?)
- **Control:** A **toggle switch** positioned to the right of the label
  - **State: ON (enabled)** — rendered as a green pill with white circle on the right side
  - Green color approximately `#4caf50` or `#29b861`
- **Adjacent label text:** `Enable call recording for team members`
- [INFERRED] When ON, all calls made/received through FUB calling are recorded and stored for playback in the contact timeline

**Legal Disclosure:**
- **Label:** `Legal Disclosure` with a **"?" help icon**
- **Control:** A **toggle switch**
  - **State: OFF (disabled)** — rendered as a gray pill with white circle on the left side
  - Gray color approximately `#cccccc` or `#bdbdbd`
- **Adjacent label text:** `Automatically play call recording disclosure for all calls`
- [INFERRED] When ON, FUB auto-plays a recorded message at the start of every call notifying all parties they are being recorded (required in two-party consent states)

**"Preview call disclosure" button/control:**
- Positioned below the Legal Disclosure toggle row
- A **dark circular play button icon** (filled dark gray/black circle ~20px diameter with white right-pointing triangle inside) followed by the text `Preview call disclosure`
- [INFERRED] Clicking this plays the actual audio disclosure recording so the admin can hear what callers would hear

**Legal Requirements info box:**
- A **blue-bordered, light-blue-background information panel** (approx. `#e3f0fb` background, `#4a90e2` left or full border)
- **Bold heading:** `Legal Requirements for call disclosure`
- **Body text (full transcription):**
  > "In some states and jurisdictions it is legally required to obtain the consent of all parties involved in a conversation before a recording is made. Consent may be obtained by notifying all parties at the beginning of the call that it will be recorded. When this feature is disabled, the notification that the call is being recorded will not be played automatically at the beginning of a call."
- Text is small (~12px), dark gray on light blue background
- This is a static informational callout, not interactive

---

### OFFICE HOURS section

**Section header:**
- Text: `OFFICE HOURS` (all caps, uppercase, centered)
- Flanked on both sides by thin horizontal gray rules (full-width of the content column)
- Font: small (~11px), letter-spacing wide, color medium gray (`#999` approx.)

**Description text:**
- Left column: `Specify the days and times your team can receive incoming calls to your team inboxes`
- 3-line text, medium gray, ~13px

**Action link:**
- Right column: `+ Add office hours` in blue link color (`#4a90e2`)
- The `+` prefix indicates this adds a new item (no office hours are currently configured — empty state)
- [INFERRED] Clicking opens an inline form or modal to define days/times for the team's call-receiving window

---

### SUBDOMAIN section

**Section header:**
- Text: `SUBDOMAIN` (all caps, centered, same style as other section headers)
- Flanked by thin horizontal gray rules

**Description text:**
- Left column: `Change the subdomain of your account`

**Subdomain value + change link:**
- Right column: `ryan-realty.followupboss.com` (displayed as plain text, not a link itself)
- Followed by a space, then `(Change)` in blue link color
- [INFERRED] Clicking `(Change)` opens a modal or inline editor to update the FUB subdomain prefix (the "ryan-realty" part). Changing this would affect all agent login URLs and possibly integrations.

---

### BUSINESS INSIGHTS section

**Section header:**
- Text: `BUSINESS INSIGHTS` (all caps, centered)
- Flanked by thin horizontal gray rules

**Production Goals 2026:**
- **Label:** `Production Goals 2026` (left column, ~14px, dark gray)
- **Value:** `$1,000,000` displayed in **blue link color** (`#4a90e2`), suggesting it is clickable/editable
- [INFERRED] Clicking the value opens an inline editor to set the annual production goal. This goal is used in reporting/dashboard widgets to show progress against target.
- Year "2026" in the label suggests this auto-updates annually (or was manually set to the current year)

**Weekly Report Recipients:**
- **Label:** `Weekly Report Recipients` with a **"?" help icon** (circle ?)
- **Value / action:** `+ Add Email` in blue link color
- This is an empty state — no email addresses have been added yet
- [INFERRED] Clicking `+ Add Email` adds an email address to receive FUB's automated weekly performance/summary reports. Multiple addresses can be added.
- [INFERRED] The ? tooltip likely explains what the weekly report contains (performance metrics, lead counts, conversion rates, etc.)

---

### BLOCK LIST section

**Section header:**
- Text: `BLOCK LIST` (all caps, centered)
- Flanked by thin horizontal gray rules

**Description text:**
- Left column: `Set which emails and phone numbers you want to block`

**Action link:**
- Right column: `Manage block list settings` in blue link color
- [INFERRED] Clicking navigates to a dedicated block list management sub-page where admins can add/remove blocked email addresses and phone numbers. Blocked contacts will not be able to create new leads in the system, or their communications will be filtered/ignored.

---

### Save button

- **Text:** `Save`
- **Style:** Filled blue button, rounded corners (~20px radius pill shape), white text, medium font weight
- **Color:** Blue approximately `#4a90e2` or `#3f9eed`
- **Position:** Bottom-right of the form content area, above the page footer
- **Function:** Saves all changes made to the Company Settings form on this scroll-visible portion. [INFERRED] The save persists: Fallback number, Call Recording toggle, Legal Disclosure toggle, and the Production Goals value. The Office Hours, Subdomain, Block List, and Weekly Report Recipients each have their own change flows via separate links/modals and may not depend on this Save button.

---

### Help / Support chat widget

- **Visual:** A circle with a `?` (question mark) inside, bottom-right corner of the browser viewport
- **Color:** White or light background circle with blue/teal question mark
- **Position:** Fixed to viewport bottom-right
- [INFERRED] Opens an intercom-style chat widget or help center overlay for FUB customer support

---

### Chrome browser top bar (non-FUB)

- **Tab title:** "Company Settings - Follow U…" (truncated)
- **URL bar:** `ryan-realty.followupboss.com/2/company-settings`
- **Browser extension bar** (right side): various extension icons including FUB logo, Loom, Skype, Gmail, badge count "8", Google Drive, follow-up extension, unknown blue icon, "CEAR" text, "Ryan Realty" text, and a profile icon labeled "R", followed by more extensions
- **Profile switcher:** "Work" label with profile avatar (dark-skinned person) — Chrome profile
- **Pinned tabs:** Several including one showing "Son's UH business...", "Claude", "CRM mobile UI redesi...", "Lindsay mail form...", "Application cost an..."

---

## Colors, typography & style

| Element | Color / Style |
|---|---|
| Page background | Light gray `#f0f2f5` (approx.) |
| Form content area background | Same light gray (no card elevation/white background used here — the form sits directly on the gray) |
| Section header text | All-caps, small (~11–12px), letter-spaced, medium gray `#999999` |
| Section header horizontal rules | 1px `#e0e0e0` or similar light gray |
| Label text (left column) | ~13–14px, dark gray `#333333` or `#444444`, normal weight |
| Value / control area (right column) | Same dark gray for plain text |
| Blue links / action text | `#4a90e2` (FUB brand blue) — used for `(Change)`, `+ Add office hours`, `+ Add Email`, `Manage block list settings`, `Manage Settings`, `$1,000,000`, `ryan-realty.followupboss.com` |
| Toggle ON state | Green pill `#29b861` approx. |
| Toggle OFF state | Gray pill `#cccccc` approx. |
| Legal info box background | Light blue `#e8f4fc` approx. |
| Legal info box border/accent | Blue `#4a90e2` approx. (either left border or full border) |
| Legal info box heading | Bold, ~13px, dark |
| Legal info box body | ~12px, dark gray |
| Save button | Blue fill `#4a90e2` or `#3f9eed`, white text, pill/rounded corners, ~36px height |
| Fallback number input | White background, 1px light gray border, standard border-radius (~4px), 32px height |
| Help icons (?) | Small circle, gray, ~14px |
| Preview play button | Dark filled circle (~20px), white triangle icon |
| Font family | Appears to be a system sans-serif or custom sans (Inter or similar) |
| Density | Comfortable — ~48–56px row height for most field rows, ~24px vertical padding between rows |

No FUB global top nav bar is visible in this scroll position. No green "Getting Started" progress bar is visible at the bottom.

---

## State & data shown

| Setting | Current Value / State |
|---|---|
| Fallback number | `(541) 213-6706` |
| Spam label calling protection | `Ryan Realty LLC` |
| Call Recording | **ON** (toggle enabled/green) |
| Legal Disclosure auto-play | **OFF** (toggle disabled/gray) |
| Office hours | None configured (empty state, "+ Add office hours" shown) |
| Subdomain | `ryan-realty.followupboss.com` |
| Production Goals 2026 | `$1,000,000` |
| Weekly Report Recipients | None added (empty state, "+ Add Email" shown) |
| Block list | Not shown inline — link to manage separately |

**Account identified:** Ryan Realty LLC — a real estate brokerage using FUB at subdomain `ryan-realty`.

---

## Interactions & behaviors

| Element | Behavior |
|---|---|
| `Manage Settings` (Phone) | [INFERRED] Navigates to a dedicated phone/calling settings sub-page within Admin, likely `/admin/calling` or similar, with more granular options (number assignment, voicemail, call routing) |
| Fallback number input | Editable text field — click to edit, type new number, Save to persist |
| `(Change)` next to Ryan Realty LLC | [INFERRED] Opens an inline modal or form to update the spam-label calling protection name/entity |
| Call Recording toggle | Click to toggle ON/OFF. Changes take effect after Save button click. When ON, all team calls are recorded. |
| Legal Disclosure toggle | Click to toggle ON/OFF. When ON, an automated disclosure plays at the start of each call. Requires Save. |
| `Preview call disclosure` play button | [INFERRED] Triggers inline audio playback of the disclosure recording without navigating away. Likely uses an HTML5 audio element that auto-plays on click. |
| `+ Add office hours` | [INFERRED] Opens an inline form or modal with day-of-week checkboxes and time-range pickers (start time, end time per day). Multiple day ranges can be added. Saved separately (not via the main Save button, or possibly via Save). |
| Subdomain `(Change)` | [INFERRED] Opens a modal warning that changing the subdomain will affect all logins and integrations, with a text input for the new subdomain prefix and a Confirm/Cancel button. |
| `$1,000,000` (Production Goals) | [INFERRED] Click opens an inline edit mode with a currency/number input to set the goal. Changes saved via main Save button or inline save. |
| `+ Add Email` (Weekly Report Recipients) | [INFERRED] Opens an inline email input field or modal. Multiple emails can be added as a list. Each entry may have a remove/X control. |
| `Manage block list settings` | [INFERRED] Navigates to a dedicated block list sub-page within Admin settings where email addresses and phone numbers can be added to a block list (preventing them from creating new leads). |
| `Save` button | Persists all form changes made on this settings page. Likely shows a success toast/notification after saving. May trigger a page reload or stay in place. |
| `?` help icons | [INFERRED] Hover shows a tooltip with additional explanation. May also link to FUB knowledge base article on click. |
| `?` chat widget (bottom-right) | [INFERRED] Opens an Intercom-style support chat overlay |

---

## Data model signals

| Entity / Field | Type | Notes |
|---|---|---|
| `company.fallback_phone_number` | `string` (E.164 or formatted) | The phone number calls route to when no agent available |
| `company.spam_label_name` | `string` | Business name for STIR-SHAKEN / caller-ID spam protection |
| `company.call_recording_enabled` | `boolean` | Master toggle for recording all team calls |
| `company.legal_disclosure_auto_play` | `boolean` | Whether to auto-play recording disclosure at call start |
| `company.legal_disclosure_audio_url` | `string` (URL) | The audio file for the disclosure message (playable via "Preview call disclosure") |
| `company.office_hours` | `array<OfficeHoursBlock>` | Each block: `{ days: DayOfWeek[], start_time: string, end_time: string }`. Currently empty. |
| `company.subdomain` | `string` | The FUB subdomain prefix (e.g. "ryan-realty") |
| `company.production_goal` | `number` (currency) | Annual production goal in dollars. Year is embedded in label ("2026"). |
| `company.weekly_report_recipients` | `array<string>` (emails) | Email addresses receiving weekly reports. Currently empty. |
| `company.block_list` | Managed separately (not inline) | Collection of blocked emails/phone numbers — see block list sub-page |

**Enums / relationships:**
- The account is identified by both subdomain (`ryan-realty`) and company name (`Ryan Realty LLC`)
- The subdomain is the routing key for multi-tenant FUB — changing it affects all user logins
- `production_goal` appears to be year-scoped (label shows year), suggesting a `goal_year` field or a goals table keyed by year
- `spam_label_name` may be managed by a third-party calling identity service (STIR/SHAKEN), not just stored locally

---

## Rebuild notes

### Component breakdown

```
<CompanySettingsPage>
  {/* scrolled below fold: Phone/Calling, Office Hours, Subdomain, Business Insights, Block List */}

  <SettingsSection id="phone">
    <SettingRow>
      <SettingLabel>Phone <HelpIcon tooltip="..." /></SettingLabel>
      <SettingValue>
        <ExternalLink icon={<SettingsIcon />} href="/admin/calling">Manage Settings</ExternalLink>
      </SettingValue>
    </SettingRow>
    <SettingRow>
      <SettingLabel>Fallback number <HelpIcon /></SettingLabel>
      <SettingValue>
        <TextInput value="(541) 213-6706" onChange={...} />
      </SettingValue>
    </SettingRow>
    <SettingRow>
      <SettingLabel>Spam label calling protection</SettingLabel>
      <SettingValue>
        Ryan Realty LLC <InlineChangeLink onClick={openSpamLabelModal} />
      </SettingValue>
    </SettingRow>
    <SettingRow>
      <SettingLabel>Call Recording <HelpIcon /></SettingLabel>
      <SettingValue>
        <Toggle checked={true} onChange={...} />
        <span>Enable call recording for team members</span>
      </SettingValue>
    </SettingRow>
    <SettingRow>
      <SettingLabel>Legal Disclosure <HelpIcon /></SettingLabel>
      <SettingValue>
        <Toggle checked={false} onChange={...} />
        <span>Automatically play call recording disclosure for all calls</span>
        <PlayButton onClick={playDisclosureAudio}>Preview call disclosure</PlayButton>
      </SettingValue>
    </SettingRow>
    <InfoBox variant="info">
      <strong>Legal Requirements for call disclosure</strong>
      <p>In some states and jurisdictions it is legally required...</p>
    </InfoBox>
  </SettingsSection>

  <SectionDivider label="OFFICE HOURS" />
  <SettingsSection id="office-hours">
    <SettingRow>
      <SettingLabel>Specify the days and times your team can receive incoming calls to your team inboxes</SettingLabel>
      <SettingValue>
        <AddLink onClick={openOfficeHoursModal}>+ Add office hours</AddLink>
        {/* Populated state would show list of OfficeHoursBlock items with day/time ranges */}
      </SettingValue>
    </SettingRow>
  </SettingsSection>

  <SectionDivider label="SUBDOMAIN" />
  <SettingsSection id="subdomain">
    <SettingRow>
      <SettingLabel>Change the subdomain of your account</SettingLabel>
      <SettingValue>
        ryan-realty.followupboss.com <InlineChangeLink onClick={openSubdomainModal} />
      </SettingValue>
    </SettingRow>
  </SettingsSection>

  <SectionDivider label="BUSINESS INSIGHTS" />
  <SettingsSection id="business-insights">
    <SettingRow>
      <SettingLabel>Production Goals {currentYear}</SettingLabel>
      <SettingValue>
        <EditableValue value="$1,000,000" format="currency" onClick={openProductionGoalEditor} />
      </SettingValue>
    </SettingRow>
    <SettingRow>
      <SettingLabel>Weekly Report Recipients <HelpIcon /></SettingLabel>
      <SettingValue>
        <AddLink onClick={openAddEmailFlow}>+ Add Email</AddLink>
        {/* Populated state: list of email chips with remove buttons */}
      </SettingValue>
    </SettingRow>
  </SettingsSection>

  <SectionDivider label="BLOCK LIST" />
  <SettingsSection id="block-list">
    <SettingRow>
      <SettingLabel>Set which emails and phone numbers you want to block</SettingLabel>
      <SettingValue>
        <NavLink href="/admin/block-list">Manage block list settings</NavLink>
      </SettingValue>
    </SettingRow>
  </SettingsSection>

  <FormFooter>
    <SaveButton onClick={saveSettings}>Save</SaveButton>
  </FormFooter>
</CompanySettingsPage>
```

### Non-obvious logic

1. **Section dividers (`<SectionDivider>`):** Implemented as a flex row: `<hr /> <span>{label}</span> <hr />` with the label in a small all-caps centered style. Not a heading tag — purely visual grouping.

2. **Call Recording + Legal Disclosure interaction:** The Legal Disclosure toggle should be conditionally enabled/relevant only when Call Recording is ON. When Call Recording is OFF, the Legal Disclosure toggle may be visually disabled or hidden. [INFERRED from feature logic]

3. **"Preview call disclosure" play control:** This is likely an HTML `<audio>` element hidden in the DOM, triggered by clicking the dark play-circle icon. The audio URL comes from the company settings API response.

4. **`(Change)` inline link pattern:** Several settings use inline `(Change)` links adjacent to the current value. This is a FUB-wide pattern for settings that require a special flow (modal, confirmation, third-party redirect) rather than direct inline editing. Distinguish from settings that use editable inputs directly.

5. **Blue editable value (`$1,000,000`):** The production goal value is displayed as a blue link-style text, indicating clicking it enters an edit mode. This is an "edit-in-place" pattern where the display switches to a number/currency input on click, with save/cancel controls.

6. **Save button scope:** The `Save` button at the bottom likely covers only the directly-editable inline form fields: Fallback number, Call Recording toggle, Legal Disclosure toggle, and Production Goals. Settings that use separate modals/links (Office Hours, Subdomain, Spam label, Block List, Weekly Report Recipients) are saved through their own flows.

7. **Subdomain change warning:** Changing the subdomain is high-stakes (breaks all user login URLs). [INFERRED] FUB likely shows a warning modal explaining consequences before allowing the change, requiring explicit confirmation.

8. **Multi-tenant routing:** The `/2/` path segment in the URL (`/2/company-settings`) is an account-ID prefix used by FUB's multi-tenant routing. Account ID for Ryan Realty is `2` in this instance.

9. **Production Goals label is year-dynamic:** The label reads "Production Goals 2026" — this should be computed from the current year at render time, not hardcoded. Or it may reflect the year the goal was set/the goal year field.

10. **STIR-SHAKEN / Spam label protection:** The "Spam label calling protection" setting ties into third-party telephony verification services. The company name shown ("Ryan Realty LLC") is what gets registered with carriers to prevent calls from being labeled "Spam Likely". The `(Change)` flow likely involves a verification step with the telephony provider.

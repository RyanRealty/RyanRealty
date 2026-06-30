# Section 25 — Mobile: Contact Detail (Lead Profile) — Every Tab & Field

**Build target:** Responsive-web implementation (Next.js + shadcn/ui + Geist + Amboqia), displayed at ≤ 640 px viewport in a single-column mobile shell. FUB's native iOS app is the UX/IA reference; its visual language is translated to the Ryan Realty design system (navy `#102742` / cream `#faf8f4`). All color tokens referenced as CSS custom properties (defined in `app/globals.css`); all components from `@/components/ui/`.

**Logical canvas used for measurements:** 390 × 844 pt (iPhone 15 logical resolution). All pt values map 1:1 to px at 1× logical density.

**Source screenshots:** mob-02, mob-03, mob-04, mob-12, mob-13, mob-14, mob-16, mob-18, mob-25, mob-26, mob-27, mob-28, mob-29, mob-30, mob-31, mob-33, mob-37, mob-52, mob-53, mob-55, mob-56, mob-59, mob-60.

**Sibling desktop spec sections:** `07a-person-detail-sidebar-and-inline-edit.md`, `07b-person-detail-timeline-and-engagement.md`, `07c-person-detail-compose-modals-and-right-rail.md`.

---

## 25.1 Design Token Translation Table

FUB iOS visual language → Ryan Realty design system equivalents used throughout this spec.

| FUB element | FUB hex (observed) | Ryan Realty token | Resolved value |
|---|---|---|---|
| Header / nav bar bg | ~#3a4e5f–#3d5568 | `bg-primary` | `#102742` |
| Sub-tab strip bg | same as header | `bg-primary` | `#102742` |
| Sub-tab active underline | ~#29b5e8–#5b9bd5 | `bg-accent` | CSS: `var(--accent)` |
| Sub-tab active label | #ffffff | `text-primary-foreground` | `#ffffff` |
| Sub-tab inactive label | rgba(255,255,255,0.60) | `text-primary-foreground/60` | `rgba(255,255,255,0.60)` |
| Content area bg | ~#EEF1F5 | `bg-secondary` | `var(--secondary)` |
| Card bg | #ffffff | `bg-card` | `var(--card)` |
| Card shadow | rgba(0,0,0,0.08) | `shadow-sm` | CSS var |
| Section header bg | ~#EEF1F5 (same as content) | `bg-secondary` | `var(--secondary)` |
| Section header label | ~#8A9BAD (muted uppercase) | `text-muted-foreground` | `var(--muted-foreground)` |
| Section right action link | ~#4A90D9 | `text-accent-foreground` | `var(--accent-foreground)` |
| SMS action button | ~#7595e8 periwinkle (pixel-verified mob-02; varies #6b7fc4–#7b7ec8 across screens) | `bg-secondary` + custom style | `#7595e8` inline (no token) |
| Call action button | ~#4ad09f mint (pixel-verified mob-02; varies #4cb87e–#3dc896) | `bg-success` | `var(--success)` |
| Email action button | ~#4ab8e8 sky-blue | `bg-accent` | `var(--accent)` |
| TRANSFER TO LENDER text | ~#29A8D8–#5BA5D8 | `text-accent-foreground` | `var(--accent-foreground)` |
| Inquiry icon | ~#4CAF94 teal-green | `text-success` | `var(--success-foreground)` |
| Address link text | ~#4a9fd4 blue | `text-accent-foreground` | `var(--accent-foreground)` |
| Email row icon | ~#5BA4CF | `text-accent-foreground` | `var(--accent-foreground)` |
| SMS row icon | ~#6B8FDE blue-purple | `text-accent-foreground` | `var(--accent-foreground)` |
| Open-tracking envelope | ~#F5A023 orange | `text-warning-foreground` | `var(--warning-foreground)` |
| Archived label | ~#9E9E9E | `text-muted-foreground` | `var(--muted-foreground)` |
| Thread badge bg | ~#9E9E9E | `bg-muted` | `var(--muted)` |
| Homes empty state icon | ~#9aabb8 | `text-muted-foreground` | `var(--muted-foreground)` |
| FAB bg | ~#5BA4CF–#6B93C4 | `bg-primary` | `#102742` |
| FAB icon | #ffffff | `text-primary-foreground` | `#ffffff` |
| Property card "Viewed" badge | #1A1A1A | `bg-foreground` | `var(--foreground)` |
| Directions button border | ~#d0d0d0 | `border-border` | `var(--border)` |
| Tags list item text | ~#2D4A5A | `text-foreground` | `var(--foreground)` |

---

## 25.2 Component Hierarchy

```tsx
<ContactDetail contactId={string}>          // Route: /crm/people/[id] (mobile viewport)
  <MobileContactDetailShell>
    <StatusBar />                            // system-managed on native; CSS env(safe-area-inset-top) on web
    <ContactDetailHeader />                  // § 25.3 — back + avatar + name + subtitle + Edit button
    <SubTabStrip />                          // § 25.4 — Info | Comms | Homes | Notes | Calendar (scrollable)
    <TabContent activeTab={tab}>
      <InfoTab />                            // § 25.5 — structured fields
      <CommsTab />                           // § 25.6 — timeline of emails, texts
      <HomesTab />                           // § 25.7 — property inquiry cards
      <NotesTab />                           // § 25.8 — broker notes
      <CalendarTab />                        // § 25.9 — appointments + tasks
    </TabContent>
    <FAB />                                  // per-tab, floating, bottom-right
  </MobileContactDetailShell>

  {/* Sub-screens (push navigation) */}
  <TagsListScreen />                         // § 25.10 — pushed when Tags row tapped
  <AddressMapScreen />                       // § 25.11 — pushed when address link tapped
</ContactDetail>
```

---

## 25.3 Hero / Header Block

**[OBSERVED — mob-02, mob-12, mob-16, mob-25, mob-59]**

### 25.3.1 Layout and dimensions

| Element | y-band (pt) | Notes |
|---|---|---|
| iOS status bar (inset) | 0–47 | `env(safe-area-inset-top)` on web; dark background extends through it |
| Back chevron + right controls | 47–91 | 44 pt hit-target row |
| Avatar + name + subtitle block | 91–148 | 57 pt; avatar aligns left |
| (header total above sub-tabs) | 0–148 | `bg-primary` continuous |

### 25.3.2 Back row

- **Back chevron:** `‹` (chevron-left), 22 pt, `text-primary-foreground` white, x=16, vertically centered in 44 pt row. [OBSERVED mob-02]
- **Right control (Info tab):** "Edit" text button — `text-primary-foreground` white, 15 pt regular, right-aligned, x~=358. [OBSERVED mob-02, mob-25] Taps to enter inline-edit mode for contact fields (same as desktop §07a inline edit pattern).
- **Right control (Comms tab):** None observed on Comms tab header. [OBSERVED mob-04]
- **Right control (other tabs):** No right control visible. [INFERRED: Edit is Info-tab-specific]

### 25.3.3 Avatar

| State | Display |
|---|---|
| No photo | Initials (First + Last initial), colored circle; color deterministic from name hash — see palette below |
| Real photo | Circular crop, `object-fit: cover`, `border-radius: 9999px` |

- **Size:** 52–56 pt (56 pt when photo present — mob-25; 52 pt for initials — mob-02). Standardize at **56 pt** (14 rem at base 4px).
- **Position:** x=16 from left edge, vertically centered in avatar+name block.
- **Initials:** First letter of first name + first letter of last name. Geist 600 ~20 pt, white. [OBSERVED mob-02, mob-12, mob-16, mob-33]
- **Avatar color palette (FUB auto-assigns by name hash — translate to same hues):**
  - `AC` (Andy Christensen) → `#c8721a` orange [OBSERVED mob-02]
  - `JL` (Jim Langevin) → `#7b8fcf` mauve-purple [OBSERVED mob-12]
  - `DM` (Doug Millard) → `#6d9c7e` muted green [OBSERVED mob-16]
  - `TW` (Theresa Wise) → `#E53935` red [OBSERVED mob-04]
  - `MR` (Matthew Ryan) → `#7B68B0` violet-purple [OBSERVED mob-33, mob-37]
  - `MB` (Mary Bowman) → derive from name hash
  - **Implementation:** 8-color deterministic palette, hash `contact.id` mod 8 → color. Palette: `['#c8721a','#7b8fcf','#6d9c7e','#E53935','#7B68B0','#5a8ab8','#b07840','#3d8fa0']`.

### 25.3.4 Name + subtitle

- **Name:** Geist 600 (semibold), ~20–22 pt, `text-primary-foreground` white. Left edge at x=80 (16 pad + 56 avatar + 8 gap). [OBSERVED mob-02 "Andy Christensen", mob-12 "Jim Langevin", mob-25 "Derek Winchell"]
- **Subtitle (row 1):** Last-communication summary, 13 pt regular, `text-primary-foreground/70` (~rgba(255,255,255,0.70)).
  - States: `"Last communication [relative date]"` when present, `"No communication yet"` when null. [OBSERVED mob-12 "Last communication May 21", mob-33 "No communication yet"]
- **Price pill (conditional):** When contact has a price target set, a small pill badge appears right of or below the subtitle: rounded-full, `bg-success` green ~#2dc97a, white text, ~12 pt semibold. Example: `"$655K"`. [OBSERVED mob-12 Jim Langevin]

### 25.3.5 Ryan Realty component

```tsx
<ContactDetailHeader className="bg-primary px-4 pt-[env(safe-area-inset-top)]">
  {/* Back + Edit row */}
  <div className="flex items-center justify-between h-11">
    <button onClick={goBack} className="p-1 -ml-1">
      <ChevronLeft className="text-primary-foreground" size={22} />
    </button>
    {activeTab === 'info' && (
      <button onClick={enterEditMode} className="text-primary-foreground text-sm">
        Edit
      </button>
    )}
  </div>
  {/* Identity block */}
  <div className="flex items-center gap-3 pb-3">
    <ContactAvatar
      name={contact.name}
      photoUrl={contact.profileImageUrl}
      size={56}
    />
    <div className="flex-1 min-w-0">
      <p className="text-primary-foreground font-semibold text-xl leading-tight truncate">
        {contact.name}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-primary-foreground/70 text-[13px]">
          {contact.lastCommSummary ?? 'No communication yet'}
        </p>
        {contact.priceTarget && (
          <Badge className="bg-success text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {formatPrice(contact.priceTarget)}
          </Badge>
        )}
      </div>
    </div>
  </div>
</ContactDetailHeader>
```

### 25.3.6 Data bindings

| Field | Source |
|---|---|
| `contact.name` | `crm_people.first_name + ' ' + crm_people.last_name` |
| `contact.profileImageUrl` | `crm_people.profile_image_url` (null → initials) |
| `contact.lastCommSummary` | Computed from `crm_timeline` latest `kind IN ('email_in','email_out','text_in','text_out','call')` |
| `contact.priceTarget` | `crm_people.price_target` (nullable) |

### 25.3.7 Acceptance criteria

- AC-H-1: Header background is `bg-primary` navy continuous from status bar through sub-tab strip bottom edge.
- AC-H-2: Avatar shows circular photo when `profileImageUrl` non-null; initials otherwise.
- AC-H-3: Initials derive from first+last name initial; background color from deterministic 8-color palette keyed on `contact.id mod 8`.
- AC-H-4: Subtitle reads "No communication yet" when zero timeline entries of kind email/text/call.
- AC-H-5: "Edit" button appears in header only when Info tab is active.
- AC-H-6: Price pill renders only when `contact.priceTarget` is non-null.

---

## 25.4 Sub-Tab Strip

**[OBSERVED — mob-02, mob-04, mob-12, mob-13, mob-14, mob-28, mob-29, mob-30, mob-31, mob-33, mob-37]**

### 25.4.1 Dimensions and styling

| Property | Value |
|---|---|
| Height | 42–50 pt (standardize 44 pt) |
| Background | `bg-primary` (continuous with header) |
| Bottom border | none visible; content area starts immediately below |
| Font | Geist 400 (inactive) / Geist 600 (active), 14 pt |
| Tab padding | 16 pt horizontal per tab |

### 25.4.2 Tabs in order

| # | Label | Full label | Observed in |
|---|---|---|---|
| 1 | Info | Info | mob-02, mob-03 (active), mob-04 (inactive) |
| 2 | Comms | Comms | mob-04 (active), mob-13, mob-27 |
| 3 | Homes | Homes | mob-14 (active), mob-28, mob-29, mob-33 |
| 4 | Notes | Notes | mob-30 (active), mob-37 |
| 5 | Calendar | Calendar (truncated to "Calend..." at 390pt) | mob-31 (active) |
| 6 | Auto… | Automations (truncated) | mob-30, mob-37 (inactive) |

The strip is **horizontally scrollable** — tabs 5–6+ extend beyond 390 pt screen width. [OBSERVED mob-29: "Calend" truncated; mob-30 partial "Auto..."]

### 25.4.3 Active tab indicator

- **Active text:** `text-primary-foreground` white, Geist 600 (semibold). [OBSERVED across all]
- **Active underline:** 2–3 pt solid bar, color `bg-accent` (maps FUB ~#29b5e8–#5b9bd5). Full tab-label width. Flush to strip bottom. [OBSERVED mob-02 active "Info" underline, mob-04 active "Comms", mob-29 "Homes" ~#4BA3E3, mob-31 "Calendar" white underline]
- **Note on mob-31:** Active tab "Calendar" underline appeared white (#FFFFFF) rather than teal — possible because the active indicator matched the label color. [OBSERVED mob-31] Use `bg-accent` for the in-house implementation for contrast.
- **Inactive text:** `text-primary-foreground/60` (~rgba(255,255,255,0.60)).

### 25.4.4 Ryan Realty component

```tsx
<SubTabStrip className="bg-primary border-b-0 overflow-x-auto flex scrollbar-none">
  {TABS.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={cn(
        "flex-shrink-0 px-4 h-11 text-sm relative whitespace-nowrap",
        activeTab === tab.key
          ? "text-primary-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-accent after:rounded-t"
          : "text-primary-foreground/60 font-normal"
      )}
    >
      {tab.label}
    </button>
  ))}
</SubTabStrip>
```

### 25.4.5 Acceptance criteria

- AC-ST-1: Strip is horizontally scrollable; no wrapping; **5 tabs confirmed** (Info/Comms/Homes/Notes/Calendar) + a 6th tab INFERRED from a truncated "Auto..." label in mob-30 (likely Automations — **unconfirmed; verify against live**).
- AC-ST-2: Active tab has Geist 600, full-opacity white, and 2.5 px `bg-accent` bottom underline.
- AC-ST-3: Tapping a tab swaps `<TabContent>` without navigation push — in-place content swap.
- AC-ST-4: Strip background is `bg-primary`, flush with header above.

---

## 25.5 INFO Tab

**[OBSERVED — mob-02, mob-03, mob-12, mob-16, mob-18, mob-25, mob-26, mob-52, mob-53, mob-59, mob-60]**

The Info tab is a single vertically-scrollable column of sections. Sections appear in this order:

1. RECENT MESSAGES (only when messages exist)
2. PHONE NUMBERS
3. EMAILS
4. RELATIONSHIPS
5. DETAILS
6. FINANCING
7. BACKGROUND
8. INQUIRIES
9. CUSTOM FIELDS
10. ADDRESS

Content area background: `bg-secondary`. Each section is preceded by a section header row.

### 25.5.1 Content area wrapper

```tsx
<ScrollView className="flex-1 bg-secondary" contentInsetAdjustmentBehavior="automatic">
  {/* sections in order */}
</ScrollView>
```

---

### 25.5.2 Section header row pattern

Used by every section. Reusable `<SectionHeader>` component.

| Element | Spec |
|---|---|
| Background | `bg-secondary` (same as page bg — no card border) |
| Left label | ALL-CAPS, letter-spacing 0.8 px, `text-muted-foreground`, Geist 500 12 pt |
| Right label (optional) | Tappable link text, `text-accent-foreground`, Geist 400 13 pt |
| Horizontal padding | 16 pt |
| Vertical padding | 10–12 pt |

```tsx
<SectionHeader label="PHONE NUMBERS" rightAction={{ label: "TEXT ALL...", onTap: textAll }} />
```

---

### 25.5.3 Section 1: RECENT MESSAGES

**[OBSERVED — mob-12 only (Jim Langevin had recent messages)]**
**Condition:** Renders only when `contact.recentMessages.length > 0`. Not shown for contacts with no message history. [OBSERVED mob-02 Andy Christensen — section absent; mob-12 Jim Langevin — section present]

**Header:** `"RECENT MESSAGES"` (no right action).

**Message group row:**
| Element | Spec |
|---|---|
| Left avatar | 40 pt circle, color from participant name hash, white initials |
| Participants line | Geist 500 14 pt `text-foreground`. Example: `"Jim Langevin, Lisa Langevin, Matt Ryan"` |
| Preview | 13 pt `text-muted-foreground`, 1 line truncated |
| Date | Right-aligned, 12 pt `text-muted-foreground` |

Row tap → navigates to Comms tab, scrolled to that thread. [INFERRED from FUB UX pattern]

---

### 25.5.4 Section 2: PHONE NUMBERS

**[OBSERVED — mob-02, mob-12, mob-16, mob-25]**

**Header:** `"PHONE NUMBERS"` left, `"TEXT ALL..."` right (teal `text-accent-foreground`) when multiple phones. [OBSERVED mob-12, mob-16] `"TEXT ALL..."` absent when only one phone. [OBSERVED mob-02, mob-25]

**Phone row anatomy** (one row per phone number):

```
[label]        [number]        [SMS btn] [Call btn]
Mobile         541-555-0123    [●]SMS    [●]Call
```

| Element | Spec | Source |
|---|---|---|
| Label | `text-muted-foreground` 12 pt, e.g. "Mobile", "Home", "Work" | OBSERVED mob-02 |
| Number | `text-foreground` 14 pt Geist 500 | OBSERVED mob-02 |
| Attribution | When number belongs to a related contact, gray attribution line below: e.g. `"Charise Millard"` in `text-muted-foreground` 12 pt | OBSERVED mob-16 |
| SMS button | 40 pt circle, bg `#7595e8` periwinkle, white SMS/speech-bubble icon 18 pt | OBSERVED mob-02 #7595e8 (pixel-verified), mob-16 ~#7b7ec8; standardize `#7595e8`, sample exact from target screen |
| Call button | 40 pt circle, bg `#4ad09f` mint (`bg-success`), white phone-handset icon 18 pt | OBSERVED mob-02 #4ad09f (pixel-verified), mob-16 ~#3dc896 |
| Gap between buttons | 8 pt |  |
| Row horizontal padding | 16 pt |  |
| Row height | ~52 pt |  |

**SMS button tap:** Opens system SMS sheet or in-house compose sheet with this phone pre-filled. [INFERRED]
**Call button tap:** Initiates phone call via `tel:` URI. [INFERRED]

---

### 25.5.5 Section 3: EMAILS

**[OBSERVED — mob-02, mob-12, mob-16, mob-25]**

**Header:** `"EMAILS"` left, `"EMAIL ALL..."` right (`text-accent-foreground`) when multiple emails. [OBSERVED mob-12, mob-16]

**Email row anatomy:**

| Element | Spec | Source |
|---|---|---|
| Email address | `text-foreground` 14 pt Geist 500 | OBSERVED mob-02 |
| Attribution | When email belongs to related contact, gray label below | OBSERVED mob-16 |
| Email action button | 40 pt circle, bg `#4ab8e8` sky-blue (`bg-accent`), white envelope icon 18 pt | OBSERVED mob-02 ~#29b5e8, mob-16 ~#4ab8e8 |
| Row height | ~52 pt |  |
| Row horizontal padding | 16 pt |  |

Email button tap → opens compose email sheet / system mail app. [INFERRED]

---

### 25.5.6 Section 4: RELATIONSHIPS

**[OBSERVED — mob-02 (empty), mob-12 (populated), mob-16 (populated), mob-25 (empty)]**

**Header:** `"RELATIONSHIPS"` left, `"+"` right (teal `text-accent-foreground` 18 pt) when a relationship exists. [OBSERVED mob-12: "+" header action] No right action when empty. [OBSERVED mob-02]

**Empty state:**
- Row: `"Add Relationship..."` in `text-muted-foreground` 14 pt italic (or regular). [OBSERVED mob-02]

**Populated row:**
- Name: `text-foreground` 14 pt Geist 500. Example: `"Lisa Langevin"` [OBSERVED mob-12], `"Charise Millard"` [OBSERVED mob-16]
- Relationship label: `text-muted-foreground` 12 pt. Example: `"(Spouse)"` [OBSERVED mob-12]
- Right chevron `›`: `text-muted-foreground` — taps to open related contact's profile. [INFERRED]
- Row height: ~48 pt.

---

### 25.5.7 Section 5: DETAILS

**[OBSERVED — mob-02, mob-03, mob-12, mob-25, mob-52, mob-59]**

Six rows in fixed order. Each row: left label (`text-muted-foreground` 12–13 pt) + right value (`text-foreground` 13–14 pt). Tap the row → opens inline edit or picker. [OBSERVED mob-02]

#### Row 1: Assigned to
- Label: `"Assigned to"`
- Value: Broker name, e.g. `"Matt Ryan"` [OBSERVED mob-02, mob-12, mob-16, mob-25]
- Edit: Broker picker (dropdown of active brokers). [INFERRED from §07a]

#### Row 2: Stage
- Label: `"Stage"`
- Value: Pipeline stage label. Examples: `"Lead"` [OBSERVED mob-02, mob-25], `"Active Client"` [OBSERVED mob-52], `"Past Client"` [OBSERVED mob-16]
- Edit: Stage picker (FUB stage list → in-house `crm_stages`). [INFERRED]

#### Row 3: Source
- Label: `"Source"`
- Value: Lead source string. Example: `"Ryan-Realty.com"` [OBSERVED mob-02, mob-25], `"Import"` [OBSERVED mob-52]

#### Row 4: Tags
- Label: `"Tags"`
- Value: Comma-separated tag names, truncated with ellipsis if long. Examples: `"audience:buyer, Bounced, broker:matt"` [OBSERVED mob-02], `"auto:brand-voice:plain-honest, auto:se..."` [OBSERVED mob-25], `"audience:buyer, Bend, Buyer, city:ben..."` [OBSERVED mob-52]
- Tap: Pushes Tags list screen (§ 25.10). [INFERRED from mob-55 destination]
- Trailing `"..."` = ellipsis overflow at ~280 pt max width. [OBSERVED mob-02, mob-25]

#### Row 5: Time frame
- Label: `"Time frame"`
- Value: Free-text or empty. Observed empty for all contacts in source. [OBSERVED mob-02, mob-25, mob-52]
- When empty: renders as placeholder dash or blank. [INFERRED]

#### Row 6: Collaborators
- Label: `"Collaborators"`
- Value: `"No collaborators"` when none. [OBSERVED mob-03, mob-18, mob-26, mob-52]
- Edit: Opens collaborator picker to add a broker. [INFERRED from §07c]

#### Row 6b: My Agent status (conditional)
- Label: `"My Agent status"`
- Value: `"Send Invite"` as a tappable `text-accent-foreground` action link. [OBSERVED mob-59]
- Condition: Appears when agent portal integration is configured and contact has not been claimed. [INFERRED]

#### Section styling

```tsx
<Section label="DETAILS">
  {[
    { label: 'Assigned to', value: contact.assignedTo, onTap: openAssignedToPicker },
    { label: 'Stage', value: contact.stage, onTap: openStagePicker },
    { label: 'Source', value: contact.source },
    { label: 'Tags', value: contact.tags.join(', '), onTap: () => router.push(`/crm/people/${id}/tags`) },
    { label: 'Time frame', value: contact.timeframe || '—' },
    { label: 'Collaborators', value: contact.collaborators.length ? contact.collaborators.map(c=>c.name).join(', ') : 'No collaborators', onTap: openCollaboratorPicker },
    ...(contact.agentStatus ? [{ label: 'My Agent status', value: 'Send Invite', isAction: true, onTap: sendAgentInvite }] : []),
  ].map(row => (
    <DetailRow key={row.label} {...row} />
  ))}
</Section>
```

Each `<DetailRow>`:
- Height: ~44–48 pt
- Background: `bg-card` (white)
- Separator: 1 pt `border-border` inset 16 pt
- Label: Geist 400 13 pt `text-muted-foreground` left
- Value: Geist 400–500 13 pt `text-foreground` right, truncated
- Tap → inline edit (text input or picker sheet) per §07a pattern

---

### 25.5.8 Section 6: FINANCING

**[OBSERVED — mob-03, mob-18, mob-26, mob-52, mob-60]**

**Header:** `"FINANCING"` (no right action).

**Lender row:**
- Label: `"Lender"` `text-muted-foreground` 13 pt
- Value: Lender name when set; placeholder when empty. [OBSERVED: all observed contacts had no lender set]
- Row height: ~44 pt

**TRANSFER TO LENDER row:**

```
[ TRANSFER TO LENDER  › ]
```

- All-caps text, `text-accent-foreground`, Geist 600 14 pt, left-aligned with 16 pt padding, followed by `›` chevron. [OBSERVED mob-03 "TRANSFER TO LENDER >" #29A8D8, mob-18 "TRANSFER TO LENDER" #3D9FCC, mob-26 "TRANSFER TO LENDER ›" #1A7CC4, mob-60 "TRANSFER TO LENDER" #5BA5D8]
- Condition: Shows when no lender is assigned. When lender IS assigned, this row is replaced by the lender contact card. [INFERRED from FUB docs pattern]
- Tap → Opens lender contact picker / add-lender flow. [INFERRED]

```tsx
<Section label="FINANCING">
  <DetailRow label="Lender" value={contact.lender?.name ?? ''} onTap={openLenderPicker} />
  {!contact.lender && (
    <button
      onClick={openLenderPicker}
      className="flex items-center gap-1 px-4 py-3 text-accent-foreground text-sm font-semibold uppercase tracking-wide"
    >
      Transfer to Lender
      <ChevronRight size={14} className="text-accent-foreground" />
    </button>
  )}
</Section>
```

---

### 25.5.9 Section 7: BACKGROUND

**[OBSERVED — mob-03, mob-18, mob-26, mob-53]**

**Header:** `"BACKGROUND"`. Right side has pencil icon when content exists [OBSERVED mob-53 pencil edit icon].

**Empty state row:**
- `"Add background"` placeholder text, `text-muted-foreground` 14 pt regular. [OBSERVED mob-03, mob-18, mob-26 "Add background" in ~#9BAAB8]
- Tap → opens text editor / note compose to add background context.

**Populated state:** Multi-line text block, `text-foreground` 14 pt, line-height 20 pt, truncated with "See more" expand link if > 4 lines. [INFERRED — not directly observed as populated in sources]

---

### 25.5.10 Section 8: INQUIRIES

**[OBSERVED — mob-03, mob-18, mob-26, mob-53]**

**Header:** `"INQUIRIES"`.

When multiple inquiries exist: `"Show N more events"` expand link at bottom. [OBSERVED mob-53: "Show 1 more events"]

**Inquiry row anatomy:**

```
[icon]  [type label]            [date right-aligned]
        [via: source]
        [address if property]
```

| Element | Spec | Source |
|---|---|---|
| Icon | Two overlapping speech-bubble glyphs (~18 pt), color `text-success` green (~#4CAF94) | OBSERVED mob-03, mob-18, mob-26 |
| Type label | `text-foreground` 14 pt Geist 500. Values observed: `"General Inquiry"` [mob-03], `"Property Inquiry"` [mob-18], `"Registration"` [mob-26, mob-60], `"Seller Inquiry"` [mob-53] | |
| Via label | `"via: [source]"` `text-muted-foreground` 13 pt. Examples: `"via: Ryan-Realty.com"` [mob-03, mob-26], `"via: <unspecified>"` [mob-18] | |
| Address (Property Inquiry only) | Property address string, `text-muted-foreground` 13 pt. Example: `"20702 Beaumont Dr, Bend, Oregon"` [mob-53] | OBSERVED mob-53 |
| Date | Right-aligned, `text-muted-foreground` 12 pt. Examples: `"6/19/26, 10:58am"` [mob-03], `"Jul 2, 2025"` [mob-18], `"Jun 13"` [mob-26], `"Jan 8"` [mob-53] | |
| Row height | ~56–64 pt depending on lines | |
| Horizontal padding | 16 pt | |

**"Show N more events" expand row:**
- `text-accent-foreground` 13 pt link. Tap → expands hidden rows inline. [OBSERVED mob-53]

---

### 25.5.11 Section 9: CUSTOM FIELDS

**[OBSERVED — mob-03 (empty), mob-26 (empty), mob-53 (populated), mob-60 (empty)]**

**Header — empty state:** `"CUSTOM FIELDS"` left only, no right action.

**Empty state row:**
- `"Add Custom Fields..."` as a tappable `text-accent-foreground` 14 pt link. [OBSERVED mob-03 #29A8D8, mob-26 #1A7CC4, mob-60 #5BA5D8]
- Tap → opens custom field configuration / value-entry sheet. [INFERRED]

**Header — populated state:** `"CUSTOM FIELDS"` left + `"EDIT ALL..."` right (`text-accent-foreground` 13 pt). [OBSERVED mob-53: "EDIT ALL..." #4A90D9]

**Populated field row:**
- Field label: `text-muted-foreground` 12 pt uppercase. Example: `"Open House Address"` [OBSERVED mob-53]
- Field value: `text-foreground` 13 pt, truncated. Example: `"13651 Amberview Pl / Eastvale, CA, 928..."` [OBSERVED mob-53]
- Row height: ~44 pt

```tsx
<Section
  label="CUSTOM FIELDS"
  rightAction={customFields.length > 0 ? { label: 'EDIT ALL...', onTap: editAllCustomFields } : undefined}
>
  {customFields.length === 0 ? (
    <button onClick={openCustomFieldPicker} className="px-4 py-3 text-accent-foreground text-sm">
      Add Custom Fields...
    </button>
  ) : (
    customFields.map(field => (
      <DetailRow key={field.key} label={field.label.toUpperCase()} value={field.value} onTap={() => editCustomField(field)} />
    ))
  )}
</Section>
```

---

### 25.5.12 Section 10: ADDRESS

**[OBSERVED — mob-52, mob-53]**

**Header:** `"ADDRESS"` (no right action visible).

**Address row anatomy:**

```
[Type label]    [Street line 1]                    [◇ nav icon]
                [City, ST ZIP]
```

| Element | Spec | Source |
|---|---|---|
| Type label | `text-muted-foreground` 12 pt uppercase. Values: `"home"`, `"Property"` | OBSERVED mob-52, mob-53 |
| Street address | `text-accent-foreground` 14 pt (blue link color ~#4a9fd4). Example: `"13651 Amberview Pl"` | OBSERVED mob-52 |
| City/state/zip | `text-accent-foreground` 14 pt. Example: `"Eastvale, CA, 92880"` | OBSERVED mob-52 |
| Navigation icon | Diamond/rotated-square glyph (`◇` or compass rose), `text-accent-foreground`, ~16 pt, right side | OBSERVED mob-52 |
| Tap row | Pushes Address/Map screen (§ 25.11) | INFERRED from mob-56 destination |
| Row height | ~56 pt (2 text lines + padding) | |

Multiple address types appear as separate rows with the same pattern. [OBSERVED mob-52 shows "home" and "Property" rows]

---

### 25.5.13 Info tab acceptance criteria

- AC-INFO-1: Sections render in the exact order: (RECENT MESSAGES if any) → PHONE NUMBERS → EMAILS → RELATIONSHIPS → DETAILS → FINANCING → BACKGROUND → INQUIRIES → CUSTOM FIELDS → ADDRESS.
- AC-INFO-2: PHONE NUMBERS section shows SMS (purple 40 pt circle) + Call (green 40 pt circle) action buttons per phone row.
- AC-INFO-3: EMAILS section shows email (sky-blue 40 pt circle) action button per email row.
- AC-INFO-4: DETAILS section renders all 6 rows (Assigned to / Stage / Source / Tags / Time frame / Collaborators) always visible.
- AC-INFO-5: Tags row taps push to TagsListScreen (§ 25.10).
- AC-INFO-6: FINANCING section shows "TRANSFER TO LENDER ›" all-caps `text-accent-foreground` when `contact.lender` is null.
- AC-INFO-7: INQUIRIES rows show speech-bubble icon (green), type, via-source, optional address, right-aligned date.
- AC-INFO-8: CUSTOM FIELDS empty state shows "Add Custom Fields..." link; populated state shows "EDIT ALL..." in section header.
- AC-INFO-9: ADDRESS rows render type + linked address text + diamond nav icon; tap opens AddressMapScreen.

---

## 25.6 COMMS Tab

**[OBSERVED — mob-04 (Theresa Wise), mob-13 (Jim Langevin), mob-27 (Derek Winchell)]**

### 25.6.1 Overview

A chronological list of all inbound and outbound communications (emails + texts). Newest first. Empty state below last item is `bg-secondary` light gray.

### 25.6.2 Email row

**[OBSERVED — mob-04, mob-13, mob-27]**

```
[envelope icon]   [subject line bold]         [date right]
                  [sender]  [thread badge]
                  [preview text]
─────────────────────────────────────────────────────
(open tracking — optional, see below)
```

| Element | Spec | Source |
|---|---|---|
| Icon | Envelope outline, `text-accent-foreground` (~#5BA4CF), 22 pt, left | OBSERVED mob-04, mob-27 |
| Subject | Geist 500 14 pt `text-foreground`, 1 line truncated | OBSERVED mob-04 "Re: Your Bend home search is set, Theresa" |
| Date | Geist 400 12 pt `text-muted-foreground` right-aligned | OBSERVED mob-04 "Jun 17" |
| Sender | Geist 500 13 pt `text-foreground`. Examples: `"Theresa Wise"` (inbound), `"Matt Ryan"` (outbound) | OBSERVED mob-04 |
| Thread count badge | Circular badge right of sender: `bg-muted` gray ~#9E9E9E bg, white text, 18 pt diameter, Geist 600 11 pt. Value = thread email count. Examples: `"3"` [mob-04], `"4"`, `"9"` [mob-13] | OBSERVED mob-04, mob-13 |
| Preview | Geist 400 13 pt `text-muted-foreground`, 1 line truncated | OBSERVED mob-04 |
| Row height | ~80 pt (3 sub-rows + padding) | |
| Background | `bg-card` white | |
| Separator | 1 pt `border-border` inset 16 pt | |

**"Archived" label:**
- When email is archived: `"archived"` text label in `text-muted-foreground` 11 pt appears above or left of the date. [OBSERVED mob-04 Row 2, mob-27 all 4 rows]
- Row background same white `bg-card`.

**Open-tracking sub-row (below email row, when email was opened):**
- Orange envelope icon: `text-warning-foreground` (#F5A023–#e8804a), 16 pt [OBSERVED mob-04, mob-27]
- `"N open(s)"` — Geist 500 13 pt `text-foreground`. Example: `"1 open"` [mob-04]
- `"Last opened [date]"` — Geist 400 12 pt `text-muted-foreground`. Example: `"Last opened Jun 17"` [mob-04]
- This sub-row is inset ~16 pt and appears only when `emailOpenCount > 0`.

```tsx
<EmailRow>
  <div className="flex gap-3 px-4 py-3">
    <Mail className="text-accent-foreground mt-0.5" size={20} />
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start gap-2">
        <p className="font-medium text-sm text-foreground truncate flex-1">{email.subject}</p>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {email.archived && <span className="mr-1">archived</span>}
          {email.date}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-sm font-medium text-foreground">{email.senderName}</span>
        {email.threadCount > 1 && (
          <Badge className="bg-muted text-muted-foreground text-[11px] h-[18px] min-w-[18px] rounded-full px-1">
            {email.threadCount}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</p>
    </div>
  </div>
  {email.openCount > 0 && (
    <div className="flex items-center gap-2 px-4 pb-3 pl-[52px]">
      <MailOpen className="text-warning-foreground" size={16} />
      <span className="text-sm font-medium text-foreground">{email.openCount} open{email.openCount > 1 ? 's' : ''}</span>
      <span className="text-xs text-muted-foreground">Last opened {email.lastOpenedDate}</span>
    </div>
  )}
</EmailRow>
```

### 25.6.3 SMS / text row

**[OBSERVED — mob-13]**

```
[speech-bubbles icon]   [participants line]          [date right]
                        [preview text]
```

| Element | Spec | Source |
|---|---|---|
| Icon | Two overlapping speech bubbles, `text-accent-foreground` (~#6B8FDE blue-purple), 22 pt | OBSERVED mob-13 |
| Participants | Geist 500 13 pt `text-foreground`. Patterns: `"You texted [name]"` (outbound) / `"[Name] texted [names]"` (inbound group). Example: `"You texted Jim Langevin, Lisa..."` | OBSERVED mob-13 |
| Date | `text-muted-foreground` 12 pt right-aligned | OBSERVED mob-13 |
| Preview | `text-muted-foreground` 13 pt 1 line truncated | OBSERVED mob-13 |
| Row height | ~64 pt | |

### 25.6.4 Empty state and FAB

**Empty zone:** `bg-secondary` (~#EEF1F5) below last row when list has fewer items than screen height. [OBSERVED mob-04]

**FAB:**
- Circle 56 pt, `bg-primary` (#102742), white `+` icon 24 pt
- Bottom-right: 20 pt from right, 24 pt from bottom safe area
- Tap → opens compose bottom sheet: "Send Email" / "Send Text" / "Log Call" options [INFERRED from FUB pattern; FAB bg observed as ~#5BA4CF in mob-04 — translate to `bg-primary`]

### 25.6.5 Comms tab acceptance criteria

- AC-COMMS-1: Email rows show envelope icon (accent color), bold subject, sender + thread badge, preview, right-aligned date.
- AC-COMMS-2: Archived emails show "archived" label in muted foreground; no special background change.
- AC-COMMS-3: Open-tracking sub-row appears below email row only when `email.openCount > 0`; orange envelope + "N open(s)" + "Last opened [date]".
- AC-COMMS-4: SMS rows show overlapping speech bubbles icon (blue-purple accent), participant pattern text, preview, date.
- AC-COMMS-5: FAB is `bg-primary`; tap opens compose options sheet.
- AC-COMMS-6: Timeline is reverse-chronological (newest first).

---

## 25.7 HOMES Tab

**[OBSERVED — mob-14 (Jim Langevin), mob-28 (Derek Winchell empty), mob-29 (Tide Rivers), mob-33 (Matthew Ryan)]**

### 25.7.1 Empty state

**[OBSERVED — mob-28]**

| Element | Spec | Source |
|---|---|---|
| Icon | Outline house glyph, ~80 pt, `text-muted-foreground` (~#9aabb8) | OBSERVED mob-28 |
| Primary text | `"No Home Searches"` — Geist 600 18 pt `text-muted-foreground` center | OBSERVED mob-28 |
| Secondary text | `"When your client views or saves properties, you'll see them here"` — Geist 400 14 pt `text-muted-foreground` center | OBSERVED mob-28 |
| Centering | Vertical center of content area | |
| Horizontal padding | 32 pt each side | |

```tsx
{homesActivity.length === 0 && (
  <EmptyState className="flex flex-col items-center justify-center flex-1 px-8 text-center">
    <Home className="text-muted-foreground mb-4" size={80} strokeWidth={1.5} />
    <p className="text-muted-foreground font-semibold text-lg mb-2">No Home Searches</p>
    <p className="text-muted-foreground text-sm leading-relaxed">
      When your client views or saves properties, you'll see them here
    </p>
  </EmptyState>
)}
```

### 25.7.2 Populated state

**[OBSERVED — mob-14, mob-29, mob-33]**

**Section header:** `"ACTIVITY"` left + `"SEE ALL"` right (`text-accent-foreground` 13 pt). [OBSERVED mob-14, mob-29, mob-33]

**Horizontal card carousel:**
- `overflow-x: auto` scrollable row of property inquiry cards.
- Left padding: 12–16 pt. Card gap: 10–12 pt.
- Each card width: ~170–214 pt (allows peek of next card at right edge). [OBSERVED mob-29 ~214 pt; mob-33 ~170 pt]
- Right-edge chevron affordance pill (light gray pill + dark gray `>` chevron) at carousel right edge. [OBSERVED mob-33]

**Property inquiry card anatomy:**

```
┌────────────────────────────┐
│  [Photo or placeholder]    │  ← 110–130 pt tall
│  [Badge top-left]          │  ← "Seller Inquiry" / "Viewed" / "Property Inquiry" pill
├────────────────────────────┤
│ Price                  ⋯   │  ← "Price unavailable" or "$X,XXX,XXX"; ⋯ kebab
│ Street address...          │  ← truncated
│ MLS #XXXXXXX              │  ← or "MLS ID unavailable"
│ 👁 N view(s)              │
└────────────────────────────┘
```

| Element | Spec | Source |
|---|---|---|
| Card bg | `bg-card` white | OBSERVED mob-14, mob-29, mob-33 |
| Card border-radius | 12 pt | OBSERVED mob-14, mob-29, mob-33 |
| Card shadow | `shadow-sm` (0 2px 8px rgba(0,0,0,0.08)) | OBSERVED mob-14 |
| Photo zone height | 110–130 pt | OBSERVED mob-14 ~130 pt, mob-33 ~110 pt |
| Photo placeholder bg | `bg-secondary` (~#EBF0F5) with centered house icon `text-muted-foreground` 40 pt | OBSERVED mob-29 |
| Badge (top-left of photo) | Pill: `bg-foreground` (#1A1A1A) bg, white text Geist 600 10–11 pt, 4 px padding vertical / 8 px horizontal, 12 pt radius. Badge text = inquiry type string | OBSERVED mob-14 "Property Inquiry", mob-29 "Seller Inquiry", mob-33 "Viewed" |
| Price | Geist 600 13–14 pt `text-foreground`. `"Price unavailable"` when MLS resolution fails | OBSERVED mob-14 "$655,000", mob-29 "Price unavailable", mob-33 "Price unavailable" |
| Kebab | `"···"` or `⋯`, `text-accent-foreground`, right-aligned of price row | OBSERVED mob-33 |
| Address | Geist 400 12–13 pt `text-muted-foreground`, 1 line truncated | OBSERVED mob-33 "67480 Cloverdale, Ben..." |
| MLS | Geist 400 11–12 pt `text-muted-foreground`. `"MLS ID unavailable"` when no ID | OBSERVED mob-33 "MLS #220207865", mob-29 "MLS ID unavailable" |
| View count | Eye icon (outline 12 pt `text-muted-foreground`) + `"N view(s)"` 11 pt `text-muted-foreground` | OBSERVED mob-33 "1 view" / "5 views", mob-14 "1 view" |
| Card body padding | 10 pt horizontal, 8 pt top/bottom | |

### 25.7.3 FAB

- Circle 56 pt, `bg-primary`, white `+`
- Tap → bottom sheet: "Add Property Inquiry" / "Link Listing" [INFERRED]

### 25.7.4 Homes tab acceptance criteria

- AC-HOMES-1: Empty state shows house icon, "No Home Searches", body text — centered vertically.
- AC-HOMES-2: Populated state shows "ACTIVITY" section header + "SEE ALL" link + horizontal scrolling card carousel.
- AC-HOMES-3: Each property card shows: photo/placeholder, inquiry-type badge (black pill, white text), price, address, MLS, view count + eye icon.
- AC-HOMES-4: "Price unavailable" and "MLS ID unavailable" render as fallbacks when data is missing.
- AC-HOMES-5: Cards clip at right edge to signal horizontal scrollability.

---

## 25.8 NOTES Tab

**[OBSERVED — mob-30 (Tide Rivers), mob-37 (Matthew Ryan)]**

### 25.8.1 Layout

Content area `bg-secondary` (~#f0f0f0–#eef0f4). Cards are white `bg-card`.

### 25.8.2 "Add note" inline action row

**[OBSERVED — mob-30, mob-37]**

- Left: filled circle icon ~20–22 pt, `bg-accent` fill, white `+` glyph.
- Label: `"Add note"` `text-accent-foreground` 16 pt regular.
- Full-width tap target, 16 pt left padding, ~44 pt height.
- Tap → opens note composer (same as FAB). [OBSERVED mob-30, mob-37]

### 25.8.3 Note card

**[OBSERVED — mob-30 (1 note), mob-37 (5 notes)]**

```
┌────────────────────────────────────────────────┐
│ [Broker avatar 36–40pt] [Author name]  [Date] │
│                          [Note body]           │
│                          [body truncated...]   │
└────────────────────────────────────────────────┘
```

| Element | Spec | Source |
|---|---|---|
| Card bg | `bg-card` white | OBSERVED mob-30, mob-37 |
| Card separator | 1 pt `border-border` top border (no gap between cards — divider only) | OBSERVED mob-37 |
| Card margin | 16 pt horizontal when distinct card (mob-30); 0 pt when divider-separated list (mob-37) | |
| Broker avatar | 36–40 pt circle, real broker headshot photo (circular crop). Example: Matt Ryan headshot (blue blazer) | OBSERVED mob-30 "Matt Ryan headshot", mob-37 |
| Author name | Geist 600 14–15 pt `text-foreground`. Example: `"Matt Ryan"` | OBSERVED mob-30, mob-37 |
| Date | Right-aligned, Geist 400 12–13 pt `text-muted-foreground`. Format: `"Tue, 8:16pm"` (same week) / `"Jun 13"` (older) | OBSERVED mob-30 "Jun 13", mob-37 "Tue, 8:16pm", "Jun 22" |
| Body | Geist 400 13–14 pt `text-foreground`, line-height 20 pt, 4–6 lines max before truncation. Hyperlinks (email addresses, URLs) rendered as `text-accent-foreground` tappable links | OBSERVED mob-30 "LEAD ORIGIN\nSource: Seller LP...", mob-37 "Matt alert: matt@ryan-realty.com is back..." |
| Card padding | 12 pt all sides | OBSERVED mob-30 |
| Author-to-body gap | 6 pt vertical | OBSERVED mob-37 |

**Truncation:** Notes truncate at ~4–6 lines. Tap card to expand / push note detail. [INFERRED]
**Swipe left:** Reveals red "Delete" action. [INFERRED from iOS UX conventions]

```tsx
{notes.map(note => (
  <Card key={note.id} className="mx-4 mb-2 bg-card border-border" onClick={() => openNoteDetail(note)}>
    <CardContent className="p-3">
      <div className="flex items-start gap-3">
        <BrokerAvatar size={36} broker={note.author} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm text-foreground">{note.author.name}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatNoteDate(note.createdAt)}</span>
          </div>
          <LinkifiedText
            text={note.body}
            linkColor="text-accent-foreground"
            numberOfLines={5}
            className="text-sm text-foreground leading-5"
          />
        </div>
      </div>
    </CardContent>
  </Card>
))}
```

### 25.8.4 Empty state

**[INFERRED — not directly observed (all observed contacts had notes)]**

```tsx
{notes.length === 0 && (
  <div className="flex flex-col items-center justify-center flex-1 px-8 text-center py-16">
    <StickyNote className="text-muted-foreground mb-3" size={48} strokeWidth={1.5} />
    <p className="text-muted-foreground text-base font-medium">No notes yet</p>
    <p className="text-muted-foreground text-sm mt-1">Tap + to add the first note</p>
  </div>
)}
```

### 25.8.5 FAB

- Circle 56 pt, `bg-primary` (#102742), white `+` 24 pt
- Bottom-right: 20 pt from right, 32 pt from bottom safe area
- Tap → opens note composer bottom sheet: `<Textarea>` autofocused, "Add note" title, Save + Cancel buttons. [OBSERVED mob-30, mob-37]

### 25.8.6 Note composer bottom sheet

**[INFERRED from FUB pattern + desktop §07b §4.1]**

```tsx
<Sheet open={composerOpen} onOpenChange={setComposerOpen}>
  <SheetContent side="bottom" className="h-[60vh]">
    <SheetHeader><SheetTitle>Add note</SheetTitle></SheetHeader>
    <Textarea
      autoFocus
      placeholder="Add notes or type @name to notify"
      className="flex-1 min-h-[120px] resize-none"
      value={noteBody}
      onChange={e => setNoteBody(e.target.value)}
    />
    <div className="flex justify-end gap-2 mt-3">
      <Button variant="outline" onClick={() => setComposerOpen(false)}>Cancel</Button>
      <Button disabled={!noteBody.trim()} onClick={saveNote}>Create Note</Button>
    </div>
  </SheetContent>
</Sheet>
```

### 25.8.7 Notes tab acceptance criteria

- AC-NOTES-1: "Add note" row (accent circle-plus icon + label) always appears at top of notes list.
- AC-NOTES-2: Note cards show broker headshot avatar (36 pt), author name (bold), date (right-aligned), body (truncated at 5 lines).
- AC-NOTES-3: URLs and email addresses in note body render as tappable `text-accent-foreground` links.
- AC-NOTES-4: Date format: `"Tue, 8:16pm"` for notes created this week; `"Jun 13"` for older.
- AC-NOTES-5: FAB tap and "Add note" row tap both open the same note composer `<Sheet>`.
- AC-NOTES-6: Empty state shows when `notes.length === 0`.

---

## 25.9 CALENDAR Tab

**[OBSERVED — mob-31 (Tide Rivers, empty state)]**

### 25.9.1 "Add Appointment or Task" inline row

**[OBSERVED — mob-31]**

- Left: filled circle icon ~22 pt, `bg-accent` fill, white `+` glyph.
- Label: `"Add Appointment or Task"` `text-accent-foreground` 16 pt regular.
- Full-width tap target, 16 pt left padding, ~44 pt height.
- Background: `bg-secondary`.

### 25.9.2 Empty state

**[OBSERVED — mob-31]**

| Element | Spec | Source |
|---|---|---|
| Icon | Compound calendar+clock glyph (~64 pt), `text-muted-foreground` (~#9aabb8). Custom: overlay `CalendarDays` with `Clock` icons | OBSERVED mob-31 |
| Primary text | `"No Scheduled Appointments"` — Geist 600 17 pt `text-muted-foreground` (#6b7d8e) center | OBSERVED mob-31 |
| Secondary text | `"Tasks and Appointments will show up here"` — Geist 400 14 pt `text-muted-foreground` (#8a9baa) center | OBSERVED mob-31 |
| Position | Centered ~120 pt below the "Add" row | OBSERVED mob-31 |

```tsx
<div className="flex flex-col items-center justify-center px-8 text-center pt-16 pb-8">
  <div className="relative mb-4">
    <CalendarDays className="text-muted-foreground" size={56} strokeWidth={1.5} />
    <Clock className="text-muted-foreground absolute -bottom-1 -right-1 bg-secondary rounded-full p-0.5" size={24} strokeWidth={1.5} />
  </div>
  <p className="text-muted-foreground font-semibold text-[17px] mb-1">No Scheduled Appointments</p>
  <p className="text-muted-foreground text-sm leading-relaxed">Tasks and Appointments will show up here</p>
</div>
```

### 25.9.3 Populated state (appointment/task rows)

**[INFERRED — empty state shown in all observed sources; no populated Calendar tab observed]**

Each row:

```
[Date badge]  [Appointment title]           [Time right]
              [Contact name]
              [Type: Appointment | Task]
```

- Date badge: `bg-accent` circle or square, white text, ~40 pt. [INFERRED from FUB patterns]
- Title: Geist 500 14 pt `text-foreground`
- Contact + type: `text-muted-foreground` 12 pt
- Tap row → opens appointment/task detail or edit sheet

### 25.9.4 FAB

- Circle 56 pt, `bg-primary`, white `+` 24 pt
- Tap → opens `<Sheet>` to create appointment or task linked to this contact. [OBSERVED mob-31 button behavior]

### 25.9.5 Calendar tab acceptance criteria

- AC-CAL-1: "Add Appointment or Task" row appears at top (accent circle-plus + label).
- AC-CAL-2: Empty state shows compound calendar+clock icon, "No Scheduled Appointments", subtitle.
- AC-CAL-3: FAB tap and "Add Appointment or Task" tap open the same create-appointment/task sheet.
- AC-CAL-4: When `appointments.length > 0` or `tasks.length > 0`, rows render in chronological order; empty state hidden.

---

## 25.10 Tags List Screen (pushed)

**[OBSERVED — mob-55]**

**Route:** `/crm/people/[id]/tags` (push navigation from Info → Tags row)

### 25.10.1 Screen regions

| Region | y-band (pt) | Background |
|---|---|---|
| Status bar | 0–54 | `bg-primary` |
| Nav bar | 54–98 | `bg-primary` |
| "Add tags" sticky row | 98–144 | `bg-secondary` (#EEF3F8) |
| Tag list | 144–bottom | `bg-card` white |

### 25.10.2 Nav bar

- **Left:** Back chevron `‹`, `text-primary-foreground` white, 22 pt. Tap → pop to Contact Detail Info tab. [OBSERVED mob-55]
- **Center:** Title `"Tags"`, `text-primary-foreground` white, Geist 600 17 pt. [OBSERVED mob-55]
- **Right:** `"Edit"` text button, `text-primary-foreground` white, Geist 400 17 pt. Tap → enters edit mode (red delete circles on rows). [OBSERVED mob-55]

```tsx
<TopBar className="bg-primary h-11">
  <BackButton />
  <h1 className="text-primary-foreground font-semibold text-[17px]">Tags</h1>
  <button onClick={enterEditMode} className="text-primary-foreground text-[17px]">Edit</button>
</TopBar>
```

### 25.10.3 "Add tags" sticky row

**[OBSERVED — mob-55]**

- Background: `bg-secondary` (`#EEF3F8`).
- Left: Filled circle ~28 pt, `bg-accent` fill, white `+` glyph 16 pt.
- Label: `"Add tags"` `text-accent-foreground` 16 pt.
- Tap → opens tag picker `<Sheet>`: search field + all available tags list + "Create new" option. [INFERRED]
- Bottom border: 1 pt `border-border`.

### 25.10.4 Tag rows

**[OBSERVED — mob-55, 15 tags visible]**

| Element | Spec |
|---|---|
| Row height | 50–52 pt |
| Left text | Tag name, Geist 400 16–17 pt `text-foreground` (#2D4A5A), 16 pt left inset |
| Separator | 1 pt `border-border` full-width hairline between rows |
| No right element | No chevron, no badge, no secondary text — pure label rows |
| Sort order | Alphabetical, case-insensitive (capitals first, then lowercase/namespaced) |

**Observed tags (mob-55, top to bottom):**
1. `Bend`
2. `Buyer`
3. `Client`
4. `Expired`
5. `Expired Listings`
6. `Import`
7. `audience:buyer`
8. `city:bend`
9. `contact:has-phone`
10. `contact:mobile-phone`
11. `geo:local`
12. `geo:out-of-state`
13. `motivated`
14. `neighborhood:bend-boyd-acres`
15. `owner:absentee`

**Edit mode:** Red `–` (minus) circle appears left of each row (iOS destructive delete pattern). `"Edit"` button replaced by `"Done"`. [INFERRED from mob-55 "Edit" right button semantics]

**Swipe left:** Reveals red `"Delete"` action button. [INFERRED]

```tsx
<ul className="divide-y divide-border">
  {tags
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map(tag => (
      <li key={tag.id} className="flex items-center h-[52px] px-4">
        {editMode && (
          <button onClick={() => confirmDeleteTag(tag)} className="mr-3 text-destructive">
            <MinusCircle size={22} />
          </button>
        )}
        <span className="text-[16px] text-foreground">{tag.name}</span>
      </li>
    ))}
</ul>
```

### 25.10.5 Tags screen data

| Field | Source |
|---|---|
| Tags list | `crm_people_tags` JOIN `crm_tags` WHERE `person_id = contact.id` |
| All tags (picker) | `crm_tags` WHERE `account_id = account.id` ORDER BY name |
| Add tag | INSERT `crm_people_tags (person_id, tag_id)` |
| Remove tag | DELETE `crm_people_tags WHERE person_id = ? AND tag_id = ?` |

### 25.10.6 Tags screen acceptance criteria

- AC-TAGS-1: Nav bar shows back chevron + "Tags" title + "Edit" right button, all `text-primary-foreground` on `bg-primary`.
- AC-TAGS-2: "Add tags" row is sticky above list, `bg-secondary`, accent circle-plus icon.
- AC-TAGS-3: Tag rows are alphabetical (case-insensitive), 52 pt height, no right decoration.
- AC-TAGS-4: Edit mode shows red minus circles; "Edit" → "Done".
- AC-TAGS-5: Swipe-left reveals "Delete" action that removes tag from contact only (does not delete global tag).

---

## 25.11 Address / Map Screen (pushed)

**[OBSERVED — mob-56]**

**Route:** `/crm/people/[id]/address/[addressId]` (push navigation from Info → ADDRESS row tap)

### 25.11.1 Screen regions

| Region | y-band (pt) | Background |
|---|---|---|
| Status bar | 0–44 | `bg-primary` |
| Nav bar | 44–88 | `bg-primary` |
| Map embed | 88–380 | Google Maps (light road style) |
| Address block | 380–450 | `bg-card` white |
| Note/description block | 450–550 | `bg-card` white |
| Directions button | 550–620 | `bg-card` white |
| Whitespace | 620+ | `bg-card` white |

### 25.11.2 Nav bar

**[OBSERVED — mob-56]**

- **Left:** Back chevron `‹`, `text-primary-foreground` white, 18–22 pt. Pop to Contact Detail.
- **Center:** Title = inquiry type / address type. Example: `"Seller Inquiry"` [OBSERVED mob-56 shows inquiry type as screen title] `text-primary-foreground` Geist 600 17 pt.
- **Right:** None. [OBSERVED mob-56]

### 25.11.3 Google Maps embed

**[OBSERVED — mob-56]**

- Full-width, ~292 pt height, no border radius (flush to edges of screen).
- Light road-map style (Google Maps standard).
- Single red teardrop marker at geocoded address.
- Example: Pin at `20702 Beaumont Dr, Bend, Oregon 97701` with `zoom=14`. [OBSERVED mob-56]
- Tap the map → open native Maps app / Google Maps at the address. [INFERRED]
- **Floating message button (top-right of map):** Small circle (~36 pt), `bg-primary` bg, white envelope icon. Tap → compose message to contact. [OBSERVED mob-56 — small circular dark badge]

**Web implementation:** Use `<iframe src="https://maps.google.com/maps?q=...&output=embed">` OR `@react-google-maps/api` `<GoogleMap>` component. Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. For mobile PWA fallback: display static map image from Maps Static API + link to `maps.google.com`.

```tsx
<div className="relative">
  <div className="w-full h-[292px]">
    <GoogleMap
      center={address.geocoords}
      zoom={14}
      mapTypeId="roadmap"
    >
      <Marker position={address.geocoords} />
    </GoogleMap>
  </div>
  <button
    onClick={composeMessage}
    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-md"
  >
    <Mail className="text-primary-foreground" size={16} />
  </button>
</div>
```

### 25.11.4 Address block

**[OBSERVED — mob-56]**

- Horizontal padding: 16 pt.
- Top padding: 16 pt from map bottom.
- Line 1: Street address, Geist 600 20 pt `text-foreground`. Example: `"20702 Beaumont Dr"` [OBSERVED mob-56]
- Line 2: City/state/zip, Geist 400 16 pt `text-foreground`. Example: `"Bend, Oregon 97701"` [OBSERVED mob-56]

### 25.11.5 Note / description block

**[OBSERVED — mob-56]**

- Horizontal padding: 16 pt.
- Top padding: 12 pt.
- Body text: Geist 400 14 pt `text-foreground` (#333333), line-height 20 pt, truncated at 3 lines.
- Observed verbatim (mob-56): `"[HOME VALUATION] Source: https://ryan-realty.com/free-home-valuation/ Address: 20702 Beaumont Drive, Bend, Oregon 97701,"` — this is raw FUB form-submission note content.
- `"See more"` inline link at end of truncation: `text-accent-foreground` 14 pt. Tap → expands full text. [OBSERVED mob-56]

### 25.11.6 Directions button

**[OBSERVED — mob-56]**

- Outline/ghost style button, ~240 pt wide × 44 pt tall.
- `border-border` 1 pt, `bg-secondary` fill, `border-radius` 8 pt.
- Left: map-pin icon, `text-muted-foreground` 16 pt.
- Label: `"Directions"`, `text-muted-foreground` Geist 500 15 pt.
- Left-aligned (16 pt left pad), not full-width.
- Tap → opens `maps://` (Apple Maps) or `https://maps.google.com/...` with address as destination. [INFERRED]

```tsx
<Button
  variant="outline"
  className="ml-4 w-[240px] h-11 text-muted-foreground border-border bg-secondary text-sm font-medium"
  onClick={() => openDirections(address)}
>
  <MapPin className="mr-2 text-muted-foreground" size={16} />
  Directions
</Button>
```

### 25.11.7 Address screen data

| Field | Source |
|---|---|
| Screen title | Inquiry type (`"Seller Inquiry"`, `"Buyer Inquiry"`) or address type (`"home"`, `"Property"`) |
| Address geocoords | `crm_contact_addresses.lat`, `crm_contact_addresses.lng` (geocoded async on address save) |
| Street / city / state / zip | `crm_contact_addresses.street`, `.city`, `.state`, `.zip` |
| Note text | Associated inquiry note body, or address description, from `crm_timeline` or `crm_contact_addresses.notes` |

### 25.11.8 Address screen acceptance criteria

- AC-MAP-1: Nav bar shows back chevron + inquiry/address type as title on `bg-primary`.
- AC-MAP-2: Google Maps embed is full-width, ~292 pt tall, with red marker at geocoded address.
- AC-MAP-3: Address block shows street (bold 20 pt) and city/state/zip (regular 16 pt).
- AC-MAP-4: Note block shows raw note text truncated at 3 lines with "See more" expansion link.
- AC-MAP-5: Directions button opens native maps navigation at the address.

---

## 25.12 FAB Per-Tab Summary

| Tab | FAB color | Primary action | Sheet content |
|---|---|---|---|
| Info | `bg-primary` | Varies by context | Quick actions: Log Call, Send Text, Send Email [INFERRED] |
| Comms | `bg-primary` | Compose | Send Email / Send Text / Log Call options [INFERRED from mob-04] |
| Homes | `bg-primary` | Add property inquiry | Link listing, add interest [INFERRED from mob-29] |
| Notes | `bg-primary` | Add note | Note composer textarea [OBSERVED mob-30, mob-37] |
| Calendar | `bg-primary` | Add appointment/task | Create appointment or task form [OBSERVED mob-31] |

All FABs: 56 pt circle, `bg-primary` (#102742), white `+` icon (24 pt), positioned 20 pt from right edge, 24–32 pt from bottom safe area. Shadow: `shadow-lg` with primary color tint.

---

## 25.13 Right-Edge Panel Handle

**[OBSERVED — mob-25, mob-26, mob-30, mob-28, mob-29]**

A persistent vertical pull-handle visible on the right edge of the screen. Present on Info, Notes, and Homes tabs (at minimum).

| Element | Spec | Source |
|---|---|---|
| Shape | Rounded-left rectangle pill, ~14–18 pt wide × 60–70 pt tall | OBSERVED mob-25, mob-29 |
| Background | Dark charcoal ~#4a4a4a–#B0B8C4 (darker in mob-25, lighter in mob-29) | OBSERVED |
| Icon | Left-pointing chevron `‹`, white, ~12–14 pt | OBSERVED mob-25, mob-30 |
| Position | Flush right edge (x=375–390), vertically centered in content area (~y=360–430) | OBSERVED |
| Action | Expands a right-side panel (collapsed by default on mobile). [INFERRED from iPad split-view FUB pattern] | |

**Web implementation note:** On mobile viewport (< 640 px), the right panel is hidden. The pull handle reveals a `<Sheet side="right">` containing abbreviated contact actions or the next/prev contact navigation. [INFERRED] If not building the right panel for MVP, omit the handle.

---

## 25.14 Data Model Summary

All data for this screen flows through the `/api/crm/people/[id]` route and related endpoints.

| Data field | Table / source | Notes |
|---|---|---|
| `contact.name` | `crm_people.first_name + last_name` | |
| `contact.profileImageUrl` | `crm_people.profile_image_url` | Async social-enrichment populated |
| `contact.lastCommSummary` | Computed from `crm_timeline` MAX(`created_at`) WHERE `kind IN (...)` | |
| `contact.priceTarget` | `crm_people.price_target` | Nullable |
| `contact.phones[]` | `crm_people_phones` WHERE `person_id` | Array of `{type, number, attribution}` |
| `contact.emails[]` | `crm_people_emails` WHERE `person_id` | Array of `{address, attribution}` |
| `contact.relationships[]` | `crm_people_relationships` JOIN `crm_people` | `{relatedPerson, relationshipType}` |
| `contact.assignedTo` | `crm_people.assigned_user_id` → `crm_users.name` | |
| `contact.stage` | `crm_people.stage` | String enum |
| `contact.source` | `crm_people.source` | String |
| `contact.tags[]` | `crm_people_tags` JOIN `crm_tags` | `{id, name}` |
| `contact.timeframe` | `crm_people.timeframe` | Nullable string |
| `contact.collaborators[]` | `crm_deal_collaborators` or `crm_people.collaborators` | Array of broker objects |
| `contact.lender` | `crm_people.lender_id` → `crm_lenders` | Nullable |
| `contact.background` | `crm_people.background` | Nullable text |
| `contact.inquiries[]` | `crm_inquiries` WHERE `person_id` | `{type, source, address, date}` |
| `contact.customFields[]` | `crm_custom_field_values` WHERE `person_id` | `{fieldKey, fieldLabel, value}` |
| `contact.addresses[]` | `crm_contact_addresses` WHERE `person_id` | `{type, street, city, state, zip, lat, lng}` |
| `commsTimeline[]` | `crm_timeline` WHERE `person_id` ORDER BY `created_at DESC` | Filtered by kind |
| `email.openCount` | `crm_email_events` WHERE `email_id AND event_type='open'` COUNT | |
| `homesActivity[]` | `crm_property_views` JOIN `crm_listings` WHERE `person_id` | |
| `notes[]` | `crm_notes` WHERE `person_id` ORDER BY `created_at DESC` | |
| `appointments[]` + `tasks[]` | `crm_appointments`, `crm_tasks` WHERE `person_id` | |

---

## 25.15 Cross-References

| Section | Spec file | Connection |
|---|---|---|
| Left sidebar field editing | `07a-person-detail-sidebar-and-inline-edit.md` §2–§9 | Inline edit behavior for all DETAILS rows; avatar/header spec; data model |
| Activity timeline (Comms tab equivalent) | `07b-person-detail-timeline-and-engagement.md` §4–§6 | Email/text compose bar and timeline card types (desktop parallel) |
| Compose modals and right rail | `07c-person-detail-compose-modals-and-right-rail.md` §7c.2–§7c.6 | Note / Email / Text compose sheet specs |
| Contact list + smart lists | `§23 Mobile People List` | Navigation source → this screen |
| Contact edit mode | `§24 Mobile Inline Edit` | Activated via "Edit" button in header §25.3.2 |
| Notifications | `§26 Mobile Notifications` | Badge counts on sub-tabs; push notification tap → deep-links into Comms tab |
| Desktop person detail | `07a`, `07b`, `07c` | Same data model; mobile collapses three-column to single column + sub-tabs |
| Tags screen | `§25.10` this file | Pushed from DETAILS → Tags row |
| Address map screen | `§25.11` this file | Pushed from ADDRESS section row |

---

## 25.16 Sources

| Screenshot | Contact | Primary content documented |
|---|---|---|
| mob-02 | Andy Christensen | Info tab top: hero, sub-tab strip, PHONE NUMBERS, EMAILS, RELATIONSHIPS, DETAILS (partial) |
| mob-03 | Andy Christensen | Info tab scroll: DETAILS (Collaborators), FINANCING (TRANSFER TO LENDER), BACKGROUND, INQUIRIES, CUSTOM FIELDS |
| mob-04 | Theresa Wise | Comms tab: email rows, archived label, open-tracking row, empty state, FAB |
| mob-12 | Jim Langevin | Info tab: RECENT MESSAGES, PHONE NUMBERS (TEXT ALL...), price pill, RELATIONSHIPS (Lisa Langevin) |
| mob-13 | Jim Langevin | Comms tab: email rows with thread badges, SMS rows with overlapping speech-bubble icons |
| mob-14 | Jim Langevin | Homes tab: ACTIVITY header + property inquiry card (photo, badge, price, MLS, views) |
| mob-16 | Doug Millard | Info tab: 3 phones (one attributed), 3 emails, RELATIONSHIPS (Charise Millard), DETAILS |
| mob-18 | Doug Millard | Info tab: DETAILS, FINANCING (TRANSFER TO LENDER #3D9FCC), BACKGROUND, INQUIRIES (Property Inquiry) |
| mob-25 | Derek Winchell | Info tab: real headshot avatar, DETAILS (My Agent status row), right-edge panel handle |
| mob-26 | Derek Winchell | Info tab: FINANCING (#1A7CC4), BACKGROUND, INQUIRIES (Registration), CUSTOM FIELDS (empty, #1A7CC4 link) |
| mob-27 | Derek Winchell | Comms tab: 4 archived email rows, all with open-tracking sub-rows (orange envelope) |
| mob-28 | Derek Winchell | Homes tab: empty state (house icon, "No Home Searches", body text), right-edge handle |
| mob-29 | Tide Rivers | Homes tab: ACTIVITY section, Seller Inquiry property card (no photo placeholder), horizontal carousel |
| mob-30 | Tide Rivers | Notes tab: "Add note" row, 1 note card (Matt Ryan headshot, Jun 13, LEAD ORIGIN body), FAB |
| mob-31 | Tide Rivers | Calendar tab: "Add Appointment or Task" row, empty state (calendar+clock icon, text), FAB |
| mob-33 | Matthew Ryan | Homes tab: ACTIVITY section, 2 "Viewed" property cards (photos, price overlay, MLS data) |
| mob-37 | Matthew Ryan | Notes tab: "Add note" row, 5 auto-generated "Matt alert" notes, linkified URLs |
| mob-52 | Mary Bowman | Info tab: DETAILS (Active Client, Import source, Tags), FINANCING, BACKGROUND, ADDRESS (2 rows) |
| mob-53 | Mary Bowman | Info tab: BACKGROUND (pencil edit icon), ADDRESS (both entries), INQUIRIES (Seller Inquiry with address), CUSTOM FIELDS (populated, "EDIT ALL..." header) |
| mob-55 | (Tags list) | Tags sub-screen: nav "Tags" + "Edit", "Add tags" row, 15 tag rows alphabetically sorted |
| mob-56 | (Mary Bowman address) | Address/Map sub-screen: nav "Seller Inquiry", Google Maps 292 pt, address block, note body, Directions button |
| mob-59 | Derek Winchell | Info tab: 72 pt avatar photo, DETAILS with "My Agent status: Send Invite" row |
| mob-60 | Derek Winchell | Info tab: DETAILS, FINANCING (#5BA5D8), INQUIRIES (Registration), CUSTOM FIELDS (empty, #5BA5D8 link) |
| 07a desktop spec | — | Inline edit pattern, field data model, avatar spec |
| 07b desktop spec | — | Timeline event card types, compose bar, action bar |
| 07c desktop spec | — | Compose modal specs (Note/Email/Text) |

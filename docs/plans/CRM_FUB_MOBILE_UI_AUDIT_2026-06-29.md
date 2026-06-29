# CRM ↔ FUB mobile UI discrepancy audit — 2026-06-29

Source of truth: Matt's two emails "Ui 1" / "Ui 2" (2026-06-26, 19 iPhone screenshots of the
Follow Up Boss iOS app) + the earlier "Fub screenshots" set (2026-06-15). Saved locally at
`tmp/fub-ui/raw/`. Compared against our CRM mobile at 375px (admin console).

Legend: **FUB** = what the FUB app does (the target) · **Ours** = current Ryan Realty CRM ·
**Gap** = the discrepancy to close.

---

## ✅ Shipped 2026-06-29 (verified at 375px)

- **C11/C12** — Contact Info tab now renders FUB-style **Phone numbers** + **Emails**
  sections: every value listed, each row with its own quick-action icons (call +
  text per number, mail per email). Dropped the "Open in FUB" header link.
- **C10** — Contact header shows the **last-communication** line
  ("Owner · Matt · Last contact May 27"); green **deal-value pill** slot wired in
  `LeadTabs` (renders when deal data is surfaced).
- **C9 (labels)** — contact tabs relabeled to FUB: **Info · Comms · Tasks · Homes ·
  Workflow · Activity** (keys unchanged; hash routing intact).

## ✅ Shipped 2026-06-29 (pass 2 — Matt directive: "make ours identical to FUB, ours is clunky")

- **Info tab decluttered to FUB structure** — removed the redundant big
  Call/Text/Email buttons, the inline Stage/Assign dropdown+button forms, the
  standalone Source badge, and the "Plugged in" block. Info is now: Phone
  numbers · Emails · Details (Assigned/Stage/Source/Tags) · Memberships ·
  Relationships · Custom fields. Verified at 375px.
- **Call/Text/Email consolidated into the + button** — added "Call" to the
  context-aware + quick-action sheet (was Send text/email/note); call/text/email
  now all live in the + + the per-number icons (FUB pattern), not scattered.

### Follow-up (cheap, non-breaking warnings introduced by the declutter)
- Remove now-dead fetches/defs in `app/admin/console/leads/[id]/page.tsx`:
  `membership` + `firstTouch` (in the 14-way Promise.all destructure),
  `activeEnrollments`, and the `assignNewsletterForm` / `enrollWorkflowForm`
  server-action defs. ESLint warnings only; removing trims 2 dead queries/page.

## ✅ Shipped 2026-06-29 (pass 3 — Comms tab)

- **C20** — Comms tab cloned to the FUB row anatomy. Replaced the chat-bubble
  `ConversationThread` (inbound-left/outbound-right stream) with the new
  `components/admin/crm/ConversationFeed.tsx`: a chronological message-row list,
  newest first, edge-to-edge with hairline dividers. Each row = channel icon
  (Mail / MessageSquare / Phone / Voicemail in `text-primary`) · subject-or-
  descriptor ("matt texted Kevin" / "Kevin texted you" / "Outbound call") ·
  optional participant line · 2-line preview clamp · right-aligned `MMM d` date ·
  email open-count line (`MailOpen` + "N opens · Last opened …" in `text-success`).
  Rows expand on tap to reveal the full body, MMS attachments, and call
  recordings (richer than FUB's collapsed rows). Verified at 375px on lead 13014.
  Raw `<button>` row is allow-listed in `.design-token-lint-ignore` (same
  exception class as CrmMobileKit — no `<Button>` equivalent for a full-bleed,
  multi-line, left-aligned tappable row). Design-token total held at 352 (no
  regression). The composer ("Send a message") stays in its card below the feed.

## ✅ Shipped 2026-06-29 (pass 4 — Homes tab)

- **C21** — Homes tab cloned to FUB property cards. New
  `components/admin/crm/ViewedHomeCard.tsx` renders each shopped home as a
  vertical card: photo (16:9) with an activity badge overlay (`<Badge>` default
  navy — "Saved" / "Viewed", honest vs FUB's inquiry-only "Property Inquiry"),
  price + live MLS status pill, beds/baths, linked address, MLS#, and 👁 view
  count. Replaced the cramped horizontal "Watching" rows. Also removed the now-
  redundant "Homes viewed" sub-list from `ContactBehaviorPanel` (the cards own it
  with richer detail) — trimmed its unused `Link` / `listingDetailPath` imports.
  Verified at 375px on lead 13168. Design-token total held at 352 (Badge swap
  kept it off the ignore-list). Data note: viewed-homes count comes from
  `getViewedListingsForLead` (session→event join); off-market keys not in
  `listing_tile_mv` fall back to price-n/a + "Listing" honestly.

## ✅ Shipped 2026-06-29 (pass 5 — People list: person-first + avatars)

- **B4/B6** — avatars on every people row. Mobile rows already render the
  FUB colored-initials/photo `CrmAvatar` via `CrmListRow`. Brought the **desktop**
  table to parity: `BulkAssignWrapper` now uses `<CrmAvatar name src size={32} />`
  instead of the plain gray first-letter fallback.
- **B5 (person-first landing)** — the mobile `/admin/crm` was list-first (scroll
  past 9 system-list rows to reach people). Collapsed the mobile smart-lists into
  a `<details>` "Smart lists ▾" disclosure (collapsed by default) in
  `SavedViewSidebar`, so the people feed (avatar · name · stage badge · source ·
  date · chevron) is person-first with lists one tap away — FUB ui2_5821 pattern.
  Verified at 375px (collapsed → people first; tap → full SYSTEM LISTS).
- **Deferred (needs Matt's call on semantics):** the FUB "New Leads / Emails /
  Website" segmented tabs. These are activity-type filters over the person feed;
  "New leads" (by `fub_created_at`) and "Website" (visitor_sessions) map cleanly,
  but "Emails" needs an email-activity join and `listCrmPeople` gains 3 filter
  modes — a DAL change on the core people query. Person-first ordering (the heart
  of B5) is delivered; the tabs are a refinement to spec with Matt.

## ✅ Shipped 2026-06-29 (pass 6 — Filter sheet)

- **B8 (scope picker)** — new `components/admin/crm/BrokerScopeSheet.tsx`: a
  full-screen FUB scope sheet (Everyone · Me · TEAM MEMBERS with broker headshots
  + search), cloning ui1_5831's scope list. Replaced the clunky mobile "All
  brokers" `<select>` on `/admin/crm` with the sheet trigger ("Everyone ▾").
  Selecting a scope navigates with the `broker` param, carrying the active
  q/stage/tag/view filters; the trigger reflects current scope; current scope
  shows a check. Verified end-to-end at 375px (open → pick Paul → ?broker=paul →
  trigger updates). Component is reusable — the top-bar switcher (A2) will mount
  the same sheet. Design-token total held at 352.
- **Note:** FUB's "Current / Archived / All" status segment is deal-status-
  specific (no people-list analog), so it's intentionally omitted here; it
  belongs on a future Deals filter sheet (the deals page currently auto-scopes
  with no filter UI).

## ⏭️ Remaining (next session — roughly highest-value first)

- **People feed tabs** — New Leads / Emails / Website segmented control (see Deferred above).
- **C10 deal pill data** — surface the contact's open-deal value to fill the pill
  (fetch from `crm_deals`; the `dealValueLabel` prop is ready).
- **C13** — recent-messages preview card on the Info tab.
- **C16-19** — Financing/Lender, Background, Inquiries, Custom Fields rows on Info
  (some already exist under other tabs — reconcile, don't duplicate).
- **B4/B6** — avatars (initials/photo) on people-list + saved-view rows.
- **A2** — persistent "Everyone ▾" scope switcher + notification bell in the
  mobile top bar.
- **B5/B8** — person-first list landing + full-screen filter sheet (Current/
  Archived/All + team scoping).
- **A1 bottom bar** — NOTE: deliberately Home/Inbox/People/Deals/Activity per
  Matt's 2026-06-26 directive, not FUB's exact Inbox/Activity/Calendar/People/Deals.
  Leave as-is unless Matt revisits.

---

## A. Global / chrome

1. **Bottom tab bar — labels + order.**
   - FUB: `Inbox(badge) · Activity · Calendar · People · Deals` (Activity 2nd, Calendar present).
   - Ours: `Home · Inbox · People · Deals · Activity` (Activity last, no Calendar, has Home).
   - Gap: order differs; FUB has **Calendar** in the bar, we don't; FUB puts **Activity** in slot 2; FUB's Inbox carries an unread **count badge** (e.g. "30"). Decide whether to match FUB's 5 exactly (Inbox/Activity/Calendar/People/Deals) or keep Home.

2. **Top app bar.**
   - FUB: avatar (left) · scope switcher "**Everyone ▾**" (center) · bell (notifications) · search. The scope switcher (Everyone/Me/Team member) is global and persistent.
   - Ours: hamburger · logo · search · avatar. No persistent **Everyone ▾ scope switcher**, no **notification bell**.
   - Gap: add the persistent scope switcher and a notifications bell to the mobile top bar.

3. **Floating "+" action button.** FUB has a blue FAB on every contact + list screen (quick add note/call/text/email/task). Ours has a blue FAB too ✓ — verify it opens the same quick-create sheet.

4. **Avatars everywhere.** ✅ DONE (pass 5). FUB shows a **circular avatar on every person row** (photo, else colored initials). Mobile rows already used `CrmAvatar`; desktop table now does too (`BulkAssignWrapper`).

---

## B. Home / list screens

5. **Landing screen content.**
   - FUB: home is a **people feed** — tabs `New Leads · Emails · Website`, each row = avatar + name + "via <source>" + date, newest first.
   - Ours: `/admin/crm` ("Contacts") leads with **saved-view rows** (Leads 8,262, Hot Prospects 15, …) + management icons, then filters; the people themselves are below.
   - Gap: FUB is person-first; ours is list-first. Consider a person-feed landing (New Leads/Emails/Website) matching FUB, with saved lists one tap away.

6. **People row anatomy.**
   - FUB: `avatar · name (bold) · source/tag (muted) · date (right) · chevron`. New-lead rows show the inbound date/time; client rows show the source ("Import", "Zillow", "Word of Mouth", "Ryan-Realty.com").
   - Ours: saved-view rows show name + count + share/edit/delete icons. The actual person rows need the FUB anatomy (avatar + source subtitle + date + chevron).

7. **List header.** FUB list headers show "`<N> people`" and "Last updated: just now", plus a scope sub-line ("Everyone ▾"). Ours shows the list name + count. Add the "N people / last updated" header + scope line.

8. **Filter sheet (e.g. Filter Deals).** ✅ DONE (pass 6, scope picker) — `BrokerScopeSheet` clones ui1_5831's Everyone/Me/Team scope list for the people-list agent filter. The Current/Archived/All status segment is deferred to a future Deals filter (deal-specific).
   - FUB: a dedicated filter sheet — `Cancel / Filter Deals`, segmented **Current · Archived · All**, "Showing deals for: Everyone", search, then Everyone / Me / **TEAM MEMBERS** (avatars). Same pattern for the Automations picker (`Cancel / Automations / Select` + a flat searchable list).
   - Ours: filters are inline dropdowns (All stages / All brokers).
   - Gap: adopt FUB's full-screen filter sheet pattern with the segmented status control + team-member scoping.

---

## C. Contact-360 (the biggest gap — most discrepancies live here)

FUB screens: `ui1_5833, ui1_5834, ui1_5835, ui1_5837, ui2_5822, ui2_5823, ui2_5824`.
Ours: `/admin/console/leads/[id]`.

9. **Tab set.**
   - FUB: `Info · Comms · Homes · Notes · Calendar`.
   - Ours: `Overview · Comms · Tasks · Watching · Workflow`.
   - Gap: names + content differ. FUB has **Homes** (property activity), **Notes**, **Calendar**; we have Tasks/Watching/Workflow. Reconcile to FUB's set (at minimum add Homes + Notes + Calendar; map Watching→Homes).

10. **Header.**
    - FUB: avatar · name · "**Last communication <date>**" · **green deal $ pill** (e.g. `$655K`) when a deal exists · `Edit` (right).
    - Ours: avatar · name · "Owner · Matt Ryan" · stage badge · "Open in FUB ↗".
    - Gap: add **last-communication date** and the **deal value pill**; drop the "Open in FUB" link (we're replacing FUB); add an `Edit` affordance.

11. **Phone numbers section.**
    - FUB: a **PHONE NUMBERS** section listing **every** number with its label (mobile / name+relationship), each row with **two round quick-action icons: message (blue) + call (green)**, plus a **TEXT ALL** action.
    - Ours: a single phone line ("primary") + three big Call/Text/Email buttons at the top.
    - Gap: list all numbers, each with inline text+call icons; add TEXT ALL. (Our 3 big buttons are a reasonable top-level addition but the per-number icons are the FUB pattern.)

12. **Emails section.** FUB: **EMAILS** section, every address with a round **mail icon** + **EMAIL ALL**. Ours: single email line. Gap: list all emails with per-row mail action + EMAIL ALL.

13. **Recent messages preview.** FUB Info tab shows a **RECENT MESSAGES** card (latest thread: participants, phones, preview line). Ours has no recent-messages preview on the overview. Add it.

14. **Relationships.** FUB: **RELATIONSHIPS** section with linked people (e.g. "Lisa Langevin (Spouse)") + an add (`+` / "Add Relationship…"). Ours: none on mobile. Add.

15. **Details block.** FUB: **DETAILS** = Assigned to · Stage · Source · Tags · Time frame · Collaborators (each tappable). Ours: stage + assigned dropdowns + Source only. Gap: add Tags, Time frame, Collaborators rows in a Details block.

16. **Financing / Lender.** FUB: **FINANCING** → "Lender — TRANSFER TO LENDER". Ours: none. Add (or hide if not used).

17. **Background.** FUB: **BACKGROUND** free-text ("Add background"). Ours: none. Add.

18. **Inquiries.** FUB: **INQUIRIES** section (e.g. "General Inquiry via Ryan-Realty.com" + date). Ours: source shown but no inquiries list. Add.

19. **Custom fields.** FUB: **CUSTOM FIELDS** ("Add Custom Fields…"). Ours: not surfaced on mobile. Add.

20. **Comms tab.** ✅ DONE (pass 3, 2026-06-29 — see Shipped above). FUB: chronological message list — each row = channel icon (blue mail / blue text bubble) + subject/name + preview + date + open-count ("1 open · Last opened …") + unread count chip. Ours now matches via `ConversationFeed.tsx`. Remaining nicety: the gray thread-count chip (FUB groups a thread; we render per-message, so no count chip yet).

21. **Homes tab.** ✅ DONE (pass 4, 2026-06-29 — see Shipped above). FUB: **ACTIVITY / SEE ALL** + property cards (photo, "Property Inquiry" badge, price, beds/baths, address, MLS#, "👁 N views"). Ours now renders FUB property cards via `ViewedHomeCard.tsx`. Badge labels the activity we actually track (Saved/Viewed), not an unverified inquiry.

22. **PLUGGED IN / Memberships.** Ours has a "PLUGGED IN" block (Newsletter, Choose workflow + Enroll, saved searches) and "Memberships/Workflows" — FUB has no direct equivalent (it uses Action Plans/Automations). Keep, but make sure enroll/automation maps to the Automations picker pattern (screen ui1_5836).

---

## D. Quick wins (highest impact, lowest effort)

- Add **avatars** to every people row (B4/B6).
- Add **per-number text+call icons** and **per-email mail icon** on the contact Info tab (C11/C12).
- Add **last-communication date** + **deal $ pill** to the contact header (C10).
- Rename/expand contact tabs toward FUB's `Info · Comms · Homes · Notes · Calendar` (C9).
- Add the **Everyone ▾ scope switcher** + **notification bell** to the mobile top bar (A2).
- Decide the **bottom-bar set** (FUB = Inbox/Activity/Calendar/People/Deals) (A1).

---

## Notes
- This audit covers the primary screens in the two "Ui" emails (home, people lists, filter sheets, the full Contact-360, automations picker). The 2026-06-15 "Fub screenshots" set is largely the same surfaces; spot-check before building.
- Screens NOT yet captured from ours for 1:1: Calendar, Notes tab, Inbox detail — capture during the build.
- Recommend tackling **Contact-360 (section C)** first — it carries the most discrepancies and is the screen brokers live in.

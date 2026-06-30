# FUB UI recordings — captured 2026-06-30

Screen-recording GIFs of the live Follow Up Boss web app (ryan-realty.followupboss.com), captured to fill the **highest-build-value** coverage gaps from [`../CAPTURE-CHECKLIST.md`](../CAPTURE-CHECKLIST.md) that the `../api-export/` data dump can't show (interaction states, modals, pickers, config panels). 1316×904, animated GIF, click indicators + action labels overlaid.

Nothing was created, sent, enabled, deleted, or saved during capture. Every confirm/save/delete dialog was explicitly **cancelled** (notably the "Clear 267 Overdue Tasks" dialog and the draft-automation editor, which stayed `DISABLED`).

> **Reporting was already captured in a prior pass — intentionally skipped here** (Matt, 2026-06-30).

| # | File | Area | Key interaction states captured |
|---|------|------|----------------------------------|
| 2 | `02-automation-editor.gif` | Admin → Automations | Row 3-dot menu (Edit/Delete/Duplicate/Share) · "Using:" linked-automation pill · visual editor canvas · full Steps palette · Triggers palette (8 types) · right-config panels: Create Task, Time Delay, Tag-Added trigger, Send Email |
| 3 | `03-templates-email-text.gif` | Admin → Email & Text Templates | Email folder tree (4 folders) · template list (76) · Edit Email Template modal · Merge Fields picker (Contact/Company/Agent/Lender/Sender/Property/Last Viewed) · Text folder tree (3) · text template list (14) · Edit Text Template modal · text Merge Fields |
| 4 | `04-calendar-tasks.gif` | Calendar + Tasks | Day & Week views · Create Appointment modal · all-day toggle (time pickers hide) · appointment Type dropdown · Outcome dropdown · existing-appointment popover + Edit modal · Today's Tasks tab · Overdue (populated) · "Me ▾" agent scope · "Clear Overdue Tasks" confirm dialog (cancelled) |
| 5 | `05-inbox-comms.gif` | Inbox / comms | Drafts folder + compose pane (quick-replies, Send & schedule) · bell Notification Center · full Notification Settings matrix (5 channels × all events incl. task-due triggers) |
| 6 | `06-contact-detail.gif` | Person detail | Log Call form (notes + No Answer/Left Voicemail/Bad Number + phone selector) · Quick Follow-Up lightning-bolt selector (1 Day → 12 Month) · Create Task modal + Type dropdown (8 types) · email compose · Insert HTML modal |
| 7a | `07a-admin-phone-calling-stages-appointments.gif` | Admin config | Phone Number Management (ports, parking lot, company number) · Calling enablement · Stages list (16, w/ people counts + reorder) · Appointment Types (2) + Outcomes (3) settings |
| 7b | `07b-admin-emailauth-integrations-pixel-leadflow-settings.gif` | Admin config | Email Domain Authentication (ryan-realty.com, unclaimed) · Integrations catalog (Email Mktg / Integrations / IDX / Inbox Apps — scrolled) · **Pixel** config + Tracking code (`WT-QPDMEALA`) · Lead Flow editor (rules, distribution, lender, automation) · My Settings (profile, vCard, **signature editor**, MLS profile, notification prefs) |

## Coverage vs the checklist

- **Reporting** — skipped (already captured in a prior pass).
- **Automations / Templates** (25 core gaps) — the editor config panels + both Merge Field pickers + folder trees covered by 02 and 03. (Per-step panels not individually opened: Conditions, Reassign, Add/Remove Tags, Add Note, Change Stage, Run Automation, Pause — but the Steps palette lists them all, and Create Task + Time Delay + Send Email + trigger are shown as representative panels.)
- **Tasks & Calendar** (18 core gaps) — covered by 04 + the Create Task modal in 06.
- **Inbox / Notifications** — covered by 05.
- **Contact detail** — covered by 06. (Inline email compose has no Merge Fields dropdown — it uses Insert HTML; the Merge Fields picker is a template-editor feature, fully captured in 03.)
- **Admin (32 gaps)** — covered by 07a/07b.

## NOT captured — Group 8 (Mobile)

The 8th requested group is the **native iOS Follow Up Boss app** (the checklist items say "iPhone FUB app"). That cannot be driven through a browser, so it was not captured here. Options to close it: capture on-device manually, or mirror the iPhone to the Mac and capture via computer-use. The mobile spec chapters (`../23`–`../30-mobile-*.md`) already document the mobile architecture from prior work.

# End-to-End Workflows (acceptance scenarios)

> **Purpose.** The module specs (§05–§20) describe surfaces in isolation. This section describes the **cross-module flows** that must complete without manual glue — they are the real acceptance tests for the in-house CRM. Each step names the module section and the data it touches. If any of these breaks, the cutover isn't ready, no matter how good the individual screens look.

Legend: **[§N]** = the module that owns the step. ✅/🟡/🔴 in parentheses = current in-house status from §21.

---

## W1 — Seller lead → CMA → nurture (the money flow)

1. Seller landing-page form submits ("Seller LP — Home Value"). **[§16 lead intake / §02 routing]**
2. System **creates or matches** the Person (dedupe by email then phone). **[§04, §05]** (✅ portal-intake cron + dedupe)
3. A **LEAD ORIGIN** system card is written to the timeline — Source, Page (`/lp/seller-home-value`), Campaign slug + UTM, Wants, Tier ("hot"), Assigned. **[§07b]** (🟡 verify card parity)
4. Routing assigns the agent (default → Matt; or round-robin / source rule). **[§02, §14]** (✅)
5. Tags applied: `audience:seller` + auto-tags. **[§14]** (✅)
6. A **"hot seller LP — call within 5 min"** task is created. **[§09]** (✅)
7. The **seller-nurture automation** enrolls the contact. **[§12]** (✅ engine; 🟡 visual editor)
8. Agent opens the record, composes the CMA email — template + merge fields + business-card signature + PDF attachment. **[§07c]** (🟡 compose extras)
9. Every touch logs to the **unified timeline**; stage moves Lead → Active Client. **[§07b, §07a]** (✅)
10. Contact replies → the sequence **pauses (stop-on-reply)**; the reply lands in the Inbox. **[§08, §12]** (✅)

**Acceptance:** a seller LP submission with no human action produces the matched contact, the origin card, the assignment, the tags, the 5-min task, and the enrolled nurture — and the first agent reply pauses the drip.

## W2 — Buyer web lead → saved search → drip → appointment

1. Buyer inquiry creates/matches the contact; saved-search confirmation email (template) goes out. **[§05, §13]**
2. **Pixel** web-activity events appear as the buyer browses; a return visit auto-creates a follow-up task. **[§18, §09]** (✅ pixel; ✅ tasks)
3. "Buyer Long Term Nurture" automation runs; engagement (opens/clicks/visits) accrues. **[§12, §18]**
4. Agent converts the lead to an **appointment** (type + linked contact + agent); invite email/text sent. **[§09]** (🟡 calendar week/day + GCal write-sync)
5. Appointment outcome captured after the meeting; it surfaces on the timeline, the right rail, and the Appointments report. **[§09, §11]** (🔴 appointments report)

**Acceptance:** a buyer lead browses, gets auto-tasked on return, is nurtured, and books an appointment whose outcome flows to reporting.

## W3 — Inbound unknown call/text → contact

1. A call/text arrives from an **unmatched** number. **[§17 Twilio]** (✅ inbound)
2. It appears in the **Company inbox** as a raw thread keyed by the phone number (with voicemail audio + transcript for calls). **[§08]** (🟡 raw-unmatched thread surface + transcript)
3. The agent clicks **"Add person"** to quick-create a contact inline (First/Last + submit). **[§08]** (🔴 unknown-caller add-person flow)
4. The thread re-associates to the new contact; future messages route to the assigned agent. **[§08, §02]**

**Acceptance:** an inbound from an unknown number is visible, playable/readable, and one click converts it into a routable contact.

## W4 — Bulk neighborhood farm

1. Open a Neighborhood smart list (e.g. Pronghorn). **[§06a]** (🟡 collections)
2. Refine via the filter panel + column chooser; multi-select rows. **[§06b, §05]** (🟡 column chooser/group-by)
3. Apply a **bulk action**: Update Stage / Update Agent / Apply Action Plan / Add Tag / Export. **[§05]** (✅ bulk; mass actions bypass the automation engine by design — replicate that)
4. Measure outcomes in Reporting (Source, Speed-to-Lead, Contact Attempts). **[§11]** (🔴)

**Acceptance:** a farm list can be filtered, multi-selected, bulk-acted, and the campaign's effect is measurable.

## W5 — Deal progression

1. Create a deal in a pipeline (Buyers or Sellers). **[§10]** (✅ create)
2. **Drag** the card Start → Offer → Pending → Closed; `entered_stage_at` updates per move. **[§10]** (🔴 drag-restage)
3. Commission + close date live on the card and the Deal Detail modal (people/team/splits/files/custom fields). **[§10]** (🟡)
4. The **Deals report** aggregates GCI by stage and source, with `time_in_stage` / `time_to_close`. **[§11]** (🔴)

**Acceptance:** a deal moves through stages by drag, carries commission/dates/people, and rolls up into deal reporting. *(Executed transactions remain in Vault — CRM deals are the pre/active pipeline; reconcile, never duplicate the transaction file.)*

## W6 — Expired-listing campaign

1. The "All Expireds" smart list (144) is the working set. **[§06b]**
2. Enroll in "Ryan Realty — Expired Spring Strategy" automation → tasks + emails/texts. **[§12]**
3. Track enrolled / completed / engagement per automation. **[§11, §12]** (🟡 list-level stats)

**Acceptance:** a saved list drives a multi-touch automation with measurable enrollment + completion.

## W7 — Compliance stop (must never fail)

1. A contact is tagged `contact:do-not-text` / `compliance:hard-stop` (or is a TCPA litigator, on the block list, unsubscribed, or in quiet hours). **[§14, §17]**
2. **Every** send path — manual compose, bulk action, scheduled send, automation step — checks suppression + block list + compliance tags + quiet hours **before** sending. **[§17]** (✅ strongest area)
3. The send is **blocked**; the attempt is recorded; no message goes out.

**Acceptance:** a hard-stopped/suppressed contact cannot be messaged through any path, and the block is auditable. This is a legal requirement (TCPA $500–$1,500/violation), not a nicety.

## W8 — Lead routing & assignment

1. A lead enters via any source. **[§16]**
2. Routing resolves the agent per strategy: default-all-to-one, round-robin (Groups), first-to-claim (Ponds), or a per-source rule; a `?agent=<slug>` attribution cookie overrides. **[§02, §14]** (✅)
3. A `Pause Leads` agent is skipped. **[§15]** (✅)
4. The assigned agent gets a new-lead alert (SMS today; push is the gap). **[§20]** (🟡 push)

**Acceptance:** every entry path lands on the right agent per the configured strategy, respects pause-leads, and alerts the assignee.

## W9 — Smart-list cadence (the daily driver)

1. Pipeline cadence lists (Hot/Weekly, Warm/Bi-Weekly, Past Clients/Sphere: Quarterly) compute membership from the filter AST and exclude compliance tags as filter-1. **[§06b]**
2. The list shows an **"Update List"** button only on dynamic cadence lists, not static lists (a real FUB distinction to replicate). **[§06a]**
3. Working a contact (call/text/email) moves it out of the "needs contact" window; counts re-poll on a ~10-minute cycle. **[§05, §06b]**

**Acceptance:** an agent can work a cadence list top-to-bottom, and contacts leave the list as they're touched.

---

## Cross-flow invariants

- **One timeline write per event**, deduped — Inbox and Person detail are views over it (§04).
- **Suppression check precedes every send** (W7) — non-negotiable.
- **Assignment + tagging + origin card happen atomically on intake** (W1, W8).
- **Stage/tag changes can trigger automations** — but mass actions deliberately do NOT (W4).
- **Reporting reads the same timeline/task/appointment/deal data** the modules write — no separate analytics store (§11).

**Sources:** synthesized across all module sections; flows grounded in the LEAD ORIGIN / Seller Inquiry cards (§07b), the deals + reporting GIFs (§10/§11), the inbox unknown-caller GIF (§08), and the compliance/routing code audit (§21). Status flags from §21.

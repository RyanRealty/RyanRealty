# Phase 0 — Matt answers

**Captured 2026-08-04** directly from Matt. These are **input evidence** for the Admin
Product OS, not locks. BOOT copies them into `docs/plans/ADMIN_PRODUCT/decisions.md`;
after that, `decisions.md` is the only place a lock counts (see the pack's "One lock
location" rule).

Originally authored for the `crm-up-to-snuff` lanes. Answers below supersede the blank
version. Q6/Q7 remain deliberately unanswered — they are P3/P5 decisions in the OS and
must not be pre-locked before the processes are deepened.

**Status:** 1–5 answered. Q6 (process marks) gated on P3. Q7 (IA lock) gated on P5.

---

## 1. Notification that wakes me / what I do next

Three of four wake him. Supervision alerts ("something failed or is overdue") do **not**.

- **Seller / valuation request** — asks what their home is worth → kick off a CMA.
  This is the `LITMUS.md` path (≤3 taps / ≤30s broker-action).
- **Any new lead, any source** — buyer/seller/unknown → qualify and respond.
- **Reply on an existing thread** — someone he already knows texts or emails back →
  read context, reply. Speed over data.

Implication: the wake-up set is all **inbound and human**. Nothing about system health
wakes him, even though he wants the supervision *view* (see Q4).

## 2. Weekly vs never (Inbox / People / Deals / Tasks / Sequences)

**Weekly:**
- **Inbox / messages**
- **Sequences** — monitoring only (see below)
- **Prospecting — written in by Matt, not on the original list:**
  "seeing what listings expired and sending them audits, seeing any new fsbos and
  sending them cmas"

**NOT weekly:** People list · Deals · Tasks.

Sequences clarification: **"checking they ran / didn't break."** Monitoring, not
authoring. Implies a health view is primary and the sequence editor is rare-use.

Evidence backing the non-use (verified on disk 2026-08-04):
- People: 22,951 contacts across **21 surfaces** under `/admin/crm` — a dump, not a worklist.
- Deals: **~21 rows** across **6 surfaces**, split over two stores —
  `/admin/deals` (+`[key]`) reads `app/actions/deals` and imports `components/console/*`;
  `/admin/crm/deals` (+`[id]`, `/pipelines`) reads `lib/data/crm/getCrmDeal` +
  `getDealPipelines` + `lib/crm/deal-scope`; `/admin/crm/reporting/deals` is a third view.
  **Corrects FULL-AUDIT-2026-08-03 §0, which records the console as "gone (redirects only)."**
- Tasks: ~590 rows, one surface.
- Prospecting spans **5 destinations** for one job: `/admin/prospecting` (+`[kind]/[id]`),
  `/admin/expired-outreach`, `/admin/expireds`, `/admin/expired-listings` (+`[key]`),
  `/admin/fsbos`. Capability exists (`ExpiredAuditActions.client.tsx`,
  `FsboActions.client.tsx`, `ProspectSendDialog.client.tsx`) — the IA is the defect.
- Shipped mobile tab bar is Home · Inbox · People · Deals · Activity: **two of five tabs
  go to non-weekly surfaces, zero to prospecting.**

None of this is a verdict. KEEP/MERGE/KILL is P3, after the PDS work.

## 3. Phone must-haves beyond CMA kickoff

**All four.** Phone is a full product, not a thin surface:
- Reply to a text or email (with thread history above the composer)
- Pull up a person + their history
- Log a call or note after a showing
- Approve a draft before it sends

## 4. Broker scope

**Own book by default, full view for Matt as principal broker.** Paul and Rebecca see
only their assigned people; Matt sees everything. Matches OREA supervision duty without
daily noise. Note the RBAC audit found 6 classes of role dead-end — scope is a known
bug class (`assigned_broker` is scattered across people, conversation, tasks, deals,
alerts).

## 5. Alert SMS path

**Resolved on disk 2026-08-04 — no Matt input needed.** Twilio serverless, cut over
2026-07-27 (W5.5a). `app/api/cron/crm-alert-drain/route.ts` gates on
`CRM_SMS_ALERTS === 'twilio'` and posts to the Twilio Messages API with
`MessagingServiceSid`; registered in `vercel.json`. The mac-mini relay is only the
fallback when that flag is unset, and the mini is retired.

**One runtime check BOOT must perform:** confirm the production env var is literally
`twilio` (not empty). If unset, alerts silently fall through to a relay that no longer
exists.

## 6. Process marks (KEEP / MERGE / KILL / DEFER)

**Deliberately unanswered — this is P3.** Do not pre-lock. Verdicts get written after
each process has a complete PDS with evidence.

## 7. IA lock: **unlocked**

**Deliberately unanswered — this is P5**, and it may not be locked until the process
lock exists in `decisions.md`.

---

## Deepen-order decision (Matt, 2026-08-04)

Prospecting moves up to **right after `cma-deliver`**. Locked order for P1's queue:

`broker-alert → inbound-respond → cma-deliver → prospecting → suppression-guard → other daily → weekly/rare`

Rationale: prove the inbound notification path first (already timed in LITMUS), then
immediately deepen the outbound motion Matt actually runs weekly. `cma-deliver` feeds
prospecting — FSBOs get sent a CMA — so deepening it first gives prospecting its
dependency. Prospecting's 5-destination sprawl is the single biggest IA cut available.

## Memory root decision (Matt, 2026-08-04)

`docs/plans/ADMIN_PRODUCT/` — greenfield, separate from the superseded ADMIN_REBUILD
package. BOOT adds the `ADMIN_PRODUCT/` package row to `docs/DEVELOPMENT_PROCESS.md`
in the same commit that creates the directory (G44 requirement).

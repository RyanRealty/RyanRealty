# FUB message association (no drop-off) + global Activity tab — 2026-06-29

Two deliverables, both shipped + verified live in the admin CRM.

## 1. Every FUB message correctly associated with a lead (no drop-off) — PROVEN

**Audit result.** Every FUB record type was already associated to the right
`crm_people` lead by FUB person id (notes, emails, texts, calls, web events;
`crm_timeline.person_id` is NOT NULL, so nothing is orphaned in-table).

**Reconciliation** (`scripts/crm-fub-reconcile.mjs`, re-walks FUB notes + events
idempotently and classifies any skip):

```
notes:  22,287 in FUB · 22,230 associated · 57 orphaned (no lead)
events: 17,214 in FUB · 15,584 associated · 1,630 orphaned (no lead)
distinct orphan FUB persons: 28 · orphans that exist in CRM: 0
VERDICT: PASS — every still-orphaned record belongs to a FUB contact that no
longer exists; every existing lead has its complete activity.
```

So the only unassociated messages belong to **28 contacts that were deleted or
merged in FUB** — there is no lead to attach them to, which is correct. No
existing lead is missing activity. The re-run was idempotent (shared
`fub:note:${id}` / `fub:event:${id}` dedupe namespace across `fub-import` and
`dual-write` sources) — it added only 28 genuinely-new notes and created zero
duplicates.

**Classification gaps fixed** (`lib/data/crm/getContactActivityFeed.ts`): `email_in`
(2,060 rows) and `web_event` (14,839 rows) were missing from the kind classifier
and fell through to the catch-all `other` category, mis-rendering as "Email in" /
"Web event". They now classify as `email`/in and `web`. Added `lead_created` too.

### Known limitation — FUB redacts message BODIES at the API (needs one external step)

All 30,988 historical FUB **emails + texts are associated** (correct person,
timestamp, direction, subject metadata) but their **bodies are blank** — FUB's
API returns `[CONTENT HIDDEN]` / `* Body is hidden for privacy reasons *` unless
the integration is registered as a content-enabled "system". Verified live
2026-06-29 (account active, content still redacted). Notes (14,611) have full
bodies; only emails/texts are redacted.

- **Email content is largely recovered already** via the Gmail sync (`source='gmail'`,
  11,117 sent + 1,784 received, 2023→now) — those rows carry real bodies and show
  in the feed. The redacted FUB email/text rows now render a clear
  "Content not synced from Follow Up Boss" label instead of a blank.
- **To fill the remaining bodies (mainly ~2,170 historical texts):** email FUB
  support (apikey@followupboss.com) to register the integration `X-System`
  ("RyanRealtyPlatform") for content access, then re-run the idempotent
  `scripts/crm-import-fub-comms.mjs` — it overwrites the placeholders with real
  content in place. This is the one step that requires Matt + FUB support.

## 2. Global Activity tab (FUB Activity-tab parity) — SHIPPED

`/admin/crm/activity` — a CRM-wide, newest-first activity stream across all
contacts. **Independent include/exclude toggle chips** for each activity type —
**Emails · Texts · Calls · Notes · Website · New leads · Updates** — all on by
default, with Clear all / Select all (so you can show any combination, e.g.
emails + texts but not website). Each row links to the contact. Day-grouped, with
direction, broker, category, relative time, inline call recordings, and the
redacted-content label. Deep-linkable via `?types=email,sms,website`.

- **DAL:** `lib/data/crm/getGlobalActivityFeed.ts` (one indexed query over
  `crm_timeline` joined to contact names, cursor-paginated on `ts`).
- **New Lead is now a first-class timeline event** (`kind='lead_created'`):
  migration `20260629140000` widens the `crm_timeline_kind_check` constraint,
  adds a `(kind, ts DESC)` index, and installs an `AFTER INSERT` trigger on
  `crm_people` so **every future lead — any code path — auto-gets a new-lead
  event** (idempotent via `dedupe_key='lead:'||id`). Backfilled 18,207 existing
  contacts from `fub_created_at`/`created_at`.
- **UI:** `components/admin/crm/GlobalActivityFeed.client.tsx` (load-more via the
  `loadGlobalActivity` server action), page + nav entry under CRM.

**Verified live** (dev server, Matt's session): all 4 tabs render real data, the
redacted label shows on a contact with 17 redacted messages (`/admin/console/leads/13014`),
load-more pages 50→100, design-system styling. Per-contact feed updated to match.

## Files
- `lib/data/crm/getContactActivityFeed.ts` (classification + contentHidden)
- `lib/data/crm/getGlobalActivityFeed.ts` (new global DAL)
- `app/actions/crm-activity.ts` (load-more action)
- `components/admin/crm/GlobalActivityFeed.client.tsx` (new)
- `components/admin/crm/ContactActivityFeed.tsx` (redacted label + lead icon)
- `app/admin/(protected)/crm/activity/page.tsx` (new page)
- `app/components/admin/admin-nav.ts` (Activity nav item)
- `supabase/migrations/20260629140000_crm_timeline_lead_created_kind.sql`
- `scripts/crm-fub-reconcile.mjs` (reconciliation proof)

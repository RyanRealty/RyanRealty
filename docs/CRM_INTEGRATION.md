# CRM Integration — native lead flow

**Status 2026-08-18.** Authoritative spec for how leads enter the in-house
CRM (`public.crm_people`). Follow Up Boss is decommissioned (2026-06-24).
Do not POST to a third-party people or events API. Do not treat leftover
`FOLLOWUPBOSS_*` Vercel names as a live integration.

Load-bearing invariants are **locked by `ci:crm-lead-integrity` (G49)**.

## The rule that anchors everything: `sendEvent`, not a people POST

Every inbound lead (ads, organic, on-site form) MUST be created via
**`sendEvent()` in `lib/crm/send-event.ts`**, which calls
**`ensureNativeLead()`** (`lib/data/crm/ensureNativeLead.ts`).

Only that path:

- **dedupes** email-first, then phone (normalized keys on `crm_contact_points`),
- stamps **`source`** and default **`audience:*` / `source:*` tags**,
- returns the native **`crm_people.id`** so tagging, enrollment, and notes can run.

A direct insert into `crm_people` (or a leftover third-party `/people` POST)
skips dedup and enrollment. G49 fails a bare `/people` create outside the
documented Meta webhook fallback.

## Flow

```
ad / organic / form ──► sendEvent (lib/crm/send-event) ─┬─ ensureNativeLead
   type = Registration / *Inquiry                        ├─ dedup (email | phone)
   person carries email and/or phone                     ├─ crm_people row
   source + optional campaign / broker                   └─ returns personId
        │
   canonicallyTagLead + enrichNativeLead (tags, custom, origin note)
        │
   autoEnrollPerson (tag → sequence) + crm-auto-enroll sweep
        │
   crm-sequence-engine + crm-scheduled-sends ──► email / SMS / task
        │
   close / won ──► [BACKLOG] offline upload to Google / Meta
```

## Principles → status → enforcement

| # | Principle | Status | Enforcement |
|---|---|---|---|
| 1 | Inbound leads via **`sendEvent` → `ensureNativeLead`**, never a bare people POST | ✅ forms + Meta webhook (webhook keeps a last-resort `ensureNativeLead` if `sendEvent` cannot resolve an id) | **G49** |
| 2 | Event carries a **dedup identifier** (email and/or phone) | ✅ (`sendEvent` person always has email on public forms) | code review + DAL |
| 3 | **`source` stamped on every event** (attribution survives) | ✅ (`SendEventParams.source` required) | **G49 item 3** |
| 4 | Event **type** is a real capture type (Registration / Seller / Property / General Inquiry), not a silent no-op | ✅ | code review |
| 5 | SMS goes through the **approved sender + TCPA consent gate**, never a log-only third-party text endpoint | ✅ Twilio + `crm_suppressions` | **G49** + `ci:sms-consent` |

## What runs after capture

1. **`canonicallyTagLead`** (`lib/canonical-lead-tagger.ts`) — `audience:seller` / `audience:buyer`, `source:*`, broker, geo / referral tags.
2. **`autoEnrollPerson`** (`lib/crm/enroll.ts`) — first matching tag → sequence. Inline on LP / webhook hot paths; **`/api/cron/crm-auto-enroll`** (every 15 min) catches misses. Pre-2026-06-10 historical book is never mass-enrolled.
3. **`/api/cron/crm-sequence-engine`** — due steps on **active** sequences only (pause-on-reply lives here).
4. **`/api/cron/crm-scheduled-sends`** — delivers queued touches.
5. Hot Meta leads get **`createNativeTask`** (`dueInMinutes: 5`) on `crm_tasks`.

Sequences are edited at **`/admin/crm/sequences`**. Broker working surface is **`/admin/crm`**.

## Avoid

- **Never create a lead with a third-party People API.** Capture is native.
- **Never treat a third-party textMessages POST as a send.** Real SMS goes through Twilio + the consent gate (`ci:sms-consent`).
- **Never auto-text before a stored consent record.**
- **Do not re-enable Follow Up Boss.** `getFubApiKey()` is hardcoded `undefined`. Lead capture does not wait on that key.

## References

- Capture: `lib/crm/send-event.ts`, `lib/data/crm/ensureNativeLead.ts`
- Tag + enroll: `lib/canonical-lead-tagger.ts`, `lib/crm/enroll.ts`
- Meta Lead Ads: `app/api/meta/lead-webhook/route.ts`
- Public forms: `app/lp/*/actions.ts`, `app/contact/actions.ts`, `app/home-valuation/actions.ts`
- Gate: `scripts/check-crm-lead-integrity.mjs` (`ci:crm-lead-integrity`)
- Path-by-path marketing map: `docs/MARKETING_LEAD_FLOW.md`

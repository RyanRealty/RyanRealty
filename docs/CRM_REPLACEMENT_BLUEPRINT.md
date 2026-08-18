# CRM Replacement Blueprint — shipped

**Status:** COMPLETE. Follow Up Boss was decommissioned 2026-06-24. This file
used to be a go/no-go plan. Do not execute the old dual-write / FUB-API
phases. Do not call `api.followupboss.com`. Do not treat leftover
`FOLLOWUPBOSS_*` Vercel names as a live integration.

**Live CRM:** `public.crm_people` + `lib/crm/` + `/admin/crm`. Capture:
`sendEvent()` in `lib/crm/send-event.ts` → `ensureNativeLead()`.

Pre-cutover inventory and FUB-era runbooks live under
`docs/archive/fub-era/README.md`. Do not build against them.

---

## 1. What shipped

The in-house CRM is the system of record:

| Job | Live path |
|---|---|
| Contact database | `crm_people` (emails/phones/addresses jsonb, tags, custom jsonb, `fub_legacy_id` as a historical key only) |
| Timeline | `crm_timeline` |
| Sequences | `crm_sequences` + `crm_sequence_enrollments`; `/admin/crm/sequences`; crons `crm-auto-enroll`, `crm-sequence-engine`, `crm-scheduled-sends` |
| Suppressions | `crm_suppressions` — single send-time gate |
| Tasks | `crm_tasks` (`createNativeTask` for hot leads) |
| Email | Gmail sync (`crm-gmail-sync`) + Resend webhooks (`/api/webhooks/resend`) |
| SMS / voice | Twilio (`/api/twilio/*`) + A2P + consent |
| Admin / mobile | `/admin/crm` (PWA) |
| Meta audiences | `/api/cron/meta-audience-sync` → `syncCrmAudience()` over consent-gated `crm_people` |
| Lead capture | Every public form + Meta Lead Ads webhook → `sendEvent` |

`getFubApiKey()` in `lib/crm/fub-env.ts` is hardcoded `undefined`. Every
former third-party CRM HTTP path no-ops. Re-enabling that vendor is not a
config flip.

---

## 2. Capture contract (do not regress)

```
form / webhook / sign-in
        │
        ▼
 sendEvent (lib/crm/send-event.ts)
        │
        ▼
 ensureNativeLead — email-first, then phone, else skip (no orphan row)
        │
        ├─ canonicallyTagLead (audience:*, source:*, broker, geo)
        ├─ autoEnrollPerson (tag → sequence; pre-2026-06-10 book never mass-enrolled)
        └─ stitchVisitorIdentity (rr_vid → crm_people.id)
```

Gate: `ci:crm-lead-integrity` (G49). See `docs/CRM_INTEGRATION.md`.

---

## 3. What we deliberately did not rebuild

- Power dialer, ring groups, call recording
- A native appointments module (Google Calendar is the calendar)
- 250-source portal-email parsing (portal intake is `crm-portal-lead-intake` for the sources we actually have)
- Lender seats, marketplace apps, Zapier
- A third-party vendor forecast (Vault is the transaction system of record)
- A native App Store app (PWA + broker alerts cover a 3-person shop)

---

## 4. Cost / ops (current)

| Item | Notes |
|---|---|
| Former vendor CRM seats | Cancelled. Do not restore. |
| Twilio | Marketing line + per-broker numbers; A2P required for outbound SMS |
| Resend | Bulk / sequence mail on `mail.ryan-realty.com` |
| Supabase / Vercel | Existing project — no second CRM host |

---

## 5. If a doc still says “push to Follow Up Boss”

That doc is stale. Fix it to `sendEvent` → `crm_people`, or ignore it if it
lives under `docs/archive/fub-era/` or is a `docs/FUB_*.md` archive banner.

**Do not** dual-write, poll a People API, or add `FOLLOWUPBOSS_API_KEY` back
into a required-env list.

# Code truth vs product bar — 2026-08-23

Read from pickup worktree (contains `e24c3f0e4`) and the code-truth specialist. CMA branch was not mixed in.

## Labels

| Surface | Label | Notes |
|---|---|---|
| `lib/tc/` | EXISTS | Engine: anticipated-docs, banking days, commissions, signing tokens, OREF fill, SkySlope inbound/mirror, seal. |
| Anticipated-docs | EXISTS | `lib/tc/required-documents.ts`. Deal UI “Documents anticipated”. Does **not** seed checklist rows. Native deals often `role=unknown`. |
| New-deal checklist from OR library | MISSING | `createDealWithPeople` does not insert `tc_checklist_items`. `checklist_type` is a SkySlope string, unused as template. |
| `createEnvelopeFromTemplate` | THEATER | Defined in `app/actions/tc-envelopes.ts`. **Zero UI callers.** Deal “New envelope” uses `createEnvelopeFromDocuments` (uploaded PDFs). |
| `createDraftEnvelope` | THEATER | Recipients only; no docs/fields. Zero UI callers. |
| Envelope from uploaded PDFs | EXISTS | Deal envelopes + composer. |
| `/admin/forms` | EXISTS browse / THEATER use-on-deal | Left rail Closings → Forms. No add-to-envelope. |
| `/admin/sign-off` | EXISTS, off left rail | Live `in_review` queue + 7-banking-day OAR clock. “17 items” is a live count, not a hardcoded list. |
| `/admin/signing` | EXISTS, off left rail | Empty on 22 Aug walk. Parked in nav. |
| `/admin/closings` | EXISTS | `tc_deals` board. Active-listing **lens**, not Manage Listings. |
| Listing pipeline grid | MISSING | `/admin/listings` = MLS. Spec T3.2 unbuilt. |
| `tc_events` | EXISTS | Append-only. Writers: native TC + SkySlope migrate. **Not** mail/Twilio/CRM. |
| Email → Vault auto-file | MISSING | `portal_email` column / T3.3 unbuilt. CRM Gmail is person timeline. |
| Twilio → deal | MISSING | `crm_timeline` only. |
| FUB/CRM → deal log | MISSING | FUB dead. Person timeline ≠ deal log. |
| OR / OREF / ODS libraries | EXISTS codes + ingest | OR 1837, ODS 1528, OREF 1340. Blanks via ingest, not bundled PDFs. |
| `RECIPIENT_ROLES` in `signing.ts` | INVENTED vs live | Replace from `ROLE_LIST.md`. |
| `TC_CONTACT_ROLES` in `contact-roles.ts` | DIFFERENT LIST | Deal-side vendors (appraiser, TC, home warranty, attorney) — **not** the Forms file Role dropdown. Do not collapse the two. |
| SkySlope import → deal log | EXISTS as history | `cycle_imported_from_skyslope`. Native clicks also append. Mail/Twilio/FUB never do. |

## Handoff claims

Keep: anticipated-docs real; inbound mail auto-file not; Twilio auto-file not; new-deal checklist not library-driven; `createEnvelopeFromTemplate` no UI; sign-off live off rail.

Nuance: deal log is **not** “only SkySlope import” for native deals. For migrated files the log is mostly the import row plus later native clicks. Auto-file of mail/CRM/Twilio is still missing.

## Vault slices that do not need SkySlope

Now that the live role list is filed:

1. Align envelope recipient roles to the live Forms enum (or keep a mapping table) **or** ship `createEnvelopeFromTemplate` UI using current invented roles then remap — prefer mapping from `ROLE_LIST.md`.
2. Library-driven checklist seed on **new** deal (OR primary + deal type + property facts). Anticipated-docs is the predictor, not the seed.
3. Inbound mail → `tc_documents` / `tc_events` / matching checklist item.
4. Twilio (and CRM person timeline) → `tc_events` on the matching deal.
5. Put sign-off (and signing) on the left rail.
6. Listing pipeline (grid + expiration) is a later Vault slice; Closings already has an active-listing lens.

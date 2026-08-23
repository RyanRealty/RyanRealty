# Code truth vs product bar — 2026-08-23

Read from pickup worktree (contains `e24c3f0e4`) and the code-truth specialist. CMA branch was not mixed in.

## Labels

| Surface | Label | Notes |
|---|---|---|
| `lib/tc/` | EXISTS | Engine: anticipated-docs, banking days, commissions, signing tokens, OREF fill, SkySlope inbound/mirror, seal. |
| Anticipated-docs | EXISTS | Predictor on the deal page. In-house create also seeds checklist rows from the same matrix. |
| New-deal checklist from OR library | EXISTS (this branch) | `createDealWithPeople` seeds `tc_checklist_items` from `seedChecklistItems` (Oregon matrix × deal parties). MLS facts still light conditionals later via anticipated-docs. |
| `createEnvelopeFromTemplate` | EXISTS (this branch) | Deal New envelope → Form library picks production blanks (OR/OREF/ODS, samples omitted) and calls `createEnvelopeFromTemplate`. |
| `createDraftEnvelope` | THEATER | Recipients only; no docs/fields. Zero UI callers. |
| Envelope from uploaded PDFs | EXISTS | Deal envelopes + composer. |
| `/admin/forms` | EXISTS browse / THEATER use-on-deal | Left rail Closings → Forms. No add-to-envelope. |
| `/admin/sign-off` | EXISTS; on Closings rail **this branch** | Live queue + 7-banking-day clock. Superuser `transactions.signoff`. Production 23 Aug still footer-only until deploy. |
| `/admin/signing` | EXISTS; on Closings rail **this branch** | Brokers: `transactions.view`. `esign.send` stays parked. Empty on 22 Aug walk. |
| `/admin/closings` | EXISTS | `tc_deals` board. Active-listing **lens**, not Manage Listings. |
| Listing pipeline grid | MISSING | `/admin/listings` = MLS. Spec T3.2 unbuilt. |
| `tc_events` | EXISTS | Append-only. Writers: native TC + SkySlope migrate. **Not** mail/Twilio/CRM. |
| Email → Vault auto-file | MISSING | `portal_email` column / T3.3 unbuilt. CRM Gmail is person timeline. |
| Twilio → deal | MISSING | `crm_timeline` only. |
| FUB/CRM → deal log | MISSING | FUB dead. Person timeline ≠ deal log. |
| OR / OREF / ODS libraries | EXISTS codes + ingest | OR 1837, ODS 1528, OREF 1340. Blanks via ingest, not bundled PDFs. |
| `RECIPIENT_ROLES` in `signing.ts` | EXISTS (live Forms enum this branch) | Picker = Buyer / Seller / EscrowOfficer / TitleOfficer / LoanOfficer / BuyerAgent / SellerAgent / Broker / Other. Legacy codes normalize on read/write. `cc` = Receives a copy, not a Forms role. |
| `TC_CONTACT_ROLES` in `contact-roles.ts` | DIFFERENT LIST | Deal-side vendors (appraiser, TC, home warranty, attorney) — **not** the Forms file Role dropdown. Do not collapse the two. |
| SkySlope import → deal log | EXISTS as history | `cycle_imported_from_skyslope`. Native clicks also append. Mail/Twilio/FUB never do. |

## Handoff claims

Keep: anticipated-docs real; inbound mail auto-file not; Twilio auto-file not; new-deal checklist not library-driven; `createEnvelopeFromTemplate` no UI; sign-off live off rail.

Nuance: deal log is **not** “only SkySlope import” for native deals. For migrated files the log is mostly the import row plus later native clicks. Auto-file of mail/CRM/Twilio is still missing.

## Vault slices that do not need SkySlope

Now that the live role list is filed:

Shipped on this branch: live Forms recipient roles, Closings rail Signing/Sign-off, new-deal checklist seed, Form-library envelope compose.

Still missing:

1. Inbound mail → `tc_documents` / `tc_events` / matching checklist item.
2. Twilio (and CRM person timeline) → `tc_events` on the matching deal.
3. `action_required` column (Needs to sign / Receives a copy / No action) instead of storing copy-only as `cc`.
4. Listing pipeline (grid + expiration); Closings already has an active-listing lens.
5. Merge/deploy this branch so production rail and composer match.

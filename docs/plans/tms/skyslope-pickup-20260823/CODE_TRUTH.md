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
| `tc_events` | EXISTS | Append-only. Writers: native TC, SkySlope migrate, **this branch** Gmail `mail_filed` + Twilio `sms_filed`. |
| Email → Vault auto-file | EXISTS (this branch) | `lib/tc/file-comms.ts` + `file-comms-write.ts`. Gmail `syncMailboxWindow` after CRM person match. PDFs (cap 3) → `tc-documents` `inbox/` + matching checklist. Fail-open. Address-only fallback needs score ≥ 2 (SkySlope-migrated deals often lack `tc_deal_people`). |
| Twilio → deal | EXISTS (this branch) | Inbound SMS after `crm_timeline` upsert. Outbound 1:1 and group via `sendGovernedSms` / `sendGovernedGroupMms`. MMS PDFs fetched immediately via `fetchTwilioMedia` (URLs expire). Photos stay on the CRM thread. Sequence-engine drips are not filed. |
| FUB/CRM → deal log | PARTIAL (this branch) | FUB dead. CRM Gmail person timeline now also files onto the matching Vault deal. |
| OR / OREF / ODS libraries | EXISTS codes + ingest | OR 1837, ODS 1528, OREF 1340. Blanks via ingest, not bundled PDFs. |
| `RECIPIENT_ROLES` in `signing.ts` | EXISTS (live Forms enum this branch) | Picker = Buyer / Seller / EscrowOfficer / TitleOfficer / LoanOfficer / BuyerAgent / SellerAgent / Broker / Other. Legacy codes normalize on read/write. `cc` is no longer written. |
| `action_required` on `tc_envelope_recipients` | EXISTS (this branch) | NeedsToSign / ReceivesACopy / NoAction. Composer has a separate Action required picker. Send/seal ignore NoAction; copy-only is not a signer. |
| `TC_CONTACT_ROLES` in `contact-roles.ts` | DIFFERENT LIST | Deal-side vendors (appraiser, TC, home warranty, attorney) — **not** the Forms file Role dropdown. Do not collapse the two. |
| SkySlope import → deal log | EXISTS as history | `cycle_imported_from_skyslope`. Native clicks also append. This branch also files Gmail/Twilio. FUB never does. |

## Handoff claims

Keep: anticipated-docs real. Superseded on this branch: inbound mail auto-file; Twilio auto-file; new-deal checklist seed; `createEnvelopeFromTemplate` UI; sign-off/signing on Closings rail; `action_required` column.

Nuance: deal log is **not** “only SkySlope import” for native deals. Migrated files still start with the import row. Auto-file of mail/Twilio is live on this branch (fail-open). `action_required` is a column; `cc` is only a read of old rows.

## Vault slices that do not need SkySlope

Now that the live role list is filed:

Shipped on this branch: live Forms recipient roles, Closings rail Signing/Sign-off, new-deal checklist seed, Form-library envelope compose, Gmail/Twilio auto-file onto deal log + matching checklist, `action_required` column + composer picker, Twilio MMS PDF fetch.

Still missing:

1. Listing pipeline (grid + expiration); Closings already has an active-listing lens.
2. Merge/deploy this branch so production rail, composer, seed, auto-file, and action_required match.

# Prepare + send vs Suite twice (2026-08-21)

Product bar: Suite + Forms merge into one Vault. Brokers prepare a form and send it. Matt verifies. Library (OR primary) drives the checklist.

## Prepare + send (Forms half = 1–4; send = 5 / DigiSign)

1. Create a Forms file by representation (Write Offer / Write Listing / Start Buyer Agreement).
2. Add forms from libraries (OR/OREF/ODS) and/or Template + Clauses.
3. Fill (auto-merge transaction data).
4. Field placement editor (form-version DETAIL already has fields; DigiSign still places sigs at envelope time).
5. Build envelope / DigiSign — Sign Review / Transaction owns this.

Brokers never hand-build forms. createEnvelopeFromTemplate = copy blanks + field_map, draft for broker review+send.

## Suite twice (documented only)

- Deal create vs Forms file (Linked to Forms badge).
- Same Write an Offer / Write a Listing in both Suite home and Forms.
- Property/deal facts entered on Suite, auto-merged into Forms.
- Checklist attach vs Browse Libraries Add + fill (packet encoded twice: Checklist Type vs Templates).
- Buyer agreement in Suite checklist group AND Forms Start Buyer Agreement.
- Suite Documents / Docs to Review vs Forms file Forms+Envelopes counts.
- Checklist Type "Residential — Standard" vs ODS/OREF/OR libraries.

Contacts: Suite has Contacts tab; Forms uses dataRefs. No second Forms Contacts editor in files.

## Library drives checklist — today it does not

Required-docs is role × property facts → OREF numbers, not tc_form_libraries.
Deal page: Documents anticipated (predictor) + separate Checklist (cycle items).
T2.3 still seeds from Suite Appendix A, not OR library.

## UI coverage

/admin/forms: have browse+freshness+open blank; missing create file, add-to-deal, templates, clauses, fill, editor, send.
OREF packet: fill one 001, email Matt, seal. Not client send. Not OR-primary packet.
Deal envelopes: uploaded PDFs only. createEnvelopeFromTemplate has no UI caller.

# 2026-10-14 (Cursor, person profile name edit)

Surface: Cursor cloud. Branch: `cursor/people-name-edit-8010`.
Time: 2026-10-14T21:20Z.

Done: inline first/last name + lead type (buyer/seller/other) on `/admin/people/:id` v2 and lead-page-v3. Server action `updatePersonIdentityAction` writes name, `custom.lead_type`, audience tags, and a timeline audit note. Tests + `ci:person-identity-edit`.

Next: merge-gate, production READY, screenshot `https://ryan-realty.com/admin/people/64825?v=3`, confirm 64825 is Elize Marais / buyer / Tetherow.

Skills read: crm-up-to-snuff, admin-product-os, tdd.

Node: none (CRM person profile identity edit, not a public site queue node)

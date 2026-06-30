# Product Overview & Personas

> **Purpose.** Orient the reader before the module specs: what Follow Up Boss is, what job it does, the shape of the Ryan Realty account, who uses it and how, and the permission model that gates everything. Details live in the module sections; this is the map.

---

## 1. What Follow Up Boss is

Follow Up Boss (FUB) is a real-estate **team CRM**. Its single job: make sure no lead is ever dropped. It does that by:

1. **Capturing every lead** from every source (landing-page forms, portals like Zillow/Realtor.com, the `@followupboss.me` lead email, Gmail lead-processing, inbound calls/texts, manual entry, API) into one contact database.
2. **Unifying every conversation** — email, text, call, voicemail, web activity, notes — onto **one chronological timeline per contact** (the spine of the whole product; see §04 and §07b).
3. **Driving structured follow-up** through tasks and automated sequences (Action Plans / Automations; §09, §12).
4. **Tracking deals** through buyer and seller pipelines (§10).
5. **Reporting** on agent activity, lead-source ROI, speed-to-lead, and pipeline performance (§11).

Everything else (smart lists, templates, tags, custom fields, ponds, routing) exists to serve those five jobs.

## 2. The Ryan Realty account at a glance (observed 2026-06-30)

| Dimension | Value |
|---|---|
| Contacts | ~18,235 across 16 lifecycle stages |
| Team | 3 members — Matt Ryan (Owner), Rebecca Peterson (Admin), Paul Stevenson (Agent) |
| Smart lists | 148, organized into collections (Pipeline, Neighborhoods, Smart Loop) |
| Tags | 1,486 (prefix-namespaced: `area:`, `audience:`, `auto:`, compliance, price tiers) |
| Custom fields | 64 (demographic/enrichment/property/financing) |
| Automations | 38 (folder-organized; `[DRAFT - DO NOT ENABLE]` safety naming) |
| Pipelines | 2 — Buyers and Sellers; ~$5.8M closed GCI tracked |
| Inbound load | 559 inbox items · 326 unread · 248 overdue tasks at capture |
| Subdomain | `ryan-realty.followupboss.com` |

This is a **high-volume, single-office, three-broker** account. The build must virtualize/paginate every list, cache smart-list counts, and index the communication-derived fields heavily.

## 3. Personas

**Owner / Principal Broker (Matt).** Sees everything — all contacts, all deals, all reporting, all admin. Configures stages, tags, custom fields, automations, routing, company settings. Cannot be deleted. In the in-house CRM this is the `superuser` role.

**Admin (Rebecca).** Near-owner permissions: manage contacts, deals, templates, most admin. Cannot delete the owner. In the in-house CRM, folds into the broker role with elevated scope.

**Agent (Paul).** Works assigned leads, own pipeline, own tasks; restricted admin. Sees "My Leads" by default. In the in-house CRM this is a scoped `broker`.

**Lender (role exists in FUB, not used here).** Read-mostly collaborator on financing; can be a Send-Email step recipient and an automation "reassign to lender" target. Document for completeness (§15).

The product is **client-centric, not agent-centric**: the contact (lead) is the protagonist; the agent acts on the contact. Every surface is a view over the contact and its timeline.

## 4. Permission model (summary — full matrix in §15)

FUB gates by tier **Owner > Admin > Agent (> Lender)**. The gates:

- **Record visibility** — own vs. all records (the "Me" vs "Everyone" filter on lists; agents are scoped to assigned + collaborated contacts).
- **Export rights** — a per-user `Can Export` flag.
- **Lead assignment** — a per-user `Pause Leads` flag excludes an agent from routing.
- **Admin access** — configuration surfaces are owner/admin only.
- **Delete rights** — the Owner is undeletable; delete is gated by tier.
- **Notification scope** — `Notify about all new inquiries` per user.
- **Smart-list visibility** — private / shared-with-everyone / shared-with-selected (independent of role).
- **Collaborators** — grant a specific user visibility into a specific contact across the own/all boundary.

In-house mapping: roles live in `admin_roles` (`role`, `broker_id`, `can_export`, `pause_leads`); scope is enforced at the data layer (scoped queries / RBAC), not just the UI. See §21 for what's built.

## 5. The non-negotiables (carried into every module)

These three constraints outrank UI fidelity and must hold everywhere:

1. **The unified timeline is the spine.** Every channel event and system event writes one timeline row with a dedupe key. The Inbox and Person detail are views over it. Build it first (§04).
2. **Compliance gates every send.** Before any email/text/call (manual, bulk, scheduled, or automated) the system checks the suppression list, block list, and compliance tags (`do-not-text`, `do-not-call`, `hard-stop`). A2P/10DLC registration gates SMS; domain auth gates email. TCPA litigators + DNC are hard stops. See §17. (This is the in-house system's strongest existing area — keep it that way.)
3. **Config is data, not code.** Stages, tags, custom fields, task types, appointment types/outcomes, pipelines/stages, automations, templates are all data-driven and admin-editable. No enums hard-coded for these.

## 6. Styling note

This spec describes FUB's **structure and behavior**. The in-house build is an internal admin tool styled with the **Ryan Realty design system** — navy `#102742` on cream `#faf8f4`, Geist (body) + Amboqia (display), shadcn/ui components from `@/components/ui/`. **Do not copy FUB's blue/teal.** The §0.5 brand-voice client-copy gate does not apply to admin UI; the design-token rule does. The FUB→Ryan-Realty token mapping is in §03.

---

**Sources:** synthesized from all module sections; account figures from screens 32–79 and the smart-list/admin screens; permission model from §15 (team/roles) + the official docs research (`account-team-billing.md`); in-house mapping from the code audit (§21).

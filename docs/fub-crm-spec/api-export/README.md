# FUB API Export — authoritative config & schema (2026-06-30)

> **What this is.** A direct export from the live Follow Up Boss REST API (`api.followupboss.com/v1`, Basic auth with the Ryan Realty system key), captured before the account is decommissioned. **This is the single most authoritative source in the spec for the data model and configuration** — exact field names, types, IDs, enum values, and the real Ryan Realty config. Where a screenshot and this export disagree, **this export wins** (it's the system's own data). Seed the in-house schema + config tables directly from these JSON files.

## Files

| File | Contents | Count |
|---|---|---|
| `stages.json` | All lifecycle stages — `id, name, orderWeight, isProtected, pipelineId, description, peopleCount` | 16 |
| `customFields.json` | **All custom field definitions** — `id, name (API key), label, type (text/number/date), orderWeight, hideIfEmpty, readOnly` | 64 |
| `pipelines.json` | Deal pipelines + their ordered stages | 2 |
| `users.json` | Team members — `id, name, email, role, …` | 3 |
| `actionPlans.json` | Action plans — `id, name, status, stopOnContacted, isDefaultBuyerPlan/SellerPlan, delaySmsMinutes, stepCount, leadFlowIds, categories, contactsRunningCount, …` (step bodies require `/v1/actionPlans/{id}`) | 76 |
| `smartLists.json` | Built-in **default** smart lists (see note below) | 12 |
| `ponds.json`, `groups.json`, `teams.json` | Routing pools / groups | 1 / 2 / 0 |
| `appointmentTypes.json`, `appointmentOutcomes.json` | Appointment config | 2 / 3 |
| `webhooks.json` | Registered webhooks (none) | 0 |
| `_sample_deals.json` | **Deal schema** — `pipelineId, stageId, enteredStageAt, price, commissionValue, agentCommission, teamCommission, timeToClose, earnestMoneyDueDate, mutualAcceptanceDate, dueDiligenceDate, finalWalkThroughDate, possessionDate, customListPrice, people[], users[]` | 20 total |
| `_sample_events.json` | **Timeline event schema** — `occurred, personId, message, type, pageTitle, pageUrl, pageDuration, property, propertySearch` (types incl. Viewed Page, Viewed Property) | 17,214 total |
| `_sample_appointments.json`, `_sample_calls.json`, `_sample_identity.json` | Appointment / call schema + account identity | 7 / 110 |

## What this confirms in the spec

- **Pipelines + stages exact:** Buyers = Start (temp) → Buyer Contract → Offer → Pending → Closed → Lost. Sellers = Start (temp) → Pre-Listing → Listed → Offer → Pending → Closed → Lost / Terminated. (Spec §10 was correct.)
- **16 stages** with the exact people counts (Seller Prospect 7,523; Lead 8,243 protected; …) — §14 was correct.
- **64 custom fields** — §14 / §04 were correct; the JSON gives the exact API keys (`customRecentlyDivorced`, `customNetWorthRange`, `customIncludeInFBCAS`, `customSellerScoreBand`, …) and types to build the field registry from.

## Corrections this export forces (apply to the prose spec)

1. **Roles** — `users.json` shows `role` = **Broker** (Matt), **Broker** (Rebecca), **Agent** (Paul). The spec §01/§15 inferred "Owner / Admin / Agent." The real FUB role values are **Broker / Broker / Agent** (Matt is the account owner; "Owner/Admin" was an inference). Build the role enum from the actual values.
2. **Smart lists — two distinct concepts.** `/v1/smartLists` returns **12 built-in DEFAULT smart lists** (Stay In Touch, Email Activity, IDX Activity, Sphere, Past Clients, Closed, Pending, Sellers, Buyers, Nurture, Hot Prospects, Leads). The **148 "custom lists"** shown in the UI (§06a) are a SEPARATE, user-created concept not returned by this endpoint. The data model needs **both**: system default smart lists + user custom lists/collections.

## Endpoints that were blocked (capture by other means)

- `people`, `tasks`, `notes` → **403** (this API key's scope). Person/task/note field schemas come from the screenshots (§07, §09) + `customFields.json`.
- `emailTemplates`, `textTemplates` → **404** (not exposed on v1). Template schema comes from §13 (screenshots).
- `textMessages` → 400 (requires `personId`; known — see memory `reference_fub_texting_phone_sent`).

## How to use

Treat these JSON files as the **seed data + schema contract** for the in-house build: import stages → `crm_stages`, custom fields → `crm_field_definitions`, pipelines/stages → `crm_deals`/pipeline config, action plans → `crm_sequences`, users → `admin_roles`/`brokers`. Re-pull is impossible once the account is gone — this is the permanent record.

*Exported 2026-06-30 via `scratchpad`-side script against the live FUB API. Read-only GETs.*

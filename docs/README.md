# docs/ — Active References

Last curated: 2026-04-21 (governance purge ch.3). Obsolete/snapshot docs moved to `docs/archive/`.

**Where things live.** This folder contains topic-specific reference docs. For authoritative architecture + status, look here first:

| I need... | Read |
|---|---|
| The canonical rules agents must follow | `.cursor/rules/*.mdc` (machine-enforceable) |
| Current task status / next open work | `docs/plans/task-registry.json` + `npx tsx scripts/orchestrate.ts next` |
| Workstream scope + file ownership | `docs/plans/master-plan.md` |
| Data architecture reference (URLs, stats, hierarchy, caching) | `docs/plans/data-architecture-plan.md` (body only — ignore any status stamps) |
| What the site does today (feature inventory) | `docs/FEATURES.md` |
| How the Supabase schema works | `docs/DATABASE_FOR_AI_AGENTS.md` |
| Work standards + design system + skill routing | `/CLAUDE.md` (root) |
| Cross-tool handoff state (Cursor ↔ Claude Code) | `docs/plans/CROSS_AGENT_HANDOFF.md` |

## Active docs by topic

### Product + features
- `FEATURES.md` — current feature inventory (what exists today)
- `ADVANCED_SEARCH.md` — advanced search RPC + filter map
- `MARKET_REPORTS_AND_SHARING.md` — reports + share button behavior
- `REPORTS_CHECKLIST.md` — report inventory and status
- `COPY_FROM_CURRENT_SITE.md` — broker copy + about-page content reference

### Data + schema
- `DATABASE_FOR_AI_AGENTS.md` — Supabase schema + query patterns (canonical reference for agents)
- `SWITCH_TO_NEW_SUPABASE_DATABASE.md` — runbook for switching Supabase projects

### Sync (Spark → Supabase)
- `SYNC.md` — sync manual (delta, full, operational overrides)
- `SYNC_HANDOFF_PLAYBOOK.md` — CLI commands + finalization definitions + PostgREST gotchas
- `SYNC_DELTA_STATUS.md` — delta sync monitoring detail
- `SPARK_API_REFERENCE.md` — full Spark API developer reference
- `SPARK_FIELDS_AUDIT.md` — Spark field → Supabase column mapping

### SEO
- `SEO.md` — SEO implementation overview
- `SEO_AUTHORING_CHECKLIST.md` — per-page metadata contract
- `ENTITY_OPTIMIZATION.md` — schema.org / JSON-LD entity reference
- Authoritative URL spec: `.cursor/rules/seo-url-guardrails.mdc`

### Reporting + analytics
- `REPORTING_AND_ANALYTICS.md` — reporting architecture (cache tables, RPCs)
- `TRACKING_AND_ANALYTICS_AUDIT.md` — what fires, what doesn't
- `GA4_SERVICE_ACCOUNT_SETUP.md` — GA4 Data API service account setup
- `GTM_GA4_SETUP.md` — GTM/GA4 env-only setup
- `GTM_TRIGGERS.md` — dataLayer event / trigger reference

### Integrations
- `FOLLOWUPBOSS-SETUP.md` — FUB CRM integration
- `FUB_CUSTOM_FIELDS.md` — FUB custom field configuration
- `GOOGLE_MAPS_SETUP.md` — Google Maps API setup
- `GOOGLE_ADS_SETUP.md` — Google Ads / conversion setup
- `GOOGLE_APIS_WHERE_TO_GET.md` — where to find Google IDs (GA4, GTM, OAuth)
- `GOOGLE_VERIFICATION.md` — Google IDs verification checklist

### Auth + admin
- `AUTH_AND_CRM.md` — Supabase Auth + CRM webhook pattern
- `ADMIN_DASHBOARD.md` — admin UI features
- `ADMIN_FIRST_LOGIN.md` — admin role setup

### Media
- `VIDEO_DATA_FLOW.md` — Spark → details.Videos → listing page pipeline
- `VIDEO_TROUBLESHOOTING.md` — video debug guide

### Deployment
- `VERCEL_DEPLOY.md` — Vercel deploy steps + env checklist
- `DOMAIN_SETUP.md` — custom domain setup

### Content engine
- `CONTENT_ENGINE_TRIGGER_MAP.md` — MLS event → content type → platform map

### Transaction coordination (SkySlope / Oregon)
- `skyslope-forms-principal-brief.docx` — regulatory principal broker brief
- `skyslope-forms-transaction-workbook.xlsx` — transaction workbook
- `skyslope-pdf-ai-research.md` — PDF processing research
- `prompts/skyslope-forms-pdf-and-brief-comprehensive-handoff.md` — active agent handoff prompt
- `transaction-coordinator/SkySlope_Oregon_Compliance_Guide.docx` — Oregon compliance guide

## Archive

Historical snapshots and superseded docs live in `docs/archive/`:

- `_audit-2025-03-12/` — March 2025 codebase + performance audits
- `_audit-2026-04/` — April 2026 audits (consolidated, sync, UI goals, lead capture)
- `_briefs-completed/` — completed fix briefs (ClosePrice, sync data completeness)
- `_plans-completed/` — completed phase briefs + superseded roadmaps (Phase 0, Launch checklist, Spark replication roadmap + spec)
- `_stale-refs/` — docs that drifted from code reality (URL_ARCHITECTURE, NEXT_SESSION_BRIEF, DOCUMENTATION_INDEX, SUPABASE_AUTH_URLS, WHAT_I_NEED_TO_COMPLETE, SUPABASE_SCHEMA, older Spark field maps, etc.)
- `_generated-artifacts/` — machine-generated inventory reports (SkySlope folder audits, Gmail deep dive)

Archive is read-only historical context. Never cite an archived doc as current state — always verify against code + live rules.

## Contributing

- Before adding a new doc here, ask: does this belong in `.cursor/rules/` as an enforceable rule, or in `docs/plans/` as a tracked plan? Prefer those over loose reference docs.
- If you need to merge two overlapping docs, do it in one commit (merge + delete the donor) so history stays clean.
- Every doc should state when it was last content-verified against code.

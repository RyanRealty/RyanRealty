> **This brief is a historical work artifact.** It describes what was specified for this phase; it does not track live status. Authoritative status is in `docs/plans/task-registry.json`. Do not update this file to reflect later code changes — create a new brief or update the registry.

# Phase 5: Future Differentiators

**Status**: Complete
**Prerequisite for**: Phase 6 backlog and long term differentiation
**Estimated scope**: 4 tasks, product moat features and monetizable tooling

This brief executes Phase 5 from `docs/plans/master-plan.md`.

---

## Task 5.1: PDF and Excel export for market reports
- Build `app/api/reports/export/route.ts` for downloadable market report exports.
- Include branded header, core stats, charts, and narrative.

## Task 5.2: Semantic search with pgvector
- Add pgvector migration and embedding-backed semantic listing search action.
- Support natural-language listing intent queries.

## Task 5.3: Vacation rental potential
- Surface STR suitability and estimated rental income where applicable.
- Integrate external STR estimate source (provider TBD in implementation).

## Task 5.4: Revenue-generating tools
- Build comparison tool, appreciation calculator, activity feed page, and vendor marketplace page.
- Ensure ad units and lead capture CTAs are integrated where relevant.

---

## Completion checklist

- [x] Task 5.1 complete
- [x] Task 5.2 complete
- [x] Task 5.3 complete
- [x] Task 5.4 complete
- [x] `npm run build` passes with zero errors
- [x] SEO phase gate from master plan checklist passes for scope

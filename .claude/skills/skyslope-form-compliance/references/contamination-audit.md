# Cross-folder contamination audit

**Question this answers:** does any closed folder hold documents that belong to a *different* property/deal, and are the source deals missing their own copies? (Run periodically, or after a batch of closings.)

Real finding (2026-06): **4 of 21** closed folders held foreign files — Kwinnum (24 docs from 3 other deals), 703 SW 7th (13 from a canceled 122 SW 10th deal), Huntington (6 from a failed 712 SW 1st offer), Old Bend (1 SPD from 3480 SW 45th). All remediated.

## The process (4 stages)

1. **Coverage** — `scripts/audit-coverage.mjs` lists which closed folders already have a per-doc `plan.json` (from a prior form-compliance pass). Folders without one need a dedicated scan.
2. **Detect** — two evidence sources, both verified against the actual PDF:
   - Folders WITH a `plan.json`: `scripts/audit-contamination.mjs` extracts every doc the classifier flagged wrong-property + builds a sale#→folder map to catch foreign docs by their internal sale#.
   - Folders WITHOUT one: spawn the [`subagent-prompts/contamination-scan.md`](../subagent-prompts/contamination-scan.md) subagent (fast — page-1 property check only) per folder; it writes `contamination.json`.
   - **Always re-read the actual PDF before trusting a "foreign" verdict** — a subagent once mislabeled a folder's OWN doc (Huntington's woodstove, Sale# Sciaraffo112724) as a 712 SW 1st doc. Grep the doc for its real address: `node scripts/pdf-text.mjs <file> | grep -iE "<addr tokens>"`.
3. **Cross-reference sources** — `scripts/audit-verify-and-sources.mjs` checks (a) the foreign docs' live state in each contaminated folder (archived? still assigned to an activity?) and (b) whether each source deal is in our inventory and still holds its own copy (so nothing is *missing*). A source deal not in the inventory pull → note it; a fuller `enumerate-sales` pull may be needed to find its folder.
4. **Remediate** — for foreign docs: rename `ARCHIVE - <name> - wrong-property <source>` + UNASSIGN from every activity. A prior pass sometimes renamed but did NOT unassign — check the live assignment count and finish the unassign. Listing-folder foreign docs (sale endpoint 422s "Unable to find") need the listing endpoint or stay as harmless unassigned strays. `scripts/fix-audit-gaps.mjs` is the worked example.

## Caveats
- The `audit-*.mjs` scripts carry a hardcoded list of the closed-deal GUIDs (the inventory at audit time). **Refresh that list** from a live sales pull (`GET /api/files/sales?earliestDate=…`) before re-running — closings since then won't be covered otherwise.
- A "wrong-cycle" doc (a prior offer round on the SAME property) is NATIVE, not foreign. Only a different street address is contamination.
- Output report: see `docs/SKYSLOPE_CONTAMINATION_AUDIT_2026-06-02.md` for the deliverable format.

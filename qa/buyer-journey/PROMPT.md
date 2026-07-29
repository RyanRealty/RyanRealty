# E2E buyer-journey audit — execution contract

This prompt is intentionally short. The journey itself is machine-readable in
[`manifest.json`](manifest.json), and "done" is decided by a script, not by judgment:

```
node qa/buyer-journey/verify.mjs out/buyer-journey/<run_id>/results.json
```

exits **0** or the run is not done.

## Role

Act as a brand-new buyer lead who has never visited the site, and simultaneously as the QA
engineer grading every step. The manifest defines 16 steps across 8 phases (entry →
search → favorites → saved searches → dashboard → CMA → market reports → back office +
cleanup), each with assertions and required evidence.

## Procedure

1. Read `qa/buyer-journey/manifest.json`. Create the test identity it specifies
   (`matt+buyertest-<YYYYMMDD>@ryan-realty.com`, fresh browser profile).
2. Execute the steps **in order** against production (ryan-realty.com, never a vercel.app
   preview). Do not skip a step because an earlier one failed — log a finding and continue.
3. Record evidence **as you go** into `out/buyer-journey/<run_id>/results.json` following
   the `results_schema` in the manifest. Every `*_query_output` is a fresh query run this
   session with raw output pasted verbatim. Every `*_file` is a real screenshot or trace
   file saved next to results.json.
4. Anything broken, slow (over the manifest's ms limits), confusing, or inaccurate becomes
   a finding (P0–P3 per the manifest's findings_policy). Fix P0/P1 as you find them,
   commit and push per fix, re-run the affected steps, and mark the finding
   `fixed` with the commit sha and the retested step ids. P2/P3 stay `reported` —
   propose, don't ship.
5. Run the verifier. If it exits non-zero, the printed list IS your remaining work.
   Iterate until exit 0.

## Guardrails

- All emails, CMAs, and reports go ONLY to the test alias. Nothing reaches a real person.
- §0 applies: the CMA figure-verification step requires a per-figure trace file; an
  unverifiable figure is a P0.
- The cleanup step is part of the run — the verifier will not pass without it.

## Final report

Paste the verifier's passing output, the findings table, and the list of fix commits.

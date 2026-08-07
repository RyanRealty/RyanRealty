# Resume prompt — Admin Product OS, Phase 11C

**Last session ended:** 2026-08-07, `main` @ `75fcab08`, pushed, nothing stranded.
**Model:** any current Claude. Fable 5 (`/model claude-fable-5`) if you want the
de-prescribed long-horizon posture; Opus 5 is fine and was what ran 11B/11C.

Paste everything between the fences into a fresh session.

---

```
Continue the Admin Product OS at Phase 11C. Read the disk state first and print
what you found before doing any work.

STATE (verify it, don't trust this block)
  docs/plans/ADMIN_PRODUCT/{state.json, work-queue.json, progress.txt, decisions.md}
  Plan of record: docs/plans/ADMIN_PRODUCT/PHASE-11-PLAN.md
  main @ 75fcab08. All four locks granted (process, IA, visual, litmus re-timed
  2026-08-07: 4.4s broker-action, one tap, idempotency proven).

WHAT PHASE 11 IS
  P1–P10 shipped the spine: 11 locked destinations, the v2 primitives, the §5
  chrome. Phase 11 makes that spine the ONLY admin. The interior migration is
  mechanical and one-way, enforced by ci:admin-ui (G65).

WHERE THE RATCHET STANDS (shrink-only; re-seed with --write-baseline and commit
the smaller baseline whenever counts drop)
  legacy pages    86   (started 131)
  raw elements   207   (started 251)
  distinct widths 19   (started 21)

REMAINING FAMILIES (from scripts/admin-ui-baseline.json — recount, don't assume)
  reports 8 · newsletters 6 · crm/import 5 · media 4 · bpo/brokers/cmas/
  crm-deals/geo 3 each · crm-sequences/email/help/listings/people/signing/sync/
  visitors 2 each · ~25 singletons

YOUR NEXT UNIT
  Continue 11C: migrate the remaining families to v2, largest-first unless the
  weekly-use evidence in decisions.md says otherwise. One family per commit.

HOW THE LAST THREE WAVES WERE RUN (this pattern works — reuse it)
  Fan out one builder per group of 4–6 pages, then pipe EACH group into a
  fresh-context verifier. The verifier's job is to refute, and its FIRST check
  is not "does it look right" — it is:
    - `git diff HEAD -- <page>` proving no server action, auth guard/capability
      check, query param, form field name, or href changed;
    - for any page showing data: no metric, date window, filter default, sort
      order, or unit moved. These pages inform a licensed broker's decisions.
  That pattern has caught, across three waves: a dropped-guard class (none
  found — good), two orphaned components, a duplicate <main> landmark spreading
  with every migration, and two §0 narrative defects that would have changed a
  decision (below).

NON-NEGOTIABLE RULES FOR EVERY MIGRATED PAGE
  - Migrated == imports '@/components/admin/v2'. v2 primitives + av2-* classes
    + var(--a-*) only. No components/ui/*, no raw <h1>/<h2>/<button>/<input>/
    <select>/<table>, no hex, no Tailwind palette, no new max-w-* token.
  - NEVER render your own <main>. ConsoleShell owns the landmark; av2-scope is
    a styling wrapper. (30 files were de-nested for this — don't reintroduce it.)
  - Exactly ONE primary-variant <Button> per page. Primary is the DEFAULT
    variant, so an unlabeled <Button> counts.
  - Presentation migration, not a rewrite. Carry actions, guards, computations,
    and formatters over verbatim.
  - Say what is true and stop. Two migrations invented copy that contradicted
    the data underneath it: a subhead claiming an ordering the grid didn't have,
    and a green "converts best at 0.0%" verdict that bypassed the evidence guard
    the same page already applied. If you write a claim, prove it from the data
    on that page or delete the sentence. State the fact; don't explain it.
  - Verify by IMPORT GRAPH, never name-grep. A grep hit is often a doc comment
    (that error nearly deleted a live component last session).
  - Delete what a migration orphans (ci:reachable-exports will tell you), after
    confirming the replacement carries the same actions and guards.

DEFINITION OF DONE FOR EACH FAMILY
  tsc clean · full `npm run ci:gates` green · every page loaded in a real
  browser at 375 AND 1280 (dev server on :3000, authed storage state at
  e2e/.auth/user.json) asserting 200, exactly one <main>, no page-level
  horizontal scroll · ratchet re-seeded smaller and committed · one commit,
  npm run push, npm run deploy:verify to READY.

GATE FAILURES ARE THE JOB, NOT AN OBSTACLE
  Several gates will fire on a migration and each one is telling you something
  real: ci:reachable-exports (orphans), ci:crm-screen-parity (proof pinned to a
  retired component — repoint it to the primitive the new page renders),
  ci:date-format (use lib/format/date), ci:admin-responsive (it scans CLASS
  strings — inline overflow styles are invisible to it), ci:page-action-imports
  and ci:file-size-budget (ratchets; re-seed only when the total genuinely
  shrank). Fix the cause; re-baseline only when growth is irreducible, and say
  so in the commit.

HOW TO WORK
  Operating autonomously — Matt is not watching in real time. Reversible work
  inside the locked scope ships without asking: commit and push to main per
  family. The only blocking wait is a Matt lock; none is expected in 11C.
  Never reopen a lock, never resurrect a cut-list route, and remember amnesia
  covers SHAPE (naming, nav, groupings), not just pixels.

  Report outcomes against evidence you produced this session. If a page could
  not be verified, say so plainly rather than implying it passed.

AFTER 11C
  11D (reports interior) → 11E (whatever the ratchet still shows) → then the
  P12 correctness debt already in the queue: group-MMS chokepoint, block-reason
  ledger, listing edits not surviving re-sync, assigned_broker resolution rule.

Start by printing disk state, then pick the next family and go.
```

---

## Quick facts you may be asked for

- **The two 11B holdouts are done** (`cf1696e2`): ContactSendCenter's trigger takes
  an optional `triggerClassName`; the FAB draws `--a-btn-bg`. Send path untouched.
- **Chrome is settled**: no wordmark anywhere in admin; desktop is the locked
  216px §5 left rail, phone is the 5-tab bar + a slim unbranded utility row.
  The public SiteHeader still ships hidden HTML inside `data-chrome-gate`
  (`display:none`, 0×0) — that is expected, not a leak.
- **Litmus**: re-time it only if a change touches the alert → person → kickoff
  path. `tmp/litmus-*.mjs` holds the harness. The alert drain runs EVERY minute,
  so seed fixtures directly rather than through the webhook unless you intend to
  send Matt a real SMS.

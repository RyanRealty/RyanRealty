# DB TDD — data-layer and deterministic business logic

When your change touches data-shaped logic — pricing math, comp filtering, stat derivation, status transitions, slug resolution, anything that will eventually read from Supabase — use this workflow.

## The adaptation for this repo

The source pattern (Pocock's course-video-manager) runs tests against an in-memory Postgres (PGLite). This repo has no in-memory DB harness, and unit tests must NEVER hit hosted Supabase (that's production — see the no-adhoc-SQL rule). So the discipline here is:

**Extract the deterministic core into a pure module and TDD that; keep the I/O shell thin and untested at the unit level.**

`lib/cma/pricing.ts` + `lib/cma/contract.ts` are the house exemplars: all the judgment math is pure functions over typed inputs, fully unit-tested; the DAL function that feeds them real rows is a thin fetch with no logic worth unit-testing.

## Workflow

### 1. Split the module: pure core, thin shell

The pure core takes typed rows/objects in and returns results — no Supabase client, no fetch, no env. The shell (a `lib/data/` DAL function or server action) fetches rows and calls the core.

### 2. Write a SINGLE failing test against the core's public interface

Colocate as `<module>.test.ts`. Use builder fixtures with `Partial<T>` overrides. Assert on outputs, not internals.

### 3. Make it pass with the simplest implementation

Don't anticipate future cases yet.

### 4. Repeat 2 & 3 until the behavior is covered

Prioritize the tests the compiler can't do: threshold boundaries (e.g. months-of-supply at exactly 4.0 and 6.0), ordering, empty/degenerate inputs, conflict resolution between rules.

### 5. Refactor under green tests

### 6. Wire the shell

DAL rules apply as usual: the fetch lives in `lib/data/`, no raw `.from()` outside it (G1), refresh the DAL index if you added a function (`npm run ci:data-access -- --refresh`).

## What NOT to unit test

- Supabase query syntax or column selection — that's verified by the DAL gates and live verification, not vitest.
- Return shapes the types already prove.
- Live data quality — that's the §0 verification-trace discipline, a separate concern.

Live-path behavior (the shell actually returning real rows, the page rendering them) is verified in the browser per the verify-before-moving-on rule — after unit green, not instead of it.

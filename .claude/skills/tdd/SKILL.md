---
name: tdd
description: "Red-green TDD tactics for the implementation phase of any change: one failing test at a time, test through the public interface, don't test what the type system proves. Routes to DB-TDD.md for data-layer logic and FRONTEND-TDD.md for complex client state. Use when implementing a feature or fix that touches lib/ computation, DAL-adjacent logic, or non-trivial component state."
---

# TDD (Ryan Realty)

Adapted from the `do-work` skill in Matt Pocock's `course-video-manager` (reviewed 2026-07-11). This is NOT a competing end-to-end process — THE LOOP (`docs/DEVELOPMENT_PROCESS.md`) remains the canonical cycle. This skill is the implementation-phase tactic inside it.

## Principles (apply to every test you write here)

1. **Validate using the interface.** Test the behavior through the same path the real app uses — call the exported function the app calls and assert on the result. Never assert on internal query structure, intermediate state, or how a module builds its SQL/filters.
2. **Don't test what the type system proves.** If TypeScript already guarantees a return shape, required fields, or argument types, don't write a test for it. Spend tests on runtime behavior the compiler can't verify: ordering, data relationships after mutation, threshold/boundary logic, conflict resolution.
3. **One test at a time.** Write a single failing test, make it pass with the simplest implementation, then write the next. Each test should teach you something new about the implementation. Batch-writing tests upfront produces tests that validate nothing.

## Sub-workflows

- Change touches data-layer or deterministic business logic → [DB-TDD.md](DB-TDD.md)
- Change touches client components with non-trivial state → [FRONTEND-TDD.md](FRONTEND-TDD.md)

## Repo conventions

- Runner: vitest. `npm test` runs `vitest run`; scope a file with `npx vitest run lib/cma/contract.test.ts`.
- Test files are colocated: `lib/foo.ts` → `lib/foo.test.ts`.
- Fixtures: builder functions taking `Partial<T>` overrides (see `lib/cma/contract.test.ts` for the house style).

## Feedback loops (sequential, all clean before commit)

1. **Types**: `npx tsc --noEmit`
2. **Tests**: `npm test`
3. **Gates**: `npm run ci:gates` (mandatory on user-facing surfaces per CLAUDE.md)

If a check fails, fix and re-run that check before moving to the next. Never move on with a failing check. Runtime verification (browser-rendered, per the verify-before-moving-on rule) still applies after green — tests are necessary, not sufficient.

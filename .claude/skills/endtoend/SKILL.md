---
name: endtoend
description: Run any task as a full end-to-end mission — write the complete goal first, split into parallel workers only as far as the work genuinely allows, test the real thing after every meaningful step (browser, computer use, keystrokes), auto-review + commit + log progress continuously, synthesize worker results with tests as the tiebreaker, and finish with a dedicated review pass. Done means production grade — a real user can walk in and use it. Use whenever Matt says "/endtoend", "end to end", "take this all the way", "build this to done", or hands over a large task he expects finished without check-ins.
---

# /endtoend — mission protocol

The argument to this skill is **the task**. Everything below is how it gets done.
Partial progress is not done. The deliverable is production grade: a real user can
walk in and use it.

Repo canon still binds: CLAUDE.md §0 data accuracy, §1 approval classes, brand
voice, mechanical gates, and the draft-first rule for rendered content deliverables
all outrank this protocol where they touch.

## 1. Goal first

Before any work, write yourself a full end-to-end goal for the task: what exists
when it is finished, what a real user does with it, and what "meets the bar"
means for both the architecture and the visible result. Write it down in the
project (a plan file, progress doc, or ledger — somewhere sensible, not chat
only). Keep going until the architecture and the result both meet that bar, not
until the first version compiles.

## 2. Split

Break the goal into independent pieces and run them in parallel **only as far as
the work genuinely allows** — forced parallelism on coupled work creates merge
conflicts and rework, so serialize what shares files or decisions. Every worker's
goal carries, explicitly:

- its own deliverable
- how to verify it
- what counts as done
- which files it may touch (disjoint from every other worker)

Distrust a worker's "done" — verify it yourself (see the parallel-build-agents
memory: partition disjoint files; agents overstate completion).

## 3. After every meaningful step

Test the real thing, for real, full end to end — not just unit tests. Use
whatever the verification actually needs: the browser preview, computer use,
keystrokes, a real render, a real query against the live source. A change that
was not exercised in the real system is not verified.

Then, in order: auto-review the change (self code review, `engineering:code-review`
on meaningful changes), commit it, and write progress somewhere sensible in the
project (the same plan/progress doc from step 1, or `.auto-memory/`). Commit and
push as you go — never stop to report between fixes.

## 4. Synthesize

Merge worker results as they come back and resolve conflicts **before** the next
piece moves — a conflict left open poisons everything built on top of it. When
two workers disagree, write a test that decides it. **The test outranks both
workers.** Never resolve a disagreement by picking the more confident prose.

## 5. Stop conditions

Stop only for one of exactly three reasons, and say which one it is:

1. **Missing credentials** — name the credential and where it is needed.
2. **Destructive ambiguity** — an irreversible action whose intent is unclear.
3. **Conflicting requirements** — two instructions that cannot both hold; surface
   both verbatim.

Everything else — errors, flaky tests, missing information you can find, long
runtimes — you work through. Partial progress is not a stopping point.

## 6. Finish

One dedicated review pass over **everything** produced in the mission — not per
piece, the whole: architecture, correctness, gates green, real-user walkthrough
of the final surface. Fix what the pass finds.

Then a short summary: what shipped (with commits/links) and what is still open.

**Done = production grade. A real user can walk in and use it.**

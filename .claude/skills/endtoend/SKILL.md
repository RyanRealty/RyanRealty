---
name: endtoend
description: Run any task as a full end-to-end mission — write the complete goal first, split into parallel workers only as far as the work genuinely allows, test the real thing after every meaningful step (browser, computer use, keystrokes), auto-review + commit + log progress continuously, synthesize worker results with tests as the tiebreaker, and finish with a dedicated review pass. Done means production grade — a real user can walk in and use it. Use whenever Matt says "/endtoend", "end to end", "take this all the way", "build this to done", or hands over a large task he expects finished without check-ins.
---

# /endtoend

The argument is the task. Done means production grade: a real user can walk in
and use it. Partial progress is not done, and the bar applies to the
architecture as much as the visible result — a good demo on a bad foundation
fails this skill.

Repo canon (CLAUDE.md §0 data accuracy, §1 approval classes, brand voice, gates,
draft-first for rendered media) outranks this protocol wherever they touch.

## Goal first

Write the full end-to-end goal before touching code: what exists when finished,
what a real user does with it, what meets the bar. Put it in the project (plan
file, progress doc, ledger) — a goal that lives only in your head drifts, and a
goal in the repo is what the final review pass gets measured against.

## Split honestly

Decompose into independent pieces and parallelize only as far as the work
genuinely allows. Coupled work run in parallel produces merge conflicts and
rework, which is slower than serializing it. Each worker's brief carries its own
deliverable, verification method, definition of done, and an exclusive file
set. Verify workers' claims yourself — agents overstate completion.

## After every meaningful step

Test the real thing, for real, end to end — browser, computer use, keystrokes,
live queries, whatever the change actually needs to be exercised. Unit tests
passing on unexercised integration is the classic way missions quietly fail.
Then review the change, commit it, and log progress in the project doc. Keep
moving — never pause the mission to narrate.

## Synthesize

Merge results as they arrive and resolve conflicts before dependent work
proceeds, because an open conflict poisons everything built on it. When two
workers disagree, write a test that decides the question. The test outranks
both — never settle a disagreement by picking the more confident prose.

## Stopping

Only three things stop a mission, and you name which one:

1. Missing credentials — name the credential and where it's needed.
2. Destructive ambiguity — an irreversible action whose intent is unclear.
3. Conflicting requirements — quote both instructions that can't both hold.

Errors, flakiness, gaps in your knowledge, long runtimes: work through them.

## Finish

One dedicated review pass over the whole — architecture, correctness, gates,
and a real-user walkthrough of the final surface. Fix what it finds. Then a
short summary: what shipped (commits, links) and what remains open.

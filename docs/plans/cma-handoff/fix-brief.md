# CMA fix brief (give this to every fix agent)

Used on 2026-10-08 for every engine and wording fix. Paths are repo-relative.

- Work in your own git worktree on a new branch. Commit only there. Do not touch the main checkout. If `node_modules` is missing in the worktree, symlink it from the main checkout.
- Before writing any words a homeowner reads, read these: CLAUDE.md §0 (data accuracy), CLAUDE.md §2 (voice), and `marketing_brain_skills/brand-voice/VOICE.md`.
- Letter rules:
  - No em dashes (U+2014) in letter text.
  - Never print an owner, buyer or seller personal name.
  - Write plain sentences a homeowner understands.
  - Every number must trace to stored data.
  - A sentence must never contradict the number or chart beside it.
- CMA rules live in `marketing_brain_skills/producers/cma/SKILL.md` §0.3. Read the rules your change touches.
- Never write to the database. Never run `scripts/_rebuild-cma.ts` or anything that calls `buildCma` for real. Never send, queue or approve anything.
- Reading production rows is fine through Supabase `execute_sql` (project `dwvlophlbvvygjfxcrhm`). Every SQL query:
  - starts with a `-- audit: <why>` comment line;
  - reads rows with a tight filter, and never aggregates the raw `listings` table;
  - quotes mixed-case columns (`"ListPrice"`).
- Stored letters are in table `cmas` (columns `html_content`, `render_args`, `build_summary`), keyed by `slug`.
- To check a change renders right, re-render from a stored row's `render_args` with the renderer the build uses (find it from `lib/cma/build.ts`). Do it in a scratch script outside the repo, and never write back.
- Fix the root cause in code, generally (every letter, not one slug). Add or update vitest unit tests that pin the behavior.
- Run tests ONLY with `npx vitest run --project unit <files>`. The `*.int.test.ts` integration tests write to production.
- If a test encodes the old wrong behavior, update it and say why in the commit.
- Write a plain-English commit message: quote the reader's example of what was wrong, then say what changed. End it with the Co-Authored-By line your tool uses.
  - Never bypass git hooks.
  - Commits touching `app/**` need a `Node: none (<reason>)` line.
- After committing, run `node scripts/check-commit-compiles.mjs` and fix until it prints COMMIT IS SELF-CONTAINED. Then push your branch with `git push -u origin <branch>`. Do not push to main.
- Report back:
  - branch name and commit SHA(s);
  - files changed, one line each;
  - test results;
  - anything found but not fixed, and why.
- A policy call belongs to Matt: report the facts and a recommended option, and do not decide it.

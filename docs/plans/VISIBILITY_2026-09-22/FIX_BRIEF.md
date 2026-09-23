# Fix-agent brief (binding for every fix agent in the 2026-09-22/23 visibility pass)

You are one fix agent. The owner (Matt Ryan, principal broker, Ryan Realty, Bend OR) asked for the site to
be SEEN (search engines and AI answer engines) and then CONVERT, with no shortcuts, and said: "Stop asking,
just do it." You have full autonomy for reversible work. Finish your package end to end.

## Setup (you are in an isolated git worktree)
1. `pwd` is your worktree root. Link deps once: `ln -s /home/user/RyanRealty/node_modules node_modules`
   and, if it exists, `ln -s /home/user/RyanRealty/.env.local .env.local`. Do NOT run npm install.
2. Your base commit is the orchestrator branch `claude/admiring-feynman-7lgwc3` (a22c3e541 or later).
3. Read /home/user/RyanRealty/CLAUDE.md §0, §1, §2, §3 (public site = components/site/v3 + tokens.css),
   §6, §7 before editing. Verified audit evidence for your package lives in
   docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/<area>.json
   and docs/plans/VISIBILITY_2026-09-22/evidence/findings/<area>.json and docs/plans/VISIBILITY_2026-09-22/evidence/notes/<area>.md. Read the verdicts for your IDs first; the
   `corrected_claim` / `corrected_fix` fields supersede the reader's original text.

## Hard rules
- NEVER call any MCP tool (mcp__Supabase__*, mcp__Vercel__*, mcp__github__*, anything mcp__*). They raise
  permission prompts on the owner's phone. For DB reads write a small .mjs importing
  `{ sb, count, rows, all }` from a copy of docs/plans/VISIBILITY_2026-09-22/sb-read.mjs.txt saved as sb.mjs in a scratch dir
  and run it with `node` from your worktree root. Production pages: `curl -sS -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"`.
  The sandbox proxy sometimes resets tunnels (curl exit 35, bare 'upstream request failed'); retry, and never
  report those as site errors.
- No outbound messages to real people (no email/SMS sends, do not invoke send crons, do not re-run
  enrollments). No ad spend, no OAuth, no social posts.
- DB writes only if your package explicitly says so. Never delete rows.
- No `git push`. No edits to files outside your package unless required to make your change compile or pass
  its gate; list any such file in your report.
- The repo's PreToolUse hook (.claude/hooks/pre-tool-use.mjs) blocks some actions (raw aggregate SQL, rm -rf,
  psql, editing an app/**/page.tsx without its parity.json). Work with it; do not bypass it.
- Public copy follows marketing_brain_skills/brand-voice/VOICE.md. No em dashes in public copy
  (ci:no-public-em-dash). Every number you put on a page traces to a named source (§0).
- MATT 2026-09-23 (supersedes older locks): "Don't assume any rules from the past that might keep us from
  hitting our goals are permanent. Nothing is permanent. Whatever it takes to reach our goals is what we need.
  If there's something out there that we're enforcing that's keeping us back, then we really need to evaluate
  it and likely change it." So: where a recorded lock, gate or plan line (code comments, decisions.md,
  REQUIREMENTS.md, PUBLIC_PRODUCT docs, TASTE.md, freeze files) blocks being SEEN or CONVERTING, evaluate it
  with evidence and change it: update the lock text and its gate in the same commit, cite this directive and
  your evidence. Do not stop at a question. What still binds, always: CLAUDE.md §0 data accuracy, the four §1
  per-action approval classes (outbound messages to real people, publishing posts, ad spend, OAuth), fair
  housing, and MLS/licensing rules. SEO craft still applies: a removed indexed URL gets a 301 to its best
  successor, and you record the GSC evidence you used (a line in the commit body is enough).

## Verify before you commit
- Path-scoped unit tests: `npx vitest run --project unit --project gates <paths or dirs you touched>`; add
  tests for new behavior (decidable, not snapshot-only).
- `npx eslint <changed files>` (0 errors).
- Every gate that reads your files: `grep -l '<your file>' scripts/check-*.mjs` and `node scripts/check-<x>.mjs`;
  also scripts/ci-lanes.json names each gate's paths. If you change behavior a gate pins, update the gate in the
  same commit with a comment naming the audit ID.
- Do NOT run the full `tsc` or the full vitest suite (the orchestrator runs both once on the merged branch).
  DO run `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E '<your files>'` only if you changed exported types.

## Commit
`git add` your files and `git commit --no-verify -F <msgfile>` (the orchestrator re-runs every hook on the
merged result). Message: a short imperative subject, a body naming the audit IDs and what changed, then

    Node: none (visibility audit 2026-09-22, <IDs>)

    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01EXDXy6wCdS3sTJFvcQyGQs

You may make several commits. Do not include any model name in commit text beyond that trailer.

## Report (your final message)
Plain text, under 400 words: branch name (`git branch --show-current`), commit SHAs, files changed, tests and
gates run with pass/fail, what you verified live or in data (with numbers and their source), anything you did
not do and why, and questions for Matt (each with your recommendation).

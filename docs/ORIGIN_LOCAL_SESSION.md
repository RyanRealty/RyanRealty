# Local session: add the Origin `cursor` remote

Paste the block below into a **new Cursor or Claude Code chat on Matt’s Mac**.
That machine is signed into Cursor, GitHub, Vercel, and Supabase as Matt. A
cloud VM cannot finish Origin CLI login.

Companion runbook: `docs/ORIGIN_CUTOVER.md`. Helper (this branch):
`scripts/origin-dual-remote.mjs` / `npm run origin:dual-remote`.
Branch with the helper: `cursor/origin-dual-remote-260d` (PR #107).

---

## Paste this into the new local session

```
You are on Matt’s local Ryan Realty checkout (Mac). Finish the Cursor Origin
dual-remote setup. GitHub stays the source of truth. Do not detach.

ALREADY DONE (do not redo)
- GitHub repo github.com/RyanRealty/RyanRealty is canonical. Remote `origin`
  must stay GitHub.
- Origin is an inbound mirror (Sync from GitHub). Pushes to Origin still
  pass through to GitHub.
- Matt connected Vercel to Origin (2026-08-18) on the existing project
  prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA / team_zwYQPapH0CpleD7RzJ7WctGO.
  Leave the GitHub↔Vercel integration connected.
- Cloud agent bc-276a7e45 wrote docs/ORIGIN_CUTOVER.md and
  scripts/origin-dual-remote.mjs on branch cursor/origin-dual-remote-260d
  (PR https://github.com/RyanRealty/RyanRealty/pull/107). That VM could not
  run origin auth login as Matt.

YOUR JOB (this checkout only)
1. Confirm you are in the RyanRealty git root. Print `git remote -v` and
   `git status -sb` first.
2. If `origin` is not github.com/RyanRealty/RyanRealty, STOP.
3. Get the helper onto this tree if it is missing:
   - `git fetch origin cursor/origin-dual-remote-260d`
   - stay on the user’s current branch unless they are already on that
     branch; you may cherry-pick or checkout the two files
     `scripts/origin-dual-remote.mjs` and the package.json script
     `origin:dual-remote` from that branch. Do not merge to main unless
     asked.
   - If fetch fails, use the manual remote add in step 6.
4. Install Origin CLI if `origin --version` fails:
   `curl -fsSL https://downloads.cursor.com/origin/install.sh | sh`
   then `export PATH="$HOME/.local/bin:$PATH"`.
5. Run `origin auth login`. A browser opens. Matt is already signed into
   Cursor — complete Allow / Sign in as Matt (matt@ryan-realty.com), not
   a cloud-agent Google account. Then `origin auth status` must show
   logged in.
6. Add the second remote. Prefer:
   `npm run origin:dual-remote`
   If the script is missing: open https://cursor.com/codebase → RyanRealty
   (GitHub-sync icon) → green Code → copy HTTPS
   `https://origin.cursor.com/{owner}/RyanRealty.git` →
   `git remote add cursor THAT_URL` → `git fetch cursor`.
   Override slug with ORIGIN_REPO=owner/name if the helper finds more than
   one match.
7. Success is `git remote -v` showing:
   - origin → github.com/RyanRealty/RyanRealty
   - cursor → origin.cursor.com/…/RyanRealty.git
   and `git fetch cursor` works.
8. If this Mac also has a separate Claude Code worktree or clone, repeat
   5–7 there. Remotes are per-checkout.

HARD STOPS
- Do not `git remote set-url origin` to Origin.
- Do not click or run Detach from GitHub (Settings → General → Danger Zone).
- Do not disconnect GitHub from Vercel.
- Do not archive or delete the GitHub repo.
- Do not create a new Vercel project.
- Do not paste CURSOR_API_KEY, tokens, or passwords into chat or commits.
- Do not start THE LOOP / fleet punch / production push for this task.
- You do not need new Vercel, GitHub, or Supabase API keys.

WHEN DONE
Print `git remote -v` (URLs only) and `origin auth status` (no secrets).
Update docs/plans/CROSS_AGENT_HANDOFF.md Current block: local Origin
dual-remote done, GitHub still canonical, no detach. Commit that handoff
only if the user wants it on git; the remotes themselves are local and
must not be committed.

Docs: docs/ORIGIN_CUTOVER.md, https://cursor.com/docs/origin
```

---

## If you are Matt and not an agent

Same outcome, shorter:

```bash
cd /path/to/RyanRealty
git fetch origin cursor/origin-dual-remote-260d
# optional: checkout that branch, or copy the helper onto your branch

curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

origin auth login
npm run origin:dual-remote
git remote -v
```

If `npm run origin:dual-remote` is missing, copy the HTTPS clone URL from
[cursor.com/codebase](https://cursor.com/codebase) → RyanRealty → **Code**, then:

```bash
git remote add cursor https://origin.cursor.com/OWNER/RyanRealty.git
git fetch cursor
```

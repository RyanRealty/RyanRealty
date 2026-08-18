# Cursor Origin cutover (Ryan Realty)

GitHub (`github.com/RyanRealty/RyanRealty`) stays the source of truth until
Vercel deploys from Origin are proven. This file is the machine-to-machine
runbook for Cursor, Claude Code, and cloud agents.

Official product: [Cursor Origin](https://cursor.com/docs/origin). Browse UI:
[cursor.com/codebase](https://cursor.com/codebase). Git remote host:
`https://origin.cursor.com/{owner}/{repo}.git`.

## Current state (do not skip)

| Layer | State | Do not |
|---|---|---|
| GitHub `origin` | Canonical. Vercel production still triggers from GitHub `main`. | Do not `git remote set-url origin` to Origin. |
| Origin sync | Inbound mirror of GitHub. Pushes to Origin pass through to GitHub. | Do not **Detach from GitHub**. |
| GitHub Actions | Live CI / nightly / release / smoke. | Do not archive or delete the GitHub repo. |
| Claude Code | Same GitHub `origin`. Handoff file still applies. | Do not let Claude push only to a stale GitHub copy after a later detach. |

Detach is **Settings → General → Danger Zone → Detach from GitHub**. After
detach, Origin stops forwarding to GitHub. The GitHub repo is left as-is.
Depot / Buildkite only run on Origin-hosted (detached) repos.

## Dual-remote (safe, now)

On every machine that edits this repo (Cursor desktop, Claude IDE, worktrees):

```bash
# once per machine
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
origin auth login

# in the checkout (GitHub origin is left alone)
npm run origin:dual-remote
```

The script adds a `cursor` remote and fetches it. It refuses to run if `origin`
is not GitHub `RyanRealty/RyanRealty`. Override the Origin slug with
`ORIGIN_REPO=owner/name` if `origin repo list` is ambiguous.

Optional manual equivalent:

```bash
git remote add cursor https://origin.cursor.com/{owner}/RyanRealty.git
git fetch cursor
```

## Vercel (before any detach)

1. Open the Origin repo → **Apps** → connect **Vercel**.
2. Link the existing project (`prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA`, team
   `team_zwYQPapH0CpleD7RzJ7WctGO`), not a new project.
3. Leave the GitHub↔Vercel integration connected.
4. Prove one Origin-visible push reaches Production **READY**, then
   `npm run deploy:verify` (needs `VERCEL_TOKEN`; the `gh` commit-status
   fallback dies after detach).

Origin API apps cannot install on an inbound GitHub mirror. The first-party
Vercel app is connected from the repo Apps tab, not by inventing a second
Vercel project.

## Claude Code

Claude is a git client. After `npm run origin:dual-remote` it can `git fetch
cursor` while `git pull --rebase origin main` stays GitHub. After a future
detach only:

```bash
git remote set-url origin https://origin.cursor.com/{owner}/RyanRealty.git
origin auth login
git pull origin main
```

`docs/plans/CROSS_AGENT_HANDOFF.md` remains the cross-tool handoff.

## After detach (not now)

1. Recreate Actions secrets on Depot or Buildkite (they do not sync).
2. Replace `release.yml` GitHub Releases if you still want version tags.
3. Point cloud agents and automations at the Origin repo.
4. Archive GitHub (do not delete) after a week of matching SHAs.

## What this agent already did

- Helper: `scripts/origin-dual-remote.mjs` (`npm run origin:dual-remote`).
- This runbook.
- Did **not** detach, rewrite `origin`, or disconnect Vercel from GitHub.
- Could not finish Origin login or the Vercel Apps OAuth from the cloud VM
  (browser / `CURSOR_API_KEY` required).

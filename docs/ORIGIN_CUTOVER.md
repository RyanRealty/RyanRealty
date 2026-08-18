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

On every machine that edits this repo (Cursor desktop, Claude IDE, worktrees).
This is the remaining local step after Vercel is connected.

1. Open **Terminal** (or the Claude IDE terminal).
2. Go to the checkout:

```bash
cd /path/to/RyanRealty
git pull
```

3. Install the Origin CLI once (skip if `origin --version` already works):

```bash
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

4. Sign in. A browser window opens. Click **Allow** / **Sign in** for your
   Cursor account. When the terminal says you are logged in, you are done
   with this part.

```bash
origin auth login
```

5. Add the second remote. GitHub `origin` stays as-is.

```bash
npm run origin:dual-remote
```

Done looks like: `git remote -v` shows `origin` → GitHub and `cursor` →
`origin.cursor.com`.

The script adds a `cursor` remote and fetches it. It refuses to run if `origin`
is not GitHub `RyanRealty/RyanRealty`. Override the Origin slug with
`ORIGIN_REPO=owner/name` if `origin repo list` is ambiguous.

Optional manual equivalent:

```bash
git remote add cursor https://origin.cursor.com/{owner}/RyanRealty.git
git fetch cursor
```

## CURSOR_API_KEY (only if a cloud agent asks)

This key is so a **cloud agent** can run `origin auth login` without a browser.
You do not need it on your Mac. Do not paste the key into chat.

1. Open [cursor.com/dashboard/api](https://cursor.com/dashboard/api) while
   signed into the same Cursor account.
2. Click **New API Key**.
3. Name it `origin-cutover` (any name is fine).
4. Copy the full secret immediately. It starts with `crsr_` and is shown once.
   The table later only shows a mask — that mask will not work.
5. Paste it into the cloud agent's **CURSOR_API_KEY** secret box (the setup
   prompt on the agent page). Not into Slack, email, or this chat.
6. Reply in the agent thread: `key is in`. The agent then runs
   `npm run origin:dual-remote` from the VM.

If you would rather skip the key, dismiss that prompt and use **Dual-remote**
on your Mac instead (`origin auth login` opens a browser; no key required).

## Vercel Apps (click by click)

Do this in Chrome, signed into the same Cursor account you used to Sync from
GitHub. Do **not** click **Detach from GitHub** (Settings → General → Danger
Zone).

1. Open [cursor.com/codebase](https://cursor.com/codebase).
2. Click the **RyanRealty** repo (GitHub-sync icon, not a repo you created from
   scratch).
3. Click **Settings**.
4. Click **Apps**.
5. Click **Manage Apps** if you only see a list and no Connect button. That
   opens [cursor.com/codebase/settings/apps](https://cursor.com/codebase/settings/apps).
6. On **Vercel**, click **Install** / **Connect** / **Add**.
7. A Vercel window opens. Sign in as the account that already owns
   [ryanrealty.vercel.app](https://ryanrealty.vercel.app) (the Ryan Realty
   team, not a personal hobby team).
8. When it asks which project, pick the **existing** Ryan Realty project. Do
   not create a new project. The live one is `prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA`
   (team `team_zwYQPapH0CpleD7RzJ7WctGO`).
9. Finish the OAuth. Leave the old GitHub↔Vercel connection in the Vercel
   dashboard alone.

If **Apps** or **Vercel** is missing, Origin is still in early beta for that
account. Stay on GitHub. Do not detach.

Done looks like: the repo **Apps** tab shows Vercel as connected, and
GitHub still shows as the sync source under **Settings → General**.

Matt connected Vercel to Origin on 2026-08-18. Leave the GitHub↔Vercel
integration in place until an Origin-triggered production deploy is READY.

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

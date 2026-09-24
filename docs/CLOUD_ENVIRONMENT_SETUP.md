# Claude Code cloud environment — setup

The Mac mini was retired as a workstation on 2026-07-25. Development runs on
Anthropic-managed cloud VMs via [claude.ai/code](https://claude.ai/code).

This document is the configuration. Everything here goes into the **environment**
you create once at claude.ai/code; sessions then inherit it.

> **Tradeoff, stated once:** a Claude Code cloud session *is* Claude Code. Other
> agent CLIs (Codex, Gemini, aider) cannot be driven interactively inside one.
> If you later want a multi-agent box, `.devcontainer/` in this repo builds it
> on Codespaces or any Docker host — the two are not mutually exclusive.

---

## 1. Network access

The default **Trusted** level allows package registries, GitHub, and cloud SDKs,
and **blocks everything else** — including this site's own domain and every API
the app calls. Choose **Custom**, check *"Also include default list of common
package managers"*, and paste the allowlist below.

Driving the VM's **own dev server on localhost needs no allowlist at all**. These
entries are for reaching production and third-party APIs.

```
ryan-realty.com
*.ryan-realty.com
*.vercel.app
vercel.com
dwvlophlbvvygjfxcrhm.supabase.co
*.supabase.co
*.skyslope.com
*.sparkapi.com
*.sparkplatform.com
*.googleapis.com
*.google.com
oauth2.googleapis.com
*.twilio.com
api.resend.com
api.anthropic.com
api.elevenlabs.io
api.apify.com
api.x.ai
api.replicate.com
*.upstash.io
graph.facebook.com
*.facebook.com
api.linkedin.com
*.tiktokapis.com
developers.tiktok.com
api.twitter.com
x.com
*.unsplash.com
api.pexels.com
api.shutterstock.com
cdn.jsdelivr.net
maps.deschutes.org
*.municode.com
*.municipalcodeonline.com
```

Deliberately excluded: `retired.invalid` and `www.zillow.com`. Both systems
were retired 2026-07-25. Dead references remain in the tree (~212 FUB, ~54
Zillow) but nothing should be calling them — if a session hits a network block
on either, that is a bug to fix, not a domain to add.

**Observed 2026-09-24:** hosts outside this list (`example.com`,
`api.spotify.com`) were reachable, so the environment's current access level
is broader than this list. Nothing the app calls was blocked.

## 2. Environment variables

The **Environment variables** field takes `.env` format, one `KEY=value` per
line, and stores any surrounding quotes AS PART OF THE VALUE. Generate the
paste-ready body with:

```bash
npm run secrets:pack -- --env
```

That writes `tmp/cloud-env.txt` (gitignored) — 108 variables, quotes stripped,
comments dropped, `ANTHROPIC_API_KEY` excluded. Open it and copy the contents:

```bash
cat tmp/cloud-env.txt
```

> **Do NOT use `--stdout` on its own for this field.** That emits BASE64, for the
> Codespaces `DOTENV_LOCAL` secret — a different target with a different format.
> Pasting it here yields one garbage variable. (`--env --stdout` prints the
> `.env` body instead of writing the file.)

**`ANTHROPIC_API_KEY` is excluded on purpose.** Claude Code prefers an API key
over your subscription when one is present, which bills per token and disables
subscription-only features. The headless producer crons that need it run on
Vercel, not in a dev session.

Anthropic's own docs state there is no dedicated secrets store yet: environment
variables and the setup script are stored in the environment configuration and
are **visible to anyone who can edit that environment**. This blob is the whole
credential surface — MLS, Supabase service role, Twilio, Meta, Google. Treat
edit access to the environment as equivalent to handing over `.env.local`.

**One line per variable, no exceptions (found 2026-09-24).** The field reads
each line as its own variable. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` had been
pasted as a multi-line PEM, so the key body became 26 stray variables named
after the key's own lines, plus one named `-----END PRIVATE KEY-----`, and the
variable itself holds no usable key.
Every service-account caller in a cloud session (GA4, Search Console, Calendar,
Drive ingest, Postmaster, the Gmail readers and drafts; `grep -rl
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY lib`) therefore cannot authenticate. The fix:

1. Delete the stray lines from the field (they start `MIIE`, `-----END`, and
   base64 text; none is a real variable name).
2. Re-paste the key on ONE line with a literal `\n` where each line break was:
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n`.
   Every consumer in `lib/` already turns `\n` back into newlines.
3. Rotate the key in Google Cloud IAM (new key, delete the old). Its lines sat
   in variable names, which any `env` listing prints, so treat it as exposed.

**Also on 2026-09-24, the field held variables it should not:**
`ANTHROPIC_API_KEY` (excluded on purpose, see above; the platform strips it
from the session, but it still sits in the configuration) and the retired
CRM's credentials (the three variables starting `FOLLOWUP`, plus
`FUB_LOGIN_EMAIL`, `FUB_LOGIN_PASSWORD`, `NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM`
and `NEXT_PUBLIC_FUB_PIXEL_ID`). Delete them.
It lacked one it needs: `VERCEL_TOKEN`, without which `deploy:verify` cannot
run in a cloud session.

## 3. Setup script

**Where the field is:** claude.ai/code, the environment chip under the composer, Cloud,
hover RYANREALTY_CLOUD, the gear. It is not under Settings > Claude Code (that page is
OAuth tokens and sharing), `/code/environments` is a 404, and the routine API cannot set it.

**What is set on RYANREALTY_CLOUD (2026-09-08):**

```bash
#!/bin/bash
CLOUD_SETUP_BROWSERS=1 bash scripts/cloud-setup.sh || true
```

`CLOUD_SETUP_BROWSERS=1` is deliberate for the site fleet. Every site lane's taste pass
runs `scripts/take-route-shots.mjs`, which calls `chromium.launch()`, so the browser goes
into the snapshot once instead of being downloaded by every lane. The field was empty
from 25 August to 8 September: every fire paid a 76-second `npm ci` and no lane had a
browser at all. If the environment build ever exceeds its five-minute budget, drop the
variable and let lanes run `npm run setup:browsers` themselves.

The `|| true` matters: a non-zero exit means **the session fails to start**, and
this script's apt/font/npm steps are all non-critical individually.

It runs as **root on Ubuntu 24.04**, once per environment — Anthropic snapshots
the filesystem afterwards and later sessions skip it. It re-runs when you change
the script or the allowed hosts, and after roughly seven days.

`scripts/cloud-setup.sh` calls `sudo apt-get`. Scripts already run as root and
`sudo` may not exist in the image; the calls are `|| true`-guarded so a missing
`sudo` degrades to "no ffmpeg" rather than a dead session. If ffmpeg turns out
to be missing in a session, drop the `sudo` prefix.

Installs ffmpeg, the brand fonts (Amboqia + AzoSans, shipped in-repo), and node
dependencies, then runs the parity gate. Chromium is **skipped by default** —
the environment has roughly a five-minute build budget and most sessions never
drive a browser.

**`npm run setup:browsers` alone does not install the fonts (found 2026-09-15).**
It is just `npx playwright install --with-deps chromium` — a plain npm script,
not this file — so a session that boots from `npm ci` + `npm run setup:browsers`
and never runs `cloud-setup.sh` gets a browser with no Amboqia/AzoSans
registered (`fc-list | grep -ic amboqia` reads 0). Chromium launches fine
without them, so nothing fails loudly; a taste-pass render just looks wrong
later. When a session mid-way through work needs a browser, run the one
command that gets both instead, skipping the apt/npm steps it doesn't need to
repeat:

```bash
CLOUD_SETUP_SKIP_DEPS=1 CLOUD_SETUP_BROWSERS=1 bash scripts/cloud-setup.sh
```

`CLOUD_SETUP_SKIP_DEPS=1` assumes fontconfig is already on the box, which is
true once the environment's own setup script (below) has run at least once.

If the setup script times out, move `npm ci` into a background `SessionStart`
hook rather than trimming what it installs.

**Observed 2026-09-24: the snapshot had none of it.** A cloud session booted
with no `node_modules`, no brand fonts, no ffmpeg, no git hooks and no pinned
Chromium, which is everything this script installs. `apt-get update`, the
script's first step, had never run either: the package lists in
`/var/lib/apt/lists` date from the image build (2026-03-31). Anthropic's docs
(code.claude.com/docs/en/cloud-environments) say the setup script runs "before
Claude Code launches" but document neither its working directory nor whether
the repository is cloned yet, so the relative `bash scripts/cloud-setup.sh ||
true` above can fail with nothing to show for it. A body that does not depend
on the working directory:

```bash
#!/bin/bash
SETUP="$(ls /home/user/*/scripts/cloud-setup.sh 2>/dev/null | head -1)"
[ -n "$SETUP" ] && CLOUD_SETUP_BROWSERS=1 bash "$SETUP" || true
```

If a session still boots bare after that, the repository is not on disk when
the setup script runs, and the SessionStart hook below is the only layer that
can install `node_modules`.

**The SessionStart hook is the backstop.** `.claude/hooks/session-start.sh`
runs at the start of every cloud session, before the first prompt:
`npm ci` when `node_modules` does not match `package-lock.json` (it also
installs the git hooks through husky's `prepare`), `npx husky` when the git
hooks are missing, and the brand-font copy when Amboqia is not registered. It
also says, in one line, when Playwright's pinned browser is missing and how to
launch anyway. When all of it is current it prints nothing and takes a fraction
of a second; a bare box takes about 65 s (measured 2026-09-24). With the
dependencies in place the CLAUDE.md session boot (`npx tsx
scripts/loop-brief.ts`) ran in 39 s; without them it cannot run. `cloud-setup.sh` writes the same
`node_modules/.package-lock.sha256` marker, so the hook does not repeat an
install the setup script already made for the same lockfile. It needs its
`SessionStart` entry in `.claude/settings.json` (section 6).

**A hookless clone now fails the gate chain.** With `core.hooksPath` unset,
git uses `.git/hooks`, which holds only `*.sample` files until husky runs, so
no hook fires: no commit-msg approval gate (CLAUDE.md §1), no pre-commit tests,
no pre-push marker check. `ci:hooks-installed` used to skip in that state; since
2026-09-24 it checks the directory git actually uses and fails, with the fix
(`npx husky`, or `npm ci`).

**Playwright's pinned browser is not in the image.** `@playwright/test` 1.58.2
wants `chromium_headless_shell-1208`; the image ships build 1194 in
`/opt/pw-browsers`, so a bare `chromium.launch()` fails until
`CLOUD_SETUP_BROWSERS=1` has run. Mid-session, launch with
`executablePath: '/opt/pw-browsers/chromium'` (the preinstalled 1194 build,
verified to work with 1.58.2) instead of downloading.

## 4. Verify a session

```bash
npm run ci:gates        # 175 gates
npm run auth:verify     # SkySlope session (logs in headless, no MFA)
npm run dev             # dev server on :3000
```

`auth:verify` is the one to watch on the first cloud run. SkySlope's Okta login
completes headless from a residential IP (verified 2026-07-25); a datacenter IP
may trigger a new-device check. If it does, set `SKYSLOPE_TOTP_SECRET` and
`scripts/_auth-capture.mjs` will handle the code automatically.

## 5. Known risks on the first cloud run

Several things about THIS repo that the generic docs will not tell you. Check each
on the first session rather than discovering it mid-task.

**The build may not fit, and it's order, not heap size (2026-09-15).** Cloud sessions
get roughly 4 vCPU / 15 GB RAM / 30 GB disk, no swap. `npm run push` runs a full
`next build`, and ledger row W3.5 is already blocked because pre-rendering
`/search/[...slug]` runs out of heap — on the Mac mini. On a cloud box the build was
also OOM-killed (exit 137, "Killed", no Node error at all) while a `next dev` server
was ALSO running; with dev stopped and `NODE_OPTIONS=--max-old-space-size=11264` set,
the identical build passed in about 10 minutes. The OS OOM killer did that, not V8's
heap limit — so `NODE_OPTIONS=--max-old-space-size` in the environment variables is
still worth setting, but it is not the fix by itself. **Stop the dev server before you
build.** Order: stop dev → `next build` → start the prod server → gates.

**Starting the prod server after a build, safely.** `npm run start:prod`
(`scripts/start-prod-server.sh`) refuses a `.next` older than the HEAD commit, refuses
a held port (prints the pid + command; `FREE_PORT=1` to take it anyway), and starts
`next start` detached, waiting on it with `scripts/wait-for-server.mjs`. An ad hoc
`npx next start -p <port>` has none of those guards — on 2026-09-15 one collided with
an earlier `next start` still holding the port, logged `EADDRINUSE` into a file
nobody read, and two Playwright probes measured the OLD build as if it were the new
one.

**`git push` authentication, and `npm run push` targets `main` (2026-09-15).** The
local remote is SSH (`git@github.com:RyanRealty/RyanRealty.git`). Cloud sessions
authenticate GitHub through a proxy and set `GH_TOKEN`/`GITHUB_TOKEN` to the
placeholder `proxy-injected`. The platform sets its own remote on the clone, so
pushing should work — but `scripts/push-with-gates.sh` opens its own connection, so
prove `npm run push` end to end on the first session before trusting it. More
importantly: `npm run push` rebases onto and pushes `origin/main`. A cloud session
whose harness has it bound to its OWN branch must NOT run it — the sequence that
works there is commit → `npm run gates:stamp` → `git push -u origin <branch>`. The
pre-push hook only checks the gates-stamp marker, and the marker is valid for 240
minutes.

**`gh` is not pre-installed**, and CLAUDE.md tells every agent to use it for
GitHub operations. Add `apt install -y gh` to the setup script if a session needs
`gh release` / `gh workflow run`; the built-in GitHub tools cover issues and PRs
without it.

**Commits run only the tests they touch (2026-09-24).** The full unit suite
took 320 s per commit on a cloud session (4 vCPU). `.husky/pre-commit` now runs
`test:unit -- --changed`: the test files that import what the commit changes,
or everything when `package.json` or a vitest/vite config changes. For a
two-file `lib/` change that was 176 test files in 116 s; for a docs change,
none. The full suite still runs on every PR and every push to main in GitHub CI,
and `npm run push` runs the path-scoped set before any ref moves.
`PRECOMMIT_UNIT_FULL=1 git commit ...` runs the whole suite locally.

**Fetching production from the VM (checked 2026-09-24).** ryan-realty.com
answers 403 to curl's default user agent, and an HTTP/2 tunnel through the agent
proxy can drop mid-exchange. `curl --http1.1 -A '<a browser user agent>'` gets
200. Chromium needs the flags in the handoff's sandbox notes.

## 6. Connectors and tool permissions (Matt 2026-09-24: always allow)

Matt's rule: connectors run without interrupting him. Two layers decide whether
a connector call stops to ask, and both have to agree:

1. **The connector's own tool permissions** at
   [claude.ai/customize/connectors](https://claude.ai/customize/connectors),
   on Matt's account. An agent cannot change them. A tool set to "Needs
   approval" there prompts on every call, even in auto mode, whatever this repo
   allows; that is what put Supabase SQL and migration approvals on Matt's
   phone.
   Connector changes reach a session only when it starts.
2. **`.claude/settings.json` in this repo.** `mcp__<Server>__*` in
   `permissions.allow` lets a call skip the auto-mode classifier. A tool in
   `permissions.ask` prompts even when its server is allowed (rules resolve
   deny, then ask, then allow).

**Default: Always allow, in both layers, for every connected connector.** The
exceptions are the tools that send a message to a real person (CLAUDE.md §1),
spend money, or take production offline. They stay "Needs approval" in layer 1
and `ask` in layer 2, so Matt's one tap is the approval:

| Tool | Why it asks |
|---|---|
| Gmail `send_message`, `reply`, `forward` | Outbound message to a real person |
| Google Calendar `respond_to_event` | Sends a reply to the organizer |
| Google Drive `share_file` | Gives someone access to a file and emails them |
| Vercel `buy_*`, `create_or_transfer_domain`; Supabase `create_project` | Spends money |
| Vercel `pause_project`, Supabase `pause_project` | Takes the site or the database offline |

`mcp__Supabase__execute_sql` stays **denied** in layer 2
(`.auto-memory/feedback_sql_access_2026-09-24.md`). Always-allow does not
reopen it.

**Layer 2, as it goes in `.claude/settings.json`:** `allow` holds
`mcp__Supabase__*`, `mcp__Vercel__*`, `mcp__github__*`,
`mcp__Claude_Code_Remote__*`, `mcp__Gmail__*`, `mcp__Google_Calendar__*`,
`mcp__Google_Drive__*`, `mcp__Canva__*`, `mcp__Figma__*`, `mcp__Airtable__*`,
`mcp__Vibe_Prospecting__*`, `mcp__Claude_Docs__*`,
`mcp__Cloudflare_Developer_Platform__*` and `mcp__Sentry__*` (ready for when
it is connected); `ask` holds the tools in the table; `deny` keeps
`execute_sql`; and `hooks.SessionStart` runs `.claude/hooks/session-start.sh`
(section 3). **An agent cannot write this file's permissions:** the auto-mode
classifier refuses an edit that widens the agent's own permissions or registers
its own hooks. Matt approves the change and the agent applies it only on his
explicit go-ahead.

**`ask` and `deny` use globs of the form `mcp__*<Server>__<tool>`.** Cloud
sessions name connector tools `mcp__<Server>__<tool>`; a session where Claude
Code fetches claude.ai connectors itself names them
`mcp__claude_ai_<Server>__<tool>` (code.claude.com/docs/en/permissions), and
the desktop app's local sessions do not enforce the claude.ai per-tool settings
(layer 1) at all (code.claude.com/docs/en/mcp). An exact cloud name such as
`mcp__Supabase__execute_sql` therefore left the SQL deny open outside the
cloud; `mcp__*Supabase__execute_sql` matches both. Allow rules cannot take a glob in
the server segment, so `allow` covers cloud names only, and local connector
calls fall back to the permission mode.

**Adding a connector:** in the same change, add `mcp__<Server>__*` to `allow`
and put its send, publish and spend tools in `ask`.

**Connectors on 2026-09-24:**

| Connector | State | Action |
|---|---|---|
| Supabase, Vercel | Connected; the core stack | Always allow |
| Gmail, Google Calendar, Google Drive | Connected | Always allow, except the table above |
| Canva, Figma | Connected; neither is called from the code (hand design work) | Always allow |
| Vibe Prospecting | Connected; prospect and company enrichment | Always allow |
| Airtable | Connected; referenced nowhere in the code | Keep only if used outside the repo |
| Cloudflare Developer Platform | Needs reconnect; no code uses a Cloudflare account (only Stream embed URLs and edge headers) | Remove unless Workers or R2 come into use |
| Era Context | Needs reconnect; personal finance | Remove from this workspace, or reconnect |
| **Sentry** (not connected) | The app reports errors to Sentry (`@sentry/` or `SENTRY_DSN` in 13 files) | Connect it: sessions can then read production errors directly |
| **Resend** (not connected) | The app sends email through Resend (package, key or API host in 14 files) | Optional: delivery and bounce lookups. Set its send and broadcast tools to Needs approval |

Counts are `grep -rl` over `app/`, `lib/`, `scripts/`, `components/`,
`middleware.ts`, `vercel.json` and `package.json` on 2026-09-24.

**Plugins.** CLAUDE.md §9 makes `engineering:code-review` mandatory before ship
and names `engineering:deploy-checklist`, `design:design-system` and `data:*`.
None of them loads in a cloud session: the `engineering`, `design` and `data`
plugins are in the org's plugin catalog but not enabled (checked 2026-09-24).
Enable all three on claude.ai; the next session loads them.

## Related

- [`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) — the setup script
- [`.claude/hooks/session-start.sh`](../.claude/hooks/session-start.sh) — the SessionStart backstop (deps, git hooks, fonts)
- [`scripts/start-prod-server.sh`](../scripts/start-prod-server.sh) — `npm run start:prod`; starts a built server with the stale-build and held-port guards `run-runtime-gates.sh` uses
- [`scripts/_auth-capture.mjs`](../scripts/_auth-capture.mjs) — third-party sessions
- [`scripts/check-vm-parity.mjs`](../scripts/check-vm-parity.mjs) — the gate that keeps this working
- [`.devcontainer/`](../.devcontainer/) — the multi-agent alternative

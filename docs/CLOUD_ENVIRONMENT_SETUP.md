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
x.ai
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

Deliberately excluded: `api.followupboss.com` and `www.zillow.com`. Both systems
were retired 2026-07-25. Dead references remain in the tree (~212 FUB, ~54
Zillow) but nothing should be calling them — if a session hits a network block
on either, that is a bug to fix, not a domain to add.

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

## 3. Setup script

Paste this into the **Setup script** field:

```bash
#!/bin/bash
bash scripts/cloud-setup.sh || true
```

The `|| true` matters: a non-zero exit means **the session fails to start**, and
this script's apt/font/npm steps are all non-critical individually.

It runs as **root on Ubuntu 24.04**, once per environment — Anthropic snapshots
the filesystem afterwards and later sessions skip it. It re-runs when you change
the script or the allowed hosts, and after roughly seven days.

`scripts/cloud-setup.sh` calls `sudo apt-get`. Scripts already run as root and
`sudo` may not exist in the image; the calls are `|| true`-guarded so a missing
`sudo` degrades to "no ffmpeg" rather than a dead session. If ffmpeg turns out
to be missing in a session, drop the `sudo` prefix.

Installs ffmpeg, the Grok Build CLI (`grok` / `agent` via https://x.ai/cli/install.sh),
the brand fonts (Amboqia + AzoSans, shipped in-repo), and node
dependencies, then runs the parity gate. Chromium is **skipped by default** —
the environment has roughly a five-minute build budget and most sessions never
drive a browser. When a session needs one:

```bash
npm run setup:browsers
```

If the setup script times out, move `npm ci` into a background `SessionStart`
hook rather than trimming what it installs.

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

Three things about THIS repo that the generic docs will not tell you. Check each
on the first session rather than discovering it mid-task.

**The build may not fit in 16 GB.** Cloud sessions get 4 vCPU / 16 GB RAM / 30 GB
disk. `npm run push` runs a full `next build`, and ledger row W3.5 is already
blocked because pre-rendering `/search/[...slug]` SIGABRTs the build worker with
a heap out-of-memory — on the Mac mini. If `npm run push` dies during static
generation, that is the ceiling, not a code bug. `NODE_OPTIONS=--max-old-space-size`
in the environment variables is the first lever.

**`git push` authentication.** The local remote is SSH
(`git@github.com:RyanRealty/RyanRealty.git`). Cloud sessions authenticate GitHub
through a proxy and set `GH_TOKEN`/`GITHUB_TOKEN` to the placeholder
`proxy-injected`. The platform sets its own remote on the clone, so pushing
should work — but `scripts/push-with-gates.sh` opens its own connection, so prove
`npm run push` end to end on the first session before trusting it.

**`gh` is not pre-installed**, and CLAUDE.md tells every agent to use it for
GitHub operations. Add `apt install -y gh` to the setup script if a session needs
`gh release` / `gh workflow run`; the built-in GitHub tools cover issues and PRs
without it.

## Related

- [`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) — the setup script
- [`scripts/_auth-capture.mjs`](../scripts/_auth-capture.mjs) — third-party sessions
- [`scripts/check-vm-parity.mjs`](../scripts/check-vm-parity.mjs) — the gate that keeps this working
- [`.devcontainer/`](../.devcontainer/) — the multi-agent alternative

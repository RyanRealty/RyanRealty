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

Deliberately excluded: `api.followupboss.com` and `www.zillow.com`. Both systems
were retired 2026-07-25. Dead references remain in the tree (~212 FUB, ~54
Zillow) but nothing should be calling them — if a session hits a network block
on either, that is a bug to fix, not a domain to add.

## 2. Environment variables

Paste the contents of `.env.local` into the environment's variable field
(`.env` format, **no surrounding quotes** — quotes are stored as part of the
value). Generate a clean copy with:

```bash
npm run secrets:pack -- --stdout
```

109 variables as of 2026-07-25. Note the environment's variables are visible to
anyone who can edit the environment.

**Keep `ANTHROPIC_API_KEY` out of it.** Claude Code prefers an API key over your
subscription when one is present, which bills per-token and disables
subscription-only features. Add it only if app code in a session needs to call
the Anthropic API directly.

## 3. Setup script

```bash
bash scripts/cloud-setup.sh
```

Installs ffmpeg, the brand fonts (Amboqia + AzoSans, shipped in-repo), and node
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

## Related

- [`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) — the setup script
- [`scripts/_auth-capture.mjs`](../scripts/_auth-capture.mjs) — third-party sessions
- [`scripts/check-vm-parity.mjs`](../scripts/check-vm-parity.mjs) — the gate that keeps this working
- [`.devcontainer/`](../.devcontainer/) — the multi-agent alternative

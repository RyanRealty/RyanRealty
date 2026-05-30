# Ryan Realty — Website Cutover Runbook

**Goal:** swap the live `ryan-realty.com` from the legacy AgentFire/WordPress site to the new Next.js app on Vercel, safely, with SEO preserved, tracking live, leads reaching FUB, and a one-step rollback armed.

**Prepared:** 2026-05-30. Companion docs: `docs/REBUILD_GATE_REVIEW_2026-05-30.md` (the 85-gate review), `data/cutover-rollback.json` (rollback artifact).

**Principle:** every step is a gate with a runnable check, not prose. Nothing advances until its gate is green.

---

## Status legend
- ✅ **Done & committed locally** (commit SHA noted) — *not pushed* (push to `main` is blocked pending your authorization).
- 🟡 **Drafted, needs your action** (apply / approve / configure).
- 🔴 **Not started** (tracked, needs build).

---

## What's already done (committed locally, unpushed)

| Commit | What | Gates |
|---|---|---|
| `21174e7` | ✅ CI now runs the full `ci:gates` suite (was hand-listing ~13, skipping 9). `pre-push` re-armed + made Mac-compatible (was PowerShell-broken). DAL/schema snapshot refreshed. | LAUNCH-15, DATA-15, SKILL-12, ADS-19 |
| `42bda0d` | ✅ Legacy WordPress→new-site **301 redirect map** (650 URLs). Generator + middleware + LAUNCH-04 gate. Validated: 650/650 covered, 0 loops, all 171 destinations resolve 200 on staging. | LAUNCH-04 |
| `7f6b8d8` | 🟡 Migration to **revoke anon EXECUTE** on ~28 admin/mutation DB functions (anon could trigger destructive ops). Drafted — **not applied**. | DATA-07, DATA-08 |
| (working tree) | 🟡 LP-form + `/team` gate-compliance fixes (shadcn, metadata). Gate-green + build-green, **need your draft-first approval to commit**. | LAUNCH-14 |

`ci:gates` exits 0. `npm run build` exits 0. 445/445 tests pass.

---

## Phase 0 — Catastrophe prevention (today, zero dependencies)

- [ ] 🟡 **Confirm the 5 latent-active ads stay paused.** All 9 campaigns are PAUSED (verified), but 5 ads carry `configured_status: ACTIVE` — one campaign toggle from spending on a 404 LP. Pause them at the ad level in Ads Manager, or grant the agent a Meta-API permission rule. *(ADS-18)*
- [ ] 🟡 **Rotate `META_USER_ACCESS_TOKEN`** — it was printed in a session log. Regenerate in the Meta app, update `.env.local` + Vercel.

## Phase A — Unblock the pipeline (your 2-minute action)

The agent did all the local work but **cannot push to `main`** (harness blocks default-branch pushes) and **cannot commit user-facing pages** (your draft-first gate). To proceed end-to-end:

- [ ] 🟡 **Authorize pushes:** add a Bash permission rule for `git push`, or push the 3 local commits yourself: `git push origin main`. *(Note: `db:guard` in pre-push will block until the DATA-07/08 migration below is applied — that's intentional.)*
- [ ] 🟡 **Approve the user-facing baseline:** review the LP-form/`/team` diffs (`git diff`), then either say "approved" or commit with `Approved-by: matt` in the message.

## Phase B — Pre-wire correctness (off-domain, no production impact)

- [ ] 🟡 **Apply the anon-lockdown migration** (`supabase/migrations/20260530180000_*.sql`): `supabase db push`. Then re-run `get_advisors(security)` + the verification query in the file (expect 0 anon-executable). *(DATA-07/08)*
- [ ] 🔴 **Flip the canonical host** — set `NEXT_PUBLIC_SITE_URL=https://ryan-realty.com` in **Vercel production env** (it's currently `https://ryanrealty.vercel.app`, which poisons canonicals, sitemap, FUB lead source, CAPI URL, and emails). Remove the two `vercel.app` email fallbacks (`lib/cma-request.ts`, `app/actions/auto-response.ts`). *(LAUNCH-02/03, ADS-03, FUNNEL-02)*
- [ ] 🔴 **Homepage verdict coherence + sitemap soft-404 fix** *(DATA-04/14, LAUNCH-11)*
- [ ] 🔴 **CONTENT-01 provenance gate + strip fabricated `/about` testimonials** *(DATA-16)*
- [ ] 🔴 **Green Lighthouse + a11y** (`/about` Speed Index) *(LAUNCH-08/09)*

**Gate before swapping:** `npm run ci:gates` green · `git status` clean · `npm run build` exit 0 · `npm run ci:legacy-redirects -- --strict` green.

## Phase C — The atomic swap (single window)

1. [ ] **Capture the AgentFire origin** from the Cloudflare DNS dashboard into `data/cutover-rollback.json` → `cloudflareDashboardRecords`. dig only shows Cloudflare edge IPs. *(LAUNCH-16)*
2. [ ] **Verify rollback target is live** and TTL is 300s (already is). AgentFire hosting stays paid through the window.
3. [ ] **Add `ryan-realty.com` + `www` to the Vercel `ryanrealty` project.**
4. [ ] **In the SAME window:** point Cloudflare DNS at Vercel (DNS-only / grey-cloud per Vercel), confirm `NEXT_PUBLIC_SITE_URL` is the apex, and re-point **Supabase Auth Site URL + Google OAuth redirect URIs** to the apex (so admin login / the approval queue don't break). *(LAUNCH-01/02/12)*
5. [ ] **Lift Vercel deployment protection** on the apex so users/crawlers don't hit 403. *(LAUNCH-07)*

## Phase D — Post-swap smokes (only provable after DNS; any fail → rollback)

> **Use a browser User-Agent** (`-A "Mozilla/5.0"`) — the site's bot-screen 403s curl's default UA.

- [ ] `curl -sI https://ryan-realty.com/ -A Mozilla` → Vercel headers, **no** `x-powered-by: AgentFire`. *(LAUNCH-01)*
- [ ] Home canonical + first sitemap `<loc>` host = `ryan-realty.com`. *(LAUNCH-02)*
- [ ] `curl -sIL https://ryan-realty.com/lp/seller-home-value -A Mozilla` → 200 with pixel + form (not 404). *(LAUNCH-06, ADS-01)*
- [ ] GA4 + GTM + Meta Pixel in prod HTML. *(LAUNCH-10)*
- [ ] Spot-check 5 legacy redirects 301→200 single-hop (e.g. `/free-home-valuation/`, `/testimonials/`, `/matt-ryan/`). *(LAUNCH-04)*
- [ ] **Synthetic seller-LP submit → FUB person** with canonical source tag (no vercel.app). *(FUNNEL-01)* **On fail → execute `data/cutover-rollback.json` rollback.**
- [ ] Re-point the Meta lead webhook to the apex; verify with a signed event. *(FUNNEL-06)*

## Phase E — Only then enable ads (site live ≠ ready to spend)

No ad may deliver until ALL are green:
- [ ] **Nurture is alive:** seller-tagged FUB people actually enrolled + running in an action plan (3,492 currently enrolled in zero). *(FUNNEL-04 — the business goal)*
- [ ] Attribution + snapshot crons scheduled in `vercel.json`; `marketing_channel_daily` fresh ≤48h; CPL computable. *(ADS-07/08, FUNNEL-07/09)*
- [ ] Synthetic CAPI `test_event` → `events_received ≥ 1`. *(ADS-06)*
- [ ] Retargeting Tier4/Tier5 audiences `approximate_count > 0`. *(ADS-11, FUNNEL-17)*
- [ ] Then unpause **one ad at a time**, watching CPL. *(ADS-18)*

---

## Rollback (keep within reach the whole window)
See `data/cutover-rollback.json`. One step: revert the Cloudflare apex+www records to the captured AgentFire values. TTL 300s → ~5 min propagation. Trigger on any Phase-D failure.

## Remaining build work (agent can do locally once unblocked)
`CONTENT-01` gate · homepage verdict/sitemap fix · `NEXT_PUBLIC_SITE_URL` code + grep gate · FUB tag→enroll bridge · attribution/snapshot cron wiring. Tracked in the session task list (#6, #8, #11, #13).

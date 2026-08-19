# Cutover agent prompts

Copy-paste prompts for a browser-capable agent (Claude Desktop). Drives YOUR
authenticated browser — be logged into Vercel, Cloudflare, Supabase, Google Cloud
Console, and Meta Business first. Companion: `docs/CUTOVER_RUNBOOK.md`,
`data/cutover-rollback.json`.

---

## 1) THE SWAP (run this to do the cutover)

```
You are executing the production domain cutover for Ryan Realty: switching the live
site at ryan-realty.com from the legacy AgentFire/WordPress site to the new Next.js
app already deployed on Vercel (project "ryanrealty", currently at
ryanrealty.vercel.app). This is a high-stakes, business-critical change. Move
carefully, confirm with me before every irreversible step, and STOP + roll back on
any failed check. Do not improvise beyond these instructions.

CONTEXT YOU NEED
- The new site is built, gate-green, and live on https://ryanrealty.vercel.app (it
  works; it's just not on the apex yet).
- The apex ryan-realty.com currently serves AgentFire (HTTP 200, header
  x-powered-by: AgentFire.com), proxied through Cloudflare.
- DNS is managed in CLOUDFLARE (nameservers eva.ns.cloudflare.com /
  jeff.ns.cloudflare.com). Current apex + www A records point at Cloudflare proxy
  IPs 104.21.28.38 and 172.67.144.15, TTL 300. Do NOT raise the TTL.
- A full runbook lives in the repo at docs/CUTOVER_RUNBOOK.md and a rollback
  artifact at data/cutover-rollback.json. Read them if you have filesystem access.
- The site bot-screens non-browser user agents, so test by actually BROWSING (your
  real browser), not curl.

HARD RULES
- Capture rollback state BEFORE changing any DNS record.
- Do NOT cancel, pause, or unpublish the AgentFire site/hosting — it's the rollback
  target and must stay live for 48h after cutover.
- Do NOT touch Meta ad campaigns (leave them paused).
- Never paste, screenshot, or store secret keys/tokens anywhere.
- Confirm with me before: applying the DB migration, changing DNS, and lifting
  deployment protection.

=== PHASE A — Pre-flight (no production impact) ===
1. In Vercel -> project "ryanrealty" -> confirm the latest production deployment is
   Ready and the build is green.
2. In Vercel -> Settings -> Environment Variables (Production): confirm/set
   NEXT_PUBLIC_SITE_URL = https://ryan-realty.com   (it's currently the vercel.app
   host — this is THE master cutover variable). If you change it, you must redeploy
   so it takes effect. Do not deploy yet — bundle it with Phase C.

=== PHASE B — Close the security hole + capture rollback ===
3. SECURITY MIGRATION: the repo has supabase/migrations/
   20260530180000_revoke_anon_execute_admin_functions.sql, which revokes anonymous
   EXECUTE on ~28 admin/mutation DB functions. Open it, show me the SQL, and ask me
   to confirm. On my OK, apply it (Supabase Dashboard -> SQL Editor -> paste + run,
   OR have me run `supabase db push`). Then in Supabase -> Advisors -> Security,
   confirm the anon-executable findings are gone. If anything on the site breaks in
   a later smoke test, this is a suspect — note it.
4. ROLLBACK CAPTURE: In Cloudflare -> DNS, record the EXACT current apex + www
   records (type, name, content/target, proxy on/off, TTL). Save them verbatim into
   data/cutover-rollback.json under "cloudflareDashboardRecords" (or paste them to
   me). dig only shows edge IPs — I need the dashboard values to revert.
5. Confirm the AgentFire origin is still serving (browse https://ryan-realty.com —
   it should still be the old site right now) so the rollback target is alive.

=== PHASE C — The atomic swap (CONFIRM WITH ME FIRST) ===
6. In Vercel -> project "ryanrealty" -> Settings -> Domains: add ryan-realty.com AND
   www.ryan-realty.com. Vercel will show the exact DNS records it wants.
7. Trigger a fresh production deploy carrying NEXT_PUBLIC_SITE_URL=https://ryan-realty.com.
8. AUTH (do in the same window so admin login never breaks):
   - Supabase -> Authentication -> URL Configuration: set Site URL to
     https://ryan-realty.com and ensure the redirect allow-list includes
     https://ryan-realty.com/auth/callback and https://ryan-realty.com/api/auth/callback.
   - Google Cloud Console -> APIs & Services -> Credentials -> the OAuth 2.0 client:
     add https://ryan-realty.com to authorized origins and the two callback URLs
     above to authorized redirect URIs.
9. DNS FLIP (the irreversible public moment — CONFIRM WITH ME, then): in Cloudflare,
   change the apex + www records to the values Vercel specified in step 6 (typically
   apex A 76.76.21.21 and www CNAME cname.vercel-dns.com — USE WHAT VERCEL SHOWS).
   Set them to DNS-only / grey-cloud as Vercel recommends. Keep TTL 300.
10. In Vercel, confirm the domains show "Valid Configuration." Lift any Vercel
    Deployment Protection on the production domain so real users/crawlers aren't 403'd.

=== PHASE D — Post-swap smokes (browse these; any failure -> Phase E rollback) ===
11. Browse https://ryan-realty.com/ -> must be the NEW Next.js site, NOT AgentFire.
12. Browse https://ryan-realty.com/lp/seller-home-value -> loads with the seller form
    (not a 404).
13. Spot-check 3 legacy redirects resolve to a real page (302/301 -> 200):
    /free-home-valuation/ , /testimonials/ , /matt-ryan/
14. Submit a TEST lead on the seller LP (use an obviously-test name + your email).
    Then check `/admin/crm`: a new `crm_people` row should appear, tagged with a seller
    source (and the source must say ryan-realty.com, not vercel.app).
15. Confirm GA4 + Meta Pixel fire on the homepage (browser devtools / Meta Pixel
    Helper).
16. Re-point the Meta lead-webhook callback URL to
    https://ryan-realty.com/api/meta/lead-webhook (Meta App -> Webhooks).

=== PHASE E — Rollback (only if a Phase-D check fails) ===
17. In Cloudflare, revert the apex + www records to the captured pre-cutover values
    (re-enable the orange-cloud proxy to AgentFire). TTL 300 -> propagates in ~5 min.
    Confirm https://ryan-realty.com is the old AgentFire site again. Tell me exactly
    what failed.

DO NOT enable/unpause any Meta ads as part of this — ad re-activation is a separate
later step that depends on nurture + attribution being verified.

Report progress after each phase and wait for my confirmation before Phases B-step-3,
C, and the step-9 DNS flip.
```

---

## 2) POST-SWAP SMOKE TEST (re-runnable verification)

```
You are verifying the Ryan Realty production site immediately after a domain cutover
(ryan-realty.com was just switched from the old AgentFire site to the new Next.js app
on Vercel). Browse each item in a real browser (the site 403s non-browser agents).
Report PASS/FAIL per line; if any critical item FAILS, say so loudly and recommend
rolling back the Cloudflare DNS change.

CRITICAL (a fail here = roll back):
1. Load https://ryan-realty.com/ -> it must be the NEW site (modern Next.js design),
   NOT the old AgentFire site. In devtools, the response header must NOT contain
   "x-powered-by: AgentFire".
2. Load https://ryan-realty.com/lp/seller-home-value -> the seller home-value form
   renders (multi-step, not a 404 / "page not found").
3. Submit a TEST lead on that seller LP (test name + your own email). Then open
   `/admin/crm` -> confirm a new `crm_people` row appeared within ~1 min, tagged with a seller
   source, and the source/URL says ryan-realty.com (NOT vercel.app).

SEO + TRACKING:
4. Legacy redirects — browse each; each should 301/302 to a real working page (200):
   https://ryan-realty.com/free-home-valuation/
   https://ryan-realty.com/testimonials/
   https://ryan-realty.com/matt-ryan/
   https://ryan-realty.com/vip-home-search/
5. View source of the homepage -> the <link rel="canonical"> and og:url must use
   https://ryan-realty.com (not vercel.app).
6. GA4 + Meta Pixel fire on the homepage (use the Meta Pixel Helper extension and/or
   check the network tab for collect/gtag + facebook fbevents).
7. Open /sitemap.xml -> first few <loc> entries use ryan-realty.com, and a couple of
   sampled listing URLs load a real listing (no "listing not found").

Summarize as a checklist with PASS/FAIL and one line on anything that failed.
```

---

## 3) NURTURE LOOP — FUNNEL-04

CRM is in-house. Do not build toward the in-house CRM. Live nurture is `lib/crm/enroll.ts`
and `/admin/crm/sequences`. Archive: `lib/crm/send-event.ts`.

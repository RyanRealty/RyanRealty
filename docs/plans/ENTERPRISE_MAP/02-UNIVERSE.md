# Closed universe — seed counts and planes

Generated/seeded 2026-08-08. **Not a finished matrix.** This defines the universe the matrix must eventually cover.

## Plane 1 — Product (code surfaces)

| Slice | Generator / source | Count | Notes |
|-------|-------------------|-------|--------|
| Public pages | `A-routes.txt` | 296 | Every `app/**/page.tsx` path |
| Admin pages | `B-admin-routes.txt` | 170 | Includes redirects/stubs; token-gate subset smaller |
| App segments | `J-app-segments.txt` | 72 | Top-level under `app/` |
| DAL domains | `G-dal-domains.txt` | 44 | `lib/data/*` |
| Lib domains | `I-lib-domains.txt` | 36 | `lib/*` |
| Skills | `L-skills.txt` | 119 | SKILL.md paths across trees |

**Major product systems (must each get matrix rows — not just “site”):**  
Public web · Search/map · Listing detail · Geo/KB · Market reports · LPs · Consumer account · Broker public pages · Admin OS · CRM · TC · CMA/BPO · Prospecting (expired/FSBO) · Newsletter · Marketing brain · Ads plumbing · Broker SMS agent · DSCR · Design systems (public + admin) · Voice · Portal/auth  

## Plane 2 — Integrations (env + runtime)

| Slice | Source | Count | Notes |
|-------|--------|-------|--------|
| Env keys | `D-env-keys.txt` | 117 | Names only |
| Cron on disk | `C-crons-on-disk.txt` | 80 | |
| Cron vercel | `C-crons-vercel.json` | 59 unique | |
| Dark crons | `C-crons-dark.txt` | 21 | Includes fan-out snapshots; not all “broken” |

**Integration families (each needs health + authority row):**  
Supabase · Spark · Twilio · Resend · Google SA/Gmail · GA4/GTM · Meta (page/IG/CAPI/ads) · GBP · LinkedIn · TikTok · YouTube · X · Threads · Nextdoor · SkySlope · ElevenLabs · Apify · Maps · OpenAI/Anthropic/xAI · Stock/media APIs · RentCast · SchoolDigger · NeverBounce · BatchData · Upstash · Sentry · Vercel · FUB (LEGACY keys) · Inngest · VAPID · Replicate/Fal/Synthesia  

**OAuth tables (live probe 2026-08-08):**  
tiktok/youtube/linkedin/x/gbp: rows present · threads/nextdoor/pinterest: empty  

## Plane 3 — Development factory

| Slice | Source | Count |
|-------|--------|-------|
| GitHub workflows | `E-github-workflows.txt` | 10 |
| ci:* scripts | `H-ci-scripts.txt` | 270 |
| Plan packages | `F-plans-packages.txt` | 5 |
| Plan top files | `F-plans-top.txt` | 44 |
| Migrations | `K-migration-count.txt` | (file) |

**Factory systems (matrix rows):**  
GitHub Actions · local hooks (pre-commit/push) · Vercel build/ignore/crons/env · Supabase hosted + migrations + parity · npm script surface · agent tooling (Claude Code, Grok Build, memory, skills) · quality gates · deploy verify · worktree/push cost discipline  

## Plane 4 — Plans / intent archive

See `01-PLAN-DISPOSITIONS.md` — every ID P-*, A-*, C-*, G-*, D-*, M-*, T-*, V-*, R-*, $* is a universe row.

## Plane 5 — Live data anchors (re-verify; not static)

| Anchor | Approx (2026-08-08 probe) |
|--------|---------------------------|
| listings | ~594,616 |
| listing_history | ~3.9M |
| market_pulse_live | 45 |
| market_stats_cache | ~12,995 (mostly methodology v3) |
| crm_people | ~22,977 |
| marketing_brain_actions | ~651 (ready-heavy, measured~0) |
| brokers | 3 |
| cmas | 266 |
| expired_listings | 247 |
| boundaries | ~3,312 |

## Concurrent ACTIVE subject (not the whole universe)

| Subject | Owner session | Paths |
|---------|---------------|--------|
| Admin 11F / crm/inbox | Claude Code | `app/admin/**/crm/inbox/**`, some `components/admin/v2/**` |

Enterprise Map must **record** that subject as ACTIVE admin work without editing those files from this effort.

## Completeness definition (mechanical)

Universe closed for synthesis only when:

1. Every inventory file has a corresponding matrix fill job status.  
2. Every plan disposition ID has non-SEED evidence or explicit UNKNOWN.  
3. Every integration family has authority + health.  
4. Adversary pass finds zero high-severity omissions.  
5. Advancement plan cites only matrix/disposition IDs.

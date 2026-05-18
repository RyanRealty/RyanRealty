# Phase 4.5 env-manifest-log

started_at: 2026-05-17T01:55:00Z
finished_at: 2026-05-17T02:09:07Z

## Var count by category

| Category | Total | Set | Unset / missing |
|---|---|---|---|
| A. Anthropic + AI | 9 | 7 | 2 |
| B. Platform OAuth | 38 | 20 | 18 |
| C. MLS + Data | 12 | 6 | 6 |
| D. Supabase | 3 | 3 | 0 |
| E. Email | 6 | 2 | 4 |
| F. Video / Audio | 10 | 8 | 2 |
| G. Maps | 6 | 4 | 2 |
| H. CRM | 11 | 9 | 2 |
| I. Cron auth | 1 | 1 | 1 (needs strength verification) |
| J. Admin UI auth | 12 | 10 | 2 |
| K. Apify | 1 | 1 | 0 |
| L. AgentFire WP | 5 | 0 | 5 |
| M. Buffer | 9 | 0 | 9 |
| N. Analytics | 11 | 9 | 2 |
| O. xAI + Synthesia + Apollo | 4 | 2 | 2 |
| P. Infrastructure | 9 | 6 | 3 |
| **Total** | **107** | **88** | **60** |

## Unset or action-required count: 34 distinct [ACTION REQUIRED] items

Items that block Phase 10 smoke test (newsletter canary): 4
- RESEND_FROM (Resend domain verification required)
- MARKETING_DIGEST_EMAIL (unset, needed for digest delivery)
- MARKETING_DASHBOARD_BASE_URL (unset, needed for digest links)
- CRON_SECRET (needs strength verification)

Items that block live production: 27

## Method

1. Read `.env.local` extracting var names only (no values).
2. Grep'd `app/`, `lib/`, `scripts/`, `marketing_brain_skills/`, `social_media_skills/`, `video_production_skills/`, `automation_skills/` for `process.env.*` and Python env references.
3. Read `vercel.json` cron entries and mapped each cron to its env dependencies.
4. Read `.env.local` comments for status, expiry, and verification notes.
5. Read `lib/buffer.ts`, `lib/resend.ts`, `lib/followupboss.ts`, `lib/tiktok.ts`, `lib/linkedin.ts`, `lib/youtube.ts`, `lib/marketing-brain/` for producer-level env usage.
6. Read `app/api/cron/token-heartbeat/route.ts` to understand OAuth token storage model (Supabase `oauth_tokens` table vs env vars).

## Blockers encountered

None. All data sources were readable. No ambiguous env vars required external API calls to resolve.

## Token cost

Estimated: standard Sonnet 4.6 session. No API calls made to external services.

## Notes

- Platform access tokens for X, LinkedIn, YouTube, Threads, TikTok, and Pinterest are stored in Supabase `oauth_tokens` table (populated via OAuth flows), not as env vars. This is correct architecture.
- Two WP AgentFire naming conventions exist in the codebase (`WP_AGENTFIRE_*` vs `AGENTFIRE_WP_*`). Should be consolidated.
- TikTok is sandbox-only until production app review is re-submitted and approved.
- Mapbox is deprecated and commented out.
- Apollo has no env var in this repo; uses MCP-level credentials.

# Integration matrix (SEED)

Authority: **SoR** system of record · **Mirror** secondary · **Runtime** executes · **Legacy** present but not authority · **Optional** · **Unknown**

| ID | System | Env evidence | Code/runtime | Live signal (2026-08-08) | Authority | Health SEED | Notes |
|----|--------|--------------|--------------|--------------------------|-----------|-------------|-------|
| INT-001 | Supabase | URL + anon + service role | entire app | listings 594619 etc. | SoR (app data) | green (reachable) | Project dwvlophlbvvygjfxcrhm |
| INT-002 | Spark MLS | SPARK_API_* | sync crons | inventory large | SoR (MLS feed) | needs freshness Sense | |
| INT-003 | Vercel | CRON_SECRET | host + crons | production deploys | Runtime | needs deploy Sense | Build CPU cost constraint |
| INT-004 | Twilio | multi SID + per-broker numbers | SMS/voice APIs | configured | Runtime comms | needs send health | |
| INT-005 | Resend | RESEND_* | email | email_events n=564; latest 2026-08-08 | Runtime email | **events live** | | |
| INT-006 | Google SA / Gmail | GOOGLE_SERVICE_ACCOUNT_* | gmail sync | configured | Runtime mail | | |
| INT-007 | Meta | META_CAPI_* + pixel | webhooks CAPI ads | audience log n=64; last LIVE **2026-06-23** | Runtime ads/social | **STALE heartbeat** | Spend Matt-gated; re-run audience cron |
| INT-008 | GA4 / GTM | measurement + API secret | analytics | configured | Mirror analytics | | |
| INT-009 | GBP | GOOGLE_BUSINESS_PROFILE_* | snapshots + auth table | auth n=1; expires **EXPIRED** 2026-08-08 | Runtime local | **token EXPIRED** | Refresh OAuth | |
| INT-010 | LinkedIn | client + auth n=1 | publish paths | expires **EXPIRED** 2026-07-09 | Runtime social | **token EXPIRED** | Reconnect required | |
| INT-011 | TikTok | client + auth n=1 | | expires **VALID** until 2026-08-09 | Runtime social | **token OK (short)** | Auto-refresh watch | |
| INT-012 | YouTube | client + auth n=1 | | expires **EXPIRED** 2026-08-08 | Runtime social | **token EXPIRED** | Reconnect | |
| INT-013 | X | client + auth n=1 | | expires **EXPIRED** 2026-08-08 | Runtime social | **token EXPIRED** | Reconnect | |
| INT-014 | Threads | THREADS_CLIENT_ID | auth n=0 | **not connected** | Optional | **dark** | Park or connect | |
| INT-015 | Nextdoor | no client key in .env.local | auth n=0 | dark | Optional | **dark** | Park or connect | |
| INT-016 | Pinterest | table; no client key found | auth n=0 | dark | Optional | **dark** | Park or connect | |
| INT-017 | SkySlope | keys present | TC + skyslope_transactions | n=33; sample synced_at **2026-06-10** | Mirror/workflow | **STALE sync** | Strangler; refresh mirror |
| INT-018 | Follow Up Boss | FOLLOWUPBOSS_* in .env.local | residual code/docs | cutover claimed 2026-06-24 | **Legacy** | residue | Must not be SoR |
| INT-019 | ElevenLabs | API + Victoria voice | VO pipeline | configured | Runtime creative | | |
| INT-020 | Apify | token | FSBO etc. | configured | Runtime scrape | | |
| INT-021 | OpenAI | key | AI features | configured | Runtime AI | | |
| INT-022 | Anthropic | key | AI features | configured | Runtime AI | | |
| INT-023 | xAI | XAI_API_KEY | Grok | configured | Runtime AI | | |
| INT-024 | Google Maps | NEXT_PUBLIC + remotion key | maps | configured | Runtime maps | | |
| INT-025 | Upstash Redis | REST url/token | cache | configured | Runtime | | |
| INT-026 | Sentry | DSN | monitoring | configured | Runtime | | |
| INT-027 | RentCast | key | DSCR rents | configured | Runtime data | | |
| INT-028 | SchoolDigger | keys | school pages | configured | Runtime data | | |
| INT-029 | NeverBounce | key | email validate | configured | Runtime | | |
| INT-030 | BatchData | key | enrichment | configured | Runtime | | |
| INT-031 | Stock media | Pexels/Unsplash/Shutterstock | creative | configured | Runtime | | |
| INT-032 | Gen media | Replicate/Fal/Synthesia | creative | configured | Runtime | | |
| INT-033 | VAPID | keys | web push | configured | Runtime | | |
| INT-034 | Inngest | keys | lib/inngest.ts | configured | Runtime? | **depth UNKNOWN** | Confirm if production jobs use it | |
| INT-035 | Google OAuth / CrUX | keys | APIs | configured | Runtime | | |
| INT-036 | AdSense | public client id | ads | configured | Optional | | |

## Cron wiring note

21 top-level cron dirs not named as first segment in vercel.json paths: see `inventories/C-crons-dark.txt`.  
**Known nuance:** marketing-snapshot-* often fanned out by a parent cron — adversary must classify true-orphan vs fan-out child before calling them broken.

## Required health Sense fields

For each INT: last_success_at · error_rate · token_expiry · authority_ok · owner_loop

**2026-08-08T20:55Z partial fill:** social token_expiry filled for INT-009…016; Meta audience last_success; SkySlope sample synced_at; Resend email_events latest; others still SEED.

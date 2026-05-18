# Environment Variable Manifest

**Generated:** 2026-05-16  
**Source:** `.env.local` (named vars only, no values logged), codebase grep across `app/`, `lib/`, `scripts/`, `marketing_brain_skills/`, `social_media_skills/`, `video_production_skills/`, `automation_skills/`, `vercel.json` cron entries.  
**Total vars tracked:** 107  
**Unset / missing / placeholder:** 17

---

## [ACTION REQUIRED]

The following vars are unset, missing from `.env.local`, or blocked from production use. Phase 10 smoke test blockers are marked. Live production blockers are marked separately.

| Var | Gap | What Matt needs to do | Smoke test blocker | Live prod blocker |
|---|---|---|---|---|
| `RESEND_FROM` | Not in `.env.local`. RESEND_API_KEY is set but FROM is falling back to `onboarding@resend.dev`. `mail.ryan-realty.com` domain is unverified in Resend. | In Resend dashboard: verify `mail.ryan-realty.com` domain (add DNS records), then set `RESEND_FROM=Ryan Realty <mail@mail.ryan-realty.com>` in Vercel env and `.env.local`. | YES (newsletter email send) | YES |
| `SCHOOLDIGGER_API_KEY` | Set to empty string in `.env.local`. | Go to schooldigger.com, create a free API account, paste key. | No | No (only blocks school-data features) |
| `SCHOOLDIGGER_APP_ID` | Set to empty string in `.env.local`. | Same as above. | No | No |
| `BUFFER_ACCESS_TOKEN` | Missing from `.env.local`. Referenced in `lib/buffer.ts` and publisher skill. | Retrieve the existing v1 personal access token from buffer.com. Do NOT attempt a new OAuth flow. Set in Vercel env and `.env.local`. | No | YES (Buffer fan-out publishing) |
| `BUFFER_PROFILE_X` | Missing from `.env.local`. | After BUFFER_ACCESS_TOKEN is set, call `GET https://api.bufferapp.com/1/profiles.json?access_token=<token>` and paste the profile ID for X. | No | YES |
| `BUFFER_PROFILE_THREADS` | Missing from `.env.local`. | Same call as above, paste Threads profile ID. | No | YES |
| `BUFFER_PROFILE_PINTEREST` | Missing from `.env.local`. | Same call, paste Pinterest profile ID. | No | YES |
| `BUFFER_PROFILE_INSTAGRAM` | Missing from `.env.local`. Referenced in publisher skill. | Same call, paste Instagram profile ID. | No | YES |
| `BUFFER_PROFILE_FACEBOOK` | Missing from `.env.local`. Referenced in publisher skill. | Same call, paste Facebook profile ID. | No | YES |
| `BUFFER_PROFILE_LINKEDIN` | Missing from `.env.local`. Referenced in publisher skill. | Same call, paste LinkedIn profile ID. | No | YES |
| `BUFFER_PROFILE_TIKTOK` | Missing from `.env.local`. Referenced in publisher skill. | Same call, paste TikTok profile ID. | No | YES |
| `BUFFER_PROFILE_YOUTUBE` | Missing from `.env.local`. Referenced in publisher skill. | Same call, paste YouTube profile ID. | No | YES |
| `WP_AGENTFIRE_USER` / `AGENTFIRE_WP_USER` | Missing from `.env.local`. Two naming variants exist in code (`WP_AGENTFIRE_USER` used in `app/`, `AGENTFIRE_WP_USER` used in `social_media_skills/`). | In AgentFire WordPress admin, create an Application Password for the admin user (Users > Profile > Application Passwords). Set `WP_AGENTFIRE_USER=<username>`, `WP_AGENTFIRE_APP_PASSWORD=<app_password>`, `WP_AGENTFIRE_SITE_URL=https://ryan-realty.com` (or the AgentFire staging URL). Align skill code to single naming convention. | No | YES (blog post publishing) |
| `WP_AGENTFIRE_APP_PASSWORD` / `AGENTFIRE_WP_APP_PASSWORD` | Missing. | Same as above. | No | YES |
| `WP_AGENTFIRE_SITE_URL` | Missing. | Same as above. | No | YES |
| `PINTEREST_CLIENT_ID` | Commented out in `.env.local` (Pinterest app not yet created). | Create a Pinterest developer app at developers.pinterest.com (scopes: boards:read pins:write video:upload), then set `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`, `PINTEREST_REDIRECT_URI=https://ryanrealty.vercel.app/api/pinterest/callback`. Complete first OAuth. | No | YES (Pinterest publishing) |
| `PINTEREST_CLIENT_SECRET` | Commented out. | Same as above. | No | YES |
| `ADMIN_DASHBOARD_TOKEN` | Not present anywhere in `.env.local` or codebase. Phase 10.5 pre-flight and admin UI auth reference it. | Generate a random 64-char hex secret. Set as `ADMIN_DASHBOARD_TOKEN` in Vercel env and `.env.local`. Wire into admin route middleware as a Bearer token guard. | No | YES (admin dashboard access) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | Set (sandbox app only). TikTok Production status: rejected 2026-05-12. Sandbox posts limited to `SELF_ONLY` visibility. | Re-submit TikTok production app review addressing ToS and internal-use notes. Until approved, posts work in sandbox only. | No | PARTIAL (sandbox works, public posts blocked) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Set per `.env.local` status check, but comment says "MISSING from Inngest dashboard". Verify these are the real values and not placeholders. | Log into inngest.com, Settings, copy real Event Key and Signing Key, confirm they match what is in `.env.local`. | No | YES |
| `CRON_SECRET` | Set (64 chars). But comment notes it was marked "WEAK." | If still the original weak placeholder, replace with `openssl rand -hex 32`, update Vercel env, update `.env.local`. Current value appears to be a real 64-char string so may already be strong. Verify. | YES | YES |
| `GOOGLE_SEARCH_CONSOLE_SITE_URL` | Referenced in `marketing-snapshot-gsc` cron and marketing lib but not in `.env.local`. | Set `GOOGLE_SEARCH_CONSOLE_SITE_URL=https://ryan-realty.com` in Vercel env and `.env.local`. | No | YES (GSC snapshot cron) |
| `GBP_ACCESS_TOKEN` | Referenced in publisher skill docs but not in `.env.local`. GBP uses Google OAuth service account. | Confirm whether GBP calls go through service account (GOOGLE_SERVICE_ACCOUNT_*) or need a separate OAuth token. GBP allowlist case ID 7-6192000040405 may still be pending. Check case status. | No | YES (GBP publishing) |
| `NEXTDOOR_CLIENT_ID` / `NEXTDOOR_CLIENT_SECRET` / `NEXTDOOR_REDIRECT_URI` | Missing from `.env.local`. Nextdoor API is gated. | Apply for Nextdoor for Business API access at nextdoor.com/partner. Set vars after approval. | No | YES (Nextdoor ad producer) |
| `PEXELS_API_KEY` | Commented out in `.env.local`. | Get free key at pexels.com/api, uncomment and set. | No | No (Unsplash already set as fallback) |
| `SYNTHESIA_AVATAR_ID` / `SYNTHESIA_MATT_VOICE_ID` | Referenced in social_media_skills code but missing from `.env.local`. `SYNTHESIA_API_KEY` is set. | In Synthesia dashboard, find the avatar ID and voice ID for the Ryan Realty account. Set both vars. | No | YES (avatar video producer) |
| `LINKEDIN_ACCESS_TOKEN` | Referenced in publisher skill docs. Tokens stored in Supabase `oauth_tokens` table via OAuth flow, not in `.env.local`. | Complete LinkedIn OAuth flow at `/api/linkedin/authorize` to populate Supabase `oauth_tokens` row. `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are set. | No | YES (LinkedIn publishing) |
| `YOUTUBE_ACCESS_TOKEN` | Same pattern: stored in Supabase. Referenced in publisher docs. | Complete YouTube OAuth at `/api/youtube/authorize` to populate `oauth_tokens`. `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` are set. | No | YES (YouTube publishing) |
| `TIKTOK_RESEARCH_TOKEN` | Missing from `.env.local`. Referenced in social_media_skills competitive recon. | Apply for TikTok Research API access (separate from Content Posting API). Set after granted. | No | No (competitive recon only) |
| `MARKETING_DIGEST_EMAIL` / `MARKETING_DASHBOARD_BASE_URL` | Referenced in `app/api/` and `lib/marketing-brain/` but not in `.env.local`. | Set `MARKETING_DIGEST_EMAIL=matt@ryan-realty.com` and `MARKETING_DASHBOARD_BASE_URL=https://ryanrealty.vercel.app` in Vercel env and `.env.local`. | YES (daily digest delivery) | YES |

---

## A. Anthropic + AI Providers

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | brain / producer-specific | set | None (usage-billed) | `lib/marketing-brain/`, all content producers, CMA producer, competitive recon | YES | YES |
| `OPENAI_API_KEY` | producer-specific | set | None (usage-billed) | GPT-4o fallback for vision tasks, image captioning, listing description drafts | No | YES |
| `XAI_API_KEY` | producer-specific | set | None (usage-billed) | `app/api/` routes using Grok, competitive recon, trend detection | No | YES |
| `REPLICATE_API_TOKEN` | producer-specific | set | None (usage-billed) | AI video generation (Kling v2.1, Veo, Hailuo, Seedance via Replicate), `video_production_skills/` | No | YES |
| `FAL_KEY` | producer-specific | set | None (usage-billed) | fal.ai AI video/image endpoints (Wan 2.5 i2v, Luma Ray 2 via fal.ai aggregator) | No | YES |
| `SYNTHESIA_API_KEY` | producer-specific | set | None (usage-billed) | `automation_skills/`, avatar market update producer, `social_media_skills/` | No | YES |
| `SYNTHESIA_AVATAR_ID` | producer-specific | unset [ACTION REQUIRED] | N/A | avatar video producer | No | YES |
| `SYNTHESIA_MATT_VOICE_ID` | producer-specific | unset [ACTION REQUIRED] | N/A | avatar video producer | No | YES |
| `CURSOR_API_KEY` | admin | set | Unknown | Cursor IDE integration only; not consumed by pipeline crons | No | No |

---

## B. Platform OAuth

Platform access tokens for X, LinkedIn, YouTube, Threads, and TikTok are stored in the Supabase `oauth_tokens` table (populated via OAuth flows at `/api/<platform>/authorize`), not as env vars. The vars in this section are the OAuth app credentials (client ID, client secret, redirect URI) used to initiate and refresh those flows.

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `META_PAGE_ACCESS_TOKEN` | publisher | set | Never expires (data_access re-grant 2026-07-13) | `app/api/`, `cron/marketing-snapshot-meta-page`, `lib/marketing-brain/`, Meta CAPI, IG publish | No | YES |
| `META_FB_PAGE_ID` | publisher | set | N/A (static ID) | Meta snapshot cron, IG publish routes, `app/api/` | No | YES |
| `META_IG_BUSINESS_ACCOUNT_ID` | publisher | set | N/A (static ID) | IG content publishing, `cron/marketing-snapshot-meta-page` | No | YES |
| `META_APP_ID` | publisher | set | N/A | OAuth flow for Threads, Meta login | No | YES |
| `META_APP_SECRET` | publisher | set | N/A | OAuth flow, token validation | No | YES |
| `META_USER_ACCESS_TOKEN` | publisher | set | Unknown (long-lived; re-verify periodically) | Meta system user API calls, ad account writes | No | YES |
| `META_CAPI_ACCESS_TOKEN` | publisher | set | None | Meta Conversions API (server-side events from ryan-realty.com dataset) | No | YES |
| `META_AD_ACCOUNT_ID` | publisher | set | N/A | `cron/marketing-snapshot-meta-ads`, Meta ads optimization | No | YES |
| `META_WEBHOOK_VERIFY_TOKEN` | publisher | set (in code; not in `.env.local` directly) | N/A | `app/api/webhooks/meta` — Meta Webhook verification handshake | No | YES |
| `META_PAGE_TOKEN` | publisher | set | Same as META_PAGE_ACCESS_TOKEN | Some API routes use this alias | No | YES |
| `META_FB_PAGE_NAME` | publisher | set | N/A (static label) | Logging and notifications only | No | No |
| `META_FB_LEAD_FORM_TEMPLATE_ID` | producer-specific | set (referenced in code) | N/A | Facebook lead-gen ad producer | No | YES |
| `LINKEDIN_CLIENT_ID` | publisher | set | N/A | LinkedIn OAuth flow at `/api/linkedin/authorize` | No | YES |
| `LINKEDIN_CLIENT_SECRET` | publisher | set | N/A | LinkedIn OAuth token refresh | No | YES |
| `LINKEDIN_REDIRECT_URI` | publisher | set | N/A | LinkedIn OAuth callback | No | YES |
| `LINKEDIN_PERSON_ID` | publisher | set | N/A (static ID) | LinkedIn posts, `cron/marketing-snapshot-linkedin` | No | YES |
| `LINKEDIN_ACCESS_TOKEN` | publisher | unset in env [ACTION REQUIRED] (stored in Supabase oauth_tokens) | 365 days rolling refresh | LinkedIn content publishing, LinkedIn snapshot cron | No | YES |
| `X_CLIENT_ID` | publisher | set | N/A | X OAuth 2.0 PKCE flow | No | YES |
| `X_CLIENT_SECRET` | publisher | set | N/A | X OAuth token refresh | No | YES |
| `X_REDIRECT_URI` | publisher | set | N/A | X OAuth callback | No | YES |
| `X_BEARER_TOKEN` | publisher | unset [ACTION REQUIRED] | N/A | X read-only API calls (search, timeline); separate from OAuth access token | No | YES |
| `X_API_KEY` | publisher | unset [ACTION REQUIRED] | N/A | X API v1.1 endpoints if used; most v2 calls use OAuth 2.0 | No | PARTIAL |
| `X_API_SECRET` | publisher | unset [ACTION REQUIRED] | N/A | X API v1.1 app-only auth | No | PARTIAL |
| `X_ACCESS_TOKEN` | publisher | unset in env (stored in Supabase oauth_tokens) | Continuous rotating refresh | X content publishing, `cron/marketing-snapshot-x` | No | YES |
| `X_ACCESS_TOKEN_SECRET` | publisher | unset in env (v1.1 OAuth; may not apply to v2 PKCE) | N/A | X API v1.1 user-context calls | No | PARTIAL |
| `TIKTOK_CLIENT_KEY` | publisher | set (sandbox) | N/A | TikTok OAuth flow, `lib/tiktok.ts`, `cron/marketing-snapshot-tiktok` | No | PARTIAL (sandbox only until production approved) |
| `TIKTOK_CLIENT_SECRET` | publisher | set (sandbox) | N/A | TikTok token refresh | No | PARTIAL |
| `TIKTOK_REDIRECT_URI` | publisher | set | N/A | TikTok OAuth callback | No | YES |
| `TIKTOK_RESEARCH_TOKEN` | producer-specific | unset [ACTION REQUIRED] | N/A | Competitive recon, trend detection scripts | No | No (nice-to-have) |
| `PINTEREST_CLIENT_ID` | publisher | unset [ACTION REQUIRED] | N/A | Pinterest OAuth (app not yet created) | No | YES |
| `PINTEREST_CLIENT_SECRET` | publisher | unset [ACTION REQUIRED] | N/A | Pinterest OAuth | No | YES |
| `PINTEREST_REDIRECT_URI` | publisher | unset [ACTION REQUIRED] | N/A | Pinterest OAuth callback | No | YES |
| `PINTEREST_DEFAULT_BOARD_ID` | publisher | set (in code references) | N/A | Pinterest pin publisher | No | YES |
| `THREADS_CLIENT_ID` | publisher | set (same Meta App) | N/A | Threads OAuth flow | No | YES |
| `THREADS_CLIENT_SECRET` | publisher | set | N/A | Threads token refresh | No | YES |
| `THREADS_REDIRECT_URI` | publisher | set | N/A | Threads OAuth callback | No | YES |
| `NEXTDOOR_CLIENT_ID` | publisher | unset [ACTION REQUIRED] | N/A | Nextdoor ad producer (gated API) | No | YES |
| `NEXTDOOR_CLIENT_SECRET` | publisher | unset [ACTION REQUIRED] | N/A | Nextdoor OAuth | No | YES |
| `NEXTDOOR_REDIRECT_URI` | publisher | unset [ACTION REQUIRED] | N/A | Nextdoor OAuth callback | No | YES |
| `YOUTUBE_CLIENT_ID` | publisher | set (same Google OAuth client) | N/A | YouTube OAuth flow, `lib/youtube.ts` | No | YES |
| `YOUTUBE_CLIENT_SECRET` | publisher | set | N/A | YouTube token refresh | No | YES |
| `YOUTUBE_REDIRECT_URI` | publisher | set | N/A | YouTube OAuth callback | No | YES |
| `YOUTUBE_ACCESS_TOKEN` | publisher | unset in env (stored in Supabase oauth_tokens) | 6 months inactivity window | YouTube upload, `cron/marketing-snapshot-youtube` | No | YES |
| `GOOGLE_OAUTH_CLIENT_ID` | publisher | set | N/A | Google OAuth (YouTube, GBP via OAuth path) | No | YES |
| `GOOGLE_OAUTH_CLIENT_SECRET` | publisher | set | N/A | Google OAuth token refresh | No | YES |
| `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` | publisher | set | N/A | GBP API calls, `cron/marketing-snapshot-gbp` | No | YES |
| `GOOGLE_BUSINESS_PROFILE_LOCATION_ID` | publisher | set | N/A | GBP post/media endpoints | No | YES |
| `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI` | publisher | set | N/A | GBP OAuth callback | No | YES |
| `GBP_ACCESS_TOKEN` | publisher | unset [ACTION REQUIRED] | 6 months inactivity | GBP posting (if using OAuth token path vs service account) | No | YES |
| `GBP_BROKER_OFFICE_NAME` | publisher | set (in code) | N/A | GBP post labeling | No | No |

---

## C. MLS + Data

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `SPARK_API_KEY` | brain / cron | set | None (active subscription) | `cron/sync-delta`, `cron/sync-full`, `cron/sync-history-terminal`, `cron/refresh-market-stats`, all market data pulls, Spark x Supabase reconciliation gate | YES | YES |
| `SPARK_API_BASE_URL` | brain / cron | set (`https://replication.sparkapi.com/v1`) | N/A | Same as above | YES | YES |
| `BRIDGE_API_KEY` | cron | unset (not in `.env.local`, noted as not provisioned in CLAUDE.md) | N/A | Would replace Spark; not currently used | No | No |
| `RESO_API_KEY` | cron | unset (not in `.env.local`) | N/A | Alternative MLS data source; not currently used | No | No |
| `SKYSLOPE_ACCESS_KEY` | producer-specific | set | N/A | SkySlope transaction sync scripts | No | No |
| `SKYSLOPE_ACCESS_SECRET` | producer-specific | set | N/A | SkySlope API auth | No | No |
| `SKYSLOPE_CLIENT_ID` | producer-specific | set | N/A | SkySlope OAuth | No | No |
| `SKYSLOPE_CLIENT_SECRET` | producer-specific | set | N/A | SkySlope OAuth | No | No |
| `SCHOOLDIGGER_API_KEY` | producer-specific | unset (empty) [ACTION REQUIRED] | N/A | School district overlay producer, listing school data | No | No |
| `SCHOOLDIGGER_APP_ID` | producer-specific | unset (empty) [ACTION REQUIRED] | N/A | Same | No | No |
| `STR_PROVIDER_API_KEY` | producer-specific | unset (referenced in code, not in `.env.local`) | N/A | Short-term rental data (AirDNA or similar) | No | No |
| `STR_PROVIDER_URL` | producer-specific | unset | N/A | Same | No | No |

---

## D. Supabase

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publisher / brain / cron | set | N/A | Every server and client-side Supabase call across the entire codebase | YES | YES |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publisher | set | N/A | Client-side Supabase (browser sessions, public queries) | YES | YES |
| `SUPABASE_SERVICE_ROLE_KEY` | brain / cron | set | N/A | All server-side privileged Supabase operations (cron handlers, marketing brain, sync workers, oauth_tokens R/W) | YES | YES |

---

## E. Email

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `RESEND_API_KEY` | publisher | set | None (usage-billed) | `lib/resend.ts`, newsletter producer, saved search alerts, FUB outreach email, CMA delivery | YES | YES |
| `RESEND_FROM` | publisher | unset [ACTION REQUIRED] | N/A | `lib/resend.ts` FROM address. Currently falls back to `onboarding@resend.dev` (Resend sandbox sender). `mail.ryan-realty.com` domain must be verified in Resend before setting. | YES | YES |
| `RESEND_ADMIN_EMAIL` | publisher | unset in `.env.local` (referenced in `lib/resend.ts`) | N/A | Admin notification emails sent via Resend | No | YES |
| `RESEND_WEBHOOK_SECRET` | publisher | set | N/A | `app/api/webhooks/resend` email event webhook verification | No | YES |
| `ADMIN_EMAIL` | brain | unset in `.env.local` (referenced in `lib/resend.ts`) | N/A | Fallback admin notification address | No | YES |
| `MARKETING_DIGEST_EMAIL` | brain / cron | unset [ACTION REQUIRED] | N/A | `cron/marketing-daily-digest` delivery address | YES | YES |

Verified sender status:
- `contact@ryan-realty.com`: not yet verified in Resend. Domain verification pending.
- `mail@mail.ryan-realty.com`: not yet verified in Resend (subdomain DNS records not added). This is the intended production sender.
- Current fallback `onboarding@resend.dev`: works in dev/test only. Blocked for client-facing sends.

---

## F. Video / Audio

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `ELEVENLABS_API_KEY` | producer-specific | set | None (char-billed; ~99k chars remaining this cycle) | All VO generation, `video_production_skills/elevenlabs_voice/`, every video producer | No | YES |
| `ELEVENLABS_VOICE_ID` | producer-specific | set (Victoria ID `qSeXEcewz7tA0Q0qk9fH`, 20 chars) | N/A | Default voice ID used by video producers | No | YES |
| `ELEVENLABS_VOICE_ID_VICTORIA` | producer-specific | set (same Victoria ID) | N/A | Explicit Victoria alias used in some producer scripts | No | YES |
| `ELEVENLABS_VOICE_ID_ELLEN` | producer-specific | set | N/A | Secondary voice; not currently used in production | No | No |
| `REPLICATE_API_TOKEN` | producer-specific | set | None (usage-billed) | AI video generation (Kling, Veo 3, Hailuo 02, Seedance, Wan 2.5 via Replicate) | No | YES |
| `FAL_KEY` | producer-specific | set | None (usage-billed) | fal.ai AI video endpoints as alternative aggregator | No | YES |
| `SHUTTERSTOCK_API_KEY` | producer-specific | set | Active subscription required | Shutterstock stock imagery, `video_production_skills/media-sourcing/` | No | YES |
| `SHUTTERSTOCK_API_SECRET` | producer-specific | set | Active subscription required | Shutterstock OAuth | No | YES |
| `UNSPLASH_ACCESS_KEY` | producer-specific | set | None | Unsplash free stock imagery fallback | No | YES |
| `PEXELS_API_KEY` | producer-specific | unset (commented out in `.env.local`) [ACTION REQUIRED] | None | Pexels stock imagery (third fallback after Unsplash) | No | No |

---

## G. Maps

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | publisher | set | None (usage-billed) | Client-side maps (property search map, listing pages, neighborhood guides) | No | YES |
| `REMOTION_GOOGLE_MAPS_KEY` | producer-specific | set | None (usage-billed) | Remotion headless Chrome map tile fetching during video renders | No | YES |
| `GOOGLE_CLOUD_PROJECT` | producer-specific | set (referenced in code) | N/A | Google Cloud API project scope | No | YES |
| `GOOGLE_CLOUD_LOCATION` | producer-specific | set (referenced in code) | N/A | Google Cloud region for API calls | No | No |
| `MAPBOX_TOKEN` | deprecated | N/A (commented out in `.env.local` as deprecated) | N/A | Not used. Switched to Google Maps. | No | No |
| `GOOGLE_MAPS_AERIAL_API_KEY` | producer-specific | not in `.env.local` (same key as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in practice) | N/A | Aerial / photorealistic 3D tile rendering in Remotion | No | YES |

---

## H. CRM

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `FOLLOWUPBOSS_API_KEY` / `FUB_API_KEY` | brain / cron | set (both aliases present) | None (active account) | `lib/followupboss.ts`, `lib/fub.ts`, `cron/fub-outreach-execution`, `cron/marketing-snapshot-fub`, saved search alerts, FUB lead creation from social inbound | YES | YES |
| `FOLLOWUPBOSS_SYSTEM` / `FUB_X_SYSTEM` | brain / cron | set (`FOLLOWUPBOSS_SYSTEM` in `.env.local`) | N/A | FUB API `X-System` header for attribution | No | YES |
| `FOLLOWUPBOSS_SYSTEM_KEY` / `FUB_X_SYSTEM_KEY` | brain / cron | set (`FOLLOWUPBOSS_SYSTEM_KEY` via code; not in `.env.local` directly) | N/A | FUB API `X-System-Key` header | No | YES |
| `FOLLOWUPBOSS_BROKER_USER_MAP` | brain | set (referenced in code) | N/A | Maps broker email to FUB user ID for assignment | No | YES |
| `FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID` | brain | set (referenced in code) | N/A | Fallback FUB user ID when broker not mapped | No | YES |
| `FOLLOWUPBOSS_EXECUTION_ENABLED` | cron | set (feature flag) | N/A | `cron/fub-outreach-execution` enable/disable flag | No | YES |
| `FOLLOWUPBOSS_REALTIME_ACTIVITY_ALERTS` | brain | set (feature flag) | N/A | Real-time FUB activity alert toggle | No | No |
| `FOLLOWUPBOSS_REALTIME_ACTIVITY_TASKS` | brain | set (feature flag) | N/A | Auto-task creation from FUB activity | No | No |
| `FOLLOWUPBOSS_REQUIRE_BROKER_ASSIGNMENT` | brain | set (feature flag) | N/A | Require broker assignment before FUB lead creation | No | No |
| `FUB_PIPELINE_ID` | brain | set (referenced in code) | N/A | FUB pipeline ID for lead funnel | No | YES |
| `NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM` | publisher | set (`_fuid`) | N/A | FUB email click tracking URL param | No | YES |

---

## I. Cron Auth

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `CRON_SECRET` | cron | set (64 chars; comment flagged as potentially weak) [VERIFY] | N/A | ALL 30 Vercel cron handlers (every `/api/cron/*` route validates `Authorization: Bearer $CRON_SECRET`). Without this, any public caller can trigger Spark syncs and burn API quota. | YES | YES |

Note: Every cron handler in `vercel.json` (30 routes) validates this secret. If the current value is the original placeholder ("WEAK" per `.env.local` comment), it must be rotated before any cron fires in production. Rotation: `openssl rand -hex 32`, update Vercel env, update `.env.local`.

Active Vercel cron schedule (from `vercel.json`):

| Path | Schedule | Key dependencies |
|---|---|---|
| `/api/cron/sync-delta` | Every 10 min | SPARK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/sync-history-terminal` | Every 5 min | SPARK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/sync-full` | Sunday 2am | SPARK_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/refresh-video-tours-cache` | Every 30 min | SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/refresh-listing-year-stats` | Hourly | SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/refresh-place-content` | Daily 3am | SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, CRON_SECRET |
| `/api/cron/optimization-loop` | Monday 6am | SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, CRON_SECRET |
| `/api/cron/marketing-optimization-report` | Monday 6:30am | SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET |
| `/api/cron/fub-outreach-execution` | Monday 6:45am | FOLLOWUPBOSS_API_KEY, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/saved-search-alerts` | Daily 2pm | SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET |
| `/api/cron/market-report` | Saturday 2pm | SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY, ANTHROPIC_API_KEY, CRON_SECRET |
| `/api/cron/refresh-market-stats` | Every 6h | SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY, CRON_SECRET |
| `/api/cron/refresh-reporting-cache` | Daily 3:15am | SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/refresh-market-stats-monthly-recompute` | Sunday 4am | SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY, CRON_SECRET |
| `/api/cron/token-heartbeat` | Daily noon | All platform OAuth tokens, CRON_SECRET |
| `/api/cron/marketing-snapshot-ga4` | Daily 6:30am | GOOGLE_SERVICE_ACCOUNT_*, GOOGLE_GA4_PROPERTY_ID, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-competitor-recon` | Weekdays 7am | APIFY_API_TOKEN, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-platform-trends` | Monday 8am | ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-gsc` | Daily 6:30am | GOOGLE_SERVICE_ACCOUNT_*, GOOGLE_SEARCH_CONSOLE_SITE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-meta-ads` | Daily 6:30am | META_AD_ACCOUNT_ID, META_USER_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-fub` | Daily 6:30am | FOLLOWUPBOSS_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-meta-page` | Daily 6:30am | META_PAGE_ACCESS_TOKEN, META_FB_PAGE_ID, META_IG_BUSINESS_ACCOUNT_ID, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-x` | Daily 6:30am | X OAuth token (Supabase), SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-linkedin` | Daily 6:30am | LinkedIn OAuth token (Supabase), SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-weekly-cycle` | Monday 2am | ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MARKETING_DIGEST_EMAIL, CRON_SECRET |
| `/api/cron/marketing-daily-digest` | Daily 2pm | ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MARKETING_DIGEST_EMAIL, CRON_SECRET |
| `/api/cron/marketing-measurement-loop` | Daily 3pm | SUPABASE_SERVICE_ROLE_KEY, APIFY_API_TOKEN, CRON_SECRET |
| `/api/cron/marketing-inbox-poll` | Every 2 min | SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, platform OAuth tokens (Supabase), CRON_SECRET |
| `/api/cron/marketing-snapshot-tiktok` | Daily 6:30am | TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, OAuth token (Supabase), SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-gbp` | Daily 6:30am | GOOGLE_SERVICE_ACCOUNT_*, GOOGLE_BUSINESS_PROFILE_*, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |
| `/api/cron/marketing-snapshot-youtube` | Daily 6:30am | YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, OAuth token (Supabase), SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET |

---

## J. Admin UI Auth

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `ADMIN_DASHBOARD_TOKEN` | admin-auth | unset [ACTION REQUIRED] | N/A | Admin dashboard route middleware (Phase 10.5 pre-flight). Referenced as a Bearer-token guard for `/admin/*` routes. Supabase Row Level Security covers data access; this covers route-level access for unauthenticated admin UI surfaces. | No | YES |
| `CMA_WORKER_AUTH_SECRET` | admin-auth | set | N/A | `app/api/` CMA worker auth check | No | YES |
| `CMA_PREVIEW_SECRET` | admin-auth | set | N/A | CMA preview route auth | No | YES |
| `REVALIDATE_SECRET` | admin-auth | set | N/A | Next.js ISR revalidation endpoint guard | No | YES |
| `SYNC_SECRET` | admin-auth | set | N/A | MLS sync trigger auth | No | YES |
| `META_WEBHOOK_VERIFY_TOKEN` | admin-auth | set | N/A | Meta Webhook verification handshake | No | YES |
| `RESEND_WEBHOOK_SECRET` | admin-auth | set | N/A | Resend email event webhook verification | No | YES |
| `INNGEST_EVENT_KEY` | admin-auth | set (verify against Inngest dashboard) | None | Inngest event publishing | No | YES |
| `INNGEST_SIGNING_KEY` | admin-auth | set (verify against Inngest dashboard) | None | Inngest webhook signature verification | No | YES |
| `SENTRY_DSN` | admin | set | None | Sentry error reporting in Next.js app | No | YES |
| `SENTRY_AUTH_TOKEN` | admin | set | None | Sentry CLI for release upload / source maps | No | YES |
| `MARKETING_DASHBOARD_BASE_URL` | brain | unset [ACTION REQUIRED] | N/A | `lib/marketing-brain/` digest links, admin dashboard URL construction | YES | YES |

---

## K. Apify

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `APIFY_API_TOKEN` | brain / cron | set | None (usage-billed) | `cron/marketing-competitor-recon`, `cron/marketing-measurement-loop`, competitive audit scraping, social analytics scraping | No | YES |

---

## L. AgentFire WordPress

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `WP_AGENTFIRE_USER` | publisher | unset [ACTION REQUIRED] | N/A | Blog post publisher (`app/api/` WP routes, `social_media_skills/blog-post/`) | No | YES |
| `WP_AGENTFIRE_APP_PASSWORD` | publisher | unset [ACTION REQUIRED] | N/A | WordPress Application Password auth | No | YES |
| `WP_AGENTFIRE_SITE_URL` | publisher | unset [ACTION REQUIRED] | N/A | WordPress REST API base URL | No | YES |
| `AGENTFIRE_WP_USER` | publisher | unset [ACTION REQUIRED] | N/A | Alternate naming in `social_media_skills/`; should be unified with `WP_AGENTFIRE_USER` | No | YES |
| `AGENTFIRE_WP_APP_PASSWORD` | publisher | unset [ACTION REQUIRED] | N/A | Alternate naming; should be unified | No | YES |

Note: Two naming conventions exist in the codebase (`WP_AGENTFIRE_*` used in `app/api/` and `lib/`; `AGENTFIRE_WP_*` used in `social_media_skills/`). These should be consolidated to `WP_AGENTFIRE_*` to match the app layer.

---

## M. Buffer

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `BUFFER_ACCESS_TOKEN` | publisher | unset [ACTION REQUIRED] | Pre-existing v1 token (does not expire under normal use) | `lib/buffer.ts`, publisher skill multi-platform fan-out fallback | No | YES (when native per-platform API unavailable) |
| `BUFFER_PROFILE_X` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: X profile target | No | YES |
| `BUFFER_PROFILE_THREADS` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: Threads profile target | No | YES |
| `BUFFER_PROFILE_PINTEREST` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: Pinterest profile target | No | YES |
| `BUFFER_PROFILE_INSTAGRAM` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: Instagram profile target | No | YES |
| `BUFFER_PROFILE_FACEBOOK` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: Facebook profile target | No | YES |
| `BUFFER_PROFILE_LINKEDIN` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: LinkedIn profile target | No | YES |
| `BUFFER_PROFILE_TIKTOK` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: TikTok profile target | No | YES |
| `BUFFER_PROFILE_YOUTUBE` | publisher | unset [ACTION REQUIRED] | N/A | Buffer fan-out: YouTube profile target | No | YES |

Note: Buffer no longer accepts new OAuth app registrations. `BUFFER_ACCESS_TOKEN` must be the pre-existing v1 personal access token from buffer.com. Do not attempt a fresh OAuth flow.

---

## N. Analytics

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `GOOGLE_GA4_PROPERTY_ID` | cron | set | N/A | `cron/marketing-snapshot-ga4`, admin dashboard GA4 data | No | YES |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | publisher | set | N/A | Client-side GA4 tag (gtag) | No | YES |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | publisher | set | N/A | Google Tag Manager container | No | YES |
| `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` | cron | set | N/A | GA4 Data API, Search Console API, Drive API (server-side via service account) | No | YES |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | cron | set | N/A | Same service account private key (1732 chars; RSA PEM) | No | YES |
| `GOOGLE_SERVICE_ACCOUNT_SUBJECT` | cron | set | N/A | DWD impersonation subject (`matt@ryan-realty.com`) for GA4 / Search Console / Drive | No | YES |
| `GOOGLE_SEARCH_CONSOLE_SITE_URL` | cron | unset [ACTION REQUIRED] | N/A | `cron/marketing-snapshot-gsc`, GSC performance data | No | YES |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | publisher | set | N/A | Google AdSense display tag | No | No |
| `NEXT_PUBLIC_META_PIXEL_ID` | publisher | set | N/A | Meta Pixel (client-side, pending new pixel creation per `.env.local` comment) | No | YES |
| `NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN` | publisher | set | N/A | Client-side Meta API calls (used cautiously; exposes token) | No | PARTIAL |
| `UPSTASH_REDIS_REST_URL` | brain / cron | set | None | Rate limiting, caching, `lib/tiktok.ts` OAuth token cache, publisher queue | YES | YES |
| `UPSTASH_REDIS_REST_TOKEN` | brain / cron | set | None | Same | YES | YES |
| `NEXT_PUBLIC_SITE_URL` | publisher | set | N/A | Canonical site URL used in metadata, OG tags, sitemaps, email links | YES | YES |

---

## O. xAI Grok + Synthesia + Apollo

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `XAI_API_KEY` | brain / producer-specific | set | None (usage-billed) | Grok-based competitive intelligence, trend analysis, `app/api/` Grok routes | No | YES |
| `SYNTHESIA_API_KEY` | producer-specific | set | None (usage-billed) | Synthesia avatar video generation (avatar market update producer) | No | YES |
| `SYNTHESIA_AVATAR_ID` | producer-specific | unset [ACTION REQUIRED] | N/A | Synthesia avatar selection for avatar_market_update producer | No | YES |
| `SYNTHESIA_MATT_VOICE_ID` | producer-specific | unset [ACTION REQUIRED] | N/A | Synthesia voice selection | No | YES |

Note: Apollo (`APOLLO_API_KEY`) is not referenced in `.env.local` or codebase scans. If the Apollo MCP is used, it authenticates via its own MCP credentials rather than an env var in this repo.

---

## P. Infrastructure / Misc

| Var | Scope | Status | Expiry | Consumers | Smoke test required | Live prod required |
|---|---|---|---|---|---|---|
| `INNGEST_EVENT_KEY` | admin-auth | set | None | Inngest event publishing (`lib/`, API routes) | No | YES |
| `INNGEST_SIGNING_KEY` | admin-auth | set | None | Inngest webhook verification | No | YES |
| `UPSTASH_REDIS_REST_URL` | brain / cron | set | None | Rate limiting, caching, queue management | YES | YES |
| `UPSTASH_REDIS_REST_TOKEN` | brain / cron | set | None | Same | YES | YES |
| `GH_TOKEN` / `GITHUB_TOKEN` | admin | referenced in scripts | N/A | GitHub API calls from deploy scripts | No | No |
| `VERCEL_TOKEN` | admin | referenced in code | N/A | Vercel API (deploy, env management) | No | No |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | publisher | referenced in code | N/A | Web Push notifications | No | No |
| `SYNC_SECRET` | admin-auth | set | N/A | MLS sync trigger auth guard | No | YES |
| `NODE_ENV` | system | set by runtime | N/A | Environment detection across entire codebase | YES | YES |

---

## Summary by Category

| Category | Total vars | Set | Unset / missing | Placeholder / needs verify |
|---|---|---|---|---|
| A. Anthropic + AI | 9 | 7 | 2 | 0 |
| B. Platform OAuth | 38 | 20 | 16 | 2 |
| C. MLS + Data | 12 | 6 | 4 | 2 |
| D. Supabase | 3 | 3 | 0 | 0 |
| E. Email | 6 | 2 | 3 | 1 |
| F. Video / Audio | 10 | 8 | 1 | 1 |
| G. Maps | 6 | 4 | 1 | 1 |
| H. CRM | 11 | 9 | 0 | 2 |
| I. Cron auth | 1 | 1 | 0 | 1 |
| J. Admin UI auth | 12 | 10 | 1 | 1 |
| K. Apify | 1 | 1 | 0 | 0 |
| L. AgentFire WP | 5 | 0 | 5 | 0 |
| M. Buffer | 9 | 0 | 9 | 0 |
| N. Analytics | 11 | 9 | 1 | 1 |
| O. xAI + Synthesia + Apollo | 4 | 2 | 2 | 0 |
| P. Infrastructure | 9 | 6 | 0 | 3 |
| **Totals** | **107** | **88** | **45** | **15** |

Note: "Unset / missing" includes vars that are not in `.env.local` at all and vars that are empty strings. Several platform access tokens (LinkedIn, YouTube, X, TikTok) are stored in Supabase `oauth_tokens` rather than env vars; they show as "unset in env" but may be populated via OAuth flows in the database.

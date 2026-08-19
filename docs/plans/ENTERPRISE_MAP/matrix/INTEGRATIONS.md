# Integration matrix (INT-001…037)

**Captured:** 2026-08-08T21:30Z · **Env inventory:** `inventories/D-env-keys.txt` (117 keys) · **Live social/DB:** `inventories/P-db-probes.json`, `M-live-db-counts.json`  
**Secrets:** key **names** only — never values.

Authority: **SoR** system of record · **Mirror** secondary · **Runtime** executes · **Legacy** present but not authority · **Optional** · **Tooling**

Health: **green** · **amber** · **red** · **dark** · **unknown**

Disposition: **KEEP** · **FIX** · **RECONNECT** · **PARK** · **LEGACY_RESIDUE** · **TOOLING**

| ID | System | Env evidence (names) | Code/runtime | Live signal (2026-08-08) | Authority | Health | Disposition | owner_loop |
|----|--------|----------------------|--------------|--------------------------|-----------|--------|-------------|------------|
| INT-001 | Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | entire app; `lib/supabase*`, `lib/data/**` | listings **594623**; pulse 45; cache 12995; crm_people 22978 | **SoR** (app data) | **green** | **KEEP** | Data / platform — continuous; project `dwvlophlbvvygjfxcrhm` |
| INT-002 | Spark MLS | `SPARK_API_BASE_URL`, `SPARK_API_KEY` | `lib/spark.ts`, `app/actions/sync-spark.ts`, crons `sync-delta` / `sync-full` / `sync-verify-*` | inventory large (listings/history); dedicated sync_cursor REST tables not exposed (PGRST205) | **SoR** (MLS feed) | **amber** | **KEEP** | Sync lane — verify active-listing freshness via `sync-status-report`; do not treat row count alone as delta health |
| INT-003 | Vercel | `CRON_SECRET` (+ platform project env) | host; `vercel.json` crons (**61** scheduled); `scripts/vercel-ignore-build.mjs` | production deploys from `main`; Build CPU cost constraint | **Runtime** | **green** | **KEEP** | Deploy loop — `deploy:verify` after user-facing push; docs-only skip via ignoreCommand |
| INT-004 | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_PHONE_NUMBER`, per-broker `TWILIO_NUMBER_*` / `TWILIO_FORWARD_*`, `TWILIO_NUMBER_MARKETING` | `app/api/twilio/*`, `lib/comms/sendGovernedSms.ts`, CRM SMS agent | `crm_message` **45299**; latest sample activity **2026-08-01** | **Runtime** comms | **amber** | **KEEP** | Comms loop — send health / failed SMS; feature flag `CRM_SMS_ALERTS` (see INT-037) |
| INT-005 | Resend | `RESEND_API_KEY`, `RESEND_WEBHOOKS_API_KEY` (+ runtime `RESEND_FROM` / admin email) | `lib/resend.ts`, digests, sequence engine, webhooks | `email_events` **564**; latest **2026-08-08** | **Runtime** email | **green** | **KEEP** | Email loop — webhook nightly + deliverability; events prove write path live |
| INT-006 | Google SA / Gmail | `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SERVICE_ACCOUNT_SUBJECT` | `lib/gmail-draft.ts`, `lib/marketing-brain/inbox-auth.ts`, `lib/agent/gmail.ts` | SA configured; `broker_gcal_tokens` **0** rows | **Runtime** mail | **amber** | **KEEP** | Inbox/agent loop — SA present; GCal tokens empty (not wired or never connected) |
| INT-007 | Meta | `META_APP_ID`, `META_APP_SECRET`, `META_CAPI_ACCESS_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_USER_ACCESS_TOKEN*`, `META_AD_ACCOUNT_ID`, `META_FB_PAGE_ID`, `META_FB_PAGE_NAME`, `META_IG_BUSINESS_ACCOUNT_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_OAUTH_STATE`, `NEXT_PUBLIC_META_PIXEL_ID` | `lib/meta-*.ts`, `lib/meta/**`, CAPI, webhooks, ads; hold DAL `readMetaAudienceHold` | `meta_audience_log` last LIVE **2026-08-16T09:01:26Z** CRM `120246504502300698` received **13980** (probe 2026-08-16). Consecutive UTC days already ≥7; KEEP waits for a day **≥ 2026-08-22** (G11 accept). Daily freshness 36h. | **Runtime** ads/social | **green** (ops) / hold open | **FIX** until G11 accept day | Seller growth / ads loop — list refresh is live; spend remains Matt-gated; do not flip KEEP before 2026-08-22 |
| INT-008 | GA4 / GTM | `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `GOOGLE_GA4_PROPERTY_ID`, `NEXT_PUBLIC_GTM_CONTAINER_ID` | `lib/ga4-*`, snapshot-channels `ga4`, site tags | keys present; snapshots in PLATFORMS | **Mirror** analytics | **amber** | **KEEP** | Analytics loop — mirror only; not SoR for leads |
| INT-009 | GBP | `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID`, `GOOGLE_BUSINESS_PROFILE_LOCATION_ID`, `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI` (+ OAuth falls back to `GOOGLE_OAUTH_*`) | `lib/google-business-profile.ts`, snapshot-channels `gbp`, `gbp-monthly-digest` | auth **1** row; refresh_token on file; access token is 1h Google TTL, **auto-refreshes** via daily 12:00Z heartbeat (verified live 2026-08-15: 12:00:03Z ok + on-demand renew to 19:09Z) | **Runtime** local SEO | **green** | **KEEP** | Local SEO loop — heartbeat keeps it alive; the short `expires_at` is provider design, not a defect |
| INT-010 | LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_PERSON_ID`, `LINKEDIN_REDIRECT_URI` | `lib/linkedin.ts`, publish/snapshot paths | auth **1**; access token expired 2026-07-09; **refresh_token NULL** — provider issued none, so no self-renewal path exists | **Optional** social | **dark** | **PARK** | **PARK per Matt 2026-08-15** (no reconnect asks). A new OAuth grant happens only if LinkedIn distribution is ever wanted. Heartbeat logs it 500 daily — expected while parked |
| INT-011 | TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` | `lib/tiktok.ts`, `app/api/tiktok/*`, `token-heartbeat`, measurement-loop | auth **1**; refresh_token on file; 24h token **auto-refreshes** daily (verified 2026-08-15: heartbeat rolled expiry to 2026-08-16 12:00Z) | **Runtime** social | **green** | **KEEP** | Social loop — rolling 365d refresh window, heartbeat well inside it |
| INT-012 | YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI` | `lib/youtube.ts`, `lib/youtube-market-report/**`, upload scripts | auth **1**; refresh_token on file; 1h Google TTL, **auto-refreshes** (verified live 2026-08-15, renewed on demand to 19:09Z) | **Runtime** social/video | **green** | **KEEP** | Video distribute loop — token-ready whenever a publish runs |
| INT-013 | X (Twitter) | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI` | `lib/x.ts`, snapshot-channels `x` | auth **1**; rotating refresh_token on file; 2h TTL, **auto-refreshes** (verified live 2026-08-15, renewed on demand to 20:09Z) | **Runtime** social | **green** | **KEEP** | Social publish loop — rotating refresh persisted each call |
| INT-014 | Threads | `THREADS_CLIENT_ID`, `THREADS_CLIENT_SECRET`, `THREADS_REDIRECT_URI` | `lib/threads.ts` (full OAuth+publish client); brand URL only in `lib/brand/contact.ts` | auth **0** NOT_CONNECTED | **Optional** | **dark** | **PARK** | **PARK disposition:** client keys exist but **no token row** and no production publish cadence. Do not schedule Threads work or spend reconnect effort until Matt prioritizes Threads distribution. Code may stay; treat as dormant optional surface. |
| INT-015 | Nextdoor | `NEXTDOOR_CLIENT_ID`, `NEXTDOOR_CLIENT_SECRET`, `NEXTDOOR_REDIRECT_URI` | `lib/nextdoor.ts` (OAuth + post API; access gated by Nextdoor developer approval) | auth **0** NOT_CONNECTED | **Optional** | **dark** | **PARK** | **PARK disposition:** env clients present; **never OAuth-connected**. Nextdoor partner access may still be gated. Park until explicit “connect Nextdoor” decision — not a red failure of core product. |
| INT-016 | Pinterest | *(no `PINTEREST_CLIENT_*` in D-env-keys)*; code expects `PINTEREST_CLIENT_ID/SECRET/REDIRECT_URI`, optional `PINTEREST_DEFAULT_BOARD_ID` | `lib/pinterest.ts` | auth **0** NOT_CONNECTED; client keys **absent** locally | **Optional** | **dark** | **PARK** | **PARK disposition:** library exists, **no client credentials in env inventory**, auth empty. Park permanently until product prioritizes pin distribution and issues app credentials. |
| INT-017 | SkySlope | `SKYSLOPE_ACCESS_KEY`, `SKYSLOPE_ACCESS_SECRET`, `SKYSLOPE_CLIENT_ID`, `SKYSLOPE_CLIENT_SECRET`, `SKYSLOPE_LOGIN_EMAIL`, `SKYSLOPE_LOGIN_PASSWORD` | TC strangler; `lib/tc/*`, `skyslope_transactions`; cron `/api/cron/skyslope-mirror-refresh` | rows **33** (= tc_deals); newest `synced_at` **2026-06-10T00:35:10Z** still STALE; **ops path LIVE** (auth-gated 401 on ryan-realty.com, dpl `3LKLi3cQjgcKFvhLEXyU7N4AGPx8`) | **Mirror**/workflow (not SoR; Vault is TC SoR) | **amber** | **KEEP** (ops) / freshness residual | First refresh waits on production cron 06:20 UTC or a session with the real `CRON_SECRET`. Never treat SkySlope as transaction SoR |
| INT-018 | In-house CRM | none | `lib/crm/send-event.ts` → `ensureNativeLead` → `public.crm_people`; review at `/admin/crm` | CRM SoR is `crm_people` | **Runtime** | **green** | **KEEP** | Live CRM. No vendor people API. |
| INT-019 | ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_ID_VICTORIA`, `ELEVENLABS_VOICE_ID_ELLEN` | `lib/voice/*`, `scripts/_voice_lib.py`; Victoria locked | keys present; VO pipeline code live | **Runtime** creative | **green** | **KEEP** | Creative/VO loop — Victoria only for public VO; Ellen id is alt inventory |
| INT-020 | Apify | `APIFY_API_TOKEN` | `lib/fsbo-detector.ts`, `lib/marketing-brain/competitor-recon.ts` | token present; FSBO/recon paths | **Runtime** scrape | **green** | **KEEP** | Prospecting loop — FSBO / competitor recon |
| INT-021 | OpenAI | `OPENAI_API_KEY` | AI features across app/scripts | GET `/v1/models` **200** models **118** (2026-08-16) | **Runtime** AI | **green** | **KEEP** | AI loop — models list live; no completion spend this probe |
| INT-022 | Anthropic | `ANTHROPIC_API_KEY` | `lib/ai/anthropic.ts`, producer-runtime, voice reviewer | key present; producers depend | **Runtime** AI | **green** | **KEEP** | Brain/producer loop — primary model path for many rows |
| INT-023 | xAI | `XAI_API_KEY` | `lib/grok-*.ts` | GET `/v1/models` **200** models **12** (2026-08-16) | **Runtime** AI | **green** | **KEEP** | Grok creative loop — models list live; no generate this probe |
| INT-024 | Google Maps | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `REMOTION_GOOGLE_MAPS_KEY` | maps UI, CMA maps, Remotion | keys present; site maps critical path | **Runtime** maps | **green** | **KEEP** | Product maps loop |
| INT-025 | Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `lib/x.ts`, `lib/pinterest.ts` OAuth state, rate limits | keys present; used as ephemeral OAuth state store | **Runtime** cache | **green** | **KEEP** | Platform loop — OAuth CSRF/state depends on Redis where used |
| INT-026 | Sentry | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Next/Sentry SDK wiring | token `org:ci` only; DSN project **0** stub; no ingest host in prod JS | **Optional** monitoring | **dark** | **PARK** | Observability — SDK may stay; ingest is not live. Do not treat as a production monitor |
| INT-027 | RentCast | `RENTCAST_API_KEY` | changelog notes HUD FMR preferred; calc accepts optional estimate | key in env; little/no live `.ts` call sites found this pass | **Optional** data | **dark** | **PARK** | DSCR/tools loop — prefer `lib/hud-fmr`; key may be residue until AVM product re-enabled |
| INT-028 | SchoolDigger | `SCHOOLDIGGER_API_KEY`, `SCHOOLDIGGER_APP_ID` | research JSON / school URLs; tool inventory “configured” | keys present; static research more than live API traffic | **Optional** data | **dark** | **PARK** | Content/SEO schools — park live API until school pages re-wire to API; static data remains |
| INT-029 | NeverBounce | `NEVERBOUNCE_API_KEY` | `scripts/_neverbounce-validate.mjs` | key **missing** this env; ops CSV only | **Optional**/Tooling | **dark** | **PARK** | Email hygiene — no product path. Park until a funded hygiene job |
| INT-030 | BatchData | `BATCHDATA_API_KEY` | `lib/owner-resolution.mjs`, expired owner lookup | key present; skip-trace path in expired processor | **Runtime** enrichment | **green** | **KEEP** | Expired/FSBO prospecting — Vercel must have key or skip-trace fails soft |
| INT-031 | Stock media | `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `SHUTTERSTOCK_API_KEY`, `SHUTTERSTOCK_API_SECRET` | `lib/pexels-api.ts`, `lib/photo-api.ts`, `lib/shutterstock-api.ts` | Unsplash search **200** results=1 (2026-08-16); Pexels/Shutterstock missing here | **Runtime** creative | **green** | **KEEP** | Creative assets — Unsplash is the live path |
| INT-032 | Gen media | `REPLICATE_API_TOKEN`, `FAL_KEY`, `SYNTHESIA_API_KEY` | `app/actions/broker-headshot.ts`, `app/actions/synthesia.ts`, video scripts | Replicate account **200** `ryanrealty`; Synthesia videos **200** n=1; FAL missing | **Runtime** creative | **green** | **KEEP** | Creative gen — account paths live; no generate this probe |
| INT-033 | VAPID (web push) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `app/api/push/_lib/web-push.ts`; `/sw.js` | keys **missing** this env; `push_subscriptions` 1/0 active; `/sw.js` 200 | **Optional** | **dark** | **PARK** | Push channel code live, unconfigured. No send. Park until VAPID keys are provisioned |
| INT-034 | Inngest | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | `lib/inngest.ts` thin HTTP `send` (no-op if key missing); `app/api/admin/sync*` emits events | keys present; **no Inngest functions/worker surface** in repo — fire-and-forget only | **Optional**/Tooling | **amber** | **PARK** | Sync UX loop — **depth: not production job runner**. Crons own real work. Keep keys or drop; do not plan jobs on Inngest without re-architecture |
| INT-035 | Google OAuth / CrUX | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CRUX_API_KEY`, `GCP_USER_REFRESH_TOKEN` | GBP/YouTube/etc OAuth fallback; `scripts/measure-search-and-analytics.mjs` (CrUX) | OAuth clients present; dependent social tokens auto-refresh via heartbeat (verified 2026-08-15) | **Runtime**/Tooling | **amber** | **KEEP** | Shared OAuth client + perf tooling; CrUX is measure script only |
| INT-036 | AdSense | `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | `components/AdUnit.tsx`, `GoogleAnalytics.tsx` | prod JS has `adsbygoogle` + `pub-592866…` (2026-08-16); consent + lazyOnload | **Optional** | **green** | **KEEP** | Monetization — client in production bundle; slots on `/tools/appreciation` + `/activity` |
| INT-037 | OTHER / tooling bucket | Leftover & cross-cutting keys from `D-env-keys.txt` not owned solely by INT-001…036 (see table below) | scattered flags, TC ingest, Vertex, Cursor, site URL | mixed (flags + tooling keys present) | **Tooling** / flags | **amber** | **TOOLING** | Map hygiene — do not invent INT rows for every flag; review annually for dead keys |

## INT-037 leftover key map (from `inventories/D-env-keys.txt`)

Keys **not** fully covered as primary credentials of INT-001…036, or dual-use flags:

| Key name | Maps to | Disposition note |
|----------|---------|------------------|
| `CRM_SMS_ALERTS` | Twilio feature flag (`crm-alert-drain` expects `twilio`) | TOOLING/flag — KEEP with INT-004 |
| `LEAD_SMS_IMESSAGE_FALLBACK` | SMS delivery preference | TOOLING/flag — KEEP with INT-004 |
| `TC_FORMS_INGEST_SECRET` | `app/api/admin/forms/ingest` | TC ingest auth — KEEP with CAP-TC / INT-017 adjacency |
| `NEXT_PUBLIC_SITE_URL` | absolute URLs, emails | Platform config — KEEP |
| `CURSOR_API_KEY` | Cursor tooling | **TOOLING** only |
| `VERTEX_PROJECT_ID`, `VERTEX_LOCATION` | Google Vertex (if used) | **TOOLING**/optional AI — no heavy runtime path found this pass |
| `GCP_USER_REFRESH_TOKEN` | Google user refresh (scripts) | TOOLING — with INT-035 |
| `ELEVENLABS_VOICE_ID_ELLEN` | alt ElevenLabs voice | KEEP under INT-019 inventory; Victoria remains canon |
| `META_OAUTH_STATE` | Meta OAuth | KEEP under INT-007 |
| (none) | In-house CRM | Covered by INT-018 — `crm_people` / `/admin/crm` |
| Remaining INT-001…036 keys | their INT rows | accounted |

**D-env total:** 117 names. Primary integration keys assigned INT-001…036; residue + flags + Vertex/Cursor/site → INT-037 bucket.

## PARK list (explicit)

| ID | System | Why PARK (2026-08-08; INT-010 added 2026-08-15) |
|----|--------|------------------------|
| **INT-010** | LinkedIn | Access token expired 2026-07-09 and `refresh_token` is NULL (provider issued none — standard LinkedIn apps get 60-day tokens without rolling refresh). Self-renewal impossible; a new grant happens only if LinkedIn distribution is ever wanted. Parked per Matt 2026-08-15 — no reconnect asks |
| **INT-014** | Threads | Client keys only; `threads_auth` n=0; no publish cadence; optional social |
| **INT-015** | Nextdoor | Client keys present; `nextdoor_auth` n=0; never connected; partner gate possible |
| **INT-016** | Pinterest | No client keys in env; `pinterest_auth` n=0; library only |
| **INT-027** | RentCast | Key present; product prefers HUD FMR; no active call-site census |
| **INT-028** | SchoolDigger | Keys present; static research dominates; live API not product-critical |
| **INT-026** | Sentry | Stub DSN project 0; CI token `org:ci` only; ingest not live |
| **INT-029** | NeverBounce | Key missing; ops CSV script only; no product path |
| **INT-033** | VAPID | Keys missing; 0 active push subscriptions; `/sw.js` present |
| **INT-034** | Inngest | Optional event emit only; not job orchestrator |

## Health Sense rollup (required fields)

| ID | last_success_at (known) | token_expiry | authority_ok | error_rate | owner_loop |
|----|-------------------------|--------------|--------------|------------|------------|
| INT-001 | continuous (live REST 2026-08-08) | n/a | yes SoR | unknown | Data |
| INT-002 | inventory live; delta Sense still needed | n/a | yes SoR MLS | unknown | Sync |
| INT-003 | deploys when main changes | n/a | yes Runtime | n/a | Deploy |
| INT-004 | crm_message sample 2026-08-01 | n/a | yes | unknown | Comms |
| INT-005 | email_events 2026-08-08 | n/a | yes | unknown | Email |
| INT-006 | SA present; GCal empty | n/a | yes for Gmail SA | unknown | Inbox |
| INT-007 | meta_audience LIVE 2026-08-16T09:01Z (CRM 13980); hold open until 2026-08-22 | page tokens opaque | yes Runtime | hold open (G11) | Ads |
| INT-008 | snapshot path exists | n/a | mirror only | unknown | Analytics |
| INT-009 | heartbeat ok 2026-08-15T12:00Z + live renew 19:09Z | 1h TTL, auto-refresh | yes (refresh_token) | n/a | Local SEO |
| INT-010 | expired 2026-07-09; refresh_token NULL | n/a — PARK (Matt 2026-08-15) | no self-renewal path | n/a | Social (parked) |
| INT-011 | heartbeat refreshed 2026-08-15T12:00Z | rolls daily (24h TTL), auto-refresh | yes (refresh_token) | n/a | Social |
| INT-012 | heartbeat ok 2026-08-15T12:00Z + live renew 19:09Z | 1h TTL, auto-refresh | yes (refresh_token) | n/a | Video |
| INT-013 | heartbeat ok 2026-08-15T12:00Z + live renew 20:09Z | 2h TTL, auto-refresh (rotating) | yes (refresh_token) | n/a | Social |
| INT-014 | never | n/a | n/a PARK | n/a | — |
| INT-015 | never | n/a | n/a PARK | n/a | — |
| INT-016 | never | n/a | n/a PARK | n/a | — |
| INT-017 | ops live 2026-08-16; synced_at still 2026-06-10 | n/a | Mirror only (ok) | stale until first cron | TC |
| INT-018 | cutover 2026-06-24 | n/a | **must be false as SoR** | n/a | CRM legacy |
| INT-019…025 | keys present / probed | n/a | yes where used | n/a | per row |
| INT-021 | models 118 at 2026-08-16 | n/a | yes | n/a | AI |
| INT-023 | models 12 at 2026-08-16 | n/a | yes | n/a | Grok |
| INT-026 | stub DSN; org:ci token | n/a | no ingest | n/a | PARK |
| INT-029 | key missing | n/a | n/a PARK | n/a | PARK |
| INT-031 | Unsplash 200 (2026-08-16) | n/a | yes | n/a | Creative |
| INT-032 | Replicate+Synthesia 200 | n/a | yes | n/a | Creative |
| INT-033 | keys missing; 0 active subs | n/a | n/a PARK | n/a | PARK |
| INT-034 | n/a (optional emit) | n/a | optional | n/a | PARK |
| INT-035 | CrUX script-only; OAuth shared | see socials | partial | n/a | OAuth |
| INT-036 | prod JS pub-592866 + adsbygoogle 2026-08-16 | n/a | optional live | n/a | Ads |
| INT-037 | n/a | n/a | tooling | n/a | Hygiene |

## Health counts (corrected 2026-08-16 — G13 unknown-health probes; supersedes the 2026-08-15 unknown=8) — 37 rows

| Health | n | IDs |
|--------|--:|-----|
| **green** | **18** | 001 Supabase · 003 Vercel · 005 Resend · 009 GBP · 011 TikTok · 012 YouTube · 013 X · 019 ElevenLabs · 020 Apify · 021 OpenAI · 022 Anthropic · 023 xAI · 024 Maps · 025 Upstash · 030 BatchData · 031 Stock · 032 Gen media · 036 AdSense |
| **amber** | **9** | 002 Spark · 004 Twilio · 006 Google SA · 007 Meta · 008 GA4/GTM · 017 SkySlope · 034 Inngest · 035 Google OAuth/CrUX · 037 OTHER/tooling |
| **red** | **0** | — (2026-08-08 called 009/010/012/013 red from `expires_at` alone; that read ignored refresh tokens + the heartbeat — see EVIDENCE-LOG 2026-08-15 and `process_escape_ledger`) |
| **dark** | **10** | 010 LinkedIn (parked, no provider refresh token) · 014 Threads · 015 Nextdoor · 016 Pinterest · 018 FUB · 026 Sentry · 027 RentCast · 028 SchoolDigger · 029 NeverBounce · 033 VAPID |
| **unknown** | **0** | — |
| **sum** | **37** | |

## Disposition counts

| Disposition | n | IDs / notes |
|-------------|--:|-------------|
| **KEEP** | 23 | runtime retain (greens + most amber keepers, incl. 009/012/013 auto-refresh + 035 shared OAuth clients) |
| **FIX** | 2 | 007 Meta audience heartbeat (first green 2026-08-15, hold 7d) · 017 SkySlope mirror freshness |
| **RECONNECT** | 0 | none — auto-refresh verified; there is no standing "Matt reconnect" task (Matt 2026-08-15) |
| **PARK** | 10 | 010 LinkedIn · 014 Threads · 015 Nextdoor · 016 Pinterest · 026 Sentry · 027 RentCast · 028 SchoolDigger · 029 NeverBounce · 033 VAPID · 034 Inngest |
| **LEGACY_RESIDUE** | 1 | 018 FUB |
| **TOOLING** | 1 | 037 OTHER bucket |

## Cron wiring note

21 top-level cron dirs not named as first segment in vercel.json paths: see `inventories/C-crons-dark.txt` (count evolved; use latest inventory).  
**Known nuance:** marketing-snapshot-* often fanned out by `snapshot-channels` parent — classify true-orphan vs fan-out child before calling broken. `google-ads` now in PLATFORMS (prior fix).

## Evidence sources

- `inventories/D-env-keys.txt`, `P-db-probes.json`, `M-live-db-counts.json`, `E-github-workflows.txt`, `Z-inventory-meta.json`  
- Code: `lib/{threads,nextdoor,pinterest,tiktok,linkedin,x,youtube,google-business-profile,retiredVendorCrm,inngest,resend,spark,meta-*}.ts`  
- Append detail: `matrix/EVIDENCE-LOG.md` § INT close pass  

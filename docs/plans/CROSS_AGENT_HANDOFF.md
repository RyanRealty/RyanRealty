# Cross-agent handoff (Cursor ↔ Claude Cowork / Claude Code)

**Purpose:** The other agent cannot read your chat. Anything not in `git` + this file + `task-registry.json` is invisible. Update this document **before you stop** or when switching tools, so pickup is fast and safe.

**Convention:** Keep the **Current** section accurate. After each handoff, you may move the previous "Current" block under **History** (newest history first) or delete stale bullets—do not let this file become a novel.

---

## Current (replace this block each time you hand off)

| Field | Value |
|--------|--------|
| **Surface** | **Cursor Agent (this session)** — Resumed locked Facebook Ad Campaign Optimization agent and unblocked the FUB execution pipeline. |
| **Stopped at (UTC)** | 2026-05-10 05:12 — Live FUB API fallback shipped; production cron just generated 150 outreach packets and applied 55 to FUB. |
| **`main` @ commit** | `2762ec96` (Vercel production READY). |
| **Task focus** | Restore Facebook seller optimization data flow after the legacy `fub_contacts_cache` / `fub_contacts` tables were dropped, plus tighten packet lifecycle and Facebook attribution. |

### Done this session (Cursor Agent)

- Recovered the locked agent state from `agent_insights` + prior Cursor transcripts.
- Added `fetchMyLeadsFromFubLive` in `lib/followupboss.ts` — paginates the FUB People API by assigned user id (env map → broker email lookup) and returns the legacy snapshot row shape.
- `app/api/cron/fub-outreach-execution/route.ts` now tries `fub_contacts_cache` → `fub_contacts` → live FUB API; surfaces `source_table` + `source_warning` in the response payload.
- `app/actions/dashboard.ts` `getFubPipelineSnapshot` uses the same live fallback so the admin marketing command center stops returning empty pipelines.
- Seller-funnel attribution in `getDashboardMarketingData` now counts visits with `utm_source=facebook`, `fbclid=`, or a Facebook/Instagram/Messenger referrer (was UTM-only).
- Both weekly crons mark prior `pending` / `in_progress` insights of their type as `implemented` after a successful new write so the queue reflects reality.
- Production verification (commit `2762ec96`):
  - `marketing-optimization-report` → `score 45/100 (at_risk)`, packet `52149c3e-14c1-47f2-8359-581f476a760f` (pending).
  - `fub-outreach-execution` → `source_table=fub_api_live`, `my_leads_count=1500`, `targetable_count=1433`, `generated_outreach=150`, `applied_count=55`. Packet `9a636a91-f788-4670-98a5-54494577b082` (pending).
  - Old `pending` packets auto-rolled to `implemented` ✓.

### Next agent should (Cursor or Claude Code)

1. `git pull --rebase origin main` (latest commit `2762ec96`).
2. **Wire GA4 service account creds in Vercel** — `GOOGLE_GA4_PROPERTY_ID` is set (`527333348`), but `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` are missing. Until those are added, optimization scoring stays in `at_risk` because GA4 attribution is unavailable. Steps: create/reuse a GCP service account, grant it Viewer on the GA4 property, generate a JSON key, store the email + private key (literal `\n` for newlines) as Vercel env vars in all three environments.
3. After GA4 is wired, rerun `/api/cron/marketing-optimization-report` and confirm `score` rises and the report card no longer flags GA4 setup.
4. Investigate why only 55 of 150 outreach attempts changed FUB state — likely some contacts already had the target stage and merged tags so `updatePersonAutomationState` returned `false` with no body to send. Consider relaxing that guard or always falling back to `addPersonNote` so `applied_count` matches `generated_outreach`.
5. Optional: re-introduce a `fub_contacts_cache` mirror table so the dashboard does not pay the FUB API cost on every render (live pull is fine for the weekly cron, less ideal for the dashboard).

### Skills actually read (paths)

- `/Users/matthewryan/RyanRealty/.claude/skills/facebook-seller-growth/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/supabase/release_v0.1.4/skills/supabase/SKILL.md`

---

## History (optional; newest first)

### 2026-04-24 — Claude Code — Schoolhouse v5 listing video build, Gate 1 complete

- Surface / commit / status at handoff time:
  - **`main` @ commit** `033c9e5`
  - Gate 1 photo audit + contact sheet shipped; Matt had the email + Vercel URL.
- Done this session (Claude Code):
  - Pulled full 89-photo Schoolhouse listing library from Drive `images-for-web-or-mls` via viewer@ service account + DWD impersonation of matt@ (`.env.local` now has `viewer@ryanrealty.iam.gserviceaccount.com` as the consolidated SA — GA4, Drive, Search Console, Sheets all use this single SA).
  - Pulled 2 Snowdrift Visuals area-guide stills + indexed 16 historic Vandevert/Locati portraits already on disk → 107 total photos.
  - Generated 480px JPEG thumbnails for all 107 + emitted manifest at `listing_video_v4/public/v5_library/manifest.json`.
  - Probed all 5 prior Schoolhouse MP4s (v1, v2, Pending Reel, VirtualTour Short/Full) — all 1080×1920.
  - Built mobile-responsive HTML contact sheet with checkbox + copy-picks UI at `public/photo-review-v5.html` and `listing_video_v4/photo_contact_sheet_v5.html`.
  - Pushed commit `033c9e5` to origin/main, Vercel auto-deploys to https://ryanrealty.vercel.app/photo-review-v5.html.
  - Sent Resend email `b94cc0dd-a080-453c-9f90-cc77bda1d98e` to matt@ryan-realty.com with the link.
- Open follow-ups for the Schoolhouse v5 build (still relevant):
  - Wait for Matt's photo picks (he'll paste the "Copy picks" output from the contact sheet).
  - **Gate 2:** Write `listing_video_v4/STORYBOARD_v5.md` — one row per VO sentence with photo file, aspect ratio, motion choice, justification. Email Matt for approval.
  - **Gate 3:** Voice padding test (15s sample with real inter-sentence silence via ffmpeg `apad`/concat OR ElevenLabs SSML `<break>`) + boundary draw test (6s standalone clip of Vandevert Ranch parcel boundary draw over satellite tile, gold #C8A864 SVG dasharray stroke). Email both for approval.
  - **Gate 4:** Full render with Remotion. NO AI photo-to-video (Round 4 ban). Use existing `cameraMoves.ts` push/pan primitives. Run `design:design-critique` subagent on rendered MP4 before email.
  - **Gate 5:** Resend with thumbnail grid + change log. Pattern from `listing_video_v4/send_v3.py`.
- Notes carried forward:
  - Resend `From:` is currently `onboarding@resend.dev`. Verifying `matt@ryan-realty.com` as a Resend sender domain would unblock proper From branding on future client-facing email.
  - $3,025,000 Schoolhouse price still needs SkySlope/MLS verification before Gate 4 burns it into the closing reveal frame.

